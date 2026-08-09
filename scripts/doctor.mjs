#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  commandPath,
  ensureOllamaServer,
  environmentSummary,
  excelInstalled,
  hasDependencies,
  isSupportedNodeVersion,
  REQUIRED_LOCAL_MODEL,
  requestOllamaModel,
} from "./ev-environment.mjs";
import { validateDevCertificates } from "./certificates.mjs";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
console.log("EV DOCTOR");
const certificateValidation = validateDevCertificates(
  path.join(repoRoot, "cert.pem"),
  path.join(repoRoot, "key.pem"),
);
const summary = environmentSummary(repoRoot);
const npmCheck = spawnSync("npm", ["--version"], { encoding: "utf8" });
const rows = [
  { label: summary.platform, ok: process.platform === "darwin" },
  { label: `Node ${summary.node}`, ok: isSupportedNodeVersion(process.version), detail: "required: Node 24.x" },
  { label: `npm ${npmCheck.status === 0 ? npmCheck.stdout.trim() : "unavailable"}`, ok: npmCheck.status === 0 },
  { label: "dependencies", ok: hasDependencies(repoRoot) },
  { label: "manifest.xml", ok: fs.existsSync(path.join(repoRoot, "manifest.xml")) },
  { label: "HTTPS development certificate", ok: certificateValidation.valid, warn: !certificateValidation.valid, detail: certificateValidation.reason },
  { label: "Microsoft Excel", ok: excelInstalled(), warn: !excelInstalled(), detail: excelInstalled() ? undefined : "manual Excel validation unavailable" },
];

const ollama = commandPath("ollama");
rows.push({ label: "Ollama installed", ok: ollama !== undefined, detail: ollama });
if (ollama) {
  const server = await ensureOllamaServer({ executable: ollama });
  rows.push({ label: "Ollama server", ok: server.reachable, warn: !server.reachable, detail: server.reachable ? "127.0.0.1:11434" : "optional: start Ollama to use local models" });
  rows.push({ label: `${REQUIRED_LOCAL_MODEL} available`, ok: server.models.includes(REQUIRED_LOCAL_MODEL), warn: !server.models.includes(REQUIRED_LOCAL_MODEL), detail: server.models.length > 0 ? server.models.join(", ") : `optional: ollama pull ${REQUIRED_LOCAL_MODEL}` });
  if (server.models.includes(REQUIRED_LOCAL_MODEL)) {
    const request = await requestOllamaModel(REQUIRED_LOCAL_MODEL);
    rows.push({ label: "EV local provider", ok: request.ok, warn: !request.ok, detail: request.ok ? "direct Ollama request" : request.error });
  }
} else {
  rows.push({ label: "Ollama server", ok: false, warn: true, detail: "not installed; not required for remote providers" });
}

const viteRunning = await (await import("./ev-environment.mjs")).checkPort(3141);
rows.push({ label: "EV development port 3141", ok: viteRunning, warn: !viteRunning, detail: viteRunning ? "running" : "run npm run dev" });
rows.push({ label: "remote proxy", ok: false, warn: true, detail: "not required for Ollama; remote OAuth may require it" });

const failures = rows.filter((row) => !row.ok && !row.warn);
const warnings = rows.filter((row) => row.warn);
(await import("./ev-environment.mjs")).printStatus("", rows);
console.log(`\nFinal: ${failures.length === 0 ? "EV is ready for local development." : "Resolve the failed checks before local development."}${warnings.length > 0 ? ` ${warnings.length} warning(s) remain.` : ""}`);
process.exitCode = failures.length > 0 ? 1 : 0;
