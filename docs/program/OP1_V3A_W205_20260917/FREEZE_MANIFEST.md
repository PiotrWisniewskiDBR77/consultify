# Freeze manifest — OP-1 v3a W205

Status: READY FOR CTO REVIEW.

Changed in v3a:

- `src/components/assessment/AssessmentOutputsTab.tsx` — row click opens the frozen Output preview again; live session opening stays as an explicit action.
- `src/components/assessment/__tests__/AssessmentOutputsTab.openSession.source.test.ts` — source guard updated from the v2 incorrect row-click navigation rule to the W205 preview rule.
- `server/src/method-core/__tests__/MethodSessionService.sessionName.realpg.test.ts` — RealPG proof for Z-63b session names.
- `docs/program/OP1_V3A_W205_20260917/` — receipt and freeze manifest.

Acceptance evidence:

- Assessment Outputs behavioral suite is green again.
- Session name persistence has source and RealPG coverage.
- v3a scope is explicit; the remaining W101 connections are deferred to v3b and not counted as complete here.
- No migration was added.
