export type TimerHandle = unknown;

export interface Clock {
  now(): number;
  setTimeout(callback: () => void, ms: number): TimerHandle;
  clearTimeout(handle: TimerHandle): void;
}

export const systemClock: Clock = {
  now: () => Date.now(),
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => clearTimeout(handle as NodeJS.Timeout),
};

export interface FakeClock extends Clock {
  advance(ms: number): void;
  pending(): number;
}

export function createFakeClock(startAt = 0): FakeClock {
  let now = startAt;
  let nextHandle = 1;
  const timers = new Map<number, { dueAt: number; callback: () => void }>();

  return {
    now: () => now,
    setTimeout(callback, ms) {
      const handle = nextHandle++;
      timers.set(handle, { dueAt: now + ms, callback });
      return handle;
    },
    clearTimeout(handle) {
      timers.delete(handle as number);
    },
    advance(ms) {
      const target = now + ms;
      for (;;) {
        let next: [number, { dueAt: number; callback: () => void }] | undefined;
        for (const entry of timers) {
          if (entry[1].dueAt <= target && (!next || entry[1].dueAt < next[1].dueAt)) next = entry;
        }
        if (!next) break;
        timers.delete(next[0]);
        now = next[1].dueAt;
        next[1].callback();
      }
      now = target;
    },
    pending: () => timers.size,
  };
}
