import { describe, expect, it } from "vitest";
import { renderEmail } from "./templates";

describe("declined request email", () => {
  const d = { petName: "Biscuit", businessName: "Fluff & Fold", startsAt: "2026-11-20T23:00:00Z", timezone: "Australia/Melbourne", requestId: "r1", services: ["Bath", "Nails"] };
  const opts = { appUrl: "https://pet.example.test", firstName: "Sam" };

  it("says who declined, what and when, and links to the request", () => {
    const e = renderEmail("request_rejected", d, opts);
    expect(e?.subject).toBe("Fluff & Fold couldn't take Biscuit's grooming request");
    expect(e?.text).toContain("Hi Sam,");
    expect(e?.text).toContain("Biscuit's request for Bath, Nails on Sat, 21 Nov, 10:00 am");
    expect(e?.text).toContain("https://pet.example.test/me/requests/r1");
    expect(e?.html).toContain('href="https://pet.example.test/me/requests/r1"');
  });

  it("includes the salon's reason and the refund only when there is one", () => {
    const plain = renderEmail("request_rejected", d, opts);
    expect(plain?.text).not.toContain("Their message");
    expect(plain?.text).not.toContain("refunded");
    const full = renderEmail("request_rejected", { ...d, reason: "Fully booked that week", refund: true }, opts);
    expect(full?.text).toContain('Their message: "Fully booked that week"');
    expect(full?.text).toContain("refunded in full");
  });

  it("escapes HTML from names and reasons", () => {
    const e = renderEmail("request_rejected", { ...d, businessName: "<b>Salon</b>", reason: `"><script>x</script>` }, opts);
    expect(e?.html).not.toContain("<script>");
    expect(e?.html).toContain("&lt;b&gt;Salon&lt;/b&gt;");
  });

  it("falls back gracefully and ignores kinds without an email", () => {
    expect(renderEmail("request_rejected", {}, { appUrl: "https://x.test" })?.text).toContain("Hi there,");
    expect(renderEmail("request_confirmed", d, opts)).toBeNull();
  });
});
