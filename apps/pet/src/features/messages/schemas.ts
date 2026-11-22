import { z } from "zod";

/** Private messages (ADR 0005). The database re-checks everything; these give quick, friendly errors. */
export const MESSAGE_MAX = 2000;
export const messageSchema = z.object({
  conversationId: z.uuid(),
  body: z.string().trim().min(1, "Write a message first.").max(MESSAGE_MAX, `Keep it under ${MESSAGE_MAX} characters.`),
});
export const reportSchema = z.object({ conversationId: z.uuid(), reason: z.string().trim().max(500).optional() });

export const MESSAGE_ERRORS: Record<string, string> = {
  not_found: "This conversation isn't available.",
  blocked: "This conversation is blocked, so new messages can't be sent.",
  invalid_message: "Write a message of up to 2,000 characters.",
  rate_limited: "You're sending messages quickly. Please wait a moment and try again.",
  own_business: "That's your own salon. Customers' messages appear under Messages in your business.",
  not_allowed: "You can't do that in this conversation.",
};

const conversationRow = z.object({ id: z.string(), lastMessageAt: z.string().nullable(), blockedBy: z.enum(["customer", "business"]).nullable(), preview: z.string().nullable(), unread: z.boolean() });
export const myConversationSchema = conversationRow.extend({ businessName: z.string(), businessSlug: z.string(), timezone: z.string() });
export const businessConversationSchema = conversationRow.extend({ customerName: z.string(), openReports: z.number() });
export type MyConversation = z.infer<typeof myConversationSchema>;
export type BusinessConversation = z.infer<typeof businessConversationSchema>;
export type ChatMessage = { id: number; senderKind: "customer" | "staff"; senderName: string; body: string; masked: boolean; createdAt: string };
