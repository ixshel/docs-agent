import * as fs from "node:fs";
import * as path from "node:path";

export interface PatchResult {
  file: string;
  before: string | null;
  after: string;
  created: boolean;
  changed: boolean;
}

function ensureDirForFile(absPath: string) {
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
}

function titleFromFile(file: string): string {
  const base = path.basename(file, path.extname(file)).replace(/^\d+-/, "");
  return base
    .split(/[-_]/g)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function buildMarkerPatch(params: {
  repoRoot: string;
  file: string;
  markers: { start: string; end: string };
  contentInside: string;
  createIfMissing?: boolean;
  title?: string;
}): PatchResult {
  const abs = path.join(params.repoRoot, params.file);
  const exists = fs.existsSync(abs);
  const before = exists ? fs.readFileSync(abs, "utf8") : null;
  const base = before ?? "";

  let after = base;

  if (!exists && params.createIfMissing) {
    after = [
      `# ${params.title ?? titleFromFile(params.file)}`,
      "",
      params.markers.start,
      params.contentInside,
      params.markers.end,
      ""
    ].join("\n");
  } else {
    const startIdx = base.indexOf(params.markers.start);
    const endIdx = base.indexOf(params.markers.end);

    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      const head = base.slice(0, startIdx + params.markers.start.length);
      const tail = base.slice(endIdx);
      after = `${head}\n${params.contentInside}\n${tail}`;
    } else {
      after = [
        base.trimEnd(),
        "",
        params.markers.start,
        params.contentInside,
        params.markers.end,
        ""
      ].join("\n");
    }
  }

  return {
    file: params.file,
    before,
    after,
    created: !exists,
    changed: before !== after
  };
}

export function applyPatchResult(repoRoot: string, patch: PatchResult): void {
  if (!patch.changed) {
    return;
  }

  const abs = path.join(repoRoot, patch.file);
  const current = fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : null;
  if (current !== patch.before) {
    throw new Error(`Cannot apply patch for ${patch.file}: file changed since preview. Re-run preview.`);
  }

  ensureDirForFile(abs);
  fs.writeFileSync(abs, patch.after, "utf8");
}

export function applyPatchResults(repoRoot: string, patches: PatchResult[]): PatchResult[] {
  const changed = patches.filter(patch => patch.changed);
  for (const patch of changed) {
    applyPatchResult(repoRoot, patch);
  }
  return changed;
}
