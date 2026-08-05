/**
 * Stable domain contracts for the first Nyx objective-to-plan slice.
 *
 * These types intentionally contain no Office.js, Lit, model-provider, or
 * persistence dependencies. They are the boundary between product state and
 * the current Pi runtime.
 */

export const NYX_PLAN_VERSION = 1 as const;

export const NYX_PLANNING_TOOL_NAMES = [
  "get_workbook_overview",
  "read_range",
  "search_workbook",
] as const;

export const NYX_EXECUTABLE_TOOL_NAMES = [
  "write_cells",
  "fill_formula",
  "format_cells",
] as const;

export type NyxPlanningToolName = (typeof NYX_PLANNING_TOOL_NAMES)[number];
export type NyxExecutableToolName = (typeof NYX_EXECUTABLE_TOOL_NAMES)[number];
export type NyxCapabilityName = NyxPlanningToolName | NyxExecutableToolName;

export type NyxStepRisk = "read" | "write";

export type NyxPostcondition =
  | {
    kind: "values";
    address: string;
    expected: readonly (readonly DynamicValue[])[];
  }
  | {
    kind: "formulas";
    address: string;
    expected: readonly (readonly DynamicValue[])[];
  }
  | {
    kind: "formula_pattern";
    address: string;
    topLeft: string;
  }
  | {
    kind: "format";
    address: string;
    expectedNumberFormat?: readonly (readonly DynamicValue[])[];
  };

export interface NyxObjective {
  text: string;
  revision: number;
}

export interface NyxContextSnapshot {
  workbookId: string;
  selectionAddress: string;
  selectionPreview: string;
  capturedAt: number;
}

export interface NyxAffectedArea {
  address: string;
  purpose: string;
}

export interface NyxPlanStep {
  id: string;
  order: number;
  capability: NyxCapabilityName;
  title: string;
  description: string;
  risk: NyxStepRisk;
  targetAddress?: string;
  parameters: DynamicObject;
  allowOverwrite: boolean;
  postconditions: readonly NyxPostcondition[];
}

export interface NyxPlan {
  version: typeof NYX_PLAN_VERSION;
  id: string;
  revision: number;
  objective: NyxObjective;
  context: NyxContextSnapshot;
  assumptions: readonly string[];
  affectedAreas: readonly NyxAffectedArea[];
  steps: readonly NyxPlanStep[];
  status: "planned";
  createdAt: number;
}

export interface NyxClarificationResult {
  kind: "clarification";
  questions: string[];
}

export interface NyxPlanResult {
  kind: "plan";
  plan: NyxPlan;
}

export interface NyxPlanningError {
  kind: "error";
  message: string;
}

export type NyxPlanningResult = NyxClarificationResult | NyxPlanResult | NyxPlanningError;

export interface NyxPersistedState {
  version: 1;
  objective?: NyxObjective;
  context?: NyxContextSnapshot;
  plan?: NyxPlan;
  run?: NyxRun;
}

export type NyxExecutionStatus =
  | "planned"
  | "approved"
  | "running"
  | "execution_completed"
  | "failed"
  | "cancelled";

export type NyxStepExecutionStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface NyxApproval {
  planId: string;
  planRevision: number;
  approvedAt: number;
}

export interface NyxStepExecutionResult {
  stepId: string;
  status: NyxStepExecutionStatus;
  toolCallId: string;
  recoveryCheckpointId?: string;
  summary?: string;
  error?: string;
  verification?: NyxStepVerification;
}

export type NyxVerificationStatus = "not_run" | "passed" | "failed" | "inconclusive";

export interface NyxStepVerification {
  status: Exclude<NyxVerificationStatus, "not_run">;
  evidenceAddress?: string;
  message: string;
}

export interface NyxVerificationReport {
  status: NyxVerificationStatus;
  checkedAt: number;
  passedSteps: number;
  failedSteps: number;
  inconclusiveSteps: number;
  summary: string;
}

export type NyxRollbackStatus = "not_requested" | "rolling_back" | "rolled_back" | "rollback_failed";

export interface NyxRollbackState {
  status: NyxRollbackStatus;
  requestedAt?: number;
  completedAt?: number;
  restoredStepIds: string[];
  inverseCheckpointIds: string[];
  reason?: string;
}

export interface NyxRun {
  version: 1;
  id: string;
  planId: string;
  planRevision: number;
  status: NyxExecutionStatus;
  approval?: NyxApproval;
  workbookId: string;
  selectionAddress: string;
  currentStepId?: string;
  steps: NyxStepExecutionResult[];
  failureReason?: string;
  createdAt: number;
  updatedAt: number;
  verification?: NyxVerificationReport;
  rollback?: NyxRollbackState;
}
