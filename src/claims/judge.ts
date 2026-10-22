// Relation judge: given two structured claims, classify the relation.
// Rules nominate pairs; the reasoning model judges hard ones. Output is parsed
// strict JSON; the model never creates provenance.

import type { NebiusClient } from "../models/nebius.ts";
import type { ClaimRelation } from "./types.ts";

export const JUDGE_PROMPT_VERSION = "judge-v1";

export interface JudgeVerdict {
  relation: ClaimRelation;
  dimension: "value" | "time" | "scope" | "population" | "status" | "causality" | "forecast";
  confidence: number;
  explanation: string;
}

const SYSTEM = `You are a claim-relation judge for an evidence-audit agent. You receive two structured claims with their provenance. Classify their relation.

Rules:
- A newer registry/filing state that replaces an older state is "updates", not "contradicts".
- "contradicts" requires both claims to be about the same effective scope and time and still conflict.
- Planned/estimated versus actual/observed is a modality change, usually "updates".
- Different periods, populations, or phases mean "distinct".
- Reply with strict JSON only: {"relation": "...", "dimension": "...", "confidence": 0-1, "explanation": "..."}.
- relation must be one of: equivalent, near_duplicate, supports, contradicts, narrows, broadens, updates, derived_from, distinct.`;

export function parseVerdict(raw: string): JudgeVerdict {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(cleaned);
  const relations = ["equivalent", "near_duplicate", "supports", "contradicts", "narrows", "broadens", "updates", "derived_from", "distinct"];
  if (!relations.includes(parsed.relation)) throw new Error(`judge returned invalid relation: ${parsed.relation}`);
  if (typeof parsed.confidence !== "number") throw new Error("judge returned no numeric confidence");
  return parsed as JudgeVerdict;
}

export async function judgePair(
  client: NebiusClient,
  model: string,
  claimA: string,
  claimB: string
): Promise<JudgeVerdict> {
  const raw = await client.chat({
    model,
    promptVersion: JUDGE_PROMPT_VERSION,
    purpose: "claim-relation-judge",
    temperature: 0,
    maxTokens: 300,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: `CLAIM A (older):\n${claimA}\n\nCLAIM B (newer):\n${claimB}` },
    ],
  });
  return parseVerdict(raw);
}
