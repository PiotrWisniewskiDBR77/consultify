# C6 receipt-aware read-side independent verdict — 2026-09-13

## Verdict

**ACCEPT for the bounded read-side receipt contract, with the stated integration boundaries.** I found no P0/P1 correctness or privacy defect in the frozen receipt source, Decision privacy resolver, or export-service wiring.

This is an independent source and behavior review. I did not author these three production files. I changed only formatting in the new test file after explicit root authorization, then reran all 46 tests. The writer/helper production sources stayed frozen throughout review.

## What the source proves

### Schema and private provenance read

`organizationExportFindingReceiptSource.ts` accepts the audit relation only when the discovered `public.interview_insight_audit_log` catalog has exactly the ten expected columns and exact PostgreSQL types, primary key `id`, and zero outgoing foreign keys. Missing or drifted catalog returns an unverified empty snapshot without querying the table.

The internal query uses the same `PoolClient` supplied to the export engine and is scoped simultaneously by:

- exact `organization_id = $1`;
- the tenant-selected Finding IDs in `$2::text[]`;
- exact internal entity type `finding_generation_receipt`;
- only actions `finding_generation_bound_v1` and `finding_generation_invalidated_v1`.

It projects the audit table's naive `created_at` as UTC. It validates returned organization, Finding, entity type, and action again before marking the collection verified. Receipt audit rows are not added to the export table result.

### Fail-closed resolver

`canExportInterviewDecisionContent` keeps the copied Decision body excluded unless all previous handoff/source/session/prompt/KB checks pass and the receipt collection is explicitly verified. It requires both receipt and invalidation arrays. Any invalidation row for the Finding denies eligibility without a timestamp cutoff, so edit→restore cannot regain eligibility.

The resolver passes the current Insight, full Finding snapshot, all stored pointers for that Finding, exactly filtered receipt rows, and the handoff cutoff into the strict shared helper. The helper requires one deterministic receipt, exact tenant/Insight/Finding/entity identity, current completed run identity, exact persisted generation-context bytes hash, exact immutable Finding+pointers snapshot hash, and valid timestamp ordering. Malformed rows return DENY; the resolver also catches helper exceptions and returns DENY.

A stale, failed, generating, foreign, duplicated, missing, or post-cutoff provenance path therefore does not authorize copied content.

### Export wiring and raw-content exposure

The export engine stores raw Decision-source rows only in private in-memory maps. Every Decision and source row is structurally projected by `projectDecisionSourceIdentity`; Decision `title` and `description` are added back only after the receipt-aware resolver returns true.

The audit table remains absent from `ORGANIZATION_EXPORT_TABLES`. Discovery reports it as `ownership_contract_unresolved`, so its public ownership classification remains UNKNOWN. The internal receipt read does not add the audit table, receipt detail, generation hashes, run ID, actor ID, or any receipt metadata to JSON or CSV. Unit behavior explicitly verifies the audit table is absent and `findingSnapshotSha256` / `generationContextSha256` never appear in either format.

Known timestamp-without-time-zone fields used by the Decision resolver for Finding, pointer, and handoff snapshots are projected as UTC under their exact catalog types. The Insight, question, and session timestamps are actual timestamptz columns and remain raw timestamptz values.

Production export routes call `exportOrganizationData` through `withOrganizationExportSnapshot`, which passes one pinned client inside `REPEATABLE READ READ ONLY`; the receipt read therefore shares the same snapshot as the source rows.

## Independent behavior evidence

### Focused unit/direct + mock-engine suite

The unchanged behavior denominator is 46/46 PASS after the authorized formatting-only test cleanup. Cases include:

- missing/unverified/foreign receipt DENY;
- permanent invalidation DENY after edit→restore;
- failed/generating/stale generation DENY and current completed receipt ALLOW;
- tenant and anonymous-session actor isolation;
- missing/ambiguous/wrong-target-kind handoff DENY;
- changed/tombstoned/unknown evidence DENY;
- prompt/topic/KB/enrichment uncertainty DENY;
- JSON and CSV body inclusion only for the authorized case;
- no receipt raw metadata exposure and audit ownership remains unresolved.

Final artifacts:

- `C6_SOL_READSIDE_REVIEW_UNIT_FINAL_GREEN_20260913.json` — 46/46, sha256 `cf0b859a4465b4d550b063ee688e2fe22940c69a1bc88ce19c7b5c3ce79acdee`
- `C6_SOL_READSIDE_REVIEW_UNIT_FINAL_GREEN_20260913.log` — sha256 `e742971ffbd468093111c5bced5ff81492df4f06a58368cad9c7fd109eb4801f`

The pre-format independent run is retained separately and was also 46/46:

- JSON sha256 `c75d91899a42c0a91b8d0d3217226f1eb9269e545fd5254d852e15f324c202a6`
- log sha256 `b116e0be25b2501c8b1ccf72eba8f0d5af8a3128a078c844c2ac7b02ee8c6440`

### Actual PostgreSQL fixture-aware export runner

I independently reran the root runner against only the authorized container `4787ced942d4b28650a212dc1b13da82ecc3640d924b155be2a38713b18ef64c`, host port 6457, database `cx6_export_contract`. It was 2/2 PASS and its source-hash guard remained stable.

The second case uses actual export catalog and row SQL. It proves in both process `TZ=UTC` and `TZ=America/Chicago`:

- timestamp-compatible Finding with no receipt: DENY;
- explicit persisted receipt fixture built by the production helper: ALLOW;
- deterministic persisted invalidation marker: DENY permanently.

Cleanup readback includes zero receipt audits, organization, Insight, Finding, Decision, handoff, pointer, question, and session fixtures.

Independent artifacts:

- `C6_SOL_READSIDE_REVIEW_REALPG_GREEN_20260913.json` — 2/2, sha256 `78d2884402976bbc305c8417b2b9b5458e8523fe9419c4e318b3ab9f027f42d7`
- `C6_SOL_READSIDE_REVIEW_REALPG_GREEN_20260913.log` — sha256 `e941ec4d8844526f0033f5c14dcbee3854e5d7f1a46ba467fe718f9e2a35c2a8`

The original root artifacts inspected match:

- `C6_ROOT_RECEIPT_EXPORT_REALPG_V2.json` sha256 `c2c2942ff8cd6be0fe151926b4526df179f75291c09662dd6afbcbe044ed265d`
- `C6_ROOT_RECEIPT_EXPORT_REALPG_V2.log` sha256 `3db0d548f6bd1038d445add3256c660542b975774d5dee12771b0e538856901e`

This PG runner explicitly seeds its receipt fixture; it verifies reader/resolver/export integration, not the separate production writer path. The writer path is covered by the independent 8/8 writer PG checkpoint.

## Immutable reviewed sources

- receipt source `C6_SOL_READSIDE_SOURCE_REVIEW_20260913.ts` sha256 `62ba2b7b117fa3c40c4f4cf26ddc26996427b79a355977d98131dd213a69ed9f`
- Decision privacy resolver `C6_SOL_READSIDE_PRIVACY_REVIEW_20260913.ts` sha256 `a0d0b62e2a4b2b63bfbb81ccbc28385ee53e37ad17566de90d1cdb682cfc4129`
- export service `C6_SOL_READSIDE_EXPORT_SERVICE_REVIEW_20260913.ts` sha256 `0bc1bb9e16b6bf563d2abf5addd47171b97188a413b57a6bb220a7ea7fafa386`
- final test `C6_SOL_READSIDE_TEST_REVIEW_20260913.ts` sha256 `fb10f8157cbacbcc04336c5750b41811fb9b46f7b7f9c90c1131673688d09ebe`
- inspected PG runner `C6_SOL_READSIDE_REALPG_RUNNER_REVIEW_20260913.ts` sha256 `e723be01c1b0c7fc744b86ae0555efd3da2d39da4aa489efd8f5c3153e5ea510`
- inspected PG config `C6_SOL_READSIDE_REALPG_CONFIG_REVIEW_20260913.ts` sha256 `aa42f7306e911acdff01e3c24e19367a4dbab64e35384f1c4cf78e054ea78e73`

Frozen writer/helper hashes remained unchanged during the review:

- helper `cbc8079dacfb931ae177fee575279cd76e41b3df31dff31540dc4d89722dc2a6`
- writer `a875dba3a1b3396eab48fee7b7f2f67358c0e7998fe4c1494fb77043950b4419`

## Qualifications

The actual PG export runner contains one tenant's fixtures; foreign tenant and malformed-row behavior is covered by the focused source/client tests and the explicit SQL predicates, not a second tenant in that PG runner. It does not prove the HTTP/Gateway authentication layer or deployment.

The append-only nature of the audit receipt is enforced by the reviewed application writers; repository search found INSERT/read uses and no production UPDATE/DELETE mutator for `interview_insight_audit_log`. Database-role ACL immutability is not independently proven here. The table remains UNKNOWN for public export ownership and unresolved in the manifest.

Targeted ESLint on the three production files still exits nonzero because `organizationExportService.ts` has import-order and `no-useless-escape` findings that reproduce on HEAD, plus existing warnings. They are baseline hygiene findings, not introduced by receipt wiring. The newly formatted test now has zero ESLint errors (two `any` warnings) and passes Prettier. No production formatting cleanup was performed.
