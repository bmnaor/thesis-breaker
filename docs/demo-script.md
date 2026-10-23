# Demo script (refreshed 2026-10-23, matches repo @ 6d3555e)

Target: 2:45 video. Everything shown is a real command with real output;
no mocked terminal. Frozen fixture `fixtures/zura-2026-10-22/` (real
ClinicalTrials.gov + SEC EDGAR captures from 2026-10-22, synthetic docs
clearly labeled). One live segment uses Nebius Token Factory for real.

Spec reference: docs/spec/03-demo-ui-repo.md (the dashboard wireframe there is
the future web UI; this demo runs the CLI, which exercises the same engine).

## Shot list

**0:00-0:15 - Hook.** Show three browser tabs: a small-cap wire article, a
forum post, a blog - all quoting the same Zura Bio press release.
"Ten links can still be one source. Thesis Breaker turns narrative into
claims, evidence, contradictions, and explicit ways the thesis can fail."

**0:15-0:30 - Input.** Terminal: `npm run demo`. Narrate the thesis sentence:
"Tibulizumab's HS Phase-2 catalyst is on track and the company is funded
through the readout."

**0:30-0:55 - Two-phase run (samples/02-demo-two-phase-update.txt).**
Phase 1: an older registry snapshot says RECRUITING. Phase 2: today's
registry capture says ACTIVE_NOT_RECRUITING, enrollment 247 actual.
The engine records this as an UPDATE (newer supersedes older), not a
timeless contradiction. This is the distinction most tools get wrong.

**0:55-1:25 - Decision brief (samples/04-brief.txt).** `npx tsx src/cli.ts brief ZURA`.
Every sentence carries the memory ids it stands on. Highlight the three
falsifiers, each with a named source to watch: (1) primary completion date
2026-09-18 has passed with no topline claim - watch EDGAR 8-K + issuer IR;
(2) funding leg rests on $205.1M cash @ 2026-06-30 - watch next 10-Q;
(3) protocol amendment watch - ClinicalTrials.gov history-of-changes.

**1:25-1:50 - Echo collapse.** Origin-family clustering: the three commentary
pages collapse to `1 origin, N repeats`; dedupe means one memory, not N
confirmations. `npx tsx src/cli.ts recall "TibuSHIELD enrollment"` shows
hybrid memory recall; `npx tsx src/cli.ts audit mem-2` shows full lineage
from the append-only trust ledger.

**1:50-2:15 - Live extraction.** `npm run analyze -- --live`. Real Nebius
Token Factory call (Qwen3-30B) proposes claims from issuer releases; a
deterministic verifier rejects any quote not verbatim in the stored bytes
(on the fixture: 6 accepted, 2 hallucinated quotes rejected). The model
proposes, the engine disposes. Model-call ledger in logs/ records model id,
latency, prompt version for every call.

**2:15-2:25 - Dashboard.** `npx tsx src/cli.ts dashboard` then open the file:
the same brief as a visual dashboard - falsifiers in red, PARTIAL banner naming
the skipped connectors, synthetic sources flagged, every claim carrying its
mem-N lineage chip.

**2:25-2:50 - Technical proof.** `npm run conformance` - Meterless's own
H-MEM conformance suite, 13/13 against the vendored engine (nothing
re-implemented). `npm test` - 24/24. Subject alias normalization:
"Zura Bio Limited" and "Zura Bio" share one update slot. Dockerfile is
self-testing. Public repo, one-command run.

**2:50-3:00 - Close.** "It doesn't tell you what to buy. It tells you what
your thesis stands on - and what would break it."

## Honesty notes (must stay in the video)

- Synthetic docs (older registry snapshot, 3 echo pages) are labeled
  synthetic, say so on screen when they appear.
- Zetaris slice: if the gateway window happens before recording, show the
  real SQL evidence-mart query; otherwise the connector runs in SAMPLE mode
  and the PARTIAL banner says so. Never present SAMPLE as live.
- Pre-existing code (spec predates 22.10) and AI-assisted build are declared
  in the submission text.
