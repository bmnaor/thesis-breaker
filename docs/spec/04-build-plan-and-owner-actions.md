# Build Plan and Barak Action List

## Oct 15-20 Open Agent build

### Oct 15 - Skeleton and vertical slice
- Freeze scope/judging story; public repo, issue board, CI, license.
- Docker Compose, Postgres migrations, FastAPI health, dashboard shell.
- Run state machine and artifact manifest.
- SEC and ClinicalTrials.gov connectors with cache/rate controls.
- Gate: `ZURA -> raw documents -> stored provenance` from one command.

### Oct 16 - Claims with valid citations
- HTML/JSON normalization and stable spans.
- Claim schema, structured extraction, quote/offset verifier.
- Resolver for ZURA, tibulizumab, TibuSHIELD, NCT06993610.
- Issuer-IR and PubMed connectors.
- Gate: 8/10 gold claims extract with resolvable spans; no unsupported quote survives.

### Oct 17 - Dedup, contradiction, graph
- Origin clustering, canonical tuples, embedding candidates, rule filters.
- Judge equivalent/update/contradiction/distinct.
- Confidence, independence, dissent, decay.
- Gate: gold #9 is update; #10 independence count = 1; lineage endpoint works.

### Oct 18 - Brief, monitors, UI
- Cited brief and deterministic sentence verifier.
- Falsifier and monitoring checklist generation.
- Claim cards, evidence drawer, graph, dissent inspector, failure banner.
- Tavily if key is ready.
- Gate: full ZURA brief works in UI and every sentence opens evidence.

### Oct 19 - Hardening and demo freeze
- Capture dated ZURA fixture and expected output.
- Eval, adversarial tests, connector failures, clean-machine container test.
- README, architecture, security, `FAILURE_MODES.md`.
- Model ledger, timing/cost summary, rehearse and record.
- Gate: three consecutive demo resets pass; secret scan clean.

### Oct 20 - Submission buffer
- Bug fixes only. Record/edit/upload <=3-minute video.
- Verify repo, deployment/container, docs, license, setup.
- Submit early; save confirmation and commit SHA.
- Gate: a reviewer can clone and run from README alone.

## Oct 21-30 Nebius extension

- **Oct 21:** Audit current rules in live portal. Map every requirement to proof in `docs/judging-map.md`; confirm deadline/timezone and eligibility.
- **Oct 22:** Token Factory OpenAI-compatible client, `/v1/models` discovery, retries, ledger, timing/cost, secret redaction.
- **Oct 23:** Route contradiction/falsifier judging through current NVIDIA Nemotron, preferably `nvidia/nemotron-3-super-120b-a12b` if live list confirms it. Add runtime-call integration test.
- **Oct 24:** Compare Token Factory extractors on gold set by citation F1, JSON validity, latency, and cost.
- **Oct 25:** Tavily Search/Extract live path and origin clustering; preserve query/rank/retrieval provenance.
- **Oct 26:** Prove at least one NVIDIA open-source model in the runtime. If hosted Nemotron qualifies, document model/license/call. If rules demand self-hosted weights, deploy the smallest qualifying model on Nebius AI Cloud. Verify, do not assume.
- **Oct 27:** Nebius deployment, health checks, rate/cost caps, clean quota failures.
- **Oct 28:** Full live/cached eval, latency/cost charts, failure examples, proof screenshots; freeze Nebius fixture.
- **Oct 29:** Public YouTube demo, README, architecture, judging map, setup, failure modes.
- **Oct 30:** Fresh clone, public URL/repo/video/license/secret checks; submit with buffer and save confirmation/SHA.

## Barak must do before Oct 15

### Accounts and credentials
- [ ] **GitHub:** username, public repo owner/org, Actions, license. Apache-2.0 is the default unless rules/dependencies say otherwise.
- [ ] **Nebius:** account and AI project, billing/credits, terms, scoped API key, project ID. Prove with `/v1/models` and one cheap completion.
- [ ] **Tavily:** account/project/key; prove Search and Extract; verify bonus eligibility.
- [ ] **YouTube:** channel able to publish public/unlisted without first-upload delay.
- [ ] **Hackathon portals:** register/team-create; record exact deadlines/timezones, team limits, eligibility, fields, tracks.

### Decisions
- [ ] Repo owner/name and public display name.
- [ ] Whether demo deployment is public and who covers runtime cost.
- [ ] Hard Nebius spend alert/cap and Tavily usage cap.
- [ ] Accept or revise the proposed ZURA thesis sentence.
- [ ] Decide whether frozen source text can be redistributed; otherwise use hashes, short spans, and a refetch script.

### Secret handling
Never paste keys in chat or commit them. Store as `NEBIUS_API_KEY`, `NEBIUS_PROJECT_ID`, `TAVILY_API_KEY`; hosted runs use the deployment secret manager. `.env.example` contains names only. Secret-scan every public push.

### Dates
- **By Sep 25:** registrations, repo owner, Nebius/Tavily accounts, YouTube.
- **By Oct 1:** keys tested, caps set, current model list captured, rules rechecked.
- **By Oct 10:** thesis, repo/license, deployment, fixture redistribution settled.
- **Oct 14:** no account or credential work left.

## Risks to settle early
- Model churn: discover at startup and keep routing configurable.
- Rule drift: recheck portals before build and submission.
- Redistribution: default to metadata, hashes, small cited spans, refetch.
- SEC/NCBI rates: cache and use host-specific limits.
- Tavily/NVIDIA requirements: prove with logged runtime paths, not README claims.
