---
module_id: MODULE_CHAT
doc_kind: DATA
version: 2.0
owner: user
status: canonical
last_updated: 2026-05-10
---

# Data & Integrations — Czat / Teresa Chat Engine

## Purpose

Define module objects, integrations and lineage responsibilities.

## Core Objects

- Conversation, message, attachment, source link, memory candidate, tool call, proposal, approval and artifact handoff are first-class records.
- Raw sensitive payloads MUST NOT be exposed in UI/logs; use citations, summaries and governed source links.
- Created artifacts MUST carry provenance back to conversation and source pack.
- Target market-parity objects include project instruction set, source/knowledge scope, agent run plan, artifact diff/version, source health, meeting recap extraction and knowledge lifecycle record.
- Unless explicitly approved, chat-added files/links are target-modeled as conversation-scoped sources, not automatic organization knowledge.

Evidence:

- API: `server/src/routes/conversations.routes.ts`, `server/src/routes/ai.routes.ts`
- policy: `server/src/services/ai/chatPolicyGateway.ts`
- component: `src/components/AIChat/MessageRenderer.tsx`, `src/components/AIChat/V8ArtifactRunControl.tsx`
- test: `tests/integration/ai/ai-chat.routes.test.ts`, `server/src/services/ai/__tests__/chatPolicyGateway.contract.test.ts`

## Function Data Responsibilities

| Function | Primary data responsibility | Integration responsibility |
| --- | --- | --- |
| `CZ_CHAT_ENGINE` | conversation/message state, citations, proposal metadata, target source/knowledge scope and run-plan candidate state | stream/runtime APIs, conversation persistence, contextual retrieval, future connector/source health surfaces |
| `CZ_CANVAS_WORKSPACE` | startup draft artifact identity, source/provenance state, review-required state, accept/reject/edit decision state, owner-lane read-back reference, target diff/version review state | runtime rollout panels, governed artifact pipeline handoff, future artifact diff/apply/rollback surfaces |

## Canvas P0 Data Contract

Canvas startup requires a minimal artifact candidate object before it can be launchable:

| Field | Purpose | Requirement |
| --- | --- | --- |
| `draft_id` | Stable draft identity before materialization. | P0 |
| `artifact_type` | Distinguishes document, table, presentation/deck outline. | P0 |
| `source_conversation_id` | Links draft to conversation. | P0 |
| `source_message_ids` | Links draft to selected chat output(s). | P0 |
| `sourceRefs` / `evidenceRefs` | Preserves provenance. | P0 when sources exist |
| `no_source_reason` | Explains ungrounded candidate. | P0 when no source exists |
| `review_status` | `draft_loaded`, `review_required`, `accepted`, `rejected`, `materialized`, `failed`. | P0 |
| `owner_lane_target` | Document/table/presentation/output/work queue handoff target. | P0 |
| `owner_lane_readback_ref` | Confirms created/updated owner object after accept. | P0 |
| `project_link_ref` | Links artifact to project or records explicit unlinked state. | P0 |
| `audit_ref` | Links materialization/rejection/action evidence. | P0 |
| `client_internal_state` | Marks internal/client-ready/export warning state. | P0 before export/materialization |

## Must

- MUST keep stable identifiers for durable objects.
- MUST preserve source/provenance when objects are generated, imported, exported or converted.
- MUST record integration calls and important transformations with enough metadata for audit.
- MUST distinguish conversation-only, personal, project/team, organization and no-retention knowledge destinations when source promotion is implemented.
- MUST keep source health/freshness, parser quality and permission/indexing state visible to the UI layer when such metadata exists.

## Must Not

- MUST NOT duplicate another module's canonical object as an independent source of truth.
- MUST NOT expose raw sensitive payloads where summaries/source links are sufficient.
- MUST NOT bypass canonical owner modules for task/decision/initiative/artifact finalization.
- MUST NOT write uploaded source extraction into shared knowledge context when user selected private/no-retention or conversation-only scope.
- MUST NOT claim connector/catalog/source-health data exists unless a real integration/indexing state backs it.

## Should

- SHOULD prefer links and ownership references over copied data.
- SHOULD make stale or partial data visible to the UI layer.
- SHOULD implement knowledge lifecycle with owner, source lineage, review status, expiry, superseded/conflict status and withdrawal path before organization-level promotion is treated as done.
- SHOULD keep meeting recap outputs as candidates (summary, decisions, tasks, risks, open questions) until user approval.

## Acceptance Criteria

- [ ] Every durable object has owner module, source/provenance and lifecycle state where applicable.
- [ ] Cross-module handoff preserves lineage.
- [ ] Integration failures do not corrupt local canonical state.
- [ ] Handoff from chat to `02_moja-praca`, `05_inicjatywy`, `06_realizacja` remains proposal/candidate first (no silent owner mutation).
- [ ] Target source/knowledge scope is documented separately from current shipped attachment ingestion evidence.
- [ ] Future market-parity data objects have owner module and lifecycle before implementation starts.
- [ ] Canvas P0 startup object has `draft_id`, `artifact_type`, source/provenance state, review state, owner-lane target, read-back reference and audit reference before launch can be marked done.

## Related Sources

- `DRD/consultify/docs/product/CHAT_V8_SSOT.md`
- `DRD/consultify/docs/product/CHAT_V8_CONTROL_SURFACE_SPEC.md`
- `DRD/consultify/docs/product/CHAT_V8_AI_GOVERNANCE.md`
- `DRD/consultify/docs/product/CHAT_V8_SHARING_AND_PERMISSIONS.md`
- `DRD/consultify/docs/product/CHAT_V8_ENTERPRISE_AND_COMPLIANCE.md`
- `DRD/consultify/docs/product/CHAT_AND_AGENT_FUNCTIONAL_COMPLETENESS_AUDIT_V8.md`
- `DRD/consultify/docs/UI_UX/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md`
