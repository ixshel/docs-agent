# Docs Agent Usage

## Overview

Docs Agent reads Git changes and proposes updates to managed documentation files.  
It creates patches in memory, shows preview diffs, and only writes files when you explicitly accept.

## Commands

Use the VS Code Command Palette (`Cmd+Shift+P` on macOS, `Ctrl+Shift+P` on Windows/Linux):

- `Docs Agent: Preview docs update from git changes`
- `Docs Agent: Apply docs update from git changes`

## Recommended workflow

1. Make your code changes.
2. Keep your workspace inside a Git repository.
3. Run preview command.
4. Read the generated "Docs Agent Plan" document.
5. Review side-by-side diffs for each proposed file.
6. Run apply command.
7. Accept the modal confirmation to persist changes.

## How updates are chosen

Docs Agent:

- collects changed files from Git (staged/unstaged/untracked)
- treats all detected file changes as documentation input
- performs Java-specific analysis when `.java` files changed
- decides whether to create/update/skip each managed docs file
- updates only marker-owned blocks when markers exist

## Managed files

- `CHANGELOG.md` (always managed)
- `README.md` (managed only when configuration-related files change)
- `docs/00-business-overview.md`
- `docs/01-glossary.md`
- `docs/10-architecture.md`
- `docs/11-api-endpoints.md`
- `docs/20-service-behavior.md`
- `docs/30-dto-contracts.md`

If `docs/` does not exist, Docs Agent creates a baseline skeleton.

## Settings

`docsAgent.mode`:

- `rules` (default): rules/heuristics-based planning
- `ai`: guardrailed mode, still marker-only and includes evidence block

Set it in `settings.json`:

```json
{
  "docsAgent.mode": "rules"
}
```

## Troubleshooting

- `Docs Agent requires git to be installed...`
  - Install Git and ensure it is on `PATH`.

- `Docs Agent requires the opened folder to be inside a git repository.`
  - Open a folder that has a `.git` root or initialize one.

- Preview shows no changes:
  - Confirm there are actual Git changes in the workspace.
  - If there are changes and you still see none, verify the folder is a valid Git repo.
