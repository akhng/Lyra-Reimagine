import { describe, expect, it } from "vitest";
import { safeNextPath } from "@lyra/platform/auth/safe-redirect";
import { isAuthRoute, isProtectedRoute } from "./routes";

describe("routes", () => {
  it("protects the app and onboarding, not the landing or auth pages", () => {
    for (const p of ["/home", "/onboarding", "/b/paws", "/b/paws/settings"]) expect(isProtectedRoute(p), p).toBe(true);
    for (const p of ["/", "/login", "/signup", "/auth/callback", "/book/paws", "/bee"]) expect(isProtectedRoute(p), p).toBe(false);
    expect(isAuthRoute("/login")).toBe(true);
    expect(isAuthRoute("/b/x")).toBe(false);
  });
  it("only allows same-site paths after sign-in", () => {
    expect(safeNextPath("/b/paws?x=1")).toBe("/b/paws?x=1");
    for (const bad of ["//evil.example", "https://evil.example", "/\\evil", "javascript:alert(1)", null, ""]) expect(safeNextPath(bad)).toBe("/home");
  });
});
