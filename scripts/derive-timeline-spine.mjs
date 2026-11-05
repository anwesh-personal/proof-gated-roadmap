#!/usr/bin/env node
/**
 * derive-timeline-spine.mjs
 *
 * Reads the latest Git commit from the current repository and appends it to
 * the `inbox[]` array in data/timeline.json if it is not already tracked in
 * `milestones[]` or `inbox[]`.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DATA_PATH = resolve(ROOT, "data/timeline.json");

try {
  const out = execFileSync(
    "git",
    ["log", "-1", "--pretty=format:%h|%ad|%an|%s", "--date=short"],
    { cwd: ROOT, encoding: "utf8" }
  ).trim();

  if (!out) process.exit(0);
  const [sha, date, author, subject] = out.split("|");

  const data = JSON.parse(readFileSync(DATA_PATH, "utf8"));
  data.inbox = Array.isArray(data.inbox) ? data.inbox : [];

  const knownInMilestones = (data.milestones || []).some((m) => m.sha === sha);
  const knownInInbox = data.inbox.some((i) => i.sha === sha);

  if (!knownInMilestones && !knownInInbox) {
    data.inbox.unshift({
      sha,
      date,
      author,
      subject,
      note: "Auto-captured by post-commit hook; awaiting promotion to a milestone.",
    });
    writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
    console.log(`✓ Added commit ${sha} to data/timeline.json inbox.`);
  }
} catch {
  // Never block a git commit if git log fails in a fresh repo
  process.exit(0);
}
