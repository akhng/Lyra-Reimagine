/** A single-event iCalendar file (RFC 5545) for "Add to calendar". Pure. */
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Folds lines longer than 75 octets (approximated by characters). */
const fold = (line: string) => (line.length <= 75 ? line : line.match(/.{1,74}/g)?.join("\r\n ") ?? line);

export function icsEvent(e: { uid: string; startsAt: string; endsAt: string; title: string; location: string | null; description: string | null; now?: Date }): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Lyra Reimagine//Lyra Pet//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.uid}@lyrapet`,
    `DTSTAMP:${stamp((e.now ?? new Date()).toISOString())}`,
    `DTSTART:${stamp(e.startsAt)}`,
    `DTEND:${stamp(e.endsAt)}`,
    `SUMMARY:${esc(e.title)}`,
    ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
    ...(e.description ? [`DESCRIPTION:${esc(e.description)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(fold).join("\r\n")}\r\n`;
}
