import type { DetectorStatus } from "@ishaara/gesture";
import { cn } from "../../lib/cn";

const LABELS = ["Palm", "Thumb tucked", "Fingers folded"];
const COLOURS = ["bg-accent", "bg-accent-mid", "bg-cream"];

export function stageCopy(status: DetectorStatus, handsInView: number, doneText: string): string {
  if (status === "cooldown") return doneText;
  if (status === "step1") return "Step 1 seen. Now fold your fingers over your thumb";
  if (handsInView === 0) return "Watching. No hands in view";
  return "Watching. Show your palm with the thumb tucked in";
}

export function stageFilled(status: DetectorStatus): number {
  if (status === "cooldown") return 3;
  if (status === "step1") return 2;
  return 0;
}

export function SignalStageBar({
  status,
  handsInView,
  doneText,
  className,
}: {
  status: DetectorStatus;
  handsInView: number;
  doneText: string;
  className?: string;
}) {
  const filled = stageFilled(status);
  return (
    <div className={cn("glass-dark rounded-[18px] p-4 text-white", className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[14px] font-semibold" aria-live="polite">
          {stageCopy(status, handsInView, doneText)}
        </p>
        <span className="text-[11px] font-semibold text-white/70 tabular">{filled}/3</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {LABELS.map((label, index) => (
          <div key={label}>
            <div
              className={cn(
                "h-1.5 rounded-full transition-colors duration-300",
                index < filled ? COLOURS[index] : "bg-white/15",
              )}
            />
            <p
              className={cn(
                "mt-1.5 text-[11px] font-medium transition-colors",
                index < filled ? "text-white" : "text-white/65",
              )}
            >
              {label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
