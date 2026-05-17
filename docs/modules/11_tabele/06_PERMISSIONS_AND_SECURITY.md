---
module_id: MODULE_TABLES
doc_kind: PERMISSIONS
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Permissions & Security — Tabele / Table Studio

## Purpose

Define security, tenancy, ACL and approval rules for this module.

## Must

- Row/cell edits and imports respect artifact permissions and audit.
- Public/intake forms require explicit scoped write rules.

Function-level enforcement applies uniformly to: `TB_EXCELE_PLACEHOLDER`, `TB_TABLE_RUNTIME_TARGET`.

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
