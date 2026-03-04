import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";
import { analyzeJavaChanges } from "../engine/java-analyzer";

function withTempRepo(run: (repoRoot: string) => void) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "docs-agent-java-"));
  try {
    run(repoRoot);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
}

test("analyzeJavaChanges detects new endpoint annotations from diff", () => {
  withTempRepo(repoRoot => {
    const controller = "src/main/java/com/acme/controller/UserController.java";
    const controllerAbs = path.join(repoRoot, controller);
    fs.mkdirSync(path.dirname(controllerAbs), { recursive: true });
    fs.writeFileSync(
      controllerAbs,
      [
        "package com.acme.controller;",
        "",
        "import org.springframework.web.bind.annotation.RestController;",
        "",
        "@RestController",
        "public class UserController {",
        "}"
      ].join("\n"),
      "utf8"
    );

    const diff = [
      `+++ b/${controller}`,
      "+@GetMapping(\"/users\")",
      "+public List<UserDto> listUsers() {",
      "+  return service.listUsers();",
      "+}"
    ].join("\n");

    const signals = analyzeJavaChanges({
      repoRoot,
      changedFiles: [controller],
      diff
    });

    assert.equal(signals.newEndpoints.length, 1);
    assert.equal(signals.newEndpoints[0]?.method, "GET");
    assert.equal(signals.newEndpoints[0]?.route, "/users");
    assert.equal(signals.endpointFiles.includes(controller), true);
  });
});

test("analyzeJavaChanges classifies service and dto edits", () => {
  withTempRepo(repoRoot => {
    const service = "src/main/java/com/acme/service/BillingService.java";
    const dto = "src/main/java/com/acme/dto/BillingResponse.java";

    const serviceAbs = path.join(repoRoot, service);
    const dtoAbs = path.join(repoRoot, dto);
    fs.mkdirSync(path.dirname(serviceAbs), { recursive: true });
    fs.mkdirSync(path.dirname(dtoAbs), { recursive: true });

    fs.writeFileSync(
      serviceAbs,
      [
        "package com.acme.service;",
        "",
        "import org.springframework.stereotype.Service;",
        "",
        "@Service",
        "public class BillingService {}"
      ].join("\n"),
      "utf8"
    );
    fs.writeFileSync(
      dtoAbs,
      [
        "package com.acme.dto;",
        "",
        "public class BillingResponse {}"
      ].join("\n"),
      "utf8"
    );

    const diff = [
      `+++ b/${service}`,
      "+public BigDecimal calculateInvoiceTotal(Order order) {",
      "+  return pricingEngine.total(order);",
      "+}",
      `+++ b/${dto}`,
      "+private String currency;",
      "+private BigDecimal total;"
    ].join("\n");

    const signals = analyzeJavaChanges({
      repoRoot,
      changedFiles: [service, dto],
      diff
    });

    assert.equal(signals.serviceFiles.includes(service), true);
    assert.equal(signals.dtoFiles.includes(dto), true);
  });
});
