// Minimal vertical-slice run: frozen sources -> verified claims -> H-MEM.
// Every claim's span is re-verified against the stored document bytes before
// it may enter memory; an unverifiable claim is rejected, not trusted.

import fs from "node:fs";
import path from "node:path";
import { loadDocuments } from "../connectors/fixture.ts";
import { extractRegistryClaims, verifySpan } from "../claims/registryExtract.ts";
import { extractCompanyFactsClaims, extractFilingEventClaims } from "../claims/edgarExtract.ts";
import { extractMechanismClaims } from "../claims/pubmedExtract.ts";
import { ThesisMemory, type RecordResult } from "../memory/thesisMemory.ts";

export interface RunReport {
  runAt: string;
  fixtureDir: string;
  mode: "SAMPLE";
  documents: number;
  extracted: number;
  verified: number;
  rejected: { sentence: string; reason: string }[];
  skipped: string[];
  results: { action: string; sentence: string; memoryId: string; supersedesMemoryId?: string }[];
  manifest: { memories: number; ledgerEntries: number; byAction: Record<string, number> };
}

export function analyzeFixture(fixtureDir: string, memory: ThesisMemory, opts?: { logDir?: string; documentIds?: string[]; symbol?: string }): RunReport {
  let docs = loadDocuments(fixtureDir);
  if (opts?.documentIds) docs = docs.filter((d) => opts.documentIds!.includes(d.ref.documentId));
  const results: RecordResult[] = [];
  const symbol = opts?.symbol ?? "ZURA";
  const rejected: { sentence: string; reason: string }[] = [];
  const skipped: string[] = [];
  let extracted = 0;

  for (const doc of docs) {
    let claims;
    if (doc.ref.sourceClass === "registry" && doc.ref.canonicalUrl.includes("clinicaltrials.gov")) {
      claims = extractRegistryClaims(doc);
    } else if (doc.ref.sourceClass === "peer_reviewed") {
      claims = extractMechanismClaims(doc, "tibulizumab", ["IL-17A", "BAFF"]);
    } else if (doc.ref.canonicalUrl.includes("companyfacts")) {
      claims = extractCompanyFactsClaims(doc, symbol);
    } else if (doc.ref.canonicalUrl.includes("data.sec.gov/submissions")) {
      claims = extractFilingEventClaims(doc, symbol);
    } else {
      skipped.push(`${doc.ref.publisher} (${doc.ref.sourceClass}): connector not implemented in this slice yet`);
      continue;
    }
    extracted += claims.length;
    claims.sort((a, b) => a.asOf.localeCompare(b.asOf));
    for (const claim of claims) {
      const sourceDoc = docs.find((d) => d.ref.documentId === claim.source.documentId)!;
      if (!verifySpan(sourceDoc, claim.span)) {
        rejected.push({ sentence: claim.sentence, reason: "span no longer re-selects from stored bytes" });
        continue;
      }
      results.push(memory.recordClaim(claim));
    }
  }

  const report: RunReport = {
    runAt: new Date(memory.hmem.clock()).toISOString(),
    fixtureDir,
    mode: "SAMPLE",
    documents: docs.length,
    extracted,
    verified: results.length,
    rejected,
    skipped,
    results: results.map((r) => ({
      action: r.action,
      sentence: r.claim.sentence,
      memoryId: r.memory.id,
      supersedesMemoryId: r.supersedesMemoryId,
    })),
    manifest: memory.manifest(),
  };

  if (opts?.logDir) {
    fs.mkdirSync(opts.logDir, { recursive: true });
    const file = path.join(opts.logDir, `run-${report.runAt.replace(/[:.]/g, "-")}.json`);
    fs.writeFileSync(file, JSON.stringify(report, null, 2) + "\n");
  }
  return report;
}
