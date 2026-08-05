import assert from "node:assert/strict";
import { test } from "node:test";

import type { NyxPlanStep } from "../src/nyx/domain.ts";
import { extractNyxRangeSnapshot, verifyNyxStep } from "../src/nyx/verification.ts";

function step(postconditions: NyxPlanStep["postconditions"]): NyxPlanStep {
  return {
    id: "step_1",
    order: 1,
    capability: "write_cells",
    title: "Write values",
    description: "Write the expected values.",
    risk: "write",
    targetAddress: "Sheet1!A1:B1",
    parameters: { start_cell: "Sheet1!A1", values: [[1, 2]] },
    allowOverwrite: false,
    postconditions,
  };
}

void test("verifies exact values and exposes the evidence address", async () => {
  const result = await verifyNyxStep(
    step([{ kind: "values", address: "Sheet1!A1:B1", expected: [[1, 2]] }]),
    () => Promise.resolve({ address: "Sheet1!A1:B1", values: [[1, 2]], formulas: [["", ""]], numberFormats: [["General", "General"]] }),
  );
  assert.deepEqual(result, { status: "passed", evidenceAddress: "Sheet1!A1:B1", message: "All deterministic postconditions passed." });
});

void test("fails mismatched formulas and reports inconclusive read-back", async () => {
  const failed = await verifyNyxStep(
    step([{ kind: "formula_pattern", address: "Sheet1!A1:B1", topLeft: "=SUM(A1)" }]),
    () => Promise.resolve({ address: "Sheet1!A1:B1", values: [[3, 4]], formulas: [["=A1", "=B1"]], numberFormats: [["General", "General"]] }),
  );
  assert.equal(failed.status, "failed");

  const inconclusive = await verifyNyxStep(
    step([{ kind: "values", address: "Sheet1!A1:B1", expected: [[1, 2]] }]),
    () => Promise.resolve(null),
  );
  assert.equal(inconclusive.status, "inconclusive");
});

void test("extracts only structured read-range snapshots", () => {
  const snapshot = extractNyxRangeSnapshot({
    content: [{ type: "text", text: "read" }],
    details: {
      kind: "nyx_read_range_snapshot",
      address: "Sheet1!A1",
      values: [[1]],
      formulas: [[""]],
      numberFormats: [["General"]],
    },
  });
  assert.deepEqual(snapshot?.values, [[1]]);
  assert.equal(extractNyxRangeSnapshot({ content: [], details: { kind: "read_range_csv" } }), null);
});

void test("reads each postcondition address independently", async () => {
  const addresses: string[] = [];
  const result = await verifyNyxStep(
    step([
      { kind: "values", address: "Sheet1!A1:B1", expected: [[1, 2]] },
      { kind: "values", address: "Sheet1!D1:E1", expected: [[3, 4]] },
    ]),
    (address) => {
      addresses.push(address);
      return Promise.resolve({
        address,
        values: address.endsWith("A1:B1") ? [[1, 2]] : [[3, 4]],
        formulas: [["", ""]],
        numberFormats: [["General", "General"]],
      });
    },
  );
  assert.equal(result.status, "passed");
  assert.deepEqual(addresses, ["Sheet1!A1:B1", "Sheet1!D1:E1"]);
});
