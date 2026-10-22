// Live extraction check: one real Nebius call extracts verifiable claims from
// the frozen issuer release. Run:
//   NEBIUS_API_KEY=... npx tsx src/orchestrator/liveExtract.ts
import { NebiusClient } from "../models/nebius.ts";
import { extractClaimsWithModel } from "../claims/llmExtract.ts";
import { loadDocuments } from "../connectors/fixture.ts";
import path from "node:path";

const key = process.env.NEBIUS_API_KEY;
if (!key) {
  console.error("NEBIUS_API_KEY is required (live call).");
  process.exit(1);
}
const fixtureDir = path.resolve(process.argv[2] ?? "fixtures/zura-2026-10-22");
const docId = process.argv[3] ?? "zurabio-tibushield-launch-2025-05-20";
const model = process.env.MODEL_EXTRACTOR || "Qwen/Qwen3-30B-A3B-Instruct-2507";

const client = new NebiusClient(key);
await client.requireModels([model]);
const doc = loadDocuments(fixtureDir).find((d) => d.ref.documentId === docId);
if (!doc) throw new Error(`no document ${docId} in ${fixtureDir}`);

const { claims, rejected } = await extractClaimsWithModel(client, model, doc);
console.log(`extracted ${claims.length} verifiable claims, rejected ${rejected.length} candidates`);
for (const c of claims) console.log(`  [ok] ${c.sentence}`);
for (const r of rejected) console.log(`  [REJECTED] ${r.candidate.predicate}: ${r.reason}`);
if (claims.length === 0) {
  console.error("FAIL: no verifiable claims extracted");
  process.exit(1);
}
