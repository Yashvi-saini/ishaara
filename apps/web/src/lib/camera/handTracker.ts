import type { Landmark } from "@ishaara/gesture";
import type { TrackerDelegate, TrackerRequest, TrackerResponse } from "./protocol";

export interface HandTrackerOptions {
  frameLongSide: number;
  numHands: number;
}

export interface HandTrackerCallbacks {
  onReady(delegate: TrackerDelegate): void;
  onHands(hands: Landmark[][], timestamp: number): void;
  onError(message: string): void;
}

export interface HandTracker {
  stop(): void;
}

let gpuUnavailable = false;

export function createHandTracker(
  video: HTMLVideoElement,
  { frameLongSide, numHands }: HandTrackerOptions,
  callbacks: HandTrackerCallbacks,
): HandTracker {
  const watchesVideoFrames = "requestVideoFrameCallback" in video;
  let worker: Worker | null = null;
  let stopped = false;
  let ready = false;
  let workerIdle = false;
  let newFrameWaiting = false;
  let frameHandle = 0;

  function send(message: TrackerRequest, transfer: Transferable[] = []): void {
    worker?.postMessage(message, transfer);
  }

  function watchNextFrame(): void {
    if (stopped) return;
    frameHandle = watchesVideoFrames
      ? video.requestVideoFrameCallback(onVideoFrame)
      : requestAnimationFrame(onVideoFrame);
  }

  function onVideoFrame(): void {
    if (stopped) return;
    newFrameWaiting = true;
    if (workerIdle) void sendFrame();
    watchNextFrame();
  }

  function becomeIdle(): void {
    workerIdle = true;
    if (newFrameWaiting) void sendFrame();
  }

  async function sendFrame(): Promise<void> {
    workerIdle = false;
    newFrameWaiting = false;
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0) {
      workerIdle = true;
      return;
    }
    try {
      const longSide = Math.max(video.videoWidth, video.videoHeight);
      const scale = Math.min(1, frameLongSide / longSide);
      const bitmap = await createImageBitmap(video, {
        resizeWidth: Math.round(video.videoWidth * scale),
        resizeHeight: Math.round(video.videoHeight * scale),
        resizeQuality: "low",
      });
      if (stopped) {
        bitmap.close();
        return;
      }
      send({ type: "frame", bitmap, timestamp: performance.now() }, [bitmap]);
    } catch {
      workerIdle = true;
    }
  }

  function failBeforeReady(delegate: TrackerDelegate, message: string): void {
    if (delegate === "GPU") {
      console.warn("GPU hand tracking unavailable, using CPU:", message);
      gpuUnavailable = true;
      worker?.terminate();
      start("CPU");
    } else {
      callbacks.onError(message);
    }
  }

  function start(delegate: TrackerDelegate): void {
    const current = new Worker(new URL("../../workers/handTracker.worker.ts", import.meta.url), {
      type: "module",
    });
    worker = current;

    current.onmessage = (event: MessageEvent<TrackerResponse>) => {
      if (stopped || worker !== current) return;
      const message = event.data;
      if (message.type === "ready") {
        ready = true;
        callbacks.onReady(message.delegate);
        newFrameWaiting = true;
        becomeIdle();
        watchNextFrame();
      } else if (message.type === "hands") {
        callbacks.onHands(message.hands, message.timestamp);
        becomeIdle();
      } else if (!ready) {
        failBeforeReady(delegate, message.message);
      } else {
        console.warn("Hand tracking skipped a frame:", message.message);
      }
    };

    current.onerror = (event) => {
      if (!stopped && !ready && worker === current) failBeforeReady(delegate, event.message);
    };

    send({
      type: "init",
      wasmPath: new URL("/mediapipe/wasm", window.location.origin).href,
      modelPath: new URL("/mediapipe/hand_landmarker.task", window.location.origin).href,
      numHands,
      delegate,
    });
  }

  start(gpuUnavailable ? "CPU" : "GPU");

  return {
    stop() {
      stopped = true;
      if (watchesVideoFrames) video.cancelVideoFrameCallback(frameHandle);
      else cancelAnimationFrame(frameHandle);
      worker?.terminate();
    },
  };
}
