import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "@lyra/platform/supabase/server";

/** The shift board: open requests the signed-in groomer may take (definer function; pet care details only). */
const card = z.object({
  id: z.string(), petName: z.string(), species: z.string(), breed: z.string().nullable(), size: z.string().nullable(), petId: z.string(), photoPath: z.string().nullable(), photoBucket: z.enum(["media", "owner-media"]),
  ownerNotes: z.string().nullable(), notes: z.string().nullable(), preferredStart: z.string().nullable(), windows: z.array(z.object({ date: z.string(), part: z.enum(["morning", "afternoon", "any"]) })),
  minutes: z.number(), estimateCents: z.number().nullable(), estimateFrom: z.boolean(), commissionCents: z.number().nullable(), deadline: z.string().nullable(), assignedToMe: z.boolean(), services: z.array(z.string()), starts: z.array(z.string()),
});
export type ShiftCard = z.infer<typeof card> & { photoUrl: string | null };

export async function shiftBoard(businessId: string): Promise<ShiftCard[]> {
  const db = await createSupabaseServerClient();
  await db.rpc("tidy_booking_requests", { p_business: businessId });
  const { data, error } = await db.rpc("shift_board", { p_business: businessId });
  if (error) throw new Error("shift board failed");
  const cards = z.array(card).parse(data);
  const sign = async (bucket: "media" | "owner-media") => {
    const paths = cards.filter((c) => c.photoBucket === bucket && c.photoPath).map((c) => c.photoPath as string);
    return paths.length ? ((await db.storage.from(bucket).createSignedUrls(paths, 3600)).data ?? []) : [];
  };
  const urls = new Map([...(await sign("media")), ...(await sign("owner-media"))].flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])));
  return cards.map((c) => ({ ...c, photoUrl: c.photoPath ? (urls.get(c.photoPath) ?? null) : null }));
}

export async function allocationSettings(businessId: string) {
  const db = await createSupabaseServerClient();
  const [{ data: policy }, { data: caps }, { data: services }] = await Promise.all([
    db.from("booking_policies").select("allocation_mode, accept_hours, groomer_commission_percent, groomers_set_own_hours").eq("business_id", businessId).maybeSingle(),
    db.from("member_services").select("member_id, service_id").eq("business_id", businessId),
    db.from("services").select("id, name").eq("business_id", businessId).eq("active", true).order("position").order("name"),
  ]);
  return {
    mode: policy?.allocation_mode ?? "manual",
    acceptHours: policy?.accept_hours ?? 24,
    commission: policy?.groomer_commission_percent ?? null,
    ownHours: policy?.groomers_set_own_hours ?? false,
    capabilities: (caps ?? []).map((c) => `${c.member_id}:${c.service_id}`),
    services: services ?? [],
  };
}
