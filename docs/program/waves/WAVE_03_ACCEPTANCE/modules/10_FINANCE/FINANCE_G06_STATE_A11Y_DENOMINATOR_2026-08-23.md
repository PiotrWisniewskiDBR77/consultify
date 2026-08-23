# Finance G06 — state and accessibility denominator

Date: 2026-08-23
State: `DEFINED / EXECUTION_PARTIAL`

## Why this exists

The signed five-workspace test now proves populated cold readback for all five
canonical Finance workspaces. It must not be confused with the wider G06
contract. This file fixes the remaining denominator before another broad
browser run.

## Mandatory state cells

Each workspace must have an explicit result for the six states required by the
MVP master plan. `N/A` requires a written product reason; absence of a test is
not `N/A`.

| Workspace  | Empty  | Loading | Populated          | Error/retry | Permission denied             | Stale/conflict     |
| ---------- | ------ | ------- | ------------------ | ----------- | ----------------------------- | ------------------ |
| Statements | `OPEN` | `OPEN`  | `PASS_CURRENT_WIP` | `OPEN`      | `API_DENIAL_PROVEN / UI_OPEN` | `OPEN`             |
| Analysis   | `OPEN` | `OPEN`  | `PASS_CURRENT_WIP` | `OPEN`      | `API_DENIAL_PROVEN / UI_OPEN` | `OPEN`             |
| Baseline   | `OPEN` | `OPEN`  | `PASS_CURRENT_WIP` | `OPEN`      | `API_DENIAL_PROVEN / UI_OPEN` | `OPEN`             |
| Prediction | `OPEN` | `OPEN`  | `PASS_CURRENT_WIP` | `OPEN`      | `API_DENIAL_PROVEN / UI_OPEN` | `PASS_CURRENT_WIP` |
| Valuation  | `OPEN` | `OPEN`  | `PASS_CURRENT_WIP` | `OPEN`      | `OPEN`                        | `OPEN`             |

Current populated evidence is
`tests/e2e/finance/finance-bvp-five-workspaces.signed.spec.ts`: new signed
contexts reopen Statements, Baseline, Prediction, Analysis and Valuation;
Baseline, Prediction, Analysis and Valuation persist canonical writes;
Statement preserves its read-only contract. Prediction additionally proves a
server-winner revision conflict and canonical client reconciliation.

## Cross-cutting browser dimensions

The final candidate must prove:

- desktop `1440×900` and tablet `1024×768`; mobile remains explicitly
  non-gating for this module;
- Polish and English;
- light and dark themes;
- keyboard-only reachability of module navigation, primary action, tabs and
  retry/close controls;
- visible focus and no keyboard trap;
- accessible names for controls and meaningful status/error announcements;
- automated accessibility scan with zero unwaived serious/critical findings;
- zero unexplained console errors, uncaught page errors and unexpected `4xx/5xx`;
- no horizontal body overflow at the two gating viewports.

The cross-product is not required as every possible combination. Minimum final
evidence is: all 30 state cells once in the canonical language/theme, plus a
pairwise matrix covering both languages, both themes and both gating viewports
for every workspace. Any defect found expands the impacted combinations.

## Current component-level accessibility evidence

A focused current-WIP run of ten Finance accessibility suites passed
`10/10` files and `50/50` tests. It covers dialog roles, focus entry/return,
Escape and focus traps, accessible field/control names, dynamic status/error
announcements and contrast/token negative controls across shared workspace,
Analysis, Baseline, Compare, Comments, Export/Import, Lineage and Saved Views
surfaces.

The run emitted repeated intentional configuration diagnostics
`EMPTY_CONTEXT_FIELDS` from the shared workspace-bar test fixture. Because the
process exited `0` and all assertions passed, this is not represented as a test
failure; it is also not represented as zero-console browser evidence. The full
mounted axe/keyboard/console matrix remains open.

## Closure rule

G06 may be technically closed only when every state cell is `PASS` or justified
`N/A`, every cross-cutting bullet has exact evidence on the frozen candidate
SHA, and failures have stable reproducers. `OWNER_ACCEPTED` remains a separate
Piotr decision under G08–G18.
