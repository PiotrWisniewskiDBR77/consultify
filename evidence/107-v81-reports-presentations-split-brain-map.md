# V8.1 Reports / Presentations Split-Brain Map

Date: 2026-03-26
Lane: `Reports / Presentations`
Taxonomy: `T1`
Tranche: `Tranche 1`

## Frontend map

Primary entry points:

- `src/routes/AppRoutes.tsx`
- `src/components/ReportsAndPresentations/ReportsAndPresentationsHub.tsx`
- `src/components/ReportsAndPresentations/useRapData.ts`
- `src/views/ReportBuilderView.tsx`
- `src/components/RouterSync.tsx`

Primary UI split-brain points:

1. Outputs library list uses `/artifacts`, but report/deck actions still mix legacy origins like `/report-builder/:id` and `/presentations/decks/:id`.
2. URL/query contract still says `tab=reports`, while the live hub internally maps that alias onto `outputs_documents`.
3. Old hub/router leftovers still exist beside the live unified outputs library.

## Backend map

Primary API entry points:

- `server/src/Gateway.ts`
- `server/src/routes/report-builder.routes.ts`
- `server/src/routes/presentations.routes.ts`
- `server/src/routes/report-enterprise.routes.ts`
- `server/src/routes/presentation-enterprise.routes.ts`
- `server/src/services/v8/reportsPresModelService.ts`
- `server/src/services/v8/artifactRegistryService.js`

Primary runtime/API split-brain points:

1. Reports and presentations still expose parallel legacy and enterprise prefixes (`/api/report-builder`, `/api/presentations`, `/api/reports-v4`, `/api/presentations-v4`).
2. `reportsPresModelService` defines a V8 operating model, but the live HTTP surface is still primarily legacy/registry driven rather than a single V8-aligned read contract.
3. Multiple writers/readers converge through the artifact registry without one explicit SSOT for delivery/read state.

## Smallest clean starting packet

Start with one bounded packet:

1. Canonicalize the outputs-library read/action authority for reports.
2. Keep the current unified hub, but remove ambiguity between:
   - list source (`/artifacts`)
   - item actions (`delete` / `export` / `review`)
3. Treat `tab=reports` vs `outputs_documents` as an explicit compatibility alias and document/test it, instead of leaving it as accidental behavior.

## Operational decision

`Reports / Presentations` is promoted from `parked` to `active`.

The first execution packet for `Tranche 1` should be:

- make the reports lane use one explicit outputs-library contract for list plus primary actions,
- then remove dead entry leftovers only after the live route contract is stable.
