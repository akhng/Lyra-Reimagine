import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";
import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:55324";

export const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false } });

export const uniqueEmail = (prefix: string, project: string) => `${prefix}-${project}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@example.test`;
export const uniqueSlug = (prefix: string, project: string) => `${prefix}-${project}-${Date.now().toString(36)}`.slice(0, 40);

/** The newest auth link sent to `to` (local Supabase delivers mail to Mailpit). */
export async function emailLink(to: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const search = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`).then((r) => r.json());
    const id: string | undefined = search.messages?.[0]?.ID;
    if (id) {
      const m = await fetch(`${MAILPIT}/api/v1/message/${id}`).then((r) => r.json());
      const link = `${m.HTML ?? ""}\n${m.Text ?? ""}`.match(/https?:\/\/[^\s"'<>)]+/g)?.find((u) => /auth\/v1\/verify/.test(u));
      if (link) return link.replaceAll("&amp;", "&");
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no confirmation email for ${to}`);
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

export async function noSeriousViolations(page: Page) {
  await expect(page).toHaveTitle(/\S/);
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ") + (process.env.AXE_DEBUG ? ` ${n.html} ${n.failureSummary}` : "")).join(", ")}`)).toEqual([]);
}

/** Open the main navigation (a menu on phones and tablets) and follow a link. */
export async function navigate(page: Page, name: string) {
  const menu = page.getByRole("button", { name: "Open menu" });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name, exact: true }).click();
}
