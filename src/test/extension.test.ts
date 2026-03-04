import assert from "node:assert/strict";
import test from "node:test";
import { JavaChangeSignals } from "../engine/java-analyzer";
import { MANAGED_DOC_FILES, buildPlan } from "../engine/planner";

function baseSignals(overrides: Partial<JavaChangeSignals> = {}): JavaChangeSignals {
  return {
    javaFilesScanned: [],
    newEndpoints: [],
    endpointFiles: [],
    serviceFiles: [],
    dtoFiles: [],
    evidence: ["Changed files scanned: 1", "Java files scanned: 0"],
    ...overrides
  };
}

function docsMap(existing: string[] = []): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const file of MANAGED_DOC_FILES) {
    map[file] = existing.includes(file);
  }
  return map;
}

test("buildPlan skips when no changed files exist", () => {
  const plan = buildPlan({
    changedFiles: [],
    diff: "",
    project: { buildTool: "unknown", isSpringBoot: false },
    docsExist: { readme: true, docsFolder: true, files: docsMap(MANAGED_DOC_FILES) },
    javaSignals: baseSignals(),
    mode: "rules"
  });

  assert.equal(plan.actions.length, 1);
  assert.equal(plan.actions[0]?.type, "skip");
});

test("buildPlan updates docs even for docs-only changes", () => {
  const plan = buildPlan({
    changedFiles: ["README.md", "docs/10-architecture.md"],
    diff: "mock diff",
    project: { buildTool: "maven", isSpringBoot: true },
    docsExist: { readme: true, docsFolder: true, files: docsMap(MANAGED_DOC_FILES) },
    javaSignals: baseSignals(),
    mode: "rules"
  });

  assert.ok(plan.actions.length >= 3);
  assert.equal(plan.actions.some(action => action.type === "skip"), false);
});

test("buildPlan updates docs for test-only file changes", () => {
  const plan = buildPlan({
    changedFiles: ["src/test/planner.spec.ts"],
    diff: "mock diff",
    project: { buildTool: "maven", isSpringBoot: true },
    docsExist: { readme: true, docsFolder: true, files: docsMap(MANAGED_DOC_FILES) },
    javaSignals: baseSignals(),
    mode: "rules"
  });

  assert.ok(plan.actions.length >= 3);
  assert.equal(plan.actions.some(action => action.type === "skip"), false);
});

test("buildPlan creates docs skeleton when docs folder is missing", () => {
  const plan = buildPlan({
    changedFiles: ["src/main/java/com/acme/service/UserService.java"],
    diff: "mock diff",
    project: { buildTool: "maven", isSpringBoot: true },
    docsExist: { readme: false, docsFolder: false, files: docsMap([]) },
    javaSignals: baseSignals({
      javaFilesScanned: ["src/main/java/com/acme/service/UserService.java"],
      serviceFiles: ["src/main/java/com/acme/service/UserService.java"]
    }),
    mode: "rules"
  });

  const files = plan.actions.map(action => action.file);
  assert.equal(files.includes("README.md"), true);
  assert.equal(files.includes("docs/00-business-overview.md"), true);
  assert.equal(files.includes("docs/10-architecture.md"), true);
  assert.equal(files.includes("docs/11-api-endpoints.md"), false);
  assert.equal(files.includes("docs/20-service-behavior.md"), true);
  assert.equal(files.includes("docs/30-dto-contracts.md"), false);
  assert.equal(files.includes("docs/01-glossary.md"), true);
});

test("buildPlan updates endpoint doc when new endpoint annotations are detected", () => {
  const plan = buildPlan({
    changedFiles: ["src/main/java/com/acme/controller/UserController.java"],
    diff: "mock diff",
    project: { buildTool: "gradle", isSpringBoot: true },
    docsExist: { readme: true, docsFolder: true, files: docsMap(MANAGED_DOC_FILES) },
    javaSignals: baseSignals({
      javaFilesScanned: ["src/main/java/com/acme/controller/UserController.java"],
      endpointFiles: ["src/main/java/com/acme/controller/UserController.java"],
      newEndpoints: [
        {
          file: "src/main/java/com/acme/controller/UserController.java",
          method: "GET",
          route: "/users"
        }
      ]
    }),
    mode: "rules"
  });

  const files = plan.actions.map(action => action.file);
  assert.equal(files.includes("docs/11-api-endpoints.md"), true);
});
