# E1b forecast/progress evidence feed — author freeze

Date: 2026-09-13

## Identity and scope

- Worktree: `/Users/piotrwisniewski/Developer/codex-wt/codex-execution-bank-evidence-20260913`
- Branch: `codex/execution-bank-evidence-20260913`
- HEAD and merge-base: `a743a96c6302b6e81d030168e0c3cc687eaa1fee`
- Binding preflight SHA256: `9b805f6764b987ceffc455727edcde608e284ed211c0ea7792fd777f3a9f6005`
- Freeze: the 14 files below are immutable pending independent review. The root-owned untracked `tests/integration/execution-bank-evidence.gateway.root-review.test.ts` is excluded from this author freeze and was not edited or staged by the author.

## Frozen file manifest (git blob)

### Production

- `67518aee417978c44ccc33f1fa3c4d43c9dfcdcf  server/src/services/initiative/executionBankEvidenceReadService.ts`
- `50cf2246f6025a0b32d68919a585bcb4f10bff90  server/src/controllers/InitiativeController.ts`
- `d5efc0b32e19b088527a6fedff2f1bc6026d8772  server/src/services/v8/managerActionExecutionService.ts`
- `41286ad0d7364b6f7fc7ad3e1b6350a516b318f1  src/services/api.ts`
- `e1cc579840b3c664af93eae125a205b57bae4f5a  src/components/Execution/executionBankModel.ts`
- `4ba26cad25fc2f5701dc01432210b8068045742a  src/components/Execution/ExecutionHub.tsx`

### Tests

- `e240495a9fe71e1650cd1109d5c1c122bce3ca23  server/src/services/initiative/__tests__/executionBankEvidenceReadService.test.ts`
- `3bad1d9abab8b237b0c39e62837e7581305acd27  server/src/services/initiative/__tests__/executionBankEvidenceReadService.adversarial.test.ts` (reviewer-owned; not edited by author)
- `f439fb66d27a8f7f405ae87e6b3afc1875402c58  server/src/controllers/__tests__/InitiativeController.e1bEvidence.test.ts`
- `3fdb390f19caedc24b56d0f4c588662e163c9a21  server/src/services/v8/__tests__/managerActionExecutionService.test.ts`
- `c9aa474b8e61fa0d21e6691f39c0eb82be90a0d0  src/components/Execution/__tests__/executionBankModel.test.ts`
- `4a2c33c2fa28291c203a5f825c07f9a945ce8f03  src/services/__tests__/api.getInitiatives.e1bEvidence.test.ts`
- `a32d5b35b37c77e721550367ee7852f184d6cbe2  tests/components/Execution/ExecutionHub.e1bBankViews.behavior.test.tsx`
- `f1d237a705f663aff113caa67193be72645c93ff  tests/integration/execution-change-progress-spine.golden-flow.realdb.test.ts`

## Behavioral GREEN

Exact command:

```text
npx vitest run server/src/services/initiative/__tests__/executionBankEvidenceReadService.test.ts server/src/services/initiative/__tests__/executionBankEvidenceReadService.adversarial.test.ts server/src/controllers/__tests__/InitiativeController.e1bEvidence.test.ts server/src/services/v8/__tests__/managerActionExecutionService.test.ts src/components/Execution/__tests__/executionBankModel.test.ts src/services/__tests__/api.getInitiatives.e1bEvidence.test.ts tests/components/Execution/ExecutionHub.e1bBankViews.behavior.test.tsx --no-file-parallelism --reporter=json --outputFile=/Users/piotrwisniewski/Developer/consultify-handoff-docs/integrator-20260912/E1B_EVIDENCE_COMBINED_GREEN_FINAL_20260913T085000Z.json
```

Result: exit 0; 14/14 suites and 52/52 tests PASS. Full names are retained in the raw JSON.

- Raw JSON: `E1B_EVIDENCE_COMBINED_GREEN_FINAL_20260913T085000Z.json`
- SHA256: `654a6835e29e18333fafb99552696bbe0a39999589d85692d29e6ba51ad537da`

Timezone repeat:

```text
TZ=UTC npx vitest run server/src/services/initiative/__tests__/executionBankEvidenceReadService.test.ts server/src/services/initiative/__tests__/executionBankEvidenceReadService.adversarial.test.ts --no-file-parallelism --reporter=json --outputFile=/Users/piotrwisniewski/Developer/consultify-handoff-docs/integrator-20260912/E1B_EVIDENCE_TIMEZONE_UTC_GREEN_20260913T085500Z.json
```

Result: exit 0; 4/4 reported suites and 24/24 tests PASS; SHA256 `0920a5a29c1109c882a4d2585ea292496c3cd071976dc7deb44e2b6251a676e0`. The normal combined run used the host `America/Chicago` timezone and explicitly compares equivalent UTC and Chicago instants.

## Server typecheck

Command: `NODE_OPTIONS=--max-old-space-size=8192 npx tsc -p server/tsconfig.json --noEmit`

Result: exit 0. Empty log `E1B_EVIDENCE_SERVER_TSC_V2_20260913T084500Z.log`, SHA256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.

## cx8 RealPG evidence

The runtime wrapper/config source was `/Users/piotrwisniewski/Developer/codex-wt/codex4-scratch/ie01-rc2-runtime-20260913/run-api-c6-e1b-final.py`. The command reused its credential-safe Docker inspect assertions for container `bd644c57cb4c9f8626855da09a587e2897d5d5a07da97012d8897886aceac02c`, `127.0.0.1:6459`, and database `cx8_e0`, then spawned Vitest with `RUN_DB_TESTS=1`, `MOCK_DB=false`, `DB_TYPE=postgres`, and `E2E_MODE=true`. No HTTP listener or new port was opened.

V1 (`E1B_EVIDENCE_CX8_REALPG_CANDIDATE_20260913T083000Z.json`) is retained as a failed prerequisite run: 12 tests remained skipped/pending because fixture setup used obsolete `EXECUTING`, rejected by actual `initiatives_status_check_p12`. It is not PASS evidence.

V2 changed only the fixture status to actual canonical `IN_EXECUTION`, removed absent `task_history` from required tables while retaining the reader's optional fallback, and replaced JSX in `.test.ts` with `React.createElement`. Result: exit 0; 2/2 reported suites and 12/12 tests PASS.

- Raw: `E1B_EVIDENCE_CX8_REALPG_CANDIDATE_V2_20260913T083500Z.json`
- SHA256: `23230c220e792891a7580a143b926634ae09180340ca6320654f087090e4246e`
- This is real Postgres plus in-process Express using real routes/controllers/middleware and the inherited unsigned E2E JWT bypass. It is not full ApiGateway or signed-JWT proof.
- The added golden-flow assertion reads exact progress/reforecast receipts over HTTP, matches their record IDs and timestamps to direct PG readback, then feeds that same Initiative ID/evidence/asOf through the real Bank model and mounted table renderer.

Read-only cx8 catalog result:

```text
execution_audit_log|changed_at|timestamp without time zone
initiative_history|changed_at|timestamp with time zone
manager_action_audit_log|created_at|timestamp with time zone
```

`task_history` returned no catalog row. Every queried receipt timestamp is projected as epoch seconds before node-pg conversion.

After the successful harness cleanup and explicit cleanup of the two failed V1 setup prefixes, readback was zero for `org_excp_%`, `user_excp_%`, `proj_excp_%`, `init_excp_%`, their decisions, initiative history, and execution audit rows.

## Retained RED lineage

- `E1B_EVIDENCE_INITIAL_RED_20260913T074500Z.json`: COLLECTION_ERROR only, not behavioral evidence.
- `E1B_EVIDENCE_CONTROLLER_BEHAVIOR_RED_20260913T074000Z.json`: 3 collected, 0 pass; missing Controller evidence projection and invalid-asOf behavior.
- `E1B_EVIDENCE_ADVERSARIAL_MANAGER_RED_20260913T0745Z.json`: 5 pass / 2 fail; actual `manager_scope_reduction` receipt mismatch.
- `E1B_EVIDENCE_ADVERSARIAL_MALFORMED_RED_20260913T0805Z.json`: 9 pass / 3 fail; malformed date/progress coercion.
- `E1B_EVIDENCE_ADVERSARIAL_TIMEZONE_MALFORMED_RED_20260913T0810Z.json`: 12 pass / 1 fail; epoch SQL requirement.
- The reviewer independently preserved the final 13/13 adversarial GREEN at `E1B_EVIDENCE_ADVERSARIAL_GREEN_20260913T0820Z.json`.

## Honest boundaries

- Evidence reading is opt-in through `includeExecutionEvidence=1` or explicit `asOf`; ordinary Initiative lists do not call the evidence reader.
- Current-vs-historical snapshots without exact event history remain UNKNOWN. Freshness remains UNKNOWN with `FRESHNESS_POLICY_MISSING`.
- The task-derived formula remains named legacy PARTIAL and becomes UNKNOWN when exact matching task progress receipts are unavailable; cx8 currently has no `task_history` table.
- No migration, schema, default flag, role, route write, shared standard, `ExecutionBankViews`, build, deploy, push, or commit was performed.
- Full ApiGateway plus signed-JWT acceptance is reserved to the root-owned test and is not claimed here.
