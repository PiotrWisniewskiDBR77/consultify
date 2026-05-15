---
module_id: MODULE_MY_WORK
doc_kind: PERMISSIONS
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Permissions & Security — Moja Praca / My Work

## Purpose

Define security, tenancy, ACL and approval rules for this module.

## Must

- User sees only work allowed by tenant/project/object permissions.
- Private notes and memory candidates stay private until explicitly promoted.

Function-level enforcement:

- `MW_MANAGER` MUST remain role-gated with explicit denied state.
- `MW_IDEAS_*` subfunctions MUST not bypass owner-module approval/mutation boundaries during conversion.
- `MW_TASKS` and `MW_DECISIONS` mutations MUST stay explicit and auditable.

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
