# F2-E E1 — independent skeptical review

**Verdict: HOLD.** The frozen candidate proves a large part of the export contract, including the exact 1,930-relation denominator, the archive format, five API-created business families, tenant isolation, the 20,001-row case, permissions at the helper boundary, audit events on the superadmin job route, and visible progress. It does not satisfy E1.12, does not close all six C6 findings required by E1.9, and still classifies material business relations as `EXCLUDE_SECURITY` only because their semantic policy was not established.

## Frozen identity

- Branch: `codex/enterprise-trust-pack-20260913`
- HEAD: `e0279b4c1e3ccc71bcadd50e3dc739677ae70f99`
- Base: `0f0107b93c051b3ced9d3aafce740b36ac457f61`
- Freeze manifest: `FREEZE_MANIFEST.json`
- Freeze SHA-256: `37e40ad8630307811580ab731a1a8050c15547af5d797191f6c1d8f90eb76e6f`
- Review request SHA-256: `106dbdb65e86f0700c2fe652cf3d7ccad251bb5d8f207abee5c4715f2cd57259`
- Integrity result: `49/49` listed files matched byte size and SHA-256; `0` missing and `0` drifted before review.
- This review adds only this report. It does not modify product code, tests, migrations, the freeze manifest, or the channel files.

## Independently confirmed passes

1. **E1.1–E1.3 classification denominator.** The frozen inventory contains `public=1809`, `v8=121`, total `1930`, with `EXPORT=1379`, `EXCLUDE_SECURITY=550`, `DERIVED=1`, and literal `UNRESOLVED=0`. Every row has a non-empty family and rationale. The frozen verifier rerun returned `ORGANIZATION_EXPORT_CLASSIFICATION_GREEN 1930/1930`.
2. **v8 collision handling.** The disposition document names all `119` non-exported v8 relations (`115` historical parallel copies, `2` inactive schema-only relations, `2` credential-security relations). The exact runtime contract keeps `public.v8_feature_flags` and `v8.v8_feature_flags` separate.
3. **E1.4 archive shape.** The streaming writer creates canonical JSON and CSV for each exported relation and a manifest containing contract version, `asOf`, row counts, per-file SHA-256, excluded tables, derived tables, unresolved/skipped reads and `notIncluded`. The methodology-IP exclusion required by E1.14 is explicit.
4. **E1.5 five families.** The RealPG test creates initiative, task, Interview finding, decision and Materials artifact through mounted API routes, then finds the same markers in both JSON and CSV. The fixture uses direct SQL only for prerequisite organization/user/project/session/insight records, not for the five records under test.
5. **E1.6 guard.** The verifier rejects missing/new identities and its frozen mutation suite covers classification, required column exclusions, lifecycle fields and schema collision. The independent CLI rerun was green for the frozen input.
6. **E1.7 tenant isolation and >20k.** A fresh local PostgreSQL rerun passed `4/4`: exact full-schema parity, empty-tenant isolation, non-empty public/v8 collision isolation, and an archive with `20,002` tenant-A public rows plus one qualified v8 row while tenant-B sentinels were absent. The final progress event was `1379/1379`; the manifest held `2758` JSON/CSV receipts.
7. **E1.8 and DEC-493.** Existing Interview, task, decision and canonical privacy projectors are reused. The scoped privacy/unit suite retains business content and removes person identity for the covered cases.
8. **E1.10.** `DELETE /api/superadmin/organizations/:id` remains the deterministic `410 SET_DELETE_APPROVED_OUT`; the focused mounted-route test passed `2/2` and proves no destructive dependency runs behind the refusal.
9. **E1.13 partial pass.** The owner guard unit rerun passed `3/3`: active admin denied, owner without `ORGANIZATION_EXPORT_FULL` denied, active owner with the permission accepted. Frozen superadmin Gateway/JWT/RealPG evidence reads back `organization_export_requested`, `organization_export_completed` and `organization_export_downloaded` from `audit_events`.
10. **Flag and UI logic.** `VITE_ENTERPRISE_EXPORT_FULL` is enabled only by the exact string `true`, so its default is OFF. With the flag ON, a fresh UI rerun passed `2/2` for start/download and reconnecting from session storage. The frozen browser harness has eight 1440x900 light/dark screenshots for progress/failed/denied/conflict and reports zero console/page errors. The production frontend build receipt is green.
11. **Fresh scoped tests.** Backend/privacy/deletion/job/snapshot rerun: `69/69 PASS`; UI with the enterprise flag ON: `2/2 PASS`; owner permission: `3/3 PASS`; RealPG full-schema/streaming: `4/4 PASS`; `git diff --check`: PASS. No migration is present in the package.

## P1 findings

### P1-1 — E1.12 is not globally bounded-memory

`exportOrganizationData` pages only relations that do not require content-privacy projection. At `organizationExportService.ts:470-506`, every Interview, task, Decision and canonical/privacy-dependent relation is fetched by an unbounded `client.query(selectSql)` and retained in `interviewRows`, `canonicalRows`, `decisionRows`, or `result.tables`. Cross-family projection then keeps those arrays alive through `organizationExportService.ts:535-644`. Only after all projection work finishes are those tables handed to the archive writer at `:656-682`.

The 20,001-row RealPG test populates `public.v8_feature_flags`, which follows the easy paged path. It does not populate a large privacy-dependent family and does not measure process RSS. Therefore it cannot prove the explicit E1.12 memory limit for the difficult path. In addition, the still-mounted synchronous JSON/CSV/ZIP routes call the fully materializing export and archive functions (`ownership.routes.ts:70-113`; `superadmin.routes.ts:827-875`). A caller can still invoke the unbounded implementation even when the new UI chooses the job route.

**Required fix:** implement bounded projection for the dependent families, for example with a two-pass/spill design or page-wise queries joined against bounded provenance/parent state. Stream or retire the synchronous full-materialization variants. Add a RealPG case with a large Interview/task/Decision/canonical family and assert both complete JSON/CSV output and a measured memory ceiling; mutation must restore the unbounded query and fail the ceiling.

### P1-2 — “Resume” does not survive interruption of the export process

The job registry is only `const jobs = new Map` (`organizationExportJobService.ts:44`). Job status, token hash, progress, output path and manifest have no durable store. After a server restart or another replica handles the request, `authorizedJob` returns `EXPORT_JOB_NOT_FOUND` (`:60-72`). The archive has no per-table cursor/checkpoint, so work restarts from table zero. Session storage in the browser merely reconnects to the same live Node process; it does not resume interrupted work.

**Required fix:** persist job identity, hashed token, snapshot/checkpoint state, progress and artifact identity in an approved durable store, and make the worker continue from a verified checkpoint. Prove it by starting a populated export, terminating the server/worker mid-table, starting a new process, resuming with the same opaque token, and verifying one complete archive without duplicated/missing rows. If the selected durable store requires a migration, report `MIGRATION_REQUIRED` before writing it.

### P1-3 — E1.9 explicitly requires all six C6 findings, while C6-R2 remains open

Wpis 9 E1.9 requires the six C6 findings to be addressed one by one, each with its fix, defending test and mutation evidence. `C6_FINDINGS_DISPOSITION.md` says that C6-R2, the AI-budget UI/gate mismatch, is outside E1 and concludes that the full C6 HOLD cannot be removed. That is honest, but it contradicts the acceptance condition for this E1 delivery. There is no C6-R2 behavior test or mutation in the freeze.

**Required fix:** either close C6-R2 with one authoritative budget contract and the required UI-save → SQL → reload → real gate proof plus mutation, or obtain a new CTO entry that changes E1.9. A package-level note cannot waive the binding criterion.

### P1-4 — `UNRESOLVED=0` is partly achieved by treating unreviewed business data as security exclusion

The inventory labels `148` public relations as `EXCLUDE_SECURITY / ACTIVE_SEMANTIC_POLICY_MISSING`, although their reason says they have a structural tenant path and only lack an active semantic writer or reviewed privacy contract. Examples include `assessment_responses`, `budget_line_items`, `finance_periods`, `initiative_budgets`, `decision_votes`, `audit_findings` and `account_deletion_request_receipts`. These are not proved to be credentials, authentication/session state, derived data, empty historical copies, or owner-excluded IP.

This conflicts with the package's own classification rules, which reserve `EXCLUDE_SECURITY` for credential/security material and relations without a provable tenant boundary. It also makes a nominally full export omit possible organization-owned business history. The verifier accepts the label syntactically, so green `1930/1930` does not resolve the semantic gap.

**Required fix:** review all `148` relations against their real writer/read paths and live row distribution. Export tenant-owned business history with an explicit safe projection, classify genuinely reproducible data as `DERIVED` with a real source, and retain `EXCLUDE_SECURITY` only with a security/no-boundary reason. The guard must reject `ACTIVE_SEMANTIC_POLICY_MISSING` as a final `EXCLUDE_SECURITY` basis. Repeat numeric tenant isolation for newly exported families.

## P2 findings and evidence gaps

### P2-1 — Built-browser proof is a minimal dev-render harness, not the full application path

The browser entry imports `dev-render/screens/p13-eksport-organizacje.tsx`, not the production router/authenticated application. It drives simulated states and does not call ApiGateway, JWT or PostgreSQL. A separate production build receipt proves compilation, but the two artifacts together do not prove the production-built UI route against the real export job.

**Required fix:** serve the production-built frontend, authenticate through the application, run the export against the disposable Gateway/JWT/PostgreSQL environment, and capture progress, reload/reconnect, failure and successful download with console/network assertions.

### P2-2 — PL/DE exist as JSON keys but were not behaviorally rendered

The eight browser runs hard-code `lang=en`. The PL and DE translation objects contain the seven enterprise-export keys and parse correctly, but no frozen render proves that progress, resume, success and error messages use them without fallback or clipping.

**Required fix:** add production-built browser runs for EN, PL and DE covering progress, reconnect, completed/download and error, with fallback detection and 1440/375 layout assertions.

### P2-3 — The owner path lacks end-to-end permission and audit proof

The full Gateway/JWT/PostgreSQL audit test exercises the superadmin job route. The owner path is supported only by a mocked helper test, while the five-family owner JWT test calls the archive service directly after creating records. It does not start/download through `/api/organizations/:orgId/export-jobs` or read owner events from `audit_events`.

**Required fix:** add one mounted Gateway/JWT/RealPG owner test proving active OWNER + `ORGANIZATION_EXPORT_FULL`, negative admin/revoked/no-permission cases with zero job/audit mutation, then requested/completed/downloaded/failed outcomes and `asOf`/scope/result readback.

### P2-4 — Failed UI retains a contradictory “preparing” status

The frozen dark failed screenshot shows both `The organization export failed (LEGAL_HOLD)` and `Preparing the full organization export…`. `handleExportOrg` leaves `exportNotice` set after setting `actionError`. The required error is visible, but the simultaneous status is misleading.

**Required fix:** make job states mutually exclusive: clear the preparing/progress notice on terminal failure, and show a localized retry action whose next request starts or resumes according to the persisted state.

### P2-5 — Completed jobs and ZIPs have no lifecycle cleanup

Production jobs remain in the process `Map` and completed archives remain in the OS temp directory indefinitely. Cleanup exists only in `removeOrganizationExportJobForTest`. Long-running enterprise use will accumulate memory and disk artifacts.

**Required fix:** define expiry/retention, delete expired artifacts and registry records, reject expired tokens deterministically, and test cleanup without deleting an active download.

## Acceptance boundary

The candidate is suitable as evidence that the classification and core archive mechanics have advanced substantially. It is not acceptable as completed E1 or as removal of the C6 HOLD. Do not start E2 from this verdict. Produce a new exact freeze after P1 fixes, then repeat independent review with the same `1930` denominator plus any newly discovered live relations.
