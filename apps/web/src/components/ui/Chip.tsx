import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export type ChipTone = "neutral" | "accent" | "soft" | "gold" | "glass" | "inverse" | "outline";
export type ChipSize = "sm" | "md" | "lg";

const tones: Record<ChipTone, string> = {
  neutral: "bg-sunken text-ink-2",
  accent: "bg-accent-fill text-white",
  soft: "bg-accent/12 text-accent-deep dark:text-peach",
  gold: "bg-gold/90 text-on-gold",
  glass: "glass-chip text-white",
  inverse: "bg-white/10 text-inverse-ink",
  outline: "ring-1 ring-line text-ink-2",
};

const sizes: Record<ChipSize, string> = {
  sm: "h-6 px-2.5 text-[11px]",
  md: "h-7 px-3 text-[12px]",
  lg: "h-10 px-4 text-[13px]",
};

export interface ChipProps {
  tone?: ChipTone;
  size?: ChipSize;
  className?: string;
  children: ReactNode;
}

export function Chip({ tone = "neutral", size = "md", className, children }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap",
        sizes[size],
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
