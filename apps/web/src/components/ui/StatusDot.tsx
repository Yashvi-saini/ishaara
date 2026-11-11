import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export type StatusTone = "neutral" | "accent" | "alert" | "ringing" | "ok";

const dotColours: Record<StatusTone, string> = {
  neutral: "bg-line-strong",
  accent: "bg-accent",
  alert: "bg-alert",
  ringing: "bg-ringing-mark",
  ok: "bg-ok",
};

const textColours: Record<StatusTone, string> = {
  neutral: "text-ink-muted",
  accent: "text-ink",
  alert: "text-alert",
  ringing: "text-ringing",
  ok: "text-ok",
};

export interface StatusDotProps {
  tone: StatusTone;
  children: ReactNode;
  pulse?: boolean;
  strong?: boolean;
  className?: string;
}

export function StatusDot({
  tone,
  children,
  pulse = false,
  strong = false,
  className,
}: StatusDotProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", textColours[tone], className)}>
      <span
        aria-hidden="true"
        className={cn(
          "size-2 shrink-0 rounded-full",
          dotColours[tone],
          pulse && "animate-ring-pulse",
        )}
      />
      <span className={cn(strong && "font-semibold")}>{children}</span>
    </span>
  );
}
