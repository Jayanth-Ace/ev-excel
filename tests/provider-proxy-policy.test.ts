import assert from "node:assert/strict";
import { test } from "node:test";

import { providerRequiresProxy } from "../src/auth/stream-proxy.ts";

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
