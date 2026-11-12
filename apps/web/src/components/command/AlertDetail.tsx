import type { Alert, AlertOutcome, RingAttempt } from "@ishaara/server/types";
import { ArrowLeft, Camera, Check, CircleCheck, ImageOff, Phone, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  alertStatus,
  cameraCode,
  cameraNumber,
  currentRing,
  forwardedFrom,
  incidentCode,
  isOpen,
  missedAttempts,
  needsResponder,
  toneDot,
} from "../../lib/alerts";
import { cn } from "../../lib/cn";
import { formatElapsed, formatSeconds, formatShortTime, formatTime } from "../../lib/format";
import { IncidentProgress } from "../signal/IncidentProgress";
import { Button, buttonClasses, CheckBadge, Chip, Dialog, Dot } from "../ui";

const CONFIRM: Record<AlertOutcome, { title: string; description: string; action: string }> = {
  resolved: {
    title: "Resolve this alert?",
    description:
      "Resolve when a guard has reached her and she is safe. The alert is kept in the log for the campus safety report.",
    action: "Resolve alert",
  },
  false_alarm: {
    title: "Mark as false alarm?",
    description:
      "Use this when a guard has checked and nobody needed help. Ringing stops and the alert is kept in the log.",
    action: "Mark false alarm",
  },
};

export interface AlertDetailProps {
  alert: Alert;
  now: number;
  history: boolean;
  hasLive: boolean;
  onBack: () => void;
  onClose: (outcome: AlertOutcome) => Promise<string | null>;
}

export function AlertDetail({ alert, now, history, hasLive, onBack, onClose }: AlertDetailProps) {
  const [confirming, setConfirming] = useState<AlertOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [ripple, setRipple] = useState(0);
  const previousStatus = useRef(alert.status);

  useEffect(() => {
    if (previousStatus.current === alert.status) return;
    previousStatus.current = alert.status;
    setRipple((count) => count + 1);
  }, [alert.status]);

  const status = alertStatus(alert);
  const open = isOpen(alert);
  const waiting = needsResponder(alert);
  const snapshot = alert.snapshotUrl && !imageFailed ? alert.snapshotUrl : null;
  const forwarded = forwardedFrom(alert);
  const ring = currentRing(alert);

  async function confirm() {
    if (!confirming) return;
    setBusy(true);
    setError(null);
    const problem = await onClose(confirming);
    setBusy(false);
    if (problem) setError(problem);
    else setConfirming(null);
  }

  return (
    <article className="animate-deal">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {history && (
            <button
              type="button"
              onClick={onBack}
              aria-label={hasLive ? "Back to live alert" : "Close"}
              className="inline-flex size-8 items-center justify-center rounded-full bg-white/[0.08] hover:bg-white/15"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
            </button>
          )}
          <span className="text-[13px] font-semibold text-inverse-ink-2 tabular">
            Incident {incidentCode(alert)}
          </span>
        </div>
        <Chip tone="inverse" size="sm" className="tabular">
          {formatTime(alert.createdAt)}
        </Chip>
      </div>

      <h2 className="mt-4 text-[26px] leading-tight font-medium tracking-[-0.045em]">
        {alert.cameraLabel}
      </h2>
      <p className="mt-1 text-[13px] text-inverse-ink-2">
        {cameraCode(alert.cameraId)} · {alert.zone}
        {alert.source === "simulated" ? " · Simulated signal" : ""}
      </p>

      <div className="relative mt-4 flex items-center justify-between gap-3 rounded-[18px] bg-white/[0.06] px-4 py-3">
        {ripple > 0 && (
          <span
            key={ripple}
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-0 animate-ring-out rounded-[18px] ring-2",
              waiting ? "ring-accent" : open ? "ring-gold" : "ring-white/40",
            )}
          />
        )}
        <span className="flex items-center gap-2.5 text-[14px] font-semibold">
          <Dot
            className={status.tone === "ink" ? "bg-inverse-ink" : toneDot[status.tone]}
            pulse={status.pulse}
          />
          {status.label}
        </span>
        <span className="text-[13px] font-semibold text-inverse-ink-2 tabular">
          {waiting
            ? `Waiting ${formatElapsed(now - alert.createdAt)}`
            : alert.status === "responding" && alert.respondedAt !== null
              ? `Responding for ${formatElapsed(now - alert.respondedAt)}`
              : alert.respondedAt !== null
                ? `Confirmed in ${formatElapsed(alert.respondedAt - alert.createdAt)}`
                : alert.closedAt !== null
                  ? `Closed after ${formatElapsed(alert.closedAt - alert.createdAt)}`
                  : ""}
        </span>
      </div>

      <IncidentProgress alert={alert} className="mt-4" />

      {forwarded && ring && (
        <div
          role="status"
          className="mt-4 rounded-[18px] bg-accent/15 px-4 py-3 text-[13px] ring-1 ring-accent/40"
        >
          <b className="font-semibold">Escalated to {ring.guardName}.</b>{" "}
          <span className="text-inverse-ink-2">
            {forwarded.guardName} did not respond in time, so the alert was forwarded to the next
            nearest guard.
          </span>
        </div>
      )}

      <figure className="mt-4">
        <div className="relative aspect-[4/3] overflow-hidden rounded-[18px] bg-white/[0.05]">
          {snapshot ? (
            <img
              src={snapshot}
              alt={`Snapshot from ${alert.cameraLabel} at ${formatTime(alert.createdAt)}`}
              onError={() => setImageFailed(true)}
              className="size-full object-cover outline-1 -outline-offset-1 outline-white/10"
            />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-2 text-inverse-ink-2">
              <ImageOff aria-hidden="true" className="size-6" />
              <span className="text-[13px] font-medium">No snapshot for this alert</span>
            </div>
          )}
          <span className="glass-dark absolute top-3 left-3 inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold text-white">
            <Camera aria-hidden="true" className="size-3" /> Camera {cameraNumber(alert.cameraId)}
          </span>
        </div>
        <figcaption className="mt-2 text-[12px] text-inverse-ink-2">
          One snapshot, taken when the signal was seen. No video is recorded.
        </figcaption>
      </figure>

      {open ? (
        <>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <a
              href="tel:112"
              className={cn(buttonClasses({ variant: "accent", size: "lg" }), "h-12")}
            >
              <Phone aria-hidden="true" className="size-4" /> Call 112
            </a>
            <Button
              variant="light"
              size="lg"
              icon={CircleCheck}
              className="h-12"
              onClick={() => setConfirming("resolved")}
            >
              Resolve
            </Button>
            <Button
              variant="outline-inverse"
              icon={X}
              className="col-span-2"
              onClick={() => setConfirming("false_alarm")}
            >
              Mark false alarm
            </Button>
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-inverse-ink-2">
            Call 112 when she asks for police or the guard confirms danger. Ishaara never calls
            police on its own.
          </p>
          {error && !confirming && (
            <p role="alert" className="mt-2 text-[13px] font-semibold text-peach">
              {error}
            </p>
          )}
        </>
      ) : (
        <div className="mt-5 flex items-center gap-3 rounded-[18px] bg-white/[0.06] px-4 py-3 text-[13px]">
          {alert.status === "resolved" ? (
            <CheckBadge className="animate-pop">
              <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />
            </CheckBadge>
          ) : (
            <span className="inline-flex size-6 animate-pop items-center justify-center rounded-full bg-white/15">
              <X aria-hidden="true" className="size-3.5" />
            </span>
          )}
          <span className="font-semibold">
            {alert.status === "resolved" ? "Resolved" : "Marked false alarm"}
          </span>
          {alert.closedAt !== null && (
            <span className="ml-auto text-inverse-ink-2 tabular">
              {formatShortTime(alert.closedAt)}
            </span>
          )}
        </div>
      )}

      <RingTimeline alert={alert} now={now} />

      <Dialog
        open={confirming !== null}
        onClose={() => {
          if (!busy) setConfirming(null);
        }}
        title={confirming ? CONFIRM[confirming].title : ""}
        description={confirming ? CONFIRM[confirming].description : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="ink" onClick={() => void confirm()} disabled={busy}>
              {confirming ? CONFIRM[confirming].action : ""}
            </Button>
          </>
        }
      >
        {error && (
          <p role="alert" className="text-[13px] font-semibold text-accent-ink">
            {error}
          </p>
        )}
      </Dialog>
    </article>
  );
}

function reachText(attempt: RingAttempt): string {
  if (attempt.outcome === "confirmed" && attempt.channels.length === 0) return "Confirmed directly";
  if (!attempt.reached) return "Not reachable: app closed, no phone number";
  const app = attempt.channels.includes("guard-app");
  const phone = attempt.channels.includes("phone");
  if (app && phone) return "Guard app and phone call";
  return phone ? "Phone call" : "Guard app";
}

const rowClass = "flex items-start gap-3 border-t border-white/[0.06] py-3 first:border-t-0";
const timeClass = "w-[58px] shrink-0 pt-0.5 text-[12px] text-inverse-ink-2 tabular";

const RECENT_ATTEMPTS = 8;

function RingTimeline({ alert, now }: { alert: Alert; now: number }) {
  const [showAll, setShowAll] = useState(false);
  const missed = missedAttempts(alert).length;
  const round = alert.attempts.reduce((highest, attempt) => Math.max(highest, attempt.round), 1);
  const hidden = showAll ? 0 : Math.max(0, alert.attempts.length - RECENT_ATTEMPTS);
  const attempts = alert.attempts.slice(hidden);
  return (
    <div className="mt-6 border-t border-white/[0.08] pt-5">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold tracking-[-0.02em]">Ring timeline</h3>
        <Chip tone="gold" size="sm">
          {missed ? `Escalated ×${missed} · round ${round}` : `Round ${round}`}
        </Chip>
      </div>
      <ol className="mt-3 flex flex-col">
        <li className={rowClass}>
          <span className={timeClass}>{formatShortTime(alert.createdAt)}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold">
              Alert {incidentCode(alert)} generated
            </span>
            <span className="block text-[12px] leading-snug text-inverse-ink-2">
              {cameraCode(alert.cameraId)} · {alert.cameraLabel} ·{" "}
              {alert.snapshotUrl ? "snapshot captured" : "no snapshot"}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5 pt-0.5 text-[12px] font-semibold text-accent">
            <Dot className="bg-accent" /> Sent
          </span>
        </li>
        {alert.attempts.length === 0 && isOpen(alert) && (
          <li className={rowClass}>
            <span className={timeClass} />
            <span className="text-[13px] text-inverse-ink-2">Finding the nearest guard…</span>
          </li>
        )}
        {hidden > 0 && (
          <li className={rowClass}>
            <span className={timeClass} />
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="rounded-md text-[13px] font-semibold text-inverse-ink-2 underline decoration-white/30 underline-offset-4 hover:text-inverse-ink"
            >
              Show {hidden} earlier {hidden === 1 ? "ring" : "rings"}
            </button>
          </li>
        )}
        {attempts.map((attempt, index) => (
          <TimelineRow
            key={`${attempt.guardId}-${attempt.startedAt}-${hidden + index}`}
            attempt={attempt}
            now={now}
          />
        ))}
        {alert.closedAt !== null && (
          <li className={rowClass}>
            <span className={timeClass}>{formatShortTime(alert.closedAt)}</span>
            <span className="min-w-0 flex-1 text-[13px] font-semibold">
              {alert.status === "resolved"
                ? "Incident resolved by Command"
                : "Closed as a false alarm"}
            </span>
            <span className="text-[12px] font-semibold text-inverse-ink-2">
              {alert.status === "resolved" ? "Resolved" : "False alarm"}
            </span>
          </li>
        )}
      </ol>
    </div>
  );
}

function TimelineRow({ attempt, now }: { attempt: RingAttempt; now: number }) {
  const outcome = {
    ringing: { text: `Ringing, ${formatSeconds(attempt.endsAt - now)} left`, cls: "text-accent" },
    no_answer: {
      text: attempt.reached ? "No answer" : "Not reachable",
      cls: "text-inverse-ink-2",
    },
    confirmed: { text: "Going", cls: "text-gold" },
    stopped: { text: "Stopped", cls: "text-inverse-ink-2" },
  }[attempt.outcome];
  return (
    <li className={rowClass}>
      <span className={timeClass}>{formatShortTime(attempt.startedAt)}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold">
          {attempt.guardName}{" "}
          <span className="font-medium text-inverse-ink-2">· round {attempt.round}</span>
        </span>
        <span className="block text-[12px] leading-snug text-inverse-ink-2">
          {reachText(attempt)}
        </span>
      </span>
      <span
        className={cn(
          "flex shrink-0 items-center gap-1.5 pt-0.5 text-[12px] font-semibold tabular",
          outcome.cls,
        )}
      >
        {attempt.outcome === "ringing" && <Dot className="bg-accent" pulse />}
        {attempt.outcome === "confirmed" ? (
          <CheckBadge className="size-5">
            <Check aria-hidden="true" className="size-3" strokeWidth={3} />
          </CheckBadge>
        ) : attempt.outcome !== "ringing" ? (
          <span aria-hidden="true" className="size-2 rounded-full bg-white/20" />
        ) : null}
        {outcome.text}
      </span>
    </li>
  );
}
