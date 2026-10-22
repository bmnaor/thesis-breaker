// Nebius Token Factory client (OpenAI-compatible). Every call is logged to a
// model ledger with model id, latency, token usage and prompt version; keys
// never reach logs. Startup model discovery protects against model churn.

import fs from "node:fs";
import path from "node:path";

export interface ChatMessage { role: "system" | "user" | "assistant"; content: string }

export interface LedgerRecord {
  at: string;
  model: string;
  promptVersion: string;
  latencyMs: number;
  promptTokens?: number;
  completionTokens?: number;
  purpose: string;
}

export class NebiusClient {
  constructor(
    private apiKey: string,
    private baseUrl = "https://api.tokenfactory.nebius.com/v1",
    private logDir = "logs"
  ) {}

  async listModels(): Promise<string[]> {
    const res = await fetch(`${this.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    if (!res.ok) throw new Error(`Nebius /models failed: ${res.status}`);
    const data = (await res.json()) as { data: { id: string }[] };
    return data.data.map((m) => m.id);
  }

  async requireModels(wanted: string[]): Promise<void> {
    const available = await this.listModels();
    const missing = wanted.filter((w) => !available.includes(w));
    if (missing.length) {
      throw new Error(
        `configured models unavailable: ${missing.join(", ")}. Available: ${available.join(", ")}`
      );
    }
  }

  async chat(opts: {
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    maxTokens?: number;
    promptVersion: string;
    purpose: string;
  }): Promise<string> {
    const started = Date.now();
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        temperature: opts.temperature ?? 0,
        max_tokens: opts.maxTokens ?? 1024,
      }),
    });
    const latencyMs = Date.now() - started;
    if (!res.ok) throw new Error(`Nebius chat failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    this.log({
      at: new Date().toISOString(),
      model: opts.model,
      promptVersion: opts.promptVersion,
      latencyMs,
      promptTokens: data.usage?.prompt_tokens,
      completionTokens: data.usage?.completion_tokens,
      purpose: opts.purpose,
    });
    return data.choices[0].message.content;
  }

  private log(rec: LedgerRecord): void {
    fs.mkdirSync(this.logDir, { recursive: true });
    fs.appendFileSync(path.join(this.logDir, "model-ledger.jsonl"), JSON.stringify(rec) + "\n");
  }
}
