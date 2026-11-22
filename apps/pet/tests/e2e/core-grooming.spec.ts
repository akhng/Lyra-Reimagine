import { expect, test, type Page } from "@playwright/test";
import { admin, navigate, noSeriousViolations, signIn, uniqueEmail, uniqueSlug } from "./helpers";

/** Phase 2 (brief Tests 3–6, 16): customers, pets, services and pricing, grooming records with photos, search, groomer privacy. */

const PASSWORD = "a-strong-passphrase-42";
// A valid 1×1 PNG, enough for the upload path and <img>.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const photo = (name: string) => ({ name, mimeType: "image/png", buffer: PNG });

/** A fresh business with an owner and a groomer (created directly, as onboarding is covered by the Phase 1 spec). */
async function business(project: string) {
  const db = admin();
  const users = await Promise.all(
    ["owner", "groomer"].map(async (role) => {
      const email = uniqueEmail(`p2-${role}`, project);
      const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: role } });
      if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
      return { email, id: data.user.id, role };
    }),
  );
  const [owner, groomer] = users as [(typeof users)[number], (typeof users)[number]];
  const slug = uniqueSlug("p2", project);
  const { data: biz, error } = await db.from("businesses").insert({ name: "Fluff & Fold", slug, timezone: "Australia/Melbourne", created_by: owner.id }).select("id").single();
  if (error || !biz) throw new Error(`business insert failed: ${error?.message}`);
  const { error: me } = await db.from("business_members").insert([
    { business_id: biz.id, user_id: owner.id, role: "owner", display_name: "Olive Owner" },
    { business_id: biz.id, user_id: groomer.id, role: "groomer", display_name: "Gus Groomer" },
  ]);
  if (me) throw new Error(`members insert failed: ${me.message}`);
  return { slug, businessId: biz.id, owner, groomer, cleanup: async () => { await db.from("businesses").delete().eq("id", biz.id); await Promise.all(users.map((u) => db.auth.admin.deleteUser(u.id))); } };
}

async function login(page: Page, email: string, slug: string) {
  await signIn(page, email, PASSWORD);
  await page.goto(`/b/${slug}`);
  await expect(page.getByRole("main")).toBeVisible();
}

test("owner sets up a service, adds a customer with two pets, records a groom with photos, and finds them by search", async ({ page }, info) => {
  test.setTimeout(120_000);
  const b = await business(info.project.name);
  try {
    await login(page, b.owner.email, b.slug);
    const main = page.getByRole("main");
    await expect(main.getByRole("link", { name: "Customers & pets", exact: true })).toBeVisible();
    await noSeriousViolations(page);

    // Services & pricing: base price plus size prices and a matting surcharge.
    await navigate(page, "Services & pricing");
    await expect(main.getByRole("heading", { name: "No services yet" })).toBeVisible();
    await main.getByLabel("Service name").fill("Full groom");
    await main.getByLabel("Category").fill("Full groom");
    await main.getByLabel("Duration (minutes)").fill("90");
    await main.getByLabel("Base price (A$, incl. GST)").fill("85");
    await main.getByLabel("Small", { exact: true }).fill("75");
    await main.getByLabel("Large", { exact: true }).fill("120");
    await main.getByLabel("Matted coat").fill("25");
    await main.getByLabel("Price by breed (optional, beats size)").fill("Golden Retriever: 135");
    await noSeriousViolations(page);
    await main.getByRole("button", { name: "Add service" }).click();
    await expect(main.getByRole("status").filter({ hasText: "Service saved." })).toBeVisible();
    await expect(main.getByRole("link", { name: /Full groom/ })).toContainText("$75.00 – $120.00");
    // New services are bookable online unless the owner unticks it, so the salon can take requests straight away.
    const { data: svc } = await admin().from("services").select("bookable_online").eq("business_id", b.businessId).eq("name", "Full groom").single();
    expect(svc?.bookable_online).toBe(true);
    const { data: rules } = await admin().from("service_price_rules").select("kind, match_value, price_cents").eq("business_id", b.businessId).order("price_cents");
    expect(rules).toEqual([
      { kind: "coat_condition", match_value: "matted", price_cents: 2500 },
      { kind: "size", match_value: "small", price_cents: 7500 },
      { kind: "size", match_value: "large", price_cents: 12000 },
      { kind: "breed", match_value: "Golden Retriever", price_cents: 13500 },
    ]);

    // A bad amount is rejected with a field error.
    await main.getByLabel("Service name").fill("Nails");
    await main.getByLabel("Base price (A$, incl. GST)").fill("twenty");
    await main.getByRole("button", { name: "Add service" }).click();
    await expect(main.getByText("Enter a price in dollars, e.g. 85 or 85.50")).toBeVisible();

    // Customer with contact details.
    await navigate(page, "Customers");
    await expect(main.getByRole("heading", { name: "No customers yet" })).toBeVisible();
    await main.getByRole("link", { name: "Add customer" }).first().click();
    await main.getByLabel("First name").fill("Harriet");
    await main.getByLabel("Last name").fill("Nguyen");
    await main.getByLabel("Preferred groomer").selectOption({ label: "Gus Groomer" });
    await main.getByLabel("Mobile").fill("0412 345 678");
    await main.getByLabel("Email").fill("Harriet@Example.test");
    await main.getByLabel("Postcode").fill("30");
    await main.getByRole("button", { name: "Add customer" }).click();
    await expect(main.getByText("Postcodes have 4 digits")).toBeVisible();
    await main.getByLabel("Postcode").fill("3068");
    await main.getByLabel("Agrees to marketing messages").check();
    await noSeriousViolations(page);
    await main.getByRole("button", { name: "Add customer" }).click();
    await expect(main.getByRole("heading", { name: "Harriet Nguyen" })).toBeVisible();
    await expect(main.getByRole("link", { name: "0412 345 678" })).toBeVisible();
    await expect(main.getByText("harriet@example.test")).toBeVisible();
    await expect(main.getByText("Preferred groomer: Gus Groomer")).toBeVisible();

    // Two pets.
    for (const pet of [{ name: "Biscuit", breed: "Cavoodle", size: "Small" }, { name: "Maple", breed: "Golden Retriever", size: "Large" }]) {
      await main.getByRole("link", { name: "Add pet" }).click();
      await main.getByLabel("Name", { exact: true }).fill(pet.name);
      await main.getByLabel("Breed").fill(pet.breed);
      await main.getByLabel("Size").selectOption({ label: pet.size });
      await main.getByLabel("Groom every (weeks)").fill("6");
      if (pet.name === "Biscuit") {
        await main.getByLabel("Preferred cut").fill("Teddy bear face, 13mm body");
        await main.getByLabel("Allergies").fill("Oatmeal shampoo");
        await noSeriousViolations(page);
      }
      await main.getByRole("button", { name: "Add pet" }).click();
      await expect(main.getByRole("heading", { name: pet.name })).toBeVisible();
      await main.getByRole("link", { name: "Harriet Nguyen" }).click();
    }
    await expect(main.getByRole("link", { name: /Biscuit/ })).toBeVisible();
    await expect(main.getByRole("link", { name: /Maple/ })).toBeVisible();

    // Record a groom for Biscuit with before and after photos.
    await main.getByRole("link", { name: /Biscuit/ }).click();
    await expect(main.getByRole("heading", { name: "Care information" })).toBeVisible();
    await expect(main.getByText("Oatmeal shampoo")).toBeVisible();
    await expect(main.getByRole("heading", { name: "No grooms recorded yet" })).toBeVisible();
    await main.getByRole("link", { name: "Record a groom" }).first().click();
    await expect(main.getByLabel("Groomer", { exact: true })).toHaveValue(/.+/);
    await main.getByLabel("Full groom").check();
    await main.getByLabel("Time taken (minutes)").fill("80");
    await main.getByLabel("Haircut / blade").fill("13mm body, scissored legs");
    await main.getByLabel("Groomer observations").fill("Slight redness behind left ear");
    await main.getByLabel("Add before photos").setInputFiles(photo("before.png"));
    await main.getByLabel("Add after photos").setInputFiles(photo("after.png"));
    await expect(main.getByRole("img", { name: "Before photos 1" })).toBeVisible();
    await main.getByLabel("Add after photos").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("x") });
    await expect(main.getByText("notes.txt: use a JPEG, PNG or WebP photo.")).toBeVisible();
    await noSeriousViolations(page);
    await main.getByRole("button", { name: "Save grooming record" }).click();
    await expect(main.getByRole("status").filter({ hasText: "Grooming record saved." })).toBeVisible();
    await expect(main.getByRole("heading", { name: "Before and after" })).toBeVisible();
    await expect(main.getByRole("img", { name: /Biscuit: After/ })).toBeVisible();
    await expect(main.getByText("Full groom", { exact: true })).toBeVisible();
    await expect(main.getByText("Slight redness behind left ear")).toBeVisible();
    await expect(main.getByText(/Next groom due/)).toBeVisible();
    await noSeriousViolations(page);

    const { data: rec } = await admin().from("grooming_records").select("id, services_summary, duration_minutes, grooming_photos(kind, storage_path)").eq("business_id", b.businessId).single();
    expect(rec?.services_summary).toBe("Full groom");
    expect(rec?.grooming_photos.map((p) => p.kind).sort()).toEqual(["after", "before"]);
    expect(rec?.grooming_photos.every((p) => p.storage_path.startsWith(`${b.businessId}/grooming/${rec.id}/`))).toBe(true);

    // Grooming records page and search by pet name and mobile.
    await navigate(page, "Grooming records");
    await expect(page).toHaveURL(/\/grooming$/);
    await expect(main.getByRole("link", { name: /Biscuit/ })).toContainText("Full groom");
    await navigate(page, "Customers");
    await expect(page).toHaveURL(/\/customers$/);
    const search = main.getByRole("searchbox", { name: "Search customers" });
    await search.fill("maple");
    await search.press("Enter");
    await expect(main.getByRole("link", { name: /Harriet Nguyen/ })).toBeVisible();
    await search.fill("345678");
    await search.press("Enter");
    await expect(main.getByRole("link", { name: /Harriet Nguyen/ })).toBeVisible();
    await search.fill("zzz-nobody");
    await search.press("Enter");
    await expect(main.getByRole("heading", { name: "No matching customers" })).toBeVisible();

    // Dashboard counts real records.
    await navigate(page, "Dashboard");
    await expect(page).toHaveURL(new RegExp(`/b/${b.slug}$`));
    // The dashboard tiles count the real records: two pets for one customer, and one recorded groom.
    const customersTile = main.locator("li").filter({ has: page.getByRole("link", { name: "Customers & pets", exact: true }) });
    await expect(customersTile).toContainText("pets · 1 customers");
    await expect(customersTile.getByText("2", { exact: true }).first()).toBeVisible();
    await expect(main.getByRole("progressbar", { name: "History Keeper" })).toHaveAttribute("aria-valuenow", "1");
    await noSeriousViolations(page);
  } finally {
    await b.cleanup();
  }
});

test("a groomer sees pets and care notes but not customer contact details, and can record a groom", async ({ page }, info) => {
  const b = await business(info.project.name);
  try {
    const db = admin();
    const { data: c } = await db.from("customers").insert({ business_id: b.businessId, first_name: "Priya", last_name: "Shah" }).select("id").single();
    await db.from("customer_contacts").insert({ customer_id: c!.id, business_id: b.businessId, mobile: "0499 111 222", email: "priya@example.test" });
    const { data: pet } = await db.from("pets").insert({ business_id: b.businessId, customer_id: c!.id, name: "Pepper", breed: "Schnauzer", handling_precautions: "Nervous of the dryer" }).select("id").single();

    await login(page, b.groomer.email, b.slug);
    const main = page.getByRole("main");
    await navigate(page, "Customers");
    await expect(main.getByRole("link", { name: "Add customer" })).toHaveCount(0);
    const search = main.getByRole("searchbox", { name: "Search customers" });
    await search.fill("0499111");
    await search.press("Enter");
    await expect(main.getByRole("heading", { name: "No matching customers" })).toBeVisible();
    await search.fill("pepper");
    await search.press("Enter");
    await main.getByRole("link", { name: /Priya Shah/ }).click();
    await expect(main.getByText("Contact details are visible to owners, managers and reception.")).toBeVisible();
    await expect(main.getByText("0499 111 222")).toHaveCount(0);
    await expect(main.getByRole("link", { name: "Edit" })).toHaveCount(0);
    await noSeriousViolations(page);

    await page.goto(`/b/${b.slug}/customers/${c!.id}/edit`);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();

    await page.goto(`/b/${b.slug}/pets/${pet!.id}`);
    await expect(main.getByText("Nervous of the dryer")).toBeVisible();
    await main.getByRole("link", { name: "Record a groom" }).first().click();
    await expect(main.getByLabel("Groomer", { exact: true })).toHaveValue(/.+/);
    await expect(main.getByLabel("Groomer", { exact: true }).locator("option:checked")).toHaveText("Gus Groomer");
    await main.getByLabel("Customer feedback").fill("Very happy");
    await main.getByRole("button", { name: "Save grooming record" }).click();
    await expect(main.getByRole("status").filter({ hasText: "Grooming record saved." })).toBeVisible();
    await expect(main.getByText("Very happy")).toBeVisible();

    // Services are read-only for groomers.
    await navigate(page, "Services & pricing");
    await expect(main.getByRole("heading", { name: "Add a service" })).toHaveCount(0);
  } finally {
    await b.cleanup();
  }
});
