# Freeze manifest — PMO-1a v2 W208

Package: PMO-1a v2 rebase and regression closure.
Status: READY FOR CTO REVIEW.

Changed in v2 on top of PMO-1a:

- Rebase conflict resolution in `dev-render/main.tsx`, `CanonicalInitiativeRegister.tsx`, `InitiativesHub.tsx`, and `initiativeRegisterColumns.shared.ts`.
- Source contract update in `InitiativesHub.previewDetails.t25.test.tsx` for the PMO-aware register `persistKey`.
- Receipt and freeze manifest in `docs/program/PMO_1A_W208_V2_20260917/`.

Acceptance evidence:

- STAGE-1 lifecycle register behavior and PMO queues coexist after rebase.
- PMO queues and transition panel tests pass.
- P1-b source regression is closed.
- No migration was added.
