# Judging map (refreshed 2026-10-23, repo @ 6d3555e)

Weights: Impact 30 / Technical 20 / Innovation 15 / Demo 15 / UX 10 /
Sponsor tech 10.

## Impact (30)
- Problem: retail and small funds cannot tell evidence from echoed
  narrative; "10 links, 1 source" is the default state of biotech DD.
- Concrete, relatable case: ZURA / tibulizumab, real registry + SEC data.
- Output is decision-shaped: support, dissent, falsifiers with named
  watch-sources, unknowns. Not a summary - a break test.
- Evidence: samples/04-brief.txt; falsifier composer src/brief/compose.ts.

## Technical (20)
- H-MEM memory spine vendored, not re-implemented; Meterless conformance
  suite 13/13 (`npm run conformance`).
- 24/24 tests; deterministic extractors with span re-verification against
  stored bytes (registry, EDGAR XBRL, PubMed, issuer IR).
- asOf-ordered supersession: out-of-order sources never rewrite the present.
- Subject alias normalization: legal-suffix stripping shares update slots.
- Append-only trust ledger + machine-readable run manifests (logs/).
- Dockerfile self-testing; one-command run.
- Evidence: vendor/hmem, vendor/hmem-conformance, src/memory/thesisMemory.ts,
  test/thesis-memory.test.ts.

## Innovation (15)
- Claims-as-memories: dedupe = echo collapse, supersedes = registry update
  semantics. Update-vs-contradiction is first-class, not an LLM judgment call.
- Origin-family clustering (shingle containment) separates 1 origin / N
  repeats from independent corroboration (eval gold #10).
- Model proposes, verifier disposes: Nebius LLM extraction gated by a
  deterministic verbatim-quote verifier (hallucinated quotes rejected).
- Falsifiers are generated, observable, and each names its watch-source.

## Demo (15)
- 2:45 script in docs/demo-script.md; every beat is a real command.
- Two-phase demo shows update semantics live; brief shows falsifiers.
- Live segment proves real inference + verifier rejecting bad quotes.

## UX (10)
- CLI: analyze / demo / brief / dashboard / recall / audit, sample outputs committed.
- Static dashboard: `npx tsx src/cli.ts dashboard` renders the brief + run report
  to one self-contained HTML file (no server, no build): thesis, verified claims,
  updates vs contradictions, falsifiers, unknowns, monitoring, sources with
  synthetic flags, PARTIAL banner, lineage chips on every claim.
- PARTIAL semantics: failed connectors degrade honestly, never invent certainty.
- Every brief sentence carries memory ids resolvable via `audit mem-N`.

## Sponsor tech (10)
- Nebius Token Factory: live extraction (Qwen3-30B) + Nemotron judge,
  live-verified; committed model-call ledger proves real usage (`logs/model-ledger.jsonl`, never keys; eval gold #9).
- Zetaris: SQL evidence-mart connector live-verified 2026-10-23 against the
  local gateway (9/9 rows through api -> driver -> Spark; raw capture
  `samples/06-zetaris-live.txt`; inline VALUES executed by the gateway, zero
  mutation). SAMPLE export remains the provenance-tagged default.
- Meterless H-MEM: the engine, vendored with conformance proof.

## Declared honestly
- AI-assisted build; spec predates 22.10 00:00 UTC; fixture synthetic docs
  labeled; spend: ~5 Tavily credits, small Nebius token usage (ledger).
