#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

export const REQUIRED_LOCAL_MODEL = "qwen3:4b";
export const OLLAMA_BASE_URL = "http://127.0.0.1:11434";
export const OLLAMA_STATE = Object.freeze({
  NOT_INSTALLED: "OLLAMA_NOT_INSTALLED",
  SERVER_STOPPED: "OLLAMA_SERVER_STOPPED",
  SERVER_READY: "OLLAMA_SERVER_READY",
  NO_MODELS: "OLLAMA_NO_MODELS",
  MODEL_AVAILABLE: "OLLAMA_MODEL_AVAILABLE",
  MODEL_UNAVAILABLE: "OLLAMA_MODEL_UNAVAILABLE",
  REQUEST_FAILED: "OLLAMA_REQUEST_FAILED",
});

const DEFAULT_TIMEOUT_MS = 2_000;
const DEFAULT_START_TIMEOUT_MS = 15_000;
const DEFAULT_POLL_MS = 250;

export function parseNodeVersion(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

export function isSupportedNodeVersion(version) {
  const parsed = typeof version === "string" ? parseNodeVersion(version) : version;
  return parsed !== null && parsed.major === 24;
}

export function nodeRemediation(version) {
  return [
    `EV requires Node 24.x; detected ${version}.`,
    "Use a project-local version manager instead of repairing the system Node installation:",
    "  nvm install 24.18.0 && nvm use 24.18.0",
    "Then run npm install and npm run setup again.",
  ].join("\n");
}

export function commandPath(command, runner = spawnSync) {
  const result = runner("which", [command], { encoding: "utf8" });
  if (result.status !== 0) return undefined;
  const resolved = result.stdout.trim();
  return resolved.length > 0 ? resolved : undefined;
}

export function parseOllamaModels(payload) {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) return [];
  const models = payload.models;
  if (!Array.isArray(models)) return [];
  return Array.from(new Set(models
    .filter((entry) => entry !== null && typeof entry === "object" && !Array.isArray(entry))
    .map((entry) => typeof entry.name === "string" ? entry.name.trim() : "")
    .filter((name) => name.length > 0)));
}

export function classifyOllamaState({ installed, serverReachable, models, requiredModel, requestOk }) {
  if (!installed) return OLLAMA_STATE.NOT_INSTALLED;
  if (!serverReachable) return OLLAMA_STATE.SERVER_STOPPED;
  if (requestOk === false) return OLLAMA_STATE.REQUEST_FAILED;
  if (models.length === 0) return OLLAMA_STATE.NO_MODELS;
  if (!models.includes(requiredModel)) return OLLAMA_STATE.MODEL_UNAVAILABLE;
  return OLLAMA_STATE.MODEL_AVAILABLE;
}

export function classifyOllamaServerState({ installed, serverReachable }) {
  if (!installed) return OLLAMA_STATE.NOT_INSTALLED;
  return serverReachable ? OLLAMA_STATE.SERVER_READY : OLLAMA_STATE.SERVER_STOPPED;
}

async function fetchWithTimeout(url, init = {}, fetchFn = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchFn(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function readJson(url, options = {}) {
  const response = await fetchWithTimeout(url, {}, options.fetchFn, options.timeoutMs);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function inspectOllama({ fetchFn = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  let tags;
  try {
    tags = await readJson(`${OLLAMA_BASE_URL}/api/tags`, { fetchFn, timeoutMs });
  } catch {
    return { reachable: false, models: [] };
  }
  return { reachable: true, models: parseOllamaModels(tags) };
}

export async function requestOllamaModel(model, { fetchFn = globalThis.fetch, timeoutMs = 30_000 } = {}) {
  try {
    const response = await fetchWithTimeout(
      `${OLLAMA_BASE_URL}/v1/chat/completions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "Reply with OK." }],
          max_tokens: 512,
          stream: false,
          reasoning_effort: "none",
        }),
      },
      fetchFn,
      timeoutMs,
    );
    if (!response.ok) return { ok: false, error: `HTTP ${response.status}` };
    const payload = await response.json();
    const choices = payload !== null && typeof payload === "object" && Array.isArray(payload.choices)
      ? payload.choices
      : [];
    const first = choices[0];
    const message = first !== null && typeof first === "object" ? first.message : undefined;
    const content = message !== null && typeof message === "object" && typeof message.content === "string"
      ? message.content
        .replace(/<think>[\s\S]*?(?:<\/think>|$)/giu, "")
        .replace(/^[\s\S]*?<\/think>/iu, "")
        .trim()
      : "";
    const reasoning = message !== null && typeof message === "object" && typeof message.reasoning === "string"
      ? message.reasoning.trim()
      : "";
    if (content.length > 0) return { ok: true, content, responseKind: "content" };
    if (reasoning.length > 0) return { ok: false, error: "Ollama returned reasoning without an ordinary answer." };
    return { ok: false, error: "Ollama returned no response text." };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function isOllamaProcessRunning(runner = spawnSync) {
  const result = runner("pgrep", ["-alf", "ollama"], { encoding: "utf8" });
  if (result.status !== 0) return false;
  return result.stdout.split("\n").some((line) => /\bollama(?:\s|$)/i.test(line) && !line.includes("pgrep"));
}

export async function waitForOllama({ fetchFn = globalThis.fetch, timeoutMs = DEFAULT_START_TIMEOUT_MS, pollMs = DEFAULT_POLL_MS } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await inspectOllama({ fetchFn, timeoutMs: Math.min(DEFAULT_TIMEOUT_MS, Math.max(100, deadline - Date.now())) });
    if (status.reachable) return status;
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  return inspectOllama({ fetchFn, timeoutMs: DEFAULT_TIMEOUT_MS });
}

export async function ensureOllamaServer({
  platform = process.platform,
  executable = commandPath("ollama"),
  processRunning = isOllamaProcessRunning(),
  start = (file) => {
    const child = spawn(file, ["serve"], { detached: true, stdio: "ignore" });
    child.unref();
  },
  openApplication = () => {
    spawn("open", ["-a", "Ollama"], { detached: true, stdio: "ignore" }).unref();
  },
  fetchFn = globalThis.fetch,
  timeoutMs = DEFAULT_START_TIMEOUT_MS,
} = {}) {
  const current = await inspectOllama({ fetchFn });
  if (current.reachable) return { ...current, started: false, processRunning: true };
  if (!executable) return { reachable: false, models: [], started: false, processRunning: false };
  if (processRunning) {
    const recovered = await waitForOllama({ fetchFn, timeoutMs });
    return { ...recovered, started: false, processRunning: true };
  }
  if (platform !== "darwin") return { reachable: false, models: [], started: false, processRunning: false };

  try {
    start(executable);
  } catch {
    try {
      openApplication();
    } catch {
      return { reachable: false, models: [], started: false, processRunning: false };
    }
  }
  const started = await waitForOllama({ fetchFn, timeoutMs });
  return { ...started, started: started.reachable, processRunning: started.reachable };
}

export function hasDependencies(repoRoot) {
  return fs.existsSync(path.join(repoRoot, "node_modules", ".package-lock.json"))
    || fs.existsSync(path.join(repoRoot, "node_modules", "vite"));
}

export function checkPort(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    import("node:net").then(({ createConnection }) => {
      const socket = createConnection({ host, port });
      const finish = (open) => { socket.destroy(); resolve(open); };
      socket.once("connect", () => finish(true));
      socket.once("error", () => finish(false));
      socket.setTimeout(500, () => finish(false));
    });
  });
}

export function excelInstalled() {
  return process.platform === "darwin" && fs.existsSync("/Applications/Microsoft Excel.app");
}

export function dependencyInstallCommand() {
  return process.platform === "win32" ? "npm install" : "npm install";
}

export function printStatus(title, rows) {
  console.log(`\n${title}\n`);
  for (const row of rows) {
    const mark = row.ok ? "✓" : row.warn ? "!" : "✗";
    console.log(`${mark} ${row.label}${row.detail ? ` — ${row.detail}` : ""}`);
  }
}

export function environmentSummary(repoRoot) {
  return {
    platform: `${process.platform} ${os.release()}`,
    node: process.version,
    npm: process.env.npm_config_user_agent?.split(" ")[0] ?? "npm unavailable",
    dependencies: hasDependencies(repoRoot),
    manifest: fs.existsSync(path.join(repoRoot, "manifest.xml")),
    excel: excelInstalled(),
  };
}
