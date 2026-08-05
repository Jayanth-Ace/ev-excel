# Nyx Design System

This document defines the product experience principles for Nyx while preserving the current taskpane design system. It supplements [`src/ui/README.md`](./src/ui/README.md) and the existing theme implementation.

## Experience principle

Nyx should make complex business work feel calm, understandable, and under control.

The interface should reduce cognitive load. It should not make users supervise hidden machinery, decode technical output, or remember which subsystem is currently responsible for a result.

## Product character

Nyx speaks and behaves like an experienced analyst:

- Professional, never pompous.
- Calm under uncertainty.
- Confident when evidence supports confidence.
- Honest when evidence is incomplete.
- Concise without being cryptic.
- Direct without being cold.
- Helpful without being theatrical.

## Core interaction model

The primary experience should follow this sequence:

```text
Objective → Context → Plan → Approval → Progress → Verification → Outcome
```

Each stage should be visible when relevant. The user should never have to infer whether Nyx is still understanding, deciding, acting, checking, or waiting for input.

## Information hierarchy

Prioritize information in this order:

1. What Nyx understood.
2. What Nyx intends to do.
3. What the user needs to decide.
4. What Nyx is doing now.
5. What changed.
6. What evidence supports completion.
7. What remains uncertain.

Technical details should be available when useful, but should not displace the business meaning of the work.

## Trust language

Use precise status language:

- **Planned** means Nyx has proposed an action, not performed it.
- **Approved** means the user authorized the proposed work.
- **In progress** means execution is underway.
- **Verified** means explicit checks passed.
- **Inconclusive** means Nyx cannot prove the expected result.
- **Failed** means the intended result was not achieved.
- **Recovered** means the workbook was restored to a prior safe state.

Never use “done” or “successful” when required verification is missing or inconclusive.

## Visual principles

- Use the existing first-party preflight, tokens, and component structure.
- Prefer compact cards and clear grouping over dense dashboards.
- Use the existing green accent for positive actions and progress.
- Use warning and destructive colors only for meaningful risk or failure.
- Preserve readable contrast in light and dark modes.
- Keep the narrow taskpane comfortable at small widths and short heights.
- Let whitespace separate stages of work.
- Avoid decorative motion that competes with progress or evidence.

## Component principles

Reuse existing components before introducing new primitives:

- Sidebar and input surfaces.
- Message and streaming renderers.
- Tool cards and grouping.
- Status bar and working indicator.
- Confirmation dialogs and overlays.
- Toasts and recovery surfaces.
- Existing theme tokens and localized strings.

New Nyx components should have one clear responsibility and a stable semantic state model.

## Plan and outcome surfaces

Future plan surfaces should show:

- Objective.
- Interpretation.
- Assumptions.
- Affected workbook areas.
- Ordered actions.
- Risk level.
- Verification checks.
- Approval controls.

Future outcome surfaces should show:

- What changed.
- Where it changed.
- What was verified.
- What could not be verified.
- Recovery references.
- Recommended next action.

## Accessibility and localization

- Every interactive control needs a meaningful accessible name.
- Status changes should be announced where appropriate.
- Dynamic content must remain keyboard reachable.
- User-visible strings must use the existing `t()` layer.
- English remains the source of truth; locale key parity is required.
- Never use localization for agent-facing prompt or tool content.

## Content standards

Prefer:

- “I found 3 revenue columns and prepared a comparison.”
- “The plan will update `Summary!B2:F14`.”
- “The totals reconcile with the source range.”
- “I could not verify the external benchmark.”

Avoid:

- “Processing request.”
- “Operation successful.”
- Unexplained internal tool names.
- False certainty.
- Excessive narration of implementation mechanics.
