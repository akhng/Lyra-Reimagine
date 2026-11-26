"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createSupabaseBrowserClient } from "@lyra/platform/supabase/browser";

/**
 * Keeps the page in step with the person's notifications: when a new one is
 * written (a salon declines a request, confirms it…), Supabase Realtime tells
 * us and the server-rendered page refreshes, so the bell and the home page
 * update without a reload. RLS means only the person's own rows arrive.
 * Coming back to the tab also refreshes, in case the connection dropped.
 */
export function LiveNotifications({ userId }: { userId: string }) {
  const router = useRouter();
  useEffect(() => {
    const db = createSupabaseBrowserClient();
    let channel: ReturnType<typeof db.channel> | null = null;
    let cancelled = false;
    // Subscribe as the signed-in person (RLS decides what arrives), not anonymously.
    void db.auth.getSession().then(({ data }) => {
      if (cancelled || !data.session) return;
      void db.realtime.setAuth(data.session.access_token);
      channel = db
        .channel(`notifications:${userId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => router.refresh())
        .subscribe();
    });
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) void db.removeChannel(channel);
    };
  }, [userId, router]);
  return null;
}
