# Business Work Canvas Stage 15 Renderer Runtime Gate

Status: `DRAFT / STAGE 15 QUALITY GATE`
Owner: Product + Engineering
Created: 2026-05-03
Parent plan: `docs/product/BUSINESS_WORK_CANVAS_IMPLEMENTATION_PLAN.md`

## 1. Purpose

Stage 15 completes the chart and diagram renderer runtime path after the final rollout gate.

The goal is to move beyond renderer adapters: chart specs should render with Vega-Lite when available, and diagrams should expose practical source/SVG actions without losing the Markdown fallback contract.

## 2. Completed Scope

- Added `vega`, `vega-lite` and `vega-embed` dependencies.
- Chart blocks with a `spec` or `vegaLiteSpec` now dynamically load `vega-embed`.
- Vega renders into an isolated Canvas block container using SVG renderer mode.
- Metric fallback bars remain visible for chart readability and failure recovery.
- Mermaid diagram blocks now expose copy source and export diagram actions.
- Diagram export uses rendered SVG when available and Mermaid/source fallback otherwise.

## 3. Safety Contract

- Raw native block JSON must not be shown in the business UI.
- Runtime failures must remain block-local.
- Markdown projection and fallback renderers remain available regardless of Vega/Mermaid status.
- Dynamic runtime loading must not block the rest of the Canvas document.

## 4. Quality Gate

Stage 15 passes only when:

- targeted component tests pass,
- changed renderer files have no linter errors,
- chart spec blocks expose the Vega runtime container,
- fallback bars remain visible,
- diagram copy/export actions work without requiring raw JSON.
