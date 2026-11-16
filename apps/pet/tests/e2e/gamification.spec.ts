import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { admin, noSeriousViolations, signIn, uniqueEmail, uniqueSlug } from "./helpers";

/**
 * Transformation R5, the whole loop across roles: the owner sets loyalty
 * rules and a reward; a request is accepted by a groomer, who completes the
 * groom; the pet owner gets points, a first-groom badge and reviews it; the
 * owner replies and redeems the reward; the month view shows the groom.
 */
const PASSWORD = "a-strong-passphrase-42";
const TZ = "Australia/Melbourne";

function melbourne(days: number, hhmm: string): string {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(Date.now() + days * 86_400_000));
  const guess = Date.parse(`${date}T${hhmm}:00Z`);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
  return new Date(guess - (Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00Z`) - guess)).toISOString();
}

async function setup(project: string) {
  const db = admin();
  const user = async (prefix: string) => {
    const email = uniqueEmail(prefix, project);
    const { data } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: prefix } });
    return { email, id: data.user?.id ?? "" };
  };
  const owner = await user("r5-owner");
  const alex = await user("r5-alex");
  const sam = await user("r5-sam");
  const slug = uniqueSlug("r5", project);
  const biz = (await db.from("businesses").insert({ name: `Reward Test Salon ${project}`, slug, timezone: TZ, created_by: owner.id }).select("id").single()).data;
  if (!biz) throw new Error("business insert failed");
  const members = (await db.from("business_members").insert([{ business_id: biz.id, user_id: owner.id, role: "owner", display_name: "Olive" }, { business_id: biz.id, user_id: alex.id, role: "groomer", display_name: "Alex" }]).select("id, role")).data ?? [];
  const location = (await db.from("locations").insert({ business_id: biz.id, name: "Studio", timezone: TZ }).select("id").single()).data;
  const days = [1, 2, 3, 4, 5, 6, 7];
  await db.from("location_hours").insert(days.map((weekday) => ({ business_id: biz.id, location_id: location?.id ?? "", weekday, opens: "07:00", closes: "20:00" })));
  await db.from("staff_hours").insert(members.filter((m) => m.role === "groomer").flatMap((m) => days.map((weekday) => ({ business_id: biz.id, member_id: m.id, location_id: location?.id ?? "", weekday, starts: "07:00", ends: "20:00" }))));
  await db.from("booking_policies").insert({ business_id: biz.id, allocation_mode: "open" });
  const service = (await db.from("services").insert({ business_id: biz.id, name: "Full groom", duration_minutes: 60, base_price_cents: 9500, bookable_online: true }).select("id").single()).data;
  await db.from("marketplace_profiles").insert({ business_id: biz.id, listed: true });
  const samDb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "", { auth: { persistSession: false } });
  await samDb.auth.signInWithPassword({ email: sam.email, password: PASSWORD });
  const pet = (await samDb.from("owner_pets").insert({ user_id: sam.id, name: "Mochi", species: "cat", breed: "Persian", size: "small" }).select("id").single()).data;
  return {
    slug, businessId: biz.id, owner, alex, sam,
    request: () => samDb.rpc("submit_booking_request", { p_slug: slug, p_owner_pet: pet?.id ?? "", p_service_ids: [service?.id ?? ""], p_preferred_start: melbourne(1, "09:00"), p_windows: [], p_notes: "" }),
    cleanup: async () => {
      await db.from("businesses").delete().eq("id", biz.id);
      for (const u of [owner, alex, sam]) await db.auth.admin.deleteUser(u.id);
    },
  };
}
const login = async (page: Page, email: string) => {
  await page.context().clearCookies();
  await signIn(page, email, PASSWORD);
  await expect(page).not.toHaveURL(/\/login/);
};

test("points, badges, reviews and rewards from one completed groom", async ({ page }, info) => {
  test.setTimeout(180_000);
  const s = await setup(info.project.name);
  try {
    const main = page.getByRole("main");
    // The owner sets the rules and adds a reward.
    await login(page, s.owner.email);
    await page.goto(`/b/${s.slug}/settings/loyalty`);
    await main.getByLabel("Points per completed appointment").fill("10");
    await main.getByLabel("Points per $1 of the price").fill("1");
    await main.getByRole("button", { name: "Save loyalty rules" }).click();
    await expect(main.getByText("Loyalty rules saved.")).toBeVisible();
    await main.getByLabel("Reward").fill("Free nail trim");
    await main.getByLabel("Points needed").fill("100");
    await main.getByRole("button", { name: "Add reward" }).click();
    await expect(main.getByText("Free nail trim")).toBeVisible();
    await noSeriousViolations(page);

    // A request goes to the shift board; Alex accepts, then grooms Mochi.
    expect((await s.request()).error).toBeNull();
    await login(page, s.alex.email);
    await page.goto(`/b/${s.slug}/shifts`);
    await main.getByRole("button", { name: "Accept appointment" }).click();
    await expect(main.getByText("It's yours! Added to your calendar.")).toBeVisible();
    const apptId = (await admin().from("booking_requests").select("appointment_id").eq("business_id", s.businessId).single()).data?.appointment_id ?? "";
    // Bring the groom to now, so it can be completed today.
    await admin().from("appointments").update({ starts_at: new Date(Date.now() - 2 * 3_600_000).toISOString(), service_ends_at: new Date(Date.now() - 3_600_000).toISOString(), ends_at: new Date(Date.now() - 3_600_000).toISOString() }).eq("id", apptId);
    await page.goto(`/b/${s.slug}/appointments/${apptId}`);
    await main.getByRole("button", { name: "Mark checked in" }).click();
    await main.getByRole("button", { name: "Mark in progress" }).click();
    await main.getByRole("button", { name: "Mark completed" }).click();
    await expect(main.getByText("Completed", { exact: true }).first()).toBeVisible();

    // The pet owner sees points, a badge and the review form.
    await login(page, s.sam.email);
    await page.goto("/me/notifications");
    await expect(main.getByText("+105 loyalty points!")).toBeVisible();
    await expect(main.getByText("Mochi's first groom!")).toBeVisible();
    await expect(main.getByText("Woof! Mochi is ready for collection!")).toBeVisible();
    await page.goto("/me/rewards");
    await expect(main.getByText("105", { exact: true })).toBeVisible();
    await expect(main.getByText("Fresh & Fluffy")).toBeVisible();
    await expect(main.getByText("Ready to use")).toBeVisible();
    await expect(main.getByText("Mochi: First groom!")).toBeVisible();
    await noSeriousViolations(page);
    await page.goto("/me/bookings");
    await main.getByRole("region", { name: "Grooming history" }).getByRole("link", { name: /Mochi · Full groom/ }).click();
    await expect(main.getByText(/Woof! Mochi is all done/)).toBeVisible();
    await main.getByRole("radio", { name: "5 stars" }).click();
    await main.getByLabel("Comments (optional)").fill("Mochi looks like a cloud!");
    await main.getByRole("button", { name: "Send review" }).click();
    await expect(main.getByText("Thank you! Your review helps other pet owners.")).toBeVisible();
    await noSeriousViolations(page);

    // The owner reads and replies, redeems the reward, and sees the month view.
    await login(page, s.owner.email);
    await page.goto(`/b/${s.slug}/reviews`);
    await expect(main.getByText("Mochi looks like a cloud!")).toBeVisible();
    await main.getByLabel("Reply (optional)").fill("Thank you, see you next time!");
    await main.getByRole("button", { name: "Reply" }).click();
    await expect(main.getByText("Reply saved.")).toBeVisible();
    await noSeriousViolations(page);
    const customerId = (await admin().from("booking_requests").select("customer_id").eq("business_id", s.businessId).single()).data?.customer_id ?? "";
    await page.goto(`/b/${s.slug}/customers/${customerId}`);
    await expect(main.getByRole("heading", { name: "Loyalty points" })).toBeVisible();
    await main.getByRole("button", { name: "Redeem" }).click();
    await expect(main.getByText("Redeemed Free nail trim. 5 points left.")).toBeVisible();
    await page.goto(`/b/${s.slug}/calendar?view=month`);
    await expect(main.getByRole("link", { name: /: 1 appointment$/ })).toBeVisible();
    await noSeriousViolations(page);
    await page.goto(`/b/${s.slug}`);
    await expect(main.getByRole("link", { name: "Customer reviews", exact: true })).toBeVisible();
    await expect(main.getByText("average from 1 review")).toBeVisible();
  } finally {
    await s.cleanup();
  }
});
