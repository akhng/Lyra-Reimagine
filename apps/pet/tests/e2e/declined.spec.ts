import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { admin, noSeriousViolations, signIn, uniqueEmail, uniqueSlug } from "./helpers";

/**
 * A salon declines a request while the pet owner has their home page open:
 * the notice appears live (no reload), the bell counts it, an email arrives
 * (the test email provider delivers to Mailpit), and opening the request
 * clears the notice.
 */
const PASSWORD = "a-strong-passphrase-42";
const TZ = "Australia/Melbourne";
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:55324";
const localDate = (days: number) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(Date.now() + days * 86_400_000));

async function emailTo(to: string): Promise<{ Subject: string; Text: string; HTML: string }> {
  for (let i = 0; i < 60; i++) {
    const search = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`).then((r) => r.json());
    const id: string | undefined = search.messages?.[0]?.ID;
    if (id) return fetch(`${MAILPIT}/api/v1/message/${id}`).then((r) => r.json());
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("no email arrived");
}

test("a declined request shows up live on the pet owner's home and by email", async ({ page, browser }, info) => {
  test.setTimeout(120_000);
  const db = admin();
  const project = info.project.name;
  const ownerEmail = uniqueEmail("dec-owner", project);
  const customerEmail = uniqueEmail("dec-customer", project);
  const owner = (await db.auth.admin.createUser({ email: ownerEmail, password: PASSWORD, email_confirm: true, user_metadata: { intent: "business" } })).data.user?.id ?? "";
  const customer = (await db.auth.admin.createUser({ email: customerEmail, password: PASSWORD, email_confirm: true, user_metadata: { full_name: "Sam Owner" } })).data.user?.id ?? "";
  const slug = uniqueSlug("dec", project);
  const salon = `Declining Salon ${project}`;
  const biz = (await db.from("businesses").insert({ name: salon, slug, timezone: TZ, created_by: owner }).select("id").single()).data?.id ?? "";
  try {
    await db.from("business_members").insert({ business_id: biz, user_id: owner, role: "owner", display_name: "Olive" });
    const location = (await db.from("locations").insert({ business_id: biz, name: "Studio", timezone: TZ }).select("id").single()).data?.id ?? "";
    await db.from("location_hours").insert([1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ business_id: biz, location_id: location, weekday, opens: "08:00", closes: "18:00" })));
    const service = (await db.from("services").insert({ business_id: biz, name: "Full groom", duration_minutes: 60, base_price_cents: 9000, bookable_online: true }).select("id").single()).data?.id ?? "";
    await db.from("marketplace_profiles").upsert({ business_id: biz, listed: true });
    const pet = (await db.from("owner_pets").insert({ user_id: customer, name: "Pippin", species: "dog", size: "small" }).select("id").single()).data?.id ?? "";

    // The pet owner sends a request (as themselves, through the same database function the app uses).
    const asCustomer = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "", { auth: { persistSession: false } });
    await asCustomer.auth.signInWithPassword({ email: customerEmail, password: PASSWORD });
    const sent = await asCustomer.rpc("submit_booking_request", { p_slug: slug, p_owner_pet: pet, p_service_ids: [service], p_preferred_start: null, p_windows: [{ date: localDate(3), part: "morning" }], p_notes: null });
    expect(sent.error).toBeNull();
    const requestId = sent.data as string;

    // The pet owner is on their home page, subscribed to live updates.
    await signIn(page, customerEmail, PASSWORD);
    const subscribed = page.waitForEvent("websocket").then((ws) =>
      ws.waitForEvent("framereceived", { predicate: (f) => typeof f.payload === "string" && f.payload.includes("phx_reply") && f.payload.includes("postgres_changes") && f.payload.includes('"ok"'), timeout: 20_000 }),
    );
    await page.goto("/me");
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { name: "Welcome back, Sam!" })).toBeVisible();
    await subscribed;
    await expect(main.getByRole("region", { name: "Booking update" })).toHaveCount(0);

    // Meanwhile the salon declines it, with a reason.
    const staff = await browser.newContext();
    const staffPage = await staff.newPage();
    await signIn(staffPage, ownerEmail, PASSWORD);
    await staffPage.goto(`/b/${slug}/requests`);
    const staffMain = staffPage.getByRole("main");
    await staffMain.getByRole("button", { name: "Decline", exact: true }).click();
    await staffMain.getByLabel("Reason for the customer (optional)").fill("Fully booked that week");
    await staffMain.getByRole("button", { name: "Decline request" }).click();
    await expect(staffMain.getByRole("region", { name: "Recently handled" }).getByText("Not accepted")).toBeVisible();
    await staff.close();

    // It appears on the pet owner's open page without a reload, and the bell counts it.
    const notice = main.getByRole("region", { name: "Booking update" });
    await expect(notice).toBeVisible({ timeout: 15_000 });
    await expect(notice).toContainText(`${salon} couldn't take Pippin's request`);
    await expect(page.getByRole("link", { name: "Notifications, 1 unread" })).toBeVisible();
    await noSeriousViolations(page);

    // The email arrives, with the reason and a link to the request.
    const email = await emailTo(customerEmail);
    expect(email.Subject).toBe(`${salon} couldn't take Pippin's grooming request`);
    expect(email.Text).toContain("Hi Sam,");
    expect(email.Text).toContain('Their message: "Fully booked that week"');
    expect(email.Text).toContain(`/me/requests/${requestId}`);
    expect((await db.from("email_outbox").select("status").eq("data->>requestId", requestId).single()).data?.status).toBe("sent");

    // Opening the request clears the notice.
    await notice.getByRole("link", { name: "See request" }).click();
    await expect(main.getByText(`${salon} couldn't take this request: Fully booked that week.`)).toBeVisible();
    await page.goto("/me");
    await expect(main.getByRole("heading", { name: "Welcome back, Sam!" })).toBeVisible();
    await expect(main.getByRole("region", { name: "Booking update" })).toHaveCount(0);
  } finally {
    await db.from("email_outbox").delete().eq("user_id", customer);
    await db.from("businesses").delete().eq("id", biz);
    await db.auth.admin.deleteUser(owner);
    await db.auth.admin.deleteUser(customer);
  }
});
