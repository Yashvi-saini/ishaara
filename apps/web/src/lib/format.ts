const clock = new Intl.DateTimeFormat("en-IN", {
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

export function formatTime(timestamp: number): string {
  return clock.format(timestamp);
}

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const padded = String(seconds).padStart(2, "0");
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${padded}`;
  return `${minutes}:${padded}`;
}

export function formatSeconds(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${seconds} s`;
}
