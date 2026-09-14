# W31 D-j — status-code consumers freeze

**Verdict: READY FOR INDEPENDENT REVIEW.** Four families that compared
`initiatives.status` with values outside the seven-code P12 dictionary now use
the canonical constants. No migration or database write outside the package's
local PostgreSQL was performed.

## Authority and identity

- channel: Wpis 49 → Wpis 31 D-j
- branch: `codex/a-c-dj-status-codes-20260914`
- base: `1154ebd80950d5c7fdd2c2bb88c296e2c98ff35e`
- local database: `cx-a-c-dj-pg`, PostgreSQL 18 + pgvector, `127.0.0.1:5293`

## Inventory and classification

| Family | Before | Classification | Resolution |
|---|---|---|---|
| `ExecutionReportCron.ts:26` | initiative status `EXECUTING` or `BLOCKED` | both dead for P12; `BLOCKED` is the `on_hold` flag | select `InitiativeStatus.IN_EXECUTION`; aggregate `on_hold` without excluding held rows |
| `transformationCaseService.ts:6288` | initiative status `SCHEDULED` | dead persisted code; lifecycle stage collapses to P12 `APPROVED` | compare with `INITIATIVE_STAGE_TO_STATUS.SCHEDULED`; existing `mobilization_results` authority gate remains mandatory |
| `transformationCaseService.ts:6459` | initiative status `EXECUTING` | dead persisted code | compare with `INITIATIVE_STAGE_TO_STATUS.IN_EXECUTION`; existing `execution_start` authority gate remains mandatory |
| `transformationCaseService.ts:6676` | initiative status `DONE` | dead persisted code | compare with `INITIATIVE_STAGE_TO_STATUS.DELIVERED` (`CLOSED` in P12); existing `execution_results` authority gate remains mandatory |
| `resultsROIService.ts:1127-1128` | in realization: `APPROVED/SCHEDULED/EXECUTING`; realized: `DONE/TRACKING` | `APPROVED` intentional; the other four are legacy-read values, while canonical `CLOSED` was omitted | normalize at the compatibility boundary, then classify `APPROVED/IN_EXECUTION` and `CLOSED` using `InitiativeStatus` |
| `planningPortfolioReadService.ts:1037` | `PENDING_REVIEW/REVIEW/PROMOTED/PLANNING` | dead persisted values | `InitiativeStatus.PENDING_APPROVAL` |
| `planningPortfolioReadService.ts:1047` | `REVIEW/PROMOTED/PLANNING/APPROVED` | first three dead; `APPROVED` intentional | `PENDING_APPROVAL` or `APPROVED` through `InitiativeStatus` |
| `planningPortfolioReadService.ts:1124` | `PLANNING/APPROVED` | first dead; second intentional | `PENDING_APPROVAL` or `APPROVED` through `InitiativeStatus` |
| `planningPortfolioReadService.ts:1169` | `DONE` | dead persisted value | `InitiativeStatus.CLOSED` |

The remaining `DONE`, `COMPLETED`, `BLOCKED`, and `DELAYED` literals near the
Transformation checkpoint query belong to `tasks.status` and
`initiative_milestones.status`. They are intentional grammars of those tables,
not comparisons against `initiatives.status`, and were not changed.

## Evidence

- mutation RED before implementation: 4 tests collected, 4 failed
- focused GREEN: `d-j-status-codes.test.ts` — 4/4
- RealPG: `RUN_DB_TESTS=1 MOCK_DB=false` — 3/3 collected and passed, 0 skipped
- RealPG negative control: P12 `CHECK` rejects `EXECUTING`, `BLOCKED`,
  `SCHEDULED`, and `DONE` with PostgreSQL `23514`
- importer siblings after the final source change: 6 files, 120/120 tests passed
- wider importer inventory: 42 files; 29 green and 13 red; all 13 red files
  reproduced red on the exact base, before restoring the candidate patch
- server TypeScript: exit 0 with `NODE_OPTIONS=--max-old-space-size=8192`
- Prettier: all six changed production/test files pass
- `git diff --check`: clean

Local command receipts are in `evidence/d-j-status-codes/` and are excluded
from the commit. The independent reviewer must rerun the focused unit and
RealPG files, validate the inventory, and classify the base-identical reds.
