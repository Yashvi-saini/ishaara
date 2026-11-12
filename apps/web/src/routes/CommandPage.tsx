import type { Alert, AlertOutcome } from "@ishaara/server/types";
import { Bell, BellOff, Camera, ShieldCheck, Siren, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AlertDetail } from "../components/command/AlertDetail";
import { CampusMap, MapLegend } from "../components/command/CampusMap";
import {
  ActivityFeed,
  AlertLog,
  CamerasPanel,
  EscalationCard,
  GuardsCard,
  Kpi,
  ResponsePerformance,
  StatStrip,
} from "../components/command/Panels";
import {
  Button,
  Card,
  CardHead,
  Chip,
  Dashes,
  Deck,
  Dot,
  PageHead,
  ServerProblem,
} from "../components/ui";
import { resolveAlert } from "../lib/actions";
import { currentRing, forwardedFrom, incidentCode, isOpen, needsResponder } from "../lib/alerts";
import { retryLoad, useAppState, useServerNow } from "../lib/appState";
import { audioUnlocked, startRinging, unlockAudio, unlockAudioOnFirstGesture } from "../lib/audio";
import { cn } from "../lib/cn";
import { formatElapsed, formatLongDate, formatSeconds } from "../lib/format";
import { useDocumentTitle } from "../lib/hooks";
import { socket } from "../lib/socket";

function bannerText(alert: Alert): string {
  if (alert.status === "responding")
    return `${alert.responderName ?? "A guard"} is on the way to ${alert.cameraLabel}.`;
  const ring = currentRing(alert);
  return `Help signal at ${alert.cameraLabel}. No guard has confirmed yet.${ring ? ` Ringing ${ring.guardName}.` : ""}`;
}

export function CommandPage() {
  const app = useAppState();
  const now = useServerNow(500);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pinnedFromLog, setPinnedFromLog] = useState(false);
  const [soundWanted, setSoundWanted] = useState(true);
  const [soundUnlocked, setSoundUnlocked] = useState(audioUnlocked);

  useEffect(() => unlockAudioOnFirstGesture(() => setSoundUnlocked(true)), []);

  const alerts = useMemo(() => app.data?.alerts ?? [], [app.data?.alerts]);
  const openAlerts = useMemo(() => alerts.filter(isOpen), [alerts]);
  const unanswered = useMemo(() => openAlerts.filter(needsResponder), [openAlerts]);

  useDocumentTitle(unanswered.length > 0 ? `(${unanswered.length}) Alert` : "Ishaara Command");

  useEffect(() => {
    const onNew = (alert: Alert) => {
      setSelectedId(alert.id);
      setPinnedFromLog(false);
    };
    socket.on("alert:new", onNew);
    return () => {
      socket.off("alert:new", onNew);
    };
  }, []);

  const alarming = soundWanted && soundUnlocked && unanswered.length > 0;
  useEffect(() => {
    if (!alarming) return;
    return startRinging({ volume: 0.2, everyMs: 3000 });
  }, [alarming]);

  function follow(alertId: string | null) {
    setSelectedId(alertId);
    setPinnedFromLog(false);
  }

  function pinFromLog(alertId: string) {
    setSelectedId(alertId);
    setPinnedFromLog(true);
  }

  async function toggleSound() {
    const blocked = soundWanted && !soundUnlocked;
    if (soundWanted && !blocked) {
      setSoundWanted(false);
      return;
    }
    setSoundWanted(true);
    setSoundUnlocked(await unlockAudio());
  }

  if (!app.data) {
    return (
      <>
        <PageHead title="Command" />
        <ServerProblem
          loading={app.status !== "error"}
          loadingText="Loading the campus map"
          error={app.error}
          onRetry={retryLoad}
        />
      </>
    );
  }

  const { campus, cameras, guards, camerasOnline, guardsOnShift, config } = app.data;
  const selected =
    (pinnedFromLog ? alerts.find((alert) => alert.id === selectedId) : undefined) ??
    openAlerts.find((alert) => alert.id === selectedId) ??
    unanswered[0] ??
    openAlerts[0] ??
    null;
  const viewingClosed = selected !== null && !isOpen(selected);
  const banner = unanswered[0] ?? openAlerts[0];
  const busy = openAlerts.length > 0;
  const soundBlocked = soundWanted && !soundUnlocked;
  const bannerRing = banner ? currentRing(banner) : undefined;
  const bannerForwarded = banner ? forwardedFrom(banner) : undefined;

  async function close(outcome: AlertOutcome): Promise<string | null> {
    if (!selected) return null;
    const reply = await resolveAlert(selected.id, outcome);
    return reply.ok ? null : reply.error;
  }

  return (
    <>
      <PageHead
        title="Command"
        chip={<Chip>{formatLongDate(now)}</Chip>}
        lede={`Security dashboard for ${campus.name}.`}
        aside={
          <>
            <Chip tone="outline" size="lg">
              <Dot className={app.connected ? "bg-gold" : "bg-accent"} pulse={!app.connected} />
              {app.connected ? "Live" : "Reconnecting"}
            </Chip>
            <Chip tone="outline" size="lg" className="tabular">
              <Users aria-hidden="true" className="size-3.5" /> {guardsOnShift.length} of{" "}
              {guards.length} guards on shift
            </Chip>
            <Button
              variant={soundWanted && !soundBlocked ? "ink" : "ghost"}
              icon={soundWanted && !soundBlocked ? Bell : BellOff}
              aria-pressed={soundWanted && !soundBlocked}
              onClick={() => void toggleSound()}
            >
              {soundBlocked
                ? "Allow alarm sound"
                : soundWanted
                  ? "Alarm sound on"
                  : "Alarm sound off"}
            </Button>
          </>
        }
      />

      {banner && (
        <div
          role="alert"
          key={`${banner.id}-${banner.status}`}
          className={cn(
            "mb-3.5 flex animate-deal flex-wrap items-center gap-x-4 gap-y-2 rounded-[18px] px-5 py-4",
            needsResponder(banner) ? "hero-gradient" : "bg-gold/20 text-ink",
          )}
        >
          <span aria-hidden="true" className="relative flex size-3">
            <span
              className={cn(
                "absolute inset-0 animate-ping-soft rounded-full",
                needsResponder(banner) ? "bg-white" : "bg-gold",
              )}
            />
            <span
              className={cn(
                "relative size-3 rounded-full",
                needsResponder(banner) ? "bg-white" : "bg-gold",
              )}
            />
          </span>
          <p className="min-w-0 flex-1 text-[15px] font-semibold">
            <span className="tabular">{incidentCode(banner)}</span> · {bannerText(banner)}
            {unanswered.length > 1 && ` ${unanswered.length - 1} more waiting.`}
            {bannerForwarded && bannerRing && (
              <span className="block text-[13px] font-medium opacity-80">
                Escalated: {bannerForwarded.guardName} did not respond, so the alert was forwarded
                automatically.
              </span>
            )}
          </p>
          {bannerRing && (
            <span className="text-[13px] font-semibold tabular">
              {formatSeconds(bannerRing.endsAt - now)} to answer
            </span>
          )}
          <span className="text-[13px] font-semibold tabular">
            {formatElapsed(now - banner.createdAt)}
          </span>
          {selected?.id !== banner.id && (
            <Button
              size="sm"
              variant={needsResponder(banner) ? "light" : "ink"}
              onClick={() => follow(banner.id)}
            >
              View alert
            </Button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-12">
        <div
          className={cn(
            "stagger flex min-w-0 flex-col gap-3.5",
            busy ? "xl:col-span-7" : "xl:col-span-8",
          )}
        >
          {busy ? (
            <StatStrip
              unconfirmed={unanswered.length}
              active={openAlerts.length}
              camerasOnline={camerasOnline.length}
              cameraCount={cameras.length}
              onShift={guardsOnShift.length}
              guardCount={guards.length}
            />
          ) : (
            <div className="stagger grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              <Card tone="hero" className="flex min-h-[200px] flex-col justify-between p-2.5">
                <div className="flex justify-end p-2">
                  <Chip tone="glass" size="sm">
                    All confirmed
                  </Chip>
                </div>
                <div className="relative">
                  <div
                    aria-hidden="true"
                    className="glass absolute -top-6 left-0 h-6 w-[52%] rounded-t-[16px] shadow-none"
                  />
                  <div className="glass rounded-[18px] rounded-tl-none p-4">
                    <Siren aria-hidden="true" className="size-4" />
                    <p className="mt-2 text-[15px] font-medium tracking-[-0.02em]">Active alerts</p>
                    <p className="mt-1 text-[34px] leading-none font-bold tracking-[-0.05em] tabular">
                      0
                    </p>
                  </div>
                </div>
              </Card>
              <Kpi
                icon={Camera}
                label="Cameras online"
                value={camerasOnline.length}
                of={cameras.length}
                chip={camerasOnline.length ? "Watching" : "None watching"}
              >
                <div aria-hidden="true" className="flex gap-1">
                  {cameras.map((camera) => (
                    <span
                      key={camera.id}
                      className={cn(
                        "h-[5px] w-3 rounded-full",
                        camerasOnline.includes(camera.id)
                          ? "bg-accent"
                          : "bg-ink/10 dark:bg-white/12",
                      )}
                    />
                  ))}
                </div>
              </Kpi>
              <Kpi
                icon={Users}
                label="Guards on shift"
                value={guardsOnShift.length}
                of={guards.length}
                chip={`${guards.length - guardsOnShift.length} ${guards.length - guardsOnShift.length === 1 ? "app" : "apps"} not open`}
              >
                <Dashes filled={guardsOnShift.length} />
              </Kpi>
            </div>
          )}

          <Card className="p-4 sm:p-5">
            <CardHead
              title="Campus map"
              sub={`${camerasOnline.length} of ${cameras.length} cameras online`}
              className="px-1 pb-3"
            />
            <div className="overflow-hidden rounded-[18px] bg-shell">
              <CampusMap
                campus={campus}
                cameras={cameras}
                guards={guards}
                camerasOnline={camerasOnline}
                guardsOnShift={guardsOnShift}
                openAlerts={openAlerts}
                selectedAlertId={selected?.id ?? null}
                demoMode={config.demoMode}
                onSelectAlert={follow}
              />
            </div>
            <div className="mt-3">
              <MapLegend demoMode={config.demoMode} />
            </div>
          </Card>

          <ResponsePerformance alerts={alerts} now={now} />
          <AlertLog
            alerts={alerts}
            cameras={cameras}
            selectedId={selected?.id ?? null}
            onSelect={pinFromLog}
          />
          <ActivityFeed alerts={alerts} onSelect={pinFromLog} />
        </div>

        <div
          className={cn(
            "stagger flex min-w-0 flex-col gap-3.5",
            busy ? "order-first xl:order-none xl:col-span-5" : "xl:col-span-4",
          )}
        >
          {openAlerts.length > 1 && (
            <nav aria-label="Open alerts" className="flex flex-wrap gap-1.5">
              {openAlerts.map((alert) => (
                <button
                  key={alert.id}
                  type="button"
                  onClick={() => follow(alert.id)}
                  aria-pressed={selected?.id === alert.id}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold transition-colors",
                    selected?.id === alert.id
                      ? "bg-ink text-shell"
                      : "bg-card text-ink-2 hover:text-ink",
                  )}
                >
                  <Dot className={needsResponder(alert) ? "bg-accent" : "bg-gold"} />
                  <span className="tabular">{incidentCode(alert)}</span>{" "}
                  {alert.cameraLabel.split(",")[0]}
                  <span className="sr-only">
                    {needsResponder(alert) ? ", unconfirmed" : ", responding"}
                  </span>
                </button>
              ))}
            </nav>
          )}

          <Deck>
            <Card tone="inverse" className="p-6">
              {selected ? (
                <AlertDetail
                  key={selected.id}
                  alert={selected}
                  now={now}
                  history={viewingClosed}
                  hasLive={busy}
                  onBack={() => follow(null)}
                  onClose={close}
                />
              ) : (
                <div className="flex flex-col items-center px-2 py-10 text-center">
                  <span className="relative flex size-16 items-center justify-center">
                    <span className="absolute inset-0 animate-breathe rounded-full bg-white/[0.06]" />
                    <ShieldCheck aria-hidden="true" className="relative size-7 text-gold" />
                  </span>
                  <p className="mt-5 text-[20px] font-medium tracking-[-0.03em]">
                    No active alerts.
                  </p>
                  <p className="mt-1 text-[13px] font-semibold text-inverse-ink-2 tabular">
                    {camerasOnline.length} of {cameras.length} cameras online
                  </p>
                  <p className="mt-4 max-w-[32ch] text-[13px] leading-relaxed text-inverse-ink-2">
                    When a camera sees the Signal for Help, the alert appears here and guards are
                    rung one at a time, nearest first.
                  </p>
                </div>
              )}
            </Card>
          </Deck>

          <GuardsCard
            guards={guards}
            guardsOnShift={guardsOnShift}
            alerts={alerts}
            phoneCalls={config.phoneCalls}
          />
          <CamerasPanel
            cameras={cameras}
            camerasOnline={camerasOnline}
            alerts={alerts}
            demoMode={config.demoMode}
            onSent={follow}
          />
          <EscalationCard config={config} />
        </div>
      </div>
    </>
  );
}
