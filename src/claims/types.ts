// Domain model for Thesis Breaker claims (spec: 00-product-spec.md section 3).
// A claim is publishable only when deterministic code can resolve it to a
// stored evidence span. Models may propose claims; they never create provenance.

export type SourceClass =
  | "registry"        // ClinicalTrials.gov and similar official registries
  | "issuer_filing"   // SEC filings
  | "peer_reviewed"   // PubMed-indexed literature
  | "issuer_release"  // company press releases (interested source)
  | "reporting"       // independent reputable press
  | "commentary";     // analysts, social, blogs

export const SOURCE_PRIOR: Record<SourceClass, number> = {
  registry: 0.95,
  issuer_filing: 0.90,
  peer_reviewed: 0.85,
  issuer_release: 0.75,
  reporting: 0.70,
  commentary: 0.40,
};

export type Predicate =
  | "trial_status"
  | "trial_enrollment"
  | "trial_primary_completion"
  | "trial_phase"
  | "trial_sponsor"
  | "guidance_event_date"
  | "cash_balance"
  | "cash_runway"
  | "financing_size"
  | "mechanism_targets"
  | "endpoint_definition"
  | "reported_result"
  | "management_statement";

export type Modality = "observed" | "planned" | "estimated" | "opinion" | "rumor";

export interface EvidenceSpan {
  locatorType: "json_pointer" | "char" | "section";
  pointer?: string;          // e.g. /protocolSection/statusModule/overallStatus
  quote: string;             // exact text re-selectable from the stored document
  quoteSha256: string;
}

export interface SourceRef {
  documentId: string;        // fixture-relative id or sha256 of raw bytes
  originFamilyId?: string;   // root document of this doc's echo family (set at ingest)
  canonicalUrl: string;
  publisher: string;
  sourceClass: SourceClass;
  retrievedAt: string;       // ISO-8601 UTC
  publishedAt?: string;
  synthetic: boolean;        // true for controlled counterfactual fixtures
}

// Trial/indication scope, detected deterministically from claim text. Claims
// about different trials or indications are independent facts and must never
// share an update slot: "first to evaluate in HS" and "first to evaluate in
// systemic sclerosis" describe parallel trials, not newer/older versions.
export function claimScope(text: string): string {
  const scopes: string[] = [];
  const nct = text.match(/NCT\d{8}/i);
  if (nct) scopes.push(nct[0].toLowerCase());
  if (/tibushield/i.test(text)) scopes.push("tibushield");
  if (/tibusure/i.test(text)) scopes.push("tibusure");
  if (/hidradenitis suppurativa/i.test(text)) scopes.push("hs");
  if (/systemic sclerosis|scleroderma|\bssc\b/i.test(text)) scopes.push("ssc");
  return [...new Set(scopes)].join("+");
}

export interface DomainClaim {
  claimKey: string;          // subject|predicate|normalized object (dedupe identity)
  slotKey: string;           // subject|predicate (update detection)
  subject: string;           // e.g. "NCT06993610"
  predicate: Predicate;
  object: string;            // normalized value, e.g. "ACTIVE_NOT_RECRUITING"
  sentence: string;          // human-readable claim sentence
  modality: Modality;
  polarity: "asserts" | "denies";
  asOf: string;              // effective/asserted time (registry update date, filing period)
  qualifiers: Record<string, string>;
  confidence: number;        // source prior x extraction confidence
  source: SourceRef;
  span: EvidenceSpan;
  supersedesClaimKey?: string; // set when this claim replaces a prior claim in the same slot
}

export type ClaimRelation =
  | "equivalent" | "near_duplicate" | "supports" | "contradicts"
  | "narrows" | "broadens" | "updates" | "derived_from";
