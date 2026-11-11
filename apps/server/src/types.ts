/**
 * Types shared between the server and the web app.
 * The web app imports this file for types only, so keep it free of imports and runtime code.
 */

/** Runtime settings the web app needs to know about. */
export interface PublicConfig {
  demoMode: boolean;
  /** How long each guard is rung before the next one is tried, in milliseconds. */
  ringMs: number;
  /** How long a camera waits after sending a signal before it can send another, in milliseconds. */
  cameraCooldownMs: number;
}

export interface HealthResponse {
  ok: true;
  config: PublicConfig;
}
