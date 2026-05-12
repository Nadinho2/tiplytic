import type { HTMLAttributes } from "react";

import { cn } from "@/utils/cn";

type Variant = "default" | "success" | "danger" | "warning";

const variants: Record<Variant, string> = {
  default: "border-accent/25 bg-accent-soft text-foreground",
  success: "border-emerald-500/25 bg-emerald-500/10 text-emerald-500",
  danger: "border-red-500/25 bg-red-500/10 text-red-500",
  warning: "border-amber-500/25 bg-amber-500/10 text-amber-500",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
