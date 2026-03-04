import * as fs from "node:fs";
import * as path from "node:path";

export interface EndpointChange {
  file: string;
  method: string;
  route: string;
}

export interface JavaChangeSignals {
  javaFilesScanned: string[];
  newEndpoints: EndpointChange[];
  endpointFiles: string[];
  serviceFiles: string[];
  dtoFiles: string[];
  evidence: string[];
}

interface DiffFileLines {
  added: string[];
  removed: string[];
}

interface MappingSignal {
  method: string;
  route: string;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function normalizeRoute(route: string): string {
  const trimmed = route.trim();
  if (!trimmed) {
    return "/";
  }
  if (trimmed.startsWith("/")) {
    return trimmed;
  }
  return `/${trimmed}`;
}

function parsePathsFromAnnotationArgs(args: string): string[] {
  const quoted = [...args.matchAll(/"([^"]+)"/g)].map(match => match[1] ?? "").filter(Boolean);
  if (quoted.length > 0) {
    return quoted.map(normalizeRoute);
  }
  return ["/"];
}

function parseRequestMethodsFromArgs(args: string): string[] {
  const methods = [...args.matchAll(/RequestMethod\.(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)/g)]
    .map(match => match[1] ?? "")
    .filter(Boolean);
  return methods.length > 0 ? methods : ["ANY"];
}

function extractMappingSignals(text: string): MappingSignal[] {
  const results: MappingSignal[] = [];
  const regex = /@(GetMapping|PostMapping|PutMapping|PatchMapping|DeleteMapping|RequestMapping)\s*(?:\(([^)]*)\))?/g;

  for (const match of text.matchAll(regex)) {
    const annotation = match[1] ?? "";
    const args = match[2] ?? "";
    const paths = parsePathsFromAnnotationArgs(args);
    if (annotation === "RequestMapping") {
      for (const method of parseRequestMethodsFromArgs(args)) {
        for (const route of paths) {
          results.push({ method, route });
        }
      }
      continue;
    }

    const method = annotation.replace("Mapping", "").toUpperCase();
    for (const route of paths) {
      results.push({ method, route });
    }
  }

  return results;
}

function parseDiffByFile(diff: string): Map<string, DiffFileLines> {
  const byFile = new Map<string, DiffFileLines>();
  let currentFile: string | null = null;

  for (const rawLine of diff.split("\n")) {
    if (rawLine.startsWith("+++ b/")) {
      currentFile = rawLine.slice("+++ b/".length).trim();
      if (!byFile.has(currentFile)) {
        byFile.set(currentFile, { added: [], removed: [] });
      }
      continue;
    }
    if (rawLine.startsWith("+++ ") && !rawLine.startsWith("+++ b/")) {
      currentFile = null;
      continue;
    }
    if (!currentFile) {
      continue;
    }

    const lines = byFile.get(currentFile);
    if (!lines) {
      continue;
    }

    if (rawLine.startsWith("+") && !rawLine.startsWith("+++")) {
      lines.added.push(rawLine.slice(1));
      continue;
    }
    if (rawLine.startsWith("-") && !rawLine.startsWith("---")) {
      lines.removed.push(rawLine.slice(1));
    }
  }

  return byFile;
}

function looksLikeService(file: string, content: string): boolean {
  const lowerFile = file.toLowerCase();
  return lowerFile.includes("/service/")
    || lowerFile.includes("service.java")
    || content.includes("@Service");
}

function looksLikeDto(file: string, content: string): boolean {
  const lowerFile = file.toLowerCase();
  return lowerFile.includes("/dto/")
    || lowerFile.includes("request.java")
    || lowerFile.includes("response.java")
    || /class\s+\w+(Dto|Request|Response)\b/.test(content)
    || /record\s+\w+(Dto|Request|Response)\b/.test(content);
}

function looksLikeEndpointCarrier(file: string, content: string): boolean {
  const lowerFile = file.toLowerCase();
  return lowerFile.includes("/controller/")
    || lowerFile.includes("controller.java")
    || content.includes("@RestController")
    || content.includes("@Controller");
}

function isBehaviorLine(line: string): boolean {
  const t = line.trim();
  if (!t) {
    return false;
  }
  if (t.startsWith("import ") || t.startsWith("package ")) {
    return false;
  }
  if (t.startsWith("//") || t.startsWith("/*") || t.startsWith("*") || t.startsWith("*/")) {
    return false;
  }
  if (t.startsWith("@")) {
    return false;
  }
  if (t === "{" || t === "}" || t === ";" || t === ");") {
    return false;
  }
  return true;
}

export function analyzeJavaChanges(params: {
  repoRoot: string;
  changedFiles: string[];
  diff: string;
}): JavaChangeSignals {
  const javaFiles = uniqueSorted(params.changedFiles.filter(file => file.toLowerCase().endsWith(".java")));
  const diffByFile = parseDiffByFile(params.diff);

  const newEndpoints: EndpointChange[] = [];
  const endpointFiles: string[] = [];
  const serviceFiles: string[] = [];
  const dtoFiles: string[] = [];

  for (const file of javaFiles) {
    const abs = path.join(params.repoRoot, file);
    const content = fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "";
    const lines = diffByFile.get(file) ?? { added: [], removed: [] };
    const changedCodeLines = [...lines.added, ...lines.removed].filter(isBehaviorLine);

    if (looksLikeEndpointCarrier(file, content)) {
      endpointFiles.push(file);
    }
    if (looksLikeService(file, content) && changedCodeLines.length > 0) {
      serviceFiles.push(file);
    }
    if (looksLikeDto(file, content) && (lines.added.length > 0 || lines.removed.length > 0)) {
      dtoFiles.push(file);
    }

    const addedMappings = extractMappingSignals(lines.added.join("\n"));
    for (const mapping of addedMappings) {
      newEndpoints.push({
        file,
        method: mapping.method,
        route: mapping.route
      });
    }
  }

  const endpointFilesFinal = uniqueSorted(endpointFiles);
  const serviceFilesFinal = uniqueSorted(serviceFiles);
  const dtoFilesFinal = uniqueSorted(dtoFiles);
  const endpointSummary = uniqueSorted(newEndpoints.map(e => `${e.method} ${e.route}`));

  const evidence: string[] = [];
  evidence.push(`Changed files scanned: ${params.changedFiles.length}`);
  evidence.push(`Java files scanned: ${javaFiles.length}`);
  if (endpointSummary.length > 0) {
    evidence.push(`Endpoint annotations added: ${endpointSummary.slice(0, 10).join(", ")}${endpointSummary.length > 10 ? " ..." : ""}`);
  }
  if (serviceFilesFinal.length > 0) {
    evidence.push(`Service behavior changes: ${serviceFilesFinal.slice(0, 10).join(", ")}${serviceFilesFinal.length > 10 ? " ..." : ""}`);
  }
  if (dtoFilesFinal.length > 0) {
    evidence.push(`DTO changes: ${dtoFilesFinal.slice(0, 10).join(", ")}${dtoFilesFinal.length > 10 ? " ..." : ""}`);
  }

  return {
    javaFilesScanned: javaFiles,
    newEndpoints,
    endpointFiles: endpointFilesFinal,
    serviceFiles: serviceFilesFinal,
    dtoFiles: dtoFilesFinal,
    evidence
  };
}
