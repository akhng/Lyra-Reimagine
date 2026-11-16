import "server-only";
import { z } from "zod";
import { requireUser } from "@lyra/platform/auth/session";
import { createSupabaseServerClient } from "@lyra/platform/supabase/server";

/** Loyalty, rewards, awards and reviews (RLS for staff; a definer function for pet owners). */
export type LoyaltySettings = { enabled: boolean; perAppointment: number; perDollar: number; birthday: number; achievements: boolean };
export const DEFAULT_SETTINGS: LoyaltySettings = { enabled: true, perAppointment: 10, perDollar: 1, birthday: 50, achievements: true };

export async function loyaltySettings(businessId: string): Promise<LoyaltySettings> {
  const db = await createSupabaseServerClient();
  const { data } = await db.from("loyalty_settings").select("enabled, points_per_appointment, points_per_dollar, birthday_points, achievements_enabled").eq("business_id", businessId).maybeSingle();
  return data ? { enabled: data.enabled, perAppointment: data.points_per_appointment, perDollar: Number(data.points_per_dollar), birthday: data.birthday_points, achievements: data.achievements_enabled } : DEFAULT_SETTINGS;
}

export async function rewards(businessId: string, activeOnly = false) {
  const db = await createSupabaseServerClient();
  let q = db.from("loyalty_rewards").select("id, name, description, cost_points, active").eq("business_id", businessId).order("cost_points");
  if (activeOnly) q = q.eq("active", true);
  return (await q).data ?? [];
}

export async function customerLoyalty(businessId: string, customerId: string) {
  const db = await createSupabaseServerClient();
  const { data } = await db.from("points_ledger").select("delta, reason, note, created_at").eq("business_id", businessId).eq("customer_id", customerId).order("created_at", { ascending: false }).limit(200);
  const rows = data ?? [];
  return { balance: rows.reduce((s, r) => s + r.delta, 0), lifetime: rows.filter((r) => r.delta > 0 && r.reason !== "reversal").reduce((s, r) => s + r.delta, 0), history: rows.slice(0, 15) };
}

export async function businessAwards(businessId: string): Promise<Map<string, string>> {
  const db = await createSupabaseServerClient();
  const { data } = await db.from("achievement_awards").select("key, awarded_at").eq("business_id", businessId).eq("subject", "business");
  return new Map((data ?? []).map((a) => [a.key, a.awarded_at]));
}

export async function reviewSummary(businessId: string) {
  const db = await createSupabaseServerClient();
  const { data } = await db.from("reviews").select("id, rating, comment, reply, replied_at, created_at, appointment_id, appointments!inner(pets!appointments_pet_id_business_id_fkey(name))").eq("business_id", businessId).order("created_at", { ascending: false }).limit(200);
  const rows = (data ?? []).map((r) => ({ id: r.id, rating: r.rating, comment: r.comment, reply: r.reply, createdAt: r.created_at, petName: (r.appointments as unknown as { pets: { name: string } | null } | null)?.pets?.name ?? "A pet" }));
  const avg = rows.length ? rows.reduce((s, r) => s + r.rating, 0) / rows.length : null;
  return { count: rows.length, average: avg, reviews: rows };
}

export async function loyaltyStats(businessId: string, sinceIso: string) {
  const db = await createSupabaseServerClient();
  const { data } = await db.from("points_ledger").select("delta, reason").eq("business_id", businessId).gte("created_at", sinceIso).limit(5000);
  const rows = data ?? [];
  return { issued: rows.filter((r) => r.delta > 0 && r.reason !== "reversal").reduce((s, r) => s + r.delta, 0), redemptions: rows.filter((r) => r.reason === "redemption").length };
}

const mine = z.object({
  salons: z.array(z.object({
    businessName: z.string(), businessSlug: z.string(), enabled: z.boolean(), balance: z.number(), lifetime: z.number(),
    history: z.array(z.object({ delta: z.number(), reason: z.string(), note: z.string().nullable(), at: z.string() })),
    rewards: z.array(z.object({ id: z.string(), name: z.string(), description: z.string().nullable(), cost: z.number() })),
    rules: z.object({ perAppointment: z.number(), perDollar: z.number(), birthday: z.number() }),
  })),
  petAwards: z.array(z.object({ ownerPetId: z.string().nullable(), petName: z.string(), key: z.string(), at: z.string(), businessName: z.string() })),
  groomDates: z.array(z.object({ ownerPetId: z.string().nullable(), date: z.string(), interval: z.number().nullable() })),
  reviews: z.array(z.object({ appointmentId: z.string(), rating: z.number(), comment: z.string().nullable(), reply: z.string().nullable() })),
});
export type MyLoyalty = z.infer<typeof mine>;

/** The pet owner's loyalty everywhere they're a customer (claims any pet birthday points first). */
export async function myLoyalty(): Promise<MyLoyalty> {
  await requireUser();
  const db = await createSupabaseServerClient();
  await db.rpc("claim_birthday_rewards");
  const { data, error } = await db.rpc("my_loyalty");
  if (error) throw new Error("loyalty query failed");
  return mine.parse(data);
}
