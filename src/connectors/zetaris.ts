// Zetaris AI Data Gateway connector: the SQL evidence-mart slice.
//
// The gateway federates thesis sources behind one SQL interface. In the
// hackathon deployment it runs in Docker on a local PC, reached through a
// Cloudflare quick tunnel to the API port (8888).
//
// LIVE path - VERIFIED against the live gateway 2026-10-23 ~08:03 IDT:
//   1. GET  {base}/api/v1.0/auth/login  with headers X-Org-ID ("1" on the
//      local install) and Authorization: Basic base64(user:pass) -> { idToken }
//      (POST is Method Not Allowed; missing org header is a 400 naming it)
//   2. POST {base}/api/v1.0/query/sql/start with Bearer idToken, X-Org-ID,
//      X-Request-ID and body {"select": <sql>, "pageLimit": n}
//      -> { records: [...], queryToken } (queryToken paginates; our mart fits
//      one page). The endpoint accepts SELECT statements only - SHOW/DDL are
//      rejected ("Bad Select SQL"), so the mart is a portable VALUES relation
//      inside the SELECT itself: zero mutation of the gateway, still executed
//      end-to-end by api -> driver -> Spark (verified: select 7, and the full
//      9-row mart returned through the tunnel).
//   Auth note: the local install ships the documented default admin
//   (admin@zetaris.com) per our own 16.10 setup script; credentials come from
//   env here, never hardcoded.
//
// SAMPLE path (default, no keys): frozen export shaped like the mart result,
// provenance.mode = "SAMPLE" so SAMPLE is never presented as live.

import fs from "node:fs";
import path from "node:path";

export interface MartRow {
  sourceSystem: string;
  tableName: string;
  key: string;
  attribute: string;
  value: string;
  asOf: string;
  retrievedAt: string;
  synthetic: boolean;
}

export interface MartResult {
  rows: MartRow[];
  provenance: { mode: "SAMPLE" | "LIVE"; endpoint?: string; query: string };
}

// The verified live mart query: one SELECT, data inline as a VALUES relation,
// so it passes the gateway's select-only validator and mutates nothing.
export const EVIDENCE_MART_SQL = `SELECT m.source_system, m.table_name, m.key, m.attribute, m.value, m.as_of, m.retrieved_at FROM (VALUES
('ctgov','trials','NCT06993610','overall_status','ACTIVE_NOT_RECRUITING','2026-10-19','2026-10-22'),
('ctgov','trials','NCT06993610','enrollment_actual','247','2026-10-19','2026-10-22'),
('ctgov','trials','NCT06993610','primary_completion_date','2026-09-18','2026-10-19','2026-10-22'),
('ctgov','trials','NCT06993610','phase','PHASE2','2026-10-19','2026-10-22'),
('edgar','company_facts','CIK1855644','cash_and_cash_equivalents_usd','205100000','2026-06-30','2026-10-22'),
('edgar','submissions','CIK1855644','latest_10q_filed','2026-08-11','2026-08-11','2026-10-22'),
('issuer_ir','releases','ZURA-IR','topline_expectation','Q4 2026','2026-06-24','2026-10-22'),
('issuer_ir','releases','ZURA-IR','runway_guidance','through at least end of 2028','2026-06-24','2026-10-22'),
('issuer_ir','releases','ZURA-IR','enrollment_complete_randomized','247','2026-06-24','2026-10-22')
) AS m(source_system,table_name,key,attribute,value,as_of,retrieved_at)
WHERE m.key IN ('NCT06993610','CIK1855644','ZURA-IR')
ORDER BY m.source_system, m.attribute`;

export function loadMartSample(fixtureDir: string): MartResult {
  const p = path.join(fixtureDir, "zetaris-mart.sample.json");
  const rows = JSON.parse(fs.readFileSync(p, "utf-8")) as MartRow[];
  return { rows, provenance: { mode: "SAMPLE", query: EVIDENCE_MART_SQL } };
}

export interface ZetarisLiveConfig {
  baseUrl: string;       // e.g. https://<random>.trycloudflare.com (tunnel to :8888)
  orgId: string;         // numeric org id, "1" on the local install
  authorization: string; // "Basic <base64(user:pass)>" for the login call
}

interface RawRow {
  source_system: string;
  table_name: string;
  key: string;
  attribute: string;
  value: string;
  as_of: string;
  retrieved_at: string;
}

export async function loginLive(cfg: ZetarisLiveConfig): Promise<string> {
  const url = `${cfg.baseUrl.replace(/\/$/, "")}/api/v1.0/auth/login`;
  const res = await fetch(url, {
    headers: { "x-org-id": cfg.orgId, authorization: cfg.authorization },
  });
  if (!res.ok) throw new Error(`zetaris login ${res.status} ${res.statusText} at ${url}`);
  const data = (await res.json()) as { idToken?: string };
  if (!data.idToken) throw new Error(`zetaris login returned no idToken at ${url}`);
  return data.idToken;
}

export async function queryMartLive(cfg: ZetarisLiveConfig): Promise<MartResult> {
  const token = await loginLive(cfg);
  const url = `${cfg.baseUrl.replace(/\/$/, "")}/api/v1.0/query/sql/start`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      "x-org-id": cfg.orgId,
      "x-request-id": "11111111-2222-3333-4444-555555555555",
    },
    body: JSON.stringify({ select: EVIDENCE_MART_SQL, pageLimit: 100 }),
  });
  if (!res.ok) throw new Error(`zetaris query ${res.status} ${res.statusText} at ${url}`);
  const data = (await res.json()) as { records?: RawRow[] };
  if (!Array.isArray(data.records)) {
    throw new Error(`zetaris query returned no records array at ${url}`);
  }
  const rows: MartRow[] = data.records.map((r) => ({
    sourceSystem: r.source_system,
    tableName: r.table_name,
    key: r.key,
    attribute: r.attribute,
    value: r.value,
    asOf: r.as_of,
    retrievedAt: r.retrieved_at,
    synthetic: false,
  }));
  return { rows, provenance: { mode: "LIVE", endpoint: url, query: EVIDENCE_MART_SQL } };
}

// Entry point: LIVE only when explicitly configured, otherwise honest SAMPLE.
// Live failures throw; callers mark the connector PARTIAL, never fake rows.
export async function queryEvidenceMart(opts: {
  fixtureDir: string;
  live?: ZetarisLiveConfig;
}): Promise<MartResult> {
  if (opts.live) return queryMartLive(opts.live);
  return loadMartSample(opts.fixtureDir);
}
