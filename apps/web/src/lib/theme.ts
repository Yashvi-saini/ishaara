import { useCallback, useState } from "react";
import { flushSync } from "react-dom";
import { prefersReducedMotion } from "./motion";
import { readStored, writeStored } from "./storage";

export type Theme = "light" | "dark";

export interface RevealOrigin {
  x: number;
  y: number;
}

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

export function useTheme(): [Theme, (theme: Theme, origin?: RevealOrigin) => void] {
  const [theme, setThemeState] = useState<Theme>(storedTheme);

  const update = useCallback((next: Theme, origin?: RevealOrigin) => {
    writeStored(KEY, next);
    const commit = () => {
      apply(next);
      setThemeState(next);
    };
    if (!origin || prefersReducedMotion() || typeof document.startViewTransition !== "function") {
      commit();
      return;
    }
    const transition = document.startViewTransition(() => flushSync(commit));
    const radius = Math.hypot(
      Math.max(origin.x, window.innerWidth - origin.x),
      Math.max(origin.y, window.innerHeight - origin.y),
    );
    transition.ready
      .then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${origin.x}px ${origin.y}px)`,
              `circle(${Math.ceil(radius)}px at ${origin.x}px ${origin.y}px)`,
            ],
          },
          {
            duration: 700,
            easing: "cubic-bezier(0.2, 0.7, 0.2, 1)",
            pseudoElement: "::view-transition-new(root)",
          },
        );
      })
      .catch(() => undefined);
  }, []);

  return [theme, update];
}
