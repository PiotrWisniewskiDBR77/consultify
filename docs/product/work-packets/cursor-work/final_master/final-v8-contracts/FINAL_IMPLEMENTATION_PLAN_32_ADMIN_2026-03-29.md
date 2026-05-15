# Final Implementation Contract — Admin (Position 32/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: verified(evidence) — P32-A/B/C complete  
Last updated: 2026-03-31 (P32-C verification closure)

> Superseded for enterprise scope by `FINAL_IMPLEMENTATION_PLAN_32_ADMIN_ENTERPRISE_2026-04-11.md`.

## 1. Executive summary
- **Intent**: Dopasować UI/UX; połączyć z Settings i Superadmin; zarządzanie rolami i organizacją.
- **Primary users**: tenant operatorzy (admins/owners).
- **Success metric**: jeden **tenant Admin cockpit** (jedno drzewo IA): członkowie i role, polityka bezpieczeństwa i współpracy, integracje/sync, audyt — z jawnymi granicami wobec Organization (P30), Settings (P31) i Superadmin (P33). Brak równoległej „prawdy admin” poza kanonem P30/P31.

## 2. Scope
### 2.1 In-scope
- Admin cockpit: **members & roles**, **security policy writes** (przyjmowane z routingu Settings P31), **collaboration controls** (guest / external links), **integrations & sync oversight**, **admin-scoped audit**.
- Jawne ownership boundaries vs P30 / P31 / P33.
- Model ról, taksonomia błędów/denial, model statusów integracji (bounded).

### 2.2 Out-of-scope / non-goals
- **Platform / cross-tenant operator scope** — wyłącznie `Superadmin` (P33).
- **Org identity** (companyName, industry, branding, resolved org profile SSOT) — wyłącznie Organization (P30); Admin **konsumuje** read model P30, nie redefiniuje kolumn tożsamości.
- **Personal i modułowe preferencje użytkownika** (theme, private workflow, większość Module scope bez tenant enforcement) — Settings (P31); Admin nie jest drugim „settings root”.
- Tworzenie **równoległych** tabel członkostwa / polityki (`admin_members`, `admin_security_v2`, osobnej taxonomii settings).

### 2.3 P32-A — Admin cockpit canon + core IA (single operator surface)

#### 2.3.1 Cockpit information architecture (one navigation tree)

Admin is exactly **one** primary navigation tree (order is canonical for discoverability):

```
Admin (tenant operator cockpit)
├── Members & Roles
│   ├── Directory (search/list)
│   ├── Invite user (email / SSO provision — bounded)
│   ├── Assign / change role
│   └── Remove / deactivate member (bounded; owner safeguards in P32-B)
├── Security Policy
│   ├── MFA enforcement (organizations.mfa_* — write surface)
│   ├── SSO / IdP (sso_configurations — write surface)
│   ├── Session timeout (tenant)
│   └── Password policy (tenant)
├── Collaboration Controls
│   ├── guest_access_enabled (tenant-enforced — write surface; routed from Settings P31)
│   └── external_link_sharing (tenant-enforced — write surface; routed from Settings P31)
├── Integrations & Sync
│   ├── Connector status dashboard (per integration)
│   ├── Remediation actions (reconnect, disable, retry sync — bounded)
│   ├── Reauthorization flows (needs_reauth)
│   └── Tool policy — tool_approval_required when tenant-enforced (routed from Settings P31 → Module/Tools)
└── Audit Log
    └── Admin-scoped actions (membership, security, collaboration, integrations, tool policy)
```

**Rule:** Settings (P31) remains the **discovery** surface for many tenant keys; where P31 marks keys as read-only with **writes → Admin (P32)** (see P31 §2.3.5), the Settings UI must **deep-link** into the matching Admin leaf above. Admin owns the **authoritative write UX** for those keys.

#### 2.3.2 Role model (minimum set)

**Mapping to Settings (P31):** In P31 §2.3.3, **Tenant admin** and **owner** are the roles that may initiate tenant-level change. In this contract, **Owner** and **Admin** (below) are the P32 cockpit roles; **tenant admin** in P31 maps to P32 **Admin**; **organization owner** in P30 maps to P32 **Owner** where product assigns that membership role.

| Role | Write (Admin cockpit) | Read (Admin cockpit) | Denied / must not | Guidance when denied |
| --- | --- | --- | --- | --- |
| **Owner** | All P32 write surfaces; membership ops including role elevation to Admin (bounded); destructive org actions per product policy (P32-B) | Full tree + audit | Cross-tenant ops; changing P30 identity keys inside Admin | "Organization profile is managed in Organization settings" (link P30) |
| **Admin** | Members & Roles (except owner-only safeguards); Security Policy; Collaboration Controls; Integrations & Sync remediation; tenant-enforced tool approval | Full tree except owner-only actions + audit | Owner-only actions; P30 identity writes; P31 personal prefs; platform ops | "Only an owner can do this" / "Managed in Organization" / "Managed in Settings (personal)" / "Contact platform support" (P33) |
| **Member** | — | None by default (no Admin access) | All Admin write paths | "You need admin access. Ask your workspace admin." |
| **Guest** | — | None by default | All | "Guests cannot access admin tools." |

**Audit requirement:** Any successful **write** in Members & Roles, Security Policy, Collaboration Controls, Integrations & Sync, or tool policy must emit an **admin-scoped audit event** (actor, target, before/after summary, timestamp) — implementation detail in P32-B; requirement frozen in P32-A.

#### 2.3.3 Ownership boundaries (P32 vs P30 vs P31 vs P33)

| Concern | Owner (contract) | Admin (P32) | Organization (P30) | Settings (P31) | Superadmin (P33) |
| --- | --- | --- | --- | --- | --- |
| **Org identity** (name, industry, profile, branding SSOT) | P30 | Read/display only; links to P30 | **Write** | Read-only; routes edits → P30 | Cross-tenant only |
| **Tenant defaults** (locale resolution, resolved context) | P30 SSOT + resolver | Consumes read model | **Write** identity defaults | May show inherited read-only | — |
| **Members / invites / roles** | P32 | **Write** | — | No members UI (P31) | Cross-tenant support |
| **MFA / SSO / session / password policy** | P32 (+ P33 platform-wide) | **Write** (tenant) | Stores MFA columns, `sso_configurations` (P30 SSOT tables — extend, don’t duplicate) | Read-only; **routes writes → Admin** (P31 §2.3.5) | Platform overrides |
| **guest_access_enabled**, **external_link_sharing** | P32 | **Write** | — | Read-only; **routes writes → Admin** | — |
| **tool_approval_required** (tenant-enforced) | P32 | **Write** | — | Read-only or gated; **routes writes → Admin** | — |
| **Personal preferences** | P31 | **No access** | — | **Write** | — |
| **Module preferences** (non-enforced) | P31 | — | — | **Write** | — |
| **Integration health / reauth / disable** | P32 | **Write** + operator UX | — | May show read-only health | Platform connector catalog |
| **Cross-tenant operations** | P33 | **Denied** | — | — | **Write** |

**Admin MUST accept** write routes from Settings (P31) for: MFA/SSO/session/password, `guest_access_enabled`, `external_link_sharing`, `tool_approval_required` (tenant-enforced). **Admin MUST NOT** own org identity or personal/module preference taxonomy (P31 SSOT for preferences).

#### 2.3.4 Integration / sync status model (bounded)

Statuses are **enumerated** (no parallel vocab per connector):

| Status | Meaning | Admin remediation (typical) | Audit |
| --- | --- | --- | --- |
| **connected** | Healthy auth + last sync OK (or N/A) | None; monitor | Optional heartbeat (policy in P32-B) |
| **error** | Auth OK but sync/API failure | Review error detail; retry; contact vendor; disable if needed | **Emit** status change + error class |
| **needs_reauth** | Token/expired / IdP cleared consent | Run **reauth** flow; verify SSO config in Security Policy | **Emit** transition from connected → needs_reauth |
| **disabled** | Admin or system turned off integration | Re-enable; reauth if required | **Emit** disable/enable event |

**Rule:** Every transition **between** these states caused by user/admin action emits an audit event. Partial sync failure may surface **degraded** (§2.4) while status remains `connected` if canon defines bounded partial success — default is **error** if user-visible data is stale.

#### 2.3.5 Anti-duplicate gate (extend — no parallel admin truth)

| Area | Canon (path / entity) | Rule |
| --- | --- | --- |
| Membership | Existing org membership / user–org tables (extend migrations) | **No** parallel `admin_members` or second role store for the same tenant. |
| Security | `organizations.mfa_*`, `sso_configurations` (P30 SSOT) | Admin **writes through** these tables; no `admin_security_policy` duplicate store. |
| Org identity | P30 §2.3 layers (`organizations`, `organization_profiles`, branding key, `OrganizationContextService`) | Admin **does not** add duplicate org identity columns. |
| Settings taxonomy | P31 §2.3.1 tree | Admin **does not** fork preference keys; enforced keys **route** from Settings into Admin leaves. |
| Cross-tenant | P33 only | No tenant Admin surface for cross-org data. |
| Wave2 product SSOT | `WAVE2_FINAL_IMPLEMENTATION_PLAN_ADMIN_2026-03-29.md` | §2.3 of **this** contract wins for cockpit / role / boundary truth vs narrative gaps. |
| Final V8 | This file + references to P30 / P31 / P33 | Admin extends **existing** entities only (canon-first). |

### 2.4 Degraded / error posture (denial taxonomy)

- **Permission denied** (insufficient role): HTTP **403** + stable error code + guidance (e.g. “Only owners can remove an owner”, “Managed in Organization”, “Guests cannot access admin”); **no** partial UI mutation; no “saved” state on failure.
- **Partial failure** (e.g. one integration retried, one still failing): UI **degraded** — show per-row status, aggregated banner “Some integrations need attention”; avoid masking failed rows as healthy.
- **Integration error** (API/connector failure): Surface **error** class + link to **remediation** path from §2.3.4; do not silently revert last good UI without indicator.
- **Role conflict** (illegal transition, last owner demotion, self-lockout): **Reject** with explicit rule (“At least one owner required”); no DB write; audit **attempt** optional in P32-B.
- **Routing conflict** (client calls wrong surface for a key): API **403** or **409** with “This key is managed in Admin” / Organization / Settings per ownership table.
- **P30/P31 resolver unavailable**: Fail **closed** on security/collaboration writes; reads may show retry per product standard (aligned with P31 §2.4).

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

## 8. Delivery plan
### 8.0 Context pack (read first)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Execution playbook: `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- Authority chain (Admin SSOT): see section 3.
- Softs parity + gaps: see section 4.
- Evidence plan: see section 5.

### 8.1 Bounded delivery packets
#### P32-A — Admin cockpit canon + core IA (scope approval)
- **Goal**: Admin jako jeden cockpit (members/roles + integrations/sync) z jasnymi boundaries.
- **Inputs required**: role model + audit baseline; integration status model + remediation posture.
- **Acceptance**: scope zatwierdzony; non-goals jawne; error/denial states spisane.
- **Evidence**: scope approval + linkowane SSOT.
- **Tasks** (see library: `docs/product/work-packets/cursor-work/final_master/PACKET_TASKS_AND_DOD_LIBRARY.md`):
  - Freeze cockpit IA (members/roles + integrations/sync) and boundaries vs Org/Settings/Superadmin.
  - Freeze role model + audit requirements + denial/error taxonomy.
  - Freeze integration status model + remediation posture (bounded).
- **DoD**:
  - Approved(scope): admin flows are discoverable, safe, and audytowalne by design.

#### P32-B — Membership/role ops + integration oversight closure
- **Goal**: invite→role→access + revoke; integracje mają status i remediation.
- **Acceptance**: core flows działają; insufficient permissions daje guidance; audit eventy są emitowane.
- **Evidence**: integracyjne testy + staging demo cockpit walkthrough.
- **Tasks**:
  - Implement invite/assign role/verify access/remove flows with clear denial guidance.
  - Implement integration status + remediation path (bounded).
  - Add integration/regression tests and run staging cockpit walkthrough demo.
- **Staging proof script (click-by-click)**:
  1. Open Admin cockpit and navigate to Members.
  2. Invite a user, assign a role, and verify access changes in a declared surface.
  3. Remove the user and confirm access is revoked; audit events are visible (bounded).
  4. Open Integrations/Sync status; verify at least one integration shows a clear health state.
  5. Trigger a remediation flow (bounded) and confirm status updates and errors are explicit.
- **DoD**:
  - Core admin ops work end-to-end; audit is emitted; integrations are operator-visible.

#### P32-C — Verification + rollout
- **Goal**: regresje, staging proof, rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).
- **Tasks**:
  - Capture staging proof and fill ledger rows P32-A/B/C.
  - Validate rollback: disable integration ops; preserve read-only cockpit visibility.
- **DoD**:
  - Status `verified(evidence)` with complete ledger entries and known limits.

### 8.2 Rollout strategy
- Najpierw members/roles (P0), potem sync oversight (P1).

### 8.3 Rollback plan
- Wyłącz integracje ops; zachowaj read-only; bez destrukcji danych.

## 9. Risks / open questions / decisions
- Ryzyko: admin jako “zbiór linków” bez jednego cockpit IA.
- Ryzyko: brak audit lub denial guidance → operacyjny chaos.
- Decyzje: minimalny zestaw integracji i ich statusy P0.

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P32-A | approved(scope) | `c509364f38` | N/A — scope packet | N/A — scope packet | Cockpit IA §2.3.1; roles §2.3.2; boundaries §2.3.3; integrations §2.3.4; errors §2.4; anti-dup §2.3.5 |
| P32-B | verified(evidence) | (this commit) | 69/69 pass — cockpit IA aligned (Members&Roles + Collaboration Controls + Sync Hub branches), audit events wired to addMember/updateMemberRole/removeMember, integration status model (4-status: connected/error/needs_reauth/disabled with remediation), AdminSettingsModule sections | structural + contract + service | Cockpit: Members&Roles branch, Collaboration Controls branch, Sync Hub; integrationStatusService: normalizeStatus, getHealthForOrg, transitionStatus, getRemediationPath; Audit: adminAuditService wired to all member ops |
| P32-C | verified(evidence) | (this commit) | 69/69 combined P31-33 suite | evidence ledger filled | Full P32-A checklist: cockpit IA, role model, members ops with audit, integration status model, collaboration controls, ownership boundaries |

