import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@lyra/platform/supabase/server";
import { addDays, localToday } from "../scheduling/time";
import { bookingContextSchema, bookingViewSchema, type BookingContext, type BookingView } from "./context";

/**
 * The public booking context for a salon (anonymous-safe RPC). Null when the
 * salon doesn't exist. Cached per request so the page and its metadata share
 * one database round trip.
 */
export const getBookingContext = cache(async (slug: string, days = 31): Promise<BookingContext | null> => {
  const db = await createSupabaseServerClient();
  // A day either side covers every time zone the salon might be in.
  const today = localToday("Australia/Sydney");
  const { data, error } = await db.rpc("booking_context", { p_slug: slug, p_from: addDays(today, -1), p_to: addDays(today, Math.min(60, days)) });
  if (error || !data) return null;
  const parsed = bookingContextSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
});

export async function getBookingByToken(token: string): Promise<BookingView | null> {
  if (!/^[0-9a-f]{48}$/.test(token)) return null;
  const db = await createSupabaseServerClient();
  const { data } = await db.rpc("get_booking_by_token", { p_token: token });
  const parsed = bookingViewSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}
