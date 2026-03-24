# WP-W3-LIFECYCLE-01 — Source Truth Preservation Analysis

> Status: Completed
> Packet: WP-W3-LIFECYCLE-01
> Wave: 3 — First transformation lifecycle
> Priority: P0
> Date: 2026-03-23
> Canonical inputs read:
> - `INITIATIVE_ENTRYPOINTS_AND_SOURCE_GOVERNANCE_V8.md`
> - `INITIATIVE_CHANGE_MANAGEMENT_SYSTEM_V8.md`
> - `INTERVIEW_INSIGHT_ANALYTICS_AND_CLOSED_LOOP_ACTIONS_V8.md`
> - `IDEA_WORKSPACE_INTEGRATION_AND_PROMOTION_RUNTIME_V8.md`
> Supporting anchors read:
> - `V8_IMPLEMENTATION_MASTER_PROGRAM.md` §8.4
> - `work-packets/WP-W1-AI-01_CONTEXT_IDENTITY_BASELINE.md` — ContextSnapshot
> - `work-packets/WP-W2-AI-01_CHAT_EXECUTION_INTEGRATION.md` — chat→execution flow
> - `work-packets/DECISION_LOG_WAVE_1.md`
> - `work-packets/DECISION_LOG_WAVE_2.md`

---

## 1. Initiative entrypoints inventory

The canonical docs define six user-facing entrypoints that may produce an initiative (`INITIATIVE_ENTRYPOINTS_AND_SOURCE_GOVERNANCE_V8.md` §3, `INITIATIVE_CHANGE_MANAGEMENT_SYSTEM_V8.md` §3):

| # | Entrypoint | Module surface | Canonical source type materialized before initiative commit |
|---|---|---|---|
| 1 | **Idea** | Idea Workspace → promotion flow | `ToolSession(MYWORK or IDEA_PROMOTION)` |
| 2 | **Interview** | Interview module → closed-loop action | `ToolSession(INTERVIEW_SYNTHESIS)` or equivalent governed source session |
| 3 | **Tools** | Consulting Tools → direct output | `ToolSession` (native — no materialization needed) |
| 4 | **Assessment** | Assessment module → report output | `AssessmentReport` (native — no materialization needed) |
| 5 | **Chat** | Chat panel → execution proposal | `ToolSession(CHAT_SYNTHESIS)` or equivalent governed source session |
| 6 | **Manual creation** | Initiative module → new initiative form | `ToolSession(MANUAL_INITIATIVE_DRAFT)` or equivalent governed source shell |

### 1.1 Entrypoint classification

Entrypoints fall into two governance classes:

- **Native-source entrypoints** (Tools, Assessment): the upstream artifact is already a canonical source type (`ToolSession` or `AssessmentReport`). No additional materialization is needed.
- **Derived-source entrypoints** (Idea, Interview, Chat, Manual): the upstream artifact is not a canonical source type. The system must materialize a governed source session before the initiative can be committed.

This classification is the core of the reconciliation doctrine in `INITIATIVE_ENTRYPOINTS_AND_SOURCE_GOVERNANCE_V8.md` §5.

---

## 2. Source traceability model

### 2.1 Core rule

From `INITIATIVE_ENTRYPOINTS_AND_SOURCE_GOVERNANCE_V8.md` §2:

> `many entrypoints are allowed; one traceable source model is allowed`

The canonical source model is:

- `ToolSession`
- `AssessmentReport`

All initiatives must trace back to one of these two canonical source types, regardless of which user-facing entrypoint was used.

### 2.2 Source materialization doctrine

For derived-source entrypoints, the system must create a canonical source artifact before the initiative is committed. This is not a formality — it is the mechanism that makes source truth deterministic for audit, AI context, reporting, and initiative origin explanation (`INITIATIVE_ENTRYPOINTS_AND_SOURCE_GOVERNANCE_V8.md` §4).

The materialization must happen at a specific lifecycle point:

```
entrypoint → source materialization → draft initiative → review → planning → approval → execution
```

(`INITIATIVE_ENTRYPOINTS_AND_SOURCE_GOVERNANCE_V8.md` §7)

Rule: `no initiative should cross into the canonical lifecycle without a traceable source artifact`.

### 2.3 Source type taxonomy

| Source type | Subtype (session kind) | Created by |
|---|---|---|
| `ToolSession` | `MYWORK` / `IDEA_PROMOTION` | Idea → initiative promotion |
| `ToolSession` | `INTERVIEW_SYNTHESIS` | Interview → initiative closed-loop action |
| `ToolSession` | `CHAT_SYNTHESIS` | Chat → execution proposal → initiative |
| `ToolSession` | `MANUAL_INITIATIVE_DRAFT` | Manual initiative creation |
| `ToolSession` | *(native)* | Tools module direct output |
| `AssessmentReport` | *(native)* | Assessment module direct output |

### 2.4 Relationship to ContextSnapshot

The `ContextSnapshot` object family (WP-W1-AI-01 §1.2) provides the runtime context envelope that should be captured at source materialization time. The key fields that carry into the initiative's source record:

| ContextSnapshot field | Role in source traceability |
|---|---|
| `snapshot_id` | Unique identifier for the context at materialization time |
| `workspace_id` + `organization_id` | Tenant and workspace boundary |
| `project_id` | Project scope (if applicable) |
| `conversation_id` | Originating conversation (for Chat entrypoint) |
| `execution_run_id` | Originating execution run (for Chat → execution path) |
| `artifact_refs` | Upstream artifacts in scope at materialization |
| `source_context_refs` | Knowledge sources used during materialization |
| `initiator_user_id` | Who triggered the promotion |

---

## 3. Evidence chain (upstream artifacts → initiative)

### 3.1 Idea → Initiative

**Upstream artifacts:**

From `IDEA_WORKSPACE_INTEGRATION_AND_PROMOTION_RUNTIME_V8.md` §5:

- `IdeaWorkspaceRef` — identifies the source workspace
- `IdeaObjectRef[]` — specific objects (mindmap nodes, whiteboard objects, process steps, table records, idea cards) that were selected for promotion
- `IdeaSourcePack` — source artifacts, supporting links, import origin, synced source refs, org context ref, rationale
- `IdeaIntegrationSnapshot` — full workspace state including active canvas, selected objects, org context, project context, note refs, synced source refs, AI agent session ref

**Promotion mechanism:**

`IdeaPromotionProposal` (§5.4) carries:
- `source_workspace` — which idea workspace
- `source_objects` — which specific objects
- `target_artifact_type` = `initiative`
- `proposed_payload` — structured initiative seed data
- `rationale` — why this idea should become an initiative
- `risks` — optional risk notes

**Preserved after promotion:**

`PromotedArtifactLink` (§5.5) records:
- `source_workspace` + `source_objects` → `target_artifact` (the initiative)
- `promotion_type`: `created_from` | `derived_from` | `linked_from`

**Evidence that must survive:**

From `IDEA_WORKSPACE_INTEGRATION_AND_PROMOTION_RUNTIME_V8.md` §10:
- `idea_id`, `workspace_id`, `source_object_refs[]`, `source_artifact_refs[]`, `note_refs[]`, `org_context_ref`, `synced_source_refs[]`, `promotion_reason`

### 3.2 Interview → Initiative

**Upstream artifacts:**

From `INTERVIEW_INSIGHT_ANALYTICS_AND_CLOSED_LOOP_ACTIONS_V8.md` §3:

- Insights with classification: signal, theme, contradiction, evidence-backed finding, assumption, unresolved gap
- Evidence class, confidence level, triangulation state
- Session-level, wave-level, and program-level analytics

**Promotion mechanism:**

From §4, interview findings can produce `initiative input` as a closed-loop action. The system must materialize a `ToolSession(INTERVIEW_SYNTHESIS)` that captures:
- the specific findings that motivated the initiative
- evidence class and confidence
- respondent/output traceability where appropriate (`IDEA_WORKSPACE_INTEGRATION_AND_PROMOTION_RUNTIME_V8.md` §11.4)

**Evidence that must survive:**
- Interview session reference(s)
- Specific insight/finding references
- Evidence class and confidence at time of promotion
- Triangulation state (was the finding corroborated?)

### 3.3 Chat → Initiative

**Upstream artifacts:**

From `WP-W2-AI-01_CHAT_EXECUTION_INTEGRATION.md`:
- Conversation context (conversation_id, message history reference)
- ContextSnapshot captured at intent classification (§1.3 step 3)
- ExecutionAgentRun if the initiative creation was part of governed work (§1.3 step 4)

**Promotion mechanism:**

Per Decision W2-1, the system classifies intent (hybrid: LLM + user confirmation for borderline cases). If the user's intent is to create an initiative, the system:
1. Captures a ContextSnapshot with `consumer_class = 'execution'`
2. Creates an ExecutionAgentRun
3. Materializes a `ToolSession(CHAT_SYNTHESIS)` as the canonical source
4. Preserves selected chat context and referenced artifacts (`INITIATIVE_ENTRYPOINTS_AND_SOURCE_GOVERNANCE_V8.md` §5.5)

**Evidence that must survive:**
- `conversation_id` back-reference
- `execution_run_id` if applicable
- Selected chat context (not full transcript — per WP-W2-AI-01 §2.3)
- Referenced artifacts from the conversation

### 3.4 Tools → Initiative (native)

**Upstream artifacts:** `ToolSession` is already the canonical source type. No materialization needed.

**Evidence that must survive:**
- `ToolSession` reference with full session state
- Tool outputs and structured results

### 3.5 Assessment → Initiative (native)

**Upstream artifacts:** `AssessmentReport` is already the canonical source type. No materialization needed.

**Evidence that must survive:**
- `AssessmentReport` reference
- Assessment findings and recommendations

### 3.6 Manual → Initiative

**Upstream artifacts:** None — the user creates the initiative directly.

**Promotion mechanism:**

The system must create a `ToolSession(MANUAL_INITIATIVE_DRAFT)` as a governed source shell. This prevents source-less initiatives (`INITIATIVE_ENTRYPOINTS_AND_SOURCE_GOVERNANCE_V8.md` §5.6).

**Evidence that must survive:**
- The governed source shell itself (even if minimal)
- `initiator_user_id` and creation context

---

## 4. Promotion workflow

### 4.1 General promotion sequence

All entrypoints follow the same lifecycle gate sequence:

```
1. Upstream work matures (idea deepens, interview concludes, tool session completes, etc.)
2. User or AI proposes initiative creation
3. System materializes canonical source artifact (if not already native)
4. System captures ContextSnapshot at materialization time
5. Draft initiative is created with source reference, evidence chain, and context snapshot
6. Initiative enters governed lifecycle: review → planning → approval → execution
```

### 4.2 Idea promotion workflow (detailed)

From `IDEA_WORKSPACE_INTEGRATION_AND_PROMOTION_RUNTIME_V8.md` §6.4:

1. User selects idea objects for promotion (or AI proposes promotion)
2. System creates `IdeaPromotionProposal` with target = `initiative`
3. AI may prepare structured payload (rationale, scope hints, linked evidence)
4. User reviews and confirms the promotion proposal
5. System materializes `ToolSession(IDEA_PROMOTION)` with idea artifacts attached
6. System creates `PromotedArtifactLink` recording the source→target relationship
7. Draft initiative is created with inherited source rationale, linked evidence, and scope hints
8. Initiative retains backlink to idea workspace and source objects

Rules from §6.4:
- Promotion must be explicit
- Proposal-governed where AI is involved
- Traceable
- Reversible at the linkage level

### 4.3 Interview promotion workflow (detailed)

From `INTERVIEW_INSIGHT_ANALYTICS_AND_CLOSED_LOOP_ACTIONS_V8.md` §4:

1. Interview findings are analyzed (session, wave, or program level)
2. Important findings are classified (signal, theme, evidence-backed finding, etc.)
3. User or system identifies a finding as `initiative input`
4. System materializes `ToolSession(INTERVIEW_SYNTHESIS)` with findings attached
5. Draft initiative is created with interview evidence chain

Rule from §4: `important findings should not die as passive transcript content`

### 4.4 Chat promotion workflow (detailed)

From `WP-W2-AI-01_CHAT_EXECUTION_INTEGRATION.md` §1:

1. User sends message with initiative-creation intent
2. System classifies intent as work-producing (Decision W2-1: hybrid classification)
3. ContextSnapshot captured (`consumer_class = 'execution'`)
4. ExecutionAgentRun created
5. Agent plans initiative creation steps
6. Proposals rendered in chat thread (Decision W2-3: dedicated `messageType`)
7. User approves (per Decision 15: mixed-mode batch approval)
8. System materializes `ToolSession(CHAT_SYNTHESIS)` as canonical source
9. Initiative created through execution adapter

### 4.5 Manual creation workflow

1. User opens initiative creation form
2. System creates `ToolSession(MANUAL_INITIATIVE_DRAFT)` as governed source shell
3. User fills initiative fields
4. Initiative enters governed lifecycle with source shell attached

---

## 5. Source governance rules

### 5.1 Who can promote

The canonical docs do not define an explicit promotion permission model beyond the general role and scope governance. The following rules are derived from the intersection of source governance and the ContextSnapshot model:

| Rule | Source |
|---|---|
| Promotion respects `resolved_role_ref` at snapshot time | WP-W1-AI-01 §1.2 |
| Promotion respects `effective_scope_ref` for project boundaries | WP-W1-AI-01 §1.2 |
| AI may propose promotions but cannot silently finalize them | `IDEA_WORKSPACE_INTEGRATION_AND_PROMOTION_RUNTIME_V8.md` §6.4, §9 |
| AI may not silently create downstream artifacts | `IDEA_WORKSPACE_INTEGRATION_AND_PROMOTION_RUNTIME_V8.md` §9 |
| AI may not break traceability by generating detached outputs | `IDEA_WORKSPACE_INTEGRATION_AND_PROMOTION_RUNTIME_V8.md` §9 |
| Interview findings may produce initiative input "where policy allows" | `INITIATIVE_CHANGE_MANAGEMENT_SYSTEM_V8.md` §3 |

### 5.2 What validation is required

| Validation | When | Source |
|---|---|---|
| Canonical source artifact must exist before initiative commit | Before lifecycle entry | `INITIATIVE_ENTRYPOINTS_AND_SOURCE_GOVERNANCE_V8.md` §7 |
| Source materialization must capture context snapshot | At materialization time | WP-W1-AI-01 §1.3 |
| Promotion proposal must include rationale | At proposal time | `IDEA_WORKSPACE_INTEGRATION_AND_PROMOTION_RUNTIME_V8.md` §5.4 |
| Governed execution proposals require user approval | Before apply | WP-W2-AI-01 §4, Decision 15 |
| Role and scope must be revalidated at apply time | Before mutation | WP-W1-AI-01 §3.3 |

### 5.3 What metadata is preserved

Every initiative must preserve at minimum:

| Metadata | Purpose |
|---|---|
| Canonical source type (`ToolSession` or `AssessmentReport`) | Audit, reporting, AI context |
| Source session kind (e.g., `IDEA_PROMOTION`, `INTERVIEW_SYNTHESIS`) | Origin explanation |
| `ContextSnapshot` at materialization time | Reconstructable context |
| Upstream artifact references | Evidence chain |
| `initiator_user_id` | Accountability |
| `promotion_reason` / `rationale` | Decision traceability |
| Backlink to source workspace/module | Navigation and reopening |
| `PromotedArtifactLink` (for Idea entrypoint) | Bidirectional traceability |

### 5.4 Visible origin section

From `INITIATIVE_ENTRYPOINTS_AND_SOURCE_GOVERNANCE_V8.md` §8:

> The system should support: visible "initiative originates from" section

This means the initiative UI must display:
- Source entrypoint (Idea, Interview, Tools, Assessment, Chat, Manual)
- Source artifact reference (clickable backlink)
- Promotion rationale
- Evidence summary

---

## 6. ContextSnapshot integration for source traceability

### 6.1 How ContextSnapshot supports the source model

The `ContextSnapshot` from Wave 1 (WP-W1-AI-01) was designed as the universal context envelope for AI interactions. For source traceability, it serves as the **context-at-promotion-time** record.

| ContextSnapshot capability | Source traceability use |
|---|---|
| Immutable after capture (§1.3 rule 2) | The context at promotion time is preserved for audit even if the user's context later changes |
| Versioned (§1.2 `snapshot_version`) | If context drifts between proposal and apply, the drift is detectable |
| Embeds `artifact_refs` | Records which upstream artifacts were in scope when the initiative was created |
| Embeds `source_context_refs` | Records which knowledge sources informed the promotion |
| Embeds `initiator_user_id` | Records who triggered the promotion |
| Embeds `effective_scope_ref` + `resolved_role_ref` | Records the permission and scope context under which the promotion happened |
| Support-visible (§4) | Support can inspect the full context chain for any initiative creation |

### 6.2 Snapshot capture points in the promotion flow

| Promotion flow step | Snapshot action |
|---|---|
| User initiates promotion (any entrypoint) | Capture ContextSnapshot with `consumer_class` appropriate to the entrypoint |
| Source materialization | Attach `snapshot_id` to the materialized `ToolSession` or `AssessmentReport` |
| Draft initiative creation | Initiative record references the `snapshot_id` from materialization |
| Initiative enters governed lifecycle | Subsequent lifecycle gates may capture new snapshots, but the originating snapshot is preserved |

### 6.3 Drift protection during promotion

Per WP-W1-AI-01 §3 and Decision 1:

- If the user's context changes between proposal and apply (e.g., navigates to a different project), the system must detect the drift and surface it.
- The initiative's source snapshot is the originating context, not the drifted context.
- The user must explicitly choose to continue in original context or rebind.

---

## 7. Downstream dependency map

### 7.1 What this packet provides to downstream packets

| Downstream packet/capability | What this analysis establishes |
|---|---|
| **WP-W3-LIFECYCLE-02** (Initiative internal lifecycle) | The initiative enters the lifecycle with a guaranteed canonical source artifact, context snapshot, and evidence chain. LIFECYCLE-02 can assume source traceability is closed. |
| **WP-W3-LIFECYCLE-03** (Execution layer) | Execution work inherits the initiative's source context. The execution layer can trace back through initiative → source artifact → upstream entrypoint. |
| **Wave 4 — Idea Workspace hardening** | The `IdeaPromotionProposal` → `PromotedArtifactLink` → initiative path is defined. Workspace collaboration hardening can build on this promotion contract. |
| **Wave 6 — Reports and Results** | Reports and results that reference initiatives can trace through to the original source evidence. The evidence chain is not broken at the initiative boundary. |
| **Support and audit** | The full chain (entrypoint → source materialization → ContextSnapshot → initiative) is support-visible per WP-W1-AI-01 §4. |

### 7.2 What this packet depends on

| Upstream dependency | What it provides | Status |
|---|---|---|
| **WP-W1-AI-01 — ContextSnapshot baseline** | Snapshot object model, identity chain, drift model, support traces | Completed |
| **WP-W2-AI-01 — Chat → Execution integration** | Chat intent classification, run creation, proposal rendering, approval flow | Completed |
| **DECISION_LOG_WAVE_1.md** — Decisions 1, 2, 3, 4 | Drift handling, snapshot granularity, retention, worker context | Ratified |
| **DECISION_LOG_WAVE_2.md** — Decisions W2-1, W2-2, W2-3 | Intent classification, proposal unification, proposal rendering | Ratified |

---

## 8. Open questions and conflicts

### 8.1 Gap: Source materialization UX is undefined

The canonical docs define *what* must be materialized (a `ToolSession` or `AssessmentReport`) and *when* (before initiative commit), but not *how the user experiences it*.

For native-source entrypoints (Tools, Assessment), this is invisible — the source already exists.

For derived-source entrypoints (Idea, Interview, Chat, Manual), the materialization creates a new `ToolSession` as a governed source shell. The user experience of this materialization is undefined:

- Does the user see a "creating source record" step?
- Is it invisible (system creates it in the background)?
- Does it appear in the user's tool session history?
- Can the user edit or enrich the source shell after creation?

**Recommendation:** For Wave 3, the materialization should be invisible to the user in the default flow (system creates the source shell automatically as part of the promotion workflow). The source shell should be visible in audit/support views and in the initiative's "originates from" section. User-facing enrichment of the source shell is a Wave 4+ concern.

### 8.2 Gap: Interview → Initiative promotion permission model

`INITIATIVE_CHANGE_MANAGEMENT_SYSTEM_V8.md` §3 says interview findings may produce initiatives "where policy allows." `INTERVIEW_INSIGHT_ANALYTICS_AND_CLOSED_LOOP_ACTIONS_V8.md` §4 says findings should produce `initiative input` as a closed-loop action.

Neither doc defines:
- What policy governs whether an interview finding can become an initiative
- Whether the interview operator, the initiative owner, or both must approve
- Whether confidence level or evidence class gates the promotion

**Recommendation:** For Wave 3, the minimum policy should be: any user with initiative-creation permission in the target project can promote an interview finding to an initiative. The finding's evidence class and confidence level should be preserved as metadata on the initiative but should not gate the promotion itself. Stricter policy (e.g., requiring triangulated evidence before promotion) is a later refinement.

### 8.3 Gap: Manual creation source shell — what goes into it?

`INITIATIVE_ENTRYPOINTS_AND_SOURCE_GOVERNANCE_V8.md` §5.6 requires a `ToolSession(MANUAL_INITIATIVE_DRAFT)` for manual creation to prevent source-less initiatives. But the doc does not define what content the source shell should contain when the user creates an initiative from scratch.

**Recommendation:** The manual source shell should capture at minimum: `initiator_user_id`, `ContextSnapshot` at creation time, and any initial rationale or description the user provides. The shell exists primarily for audit completeness, not for rich evidence preservation.

### 8.4 Gap: Synced external source preservation in evidence chain

`IDEA_WORKSPACE_INTEGRATION_AND_PROMOTION_RUNTIME_V8.md` §5.3 (`IdeaSourcePack`) includes `synced_source_refs` and the runtime handoff contract (§10) includes `synced_source_refs[]`. However, the source governance doc (`INITIATIVE_ENTRYPOINTS_AND_SOURCE_GOVERNANCE_V8.md`) does not mention synced external sources.

**Analysis:** This is a gap, not a conflict. The Idea module explicitly supports synced external sources as part of the evidence chain, but the initiative source governance model does not yet account for them.

**Recommendation:** The initiative's source record should preserve `synced_source_refs[]` from the upstream `IdeaSourcePack` or `IdeaIntegrationSnapshot`. These references should carry freshness and provenance metadata per the connector governance model. This does not require a new canonical doc — it requires extending the source metadata preserved on the initiative.

### 8.5 No conflicts detected between canonical docs

The following pairs were checked for conflicts and found consistent:

- `INITIATIVE_ENTRYPOINTS_AND_SOURCE_GOVERNANCE_V8.md` §3 ↔ `INITIATIVE_CHANGE_MANAGEMENT_SYSTEM_V8.md` §3: Both list the same entrypoints. The entrypoints doc adds the reconciliation doctrine (source materialization); the change management doc focuses on lifecycle. No contradiction.
- `INITIATIVE_ENTRYPOINTS_AND_SOURCE_GOVERNANCE_V8.md` §5.3 (Idea materialization) ↔ `IDEA_WORKSPACE_INTEGRATION_AND_PROMOTION_RUNTIME_V8.md` §7.2 (Initiative promotion): Both agree that the initiative inherits source rationale, linked evidence, and scope hints, and retains a backlink to the idea workspace. No contradiction.
- `INITIATIVE_ENTRYPOINTS_AND_SOURCE_GOVERNANCE_V8.md` §5.5 (Chat materialization) ↔ `WP-W2-AI-01_CHAT_EXECUTION_INTEGRATION.md` §1 (chat → execution flow): The entrypoints doc requires a `ToolSession(CHAT_SYNTHESIS)` before initiative commit; the chat integration proof defines the execution run path that would create it. No contradiction — the execution run is the vehicle for the materialization.
- `INTERVIEW_INSIGHT_ANALYTICS_AND_CLOSED_LOOP_ACTIONS_V8.md` §4 ↔ `INITIATIVE_ENTRYPOINTS_AND_SOURCE_GOVERNANCE_V8.md` §5.4: Both agree that interview findings should be able to produce initiative input. The entrypoints doc adds the source materialization requirement. No contradiction.

---

## 9. Packet output

- **Status:** completed
- **Completed:**
  - Initiative entrypoints inventory with 6 entrypoints classified into native-source and derived-source categories (§1)
  - Source traceability model with canonical source types, materialization doctrine, and ContextSnapshot integration (§2)
  - Evidence chain mapping for all 6 entrypoints with upstream artifacts, promotion mechanisms, and what must survive (§3)
  - Promotion workflow for all entrypoints with detailed step sequences (§4)
  - Source governance rules covering who can promote, what validation is required, what metadata is preserved, and visible origin requirements (§5)
  - ContextSnapshot integration for source traceability with capture points and drift protection (§6)
  - Downstream dependency map covering LIFECYCLE-02, LIFECYCLE-03, Wave 4, Wave 6, and support/audit (§7)
  - Open questions: 4 gaps identified, 0 conflicts detected (§8)
- **Remaining:** none within packet scope
- **Blockers or risks:**
  - Source materialization UX (§8.1) needs a product decision before implementation can finalize the user experience for derived-source entrypoints
  - Interview → initiative promotion permission model (§8.2) needs policy definition before the interview closed-loop action path can be fully implemented
- **Questions requiring escalation:**
  1. Should source materialization for derived-source entrypoints be invisible to the user or require an explicit confirmation step? (§8.1)
  2. What policy governs whether an interview finding can be promoted to an initiative — permission-based, evidence-class-based, or both? (§8.2)
  3. Should synced external source references (`synced_source_refs`) be added to the initiative source governance model, or are they only preserved at the Idea workspace level? (§8.4)
