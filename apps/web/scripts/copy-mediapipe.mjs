import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const target = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../public/mediapipe/wasm",
);
const files = ["vision_wasm_module_internal.js", "vision_wasm_module_internal.wasm"];

mkdirSync(target, { recursive: true });
for (const file of files) {
  const source = require.resolve(`@mediapipe/tasks-vision/${file}`);
  const destination = path.join(target, file);
  if (existsSync(destination) && statSync(destination).size === statSync(source).size) continue;
  copyFileSync(source, destination);
  console.log(`Copied ${file} to public/mediapipe/wasm`);
}
