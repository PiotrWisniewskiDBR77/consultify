---
module_id: MODULE_SETTINGS
doc_kind: PERMISSIONS
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Permissions & Security — Ustawienia (Settings)

## Purpose

Opisać kontrakt uprawnień i security dla Settings: user‑scoped vs org/tenant‑scoped; bezpieczne obchodzenie się z sekretami; deny‑by‑default.

## Must

- **MUST**: Settings nie pokazuje sekcji/akcji bez uprawnień (deny-by-default).
- **MUST**: Sekrety (API keys) mają redakcję i ograniczenia ekspozycji (minimum necessary).
- **MUST**: Dla tenant‑critical write surfaces Settings jest read‑only i kieruje do Admin/Organization.

## Must Not

- MUST NOT: cross-tenant leakage.
- MUST NOT: ujawnianie ukrytych modułów/akcji użytkownikom bez uprawnień.

## Should

- TBD

## Acceptance Criteria

- [ ] Brak sposobu na obejście ACL przez UI (deny-by-default przy niepewności).
- [ ] UI nie pokazuje raw internals ani stack trace użytkownikowi biznesowemu.

## Related Sources

- `DRD/consultify/docs/modules/ADMIN_SETTINGS_SUPERADMIN_CONTRACT_INVENTORY.md`

