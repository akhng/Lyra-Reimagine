import { expect, test } from "@playwright/test";
import { admin, noSeriousViolations, signIn, uniqueEmail, uniqueSlug } from "./helpers";

/**
 * Payments (ADR 0004) with the test-only payment provider: the owner connects
 * Stripe; a pet owner pays in full when booking; the salon sees it paid and
 * the statement shows the 5% fee; declining refunds the customer.
 */
const PASSWORD = "a-strong-passphrase-42";
const TZ = "Australia/Melbourne";
const localDate = (days: number) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(Date.now() + days * 86_400_000));

test("a pet owner pays at booking; declining refunds them", async ({ page }, info) => {
  test.setTimeout(150_000);
  const db = admin();
  const project = info.project.name;
  const ownerEmail = uniqueEmail("pay-owner", project);
  const customerEmail = uniqueEmail("pay-customer", project);
  const owner = (await db.auth.admin.createUser({ email: ownerEmail, password: PASSWORD, email_confirm: true, user_metadata: { intent: "business" } })).data.user?.id ?? "";
  const customer = (await db.auth.admin.createUser({ email: customerEmail, password: PASSWORD, email_confirm: true, user_metadata: { display_name: "Pat" } })).data.user?.id ?? "";
  const slug = uniqueSlug("pay", project);
  const name = `Paid Test Salon ${project}`;
  const biz = (await db.from("businesses").insert({ name, slug, timezone: TZ, created_by: owner }).select("id").single()).data?.id ?? "";
  try {
    const member = (await db.from("business_members").insert({ business_id: biz, user_id: owner, role: "owner", display_name: "Olive" }).select("id").single()).data?.id ?? "";
    const location = (await db.from("locations").insert({ business_id: biz, name: "Studio", timezone: TZ, suburb: "Fitzroy" }).select("id").single()).data?.id ?? "";
    const days = [1, 2, 3, 4, 5, 6, 7];
    await db.from("location_hours").insert(days.map((weekday) => ({ business_id: biz, location_id: location, weekday, opens: "08:00", closes: "18:00" })));
    await db.from("staff_hours").insert(days.map((weekday) => ({ business_id: biz, member_id: member, location_id: location, weekday, starts: "08:00", ends: "18:00" })));
    await db.from("services").insert({ business_id: biz, name: "Full groom", duration_minutes: 90, base_price_cents: 9500, bookable_online: true });
    await db.from("marketplace_profiles").upsert({ business_id: biz, listed: true, headline: "Paid at booking" });
    const pet = (await db.from("owner_pets").insert({ user_id: customer, name: "Biscuit", species: "dog", size: "small" }).select("id").single()).data?.id ?? "";

    // The owner connects Stripe (the test provider returns straight from onboarding).
    await signIn(page, ownerEmail, PASSWORD);
    await page.goto(`/b/${slug}/settings/payments`);
    const main = page.getByRole("main");
    await expect(main.getByText("Not connected")).toBeVisible();
    await expect(main.getByText(/A service fee of 5% \(GST included\)/)).toBeVisible();
    await noSeriousViolations(page);
    await main.getByRole("button", { name: "Connect Stripe" }).click();
    await expect(main.getByText("Taking payments")).toBeVisible();
    await page.context().clearCookies();

    // The pet owner pays in full when sending the request.
    await signIn(page, customerEmail, PASSWORD);
    await page.goto(`/me/book?pet=${pet}&salon=${slug}`);
    await main.getByRole("checkbox", { name: /Full groom/ }).check();
    await main.getByRole("button", { name: "Next" }).click();
    await main.getByLabel("Date").fill(localDate(4));
    await main.getByLabel("Time").selectOption("10:00");
    await main.getByRole("button", { name: "Next" }).click();
    await main.getByRole("button", { name: "Next" }).click();
    await expect(main.getByText(/You'll pay \$95\.00 securely with Stripe now/)).toBeVisible();
    await noSeriousViolations(page);
    await main.getByRole("button", { name: "Pay $95.00 and send" }).click();
    await expect(page.getByRole("heading", { name: "Test checkout" })).toBeVisible();
    await page.getByRole("button", { name: "Pay (test)" }).click();
    await expect(main.getByRole("heading", { name: "Your grooming request has been submitted!" })).toBeVisible();
    await expect(main.getByText("Paid $95.00")).toBeVisible();
    await noSeriousViolations(page);
    const paid = (await db.from("payments").select("status, amount_cents, fee_cents").eq("business_id", biz)).data;
    expect(paid).toEqual([{ status: "paid", amount_cents: 9500, fee_cents: 475 }]);
    await page.context().clearCookies();

    // The salon sees it paid and the fee on this month's statement.
    await signIn(page, ownerEmail, PASSWORD);
    await page.goto(`/b/${slug}/settings/payments`);
    await expect(main.getByText("$4.75").first()).toBeVisible();
    await expect(main.getByText("Includes GST of")).toBeVisible();
    await expect(main.getByText("$0.43")).toBeVisible();
    await noSeriousViolations(page);
    await page.goto(`/b/${slug}/requests`);
    await expect(main.getByText("Paid $95.00")).toBeVisible();
    await main.getByRole("button", { name: "Decline", exact: true }).click();
    await main.getByRole("button", { name: "Decline request" }).click();
    await expect.poll(async () => (await db.from("payments").select("status").eq("business_id", biz).single()).data?.status).toBe("refunded");
  } finally {
    await db.from("businesses").delete().eq("id", biz);
    await db.auth.admin.deleteUser(owner);
    await db.auth.admin.deleteUser(customer);
  }
});
