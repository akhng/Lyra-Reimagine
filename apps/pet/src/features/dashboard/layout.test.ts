import { describe, expect, it } from "vitest";
import { moveTile, normaliseLayout, toggle, visibleTiles } from "./layout";

describe("dashboard layout", () => {
  it("fills in defaults, drops unknown tiles and appends new ones", () => {
    const l = normaliseLayout({ order: ["revenue", "bogus", "today"], sizes: { revenue: "l" }, pinned: [], hidden: [] });
    expect(l.order.slice(0, 2)).toEqual(["revenue", "today"]);
    expect(l.order).toHaveLength(9);
    expect(l.sizes.revenue).toBe("l");
    expect(l.sizes.today).toBe("l");
    expect(normaliseLayout(null).order[0]).toBe("today");
    expect(normaliseLayout({ order: "nope" }).order).toHaveLength(9);
  });

  it("shows pinned tiles first and leaves hidden ones out", () => {
    const l = { ...normaliseLayout({}), pinned: ["revenue" as const], hidden: ["services" as const] };
    const shown = visibleTiles(l);
    expect(shown[0]).toBe("revenue");
    expect(shown).not.toContain("services");
    expect(toggle(l.hidden, "services")).toEqual([]);
  });

  it("moves a tile to another tile's place and keeps hidden tiles", () => {
    const l = { ...normaliseLayout({}), hidden: ["services" as const] };
    const moved = moveTile(l, "revenue", "today");
    expect(visibleTiles(moved)[0]).toBe("revenue");
    expect(moved.order).toContain("services");
    expect(moveTile(l, "today", "today")).toBe(l);
  });

  it("pins a tile dropped among pinned tiles and unpins one dragged out", () => {
    const l = { ...normaliseLayout({}), pinned: ["customers" as const] };
    const into = moveTile(l, "revenue", "customers");
    expect(into.pinned).toContain("revenue");
    const out = moveTile(into, "customers", "today");
    expect(out.pinned).not.toContain("customers");
  });
});

import { allowedTiles } from "./layout";
describe("tiles by role", () => {
  it("shows money only to owners and managers and requests only to the front desk", () => {
    expect(allowedTiles("owner")).toContain("revenue");
    expect(allowedTiles("receptionist")).not.toContain("revenue");
    expect(allowedTiles("receptionist")).toContain("requests");
    expect(allowedTiles("groomer")).toEqual(["today", "groomers", "customers", "services", "reviews", "achievements"]);
  });
});
