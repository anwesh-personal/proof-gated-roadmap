#!/usr/bin/env node
/**
 * generate-timeline.mjs
 *
 * Compiles data/timeline.json into two zero-network, standalone HTML artifacts:
 *   - roadmap.html (Phase & status view with interactive filtering)
 *   - build-timeline.html (Chronological commit spine and uncurated inbox)
 *
 * Enforces the Proof-Gated Honesty Rule:
 *   No milestone may have status === "live" without a non-empty `sha` and `proof`.
 *
 * Usage:
 *   node scripts/generate-timeline.mjs           # Regenerate HTML files
 *   node scripts/generate-timeline.mjs --check   # Verify HTML matches JSON (for CI)
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DATA_PATH = resolve(ROOT, "data/timeline.json");
const ROADMAP_OUT = resolve(ROOT, "roadmap.html");
const TIMELINE_OUT = resolve(ROOT, "build-timeline.html");

const VALID_STATUSES = new Set([
  "live",
  "built_unproven",
  "partial",
  "design_only",
  "planned",
  "superseded",
]);

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function validateTimeline(data) {
  if (!data || typeof data !== "object") {
    throw new Error("timeline.json must be a JSON object");
  }
  if (!Array.isArray(data.milestones)) {
    throw new Error("timeline.json must contain a 'milestones' array");
  }
  const seenIds = new Set();
  for (const m of data.milestones) {
    if (!m.id || !m.title || !m.phase) {
      throw new Error(`Milestone missing id, title, or phase: ${JSON.stringify(m)}`);
    }
    if (seenIds.has(m.id)) {
      throw new Error(`Duplicate milestone id: ${m.id}`);
    }
    seenIds.add(m.id);
    if (!VALID_STATUSES.has(m.status)) {
      throw new Error(`Milestone ${m.id} has invalid status '${m.status}'`);
    }
    if (m.status === "live") {
      if (!m.sha || String(m.sha).trim().length === 0) {
        throw new Error(
          `[HONESTY VIOLATION] Milestone '${m.id}' (${m.title}) is marked 'live' but has no commit SHA.`
        );
      }
      if (!m.proof || String(m.proof).trim().length === 0) {
        throw new Error(
          `[HONESTY VIOLATION] Milestone '${m.id}' (${m.title}) is marked 'live' but has no verification proof.`
        );
      }
    }
  }
}

const SHARED_CSS = `
  :root {
    --bg: #111213;
    --fg: #e6e6e6;
    --muted: #9a9a9a;
    --line: #2a2b2d;
    --card: #18191b;
    --live: #6fbf73;
    --built_unproven: #d4a017;
    --partial: #c9893a;
    --design_only: #8a8a8a;
    --superseded: #8a6a6a;
    --planned: #6a9cc9;
    --founder: #c9893a;
    --agent: #6fbf73;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 32px 24px 64px;
    background: var(--bg);
    color: var(--fg);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.5;
  }
  .container { max-width: 1120px; margin: 0 auto; }
  header { border-bottom: 1px solid var(--line); padding-bottom: 20px; margin-bottom: 24px; }
  h1 { margin: 0 0 6px; font-size: 26px; letter-spacing: -0.5px; }
  .tagline { color: var(--muted); font-size: 14px; margin: 0; }
  .toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin: 20px 0; align-items: center; }
  .filter-btn {
    background: var(--card);
    color: var(--fg);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 12px;
    cursor: pointer;
    transition: border-color 150ms ease, background 150ms ease;
  }
  .filter-btn.active, .filter-btn:hover { border-color: var(--fg); background: #222427; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 16px; }
  .card {
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
  .phase-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; color: var(--muted); }
  .badge {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 99px;
    border: 1px solid currentColor;
    white-space: nowrap;
  }
  .status-live { color: var(--live); }
  .status-built_unproven { color: var(--built_unproven); }
  .status-partial { color: var(--partial); }
  .status-design_only { color: var(--design_only); }
  .status-planned { color: var(--planned); }
  .status-superseded { color: var(--superseded); }
  .card h3 { margin: 0; font-size: 16px; }
  .summary { margin: 0; font-size: 13px; color: #cccccc; }
  .meta { font-size: 12px; color: var(--muted); border-top: 1px solid var(--line); padding-top: 10px; margin-top: auto; }
  .meta div { margin-bottom: 4px; }
  .sha { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--fg); background: #222427; padding: 1px 5px; border-radius: 4px; }
  .nav-link { color: var(--planned); text-decoration: none; font-size: 13px; margin-left: auto; }
  .nav-link:hover { text-decoration: underline; }
`;

function renderRoadmapHtml(data) {
  const cards = data.milestones
    .map(
      (m) => `
    <article class="card" data-status="${escapeHtml(m.status)}">
      <div class="card-head">
        <span class="phase-label">${escapeHtml(m.phase)}</span>
        <span class="badge status-${escapeHtml(m.status)}">${escapeHtml(m.status.replace("_", " "))}</span>
      </div>
      <h3>${escapeHtml(m.title)}</h3>
      <p class="summary">${escapeHtml(m.summary)}</p>
      <div class="meta">
        <div><strong>Owner:</strong> ${escapeHtml(m.owner)} &middot; <strong>Date:</strong> ${escapeHtml(m.date || "TBD")}</div>
        ${m.sha ? `<div><strong>Commit:</strong> <span class="sha">${escapeHtml(m.sha)}</span></div>` : ""}
        ${m.proof ? `<div><strong>Proof:</strong> ${escapeHtml(m.proof)}</div>` : ""}
        ${m.gaps ? `<div><strong>Gaps:</strong> ${escapeHtml(m.gaps)}</div>` : ""}
      </div>
    </article>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(data.project?.name || "Engineering")} - Proof-Gated Roadmap</title>
<!-- GENERATED ARTIFACT - DO NOT HAND-EDIT. Run: node scripts/generate-timeline.mjs -->
<style>${SHARED_CSS}</style>
</head>
<body>
<div class="container">
  <header>
    <h1>${escapeHtml(data.project?.name || "Engineering Roadmap")}</h1>
    <p class="tagline">${escapeHtml(data.project?.tagline || "")}</p>
  </header>
  <div class="toolbar">
    <button class="filter-btn active" onclick="filterCards('all', this)">All (${data.milestones.length})</button>
    <button class="filter-btn" onclick="filterCards('live', this)">Live</button>
    <button class="filter-btn" onclick="filterCards('built_unproven', this)">Built Unproven</button>
    <button class="filter-btn" onclick="filterCards('partial', this)">Partial</button>
    <button class="filter-btn" onclick="filterCards('design_only', this)">Design Only</button>
    <button class="filter-btn" onclick="filterCards('planned', this)">Planned</button>
    <a class="nav-link" href="build-timeline.html">View Chronological Build Timeline &rarr;</a>
  </div>
  <section class="grid" id="roadmap-grid">
    ${cards}
  </section>
</div>
<script>
function filterCards(status, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('#roadmap-grid .card').forEach(card => {
    card.style.display = (status === 'all' || card.dataset.status === status) ? 'flex' : 'none';
  });
}
</script>
</body>
</html>\n`;
}

function renderTimelineHtml(data) {
  const sorted = [...data.milestones].sort((a, b) =>
    String(b.date || "").localeCompare(String(a.date || ""))
  );
  const rows = sorted
    .map(
      (m) => `
    <div class="card">
      <div class="card-head">
        <span class="phase-label">${escapeHtml(m.date || "Unscheduled")} &middot; ${escapeHtml(m.id)}</span>
        <span class="badge status-${escapeHtml(m.status)}">${escapeHtml(m.status.replace("_", " "))}</span>
      </div>
      <h3>${escapeHtml(m.title)}</h3>
      <p class="summary">${escapeHtml(m.summary)}</p>
      <div class="meta">
        ${m.sha ? `<div><strong>SHA:</strong> <span class="sha">${escapeHtml(m.sha)}</span></div>` : ""}
        ${m.proof ? `<div><strong>Proof:</strong> ${escapeHtml(m.proof)}</div>` : ""}
      </div>
    </div>`
    )
    .join("\n");

  const inboxRows = (data.inbox || [])
    .map(
      (item) => `
    <div class="card">
      <div class="card-head">
        <span class="phase-label">${escapeHtml(item.date)} &middot; ${escapeHtml(item.author)}</span>
        <span class="sha">${escapeHtml(item.sha)}</span>
      </div>
      <h3>${escapeHtml(item.subject)}</h3>
      <p class="summary">${escapeHtml(item.note || "")}</p>
    </div>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(data.project?.name || "Engineering")} - Build Timeline</title>
<!-- GENERATED ARTIFACT - DO NOT HAND-EDIT. Run: node scripts/generate-timeline.mjs -->
<style>${SHARED_CSS}</style>
</head>
<body>
<div class="container">
  <header>
    <h1>${escapeHtml(data.project?.name || "Build Timeline")} - Commit Spine</h1>
    <p class="tagline">Chronological verification ledger and auto-captured Git commit inbox.</p>
  </header>
  <div class="toolbar">
    <a class="nav-link" style="margin-left:0" href="roadmap.html">&larr; Back to Phase Roadmap</a>
  </div>
  <h2>Verified &amp; Tracked Milestones</h2>
  <section class="grid">${rows}</section>
  <h2 style="margin-top:36px">Auto-Captured Git Commit Inbox (${(data.inbox || []).length})</h2>
  <section class="grid">${inboxRows || "<p class='tagline'>Inbox is clean.</p>"}</section>
</div>
</body>
</html>\n`;
}

const raw = readFileSync(DATA_PATH, "utf8");
const data = JSON.parse(raw);
validateTimeline(data);

const roadmapHtml = renderRoadmapHtml(data);
const timelineHtml = renderTimelineHtml(data);

if (process.argv.includes("--check")) {
  const currentRoadmap = existsSync(ROADMAP_OUT) ? readFileSync(ROADMAP_OUT, "utf8") : "";
  const currentTimeline = existsSync(TIMELINE_OUT) ? readFileSync(TIMELINE_OUT, "utf8") : "";
  if (currentRoadmap !== roadmapHtml || currentTimeline !== timelineHtml) {
    console.error("✗ HTML artifacts are out of sync with data/timeline.json. Run: node scripts/generate-timeline.mjs");
    process.exit(1);
  }
  console.log("✓ Proof-gated roadmap and build timeline are verified and in sync.");
  process.exit(0);
}

writeFileSync(ROADMAP_OUT, roadmapHtml, "utf8");
writeFileSync(TIMELINE_OUT, timelineHtml, "utf8");
console.log("✓ Generated roadmap.html and build-timeline.html from data/timeline.json");
