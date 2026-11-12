import type { Alert, Camera, Campus, Guard } from "@ishaara/server/types";
import { Radio, Send, X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { createAlert } from "../../lib/api";
import {
  cameraCode,
  cameraNumber,
  currentRing,
  guardState,
  guardsByDistance,
  incidentCode,
  initials,
  mapDistanceMetres,
  type GuardState,
} from "../../lib/alerts";
import { cn } from "../../lib/cn";
import { Button, Chip, Dot } from "../ui";

type Selection = { kind: "camera"; id: string } | { kind: "guard"; id: string } | null;

const GUARD_FILL: Record<GuardState, string> = {
  offline: "var(--card)",
  on_shift: "var(--tile)",
  ringing: "var(--accent-fill)",
  responding: "var(--gold)",
};

const GUARD_TEXT: Record<GuardState, string> = {
  offline: "var(--ink-3)",
  on_shift: "#fff",
  ringing: "#fff",
  responding: "var(--on-gold)",
};

const GUARD_LABEL: Record<GuardState, string> = {
  offline: "App not open",
  on_shift: "Available on shift",
  ringing: "Ringing now",
  responding: "Responding to alert",
};

function wedge(x: number, y: number, towards: { x: number; y: number }, radius: number) {
  const centre = Math.atan2(towards.y - y, towards.x - x);
  const spread = (54 * Math.PI) / 180;
  const start = centre - spread / 2;
  const end = centre + spread / 2;
  const x1 = x + radius * Math.cos(start);
  const y1 = y + radius * Math.sin(start);
  const x2 = x + radius * Math.cos(end);
  const y2 = y + radius * Math.sin(end);
  return `M ${x} ${y} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${radius} ${radius} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`;
}

function onActivate(action: () => void) {
  return (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      action();
    }
  };
}

export interface CampusMapProps {
  campus: Campus;
  cameras: readonly Camera[];
  guards: readonly Guard[];
  camerasOnline: readonly string[];
  guardsOnShift: readonly string[];
  openAlerts: readonly Alert[];
  selectedAlertId: string | null;
  demoMode: boolean;
  onSelectAlert: (alertId: string) => void;
}

export function CampusMap({
  campus,
  cameras,
  guards,
  camerasOnline,
  guardsOnShift,
  openAlerts,
  selectedAlertId,
  demoMode,
  onSelectAlert,
}: CampusMapProps) {
  const [selected, setSelected] = useState<Selection>(null);
  const { map } = campus;
  const centre = { x: map.width / 2, y: map.height / 2 };
  const alertByCamera = new Map<string, Alert>();
  for (const alert of openAlerts) {
    if (!alertByCamera.has(alert.cameraId)) alertByCamera.set(alert.cameraId, alert);
  }
  const focusCameraId = openAlerts.find((alert) => alert.id === selectedAlertId)?.cameraId;
  const cameraById = new Map(cameras.map((camera) => [camera.id, camera]));
  const guardById = new Map(guards.map((guard) => [guard.id, guard]));

  const routes = openAlerts.flatMap((alert) => {
    const camera = cameraById.get(alert.cameraId);
    const guardId =
      alert.status === "responding" ? alert.responderId : (currentRing(alert)?.guardId ?? null);
    const guard = guardId ? guardById.get(guardId) : undefined;
    if (!camera || !guard) return [];
    return [{ alert, camera, guard, responding: alert.status === "responding" }];
  });

  const selectCamera = (camera: Camera) => {
    setSelected({ kind: "camera", id: camera.id });
    const alert = alertByCamera.get(camera.id);
    if (alert) onSelectAlert(alert.id);
  };

  const description =
    openAlerts.length === 0
      ? `Map of ${campus.name} with ${cameras.length} cameras. No active alerts.`
      : `Map of ${campus.name}. Active alerts at ${openAlerts.map((alert) => alert.cameraLabel).join(", ")}.`;

  const selectedCamera = selected?.kind === "camera" ? cameraById.get(selected.id) : undefined;
  const selectedGuard = selected?.kind === "guard" ? guardById.get(selected.id) : undefined;

  return (
    <div>
      <svg
        viewBox={`0 0 ${map.width} ${map.height}`}
        className="block h-auto w-full select-none"
        role="group"
        aria-label={description}
      >
        <defs>
          <pattern id="map-dots" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.25" fill="var(--ink)" opacity="0.07" />
          </pattern>
          <pattern id="map-parking" width="26" height="26" patternUnits="userSpaceOnUse">
            <line
              x1="13"
              y1="0"
              x2="13"
              y2="26"
              stroke="var(--ink)"
              strokeOpacity="0.11"
              strokeWidth="2"
            />
          </pattern>
          <radialGradient id="fov-online" cx="0%" cy="50%" r="100%">
            <stop offset="0%" stopColor="var(--ink)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--ink)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="fov-hot" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.38" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
          </radialGradient>
        </defs>

        <rect
          x="8"
          y="8"
          width={map.width - 16}
          height={map.height - 16}
          rx="28"
          fill="url(#map-dots)"
          stroke="var(--line)"
          strokeWidth="1.5"
        />

        <g transform={`translate(${map.width - 52}, 52)`} aria-hidden="true">
          <circle r="18" fill="var(--card)" stroke="var(--line)" strokeWidth="1.5" />
          <path d="M 0 -10 L 4 5 L 0 2 L -4 5 Z" fill="var(--accent)" />
          <text y="-24" textAnchor="middle" fontSize="14" fontWeight="800" fill="var(--ink-2)">
            N
          </text>
        </g>
        <g transform={`translate(${map.width - 150}, ${map.height - 30})`} aria-hidden="true">
          <line x1="0" y1="0" x2="110" y2="0" stroke="var(--ink-3)" strokeWidth="2" />
          <line x1="0" y1="-4" x2="0" y2="4" stroke="var(--ink-3)" strokeWidth="2" />
          <line x1="110" y1="-4" x2="110" y2="4" stroke="var(--ink-3)" strokeWidth="2" />
          <text
            x="55"
            y="-8"
            textAnchor="middle"
            fontSize="14"
            fontWeight="700"
            fill="var(--ink-3)"
          >
            50 m
          </text>
        </g>

        {map.roads.map((road, index) => {
          const points = road.map(([x, y]) => `${x},${y}`).join(" ");
          return (
            <g key={index} fill="none" strokeLinecap="round" strokeLinejoin="round">
              <polyline points={points} stroke="var(--line)" strokeWidth="34" />
              <polyline points={points} stroke="var(--card)" strokeWidth="30" />
              <polyline
                points={points}
                stroke="var(--ink)"
                strokeOpacity="0.12"
                strokeWidth="1.5"
                strokeDasharray="6 8"
              />
            </g>
          );
        })}

        {map.buildings.map((building) =>
          building.kind === "gate" ? (
            <g key={building.id}>
              <rect
                x={building.x - 10}
                y={building.y - 4}
                width={building.width + 20}
                height={building.height + 8}
                rx="14"
                fill="var(--sunken)"
                stroke="var(--line)"
              />
              <rect
                x={building.x}
                y={building.y}
                width={building.width}
                height={building.height}
                rx="10"
                fill="var(--tile)"
              />
              <text
                x={building.x + building.width / 2}
                y={building.y + building.height / 2 + 5}
                textAnchor="middle"
                fill="#fff"
                fontSize="13"
                fontWeight="700"
              >
                {building.label}
              </text>
            </g>
          ) : (
            <g key={building.id}>
              <rect
                x={building.x + 3}
                y={building.y + 5}
                width={building.width}
                height={building.height}
                rx="22"
                fill="var(--ink)"
                opacity="0.05"
              />
              <rect
                x={building.x}
                y={building.y}
                width={building.width}
                height={building.height}
                rx="22"
                fill="var(--card)"
                stroke="var(--line)"
                strokeWidth="1.5"
              />
              <rect
                x={building.x + 16}
                y={building.y + 46}
                width={building.width - 32}
                height={Math.max(12, building.height - 62)}
                rx="12"
                fill={building.kind === "parking" ? "url(#map-parking)" : "var(--sunken)"}
                opacity={building.kind === "parking" ? 1 : 0.65}
              />
              <text
                x={building.x + 20}
                y={building.y + 31}
                fill="var(--ink)"
                fontSize="16"
                fontWeight="700"
                letterSpacing="-0.3"
              >
                {building.label}
              </text>
            </g>
          ),
        )}

        {cameras.map((camera) => {
          const online = camerasOnline.includes(camera.id);
          const hot = alertByCamera.has(camera.id);
          const focused =
            focusCameraId === camera.id ||
            (selected?.kind === "camera" && selected.id === camera.id);
          return (
            <path
              key={`fov-${camera.id}`}
              d={wedge(camera.x, camera.y, centre, hot || focused ? 78 : 62)}
              fill={hot ? "url(#fov-hot)" : online || focused ? "url(#fov-online)" : "none"}
              stroke={hot ? "var(--accent)" : focused ? "var(--ink)" : "var(--ink-3)"}
              strokeOpacity={hot ? 0.55 : online || focused ? 0.28 : 0.18}
              strokeWidth="1.25"
              strokeDasharray={online || hot ? undefined : "3 3"}
              aria-hidden="true"
            />
          );
        })}

        {routes.map(({ alert, camera, guard, responding }) => {
          const midX = (guard.x + camera.x) / 2;
          const midY = (guard.y + camera.y) / 2;
          const metres = mapDistanceMetres(guard, camera);
          return (
            <g key={`route-${alert.id}`} aria-hidden="true">
              <line
                x1={guard.x}
                y1={guard.y}
                x2={camera.x}
                y2={camera.y}
                stroke={responding ? "var(--gold)" : "var(--accent)"}
                strokeWidth={responding ? 3.5 : 2.5}
                strokeDasharray={responding ? "2 9" : "4 7"}
                strokeLinecap="round"
                className="animate-march"
              />
              <g transform={`translate(${midX}, ${midY})`}>
                <rect
                  x={responding ? -50 : -64}
                  y="-14"
                  width={responding ? 100 : 128}
                  height="28"
                  rx="14"
                  fill={responding ? "var(--gold)" : "var(--accent-fill)"}
                />
                <text
                  y="5"
                  textAnchor="middle"
                  fontSize="14"
                  fontWeight="700"
                  fill={responding ? "var(--on-gold)" : "#fff"}
                >
                  {responding ? `${initials(guard.name)} · ${metres}m` : `Ringing · ${metres}m`}
                </text>
              </g>
            </g>
          );
        })}

        {cameras.map((camera) => {
          const online = camerasOnline.includes(camera.id);
          const alert = alertByCamera.get(camera.id);
          const hot = alert !== undefined;
          const focused =
            focusCameraId === camera.id ||
            (selected?.kind === "camera" && selected.id === camera.id);
          const pillBelow = camera.y < map.height - 80;
          return (
            <g
              key={camera.id}
              role="button"
              tabIndex={0}
              aria-label={`${cameraCode(camera.id)}: ${camera.name}, ${hot ? "active alert" : online ? "online" : "offline"}`}
              onClick={() => selectCamera(camera)}
              onKeyDown={onActivate(() => selectCamera(camera))}
              className="cursor-pointer outline-none [&:focus-visible>.focus-ring]:opacity-100"
            >
              <circle
                className="focus-ring opacity-0"
                cx={camera.x}
                cy={camera.y}
                r="34"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2"
              />
              {hot && (
                <>
                  <circle
                    cx={camera.x}
                    cy={camera.y}
                    r="20"
                    fill="var(--accent)"
                    opacity="0.35"
                    className="animate-ping-soft"
                    style={{ transformBox: "fill-box", transformOrigin: "center" }}
                  />
                  <circle
                    cx={camera.x}
                    cy={camera.y}
                    r={focused ? 31 : 26}
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                  />
                </>
              )}
              {focused && !hot && (
                <circle
                  cx={camera.x}
                  cy={camera.y}
                  r="24"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2.2"
                />
              )}
              <circle
                cx={camera.x}
                cy={camera.y}
                r="16"
                fill={hot ? "var(--accent-fill)" : online ? "var(--ink)" : "var(--card)"}
                stroke={hot || online ? "var(--card)" : "var(--ink-3)"}
                strokeWidth="2"
                strokeDasharray={hot || online ? undefined : "3 3"}
              />
              <text
                x={camera.x}
                y={camera.y + 6}
                textAnchor="middle"
                fontSize="17"
                fontWeight="800"
                fill={hot ? "#fff" : online ? "var(--shell)" : "var(--ink-3)"}
              >
                {cameraNumber(camera.id)}
              </text>
              <g
                transform={
                  pillBelow
                    ? `translate(${camera.x}, ${camera.y + 34})`
                    : `translate(${camera.x + 62}, ${camera.y})`
                }
              >
                <rect
                  x="-36"
                  y="-11"
                  width="72"
                  height="22"
                  rx="11"
                  fill={hot ? "var(--accent-fill)" : "var(--card)"}
                  stroke="var(--line)"
                />
                <text
                  y="5"
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight="700"
                  fill={hot ? "#fff" : "var(--ink-2)"}
                >
                  {cameraCode(camera.id)}
                </text>
              </g>
            </g>
          );
        })}

        {guards.map((guard) => {
          const state = guardState(guard.id, guardsOnShift, openAlerts);
          const isSelected = selected?.kind === "guard" && selected.id === guard.id;
          const select = () => setSelected({ kind: "guard", id: guard.id });
          return (
            <g
              key={guard.id}
              role="button"
              tabIndex={0}
              aria-label={`Guard ${guard.name}, ${guard.zone}, ${GUARD_LABEL[state].toLowerCase()}`}
              onClick={select}
              onKeyDown={onActivate(select)}
              className={cn(
                "cursor-pointer outline-none [&:focus-visible>.focus-ring]:opacity-100",
                state === "ringing" && "animate-breathe",
              )}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            >
              <rect
                className={cn("focus-ring", !isSelected && "opacity-0")}
                x={guard.x - 27}
                y={guard.y - 20}
                width="54"
                height="40"
                rx="13"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2"
              />
              <rect
                x={guard.x - 22}
                y={guard.y - 15}
                width="44"
                height="30"
                rx="10"
                fill={GUARD_FILL[state]}
                stroke={state === "offline" ? "var(--ink-3)" : "var(--card)"}
                strokeWidth="1.5"
              />
              <text
                x={guard.x}
                y={guard.y + 5}
                textAnchor="middle"
                fontSize="15"
                fontWeight="800"
                fill={GUARD_TEXT[state]}
              >
                {initials(guard.name)}
              </text>
            </g>
          );
        })}
      </svg>

      {selectedCamera && (
        <CameraInspector
          camera={selectedCamera}
          guards={guards}
          online={camerasOnline.includes(selectedCamera.id)}
          openAlert={alertByCamera.get(selectedCamera.id)}
          demoMode={demoMode}
          onSelectAlert={onSelectAlert}
          onClose={() => setSelected(null)}
        />
      )}
      {selectedGuard && (
        <GuardInspector
          guard={selectedGuard}
          cameras={cameras}
          state={guardState(selectedGuard.id, guardsOnShift, openAlerts)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

const inspectorClass =
  "mt-2.5 flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-card px-4 py-3 shadow-[0_4px_20px_-6px_rgb(0_0_0/0.12)] ring-1 ring-line";

function CloseButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex size-8 items-center justify-center rounded-full bg-sunken text-ink-2 transition-colors hover:text-ink"
    >
      <X aria-hidden="true" className="size-4" />
    </button>
  );
}

function CameraInspector({
  camera,
  guards,
  online,
  openAlert,
  demoMode,
  onSelectAlert,
  onClose,
}: {
  camera: Camera;
  guards: readonly Guard[];
  online: boolean;
  openAlert: Alert | undefined;
  demoMode: boolean;
  onSelectAlert: (alertId: string) => void;
  onClose: () => void;
}) {
  const [problem, setProblem] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const closest = guardsByDistance(camera, guards)[0];

  async function simulate() {
    setSending(true);
    setProblem(null);
    try {
      const { alert } = await createAlert({ cameraId: camera.id, snapshot: null, simulated: true });
      onSelectAlert(alert.id);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "The alert could not be sent.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={inspectorClass}>
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "inline-flex h-9 shrink-0 items-center justify-center rounded-[10px] px-2 text-[12px] font-bold",
            openAlert
              ? "bg-accent-fill text-white"
              : online
                ? "bg-tile text-white"
                : "bg-sunken text-ink-3",
          )}
        >
          {cameraCode(camera.id)}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-[14px] font-semibold">{camera.name}</p>
            <Chip tone={openAlert ? "accent" : online ? "neutral" : "outline"} size="sm">
              <Dot className={openAlert ? "bg-white" : online ? "bg-ink" : "bg-ink-3"} />
              {openAlert
                ? `${incidentCode(openAlert)} active`
                : online
                  ? "Eye online"
                  : "Eye not open"}
            </Chip>
          </div>
          <p className="mt-0.5 text-[12px] text-ink-2">
            {camera.zone}
            {closest && (
              <>
                {" "}
                · Nearest guard: <b className="font-semibold text-ink">{closest.name}</b> (~
                {mapDistanceMetres(closest, camera)} m away)
              </>
            )}
          </p>
          {problem && (
            <p role="alert" className="mt-1 text-[12px] font-semibold text-accent-ink">
              {problem}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {openAlert ? (
          <Button
            size="sm"
            variant="accent"
            icon={Radio}
            onClick={() => onSelectAlert(openAlert.id)}
          >
            Inspect {incidentCode(openAlert)}
          </Button>
        ) : (
          demoMode && (
            <Button
              size="sm"
              variant="ink"
              icon={Send}
              disabled={sending}
              onClick={() => void simulate()}
            >
              Simulate alert here
            </Button>
          )
        )}
        <CloseButton label="Close camera details" onClick={onClose} />
      </div>
    </div>
  );
}

function GuardInspector({
  guard,
  cameras,
  state,
  onClose,
}: {
  guard: Guard;
  cameras: readonly Camera[];
  state: GuardState;
  onClose: () => void;
}) {
  const nearest = [...cameras].sort(
    (a, b) => Math.hypot(a.x - guard.x, a.y - guard.y) - Math.hypot(b.x - guard.x, b.y - guard.y),
  )[0];
  return (
    <div className={inspectorClass}>
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] text-[12px] font-bold",
            state === "responding"
              ? "bg-gold text-on-gold"
              : state === "ringing"
                ? "bg-accent-fill text-white"
                : state === "on_shift"
                  ? "bg-tile text-white"
                  : "bg-sunken text-ink-3",
          )}
        >
          {initials(guard.name)}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-[14px] font-semibold">{guard.name}</p>
            <Chip
              tone={state === "responding" ? "gold" : state === "ringing" ? "accent" : "neutral"}
              size="sm"
            >
              {GUARD_LABEL[state]}
            </Chip>
          </div>
          <p className="mt-0.5 text-[12px] text-ink-2">
            Patrol zone: {guard.zone}
            {nearest && (
              <>
                {" "}
                · Closest point: <b className="font-semibold text-ink">
                  {cameraCode(nearest.id)}
                </b>{" "}
                (~{mapDistanceMetres(guard, nearest)} m)
              </>
            )}
          </p>
        </div>
      </div>
      <CloseButton label="Close guard details" onClick={onClose} />
    </div>
  );
}

export function MapLegend({ demoMode }: { demoMode: boolean }) {
  const items = [
    { label: "Camera online", mark: <span className="size-2.5 rounded-full bg-ink" /> },
    {
      label: "Camera offline",
      mark: <span className="size-2.5 rounded-full border-[1.5px] border-dashed border-ink-3" />,
    },
    { label: "Active alert", mark: <span className="size-2.5 rounded-full bg-accent" /> },
    {
      label: "Guard on shift",
      mark: <span className="h-2.5 w-3.5 rounded-[4px] bg-tile dark:ring-1 dark:ring-white/30" />,
    },
    { label: "Guard ringing", mark: <span className="h-2.5 w-3.5 rounded-[4px] bg-accent" /> },
    { label: "Guard responding", mark: <span className="h-2.5 w-3.5 rounded-[4px] bg-gold" /> },
  ];
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <ul className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <li
            key={item.label}
            className="inline-flex h-7 items-center gap-2 rounded-full bg-card px-3 text-[12px] font-semibold text-ink-2"
          >
            <span aria-hidden="true" className="inline-flex">
              {item.mark}
            </span>
            {item.label}
          </li>
        ))}
      </ul>
      <span className="text-[12px] text-ink-3">
        {demoMode
          ? "Select a camera or guard to inspect it or simulate an alert"
          : "Select a camera or guard to inspect it"}
      </span>
    </div>
  );
}
