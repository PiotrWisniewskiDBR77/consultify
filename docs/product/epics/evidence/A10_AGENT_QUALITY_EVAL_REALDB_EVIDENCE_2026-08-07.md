# A10 Agent quality-evaluation gate — realDB evidence

> Date: 2026-08-07
> Candidate: dirty local `codex/agent-t01-i01`; stored SHA is the worktree base and is not release evidence
> Database: isolated PostgreSQL `consultify_agent_a10_proof_20260807`

The gate computes results from deterministic validators. Callers cannot submit a `passed` flag. A suite is structurally rejected unless it covers correctness, completeness, evidence, policy compliance and usefulness plus all five non-overridable critical invariants from the accepted T01 quality pack.

```json
{
  "proof": "A10_REALDB_GREEN",
  "passingGate": true,
  "adversarialCriticalFailureBlocked": true,
  "mandatoryDimensions": 5,
  "criticalInvariants": 5,
  "deterministicValidators": true,
  "tenantIsolation": true,
  "caseReadback": 5
}
```

Verified assertions:

- supported validators include exact equality, non-empty/minimum count, numerical tolerance, SHA-256 artifact match, allowed state and forbidden-pattern absence;
- every case requires evidence references; missing evidence computes a failure;
- one passing suite persisted five passing cases and a score of 1.0;
- an adversarial suite with four of five passing cases and a deliberately reduced 0.5 threshold still failed because tenant isolation is critical;
- the critical failure key persisted as `tenant_isolation:tenant-isolation`;
- eval run, suite version, base SHA, dimensions, validators, actual/expected values and evidence references survived PostgreSQL readback;
- another tenant could not read the eval run;
- focused service tests are green: 4/4; full TypeScript check is green.

The reusable deterministic gate and adversarial critical-failure semantics have PostgreSQL evidence. The Transformation Case UI exposes a named quality/trust region with verification state, confidence, limitations, failed dimensions and critical failures. It renders only supplied evaluation data and explicitly shows evidence unavailable when the Case API cannot provide it; no confidence score is invented.

## Canonical live-readback evidence

The evaluator now consumes tenant-scoped canonical PostgreSQL readbacks for the Case, 15 persisted plan steps and plan-approval audit, seven applied stage proposals, owning Finance/KPI records, final-output manifest/hash integrity and truthful terminal state. It does not accept caller-supplied pass flags.

Independent database: `consultify_agent_t01_a05a10_root_20260808`.

```json
{"proof":"A10_LIVE_READBACK_BOUND","transformationCaseId":"tc-t01-i03","lifecycleStage":"final_outputs","status":"passed","score":1,"passedCases":["tenant-scoped-canonical-case","approved-plan-and-stage-gates","finance-and-kpi-owning-readback","final-output-integrity-readback","truthful-case-completion"],"failedCases":[],"criticalFailures":[],"crossTenantReadback":null}
```

The source-truth repair added fail-closed plan-step readback on Case creation and plan approval, plus explicit tenant-bound KPI actuals and canonical KPI measurements at delivery handoff. No Benefit-to-KPI heuristic or reduced threshold was used.

A10 remains partial only for expert usefulness review and clean exact-SHA deployed evaluation evidence.
