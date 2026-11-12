import { useEffect, useState, type CSSProperties } from "react";
import { cn } from "../../lib/cn";
import { useReducedMotion } from "../../lib/motion";

export type HandPose = 1 | 2 | 3;

export const SIGNAL_STEPS: { pose: HandPose; short: string; label: string; hint: string }[] = [
  { pose: 1, short: "Palm", label: "Show your palm", hint: "Open hand to the camera" },
  { pose: 2, short: "Thumb in", label: "Tuck your thumb", hint: "Fold thumb across palm" },
  { pose: 3, short: "Fold", label: "Trap with fingers", hint: "Close fingers over thumb" },
];

const FINGERS = [
  { x: 53, top: 44 },
  { x: 75, top: 26 },
  { x: 97, top: 34 },
  { x: 119, top: 56 },
];

const EASE = "cubic-bezier(0.2, 0.7, 0.2, 1)";
const HOLD_MS: Record<HandPose, number> = { 1: 1500, 2: 1200, 3: 2100 };

function motion(animate: boolean, delayMs = 0): CSSProperties {
  if (!animate) return {};
  return {
    transition: `transform 520ms ${EASE} ${delayMs}ms, fill 320ms ease ${delayMs}ms, opacity 320ms ease ${delayMs}ms`,
  };
}

export function SignalHand({
  pose,
  tone = "ink",
  animate = true,
  className,
}: {
  pose: HandPose;
  tone?: "ink" | "light";
  animate?: boolean;
  className?: string;
}) {
  const body = tone === "ink" ? "var(--ink)" : "rgb(255 255 255 / 0.94)";
  const accent = "var(--accent)";
  const folded = pose === 3;

  return (
    <svg viewBox="0 0 200 240" fill="none" aria-hidden="true" className={cn("w-auto", className)}>
      <rect x="70" y="190" width="60" height="50" rx="14" fill={body} />
      <rect
        x="30"
        y="110"
        width="22"
        height="64"
        rx="11"
        fill={body}
        style={{
          transformBox: "fill-box",
          transformOrigin: "50% 50%",
          transform: pose === 1 ? "rotate(-24deg)" : "translate(18px, -4px) rotate(14deg)",
          opacity: pose === 1 ? 1 : 0,
          ...motion(animate),
        }}
      />
      <rect
        x="53"
        y="104"
        width="86"
        height="98"
        rx="34"
        fill={body}
        style={{
          transformBox: "fill-box",
          transformOrigin: "50% 50%",
          transform: folded ? "translateY(-6px) scale(1.093, 1.122)" : "none",
          ...motion(animate),
        }}
      />
      <rect
        x="62"
        y="146"
        width="68"
        height="22"
        rx="11"
        fill={accent}
        style={{
          transformBox: "fill-box",
          transformOrigin: "0% 50%",
          transform: pose === 1 ? "scaleX(0)" : "none",
          opacity: pose === 2 ? 1 : 0,
          ...motion(animate, pose === 2 ? 120 : 0),
        }}
      />
      {FINGERS.map((finger, index) => {
        const height = 140 - finger.top;
        return (
          <rect
            key={finger.x}
            x={finger.x}
            y={finger.top}
            width="20"
            height={height}
            rx="10"
            fill={folded ? accent : body}
            style={{
              transformBox: "fill-box",
              transformOrigin: "50% 100%",
              transform: folded ? `translateY(8px) scaleY(${(52 / height).toFixed(3)})` : "none",
              ...motion(animate, folded ? index * 45 : (3 - index) * 30),
            }}
          />
        );
      })}
    </svg>
  );
}

export function useSignalLoop(active = true): HandPose {
  const reduced = useReducedMotion();
  const [pose, setPose] = useState<HandPose>(1);

  useEffect(() => {
    if (!active || reduced) return;
    const timer = window.setTimeout(
      () => setPose((current) => (current === 3 ? 1 : ((current + 1) as HandPose))),
      HOLD_MS[pose],
    );
    return () => window.clearTimeout(timer);
  }, [pose, active, reduced]);

  return reduced ? 2 : pose;
}
