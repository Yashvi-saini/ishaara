import { createServer, type Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { createApp } from "./app.js";
import type { AppConfig } from "./config.js";
import { createApiRouter } from "./routes/api.js";
import { createTwilioRouter } from "./routes/twilio.js";
import { loadSeed } from "./seed/index.js";
import { systemClock, type Clock } from "./services/clock.js";
import {
  createEscalationEngine,
  type EscalationEngine,
  type RingChannel,
} from "./services/escalation.js";
import { createTwilioChannel, type TwilioChannel } from "./services/twilio.js";
import {
  createGuardAppChannel,
  createPresence,
  registerSocketHandlers,
  type IshaaraIo,
} from "./sockets/index.js";
import { createStore, type Store } from "./store/store.js";

export interface IshaaraServer {
  httpServer: HttpServer;
  io: IshaaraIo;
  store: Store;
  engine: EscalationEngine;
  phone: TwilioChannel | null;
  close(): Promise<void>;
}

export function createIshaaraServer(
  config: AppConfig,
  options: { clock?: Clock; fetch?: typeof fetch } = {},
): IshaaraServer {
  const clock = options.clock ?? systemClock;
  const store = createStore(loadSeed(config.campusName), { maxAlerts: config.maxAlerts });

  const io: IshaaraIo = new Server();
  const presence = createPresence();
  const cameraPresence = createPresence();
  const phone =
    config.phoneCalls && config.twilio
      ? createTwilioChannel({
          config: config.twilio,
          guardPhones: config.guardPhones,
          ringMs: config.ringMs,
          fetch: options.fetch,
        })
      : null;
  const channels: RingChannel[] = [createGuardAppChannel(io, presence)];
  if (phone) channels.push(phone);

  const engine = createEscalationEngine({
    store,
    clock,
    ringMs: config.ringMs,
    channels,
    onAlertChange: (alert) => io.emit("alert:update", alert),
  });

  const api = createApiRouter({
    config,
    store,
    engine,
    clock,
    presence,
    cameraPresence,
    onAlertCreated: (alert) => io.emit("alert:new", alert),
    twilioRouter:
      phone && config.twilio
        ? createTwilioRouter({ config: config.twilio, engine, store })
        : undefined,
  });
  const httpServer = createServer(createApp(api));
  io.attach(httpServer);
  registerSocketHandlers(io, { store, engine, presence, cameraPresence });

  return {
    httpServer,
    io,
    store,
    engine,
    phone,
    async close() {
      engine.shutdown();
      await io.close();
    },
  };
}
