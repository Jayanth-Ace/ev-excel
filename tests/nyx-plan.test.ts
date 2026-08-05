import assert from "node:assert/strict";
import { test } from "node:test";
import { Type } from "@sinclair/typebox";
import type { AgentTool } from "@earendil-works/pi-agent-core";

import {
  NYX_EXECUTABLE_TOOL_NAMES,
  type NyxContextSnapshot,
  type NyxObjective,
} from "../src/nyx/domain.ts";
import { createNyxPlanner } from "../src/nyx/planner.ts";
import { freezeNyxPlan, validateNyxPlan } from "../src/nyx/plan-validation.ts";

const context: NyxContextSnapshot = {
  workbookId: "url_sha256:workbook",
  selectionAddress: "Sheet1!A1:C4",
  selectionPreview: "preview",
  capturedAt: 100,
};

const objective: NyxObjective = { text: "Prepare the selected table", revision: 1 };

function validRawPlan(): DynamicObject {
  return {
    kind: "plan",
    assumptions: ["The first row is a header."],
    affectedAreas: [{ address: "Sheet1!A1:C1", purpose: "Selected header" }],
    steps: [{
      id: "step_1",
      order: 1,
      capability: "format_cells",
      title: "Format the header",
      description: "Apply a professional header style.",
      risk: "write",
      targetAddress: "Sheet1!A1:C1",
      parameters: { range: "Sheet1!A1:C1", bold: true },
      allowOverwrite: false,
      postconditions: [{ kind: "format", address: "Sheet1!A1:C1" }],
    }],
  };
}

function createReadTool(): AgentTool {
  return {
    name: "read_range",
    label: "Read Range",
    description: "Read a range.",
    parameters: Type.Object({}),
    execute: () => Promise.resolve({ content: [{ type: "text", text: "ok" }], details: {} }),
  };
}

void test("validates a bounded Nyx plan", () => {
  const plan = {
    version: 1,
    id: "plan-1",
    revision: 1,
    objective,
    context,
    assumptions: ["The first row is a header."],
    affectedAreas: [{ address: "Sheet1!A1:C1", purpose: "Selected header" }],
    steps: validRawPlan().steps,
    status: "planned",
    createdAt: 200,
  };

  assert.equal(validateNyxPlan(plan), null);
  const frozenPlan = freezeNyxPlan(plan);
  assert.equal(Object.isFrozen(frozenPlan), true);
  assert.equal(Object.isFrozen(frozenPlan.steps[0]?.parameters), true);
});

void test("rejects unsupported, unordered, duplicate, and out-of-scope steps", () => {
  const base = {
    version: 1,
    id: "plan-1",
    revision: 1,
    objective,
    context,
    assumptions: [],
    affectedAreas: [{ address: "Sheet1!A1:C4", purpose: "Selected table" }],
    status: "planned",
    createdAt: 200,
  };

  const unsupported = {
    ...base,
    steps: [{ ...validRawPlan().steps[0], capability: "charts", risk: "write" }],
  };
  assert.match(validateNyxPlan(unsupported), /step 1 is invalid/i);

  const unordered = {
    ...base,
    steps: [{ ...validRawPlan().steps[0], order: 2 }],
  };
  assert.match(validateNyxPlan(unordered), /sequential/i);

  const duplicate = {
    ...base,
    steps: [validRawPlan().steps[0], { ...validRawPlan().steps[0], order: 2 }],
  };
  assert.match(validateNyxPlan(duplicate), /affected areas|duplicated|step 2/i);

  const outside = {
    ...base,
    steps: [{ ...validRawPlan().steps[0], targetAddress: "Sheet1!Z1:Z2" }],
  };
  assert.match(validateNyxPlan(outside), /outside/i);
});

void test("planner accepts only a structured result and validates capability parameters", async () => {
  let capturedTools: AgentTool[] = [];
  const planner = createNyxPlanner({
    agent: {
      run: async ({ readOnlyTools, submissionTool }) => {
        capturedTools = [...readOnlyTools, submissionTool];
        await submissionTool.execute("submission", { result: validRawPlan() });
      },
    },
    createId: () => "plan-1",
    now: () => 200,
    validateCapabilityParameters: (capability, parameters) =>
      capability === "format_cells" && typeof parameters.range === "string",
  });

  const result = await planner.generate(objective, context, [createReadTool()]);
  assert.equal(result.kind, "plan");
  if (result.kind === "plan") {
    assert.equal(result.plan.id, "plan-1");
    assert.equal(result.plan.context.workbookId, context.workbookId);
  }
  assert.deepEqual(capturedTools.map((tool) => tool.name), ["read_range", "nyx_submit_plan"]);
});

void test("planner preserves clarification results and rejects malformed submissions", async () => {
  const clarificationPlanner = createNyxPlanner({
    agent: {
      run: async ({ submissionTool }) => {
        await submissionTool.execute("submission", { result: { questions: ["Which period?"] } });
      },
    },
  });
  const clarification = await clarificationPlanner.generate(objective, context, []);
  assert.deepEqual(clarification, { kind: "clarification", questions: ["Which period?"] });

  const malformedPlanner = createNyxPlanner({
    agent: { run: async ({ submissionTool }) => {
      await submissionTool.execute("submission", { result: { kind: "plan" } });
    } },
  });
  const malformed = await malformedPlanner.generate(objective, context, []);
  assert.equal(malformed.kind, "error");
});

void test("bounded executable capability names exclude the broader Pi tool surface", () => {
  assert.deepEqual(NYX_EXECUTABLE_TOOL_NAMES, ["write_cells", "fill_formula", "format_cells"]);
});
