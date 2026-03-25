# V8 Finance Command Row UI Proof

Date: 2026-03-25

Environment:
- Railway project `heartfelt-blessing`
- service `consultify`
- environment `staging`
- deployment `b457eda3-8eac-42d7-8e44-bf36f4f143f2`

Authenticated browser session:
- `https://stage.consultinity.ai`
- authenticated `Admin DBR77` browser session
- surface: `Finance` via `/finance`

## What was verified

UI continuity proof:
- the live `Finance` module loads on staging in the authenticated browser session after the new deployment
- opening `/finance` loads the Finance hub and statements surface used by operators
- the same live Finance surface now calls the governed V8 finance dashboard endpoint:
  - `GET /api/v8/finance/dashboard` -> `200`

Observed continuity note:
- the page still hydrates the broader legacy finance surface in parallel, including:
  - `GET /api/finance-statements/packs` -> `200`

## Scope note

This proves a real user-facing V8 Finance read slice on staging, but not full Finance migration:
- the governed V8 slice currently covers the runtime finance dashboard snapshot consumed by the live hub surface
- statements packs, models, analyses, budgets, valuations, import workflows, and downstream finance mutations still use legacy finance endpoints
- this capture proves finance dashboard continuity on the live Finance hub, not full ingest/workflow parity

Conclusion:
- Finance no longer lacks dedicated staging UI proof entirely
- the live Finance surface now has browser-proven V8 continuity for the governed finance dashboard read
- remaining gap is broader finance ingest/workflow/write continuity, not absence of any live V8 Finance UI path
