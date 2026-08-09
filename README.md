# EV

EV is an open-source AI workspace inside Microsoft Excel. Describe a business goal in plain language, let EV inspect the workbook, and review or perform the resulting spreadsheet work with recovery support.

## What EV does

- Reads sheets, ranges, formulas, tables, charts, and workbook structure.
- Answers questions about the current workbook and selection.
- Writes values and formulas, formats cells, and performs supported workbook operations.
- Creates checkpoints before mutations so changes can be reviewed or reverted.
- Supports local Ollama models and remote providers with your own account or API key.
- Keeps sessions, workbook context, appearance settings, rules, and provider choices locally in the browser.

EV is an Excel add-in, not a standalone spreadsheet editor. It does not send workbook data to a remote EV service by default.

## Requirements

For the hosted add-in, you need:

- Microsoft Excel with Office Add-ins enabled.
- An AI provider account, API key, or a local Ollama model.

For local development or self-hosting, you also need:

- Node.js 24.x (the tested version is in [.nvmrc](.nvmrc)).
- npm and a trusted local HTTPS certificate. Office task panes require HTTPS.
- macOS or Windows for the supported Excel development workflow.

## Installation

### Use the hosted add-in

1. Download [`manifest.prod.xml`](https://ev-excel.vercel.app/manifest.prod.xml).
2. Upload it to Excel using Microsoft’s [Office Add-ins installation guide](docs/install.md).
3. Open **EV** from the Excel ribbon.
4. Choose a provider and sign in or add its API key.
5. Select a range, or start with a question such as “What sheets do I have?”

### Run EV locally

Clone the repository, install dependencies, and run the setup checks:

```bash
git clone https://github.com/tmustier/nyx.git
cd nyx
npm install
npm run setup
```

`npm run setup` validates Node, dependencies, and optional Ollama state. It never installs Ollama or downloads a model silently.

Local Excel development additionally needs trusted certificates named `cert.pem` and `key.pem` in the repository root. With [mkcert](https://github.com/FiloSottile/mkcert):

```bash
mkcert -install
mkcert localhost
mv localhost-key.pem key.pem
mv localhost.pem cert.pem
```

The certificate files are ignored by Git and must never be committed.

## Start EV in Excel

For a browser-only local task pane:

```bash
npm run dev
```

For the supported macOS/Windows Excel sideload flow:

```bash
npm run dev:excel
```

This validates the manifest and HTTPS task pane, starts or reuses the local server, sideloads the development manifest, and launches Excel. Keep the terminal running while using EV. Stop the supported debugging session with:

```bash
npm run stop
```

The development manifest points to `https://localhost:3141`. The production manifest points to the hosted deployment.

## Choose an AI provider

Open the model selector in EV’s header. Provider availability is shown there:

- **Ollama** — local and free to run; no EV proxy or API key is required.
- **Anthropic, OpenAI, Google Gemini, and GitHub Copilot** — require the provider’s own account, OAuth login, or API key.
- **Custom OpenAI-compatible gateways** — configure an endpoint and credentials in Settings.

Remote provider requests retain their provider-specific authentication and proxy requirements. EV does not make paid providers free.

## Using Ollama locally

Ollama is optional. Install it from [ollama.com](https://ollama.com/download), then explicitly install a compatible model:

```bash
ollama pull qwen3:4b
npm run doctor
npm run test:ollama
```

EV discovers local models from Ollama and lists them in the model selector. In an Excel WebView, requests use EV’s local HTTPS relay and remain on the machine; they do not use the remote EV proxy.

If Ollama is stopped, EV reports that it is unavailable. If it has no models, EV explains that a model must be installed. Start Ollama or add a model, then refresh the model list.

## Your first Excel task

Open a workbook and try:

> Create a score board for 10 students with Math and English scores randomized from 0 to 100 in the current worksheet.

Before any supported mutation, EV may ask for confirmation depending on the selected execution mode. Review the affected range and approve only when it is correct. Then ask:

> Read the score board and tell me the average Math score.

Use the recovery controls in the sidebar if you need to inspect or revert a workbook change.

## Themes and customization

Use Settings to change light, dark, or system appearance and select an accent color. The model selector, selection context, sessions, rules, extensions, integrations, and recovery controls are available from the existing EV menus and commands.

## Troubleshooting

- **EV does not load:** confirm the add-in manifest URL is correct and restart Excel. For local development, run `npm run ev:doctor -- --check`.
- **Certificate error:** generate trusted `cert.pem` and `key.pem` with mkcert, then retry `npm run dev:excel`.
- **Ollama unavailable:** start Ollama, run `ollama list`, and refresh models in EV.
- **No Ollama model:** run `ollama pull qwen3:4b`; EV never downloads models automatically.
- **Provider login fails:** verify the provider account and credentials. OAuth-based providers may require the optional local HTTPS proxy: `npm run proxy:https`.
- **Excel opens an old task pane:** stop and restart EV, fully quit Excel, and sideload `manifest.xml` again. Do not delete caches while unsaved work is open.
- **Port 3141 is busy:** stop the process that owns the port or use the supported EV development workflow again.
- **A workbook change fails:** read the displayed error, confirm the selected range and workbook are still available, and retry only after the cause is understood.

## Development

Useful commands:

| Command | Purpose |
|---|---|
| `npm run setup` | Validate prerequisites and optional local services |
| `npm run doctor` | Print local runtime and provider diagnostics |
| `npm run ev:doctor -- --check` | Validate server, manifest, assets, and release checks |
| `npm run dev` | Start the HTTPS Vite task pane |
| `npm run dev:excel` | Start EV and sideload it into Excel |
| `npm run stop` | Stop EV’s supported Office debugging session |
| `npm test` | Run the complete automated suite |
| `npm run check` | Run lint, type, CSS, and repository checks |
| `npm run build` | Produce the production bundle |
| `npm run test:ollama` | Test the local Ollama integration |
| `npm run validate` | Validate the Office manifest |

The UI is first-party Lit code. Core model and agent runtime dependencies are maintained upstream and retained under their original package names for compatibility and attribution. See [ARCHITECTURE.md](ARCHITECTURE.md), [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md), and [docs/README.md](docs/README.md) for deeper project documentation.

## License

EV is distributed under the [MIT License](LICENSE). The copyright and attribution notice in that license must remain with distributed copies.

## Third-party licenses

EV includes or depends on open-source components under their respective licenses. See package metadata, `package-lock.json`, and source attribution headers for dependency-specific notices. Vendored storage helpers retain their upstream MIT attribution.
