import type { Landmark, TrackedHand } from "@ishaara/gesture";

const CONNECTIONS: readonly [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
];

interface Palette {
  line: string;
  idle: string;
  step: string;
}

let palette: Palette | null = null;

function readPalette(): Palette {
  if (palette) return palette;
  const styles = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
  palette = {
    line: read("--color-surface", "#ffffff"),
    idle: read("--color-accent", "#1d4a94"),
    step: read("--color-ringing-mark", "#c98a00"),
  };
  return palette;
}

export function drawHands(
  canvas: HTMLCanvasElement | null,
  video: HTMLVideoElement,
  hands: readonly (readonly Landmark[])[],
  tracked: readonly TrackedHand[],
): void {
  if (!canvas) return;
  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }
  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (hands.length === 0) return;

  const colours = readPalette();
  const scale = canvas.width / 640;
  const at = (point: Landmark): [number, number] => [
    point.x * canvas.width,
    point.y * canvas.height,
  ];

  hands.forEach((hand, index) => {
    const inStep = tracked[index]?.stage === "sawA";
    context.strokeStyle = colours.line;
    context.globalAlpha = 0.9;
    context.lineWidth = 2 * scale;
    context.beginPath();
    for (const [from, to] of CONNECTIONS) {
      const a = hand[from];
      const b = hand[to];
      if (!a || !b) continue;
      context.moveTo(...at(a));
      context.lineTo(...at(b));
    }
    context.stroke();

    context.globalAlpha = 1;
    context.fillStyle = inStep ? colours.step : colours.idle;
    context.lineWidth = 1.5 * scale;
    for (const point of hand) {
      const [x, y] = at(point);
      context.beginPath();
      context.arc(x, y, 4 * scale, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    }
  });
}

export function clearCanvas(canvas: HTMLCanvasElement | null): void {
  canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
}
