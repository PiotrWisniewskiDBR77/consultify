# WP-W1-AI-01 — AI Runtime Spine: Context & Identity Baseline Analysis

> Status: Completed
> Packet: WP-W1-AI-01
> Wave: 1 — Platform and governance spine
> Priority: P0
> Date: 2026-03-23
> Canonical inputs read:
> - `AI_PERFECT_SYSTEM_CLOSURE_PROGRAM_V8.md` §6.2
> - `AI_AGENTIC_SYSTEM_NEXT_PHASE_V8.md` §3 Phase A
> - `AI_WORKSPACE_PROJECT_RUNTIME_ARCHITECTURE_V8.md`
> - `AGENT_EXECUTION_V8_SSOT.md`
> - `KNOWLEDGE_RAG_V8_SSOT.md`
> - `CHAT_V8_RUNTIME_TRUTH_MAP.md`
> - `V8_IMPLEMENTATION_MASTER_PROGRAM.md` §8.2

---

## 1. ContextSnapshot object family

### 1.1 Design rationale

The canonical docs converge on a single requirement: **all important AI behavior must be reconstructable from one runtime context snapshot** (`AI_PERFECT_SYSTEM_CLOSURE_PROGRAM_V8.md` §6.2). Three independent consumers — Chat, Execution Agent, and Knowledge RAG — currently assemble context through separate paths. The ContextSnapshot family normalizes these into one shared object model.

### 1.2 Object model

#### `ContextSnapshot`

The root envelope. One instance is captured per meaningful AI interaction boundary (conversation turn, execution run creation, retrieval request).

| Field | Type | Required | Source of truth |
|---|---|---|---|
| `snapshot_id` | uuid | yes | generated at capture time |
| `snapshot_version` | integer | yes | monotonic per identity chain; enables staleness detection |
| `captured_at` | timestamp | yes | wall-clock at capture |
| `workspace_id` | uuid | yes | `WorkspaceContext` resolver |
| `organization_id` | uuid | yes | tenant identity; mandatory for isolation |
| `project_id` | uuid | no | `ProjectContext` resolver; null when workspace-global |
| `conversation_id` | uuid | no | present when interaction is conversational |
| `execution_run_id` | uuid | no | present when an `ExecutionAgentRun` is active |
| `artifact_refs` | `ArtifactRef[]` | no | zero or more target artifacts in scope |
| `effective_scope_ref` | ref | yes | resolved scope used for retrieval and permissions |
| `resolved_role_ref` | ref | yes | effective user role at capture time |
| `initiator_user_id` | uuid | yes | the human who triggered the interaction |
| `consumer_class` | enum | yes | `chat` · `execution` · `retrieval` · `background` · `worker` |
| `privacy_mode` | boolean | yes | whether private-mode constraints apply |
| `source_context_refs` | `SourceRef[]` | no | explicit references to knowledge sources assembled |

**Versioning rule:** `snapshot_version` increments whenever any identity-chain field changes value within the same logical session. The previous version is retained for drift detection (§3).

#### `ArtifactRef`

Lightweight pointer to an artifact in scope.

| Field | Type | Required |
|---|---|---|
| `artifact_id` | uuid | yes |
| `artifact_type` | enum | yes |
| `artifact_module` | string | yes |
| `relationship` | enum (`target` · `source` · `reference`) | yes |

#### `SourceRef`

Pointer to a knowledge source used during context assembly.

| Field | Type | Required |
|---|---|---|
| `source_id` | uuid | yes |
| `scope_type` | enum (`session` · `user_private` · `organization` · `system` · `external`) | yes |
| `source_kind` | string | yes |
| `freshness_at` | timestamp | no |

### 1.3 Composition rules

1. **One snapshot per boundary.** A new snapshot is captured when: a conversation turn begins, an `ExecutionAgentRun` is created, or a retrieval request is issued outside an existing run.
2. **Snapshots are immutable after capture.** If context changes, a new snapshot version is created — the old one is never mutated.
3. **Snapshots compose upward.** An `ExecutionRunContext` snapshot embeds the `ConversationContext` snapshot that initiated it. An artifact mutation records the `execution_run_id` snapshot that produced it.
4. **Consumer class is declared, not inferred.** Each consumer (chat, execution, retrieval, background worker) declares itself so downstream policy can differentiate.

### 1.4 Alignment with canonical docs

| Canonical doc | What it requires | How ContextSnapshot satisfies it |
|---|---|---|
| `AI_WORKSPACE_PROJECT_RUNTIME_ARCHITECTURE_V8.md` §4.1 | "one versioned ContextSnapshot object reused by chat, execution, retrieval and support tooling" | Directly: the object model above |
| `AI_WORKSPACE_PROJECT_RUNTIME_ARCHITECTURE_V8.md` §4.1 | Minimum snapshot fields list | All listed fields are present; `effective_scope_ref` and `resolved_role_ref` cover the scope and role requirements |
| `AGENT_EXECUTION_V8_SSOT.md` §9.1 | `ExecutionAgentRun` must carry `organizationId`, `projectId?`, `conversationId`, `sourceContextRefs` | Mapped to `organization_id`, `project_id`, `conversation_id`, `source_context_refs` |
| `KNOWLEDGE_RAG_V8_SSOT.md` §8 | Retrieval must be policy-first with scope pre-filtering by `organization_id`, `user_id`, `scope_type`, `visibility`, `sensitivity` | `effective_scope_ref` + `organization_id` + `privacy_mode` provide the pre-filter anchor |
| `AI_PERFECT_SYSTEM_CLOSURE_PROGRAM_V8.md` §6.2 | "artifact mutations preserve the originating snapshot" | `ArtifactRef` with `execution_run_id` back-reference |

---

## 2. Identity chain map

### 2.1 Chain overview

```
Workspace → Project → Conversation → Run → Artifact
```

Each layer narrows scope and adds runtime semantics. The chain is **not always fully populated** — a quick chat answer may only have Workspace → Conversation, while a governed execution may populate all five layers.

### 2.2 Layer definitions

#### Layer 1: Workspace

| Attribute | Value |
|---|---|
| **Identity** | `workspace_id` + `organization_id` |
| **Owns** | Tenant boundary, org-level settings, org-level knowledge scope, user membership |
| **Resolves** | Which organization and tenant isolation rules apply |
| **Resolver** | Platform shell; always available; set at session start |
| **Canonical source** | `AI_WORKSPACE_PROJECT_RUNTIME_ARCHITECTURE_V8.md` §4 rule 1: "WorkspaceContext defines where the user currently works" |

#### Layer 2: Project

| Attribute | Value |
|---|---|
| **Identity** | `project_id` (optional — null when workspace-global) |
| **Owns** | Business boundaries, governance visibility, project-scoped knowledge, role gates |
| **Resolves** | Which project-level permissions, retrieval scopes, and artifact families apply |
| **Resolver** | Active project resolver; may be explicit (user selects project) or implicit (derived from artifact context) |
| **Canonical source** | `AI_WORKSPACE_PROJECT_RUNTIME_ARCHITECTURE_V8.md` §4 rule 2: "ProjectContext adds business, governance and visibility boundaries" |

#### Layer 3: Conversation

| Attribute | Value |
|---|---|
| **Identity** | `conversation_id` |
| **Owns** | Interactive thread continuity, message history, session-scope knowledge, user intent sequence |
| **Resolves** | Conversational memory, session attachments, working context for the current dialogue |
| **Resolver** | `useConversationStore` / `conversations.routes.ts` (`CHAT_V8_RUNTIME_TRUTH_MAP.md` §2) |
| **Canonical source** | `AI_WORKSPACE_PROJECT_RUNTIME_ARCHITECTURE_V8.md` §4 rule 3: "ConversationContext is the user-visible interactive thread, but not the source of durable execution state" |

**Critical distinction:** Conversation is the *entry surface*, not the *execution authority*. Durable state lives in the Run layer.

#### Layer 4: Run (ExecutionAgentRun)

| Attribute | Value |
|---|---|
| **Identity** | `execution_run_id` |
| **Owns** | Plan, proposals, approval state, execution progress, audit trail, source context refs |
| **Resolves** | What work is being done, what artifacts are targeted, what approval gates apply |
| **Resolver** | Execution orchestrator; created when chat intake triggers a governed work request |
| **Canonical source** | `AGENT_EXECUTION_V8_SSOT.md` §9.1 (`ExecutionAgentRun` domain model) |

**Lifecycle states (canonical):** `draft_intake → planning → proposed → pending_review → approved_partial/approved_full/rejected → executing → completed_partial/completed_full/failed → audited` (`AGENT_EXECUTION_V8_SSOT.md` §8).

#### Layer 5: Artifact

| Attribute | Value |
|---|---|
| **Identity** | `artifact_refs[]` (one or more `ArtifactRef`) |
| **Owns** | Target object state, active previews, working references, mutation history |
| **Resolves** | Which domain objects are being created, read, or mutated |
| **Resolver** | Module adapters via the execution orchestrator (`AGENT_EXECUTION_V8_SSOT.md` §12.2) |
| **Canonical source** | `AI_WORKSPACE_PROJECT_RUNTIME_ARCHITECTURE_V8.md` §4 rule 5: "ArtifactWorkingContext holds target objects, active previews and working references" |

### 2.3 Composition rules

1. **Workspace is always present.** Every ContextSnapshot must carry `workspace_id` + `organization_id`.
2. **Project is present when scoped work is active.** Workspace-global interactions (e.g., general chat) may omit `project_id`.
3. **Conversation is present for interactive flows.** Background/scheduled runs may not have a conversation.
4. **Run is present for governed execution.** Simple Q&A chat responses do not create a run.
5. **Artifact refs are present when the interaction targets domain objects.** Pure research or conversational answers may have zero artifact refs.

### 2.4 Resolution order

When assembling a ContextSnapshot, the resolver must follow this order:

1. Resolve Workspace (from session/shell state — always available).
2. Resolve Project (from explicit selection, active artifact, or conversation metadata).
3. Resolve Conversation (from active thread or create new).
4. Resolve Run (from execution orchestrator if governed work is triggered).
5. Resolve Artifact refs (from run plan, user selection, or conversation context).

If Project and Conversation disagree (e.g., conversation was started in Project A but user navigated to Project B), the **explicit current workspace/project state wins** and a new snapshot version is created (see §3 Drift model).

---

## 3. Drift model

### 3.1 What is drift

Drift occurs when the runtime context that was active at snapshot capture time no longer matches the current user state. This is explicitly called out as a gap in `AI_WORKSPACE_PROJECT_RUNTIME_ARCHITECTURE_V8.md` §4.1: "explicit rules for multi-tab and multi-surface drift when workspace state changes during a run."

### 3.2 Drift scenarios

| Scenario | Trigger | Risk | Required behavior |
|---|---|---|---|
| **Project switch mid-run** | User navigates to a different project while an execution run is active | Run proposals target wrong project scope | Run retains its originating snapshot; new interactions in the new project get a new snapshot. Run must not silently adopt the new project. |
| **Workspace switch mid-conversation** | User switches workspace context while conversation is open | Retrieval scope mismatch; knowledge from wrong org could leak | Conversation must be re-anchored or suspended. Retrieval must re-resolve scope from current workspace, not stale snapshot. |
| **Artifact removed mid-run** | Target artifact is deleted or archived while run is in progress | Proposals reference non-existent target | Run must detect stale `artifact_refs` before apply phase. Stale refs → run pauses with explicit error, not silent skip. |
| **Role change mid-run** | User's effective role changes (e.g., admin revokes project access) | Run may attempt mutations the user no longer has permission for | Approval gate must re-validate `resolved_role_ref` at apply time, not only at proposal time. |
| **Multi-tab divergence** | User has the same conversation open in two tabs with different project contexts | Ambiguous which project context is authoritative | The most recent explicit user action (tab focus + navigation) wins. Snapshot version increments on each context change. |

### 3.3 Staleness detection

Each ContextSnapshot carries `snapshot_version` and `captured_at`. Consumers must implement:

1. **Pre-apply revalidation.** Before executing any mutation, the execution layer must compare the run's originating snapshot against current resolved state. If `workspace_id`, `project_id`, or `resolved_role_ref` have changed, the run must pause and surface the drift to the user.
2. **Retrieval scope revalidation.** Before returning retrieval results, the knowledge layer must confirm that `effective_scope_ref` still matches the current workspace/project state. Stale scope → re-resolve before ranking.
3. **Artifact ref liveness check.** Before applying a proposal to an artifact, the execution layer must confirm the artifact still exists and is accessible under the current role.

### 3.4 Revalidation policy

| Consumer | When to revalidate | Action on drift |
|---|---|---|
| Chat | On each new turn if conversation has been idle > threshold | Re-resolve workspace/project; create new snapshot version |
| Execution | Before each apply step | Pause run; surface drift to user; require re-confirmation |
| Retrieval | On each retrieval request | Re-resolve scope; do not use cached scope from stale snapshot |
| Background/scheduled | At job start and at each checkpoint | Re-resolve full chain; abort if workspace/project no longer accessible |

---

## 4. Support-visible trace requirements

### 4.1 Design principle

From `AI_PERFECT_SYSTEM_CLOSURE_PROGRAM_V8.md` §6.2: "support can inspect active context for any important run." From `AI_WORKSPACE_PROJECT_RUNTIME_ARCHITECTURE_V8.md` §4.1: "support-visible trace fields showing workspace, project, conversation, run and artifact identities together."

### 4.2 Minimum trace fields for any important run

Support/operator must be able to inspect the following for any run flagged as important (governed execution, background job, or any run that produced a durable artifact mutation):

| Trace field | Description |
|---|---|
| `snapshot_id` | Which context snapshot was active |
| `snapshot_version` | Version at time of action (enables drift audit) |
| `workspace_id` + `organization_id` | Tenant and workspace identity |
| `project_id` | Project scope (or null if workspace-global) |
| `conversation_id` | Originating conversation (if interactive) |
| `execution_run_id` | Run identity |
| `initiator_user_id` | Who triggered the interaction |
| `consumer_class` | Which consumer type (chat/execution/retrieval/background/worker) |
| `resolved_role_ref` | Effective role at snapshot time |
| `effective_scope_ref` | Resolved retrieval/permission scope |
| `artifact_refs` | Which artifacts were in scope |
| `source_context_refs` | Which knowledge sources were used |
| `privacy_mode` | Whether private mode was active |
| `captured_at` | When the snapshot was taken |
| `drift_events[]` | Any revalidation events that occurred during the run |

### 4.3 Trace persistence

- Traces must be **persisted with the run record**, not only logged transiently.
- Traces must survive conversation deletion (the run's snapshot is its own record).
- Traces must be queryable by `organization_id`, `execution_run_id`, `conversation_id`, and `initiator_user_id`.

### 4.4 Trace access model

- **Support operators** can view traces for any run within the tenant they are supporting.
- **Superadmin** can view traces across tenants for platform-level diagnosis.
- **End users** can see a simplified version of their own run context (workspace, project, artifacts) but not internal resolution details.

---

## 5. Downstream dependency map

The context and identity baseline is the first P0 platform primitive. The following later packets and waves depend on this baseline being closed.

### 5.1 Direct Wave 1 dependencies

| Downstream packet/capability | Dependency on this baseline | Consequence if missing |
|---|---|---|
| **Governed retrieval (Wave 1 / Wave 2)** | Retrieval must receive `effective_scope_ref` + `organization_id` + `project_id` from the shared snapshot to enforce policy-first pre-filtering (`KNOWLEDGE_RAG_V8_SSOT.md` §8) | Retrieval builds its own local scope assembly; scope diverges from execution and chat |
| **Execution proposal/approval spine (Wave 1)** | `ExecutionAgentRun` must embed the originating ContextSnapshot so proposals are traceable to a resolved context (`AGENT_EXECUTION_V8_SSOT.md` §9.1) | Proposals cannot be audited against the context that produced them |
| **Tool governance and HITL (Wave 1 / Closure Wave 4)** | Tool policy evaluation needs `consumer_class`, `resolved_role_ref`, and `effective_scope_ref` from the snapshot | Tool governance builds a parallel permission model disconnected from runtime context |
| **Trust, audit and observability baseline (Wave 1)** | Support traces require the full identity chain from the snapshot (§4 above) | Support cannot reconstruct which context was active for a given run |

### 5.2 Wave 2+ dependencies

| Downstream capability | Dependency |
|---|---|
| **Multi-artifact execution** (`AI_PERFECT_SYSTEM_CLOSURE_PROGRAM_V8.md` §6.2 "blocks if missing") | Requires stable artifact-ref resolution within a versioned snapshot; without it, one run touching multiple artifacts cannot maintain coherent scope |
| **Background and scheduled agent runtime** (Closure Wave 3) | Background jobs must capture a ContextSnapshot at creation time and revalidate at checkpoints; without the snapshot model, background runs have no reconstructable context |
| **Output trust and provenance** (Closure Wave 6) | Trust traces must bind claims to the snapshot that produced them; without snapshot identity, provenance is disconnected from execution context |
| **Artifact lifecycle** (Closure Wave 7) | Artifact mutations must preserve the originating snapshot; without it, artifact provenance breaks at the collaboration boundary |
| **AI release bundles** (Closure Wave 5) | Release traces need to record which snapshot (and therefore which context) was active when a specific model/prompt/policy bundle was used |

### 5.3 Cross-consumer convergence

| Consumer | Current state (from canonical docs) | What changes with this baseline |
|---|---|---|
| Chat | Understands workspace context (`AI_WORKSPACE_PROJECT_RUNTIME_ARCHITECTURE_V8.md` §3) | Captures a formal ContextSnapshot per turn; shares the same object with execution and retrieval |
| Execution Agent | Run is a separate runtime (`AGENT_EXECUTION_V8_SSOT.md`) | Run embeds the originating ContextSnapshot; proposals and audit reference the snapshot |
| Knowledge RAG | Understands scope and ownership (`KNOWLEDGE_RAG_V8_SSOT.md` §3–4) | Receives `effective_scope_ref` from the shared snapshot instead of assembling scope independently |

---

## 6. Open questions and conflicts

### 6.1 Potential conflict: Conversation vs. Project authority on drift

- `AI_WORKSPACE_PROJECT_RUNTIME_ARCHITECTURE_V8.md` §4.1 calls for "explicit behavior when conversation context and project context disagree" but does not prescribe a resolution.
- `AGENT_EXECUTION_V8_SSOT.md` §12.3 says "if a run begins in one workspace context, the agent should preserve project context" — implying the **originating** context wins.
- `CHAT_V8_RUNTIME_TRUTH_MAP.md` §5.1 says the route model and conversation sync own the entry context — implying the **current navigation** state is authoritative.

**Analysis:** These are not strictly contradictory — the execution run should preserve its originating snapshot while the chat surface reflects current navigation. However, the exact UX behavior when a user is viewing a run that was started in a different project context is undefined.

**Recommendation:** This should be resolved as a product decision, not an engineering default. The drift model in §3 proposes "run retains originating snapshot; new interactions get new snapshot" but the user-facing messaging needs explicit design.

### 6.2 Undefined: Snapshot granularity for retrieval-only interactions

- `KNOWLEDGE_RAG_V8_SSOT.md` defines retrieval as a service consumed by chat, execution, and workers.
- `AI_WORKSPACE_PROJECT_RUNTIME_ARCHITECTURE_V8.md` defines the snapshot as attached to "conversations and runs."
- It is unclear whether a **standalone retrieval request** (not part of a conversation or run — e.g., a background indexing job) must also capture a full ContextSnapshot or can use a lighter-weight scope token.

**Recommendation:** Define a `RetrievalScopeToken` as a subset of ContextSnapshot for non-interactive retrieval. This avoids forcing the full identity chain onto batch/indexing operations while still carrying `organization_id`, `effective_scope_ref`, and `consumer_class`.

### 6.3 Undefined: Snapshot retention and lifecycle

- No canonical doc specifies how long ContextSnapshots should be retained.
- `AI_MEMORY_LIFECYCLE_ARCHITECTURE_V8.md` is referenced in the parity package but is a Wave 8 concern.
- For Wave 1, a minimum retention policy is needed: at least as long as the run record and its audit trail are retained.

**Recommendation:** Wave 1 should define a minimum retention rule: snapshots are retained as long as their associated run or conversation record exists. Full lifecycle policy deferred to Wave 8 memory hardening.

### 6.4 Undefined: ContextSnapshot for virtual workers

- `KNOWLEDGE_RAG_V8_SSOT.md` §9.4 defines worker safety rules (workers consume only org-safe assigned corpora).
- `AI_AGENTIC_SYSTEM_NEXT_PHASE_V8.md` §3 Phase A focuses on execution runs from chat, not worker-initiated runs.
- The `consumer_class` field in the snapshot model includes `worker`, but the canonical docs do not yet define how a worker's context is assembled (workers may not have a conversation or a user-initiated session).

**Recommendation:** For Wave 1, workers are out of scope for the full identity chain. Workers should use a `WorkerContextSnapshot` variant with `organization_id`, `worker_id`, `assigned_scope_ref`, and `consumer_class = worker`. Full worker context integration deferred to Phase E (Multi-Agent Work Manager).

### 6.5 No conflict detected between remaining docs

The following pairs were checked for conflicts and found consistent:
- `AI_PERFECT_SYSTEM_CLOSURE_PROGRAM_V8.md` §6.2 ↔ `AI_WORKSPACE_PROJECT_RUNTIME_ARCHITECTURE_V8.md` §4.1 (same requirements, different granularity)
- `AGENT_EXECUTION_V8_SSOT.md` §9.1 ↔ `AI_WORKSPACE_PROJECT_RUNTIME_ARCHITECTURE_V8.md` §4 (execution run fields are a subset of the snapshot)
- `V8_IMPLEMENTATION_MASTER_PROGRAM.md` §8.2 ↔ `AI_PERFECT_SYSTEM_CLOSURE_PROGRAM_V8.md` §6.2 (both list context spine as first Wave 1 deliverable)

---

## 7. Packet output

- **Status:** completed
- **Completed:**
  - Normalized ContextSnapshot object family with fields, composition rules, and versioning
  - Identity chain map (workspace → project → conversation → run → artifact) with ownership, resolution order, and composition rules
  - Drift model covering five scenarios with staleness detection and revalidation policy
  - Support-visible trace requirements with minimum fields, persistence rules, and access model
  - Downstream dependency map covering Wave 1 direct dependencies and Wave 2+ transitive dependencies
  - Open questions and conflict analysis (5 items identified)
- **Remaining:** none within packet scope
- **Blockers or risks:**
  - The conversation-vs-project drift resolution (§6.1) needs a product decision before implementation can finalize the UX behavior
  - Snapshot retention policy (§6.3) needs at minimum a Wave 1 default before the data model is implemented
- **Questions requiring escalation:**
  1. When a user navigates away from the project where a run was started, what should the chat surface show — the run's originating project context or the user's current navigation context? (§6.1)
  2. Should standalone retrieval requests (batch indexing, background enrichment) capture a full ContextSnapshot or a lighter RetrievalScopeToken? (§6.2)
  3. What is the minimum retention period for ContextSnapshots in Wave 1? (§6.3)
  4. Should virtual workers use the full ContextSnapshot model or a dedicated WorkerContextSnapshot variant? (§6.4)
