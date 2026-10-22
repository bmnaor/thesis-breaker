// Deterministic claim extraction from ClinicalTrials.gov API v2 JSON.
// SAMPLE_MODE extractor: pure structured-field reads, no model. Every claim
// carries a JSON pointer whose quote re-selects from the stored document,
// which is what makes its citation verifiable (spec section 5 step 10).

import type { DomainClaim, EvidenceSpan, Modality } from "./types.ts";
import { SOURCE_PRIOR } from "./types.ts";
import { sha256, type FrozenDocument } from "../connectors/fixture.ts";

interface DateStruct { date?: string; type?: string }

function modalityOf(type?: string): Modality {
  if (type === "ACTUAL") return "observed";
  if (type === "ESTIMATED") return "estimated";
  return "planned";
}

function span(pointer: string, quote: string): EvidenceSpan {
  return { locatorType: "json_pointer", pointer, quote, quoteSha256: sha256(quote) };
}

function get(obj: unknown, path: string[]): unknown {
  return path.reduce((o: unknown, k) => (o as Record<string, unknown>)?.[k], obj);
}

// Verify a span's quote still re-selects from the source document.
export function verifySpan(doc: FrozenDocument, s: EvidenceSpan): boolean {
  if (s.locatorType === "char") return doc.text.includes(s.quote);
  if (s.locatorType !== "json_pointer" || !s.pointer) return false;
  const parts = s.pointer.split("/").filter(Boolean);
  const value = get(JSON.parse(doc.text), parts);
  return JSON.stringify(value) === s.quote;
}

export function extractRegistryClaims(doc: FrozenDocument): DomainClaim[] {
  const root = JSON.parse(doc.text);
  const p = root.protocolSection;
  if (!p) throw new Error(`registry document ${doc.ref.documentId} has no protocolSection`);
  const nct: string = p.identificationModule.nctId;
  const brief: string = p.identificationModule.briefTitle ?? "";
  const status = p.statusModule;
  const design = p.designModule ?? {};
  const sponsor = p.sponsorCollaboratorsModule?.leadSponsor ?? {};
  const lastUpdate: string = status.lastUpdatePostDateStruct?.date ?? doc.ref.retrievedAt.slice(0, 10);
  const prior = SOURCE_PRIOR[doc.ref.sourceClass];
  const claims: DomainClaim[] = [];

  const mk = (
    predicate: DomainClaim["predicate"],
    object: string,
    sentence: string,
    modality: Modality,
    pointer: string,
    quote: string,
    qualifiers: Record<string, string> = {}
  ): DomainClaim => ({
    claimKey: `${nct}|${predicate}|${object.toLowerCase()}`,
    slotKey: `${nct}|${predicate}`,
    subject: nct,
    predicate,
    object,
    sentence,
    modality,
    polarity: "asserts",
    asOf: lastUpdate,
    qualifiers,
    confidence: prior,
    source: doc.ref,
    span: span(pointer, quote),
  });

  const sp = (ptr: string) => JSON.stringify(get(root, ptr.split("/").filter(Boolean)));

  claims.push(mk(
    "trial_status",
    status.overallStatus,
    `${nct} (${brief}) overall status is ${status.overallStatus} as of registry update ${lastUpdate}.`,
    "observed",
    "/protocolSection/statusModule/overallStatus",
    sp("/protocolSection/statusModule/overallStatus"),
    { trial: brief }
  ));

  if (design.enrollmentInfo?.count != null) {
    claims.push(mk(
      "trial_enrollment",
      String(design.enrollmentInfo.count),
      `${nct} enrollment is ${design.enrollmentInfo.count} (${(design.enrollmentInfo.type ?? "").toLowerCase()}) as of registry update ${lastUpdate}.`,
      modalityOf(design.enrollmentInfo.type),
      "/protocolSection/designModule/enrollmentInfo",
      sp("/protocolSection/designModule/enrollmentInfo")
    ));
  }

  const pcd: DateStruct | undefined = status.primaryCompletionDateStruct;
  if (pcd?.date) {
    claims.push(mk(
      "trial_primary_completion",
      pcd.date,
      `${nct} primary completion date is ${pcd.date} (${(pcd.type ?? "").toLowerCase()}) as of registry update ${lastUpdate}.`,
      modalityOf(pcd.type),
      "/protocolSection/statusModule/primaryCompletionDateStruct",
      sp("/protocolSection/statusModule/primaryCompletionDateStruct")
    ));
  }

  if (Array.isArray(design.phases) && design.phases.length) {
    claims.push(mk(
      "trial_phase",
      design.phases.join("+"),
      `${nct} is registered as ${design.phases.join(" + ")} as of registry update ${lastUpdate}.`,
      "observed",
      "/protocolSection/designModule/phases",
      sp("/protocolSection/designModule/phases")
    ));
  }

  if (sponsor.name) {
    claims.push(mk(
      "trial_sponsor",
      sponsor.name,
      `${nct} lead sponsor is ${sponsor.name} as of registry update ${lastUpdate}.`,
      "observed",
      "/protocolSection/sponsorCollaboratorsModule/leadSponsor",
      sp("/protocolSection/sponsorCollaboratorsModule/leadSponsor")
    ));
  }

  return claims;
}
