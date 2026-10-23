// Static dashboard renderer: turns a Brief (+ optional RunReport) into one
// self-contained HTML file. No framework, no build step, no network - open
// the file in a browser. Every rendered line keeps its memory ids so the
// lineage story (audit mem-N) survives into the visual layer.

import type { Brief, BriefLine } from "./compose.ts";
import type { RunReport } from "../orchestrator/analyze.ts";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// <mem-12> citations inside line text become styled chips.
function chips(text: string): string {
  return esc(text).replace(/&lt;(mem-\d+)&gt;/g, '<code class="mem">$1</code>');
}

function lines(items: BriefLine[], cls: string): string {
  if (!items.length) return `<li class="none">(none)</li>`;
  return items.map((l) => `<li class="${cls}">${chips(l.text)}</li>`).join("\n");
}

export function renderDashboard(b: Brief, report?: RunReport): string {
  const partial = report && (report.rejected.length > 0 || report.skipped.length > 0);
  const partialDetail = report
    ? [...report.rejected.map((r) => `rejected: ${r.sentence} - ${r.reason}`),
       ...report.skipped.map((s) => `skipped: ${s}`)]
    : [];
  const mode = report?.mode ?? "SAMPLE";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Thesis Breaker - ${esc(b.symbol)}</title>
<style>
 body{font:15px/1.5 system-ui,sans-serif;margin:0;background:#0f1420;color:#e8ecf4}
 header{display:flex;gap:16px;align-items:baseline;padding:14px 22px;background:#16203a;border-bottom:1px solid #2a3a5f}
 header h1{font-size:18px;margin:0;letter-spacing:.5px}
 .badge{font-size:12px;padding:2px 8px;border-radius:10px;background:#23407a}
 main{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:18px 22px}
 section{background:#16203a;border:1px solid #2a3a5f;border-radius:8px;padding:14px 16px}
 h2{font-size:13px;text-transform:uppercase;letter-spacing:1px;color:#8fb0e8;margin:0 0 10px}
 .thesis{grid-column:1/-1;font-size:16px}
 ul{margin:0;padding-left:18px} li{margin:6px 0} .none{color:#66779a;list-style:none}
 .falsifier{color:#ffb4a8} .update{color:#ffe9a8} .support{color:#b9f0c5}
 code.mem{background:#0d1a30;border:1px solid #2a3a5f;border-radius:4px;padding:0 5px;font-size:12px;color:#9fc1ff}
 table{width:100%;border-collapse:collapse;font-size:13px}
 td,th{text-align:left;padding:4px 8px;border-bottom:1px solid #22314f}
 .syn{color:#ffb4a8;font-size:11px;border:1px solid #7a3a34;border-radius:8px;padding:0 6px}
 .partial{grid-column:1/-1;background:#3a2415;border-color:#7a5423}
 footer{padding:12px 22px;color:#66779a;font-size:12px}
</style></head><body>
<header><h1>THESIS BREAKER</h1><span class="badge">${esc(b.symbol)}</span><span class="badge">${mode}</span><span>as of ${esc(b.asOf)}</span></header>
${partial ? `<main><section class="partial"><h2>PARTIAL - degraded run, nothing invented</h2><ul>${partialDetail.map((d) => `<li>${esc(d)}</li>`).join("")}</ul></section></main>` : ""}
<main>
 <section class="thesis"><h2>Thesis under test (hypothesis)</h2>${esc(b.thesis)}<br><span class="badge" style="margin-top:8px;display:inline-block">${b.efficacyProven ? "EFFICACY SUPPORTED BY REPORTED RESULT" : "HYPOTHESIS - EFFICACY UNPROVEN (no reported result in graph)"}</span></section>
 <section><h2>What is actually known (verified claims)</h2><ul>${lines(b.supporting, "support")}</ul></section>
 <section><h2>What changed (updates, not contradictions)</h2><ul>${lines(b.updates, "update")}</ul></section>
 <section><h2>What would break the thesis</h2><ul>${lines(b.falsifiers, "falsifier")}</ul></section>
 <section><h2>Unknowns / data gaps</h2><ul>${b.unknowns.length ? b.unknowns.map((u) => `<li>${esc(u)}</li>`).join("") : '<li class="none">(none)</li>'}</ul></section>
 <section><h2>Monitoring checklist</h2><ul>${b.monitoring.map((m) => `<li>${esc(m)}</li>`).join("")}</ul></section>
 <section><h2>Sources (${b.sources.length})</h2><table><tr><th>publisher</th><th>retrieved</th><th></th></tr>${b.sources.map((s) => `<tr><td>${esc(s.publisher)}</td><td>${esc(s.retrievedAt)}</td><td>${s.synthetic ? '<span class="syn">synthetic</span>' : ""}</td></tr>`).join("")}</table></section>
</main>
<footer>Static snapshot rendered locally from run output. Citations like <code class="mem">mem-12</code> resolve via: npx tsx src/cli.ts audit mem-12</footer>
</body></html>`;
}
