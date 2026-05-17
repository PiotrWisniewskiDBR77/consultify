---
module_id: MODULE_INITIATIVES
doc_kind: PERMISSIONS
version: 2.0
owner: user
status: review
last_updated: 2026-05-10
---

# Permissions & Security — Inicjatywy

## Purpose

Define security, tenancy, ACL and approval rules for this module.

## Must

- Role resolution and capabilities define all material actions.
- Governance transitions require authorized actor and audit trail.
- Backend effective-role resolution is the authority; frontend role display is not an authorization source.
- AI availability is governed by backend capabilities and cannot create authority.

Function-level enforcement applies uniformly to: `IN_PORTFOLIO_HUB`, `IN_ANALYSIS_WORKSPACE`, `IN_ROADMAP_VIEW`, `IN_PORTFOLIO_VIEW`, `IN_ROI_VIEW`.

## Global Security Rules

- MUST enforce tenant and project boundaries.
- MUST use deny-by-default when authorization is uncertain.
- MUST audit high-impact mutations and governance transitions.
- MUST NOT expose secrets, raw internals, stack traces or sensitive payloads to business users.

## Should

- SHOULD show locked/unauthorized states with safe explanation and no sensitive leakage.
- SHOULD separate read permissions from mutation/approval permissions.

## Initiative Card System Permissions

Initiative Card permissions are governed by `INITIATIVE_CARD_SYSTEM_CONTRACT.md`, `docs/product/INITIATIVE_CAPABILITIES_SYSTEM.md` and `docs/product/INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`.

- Backend capabilities are the source of truth for card editability, workflow CTAs, context create actions and AI availability.
- Frontend cards may display roles and locked states, but must not infer gate authority from local role matrices.
- Unauthorized or degraded card states must deny by default and explain safely without exposing tenant/project internals.
- Terminal `CANCELLED` and `ARCHIVED` cards must not expose create actions or active AI write actions.
- Consultant overlay may be visible/auditable, but does not grant authority by itself.

Evidence pointers:

| Evidence type | Pointer |
| --- | --- |
| Role resolution evidence | `docs/product/PROJECT_AND_INITIATIVE_ROLE_RESOLUTION_V8.md`; `docs/product/ROLES_MODEL.md`. |
| API/capabilities evidence | `server/src/services/initiative/initiativeAccessResolver.ts`; `server/src/controllers/InitiativeController.ts`. |
| UI policy evidence | `docs/product/INITIATIVE_CAPABILITIES_SYSTEM.md`; `docs/product/INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`. |

## Function Security Boundary Matrix

| Function | Protected actions | Authority source | Required UX state | Evidence status |
| --- | --- | --- | --- | --- |
| `IN_PORTFOLIO_HUB` | Create/edit/status transition/context create/AI actions. | `gate-readiness-check`, `initiativeAccessResolver`, write-governance helpers. | Locked/unauthorized/degraded states with safe explanation. | test `NOT_DONE` |
| `IN_ANALYSIS_WORKSPACE` | AI analysis, recommendations, readiness actions. | Backend capabilities and source/evidence policy. | Proposal/review before high-impact mutation. | test `NOT_DONE` |
| `IN_ROADMAP_VIEW` | Scheduling and timeline baseline actions. | Backend role and lifecycle readiness. | Roadmap does not hide unavailable scheduling authority. | test `NOT_DONE` |
| `IN_PORTFOLIO_VIEW` | Prioritization/value/status actions. | Backend capabilities; no local role inference. | Read-only state when capability is absent. | test `NOT_DONE` |
| `IN_ROI_VIEW` | ROI/value actions and tracking handoff. | Finance/results/initiative APIs with tenant and role checks. | Missing assumptions/evidence shown as degraded, not success. | test `NOT_DONE` |

## Acceptance Criteria

- [ ] Unauthorized users cannot view or mutate protected objects.
- [ ] High-impact actions require explicit approval and produce audit evidence.
- [ ] Sensitive data remains scoped to allowed tenant/project/user context.
- [ ] AI actions are disabled or blocked when backend capabilities deny them.

## Module Integration Permission Baseline

This permission baseline applies uniformly to all module functions after `05_inicjatywy/MODULE_INTEGRATION`.

| Permission claim | Source of truth | Integration status |
| --- | --- | --- |
| Editability and top-bar fields are backend-owned. | `GET /api/initiatives/:id/gate-readiness-check`, `capabilities.topBar.*`. | `PASS_DOC` |
| Workflow CTAs render only executable transitions. | `availableTransitions[].canCurrentUserExecute = true`. | `PASS_DOC`, UI regression missing |
| Context create actions are backend-owned. | `capabilities.ctaBar.contextCreateActions`. | `PASS_DOC`, UI regression missing |
| AI availability is backend-owned and right-side CTA only. | `capabilities.ctaBar.canUseAi`, `aiAllowedSectionKeys`, Menu 3 rules. | `PASS_DOC`, UI placement audit missing |
| Consultant overlay does not grant authority. | `INITIATIVE_GOVERNANCE_MODEL.md`, `INITIATIVE_CAPABILITIES_SYSTEM.md`. | `PASS_DOC` |
| Terminal states deny active writes. | `CANCELLED` / `ARCHIVED` rules in status-role-CTA matrix. | `PASS_DOC`, UI regression missing |

Security decision: if capability payload or effective-role evidence is unavailable, all material actions degrade to read-only / deny-by-default.
