---
uiux_doc_id: UIUX_TENANT_ACL_SAFETY
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Tenant & ACL safety in UI

## Purpose

Zamknąć zasady bezpieczeństwa UI dla multi-tenant i ACL: co UI może pokazać, jak komunikuje denial, i jak unika “security theater”.

## Applies To

Wszystkie powierzchnie aplikacji, szczególnie: Admin/SuperAdmin, sharing, AI context, integracje.

## Must

- **MUST**: Zero cross-tenant leakage (treść, metadane, identyfikatory, podpowiedzi).
- **MUST**: Backend jest boundary bezpieczeństwa; UI jest jedynie affordance.
- **MUST**: Przy braku dostępu UI zachowuje się deny-by-default: ukrywa albo blokuje akcje zgodnie z kontraktem modułu, z jasnym komunikatem.
- **MUST**: Dla “managed elsewhere” (np. Admin vs Settings vs Organization vs SuperAdmin) UI daje guidance i deep-link.

## Must Not

- **MUST NOT**: Reklamować nieuprawnionym użytkownikom istnienia ukrytych modułów/sekcji.
- **MUST NOT**: Polegać na frontendowym “hide/show” jako ochronie danych.

## Should

- **SHOULD**: Denial taxonomy jest stabilna (403/404/409 + czytelna wiadomość).

## Acceptance Criteria

- [ ] Denial jest czytelny i nie myli użytkownika.
- [ ] Nie ma leakage ani “UI hints” o obcych tenantach.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md` (Enterprise UI Invariants §5)
- `DRD/ROLE_PERMISSIONS_WORKFLOW_SOURCE_OF_TRUTH.md`
- `.cursor/rules/40-security-tenancy.mdc`

