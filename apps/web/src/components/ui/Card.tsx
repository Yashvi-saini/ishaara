import { createElement, type HTMLAttributes, type ReactNode, type Ref } from "react";
import { cn } from "../../lib/cn";

export type CardTone = "card" | "inverse" | "hero" | "sunken";

const tones: Record<CardTone, string> = {
  card: "bg-card text-ink",
  sunken: "bg-sunken text-ink",
  inverse: "bg-inverse text-inverse-ink dark:ring-1 dark:ring-white/[0.06]",
  hero: "hero-gradient",
};

export interface CardProps extends HTMLAttributes<HTMLElement> {
  tone?: CardTone;
  notch?: boolean | ReactNode;
  notchAt?: "left" | "right" | "center";
  tab?: boolean;
  notchClass?: string;
  as?: "section" | "div" | "article" | "aside" | "li";
  ref?: Ref<HTMLElement>;
}

export function Card({
  tone = "card",
  notch,
  notchAt = "right",
  tab = true,
  notchClass,
  className,
  children,
  as = "section",
  ref,
  ...rest
}: CardProps) {
  const position =
    notchAt === "left"
      ? "left-[14%] w-[42%]"
      : notchAt === "center"
        ? "left-[28%] w-[44%]"
        : "right-[6%] w-[46%]";
  return createElement(
    as,
    { ref, className: cn("relative isolate rounded-[26px]", tones[tone], className), ...rest },
    notch && tab && tone !== "hero" && (
      <span aria-hidden="true" className={cn("notch", position, notchClass)} />
    ),
    notch && typeof notch !== "boolean" && (
      <div className={cn("absolute top-3 z-10", notchAt === "left" ? "left-[18%]" : "right-[8%]")}>
        {notch}
      </div>
    ),
    children,
  );
}

export function Deck({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("group/deck relative flex flex-col pt-5", className)}>
      <div
        aria-hidden="true"
        className="absolute top-0 left-1/2 h-12 w-[calc(100%-72px)] -translate-x-1/2 rounded-t-[24px] bg-ink-3/45 transition-transform duration-300 group-hover/deck:-translate-y-1.5 dark:bg-white/[0.07]"
      />
      <div
        aria-hidden="true"
        className="absolute top-2.5 left-1/2 h-12 w-[calc(100%-36px)] -translate-x-1/2 rounded-t-[24px] bg-ink/70 transition-transform duration-300 group-hover/deck:-translate-y-1 dark:bg-white/[0.12]"
      />
      <div className="relative flex-1 [&>*]:h-full">{children}</div>
    </div>
  );
}

export interface CardHeadProps {
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  className?: string;
  id?: string;
}

export function CardHead({ title, sub, right, className, id }: CardHeadProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h2 id={id} className="text-[19px] font-medium tracking-[-0.03em] text-balance">
          {title}
        </h2>
        {sub && <p className="mt-1 text-[13px] leading-snug opacity-70">{sub}</p>}
      </div>
      {right}
    </div>
  );
}
