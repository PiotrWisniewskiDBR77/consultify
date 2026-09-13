# F2-1 E1 Slice 3 V2 — corrected frozen checkpoint

Verdict requested from independent review: **scoped candidate; full E1 remains HOLD**.

## V2 corrections

- The scenario/context change invalidates an in-flight analysis synchronously. The delayed A response cannot render rows, actions, toast, or navigation under B; the B request uses a new `analysisId` and a new `clientRequestId`.
- Preview Initiative labels come from the frozen snapshot `facts.name` / `facts.title`. A missing title renders the translated `Unnamed Initiative` fallback and does not expose a UUID.
- Governed kind, criterion, and confidence enum values are translated in EN and PL.
- Locale diffs are restricted to exactly one intentional `initiatives.analysis` hunk per locale; unrelated formatter churn was removed.
- Wpis 11 visual constraints are represented in the scoped implementation: typed widths keep the analysis title broad and compact fields narrow; the preview fills the available height, uses frozen Initiative relations rather than an empty Relations frame, and omits `UNKNOWN` from meta while retaining the explicit value in the table.
- The shell and server portfolio-analysis contracts remain behind their existing default-OFF flags per DEC-492. This slice does not build on `InitiativePreparationReadView`; replacement of Work report is the later E4 dependency.

## Behavioral evidence

- Focused route/UI suites: **24/24 tests, 6/6 suites, exit 0**.
- Raw: `e1b-slice3-v2-focused-green-v7.json`, SHA256 `ca78dd7a7f68d2a3c211d41e25623a9d81068dfdf55ab5c3773ec8d49f9361b5`.
- This includes deferred A → input switch B → resolved A ignored → B succeeds with both request identities changed, frozen title and non-UUID fallback assertions, non-empty real Initiative relations, and omission of `UNKNOWN` from preview meta.

## Exact staging-schema / Gateway / JWT / PostgreSQL 18

- Input: `/Users/piotrwisniewski/Developer/cto-codex/staging-schema-20260913.sql`, SHA256 `bf580feb5a9edd7960a2b38708fa31e5d8b16c7014ec82870f700882aa4aba78`.
- Fresh disposable `pgvector/pgvector:pg18` on owned port 6455; restored counts: public 1809, v8 121, backup schemas 9.
- Exact final PG-test blob through actual `ApiGateway.initializeRoutes` and signed JWTs: **5/5 tests, 2/2 suites, exit 0**.
- Raw: `e1b-slice3-v2-realpg-final.json`, SHA256 `66548392b3872cf47a486b478de0cc1fa38aa0794cd8c7c33cd859852231b5e4`.
- Proof covers self-approval rejection with zero receipt; two-actor IN with exact frozen analysis input; selected PARKING + ARCHIVE with unselected Initiative unchanged; tenant-oblivious 404; fixture cleanup zero.
- External cleanup readback is all zero in `e1b-slice3-v2-cleanup-external-readback.json`.
- Resource disposal: container 0, volume 0, listener on 6455 = 0 in `e1b-slice3-v2-resource-disposal.txt`.

## Static gates

- Server typecheck: exit 0.
- Focused code Prettier (excluding inherited nonconforming locale and monolithic route files): exit 0.
- Focused ESLint excluding the inherited monolithic route: exit 0; warnings only.
- Locale JSON valid; EN/PL `initiatives.analysis` key parity 36/36.
- `git diff --check`: exit 0.
- `check:list-canon`: exit 0.
- `check:artefakt`: exit 0.
- Full frontend typecheck: exit 2 with the inherited 191 diagnostics in 56 files. The sole changed-file diagnostic is Hub line 686 TS2345; the exact expression is present unchanged in HEAD at line 685 and the Slice 3 Hub diff only adds one import and the analysis surface mount. Classification is captured separately.
- Full-file formatter/lint debt in the two locale files and monolithic runtime router is inherited. Exact V2 locale scope is two hunks, and V1 base/candidate route and Hub lint denominators remain unchanged.

## Preserved gates

- **BLOCKED:** strict full migration chain still stops at inherited `919_z139_full_scope_double_escape_reconciliation.sql` with `INSERT has more expressions than target columns`. No safe mode, ledger edit, SQL edit, manual skip, or workaround was used.
- **EVIDENCE_MISSING:** real configured model quality on two organization contexts remains unproved.
- **PARTIAL:** general-manager authority discovery remains dependent on the canonical PMO authority contract. UI fails closed and makes zero writes when self-approval is forbidden.
- **HOLD full E1:** this scoped Table 2 and DEC-479 wiring does not close the remaining I1.6–I1.18, browser acceptance, real-model quality, strict migration readiness, suppression/re-proposal, or E2–E5.
