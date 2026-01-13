#!/usr/bin/env bash
# Helper to load local env and seed LLM providers (and optional demo usage).
# Usage:
#   chmod +x scripts/seed-llm.sh
#   ./scripts/seed-llm.sh              # seed providers only
#   ./scripts/seed-llm.sh demo         # seed providers + demo usage data
#
# Notes:
# - Put your keys in .env.local (not committed):
#     OPENAI_API_KEY=...
#     GEMINI_API_KEY=...
#     ANTHROPIC_API_KEY=...
#     DEEPSEEK_API_KEY=...
#     ZHIPU_API_KEY=...
#     OLLAMA_ENDPOINT=http://localhost:11434
# - This script sources .env.local if present and exports vars for the session.
# - No secrets are stored in this script.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env.local"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
  echo "[seed-llm] Loaded environment from .env.local"
else
  echo "[seed-llm] .env.local not found. Export keys before running."
fi

cd "$REPO_ROOT"

echo "[seed-llm] Seeding providers..."
npx tsx server/scripts/seed-llm-providers.ts

if [[ "${1:-}" == "demo" ]]; then
  echo "[seed-llm] Seeding demo usage data..."
  npx tsx server/scripts/seed-ai-usage-demo.ts
fi

echo "[seed-llm] Done."
