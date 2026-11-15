import { expect, test, type Page } from "@playwright/test";
import { admin, noSeriousViolations, signIn, uniqueEmail, uniqueSlug } from "./helpers";

/**
 * Transformation R2: the tile dashboard. Owners customise (hide, show, move,
 * widen, pin) and the layout is saved per person; groomers don't see money
 * or booking requests; every tile is a link.
 */
const PASSWORD = "a-strong-passphrase-42";

async function business(project: string) {
  const db = admin();
  const make = async (role: string) => {
    const email = uniqueEmail(`r2-${role}`, project);
    const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
    return { email, id: data.user.id };
  };
  const owner = await make("owner");
  const groomer = await make("groomer");
  const slug = uniqueSlug("r2", project);
  const biz = (await db.from("businesses").insert({ name: "Tile Test Grooming", slug, timezone: "Australia/Melbourne", created_by: owner.id }).select("id").single()).data;
  if (!biz) throw new Error("business insert failed");
  await db.from("business_members").insert([{ business_id: biz.id, user_id: owner.id, role: "owner", display_name: "Olive" }, { business_id: biz.id, user_id: groomer.id, role: "groomer", display_name: "Gus" }]);
  await db.from("locations").insert({ business_id: biz.id, name: "Studio", timezone: "Australia/Melbourne" });
  return { slug, businessId: biz.id, owner, groomer, cleanup: async () => { await db.from("businesses").delete().eq("id", biz.id); await db.auth.admin.deleteUser(owner.id); await db.auth.admin.deleteUser(groomer.id); } };
}

async function login(page: Page, email: string) {
  await signIn(page, email, PASSWORD);
  await expect(page).not.toHaveURL(/\/login/);
}
const tileTitles = (page: Page) => page.getByRole("main").locator("li h3").allTextContents();

test("owners customise their board and it stays that way", async ({ page }, info) => {
  test.setTimeout(90_000);
  const b = await business(info.project.name);
  try {
    await login(page, b.owner.email);
    await page.goto(`/b/${b.slug}`);
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { level: 1, name: /^Good (morning|afternoon|evening), Tile Test Grooming!$/ })).toBeVisible();
    await expect(main.getByText(/says it's a calm one today/)).toBeVisible();
    for (const t of ["Today's appointments", "Booking requests", "Available groomers", "Customers & pets", "Grooming services", "Revenue & performance", "Achievements"]) await expect(main.getByRole("link", { name: t, exact: true })).toBeVisible();
    await noSeriousViolations(page);

    await main.getByRole("button", { name: "Customise" }).click();
    await main.getByRole("button", { name: "Hide Revenue & performance" }).click();
    await expect(main.getByText("Layout saved")).toBeVisible();
    await expect(main.getByRole("link", { name: "Revenue & performance", exact: true })).toHaveCount(0);
    await main.getByRole("button", { name: "Move Grooming services earlier" }).click();
    await expect(main.getByText("Layout saved")).toBeVisible();
    const order = await tileTitles(page);
    expect(order.indexOf("Grooming services")).toBeLessThan(order.indexOf("Customers & pets"));
    await main.getByRole("button", { name: "Pin Achievements" }).click();
    await expect(main.getByText("Layout saved")).toBeVisible();
    await main.getByRole("button", { name: "Done" }).click();
    await noSeriousViolations(page);

    await page.reload();
    await expect(main.getByRole("link", { name: "Achievements", exact: true })).toBeVisible();
    await expect(main.locator("li h3").first()).toHaveText("Achievements");
    await expect(main.getByRole("link", { name: "Revenue & performance", exact: true })).toHaveCount(0);
    const row = (await admin().from("dashboard_layouts").select("layout").eq("business_id", b.businessId).eq("user_id", b.owner.id).single()).data;
    expect(row?.layout).toMatchObject({ hidden: ["revenue"], pinned: ["achievements"] });

    await main.getByRole("button", { name: "Customise" }).click();
    await main.getByRole("button", { name: "Show Revenue & performance" }).click();
    await expect(main.getByRole("link", { name: "Revenue & performance", exact: true })).toBeVisible();

    // Every tile is a link: the title opens its page.
    await main.getByRole("link", { name: "Grooming services", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/b/${b.slug}/services$`));
  } finally {
    await b.cleanup();
  }
});

test("groomers see their tiles without money or booking requests", async ({ page }, info) => {
  const b = await business(info.project.name);
  try {
    await login(page, b.groomer.email);
    await page.goto(`/b/${b.slug}`);
    const main = page.getByRole("main");
    await expect(main.getByRole("link", { name: "Today's appointments", exact: true })).toBeVisible();
    await expect(main.getByRole("link", { name: "Revenue & performance", exact: true })).toHaveCount(0);
    await expect(main.getByRole("link", { name: "Booking requests", exact: true })).toHaveCount(0);
    await expect(main.getByRole("heading", { name: "Get set up" })).toHaveCount(0);
    await noSeriousViolations(page);
  } finally {
    await b.cleanup();
  }
});
