# WP-W1-AI-04 — Tool Governance and HITL Baseline Analysis

> Status: Completed
> Packet: WP-W1-AI-04
> Wave: 1 — Platform and governance spine
> Priority: P0
> Date: 2026-03-23
> Canonical inputs read:
> - `AI_AGENT_SECURITY_AND_TOOL_GOVERNANCE_V8.md` — canonical tool permission model
> - `AI_HUMAN_IN_THE_LOOP_GOVERNANCE_ARCHITECTURE_V8.md` — HITL governance architecture
> - `MCP_AND_REMOTE_TOOL_TRUST_MODEL_V8.md` — remote tool trust boundaries
> - `AGENT_EXECUTION_V8_SSOT.md` — execution lifecycle and governance
> - `AI_PERFECT_SYSTEM_CLOSURE_PROGRAM_V8.md` — §6.5 Wave 4 (tool governance closure)
> - `AI_AGENTIC_SYSTEM_NEXT_PHASE_V8.md` — §3 Phase C (governance, tools, HITL)
> - `EXECUTION_RUN_AND_PROPOSAL_SPINE_V8.md` — canonical spine objects and approval semantics
> - `work-packets/WP-W1-AI-03_EXECUTION_PROPOSAL_APPROVAL_SPINE.md` — approval model baseline
> - `work-packets/DECISION_LOG_WAVE_1.md` — binding decisions

---

## 1. Tool catalog model

### 1.1 Canonical tool declaration

Every tool exposed to any AI consumer must be registered in a canonical tool catalog. Per `AI_AGENT_SECURITY_AND_TOOL_GOVERNANCE_V8.md` §7, the platform must maintain "one canonical tool catalog with risk classes."

A tool declaration is the shared contract that describes what a tool does, what it can mutate, and under what conditions it may be invoked. No tool may be callable by any AI consumer unless it has a catalog entry.

### 1.2 `AIToolCapability` schema

Derived from `AI_AGENT_SECURITY_AND_TOOL_GOVERNANCE_V8.md` §4.1 minimum policy fields and §4 control objects:

| Field | Type | Required | Description |
|---|---|---|---|
| `tool_id` | string | yes | Unique identifier for the tool |
| `tool_name` | string | yes | Human-readable name |
| `description` | string | yes | What the tool does |
| `category` | enum | yes | Functional grouping (see §1.4) |
| `risk_class` | enum | yes | Risk classification (see §1.3) |
| `mutation_type` | enum | yes | `read_only` · `bounded_write` · `workflow_mutation` · `external_side_effect` · `sensitive_data_access` |
| `allowed_scope_types` | string[] | yes | Which scope types this tool may operate within (org, project, artifact, cross-project) |
| `egress_policy` | enum | yes | `none` · `internal_only` · `external_reviewed` · `external_unrestricted` |
| `result_sensitivity_class` | enum | yes | `public` · `internal` · `restricted` · `sensitive` |
| `supports_subagent_use` | boolean | yes | Whether subagents may invoke this tool |
| `requires_human_approval` | boolean | yes | Whether human approval is always required regardless of consumer class |
| `requires_policy_gate` | boolean | yes | Whether a policy gate must evaluate before invocation |
| `audit_trace_level` | enum | yes | `minimal` · `standard` · `full` |
| `trust_class` | enum | no | For remote/MCP tools: `internal_trusted` · `customer_trusted` · `external_reviewed` · `experimental` |
| `owner_module` | string | yes | Which module or service owns this tool |
| `version` | string | yes | Catalog version for release tracking |

### 1.3 Risk class taxonomy

The risk taxonomy merges `AI_AGENT_SECURITY_AND_TOOL_GOVERNANCE_V8.md` §4.1 (leader-grade hardening) with the action risk classes from `AGENT_EXECUTION_V8_SSOT.md` §10.3 and the proposal `risk_class` from WP-W1-AI-03 §2.1.

| Risk class | Definition | Examples | Default approval path |
|---|---|---|---|
| `read_only` | Tool retrieves or inspects data without any side effect | Search, list, get artifact, preview | `auto_executable` |
| `bounded_write` | Tool creates or modifies data within a single artifact scope; additive or safely reversible | Create draft note, add table field, update artifact metadata | `policy_approvable` |
| `workflow_mutation` | Tool changes governance state, workflow transitions, or accountability assignments | Move task to approved, change initiative status, assign owner | `requires_human_approval` |
| `external_side_effect` | Tool triggers an action outside the platform boundary (send email, push to external system, MCP remote write) | Sync to Jira, send notification, MCP remote mutation | `requires_human_approval` |
| `sensitive_data_access` | Tool reads or processes data classified as restricted or sensitive | Access financial records, read HR data, export PII-containing reports | `requires_human_approval` |

Mapping to WP-W1-AI-03 proposal `risk_class`:

| Tool risk class | Maps to proposal risk class |
|---|---|
| `read_only` | N/A (no proposal needed) |
| `bounded_write` | `safe_additive` or `safe_update` |
| `workflow_mutation` | `governance_transition` or `sensitive_update` |
| `external_side_effect` | `sensitive_update` or `destructive` |
| `sensitive_data_access` | `sensitive_update` |

### 1.4 Tool categories

| Category | Description |
|---|---|
| `retrieval` | Search, RAG, knowledge lookup, context assembly |
| `artifact_read` | Read artifact state, preview, diff |
| `artifact_write` | Create or modify artifacts |
| `workflow_action` | Governance transitions, approvals, assignments |
| `communication` | Notifications, messages, email |
| `external_integration` | MCP tools, connector actions, external API calls |
| `system_utility` | Internal helpers (formatting, calculation, preview generation) |

### 1.5 Scope and mutation rules

Per `AI_AGENT_SECURITY_AND_TOOL_GOVERNANCE_V8.md` §4:

- `mutation capability must never be inferred from mere connectivity` (also stated in `MCP_AND_REMOTE_TOOL_TRUST_MODEL_V8.md` §3).
- Every tool must declare whether it is `read_only` or mutating.
- Mutating tools must declare their mutation scope (single artifact, cross-artifact, cross-project, external).
- Tool output handling: sensitive tool results must not automatically become reusable prompt context (`AI_AGENT_SECURITY_AND_TOOL_GOVERNANCE_V8.md` §4.1).

---

## 2. Consumer class policy model

### 2.1 Consumer classes

Per `AI_AGENT_SECURITY_AND_TOOL_GOVERNANCE_V8.md` §4, the canonical permission chain is:

`identity → effective role → AI consumer class → allowed scopes → allowed tools → approval gates → execution audit`

The consumer class determines what category of AI runtime is invoking a tool. Each class has different trust levels and different default permissions.

| Consumer class | Description | Trust level |
|---|---|---|
| `chat` | Interactive chat session (Teresa, UnifiedChatPanel) — user is present and can approve in real time | High (user present) |
| `execution_run` | Governed execution agent run with full proposal/approval spine (WP-W1-AI-03) | High (governed by spine) |
| `background_job` | Non-interactive scheduled or triggered job (indexing, refresh, precomputation) | Medium (policy-governed, no real-time user) |
| `subagent_worker` | Delegated worker within a multi-agent run, operating under the lead agent's scope | Restricted (inherits, cannot exceed) |

### 2.2 `ConsumerToolPolicy` schema

| Field | Type | Required | Description |
|---|---|---|---|
| `policy_id` | string | yes | Unique identifier |
| `consumer_class` | enum | yes | Which consumer class this policy applies to |
| `tool_id` | string | yes | Which tool this policy governs |
| `allowed` | boolean | yes | Whether this consumer class may invoke this tool |
| `approval_override` | enum | no | `inherit_from_tool` · `force_human_approval` · `force_policy_gate` · `force_blocked` |
| `scope_restriction` | string[] | no | Additional scope restrictions beyond the tool's own `allowed_scope_types` |
| `max_invocations_per_run` | number | no | Rate limit per run (for cost/safety control) |
| `effective_from` | timestamp | yes | When this policy becomes active |
| `effective_until` | timestamp | no | When this policy expires (if temporary) |

### 2.3 Consumer class permission matrix

This matrix defines the default permission for each consumer class against each tool risk class. Org-level policy may tighten but never loosen these defaults.

| Tool risk class | `chat` | `execution_run` | `background_job` | `subagent_worker` |
|---|---|---|---|---|
| `read_only` | allowed | allowed | allowed | allowed |
| `bounded_write` | allowed (policy gate) | allowed (proposal spine) | allowed (policy gate, no real-time approval) | allowed only if lead agent's policy permits |
| `workflow_mutation` | allowed (human approval) | allowed (human approval via spine) | blocked by default | blocked by default |
| `external_side_effect` | allowed (human approval) | allowed (human approval via spine) | blocked by default | blocked by default |
| `sensitive_data_access` | allowed (human approval) | allowed (human approval via spine) | allowed (policy gate, scoped) | blocked by default |

### 2.4 Canonical rule

From `AI_AGENT_SECURITY_AND_TOOL_GOVERNANCE_V8.md` §4:

> No agent or worker may gain broader rights than the initiating user, active policy and consumer class jointly allow.

This means effective tool permissions are the intersection of:

1. The user's platform role and project permissions.
2. The consumer class policy for the tool.
3. The tool's own risk class and approval requirements.
4. Org-level policy overrides (if any).

---

## 3. Delegation contract for subagents

### 3.1 Delegation principles

Per `AI_AGENT_SECURITY_AND_TOOL_GOVERNANCE_V8.md` §4.1 and §5, and `AI_AGENTIC_SYSTEM_NEXT_PHASE_V8.md` §3 Phase C:

- Subagents operate within the scope of the lead agent's run.
- Subagents inherit the `ContextSnapshot` of the parent run (Decision 4: one `ContextSnapshot` family for Wave 1).
- Subagents cannot exceed the permissions of the initiating user or the lead agent's consumer class.
- Subagents cannot bypass the shared policy model.

### 3.2 `DelegationGuard` schema

| Field | Type | Required | Description |
|---|---|---|---|
| `delegation_id` | string | yes | Unique identifier |
| `parent_run_id` | string | yes | The lead agent's `execution_run_id` |
| `subagent_ref` | string | yes | Identifier of the delegated subagent |
| `delegated_scope` | object | yes | The scope subset delegated to the subagent |
| `allowed_tool_ids` | string[] | yes | Explicit list of tools the subagent may invoke |
| `denied_tool_ids` | string[] | no | Explicit deny list (takes precedence over allowed) |
| `max_mutation_class` | enum | yes | Maximum `risk_class` the subagent may invoke (`read_only` · `bounded_write`) |
| `credential_mode` | enum | yes | `no_credentials` · `scoped_temporary_grant` · `inherited_user_token` |
| `expires_at` | timestamp | yes | Delegation expiration (must not outlive the parent run) |
| `audit_trace_level` | enum | yes | `minimal` · `standard` · `full` |

### 3.3 Delegation rules

1. **Scope narrowing only.** A subagent's `delegated_scope` must be equal to or narrower than the parent run's `effective_scope_snapshot_ref`. Widening is forbidden.
2. **Tool allowlist is explicit.** Subagents do not inherit the full tool catalog. The lead agent (or orchestrator) must declare which tools the subagent may use.
3. **Mutation ceiling.** Per the consumer class matrix (§2.3), `subagent_worker` is blocked by default for `workflow_mutation`, `external_side_effect`, and `sensitive_data_access`. Exceptions require explicit org-level policy.
4. **Credential delegation.** Per `MCP_AND_REMOTE_TOOL_TRUST_MODEL_V8.md` §4, credential ownership must be tracked. Subagents should default to `scoped_temporary_grant` or `no_credentials`. Direct inheritance of user tokens requires explicit policy and audit.
5. **Lifetime bound.** Delegation expires when the parent run completes, fails, or is cancelled. A subagent cannot outlive its parent run.
6. **Re-planning within delegation.** Per Decision 14, if the lead agent re-plans, existing subagent delegations are invalidated. New delegations must be issued for the new plan version.
7. **Audit continuity.** All subagent tool invocations are recorded under the parent run's audit trail with the `delegation_id` attached.

### 3.4 What subagents cannot bypass

- The shared tool catalog and risk classification.
- The consumer class permission matrix.
- The approval spine (subagent work that produces proposals still goes through the WP-W1-AI-03 approval model).
- The `ContextSnapshot` identity chain.
- Org-level policy overrides.
- The audit trail.

---

## 4. Approval semantics

### 4.1 Unified approval states

This section normalizes the approval vocabulary across tool governance and the execution proposal spine (WP-W1-AI-03 §3.1). The goal is one shared set of terminal approval states used by all consumers.

| State | Semantics | Triggered by | Durability |
|---|---|---|---|
| `pending_review` | Tool invocation or proposal is awaiting a human or policy decision | System (when approval is required) | Durable; visible in UI and audit |
| `human-approved` | A human user explicitly approved the action | User (explicit approval) | Durable; records `resolved_by` (user ref), `resolved_at` |
| `policy-approved` | An automated policy rule approved the action without requiring human review | Policy engine | Durable; records `resolved_by` (policy ref), the policy rule that applied |
| `blocked` | The action was denied by policy, permission, or consumer class rules before reaching review | System (policy evaluation) | Durable; records `block_reason`, `blocking_policy_ref` |
| `expired` | The action remained in `pending_review` beyond the configured threshold without any decision | System (time-based) | Durable; treated as non-approval — the action cannot proceed |

### 4.2 Distinction from WP-W1-AI-03

WP-W1-AI-03 defines approval states for proposals within the execution spine. This packet extends the same vocabulary to tool invocations that occur outside the full proposal spine (e.g., a chat-surface tool call that does not go through a full `ExecutionAgentRun`).

The key unification:

- **Within an execution run:** Tool invocations that produce proposals use the WP-W1-AI-03 approval model. The tool's `risk_class` feeds into the proposal's `approval_class`.
- **Outside an execution run (chat, background):** Tool invocations are governed directly by the consumer class policy (§2) and the tool's own approval requirements. The same five approval states apply.
- **In both cases:** Support can distinguish `human-approved` from `policy-approved` from `blocked` from `expired`.

### 4.3 `blocked` vs `rejected`

- `blocked` is a system-level denial: the tool call never reached a human reviewer because policy, permissions, or consumer class rules prevented it.
- `rejected` (from WP-W1-AI-03) is a human-level denial: a reviewer saw the proposal and explicitly said no.
- Both are durable and auditable. Neither disappears from the trail.

### 4.4 Expiration semantics

Per Decision 13, the default expiration threshold for `waiting_for_review` is `72h`. This applies to both:

- Execution run proposals (WP-W1-AI-03 scope).
- Standalone tool invocation approvals (this packet's scope).

After expiration, the action transitions to `expired`. The run or tool context is not auto-cancelled; it remains resumable or re-plannable depending on policy.

### 4.5 Batch approval (Decision 15 compliance)

Per Decision 15:

- Default review mode is `mixed`.
- Reviewer may reject or accept items individually within a batch.
- System may offer `approve all / reject all` as a UX shortcut, not as a canonical model constraint.

For tool governance specifically:

- A batch of tool invocations (e.g., a multi-step plan where several tools need approval) uses the same `mixed` mode.
- Each tool invocation within the batch carries its own `risk_class` and `approval_class`.
- High-risk tool invocations (`workflow_mutation`, `external_side_effect`, `sensitive_data_access`) require individual review even within a batch.
- Low-risk tool invocations (`read_only`, `bounded_write`) may be batched for approval.

### 4.6 Re-planning and approval (Decision 14 compliance)

Per Decision 14:

- Re-planning creates a new plan version within the same run.
- When a plan is re-planned, all pending tool approvals from the previous plan version are invalidated.
- The new plan version generates fresh tool invocation requests with fresh approval requirements.
- The invalidated approvals are preserved in the audit trail with status `superseded_by_replan`.

---

## 5. MCP and remote tool trust boundaries

### 5.1 Trust class model

Per `MCP_AND_REMOTE_TOOL_TRUST_MODEL_V8.md` §2, every remote tool provider is classified:

| Trust class | Definition | Default capability ceiling |
|---|---|---|
| `internal_trusted` | Platform-owned tools and services | Full capability per consumer class policy |
| `customer_trusted` | Customer-deployed MCP servers within the customer's own infrastructure | `write_with_confirmation` — mutations require explicit approval |
| `external_reviewed` | Third-party tools that have passed a platform review process | `write_with_policy` — mutations allowed only under explicit policy |
| `experimental` | Unreviewed or newly added tools | `read_only` — no mutations allowed; `autonomous_mutation_forbidden` |

### 5.2 Remote tool capability classes

Per `MCP_AND_REMOTE_TOOL_TRUST_MODEL_V8.md` §3:

| Capability class | Semantics |
|---|---|
| `read_only` | Tool may only retrieve data; no side effects |
| `write_with_confirmation` | Tool may mutate, but every mutation requires explicit human confirmation |
| `write_with_policy` | Tool may mutate under policy rules without per-invocation human confirmation |
| `autonomous_mutation_forbidden` | Tool is explicitly barred from any mutation regardless of other policy |

### 5.3 Credential delegation for remote tools

Per `MCP_AND_REMOTE_TOOL_TRUST_MODEL_V8.md` §4, credential ownership must be tracked:

| Credential owner | Visibility | Rotation | Revoke semantics |
|---|---|---|---|
| `superadmin-owned` | Visible to superadmin only | Platform-managed rotation | Superadmin revoke; cascades to all consumers |
| `org-owned` | Visible to org admins | Org-managed rotation | Org admin revoke; cascades to org consumers |
| `user-owned` | Visible to owning user only | User-managed rotation | User revoke; affects only that user's tool access |
| `ephemeral_delegated` | Not directly visible; scoped to a run or session | Auto-expires with delegation | Auto-revoked when delegation expires |

Delegation rules for remote tools:

1. Subagents default to `ephemeral_delegated` credentials scoped to the parent run.
2. Subagents may not receive `superadmin-owned` or `org-owned` credentials directly.
3. If a remote tool requires `user-owned` credentials and the subagent does not have delegation, the tool call is `blocked` with reason `credential_delegation_not_available`.

### 5.4 Remote mutation policy

Per `MCP_AND_REMOTE_TOOL_TRUST_MODEL_V8.md` §6:

> Remote mutation through MCP or external tools should default to: `propose → review → approve → execute`. Exceptions require explicit policy.

This maps directly onto the approval spine:

- Remote tool mutations generate proposals within the execution spine (if inside a run) or standalone approval requests (if in chat).
- The proposal's `risk_class` is at minimum `external_side_effect`.
- The tool's `trust_class` further constrains: `experimental` tools are always `blocked` for mutations; `customer_trusted` tools require `human-approved`; `external_reviewed` tools may be `policy-approved` if org policy allows.

### 5.5 MCP tool allowlist doctrine

Per `MCP_AND_REMOTE_TOOL_TRUST_MODEL_V8.md` §5, each MCP installation must define:

- `allowed_tools[]` — explicit allowlist of tool IDs.
- `denied_tools[]` — explicit denylist (takes precedence).
- `module_access_scope` — which modules the MCP server may interact with.
- `environment_scope` — which environments (production, staging, sandbox) the tools are active in.

These allowlists are evaluated before the consumer class policy. A tool not on the allowlist is `blocked` regardless of consumer class or risk class.

---

## 6. Support-visible permission explanation

### 6.1 Requirement

Per `AI_AGENT_SECURITY_AND_TOOL_GOVERNANCE_V8.md` §6 and §8:

> Support can reconstruct why a tool call was allowed, blocked or escalated.

This is a hard acceptance criterion for the tool governance model.

### 6.2 `ToolInvocationTrace` schema

Every tool invocation (allowed or denied) must produce a trace record:

| Field | Type | Required | Description |
|---|---|---|---|
| `trace_id` | string | yes | Unique identifier |
| `tool_id` | string | yes | Which tool was invoked or attempted |
| `consumer_class` | enum | yes | Which consumer class initiated the call |
| `execution_run_id` | string | no | Parent run, if applicable |
| `delegation_id` | string | no | Delegation guard, if subagent |
| `initiating_user_ref` | string | yes | The user whose identity chain governs the call |
| `effective_role_ref` | string | yes | The resolved role at invocation time |
| `context_snapshot_ref` | string | yes | The ContextSnapshot active at invocation time |
| `tool_risk_class` | enum | yes | The tool's risk class at invocation time |
| `consumer_policy_ref` | string | yes | Which consumer policy was evaluated |
| `approval_state` | enum | yes | `human-approved` · `policy-approved` · `blocked` · `expired` · `auto_executed` |
| `block_reason` | string | no | If blocked: specific reason (permission, policy, consumer class, credential, allowlist) |
| `blocking_policy_ref` | string | no | If blocked: which policy rule caused the block |
| `approval_ref` | string | no | If approved: reference to the approval record |
| `invocation_result` | enum | yes | `success` · `failed` · `not_executed` (if blocked or expired) |
| `timestamp` | timestamp | yes | When the invocation occurred |

### 6.3 Permission explanation path

When support investigates a tool invocation, the trace must answer these questions in order:

1. **Who?** `initiating_user_ref` → `effective_role_ref` → what permissions does this user have?
2. **What?** `tool_id` → `tool_risk_class` → what does this tool do and how risky is it?
3. **Where?** `context_snapshot_ref` → in what workspace/project/scope was this attempted?
4. **Which consumer?** `consumer_class` → what type of AI runtime initiated this?
5. **What policy applied?** `consumer_policy_ref` → what were the rules for this consumer + tool combination?
6. **What was the outcome?** `approval_state` → was it approved, blocked, or expired?
7. **Why?** `block_reason` + `blocking_policy_ref` (if denied) or `approval_ref` (if approved) → the specific reason.

### 6.4 Denial explanation for end users

End users should see a simplified explanation when a tool call is blocked:

- "This action requires approval from [role]. You can request approval."
- "This action is not available for your current role in this project."
- "This tool is not enabled for this workspace."
- "This action requires credentials that are not configured."

The full trace (§6.2) is available to support and superadmin. End users see the simplified message.

---

## 7. Downstream dependency map

### 7.1 What this packet provides to downstream work

| Downstream packet/capability | What this packet provides | Consequence if missing |
|---|---|---|
| **Phase C — Governance operationally** (`AI_AGENTIC_SYSTEM_NEXT_PHASE_V8.md` §3 Phase C) | The tool catalog model, consumer class policy, and delegation contract are the shared contracts Phase C must implement. | Phase C builds tool governance without a normalized model; consumer classes diverge |
| **Phase E — Multi-Agent Work Manager** (`AI_AGENTIC_SYSTEM_NEXT_PHASE_V8.md` §3 Phase E) | The delegation guard (§3) defines what subagents inherit and what they cannot bypass. Multi-agent must use this contract. | Multi-agent work invents its own delegation model disconnected from tool governance |
| **Background and scheduled runtime** (Closure Wave 3) | Background jobs use `background_job` consumer class with the permission matrix from §2.3. | Background jobs have undefined tool permissions |
| **MCP integration expansion** | The MCP trust model (§5) defines allowlist doctrine and remote mutation policy. Any new MCP server must comply. | New MCP integrations bypass trust boundaries |
| **Output trust and provenance** (Closure Wave 6) | The `ToolInvocationTrace` (§6.2) provides the tool-level provenance chain. Trust traces bind to the same `context_snapshot_ref`. | Trust traces cannot explain tool-level decisions |
| **AI Operations and Release** (Closure Wave 5) | Tool catalog versioning enables release bundles to include tool policy changes alongside model and prompt changes. | Tool policy changes ship outside the governed release process |
| **Support and operator surfaces** | The permission explanation path (§6.3) defines what support needs to see. Operator UIs must surface `ToolInvocationTrace`. | Support cannot explain tool denials or approvals |

### 7.2 What this packet depends on

| Upstream dependency | What it provides | Status |
|---|---|---|
| **WP-W1-AI-01 — ContextSnapshot baseline** | `ContextSnapshot` object model, identity chain, scope resolution | Completed |
| **WP-W1-AI-03 — Execution proposal/approval spine** | `risk_class` and `approval_class` enums, approval states, batch approval model, drift handling | Completed |
| **DECISION_LOG_WAVE_1.md** — Decisions 1, 4, 14, 15 | Drift handling (D1), single snapshot family (D4), re-planning semantics (D14), mixed-mode batch approval (D15) | Ratified |
| **AI_AGENT_SECURITY_AND_TOOL_GOVERNANCE_V8.md** | Canonical permission chain, control objects, acceptance criteria | Canonical |
| **AI_HUMAN_IN_THE_LOOP_GOVERNANCE_ARCHITECTURE_V8.md** | Approval doctrine, risk-to-review mapping, batch approval direction | Canonical |
| **MCP_AND_REMOTE_TOOL_TRUST_MODEL_V8.md** | Trust classes, capability classes, credential ownership, allowlist doctrine | Canonical |
| **EXECUTION_RUN_AND_PROPOSAL_SPINE_V8.md** | Spine objects, approval semantics, adapter contract | Canonical |

---

## 8. Open questions and conflicts

### 8.1 Tool catalog population strategy undefined

The canonical docs define the catalog model but no doc specifies how the initial catalog is populated:

- Is the catalog manually curated by engineering, or auto-discovered from registered services?
- Who is responsible for assigning `risk_class` to each tool — the tool owner, a security reviewer, or both?
- Is there a review/approval process for adding new tools to the catalog?

**Recommendation:** Define a tool registration workflow where the tool owner proposes a catalog entry (including self-assessed `risk_class`), and a security/governance reviewer validates the classification before the tool becomes available to AI consumers. This is a process decision, not a schema decision.

### 8.2 Policy override hierarchy undefined

The consumer class policy model (§2) allows org-level overrides, but the canonical docs do not define the full override hierarchy:

- Can a project-level admin tighten tool permissions beyond the org level?
- Can a superadmin loosen permissions that the org admin has tightened?
- What is the precedence order: platform default → org policy → project policy → run-level override?

**Recommendation:** Adopt the precedence order `platform default → org policy → project policy` where each level can only tighten, never loosen. Run-level overrides should not exist in Wave 1 to avoid complexity. Superadmin can override at the org level but should not bypass project-level restrictions without explicit audit.

### 8.3 Subagent credential delegation model needs engineering validation

The delegation contract (§3) specifies `scoped_temporary_grant` as the default credential mode for subagents. However, the engineering feasibility of scoped temporary grants depends on the credential infrastructure:

- Can the platform issue time-bounded, scope-bounded credential tokens today?
- If not, the fallback is `no_credentials` (subagents can only invoke tools that do not require credentials), which significantly limits subagent utility.

**Recommendation:** Engineering should validate whether scoped temporary grants are feasible for Wave 1. If not, document the limitation and plan credential infrastructure as a prerequisite for broader subagent tool access.

### 8.4 `background_job` approval path for mutations

The consumer class matrix (§2.3) blocks `workflow_mutation` and `external_side_effect` for `background_job` by default. However, some background jobs may legitimately need to perform bounded mutations (e.g., scheduled report generation that creates artifacts).

- Should there be a `background_job_elevated` consumer class for pre-approved background mutations?
- Or should background jobs that need mutations go through a deferred approval queue?

**Recommendation:** Background jobs that need mutations should use a deferred approval queue: the job proposes the mutation, the proposal enters `pending_review`, and a human approves it asynchronously. This preserves the HITL principle without blocking background work entirely. A dedicated elevated consumer class is deferred to post-Wave 1.

### 8.5 No conflicts detected between canonical docs

The following pairs were checked for conflicts and found consistent:

- `AI_AGENT_SECURITY_AND_TOOL_GOVERNANCE_V8.md` §4 permission chain ↔ `AGENT_EXECUTION_V8_SSOT.md` §14 governance: Both define the same principle that AI cannot bypass governance. The tool governance model (this packet) is the shared implementation of that principle.
- `AI_HUMAN_IN_THE_LOOP_GOVERNANCE_ARCHITECTURE_V8.md` §4 approval chain ↔ `MCP_AND_REMOTE_TOOL_TRUST_MODEL_V8.md` §6 remote mutation default: Both converge on `propose → review → approve → execute` as the default for mutations. No contradiction.
- `AI_AGENT_SECURITY_AND_TOOL_GOVERNANCE_V8.md` §4.1 delegation policy ↔ `AI_AGENTIC_SYSTEM_NEXT_PHASE_V8.md` §3 Phase C: Both identify tool catalog + consumer class + delegation as Phase C deliverables. This packet provides the normalized model.
- Decision 4 (one `ContextSnapshot` family) ↔ delegation contract (§3): Subagents inherit the parent run's `ContextSnapshot` from the single family. No separate snapshot model needed.
- Decision 15 (mixed-mode batch approval) ↔ tool batch approval (§4.5): Tool governance adopts the same mixed-mode default. No contradiction.

---

## 9. Packet output

- **Status:** completed
- **Completed:**
  - Canonical tool catalog model with `AIToolCapability` schema, `risk_class` taxonomy (5 levels), `mutation_type` classification, and tool categories
  - Consumer class policy model with 4 consumer classes (`chat`, `execution_run`, `background_job`, `subagent_worker`), `ConsumerToolPolicy` schema, and default permission matrix
  - Delegation contract for subagents with `DelegationGuard` schema, 7 delegation rules, scope narrowing principle, credential delegation modes, and lifetime binding
  - Unified approval semantics with 5 states (`pending_review`, `human-approved`, `policy-approved`, `blocked`, `expired`), unified with WP-W1-AI-03, with `blocked` vs `rejected` distinction, expiration semantics (Decision 13: 72h), batch approval (Decision 15: mixed mode), and re-planning invalidation (Decision 14)
  - MCP and remote tool trust boundaries with trust class model (4 levels), capability classes, credential delegation rules, remote mutation policy, and allowlist doctrine
  - Support-visible permission explanation with `ToolInvocationTrace` schema, 7-step explanation path, and simplified end-user denial messages
  - Downstream dependency map covering Phase C, Phase E, background runtime, MCP expansion, output trust, AI operations, and support surfaces
- **Remaining:** none within packet scope
- **Blockers or risks:**
  - Tool catalog population strategy needs a process decision (§8.1)
  - Policy override hierarchy needs product decision on precedence order (§8.2)
  - Subagent credential delegation feasibility needs engineering validation (§8.3)
  - Background job mutation approval path needs product decision (§8.4)
- **Questions requiring escalation:**
  1. Who is responsible for assigning and validating `risk_class` on new tools — tool owner, security reviewer, or both? What is the registration workflow? (§8.1)
  2. Can project-level admins tighten tool permissions beyond org level? What is the full precedence order? (§8.2)
  3. Can the platform issue scoped temporary credential tokens for subagent delegation in Wave 1? (§8.3)
  4. Should background jobs that need mutations use a deferred approval queue, or should there be an elevated consumer class? (§8.4)
