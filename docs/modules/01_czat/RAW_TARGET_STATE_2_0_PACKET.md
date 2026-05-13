---
module_id: MODULE_CHAT
doc_kind: RAW_TO_TARGET_MODULE_PACKET
packet_version: 2.0
owner_business: user
owner_tech: user
status: APPROVED_FOR_DOCS_NO_GO_RUNTIME
last_updated: 2026-05-10
---

# RAW -> Target State 2.0 Packet — 01_czat

## 0. Metadata

- module: `01_czat`
- status flow in this cycle: `IN_PROGRESS -> REVIEW -> APPROVED_FOR_DOCS_NO_GO_RUNTIME`
- change type: `RAW-to-contract conversion` + `UI/UX contract hardening`
- scope freeze: active (see section 5)

## 1. RAW Sources

- `docs/modules/01_czat/RAW_INPUT.md`
- `docs/UI_UX/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md`
- `docs/modules/01_czat/00_META.md` ... `07_ACCEPTANCE_AND_TESTS.md`
- `docs/modules/01_czat/functions/CZ_CHAT_ENGINE.md`
- `docs/modules/01_czat/functions/CZ_CANVAS_WORKSPACE.md`

## 2. DECISION — As-Is (verified runtime)

### 2.1 Verified As-Is

- Chat routes exist and are mapped: `/chat`, `/chat/:conversationId`, `/internal/v10-runtime`.
  - route evidence: `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx`
  - component evidence: `src/views/AIChatWelcomeView.tsx`, `src/components/AIChat/UnifiedChatPanel.tsx`, `src/views/V10RuntimeWorkspaceView.tsx`
  - API evidence: `server/src/routes/ai.routes.ts`, `server/src/routes/conversations.routes.ts`
  - test evidence: `tests/components/AppRoutes.ai-chat-routing.test.tsx`, `tests/integration/ai/ai-chat.routes.test.ts`
- Sidebar entry for Chat is active under `AI_CHAT`.
  - route/component evidence: `src/components/navigation/Sidebar/menuConfig.ts`
  - test evidence: `tests/components/AppRoutes.ai-chat-routing.test.tsx`
- Proposal/governance semantics exist in runtime and backend contracts (proposal messages, policy gating).
  - component evidence: `src/components/AIChat/V8ArtifactRunControl.tsx`, `src/views/AIChatWelcomeView.tsx`
  - API evidence: `server/src/routes/conversations.routes.ts` (`execution_proposal` message type), `server/src/services/ai/chatPolicyGateway.ts`
  - test evidence: `server/src/services/ai/__tests__/chatPolicyGateway.contract.test.ts`, `tests/components/AIChat/AIChatWelcomeView.v8-controls.test.tsx`

### 2.2 Author Target (RAW intent)

- Chat/Teresa as "Conversational Work OS", not only prompt-response window: Teresa conducts work sessions and executes consulting work through the right module/runtime.
- Mandatory explicit provenance and source trust posture.
- Mandatory bridge from Teresa conversation to artifacts/tasks/decisions with approval before mutation and read-back after execution.
- Clear chat vs canvas/workspace ownership, with next actions at every state.

### 2.3 Delta (As-Is -> Target)

- `ENHANCE`: documentation precision for evidence-backed runtime states and handoff boundaries.
- `ENHANCE`: explicit Menu 3 placement contract for contextual AI actions in chat module UX.
- `ENHANCE`: acceptance and test matrix upgraded from generic to executable evidence map.
- `KEEP`: current route topology and internal v10 runtime bridge remain unchanged.
- `DEFER_P2`: full lane exposure for `/wordy`, `/excele`, `/prezentacje` from chat-canvas perspective.
- `DEFER_P2`: complete source-trust UI implementation inventory per message subcomponent.
- `ENHANCE_TARGET`: market-parity target capability set added from RAW addendum, explicitly documented as target/deferred unless backed by existing runtime evidence.
- `ENHANCE_TARGET`: minimalist UI/UX rule locked for these capabilities: chips, dropdowns, side panels, Menu 3 and progressive disclosure instead of heavy persistent toolbars.

### 2.4 Decision register per requirement

| Requirement slice | Decision | Why now (business value / integration risk / cost / evidence readiness) |
| --- | --- | --- |
| Preserve chat entry as primary module route (`/chat`) | `KEEP` | Stable entrypoint already shipped; low integration risk; strong evidence readiness. |
| Keep deep-link conversation route (`/chat/:conversationId`) | `KEEP` | Critical for continuity and history linking; low cost; automated test already exists. |
| Harden source/provenance contract in module docs | `ENHANCE` | High trust/compliance value; medium integration risk if ambiguous; evidence exists in policy/tests. |
| Harden converse->clarify->draft/execute->approval->read-back/audit wording | `ENHANCE` | High work-execution and governance value; medium cross-module risk; backend contracts/tests already present. |
| Add explicit function-level UI Component Footprint for chat and canvas | `ENHANCE` | Reduces UI drift and duplicate ownership; low cost doc-only; component evidence ready. |
| Add market-parity target capabilities from RAW addendum | `ENHANCE_TARGET` | High strategic value; aligns with ChatGPT Projects, Claude Artifacts, Copilot grounding, Perplexity source-first UX, Notion plan mode and Harvey-style governed workflow; implementation evidence is partial, so claims stay target/deferred. |
| Lock minimalist UI/UX posture for advanced chat capabilities | `ENHANCE_TARGET` | Reduces product risk from overloaded chat UI; aligns with Menu 3/command-row governance; evidence exists for current input action bar and side-panel patterns. |
| Treat attachment/source knowledge as conversation-scoped by default | `ENHANCE_TARGET` | Protects privacy/tenancy and prevents hidden learning; current runtime supports conversation-scoped attachment IDs but org-context write behavior needs a future guard. |
| Introduce full Conversational Work OS capability set from RAW as shipped scope | `DEFER_P2` | Very high implementation cost; partial runtime only; evidence readiness incomplete for full claim set. |
| New cross-module ownership of artifacts by `01_czat` | `DEFER_P2` | Would violate canonical owner lanes and raise handoff risk; not justified by current runtime evidence. |

### 2.4A Canvas decision table — scope freeze

| Canvas item | AS-IS (confirmed) | TARGET (author intent) | DELTA | Decision | Rationale |
| --- | --- | --- | --- | --- | --- |
| Internal Canvas runtime bridge | `/internal/v10-runtime` is mapped and documented as internal runtime bridge. Evidence: `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx`, `src/views/V10RuntimeWorkspaceView.tsx`, `tests/components/Admin/ChatV10RuntimesPanel.test.tsx`. | Keep a visible runtime/capability bridge for QA and rollout inspection without implying end-user lane parity. | Runtime exists, but user-facing Canvas startup is not working end-to-end. | `KEEP_AS_INTERNAL_ONLY` | Business value: preserves evidence-backed diagnostics. Integration risk: low. Evidence readiness: high for diagnostics, insufficient for launch. UX impact: must not be presented as working Canvas. |
| KIMI split workspace shell | `KimiWorkspaceShell` and split `UnifiedChatPanel` evidence exist, while lane routes remain partially/gated. Evidence: `src/components/AIChat/KimiWorkspace/KimiWorkspaceShell.tsx`, `src/components/AIChat/UnifiedChatPanel.tsx`, `docs/product/V10_EXPANDED_CANVAS_KIMI_LANE_DECISION.md`. | Canvas works as `chat-left/work-right` consulting workbench for document/sheet/deck style lanes. | Component direction exists but full product availability is not proven and current module start is incomplete. | `STARTUP_P0` | Business value: needed for module start. Integration risk: medium due route availability gap. Evidence readiness: component-level only. UX impact: must expose honest empty/degraded states before expansion. |
| Teresa-executed artifact creation from chat | Proposal/governance primitives exist via V8 controls and conversation proposal contracts. Evidence: `src/components/AIChat/V8ArtifactRunControl.tsx`, `server/src/routes/conversations.routes.ts`. | `conversation -> clarification -> draft -> artifact -> edit -> approve -> export -> link to project`. RAW source: `docs/UI_UX/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md`. | Current evidence supports governed controls, not a working startup path from Teresa output to owner-lane read-back. | `STARTUP_P0` | Business value: core Teresa work-execution job and required to finish module start. Integration risk: high across artifact lanes. Evidence readiness: partial. UX impact: must show draft, review, accept/reject and read-back before any launch claim. |
| Diff / apply / reject / rollback | Existing docs name target diff/versioning; no complete route/component/API/test bundle proves lifecycle. | Canvas exposes compact review/diff cards, apply/reject and rollback with read-back/audit. | Missing full shipped evidence. | `DEFER` | Business value: high trust and safety. Integration risk: high. Evidence readiness: low. UX impact: must remain target/deferred to avoid false promise. |
| Menu 3 AI action placement | Global UI rules require contextual AI actions in Menu 3/right command row. Current Canvas sub-state slot mapping is not fully enumerated. | Canvas AI actions appear in Menu 3 right slot; canvas body only shows artifact-state controls tied to selected draft/review state. | Needed for startup to avoid a second broken toolbar. | `STARTUP_P0` | Business value: avoids toolbar sprawl. Integration risk: medium if Canvas adds duplicate controls. Evidence readiness: governance high, component mapping partial. UX impact: cleaner command hierarchy. |
| Source/provenance visibility | Chat citations and policy evidence exist; Canvas-level source-lineage review is partial/target. Evidence: `MessageRenderer`, `CitationList`, `chatPolicyGateway`. | Artifact candidates show `sourceRefs`, `evidenceRefs`, model/tool/source traceability or explicit no-source state before materialization/export. | Required before startup because Canvas cannot show ungrounded artifact candidates as work product. | `STARTUP_P0` | Business value: trust and auditability. Integration risk: medium. Evidence readiness: chat high, canvas partial. UX impact: prevents ungrounded artifacts. |
| Owner-lane work execution handoff | Canon states Teresa-derived outputs are shared by `01_czat` + owner module; owner lanes materialize business objects. | `conversation intent -> Teresa clarification -> canvas draft/proposal -> review -> approval/rejection -> owner-lane materialization -> read-back/audit`. | This is the missing launch-critical bridge. | `STARTUP_P0` | Business value: required to finish module start. Integration risk: high if bypassed. Evidence readiness: standards high, e2e tests missing. UX impact: users see where Teresa's work becomes durable. |
| Full Canvas lane parity for Wordy/Excele/Prezentacje | KIMI components exist; `/wordy`, `/excele`, `/prezentacje` are documented as gated/coming-soon in route posture. | Shared Expanded Canvas lanes for document/sheet/deck work. | Product availability not proven. | `DEFER` | Business value: high. Integration risk: high. Evidence readiness: incomplete. UX impact: must show gated/degraded states instead of shipped claims. |

### 2.4B Canvas startup baseline — finish module start

Status: `STARTUP_INCOMPLETE / NO_GO`.

P0 required before Canvas can be described as working:

1. User-facing entry is decided and implemented: selected chat output, explicit Menu 2 function entry, or shared Canvas route.
2. Empty Canvas state is implemented with next action guidance.
3. One chat output can create/load one visible draft artifact candidate.
4. Draft candidate shows source/provenance or explicit no-source warning.
5. Draft candidate enters `review_required` before any durable mutation.
6. User can accept or reject the candidate.
7. Reject path leaves no durable owner-lane mutation.
8. Accept path routes to owner lane and returns read-back evidence.
9. Errors distinguish route, rollout, source, ACL, API and owner-lane read-back blockers.
10. Menu 3 placement is verified for Canvas startup actions.

Anything beyond this baseline is P1/P2 and must not block the first working start unless it is needed for safety, tenancy or approval.

### 2.4C Canvas RAW-derived prioritized backlog

This backlog preserves the full useful Canvas scope from RAW. P0 finishes the broken startup. P1 expands the first working Canvas. P2 preserves valuable ideas without blocking launch.

#### P0 — must have to finish Canvas start

| Item | RAW evidence | Acceptance intent |
| --- | --- | --- |
| User-facing Canvas entry | `conversation -> context -> artifact`; Workbench relation: chat left, artifact right. | User can open Canvas from a Teresa conversation or explicit function entry without a misleading gated shell. |
| Honest empty state | Chat Home/Canvas should show suggested next actions and recent artifacts. | Empty Canvas tells user how to create/load a draft. |
| Artifact preview panel | Active Conversation View includes `artifact preview`; MVP3 includes `artifact preview`. | Draft is visible before approval. |
| Artifact identity | RAW Conversation has `linked_artifacts`; Message has `generated_artifacts`. | Draft has `draft_id`, `artifact_type`, `source_conversation_id`, `status`. |
| Create document draft from answer | RAW P0: `Create document from answer`. | Answer can become document draft. |
| Create table draft from answer | RAW P0: `Create table from answer`. | Answer can become table draft. |
| Create presentation/deck outline from answer | RAW P0: `Create presentation from answer`. | Answer can become deck outline or presentation draft. |
| Source/provenance cards in Canvas | RAW requires `source cards`, citations, `Source traceability`. | Canvas preview shows sources or explicit no-source warning. |
| Review-required state | RAW: AI may propose actions, data changes require approval. | Candidate cannot materialize without user decision. |
| Accept/reject candidate | RAW Action Review View: `bulk accept/reject/edit`; approval cards. | User can accept or reject draft. |
| Edit before accept | RAW workflow: `draft -> artifact -> edit -> approve`. | User can adjust candidate before materialization. |
| Reject no-write guarantee | RAW: `Zero silent write actions`. | Reject leaves no durable owner-lane object. |
| Owner-lane read-back | RAW: artifact saved/linked to project and audit trail. | Approved candidate returns visible created/updated owner object. |
| Save/link to project | RAW MVP3: `save to project`; risk: user loses outputs. | Artifact is linked to project or shown as intentionally unlinked. |
| Error/degraded reason taxonomy | RAW: recovery, permissions, source warnings. | UI distinguishes route, rollout, source, ACL, API and read-back blockers. |
| Menu 3 Canvas actions | RAW addendum: contextual actions in Menu 3/dynamic command row. | Canvas startup actions are not duplicated in body toolbar. |
| Audit/read-back strip | RAW P0: `Audit tool call`; `ChatAuditLog`. | User can see actor/action/status/read-back for materialization. |
| Client/internal gate | RAW: client/internal split, client-ready mode. | Export/materialize warns about internal-only content. |
| File preview + parsing status for file-derived drafts | RAW P0: file preview, parsing status, classification, citations. | Canvas does not build from unknown/failed parser state. |

#### P1 — should have after first working Canvas

| Item | RAW evidence | Acceptance intent |
| --- | --- | --- |
| Full diff/apply/reject/rollback | Market-parity addendum: artifact versioning, diff, apply/reject, rollback. | AI edits are inspectable and reversible. |
| Version snapshots | Same as above. | User can compare/recover versions. |
| Agent run plan | RAW addendum: plan before larger actions. | Multi-step artifact work shows steps, sources, tools, risks and approvals. |
| Source health/freshness badges | RAW source health/freshness and trust levels. | User sees stale/blocked/low-quality source warnings. |
| Source understanding preview | RAW P1: parser understanding preview. | User sees what parser understood before trusting output. |
| Action Review panel | RAW Action Review View. | Suggested artifacts/tasks/decisions/follow-ups are reviewed together. |
| Edit artifact from chat | MVP3: `edit artifact from chat`. | Teresa can propose edits beside the artifact. |
| Create report from chat | RAW P1: report artifact with sources preserved. | Conversation can become report after base lanes work. |
| Create initiative draft from answer | RAW P1. | Larger finding can become initiative proposal with approval. |
| Risk/blocker/assumption/question cards | RAW P1 extraction. | Canvas can expose consulting review cards from draft/conversation. |
| History filters by artifact/output | RAW history filters. | Generated work remains findable. |
| Project instructions/workspace rules | RAW addendum. | Artifact generation follows project tone, format, source policy and client/internal boundary. |
| Consulting playbook selector | RAW playbooks/skills. | Canvas supports domain-specific outputs like business case, PMO review, risk register. |
| Client-ready redaction pipeline | RAW client-ready mode. | Output can be cleaned before client export. |
| Knowledge lifecycle badge | RAW knowledge lifecycle/vault. | Artifact shows knowledge owner/review/expiry/conflict status. |
| Meeting/workshop recap to artifact/action cards | RAW meeting recap. | Transcript/voice note can become summary, decisions, tasks and artifact candidates. |
| Connected workspace side panel | RAW connected workspace side panel. | Teresa understands active artifact/object beside the canvas. |

#### P2 — preserve, do not block Canvas launch

| Item | RAW evidence | Why preserve |
| --- | --- | --- |
| Shared project chat/team collaboration | RAW addendum P0 market parity. | Valuable for team ownership, comments and approvals, but not required for single-user Canvas start. |
| Enterprise connector catalog | RAW connector catalog. | Expands source ecosystem after base Canvas is stable. |
| Knowledge review queue for sources | RAW P2 governance. | Needed for sensitive/org knowledge promotion. |
| Cross-conversation intelligence | RAW project recaps across conversations. | Useful for project summaries, not required for draft flow. |
| Research space/source-first workspace | RAW Perplexity-like research space. | Strong future workflow, separate from first artifact Canvas. |
| Semantic history and memory search | RAW semantic search. | Improves retrieval after artifact identity exists. |
| Voice/multimodal to Canvas | RAW voice/image/audio to outputs. | Future input channel. |
| Mobile/async continuation | RAW P2. | Useful for approvals outside desktop. |
| Dashboards for usage/governance/quality | RAW dashboards. | Enterprise ops layer after workflow exists. |
| ZIP/source pack ingestion | RAW P2 source pack. | Advanced ingestion. |
| Whiteboard/mindmap/process-flow from chat | RAW artifact list. | Valuable advanced artifact families after document/table/deck baseline. |

### 2.5 RAW extraction — market-parity addendum

Must-have target capabilities:

- Project instructions / workspace rules for stable project-level behavior.
- Shared project chat and team collaboration with visibility/ownership.
- Agent run plan before larger multi-step AI work.
- Artifact versioning, diff, apply/reject and rollback for AI edits.
- Source health/freshness and source understanding preview.
- Attachment/source knowledge scope: conversation-only, personal, project/team, organization, no-retention.
- Meeting/workshop recap pipeline that extracts decisions, tasks, risks and unresolved questions.
- Knowledge lifecycle with owner, source lineage, review status, expiry, superseded/conflict status.
- Consulting playbooks / skills exposed through a calm work-mode selector.

Should-have target capabilities:

- Enterprise connector catalog with source status and permission/indexing health.
- Cross-conversation intelligence for project recaps and weekly deltas.
- Research spaces / source-first workspace for deeper research sessions.
- Semantic history and memory search across conversations, artifacts, tasks and sources.
- Mobile / async continuation for approvals and review cards.

Out of scope for this documentation pass:

- Runtime implementation of new parsers, connectors, agents, versioning or lifecycle services.
- Claiming any market-parity capability as shipped without route/component/API/test evidence.
- Changing canonical ownership of project, task, decision, artifact or organization knowledge objects.

## 3. UI/UX Contract Directive For This Cycle

- Main screen remains `AIChatWelcomeView` / `UnifiedChatPanel` with explicit state contract.
- Runtime states must carry next-action guidance (loading, empty, error, degraded, success).
- Menu 3 placement for contextual AI actions is locked for this module (no duplicate toolbar in canvas).
- Chat + canvas functions must keep clear `UI Component Footprint` and provenance/approval semantics.
- Advanced market-parity capabilities must use minimalist UI patterns: small chips, dropdowns, source cards, side panels, compact approval/diff cards and Menu 3 right-side actions.
- Heavy always-visible toolbars under the prompt or in the canvas body remain forbidden.

## 4. BUILD CONTRACT Update Set

- Module contracts updated: `00_META.md` ... `07_ACCEPTANCE_AND_TESTS.md`
- Function contracts updated: `functions/CZ_CHAT_ENGINE.md`, `functions/CZ_CANVAS_WORKSPACE.md`
- Support contracts updated: `CODEMAP.md`, `STATUS.md`
- Implementation plan added: `IMPLEMENTATION_PLAN.md`
- Traceability binding refreshed with route/component/API/test evidence references in each critical section.
- Canvas startup backlog added as P0/P1/P2 without claiming runtime completion.

### 4.1 Implementation Plan Binding

`IMPLEMENTATION_PLAN.md` is the deployment-ready plan for the next runtime work cycle. It freezes the delivery order:

1. P0: finish Canvas startup and prove `conversation -> canvas draft -> review_required -> accept/reject -> owner-lane read-back`.
2. P1: add first governed expansions after startup, especially diff/apply/reject/rollback, run plans, source health and action review.
3. P2: preserve advanced RAW scope without blocking launch.

Do not implement P1/P2 Canvas capabilities before P0 is either complete or explicitly deferred by owner acceptance.

## 5. Scope Freeze (Locked Before Implementation)

### In scope (frozen)

- Contract hardening for `01_czat` docs only.
- Evidence linking for existing runtime behavior.
- Cross-module impact statement for handoffs to `02_moja-praca`, `05_inicjatywy`, `06_realizacja`.
- Documentation of market-parity target capabilities as target/deferred, with evidence status separated from shipped runtime claims.
- Closure of `01_czat` documentation cycle with Canvas marked `STARTUP_INCOMPLETE / NO_GO` until P0 path is evidenced.

### Out of scope (frozen)

- Runtime code changes.
- New route or API creation.
- Re-architecture of ownership for artifacts outside canonical lanes.
- Updating global handoff graphs, because this pass does not alter ownership or mutation flow.
- Claiming Canvas currently works end-to-end.

## 6. IMPACT — Cross-module and system effect

### 6.1 Neighbor modules

- `02_moja-praca`: Canvas can create or surface task/action candidates from artifact review, but they remain handoff pointers requiring explicit acceptance in the `02_moja-praca` owner lane; Canvas must not write personal work queue items silently.
- `05_inicjatywy`: Canvas can propose initiative candidates when an artifact/draft describes a larger change, but the initiative remains a proposal until accepted in `05_inicjatywy`; Canvas must preserve source refs and assumptions for initiative review.
- `06_realizacja`: Canvas can propose execution actions from approved artifacts, but execution records/tasks remain approval-gated and owner-lane materialized in `06_realizacja`.
- `09_outputs`: Canvas can prepare export/distribution candidates only after artifact owner-lane approval; final packaging/distribution remains the output lane.

### 6.2 Ownership and handoff invariants

- `01_czat` owns conversation runtime and proposal metadata.
- Canonical business object ownership remains in owner modules (no silent takeover by chat/canvas bridge).
- Handoff contract remains `proposal -> approval -> execution -> audit`.
- Canvas-specific handoff contract is `conversation intent -> canvas draft/proposal -> review/diff -> user approval -> owner-lane materialization -> read-back/audit`.
- Conversation-derived outputs use shared ownership (`01_czat` + owner module) until exported; Canvas must preserve `sourceRefs`, `evidenceRefs` and `approvalRefs`.

### 6.3 Security / tenancy / permissions impact

- No boundary broadening in this cycle.
- Tenant/project ACL posture remains deny-by-default when authorization context is uncertain.
- No change to sensitive data handling rules; contract only makes them explicit.
- Canvas must show degraded/restricted state when source, project, artifact or owner-lane ACL cannot be confirmed.
- Source/knowledge promotion from Canvas remains blocked unless explicit scope and approval are present.

### 6.4 E2E workflow impact

- Clarified workflow continuity: `conversation -> proposal -> owner-module execution path`.
- No change in runtime topology; only contract fidelity and test traceability improved.
- New target workflows are documented as future capability: `conversation -> source scope -> run plan -> artifact/diff or recap -> approval -> owner-module execution`.
- Canvas E2E target is now explicitly traceable as `conversation -> canvas draft -> review/diff -> approval -> owner-lane materialization -> read-back -> output/work queue handoff`.
- Current status for that full Canvas E2E target is `target/deferred` because no dedicated e2e suite proves the entire bridge lifecycle.
- Startup E2E target is narrower and P0: `conversation -> canvas draft -> review_required -> accept/reject -> owner-lane read-back`.
- Current status for startup E2E target is `NO_GO`; this is the work needed to finish the module start.

### 6.5 System-level contract changes

- No mandatory global contract mutation is executed in this cycle; impact remains within module-level contract hardening.
- No `MODULE_INTERACTION_GRAPH.md` / `ARTIFACT_LINEAGE_MATRIX.md` update is required in this pass because handoff direction and canonical ownership did not change.
- Verified global handoff docs already represent chat as proposal/handoff source:
  - `docs/modules/MODULE_INTERACTION_GRAPH.md`
  - `docs/modules/ARTIFACT_LINEAGE_MATRIX.md`
- Proposed follow-up, not in current scope: add a dedicated Canvas E2E row to system-level traceability once runtime evidence exists for diff/apply/reject/rollback and owner-lane read-back.

## 7. Risks and Hard Stops

- `BLOCKED_P1` hard stop if any new claim lacks route/component/API/test evidence.
- `NO_GO` hard stop if Canvas is described as working before P0 startup baseline passes.
- Hard stop if documentation claims silent mutation or bypass of approval.
- Hard stop if handoff ownership is ambiguous between chat and owner modules.
- Hard stop if a target/deferred market-parity capability is described as shipped without evidence.
- Hard stop if a new advanced action is placed as a persistent heavy toolbar instead of progressive disclosure/Menu 3.

## 8. Gate Log

- docs rerun gate: `PASS` (`npm run docs:contract:rerun-gate`)
- docs pr gate: `INCONCLUSIVE` in local workspace (missing PR body metadata, not contract-content failure)
- market-parity addendum rerun gate: `PASS` (`npm run docs:contract:rerun-gate`, 2026-05-10)
- Canvas startup correction rerun gate: `PASS` (`npm run docs:contract:rerun-gate`, 2026-05-10)
- Drive sync snapshot: `ATTEMPTED_FAILED_NO_SCRIPT` (`server/scripts/drive-sync-snapshot.ts` not present in workspace)

## 9. Owner Acceptance

- business_owner_acceptance: accepted_on: `2026-05-10`
- tech_owner_acceptance: accepted_on: `2026-05-10`
- implementation_plan_acceptance: accepted_on: `2026-05-10`
- prior_contract_acceptance: yes, accepted_on: 2026-05-10
- acceptance_needed_after_gate: no
- approval_condition: fulfilled; owner accepted that `01_czat` documentation is complete for this cycle while `CZ_CANVAS_WORKSPACE` runtime startup remains `NO_GO`

### 9.1 Locked owner decision — P0 Canvas entrypoint

- decision_id: `CHAT_CANVAS_P0_ENTRYPOINT_LOCK`
- decision: P0 entrypoint is **selected chat output** (`conversation -> selected output -> canvas draft`).
- rationale:
  - fastest path to finish startup with minimal route risk,
  - direct continuity with RAW chain (`conversation -> artifact`),
  - avoids premature lane-route parity claims.
- implementation consequence:
  - keep internal/runtime bridge evidence,
  - do not block P0 on shared `"/ai/work-canvas?kind=*"` route exposure,
  - shared route remains target/deferred (`P1/P2`) unless separately approved.

## 10. PR Gate Metadata (ready to paste)

- impacted_modules: `01_czat`
- impacted_functions: `CZ_CHAT_ENGINE`, `CZ_CANVAS_WORKSPACE`
- business_owner_acceptance: `accepted`
- tech_owner_acceptance: `accepted`
- implementation_plan_status: `APPROVED_FOR_DOCS`
- market_parity_addendum_status: `APPROVED_FOR_DOCS_TARGET_DEFERRED`
- canvas_startup_status: `STARTUP_INCOMPLETE / NO_GO`

## 11. Open Questions / Deferred Follow-up

- `OPEN_QUESTION`: exact Menu 3 slot mapping for each chat sub-state is not fully enumerated in runtime component matrix.
  - owner: user
  - target_date: 2026-06-15
- `OPEN_QUESTION`: final runtime scope contract for attachment/source knowledge writes must define when chat attachments stay conversation-only versus personal/project/team/organization context.
  - owner: user
  - target_date: 2026-06-15
- `DEFER_P2`: implementation evidence for project instructions, shared project chat, agent run plan, artifact diff/versioning, connector catalog, source health, meeting recap and knowledge lifecycle.
  - owner: user
  - target_date: 2026-06-15
