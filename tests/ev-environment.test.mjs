import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyOllamaState,
  classifyOllamaServerState,
  ensureOllamaServer,
  isSupportedNodeVersion,
  nodeRemediation,
  parseNodeVersion,
  parseOllamaModels,
} from "../scripts/ev-environment.mjs";

test("accepts Node 24 and rejects the known unsupported Node 26 development runtime", () => {
  assert.deepEqual(parseNodeVersion("v24.18.0"), { major: 24, minor: 18, patch: 0 });
  assert.equal(isSupportedNodeVersion("v24.18.0"), true);
  assert.equal(isSupportedNodeVersion("v26.7.0"), false);
  assert.match(nodeRemediation("v26.7.0"), /nvm install 24\.18\.0/);
});

test("parses and de-duplicates native Ollama model discovery", () => {
  assert.deepEqual(parseOllamaModels({ models: [{ name: "qwen3:4b" }, { name: "qwen3:4b" }, { name: "" }, {}] }), ["qwen3:4b"]);
  assert.deepEqual(parseOllamaModels({ data: [{ id: "not-ollama" }] }), []);
});

test("classifies all user-actionable Ollama states", () => {
  const base = { requiredModel: "qwen3:4b", requestOk: true };
  assert.equal(classifyOllamaState({ ...base, installed: false, serverReachable: false, models: [] }), "OLLAMA_NOT_INSTALLED");
  assert.equal(classifyOllamaState({ ...base, installed: true, serverReachable: false, models: [] }), "OLLAMA_SERVER_STOPPED");
  assert.equal(classifyOllamaState({ ...base, installed: true, serverReachable: true, models: [] }), "OLLAMA_NO_MODELS");
  assert.equal(classifyOllamaState({ ...base, installed: true, serverReachable: true, models: ["llama3.2"] }), "OLLAMA_MODEL_UNAVAILABLE");
  assert.equal(classifyOllamaState({ ...base, installed: true, serverReachable: true, models: ["qwen3:4b"] }), "OLLAMA_MODEL_AVAILABLE");
  assert.equal(classifyOllamaState({ ...base, installed: true, serverReachable: true, models: ["qwen3:4b"], requestOk: false }), "OLLAMA_REQUEST_FAILED");
});

test("distinguishes server readiness from model readiness", () => {
  assert.equal(classifyOllamaServerState({ installed: false, serverReachable: false }), "OLLAMA_NOT_INSTALLED");
  assert.equal(classifyOllamaServerState({ installed: true, serverReachable: false }), "OLLAMA_SERVER_STOPPED");
  assert.equal(classifyOllamaServerState({ installed: true, serverReachable: true }), "OLLAMA_SERVER_READY");
});

test("starts Ollama only after an unavailable endpoint and waits for recovery", async () => {
  let calls = 0;
  let starts = 0;
  const status = await ensureOllamaServer({
    executable: "/opt/homebrew/bin/ollama",
    processRunning: false,
    start: () => { starts += 1; },
    fetchFn: async () => {
      calls += 1;
      if (calls === 1) throw new Error("connection refused");
      return new Response(JSON.stringify({ models: [{ name: "qwen3:4b" }] }), { status: 200 });
    },
    timeoutMs: 500,
    pollMs: 1,
  });
  assert.equal(starts, 1);
  assert.equal(status.reachable, true);
  assert.deepEqual(status.models, ["qwen3:4b"]);
});

test("does not start a duplicate Ollama process when one is already running", async () => {
  let starts = 0;
  const status = await ensureOllamaServer({
    executable: "/opt/homebrew/bin/ollama",
    processRunning: true,
    start: () => { starts += 1; },
    fetchFn: async () => new Response(JSON.stringify({ models: [] }), { status: 200 }),
    timeoutMs: 500,
    pollMs: 1,
  });
  assert.equal(starts, 0);
  assert.equal(status.reachable, true);
});
