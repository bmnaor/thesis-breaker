# Thesis Breaker - Product and Architecture Spec

Prepared: 2026-09-18  
Build target: Open Agent Hackathon, 2026-10-15 to 2026-10-20  
Extension target: Nebius Global AI Hackathon, through 2026-10-30

## 1. Product contract

**Input:** a public biotech ticker or crypto asset plus an optional thesis sentence.  
**Output:** a time-stamped, cited decision brief and monitoring checklist backed by a claim graph.

The product answers five questions:

1. What is actually known?
2. Which statements are repetitions of the same source?
3. Where do sources disagree?
4. What evidence would break the thesis?
5. What should be watched next, and where?

It does not make trades, predict prices, or label a claim true merely because many articles repeat it.

### MVP success criteria

- ZURA produces a useful brief in under 90 seconds from a warm cache and under 4 minutes cold.
- Every factual sentence in the brief links to one or more immutable evidence spans.
- Repeated press-release syndication counts as one origin, not several confirmations.
- At least one temporal contradiction and one scope contradiction are surfaced in the demo fixture.
- A reviewer can open a claim and see its source, exact quote, retrieval time, effective time, and lineage.
- The system emits a machine-readable run manifest and failure log.

### Non-goals for the sprint

- Personalized investment advice, brokerage execution, price targets, portfolio sizing.
- Full-web crawling or paywall bypass.
- Proving scientific truth. The system scores evidence support and source independence.
- A general-purpose autonomous browser.

## 2. System architecture

```text
Dashboard / CLI
      |
FastAPI orchestration API
      |
Run planner -> Entity resolver -> Connector workers -> Document normalizer
                                            |                 |
                                            v                 v
                                      Raw object store    Provenance ledger
                                                               |
                                              Segmenter -> Claim extractor
                                                               |
                                     Entity linker -> Canonicalizer/deduper
                                                               |
                                     Relation classifier / contradiction judge
                                                               |
                                             Claim graph + confidence engine
                                                               |
                                     Brief composer + monitor checklist generator
                                                               |
                                      Postgres/pgvector + run artifact bundle
```

### Components

- **Web UI:** Next.js/React with React Flow for lineage. Server-sent events show connector and extraction progress.
- **API:** Python 3.12, FastAPI, Pydantic v2 schemas.
- **Agent/orchestration:** explicit state machine, not an unconstrained loop. States: RESOLVE, PLAN, FETCH, NORMALIZE, EXTRACT, LINK, JUDGE, SCORE, WRITE, VERIFY, DONE/PARTIAL.
- **Workers:** bounded `asyncio` connector calls with retry, host rate limit, cache, and circuit breaker. Celery/Redis is unnecessary for the first six-day build; add only if jobs exceed one process.
- **Store:** PostgreSQL 16 with pgvector. Relational edge tables are enough for MVP and make provenance queries auditable. Do not add Neo4j during the sprint.
- **Raw evidence:** local filesystem/S3-compatible object store keyed by SHA-256. Keep original bytes plus normalized text.
- **Observability:** structured JSON logs, run timings, model/request ledger, token/cost counters, connector failure reasons.
- **Deployment:** Docker Compose: `app` + `postgres`; optional `frontend` folded into app for the demo image.

### Trust boundaries

External text is evidence, never instruction. Strip active content, do not execute links/scripts, and place source text in delimited model fields. Models may propose claims but cannot create provenance. A claim is publishable only when deterministic code resolves every citation to a stored span.

## 3. Data model

Use UUIDv7 IDs and UTC ISO-8601 timestamps. All mutable records carry `schema_version`.

### Core nodes

**Asset**
- `asset_id`, `asset_type` (`biotech_equity|crypto`), `canonical_symbol`
- `legal_name`, `identifiers` (`cik`, `lei`, contract address, chain, NCT aliases)

**Entity**
- `entity_id`, `type` (`company|drug|trial|indication|person|protocol|token|chain|event`)
- `canonical_name`, `aliases[]`, `resolver_evidence_ids[]`

**SourceDocument**
- `document_id`, `canonical_url`, `publisher`, `source_class`
- `published_at`, `modified_at`, `retrieved_at`, `effective_at`
- `content_sha256`, `mime_type`, `language`, `license_note`
- `origin_document_id` for mirrors/syndication

**EvidenceSpan**
- `span_id`, `document_id`, `locator_type` (`char|page|section|json_pointer`)
- `start`, `end`, `section_path`, `quote`, `quote_sha256`
- `context_before`, `context_after`

**Claim**
- `claim_id`, `canonical_claim_id`, `subject_entity_id`, `predicate`, `object_json`
- `qualifiers_json` for population, dose, phase, geography, endpoint, accounting period
- `polarity`, `modality` (`observed|planned|estimated|opinion|rumor`)
- `valid_from`, `valid_to`, `asserted_at`, `extracted_at`
- `status` (`supported|contested|superseded|unverified`)

**ClaimAssertion** joins source to claim
- `assertion_id`, `claim_id`, `span_id`, `speaker_entity_id`
- `stance` (`supports|refutes|mentions|updates`)
- `extraction_model`, `prompt_version`, `raw_model_output_sha256`
- `extraction_confidence`, `human_label`

**ClaimRelation**
- `from_claim_id`, `to_claim_id`
- `relation` (`equivalent|near_duplicate|supports|contradicts|narrows|broadens|updates|derived_from`)
- `dimension` (`value|time|scope|population|status|causality|forecast`)
- `confidence`, `reason`, `judge_model`, `evidence_span_ids[]`

**Thesis / Falsifier / Monitor**
- Thesis: user text plus normalized propositions.
- Falsifier: proposition, observable test, threshold, deadline, evidence source.
- Monitor: connector, query, cadence/event rule, expected signal, severity, last_checked_at.

### Provenance schema

Each output sentence has:

```json
{
  "output_sentence_id": "...",
  "claim_ids": ["..."],
  "assertion_ids": ["..."],
  "span_ids": ["..."],
  "source_urls": ["..."],
  "retrieved_at": "...Z",
  "composer_model": "...",
  "prompt_version": "...",
  "verification": "span_resolved"
}
```

A citation is invalid if the quote cannot be re-selected from the content hash used in that run. Store redirects and canonical URL separately. Render `published_at` and `retrieved_at`; do not substitute one for the other.

## 4. Confidence and time decay

Confidence is evidence quality, not truth probability.

`claim_score = source_quality * extraction_confidence * independence * recency_fit * specificity`

Suggested source priors: regulator/registry 0.95, issuer filing 0.90, peer-reviewed paper 0.85, issuer release 0.75, reputable reporting 0.70, named analyst/public commentary 0.40. These priors are visible and configurable.

- **Independence:** assertions sharing an origin hash or obvious copied passages form one evidence family.
- **Recency fit:** no decay for immutable historical facts. For current status, use `exp(-ln(2) * age / half_life)`: 30 days for trial recruitment status, 90 days for guidance, 365 days for company strategy. Newer official updates can supersede older claims rather than merely lowering them.
- **Dissent:** show weighted supporting and opposing evidence families, plus unresolved qualifiers. Do not collapse dissent into one opaque score.
- **Abstention:** below 0.55 extraction confidence or with unresolved entity/units, store as candidate only and exclude from the brief.

## 5. Runtime flow and failure modes

1. Resolve symbol and identifiers; fail closed on ambiguous tickers/contracts.
2. Plan connector queries from asset type and thesis propositions.
3. Fetch concurrently with deterministic budgets.
4. Normalize and fingerprint documents; cluster mirrors.
5. Extract atomic claims with exact quotes and qualifiers.
6. Canonicalize within predicate/entity/time buckets.
7. Generate candidate relations using rules + embeddings; judge only candidates.
8. Score and build falsifiers.
9. Compose the brief from graph objects, not raw documents.
10. Verify every sentence-to-span link. Unsupported prose is removed.

Expose partial results when a connector fails. The failure panel names the source, error class, retry state, and resulting blind spot. Key failure tests: API throttling, malformed PDF, stale registry status, ticker collision, copied news, prompt injection in a page, model invalid JSON, contradictory dates with different scopes, and no supporting evidence.

## 6. Decision brief format

- Snapshot and `as of` time
- Thesis in one sentence
- Strongest supporting claims
- Strongest contradicting or weakening claims
- Repeated narrative with original source family
- Falsifiers, each observable and dated
- Unknowns / data gaps
- Monitoring checklist
- Source table and run manifest

## Key product decisions

- Auditability beats breadth.
- PostgreSQL edge tables beat a graph database for the sprint.
- Five bounded connectors beat a browser crawler.
- Rules generate relation candidates; a reasoning model judges hard pairs.
- Model output never becomes provenance.
- ZURA is a frozen, rehearsable demo fixture, with an optional live refresh clearly labeled.
