import assert from "node:assert/strict";
import { test } from "node:test";
import { Type } from "typebox";
import type { AgentTool } from "@earendil-works/pi-agent-core";

import type { NyxPlan, NyxRun } from "../src/nyx/domain.ts";
import { createNyxRunController } from "../src/nyx/run-controller.ts";

function createPlan(): NyxPlan {
  return {
    version: 1,
    id: "plan-1",
    revision: 1,
    objective: { text: "Prepare the selected data", revision: 1 },
    context: {
      workbookId: "url_sha256:book",
      selectionAddress: "Sheet1!A1:C3",
      selectionPreview: "preview",
      capturedAt: 100,
    },
    assumptions: [],
    affectedAreas: [{ address: "Sheet1!A1:C1", purpose: "Header" }],
    steps: [{
      id: "step_1",
      order: 1,
      capability: "write_cells",
      title: "Write the header",
      description: "Write a professional header.",
      risk: "write",
      targetAddress: "Sheet1!A1:C1",
      parameters: { target: "Sheet1!A1:C1" },
      allowOverwrite: false,
      postconditions: [{ kind: "values", address: "Sheet1!A1:C1", expected: [] }],
    }],
    status: "planned",
    createdAt: 100,
  };
}

function firstStep(plan: NyxPlan): NyxPlan["steps"][number] {
  const [step] = plan.steps;
  if (!step) {
    throw new Error("Test plan must contain a first step");
  }
  return step;
}

function createTool(name: string, calls: string[], result: DynamicValue = {
  content: [{ type: "text", text: "changed" }],
  details: { kind: "write_cells", recovery: { snapshotId: "checkpoint-1" } },
}): AgentTool {
  return {
    name,
    label: name,
    description: name,
    parameters: Type.Object({ target: Type.String() }),
    execute: (toolCallId, params) => {
      calls.push(`${name}:${toolCallId}:${params.target}`);
      return Promise.resolve(result as { content: [{ type: "text"; text: string }]; details: DynamicValue });
    },
  };
}

function createDependencies(args: {
  plan?: NyxPlan;
  tools: AgentTool[];
  calls: string[];
  persisted: NyxRun[];
  workbookId?: string | null;
  selectionAddress?: string | null;
  restoreCheckpoint?: (snapshotId: string) => Promise<{ inverseSnapshotId?: string | null }>;
}) {
  return {
    getWorkbookId: () => Promise.resolve(args.workbookId === undefined ? "url_sha256:book" : args.workbookId),
    getSelectionAddress: () => Promise.resolve(args.selectionAddress === undefined ? "Sheet1!A1:C3" : args.selectionAddress),
    getTools: () => args.tools,
    persist: (run: NyxRun) => {
      args.persisted.push({ ...run, steps: run.steps.map((step) => ({ ...step })) });
      return Promise.resolve();
    },
    createId: () => "run-1",
    now: () => 200,
    restoreCheckpoint: args.restoreCheckpoint,
  };
}

void test("approval creates a run and execution uses the approved tool in order", async () => {
  const calls: string[] = [];
  const persisted: NyxRun[] = [];
  const controller = createNyxRunController(createDependencies({
    tools: [createTool("write_cells", calls)],
    calls,
    persisted,
  }));

  const plan = createPlan();
  const run = await controller.approve(plan);
  assert.equal(run.status, "approved");
  const finished = await controller.execute(plan, run);
  assert.equal(finished.status, "execution_completed");
  assert.deepEqual(calls, ["write_cells:plan-1:step_1:Sheet1!A1:C1"]);
  assert.equal(finished.steps[0]?.status, "completed");
  assert.equal(finished.steps[0]?.recoveryCheckpointId, "checkpoint-1");
  assert.equal(persisted.at(-1)?.status, "execution_completed");
});

void test("identity and selection changes fail before any mutation", async () => {
  for (const mismatch of [
    { workbookId: "url_sha256:other", selectionAddress: "Sheet1!A1:C3" },
    { workbookId: "url_sha256:book", selectionAddress: "Sheet1!B1:C3" },
    { workbookId: null, selectionAddress: "Sheet1!A1:C3" },
  ]) {
    const calls: string[] = [];
    const persisted: NyxRun[] = [];
    const controller = createNyxRunController(createDependencies({
      tools: [createTool("write_cells", calls)], calls, persisted, ...mismatch,
    }));
    const plan = createPlan();
    const run = await controller.approve(plan);
    const failed = await controller.execute(plan, run);
    assert.equal(failed.status, "failed");
    assert.equal(calls.length, 0);
  }
});

void test("a failed step stops later steps", async () => {
  const plan = createPlan();
  plan.steps = [
    ...plan.steps,
    { ...firstStep(plan), id: "step_2", order: 2, title: "Second", targetAddress: "Sheet1!A1:C1" },
  ];
  const calls: string[] = [];
  const persisted: NyxRun[] = [];
  const failing = createTool("write_cells", calls, {
    content: [{ type: "text", text: "Error: blocked" }],
    details: { kind: "write_cells", blocked: true },
  });
  const controller = createNyxRunController(createDependencies({ tools: [failing], calls, persisted }));
  const run = await controller.approve(plan);
  const failed = await controller.execute(plan, run);
  assert.equal(failed.status, "failed");
  assert.equal(failed.steps[0]?.status, "failed");
  assert.equal(failed.steps[1]?.status, "pending");
  assert.equal(calls.length, 1);
});

void test("invalid parameters are rejected before execution and scoped approval is isolated", async () => {
  const calls: string[] = [];
  const persisted: NyxRun[] = [];
  const scopes: string[] = [];
  const controller = createNyxRunController({
    ...createDependencies({ tools: [createTool("write_cells", calls)], calls, persisted }),
    runWithApprovalScope: async (scope, operation) => {
      scopes.push(`${scope.runId}:${scope.stepId}:${scope.capability}`);
      return operation();
    },
  });
  const plan = createPlan();
  const run = await controller.approve(plan);
  const finished = await controller.execute(plan, run);
  assert.equal(finished.status, "execution_completed");
  assert.deepEqual(scopes, ["run-1:step_1:write_cells"]);

  const invalidPlan = { ...createPlan(), steps: [{ ...firstStep(createPlan()), parameters: { wrong: true } }] };
  await assert.rejects(() => controller.approve(invalidPlan), /approved|invalid|plan/i);
});

void test("cancellation stops before the next step", async () => {
  const plan = createPlan();
  plan.steps = [
    ...plan.steps,
    { ...firstStep(plan), id: "step_2", order: 2, title: "Second", targetAddress: "Sheet1!A1:C1" },
  ];
  const calls: string[] = [];
  const persisted: NyxRun[] = [];
  const abortController = new AbortController();
  const controller = createNyxRunController(createDependencies({ tools: [createTool("write_cells", calls)], calls, persisted }));
  const run = await controller.approve(plan);
  const firstTool = createTool("write_cells", calls);
  firstTool.execute = (toolCallId, params) => {
    calls.push(`write_cells:${toolCallId}:${params.target}`);
    abortController.abort();
    return Promise.resolve({ content: [{ type: "text", text: "changed" }], details: {} });
  };
  const executableController = createNyxRunController(createDependencies({ tools: [firstTool], calls, persisted }));
  const finishedPromise = executableController.execute(plan, run, abortController.signal);
  const finished = await finishedPromise;
  assert.equal(finished.status, "cancelled");
  assert.equal(calls.length, 1);
});

void test("rollback restores completed steps in reverse order and records inverse checkpoints", async () => {
  const restored: string[] = [];
  const persisted: NyxRun[] = [];
  const controller = createNyxRunController(createDependencies({
    tools: [createTool("write_cells", [])],
    calls: [],
    persisted,
    restoreCheckpoint: (snapshotId) => {
      restored.push(snapshotId);
      return Promise.resolve({ inverseSnapshotId: `inverse-${snapshotId}` });
    },
  }));
  const plan = createPlan();
  plan.steps = [
    ...plan.steps,
    { ...firstStep(plan), id: "step_2", order: 2, title: "Second", targetAddress: "Sheet1!A1:C1" },
  ];
  const run = await controller.approve(plan);
  const finished = await controller.execute(plan, run);
  const rolledBack = await controller.rollback(finished);
  assert.equal(rolledBack.rollback?.status, "rolled_back");
  assert.deepEqual(restored, ["checkpoint-1", "checkpoint-1"]);
  assert.deepEqual(rolledBack.rollback?.inverseCheckpointIds, ["inverse-checkpoint-1", "inverse-checkpoint-1"]);
  await assert.rejects(() => controller.rollback(rolledBack), /already been rolled back/i);
});
