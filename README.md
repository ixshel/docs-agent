# Subscription Management System a.k.a SMS

SMS houses and manages account information for ArcGIS Online (AGOL) monthly and annual subscriptions for organizations.

SMS manages Esri online service accounts for:
- organizations
- BAO
- CA
- Maps products
- ArcGIS Developers
- ArcGIS Pro licenses
- etc

## Technology and Framework

- Runtime: Node.js
- Language: TypeScript
- Packaging: npm
- Linting: ESLint

## Tests

- Type checks: `npm run check-types`
- Lint: `npm run lint`
- Unit tests: `npm test`

## Infrastructure

- Source control: Git
- Build output: `dist/` and `out/`
- Documentation folder: `docs/`

## Configuration

- Main app config is defined in `package.json`.
- Extension/runtime behavior may also use workspace settings where applicable.
