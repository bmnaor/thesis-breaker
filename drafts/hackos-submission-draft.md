# DRAFT - HackOS submission text (for Barak's review only - DO NOT SUBMIT
# without his explicit approval; creating a submission may lock the team)

Project name: Thesis Breaker
Tagline: Turns a market thesis into claims, evidence, contradictions, and the
explicit tests that would break it.

Track: Track 2 (approved by Barak; the HackOS submission itself is not yet created - track selection happens at creation, awaiting his go)

Description:
Thesis Breaker is an evidence-backed market catalyst agent. Give it a ticker
and a thesis; it pulls primary sources (ClinicalTrials.gov, SEC EDGAR,
issuer IR, PubMed), separates real evidence from echoed narrative
("10 links, 1 source"), and explains why the thesis holds or breaks. It
never tells you what to buy.

Claims are memories on a vendored Meterless H-MEM spine: dedupe collapses
echoes, supersession models registry updates, and an append-only trust ledger
makes every brief sentence auditable to its source span. LLM extraction
(Nebius Token Factory, Qwen3-30B + Nemotron judge) is gated by a
deterministic verbatim-quote verifier - hallucinated quotes are rejected.
Every falsifier names the source to watch.

Demo case: Zura Bio (ZURA) / tibulizumab, built from real 2026-10-22
registry and EDGAR captures. Within those captured sources and the claim
graph, the HS Phase-2 primary completion date has passed with no topline
disclosure among them - a watch item the engine keeps checking, not a
verdict on results (topline is planned for Q4 2026).

Built with: TypeScript, Meterless H-MEM (Apache-2.0, vendored, conformance
13/13), Nebius Token Factory, Tavily, Zetaris (evidence-mart connector),
Docker. AI-assisted build; spec drafted before the hackathon window;
synthetic fixture documents are labeled.

Repo: https://github.com/bmnaor/thesis-breaker
Demo video: (2:14 captioned walkthrough of captured outputs - see docs/demo-script.md; review pending before any upload)
