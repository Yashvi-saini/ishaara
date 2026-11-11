import type { Alert, Camera, Campus, Guard } from "@ishaara/server/types";
import { cn } from "../../lib/cn";

export interface CampusMapProps {
  campus: Campus;
  cameras: readonly Camera[];
  guards: readonly Guard[];
  camerasOnline: readonly string[];
  guardsOnShift: readonly string[];
  openAlerts: readonly Alert[];
  selectedAlertId: string | null;
  onSelectCamera?: (cameraId: string) => void;
}

function cameraNumber(camera: Camera): string {
  return camera.id.replace(/\D/g, "") || "?";
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function CampusMap({
  campus,
  cameras,
  guards,
  camerasOnline,
  guardsOnShift,
  openAlerts,
  selectedAlertId,
  onSelectCamera,
}: CampusMapProps) {
  const { map } = campus;
  const alertByCamera = new Map<string, Alert>();
  for (const alert of openAlerts) {
    if (!alertByCamera.has(alert.cameraId)) alertByCamera.set(alert.cameraId, alert);
  }
  const responders = new Set(
    openAlerts.map((alert) => alert.responderId).filter((id): id is string => id !== null),
  );

  const description =
    openAlerts.length === 0
      ? `Map of ${campus.name} with ${cameras.length} cameras. No active alerts.`
      : `Map of ${campus.name}. Active alerts at ${openAlerts.map((alert) => alert.cameraLabel).join(", ")}.`;

  return (
    <svg
      viewBox={`0 0 ${map.width} ${map.height}`}
      role="img"
      aria-label={description}
      className="block h-auto w-full bg-surface"
    >
      <defs>
        <pattern id="parking-lines" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M0 0 V24" className="stroke-line" strokeWidth="2" />
        </pattern>
      </defs>

      {map.roads.map((road, index) => (
        <polyline
          key={index}
          points={road.map(([x, y]) => `${x},${y}`).join(" ")}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="22"
          className="stroke-sunken"
        />
      ))}

      {map.buildings.map((building) => (
        <g key={building.id}>
          <rect
            x={building.x}
            y={building.y}
            width={building.width}
            height={building.height}
            rx="6"
            className={cn(
              "stroke-line-strong",
              building.kind === "gate" ? "fill-line-strong" : "fill-canvas",
            )}
            strokeWidth="1.5"
          />
          {building.kind === "parking" && (
            <rect
              x={building.x + 12}
              y={building.y + 36}
              width={building.width - 24}
              height={building.height - 48}
              fill="url(#parking-lines)"
            />
          )}
          <text
            x={building.x + building.width / 2}
            y={building.kind === "gate" ? building.y + building.height + 18 : building.y + 22}
            textAnchor="middle"
            className="fill-ink-muted text-[15px] font-medium"
          >
            {building.label}
          </text>
        </g>
      ))}

      {guards.map((guard) => {
        const onShift = guardsOnShift.includes(guard.id);
        const responding = responders.has(guard.id);
        return (
          <g key={guard.id} transform={`translate(${guard.x} ${guard.y})`}>
            <rect
              x="-14"
              y="-14"
              width="28"
              height="28"
              rx="6"
              strokeWidth="2"
              className={cn(
                responding
                  ? "fill-ok stroke-ok"
                  : onShift
                    ? "fill-accent stroke-accent"
                    : "fill-surface stroke-line-strong",
              )}
            />
            <text
              y="5"
              textAnchor="middle"
              className={cn(
                "text-[12px] font-semibold",
                onShift || responding ? "fill-on-accent" : "fill-ink-faint",
              )}
            >
              {initials(guard.name)}
            </text>
          </g>
        );
      })}

      {cameras.map((camera) => {
        const alert = alertByCamera.get(camera.id);
        const online = camerasOnline.includes(camera.id);
        const selected = alert !== undefined && alert.id === selectedAlertId;
        const responding = alert?.status === "responding";
        const fill = alert
          ? responding
            ? "fill-ok"
            : "fill-alert"
          : online
            ? "fill-ink"
            : "fill-surface";
        return (
          <g
            key={camera.id}
            transform={`translate(${camera.x} ${camera.y})`}
            onClick={onSelectCamera ? () => onSelectCamera(camera.id) : undefined}
            className={cn(onSelectCamera && alert && "cursor-pointer")}
          >
            {alert && !responding && (
              <circle
                r="26"
                fill="none"
                strokeWidth="3"
                className="animate-ring-pulse stroke-alert"
              />
            )}
            {selected && (
              <circle
                r="20"
                fill="none"
                strokeWidth="2"
                className="stroke-ink"
                strokeDasharray="4 3"
              />
            )}
            <circle
              r="13"
              strokeWidth="2"
              className={cn(
                fill,
                alert ? "stroke-surface" : online ? "stroke-ink" : "stroke-line-strong",
              )}
            />
            <text
              y="4.5"
              textAnchor="middle"
              className={cn(
                "text-[12px] font-semibold",
                alert || online ? "fill-on-accent" : "fill-ink-faint",
              )}
            >
              {cameraNumber(camera)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function MapLegend() {
  const item = "inline-flex items-center gap-2";
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-muted">
      <li className={item}>
        <span aria-hidden="true" className="size-3 rounded-full border-2 border-ink bg-ink" />
        Camera online
      </li>
      <li className={item}>
        <span
          aria-hidden="true"
          className="size-3 rounded-full border-2 border-line-strong bg-surface"
        />
        Camera offline
      </li>
      <li className={item}>
        <span aria-hidden="true" className="size-3 rounded-full bg-alert" />
        Active alert
      </li>
      <li className={item}>
        <span aria-hidden="true" className="size-3 rounded-sm bg-accent" />
        Guard on shift
      </li>
      <li className={item}>
        <span aria-hidden="true" className="size-3 rounded-sm bg-ok" />
        Guard responding
      </li>
    </ul>
  );
}
