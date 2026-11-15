import { expect, test, type Page } from "@playwright/test";
import { admin, noSeriousViolations, signIn, uniqueEmail, uniqueSlug } from "./helpers";

/**
 * Phase 3: staff booking with free times, no double-booking, statuses and
 * the calendar; the public booking page, its private manage link (calendar
 * file, change, cancel); groomer limits. Each test creates its own business.
 */
const PASSWORD = "a-strong-passphrase-42";
const TZ = "Australia/Melbourne";
const localDate = (days: number) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(Date.now() + days * 86_400_000));

async function business(project: string) {
  const db = admin();
  const users = await Promise.all(
    ["owner", "groomer"].map(async (role) => {
      const email = uniqueEmail(`p3-${role}`, project);
      const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: role } });
      if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
      return { email, id: data.user.id };
    }),
  );
  const [owner, groomer] = users as [(typeof users)[number], (typeof users)[number]];
  const slug = uniqueSlug("p3", project);
  const biz = (await db.from("businesses").insert({ name: "Sudsy Paws", slug, timezone: TZ, created_by: owner.id, phone: "03 9000 0000" }).select("id").single()).data;
  if (!biz) throw new Error("business insert failed");
  const members = (await db.from("business_members").insert([{ business_id: biz.id, user_id: owner.id, role: "owner", display_name: "Olive Owner" }, { business_id: biz.id, user_id: groomer.id, role: "groomer", display_name: "Gus Groomer" }]).select("id, role")).data ?? [];
  const location = (await db.from("locations").insert({ business_id: biz.id, name: "Richmond studio", timezone: TZ, address_line: "1 Swan St", suburb: "Richmond" }).select("id").single()).data;
  if (!location) throw new Error("location insert failed");
  const days = [1, 2, 3, 4, 5, 6, 7];
  await db.from("location_hours").insert(days.map((weekday) => ({ business_id: biz.id, location_id: location.id, weekday, opens: "08:00", closes: "18:00" })));
  await db.from("staff_hours").insert(members.flatMap((m) => days.map((weekday) => ({ business_id: biz.id, member_id: m.id, location_id: location.id, weekday, starts: "08:00", ends: "18:00" }))));
  await db.from("booking_policies").insert({ business_id: biz.id, online_enabled: true, min_notice_minutes: 60, max_days_ahead: 30, slot_step_minutes: 30, cancellation_hours: 24, policy_text: "Please arrive 5 minutes early." });
  const service = (await db.from("services").insert({ business_id: biz.id, name: "Full groom", duration_minutes: 90, buffer_minutes: 15, base_price_cents: 9000, bookable_online: true }).select("id").single()).data;
  const customer = (await db.from("customers").insert({ business_id: biz.id, first_name: "Harriet", last_name: "Nguyen" }).select("id").single()).data;
  await db.from("customer_contacts").insert({ customer_id: customer?.id ?? "", business_id: biz.id, mobile: "0412 345 678" });
  const pet = (await db.from("pets").insert({ business_id: biz.id, customer_id: customer?.id ?? "", name: "Biscuit", size: "small" }).select("id").single()).data;
  return {
    slug, businessId: biz.id, owner, groomer, serviceId: service?.id ?? "", petId: pet?.id ?? "", customerId: customer?.id ?? "",
    ownerMember: members.find((m) => m.role === "owner")?.id ?? "", groomerMember: members.find((m) => m.role === "groomer")?.id ?? "", locationId: location.id,
    cleanup: async () => { await db.from("businesses").delete().eq("id", biz.id); await Promise.all(users.map((u) => db.auth.admin.deleteUser(u.id))); },
  };
}

async function login(page: Page, email: string) {
  await signIn(page, email, PASSWORD);
  await expect(page).not.toHaveURL(/\/login/);
}

test("staff book from free times, can't double-book, move it through the day and see it on the calendar", async ({ page }, info) => {
  test.setTimeout(120_000);
  const b = await business(info.project.name);
  try {
    await login(page, b.owner.email);
    const date = localDate(2);
    await page.goto(`/b/${b.slug}/appointments/new?customer=${b.customerId}&pet=${b.petId}&date=${date}`);
    const main = page.getByRole("main");
    await main.getByLabel("Full groom").check();
    await expect(main.getByText(/Estimate .*\$90\.00.*90 min/)).toBeVisible();
    await main.getByLabel("Groomer").selectOption({ label: "Olive Owner" });
    await main.getByRole("button", { name: "10:00", exact: true }).click();
    await expect(main.getByLabel("Start time")).toHaveValue("10:00");
    await noSeriousViolations(page);
    await main.getByRole("button", { name: "Book appointment" }).click();
    await expect(page).toHaveURL(/\/appointments\/[0-9a-f-]{36}/);
    await expect(main.getByRole("heading", { name: "Biscuit · Harriet Nguyen" })).toBeVisible();
    await expect(main.getByText(/10:00–11:30 with Olive Owner/)).toBeVisible();
    await noSeriousViolations(page);

    // The same groomer at an overlapping time is refused (database constraint); 10:00 isn't offered any more.
    await page.goto(`/b/${b.slug}/appointments/new?customer=${b.customerId}&pet=${b.petId}&date=${date}`);
    await main.getByLabel("Full groom").check();
    await main.getByLabel("Groomer").selectOption({ label: "Olive Owner" });
    await expect(main.getByRole("button", { name: "08:00", exact: true })).toBeVisible();
    await expect(main.getByRole("button", { name: "10:00", exact: true })).toHaveCount(0);
    await main.getByLabel("Start time").fill("10:30");
    await main.getByRole("button", { name: "Book appointment" }).click();
    await expect(main.getByText("That time clashes with another appointment for this groomer.")).toBeVisible();

    // Status changes.
    await page.goBack();
    await page.goto(`/b/${b.slug}/calendar?date=${date}`);
    await expect(main.getByRole("heading", { name: "Calendar" })).toBeVisible();
    await main.getByRole("link", { name: /Biscuit · Harriet Nguyen/ }).filter({ visible: true }).first().click();
    await main.getByRole("button", { name: "Mark confirmed" }).click();
    await expect(main.getByText("Confirmed", { exact: true }).first()).toBeVisible();
    await main.getByRole("button", { name: "Mark checked in" }).click();
    await expect(main.getByRole("button", { name: "Mark in progress" })).toBeVisible();

    // Reschedule with the form (keyboard-friendly alternative to dragging).
    await main.getByLabel("Start time").fill("13:00");
    await main.getByRole("button", { name: "Move appointment" }).click();
    await expect(main.getByText(/13:00–14:30 with Olive Owner/)).toBeVisible();

    // Calendar week view and the hours page.
    await page.goto(`/b/${b.slug}/calendar?date=${date}&view=week&groomer=${b.ownerMember}`);
    await expect(main.getByRole("link", { name: /Biscuit · Harriet Nguyen/ }).filter({ visible: true }).first()).toBeVisible();
    await noSeriousViolations(page);
    await page.goto(`/b/${b.slug}/settings/hours`);
    await expect(main.getByRole("heading", { name: "Hours & online booking" })).toBeVisible();
    await main.getByRole("checkbox", { name: "Sunday: Open" }).uncheck();
    await main.getByRole("button", { name: "Save opening hours" }).click();
    await expect(main.getByText("Opening hours saved.")).toBeVisible();
    await noSeriousViolations(page);
    expect((await admin().from("location_hours").select("weekday").eq("location_id", b.locationId)).data?.map((h) => h.weekday).sort()).toEqual([1, 2, 3, 4, 5, 6]);

    // Dashboard shows today's empty timeline and the week's count.
    await page.goto(`/b/${b.slug}`);
    await expect(main.getByRole("heading", { name: "Today" })).toBeVisible();
  } finally {
    await b.cleanup();
  }
});

test("a customer books online, adds it to their calendar, changes the time and cancels from the private link", async ({ page }, info) => {
  test.setTimeout(120_000);
  const b = await business(info.project.name);
  try {
    await page.goto(`/book/${b.slug}`);
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { name: "Sudsy Paws" })).toBeVisible();
    await main.getByRole("checkbox", { name: /Full groom/ }).check();
    // Two days out, so the booking stays outside the 24-hour change/cancel window whatever the time of day.
    const day = main.getByRole("group", { name: "Day" }).getByRole("button").nth(2);
    await day.click();
    await main.getByRole("group", { name: /^Times on/ }).getByRole("button").first().click();
    await main.getByLabel("First name").fill("Casey");
    await main.getByLabel("Last name").fill("Online");
    await main.getByLabel("Email").fill(`casey-${Date.now()}@example.test`);
    await main.getByLabel("Mobile").fill("0412 555 111");
    await main.getByLabel("Pet's name").fill("Pip");
    await main.getByLabel("Size").selectOption("medium");
    await noSeriousViolations(page);
    await main.getByRole("button", { name: "Book appointment" }).click();
    await expect(main.getByText("Please agree to the booking policy")).toBeVisible();
    await main.getByRole("checkbox", { name: /I agree to the booking policy/ }).check();
    // The form refuses submissions faster than a person could fill it.
    await page.waitForTimeout(4_000);
    await main.getByRole("button", { name: "Book appointment" }).click();
    await expect(page).toHaveURL(/\/book\/manage\/[0-9a-f]{48}\?booked=1$/);
    await expect(main.getByText(/You're booked!/)).toBeVisible();
    await expect(main.getByText("Pip")).toBeVisible();
    await noSeriousViolations(page);

    const cal = await page.request.get(`${page.url().split("?")[0]}/calendar`);
    expect(cal.status()).toBe(200);
    expect(cal.headers()["content-type"]).toContain("text/calendar");
    expect(await cal.text()).toContain("SUMMARY:Pip's groom at Sudsy Paws");

    const appt = (await admin().from("appointments").select("source, customer_id, starts_at").eq("business_id", b.businessId).single()).data;
    expect(appt?.source).toBe("online");

    await main.getByRole("button", { name: "Change time" }).click();
    await main.getByRole("group", { name: "Day" }).getByRole("button").nth(3).click();
    await main.getByRole("group", { name: /^Times on/ }).getByRole("button").first().click();
    await main.getByRole("button", { name: "Move to this time" }).click();
    await expect(main.getByText("Your appointment has been moved.")).toBeVisible();
    expect((await admin().from("appointments").select("starts_at").eq("business_id", b.businessId).single()).data?.starts_at).not.toBe(appt?.starts_at);

    await main.getByRole("button", { name: "Cancel booking" }).click();
    await main.getByRole("button", { name: "Yes, cancel it" }).click();
    await expect(main.getByText("Your appointment has been cancelled.")).toBeVisible();
    await expect(main.getByRole("heading", { name: "Cancelled booking" })).toBeVisible();
    expect((await admin().from("appointments").select("status, cancelled_by").eq("business_id", b.businessId).single()).data).toEqual({ status: "cancelled", cancelled_by: "customer" });

    // A salon with online booking off says so; an unknown salon is a 404.
    await admin().from("booking_policies").update({ online_enabled: false }).eq("business_id", b.businessId);
    await page.goto(`/book/${b.slug}`);
    await expect(main.getByRole("heading", { name: "Online booking isn't available" })).toBeVisible();
    expect((await page.goto("/book/no-such-salon-here"))?.status()).toBe(404);
  } finally {
    await b.cleanup();
  }
});

test("a groomer sees the calendar and moves their own appointment through the day, but can't book", async ({ page }, info) => {
  const b = await business(info.project.name);
  try {
    const start = new Date(Date.now() + 2 * 86_400_000);
    start.setUTCMinutes(0, 0, 0);
    const id = (await admin().from("appointments").insert({ business_id: b.businessId, location_id: b.locationId, customer_id: b.customerId, pet_id: b.petId, groomer_id: b.groomerMember, starts_at: start.toISOString(), service_ends_at: new Date(start.getTime() + 3_600_000).toISOString(), ends_at: new Date(start.getTime() + 3_600_000).toISOString() }).select("id").single()).data?.id;
    await login(page, b.groomer.email);
    await page.goto(`/b/${b.slug}/calendar`);
    const main = page.getByRole("main");
    await expect(main.getByRole("link", { name: "New appointment" })).toHaveCount(0);
    await page.goto(`/b/${b.slug}/appointments/${id}`);
    await expect(main.getByRole("button", { name: "Mark confirmed" })).toHaveCount(0);
    await main.getByRole("button", { name: "Mark checked in" }).click();
    await expect(main.getByRole("button", { name: "Mark in progress" })).toBeVisible();
    await expect(main.getByRole("heading", { name: "Reschedule" })).toHaveCount(0);
    await noSeriousViolations(page);
  } finally {
    await b.cleanup();
  }
});
