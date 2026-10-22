// Deterministic claim extraction from PubMed E-utilities efetch XML.
// Peer-reviewed mechanistic context - never current company status.

import type { DomainClaim, EvidenceSpan } from "./types.ts";
import { SOURCE_PRIOR } from "./types.ts";
import { sha256, type FrozenDocument } from "../connectors/fixture.ts";

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function charSpan(quote: string): EvidenceSpan {
  return { locatorType: "char", quote, quoteSha256: sha256(quote) };
}

interface Article {
  pmid: string;
  title: string;
  abstractText: string;
  journal: string;
  year: string;
}

export function parsePubmedXml(xml: string): Article[] {
  const articles: Article[] = [];
  for (const block of xml.matchAll(/<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/g)) {
    const b = block[1];
    const pmid = b.match(/<PMID[^>]*>(\d+)<\/PMID>/)?.[1] ?? "";
    const title = stripTags(b.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/)?.[1] ?? "");
    const abstractText = stripTags(
      [...b.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g)].map((m) => m[1]).join(" ")
    );
    const journal = stripTags(b.match(/<ISOAbbreviation>([\s\S]*?)<\/ISOAbbreviation>/)?.[1] ?? "");
    const year = b.match(/<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>/)?.[1] ?? "";
    if (pmid && title) articles.push({ pmid, title, abstractText, journal, year });
  }
  return articles;
}

/** Mechanism-target claims from articles that name the drug and its targets. */
export function extractMechanismClaims(doc: FrozenDocument, drug: string, targets: string[]): DomainClaim[] {
  const prior = SOURCE_PRIOR[doc.ref.sourceClass];
  const claims: DomainClaim[] = [];
  for (const a of parsePubmedXml(doc.text)) {
    const text = `${a.title} ${a.abstractText}`;
    if (!text.toLowerCase().includes(drug.toLowerCase())) continue;
    const found = targets.filter((t) => text.includes(t));
    if (found.length < targets.length) continue; // all targets must co-occur
    const quote = a.title;
    const subject = drug.toLowerCase();
    claims.push({
      claimKey: `${subject}|mechanism_targets|${found.join("+").toLowerCase()}|pmid${a.pmid}`,
      slotKey: `${subject}|mechanism_targets|pmid${a.pmid}`,
      subject,
      predicate: "mechanism_targets",
      object: found.join(" + "),
      sentence: `Peer-reviewed literature (${a.journal}, ${a.year}, PMID ${a.pmid}) describes ${drug} as targeting ${found.join(" and ")}: "${a.title}".`,
      modality: "observed",
      polarity: "asserts",
      asOf: a.year ? `${a.year}-01-01` : doc.ref.retrievedAt.slice(0, 10),
      qualifiers: { pmid: a.pmid, journal: a.journal, year: a.year },
      confidence: prior,
      source: doc.ref,
      span: charSpan(quote),
    });
  }
  return claims;
}
