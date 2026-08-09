import assert from "node:assert/strict";
import { test } from "node:test";
import { readManifestSourceLocation } from "../scripts/dev-health.mjs";

void test("dev health reads the taskpane SourceLocation from the manifest", () => {
  const result = readManifestSourceLocation("manifest.xml");
  assert.equal(result.sourceLocation, "https://localhost:3141/src/taskpane.html");
  assert.match(result.xml, /<DisplayName DefaultValue="EV"\s*\/>/u);
});
