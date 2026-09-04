#!/usr/bin/env bash
# Lokalne stanowisko 2026-09-05: frontend z linii m03 na :3000, API przez proxy Vite do stagingu
# (VITE_API_TARGET z .env.local). Zmiany w src/ odświeżają się natychmiast (HMR), dane są realne.
set -euo pipefail
cd /private/tmp/m03
exec npx vite --port 3000 --strictPort --host 127.0.0.1
