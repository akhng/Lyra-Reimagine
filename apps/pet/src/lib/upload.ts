"use client";
import { createSupabaseBrowserClient } from "@lyra/platform/supabase/browser";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const PHOTO_ACCEPT = Object.keys(EXT).join(",");
export const MAX_PHOTO_MB = 8;

/** Why a file can't be uploaded, or null when it's fine. */
export function photoProblem(file: File): string | null {
  if (!EXT[file.type]) return `${file.name}: use a JPEG, PNG or WebP photo.`;
  if (file.size > MAX_PHOTO_MB * 1024 * 1024) return `${file.name}: photos must be ${MAX_PHOTO_MB} MB or smaller.`;
  return null;
}

/**
 * Uploads straight from the browser to the private media bucket (avoids the
 * server body-size limit). Storage RLS only accepts paths under a business
 * the user belongs to. Returns the stored path, or null on failure.
 */
export async function uploadPhoto(folder: string, file: File): Promise<string | null> {
  const path = `${folder}/${crypto.randomUUID()}.${EXT[file.type] ?? "jpg"}`;
  const { error } = await createSupabaseBrowserClient().storage.from("media").upload(path, file, { contentType: file.type, upsert: false });
  return error ? null : path;
}
