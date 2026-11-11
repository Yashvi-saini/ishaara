import { cn } from "../../lib/cn";

export type HandStep = 1 | 2 | 3;

const FINGERS = [
  { x: 52, top: 44 },
  { x: 77, top: 30 },
  { x: 102, top: 38 },
  { x: 127, top: 58 },
];

export interface HandIllustrationProps {
  step: HandStep;
  className?: string;
}

export function HandIllustration({ step, className }: HandIllustrationProps) {
  const shape = "fill-surface stroke-ink";
  const changed = "fill-accent-soft stroke-accent";
  const fingersOpen = step < 3;
  const thumbTucked = step > 1;

  return (
    <svg viewBox="0 0 200 250" aria-hidden="true" className={cn("h-auto w-full", className)}>
      <rect x="70" y="200" width="60" height="44" rx="10" strokeWidth="3" className={shape} />
      <rect x="46" y="108" width="108" height="106" rx="26" strokeWidth="3" className={shape} />

      {!thumbTucked && (
        <rect
          x="20"
          y="118"
          width="26"
          height="74"
          rx="13"
          strokeWidth="3"
          transform="rotate(-32 46 192)"
          className={shape}
        />
      )}

      {fingersOpen &&
        FINGERS.map((finger) => (
          <rect
            key={finger.x}
            x={finger.x}
            y={finger.top}
            width="22"
            height={128 - finger.top}
            rx="11"
            strokeWidth="3"
            className={shape}
          />
        ))}

      {thumbTucked && (
        <rect
          x="58"
          y="150"
          width="84"
          height="26"
          rx="13"
          strokeWidth="3"
          className={step === 2 ? changed : shape}
        />
      )}

      {!fingersOpen &&
        FINGERS.map((finger) => (
          <rect
            key={finger.x}
            x={finger.x}
            y="104"
            width="22"
            height="62"
            rx="11"
            strokeWidth="3"
            className={changed}
          />
        ))}
    </svg>
  );
}
