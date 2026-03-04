const fs = require("node:fs");
const path = require("node:path");

function bumpPatch(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    throw new Error(`Unsupported version format: ${version}. Expected x.y.z`);
  }
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]) + 1;
  return `${major}.${minor}.${patch}`;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function main() {
  const dryRun = process.argv.includes("--dry-run");
  const cwd = process.cwd();
  const packageJsonPath = path.join(cwd, "package.json");
  const packageLockPath = path.join(cwd, "package-lock.json");

  const pkg = readJson(packageJsonPath);
  const current = String(pkg.version ?? "");
  const next = bumpPatch(current);

  if (dryRun) {
    console.log(`[dry-run] version: ${current} -> ${next}`);
    return;
  }

  pkg.version = next;
  writeJson(packageJsonPath, pkg);

  if (fs.existsSync(packageLockPath)) {
    const lock = readJson(packageLockPath);
    lock.version = next;
    if (lock.packages && lock.packages[""]) {
      lock.packages[""].version = next;
    }
    writeJson(packageLockPath, lock);
  }

  console.log(`version bumped: ${current} -> ${next}`);
}

main();
