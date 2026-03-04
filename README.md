# Docs Agent

`docs-agent` is a VS Code extension that updates project documentation from Git changes.

It analyzes your repository diff, builds a documentation plan, previews proposed changes as side-by-side diffs, and applies updates only after explicit approval.

## Features

- Detects changed files from Git (staged, unstaged, and untracked)
- Builds a rules-based documentation plan with evidence
- Generates in-memory patches before writing files
- Shows preview diffs in VS Code (`vscode.diff`)
- Applies changes only after confirmation
- Updates only managed marker blocks when markers already exist
- Creates docs skeleton files when missing
- Adds Java-aware signals:
  - New endpoint mappings (`@GetMapping`, `@PostMapping`, `@RequestMapping`, etc.)
  - Service behavior edits
  - DTO contract changes

## Managed docs

The extension manages these files:

- `README.md` (technical overview marker block)
- `docs/00-business-overview.md`
- `docs/01-glossary.md`
- `docs/10-architecture.md`
- `docs/11-api-endpoints.md`
- `docs/20-service-behavior.md`
- `docs/30-dto-contracts.md`

## Requirements

- Node.js 22+
- npm
- Git installed and available on `PATH`
- Opened folder must be inside a Git repository

## Install and run (development)

```bash
npm install
npm run compile
```

In VS Code:

1. Open this project folder.
2. Press `F5` (Run Extension) to launch an Extension Development Host.
3. Open a Git repo in the extension host window and run commands from Command Palette.

## How to use

Commands:

- `Docs Agent: Preview docs update from git changes`
- `Docs Agent: Apply docs update from git changes`

Typical flow:

1. Make code changes in a Git repo.
2. Run preview command.
3. Review generated plan and side-by-side diffs.
4. Run apply command and accept modal confirmation.

Configuration:

- `docsAgent.mode`:
  - `rules` (default)
  - `ai` (guardrailed marker-only mode with evidence block)

## Testing

Quick commands:

```bash
npm run check-types
npm run lint
npm test
```

The test suite currently uses Node's built-in test runner over compiled tests in `out/test/*.test.js`.

## Project docs

- Usage guide: [`docs/USAGE.md`](docs/USAGE.md)
- Testing guide: [`docs/TESTING.md`](docs/TESTING.md)

## Limitations

- AI mode is currently guardrailed but still backed by local rule-based planning.
- Java analysis is heuristic-based and annotation/path driven.
