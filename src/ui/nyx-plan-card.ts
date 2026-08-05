import { html, LitElement, nothing, type TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";

import type { NyxPlan, NyxRun } from "../nyx/domain.js";
import type { NyxUiState } from "../nyx/ui-state.js";
import { t } from "../language/index.js";

function renderStep(plan: NyxPlan, index: number): TemplateResult {
  const step = plan.steps[index];
  if (!step) return html``;
  return html`
    <li class="nyx-plan-card__step">
      <span class="nyx-plan-card__step-number">${step.order}</span>
      <div class="nyx-plan-card__step-content">
        <strong>${step.title}</strong>
        <span>${step.description}</span>
        <small>${step.capability}${step.targetAddress ? ` · ${step.targetAddress}` : ""}</small>
      </div>
    </li>
  `;
}

function runProgress(run: NyxRun): TemplateResult {
  return html`
    <div class="nyx-plan-card__progress" aria-live="polite">
      ${run.steps.map((step) => html`
        <span class="nyx-plan-card__progress-step nyx-plan-card__progress-step--${step.status}">
          ${step.status === "completed" ? "✓" : step.status === "failed" ? "!" : "•"} ${step.stepId}
        </span>
      `)}
    </div>
  `;
}

function statusLabel(status: NyxUiState["status"]): string {
  switch (status) {
    case "planned": return t("nyx.plan.status.planned");
    case "approved": return t("nyx.plan.status.approved");
    case "running": return t("nyx.plan.status.running");
    case "execution_completed": return t("nyx.plan.status.execution_completed");
    case "failed": return t("nyx.plan.status.failed");
    case "cancelled": return t("nyx.plan.status.cancelled");
    default: return "";
  }
}

@customElement("nyx-plan-card")
export class NyxPlanCard extends LitElement {
  @property({ attribute: false }) state?: NyxUiState;
  @property({ attribute: false }) onApprove?: () => void;
  @property({ attribute: false }) onRevise?: () => void;
  @property({ attribute: false }) onReject?: () => void;
  @property({ attribute: false }) onCancel?: () => void;
  @property({ attribute: false }) onRollback?: () => void;

  protected override createRenderRoot() { return this; }

  override render() {
    const state = this.state;
    if (!state || state.status === "inactive") return nothing;

    if (state.status === "planning") {
      return html`<section class="nyx-plan-card" aria-live="polite"><strong>${t("nyx.plan.planning")}</strong><span>${state.objective}</span></section>`;
    }

    if (state.status === "clarification") {
      return html`
        <section class="nyx-plan-card nyx-plan-card--notice" aria-live="polite">
          <strong>${t("nyx.plan.needs_clarification")}</strong>
          <ul>${state.questions.map((question) => html`<li>${question}</li>`)}</ul>
          <button type="button" class="nyx-plan-card__button" @click=${this.onRevise}>${t("nyx.plan.revise")}</button>
        </section>
      `;
    }

    if (state.status === "error") {
      return html`
        <section class="nyx-plan-card nyx-plan-card--error" aria-live="polite">
          <strong>${t("nyx.plan.error")}</strong><span>${state.message}</span>
          <button type="button" class="nyx-plan-card__button" @click=${this.onRevise}>${t("nyx.plan.try_again")}</button>
        </section>
      `;
    }

    const plan = state.plan;
    const run = "run" in state ? state.run : undefined;
    const isPlanned = state.status === "planned";
    const isRunning = state.status === "running";
    const isComplete = state.status === "execution_completed";
    const hasRecovery = run?.steps.some((step) => step.recoveryCheckpointId !== undefined) ?? false;

    return html`
      <section class="nyx-plan-card" aria-label=${t("nyx.plan.preview.aria")}>
        <div class="nyx-plan-card__header">
          <div><span class="nyx-plan-card__eyebrow">${t("nyx.plan.title")}</span><strong>${plan.objective.text}</strong></div>
          <span class="nyx-plan-card__status">${statusLabel(state.status)}</span>
        </div>
        <div class="nyx-plan-card__section"><strong>${t("nyx.plan.assumptions")}</strong>${plan.assumptions.length === 0 ? html`<span>${t("nyx.plan.none")}</span>` : html`<ul>${plan.assumptions.map((item) => html`<li>${item}</li>`)}</ul>`}</div>
        <div class="nyx-plan-card__section"><strong>${t("nyx.plan.areas")}</strong><ul>${plan.affectedAreas.map((area) => html`<li><code>${area.address}</code> — ${area.purpose}</li>`)}</ul></div>
        <ol class="nyx-plan-card__steps">${plan.steps.map((_step, index) => renderStep(plan, index))}</ol>
        ${run ? runProgress(run) : nothing}
        ${isComplete && !run?.verification ? html`<p class="nyx-plan-card__notice">${t("nyx.plan.execution_pending_verification")}</p>` : nothing}
        ${run?.verification?.status === "passed" ? html`<p class="nyx-plan-card__notice">${t("nyx.plan.verification_passed")}</p>` : nothing}
        ${run?.verification?.status === "failed" ? html`<p class="nyx-plan-card__error">${t("nyx.plan.verification_failed")}</p>` : nothing}
        ${run?.verification?.status === "inconclusive" ? html`<p class="nyx-plan-card__notice">${t("nyx.plan.verification_inconclusive")}</p>` : nothing}
        ${state.status === "failed" ? html`<p class="nyx-plan-card__error">${run?.failureReason ?? t("nyx.plan.execution_failed")}</p>` : nothing}
        ${run?.rollback?.status === "rolled_back" ? html`<p class="nyx-plan-card__notice">${t("nyx.plan.rollback_complete")}</p>` : nothing}
        ${run?.rollback?.status === "rollback_failed" ? html`<p class="nyx-plan-card__error">${run.rollback.reason ?? t("nyx.plan.rollback_failed")}</p>` : nothing}
        <div class="nyx-plan-card__actions">
          ${isPlanned ? html`
            <button type="button" class="nyx-plan-card__button nyx-plan-card__button--primary" @click=${this.onApprove}>${t("nyx.plan.approve")}</button>
            <button type="button" class="nyx-plan-card__button" @click=${this.onRevise}>${t("nyx.plan.revise")}</button>
            <button type="button" class="nyx-plan-card__button" @click=${this.onReject}>${t("nyx.plan.reject")}</button>
          ` : nothing}
          ${isRunning ? html`<button type="button" class="nyx-plan-card__button" @click=${this.onCancel}>${t("nyx.plan.cancel")}</button>` : nothing}
          ${hasRecovery && !isRunning && run?.rollback?.status !== "rolled_back" && run?.rollback?.status !== "rolling_back"
            ? html`<button type="button" class="nyx-plan-card__button" @click=${this.onRollback}>${t("nyx.plan.rollback")}</button>`
            : nothing}
        </div>
      </section>
    `;
  }
}
