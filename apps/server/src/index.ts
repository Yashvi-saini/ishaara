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
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void server.close().then(() => process.exit(0));
  });
}
