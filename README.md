# Proof-Gated Roadmap & Build Timeline

**A zero-network, Git-driven roadmap and build timeline compiler that forces engineering honesty.**

Most roadmaps are fiction. Teams update a Notion doc or a pretty slide deck, mark features as "Done" because a pull request merged, and only find out in production that the feature was never wired up or proven.

This repository gives you a single JSON contract (`timeline.json`), a post-commit Git hook that automatically captures your commit spine, and a zero-dependency Node.js compiler that outputs two self-contained, zero-network HTML files: `roadmap.html` and `build-timeline.html`.

---

## The Story Behind This Repo

I built this because I got burned by "green status" illusions while coordinating multiple AI agents and human engineers across a massive multi-repo sovereign AI stack.

An agent or a developer would tell me a milestone was finished. The code compiled. The unit tests passed. On a normal roadmap, that box gets checked green. Then I would sit down to run the actual end-to-end workflow on bare metal, and it would fail immediately. The code existed, or a piece of it existed, but it had never been proven in a live runtime.

I realized that traditional roadmaps fail because they collapse "written" and "proven" into a single word: *Done*.

So I banned the word "Done" from my roadmaps and built this compiler. In this system, a milestone cannot be marked `live` unless it carries a verified Git commit SHA and a concrete proof string (a test log, a curl output, or a runtime measurement). Everything else is forced into honest states: `built_unproven`, `partial`, `design_only`, or `planned`. And because I wanted zero attack surface and zero hosting friction, the generator compiles the entire roadmap and commit timeline into standalone HTML files with inline CSS and inline SVG. You can open them straight from your filesystem on an air-gapped machine, or drop them onto any static server.

---

## Core Features

1. **Six Honest Status Tiers:**
   * `live`: Built, wired, and verified with runtime proof.
   * `built_unproven`: Code is committed and compiles, but lacks end-to-end runtime verification.
   * `partial`: Some sub-components work; others are stubbed or missing.
   * `design_only`: Architecture or specification exists, but zero implementing code is committed.
   * `planned`: Scheduled on the horizon.
   * `superseded`: Replaced by a newer architectural decision (kept for historical audit).
2. **Zero External Dependencies:** Runs on stock Node.js (`node >= 18`). No `npm install` required to compile your roadmap.
3. **Zero-Network HTML Output:** The generated `roadmap.html` and `build-timeline.html` require no internet connection, no CDN fonts, and no external JavaScript bundles. Double-click the file in Finder or Explorer and it works.
4. **Automatic Git Spine Derivation:** Includes a post-commit hook (`scripts/derive-timeline-spine.mjs`) that reads your latest Git commits and appends uncurated work items into an `inbox[]` queue inside `timeline.json` so no commit ever slips through the cracks.
5. **CI Integrity Guard:** Run `node scripts/generate-timeline.mjs --check` in GitHub Actions to fail any pull request where a developer edited `timeline.json` without regenerating the HTML artifacts, or tried to mark an item `live` without citing a commit SHA and proof.

---

## Quick Start (Under 60 Seconds)

```bash
# 1. Clone your fork
git clone https://github.com/YOUR_USERNAME/proof-gated-roadmap.git
cd proof-gated-roadmap

# 2. Compile the roadmap and build timeline from timeline.json
node scripts/generate-timeline.mjs

# 3. Verify that the generated HTML matches the JSON source of truth
node scripts/generate-timeline.mjs --check

# 4. Open the generated files in your browser
open roadmap.html        # macOS (use xdg-open on Linux, start on Windows)
open build-timeline.html
```

---

## Git Basics: Forking, Branching, and Making It Yours

If you are new to Git or want to use this in your own project, follow these exact steps.

### 1. How to Fork This Repo
1. Click the **Fork** button in the top-right corner of this GitHub page.
2. This creates a personal copy of the repository under your own GitHub account (`https://github.com/YOUR_USERNAME/proof-gated-roadmap`).
3. Clone your fork to your computer:
   ```bash
   git clone https://github.com/YOUR_USERNAME/proof-gated-roadmap.git
   cd proof-gated-roadmap
   ```

### 2. How to Use Branches Properly
Never do messy experimental work directly on `main`. Create a feature branch whenever you update your roadmap or tweak the generator:

```bash
# Create and switch to a new branch called "update-q4-roadmap"
git checkout -b update-q4-roadmap

# Edit data/timeline.json with your milestones, then recompile:
node scripts/generate-timeline.mjs

# Check what files changed
git status

# Stage and commit your changes
git add data/timeline.json roadmap.html build-timeline.html
git commit -m "chore(roadmap): record Q4 auth milestone as built_unproven"

# Push your branch to your GitHub fork
git push origin update-q4-roadmap
```
Once pushed, go to your GitHub repo page and click **Compare & pull request** to merge your branch into `main`.

### 3. Installing the Automatic Git Hook
If you want every `git commit` in your project to automatically log its SHA into `data/timeline.json` and recompile the HTML files:

```bash
bash scripts/install-hooks.sh
```
This links `.git/hooks/post-commit` to `scripts/post-commit-hook.sh`. Every time you commit code, the hook appends the new commit SHA to the `inbox` array in `data/timeline.json` and refreshes `roadmap.html` and `build-timeline.html`.

---

## How to Edit `data/timeline.json`

Open `data/timeline.json` in any editor. Each milestone in the `milestones` array follows this strict schema:

```json
{
  "id": "ms-auth-gateway",
  "phase": "Phase 1: Core Foundation",
  "title": "Zero-Trust Session Gateway",
  "owner": "founder",
  "status": "live",
  "date": "2026-10-14",
  "sha": "a1b2c3d",
  "summary": "Mutual TLS + Ed25519 request verification at the edge.",
  "proof": "Verified via e2e/verify-session.mjs (24/24 assertions passed).",
  "gaps": "Hardware key rotation UI is still in Phase 2."
}
```

**The Golden Rule enforced by the compiler:**
If `"status"` is set to `"live"`, both `"sha"` and `"proof"` **must** be non-empty strings. If you try to set `"status": "live"` with an empty `"proof"`, `node scripts/generate-timeline.mjs` will throw an error and refuse to build.

---

## License

MIT License. Free to use, modify, and distribute in personal and commercial projects.
