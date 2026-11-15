import { describe, expect, it } from "vitest";
import { notificationHref, renderNotification } from "./templates";

describe("notification text", () => {
  const d = { petName: "Biscuit", businessName: "Fluff & Fold", groomerName: "Alex", startsAt: "2026-11-20T23:00:00Z", timezone: "Australia/Melbourne", requestId: "r1", appointmentId: "a1", services: ["Bath"] };
  it("reads like the brief's examples", () => {
    expect(renderNotification("request_confirmed", d).title).toBe("Good news! Biscuit's grooming appointment has been accepted by Alex.");
    expect(renderNotification("grooming_completed", d).title).toBe("Woof! Biscuit is ready for collection!");
    expect(renderNotification("request_open", d).body).toContain("Bath");
    expect(renderNotification("appointment_reminder", d).title).toContain("21 Nov, 10:00 am");
    expect(renderNotification("unknown", {}).title).toBe("Update");
  });
  it("links to the right place for each audience", () => {
    expect(notificationHref("request_confirmed", d, "customer")).toBe("/me/requests/r1");
    expect(notificationHref("request_open", d, "staff", "fluff")).toBe("/b/fluff/shifts");
    expect(notificationHref("request_accepted", d, "staff", "fluff")).toBe("/b/fluff/appointments/a1");
    expect(notificationHref("request_new", d, "staff", "fluff")).toBe("/b/fluff/requests");
  });
});
