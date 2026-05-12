import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link, { type LinkProps } from "next/link";

import { cn } from "@/utils/cn";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-0 disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-white hover:shadow-[0_0_0_1px_rgba(59,130,246,0.6),0_0_28px_rgba(59,130,246,0.18)]",
  secondary:
    "bg-card text-foreground border border-border hover:border-accent/40 hover:shadow-[0_0_0_1px_rgba(59,130,246,0.35),0_0_22px_rgba(59,130,246,0.10)]",
  ghost: "text-foreground hover:bg-white/5",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-sm",
};

export function Button({
  className,
  variant = "secondary",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  );
}

export function ButtonLink({
  className,
  variant = "secondary",
  size = "md",
  ...props
}: LinkProps & {
  children: ReactNode;
  className?: string;
  variant?: Variant;
  size?: Size;
}) {
  return (
    <Link
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  );
}
