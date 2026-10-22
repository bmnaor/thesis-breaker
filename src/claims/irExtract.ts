// Deterministic extraction from issuer press-release text (as captured).
// Issuer releases are interested sources: claims stay labeled issuer_release
// and never raise an independence count on their own.

import type { DomainClaim, EvidenceSpan } from "./types.ts";
import { SOURCE_PRIOR } from "./types.ts";
import { sha256, type FrozenDocument } from "../connectors/fixture.ts";

function charSpan(quote: string): EvidenceSpan {
  return { locatorType: "char", quote, quoteSha256: sha256(quote) };
}

/** Mechanism statement + study-launch event from the TibuSHIELD launch release. */
export function extractIssuerReleaseClaims(doc: FrozenDocument, drug: string, study: string): DomainClaim[] {
  const prior = SOURCE_PRIOR[doc.ref.sourceClass];
  const claims: DomainClaim[] = [];
  const text = doc.text;
  const date = text.match(/\b(\w+ \d{1,2}, \d{4})\b/)?.[1] ?? "";
  const MONTHS: Record<string, string> = { January: "01", February: "02", March: "03", April: "04", May: "05", June: "06", July: "07", August: "08", September: "09", October: "10", November: "11", December: "12" };
  const dm = date.match(/(\w+) (\d{1,2}), (\d{4})/);
  const asOf = dm ? `${dm[3]}-${MONTHS[dm[1]]}-${dm[2].padStart(2, "0")}` : doc.ref.retrievedAt.slice(0, 10);

  // Dual-mechanism sentence, e.g. "dual inhibition of B-cell activating factor (BAFF) and interleukin-17A (IL-17A)"
  const mechMatch = text.match(/[^.\n]*dual (?:inhibition|blockade)[^.\n]*/i);
  if (mechMatch) {
    const quote = mechMatch[0].replace(/^[*#\s]+/, "").trim();
    const targets = [...quote.matchAll(/\(([A-Z0-9-]{3,10})\)/g)].map((m) => m[1]);
    claims.push({
      claimKey: `${drug}|mechanism_targets|issuer|${targets.join("+").toLowerCase()}`,
      slotKey: `${drug}|mechanism_targets|issuer`,
      subject: drug,
      predicate: "mechanism_targets",
      object: targets.join(" + "),
      sentence: `Issuer states (${asOf}): "${quote}"`,
      modality: "observed",
      polarity: "asserts",
      asOf,
      qualifiers: { assertion: "issuer_assertion" },
      confidence: prior,
      source: doc.ref,
      span: charSpan(quote),
    });
  }

  // Launch event from the release title.
  const titleMatch = text.match(/# ([^\n]*TibuSHIELD[^\n]*)/i) ?? text.match(/## ([^\n]*TibuSHIELD[^\n]*)/i);
  if (titleMatch) {
    const quote = titleMatch[1].trim();
    claims.push({
      claimKey: `${study}|guidance_event_date|launch|${asOf}`,
      slotKey: `${study}|guidance_event_date|launch`,
      subject: study,
      predicate: "guidance_event_date",
      object: `study launched ${asOf}`,
      sentence: `Issuer announced (${asOf}): "${quote}". Announcement of a start is an event claim, not evidence of completion.`,
      modality: "observed",
      polarity: "asserts",
      asOf,
      qualifiers: { assertion: "issuer_assertion", event: "study_launch" },
      confidence: prior,
      source: doc.ref,
      span: charSpan(quote),
    });
  }
  return claims;
}
