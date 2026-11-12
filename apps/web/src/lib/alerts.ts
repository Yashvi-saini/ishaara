import type { Alert, Camera, Guard, RingAttempt } from "@ishaara/server/types";

export type StatusTone = "accent" | "gold" | "ink" | "muted";

export const toneDot: Record<StatusTone, string> = {
  accent: "bg-accent",
  gold: "bg-gold",
  ink: "bg-ink",
  muted: "bg-ink-3",
};

export const toneText: Record<StatusTone, string> = {
  accent: "text-accent-ink",
  gold: "text-gold-ink",
  ink: "text-ink",
  muted: "text-ink-3",
};

export function isOpen(alert: Alert): boolean {
  return alert.status === "new" || alert.status === "ringing" || alert.status === "responding";
}

export function needsResponder(alert: Alert): boolean {
  return alert.status === "new" || alert.status === "ringing";
}

export function currentRing(alert: Alert): RingAttempt | undefined {
  return alert.attempts.find((attempt) => attempt.outcome === "ringing");
}

export function missedAttempts(alert: Alert): RingAttempt[] {
  return alert.attempts.filter((attempt) => attempt.reached && attempt.outcome === "no_answer");
}

export function forwardedFrom(alert: Alert): RingAttempt | undefined {
  const ring = currentRing(alert);
  if (!ring) return undefined;
  const before = alert.attempts.slice(0, alert.attempts.indexOf(ring));
  return [...before]
    .reverse()
    .find((attempt) => attempt.reached && attempt.outcome === "no_answer");
}

export function incidentCode(alert: Pick<Alert, "number">): string {
  return `ISH-${String(alert.number).padStart(3, "0")}`;
}

export function cameraNumber(cameraId: string): string {
  return cameraId.replace(/\D/g, "") || "?";
}

export function cameraCode(cameraId: string): string {
  return `CAM-${cameraNumber(cameraId).padStart(2, "0")}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function mapDistanceMetres(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.round(Math.hypot(a.x - b.x, a.y - b.y) * 0.45);
}

export function guardsByDistance(camera: Camera, guards: readonly Guard[]): Guard[] {
  return [...guards].sort(
    (a, b) =>
      Math.hypot(a.x - camera.x, a.y - camera.y) - Math.hypot(b.x - camera.x, b.y - camera.y),
  );
}

export interface StatusView {
  tone: StatusTone;
  label: string;
  pulse: boolean;
}

export function alertStatus(alert: Alert): StatusView {
  switch (alert.status) {
    case "new":
      return { tone: "accent", label: "Finding a guard", pulse: true };
    case "ringing": {
      const ring = currentRing(alert);
      return {
        tone: "accent",
        label: ring ? `Ringing ${ring.guardName}` : "Ringing guards",
        pulse: true,
      };
    }
    case "responding":
      return {
        tone: "gold",
        label: `${alert.responderName ?? "A guard"} responding`,
        pulse: false,
      };
    case "resolved":
      return { tone: "ink", label: "Resolved", pulse: false };
    case "false_alarm":
      return { tone: "muted", label: "False alarm", pulse: false };
  }
}

export type GuardState = "offline" | "on_shift" | "ringing" | "responding";

export function guardState(
  guardId: string,
  guardsOnShift: readonly string[],
  openAlerts: readonly Alert[],
): GuardState {
  if (openAlerts.some((alert) => alert.status === "responding" && alert.responderId === guardId))
    return "responding";
  if (openAlerts.some((alert) => currentRing(alert)?.guardId === guardId)) return "ringing";
  return guardsOnShift.includes(guardId) ? "on_shift" : "offline";
}
