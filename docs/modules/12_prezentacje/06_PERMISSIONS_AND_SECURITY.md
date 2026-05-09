---
module_id: MODULE_PRESENTATIONS
doc_kind: PERMISSIONS
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Permissions & Security — Prezentacje (Presentation Studio)

## Purpose

Uprawnienia i bezpieczeństwo dla decków: tenant/ACL, visibility scopes, share/export integrity, approvals.

## Must

- MUST: visibility scopes i ACL są egzekwowane zgodnie z v8.1 substrate (brak “global library leak”).
- MUST: deny-by-default jeśli capabilities/ACL niepewne.
- MUST: export/share i review actions są audytowalne.

## Must Not

- MUST NOT: cross-tenant leakage.
- MUST NOT: ujawniać decków lub ich treści przez deep link poza scope usera.

## Should

- SHOULD: source panel jest tenant-safe i pokazuje policy-blocked sources bez ujawnienia payloadów.

## Acceptance Criteria

- [ ] Brak sposobu na obejście ACL przez UI (deny-by-default przy niepewności).
- [ ] UI nie pokazuje raw internals ani stack trace użytkownikowi biznesowemu.

## Related Sources

- `DRD/consultify/docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md`
- `DRD/consultify/docs/product/ROLES_MODEL.md`

