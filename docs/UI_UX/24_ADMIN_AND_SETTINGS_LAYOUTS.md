---
uiux_doc_id: UIUX_ADMIN_SETTINGS_LAYOUTS
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Admin / Settings / SuperAdmin / Organization / Partner layouts

## Purpose

Zamknąć zasady layoutu i nawigacji dla “governance roots” i powiązanych powierzchni: Admin, Settings, SuperAdmin, Organization, Partner Portal.

## Applies To

`/admin/*`, `/settings/*`, `/superadmin/*`, `Organization` module, `/partner/*`.

## Must

- **MUST**: Admin (tenant) i SuperAdmin (platform) to osobne roots (routing, IA, permissions).
- **MUST**: Settings to preferencje user‑scoped + ownership panels; krytyczne tenant writes są w Admin/Organization.
- **MUST**: SuperAdmin ma własny shell i nie dubluje IA w globalnym sidebarze (sidebar działa jako launcher).
- **MUST**: Portal partnerski jest partner-facing; operator actions są w SuperAdmin.

## Must Not

- **MUST NOT**: Wykonywać cross‑tenant operacji z tenant Admin.
- **MUST NOT**: Utrzymywać “stubbed save” dla mounted produkcyjnych surfaces (no fake success).

## Acceptance Criteria

- [ ] Własność (ownership) jest spójna między P30/P31/P32/P33 i nie ma równoległych “prawd”.

## Related Sources

- `DRD/consultify/docs/modules/NAVIGATION_STRUCTURE.md`
- `DRD/consultify/docs/modules/ADMIN_SETTINGS_SUPERADMIN_CONTRACT_INVENTORY.md`
- `DRD/consultify/docs/modules/17_panel-administratora/*` (kontrakt modułowy)
- `DRD/consultify/docs/modules/18_ustawienia/*` (kontrakt modułowy)
- `DRD/consultify/docs/modules/19_portal-partnerski/*` (kontrakt modułowy)

