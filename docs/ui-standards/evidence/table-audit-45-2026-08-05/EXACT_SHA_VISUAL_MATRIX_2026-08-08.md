# Exact-SHA local visual/runtime matrix — 2026-08-08

Candidate SHA: `da6e409e2b262dddf1b5d347a5bdde593d86cb7a`
Branch: `codex/ui45-dev-render-followup-2026-08-08`
Harness: `dev-render` isolated entry, launch config `t22-five-surfaces` (localhost:3906),
`?screen=assessment-five-surfaces`. No production/Railway/demo/real backend involved —
`Api.get` is mocked in-screen for `/artifacts`, `/initiatives?source=assessment`,
`/assessment-reports/report-1/full`, `/report-builder/report-1/exports`; all other
calls (e.g. `/api/v8/admin/flags`, `/api/organizations/current`) hit whatever local
dev infra happens to be reachable and are not treated as evidence either way.
Viewport: default harness viewport (not resized this pass — no explicit
1440×900/1280×720 comparison was performed).

This matrix independently re-verifies the predecessor's claimed evidence rather than
restating it; where this session's run did not reproduce a prior claim, that is
recorded as a real, undecided gap — not silently accepted, not silently "fixed".

## T22 (Assessment five-surface shell)

| Check | Outcome | Evidence |
|---|---|---|
| 5 tabs render (Library/Processes/Outputs/Reports/Initiatives) | PASS | screenshot; all 5 tab buttons present and clickable |
| Library honest empty/not-implemented state | PASS | "Library is not built yet — The published-definition catalog for this surface has not been implemented in this environment." — no fabricated rows |
| Processes populated | PASS | 2 real rows (Segment Manufacturing — DRD Light 100%, DBR77 · Digital Readiness Diagnosis — Grupa 72%); status chips correct (Wszystkie 2, W przeglądzie 1, Zatwierdzony 1) |
| Outputs populated, no fabrication | PASS | 2 real rows: one fully-populated (DBR77 report, published), one honestly all-dashes for null fields ("Untitled output") — matches `MOCK_ARTIFACTS[1]`'s null fields exactly, no invented values |
| Outputs "All N" single status chip (handoff's specific claim) | **NOT REPRODUCED** | Chip row showed the ordinary bucketed set ("Wszystkie 0" despite 2 real rows) instead of a single "All 2" chip. Traced to the `assessmentMenu3StatusChips` flag area (feature #71 "Tools-parity", unrelated to T22/this program) without isolating a definitive root cause in this pass. Not classified as a T22 regression given the underlying table data is confirmed honest; flagged for a dedicated follow-up, not blocking the RC. |
| Reports populated | PASS | 1 real row (DBR77 Digital Readiness report, 40% progress, Piotr Wiśniewski, 10/07/2026); "Wszystkie 1" chip correctly matches 1 row |
| Reports row-click preview panel | **NOT REPRODUCED** | Clicking the row produced no visible preview panel in this session; not isolated whether this is a click-target/harness issue or a real gap. Downgraded from the handoff's "truthful preview" claim to pending. |
| Initiatives populated, 63-word preview, working kebab | **NOT REPRODUCED** | Rendered a genuine empty state ("No initiatives yet — No assessments found. Create your first assessment to get started.") instead of the claimed populated row. The mock's `/initiatives?source=assessment` response did not visibly reach the table in this run. Not classified as confirmed regression (harness-mock wiring is a plausible alternate cause per the handoff's own "unrelated inherited debt" warning) but explicitly NOT re-confirmed either. |
| No secret/credential leakage in any visible screen | PASS | no tokens, URLs-with-credentials, or raw stack traces rendered; the one console error (`[OrgContext] Error fetching orgs`) is a caught, generic message, not a leaked exception body |

## Other surfaces (R11–R28)

Not visually re-verified this session. `dev-render/screens/initiatives-portfolio-analysis.tsx`
exists in the harness (predates this program, 2026-07-23) and appears to mount the
real `PortfolioAnalysisView`/T26 component, but was not launched or screenshotted
this pass — left as `VISUAL_PENDING` rather than claimed.

## Disposition impact

Per this matrix, `ATOMIC_PACKAGE_MAP.reconciled.csv` records only what was
independently confirmed as `VISUAL_PASS_EXACT_SHA` (T22-TABLE-T00, partially —
see its evidence string for the Initiatives caveat) and reverts the two
not-reproduced claims (T22-PREVIEW-P01, T22-KEBAB-K01) to `VISUAL_PENDING`
rather than carrying forward the prior session's unconfirmed pass. This is a
deliberately more conservative position than the handoff document stated.
