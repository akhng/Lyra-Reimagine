import { describe, expect, it } from "vitest";
import { signInMessage, signUpMessage } from "./messages";

describe("auth messages", () => {
  it("only blames the password for real credential errors", () => {
    expect(signInMessage({ code: "invalid_credentials", status: 400, message: "Invalid login credentials" })).toBe("That email and password don't match.");
    expect(signInMessage({ status: 401, message: "Invalid API key" })).toBe("We couldn't sign you in right now. Please try again shortly.");
    expect(signInMessage({ message: "fetch failed" })).toBe("We couldn't sign you in right now. Please try again shortly.");
  });
  it("explains unconfirmed emails and rate limits", () => {
    expect(signInMessage({ code: "email_not_confirmed", status: 400, message: "Email not confirmed" })).toMatch(/confirm your email/);
    expect(signInMessage({ status: 429, message: "Too many requests" })).toMatch(/Too many attempts/);
  });
  it("hides whether an email is already registered", () => {
    expect(signUpMessage({ code: "user_already_exists", status: 422, message: "User already registered" })).toBeNull();
    expect(signUpMessage({ code: "over_email_send_rate_limit", status: 429, message: "email rate limit exceeded" })).toMatch(/too many emails/);
    expect(signUpMessage({ status: 401, message: "Invalid API key" })).toBe("We couldn't create your account. Please try again.");
  });
});
