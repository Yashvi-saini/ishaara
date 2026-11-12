import { useEffect, useRef, useState, type RefObject } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia(QUERY).matches;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => {
    const media = window.matchMedia(QUERY);
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

const TILT_VARS = ["--rx", "--ry", "--px", "--py", "--mx", "--my"];

export function useTilt<T extends HTMLElement>(maxDegrees = 6): RefObject<T | null> {
  const ref = useRef<T>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const element = ref.current;
    if (!element || reduced) return;
    let frame = 0;
    let pointer: { x: number; y: number } | null = null;

    const paint = () => {
      frame = 0;
      if (!pointer) return;
      const box = element.getBoundingClientRect();
      const px = (pointer.x - box.left) / box.width - 0.5;
      const py = (pointer.y - box.top) / box.height - 0.5;
      element.style.setProperty("--rx", `${(-py * maxDegrees).toFixed(2)}deg`);
      element.style.setProperty("--ry", `${(px * maxDegrees).toFixed(2)}deg`);
      element.style.setProperty("--px", px.toFixed(3));
      element.style.setProperty("--py", py.toFixed(3));
      element.style.setProperty("--mx", `${((px + 0.5) * 100).toFixed(1)}%`);
      element.style.setProperty("--my", `${((py + 0.5) * 100).toFixed(1)}%`);
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      pointer = { x: event.clientX, y: event.clientY };
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const leave = () => {
      pointer = null;
      cancelAnimationFrame(frame);
      frame = 0;
      for (const name of TILT_VARS) element.style.removeProperty(name);
    };

    element.addEventListener("pointermove", move);
    element.addEventListener("pointerleave", leave);
    return () => {
      leave();
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerleave", leave);
    };
  }, [maxDegrees, reduced]);

  return ref;
}

export function useCountUp(target: number, durationMs = 700): number {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? target : 0));
  const current = useRef(shown);

  useEffect(() => {
    const from = current.current;
    if (from === target) return;
    if (reduced) {
      current.current = target;
      setShown(target);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - progress) ** 3;
      const value = Math.round(from + (target - from) * eased);
      current.current = value;
      setShown(value);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs, reduced]);

  return shown;
}
