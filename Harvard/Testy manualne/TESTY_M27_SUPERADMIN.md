# TESTY — M27 SuperAdmin (control plane)

> **Moduł:** M27 SuperAdmin (`/superadmin/*`) — wg `Harvard/podzial/_MODULE_MAP_V2.md`, inwentarz `Harvard/podzial/inventory/INV_G_admin_ustawienia_partner_superadmin.md` (sekcja SUPERADMIN)
> **Zakres tej paczki:** pełny control plane — gating roli SUPERADMIN, 5 sekcji (Tenant & User Ops 20 zakł., AI Operations 7×N, Connector Ops/System, Governance & Compliance, Platform Security 15 zakł.), Virtual Workers (URL-only), znany 500 feedback pulse/feature, ścieżki cross-module.
> **Cel:** agent testujący wykonuje każdy krok z dowodem E2E (UI + Network + DB/store). Samo „zakładka się otworzyła" to NIE DOWÓD — każda mutacja musi pojawić się w Network i przetrwać refresh.
> **Data:** 2026-06-16
> **Legenda:** `[MANUAL]` = weryfikacja ręczna (curl / incognito / inny browser); `[FLAG]` = zależne od flagi/capability/roli; `[DB]` = dowód = wiersz w bazie; `[KNOWN_BUG]` = znany błąd, dokumentuj jako expected-fail.
> **Karta audytu:** `Harvard/modules/M27-superadmin/KARTA_AUDYTU.md` · Teczka: `Harvard/wdrozenie-100/M27-superadmin.md`

---

## §0 Kontekst architektoniczny

### Mapa komponentów

| Sekcja (sidebar) | Moduł FE | Plik | Tabela DB (główna) |
|---|---|---|---|
| Tenant & User Ops | `CustomersModule` | `src/views/superadmin/CustomersModule.tsx` | `organizations`, `users` |
| AI Operations | `AIPlatformModule` (folder) | `src/views/superadmin/AIPlatformModule/AIPlatformModule.tsx` | `llm_providers`, `llm_tier_assignments` |
| Connector Ops (System) | `SystemModule` | `src/views/superadmin/SystemModule.tsx` | `feature_flags`, `feature_flag_history` |
| Governance & Compliance | `GovernanceModule` | `src/views/superadmin/GovernanceModule.tsx` | audit tables |
| Platform Security | `SecurityModule` | `src/views/superadmin/SecurityModule.tsx` | roles, SSO, SCIM |
| Virtual Workers [URL-only] | `VirtualWorkersModule` | `src/views/superadmin/VirtualWorkersModule/index.tsx` | `virtual_workers` |

**Shell:** `SuperAdminView` (`src/views/superadmin/SuperAdminView.tsx`) — **dedykowany layout** (bez MainLayout), własny header, `SuperAdminSidebar`, `SuperAdminSignalCenter`, `SuperAdminStatusIndicators`. `DesktopOnlyGuard` blokuje dostęp na mobile.

**Sidebar sekcje** (`src/components/layout/SuperAdminSidebar.tsx`):
```
'customers'   → Tenant & User Ops     (/superadmin/customers/*)
'ai-platform' → AI Operations         (/superadmin/ai-platform/*)
'system'      → Connector Ops         (/superadmin/system/*)
'content'     → Governance & Compl.   (/superadmin/content/*)
'security'    → Platform Security     (/superadmin/security/*)
```

Virtual Workers mapuje do `'ai-platform'` w `appViewToSection`, ale **nie ma wpisu w sidebarze** → dostępny wyłącznie przez URL: `/superadmin/virtual-workers`.

### SUPERADMIN role-guard — jak egzekwowany

**Warstwa FE (route-level):**
- `src/routes/AppRoutes.tsx` linia ~2252: `<ProtectedRoute requiredRole="SUPERADMIN">` opakowuje cały subtree `/superadmin/*`.
- `src/components/auth/ProtectedRoute.tsx`: hierarchia `USER(1) < ADMIN=OWNER(2) < SUPERADMIN(3)`. Kluczowe: linia ~77 — jeśli `requiredRole="ADMIN"` a user ma rolę `SUPERADMIN`, przekierowuje do `/superadmin` (P0 superadmin≥admin zamknięty **dwukierunkowo**).
- Auto-redirect: po loginie SUPERADMIN ląduje zawsze na `/superadmin` (AppRoutes.tsx linia ~629).

**Warstwa BE (middleware):**
- `server/src/routes/superadmin.routes.ts` linie 345–356: `router.use(verifyToken → requireSuperAdmin → requireAudit → superadminAuditMonitor)` — każde żądanie przez ten router przechodzi cały stos.
- `server/src/middleware/superAdmin.middleware.ts` linie 403–426: rola pobierana **zawsze z DB** (nie z tokenu) — `SELECT role FROM users WHERE id=?`. Fail-closed: błąd DB → 403. Normalizacja aliasów (`SUPERADMIN/SUPER_ADMIN/super_admin` → `superadmin`).
- Capability sub-gates: `/security`, `/virtual-workers`, `/ai` wymagają dodatkowej capability (`security_ops`, `ai_ops`).

**Boczne routery (poza superadmin.routes.ts):**
- `virtual-workers.routes.ts` linia 22: `router.use(requireRole('super_admin'))` — chroniony prawidłowo po naprawie `91c8245559`.
- `llm.routes.ts` tiers/assign+priority: `verifySuperAdmin` — naprawione `91c8245559`.
- `llm.routes.ts` `/purposes/:purpose/assignments` (POST), `/org/:id/policy` (PUT), `/market/openrouter/sync` (POST), `/market/inbox/:id` (PUT): **`verifyAdmin`** — **P1 SEC-03/04 otwarte**, zwykły org-admin może pisać globalne dane.

### Znany 500 — feedback pulse/feature

- Tabele `feedback_pulse` i `feature_requests` mogły nie istnieć na prod/staging (brak migracji).
- `feedback.routes.ts` linia ~158/177: `CREATE TABLE IF NOT EXISTS` — fix `36ceb52c60` wdrożony w kodzie, live-verify deploy **pending**.
- `is_active` na userach: linia ~466 `CAST(is_active AS TEXT) NOT IN ('0','false','f')` — naprawione.
- Status: **KNOWN_BUG** — testuj jako expected 500, dokumentuj czy fix już wdrożony.

### Zasada E2E

Każda mutacja (create/update/delete) wymaga:
1. Potwierdzenia w **Network** (żądanie do API, status 2xx lub oczekiwany błąd).
2. Odświeżenia strony i weryfikacji, że stan **przetrwał** (persystencja).
3. Dla kluczowych przypadków — potwierdzenia `[DB]` (bezpośrednie zapytanie lub DevTools response body z id/dane).

---

## §setup Środowisko testowe

### Wymagane konta

| Konto | Rola | Cel |
|---|---|---|
| `superadmin@` | `SUPERADMIN` (DB) | konto główne — **wszystkie testy w §1–§8** |
| `admin@` | `ADMIN` / `OWNER` | weryfikacja blokady w §1 |
| `user@` | `USER` | weryfikacja blokady w §1 |

> **KRYTYCZNE:** Testy WYŁĄCZNIE na **stagingu** (caboose). Nigdy na prod (centerbeam). Verify DB URL przed testem: `echo $DATABASE_URL` — musi wskazywać na staging, NIE na `.env.local` (który nadpisuje na prod centerbeam). Patrz: `[[finding_railway_db_topology]]`.

### Setup krok po kroku

1. Uruchom dev server frontendowy (`npm run dev` lub `vite`) → port 5173 lub 3000.
2. Uruchom backend na staging DB (`DATABASE_URL=<staging>` — caboose, NIE .env.local).
3. Zaloguj się kontem SUPERADMIN.
4. Otwórz DevTools → zakładka **Network** (filtr: `/api/`), zakładka **Console** (wymagane: zero błędów JS poza sekcją §7).
5. Przygotuj drugą kartę przeglądarki w trybie incognito z kontem ADMIN (`admin@`).
6. Trzecia karta incognito z kontem USER (`user@`) lub wylogowanym.
7. Miej pod ręką narzędzie do curl (lub REST Client) do testów bypass w §1.5.

---

## §1 Gating roli SUPERADMIN (KRYTYCZNY — control plane)

> Priorytet P0. Każda luka tu = potencjalny hijack całej platformy.

### 1.1 Niewidoczność w sidebarze dla non-SUPERADMIN

**Konto:** `user@` (rola USER).

- Kroki:
  1. Zaloguj się jako `user@`.
  2. Sprawdź lewy sidebar główny (`src/components/layout/Sidebar.tsx`).
- **Asercja:** brak pozycji „SuperAdmin" / linku `/superadmin` w sidebarze dla roli USER.
- **Asercja:** brak pozycji „SuperAdmin" dla roli ADMIN/OWNER (sprawdź też konto `admin@`).
- **Asercja:** `isSuperAdminRole(currentUser?.role)` → false dla USER/ADMIN; sidebar nie renderuje sekcji SuperAdmin.

### 1.2 Direct URL /superadmin/* dla zalogowanego ADMIN — redirect/blokada

**Konto:** `admin@` (rola ADMIN).

- Kroki:
  1. Zaloguj się jako `admin@`.
  2. Wpisz ręcznie w pasek URL: `http://localhost:5173/superadmin`.
  3. Wpisz: `http://localhost:5173/superadmin/customers`.
  4. Wpisz: `http://localhost:5173/superadmin/security`.
- **Asercja FE:** `ProtectedRoute` z `requiredRole="SUPERADMIN"` — user ADMIN ma poziom 2, SUPERADMIN wymaga 3 → `hasRequiredRole` zwraca false → redirect do `/chat` (lub strona dostępu odmówionego).
- **Asercja:** URL zmienia się na `/chat` lub pojawia się access-denied screen. **Nie** pojawia się żaden panel SuperAdmina.
- **Asercja:** brak błędów JS w konsoli.
- Dowód: screenshot redirectu.

### 1.3 Direct URL dla niezalogowanego

**Konto:** brak (wylogowany).

- Kroki:
  1. Wyloguj się (lub otwórz incognito bez logowania).
  2. Wpisz: `http://localhost:5173/superadmin/customers`.
  3. Wpisz: `http://localhost:5173/superadmin/security/sso`.
- **Asercja:** redirect do strony logowania (`/login` lub `/`). Brak flashu panelu SuperAdmina przed redirectem.
- Dowód: screenshot strony logowania + URL.

### 1.4 Pełny dostęp dla konta SUPERADMIN

**Konto:** `superadmin@`.

- Kroki:
  1. Zaloguj się jako `superadmin@`.
  2. Sprawdź, że URL po zalogowaniu = `/superadmin` (auto-redirect z AppRoutes.tsx linia ~629).
  3. Sprawdź obecność wszystkich 5 sekcji w `SuperAdminSidebar`.
  4. Przejdź do każdej sekcji klikając w sidebar — sprawdź że panel się ładuje (bez 403).
- **Asercja:** wszystkie 5 sekcji dostępne: Tenant & User Ops, AI Operations, Connector Ops, Governance & Compliance, Platform Security.
- **Asercja:** header zawiera `SuperAdminSignalCenter` i `SuperAdminStatusIndicators`.
- **Asercja:** `DesktopOnlyGuard` — przetestuj na mobile viewport (DevTools device simulation, np. iPhone 375px) → powinien zablokować z komunikatem „desktop only".

### 1.5 Próba bypass nagłówka HTTP [MANUAL]

> Weryfikacja, że serwer NIE ufa token-role dla elewacji.

- Kroki:
  1. Zaloguj się jako `admin@`, pobierz JWT token (DevTools → Application → localStorage lub cookie `token`).
  2. Zdekoduj JWT (base64 środkowa część) — sprawdź pole `role` w payloadzie.
  3. **Scenariusz A — modyfikacja tokenu (symulacja stale token):**
     Użyj curl z oryginalnym tokenem admina:
     ```
     curl -X GET http://localhost:3001/api/superadmin/organizations \
       -H "Authorization: Bearer <admin_token>"
     ```
  4. **Scenariusz B — próba z tokenem bez roli:**
     ```
     curl -X GET http://localhost:3001/api/superadmin/dashboard \
       -H "Authorization: Bearer <dowolny_ważny_token_non-superadmin>"
     ```
- **Asercja Scenariusz A:** odpowiedź `403 Forbidden`, body zawiera `error` z komunikatem o braku roli superadmin. **Nie** 401.
- **Asercja Scenariusz B:** `403 Forbidden`.
- **Zasada (z middleware):** `superAdmin.middleware.ts` linia ~403 zawsze trafia do DB — nawet jeśli JWT twierdzi że jest superadminem, sprawdzane jest `SELECT role FROM users WHERE id=?`. Odpowiedź 403 = fail-closed.
- **Weryfikacja komunikatu:** odpowiedź NIE powinna zawierać ścieżek systemowych, SQLSTATE, ani `/var/app/secrets` (fix `69ffc1fd86`).

### 1.6 Weryfikacja DB — rola jako source of truth [DB]

- Kroki:
  1. W trakcie sesji SUPERADMIN, przez DevTools/curl wywołaj endpoint: `GET /api/superadmin/organizations` — sprawdź 200.
  2. Zmień rolę konta SUPERADMIN w bazie **staging** na `ADMIN` (bezpośrednio SQL, tylko na stagingu!): `UPDATE users SET role='ADMIN' WHERE email='superadmin@...'`.
  3. Odśwież stronę — stary JWT jeszcze ważny.
  4. Spróbuj wywołać: `GET /api/superadmin/organizations` (z tym samym tokenem).
- **Asercja:** natychmiastowy 403 — mimo że JWT się nie zmienił (middleware odpytuje DB przy każdym żądaniu).
- **Przywróć:** `UPDATE users SET role='SUPERADMIN' WHERE email='superadmin@...'`.
- Dowód: Network response 403 ze starym tokenem po zmianie DB.

---

## §2 Tenant & User Ops (CustomersModule — 20 zakładek)

> Endpoint bazowy: `GET/POST/PUT/DELETE /api/superadmin/*`. Router: `superadmin.routes.ts` linie 345–356.

**20 zakładek CustomersModule:**
`command-center`, `organizations`, `users`, `lifecycle`, `playbooks`, `contracts`, `commercial`, `limits`, `security`, `support`, `feedback`, `feedback-backlog`, `feedback-analytics`, `analytics`, `compliance`, `automation`, `communication`, `bulk-ops`, `waitlist`, `module-access`

### 2.1 Command Center

- Wejdź na `/superadmin/customers` (domyślna zakładka `command-center`).
- **Asercja:** `TenantCommandCenterView` renderuje — widoczne panele KPI (liczba organizacji, użytkowników, aktywnych sesji lub podobne).
- **Asercja:** dane z API (NetworkŻądanie do `GET /api/superadmin/dashboard` lub podobnego endpointu) — status 200, nie mock.
- **Asercja:** brak błędów JS w konsoli.

### 2.2 Organizations — lista i szczegół

- Przejdź do zakładki `organizations`.
- **Asercja:** `OrganizationsView` renderuje — tabela organizacji z kolumnami (nazwa, plan, status, data).
- **Asercja:** Network: `GET /api/superadmin/organizations` → 200, body zawiera listę.
- Klik w wiersz organizacji → otwiera `SuperAdminOrgDetailsModal` lub widok szczegółu.
- **Asercja:** dane org widoczne (ID, nazwa, billing, liczba userów).
- **Asercja po odświeżeniu:** lista nadal widoczna (nie znika przy reload).

### 2.3 Tworzenie organizacji [DB]

- W Organizations — szukaj przycisku „Create" / „New Organization" / „Add".
- Wypełnij formularz: nazwa, plan, limit użytkowników.
- Wyślij.
- **Asercja:** Network: `POST /api/superadmin/organizations` lub `/api/superadmin/tenants` → 201.
- **Asercja [DB]:** nowy wiersz w tabeli `organizations` na staging DB.
- Odśwież listę — nowa org pojawia się.

### 2.4 Edycja i suspend/reactivate organizacji [DB]

- Wybierz testową organizację.
- Edytuj nazwę / plan.
- **Asercja:** `PUT /api/superadmin/organizations/:id` lub `/api/superadmin/tenants/:id` → 200.
- Suspend: szukaj akcji „Suspend" / „Deactivate".
- **Asercja:** Network: odpowiedni endpoint PUT/POST ze statusem `suspended`.
- Reactivate: akcja „Activate" / „Reactivate".
- **Asercja [DB]:** kolumna `status` lub `is_active` zmieniona.

### 2.5 Users — zarządzanie użytkownikami cross-tenant

- Przejdź do zakładki `users`.
- **Asercja:** `SuperAdminUserManagement` renderuje — tabela użytkowników ze wszystkich tenantów.
- **Asercja:** Network: `GET /api/superadmin/users` → 200.
- Filtrowanie po organizacji: wybierz organizację z dropdowna `selectedOrganizationId` → tabela filtruje.
- **Asercja:** Network: `GET /api/superadmin/users?organizationId=<id>` lub parametr w body → 200.
- Edycja usera: klik na usera → `PUT /api/superadmin/users/:id` → 200.
- Tworzenie usera: `POST /api/superadmin/users` → 201.
- Usunięcie usera: `DELETE /api/superadmin/users/:id` → 200/204. **UWAGA:** to usuwa usera z całej platformy — testuj tylko na koncie testowym.

### 2.6 Lifecycle, Playbooks, Contracts

- Przejdź kolejno do zakładek `lifecycle`, `playbooks`, `contracts`.
- **Asercja każda:** zakładka renderuje widok bez crash (odpowiedni komponent z `customers/` podfolderu).
- **Asercja:** widoczne dane z API (Network: odpowiedni endpoint `GET /api/superadmin/*`).
- **Asercja Playbooks:** lista playbooków + możliwość edycji (`PlaybookEditorView`).

### 2.7 Commercial (RevenueModule) — billing/invoices/usage

- Przejdź do zakładki `commercial`.
- **Asercja:** `RevenueModule` renderuje z pod-zakładkami (billing, invoices, usage).
- Sprawdź pod-zakładkę `invoices`: `InvoiceCenterView` — lista faktur cross-tenant.
- **Asercja:** Network: `GET /api/superadmin/billing` lub `GET /api/superadmin/invoices` → 200.
- **Asercja [DB]:** dane faktur odpowiadają tabelom `billing`/`invoices`.

### 2.8 Limits & Budgets [DB]

- Przejdź do zakładki `limits`.
- **Asercja:** `OrganizationResourceManager` renderuje.
- Zmień limit dla testowej organizacji (np. max users).
- **Asercja:** Network: `PUT /api/superadmin/organizations/:id/limits` lub podobny → 200.
- **Asercja [DB]:** wiersz w tabeli organizacji zaktualizowany.

### 2.9 Feedback — zakładka [KNOWN_BUG — patrz §7]

- Przejdź do zakładki `feedback`.
- **Asercja:** `SuperAdminFeedbackView` renderuje (lista feedbacku).
- Network: `GET /api/feedback` → sprawdź status. Powinno być 200 (podstawowy feedback — tabela `feedback_items` istnieje).
- **Asercja:** brak crash (secret-leak P0 naprawiony w `69ffc1fd86`).
- **Asercja:** brak w response `SQLSTATE`, `/var/app/secrets`, ścieżek systemowych.

### 2.10 Feedback Backlog

- Przejdź do zakładki `feedback-backlog`.
- **Asercja:** `SuperAdminFeedbackBacklogView` renderuje BEZ crasha.
- **Asercja kluczowa (security):** odpowiedź API NIE zawiera żadnego z: `SQLSTATE`, `/var/app/`, `/secrets`, `internal path` — fix `69ffc1fd86`.
- **Asercja:** brak JS crash w konsoli.

### 2.11 Feedback Analytics

- Przejdź do zakładki `feedback-analytics`.
- **Asercja:** `SuperAdminFeedbackAnalyticsView` renderuje.
- Network: `GET /api/feedback/stats/summary` lub `/feedback/pulse-summary` → sprawdź status 200.

### 2.12 Analytics, Compliance, Automation, Communication

- Przejdź kolejno do zakładek `analytics`, `compliance`, `automation`, `communication`.
- **Asercja każda:** zakładka renderuje właściwy komponent bez crash.
- **Asercja:** widoczne dane (nie puste placeholdery — jeśli puste to uczciwy empty-state, nie placeholder „Coming soon" bez danych).

### 2.13 Bulk Ops [MANUAL]

- Przejdź do zakładki `bulk-ops`.
- **Asercja:** `BulkOperationsView` lub podobny renderuje.
- Sprawdź dostępne operacje (np. bulk status update, bulk export).
- **NIE wykonuj** bulk delete ani bulk suspend na staging — tylko podgląd i weryfikacja UI.

### 2.14 Module Waitlist i Module Access [DB]

- Przejdź do zakładki `waitlist`.
- **Asercja:** lista requestów dostępu do modułów.
- Network: odpowiedni GET endpoint → 200.

- Przejdź do zakładki `module-access`.
- **Asercja:** `ModuleAccessControlView` renderuje — lista grantów beta dostępu.
- Sprawdź grant dla DBR77 (bootstrap) — powinien być widoczny.
- **Asercja:** Network: `GET /api/superadmin/module-access` lub podobny → 200.
- Dodaj grant dla testowej organizacji → `POST /api/superadmin/module-access` → 201.
- **Asercja [DB]:** nowy wiersz w tabeli grantów.

### 2.15 Badge na ikonach (pending access requests)

- **Asercja:** jeśli są pending access requests, zakładka `module-access` (lub sekcja Customers w sidebarze) pokazuje czerwony badge z liczbą.
- Rozwiąż request (approve/deny) → badge znika lub zmniejsza licznik.

---

## §3 AI Operations (AIPlatformModule — 7 grup × N zakładek)

> Pliki: `src/views/superadmin/AIPlatformModule/` (folder). Endpoint bazowy: `/api/llm/*`, `/api/superadmin/ai/*`. Capability gate: `ai_ops` na `/superadmin/ai/*`.

**Grupy i zakładki:**
- **Configuration:** llm-providers, model-tiers, routing-rules, purposes-assignments, org-ai-policy, ai-governance, global-settings
- **Development:** prompts-library, prompt-builder, experiments, model-registry
- **Operations:** mission-control, health-monitoring, performance-dashboard, sla-management, ai-core-runtime, prompt-os-runtime, market-inbox
- **Analytics:** llm-observatory, usage-analytics, cost-analytics, pricing-registry, performance-metrics, custom-reports
- **Policy Plane:** enforcement-state
- **Security:** api-keys, access-control, audit-logs, compliance
- **Knowledge:** knowledge-base, documents-rag, strategic-directions

### 3.1 Nawigacja do AI Operations

- Klik „AI Operations" w sidebarze → `/superadmin/ai-platform`.
- **Asercja:** `AIPlatformModule` renderuje z 7 głównymi zakładkami.
- **Asercja:** każda z 7 grup dostępna w interfejsie.

### 3.2 Configuration — LLM Providers [DB]

- Przejdź do zakładki Configuration → LLM Providers.
- **Asercja:** lista providerów AI (OpenAI, Anthropic, Ollama, OpenRouter, etc.).
- **Asercja:** Network: `GET /api/llm/providers` → 200. Response zawiera `has_api_key: true/false` — **nie ma pola `api_key`** (klucze są strippowane na serwerze, `LLMController.ts:110/193`).
- Dodaj nowego providera: klik „Add Provider" / „New Provider".
  - Wypełnij: nazwa, typ, API key (testowy).
  - **Asercja:** Network: `POST /api/llm/providers` z gateem `verifySuperAdmin` → 201.
  - **Asercja [DB]:** nowy wiersz w `llm_providers`. Pole `api_key` widoczne w DB (staging), ale NIE w response API.
- Edycja providera: `PUT /api/llm/providers/:id` z `verifySuperAdmin` → 200.
- Usunięcie providera: `DELETE /api/llm/providers/:id` z `verifySuperAdmin` → 200/204.
- **Asercja bezpieczeństwa:** sprawdź w Network response `GET /api/llm/providers` — pole `api_key` MUSI być nieobecne (zwracane jest tylko `has_api_key: bool`).

### 3.3 Configuration — Model Tiers i Routing [DB]

- Przejdź do zakładki Model Tiers.
- **Asercja:** lista tierów (free, pro, enterprise lub podobne).
- Network: `GET /api/llm/tiers/assignments` z `verifyToken` → 200.
- Przypisanie providera do tieru (assign):
  - Akcja assign provider do tier.
  - **Asercja:** `POST /api/llm/tiers/assign` z `verifySuperAdmin` → 200/201. (Fix `91c8245559` — było tylko `verifyToken`.)
  - **Asercja [DB]:** nowy wiersz w `llm_tier_assignments`.
- Zmiana priorytetu:
  - **Asercja:** `PUT /api/llm/tiers/priority` z `verifySuperAdmin` → 200. (Fix `91c8245559`.)
- **KRYTYCZNA weryfikacja bezpieczeństwa SEC-01 (P0 naprawiony) [MANUAL]:**
  ```
  curl -X POST http://localhost:3001/api/llm/tiers/assign \
    -H "Authorization: Bearer <admin_token>" \
    -H "Content-Type: application/json" \
    -d '{"providerId":"test","tier":"free"}'
  ```
  **Asercja:** `403 Forbidden` (nie 200). Confirm fix `91c8245559`.

### 3.4 Configuration — Purposes & Assignments [FLAG — SEC-03 P1 otwarte]

- Przejdź do zakładki Purposes & Assignments.
- **Asercja UI:** lista AI purposes z `GET /api/llm/purposes` (ten endpoint: `verifyToken` — tylko odczyt).
- Utwórz nowy purpose:
  - **Asercja:** `POST /api/llm/purposes` z `verifySuperAdmin` → 201. (Endpoint poprawnie chroniony po naprawie.)
- Przypisanie providera do purpose:
  - **Asercja:** `POST /api/llm/purposes/:purpose/assignments` — sprawdź aktualny gate.
  - **[FLAG SEC-03 P1 otwarte]:** Endpoint używa `verifyAdmin` (nie `verifySuperAdmin`). Dokumentuj jako znany P1.
  - **Test bypass [MANUAL]:**
    ```
    curl -X POST http://localhost:3001/api/llm/purposes/chat/assignments \
      -H "Authorization: Bearer <admin_token>" \
      -H "Content-Type: application/json" \
      -d '{"providerId":"test"}'
    ```
    **Asercja oczekiwana (P1 otwarte):** aktualnie przepuszcza org-admina (zwraca 200/201 zamiast 403). Dokumentuj status: **P1 SEC-03 otwarte — wymaga naprawy**.

### 3.5 Operations — Mission Control i Health Monitoring

- Przejdź do zakładki Operations → Mission Control.
- **Asercja:** dashboard z metrykami live (latencja, uptime providerów, status).
- Network: `GET /api/llm/health/status` lub `GET /api/llm/health` → 200.
- Przejdź do Health Monitoring.
- **Asercja:** `GET /api/llm/health/detailed` → 200.

### 3.6 Operations — Market Inbox [FLAG — SEC-04 P1 otwarte]

- Przejdź do zakładki Operations → Market Inbox.
- **Asercja:** lista modeli z OpenRouter (inbox diffs).
- Network: `GET /api/llm/market/inbox` → 200.
- Sync OpenRouter:
  - Akcja „Sync" / „Refresh from OpenRouter".
  - **Asercja:** `POST /api/llm/market/openrouter/sync` — sprawdź aktualny gate.
  - **[FLAG SEC-04 P1 otwarte]:** Endpoint używa `verifyAdmin`. Dokumentuj jako znany P1.
  - **Test bypass [MANUAL]:**
    ```
    curl -X POST http://localhost:3001/api/llm/market/openrouter/sync \
      -H "Authorization: Bearer <admin_token>"
    ```
    **Asercja oczekiwana (P1 otwarte):** przepuszcza org-admina. Status: **P1 SEC-04 otwarte**.
- Aktualizacja statusu inbox item:
  - **Asercja:** `PUT /api/llm/market/inbox/:id` z `verifyAdmin` — **P1 otwarte**.

### 3.7 Analytics — Observatory i Usage

- Przejdź do Analytics → LLM Observatory.
- **Asercja:** `AIObservabilityDashboard` lub komponent analityczny renderuje.
- Network: `GET /api/llm/analytics` lub `GET /api/llm/logs` → 200.
- Przejdź do Usage Analytics, Cost Analytics.
- **Asercja:** dane kosztowe widoczne (mogą być puste dla staging, ale nie crash).

### 3.8 Security — API Keys, Audit Logs

- Przejdź do Security → API Keys.
- **Asercja:** lista API keys dla platformy. Network: odpowiedni GET endpoint → 200.
- Przejdź do Security → Audit Logs.
- **Asercja:** logi zdarzeń AI — Network: odpowiedni endpoint → 200.

---

## §4 Connector Ops / System (SystemModule — 14 zakładek)

> Plik: `src/views/superadmin/SystemModule.tsx`. Zakładki: health, audit-log, feature-flags, integrations, security, configuration, analytics, backup, api-keys + 5 presentation-governance.

### 4.1 Health Monitor

- Przejdź do `/superadmin/system` (domyślna zakładka `health`).
- **Asercja:** `EnterpriseHealthMonitor` renderuje — metryki systemu (CPU, memory, latencja DB, status kolejek lub podobne).
- **Asercja:** dane live (nie statyczne) — Network: odpowiedni endpoint health → 200.
- **Asercja:** brak błędów JS.

### 4.2 Audit Log (systemowy)

- Przejdź do zakładki `audit-log`.
- **Asercja:** `EnterpriseAuditLog` renderuje — tabela zdarzeń systemowych.
- **Asercja:** Network: `GET /api/superadmin/audit` lub `/api/superadmin/activities` → 200.
- Filtrowanie: po typie zdarzenia, po dacie, po userze.
- **Asercja:** filtry działają — Network wysyła zmienione parametry query.
- Export CSV: szukaj przycisku „Export".
- **Asercja:** pobiera plik CSV z danymi audytu.

### 4.3 Feature Flags [DB] — KRYTYCZNE

> Feature flags zarządzają całą platformą — błąd tu = globalne zepsucie funkcji.

- Przejdź do zakładki `feature-flags`.
- **Asercja:** `EnterpriseFeatureFlags` renderuje — lista flag z wartościami true/false.
- **Asercja:** Network: `GET /api/superadmin/feature-flags` → 200. Dane z tabeli `feature_flags`.
- Toggle flagi na staging (wybierz niegroźną flagę testową):
  - Zmień wartość true→false lub false→true.
  - **Asercja:** Network: `PUT /api/superadmin/feature-flags/:id` lub `POST` z gate `requireSuperAdmin` → 200.
  - **Asercja [DB]:** wiersz w `feature_flags` zaktualizowany + nowy wpis w `feature_flag_history` (wersjonowanie).
  - Odśwież stronę → flaga nadal ma nową wartość (persystencja).
- Sprawdź historię flagi:
  - **Asercja:** widoczne poprzednie wartości z datami i autorem.
- **WAŻNE:** po teście przywróć flagę do pierwotnej wartości.

### 4.4 Integrations Hub

- Przejdź do zakładki `integrations`.
- **Asercja:** `EnterpriseIntegrationsHub` renderuje — lista integracji (Slack, Webhooks, etc.).
- **Asercja:** Network: odpowiedni GET endpoint → 200.
- Sprawdź status każdej integracji (connected/not connected).

### 4.5 Configuration

- Przejdź do zakładki `configuration`.
- **Asercja:** `EnterpriseConfigurationPanel` renderuje.
- Sprawdź ustawienia platformy (timeouty, limity globalne, etc.).

### 4.6 Backup & Disaster Recovery

- Przejdź do zakładki `backup`.
- **Asercja:** `EnterpriseBackupPanel` renderuje.
- **NIE uruchamiaj backup na staging** bez zgody Piotra — tylko podgląd UI.

### 4.7 API Keys Management

- Przejdź do zakładki `api-keys`.
- **Asercja:** `APIManagementView` renderuje — lista platformowych API keys.
- **Asercja:** Network: `GET /api/superadmin/api-keys` lub podobny → 200.
- Weryfikacja że klucze są maskowane w UI (np. `sk-...***...1234`).

### 4.8 Presentation Governance (5 zakładek)

> Zakładki: `presentation-watchlist`, `presentation-operations-health`, `presentation-benchmark-trend`, `presentation-alert-subscriptions`, `presentation-template-governance`.

- Przejdź do każdej z 5 zakładek.
- **Asercja każda:** komponent renderuje bez crash.
  - `PresentationGovernanceWatchlistView`
  - `PresentationOperationsHealthView`
  - `PresentationBenchmarkTrendView`
  - `PresentationGovernanceAlertSubscriptionsView`
  - `PresentationTemplateGovernanceView`
- **Asercja:** Network: odpowiedni GET endpoint → 200 dla każdej.
- **Asercja:** brak błędów JS.

### 4.9 Analytics

- Przejdź do zakładki `analytics`.
- **Asercja:** `EnterpriseAnalyticsPanel` renderuje.
- **Asercja:** Network: `GET /api/superadmin/activities/stats` lub `/analytics` → 200.

---

## §5 Governance & Compliance (GovernanceModule — 6 zakładek)

> Plik: `src/views/superadmin/GovernanceModule.tsx`. Zakładki: overview, audit, approvals, compliance, exports, legal.

### 5.1 Overview

- Przejdź do `/superadmin/content`.
- **Asercja:** GovernanceModule renderuje z zakładką `overview`.
- **Asercja:** widoczne KPI compliance (procent spełnienia, otwarte incydenty, etc.).
- Network: odpowiedni GET → 200.

### 5.2 Audit Timeline (system-wide)

- Przejdź do zakładki `audit`.
- **Asercja:** `ComplianceCenterView` (~2057 l.) lub inny komponent renderuje timeline zdarzeń audytowych.
- **Asercja:** Network: `GET /api/superadmin/audit` lub `activities` → 200. Dane system-wide (nie per-org).
- Filtrowanie: sprawdź filtrowanie po zakresie dat, typie zdarzenia.

### 5.3 Approvals

- Przejdź do zakładki `approvals`.
- **Asercja:** lista oczekujących zatwierdzeń.
- Zatwierdź/odrzuć element testowy (jeśli istnieje).
- **Asercja:** Network: odpowiedni POST/PUT → 200.

### 5.4 Compliance

- Przejdź do zakładki `compliance`.
- **Asercja:** dashboard compliance — GDPR, SOC2, lub podobne frameworki.
- **Asercja:** Network: `GET /api/superadmin/compliance` → 200.

### 5.5 Exports & Retention

- Przejdź do zakładki `exports`.
- **Asercja:** opcje eksportu (CSV, JSON) i ustawienia retencji.
- Eksportuj testowy raport audytowy (mały zakres).
- **Asercja:** Network: POST do endpoint eksportu → 200, pobiera plik.

### 5.6 Legal & Policies

- Przejdź do zakładki `legal`.
- **Asercja:** `SuperAdminLegalView` lub podobny renderuje.
- **Asercja:** Network: odpowiedni GET → 200.

---

## §6 Platform Security (SecurityModule — 15 zakładek)

> Plik: `src/views/superadmin/SecurityModule.tsx`. Zakładki: posture, sso, scim, roles, permissions, policies, sessions, audit, audit-events, workflows, incidents, threats, dlp, ai-budgets, compliance.

### 6.1 Security Posture

- Przejdź do `/superadmin/security`.
- **Asercja:** `GlobalSecurityPostureView` lub `SecurityModule` z zakładką `posture` renderuje.
- **Asercja:** widoczny security score / posture dashboard.
- Network: `GET /api/superadmin/security/posture` lub podobny → 200.

### 6.2 SSO Configuration [MANUAL]

- Przejdź do zakładki `sso`.
- **Asercja:** `SSOConfigurationView` renderuje BEZ crasha.
- **KRYTYCZNA weryfikacja (fix `69ffc1fd86`):** komponent wcześniej crashował na `providerType.replace()` przy `providerType=null`. Sprawdź:
  - Brak błędu JS w konsoli dotyczący `replace is not a function` lub `Cannot read properties of null`.
  - Pole `providerType` obsługuje wartość null/undefined gracefully (nullish coalesce).
- Dodaj testową konfigurację SAML/OIDC (z fake danymi) i sprawdź formularz.
- **Asercja:** `POST /api/superadmin/sso` lub `PUT` → 200.
- **Asercja [DB]:** wpis w tabeli SSO.

### 6.3 SCIM Provisioning

- Przejdź do zakładki `scim`.
- **Asercja:** `SCIMProvisioningView` renderuje.
- **Asercja:** Network: `GET /api/superadmin/scim` lub `/api/scim/*` → 200.
- Sprawdź token SCIM — generowanie / regenerowanie.

### 6.4 Roles i Permissions [DB]

- Przejdź do zakładki `roles`.
- **Asercja:** lista ról platformowych (USER, ADMIN, OWNER, SUPERADMIN + custom roles).
- Przejdź do zakładki `permissions`.
- **Asercja:** macierz uprawnień.
- `CustomRolesBuilder.tsx` — sprawdź możliwość definiowania custom ról.
- **Asercja:** Network: `GET /api/superadmin/roles` lub `/api/superadmin/permissions` → 200.

### 6.5 Security Policies

- Przejdź do zakładki `policies`.
- **Asercja:** `SecurityPoliciesView` renderuje — lista polityk (password policy, session policy, etc.).
- Edytuj politykę (np. max session time).
- **Asercja:** Network: `PUT /api/superadmin/security/policies/:id` lub podobny → 200.

### 6.6 Admin Sessions

- Przejdź do zakładki `sessions`.
- **Asercja:** lista aktywnych sesji adminów/superadminów.
- **Asercja:** Network: `GET /api/superadmin/admin/sessions` → 200. (Gated `security_ops`.)
- Revoke sesji: wybierz testową sesję → akcja „Revoke".
- **Asercja:** Network: `DELETE /api/superadmin/admin/sessions/:id` → 200.

### 6.7 Audit Logs i Audit Events

- Przejdź do zakładki `audit`.
- **Asercja:** logi bezpieczeństwa (loginy, failed auth, permission changes).
- Network: `GET /api/superadmin/security/audit` lub `/api/superadmin/activities` → 200.
- Przejdź do `audit-events`.
- **Asercja:** granularne zdarzenia bezpieczeństwa.

### 6.8 Workflows, Incidents, Threats

- Przejdź do zakładki `workflows`.
- **Asercja:** `ApprovalWorkflowsView` lub podobny (gated `security_ops` na `/superadmin/admin/approval-workflows`). Renderuje bez crash.
- Przejdź do `incidents`.
- **Asercja:** lista incydentów bezpieczeństwa. Network: odpowiedni GET → 200.
- Przejdź do `threats`.
- **Asercja:** threat intelligence dashboard. Network: odpowiedni GET → 200.

### 6.9 DLP (Data Loss Prevention)

- Przejdź do zakładki `dlp`.
- **Asercja:** DLP policies/rules widoczne.
- **Asercja:** Network: odpowiedni GET → 200.

### 6.10 AI Budgets

- Przejdź do zakładki `ai-budgets`.
- **Asercja:** `AIBudgetsView` renderuje.
- **Asercja:** Network: `GET /api/superadmin/ai-budgets` lub podobny → 200.
- Ustaw limit budżetu dla testowej org.
- **Asercja:** Network: PUT/POST → 200. **Asercja [DB]:** zaktualizowana wartość.

### 6.11 Compliance (Security)

- Przejdź do zakładki `compliance`.
- **Asercja:** compliance status bezpieczeństwa (nie duplikat z Governance, ale z perspektywy security).

---

## §7 Feedback pulse/feature — ZNANY BUG (500) [KNOWN_BUG]

> Ten paragraf dokumentuje znany błąd. NIE szukamy fixa — dokumentujemy stan i weryfikujemy izolację.

### 7.1 Endpoint POST /api/feedback/pulse → 500

- **Tło:** tabele `feedback_pulse` i `feature_requests` mogły nie istnieć na prod/staging (brak migracji). Fix `36ceb52c60` dodał `CREATE TABLE IF NOT EXISTS` w `feedback.routes.ts:158/177`. Status live-deploy: **pending**.
- Kroki:
  1. W zakładce `feedback` lub `feedback-backlog`, szukaj funkcji „Quick Pulse" / sekcji pulse.
  2. Alternatywnie — wyślij bezpośrednio: `POST http://localhost:3001/api/feedback/pulse` z body `{"rating":4,"context":"test"}`.
- **Asercja expected (jeśli tabela nie istnieje):** HTTP 500, body zawiera error. **Zachowanie po fixie:** HTTP 200.
- **Dokumentuj wynik:** `PASS (tabela istnieje, 200)` lub `EXPECTED FAIL (500, tabela brak, fix niezdeployowany)`.

### 7.2 Endpoint POST /api/feedback/feature → 500

- Kroki: analogicznie.
  ```
  POST http://localhost:3001/api/feedback/feature
  Body: {"title":"Test feature","description":"test"}
  ```
- **Asercja expected:** 500 jeśli tabela `feature_requests` brak. 201 po fixie.
- **Dokumentuj wynik.**

### 7.3 Weryfikacja izolacji — 500 NIE propaguje kaskadowo

- Po wywołaniu endpointów pulse/feature (nawet jeśli zwracają 500):
  1. Odśwież `/superadmin/customers`.
  2. Przejdź do każdej z 5 sekcji sidebarze.
  3. Sprawdź `/superadmin/system/feature-flags`.
  4. Sprawdź `/superadmin/security`.
- **Asercja krytyczna:** żadna inna zakładka/sekcja SuperAdmina NIE jest uszkodzona.
- **Asercja:** konsola NIE zawiera nowych błędów JS poza tymi wygenerowanymi przez 500 z pulse/feature.
- **Asercja:** aplikacja NIE crashuje globalnie — `RouteErrorBoundary` izoluje ewentualny błąd.

### 7.4 In-app feedback (superadmin martwy)

- W headerze SuperAdmina sprawdź FeedbackToggleButton.
- Kliknij go → otwiera `FeedbackSidePanel`.
- Wyślij testowy feedback z konta SUPERADMIN.
- **Asercja:** sprawdź czy in-app feedback działa (`is_active` bug `CAST(is_active AS TEXT) NOT IN ('0','false','f')` fix `36ceb52c60`).
- **Dokumentuj:** `PASS` jeśli działa, `KNOWN_BUG (is_active)` jeśli nie.

---

## §8 Virtual Workers — dostęp URL-only [FLAG]

> Virtual Workers (Anna/Teresa) NIE mają wpisu w sidebarze. Dostępne wyłącznie przez bezpośredni URL.

### 8.1 Weryfikacja braku w sidebarze

- Zalogowany jako SUPERADMIN — sprawdź `SuperAdminSidebar`.
- **Asercja:** brak pozycji „Virtual Workers" / „Anna" / „Teresa" w sidebarze.
- Sprawdź kod: `src/components/layout/SuperAdminSidebar.tsx` — sekcja `ai-platform` NIE zawiera linku do Virtual Workers.
- **Asercja:** `AppView.SUPERADMIN_VIRTUAL_WORKERS` mapuje do sekcji `'ai-platform'` w `appViewToSection`, ale żaden element UI sidebarze nie linkuje do tego widoku.

### 8.2 Dostęp przez bezpośredni URL

- URL Virtual Workers: `/superadmin/virtual-workers` (z `src/routes/routeConfig.ts` linia 188: `VIRTUAL_WORKERS: '/superadmin/virtual-workers'`).
- Kroki:
  1. Wpisz ręcznie w pasek: `http://localhost:5173/superadmin/virtual-workers`.
  2. **Asercja:** `VirtualWorkersModule` renderuje (lazy-load).
  3. **Asercja:** widoczna lista workerów z zakładkami: Workers, i per-worker: Profile, Knowledge, Preview, Conversations, Analytics, Insights, Evaluations, Release.
  4. **Asercja:** Network: `GET /api/virtual-workers` → 200 (po `verifyToken + requireRole('super_admin')`).

### 8.3 Weryfikacja gate virtual-workers — orgAdmin blocked [MANUAL]

- Kroki:
  1. Pobierz token konta `admin@` (org-admin).
  2. Wykonaj:
     ```
     curl -X GET http://localhost:3001/api/virtual-workers \
       -H "Authorization: Bearer <admin_token>"
     curl -X POST http://localhost:3001/api/virtual-workers \
       -H "Authorization: Bearer <admin_token>" \
       -H "Content-Type: application/json" \
       -d '{"name":"TestWorker","slug":"test-worker"}'
     ```
  3. **Asercja:** oba żądania zwracają **403 Forbidden**. (Fix `91c8245559` — `requireRole('super_admin')` only, już nie `requireRole('super_admin','admin')`.)
- Dowód: Network response 403 dla konta admin@.

### 8.4 Lista workerów i Workers List

- Jako SUPERADMIN na `/superadmin/virtual-workers`.
- **Asercja:** `WorkersList` renderuje — lista workerów platformowych (Anna, Teresa, ewentualnie inne).
- **Asercja:** Network: `GET /api/virtual-workers` → 200, body z listą.
- Klik w workera (np. Teresa) → otwiera `WorkerDetail` z pod-zakładkami.

### 8.5 Worker Profile — edycja Anny lub Teresy [DB]

- Wejdź w profil Anny lub Teresy → zakładka `profile`.
- **Asercja:** `WorkerProfileEditor` renderuje — pola: name, slug, description, surface (gdzie worker jest widoczny), persona settings.
- Edytuj pole (np. opis).
- **Asercja:** Network: `PUT /api/virtual-workers/:id` → 200.
- **Asercja [DB]:** wiersz w `virtual_workers` zaktualizowany.
- Odśwież → zmiana persystuje.

### 8.6 Worker Knowledge

- Przejdź do zakładki `knowledge`.
- **Asercja:** `KnowledgeAssignmentPanel` renderuje — lista wiedzy przypisanej do workera.
- **Asercja:** Network: `GET /api/virtual-workers/:id/knowledge` → 200.

### 8.7 Worker Preview

- Przejdź do zakładki `preview`.
- **Asercja:** `WorkerPreviewPanel` renderuje — możliwość wysłania testowej wiadomości do workera.
- Wyślij wiadomość testową.
- **Asercja:** Network: `POST /api/virtual-workers/:id/preview` → 200 lub streaming.
- **Asercja:** odpowiedź workera widoczna w UI.

### 8.8 Worker Analytics i Insights

- Przejdź do `analytics`.
- **Asercja:** `WorkerAnalyticsDashboard` renderuje — metryki użycia (liczba rozmów, oceny, latencja).
- Przejdź do `insights`.
- **Asercja:** `InsightsPanel` renderuje — AI-wygenerowane insights o pracy workera.

### 8.9 Evaluations i Release

- Przejdź do `evaluations`.
- **Asercja:** `EvaluationsPanel` renderuje.
- Przejdź do `release`.
- **Asercja:** `ReleasePanel` renderuje — opcje wdrożenia workera (staging vs prod).
- **NIE wdrażaj** na prod bez zgody Piotra.

---

## §9 Ścieżki cross-module

### 9.1 M27 → M24 Admin (granica SUPERADMIN vs ADMIN)

- **Scenariusz A:** zaloguj się jako ADMIN → wejdź na `/admin/*` → OK (dostęp).
- **Scenariusz B:** zaloguj się jako ADMIN → wejdź na `/superadmin/*` → redirect do `/superadmin` lub denied.
- **Scenariusz C:** zaloguj się jako SUPERADMIN → wejdź na `/admin/*` → redirect do `/superadmin` (linia ~77 ProtectedRoute.tsx).
- **Asercja Scenariusz C:** URL = `/superadmin`, NIE renderuje AdminSettingsModule.
- **Dowód:** screenshot URL po próbie wejścia superadmina na `/admin`.

### 9.2 M27 → M22 AI OS (Virtual Workers)

- Sprawdź, że konfiguracja Virtual Worker w M27 (§8.5 edit profile) **wpływa na działanie** w M22 AI OS lub w czacie (gdzie Teresa/Anna są używane).
- Zmień np. pole `description` lub `slug` Teresy w M27.
- **Asercja:** zmiana widoczna przez `GET /api/virtual-workers/:id` → zaktualizowane dane.
- Zweryfikuj przez M01 Czat (Teresa): sprawdź, czy API `/api/ai-handler` lub `/api/chat` pobiera świeże dane workera przy inicjalizacji rozmowy. (Pełna weryfikacja wpływu na runtime AI wykracza poza zakres tego testu — dokumentuj jako TODO.)

### 9.3 M27 → M26 Portal Partnerski (partner management)

- W sekcji Tenant & User Ops sprawdź, czy jest dostęp do zarządzania partnerami (partner organizations).
- **Asercja:** SuperAdmin widzi partnerów jako subset organizacji.
- **Asercja:** brak przypadkowego ujawnienia SuperAdmin UI w `/partner/*`.

---

## §MAPA EPIKÓW → sekcje testów

Każdy F-epik z `Harvard/wdrozenie-100/M27-superadmin.md` pokryty:

| Epik | Story | Paragraf testu |
|---|---|---|
| **E1 — P0 boczne (NAPRAWIONE)** | S1.1 llm tiers → 403 non-superadmin | §3.3 KRYTYCZNA weryfikacja curl |
| **E1 — P0 boczne (NAPRAWIONE)** | S1.2 virtual-workers → 403 org-admin | §8.3 gate curl test |
| **E2 — P1 llm purposes/market** | S2.1 POST /llm/purposes/:purpose/assignments → 403 oczekiwane | §3.4 FLAG SEC-03 |
| **E2 — P1 llm purposes/market** | S2.2 POST /llm/market/openrouter/sync → 403 oczekiwane | §3.6 FLAG SEC-04 |
| **E3 — Live-verify bugs** | S3.1 FeedbackBacklog brak secret-leak, SSO brak crash | §2.10, §6.2 |
| **E3 — Live-verify bugs** | S3.2 feedback 500 fix weryfikacja | §7.1, §7.2 |
| **E4 — Czystość kodu** | Martwy AIPlatformModule.tsx | §przekrojowe (nie testowane, uwaga) |
| **E5 — i18n (DP-10)** | Świadomy dług internal | §przekrojowe |

---

## §przekrojowe Testy przekrojowe

### PR-CR-1 Gating SUPERADMIN na każdej sekcji [MANUAL]

Dla każdego z 5 segmentów URL, wykonaj curl z tokenem org-admina:
```
# Tenant & User Ops
curl -H "Authorization: Bearer <admin_token>" GET /api/superadmin/organizations  → 403

# AI Platform  
curl -H "Authorization: Bearer <admin_token>" GET /api/superadmin/ai → 403

# System
curl -H "Authorization: Bearer <admin_token>" GET /api/superadmin/feature-flags → 403

# Security
curl -H "Authorization: Bearer <admin_token>" GET /api/superadmin/security/posture → 403
```
**Asercja:** wszystkie → 403. Żaden segment nie przepuszcza non-superadmina.

### PR-CR-2 Zero błędów JS w konsoli (poza §7)

- Przejdź przez wszystkie 5 sekcji + VirtualWorkers.
- **Asercja:** zero błędów JS w konsoli (poza oczekiwanym 500 w zakładkach feedback pulse/feature).
- **Asercja:** zero niezłapanych Promise rejections.

### PR-CR-3 Staging ONLY

- **REGUŁA:** żadne testy zapisu NIE są wykonywane na prod (centerbeam).
- **Weryfikacja przed każdą sesją testową:** `echo $DATABASE_URL` lub sprawdź zmienną środowiskową → musi wskazywać na staging (caboose).
- **Asercja:** po każdym teście zapisu [DB] — sprawdź row w staging DB, NIE w prod.

### PR-CR-4 DesktopOnlyGuard

- Zmień rozmiar okna DevTools do 375px (iPhone) przy zalogowanym SUPERADMIN.
- **Asercja:** pojawia się komunikat „Desktop only" / guard blokuje dostęp.
- Przywróć desktop viewport.

### PR-CR-5 i18n — hardkod EN (świadomy dług DP-10)

> Uwaga: ~114/124 plików SuperAdmina NIE używa `useTranslation()`. To **świadomy dług** (decyzja DP-10 — NIE tłumaczyć v1, interface control-plane = internal EN).

- Przełącz język aplikacji na PL (Settings → Language).
- Wejdź na `/superadmin/*`.
- **Asercja oczekiwana (known):** teksty w SuperAdminie pozostają EN — to **celowe**, nie bug.
- **Asercja:** brak mieszanki PL/EN w elementach wspólnych (header, toast, modal generyczne).

### PR-CR-6 Dark mode

- Przełącz na dark mode (Settings → Theme).
- Przejdź przez każdą z 5 sekcji SuperAdmina.
- **Asercja:** brak białych „lamp" (niezasłoniętych białych tła elementów), brak nieczytelnego tekstu light-on-light.
- **Asercja:** 70 hex literałów w kodzie (L-07 otwarta) może powodować drobne niedopasowania — dokumentuj jako known P3.

### PR-CR-7 Brak wycieków sekretów w response

- Na każdym wywołaniu API Network sprawdź response body.
- **Asercja:** żaden response NIE zawiera: `api_key` w postaci czystej, `SQLSTATE`, `/var/app/secrets`, `/secrets`, pełnych ścieżek systemowych.
- **Asercja klucze LLM:** `GET /api/llm/providers` → pole `api_key` NIEOBECNE w response (jest tylko `has_api_key: bool`).

### PR-CR-8 Paginacja i duże listy

- Organizations: jeśli staging ma dużo org, sprawdź paginację.
- **Asercja:** lista nie ładuje wszystkiego naraz — widoczne paginacja / infinite scroll / load more.
- **Asercja:** request zawiera parametry `limit`, `offset` lub `page`.

### PR-CR-9 Rollback gwarancja

> Zasada: nie commitować zmian na SuperAdmin bez zgody Piotra.

- Każdy test który MODYFIKUJE dane na staging powinien być odwrócony po teście (przywrócona oryginalna wartość).
- Wyjątek: tworzenie testowych encji (org testowa, user testowy) — można pozostawić z prefixem `[TEST]` w nazwie.

---

## §regresja Testy regresji

### R-01 Superadmin middleware — 42 testy jednostkowe

```bash
cd /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify
npx jest --testPathPattern="superAdmin.middleware" --verbose
```
**Asercja:** 42/42 PASS. Sprawdza: odrzucenia 401/403, tamper JWT, brak wiersza users mimo claim → 403, fail-closed.

### R-02 Pełna suita testów

```bash
npx jest --verbose 2>&1 | tail -20
```
**Asercja baseline:** ~502 PASS / ≤9 FAIL (znane: brak `<Router>`, stale-import — nie regresje).

### R-03 Testy E2E RBAC (brak w CI — L-08)

- Sprawdź `server/tests/` lub `e2e/` — czy istnieje test `rbac-gate.spec` lub `superadmin-gate-reject`.
- **Asercja:** jeśli istnieje → uruchom i sprawdź że testy non-superadmin → 403 przechodzą z twardym `=== 403` (nie `[401,403,404]`).
- Jeśli nie istnieje → **dokumentuj jako L-08 otwarte**.

---

## §format-raportu Format raportu testowego

Każdy test raportuj w tabeli:

| # | Test | Wynik | Dowód | Uwagi |
|---|------|-------|-------|-------|
| 1.1 | Non-SUPERADMIN sidebar | PASS/FAIL | screenshot | — |
| 1.5 | Bypass curl admin token | PASS/FAIL | curl response | 403 expected |
| 7.1 | Feedback pulse 500 | EXPECTED FAIL / PASS | curl response | KNOWN_BUG L-10 |
| 8.3 | VirtualWorkers gate | PASS/FAIL | curl response | P0 fix `91c8245559` |

Dołącz do raportu:
- Screenshot każdego kluczowego stanu UI (1 per sekcja minimum).
- Network response dla każdej mutacji.
- Wyjście konsoli (zero błędów lub lista wyjątków).

---

## §DoD Definition of Done

M27 PASS wymaga:

- [ ] §1 Gating: wszystkie 6 scenariuszy PASS (w tym curl bypass → 403).
- [ ] §2 Tenant Ops: 20 zakładek renderuje + kluczowe mutacje (create org, create user, feature-access grant) z Network + DB dowodami.
- [ ] §3 AI Ops: LLM providers CRUD PASS; tiers/assign curl 403 PASS (P0 naprawiony); P1 SEC-03/04 udokumentowane jako known open.
- [ ] §4 System: feature-flags toggle z DB dowód PASS; pozostałe zakładki renderują bez crash.
- [ ] §5 Governance: 6 zakładek renderuje; audit timeline dostępny.
- [ ] §6 Security: 15 zakładek renderuje; SSO brak crash PASS; sessions revoke PASS.
- [ ] §7 Feedback 500: udokumentowany (PASS jeśli fix wdrożony; EXPECTED FAIL jeśli nie); izolacja PASS.
- [ ] §8 Virtual Workers: URL-only access PASS; gate curl 403 PASS (P0 naprawiony); edit worker profile z DB PASS.
- [ ] §przekrojowe: zero błędów JS konsoli (poza §7); dark mode bez białych lamp; secret-leak check PASS.
- [ ] §regresja: middleware 42/42 PASS.
- [ ] **Staging ONLY** — zero testów zapisu na prod.
- [ ] Raport z dowodami (screenshots + Network) złożony.
