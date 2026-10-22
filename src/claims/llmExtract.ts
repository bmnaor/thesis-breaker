// LLM claim extraction for free-text documents (LIVE mode). The model proposes
// candidate claims as strict JSON; deterministic code verifies every quote
// against the stored bytes before a candidate may become a claim. A quote that
// is not a verbatim substring of the source is rejected, not repaired.

import type { NebiusClient } from "../models/nebius.ts";
import type { DomainClaim, EvidenceSpan, Predicate } from "./types.ts";
import { SOURCE_PRIOR } from "./types.ts";
import { sha256, type FrozenDocument } from "../connectors/fixture.ts";

export const EXTRACT_PROMPT_VERSION = "extract-v1";

// Tolerant strict-JSON-array parse for OBJECT items (the vendored
// parseStrictJsonArray keeps strings only, by design for H-MEM mining).
export function parseCandidateArray(raw: string): CandidateClaim[] {
  let cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end <= start) return [];
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is CandidateClaim =>
        x && typeof x === "object" && typeof x.subject === "string" &&
        typeof x.predicate === "string" && typeof x.quote === "string" && x.object != null
    );
  } catch {
    return [];
  }
}

const SYSTEM = `You extract atomic, verifiable claims from ONE source document for an evidence-audit agent.

Rules:
- Each claim: one subject, one predicate, one object, with the EXACT verbatim quote from the document that proves it.
- quote must be copied character-for-character from the document. Never paraphrase the quote.
- predicate must be one of: trial_status, trial_enrollment, trial_primary_completion, trial_phase, trial_sponsor, guidance_event_date, cash_balance, cash_runway, financing_size, mechanism_targets, endpoint_definition, reported_result, management_statement.
- modality: observed (stated as fact), planned, estimated, opinion, rumor.
- Dates: ISO-8601 where the document gives them.
- Reply with a strict JSON array only. No prose, no markdown fences.
- Extract at most 8 claims, most load-bearing first.`;

export interface CandidateClaim {
  subject: string;
  predicate: string;
  object: string;
  modality: string;
  date?: string;
  quote: string;
}

export function candidatesToClaims(
  candidates: CandidateClaim[],
  doc: FrozenDocument
): { claims: DomainClaim[]; rejected: { candidate: CandidateClaim; reason: string }[] } {
  const prior = SOURCE_PRIOR[doc.ref.sourceClass];
  const claims: DomainClaim[] = [];
  const rejected: { candidate: CandidateClaim; reason: string }[] = [];
  const predicates: Predicate[] = ["trial_status","trial_enrollment","trial_primary_completion","trial_phase","trial_sponsor","guidance_event_date","cash_balance","cash_runway","financing_size","mechanism_targets","endpoint_definition","reported_result","management_statement"];
  for (const c of candidates) {
    if (!predicates.includes(c.predicate as Predicate)) {
      rejected.push({ candidate: c, reason: `invalid predicate ${c.predicate}` });
      continue;
    }
    if (!c.quote || !doc.text.includes(c.quote)) {
      rejected.push({ candidate: c, reason: "quote is not a verbatim substring of the source document" });
      continue;
    }
    const span: EvidenceSpan = { locatorType: "char", quote: c.quote, quoteSha256: sha256(c.quote) };
    const asOf = c.date && /^\d{4}-\d{2}-\d{2}/.test(c.date) ? c.date.slice(0, 10) : doc.ref.retrievedAt.slice(0, 10);
    const subject = c.subject.trim().toLowerCase();
    const object = String(c.object).trim();
    // Descriptive predicates are per-document snapshots (two releases may
    // phrase the same mechanism differently); status predicates carry the
    // update/supersede semantics.
    const DESCRIPTIVE = ["mechanism_targets", "endpoint_definition", "management_statement"];
    const slotKey = DESCRIPTIVE.includes(c.predicate)
      ? `${subject}|${c.predicate}|${doc.ref.documentId}`
      : `${subject}|${c.predicate}`;
    claims.push({
      claimKey: `${subject}|${c.predicate}|${object.toLowerCase()}|${doc.ref.documentId}`,
      slotKey,
      subject,
      predicate: c.predicate as Predicate,
      object,
      sentence: `${c.subject}: ${c.object} (${c.predicate}, ${doc.ref.publisher}${doc.ref.synthetic ? ", synthetic fixture" : ""}, as of ${asOf}). Source: "${c.quote.length > 160 ? c.quote.slice(0, 160) + "..." : c.quote}"`,
      modality: (["observed","planned","estimated","opinion","rumor"].includes(c.modality) ? c.modality : "observed") as DomainClaim["modality"],
      polarity: "asserts",
      asOf,
      qualifiers: { extractor: "llm", model_prompt: EXTRACT_PROMPT_VERSION },
      confidence: prior * 0.9, // LLM extraction confidence haircut vs deterministic
      source: doc.ref,
      span,
    });
  }
  return { claims, rejected };
}

export async function extractClaimsWithModel(
  client: NebiusClient,
  model: string,
  doc: FrozenDocument,
  maxChars = 12000
): Promise<{ claims: DomainClaim[]; rejected: { candidate: CandidateClaim; reason: string }[] }> {
  const text = doc.text.length > maxChars ? doc.text.slice(0, maxChars) : doc.text;
  const raw = await client.chat({
    model,
    promptVersion: EXTRACT_PROMPT_VERSION,
    purpose: `claim-extraction:${doc.ref.documentId}`,
    temperature: 0,
    maxTokens: 2000,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: `UNTRUSTED SOURCE DOCUMENT (${doc.ref.publisher}, retrieved ${doc.ref.retrievedAt}):\n"""\n${text}\n"""` },
    ],
  });
  const candidates = parseCandidateArray(raw);
  return candidatesToClaims(candidates, doc);
}
