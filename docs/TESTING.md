# Testing Guide

## Test strategy

This project currently uses:

- TypeScript type checking (`tsc --noEmit`)
- ESLint for static checks
- Node's built-in test runner for unit tests (`node --test`)

The extension behavior is primarily tested at engine level (planner and Java analyzer), not full VS Code integration tests.

## Run all checks

```bash
npm run check-types
npm run lint
npm test
```

`npm test` runs:

1. `pretest`
2. `compile-tests`
3. `compile`
4. `lint`
5. `node --test out/test/*.test.js`

## Useful commands

- Type-check only:

```bash
npm run check-types
```

- Lint only:

```bash
npm run lint
```

- Build extension bundle:

```bash
npm run compile
```

- Production package build:

```bash
npm run package
```

## Test files

- `src/test/extension.test.ts`
- `src/test/java-analyzer.test.ts`

Key covered behaviors:

- skip logic for no/restricted changes
- docs skeleton planning when docs folder is missing
- endpoint-driven docs targeting
- Java endpoint/service/DTO signal extraction

## Common failures

- `Cannot find module ... out/test/*.test.js`
  - Run `npm run compile-tests` first or just run `npm test`.

- TypeScript import errors in editor but CLI passes:
  - Use VS Code workspace TypeScript version.
  - Restart TypeScript server.

- Lint failures:
  - Run `npm run lint` and resolve warnings/errors in `src/**`.

## Pre-release checklist

Run these commands from project root:

```bash
npm install
npm run check-types
npm run lint
npm test
npm run package
```

All must pass before release.

Then perform a manual Extension Host validation (`F5` in VS Code):

1. Open a real Git repository with Java/source changes.
2. Run `Docs Agent: Preview docs update from git changes`.
3. Confirm plan markdown opens and includes evidence lines.
4. Confirm side-by-side diffs open for each proposed patch.
5. Verify diffs only change managed marker blocks (or create missing managed docs files).
6. Run `Docs Agent: Apply docs update from git changes`.
7. Reject apply once and confirm no files are written.
8. Run apply again, accept, and confirm files are written.
9. Re-run preview immediately and confirm no extra unexpected patches.
10. Test non-git folder behavior and verify clear error message.

## Release gates

Ship only if all gates below are true:

- Build gate: `check-types`, `lint`, `test`, and `package` all pass.
- Safety gate: write operations happen only after apply confirmation.
- Scope gate: updates are limited to managed docs and marker-owned sections.
- Stability gate: no runtime errors in manual Extension Host pass.
- UX gate: preview and apply messages are clear and actionable.

## Sign-off template

Use this before tagging/releasing:

- Date:
- Version:
- Checked by:
- Build gate: PASS / FAIL
- Safety gate: PASS / FAIL
- Scope gate: PASS / FAIL
- Stability gate: PASS / FAIL
- UX gate: PASS / FAIL
- Notes:
