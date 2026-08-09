#!/usr/bin/env node

import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  classifyOllamaState,
  commandPath,
  dependencyInstallCommand,
  ensureOllamaServer,
  environmentSummary,
  hasDependencies,
  isSupportedNodeVersion,
  nodeRemediation,
  REQUIRED_LOCAL_MODEL,
  requestOllamaModel,
} from "./ev-environment.mjs";
import { validateDevCertificates } from "./certificates.mjs";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const summary = environmentSummary(repoRoot);
console.log("EV SETUP");

const certificateValidation = validateDevCertificates(
  path.join(repoRoot, "cert.pem"),
  path.join(repoRoot, "key.pem"),
);
if (certificateValidation.valid) {
  console.log("✓ HTTPS development certificate");
} else {
  console.warn(`! HTTPS development certificate: ${certificateValidation.reason}`);
  console.warn("  Generate a trusted local pair with mkcert (or another trusted local certificate tool), then retry npm run setup.");
}

if (process.platform !== "darwin" && process.platform !== "win32") {
  console.log(`! Ollama guidance is unavailable on ${process.platform}; EV can still use remote providers.`);
}

if (!isSupportedNodeVersion(process.version)) {
  console.error(`\n✗ Node version is not supported.\n${nodeRemediation(process.version)}`);
  process.exitCode = 1;
} else {
  console.log(`✓ Node ${process.version}`);
}

const npmCheck = spawnSync("npm", ["--version"], { encoding: "utf8" });
if (npmCheck.status !== 0) {
  console.error("✗ npm is not runnable. Install Node 24.18.0 with nvm, then retry.");
  process.exitCode = 1;
} else {
  console.log(`✓ npm ${npmCheck.stdout.trim()}`);
}

if (!hasDependencies(repoRoot) && process.exitCode !== 1) {
  console.log(`→ ${dependencyInstallCommand()}`);
  const install = spawnSync("npm", ["install"], { cwd: repoRoot, stdio: "inherit" });
  if (install.status !== 0) process.exitCode = 1;
}
if (hasDependencies(repoRoot)) console.log("✓ dependencies installed");

const ollama = commandPath("ollama");
if (!ollama) {
  const installUrl = process.platform === "win32"
    ? "https://ollama.com/download/windows"
    : "https://ollama.com/download";
  console.warn(`\n! Ollama is not installed. EV remains usable with remote providers.`);
  console.warn(`  Optional local setup: install Ollama from ${installUrl}, then run npm run setup again.`);
} else {
  console.log(`✓ Ollama detected (${ollama})`);
  const server = await ensureOllamaServer({ executable: ollama });
  if (!server.reachable) {
    console.warn("! Ollama is installed but not running. Start Ollama and EV will detect it on refresh.");
  } else {
    console.log(`✓ Ollama server running${server.started ? " (started by setup)" : ""}`);
    const request = server.models.includes(REQUIRED_LOCAL_MODEL)
      ? await requestOllamaModel(REQUIRED_LOCAL_MODEL)
      : { ok: false, error: "required model is not installed" };
    const state = classifyOllamaState({
      installed: true,
      serverReachable: true,
      models: server.models,
      requiredModel: REQUIRED_LOCAL_MODEL,
      requestOk: request.ok,
    });
    if (state === "OLLAMA_NO_MODELS") {
      console.warn("! Ollama has no models. Add one explicitly, for example: ollama pull qwen3:4b");
    } else if (!server.models.includes(REQUIRED_LOCAL_MODEL)) {
      console.warn(`! ${REQUIRED_LOCAL_MODEL} is not installed. Add it explicitly with: ollama pull ${REQUIRED_LOCAL_MODEL}`);
    } else if (!request.ok) {
      console.warn(`! ${REQUIRED_LOCAL_MODEL} did not respond: ${request.error}`);
    } else {
      console.log("✓ qwen3:4b detected");
      console.log("✓ EV local provider reachable directly through Ollama (no proxy)");
    }
  }
}

if (process.exitCode === 1) {
  console.error("\nSetup is incomplete. Resolve the marked item(s), then run npm run setup again.");
} else {
  console.log("\n✓ EV setup complete\n\nRun:\n\n  npm run dev");
}
