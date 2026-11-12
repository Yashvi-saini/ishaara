let context: AudioContext | null = null;

export function audioUnlocked(): boolean {
  return context?.state === "running";
}

export async function unlockAudio(): Promise<boolean> {
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") await context.resume();
    return context.state === "running";
  } catch {
    return false;
  }
}

export function unlockAudioOnFirstGesture(onUnlocked: () => void): () => void {
  const events = ["pointerdown", "keydown", "touchstart"] as const;
  let done = false;
  function detach(): void {
    for (const name of events) window.removeEventListener(name, attempt, true);
  }
  function attempt(): void {
    if (done) return;
    void unlockAudio().then((ok) => {
      if (!ok || done) return;
      done = true;
      detach();
      onUnlocked();
    });
  }
  for (const name of events) window.addEventListener(name, attempt, true);
  attempt();
  return () => {
    done = true;
    detach();
  };
}

function beep(at: number, frequency: number, duration: number, volume: number): void {
  if (!context) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(volume, at + 0.02);
  gain.gain.setValueAtTime(volume, at + duration - 0.04);
  gain.gain.linearRampToValueAtTime(0, at + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(at);
  oscillator.stop(at + duration);
}

function ringOnce(volume: number): void {
  if (!context || context.state !== "running") return;
  const now = context.currentTime;
  beep(now, 880, 0.22, volume);
  beep(now + 0.3, 660, 0.22, volume);
  beep(now + 0.6, 880, 0.22, volume);
}

export function playChime(): void {
  if (!context || context.state !== "running") return;
  const now = context.currentTime;
  beep(now, 660, 0.18, 0.3);
  beep(now + 0.22, 880, 0.24, 0.3);
}

export function startRinging(options: { volume?: number; everyMs?: number } = {}): () => void {
  const { volume = 0.5, everyMs = 1600 } = options;
  ringOnce(volume);
  const timer = setInterval(() => ringOnce(volume), everyMs);
  try {
    navigator.vibrate?.([400, 200, 400, 200, 400]);
  } catch {
    return () => clearInterval(timer);
  }
  return () => {
    clearInterval(timer);
    try {
      navigator.vibrate?.(0);
    } catch {
      return;
    }
  };
}
