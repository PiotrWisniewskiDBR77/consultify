# PMO-1a W109 — receipt

Status: READY FOR CTO REVIEW.

Branch/worktree: codex/a-pmo-1a-w109-resume-20260917 in `/Users/piotrwisniewski/Developer/codex-wt/a-pmo-1a-w109-resume-20260917`.
Base/WIP recovered from backup: 2b9861b549ba0fe6134effadc14027a396cf4ad3 (`origin/backup/codex/a-pmo-1a-w109-20260916-wip-20260917`).

Scope delivered against W109:
- `VITE_PMO_QUEUES` default OFF; no migration and no staging/demo writes.
- Menu 3 Initiatives PMO queues from existing data: overdue, blocked, approve, discuss, review.
- Register column definitions include Stage, Responsible, Due, and Next Step via the shared PMO column helper.
- Initiative card stage-transition panel uses preflight, approver/decision flow, and the existing `initiative_lifecycle_gate_decisions` log.
- My Work PMO inbox classification keeps PMO items actor-scoped and avoids classifying generic inbox items.
- The empty path for PMO decision items is covered by the focused inbox tests.

Verification:
- Focused Vitest: PASS, 6 files / 45 tests.
  - `src/components/Initiatives/__tests__/pmoQueues.pmo1a.test.ts`
  - `src/components/Initiatives/__tests__/PmoStageTransitionPanel.pmo1a.test.tsx`
  - `src/components/Initiatives/__tests__/pmoContrast.pmo1a.test.ts`
  - `src/components/MyWork/__tests__/inboxPmoQueues.pmo1a.test.ts`
  - `server/src/services/initiative/__tests__/initiativeLifecycleGateDecisionService.test.ts`
  - `server/src/services/initiative/__tests__/ini-mvp-gate-001-lifecycle-gate-route.test.ts`
- Language gate: PASS, no increase; K4en -8, K4obj -36. Report: `/tmp/pmo-lang-report-final-2.txt`.
- `git diff --check`: PASS.
- Front TypeScript: FAIL globally with existing debt, 156 total errors / 5 node_modules / 0 changed-file hits. Log: `/tmp/pmo-front-tsc2.log`.
- Server TypeScript: PASS, 0 total errors / 0 node_modules / 0 changed-file hits. Log: `/tmp/pmo-server-tsc2.log`.

Screenshots/evidence inherited from recovered WIP commit:
- `evidence/pmo-1a-w109/screenshots/initiatives-menu3-pmo-queues-en-light.jpg`
- `evidence/pmo-1a-w109/screenshots/initiatives-menu3-pmo-queues-en-dark.jpg`
- `evidence/pmo-1a-w109/screenshots/initiative-card-stage-transition-en-light.jpg`
- `evidence/pmo-1a-w109/screenshots/initiative-card-stage-transition-en-dark.jpg`

Notes:
- No migration was written.
- No staging/demo/Londyn/integracja push was performed.
- No deploy or Railway/env change was performed.
