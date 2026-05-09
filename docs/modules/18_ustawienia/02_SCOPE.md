---
module_id: MODULE_SETTINGS
doc_kind: SCOPE
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Scope — Ustawienia (Settings)

## Purpose

Ustalić granice odpowiedzialności Settings (P31) wobec Admin (P32), Organization (P30) oraz SuperAdmin (P33).

## In scope (Must)

- Preferencje użytkownika: profil, avatar, signatures, working hours, dashboard/work preferences, regionalization, wybrane notyfikacje.
- Ustawienia AI użytkownika: behavior, model params, autocomplete, memory, usage (zgodnie z inventory).
- Read‑only “ownership panels” dla tenant defaults/branding/security, jeśli ich źródłem prawdy jest resolver (`organization-context`, settings registry) i/lub write surface jest gdzie indziej.

## Out of scope (Must Not)

- Tenant‑critical write surfaces (SSO/MFA/policies, membership/roles, integrations remediation, audit) → **Admin**.
- Business profile / strategic org workspace → **Organization**.
- Cross‑tenant operations / platform governance → **SuperAdmin**.

## Should

- Handoff (deep‑link) do właściwej powierzchni, gdy zmiana jest poza zakresem Settings.

## Acceptance Criteria

- [ ] Dla każdej sekcji Settings można wskazać: scope (user vs tenant), source of truth i write surface.

## Related Sources

- `DRD/consultify/docs/modules/ADMIN_SETTINGS_SUPERADMIN_CONTRACT_INVENTORY.md`

