import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createSelectionSnapshot,
  EMPTY_SELECTION_CAPTURE_STATE,
  type SelectionCaptureState,
} from "../src/context/selection-snapshot.ts";

void test("empty selection capture state has no captured workbook data", () => {
  assert.deepEqual(EMPTY_SELECTION_CAPTURE_STATE, { status: "empty" });
});

void test("createSelectionSnapshot preserves bounded selection metadata", () => {
  const snapshot = createSelectionSnapshot({
    address: "Sheet 1!B2:D20",
    preview: "**Selection:** Sheet 1!B2:D20",
    workbookId: "url_sha256:abc123",
    capturedAt: 1234,
  });

  assert.deepEqual(snapshot, {
    address: "Sheet 1!B2:D20",
    preview: "**Selection:** Sheet 1!B2:D20",
    workbookId: "url_sha256:abc123",
    capturedAt: 1234,
  });
  assert.equal(Object.isFrozen(snapshot), true);
});

void test("createSelectionSnapshot omits unavailable workbook identity", () => {
  const snapshot = createSelectionSnapshot({
    address: "Sheet1!A1",
    preview: "**Selection:** Sheet1!A1",
    workbookId: null,
    capturedAt: 5678,
  });

  assert.equal("workbookId" in snapshot, false);
});

void test("selection capture states distinguish loading, captured, and error", () => {
  const snapshot = createSelectionSnapshot({
    address: "Sheet1!A1:B2",
    preview: "preview",
    capturedAt: 42,
  });

  const states: SelectionCaptureState[] = [
    { status: "loading" },
    { status: "captured", snapshot },
    { status: "error" },
  ];

  assert.deepEqual(states.map((state) => state.status), ["loading", "captured", "error"]);
  assert.equal(states[1]?.status === "captured" ? states[1].snapshot.address : "", "Sheet1!A1:B2");
});
