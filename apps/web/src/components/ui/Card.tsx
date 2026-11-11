import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export type CardTone = "none" | "alert" | "ringing" | "ok" | "accent";

const toneBorders: Record<CardTone, string> = {
  none: "",
  alert: "border-l-4 border-l-alert",
  ringing: "border-l-4 border-l-ringing-mark",
  ok: "border-l-4 border-l-ok",
  accent: "border-l-4 border-l-accent",
};

export interface CardProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  tone?: CardTone;
  padded?: boolean;
  className?: string;
  children?: ReactNode;
  as?: "section" | "div" | "article";
}

export function Card({
  title,
  description,
  actions,
  tone = "none",
  padded = true,
  className,
  children,
  as: Tag = "section",
}: CardProps) {
  const hasHeader = title !== undefined || actions !== undefined;
  return (
    <Tag className={cn("rounded-md border border-line bg-surface", toneBorders[tone], className)}>
      {hasHeader && (
        <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {title !== undefined && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
            {description !== undefined && (
              <p className="mt-0.5 text-sm text-ink-muted">{description}</p>
            )}
          </div>
          {actions !== undefined && <div className="flex shrink-0 gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn(padded && "p-4")}>{children}</div>
    </Tag>
  );
}
