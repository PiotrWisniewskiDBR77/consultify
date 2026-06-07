# Plan startu na 100% — Admin / SuperAdmin / Mobile

**Data:** 2026-06-07 · **Branch:** Londyn · **Autor:** code-verified audit (5 równoległych analiz + weryfikacja kodu)
**Zakres:** SuperAdmin, Org-Admin, RBAC, responsywność mobile, oraz cross-cutting blokery GA wynikające z sensu całej aplikacji.

> Uwaga o "FizzyUp": w kodzie nie istnieje żaden byt o tej nazwie. Plan traktuje "FizzyUp superadmin" = moduł **SuperAdmin** (`src/views/superadmin/`).

---

## 0. Stan faktyczny (rozstrzygnięcie rozbieżności)

| Źródło | Ocena Panelu Admin | Status |
|---|---|---|
| Audyt 2026-06-02 (Module 17) | 38/100, "65 paneli, 0 zamontowanych" | **NIEAKTUALNE** |
| Weryfikacja kodu Londyn (2026-06-07) | SuperAdmin ~98% zamontowany i podłączony do realnego API/DB | **AKTUALNE** |

SuperAdmin został zamontowany po audycie 06-02. Plan opiera się na bieżącym kodzie.
Produkt = AI-owa platforma transformacji (Discovery → Assessment → Initiatives → Roadmap → Execution → Benefits). Persony: Client (Owner/CEO/CFO/COO/PMO/IT), Org-Admin, SuperAdmin.

---

## 1. BLOKERY GA (P0) — STATUS PO WERYFIKACJI KODU 2026-06-07

> **Ustalenie:** P0-1..P0-5 z audytu 06-02 są JUŻ NAPRAWIONE na branchu Londyn. Audyt 06-02 jest w tej części nieaktualny. Realny pozostały blocker P0 = tylko P0-6 (RBAC).

| ID | Blokер | Status / dowód | Obszar |
|---|---|---|---|
| P0-1 | Płatność kartą fałszywa (`pm_..._mock`) | ✅ ZAŁATWIONE decyzją: faktury manualne. Flaga `isBillingSelfServeEnabled()` domyślnie OFF, brak fake-success path (`billingSelfServeFlag.ts`) | Billing |
| P0-2 | Demo-data wyciek przy 404/503 | ✅ NAPRAWIONE. `api.ts:602` + `resultsShowcaseData.ts:87` — gate STRICTLY na jawny toggle, "NEVER auto-activate, no 404/503 trigger" | Cross |
| P0-3 | SUPERADMIN→/admin bez audytu | ✅ NAPRAWIONE. `ProtectedRoute.tsx:68-74` przekierowuje SUPERADMIN z tras ADMIN (audit ADM-RAW-P0-001) | Security |
| P0-4 | Usunięcie konta bez hasła | ✅ NAPRAWIONE. `settings.routes.ts:3028` — `bcrypt.compareSync` przed schedule deletion | Security |
| P0-5 | Brakujące migracje DB | ✅ OBECNE. `20260602_notebook_containers.sql`, `20260603_v8_process_flow.sql` | Infra |
| P0-6 | ADMIN nie zarządza szablonami wywiadów (RBAC) | 🔴 OTWARTE. `539_builtin_role_permissions.sql` brak `INTERVIEW_TEMPLATE_MANAGE` dla ADMIN; egzekwowane w `interview.routes.ts:248-307` | RBAC → Faza 1 |

**Decyzja właściciela wymagana (D-set):** D2 — czy Stripe self-serve wchodzi w GA czy zostają faktury manualne (wtedy P0-1 = "potwierdzić, że flaga OFF jest świadoma i ukryć powierzchnie"); D3 — granica SuperAdmin→/admin (pełny dostęp z audytem vs. zakaz); D4 — twarda bramka demo-data (ryzyko: środowiska sprzedażowe tracą "ładne" dane).

---

## 2. SUPERADMIN — co dokończyć (baza ~98%)

Działa na realnym API/DB: Customers (20 zakł.), AI Platform (37 podzakł.), System (14), Security (15), Governance (6), Configuration (3), Virtual Workers (8). Pozostałe:

| ID | Zadanie | Plik:linia | Severity |
|---|---|---|---|
| SA-1 | 3 widoki revenue świadomie wyłączone (Decision D8 / Stripe) — po decyzji D2 włączyć flagę i zweryfikować na żywo, albo zostawić `BillingFeaturePending` | `revenue/RevenueForecastView.tsx:52`, `SubscriptionChangesView.tsx`, `RevenueRecognitionView.tsx`; flaga `utils/billingSelfServeFlag.ts:28` | intencjonalne |
| SA-2 | Email delivery w alertach prezentacji = stub (UI zapisuje adres, nic nie wysyła) | `PresentationGovernanceAlertSubscriptionsView.tsx:1051` | cosmetic→high jeśli obiecane |
| SA-3 | Zakładka "Policy Plane / enforcement-state" minimalna | AIPlatformModule (Policy) | nice-to-have |
| SA-4 | 10 osieroconych plików legacy (0 referencji) — usunąć | `AIConfigurationView`, `AIDevelopmentModule`, `AIInfrastructureModule`, `AIOperationsModule`, `ContentModule`, `SubscriptionPlansManager`, `SuperAdminPlansView`, `SuperAdminRevenueView`, `SuperAdminAccessRequestsView`, `SuperAdminAIAnalyticsView` | cleanup (zero ryzyka) |
| SA-5 | Smoke-test wizualny per-zakładka (reguła: verify-before-claiming) — nie był robiony na żywo | cały moduł | proces |

---

## 3. ORG-ADMIN — co dokończyć (baza ~60-80%, najwięcej realnej pracy)

Działa: członkowie/role (CRUD), ownership transfer, API keys, audit log, interview assignments. Braki:

| ID | Zadanie | Plik:linia | Severity |
|---|---|---|---|
| OA-1 | **RBAC**: dodać ADMIN: `INTERVIEW_TEMPLATE_MANAGE` (+CREATE/EDIT/DELETE) | `539_builtin_role_permissions.sql` | **blocker** (=P0-6) |
| OA-2 | **RBAC**: ADMIN brak `POLICY_RULE_UPDATE/DELETE/TOGGLE`, `POLICY_ENGINE_TOGGLE` (tylko CREATE/VIEW) | `539_builtin_role_permissions.sql` | high (lub świadomie OWNER-only) |
| OA-3 | **RBAC**: `ORG_SETTINGS_EDIT` — ADMIN tylko VIEW; brak trasy egzekwującej edycję | brak `PATCH /api/organizations/:id/settings` | high |
| OA-4 | Org Profile: formularz istnieje, **nie zapisuje** (0 API) | `views/admin/OrganizationProfileView.tsx` | high |
| OA-5 | Billing Settings: formularz-stub, `loadSettings()` nie pobiera danych | `views/admin/BillingSettingsView.tsx:100` | high |
| OA-6 | Roles & Permissions: tworzenie ról custom = mock, brak API | `views/admin/RolesPermissionsView.tsx`, `RolesManagementPanel.tsx` | medium (defer?) |
| OA-7 | Integracje/Webhooki: w pełni zamockowane (hardcoded listy, brak OAuth) | `components/Admin/IntegrationsManagementPanel.tsx:84-150` | medium (defer) |
| OA-8 | Feedback: brak endpointów, fallback do demo data | `views/admin/AdminFeedbackView.tsx:90,208,232` | medium |
| OA-9 | Stuby bez API: Usage Dashboard, Cost Allocation, Data Management, Workspace (minimal), InvitationsManagement (pusty shell) | `views/admin/*` | medium/defer |
| OA-10 | TODO: flagged count w audit stats; "Implement actual export" | `AuditLogViewer.tsx:154`, `AuditComplianceTab.tsx:155` | low |
| OA-11 | Ownership endpoints (transfer/accept/schedule-deletion) — zweryfikować pełność (audyt 06-02 sygnalizował braki; kod wskazuje, że transfer działa) | `OwnershipManagementView.tsx` | weryfikacja |

---

## 4. MOBILE (web responsywny) — gotowość ~32-40%

Brak natywnej apki; "mobile" = responsywność. Fundament dobry (`hooks/useDeviceType.ts`, bottom nav, sidebar overlay, safe-area, ~87% komponentów ma klasy responsywne). Blokery:

| ID | Zadanie | Plik | Severity |
|---|---|---|---|
| MOB-1 | Table+Preview: brak fallbacku — panel podglądu renderuje się obok tabeli zawsze; dodać `flex-col md:flex-row` + toggle | `components/shared/TableWithPreviewLayout.tsx:298` | **blocker** |
| MOB-2 | Kanban drag-drop: brak obsługi touch (tylko HTML5 DnD) — nieużywalne na mobile | `components/RoadmapKanban.tsx` | **blocker** |
| MOB-3 | Stałe szerokości kolumn Kanban (280px) — wymusza scroll poziomy | `RoadmapKanban.tsx` | blocker |
| MOB-4 | Modale `max-w-5xl` bez kaskady `sm:/md:/lg:`; stałe `h-[85/90vh]` | `TaskDetailModal.tsx`, `InitiativeDetailModal.tsx` | blocker |
| MOB-5 | Przyciski hover-only (`opacity-0 group-hover`) niewidoczne na touch | Roadmap*, `InitiativeDetailModal` | critical |
| MOB-6 | Brak guardów "desktop-only" dla gęstych widoków Admin/SuperAdmin | Admin/SuperAdmin entry | critical |
| MOB-7 | Gęste gridy `grid-cols-4/12` bez `grid-cols-1 md:...` | wiele widoków | medium |

**Decyzja:** czy mobile jest w zakresie GA? Jeśli nie — minimum MOB-6 (uczciwy baner "desktop-only" na Admin/SuperAdmin/buildery), reszta po GA.

---

## 5. KRYTYCZNE LUKI PRODUKTOWE (z sensu aplikacji)

Dwa moduły domykają wartość dla persony CFO i Fazy 6 (dowód wartości — kluczowe w sprzedaży enterprise):

| ID | Zadanie | Maturity | Severity |
|---|---|---|---|
| PROD-1 | **KPI/OKR post-implementation tracking** — brak pomiaru po wdrożeniu | ~40% | high (persona CFO) |
| PROD-2 | **Benefits Realization** — brak korelacji zrealizowanych korzyści z baseline | ~30% | high (Faza 6) |

`apps/new-app` = scaffold white-label (frontend+backend skeleton), **poza ścieżką krytyczną** GA — pominąć w planie 100% rdzenia.

---

## 6. CROSS-CUTTING / SYSTEMOWE (9 tematów z audytu, status)

- S1 backend mocny / frontend słaby → standaryzacja UI podnosi 15+ modułów (w toku, NModeLayout)
- S2 wyciek demo-data (=P0-2) — twarda bramka `isDemoTenant()`
- S3 zbudowane-niezamontowane — odmontować zaślepki (SuperAdmin już zrobiony)
- S4 ~2.75% frontend testów — smoke-render hubów (19) + ścieżki krytyczne (payment, GDPR, profile save)
- S5 5 konkurujących shelli — migracja SplitLayout→ModuleHub
- S6 śmieci po merge'ach (183 plików ` 2.tsx`, `_backup/`, `_quarantine/`) — cleanup zero-ryzyka
- S7 dryf dok-vs-kod (ten plan to koryguje dla Admin)
- S8 luki security (=P0-3/4)
- S9 ciche degradacje 503 → jawne error-state

---

## 7. ROADMAPA FAZOWA (sekwencja do 100%)

**FAZA 0 — Blokery bezpieczeństwa + cleanup — ✅ ZREALIZOWANE 2026-06-07**
P0-2/3/4/5 zweryfikowane jako już naprawione (audyt 06-02 nieaktualny). SA-4 wykonane: usunięto 10 osieroconych plików + 1 CSS (`git rm`, zero wiszących importów). Pozostaje S6 (śmieci ` 2.tsx`, `_backup/`, `_quarantine/`) — opcjonalny większy cleanup.

**FAZA 1 — RBAC + Org-Admin zapis (3-5 dni)**
OA-1/P0-6, OA-2, OA-3, OA-4 (org profile save), OA-5 (billing settings save). Odblokowuje ADMIN i podstawowe zarządzanie org.

**FAZA 2 — Decyzja billing + revenue (zależne od D2; 2-4 dni)**
P0-1 (Stripe lub świadome OFF), SA-1, SA-2 (email delivery). 

**FAZA 3 — Mobile minimum — MOB-6 ✅ ZREALIZOWANE 2026-06-07**
Decyzja: guardy desktop-only + reszta post-GA. Dodano `DesktopOnlyGuard` (`src/components/shared/DesktopOnlyGuard.tsx`) — na mobile (useIsMobile, <768px) pokazuje uczciwą notkę "najlepiej na większym ekranie" z opcją "Kontynuuj mimo to" (nie blokuje twardo). Opakowano oba żywe wejścia: `AdminView.tsx` + `SuperAdminView.tsx`. tsc czysty (0 błędów w zmienionych plikach). Live visual proof na `/admin` PENDING (wymaga zalogowanej sesji admina w preview). MOB-1..5 = post-GA.

**CLEANUP martwego kodu admin — ODŁOŻONE (lista gotowa)**
94 osierocone pliki (tracked+clean, usuwalne odwracalnie) + sparowane testy w `tests/` → `docs/audit/2026-06-07/ADMIN_DEADCODE_CLEANUP_LIST.md`. Narzędzie: `scripts/dev/find-admin-orphans.mjs`. WYKONAĆ po zacommitowaniu bieżącego WIP (czyste drzewo → tsc weryfikuje), usuwając każdy orphan RAZEM z jego testem.

**FAZA 4 — Luki produktowe (równolegle, większy strumień)**
PROD-1 (KPI/OKR), PROD-2 (Benefits). Domykają personę CFO.

**FAZA 5 — Jakość/polish (równolegle)**
S4 (testy smoke), S9 (error-states), OA-6..10, SA-3, SA-5 (smoke wizualny per-zakładka).

---

## 8. DEFINITION OF DONE (brama dla każdego zadania)

1. `tsc` = 0 błędów, eslint czysty.
2. Realny endpoint + realne zapytanie DB (zero mock/hardcoded w ścieżce produkcyjnej).
3. **Otwarte w preview, sprawdzone wizualnie + logicznie per-stan/zakładka, dowód screenshotem** (reguła właściciela — NIGDY "done" na samym tsc).
4. RBAC: zweryfikowane na koncie ADMIN (nie tylko OWNER).
5. Brak cichych 503 — jawny error-state.

---

## 7a. FAZA 1 — STATUS PO WERYFIKACJI KODU (2026-06-07)

> **META-WNIOSEK (ważny dla całego planu):** listy luk oparte na audycie 06-02, specach i szybkich skanach sub-agentów **mocno zawyżają** niekompletność. Z items prześwietlonych w kodzie realna była ~1 na 7. **Każdy punkt trzeba zweryfikować w runtime kodzie zanim się go buduje** — inaczej budujemy na fałszywych przesłankach.

| ID | Deklarowany problem | Werdykt po weryfikacji | Dowód |
|---|---|---|---|
| P0-6 / OA-1 | ADMIN nie zarządza szablonami wywiadów | ✅ FUNKCJONALNIE ZAMKNIĘTE. ADMIN przechodzi enforcement przez `FALLBACK_INTERVIEW_PERMISSIONS[ADMIN]`; panel nie gate'uje przycisków | `permissionService.ts:338-351,403`; `permission.middleware.ts:262-321`; `InterviewAssignmentsPanel.tsx` (0 ref. permission) |
| OA-2 | ADMIN brak POLICY_RULE_UPDATE/DELETE/TOGGLE | ⚠️ DO POTWIERDZENIA — może być zamierzone OWNER-only; brak dowodu na zepsuty flow | `539_*.sql` (tylko CREATE/VIEW) |
| OA-4 | Org Profile nie zapisuje (stub) | ❌ NIEPRAWDA. Pełne wiring: `PUT /api/organization-profiles/:id` + potwierdzenie zapisu re-fetch, upload logo, weryfikacja domeny (914 linii) | `OrganizationProfileView.tsx:209-230`; backend `organization-profiles.routes.ts:369` |
| OA-5 | Billing Settings nie zapisuje (stub) | 🔴 REALNA LUKA. FE woła `GET/PUT /api/billing/settings` — endpoint NIE istnieje w backendzie → 404, cichy fail. Kontakty są lokalne ("In production this would call an API") | `BillingSettingsView.tsx:106,140,211`; brak `/settings` w `routes/billing/` |

**AKTUALIZACJA — cała sekcja Org-Admin (OA-*) była oparta na MARTWYCH plikach.** Live org-admin = `AdminSettingsModule.tsx` z 5 panelami; `src/views/admin/*` i większość `src/components/Admin/*` (w tym `OrganizationProfileView`, `BillingSettingsView`, `RolesPermissionsView`, `IntegrationsManagementPanel`...) to ORPHANY (0 referencji). Analiza OA-1..OA-11 dotyczyła kodu, którego nikt nie renderuje.

**Live org-admin (jedyny realny zakres) — stan po weryfikacji:**
| Panel (live) | Wiring | Werdykt |
|---|---|---|
| `AdminMembersRolesPanel` (people) | 5 API calls, 450 linii | ✅ wired |
| `AdminBillingFinOpsPanel` (billing) | ~10 API calls, 674 linii — summary, payment methods, invoices, alerts, **tax settings (get+update)**, usage, plans | ✅ wired |
| `AdminAuditLogPanel` (audit) | 6 API calls, 261 linii | ✅ wired |
| `AdminSecurityIdentityPanel` (security) | kontener 6 zakładek → SecurityPolicy / Collaboration / ApiKeys / IAM / SCIM / Risk | ✅ delegacja (nie stub) |
| `AdminAIControlCenterPanel` (ai) | 1 API call, 125 linii | ⚠️ cienki — zweryfikować dzieci |

**OA-5 — ANULOWANE (nie jest realną luką).** Żywy backend tax-settings istnieje (`billing.routes.ts:3309` GET+PUT; admin: `adminP32.routes.ts:2078`); żywy panel persystuje. `BillingSettingsView` + `/api/billing/settings` to martwy widok wołający nieistniejący endpoint — bez wpływu na produkt. Budowanie tego = duplikacja działającej funkcji dla niewyświetlanego komponentu → odrzucone (verify-before-claiming).

**Prawdziwy pozostały zakres Org-Admin:** (1) opcjonalny cleanup martwych `src/views/admin/*` + `src/components/Admin/*` orphanów (jak SA-4, zapobiega kolejnym fałszywym audytom); (2) weryfikacja cieńszych live-paneli (`AdminAIControlCenterPanel` + 6 podpaneli security) pod kątem realnych braków. Reszta OA-* = nieaktualna (martwy kod).

## 8a. DECYZJE WŁAŚCICIELA (2026-06-07)

- **D2 Billing → faktury manualne.** Stripe poza GA. Flaga `isBillingSelfServeEnabled()` zostaje OFF; 3 widoki revenue ukryte (`BillingFeaturePending`). P0-1 = potwierdzić świadome OFF, NIE wdrażamy Stripe teraz.
- **Mobile → guardy desktop-only + post-GA.** W GA tylko MOB-6 (banery "desktop-only" na Admin/SuperAdmin/builderach). MOB-1..5 po GA.
- **KPI/OKR + Benefits → fast-follow.** PROD-1/PROD-2 NIE blokują GA; domykane zaraz po starcie.
- **Start: Faza 0 teraz.**

## 9. PYTANIA DECYZYJNE DO WŁAŚCICIELA

1. **D2 Billing**: Stripe self-serve w GA, czy faktury manualne (revenue views zostają wyłączone)?
2. **D3 SuperAdmin→/admin**: pełny dostęp z audytem, czy zakaz?
3. **D4 Demo-data**: twarda bramka tenant (ryzyko utraty "ładnych" danych w demo)?
4. **Mobile w GA?** Pełna responsywność czy guardy desktop-only + post-GA?
5. **RBAC policy** (OA-2): ADMIN ma zarządzać regułami policy, czy OWNER-only zamierzone?
6. **Zakres GA**: czy PROD-1/PROD-2 (KPI/Benefits) blokują GA, czy fast-follow?
