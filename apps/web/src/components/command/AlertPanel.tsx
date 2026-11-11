import type { Alert, AlertOutcome } from "@ishaara/server/types";
import { CheckCircle2, ImageOff, Phone, XCircle } from "lucide-react";
import { useState } from "react";
import { alertStatus, isOpen, needsResponder } from "../../lib/alerts";
import { cn } from "../../lib/cn";
import { formatElapsed, formatTime } from "../../lib/format";
import { Button, buttonClasses, Card, Dialog, StatusDot } from "../ui";
import { RingTimeline } from "./RingTimeline";

export interface AlertPanelProps {
  alert: Alert;
  now: number;
  flash: boolean;
  onClose: (outcome: AlertOutcome) => Promise<string | null>;
}

const confirmCopy: Record<AlertOutcome, { title: string; description: string; action: string }> = {
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

export function AlertPanel({ alert, now, flash, onClose }: AlertPanelProps) {
  const [confirming, setConfirming] = useState<AlertOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  const status = alertStatus(alert);
  const open = isOpen(alert);
  const tone = !open ? "none" : needsResponder(alert) ? "alert" : "ok";

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
    <Card
      as="article"
      tone={tone}
      padded={false}
      className={cn(flash && "animate-alert-flash")}
      title={
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="tabular-nums">Alert #{alert.number}</span>
          {alert.source === "simulated" && (
            <span className="font-normal text-ink-muted">Simulated</span>
          )}
        </span>
      }
      actions={
        <span className="text-sm text-ink-muted tabular-nums">{formatTime(alert.createdAt)}</span>
      }
    >
      <div className="flex flex-col gap-4 p-4">
        <div>
          <p className="text-lg font-semibold text-ink">{alert.cameraLabel}</p>
          <p className="text-sm text-ink-muted">{alert.zone}</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-y border-line py-3">
          <StatusDot tone={status.tone} pulse={status.pulse} strong>
            {status.label}
          </StatusDot>
          {alert.status === "responding" && alert.respondedAt !== null && (
            <span className="text-sm text-ink-muted tabular-nums">
              Responding for {formatElapsed(now - alert.respondedAt)}
            </span>
          )}
          {needsResponder(alert) && (
            <span className="text-sm text-ink-muted tabular-nums">
              Waiting {formatElapsed(now - alert.createdAt)}
            </span>
          )}
          {!open && alert.closedAt !== null && (
            <span className="text-sm text-ink-muted tabular-nums">
              Closed at {formatTime(alert.closedAt)}
            </span>
          )}
        </div>

        <figure>
          {alert.snapshotUrl && !imageFailed ? (
            <img
              src={alert.snapshotUrl}
              alt={`Snapshot from ${alert.cameraLabel} at the moment of the signal`}
              onError={() => setImageFailed(true)}
              className="aspect-video w-full rounded-md border border-line bg-sunken object-cover"
            />
          ) : (
            <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-md border border-line bg-sunken text-sm text-ink-muted">
              <ImageOff size={20} aria-hidden="true" />
              No snapshot for this alert
            </div>
          )}
          <figcaption className="mt-1 text-sm text-ink-faint">
            One snapshot, taken when the signal was seen. No video is recorded.
          </figcaption>
        </figure>

        {open && (
          <div className="flex flex-wrap gap-2">
            <a href="tel:112" className={buttonClasses({ variant: "danger", size: "lg" })}>
              <Phone size={18} aria-hidden="true" />
              Call 112
            </a>
            <Button
              size="lg"
              variant="primary"
              icon={CheckCircle2}
              onClick={() => setConfirming("resolved")}
            >
              Resolve
            </Button>
            <Button size="lg" icon={XCircle} onClick={() => setConfirming("false_alarm")}>
              Mark false alarm
            </Button>
          </div>
        )}
        {open && (
          <p className="text-sm text-ink-muted">
            Call 112 when she asks for police or the guard confirms danger. Ishaara never calls
            police on its own.
          </p>
        )}
        {error && !confirming && (
          <p role="alert" className="text-sm text-alert">
            {error}
          </p>
        )}
      </div>

      <div className="border-t border-line p-4">
        <h3 className="mb-2 text-sm font-semibold text-ink">Ring timeline</h3>
        <RingTimeline attempts={alert.attempts} now={now} />
      </div>

      <Dialog
        open={confirming !== null}
        onClose={() => {
          if (!busy) setConfirming(null);
        }}
        title={confirming ? confirmCopy[confirming].title : ""}
        description={confirming ? confirmCopy[confirming].description : undefined}
        footer={
          <>
            <Button onClick={() => setConfirming(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void confirm()} disabled={busy}>
              {confirming ? confirmCopy[confirming].action : ""}
            </Button>
          </>
        }
      >
        {error && (
          <p role="alert" className="text-sm text-alert">
            {error}
          </p>
        )}
      </Dialog>
    </Card>
  );
}
