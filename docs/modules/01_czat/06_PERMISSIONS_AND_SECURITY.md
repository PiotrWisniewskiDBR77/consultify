---
module_id: MODULE_CHAT
doc_kind: PERMISSIONS
version: 2.0
owner: user
status: canonical
last_updated: 2026-05-10
---

# Permissions & Security — Czat / Teresa Chat Engine

## Purpose

Define security, tenancy, ACL and approval rules for this module.

## Must

- Deny by default when tenant/project/source scope is uncertain.
- Sharing and memory must follow user/org/project visibility rules.
- Tool calls and approvals must be audited with actor, time, scope, inputs summary and outcome.
- Source/attachment promotion from conversation to personal, project/team or organization context must be explicit, permission-gated and auditable.
- Private/no-retention posture must block shared memory/organization-context writes for chat-added sources.
- Project instructions, shared chats, connector sources, agent run plans, artifact diffs and knowledge lifecycle actions must inherit the narrowest applicable tenant/project/source ACL.

Function-level enforcement:

- `CZ_CHAT_ENGINE` MUST never execute hidden high-impact actions from message content alone.
- `CZ_CANVAS_WORKSPACE` MUST keep governed plan/review boundaries explicit before downstream mutation/materialization.
- `CZ_CHAT_ENGINE` MUST treat market-parity source and memory features as target/deferred until permission/write guards have runtime evidence.
- `CZ_CANVAS_WORKSPACE` MUST remain `NO_GO` for launch until accept/reject/edit, owner-lane read-back, source/provenance, audit strip and client/internal gate are evidenced.
- `CZ_CANVAS_WORKSPACE` MUST expose artifact diff/apply/rollback as reviewable candidate flow, not silent materialization.

Evidence:

- API/security: `server/src/routes/conversations.routes.ts`, `server/src/services/chatPermissionService.ts`, `server/src/services/ai/chatPolicyGateway.ts`
- tests: `tests/unit/backend/chatPermissionService/canChat.test.ts`, `tests/unit/backend/chatPermissionService/checkChatPermission.test.ts`, `server/src/services/ai/__tests__/chatPolicyGateway.contract.test.ts`

## Global Security Rules

- MUST enforce tenant and project boundaries.
- MUST use deny-by-default when authorization is uncertain.
- MUST audit high-impact mutations and governance transitions.
- MUST NOT expose secrets, raw internals, stack traces or sensitive payloads to business users.
- MUST NOT let shared project chat, connector catalog or cross-conversation intelligence reveal conversations/sources the actor cannot already access.
- MUST NOT let meeting recap or knowledge lifecycle promotion create tasks/decisions/organization knowledge without approval and owner-lane ACL.

## Should

- SHOULD show locked/unauthorized states with safe explanation and no sensitive leakage.
- SHOULD separate read permissions from mutation/approval permissions.
- SHOULD show compact UI indicators for restricted, stale, blocked or private sources without exposing sensitive internals.

## Acceptance Criteria

- [ ] Unauthorized users cannot view or mutate protected objects.
- [ ] High-impact actions require explicit approval and produce audit evidence.
- [ ] Sensitive data remains scoped to allowed tenant/project/user context.
- [ ] Cross-module handoff from chat never bypasses owner-module ACL/mutation boundaries.
- [ ] Source/attachment knowledge destination is explicit before any future shared-context write.
- [ ] Market-parity target capabilities keep `proposal -> approval -> execution -> audit` for all high-impact actions.
- [ ] Canvas reject path creates no durable owner-lane mutation.
- [ ] Canvas accept path re-checks owner-lane ACL and returns read-back evidence before showing materialized state.
- [ ] Canvas export/materialization is blocked or warned when client/internal state is unsafe.
