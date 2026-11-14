import type { Metadata } from "next";
import { Crown, Mail, MapPin, Pencil, Phone, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, CardTitle, EmptyState, buttonVariants } from "@lyra/ui";
import { requireBusiness } from "@lyra/platform/tenancy/context";
import { can } from "@lyra/platform/tenancy/roles";
import { PageHeader } from "@/components/PageHeader";
import { PetAvatar } from "@/components/PetAvatar";
import { getCustomer } from "@/features/customers/queries";
import { signPaths } from "@/features/grooming/queries";
import { listTeam } from "@/features/team/queries";
import { formatDay } from "@/lib/dates";
import { uuidOr404 } from "@/lib/params";

export const metadata: Metadata = { title: "Customer" };

const CONTACT_LABEL: Record<string, string> = { sms: "SMS", email: "Email", phone: "Phone call" };

export default async function CustomerProfile({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id: rawId } = await params;
  const id = uuidOr404(rawId);
  const { business, role } = await requireBusiness(slug);
  const seeContact = can(role, "customers.contact");
  const [data, team] = await Promise.all([getCustomer(business.id, id, seeContact), listTeam(business.id)]);
  if (!data) notFound();
  const { customer: c, contact, pets } = data;
  const urls = await signPaths(pets.flatMap((p) => (p.photo_path ? [p.photo_path] : [])));
  const groomer = team.find((m) => m.id === c.preferred_groomer_id)?.name;
  const address = contact ? [contact.address_line, contact.suburb, contact.state, contact.postcode].filter(Boolean).join(", ") : "";
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <PageHeader
        back={{ href: `/b/${slug}/customers`, label: "Customers" }}
        title={<span className="flex items-center gap-2">{c.first_name} {c.last_name ?? ""}{c.is_vip ? <Badge tone="warning"><Crown className="size-3.5" aria-hidden /> VIP</Badge> : null}</span>}
        description={`Customer since ${formatDay(c.created_at.slice(0, 10))}`}
        actions={seeContact ? <Link href={`/b/${slug}/customers/${c.id}/edit`} className={buttonVariants({ variant: "secondary" })}><Pencil className="size-4" aria-hidden /> Edit</Link> : null}
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <section aria-labelledby="pets-title" className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 id="pets-title" className="font-display text-xl font-semibold text-navy">Pets</h2>
            <Link href={`/b/${slug}/pets/new?customer=${c.id}`} className={buttonVariants({ variant: "secondary" })}><Plus className="size-4" aria-hidden /> Add pet</Link>
          </div>
          {pets.length === 0 ? (
            <EmptyState title="No pets yet" description="Add a pet to record their grooming preferences, care information and history." />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {pets.map((p) => (
                <li key={p.id}>
                  <Link href={`/b/${slug}/pets/${p.id}`} className="flex items-center gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)] hover:border-primary">
                    <PetAvatar url={p.photo_path ? (urls.get(p.photo_path) ?? null) : null} species={p.species} />
                    <span className="min-w-0">
                      <span className="block font-semibold">{p.name}</span>
                      <span className="block truncate text-sm text-muted">{[p.breed, p.size].filter(Boolean).join(" · ") || p.species}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <div className="flex flex-col gap-4">
          {seeContact ? (
            <Card aria-labelledby="contact-title">
              <CardTitle id="contact-title">Contact</CardTitle>
              <dl className="mt-3 flex flex-col gap-2 text-sm">
                {contact?.mobile ? <div className="flex items-center gap-2"><dt><Phone className="size-4 text-muted" aria-label="Mobile" /></dt><dd><a href={`tel:${contact.mobile.replace(/\s/g, "")}`} className="text-primary-text underline-offset-4 hover:underline">{contact.mobile}</a></dd></div> : null}
                {contact?.email ? <div className="flex items-center gap-2"><dt><Mail className="size-4 text-muted" aria-label="Email" /></dt><dd className="break-all"><a href={`mailto:${contact.email}`} className="text-primary-text underline-offset-4 hover:underline">{contact.email}</a></dd></div> : null}
                {address ? <div className="flex items-start gap-2"><dt><MapPin className="size-4 text-muted" aria-label="Address" /></dt><dd>{address}</dd></div> : null}
                {!contact?.mobile && !contact?.email && !address ? <p className="text-muted">No contact details yet.</p> : null}
              </dl>
              <p className="mt-3 text-sm text-muted">Prefers {CONTACT_LABEL[c.preferred_contact] ?? c.preferred_contact}. {c.marketing_consent && c.marketing_consent_at ? `Marketing OK since ${formatDay(c.marketing_consent_at.slice(0, 10))}.` : "No marketing consent."}</p>
            </Card>
          ) : (
            <Card>
              <p className="text-sm text-muted">Contact details are visible to owners, managers and reception.</p>
            </Card>
          )}
          <Card aria-labelledby="notes-title">
            <CardTitle id="notes-title">Notes</CardTitle>
            <p className="mt-2 text-sm whitespace-pre-line">{c.notes || <span className="text-muted">No notes.</span>}</p>
            {groomer ? <p className="mt-3 text-sm text-muted">Preferred groomer: {groomer}</p> : null}
          </Card>
        </div>
      </div>
    </div>
  );
}
