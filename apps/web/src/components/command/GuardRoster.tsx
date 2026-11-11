import type { Alert, Guard } from "@ishaara/server/types";
import { StatusDot } from "../ui";

export interface GuardRosterProps {
  guards: readonly Guard[];
  guardsOnShift: readonly string[];
  openAlerts: readonly Alert[];
}

export function GuardRoster({ guards, guardsOnShift, openAlerts }: GuardRosterProps) {
  return (
    <ul className="flex flex-col">
      {guards.map((guard) => {
        const responding = openAlerts.find((alert) => alert.responderId === guard.id);
        const onShift = guardsOnShift.includes(guard.id);
        return (
          <li
            key={guard.id}
            className="flex items-start justify-between gap-4 border-b border-line py-2 text-sm last:border-b-0"
          >
            <span className="min-w-0">
              <span className="block font-medium text-ink">{guard.name}</span>
              <span className="block text-ink-muted">{guard.zone}</span>
            </span>
            {responding ? (
              <StatusDot tone="ok">Responding to #{responding.number}</StatusDot>
            ) : onShift ? (
              <StatusDot tone="accent">On shift</StatusDot>
            ) : (
              <StatusDot tone="neutral">App not open</StatusDot>
            )}
          </li>
        );
      })}
    </ul>
  );
}
