# Consultify WIP preservation and candidate register — 2026-08-22

Status: `PRESERVED / SOURCE GATES PASS / RUNTIME AND OWNER GATES PENDING / NOT YET A CANDIDATE SHA`

## Freeze identity

- checkout: `/Users/piotrwisniewski/Developer/Consultify`
- branch: `codex/wave3-16-module-acceptance-20260821`
- base HEAD: `09950def997295b8472737af817d5a36b6174e6c`
- pre-incident working-tree entries: 27
- incident documents added after freeze: 3 including this register
- preserved bundle and WIP archive: see
  `docs/operations/CONSULTIFY_INCIDENT_FREEZE_AUDIT_2026-08-22.md`

No reset, stash, checkout, merge or commit was used to obtain this inventory.

## Tracked application WIP

| Scope | Files | Change | Classification | Current evidence |
|---|---:|---|---|---|
| Dynamic SWOT Input & Exploration | 1 | 584 additions / 402 deletions; one active stream, tabs/sidebar navigation, manual entry, AI fill-all, persisted guidance state | `VALUABLE_WAVE3_WIP / HIGH_REVIEW_SURFACE` | included by frontend typecheck; direct browser and persistence proof pending |
| Tool session shell and right panel | 1 | lifecycle actions moved into canonical artifact panel; Teresa proposal panel; properties/relations/evidence/results/comments sections | `VALUABLE_WAVE3_WIP / INTEGRATION_REVIEW_REQUIRED` | focused tests 8/8; typecheck PASS; accessibility/browser pending |
| Known Tool detail header | 1 | reviewed action sizing and labels | `VALUABLE_WAVE3_WIP` | typecheck PASS; visual evidence exists but exact-current replay pending |
| My Work Decisions | 1 | removes thirteen duplicate queue mounts and retains one canonical `DecisionsPanelContent` | `VALUABLE_WAVE3_WIP / PRODUCT-TRUTH CLEANUP` | typecheck PASS; route/browser regression pending |
| shared N-mode shell/header/card manager/types | 4 | action class extension, section-button sizing, reset center scroll on artifact identity, formatting | `SHARED_WAVE3_INFRA / CROSS-MODULE REGRESSION RISK` | typecheck PASS; multi-module browser replay pending |
| Tool tests | 2 | mocks render the new right panel | `TEST_ADAPTATION` | 2 files / 8 tests PASS |

### Qualification repair made after freeze

The focused N-mode test pass exposed a real regression introduced by the WIP:
`NModeShell` called `scrollTo(...)` whenever a scroll host existed, without
checking whether that host implemented the method. Four owner-action hierarchy
tests failed in the test DOM with `TypeError: ...scrollTo is not a function`.
The call is now capability-guarded with optional method invocation. The same
test set then passed 42/42. This is an intentional candidate-repair change made
after the original preservation snapshot; the snapshot remains the immutable
pre-repair recovery point.

## Tracked documentation WIP

| Scope | Files | Classification |
|---|---:|---|
| Interview acceptance | 1 | `OWNER-FEEDBACK / UNRECONCILED` |
| Tools acceptance | 1 | `OWNER-FEEDBACK / TECHNICAL EVIDENCE` |
| Assessment acceptance | 1 | `OWNER-FEEDBACK / UNRECONCILED` |
| My Work/Agent acceptance | 1 | `OWNER-FEEDBACK / UNRECONCILED` |
| cross-module owner-feedback register | 1 | `CANONICAL INTAKE / MUST PRESERVE EXACT OBSERVATIONS` |

## Untracked Wave 3 evidence and registers

The untracked set contains owner-review registers, creator guidance, skeptical
reviews and screenshot evidence for Interview, Tools and My Work/Agent. These
are not junk and are not cleanup candidates. They are classified as
`PRESERVE_AND_RECONCILE` until every evidence index is checked against its file,
SHA, persona and acceptance status.

The incident audit and database reconciliation documents are new operational
evidence, not part of the pre-incident 27-entry set.

## Qualification executed

### Focused Tools tests

Command:

`npx vitest run tests/components/discovery-tools/ToolDocumentView.approveReadiness.test.tsx tests/components/discovery-tools/ToolDocumentView.golden-flow.test.tsx --no-file-parallelism --maxWorkers=1 --retry=0 --reporter=dot`

Result: `2 files PASS / 8 tests PASS`.

Limitation: repeated React `act(...)` warnings remain. They do not fail the
assertions but prevent calling the test output warning-clean.

### Frontend TypeScript

Command: `npm run type-check`

Result: `PASS` with exit code 0 and no emitted diagnostics.

### Dynamic SWOT, My Work and shared N-mode focused tests

Command scope:

- `SWOTBuildPhase.interaction.test.tsx`
- `TeresaSwotProposals.test.tsx`
- `MyWorkHub.twoLevelNav.test.tsx`
- `MyWorkHub.storageScope.test.ts`
- `myWorkMainContentLayout.test.ts`
- `NModeHeader.a11y.test.tsx`
- `NModeHeader.ownerActions.test.tsx`

Initial result: `6 files PASS / 1 file FAIL; 38 PASS / 4 FAIL`, exposing the
unguarded `scrollTo` regression described above.

Post-repair result: `7 files PASS / 42 tests PASS`.

The initial run still emitted React `act(...)` warnings because the
`SWOTBuildPhase` interaction suite mounted the unrelated Teresa panel, whose
best-effort proposal fetch settles after the synchronous matrix assertions.
The real Teresa component remains covered by its dedicated 9-test API/UI
lifecycle suite; only that sibling is stubbed in the matrix/store suite. The
repeat combined run is `2 files / 24 tests PASS` without React state-update
warnings, and the full seven-file run remains `42/42 PASS`. The only remaining
test-process notice is stale Browserslist metadata, carried as tooling/NFR debt.

### Scoped lint

ESLint was run on all ten changed source/test files. Two import/export ordering
errors in `MyWorkHub.tsx` were mechanically corrected with the repository's
configured autofix. The repeat scoped lint completed with exit code 0 and no
errors. Existing warning-level debt in the large `MyWorkHub.tsx` file remains
outside the quiet gate and is not represented as newly resolved.

### Frontend production build

The default-memory build transformed all 10,434 modules but exhausted the Node
heap during gzip-size computation near the 4 GB limit. Repeating the identical
build with `NODE_OPTIONS=--max-old-space-size=8192` completed successfully:
`10,434 modules transformed / built in 33.29s`.

Non-blocking build warnings remain for deprecated CSS `color-adjust`, stale
Browserslist metadata, mixed static/dynamic imports and chunks over 500 kB.
These are carried into the NFR gate rather than hidden.

### Wave 3 evidence reconciliation

All `INDEX.md` / `EVIDENCE_INDEX.md` files under Wave 3 were matched against
their durable artifacts. The deterministic readback checked 159 hash-bound
artifacts across 15 indexes and returned:

- missing artifacts: `0`;
- SHA-256 mismatches: `0`;
- ambiguous ID-to-file mappings: `0`;
- unindexed screenshots inside indexed evidence trees: `0`.

Sixteen pre-existing screenshots from the 2026-08-21 automated cross-module
sweep had a source report but no hash index. A new adjacent `INDEX.md` binds
those screenshots and the machine-readable `browser-sweep.json` without
changing the evidence files or upgrading their meaning. They remain
fixture-backed technical evidence, not owner acceptance or current-source
runtime proof.

### Fresh isolated current-source runtime

The canonical Wave 3 owner-runtime harness was executed in `create` mode against
a disposable local PostgreSQL 18 + pgvector instance. Candidate identity was
bound to base HEAD `09950def997295b8472737af817d5a36b6174e6c` plus dirty
fingerprint `46e6fb385a78f0d99c4a2e69a8d81c99457ed4c4eac11603384d8d5c5fda6359`.

Qualified manifest result:

- strict SQL migrations: `817` successful;
- migration-chain SHA-256:
  `6f7b24c127b00d69585efa3e578d90e0c1b33ac4152c51bbfe877a30485a4728`;
- backend `/api/health`: HTTP `200`;
- authoritative `/api/ready`: HTTP `200`;
- frontend root: HTTP `200`;
- server health SHA, readiness SHA and transformed client marker all equal the
  recorded base HEAD;
- both migration ledgers reported `ok`;
- test auth bypass, test gateway and test support were disabled;
- prohibited dotenv/provider keys and known secret values were absent from the
  owned process groups and served client;
- database/JWT credentials were absent from the Vite process group.

The fixture was intentionally empty. This proves fresh-schema and boot
compatibility for the exact dirty fingerprint, not authenticated business-flow
acceptance, persistence of a seeded owner journey or final commit identity.

The harness then terminated only its owned process groups, dropped only its
disposable database, proved the database absent and ports free, and preserved
ports `3940/3941`. The supporting Docker container and its temporary Keychain
credential were removed after verification. The no-secret manifest remains at
`/tmp/consultify-wave3-runtime-manifest-incident-20260822.json`.

## Candidate gate still missing

This WIP is not yet an exact-SHA candidate. Required before checkpoint:

1. reconcile owner-feedback statuses against the master register without
   upgrading any pending owner decision;
2. inspect browser behavior at desktop/tablet, PL/EN and light/dark;
3. run authenticated business-flow replay on a qualified retained or freshly
   provisioned owner fixture for the same fingerprint;
4. only then create one auditable checkpoint commit and record its SHA.

## Current verdict

`WORK PRESERVED / VALUE CONFIRMED / NOT SAFE TO COMMIT AS FINAL CANDIDATE YET`
