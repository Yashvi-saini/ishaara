import type { Alert, Guard, GuardRing } from "@ishaara/server/types";
import {
  BellRing,
  Check,
  Download,
  Footprints,
  ImageOff,
  LogOut,
  MapPin,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { IncidentProgress } from "../components/signal/IncidentProgress";
import { Button, Card, Chip, Deck, Dot, PageHead, ServerProblem } from "../components/ui";
import { acknowledgeAlert, joinShift } from "../lib/actions";
import {
  cameraCode,
  currentRing,
  forwardedFrom,
  incidentCode,
  initials,
  isOpen,
  needsResponder,
} from "../lib/alerts";
import { retryLoad, useAppState, useServerNow } from "../lib/appState";
import { audioUnlocked, playChime, startRinging, unlockAudio } from "../lib/audio";
import { cn } from "../lib/cn";
import { formatElapsed, formatShortTime } from "../lib/format";
import { useDocumentTitle } from "../lib/hooks";
import { useInstallPrompt } from "../lib/pwa";
import { socket } from "../lib/socket";
import { useStoredString } from "../lib/storage";

type Phase = "pick" | "joining" | "on";

function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = () => {
      navigator.wakeLock
        .request("screen")
        .then((sentinel) => {
          if (cancelled) void sentinel.release();
          else lock = sentinel;
        })
        .catch(() => undefined);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") request();
    };
    request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, [active]);
}

export function GuardPage() {
  const app = useAppState();
  const now = useServerNow(250);
  const [guardId, setGuardId] = useStoredString("ishaara.guard.guardId", "");
  const [phase, setPhase] = useState<Phase>("pick");
  const [ring, setRing] = useState<GuardRing | null>(null);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [acking, setAcking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [closed, setClosed] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  const guards = app.data?.guards ?? [];
  const guard = guards.find((item) => item.id === guardId) ?? null;
  const onShift = phase === "on";

  const ringAlert = ring ? app.data?.alerts.find((alert) => alert.id === ring.alertId) : undefined;
  const ringStillMine =
    ringAlert === undefined ||
    (needsResponder(ringAlert) && currentRing(ringAlert)?.guardId === guardId);
  const ringing = onShift && ring !== null && now < ring.endsAt && ringStillMine && !respondingTo;

  const respondingAlert = respondingTo
    ? app.data?.alerts.find((alert) => alert.id === respondingTo)
    : undefined;

  useDocumentTitle(ringing ? "Help signal" : "Guard app");
  useWakeLock(onShift);

  useEffect(() => {
    if (!ringing) return;
    return startRinging();
  }, [ringing]);

  useEffect(() => {
    if (!onShift) return;
    const onRing = (next: GuardRing) => setRing(next);
    const rejoin = () => {
      void joinShift(guardId).then((reply) => {
        if (reply.ok && reply.ring) setRing(reply.ring);
      });
    };
    socket.on("guard:ring", onRing);
    socket.on("connect", rejoin);
    return () => {
      socket.off("guard:ring", onRing);
      socket.off("connect", rejoin);
    };
  }, [onShift, guardId]);

  useEffect(() => {
    if (!respondingAlert || isOpen(respondingAlert)) return;
    const how = respondingAlert.status === "false_alarm" ? "marked a false alarm" : "resolved";
    setClosed(`${incidentCode(respondingAlert)} ${how} by Command. Incident closed.`);
    playChime();
    setRespondingTo(null);
    setRing(null);
  }, [respondingAlert]);

  useEffect(() => {
    if (!closed) return;
    const timer = setTimeout(() => setClosed(null), 6000);
    return () => clearTimeout(timer);
  }, [closed]);

  async function startShift() {
    if (!guard) return;
    setJoinError(null);
    setNotice(null);
    setPhase("joining");
    void unlockAudio();
    const reply = await joinShift(guard.id);
    if (!reply.ok) {
      setJoinError(reply.error);
      setPhase("pick");
      return;
    }
    playChime();
    setRing(reply.ring);
    setPhase("on");
  }

  function endShift() {
    socket.emit("guard:leave");
    setPhase("pick");
    setRing(null);
    setRespondingTo(null);
    setNotice(null);
    setClosed(null);
  }

  const acknowledge = useCallback(async () => {
    if (!ring || !guard) return;
    setAcking(true);
    const reply = await acknowledgeAlert(ring.alertId, guard.id);
    setAcking(false);
    setRing(null);
    if (reply.ok) {
      setRespondingTo(reply.alert.id);
      setNotice(null);
    } else {
      setNotice(reply.error);
    }
  }, [ring, guard]);

  if (!app.data) {
    return (
      <>
        <PageHead title="Guard app" lede="Rings when a camera sees the Signal for Help." />
        <div className="max-w-[460px]">
          <ServerProblem
            loading={app.status !== "error"}
            loadingText="Loading guards"
            error={app.error}
            onRetry={retryLoad}
          />
        </div>
      </>
    );
  }

  let view;
  if (ringing && ring) {
    view = (
      <RingCard
        ring={ring}
        alert={ringAlert}
        now={now}
        busy={acking}
        onAcknowledge={() => void acknowledge()}
      />
    );
  } else if (onShift && guard && respondingTo) {
    view = <RespondingCard alert={respondingAlert} now={now} />;
  } else if (onShift && guard) {
    view = (
      <WaitingCard
        guard={guard}
        alerts={app.data.alerts}
        connected={app.connected}
        notice={notice}
        closed={closed}
        onEnd={endShift}
      />
    );
  } else {
    view = (
      <PickGuard
        guards={guards}
        guardId={guard?.id ?? ""}
        onPick={setGuardId}
        onStart={() => void startShift()}
        joining={phase === "joining"}
        error={joinError}
      />
    );
  }

  return (
    <>
      <PageHead title="Guard app" lede="Rings when a camera sees the Signal for Help." />
      <div className="stagger grid gap-3.5 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)] lg:items-start">
        <div className="w-full max-w-[460px]">{view}</div>
        <Card className="hidden p-6 lg:block">
          <h2 className="text-[19px] font-medium tracking-[-0.03em]">When your phone rings</h2>
          <ol className="mt-5 flex flex-col gap-4">
            {[
              "Your phone rings with the camera location and one snapshot.",
              "Tap “I’m going” before the timer ends. If you don’t answer, the next guard is rung.",
              "Check in calmly. Command closes the alert when she is safe.",
            ].map((text, index) => (
              <li key={text} className="flex gap-4">
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-[12px] bg-sunken text-[13px] font-bold">
                  {index + 1}
                </span>
                <p className="pt-1.5 text-[14px] leading-relaxed text-ink-2">{text}</p>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </>
  );
}

function PickGuard({
  guards,
  guardId,
  onPick,
  onStart,
  joining,
  error,
}: {
  guards: readonly Guard[];
  guardId: string;
  onPick: (id: string) => void;
  onStart: () => void;
  joining: boolean;
  error: string | null;
}) {
  const radios = useRef<Record<string, HTMLButtonElement | null>>({});
  const focusIndex = Math.max(
    0,
    guards.findIndex((item) => item.id === guardId),
  );

  function onRadioKey(event: KeyboardEvent, index: number) {
    const step =
      event.key === "ArrowDown" || event.key === "ArrowRight"
        ? 1
        : event.key === "ArrowUp" || event.key === "ArrowLeft"
          ? -1
          : 0;
    if (!step) return;
    event.preventDefault();
    const next = guards[(index + step + guards.length) % guards.length];
    if (!next) return;
    onPick(next.id);
    radios.current[next.id]?.focus();
  }

  return (
    <Deck>
      <Card className="p-6 sm:p-7">
        <h2 id="guard-pick" className="text-[24px] font-medium tracking-[-0.04em]">
          Who is on shift?
        </h2>
        <div role="radiogroup" aria-labelledby="guard-pick" className="mt-5 flex flex-col gap-2">
          {guards.map((item, index) => {
            const on = item.id === guardId;
            return (
              <button
                key={item.id}
                ref={(element) => {
                  radios.current[item.id] = element;
                }}
                type="button"
                role="radio"
                aria-checked={on}
                tabIndex={index === focusIndex ? 0 : -1}
                onClick={() => onPick(item.id)}
                onKeyDown={(event) => onRadioKey(event, index)}
                className={cn(
                  "flex items-center gap-4 rounded-[18px] p-3.5 text-left transition-colors",
                  on ? "bg-ink text-shell" : "bg-sunken hover:bg-ink/[0.08]",
                )}
              >
                <span
                  className={cn(
                    "inline-flex size-12 shrink-0 items-center justify-center rounded-[12px] text-[14px] font-bold",
                    on ? "bg-white/15 text-shell" : "bg-card text-ink",
                  )}
                >
                  {initials(item.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-semibold tracking-[-0.02em]">
                    {item.name}
                  </span>
                  <span className={cn("block text-[13px]", on ? "opacity-70" : "text-ink-2")}>
                    {item.zone}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "inline-flex size-6 items-center justify-center rounded-full transition",
                    on ? "bg-accent-fill text-white" : "ring-2 ring-ink/15 ring-inset",
                  )}
                >
                  {on && <Check className="size-3.5" strokeWidth={3} />}
                </span>
              </button>
            );
          })}
        </div>
        <Button
          variant="accent"
          size="xl"
          fullWidth
          className="mt-5"
          disabled={!guardId || joining}
          onClick={onStart}
        >
          {joining ? "Starting shift" : "Start shift"}
        </Button>
        {error && (
          <p role="alert" className="mt-3 text-[13px] font-semibold text-accent-ink">
            {error}
          </p>
        )}
        <p className="mt-4 text-[13px] leading-relaxed text-ink-2">
          Starting the shift turns on sound for this page. Keep the volume up.
        </p>
        <InstallLink />
      </Card>
    </Deck>
  );
}

function InstallLink() {
  const { canInstall, install } = useInstallPrompt();
  const [help, setHelp] = useState(false);
  const installed =
    typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches;
  if (installed) return null;
  return (
    <div className="mt-4 border-t border-line pt-4">
      <button
        type="button"
        aria-expanded={canInstall ? undefined : help}
        onClick={() => {
          if (canInstall) void install();
          else setHelp((open) => !open);
        }}
        className="inline-flex items-center gap-2 rounded-md text-[14px] font-semibold text-ink transition-colors hover:text-accent-ink"
      >
        <Download aria-hidden="true" className="size-4" /> Install the Guard app on this phone
      </button>
      {help && (
        <p className="mt-2 rounded-[12px] bg-sunken p-3 text-[13px] leading-relaxed text-ink-2">
          Open your browser menu and choose <b>Add to Home screen</b> or <b>Install app</b>. On
          iPhone, tap Share, then Add to Home Screen.
        </p>
      )}
    </div>
  );
}

function RingCard({
  ring,
  alert,
  now,
  busy,
  onAcknowledge,
}: {
  ring: GuardRing;
  alert: Alert | undefined;
  now: number;
  busy: boolean;
  onAcknowledge: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const regionRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    regionRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    buttonRef.current?.focus({ preventScroll: true });
  }, [ring.alertId]);

  const left = Math.max(0, ring.endsAt - now);
  const total = Math.max(1, ring.endsAt - ring.startedAt);
  const seconds = Math.ceil(left / 1000);
  const forwarded = alert ? forwardedFrom(alert) : undefined;
  const round = alert ? currentRing(alert)?.round : undefined;
  const snapshot = alert?.snapshotUrl ?? null;
  const code = incidentCode({ number: ring.alertNumber });

  return (
    <div
      ref={regionRef}
      role="region"
      aria-label={`Help signal at ${ring.cameraLabel}`}
      className="hero-gradient animate-deal scroll-mt-4 rounded-[26px] p-3"
    >
      <p role="alert" className="sr-only">
        Help signal at {ring.cameraLabel}.{" "}
        {forwarded
          ? `Forwarded to you because ${forwarded.guardName} did not respond.`
          : "You are the nearest guard."}{" "}
        {seconds} seconds to respond.
      </p>
      <div className="flex items-center justify-between p-3">
        <Chip tone="glass">
          <BellRing aria-hidden="true" className="size-3.5 animate-shake" /> Help signal · {code}
        </Chip>
        {round !== undefined && (
          <span className="text-[12px] font-semibold text-white/90">Round {round}</span>
        )}
      </div>
      <div className="flex flex-col items-center px-4 pt-4 pb-6 text-center">
        <div aria-hidden="true" className="relative size-40">
          <span className="absolute inset-4 animate-ping-soft rounded-full bg-white/20" />
          <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="rgb(255 255 255 / 0.18)"
              strokeWidth="5"
            />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="#fff"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={`${(left / total) * 283} 283`}
              style={{ transition: "stroke-dasharray 0.25s linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              key={seconds}
              className="inline-block animate-tick text-[44px] leading-none font-bold tracking-[-0.05em] tabular"
            >
              {seconds}
            </span>
            <span className="mt-1 text-[11px] font-semibold text-white/90">seconds</span>
          </div>
        </div>
        <p className="mt-6 text-[13px] font-semibold text-white/90">
          {forwarded
            ? `Forwarded to you · ${forwarded.guardName} did not respond`
            : "You are the nearest guard"}
        </p>
        <h2 className="mt-1 text-[32px] leading-tight font-medium tracking-[-0.045em]">
          {ring.cameraLabel}
        </h2>
        <p className="mt-1 flex items-center gap-1.5 text-[14px] text-white/90">
          <MapPin aria-hidden="true" className="size-3.5" />
          {alert ? `${cameraCode(alert.cameraId)} · ` : ""}
          {ring.zone}
        </p>
        <p className="mt-1 text-[12px] text-white/90 tabular">
          Alert generated {formatShortTime(ring.createdAt)}
        </p>
      </div>
      {snapshot ? (
        <img
          src={snapshot}
          alt={`Snapshot from ${ring.cameraLabel}`}
          className="mx-auto mb-3 aspect-[4/3] w-[calc(100%-1rem)] rounded-[18px] object-cover outline-1 -outline-offset-1 outline-black/10"
        />
      ) : (
        <div className="glass mx-auto mb-3 flex aspect-[16/7] w-[calc(100%-1rem)] flex-col items-center justify-center gap-1.5 rounded-[18px] text-white/90">
          <ImageOff aria-hidden="true" className="size-5" />
          <span className="text-[13px] font-medium">No snapshot for this alert</span>
        </div>
      )}
      <div className="glass grid gap-2 rounded-[18px] p-3">
        <Button
          ref={buttonRef}
          variant="light"
          size="xl"
          icon={Footprints}
          fullWidth
          disabled={busy}
          onClick={onAcknowledge}
        >
          {busy ? "Confirming" : "I’m going"}
        </Button>
        <p className="px-2 pt-1 pb-0.5 text-center text-[12px] text-white/90">
          If you don’t answer in time, the next guard is rung.
        </p>
      </div>
    </div>
  );
}

function RespondingCard({ alert, now }: { alert: Alert | undefined; now: number }) {
  const [imageFailed, setImageFailed] = useState(false);
  const snapshot = alert?.snapshotUrl && !imageFailed ? alert.snapshotUrl : null;
  return (
    <Deck>
      <Card tone="inverse" className="animate-deal p-6">
        <div className="flex items-center justify-between">
          <Chip tone="gold">On the way</Chip>
          {alert && (
            <span className="text-[12px] font-semibold text-inverse-ink-2 tabular">
              {incidentCode(alert)}
              {alert.respondedAt !== null && ` · ${formatElapsed(now - alert.respondedAt)}`}
            </span>
          )}
        </div>
        <h2 className="mt-5 text-[30px] leading-tight font-medium tracking-[-0.045em]">
          {alert?.cameraLabel ?? "Loading location"}
        </h2>
        {alert && (
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-inverse-ink-2">
            <MapPin aria-hidden="true" className="size-3.5" />
            {cameraCode(alert.cameraId)} · {alert.zone}
          </p>
        )}
        {alert && <IncidentProgress alert={alert} className="mt-5" />}
        <div className="mt-5 aspect-[4/3] overflow-hidden rounded-[18px] bg-white/[0.05]">
          {snapshot ? (
            <img
              src={snapshot}
              alt={`Snapshot from ${alert?.cameraLabel ?? "the camera"}`}
              onError={() => setImageFailed(true)}
              className="size-full object-cover outline-1 -outline-offset-1 outline-white/10"
            />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-2 text-inverse-ink-2">
              <ImageOff aria-hidden="true" className="size-6" />
              <span className="text-[13px]">No snapshot</span>
            </div>
          )}
        </div>
        <h3 className="mt-6 text-[14px] font-semibold">Check in calmly</h3>
        <ul className="mt-2.5 flex flex-col gap-2 text-[13px] text-inverse-ink-2">
          {[
            "Approach without alarming the person she is with.",
            "Ask yes-or-no questions she can answer with a nod.",
            "Tell Command if she asks for police. Command calls 112.",
          ].map((text) => (
            <li key={text} className="flex gap-2.5">
              <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gold" />
              {text}
            </li>
          ))}
        </ul>
        <p className="mt-6 rounded-[18px] bg-white/[0.06] p-4 text-[13px] text-inverse-ink-2">
          Command closes {alert ? incidentCode(alert) : "the alert"} from the dashboard when she is
          safe.
        </p>
      </Card>
    </Deck>
  );
}

function WaitingCard({
  guard,
  alerts,
  connected,
  notice,
  closed,
  onEnd,
}: {
  guard: Guard;
  alerts: readonly Alert[];
  connected: boolean;
  notice: string | null;
  closed: string | null;
  onEnd: () => void;
}) {
  const [soundOk, setSoundOk] = useState(audioUnlocked);
  useEffect(() => {
    const timer = setInterval(() => setSoundOk(audioUnlocked()), 1000);
    return () => clearInterval(timer);
  }, []);

  const forwardedAway = alerts.find(
    (alert) =>
      isOpen(alert) &&
      alert.responderId !== guard.id &&
      currentRing(alert)?.guardId !== guard.id &&
      alert.attempts.some(
        (attempt) =>
          attempt.guardId === guard.id && attempt.reached && attempt.outcome === "no_answer",
      ),
  );
  const nextName = forwardedAway
    ? (currentRing(forwardedAway)?.guardName ?? forwardedAway.responderName)
    : null;

  return (
    <Deck>
      <Card tone="inverse" className="p-6 sm:p-7">
        {closed && (
          <div
            role="status"
            className="mb-5 flex animate-rise items-center gap-3 rounded-[18px] bg-gold/90 px-4 py-3 text-[13px] font-semibold text-on-gold"
          >
            <Check aria-hidden="true" className="size-4 shrink-0" strokeWidth={3} /> {closed}
          </div>
        )}
        {notice && (
          <p
            role="status"
            className="mb-5 rounded-[18px] bg-white/[0.06] px-4 py-3 text-[13px] font-semibold"
          >
            {notice}
          </p>
        )}
        {forwardedAway && (
          <div role="status" className="mb-5 rounded-[18px] bg-white/[0.06] px-4 py-3 text-[13px]">
            <b className="font-semibold">{incidentCode(forwardedAway)} was forwarded.</b>{" "}
            <span className="text-inverse-ink-2">
              {nextName
                ? `It escalated to ${nextName} because you didn’t answer in time.`
                : "Command is finding another available guard."}
            </span>
          </div>
        )}
        <div className="flex items-center gap-4">
          <span className="inline-flex size-14 items-center justify-center rounded-[18px] bg-accent-fill text-[16px] font-bold text-white">
            {initials(guard.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[19px] font-semibold tracking-[-0.03em]">{guard.name}</p>
            <p className="text-[13px] text-inverse-ink-2">{guard.zone}</p>
          </div>
          <Chip tone="gold">On shift</Chip>
        </div>

        <div className="my-10 flex flex-col items-center text-center" aria-live="polite">
          <span aria-hidden="true" className="relative flex size-28 items-center justify-center">
            <span className="absolute inset-0 animate-breathe rounded-full bg-white/[0.05]" />
            <span className="absolute inset-5 rounded-full bg-white/[0.06]" />
            <BellRing className="relative size-8 text-gold" />
          </span>
          <p className="mt-6 text-[22px] font-medium tracking-[-0.035em]">
            {connected ? "Waiting for alerts" : "Connection lost. Reconnecting"}
          </p>
          <p className="mt-1.5 max-w-[30ch] text-[13px] leading-relaxed text-inverse-ink-2">
            Keep this page open. It rings when a camera near you sees the Signal for Help.
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-[18px] bg-white/[0.06] p-4">
          {soundOk ? (
            <Volume2 aria-hidden="true" className="size-5 text-gold" />
          ) : (
            <VolumeX aria-hidden="true" className="size-5 text-rose" />
          )}
          <span className="min-w-0 flex-1 text-[13px]">
            <span className="block font-semibold">
              {soundOk ? "Sound is on" : "Sound is blocked"}
            </span>
            <span className="block text-inverse-ink-2">
              {soundOk ? "Keep the volume up." : "Tap to allow this page to ring."}
            </span>
          </span>
          <Button
            size="sm"
            variant="outline-inverse"
            onClick={async () => {
              setSoundOk(await unlockAudio());
              playChime();
            }}
          >
            {soundOk ? "Test" : "Allow"}
          </Button>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 px-1 pt-2">
          <span className="flex items-center gap-2 text-[12px] text-inverse-ink-2">
            <Dot className={connected ? "bg-gold" : "bg-accent"} pulse />
            {connected ? "Visible to Command" : "Not connected"}
          </span>
          <Button size="sm" variant="outline-inverse" icon={LogOut} onClick={onEnd}>
            End shift
          </Button>
        </div>
      </Card>
    </Deck>
  );
}
