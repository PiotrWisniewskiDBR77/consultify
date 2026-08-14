#!/bin/bash
# H4 regression runner — used identically against BOTH the candidate
# (h4-regress, 91b562ea66) and baseline (h4-baseline, fb6dfedd42) worktrees.
# Closes the gaps left by G3: backend-sec-perf (finish PARTIAL), and the
# never-started component-singular / unit-backend / unit-rest / components.
#
# retry=0 is passed EXPLICITLY on the command line — vitest.config.ts sets
# `retry: process.env.CI ? 3 : 1`, so a bare invocation would silently allow
# one retry per failing test and hide flakiness as a pass.
#
# Usage: bash run-regression-batches-h4.sh <root> <database_url> <out_dir> [--only NAME]
set -uo pipefail

ROOT="$1"; shift
DB_URL="$1"; shift
OUT_DIR="$1"; shift

ONLY=""
if [[ "${1:-}" == "--only" ]]; then
  ONLY="${2:-}"
fi

cd "$ROOT"
mkdir -p "$OUT_DIR"

run_batch() {
  local name="$1"; shift
  local out="$OUT_DIR/${name}.txt"
  if [[ -n "$ONLY" && "$ONLY" != "$name" ]]; then
    return
  fi
  if [[ -f "$out" && "${FORCE_RERUN:-0}" != "1" ]]; then
    if grep -q "^EXIT_CODE=" "$out" 2>/dev/null; then
      echo "[skip] $name — already completed"
      return
    fi
    echo "[resume] $name — previous attempt did not finish cleanly, rerunning"
  fi
  echo "[run] $name -> $out"
  {
    echo "=== batch: $name ==="
    echo "=== root: $ROOT ==="
    echo "=== db: $DB_URL ==="
    echo "=== started: $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
    echo "=== paths: $* ==="
    NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL="$DB_URL" DB_TYPE=postgres \
      VITEST_HEAP_MB=8192 npx vitest run "$@" --config vitest.config.ts \
      --retry=0 --maxWorkers=2 --maxConcurrency=4 --reporter=dot
    echo "EXIT_CODE=$?"
    echo "=== finished: $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
  } > "$out" 2>&1
}

run_batch "backend-sec-perf"   tests/backend tests/security tests/performance \
                                --exclude '**/memory-leak.test.ts'
run_batch "component-singular" tests/component
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
                                tests/unit/components tests/unit/testing \
                                tests/unit/actions tests/unit/artifacts \
                                tests/unit/assessment tests/unit/billing tests/unit/config \
                                tests/unit/decision tests/unit/frontend tests/unit/hooks \
                                tests/unit/i18n tests/unit/kimiworkspace \
                                tests/unit/myWorkTable tests/unit/pmo tests/unit/presentations \
                                tests/unit/realtime tests/unit/routes tests/unit/settings \
                                tests/unit/sync tests/unit/superadmin \
                                tests/unit/*.test.ts tests/unit/*.test.tsx tests/unit/*.test.js
run_batch "components"         tests/components

echo ""
echo "Batch run complete/resumed for $ROOT. Status:"
for f in "$OUT_DIR"/*.txt; do
  [[ -f "$f" ]] || continue
  code=$(grep -oE "EXIT_CODE=[0-9]+" "$f" | tail -1)
  summary=$(grep -E "Test Files|Tests  " "$f" | tail -2 | tr '\n' ' ')
  echo "  $(basename "$f"): ${code:-IN_PROGRESS/KILLED}  ${summary}"
done
