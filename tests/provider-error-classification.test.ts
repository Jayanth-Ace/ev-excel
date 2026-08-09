import assert from "node:assert/strict";
import { test } from "node:test";

import { classifyProviderError } from "../src/auth/provider-error-classification.ts";

void test("classifies Google authentication and permission failures separately", () => {
  assert.equal(classifyProviderError("google-gemini-cli", "401 unauthorized"), "authentication");
  assert.equal(classifyProviderError("google-gemini-cli", "403 permission denied for project"), "permission");
});

void test("classifies transient provider failures without implying automatic retries", () => {
  assert.equal(classifyProviderError("ollama", "503 temporarily unavailable"), "transient");
  assert.equal(classifyProviderError("google", "429 rate limit exceeded"), "rate_limit");
});

void test("classifies malformed or unsupported model requests", () => {
  assert.equal(classifyProviderError("google", "unsupported model gemini-test"), "invalid_request");
  assert.equal(classifyProviderError("openai", "invalid request"), "invalid_request");
});
