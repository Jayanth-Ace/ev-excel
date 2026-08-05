import {
  NYX_EXECUTABLE_TOOL_NAMES,
  NYX_PLAN_VERSION,
  NYX_PLANNING_TOOL_NAMES,
  type NyxCapabilityName,
  type NyxPlan,
  type NyxPlanStep,
} from "./domain.js";

export const NYX_MAX_STEPS = 12;
export const NYX_MAX_AFFECTED_AREAS = 8;
export const NYX_MAX_ASSUMPTIONS = 20;
export const NYX_MAX_TEXT_LENGTH = 2_000;

const PLANNING_TOOL_SET = new Set<string>(NYX_PLANNING_TOOL_NAMES);
const EXECUTABLE_TOOL_SET = new Set<string>(NYX_EXECUTABLE_TOOL_NAMES);

function isNyxPayloadShape(value: DynamicValue): value is DynamicObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function freezeNyxValue(value: DynamicValue): DynamicValue {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => freezeNyxValue(item)));
  }
  if (!isNyxPayloadShape(value)) return value;

  const entries = Object.entries(value).map(([key, item]) => [key, freezeNyxValue(item)] as const);
  return Object.freeze(Object.fromEntries(entries));
}

function freezeNyxObject(value: DynamicObject): DynamicObject {
  // The input is already narrowed to an object; the recursive helper preserves
  // that shape while freezing nested arrays and objects.
  return freezeNyxValue(value) as DynamicObject;
}

function isNonEmptyString(value: DynamicValue, maxLength = NYX_MAX_TEXT_LENGTH): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function isCapabilityName(value: DynamicValue): value is NyxCapabilityName {
  return typeof value === "string" && (PLANNING_TOOL_SET.has(value) || EXECUTABLE_TOOL_SET.has(value));
}

function isQualifiedAddress(value: DynamicValue): value is string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 500) return false;
  const bang = value.lastIndexOf("!");
  if (bang <= 0 || bang === value.length - 1) return false;
  if (value.includes(",") || value.includes(";")) return false;
  const range = value.slice(bang + 1).replaceAll("$", "");
  return /^[A-Z]{1,3}[1-9][0-9]*(?::[A-Z]{1,3}[1-9][0-9]*)?$/i.test(range);
}

function isNyxStepPayloadShape(value: DynamicValue): value is NyxPlanStep {
  if (!isNyxPayloadShape(value)) return false;
  if (typeof value.id !== "string" || !/^step_[1-9][0-9]*$/.test(value.id)) return false;
  if (typeof value.order !== "number" || !Number.isInteger(value.order) || value.order < 1) return false;
  if (!isCapabilityName(value.capability)) return false;
  if (!isNonEmptyString(value.title, 300) || !isNonEmptyString(value.description, 1_000)) return false;
  if (value.risk !== "read" && value.risk !== "write") return false;
  if (!isNyxPayloadShape(value.parameters)) return false;
  if (typeof value.allowOverwrite !== "boolean") return false;
  if (!Array.isArray(value.postconditions) || value.postconditions.length > 4) return false;
  if (!value.postconditions.every(isNyxPostconditionPayloadShape)) return false;

  const isMutation = EXECUTABLE_TOOL_SET.has(value.capability);
  if (isMutation !== (value.risk === "write")) return false;
  if (isMutation && !isQualifiedAddress(value.targetAddress)) return false;
  if (!isMutation && value.targetAddress !== undefined && !isQualifiedAddress(value.targetAddress)) return false;

  return true;
}

function isDynamicGrid(value: DynamicValue): value is DynamicValue[][] {
  return Array.isArray(value) && value.every((row) => Array.isArray(row));
}

function isNyxPostconditionPayloadShape(value: DynamicValue): boolean {
  if (!isNyxPayloadShape(value) || !isQualifiedAddress(value.address)) return false;
  if (value.kind === "values" || value.kind === "formulas") {
    return isDynamicGrid(value.expected);
  }
  if (value.kind === "formula_pattern") {
    return typeof value.topLeft === "string" && value.topLeft.startsWith("=");
  }
  if (value.kind === "format") {
    return value.expectedNumberFormat === undefined || isDynamicGrid(value.expectedNumberFormat);
  }
  return false;
}

/** Return the first deterministic validation failure, or null when valid. */
export function validateNyxPlan(plan: DynamicValue): string | null {
  if (!isNyxPayloadShape(plan)) return "Plan must be an object.";
  if (plan.version !== NYX_PLAN_VERSION) return "Plan version is unsupported.";
  if (!isNonEmptyString(plan.id, 200)) return "Plan ID is required.";
  if (typeof plan.revision !== "number" || !Number.isInteger(plan.revision) || plan.revision < 1) {
    return "Plan revision must be a positive integer.";
  }
  if (!isNyxPayloadShape(plan.objective) || !isNonEmptyString(plan.objective.text) || plan.objective.revision !== plan.revision) {
    return "Plan objective is invalid.";
  }
  if (!isNyxPayloadShape(plan.context)) return "Plan context is required.";
  if (!isNonEmptyString(plan.context.workbookId, 300)) return "Plan workbook identity is required.";
  if (!isQualifiedAddress(plan.context.selectionAddress)) return "Plan selection address is invalid.";
  if (!isNonEmptyString(plan.context.selectionPreview, 12_000)) return "Plan selection preview is required.";
  if (typeof plan.context.capturedAt !== "number" || !Number.isFinite(plan.context.capturedAt)) {
    return "Plan capture time is invalid.";
  }
  if (plan.status !== "planned") return "Only planned plans can be generated.";
  if (typeof plan.createdAt !== "number" || !Number.isFinite(plan.createdAt)) return "Plan creation time is invalid.";
  const assumptions = Array.isArray(plan.assumptions) ? plan.assumptions as DynamicValue[] : null;
  if (!assumptions || assumptions.length > NYX_MAX_ASSUMPTIONS) {
    return "Plan assumptions exceed the allowed limit.";
  }
  if (!assumptions.every((item) => isNonEmptyString(item, 500))) return "Plan assumption is invalid.";
  const affectedAreas = Array.isArray(plan.affectedAreas) ? plan.affectedAreas as DynamicValue[] : null;
  if (!affectedAreas || affectedAreas.length === 0 || affectedAreas.length > NYX_MAX_AFFECTED_AREAS) {
    return "Plan affected areas are invalid.";
  }
  const affectedAddresses = new Set<string>();
  for (const area of affectedAreas) {
    if (!isNyxPayloadShape(area) || !isQualifiedAddress(area.address) || !isNonEmptyString(area.purpose, 500)) {
      return "Plan affected area is invalid.";
    }
    affectedAddresses.add(area.address.toUpperCase());
  }
  const steps = Array.isArray(plan.steps) ? plan.steps as DynamicValue[] : null;
  if (!steps || steps.length === 0 || steps.length > NYX_MAX_STEPS) {
    return "Plan steps exceed the allowed limit.";
  }

  const stepIds = new Set<string>();
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    if (!isNyxStepPayloadShape(step)) return `Plan step ${index + 1} is invalid.`;
    if (step.order !== index + 1) return "Plan steps must have sequential order values.";
    if (stepIds.has(step.id)) return `Plan step ID is duplicated: ${step.id}.`;
    stepIds.add(step.id);
    if (step.targetAddress && !affectedAddresses.has(step.targetAddress.toUpperCase())) {
      return `Plan step target is outside the affected areas: ${step.targetAddress}.`;
    }
    if (EXECUTABLE_TOOL_SET.has(step.capability) && step.postconditions.length === 0) {
      return `Mutation step ${step.id} must define a deterministic postcondition.`;
    }
    for (const postcondition of step.postconditions) {
      if (!affectedAddresses.has(postcondition.address.toUpperCase())) {
        return `Postcondition target is outside the affected areas: ${postcondition.address}.`;
      }
    }
  }

  return null;
}

/** Clone and freeze a validated plan so approval cannot mutate its contents. */
export function freezeNyxPlan(plan: NyxPlan): NyxPlan {
  const frozenSteps = plan.steps.map((step) => Object.freeze({
    ...step,
    parameters: freezeNyxObject(step.parameters),
    postconditions: Object.freeze(step.postconditions.map((postcondition) => Object.freeze({
      ...postcondition,
      ...(postcondition.kind === "values" || postcondition.kind === "formulas"
        ? { expected: Object.freeze(postcondition.expected.map((row) => Object.freeze([...row]))) }
        : {}),
      ...(postcondition.kind === "format" && postcondition.expectedNumberFormat !== undefined
        ? { expectedNumberFormat: Object.freeze(postcondition.expectedNumberFormat.map((row) => Object.freeze([...row]))) }
        : {}),
    }))),
  }));
  const frozen = {
    ...plan,
    objective: Object.freeze({ ...plan.objective }),
    context: Object.freeze({ ...plan.context }),
    assumptions: Object.freeze([...plan.assumptions]),
    affectedAreas: Object.freeze(plan.affectedAreas.map((area) => Object.freeze({ ...area }))),
    steps: Object.freeze(frozenSteps),
  };
  return Object.freeze(frozen);
}

export function isNyxExecutableToolName(value: string): boolean {
  return EXECUTABLE_TOOL_SET.has(value);
}

export function isNyxPlanningToolName(value: string): boolean {
  return PLANNING_TOOL_SET.has(value);
}
