import { DEMO_COOLDOWN_MS, type SignalEvent } from "@ishaara/gesture";
import { Camera as CameraIcon, Hand, Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { CameraViewport } from "../components/camera/CameraViewport";
import { Button, Card, EmptyState, PageHeader, Select, StatusDot, Toggle } from "../components/ui";
import { createAlert } from "../lib/api";
import { useAppState, retryLoad } from "../lib/appState";
import { useSignalCamera } from "../lib/camera/useSignalCamera";
import { socket } from "../lib/socket";
import { formatTime } from "../lib/format";
import { isTypingTarget, useDocumentTitle, useNow } from "../lib/hooks";
import { useStoredFlag, useStoredString } from "../lib/storage";

const STEP_HINT_MS = 2200;
const SENT_HINT_MS = 4000;

interface SentAlert {
  number: number;
  cameraLabel: string;
  at: number;
  simulated: boolean;
  duplicate: boolean;
}

type SendState = { kind: "idle" } | { kind: "sending" } | { kind: "error"; message: string };

export function EyePage() {
  useDocumentTitle("Ishaara Eye");
  const app = useAppState();
  const cameras = app.data?.cameras ?? [];
  const demoMode = app.data?.config.demoMode ?? false;
  const cooldownMs = demoMode ? DEMO_COOLDOWN_MS : 30_000;

  const [cameraId, setCameraId] = useStoredString("ishaara.eye.cameraId", "");
  const [showTracking, setShowTracking] = useStoredFlag("ishaara.eye.showTracking", false);
  const [sending, setSending] = useState<SendState>({ kind: "idle" });
  const [lastSent, setLastSent] = useState<SentAlert | null>(null);
  const [step1At, setStep1At] = useState(0);

  const selectedCamera = cameras.find((camera) => camera.id === cameraId) ?? cameras[0];
  const firstCameraId = cameras[0]?.id;
  useEffect(() => {
    if (!cameraId && firstCameraId) setCameraId(firstCameraId);
  }, [cameraId, firstCameraId, setCameraId]);

  const reportedCameraId = selectedCamera?.id;
  useEffect(() => {
    if (!reportedCameraId) return;
    const report = () => socket.emit("camera:join", { cameraId: reportedCameraId });
    if (socket.connected) report();
    socket.on("connect", report);
    return () => {
      socket.off("connect", report);
      socket.emit("camera:leave");
    };
  }, [reportedCameraId]);

  const send = useCallback(
    async (snapshot: string | null, simulated: boolean) => {
      if (!selectedCamera) return;
      setSending({ kind: "sending" });
      try {
        const { alert, duplicate } = await createAlert({
          cameraId: selectedCamera.id,
          snapshot,
          simulated,
        });
        setLastSent({
          number: alert.number,
          cameraLabel: alert.cameraLabel,
          at: Date.now(),
          simulated,
          duplicate,
        });
        setSending({ kind: "idle" });
      } catch (error) {
        setSending({
          kind: "error",
          message: error instanceof Error ? error.message : "The alert could not be sent.",
        });
      }
    },
    [selectedCamera],
  );

  const onSignal = useCallback(
    (_event: SignalEvent, snapshot: string | null) => {
      void send(snapshot, false);
    },
    [send],
  );
  const camera = useSignalCamera({ cooldownMs, showTracking, onSignal });

  const simulate = useCallback(() => {
    if (!demoMode || !selectedCamera) return;
    camera.resetDetector();
    void send(camera.snapshot(), true);
  }, [camera, demoMode, selectedCamera, send]);

  useEffect(() => {
    if (!demoMode) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.shiftKey && event.key.toLowerCase() === "s" && !isTypingTarget(event.target)) {
        event.preventDefault();
        simulate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [demoMode, simulate]);

  useEffect(() => {
    if (camera.view.status === "step1") setStep1At(Date.now());
  }, [camera.view.status]);

  const now = useNow(250, camera.view.status !== "watching" || lastSent !== null);

  const recentlySent = lastSent !== null && now - lastSent.at < SENT_HINT_MS;
  const recentlyStep1 = camera.view.status === "step1" || now - step1At < STEP_HINT_MS;

  function statusLine() {
    if (camera.camera !== "live") return <StatusDot tone="neutral">Camera not running</StatusDot>;
    if (camera.tracking !== "ready")
      return <StatusDot tone="neutral">Hand tracking not ready</StatusDot>;
    if (sending.kind === "sending") return <StatusDot tone="ringing">Sending alert</StatusDot>;
    if (recentlySent && lastSent)
      return (
        <StatusDot tone="ok" strong>
          {lastSent.duplicate ? "Already sent" : "Signal sent"} to security
        </StatusDot>
      );
    if (camera.view.status === "cooldown")
      return <StatusDot tone="ok">Sent. Watching again shortly</StatusDot>;
    if (recentlyStep1)
      return (
        <StatusDot tone="ringing" strong>
          Step 1 seen. Fold your fingers over your thumb
        </StatusDot>
      );
    return <StatusDot tone="accent">Watching</StatusDot>;
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <PageHeader
        title="Ishaara Eye"
        description="Watches this camera for the Signal for Help. Video stays on this device; one snapshot is sent when the signal is seen."
        actions={
          selectedCamera && (
            <span className="inline-flex items-center gap-2 text-sm text-ink-muted">
              <CameraIcon size={16} aria-hidden="true" />
              {selectedCamera.label}
            </span>
          )
        }
      />

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-4">
          <Card padded={false} className="overflow-hidden">
            <CameraViewport
              videoRef={camera.videoRef}
              canvasRef={camera.canvasRef}
              camera={camera.camera}
              tracking={camera.tracking}
              onRetryCamera={camera.retryCamera}
              onRetryTracking={camera.retryTracking}
            />
            <div
              aria-live="polite"
              className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line px-4 py-3 text-sm"
            >
              {statusLine()}
              <span className="text-ink-muted tabular-nums">
                {camera.view.handsInView === 0
                  ? "No hands in view"
                  : camera.view.handsInView === 1
                    ? "1 hand in view"
                    : `${camera.view.handsInView} hands in view`}
              </span>
            </div>
          </Card>

          {sending.kind === "error" && (
            <Card tone="alert">
              <div role="alert" className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-ink">{sending.message}</p>
                <Button onClick={() => setSending({ kind: "idle" })}>Dismiss</Button>
              </div>
            </Card>
          )}

          {app.status === "error" && (
            <Card tone="alert">
              <EmptyState
                tone="alert"
                title="Cannot reach the Ishaara server"
                description={app.error}
                action={<Button onClick={retryLoad}>Try again</Button>}
              />
            </Card>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <Card title="This camera">
            <div className="flex flex-col gap-4">
              <Select
                label="Camera location"
                hint="Shown to security with every alert from this device."
                value={selectedCamera?.id ?? ""}
                options={cameras.map((item) => ({ value: item.id, label: item.label }))}
                onChange={setCameraId}
                disabled={cameras.length === 0}
              />
              <Toggle
                label="Show tracking"
                hint="Draws the 21 hand points on the preview."
                checked={showTracking}
                onChange={setShowTracking}
              />
            </div>
          </Card>

          <Card title="Last alert">
            {lastSent ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-ink-muted">Alert</dt>
                <dd className="tabular-nums">#{lastSent.number}</dd>
                <dt className="text-ink-muted">From</dt>
                <dd>{lastSent.cameraLabel}</dd>
                <dt className="text-ink-muted">Sent at</dt>
                <dd className="tabular-nums">{formatTime(lastSent.at)}</dd>
                <dt className="text-ink-muted">Source</dt>
                <dd>{lastSent.simulated ? "Simulated" : "Camera"}</dd>
              </dl>
            ) : (
              <p className="text-sm text-ink-muted">No alert sent from this device yet.</p>
            )}
          </Card>

          {demoMode && (
            <Card
              title="Demo mode"
              description="Timers are shortened. Use this if the camera cannot see the signal."
            >
              <Button
                icon={Send}
                fullWidth
                onClick={simulate}
                disabled={!selectedCamera || sending.kind === "sending"}
              >
                Simulate signal
              </Button>
              <p className="mt-2 text-sm text-ink-muted">
                Keyboard: <kbd className="rounded border border-line px-1">Shift</kbd> +{" "}
                <kbd className="rounded border border-line px-1">S</kbd>
              </p>
            </Card>
          )}

          <Card title="The signal">
            <ol className="flex flex-col gap-2 text-sm text-ink-muted">
              <li className="flex gap-3">
                <Hand size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-faint" />
                <span>Show your palm to the camera with your thumb tucked in.</span>
              </li>
              <li className="flex gap-3">
                <span className="w-4 shrink-0" />
                <span>Fold your fingers down over your thumb within two seconds.</span>
              </li>
            </ol>
            {camera.view.status === "cooldown" && (
              <p className="mt-3 text-sm text-ink-muted">
                After a signal, this camera waits {Math.round(cooldownMs / 1000)} seconds before it
                can send another.
              </p>
            )}
          </Card>
        </aside>
      </main>
    </div>
  );
}
