import { existsSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

// Local development reads the .env file at the repository root. Hosts such as Render set real variables.
const envFile = path.resolve(import.meta.dirname, "../../../.env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const config = loadConfig();
const server = createServer(createApp(config));

server.listen(config.port, () => {
  const mode = config.demoMode ? "demo mode" : "normal mode";
  console.log(`Ishaara server listening on http://localhost:${config.port} (${mode})`);
});
