import type { PublicConfig } from "./types.js";

export interface AppConfig extends PublicConfig {
  port: number;
  maxAlerts: number;
  campusName: string | undefined;
}

type Env = Record<string, string | undefined>;

const SECOND = 1000;

function isTrue(value: string | undefined): boolean {
  return value !== undefined && ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export function loadConfig(env: Env = process.env): AppConfig {
  const demoMode = isTrue(env.DEMO_MODE);
  const port = Number(env.PORT);
  const campusName = env.CAMPUS_NAME?.trim();

  return {
    port: Number.isInteger(port) && port > 0 ? port : 3001,
    demoMode,
    ringMs: (demoMode ? 8 : 20) * SECOND,
    cameraCooldownMs: (demoMode ? 5 : 30) * SECOND,
    maxAlerts: 50,
    campusName: campusName ? campusName : undefined,
  };
}

export function toPublicConfig(config: AppConfig): PublicConfig {
  return {
    demoMode: config.demoMode,
    ringMs: config.ringMs,
    cameraCooldownMs: config.cameraCooldownMs,
  };
}
