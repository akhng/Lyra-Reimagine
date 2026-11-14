import { z } from "zod";
import { slugProblem } from "@lyra/platform/tenancy/slug";

/** Australian time zones offered at sign-up (all are valid IANA names; the database checks too). */
export const AU_TIMEZONES = [
  { value: "Australia/Sydney", label: "Sydney, Canberra (NSW, ACT)" },
  { value: "Australia/Melbourne", label: "Melbourne (VIC)" },
  { value: "Australia/Brisbane", label: "Brisbane (QLD)" },
  { value: "Australia/Adelaide", label: "Adelaide (SA)" },
  { value: "Australia/Perth", label: "Perth (WA)" },
  { value: "Australia/Hobart", label: "Hobart (TAS)" },
  { value: "Australia/Darwin", label: "Darwin (NT)" },
] as const;

export const createBusinessSchema = z.object({
  name: z.string().trim().min(2, "Enter your business name").max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .superRefine((s, ctx) => {
      const p = slugProblem(s);
      if (p === "format") ctx.addIssue({ code: "custom", message: "Use 3–40 lowercase letters, numbers and single hyphens" });
      if (p === "reserved") ctx.addIssue({ code: "custom", message: "That link is reserved — try another" });
    }),
  timezone: z.enum(AU_TIMEZONES.map((t) => t.value) as [string, ...string[]], { message: "Choose your time zone" }),
  locationName: z.string().trim().max(80).optional(),
});

const optionalText = (max: number) => z.string().trim().max(max).transform((v) => (v === "" ? null : v));

export const businessDetailsSchema = z.object({
  name: z.string().trim().min(2, "Enter your business name").max(120),
  timezone: createBusinessSchema.shape.timezone,
  abn: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s+/g, ""))
    .refine((v) => v === "" || /^\d{11}$/.test(v), "An ABN has 11 digits")
    .transform((v) => (v === "" ? null : v)),
  gstRegistered: z.boolean(),
  phone: optionalText(30),
  email: z.union([z.literal(""), z.email("Enter a valid email address")]).transform((v) => (v === "" ? null : v)),
});

export const locationSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Give the location a name").max(80),
  addressLine: optionalText(200),
  suburb: optionalText(80),
  state: z.enum(["", "NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"]).transform((v) => (v === "" ? null : v)),
  postcode: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{4}$/.test(v), "Postcodes have 4 digits")
    .transform((v) => (v === "" ? null : v)),
  isMobile: z.boolean(),
});
