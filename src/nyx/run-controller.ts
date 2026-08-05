import type { AgentTool, AgentToolResult } from "@earendil-works/pi-agent-core";
import { Value } from "typebox/value";

import {
  type NyxPlan,
  type NyxPlanStep,
  type NyxRun,
  type NyxStepExecutionResult,
  type NyxExecutableToolName,
  type NyxStepVerification,
  type NyxVerificationReport,
} from "./domain.js";
import { freezeNyxPlan, isNyxExecutableToolName, validateNyxPlan } from "./plan-validation.js";

export interface NyxApprovalScope {
  runId: string;
  planId: string;
  planRevision: number;
  stepId: string;
  capability: NyxExecutableToolName;
  targetAddress: string;
  allowOverwrite: boolean;
}

export interface NyxRunControllerDependencies {
  getWorkbookId: () => Promise<string | null>;
  getSelectionAddress: () => Promise<string | null>;
  getTools: () => readonly AgentTool[];
  persist: (run: NyxRun) => Promise<void>;
  runWithApprovalScope?: <T>(scope: NyxApprovalScope, operation: () => Promise<T>) => Promise<T>;
  createId?: () => string;
  now?: () => number;
  verifyStep?: (step: NyxPlanStep) => Promise<NyxStepVerification>;
  restoreCheckpoint?: (snapshotId: string) => Promise<{ inverseSnapshotId?: string | null }>;
}

function isNyxToolDetailsPayloadShape(value: DynamicValue): value is DynamicObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function defaultCreateId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `nyx_run_${Date.now().toString(36)}`;
}

function textFromResult(result: AgentToolResult<DynamicValue>): string {
  const text = result.content.find((part) => part.type === "text")?.text ?? "";
  return text.slice(0, 500);
}

function resultFailure(result: AgentToolResult<DynamicValue>): string | null {
  if (isNyxToolDetailsPayloadShape(result.details) && result.details.blocked === true) {
    return textFromResult(result) || "The workbook operation was blocked.";
  }
  const text = textFromResult(result);
  return /^error\s*:/iu.test(text) ? text : null;
}

function recoveryCheckpointId(result: AgentToolResult<DynamicValue>): string | undefined {
  if (!isNyxToolDetailsPayloadShape(result.details)) return undefined;
  const recovery = result.details.recovery;
  if (!isNyxToolDetailsPayloadShape(recovery)) return undefined;
  return typeof recovery.snapshotId === "string" ? recovery.snapshotId : undefined;
}

function createPendingResults(plan: NyxPlan): NyxStepExecutionResult[] {
  return plan.steps.map((step) => ({
    stepId: step.id,
    status: "pending",
    toolCallId: `${plan.id}:${step.id}`,
  }));
}

/**
 * Create the controlled executor for one approved Nyx plan.
 *
 * This controller deliberately reports execution only. It does not infer
 * business success; deterministic verification belongs to Milestone 4.
 */
export function createNyxRunController(dependencies: NyxRunControllerDependencies): {
  approve(plan: NyxPlan): Promise<NyxRun>;
  execute(plan: NyxPlan, run: NyxRun, signal?: AbortSignal): Promise<NyxRun>;
  rollback(run: NyxRun): Promise<NyxRun>;
} {
  const createId = dependencies.createId ?? defaultCreateId;
  const now = dependencies.now ?? (() => Date.now());

  return {
    async approve(plan): Promise<NyxRun> {
      const validationError = validateNyxPlan(plan);
      if (validationError) throw new Error(validationError);
      const approvedPlan = freezeNyxPlan(plan);
      const availableTools = new Map<string, AgentTool>();
      for (const tool of dependencies.getTools()) {
        if (isNyxExecutableToolName(tool.name)) availableTools.set(tool.name, tool);
      }
      for (const step of approvedPlan.steps) {
        const tool = availableTools.get(step.capability);
        if (!tool || !Value.Check(tool.parameters, step.parameters)) {
          throw new Error(`Nyx plan step ${step.id} has invalid or unavailable parameters.`);
        }
      }
      const workbookId = approvedPlan.context.workbookId;
      const run: NyxRun = {
        version: 1,
        id: createId(),
        planId: approvedPlan.id,
        planRevision: approvedPlan.revision,
        status: "approved",
        approval: {
          planId: approvedPlan.id,
          planRevision: approvedPlan.revision,
          approvedAt: now(),
        },
        workbookId,
        selectionAddress: approvedPlan.context.selectionAddress,
        steps: createPendingResults(approvedPlan),
        createdAt: now(),
        updatedAt: now(),
      };
      await dependencies.persist(run);
      return run;
    },

    async execute(plan, run, signal): Promise<NyxRun> {
      if (run.status !== "approved") throw new Error("Only an approved Nyx plan can execute.");
      if (!run.approval || run.approval.planId !== plan.id || run.approval.planRevision !== plan.revision) {
        throw new Error("The approved Nyx plan revision no longer matches.");
      }
      const validationError = validateNyxPlan(plan);
      if (validationError) throw new Error(validationError);

      const currentWorkbookId = await dependencies.getWorkbookId();
      if (!currentWorkbookId || currentWorkbookId !== run.workbookId) {
        return failRun(run, "The workbook changed or its identity is unavailable.", dependencies.persist, now);
      }
      const currentSelectionAddress = await dependencies.getSelectionAddress();
      if (!currentSelectionAddress || currentSelectionAddress !== run.selectionAddress) {
        return failRun(run, "The Excel selection changed. Refresh the selection and regenerate the plan.", dependencies.persist, now);
      }

      const tools = new Map<string, AgentTool>();
      for (const tool of dependencies.getTools()) {
        if (isNyxExecutableToolName(tool.name)) tools.set(tool.name, tool);
      }

      const running: NyxRun = { ...run, status: "running", updatedAt: now(), steps: run.steps.map((step) => ({ ...step })) };
      await dependencies.persist(running);

      for (let index = 0; index < plan.steps.length; index += 1) {
        const step = plan.steps[index];
        if (!step) continue;
        const stepResult = running.steps[index];
        if (!stepResult) continue;
        if (signal?.aborted) {
          stepResult.status = "cancelled";
          return finishRun(running, "cancelled", "Execution cancelled by the user.", dependencies.persist, now);
        }

        const tool = tools.get(step.capability);
        if (!tool || !Value.Check(tool.parameters, step.parameters)) {
          stepResult.status = "failed";
          return finishRun(running, "failed", `The approved step ${step.id} is no longer executable.`, dependencies.persist, now);
        }
        if (!step.targetAddress || !plan.affectedAreas.some((area) => area.address === step.targetAddress)) {
          stepResult.status = "failed";
          return finishRun(running, "failed", `The approved target for ${step.id} is outside the plan.`, dependencies.persist, now);
        }

        running.currentStepId = step.id;
        stepResult.status = "running";
        await dependencies.persist(running);

        const scope: NyxApprovalScope = {
          runId: running.id,
          planId: plan.id,
          planRevision: plan.revision,
          stepId: step.id,
          capability: step.capability as NyxExecutableToolName,
          targetAddress: step.targetAddress,
          allowOverwrite: step.allowOverwrite,
        };

        try {
          const execute = () => tool.execute(stepResult.toolCallId, step.parameters, signal);
          const result = dependencies.runWithApprovalScope
            ? await dependencies.runWithApprovalScope(scope, execute)
            : await execute();
          const failure = resultFailure(result);
          if (failure) {
            stepResult.status = "failed";
            stepResult.error = failure;
            return finishRun(running, "failed", failure, dependencies.persist, now);
          }
          stepResult.status = "completed";
          stepResult.summary = textFromResult(result);
          const checkpoint = recoveryCheckpointId(result);
          if (checkpoint) stepResult.recoveryCheckpointId = checkpoint;
          if (dependencies.verifyStep) {
            stepResult.verification = await dependencies.verifyStep(step);
          }
          await dependencies.persist(running);
        } catch (error) {
          if (signal?.aborted) {
            stepResult.status = "cancelled";
            return finishRun(running, "cancelled", "Execution cancelled by the user.", dependencies.persist, now);
          }
          stepResult.status = "failed";
          stepResult.error = error instanceof Error ? error.message : "Workbook operation failed.";
          return finishRun(running, "failed", stepResult.error, dependencies.persist, now);
        }
      }

      const verification = buildVerificationReport(running.steps, now());
      const completed: NyxRun = { ...running, status: "execution_completed", verification };
      await dependencies.persist(completed);
      return completed;
    },

    async rollback(run): Promise<NyxRun> {
      if (run.status === "running" || run.status === "approved" || run.status === "planned") {
        throw new Error("Only a completed or failed Nyx run can be rolled back.");
      }
      if (run.rollback?.status === "rolled_back" || run.rollback?.status === "rolling_back") {
        throw new Error("This Nyx run has already been rolled back or is being rolled back.");
      }
      if (!dependencies.restoreCheckpoint) {
        throw new Error("Nyx recovery is unavailable in this runtime.");
      }
      const completedSteps = run.steps.filter((step) => step.status === "completed");
      if (completedSteps.some((step) => !step.recoveryCheckpointId)) {
        throw new Error("Rollback is unavailable because a completed mutation has no recovery checkpoint.");
      }
      const workbookId = await dependencies.getWorkbookId();
      if (!workbookId || workbookId !== run.workbookId) {
        throw new Error("The workbook changed or its identity is unavailable; rollback was stopped.");
      }

      const state: NyxRun = {
        ...run,
        rollback: {
          status: "rolling_back",
          requestedAt: now(),
          restoredStepIds: [],
          inverseCheckpointIds: [],
        },
        updatedAt: now(),
      };
      await dependencies.persist(state);

      try {
        for (const step of [...completedSteps].reverse()) {
          const checkpointId = step.recoveryCheckpointId;
          if (!checkpointId) continue;
          const restored = await dependencies.restoreCheckpoint(checkpointId);
          state.rollback?.restoredStepIds.push(step.stepId);
          if (restored.inverseSnapshotId) state.rollback?.inverseCheckpointIds.push(restored.inverseSnapshotId);
          await dependencies.persist(state);
        }
        if (state.rollback) {
          state.rollback.status = "rolled_back";
          state.rollback.completedAt = now();
        }
        state.updatedAt = now();
        await dependencies.persist(state);
        return state;
      } catch (error) {
        if (state.rollback) {
          state.rollback.status = "rollback_failed";
          state.rollback.reason = error instanceof Error ? error.message : "Rollback failed.";
          state.rollback.completedAt = now();
        }
        state.updatedAt = now();
        await dependencies.persist(state);
        return state;
      }
    },
  };
}

function buildVerificationReport(steps: readonly NyxStepExecutionResult[], checkedAt: number): NyxVerificationReport {
  const verified = steps.map((step) => step.verification?.status ?? "inconclusive");
  const passedSteps = verified.filter((status) => status === "passed").length;
  const failedSteps = verified.filter((status) => status === "failed").length;
  const inconclusiveSteps = verified.filter((status) => status === "inconclusive").length;
  const status = failedSteps > 0 ? "failed" : inconclusiveSteps > 0 ? "inconclusive" : "passed";
  return {
    status,
    checkedAt,
    passedSteps,
    failedSteps,
    inconclusiveSteps,
    summary: status === "passed"
      ? "Every executed Nyx step passed deterministic verification."
      : status === "failed"
        ? "At least one executed Nyx step failed deterministic verification."
        : "Execution completed, but at least one result could not be verified deterministically.",
  };
}

async function failRun(
  run: NyxRun,
  reason: string,
  persist: (run: NyxRun) => Promise<void>,
  now: () => number,
): Promise<NyxRun> {
  return finishRun({ ...run, steps: run.steps.map((step) => ({ ...step })) }, "failed", reason, persist, now);
}

async function finishRun(
  run: NyxRun,
  status: NyxRun["status"],
  reason: string | undefined,
  persist: (run: NyxRun) => Promise<void>,
  now: () => number,
): Promise<NyxRun> {
  const finished: NyxRun = {
    ...run,
    status,
    updatedAt: now(),
    ...(reason ? { failureReason: reason } : {}),
  };
  await persist(finished);
  return finished;
}
