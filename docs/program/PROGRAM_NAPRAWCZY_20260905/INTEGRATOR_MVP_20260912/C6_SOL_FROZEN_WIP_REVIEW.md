# C6 export privacy / CAS / timezone — bounded independent SOL review

Date: 2026-09-13  
Mode: frozen source and targeted-test review. No DB, ports, build, TypeScript compilation, source edit, commit, push, migration, endpoint call or deployment was performed by this reviewer.  
Verdict: **HOLD for integration**. The reviewed WIP has three concrete blockers. CAS ownership and timezone-safe export snapshot projection are accepted within their bounded source/test evidence.

## Reviewed identity

- Worktree: `/Users/piotrwisniewski/Developer/codex-wt/codex-c6-export-20260912`
- Branch: `codex/c6-export-contract-20260912`
- HEAD and merge-base: `55fcd46a7615677cee776926403aa6a3a37d2ead`
- Root v8 comparison commit: `88363bbcda`
- Binding/review packets read in full: `C6_RESOLVER_REPAIRS_CHECKPOINT.md`, `C6_DECISION_KB_SOL_REVIEW.md`, and the design-only `C6_FINDING_GENERATION_RECEIPT_DESIGN_20260913.md`.

Reviewed C6 source hashes before the bounded repairs:

- `server/src/services/InterviewInsightService.ts`: `4940f151a3a217c12459ce98f4602c497b540e243dedd032096523dac7f735fb`
- `server/src/services/organizationExportContract.ts`: `32d0e32fd3c0affbde22c95d4ea3f0dc8a5318f12da7db6ac797ade62fb5269d`
- `server/src/services/organizationExportService.ts`: `268ae040da75544107268b60d1d26487311e58ad44005fddbbde130932e7e7e1`
- `server/src/services/organizationExportDecisionContract.ts`: `c41a4d883db3a1a077f4cede5e3a0d99565282b6296a17e7e6845576aaa99623`
- `server/src/services/organizationExportDecisionPrivacy.ts`: `4de3f6692a5e97ae210160fa7c47ea96b448d9ac59c223e4efa0b7dfac7c8166`

## Integration blockers

### P1 — no immutable Finding-to-generation-run receipt in the runtime path

`organizationExportDecisionPrivacy.ts:112-160` compares Finding creation time with the current Insight run timestamps. It does not prove that the Finding was created by that run. An older/manual/historical Finding can be temporally compatible with a later run without having an immutable run identity. The new receipt design/helper/test is not wired into Finding creation, handoff persistence, export collection or the resolver and therefore is not runtime evidence.

Required behavior: preserve existing manual and historical Finding workflows, but keep Decision content unresolved unless the exported Finding has a durable, exact receipt for the current completed generation run. Do not make receipt absence block Finding creation. The receipt must bind at least organization, Insight, Finding, run ID and generation context identity at the writer boundary; the resolver must compare that exact identity. Until then, copied Decision body remains blocked.

### P1 — Decision handoff provenance is written as `initiative` and the resolver ignores kind

- `server/src/services/v8/interviewInsightFindingsService.ts:1266-1311` hardcodes `target_kind='initiative'` in both deduplication and INSERT.
- The Decision route creates a Decision at `server/src/routes/v8/interview-insights.routes.ts:1008-1028`, then calls `recordHandoff` without target kind at lines 1156-1161.
- `server/src/services/organizationExportDecisionPrivacy.ts:91-109` matches organization, target ID and Finding ID but does not require `target_kind='decision'`.
- The existing positive fixture had no `target_kind`, so it normalized the unsafe state into the passing denominator.

Required behavior: the writer accepts and persists the actual target kind; deduplication includes organization and kind; the route passes its resolved target type; the Decision resolver requires exactly `decision`. Historical rows with missing or another kind remain identity-only. Preserve the existing initiative default only where backward compatibility is explicit and tested.

### P1 — frontend disclosure does not recognize the composed v9 contract

The C6 backend changes `securityManifest.policyVersion` to `tenant-export-contract-v9-20260912`, while root `src/utils/organizationExportDisclosure.ts:42-47` recognizes only v5, v7 and v8. A structurally complete v9 export is therefore displayed as unverifiable.

Required behavior: recognize this exact v9 identifier while retaining fail-closed behavior for an arbitrary future version. Do not loosen count, organization, unresolved/skipped, schema identity or exclusion validation.

## Accepted bounded behavior

- Generation run ownership uses compare-and-set completion/failure writes and checks affected rows before downstream lineage. The preserved actual PostgreSQL checkpoint reports `1/0/0/1` affected rows for current completion, stale completion, stale failure and current failure, with cleanup readback zero.
- Export snapshot SQL normalizes catalog-confirmed naive timestamps with `AT TIME ZONE 'UTC'` under the existing aliases. The preserved actual PostgreSQL checkpoint reports stale denial and legal allowance under both UTC and America/Chicago.
- C6 v9 composes the root v8 Interview/canonical/task contracts without changing their blobs; Decision tables/privacy are additive.
- Structural privacy is conservative for the reviewed Decision path: ambiguous/foreign/mutated evidence, failed/generating Insight state, stale Findings, KB enrichment and unsupported provenance remain unresolved.

These points do not prove ApiGateway/JWT, endpoint JSON/CSV, full v9 disclosure, or immutable Finding-to-run provenance.

## Independent targeted results before repair

- From `server/`: Decision privacy + enrichment provenance + export contract: `3 files / 56 tests PASS`, exit 0.
- From repository root: formula/prompt compatibility: `1 file / 2 tests PASS`, exit 0.
- `git diff --check`: PASS.

The passing denominator did not cover missing/wrong handoff kind or v9 disclosure. Versioned RED tests for those exact gaps are being preserved separately before source repair. The design-only receipt helper/test is excluded from this acceptance because it is not connected to runtime.

## Next bounded gate

1. Preserve RED for Decision receipt missing kind, wrong kind and cross-kind writer dedupe/persistence.
2. Preserve RED for exact v9 disclosure while arbitrary future remains rejected.
3. Apply only the target-kind and v9 disclosure repairs, inspect their exact diffs, and rerun the same full names GREEN.
4. Keep overall C6 integration on HOLD until immutable Finding-to-run receipt exists in the runtime export decision.
