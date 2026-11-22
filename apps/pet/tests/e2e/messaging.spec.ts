import { expect, test, type Page } from "@playwright/test";
import { admin, noSeriousViolations, signIn, uniqueEmail, uniqueSlug } from "./helpers";

/**
 * Private messages (ADR 0005): a pet owner messages a salon before booking;
 * contact details are hidden; the salon replies; a groomer with no booking
 * for that owner can't see it; blocking stops new messages.
 */
const PASSWORD = "a-strong-passphrase-42";
const TZ = "Australia/Melbourne";

async function switchTo(page: Page, email: string) {
  await page.context().clearCookies();
  await signIn(page, email, PASSWORD);
}

test("a pet owner and a salon chat privately before a booking", async ({ page }, info) => {
  test.setTimeout(150_000);
  const db = admin();
  const project = info.project.name;
  const ownerEmail = uniqueEmail("chat-salon", project);
  const customerEmail = uniqueEmail("chat-customer", project);
  const groomerEmail = uniqueEmail("chat-groomer", project);
  const owner = (await db.auth.admin.createUser({ email: ownerEmail, password: PASSWORD, email_confirm: true, user_metadata: { intent: "business" } })).data.user?.id ?? "";
  const customer = (await db.auth.admin.createUser({ email: customerEmail, password: PASSWORD, email_confirm: true, user_metadata: { full_name: "Priya Shah" } })).data.user?.id ?? "";
  const groomer = (await db.auth.admin.createUser({ email: groomerEmail, password: PASSWORD, email_confirm: true, user_metadata: { intent: "business" } })).data.user?.id ?? "";
  const slug = uniqueSlug("chat", project);
  const name = `Chatty Paws ${project}`;
  const biz = (await db.from("businesses").insert({ name, slug, timezone: TZ, created_by: owner }).select("id").single()).data?.id ?? "";
  try {
    await db.from("business_members").insert([
      { business_id: biz, user_id: owner, role: "owner", display_name: "Olive Owner" },
      { business_id: biz, user_id: groomer, role: "groomer", display_name: "Gus" },
    ]);
    await db.from("locations").insert({ business_id: biz, name: "Studio", timezone: TZ, suburb: "Brunswick" });
    await db.from("marketplace_profiles").upsert({ business_id: biz, listed: true, headline: "Happy to chat" });

    // The pet owner messages the salon from its page, with no booking.
    await signIn(page, customerEmail, PASSWORD);
    await page.goto(`/me/salons/${slug}`);
    const main = page.getByRole("main");
    await main.getByRole("button", { name: `Message ${name}` }).click();
    await expect(page).toHaveURL(/\/me\/messages\/[0-9a-f-]+$/);
    await expect(main.getByText(/Your messages are seen by .*'s team/)).toBeVisible();
    await expect(main.getByText(/hidden until you've paid for a booking/)).toBeVisible();
    await noSeriousViolations(page);
    await main.getByLabel("Message", { exact: true }).fill("Hi! Do you groom anxious cavoodles? My number is 0412 345 678");
    await main.getByRole("button", { name: "Send message" }).click();
    await expect(main.getByText("Hi! Do you groom anxious cavoodles? My number is [number hidden]")).toBeVisible();
    await expect(main.getByText(/Contact details hidden until a booking is paid/)).toBeVisible();
    await noSeriousViolations(page);

    // The salon sees it under Messages (with an unread badge) and replies.
    await switchTo(page, ownerEmail);
    await page.goto(`/b/${slug}/messages`);
    await expect(main.getByRole("link", { name: /Priya/ })).toBeVisible();
    await expect(main.getByRole("link", { name: /Priya/ }).getByText("New")).toBeVisible();
    await noSeriousViolations(page);
    await main.getByRole("link", { name: /Priya/ }).click();
    await expect(main.getByRole("heading", { name: "Priya", exact: true })).toBeVisible();
    await expect(main.getByText(/No bookings yet/)).toBeVisible();
    await main.getByLabel("Message", { exact: true }).fill("We do! Gentle handling, quiet dryers. Want to book a meet and greet?");
    await main.getByRole("button", { name: "Send message" }).click();
    await expect(main.getByText(/Gentle handling, quiet dryers/)).toBeVisible();
    await noSeriousViolations(page);

    // A groomer without a booking for this owner doesn't see the conversation.
    await switchTo(page, groomerEmail);
    await page.goto(`/b/${slug}/messages`);
    await expect(main.getByRole("heading", { name: "No messages yet" })).toBeVisible();

    // The pet owner sees the reply (the conversation is marked new), then blocks.
    await switchTo(page, customerEmail);
    await page.goto("/me/messages");
    await expect(main.getByRole("link", { name: new RegExp(name) })).toBeVisible();
    await expect(main.getByText("New")).toBeVisible();
    await main.getByRole("link", { name: new RegExp(name) }).click();
    await expect(main.getByText(/Gentle handling, quiet dryers/)).toBeVisible();
    await expect(main.getByText(/Olive · /)).toBeVisible();
    await main.getByRole("button", { name: "Block" }).click();
    await expect(main.getByText("You blocked this conversation. Unblock it to send messages.")).toBeVisible();
    await expect(main.getByLabel("Message", { exact: true })).toHaveCount(0);
    await noSeriousViolations(page);
  } finally {
    await db.from("businesses").delete().eq("id", biz);
    for (const id of [owner, customer, groomer]) await db.auth.admin.deleteUser(id);
  }
});

test("new messages appear live, without reloading", async ({ page, browser }, info) => {
  test.setTimeout(120_000);
  const db = admin();
  const project = info.project.name;
  const ownerEmail = uniqueEmail("live-salon", project);
  const customerEmail = uniqueEmail("live-customer", project);
  const owner = (await db.auth.admin.createUser({ email: ownerEmail, password: PASSWORD, email_confirm: true, user_metadata: { intent: "business" } })).data.user?.id ?? "";
  const customer = (await db.auth.admin.createUser({ email: customerEmail, password: PASSWORD, email_confirm: true, user_metadata: { full_name: "Lee Live" } })).data.user?.id ?? "";
  const slug = uniqueSlug("live", project);
  const biz = (await db.from("businesses").insert({ name: `Live Paws ${project}`, slug, timezone: TZ, created_by: owner }).select("id").single()).data?.id ?? "";
  const other = await browser.newContext();
  try {
    await db.from("business_members").insert({ business_id: biz, user_id: owner, role: "owner", display_name: "Olive" });
    await db.from("marketplace_profiles").upsert({ business_id: biz, listed: true });
    // The customer opens the conversation and says hello.
    const customerPage = await other.newPage();
    await signIn(customerPage, customerEmail, PASSWORD);
    await customerPage.goto(`/me/salons/${slug}`);
    await customerPage.getByRole("main").getByRole("button", { name: /^Message / }).click();
    await expect(customerPage).toHaveURL(/\/me\/messages\//);
    const id = customerPage.url().split("/").pop() ?? "";
    await customerPage.getByRole("main").getByLabel("Message", { exact: true }).fill("Hello!");
    await customerPage.getByRole("button", { name: "Send message" }).click();
    await expect(customerPage.getByText("Hello!", { exact: true })).toBeVisible();

    // The salon has the conversation open; the next message arrives without a reload.
    await signIn(page, ownerEmail, PASSWORD);
    await page.goto(`/b/${slug}/messages/${id}`);
    await expect(page.getByText("Hello!", { exact: true })).toBeVisible();
    await page.waitForTimeout(1500); // let the live subscription connect
    await customerPage.getByRole("main").getByLabel("Message", { exact: true }).fill("Are you open on Sunday?");
    await customerPage.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText("Are you open on Sunday?")).toBeVisible({ timeout: 10_000 });
  } finally {
    await other.close();
    await db.from("businesses").delete().eq("id", biz);
    for (const id of [owner, customer]) await db.auth.admin.deleteUser(id);
  }
});
