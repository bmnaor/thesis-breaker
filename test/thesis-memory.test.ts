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
import { candidatesToClaims } from "../src/claims/llmExtract.ts";

const FIXTURE = path.resolve(__dirname, "../fixtures/zura-2026-10-22");
const OLDER = "ctgov-NCT06993610-older-RECRUITING-synthetic";
const CURRENT = "ctgov-NCT06993610-2026-10-22";
const RELEASE = "zurabio-tibushield-launch-2025-05-20";

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

describe("subject alias normalization", () => {
  it("'Zura Bio Limited' and 'Zura Bio' share one update slot", () => {
    const doc = loadDocuments(FIXTURE).find((d) => d.ref.documentId === RELEASE)!;
    const a = candidatesToClaims(
      [{ subject: "Zura Bio", predicate: "cash_runway", object: "through 2027", modality: "estimated", quote: "TibuSHIELD has launched" }],
      doc
    ).claims;
    const b = candidatesToClaims(
      [{ subject: "Zura Bio Limited", predicate: "cash_runway", object: "through 2028", modality: "estimated", quote: "TibuSHIELD has launched" }],
      doc
    ).claims;
    expect(a[0].slotKey).toBe(b[0].slotKey);
    expect(a[0].subject).toBe("zura bio");
    const mem = new ThesisMemory({ persistDir: dir, clock: () => T1 });
    mem.recordClaim(a[0]);
    const r = mem.recordClaim(b[0]);
    expect(r.action).toBe("updated");
  });
});

describe("zetaris evidence-mart connector", () => {
  it("SAMPLE mode returns shaped mart rows with honest provenance", async () => {
    const { queryEvidenceMart } = await import("../src/connectors/zetaris.ts");
    const r = await queryEvidenceMart({ fixtureDir: FIXTURE });
    expect(r.provenance.mode).toBe("SAMPLE");
    expect(r.rows.length).toBeGreaterThan(0);
    const status = r.rows.find((x) => x.attribute === "overall_status");
    expect(status?.value).toBe("ACTIVE_NOT_RECRUITING");
    expect(status?.synthetic).toBe(false);
  });
  it("LIVE mode surfaces gateway errors instead of fabricating rows", async () => {
    const { queryEvidenceMart } = await import("../src/connectors/zetaris.ts");
    await expect(
      queryEvidenceMart({ fixtureDir: FIXTURE, live: { baseUrl: "http://127.0.0.1:1", orgId: "1", authorization: "Basic eA==" } })
    ).rejects.toThrow();
  });
});

describe("static dashboard", () => {
  it("renders thesis, falsifiers, sources and lineage chips into self-contained HTML", async () => {
    const { renderDashboard } = await import("../src/brief/dashboard.ts");
    const { composeBrief } = await import("../src/brief/compose.ts");
    const mem = new ThesisMemory({ persistDir: dir, clock: () => T1 });
    const report = await analyzeFixture(FIXTURE, mem, {});
    const brief = composeBrief(mem, "ZURA", report.runAt);
    const html = renderDashboard(brief, report);
    expect(html).toContain("Thesis under test");
    expect(html).toContain("What would break the thesis");
    expect(html).toContain("mem-");
    expect(html).toContain("synthetic");
    expect(html).not.toContain("http://cdn");
    expect(html).toContain("PARTIAL");
  });
});

describe("trial/indication-scoped update slots", () => {
  it("HS and systemic-sclerosis mechanism claims are independent facts, never supersedes", async () => {
    const { extractIssuerReleaseClaims } = await import("../src/claims/irExtract.ts");
    const docs = loadDocuments(FIXTURE);
    const hs = docs.find((d) => d.ref.documentId === "zurabio-tibushield-launch-2025-05-20")!;
    const ssc = docs.find((d) => d.ref.documentId === "zurabio-exceeds-enrollment-2026-06-29")!;
    const mem = new ThesisMemory({ persistDir: dir, clock: () => T1 });
    const a = extractIssuerReleaseClaims(hs, "tibulizumab", "TibuSHIELD").find((c) => c.predicate === "mechanism_targets")!;
    const b = extractIssuerReleaseClaims(ssc, "tibulizumab", "TibuSHIELD").find((c) => c.predicate === "mechanism_targets")!;
    expect(a.slotKey).not.toBe(b.slotKey);
    const r1 = mem.recordClaim(a);
    const r2 = mem.recordClaim(b);
    expect(r1.action).toBe("created");
    expect(r2.action).toBe("created"); // parallel trials preserved, not merged
  });
  it("same-scope guidance supersedes; different-scope guidance stays independent", () => {
    const doc = loadDocuments(FIXTURE).find((d) => d.ref.documentId === "zurabio-exceeds-enrollment-2026-06-29")!;
    const qHS = "TibuSHIELD has completed enrollment, exceeding enrollment target with 247 participants randomized in HS; topline data expected Q4 2026";
    const qSSc = "TibuSURE has exceeded the 80 participant enrollment target in SSc and remains on track to complete enrollment in early July; topline data expected H1 2027";
    const older = candidatesToClaims(
      [{ subject: "Zura Bio", predicate: "guidance_event_date", object: "topline Q3 2026", modality: "estimated", quote: qHS }], doc
    ).claims;
    const newer = candidatesToClaims(
      [{ subject: "Zura Bio", predicate: "guidance_event_date", object: "topline Q4 2026", modality: "estimated", quote: qHS }], doc
    ).claims;
    const otherTrial = candidatesToClaims(
      [{ subject: "Zura Bio", predicate: "guidance_event_date", object: "TibuSURE topline H1 2027", modality: "estimated", quote: qSSc }], doc
    ).claims;
    expect(older.length).toBe(1);
    expect(newer.length).toBe(1);
    expect(otherTrial.length).toBe(1);
    const mem = new ThesisMemory({ persistDir: dir, clock: () => T1 });
    mem.recordClaim(older[0]);
    expect(mem.recordClaim(newer[0]).action).toBe("updated");
    expect(mem.recordClaim(otherTrial[0]).action).toBe("created");
  });
});

describe("brief semantic hygiene", () => {
  it("unknowns come from the live graph and carry no stale connector labels; efficacy is flagged unproven", async () => {
    const { composeBrief } = await import("../src/brief/compose.ts");
    const mem = new ThesisMemory({ persistDir: dir, clock: () => T1 });
    await analyzeFixture(FIXTURE, mem, {});
    const brief = composeBrief(mem, "ZURA", "2026-10-23T00:00:00Z");
    expect(brief.efficacyProven).toBe(false);
    const blob = brief.unknowns.join(" ");
    expect(blob).not.toMatch(/not yet in the fixture|connector not built/i);
    expect(blob).not.toMatch(/mechanism/i); // mechanism claims exist in the graph
    expect(blob).toMatch(/UNPROVEN/);
    // parallel-trial mechanism claims must both survive: no HS/SSc supersedes edge
    const bad = brief.updates.filter((u) => /systemic sclerosis/i.test(u.text) && /hidradenitis/i.test(u.text));
    expect(bad.length).toBe(0);
  });
});
