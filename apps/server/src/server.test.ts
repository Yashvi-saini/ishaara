import type { AddressInfo } from "node:net";
import { io as connect, type Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";
import { createIshaaraServer, type IshaaraServer } from "./server.js";
import { createFakeClock, type FakeClock } from "./services/clock.js";
import type {
  ActionReply,
  Alert,
  AppState,
  ClientToServerEvents,
  CreateAlertResponse,
  GuardRing,
  JoinReply,
  ServerToClientEvents,
} from "./types.js";

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

const SNAPSHOT = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==";
const RING_MS = 8000;

let server: IshaaraServer;
let clock: FakeClock;
let baseUrl: string;
let clients: Client[];

beforeEach(async () => {
  clock = createFakeClock(1_700_000_000_000);
  server = createIshaaraServer(loadConfig({ DEMO_MODE: "true" }), { clock });
  clients = [];
  await new Promise<void>((resolve) => server.httpServer.listen(0, resolve));
  baseUrl = `http://localhost:${(server.httpServer.address() as AddressInfo).port}`;
});

afterEach(async () => {
  for (const client of clients) client.disconnect();
  await server.close();
});

async function openSocket(): Promise<Client> {
  const client: Client = connect(baseUrl, { transports: ["websocket"], forceNew: true });
  clients.push(client);
  await new Promise<void>((resolve, reject) => {
    client.once("connect", resolve);
    client.once("connect_error", reject);
  });
  return client;
}

function collect<T>(client: Client, event: keyof ServerToClientEvents): T[] {
  const received: T[] = [];
  client.on(event, ((payload: T) => received.push(payload)) as never);
  return received;
}

async function until(condition: () => boolean, label: string): Promise<void> {
  const deadline = Date.now() + 2000;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

function join(client: Client, guardId: string): Promise<JoinReply> {
  return new Promise((resolve) => client.emit("guard:join", { guardId }, resolve));
}

function ack(client: Client, alertId: string, guardId: string): Promise<ActionReply> {
  return new Promise((resolve) => client.emit("guard:ack", { alertId, guardId }, resolve));
}

function resolveAlert(
  client: Client,
  alertId: string,
  outcome: "resolved" | "false_alarm",
): Promise<ActionReply> {
  return new Promise((resolve) => client.emit("alert:resolve", { alertId, outcome }, resolve));
}

function postAlert(body: unknown): Promise<Response> {
  return fetch(`${baseUrl}/api/alerts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function raiseAlert(cameraId = "cam-4"): Promise<Alert> {
  const response = await postAlert({ cameraId, snapshot: SNAPSHOT });
  return ((await response.json()) as CreateAlertResponse).alert;
}

async function getState(): Promise<AppState> {
  return (await (await fetch(`${baseUrl}/api/state`)).json()) as AppState;
}

describe("GET /api/state", () => {
  it("returns the campus, cameras, guards and settings", async () => {
    const state = await getState();
    expect(state.campus.name).toBe("Demo campus");
    expect(state.cameras).toHaveLength(6);
    expect(state.guards).toHaveLength(3);
    expect(state.alerts).toEqual([]);
    expect(state.guardsOnShift).toEqual([]);
    expect(state.config).toEqual({ demoMode: true, ringMs: RING_MS, cameraCooldownMs: 5000 });
    expect(state.serverTime).toBe(clock.now());
  });
});

describe("GET /api/health", () => {
  it("reports that the server is up", async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true });
  });
});

describe("POST /api/alerts", () => {
  it("creates an alert and starts ringing the nearest guard", async () => {
    const response = await postAlert({ cameraId: "cam-4", snapshot: SNAPSHOT });
    expect(response.status).toBe(201);
    const { alert, duplicate } = (await response.json()) as CreateAlertResponse;
    expect(duplicate).toBe(false);
    expect(alert).toMatchObject({
      number: 1,
      cameraLabel: "Parking, camera 4",
      source: "camera",
      status: "ringing",
      createdAt: clock.now(),
    });
    expect(alert.attempts.map((attempt) => attempt.guardName)).toEqual(["Anil Yadav"]);
    expect((await getState()).alerts.map((item) => item.id)).toEqual([alert.id]);
  });

  it("serves the snapshot as a JPEG and keeps it out of the alert", async () => {
    const alert = await raiseAlert();
    expect(JSON.stringify(alert)).not.toContain("base64");
    const response = await fetch(`${baseUrl}${alert.snapshotUrl}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
  });

  it("accepts an alert without a snapshot and marks simulated ones", async () => {
    const response = await postAlert({ cameraId: "cam-2", simulated: true });
    expect(response.status).toBe(201);
    const { alert } = (await response.json()) as CreateAlertResponse;
    expect(alert.snapshotUrl).toBeNull();
    expect(alert.source).toBe("simulated");
  });

  it("does not create a second alert from the same camera during its cooldown", async () => {
    const first = await raiseAlert();
    clock.advance(2000);
    const response = await postAlert({ cameraId: "cam-4", snapshot: SNAPSHOT });
    expect(response.status).toBe(200);
    const body = (await response.json()) as CreateAlertResponse;
    expect(body.duplicate).toBe(true);
    expect(body.alert.id).toBe(first.id);
    expect((await getState()).alerts).toHaveLength(1);
  });

  it("creates a new alert from the same camera after the cooldown", async () => {
    await raiseAlert();
    clock.advance(5001);
    const response = await postAlert({ cameraId: "cam-4", snapshot: SNAPSHOT });
    expect(response.status).toBe(201);
    expect((await getState()).alerts.map((alert) => alert.number)).toEqual([2, 1]);
  });

  it("creates alerts from different cameras at the same time", async () => {
    await raiseAlert("cam-4");
    const response = await postAlert({ cameraId: "cam-3", snapshot: SNAPSHOT });
    expect(response.status).toBe(201);
  });

  it("rejects an unknown camera", async () => {
    const response = await postAlert({ cameraId: "cam-99", snapshot: SNAPSHOT });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Unknown camera." });
  });

  it("rejects a snapshot that is not a JPEG data URL", async () => {
    const response = await postAlert({ cameraId: "cam-4", snapshot: "data:image/png;base64,AAAA" });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "The snapshot must be a JPEG data URL." });
  });

  it("rejects a snapshot that is too large", async () => {
    const huge = SNAPSHOT + "A".repeat(1_600_000);
    const response = await postAlert({ cameraId: "cam-4", snapshot: huge });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "The snapshot is too large." });
  });

  it("rejects a body that is not JSON", async () => {
    const response = await postAlert("{not json");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "The request body is not valid JSON." });
  });
});

describe("other API routes", () => {
  it("answers 404 for a snapshot that does not exist", async () => {
    const response = await fetch(`${baseUrl}/api/alerts/nope/snapshot`);
    expect(response.status).toBe(404);
  });

  it("answers 404 as JSON for an unknown route", async () => {
    const response = await fetch(`${baseUrl}/api/unknown`);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found." });
  });
});

describe("guard shifts", () => {
  it("lets a guard start a shift and tells every screen who is on shift", async () => {
    const dashboard = await openSocket();
    const presence = collect<string[]>(dashboard, "guard:presence");
    const phone = await openSocket();

    const reply = await join(phone, "guard-1");
    expect(reply).toMatchObject({ ok: true, guard: { name: "Ramesh Kumar" }, ring: null });
    await until(() => presence.at(-1)?.includes("guard-1") === true, "presence");
    expect((await getState()).guardsOnShift).toEqual(["guard-1"]);
  });

  it("takes a guard off shift when their phone disconnects", async () => {
    const dashboard = await openSocket();
    const presence = collect<string[]>(dashboard, "guard:presence");
    const phone = await openSocket();
    await join(phone, "guard-1");
    await until(() => presence.at(-1)?.length === 1, "guard on shift");

    phone.disconnect();
    await until(() => presence.at(-1)?.length === 0, "guard off shift");
  });

  it("keeps a guard on shift while one of their two devices is still connected", async () => {
    const first = await openSocket();
    const second = await openSocket();
    await join(first, "guard-1");
    await join(second, "guard-1");

    first.disconnect();
    await until(() => server.io.engine.clientsCount === 1, "first device to disconnect");
    expect((await getState()).guardsOnShift).toEqual(["guard-1"]);
  });

  it("moves the shift when the same phone picks a different guard", async () => {
    const phone = await openSocket();
    await join(phone, "guard-1");
    await join(phone, "guard-2");
    expect((await getState()).guardsOnShift).toEqual(["guard-2"]);
  });

  it("rejects a guard who is not on the list", async () => {
    const phone = await openSocket();
    expect(await join(phone, "guard-99")).toEqual({
      ok: false,
      error: "This guard is not on the list.",
    });
  });
});

describe("the full flow", () => {
  it("goes from signal to ringing to responding to resolved", async () => {
    const dashboard = await openSocket();
    const created = collect<Alert>(dashboard, "alert:new");
    const updates = collect<Alert>(dashboard, "alert:update");
    const anilPhone = await openSocket();
    const rameshPhone = await openSocket();
    const anilRings = collect<GuardRing>(anilPhone, "guard:ring");
    const rameshRings = collect<GuardRing>(rameshPhone, "guard:ring");
    await join(anilPhone, "guard-3");
    await join(rameshPhone, "guard-1");

    const alert = await raiseAlert("cam-4");
    await until(() => created.length === 1 && anilRings.length === 1, "first ring");
    expect(created[0]).toMatchObject({ id: alert.id, status: "new" });
    expect(anilRings[0]).toMatchObject({
      alertId: alert.id,
      cameraLabel: "Parking, camera 4",
      endsAt: clock.now() + RING_MS,
    });
    expect(rameshRings).toEqual([]);

    clock.advance(RING_MS);
    await until(() => rameshRings.length === 1, "second ring");
    expect(anilRings).toHaveLength(1);

    clock.advance(3000);
    const reply = await ack(rameshPhone, alert.id, "guard-1");
    expect(reply.ok).toBe(true);
    await until(() => updates.at(-1)?.status === "responding", "responding update");
    expect(updates.at(-1)).toMatchObject({
      responderName: "Ramesh Kumar",
      respondedAt: clock.now(),
    });
    expect(updates.at(-1)?.attempts.map((attempt) => attempt.outcome)).toEqual([
      "no_answer",
      "confirmed",
    ]);

    clock.advance(RING_MS * 4);
    expect(anilRings).toHaveLength(1);
    expect(rameshRings).toHaveLength(1);

    const closed = await resolveAlert(dashboard, alert.id, "resolved");
    expect(closed.ok).toBe(true);
    await until(() => updates.at(-1)?.status === "resolved", "resolved update");
    expect((await getState()).alerts[0]).toMatchObject({
      status: "resolved",
      responderName: "Ramesh Kumar",
      closedAt: clock.now(),
    });
  });

  it("tells a second guard that someone is already on the way", async () => {
    const anilPhone = await openSocket();
    const rameshPhone = await openSocket();
    await join(anilPhone, "guard-3");
    await join(rameshPhone, "guard-1");
    const alert = await raiseAlert();

    expect((await ack(anilPhone, alert.id, "guard-3")).ok).toBe(true);
    expect(await ack(rameshPhone, alert.id, "guard-1")).toEqual({
      ok: false,
      error: "Anil Yadav is already on the way.",
    });
  });

  it("hands the current ring to a guard who opens the app mid-ring", async () => {
    const alert = await raiseAlert();
    const phone = await openSocket();
    const reply = await join(phone, "guard-3");
    expect(reply).toMatchObject({ ok: true, ring: { alertId: alert.id } });
  });

  it("records that a guard without the app open could not be reached", async () => {
    const phone = await openSocket();
    await join(phone, "guard-1");
    const alert = await raiseAlert();
    clock.advance(RING_MS);
    const attempts = (await getState()).alerts[0]?.attempts ?? [];
    expect(alert.attempts[0]?.reached).toBe(false);
    expect(attempts.map((attempt) => attempt.reached)).toEqual([false, true]);
  });

  it("marks an alert as a false alarm from the dashboard", async () => {
    const dashboard = await openSocket();
    const alert = await raiseAlert();
    const reply = await resolveAlert(dashboard, alert.id, "false_alarm");
    expect(reply).toMatchObject({ ok: true, alert: { status: "false_alarm" } });
    expect(clock.pending()).toBe(0);
  });

  it("rejects an outcome it does not know", async () => {
    const dashboard = await openSocket();
    const alert = await raiseAlert();
    const reply = await resolveAlert(dashboard, alert.id, "deleted" as "resolved");
    expect(reply).toEqual({ ok: false, error: "Choose resolved or false alarm." });
  });

  it("answers plainly when the alert does not exist", async () => {
    const dashboard = await openSocket();
    expect(await resolveAlert(dashboard, "nope", "resolved")).toEqual({
      ok: false,
      error: "This alert no longer exists.",
    });
  });
});
