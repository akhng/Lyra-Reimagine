import { describe, expect, it } from "vitest";
import { icsEvent } from "./ics";

describe("icsEvent", () => {
  it("builds a valid single event with escaped text and UTC times", () => {
    const ics = icsEvent({ uid: "abc", startsAt: "2026-11-21T21:00:00.000Z", endsAt: "2026-11-21T22:15:00.000Z", title: "Groom for Max, Paws Studio", location: "1 Main St; Richmond", description: "Line one\nLine two", now: new Date("2026-11-15T00:00:00Z") });
    expect(ics).toContain("DTSTART:20261121T210000Z\r\n");
    expect(ics).toContain("DTEND:20261121T221500Z\r\n");
    expect(ics).toContain("SUMMARY:Groom for Max\\, Paws Studio\r\n");
    expect(ics).toContain("LOCATION:1 Main St\; Richmond\r\n");
    expect(ics).toContain("DESCRIPTION:Line one\\nLine two\r\n");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});
