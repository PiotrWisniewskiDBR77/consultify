---
module_id: MODULE_CHAT
doc_kind: UI_UX
version: 2.0
owner: user
status: canonical
last_updated: 2026-05-10
---

# UI/UX — Czat / Teresa Chat Engine

## 1. Main Screen

As-Is:

- `/chat` renders `AIChatWelcomeView` in `MainLayout`.
- `/chat/:conversationId` renders `UnifiedChatPanel` in `MainLayout`.
- `/internal/v10-runtime` renders `V10RuntimeWorkspaceView` as internal runtime bridge.

Main screen job: conversational intake and governed action guidance (response, sources, proposal cards, next actions), not autonomous execution.

Evidence bundle:

- route: `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx`
- component: `src/views/AIChatWelcomeView.tsx`, `src/components/AIChat/UnifiedChatPanel.tsx`, `src/views/V10RuntimeWorkspaceView.tsx`
- API: `server/src/routes/ai.routes.ts`, `server/src/routes/conversations.routes.ts`
- test: `tests/components/AppRoutes.ai-chat-routing.test.tsx`, `tests/components/AIChat/UnifiedChatPanel.test.tsx`

## 2. Runtime States

- Loading: user sees explicit loading/streaming cues and can wait or cancel.
- Empty: user sees prompt suggestions and guidance ("what to ask next").
- Error: UI shows guarded failure copy/toast; no raw internals.
- Degraded: empty or policy-limited responses are labeled as degraded and include recovery action.
- Success: answer/proposal is visible with distinction between AI suggestion and approved action.

Next-action policy per state:

- loading -> wait/cancel
- empty -> pick suggestion/compose prompt
- error -> retry/change scope/report issue
- degraded -> inspect missing data/citations and retry
- success -> continue, create candidate artifact/task/decision, or review sources

## 3. Menu 2 / Menu 3 Contract

Menu contract:

- Menu 2: module navigation entry (`AI_CHAT`) and global lane context.
- Menu 3: local command row for active conversation context and contextual AI actions.
- No second contextual toolbar is allowed under metadata strip or in canvas body.

## 4. AI Actions Placement

Contextual AI controls stay in Menu 3 / command row right slot only.

- Allowed in-message controls: message-local actions (copy/regenerate/branch for that message only).
- Forbidden: duplicating the same contextual action in both canvas body and Menu 3.
- Policy source: `docs/modules/UI_UX_CONTRACT_INDEX.md`, `.cursor/rules/ai-actions-menu3.mdc`.

## 5. Next Action Guidance

Every start, response, proposal, failure and degraded state must answer what happens next: continue the conversation, approve a proposal, inspect citations, retry, change context or contact support/admin.

## 6. Input Action Bar Contract

The input action bar is the primary user control layer for deciding how Teresa should work before a prompt is sent.

Component footprint:

- `src/components/AIChat/WorkModeMenu.tsx` — preset selector (`Szybko`, `Dokumenty`, `Deep Web`, `Prywatnie`, `Multi-agent`, `Client-ready`).
- `src/components/AIChat/AddFilesMenu.tsx` — file, URL, connected cloud source and recent attachment entry.
- `src/components/AIChat/ToolsMenu.tsx` — explicit AI mode toggles including `webSearch`, `deepResearch`, reasoning, multi-agent, private mode, TTS and response style.
- `src/components/AIChat/CoThinkerMenu.tsx` — Consultify-specific advisor/persona selection.
- `src/components/AIChat/ActiveModeStrip.tsx` — visible pre-send state for preset, web, private, deep, agents and model/tier.

Work mode preset matrix:

| Preset | Runtime flags | User promise |
| --- | --- | --- |
| `Szybko` | `deepResearch=false`, `webSearch=false`, `responseStyle=concise` | fast, low-depth answer |
| `Dokumenty` | `coThinkerMode=executive_editor`, `responseStyle=professional` | file/document-oriented drafting |
| `Deep Web` | `deepResearch=true`, `webSearch=true`, `showReasoning=true` | research-oriented answer with visible reasoning/progress |
| `Prywatnie` | `privateMode=true`, `webSearch=false` | no memory injection and safer internal mode |
| `Multi-agent` | `multiAgent=true`, `webSearch=true`, `showReasoning=true` | multiple perspectives and critique |
| `Client-ready` | `responseStyle=executive`, `coThinkerMode=executive_editor` | external-safe executive output |

Web/data-scope visibility rule:

- `webSearch` must be visible as a first-class user-controlled mode.
- Active state must be visible before sending through `ActiveModeStrip`.
- If private/restricted posture conflicts with public web usage, UI or backend policy must degrade honestly and not imply source access that was not used.

## 7. Side Panel Context Contract

When `UnifiedChatPanel` is rendered in split mode by `MainLayout`, `SplitLayout`, `ChatOverlay` or workspace shells, Teresa acts as context-aware support for the current module/object.

- Side panel must show current context (`workspaceContext`) through `ContextBadge` and a context card.
- Side panel quick actions (`Summarize screen`, `Find risks`, `Task candidate`, `Decision candidate`) are prompt starters only.
- Side panel quick actions must not write tasks, decisions, artifacts or initiatives directly; they produce candidates/proposals that follow owner-module approval.
- Context card must state the boundary: suggestions only, mutations require approval.

Evidence:

- component: `src/components/AIChat/UnifiedChatPanel.tsx`, `src/layouts/MainLayout.tsx`, `src/components/layout/SplitLayout.tsx`
- data/context: `src/types/workspace.ts`

## 8. Canvas Workspace UI Contract

Canvas job:

- The primary user job on Canvas is to convert a Teresa conversation output into a reviewable artifact/workspace candidate while preserving source lineage, approval state and owner-lane handoff.
- Canvas is a workbench, not a second chat transcript and not an unrestricted write lane.
- The target work pattern is `conversation -> draft -> artifact -> edit -> approve -> export -> link to project`, with shipped claims limited to available route/component/API/test evidence.
- Current operational truth: Canvas is `STARTUP_INCOMPLETE / NO_GO` for launch. The UI contract below defines what must be visible to finish startup; it must not be read as evidence that Canvas currently works end-to-end.

Startup UX baseline:

| Startup requirement | Required UX behavior | Launch gate |
| --- | --- | --- |
| Entry | User can open Canvas from a Teresa conversation or explicit module entry without a misleading gated shell. | P0 |
| Empty start | If no artifact candidate exists, Canvas shows what to do next instead of a blank work area. | P0 |
| Draft load | One selected chat output can load/create one visible draft artifact candidate. | P0 |
| Review required | Candidate is labeled as AI-generated/proposed and cannot become durable without user decision. | P0 |
| Accept/reject | User can accept or reject the candidate; reject creates no durable mutation. | P0 |
| Owner-lane read-back | Approved candidate returns visible read-back from the owner lane before Canvas calls it materialized. | P0 |
| Failure explanation | Route, rollout, source, ACL, API and owner-lane failures are distinguishable. | P0 |

Canvas states:

| State | User-visible behavior | Required next action guidance | Evidence status |
| --- | --- | --- | --- |
| Loading | Runtime/artifact/run context shows skeleton, spinner or pending status. | Wait, cancel, or return to conversation. | required for startup |
| Empty | No active artifact/workspace context shows a start state instead of blank canvas. | Create draft from message, choose document/sheet/deck lane, or continue chat. | required for startup |
| Error | Guarded failure copy; no raw provider/internal errors. | Retry, change scope, reopen conversation, or report issue. | required for startup |
| Degraded | Route gated, rollout disabled, missing source refs, missing ACL, unknown source freshness or partial run is labeled honestly. | Inspect missing evidence, select allowed owner lane, or defer materialization. | required for startup |
| Review required | Draft candidate exists but has not been accepted or rejected. | Inspect source/provenance, accept, reject, or return to chat. | required for startup |
| Success | Approved candidate has owner-lane read-back and visible next action. | Open owner surface, export if eligible, link back to project, or continue chat. | not current truth until P0 passes |

Canvas AI action placement:

- Contextual AI actions for Canvas must live in Menu 3 / local command row right-side slot.
- Canvas body may show artifact content, review cards and direct artifact-state controls only when tied to the selected artifact/diff.
- The same action must not be duplicated in Menu 3 and in the canvas body.
- Message-local controls in chat remain message-local and cannot silently mutate canvas artifacts.

Source/provenance/evidence visibility:

- Artifact candidates must expose `sourceRefs`, `evidenceRefs`, citation refs or an explicit no-source state.
- Model/tool/source traceability is required for high-impact artifact materialization.
- Source health/freshness UI is target/deferred and must not be presented as shipped until runtime evidence exists.
- Client-ready output must show restricted-source/redaction warnings before export or materialization once implemented.

Approval/review/diff flow:

- High-impact Canvas changes follow `proposal -> preview/diff -> accept/reject -> execution -> read-back/audit`.
- Document/sheet/deck changes must not silently apply from chat chips, message actions or Canvas shortcuts.
- Full artifact versioning, apply/reject and rollback are target/deferred until route/component/API/test evidence proves the lifecycle.
- Owner-lane read-back is required before Canvas may show a durable object as materialized.

Anti-patterns:

- Treating `KimiWorkspaceShell` component existence as proof that `/wordy`, `/excele` or `/prezentacje` are production-ready.
- Adding a second contextual AI toolbar inside Canvas.
- Hiding degraded route/rollout/source/ACL states.
- Presenting source-free business claims as verified artifact truth.
- Letting Canvas become canonical owner for tasks, decisions, initiatives, execution records or exported outputs.

Evidence:

- route: `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx`
- component: `src/views/V10RuntimeWorkspaceView.tsx`, `src/components/Admin/ChatV10RuntimesPanel.tsx`, `src/components/AIChat/KimiWorkspace/KimiWorkspaceShell.tsx`, `src/components/AIChat/V8ArtifactRunControl.tsx`, `src/components/AIChat/UnifiedChatPanel.tsx`
- API: `src/services/api.ts`, `server/src/routes/artifact-runs.routes.ts`, `server/src/routes/conversations.routes.ts`
- test: `tests/components/Admin/ChatV10RuntimesPanel.test.tsx`, `tests/components/AIChat/AIChatWelcomeView.v8-controls.test.tsx`, `src/hooks/v10/__tests__/runtimeCapabilities.test.ts`, `src/utils/__tests__/chatV10Rollout.test.ts`

## 9. Minimalist Market-Parity UI Contract

Advanced chat capabilities must preserve a calm, lightweight main surface. The default user experience is a simple conversation input with a visible active posture, while expert controls stay behind small buttons, chips, dropdowns, source cards, side panels or Menu 3 actions.

Target capability placement:

| Capability | Target UI placement | Status |
| --- | --- | --- |
| Project instructions / workspace rules | compact project chip + project settings panel | target/deferred |
| Shared project chat / team collaboration | small sharing icon near conversation title + dropdown | target/deferred |
| Agent run plan | compact `Plan działania` card before execution | target/deferred |
| Artifact diff/versioning | side-panel diff/review card in workspace/canvas | target/deferred |
| Enterprise connector catalog | Source/Add menu + settings view, not persistent toolbar | target/deferred |
| Source health/freshness | small badges on source cards/citations | target/deferred |
| Meeting/workshop recap | compact extraction card with accordions | target/deferred |
| Knowledge lifecycle | knowledge/source status badge + details drawer | target/deferred |
| Consulting playbooks / skills | Work Mode menu presets + `more playbooks` dropdown | target/deferred |
| Client-ready redaction | single chip/toggle + pre-export warning card | target/deferred |

UI rules:

- Keep the input bar limited to Work Mode, Add, Tools, Co-thinker, send/voice/stop and the active mode strip.
- Do not add persistent large toolbars under the input for project rules, source health, agent plans or knowledge lifecycle.
- Use side panels and Menu 3 / command-row right slots for contextual controls.
- Show heavy details only when the user expands a card, opens a source, reviews a diff or approves a plan.

Evidence:

- as-is component pattern: `src/components/AIChat/EnhancedChatInput.tsx`, `src/components/AIChat/WorkModeMenu.tsx`, `src/components/AIChat/AddFilesMenu.tsx`, `src/components/AIChat/ToolsMenu.tsx`, `src/components/AIChat/ActiveModeStrip.tsx`, `src/components/AIChat/UnifiedChatPanel.tsx`
- target source: `docs/UI_UX/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md` section `18A`

## 10. Source / Evidence / Provenance

Citations/source lists are part of the chat surface and must be visible for claims, recommendations, generated outputs and decisions. If sources are missing, Teresa must say so explicitly instead of implying grounded evidence.

Canvas extension:

- Canvas artifact candidates inherit this rule and must keep source/provenance visible at the artifact/review level, not only in the original chat message.
- If a Canvas artifact is created from multiple messages, files or tool calls, the review state must show the source set or explicitly mark provenance as incomplete.
- Source/provenance visibility is required before client-ready export, owner-lane materialization, task/decision extraction or cross-module handoff.

Evidence:

- component: `src/components/AIChat/MessageRenderer.tsx`, `src/components/AIChat/CitationList.tsx`
- API/policy: `server/src/services/ai/chatPolicyGateway.ts`
- test: `server/src/services/ai/__tests__/chatPolicyGateway.contract.test.ts`

## 11. Approval / Diff / Review

High-impact actions proposed from chat follow `proposal -> approval -> execution -> audit`. Proposal cards must show what will change before execution; destructive or governance actions cannot execute silently.

Target extension:

- Agent run plans, artifact diffs, meeting recap extraction and knowledge promotion must be reviewable before execution/materialization.
- Review UI should be compact by default and expandable on demand.
- Canvas-specific target flow is `proposal -> preview/diff -> accept/reject -> execution -> read-back/audit`.
- Canvas must not show a durable artifact as materialized until owner-lane read-back confirms the created/updated object.

Evidence:

- component: `src/components/AIChat/V8ArtifactRunControl.tsx`
- API: `server/src/routes/conversations.routes.ts` (`execution_proposal` message type)
- test: `tests/components/AIChat/AIChatWelcomeView.v8-controls.test.tsx`

## 12. Anti-Patterns

- Raw provider/internal errors in the chat transcript.
- Infinite spinner without retry or degraded state.
- Hidden learning or background write outside an approved flow.
- AI action duplicated both in the canvas and Menu 3.
- Source-free business claims presented as verified truth.
- Work mode or web/source state hidden from the user before sending.
- Side panel quick action silently mutating owner-module objects.
- Persistent large toolbar for advanced market-parity functions under the prompt.
- Claiming project rules, connector catalog, agent plans, artifact diff/versioning or knowledge lifecycle as shipped until evidence exists.
- Claiming Canvas lane parity while `/wordy`, `/excele` or `/prezentacje` are gated/coming-soon.
- Applying document/sheet/deck changes from Canvas without preview/diff and explicit approval.

## 13. As-Is Gaps

- Existing docs confirm chat controls, citations and guarded fallbacks, but this contract does not yet enumerate every message-level state by component.
- Full evidence of audit trail rendering for every chat-initiated mutation remains to be validated in runtime.
- Menu 3 exact component-level slot mapping for each chat sub-state is not fully enumerated in runtime evidence (`OPEN_QUESTION`).
- Market-parity target capabilities are documented from RAW, but many remain implementation gaps: project instructions, shared project chat, agent run plan, artifact diff/versioning, source health UI, meeting recap pipeline, knowledge lifecycle and connector catalog.
- Canvas is not currently launch-ready as a user-facing workflow.
- Canvas startup path lacks proven UX for `entry -> empty/draft -> review required -> accept/reject -> owner-lane read-back`.
- Canvas has internal runtime and component evidence, but no dedicated e2e evidence for `conversation -> canvas draft -> review/diff -> approval -> owner-lane materialization -> read-back`.
- Canvas source-lineage and rollback UI are target/deferred, not shipped claims.

## 14. Acceptance Criteria

- `/chat` and `/chat/:conversationId` render the documented Teresa surfaces.
- Loading, empty, error, degraded and success states are visible and include next-step guidance.
- Contextual AI actions live in Menu 3/local command row and are not duplicated in canvas.
- Claims and exports show sources/provenance or an explicit no-source state.
- High-impact chat actions require approval/review before execution.
- Every critical acceptance claim has route/component/API/test evidence in this file or `07_ACCEPTANCE_AND_TESTS.md`.
- Input action bar exposes work mode, files, tools, co-thinker and active state before send.
- Side panel exposes current workspace context and proposal-only quick actions.
- Advanced market-parity targets are documented with minimalist UI placement and not represented as shipped unless evidence exists.
- Canvas workspace states cover loading, empty, error, degraded and success with next-action guidance.
- Canvas startup status remains `NO_GO` until the P0 Startup UX baseline in section 8 passes.
- Canvas artifact candidates expose source/provenance or explicit no-source state.
- Canvas high-impact materialization is blocked until review/approval and owner-lane execution path exist.
- Full Canvas diff/apply/reject/rollback remains marked deferred until evidence is complete.

## 11. Function Annex — Chat vs Canvas

Separate function contracts for this module:

| Function ID | Function | Entry / Route | As-Is state | UI Component Footprint (key) | Contract |
| --- | --- | --- | --- | --- | --- |
| `CZ_CHAT_ENGINE` | Teresa chat conversation engine | `"/chat"`, `"/chat/:conversationId"` | real | `AIChatWelcomeView`, `UnifiedChatPanel`, `EnhancedChatInput`, `WorkModeMenu`, `ToolsMenu`, `ActiveModeStrip`, `CitationList`, `TeresaProposalCard` | `functions/CZ_CHAT_ENGINE.md` |
| `CZ_CANVAS_WORKSPACE` | Chat canvas / workspace bridge | `"/internal/v10-runtime"` + workspace-linked chat flows | startup incomplete / no-go | `V10RuntimeWorkspaceView`, `ChatV10RuntimesPanel`, `V8ArtifactRunControl`, `KimiWorkspaceShell` | `functions/CZ_CANVAS_WORKSPACE.md` |
