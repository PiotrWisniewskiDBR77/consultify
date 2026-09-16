# OPEN-1 — Assessment and Execution receipt

**Verdict:** `CODE ACCEPT / RECEIPT HOLD` for OPEN-1A Assessment U-22/U-23 and Execution U-38/U-39. The full frontend TypeScript count required by W116 remains `TIMEOUT_120 / NOT_PROVEN`; no CTO exception has been recorded. Audit U-27/U-28/U-32 remains a separate uncommitted HOLD segment under W116 governance.

## Behavior

- Assessment Insights exposes only legacy records with a live supported session route; row and preview expose `Open session` to the existing session editor route.
- Assessment Menu 3 uses the existing data-driven status filters through `StandardModuleBar`.
- Execution Decisions opens `DecisionWorkspace` by raw `decision.id`; `TOOL_REVIEW`, `TOOL_APPROVE`, and `TOOL_GENERATE` are removed from the manager registry by `decisionType`.
- Execution Work sends legacy `/api/tasks` rows to manager-safe `TaskDetailView` with `ownerScoped={false}` and preserves the existing runtime `work:<case>:<id>` document contract.

## Tests

- Combined focused suite before review: 9 files, 64/64 PASS, `--retry=0`.
- Execution deep-link family after review correction: 4 files, 17/17 PASS, `--retry=0`.
- Targeted esbuild for all changed production files: PASS.
- Full server TypeScript: RC 0.
- Full frontend TypeScript: `TIMEOUT_120 / NOT_PROVEN` under the W20 command limit; not repeated without a new cause per integrator instruction.
- `git diff --check`: PASS.

## Visual evidence

- `01-assessment-insights-list-to-session-en-light.png`
- `04-execution-decisions-to-decision-en-light.png`
- `05-execution-work-to-task-en-light.png`

All are 1440×900, light theme, product UI in English. The images show the real list component, selected row, object preview, and visible Open action. Focused tests prove the destination id/route contract. No staging request or deployment was made.

## W119 contrast measurement

- Automated Playwright computed-style measurement: **PASS**, 10/10 changed CTA/status-filter pairs across light and dark themes.
- Minimum measured contrast: **4.76:1** (`Assessment status filter: Draft/Approved`, light).
- `Open session`: **10.31:1 light / 12.68:1 dark**.
- Execution Decision/Work `Open`: **7.56:1 light / 10.17:1 dark**.
- Semantic-colour structural check: **PASS**; no measured control combines a same-hue semantic background and text.
- Machine receipt: `CONTRAST_RECEIPT.json` (`measuredAt=2026-09-16T13:08:34.259Z`).

## Governance-separated Audit patch

Audit changes are not part of the OPEN-1A commit. The local hold bundle is `evidence/open-1/OPEN_1_AUDIT_HOLD.patch`, SHA-256 `e5216b7ef1d08aad3442994fa8edf43ad06f128daef2ca6281f08a237c3ceb39`; its file manifest is stored beside it. The worktree stays available pending CTO governance.
