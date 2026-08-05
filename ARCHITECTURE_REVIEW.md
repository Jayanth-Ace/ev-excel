# Nyx Architecture Review

## Review scope

This review covers the current Pi implementation and its documented direction toward Nyx. It was informed by [`NYX_MANIFESTO.md`](./NYX_MANIFESTO.md), [`ROADMAP.md`](./ROADMAP.md), [`ARCHITECTURE.md`](./ARCHITECTURE.md), [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md), [`AGENT.md`](./AGENT.md), the source tree, tests, security documentation, and the existing agent/tool redesign proposals.

The review is intentionally diagnostic. It does not introduce runtime changes, rename Pi modules, or prescribe an immediate migration. Pi remains the compatibility surface; Nyx is the product architecture that must be added around it carefully.

## Executive assessment

The repository has an unusually strong foundation for a trustworthy business agent. Workbook identity, host abstraction, typed tools, mutation coordination, recovery, audit, provider independence, context budgeting, extension isolation, and security-focused tests are already present. The product documents are also coherent: they consistently place objectives, planning, verification, explanation, and recoverability above raw model autonomy.

The principal architectural gap is the absence of a first-class business-task model. Today, the taskpane composes a capable conversational agent and surrounds individual tool calls with useful safety controls. Nyx needs a durable run that owns an objective, a context snapshot, an immutable plan, approval, step state, verification evidence, recovery references, and an outcome. Without that boundary, Milestones 2–10 will tend to put plan state in prompts, execution state in chat history, and verification logic in individual tools. That would make the system difficult to resume, audit, test, and extend beyond Excel.

The recommended direction is additive: keep current tools and Pi sessions stable, introduce a typed Nyx domain and application layer above the existing agent loop, and make workbook capabilities conform to a common contract for risk, effects, recovery, and verification.

## Strengths

### Product and architectural alignment

- The manifesto, roadmap, architecture guide, design system, and agent guide share a clear objective-to-outcome model: understand, plan, approve, execute, verify, explain, and recover.
- The documentation correctly distinguishes Pi as the current implementation from Nyx as the future product. This allows the architecture to evolve without forcing a disruptive rename.
- The design system gives trust states precise meaning. “Verified,” “inconclusive,” “failed,” and “recovered” are materially better product states than a generic success indicator.

### Safety and workbook integrity

- `src/host` provides a meaningful abstraction across Excel, WPS, and browser fallback environments.
- `src/workbook` centralizes workbook identity, write coordination, save boundaries, recovery snapshots, and restoration. This is the correct place to protect workbook state.
- Mutation paths use approval policy, coordination, audit, and recovery mechanisms rather than allowing each UI path to invent its own safety behavior.
- Audit and cell-diff facilities provide a foundation for explaining changes instead of merely repeating model-generated prose.
- Existing recovery coverage includes range, format, chart, comment, conditional-format, and structure cases, with retention and persistence behavior tested.

### Capability and provider design

- `src/tools/registry.ts` establishes a canonical core-tool registry, reducing drift in the central capability list.
- Tool wrappers compose host selection, connection preflight, execution policy, coordination, and output limits around capabilities.
- `src/models` and `src/auth` keep provider selection and authentication separate from workbook behavior. This supports local-first and provider-independent product goals.
- Integrations, skills, and extensions are separate extension surfaces rather than being embedded directly into workbook tools.

### Context and prompt discipline

- Workbook blueprints are cached and invalidated when workbook structure changes.
- Selection context, recent changes, files, and other volatile information are injected separately from the stable system prompt.
- Prompt-cache sensitivity is recognized and covered by policy and tests. This is important for predictable cost and latency as plans become larger.
- Context budgets, tool-output truncation, compaction, and overflow recovery are treated as explicit concerns.

### Test and security posture

- The test suite covers model runtime behavior, context injection, tool contracts, recovery, security policies, bridges, extensions, host behavior, localization, and UI-adjacent utilities.
- Security controls include CSP, markdown safety, strict proxy target policies, origin allowlists, bounded bridge requests, extension source restrictions, and explicit approval gates for risky Office JS behavior.
- The repository has a real-Excel verification path and an evaluation proposal that favors deterministic workbook assertions over judging reply quality alone.
- The UI follows a first-party preflight/token architecture and has a gallery-based visual verification workflow.

## Weaknesses

### The taskpane composition root is too large

`src/taskpane/init.ts` is approximately 2,247 lines and wires storage, language, proxy configuration, authentication restoration, model discovery, providers, connections, workbook state, recovery, runtime construction, session persistence, commands, keyboard shortcuts, extension refresh, context injection, and sidebar callbacks. It is a valid composition root in concept, but it currently also contains application policy and lifecycle behavior.

This makes the next architectural change expensive: plan creation, approval, execution, and verification can easily become more closures in the same module. The result would be difficult to test without booting a large portion of the application and difficult to reuse outside the taskpane.

### The agent loop is still the business-task boundary

The current runtime is optimized for conversation plus tool calls. Conversation history, persisted session data, streamed events, tool calls, and user-visible output are closely related but are not the same thing as a business run. A chat can contain several objectives, partial attempts, rejected actions, and unrelated questions.

Nyx cannot use the transcript as its authoritative plan or execution record. A transcript is evidence of communication; it is not a durable state machine.

### No typed plan, run, or verification domain exists yet

The repository has strong pieces for individual operations, but it does not yet have durable types and invariants for:

- an objective and its constraints;
- a context snapshot with freshness and workbook identity;
- an immutable plan and versioned plan steps;
- approval scope and expiry;
- run and step state transitions;
- deterministic preconditions and postconditions;
- verification evidence and inconclusive outcomes;
- recovery references for a multi-step run; or
- a professional outcome report tied to evidence.

Without these types, the meaning of “approved,” “executing,” and “verified” will drift across prompts, UI components, tools, and persistence.

### Capability metadata is distributed

The core registry is a good source of truth for names, but capability behavior is still spread across registry definitions, tool implementations, wrappers, tool details, UI renderers, humanizers, disclosure logic, system-prompt text, host gates, and localization. The repository’s own conventions require several files to be updated for one tool.

That is manageable for the current surface, but it will become a planning risk when Nyx needs to reason about risk, affected targets, effects, verification, recovery, host support, and user-facing language before execution.

### Pi naming remains visible across the runtime

The future product documents correctly use Nyx, while runtime identifiers remain Pi-oriented: `PiSidebar`, `pi-sidebar`, Pi events, Pi prompt language, and Pi package/host conventions. This is compatible today and should not be renamed casually, but it creates a boundary that must be kept explicit. New Nyx concepts should not be represented as more Pi-specific state, and product-facing copy should not accidentally expose an internal transition vocabulary.

### Semantic workbook modeling is incomplete

The current tools operate effectively on ranges and workbook objects, but the agent still lacks a durable semantic model for tables, named ranges, pivots, data validation, business entities, and common report structures. The tool redesign proposal identifies these gaps and also identifies the need for a shared range resolver and a future `WorkbookAPI`.

Without that layer, planning will remain coordinate-heavy and verification will be forced to infer business meaning from raw cell values.

## Architecture consistency

The documented architecture is internally consistent at the layer level:

```text
Host → Workbook → Context → Capabilities → Intelligence → Runtime → Presentation
                         ↘ Extensions / Integrations / Skills
```

The implementation broadly follows this shape. The main inconsistency is that `src/taskpane` crosses nearly every layer and owns both composition and behavior. A second inconsistency is that the architecture document describes future Nyx orchestration, while the current runtime has no corresponding application boundary. This is a documented direction, not a defect in the current Pi release, but it is the most important seam to establish before Milestone 2.

The safety architecture is stronger than the business workflow architecture. Individual mutations can be protected and recovered, but there is no equivalent cross-cutting contract for a multi-step objective. The future system must make the run-level safety model at least as explicit as the tool-level model.

## Naming consistency

Current naming is understandable but reflects several generations of the product:

- Pi names identify stable runtime compatibility surfaces.
- Nyx names identify the future product and user experience.
- “Tool,” “integration,” “skill,” “extension,” “command,” and “capability” overlap in places even though they have different lifecycle and trust meanings.
- “Session,” “conversation,” “runtime,” and “run” are currently close enough to invite accidental conflation.
- “Context” can mean workbook context, selection context, injected prompt context, or future task context.

Recommended vocabulary for new design work:

| Term | Meaning |
| --- | --- |
| Objective | The business outcome the user wants, including constraints and success criteria. |
| Context snapshot | The bounded, identified state Nyx used to form a plan. |
| Capability | A typed operation exposed to planning/execution, including risk and verification metadata. |
| Plan | An immutable, inspectable proposal composed of ordered steps. |
| Run | One approved attempt to execute a specific plan version. |
| Step | One bounded capability invocation with preconditions, effects, and postconditions. |
| Verification | Evidence gathered after execution to assess a stated postcondition. |
| Outcome | The user-facing account of what changed, what was proven, and what remains uncertain. |
| Conversation/session | The communication and persistence surface that may contain one or more runs. |

These terms should be introduced additively. Existing Pi names should remain stable until compatibility and release policy justify change.

## Folder organization and separation of concerns

The top-level `src` folders are broadly responsibility-oriented and discoverable. The following areas have clear ownership and should remain distinct: `host`, `workbook`, `context`, `tools`, `models`, `auth`, `storage`, `extensions`, `integrations`, `skills`, `prompt`, and `ui`.

The principal organization problem is not folder count; it is dependency direction. The taskpane currently acts as a coordinator, policy host, and feature container. Large files also exist in UI, extension, file workspace, tool, and connection areas. A large file is not automatically wrong, but these sizes increase the chance that lifecycle, policy, and presentation concerns will become inseparable.

Recommended dependency direction for Nyx work:

```text
Nyx domain (pure types/invariants)
        ↓
Nyx application (use cases/state transitions)
        ↓
adapters: agent/model, workbook, persistence, clock/identity
        ↓
taskpane and UI composition
```

The domain must not import Lit, Office.js, provider SDKs, IndexedDB, or taskpane modules. Adapters may depend on the domain; the UI may observe application state but should not implement execution policy.

## Technical debt

### High impact

- The composition root is a bottleneck for feature work and startup behavior.
- Plan/run state is absent as a first-class persisted model.
- Tool contracts do not uniformly describe effects, postconditions, recovery coverage, and host support.
- The exceptional `execute_office_js` path is powerful and explicitly gated, but it does not provide the same uniform typed capability contract as ordinary tools. The redesign proposal correctly treats it as an exceptional path requiring stronger boundaries.
- Extension permission enforcement is still feature-flagged/opt-in in the current rollout, and trusted local extensions remain a separate trust class.
- WPS support intentionally has weaker recovery guarantees; this must remain visible in future plan policy.

### Medium impact

- Selection capture is a taskpane/UI state and is not yet a Nyx context snapshot with freshness, provenance, or persistence semantics.
- Tool result metadata and user-facing rendering are improving but still have multiple compatibility fallbacks.
- Provider/model refresh, runtime reconciliation, session restore, and UI updates have substantial lifecycle coupling.
- File workspace, connections, and integrations have broad responsibilities and will need clearer artifact and external-action boundaries as the product expands.
- Several helper areas (`utils`, taskpane helpers, and cross-cutting wrappers) risk becoming informal service layers.

### Low impact but cumulative

- Pi-prefixed internal events and identifiers make future product language less uniform.
- Manual lockstep updates across registry, prompt, disclosure, renderers, humanizers, localization, and tests create maintenance overhead.
- Existing dynamic-import and bundle-size warnings indicate that intended code-splitting is not consistently realized.

## Risks

### Security risks

- Workbook data, credentials, and session history cross the taskpane, model provider, local bridges, and optional extensions. A future run model must preserve provenance and avoid logging sensitive payloads by default.
- IndexedDB is same-origin storage, not an XSS boundary. Markdown safety and CSP remain essential.
- Remote proxies can observe prompts and credentials; the product must make this risk explicit in any autonomous mode.
- Local bridge services and proxy endpoints remain local attack surfaces even with origin and target allowlists.
- Trusted host-runtime extensions and opt-in permission enforcement mean the extension boundary is not equivalent to a full sandbox.
- Autonomous planning increases prompt-injection risk from workbook cells, comments, files, web pages, and external data. Untrusted content must be treated as data, never as authority or policy.
- Multi-step mutation can amplify one bad plan. Approval, target revalidation, per-step bounds, checkpoints, and postcondition checks must be run-level invariants, not optional tool conventions.

### Correctness and recovery risks

- A workbook may change between context capture, approval, and execution. Address-based plans alone are insufficient; identity and freshness checks are required.
- Office calculation, asynchronous object loading, external links, volatile formulas, and host differences can make verification inconclusive.
- Recovery currently protects many individual mutations, but a run-level rollback policy must account for partial success, user edits between steps, save boundaries, and unsupported host features.
- A model-generated explanation can be internally coherent while being factually wrong unless every important claim is linked to observed evidence.

### Product and operational risks

- If planning is added as a second conversational overlay instead of a durable state model, users will not know whether they are reviewing a proposal or supervising execution.
- If Nyx asks for confirmation at every low-risk step, it will increase cognitive load rather than reduce it.
- If autonomy expands before evaluation and observability exist, regressions will be difficult to detect and attribution will be impossible.

## Performance and scalability

The current build has a large taskpane bundle: the earlier verified build reported a minified taskpane chunk of roughly 1.575 MB, approximately 358 kB gzip, with warnings about ineffective dynamic imports and chunks over 500 kB. This is workable for the current product but is a meaningful constraint for a richer agent UI and additional providers.

Likely performance pressure points are:

- loading provider catalogs, extension surfaces, integrations, and the full tool schema set at startup;
- repeated Excel reads for selection and context injection;
- full message/session persistence during streaming;
- re-rendering a broad sidebar surface as tool and agent events arrive;
- large tool-result payloads and compaction churn;
- model/provider refresh and runtime tool reconciliation;
- cross-workbook coordination and recovery snapshots for large ranges.

Recommended safeguards are explicit bundle budgets, lazy loading of optional providers and integrations, bounded context snapshots, incremental persistence, stable tool ordering, cached workbook facts with invalidation, batched workbook reads, and a run event stream that does not require rewriting the entire transcript for every step.

## Test quality

The test suite is broad and stronger than a typical add-in project. It exercises critical policy and persistence paths, includes security-specific suites, checks localization parity, covers recovery and coordination, and has host/runtime fakes plus real-Excel verification tooling.

The main gaps are architectural rather than numerical:

- There are no contract tests for an objective → plan → approval → run → verification state machine.
- There is no uniform capability contract test proving that every mutating capability declares risk, recovery behavior, and verification behavior.
- UI tests cover components and utilities, but the full taskpane lifecycle and future plan preview/run/outcome flow are not yet tested as an integrated state transition.
- Ordinary CI does not provide a real Excel host lane; several important behaviors are manual or bridge-based.
- Evaluation material exists as a strong proposal, but the task set is not yet a product release gate for Nyx behavior.
- There are no explicit property/fuzz tests for plan validation, hostile workbook content, malformed tool results, or cross-step state transitions.
- Performance budgets for startup, prompt context size, tool latency, and persistence cost are not enforced.

The evaluation proposal’s preference for deterministic workbook assertions, hidden data variants, escape-hatch rate, tool-error rate, destructive-edit count, and safety behavior is the right basis for Milestones 2–10.

## Milestone 2–10 bottlenecks

| Milestone | Likely bottleneck | Consequence if unaddressed |
| --- | --- | --- |
| 2 — Goal and plan | No typed objective/plan schema; prompt and taskpane carry too much policy. | Plans become prose, cannot be reliably previewed, validated, versioned, or approved. |
| 3 — Controlled execution | No immutable approved plan, step executor, or run-level target revalidation. | The agent can drift from what the user approved; partial failures are hard to contain. |
| 4 — Verification and explanation | No shared postcondition/evidence contract; audit explains mutations more readily than business outcomes. | Nyx may report plausible completion without proving the objective. |
| 5 — Business workflows | Skills are primarily guidance, not typed workflow definitions; semantic workbook model is incomplete. | Reusable workflows remain prompt recipes and break on layout variation. |
| 6 — Durable memory and recovery | IndexedDB sessions persist conversation/runtime state, not task/run state; recovery is primarily mutation-oriented. | Pause/resume, rollback, search, and cross-session accountability become unreliable. |
| 7 — Beyond spreadsheets | Host and tools are spreadsheet-centric; artifact, identity, capability, and verification abstractions are not yet medium-neutral. | Every new medium becomes a parallel architecture instead of an adapter. |
| 8 — Routing and operations | No task-level trace, cost, latency, or redacted event model. | Provider/model routing cannot be evaluated against business outcomes or safety. |
| 9 — Evaluation and quality | Evals are proposed but not a release gate with stable run IDs and deterministic reports. | Regressions in real business tasks remain anecdotal. |
| 10 — Scale | The taskpane composition root, bundle, browser main thread, and per-workbook coordination become central bottlenecks. | More capabilities increase startup cost, coupling, and operational fragility. |

## Refactoring recommendations

### 1. Introduce a Nyx domain boundary before adding plan behavior

Define pure, serializable domain contracts for `Objective`, `ContextSnapshot`, `Plan`, `PlanStep`, `Approval`, `Run`, `VerificationResult`, `RecoveryReference`, and `Outcome`. Include explicit versioning and legal state transitions. Keep these types independent of Office.js, Lit, model SDKs, and IndexedDB.

### 2. Extract application use cases from `initTaskpane`

Keep `src/taskpane/init.ts` as the composition root, but move lifecycle and product behavior into factories/use cases. The first useful seams are runtime construction, capability assembly, session restoration, and Nyx run orchestration. This can be incremental and additive; it does not require renaming existing Pi modules.

### 3. Define one capability contract

In addition to input and output schemas, a capability should expose host support, read/write classification, risk level, target scope, preconditions, observable effects, recovery strategy, and verification strategy. Existing tool wrappers can adapt to this contract before individual tools are reorganized.

### 4. Add a typed Workbook API seam

Implement the shared semantic range/address and workbook-object boundary identified in the tool redesign proposal. It should be usable by ordinary tools, the future plan executor, verifiers, and any constrained execution runner. Keep Office.js and WPS details behind adapters.

### 5. Separate conversation records from run records

A session may reference many objectives and runs. Persist run state, plan versions, approvals, step results, verification evidence, and recovery references separately from chat messages. Store only the minimum sensitive payload needed for recovery and explanation.

### 6. Establish task-level observability

Create a redacted event envelope with run ID, step ID, workbook identity hash, capability name, timing, policy decision, result status, verification status, and recovery reference. Do not record raw workbook values or credentials by default. This is necessary for debugging, evaluation, and support without adding telemetry of user content.

### 7. Make verification deterministic where possible

A verifier should read the relevant state, compare it with explicit postconditions, and return evidence plus a confidence/status classification. Model prose should summarize this record, not replace it.

### 8. Treat untrusted content as data

Mark workbook cells, comments, files, web content, and external records as untrusted inputs in the context model. The planner must not allow such content to change policy, approval state, provider credentials, or capability permissions.

### 9. Turn the eval proposal into an architecture gate

Use stable task IDs, fixture variants, deterministic assertions, transcript/tool logs, and safety assertions. Gate each new workflow or capability on task pass rate, collateral changes, verification quality, escape-hatch use, and efficiency—not on response fluency.

### 10. Set performance budgets before the UI grows

Track taskpane startup, first usable paint, initial model readiness, context payload size, tool latency, persistence latency, and bundle sizes. Make optional integrations and provider catalogs lazy where product behavior permits.

## Suggested module boundaries

The following is a target boundary, not a request to create all folders immediately.

```text
src/nyx/domain/
  objective.ts
  context-snapshot.ts
  plan.ts
  run.ts
  verification.ts
  outcome.ts
  policies.ts

src/nyx/application/
  create-plan.ts
  approve-plan.ts
  execute-run.ts
  verify-run.ts
  explain-outcome.ts
  run-state-machine.ts

src/nyx/adapters/
  agent-planner.ts
  workbook-capabilities.ts
  workbook-context.ts
  run-store.ts
  identity-and-clock.ts

src/workbook/api/
  semantic-addresses.ts
  workbook-objects.ts
  mutation-receipts.ts
  verification-readers.ts

src/observability/
  run-events.ts
  redaction.ts
  evaluation-export.ts
```

The existing `src/host`, `src/workbook`, `src/tools`, `src/models`, `src/storage`, `src/extensions`, `src/integrations`, `src/skills`, and `src/ui` modules should remain the implementation homes for current behavior. The new boundary should adapt them rather than duplicate them.

The UI should eventually expose Nyx state through focused components—objective/context summary, plan preview, approval controls, step progress, verification evidence, and outcome report—while `PiSidebar` remains the compatible host surface until a deliberate product transition is justified.

## Prioritized action list

### P0 — Before Milestone 2

1. Define the versioned Nyx run state machine and immutable plan/step identity.
2. Define objective, context snapshot, approval, verification, recovery, and outcome contracts.
3. Extract the first application seams from `src/taskpane/init.ts`; keep it as composition root only.
4. Define the capability contract for risk, effects, preconditions, postconditions, recovery, and host support.
5. Decide the security policy for `execute_office_js`, extension permissions, remote proxies, and WPS’s reduced recovery guarantees.
6. Add contract/evaluation fixtures for ambiguous requests, no-clobber behavior, partial failure, and inconclusive verification.
7. Establish run IDs, step IDs, redacted event envelopes, and performance measurements before introducing autonomous execution.

### P1 — Milestones 2–4

1. Build plan generation and validation behind the typed domain boundary.
2. Add plan preview and explicit approval without changing existing Pi chat behavior.
3. Execute only approved, immutable steps through existing coordinators and recovery mechanisms.
4. Add deterministic postcondition checks and evidence-backed outcome explanations.
5. Add freshness checks between capture, approval, and execution.
6. Add integrated UI tests and real-Excel evaluation coverage for the full objective-to-outcome slice.

### P2 — Milestones 5–7

1. Represent reusable workflows and skills as typed, testable workflow definitions rather than prompt-only recipes.
2. Establish the semantic Workbook API for tables, names, pivots, ranges, and report structures.
3. Separate artifact identity and capability adapters from Excel-specific assumptions.
4. Extend task persistence and recovery to pause, resume, cancel, partial success, and rollback semantics.
5. Make extension and external-integration permissions explicit, default-deny where appropriate, and visible in plans.

### P3 — Milestones 8–10

1. Add provider/model routing based on task requirements, privacy policy, evidence quality, latency, and cost.
2. Add operational dashboards or local reports derived from redacted run events and evals.
3. Introduce additional business mediums through adapters only after their identity, mutation, recovery, and verification contracts are defined.
4. Revisit naming and UI transitions only when the compatibility boundary and product release strategy are explicit.

## Compatibility guardrails

- Do not rename Pi runtime modules merely to make names look newer.
- Preserve existing chat, auto-context, sessions, providers, extensions, and tool behavior while Nyx orchestration is introduced.
- Keep current tool result fallbacks for older persisted sessions until a documented storage version transition exists.
- Reuse workbook coordination, approval, audit, recovery, output limits, host gates, and security policies rather than creating Nyx-specific bypasses.
- Keep the static prompt prefix stable when adding volatile run state; place run progress and context in the appropriate message tail or application state.
- Treat unsupported hosts and incomplete verification as explicit outcomes, never as silent success.

## Conclusion

Pi is not an architectural dead end. It is a capable substrate with the difficult spreadsheet-specific safety work already underway. The next step is to give that substrate a durable unit of responsibility: the Nyx run.

If Nyx establishes objective, plan, approval, execution, verification, recovery, and explanation as typed boundaries before adding autonomy, the existing investment can scale into a trustworthy business agent. If those concepts remain distributed across prompts, taskpane closures, tool metadata, and chat history, each milestone will increase coupling faster than capability.

The architecture should therefore optimize first for accountable progress: one bounded run, one clear plan, one evidence-backed outcome at a time.
