import { describe, expect, it } from "vitest";
import { loadConfig, parseGuardPhones, type TwilioConfig } from "../config.js";
import { loadSeed } from "../seed/index.js";
import { createStore } from "../store/store.js";
import type { Alert, Camera, Guard } from "../types.js";
import {
  createTwilioChannel,
  escapeXml,
  gatherUrl,
  isValidTwilioSignature,
  ringTwiml,
  twilioSignature,
} from "./twilio.js";

const CONFIG: TwilioConfig = {
  accountSid: "AC123",
  authToken: "secret-token",
  fromNumber: "+15005550006",
  publicUrl: "https://ishaara.example.com",
};

interface Request {
  url: string;
  headers: Record<string, string>;
  body: URLSearchParams;
}

function fakeTwilio(options: { fail?: boolean; delay?: Promise<void> } = {}) {
  const requests: Request[] = [];
  let next = 1;
  const fetchFn = (async (url: string, init: RequestInit) => {
    requests.push({
      url,
      headers: init.headers as Record<string, string>,
      body: new URLSearchParams(String(init.body)),
    });
    if (options.delay) await options.delay;
    if (options.fail) {
      return new Response(JSON.stringify({ message: "Number not verified" }), { status: 400 });
    }
    return new Response(JSON.stringify({ sid: `CA${next++}` }), { status: 201 });
  }) as typeof fetch;
  return { requests, fetchFn };
}

function setup(fetchFn: typeof fetch) {
  const store = createStore(loadSeed(), { maxAlerts: 50 });
  const camera = store.getCamera("cam-4") as Camera;
  const alert = store.addAlert({ camera, snapshot: null, source: "camera", createdAt: 0 });
  const withPhone = store.getGuard("guard-1") as Guard;
  const withoutPhone = store.getGuard("guard-2") as Guard;
  const channel = createTwilioChannel({
    config: CONFIG,
    guardPhones: { "guard-1": "+919876543210" },
    ringMs: 20_000,
    fetch: fetchFn,
  });
  const ring = (guard: Guard, target: Alert = alert) =>
    channel.ring({ guard, alert: target, startedAt: 0, endsAt: 20_000 });
  return { channel, alert, withPhone, withoutPhone, ring };
}

describe("phone settings", () => {
  it("reads guard numbers and ignores malformed ones", () => {
    expect(
      parseGuardPhones("guard-1=+91 98765 43210, guard-2=12345, guard-3=+15005550006,broken"),
    ).toEqual({ "guard-1": "+919876543210", "guard-3": "+15005550006" });
    expect(parseGuardPhones(undefined)).toEqual({});
  });

  it("turns phone calls on only with every Twilio setting and at least one number", () => {
    const env = {
      TWILIO_ACCOUNT_SID: "AC1",
      TWILIO_AUTH_TOKEN: "t",
      TWILIO_FROM_NUMBER: "+15005550006",
      PUBLIC_URL: "https://x.example.com/",
      GUARD_PHONES: "guard-1=+919876543210",
    };
    const on = loadConfig(env);
    expect(on.phoneCalls).toBe(true);
    expect(on.twilio?.publicUrl).toBe("https://x.example.com");

    expect(loadConfig({ ...env, GUARD_PHONES: "" }).phoneCalls).toBe(false);
    expect(loadConfig({ ...env, TWILIO_AUTH_TOKEN: "" }).twilio).toBeNull();
    expect(loadConfig({}).phoneCalls).toBe(false);
  });

  it("uses Render's public address when PUBLIC_URL is not set", () => {
    const config = loadConfig({
      TWILIO_ACCOUNT_SID: "AC1",
      TWILIO_AUTH_TOKEN: "t",
      TWILIO_FROM_NUMBER: "+15005550006",
      RENDER_EXTERNAL_URL: "https://ishaara.onrender.com",
    });
    expect(config.twilio?.publicUrl).toBe("https://ishaara.onrender.com");
  });
});

describe("call script", () => {
  it("reads the location and waits for one key", () => {
    const { alert, withPhone } = setup(fakeTwilio().fetchFn);
    const xml = ringTwiml(alert, withPhone, CONFIG.publicUrl, 8000);
    expect(xml).toContain("Silent help signal at Parking, camera 4. Press 1 if you are going.");
    expect(xml).toContain('numDigits="1"');
    expect(xml).toContain('timeout="8"');
    expect(xml).toContain(escapeXml(gatherUrl(CONFIG.publicUrl, alert.id, withPhone.id)));
    expect(xml).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);
  });

  it("escapes text so a camera name cannot break the XML", () => {
    expect(escapeXml(`Gate <1> & "B"'s`)).toBe("Gate &lt;1&gt; &amp; &quot;B&quot;&apos;s");
  });
});

describe("phone channel", () => {
  it("does not call a guard without a number", () => {
    const fake = fakeTwilio();
    const { ring, withoutPhone } = setup(fake.fetchFn);
    expect(ring(withoutPhone)).toBe(false);
    expect(fake.requests).toHaveLength(0);
  });

  it("starts a call to the guard's number with the ring script", async () => {
    const fake = fakeTwilio();
    const { ring, withPhone, channel } = setup(fake.fetchFn);
    expect(ring(withPhone)).toBe(true);
    await channel.settle();

    const [call] = fake.requests;
    expect(call?.url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC123/Calls.json");
    expect(call?.headers.Authorization).toBe(
      `Basic ${Buffer.from("AC123:secret-token").toString("base64")}`,
    );
    expect(call?.body.get("To")).toBe("+919876543210");
    expect(call?.body.get("From")).toBe("+15005550006");
    expect(call?.body.get("Timeout")).toBe("20");
    expect(call?.body.get("Twiml")).toContain("Parking, camera 4");
  });

  it("hangs up when the ring stops", async () => {
    const fake = fakeTwilio();
    const { ring, withPhone, channel, alert } = setup(fake.fetchFn);
    ring(withPhone);
    await channel.settle();
    channel.stop(withPhone, alert);
    await channel.settle();

    const hangUp = fake.requests[1];
    expect(hangUp?.url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC123/Calls/CA1.json");
    expect(hangUp?.body.get("Status")).toBe("completed");
  });

  it("hangs up a call that was stopped before Twilio answered the request", async () => {
    let release = () => undefined as void;
    const delay = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fake = fakeTwilio({ delay });
    const { ring, withPhone, channel, alert } = setup(fake.fetchFn);
    ring(withPhone);
    channel.stop(withPhone, alert);
    release();
    await channel.settle();

    expect(fake.requests.map((request) => request.body.get("Status"))).toEqual([null, "completed"]);
  });

  it("logs a failed call without throwing", async () => {
    const fake = fakeTwilio({ fail: true });
    const { ring, withPhone, channel } = setup(fake.fetchFn);
    const warnings: string[] = [];
    const original = console.warn;
    console.warn = (message: string) => warnings.push(message);
    try {
      expect(ring(withPhone)).toBe(true);
      await channel.settle();
    } finally {
      console.warn = original;
    }
    expect(warnings).toEqual(["Phone call to a guard failed: Number not verified"]);
  });
});

describe("Twilio signature", () => {
  const url = "https://ishaara.example.com/api/twilio/gather?alert=a1&guard=guard-1";
  const params = { Digits: "1", CallSid: "CA1", From: "+919876543210" };

  it("accepts the signature Twilio would send", () => {
    const signature = twilioSignature("secret-token", url, params);
    expect(isValidTwilioSignature("secret-token", url, params, signature)).toBe(true);
  });

  it("rejects a missing, wrong or tampered signature", () => {
    const signature = twilioSignature("secret-token", url, params);
    expect(isValidTwilioSignature("secret-token", url, params, undefined)).toBe(false);
    expect(isValidTwilioSignature("other-token", url, params, signature)).toBe(false);
    expect(isValidTwilioSignature("secret-token", url, { ...params, Digits: "2" }, signature)).toBe(
      false,
    );
    expect(isValidTwilioSignature("secret-token", `${url}x`, params, signature)).toBe(false);
  });
});
