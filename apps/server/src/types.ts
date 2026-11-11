export interface PublicConfig {
  demoMode: boolean;
  ringMs: number;
  cameraCooldownMs: number;
}

export interface HealthResponse {
  ok: true;
  config: PublicConfig;
}

export type MapPoint = [x: number, y: number];

export interface Building {
  id: string;
  label: string;
  kind: "building" | "parking" | "gate";
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CampusMap {
  width: number;
  height: number;
  buildings: Building[];
  roads: MapPoint[][];
}

export interface Campus {
  name: string;
  map: CampusMap;
}

export interface Camera {
  id: string;
  name: string;
  label: string;
  zone: string;
  x: number;
  y: number;
}

export interface Guard {
  id: string;
  name: string;
  zone: string;
  x: number;
  y: number;
}

export type AlertStatus = "new" | "ringing" | "responding" | "resolved" | "false_alarm";

export type AlertOutcome = "resolved" | "false_alarm";

export type RingOutcome = "ringing" | "no_answer" | "confirmed" | "stopped";

export interface RingAttempt {
  guardId: string;
  guardName: string;
  round: number;
  startedAt: number;
  endsAt: number;
  endedAt: number | null;
  outcome: RingOutcome;
  reached: boolean;
}

export interface Alert {
  id: string;
  number: number;
  cameraId: string;
  cameraLabel: string;
  zone: string;
  source: "camera" | "simulated";
  snapshotUrl: string | null;
  createdAt: number;
  status: AlertStatus;
  attempts: RingAttempt[];
  responderId: string | null;
  responderName: string | null;
  respondedAt: number | null;
  closedAt: number | null;
}

export interface AppState {
  campus: Campus;
  cameras: Camera[];
  guards: Guard[];
  alerts: Alert[];
  guardsOnShift: string[];
  config: PublicConfig;
  serverTime: number;
}

export interface CreateAlertRequest {
  cameraId: string;
  snapshot?: string | null;
  simulated?: boolean;
}

export interface CreateAlertResponse {
  alert: Alert;
  duplicate: boolean;
}

export interface ApiError {
  error: string;
}

export interface GuardRing {
  alertId: string;
  alertNumber: number;
  cameraLabel: string;
  zone: string;
  createdAt: number;
  startedAt: number;
  endsAt: number;
}

export type ActionReply = { ok: true; alert: Alert } | { ok: false; error: string };

export type JoinReply =
  { ok: true; guard: Guard; ring: GuardRing | null } | { ok: false; error: string };

export interface ServerToClientEvents {
  "alert:new": (alert: Alert) => void;
  "alert:update": (alert: Alert) => void;
  "guard:ring": (ring: GuardRing) => void;
  "guard:presence": (guardIds: string[]) => void;
}

export interface ClientToServerEvents {
  "guard:join": (payload: { guardId: string }, reply?: (result: JoinReply) => void) => void;
  "guard:leave": () => void;
  "guard:ack": (
    payload: { alertId: string; guardId: string },
    reply?: (result: ActionReply) => void,
  ) => void;
  "alert:resolve": (
    payload: { alertId: string; outcome: AlertOutcome },
    reply?: (result: ActionReply) => void,
  ) => void;
}
