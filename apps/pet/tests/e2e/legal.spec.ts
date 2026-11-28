import { expect, test } from "@playwright/test";
import { noSeriousViolations } from "./helpers";

/**
 * The published terms and privacy policy: public (no sign-in), name the
 * operator and contact from the environment, and are linked where people
 * agree to them.
 */
const PAGES = [
  { path: "/terms", title: "Customer Terms", section: "5. Cancellations and refunds" },
  { path: "/terms/business", title: "Business Terms", section: "4. Lyra Pet's service fee" },
  { path: "/privacy", title: "Privacy Policy", section: "3. Who we share it with" },
];

test("terms and privacy pages are public, complete and accessible", async ({ page }) => {
  for (const p of PAGES) {
    await page.goto(p.path);
    await expect(page).toHaveURL(new RegExp(`${p.path}$`)); // not sent to sign in
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { name: p.title, level: 1 })).toBeVisible();
    await expect(main.getByRole("heading", { name: p.section })).toBeVisible();
    await expect(main.getByText(/Last updated \d{1,2} \w+ \d{4}/)).toBeVisible();
    await expect(main.getByText("Lyra Pet Test Pty Ltd (ABN 00 000 000 000)")).toBeVisible();
    await expect(main.getByRole("link", { name: "privacy@lyrapet.test" }).first()).toHaveAttribute("href", "mailto:privacy@lyrapet.test");
    // No leftover draft placeholders.
    await expect(main.getByText(/\[[A-Z ]+\]|DRAFT/)).toHaveCount(0);
    await noSeriousViolations(page);
  }
  // The privacy policy points complaints to the regulator.
  await expect(page.getByRole("link", { name: "oaic.gov.au" })).toHaveAttribute("href", "https://www.oaic.gov.au");
});

test("people are pointed to the terms where they agree to them", async ({ page }) => {
  await page.goto("/signup");
  await expect(page.getByText("By creating an account, you agree to the Customer Terms and the Privacy Policy.")).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: "Customer Terms", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Customer Terms", level: 1 })).toBeVisible();
  await page.getByRole("navigation", { name: "Legal" }).getByRole("link", { name: "Business terms" }).click();
  await expect(page.getByRole("heading", { name: "Business Terms", level: 1 })).toBeVisible();
  await page.goto("/");
  await page.getByRole("navigation", { name: "Legal" }).getByRole("link", { name: "Privacy" }).click();
  await expect(page.getByRole("heading", { name: "Privacy Policy", level: 1 })).toBeVisible();
});
