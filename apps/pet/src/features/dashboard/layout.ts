import { z } from "zod";

/**
 * Dashboard tiles and personal layouts (ADR 0003). Pure, so the rules are
 * unit-tested: unknown tiles are dropped, new tiles are appended, pinned
 * tiles come first, hidden tiles are kept out of the board but can return.
 */
export const TILE_IDS = ["today", "requests", "groomers", "customers", "services", "revenue", "achievements"] as const;
export type TileId = (typeof TILE_IDS)[number];
export type TileSize = "s" | "l";

export const DEFAULT_SIZES: Record<TileId, TileSize> = { today: "l", requests: "s", groomers: "s", customers: "s", services: "s", revenue: "s", achievements: "l" };

const tileId = z.enum(TILE_IDS);
// Stored layouts may name tiles that no longer exist: accept any short names, then keep the known ones.
const names = z.array(z.string().max(40)).max(40).default([]);
export const layoutSchema = z.object({ order: names, sizes: z.record(z.string().max(40), z.enum(["s", "l"])).default({}), pinned: names, hidden: names });
export type Layout = { order: TileId[]; sizes: Record<TileId, TileSize>; pinned: TileId[]; hidden: TileId[] };

const unique = <T,>(xs: readonly T[]) => [...new Set(xs)];

/** A complete, valid layout from whatever was stored (or nothing). */
export function normaliseLayout(raw: unknown): Layout {
  const parsed = layoutSchema.safeParse(raw ?? {});
  const v = parsed.success ? parsed.data : { order: [], sizes: {}, pinned: [], hidden: [] };
  const known = (xs: string[]) => unique(xs.filter((t): t is TileId => tileId.safeParse(t).success));
  const sizes = { ...DEFAULT_SIZES };
  for (const [k, size] of Object.entries(v.sizes)) if (tileId.safeParse(k).success) sizes[k as TileId] = size;
  return { order: unique([...known(v.order), ...TILE_IDS]), sizes, pinned: known(v.pinned), hidden: known(v.hidden) };
}

/** Tiles shown on the board, pinned first, in the person's order. */
export function visibleTiles(l: Layout): TileId[] {
  const shown = l.order.filter((t) => !l.hidden.includes(t));
  return [...shown.filter((t) => l.pinned.includes(t)), ...shown.filter((t) => !l.pinned.includes(t))];
}

/** Moves `id` to where `over` is (drag and drop, or the move buttons). */
export function moveTile(l: Layout, id: TileId, over: TileId): Layout {
  if (id === over) return l;
  const shown = visibleTiles(l);
  const from = shown.indexOf(id);
  const to = shown.indexOf(over);
  if (from < 0 || to < 0) return l;
  const next = [...shown];
  next.splice(from, 1);
  next.splice(to, 0, id);
  // A tile dragged across the pinned boundary takes on its neighbours' pinned state.
  const pinned = l.pinned.includes(over) ? unique([...l.pinned, id]) : l.pinned.filter((t) => t !== id);
  return { ...l, order: [...next, ...l.hidden], pinned };
}

export function toggle(list: TileId[], id: TileId): TileId[] {
  return list.includes(id) ? list.filter((t) => t !== id) : [...list, id];
}

/** Which tiles a role may see: money for owners and managers, booking requests for the front desk. */
export function allowedTiles(role: "owner" | "manager" | "receptionist" | "groomer"): TileId[] {
  if (role === "owner" || role === "manager") return [...TILE_IDS];
  if (role === "receptionist") return TILE_IDS.filter((t) => t !== "revenue");
  return TILE_IDS.filter((t) => t !== "revenue" && t !== "requests");
}
