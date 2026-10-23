// Zetaris AI Data Gateway connector: the SQL evidence-mart slice.
//
// Zetaris federates the thesis sources (ClinicalTrials.gov, EDGAR, issuer IR)
// behind one SQL interface. In the hackathon deployment the gateway runs in
// Docker on a local PC, exposed to the build agent through a Cloudflare quick
// tunnel on port 8888 (API key required).
//
// Modes:
//   SAMPLE (default, no keys): reads fixtures/zura-2026-10-22/zetaris-mart.sample.json,
//     a frozen export shaped like the mart query result, derived from the real
//     fixture documents and labeled synthetic-export. Fully reproducible, no network.
//   LIVE: POSTs the mart SQL to the gateway REST endpoint and returns real rows.
//     *** UNVERIFIED ***: the endpoint path/payload below is a best-effort guess
//     against the AI Data Gateway REST API and MUST be confirmed against the live
//     gateway on first contact (see docs/spec/01-connectors-and-pipeline.md).
//     Until then the live path throws rather than fabricating a result.
//
// Never present SAMPLE rows as live Zetaris output: rows carry
// provenance.mode so the brief and PARTIAL banner can say which ran.

import fs from "node:fs";
import path from "node:path";

export interface MartRow {
  sourceSystem: string;   // e.g. "ctgov", "edgar", "issuer_ir"
  tableName: string;      // federated table, e.g. "trials", "company_facts"
  key: string;            // entity key, e.g. "NCT06993610", "CIK1855644"
  attribute: string;      // e.g. "overall_status", "cash_and_equivalents"
  value: string;
  asOf: string;           // source-side as-of date
  retrievedAt: string;    // capture time
  synthetic: boolean;     // true for synthetic fixture-derived rows
}

export interface MartResult {
  rows: MartRow[];
  provenance: { mode: "SAMPLE" | "LIVE"; endpoint?: string; query: string };
}

// The evidence-mart query the gateway will federate. Kept as a named constant
// so SAMPLE and LIVE stay the same logical question.
export const EVIDENCE_MART_SQL = `
SELECT source_system, table_name, key, attribute, value, as_of, retrieved_at
FROM evidence_mart.zura_thesis
WHERE key IN ('NCT06993610', 'CIK1855644', 'ZURA-IR')
ORDER BY source_system, attribute
`.trim();

export function loadMartSample(fixtureDir: string): MartResult {
  const p = path.join(fixtureDir, "zetaris-mart.sample.json");
  const rows = JSON.parse(fs.readFileSync(p, "utf-8")) as MartRow[];
  return { rows, provenance: { mode: "SAMPLE", query: EVIDENCE_MART_SQL } };
}

export interface ZetarisLiveConfig {
  baseUrl: string;  // e.g. https://<random>.trycloudflare.com (tunnel to :8888)
  apiKey: string;
}

export async function queryMartLive(cfg: ZetarisLiveConfig): Promise<MartResult> {
  // UNVERIFIED endpoint shape - confirm against the live gateway before relying
  // on this path. Throws on any non-2xx so callers surface PARTIAL honestly.
  const url = `${cfg.baseUrl.replace(/\/$/, "")}/api/v1/query`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({ sql: EVIDENCE_MART_SQL }),
  });
  if (!res.ok) {
    throw new Error(`zetaris gateway ${res.status} ${res.statusText} at ${url}`);
  }
  const data = (await res.json()) as { rows?: MartRow[] };
  if (!Array.isArray(data.rows)) {
    throw new Error(`zetaris gateway returned unexpected shape at ${url} (no rows array)`);
  }
  return { rows: data.rows, provenance: { mode: "LIVE", endpoint: url, query: EVIDENCE_MART_SQL } };
}

// Entry point used by the orchestrator: LIVE only when explicitly configured,
// otherwise honest SAMPLE. Missing/invalid live config never silently degrades -
// callers see the throw and mark the connector PARTIAL.
export async function queryEvidenceMart(opts: {
  fixtureDir: string;
  live?: ZetarisLiveConfig;
}): Promise<MartResult> {
  if (opts.live) return queryMartLive(opts.live);
  return loadMartSample(opts.fixtureDir);
}
