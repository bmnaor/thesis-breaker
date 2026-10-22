#!/usr/bin/env tsx
// Thesis Breaker CLI. SAMPLE_MODE by default: frozen fixtures, no keys, no network.
import fs from "node:fs";
import { ThesisMemory } from "./memory/thesisMemory.ts";
import { analyzeFixture } from "./orchestrator/analyze.ts";

const [cmd, ...args] = process.argv.slice(2);

function printReport(report: import("./orchestrator/analyze.ts").RunReport): void {
  console.log(`run (${report.mode}) at ${report.runAt}`);
  console.log(`documents: ${report.documents} | extracted: ${report.extracted} | verified: ${report.verified} | rejected: ${report.rejected.length}`);
  for (const r of report.results) {
    const up = r.supersedesMemoryId ? ` (supersedes ${r.supersedesMemoryId})` : "";
    console.log(`  [${r.action}] ${r.memoryId}: ${r.sentence}${up}`);
  }
  for (const r of report.rejected) console.log(`  [REJECTED] ${r.sentence} - ${r.reason}`);
  for (const sk of report.skipped) console.log(`  [SKIPPED] ${sk}`);
  console.log(`memory spine: ${report.manifest.memories} memories, ${report.manifest.ledgerEntries} ledger entries`, report.manifest.byAction);
}
const memoryDir = process.env.MEMORY_DIR ?? ".thesis-breaker";

function opt(name: string, fallback?: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
}

if (cmd === "analyze" || cmd === "demo") {
  const fixtureDir = opt("fixture", "fixtures/zura-2026-10-22")!;
  const memory = new ThesisMemory({ persistDir: memoryDir });
  if (cmd === "demo" && !opt("fixture")) {
    console.log("Phase 1 - simulated earlier retrieval (synthetic older registry snapshot, labeled synthetic):");
    const r1 = analyzeFixture(fixtureDir, memory, { logDir: "logs", documentIds: ["ctgov-NCT06993610-older-RECRUITING-synthetic"] });
    printReport(r1);
    console.log("\nPhase 2 - today's real capture (2026-10-22):");
    const r2 = analyzeFixture(fixtureDir, memory, { logDir: "logs", documentIds: ["ctgov-NCT06993610-2026-10-22", "edgar-submissions-CIK0001855644-2026-10-22"] });
    printReport(r2);
    process.exit(0);
  }
  const report = analyzeFixture(fixtureDir, memory, { logDir: "logs" });
  console.log(`\nThesis Breaker run (${report.mode}) at ${report.runAt}`);
  printReport(report);
} else if (cmd === "recall") {
  const q = args.filter((a) => !a.startsWith("--")).join(" ");
  const memory = new ThesisMemory({ persistDir: memoryDir });
  const res = memory.recall(q || "TibuSHIELD");
  console.log(res.context || "(nothing recalled)");
  console.log("\ntrace:", JSON.stringify(res.trace, null, 2));
} else if (cmd === "audit") {
  const memory = new ThesisMemory({ persistDir: memoryDir });
  const id = args[0];
  for (const e of memory.audit(id)) console.log(JSON.stringify(e));
} else {
  console.log("usage: tsx src/cli.ts analyze [--fixture DIR] | recall <query> | audit <memory-id>");
  process.exit(1);
}
