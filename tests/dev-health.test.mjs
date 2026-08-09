import assert from "node:assert/strict";
import { test } from "node:test";
import { inspectMacSideloadManifest, readManifestSourceLocation, stopOwnedDevServer } from "../scripts/dev-health.mjs";

void test("dev health reads the taskpane SourceLocation from the manifest", () => {
  const result = readManifestSourceLocation("manifest.xml");
  assert.equal(result.sourceLocation, "https://localhost:3141/src/taskpane.html");
  assert.match(result.xml, /<DisplayName DefaultValue="EV"\s*\/>/u);
});

void test("dev health resolves the Excel sideload manifest by add-in id", () => {
  const result = inspectMacSideloadManifest(".", "https://localhost:3141/src/taskpane.html");
  assert.equal(result.manifestPath.endsWith("a1b2c3d4-e5f6-7890-abcd-ef1234567890.manifest.xml"), true);
  assert.equal(result.matches, true);
});

void test("dev health refuses to stop a non-EV listener", () => {
  const result = stopOwnedDevServer("/path/that/cannot-own-the-current-process", 1);
  assert.equal(result.owned, false);
  assert.equal(result.stopped, false);
});
