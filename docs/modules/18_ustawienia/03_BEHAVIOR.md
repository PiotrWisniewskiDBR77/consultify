---
module_id: MODULE_SETTINGS
doc_kind: BEHAVIOR
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Behavior — Ustawienia (Settings)

## Purpose

Opisać kontrakt zachowania Settings: nawigacja po sekcjach, zapis preferencji, stany UI, i handoff do Admin/Organization gdy write surface jest poza Settings.

## Must

- **MUST**: Zapisy preferencji user‑scoped są realne (backend SSOT) albo jawnie oznaczone jako “stub” (NO fake success).
- **MUST**: Dla sekcji zależnych od org/tenant resolvera UI pokazuje resolved state + jasne “managed elsewhere” gdy write surface jest w Admin/Organization.
- **MUST**: Error posture:
  - brak infinite spinner,
  - retry i komunikaty zgodne z globalnymi standardami.

## Must Not

- **MUST NOT**: Utrzymywać “ukrytych” zapisów w localStorage jako substytutu SSOT dla produkcyjnych sekcji.
- **MUST NOT**: Pokazywać “Saved” jeśli backend nie potwierdził zapisu.

## Should

- **SHOULD**: Deep‑link do Admin leaf (np. security/collaboration) dla tenant‑enforced keys.

## Acceptance Criteria

- [ ] Dla każdej sekcji w inventory można określić: real/partial/stub i UX zachowuje się uczciwie.

## Related Sources

- `DRD/consultify/docs/modules/ADMIN_SETTINGS_SUPERADMIN_CONTRACT_INVENTORY.md`

