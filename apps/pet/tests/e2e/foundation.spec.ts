import { expect, test } from "@playwright/test";
import { admin, emailLink, navigate, noSeriousViolations, signIn, uniqueEmail, uniqueSlug } from "./helpers";

/** Phase 1 (brief Tests 1, 2 partial, 15, 16 partial): register → confirm → create business → settings; isolation and roles. */

test("a new groomer signs up, confirms their email, creates a business and fills in its details", async ({ page }, info) => {
  const email = uniqueEmail("owner", info.project.name);
  const slug = uniqueSlug("paws", info.project.name);
  let userId: string | undefined;
  try {
    await page.goto("/");
    await noSeriousViolations(page);
    await page.getByRole("link", { name: "Start your free trial" }).click();
    await page.getByLabel("Your name").fill("Pat Groomer");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("a-strong-passphrase-42");
    await noSeriousViolations(page);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

    await page.goto(await emailLink(email));
    await expect(page).toHaveURL(/\/onboarding$/);
    await page.getByLabel("Business name").fill("Pat's Paw Spa");
    await expect(page.getByLabel("Booking link")).toHaveValue("pat-s-paw-spa");
    await page.getByLabel("Booking link").fill(slug);
    await page.getByLabel("Time zone").selectOption("Australia/Brisbane");
    await page.getByLabel("First location").fill("Paddington studio");
    await noSeriousViolations(page);
    await page.getByRole("button", { name: "Create business" }).click();

    await expect(page).toHaveURL(new RegExp(`/b/${slug}$`));
    const main = page.getByRole("main");
    await expect(main.getByText("Pat's Paw Spa")).toBeVisible();
    await expect(main.getByRole("link", { name: /Add your ABN/ })).toBeVisible();
    await noSeriousViolations(page);

    await navigate(page, "Settings");
    await expect(page).toHaveURL(new RegExp(`/b/${slug}/settings$`));
    await main.getByLabel("ABN").fill("51 824 753 556");
    await main.getByLabel("Registered for GST").check();
    await main.getByRole("button", { name: "Save details" }).click();
    await expect(main.getByRole("status").filter({ hasText: "Details saved." })).toBeVisible();
    await main.getByText("Add a location").click();
    await main.locator("#new-name").fill("Mobile van");
    await main.locator("#new-postcode").fill("4064");
    await main.getByLabel("Mobile grooming (we travel to customers)").last().check();
    await main.getByRole("button", { name: "Add location" }).click();
    await expect(main.getByRole("status").filter({ hasText: "Location saved." })).toBeVisible();
    await noSeriousViolations(page);

    const { data: biz } = await admin().from("businesses").select("id, abn, gst_registered, timezone, created_by").eq("slug", slug).single();
    userId = biz?.created_by ?? undefined;
    expect(biz).toMatchObject({ abn: "51824753556", gst_registered: true, timezone: "Australia/Brisbane" });
    const { data: locs } = await admin().from("locations").select("name, is_mobile, postcode").eq("business_id", biz!.id).order("created_at");
    expect(locs).toEqual([{ name: "Paddington studio", is_mobile: false, postcode: null }, { name: "Mobile van", is_mobile: true, postcode: "4064" }]);

    await page.goto(`/b/${slug}`);
    await expect(main.getByRole("link", { name: /Add your ABN/ }).getByLabel("Done")).toBeVisible();
  } finally {
    if (userId) {
      await admin().from("businesses").delete().eq("slug", slug);
      await admin().auth.admin.deleteUser(userId);
    }
  }
});

test("another business's pages are not found, even when you know the link", async ({ page }) => {
  await signIn(page, "ned@example.test", "password-123");
  await expect(page).toHaveURL(/\/b\/neat-coat-test$/);
  for (const path of ["/b/paws-test", "/b/paws-test/settings"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(404);
    await expect(page.getByText("Paws Test Salon")).toHaveCount(0);
  }
});

test("a groomer sees settings read-only and anonymous visitors are sent to sign in", async ({ page }, info) => {
  const email = uniqueEmail("groomer", info.project.name);
  const { data } = await admin().auth.admin.createUser({ email, password: "a-strong-passphrase-42", email_confirm: true, user_metadata: { full_name: "Gia Groomer" } });
  const id = data.user!.id; // fresh unique email
  try {
    await admin().from("business_members").insert({ business_id: "a0000000-0000-4000-8000-000000000001", user_id: id, role: "groomer", display_name: "Gia Groomer" });
    await page.goto("/b/paws-test/settings");
    await expect(page).toHaveURL(/\/login\?next=%2Fb%2Fpaws-test%2Fsettings$/);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("a-strong-passphrase-42");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/b\/paws-test\/settings$/);
    const main = page.getByRole("main");
    await expect(main.getByText("Only owners and managers can change these details.")).toBeVisible();
    await expect(main.getByLabel("Business name")).toBeDisabled();
    await expect(main.getByRole("button", { name: "Add location" })).toHaveCount(0);
    await expect(main.getByText("Gia Groomer")).toBeVisible();
    await noSeriousViolations(page);
  } finally {
    await admin().auth.admin.deleteUser(id);
  }
});
