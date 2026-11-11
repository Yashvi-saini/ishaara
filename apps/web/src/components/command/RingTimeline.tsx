import type { RingAttempt } from "@ishaara/server/types";
import { ringOutcome } from "../../lib/alerts";
import { formatSeconds, formatShortTime } from "../../lib/format";
import { StatusDot } from "../ui";

export interface RingTimelineProps {
  attempts: readonly RingAttempt[];
  now: number;
}

export function RingTimeline({ attempts, now }: RingTimelineProps) {
  if (attempts.length === 0) {
    return <p className="text-sm text-ink-muted">No guard has been rung yet.</p>;
  }
  const showRounds = attempts.some((attempt) => attempt.round > 1);

  return (
    <ol className="flex flex-col">
      {attempts.map((attempt, index) => {
        const view = ringOutcome(attempt);
        const ringing = attempt.outcome === "ringing";
        return (
          <li
            key={`${attempt.guardId}-${attempt.startedAt}-${index}`}
            className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-baseline gap-x-3 border-b border-line py-2 text-sm last:border-b-0"
          >
            <span className="text-ink-faint tabular-nums">
              {formatShortTime(attempt.startedAt)}
            </span>
            <span className="min-w-0">
              <span className="font-medium text-ink">{attempt.guardName}</span>
              {showRounds && <span className="text-ink-faint"> · round {attempt.round}</span>}
              {!attempt.reached && <span className="block text-ink-faint">Guard app not open</span>}
            </span>
            <StatusDot tone={view.tone} pulse={view.pulse}>
              {ringing ? `Ringing, ${formatSeconds(attempt.endsAt - now)} left` : view.label}
            </StatusDot>
          </li>
        );
      })}
    </ol>
  );
}
