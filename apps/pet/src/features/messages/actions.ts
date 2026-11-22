"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@lyra/platform/auth/session";
import { logger } from "@lyra/platform/logger";
import { createSupabaseServerClient } from "@lyra/platform/supabase/server";
import { MESSAGE_ERRORS, messageSchema, reportSchema } from "./schemas";

/** Message actions. The database decides who may write, masks contact details and enforces limits. Never log message text. */
type Result = { ok: true } | { ok: false; error: string };
const fail = (code: string | undefined, fallback = "Something went wrong. Please try again."): Result => ({ ok: false, error: (code && MESSAGE_ERRORS[code]) || fallback });

export async function startConversationAction(slug: string): Promise<Result> {
  await requireUser();
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("start_conversation", { p_slug: slug.slice(0, 80) });
  if (error || !data) return fail(error?.message);
  redirect(`/me/messages/${data}`);
}

export async function sendMessageAction(input: unknown): Promise<Result> {
  await requireUser();
  const p = messageSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? MESSAGE_ERRORS.invalid_message ?? "" };
  const db = await createSupabaseServerClient();
  const { error } = await db.rpc("send_chat_message", { p_conversation: p.data.conversationId, p_body: p.data.body });
  if (error) {
    if (!MESSAGE_ERRORS[error.message]) logger.warn({ conversationId: p.data.conversationId, code: error.code }, "send message failed");
    return fail(error.message);
  }
  return { ok: true };
}

export async function setBlockedAction(conversationId: string, blocked: boolean, path: string): Promise<Result> {
  await requireUser();
  if (!z.uuid().safeParse(conversationId).success) return fail("not_found");
  const db = await createSupabaseServerClient();
  const { error } = await db.rpc("set_conversation_blocked", { p_conversation: conversationId, p_blocked: blocked });
  if (error) return fail(error.message);
  revalidatePath(path);
  return { ok: true };
}

export async function reportConversationAction(input: unknown): Promise<Result> {
  await requireUser();
  const p = reportSchema.safeParse(input);
  if (!p.success) return fail("not_found");
  const db = await createSupabaseServerClient();
  const { error } = await db.rpc("report_conversation", { p_conversation: p.data.conversationId, p_reason: p.data.reason ?? "" });
  return error ? fail(error.message) : { ok: true };
}

export async function resolveReportAction(reportId: string, path: string): Promise<Result> {
  await requireUser();
  if (!z.uuid().safeParse(reportId).success) return fail("not_found");
  const db = await createSupabaseServerClient();
  const { error } = await db.rpc("resolve_chat_report", { p_report: reportId });
  if (error) return fail(error.message);
  revalidatePath(path);
  return { ok: true };
}
