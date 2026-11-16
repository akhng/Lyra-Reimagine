"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@lyra/platform/auth/session";
import { logger } from "@lyra/platform/logger";
import { createSupabaseServerClient } from "@lyra/platform/supabase/server";
import { requireBusiness } from "@lyra/platform/tenancy/context";
import { can } from "@lyra/platform/tenancy/roles";
import { fieldErrors, text, type FormState } from "@/lib/form";

/** Loyalty rules, rewards, redemptions and reviews. The database enforces limits, roles and "never twice". */
const num = (label: string, max: number, decimals = false) =>
  z.string().trim().transform((v, c) => {
    const n = Number(v);
    if (v === "" || !Number.isFinite(n) || n < 0 || n > max || (!decimals && !Number.isInteger(n))) {
      c.addIssue({ code: "custom", message: `${label}: a number from 0 to ${max}` });
      return z.NEVER;
    }
    return n;
  });

export async function saveLoyaltyAction(slug: string, _prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireBusiness(slug);
  if (!can(ctx.role, "business.edit")) return { error: "Only owners and managers can change loyalty rules." };
  const parsed = z.object({ perAppointment: num("Points per appointment", 10000), perDollar: num("Points per dollar", 100, true), birthday: num("Birthday points", 10000) }).safeParse({ perAppointment: text(form, "perAppointment"), perDollar: text(form, "perDollar"), birthday: text(form, "birthday") });
  if (!parsed.success) return { fields: fieldErrors(parsed.error.issues) };
  const db = await createSupabaseServerClient();
  const { error } = await db.from("loyalty_settings").upsert({ business_id: ctx.business.id, enabled: form.get("enabled") === "on", achievements_enabled: form.get("achievements") === "on", points_per_appointment: parsed.data.perAppointment, points_per_dollar: parsed.data.perDollar, birthday_points: parsed.data.birthday, updated_at: new Date().toISOString() });
  if (error) {
    logger.warn({ businessId: ctx.business.id, code: error.code }, "loyalty save failed");
    return { error: "We couldn't save that. Please try again." };
  }
  return { ok: true };
}

export async function addRewardAction(slug: string, _prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireBusiness(slug);
  if (!can(ctx.role, "business.edit")) return { error: "Only owners and managers can change rewards." };
  const parsed = z.object({ name: z.string().trim().min(1, "Name the reward").max(80), description: z.string().trim().max(300), cost: num("Points needed", 1000000) }).safeParse({ name: text(form, "name"), description: text(form, "description"), cost: text(form, "cost") });
  if (!parsed.success) return { fields: fieldErrors(parsed.error.issues) };
  if (parsed.data.cost < 1) return { fields: { cost: "At least 1 point" } };
  const db = await createSupabaseServerClient();
  const { error } = await db.from("loyalty_rewards").insert({ business_id: ctx.business.id, name: parsed.data.name, description: parsed.data.description || null, cost_points: parsed.data.cost });
  if (error) return { error: "We couldn't add that reward." };
  revalidatePath(`/b/${slug}/settings/loyalty`);
  return { ok: true };
}

export async function setRewardActiveAction(slug: string, rewardId: string, active: boolean): Promise<{ ok: boolean }> {
  const ctx = await requireBusiness(slug);
  if (!can(ctx.role, "business.edit") || !z.uuid().safeParse(rewardId).success) return { ok: false };
  const db = await createSupabaseServerClient();
  const { error } = await db.from("loyalty_rewards").update({ active }).eq("id", rewardId).eq("business_id", ctx.business.id);
  revalidatePath(`/b/${slug}/settings/loyalty`);
  return { ok: !error };
}

export async function redeemRewardAction(slug: string, customerId: string, rewardId: string): Promise<{ ok: boolean; error?: string; balance?: number }> {
  const ctx = await requireBusiness(slug);
  if (!can(ctx.role, "appointments.manage") || !z.uuid().safeParse(customerId).success || !z.uuid().safeParse(rewardId).success) return { ok: false, error: "Only the front desk can redeem rewards." };
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("redeem_reward", { p_customer: customerId, p_reward: rewardId });
  if (error) return { ok: false, error: error.message === "not_enough_points" ? "Not enough points for that reward yet." : "We couldn't redeem that." };
  revalidatePath(`/b/${slug}/customers/${customerId}`);
  return { ok: true, balance: data as number };
}

export async function replyReviewAction(slug: string, reviewId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireBusiness(slug);
  if (!can(ctx.role, "business.edit") || !z.uuid().safeParse(reviewId).success) return { error: "Only owners and managers can reply to reviews." };
  const db = await createSupabaseServerClient();
  const { error } = await db.rpc("reply_review", { p_review: reviewId, p_reply: text(form, "reply").slice(0, 1000) });
  if (error) return { error: "We couldn't save your reply." };
  revalidatePath(`/b/${slug}/reviews`);
  return { ok: true };
}

export async function submitReviewAction(appointmentId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await requireUser();
  const parsed = z.object({ rating: z.coerce.number().int().min(1, "Choose a rating").max(5), comment: z.string().trim().max(1000) }).safeParse({ rating: text(form, "rating") || "0", comment: text(form, "comment") });
  if (!parsed.success || !z.uuid().safeParse(appointmentId).success) return { fields: { rating: "Choose a rating from 1 to 5 stars" } };
  const db = await createSupabaseServerClient();
  const { error } = await db.rpc("submit_review", { p_appointment: appointmentId, p_rating: parsed.data.rating, p_comment: parsed.data.comment });
  if (error) return { error: error.message === "already_reviewed" ? "You've already reviewed this groom." : "We couldn't save your review." };
  return { ok: true };
}
