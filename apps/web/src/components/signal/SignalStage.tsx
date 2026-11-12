import { cn } from "../../lib/cn";
import { SIGNAL_STEPS, SignalHand, type HandPose } from "./SignalHand";

const COLOURS = ["bg-accent", "bg-accent-mid", "bg-cream"];

export function SignalStage({
  pose,
  frame = true,
  className,
}: {
  pose: HandPose;
  frame?: boolean;
  className?: string;
}) {
  const step = SIGNAL_STEPS[pose - 1]!;
  return (
    <div className={cn("flex flex-col", frame && "glass rounded-[20px] p-4 sm:p-5", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-semibold text-white/90">Silent 3-step sequence</span>
        <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold text-white tabular">
          &lt; 2 s
        </span>
      </div>

      <div className="relative mt-2 flex min-h-[200px] flex-1 items-end justify-center">
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-1/2 left-1/2 size-44 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/15 blur-2xl transition-opacity duration-700",
            pose === 3 ? "opacity-100" : "opacity-0",
          )}
        />
        <span
          aria-hidden="true"
          className="absolute bottom-2 left-1/2 h-3.5 w-24 animate-shadow-float rounded-full bg-black/40 blur-md"
        />
        <SignalHand
          pose={pose}
          tone="light"
          className="tilt-layer relative h-[190px] animate-float [--depth:18px]"
        />
      </div>

      <ol className="mt-3 grid grid-cols-3 gap-1.5" aria-label="Signal steps">
        {SIGNAL_STEPS.map((item) => (
          <li key={item.pose} aria-current={item.pose === pose ? "step" : undefined}>
            <span
              className={cn(
                "block h-1.5 rounded-full transition-colors duration-500",
                item.pose <= pose ? COLOURS[item.pose - 1] : "bg-white/20",
              )}
            />
            <span
              className={cn(
                "mt-1.5 block text-[11px] font-semibold transition-colors duration-300",
                item.pose === pose ? "text-white" : "text-white/60",
              )}
            >
              {item.pose}. {item.short}
            </span>
          </li>
        ))}
      </ol>

      <p
        key={pose}
        className="mt-3 min-h-[2.5rem] animate-rise text-[12px] leading-snug text-white/85"
      >
        <b className="font-semibold text-white">{step.label}.</b> {step.hint}.
      </p>
    </div>
  );
}
