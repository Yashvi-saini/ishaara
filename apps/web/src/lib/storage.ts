import { useCallback, useState } from "react";

export function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    return;
  }
}

export function useStoredString(key: string, fallback: string): [string, (value: string) => void] {
  const [value, setValue] = useState(() => readStored(key) ?? fallback);
  const update = useCallback(
    (next: string) => {
      setValue(next);
      writeStored(key, next);
    },
    [key],
  );
  return [value, update];
}

export function useStoredFlag(key: string, fallback: boolean): [boolean, (value: boolean) => void] {
  const [raw, setRaw] = useStoredString(key, fallback ? "1" : "0");
  const update = useCallback((next: boolean) => setRaw(next ? "1" : "0"), [setRaw]);
  return [raw === "1", update];
}
