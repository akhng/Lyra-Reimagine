import { notFound } from "next/navigation";
import { z } from "zod";

/** A uuid route segment, or 404 (a malformed id is just a missing page). */
export function uuidOr404(id: string): string {
  if (!z.uuid().safeParse(id).success) notFound();
  return id;
}

/** First value of a search param. */
export const param = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""));
