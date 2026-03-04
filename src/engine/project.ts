import * as fs from "node:fs";
import * as path from "node:path";

export type BuildTool = "gradle" | "maven" | "unknown";

export interface ProjectInfo {
  root: string;
  buildTool: BuildTool;
  isSpringBoot: boolean;
}

function exists(p: string): boolean {
  try { return fs.existsSync(p); } catch { return false; }
}

export function detectProject(root: string): ProjectInfo {
  const isGradle = exists(path.join(root, "build.gradle")) || exists(path.join(root, "build.gradle.kts"));
  const isMaven = exists(path.join(root, "pom.xml"));

  // Heuristic spring boot detection (v1)
  // - presence of application.yml/properties
  // - or build file containing "spring-boot"
  const appYml = exists(path.join(root, "src", "main", "resources", "application.yml"));
  const appProps = exists(path.join(root, "src", "main", "resources", "application.properties"));

  let springHint = appYml || appProps;

  try {
    if (isGradle) {
      const f = exists(path.join(root, "build.gradle.kts")) ? "build.gradle.kts" : "build.gradle";
      const txt = fs.readFileSync(path.join(root, f), "utf8");
      springHint = springHint || txt.includes("spring-boot") || txt.includes("org.springframework.boot");
    } else if (isMaven) {
      const txt = fs.readFileSync(path.join(root, "pom.xml"), "utf8");
      springHint = springHint || txt.includes("spring-boot");
    }
  } catch {
    // ignore
  }

  return {
    root,
    buildTool: isGradle ? "gradle" : isMaven ? "maven" : "unknown",
    isSpringBoot: springHint
  };
}