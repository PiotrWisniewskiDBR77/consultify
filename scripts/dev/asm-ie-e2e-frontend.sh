#!/usr/bin/env bash
# ASM-IE browser E2E verification (Assessment module, DRD+SIRI) — frontend.
set -euo pipefail
cd "$(dirname "$0")/../.."
export VITE_API_TARGET="http://127.0.0.1:3401"
export VITE_API_URL=
exec npx vite --port 5304 --strictPort
