import type { Alert } from "@ishaara/server/types";
import { Check } from "lucide-react";
import { missedAttempts } from "../../lib/alerts";
import { cn } from "../../lib/cn";
import { formatShortTime } from "../../lib/format";

export function IncidentProgress({
  alert,
  tone = "inverse",
  className,
}: {
  alert: Alert;
  tone?: "inverse" | "card";
  className?: string;
}) {
  const notified = alert.attempts.find((attempt) => attempt.reached);
  const escalations = missedAttempts(alert).length;
  const steps = [
    { label: "Alert generated", at: alert.createdAt },
    {
      label: escalations ? `Escalated ×${escalations}` : "Guard notified",
      at: notified?.startedAt,
    },
    { label: "Accepted", at: alert.respondedAt ?? undefined },
    {
      label: alert.status === "false_alarm" ? "False alarm" : "Resolved",
      at: alert.closedAt ?? undefined,
    },
  ];
  const current = alert.closedAt ? -1 : steps.findIndex((step) => !step.at);
  const dim = tone === "card" ? "text-ink-3" : "text-inverse-ink-2";
  const lit = tone === "card" ? "text-ink" : "text-white";
  const off = tone === "card" ? "bg-ink/10 dark:bg-white/12" : "bg-white/15";

  return (
    <ol className={cn("grid grid-cols-4 gap-1.5", className)} aria-label="Incident progress">
      {steps.map((step, index) => {
        const done = step.at !== undefined;
        const now = index === current;
        return (
          <li key={step.label} aria-current={now ? "step" : undefined} className="min-w-0">
            <span
              className={cn(
                "flex h-1.5 rounded-full transition-colors duration-300",
                done ? (index === 1 && escalations ? "bg-accent" : "bg-gold") : off,
                now && "animate-breathe bg-accent",
              )}
            />
            <span
              className={cn(
                "mt-2 flex items-start gap-1 text-[11px] leading-tight font-semibold",
                done || now ? lit : dim,
              )}
            >
              {done && index === steps.length - 1 && (
                <Check aria-hidden="true" className="size-3 shrink-0" strokeWidth={3} />
              )}
              <span className="break-words">{step.label}</span>
            </span>
            <span className={cn("block text-[11px] tabular", dim)}>
              {step.at !== undefined ? formatShortTime(step.at) : now ? "Now" : "–"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
