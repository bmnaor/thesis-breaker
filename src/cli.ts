#!/usr/bin/env tsx
// Thesis Breaker CLI. SAMPLE_MODE by default: frozen fixtures, no keys, no network.
import fs from "node:fs";
import { ThesisMemory } from "./memory/thesisMemory.ts";
import { analyzeFixture } from "./orchestrator/analyze.ts";
import { composeBrief, renderBrief } from "./brief/compose.ts";
import { renderDashboard } from "./brief/dashboard.ts";
import { NebiusClient } from "./models/nebius.ts";

const llmOpt = () => {
  const key = process.env.NEBIUS_API_KEY;
  if (!args.includes("--live")) return undefined;
  if (!key) { console.error("--live needs NEBIUS_API_KEY"); process.exit(1); }
  return { client: new NebiusClient(key), model: process.env.MODEL_EXTRACTOR || "Qwen/Qwen3-30B-A3B-Instruct-2507" };
};

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
const OPTS_WITH_VALUES = new Set(["--fixture", "--out"]);
function positional(): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      if (OPTS_WITH_VALUES.has(args[i])) i++; // skip the option's value too
      continue;
    }
    out.push(args[i]);
  }
  return out;
}

if (cmd === "analyze" || cmd === "demo") {
  const fixtureDir = opt("fixture", "fixtures/zura-2026-10-22")!;
  const memory = new ThesisMemory({ persistDir: memoryDir });
  if (cmd === "demo" && !opt("fixture")) {
    console.log("Phase 1 - simulated earlier retrieval (synthetic older registry snapshot, labeled synthetic):");
    const r1 = await analyzeFixture(fixtureDir, memory, { logDir: "logs", documentIds: ["ctgov-NCT06993610-older-RECRUITING-synthetic"] });
    printReport(r1);
    console.log("\nPhase 2 - today's real capture (2026-10-22):");
    const r2 = await analyzeFixture(fixtureDir, memory, { logDir: "logs", documentIds: ["ctgov-NCT06993610-2026-10-22", "edgar-companyfacts-CIK0001855644-2026-10-22", "edgar-submissions-CIK0001855644-2026-10-22"] });
    printReport(r2);
    process.exit(0);
  }
  const report = await analyzeFixture(fixtureDir, memory, { logDir: "logs", llm: llmOpt() });
  console.log(`\nThesis Breaker run (${report.mode}) at ${report.runAt}`);
  printReport(report);
} else if (cmd === "brief") {
  const fixtureDir = opt("fixture", "fixtures/zura-2026-10-22")!;
  const symbol = positional()[0] ?? "ZURA";
  const memory = new ThesisMemory({ persistDir: memoryDir });
  const report = await analyzeFixture(fixtureDir, memory, { logDir: "logs", llm: llmOpt() });
  const brief = composeBrief(memory, symbol, report.runAt);
  console.log(renderBrief(brief));
} else if (cmd === "dashboard") {
  const fixtureDir = opt("fixture", "fixtures/zura-2026-10-22")!;
  const symbol = positional()[0] ?? "ZURA";
  const out = opt("out", "dashboard.html")!;
  const memory = new ThesisMemory({ persistDir: memoryDir });
  const report = await analyzeFixture(fixtureDir, memory, { logDir: "logs", llm: llmOpt() });
  const brief = composeBrief(memory, symbol, report.runAt);
  fs.writeFileSync(out, renderDashboard(brief, report));
  console.log(`dashboard written to ${out} (${report.mode} mode) - open it in a browser`);
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
  console.log("usage: tsx src/cli.ts analyze [--fixture DIR] | brief [SYMBOL] | dashboard [--out FILE] | recall <query> | audit <memory-id>");
  process.exit(1);
}
