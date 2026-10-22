// Deterministic claim extraction from SEC EDGAR JSON (submissions + XBRL
// companyfacts). Same contract as the registry extractor: JSON-pointer spans
// that re-verify against the stored bytes.

import type { DomainClaim, EvidenceSpan } from "./types.ts";
import { SOURCE_PRIOR } from "./types.ts";
import { sha256, type FrozenDocument } from "../connectors/fixture.ts";

function span(pointer: string, quote: string): EvidenceSpan {
  return { locatorType: "json_pointer", pointer, quote, quoteSha256: sha256(quote) };
}

interface XbrlFact {
  end?: string;
  val?: number;
  fy?: number;
  fp?: string;
  form?: string;
  filed?: string;
  accn?: string;
}

/** Latest cash balance from us-gaap:CashAndCashEquivalentsAtCarryingValue. */
export function extractCompanyFactsClaims(doc: FrozenDocument, symbol: string): DomainClaim[] {
  const root = JSON.parse(doc.text);
  const facts = root?.facts?.["us-gaap"]?.CashAndCashEquivalentsAtCarryingValue?.units?.USD as XbrlFact[] | undefined;
  if (!facts?.length) return [];
  const prior = SOURCE_PRIOR[doc.ref.sourceClass];
  const claims: DomainClaim[] = [];

  // One claim per distinct fiscal period end, latest filing wins per period.
  const byEnd = new Map<string, { fact: XbrlFact; idx: number }>();
  facts.forEach((fact, idx) => {
    if (fact.end && fact.val != null && fact.form && ["10-Q", "10-K", "20-F", "6-K"].includes(fact.form)) {
      const prev = byEnd.get(fact.end);
      if (!prev || (fact.filed ?? "") > (prev.fact.filed ?? "")) byEnd.set(fact.end, { fact, idx });
    }
  });

  // Keep the narrative readable: only periods ending within 18 months of the newest.
  const ends = [...byEnd.keys()].sort();
  const newest = ends[ends.length - 1];
  const cutoff = new Date(newest);
  cutoff.setMonth(cutoff.getMonth() - 18);
  const recentEnds = ends.filter((e) => new Date(e) >= cutoff);

  for (const end of recentEnds) {
    const { fact, idx } = byEnd.get(end)!;
    const usd = `$${(fact.val! / 1e6).toFixed(1)}M`;
    const pointer = `/facts/us-gaap/CashAndCashEquivalentsAtCarryingValue/units/USD/${idx}`;
    const quote = JSON.stringify(facts[idx]);
    const subject = `${symbol}@${end}`;
    claims.push({
      claimKey: `${subject}|cash_balance|${fact.val}`,
      slotKey: `${subject}|cash_balance`,
      subject,
      predicate: "cash_balance",
      object: String(fact.val),
      sentence: `${root.entityName ?? symbol} reported cash and cash equivalents of ${usd} as of ${end} (form ${fact.form}, filed ${fact.filed}).`,
      modality: "observed",
      polarity: "asserts",
      asOf: fact.filed ?? doc.ref.retrievedAt.slice(0, 10),
      qualifiers: { period_end: end, form: fact.form ?? "", filed: fact.filed ?? "", accession: fact.accn ?? "" },
      confidence: prior,
      source: doc.ref,
      span: span(pointer, quote),
    });
  }
  return claims;
}

/** Recent filing events from the submissions API (8-K/10-Q/10-K/S-8 etc.). */
export function extractFilingEventClaims(doc: FrozenDocument, symbol: string, limit = 5): DomainClaim[] {
  const root = JSON.parse(doc.text);
  const recent = root?.filings?.recent;
  if (!recent?.form?.length) return [];
  const prior = SOURCE_PRIOR[doc.ref.sourceClass];
  const claims: DomainClaim[] = [];
  const keep = new Set(["8-K", "10-Q", "10-K", "6-K", "20-F", "S-1", "S-3", "424B5"]);
  let kept = 0;
  for (let i = 0; i < recent.form.length && kept < limit; i++) {
    const form: string = recent.form[i];
    if (!keep.has(form)) continue;
    kept++;
    const date: string = recent.filingDate[i];
    const accn: string = recent.accessionNumber[i];
    const reportDate: string | undefined = recent.reportDate?.[i] || undefined;
    const subject = `${symbol}#${accn}`;
    const pointer = `/filings/recent/accessionNumber/${i}`;
    const quote = JSON.stringify(recent.accessionNumber[i]);
    claims.push({
      claimKey: `${subject}|guidance_event_date|${form}-${date}`,
      slotKey: `${subject}|guidance_event_date`,
      subject,
      predicate: "guidance_event_date",
      object: `${form} filed ${date}`,
      sentence: `${root.name ?? symbol} filed form ${form} on ${date}${reportDate ? ` (report period ${reportDate})` : ""} (accession ${accn}).`,
      modality: "observed",
      polarity: "asserts",
      asOf: date,
      qualifiers: { form, accession: accn, ...(reportDate ? { report_period: reportDate } : {}) },
      confidence: prior,
      source: doc.ref,
      span: span(pointer, quote),
    });
  }
  return claims;
}
