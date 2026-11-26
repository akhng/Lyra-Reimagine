import { describe, expect, it, vi } from "vitest";
import { resendProvider } from "./resend";

const message = { from: "Lyra Pet <hello@pets.example.test>", to: "sam@example.test", subject: "Hi", text: "Hello", html: "<p>Hello</p>", idempotencyKey: "email-outbox-7" };

describe("Resend provider", () => {
  it("posts the email to Resend with the key and an idempotency key", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: "e1" }), { status: 200 }));
    await resendProvider("re_test_key", fetchImpl as unknown as typeof fetch).send(message);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers).toMatchObject({ authorization: "Bearer re_test_key", "idempotency-key": "email-outbox-7" });
    expect(JSON.parse(String(init.body))).toEqual({ from: message.from, to: ["sam@example.test"], subject: "Hi", text: "Hello", html: "<p>Hello</p>" });
  });

  it("throws on an error status without echoing the response (which may contain the address)", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ message: "sam@example.test is invalid" }), { status: 422 }));
    await expect(resendProvider("re_test_key", fetchImpl as unknown as typeof fetch).send(message)).rejects.toThrow(/^resend send failed: 422$/);
  });
});
