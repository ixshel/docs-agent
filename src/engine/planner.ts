import { JavaChangeSignals } from "./java-analyzer";

export type DocActionType = "create" | "update" | "skip";

export interface DocAction {
  type: DocActionType;
  file: string;
  reason: string;
  markers?: { start: string; end: string };
  content?: string;
  title?: string;
}

export interface PlanInput {
  changedFiles: string[];
  diff: string;
  project: { buildTool: string; isSpringBoot: boolean };
  docsExist: { readme: boolean; docsFolder: boolean; files: Record<string, boolean> };
  javaSignals: JavaChangeSignals;
  mode: "rules" | "ai";
}

export interface DocPlan {
  actions: DocAction[];
  relevantFiles: string[];
  evidence: string[];
}

interface ManagedDocSpec {
  file: string;
  title: string;
  reason: string;
  markers: { start: string; end: string };
  content: string;
}

export const MANAGED_DOC_FILES: string[] = [
  "docs/00-business-overview.md",
  "docs/01-glossary.md",
  "docs/10-architecture.md",
  "docs/11-api-endpoints.md",
  "docs/20-service-behavior.md",
  "docs/30-dto-contracts.md"
];

const RELEVANT_FILE_PATTERNS = [
  /\.java$/i,
  /\.kt$/i,
  /\.kts$/i,
  /\.groovy$/i,
  /\.xml$/i,
  /\.ya?ml$/i,
  /\.properties$/i,
  /\.gradle$/i,
  /(^|\/)pom\.xml$/i,
  /(^|\/)build\.gradle(\.kts)?$/i,
  /(^|\/)dockerfile$/i,
  /(^|\/)helm\//i,
  /(^|\/)k8s\//i
];

function looksLikeTestFile(file: string): boolean {
  const lower = file.toLowerCase();
  return lower.includes("/test/")
    || lower.includes("\\test\\")
    || lower.endsWith(".test.java")
    || lower.endsWith("test.java")
    || lower.endsWith(".spec.java")
    || lower.endsWith(".test.ts")
    || lower.endsWith(".spec.ts")
    || lower.endsWith(".test.js")
    || lower.endsWith(".spec.js");
}

function isRelevantFile(file: string): boolean {
  const lower = file.toLowerCase();
  if (lower.startsWith("docs/") || lower.endsWith(".md") || lower === "readme.md") {
    return false;
  }
  if (looksLikeTestFile(file)) {
    return false;
  }
  return RELEVANT_FILE_PATTERNS.some(pattern => pattern.test(file));
}

function actionTypeFor(input: PlanInput, file: string): DocActionType {
  if (file === "README.md") {
    return input.docsExist.readme ? "update" : "create";
  }
  return input.docsExist.files[file] ? "update" : "create";
}

function addManagedAction(actions: DocAction[], input: PlanInput, spec: ManagedDocSpec) {
  actions.push({
    type: actionTypeFor(input, spec.file),
    file: spec.file,
    reason: spec.reason,
    markers: spec.markers,
    content: spec.content,
    title: spec.title
  });
}

function evidenceLines(input: PlanInput, relevantFiles: string[]): string[] {
  const lines: string[] = [];
  lines.push(`Relevant files considered: ${relevantFiles.slice(0, 12).map(file => `\`${file}\``).join(", ")}${relevantFiles.length > 12 ? " ..." : ""}`);
  lines.push(...input.javaSignals.evidence);
  if (input.mode === "ai") {
    lines.push("AI mode requested: using guardrailed marker-only update mode.");
  }
  return lines;
}

function formatEvidenceSection(input: PlanInput, relevantFiles: string[]): string[] {
  return [
    "### Evidence",
    ...evidenceLines(input, relevantFiles).map(line => `- ${line}`)
  ];
}

function generateTechOverview(input: PlanInput, relevantFiles: string[]): string {
  const runCmd = input.project.buildTool === "gradle"
    ? "```bash\n./gradlew test\n./gradlew bootRun\n```"
    : input.project.buildTool === "maven"
      ? "```bash\nmvn test\nmvn spring-boot:run\n```"
      : "```bash\n# add your build/run commands\n```";

  return [
    "### Technical Overview (auto-maintained)",
    "",
    `- Build tool: **${input.project.buildTool}**`,
    `- Framework hint: **${input.project.isSpringBoot ? "Spring Boot" : "Java"}**`,
    `- Relevant recent changes: ${relevantFiles.slice(0, 10).map(file => `\`${file}\``).join(", ")}${relevantFiles.length > 10 ? " ..." : ""}`,
    "",
    "#### How to run",
    runCmd,
    "",
    ...formatEvidenceSection(input, relevantFiles),
    "",
    "> This section is maintained by Docs Agent. Keep custom content outside markers."
  ].join("\n");
}

function generateBusinessOverview(input: PlanInput, relevantFiles: string[]): string {
  const impacted = [
    ...input.javaSignals.endpointFiles,
    ...input.javaSignals.serviceFiles
  ];

  return [
    "## Business Overview (auto-maintained section)",
    "",
    "### What changed recently",
    impacted.length > 0
      ? `- Backend behavior likely changed in: ${impacted.slice(0, 12).map(file => `\`${file}\``).join(", ")}${impacted.length > 12 ? " ..." : ""}`
      : `- Relevant technical changes were detected in: ${relevantFiles.slice(0, 12).map(file => `\`${file}\``).join(", ")}${relevantFiles.length > 12 ? " ..." : ""}`,
    "",
    "### Product impact checklist",
    "- Validate user-facing flows impacted by endpoint or service changes.",
    "- Update release notes with externally visible behavior changes.",
    "",
    ...formatEvidenceSection(input, relevantFiles)
  ].join("\n");
}

function generateArchitecture(input: PlanInput, relevantFiles: string[]): string {
  const hints: string[] = [];
  if (input.project.isSpringBoot) {
    hints.push("- Spring Boot signals detected (controllers/services/configuration).");
  }
  if (input.javaSignals.endpointFiles.length > 0) {
    hints.push(`- Endpoint layer touched: ${input.javaSignals.endpointFiles.slice(0, 6).map(file => `\`${file}\``).join(", ")}${input.javaSignals.endpointFiles.length > 6 ? " ..." : ""}`);
  }
  if (input.javaSignals.serviceFiles.length > 0) {
    hints.push(`- Service layer touched: ${input.javaSignals.serviceFiles.slice(0, 6).map(file => `\`${file}\``).join(", ")}${input.javaSignals.serviceFiles.length > 6 ? " ..." : ""}`);
  }
  if (input.changedFiles.some(file => file.includes("application.yml") || file.includes("application.properties"))) {
    hints.push("- Runtime configuration changed; verify deployment runbook.");
  }

  return [
    "## Architecture Notes (auto-maintained section)",
    "",
    "### Signals from code changes",
    ...(hints.length > 0 ? hints : ["- No strong architecture signals detected from current changes."]),
    "",
    "### Suggested docs to keep synced",
    "- `docs/11-api-endpoints.md`",
    "- `docs/20-service-behavior.md`",
    "- `docs/30-dto-contracts.md`",
    "",
    ...formatEvidenceSection(input, relevantFiles)
  ].join("\n");
}

function generateApiEndpoints(input: PlanInput, relevantFiles: string[]): string {
  const endpointRows = input.javaSignals.newEndpoints
    .map(endpoint => `- \`${endpoint.method} ${endpoint.route}\` from \`${endpoint.file}\``);

  return [
    "## API Endpoints (auto-maintained section)",
    "",
    "### Newly detected mappings",
    ...(endpointRows.length > 0
      ? endpointRows
      : ["- No new endpoint mapping annotations were detected in this change set."]),
    "",
    "### Endpoint files touched",
    ...(input.javaSignals.endpointFiles.length > 0
      ? input.javaSignals.endpointFiles.slice(0, 20).map(file => `- \`${file}\``)
      : ["- None detected."]),
    "",
    ...formatEvidenceSection(input, relevantFiles)
  ].join("\n");
}

function generateServiceBehavior(input: PlanInput, relevantFiles: string[]): string {
  return [
    "## Service Behavior (auto-maintained section)",
    "",
    "### Service files with behavioral edits",
    ...(input.javaSignals.serviceFiles.length > 0
      ? input.javaSignals.serviceFiles.slice(0, 25).map(file => `- \`${file}\``)
      : ["- No clear service behavior changes detected."]),
    "",
    "### Review checklist",
    "- Validate changes in business rules, side effects, and transactional boundaries.",
    "- Confirm monitoring/alerts still map to updated behavior.",
    "",
    ...formatEvidenceSection(input, relevantFiles)
  ].join("\n");
}

function generateDtoContracts(input: PlanInput, relevantFiles: string[]): string {
  return [
    "## DTO Contracts (auto-maintained section)",
    "",
    "### DTO files changed",
    ...(input.javaSignals.dtoFiles.length > 0
      ? input.javaSignals.dtoFiles.slice(0, 25).map(file => `- \`${file}\``)
      : ["- No DTO contract changes detected."]),
    "",
    "### Contract checklist",
    "- Verify compatibility of request/response payload changes.",
    "- Coordinate with clients if breaking schema changes are introduced.",
    "",
    ...formatEvidenceSection(input, relevantFiles)
  ].join("\n");
}

function generateGlossary(input: PlanInput, relevantFiles: string[]): string {
  return [
    "## Glossary (auto-maintained section)",
    "",
    "- Add domain terms and short definitions in this page.",
    "- Keep acronyms and external system names normalized.",
    "",
    ...formatEvidenceSection(input, relevantFiles)
  ].join("\n");
}

export function buildPlan(input: PlanInput): DocPlan {
  if (!input.diff && input.changedFiles.length === 0) {
    return {
      actions: [{ type: "skip", file: "", reason: "No changed files found." }],
      relevantFiles: [],
      evidence: []
    };
  }

  if (input.changedFiles.length > 0 && input.changedFiles.every(looksLikeTestFile)) {
    return {
      actions: [{ type: "skip", file: "", reason: "Only test changes detected." }],
      relevantFiles: [],
      evidence: []
    };
  }

  const relevantFiles = input.changedFiles.filter(isRelevantFile);
  if (relevantFiles.length === 0) {
    return {
      actions: [{ type: "skip", file: "", reason: "No relevant source/config changes detected." }],
      relevantFiles: [],
      evidence: []
    };
  }

  const actions: DocAction[] = [];
  const evidence = evidenceLines(input, relevantFiles);

  addManagedAction(actions, input, {
    file: "README.md",
    title: "README",
    reason: input.docsExist.readme ? "Update technical overview." : "Create README with technical overview markers.",
    markers: { start: "<!-- DOCS_AGENT:TECH_OVERVIEW:START -->", end: "<!-- DOCS_AGENT:TECH_OVERVIEW:END -->" },
    content: generateTechOverview(input, relevantFiles)
  });

  addManagedAction(actions, input, {
    file: "docs/00-business-overview.md",
    title: "Business Overview",
    reason: "Update business-facing summary from code changes.",
    markers: { start: "<!-- DOCS_AGENT:BUSINESS_OVERVIEW:START -->", end: "<!-- DOCS_AGENT:BUSINESS_OVERVIEW:END -->" },
    content: generateBusinessOverview(input, relevantFiles)
  });

  addManagedAction(actions, input, {
    file: "docs/10-architecture.md",
    title: "Architecture Notes",
    reason: "Update architecture signals from recent changes.",
    markers: { start: "<!-- DOCS_AGENT:ARCH:START -->", end: "<!-- DOCS_AGENT:ARCH:END -->" },
    content: generateArchitecture(input, relevantFiles)
  });

  const docsMissing = !input.docsExist.docsFolder;
  const shouldUpdateApi = docsMissing || input.javaSignals.newEndpoints.length > 0 || input.javaSignals.endpointFiles.length > 0;
  const shouldUpdateServices = docsMissing || input.javaSignals.serviceFiles.length > 0;
  const shouldUpdateDtos = docsMissing || input.javaSignals.dtoFiles.length > 0;
  const shouldCreateGlossary = docsMissing || !input.docsExist.files["docs/01-glossary.md"];

  if (shouldUpdateApi) {
    addManagedAction(actions, input, {
      file: "docs/11-api-endpoints.md",
      title: "API Endpoints",
      reason: "Track endpoint-level API changes from Java annotations.",
      markers: { start: "<!-- DOCS_AGENT:API_ENDPOINTS:START -->", end: "<!-- DOCS_AGENT:API_ENDPOINTS:END -->" },
      content: generateApiEndpoints(input, relevantFiles)
    });
  }

  if (shouldUpdateServices) {
    addManagedAction(actions, input, {
      file: "docs/20-service-behavior.md",
      title: "Service Behavior",
      reason: "Track service-layer behavior changes.",
      markers: { start: "<!-- DOCS_AGENT:SERVICE_BEHAVIOR:START -->", end: "<!-- DOCS_AGENT:SERVICE_BEHAVIOR:END -->" },
      content: generateServiceBehavior(input, relevantFiles)
    });
  }

  if (shouldUpdateDtos) {
    addManagedAction(actions, input, {
      file: "docs/30-dto-contracts.md",
      title: "DTO Contracts",
      reason: "Track request/response DTO contract changes.",
      markers: { start: "<!-- DOCS_AGENT:DTO_CONTRACTS:START -->", end: "<!-- DOCS_AGENT:DTO_CONTRACTS:END -->" },
      content: generateDtoContracts(input, relevantFiles)
    });
  }

  if (shouldCreateGlossary) {
    addManagedAction(actions, input, {
      file: "docs/01-glossary.md",
      title: "Glossary",
      reason: "Create or refresh glossary skeleton.",
      markers: { start: "<!-- DOCS_AGENT:GLOSSARY:START -->", end: "<!-- DOCS_AGENT:GLOSSARY:END -->" },
      content: generateGlossary(input, relevantFiles)
    });
  }

  return { actions, relevantFiles, evidence };
}
