#!/usr/bin/env bash
# Frontend dev server dla paczki D2 (docs/program/DANE_POKAZOWE_EN_20260908/PLAN.md
# §D2) — proxy API do backendu na porcie 4180 (kopia_d2), --mode test jak w
# instrukcji zlecenia. Port 38271 (nie 3200 — 3200 był zajęty przez inny
# równolegle działający robotnik w tym samym współdzielonym środowisku;
# zmierzone `lsof -i :3200` 2026-09-08), --strictPort (bez cichej zmiany portu).
set -euo pipefail
cd "$(dirname "$0")/../.."
export VITE_API_TARGET="http://127.0.0.1:4180"
export VITE_API_URL=""
exec npx vite --mode test --port 38271 --strictPort
