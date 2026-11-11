import type { Alert, RingAttempt } from "@ishaara/server/types";
import type { StatusTone } from "../components/ui";

export function isOpen(alert: Alert): boolean {
  return alert.status === "new" || alert.status === "ringing" || alert.status === "responding";
}

export function needsResponder(alert: Alert): boolean {
  return alert.status === "new" || alert.status === "ringing";
}

export function currentRing(alert: Alert): RingAttempt | undefined {
  return alert.attempts.find((attempt) => attempt.outcome === "ringing");
}

export interface StatusView {
  tone: StatusTone;
  label: string;
  pulse: boolean;
}

export function alertStatus(alert: Alert): StatusView {
  switch (alert.status) {
    case "new":
      return { tone: "alert", label: "New alert", pulse: false };
    case "ringing": {
      const ring = currentRing(alert);
      return {
        tone: "ringing",
        label: ring ? `Ringing ${ring.guardName}` : "Ringing guards",
        pulse: true,
      };
    }
    case "responding":
      return {
        tone: "ok",
        label: `${alert.responderName ?? "A guard"} is on the way`,
        pulse: false,
      };
    case "resolved":
      return { tone: "ok", label: "Resolved", pulse: false };
    case "false_alarm":
      return { tone: "neutral", label: "False alarm", pulse: false };
  }
}

export function ringOutcome(attempt: RingAttempt): StatusView {
  switch (attempt.outcome) {
    case "ringing":
      return { tone: "ringing", label: "Ringing", pulse: true };
    case "no_answer":
      return { tone: "neutral", label: "No answer", pulse: false };
    case "confirmed":
      return { tone: "ok", label: "Confirmed", pulse: false };
    case "stopped":
      return { tone: "neutral", label: "Stopped", pulse: false };
  }
}
