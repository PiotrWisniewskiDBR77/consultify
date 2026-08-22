# Wave 3 remaining-module table preflight — 2026-08-22

Status: `TECHNICAL_PREFLIGHT_PASS / BROWSER_AND_OWNER_REVIEW_PENDING`

Candidate before this pass: `6c375ecc6417a482a19f118e39b08170646c6126`

## Scope and truth boundary

This pass covers the table/list-facing component suites available for the eight
modules without owner review today: Initiatives, Execution, Meetings, Results,
Finance, Materials, Audits and Partner. It is an implementation preflight, not
Piotr's review and not module acceptance. A green component suite does not prove
Railway runtime, durable database readback, responsive/browser quality or the
full 16-module release gate.

## Findings and remediation

| ID | Module | Finding | Resolution | Evidence | State |
|---|---|---|---|---|---|
| `W3-TBL-001` | Initiatives | Historical runtime-v1 rows without a `source` envelope crashed the register; the local mapping exception was then retried as a network outage. | Preserve missing lineage as `UNKNOWN`, retry only transport failures and stabilize fetch dependencies on user primitives. | Commit `6c375ecc64`; focused suites `17/17 PASS`; typecheck PASS. | `TECHNICALLY_FIXED / BROWSER_RETEST_PENDING` |
| `W3-TBL-002` | Execution | Reporting declared `Open preview` twice: once in the primary action block and once through the canonical universal preview handler. | Removed the duplicate primary action and retained the single canonical preview handler plus `Open full`. | Reporting menu contract now PASS in the broad replay. | `TECHNICALLY_FIXED / BROWSER_RETEST_PENDING` |
| `W3-TBL-003` | Results | The dashboard loader made an unscoped global request when no real initiative id existed, contrary to the scoped Results contract. | Fail closed with `null` until a nonblank initiative id is present. | Runtime contract proves blank scopes make zero dashboard calls and a real scope is trimmed and forwarded. | `TECHNICALLY_FIXED / BROWSER_RETEST_PENDING` |
| `W3-TBL-004` | Audits | Audit component tests had drifted from the shared translation/preview contracts (`getFixedT`, translated empty state, composed details text). | Updated the test harness to the current shared contract without changing product behavior. | Wizard and Hub suites PASS in the broad replay. | `TEST_CONTRACT_RECONCILED` |

## Broad replay

Command scope: component suites under Execution, Meeting, Results, Economics,
Audit, ReportsAndPresentations and Provider.

- First run: `304/311 PASS`; seven failures across four files.
- Isolated confirmation showed two product regressions and two stale test
  harnesses; all were reconciled above.
- Final broad rerun: `53/53` files and `311/311` tests PASS.
- Non-failing React `act(...)` warnings remain in Results/Audit tests and are
  log-quality debt, not silently treated as fixed.

## Gate for tomorrow

Before owner review, mount a frozen exact-SHA local candidate on the reconciled
database and browser-check each of the eight modules for: populated table,
honest empty/error/loading states, row selection/preview, kebab/context parity,
deep link, refresh/cold readback, console and failed HTTP calls. Record Piotr's
observations separately and do not infer acceptance from this preflight.
