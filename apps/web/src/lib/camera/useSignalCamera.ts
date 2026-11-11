import {
  createSignalDetector,
  type DetectorStatus,
  type SignalDetector,
  type SignalEvent,
} from "@ishaara/gesture";
import { useCallback, useEffect, useRef, useState } from "react";
import { createHandTracker } from "./handTracker";
import { clearCanvas, drawHands } from "./overlay";
import { captureSnapshot } from "./snapshot";

export type CameraState =
  "starting" | "live" | "blocked" | "missing" | "busy" | "insecure" | "error";
export type TrackingState = "waiting" | "loading" | "ready" | "error";

export interface DetectionView {
  status: DetectorStatus;
  handsInView: number;
}

export interface SignalCameraOptions {
  cooldownMs: number;
  showTracking: boolean;
  onSignal: (event: SignalEvent, snapshot: string | null) => void;
}

const CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
};

function classifyCameraError(error: unknown): CameraState {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "blocked";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "missing";
  if (name === "NotReadableError" || name === "AbortError") return "busy";
  return "error";
}

export function useSignalCamera({ cooldownMs, showTracking, onSignal }: SignalCameraOptions) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<SignalDetector | null>(null);
  const onSignalRef = useRef(onSignal);
  const showTrackingRef = useRef(showTracking);

  const [camera, setCamera] = useState<CameraState>("starting");
  const [cameraAttempt, setCameraAttempt] = useState(0);
  const [tracking, setTracking] = useState<TrackingState>("waiting");
  const [trackingAttempt, setTrackingAttempt] = useState(0);
  const [view, setView] = useState<DetectionView>({ status: "watching", handsInView: 0 });

  useEffect(() => {
    onSignalRef.current = onSignal;
    showTrackingRef.current = showTracking;
    if (!showTracking) clearCanvas(canvasRef.current);
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    setCamera("starting");

    async function start(element: HTMLVideoElement): Promise<void> {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamera(window.isSecureContext ? "missing" : "insecure");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia(CONSTRAINTS);
        if (cancelled) return;
        element.srcObject = stream;
        await element.play();
        if (!cancelled) setCamera("live");
      } catch (error) {
        if (!cancelled) setCamera(classifyCameraError(error));
      }
    }

    void start(video);
    return () => {
      cancelled = true;
      for (const track of stream?.getTracks() ?? []) track.stop();
      video.srcObject = null;
    };
  }, [cameraAttempt]);

  useEffect(() => {
    const video = videoRef.current;
    if (camera !== "live" || !video) {
      setTracking("waiting");
      return;
    }
    setTracking("loading");
    const canvas = canvasRef.current;
    const aspectRatio = video.videoWidth > 0 ? video.videoWidth / video.videoHeight : 16 / 9;
    const detector = createSignalDetector({ cooldownMs, aspectRatio });
    detectorRef.current = detector;

    const tracker = createHandTracker(video, {
      onReady: () => setTracking("ready"),
      onError: (message) => {
        console.error("Hand tracking failed to start:", message);
        setTracking("error");
      },
      onHands: (hands, timestamp) => {
        for (const event of detector.update(hands, timestamp)) {
          if (event.type === "signal") onSignalRef.current(event, captureSnapshot(video));
        }
        const next: DetectionView = {
          status: detector.status(timestamp),
          handsInView: hands.length,
        };
        setView((previous) =>
          previous.status === next.status && previous.handsInView === next.handsInView
            ? previous
            : next,
        );
        drawHands(canvas, video, showTrackingRef.current ? hands : [], detector.hands());
      },
    });

    return () => {
      tracker.stop();
      detectorRef.current = null;
      clearCanvas(canvas);
    };
  }, [camera, cooldownMs, trackingAttempt]);

  const retryCamera = useCallback(() => setCameraAttempt((count) => count + 1), []);
  const retryTracking = useCallback(() => setTrackingAttempt((count) => count + 1), []);
  const resetDetector = useCallback(() => detectorRef.current?.reset(), []);
  const snapshot = useCallback(() => captureSnapshot(videoRef.current), []);

  return {
    videoRef,
    canvasRef,
    camera,
    tracking,
    view,
    retryCamera,
    retryTracking,
    resetDetector,
    snapshot,
  };
}
