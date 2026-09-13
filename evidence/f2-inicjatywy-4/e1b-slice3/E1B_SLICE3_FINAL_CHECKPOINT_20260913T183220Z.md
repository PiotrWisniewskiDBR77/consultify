# F2-1 E1 Slice 3 — final frozen checkpoint

Verdict requested from independent review: **scoped candidate; full E1 remains HOLD**.

## Frozen identity

- Branch: `codex/inicjatywy-cztery-przyciski-20260913`
- Base/HEAD before this uncommitted slice: `5386af6ffc1bf5fc0dbef8cfa8a431068faa3185`
- Scope: canonical Initiative analysis Table 2 and human Decision wiring only. No migration, E2, deploy, push, or default-flag change.
- Feature behavior remains behind the existing default-OFF `VITE_INITIATIVES_FOUR_BUTTONS` UI contract and existing default-OFF server portfolio-analysis contract.

## Delivered behavior

- `Initiative analysis` uses `StandardTable` and `StandardPreview`, with source/provenance and deterministic Observation → Recommendation → Decision order.
- The UI discovers only named PUBLISHED portfolio scenarios and visibility-filtered governed context metadata. It does not ask a user to enter raw scenario/context UUIDs.
- Generation calls the Slice 2 POST orchestration and then reads the exact persisted analysis through GET/replay.
- Preview exposes rationale, evidence, confidence, alternatives, missing data, and model provenance.
- Only Decision rows are actionable. A single row or the explicitly selected subset is sent through canonical request/decide/readback calls; an unselected row is not written.
- DEC-479 remains separate from lifecycle: `IN`, `PARKING`, or `ARCHIVE` is stored with human reason, return condition, actor/time from the server command, and frozen analysis input. No new Initiative status is introduced. `IN` uses the existing approved decision path; parking/archive use the existing rejected decision outcome while retaining the structured disposition.
- Due date is explicit user input. Stable client request IDs are retained for retry.
- Plan/Capacity navigation appears only after a successful `IN` readback.
- A delayed options response from an earlier organization/actor scope cannot replace current scope state.
- Existing EN/PL locale dictionaries contain all new labels; default-OFF Hub behavior remains covered by the existing shell regression.
- The UI does not guess an approver. It can use the current actor only when actual server capabilities resolve `canReview && canSelfApprove`; otherwise it renders an honest approval-authority configuration dependency and performs zero decision writes.

## Behavior evidence

### Focused component and route behavior

Exact command:

```text
npx vitest run server/src/routes/pmo/__tests__/portfolioConsultingAnalysisRuntime.routes.test.ts src/components/Initiatives/__tests__/InitiativeConsultingAnalysisView.behavior.test.tsx src/components/Initiatives/__tests__/InitiativesHub.fourButtonsE1.test.tsx --reporter=json --outputFile=evidence/f2-inicjatywy-4/e1b-slice3/e1b-slice3-focused-green-v5.json
```

Result: 6/6 reported suites, 19/19 tests passed, exit 0.

Raw: `e1b-slice3-focused-green-v5.json` (`a0ae30404d1d3cc09f2e76da50d134a41ca4df8cc1808119de8af1dbbdcfea07`).

Binding Hub RED remains external and historical: `/Users/piotrwisniewski/Developer/consultify-handoff-docs/integrator-20260912/F2_1_E1_SLICE3_HUB_RED_20260913.json` (0 passed, 1 failed, 6 skipped). It proves the route was absent before the UI slice; it is not six distinct defects.

### Signed JWT / actual ApiGateway / PostgreSQL

- Disposable PostgreSQL 18 + pgvector container: `cx-f21-s3-pg`, database `f21_s3_acceptance`, host port 6455.
- Exact schema-only input: `/Users/piotrwisniewski/Developer/cto-codex/staging-schema-20260913.sql`, SHA256 `bf580feb5a9edd7960a2b38708fa31e5d8b16c7014ec82870f700882aa4aba78`.
- Restored schema counts: public 1809 tables, v8 121, backup schemas 9, total 1939.
- Every table/column read by the Slice 3 decision path was verified in `slice3-required-schema-columns.txt` before behavior execution.
- Exact test: `server/src/routes/pmo/__tests__/portfolioDecisionDispositionRuntime.gateway.pg.test.ts` through actual `ApiGateway.initializeRoutes`, signed JWTs, and real PostgreSQL.
- Result: 2/2 reported suites, 5/5 tests passed, exit 0.
- Proof: self-approval denial with zero receipt; two-actor request → single `IN`; selected `PARKING` + `ARCHIVE` while an unselected Initiative stays version 1 with no decision relation; foreign and missing return the same 404; cleanup readback is zero.
- Raw: `e1b-slice3-realpg-v2.json` (`586faea87f0accee03cb465a4cbe948bd8af9af081a20b175262237dc12654ea`).
- The raw run preceded a Prettier-only rewrite of the new PG test file. Product source and test semantics did not change after the run; this is qualified rather than represented as an exact test-blob rerun.
- Independent external cleanup is recorded in `e1b-slice3-cleanup-external-readback.json`. The owned container and volume were removed and are absent per `pg-disposal-readback.txt`.

### Static and repository gates

- Server: `npm run typecheck --prefix server` — exit 0.
- Frontend: `npm run type-check` — exit 2 with inherited 191 diagnostics in 56 files. The only changed-path diagnostic is Hub line 686 TS2345, whose exact expression is already present in HEAD before Slice 3. See `frontend-typecheck-classification-v1.json`.
- Scoped ESLint on the six focused new/modified API/UI/test files — exit 0, 0 errors, 11 warnings. Warnings are recorded in `eslint-scoped-v4.log`.
- Full-file inherited ESLint denominators are unchanged:
  - runtime router: base 294 problems (246 errors/48 warnings), candidate identical;
  - Hub: base 118 warnings/0 errors, candidate identical.
- `npm run check:list-canon` — exit 0, 158 scanned files, 322 current versus baseline 357.
- `npm run check:artefakt` — exit 0, crimson 8/8, R1 warnings 2, R2+R3 0/0, danger 117/117.
- `git diff --check` — exit 0.

## Strict migration gate

The strict full migration command was run against the exact restored schema. It is **BLOCKED** by inherited migration `919_z139_full_scope_double_escape_reconciliation.sql` with `INSERT has more expressions than target columns`. Raw: `migrate-strict-first-v2.log` (`c296c16eb0201ff0d10b97a56480b658a610759708fce6ac86787c568046e556`).

No `--safe`, ledger edit, SQL edit, manual skip, or other workaround was used. Slice 3 adds no schema and the behavioral proof is explicitly limited to the exact restored staging schema before the full migration chain. This is not migration-readiness evidence.

## Open gates and qualifications

- **EVIDENCE_MISSING:** real configured model quality on two organization contexts remains unproved. Unit/model stubs are not counted as real-model evidence.
- **PARTIAL:** general-manager selection/reachability remains dependent on a canonical PMO authority-eligibility/discovery contract. The UI fails closed rather than selecting a random member or current actor.
- **HOLD full E1:** Table 2 and canonical decision wiring do not close all remaining I1.6–I1.18 acceptance, final browser screenshots, real-model quality, strict migration readiness, or the later E2–E5 scope.
- The actual PG fixture starts from a seeded standard PRODUCT governance baseline on the restored schema; it proves the bounded decision path and cleanup, not a complete new-organization lifecycle.

