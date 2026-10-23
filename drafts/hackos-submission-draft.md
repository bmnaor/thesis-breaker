# FINAL REVIEW COPY - HackOS submission text (for Barak's review only -
# DO NOT SUBMIT without his explicit approval; creating a submission locks the team)

Project name: Thesis Breaker
Tagline: Turns a market thesis into claims, evidence, contradictions, and the
explicit tests that would break it.

Track: Track 2 (approved by Barak; the HackOS submission itself is not yet created - track selection happens at creation, awaiting his go)

Description:
Thesis Breaker is an evidence-backed market catalyst agent. Give it a ticker
and a thesis; by design it pulls primary sources, separates real evidence
from echoed narrative ("10 links, 1 source"), and explains why the thesis
holds or breaks. It never tells you what to buy. The current prototype is
built and demonstrated end-to-end on one real case (Zura Bio /
tibulizumab); it is not yet a general any-ticker service. In the
demonstrated run it ingested real 2026-10-22 captures of
ClinicalTrials.gov, SEC EDGAR, Zura Bio issuer releases, and a PubMed
efetch for tibulizumab.

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
Docker. The Zetaris check executed nine inline sample rows through the
live Data Gateway during the build; it does not demonstrate federation
over an external stored dataset. AI-assisted build; spec drafted before
the hackathon window; synthetic fixture documents are labeled.

Development tools (per rules 6.4): built with AI coding assistance
(Claude Code). Per the organizers' 22 Oct update (#announcement channel +
updated onboarding guide), Cursor became optional for this event; the
unchanged requirement - one Meterless engine in a working feature with a
passing test - is met by the vendored H-MEM integration (conformance
13/13). Note: the static rules-page text still mentions Cursor and has not been
updated; we follow the organizers' 22 Oct update for this submission.

Repo: https://github.com/bmnaor/thesis-breaker

Presentation assets (pairing for Barak's review - nothing uploaded):
- Deck: Barak's 11-slide NotebookLM deck (his preferred version, as-is).
- Concept video (70s, landscape): the concept narrative animation - a
  stylized CONCEPT ILLUSTRATION of the pipeline, not live system output.
  It is labeled as such wherever it appears.
- Demo video (2:14): captioned walkthrough of the real, working system on
  the ZURA case - captured terminal and dashboard output. This is the
  working-system proof.
