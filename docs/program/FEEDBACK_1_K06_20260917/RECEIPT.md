# FEEDBACK-1 — K-06 Materials document upload

**Verdict: READY FOR CTO REVIEW.** The global Documents panel now opens on My documents when no project is selected, and a confirmed upload remains visible with an explicit success/status message while eventual GET readback catches up. Rejected or malformed responses produce an actionable error and never fabricate success.

## Scope

- Base: `be57c5dae677844a224d78d874d3ab52444a882d`
- Branch: `codex/feedback-1-k06-material-upload-20260917`
- Freeze marker: `[ODMROZENIE 11_MATERIALS DEC-575] [ODMROZENIE WSPOLNE DEC-575]`
- No migration, feature flag, deployment, or staging write.

## Behavior delivered

- No-project entry defaults to user documents; the unavailable project tab is disabled and has a visible, accessible explanation.
- A `201` is accepted only when the returned document has a trimmed string ID, a readable name, and a canonical status.
- The confirmed POST record is protected for a bounded 60-second readback window. A richer GET record wins without duplicate rows and is not erased by a subsequent briefly stale empty GET.
- Success and failure are visible through `role="status"` and `role="alert"`; retrying the same file remains possible.
- `partial_ready` and `policy_blocked` have honest EN/PL labels; the shared `DocumentStatus` type now matches the backend statuses, including `quota_blocked`.
- The pre-existing route test assertion was aligned with the current fail-closed nested error envelope; no backend product path changed.

## Evidence

- Focused behavior and route contracts after final rebase: **3 files, 33/33 PASS**, `--retry=0`, one worker, no file parallelism.
- Mutation proof: malformed-status validation removed → RED (2 tests); enriched-GET precedence removed → RED (1 test). Earlier focused mutations also made default-tab selection and stale-empty-readback protection RED. All mutations were restored byte-for-byte before the final GREEN run.
- Independent review after fixes: **ACCEPT, P0=0, P1=0, P2=1**. Remaining P2: no fake-timer test advances beyond the 60-second grace window; the expiry branch exists in product code.
- Front TypeScript with `NODE_OPTIONS=--max-old-space-size=8192`, same installation and command on both trees: base **152**, candidate **152**, error lists byte-identical. The default 4 GB heap aborted before a result and is not counted as a measurement. This local count differs from CTO's reported 169 on another installation; delta here is zero.
- Server TypeScript candidate: **0 diagnostics / RC=0**, with installed and lockfile `@types/node` both **22.19.3**.
- `check:jezyk:ci`: PASS; `check:flagi:dockerfile`: PASS (196 flags, 0 missing); `check:list-canon`: PASS (346/346); `check:artefakt`: PASS (8/8); locale JSON parse: PASS; `git diff --check`: PASS.
- Scoped ESLint: changed component/test have 0 errors; warnings are inherited. `src/types/core.ts` exposes an inherited export-sort error at line 732 outside this delta.
- Screenshots intentionally omitted under the current channel rule: nobody creates screenshots.

## Scope limits

The backend already returns the persisted document in the `201` response and exposes list readback. This package changes the frontend confirmation/reconciliation contract and its tests; it does not claim a new RealPG backend implementation.
