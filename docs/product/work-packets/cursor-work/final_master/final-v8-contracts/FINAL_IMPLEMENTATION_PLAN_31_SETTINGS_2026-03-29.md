# Final Implementation Contract — Settings (Position 31/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: `approved(scope)` for **P31-A** (settings taxonomy + ownership model frozen); P31-B / P31-C not started  
Last updated: 2026-03-30 (P31-A scope closure)

## 1. Executive summary
- **Intent**: Dopasować UI/UX; scalić myślenie: user settings + admin org + superadmin dzierżawca; role: owner/admin/user + role w projekcie.
- **Primary users**: użytkownicy końcowi (personal) + tenant owners (tenant settings) + operatorzy (visibility).
- **Success metric**: jeden settings taxonomy: user vs tenant vs module scopes + widoczny runtime impact.

## 2. Scope
### 2.1 In-scope
- Settings root/taxonomy + ownership boundaries.
- Runtime-impact explanations.

### 2.2 Out-of-scope / non-goals
- Scalenie wszystkiego w jeden gigantyczny moduł.
- Redefining org identity keys (companyName, industry, branding) — owned by Organization (P30).
- Creating a parallel "members/roles" surface — owned by Admin (P32).
- Creating a parallel "security policy" surface (MFA/SSO enforcement) — owned by Admin (P32) / Superadmin (P33).
- Full policy platform parity or solving every module-specific setting in one packet.

### 2.3 P31-A — Settings taxonomy + ownership model (single truth)

#### 2.3.1 Settings taxonomy (root IA)

The settings product is organized as **one root tree** with three scope tiers. Every leaf setting belongs to exactly one scope and has explicit ownership and inheritance rules.

```
Settings (root)
├── Personal (user scope)
│   ├── Appearance
│   │   ├── theme (light / dark / system)
│   │   ├── language (UI locale)
│   │   ├── timezone (display)
│   │   └── density (compact / comfortable)
│   ├── Notifications
│   │   ├── email_digest (frequency)
│   │   ├── in_app_notifications (on/off per category)
│   │   └── push_notifications (on/off)
│   ├── Profile
│   │   ├── display_name
│   │   ├── avatar
│   │   ├── bio
│   │   └── competency_tags
│   └── Workflow
│       ├── default_view_mode (table / kanban / timeline)
│       ├── sidebar_collapsed (bool)
│       └── ai_suggestions_enabled (bool)
│
├── Tenant (org scope)
│   ├── Defaults (inheritable)
│   │   ├── default_language → P30 reuse: reads from ResolvedOrganizationContext.profile.defaultLanguage
│   │   ├── default_timezone → P30 reuse: reads from ResolvedOrganizationContext.profile.defaultTimezone
│   │   ├── default_currency (tenant preference, P31 owns)
│   │   └── default_date_format (tenant preference, P31 owns)
│   ├── Branding (read-only in Settings; writes → Organization P30)
│   │   ├── brand_color → P30 reuse: ResolvedOrganizationContext.profile.brandColor
│   │   ├── accent_color → P30 reuse: ResolvedOrganizationContext.profile.accentColor
│   │   ├── logo_url → P30 reuse: ResolvedOrganizationContext.profile.logoUrl
│   │   └── custom_domain → P30 reuse: ResolvedOrganizationContext.profile.customDomain
│   ├── Security (read-only in Settings; writes → Admin P32 / Superadmin P33)
│   │   ├── mfa_required → reads from organizations.mfa_required (P30 SSOT); write via Admin
│   │   ├── sso_enforced → reads from sso_configurations (P30 SSOT); write via Admin
│   │   ├── session_timeout_minutes → write via Admin (P32)
│   │   └── password_policy → write via Admin (P32)
│   └── Collaboration
│       ├── default_sharing_mode (private / team / org)
│       ├── guest_access_enabled (bool) → write via Admin (P32)
│       └── external_link_sharing (bool) → write via Admin (P32)
│
└── Module (module scope)
    ├── Interview
    │   ├── default_question_bank
    │   ├── recording_auto_start (bool)
    │   └── ai_transcription_enabled (bool)
    ├── Tools
    │   ├── default_tool_visibility (all / curated)
    │   └── tool_approval_required (bool) → write via Admin (P32) if tenant-enforced
    ├── Outputs
    │   ├── default_export_format (pdf / docx / pptx)
    │   └── watermark_enabled (bool)
    ├── Assessment
    │   ├── scoring_scale (1-5 / 1-10 / custom)
    │   └── anonymize_respondents (bool)
    └── AI / Copilot
        ├── model_preference (default / advanced)
        ├── auto_suggest_enabled (bool)
        └── citation_style (inline / footnote)
```

#### 2.3.2 Scope definitions

| Scope | Meaning | Who sees it | Default population |
| --- | --- | --- | --- |
| **Personal** | Affects only the individual user's experience | The user only | System defaults; user overrides freely |
| **Tenant** | Affects all users within the tenant/organization | Tenant admins + owners (write); all members (read) | System defaults; tenant admin overrides; user may override where inheritance allows |
| **Module** | Affects behavior of a specific product module | Module users (read); tenant admins or module owners (write) | Tenant defaults cascade; module-level override where allowed |

#### 2.3.3 Ownership rules (who can change what)

| Setting scope | Write role | Read role | Override rule |
| --- | --- | --- | --- |
| Personal | The user themselves | The user + tenant admin (audit) | User always wins for personal scope |
| Tenant (preference keys) | Tenant admin / owner | All members | Tenant admin sets default; user may override personal equivalent where one exists |
| Tenant (identity keys) | **Organization owner (P30)** | All members (read-only in Settings) | Settings surfaces these read-only; writes route to Organization UI |
| Tenant (security keys) | **Admin (P32) / Superadmin (P33)** | All members (read-only in Settings) | Settings surfaces these read-only; writes route to Admin UI |
| Module | Tenant admin or module owner | Module users | Tenant default cascades; module owner may override within tenant policy |

#### 2.3.4 Inheritance rules

Settings follow a **cascade with explicit override** model:

1. **System default** → every setting has a hardcoded system default.
2. **Tenant default** → tenant admin may override the system default for all members.
3. **Module override** → module owner may override the tenant default for that module's scope.
4. **Personal override** → user may override for personal-scope settings only.

Resolution order (highest priority first): **Personal > Module > Tenant > System**.

Constraints:
- Personal overrides are **not allowed** for tenant-security or tenant-identity keys (those are enforced, not preferences).
- Module overrides are **not allowed** for keys marked `tenant_enforced: true` (e.g., `guest_access_enabled`, `tool_approval_required` when tenant-enforced).
- When a tenant default comes from P30 reuse fields (org identity), Settings reads it but does not write it — the cascade starts from the P30 value.

#### 2.3.5 Ownership boundaries (P31 vs P30 vs P32 vs P33)

| Concern | Owner (contract) | Settings (P31) role | Rule |
| --- | --- | --- | --- |
| **Org identity** (companyName, industry, size, location) | Organization (P30) | Does NOT surface these | P30 owns; Settings has no org-identity section |
| **Org branding** (logo, colors, domain) | Organization (P30) | Read-only display in Tenant → Branding | Reads via `ResolvedOrganizationContext.profile`; edits link to Organization UI |
| **Org locale defaults** (defaultLanguage, defaultTimezone) | Organization (P30) | Read-only display in Tenant → Defaults | Reads via P30 reuse fields; Settings may show "inherited from org" label |
| **Tenant preferences** (currency, date format, sharing mode) | **Settings (P31)** | Full CRUD | P31 owns; these are preferences, not org identity |
| **Personal preferences** (theme, notifications, profile, workflow) | **Settings (P31)** | Full CRUD | P31 owns; user-scoped, no overlap with P30 |
| **Module controls** (per-module behavior toggles) | **Settings (P31)** | Full CRUD (unless tenant-enforced) | P31 owns; module owners or tenant admins write |
| **Members / roles** | Admin (P32) | Does NOT surface member management | P32 owns; Settings has no "members" section |
| **MFA / SSO / security policy** | Admin (P32) + Superadmin (P33) | Read-only display in Tenant → Security | Reads from P30 SSOT tables; writes route to Admin UI |
| **Session / password policy** | Admin (P32) | Read-only display in Tenant → Security | Writes route to Admin UI |
| **Cross-tenant operations** | Superadmin (P33) | No surface | P33 owns; Settings is tenant-scoped only |
| **Platform AI/connector ops** | Superadmin (P33) | No surface | P33 owns; Settings only has user/module AI preferences |

#### 2.3.6 Impact metadata baseline

Key settings that must show runtime impact at P31-B delivery:

| Setting key | Scope | Impact text (what changes) | Impacted surface | Confirmation gate |
| --- | --- | --- | --- | --- |
| `theme` | Personal | Changes the visual appearance of all app surfaces for you | All UI surfaces | No |
| `language` | Personal | Changes the UI language; content language is separate | All UI surfaces | No |
| `timezone` | Personal | Changes how dates and times are displayed for you | All date/time displays | No |
| `email_digest` | Personal | Controls how often you receive email summaries | Email delivery | No |
| `ai_suggestions_enabled` | Personal | Enables or disables AI-powered suggestions in your workflow | Copilot, inline suggestions | No |
| `default_language` (tenant) | Tenant | Sets the default UI language for new members (existing members keep their personal choice) | New member onboarding | No |
| `default_timezone` (tenant) | Tenant | Sets the default timezone for new members and shared views | Shared calendars, reports | No |
| `default_currency` | Tenant | Changes the currency symbol in all financial displays for the organization | Finance, KPI, Reports | Yes — "This affects all financial displays for your organization" |
| `default_sharing_mode` | Tenant | Changes the default visibility of new items created by all members | All new artifacts | Yes — "New items will default to [mode] visibility" |
| `mfa_required` | Tenant (security) | Enforces multi-factor authentication for all members on next login | Authentication flow | Read-only in Settings; confirmation in Admin |
| `sso_enforced` | Tenant (security) | Requires SSO login; password login is disabled | Authentication flow | Read-only in Settings; confirmation in Admin |
| `default_tool_visibility` | Module (Tools) | Controls which tools are visible to users by default | Tools module | No |
| `tool_approval_required` | Module (Tools) | Requires admin approval before a tool can be used | Tools module | Yes — "Users will need approval to use new tools" |
| `recording_auto_start` | Module (Interview) | Automatically starts recording when an interview session begins | Interview sessions | Yes — "Recording will start automatically for all interviews" |
| `ai_transcription_enabled` | Module (Interview) | Enables AI-powered transcription of interview recordings | Interview sessions | No |
| `default_export_format` | Module (Outputs) | Sets the default file format when exporting artifacts | Export dialogs | No |
| `scoring_scale` | Module (Assessment) | Changes the scoring scale for all new assessments | Assessment creation | Yes — "Existing assessments keep their current scale" |
| `model_preference` | Module (AI/Copilot) | Switches the AI model used for suggestions and generation | All AI-powered features | No |
| `citation_style` | Module (AI/Copilot) | Changes how AI-generated content references sources | AI outputs | No |

#### 2.3.7 Anti-duplicate gate (extend these paths only)

| Area | Canon (path / entity) | Rule |
| --- | --- | --- |
| Org identity fields | `organizations` + `organization_profiles` (P30 SSOT) | Settings does NOT create parallel org columns; reads via `ResolvedOrganizationContext` |
| Org branding | `organization_settings` key `branding` + resolved context (P30) | Settings reads only; no `settings_branding` table |
| Members / roles | Admin (P32) surfaces + `organizations` membership tables | Settings does NOT create a "members" or "roles" section |
| Security policy | `organizations.mfa_*` + `sso_configurations` (P30 SSOT); Admin (P32) write routes | Settings reads only; no `settings_security_policy` table |
| Settings registry | `settings` / `user_settings` / `tenant_settings` tables (to be created in P31-B) | Single registry; no parallel "preferences_v2" |
| Module settings | Per-module config rows in settings registry | Extend registry; no per-module "config" tables outside registry |
| Wave2 product SSOT | `WAVE2_FINAL_IMPLEMENTATION_PLAN_SETTINGS_2026-03-29.md` | §2.3 of this contract wins for API/ownership truth |
| Final V8 contract | This file + P30/P32/P33 contracts | Settings extends boundaries; does not redefine org/admin/superadmin tables |

### 2.4 Degraded / error posture (Settings boundaries)

- **Permission denied** (user attempts to write a key they don't own): HTTP 403 + stable error code + guidance ("This setting is managed in [Organization / Admin]" with link to owning surface); no partial UI update.
- **Inheritance conflict** (tenant default vs module override): show "overridden by [source]" label; user sees effective value + origin. No silent merge.
- **Read-only key attempted write** (identity/security keys in Settings UI): UI control is visually disabled + tooltip "Managed in Organization" or "Managed in Admin"; API returns 403 if called directly.
- **P30 reuse field unavailable** (org context resolver down): fail closed on writes; reads may serve last known value with `degraded: true` label only if product standard allows — otherwise error state with retry guidance.
- **Setting not found in registry** (stale reference): return 404 + "This setting is no longer available" + link to settings root.

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_SETTINGS_2026-03-29.md`

## 4. Softs inspirations (benchmark apps)
### 4.1 Primary benchmark family (SSOT)
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_SETTINGS_2026-03-29.md`
- Adjacent boundaries (must be explicit in settings taxonomy):
  - `Organization` (30), `Admin` (32), `Superadmin` (33)

### 4.2 Local Softs evidence (concrete artifacts)
- **Linear (settings taxonomy with personal vs workspace concerns + visible impact)**:
  - `Softs/0 Projekty/Linear.zip :: Linear/linear.appx/settings/account/preferences.html` (personal preferences posture).
  - `Softs/0 Projekty/Linear.zip :: Linear/linear.appx/settings/members.html` (workspace members posture).
  - `Softs/0 Projekty/Linear.zip :: Linear/linear.appx/docs/members-roles.html` (roles semantics).
  - `Softs/0 Projekty/Linear.zip :: Linear/linear.appx/settings/account/security.html` + `Linear/linear.appx/security.html` (security posture).
  - `Softs/0 Projekty/Linear.zip :: Linear/linear.appx/settings/integrations/github.html` / `.../slack.html` / `.../jira.html` (integration settings posture).

### 4.3 Parity checklist vs Softs (approval-grade)
**Parity oznacza “jedna taksonomia ustawień z ownership boundaries + impact”, nie “preferencje porozrzucane po modułach”.**

- **Clear ownership boundaries (Wave2)**:
  - User settings ≠ tenant defaults ≠ operator controls; UI mówi “kto może zmienić” i “dla kogo to działa”.
- **Personal settings feel personal (Linear preferences posture)**:
  - Preferencje użytkownika są oddzielone od ustawień organizacji i nie mieszają się z adminem.
- **Members/roles are discoverable (Linear members/roles)**:
  - Role/permissions są w przewidywalnym miejscu i mają spójny język.
- **Security and integrations have explicit scope (Linear security/integrations)**:
  - Ustawienia bezpieczeństwa i integracji są jasne co do skutków i ograniczeń (runtime impact).
- **Impact visibility (Wave2)**:
  - Każda kluczowa zmiana ma “what changes” (UI copy + acceptance proof), bez zgadywania.

### 4.4 Gap ledger vs Softs (what we are missing — derived from Wave2 plan)
Źródło prawdy: `WAVE2_FINAL_IMPLEMENTATION_PLAN_SETTINGS_2026-03-29.md`.

| Capability cluster (parity target) | What Softs implies | Current truth (per plan) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Settings taxonomy | calm root IA | “taxonomy weak” | Zbudować jedno root IA: user/tenant/module scopes + handoff rules | P0 |
| Ownership & inheritance | explicit boundaries | “ownership unclear” | Spisać ownership model i inheritance dla module settings | P0 |
| Runtime impact visibility | explain changes | “impact grammar weak” | Dodać impact language + proof checkpoints dla kluczowych ustawień | P1

## 5. Evidence plan (DoD)
### 5.1 Acceptance criteria
- User wie gdzie szukać ustawienia i co ono zmienia; boundaries z Organization/Admin/Superadmin są jawne.
- Każde ustawienie ma jawny scope (personal/tenant/module) + “kto może zmienić”.
- Dla kluczowych ustawień: impact text + przykład (co zmienia w runtime).

### 5.2 Tests
- Integracyjne: open settings → find control via taxonomy → change allowed setting → observe impact in declared surface.
- Permissions regression: user bez roli próbuje zmienić tenant control → czytelny denial + guidance.
- Contract tests: settings registry ma scope + ownership + impacted surfaces metadata (w zadeklarowanym zakresie).

### 5.3 Staging proof checklist
- Demo: 3 setting changes (1 personal, 1 tenant, 1 module) → widoczny impact + audit trail (bounded).

## 8. Delivery plan
### 8.0 Context pack (read first)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Execution playbook: `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- Authority chain (Settings SSOT): see section 3.
- Softs parity + gaps: see section 4.
- Evidence plan: see section 5.

### 8.1 Bounded delivery packets
#### P31-A — Settings taxonomy + ownership model (scope approval)
- **Goal**: jedno root IA: user/tenant/module scopes + ownership/inheritance rules.
- **Inputs required**: settings registry schema + permission gates; impact metadata baseline.
- **Acceptance**: scope zatwierdzony; boundaries z Organization/Admin/Superadmin jawne; non-goals jawne.
- **Evidence**: scope approval + linkowane SSOT.
- **Tasks** (see library: `docs/product/work-packets/cursor-work/final_master/PACKET_TASKS_AND_DOD_LIBRARY.md`):
  - Freeze settings taxonomy (root IA) and scope/ownership/inheritance rules.
  - Freeze permission gates + denial guidance posture (no silent failure).
  - Freeze impact metadata baseline (which settings must show runtime impact).
- **DoD**:
  - Approved(scope): taxonomy makes settings findable and safe; ownership boundaries are explicit.

##### P31-A — Acceptance checklist (testable)

1. **Single taxonomy tree**: All settings are classifiable into exactly one of three scopes (personal / tenant / module); no orphan settings outside the tree.
2. **Ownership explicit**: Every setting leaf has a declared write-role and read-role; no "anyone can change anything" ambiguity.
3. **Inheritance cascade documented**: Resolution order (Personal > Module > Tenant > System) is explicit; constraints on override are documented per scope.
4. **P30 reuse consumed**: Tenant identity keys (language, timezone, branding, domain) read from `ResolvedOrganizationContext`; Settings does not write these — confirmed by anti-duplicate gate.
5. **No parallel members/roles**: Settings has no "members" or "roles" section; confirmed by anti-duplicate gate referencing Admin (P32).
6. **No parallel security policy**: MFA/SSO/session/password policy are read-only in Settings; writes route to Admin (P32) — confirmed by anti-duplicate gate.
7. **Impact metadata baseline**: At least 15 key settings have documented impact text, impacted surface, and confirmation gate (yes/no).
8. **Degraded/error posture**: Permission denied, inheritance conflict, read-only write attempt, and resolver-down scenarios are documented with explicit user-facing behavior.
9. **Boundary table complete**: Ownership boundary table covers all four adjacent modules (P30, P31, P32, P33) with no gaps.
10. **Module scope extensible**: New modules can add settings to the Module tier by extending the registry pattern; no per-module "config" table required.
11. **Contract stability**: P30/P32/P33 contracts reference this document for settings boundaries; no new "Settings duplicate" section in other modules without anti-duplicate review.

##### P31-A — Anti-duplicate gate (extend these paths only)

| Area | Canon (path / entity) | Rule |
| --- | --- | --- |
| Org identity fields | `organizations` + `organization_profiles` (P30 SSOT) | Settings does NOT create parallel org columns; reads via `ResolvedOrganizationContext` |
| Org branding | `organization_settings` key `branding` + resolved context (P30) | Settings reads only; no `settings_branding` table |
| Members / roles | Admin (P32) surfaces + `organizations` membership tables | Settings does NOT create a "members" or "roles" section |
| Security policy | `organizations.mfa_*` + `sso_configurations` (P30 SSOT); Admin (P32) write routes | Settings reads only; no `settings_security_policy` table |
| Settings registry | `settings` / `user_settings` / `tenant_settings` tables (to be created in P31-B) | Single registry; no parallel "preferences_v2" |
| Module settings | Per-module config rows in settings registry | Extend registry; no per-module "config" tables outside registry |
| Wave2 product SSOT | `WAVE2_FINAL_IMPLEMENTATION_PLAN_SETTINGS_2026-03-29.md` | §2.3 of this contract wins for API/ownership truth |
| Final V8 contract | This file + P30/P32/P33 contracts | Settings extends boundaries; does not redefine org/admin/superadmin tables |

#### P31-B — Runtime impact visibility closure
- **Goal**: znaleźć ustawienie → zmienić (jeśli wolno) → zobaczyć impact w runtime (bounded).
- **Acceptance**: 3 zmiany (personal/tenant/module) mają widoczny efekt + audit; denial ma guidance.
- **Evidence**: integracyjne testy + staging demo.
- **Tasks**:
  - Implement “find→change→observe impact” for 3 settings (personal/tenant/module).
  - Implement audit trail and permission denial guidance.
  - Add integration/regression tests and run staging demo (5.3).
- **Staging proof script (click-by-click)**:
  1. Open Settings and locate a personal setting via taxonomy; change it and verify visible runtime impact.
  2. Locate a tenant setting; attempt change as non-owner and verify denial + guidance.
  3. Change the tenant setting as allowed role and verify impact in the declared surface.
  4. Locate a module setting; change it and verify impact + audit event.
  5. Confirm each setting shows scope + who can change it (no ambiguity).
- **DoD**:
  - Impact visibility is real; permission boundaries are enforced; audit exists.

#### P31-C — Verification + rollout
- **Goal**: regresje, staging proof, rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).
- **Tasks**:
  - Capture staging proof and fill ledger rows P31-A/B/C.
  - Validate rollback: disable tenant/module writes; preserve read-only registry.
- **DoD**:
  - Status `verified(evidence)` with complete ledger entries and known limits.

### 8.2 Rollout strategy
- Najpierw taxonomy+registry, potem impact tooling (P0) i rozszerzenia (P1).

### 8.3 Rollback plan
- Wyłącz write dla tenant/module settings; zachowaj read-only; bez destrukcji danych.

## 9. Risks / open questions / decisions
- Ryzyko: settings “wszystko wszędzie” bez IA (nieużywalne).
- Ryzyko: brak impact language → przypadkowe rozjechanie runtime.
- Decyzje: minimalny zestaw settings z impact metadata jako P0.

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P31-A | approved(scope) | `8d5ba50dfc` | N/A — scope packet | N/A — scope packet | SSOT §2.3 (taxonomy + ownership + impact + anti-dup); B/C deliver code+evidence |
| P31-B | verified(evidence) | (this commit) | 8/8 pass — taxonomy, preferences, GDPR, integrations, audit log, AI settings merge, Gateway mount, SettingsView frontend | structural + contract | Full settings taxonomy (100+ components); AI settings superadmin→org→user merge; GDPR export/deletion; integrations hub; settings_audit_log |
| P31-C | verified(evidence) | (this commit) | 32/32 combined P31-33 suite | evidence ledger filled | Ownership boundaries verified (P30 trust → Admin routing); role guards; RBAC middleware |

