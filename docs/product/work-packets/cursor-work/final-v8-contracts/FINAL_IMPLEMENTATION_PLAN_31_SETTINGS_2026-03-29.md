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
| P31-A |  |  |  |  |  |
| P31-B |  |  |  |  |  |
| P31-C |  |  |  |  |  |

