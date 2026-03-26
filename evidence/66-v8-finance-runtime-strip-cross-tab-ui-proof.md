# V8 Finance runtime strip cross-tab UI proof

Date: 2026-03-25
Environment: staging (`https://stage.consultinity.ai`)
Service: `consultify`
Deployment: `fda65628-1733-4d31-a1df-f3e984af2e72`

## Scope

Extend Finance continuity beyond the initial `/finance` load by proving that the governed V8 finance dashboard summary remains visible on multiple live Finance tabs, not only on the first statements load.

## Live staging proof

Authenticated browser session:

- `https://stage.consultinity.ai`
- authenticated DBR77 operator session
- surface: `Finance`

### Initial finance load

Fresh route:

- `https://stage.consultinity.ai/finance`

Observed requests:

- `GET /api/v8/finance/dashboard` -> `200`
- `GET /api/finance-statements/packs` -> `200`

### Cross-tab continuity

After switching from the default `Statements` tab to `Analysis` and then `Models`:

- the governed runtime strip remained visibly present on the live surface
- browser text search found the same governed pills on the active non-default tabs:
  - `V8 Ingestion`
  - `Escalations`
  - `Linkages`

Observed tab-specific legacy reads during the same cross-tab session:

- `GET /api/economics/financial-analyses` -> `200`
- `GET /api/financial-modeling/models` -> `200`

## Honest closure read

This does not prove full finance migration or finance write parity.

It does prove that the governed finance dashboard snapshot is no longer only an initial-load detail. The live Finance hub now keeps the V8 runtime summary visible while operators move across at least:

- `Statements`
- `Analysis`
- `Models`

Remaining finance gap is broader ingest/workflow/write continuity, not whether the governed finance summary survives beyond the first Finance tab.
