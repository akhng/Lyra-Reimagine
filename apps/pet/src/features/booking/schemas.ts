import { z } from "zod";

/** What a visitor submits on the booking page (validated here and again in the database). */
export const bookingInputSchema = z.object({
  locationId: z.uuid({ message: "Choose a location" }),
  groomerId: z.union([z.literal(""), z.uuid()]).transform((v) => (v === "" ? null : v)),
  serviceIds: z.array(z.uuid()).min(1, "Choose at least one service").max(5),
  startsAt: z.iso.datetime({ offset: true, message: "Choose a time" }),
  firstName: z.string().trim().min(1, "Enter your first name").max(80),
  lastName: z.string().trim().max(80),
  email: z.email("Enter a valid email address").max(254),
  mobile: z.string().trim().regex(/^\+?[0-9 ]{8,20}$/, "Enter your mobile number"),
  petName: z.string().trim().min(1, "Enter your pet's name").max(60),
  species: z.enum(["dog", "cat", "other"]),
  size: z.enum(["", "toy", "small", "medium", "large", "giant"]).transform((v) => (v === "" ? null : v)),
  breed: z.string().trim().max(80),
  notes: z.string().trim().max(1000),
  marketingConsent: z.boolean(),
  agree: z.literal(true, { message: "Please agree to the booking policy" }),
  // Spam guards: a hidden field people never fill, and how long the form was open.
  website: z.string().max(0).optional(),
  openedAt: z.number(),
});
export type BookingInput = z.input<typeof bookingInputSchema>;

/** Database errors from the booking functions → what the visitor sees. */
export const BOOKING_ERRORS: Record<string, string> = {
  slot_unavailable: "Sorry, that time was just taken. Please choose another.",
  outside_window: "That time is no longer available to book online. Please choose another.",
  rate_limited: "Too many booking attempts. Please try again later or contact the salon.",
  online_off: "This salon isn't taking online bookings right now.",
  invalid_services: "One of those services can't be booked online any more. Please choose again.",
  invalid_email: "Enter a valid email address.",
  invalid_mobile: "Enter your mobile number.",
  too_late: "It's too close to the appointment to change it online. Please contact the salon.",
  not_found: "We couldn't find that booking.",
};
