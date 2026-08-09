# EV — Figma Make Prompt

Create a visual redesign of the existing EV Microsoft Excel task-pane UI using the current implementation as the source of truth.

The existing EV implementation is the source of truth.
Redesign visual appearance only.
Do not invent features.
Do not remove existing functionality.

Preserve the current narrow Excel task-pane constraints and all existing interaction states: startup loading/error, empty chat, session tabs and menus, chat messages, markdown, tool cards, streaming/thinking states, attachment and stop controls, Excel selection instruction/loading/captured/error states, Nyx planning/clarification/error/planned/approved/running/completed/failed/cancelled/verification/rollback states, model/provider selection including local Ollama states, status indicators, toasts, dialogs, settings navigation, provider login, files, recovery, extensions, rules, shortcuts, and experimental controls.

Use the current design context in `docs/design/EV_FIGMA_CONTEXT.md`. Preserve the existing light, dark, and system theme behavior, appearance persistence, English-only language behavior, and the five persisted accent choices: orange, blue, purple, green, and red. Keep readable contrast and visible keyboard focus for every theme/accent combination.

Design for a narrow, scrollable Excel sidebar: compact controls, readable 10–15px body text, short labels, truncated long values, bounded previews, stable composer placement, predictable message auto-scroll, and accessible mouse/keyboard interactions. Keep the existing EV visual vocabulary—translucent cards, compact pills, subtle borders/shadows, Lucide-style icons, and restrained motion—unless changing visual styling is necessary for a coherent redesign.

Do not change providers, Ollama, Nyx planning/execution, Excel integration, authentication, persistence, tool behavior, task execution, state transitions, localization behavior, or application architecture. Produce only visual design artifacts and component variants that map directly to surfaces already documented in the current implementation.
