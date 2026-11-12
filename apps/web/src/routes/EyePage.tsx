import { DEMO_COOLDOWN_MS, type SignalEvent } from "@ishaara/gesture";
import type { Alert } from "@ishaara/server/types";
import { Camera, Check, ImageOff, LoaderCircle, ScanLine, Send, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CameraFeed } from "../components/camera/CameraFeed";
import { IncidentProgress } from "../components/signal/IncidentProgress";
import { SignalStageBar } from "../components/signal/SignalStageBar";
import {
  Button,
  Card,
  CardHead,
  Chip,
  Dot,
  Kbd,
  Notice,
  PageHead,
  Select,
  Toggle,
} from "../components/ui";
import { createAlert } from "../lib/api";
import { alertStatus, cameraCode, incidentCode, toneDot } from "../lib/alerts";
import { retryLoad, useAppState } from "../lib/appState";
import { useSignalCamera } from "../lib/camera/useSignalCamera";
import { formatTime } from "../lib/format";
import { isTypingTarget, useDocumentTitle } from "../lib/hooks";
import { socket } from "../lib/socket";
import { useStoredFlag, useStoredString } from "../lib/storage";

const FLASH_MS = 2600;

interface SentFlash {
  alertId: string;
  simulated: boolean;
  duplicate: boolean;
  snapshot: boolean;
}

type SendState = { kind: "idle" } | { kind: "sending" } | { kind: "error"; message: string };

export function EyePage() {
  useDocumentTitle("Ishaara Eye");
  const app = useAppState();
  const cameras = app.data?.cameras ?? [];
  const demoMode = app.data?.config.demoMode ?? false;
  const ringSeconds = Math.round((app.data?.config.ringMs ?? 20_000) / 1000);
  const cooldownMs = demoMode ? DEMO_COOLDOWN_MS : 30_000;

  const [cameraId, setCameraId] = useStoredString("ishaara.eye.cameraId", "");
  const [showTracking, setShowTracking] = useStoredFlag("ishaara.eye.showTracking", false);
  const [sending, setSending] = useState<SendState>({ kind: "idle" });
  const [lastAlertId, setLastAlertId] = useState<string | null>(null);
  const [flash, setFlash] = useState<SentFlash | null>(null);
  const flashTimer = useRef(0);
  const selectId = useId();
  const trackingHintId = useId();

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

  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

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
        setLastAlertId(alert.id);
        setFlash({ alertId: alert.id, simulated, duplicate, snapshot: snapshot !== null });
        window.clearTimeout(flashTimer.current);
        flashTimer.current = window.setTimeout(() => setFlash(null), FLASH_MS);
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

  const live = camera.camera === "live";
  const watching = live && camera.tracking === "ready";
  const online = selectedCamera
    ? (app.data?.camerasOnline.includes(selectedCamera.id) ?? false)
    : false;
  const lastAlert = app.data?.alerts.find((alert) => alert.id === lastAlertId);
  const flashAlert = flash
    ? app.data?.alerts.find((alert) => alert.id === flash.alertId)
    : undefined;
  const cooling = camera.view.status === "cooldown";

  const detection =
    sending.kind === "sending"
      ? "Sending alert"
      : watching
        ? camera.view.status === "step1"
          ? "Step 1 seen"
          : cooling
            ? "Signal sent"
            : "Watching"
        : live && camera.tracking === "loading"
          ? "Loading hand model"
          : live && camera.tracking === "error"
            ? "Hand model unavailable"
            : "Not detecting";

  return (
    <>
      <PageHead
        title="Eye"
        chip={
          selectedCamera && (
            <Chip tone="outline">
              <Camera aria-hidden="true" className="size-3.5" />
              {selectedCamera.name}
            </Chip>
          )
        }
        lede="Watches this camera for the Signal for Help. Video stays on this device; one snapshot is sent when the signal is seen."
      />

      {app.status === "error" && (
        <Notice
          tone="accent"
          className="mb-3.5"
          action={
            <Button size="sm" variant="ink" onClick={retryLoad}>
              Try again
            </Button>
          }
        >
          Cannot reach the Ishaara server. {app.error}
        </Notice>
      )}
      {sending.kind === "error" && (
        <Notice
          tone="accent"
          className="mb-3.5"
          action={
            <Button size="sm" variant="ink" onClick={() => setSending({ kind: "idle" })}>
              Dismiss
            </Button>
          }
        >
          {sending.message}
        </Notice>
      )}

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12">
        <div className="flex flex-col lg:col-span-8">
          <div className="relative isolate aspect-[4/3] overflow-hidden rounded-[26px] bg-tile sm:aspect-[16/10] lg:aspect-auto lg:min-h-[420px] lg:flex-1">
            <CameraFeed
              videoRef={camera.videoRef}
              canvasRef={camera.canvasRef}
              camera={camera.camera}
              tracking={camera.tracking}
              onRetryCamera={camera.retryCamera}
              onRetryTracking={camera.retryTracking}
              hero
              problemSuffix={demoMode ? "Simulate signal still works." : undefined}
            />

            <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-4">
              <div className="flex flex-wrap items-center gap-2">
                {selectedCamera && (
                  <span className="glass-dark inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold text-white">
                    <span className="tabular">{cameraCode(selectedCamera.id)}</span>
                    <span>· {online ? "Online" : "Offline"}</span>
                  </span>
                )}
                <span className="glass-dark inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold text-white">
                  {watching ? (
                    <>
                      <Dot className="bg-accent" pulse /> Watching
                    </>
                  ) : live && camera.tracking === "loading" ? (
                    <>
                      <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" /> Loading
                      hand model
                    </>
                  ) : live && camera.tracking === "error" ? (
                    <>
                      <Dot className="bg-rose" /> Hand model unavailable
                    </>
                  ) : (
                    <>
                      <Dot className="bg-white/40" /> Not watching
                    </>
                  )}
                </span>
              </div>
              {live && (
                <span className="glass-dark inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold text-white/90">
                  <ScanLine aria-hidden="true" className="size-3.5" />
                  {camera.view.handsInView === 0
                    ? "No hands in view"
                    : `${camera.view.handsInView} hand${camera.view.handsInView > 1 ? "s" : ""} in view`}
                </span>
              )}
            </div>

            {watching && (
              <SignalStageBar
                status={camera.view.status}
                handsInView={camera.view.handsInView}
                doneText="Signal sent. Watching again shortly"
                className="absolute inset-x-4 bottom-4 sm:right-auto sm:w-[360px]"
              />
            )}

            {flash && (
              <div
                role="status"
                className="hero-gradient absolute inset-0 z-10 flex animate-rise flex-col items-center justify-center p-6 text-center"
              >
                <span className="relative flex size-20 items-center justify-center">
                  <span className="absolute inset-0 animate-ping-soft rounded-full bg-white/30" />
                  <span className="relative flex size-16 items-center justify-center rounded-full bg-white text-accent-ink">
                    <Send aria-hidden="true" className="size-7" />
                  </span>
                </span>
                <p className="mt-6 text-[28px] font-medium tracking-[-0.045em]">
                  {flash.duplicate
                    ? "Already sent"
                    : flash.simulated
                      ? "Signal simulated"
                      : "Signal recognised"}
                </p>
                <p className="mt-1 text-[14px] text-white/90">
                  {flash.duplicate
                    ? "This camera already has an open alert. Security is on it."
                    : `Security has been alerted to ${selectedCamera?.name ?? "this camera"}.`}
                </p>
                <div className="glass mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 rounded-full px-4 py-2 text-[13px] font-semibold">
                  <span className="flex items-center gap-1.5">
                    {flash.snapshot ? (
                      <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />
                    ) : (
                      <ImageOff aria-hidden="true" className="size-3.5" />
                    )}
                    {flash.snapshot ? "Snapshot captured" : "No snapshot, camera not live"}
                  </span>
                  {flashAlert && (
                    <span className="tabular">
                      {incidentCode(flashAlert)} · {formatTime(flashAlert.createdAt)}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
          <p className="mt-3 flex items-center gap-2 px-2 text-[13px] text-ink-3">
            <ShieldCheck aria-hidden="true" className="size-4 shrink-0" /> No video leaves this
            device. No faces are identified, only 21 hand points.
            {cooling &&
              ` After a signal, this camera waits ${Math.round(cooldownMs / 1000)} s before it can send another.`}
          </p>
        </div>

        <div className="flex flex-col gap-3.5 lg:col-span-4">
          <Card notch className="p-6">
            <CardHead title="This camera" />
            <label htmlFor={selectId} className="mt-5 block text-[13px] font-semibold text-ink-2">
              Camera location
            </label>
            <Select
              id={selectId}
              wrapperClassName="mt-2"
              value={selectedCamera?.id ?? ""}
              disabled={cameras.length === 0}
              onChange={(event) => setCameraId(event.target.value)}
            >
              {cameras.length === 0 && <option value="">Loading cameras</option>}
              {cameras.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </Select>
            <p className="mt-2 text-[12px] text-ink-3">
              Shown to security with every alert from this device.
            </p>
            <dl className="mt-5 grid grid-cols-[120px_1fr] gap-y-2.5 text-[13px]">
              <dt className="text-ink-2">Camera ID</dt>
              <dd className="font-semibold tabular">
                {selectedCamera ? cameraCode(selectedCamera.id) : "–"}
              </dd>
              <dt className="text-ink-2">Location</dt>
              <dd className="font-semibold">{selectedCamera?.zone ?? "–"}</dd>
              <dt className="text-ink-2">Connection</dt>
              <dd className="flex items-center gap-1.5 font-semibold">
                <Dot className={online ? "bg-accent" : "bg-ink-3"} pulse={online} />
                {online ? "Online · visible to Command" : "Offline"}
              </dd>
              <dt className="text-ink-2">Gesture detection</dt>
              <dd className="font-semibold" aria-live="polite">
                {detection}
              </dd>
            </dl>
            <div className="mt-5 flex items-center justify-between gap-4 rounded-[18px] bg-sunken p-4">
              <div>
                <p className="text-[14px] font-semibold">Show tracking</p>
                <p id={trackingHintId} className="mt-0.5 text-[12px] text-ink-2">
                  Draws the 21 hand points on the preview.
                </p>
              </div>
              <Toggle
                checked={showTracking}
                onChange={setShowTracking}
                label="Show tracking"
                describedBy={trackingHintId}
              />
            </div>
          </Card>

          <LastAlertCard alert={lastAlert} />

          {demoMode && (
            <Card className="p-6">
              <CardHead
                title="Demo mode"
                sub="Timers are shortened. Simulate signal raises a demo alert that Command and guards will ring for."
                right={<Chip tone="soft">On</Chip>}
              />
              <Button
                variant="accent"
                icon={Send}
                size="lg"
                fullWidth
                className="mt-5"
                disabled={!selectedCamera || sending.kind === "sending"}
                onClick={simulate}
              >
                Simulate signal
              </Button>
              <p className="mt-3 flex items-center gap-1.5 text-[12px] text-ink-3">
                Keyboard <Kbd>Shift</Kbd> + <Kbd>S</Kbd>
                <span className="ml-auto tabular">{ringSeconds} s per guard</span>
              </p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function LastAlertCard({ alert }: { alert: Alert | undefined }) {
  const [failedSnapshot, setFailedSnapshot] = useState<string | null>(null);
  const status = alert ? alertStatus(alert) : null;
  const snapshot = alert?.snapshotUrl && failedSnapshot !== alert.id ? alert.snapshotUrl : null;

  return (
    <Card tone="inverse" className="p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[19px] font-medium tracking-[-0.03em]">Last alert</h2>
        {alert && <Chip tone="gold">{incidentCode(alert)}</Chip>}
      </div>
      {alert && status ? (
        <>
          <dl className="mt-5 grid grid-cols-[84px_1fr] gap-y-3 text-[13px]">
            <dt className="text-inverse-ink-2">Incident</dt>
            <dd className="font-semibold tabular">{incidentCode(alert)}</dd>
            <dt className="text-inverse-ink-2">From</dt>
            <dd className="font-semibold">
              {cameraCode(alert.cameraId)} · {alert.cameraLabel}
            </dd>
            <dt className="text-inverse-ink-2">Sent at</dt>
            <dd className="font-semibold tabular">{formatTime(alert.createdAt)}</dd>
            <dt className="text-inverse-ink-2">Source</dt>
            <dd className="font-semibold">{alert.source === "camera" ? "Camera" : "Simulated"}</dd>
          </dl>
          <div className="mt-5 flex items-center gap-2.5 rounded-[18px] bg-white/[0.06] px-4 py-3 text-[13px] font-semibold">
            <Dot
              className={status.tone === "ink" ? "bg-inverse-ink" : toneDot[status.tone]}
              pulse={status.pulse}
            />
            {status.label}
          </div>
          <figure className="mt-4">
            <div className="relative aspect-[16/10] overflow-hidden rounded-[18px] bg-white/[0.05]">
              {snapshot ? (
                <img
                  src={snapshot}
                  alt={`Snapshot for ${incidentCode(alert)} from ${alert.cameraLabel}`}
                  onError={() => setFailedSnapshot(alert.id)}
                  className="size-full object-cover outline-1 -outline-offset-1 outline-white/10"
                />
              ) : (
                <div className="flex size-full flex-col items-center justify-center gap-2 text-inverse-ink-2">
                  <ImageOff aria-hidden="true" className="size-5" />
                  <span className="text-[12px] font-medium">No snapshot captured</span>
                </div>
              )}
            </div>
            <figcaption className="mt-2 text-[12px] text-inverse-ink-2">
              {snapshot
                ? "Captured once, when the signal was recognised."
                : "The camera was not live when this alert was sent."}
            </figcaption>
          </figure>
          <IncidentProgress alert={alert} className="mt-5" />
        </>
      ) : (
        <p className="mt-4 text-[13px] leading-relaxed text-inverse-ink-2">
          Nothing sent from this device yet. When the signal is seen, the alert appears here.
        </p>
      )}
    </Card>
  );
}
