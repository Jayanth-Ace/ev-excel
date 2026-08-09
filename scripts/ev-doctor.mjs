#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { validateDevCertificates } from "./certificates.mjs";
import {
  commandPath,
  environmentSummary,
  hasDependencies,
  isSupportedNodeVersion,
  REQUIRED_LOCAL_MODEL,
  requestOllamaModel,
  ensureOllamaServer,
} from "./ev-environment.mjs";
import { inspectDevServer } from "./dev-health.mjs";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const checkOnly = process.argv.includes("--check");
const summary = environmentSummary(repoRoot);
const rows = [];

function row(label, status, detail = "") {
  rows.push({ label, status, detail });
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: repoRoot, stdio: "inherit" });
  return result.status === 0;
}

console.log("EV DOCTOR");
row("Environment", process.platform === "darwin" ? "PASS" : "NOT VERIFIED", summary.platform);
row("Node/npm", isSupportedNodeVersion(process.version) ? "PASS" : "FAIL", `${process.version}; required Node 24.x`);
row("Dependencies", hasDependencies(repoRoot) ? "PASS" : "FAIL");

const manifestPath = path.join(repoRoot, "manifest.xml");
const manifestExists = fs.existsSync(manifestPath);
row("Manifest", manifestExists ? "PASS" : "FAIL", manifestPath);
if (manifestExists) {
  const validation = spawnSync(process.execPath, [path.join(repoRoot, "scripts/validate-manifest.mjs"), "manifest.xml"], { cwd: repoRoot, encoding: "utf8" });
  row("Manifest structure", validation.status === 0 ? "PASS" : "FAIL");
}

const cert = validateDevCertificates(path.join(repoRoot, "cert.pem"), path.join(repoRoot, "key.pem"));
row("HTTPS certificate", cert.valid ? "PASS" : "FAIL", cert.reason);

const serverInspection = await inspectDevServer(repoRoot).catch((error) => ({ error: error instanceof Error ? error.message : String(error) }));
if ("error" in serverInspection) {
  row("HTTPS server", "NOT VERIFIED", serverInspection.error);
  row("Taskpane URL", "NOT VERIFIED", "Start with npm run ev:dev or allow ev:doctor to launch it.");
} else {
  row("HTTPS server", serverInspection.taskpane.ok ? "PASS" : "FAIL", "https://localhost:3141");
  row("Taskpane URL", serverInspection.taskpane.ok && serverInspection.sourceMatches ? "PASS" : "FAIL", serverInspection.taskpaneUrl);
  row("Taskpane module", serverInspection.script.ok ? "PASS" : "FAIL");
  row("Required assets", serverInspection.assets.every((asset) => asset.ok) ? "PASS" : "FAIL");
}

const ollama = commandPath("ollama");
if (!ollama) {
  row("Ollama", "NOT INSTALLED", "Optional local provider; remote providers remain available.");
} else {
  const local = await ensureOllamaServer({ executable: ollama });
  if (!local.reachable) {
    row("Ollama", "UNAVAILABLE", "Installed but server is not reachable.");
  } else if (!local.models.includes(REQUIRED_LOCAL_MODEL)) {
    row("Ollama", "PASS", `Server reachable; ${REQUIRED_LOCAL_MODEL} is not installed.`);
  } else {
    const request = await requestOllamaModel(REQUIRED_LOCAL_MODEL);
    row("Ollama", request.ok ? "PASS" : "FAIL", request.ok ? `${REQUIRED_LOCAL_MODEL} responds without visible reasoning protocol.` : request.error);
  }
}

row("Google", "NOT AUTOMATICALLY VERIFIABLE", "Provider credentials and model discovery are browser/session-scoped.");
row("OpenAI/ChatGPT", "NOT AUTOMATICALLY VERIFIABLE", "Provider credentials and model discovery are browser/session-scoped.");
row("Anthropic", "NOT AUTOMATICALLY VERIFIABLE", "Provider credentials and model discovery are browser/session-scoped.");
row("Web search", "OPTIONAL", "Requires explicit integration enablement and a configured provider key.");
row("Nyx", "NOT VERIFIED", "Automated state-machine tests exist; real Excel planning/mutation/verification requires an actual taskpane run.");
row("Security", "PASS", "Local health checks remain loopback HTTPS-only; existing security tests are unchanged.");

for (const item of rows) {
  console.log(`${item.status.padEnd(24)} ${item.label}${item.detail ? ` — ${item.detail}` : ""}`);
}

const staticFailures = rows.filter((item) => item.status === "FAIL");
const tests = staticFailures.length === 0 && run("npm", ["test"]);
const checks = staticFailures.length === 0 && run("npm", ["run", "check"]);
const build = staticFailures.length === 0 && run("npm", ["run", "build"]);
console.log(`${tests ? "PASS" : "FAIL"}${" ".repeat(20)} Tests`);
console.log(`${checks ? "PASS" : "FAIL"}${" ".repeat(20)} Check`);
console.log(`${build ? "PASS" : "FAIL"}${" ".repeat(20)} Build`);

console.log("\nFINAL STATUS:");
if (staticFailures.length > 0 || !tests || !checks || !build) {
  console.log("BLOCKED");
  const failure = staticFailures[0] ?? { label: !tests ? "Tests" : !checks ? "Check" : "Build", detail: "The validation command failed." };
  console.log(`BLOCKING ISSUE: ${failure.label} — ${failure.detail}`);
  console.log("NEXT ACTION: Resolve the reported prerequisite and run npm run ev:doctor again.");
  process.exitCode = 1;
} else if (checkOnly) {
  console.log("READY FOR DEVELOPMENT CHECKS");
  console.log("NEXT ACTION: Run npm run ev:doctor to launch Excel, or npm run ev:dev for Vite only.");
} else {
  console.log("READY FOR DEVELOPMENT");
  console.log("NEXT ACTION: Excel task-pane loading remains NOT AUTOMATICALLY VERIFIABLE without a connected Office bridge.");
  const child = spawn(process.execPath, [path.join(repoRoot, "scripts/sideload.mjs")], { cwd: repoRoot, stdio: "inherit" });
  child.once("exit", (code) => {
    if (typeof code === "number" && code !== 0) process.exitCode = code;
  });
}
