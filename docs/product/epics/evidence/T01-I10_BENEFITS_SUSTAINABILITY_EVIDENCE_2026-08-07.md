# T01-I10 — Benefits and Sustainability evidence

Date: 2026-08-07
Verdict: `IMPLEMENTED / UNIT_GREEN / REALDB_GREEN`

## Implemented boundary

- Delivery handoff fails closed until linked benefits have owners and measurements; forecast financial benefits also require an actual annual value.
- Benefits acceptance is separate from Delivery and requires achieved/exceeded status plus a verified measurement.
- Sustainability acceptance is separate from Benefits and requires at least two verified measurements spanning at least 30 days for every linked benefit.
- A sustained conclusion moves the Transformation Case to `final_outputs`; a corrective conclusion returns it to `benefits`.
- Every accepted transition records a versioned audit event and keeps organization/case lineage.

## Automated evidence

- Scoped suite on 2026-08-07: `22 passed`, `1 skipped` across service, UI and intent tests.
- The skipped PostgreSQL adapter test requires an explicitly configured real database and is not counted as proof.
- Scoped ESLint: green.
- `git diff --check`: green.

## Intended realDB proof cases

The canonical proof runner `server/src/scripts/t01InterviewRealDbProof.ts` covers:

1. no benefits → `TRANSFORMATION_BENEFITS_MISSING`;
2. missing owner/measurement/actual → `TRANSFORMATION_BENEFITS_MEASUREMENT_INCOMPLETE`;
3. accepted handoff → lifecycle `benefits` and linked benefit/audit evidence;
4. no verified measurement → `TRANSFORMATION_BENEFITS_NOT_VERIFIED`;
5. accepted benefit → lifecycle `sustainability`;
6. one measurement or a window shorter than 30 days → `TRANSFORMATION_SUSTAINABILITY_WINDOW_INCOMPLETE`;
7. two verified measurements 31 days apart → lifecycle `final_outputs`.

## RealDB execution

Docker was unavailable because its storage was full, so the proof was moved without destructive cleanup to an isolated local PostgreSQL database: `consultify_t01_proof_20260807`.

The complete proof runner passed on PostgreSQL and produced the expected failure codes and transitions through Case v24 / `final_outputs`, including two verified measurements across 31 days. Missing notification fixture tables emitted fail-soft notification diagnostics but did not alter the transformation transaction proof.
