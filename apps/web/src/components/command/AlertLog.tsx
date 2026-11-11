import type { Alert } from "@ishaara/server/types";
import { alertStatus } from "../../lib/alerts";
import { cn } from "../../lib/cn";
import { formatElapsed, formatTime } from "../../lib/format";
import { StatusDot } from "../ui";

export interface AlertLogProps {
  alerts: readonly Alert[];
  selectedId: string | null;
  onSelect: (alertId: string) => void;
}

export function AlertLog({ alerts, selectedId, onSelect }: AlertLogProps) {
  if (alerts.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-ink-muted">
        No alerts yet. Every alert is listed here once it is raised.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="border-b border-line bg-canvas text-ink-muted">
          <tr>
            <th scope="col" className="px-4 py-2 font-medium">
              Alert
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Camera
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Raised
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Status
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Response time
            </th>
          </tr>
        </thead>
        <tbody>
          {alerts.map((alert) => {
            const view = alertStatus(alert);
            const selected = alert.id === selectedId;
            return (
              <tr
                key={alert.id}
                className={cn(
                  "border-b border-line last:border-b-0",
                  selected ? "bg-accent-soft" : "hover:bg-canvas",
                )}
              >
                <td className="px-4 py-2 tabular-nums">
                  <button
                    type="button"
                    onClick={() => onSelect(alert.id)}
                    aria-pressed={selected}
                    className="rounded-md font-medium text-accent underline-offset-2 hover:underline"
                  >
                    #{alert.number}
                  </button>
                </td>
                <td className="px-4 py-2">
                  {alert.cameraLabel}
                  {alert.source === "simulated" && (
                    <span className="text-ink-faint"> · simulated</span>
                  )}
                </td>
                <td className="px-4 py-2 tabular-nums">{formatTime(alert.createdAt)}</td>
                <td className="px-4 py-2">
                  <StatusDot tone={view.tone} pulse={view.pulse}>
                    {view.label}
                  </StatusDot>
                </td>
                <td className="px-4 py-2 text-ink-muted tabular-nums">
                  {alert.respondedAt !== null
                    ? `${formatElapsed(alert.respondedAt - alert.createdAt)} to confirm`
                    : "None"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
