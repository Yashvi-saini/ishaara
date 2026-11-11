import type { Landmark } from "@ishaara/gesture";
import type { TrackerRequest, TrackerResponse } from "./protocol";

const FRAME_WIDTH = 640;
const RETRY_MS = 100;

export interface HandTrackerCallbacks {
  onReady(): void;
  onHands(hands: Landmark[][], timestamp: number): void;
  onError(message: string): void;
}

export interface HandTracker {
  stop(): void;
}

export function createHandTracker(
  video: HTMLVideoElement,
  callbacks: HandTrackerCallbacks,
): HandTracker {
  const worker = new Worker(new URL("../../workers/handTracker.worker.ts", import.meta.url), {
    type: "module",
  });
  let stopped = false;
  let ready = false;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  function send(message: TrackerRequest, transfer: Transferable[] = []): void {
    worker.postMessage(message, transfer);
  }

  function retryLater(): void {
    retryTimer = setTimeout(() => void sendFrame(), RETRY_MS);
  }

  async function sendFrame(): Promise<void> {
    if (stopped) return;
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0) {
      retryLater();
      return;
    }
    try {
      const scale = Math.min(1, FRAME_WIDTH / video.videoWidth);
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
      retryLater();
    }
  }

  worker.onmessage = (event: MessageEvent<TrackerResponse>) => {
    if (stopped) return;
    const message = event.data;
    if (message.type === "ready") {
      ready = true;
      callbacks.onReady();
      void sendFrame();
    } else if (message.type === "hands") {
      callbacks.onHands(message.hands, message.timestamp);
      void sendFrame();
    } else if (!ready) {
      callbacks.onError(message.message);
    } else {
      console.warn("Hand tracking skipped a frame:", message.message);
    }
  };

  worker.onerror = (event) => {
    if (!stopped && !ready) callbacks.onError(event.message);
  };

  send({
    type: "init",
    wasmPath: new URL("/mediapipe/wasm", window.location.origin).href,
    modelPath: new URL("/mediapipe/hand_landmarker.task", window.location.origin).href,
  });

  return {
    stop() {
      stopped = true;
      clearTimeout(retryTimer);
      worker.terminate();
    },
  };
}
