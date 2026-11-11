import { describe, expect, it } from "vitest";
import { loadSeed } from "../seed/index.js";
import type { Camera } from "../types.js";
import { createStore, isOpen } from "./store.js";

const SNAPSHOT = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";

function setup(maxAlerts = 50) {
  const store = createStore(loadSeed(), { maxAlerts });
  const camera = store.getCamera("cam-4") as Camera;
  let time = 1000;
  const add = (snapshot: string | null = SNAPSHOT) =>
    store.addAlert({ camera, snapshot, source: "camera", createdAt: (time += 1000) });
  return { store, camera, add };
}

describe("store", () => {
  it("looks up cameras and guards by id", () => {
    const { store } = setup();
    expect(store.getCamera("cam-1")?.name).toBe("Main gate");
    expect(store.getGuard("guard-1")?.name).toBe("Ramesh Kumar");
    expect(store.getCamera("nope")).toBeUndefined();
    expect(store.getGuard("nope")).toBeUndefined();
  });

  it("creates a new alert with the camera's label and zone", () => {
    const { add } = setup();
    const alert = add();
    expect(alert).toMatchObject({
      number: 1,
      cameraId: "cam-4",
      cameraLabel: "Parking, camera 4",
      zone: "Gate and parking",
      source: "camera",
      status: "new",
      attempts: [],
      responderId: null,
      closedAt: null,
    });
  });

  it("numbers alerts from 1 and lists the newest first", () => {
    const { store, add } = setup();
    add();
    add();
    add();
    expect(store.listAlerts().map((alert) => alert.number)).toEqual([3, 2, 1]);
  });

  it("keeps the snapshot apart from the alert and links to it", () => {
    const { store, add } = setup();
    const alert = add();
    expect(alert.snapshotUrl).toBe(`/api/alerts/${alert.id}/snapshot`);
    expect(store.getSnapshot(alert.id)).toBe(SNAPSHOT);
    expect(JSON.stringify(alert)).not.toContain("base64");
  });

  it("allows an alert without a snapshot", () => {
    const { store, add } = setup();
    const alert = add(null);
    expect(alert.snapshotUrl).toBeNull();
    expect(store.getSnapshot(alert.id)).toBeUndefined();
  });

  it("updates an alert", () => {
    const { store, add } = setup();
    const alert = add();
    const updated = store.updateAlert(alert.id, (current) => ({ ...current, status: "ringing" }));
    expect(updated?.status).toBe("ringing");
    expect(store.getAlert(alert.id)?.status).toBe("ringing");
  });

  it("returns undefined when updating an alert that does not exist", () => {
    const { store } = setup();
    expect(store.updateAlert("nope", (alert) => alert)).toBeUndefined();
  });

  it("keeps only the most recent alerts and drops their snapshots", () => {
    const { store, add } = setup(50);
    const first = add();
    store.updateAlert(first.id, (alert) => ({ ...alert, status: "resolved" }));
    for (let count = 0; count < 50; count += 1) {
      const alert = add();
      store.updateAlert(alert.id, (current) => ({ ...current, status: "resolved" }));
    }
    expect(store.listAlerts()).toHaveLength(50);
    expect(store.getAlert(first.id)).toBeUndefined();
    expect(store.getSnapshot(first.id)).toBeUndefined();
    expect(store.listAlerts()[0]?.number).toBe(51);
  });

  it("drops closed alerts before open ones when it is full", () => {
    const { store, add } = setup(3);
    const open = add();
    const closed = add();
    store.updateAlert(closed.id, (alert) => ({ ...alert, status: "false_alarm" }));
    add();
    add();
    expect(store.getAlert(open.id)).toBeDefined();
    expect(store.getAlert(closed.id)).toBeUndefined();
  });

  it("finds an open alert from the same camera within a time window", () => {
    const { store, add } = setup();
    const alert = add();
    expect(store.findOpenAlertFrom("cam-4", alert.createdAt - 1)?.id).toBe(alert.id);
    expect(store.findOpenAlertFrom("cam-4", alert.createdAt + 1)).toBeUndefined();
    expect(store.findOpenAlertFrom("cam-1", 0)).toBeUndefined();

    store.updateAlert(alert.id, (current) => ({ ...current, status: "resolved" }));
    expect(store.findOpenAlertFrom("cam-4", 0)).toBeUndefined();
  });

  it("treats new, ringing and responding alerts as open", () => {
    expect(isOpen({ status: "new" })).toBe(true);
    expect(isOpen({ status: "ringing" })).toBe(true);
    expect(isOpen({ status: "responding" })).toBe(true);
    expect(isOpen({ status: "resolved" })).toBe(false);
    expect(isOpen({ status: "false_alarm" })).toBe(false);
  });
});
