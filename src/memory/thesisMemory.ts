// ThesisMemory: the Thesis Breaker claim graph lives in a real H-MEM engine
// (vendored Meterless reference, vendor/hmem). This is the sponsor-tech spine:
//
//   claim            -> H-MEM memory record (source + provenance mandatory)
//   update relation  -> supersedes / supersededBy edges (never delete history)
//   repeated claim   -> dedupe against claimKey tag, one memory, not N echoes
//   auditability     -> TrustLedgerService: every mutation append-only logged
//   warm runs        -> MemoryRetrievalService hybrid recall across restarts
//
// All engine semantics come from vendor/hmem (AGENTS.md sections 2, 3, 6, 9).

import { HMEM } from "../../vendor/hmem/src/index.ts";
import type { LedgerEntry, MemoryRecord, QueryResult } from "../../vendor/hmem/src/index.ts";
import type { DomainClaim } from "../claims/types.ts";

export interface ThesisMemoryOptions {
  persistDir?: string;
  clock?: () => number;
  actor?: string;
}

export type RecordAction = "created" | "updated" | "duplicate";

export interface RecordResult {
  claim: DomainClaim;
  action: RecordAction;
  memory: MemoryRecord;
  supersedesMemoryId?: string;
}

const KEY = (claim: DomainClaim) => `key:${claim.claimKey}`;
const SLOT = (claim: DomainClaim) => `slot:${claim.slotKey}`;

export class ThesisMemory {
  readonly hmem: HMEM;

  constructor(opts: ThesisMemoryOptions = {}) {
    this.hmem = new HMEM({
      clock: opts.clock,
      persistDir: opts.persistDir,
      actor: opts.actor ?? "thesis-breaker",
    });
  }

  private findByTag(tag: string): MemoryRecord[] {
    return this.hmem.store.all().filter((m) => m.tags.includes(tag));
  }

  /** Record one domain claim. Returns what the engine did, honestly. */
  recordClaim(claim: DomainClaim): RecordResult {
    // 1. Exact claim already known? One memory, not a second confirmation.
    const sameKey = this.findByTag(KEY(claim));
    if (sameKey.length > 0) {
      return { claim, action: "duplicate", memory: sameKey[0] };
    }

    // 2. Same subject+predicate slot with a different object? That is an
    //    update: the new record supersedes the newest prior one, and the
    //    prior is marked supersededBy (penalized in ranking, never deleted).
    const priorInSlot = this.findByTag(SLOT(claim))
      .filter((m) => !m.supersededBy)
      .sort((a, b) => b.timestamp - a.timestamp);
    const prior = priorInSlot[0];

    const memory = this.hmem.add({
      content: claim.sentence,
      type: "factual",
      layer: "long_term",
      tags: [
        "claim",
        `pred:${claim.predicate}`,
        KEY(claim),
        SLOT(claim),
        `class:${claim.source.sourceClass}`,
        ...(claim.source.synthetic ? ["synthetic"] : []),
      ],
      confidence: claim.confidence,
      source: claim.source.canonicalUrl,
      provenance: {
        origin: "document",
        learnedAt: this.hmem.clock(),
        label: `${claim.source.publisher} ${claim.span.pointer ?? claim.span.locatorType} (retrieved ${claim.source.retrievedAt}, as of ${claim.asOf})`,
        refs: [claim.source.documentId, claim.span.quoteSha256],
      },
      supersedes: prior?.id,
    });

    if (prior) {
      this.hmem.store.update(prior.id, { supersededBy: memory.id });
      return { claim, action: "updated", memory, supersedesMemoryId: prior.id };
    }
    return { claim, action: "created", memory };
  }

  recordClaims(claims: DomainClaim[]): RecordResult[] {
    return claims.map((c) => this.recordClaim(c));
  }

  /** Hybrid recall with the engine's reinjection block and scoring trace. */
  recall(query: string, opts?: { topN?: number }): QueryResult {
    return this.hmem.query(query, { topN: opts?.topN ?? 5, threshold: 0 });
  }

  /** Append-only audit history of one memory (claim lineage). */
  audit(memoryId: string): LedgerEntry[] {
    return this.hmem.ledger.history(memoryId);
  }

  /** Machine-readable run manifest from the trust ledger (spec section 1). */
  manifest(): { memories: number; ledgerEntries: number; byAction: Record<string, number> } {
    const entries = this.hmem.ledger.all();
    const byAction: Record<string, number> = {};
    for (const e of entries) byAction[e.action] = (byAction[e.action] ?? 0) + 1;
    return { memories: this.hmem.store.all().length, ledgerEntries: entries.length, byAction };
  }
}
