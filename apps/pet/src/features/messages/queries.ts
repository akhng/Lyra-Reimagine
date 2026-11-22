import "server-only";
import { z } from "zod";
import { requireUser } from "@lyra/platform/auth/session";
import { createSupabaseServerClient } from "@lyra/platform/supabase/server";
import { businessConversationSchema, myConversationSchema, type BusinessConversation, type ChatMessage, type MyConversation } from "./schemas";

/** Message reads (RLS: the pet owner, the salon's front desk, and the owner's current groomer). */
export async function myConversations(): Promise<MyConversation[]> {
  await requireUser();
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("my_conversations");
  if (error) throw new Error("conversations query failed");
  return z.array(myConversationSchema).parse(data);
}

export async function businessConversations(businessId: string): Promise<BusinessConversation[]> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("business_conversations", { p_business: businessId });
  if (error) throw new Error("conversations query failed");
  return z.array(businessConversationSchema).parse(data);
}

/** Conversations with something new for this person (nav badges). */
export async function unreadConversations(side: { customer: true } | { businessId: string }): Promise<number> {
  const list = "customer" in side ? await myConversations() : await businessConversations(side.businessId);
  return list.filter((c) => c.unread).length;
}

export type Thread = {
  id: string;
  businessId: string;
  customerUserId: string;
  customerName: string;
  blockedBy: "customer" | "business" | null;
  contactUnlocked: boolean;
  messages: ChatMessage[];
};

/** One conversation (latest 200 messages, oldest first). Marks it read for the viewer. */
export async function thread(conversationId: string): Promise<Thread | null> {
  if (!z.uuid().safeParse(conversationId).success) return null;
  const db = await createSupabaseServerClient();
  const { data: c } = await db.from("chat_conversations").select("id, business_id, customer_user_id, customer_name, blocked_by").eq("id", conversationId).maybeSingle();
  if (!c) return null;
  const [{ data: rows }, { data: unlocked }] = await Promise.all([
    db.from("chat_messages").select("id, sender_kind, sender_name, body, masked, created_at").eq("conversation_id", c.id).order("created_at", { ascending: false }).limit(200),
    db.rpc("chat_contact_unlocked", { p_conversation: c.id }),
    db.rpc("mark_conversation_read", { p_conversation: c.id }),
  ]);
  return {
    id: c.id,
    businessId: c.business_id,
    customerUserId: c.customer_user_id,
    customerName: c.customer_name,
    blockedBy: (c.blocked_by as Thread["blockedBy"]) ?? null,
    contactUnlocked: unlocked === true,
    messages: (rows ?? []).reverse().map((m) => ({ id: m.id, senderKind: m.sender_kind as ChatMessage["senderKind"], senderName: m.sender_name, body: m.body, masked: m.masked, createdAt: m.created_at })),
  };
}

/** The salon side's context for a conversation: this owner's requests and appointments here (no contact details). */
export async function customerContext(businessId: string, customerUserId: string) {
  const db = await createSupabaseServerClient();
  const { data } = await db
    .from("booking_requests")
    .select("id, status, preferred_start, created_at, pets!booking_requests_pet_id_business_id_fkey(name), booking_request_services(name, position)")
    .eq("business_id", businessId)
    .eq("requester_id", customerUserId)
    .order("created_at", { ascending: false })
    .limit(5);
  return (data ?? []).map((r) => ({
    id: r.id,
    status: r.status,
    preferredStart: r.preferred_start,
    petName: (r.pets as unknown as { name: string } | null)?.name ?? "Pet",
    services: [...((r.booking_request_services as Array<{ name: string; position: number }>) ?? [])].sort((a, b) => a.position - b.position).map((s) => s.name),
  }));
}

/** Open reports (owners and managers; RLS). */
export async function openReports(conversationId: string) {
  const db = await createSupabaseServerClient();
  const { data } = await db.from("chat_reports").select("id, reporter_kind, reason, created_at").eq("conversation_id", conversationId).is("resolved_at", null).order("created_at");
  return data ?? [];
}
