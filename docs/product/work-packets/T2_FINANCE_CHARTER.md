# T2 Charter - Finance

Date: 2026-03-26
Lane: `Finance`
Taxonomy: `T2`
Tranche: `Tranche 2`
Status: `done`

## Why now

`Sync / connectors / interoperability` is now accepted as the previous active `T2` lane. `Finance`
is the next highest-value parked candidate because it already has a governed V8 runtime strip,
a live operator-facing hub, and a bounded route/shell authority packet that can be closed without
opening the broader ingest and mutation surface.

## Goal

Promote one bounded finance parity slice that reduces mixed truth across:

- finance lane entry and route authority
- shell and AppView resolution for the live finance module
- bounded V8-first finance continuity before deeper ingest/mutation parity

## In scope

1. finance lane route and shell consistency
2. split-brain map for finance URLs, frontend surfaces, and runtime contracts
3. one bounded finance packet at a time
4. tracker/program/evidence updates after each packet

## Explicitly out of scope

1. full ingest pipeline migration
2. broad finance mutation redesign
3. modeling / budgets / valuations parity in one packet
4. broad `finance-v4` retirement

## Initial bounded packet

Packet 1:

- promote `/finance` as the canonical finance route authority
- keep `/economics` as a compatibility alias
- align RouterSync protection, AppView resolution, and chat navigation to the canonical finance path

Why this first:

- smallest high-value split-brain cut
- removes live route/shell ambiguity without touching sensitive finance writes
- makes later finance runtime packets easier to reason about

Recorded in:

- `evidence/145-v81-finance-entry-route-shell-parity.md`

## Packet 2

Completed:

- add V8 parity for the active finance analyses list/read seam
- move finance analysis and investment tabs onto a governed V8-first analyses read path
- keep fallback bounded to compatibility statuses only while broader finance reads remain on legacy paths

Recorded in:

- `evidence/146-v81-finance-analyses-list-read-seam.md`

## Packet 3

Completed:

- add V8 parity for active finance analysis preview ratios
- move `useFinanceSelection` onto a governed V8-first ratios seam for table-preview continuity
- keep fallback bounded to compatibility statuses only while the deeper dedicated workspace still has residual legacy reads

Recorded in:

- `evidence/147-v81-finance-analysis-ratios-preview-seam.md`

## Packet 4

Completed:

- remove raw legacy analysis list and ratio reads from `FinancialAnalysisWorkspace`
- align the dedicated analysis workspace to the same shared V8-first analysis seams already used by the hub and preview flow
- keep analysis workspace create/write behavior explicitly out of scope for this packet

Recorded in:

- `evidence/148-v81-finance-analysis-workspace-v8-read-seam.md`

## Packet 5

Completed:

- add V8 parity for finance initiative proposal reads in the export-to-initiatives dialog
- move `ExportToOutputDialog` onto a governed V8-first proposal seam
- keep the actual initiative creation accept/write step for the next bounded packet

Recorded in:

- `evidence/149-v81-finance-initiative-proposals-v8-read-seam.md`

## Packet 6

Completed:

- add V8 parity for accepting analysis proposals into initiatives
- move `ExportToOutputDialog` initiative creation onto a governed V8-first write seam
- complete the bounded analysis-to-initiative flow without broadening into other finance writes

Recorded in:

- `evidence/150-v81-finance-initiative-create-accept-v8-seam.md`

## Packet 7

Completed:

- add V8 parity for finance analysis operator mutations `run` and `approve`
- move both table row actions and preview footer actions onto governed V8-first mutation seams
- keep broader create/delete mutation cleanup for later bounded packets

Recorded in:

- `evidence/151-v81-finance-analysis-operator-mutations-v8-seam.md`

## Packet 8

Completed:

- add V8 parity for finance analysis creation over `POST /api/economics/financial-analyses`
- move active analysis creation entry points onto a governed V8-first seam in `CreateAnalysisModal`, `FinancialAnalysisWorkspace`, and duplicate actions
- keep fallback bounded to compatibility statuses only while broader finance ingest flows remain outside this packet

Recorded in:

- `evidence/152-v81-finance-analysis-create-v8-seam.md`

## Packet 9

Completed:

- add V8 parity for finance analysis deletion over `DELETE /api/economics/financial-analyses/:id`
- move active analysis delete actions onto a governed V8-first seam in `useFinanceRowActions`
- keep broader archive / downstream mutation breadth outside this packet

Recorded in:

- `evidence/153-v81-finance-analysis-delete-v8-seam.md`

## Next bounded candidate

1. identify the next V8-first client/runtime packet inside the active finance lane
2. assess whether the active finance analysis cluster is now sufficient for bounded `T2` acceptance
3. only choose one more packet if the acceptance review still finds a small active residual outside create/delete coverage

## Acceptance decision

1. the bounded active `Finance` lane is now ready for `T2` acceptance
2. the active finance analysis cluster now has governed V8-first continuity for route authority, dashboard/runtime strip, list/read, preview ratios, dedicated workspace reads, create, delete, proposal discovery, initiative accept, and operator mutations
3. remaining statements, models, budgets, valuations, import submissions, and broader finance mutation breadth are treated as broader parity work, not blockers for bounded acceptance
4. acceptance is recorded in `evidence/154-v81-finance-t2-acceptance.md`
