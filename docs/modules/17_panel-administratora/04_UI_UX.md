---
module_id: MODULE_ADMIN_PANEL
doc_kind: UI_UX
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# UI/UX — Panel Administratora (Admin + SuperAdmin)

## Purpose

Zdefiniować UI/UX dla powierzchni adminowych: IA (drzewo sekcji), stany (loading/empty/degraded/error), komunikaty governance, oraz placement akcji (w tym AI actions) zgodnie z globalnymi invariantami.

## Must

- **MUST**: Jasno komunikować scope:
  - Admin = tenant, SuperAdmin = platform (cross‑tenant).
- **MUST**: Każda krytyczna akcja ma jawny stan wykonania i rezultat (toast/banner + szczegóły gdzie trzeba).
- **MUST**: W UI pokazać degraded/partial stany zamiast “udawać OK”.
- **MUST**: Akcje AI (jeśli kontekstowe dla panelu) są w **Menu 3 / command row** (bez duplikacji w canvas).

## Must Not

- **MUST NOT**: Pokazywać surowych payloadów, stack trace, lub danych cross‑tenant w tenant Admin.
- **MUST NOT**: Używać “stubbed save” dla mounted production surfaces (brak fake success).

## Should

- **SHOULD**: Wspólne komponenty dla komunikatów governance: “Denied”, “Managed elsewhere” + deep‑link.
- **SHOULD**: Dostarczyć szybkie ścieżki remediation dla integracji (needs_reauth/error/disabled).

## Acceptance Criteria

- [ ] UI/UX nie łamie invariantów z `DRD/UI_UX_SOURCE_OF_TRUTH.md`.
- [ ] Kontekstowe akcje AI są w “Menu 3 / command row” zgodnie z regułami globalnymi.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md`
- `DRD/consultify/docs/modules/ADMIN_SETTINGS_SUPERADMIN_CONTRACT_INVENTORY.md`
- `DRD/consultify/docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_32_ADMIN_ENTERPRISE_2026-04-11.md`

