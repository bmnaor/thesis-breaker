# Nebius Token Factory usage (for hackathon judges)

All LLM inference runs on Nebius Token Factory (OpenAI-compatible API).
No other inference provider is used.

## Where inference happens

| Step | Model role | Code |
|---|---|---|
| Claim extraction from issuer/reporting docs | open model via `MODEL_EXTRACTOR` (Qwen3-30B class) | src/orchestrator/liveExtract.ts |
| Claim-relation judging (supports/opposes/updates/echo) | Nemotron judge via `MODEL_JUDGE` | src/orchestrator/liveJudge.ts |
| Client, model discovery, call ledger | startup `/models` check fails fast on model churn | src/models/nebius.ts |

Models are configured by env var and verified against the live `/models`
listing at startup, so a renamed/deprecated model is a loud config error,
not a silent behavior change.

## The honesty gate (why this is not "LLM says so")

The model proposes candidate claims. A deterministic verifier then requires
every quote to be a verbatim substring of the stored source bytes; anything
paraphrased or invented is rejected and logged. Live fixture run: 6 accepted,
2 rejected. Judges can reproduce with `npm run analyze -- --live` (needs
NEBIUS_API_KEY) and compare against `npm run demo` (SAMPLE mode, no keys).

## Auditability: model-call ledger

Every call appends one JSON line to `logs/model-ledger.jsonl` (gitignored):
timestamp, model id, prompt version, latency, token usage. API keys never
reach logs. Total hackathon spend to date: ~4.5k tokens (cents) of the $10
credit budget.

## Reproduce

```bash
cp .env.example .env   # set NEBIUS_API_KEY, MODEL_EXTRACTOR, MODEL_JUDGE
npm install && npm test          # 26/26, no keys needed
npm run conformance              # 13/13 Meterless H-MEM checks
npm run analyze -- --live        # real Nebius calls on the frozen ZURA docs
```
