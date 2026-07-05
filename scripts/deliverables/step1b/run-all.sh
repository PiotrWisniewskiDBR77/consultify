#!/usr/bin/env bash
# STEP 1b — full visual-proof pipeline: prove → render → VisionQA.
# Run from repo root. VisionQA step needs ANTHROPIC_API_KEY (pull from railway;
# see docs/qa/deliverables/runs/2026-07-04-step1b/README.md).
set -euo pipefail
cd "$(dirname "$0")/../../.."

echo "== 1/3 deterministic proof (no keys) =="
node --import tsx scripts/deliverables/step1b/_prove-composition-layout.mts

echo; echo "== 2/3 render PNG (playwright, no keys) =="
node --import tsx scripts/deliverables/step1b/render-slides.mts

echo; echo "== 3/3 deck-visual VisionQA =="
if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo "SKIP: ANTHROPIC_API_KEY not set. Export it (see README) and re-run visionqa-deck.mts."
  exit 0
fi
node --import tsx scripts/deliverables/step1b/visionqa-deck.mts
