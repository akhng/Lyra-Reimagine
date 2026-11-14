/**
 * Roles and permissions inside a business (tenant). The database enforces
 * the same rules with Row Level Security (public.has_business_role); this
 * module drives the UI and server-side checks so they never disagree.
 */
export const ROLES = ["owner", "manager", "receptionist", "groomer"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = {
  /** Business name, ABN, GST, time zone, policies. */
  "business.edit": ["owner", "manager"],
  /** Add, edit and archive locations. */
  "locations.manage": ["owner", "manager"],
  /** See the team list. */
  "team.view": ["owner", "manager", "receptionist", "groomer"],
  /** Invite people and change roles. Only owners can create other owners. */
  "team.manage": ["owner", "manager"],
  /** Customer contact details (phone, email, address). Groomers see names only. */
  "customers.contact": ["owner", "manager", "receptionist"],
  /** Pet care information needed to groom safely. */
  "pets.care": ["owner", "manager", "receptionist", "groomer"],
  /** Payments, refunds and outstanding balances. */
  "payments.manage": ["owner", "manager", "receptionist"],
  /** Business-wide reports and analytics. */
  "reports.view": ["owner", "manager"],
  /** Subscription plan and billing. */
  "billing.manage": ["owner"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | null | undefined, permission: Permission): boolean {
  return !!role && (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

/** Managers may assign any role except owner; owners may assign any role. */
export function canAssignRole(actor: Role, target: Role): boolean {
  if (actor === "owner") return true;
  return actor === "manager" && target !== "owner";
}

export const isRole = (v: unknown): v is Role => typeof v === "string" && (ROLES as readonly string[]).includes(v);
