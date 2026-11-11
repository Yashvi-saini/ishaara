import type { PublicConfig } from "./types.js";

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  publicUrl: string;
}

export interface AppConfig extends PublicConfig {
  port: number;
  maxAlerts: number;
  campusName: string | undefined;
  twilio: TwilioConfig | null;
  guardPhones: Record<string, string>;
}

type Env = Record<string, string | undefined>;

const SECOND = 1000;
const PHONE_NUMBER = /^\+[1-9]\d{7,14}$/;

function isTrue(value: string | undefined): boolean {
  return value !== undefined && ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function parseGuardPhones(value: string | undefined): Record<string, string> {
  const phones: Record<string, string> = {};
  for (const entry of (value ?? "").split(",")) {
    const [rawId, rawPhone] = entry.split("=");
    const guardId = rawId?.trim();
    const phone = rawPhone?.replace(/[\s()-]/g, "");
    if (guardId && phone && PHONE_NUMBER.test(phone)) phones[guardId] = phone;
  }
  return phones;
}

function loadTwilio(env: Env): TwilioConfig | null {
  const accountSid = clean(env.TWILIO_ACCOUNT_SID);
  const authToken = clean(env.TWILIO_AUTH_TOKEN);
  const fromNumber = clean(env.TWILIO_FROM_NUMBER);
  const publicUrl = clean(env.PUBLIC_URL) ?? clean(env.RENDER_EXTERNAL_URL);
  if (!accountSid || !authToken || !fromNumber || !publicUrl) return null;
  return { accountSid, authToken, fromNumber, publicUrl: publicUrl.replace(/\/+$/, "") };
}

export function loadConfig(env: Env = process.env): AppConfig {
  const demoMode = isTrue(env.DEMO_MODE);
  const port = Number(env.PORT);
  const twilio = loadTwilio(env);
  const guardPhones = parseGuardPhones(env.GUARD_PHONES);

  return {
    port: Number.isInteger(port) && port > 0 ? port : 3001,
    demoMode,
    ringMs: (demoMode ? 8 : 20) * SECOND,
    cameraCooldownMs: (demoMode ? 5 : 30) * SECOND,
    phoneCalls: twilio !== null && Object.keys(guardPhones).length > 0,
    maxAlerts: 50,
    campusName: clean(env.CAMPUS_NAME),
    twilio,
    guardPhones,
  };
}

export function toPublicConfig(config: AppConfig): PublicConfig {
  return {
    demoMode: config.demoMode,
    ringMs: config.ringMs,
    cameraCooldownMs: config.cameraCooldownMs,
    phoneCalls: config.phoneCalls,
  };
}
