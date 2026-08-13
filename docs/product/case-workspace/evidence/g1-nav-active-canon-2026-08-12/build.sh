#!/usr/bin/env bash
# Regenerates the evidence harness's compiled CSS + local axe-core install.
# Safe to re-run any time to re-check the fix as the codebase evolves — it always
# recompiles against the CURRENT src/index.css tokens/theme of the repo this
# evidence directory lives in, so results never go stale/lie.
#
# Does NOT touch the project's package.json/package-lock.json or shared node_modules:
# axe-core is installed with --no-save into this directory's own node_modules only.
#
# Usage: ./build.sh   (from inside this evidence directory)
set -euo pipefail
EVIDENCE_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$EVIDENCE_DIR/../../../../.." && pwd)"

echo "Repo root: $REPO_ROOT"

echo "==> Compiling Tailwind CSS (tailwind.config.evidence.mjs — wraps the real"
echo "    tailwind.config.js unchanged, widens ONLY 'content' to also scan this"
echo "    directory's fixture.html; see that file's header comment for why: the"
echo "    real config never scans this directory, which silently drops the"
echo "    'before' compound-variant classes once the fix has landed in the real"
echo "    component source — caught live building this rig, see README)..."
# Base config's content globs are relative (./src/**/*, ...), so the CLI must
# run with the REPO ROOT as cwd or it silently resolves them against this directory
# instead and emits an empty stylesheet (caught once already — verify by grepping
# compiled.css for a known utility, e.g. `.bg-c-bg {`, after running this).
(
  cd "$REPO_ROOT"
  ./node_modules/.bin/tailwindcss \
    -i ./src/index.css \
    -o "$EVIDENCE_DIR/compiled.css" \
    --config "$EVIDENCE_DIR/tailwind.config.evidence.mjs"
)

echo "==> Installing axe-core@4.10.2 locally (--no-save, this directory only)..."
cd "$EVIDENCE_DIR"
npm install axe-core@4.10.2 --no-save --silent

echo "==> Done. Run: node measure.cjs && node screenshot.cjs"
