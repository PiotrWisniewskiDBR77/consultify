---
module_id: MODULE_ADMIN_PANEL
doc_kind: ENTRYPOINT
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Panel Administratora (Admin + SuperAdmin)

## Purpose

Moduł `Panel Administratora` obejmuje dwie odrębne powierzchnie:

- **Admin (`/admin/*`)**: tenant‑admin command center (P32) — operacje w obrębie jednej organizacji (users/access, security, billing/finops, AI governance, integrations, audit).
- **SuperAdmin (`/superadmin/*`)**: platform operator control plane (cross‑tenant), z własną IA (v8) i silnymi guardrailami.

To jest powierzchnia governance — **bez silent execution**, z audytem i fail‑closed przy niepewności uprawnień.

## Where is the contract?

- Kontrakt zachowania: `03_BEHAVIOR.md`
- Kontrakt UI/UX: `04_UI_UX.md`
- Zakres i granice: `02_SCOPE.md`
- Źródła prawdy: `SSOT.md`

