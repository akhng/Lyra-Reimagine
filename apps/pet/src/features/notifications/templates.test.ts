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

describe("gamification notifications", () => {
  it("celebrates milestones and points", () => {
    expect(renderNotification("achievement", { petName: "Mochi", count: 5 }).title).toBe("Congratulations! Mochi has completed 5 grooming sessions!");
    expect(renderNotification("achievement", { key: "five_star" }).body).toBe("Five-Star Grooming Champion");
    expect(renderNotification("points_earned", { points: 105, petName: "Mochi", businessName: "Fluff" }).title).toBe("+105 loyalty points!");
    expect(notificationHref("points_earned", {}, "customer")).toBe("/me/rewards");
    expect(notificationHref("review_new", {}, "staff", "fluff")).toBe("/b/fluff/reviews");
  });
});

describe("message notifications", () => {
  it("names the sender and links to the conversation for each side", () => {
    expect(renderNotification("message_new", { businessName: "Fluff & Fold" }).title).toBe("New message from Fluff & Fold");
    expect(renderNotification("message_new", { customerName: "Sarah" }).title).toBe("New message from Sarah");
    expect(notificationHref("message_new", { conversationId: "c1" }, "customer")).toBe("/me/messages/c1");
    expect(notificationHref("message_reported", { conversationId: "c1" }, "staff", "fluff")).toBe("/b/fluff/messages/c1");
  });
});
