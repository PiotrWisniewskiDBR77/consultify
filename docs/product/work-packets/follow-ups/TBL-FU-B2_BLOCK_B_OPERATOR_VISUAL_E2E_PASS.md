# TBL-FU-B2 — Block B operator visual + E2E + migration runtime pass

**Priority:** P2
**Owner:** QA operator
**Source:** Block B · B-S6 deferred manual layers (`evidence/sprint-6/validation-matrix-run.md` § L5 + L6 + L8.3).
**Filed at:** B-S7 closeout, 2026-05-08

## Goal

Run the Block B manual / staging-dependent checks deferred from B-S6:

- E2E smoke (`tests/e2e/smoke/tabele-provenance.spec.ts`) — 4 scenarios.
- Visual review of provenance components vs DBR77 reference.
- Word-canvas idiom diff vs Foundation Block records section (L6.3).
- 1 M-record migration runtime benchmark on staging snapshot.

## Acceptance Criteria

- E2E `tabele-provenance.spec.ts` — all 4 scenarios green:
  - Add source via grid popover → source persists, refresh shows source.
  - Confidence bar visible on rows with score < 0.7.
  - Validation badge transitions `?` → `✓ AI` → `✓` on "Mark verified" click.
  - Tabele word-canvas records section shows provenance column.
- Visual review screenshots collected for source popover (4 source types), confidence bar gradient (4 tiers), validation badge (4 variants), Tabele preview records section.
- Word-canvas idiom parity ≥ 90 % vs Foundation Block reference (subjective, signed-off by UX reviewer).
- L8.3 migration runtime — `up` + `down` complete in < 30 s on 1 M-row snapshot.
- Audit trail manual re-confirmation (L6.4) — trigger source add / remove + status flip; verify every mutation logs `actor`, `before`, `after`.

## Dependencies

- Staging deployment carrying Block B migration + at least 1 M synthetic records for L8.3.
- Should ideally run alongside `TBL-FU-A2` (Block A operator pass) so the operator captures both blocks in one staging session.

## Estimate

~0.7 day (E2E + screenshots + 1 M benchmark + audit trail spot-check).
