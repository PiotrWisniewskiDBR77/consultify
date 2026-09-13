# C6 target-kind and v9 disclosure — independent SOL follow-up

Date: 2026-09-13  
Scope: only the two bounded repairs accepted after `C6_SOL_FROZEN_WIP_REVIEW.md`; no DB, ports, build, tsc, commit, endpoint, migration or production-source edit by this reviewer.  
Verdict: **ACCEPT target-kind repair and exact-v9 disclosure repair. Overall C6 remains HOLD solely for the missing runtime Finding-to-generation-run receipt.**

## Target-kind RED

The Decision privacy fixture was corrected to carry `target_kind: 'decision'`. Two fail-closed cases were added without changing production source:

- `Interview Decision content authority denies receipt without target kind`
- `Interview Decision content authority denies cross-kind initiative receipt for Decision target`

Against the pre-repair resolver both cases returned `true` and failed as expected: `42 total / 40 PASS / 2 FAIL`, exit 1.

- JSON: `C6_SOL_TARGET_KIND_RED_20260913T062129Z.json`, SHA-256 `f98044be859b90293472eac46a025dd6ce99608be856854bd92817a0e25c5b72`
- log: `C6_SOL_TARGET_KIND_RED_20260913T062129Z.log`, SHA-256 `ab093e2c6d041b809e517966108a60ac61573ae5b15015182880ee78fee0df17`

## Target-kind source review and GREEN

The bounded source delta is consistent end to end:

- `recordHandoff` accepts `initiative | decision | task`, defaults legacy callers to `initiative`, and uses the selected kind in both dedupe and INSERT;
- dedupe also scopes by `organization_id`;
- the route makes `initiativeRef.targetType` required and passes it as `targetKind`;
- the Decision resolver requires `target_kind === 'decision'`, so missing/wrong-kind historical rows remain identity-only.

The existing in-memory writer fixture was updated to parse the real kind parameter. Its new executed behavior test verifies organization/kind in the dedupe query and Decision kind in the INSERT. The route test mounts the actual Express handler and verifies that a successful Decision creation passes `targetKind: 'decision'` to `recordHandoff`; only child services/data are mocked.

Results:

- Decision resolver + writer: `2 files / 49 tests / 49 PASS`, exit 0.
- Actual route handler: `1 file / 18 tests / 18 PASS`, exit 0.
- `git diff --check`: PASS.

Artifacts:

- `C6_SOL_TARGET_KIND_GREEN_20260913T062251Z.json`: `4c57e2afe0060c65eeb0a11fc88d0d11acdd851f92ec0a0d9578d3471564a5d0`
- `C6_SOL_TARGET_KIND_GREEN_20260913T062251Z.log`: `6d1366b585a08b300dfb8f31b17297aef3c42f64f2bc8c676dcecd01fad278af`
- `C6_SOL_DECISION_ROUTE_KIND_GREEN_20260913T062405Z.json`: `803491891bce99ac25c1f8ed038cc7c8282cdb52e74e4f8c4887d6cff6fb66e7`
- `C6_SOL_DECISION_ROUTE_KIND_GREEN_20260913T062405Z.log`: `5f91b1949ed34de8886c9415d48965a08eabca1ee5fd02c888284e668abed0d0`

Frozen hashes at review:

- `server/src/services/v8/interviewInsightFindingsService.ts`: `7b00fc9068da0006366292ef09d4c3fedaac7413b8f733e11087aba02e85bd22`
- `server/src/routes/v8/interview-insights.routes.ts`: `3deb95c64c4063a9e38843249627099585b2cf19e675342d2afb5570dff1c44c`
- `server/src/services/organizationExportDecisionPrivacy.ts`: `4746c8d5a4f6e023668e6a1e1232c2d32b64c90743a0247dd8e5b28a7ca8a573`
- `server/src/services/__tests__/organizationExportDecisionPrivacy.test.ts`: `64f39befaed94cb9297357ef7cff49af00f4155df0c9e40b0b9242a999c7ffa8`
- `server/src/services/v8/__tests__/interviewInsightFindingsService.test.ts`: `7d8eeb58a23dab9b6e61207df5ab3f7c94f160c041687c12def3e5c6b1e5f0e9`
- `server/src/routes/v8/__tests__/interview-insights.routes.test.ts`: `6a5a22ae6a470ab3fde2d9e76ced396e9b1ce6e2bbbe2cef7332bb09777a27b7`

## v9 disclosure RED → GREEN

The same test proves both sides of the version boundary: exact `tenant-export-contract-v9-20260912` must be recognized, while `tenant-export-contract-v10-unknown` remains incomplete with the unverified message.

- RED against the v5/v7/v8 allowlist: `4 total / 3 PASS / 1 FAIL`, exit 1; only the exact v9 positive failed. JSON SHA-256 `f63756eb4f49db0495dd24e02e237a468cd964fbbbfa8f4ab242090b3f06e5bc`; log `56218fc5b1b0072d0f97bc9be65ed4fb9360f6cd604a3a648f6ef7b2cc4a742e`.
- GREEN after adding only the exact v9 identifier: `4/4 PASS`, exit 0. JSON `C6_SOL_DISCLOSURE_V9_GREEN_20260913T062251Z.json`, SHA-256 `0f5257c27880f0524e11da5fde2e0445b5d4d4d01021570055b795fea492ee5d`; log SHA-256 `9b47899b4c06ff3c77ddac7e1408781775f36b78d9d3db4572dee189e6cd06fb`.
- All existing structure/count/organization/unresolved/skipped/schema/exclusion checks are unchanged.
- `src/utils/organizationExportDisclosure.ts`: `a6df46746646fc363f297f698ec11f2947729f50f7be9f3c40aada171c17d180`
- `tests/unit/utils/organizationExportDisclosure.test.ts`: `871ecda9a6557bde37e41a742a658ea4d3daa8aa1a434dd6b7254b408266686c`

## Remaining HOLD

The unconnected receipt helper/test remains design evidence only. This acceptance does not treat it as runtime provenance and does not alter existing manual/historical Finding creation. C6 integration remains blocked until export authorization requires an immutable receipt binding the Finding to the exact completed generation run; absence of that receipt should block copied Decision content, not Finding creation.
