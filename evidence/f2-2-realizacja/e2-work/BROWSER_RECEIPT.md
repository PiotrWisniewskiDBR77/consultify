# F2-2 E2 browser receipt — Wpis 42 closure 2026-09-14

**Result: PASS on the production-built full `ExecutionHub` in EN light/dark and PL dark.**

- Build: `VITE_EXECUTION_WORK_ANALYSIS=true NODE_OPTIONS=--max-old-space-size=8192 npx vite build --config dev-render/vite.execution-work-analysis.config.ts` — exit 0.
- Route: `ExecutionHub` → Work → Work report → first attention record → Open preview. The harness uses the real `ExecutionHub`, `StandardModuleBar`, `StandardTable`, `StandardPreview`, and production translation files.
- The row kebab visibly exposes only reachable capabilities: Open source record, Escalate, Delegate, Change resources, and Open preview. Edit/archive/delete are absent because this runtime projection has no such mutations.
- The preview header Open is enabled and uses the same source handler as Open source record. Project and owner are rendered as `North plant transformation` and `Anna Kowalska`; no project/owner identifiers are visible.
- Each of the three fresh runs recorded 0 console errors, 0 page errors, and 0 HTTP 4xx/5xx responses. The repeatable capture is `scripts/dev/e2-work-execution-hub-screenshots.mjs`.
- EN light: `work-analysis-light.png`, 101,331 bytes, SHA-256 `98a98d1b6774a9cf702c23d12706c8ee163394ce6dd2a7432ecdd1b9389598bb`.
- EN dark: `work-analysis-en-dark.png`, 107,069 bytes, SHA-256 `cd66ea785f212fba4bf4dd1212aa18adaaffe74ab30f02185100143ee3b3972c`.
- PL dark: `work-analysis-dark.png`, 114,268 bytes, SHA-256 `ff658131abc22818a2d0d3f708f5b19382f95faeefd4bfc3e91c254bf23af125`.
