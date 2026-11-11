import { useEffect, useState } from "react";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
      console.warn("Service worker registration failed:", error);
    });
  });
}

export function listenForInstallPrompt(): void {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });
}

export function useInstallPrompt(): { canInstall: boolean; install: () => Promise<void> } {
  const [canInstall, setCanInstall] = useState(deferredPrompt !== null);
  useEffect(() => {
    const update = () => setCanInstall(deferredPrompt !== null);
    listeners.add(update);
    update();
    return () => {
      listeners.delete(update);
    };
  }, []);

  async function install(): Promise<void> {
    const prompt = deferredPrompt;
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    deferredPrompt = null;
    notify();
  }

  return { canInstall, install };
}
