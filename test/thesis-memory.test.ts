// Integration test: Thesis Breaker claims on the real H-MEM engine.
// Proves the sponsor-tech behaviors judges check: dedupe of echoes, update
// (supersede) instead of timeless contradiction, persistence across restarts,
// retrieval ranking that penalizes superseded records, and an auditable ledger.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ThesisMemory } from "../src/memory/thesisMemory.ts";
import { analyzeFixture } from "../src/orchestrator/analyze.ts";

const FIXTURE = path.resolve(__dirname, "../fixtures/zura-2026-10-22");
const OLDER = "ctgov-NCT06993610-older-RECRUITING-synthetic";
const CURRENT = "ctgov-NCT06993610-2026-10-22";

const T0 = new Date("2025-08-13T09:05:00Z").getTime(); // just after the simulated earlier retrieval
const T1 = new Date("2026-10-22T17:35:00Z").getTime(); // just after today's real capture

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "tb-test-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("ThesisMemory on H-MEM", () => {
  it("run 1: extracts verified claims from a frozen registry doc and records them", () => {
    const mem = new ThesisMemory({ persistDir: dir, clock: () => T0 });
    const report = analyzeFixture(FIXTURE, mem, { documentIds: [OLDER] });
    expect(report.rejected).toHaveLength(0);
    expect(report.verified).toBeGreaterThanOrEqual(5);
    expect(report.results.every((r) => r.action === "created")).toBe(true);
    expect(report.manifest.memories).toBe(report.verified);
    expect(report.manifest.byAction.create).toBe(report.verified);
  });

  it("run 2: a newer registry state supersedes the old - update, never contradiction or duplicate", () => {
    const mem = new ThesisMemory({ persistDir: dir, clock: () => T0 });
    analyzeFixture(FIXTURE, mem, { documentIds: [OLDER] });
    const mem2 = new ThesisMemory({ persistDir: dir, clock: () => T1 }); // reopen: state survived restart
    const report = analyzeFixture(FIXTURE, mem2, { documentIds: [CURRENT] });

    const status = report.results.find((r) => r.sentence.includes("overall status"))!;
    expect(status.action).toBe("updated");
    expect(status.sentence).toContain("ACTIVE_NOT_RECRUITING");
    expect(status.supersedesMemoryId).toBeTruthy();

    const oldMem = mem2.hmem.store.get(status.supersedesMemoryId!)!;
    const newMem = mem2.hmem.store.get(status.memoryId)!;
    expect(oldMem.content).toContain("RECRUITING");
    expect(oldMem.supersededBy).toBe(newMem.id); // penalized, not deleted
    expect(newMem.supersedes).toBe(oldMem.id);
    // both sides stay auditable
    expect(mem2.audit(oldMem.id).map((e) => e.action)).toContain("update");
    expect(mem2.audit(newMem.id).map((e) => e.action)).toContain("create");
  });

  it("echo dedupe: re-recording the identical claim is one memory, not a second confirmation", () => {
    const mem = new ThesisMemory({ persistDir: dir, clock: () => T0 });
    analyzeFixture(FIXTURE, mem, { documentIds: [CURRENT] });
    const report = analyzeFixture(FIXTURE, mem, { documentIds: [CURRENT] });
    expect(report.results.every((r) => r.action === "duplicate")).toBe(true);
    expect(report.manifest.memories).toBe(report.verified); // count did not grow
  });

  it("recall ranks the current status above the superseded one and explains itself", () => {
    const mem = new ThesisMemory({ persistDir: dir, clock: () => T0 });
    analyzeFixture(FIXTURE, mem, { documentIds: [OLDER] });
    const mem2 = new ThesisMemory({ persistDir: dir, clock: () => T1 });
    analyzeFixture(FIXTURE, mem2, { documentIds: [CURRENT] });

    const res = mem2.recall("NCT06993610 overall recruitment status");
    const contents = res.memories.map((m) => m.memory.content);
    const curIdx = contents.findIndex((c) => c.includes("ACTIVE_NOT_RECRUITING"));
    const oldIdx = contents.findIndex((c) => c.includes("RECRUITING") && !c.includes("ACTIVE"));
    expect(curIdx).toBeGreaterThanOrEqual(0);
    if (oldIdx >= 0) expect(curIdx).toBeLessThan(oldIdx); // superseded is penalized, not hidden
    expect(res.trace.scores[res.memories[0].memory.id]).toBeTypeOf("number");
    expect(res.context).toContain("[MEMORY CONTEXT]");
  });

  it("memory persists across restarts: tomorrow's run still remembers", () => {
    const mem = new ThesisMemory({ persistDir: dir, clock: () => T0 });
    analyzeFixture(FIXTURE, mem, { documentIds: [CURRENT] });
    const fresh = new ThesisMemory({ persistDir: dir, clock: () => T1 }); // brand-new process view
    expect(fresh.manifest().memories).toBeGreaterThanOrEqual(5);
    const res = fresh.recall("TibuSHIELD enrollment");
    expect(res.memories.length).toBeGreaterThan(0);
  });

  it("every memory record carries mandatory source + provenance (engine rejects sourceless writes)", () => {
    const mem = new ThesisMemory({ persistDir: dir, clock: () => T0 });
    analyzeFixture(FIXTURE, mem, { documentIds: [CURRENT] });
    for (const m of mem.hmem.store.all()) {
      expect(m.source).toMatch(/^https:\/\//);
      expect(m.provenance.label).toBeTruthy();
      expect(m.provenance.refs?.length).toBeGreaterThan(0);
      expect(m.tags).toContain("claim");
    }
    // and the engine itself refuses a sourceless record by construction
    expect(() => mem.hmem.add({ content: "unsourced claim", source: "" })).toThrow();
  });
});
