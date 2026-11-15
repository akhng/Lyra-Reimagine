import { z } from "zod";

/** Scheduling inputs, validated at the server-action boundary. */
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 09:30");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date");
const optionalText = (max: number) => z.string().trim().max(max).transform((v) => (v === "" ? null : v));

export const STATUSES = ["booked", "confirmed", "checked_in", "in_progress", "completed", "cancelled", "no_show"] as const;
export type AppointmentStatus = (typeof STATUSES)[number];
/** Statuses a groomer may set on their own appointments (the database enforces the same). */
export const GROOMER_STATUSES: readonly AppointmentStatus[] = ["checked_in", "in_progress", "completed", "no_show"];

export const appointmentSchema = z.object({
  customerId: z.uuid({ message: "Choose a customer" }),
  petId: z.uuid({ message: "Choose a pet" }),
  locationId: z.uuid({ message: "Choose a location" }),
  groomerId: z.uuid({ message: "Choose a groomer" }),
  serviceIds: z.array(z.uuid()).min(1, "Choose at least one service").max(5).transform((ids) => [...new Set(ids)]),
  date: isoDate,
  time: hhmm,
  notes: optionalText(2000),
  coatConditions: z.array(z.string().max(40)).max(4).default([]),
  repeatWeeks: z.coerce.number().int().min(0).max(26).default(0),
  occurrences: z.coerce.number().int().min(1).max(26).default(1),
});

export const rescheduleSchema = z.object({ id: z.uuid(), date: isoDate, time: hhmm, groomerId: z.uuid() });
export const moveSchema = z.object({ id: z.uuid(), startsAt: z.iso.datetime({ offset: true }), groomerId: z.uuid() });
export const statusSchema = z.object({ id: z.uuid(), status: z.enum(STATUSES), reason: z.string().trim().max(300).optional() });
export const notesSchema = z.object({ id: z.uuid(), notes: optionalText(2000) });

const dayHours = z.object({ weekday: z.number().int().min(1).max(7), opens: hhmm, closes: hhmm }).refine((h) => h.closes > h.opens, { message: "Closing time must be after opening time" });
export const locationHoursSchema = z.object({ locationId: z.uuid(), hours: z.array(dayHours).max(21) });
const staffDay = z.object({ weekday: z.number().int().min(1).max(7), locationId: z.uuid(), starts: hhmm, ends: hhmm }).refine((h) => h.ends > h.starts, { message: "Finish time must be after start time" });
export const staffHoursSchema = z.object({ memberId: z.uuid(), hours: z.array(staffDay).max(21) });
export const timeOffSchema = z
  .object({ memberId: z.uuid({ message: "Choose a team member" }), startDate: isoDate, startTime: hhmm, endDate: isoDate, endTime: hhmm, reason: optionalText(200) })
  .refine((v) => `${v.endDate}T${v.endTime}` > `${v.startDate}T${v.startTime}`, { message: "The end must be after the start", path: ["endDate"] });
export const closureSchema = z
  .object({ locationId: z.union([z.literal(""), z.uuid()]).transform((v) => (v === "" ? null : v)), startsOn: isoDate, endsOn: isoDate, reason: optionalText(120) })
  .refine((v) => v.endsOn >= v.startsOn, { message: "The last day can't be before the first", path: ["endsOn"] });
export const policySchema = z.object({
  onlineEnabled: z.boolean(),
  minNoticeMinutes: z.coerce.number().int().min(0).max(20160),
  maxDaysAhead: z.coerce.number().int().min(1).max(365),
  slotStepMinutes: z.coerce.number().pipe(z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20), z.literal(30), z.literal(60)])),
  cancellationHours: z.coerce.number().int().min(0).max(336),
  policyText: optionalText(2000),
});
export const waitlistSchema = z
  .object({ customerId: z.uuid({ message: "Choose a customer" }), petId: z.uuid({ message: "Choose a pet" }), serviceIds: z.array(z.uuid()).max(10).default([]), preferredGroomerId: z.union([z.literal(""), z.uuid()]).transform((v) => (v === "" ? null : v)), earliestOn: isoDate, latestOn: isoDate, notes: optionalText(1000) })
  .refine((v) => v.latestOn >= v.earliestOn, { message: "The last date can't be before the first", path: ["latestOn"] });
export const waitlistStatusSchema = z.object({ id: z.uuid(), status: z.enum(["waiting", "offered", "booked", "cancelled"]) });

export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export const WEEKDAY_LABEL: Record<number, string> = { 1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday", 7: "Sunday" };
export const STATUS_LABEL: Record<AppointmentStatus, string> = { booked: "Booked", confirmed: "Confirmed", checked_in: "Checked in", in_progress: "In progress", completed: "Completed", cancelled: "Cancelled", no_show: "No-show" };
