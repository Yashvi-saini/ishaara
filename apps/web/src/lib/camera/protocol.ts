import type { Landmark } from "@ishaara/gesture";

export type TrackerDelegate = "GPU" | "CPU";

export type TrackerRequest =
  | {
      type: "init";
      wasmPath: string;
      modelPath: string;
      numHands: number;
      delegate: TrackerDelegate;
    }
  | { type: "frame"; bitmap: ImageBitmap; timestamp: number };

export type TrackerResponse =
  | { type: "ready"; delegate: TrackerDelegate }
  | { type: "hands"; hands: Landmark[][]; timestamp: number }
  | { type: "error"; message: string };
