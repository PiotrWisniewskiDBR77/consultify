---
module_id: MODULE_SETTINGS
doc_kind: ENTRYPOINT
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Ustawienia (Settings)

## Purpose

Moduł `Ustawienia` (`/settings/*`) to powierzchnia **preferencji użytkownika** i wybranych ustawień “ownership panels” (tenant‑defaults/branding/security), które często są **read‑only** i przekierowują zmiany do `Panel Administratora` (Admin) lub `Organizacja` (Organization) zgodnie z ownership.

To nie jest “drugi Admin”: Settings nie może stać się równoległym rootem dla krytycznych tenant write surfaces.

## Where is the contract?

- Kontrakt zachowania: `03_BEHAVIOR.md`
- Kontrakt UI/UX: `04_UI_UX.md`
- Zakres i granice: `02_SCOPE.md`
- Źródła prawdy: `SSOT.md`

