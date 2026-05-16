---
module_id: MODULE_RESULTS
doc_kind: PERMISSIONS
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Permissions & Security — Rezultaty (Results)

## Purpose

Uprawnienia i bezpieczeństwo Results: kto może widzieć metryki, kto może edytować definicje, kto może wykonywać corrective actions oraz jak utrzymujemy tenant/ACL safety.

## Must

- MUST: respektować tenant/ACL; metryki i raporty nie mogą przeciekać między tenantami.
- MUST: write actions (np. corrective loop) są role-gated i audytowalne.

## Must Not

- MUST NOT: cross-tenant leakage.
- MUST NOT: ujawnianie danych finansowych w Results bez uprawnienia i bez jawnego linkage.

## Should

- TBD

## Acceptance Criteria

- [ ] Brak sposobu na obejście ACL przez UI (deny-by-default przy niepewności).
- [ ] UI nie pokazuje raw internals ani stack trace użytkownikowi biznesowemu.

## Related Sources

- `DRD/consultify/docs/product/ROLES_MODEL.md`

