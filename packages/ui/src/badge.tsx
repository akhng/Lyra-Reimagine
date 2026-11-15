import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "./cn";

const badge = cva("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", {
  variants: {
    tone: {
      neutral: "bg-surface-2 text-muted",
      primary: "bg-primary-tint text-primary-text",
      success: "bg-success-tint text-success",
      warning: "bg-warning-tint text-warning",
      danger: "bg-danger-tint text-danger",
      coral: "bg-coral-tint text-coral-text",
      sky: "bg-sky-tint text-ink",
      butter: "bg-butter-tint text-ink",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({ className, tone, ...props }: ComponentProps<"span"> & VariantProps<typeof badge>) {
  return <span className={cn(badge({ tone }), className)} {...props} />;
}
