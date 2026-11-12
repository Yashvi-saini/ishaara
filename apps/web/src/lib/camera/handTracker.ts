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

interface Session {
  ready(delegate: TrackerDelegate): void;
  hands(hands: Landmark[][], timestamp: number): void;
  fail(message: string): void;
}

interface Engine {
  worker: Worker;
  numHands: number;
  delegate: TrackerDelegate;
  ready: boolean;
  idle: boolean;
  sender: Session | null;
}

let gpuUnavailable = false;
let engine: Engine | null = null;
let session: Session | null = null;

function send(target: Engine, message: TrackerRequest, transfer: Transferable[] = []): void {
  target.worker.postMessage(message, transfer);
}

function launch(numHands: number, delegate: TrackerDelegate): Engine {
  const worker = new Worker(new URL("../../workers/handTracker.worker.ts", import.meta.url), {
    type: "module",
  });
  const current: Engine = { worker, numHands, delegate, ready: false, idle: false, sender: null };

  worker.onmessage = (event: MessageEvent<TrackerResponse>) => {
    if (engine !== current) return;
    const message = event.data;
    if (message.type === "ready") {
      current.ready = true;
      current.idle = true;
      session?.ready(delegate);
    } else if (message.type === "hands") {
      const sender = current.sender;
      current.sender = null;
      current.idle = true;
      if (sender && sender === session) sender.hands(message.hands, message.timestamp);
    } else if (!current.ready) {
      failBeforeReady(current, message.message);
    } else {
      console.warn("Hand tracking skipped a frame:", message.message);
    }
  };

  worker.onerror = (event) => {
    if (engine === current && !current.ready) failBeforeReady(current, event.message);
  };

  send(current, {
    type: "init",
    wasmPath: new URL("/mediapipe/wasm", window.location.origin).href,
    modelPath: new URL("/mediapipe/hand_landmarker.task", window.location.origin).href,
    numHands,
    delegate,
  });
  return current;
}

function failBeforeReady(failed: Engine, message: string): void {
  failed.worker.terminate();
  if (failed.delegate === "GPU") {
    console.warn("GPU hand tracking unavailable, using CPU:", message);
    gpuUnavailable = true;
    engine = launch(failed.numHands, "CPU");
  } else {
    engine = null;
    session?.fail(message);
  }
}

export function warmHandTracker(numHands: number): void {
  if (engine && engine.numHands === numHands) return;
  engine?.worker.terminate();
  engine = launch(numHands, gpuUnavailable ? "CPU" : "GPU");
}

export function createHandTracker(
  video: HTMLVideoElement,
  { frameLongSide, numHands }: HandTrackerOptions,
  callbacks: HandTrackerCallbacks,
): HandTracker {
  const watchesVideoFrames = "requestVideoFrameCallback" in video;
  let stopped = false;
  let watching = false;
  let newFrameWaiting = true;
  let frameHandle = 0;

  function watchNextFrame(): void {
    if (stopped) return;
    frameHandle = watchesVideoFrames
      ? video.requestVideoFrameCallback(onVideoFrame)
      : requestAnimationFrame(onVideoFrame);
  }

  function onVideoFrame(): void {
    if (stopped) return;
    newFrameWaiting = true;
    pump();
    watchNextFrame();
  }

  function pump(): void {
    const current = engine;
    if (stopped || !newFrameWaiting || !current?.ready || !current.idle) return;
    current.idle = false;
    newFrameWaiting = false;
    void sendFrame(current);
  }

  async function sendFrame(current: Engine): Promise<void> {
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0) {
      current.idle = true;
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
      if (stopped || engine !== current) {
        bitmap.close();
        current.idle = true;
        return;
      }
      current.sender = attached;
      send(current, { type: "frame", bitmap, timestamp: performance.now() }, [bitmap]);
    } catch {
      current.idle = true;
    }
  }

  const attached: Session = {
    ready(delegate) {
      if (stopped) return;
      callbacks.onReady(delegate);
      if (!watching) {
        watching = true;
        watchNextFrame();
      }
      pump();
    },
    hands(hands, timestamp) {
      if (stopped) return;
      callbacks.onHands(hands, timestamp);
      pump();
    },
    fail(message) {
      if (!stopped) callbacks.onError(message);
    },
  };

  session = attached;
  warmHandTracker(numHands);
  if (engine?.ready) attached.ready(engine.delegate);

  return {
    stop() {
      stopped = true;
      if (session === attached) session = null;
      if (watchesVideoFrames) video.cancelVideoFrameCallback(frameHandle);
      else cancelAnimationFrame(frameHandle);
    },
  };
}
