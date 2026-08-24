# SUPERADMIN — analiza kompletności warstwy platformowej

**Zakres:** czy warstwa `/superadmin/*` ma wszystkie funkcje i ekrany, których wymaga aplikacja Consultify w obecnym kształcie.
**Tryb:** TYLKO ODCZYT. Żaden plik nie został zmieniony.
**Baza kodu:** `/private/tmp/consultify-m03-admin`, HEAD `3ac384e075` (stan z 2026-08-24).
**Data analizy:** 2026-08-24.

Każde twierdzenie nośne ma dowód `plik:linia` (ścieżki bezwzględne skrócone do korzenia repo dla czytelności — pełny prefiks to `/private/tmp/consultify-m03-admin/`).

## Ograniczenia analizy (uczciwie, na wejściu)

1. **Nie odpytywałem żywej bazy ani żywego runtime.** Wszystkie oceny są z kodu. Zgodnie ze ZŁOTĄ REGUŁĄ #1 z `CLAUDE.md` część twierdzeń typu „ekran pokazuje dane" wymaga potwierdzenia na demo.
2. **„DZIAŁA" = komponent woła realny endpoint, który istnieje w routerze serwera.** Nie znaczy to, że endpoint zwraca dane (tabela może być pusta, migracja mogła nie przejść). Weryfikacja endpoint-po-endpoincie objęła próbę 12 rodzin ścieżek, nie wszystkie ~200.
3. **Nie oceniałem wyglądu** (kanon TRIADA/SPEC-A) poza dwoma pomiarami ilościowymi w §5.

---

# 1. Inwentarz ekranów `/superadmin/*`

## 1.1 Jak w ogóle działa routing tej warstwy

Cała warstwa to **jedna trasa catch-all**, nie zestaw tras:

- `src/routes/AppRoutes.tsx:3218` — `path={`${ROUTES.SUPERADMIN.ROOT}/*`}` → `<ProtectedRoute requiredRole="SUPERADMIN">` (`:3220`) → `<SuperAdminView>` (`:3223`).
- Stałe tras: `src/routes/routeConfig.ts:230-261` — 31 adresów `/superadmin/*`.
- **SuperAdminView NIE czyta URL.** Nie importuje `useLocation` ani `useParams`; wybiera ekran wyłącznie po `currentView` z Zustand: `src/views/superadmin/SuperAdminView.tsx:69`, `:73`, `:114`. Konsekwencje — §3.
- Sidebar ma **5 pozycji**, nie 31: `src/components/layout/SuperAdminSidebar.tsx:80-91` (`customers`, `ai-platform`, `system`, `content`, `security`).
- Realna treść to **~85 zakładek** rozłożonych w 5 modułach (wyliczenie niżej). Zakładki w większości **nie trafiają do adresu** — patrz §3.

## 1.2 Trasa → komponent → co robi → backend → ocena

### Sekcja „Tenant & User Ops" (`/superadmin/customers`) — `CustomersModule`
Montaż: `SuperAdminView.tsx:119-120`; zakładki `CustomersModule.tsx:153-178`; switch `:180-278`.

| Zakładka | Komponent | Backend (przykładowy dowód) | Ocena |
|---|---|---|---|
| command-center | `TenantCommandCenterView` | `TenantCommandCenterView.tsx:137-139`, `:180-181` | **DZIAŁA, read-only z założenia** (zero akcji zapisu w pliku) |
| organizations | `OrganizationsView` | `OrganizationsView.tsx:162-164`; zapisy `:256,294,331,360,395,432` | **DZIAŁA** (z dwoma defektami — §2 C2/C4) |
| users | `SuperAdminUserManagement` → `UserManagementCore` | `UserManagementCore.tsx:608,696,703,729,780,808` | **DZIAŁA** (w tym impersonacja `:808`) |
| lifecycle | `CustomerLifecycleView` | `:188-190`; zapisy `:237,274,306,332` | **DZIAŁA** |
| playbooks | `CustomerSuccessPlaybooksView` | `:245-247`; zapisy `:300,314,349,373` | **DZIAŁA** |
| contracts | `ContractManagementView` | `:202-204`; zapisy `:260,271,316` | **DZIAŁA** |
| commercial | `RevenueModule` → `BillingCenterView` / `InvoiceCenterView` | `RevenueModule.tsx:96,100`; `BillingCenterView.tsx:209,214,219,1457,1482` | **DZIAŁA** |
| limits | `OrganizationResourceManager` | `:97,110`; zapisy `:119,134,149` | **DZIAŁA** |
| security | `security/SecurityModuleView` (+5 podekranów) | `IPWhitelistView.tsx:155,221`; `MFAView.tsx:81` | **DZIAŁA**, poza `DeviceManagementView.tsx:230` = **ATRAPA** (blokada urządzenia to sam `toast.error`, uczciwie opisana w `:264`) |
| support | `support/SupportModuleView` (+3) | `SupportTicketsView.tsx:197,256`; `CustomerSuccessNotesView.tsx:231,292` | **DZIAŁA** |
| feedback / backlog / analytics | `SuperAdminFeedback*View` | `feedback.routes.ts:1615,1700,2544` | **DZIAŁA** |
| analytics | `CustomerAnalyticsView` | `:92` | **DZIAŁA**, read-only |
| compliance | `CustomerComplianceView` | `:89` | **DZIAŁA**, read-only |
| automation | `CustomerAutomationView` | `:161`; zapisy `:189,253,297` | **DZIAŁA** |
| communication | `CustomerCommunicationView` | `:147-148`; zapisy `:184,199` | **DZIAŁA** |
| bulk-ops | `BulkOperationsView` | — | **DZIAŁA** (nie audytowałem szczegółowo) |
| waitlist | `ModuleWaitlistView` | `:62` | **DZIAŁA**, read-only |
| module-access | `ModuleAccessControlView` | `:63`; zapisy `:99,121,134` | **DZIAŁA** |

### Sekcja „AI Operations" (`/superadmin/ai-platform`) — `AIPlatformModule`
Montaż: `SuperAdminView.tsx:123-124`; 7 grup / ~30 zakładek: `AIPlatformModule/AIPlatformModule.tsx:106-191`.
Kluczowe: LLM Providers (`LLMManagementView.tsx:316,409,415,444,496,530`) — **DZIAŁA**; Prompt Builder, Model Registry, Knowledge — **DZIAŁA**.
Zastrzeżenie: `LLMManagementView.tsx:51` `FALLBACK_PROVIDER_MODELS` to **zaszyty katalog modeli** domieszany do wyników z serwera (`:158-160`) — lista modeli w UI może pokazywać modele, których backend nie zna.

### Sekcja „Connector Ops" (`/superadmin/system`) — `SystemModule`
Montaż: `SuperAdminView.tsx:136-137`; zakładki `SystemModule.tsx:215-249`; switch `:250-313`.

| Zakładka | Komponent | Backend | Ocena |
|---|---|---|---|
| health | `EnterpriseHealthMonitor` | `:232-234`, `:341,361` | **DZIAŁA** (monitoring; NIE probe'y naprawcze — §2 A8) |
| audit-log | `EnterpriseAuditLog` | `:221,233,263` | **DZIAŁA** |
| feature-flags | `EnterpriseFeatureFlags` | `:177,201,224,868,870` | **DZIAŁA, ale nie dla flag per-org** — §2 A11 |
| integrations | `EnterpriseIntegrationsHub` | `:314,331,347,371,386` | **DZIAŁA** |
| security | `EnterpriseSecurityPanel` | `:310,331,349,367,385` | **DZIAŁA** |
| configuration | `EnterpriseConfigurationPanel` | `:222` (**rollback**), `:245,268,292,326` | **DZIAŁA** |
| analytics | `EnterpriseAnalyticsPanel` | `:147,228` | **DZIAŁA** |
| backup | `EnterpriseBackupPanel` | `:173,192,222,248` | **DZIAŁA częściowo** — brak restore w UI (§2 C14) |
| api-keys | `APIManagementView` | `:505-506,601,262,577` | **DZIAŁA** |
| 5× presentation-* | `Presentation*View` | deep-linki `SystemModule.tsx:133+` | **DZIAŁA** |

### Sekcja „Governance & Compliance" (`/superadmin/content`) — `GovernanceModule`
Montaż: `SuperAdminView.tsx:139-140`; zakładki `GovernanceModule.tsx:111-116`.
- overview / audit / approvals / compliance / legal — **DZIAŁA** (`GovernanceModule.tsx:79-80`; `ComplianceCenterView.tsx:338,355,372,402,501`).
- **exports** → `DataExportPanel` — **ATRAPA**: lista zawsze pusta (`DataExportPanel.tsx:95` `setRequests([])`), tworzenie eksportu to `toast.error` (`:107` + komunikat `:68-69`).
- `ComplianceCenterView.tsx:470` — edycja wymagań frameworku to jawnie wyłączony no-op (sąsiedni `handleSaveControl` `:476` **zapisuje** realnie).

### Sekcja „Platform Security" (`/superadmin/security`) — `SecurityModule`
Montaż: `SuperAdminView.tsx:142-143`; 15 zakładek `SecurityModule.tsx:111-125`.
Posture, SSO, SCIM, Roles, Permissions, Policies, Sessions, Audit, Audit Events, Workflows, Incidents, Threats, DLP, AI Budgets, Compliance — **wszystkie DZIAŁAJĄ** (dowody: `SCIMProvisioningView.tsx:191-195,255-362`; `iam/DLPView.tsx:230-232,301-374`; `iam/SecurityIncidentsView.tsx:285-286,322-389`; `iam/ThreatIntelligenceView.tsx:223-224,264-358`).

### Ekrany zamontowane, ale **niedostępne z nawigacji** (tylko przez wpisanie adresu)
- `/superadmin/configuration`, `/superadmin/configuration/settings`, `/superadmin/configuration/whitelabel` → `ConfigurationModule` (`SuperAdminView.tsx:145-146`, `:226-234`). Sidebar mapuje `SUPERADMIN_CONFIGURATION` na sekcję `system` (`SuperAdminSidebar.tsx:41`), a klik w „Connector Ops" renderuje `SystemModule`, **nie** `ConfigurationModule`. Zawiera **Whitelabel Studio** — jedyny realnie działający ekran konfiguracji per-organizacja (`WhitelabelStudioView.tsx:142,170,194,215,236,252`) — oraz publikację dokumentów prawnych (`SuperAdminLegalView`).
- `/superadmin/virtual-workers` → `VirtualWorkersModule` (`SuperAdminView.tsx:158-159`). Pełny, realny moduł zarządzania Teresą/Anną (`VirtualWorkersModule/WorkersList.tsx:52,190`; `ReleasePanel.tsx:68-70,95,121`; `ConversationBrowser.tsx:104,149,165`). **Zero wejść z sidebara.**

### Pliki-sieroty w `src/views/superadmin/` (zero importów w całym `src/`)
Zweryfikowane greppem po całym `src/` z wykluczeniem samego pliku i testów:
`SuperAdminPlansView.tsx`, `SubscriptionPlansManager.tsx`, `SuperAdminRevenueView.tsx`, `OverviewModule.tsx`, `ContentModule.tsx`, `AIConfigurationView.tsx`, `AIObservabilityDashboard.tsx`, `SuperAdminAccessRequestsView.tsx`, `SuperAdminAIAnalyticsView.tsx`, `PresentationTelemetryView.tsx`, `AIDevelopmentModule.tsx`, `AIInfrastructureModule.tsx`, `AIOperationsModule.tsx`, `iam/IAMModuleView.tsx`.
**Skutek biznesowy:** `SuperAdminPlansView.tsx:34,66,68,84` to sprawny edytor planów cenowych wołający `/billing/admin/plans` — i **nie jest podpięty do niczego**. To samo `SubscriptionPlansManager.tsx:78,90,115,135` (`/api/superadmin/subscription-plans`). Zarządzanie cennikiem jest więc dziś operacją curl/SQL mimo istniejącego UI po obu stronach.

### Podsumowanie inwentarza
- 31 zadeklarowanych adresów, **5 realnych wejść nawigacyjnych**, ~85 zakładek treści.
- **DZIAŁA:** przeważająca większość (~80 zakładek).
- **ATRAPA:** 3 punkty (`DataExportPanel`, `DeviceManagementView` blokada urządzenia, `ComplianceCenterView:470`).
- **PUSTE / nieosiągalne:** 2 moduły poza nawigacją (Configuration+Whitelabel, VirtualWorkers) + 14 plików-sierot.
- Repo-wide grep za `mockX`/`MOCK_`/`sampleData` w tych plikach: **zero trafień**. To **nie jest** panel na mockach.

---

# 2. Tabela wymagań → pokrycie

Legenda: **JEST_PEŁNE** = ekran + backend, czynność wykonalna z UI · **JEST_CZĘŚCIOWE** = częściowa ścieżka lub istotny defekt · **TYLKO_BACKEND** = endpoint jest, zero wywołań z `src/` · **BRAK** = nie ma ani jednego, ani drugiego (albo backend fizycznie nie potrafi wykonać operacji).

## Grupa A — wymagania wyprowadzone Z KODU

Kanon capability: `server/src/middleware/superAdmin.middleware.ts:43-49` — dokładnie 5: `platform_ops`, `security_ops`, `billing_ops`, `support_ops`, `ai_ops`. Bramka: `:517-579` (semantyka OR, `:566`).

| ID | Wymaganie | Pokrycie | Dowód plik:linia | Waga |
|---|---|---|---|---|
| A1 | `platform_ops` — analityka platformowa + wyzwolenie backupu | JEST_CZĘŚCIOWE | gate `analytics-superadmin.routes.ts:26` (28 tras); UI pokrywa raporty (`EnterpriseAnalyticsPanel.tsx:147,228`), ale `dashboards/*`, `metrics/*`, `models/*` (`analytics-superadmin.routes.ts:191-1149`) nie mają wywołań w `src/` | WAŻNE |
| A2 | `security_ops` — bezpieczeństwo platformy | JEST_PEŁNE | gate `superadmin.routes.ts:357-360`; UI `SecurityModule.tsx:111-125` | KRYTYCZNE_DLA_MVP |
| A3 | `billing_ops` — operacje rozliczeniowe | JEST_CZĘŚCIOWE | gate `billing/billingAdmin.routes.ts:22,35,60,84,96`; UI woła tylko `contracts` i `manual-contract` (`BillingCenterView.tsx:1457,1482`); `change-plan` (`:31`) i `grace-period` (`:56`) — zero wywołań w `src/` | KRYTYCZNE_DLA_MVP |
| A4 | `support_ops` — impersonacja wsparcia | JEST_PEŁNE | gate `superadmin.routes.ts:363`; UI `UserManagementCore.tsx:794,803,808` | WAŻNE |
| A5 | `ai_ops` — operacje AI | JEST_CZĘŚCIOWE | gate `superadmin.routes.ts:362,364`; UI dla providerów/promptów jest, ale `POST /ai/models/:id/suspend` (`superadmin.routes.ts:988`) i `POST /virtual-workers/:id/suspend` (`:1141`) — zero wywołań | WAŻNE |
| A6 | Nadawanie / ograniczanie capability konkretnemu operatorowi | **BRAK** | `superAdmin.middleware.ts:168-170` — każda rola `superadmin` dostaje **wszystkie 5**; podzbiór czytany wyłącznie z claimu JWT `:393-397`; `RefreshTokenService.ts` nie zawiera słowa `capabilities` → żaden wystawca tokenu go nie ustawia. Brak tabeli, brak UI | PO-MVP |
| A7 | Ekran „Platform Operations" (fail-closed czeka na operatora) | **BRAK** | `src/views/admin/AdminSettingsModule.tsx:54` `const CAN_ACCESS_PLATFORM_OPERATIONS = false;`, ekran zwraca UNAUTHORIZED `:286-298`; w `/superadmin/*` **nie istnieje żaden odpowiednik** | KRYTYCZNE_DLA_MVP |
| A8 | Uruchomienie probe'ów zdrowia / diagnostyka wykonawcza | **BRAK** | `AdminHealthPanel.tsx:78-85` — przy `canRunDiagnostics=false` panel nic nie ładuje; jedyny backend `admin/health-panel.routes.ts:36-90` wymaga **aktywnego wiersza `organization_members` z rolą OWNER/ADMIN**, a platformowy superadmin nie ma członkostwa (fixture: `docs/.../evidence-superadmin-20260824/evidence-log.md:37-41`) → dla superadmina 403 `ADMIN_MEMBERSHIP_REQUIRED` | KRYTYCZNE_DLA_MVP |
| A9 | Włączenie/wyłączenie modułu V8 **dla innej organizacji** | **BRAK** | `server/src/routes/v8/admin/feature-flags.routes.ts:36` — `const orgId = req.organizationId!` (organizacja **wołającego**, brak parametru `:orgId`); serwis potrafi (`services/v8/featureFlagService.ts:160-198`), trasa nie. Klient TS istnieje, ale nikt go nie importuje: `src/services/api/v8/admin.ts:9,11,13` | KRYTYCZNE_DLA_MVP |
| A10 | Globalny przełącznik V8 (`ENABLE_V8_GLOBAL`) | **BRAK** | `server/src/config/FeatureFlags.ts:31,133`; brama `middleware/v8FeatureGate.middleware.ts:14-21`; sterowanie = zmienna Railway + redeploy (`server/scripts/v8-deploy.ts:117,169`) | WAŻNE |
| A11 | Wiersz `feature_flags` per organizacja | JEST_CZĘŚCIOWE | ekran pokazuje `organization_id` (`EnterpriseFeatureFlags.tsx:792-796`), ale formularz nie ma pola organizacji i **kaleczy klucz**: `:921` `toLowerCase().replace(/[^a-z0-9_]/g,'_')`; kod aplikacji ostrzega, że flagę trzeba założyć curlem, nie tym ekranem (`src/hooks/useFeatureFlags.tsx:214-219`) | WAŻNE |
| A12 | Administracja sesjami demo (lista / wygaszenie / przedłużenie) | **BRAK** | endpointy `server/src/routes/demo.routes.ts:82,219,307,362,415` działają wyłącznie na `req.user.id`; grep `demo` w `superadmin.routes.ts` = 0 trafień; brak reapera („nothing sweeps `demo_sessions` on a schedule" — `server/src/middleware/auth.middleware.ts:665`) | WAŻNE |
| A13 | Sprzątanie osieroconych organizacji demo | **BRAK** (tylko skrypt) | `server/scripts/cleanup-orphan-demo-orgs.ts:58-59` — „intentionally NOT wired into any autorun/boot path. It is an operator tool"; powód powstania: ~179 osieroconych orgów zaśmieciło listy Super Admina (`:6-13`) | WAŻNE |
| A14 | Rotacja kluczy LLM (Anthropic/OpenAI/…) | **BRAK** | klucze wyłącznie z env: `server/src/config/envValidator.ts:69-73`; superadmin widzi tylko obecność (`controllers/SuperAdminController.ts:3448-3461`) | KRYTYCZNE_DLA_MVP |
| A15 | Włączenie providera LLM **dla innej organizacji** | **BRAK** | `server/src/routes/llm.routes.ts:636` — org z tokenu wołającego, nie z parametru; klient `Api.toggleOrganizationLLM` (`src/services/api.ts:4032-4040`) ma **zero wywołań** w `src/` | WAŻNE |
| A16 | `organization_ai_policy` (region / typ dostawcy / klasa danych) | **BRAK** | tabela `server/migrations/576_ai_enterprise_llm_registry.sql:50`; brak endpointu i UI | PO-MVP |
| A17 | Whitelabel / branding per organizacja | JEST_PEŁNE | `WhitelabelStudioView.tsx:121,142,170,194,215,236,252` ↔ `server/src/routes/organization/branding.routes.ts:253,291,325,385,529,565,656`. **Zastrzeżenie:** ekran poza nawigacją (§1) | WAŻNE |
| A18 | Whitelabel „enterprise" (SSL, DKIM, szablony e-mail, okładka raportu) | **BRAK** | tabela `white_label_config` (55 kolumn) `server/migrations/20260719_baseline_gap.sql:10302-10356`; serwis `services/enterpriseService.ts:291,332-380` — **zero wywołań** w routerach/kontrolerach | PO-MVP |
| A19 | Limity/kwoty organizacji (`organization_limits`) | TYLKO_BACKEND | zapis wyłącznie przez `services/billing/billingAdminOps.ts:353-368`; egzekucja `middleware/resourceQuota.middleware.ts:157,245`; API organizacji ma tylko `GET /policy-snapshot` (`routes/organization/organization-limits.routes.ts:21-22`) | KRYTYCZNE_DLA_MVP |
| A20 | Polityki organizacji (retencja / legal hold / rezydencja) — zapis | TYLKO_BACKEND | `PUT /superadmin/org-policies/:orgId` (`superadmin.routes.ts:720`); UI tylko czyta (`TenantCommandCenterView.tsx:138`) | WAŻNE |

## Grupa B — wymagania ZE SPECU 14_ADMIN

Źródło: `docs/program/waves/WAVE_03_ACCEPTANCE/owner_feedback/14_ADMIN/FINAL_IMPLEMENTATION_SPEC.md`.

| ID | Wymaganie (cytat/parafraza) | Pokrycie | Dowód | Waga |
|---|---|---|---|---|
| B1 | Rozdzielenie diagnostyki klienta od operacji platformy (`ADM-FINAL-AC-009`, spec `:103`, domena System Health `:73-79`) | JEST_CZĘŚCIOWE | strona klienta odcięta (`AdminSettingsModule.tsx:54,286`), strona platformowa **nie powstała** | KRYTYCZNE_DLA_MVP |
| B2 | „Run-all probes … require Platform Operator" (spec `:77-79`) | **BRAK** | patrz A8 | KRYTYCZNE_DLA_MVP |
| B3 | „repair" — naprawa stanu/danych | **BRAK** | brak endpointu i ekranu; naprawy = skrypty (`server/scripts/align-atelier-data-to-demo-org.ts`, `restore-elk-visibility.ts`, `purge-incomplete-assessments.ts`) | KRYTYCZNE_DLA_MVP |
| B4 | „rollback" | JEST_CZĘŚCIOWE | konfiguracja runtime: **jest** w UI (`EnterpriseConfigurationPanel.tsx:222` → `superadmin.routes.ts:2230`); polityka LLM per org: tylko backend (`llm.routes.ts:1836`); rollback migracji: tylko skrypt (`server/scripts/rollback-migration.ts`) | WAŻNE |
| B5 | „infrastructure mutation" | JEST_CZĘŚCIOWE | konfiguracje/integracje/webhooki/klucze API — **są** w UI; `POST /connectors/:id/emergency-kill` (`superadmin.routes.ts:1024`) — zero wywołań w `src/` | WAŻNE |
| B6 | „cross-tenant detail" | JEST_PEŁNE | `OrganizationsView.tsx:162-164`; `TenantCommandCenterView.tsx:137-139`; użytkownicy cross-tenant `superadmin.routes.ts:763-767` | WAŻNE |
| B7 | Kontrakt mutacji: re-auth, wpisanie nazwy celu, powód, podgląd zasięgu, ścieżka odzysku (spec `:81-89`) | TYLKO_BACKEND | serwer to ma: `middleware/confirmAction.middleware.ts:56-59,83`; type-to-confirm `superadmin.routes.ts:1103-1110`; `recoveryPath` `:831,869,1208` — **UI tego nie używa nigdzie** | KRYTYCZNE_DLA_MVP |
| B8 | „bulk actions never report all-success on partial failure" (spec `:89`) | JEST_CZĘŚCIOWE | brak dowodu w kodzie UI (`BulkOperationsView`); nie znalazłem testu na częściową porażkę | WAŻNE |
| B9 | Trwały ślad audytowy dla **każdej** akcji sterującej | JEST_CZĘŚCIOWE | `requireAudit` jest globalnie (`superadmin.routes.ts:353`), ale to tylko **podpięcie funkcji**; `PUT /organizations/:id` (`:672-676`) nie ma `requireConfirmation`, nie ma per-route `requireAudit`, a handler `controllers/SuperAdminController.ts:326-377` **nie emituje żadnego zdarzenia** — a to jedyna ścieżka zawieszania org dostępna z UI (patrz C2) | KRYTYCZNE_DLA_MVP |
| B10 | Autoryzacja sprawdzana **po stronie serwera**, nie stałą w kliencie (spec `:23`, `:96`) | **BRAK** | `AdminSettingsModule.tsx:53` — komentarz „Fail closed until the backend exposes a verified Platform Operator capability"; backend **ma** kontrakt capability (`superAdmin.middleware.ts:43-49,517`), ale nie ma pojęcia „Platform Operator" i nikt nie wystawia claimu → warunek AC-009 spełniony dziś wyłącznie stałą po stronie klienta | KRYTYCZNE_DLA_MVP |

## Grupa C — wymagania Z CYKLU ŻYCIA PRODUKTU SaaS

| ID | Operacja | Pokrycie | Dowód | Waga |
|---|---|---|---|---|
| C1 | Założenie organizacji klienta przez operatora | **BRAK** | `POST /api/organizations` (`routes/organization/organizations.routes.ts:47`) **nie jest** bramkowane superadminem; jedyny wołający to ekran użytkownika `src/components/settings/OrganizationSettings.tsx:182`. Zero ścieżki z `/superadmin/*` | KRYTYCZNE_DLA_MVP |
| C2 | Zawieszenie organizacji (audytowane) | TYLKO_BACKEND | `POST /superadmin/tenants/:id/suspend` (`superadmin.routes.ts:785-836`, `requireConfirmation` + `requireAudit` + zdarzenie `tenant.suspended`). **Grep `superadmin/tenants` w całym `src/` = 0.** Z UI da się to zrobić wyłącznie nieaudytowanym `PUT /organizations/:id` z `status:'suspended'` (`OrganizationsView.tsx:294-297,551-552`) | KRYTYCZNE_DLA_MVP |
| C3 | Reaktywacja organizacji | TYLKO_BACKEND | `superadmin.routes.ts:839-874`; zero wołań w `src/` | WAŻNE |
| C4 | Usunięcie organizacji | JEST_CZĘŚCIOWE (**przycisk zepsuty**) | endpoint `superadmin.routes.ts:677-696` wymaga `body.confirmation === true` (`confirmAction.middleware.ts:56-59,83` → 428); klient `src/services/api.ts:2989-2995` wysyła **`DELETE` bez ciała** → przycisk w `OrganizationsView.tsx:256` zawsze kończy się 428 | KRYTYCZNE_DLA_MVP |
| C5 | Purge danych tenanta (rozwiązanie umowy / RODO) | TYLKO_BACKEND | `superadmin.routes.ts:1092-1093`, type-to-confirm `:1103-1110`; zero wołań w `src/` | KRYTYCZNE_DLA_MVP |
| C6 | Awaryjny lockdown tenanta | TYLKO_BACKEND | `superadmin.routes.ts:1177-1178`; zero wołań | WAŻNE |
| C7 | CRUD planów / cennika | TYLKO_BACKEND | `routes/billing/billing.routes.ts:764,792,846,915` + `routes/resourceManagement.routes.ts:33,55,106,159`; **dwa gotowe ekrany są sierotami** (`SuperAdminPlansView.tsx:34`, `SubscriptionPlansManager.tsx:78`) | KRYTYCZNE_DLA_MVP |
| C8 | Przypisanie planu / okres karencji / kontrakt manualny | TYLKO_BACKEND (częściowo) | `billing/billingAdmin.routes.ts:31,56` bez wołań; jedynie `manual-contract` (`:92`) ma UI (`BillingCenterView.tsx:1482`) | KRYTYCZNE_DLA_MVP |
| C9 | Faktury | JEST_PEŁNE | `InvoiceCenterView.tsx:145-146,238,258,307` ↔ `superadmin.routes.ts:1416-1483` | WAŻNE |
| C10 | Użytkownicy cross-tenant | JEST_PEŁNE | `UserManagementCore.tsx:608,696,729,780` ↔ `superadmin.routes.ts:763-773` | KRYTYCZNE_DLA_MVP |
| C11 | Impersonacja (wsparcie) | JEST_PEŁNE | `UserManagementCore.tsx:794-808`; wyjście `src/components/shared/ImpersonationBanner.tsx:31`; baner `src/layouts/MainLayout.tsx:302-306` | WAŻNE |
| C12 | Wsparcie: zgłoszenia, notatki CS, health klienta | JEST_PEŁNE | `support/SupportTicketsView.tsx:197,256,294`; `support/CustomerSuccessNotesView.tsx:231,292`; `support/CustomerHealthView.tsx:89` | WAŻNE |
| C13 | Backup — lista, wyzwolenie, harmonogram | JEST_PEŁNE | `EnterpriseBackupPanel.tsx:173,192,222,248` ↔ `admin/backup.routes.ts:37`, `superadmin.routes.ts:2307,2337,2393` | WAŻNE |
| C14 | **Restore** z backupu | TYLKO_BACKEND | `POST /api/admin/backups/restore` (`admin/backup.routes.ts:115`, `verifySuperAdmin`); klient istnieje (`src/services/api.ts:17676`) ale **zero komponentów go woła** | KRYTYCZNE_DLA_MVP |
| C15 | Migracje bazy / bramka wdrożeniowa | **BRAK** | wyłącznie skrypty: `server/scripts/release-migration-gate.ts`, `preflight-pending-migrations.ts`, `verify-schema-vs-migrations.ts`, `rollback-migration.ts` | KRYTYCZNE_DLA_MVP |
| C16 | Eksport masowy danych / DSAR | JEST_CZĘŚCIOWE | DSAR realnie działa (`ComplianceCenterView.tsx:338,501,529`); `POST /superadmin/data/bulk-export` (`superadmin.routes.ts:1066`) bez wołań; ekran eksportu to atrapa (`DataExportPanel.tsx:95,107`) | WAŻNE |
| C17 | Zdrowie platformy (monitoring, alerty) | JEST_PEŁNE | `EnterpriseHealthMonitor.tsx:232-234,341,361` ↔ `superadmin.routes.ts:1843,1901-2018`; wskaźniki w nagłówku `src/components/SuperAdmin/SuperAdminStatusIndicators.tsx:275-277` | WAŻNE |
| C18 | Rejestr incydentów | JEST_PEŁNE | `iam/SecurityIncidentsView.tsx:285-286,322,360,389` ↔ `superadmin.routes.ts:2578-2602` | WAŻNE |
| C19 | Dziennik audytu (przegląd, eksport, rozstrzyganie) | JEST_PEŁNE | `EnterpriseAuditLog.tsx:221,233,263`; `iam/AdminAuditLogsView.tsx:219,253,277` ↔ `superadmin.routes.ts:3464-3468` | WAŻNE |
| C20 | Realne MFA dla kont platformowych | **BRAK** | `CONSULTIFY_SUPERADMIN_MFA_REPORT.md:15-19` — odczyt zaimplementowany, zapisy `totp/setup` i `totp/verify` **bez żadnego wołającego**; `MFAService` zwraca `FEATURE_UNAVAILABLE` (`:130-137`) | KRYTYCZNE_DLA_MVP |
| C21 | Wymuszony reset MFA użytkownika | TYLKO_BACKEND | `superadmin.routes.ts:877-879` (`security_ops`); zero wołań | WAŻNE |
| C22 | Platformowy override MFA / SSO | TYLKO_BACKEND | `superadmin.routes.ts:916,953`; zero wołań | WAŻNE |
| C23 | Bootstrap pierwszego superadmina środowiska | **BRAK** (skrypt) | `server/scripts/provision-superadmin.ts` — jedyna droga; nagłówek dokumentuje, że wiersz z `server/migrations/000_z_core_baseline.sql:751-753` używa `INSERT OR IGNORE` (SQLite-only) i **nigdy nie wykona się na Postgresie**, a i tak nie ma hasła | KRYTYCZNE_DLA_MVP |
| C24 | Klucze API platformy | JEST_PEŁNE | `APIManagementView.tsx:262,505-506,577` ↔ `superadmin.routes.ts:1589-1607` | WAŻNE |
| C25 | Przyznawanie modułów organizacjom | JEST_PEŁNE | `ModuleAccessControlView.tsx:63,99,121,134` ↔ `routes/module-access.routes.ts:150,179,296` | WAŻNE |
| C26 | Lista oczekujących na moduły | JEST_PEŁNE | `ModuleWaitlistView.tsx:62,101` | PO-MVP |
| C27 | Operacje programu partnerskiego | JEST_CZĘŚCIOWE | backend bogaty (`routes/partners.routes.ts:2484-3172`); UI pokrywa rozliczenia (`revenue/PartnerSettlementsView.tsx:218-223`), ale kolejka certyfikacji/aplikacji (`:3074,3088,3158,3172`) bez ekranu | WAŻNE |
| C28 | Komunikacja / broadcast do tenantów | JEST_PEŁNE | `customers/CustomerCommunicationView.tsx:147-148,184,199` ↔ `superadmin.routes.ts:4940-5008` | PO-MVP |
| C29 | Publikacja dokumentów prawnych / polityk | JEST_PEŁNE | `SuperAdminLegalView` ↔ `superadmin.routes.ts:1336-1354`. **Zastrzeżenie:** ekran poza nawigacją (§1) | WAŻNE |
| C30 | Zarządzanie pracownikami wirtualnymi (Teresa/Anna) | JEST_PEŁNE | `VirtualWorkersModule/*` (dowody w §1). **Zastrzeżenie:** ekran poza nawigacją | WAŻNE |

## 2.1 Bilans

| Pokrycie | Liczba | % z 60 |
|---|---|---|
| JEST_PEŁNE | **18** | 30% |
| JEST_CZĘŚCIOWE | **11** | 18% |
| TYLKO_BACKEND | **12** | 20% |
| BRAK | **19** | 32% |

Wymagań oznaczonych **KRYTYCZNE_DLA_MVP: 20**. Z nich **16 ma status BRAK lub TYLKO_BACKEND**:
BRAK — A7, A8, A9, A14, B2, B3, B10, C1, C15, C20, C23 (11)
TYLKO_BACKEND — A19, B7, C2, C5, C7, C8, C14 (7)
…łącznie 18 pozycji krytycznych bez działającej ścieżki z UI; pozostałe 2 krytyczne (`A2`, `C10`) są pełne, a `A3`, `B1`, `B9`, `C4` — częściowe.

*(Uwaga metodyczna: A7/B1/B2 opisują ten sam brak z dwóch stron — z kodu i ze specu. Nie scalałem ich, żeby tabela pozostała weryfikowalna względem obu źródeł; przy liczeniu zadań w §4 traktuję je jako jedno zadanie.)*

---

# 3. Obserwacja P2 — nawigacja superadmina (stan Zustand vs URL)

## 3.1 Co twierdzą dowody nocne
`docs/program/waves/WAVE_03_ACCEPTANCE/TRIANGLE_COMPLETENESS_VERDICT_2026-08-24.md:62`:
„SuperAdminView po ~300ms normalizuje URL do `/superadmin/customers` (stan Zustand niesynchronizowany z URL) — do sprzątnięcia przy module SuperAdmin, bez wpływu na bezpieczeństwo."
Szczegóły: `docs/.../modules/14_ADMIN/evidence-superadmin-20260824/evidence-log.md:227-264` — po naprawie TRI-MUST-04 wszystkie cztery cele przekierowań (billing, organizations, users, `?from=`) **osiadają na `/superadmin/customers`**, tracąc cel i parametr.

## 3.2 Mechanizm — zweryfikowany w kodzie (i korekta do dowodu nocnego)

1. `SuperAdminView.tsx:83-95` — efekt: jeśli `currentView` nie zaczyna się od `SUPERADMIN_` **albo** nie ma wpisu w `appViewToSection`, wykonuje `setCurrentView(SUPERADMIN_CUSTOMERS)` + `navigate(..., {replace:true})`.
2. `currentView` jest **trwały** (persist): `src/store/useAppStore.ts:152` w `partialize`.
3. Synchronizacja URL→stan **istnieje**: `src/components/RouterSync.tsx:363-365` woła `getAppViewFromPath(path)` i ustawia `setCurrentViewState`. Mapowanie tras `/superadmin/*` jest kompletne: `src/routes/routeConfig.ts:782-829`.
4. **Sedno wyścigu:** `RouterSync` jest w drzewie **przed** `AppRoutes` (`src/App.tsx:421` vs `:573`), więc jego efekt wykonuje się pierwszy — ale `setState` w efekcie jest wsadowany i przetwarzany **po** przelocie wszystkich efektów tego commitu. Efekt w `SuperAdminView` w tym samym przelocie widzi jeszcze **starą** wartość `currentView` i zdąży wykonać `navigate('/superadmin/customers', replace)`. Po przerysowaniu adres jest już zmieniony, `RouterSync` mapuje go z powrotem na `SUPERADMIN_CUSTOMERS` — cel deep-linku jest bezpowrotnie utracony.

**Korekta:** dowód nocny (`evidence-log.md:262-264`) proponuje naprawę słowami „`getAppViewFromRoute` … istnieje w `src/routes/routeConfig.ts:636` ale nie jest nigdzie wołane". To **nieścisłe**: funkcja jest wołana w `routeConfig.ts:737` wewnątrz `getAppViewFromPath`, a ta trafia do `RouterSync.tsx:363`. Problem nie polega na braku synchronizacji, tylko na **kolejności efektów w jednym commicie**. Poprawka „dodajmy wywołanie" nie zadziała — trzeba usunąć wyścig.

## 3.3 Kiedy to boli, a kiedy nie
- **Boli:** wejście na `/superadmin/<cokolwiek>` z widoku spoza superadmina — świeże logowanie, przekierowania handoff z `/settings/*` i `/organization/*` (`AppRoutes.tsx:3073-3182`), zakładka z poprzedniej sesji użytkownika.
- **Nie boli:** przeładowanie strony, gdy poprzedni `currentView` był już widokiem `SUPERADMIN_*` z `appViewToSection` (mapa jest kompletna — zdiffowałem enum `AppView` z `src/types/core.ts` przeciw `SuperAdminSidebar.tsx:30-64`: **zero pozycji brakujących**).

## 3.4 Skala problemu — ocena

Oceniam skalę jako **większą niż „P2 kosmetyka", ale mniejszą niż blokada bezpieczeństwa**. Uzasadnienie:

1. **To nie jest jedyny defekt nawigacji, tylko wierzchołek.** Adresowalność w tej warstwie jest z gruntu połowiczna: 31 stałych tras, **5 wejść z sidebara**, ~85 zakładek treści. `CustomersModule` czyta `?tab=` (`:73-85`) ale **nigdy go nie zapisuje** — 19 zakładek Tenant Ops nie ma własnego adresu. `SystemModule` zapisuje adres tylko dla podzbioru zakładek (`:132-137`). Skutek praktyczny: **nie da się wysłać komuś linku do konkretnego ekranu operacyjnego** i nie da się wrócić „wstecz" w obrębie modułu.
2. **Dwa realne moduły są całkowicie poza nawigacją** (Configuration/Whitelabel i VirtualWorkers, §1). Jedyny sposób dotarcia to ręczne wpisanie adresu — czyli dokładnie ta ścieżka, którą defekt P2 psuje.
3. **Ryzyko operacyjne, nie bezpieczeństwa.** Bramka roli działa (`AppRoutes.tsx:3220`), izolacja tenantów nie jest naruszona (`evidence-log.md:266-275`). Nikt nie zobaczy cudzych danych. Ale operator w sytuacji awaryjnej („wejdź w Whitelabel Studio dla klienta X") zostanie odrzucony na listę klientów bez komunikatu — a to jest ten typ tarcia, który w incydencie kosztuje minuty.
4. **Koszt naprawy jest nieproporcjonalnie mały** względem szkody (S, patrz §4 Z-8).

**Werdykt:** utrzymać klasyfikację P2 dla samego wyścigu, ale nie zamykać tematu bez zadania Z-9 (adresowalność zakładek) — inaczej naprawa wyścigu odsłoni po prostu następną warstwę tego samego problemu.

---

# 4. Rekomendowane zadania

Sortowanie: waga malejąco, w obrębie wagi — koszt rosnąco. Szacunek: **S** ≤ 0,5 dnia · **M** 1–3 dni · **L** > 3 dni.

## KRYTYCZNE_DLA_MVP

| # | Zadanie | Dlaczego | Szacunek |
|---|---|---|---|
| Z-1 | Naprawić przycisk „usuń organizację": dosłać `{confirmation:true, reason}` w `src/services/api.ts:2989-2995` | Dziś każdy klik = 428; operator myśli, że system jest zepsuty | **S** |
| Z-2 | Podpiąć `SuperAdminPlansView` do `ConfigurationModule`/`RevenueModule` i usunąć duplikat `SubscriptionPlansManager` | Gotowy, sprawny edytor cennika leży odłączony (`SuperAdminPlansView.tsx:34`); dziś cennik = SQL | **S** |
| Z-3 | Dodać `:orgId` do `PUT /api/v8/admin/flags/:module` (`v8/admin/feature-flags.routes.ts:36`) — serwis już to potrafi (`featureFlagService.ts:160-198`) | Bez tego **nie da się włączyć V8 klientowi** inaczej niż SQL-em lub impersonacją | **S** |
| Z-4 | To samo dla przełącznika providera LLM per organizacja (`llm.routes.ts:636`) | Identyczny wzorzec „własna org zamiast parametru" | **S** |
| Z-5 | Przepiąć zawieszanie/reaktywację organizacji w `OrganizationsView` z nieaudytowanego `PUT /organizations/:id` na audytowane `POST /tenants/:id/suspend|reactivate` (`superadmin.routes.ts:785,839`) | Dziś jedyna klikalna ścieżka **nie zostawia śladu audytowego** (`SuperAdminController.ts:326-377` nic nie emituje) — wprost sprzeczne ze specem `:63-64` i P33 `:126-129` | **M** |
| Z-6 | Zbudować ekran „Operacje platformowe" w `/superadmin/system`: probe'y (run-all + per-probe), purge/lockdown tenanta, kill-switch konektora, bulk-export, restore backupu — z pełnym kontraktem mutacji ze specu `:81-89` (re-auth, wpisanie nazwy, powód, zasięg, ścieżka odzysku) | Zamyka jednym ekranem: A7, A8, B2, B3, B7, C5, C6, C14 + `data/bulk-export`. Backend jest gotowy i audytowany — brakuje wyłącznie frontu | **L** |
| Z-7 | Odblokować probe'y zdrowia dla operatora platformy: rozdzielić bramkę `admin/health-panel.routes.ts:36-90` na wariant tenantowy (członkostwo) i platformowy (`verifySuperAdmin` + `platform_ops`) | Dziś probe'y są niedostępne **dla wszystkich**: klient odcięty stałą, operator odcięty wymogiem członkostwa | **M** |
| Z-8 | Usunąć wyścig nawigacyjny: w `SuperAdminView.tsx:83-95` liczyć widok z `useLocation().pathname` przez `getAppViewFromPath`, a normalizację wykonywać tylko gdy adres naprawdę nie mapuje się na widok superadmina | Kasuje odbicie ~300 ms i utratę celu deep-linku (§3) | **S** |
| Z-9 | Wprowadzić zakładkę do adresu w `CustomersModule` (zapis `?tab=`, dziś tylko odczyt `:73-85`) — wzorem `SystemModule.tsx:132-137` | 19 zakładek Tenant Ops nie ma adresu; bez tego Z-8 odsłania kolejną warstwę problemu | **M** |
| Z-10 | Ekran zakładania organizacji klienta w `/superadmin/customers/organizations` (obudować `POST /api/organizations` bramką superadmina) | Onboarding tenanta jest dziś aktem ręcznym/impersonowanym (`C1`) | **M** |
| Z-11 | Wystawić realny kontrakt „Platform Operator": osadzać `superadminCapabilities` w tokenie i zastąpić `CAN_ACCESS_PLATFORM_OPERATIONS = false` (`AdminSettingsModule.tsx:54`) odczytem z serwera | `ADM-FINAL-AC-009` jest dziś spełnione **stałą po stronie klienta**, co spec `:23,:96` wprost odrzuca | **M** |
| Z-12 | Domknąć MFA kont platformowych (`MFAService` → `FEATURE_UNAVAILABLE`, `CONSULTIFY_SUPERADMIN_MFA_REPORT.md:130-137`) albo formalnie oznaczyć martwe zapisy `totp/*` jako kwarantannę | Konto z dostępem cross-tenant bez drugiego składnika | **M** |
| Z-13 | Udokumentować i zautomatyzować bootstrap pierwszego superadmina (`server/scripts/provision-superadmin.ts`) — migracja `000_z_core_baseline.sql:751-753` nie działa na Postgresie | Odtworzenie środowiska od zera wymaga wiedzy plemiennej | **S** |
| Z-14 | Wpiąć rotację kluczy LLM i limity organizacji (`organization_limits`) do UI albo świadomie zapisać jako „env-only / tylko przez kontrakt" w rejestrze decyzji | A14, A19 — dziś nieudokumentowane operacje ręczne | **M** |

## WAŻNE

| # | Zadanie | Szacunek |
|---|---|---|
| Z-15 | Dodać wejścia w sidebarze dla `Configuration` (Whitelabel/Legal) i `Virtual Workers` — `SuperAdminSidebar.tsx:80-91` | **S** |
| Z-16 | Ekran administracji sesjami demo + wpięcie `cleanup-orphan-demo-orgs.ts` jako akcji operatora (A12, A13) | **M** |
| Z-17 | Naprawić formularz flag: dodać pole organizacji i przestać kaleczyć klucz (`EnterpriseFeatureFlags.tsx:921`) | **S** |
| Z-18 | Wpiąć `POST /superadmin/billing/change-plan` i `grace-period` do `BillingCenterView` (A3, C8) | **M** |
| Z-19 | Zastąpić atrapę `DataExportPanel` (`:95,107`) realnym `POST /superadmin/data/bulk-export` albo usunąć zakładkę | **S** |
| Z-20 | Wpiąć wymuszony reset MFA i override MFA/SSO (C21, C22) do `SecurityModule` | **M** |
| Z-21 | Ekran kolejki certyfikacji/aplikacji partnerskich (`partners.routes.ts:3074,3158`) | **M** |
| Z-22 | Usunąć albo podpiąć 14 plików-sierot z `src/views/superadmin/` (§1) | **S** |
| Z-23 | Dowód „bulk actions nie raportują all-success przy częściowej porażce" (spec `:89`) — test + korekta UI | **M** |
| Z-24 | Uspójnić bramki: dwie różne implementacje `requireSuperAdmin` (DB-backed `superAdmin.middleware.ts:192` vs claim-only `auth.middleware.ts:1527-1542`) plus trzecia lokalna (`routes/ai/aiPlaybooks.routes.ts:13-19`) | **M** |

## PO-MVP

| # | Zadanie | Szacunek |
|---|---|---|
| Z-25 | Granularne capability operatorów (A6) — tabela + ekran nadawania + claim w tokenie | **L** |
| Z-26 | Wystawić `white_label_config` (SSL/DKIM/e-mail) albo scalić z `organization_branding` — dziś dwie konkurujące tabele (A18) | **L** |
| Z-27 | `organization_ai_policy` w UI (A16) | **M** |
| Z-28 | i18n warstwy superadmina: **18 z 164** plików `src/views/superadmin/*.tsx` używa `useTranslation` | **L** |
| Z-29 | Kanon list: **41 z 164** plików używa `StandardTable`; reszta to własne tabele — sprzeczne z regułą #9 z `CLAUDE.md` | **L** |

---

# 5. RAPORT

## Liczby

**Pokrycie wymagań (60 pozycji: 20 z kodu + 10 ze specu + 30 z cyklu życia):**
- JEST_PEŁNE — **18**
- JEST_CZĘŚCIOWE — **11**
- TYLKO_BACKEND — **12**
- BRAK — **19**

**KRYTYCZNE_DLA_MVP: 20 pozycji, z czego 16 ma status BRAK (11) lub TYLKO_BACKEND (7).**

**Inwentarz ekranów:** 31 zadeklarowanych tras · 5 wejść nawigacyjnych · ~85 zakładek treści · 3 atrapy · 2 moduły poza nawigacją · 14 plików-sierot.

**Pomiary jakościowe:** i18n 18/164 plików · `StandardTable` 41/164 plików.

## Trzy najważniejsze ustalenia

**1. Backend platformowy jest gotowy i audytowany — brakuje frontu. Wszystkie dziesięć krytycznych akcji operatorskich P33 nie ma ani jednego wywołania z aplikacji.**
`superadmin.routes.ts` implementuje z `requireConfirmation` + `requireAudit` + type-to-confirm: zawieszenie tenanta (`:785`), reaktywację (`:839`), wymuszony reset MFA (`:877`), platformowy override MFA (`:916`) i SSO (`:953`), zawieszenie modelu AI (`:988`), kill-switch konektora (`:1024`), eksport masowy (`:1066`), purge tenanta (`:1092`), lockdown (`:1177`), zawieszenie pracownika wirtualnego (`:1141`). **Grep `superadmin/tenants` po całym `src/` zwraca 0.** Żaden z nich nie ma przycisku. To nie jest brak funkcji — to brak ostatnich 10% (patrz Z-6).

**2. Jedyna klikalna ścieżka zawieszenia klienta omija audyt.**
Z UI zawiesza się organizację przez `PUT /superadmin/organizations/:id` ze `status:'suspended'` (`OrganizationsView.tsx:294-297,551-552`). Ta trasa (`superadmin.routes.ts:672-676`) nie ma `requireConfirmation`, nie ma per-route `requireAudit`, a jej handler (`SuperAdminController.ts:326-377`) wykonuje surowy `UPDATE organizations` **bez emisji jakiegokolwiek zdarzenia audytowego** — podczas gdy dedykowana trasa `:785` emituje `tenant.suspended` z before/after i liczbą dotkniętych użytkowników. Globalny `router.use(requireAudit)` (`:353`) tylko **udostępnia** funkcję `emitAuditEvent`; nie wymusza jej wywołania. To sprzeczność z `FINAL_IMPLEMENTATION_SPEC.md:63-64` i z doktryną P33 („no sensitive action may proceed without audit"). Naprawa: Z-5, koszt M.

**3. „Platform Operator" nie istnieje nigdzie poza jedną stałą w kliencie — a spec wprost mówi, że to za mało.**
`src/views/admin/AdminSettingsModule.tsx:54` zawiera `const CAN_ACCESS_PLATFORM_OPERATIONS = false;` z komentarzem „Fail closed until the backend exposes a verified Platform Operator capability". Backend **ma** system capability (`superAdmin.middleware.ts:43-49,517-579`), ale (a) nie ma w nim pojęcia „Platform Operator", (b) żaden wystawca tokenu nie ustawia claimu `superadminCapabilities`, więc każda rola `superadmin` dostaje wszystkie 5 uprawnień (`:168-170`), (c) po stronie `/superadmin/*` **nie powstał żaden odpowiednik ekranu Platform Operations**. Efekt: probe'y zdrowia są niedostępne dla **wszystkich** — klient odcięty stałą, operator odcięty wymogiem aktywnego członkostwa w organizacji (`admin/health-panel.routes.ts:36-90`, a fixture superadmina ma `membership: NONE`, `evidence-log.md:37-41`). Kryterium `ADM-FINAL-AC-009` jest dziś spełnione wyłącznie stałą po stronie klienta, co `FINAL_IMPLEMENTATION_SPEC.md:23` i `:96` odrzucają jako niewystarczające.

## Uwaga do nadzorcy — kontekst zarządczy

Warstwa `/superadmin/*` jest **poza programem 16 modułów Fali 3**: `docs/FUNCTIONAL_DOCUMENTATION.md:99` klasyfikuje ją jako „osobna, uprawniona płaszczyzna sterowania, nie standardowa pozycja pokazanego menu", `MODULE_ACCEPTANCE.md:21` mówi „`/superadmin/*` is a separate platform control plane", a `OWNER_DECISION_LEDGER_2026-08-24.md:32` zamyka decyzję DEC-2026-08-24-10 słowami „Warstwa `/superadmin/*` osobna, nietknięta". Dodatkowo w `docs/SOURCE_OF_TRUTH.md` **nie ma ani jednej wzmianki** o superadminie (grep = 0 trafień). Konsekwencja: ta warstwa nie ma właściciela odbioru, nie ma karty akceptacji i nie przeszła przeglądu wizualnego właściciela — przy 19 wymaganiach ze statusem BRAK i 12 „tylko backend". Rekomendacja: nadać jej własną kartę akceptacji przed uruchomieniem komercyjnym, bo bez niej nie da się dziś obsłużyć klienta (założyć, zawiesić, wycenić, odtworzyć jego dane) bez SQL-a i curl-a.

---

## Zatwierdzenie nadzorcy

Data: 2026-08-25 · Podpis: Fable (sesja nadzorcza) · Status: `APPROVED / SIGNED`

Weryfikacja wyrywkowa trzech twierdzeń nośnych wykonana osobiście (grep, odczyt tras i kontrolera):
1. POTWIERDZONE — 10 akcji operatorskich P33 z requireConfirmation ma zero wywołań z src/ (grep `superadmin/tenants` = 0).
2. POTWIERDZONE — `PUT /superadmin/organizations/:id` (jedyna klikalna ścieżka zawieszenia) bez requireConfirmation i bez emisji zdarzenia audytowego w kontrolerze.
3. POTWIERDZONE — `CAN_ACCESS_PLATFORM_OPERATIONS=false` na sztywno w kliencie; backend przyznaje każdemu superadminowi komplet capability (fallback), claim nie jest nigdzie wystawiany.

Werdykt: analiza przyjęta w całości. Konsekwencje zarządcze:
- Warstwa Superadmin otrzymuje status ODRĘBNEGO TORU PRAC (poza 16 modułami) z 20 pozycjami KRYTYCZNE_DLA_MVP; wymaga karty akceptacji i właściciela odbioru (dziś brak — również w SOURCE_OF_TRUTH).
- Do rejestru MUST przed wdrożeniem dochodzą: audyt ścieżki zawieszenia organizacji (TRI-MUST-12) oraz decyzja właściciela o zakresie „Operacji platformowych" (Z-6: jeden ekran domyka 8 wymagań — backend gotowy).
- Wcześniejsze „zamknięcie obszaru Superadmin" w werdykcie trójkąta dotyczyło DZIAŁANIA superadmina w Settings/Admin (defekty naprawione) — NIE kompletności jego własnej warstwy; ta pozostaje otwarta wg niniejszego raportu.
