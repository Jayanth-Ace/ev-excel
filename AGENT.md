# Nyx Agent Guide

This document describes how product and engineering agents should reason about Nyx work. It supplements the repository’s [`AGENTS.md`](./AGENTS.md), which remains the source of truth for coding standards, security rules, and verification commands.

## Product north star

Nyx is a future autonomous Business AI Agent. Its purpose is to understand business objectives, create a plan, execute safely, verify results, explain important decisions, and deliver professional outcomes.

The current Pi runtime is the implementation foundation. Do not confuse the current architecture’s names with the future product’s identity, and do not change runtime behavior merely to make terminology look newer.

## How to approach product work

Before changing behavior, answer:

1. What business objective does this serve?
2. What user decision or burden does it remove?
3. What must Nyx understand before acting?
4. How will the result be verified?
5. How can the user recover if the work is wrong?
6. How will Nyx explain what happened?

If these questions cannot be answered, the work is not ready for implementation.

## Non-negotiable behavior

- Prefer goals over software operations.
- Plan before consequential action.
- Never report success without evidence.
- Prefer deterministic tools over prompt-only behavior.
- Never silently destroy or overwrite user work.
- Preserve recovery checkpoints and audit metadata.
- Keep important assumptions visible.
- Be honest about uncertainty and unsupported capabilities.
- Minimize clarification questions without guessing through material ambiguity.
- Preserve professional formatting and business context.

## Architectural guidance

- Reuse existing host, workbook, tool, recovery, provider, session, and UI seams.
- Add orchestration around stable runtime boundaries before replacing them.
- Keep product-level task state separate from conversational message history when durable workflows are introduced.
- Keep provider selection independent from workbook and business-task state.
- Keep plans, approvals, execution steps, and verification results typed.
- Keep mutations coordinated, recoverable, and bounded.
- Treat external services, extensions, bridges, and model providers as explicit trust boundaries.
- Preserve deterministic tool ordering and prompt-cache stability.

## Scope discipline

Do not implement a later milestone while working on an earlier one.

Do not introduce:

- Placeholder modules.
- Dead abstractions.
- Broad “future-proof” APIs without a current use.
- New duplicate components when an existing component can be extended.
- Renames made only for branding.
- Autonomous behavior without approval and verification policy.

## Documentation expectations

Behavioral changes should update the relevant product or architecture documentation when the change establishes a durable principle.

Use:

- [`NYX_MANIFESTO.md`](./NYX_MANIFESTO.md) for enduring product beliefs.
- [`ROADMAP.md`](./ROADMAP.md) for product sequencing and boundaries.
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) for system responsibilities and evolution.
- [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) for interaction, content, and visual principles.
- [`AGENTS.md`](./AGENTS.md) for repository coding and safety rules.

## Definition of a trustworthy outcome

A Nyx outcome is trustworthy when:

- The objective is understood.
- The intended work was visible.
- The action was authorized appropriately.
- The result was checked.
- The work can be recovered when supported.
- The explanation matches the evidence.
- Remaining uncertainty is clear.
