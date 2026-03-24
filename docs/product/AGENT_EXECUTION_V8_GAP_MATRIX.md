# Agent execution v8 - Gap matrix

> Status: Draft v8
> Cel: Porownac obecny runtime z targetem `Agent Execution v8`, wskazac glowne luki, priorytety i zaleznosci dla przebudowy execution layer.

---

## 1. Jak czytac te matrix

Kazdy wiersz opisuje:
- obszar execution system,
- target v8,
- obecny stan,
- glowny gap,
- priorytet,
- uwage wdrozeniowa.

Priorytety:
- `P0` - fundamental blocker dla kanonicznego execution agent
- `P1` - bardzo wazne dla kompletnego, bezpiecznego wdrozenia
- `P2` - wzmacnia excellence, observability i skale

---

## 2. Matrix

| Area | Target v8 | As-is | Gap | Priority | Notes |
|---|---|---|---|---|---|
| Agent meaning | One meaning: governed work executor | Multiple meanings of `agent` in repo | Domain ambiguity | P0 | Fixed conceptually, must remain frozen |
| Intake surface | Canonical chat starts execution runs | Chat can start actions, but execution is fragmented | No unified run-start contract | P0 | Must align to canonical chat shell |
| Execution run model | One `ExecutionAgentRun` truth | No single run entity | No unified run lifecycle | P0 | Biggest structural gap |
| Plan model | One reviewable `ExecutionPlan` | Plans are implicit or module-local | No universal plan object | P0 | Required for bounded autonomy |
| Proposal schema | One cross-app `ActionProposal` model | Multiple proposal shapes by module | Proposal fragmentation | P0 | Blocks shared UI and adapters |
| Approval semantics | One universal approval meaning | Several approval patterns exist | Approval meaning differs by surface | P0 | Must unify before broad rollout |
| Apply semantics | Clear distinction between approve and execute | Present in some flows, blurred in others | Execution contract inconsistent | P0 | Must be explicit everywhere |
| Adapter architecture | One orchestrator + many module adapters | Module-specific executors exist | No shared adapter spine | P0 | Core engineering task |
| Artifact coverage | Agent can work across core and supporting artifacts | Reports/tasks/tables/notes have partial patterns | Cross-artifact execution incomplete | P1 | Build wave by wave |
| Permissions & gates | Execution respects project roles and workflow canon | Many checks exist, but not one execution contract | Role/gate enforcement not unified | P0 | Cannot ship safely without this |
| Workspace/runtime context | One run always knows active workspace/project/artifact context | Context exists in chat and product layers | No one execution-native context handshake | P0 | Must align with shared runtime architecture |
| Audit trail | One run-level audit across plan/proposals/execution | Audit exists in fragments | No universal execution audit object | P0 | Required for trust and support |
| Partial approvals | First-class partial approval and partial execution | Not universal | Missing standard semantics | P1 | Needed for real-world work |
| Failure model | Layered failure classes visible to user and support | Failures handled per subsystem | No unified execution failure contract | P1 | Critical for operator trust |
| Rollback / undo | Safe rollback strategy for reversible actions | Exists in some local flows (e.g. table undo ideas) | No universal policy | P1 | Important for confidence |
| Background execution | Shared runtime for queued, scheduled and resumable execution | Long-running fragments exist | No canonical job model yet | P0 | Required for serious autonomous work |
| Tool governance | One least-privilege tool permission model | Tool and approval semantics exist in fragments | No unified agent tool governance matrix | P0 | Critical before broad tool use |
| Output trust | One provenance and routing explanation contract for proposals and results | Audit patterns exist, but proof chain is incomplete | Proposal trust below leader-grade | P1 | Must align with output trust architecture |
| Module UX consistency | Same lifecycle visible in reports/notes/tables/chat | Proposal UX is module-local | UI inconsistency | P1 | Product coherence issue |
| Tool approval integration | MCP/tool mutations flow into same approval spine | MCP returns `REQUIRES_APPROVAL` | Not linked to canonical execution run | P1 | Important for tool calling future |
| Multi-step orchestration | One bounded multi-step executor | Many single-surface patterns only | No universal step orchestration runtime | P0 | Core of "agent that works" |
| Runtime observability | One view of run/proposal/step/adapters | Logging exists in parts | No end-to-end observability for execution runs | P2 | Needed for scaling and ops |
| Evaluation | Execution-agent evals across modules | No dedicated execution-agent eval package | Missing validation harness | P2 | Needed before autonomy increases |
| Human override workflow | User can refine, edit, reject, retry | Present in some places | Not globally normalized | P1 | Must exist for adoption |

---

## 3. Biggest P0 gaps

### 3.1 No unified execution run

Today the platform has:
- actions,
- decisions,
- report proposals,
- table proposals,
- notebook proposals,

but not one object representing:
- one goal,
- one plan,
- many typed steps,
- one approval graph,
- one execution summary.

This is the primary blocker.

### 3.2 No single proposal and approval truth

The same product idea appears in many forms:
- `ai_actions`,
- action decisions,
- report agent messages,
- table schema proposals,
- notebook AI proposals.

Without unification:
- UX stays inconsistent,
- adapters stay bespoke,
- audit stays fragmented.

### 3.3 No shared adapter layer

Execution is still implemented as:
- direct module mutations,
- module-local services,
- ad-hoc tool returns,
- specialized executors.

This must become:

`execution orchestrator -> module adapter -> owning service`

### 3.4 Permissions and governance are not execution-native yet

The app has strong governance rules.
But execution agent does not yet have one contract for:
- gate safety,
- role checks,
- artifact-specific permissions,
- destructive-action handling.

### 3.5 No bounded multi-step runtime

If the agent is to perform "real work", it must handle:
- planning,
- dependencies,
- checkpoints,
- partial success,
- retry/reject/replan.

Current systems only solve fragments of this.

### 3.6 Execution now depends on parity package hardening

`Execution Agent v8` is no longer blocked only by local execution design.
It also depends on the shared hardening of:

- workspace/project runtime,
- background job runtime,
- tool governance,
- output trust.

---

## 4. Key dependencies

- `Chat v8` action semantics must remain canonical for proposal/approval language,
- workflow canon must remain authoritative for gates and permissions,
- module adapters must be built on owning services, not UI automation,
- execution run audit must be designed before broad auto-apply patterns,
- artifact taxonomy must stay aligned with `SYSTEM_ARCHITECTURE_BRIEF.md`.

---

## 5. Strategic sequencing insight

The right sequencing is:

1. unify model
2. unify proposal/approval semantics
3. build shared adapters
4. expand artifact coverage
5. harden observability and evals

The wrong sequencing is:

1. add more local "AI buttons"
2. add more one-off executors
3. call the result an agent

---

## 6. Risks if gaps remain unresolved

- execution agent will behave differently in each module,
- approval semantics will confuse users,
- governance violations will be harder to detect,
- support and audit will not reconstruct what happened,
- future autonomy will amplify fragmentation instead of reducing it,
- "agent" will look powerful in demos but stay brittle in real work.

---

## 7. Strategic conclusion

`Execution Agent v8` is feasible because the repo already contains:
- approval foundations,
- executable mutations,
- proposal UX,
- audit-aware patterns.

But it is blocked by lack of:
- one run model,
- one proposal truth,
- one adapter architecture,
- one cross-app execution contract.

That is the exact rebuild scope.

Related docs:
- `AGENT_EXECUTION_V8_SSOT.md`
- `AGENT_EXECUTION_V8_AS_IS.md`
- `AGENT_EXECUTION_DOMAIN_MAP_V8.md`
