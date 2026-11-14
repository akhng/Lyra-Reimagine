"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { logger } from "@lyra/platform/logger";
import { createSupabaseServerClient } from "@lyra/platform/supabase/server";
import { requireBusiness } from "@lyra/platform/tenancy/context";
import { can } from "@lyra/platform/tenancy/roles";
import { fieldErrors, text, type FormState } from "@/lib/form";
import { contactSchema, customerSchema } from "./schemas";

function parse(form: FormData) {
  const customer = customerSchema.safeParse({ firstName: text(form, "firstName"), lastName: text(form, "lastName"), preferredContact: text(form, "preferredContact") || "sms", preferredGroomerId: text(form, "preferredGroomerId"), notes: text(form, "notes"), isVip: form.get("isVip") === "on", marketingConsent: form.get("marketingConsent") === "on" });
  const contact = contactSchema.safeParse({ email: text(form, "email"), mobile: text(form, "mobile"), addressLine: text(form, "addressLine"), suburb: text(form, "suburb"), state: text(form, "state"), postcode: text(form, "postcode") });
  return { customer, contact };
}

/** Create or update a customer and their contact details (owner, manager, receptionist). */
export async function saveCustomerAction(slug: string, customerId: string | null, _prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireBusiness(slug);
  if (!can(ctx.role, "customers.contact")) return { error: "Only owners, managers and reception can add or edit customers." };
  const { customer, contact } = parse(form);
  if (!customer.success || !contact.success) return { fields: { ...(customer.success ? {} : fieldErrors(customer.error.issues)), ...(contact.success ? {} : fieldErrors(contact.error.issues)) } };
  const c = customer.data;
  const db = await createSupabaseServerClient();
  const row = { first_name: c.firstName, last_name: c.lastName, preferred_contact: c.preferredContact, preferred_groomer_id: c.preferredGroomerId, notes: c.notes, is_vip: c.isVip, marketing_consent: c.marketingConsent };
  let id = customerId;
  if (id) {
    const { data: before } = await db.from("customers").select("marketing_consent").eq("id", id).eq("business_id", ctx.business.id).single();
    // Record when consent was given (Spam Act evidence); clear it when withdrawn.
    const consentAt = c.marketingConsent ? (before?.marketing_consent ? undefined : new Date().toISOString()) : null;
    const { error } = await db.from("customers").update({ ...row, ...(consentAt !== undefined ? { marketing_consent_at: consentAt } : {}) }).eq("id", id).eq("business_id", ctx.business.id);
    if (error) return failed("update customer", error.code, ctx.business.id);
    const { error: ce } = await db.from("customer_contacts").upsert({ customer_id: id, business_id: ctx.business.id, ...contactRow(contact.data) });
    if (ce) return failed("save contact", ce.code, ctx.business.id);
  } else {
    const { data, error } = await db.from("customers").insert({ ...row, business_id: ctx.business.id, created_by: ctx.userId, marketing_consent_at: c.marketingConsent ? new Date().toISOString() : null }).select("id").single();
    if (error || !data) return failed("create customer", error?.code, ctx.business.id);
    id = data.id;
    const { error: ce } = await db.from("customer_contacts").insert({ customer_id: id, business_id: ctx.business.id, ...contactRow(contact.data) });
    if (ce) return failed("create contact", ce.code, ctx.business.id);
  }
  revalidatePath(`/b/${slug}/customers`);
  redirect(`/b/${slug}/customers/${id}`);
}

function contactRow(c: { email: string | null; mobile: string | null; addressLine: string | null; suburb: string | null; state: string | null; postcode: string | null }) {
  return { email: c.email, mobile: c.mobile, address_line: c.addressLine, suburb: c.suburb, state: c.state, postcode: c.postcode };
}

function failed(what: string, code: string | undefined, business: string): FormState {
  logger.error({ code, business }, `${what} failed`);
  return { error: "We couldn't save that. Please try again." };
}
