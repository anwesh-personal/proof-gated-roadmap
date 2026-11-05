#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
mkdir -p "$ROOT/.git/hooks"
cat > "$ROOT/.git/hooks/post-commit" <<'EOF'
#!/usr/bin/env bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
node "$ROOT/scripts/derive-timeline-spine.mjs" || true
node "$ROOT/scripts/generate-timeline.mjs" || true
EOF
chmod +x "$ROOT/.git/hooks/post-commit"
echo "✓ Installed .git/hooks/post-commit hook."
