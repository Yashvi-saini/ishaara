import type { Landmark } from "@ishaara/gesture";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import type { TrackerDelegate, TrackerRequest, TrackerResponse } from "../lib/camera/protocol";

const WARM_UP_SIZE = 64;

let landmarker: HandLandmarker | null = null;

function post(message: TrackerResponse): void {
  self.postMessage(message);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function init(
  wasmPath: string,
  modelPath: string,
  numHands: number,
  delegate: TrackerDelegate,
): Promise<void> {
  if (delegate === "GPU" && typeof OffscreenCanvas === "undefined") {
    throw new Error("OffscreenCanvas is not available for GPU tracking");
  }
  const fileset = await FilesetResolver.forVisionTasks(wasmPath, true);
  const created = await HandLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: modelPath, delegate },
    runningMode: "VIDEO",
    numHands,
  });
  if (delegate === "GPU") {
    try {
      created.detectForVideo(new OffscreenCanvas(WARM_UP_SIZE, WARM_UP_SIZE), 0);
    } catch (error) {
      created.close();
      throw error;
    }
  }
  landmarker = created;
  post({ type: "ready", delegate });
}

function detect(bitmap: ImageBitmap, timestamp: number): void {
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
  post({ type: "hands", hands, timestamp });
}

self.onmessage = (event: MessageEvent<TrackerRequest>) => {
  const message = event.data;
  if (message.type === "init") {
    init(message.wasmPath, message.modelPath, message.numHands, message.delegate).catch(
      (error: unknown) => {
        post({ type: "error", message: describe(error) });
      },
    );
  } else {
    detect(message.bitmap, message.timestamp);
  }
};
