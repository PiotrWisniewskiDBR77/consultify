#!/bin/bash
# STREAM 6 (2026-08-13) — batched, resumable full regression runner.
#
# Why this exists: a single unbatched `vitest run` over the whole default
# include set (~3900 files) was previously killed after 8+ minutes with zero
# output — no partial signal, nothing to resume from. This script runs the
# same suite directory-by-directory, writes each batch's result to its own
# file THE MOMENT that batch finishes (not buffered until the whole run
# ends), and skips any batch whose result file already exists — so a killed
# run loses at most the one batch that was in flight, not everything.
#
# Usage:
#   bash scripts/testing/run-regression-batches.sh            # run all pending batches
#   bash scripts/testing/run-regression-batches.sh --only unit-backend
#   FORCE_RERUN=1 bash scripts/testing/run-regression-batches.sh --only src
#
# Results land in docs/program/METHOD_TOOLS_2026-08-13/regression-batches/<name>.txt
# (raw vitest output, tail has EXIT_CODE=<n>) — .txt, not .log, because
# `*.log` is gitignored repo-wide and these files ARE the evidence, meant to
# be committed. That directory is the resumability ledger: a batch is "done"
# iff its .txt file exists and ends with an EXIT_CODE line.
#
# NOTE on vitest CLI path filters: they are SUBSTRING matches, not path
# prefixes. Passing `src` as a filter also matches `server/src/**` (the
# substring "src" appears in both). That's why `src` and `server-src` are
# merged into one batch below instead of run separately — running them
# separately would silently re-run server/src twice, not skip it.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

OUT_DIR="$ROOT/docs/program/METHOD_TOOLS_2026-08-13/regression-batches"
mkdir -p "$OUT_DIR"

ONLY=""
if [[ "${1:-}" == "--only" ]]; then
  ONLY="${2:-}"
fi

run_batch() {
  local name="$1"; shift
  local out="$OUT_DIR/${name}.txt"
  if [[ -n "$ONLY" && "$ONLY" != "$name" ]]; then
    return
  fi
  if [[ -f "$out" && "${FORCE_RERUN:-0}" != "1" ]]; then
    if grep -q "^EXIT_CODE=" "$out" 2>/dev/null; then
      echo "[skip] $name — already completed (rm $out or FORCE_RERUN=1 to redo)"
      return
    fi
    echo "[resume] $name — previous attempt did not finish cleanly, rerunning"
  fi
  echo "[run] $name -> $out"
  {
    echo "=== batch: $name ==="
    echo "=== started: $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
    echo "=== paths: $* ==="
    VITEST_HEAP_MB=8192 npx vitest run "$@" --config vitest.config.ts \
      --maxWorkers=2 --maxConcurrency=4 --reporter=dot
    echo "EXIT_CODE=$?"
    echo "=== finished: $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
  } > "$out" 2>&1
}

# Batch order: smallest/fastest first, so a time-boxed run gets maximum
# directory coverage before anything gets killed.
run_batch "hooks-store"        tests/hooks tests/store
run_batch "backend-sec-perf"   tests/backend tests/security tests/performance
run_batch "component-singular" tests/component
run_batch "src-and-server-src" src server/src
run_batch "unit-backend"       tests/unit/backend
run_batch "unit-rest"          tests/unit/deliverables tests/unit/services tests/unit/views \
                                tests/unit/finance tests/unit/mywork tests/unit/execution \
                                tests/unit/results tests/unit/initiatives tests/unit/discovery \
                                tests/unit/initiative tests/unit/scripts tests/unit/mindmap \
                                tests/unit/server tests/unit/utils tests/unit/table \
                                tests/unit/AIChat tests/unit/reports tests/unit/artifact-studio \
                                tests/unit/ai tests/unit/store tests/unit/documentStudio \
                                tests/unit/auth tests/unit/voice tests/unit/lib \
                                tests/unit/contracts tests/unit/canvas tests/unit/bootstrap \
                                tests/unit/components tests/unit/testing
run_batch "components"         tests/components
run_batch "integration"        tests/integration

echo ""
echo "Regression batch run complete (or resumed to current point). Status:"
for f in "$OUT_DIR"/*.txt; do
  [[ -f "$f" ]] || continue
  code=$(grep -oE "EXIT_CODE=[0-9]+" "$f" | tail -1)
  summary=$(grep -E "Test Files|Tests  " "$f" | tail -2 | tr '\n' ' ')
  echo "  $(basename "$f"): ${code:-IN_PROGRESS/KILLED}  ${summary}"
done
