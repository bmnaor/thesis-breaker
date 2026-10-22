# thesis-breaker

An evidence-backed market catalyst agent that builds a claim graph with source provenance, detects contradictions, and identifies thesis falsifiers. A hackathon project for Open Agent 2026 and the Nebius Global AI Hackathon.

The agent takes a biotech ticker and an investment thesis, pulls primary sources (SEC EDGAR, ClinicalTrials.gov, issuer IR, PubMed, web search), separates real evidence from echoed narrative, and explains **why** the thesis holds or breaks. It never tells you what to buy.

## Quick start (no keys, no network)

```bash
npm install
npm test                 # 16 tests: engine smoke + claim-memory integration
npm run conformance      # Meterless H-MEM conformance suite (13/13)
npm run demo             # two-phase ZURA run: update vs contradiction, live
npx tsx src/cli.ts recall "TibuSHIELD enrollment"   # hybrid memory recall
npx tsx src/cli.ts audit mem-6                      # claim lineage from the trust ledger
```

Everything above runs in `SAMPLE` mode on frozen, hash-verified fixtures under
`fixtures/zura-2026-10-22/` (real ClinicalTrials.gov API capture of NCT06993610
and a real SEC EDGAR capture for Zura Bio Ltd, CIK 1855644, both retrieved
2026-10-22, plus one clearly-labeled synthetic older registry snapshot used to
exercise update-vs-contradiction semantics). Copy `.env.example` to `.env` for
live mode (Nebius Token Factory inference, Tavily search, optional local
Zetaris gateway).

## Where the Meterless engine is used

The claim graph **is** an H-MEM memory spine (vendored from
`github.com/Meterless/Meterless`, `engines/hmem/reference` -> `vendor/hmem`,
Apache-2.0). Nothing is re-implemented or faked:

| Thesis Breaker concept | H-MEM service | Spec section |
|---|---|---|
| Claim record (source + provenance mandatory) | MemoryStoreService (`add` rejects sourceless writes) | AGENTS.md 2, 3 |
| Registry/filing update (newer supersedes older) | `supersedes` / `supersededBy` edges, ranking penalty | AGENTS.md 2, 6, 10 |
| Echoed narrative (same claim, many pages) | claim-key dedupe: one memory, not N confirmations | AGENTS.md 3 |
| "What changed since last run" / warm runs | MemoryRetrievalService hybrid recall + reinjection trace | AGENTS.md 6 |
| Run manifest, claim lineage, auditability | TrustLedgerService append-only history | AGENTS.md 9 |
| Contradiction candidates (later slice) | ConflictDetectionService 0.70 auto-resolve gate | AGENTS.md 10 |

`npm run conformance` runs Meterless's own H-MEM conformance suite against the
vendored engine (`vendor/hmem-conformance`): **13/13 checks pass.**

## What works today (build-day 1 slice)

- Frozen fixture loading with SHA-256 integrity checks (`src/connectors/fixture.ts`).
- Deterministic ClinicalTrials.gov v2 claim extraction with JSON-pointer spans
  that are re-verified against the stored bytes before a claim may enter memory
  (`src/claims/registryExtract.ts`). Unverifiable claims are rejected, not trusted.
- Claim -> memory recording with dedupe / update / create semantics, lineage
  audit, and a machine-readable run manifest written to `logs/`
  (`src/memory/thesisMemory.ts`, `src/orchestrator/analyze.ts`).
- CLI demo + recall + audit (`src/cli.ts`). Sample outputs in `samples/`.

Named gaps (honest roadmap): EDGAR/IR/PubMed/Tavily extractors (the EDGAR
document is already frozen in the fixture and is loudly SKIPPED), LLM
extraction path on Nebius, contradiction judge, brief composer, Zetaris SQL
evidence mart, web UI.

## Stack note

The original 2026-09-18 spec proposed Python/FastAPI/Postgres. When the
hackathon rules changed (2026-10-14) to require a real Meterless engine
integration, the stack moved to TypeScript so the actual H-MEM engine runs
in-process; the domain model, pipeline stages, and evaluation plan carry over
unchanged (see `docs/spec/` for the original spec).

## Honesty notes

- AI use: this project is built with AI coding agents (declared in the
  submission). No claim, log, or result in this repo is hardcoded: every number
  in the demo output is extracted at run time from the frozen source bytes,
  and every citation re-verifies against them.
- The synthetic fixture file is labeled synthetic in its manifest entry and in
  every memory tag it produces.
- Pre-existing work: product spec and connector design predate the 22.10 build
  window (authored 2026-09-18, declared in the submission). All code was
  written inside the window.

## License

Apache-2.0 (see LICENSE). Vendored H-MEM engine: Apache-2.0, Meterless.
