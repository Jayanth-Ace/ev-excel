#!/usr/bin/env node

import { commandPath, ensureOllamaServer, REQUIRED_LOCAL_MODEL, requestOllamaModel, checkPort } from "./ev-environment.mjs";
import { spawnSync } from "node:child_process";

console.log("EV OLLAMA INTEGRATION");
const executable = commandPath("ollama");
if (!executable) {
  console.error("✗ Ollama is not installed. Install Ollama, then run npm run test:ollama again.");
  process.exit(1);
}

const server = await ensureOllamaServer({ executable });
if (!server.reachable) {
  console.error("✗ Ollama server is not reachable at http://127.0.0.1:11434.");
  process.exit(1);
}
console.log("✓ Ollama API reachable");
if (!server.models.includes(REQUIRED_LOCAL_MODEL)) {
  console.error(`✗ ${REQUIRED_LOCAL_MODEL} is not installed. Run: ollama pull ${REQUIRED_LOCAL_MODEL}`);
  process.exit(1);
}
console.log(`✓ ${REQUIRED_LOCAL_MODEL} discovered through /api/tags`);
const result = await requestOllamaModel(REQUIRED_LOCAL_MODEL);
if (!result.ok) {
  console.error(`✗ Model request failed: ${result.error}`);
  process.exit(1);
}
if (result.responseKind !== "content" || result.content.length === 0 || /<think>|internal instructions|function protocol/iu.test(result.content)) {
  console.error("✗ Ollama response still contains private reasoning or protocol text.");
  process.exit(1);
}
console.log(`✓ /v1/chat/completions responded with ordinary answer text: ${result.content}`);

if (checkPort(3141)) {
  const tags = spawnSync("curl", ["-ksSf", "https://localhost:3141/ollama-proxy/api/tags"], { encoding: "utf8" });
  if (tags.status !== 0 || !tags.stdout.includes(REQUIRED_LOCAL_MODEL)) {
    console.error("✗ EV local HTTPS relay did not expose the required Ollama model.");
    process.exit(1);
  }
  console.log("✓ EV local HTTPS relay discovered qwen3:4b");

  const stream = spawnSync("curl", [
    "-ksSfN",
    "--max-time",
    "30",
    "https://localhost:3141/ollama-proxy/v1/chat/completions",
    "-H",
    "content-type: application/json",
    "--data",
    JSON.stringify({ model: REQUIRED_LOCAL_MODEL, messages: [{ role: "user", content: "Reply with exactly OK." }], stream: true }),
  ], { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
  if (stream.status !== 0 || !stream.stdout.includes("data:")) {
    console.error("✗ EV local HTTPS relay did not stream an Ollama response.");
    process.exit(1);
  }
  console.log("✓ EV local HTTPS relay streamed an Ollama response");
} else {
  console.log("! EV local HTTPS relay not checked — start the EV dev server on port 3141 to verify WebView transport.");
}

console.log("✓ EV local provider integration passed (keyless, no remote proxy)");
