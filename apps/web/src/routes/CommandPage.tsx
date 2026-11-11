import type { Alert, AlertOutcome } from "@ishaara/server/types";
import { BellOff, BellRing, LoaderCircle, ShieldCheck, WifiOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AlertLog } from "../components/command/AlertLog";
import { AlertPanel } from "../components/command/AlertPanel";
import { CampusMap, MapLegend } from "../components/command/CampusMap";
import { GuardRoster } from "../components/command/GuardRoster";
import { Button, Card, EmptyState, PageHeader, StatusDot } from "../components/ui";
import { resolveAlert } from "../lib/actions";
import { currentRing, isOpen, needsResponder } from "../lib/alerts";
import { retryLoad, useAppState, useServerNow } from "../lib/appState";
import { audioUnlocked, startRinging, unlockAudio } from "../lib/audio";
import { cn } from "../lib/cn";
import { useDocumentTitle } from "../lib/hooks";
import { socket } from "../lib/socket";

const FLASH_MS = 1000;

function alarmText(alerts: readonly Alert[]): string {
  const [first, ...rest] = alerts;
  if (!first) return "";
  const ring = currentRing(first);
  const ringing = ring ? ` Ringing ${ring.guardName}.` : "";
  const more = rest.length > 0 ? ` ${rest.length} more waiting.` : "";
  return `Help signal at ${first.cameraLabel}. No guard has confirmed yet.${ringing}${more}`;
}

export function CommandPage() {
  const app = useAppState();
  const now = useServerNow(500);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pinnedFromLog, setPinnedFromLog] = useState(false);

  function follow(alertId: string | null) {
    setSelectedId(alertId);
    setPinnedFromLog(false);
  }

  function pinFromLog(alertId: string) {
    setSelectedId(alertId);
    setPinnedFromLog(true);
  }
  const [flashId, setFlashId] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(audioUnlocked);

  const alerts = useMemo(() => app.data?.alerts ?? [], [app.data?.alerts]);
  const openAlerts = useMemo(() => alerts.filter(isOpen), [alerts]);
  const unanswered = useMemo(() => openAlerts.filter(needsResponder), [openAlerts]);

  useDocumentTitle(unanswered.length > 0 ? `(${unanswered.length}) Alert` : "Ishaara Command");

  useEffect(() => {
    const onNew = (alert: Alert) => {
      setSelectedId(alert.id);
      setPinnedFromLog(false);
      setFlashId(alert.id);
    };
    socket.on("alert:new", onNew);
    return () => {
      socket.off("alert:new", onNew);
    };
  }, []);

  useEffect(() => {
    if (!flashId) return;
    const timer = setTimeout(() => setFlashId(null), FLASH_MS);
    return () => clearTimeout(timer);
  }, [flashId]);

  const alarming = soundOn && unanswered.length > 0;
  useEffect(() => {
    if (!alarming) return;
    return startRinging({ volume: 0.2, everyMs: 3000 });
  }, [alarming]);

  async function toggleSound() {
    if (soundOn) {
      setSoundOn(false);
      return;
    }
    setSoundOn(await unlockAudio());
  }

  if (app.status === "loading" || !app.data) {
    return (
      <div className="min-h-dvh bg-canvas">
        <PageHeader title="Ishaara Command" wide />
        <main className="mx-auto max-w-[90rem] px-4 py-6 sm:px-6">
          {app.status === "error" ? (
            <Card>
              <EmptyState
                icon={WifiOff}
                tone="alert"
                title="Cannot reach the Ishaara server"
                description={app.error}
                action={<Button onClick={retryLoad}>Try again</Button>}
              />
            </Card>
          ) : (
            <Card>
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-muted">
                <LoaderCircle size={16} aria-hidden="true" className="animate-spin" />
                Loading the campus map
              </div>
            </Card>
          )}
        </main>
      </div>
    );
  }

  const { campus, cameras, guards, camerasOnline, guardsOnShift } = app.data;
  const selected =
    (pinnedFromLog ? alerts.find((alert) => alert.id === selectedId) : undefined) ??
    openAlerts.find((alert) => alert.id === selectedId) ??
    unanswered[0] ??
    openAlerts[0] ??
    null;
  const viewingClosed = selected !== null && !isOpen(selected);

  async function close(outcome: AlertOutcome): Promise<string | null> {
    if (!selected) return null;
    const reply = await resolveAlert(selected.id, outcome);
    return reply.ok ? null : reply.error;
  }

  function selectCamera(cameraId: string) {
    const alert = openAlerts.find((item) => item.cameraId === cameraId);
    if (alert) follow(alert.id);
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <PageHeader
        title="Ishaara Command"
        description={`Security dashboard for ${campus.name}.`}
        wide
        actions={
          <>
            {app.connected ? (
              <StatusDot tone="ok">Live</StatusDot>
            ) : (
              <StatusDot tone="alert">Reconnecting</StatusDot>
            )}
            <span className="text-sm text-ink-muted tabular-nums">
              {guardsOnShift.length} of {guards.length} guards on shift
            </span>
            <Button
              icon={soundOn ? BellRing : BellOff}
              onClick={() => void toggleSound()}
              aria-pressed={soundOn}
            >
              {soundOn ? "Alarm sound on" : "Turn on alarm sound"}
            </Button>
          </>
        }
      />

      {unanswered.length > 0 && (
        <div role="alert" className="bg-alert text-on-accent">
          <p className="mx-auto max-w-[90rem] px-4 py-3 text-sm font-medium sm:px-6">
            {alarmText(unanswered)}
          </p>
        </div>
      )}
      {!app.connected && (
        <div role="status" className="border-b border-line bg-ringing-soft">
          <p className="mx-auto max-w-[90rem] px-4 py-2 text-sm text-ringing sm:px-6">
            Connection to the server lost. Reconnecting. New alerts may be delayed.
          </p>
        </div>
      )}

      <main className="mx-auto grid max-w-[90rem] gap-6 px-4 py-6 sm:px-6 xl:grid-cols-[minmax(0,1fr)_28rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card
            title="Campus map"
            description={`${camerasOnline.length} of ${cameras.length} cameras online`}
            padded={false}
          >
            <div className="border-b border-line">
              <CampusMap
                campus={campus}
                cameras={cameras}
                guards={guards}
                camerasOnline={camerasOnline}
                guardsOnShift={guardsOnShift}
                openAlerts={openAlerts}
                selectedAlertId={selected?.id ?? null}
                onSelectCamera={selectCamera}
              />
            </div>
            <div className="px-4 py-3">
              <MapLegend />
            </div>
          </Card>

          <Card title="Alert log" description="The last 50 alerts, newest first." padded={false}>
            <AlertLog alerts={alerts} selectedId={selected?.id ?? null} onSelect={pinFromLog} />
          </Card>
        </div>

        <aside className="flex min-w-0 flex-col gap-6">
          {openAlerts.length > 1 && (
            <nav aria-label="Open alerts" className="flex flex-wrap gap-2">
              {openAlerts.map((alert) => (
                <button
                  key={alert.id}
                  type="button"
                  onClick={() => follow(alert.id)}
                  aria-pressed={alert.id === selected?.id}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-sm",
                    alert.id === selected?.id
                      ? "border-accent bg-accent-soft font-medium text-accent"
                      : "border-line bg-surface text-ink hover:bg-sunken",
                  )}
                >
                  <span className="tabular-nums">#{alert.number}</span> {alert.cameraLabel}
                </button>
              ))}
            </nav>
          )}

          {viewingClosed && (
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-ink-muted">Viewing a closed alert from the log.</span>
              <Button variant="quiet" onClick={() => follow(null)}>
                Back to live
              </Button>
            </div>
          )}

          {selected ? (
            <AlertPanel
              key={selected.id}
              alert={selected}
              now={now}
              flash={selected.id === flashId}
              onClose={close}
            />
          ) : (
            <Card>
              <EmptyState
                icon={ShieldCheck}
                title={`No active alerts. ${camerasOnline.length} of ${cameras.length} cameras online.`}
                description="When a camera sees the Signal for Help, the alert appears here and guards are rung one at a time, nearest first."
              />
            </Card>
          )}

          <Card title="Guards" description="Rung nearest to the camera first.">
            <GuardRoster guards={guards} guardsOnShift={guardsOnShift} openAlerts={openAlerts} />
          </Card>
        </aside>
      </main>
    </div>
  );
}
