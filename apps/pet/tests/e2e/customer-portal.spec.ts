import { expect, test, type Page } from "@playwright/test";
import { admin, emailLink, noSeriousViolations, signIn, uniqueEmail, uniqueSlug } from "./helpers";

/**
 * Transformation R3, across roles: a salon lists itself; a pet owner signs up,
 * adds a pet, browses, sends a booking request; the front desk confirms a
 * groomer and time; the owner sees it confirmed. Nothing is booked before
 * the salon confirms.
 */
const PASSWORD = "a-strong-passphrase-42";
const TZ = "Australia/Melbourne";
const localDate = (days: number) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(Date.now() + days * 86_400_000));

async function salon(project: string) {
  const db = admin();
  const email = uniqueEmail("r3-owner", project);
  const { data } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { intent: "business" } });
  const ownerId = data.user?.id ?? "";
  const slug = uniqueSlug("r3", project);
  const biz = (await db.from("businesses").insert({ name: `Request Test Salon ${project}`, slug, timezone: TZ, created_by: ownerId }).select("id").single()).data;
  if (!biz) throw new Error("business insert failed");
  const member = (await db.from("business_members").insert({ business_id: biz.id, user_id: ownerId, role: "owner", display_name: "Olive" }).select("id").single()).data;
  const location = (await db.from("locations").insert({ business_id: biz.id, name: "Studio", timezone: TZ, suburb: "Carlton" }).select("id").single()).data;
  const days = [1, 2, 3, 4, 5, 6, 7];
  await db.from("location_hours").insert(days.map((weekday) => ({ business_id: biz.id, location_id: location?.id ?? "", weekday, opens: "08:00", closes: "18:00" })));
  await db.from("staff_hours").insert(days.map((weekday) => ({ business_id: biz.id, member_id: member?.id ?? "", location_id: location?.id ?? "", weekday, starts: "08:00", ends: "18:00" })));
  await db.from("services").insert({ business_id: biz.id, name: "Full groom", duration_minutes: 90, buffer_minutes: 15, base_price_cents: 9500, bookable_online: true });
  return { slug, email, ownerId, businessId: biz.id, cleanup: async () => { await db.from("businesses").delete().eq("id", biz.id); await db.auth.admin.deleteUser(ownerId); } };
}

/** Switch person: drop the session cookies (sign-out itself is covered by the foundation tests). */
async function signOut(page: Page) {
  await page.context().clearCookies();
}

test("a pet owner books through the marketplace and the salon confirms", async ({ page }, info) => {
  test.setTimeout(150_000);
  const s = await salon(info.project.name);
  const ownerEmail = uniqueEmail("r3-petowner", info.project.name);
  let petOwnerId = "";
  try {
    // The salon lists itself.
    await signIn(page, s.email, PASSWORD);
    await page.goto(`/b/${s.slug}/settings/listing`);
    const main = page.getByRole("main");
    await main.getByLabel("List my salon on Lyra Pet").check();
    await main.getByLabel("Headline").fill("Calm grooming in Carlton");
    await main.getByRole("button", { name: "Save listing" }).click();
    await expect(main.getByText("Listing saved.")).toBeVisible();
    await noSeriousViolations(page);
    await signOut(page);

    // A pet owner signs up (the default choice), confirms their email and lands in the portal.
    await page.goto("/signup");
    await page.getByLabel("Your name").fill("Sam Owner");
    await page.getByLabel("Email").fill(ownerEmail);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
    await page.goto(await emailLink(ownerEmail));
    await expect(page).toHaveURL(/\/me$/);
    petOwnerId = (await admin().auth.admin.listUsers({ perPage: 200 })).data.users.find((u) => u.email === ownerEmail)?.id ?? "";
    await expect(main.getByRole("heading", { name: "Welcome back, Sam!" })).toBeVisible();
    await expect(main.getByRole("heading", { name: "No pets yet" })).toBeVisible();
    await noSeriousViolations(page);

    // Adds a pet.
    await main.getByRole("link", { name: "Add your first pet" }).click();
    await main.getByLabel("Name").fill("Pippin");
    await main.getByLabel("Cat or dog?").selectOption("dog");
    await main.getByLabel("Breed").fill("Cavoodle");
    await main.getByLabel("Size").selectOption("small");
    await main.getByLabel("Health and handling notes").fill("Sensitive paws");
    await main.getByRole("button", { name: "Add pet" }).click();
    await expect(main.getByText(/Saved\. Salons you book with/)).toBeVisible();
    await noSeriousViolations(page);

    // Finds the salon and requests a groom.
    await page.goto("/me/salons");
    await main.getByRole("link", { name: `Request Test Salon ${info.project.name}` }).click();
    await expect(main.getByText("Calm grooming in Carlton")).toBeVisible();
    await main.getByRole("button", { name: /Save .* to favourites/ }).filter({ visible: true }).first().click();
    await expect(main.getByRole("button", { name: /Remove .* from favourites/ }).filter({ visible: true }).first()).toBeVisible();
    await noSeriousViolations(page);
    await main.getByRole("link", { name: "Request a groom" }).click();
    await expect(main.getByText(/Pet: Pippin/)).toBeVisible();
    await main.getByRole("button", { name: "Next" }).click();
    await expect(main.getByText("Choose at least one service.")).toBeVisible();
    await main.getByRole("checkbox", { name: /Full groom/ }).check();
    await main.getByRole("button", { name: "Next" }).click();
    await main.getByLabel("Date").fill(localDate(3));
    await main.getByLabel("Time").selectOption("10:00");
    await main.getByRole("button", { name: "Next" }).click();
    await main.getByLabel(/Anything the groomer should know/).fill("First visit");
    await main.getByRole("button", { name: "Next" }).click();
    await expect(main.getByRole("heading", { name: "Check your request" })).toBeVisible();
    await expect(main.getByText("$95.00").first()).toBeVisible();
    await noSeriousViolations(page);
    await main.getByRole("button", { name: "Send request" }).click();
    await expect(main.getByRole("heading", { name: "Your grooming request has been submitted!" })).toBeVisible();
    await expect(main.getByText("Your appointment is awaiting acceptance by the grooming team.")).toBeVisible();
    // Not an appointment yet.
    expect((await admin().from("appointments").select("id").eq("business_id", s.businessId)).data).toEqual([]);
    await noSeriousViolations(page);
    await signOut(page);

    // The front desk confirms with a groomer and the requested time.
    await signIn(page, s.email, PASSWORD);
    await page.goto(`/b/${s.slug}/requests`);
    await expect(main.getByRole("heading", { name: "Pippin" })).toBeVisible();
    await expect(main.getByText(/Sensitive paws/)).toBeVisible();
    await noSeriousViolations(page);
    await main.getByLabel("Groomer").selectOption({ label: "Olive" });
    await main.getByRole("button", { name: "Confirm appointment" }).click();
    const handled = main.getByRole("region", { name: "Recently handled" });
    await expect(handled.getByText("Confirmed")).toBeVisible();
    await expect(handled.getByRole("link", { name: "Open appointment" })).toBeVisible();
    expect((await admin().from("appointments").select("status, source").eq("business_id", s.businessId)).data).toEqual([{ status: "confirmed", source: "online" }]);
    await signOut(page);

    // The owner sees it confirmed.
    await signIn(page, ownerEmail, PASSWORD);
    await page.goto("/me/bookings");
    await expect(main.getByText(/Pippin · Request Test Salon/).first()).toBeVisible();
    await main.getByRole("link", { name: /Pippin · Request Test Salon/ }).first().click();
    await expect(main.getByText(/Good news! Pippin's appointment is confirmed/)).toBeVisible();
    await noSeriousViolations(page);
  } finally {
    await s.cleanup();
    if (petOwnerId) await admin().auth.admin.deleteUser(petOwnerId);
  }
});
