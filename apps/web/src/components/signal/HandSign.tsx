import { cn } from "../../lib/cn";

export type HandPose = 1 | 2 | 3;

const FINGERS = [
  { x: 53, top: 44 },
  { x: 75, top: 26 },
  { x: 97, top: 34 },
  { x: 119, top: 56 },
];

export function HandSign({
  pose,
  tone = "ink",
  className,
}: {
  pose: HandPose;
  tone?: "ink" | "light";
  className?: string;
}) {
  const body = tone === "ink" ? "var(--ink)" : "rgb(255 255 255 / 0.94)";
  const accent = "var(--accent)";
  return (
    <svg viewBox="0 0 200 240" fill="none" aria-hidden="true" className={cn("w-auto", className)}>
      <rect x="70" y="190" width="60" height="50" rx="14" fill={body} />

      {pose === 1 && (
        <>
          {FINGERS.map((finger) => (
            <rect
              key={finger.x}
              x={finger.x}
              y={finger.top}
              width="20"
              height={140 - finger.top}
              rx="10"
              fill={body}
            />
          ))}
          <rect
            x="30"
            y="110"
            width="22"
            height="64"
            rx="11"
            fill={body}
            transform="rotate(-24 41 142)"
          />
          <rect x="53" y="104" width="86" height="98" rx="34" fill={body} />
        </>
      )}

      {pose === 2 && (
        <>
          {FINGERS.map((finger) => (
            <rect
              key={finger.x}
              x={finger.x}
              y={finger.top}
              width="20"
              height={140 - finger.top}
              rx="10"
              fill={body}
            />
          ))}
          <rect x="53" y="104" width="86" height="98" rx="34" fill={body} />
          <rect x="62" y="146" width="68" height="22" rx="11" fill={accent} />
        </>
      )}

      {pose === 3 && (
        <>
          <rect x="49" y="92" width="94" height="110" rx="38" fill={body} />
          {FINGERS.map((finger) => (
            <rect
              key={finger.x}
              x={finger.x - 2}
              y="96"
              width="20"
              height="52"
              rx="10"
              fill={accent}
            />
          ))}
        </>
      )}
    </svg>
  );
}
