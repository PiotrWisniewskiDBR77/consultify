---
module_id: MODULE_SETTINGS
doc_kind: PERMISSIONS
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Permissions & Security — Ustawienia

## Purpose

Define security, tenancy, ACL and approval rules for this module.

## Must

- User can edit own settings; admin/tenant settings require admin route and role.

Function-level enforcement applies uniformly to: `SET_SETTINGS_WORKSPACE`, `SET_POLICY_BOUNDARY_LINKS`.

## Global Security Rules

- MUST enforce tenant and project boundaries.
- MUST use deny-by-default when authorization is uncertain.
- MUST audit high-impact mutations and governance transitions.
- MUST NOT expose secrets, raw internals, stack traces or sensitive payloads to business users.

## Should

- SHOULD show locked/unauthorized states with safe explanation and no sensitive leakage.
- SHOULD separate read permissions from mutation/approval permissions.

## Acceptance Criteria

- [ ] Unauthorized users cannot view or mutate protected objects.
- [ ] High-impact actions require explicit approval and produce audit evidence.
- [ ] Sensitive data remains scoped to allowed tenant/project/user context.
