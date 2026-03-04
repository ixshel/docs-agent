import * as fs from "node:fs";
import * as path from "node:path";
import { detectProject } from "./project";
import { MANAGED_DOC_FILES, buildPlan } from "./planner";
import { analyzeJavaChanges } from "./java-analyzer";
import { applyPatchResults, buildMarkerPatch, PatchResult } from "./patcher";
import { getGitDiff, listChangedFiles, getRepoRoot } from "./git";

function exists(abs: string): boolean {
  try {
    return fs.existsSync(abs);
  } catch {
    return false;
  }
}

export interface RunOptions {
  mode?: "rules" | "ai";
}

export interface RunResult {
  repoRoot: string;
  patches: PatchResult[];
  planSummary: string;
  mode: "rules" | "ai";
}

export async function runDocsAgent(workspacePath: string, options: RunOptions = {}): Promise<RunResult> {
  const mode = options.mode ?? "rules";
  const repoRoot = await getRepoRoot(workspacePath);
  const diff = await getGitDiff(repoRoot);
  const changedFiles = await listChangedFiles(repoRoot);
  const project = detectProject(repoRoot);
  const javaSignals = analyzeJavaChanges({ repoRoot, changedFiles, diff });

  const docFileMap: Record<string, boolean> = {};
  for (const file of MANAGED_DOC_FILES) {
    docFileMap[file] = exists(path.join(repoRoot, file));
  }

  const docsExist = {
    readme: exists(path.join(repoRoot, "README.md")),
    docsFolder: exists(path.join(repoRoot, "docs")),
    files: docFileMap
  };

  const plan = buildPlan({
    changedFiles,
    diff,
    project: { buildTool: project.buildTool, isSpringBoot: project.isSpringBoot },
    docsExist,
    javaSignals,
    mode
  });

  const patches: PatchResult[] = [];
  for (const action of plan.actions) {
    if (action.type === "skip") {
      continue;
    }
    if (!action.file || !action.markers || action.content === undefined || action.content === null) {
      continue;
    }

    const patch = buildMarkerPatch({
      repoRoot,
      file: action.file,
      markers: action.markers,
      contentInside: action.content,
      createIfMissing: true,
      title: action.title
    });
    if (patch.changed) {
      patches.push(patch);
    }
  }

  const summaryLines = [
    ...plan.actions.map(action => `- ${action.type.toUpperCase()}: ${action.file || "(none)"} - ${action.reason}`),
    "",
    `- MODE: ${mode.toUpperCase()}`,
    `- RELEVANT FILES: ${plan.relevantFiles.length}`,
    ...plan.evidence.map(line => `- EVIDENCE: ${line}`)
  ];

  return {
    repoRoot,
    patches,
    planSummary: summaryLines.join("\n"),
    mode
  };
}

export function applyDocsAgentPatches(repoRoot: string, patches: PatchResult[]): PatchResult[] {
  return applyPatchResults(repoRoot, patches);
}
