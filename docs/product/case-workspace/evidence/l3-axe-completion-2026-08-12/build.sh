#!/usr/bin/env bash
# Compiles fixture.html's CSS from the project's REAL tailwind.config.js +
# src/index.css (same token pipeline the app ships), and installs a local,
# isolated axe-core@4.10.2 (--no-save, this directory's own node_modules only
# — never touches the repo's shared package.json/lockfile/node_modules).
#
# Pattern copied from f2-bottomnav-contrast-2026-08-12/build.sh.
# Usage: ./build.sh   (from inside this evidence directory)
set -euo pipefail
EVIDENCE_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$EVIDENCE_DIR/../../../../.." && pwd)"

echo "Repo root: $REPO_ROOT"

echo "==> Compiling real Tailwind CSS..."
(
  cd "$REPO_ROOT"
  ./node_modules/.bin/tailwindcss \
    -i ./src/index.css \
    -o "$EVIDENCE_DIR/compiled.css" \
    --config ./tailwind.config.js
)

echo "==> Installing axe-core@4.10.2 locally (--no-save, this directory only)..."
cd "$EVIDENCE_DIR"
npm install axe-core@4.10.2 --no-save --silent

echo "==> Done. Run: node measure.cjs"
