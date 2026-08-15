# LOCAL-BROWSER-16 gate — 2026-08-15

## Authority and runtime

- Baseline: `388c68dd5fec598cc7bd4dd9e5eb31c6e7df2500`.
- Isolated worktree; no demo or production writes.
- Disposable PostgreSQL 16/pgvector, 713/713 fresh migrations applied.
- Governed acceptance fixture: dedicated active `OWNER`, normal login form, no token injection, localStorage write, query feature activation, or route interception.
- Local Vite frontend and local Node backend. Backend V8 is fail-closed: `ENABLE_V8_GLOBAL=true` is required and the fixture materializes the exact tenant `v8_enabled` row.
- Evidence bundle: `/tmp/consultify-local-browser-16-final.oxTntZ` (Playwright JSON/HTML, 32 traces, screenshots, videos and per-route runtime JSON).

## Result

The corrected acceptance contract removed the shared onboarding modal and `/api/v8` 404 cascade. The final desktop/mobile matrix is **12 passed / 20 failed**, so the release gate remains **NO-GO / PARTIAL**. Execution is no longer a disabled shell and passes on desktop and mobile with real backend responses.

| Module | Desktop | Mobile | Remaining exact signal |
|---|---:|---:|---|
| Chat | FAIL | FAIL | contrast (desktop/mobile); mobile Socket.IO console failure |
| My Work | FAIL | FAIL | mounted screen has no semantic heading |
| Interview | PASS | PASS | none in this gate |
| Tools | FAIL | FAIL | mounted screen has no semantic heading |
| Assessment | FAIL | FAIL | DRD unavailable; SIRI/ADMA/CMMI/Lean rows expose `Coming soon` |
| Initiatives | FAIL | FAIL | `projectCanonicalInitiativeRegisterRow` dereferences missing `initiative.source.freshness` |
| Execution | PASS | PASS | none after explicit global + tenant runtime authority |
| Results | FAIL | FAIL | mounted screen has no semantic heading |
| Finance | PASS | PASS | none in this gate |
| Materials | FAIL | FAIL | mounted screen has no semantic heading |
| Audits | PASS | PASS | none in this gate |
| Meeting | PASS | PASS | none in this gate |
| Organization | PASS | FAIL | mobile Socket.IO console failure |
| Admin | FAIL | PASS | desktop: four unnamed selects |
| Settings | FAIL | FAIL | unnamed buttons/selects/labels plus contrast |
| Partner Portal | FAIL | FAIL | contrast desktop; unnamed button mobile |

No unexpected API HTTP status >=400 remained in the final completed route evidence. Reload-induced `net::ERR_ABORTED` for the periodic `/api/health` probe is classified by the harness as a navigation cancellation; all other request failures remain blocking.

## Changes in this lane

1. Governed acceptance OWNER persists first-run completion in both the authoritative `user_preferences` key/value store and the legacy users column, with readback.
2. Governed fixture materializes `v8.v8_feature_flags(v8_enabled=1)` for only the allowlisted acceptance tenant, with readback. Global V8 remains an explicit backend environment gate.
3. Candidate-aware Playwright gate covers all 16 SSOT modules on desktop and mobile, content/reload, API/console/request failures, disabled shells, density/overflow, headings, screenshots/traces, and serious/critical Axe findings.

This lane deliberately does not mask or fix the remaining module/a11y failures.
