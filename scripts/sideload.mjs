#!/usr/bin/env node

import path from "node:path";
import { spawn } from "node:child_process";
import { checkPort, isSupportedNodeVersion, nodeRemediation } from "./ev-environment.mjs";
import { validateDevCertificates } from "./certificates.mjs";
import { inspectDevServer, waitForLocalHttps } from "./dev-health.mjs";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
if (!isSupportedNodeVersion(process.version)) {
  console.error(nodeRemediation(process.version));
  process.exit(1);
}
const certificateValidation = validateDevCertificates(path.join(repoRoot, "cert.pem"), path.join(repoRoot, "key.pem"));
if (!certificateValidation.valid) {
  console.error(`EV HTTPS development certificate is invalid: ${certificateValidation.reason}`);
  process.exit(1);
}
const serverAlreadyRunning = await checkPort(3141);
const vite = serverAlreadyRunning ? undefined : spawn(process.execPath, [path.join(repoRoot, "node_modules/vite/bin/vite.js"), "--port", "3141"], {
  cwd: repoRoot,
  stdio: "inherit",
});

let keepAlive;
const cleanup = () => {
  if (keepAlive) clearInterval(keepAlive);
  if (vite && !vite.killed) vite.kill("SIGTERM");
};
process.once("SIGINT", () => { cleanup(); process.exitCode = 0; });
process.once("SIGTERM", () => { cleanup(); process.exitCode = 0; });
process.once("SIGINT", cleanup);
process.once("SIGTERM", cleanup);

const health = await waitForLocalHttps("https://localhost:3141/src/taskpane.html");
if (!health.ok) {
  cleanup();
  console.error(`EV development server is not reachable over HTTPS: ${health.error ?? `HTTP ${health.statusCode}`}`);
  process.exit(1);
}

const inspection = await inspectDevServer(repoRoot);
if (!inspection.sourceMatches || !inspection.script.ok || inspection.assets.some((asset) => !asset.ok)) {
  cleanup();
  console.error("EV taskpane health check failed: manifest, taskpane module, or required icon assets are not aligned with the running server.");
  process.exit(1);
}

console.log("✓ EV development server ready on https://localhost:3141");
console.log("✓ EV taskpane, module, assets, and manifest SourceLocation verified");
console.log("→ Starting the supported Office add-in debugging session.");
const debugging = spawn("npx", ["office-addin-debugging", "start", "manifest.xml", "desktop", "--app", "excel"], {
  cwd: repoRoot,
  stdio: "inherit",
  shell: process.platform === "win32",
});
debugging.once("error", (error) => {
  cleanup();
  console.error(`Office add-in debugging could not be started: ${error.message}`);
  process.exitCode = 1;
});
debugging.once("exit", (code, signal) => {
  if (typeof code === "number" && code !== 0) {
    cleanup();
    process.exitCode = code;
    return;
  }
  console.log("✓ Excel launch/sideload request completed; keeping Vite alive for the task pane.");
  keepAlive = setInterval(() => {}, 60_000);
});
