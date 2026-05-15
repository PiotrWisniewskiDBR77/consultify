# Final Implementation Contract — Organization (Position 30/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: verified(evidence) — P30-A/B/C complete  
Last updated: 2026-03-31 (P30-C verification closure)

## 1. Executive summary
- **Intent**: Dopasować UI/UX do standardu; dodać/zmienić co ma sens; lepsza organizacja danych.
- **Primary users**: tenant owners + osoby utrzymujące tożsamość organizacji.
- **Success metric**: jeden kanoniczny „tenant organization product” z reuse contract dla reszty modułów (bez redefinicji org truth w Admin/Settings).

## 2. Scope
### 2.1 In-scope
- Organization profile/branding/ownership/defaults/trust controls (wg planu).
- Downstream reuse contract (co dziedziczą inne moduły).

### 2.2 Out-of-scope / non-goals
- Zastąpienie Admin/Superadmin.

### 2.3 P30-A — Tenant/org canon (single truth)

**SSOT layers (extend in place; no parallel “org v2” product or schema):**

| Layer | Meaning | Primary implementation / doc (canonical) |
| --- | --- | --- |
| **Org row + billing/plan** | `organization_id`, lifecycle, quotas, plan hooks | `organizations` in `server/migrations/000_initdb_core_tables.sql`, `server/src/database/PostgresDatabase.ts` (`initDb` organizations block); extend migrations — do not second `organizations_new`. |
| **Extended profile** | Industry, size, strategic fields, regulatory hints | `server/migrations/050_organization_profiles.sql.sql` — `organization_profiles`; one row per org. |
| **Branding / UI defaults** | Logo, colors, domain posture surfaced to apps | `organization_settings` key `branding` (see resolution in `OrganizationContextService`); align reads with same keys downstream. |
| **Locale defaults** | `default_language`, `default_timezone` | `organizations` columns + `ResolvedOrganizationContext.profile` fallback chain in `OrganizationContextService`. |
| **Trust / identity (bounded)** | MFA policy, SSO bindings | `organizations.mfa_*`; `server/migrations/032_sso_configuration.sql.sql` — `sso_configurations`; Superadmin/operator-only surfaces stay in positions 32/33 (see §2.2). |
| **Resolved org context (reuse API)** | Merged profile + claims + conflicts for AI/tools | `server/src/services/organizationContext/OrganizationContextService.ts` — `ORGANIZATION_CONTEXT_SCHEMA_VERSION`, `ORGANIZATION_CONTEXT_CLAIM_PATHS`, `buildResolvedContext`, `ResolvedOrganizationContext`. |

**Ownership boundaries (who may change what):**

| Concern | Owner surface (contract) | Consumer rule |
| --- | --- | --- |
| Tenant name, plan, billing flags | Admin / billing flows (32/33 bounded) | Organization UI (30) displays read-only or delegates deep edits to Admin per P32 contract; no duplicate “plan editor” in 30 without packet. |
| Profile / branding / defaults editable by tenant | Organization (30) | Settings (31) may expose **preferences** that are not org identity; if overlap, P30 reuse fields win for **identity** keys (documented in P31). |
| MFA / SSO / security policy | Admin (32) + Superadmin (33) | Organization (30) may **surface** read-only trust posture; writes go through Admin routes only. |
| Claim-level conflicts | `OrganizationContextService` exposes `conflicts[]` | Downstream must not silently pick a source; UI shows degraded/conflict state (see §2.4). |

**Reuse fields for downstream** — modules **must** read org identity through one of: (a) `buildResolvedContext` / snapshot for rich context, (b) direct `organizations` + `organization_profiles` for narrow CRUD only when not duplicating merged semantics. Propagated **stable** field buckets for UX copy and templates:

- **profile.*** — `companyName`, `industry`, `companySize`, `location`, `defaultLanguage`, `defaultTimezone`, `brandColor`, `accentColor`, `customDomain`, etc. (mirror `ResolvedOrganizationContext.profile`).
- **strategic.*** — mission, vision, priorities, competitive/growth/risk (mirror `strategic` on resolved context).
- **trust hints (read-only in consumers)** — `mfa_required` / SSO enforced: from `organizations` + `sso_configurations`, not re-derived in each module.

Versioning: bump `ORGANIZATION_CONTEXT_SCHEMA_VERSION` only via packet; downstream contract tests assert schemaVersion and presence of reuse keys.

### 2.4 Degraded / error posture (Settings / Admin conflicts)

- **Permission denied** (user attempts org-level write without role): HTTP 403 + stable error code; no partial UI update; no cached stale org snapshot shown as saved.
- **Cross-module conflict** (Settings saved a key that maps to org identity): surface “managed in Organization” or “managed in Admin” with link to owning surface; do not write duplicate columns from two UIs in one request without reconciliation.
- **Conflicted claims** (`conflicts[].claimPath`): show non-blocking banner + last-write-wins only where explicitly documented; default is **explicit choice** or read-only until resolved in Organization flows (P30-B).
- **Resolver / DB unavailable**: fail closed on writes; reads may serve last known snapshot with `degraded: true` only if product standard allows — otherwise error state with retry (P30-B implements).

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_ORGANIZATION_2026-03-29.md`

## 4. Softs inspirations (benchmark apps)
### 4.1 Primary benchmark family (SSOT)
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_ORGANIZATION_2026-03-29.md`
- Adjacent modules boundary (must not collapse):
  - `Settings` (31), `Admin` (32), `Superadmin` (33)

### 4.2 Local Softs evidence (concrete artifacts)
- **Linear (members/roles/security as canonical “workspace identity” posture)**:
  - `Softs/0 Projekty/Linear.zip :: Linear/linear.appx/settings/members.html` (members management posture).
  - `Softs/0 Projekty/Linear.zip :: Linear/linear.appx/docs/members-roles.html` (roles semantics posture).
  - `Softs/0 Projekty/Linear.zip :: Linear/linear.appx/settings/account/security.html` + `Linear/linear.appx/security.html` (security posture).
- **Atlassian (org-level support/admin posture adjacency)**:
  - `Softs/0 Baza wiedzy /Atlassion 1/developer.atlassian.com/support.html` (org/system support entry posture; useful as “tenant trust surface” adjacency).

### 4.3 Parity checklist vs Softs (approval-grade)
**Parity oznacza “jedna prawda o organizacji (tenant identity) + reuse contract”, nie “kolejny panel ustawień”.**

- **Explicit membership + roles posture (Linear)**:
  - Członkowie i role są zrozumiałe; boundary org vs user jest widoczny.
- **Security/trust posture (Linear security)**:
  - Trust controls są częścią “org identity layer” (bounded) i są czytelne (kto kontroluje co).
- **Downstream reuse contract (Wave2)**:
  - Moduły downstream konsumują org truth, nie redefiniują jej fragmentami.
- **No scope collapse into Admin/Superadmin (non-goal)**:
  - Organization nie staje się operator cockpit; to warstwa tożsamości i defaults.

### 4.4 Gap ledger vs Softs (what we are missing — derived from Wave2 plan)
Źródło prawdy: `WAVE2_FINAL_IMPLEMENTATION_PLAN_ORGANIZATION_2026-03-29.md`.

| Capability cluster (parity target) | What Softs implies | Current truth (per plan) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Organization v8 canon | one tenant product | “canon missing” | Spisać i wdrożyć jeden kanon Organization (profile/ownership/defaults/trust) | P0 |
| Reuse contract | downstream consistency | “not explicit enough” | Zdefiniować stable reuse fields i ownership boundaries dla modułów | P0 |
| Trust boundaries | visible security posture | “partial” | Ujawnić domain/trust controls i error/degraded modes | P1

## 5. Evidence plan (DoD)
### 5.1 Acceptance criteria
- Org truth jest jedna i reuse’owana; UI/UX jest spójny ze standardem; ownership boundaries są jawne.
- Członkowie/role oraz trust controls są czytelne (kto ma władzę i gdzie).
- Downstream moduły mają jasny contract “które pola dziedziczą” i nie tworzą alternatywnej prawdy.

### 5.2 Tests
- Integracyjne: create/update org profile/defaults → downstream read (np. Tools/Assessment/Partner) → consistent rendering.
- Regression: brak permissions / conflict with Settings/Admin → czytelny error + brak silent driftu.
- Contract tests: org schema stable; ownership boundaries enforced; audit events emitted.

### 5.3 Staging proof checklist
- Demo: owner zmienia podstawowe org defaults + widoczny efekt w 2 downstream surfaces.
- Demo: member/role change → natychmiastowy efekt permissions + audit trace (bounded).

## 8. Delivery plan
### 8.0 Context pack (read first)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Execution playbook: `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- Authority chain (Organization SSOT): see section 3.
- Softs parity + gaps: see section 4.
- Evidence plan: see section 5.

### 8.1 Bounded delivery packets
#### P30-A — Organization canon + reuse contract (scope approval)
- **Goal**: jedna tenant prawda (profile/ownership/defaults/trust) + stable reuse fields dla modułów.
- **Inputs required**: schema + ownership boundaries; member/role baseline.
- **Acceptance**: scope zatwierdzony; downstream reuse contract spisany; degraded/error posture jawne.
- **Evidence**: scope approval + linkowane SSOT.
- **Tasks** (see library: `docs/product/work-packets/cursor-work/final_master/PACKET_TASKS_AND_DOD_LIBRARY.md`):
  - Freeze org schema (profile/defaults/trust) and ownership boundaries.
  - Freeze downstream reuse contract (which fields propagate; versioning posture).
  - Freeze member/role baseline and degraded/error posture for conflicts.
- **DoD**:
  - Approved(scope): org truth is single and reusable; boundaries are enforceable.

##### P30-A — Acceptance checklist (testable)

1. **Single org row**: Dla danego `organization_id` istnieje co najwyżej jeden spójny zestaw pól tożsamości w `organizations` + `organization_profiles` (unikalność `organization_id` w profilach).
2. **Resolved context schema**: `ORGANIZATION_CONTEXT_SCHEMA_VERSION` w `OrganizationContextService` jest jawnie zdefiniowany; zmiana wersji wymaga wpisu w kontrakcie / evidence.
3. **Claim paths closed set**: Nowe pole dziedziczone przez downstream jest dodawane tylko przez `ORGANIZATION_CONTEXT_CLAIM_PATHS` (lub jawny merge z `organizations` / `organization_profiles` w `buildResolvedContext`) — brak “shadow” mapowania w module bez przechodzenia przez serwis ani SSOT.
4. **Reuse field parity**: Dwa downstream surfaces (np. Tools + Partner) czytają te same klucze z `ResolvedOrganizationContext.profile` (lub jednego zatwierdzonego read-modelu) po zmianie profilu — brak rozjazdu w polach `defaultLanguage` / `brandColor` po jednym zapisie w Organization.
5. **Ownership boundary — MFA/SSO**: Zapis MFA/SSO nie jest udawany z poziomu modułu konsumenckiego; endpointy zapisu prowadzą przez role Admin/Superadmin (test integracyjny 403 z Organization-only role).
6. **403 bez silent drift**: Odrzucony zapis org nie zostawia w cache/UI stanu “saved”; odpowiedź zawiera komunikat lub kod błędu zgodny z API standardem.
7. **Conflicts surface**: Gdy `buildConflicts` zwraca >0 wpisów dla ścieżki, API lub UI zwraca widoczny stan konfliktu (brak ukrycia drugiej wartości).
8. **Settings overlap**: Jeśli Settings zapisuje klucz tożsamości org, integracja trafia w owning surface lub zwraca konflikt opisany w §2.4 (test regresji: brak podwójnej prawdy w DB).
9. **Snapshot rebuild**: Po `recordOrganizationProfile` snapshot w `organization_context_snapshots` odświeża `profile`/`strategic` zgodnie z merge rules (test jednostkowy lub integracyjny na rebuild).
10. **Branding key SSOT**: Wartości brandingowe są spójne między `organization_settings.branding` a polami w resolved profile po zapisie (brak rozjazdu-read w tym samym request flow).
11. **Contract stability**: Kontrakty P31/P32 odwołują się do tego dokumentu dla pól org identity; brak nowej “Organization duplicate” sekcji w innych modułach bez anti-duplicate review.

##### P30-A — Anti-duplicate gate (extend these paths only)

| Area | Canon (path) | Rule |
| --- | --- | --- |
| Org core row | `server/migrations/000_initdb_core_tables.sql`, `server/src/database/PostgresDatabase.ts` | Jedna tabela `organizations`; rozszerzaj migracjami; zabroniona druga tabela “tenant_v2”. |
| Org extended profile | `server/migrations/050_organization_profiles.sql.sql` | Jedna tabela `organization_profiles`; downstream nie tworzy własnej “company_facts”. |
| SSO / trust | `server/migrations/032_sso_configuration.sql.sql`, kolumny MFA w `organizations` | Polityka trust per org tylko tu + Admin/Superadmin UI (P32/P33). |
| Resolved read model | `server/src/services/organizationContext/OrganizationContextService.ts` | Single merge: `buildResolvedContext`, `ORGANIZATION_CONTEXT_CLAIM_PATHS`, `ORGANIZATION_CONTEXT_SCHEMA_VERSION`; zabroniony równoległy “OrgAggregateService” bez packetu. |
| Snapshots | `organization_context_snapshots` (zdefiniowane przy context service / migracjach powiązanych) | Jedna kolumna JSON snapshot per org; nie duplikować “org_cache_v2”. |
| Product / wave2 SSOT | `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_ORGANIZATION_2026-03-29.md` | Szczegóły UX; §2.3 tego kontraktu wygrywa przy konflikcie “co jest API truth”. |
| Final V8 contract | Ten plik + `FINAL_IMPLEMENTATION_PLAN_31_SETTINGS_*`, `FINAL_IMPLEMENTATION_PLAN_32_ADMIN_*` | Settings/Admin rozszerzają granice, nie redefiniują tabel org. |
| Tenant targeting (env) | `server/src/config/databaseTargetResolver.ts`, `.cursorrules` (Railway DB) | Org ID / env routing nie duplikować w nowych resolverach. |

#### P30-B — Downstream reuse + roles/trust closure
- **Goal**: org defaults i role są konsumowane spójnie przez downstream (bounded).
- **Acceptance**: 2 downstream surfaces odzwierciedlają zmiany; conflicts z Settings/Admin są czytelne.
- **Evidence**: integracyjne testy + staging demo.
- **Tasks**:
  - Implement downstream reads for 2 surfaces; verify immediate consistency.
  - Implement conflict/permission errors with clear guidance (no silent drift).
  - Add integration tests and run staging demos (5.3).
- **Staging proof script (click-by-click)**:
  1. As owner, edit org profile/defaults and save; verify audit is recorded (bounded).
  2. Open downstream surface #1 and confirm updated org fields render consistently.
  3. Open downstream surface #2 and confirm the same truth (no duplicate fields, no drift).
  4. Change a member role and verify permissions change immediately with explicit UI feedback.
  5. Attempt an unauthorized change and verify denial + guidance (no silent failure).
- **DoD**:
  - Downstream surfaces reflect org changes; conflicts are explicit; audit exists.

#### P30-C — Verification + rollout
- **Goal**: regresje, staging proof, rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).
- **Tasks**:
  - Capture staging proof and fill ledger rows P30-A/B/C.
  - Validate rollback: disable risk-control writes; preserve read-only org truth.
- **DoD**:
  - Status `verified(evidence)` with complete ledger entries and known limits.

### 8.2 Rollout strategy
- Najpierw profile/defaults, potem role/trust controls i integracje (P1).

### 8.3 Rollback plan
- Wyłącz write dla risk controls; zachowaj read-only; bez destrukcji danych.

## 9. Risks / open questions / decisions
- Ryzyko: downstream tworzą “alternatywną prawdę org”.
- Ryzyko: niejawne ownership boundaries (security/regulatory).
- Decyzje: minimalny zestaw reuse fields i ich stabilność wersji.

---

## 11. P30-D — Organization Profile Evolution (Phase 2)

**Date**: 2026-04-11
**Status**: completed
**Goal**: Evolve Organization module from manufacturing-centric prototype into a universal, AI-guided organization context workspace that serves any organization type.

### 11.1 Problem statement

1. **Split-brain**: `CompanyProfileModule` persists to localStorage only; canonical `OrganizationProfileForm` persists to P30 SSOT but lives in Admin Settings.
2. **Manufacturing bias**: Operating Model section assumes factory/production — misfit for services, tech, public, nonprofit.
3. **Taxonomy divergence**: Three different industry lists and company-size enums across surfaces.
4. **Missing business clusters**: No revenue model, delivery model, core systems, funding model.
5. **AI integration broken**: `deepThinkingOrchestrator` reads non-existent paths; `AIPipeline` serializes only name/industry into prompts.
6. **Teresa absent**: No guided AI flow helps users complete their profile.

### 11.2 New fields added to SSOT

| Field | Claim path | Type | Purpose |
| --- | --- | --- | --- |
| `organization_type` | `profile.organizationType` | enum | Drives conditional UI sections and benchmark grouping |
| `revenue_model` | `profile.revenueModel` | string | Financial analysis, valuation tools |
| `delivery_model` | `operations.deliveryModel` | string | Project/initiative templates |
| `core_systems` | `systems.coreSystems` | string[] | Integration suggestions, migration planning |
| `founding_year` | `profile.foundingYear` | number | Maturity heuristics |

### 11.3 Merged profile architecture

- `CompanyProfileModule` replaced by unified `OrganizationProfileModule` persisting via API to P30 SSOT
- Shows/hides sections based on `organization_type`
- Teresa AI guidance bar prompts next-best-action for profile completion

### 11.4 Conditional sections by organization type

| Section | MANUFACTURING | SERVICES | TECHNOLOGY | PUBLIC | NONPROFIT |
| --- | :---: | :---: | :---: | :---: | :---: |
| Production archetype / shifts / automation | yes | - | - | - | - |
| Delivery model (project/managed/platform) | - | yes | yes | yes | - |
| Revenue / funding model | - | yes | yes | yes | yes |
| Core systems (ERP/CRM/MES/PLM) | yes | yes | yes | yes | - |
| Universal (identity, strategy, digital, market, people, constraints) | yes | yes | yes | yes | yes |

### 11.5 Teresa AI guided flow

1. Welcome prompt when profile <30% complete
2. Document extraction → field proposals (accept/reject per field)
3. Completeness coaching with downstream value context
4. Cross-validation warnings after save
5. Downstream readiness indicators

### 11.6 AI Pipeline enrichment

`buildOrganizationSection` extended to serialize: org type, industry, subsector, scale, strategic priorities, mission, growth stage, competitive position, stack, core systems, cloud adoption, constraints, regulatory environment, risk appetite.

### 11.7 Downstream integration fixes

| Fix | File |
| --- | --- |
| `deepThinkingOrchestrator` path alignment | `server/src/services/ai/deepThinkingOrchestrator.ts` |
| `aiContextBuilder` trust passthrough | `server/src/services/aiContextBuilder.ts` |
| `AIPipeline` rich org section | `server/src/services/ai/AIPipeline.ts` |

### 11.8 Acceptance checklist (P30-D)

1. Single profile entry point in Organization > Profile
2. All fields persist via API to P30 SSOT
3. `organization_type` stored and drives conditional UI
4. New claim paths registered in `ORGANIZATION_CONTEXT_CLAIM_PATHS`
5. Teresa guidance bar visible when profile completeness < 80%
6. `buildOrganizationSection` includes full SSOT profile
7. `extractOrgContext` correctly maps to `ResolvedOrganizationContext`
8. Unified taxonomy across all surfaces

### 11.9 Implementation phases

- **Phase 1**: org_type field, merge profiles, fix deepThinking + AIPipeline, Teresa guidance ✅
- **Phase 2**: Conditional sections per §11.4 matrix, manufacturing fields (production_archetype, shift_pattern, automation_level), communication_style + industry_jargon_level, taxonomy unification ✅
- **Phase 3**: Cross-validation warnings, completeness coaching with downstream context, downstream readiness indicators, document extraction → field proposals (accept/reject) ✅
- **Phase 4**: contextPackBuilder org injection via buildResolvedContext, aiOperatorService SSOT bypass fix, full downstream audit ✅

### 11.10 Phase 2–4 delivery evidence

| Phase | What was delivered | Tests | Key files |
| --- | --- | --- | --- |
| Phase 2 | 3 manufacturing DB columns, 8 new SSOT claim paths, conditional section functions per §11.4, Communication & AI Preferences section, AIPipeline expanded with manufacturing + communication fields | 5 new tests | migration, OrganizationContextService, AIPipeline, organization-profiles.routes, OrganizationProfileModule |
| Phase 3 | `crossValidate()` with 4 validation rules, `getTeresaGuidance()` with downstream module context, `computeDownstreamReadiness()` for 5 modules, document extraction UI with accept/reject per field | 4 new tests | OrganizationProfileModule |
| Phase 4 | `injectOrganizationContext()` in contextPackBuilder populates packs with 13 org fields, aiOperatorService migrated from direct SQL to buildResolvedContext, downstream audit confirmed no remaining identity bypasses | 3 new tests | contextPackBuilder, aiOperatorService |

---

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P30-A | approved(scope) | `5bd825c2e0` | N/A — scope packet | N/A — scope packet | SSOT §2.3 + checklist §8.1; B/C deliver code+evidence |
| P30-B | verified(evidence) | `0b97ba8855` + audit fix commit | 17/17 pass: schema version, claim paths, reuse fields, downstream consistency, ownership boundaries, trust posture, conflict API, audit trail, snapshot rebuild, downstream bypass regression (3 services fixed) | API tests + structural tests + downstream bypass regression | New endpoints: GET /trust, PUT /trust (403), GET /conflicts, GET /audit, GET /reuse-contract; audit logging; 3 downstream services fixed to use OrganizationContextService (ideaAIGenerator, assessment-workflow-v2, competitiveIntelligence) |
| P30-C | verified(evidence) | see commit | 17/17 integration tests pass | Full audit: 11-point P30-A checklist verified; downstream bypass fixed; snapshot rebuild confirmed | Known limits: trust writes require Admin (P32); logo upload requires storage config; domain verification requires DNS; fallback to direct SQL on OrganizationContextService failure |

