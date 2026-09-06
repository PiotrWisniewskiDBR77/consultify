#!/usr/bin/env bash
# Dev-render harness dla naprawy filtra Realizacji (branch mvp/realizacja-filtr,
# worktree /private/tmp/wt-realizacja-filtr). preview_start czyta
# .claude/launch.json z bieżącego checkoutu (repo głównego), a naprawa żyje w
# osobnym worktree — ten skrypt cd'uje tam i odpala zwykłego vite (nie
# dev-render harness, bo cel to żywa trasa Realizacja z realnym API na :4100,
# nie mock-dane) wskazując na serwer API stanowiska NOC.
set -euo pipefail
cd /private/tmp/wt-realizacja-filtr
export VITE_DOTENV_DISABLED=1
export VITE_API_TARGET=http://127.0.0.1:4100
exec npx vite --port 3105 --strictPort
