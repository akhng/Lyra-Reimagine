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
    expect(renderEmail("request_open", d, opts)).toBeNull();
  });
});

describe("accepted request email", () => {
  const d = { petName: "Biscuit", businessName: "Fluff & Fold", groomerName: "Alex", startsAt: "2026-11-20T23:00:00Z", timezone: "Australia/Melbourne", requestId: "r1", services: ["Full groom"], locationName: "Carlton studio", address: "12 Lygon St, Carlton VIC 3053", phone: "03 9000 0000", estimateCents: 9500, estimateFrom: false, paid: false, cancellationHours: 24 };
  const opts = { appUrl: "https://pet.example.test", firstName: "Sam" };

  it("gives when, where, who, what and the price", () => {
    const e = renderEmail("request_confirmed", d, opts);
    expect(e?.subject).toBe("Booked! Biscuit's groom at Fluff & Fold on Sat, 21 Nov, 10:00 am");
    expect(e?.text).toContain("Good news: Fluff & Fold has accepted Biscuit's grooming request with Alex.");
    expect(e?.text).toContain("When: Sat, 21 Nov, 10:00 am");
    expect(e?.text).toContain("Where: Carlton studio, 12 Lygon St, Carlton VIC 3053");
    expect(e?.text).toContain("Services: Full groom");
    expect(e?.text).toContain("Price: $95.00, to pay at the salon");
    expect(e?.text).toContain("up to 24 hours before the appointment.");
    expect(e?.text).toContain("call Fluff & Fold on 03 9000 0000");
    expect(e?.text).toContain("https://pet.example.test/me/requests/r1");
    expect(e?.html).toContain("<strong>When:</strong>");
  });

  it("says when it's already paid, and when the price is a 'from' estimate", () => {
    expect(renderEmail("request_confirmed", { ...d, paid: true }, opts)?.text).toContain("Price: $95.00, paid in the app");
    expect(renderEmail("request_confirmed", { ...d, paid: true }, opts)?.text).toContain("and get a full refund");
    expect(renderEmail("request_confirmed", { ...d, estimateFrom: true }, opts)?.text).toContain("Price: From $95.00, to pay at the salon (the final price may change");
  });

  it("leaves out what the salon hasn't set up", () => {
    const e = renderEmail("request_confirmed", { petName: "Biscuit", businessName: "Fluff & Fold", requestId: "r1" }, opts);
    expect(e?.subject).toBe("Booked! Biscuit's groom at Fluff & Fold");
    expect(e?.text).not.toMatch(/Where:|Price:|call /);
    expect(e?.text).toContain("You can cancel in the app before the appointment.");
  });
});
