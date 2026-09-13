# C6 integrated pointer timestamp acceptance

Verdict: **ACCEPT for the bounded pointer timestamp repair and the actual generation-derived Finding → Decision handoff → organization export seam.** This does not extend export ownership or claim whole-product/deployment acceptance.

## Target and source

The exact reviewed two-file repair was applied by root to the integrated worktree `/Users/piotrwisniewski/Developer/codex-wt/codex-w17-deck-autosave-20260912`, tested at HEAD `a743a96c6302b6e81d030168e0c3cc687eaa1fee`. The C6 integration commit `f07849ec5a93c6e14dfaf27c981a27ba9cdc8e5a` remains an ancestor.

Tested production hashes, unchanged before/after both runtime runs:

- `server/src/Gateway.ts`: `33dacc8b2f70c87d51c7cc9d694df7b015297c8fc0cd627f1cd3f244215d160d`
- `server/src/routes/v8/interview-insights.routes.ts`: `3deb95c64c4063a9e38843249627099585b2cf19e675342d2afb5570dff1c44c`
- `server/src/routes/organization/ownership.routes.ts`: `c2c0da45590e248e674ea6081f570cf645225508be9d466370392452976effd0`
- `server/src/services/InterviewInsightService.ts`: `4940f151a3a217c12459ce98f4602c497b540e243dedd032096523dac7f735fb`
- repaired writer: `56695cca596cbcda784c8daeb79ee9a40e2a5933072a34b450f369ab421ce554`
- generation receipt helper: `cbc8079dacfb931ae177fee575279cd76e41b3df31dff31540dc4d89722dc2a6`
- receipt source: `62ba2b7b117fa3c40c4f4cf26ddc26996427b79a355977d98131dd213a69ed9f`
- Decision resolver: `a0d0b62e2a4b2b63bfbb81ccbc28385ee53e37ad17566de90d1cdb682cfc4129`
- export service: `0bc1bb9e16b6bf563d2abf5addd47171b97188a413b57a6bb220a7ea7fafa386`

The root worktree also contained disjoint `src/components/Execution/ExecutionBankViews.tsx` WIP. This lane did not edit root source; its harness only read the combined production modules.

## Actual behavior

Same fullName passed in both process zones:

`C6 integrated actual writer to Decision handoff to export allows the immutable generation-derived body, then permanently denies it after edit and restore`

Each run used a fresh UUID organization/admin/session/question/Insight/run and actual `ApiGateway` on the existing port 4216 with real JWT/permissions and actual PostgreSQL:

1. GET Findings invoked the locked generation writer and created a new Finding, pointer and deterministic receipt.
2. PATCH readback confirmed client review without creating an invalidation.
3. POST handoff created an exact source-stamped Decision and handoff row with `target_kind=decision`.
4. JSON and CSV organization exports included the unchanged Decision body.
5. PATCH changed the semantic Finding, then a second PATCH restored the exact original fields.
6. Storage contained exactly one deterministic `finding_generation_invalidated_v1` marker.
7. JSON and CSV exports permanently stripped the Decision body after restore.

UTC actual pointer: stored canonical `2026-09-13T07:28:56.581Z`, handoff `2026-09-13T07:28:56.581Z`, shift 0.

America/Chicago actual pointer: stored canonical `2026-09-13T07:29:21.402Z`, handoff `2026-09-13T07:29:21.402Z`, shift 0.

The deterministic receipt did not contain raw Finding/evidence content. Export did not expose receipt hashes/detail.

## Runtime resources and cleanup

- exact container `4787ced942d4b28650a212dc1b13da82ecc3640d924b155be2a38713b18ef64c`
- existing host port 6457, database `cx6_export_contract`
- existing HTTP port 4216, closed after each run
- auth bypass false, V8 enabled, visibility enforcement enabled
- no LLM/external call, new port, migration, schema recreation, build, deploy, commit or push

After each zone, cleanup readback was zero for organization, user, membership, session, question, Insight, Finding, pointer, audit/receipt, handoff, Decision and canonical inbox rows. Catalog snapshots were equal before/after.

## Evidence

- UTC result: `C6_INTEGRATED_WRITER_HANDOFF_EXPORT_GATEWAY_ACCEPTANCE_UTC.json`, SHA256 `d9dd620556414827c76c561040d1a28eb30ccfab2e7e7b5645ba7f531c22a45f`
- UTC detail: `C6_INTEGRATED_WRITER_HANDOFF_EXPORT_GATEWAY_ACCEPTANCE_UTC_EVIDENCE.json`, SHA256 `a69d9e681444ae46decc6d70e2db3998b47f2c2354d5e1be25a6e2ffe66a42ea`
- Chicago result: `C6_INTEGRATED_WRITER_HANDOFF_EXPORT_GATEWAY_ACCEPTANCE_CHICAGO.json`, SHA256 `116dba8ba59dac10c0e108cb9b005b9e210d86286d85a524440e92c9b6b08990`
- Chicago detail: `C6_INTEGRATED_WRITER_HANDOFF_EXPORT_GATEWAY_ACCEPTANCE_CHICAGO_EVIDENCE.json`, SHA256 `3ad0272859246703636bd7fe0096f2cc9b8865ffb8e94fd101ed6d1aceed71c6`

Earlier immutable failure/reproduction evidence remains in `C6_INTEGRATED_HTTP_WRITER_HANDOFF_EXPORT_CHECKPOINT_20260913.md`. Direct service RED→GREEN and exact two-file diff remain in `C6_POINTER_TIMESTAMP_REPAIR_CHECKPOINT_20260913.md`.

Exact private-credential-safe rerun commands:

```sh
TZ=UTC node /Users/piotrwisniewski/Developer/codex-wt/codex6-scratch/run-c6-integrated-writer-handoff-export.acceptance.mjs
TZ=America/Chicago node /Users/piotrwisniewski/Developer/codex-wt/codex6-scratch/run-c6-integrated-writer-handoff-export.acceptance.mjs
```

The launcher verifies the exact container/port and keeps credentials inside the child process environment. The test imports the integrated root modules directly, so it cannot make stale integrated source pass by aliasing repaired C6 branch modules.
