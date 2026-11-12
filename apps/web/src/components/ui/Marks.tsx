import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export function IconTile({
  icon: Icon,
  className,
  size = "md",
}: {
  icon: LucideIcon;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const box = { sm: "size-8", md: "size-10", lg: "size-12" }[size];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[12px] bg-tile text-white dark:ring-1 dark:ring-white/10",
        box,
        className,
      )}
    >
      <Icon
        aria-hidden="true"
        className={size === "lg" ? "size-5.5" : "size-[18px]"}
        strokeWidth={2}
      />
    </span>
  );
}

export function Dashes({
  filled = 3,
  className,
  light,
}: {
  filled?: number;
  className?: string;
  light?: boolean;
}) {
  const on = ["bg-accent", "bg-accent-mid", "bg-cream"];
  const off = light ? "bg-white/25" : "bg-ink/10 dark:bg-white/12";
  return (
    <span className={cn("inline-flex items-center gap-1", className)} aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className={cn(
            "h-[5px] rounded-full transition-[width,background-color] duration-300",
            index === 2 ? "w-4" : "w-3.5",
            index < filled ? on[index] : off,
          )}
        />
      ))}
    </span>
  );
}

export function Dot({ className, pulse }: { className?: string; pulse?: boolean }) {
  return (
    <span aria-hidden="true" className="relative inline-flex size-2 shrink-0">
      {pulse && (
        <span className={cn("absolute inset-0 animate-ping-soft rounded-full", className)} />
      )}
      <span className={cn("relative inline-flex size-2 rounded-full", className)} />
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-card px-1.5 font-sans text-[11px] font-bold text-ink-2 shadow-[0_1px_0_var(--line),inset_0_0_0_1px_var(--line)]">
      {children}
    </kbd>
  );
}

export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect x="3" y="3" width="26" height="26" rx="9" fill="currentColor" />
      <path
        d="M10.5 23V13.2M14.2 23V9.6M17.9 23V9.6M21.6 23V12"
        stroke="var(--shell)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <rect x="8.8" y="16.8" width="14.6" height="3.6" rx="1.8" fill="var(--accent)" />
    </svg>
  );
}

export function CheckBadge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-gold text-on-gold",
        className,
      )}
    >
      {children}
    </span>
  );
}
