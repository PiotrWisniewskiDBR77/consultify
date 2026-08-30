#!/usr/bin/env bash
# R3(b) (panel powtórny DEC-117, naprawa R1-R3 zakładek Audits) — dev-render
# harness dla WORKTREE zawierającego naprawy (branch codex/audits-r1r3-20260826,
# worktree /private/tmp/consultify-audits-r1r3), nie dla tego checkoutu.
# Browser-pane preview_start czyta .claude/launch.json z BIEŻĄCEGO katalogu
# roboczego sesji, ale kod naprawiony przez tę sesję żyje w osobnym
# worktree — ten skrypt cd'uje tam i uruchamia dokładnie ten sam harness
# (dev-render/vite.config.ts), żeby zrzuty pokazywały REALNY, naprawiony kod,
# nie stan tego checkoutu.
set -euo pipefail
cd /private/tmp/consultify-audits-r1r3
exec npx vite --config dev-render/vite.config.ts --port 4540 --strictPort
