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

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const summary = environmentSummary(repoRoot);
console.log("EV SETUP");

if (process.platform !== "darwin") {
  console.log(`! macOS-specific Ollama startup is unavailable on ${process.platform}.`);
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
  console.error("\n✗ Ollama is not installed. Install it from https://ollama.com/download/mac and run npm run setup again.");
  process.exitCode = 1;
} else {
  console.log(`✓ Ollama detected (${ollama})`);
  const server = await ensureOllamaServer({ executable: ollama });
  if (!server.reachable) {
    console.error("✗ Ollama is installed but not running. Start Ollama and run setup again.");
    process.exitCode = 1;
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
      console.error("✗ Ollama has no models. Run: ollama pull qwen3:4b");
      process.exitCode = 1;
    } else if (!server.models.includes(REQUIRED_LOCAL_MODEL)) {
      console.error("✗ qwen3:4b is not installed. Run: ollama pull qwen3:4b");
      process.exitCode = 1;
    } else if (!request.ok) {
      console.error(`✗ qwen3:4b did not respond: ${request.error}`);
      process.exitCode = 1;
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
