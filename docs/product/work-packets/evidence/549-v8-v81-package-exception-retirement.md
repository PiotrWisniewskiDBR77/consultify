# 549 - V8 + V8.1 package exception retirement

Date: 2026-03-29
Owner: Cursor agent
Scope: retire the last historical package-level exceptions after Wave 1 closure

## Why this document exists

Several final package-level docs still say the frozen `V8 + V8.1` package was:

- `closed with bounded exceptions`

and they name exactly two carried exceptions:

1. `Calendar`
2. `Organization / Admin / Superadmin`

That is no longer the best available truth in the repo.

## Current authority chain

The post-closure operational tracker already records both lanes as complete:

- `docs/product/work-packets/POST_V81_BACKLOG_TRACKER.md`
  - tranche board rows mark both lanes `done`
  - event log records:
    - final calendar staging proof and lane move to `done`
    - final superadmin staging proof and lane move to `done`

- `docs/product/work-packets/POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM.md`
  - tranche summary marks both lanes `done - staging proven`
  - event log records both final proofs and states that `Tranche 0` is acceptance-complete

Those records are later than the older final-decision memos that still carried the exceptions.

## Retired exception A: `Calendar`

Tracker truth:

- `POST_V81_BACKLOG_TRACKER.md` marks `Calendar` as `done`
- the tracker event log states that final calendar staging proof was recorded and the lane moved to `done`
- the debt-reduction program states `Calendar` is now closed as staging-proven for the bounded V8 slice

Operational reading:

- the old exception was not a missing implementation gap
- the repo’s later program records already treat the staging proof as obtained
- `Calendar` should no longer be carried as an open package exception

## Retired exception B: `Organization / Admin / Superadmin`

Tracker truth:

- `POST_V81_BACKLOG_TRACKER.md` marks `Organization / Admin / Superadmin` as `done`
- the tracker event log states that final superadmin staging proof was recorded and the lane moved to `done`
- the debt-reduction program states the bounded diagnostics surface is live and `Tranche 0` is acceptance-complete

Operational reading:

- the old exception was not a missing implementation gap
- the repo’s later program records already treat the superadmin diagnostics proof as obtained
- `Organization / Admin / Superadmin` should no longer be carried as an open package exception

## Decision

The historical package-level exceptions for:

- `Calendar`
- `Organization / Admin / Superadmin`

are now retired.

## Resulting package posture

The frozen `V8 + V8.1` package should now be described as:

- `closed`

not:

- `closed with bounded exceptions`

## Scope boundary

This retirement does not reopen or widen any frozen lane.

It only removes two stale exception statements that were already superseded by later tracker/debt-program records.

## Status

- remaining package-level carried exceptions: `0`
- Wave 1 module closure remains ratified in `548-v81-wave1-final-module-gate-ratification.md`
- package-level final-decision docs should now be read through this retirement record
