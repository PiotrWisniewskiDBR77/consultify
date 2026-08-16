# RES-UI-CANON-001 — mounted UI verification

## Verdict

`PARTIAL` on product SHA `8417acfb9cf59834c9ada2d930dd04cd61904df0`.

The repository-owned KPI, ROI and OKR surfaces rendered correctly against an
isolated PostgreSQL database and the real local backend/frontend. No Results UI
code defect requiring a safe bounded patch was found in this pass. The task is
not `DONE_CURRENT_SHA`: the owner visibility decision, complete automated axe
denominator, full 3 x 2 x 2 presentation matrix, manual VoiceOver and named
human visual acceptance remain open.

## Isolated runtime

- PostgreSQL container: `consultify-res-ui-canon-71ec9269`, PostgreSQL 16 with
  pgvector, loopback port `56511`, database `res_ui_canon`.
- Backend: `127.0.0.1:3091`, `DB_TYPE=postgres`, `MOCK_DB=false`,
  `DB_MANAGED_SCHEMA=off` after the strict runner.
- Frontend: `127.0.0.1:3191`, proxied only to the isolated backend.
- Strict migration runner: 722 migrations on fresh DB; repeat 0 applied;
  dry-run 0 pending.
- Deterministic RN-G6 seed: 2 organizations, 6 users, KPI/ROI/OKR lifecycle
  fixtures. No shared/demo/staging/production database was used.

## Mounted browser observations

- OWNER, org A: KPI Organization view showed 6/6 seeded lifecycle rows:
  1 draft, 1 pending approval, 2 active, 1 suspended, 1 archived.
- OWNER, org A: ROI showed 6/6 rows covering modeling, approved, tracking,
  PIR, changes requested/not-calculable and closed/locked.
- OWNER, org A: OKR registry and active set rendered. Direct entry and reload
  preserved `/results/okr/sets/f772dd20-6d67-49a1-89a1-f772dd6d67ca`.
- MEMBER, org A: direct `/results/kpi` entry was denied and redirected to
  `/interview`; Results controls were unavailable.
- ADMIN, org B: organization KPI view exposed exactly 2 org-B rows, not org A's
  6 rows.
- PL/dark at 1440x900, PL/dark at 390x844 and EN/light at 768x1024 were
  exercised through real preference controls. No localStorage flag injection
  or request interception was used.
- Keyboard sampling reached real controls. The shared collapsed sidebar
  contains unnamed icon buttons and several sampled buttons had no visible
  outline. This is recorded as shared-shell accessibility debt, not patched in
  a Results-only task.

## Automated tests

```text
npx vitest run src/components/Results/__tests__ \
  tests/resultsVnext/resultsVNextFeatureFlags.navigationPersist.test.ts \
  tests/resultsVnext/kpi/kpiToolMappers.test.ts \
  tests/resultsVnext/roi/ui/roiCaseFullToolMappers.test.ts --reporter=dot
```

Exit 0: 19/19 files, 133/133 tests, 0 failed. The run emitted existing React
`act(...)` warnings and one existing NaN-child warning; exit 0 is not promoted
to axe or human acceptance.

## Artifacts

- `owner-kpi-pl-dark-1440x900.png`
- `owner-roi-pl-dark-1440x900.png`
- `owner-okr-pl-dark-1440x900.png`
- `owner-okr-set-pl-dark-390x844.png`
- `owner-roi-en-light-768x1024.png`

## Fail-closed decisions and remaining gates

- `RES-MVP-VISIBILITY-001` remains `BLOCKED_OWNER`. No Manager/Reader access
  or roll-up behavior was inferred. Default remains OWNER/ADMIN only.
- Axe critical/serious = 0 was not established on the mounted app because the
  selected browser surface did not expose an axe runner. Component a11y tests
  passed but are not equivalent.
- The complete required permutation of every state at every viewport in both
  languages and themes was not captured in this bounded pass.
- Manual VoiceOver, visual/brand approval and named target-role review remain
  `BLOCKED_HUMAN`.

