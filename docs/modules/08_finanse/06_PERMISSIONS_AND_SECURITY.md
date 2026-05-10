---
module_id: MODULE_FINANCE
doc_kind: PERMISSIONS
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Permissions & Security — Finanse / Finance & Intelligence

## Purpose

Define security, tenancy, ACL and approval rules for this module.

## Must

- Financial data is sensitive; access and exports require role and tenant control.
- AI must not fabricate figures or sources.

Function-level enforcement applies uniformly to: `FN_STATEMENTS_WORKSPACE`, `FN_MODELS_WORKSPACE`, `FN_ANALYSIS_WORKSPACE`, `FN_PREDICTION_WORKSPACE`, `FN_VALUATION_WORKSPACE`, `FN_INVESTMENT_WORKSPACE`, `FN_FINANCE_DETAIL_ROUTES`.

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
