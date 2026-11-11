import type { Landmark } from "@ishaara/gesture";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import type { TrackerRequest, TrackerResponse } from "../lib/camera/protocol";

const MIN_FRAME_MS = 33;

let landmarker: HandLandmarker | null = null;

function post(message: TrackerResponse): void {
  self.postMessage(message);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function init(wasmPath: string, modelPath: string): Promise<void> {
  const fileset = await FilesetResolver.forVisionTasks(wasmPath, true);
  landmarker = await HandLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: modelPath, delegate: "CPU" },
    runningMode: "VIDEO",
    numHands: 2,
  });
  post({ type: "ready" });
}

function detect(bitmap: ImageBitmap, timestamp: number): void {
  const startedAt = performance.now();
  let hands: Landmark[][] = [];
  try {
    if (landmarker) {
      const result = landmarker.detectForVideo(bitmap, timestamp);
      hands = result.landmarks.map((hand) => hand.map(({ x, y, z }) => ({ x, y, z })));
    }
  } catch (error) {
    post({ type: "error", message: describe(error) });
  } finally {
    bitmap.close();
  }
  const wait = Math.max(0, MIN_FRAME_MS - (performance.now() - startedAt));
  setTimeout(() => post({ type: "hands", hands, timestamp }), wait);
}

self.onmessage = (event: MessageEvent<TrackerRequest>) => {
  const message = event.data;
  if (message.type === "init") {
    init(message.wasmPath, message.modelPath).catch((error: unknown) => {
      post({ type: "error", message: describe(error) });
    });
  } else {
    detect(message.bitmap, message.timestamp);
  }
};
