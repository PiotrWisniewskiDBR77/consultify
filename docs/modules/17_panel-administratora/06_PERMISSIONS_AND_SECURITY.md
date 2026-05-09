---
module_id: MODULE_ADMIN_PANEL
doc_kind: PERMISSIONS
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Permissions & Security — Panel Administratora

## Purpose

Opisać kontrakt uprawnień i bezpieczeństwa dla paneli adminowych: role, tenant boundaries, audit, oraz reguły “fail closed”.

## Must

- **MUST**: Dostęp do `/admin/*` jest ograniczony do ról tenant‑admin (min. `ADMIN`, plus `OWNER` jako special admin).
- **MUST**: Dostęp do `/superadmin/*` jest ograniczony do roli platformowej `SUPERADMIN`.
- **MUST**: Każda operacja zapisu sprawdza uprawnienia po stronie backendu; UI nie jest źródłem prawdy o ACL.
- **MUST**: Przy niepewności uprawnień/capabilities system zachowuje się deny‑by‑default (fail‑closed).

## Must Not

- MUST NOT: cross-tenant leakage.
- MUST NOT: ujawnianie ukrytych modułów/akcji użytkownikom bez uprawnień (w tym w nawigacji).
- MUST NOT: pokazywanie sekretów (API keys, tokens) bez redakcji i bez potrzeby operacyjnej.

## Should

- **SHOULD**: UI prezentuje jasne komunikaty “Denied” z guidance i linkiem do właściciela obszaru (Admin/Organization/Settings/SuperAdmin).

## Acceptance Criteria

- [ ] Brak sposobu na obejście ACL przez UI (deny-by-default przy niepewności).
- [ ] UI nie pokazuje raw internals ani stack trace użytkownikowi biznesowemu.

## Related Sources

- `DRD/consultify/docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_32_ADMIN_ENTERPRISE_2026-04-11.md` (enterprise IAM baseline)
- `DRD/consultify/docs/product/SUPERADMIN_V8_SSOT.md` (ownership model)

