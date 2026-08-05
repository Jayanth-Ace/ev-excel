import type { AgentToolResult } from "@earendil-works/pi-agent-core";

import type {
  NyxPlanStep,
  NyxPostcondition,
  NyxStepVerification,
} from "./domain.js";

export interface NyxRangeSnapshot {
  address: string;
  values: DynamicValue[][];
  formulas: DynamicValue[][];
  numberFormats: DynamicValue[][];
}

function isNyxSnapshotPayloadShape(value: DynamicValue): value is DynamicObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDynamicGrid(value: DynamicValue): value is DynamicValue[][] {
  return Array.isArray(value) && value.every((row) => Array.isArray(row));
}

/** Extract the stable read-back payload emitted by the existing read_range tool. */
export function extractNyxRangeSnapshot(result: AgentToolResult<DynamicValue>): NyxRangeSnapshot | null {
  if (!isNyxSnapshotPayloadShape(result.details) || result.details.kind !== "nyx_read_range_snapshot") {
    return null;
  }
  if (!isDynamicGrid(result.details.values) || !isDynamicGrid(result.details.formulas) || !isDynamicGrid(result.details.numberFormats)) {
    return null;
  }
  if (typeof result.details.address !== "string") return null;
  return {
    address: result.details.address,
    values: result.details.values,
    formulas: result.details.formulas,
    numberFormats: result.details.numberFormats,
  };
}

function equalValue(left: DynamicValue, right: DynamicValue): boolean {
  if (Object.is(left, right)) return true;
  if (typeof left !== typeof right) return false;
  if (left === null || right === null || left === undefined || right === undefined) return false;
  return JSON.stringify(left) === JSON.stringify(right);
}

function equalGrid(actual: DynamicValue[][], expected: readonly (readonly DynamicValue[])[]): boolean {
  if (actual.length !== expected.length) return false;
  return actual.every((row, rowIndex) => {
    const expectedRow = expected[rowIndex];
    return expectedRow !== undefined && row.length === expectedRow.length && row.every((value, columnIndex) => equalValue(value, expectedRow[columnIndex]));
  });
}

function verifyPostcondition(postcondition: NyxPostcondition, snapshot: NyxRangeSnapshot): NyxStepVerification {
  if (snapshot.address.toUpperCase() !== postcondition.address.toUpperCase()) {
    return { status: "failed", evidenceAddress: snapshot.address, message: `Read-back address ${snapshot.address} did not match ${postcondition.address}.` };
  }
  if (postcondition.kind === "values") {
    return equalGrid(snapshot.values, postcondition.expected)
      ? { status: "passed", evidenceAddress: snapshot.address, message: "Read-back values matched the planned result." }
      : { status: "failed", evidenceAddress: snapshot.address, message: "Read-back values did not match the planned result." };
  }
  if (postcondition.kind === "formulas") {
    return equalGrid(snapshot.formulas, postcondition.expected)
      ? { status: "passed", evidenceAddress: snapshot.address, message: "Read-back formulas matched the planned result." }
      : { status: "failed", evidenceAddress: snapshot.address, message: "Read-back formulas did not match the planned result." };
  }
  if (postcondition.kind === "formula_pattern") {
    const topLeft = snapshot.formulas[0]?.[0];
    const allFormulaCells = snapshot.formulas.length > 0 && snapshot.formulas.every((row) => row.length > 0 && row.every((value) => typeof value === "string" && value.startsWith("=")));
    return topLeft === postcondition.topLeft && allFormulaCells
      ? { status: "passed", evidenceAddress: snapshot.address, message: "Read-back formulas matched the planned fill pattern." }
      : { status: "failed", evidenceAddress: snapshot.address, message: "Read-back formulas did not match the planned fill pattern." };
  }
  if (postcondition.expectedNumberFormat === undefined) {
    return { status: "inconclusive", evidenceAddress: snapshot.address, message: "No deterministic number-format expectation was provided." };
  }
  return equalGrid(snapshot.numberFormats, postcondition.expectedNumberFormat)
    ? { status: "passed", evidenceAddress: snapshot.address, message: "Read-back number formats matched the planned result." }
    : { status: "failed", evidenceAddress: snapshot.address, message: "Read-back number formats did not match the planned result." };
}

/** Verify all deterministic postconditions for one completed Nyx step. */
export function verifyNyxStep(
  step: NyxPlanStep,
  readRange: (address: string) => Promise<NyxRangeSnapshot | null>,
): Promise<NyxStepVerification> {
  const postcondition = step.postconditions[0];
  if (!postcondition) {
    return Promise.resolve({ status: "inconclusive", message: "The step has no deterministic postcondition." });
  }
  return (async (): Promise<NyxStepVerification> => {
    let evidenceAddress = postcondition.address;
    for (const condition of step.postconditions) {
      const snapshot = await readRange(condition.address);
      if (!snapshot) {
        return {
          status: "inconclusive",
          evidenceAddress: condition.address,
          message: "Nyx could not obtain a structured read-back snapshot.",
        };
      }
      evidenceAddress = snapshot.address;
      const result = verifyPostcondition(condition, snapshot);
      if (result.status !== "passed") return result;
    }
    return { status: "passed", evidenceAddress, message: "All deterministic postconditions passed." };
  })().catch(() => ({
    status: "inconclusive" as const,
    evidenceAddress: postcondition.address,
    message: "Nyx could not obtain a structured read-back snapshot.",
  }));
}
