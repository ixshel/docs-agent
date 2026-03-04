# docs-agent

`docs-agent` is a VS Code extension that proposes and applies documentation updates based on Git changes.

It previews doc patches first, then writes changes only after explicit confirmation.

## Technology and Framework

- Runtime: Node.js
- Language: TypeScript
- Packaging: npm
- Linting: ESLint
- Bundling: esbuild
- Host platform: VS Code extension API

## Tests

- Type checks: `npm run check-types`
- Lint: `npm run lint`
- Unit tests: `npm test`

## Infrastructure

- Source control: Git
- Build output: `dist/` and `out/`
- Documentation folder: `docs/`
- Commands: `docsAgent.previewDocsUpdate`, `docsAgent.updateDocsFromChanges`

## Configuration

- Extension config is defined in `package.json`.
- Workspace setting: `docsAgent.mode` (`rules` or `ai`).
