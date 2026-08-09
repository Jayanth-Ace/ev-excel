#!/usr/bin/env node

import path from "node:path";
import { spawn } from "node:child_process";
import { checkPort, isSupportedNodeVersion, nodeRemediation } from "./ev-environment.mjs";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
if (!isSupportedNodeVersion(process.version)) {
  console.error(nodeRemediation(process.version));
  process.exit(1);
}
const serverAlreadyRunning = await checkPort(3141);
const vite = serverAlreadyRunning ? undefined : spawn(process.execPath, [path.join(repoRoot, "node_modules/vite/bin/vite.js"), "--port", "3141"], {
  cwd: repoRoot,
  stdio: "inherit",
});

const cleanup = () => {
  if (vite && !vite.killed) vite.kill("SIGTERM");
};
process.once("SIGINT", cleanup);
process.once("SIGTERM", cleanup);

for (let attempt = 0; attempt < 40 && !(await checkPort(3141)); attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 250));
}
if (!(await checkPort(3141))) {
  cleanup();
  console.error("EV development server did not start on port 3141.");
  process.exit(1);
}

console.log("✓ EV development server ready on https://localhost:3141");
console.log("→ Starting the supported Office add-in debugging session.");
const debugging = spawn("npx", ["office-addin-debugging", "start", "manifest.xml", "desktop", "--app", "excel"], {
  cwd: repoRoot,
  stdio: "inherit",
  shell: process.platform === "win32",
});
debugging.once("exit", (code, signal) => {
  cleanup();
  process.exitCode = typeof code === "number" ? code : signal ? 1 : 0;
});
