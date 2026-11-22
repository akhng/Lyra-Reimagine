import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../packages/platform/src/database";
import { NED, OLIVIA, PAWS, adminClient, newUser, signedIn } from "./helpers";

/**
 * Private messages (ADR 0005): a pet owner messages a listed salon with or
 * without a booking; the front desk and the owner's current groomer see it,
 * other groomers, other salons and other owners don't; contact details are
 * hidden until a paid booking; blocks, reports and fair-use limits hold.
 */
type Db = SupabaseClient<Database>;
const admin = adminClient();
const created: string[] = [];
let olivia: Db; // owner of Paws Test Salon
let ned: Db; // owner of another salon
let pat: Db; // pet owner
let patId = "";
let other: Db; // another pet owner
let groomer: Db;
let groomerMember = "";
let bystander: Db; // a groomer at Paws with no booking for Pat
let conv = "";

const messages = async (db: Db, id: string) => (await db.from("chat_messages").select("sender_kind, sender_name, body, masked").eq("conversation_id", id).order("created_at")).data ?? [];

beforeAll(async () => {
  olivia = await signedIn(OLIVIA);
  ned = await signedIn(NED);
  const p = await newUser("chat-owner");
  created.push(p.id);
  patId = p.id;
  pat = await signedIn(p);
  const o = await newUser("chat-other");
  created.push(o.id);
  other = await signedIn(o);
  const g = await newUser("chat-groomer");
  created.push(g.id);
  groomer = await signedIn(g);
  groomerMember = (await admin.from("business_members").insert({ business_id: PAWS, user_id: g.id, role: "groomer", display_name: "Gus" }).select("id").single()).data?.id ?? "";
  const b = await newUser("chat-bystander");
  created.push(b.id);
  bystander = await signedIn(b);
  await admin.from("business_members").insert({ business_id: PAWS, user_id: b.id, role: "groomer", display_name: "Bea" });
  await admin.from("marketplace_profiles").upsert({ business_id: PAWS, listed: true });
});

afterAll(async () => {
  await admin.from("chat_conversations").delete().eq("business_id", PAWS);
  await admin.from("booking_requests").delete().eq("business_id", PAWS);
  await admin.from("marketplace_profiles").delete().eq("business_id", PAWS);
  await admin.from("notifications").delete().in("user_id", [...created, OLIVIA.id]).like("kind", "message_%");
  for (const id of created) await admin.auth.admin.deleteUser(id);
});

describe("starting a conversation", () => {
  it("lets a pet owner message a listed salon without a booking, once per salon", async () => {
    const r = await pat.rpc("start_conversation", { p_slug: "paws-test" });
    expect(r.error).toBeNull();
    conv = r.data as string;
    expect((await pat.rpc("start_conversation", { p_slug: "PAWS-TEST " })).data).toBe(conv);
    // Staff see a first name only.
    expect((await olivia.from("chat_conversations").select("customer_name").eq("id", conv).single()).data?.customer_name).toBe("Test");
    expect((await pat.rpc("start_conversation", { p_slug: "neat-coat-test" })).error?.message).toBe("not_found");
    expect((await olivia.rpc("start_conversation", { p_slug: "paws-test" })).error?.message).toBe("own_business");
  });
});

describe("who can read and write", () => {
  it("shares messages between the owner and the front desk, and masks contact details before a paid booking", async () => {
    expect((await pat.rpc("send_chat_message", { p_conversation: conv, p_body: "  Hi! Can you do a puppy trim? Call me on 0412 345 678 or jo@example.com  " })).error).toBeNull();
    expect((await olivia.rpc("send_chat_message", { p_conversation: conv, p_body: "Yes! Book via fluffandfold.com.au or www.example.org" })).error).toBeNull();
    const seen = await messages(pat, conv);
    expect(seen).toEqual([
      { sender_kind: "customer", sender_name: "Test", body: "Hi! Can you do a puppy trim? Call me on [number hidden] or [contact hidden]", masked: true },
      { sender_kind: "staff", sender_name: "Olivia", body: "Yes! Book via [link hidden] or [link hidden]", masked: true },
    ]);
    expect(await messages(olivia, conv)).toEqual(seen);
    // Notifications go both ways (one per conversation and hour).
    expect((await olivia.from("notifications").select("kind").eq("kind", "message_new")).data?.length).toBe(1);
    expect((await pat.from("notifications").select("kind, data").eq("kind", "message_new")).data?.[0]?.data).toMatchObject({ conversationId: conv, businessSlug: "paws-test" });
  });

  it("keeps it from other salons, other owners and groomers without a booking for this owner", async () => {
    for (const db of [ned, other, groomer, bystander]) {
      expect(await messages(db, conv)).toEqual([]);
      expect((await db.from("chat_conversations").select("id").eq("id", conv)).data).toEqual([]);
      expect((await db.rpc("send_chat_message", { p_conversation: conv, p_body: "hello" })).error?.message).toBe("not_found");
    }
    // No direct writes, even to your own conversation.
    expect((await pat.from("chat_messages").insert({ conversation_id: conv, business_id: PAWS, sender_kind: "staff", sender_name: "Fake", body: "x" })).error).not.toBeNull();
    expect((await pat.from("chat_conversations").update({ blocked_by: null }).eq("id", conv).select()).data ?? []).toEqual([]);
  });

  it("brings in the groomer once a request is assigned to them, and unlocks contact details after payment", async () => {
    const service = (await admin.from("services").insert({ business_id: PAWS, name: "Chat test groom", duration_minutes: 60, base_price_cents: 8000, bookable_online: true }).select("id").single()).data?.id ?? "";
    const pet = (await pat.from("owner_pets").insert({ user_id: patId, name: "Pip", species: "dog" }).select("id").single()).data?.id ?? "";
    const start = new Date(Date.now() + 6 * 86_400_000);
    start.setUTCHours(0, 0, 0, 0);
    const req = await pat.rpc("submit_booking_request", { p_slug: "paws-test", p_owner_pet: pet, p_service_ids: [service], p_preferred_start: start.toISOString(), p_windows: [], p_notes: null } as never);
    expect(req.error).toBeNull();
    await admin.from("booking_requests").update({ status: "open", assigned_groomer_id: groomerMember }).eq("id", req.data as unknown as string);
    expect((await messages(groomer, conv)).length).toBe(2);
    expect(await messages(bystander, conv)).toEqual([]);
    expect((await groomer.rpc("send_chat_message", { p_conversation: conv, p_body: "Hi, I'm Gus. Does Pip mind the dryer?" })).error).toBeNull();
    expect((await messages(pat, conv)).at(-1)).toMatchObject({ sender_kind: "staff", sender_name: "Gus", masked: false });

    // Paid through the app: numbers are no longer hidden.
    const customer = (await admin.from("booking_requests").select("customer_id").eq("id", req.data as unknown as string).single()).data?.customer_id ?? "";
    await admin.rpc("sync_payment_account", { p_business: PAWS, p_account: "acct_testchat", p_charges: true, p_payouts: true, p_details: true });
    await admin.from("payments").insert({ business_id: PAWS, request_id: req.data as unknown as string, customer_id: customer, amount_cents: 8000, fee_cents: 400, stripe_account_id: "acct_testchat", stripe_checkout_session_id: "cs_test_chat", status: "paid" });
    await pat.rpc("send_chat_message", { p_conversation: conv, p_body: "My number is 0412 345 678" });
    expect((await messages(olivia, conv)).at(-1)).toMatchObject({ body: "My number is 0412 345 678", masked: false });
    await admin.from("payments").delete().eq("business_id", PAWS);
    await admin.from("payment_accounts").delete().eq("business_id", PAWS);
    await admin.from("services").delete().eq("id", service);
  });
});

describe("unread, blocks, reports and limits", () => {
  it("tracks unread per side", async () => {
    await pat.rpc("mark_conversation_read", { p_conversation: conv });
    const mine = (await pat.rpc("my_conversations")).data as Array<{ id: string; unread: boolean }>;
    expect(mine.find((c) => c.id === conv)?.unread).toBe(false);
    await olivia.rpc("send_chat_message", { p_conversation: conv, p_body: "See you then!" });
    expect(((await pat.rpc("my_conversations")).data as Array<{ id: string; unread: boolean }>).find((c) => c.id === conv)?.unread).toBe(true);
    const staff = (await olivia.rpc("business_conversations", { p_business: PAWS })).data as Array<{ id: string; unread: boolean; customerName: string }>;
    expect(staff.find((c) => c.id === conv)).toMatchObject({ unread: false, customerName: "Test" });
    expect((await ned.rpc("business_conversations", { p_business: PAWS })).data).toEqual([]);
  });

  it("lets either side block (only they can unblock) and report to the salon's owners", async () => {
    expect((await groomer.rpc("set_conversation_blocked", { p_conversation: conv, p_blocked: true })).error?.message).toBe("not_allowed");
    await pat.rpc("set_conversation_blocked", { p_conversation: conv, p_blocked: true });
    expect((await olivia.rpc("send_chat_message", { p_conversation: conv, p_body: "Hello?" })).error?.message).toBe("blocked");
    expect((await olivia.rpc("set_conversation_blocked", { p_conversation: conv, p_blocked: false })).error?.message).toBe("not_allowed");
    await pat.rpc("set_conversation_blocked", { p_conversation: conv, p_blocked: false });
    expect((await olivia.rpc("send_chat_message", { p_conversation: conv, p_body: "Hello again" })).error).toBeNull();

    const rep = await groomer.rpc("report_conversation", { p_conversation: conv, p_reason: "Rude" });
    expect(rep.error).toBeNull();
    expect((await olivia.from("chat_reports").select("reason").eq("conversation_id", conv)).data).toEqual([{ reason: "Rude" }]);
    expect((await pat.from("chat_reports").select("id").eq("conversation_id", conv)).data).toEqual([]);
    expect((await olivia.from("notifications").select("kind").eq("kind", "message_reported")).data?.length).toBe(1);
    expect((await groomer.rpc("resolve_chat_report", { p_report: rep.data as string })).error?.message).toBe("not_found");
    await olivia.rpc("resolve_chat_report", { p_report: rep.data as string });
    expect((await olivia.from("chat_reports").select("resolved_at").eq("id", rep.data as string).single()).data?.resolved_at).not.toBeNull();
  });

  it("rejects empty or huge messages and limits bursts", async () => {
    expect((await pat.rpc("send_chat_message", { p_conversation: conv, p_body: "   " })).error?.message).toBe("invalid_message");
    expect((await pat.rpc("send_chat_message", { p_conversation: conv, p_body: "x".repeat(2001) })).error?.message).toBe("invalid_message");
    const results: Array<string | undefined> = [];
    for (let i = 0; i < 11; i++) results.push((await pat.rpc("send_chat_message", { p_conversation: conv, p_body: `ping ${i}` })).error?.message);
    expect(results).toContain("rate_limited");
  });
});
