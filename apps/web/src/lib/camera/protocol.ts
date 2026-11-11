import type { Landmark } from "@ishaara/gesture";

export type TrackerRequest =
  | { type: "init"; wasmPath: string; modelPath: string }
  | { type: "frame"; bitmap: ImageBitmap; timestamp: number };

export type TrackerResponse =
  | { type: "ready" }
  | { type: "hands"; hands: Landmark[][]; timestamp: number }
  | { type: "error"; message: string };
