import { z } from "zod";

/** The public booking context from `booking_context()` (no customer data), validated before use. */
const hhmm = z.string().regex(/^\d{2}:\d{2}$/);
export const bookingContextSchema = z.discriminatedUnion("online", [
  z.object({ online: z.literal(false), business: z.object({ name: z.string(), slug: z.string(), phone: z.string().nullable().optional(), email: z.string().nullable().optional() }) }),
  z.object({
    online: z.literal(true),
    business: z.object({ id: z.uuid(), name: z.string(), slug: z.string(), timezone: z.string(), phone: z.string().nullable(), email: z.string().nullable() }),
    policy: z.object({ minNoticeMinutes: z.number(), maxDaysAhead: z.number(), slotStepMinutes: z.number(), cancellationHours: z.number(), policyText: z.string().nullable() }),
    locations: z.array(z.object({ id: z.uuid(), name: z.string(), suburb: z.string().nullable(), addressLine: z.string().nullable(), timezone: z.string(), hours: z.array(z.object({ weekday: z.number(), opens: hhmm, closes: hhmm })) })),
    services: z.array(z.object({ id: z.uuid(), name: z.string(), description: z.string().nullable(), category: z.string().nullable(), durationMinutes: z.number(), bufferMinutes: z.number(), basePriceCents: z.number(), priceFrom: z.boolean(), rules: z.array(z.object({ kind: z.enum(["size", "breed"]), matchValue: z.string(), priceCents: z.number() })) })),
    groomers: z.array(z.object({ id: z.uuid(), name: z.string() })),
    staffHours: z.array(z.object({ memberId: z.uuid(), locationId: z.uuid(), weekday: z.number(), starts: hhmm, ends: hhmm })),
    busy: z.array(z.object({ memberId: z.uuid(), startsAt: z.string(), endsAt: z.string() })),
    closures: z.array(z.object({ locationId: z.uuid().nullable(), startsOn: z.string(), endsOn: z.string() })),
  }),
]);
export type BookingContext = z.infer<typeof bookingContextSchema>;
export type OnlineContext = Extract<BookingContext, { online: true }>;

export const bookingViewSchema = z.object({
  id: z.uuid(),
  status: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  business: z.object({ name: z.string(), slug: z.string(), phone: z.string().nullable(), email: z.string().nullable(), timezone: z.string() }),
  location: z.object({ id: z.uuid(), name: z.string(), addressLine: z.string().nullable(), suburb: z.string().nullable() }),
  pet: z.string(),
  groomer: z.string(),
  groomerId: z.uuid(),
  locationId: z.uuid(),
  blockMinutes: z.number(),
  serviceMinutes: z.number(),
  services: z.array(z.object({ name: z.string(), durationMinutes: z.number(), priceCents: z.number() })),
  priceCents: z.number().nullable(),
  priceFrom: z.boolean(),
  cancellationHours: z.number(),
  policyText: z.string().nullable(),
  changeable: z.boolean(),
});
export type BookingView = z.infer<typeof bookingViewSchema>;
