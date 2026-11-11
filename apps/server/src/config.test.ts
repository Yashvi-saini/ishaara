import { describe, expect, it } from "vitest";
import { loadConfig, toPublicConfig } from "./config.js";

describe("loadConfig", () => {
  it("uses realistic timers by default", () => {
    const config = loadConfig({});
    expect(config.demoMode).toBe(false);
    expect(config.ringMs).toBe(20_000);
    expect(config.cameraCooldownMs).toBe(30_000);
    expect(config.port).toBe(3001);
    expect(config.maxAlerts).toBe(50);
  });

  it("shortens timers in demo mode", () => {
    const config = loadConfig({ DEMO_MODE: "true" });
    expect(config.demoMode).toBe(true);
    expect(config.ringMs).toBe(8_000);
    expect(config.cameraCooldownMs).toBe(5_000);
  });

  it("reads the port and campus name", () => {
    const config = loadConfig({ PORT: "8080", CAMPUS_NAME: "  North campus " });
    expect(config.port).toBe(8080);
    expect(config.campusName).toBe("North campus");
  });

  it("falls back to the default port when PORT is not a number", () => {
    expect(loadConfig({ PORT: "abc" }).port).toBe(3001);
  });

  it("exposes only the settings the web app needs", () => {
    expect(toPublicConfig(loadConfig({ DEMO_MODE: "1" }))).toEqual({
      demoMode: true,
      ringMs: 8_000,
      cameraCooldownMs: 5_000,
      phoneCalls: false,
    });
  });
});
