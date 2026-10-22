# Demo, Dashboard, Repository, and Container Plan

## Dashboard wireframe

```text
+--------------------------------------------------------------------------------+
| THESIS BREAKER   [ZURA] [Biotech]   As of 2026-10-19 14:32 UTC  [Run analysis] |
+----------------------+---------------------------------------------------------+
| Thesis              | Decision brief                                          |
| "Phase 2 catalyst..."| SUPPORT  3 evidence families                            |
| Snapshot             | DISSENT  2 unresolved / weakening claims                 |
| Evidence coverage 82%| FALSIFIERS  4 observable tests                          |
| Freshness 74%        | [Claim card] Registry says... conf 0.91 decay -0.04     |
| Sources 5/5          | [issuer][registry] [Open lineage]                        |
| Failures 0           |                                                         |
+----------------------+---------------------------+-----------------------------+
| Monitoring checklist| Claim lineage graph       | Dissent inspector           |
| [ ] NCT status       | source -> span -> claim   | Older claim / newer claim   |
| [ ] 8-K/6-K          | -> relation -> brief line | scope, time, independence   |
| [ ] IR release       | support/oppose/update/    | Judge reason + raw quotes   |
| [ ] PubMed           | repeated narrative       |                             |
+----------------------+---------------------------+-----------------------------+
```

Clicking a citation opens exact quote, context, publisher, source class, all timestamps, content hash, and URL. Claim cards expose score components. A clock badge explains decay. Dissent shows support versus oppose/update and highlights qualifier mismatches. Repetition collapses to `1 origin, N repeats`. The graph defaults to selected-sentence lineage to avoid a hairball. A persistent `PARTIAL` banner names failed connectors and blind spots. Export Markdown and JSON.

## <=3-minute ZURA video

Use a frozen 2026-10-19 fixture and label its capture time. Optionally run one live connector afterward.

- **0:00-0:15 Hook:** Show three headlines. "Ten links can still be one source. Thesis Breaker turns narrative into claims, evidence, contradictions, and explicit ways the thesis can fail."
- **0:15-0:30 Input:** Enter ZURA and "Tibulizumab's HS Phase 2 catalyst is on track and the company is funded through the readout." Run. Show the bounded source plan.
- **0:30-0:52 Run:** Identifiers resolved, documents fetched, mirrors clustered, claims extracted, relations judged, citations verified. A failed connector yields PARTIAL, not invented certainty.
- **0:52-1:28 Evidence:** Open the ClinicalTrials.gov evidence for NCT06993610 and issuer launch statement. Open cash/runway and show filed cash versus management guidance.
- **1:28-1:57 Break narrative:** Multiple pages collapse to one issuer origin. An older versus newer registry status is `updates`, not a timeless contradiction.
- **1:57-2:24 Falsifiers:** Milestone slip, material protocol/endpoint change, financing/runway premise change, and efficacy/safety below the user-set threshold. Each has a source to watch.
- **2:24-2:43 Monitoring:** Show checklist, time decay, Markdown/JSON export.
- **2:43-2:58 Technical proof:** Show architecture and model-call ledger: real Nebius Token Factory call, NVIDIA Nemotron judge, model ID, latency, prompt version, public repo, one-command launch.
- **2:58-3:00:** "It doesn't tell you what to buy. It tells you what your thesis stands on, and what would break it."

Target 2:45. Do not show dependency installation.

## Repository

```text
thesis-breaker/
  README.md LICENSE SECURITY.md FAILURE_MODES.md ARCHITECTURE.md
  docker-compose.yml Dockerfile Makefile .env.example pyproject.toml
  apps/api/ apps/web/
  thesis_breaker/
    orchestrator/ connectors/ normalize/ claims/ graph/ briefs/
    models/ storage/ security/
  migrations/ prompts/
  eval/{documents,gold_claims.jsonl,expected_relations.jsonl,cached_outputs}/
  fixtures/zura-2026-10-19/{manifest.json,raw,expected}/
  tests/{unit,integration,adversarial}/
  scripts/{capture_fixture.py,verify_citations.py,demo_reset.py}
  docs/{demo-script.md,judging-map.md}
  .github/workflows/ci.yml
```

## One-command container

```bash
cp .env.example .env   # fill keys once
docker compose up --build
```

Serve UI at `http://localhost:3000`; API health at `/api/health`. Compose creates Postgres, migrates, loads the ZURA fixture in `DEMO_MODE=fixture`, then marks UI ready.

Also provide `make demo`, `make run-live ASSET=ZURA`, `make eval`, and `make clean-demo`. Use multi-stage builds, non-root runtime, pinned lockfiles, amd64 support, health checks, no secrets in image/logs, and a 2 GB target maximum. CLI fallback: `docker compose run --rm app analyze ZURA --fixture zura-2026-10-19`.

`FAILURE_MODES.md` covers ambiguous identity, stale/missing official data, throttling, paywalls, bad PDF, copied sources, date/scope errors, hallucinated quote, invalid JSON, prompt injection, model deprecation, quota exhaustion, and PARTIAL semantics. For each: detection, visible behavior, recovery, residual risk.
