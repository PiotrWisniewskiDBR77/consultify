# Verification — DEC-497 P2 E1

Verdict: **PASS for the local E1 contract; external provider success is NOT_PROVEN**.

## Behavior proved

- The AI transport receives the exact scenario version, horizon, timezone, and real initiative snapshot.
- Absolute and conditional dependency observations remain distinct.
- Conditional observations require a concrete condition; absolute observations reject one.
- Invented initiative IDs, self-links, duplicate edges, cycles, unsupported critical paths, and unknown evidence fields fail closed.
- The real PostgreSQL reader is tenant-scoped and loads only initiatives and dependency edges inside the requested plan.
- The result persists in the existing versioned `plan_analysis_proposal` aggregate and is read back from PostgreSQL.
- With `VITE_INITIATIVES_PLAN_ANALYSIS` unset or false, the API returns `FEATURE_DISABLED`, does not call AI, and does not write a proposal.
- Existing requests retain `analysisKind=SOLVER`, preserving the default-OFF parity line.

## Commands and results

- Focused Vitest, exact three files, `--retry=0`: **3 files passed, 9 tests passed**. See `focused-tests.log`.
- Server TypeScript `--noEmit`: **PASS**. See `server-tsc.log`.
- Per-file esbuild for the new service: **PASS**. See `service-esbuild.log`.
- Per-file esbuild for the changed route: **PASS**. See `route-esbuild.log`.
- Fresh PostgreSQL 18 with pgvector on `127.0.0.1:6455`, database `consultify_s3`: **914 migrations present**. See `realpg-environment.log`.

## Persistence decision

No migration is required. E1 extends the JSON payload of the existing `ie_aggregate_state` row for aggregate type `plan_analysis_proposal`. The schema remains additive at the aggregate-contract level and retains existing SOLVER payload behavior.

## Boundary after E1

The review and editing UI, individual/bulk acceptance, comment-driven proposal mutation, and 1/3/6/12 timeline belong to E2/E3. They are intentionally absent from this E1 freeze and must not begin before CTO acceptance of this checkpoint.
