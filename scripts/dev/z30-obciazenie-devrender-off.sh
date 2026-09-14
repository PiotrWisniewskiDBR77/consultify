#!/usr/bin/env bash
# Z-30 (14.09) — dev-render z heatmapą obciążenia WYŁĄCZONĄ (linia: CapacityScenarioSurface).
set -euo pipefail
cd "$(dirname "$0")/../.."
export VITE_INITIATIVES_FOUR_BUTTONS="true"
exec npx vite --config dev-render/vite.config.ts --port 5411 --strictPort
