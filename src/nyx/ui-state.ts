import type { NyxPlan, NyxRun } from "./domain.js";

export type NyxUiState =
  | { status: "inactive" }
  | { status: "planning"; objective: string }
  | { status: "clarification"; questions: readonly string[] }
  | { status: "error"; message: string }
  | { status: "planned"; plan: NyxPlan }
  | { status: "approved"; plan: NyxPlan; run: NyxRun }
  | { status: "running"; plan: NyxPlan; run: NyxRun }
  | { status: "execution_completed"; plan: NyxPlan; run: NyxRun }
  | { status: "failed"; plan: NyxPlan; run: NyxRun }
  | { status: "cancelled"; plan: NyxPlan; run: NyxRun };

export const EMPTY_NYX_UI_STATE: NyxUiState = { status: "inactive" };
