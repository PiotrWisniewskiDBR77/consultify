---
module_id: MODULE_OUTPUTS
doc_kind: PERMISSIONS
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Permissions & Security — Outputy (Outputs Library)

## Purpose

Kontrakt widoczności i uprawnień dla artefaktów w bibliotece (registry).

## Must

- MUST: “global discoverability” nie znaczy global visibility — artefakty są widoczne tylko w scope przyznanym userowi.
- MUST: minimalne visibility scopes: `private`, `project`, `organization`, `review_shared`, `demo`.

## Must Not

- MUST NOT: cross-tenant leakage.
- MUST NOT: ujawniać artefaktów spoza scope usera w search / list / deep link.

## Should

- SHOULD: review actions (submit/approve/reject) są role-gated i audytowalne.

## Acceptance Criteria

- [ ] Brak sposobu na obejście ACL przez UI (deny-by-default przy niepewności).
- [ ] UI nie pokazuje raw internals ani stack trace użytkownikowi biznesowemu.

## Related Sources

- `DRD/consultify/docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md`
- `DRD/consultify/docs/product/ROLES_MODEL.md`

