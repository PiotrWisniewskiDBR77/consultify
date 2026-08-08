# EPIC-AGENT-T01 — Current Runtime Map

> Status: `DISCOVERY SNAPSHOT — NOT ACCEPTANCE`
> Date: 2026-08-07
> Inspected SHA: `4610ddb7de335071921435d265bb499ac2ac51e2`
> Worktree: dirty; existing user/parallel changes present
> Target: `EPIC-AGENT-T01_AUTONOMOUS_TRANSFORMATION_END_TO_END.md`

## 1. Classification

- `REAL` — mounted runtime plus durable storage and relevant tests exist;
- `PARTIAL` — valuable runtime exists but target contract or full proof is missing;
- `PROPOSAL_ONLY` — Agent can prepare output but canonical apply/readback is absent;
- `NOT_CONNECTED` — owning module works, but Agent execution spine does not invoke it;
- `NOT_IMPLEMENTED` — target object or behavior is absent;
- `EVIDENCE_MISSING` — implementation may exist, but target-grade current-SHA proof was not found.

## 2. Target-to-runtime map

| Target stage | Existing runtime anchors | Status | Critical gap |
|---|---|---|---|
| Teresa mandate intake | canonical chat stack; `UnifiedChatPanel`; Chat v8 runtime | `PARTIAL` | no mandate-to-Transformation-Case command and no T01 plan compiler |
| Transformation Case | no production `TransformationCase` domain/service/table found | `NOT_IMPLEMENTED` | durable cross-module business envelope missing |
| Agent plan | `agentPlannerService`, `ai_agent_plans`, process library, Agent Hub/Canvas | `PARTIAL` | plans are tool-step plans, not full transformation-stage plans bound to Transformation Case |
| Proposal/approval spine | `aiActionExecutor`; v8 execution/proposal tables; action decision/execution paths | `PARTIAL` | several competing truths; no T01-wide proposal/approval contract |
| Initial Ideas | Ideas services, AI generation, maps, My Work routes and tests | `REAL` as module; `NOT_CONNECTED` to T01 | no Agent adapter creating source-linked Ideas from transformation run |
| Interview | assignment/session UI and routes; extended persistence; v8 API; integration/e2e tests | `REAL` as module; `NOT_CONNECTED` to T01 | no Agent adapter covering plan -> assignment -> real response -> reviewed insight |
| DRD | canonical method docs, assessment stores/routes, report services and acceptance tests | `PARTIAL` | DRD runtime exists, but Agent cannot orchestrate full evidence/score approval/gap handoff |
| Idea synthesis | clustering and suggestion services; map snapshots | `PARTIAL` | no many-source transformation lineage and protected review semantics |
| Finance | Business Case service/model; v8 finance APIs; initiative integration migrations/tests | `REAL` as bounded module; `NOT_CONNECTED` to T01 | no Agent Finance adapter and no whole-flow deterministic/readback proof |
| KPI | Results/KPI routes and services; finance linkage and deviation tests | `REAL` as bounded module; `NOT_CONNECTED` to T01 | no Agent KPI-card proposal/apply adapter bound to transformation/initiative |
| Initiative Candidates | initiative generation/governance services; source contracts and routes | `PARTIAL` | no single Agent adapter bound to canonical proposal/run/lineage contract |
| Initiative portfolio | initiative services, lifecycle, portfolio and governance runtime | `REAL` as module; `NOT_CONNECTED` to T01 | Agent has no end-to-end approved portfolio creation path |
| Execution objects | Tasks/Decisions/Execution services and workflow docs; some cross-module tests | `PARTIAL` | no T01 handoff snapshot and no unified adapter/readback sequence |
| Benefits realization | benefits routes, Results services, KPI/Finance reconciliation | `PARTIAL` | full delivered -> effective -> sustained sequence not proven through Agent |
| Canonical report | report builder/artifact services and report routes | `PARTIAL` | no T01 report assembled from the transformation snapshot |
| DOCX | Document Studio/report export routes and tests | `PARTIAL` | no T01 canonical report -> verified DOCX path |
| PPTX | presentation services/artifact engine and export tests | `PARTIAL` | no T01 snapshot -> deck consistency/readback path |
| Whole audit/lineage | fragmented run, action, artifact and evidence ledgers | `PARTIAL` | no one transformation lineage ID across all required artifacts |
| Whole golden flow | no acceptance test matching T01 flows 1–15 | `NOT_IMPLEMENTED` | no current-SHA realDB/model/worker/visual proof pack |

## 3. Architectural diagnosis

The repository is not missing all required module capabilities. The dominant problem is **cross-module convergence**:

- strong bounded module runtimes exist;
- several Agent/action/run systems exist;
- the durable Transformation Case is absent;
- no one adapter sequence carries the mandate through the complete business lifecycle;
- existing tests prove local capabilities, not the target epic.

Therefore the first coding step must not build another module-local feature or another Agent runtime. It must establish the missing cross-module identity and bind existing Agent planning to it.

## 4. First critical-path increment

### T01-I01 — Teresa mandate -> Transformation Case -> complete plan proposal

Required thin slice:

1. canonical `TransformationCase` schema and service;
2. create/read/list API with tenant and project guards;
3. conversation and Agent run bindings;
4. plan metadata binding to `transformationCaseId` and lifecycle stage;
5. Teresa action/intent that creates a draft case and reviewable full plan proposal;
6. no downstream Ideas/Interview/DRD mutation yet;
7. real PostgreSQL persistence and readback;
8. idempotent retry for the same mandate/action;
9. audit event and UI-visible link/status;
10. unit, integration, permission and narrow E2E proof.

### Why this is first

Without Transformation Case identity:

- later artifacts cannot share one durable lineage;
- Word/PPT consistency cannot be established;
- multiple Agent runtimes will continue creating fragmented truths;
- benefits and sustainability cannot be traced back to the mandate.

## 5. Pre-code blockers and controls

Not blockers to design/discovery, but blockers to safe implementation in the current directory:

- dirty worktree contains existing changes, including Agent UI;
- current branch is ahead of its remote and is not confirmed as the canonical implementation base;
- no isolated clean worktree has yet been selected;
- current `origin/demo` lineage has not been fetched/reconciled in this discovery step.

Before T01-I01 code:

1. resolve canonical base SHA;
2. create a clean isolated `codex/` worktree/branch;
3. preserve all current user work without stash or destructive commands;
4. freeze T01-I01 micro-contract and migration ownership;
5. run baseline targeted tests on the isolated candidate.
