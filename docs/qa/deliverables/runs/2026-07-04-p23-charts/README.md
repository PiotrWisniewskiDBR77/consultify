# P2.3 — data-bound deck charts (before/after)

Proof that the deck slide renderer (`ChartBlock`) now draws REAL data-bound
charts instead of an icon placeholder ("… chart" grey box).

Rendered via the W7 harness (`scripts/deliverables/w7/render-charts-p23.mts`) +
real `CardRenderer`, VTS fixture chart slides:

- **slide2** — `performance_overview`, `chartType: line` (12-month adoption trend)
- **slide4** — `comparison`, `chartType: bar`, 3 series (VTS vs 2 competitors)

`*_before.png` = old ChartBlock (bar-only inline; every other type → icon
placeholder; multi-series `series` payload ignored → fell back to FAKE default
Q1–Q4 data). `*_after.png` = new recharts renderer, data-bound, theme palette.

Regenerate:
```
LABEL=after OUT_DIR="$PWD/docs/qa/deliverables/runs/2026-07-04-p23-charts/png" \
  node --import tsx scripts/deliverables/w7/render-charts-p23.mts
```
(BEFORE frames captured by running the same script against the pre-P2.3
ChartBlock.)
