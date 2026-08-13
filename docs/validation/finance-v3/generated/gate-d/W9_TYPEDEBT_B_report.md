# W9 — Type debt, part B (everything outside `server/src/services/finance/**` and `server/src/routes/**`)

Branch `codex/finance-v3-w9-typedebt-b`, based on `1271a0f721`. Nothing pushed, nothing merged.
The frozen `codex/finance-v3-closeout-fanin` @ `19b4b06934` was not touched.

## 1. How the debt was measured

`server/tsconfig.json` excludes `**/*.test.ts`, and vitest transpiles through esbuild, so no
tool in the repo type-checks a test file today. Measurement used a **temporary, uncommitted**
`server/tsconfig.typedebt-tmp.json` that extends the real config and drops only the test
exclusions, plus a root `tsconfig.typedebt-tmp.json` that adds `tests` to `include`. Both
files were deleted after the final verification.

The programme's headline figure — 353 errors — is exactly the server-side count.

| Scope | Before | After |
|---|---:|---:|
| `server/src/**/*.test.ts`, total | 353 | 48 |
| — my scope (excl. `services/finance/**`, `routes/**`) | **324** | **19** |
| — other agent's scope (`services/finance/**`, `routes/**`) | 29 | 29 (untouched) |
| `tests/resultsVnext/**` (protected ROI-E007 area) | 8 | **0** |
| `tests/**` at repo root, total | 2890 | 2882 |

**305 of 324 in-scope errors repaid (94%).** The 19 that remain are all blocked on production
changes outside the allowlist and are itemised in §4.

### Note on the root `tests/**` tree

`tests/**` is a far larger, separate debt than the mandate's 353 implies: 2882 errors across
~2795 test files, measured under a purpose-built root config (the frontend `tsconfig.json`
excludes `server/**`, so every root test that imports server code also produces cascading
resolution noise — a faithful figure needs its own config, not just `include: ["tests"]`).
Repaying it is a programme of its own. Within it, only the explicitly protected
`tests/resultsVnext/**` was taken to zero.

## 2. Real defects the type checker exposed

These are findings, not stylistic debt. Ordered by severity.

### P1 — Two suites import functions that do not exist (15 tests red today)

| File | Missing symbol | Effect |
|---|---|---|
| `server/src/services/__tests__/artifactRegistryService.retry.test.ts` | `isArtifactRunLifecycleMaterializable` | `TypeError: … is not a function` |
| `server/src/services/__tests__/artifactRegistryPresentationTemplatePosture.test.ts` | `resolvePresentationTemplateArtifactPosture` | same |
| `server/src/services/report/pptx/__tests__/pptxPipelineGenerateDownload.test.ts` | `ensureCurrentPptxExport`, `CurrentPptxExportError` | same |

Confirmed by running them: 11 failures in the two artifact-registry suites, 4 in the pptx one.
Neither symbol exists anywhere in `server/src` under any name. These are pre-existing reds on
the frozen base — not caused by this work — and fixing them means adding production functions,
so they are left in place and reported.

### P2 — `evaluateEscalationThreshold`'s "custom thresholds" parameter cannot accept custom thresholds

`server/src/types/financeIntegrationPromotion.ts:361-374` — `DEFAULT_ESCALATION_THRESHOLDS`
is declared `as const`, and the parameter takes its inferred type. The parameter therefore
accepts *only* `{ deltaMagnitude: 0.1; deltaDuration: 30 }`. The test literally named
`'respects custom thresholds'` cannot type-check by construction. The body only does numeric
comparisons; the signature should take a widened `EscalationThresholds` interface.

### P3 — The "frozen" P10 evidence-pointer contract was never exercised

`server/src/services/v8/__tests__/integration/t2-flows/crossModuleHandoffFlow.test.ts` built
evidence pointers as `{ type, ref, label }`. The frozen canon
(`interviewInsightCanon.ts:164`) is
`{ pointerId, type, sourceRef, capturedAt, sourceFingerprint, isTombstone }` — `ref` and
`label` are not fields of it. The builder passes the array straight through, so the assertion
`evidence_pointers[0].ref` read a property the contract does not define and the spec passed
while proving nothing. **Fixed** (canonical shape, same source refs, assertion now reads
`sourceRef`).

### P4 — Two P10 confidence-level vocabularies that do not nest

`P10_CONFIDENCE_LEVELS` contains `'insufficient'`; `P10_EXTENDED_CONFIDENCE_LEVELS` (which the
handoff builder's parameter uses) contains `'unknown'` instead. A loop over the canonical
levels cannot be passed to the builder. Production contract inconsistency — left as a
dependency (1 remaining error).

### P5 — `SchemaProposal` declares camelCase, the service returns snake_case rows

`ChatToSchemaService.ts:467` returns `row as unknown as SchemaProposal` — the raw
`tp_schema_proposals` row. The declared interface says `workspaceId`; the object carries
`workspace_id`, and production code at `ChatToSchemaService.ts:488` reads `workspace_id`.
The smoke test's assertion is runtime-correct and type-incorrect.

### P6 — Fixtures carrying values the contracts do not define

All fixed; each was silently ignored at runtime, so each assertion was weaker than it read.

- `documentType: 'analysis_report'` — not a `DocumentTypeKey` (3 files). Not present anywhere
  in production code. Replaced with `'generic_document'`, the neutral member that (like the
  unknown key) participates in none of the type-gated QA rule sets.
- `goal: 'audit'`, `density: 'medium'`, `languageStyle: 'consulting_neutral'`,
  `recommendedLanguageStyle: 'concise'` (a density value used as a language style),
  `sourceType: 'MANUAL'` — none are members of their unions.
- `DocumentSourceRef` label key is `sourceTitle`; a grounding fixture set `title`, so the ref
  carried no name.
- `buildTemplateOriginSummaryFields({ …, source: 'canonical' })` — `source` is *derived* from
  `originRuntime` inside the builder; passing it in was dead input, and the assertion that
  looked like it verified the input actually verified the derivation.
- `evaluatePromotionGate({ …, initiativeId, financeModelRef })` — neither is a member of
  `EvaluatePromotionGateParams`; both were stripped by the zod parse.
- `createBlockType(blockData)` — the fixture (`category`, `schema`, `defaultConfig`) was shaped
  for an older API and supplied neither of the required `userId` / `renderKind`.
- `Config.JWT_ISSUER` / `JWT_AUDIENCE` are read by `superAdmin.middleware.ts:39` but not
  declared on `Config`; they are `undefined` at runtime, so the superadmin suite's token
  signing spread is a no-op.
- `P08_HANDOFF_TARGET_MODULES` is annotated with the full 16-member `HandoffTargetModule`
  union while `P08_HANDOFF_TARGETS` only carries 10 contracts. (The related spec
  `all P0 handoff targets are defined with required fields` is red on the frozen base, before
  and after this work.)

## 3. `tests/resultsVnext/**` — files touched, individually

Four files, all pure type corrections, no behaviour change:

1. **`tests/resultsVnext/kpi/approvePlan.test.ts`** — `baseInput` now supplies the
   `actorUserId` that `BaseCaseCommandInput` requires, and is generic over its overrides so
   override keys survive in the returned type. `approvePlan` records `approverId` as the actor
   (`kpiDeviationCommands.ts:833`) and never reads `actorUserId`, so the added field is inert.
2. **`tests/resultsVnext/kpi/deviationStateMachine.test.ts`** — one-line change:
   `baseCommandInput` made generic over its overrides. The `Record<string, unknown>` parameter
   erased command-specific keys (e.g. `recoveryObservationMeasurementId`) from the result type.
3. **`tests/resultsVnext/kpi/legacyIsolation.realdb.test.ts`** — the poisoned-id probe set
   widened to `Set<string | null>` because `listMyKpis` rows carry a nullable `kpiId`.
4. **`tests/resultsVnext/teresa-kpi-e2e-no-silent-approval.test.ts`** — the same missing (and
   unread) `actorUserId` on the inline `approvePlan` literal.

### Mandatory regression — held exactly

Each run on a **freshly created and migrated** ephemeral Postgres 15
(`LC_ALL=C` for `initdb` and `pg_ctl`, lsof-checked port 56341, explicit `DATABASE_URL`,
`RUN_DB_TESTS=1`, `MOCK_DB=false`; `pg_ctl stop` + `rm -rf` afterwards):

| Suite | Before | After |
|---|---|---|
| `tests/resultsVnext/` | 55 files, **278/278** | 55 files, **278/278** |
| `tests/resultsVnext/roi/` | 37 files, **120/120** | 37 files, **120/120** |

Without an explicit `DATABASE_URL`, `tests/setup.ts` substitutes
`postgresql://iris:iris_test@localhost:5432/iris_test`, which **answers** on this machine —
44 of the 55 files then fail against someone else's database instead of skipping. The explicit
address is not optional here.

## 4. Remaining 19 in-scope errors — all blocked on production code

Nothing in the allowlist can close these.

| # | Blocker | Fix (outside allowlist) |
|---:|---|---|
| 12 | `server/src/types/pdf-parse.d.ts` is a hand-written ambient declaration of pdf-parse **v1** (`export = pdfParse`), while the installed package is **v2.4.5** with a `PDFParse` class and its own typings. The ambient block shadows the package, so `import { PDFParse } from 'pdf-parse'` cannot resolve. Production already works around it with `as any` (`pdfParserService.ts:46`). | Delete `src/types/pdf-parse.d.ts` (the package ships types) or rewrite it for v2. Affects 6 test files × 2 errors. |
| 2 | `isArtifactRunLifecycleMaterializable`, `resolvePresentationTemplateArtifactPosture` not exported from `artifactRegistryService.ts` (P1 above). | Implement/restore the two functions. |
| 2 | `ensureCurrentPptxExport`, `CurrentPptxExportError` not exported from `routes/presentations.routes.ts` (P1 above). Note: that route file belongs to the parallel agent's scope. | Implement/export the two symbols. |
| 2 | `DEFAULT_ESCALATION_THRESHOLDS` `as const` narrows the `thresholds` parameter (P2 above). | Type the parameter as a widened `EscalationThresholds`. |
| 1 | `P10_CONFIDENCE_LEVELS` vs `P10ExtendedConfidenceLevel` (P4 above). | Reconcile the two lists, or widen the builder parameter. |

## 5. Deliberate type assertions, with justification

No `as any` and no `@ts-ignore` were added anywhere. Six narrow, commented assertions were
used where the target type cannot be expressed by a mock or where production and runtime
disagree:

1. `executionManagementSnapshotService.test.ts` — `QueryDeps.get/all` are generic
   (`<T>(sql) => Promise<T | T[]>`), which a vitest mock cannot express. One assertion at the
   single `deps()` seam replaces five errors; the stub bodies still return exactly the rows the
   service reads.
2. `tablePlatform/__tests__/smoke.test.ts` — asserts the row shape actually returned (P5).
3. `documentContentBlockService.test.ts` — the fixture deliberately feeds an untrimmed
   `' executive_memo '` to prove `normalizeDocumentTypes` (which takes `unknown`) trims it; the
   declared input type is the narrow key union.
4. `workbook/__tests__/benefitsRealization.test.ts` — ExcelJS's `Worksheet` type omits the
   `conditionalFormattings` property the runtime object exposes.
5. `crossModuleHandoffFlow.test.ts` — the P08 target map widened to
   `Partial<Record<…>>`, which makes a missing contract *fail the assertion* rather than fail
   to compile (strictly stronger than before).
6. `boardReadyDocumentsTemplateMigration.test.ts` — `JSON.parse` output narrowed from `any` to
   two named brief interfaces (a narrowing, not a widening).

## 6. Regression evidence

Every batch was run before and after against the same file list; the totals are identical.

| Surface | Before | After |
|---|---|---|
| 11 Document-QA suites | 125/125 pass | 125/125 pass |
| 94 documentStudio + AI + v8 + initiative + deliverables files | 3 failed / 1039 passed / 4 skipped | 3 failed / 1039 passed / 4 skipped |
| 17 remaining changed files | 6 failed / 227 passed / 10 skipped | 6 failed / 227 passed / 10 skipped |
| `tests/resultsVnext/` (real PG) | 278/278 | 278/278 |
| `tests/resultsVnext/roi/` (real PG) | 120/120 | 120/120 |

The failures above are **pre-existing on the frozen base** and identical by test name before
and after. One regression was introduced and caught during the work — replacing
`sourceType: 'MANUAL'` in `reportBuilderService.contract.test.ts` broke the service's
template-source-type match until the mocked template row was moved to the same valid
discriminant.

Out-of-scope error count (`services/finance/**` + `routes/**`) is 29 before and 29 after:
no collision with the parallel agent.

## 7. Commits (not pushed)

| SHA | Subject |
|---|---|
| `5f88aa9344` | `test(documentStudio): repay type debt in Document QA fixtures` |
| `9cef8b2871` | `test(server): repay type debt — import extensions, mock signatures, controller doubles` |
| `3750c204da` | `test(server): repay type debt in documentStudio, AI and v8 fixtures` |
| `1aba43b082` | `test(server): close the remaining in-scope type debt` |
| `f2d17c52a8` | `test(resultsVnext): pure type corrections in the protected ROI-E007 suites` |

77 files changed, 555 insertions, 195 deletions. Test files and this report only — no
production code, no `tsconfig.json`, no migrations. Both temporary tsconfigs were deleted and
the ephemeral Postgres cluster was stopped and removed.
