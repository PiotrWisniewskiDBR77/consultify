---
module_id: MODULE_SETTINGS
doc_kind: STATUS
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Status — Ustawienia (Settings)

## Shipping status

- **Status**: shipped (mixed: real/partial/stub per section)

## Known gaps (from existing SoT)

- Inventory zawiera wiele sekcji oznaczonych jako `stub` (np. theme, accessibility, shortcuts, import/export, templates, history, część AI privacy/voice) — to jest jawny dług i **nie może** być maskowane jako “real”.
- “Ownership panels” (tenant defaults/branding/security) muszą zachować granice: writes kierowane do Admin/Organization, nie do Settings.

## Risks

- Utrzymywanie stubbed settings w produkcyjnych mounted surfaces → ryzyko “fake success” i utraty zaufania.
- Niespójny podział ownership P30/P31/P32 → ryzyko błędnych zmian governance.

## Primary evidence / inventory

- `DRD/consultify/docs/modules/ADMIN_SETTINGS_SUPERADMIN_CONTRACT_INVENTORY.md`

