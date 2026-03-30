# Final Implementation Contract — Settings (Position 31/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (contract wrapper over existing plan)

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

