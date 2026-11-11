import type { ActionReply, AlertOutcome, JoinReply } from "@ishaara/server/types";
import { socket } from "./socket";

const TIMEOUT_MS = 6000;
const NO_REPLY = "The server did not answer. Check the connection and try again.";
const OFFLINE = "Not connected to the server. Wait for the connection to return, then try again.";

async function withReply<T>(send: () => Promise<T>): Promise<T | { ok: false; error: string }> {
  if (!socket.connected) return { ok: false, error: OFFLINE };
  try {
    return await send();
  } catch {
    return { ok: false, error: NO_REPLY };
  }
}

export function resolveAlert(alertId: string, outcome: AlertOutcome): Promise<ActionReply> {
  return withReply(() =>
    socket.timeout(TIMEOUT_MS).emitWithAck("alert:resolve", { alertId, outcome }),
  );
}

export function acknowledgeAlert(alertId: string, guardId: string): Promise<ActionReply> {
  return withReply(() => socket.timeout(TIMEOUT_MS).emitWithAck("guard:ack", { alertId, guardId }));
}

export function joinShift(guardId: string): Promise<JoinReply> {
  return withReply(() => socket.timeout(TIMEOUT_MS).emitWithAck("guard:join", { guardId }));
}
