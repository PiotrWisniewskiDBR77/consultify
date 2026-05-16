---
module_id: MODULE_DOCUMENTS
doc_kind: PERMISSIONS
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Permissions & Security — Dokumenty (Document Studio)

## Purpose

Uprawnienia i bezpieczeństwo dla dokumentów jako artefaktów (visibility scopes, review/publish, tenant safety).

## Must

- MUST: używać istniejącego auth middleware (brak nowego auth surface).
- MUST: visibility scopes i ACL są egzekwowane tak samo jak w v8.1 Outputs Library.
- MUST: deny-by-default gdy capabilities/ACL niepewne.

## Must Not

- MUST NOT: cross-tenant leakage.
- MUST NOT: ujawnianie treści dokumentu użytkownikom bez scope/ACL (również przez deep link).

## Should

- SHOULD: governance approval dla template registry i publish/review (inherited from v8.1).

## Acceptance Criteria

- [ ] Brak sposobu na obejście ACL przez UI (deny-by-default przy niepewności).
- [ ] UI nie pokazuje raw internals ani stack trace użytkownikowi biznesowemu.

## Related Sources

- `DRD/consultify/docs/product/CONSULTIFY_DOCUMENT_STUDIO_V1_SSOT.md`
- `DRD/consultify/docs/product/ROLES_MODEL.md`

