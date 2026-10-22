# Evaluation Plan

## 1. Evaluation assets

Create `eval/gold_claims.jsonl`, `eval/documents/`, and `eval/expected_relations.jsonl`. Freeze source bytes and retrieval timestamps so scoring is reproducible. Each gold record includes expected claim tuple, qualifiers, exact evidence span, source URL, source class, origin family, and allowed relation labels.

Use two layers:

- **Unit fixture:** ten hand-labeled claims below, drawn from frozen ZURA documents plus controlled counterfactual snippets clearly marked synthetic.
- **End-to-end set:** 3 assets x 15-25 documents: ZURA, one later-stage biotech with reported results, one liquid crypto asset. Only ZURA is needed for the hackathon demo.

A domain-knowledgeable reviewer should label the gold set. Record disagreements rather than forcing consensus.

## 2. Ten-claim gold set

Exact text and offsets must be copied from the frozen files during implementation. The table specifies expected provenance and relation behavior; it is not a substitute for those quotes.

| # | Gold claim | Expected provenance | Expected behavior |
|---|---|---|---|
| 1 | Zura Bio is the sponsor/company associated with tibulizumab development. | ZURA SEC filing identity section plus issuer release; accession/section and issuer URL. | Same entity, independent document types; issuer mirror does not double-count. |
| 2 | Tibulizumab is described as dual blockade of IL-17A and BAFF. | ZURA issuer TibuSHIELD launch release; mechanism statement span. PubMed may supply independent biological context, not proof of the asset's composition. | Extract two targets; preserve `issuer_assertion`. |
| 3 | TibuSHIELD is a Phase 2 study in adults with hidradenitis suppurativa. | ClinicalTrials.gov NCT06993610 `protocolSection` JSON pointers and official study page. | Registry-supported phase/population claim. |
| 4 | The registry's enrollment value for NCT06993610 is X as of the frozen API retrieval. | ClinicalTrials.gov API JSON, exact enrollment field and update date. | Numeric claim with `as_of`; no hard-coded X before fixture capture. |
| 5 | The registry's primary completion date/status for NCT06993610 is Y as of retrieval. | ClinicalTrials.gov API JSON pointer and update date. | Time-sensitive claim receives decay and update handling. |
| 6 | Zura announced the start/launch of the global Phase 2 TibuSHIELD study. | Issuer launch release at https://investors.zurabio.com/news-releases/news-release-details/zura-bio-launches-global-phase-2-tibushield-study-evaluate and matching SEC filing if present. | Announcement is an event claim, not proof of completion. |
| 7 | Zura reported a first-quarter 2026 cash balance and/or runway statement. | Q1 2026 filing/XBRL plus issuer results release. Use filing value/period as primary provenance. | Distinguish cash fact from forward-looking runway. |
| 8 | A financing involved Class A shares and pre-funded warrants. | Relevant SEC registration/8-K/6-K and issuer offering release. | Preserve warrant/share distinction; detect release syndication as one origin family. |
| 9 | Controlled older fixture: recruitment status is `RECRUITING`; controlled newer fixture: status is `ACTIVE_NOT_RECRUITING`. | Two versioned ClinicalTrials.gov-like JSON snippets in `eval/documents/synthetic/`, labeled synthetic with timestamps. | Relation must be `updates`, dimension `temporal/status`, not a timeless contradiction. |
|10| Controlled commentary says "three independent reports confirm the readout date," while all three pages quote one issuer release. | Three frozen commentary pages plus the shared issuer source; synthetic if licensing blocks storage. | Cluster one origin family; flag repeated narrative and independence count = 1. |

## 3. Metrics and gates

### Extraction

- Claim tuple precision >= 0.90; recall >= 0.80.
- Evidence-span exact/overlap F1 >= 0.90.
- Qualifier accuracy >= 0.90 for date, population, phase, unit, and modality.
- Citation validity = 100% for included brief sentences.

### Dedup and lineage

- Pairwise duplicate F1 >= 0.90.
- Origin-family purity >= 0.90.
- Zero incorrect merges across different trials, populations, periods, or modalities in the ten-claim set.

### Contradiction/update

- Macro F1 >= 0.80 across equivalent, supports, contradicts, updates, distinct.
- #9 must classify as update; #10 must not count as three independent confirmations.

### Product quality

- Every brief section traces to graph nodes.
- No unsupported factual sentence.
- Falsifiers are observable, thresholded where possible, source-bound, and time-bound.
- Cold ZURA run completes under 4 minutes; warm under 90 seconds.
- At least one injected malformed/model-invalid response recovers or ends PARTIAL with a clear failure.

## 4. Eval runner

`make eval` runs deterministic extraction checks from cached model outputs, graph relation scoring, citation verification, and a report. `make eval-live` calls configured models and stores a new dated result without overwriting the gold baseline. CI runs only the cached test to avoid secrets and drift.
