# A06 — shared adapter orchestration evidence

Date: 2026-08-08
Scope: local candidate; not final epic acceptance

The shared dispatcher requires actor, agent and centrally registered tool identity plus an idempotency key. It always calls central governance internally before ledger lookup and before `adapter.execute`, records one invocation per run/adapter/key, normalizes module-specific output and marks success only after canonical owner-table readback. Missing readback becomes `compensation_required`; a reused key with different payload is rejected. Callers can no longer supply their own governance decision.

PostgreSQL database: `consultify_agent_a06_proof_20260807`
Proof script: `server/src/scripts/a06AdapterOrchestrationRealDbProof.ts`

```json
{"proof":"A06_REALDB_GREEN","canonicalRunId":"run-a06","owningAdapters":6,"normalizedResults":6,"canonicalReadbacks":6,"idempotentReplay":true,"centralGovernanceAllowed":9,"centralGovernanceDenied":1,"deniedAdapterExecuted":false,"modules":["Ideas","Interview","Assessments","Initiatives","Finance","KPI"],"t01ToolDefinitions":17,"t01ExecutionPolicies":17,"canonicalContextFailClosed":true,"replayCanonicalReadback":true,"replayDriftCompensationRequired":true,"staleRunningRecovered":true}
```

The proof uses real PostgreSQL owner tables carrying the canonical Consultify table names. It proves the orchestration contract and readback mechanics, but does not yet prove that every existing T01 stage endpoint invokes this dispatcher or that full production module schemas were used.

The canonical execution-context loader binds the Transformation Case to its registered run identity, project, accountable actor and stable executing Agent `consultify:teresa:transformation-agent`. Missing identity, missing Agent definition or lineage drift fails closed. Exactly 17 T01 tools and 17 execution policies are ratified in the central catalog.

Succeeded replay now performs a fresh owner readback and compares a canonical sorted digest instead of trusting stored JSON. Missing/drifted artifacts become `compensation_required`. A stale `running` invocation can be reclaimed once by timestamp CAS and increments `attempt_count`; fresh running work remains blocked.

Focused hardening tests: `11/11` PASS. Full repository TypeScript check: PASS.

## T01 owner integration

DRD, Opportunity Synthesis and Portfolio Decision now split A05 approval from A06 execution. After the approval transaction commits, an outer dispatcher authorizes the ratified tool, invokes one idempotent owner materializer, performs a tenant/case/proposal canonical readback and only then finalizes the T01 applied state and audit. `approved-but-not-applied` requests resume safely.

```json
{"proof":"T01_A06_OWNER_INTEGRATION_GREEN","ownerMaterializations":["transformation.drd.materialize","transformation.initiative_candidate.materialize","transformation.portfolio_decision.materialize"],"canonicalReadbacks":3,"idempotentPublicResumes":3,"ownerDoubleWrites":0,"centralGovernanceAllowed":6,"centralGovernanceDeniedBeforeSideEffect":1,"approvedButNotAppliedResumed":true}
```

Central denial on DRD left the proposal approved but created no Assessment. Rerunning the same request after ratification resumed successfully. Focused integrated tests: `26/26` PASS; the full T01 realDB flow still reached Case v24 / `final_outputs`.

Ideas aggregate, Interview two-phase assignment, Finance/KPI composite and Mobilization blueprint aggregates now use the same boundary. Across all seven proposal materializations:

```json
{"proof":"T01_A06_OWNER_INTEGRATION_GREEN","canonicalReadbacks":7,"idempotentPublicResumes":7,"ownerDoubleWrites":0,"centralGovernanceAllowed":14,"centralGovernanceDeniedBeforeSideEffect":1,"approvedButNotAppliedResumed":true}
```

The full T01/A05 flow reached Case v24 with seven A05 proposal mappings, nine result gates and zero divergence. Focused A06 integration tests: `27/27` PASS.

## T01 result gates and final publication

All nine result/checkpoint gates now use the outer A06 dispatcher before their inner A05 transaction. Their stable identities are `gate:<key>:case-v<sourceVersion>`. The canonical readback requires the durable A05 mapping to be `applied`, preserves the accepted stage/version receipt after later stage advancement and verifies the required owner artifacts. A succeeded replay performs the readback again and does not execute the inner gate.

```json
{"proof":"T01_A06_RESULT_GATES_GREEN","gates":9,"canonicalReadbacks":9,"idempotentReplays":9,"gateDoubleWrites":0,"centralDenialBeforeSideEffect":true}
```

Final publication preserves the exact order `A05 factsDigest/case/plan/context approval -> central A06 authorization -> one idempotent publish adapter -> canonical manifest and file readback`. The single successful ledger row used `transformation.final_outputs.publish`, `attempt_count=1` and compensation policy `delete_created`. Replay returned the same run and left counts at one manifest, three lineage links and one generation audit. Central denial occurred before the invocation ledger and before render/file/manifest work, leaving zero manifests, links, generation audits and adapter invocations. Readback matched tenant, Case, run, Case version and facts digest, then rehashed the physical DOCX and PPTX bytes and matched both persisted SHA-256 values. Cross-tenant latest-run readback returned `null`.

```json
{"proof":"T01_A06_FINAL_OUTPUT_PUBLISH_GREEN","ledgerRows":1,"attemptCount":1,"compensationPolicy":"delete_created","idempotentReplay":true,"duplicateManifests":0,"duplicateFiles":0,"centralDenialSideEffects":{"manifests":0,"links":0,"audits":0,"invocations":0},"physicalFileRehash":"verified","crossTenantReadback":null}
```

The fresh chained RealDB proof covered seven A06 materializations, nine A06 gates and A06 final publication. The subsequent canonical A10 evaluation passed `5/5` with score `1.0`, no failed or critical cases and cross-tenant readback `null`. Focused final-output/A06 tests: `9/9` PASS; full repository TypeScript check: PASS with an 8 GB Node heap.

A06 remains `PARTIAL`: local code and RealDB integration are green for all seven materializations, nine gates and final publication, but same-SHA deployed HTTP/UI/browser and production evidence is still missing.
