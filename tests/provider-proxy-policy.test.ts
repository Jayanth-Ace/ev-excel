import assert from "node:assert/strict";
import { test } from "node:test";

import { providerRequiresProxy, stripOllamaThinkingText } from "../src/auth/stream-proxy.ts";
import { disableOllamaThinking } from "../src/models/local-providers.ts";

void test("local Ollama does not require the EV proxy", () => {
  assert.equal(providerRequiresProxy("ollama", undefined, () => false), false);
});

void test("runtime-owned remote providers retain proxy requirements", () => {
  assert.equal(providerRequiresProxy("custom-gateway", undefined, () => true), true);
  assert.equal(providerRequiresProxy("google-gemini-cli"), true);
});

void test("direct API-key Anthropic requests do not require the proxy", () => {
  assert.equal(providerRequiresProxy("anthropic", "sk-ant-api-test"), false);
  assert.equal(providerRequiresProxy("anthropic", "sk-ant-oat-test"), true);
});

void test("Ollama disables Qwen private reasoning without removing tools", () => {
  const payload = disableOllamaThinking({
    model: "qwen3:4b",
    messages: [{ role: "user", content: "hello" }],
    tools: [{ type: "function", function: { name: "read_range" } }],
  });

  assert.deepEqual(payload["chat_template_kwargs"], { enable_thinking: false });
  assert.deepEqual(payload["tools"], [{ type: "function", function: { name: "read_range" } }]);
  assert.deepEqual(payload["messages"], [{ role: "user", content: "hello" }]);
});

void test("Ollama protocol reasoning is never treated as visible answer text", () => {
  assert.equal(stripOllamaThinkingText("<think>private instructions</think>Visible answer"), "Visible answer");
  assert.equal(stripOllamaThinkingText("<think>private instructions"), "");
});
