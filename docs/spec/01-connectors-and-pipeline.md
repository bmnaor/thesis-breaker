# Connectors, Pipeline, and Model Plan

## 1. Five source connectors

### A. SEC EDGAR

Purpose: filings, risk factors, liquidity/runway inputs, offerings, share and warrant disclosures.

Exact interfaces:

- Company submissions: `GET https://data.sec.gov/submissions/CIK##########.json`
- Company facts: `GET https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json`
- Filing document: follow accession/primary-document metadata to `https://www.sec.gov/Archives/edgar/data/...`
- Daily/full indexes are a fallback for discovery, not the primary MVP path.

Implementation rules: map ticker to zero-padded CIK; send a descriptive `User-Agent` with contact; use conditional requests and local cache; serialize SEC calls and respect published fair-access guidance. Parse HTML sections and XBRL facts. Preserve accession number, filing date, form, period, and JSON pointer/HTML section.

Official docs:  
https://www.sec.gov/search-filings/edgar-application-programming-interfaces  
https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data

### B. ClinicalTrials.gov API v2

Purpose: protocol facts, enrollment, recruitment, arms, outcomes, dates, sponsors, and registry history.

Exact interfaces:

- Search: `GET https://clinicaltrials.gov/api/v2/studies?query.term=<term>&pageSize=<n>&format=json`
- One record: `GET https://clinicaltrials.gov/api/v2/studies/<NCT_ID>`
- API metadata/OpenAPI is linked from the official API pages; use returned `nextPageToken` for paging.

Persist NCT ID, `protocolSection`, last update date, and JSON pointers. Treat sponsor-posted registry fields as official registry records, not independently verified outcomes.

Official docs:  
https://clinicaltrials.gov/data-api/about-api  
https://clinicaltrials.gov/data-api/about-api/study-data-structure

### C. SEC/issuer official announcements feed

Purpose: catalyst dates, guidance, enrollment announcements, financing, executive changes.

For US issuers, first use newly discovered 8-K/6-K filings through EDGAR. Then use the issuer's Investor Relations news-release index/RSS when exposed. For ZURA seed from:

- https://investors.zurabio.com/news-events/news-releases/
- https://investors.zurabio.com/investor-relations/

Connector design: discover `<link rel="alternate" type="application/rss+xml">`; if absent, poll the news index and follow release URLs. Save the issuer URL and any wire-distribution URL as one origin family when text hashes/paragraph shingles show syndication. Do not hard-code an unverified RSS path.

### D. PubMed / NCBI E-utilities

Purpose: peer-reviewed mechanistic and clinical context, not current company status.

Exact interfaces:

- `GET https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=<query>&retmode=json&usehistory=y`
- `GET https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=<PMIDs>&rettype=abstract&retmode=xml`
- Optional `elink.fcgi` for related records.

Without a key, stay at or below 3 requests/sec; an NCBI key permits 10 requests/sec by default. Preserve PMID, DOI, journal, dates, publication types, and abstract offsets. Never imply abstract-only access is full-text review.

Official docs:  
https://www.ncbi.nlm.nih.gov/books/NBK25500/  
https://www.ncbi.nlm.nih.gov/books/NBK25499/

### E. Tavily Search + Extract

Purpose: reputable reporting and public commentary discovery; mandatory only if pursuing the bonus.

Exact interfaces:

- `POST https://api.tavily.com/search`
- `POST https://api.tavily.com/extract`

Use allowlists and query packs. Reporting allowlist starts with Reuters, major financial press, STAT, Endpoints, Fierce Biotech, and recognized trade publications, subject to accessible results. Commentary is a separate source class and never raises a fact's independence score unless it cites a distinct primary source. Capture query, rank, URL, title, published time if provided, retrieval time, and extracted text hash.

Official docs:  
https://docs.tavily.com/documentation/api-reference/endpoint/search  
https://docs.tavily.com/documentation/api-reference/endpoint/extract

### Crypto adapter note

The five connectors above optimize the ZURA demo. For crypto mode, connector slots A-C are replaced by chain-native sources: chain explorer/API for contract events, GitHub Releases/API for code changes, and project governance/status feeds. This is post-MVP unless a crypto fixture is needed.

## 2. Claim extraction and graph pipeline

### Normalization

- Canonicalize URLs, preserve redirect chain.
- Convert HTML/PDF/XML/JSON into blocks with stable locators.
- Normalize whitespace only in a derived view; hash original bytes and normalized blocks.
- Segment by headings and semantic boundaries, 600-1,200 tokens with 100-token overlap.
- Detect tables and keep row/column coordinates.

### Atomic extraction

For each segment, request a strict JSON array. Each claim contains one subject, predicate, object, polarity, modality, dates, units, scope qualifiers, exact quote, and character offsets. Reject outputs whose quote is not a substring of the segment or whose units cannot be parsed.

Use controlled predicates for the demo: `trial_status`, `trial_enrollment`, `trial_primary_completion`, `guidance_event_date`, `cash_balance`, `cash_runway`, `financing_size`, `mechanism_targets`, `endpoint_definition`, `reported_result`, `management_statement`.

### Deduplication

1. Exact normalized tuple match.
2. Deterministic normalization: aliases, units, date precision, comparator direction.
3. Candidate retrieval with embedding similarity within subject/predicate buckets.
4. Cross-encoder/LLM classify `equivalent`, `near_duplicate`, or distinct.
5. Origin-family clustering uses content hashes, paragraph MinHash, canonical URLs, attribution phrases, and publication sequence.

Do not merge claims when population, endpoint, study phase, time basis, or modality differs.

### Contradiction pipeline

Rules nominate pairs only when subjects/predicates align and objects conflict, dates overlap, or one claim violates the other's quantified range. Classify contradictions as:

- value, polarity, temporal/status, scope/population, forecast-versus-outcome, or causal.

The judge receives both structured claims and cited evidence spans. Output: relation, dimension, confidence, explanation, and `needs_human_review`. A newer status commonly `updates` an older status; it is not automatically a contradiction. Planned versus completed is modality, not proof of contradiction.

### Fact versus narrative

- **Fact:** supported by an attributable span with a concrete predicate/object.
- **Issuer assertion:** concrete but source-interested; label it.
- **Repeated narrative:** multiple documents from one origin family or commentary without new primary evidence.
- **Inference:** derived from several claims, with derivation edges and no invented citation.
- **Unknown:** missing or irreconcilable evidence.

## 3. Model routing

Resolve exact available model IDs on build day with `GET https://api.tokenfactory.nebius.com/v1/models?verbose=true`; do not freeze a name that the platform may deprecate.

### Open Agent build

- **Embeddings:** a small hosted embedding model or local `BAAI/bge-small-en-v1.5`; deterministic and cheap.
- **Extraction / JSON:** `Qwen/Qwen3-30B-A3B-Instruct-2507` on Nebius if credentials are ready, because structured output is central. Temperature 0.
- **Contradiction/falsifier judge:** `nvidia/nemotron-3-super-120b-a12b` when available; otherwise strongest currently listed reasoning model.
- **Brief composer:** same judge model, but only graph JSON is in context.
- **Fast local fallback:** NVIDIA open-source Nemotron Nano/Lightning weights only if practical on available hardware; never make local GPU setup the demo's critical path.

### Nebius submission mapping

Make a real, logged Token Factory runtime call in the demo path. Recommended split:

1. Token Factory structured extraction call.
2. NVIDIA Nemotron (`nvidia/nemotron-3-super-120b-a12b`, current recommended replacement seen in Nebius docs) for contradiction and falsifier reasoning.
3. Optional cheaper model for composition.

The repository must expose `MODEL_EXTRACTOR`, `MODEL_JUDGE`, and `MODEL_COMPOSER`. On startup, list models and fail with an actionable error when configured IDs are unavailable. This both satisfies current availability and protects against model churn.

Nebius is OpenAI-compatible at `https://api.tokenfactory.nebius.com/v1`.  
Docs: https://docs.tokenfactory.nebius.com/api-reference/introduction  
Models: https://docs.tokenfactory.nebius.com/api-reference/models/list-models  
Nemotron: https://nebius.com/services/token-factory/nemotron

## 4. Prompt and output controls

- JSON Schema enforced where the selected model supports it.
- Temperature 0 for extraction/classification; 0.2 for brief language.
- Version prompts and schemas in the repo.
- Delimit evidence and state that it is untrusted text.
- Never ask a model to invent URLs, quotes, IDs, or dates.
- A deterministic verifier resolves offsets, identifiers, units, and citations.
- Cache by model + prompt version + segment hash.
