import type { Metadata } from "next";
import { Crown, Search, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { Badge, EmptyState, Input, buttonVariants, cn } from "@lyra/ui";
import { requireBusiness } from "@lyra/platform/tenancy/context";
import { can } from "@lyra/platform/tenancy/roles";
import { PageHeader } from "@/components/PageHeader";
import { searchCustomers } from "@/features/customers/queries";
import { SEGMENTS, segmentsFor, type Segment } from "@/features/customers/schemas";
import { formatDay, localDate } from "@/lib/dates";
import { param } from "@/lib/params";

export const metadata: Metadata = { title: "Customers" };

const SEGMENT_LABEL: Record<Segment, string> = { all: "All", new: "New", returning: "Returning", vip: "VIP", inactive: "Inactive", due: "Due for a groom" };

export default async function Customers({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const q = param(sp.q).trim();
  const segment = (SEGMENTS as readonly string[]).includes(param(sp.segment)) ? (param(sp.segment) as Segment) : "all";
  const { business, role } = await requireBusiness(slug);
  const today = localDate(business.timezone);
  const all = await searchCustomers(business.id, q);
  const withSegments = all.map((c) => ({ ...c, segments: segmentsFor(c, today) }));
  const rows = withSegments.filter((c) => c.segments.includes(segment));
  const counts = Object.fromEntries(SEGMENTS.map((s) => [s, withSegments.filter((c) => c.segments.includes(s)).length]));
  const canAdd = can(role, "customers.contact");
  const href = (s: Segment) => `/b/${slug}/customers?${new URLSearchParams({ ...(q ? { q } : {}), ...(s !== "all" ? { segment: s } : {}) })}`;
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <PageHeader
        title="Customers"
        description="Pet owners, their pets and when they're next due."
        actions={canAdd ? <Link href={`/b/${slug}/customers/new`} className={buttonVariants()}><UserPlus className="size-4" aria-hidden /> Add customer</Link> : null}
      />
      <form role="search" className="flex gap-2" action={`/b/${slug}/customers`}>
        {segment !== "all" ? <input type="hidden" name="segment" value={segment} /> : null}
        <label htmlFor="q" className="sr-only">Search customers</label>
        <Input id="q" name="q" type="search" defaultValue={q} placeholder={canAdd ? "Name, pet, email or mobile" : "Name or pet"} className="flex-1" />
        <button type="submit" className={buttonVariants({ variant: "secondary" })}><Search className="size-4" aria-hidden /> Search</button>
      </form>
      <nav aria-label="Customer segments" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {SEGMENTS.map((s) => (
          <Link key={s} href={href(s)} aria-current={s === segment ? "page" : undefined} className={cn("inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium", s === segment ? "border-primary bg-primary text-primary-contrast" : "border-border bg-surface hover:bg-surface-2")}>
            {SEGMENT_LABEL[s]} <span className="tabular opacity-80">{counts[s]}</span>
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title={all.length === 0 && !q ? "No customers yet" : "No matching customers"}
          description={all.length === 0 && !q ? "Add your first customer and their pets to start keeping grooming history." : "Try a different search or segment."}
          action={all.length === 0 && !q && canAdd ? <Link href={`/b/${slug}/customers/new`} className={buttonVariants()}>Add customer</Link> : undefined}
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
          {rows.map((c) => (
            <li key={c.id}>
              <Link href={`/b/${slug}/customers/${c.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4 hover:bg-surface-2">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-semibold">
                    {c.first_name} {c.last_name ?? ""}
                    {c.is_vip ? <Crown className="size-4 text-warning" aria-label="VIP" /> : null}
                  </span>
                  <span className="block truncate text-sm text-muted">{c.pet_names.length ? c.pet_names.join(", ") : "No pets yet"}</span>
                </span>
                <span className="flex flex-wrap items-center gap-2 text-sm text-muted">
                  {c.segments.includes("due") ? <Badge tone="warning">Due</Badge> : null}
                  {c.segments.includes("new") ? <Badge tone="primary">New</Badge> : null}
                  <span className="tabular">{c.last_groomed_on ? `Last groom ${formatDay(c.last_groomed_on)}` : "Not groomed yet"}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
