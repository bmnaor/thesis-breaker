# Demo video (v2, rendered 2026-10-23)

Format: a 2:14 captioned walkthrough assembled from real captured outputs
(terminal excerpts + dashboard renders) - NOT a continuous screen recording.
No voiceover, no one on camera. Every beat is labeled SAMPLE (frozen demo
fixtures) or LIVE (real run, source named).

Canonical thesis wording (single wording across video, dashboard, brief):
"Tibulizumab's dual IL-17A/BAFF blockade shows meaningful Phase-2 efficacy in
hidradenitis suppurativa (topline Q4 2026), to be confirmed in systemic
sclerosis (H1 2027)." - always labeled HYPOTHESIS (efficacy UNPROVEN, no
reported result in the graph). Any older wording in git history predates the
semantic-fix pass and is superseded.

## Beat list (as rendered)

| Time | Beat | Source | Label |
| --- | --- | --- | --- |
| 0:00-0:10 | Hook: "Ten links can still be one source." | title card | - |
| 0:10-0:17 | Format honesty card (walkthrough, SAMPLE/LIVE legend) | title card | - |
| 0:17-0:30 | Thesis under test (hypothesis), agent-proposed wording | canonical ZURA_THESIS | SAMPLE |
| 0:30-0:45 | Two-phase update: [created] mem-2 vs [updated] mem-7 supersedes | samples/02 | SAMPLE |
| 0:45-1:01 | Falsifier (completion passed, no topline) + UNPROVEN unknown | samples/04 | SAMPLE |
| 1:01-1:13 | Recall + echo collapse (one origin family) | samples/03 | SAMPLE |
| 1:13-1:27 | Live extraction: 45 verified / 2 verbatim-verifier rejections | samples/05 | LIVE - Nebius |
| 1:27-1:43 | Dashboard panels (rendered from graph state, degraded-run honest) | `dashboard` CLI output | SAMPLE |
| 1:43-1:54 | Zetaris gateway SQL on a nine-row inline VALUES evidence relation, zero mutation | samples/06 | LIVE - Zetaris |
| 1:54-2:06 | Reproducibility: conformance 13/13, tests 30/30, Docker build | fresh runs | - |
| 2:06-2:14 | Close: "It doesn't tell you what to buy..." + repo URL | title card | - |

Fixture note: frozen fixture `fixtures/zura-2026-10-22/` (real
ClinicalTrials.gov + SEC EDGAR captures from 2026-10-22; synthetic documents
labeled in the manifest). Live beats use Nebius Token Factory and the Zetaris
evidence mart (live path verified 2026-10-23 against a local gateway; no live
external-source federation is demonstrated in this slice).
