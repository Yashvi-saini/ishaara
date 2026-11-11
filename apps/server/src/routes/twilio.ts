import express, { Router } from "express";
import type { TwilioConfig } from "../config.js";
import type { EscalationEngine } from "../services/escalation.js";
import { isValidTwilioSignature, twiml } from "../services/twilio.js";
import type { Store } from "../store/store.js";

export interface TwilioRouteDeps {
  config: TwilioConfig;
  engine: EscalationEngine;
  store: Store;
}

function stringParams(body: unknown): Record<string, string> {
  if (typeof body !== "object" || body === null) return {};
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === "string") params[key] = value;
  }
  return params;
}

export function createTwilioRouter({ config, engine, store }: TwilioRouteDeps): Router {
  const router = Router();
  router.use(express.urlencoded({ extended: false, limit: "20kb" }));

  router.post("/gather", (req, res) => {
    const params = stringParams(req.body);
    const url = `${config.publicUrl}${req.originalUrl}`;
    const signature = req.get("X-Twilio-Signature");
    if (!isValidTwilioSignature(config.authToken, url, params, signature)) {
      res.status(403).type("text/plain").send("Invalid signature.");
      return;
    }

    const alertId = typeof req.query.alert === "string" ? req.query.alert : "";
    const guardId = typeof req.query.guard === "string" ? req.query.guard : "";
    res.type("text/xml");

    if (params.Digits !== "1") {
      res.send(twiml("Not confirmed. Goodbye."));
      return;
    }

    const result = engine.acknowledge(alertId, guardId);
    if (result.ok) {
      res.send(
        twiml(
          `Thank you. Security can see you are going to ${result.alert.cameraLabel}.`,
          "Approach calmly and let her lead.",
        ),
      );
      return;
    }
    if (result.reason === "already_claimed") {
      const responder = store.getAlert(alertId)?.responderName ?? "Another guard";
      res.send(twiml(`${responder} is already on the way. Thank you.`));
      return;
    }
    res.send(twiml("This alert has already been closed. Thank you."));
  });

  return router;
}
