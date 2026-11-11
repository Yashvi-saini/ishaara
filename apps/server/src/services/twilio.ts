import { createHmac, timingSafeEqual } from "node:crypto";
import type { TwilioConfig } from "../config.js";
import type { Alert, Guard } from "../types.js";
import type { RingChannel } from "./escalation.js";

export const PHONE_CHANNEL = "phone";

type Fetch = typeof fetch;

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function twiml(...sayings: string[]): string {
  const body = sayings.map((text) => `<Say language="en-IN">${escapeXml(text)}</Say>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`;
}

export function gatherUrl(publicUrl: string, alertId: string, guardId: string): string {
  const query = new URLSearchParams({ alert: alertId, guard: guardId });
  return `${publicUrl}/api/twilio/gather?${query.toString()}`;
}

export function ringTwiml(alert: Alert, guard: Guard, publicUrl: string, ringMs: number): string {
  const action = escapeXml(gatherUrl(publicUrl, alert.id, guard.id));
  const seconds = Math.max(5, Math.ceil(ringMs / 1000));
  const message = escapeXml(
    `Silent help signal at ${alert.cameraLabel}. Press 1 if you are going.`,
  );
  return (
    `<?xml version="1.0" encoding="UTF-8"?><Response>` +
    `<Gather input="dtmf" numDigits="1" timeout="${seconds}" action="${action}" method="POST">` +
    `<Say language="en-IN">${message}</Say><Pause length="1"/>` +
    `<Say language="en-IN">${message}</Say></Gather>` +
    `<Say language="en-IN">No key pressed. Goodbye.</Say></Response>`
  );
}

export function twilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
): string {
  const payload = Object.keys(params)
    .sort()
    .reduce((text, key) => text + key + params[key], url);
  return createHmac("sha1", authToken).update(payload, "utf8").digest("base64");
}

export function isValidTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
  signature: string | undefined,
): boolean {
  if (!signature) return false;
  const expected = Buffer.from(twilioSignature(authToken, url, params));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export interface TwilioChannel extends RingChannel {
  settle(): Promise<void>;
}

export interface TwilioChannelDeps {
  config: TwilioConfig;
  guardPhones: Readonly<Record<string, string>>;
  ringMs: number;
  fetch?: Fetch;
}

export function createTwilioChannel(deps: TwilioChannelDeps): TwilioChannel {
  const { config, guardPhones, ringMs } = deps;
  const send = deps.fetch ?? fetch;
  const callsUrl = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.accountSid)}/Calls`;
  const authorization = `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`;
  const calls = new Map<string, string>();
  const hangUpWhenStarted = new Set<string>();
  const inFlight = new Set<Promise<void>>();

  function track(work: Promise<void>): void {
    inFlight.add(work);
    void work.finally(() => inFlight.delete(work));
  }

  async function post(url: string, body: Record<string, string>): Promise<Record<string, unknown>> {
    const response = await send(url, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(body).toString(),
    });
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      const reason = typeof data.message === "string" ? data.message : `HTTP ${response.status}`;
      throw new Error(reason);
    }
    return data;
  }

  async function hangUp(callSid: string): Promise<void> {
    try {
      await post(`${callsUrl}/${encodeURIComponent(callSid)}.json`, { Status: "completed" });
    } catch {
      return;
    }
  }

  async function startCall(key: string, phone: string, twimlBody: string): Promise<void> {
    try {
      const data = await post(`${callsUrl}.json`, {
        To: phone,
        From: config.fromNumber,
        Twiml: twimlBody,
        Timeout: String(Math.max(5, Math.ceil(ringMs / 1000))),
      });
      const callSid = typeof data.sid === "string" ? data.sid : null;
      if (!callSid) return;
      if (hangUpWhenStarted.delete(key)) await hangUp(callSid);
      else calls.set(key, callSid);
    } catch (error) {
      hangUpWhenStarted.delete(key);
      console.warn(
        `Phone call to a guard failed: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  }

  return {
    name: PHONE_CHANNEL,
    ring({ guard, alert }) {
      const phone = guardPhones[guard.id];
      if (!phone) return false;
      const key = `${alert.id}:${guard.id}`;
      hangUpWhenStarted.delete(key);
      track(startCall(key, phone, ringTwiml(alert, guard, config.publicUrl, ringMs)));
      return true;
    },
    stop(guard, alert) {
      const key = `${alert.id}:${guard.id}`;
      const callSid = calls.get(key);
      if (callSid) {
        calls.delete(key);
        track(hangUp(callSid));
      } else if (guardPhones[guard.id]) {
        hangUpWhenStarted.add(key);
      }
    },
    async settle() {
      while (inFlight.size > 0) await Promise.all([...inFlight]);
    },
  };
}
