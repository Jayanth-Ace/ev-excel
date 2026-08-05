# Nyx Roadmap

This roadmap describes the product direction from the current Pi implementation toward Nyx, the autonomous Business AI Agent defined in [`NYX_MANIFESTO.md`](./NYX_MANIFESTO.md).

Pi remains the current implementation and release surface. Nyx is the product direction: a goal-driven system that plans, executes safely, verifies results, explains important decisions, and delivers professional outcomes.

## Direction

The transformation is not a rename or a single feature release. It is a gradual change in the center of gravity:

```text
conversation → objective → plan → approval → execution → verification → outcome
```

Existing workbook tools, recovery, provider support, sessions, extensions, and UI infrastructure remain valuable foundations throughout this evolution.

## Phase 0 — Product foundation

Establish Nyx’s durable product language and decision principles.

- Maintain the manifesto as the product north star.
- Document the current architecture and design system.
- Define the distinction between current Pi behavior and future Nyx behavior.
- Preserve existing runtime compatibility while introducing Nyx concepts around it.

## Phase 1 — Explicit context

Give users a deliberate way to identify the business material Nyx should work with.

- Capture the selected Excel range explicitly.
- Show the qualified range and bounded preview.
- Keep the capture stable until refresh or clear.
- Preserve existing conversational and auto-context behavior.

## Phase 2 — Goal and plan

Move from an open-ended prompt to a structured business objective and an inspectable plan.

- Capture the user’s objective.
- Interpret the selected workbook context.
- Generate a validated plan with assumptions, affected areas, and success criteria.
- Let the user preview, revise, approve, or reject the plan.

## Phase 3 — Controlled execution

Execute only approved plans through existing typed workbook capabilities.

- Introduce a plan/run state model.
- Enforce approved tool and target boundaries.
- Revalidate workbook identity and target state before execution.
- Preserve workbook coordination, overwrite protection, execution policy, and recovery checkpoints.

## Phase 4 — Verification and explanation

Make evidence part of every successful outcome.

- Add deterministic postconditions to plan steps.
- Read back and compare workbook state.
- Distinguish passed, failed, and inconclusive verification.
- Produce concise completion reports with changes, evidence, assumptions, and uncertainty.

## Phase 5 — Business workflows

Turn recurring business objectives into reusable workflows and skills.

- Data cleanup and standardization.
- KPI and management reporting.
- Budget versus actual analysis.
- Reconciliation and exception review.
- Forecast preparation.
- Dashboard and presentation preparation.

Each workflow should be judged by outcome quality, safety, verification, and user trust—not by the number of autonomous actions it performs.

## Phase 6 — Durable memory and recovery

Allow Nyx to resume meaningful work without confusing conversation history with task state.

- Persist objectives, plans, runs, step state, verification results, and recovery references.
- Support pause, resume, cancel, and rollback at the task level.
- Make task history searchable and explainable.

## Phase 7 — Business intelligence beyond spreadsheets

Extend the same objective-to-outcome model to CSV, SQL, Power BI, Word, PowerPoint, PDF, ERP systems, and other business environments.

The platform should preserve a consistent philosophy while adapting execution and verification to each medium.

## Product gates

Every phase should meet these gates before expansion:

- Existing behavior remains compatible.
- Mutations remain recoverable where supported.
- Important actions are visible.
- Success is backed by evidence.
- Unsupported requests fail honestly.
- Evaluation measures real business outcomes rather than model eloquence.

## What this roadmap deliberately excludes

The roadmap does not prioritize background autonomy, scheduled work, broad external action, or platform expansion before Nyx can reliably complete small, bounded, verifiable business tasks.
