import type { Alert, Camera, Guard, PublicConfig } from "@ishaara/server/types";
import type { LucideIcon } from "lucide-react";
import { Download, Send, Volume2 } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { createAlert } from "../../lib/api";
import {
  alertStatus,
  guardState,
  incidentCode,
  initials,
  isOpen,
  missedAttempts,
  toneDot,
  toneText,
  type GuardState,
} from "../../lib/alerts";
import { startRinging, unlockAudio } from "../../lib/audio";
import { cn } from "../../lib/cn";
import { formatElapsed, formatShortTime, formatTime } from "../../lib/format";
import { Button, Card, CardHead, Chip, Dot, IconTile, Segmented, Select } from "../ui";

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();

const emptyBox = "mt-4 rounded-[18px] bg-sunken px-4 py-6 text-center text-[13px] text-ink-2";

export function Kpi({
  icon,
  label,
  value,
  of,
  chip,
  children,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  of: number;
  chip: string;
  children: ReactNode;
}) {
  return (
    <Card
      notch={
        <Chip size="sm" className="bg-card">
          {chip}
        </Chip>
      }
      className="flex min-h-[200px] flex-col justify-end p-5 pt-12"
    >
      <IconTile icon={icon} size="sm" />
      <p className="mt-2.5 text-[15px] font-medium tracking-[-0.02em]">{label}</p>
      <div className="mt-1 flex items-end justify-between">
        <span className="text-[34px] leading-none font-bold tracking-[-0.05em] tabular">
          {value}
          <span className="text-[17px] font-semibold text-ink-3">/{of}</span>
        </span>
        {children}
      </div>
    </Card>
  );
}

export function StatStrip({
  unconfirmed,
  active,
  camerasOnline,
  cameraCount,
  onShift,
  guardCount,
}: {
  unconfirmed: number;
  active: number;
  camerasOnline: number;
  cameraCount: number;
  onShift: number;
  guardCount: number;
}) {
  const items = [
    {
      label: "Active alerts",
      value: active,
      sub: unconfirmed ? `${unconfirmed} unconfirmed` : "All confirmed",
      hot: true,
    },
    { label: "Cameras online", value: camerasOnline, sub: `of ${cameraCount}`, hot: false },
    { label: "Guards on shift", value: onShift, sub: `of ${guardCount}`, hot: false },
  ];
  return (
    <Card className="p-5">
      <dl className="grid grid-cols-3 divide-x divide-line">
        {items.map((item) => (
          <div key={item.label} className="min-w-0 px-4 first:pl-0 last:pr-0">
            <dt className="text-[12px] font-medium text-ink-2">{item.label}</dt>
            <dd
              className={cn(
                "mt-1.5 text-[28px] leading-none font-bold tracking-[-0.05em] tabular",
                item.hot && "text-accent-ink",
              )}
            >
              {item.value}
            </dd>
            <dd className="mt-1.5 truncate text-[12px] text-ink-3">{item.sub}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function guardRecord(alerts: readonly Alert[], guardId: string) {
  const rings = alerts.flatMap((alert) =>
    alert.attempts.filter(
      (attempt) => attempt.guardId === guardId && attempt.reached && attempt.outcome !== "ringing",
    ),
  );
  const accepted = rings.filter((attempt) => attempt.outcome === "confirmed");
  return {
    accepted: accepted.length,
    missed: rings.filter((attempt) => attempt.outcome === "no_answer").length,
    answer: median(
      accepted
        .filter((attempt) => attempt.endedAt !== null)
        .map((attempt) => attempt.endedAt! - attempt.startedAt),
    ),
  };
}

const GUARD_UI: Record<GuardState, { label: string; dot: string; tile: string }> = {
  offline: { label: "App not open", dot: "bg-ink-3", tile: "bg-sunken text-ink-3" },
  on_shift: { label: "Available", dot: "bg-ink", tile: "bg-tile text-white" },
  ringing: { label: "Ringing", dot: "bg-accent", tile: "bg-accent-fill text-white" },
  responding: { label: "Responding", dot: "bg-gold", tile: "bg-gold text-on-gold" },
};

export function GuardsCard({
  guards,
  guardsOnShift,
  alerts,
  phoneCalls,
}: {
  guards: readonly Guard[];
  guardsOnShift: readonly string[];
  alerts: readonly Alert[];
  phoneCalls: boolean;
}) {
  const open = alerts.filter(isOpen);
  const states = guards.map((guard) => guardState(guard.id, guardsOnShift, open));
  return (
    <Card notch className="p-6">
      <CardHead
        title="Guards"
        sub={
          phoneCalls
            ? "Rung in the Guard app and by phone, nearest to the camera first."
            : "Rung in the Guard app, nearest to the camera first."
        }
        right={
          <Chip tone="outline" size="sm">
            {states.filter((state) => state === "on_shift").length} available
          </Chip>
        }
      />
      <ul className="mt-4 flex flex-col divide-y divide-line">
        {guards.map((guard, index) => {
          const ui = GUARD_UI[states[index]!];
          const record = guardRecord(alerts, guard.id);
          const responding = open.find((alert) => alert.responderId === guard.id);
          return (
            <li key={guard.id} className="flex items-center gap-3 py-3">
              <span
                className={cn(
                  "inline-flex size-10 shrink-0 items-center justify-center rounded-[12px] text-[13px] font-bold",
                  ui.tile,
                )}
              >
                {initials(guard.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold">{guard.name}</span>
                <span className="block text-[12px] text-ink-2">{guard.zone}</span>
                <span className="mt-0.5 block text-[12px] text-ink-3 tabular">
                  {record.accepted + record.missed === 0
                    ? "Not rung yet"
                    : `${record.accepted} accepted · ${record.missed} missed${record.answer !== null ? ` · answers in ${formatElapsed(record.answer)}` : ""}`}
                </span>
              </span>
              <span className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-2">
                <Dot className={ui.dot} pulse={states[index] === "ringing"} />
                {responding ? `Responding to ${incidentCode(responding)}` : ui.label}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

type LogFilter = "all" | "active" | "resolved" | "false_alarm";

const LOG_FILTERS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "resolved", label: "Resolved" },
  { value: "false_alarm", label: "False alarm" },
] as const;

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportAlertsCsv(alerts: readonly Alert[]): void {
  const iso = (time: number | null) => (time ? new Date(time).toISOString() : "");
  const rows = [
    [
      "Alert",
      "Camera",
      "Source",
      "Raised",
      "Status",
      "Responder",
      "Seconds to confirm",
      "Closed",
      "Guards rung",
    ],
    ...alerts.map((alert) => [
      incidentCode(alert),
      alert.cameraLabel,
      alert.source,
      iso(alert.createdAt),
      alert.status,
      alert.responderName ?? "",
      alert.respondedAt ? Math.round((alert.respondedAt - alert.createdAt) / 1000) : "",
      iso(alert.closedAt),
      alert.attempts.filter((attempt) => attempt.reached).length,
    ]),
  ];
  const blob = new Blob([rows.map((row) => row.map(csvCell).join(",")).join("\n")], {
    type: "text/csv",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ishaara-alerts-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function AlertLog({
  alerts: all,
  cameras,
  selectedId,
  onSelect,
}: {
  alerts: readonly Alert[];
  cameras: readonly Camera[];
  selectedId: string | null;
  onSelect: (alertId: string) => void;
}) {
  const [status, setStatus] = useState<LogFilter>("all");
  const [cameraId, setCameraId] = useState("");
  const cameraSelectId = useId();
  const alerts = all.filter(
    (alert) =>
      (status === "all" || (status === "active" ? isOpen(alert) : alert.status === status)) &&
      (cameraId === "" || alert.cameraId === cameraId),
  );

  return (
    <Card className="p-5 sm:p-6">
      <CardHead
        title="Alert log"
        sub="The last 50 alerts, newest first."
        right={
          alerts.length > 0 ? (
            <Button
              size="sm"
              variant="ghost"
              icon={Download}
              onClick={() => exportAlertsCsv(alerts)}
            >
              Export CSV
            </Button>
          ) : undefined
        }
      />
      {all.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Segmented
            label="Filter by status"
            value={status}
            options={LOG_FILTERS}
            onChange={setStatus}
          />
          <label htmlFor={cameraSelectId} className="sr-only">
            Filter by camera
          </label>
          <Select
            id={cameraSelectId}
            compact
            wrapperClassName="w-full sm:w-[240px]"
            value={cameraId}
            onChange={(event) => setCameraId(event.target.value)}
          >
            <option value="">All cameras</option>
            {cameras.map((camera) => (
              <option key={camera.id} value={camera.id}>
                {camera.name}
              </option>
            ))}
          </Select>
          <span className="ml-auto text-[12px] text-ink-3 tabular">
            {alerts.length} of {all.length}
          </span>
        </div>
      )}
      {all.length === 0 ? (
        <p className={cn(emptyBox, "mt-5 py-8")}>
          No alerts yet. Open Ishaara Eye on any camera device to start watching.
        </p>
      ) : alerts.length === 0 ? (
        <div className={cn(emptyBox, "py-8")}>
          <p className="text-[14px] font-semibold text-ink">No alerts match these filters</p>
          <button
            type="button"
            onClick={() => {
              setStatus("all");
              setCameraId("");
            }}
            className="mt-2 rounded-md text-[13px] font-semibold text-accent-ink underline underline-offset-4"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="-mx-2 mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] border-separate border-spacing-y-1 text-left text-[13px]">
            <thead>
              <tr className="text-[12px] text-ink-3">
                <th scope="col" className="px-4 py-2 font-semibold">
                  Alert
                </th>
                <th scope="col" className="px-4 py-2 font-semibold">
                  Camera
                </th>
                <th scope="col" className="px-4 py-2 font-semibold">
                  Raised
                </th>
                <th scope="col" className="px-4 py-2 font-semibold">
                  Status
                </th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">
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
                    onClick={() => onSelect(alert.id)}
                    className={cn(
                      "cursor-pointer transition-colors [&>td]:py-3",
                      selected ? "bg-sunken" : "hover:bg-sunken/60",
                    )}
                  >
                    <td className="rounded-l-[12px] px-4 font-bold tabular">
                      <button
                        type="button"
                        aria-current={selected ? "true" : undefined}
                        aria-label={`Open incident ${incidentCode(alert)}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelect(alert.id);
                        }}
                        className="rounded-md underline decoration-ink-3/50 underline-offset-4 hover:decoration-ink"
                      >
                        {incidentCode(alert)}
                      </button>
                    </td>
                    <td className="px-4 font-medium">
                      {alert.cameraLabel}
                      {alert.source === "simulated" && (
                        <span className="font-normal text-ink-3"> · simulated</span>
                      )}
                    </td>
                    <td className="px-4 text-ink-2 tabular">{formatTime(alert.createdAt)}</td>
                    <td className="px-4">
                      <span
                        className={cn(
                          "inline-flex items-center gap-2 font-semibold",
                          toneText[view.tone],
                        )}
                      >
                        <Dot className={toneDot[view.tone]} pulse={view.pulse} />
                        {view.label}
                      </span>
                    </td>
                    <td className="rounded-r-[12px] px-4 text-right text-ink-2 tabular">
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
      )}
    </Card>
  );
}

const wasEscalated = (alert: Alert) => missedAttempts(alert).length > 0;

export function ResponsePerformance({ alerts, now }: { alerts: readonly Alert[]; now: number }) {
  const today = alerts.filter((alert) => sameDay(alert.createdAt, now));
  const toConfirm = median(
    today
      .filter((alert) => alert.respondedAt !== null)
      .map((alert) => alert.respondedAt! - alert.createdAt),
  );
  const falseAlarms = today.filter((alert) => alert.status === "false_alarm").length;
  const metrics = [
    {
      label: "Alerts today",
      value: String(today.length),
      sub: `${today.filter(isOpen).length} still open`,
    },
    {
      label: "Median time to confirm",
      value: toConfirm === null ? "–" : formatElapsed(toConfirm),
      sub: "Signal to a guard saying “I’m going”",
    },
    {
      label: "Escalated",
      value: String(today.filter(wasEscalated).length),
      sub: "A guard did not answer in time",
    },
    {
      label: "False alarms",
      value: String(falseAlarms),
      sub: today.length
        ? `${Math.round((falseAlarms / today.length) * 100)}% of today’s alerts`
        : "None today",
    },
  ];

  const recent = alerts.slice(0, 10).reverse();
  const times = recent.map(
    (alert) =>
      (alert.respondedAt ?? (isOpen(alert) ? now : (alert.closedAt ?? now))) - alert.createdAt,
  );
  const longest = Math.max(30_000, ...times);

  return (
    <Card className="p-5 sm:p-6">
      <CardHead title="Response performance" sub="Today, from the alerts on this server." />
      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="min-w-0">
            <dt className="text-[12px] font-medium text-ink-2">{metric.label}</dt>
            <dd className="mt-1 text-[26px] leading-none font-bold tracking-[-0.045em] tabular">
              {metric.value}
            </dd>
            <dd className="mt-1.5 text-[12px] leading-snug text-ink-3">{metric.sub}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 border-t border-line pt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[14px] font-semibold">
            Time to confirm, last {recent.length || 10} alerts
          </h3>
          <span className="flex flex-wrap items-center gap-3 text-[12px] text-ink-2">
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2 rounded-full bg-ink" /> Confirmed
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2 rounded-full bg-accent" /> Waiting
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2 rounded-full bg-ink/20 dark:bg-white/20" />
              Closed unconfirmed
            </span>
          </span>
        </div>
        {recent.length === 0 ? (
          <p className={emptyBox}>Bars appear here as alerts come in.</p>
        ) : (
          <ol
            className="mt-4 flex h-[120px] items-end gap-2"
            aria-label="Time to confirm for recent alerts"
          >
            {recent.map((alert, index) => {
              const time = times[index]!;
              const confirmed = alert.respondedAt !== null;
              const waiting = !confirmed && isOpen(alert);
              const label = confirmed
                ? `${formatElapsed(time)} to confirm`
                : waiting
                  ? `waiting ${formatElapsed(time)}`
                  : "closed without a confirmation";
              return (
                <li
                  key={alert.id}
                  className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
                  title={`${incidentCode(alert)} · ${label}`}
                >
                  <span aria-hidden="true" className="text-[11px] font-semibold text-ink-2 tabular">
                    {confirmed || waiting ? formatElapsed(time) : "–"}
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "w-full max-w-[36px] rounded-t-[8px] transition-[height] duration-500",
                      confirmed ? "bg-ink" : waiting ? "bg-accent" : "bg-ink/20 dark:bg-white/20",
                    )}
                    style={{ height: `${Math.max(6, (time / longest) * 80)}%` }}
                  />
                  <span aria-hidden="true" className="text-[11px] font-semibold text-ink-3 tabular">
                    {String(alert.number).padStart(3, "0")}
                  </span>
                  <span className="sr-only">
                    Incident {incidentCode(alert)}: {label}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </Card>
  );
}

interface FeedItem {
  key: string;
  at: number;
  alert: Alert;
  text: string;
  dot: string;
}

function feedItems(alerts: readonly Alert[]): FeedItem[] {
  const items: FeedItem[] = [];
  for (const alert of alerts) {
    items.push({
      key: `${alert.id}-raised`,
      at: alert.createdAt,
      alert,
      text: `Help signal at ${alert.cameraLabel}${alert.source === "simulated" ? " (simulated)" : ""}`,
      dot: "bg-accent",
    });
    alert.attempts.forEach((attempt, index) => {
      const key = `${alert.id}-${index}`;
      if (attempt.outcome === "ringing")
        items.push({
          key,
          at: attempt.startedAt,
          alert,
          text: `Ringing ${attempt.guardName}`,
          dot: "bg-accent",
        });
      else if (attempt.outcome === "confirmed")
        items.push({
          key,
          at: attempt.endedAt ?? attempt.startedAt,
          alert,
          text: `${attempt.guardName} is going`,
          dot: "bg-gold",
        });
      else if (attempt.outcome === "no_answer")
        items.push({
          key,
          at: attempt.endedAt ?? attempt.endsAt,
          alert,
          text: attempt.reached
            ? `${attempt.guardName} did not answer`
            : `${attempt.guardName} not reachable, app closed`,
          dot: "bg-ink-3",
        });
    });
    if (alert.closedAt !== null)
      items.push({
        key: `${alert.id}-closed`,
        at: alert.closedAt,
        alert,
        text: alert.status === "resolved" ? "Resolved by Command" : "Marked false alarm",
        dot: "bg-ink",
      });
  }
  return items.sort((a, b) => b.at - a.at);
}

export function ActivityFeed({
  alerts,
  onSelect,
}: {
  alerts: readonly Alert[];
  onSelect: (alertId: string) => void;
}) {
  const items = feedItems(alerts).slice(0, 14);
  return (
    <Card className="p-6">
      <CardHead title="Activity" sub="Every ring, answer and closure, newest first." />
      {items.length === 0 ? (
        <p className={emptyBox}>Nothing has happened yet.</p>
      ) : (
        <ol className="mt-3 flex flex-col">
          {items.map((item) => (
            <li
              key={item.key}
              className="flex items-start gap-3 border-t border-line py-2.5 first:border-t-0"
            >
              <span className="w-[86px] shrink-0 pt-px text-[12px] whitespace-nowrap text-ink-3 tabular">
                {formatTime(item.at)}
              </span>
              <span
                aria-hidden="true"
                className={cn("mt-[5px] size-2 shrink-0 rounded-full", item.dot)}
              />
              <span className="min-w-0 flex-1 text-[13px] leading-snug">{item.text}</span>
              <button
                type="button"
                onClick={() => onSelect(item.alert.id)}
                aria-label={`Open incident ${incidentCode(item.alert)}`}
                className="shrink-0 rounded-md text-[12px] font-bold text-ink-2 underline decoration-ink-3/50 underline-offset-4 tabular hover:text-ink"
              >
                {incidentCode(item.alert)}
              </button>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export function CamerasPanel({
  cameras,
  camerasOnline,
  alerts,
  demoMode,
  onSent,
}: {
  cameras: readonly Camera[];
  camerasOnline: readonly string[];
  alerts: readonly Alert[];
  demoMode: boolean;
  onSent: (alertId: string) => void;
}) {
  const [problem, setProblem] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  async function test(cameraId: string) {
    setSendingId(cameraId);
    setProblem(null);
    try {
      const { alert } = await createAlert({ cameraId, snapshot: null, simulated: true });
      onSent(alert.id);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "The test alert could not be sent.");
    } finally {
      setSendingId(null);
    }
  }

  return (
    <Card className="p-6">
      <CardHead title="Cameras" sub="Online means Ishaara Eye is open for that camera." />
      <ul className="mt-3 divide-y divide-line">
        {cameras.map((camera) => {
          const online = camerasOnline.includes(camera.id);
          const mine = alerts.filter((alert) => alert.cameraId === camera.id);
          const open = mine.find(isOpen);
          return (
            <li key={camera.id} className="flex items-center gap-3 py-3">
              <span
                className={cn(
                  "inline-flex size-9 shrink-0 items-center justify-center rounded-[12px] text-[13px] font-bold",
                  open
                    ? "bg-accent-fill text-white"
                    : online
                      ? "bg-tile text-white"
                      : "bg-sunken text-ink-3",
                )}
              >
                {camera.id.replace(/\D/g, "")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold">{camera.name}</span>
                <span className="flex flex-wrap items-center gap-1.5 text-[12px] text-ink-2">
                  <Dot className={online ? "bg-ink" : "bg-ink-3"} />
                  {online ? "Online" : "Eye not open"}
                  <span className="text-ink-3">·</span>
                  {open
                    ? `${incidentCode(open)} open`
                    : mine[0]
                      ? `Last alert ${formatShortTime(mine[0].createdAt)}`
                      : "No alerts"}
                </span>
              </span>
              {demoMode && (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={Send}
                  disabled={open !== undefined || sendingId !== null}
                  aria-label={`Send a test alert from ${camera.name}`}
                  onClick={() => void test(camera.id)}
                >
                  Test
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {problem && (
        <p role="alert" className="mt-2 text-[12px] font-semibold text-accent-ink">
          {problem}
        </p>
      )}
      {demoMode && (
        <p className="mt-3 text-[12px] text-ink-3">
          Test alerts are marked as simulated and ring guards for real.
        </p>
      )}
    </Card>
  );
}

export function EscalationCard({ config }: { config: PublicConfig }) {
  const seconds = Math.round(config.ringMs / 1000);
  return (
    <Card className="p-6">
      <CardHead
        title="Escalation"
        sub={`Guards are rung one at a time, nearest first. Each has ${seconds} s to answer before the next is rung. If nobody confirms, the chain starts again.`}
      />
      <dl className="mt-4 grid grid-cols-2 gap-1 rounded-[18px] bg-sunken p-1 text-center text-[13px]">
        <div className="rounded-[14px] bg-card px-3 py-2.5">
          <dt className="text-[12px] text-ink-2">Ring window</dt>
          <dd className="font-semibold tabular">
            {seconds} s · {config.demoMode ? "demo" : "standard"}
          </dd>
        </div>
        <div className="rounded-[14px] bg-card px-3 py-2.5">
          <dt className="text-[12px] text-ink-2">Phone calls</dt>
          <dd className="font-semibold">{config.phoneCalls ? "On" : "Off"}</dd>
        </div>
      </dl>
      <div className="mt-4 flex items-center justify-between gap-3 rounded-[18px] bg-sunken p-4">
        <span className="text-[13px]">
          <span className="block font-semibold">Alarm sound</span>
          <span className="block text-ink-2">
            Plays in this room while an alert is unconfirmed.
          </span>
        </span>
        <Button
          size="sm"
          variant="ink"
          icon={Volume2}
          onClick={async () => {
            if (await unlockAudio()) {
              const stop = startRinging({ volume: 0.2, everyMs: 60_000 });
              setTimeout(stop, 1200);
            }
          }}
        >
          Test
        </Button>
      </div>
    </Card>
  );
}
