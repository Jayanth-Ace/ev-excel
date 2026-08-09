# Nyx Architecture

This document describes how the current Pi implementation supports the future Nyx product. It is a documentation-layer architecture guide; it does not change runtime behavior or rename existing modules.

## Architectural intent

Nyx should evolve from a conversational tool caller into a goal-driven business execution system.

The long-term flow is:

```text
Human objective
    ↓
Context and intent
    ↓
Validated plan
    ↓
User approval and policy
    ↓
Controlled execution
    ↓
Deterministic verification
    ↓
Explanation and professional outcome
```

The current implementation already provides much of the lower half of this system: workbook context, typed tools, provider abstraction, mutation coordination, recovery, audit, sessions, extensions, and a taskpane UI.

## Current system layers

### Host layer

`src/host` abstracts Microsoft Excel, WPS Spreadsheets, and browser fallback environments. It owns host readiness, workbook identity, session association, and theme signals.

### Workbook layer

`src/workbook` owns workbook identity, mutation coordination, save boundaries, recovery checkpoints, and restoration. This is the safety boundary around workbook state.

### Context layer

`src/context` and `src/taskpane/context-injection.ts` provide workbook blueprints, selection context, recent changes, and context-window discipline.

### Capability layer

`src/tools` contains typed workbook capabilities and external integrations. `src/tools/registry.ts` is the canonical core-tool registry. Tools are wrapped with host selection, connection preflight, execution policy, workbook coordination, and output truncation.

### Intelligence layer

`src/models`, `src/auth`, `src/prompt`, and `@earendil-works/pi-agent-core` provide model selection, authentication, prompt construction, streaming, tool calls, and agent state.

### Runtime layer

`src/taskpane` creates agent runtimes, manages session tabs, queues actions, persists sessions, refreshes capabilities, and connects the agent to the UI.

### Presentation layer

`src/ui` provides the sidebar, message rendering, tool cards, settings, overlays, status, themes, localization, and visual verification gallery.

### Extensibility layer

`src/extensions`, `src/integrations`, and `src/skills` provide sandboxed tools, commands, widgets, providers, connections, external capabilities, and reusable domain guidance.

## Current execution flow

1. The taskpane boots compatibility patches, CSS, and UI components.
2. The host resolver identifies Excel, WPS, or browser fallback.
3. IndexedDB-backed stores restore settings, credentials, sessions, and catalogs.
4. A runtime is created with a model, system prompt, context injector, and tools.
5. User input enters the action queue and agent loop.
6. The agent streams responses and invokes typed tools.
7. Workbook mutations pass through approval policy, coordination, audit, and recovery.
8. Agent events update messages, status, tool cards, and session persistence.

## Future Nyx orchestration boundary

Nyx should introduce a product-level orchestration boundary above the current agent loop:

```text
Nyx run
 ├─ objective
 ├─ context snapshot
 ├─ plan
 ├─ approval state
 ├─ execution steps
 ├─ verification results
 ├─ recovery references
 └─ completion explanation
```

The orchestrator should own task state and approved step sequencing. The existing agent remains useful for interpretation, planning assistance, and bounded reasoning, but it should not be the sole record of business-task state.

## Safety boundaries

- Host adapters decide whether a capability is available.
- Tool schemas validate inputs at the capability boundary.
- Connection preflight prevents calls without required credentials.
- Execution policy controls mutation approval.
- The workbook coordinator serializes writes.
- Mutation tools create audit and recovery metadata where supported.
- Workbook identity prevents accidental cross-workbook restoration.
- Output truncation protects context budgets.
- HTML, markdown, proxy, bridge, and extension policies protect trust boundaries.

## Evolution principles

- Add Nyx orchestration around existing seams before replacing them.
- Keep workbook tools deterministic and independently testable.
- Keep provider choice independent from business-task state.
- Keep plans and verification results typed rather than embedded only in prose.
- Keep user approval explicit for consequential work.
- Preserve current Pi sessions and tools while new Nyx workflows mature.
- Prefer additive interfaces and adapters over renaming stable runtime modules.
## Local AI provider boundary

Ollama is registered through the same browser model runtime used by other
providers; it does not have a second provider architecture. Its catalogue is
read from `http://127.0.0.1:11434/api/tags` and its OpenAI-compatible inference
transport uses `http://127.0.0.1:11434/v1`. The registration is keyless and
direct, so the EV remote proxy is never involved in local inference. Provider
availability is represented explicitly (unknown, available, empty, or
unavailable) and the taskpane can fall back without restoring stale local
models.

The developer environment scripts in `scripts/ev-environment.mjs` use the same
endpoints for setup, diagnostics, and real integration checks. They may start
an installed Ollama server on macOS, but never download a model without an
explicit `ollama pull` command.
