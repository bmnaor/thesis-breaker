// Origin-family clustering: which documents are truly independent, and which
// are the same story repeated? Repeated syndication counts as ONE origin, not
// several confirmations (product spec, MVP criteria; eval gold #10).
//
// Method: word 5-gram (shingle) Jaccard over normalized text. A document that
// quotes/copies another lands in that document's family; the family root is
// the member with the highest source-class prior (issuer/registry beat
// commentary). Deterministic, no embeddings needed at this scale.

import { SOURCE_PRIOR, type SourceRef } from "./types.ts";
import type { FrozenDocument } from "../connectors/fixture.ts";

export function shingles(text: string, n = 5): Set<string> {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + n <= words.length; i++) out.add(words.slice(i, i + n).join(" "));
  return out;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

// Containment: what fraction of the smaller document's shingles appear in the
// larger one. A commentary page quoting one block of a long release is a copy
// even though full Jaccard is small.
export function containment(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / Math.min(a.size, b.size);
}

export interface FamilyMap {
  familyOf: Map<string, string>;   // documentId -> root documentId
  similarity: Map<string, number>; // "docA|docB" -> jaccard, for the audit trail
}

const CONTAIN_THRESHOLD = 0.5; // half of the smaller doc inside the larger = same origin

export function assignFamilies(docs: FrozenDocument[]): FamilyMap {
  const familyOf = new Map<string, string>();
  const similarity = new Map<string, number>();
  // Sort by source prior descending so roots are claimed by the most
  // authoritative member first.
  const ordered = [...docs].sort(
    (a, b) => SOURCE_PRIOR[b.ref.sourceClass] - SOURCE_PRIOR[a.ref.sourceClass]
  );
  const shingleCache = new Map<string, Set<string>>();
  const sh = (d: FrozenDocument) => {
    if (!shingleCache.has(d.ref.documentId)) shingleCache.set(d.ref.documentId, shingles(d.text));
    return shingleCache.get(d.ref.documentId)!;
  };
  for (const doc of ordered) {
    let root: string | undefined;
    let best = 0;
    for (const other of ordered) {
      if (other.ref.documentId === doc.ref.documentId) break; // only earlier (higher-prior) docs
      const sim = containment(sh(doc), sh(other));
      similarity.set(`${doc.ref.documentId}|${other.ref.documentId}`, Number(sim.toFixed(3)));
      if (sim >= CONTAIN_THRESHOLD && sim > best) {
        best = sim;
        root = familyOf.get(other.ref.documentId) ?? other.ref.documentId;
      }
    }
    familyOf.set(doc.ref.documentId, root ?? doc.ref.documentId);
  }
  return { familyOf, similarity };
}

/** Distinct origin families asserting the given claim-object pattern. */
export function independenceCount(refs: { source: SourceRef & { originFamilyId?: string } }[]): number {
  return new Set(refs.map((r) => r.source.originFamilyId ?? r.source.documentId)).size;
}
