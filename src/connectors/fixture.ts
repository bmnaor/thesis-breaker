// Fixture connector: reads frozen, hash-manifested source documents from disk.
// This is the SAMPLE_MODE path: no network, no keys, fully reproducible.
// Live connectors (EDGAR, ClinicalTrials.gov, IR, PubMed, Tavily) implement the
// same FrozenDocument shape against real APIs.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { SourceRef, SourceClass } from "../claims/types.ts";

export interface ManifestEntry {
  documentId: string;
  path: string;              // relative to fixture root
  canonicalUrl: string;
  publisher: string;
  sourceClass: SourceClass;
  retrievedAt: string;
  sha256: string;
  synthetic: boolean;
}

export interface FixtureManifest {
  fixture: string;
  capturedAt: string;
  documents: ManifestEntry[];
}

export interface FrozenDocument {
  ref: SourceRef;
  bytes: Buffer;
  text: string;
  contentSha256: string;
}

export function sha256(buf: Buffer | string): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export function loadManifest(fixtureDir: string): FixtureManifest {
  return JSON.parse(fs.readFileSync(path.join(fixtureDir, "manifest.json"), "utf-8"));
}

export function loadDocuments(fixtureDir: string): FrozenDocument[] {
  const manifest = loadManifest(fixtureDir);
  return manifest.documents.map((entry) => {
    const bytes = fs.readFileSync(path.join(fixtureDir, entry.path));
    const actual = sha256(bytes);
    if (actual !== entry.sha256) {
      throw new Error(`fixture integrity failure: ${entry.documentId} sha256 ${actual} != manifest ${entry.sha256}`);
    }
    const ref: SourceRef = {
      documentId: entry.documentId,
      canonicalUrl: entry.canonicalUrl,
      publisher: entry.publisher,
      sourceClass: entry.sourceClass,
      retrievedAt: entry.retrievedAt,
      synthetic: entry.synthetic,
    };
    return { ref, bytes, text: bytes.toString("utf-8"), contentSha256: actual };
  });
}
