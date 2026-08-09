#!/usr/bin/env node

import path from "node:path";
import { spawn } from "node:child_process";
import {
  checkPort,
  commandPath,
  ensureOllamaServer,
  hasDependencies,
  isSupportedNodeVersion,
  nodeRemediation,
  REQUIRED_LOCAL_MODEL,
} from "./ev-environment.mjs";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
if (!isSupportedNodeVersion(process.version)) {
  console.error(nodeRemediation(process.version));
  process.exit(1);
}
if (!hasDependencies(repoRoot)) {
  console.error("EV dependencies are not installed. Run npm install, then npm run setup.");
  process.exit(1);
}
if (await checkPort(3141)) {
  console.log("✓ EV development server is already running on https://localhost:3141");
  process.exit(0);
}
const ollama = commandPath("ollama");
if (ollama) {
  const status = await ensureOllamaServer({ executable: ollama, timeoutMs: 5_000 });
  if (status.reachable) {
    console.log(`✓ Ollama ready${status.models.includes(REQUIRED_LOCAL_MODEL) ? ` (${REQUIRED_LOCAL_MODEL})` : " (model not installed)"}`);
  } else {
    console.warn("! Ollama is installed but not running. Start Ollama and EV will reconnect automatically.");
  }
} else {
  console.warn("! Ollama is not installed. EV can still run with configured remote providers.");
}

const vite = spawn(process.execPath, [path.join(repoRoot, "node_modules/vite/bin/vite.js"), "--port", "3141"], {
  cwd: repoRoot,
  stdio: "inherit",
});
const stop = () => { if (!vite.killed) vite.kill("SIGTERM"); };
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
vite.once("exit", (code, signal) => {
  process.exitCode = typeof code === "number" ? code : signal ? 1 : 0;
});
