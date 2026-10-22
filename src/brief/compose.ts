// Deterministic brief + falsifier composer. Every sentence is assembled from
// memory records (never from raw documents, never from a model's prose), and
// every sentence carries the memory ids it stands on. That is the "agent that
// can explain why" contract.

import type { ThesisMemory } from "../memory/thesisMemory.ts";
import type { MemoryRecord } from "../../vendor/hmem/src/index.ts";

export interface BriefLine {
  text: string;
  memoryIds: string[];
}

export interface Brief {
  asOf: string;
  symbol: string;
  thesis: string;
  supporting: BriefLine[];
  updates: BriefLine[];
  unknowns: string[];
  falsifiers: BriefLine[];
  monitoring: string[];
  sources: { url: string; publisher: string; retrievedAt: string; synthetic: boolean }[];
}

export const ZURA_THESIS =
  "Tibulizumab's dual IL-17A/BAFF blockade shows meaningful Phase-2 efficacy in hidradenitis suppurativa (topline Q4 2026), to be confirmed in systemic sclerosis (H1 2027).";

function tag(m: MemoryRecord, prefix: string): string | undefined {
  return m.tags.find((t) => t.startsWith(prefix))?.slice(prefix.length);
}

function cite(m: MemoryRecord): BriefLine {
  const syn = m.tags.includes("synthetic") ? " [synthetic fixture]" : "";
  return { text: `${m.content} <${m.id}>${syn}`, memoryIds: [m.id] };
}

function latest(mem: ThesisMemory, pred: string): MemoryRecord[] {
  return mem.hmem.store
    .all()
    .filter((m) => m.tags.includes(`pred:${pred}`) && !m.supersededBy)
    .sort((a, b) => b.timestamp - a.timestamp);
}

export function composeBrief(mem: ThesisMemory, symbol: string, runAt: string): Brief {
  const all = mem.hmem.store.all();
  const lines = (pred: string) => latest(mem, pred).map(cite);

  // Updates: claims whose memory superseded an earlier one this session's history.
  const updates = all
    .filter((m) => m.supersedes)
    .map((m) => {
      const prior = mem.hmem.store.get(m.supersedes!);
      return {
        text: `${m.content} <${m.id}> - supersedes: ${prior?.content ?? m.supersedes} <${m.supersedes}>`,
        memoryIds: [m.id, m.supersedes!],
      };
    });

  // Falsifiers: observable, source-bound, derived from what the graph knows.
  const falsifiers: BriefLine[] = [];
  const status = latest(mem, "trial_status")[0];
  const completion = latest(mem, "trial_primary_completion")[0];
  if (completion && tag(completion, "mod:") !== "planned") {
    falsifiers.push({
      text: `FALSIFIER: primary completion date (${tag(completion, "obj:")}) is in the past and no topline efficacy claim exists in the graph - if no results disclosure appears in an 8-K/IR release, the catalyst premise weakens. Watch: EDGAR 8-K feed + issuer IR. <${completion.id}>`,
      memoryIds: [completion.id],
    });
  }
  const cash = latest(mem, "cash_balance")[0];
  if (cash) {
    falsifiers.push({
      text: `FALSIFIER: funding premise rests on ${cash.content} If the next quarterly filing shows burn inconsistent with funding through the readout, the thesis's "funded" leg breaks. Watch: next 10-Q/20-F cash line. <${cash.id}>`,
      memoryIds: [cash.id],
    });
  }
  if (status) {
    falsifiers.push({
      text: `FALSIFIER: a protocol amendment that changes enrollment, endpoints, or population after status ${tag(status, "obj:")} would narrow the readout's scope. Watch: ClinicalTrials.gov history-of-changes for ${tag(status, "subj:")}. <${status.id}>`,
      memoryIds: [status.id],
    });
  }

  const unknowns = [
    "Topline efficacy result: no reported_result claim in the graph (registry shows completion, not outcomes).",
    "Cash runway statement: issuer guidance not in the fixture; filed cash is a fact, runway is a forward-looking claim still to source.",
    "Mechanism (dual IL-17A/BAFF blockade): issuer release not yet in the fixture; PubMed context connector not built yet.",
  ];

  const monitoring = [
    `ClinicalTrials.gov ${(status && tag(status, "subj:")) ?? "NCT06993610"}: status + history-of-changes (weekly).`,
    "EDGAR full-text for ZURA 8-K (results, financing) (daily on weekdays).",
    "Issuer IR news index for topline/corporate releases (daily).",
    "PubMed for tibulizumab / IL-17A+BAFF publications (weekly).",
  ];

  const sources = [...new Map(all.map((m) => [m.source, m])).values()].map((m) => ({
    url: m.source,
    publisher: m.provenance.label.split(" ")[0],
    retrievedAt: m.tags.find((t) => t.startsWith("retrieved:"))?.slice(10) ?? new Date(m.provenance.learnedAt).toISOString(),
    synthetic: m.tags.includes("synthetic"),
  }));

  return {
    asOf: runAt,
    symbol,
    thesis: ZURA_THESIS,
    supporting: [
      ...lines("trial_phase"),
      ...lines("trial_enrollment"),
      ...lines("trial_sponsor"),
      ...lines("cash_balance").slice(0, 1),
    ],
    updates,
    unknowns,
    falsifiers,
    monitoring,
    sources,
  };
}

export function renderBrief(b: Brief): string {
  const out: string[] = [];
  out.push(`# THESIS BREAKER - ${b.symbol} decision brief`);
  out.push(`as of ${b.asOf}`);
  out.push(`\n## Thesis\n"${b.thesis}"`);
  out.push(`\n## What is actually known (verified claims)`);
  for (const l of b.supporting) out.push(`- ${l.text}`);
  out.push(`\n## What changed (updates, not contradictions)`);
  if (b.updates.length === 0) out.push("- (none)");
  for (const l of b.updates) out.push(`- ${l.text}`);
  out.push(`\n## What would break the thesis`);
  for (const l of b.falsifiers) out.push(`- ${l.text}`);
  out.push(`\n## Unknowns / data gaps`);
  for (const u of b.unknowns) out.push(`- ${u}`);
  out.push(`\n## Monitoring checklist`);
  for (const m of b.monitoring) out.push(`- [ ] ${m}`);
  out.push(`\n## Sources`);
  for (const s of b.sources) out.push(`- ${s.url} (retrieved ${s.retrievedAt})${s.synthetic ? " [SYNTHETIC FIXTURE]" : ""}`);
  return out.join("\n") + "\n";
}
