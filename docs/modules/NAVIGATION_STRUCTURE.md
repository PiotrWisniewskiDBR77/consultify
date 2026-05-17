# Navigation structure — Admin / Settings / SuperAdmin

Status: canonical-for-navigation (as-is routing truth)  
Last updated: 2026-05-09

## Purpose

Ten dokument jest **SSOT dla nawigacji** trzech “governance roots” w aplikacji:

- `Settings` (`/settings/*`) — user‑scoped preferences + wybrane ownership panels (często read‑only).
- `Admin` (`/admin/*`) — tenant‑admin command center (P32).
- `SuperAdmin` (`/superadmin/*`) — platform operator control plane (P33, cross‑tenant).

Nie opisuje zachowania funkcjonalnego domen — do tego są kontrakty modułowe (`docs/modules/NN_*/00-07`).

## Source of truth (priority)

1. **Code routing**: `src/routes/routeConfig.ts` (ROUTES.*)
2. **Route mounts**: `src/routes/AppRoutes.tsx`
3. **Mounted surfaces + API truth**: `docs/modules/ADMIN_SETTINGS_SUPERADMIN_CONTRACT_INVENTORY.md`
4. **Superadmin horizontal IA**: `docs/product/SUPERADMIN_V8_SSOT.md`

## Global invariant

- **Admin ≠ SuperAdmin**: Admin jest tenant‑scoped. SuperAdmin jest platform‑scoped (cross‑tenant).
- **Fail closed**: jeśli rola/capability niepewna → deny-by-default.
- **No fake success**: w mounted surfaces nie wolno “udawać” zapisu.

---

## 1) Settings (`/settings/*`)

### Route root

- `/settings/*`

### Internal structure (inventory-driven)

Kanoniczny inventory sekcji i statusów (`real/partial/stub`) jest w:
`docs/modules/ADMIN_SETTINGS_SUPERADMIN_CONTRACT_INVENTORY.md` (tabela “Settings Inventory”).

### Ownership handoff (high-signal rule)

Settings może pokazywać resolved stan, ale **krytyczne tenant writes** muszą kierować do:

- `Admin` (P32): IAM/security/collaboration/integrations remediation/audit
- `Organization` (P30): business profile i strategic context workspace
- `SuperAdmin` (P33): cross‑tenant/platform controls

---

## 2) Admin (`/admin/*`)

### Route root

- `/admin/*`

### Primary sections (as-is in routing)

Źródło: `src/routes/routeConfig.ts` (`ROUTES.ADMIN.*`).

- `overview` → `/admin/overview`
- `people` → `/admin/people` (alias: members/team)
- `security` → `/admin/security`
- `billing` → `/admin/billing`
- `ai` → `/admin/ai`
- `integrations` → `/admin/integrations`
- `audit` → `/admin/audit`
- `operations` → `/admin/operations` (inventory wskazuje część jako `partial`)
- `compliance` → `/admin/compliance`

### Mounted shell (entry component)

- `src/routes/AppRoutes.tsx` mounts `/admin/*` → `AdminView` → `MainLayout` → `AdminSettingsModule`
- Admin ma własną nawigację wewnętrzną; globalny sidebar działa jako “launcher” (bez duplikacji IA).

### Ownership boundaries (P30/P31/P32/P33)

Admin jest kanonicznym “write surface” dla tenant‑critical governance.
Nie zastępuje:

- `Organization (P30)` jako org identity/profile SSOT
- `Settings (P31)` jako user preferences SSOT
- `SuperAdmin (P33)` jako cross‑tenant control plane

---

## 3) SuperAdmin (`/superadmin/*`)

### Route root

- `/superadmin/*`

### Primary branches (as-is in routing)

Źródło: `src/routes/routeConfig.ts` (`ROUTES.SUPERADMIN.*`).

- `overview` → `/superadmin/overview`
- `customers` → `/superadmin/customers/*` (organizations/users/feedback/bulk ops/playbooks/communication/commercial/billing/invoices)
- `ai-platform` → `/superadmin/ai-platform/*`
- `system` → `/superadmin/system/*` (w tym API keys)
- `content` → `/superadmin/content/*` (w tym compliance)
- `security` → `/superadmin/security/*` (w tym sso/policies)
- `configuration` → `/superadmin/configuration/*` (w tym settings/whitelabel)
- `revenue` → `/superadmin/revenue`
- `analytics` → `/superadmin/analytics`
- `virtual-workers` → `/superadmin/virtual-workers`

### Mounted shell (entry component)

- `src/routes/AppRoutes.tsx` mounts `/superadmin/*` → `SuperAdminView` (dedicated layout; bez `MainLayout` wrapper).

### Landing stability

As-is behavior: konta `SUPERADMIN` powinny lądować w `/superadmin` nawet jeśli app przywraca “generic route” (`/` lub `/chat`).

### SSOT for IA (horizontal)

`docs/product/SUPERADMIN_V8_SSOT.md` jest kanoniczny dla:

- domen/top-level IA w SuperAdmin,
- ownership modelu admin vs superadmin,
- cross-domain capabilities (audit, emergency controls, observability).

---

## Open gaps

1. `MODULE_ROUTING_ARCHITECTURE.md` linkuje ten plik — teraz istnieje, ale wcześniejsze linki z `docs/architecture/ADMIN_PANEL` do `SUPERADMIN_PANEL.md` mogą nie być obecne w repo.
2. Dla `Admin / operations` status w inventory jest `partial` — nie wolno tego maskować jako “fully real”.

