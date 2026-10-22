// Live judge check: one real Nebius Token Factory call classifying the
// registry status pair from the frozen fixture. Run:
//   NEBIUS_API_KEY=... npx tsx src/orchestrator/liveJudge.ts
import { NebiusClient } from "../models/nebius.ts";
import { judgePair } from "../claims/judge.ts";

const key = process.env.NEBIUS_API_KEY;
if (!key) {
  console.error("NEBIUS_API_KEY is required (live call, ~300 tokens).");
  process.exit(1);
}

const client = new NebiusClient(key);
const model = process.env.MODEL_JUDGE || "nvidia/nemotron-3-super-120b-a12b";
await client.requireModels([model]);
const verdict = await judgePair(
  client,
  model,
  "NCT06993610 overall status is RECRUITING as of registry update 2025-08-12. (source: ClinicalTrials.gov registry record)",
  "NCT06993610 overall status is ACTIVE_NOT_RECRUITING as of registry update 2026-10-19. (source: ClinicalTrials.gov registry record)"
);
console.log("judge verdict:", JSON.stringify(verdict, null, 2));
if (verdict.relation !== "updates") {
  console.error(`EXPECTED relation "updates" (gold #9), got "${verdict.relation}"`);
  process.exit(1);
}
console.log("OK: live judge classified the registry pair as an update, matching gold expectation #9.");
