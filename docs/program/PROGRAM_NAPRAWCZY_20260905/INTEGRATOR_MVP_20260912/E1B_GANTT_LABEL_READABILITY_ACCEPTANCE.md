# Gantt label readability — 2026-09-13

Scoped local fix: scaled SVG tick text rendered at 6.2 physical pixels. HTML overlays now retain 11px; unknown reasons use fixed-size visible text and duplicate start/finish reasons are deduplicated. Axis and track geometry remains unchanged. Independent source review caught invalid span/div nesting, corrected before the final build; no remaining source blocker.

Actual browser RED: ui-e1b-labels-red/font-evidence.json records 6.2px labels and GANTT_LABELS_TOO_SMALL. Identical GREEN denominator in ui-e1b-labels-green: 13 labels at 11px, header and all tracks x446 width620, five table/Kanban/calendar/Gantt/reload identity-selection checkpoints, zero page errors. Root inspected gantt-dark.png. Both directories are under codex4-scratch/ie01-rc2-runtime-20260913.

Existing renderer tests 3/3 PASS, ESLint exit0, diff check clean; build exit0 in36.57s. Index SHA256845f1359e61b52a5d0ac6f737ca6e8cd0c272cb119489353ecf0d8c041080a0f. This patch did not rerun full frontend typecheck; prior integrated baseline was192 diagnostics. Build log E1B_GANTT_LABELS_BUILD.log; browser log E1B_GANTT_LABELS_BROWSER_GREEN.log.

Limits preserved: dark1440 only, two existing native no-Case records, horizontally scrollable minimum-width Gantt, 14 existing GET403 responses and five telemetry POSTs retained. No business mutation or deployment proof. Forecast/progress feed remains a separate in-progress packet; author reports37/37 collected tests, independent reviewer requires URL asOf history handling and real database proof before acceptance. Full MVP remains open.
