# EV — Current UI Design Context

This document records the UI that exists today. It is an extraction of the current implementation for design work in Figma; it is not a redesign brief and it does not define new product behavior.

The implementation is the authority. Some DOM classes retain `pi-` names for compatibility, but the visible product is EV.

## A. Product UI overview

EV is a narrow, vertically scrolling Excel task-pane application. The primary surface is a light-DOM Lit sidebar assembled by `PiSidebar`:

1. Optional session tabs and the utilities menu.
2. A scrollable conversation or empty state.
3. A working/streaming indicator.
4. An optional Excel selection card.
5. An optional Nyx planning/run card.
6. The chat composer with attachment, send, stop, and drag-and-drop behavior.
7. A compact status bar with model, context, execution mode, and related indicators.

Settings, provider login, model selection, files, recovery, extensions, rules, shortcuts, and experimental controls appear as overlays or nested settings pages rather than separate task-pane routes.

Primary composition and boot references:

- [src/ui/pi-sidebar.ts](../../src/ui/pi-sidebar.ts)
- [src/taskpane/init.ts](../../src/taskpane/init.ts)
- [src/taskpane.html](../../src/taskpane.html)
- [src/ui/theme.css](../../src/ui/theme.css)
- [src/ui/README.md](../../src/ui/README.md)

## B. Complete screen and state inventory

Only surfaces implemented in source are listed below.

### Main task pane and navigation

- Main `pi-sidebar` shell.
- Session-tab strip, when session tabs exist. Tabs support selection, creation, close, rename by double-click, reorder, duplicate, close-other, and a floating context menu.
- Utilities button with menu entries for Setup, Models, Extensions, Files, Rules, Resume, Backups, and Keyboard shortcuts.
- Scroll arrows for overflowing session tabs.
- The application has no separate top navigation bar inside the pane.

Source: [src/ui/pi-sidebar.ts](../../src/ui/pi-sidebar.ts), [src/ui/theme/components/tabs.css](../../src/ui/theme/components/tabs.css), [src/ui/theme/components/menus.css](../../src/ui/theme/components/menus.css).

### Empty state

When the active session has no messages, the pane shows:

- A low-opacity `EV` wordmark.
- A localized tagline.
- A vertical list of clickable prompt hints, each with a label and shortened prompt preview.

The logo is hidden in short-height task panes. Hint cards use the same translucent/card language as the composer and selection card.

Source: `PiSidebar._renderEmptyState()` in [src/ui/pi-sidebar.ts](../../src/ui/pi-sidebar.ts), [empty-state.css](../../src/ui/theme/components/empty-state.css).

### Chat interface

- User messages are right-aligned translucent cards.
- Assistant content is left-aligned and rendered as ordered text, thinking, and tool-call parts.
- Markdown supports headings, prose, lists, code, links, tables, and content-specific renderers.
- Attachments render as compact image/document tiles inside user messages.
- Tool calls render as tool cards; pending, completed, error, and fallback tool states exist.
- Streaming messages render in a separate streaming container while the agent is active.
- Assistant errors appear as a red inline error row; aborted turns show an aborted label.

Sources: [src/ui/messages/messages.ts](../../src/ui/messages/messages.ts), [src/ui/messages/message-list.ts](../../src/ui/messages/message-list.ts), [src/ui/messages/streaming-message-container.ts](../../src/ui/messages/streaming-message-container.ts), [src/ui/messages/markdown-block.ts](../../src/ui/messages/markdown-block.ts), [src/ui/theme/content/messages.css](../../src/ui/theme/content/messages.css), [src/ui/theme/content/tool-cards.css](../../src/ui/theme/content/tool-cards.css).

### Composer

The composer is a rounded card containing:

- Attachment button on the left.
- Auto-growing textarea in the center.
- Send button on the right when idle.
- Stop/abort button on the right while streaming.
- A drag-over drop hint when files are dragged over the card.

Enter sends; Shift+Enter inserts a line break. Escape aborts an active stream unless another overlay claims Escape. The textarea grows up to `40vh`, with a shorter-height adjustment below 520px.

Source: [src/ui/pi-input.ts](../../src/ui/pi-input.ts), [input.css](../../src/ui/theme/components/input.css).

### Excel range selection

The selection card is shown in the input area and has these actual states:

- Instruction: asks the user to capture a selection.
- Loading: shows a loading message while reading Excel context.
- Captured: shows a localized “captured” label, the qualified range address, a bounded text preview, Refresh, Clear, and `Plan with Nyx` actions.
- Error: shows an error message and Retry/Capture action.

The captured card is a compact translucent pill/card. The address uses the monospace font; the preview is a scrollable bounded region with smaller text. Planning and running disable the Nyx start action.

Source: `PiSidebar._renderSelectionCard()` in [src/ui/pi-sidebar.ts](../../src/ui/pi-sidebar.ts), [selection.css](../../src/ui/theme/components/selection.css), [src/context/selection-snapshot.ts](../../src/context/selection-snapshot.ts).

### Nyx planning and controlled execution

The current Nyx card is rendered only when Nyx state is active. Implemented states are:

- Planning: objective and planning label.
- Clarification: questions, Needs clarification label, Revise action.
- Error: error message and Try again action.
- Planned: objective, status, assumptions, affected areas, ordered steps, capabilities/targets, and Approve/Revise/Reject actions.
- Approved: approved status and run information where present.
- Running: current progress and Cancel action.
- Execution complete: completion status plus a visible “verification pending” notice when no verification exists.
- Failed: failure reason.
- Cancelled: cancelled status.
- Verification passed, failed, or inconclusive notices when verification data exists.
- Rollback complete or rollback failed notices when rollback data exists.

The run progress uses compact step labels with `✓`, `!`, and `•`. Recovery exposes a Rollback action when an eligible checkpoint exists.

Source: [src/ui/nyx-plan-card.ts](../../src/ui/nyx-plan-card.ts), [nyx-plan.css](../../src/ui/theme/components/nyx-plan.css), [src/nyx/ui-state.ts](../../src/nyx/ui-state.ts).

### Loading and working states

Startup loading uses a centered two-ring spinner and uppercase monospace loading label. Runtime work uses `pi-working-indicator`: a rotating EV/work phrase plus a monospace hint, or a fixed pill with spinner for non-streaming busy work. The working text crossfades during rotation.

Sources: [src/ui/loading.ts](../../src/ui/loading.ts), [src/ui/working-indicator.ts](../../src/ui/working-indicator.ts), [empty-state.css](../../src/ui/theme/components/empty-state.css), [working-indicator.css](../../src/ui/theme/components/working-indicator.css).

### Model/provider selector and Ollama state

The status bar contains the model picker. It shows an EV mark, selected model name, and chevron. Clicking opens the model selector overlay with search, provider/model rows, and selection behavior. Provider-specific login/configuration is handled separately in provider pages and login dialogs.

Ollama is represented as a local provider in the same selector/catalogue. Its user-visible states are available, empty/no models, unavailable/stopped, discovery failure, and refresh/recovery. Local Ollama uses the same-origin local relay in the secure Excel WebView; it is not represented as a remote proxy provider.

Sources: [src/ui/model-selector-dialog.ts](../../src/ui/model-selector-dialog.ts), [src/models/local-providers.ts](../../src/models/local-providers.ts), [src/models/browser-model-runtime.ts](../../src/models/browser-model-runtime.ts), [src/ui/theme/components/status-bar.css](../../src/ui/theme/components/status-bar.css), [src/ui/theme/overlays/primitives.css](../../src/ui/theme/overlays/primitives.css).

### Status indicators and banners

The status bar can show:

- Current model/provider picker.
- Context usage percentage and token limit, with yellow/red threshold states.
- Execution mode (`Auto`/`Confirm`) indicator.
- Session lock state.
- Proxy/local-service indicators where applicable.
- Clickable affordances and compact popovers for details.

The proxy banner is a separate dismissible/status surface and is provider-aware. Toasts provide transient success, warning, and error feedback.

Sources: [src/ui/theme/components/status-bar.css](../../src/ui/theme/components/status-bar.css), [src/ui/proxy-banner.ts](../../src/ui/proxy-banner.ts), [src/ui/toast.ts](../../src/ui/toast.ts), [src/ui/theme/components/toasts.css](../../src/ui/theme/components/toasts.css).

### Settings and nested navigation

Settings is one navigable overlay shell with a header, back button, page title/subtitle, scrollable body, and optional sticky footer. Current pages are:

- Root
- Providers
- Gateway
- Proxy
- Rules
- Backups
- Connections
- Plugins
- Skills
- Shortcuts
- Experimental

The root page groups AI providers, rules/data, extensions, and appearance/behavior controls. Existing controls include execution mode, model-switch behavior, theme mode, accent color, and the English-only language selector.

Sources: [src/commands/builtins/settings-pages/index.ts](../../src/commands/builtins/settings-pages/index.ts), [root-page.ts](../../src/commands/builtins/settings-pages/root-page.ts), [src/ui/settings-shell.ts](../../src/ui/settings-shell.ts), [src/ui/settings-rows.ts](../../src/ui/settings-rows.ts), [settings-shell.css](../../src/ui/theme/overlays/settings-shell.css).

### Dialogs and overlays

Implemented overlay/dialog surfaces include:

- Settings shell.
- Model selector.
- Provider/API-key login and OAuth flows.
- Confirmation dialog.
- Generic overlay dialog.
- Text-input dialog.
- Files workspace dialog.
- Recovery/backups overlay.
- Resume/session picker.
- Provider resume/shortcut surfaces.
- Extensions hub and extension permissions/connection pages.
- Experimental controls.
- Web-search setup card.
- Bridge setup card.

Sources: [src/ui](../../src/ui), [src/ui/theme/dialogs.css](../../src/ui/theme/dialogs.css), [src/ui/theme/overlays.css](../../src/ui/theme/overlays.css), [src/ui/theme/overlays](../../src/ui/theme/overlays).

### Icons, badges, and controls

Icons are primarily Lucide icons rendered by [src/ui/icons.ts](../../src/ui/icons.ts) and [src/ui/lucide-icons.ts](../../src/ui/lucide-icons.ts). The current UI uses compact icon buttons, text buttons, pill badges, status labels, numbered plan steps, lock/busy indicators, chevrons, close buttons, and spinners. EV's empty-state mark is text `EV`; product icon assets are under [public/assets](../../public/assets).

## C. Component inventory

| Component/surface | Current implementation | Styling |
|---|---|---|
| Sidebar shell | `PiSidebar` | `components.css`, tabs, menus, status |
| Session tabs | `PiSidebar` render methods | `tabs.css` |
| Utilities/context menus | `PiSidebar` render methods | `menus.css` |
| Empty state | `PiSidebar._renderEmptyState` | `empty-state.css` |
| Chat messages | `user-message`, `assistant-message`, `tool-message` | `content/messages.css`, `tool-cards.css` |
| Markdown/code | `markdown-block`, `code-block` | `message-components.css`, `tool-card-markdown.css` |
| Thinking | `thinking-block` | message/content styles |
| Streaming | `streaming-message-container` | message/content styles |
| Composer | `pi-input` | `components/input.css` |
| Excel selection | `PiSidebar._renderSelectionCard` | `components/selection.css` |
| Nyx plan/run | `nyx-plan-card` | `components/nyx-plan.css` |
| Working indicator | `pi-working-indicator` | `components/working-indicator.css` |
| Status bar | runtime-mounted status bar | `components/status-bar.css` |
| Model selector | `model-selector-dialog` | status/overlay CSS |
| Settings | settings shell/pages/rows | `overlays/settings-shell.css`, `settings.css` |
| Toasts | `showToast` | `components/toasts.css` |
| Dialogs | overlay/dialog primitives | `dialogs.css`, `overlays/` |
| Provider setup | provider login/API key UI | provider source and overlay CSS |
| Files/bridge/search setup | dedicated setup/dialog components | component-specific CSS |

## D. Current design tokens

The canonical token source is [src/ui/theme/tokens.css](../../src/ui/theme/tokens.css). The CSS theme imports it first through [src/ui/theme.css](../../src/ui/theme.css). There are 126 defined theme variables and a number of component-local literal values; do not assume every literal is a global token.

### Typography

| Token | Current value |
|---|---|
| `--font-sans` | `'DM Sans', ui-sans-serif, system-ui, -apple-system, sans-serif` |
| `--font-mono` | `'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace` |
| `--text-xs` | `10px` |
| `--text-sm` | `12px` |
| `--text-base` | `13px` |
| `--text-md` | `15px` |
| `--text-lg` | `18px` |
| `--text-display` | `40px` (logo/hero marks only) |
| Common weights | 400 body, 500 working text, 600 controls/subheadings, 700 labels/headings/plan numbers |

The code does not define a bundled web-font loading mechanism in the inspected UI source; the declared font stack falls back to platform/system fonts when unavailable.

### Shape and motion

| Token | Current value |
|---|---|
| `--radius-xs` | `4px` |
| `--radius-sm` | `8px` |
| `--radius-md` | `12px` |
| `--radius-lg` | `16px` |
| `--radius-xl` | `20px` |
| `--radius-full` | `999px` |
| `--pill-radius` | `var(--radius-lg)` |
| `--duration-fast` | `0.12s` |
| `--duration-normal` | `0.2s` |

Frequent current component spacing is 4–16px: 4px controls, 6–8px compact gaps, 9–12px card padding, 12px message gaps, and 16px message gutters. Larger empty-state spacing includes 24px above hint cards. These values are defined in component CSS rather than a spacing scale.

### Light theme palette

Defined under `:root` in `tokens.css`:

| Token | Value |
|---|---|
| `--background` | `oklch(0.985 0.002 90)` |
| `--foreground` | `oklch(0.18 0 0)` |
| `--card` | `oklch(1 0 0 / 0.75)` |
| `--popover` | `oklch(1 0 0 / 0.85)` |
| `--secondary` | `oklch(0.96 0.004 90)` |
| `--muted` | `oklch(0.96 0.003 90)` |
| `--muted-foreground` | `oklch(0.50 0 0)` |
| `--border` | `oklch(0.92 0.004 90)` |
| `--input` | `oklch(0.95 0.003 90)` |
| `--ring` | `oklch(0.52 0.11 172)` |
| `--sidebar` | `oklch(0.98 0.002 90)` |
| `--destructive` | `oklch(0.55 0.22 25)` |
| `--pi-yellow` | `oklch(0.72 0.16 84)` |

Light default accent is orange: `--ev-accent: oklch(0.68 0.18 55)`, hover `oklch(0.61 0.19 55)`, muted alpha `.12`, contrast `oklch(0.18 0.02 55)`.

### Dark theme palette

Defined under `.dark` in `tokens.css`:

| Token | Value |
|---|---|
| `--background` | `oklch(0.19 0.01 260)` |
| `--foreground` | `oklch(0.94 0.005 260)` |
| `--card` | `oklch(0.24 0.015 260 / 0.88)` |
| `--popover` | `oklch(0.22 0.014 260 / 0.92)` |
| `--secondary` | `oklch(0.28 0.01 260)` |
| `--muted` | `oklch(0.27 0.01 260)` |
| `--muted-foreground` | `oklch(0.72 0.01 260)` |
| `--border` | `oklch(0.33 0.01 260)` |
| `--input` | `oklch(0.29 0.01 260)` |
| `--ring` | `oklch(0.68 0.12 172)` |
| `--sidebar` | `oklch(0.2 0.012 260)` |
| `--destructive` | `oklch(0.63 0.22 25)` |
| `--pi-yellow` | `oklch(0.79 0.14 84)` |

Dark default accent is orange: `--ev-accent: oklch(0.76 0.16 55)`, hover `oklch(0.82 0.14 55)`, muted alpha `.20`, contrast `oklch(0.16 0.02 55)`.

### Surfaces, borders, shadows, and alpha tokens

The current visual language is translucent “pill” and liquid-glass surfaces:

- `--pill-border`: 1px `var(--alpha-8)` in light; 1px `var(--alpha-12)` in dark.
- `--pill-bg`: white at 85% in light; dark card at 88% in dark.
- `--pill-shadow`: light `0 1px 4px var(--alpha-4)` plus a white inset highlight; dark `0 1px 6px` black shadow plus a subtle white inset.
- `--glass-blur`: `blur(3px) saturate(1.6) brightness(1.04)`.
- `--glass-blur-dropdown`: `blur(16px) saturate(1.5) brightness(1.03)`.
- `--glass-blur-heavy`: `blur(10px) saturate(1.5) brightness(1.02)`.
- `--glass-shadow`: light 2px/0.5px shadow; dark 3px/1px black shadow.
- `--glass-shadow-lg`: light 12px/2px shadow; dark 16px/4px shadow.
- `--glass-border`: translucent white edge, with dark value `1px solid oklch(1 0 0 / 0.14)`.
- Alpha tokens range from `--alpha-2` through `--alpha-25`; green alpha tokens range from 6% through 30%; white alpha tokens range from 20% through 90%.

State colors are primarily `--primary`/accent for active and success-like states, `--destructive` for errors/abort, `--pi-yellow` for context warnings, and green-alpha backgrounds/borders for active/focus/complete states. Component-specific CSS adds exact state colors where necessary.

### Component state styling

- Hover: usually background tint plus border tint; transitions use `0.12s`.
- Focus: visible 2px green-alpha ring or inset ring.
- Active/primary: `var(--pi-green)`/`var(--primary)` background with white text for compact primary buttons.
- Disabled: opacity around `.35–.55`, default cursor, no hover transform.
- Error: destructive text, pale destructive background, or red tool/card border.
- Warning: yellow text in context indicators and amber alpha surfaces.
- Success/complete: primary/green text and green alpha surfaces.
- Reduced motion: settings page transitions are removed under `prefers-reduced-motion: reduce`; other component animations should be treated as existing behavior and preserved.

## E. Theme system

Theme behavior is product functionality and must remain stable during redesign.

- Supported modes: `light`, `dark`, and `system` (`AppearanceMode` in [src/ui/appearance.ts](../../src/ui/appearance.ts)).
- Default appearance: `dark` mode with `orange` accent.
- Appearance persistence key: `appearance.v1`, stored through the application settings store.
- `loadAppearanceSettings()` restores and validates the persisted object; invalid values fall back to defaults.
- `saveAppearanceSettings()` persists first and then applies the validated settings.
- `setAppearanceSettings()` updates `document.documentElement.dataset.evAccent` and dispatches `ev:appearance-changed`.
- [src/ui/theme-mode.ts](../../src/ui/theme-mode.ts) owns runtime dark-class synchronization. It applies the selected mode, listens to system media changes for `system`, reacts to appearance changes, and retries Office host theme detection when Office.js becomes ready.
- The dark class is also subject to the existing experimental dark-mode gate described in the theme-mode implementation. A redesign must not remove or bypass that gate.
- Theme CSS variables are defined in [src/ui/theme/tokens.css](../../src/ui/theme/tokens.css), with component rules imported by [src/ui/theme.css](../../src/ui/theme.css).

## F. Accent system

Available accent values are:

| Accent | Light accent | Dark accent |
|---|---|---|
| Orange | `oklch(0.68 0.18 55)` | `oklch(0.76 0.16 55)` |
| Blue | `oklch(0.58 0.18 250)` | `oklch(0.72 0.16 250)` |
| Purple | `oklch(0.58 0.19 300)` | `oklch(0.72 0.16 300)` |
| Green | `oklch(0.55 0.15 155)` | `oklch(0.70 0.14 155)` |
| Red | `oklch(0.58 0.20 25)` | `oklch(0.72 0.18 25)` |

Each accent also defines hover and muted variants in [tokens.css](../../src/ui/theme/tokens.css). The selectors are `:root[data-ev-accent="..."]` for light mode and `.dark[data-ev-accent="..."]` for dark mode.

The selected accent is persisted inside `appearance.v1` and applied as the `data-ev-accent` attribute on the root element. Components consume the shared `--ev-accent`, `--ev-accent-hover`, `--ev-accent-muted`, `--primary`, and related `--pi-green*` aliases; components should not hard-code a replacement accent. The current settings UI exposes all five values through the Appearance group in [root-page.ts](../../src/commands/builtins/settings-pages/root-page.ts).

Contrast is handled by separate accent-contrast tokens for the default orange palette; alternate accent selectors inherit the existing primary foreground unless component-specific rules override it. Figma work must preserve readable text and focus states for every accent, but should not silently change this behavior.

## G. Responsive and Excel task-pane constraints

EV runs inside a narrow Excel task pane, not a full browser canvas.

- The sidebar is designed around roughly 350px of width; content must remain usable below that.
- Main conversation content scrolls vertically.
- Settings and long overlays have their own bounded scroll region; the settings shell uses `max-height: 82vh`.
- The composer is anchored in the lower input area and the textarea is capped at `40vh`.
- Session tabs may overflow horizontally and expose scroll controls.
- Selection previews are bounded to 108px high.
- Long addresses, model names, tool names, and status values truncate rather than widening the pane.
- At `max-height: 520px`, empty-state logo/hint previews are reduced and composer sizing is compacted.
- Keyboard behavior is meaningful: Enter sends, Shift+Enter creates a newline, Escape aborts or navigates overlays, and tab/menu controls are keyboard-addressable.
- Focus rings and readable dark-mode contrast are required. Avoid hover-only actions.
- Scroll containment and auto-scroll behavior in the message pane are intentional; redesigns must preserve predictable reading position while streaming.

Relevant sources: [src/ui/theme/base.css](../../src/ui/theme/base.css), [src/ui/theme/components/input.css](../../src/ui/theme/components/input.css), [src/ui/theme/components/tabs.css](../../src/ui/theme/components/tabs.css), [src/ui/theme/overlays/settings-shell.css](../../src/ui/theme/overlays/settings-shell.css), [src/ui/pi-sidebar.ts](../../src/ui/pi-sidebar.ts).

## H. Interaction and state inventory

| Surface | States/interactions currently present |
|---|---|
| Startup | loading spinner, loading label, startup error |
| Empty chat | EV mark, tagline, prompt hint buttons |
| Chat | idle, streaming, aborted, assistant error, tool pending/completed/error |
| Composer | empty/disabled send, typed/enabled send, multiline auto-grow, drag-over, streaming stop |
| Selection | instruction, loading, captured, refresh, clear, plan, error/retry |
| Nyx | planning, clarification, error, planned, approved, running, complete-unverified, failed, cancelled, verification notices, rollback notices |
| Model selector | closed/open, search, provider/model rows, selected model, local Ollama available/empty/unavailable/error |
| Status bar | normal, context warning/red threshold, execution modes, session lock waiting/active, popovers |
| Tabs | active/inactive, busy, lock waiting/holding, overflow, context menu, close disabled/enabled |
| Settings | root/nested page, forward/back transition, close/backdrop/Escape, optional unsaved-change guard, sticky footer |
| Controls | hover, focus-visible, active/primary, disabled, destructive/error |
| Theme | light, dark, system, runtime switch, persisted restore |
| Accent | orange, blue, purple, green, red, persisted restore |

## I. Screenshots/evidence

No screenshot assets are added by this documentation-only package. The current UI can be rendered from the existing UI Gallery at [src/ui-gallery.html](../../src/ui-gallery.html) and the task pane at [src/taskpane.html](../../src/taskpane.html) using the repository’s documented verification scripts. Real Excel/WKWebView validation has been performed previously, but no screenshot was captured into the repository for this context package.

## J. Exact source references

Important files for Figma inspection:

- Layout/composition: [src/ui/pi-sidebar.ts](../../src/ui/pi-sidebar.ts)
- Composer: [src/ui/pi-input.ts](../../src/ui/pi-input.ts)
- Messages: [src/ui/messages/messages.ts](../../src/ui/messages/messages.ts)
- Selection: [src/context/selection-snapshot.ts](../../src/context/selection-snapshot.ts), [src/ui/theme/components/selection.css](../../src/ui/theme/components/selection.css)
- Nyx plan/run card: [src/ui/nyx-plan-card.ts](../../src/ui/nyx-plan-card.ts), [src/ui/theme/components/nyx-plan.css](../../src/ui/theme/components/nyx-plan.css)
- Model/provider selector: [src/ui/model-selector-dialog.ts](../../src/ui/model-selector-dialog.ts)
- Settings: [src/ui/settings-shell.ts](../../src/ui/settings-shell.ts), [src/commands/builtins/settings-pages](../../src/commands/builtins/settings-pages)
- Appearance: [src/ui/appearance.ts](../../src/ui/appearance.ts), [src/ui/theme-mode.ts](../../src/ui/theme-mode.ts)
- Tokens: [src/ui/theme/tokens.css](../../src/ui/theme/tokens.css)
- Theme entrypoint: [src/ui/theme.css](../../src/ui/theme.css)
- Component styles: [src/ui/theme/components](../../src/ui/theme/components)
- Content styles: [src/ui/theme/content](../../src/ui/theme/content)
- Overlay/dialog styles: [src/ui/theme/overlays](../../src/ui/theme/overlays), [src/ui/theme/dialogs.css](../../src/ui/theme/dialogs.css)
- Icons: [src/ui/icons.ts](../../src/ui/icons.ts), [src/ui/lucide-icons.ts](../../src/ui/lucide-icons.ts)
- Localization: [src/language/locales/en.json](../../src/language/locales/en.json)

## Figma handoff rules

Use this document to reproduce the current implementation before proposing alternatives. Keep the narrow task-pane layout, the light/dark/system behavior, the persisted accent control, the selection and Nyx state surfaces, keyboard behavior, high-contrast states, and predictable scrolling intact. Any visual redesign must be explicitly distinguishable from a functional change.
