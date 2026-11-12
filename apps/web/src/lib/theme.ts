import { useCallback, useState } from "react";
import { readStored, writeStored } from "./storage";

export type Theme = "light" | "dark";

const KEY = "ishaara.theme";
const THEME_COLOURS: Record<Theme, string> = { light: "#efeeec", dark: "#0e0e0e" };

function storedTheme(): Theme {
  return readStored(KEY) === "dark" ? "dark" : "light";
}

function apply(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOURS[theme]);
}

export function applyStoredTheme(): void {
  apply(storedTheme());
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(storedTheme);
  const update = useCallback((next: Theme) => {
    setTheme(next);
    writeStored(KEY, next);
    apply(next);
  }, []);
  return [theme, update];
}
