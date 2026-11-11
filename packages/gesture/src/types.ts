/** One hand landmark as MediaPipe returns it: x and y are fractions of the image width and height. */
export interface Landmark {
  x: number;
  y: number;
  z?: number;
}

/** The 21 landmarks of one hand, in MediaPipe order (0 is the wrist). */
export type HandLandmarks = readonly Landmark[];

/** Number of landmarks MediaPipe returns for each hand. */
export const LANDMARK_COUNT = 21;
