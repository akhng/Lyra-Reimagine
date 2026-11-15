import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { admin, noSeriousViolations, signIn, uniqueEmail, uniqueSlug } from "./helpers";

/**
 * Transformation R4 across three roles: the owner opens requests to groomers;
 * two groomers see the same request; one accepts, the other is told it's no
 * longer available; the pet owner and the owner are notified.
 */
const PASSWORD = "a-strong-passphrase-42";
const TZ = "Australia/Melbourne";

function melbourneTomorrow(hhmm: string): string {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(Date.now() + 2 * 86_400_000));
  const guess = Date.parse(`${date}T${hhmm}:00Z`);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
  return new Date(guess - (Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00Z`) - guess)).toISOString();
}

async function setup(project: string) {
  const db = admin();
  const user = async (prefix: string, meta: Record<string, string> = {}) => {
    const email = uniqueEmail(prefix, project);
    const { data } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: prefix, ...meta } });
    return { email, id: data.user?.id ?? "" };
  };
  const owner = await user("r4-owner", { intent: "business" });
  const alex = await user("r4-alex");
  const bea = await user("r4-bea");
  const petOwner = await user("r4-sam");
  const slug = uniqueSlug("r4", project);
  const biz = (await db.from("businesses").insert({ name: `Shift Test Salon ${project}`, slug, timezone: TZ, created_by: owner.id }).select("id").single()).data;
  if (!biz) throw new Error("business insert failed");
  const members = (await db.from("business_members").insert([
    { business_id: biz.id, user_id: owner.id, role: "owner", display_name: "Olive" },
    { business_id: biz.id, user_id: alex.id, role: "groomer", display_name: "Alex" },
    { business_id: biz.id, user_id: bea.id, role: "groomer", display_name: "Bea" },
  ]).select("id, role, display_name")).data ?? [];
  const location = (await db.from("locations").insert({ business_id: biz.id, name: "Studio", timezone: TZ }).select("id").single()).data;
  const days = [1, 2, 3, 4, 5, 6, 7];
  await db.from("location_hours").insert(days.map((weekday) => ({ business_id: biz.id, location_id: location?.id ?? "", weekday, opens: "08:00", closes: "18:00" })));
  await db.from("staff_hours").insert(members.filter((m) => m.role === "groomer").flatMap((m) => days.map((weekday) => ({ business_id: biz.id, member_id: m.id, location_id: location?.id ?? "", weekday, starts: "08:00", ends: "18:00" }))));
  await db.from("booking_policies").insert({ business_id: biz.id });
  const service = (await db.from("services").insert({ business_id: biz.id, name: "Bath and blow dry", duration_minutes: 60, base_price_cents: 6500, bookable_online: true }).select("id").single()).data;
  await db.from("marketplace_profiles").insert({ business_id: biz.id, listed: true });
  // The pet owner's request, made with their own session (the booking journey is covered by the R3 test).
  const sam = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "", { auth: { persistSession: false } });
  await sam.auth.signInWithPassword({ email: petOwner.email, password: PASSWORD });
  const pet = (await sam.from("owner_pets").insert({ user_id: petOwner.id, name: "Biscuit", species: "dog", breed: "Golden Retriever", size: "large" }).select("id").single()).data;
  const submit = () => sam.rpc("submit_booking_request", { p_slug: slug, p_owner_pet: pet?.id ?? "", p_service_ids: [service?.id ?? ""], p_preferred_start: melbourneTomorrow("11:00"), p_windows: [], p_notes: "Loves belly rubs" });
  return {
    slug, businessId: biz.id, owner, alex, bea, petOwner, submit,
    cleanup: async () => {
      await db.from("businesses").delete().eq("id", biz.id);
      for (const u of [owner, alex, bea, petOwner]) await db.auth.admin.deleteUser(u.id);
    },
  };
}

const login = async (page: Page, email: string) => {
  await signIn(page, email, PASSWORD);
  await expect(page).not.toHaveURL(/\/login/);
};

test("requests open to groomers: one accepts, the other is told, everyone is notified", async ({ page, browser }, info) => {
  test.setTimeout(150_000);
  const s = await setup(info.project.name);
  const beaContext = await browser.newContext({ viewport: page.viewportSize() ?? undefined });
  const bea = await beaContext.newPage();
  try {
    // The owner switches allocation to "Open to groomers".
    await login(page, s.owner.email);
    await page.goto(`/b/${s.slug}/settings/allocation`);
    const main = page.getByRole("main");
    await main.getByRole("radio", { name: /Open to groomers/ }).check();
    await main.getByLabel("Groomer commission (%)").fill("40");
    await main.getByRole("button", { name: "Save allocation settings" }).click();
    await expect(main.getByText("Allocation settings saved.")).toBeVisible();
    await noSeriousViolations(page);

    const submitted = await s.submit();
    expect(submitted.error).toBeNull();
    expect((await admin().from("booking_policies").select("allocation_mode").eq("business_id", s.businessId).single()).data?.allocation_mode).toBe("open");
    expect((await admin().from("booking_requests").select("status").eq("business_id", s.businessId).single()).data?.status).toBe("open");

    // Both groomers see it on the shift board.
    await page.context().clearCookies();
    await login(page, s.alex.email);
    await page.goto(`/b/${s.slug}/shifts`);
    await expect(main.getByRole("heading", { name: /Biscuit/ })).toBeVisible();
    await expect(main.getByText("You earn ~$26.00")).toBeVisible();
    await expect(main.getByText(/Loves belly rubs/)).toBeVisible();
    await noSeriousViolations(page);
    await login(bea, s.bea.email);
    await bea.goto(`/b/${s.slug}/shifts`);
    await expect(bea.getByRole("main").getByRole("heading", { name: /Biscuit/ })).toBeVisible();

    // Alex accepts first; Bea's stale card then can't.
    await main.getByRole("button", { name: "Accept appointment" }).click();
    await expect(main.getByText("It's yours! Added to your calendar.")).toBeVisible();
    await bea.getByRole("main").getByRole("button", { name: "Accept appointment" }).click();
    await expect(bea.getByRole("main").getByText(/no longer available/)).toBeVisible();
    const req = (await admin().from("booking_requests").select("status, appointment_id").eq("business_id", s.businessId).single()).data;
    expect(req?.status).toBe("confirmed");
    expect((await admin().from("appointments").select("id", { count: "exact", head: true }).eq("business_id", s.businessId)).count).toBe(1);
    await page.reload();
    await expect(main.getByRole("heading", { name: "No open requests right now" })).toBeVisible();

    // The owner is told who accepted.
    await page.context().clearCookies();
    await login(page, s.owner.email);
    await page.goto(`/b/${s.slug}/notifications`);
    await expect(main.getByText("Alex accepted Biscuit")).toBeVisible();
    await noSeriousViolations(page);

    // The pet owner gets the good news.
    await page.context().clearCookies();
    await login(page, s.petOwner.email);
    await page.goto("/me");
    await expect(page.getByRole("link", { name: /Notifications, 1 unread/ })).toBeVisible();
    await page.getByRole("link", { name: /Notifications, 1 unread/ }).click();
    await expect(main.getByText("Good news! Biscuit's grooming appointment has been accepted by Alex.")).toBeVisible();
    await noSeriousViolations(page);
    await main.getByRole("button", { name: "Mark 1 as read" }).click();
    await expect(page.getByRole("link", { name: "Notifications", exact: true })).toBeVisible();
  } finally {
    await beaContext.close();
    await s.cleanup();
  }
});
