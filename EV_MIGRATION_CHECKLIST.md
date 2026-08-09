# EV Migration Checklist

This checklist records the product rebrand from Pi for Excel to EV while preserving the existing runtime, storage, extension, and provider contracts.

## Product-facing surfaces

- [ ] Task pane document title and loading experience
- [ ] Welcome/login branding and provider guidance
- [ ] Localized UI copy in English and Simplified Chinese
- [ ] System-prompt identity and user-facing agent language
- [ ] Landing page, architecture page, OAuth callback page, and UI gallery
- [ ] Excel manifests and ribbon labels
- [ ] WPS ribbon labels, task-pane messages, and icon
- [ ] Package name, description, repository metadata, and public documentation
- [ ] Product icons and favicon assets
- [ ] Bridge and proxy user-facing instructions

## Compatibility boundary

The following identifiers are internal contracts and remain unchanged unless a compatibility-preserving alias is added and verified:

- `@earendil-works/pi-*` dependency names and imports
- `pi-*` custom-element names, CSS selectors, and theme variable names
- Existing `pi:` DOM events and persisted storage keys
- Existing extension API names and WPS callback names
- Existing bridge executable names and legacy command-line entry points
- Existing session, workbook, recovery, and provider persistence schemas
- Historical release notes, smoke evidence, and test fixtures describing prior versions

## Runtime review targets

- [ ] Default model selection always resolves to a supported model
- [ ] Provider switching reconciles the active runtime after login/logout
- [ ] Startup sequencing handles missing Office APIs and storage failures cleanly
- [ ] OAuth callback capture reports actionable failures without rejecting startup
- [ ] Async initialization cannot overwrite newer provider/session state
- [ ] Error boundaries preserve the existing sidebar and recovery paths

## UI quality targets

- [ ] EV mark is used consistently in product-facing surfaces
- [ ] Loading uses a quiet EV spinner rather than legacy animated branding
- [ ] Light and dark themes use consistent spacing, contrast, and card treatment
- [ ] Existing workflows and keyboard interactions remain unchanged
- [ ] UI gallery covers the rebranded loading and welcome states

## Validation gates

Each phase must pass before the next begins:

- [ ] Relevant focused tests
- [ ] Full test suite
- [ ] `npm run check`
- [ ] `npm run build`
- [ ] UI gallery verification where visual surfaces changed
- [ ] Manual Excel/WPS smoke testing where host behavior changed
