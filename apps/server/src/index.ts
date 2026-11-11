import { existsSync } from "node:fs";
import path from "node:path";
import { loadConfig } from "./config.js";
import { createIshaaraServer } from "./server.js";

const envFile = path.resolve(import.meta.dirname, "../../../.env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const config = loadConfig();
const server = createIshaaraServer(config);

server.httpServer.listen(config.port, () => {
  const mode = config.demoMode ? "demo mode" : "normal mode";
  console.log(`Ishaara server listening on http://localhost:${config.port} (${mode})`);
  const phones = Object.keys(config.guardPhones).length;
  if (config.phoneCalls) {
    console.log(`Phone calls on: ${phones} guard${phones === 1 ? "" : "s"} with a number.`);
  } else if (config.twilio) {
    console.log("Phone calls off: set GUARD_PHONES to give guards a number.");
  } else {
    console.log("Phone calls off: Twilio settings missing. Guards are rung through the Guard app.");
  }
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void server.close().then(() => process.exit(0));
  });
}
