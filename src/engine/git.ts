import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function runGit(cwd: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", args, { cwd });
    return stdout;
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      throw new Error("Docs Agent requires git to be installed and available on PATH.");
    }

    const stderr = String(error?.stderr ?? "").trim();
    if (stderr.includes("not a git repository")) {
      throw new Error("Docs Agent requires the opened folder to be inside a git repository.");
    }

    throw new Error(`Git command failed: git ${args.join(" ")}${stderr ? ` (${stderr})` : ""}`);
  }
}

export async function getRepoRoot(cwd: string): Promise<string> {
  const stdout = await runGit(cwd, ["rev-parse", "--show-toplevel"]);
  return stdout.trim();
}

export async function getGitDiff(cwd: string): Promise<string> {
  // Diff working tree + staged + untracked files.
  const a = await runGit(cwd, ["diff", "--unified=0"]);
  const b = await runGit(cwd, ["diff", "--cached", "--unified=0"]);
  const untracked = await runGit(cwd, ["ls-files", "--others", "--exclude-standard"]);
  const untrackedSummary = untracked.trim()
    ? `# Untracked files\n${untracked.trim()}`
    : "";
  const combined = [a.trim(), b.trim(), untrackedSummary].filter(Boolean).join("\n\n");
  return combined.trim();
}

export async function listChangedFiles(cwd: string): Promise<string[]> {
  // Includes unstaged + staged + untracked.
  const a = await runGit(cwd, ["diff", "--name-only"]);
  const b = await runGit(cwd, ["diff", "--cached", "--name-only"]);
  const c = await runGit(cwd, ["ls-files", "--others", "--exclude-standard"]);
  const files = new Set<string>();
  for (const line of (a + "\n" + b + "\n" + c).split("\n")) {
    const f = line.trim();
    if (f) {
      files.add(f);
    }
  }
  return [...files];
}
