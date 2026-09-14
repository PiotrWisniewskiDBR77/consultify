# F2-2 E2 Work analysis — production-bundle browser receipt

- Source SHA: `dc9b7d6a11`
- Build: `NODE_OPTIONS=--max-old-space-size=8192 npx vite build --config s4-vite.config.ts`
- Result: PASS, 2,158 modules transformed; production assets emitted to an isolated `/tmp` directory.
- Browser: Codex in-app Chromium, production bundle served on the package-owned port `4214`.
- Visible anchor: `Work across three time windows`.
- Behavior proof: clicking `Previous week` narrowed the canonical table to `Validate last week evidence`, project `North plant transformation`, status `Completed`, due `2026-09-10T12:00:00.000Z`.
- Browser console warning/error count: `0`.
- Light screenshot: `work-analysis-light.png`, SHA-256 `af381199bf08e446d4d25925734942769e7d754b757336b2460d1f0132381b3a`, 427,243 bytes.
- Dark screenshot: `work-analysis-dark.png`, SHA-256 `f2b62f354469020d070c67aab382d4b9a5efe0a4efe348f5c5ed19d01d8f70d8`, 423,865 bytes.

The browser bundle used the production `WorkIntelligenceReport`, `StandardTable`, and repository CSS. Its local fetch fixture supplied deterministic task/decision payloads solely for visual and interaction acceptance. Gateway/JWT/PostgreSQL lineage is proven separately by `initiativesExecutionRuntime.dropdown.pg.test.ts` on `cx-s4-e2-pg:5290`.
