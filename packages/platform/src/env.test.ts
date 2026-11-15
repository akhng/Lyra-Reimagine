import { describe, expect, it } from "vitest";
import { serverSchema } from "./env";

const KEY = "sb_publishable_abcdefghijklmnopqrstuvwxyz";
const base = { NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: KEY, SUPABASE_SERVICE_ROLE_KEY: "sb_secret_abcdefghijklmnopqrstuvwxyz" };

describe("server environment", () => {
  it("cleans values pasted with spaces, quotes or trailing slashes", () => {
    const env = serverSchema.parse({ ...base, NEXT_PUBLIC_SUPABASE_URL: " https://abc.supabase.co/ ", NEXT_PUBLIC_SUPABASE_ANON_KEY: `"${KEY}"\n`, APP_URL: "https://pet.vercel.app/" });
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://abc.supabase.co");
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe(KEY);
    expect(env.APP_URL).toBe("https://pet.vercel.app");
  });
  it("defaults APP_URL for local development", () => {
    expect(serverSchema.parse(base).APP_URL).toBe("http://localhost:3200");
  });
  it("rejects a project URL with a path or plain http", () => {
    expect(serverSchema.safeParse({ ...base, NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co/rest/v1" }).success).toBe(false);
    expect(serverSchema.safeParse({ ...base, NEXT_PUBLIC_SUPABASE_URL: "http://abc.supabase.co" }).success).toBe(false);
  });
});
