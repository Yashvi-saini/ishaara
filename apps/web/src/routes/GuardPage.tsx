import type { GuardRing } from "@ishaara/server/types";
import { Download, LoaderCircle, LogOut, MapPin, Phone, Volume2, WifiOff } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button, buttonClasses, Card, EmptyState, PageHeader, StatusDot } from "../components/ui";
import { acknowledgeAlert, joinShift } from "../lib/actions";
import { currentRing, isOpen, needsResponder } from "../lib/alerts";
import { retryLoad, useAppState, useServerNow } from "../lib/appState";
import { playChime, startRinging, unlockAudio } from "../lib/audio";
import { cn } from "../lib/cn";
import { formatElapsed, formatSeconds, formatShortTime } from "../lib/format";
import { useDocumentTitle } from "../lib/hooks";
import { useInstallPrompt } from "../lib/pwa";
import { socket } from "../lib/socket";
import { useStoredString } from "../lib/storage";

type Phase = "pick" | "joining" | "on";

interface Notice {
  tone: "alert" | "ok" | "neutral";
  text: string;
}

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
  const [notice, setNotice] = useState<Notice | null>(null);
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
    const how = respondingAlert.status === "false_alarm" ? "a false alarm" : "resolved";
    setNotice({ tone: "ok", text: `Alert #${respondingAlert.number} was closed as ${how}.` });
    setRespondingTo(null);
    setRing(null);
  }, [respondingAlert]);

  async function startShift() {
    if (!guard) return;
    setJoinError(null);
    setNotice(null);
    setPhase("joining");
    await unlockAudio();
    const reply = await joinShift(guard.id);
    if (!reply.ok) {
      setJoinError(reply.error);
      setPhase("pick");
      return;
    }
    setRing(reply.ring);
    setPhase("on");
  }

  function endShift() {
    socket.emit("guard:leave");
    setPhase("pick");
    setRing(null);
    setRespondingTo(null);
    setNotice(null);
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
      setNotice({ tone: "neutral", text: reply.error });
    }
  }, [ring, guard]);

  if (app.status === "error" && !app.data) {
    return (
      <Shell>
        <Card>
          <EmptyState
            icon={WifiOff}
            tone="alert"
            title="Cannot reach the Ishaara server"
            description={app.error}
            action={<Button onClick={retryLoad}>Try again</Button>}
          />
        </Card>
      </Shell>
    );
  }

  if (!app.data) {
    return (
      <Shell>
        <Card>
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-ink-muted">
            <LoaderCircle size={16} aria-hidden="true" className="animate-spin" />
            Loading guards
          </div>
        </Card>
      </Shell>
    );
  }

  if (ringing && ring) {
    return <RingScreen ring={ring} now={now} busy={acking} onAcknowledge={acknowledge} />;
  }

  if (onShift && guard && respondingTo) {
    return (
      <Shell connected={app.connected}>
        <Card tone="ok" title="You are responding">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-sm text-ink-muted tabular-nums">
                Alert #{respondingAlert?.number ?? ""}
              </p>
              <p className="flex items-start gap-2 text-2xl font-semibold text-ink">
                <MapPin size={20} aria-hidden="true" className="mt-1.5 shrink-0" />
                {respondingAlert?.cameraLabel ?? "Loading location"}
              </p>
              {respondingAlert?.respondedAt !== undefined &&
                respondingAlert.respondedAt !== null && (
                  <p className="mt-1 text-sm text-ink-muted tabular-nums">
                    On the way for {formatElapsed(now - respondingAlert.respondedAt)}
                  </p>
                )}
            </div>
            <ol className="flex list-decimal flex-col gap-1 pl-5 text-base text-ink">
              <li>Approach calmly. Do not rush at anyone.</li>
              <li>Ask simple yes-or-no questions, such as “Are you okay?”</li>
              <li>Let her lead. Call 112 if she asks for police or you see danger.</li>
            </ol>
            <a
              href="tel:112"
              className={buttonClasses({ variant: "danger", size: "xl", fullWidth: true })}
            >
              <Phone size={20} aria-hidden="true" />
              Call 112
            </a>
            <p className="text-sm text-ink-muted">
              Security closes the alert from the dashboard when she is safe.
            </p>
          </div>
        </Card>
      </Shell>
    );
  }

  if (onShift && guard) {
    return (
      <Shell connected={app.connected}>
        {notice && <NoticeCard notice={notice} />}
        <Card tone="accent">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-sm text-ink-muted">On shift</p>
              <p className="text-2xl font-semibold text-ink">{guard.name}</p>
              <p className="text-sm text-ink-muted">{guard.zone}</p>
            </div>
            <div className="border-y border-line py-3" aria-live="polite">
              {app.connected ? (
                <StatusDot tone="accent" strong>
                  Waiting for alerts
                </StatusDot>
              ) : (
                <StatusDot tone="alert" strong>
                  Connection lost. Reconnecting
                </StatusDot>
              )}
            </div>
            <p className="text-base text-ink">
              Keep this page open and the volume up. When it rings, tap “I’m going”.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button icon={Volume2} size="lg" onClick={playChime}>
                Test sound
              </Button>
              <Button icon={LogOut} size="lg" variant="quiet" onClick={endShift}>
                End shift
              </Button>
            </div>
          </div>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell connected={app.connected}>
      <PickGuard
        guards={guards}
        guardId={guard?.id ?? ""}
        onPick={setGuardId}
        onStart={() => void startShift()}
        joining={phase === "joining"}
        error={joinError}
      />
    </Shell>
  );
}

function Shell({ children, connected = true }: { children: ReactNode; connected?: boolean }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <PageHeader title="Guard app" description="Rings when a camera sees the Signal for Help." />
      {!connected && (
        <div role="status" className="border-b border-line bg-ringing-soft">
          <p className="mx-auto max-w-md px-4 py-2 text-sm text-ringing">
            Connection to the server lost. Reconnecting.
          </p>
        </div>
      )}
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">{children}</main>
    </div>
  );
}

function NoticeCard({ notice }: { notice: Notice }) {
  const tone = notice.tone === "alert" ? "alert" : notice.tone === "ok" ? "ok" : "none";
  return (
    <Card tone={tone}>
      <p role="status" className="text-sm text-ink">
        {notice.text}
      </p>
    </Card>
  );
}

interface PickGuardProps {
  guards: readonly { id: string; name: string; zone: string }[];
  guardId: string;
  onPick: (id: string) => void;
  onStart: () => void;
  joining: boolean;
  error: string | null;
}

function PickGuard({ guards, guardId, onPick, onStart, joining, error }: PickGuardProps) {
  const legendId = useId();
  const { canInstall, install } = useInstallPrompt();
  return (
    <Card>
      <fieldset aria-labelledby={legendId}>
        <legend id={legendId} className="text-base font-semibold text-ink">
          Who is on shift?
        </legend>
        <div className="mt-3 flex flex-col gap-2">
          {guards.map((guard) => (
            <label
              key={guard.id}
              className={cn(
                "flex items-center gap-3 rounded-md border px-3 py-3",
                guard.id === guardId ? "border-accent bg-accent-soft" : "border-line bg-surface",
              )}
            >
              <input
                type="radio"
                name="guard"
                value={guard.id}
                checked={guard.id === guardId}
                onChange={() => onPick(guard.id)}
                className="size-4 accent-accent"
              />
              <span>
                <span className="block text-base font-medium text-ink">{guard.name}</span>
                <span className="block text-sm text-ink-muted">{guard.zone}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <Button
        className="mt-4"
        variant="primary"
        size="xl"
        fullWidth
        disabled={!guardId || joining}
        onClick={onStart}
      >
        {joining ? "Starting shift" : "Start shift"}
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-alert">
          {error}
        </p>
      )}
      <p className="mt-3 text-sm text-ink-muted">
        Starting the shift turns on sound for this page. Keep the volume up.
      </p>
      {canInstall && (
        <Button className="mt-3" icon={Download} variant="quiet" onClick={() => void install()}>
          Install the Guard app on this phone
        </Button>
      )}
    </Card>
  );
}

interface RingScreenProps {
  ring: GuardRing;
  now: number;
  busy: boolean;
  onAcknowledge: () => void;
}

function RingScreen({ ring, now, busy, onAcknowledge }: RingScreenProps) {
  const titleId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => buttonRef.current?.focus(), [ring.alertId]);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex flex-col bg-surface"
    >
      <div className="bg-alert text-on-accent">
        <div className="mx-auto flex max-w-md items-center justify-between gap-4 px-4 py-3">
          <span className="flex items-center gap-2 text-base font-semibold">
            <span
              aria-hidden="true"
              className="size-2.5 animate-ring-pulse rounded-full bg-surface"
            />
            Help signal
          </span>
          <span className="text-sm tabular-nums">Alert #{ring.alertNumber}</span>
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6">
        <p className="text-sm text-ink-muted tabular-nums">
          Seen at {formatShortTime(ring.createdAt)}
        </p>
        <h1 id={titleId} className="flex items-start gap-2 text-3xl font-semibold text-ink">
          <MapPin size={24} aria-hidden="true" className="mt-1.5 shrink-0" />
          {ring.cameraLabel}
        </h1>
        <p className="text-base text-ink-muted">{ring.zone}</p>
        <p className="text-base text-ink">
          Someone made the Signal for Help at this camera. Go and check in calmly.
        </p>
        <div className="mt-auto flex flex-col gap-3">
          <Button
            ref={buttonRef}
            variant="primary"
            size="xl"
            fullWidth
            disabled={busy}
            onClick={onAcknowledge}
            className="h-20 text-2xl"
          >
            {busy ? "Confirming" : "I’m going"}
          </Button>
          <p className="text-center text-sm text-ink-muted tabular-nums">
            Ringing for {formatSeconds(ring.endsAt - now)} more. If nobody answers, the next guard
            is rung.
          </p>
        </div>
      </div>
    </div>
  );
}
