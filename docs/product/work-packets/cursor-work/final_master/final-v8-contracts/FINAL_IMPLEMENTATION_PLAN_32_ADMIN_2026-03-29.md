# Final Implementation Contract — Admin (Position 32/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (contract wrapper over existing plan)

## 1. Executive summary
- **Intent**: Dopasować UI/UX; połączyć z Settings i Superadmin; zarządzanie rolami i organizacją.
- **Primary users**: tenant operatorzy (admins/owners).
- **Success metric**: jeden tenant operator cockpit (team/org-adjacent/sync oversight) z jasnym handoff do Settings i Superadmin.

## 2. Scope
### 2.1 In-scope
- Admin cockpit: team membership, tenant operations, sync oversight (wg planu).
- Jasne ownership boundaries.

### 2.2 Out-of-scope / non-goals
- Platform operator scope (to `Superadmin`).

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_ADMIN_2026-03-29.md`

## 4. Softs inspirations (benchmark apps)
### 4.1 Primary benchmark family (SSOT)
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_ADMIN_2026-03-29.md`
- Boundaries (must stay explicit):
  - `Organization` (30), `Settings` (31), `Superadmin` (33)

### 4.2 Local Softs evidence (concrete artifacts)
- **ClickUp (workspace admin + owners/admins + roles/permissions posture)**:
  - `Softs/0 Projekty/Clickup help.zip :: Clickup help/help.clickup.com/hc/en-us/sections/17039046196887-Owners-and-Admins.html` (owner/admin posture).
  - `Softs/0 Projekty/Clickup help.zip :: Clickup help/help.clickup.com/hc/en-us/sections/17043301702679-User-roles-and-permissions.html` (roles/permissions posture).
  - `Softs/0 Projekty/Clickup help.zip :: Clickup help/help.clickup.com/hc/en-us/sections/17043527915799-Workspaces.html` (workspace ops posture).
  - `Softs/0 Projekty/Clickup help.zip :: Clickup help/help.clickup.com/hc/en-us/articles/6310498579607-Manage-your-Workspace-storage.html` (ops control surface example).
- **Linear (member management + integrations/security as operator cockpit ingredients)**:
  - `Softs/0 Projekty/Linear.zip :: Linear/linear.appx/settings/members.html` (membership ops).
  - `Softs/0 Projekty/Linear.zip :: Linear/linear.appx/settings/integrations/github.html` (integration oversight posture).
  - `Softs/0 Projekty/Linear.zip :: Linear/linear.appx/security.html` (security posture).

### 4.3 Parity checklist vs Softs (approval-grade)
**Parity oznacza “one tenant operator cockpit”, nie “zbiór losowych ekranów”.**

- **Operator tasks are easy to find (ClickUp sections)**:
  - Admin ma jasny katalog spraw: workspace, role, dostęp, operacje.
- **Roles/permissions posture is explicit (ClickUp roles)**:
  - Użytkownik admin rozumie role i ich konsekwencje; brak “ukrytych uprawnień”.
- **Membership operations are coherent (Linear members)**:
  - Invite/remove/change role ma spójny flow i error model.
- **Integration/sync oversight is part of operator model (Linear integrations)**:
  - Integracje i ich stan (ok/error/needs reauth) są widoczne i mają remediation path.
- **Clean handoff to Settings/Superadmin (Wave2)**:
  - Admin nie duplikuje personal settings ani platform operator scope.

### 4.4 Gap ledger vs Softs (what we are missing — derived from Wave2 plan)
Źródło prawdy: `WAVE2_FINAL_IMPLEMENTATION_PLAN_ADMIN_2026-03-29.md`.

| Capability cluster (parity target) | What Softs implies | Current truth (per plan) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Admin v8 canon | one cockpit | “canon missing” | Spakietować Admin jako jeden cockpit z IA i core flows | P0 |
| Roles & membership ops | explicit & safe | “fragments exist” | Ujednolicić role/membership flows + gating + error model | P0 |
| Sync/integration oversight | visible status | “some sync depth exists” | Dodać statusy integracji + remediation + audit | P1 |

## 5. Evidence plan (DoD)
### 5.1 Acceptance criteria
- Core admin flows są odkrywalne i spójne; boundaries z org/settings/superadmin nie są sprzeczne.
- Membership + role ops działają end-to-end z czytelnymi denial/error states.
- Integracje/sync mają czytelny status + remediation path.

### 5.2 Tests
- Integracyjne: invite user → assign role → verify access; remove user → access revoked.
- Regression: insufficient permissions → denial + guidance; conflicting state → safe error.
- Contract tests: admin actions emit audit events; role model stable.

### 5.3 Staging proof checklist
- Demo: tenant admin cockpit walkthrough (members/roles + integrations status) + audit evidence.

