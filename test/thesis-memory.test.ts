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
import { loadDocuments } from "../src/connectors/fixture.ts";
import { assignFamilies } from "../src/claims/originFamily.ts";

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
  it("run 1: extracts verified claims from a frozen registry doc and records them", async () => {
    const mem = new ThesisMemory({ persistDir: dir, clock: () => T0 });
    const report = await analyzeFixture(FIXTURE, mem, { documentIds: [OLDER] });
    expect(report.rejected).toHaveLength(0);
    expect(report.verified).toBeGreaterThanOrEqual(5);
    expect(report.results.every((r) => r.action === "created")).toBe(true);
    expect(report.manifest.memories).toBe(report.verified);
    expect(report.manifest.byAction.create).toBe(report.verified);
  });

  it("run 2: a newer registry state supersedes the old - update, never contradiction or duplicate", async () => {
    const mem = new ThesisMemory({ persistDir: dir, clock: () => T0 });
    await analyzeFixture(FIXTURE, mem, { documentIds: [OLDER] });
    const mem2 = new ThesisMemory({ persistDir: dir, clock: () => T1 }); // reopen: state survived restart
    const report = await analyzeFixture(FIXTURE, mem2, { documentIds: [CURRENT] });

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

  it("echo dedupe: re-recording the identical claim is one memory, not a second confirmation", async () => {
    const mem = new ThesisMemory({ persistDir: dir, clock: () => T0 });
    await analyzeFixture(FIXTURE, mem, { documentIds: [CURRENT] });
    const report = await analyzeFixture(FIXTURE, mem, { documentIds: [CURRENT] });
    expect(report.results.every((r) => r.action === "duplicate")).toBe(true);
    expect(report.manifest.memories).toBe(report.verified); // count did not grow
  });

  it("recall ranks the current status above the superseded one and explains itself", async () => {
    const mem = new ThesisMemory({ persistDir: dir, clock: () => T0 });
    await analyzeFixture(FIXTURE, mem, { documentIds: [OLDER] });
    const mem2 = new ThesisMemory({ persistDir: dir, clock: () => T1 });
    await analyzeFixture(FIXTURE, mem2, { documentIds: [CURRENT] });

    const res = mem2.recall("NCT06993610 overall recruitment status");
    const contents = res.memories.map((m) => m.memory.content);
    const curIdx = contents.findIndex((c) => c.includes("ACTIVE_NOT_RECRUITING"));
    const oldIdx = contents.findIndex((c) => c.includes("RECRUITING") && !c.includes("ACTIVE"));
    expect(curIdx).toBeGreaterThanOrEqual(0);
    if (oldIdx >= 0) expect(curIdx).toBeLessThan(oldIdx); // superseded is penalized, not hidden
    expect(res.trace.scores[res.memories[0].memory.id]).toBeTypeOf("number");
    expect(res.context).toContain("[MEMORY CONTEXT]");
  });

  it("memory persists across restarts: tomorrow's run still remembers", async () => {
    const mem = new ThesisMemory({ persistDir: dir, clock: () => T0 });
    await analyzeFixture(FIXTURE, mem, { documentIds: [CURRENT] });
    const fresh = new ThesisMemory({ persistDir: dir, clock: () => T1 }); // brand-new process view
    expect(fresh.manifest().memories).toBeGreaterThanOrEqual(5);
    const res = fresh.recall("TibuSHIELD enrollment");
    expect(res.memories.length).toBeGreaterThan(0);
  });

  it("every memory record carries mandatory source + provenance (engine rejects sourceless writes)", async () => {
    const mem = new ThesisMemory({ persistDir: dir, clock: () => T0 });
    await analyzeFixture(FIXTURE, mem, { documentIds: [CURRENT] });
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

describe("EDGAR extraction", () => {
  const FACTS = "edgar-companyfacts-CIK0001855644-2026-10-22";
  const SUBS = "edgar-submissions-CIK0001855644-2026-10-22";

  it("cash balance claims carry period, form and verifiable XBRL spans", async () => {
    const mem = new ThesisMemory({ persistDir: dir, clock: () => T1 });
    const report = await analyzeFixture(FIXTURE, mem, { documentIds: [FACTS] });
    expect(report.rejected).toHaveLength(0);
    const q2 = report.results.find((r) => r.sentence.includes("as of 2026-06-30"))!;
    expect(q2.sentence).toContain("$205.1M");
    expect(q2.sentence).toContain("10-Q");
    expect(q2.action).toBe("created");
    // distinct periods are distinct subjects: no false supersession across quarters
    expect(report.results.filter((r) => r.action === "updated")).toHaveLength(0);
  });

  it("filing events extract from the submissions API with accession provenance", async () => {
    const mem = new ThesisMemory({ persistDir: dir, clock: () => T1 });
    const report = await analyzeFixture(FIXTURE, mem, { documentIds: [SUBS] });
    expect(report.rejected).toHaveLength(0);
    expect(report.verified).toBeGreaterThanOrEqual(3);
    expect(report.results.some((r) => r.sentence.includes("10-Q"))).toBe(true);
  });
});

describe("out-of-order sources", () => {
  it("an older registry state arriving AFTER the newer one never rewrites the present", async () => {
    const mem = new ThesisMemory({ persistDir: dir, clock: () => T1 });
    await analyzeFixture(FIXTURE, mem, { documentIds: [CURRENT] });
    await analyzeFixture(FIXTURE, mem, { documentIds: [OLDER] }); // late-arriving history
    const res = mem.recall("NCT06993610 overall status");
    const top = res.memories[0].memory;
    expect(top.content).toContain("ACTIVE_NOT_RECRUITING");
    const old = mem.hmem.store.all().find((m) => m.content.includes("RECRUITING") && !m.content.includes("ACTIVE"))!;
    expect(old.supersededBy).toBeTruthy(); // history kept, penalized
  });
});

describe("PubMed mechanism evidence", () => {
  it("extracts dual-target mechanism claims with verifiable char spans", async () => {
    const mem = new ThesisMemory({ persistDir: dir, clock: () => T1 });
    const report = await analyzeFixture(FIXTURE, mem, { documentIds: ["pubmed-tibulizumab-efetch-2026-10-22"] });
    expect(report.rejected).toHaveLength(0);
    const mech = report.results.filter((r) => r.sentence.includes("targeting"));
    expect(mech.length).toBeGreaterThanOrEqual(1);
    expect(mech[0].sentence).toContain("IL-17A");
    expect(mech[0].sentence).toContain("BAFF");
    expect(mech[0].sentence).toContain("PMID");
  });
});

describe("Issuer release extraction", () => {
  it("captures the dual-mechanism statement and launch event, labeled issuer assertions", async () => {
    const mem = new ThesisMemory({ persistDir: dir, clock: () => T1 });
    const report = await analyzeFixture(FIXTURE, mem, { documentIds: ["zurabio-tibushield-launch-2025-05-20"] });
    expect(report.rejected).toHaveLength(0);
    const mech = report.results.find((r) => r.sentence.includes("dual inhibition"))!;
    expect(mech.sentence).toContain("BAFF");
    expect(mech.sentence).toContain("IL-17A");
    const launch = report.results.find((r) => r.sentence.includes("not evidence of completion"))!;
    expect(launch.sentence).toContain("2025-05-20");
    // issuer mechanism claim and PubMed mechanism claim are independent source classes
    const pub = new ThesisMemory({ persistDir: dir, clock: () => T1 });
    await analyzeFixture(FIXTURE, pub, { documentIds: ["pubmed-tibulizumab-efetch-2026-10-22"] });
    const classes = new Set(mem.hmem.store.all().concat(pub.hmem.store.all()).map((m) => m.tags.find((t) => t.startsWith("class:"))));
    expect(classes.has("class:issuer_release")).toBe(true);
    expect(classes.has("class:peer_reviewed")).toBe(true);
  });
});

describe("origin families (eval gold #10)", () => {
  const ECHOES = [
    "commentary-biotechdaily-tibushield-synthetic",
    "commentary-smallcapwire-zura-synthetic",
    "commentary-forumblog-zura-synthetic",
  ];
  const RELEASE = "zurabio-tibushield-launch-2025-05-20";

  it("three pages quoting one release cluster into ONE origin family", () => {
    const docs = loadDocuments(FIXTURE);
    const fams = assignFamilies(docs);
    for (const e of ECHOES) {
      expect(fams.familyOf.get(e)).toBe(RELEASE);
    }
    // independent sources stay independent
    expect(fams.familyOf.get("pubmed-tibulizumab-efetch-2026-10-22")).toBe("pubmed-tibulizumab-efetch-2026-10-22");
    expect(fams.familyOf.get(CURRENT)).toBe(CURRENT);
  });

  it("independence counting: echoed mechanism claims count as one family, not three confirmations", async () => {
    const mem = new ThesisMemory({ persistDir: dir, clock: () => T1 });
    await analyzeFixture(FIXTURE, mem, { documentIds: [RELEASE, ...ECHOES, "pubmed-tibulizumab-efetch-2026-10-22"] });
    const families = new Set(
      mem.hmem.store.all().map((m) => m.tags.find((t) => t.startsWith("family:"))?.slice(7))
    );
    // issuer release family + PubMed family. The three echo pages add NOTHING.
    expect(families.size).toBe(2);
    expect(families.has(RELEASE)).toBe(true);
    expect(families.has("pubmed-tibulizumab-efetch-2026-10-22")).toBe(true);
  });
});
