import * as path from "node:path";
import * as vscode from "vscode";
import { PatchResult } from "./engine/patcher";
import { applyDocsAgentPatches, runDocsAgent } from "./engine/runner";

function getWorkspacePath(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function getMode(): "rules" | "ai" {
  const mode = vscode.workspace.getConfiguration("docsAgent").get<string>("mode", "rules");
  return mode === "ai" ? "ai" : "rules";
}

async function showPlanSummary(planSummary: string) {
  const doc = await vscode.workspace.openTextDocument({
    content: ["# Docs Agent Plan", "", planSummary].join("\n"),
    language: "markdown"
  });
  await vscode.window.showTextDocument(doc, { preview: false });
}

async function showPatchDiffs(patches: PatchResult[]) {
  for (const patch of patches) {
    const beforeDoc = await vscode.workspace.openTextDocument({
      content: patch.before ?? "",
      language: "markdown"
    });
    const afterDoc = await vscode.workspace.openTextDocument({
      content: patch.after,
      language: "markdown"
    });

    const changeType = patch.created ? "create" : "update";
    await vscode.commands.executeCommand(
      "vscode.diff",
      beforeDoc.uri,
      afterDoc.uri,
      `Docs Agent Preview (${changeType}): ${patch.file}`,
      { preview: true }
    );
  }
}

export function activate(context: vscode.ExtensionContext) {
  const preview = vscode.commands.registerCommand("docsAgent.previewDocsUpdate", async () => {
    const ws = getWorkspacePath();
    if (!ws) {
      vscode.window.showErrorMessage("Docs Agent: Open a folder workspace first.");
      return;
    }

    try {
      const res = await runDocsAgent(ws, { mode: getMode() });
      await showPlanSummary(res.planSummary);
      if (res.patches.length === 0) {
        vscode.window.showInformationMessage("Docs Agent: No documentation changes are needed.");
        return;
      }

      await showPatchDiffs(res.patches);
      vscode.window.showInformationMessage(`Docs Agent: Preview generated for ${res.patches.length} file(s).`);
    } catch (e: any) {
      vscode.window.showErrorMessage(`Docs Agent preview failed: ${e?.message ?? String(e)}`);
    }
  });

  const apply = vscode.commands.registerCommand("docsAgent.updateDocsFromChanges", async () => {
    const ws = getWorkspacePath();
    if (!ws) {
      vscode.window.showErrorMessage("Docs Agent: Open a folder workspace first.");
      return;
    }

    try {
      const res = await runDocsAgent(ws, { mode: getMode() });
      await showPlanSummary(res.planSummary);
      if (res.patches.length === 0) {
        vscode.window.showInformationMessage("Docs Agent: No documentation changes are needed.");
        return;
      }

      await showPatchDiffs(res.patches);
      const confirm = await vscode.window.showWarningMessage(
        `Apply ${res.patches.length} proposed documentation update(s)?`,
        { modal: true },
        "Apply"
      );
      if (confirm !== "Apply") {
        vscode.window.showInformationMessage("Docs Agent: Apply cancelled.");
        return;
      }

      const applied = applyDocsAgentPatches(res.repoRoot, res.patches);
      if (applied.length === 0) {
        vscode.window.showInformationMessage("Docs Agent: No changes applied.");
        return;
      }

      vscode.window.showInformationMessage(`Docs Agent updated: ${applied.map(p => p.file).join(", ")}`);
      for (const patch of applied) {
        const uri = vscode.Uri.file(path.join(res.repoRoot, patch.file));
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, { preview: false, preserveFocus: true });
      }
    } catch (e: any) {
      vscode.window.showErrorMessage(`Docs Agent apply failed: ${e?.message ?? String(e)}`);
    }
  });

  context.subscriptions.push(preview, apply);
}

export function deactivate() {}
