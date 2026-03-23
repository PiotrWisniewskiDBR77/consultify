# WP-W2-AI-01 — Chat → Execution Integration Proof

> Status: Completed
> Packet: WP-W2-AI-01
> Wave: 2 — Cross-surface integration proofs
> Priority: P0
> Date: 2026-03-23
> Canonical inputs read:
> - `CHAT_V8_RUNTIME_TRUTH_MAP.md` — canonical chat runtime surfaces and capabilities
> - `CHAT_V8_SSOT.md` — chat product definition, domain model, product path
> - `AGENT_EXECUTION_V8_SSOT.md` — execution agent concept, domain model, lifecycle
> - `AGENT_EXECUTION_V8_IMPLEMENTATION_PLAN.md` — execution build plan and workstreams
> - `AI_AGENTIC_SYSTEM_NEXT_PHASE_V8.md` — Phase A (runtime spine) and Phase B (adapters)
> - `work-packets/WP-W1-AI-01_CONTEXT_IDENTITY_BASELINE.md` — ContextSnapshot family
> - `work-packets/WP-W1-AI-03_EXECUTION_PROPOSAL_APPROVAL_SPINE.md` — run lifecycle, proposal schema, approval model
> - `work-packets/WP-W1-AI-04_TOOL_GOVERNANCE_HITL_BASELINE.md` — tool catalog, consumer classes, HITL
> - `work-packets/DECISION_LOG_WAVE_1.md` — 26 binding decisions

---

## 1. Chat intake → run creation flow

### 1.1 The integration boundary

Chat and Execution Agent share one user-visible surface but serve different product promises. Chat owns the conversational thread (`CHAT_V8_SSOT.md` §4.1: "one canonical shell"). Execution Agent owns governed work (`AGENT_EXECUTION_V8_SSOT.md` §4.1: "chat starts the run, but chat is not the whole system"). The integration proof must show how one transitions into the other without duplicating runtime, violating governance, or confusing the user.

### 1.2 Trigger classification

Not every chat message creates an execution run. The canonical product path (`CHAT_V8_SSOT.md` §5) is:

`entry → select or create conversation → understand scope/modes → ask → stream → inspect → refine → act/save → revisit`

A run is created only when the user's intent crosses from **conversational** (ask, research, inspect) into **work-producing** (create artifact, modify artifact, execute multi-step task). The execution SSOT (`AGENT_EXECUTION_V8_SSOT.md` §7.1) defines the trigger:

> User writes a goal, a work request, a change request, or a broad business task.

This means the system must classify intent before creating a run. The classification boundary:

| Intent class | Example | Creates run? | Runtime owner |
|---|---|---|---|
| Conversational Q&A | "What is the status of initiative X?" | No | Chat stream (`useAIStream`) |
| Research / deep research | "Research market trends for Q3" | No (may use deep research confirm flow) | Chat stream with confirm gate |
| Single lightweight action | "Rename this note to X" | No (may use inline chat action) | Chat action path (`ChatActionProposal`) |
| Governed work request | "Build a deck from this note and add risk slides" | **Yes** | Execution orchestrator |
| Multi-step task | "Create an initiative, break it into tasks, assign owners" | **Yes** | Execution orchestrator |

### 1.3 Run creation sequence

When the system classifies intent as a governed work request, the following sequence fires:

```
1. Chat intake (UnifiedChatPanel / EnhancedChatInput)
   └── User sends message with work intent

2. Intent classifier (server-side, within AI pipeline)
   └── Determines: conversational vs work-producing
   └── If work-producing → trigger run creation

3. ContextSnapshot capture (per WP-W1-AI-01 §1.3 rule 1)
   └── Captures: workspace_id, organization_id, project_id,
       conversation_id, artifact_refs, effective_scope_ref,
       resolved_role_ref, initiator_user_id
   └── consumer_class = 'execution'

4. ExecutionAgentRun creation (per WP-W1-AI-03 §1.2)
   └── State: 'drafting'
   └── Embeds: originating ContextSnapshot
   └── Links: conversation_id (back-reference to chat thread)

5. Planning phase (automatic)
   └── Agent decomposes intent into ExecutionPlan with steps
   └── State: 'planning' → 'proposals_ready'

6. Proposal presentation in chat (§3 below)
   └── State: 'waiting_for_review'
   └── Proposals surface in the conversation thread
```

### 1.4 Decision compliance

- **Decision 1:** The run preserves `originating project context` from the ContextSnapshot captured at step 3. If the user navigates away during planning, the chat surface labels the drift but the run does not silently rebind.
- **Decision 4:** One `ContextSnapshot` family — the same object serves chat, execution, and retrieval. No separate execution context model.
- **Decision 5:** During run creation and planning, the AI is visible as `ai_agent` in the conversation. Background planning that does not produce room-visible output does not show AI presence.

### 1.5 Boundary between chat actions and execution runs

`CHAT_V8_SSOT.md` §6.4 defines `ChatActionProposal` with fields `actionId`, `targetType`, `proposalType`, `status`, `approvalState`. `AGENT_EXECUTION_V8_SSOT.md` §9.4 defines `ActionProposal` with a richer schema including `risk_class`, `approval_class`, `mutation_description`, and `preview_payload`.

These are **not two competing systems**. They represent two levels of the same governance spine:

| Dimension | ChatActionProposal | ExecutionAgentRun + ActionProposal |
|---|---|---|
| Scope | Single, lightweight, inline action | Multi-step, governed, cross-artifact work |
| Lifecycle | `proposed → pending_review → approved/rejected → executed` | Full run lifecycle (WP-W1-AI-03 §1.1) |
| Approval | Inline in chat thread | Full approval spine with risk classification |
| Audit | Conversation-level | Run-level with per-proposal and per-apply records |

For Wave 2, the integration contract is: **ChatActionProposal is a thin wrapper** that either resolves inline (for lightweight actions) or escalates to a full `ExecutionAgentRun` (for governed work). The escalation path is: chat action detects that the work exceeds inline scope → creates an `ExecutionAgentRun` → the run takes over governance.

---

## 2. ContextSnapshot handoff

### 2.1 Handoff mechanics

The ContextSnapshot is the shared data contract between chat and execution (WP-W1-AI-01 §1.3 rule 3: "snapshots compose upward — an ExecutionRunContext snapshot embeds the ConversationContext snapshot that initiated it").

The handoff sequence:

```
Chat turn begins
  └── ContextSnapshot captured (consumer_class = 'chat')
      ├── workspace_id, organization_id, project_id
      ├── conversation_id
      ├── artifact_refs (from workspace/selection context)
      ├── effective_scope_ref
      └── resolved_role_ref

Intent classified as work-producing
  └── New ContextSnapshot captured (consumer_class = 'execution')
      ├── Inherits: workspace_id, organization_id, project_id,
      │   conversation_id, effective_scope_ref, resolved_role_ref
      ├── Adds: execution_run_id
      ├── Refines: artifact_refs (from intent decomposition)
      └── snapshot_version increments
```

### 2.2 What the execution run inherits from chat

| Field | Source | Rule |
|---|---|---|
| `workspace_id` | Chat session shell state | Always present (WP-W1-AI-01 §2.3 rule 1) |
| `organization_id` | Chat session shell state | Always present; mandatory for tenant isolation |
| `project_id` | Chat conversation metadata or active project | Present when scoped work is active; null for workspace-global |
| `conversation_id` | Active conversation thread | Present; links run back to originating chat |
| `effective_scope_ref` | Resolved from workspace + project state | Determines retrieval scope and permission boundaries for the run |
| `resolved_role_ref` | User's effective role at snapshot time | Determines what the run may propose and execute |
| `artifact_refs` | From conversation context + intent decomposition | Zero or more; refined during planning |
| `source_context_refs` | From conversation attachments + retrieval context | Knowledge sources assembled during the chat turn |
| `privacy_mode` | From conversation/session settings | Inherited; run respects private mode constraints |

### 2.3 What the execution run does NOT inherit

- **Message history.** The run does not carry the full conversation transcript. It carries the `conversation_id` as a back-reference. If the planning phase needs conversational context, it retrieves it through the conversation API, not through snapshot embedding.
- **Chat UI state.** Panel layout, sidebar state, input state — these are chat-surface concerns, not execution concerns.
- **Stale scope.** If the chat session's scope has drifted since the last snapshot, the execution snapshot captures the **current resolved state**, not the stale chat snapshot (WP-W1-AI-01 §3.4: execution revalidates before each apply step).

### 2.4 Snapshot immutability contract

Per WP-W1-AI-01 §1.3 rule 2: "Snapshots are immutable after capture." Once the execution run's originating snapshot is captured, it does not change. If context drifts, a new snapshot version is created — the old one is preserved for audit. This is the foundation of Decision 1 compliance: the run always knows where it started.

---

## 3. Proposal presentation in chat

### 3.1 The rendering contract

When the execution run reaches `proposals_ready` → `waiting_for_review`, the proposals must surface in the originating conversation thread. This is the critical UX integration point: the user asked a question in chat and now sees a structured work proposal in the same thread.

### 3.2 Proposal message structure

The chat runtime (`CHAT_V8_SSOT.md` §6.3) defines `ConversationMessage` with fields including `messageType`, `metadata`, `artifacts`, `actions`. The execution proposal surfaces as a special message type within this model:

| Message field | Value for proposal presentation |
|---|---|
| `role` | `assistant` |
| `messageType` | `execution_proposal` (new type within chat message taxonomy) |
| `content` | Human-readable summary of the plan and proposals |
| `metadata.execution_run_id` | Back-reference to the run |
| `metadata.plan_summary` | Goal, step count, estimated impact |
| `metadata.proposal_set_ref` | Reference to the `ProposalSet` |
| `actions` | Approval affordances (approve, reject, refine per proposal) |

### 3.3 What the user sees

For each proposal in the set, the chat thread renders:

1. **Plan overview:** Goal summary, number of steps, estimated scope.
2. **Per-proposal card:** Summary, target artifact, risk class badge, preview (if available).
3. **Approval controls:** Per Decision 15 (mixed-mode batch approval), the user sees:
   - Individual approve/reject per proposal.
   - Batch "approve all" / "reject all" as UX shortcuts.
   - "Refine" option to request re-planning (Decision 14: new plan version within same run).
4. **Context label:** Which project/workspace the run is bound to (Decision 1 compliance — if user has navigated away, show drift label).

### 3.4 Preview rendering

Per `AGENT_EXECUTION_V8_SSOT.md` §9.5 (`ActionPreview`), proposals may include diffs, before/after states, created objects, and impact descriptions. The chat rendering contract must support:

- **Inline diff view** for field-level changes.
- **Created object preview** for new artifacts.
- **Impact callout** for destructive or governance-transition proposals.
- **Collapsed detail** for low-risk additive proposals (expandable on demand).

The chat response model (`CHAT_V8_SSOT.md` §10.2) already defines `proposal response` and `action-carrying response` as canonical response classes. The execution proposal rendering is the concrete implementation of these classes.

### 3.5 Proposal expiration visibility

Per Decision 13: review expiration = 72h. The chat surface must show:

- Time remaining before expiration.
- Visual degradation as expiration approaches (e.g., warning badge after 48h).
- Clear state transition when expired: proposals become non-actionable, run transitions to `expired`.

---

## 4. Approval flow within chat UX

### 4.1 Approval entry points

The user approves or rejects proposals directly within the conversation thread. The approval flow maps the WP-W1-AI-03 approval model (§3) onto chat UX affordances:

| User action | System behavior | Run state transition |
|---|---|---|
| Approve individual proposal | Proposal status → `human-approved`; `resolved_by` = user ref | If all required approvals met → `approved_for_apply` |
| Reject individual proposal | Proposal status → `rejected`; reason captured | Run remains in `waiting_for_review` for remaining proposals |
| Approve all (batch) | All proposals → `human-approved` | → `approved_for_apply` |
| Reject all (batch) | All proposals → `rejected` | → `rejected` |
| Request refinement | Run transitions back to `planning`; new plan version created (Decision 14) | `waiting_for_review` → `planning` |
| No action within 72h | All pending proposals → `expired` (Decision 13) | → `expired` |

### 4.2 Partial approval UX

Per Decision 15 (mixed-mode batch approval), the user may approve some proposals and reject others within a single set. The chat UX must:

1. Show each proposal's approval state independently.
2. Allow the user to confirm "proceed with approved proposals" after partial selection.
3. Show which proposals will be executed and which will be skipped.
4. Preserve rejected proposals in the thread for audit (they do not disappear).

### 4.3 Approval state persistence

Approval decisions are **durable** (WP-W1-AI-03 §3.1). They are persisted in the execution run record, not only in the chat message. This means:

- If the user closes the chat panel and reopens, the approval state is preserved.
- If the user revisits the conversation later, the run's approval state is visible.
- Support can inspect the approval chain independently of the conversation.

### 4.4 Policy-approved vs human-approved visibility

Per WP-W1-AI-03 §3.6 and WP-W1-AI-04 §4.2, the chat UX must visually distinguish:

- **Human-approved:** Explicit user action; shown with user attribution.
- **Policy-approved:** Automatic policy resolution; shown with policy badge and rule reference.
- **Blocked:** System-level denial; shown with explanation (WP-W1-AI-04 §6.4).

The user must never be confused about whether they approved something or the system did.

### 4.5 Approval within split mode

`CHAT_V8_SSOT.md` §4.7 defines split mode as a product advantage. When the user is in split mode (chat panel alongside workspace), the approval flow has an additional UX opportunity:

- The workspace panel can show the target artifact alongside the proposal preview.
- The user can inspect the artifact's current state while reviewing the proposal.
- Approval in split mode does not change the governance contract — the same spine applies.

---

## 5. Partial progress visibility

### 5.1 Progress states visible in chat

Once a run transitions to `applying`, the user must see progress in the conversation thread. The execution lifecycle (`WP-W1-AI-03 §1.2`) defines granular states. The chat surface maps these to user-visible progress:

| Run state | Chat visibility |
|---|---|
| `drafting` | "Understanding your request..." |
| `planning` | "Building execution plan..." |
| `proposals_ready` | Plan and proposals rendered in thread (§3) |
| `waiting_for_review` | Approval controls active; timer visible (Decision 13) |
| `approved_for_apply` | "Executing approved changes..." |
| `applying` | Per-step progress indicators |
| `completed` | Result summary with links to created/modified artifacts |
| `failed` | Error summary with what succeeded and what failed |
| `cancelled` | Cancellation confirmation |
| `expired` | Expiration notice with option to re-initiate |

### 5.2 Per-step progress

During `applying`, the chat thread shows:

- Total steps and current step number.
- Per-step status: pending, in progress, completed, failed, blocked.
- For completed steps: brief result (e.g., "Note created: [link]").
- For failed steps: error summary and whether downstream steps are blocked.

This maps to `ExecutionStep.status` from `AGENT_EXECUTION_V8_SSOT.md` §9.3.

### 5.3 Background execution visibility

Per Decision 22 (background jobs = deferred approval queue) and Decision 5 (AI visible as `ai_agent` only for room-visible work):

- If the execution run is performing background work (e.g., generating content, assembling data), the chat thread shows a lightweight progress indicator without flooding the conversation with internal steps.
- Background steps that produce proposals requiring approval surface those proposals in the chat thread (deferred approval queue pattern).
- The AI presence indicator shows `ai_agent` is active only while the run is producing visible output.

### 5.4 Run summary on completion

When the run reaches `completed` or `failed`, the chat thread renders a summary message:

| Summary field | Content |
|---|---|
| Goal | What the user asked for |
| Outcome | Completed / partially completed / failed |
| Created artifacts | Links to new artifacts |
| Modified artifacts | Links to changed artifacts with change summary |
| Failed steps | What went wrong and why |
| Follow-up options | "Continue working", "Start new task", "View run details" |

---

## 6. Error, drift and degraded-state handling

### 6.1 Error taxonomy at the chat-execution boundary

The integration boundary introduces failure modes that neither pure chat nor pure execution handles alone:

| Error class | Trigger | Chat-side behavior | Execution-side behavior |
|---|---|---|---|
| **Intent classification failure** | System cannot determine if message is conversational or work-producing | Fall back to conversational response; offer "Did you mean to start a task?" | No run created |
| **Context assembly failure** | ContextSnapshot cannot be captured (missing workspace, missing role) | Error message: "Cannot determine your current workspace context" | Run not created; no orphan run |
| **Planning failure** | Agent cannot decompose intent into a valid plan | Message: "I couldn't build a plan for this request. Here's why: [reason]" | Run transitions to `failed` at planning stage |
| **Proposal validation failure** | Proposals reference invalid targets or exceed permissions | Proposals render with validation errors highlighted | Run pauses at `proposals_ready`; invalid proposals flagged |
| **Approval timeout** | 72h expiration (Decision 13) | Expiration notice in thread | Run → `expired`; resumable |
| **Apply-time drift** | Context has changed since proposal (Decision 1) | Drift label: "Your context has changed since this plan was created" | Run pauses; revalidation required (WP-W1-AI-01 §3.3) |
| **Adapter failure** | Module adapter cannot execute the mutation | Per-step error in thread; partial results shown | Run → `failed` with partial results preserved |
| **Permission revocation** | User's role changed mid-run | "Your permissions have changed. This action is no longer available." | Run pauses; role revalidation fails |
| **Artifact deletion mid-run** | Target artifact deleted while run is active | "The target [artifact] no longer exists" | Run pauses; stale artifact ref detected (WP-W1-AI-01 §3.2) |

### 6.2 Drift handling protocol

Per Decision 1 and WP-W1-AI-01 §3:

1. **Detection:** The chat surface compares the run's originating `project_id` against the user's current navigation. If they differ, a drift label is shown.
2. **User choice:** The user may:
   - Continue in original context (run proceeds as-is).
   - Rebind to current context (new snapshot version; all pending proposals re-validated).
   - Cancel the run.
3. **Apply-time revalidation:** Before each apply step, the execution layer revalidates `workspace_id`, `project_id`, `resolved_role_ref`, and artifact ref liveness. Failure → pause and surface to user.
4. **No silent rebind:** The system never silently adopts a new context. Every context change is user-visible and user-confirmed.

### 6.3 Degraded-state handling

| Degraded condition | User-visible signal | System behavior |
|---|---|---|
| Partial plan (agent could plan some steps but not all) | "I was able to plan [N] of [M] steps. The remaining steps need more information." | Run proceeds with partial plan; remaining steps marked `needs_input` |
| Partial execution (some steps succeeded, some failed) | Result summary shows green/red per step | Run → `completed` with partial results; failed steps audited |
| Stale retrieval context | "Some of the information used may be outdated" | Retrieval scope revalidated per WP-W1-AI-01 §3.4 |
| Voice transcript partial (Decision 26) | "Your voice input may have been partially captured" | Trust/degraded signaling shows incomplete transcript |

---

## 7. First adapter proof (recommended first artifact type)

### 7.1 Selection criteria

The first adapter must prove that the full chat → execution → adapter → artifact path works end-to-end. Selection criteria:

1. **Strongest existing runtime foundation** — minimize greenfield risk.
2. **Clear propose/preview/apply semantics** — the artifact type must support diffable changes.
3. **Cross-artifact potential** — the adapter should demonstrate patterns reusable by other adapters.
4. **User-visible value** — the first proof must be meaningful to users, not an internal exercise.

### 7.2 Candidate evaluation

| Artifact type | Existing runtime | Propose/preview/apply | Cross-artifact | User value | Score |
|---|---|---|---|---|---|
| **Report** | `reportAgentService.ts` with section-level diff/apply | Strong: section diffs, structural changes | Medium: report-specific but pattern is reusable | High: report generation is a core use case | **Strongest** |
| **Task** | `aiActionExecutor.ts` with action dispatch | Medium: create/update but no rich diff | High: tasks link to initiatives, decisions | High: task creation from chat is common | Strong |
| **NotebookPage** | Existing proposal cards in UI | Medium: content changes, no structural diff yet | Medium: notes are standalone | Medium: useful but less governed | Medium |
| **Table** | Existing proposal cards for schema changes | Medium: schema proposals exist | Low: table-specific | Medium: schema creation is niche | Medium |
| **PresentationDeck** | Limited; deck generation exists but not governed | Weak: no diff/apply pattern yet | Low: deck-specific | High: deck from note is compelling | Weak (too much greenfield) |

### 7.3 Recommendation: Report as first adapter

**Report** is the recommended first integration target because:

1. **`reportAgentService.ts`** already implements the closest pattern to the target architecture: it receives a goal, generates sections, and can apply changes. This is the strongest as-is foundation (`AI_AGENTIC_SYSTEM_NEXT_PHASE_V8.md` §3 Phase B: "B1 — Report: closest pattern to `reportAgentService`").
2. **Section-level diff/apply** provides a natural `ActionPreview` implementation: the user can see which sections will be added, modified, or reordered before approving.
3. **The adapter pattern** (receive run context → resolve target → propose changes → preview → apply through owning service) is directly demonstrable with reports and reusable for other document-like artifacts (notes, decks).
4. **The governance path** is clear: report modifications are `safe_update` or `sensitive_update` depending on scope, mapping cleanly to the approval spine.

### 7.4 First adapter scope

The Report adapter proof should demonstrate:

| Capability | What it proves |
|---|---|
| Chat message → run creation | Intent classification triggers `ExecutionAgentRun` |
| ContextSnapshot handoff | Run carries workspace, project, conversation context |
| Plan with multiple steps | Agent proposes: add section, reorder sections, update content |
| Proposal rendering in chat | User sees section-level proposals with previews |
| Partial approval | User approves some section changes, rejects others |
| Apply through adapter | Adapter calls report owning service; mutations are not direct |
| Audit trail | Run record, proposal records, apply results all persisted |
| Drift detection | If user navigates away during review, drift is labeled |

### 7.5 Second adapter recommendation

After Report, **Task/Initiative/Decision** should be the second adapter target (Phase B2 in `AI_AGENTIC_SYSTEM_NEXT_PHASE_V8.md`). This proves cross-artifact execution: a single run can create a report AND create tasks from it, demonstrating the orchestrator's ability to dispatch to multiple adapters within one governed run.

---

## 8. Downstream dependency map

### 8.1 What this integration proof provides

| Downstream capability | What this proof establishes | Consequence if missing |
|---|---|---|
| **Phase B adapter implementation** | The chat → run → adapter → artifact path is proven; adapter interface is validated | Adapters are built without a proven integration pattern; each module invents its own chat-to-execution bridge |
| **WP-W2-AI-03 — Prompt OS integration** | The intent classification and planning phases define where Prompt OS injects prompt composition | Prompt OS integration has no anchor point in the execution flow |
| **Phase C — HITL operationally** | The approval flow within chat (§4) is the primary HITL surface; this proof validates the UX contract | HITL is designed without a concrete approval surface |
| **Phase G — Product UX normalization** | The proposal rendering (§3) and progress visibility (§5) patterns become the template for all execution UX | Each module builds its own execution UX |
| **Background and scheduled runtime** | The deferred approval queue pattern (Decision 22) demonstrated here extends to background jobs | Background jobs have no proven approval surface |

### 8.2 What this proof depends on

| Upstream dependency | What it provides | Status |
|---|---|---|
| **WP-W1-AI-01 — ContextSnapshot baseline** | Snapshot object model, identity chain, drift model | Completed |
| **WP-W1-AI-03 — Execution proposal/approval spine** | Run lifecycle, proposal schema, approval model, audit trail | Completed |
| **WP-W1-AI-04 — Tool governance and HITL baseline** | Tool catalog, consumer classes, approval semantics | Completed |
| **DECISION_LOG_WAVE_1.md** — Decisions 1, 4, 5, 13, 14, 15, 19, 22 | Binding rules for drift, snapshots, presence, expiration, re-planning, batch approval, tool defaults, background jobs | Ratified |
| **Chat runtime** (`UnifiedChatPanel`, `EnhancedChatInput`, `useAIStream`, `useConversationStore`) | Canonical chat surface and message model | Live (canonical per `CHAT_V8_RUNTIME_TRUTH_MAP.md`) |
| **Report runtime** (`reportAgentService.ts`, `aiActionExecutor.ts`) | Existing report agent pattern | Live (strongest as-is per `AGENT_EXECUTION_V8_SSOT.md` §0) |

### 8.3 Integration sequence for implementation

```
1. ContextSnapshot capture in chat turn (WP-W1-AI-01)
       ↓
2. Intent classifier (new: determines conversational vs work-producing)
       ↓
3. ExecutionAgentRun creation (WP-W1-AI-03)
       ↓
4. Planning phase (execution orchestrator — Workstream C)
       ↓
5. Proposal rendering in chat (new: message type 'execution_proposal')
       ↓
6. Approval flow in chat (new: approval controls mapped to WP-W1-AI-03 states)
       ↓
7. Adapter dispatch (Workstream D — Report adapter first)
       ↓
8. Progress and result rendering in chat (new: progress indicators, result summary)
       ↓
9. Audit persistence (Workstream F)
```

Items marked "new" are the integration-specific deliverables that this proof identifies. Items referencing workstreams are from `AGENT_EXECUTION_V8_IMPLEMENTATION_PLAN.md` §5.

---

## 9. Open questions and conflicts

### 9.1 Intent classification boundary is undefined

No canonical doc specifies how the system distinguishes a conversational message from a work request. `CHAT_V8_SSOT.md` defines the product path but not the classification logic. `AGENT_EXECUTION_V8_SSOT.md` §7.1 gives examples but not rules.

**Analysis:** This is a gap, not a conflict. The classification must be defined before implementation. Options include: LLM-based intent classification, explicit user trigger ("Start a task"), or hybrid (LLM suggests, user confirms).

**Recommendation:** Hybrid approach — the system classifies intent and, for borderline cases, asks the user: "It looks like you want me to do work. Should I create an execution plan?" This avoids false-positive run creation while keeping the flow conversational. The explicit trigger ("Start a task") should also be available as a direct entry point.

### 9.2 ChatActionProposal vs ActionProposal unification timeline

`CHAT_V8_SSOT.md` §6.4 defines `ChatActionProposal` as a chat-native entity. `AGENT_EXECUTION_V8_SSOT.md` §9.4 defines `ActionProposal` as an execution-native entity. Both describe proposals for AI-initiated actions, but with different schemas and different lifecycle models.

**Analysis:** This is a convergence gap, not a conflict. Both docs acknowledge that actions must be governed (`CHAT_V8_SSOT.md` §4.5: "propose → review → approve/reject → execute/audit"). The question is when to unify the schemas.

**Recommendation:** For Wave 2, treat `ChatActionProposal` as a lightweight facade that either resolves inline (for trivial actions) or delegates to the full `ActionProposal` spine (for governed work). Full schema unification should happen in Wave 3 when the execution spine is proven. Premature unification risks breaking the existing chat action path.

### 9.3 Message type extension for execution proposals

The chat message model (`CHAT_V8_SSOT.md` §6.3) does not currently define `execution_proposal` as a `messageType`. Adding this type requires a chat domain model extension.

**Analysis:** This is an implementation gap, not a conflict. The response class taxonomy (`CHAT_V8_SSOT.md` §10.2) already includes `proposal response` and `action-carrying response`, which are the product-level categories. The `execution_proposal` message type is the concrete implementation.

**Recommendation:** Extend the `ConversationMessage.messageType` enum to include `execution_proposal`, `execution_progress`, and `execution_result` as first-class types. These types carry `metadata.execution_run_id` for back-reference.

### 9.4 No conflicts detected between canonical docs

The following pairs were checked for conflicts and found consistent:

- `CHAT_V8_SSOT.md` §4.5 (governed actions) ↔ `AGENT_EXECUTION_V8_SSOT.md` §4.2 (propose first, apply second): Both define the same `propose → review → approve → execute` principle. No contradiction.
- `CHAT_V8_RUNTIME_TRUTH_MAP.md` §5.5 (actions canonical owner) ↔ `AGENT_EXECUTION_V8_SSOT.md` §12.1 (chat is universal intake): Both agree chat is the intake surface and execution is a separate layer. No contradiction.
- `AI_AGENTIC_SYSTEM_NEXT_PHASE_V8.md` Phase A ↔ `AGENT_EXECUTION_V8_IMPLEMENTATION_PLAN.md` Wave 1: Both identify the same deliverables (run model, proposal spine, orchestrator shell). No contradiction.
- Decision 1 (originating context preserved) ↔ WP-W1-AI-01 §3 (drift model): Consistent; the drift model implements Decision 1.
- Decision 19 (new tools default to `requires_approval`) ↔ WP-W1-AI-04 §1.3 (risk class taxonomy): Consistent; unclassified tools default to strictest handling.

---

## 10. Packet output

- **Status:** completed
- **Completed:**
  - Chat intake → run creation flow with intent classification boundary, trigger taxonomy, and creation sequence (§1)
  - ContextSnapshot handoff mechanics with field-level inheritance map, immutability contract, and what is NOT inherited (§2)
  - Proposal presentation in chat with message structure, per-proposal rendering, preview contract, and expiration visibility (§3)
  - Approval flow within chat UX with action-to-state mapping, partial approval UX, persistence rules, policy-vs-human distinction, and split-mode opportunity (§4)
  - Partial progress visibility with state-to-chat mapping, per-step indicators, background execution pattern, and completion summary (§5)
  - Error, drift and degraded-state handling with 9-class error taxonomy, drift protocol, and 4 degraded conditions (§6)
  - First adapter proof: Report recommended as first target with evaluation matrix, scope definition, and second-adapter recommendation (§7)
  - Downstream dependency map covering Phase B adapters, Prompt OS, HITL, UX normalization, and background runtime (§8)
  - Open questions: 3 gaps identified, 0 conflicts detected (§9)
- **Remaining:** none within packet scope
- **Blockers or risks:**
  - Intent classification logic (§9.1) must be defined before implementation — neither chat nor execution docs specify the boundary
  - ChatActionProposal ↔ ActionProposal unification (§9.2) needs a phased convergence plan to avoid breaking existing chat actions
  - Chat message type extension (§9.3) requires a domain model change in the chat package
- **Questions requiring escalation:**
  1. How should the system classify conversational messages vs work requests? Should it be LLM-based, user-triggered, or hybrid? (§9.1)
  2. When should `ChatActionProposal` and `ActionProposal` schemas be unified — Wave 2 (facade pattern) or Wave 3 (full unification)? (§9.2)
  3. Should the `execution_proposal` message type be added to the chat domain model now, or should proposals be rendered through the existing `actions` field on `ConversationMessage`? (§9.3)
