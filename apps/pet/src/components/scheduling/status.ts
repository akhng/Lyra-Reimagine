import type { AppointmentStatus } from "@/features/scheduling/schemas";

/** Badge tone per status (tokens via the Badge component). */
export const STATUS_TONE: Record<AppointmentStatus, "neutral" | "primary" | "success" | "warning" | "danger"> = {
  booked: "neutral",
  confirmed: "primary",
  checked_in: "warning",
  in_progress: "warning",
  completed: "success",
  cancelled: "danger",
  no_show: "danger",
};
