---
module_id: MODULE_EXECUTION
doc_kind: PERMISSIONS
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Permissions & Security — Realizacja (Execution)

## Purpose

Uprawnienia i bezpieczeństwo w Execution: kto widzi portfolio, kto może interweniować, i jak utrzymujemy tenant/ACL safety.

## Must

- MUST: respektować effective roles i ACL z projektów/inicjatyw (Execution nie jest osobnym światem uprawnień).
- MUST: interwencje operatora są role-gated i audytowalne.

## Must Not

- MUST NOT: cross-tenant leakage.
- MUST NOT: silent execution (mutacje bez jawnej akcji/propozycji i audytu).

## Should

- SHOULD: deny-by-default dla write actions, gdy brakuje jednoznacznego uprawnienia.

## Acceptance Criteria

- [ ] Brak sposobu na obejście ACL przez UI (deny-by-default przy niepewności).
- [ ] UI nie pokazuje raw internals ani stack trace użytkownikowi biznesowemu.

## Related Sources

- `DRD/consultify/docs/product/ROLES_MODEL.md`
- `DRD/consultify/docs/product/TASK_AND_DECISION_RUNTIME_CONTRACT_V8.md`

