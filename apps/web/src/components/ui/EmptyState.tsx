import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  tone?: "neutral" | "alert";
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = "neutral",
  className,
}: EmptyStateProps) {
  return (
    <div
      role={tone === "alert" ? "alert" : undefined}
      className={cn("flex flex-col items-center px-6 py-10 text-center", className)}
    >
      {Icon && (
        <Icon
          size={20}
          aria-hidden="true"
          className={tone === "alert" ? "text-alert" : "text-ink-faint"}
        />
      )}
      <p className={cn("text-sm font-semibold text-ink", Icon && "mt-3")}>{title}</p>
      {description !== undefined && (
        <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>
      )}
      {action !== undefined && <div className="mt-4">{action}</div>}
    </div>
  );
}
