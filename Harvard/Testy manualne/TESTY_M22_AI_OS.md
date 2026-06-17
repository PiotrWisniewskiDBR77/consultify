# TESTY — M22 AI OS / Internal Tools

> **Moduł:** M22 AI OS / Internal Tools (`/ai/*`) — wg `Harvard/podzial/_MODULE_MAP_V2.md`, inwentarz `Harvard/podzial/inventory/INV_F_ai-os_organizacja.md`
> **Zakres tej paczki:** pełny moduł AI OS — 8 paneli: Home (`/ai`), Action Center (`/ai/action-center`), Research Sessions (`/ai/research-sessions`), Artifacts (`/ai/artifacts`), Memory & Scope (`/ai/context`), Connectors (`/ai/connectors`), Agents (`/ai/agents`), KPI/ROI & AI Ops (`/ai/outcomes`) — plus podwójny gating DBR77, weryfikacja V8-gate na Artifacts, symulacja OAuth Wave 7.
> **Cel:** agent piszący i testujący moduł ma dogłębnie przetestować dostęp, nawigację, każdy panel CRUD, lifecycle flow i cross-module wiring — z weryfikacją E2E (UI + Network + DB).
> **Wzór formatu:** `Harvard/Testy manualne/TESTY_M01_CZAT.md` + `TESTY_M03_MOJA_PRACA.md`.
> **Legenda:** **[MANUAL]** = ręczna weryfikacja (OAuth toggle / DB row); **[FLAG]** = zależne od zmiennej środowiskowej / roli; **[DB]** = dowód obejmuje wiersz w bazie.
> **Data:** 2026-06-16

---

## 0. Architektura i mapa plików

### Komponenty FE (9 plików, wszystkie w `src/components/AIChat/`)

| Panel | Komponent | Endpoint(y) główne |
|---|---|---|
| Home | `AIOSHub.tsx` | `/api/v10/teresa/voice-config` (live) |
| Home → Wave0 raport | `AIOSWave0GateReport.tsx` | (statyczny) |
| Action Center | `ActionCenter.tsx` | `GET /api/ai/actions/center`, `POST /api/ai/actions/:id/approve`, `/reject`, `/execute`, `GET /api/ai/actions/runs` (Run Ledger), `GET /api/ai/actions/:id/audit` |
| Research Sessions | `ResearchSessionsDock.tsx` | `POST/GET /api/research/sessions`, lifecycle przez dedykowane ścieżki `POST /api/research/sessions/:id/{approve\|start\|cancel\|resume\|retry}`, `GET /api/research/evidence` |
| Artifacts (Wave 5) | `Wave5ArtifactRuntimePanel.tsx` | `GET/POST /api/artifacts/wave5/*`, `GET /api/artifacts/wave5/schema` |
| Memory & Scope (Wave 6) | `Wave6ContextLearningPanel.tsx` | `GET/POST /api/ai-context/*` |
| Connectors (Wave 7) | `Wave7ConnectorAdminPanel.tsx` | `GET/POST/PATCH /api/ai-connectors/*` |
| Agents (Wave 8) | `Wave8AgentCatalogPanel.tsx` | `GET/POST /api/ai-agents/*` |
| KPI/ROI & AI Ops (Wave 9) | `Wave9OutcomeAIOpsPanel.tsx` | `GET/POST /api/ai-outcomes/*` |

### Backend

| Router | Plik | Tabele |
|---|---|---|
| `/api/ai/actions/center`, `/ai/actions/runs` (ledger), `/ai/actions/:id/*` | `server/src/routes/ai.routes.ts` (`/actions/center` ~6104, `/actions/runs` ~6157) | `ai_runs` |
| `/api/research/sessions` | `server/src/routes/research.routes.ts` | `research_sessions`, `research_evidence` |
| `/api/artifacts` | `server/src/routes/artifacts.routes.ts` | `wave5_artifacts`, `wave5_artifact_versions`, `wave5_mutation_proposals` |
| `/api/ai-context` | `server/src/routes/wave6-context.routes.ts` | `wave6_context_snapshots`, `wave6_context_ledger`, `wave6_memory_candidates`, `wave6_memory_stewardship_decisions` |
| `/api/ai-connectors` | `server/src/routes/wave7-connectors.routes.ts` | `wave7_connectors`, `wave7_connector_runs` |
| `/api/ai-agents` | `server/src/routes/wave8-agents.routes.ts` | `wave8_agent_definitions`, `wave8_agent_runs`, `wave8_agent_schedules`, `wave8_agent_notifications` |
| `/api/ai-outcomes` | `server/src/routes/wave9-outcomes.routes.ts` | `wave9_outcomes`, `wave9_evidence_registry`, `wave9_provider_health`, `wave9_eval_runs`, `wave9_acceptance_runs`, `wave9_incidents`, `wave9_acceptance_decisions` |

### Middleware bezpieczeństwa

Trzy niezależne warstwy (muszą wszystkie przejść):

| Warstwa | Plik | Logika |
|---|---|---|
| 1. Sidebar (nawigacja) | `src/components/navigation/Sidebar/Sidebar.tsx:164` | `showInternalToolsMenu = canUseInternalTools(currentUser)` |
| 2. Route guard (FE) | `src/routes/AppRoutes.tsx:574-577, 774-780` | `InternalToolsGate` → redirect `→ /chat` gdy `!canUseInternalTools()` |
| 3. API middleware (BE) | `server/src/middleware/internalTools.middleware.ts:43-81` | `requireInternalToolsAccess`: domena + rola + orgId; DEV bypass `NODE_ENV=development` |

### Maszyna flag

| Flaga | Default | Wpływ |
|---|---|---|
| `NODE_ENV=development` | — | BE bypass całej weryfikacji domain/role |
| `INTERNAL_TOOLS_ENABLED=false` (BE) | false | Cały moduł API 404 |
| `VITE_INTERNAL_TOOLS_ENABLED=false` (FE) | false | FE gate blokuje, redirect do `/chat` |
| `VITE_INTERNAL_TOOLS_ALLOWED_EMAIL_DOMAINS` | `dbr77.com` | Whitelist domen |
| `VITE_INTERNAL_TOOLS_ALLOWED_ROLES` | `SUPERADMIN,ADMIN,OWNER` | Whitelist ról |
| `ENABLE_V8_GLOBAL` | true (staging) | Artifacts API 404 gdy false; panel FE wciąż renderowany |

### Zasada E2E (obowiązkowa)

Każda akcja CRUD i lifecycle MUSI być potwierdzona w zakładce Network (żądanie HTTP + odpowiedź). Stan bazy przy `[DB]` — sprawdź przez psql lub Railway Console, że rekord faktycznie istnieje. Sam widok UI bez żądania = FAIL (możliwy błąd optimistic update bez persystencji).

---

## Setup środowiska testowego

1. Uruchom dev server: `pnpm dev` (FE `:3000`, BE `:3001`).
2. **Konto testowe DBR77:** zaloguj jako `piotr.wisniewski@dbr77.com` z rolą OWNER (lub ADMIN) — jedyne konto, które widzi moduł.
3. **Konto zewnętrzne:** przygotuj drugie konto z domeną spoza `dbr77.com` (np. `test@gmail.com`) lub kontem o roli MEMBER — do testów §1 Gating.
4. Otwórz DevTools → zakładka **Network** (filtr: `/api/ai`, `/api/research`, `/api/artifacts`, `/api/ai-context`, `/api/ai-connectors`, `/api/ai-agents`, `/api/ai-outcomes`) + zakładka **Console** (zero błędów = wymóg).
5. Miej pod ręką: UUID testowy (do pól `aiRunId`), przykładowe dane JSON dla agenta.
6. **Flagi środowiskowe:** w DEV `INTERNAL_TOOLS_ENABLED` i `VITE_INTERNAL_TOOLS_ENABLED` są domyślnie `true` (DEV bypass). Na staging sprawdź Railway Variables.

---

## §1 GATING — testy dostępu (krytyczne, P0)

### 1.1 Sidebar — widoczność wpisu AI OS

**Cel:** moduł nie pojawia się w nawigacji dla użytkowników spoza DBR77.

#### 1.1.1 Konto DBR77 z rolą OWNER
- Zaloguj jako `piotr.wisniewski@dbr77.com` (rola OWNER).
- **Oczekiwane:** w sidebarze widoczny wpis „AI OS" (lub ikona) prowadzący do `/ai`.
- **Asercja:** `showInternalToolsMenu = canUseInternalTools(currentUser) = true`.

#### 1.1.2 Konto zewnętrzne (domena spoza dbr77.com)
- Zaloguj jako użytkownik z emailem `@gmail.com` lub inną domeną.
- **Oczekiwane:** wpis AI OS w sidebarze niewidoczny (`showInternalToolsMenu = false`).
- **Asercja:** w DOM brak linku `/ai` (DevTools → Elements).

#### 1.1.3 Konto DBR77 z rolą MEMBER
- Zaloguj jako `member@dbr77.com` z rolą MEMBER (lub USER).
- **Oczekiwane:** `canUseInternalTools` = false (rola spoza whitelist SUPERADMIN/ADMIN/OWNER) → wpis niewidoczny.

### 1.2 Direct URL — non-DBR77

#### 1.2.1 Wejście na `/ai` dla konta zewnętrznego
- Zaloguj jako konto `@gmail.com`, wpisz ręcznie URL `/ai`.
- **Oczekiwane:** natychmiastowy redirect do `/chat` (`InternalToolsGate` → `<Navigate to="/chat">`), BRAK renderowania treści AI OS.
- **Asercja:** URL przeglądarki = `/chat`; zero żądań do `/api/ai/*` w Network.

#### 1.2.2 Wejście na `/ai/action-center` dla konta zewnętrznego
- Zaloguj jako konto zewnętrzne, wpisz URL `/ai/action-center`.
- **Oczekiwane:** redirect do `/chat`.

#### 1.2.3 Direct API call dla konta zewnętrznego [MANUAL]
- Zaloguj jako konto `@gmail.com`, w Network przechwychaj token JWT, wykonaj `curl -H "Authorization: Bearer <token>" http://localhost:3001/api/research/sessions`.
- **Oczekiwane:** `HTTP 404` z body `{"error":"Not found"}` (middleware `requireInternalToolsAccess` linia 49).
- **Asercja:** status 404, NIE 401 ani 403 (świadome — middleware zwraca 404 nie 403).

#### 1.2.4 [FLAG] DEV bypass — weryfikacja staging NODE_ENV [MANUAL]
- Na środowisku stagingowym: zweryfikuj przez Railway Variables, że `NODE_ENV` != `development`. Jeśli `NODE_ENV=development` na staging, middleware `internalTools.middleware.ts:39` pomija weryfikację domain/role dla każdego zalogowanego usera.
- **Oczekiwane:** staging ma `NODE_ENV=production`.
- **Asercja (krytyczna):** curl z tokenem konta `@gmail.com` na staging zwraca 404.

### 1.3 DBR77 — pełny dostęp

#### 1.3.1 Nawigacja do wszystkich 8 tras [DB]
- Zaloguj jako `piotr.wisniewski@dbr77.com` (OWNER).
- Odwiedź kolejno: `/ai`, `/ai/action-center`, `/ai/research-sessions`, `/ai/artifacts`, `/ai/context`, `/ai/connectors`, `/ai/agents`, `/ai/outcomes`.
- **Oczekiwane:** każda trasa renderuje właściwy panel; w Network każde żądanie GET do API zwraca HTTP 200 (nie 404).
- **Asercja:** 8 tras × HTTP 200 = brak blokady.

#### 1.3.2 Aliasy tras
- Odwiedź: `/ai-os` (alias `/ai`), `/ai/actions` (alias `/ai/action-center`), `/ai/memory` (alias `/ai/context`), `/ai/aiops` (alias `/ai/outcomes`).
- **Oczekiwane:** aliasy prowadzą do właściwych widoków (`routeConfig.ts`: `ALIAS '/ai-os'`, `ACTIONS_ALIAS '/ai/actions'`, `MEMORY_ALIAS '/ai/memory'`, `AIOPS_ALIAS '/ai/aiops'`).

---

## §2 Panel Home (`/ai`) — `AIOSHub.tsx`

### 2.1 Siatka 6 kart modułów

- Na `/ai` renderuje się `AIOSHub` z 6 kartami: AI Actions, Memory & Scope, Connectors, Agents, KPI/ROI & AI Ops, Research & Artifacts.
- Każda karta ma: ikonę, tytuł, opis, listę 3 checkboxów testów akceptacyjnych, przycisk „Open".
- **Klik w kartę** → SPA-nawigacja do właściwej trasy (bez twardego reloadu — sprawdź czy URL się zmienia i czy powrót Back działa).
- **Asercja:** każda karta prowadzi do właściwego panelu (tabela `modules` w `AIOSHub.tsx:20-87`).

### 2.2 Sekcja AIOSWave0GateReport

- Panel renderuje `AIOSWave0GateReport` — statyczny raport HTML.
- **Asercja:** sekcja widoczna i nie crashuje; sprawdź czy zawiera `<table>` (znana luka L-07 — surowy `<table>` zamiast komponentu `DataTable`). Odnotuj status: PASS_WITH_LIMITATIONS jeśli `<table>` widoczny ale funkcjonalny.

### 2.3 Sekcja V10 Teresa Voice Workspace

- Panel renderuje `V10TeresaRuntimeWorkspace` wołając `GET /api/v10/teresa/voice-config`.
- **Oczekiwane:** żądanie HTTP 200; panel pokazuje konfigurację głosu (lub komunikat braku konfiguracji).
- **Asercja w Network:** `GET /api/v10/teresa/voice-config` → 200 (nie 404). Odnotuj czy voice jest skonfigurowany.

### 2.4 Stub — Build Milestones

- Tabela „10 fal" jest statycznym HTML (`AIOSHub.tsx` — hardcoded markup, brak endpointu).
- **Asercja:** tabela widoczna, BRAK żądania do żadnego `/api/milestones` ani podobnego — to świadomy stub UI.

---

## §3 Panel Actions (`/ai/action-center`) — `ActionCenter.tsx`

**Epik 1 (SC2):** Approve/Execute AI action + weryfikacja w Run Ledger.

### 3.1 Ładowanie listy akcji

- Otwórz `/ai/action-center`.
- **Oczekiwane:** komponent woła najpierw `GET /api/ai/actions/center?scope=mine&limit=100`. Jeśli pusta odpowiedź, woła ponownie z `scope=org`.
- **Asercja w Network:** żądanie GET z prawidłowym scope; odpowiedź ma pole `actions: []` lub wypełnioną tablicę.
- **Stan ładowania:** spinner widoczny podczas fetch; po załadowaniu lista lub komunikat pusty stan.
- **Błąd sieci:** gdy API niedostępne → komunikat błędu w UI (sprawdź `error` state).

### 3.2 Deep-link `?actionId=`

- Wejdź na `/ai/action-center?actionId=<istniejące-uuid>`.
- **Oczekiwane:** panel ładuje, wybrany action z podanym ID jest zaznaczony, sekcja Audit Trail wypełniona dla tego action.
- **Asercja w Network:** `GET /api/ai/actions/<id>/audit` wołane automatycznie.

### 3.3 Approve akcji [DB]

- Na liście akcji w statusie `pending_review` kliknij przycisk **Approve**.
- **Oczekiwane:** `POST /api/ai/actions/:id/approve` → HTTP 200; lista odświeża się; ikona statusu zmienia się na `ShieldCheck` (approved); toast sukcesu.
- **Asercja [DB]:** w tabeli `ai_runs` wiersz z danym `runId` ma `status = 'approved'`.

### 3.4 Reject akcji [DB]

- Na liście akcji w statusie `pending_review` lub `approved` kliknij **Reject**.
- **Oczekiwane:** `POST /api/ai/actions/:id/reject` z body `reason` → HTTP 200; lista odświeża się; ikona zmienia się na `X` (rejected).
- **Asercja [DB]:** wiersz w `ai_runs` z `status = 'rejected'`.

### 3.5 Execute akcji [DB]

- Na liście akcji w statusie `approved` kliknij **Execute**.
- **Oczekiwane:** `POST /api/ai/actions/:id/execute` z `{}` body → HTTP 200 lub 202; lista odświeża się; status zmienia się na `executing` → `executed`.
- **Asercja [DB]:** wiersz w `ai_runs` z `status = 'executed'`.

### 3.6 Audit Viewer (Inspect)

- Kliknij akcję i wybierz opcję **Inspect** (lub kliknij w akcję z listy).
- **Oczekiwane:** `GET /api/ai/actions/:id/audit` → HTTP 200; panel Audit Viewer pokazuje: kto/co/kiedy/dlaczego + lista eventów + możliwość rollbacku.
- **Asercja:** pole `audit` z historią eventów w UI; w Network żądanie `audit` → 200.

### 3.7 Run Ledger (read-only)

- Po załadowaniu panelu widać sekcję Run Ledger.
- **Oczekiwane:** `GET /api/ai/actions/runs?scope=mine&limit=100` (a potem org fallback) → HTTP 200; lista run-ów Teresy read-only. (SSOT: `Api.getAIRunLedger` → `/ai/actions/runs`.)
- Gdy ledger niedostępny → `ledgerWarning` banner zamiast crasha.
- **Asercja:** Network żądanie ledger → 200; UI wyświetla runs lub `ledgerWarning` komunikat (brak white-screen).

### 3.8 Statusy i ikony

- Dla każdego statusu z tablicy `STATUS_ICON` (`pending_review`, `approved`, `executing`, `executed`, `audited`, `failed`, `rejected`) — upewnij się, że ikona jest prawidłowa i etykieta `statusLabel()` formatuje podkreślenia na spacje.

---

## §4 Panel Research (`/ai/research-sessions`) — `ResearchSessionsDock.tsx`

**Epik SC1:** tworzenie + zatwierdzanie + uruchomienie Research Session + reload → status zachowany.

### 4.1 Ładowanie listy sesji

- Otwórz `/ai/research-sessions`.
- **Oczekiwane:** `GET /api/research/sessions?limit=50` → HTTP 200; lista sesji lub komunikat „No sessions".
- **Timeout:** jeśli API nie odpowie w 12 sekund → komunikat „Research sessions refresh timed out" (logika `withTimeout` w `ResearchSessionsDock.tsx:54-59`).
- **Asercja:** spinner → lista lub komunikat; zero white-screen.

### 4.2 Tworzenie nowej Research Session [DB]

- Wypełnij formularz: pole **Mission** (tekst opisu), pole **Scope** (opcjonalne), **Questions** (pytania badawcze), **Allowed Sources** (checkboxy: web / attachment / product / org — zaznacz ≥1).
- Kliknij „Create Session" (lub „Plan").
- **Oczekiwane:** `POST /api/research/sessions` z body `{mission, scope, questions, allowedSources}` → HTTP 201; nowa sesja pojawia się na liście ze statusem `planned`.
- **Asercja [DB]:** wiersz w `research_sessions` z podanym `mission` i `status = 'planned'`.

### 4.3 Lifecycle — Approve → Start → Cancel → Resume → Retry [DB]

> **Korekta endpointów:** NIE ma jednego `/transition {action}`. Każda tranzycja ma DEDYKOWANĄ ścieżkę (SSOT: `research.routes.ts` `/sessions/:sessionId/{approve,start,cancel,resume,retry}` + `Api.approveResearchSession` itd.).

Dla każdego przejścia (jeśli dostępne w UI):

| Akcja | Endpoint (zweryfikowany w kodzie) | Oczekiwany nowy status |
|---|---|---|
| Approve | `POST /api/research/sessions/:id/approve` | `approved` |
| Start | `POST /api/research/sessions/:id/start` | `running` |
| Cancel | `POST /api/research/sessions/:id/cancel` | `cancelled` |
| Resume | `POST /api/research/sessions/:id/resume` | `running` |
| Retry | `POST /api/research/sessions/:id/retry` | `running` lub `planned` |

- Po każdej tranzycji: lista odświeża się, ikona statusu zmienia się (tabela `STATUS_ICON` w pliku).
- **Asercja [DB]:** `research_sessions` wiersz z nowym `status`.

> **DEFEKT PRODUKTU (funkcje-widma) — NIE krok testu:** `pause` i `archive` NIE istnieją w backendzie (brak ścieżek w `research.routes.ts`, brak metod w `api.ts`). Jeśli FE renderuje przyciski Pause/Archive → są to martwe przyciski (klik bez działającego endpointu = 404 lub no-op). Odnotuj jako defekt FE do usunięcia/zaślepienia, a nie jako FAIL testu lifecycle.

### 4.4 Auto-refresh (polling 5s)

- Utwórz sesję i uruchom ją. Pozostań na panelu przez 30 sekund.
- **Oczekiwane:** `GET /api/research/sessions` woła się automatycznie co ~5 sekund bez akcji użytkownika (`ResearchSessionsDock.tsx` — polling loop).
- **Asercja w Network:** seria żądań GET z odstępem ~5s; każde zwraca 200.

### 4.5 Evidence Graph

- Dla sesji w statusie `running` lub `completed` wybierz ją z listy.
- **Oczekiwane:** widoczna sekcja Evidence Graph z wierszami: `nodeId`, `sourceClass`, `confidence` (w %), `contradiction` (flag), `freshness`.
- **Endpoint (korekta):** evidence to **top-level** `GET /api/research/evidence` (SSOT: `research.routes.ts` `'/evidence'` ~246), NIE `/sessions/:id/evidence`. Filtrowanie sesji po stronie odpowiedzi/klienta.
- **Asercja:** dane z pola `evidence[]` (top-level) renderowane; sprawdź że `contradiction=true` ma wizualne wyróżnienie (ostrzeżenie lub badge).

### 4.6 Final Artifact (raport markdown)

- Dla sesji w statusie `completed` sprawdź, czy dostępny jest Final Artifact.
- **Oczekiwane:** sekcja `finalArtifact` z polem `contentMarkdown` — treść raportu renderowana.
- **Asercja:** tekst markdown widoczny; nie surowy JSON.

### 4.7 Tryb compact (prop `compact=true`) [MANUAL]

- Sprawdź (w kodzie lub w M02 Canvas), czy `ResearchSessionsDock` jest osadzany z `compact={true}`.
- **Oczekiwane:** w trybie compact panel ma zredukowany layout (brak pełnowymiarowego formularza tworzenia); tylko lista + podgląd aktywnej sesji.
- **Asercja:** brak rzucania błędów w consoli przy `compact=true`.

### 4.8 Reload — persistencja statusu [DB]

- Uruchom sesję (status `running`). Odśwież całą stronę (`F5`).
- **Oczekiwane:** po reloadzie lista sesji załaduje się z powrotem przez API; sesja nadal ma status `running`.
- **Asercja [DB]:** wiersz w `research_sessions` przetrwał reload.

---

## §5 Panel Artifacts (`/ai/artifacts`) — `Wave5ArtifactRuntimePanel.tsx`

**Epik 1 (SC7, L-01, FLAG):** kluczowy test V8-gate.

> **Korekta prefiksu endpointów:** wszystkie ścieżki Wave 5 mają prefiks `/api/artifacts/wave5/*` (SSOT: `api.ts` ~14353–14497). Konkretnie: `/wave5/schema`, `/wave5` (lista+create), `/wave5/:id`, `/wave5/:id/mutations`, `/wave5/mutations/:mutId/{approve,commit,reject}`, `/wave5/fill-template`, `/wave5/generate`, `/wave5/:id/export-manifest`.

### 5.1 [FLAG] Artifacts przy ENABLE_V8_GLOBAL=false (L-01 — PRZEKLASYFIKOWANE na PASS/regresję)

- **Środowisko:** wyłącz `ENABLE_V8_GLOBAL` (ustaw `ENABLE_V8_GLOBAL=false` lub `''` w .env; zrestartuj serwer). Pozostaw `INTERNAL_TOOLS_ENABLED=true`.
- Wejdź na `/ai/artifacts` jako DBR77 OWNER.
- **Panel FE jest renderowany**, ale `Wave5ArtifactRuntimePanel.tsx` ustawia stan `loadError` i renderuje ekran zastępczy zamiast cichej 404.
- **Oczekiwane (zweryfikowany stan obecny — SC7 SPEŁNIONE):** panel pokazuje czytelny komunikat: „Artefakty niedostępne / Artifacts unavailable" + „Środowisko uruchomieniowe artefaktów wymaga ustawienia `ENABLE_V8_GLOBAL=true` na serwerze" + przycisk retry. (SSOT: `Wave5ArtifactRuntimePanel.tsx` blok `if (loadError) { ... }` ~:252–265.)
- **Asercja:** Network `GET /api/artifacts/wave5/schema` (lub `/wave5`) → 404; UI **wyświetla** komunikat o `ENABLE_V8_GLOBAL` (NIE cicha 404, NIE white-screen). Przycisk retry ponawia `load()`.
- **Status oczekiwany:** **PASS** (regresja — defekt L-01 „cicha 404" jest naprawiony; loadError obsłużony i widoczny). Wcześniejsza klasyfikacja „otwarty P1" jest nieaktualna.

### 5.2 [FLAG] Artifacts przy ENABLE_V8_GLOBAL=true — lista artefaktów [DB]

- Włącz `ENABLE_V8_GLOBAL=true`. Wejdź na `/ai/artifacts`.
- **Oczekiwane:** `GET /api/artifacts/wave5?limit=50` + `GET /api/artifacts/wave5/schema` → HTTP 200; lista artefaktów (lub pusty stan „No artifacts").
- **Asercja w Network:** oba żądania 200.

### 5.3 [FLAG] Tworzenie artefaktu [DB]

- Kliknij „Create Artifact"; wypełnij: **Type** (wybierz z listy DEFAULT_TYPES np. `report`), **Title**, **Content**.
- **Oczekiwane:** `POST /api/artifacts/wave5` z body `{artifactType, title, content}` → HTTP 201; nowy artefakt pojawia się na liście.
- **Asercja [DB]:** wiersz w `wave5_artifacts` z podanym tytułem.

### 5.4 [FLAG] Generate Output (executive_report / board_deck / kpi_table) [DB]

- Wybierz `outputKind` (np. `executive_report` / `board_deck` / `kpi_table`); wpisz `prompt`.
- Kliknij „Generate".
- **Oczekiwane:** `POST /api/artifacts/wave5/generate` z `{outputKind, prompt, title?}` → HTTP 200/201; powstaje/aktualizuje się ustrukturyzowany artefakt. (SSOT: `Api.generateWave5StructuredArtifact` — endpoint top-level, NIE `/:id/generate`; pole to `outputKind`, NIE `generationKind`.)
- **Asercja w Network:** żądanie POST → 200/201; w UI widoczna nowa treść.

### 5.5 [FLAG] Document Filling — szablon `{{pola}}` [DB]

- Ustaw `template` na `Business case for {{initiative}} in {{quarter}}`; wypełnij `fields` JSON `{"initiative":"AI OS","quarter":"Q3"}`.
- Kliknij „Fill".
- **Oczekiwane:** `POST /api/artifacts/wave5/fill-template` z `{template, fields, artifactId?}` → HTTP 200/201; placeholdery `{{initiative}}` zastąpione wartościami. (SSOT: `Api.fillWave5DocumentTemplate` — top-level `/wave5/fill-template`, NIE `/:id/fill`.)
- **Asercja:** treść artefaktu nie zawiera `{{}}` po wypełnieniu.

### 5.6 [FLAG] Mutation proposals (diff → approve → commit) [DB]

- Wyślij Proposed Content dla artefaktu (edycja istniejącego); kliknij „Propose Mutation".
- **Oczekiwane:** `POST /api/artifacts/wave5/:id/mutations` → HTTP 201; lista mutacji pokazuje nową z statusem `proposed`. (SSOT: `Api.proposeWave5ArtifactMutation`.)
- Kliknij **Approve Mutation** → `POST /api/artifacts/wave5/mutations/:mutId/approve` → status `approved`. (Mutacja kluczowana po `mutationId`, NIE `/:id/mutations/:mutId`.)
- Kliknij **Commit Mutation** → `POST /api/artifacts/wave5/mutations/:mutId/commit` → artefakt zaktualizowany do nowej treści. (Dostępny też skrót `/wave5/mutations/:mutId/approve-and-commit`.)
- **Asercja [DB]:** wiersz w `wave5_mutation_proposals` z `status = 'committed'`; wersja artefaktu zwiększona o 1.

### 5.7 [FLAG] Version Lineage

- Wybierz artefakt z ≥2 wersjami (po commicie mutacji); sprawdź sekcję Version Lineage.
- **Oczekiwane:** lista `versions[]` z numerami wersji i datami (`v1`, `v2`, ...); kliknięcie wersji ładuje historyczny snapshot.
- **Asercja:** FE renderuje `versions[]` **z detalu artefaktu** `GET /api/artifacts/wave5/:id` (SSOT: `Api.getWave5Artifact` — to ścieżka faktycznie wołana przez panel). Istnieje też dedykowana ścieżka backendu `GET /api/artifacts/wave5/:id/versions` (`artifacts.routes.ts` ~:502), ale `api.ts` jej nie eksponuje — panel jej NIE woła. Po wyborze artefaktu sprawdź, że `versions[]` jest renderowana.

### 5.8 [FLAG] Provenance footer + Export manifest

- Wybierz artefakt; sprawdź sekcję Provenance i Export Manifest.
- **Oczekiwane:** `provenance` i `exportManifest` widoczne jeśli ustawione; brak crasha gdy `null`.

---

## §6 Panel Memory (`/ai/context`) — `Wave6ContextLearningPanel.tsx`

**Epik SC3:** Zapis Memory Candidate → Approve → weryfikacja persist po reloadzie.

### 6.1 Ładowanie panelu — What AI Knows (snapshoty) [DB]

- Otwórz `/ai/context`.
- **Oczekiwane:** `GET /api/ai-context/panel` → HTTP 200; sekcja „What AI Knows" z listą snapshotów (scope: org/project/user) ze świeżością.
- **Asercja w Network:** żądanie 200; wyświetlone facts z `humanizeFactKey` (np. „Communication style", „Focus mode").

### 6.2 Capture context snapshot [DB]

- Wybierz **Snapshot Scope** (`org` / `project` / `user`); jeśli `project` — wpisz Project ID.
- Kliknij „Capture Snapshot".
- **Oczekiwane:** `POST /api/ai-context/snapshots` z `{snapshotType, projectId, facts, privateMode?}` → HTTP 200/201; lista snapshotów odświeża się z nowym wpisem. (SSOT: `Api.captureWave6ContextSnapshot` → `/ai-context/snapshots`; pole scope to `snapshotType`, NIE `scope`; endpoint to `/snapshots`, NIE `/capture`.)
- **Asercja [DB]:** wiersz w `wave6_context_snapshots` z podanym `snapshotType`.

### 6.3 Private mode — blokada zapisów uczenia [DB]

> **Korekta — funkcja-widmo:** NIE ma osobnego endpointu `/ai-context/private-mode`. Private Mode to **pole `privateMode: boolean` na body** żądania snapshotu (`Api.captureWave6ContextSnapshot`) oraz kandydata pamięci (`Api.captureWave6MemoryCandidate`). Brak osobnego toggle-requestu w sieci.

- Włącz checkbox **Private Mode** w panelu.
- Wykonaj Capture Snapshot (§6.2) lub Submit Candidate (§6.5) przy włączonym Private Mode.
- **Oczekiwane:** w body żądania (`POST /api/ai-context/snapshots` lub `POST /api/ai-context/memory/candidates`) widoczne `"privateMode": true`. System oznacza wpis jako prywatny, co ma zapobiec uczeniu.
- **Asercja:** w Network sprawdź **payload** żądania (nie osobny endpoint) — pole `privateMode: true` jest wysłane; odnotuj faktyczne zachowanie po stronie backendu.

### 6.4 Typy pamięci i zakresy

- Sprawdź dostępne **Assistant Scope**: `anna_public` i `teresa_tenant`.
- Sprawdź dostępne **Memory Scope**: `public_product`, `tenant`, `org`, `user`, `project`.
- **Asercja:** oba selecty mają wszystkie opcje renderowane; zmiana assistant scope nie powoduje crasha.

### 6.5 Memory Candidate — tworzenie [DB]

- Wybierz: **Assistant Scope** = `teresa_tenant`, **Memory Scope** = `user`, **Key** = `communication_style`, **Value** = tekst testowy.
- Kliknij „Submit Candidate".
- **Oczekiwane:** `POST /api/ai-context/memory/candidates` z pełnym body `{assistantScope, memoryScope, key, value, privateMode?}` → HTTP 201; kandydat pojawia się w Memory Stewardship Queue z statusem `pending`. (SSOT: `Api.captureWave6MemoryCandidate` → `/ai-context/memory/candidates`.)
- **Asercja [DB]:** wiersz w `wave6_memory_candidates` z podanym `key` i `status = 'pending'`.

### 6.6 Memory Stewardship Queue — Approve / Reject / Apply / Expire [DB]

> **Korekta — JEDEN endpoint, nie trzy:** wszystkie decyzje idą przez **`POST /api/ai-context/memory/candidates/:id/decision`** z body `{decision, reason?}` (SSOT: `Api.decideWave6MemoryCandidate`). NIE ma osobnych ścieżek `/stewardship/:id/approve|reject|expire`.

Dla kandydata w statusie `pending` (rozróżnienie przez wartość pola `decision`):

| Akcja | Endpoint | Body | Nowy status |
|---|---|---|---|
| Approve | `POST /api/ai-context/memory/candidates/:id/decision` | `{decision:'approve'}` | `approved` |
| Apply | `POST …/decision` | `{decision:'apply'}` | `applied` |
| Reject (z powodem) | `POST …/decision` | `{decision:'reject', reason}` | `rejected` |
| Expire | `POST …/decision` | `{decision:'expire'}` | `expired` |

- Po akcji: lista stewardship odświeża się; status kandydata zmieniony.
- **Asercja [DB]:** wiersz w `wave6_memory_stewardship_decisions` z odpowiednim statusem.

### 6.7 Reload — persistencja Memory [DB]

- Utwórz i zatwierdź Memory Candidate (status `approved`). Odśwież stronę.
- **Oczekiwane:** po reloadzie sekcja „What AI Knows" zawiera zatwierdzone fakty; pamięć zasilona.
- **Asercja [DB]:** wiersz przetrwał reload.

---

## §7 Panel Connectors (`/ai/connectors`) — `Wave7ConnectorAdminPanel.tsx`

**Epik 4 (SC4, L-05):** OAuth symulowany — jak testować bez prawdziwego OAuth.

### 7.1 Ładowanie katalogu i listy konektorów

- Otwórz `/ai/connectors`.
- **Oczekiwane:** 4 równoległe żądania:
  - `GET /api/ai-connectors/catalog` → lista dostępnych typów providerów
  - `GET /api/ai-connectors/` → lista zarejestrowanych konektorów org
  - `GET /api/ai-connectors/health` → health dashboard
  - `GET /api/ai-connectors/runs` → lista run-ów
- **Asercja w Network:** wszystkie 4 żądania → HTTP 200.
- **Stan ładowania:** spinner; po załadowaniu lista lub pusty stan.

### 7.2 Rejestracja konektora [DB]

- Wypełnij formularz: **Provider** = `google_drive`, **Status** = `connected`, **Project IDs** (opcjonalne), **External Connector ID** (opcjonalne).
- Kliknij „Register".
- **Oczekiwane:** `POST /api/ai-connectors/` z body `{provider, status, scopes, projectIds, tenantPolicy, freshnessTtlMinutes}` → HTTP 201; konektor pojawia się na liście.
- **Asercja [DB]:** wiersz w `wave7_connectors` z podanym `provider`.

### 7.3 [MANUAL] OAuth symulacja — ustawianie stanów (L-05)

Brak realnego OAuth flow (D-02 otwarta). Testujemy manual state toggle:

- Wybierz zarejestrowany konektor; wykonaj `PATCH /api/ai-connectors/:connectorId` z body:
  - `{status: 'stale', tokenExpiresAt: '2026-01-01T00:00:00Z'}` — symulacja wygaśnięcia tokenu
  - `{status: 'failed', failureState: 'token_expired'}` — symulacja błędu
  - `{status: 'connected', tokenExpiresAt: null, reconnectRequired: false}` — symulacja odnowienia
  - `{status: 'disconnected', accessRevokedAt: new Date().toISOString(), revokedReason: 'Manual test'}` — symulacja rozłączenia
- **Oczekiwane:** każdy PATCH → HTTP 200; UI odświeża status konektora; wizualna zmiana stanu (inna ikona/kolor dla `stale`, `failed`, `connected`, `disconnected`).
- **Asercja:** Network PATCH → 200; UI zmienia się odpowiednio.
- **Odnotuj:** brak realnego redirect OAuth — to świadomy design (D-02 otwarta). Sprawdź czy UI ma label „Manual / Simulated" przy sekcji OAuth (lub odnotuj brak takiego labelu jako P2 UX).

### 7.4 Disconnect konektora [DB]

- Kliknij „Disconnect" dla aktywnego konektora.
- **Oczekiwane:** `POST /api/ai-connectors/:id/disconnect` → HTTP 200; status zmienia się na `disconnected`.
- **Asercja [DB]:** wiersz w `wave7_connectors` z `status = 'disconnected'`.

### 7.5 Tool Execution Test — read/search [DB]

- Wybierz konektor w statusie `connected`; wybierz **Tool Kind** = `search`; wpisz **Query** = `meeting follow-up`.
- Kliknij „Execute Tool".
- **Oczekiwane:** `POST /api/ai-connectors/execute` z `{connectorId, toolName, toolKind, query}` → HTTP 200; wyniki testu widoczne. (SSOT: `Api.executeWave7ConnectorTool` → `/ai-connectors/execute`; `connectorId` jest w **body**, NIE w ścieżce `/:id/execute`.)
- **Asercja [DB]:** wiersz w `wave7_connector_runs` z `toolKind = 'search'`.

### 7.6 Tool Execution Test — write/destructive (wymaga AIRun ID) [DB]

- Wybierz **Tool Kind** = `write`; brak `aiRunId` w formularzu.
- **Oczekiwane:** przycisk „Execute Tool" zablokowany lub API zwraca błąd „AI Run ID required for write/destructive tools".
- Wpisz poprawny `aiRunId`; kliknij Execute.
- **Oczekiwane:** `POST /api/ai-connectors/execute` z `{connectorId, toolName, toolKind:'write', aiRunId}` → HTTP 200. (connectorId w body — patrz §7.5.)

### 7.7 Real Source Binding — Link / Reindex [DB]

- Kliknij „Link" przy konektorze; wpisz `externalConnectorId`.
- **Oczekiwane:** `POST /api/ai-connectors/:id/link` z `{externalConnectorId}` → HTTP 200.
- Kliknij „Reindex".
- **Oczekiwane:** `POST /api/ai-connectors/:id/reindex` → HTTP 200; trigger reindeksowania.

### 7.8 Connector Health Dashboard

- Sprawdź sekcję Health Dashboard.
- **Oczekiwane:** dane z `GET /api/ai-connectors/health` — lista konektorów z `healthStatus`, freshnessAge, alerty.
- **Asercja:** `health` object renderowany; brak crasha gdy `health = null`.

### 7.9 ConnectorRun Audit

- Sprawdź listę Connector Runs.
- **Oczekiwane:** dane z `GET /api/ai-connectors/runs`; każdy run ma: konektor, tool kind, status, timestamp.

---

## §8 Panel Agents (`/ai/agents`) — `Wave8AgentCatalogPanel.tsx`

**Epik SC5:** Launch agent + run history.

### 8.1 Ładowanie katalogu agentów

- Otwórz `/ai/agents`.
- **Oczekiwane:** 4 równoległe żądania:
  - `GET /api/ai-agents/catalog` → lista definicji agentów
  - `GET /api/ai-agents/runs` → lista run-ów
  - `GET /api/ai-agents/schedules` → harmonogramy
  - `GET /api/ai-agents/notifications` → powiadomienia
- **Asercja w Network:** wszystkie 4 → HTTP 200.
- **Stan ładowania:** spinner → lista agentów (domyślnie zaznaczony `research-agent`) lub pusty stan.

### 8.2 Katalog agentów — wyświetlanie

- Sprawdź listę agentów z backendu (lub fallback na `research-agent`).
- Dla wybranego agenta sprawdź wyświetlane pola: `name`, `role`, `purpose`, `persona`, `allowedTools[]`, `blockedTools[]`, `approvalPolicy`, `costClass`, `riskLevel`, `examples[]`.
- **Asercja:** wszystkie pola renderowane; brak „undefined" ani pustych kart.

### 8.3 Launch agenta (bez swarm) [DB]

- Wybierz agenta z katalogu; wypełnij **Goal** = sensowny tekst; **Requested Tools** = `search_knowledge_base`; **Cadence** = `none`; wyłącz swarm.
- Kliknij „Launch".
- **Oczekiwane:** `POST /api/ai-agents/launch` z `{agentId, goal, requestedTools, schedule?, swarm?, approval?, evalRun?}` → HTTP 201 lub 200; nowy run pojawia się w Run History. (SSOT: `Api.launchWave8Agent` → `/ai-agents/launch`; `agentId` w **body**, NIE w ścieżce `/:id/launch`. Schedule/swarm/approval to **zagnieżdżone obiekty**, nie płaskie pola.)
- **Asercja [DB]:** wiersz w `wave8_agent_runs`.

### 8.4 Launch agenta z harmonogramem (daily/weekly) [DB]

- Wybierz **Cadence** = `weekly`; kliknij Launch.
- **Oczekiwane:** `POST /api/ai-agents/launch` z `{agentId, schedule:{cadence:'weekly'}}` → HTTP 200; harmonogram pojawia się w Schedules. (Cadence w zagnieżdżonym `schedule`, nie płaskie pole.)
- **Asercja [DB]:** wiersz w `wave8_agent_schedules` z `cadence = 'weekly'`.

### 8.5 Launch agenta z swarm [DB]

- Włącz **Swarm Mode**.
- Kliknij Launch.
- **Oczekiwane:** `POST /api/ai-agents/launch` z `{agentId, swarm:{enabled:true, approved:true, budgetApproved:true}}` → HTTP 200 lub 202. (Swarm to zagnieżdżony obiekt z polami `enabled/approved/budgetApproved`.)
- **Asercja:** odnotuj czy backend uruchamia swarm czy tylko planuje.

### 8.6 Scoped tool execution test [DB]

- Wybierz agenta; ustaw **Tool Name** = `search_knowledge_base`, **Tool Input** = `{"query":"strategy"}`.
- Kliknij „Execute Tool".
- **Oczekiwane:** `POST /api/ai-agents/tool` z body `{agentId, toolName, toolInput, aiRunId?, budgetApproved?}` → HTTP 200. (SSOT: `Api.executeWave8AgentTool` → `/ai-agents/tool`; `agentId` w **body**, NIE w ścieżce `/:id/tools/execute`.)
- **Uwaga:** dla mutujących toolów wymagany `aiRunId` — sprawdź walidację.

### 8.7 Edycja definicji agenta (editable=true) [DB]

- Wybierz agenta z `editable=true`; wypełnij **Definition Purpose**, **Allowed Tools** (CSV), **Blocked Tools** (CSV).
- Kliknij „Update Definition".
- **Oczekiwane:** `POST /api/ai-agents/definitions` z body `{definition: {agentId, purpose, allowedTools, blockedTools, ...}}` → HTTP 200/201; agent zaktualizowany. (SSOT: `Api.upsertWave8AgentDefinition` → `POST /ai-agents/definitions` (upsert), NIE `PATCH /:id/definition`; cała definicja owinięta w klucz `definition`.)
- **Asercja [DB]:** wiersz w `wave8_agent_definitions` z nowym `purpose`.

### 8.8 Process due schedules [DB]

- Kliknij „Process Due Schedules" (przycisk w sekcji Schedules).
- **Oczekiwane:** `POST /api/ai-agents/schedules/process-due` z body `{now?}` → HTTP 200; zaległe harmonogramy uruchamiane. (SSOT: `Api.processDueWave8AgentSchedules` → `/schedules/process-due`, NIE `/schedules/process`.)

### 8.9 Run History — przegląd

- Sprawdź listę runs; każdy run ma: `agentId`, `status`, `goal`, timestamp.
- **Asercja:** brak crasha gdy `runs = []`; list renders gracefully.

### 8.10 Notifications — przegląd

- Sprawdź listę notifications dla agentów.
- **Asercja:** `GET /api/ai-agents/notifications` → 200; lista lub pusty stan.

---

## §9 Panel Outcomes (`/ai/outcomes`) — `Wave9OutcomeAIOpsPanel.tsx`

**Epik SC6 → SC8 (KPI/ROI + Acceptance Gate).**

### 9.1 Ładowanie dashboardu

- Otwórz `/ai/outcomes`.
- **Oczekiwane:** żądania (na mount panel woła `listWave9Outcomes` + `getWave9AIOpsDashboard`):
  - `GET /api/ai-outcomes/outcomes` → lista outcomes (NIE `/ai-outcomes/`)
  - `GET /api/ai-outcomes/aiops` → dashboard KPI/ROI + AI Ops (NIE `/dashboard`; SSOT: `Api.getWave9AIOpsDashboard` → `/ai-outcomes/aiops`)
  - `GET /api/ai-outcomes/acceptance-runs` → lista acceptance runs (jeśli wołane przez panel)
- **Asercja w Network:** wszystkie → HTTP 200.

### 9.2 Tworzenie outcome KPI/ROI [DB]

- Wypełnij: **Title**, **Kind** = `kpi` lub `roi`, **Target Metric**, **Source Refs** (format `sourceType:sourceId:title` po jednym na linię).
- Kliknij „Create Outcome".
- **Oczekiwane:** `POST /api/ai-outcomes/outcomes` z pełnym body `{initiativeId, kpiName, baseline, target, confidence, assumptions, sourceRefs, ...}` → HTTP 201; nowy outcome pojawia się na liście. (SSOT: `Api.createWave9Outcome` → `/ai-outcomes/outcomes`, NIE `/ai-outcomes/`.)
- **Asercja [DB]:** wiersz w `wave9_outcomes`.

### 9.3 Value Report Builder

- Wybierz istniejący outcome; kliknij „Build Value Report".
- **Oczekiwane:** `POST /api/ai-outcomes/reports` z `{outcomeId, reportType}` → HTTP 200; raport widoczny. (SSOT: `Api.buildWave9Report` → `/ai-outcomes/reports`; `outcomeId` w **body**, NIE w ścieżce `/:id/report`. `reportType` ∈ `client_ready|investor_ready|steering_committee|ciso_security`.)
- **Asercja:** odpowiedź JSON z treścią raportu renderowana w UI.

### 9.4 AI Ops — Provider Health [DB]

- Otwórz sekcję AI Ops (zakładka lub sekcja w panelu).
- **Oczekiwane (odczyt):** lista providerów (np. OpenAI, Groq) z metrykami health pochodzi z **dashboardu** `GET /api/ai-outcomes/aiops` (pole providers/health). **Korekta:** NIE ma osobnego `GET /provider-health` (ścieżka jest POST-only).
- Kliknij „Register Health" dla providera → `POST /api/ai-outcomes/provider-health` z `{provider, status, ...}` → HTTP 201. (SSOT: `Api.recordWave9ProviderHealth`.)
- **Asercja [DB]:** wiersz w `wave9_provider_health`.

### 9.5 Incydenty (AI Ops) [DB]

- Kliknij „Create Incident".
- **Oczekiwane:** `POST /api/ai-outcomes/incidents` z body `{severity, title, ...}` → HTTP 201; incydent zliczany w dashboardzie. (SSOT: `Api.recordWave9Incident`. Uwaga: brak osobnego `GET /incidents` — odczyt przez `/aiops`.)
- **Asercja [DB]:** wiersz w `wave9_incidents`.

### 9.6 Eval Runs [DB]

- Kliknij „Create Eval Run".
- **Oczekiwane:** `POST /api/ai-outcomes/eval-runs` → HTTP 201.
- **Asercja [DB]:** wiersz w `wave9_eval_runs`.

### 9.7 Acceptance Runs — pięć typów [DB]

> **Korekta pól:** pole to **`runType`** (NIE `type`), a wartości to: `regression_pack`, `ciso_pack`, `business_persona_pack`, `compliance_audit`, `ai_ops_eval_pack` (SSOT: `Api.registerWave9AcceptanceRun`). Wcześniejsze `regression/ciso/persona/compliance` były niepoprawne.

Dla każdego z typów acceptance run (`runType`): `regression_pack`, `ciso_pack`, `business_persona_pack`, `compliance_audit`, `ai_ops_eval_pack`:

- Wypełnij formularz z odpowiednimi polami (`status`, `runRef`, `verifiedBy`, itd.).
- Kliknij „Submit Acceptance Run".
- **Oczekiwane:** `POST /api/ai-outcomes/acceptance-runs` z `{runType:'regression_pack', status:'pass', ...}` → HTTP 201.
- **Asercja [DB]:** wiersz w `wave9_acceptance_runs` z odpowiednim `runType`.

### 9.8 Final AI OS Acceptance Gate

- Kliknij „Run Final Acceptance Gate".
- **Korekta — funkcja-widmo:** NIE ma endpointu `/:id/final-gate`. Realnie: **`POST /api/ai-outcomes/acceptance`** (bez `:id`) z body flag `{regressionPassed, cisoPackPassed, businessPersonaPackPassed, providerHealthOk, complianceAuditPassed, openP0, openP1, evidenceRefs, acceptanceRunRefs?}` (SSOT: `Api.runWave9FinalAcceptance` → `/ai-outcomes/acceptance`). Powiązany odczyt acceptance-runs: `GET /api/ai-outcomes/acceptance-runs`.
- **Oczekiwane:** `POST /api/ai-outcomes/acceptance` → HTTP 200; wynik: PASS lub lista powodów blokady (z `reasonLabels` w pliku).
- Sprawdź, że powody blokady renderują się po polsku gdy język = PL (`isPolish = true`): np. „Pakiet regresji nie przeszedł." (nie angielski).
- **Asercja:** etykiety z `reasonLabels` właściwe dla aktywnego języka; brak `undefined`.

### 9.9 AI Ops Dashboard — metryki jakości

- Sprawdź ogólny Dashboard widok.
- **Oczekiwane:** agregowane metryki z `GET /api/ai-outcomes/aiops` (NIE `/dashboard`); wykresy lub liczby providerów, eval-runs, acceptance rate.
- **Asercja:** dane renderowane; brak crasha gdy `dashboard = null`.

---

## §CROSS Ścieżki cross-module

### C1 — AI OS → M01 Czat (Teresa) — ActionCenter ← ai_runs [DB]

- Otwórz M01 Czat (Teresa) i wyślij kilka wiadomości.
- Otwórz `/ai/action-center`.
- **Oczekiwane:** ActionCenter ładuje Run Ledger z `ai_runs` — powiązanie przez `aiRunLedgerService` (`ai.routes.ts:6013-6024`); Teresa run-y widoczne w ledger.
- **Asercja:** w Run Ledger widoczne rune z czatu; oba moduły używają wspólnej tabeli `ai_runs`.

### C2 — AI OS → M01 Czat — deep-link `?actionId=` [MANUAL]

- Z ActionCenter skopiuj `actionId` istniejącej akcji.
- Otwórz `/chat?actionId=<id>`.
- **Oczekiwane:** czat otwiera się i wyświetla kontekst/handoff powiązany z daną akcją.
- **Asercja:** `ActionCenter.tsx:49` deep-link działa.

### C3 — AI OS → M17 Outputs — Artifacts share token [MANUAL]

- Utwórz Wave 5 Artifact (§5.3); skopiuj `artifactId`.
- Otwórz `/api/public/artifacts/<token>` (public share token generowany przez `public-artifacts.routes.ts`).
- **Oczekiwane:** artefakt widoczny publicznie bez logowania.
- **Asercja w Network:** `GET /api/public/artifacts/:token` → HTTP 200.

### C4 — AI OS → M13 Inicjatywy — Wave 9 `initiative_id` FK [DB]

- Utwórz outcome z `initiative_id` (jeśli pole dostępne w formularzu lub jako `sourceRef`).
- Otwórz `/initiatives` i sprawdź, czy powiązanie jest widoczne.
- **Asercja [DB]:** wiersz w `wave9_outcomes` z wypełnionym `initiative_id`; powiązanie FK w `wave9OutcomeRuntimeService.ts:554+`.

### C5 — AI OS → M02 Canvas — Research Sessions compact mode [MANUAL]

- Jeśli `ResearchSessionsDock` jest osadzany w Canvas (`compact={true}`): sprawdź integrację z M02.
- **Oczekiwane:** tryb compact renderuje się bez crasha w kontekście Canvas.

### C6 — AI OS → M27 SuperAdmin — Virtual Workers Anna/Teresa

- W SuperAdmin (`/superadmin`) sprawdź panele konfiguracji Anny i Teresy.
- Wave 6 Memory (`/ai/context`) zasila kontekst Teresy.
- **Oczekiwane:** zmiany zatwierdzone w Wave 6 Memory Stewardship odzwierciedlają się w kontekście Teresy.
- **Asercja:** odnotuj flow (nie ma tu żądania do udowodnienia, ale logika jest w `wave6ContextLearningService.ts`).

---

## §MAP Mapa epików → sekcje (pokrycie 100%)

| Epik (teczka M22) | Story | Sekcja w tych testach |
|---|---|---|
| **Epik 1** — Integralność Artifacts-gate (L-01) | SC7: panel przy V8 off → czytelny komunikat (NAPRAWIONE — loadError obsłużony, regresja) | §5.1 |
| **Epik 2** — Czystość Gateway (L-02, STALE) | `_actionDecisionRoutes` = 0 wystąpień | §REGRESJA (grep) |
| **Epik 3** — Bezpieczeństwo testowane (L-04, T1) | non-dbr77 → 404 | §1.2.3 |
| **Epik 4** — Honest Wave 7 OAuth (L-05) | OAuth symulowany — label lub redirect | §7.3 |
| **Epik 5** — Szlif kanonu (L-06 i18n, L-07 §27, L-08 route-integration) | i18n, §27, testy backendowe | §PRZEKROJOWE + §REGRESJA |
| SC1 — Research Session E2E | create→approve→start→reload | §4.2–4.3, 4.8 |
| SC2 — Approve/Execute Action | Action Center full flow | §3.3–3.5 |
| SC3 — Wave 6 Memory persist | candidate→approve→reload | §6.5–6.7 |
| SC4 — Wave 7 Connector execute | register→execute tool | §7.2, 7.5 |
| SC5 — Wave 8 Agent launch | launch→run history | §8.3, 8.9 |
| SC6 — Security non-dbr77 | domain check 404 | §1.2.3 |
| SC7 — Artifacts V8 off | czytelny error | §5.1 |

---

## §PRZEKROJOWE testy przekrojowe

### P1 — DBR77 gating — kombinacje edge-case

- **Konto `@dbr77.com` z rolą MEMBER:** `canUseInternalTools` = false (rola spoza whitelist). Sprawdź sidebar i direct URL.
- **Konto `@dbr77.com` bez organizacji (no org):** `hasAllowedOrgName = false`. Sprawdź czy FE gate blokuje.
- **Token wygasły:** wywołaj API ze starym JWT → 401 (nie 404).
- **Cross-org IDOR:** zaloguj się jako user org A; spróbuj wywołać `GET /api/ai-connectors/` z `organizationId` org B w nagłówku. **Oczekiwane:** 404 lub odpowiedź pusta — serwis filtruje po `organizationId` z JWT, nie z nagłówka.

### P2 — V8 ON/OFF — Artifacts

- Przetestuj przełączenie `ENABLE_V8_GLOBAL` na staging (jeśli możliwe przez Railway Variables).
- **OFF:** §5.1 — panel widoczny, ale każda akcja → HTTP 404; sprawdź `loadError` state.
- **ON:** §5.2–5.8 — pełna funkcjonalność.

### P3 — i18n PL + EN [FLAG — znana luka L-06, DP-10 świadomy dług]

- Przełącz język na **PL** (ustawienia użytkownika lub `i18n.changeLanguage('pl')`).
- Otwórz każdy z 8 paneli AI OS.
- **Oczekiwane (cel):** wszystkie etykiety, przyciski, komunikaty błędów przetłumaczone na PL.
- **Stan obecny (luka L-06):** Wave 5–9 panele używają `isPolish = i18n.language?.startsWith('pl')` z warunkami inline — **NIE** `useTranslation`. `ActionCenter.tsx` i `ResearchSessionsDock.tsx` mają **zero** `useTranslation` — hardcoded EN.
- **Asercja:** odnotuj które stringi pozostają w EN po przełączeniu na PL; lista jako P2 finding (DP-10 = świadomy dług internal, NIE tłumaczyć v1).
- Przełącz na **EN** → sprawdź, że wraca do angielskiego.

### P4 — Dark mode

- Włącz dark mode (sidebar toggle lub systemowy).
- Otwórz każdy z 8 paneli AI OS.
- **Oczekiwane:** czytelność we wszystkich panelach — tekst, tła, ikony, formularze czytelne w dark mode (klasy `dark:` w `AIOSHub.tsx` zweryfikowane).
- **Asercja:** brak „white rectangle" ani nieczytelnego tekstu.

### P5 — A11y podstawowe

- Sprawdź focusowalność formularzy w każdym panelu (Tab, Enter).
- Sprawdź obecność `aria-label` na kluczowych przyciskach (Approve, Reject, Execute).
- Sprawdź, że Toast / komunikaty błędów mają `role="alert"` lub są ogłaszane przez screen-readera.

### P6 — Zero błędów w konsoli

- Podczas całej sesji testowej (§1–§9 + cross-module) = zero `console.error` i `console.warn` w DevTools.
- **Szczególna uwaga:** przy §5.1 (Artifacts V8 off) — sprawdź czy 404 jest cicho połknięty czy logowany jako error.

### P7 — Stan ładowania i błędu — graceful degradation

- Zablokuj sieć (DevTools → Network throttle „Offline") i odśwież każdy panel.
- **Oczekiwane:** każdy panel pokazuje komunikat błędu / timeout — brak white-screen ani nieskończonego spinnera.
- `ResearchSessionsDock.tsx`: timeout `LOAD_TIMEOUT_MS=12000` → komunikat użytkownikowi.
- `ActionCenter.tsx`: `error` state + `ledgerWarning` → UI feedback.

### P8 — Polling cleanup

- Otwórz `/ai/research-sessions` (auto-refresh 5s). Przejdź do innego modułu.
- **Oczekiwane:** polling zatrzymuje się po odmontowaniu komponentu (brak żądań do `/api/research/sessions` w tle po wyjściu).
- **Asercja w Network:** brak żądań research po przejściu na `/chat`.

---

## §REGRESJA testy regresji / automatyczne

### Uruchomienie istniejących testów jednostkowych

```bash
cd /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify
npx vitest run \
  tests/unit/backend/wave7ConnectorRuntimeService.test.ts \
  tests/unit/backend/wave8AgentRuntimeService.test.ts \
  tests/unit/backend/wave9OutcomeRuntimeService.test.ts \
  tests/unit/backend/researchSessionService.wave4-runtime.test.ts \
  tests/unit/backend/actionDecision.service.test.js \
  tests/integration/actionDecision.test.ts
```

**Oczekiwane:** wszystkie testy zielone. Odnotuj każdy FAIL z plikiem:linią.

### E2E smoke

```bash
npx playwright test tests/e2e/smoke/ai-os-route-matrix.spec.ts
```

**Oczekiwane:** 7 tras renderuje się poprawnie.

### Weryfikacja stanu kodu (grep)

```bash
# EPIK 2 — _actionDecisionRoutes powinien mieć 0 wystąpień (usunięty f35aa8d7c8, DP-7 descope)
grep -n "_actionDecisionRoutes" /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/server/src/Gateway.ts
# Oczekiwane: 0 wyników (STALE-zweryfikowane L-02)

# Hex tokeny w komponentach AI OS — powinno być 0
grep -rn "#[0-9a-fA-F]\{6\}" \
  /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/src/components/AIChat/AIOSHub.tsx \
  /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/src/components/AIChat/ActionCenter.tsx \
  /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/src/components/AIChat/ResearchSessionsDock.tsx
# Oczekiwane: 0 wyników

# Surowy <table> w AIOSWave0GateReport — znana luka L-07
grep -n "<table" /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/src/components/AIChat/AIOSWave0GateReport.tsx
# Oczekiwane: 1 wystąpienie (L-07 otwarta — odnotuj jako FAIL P2)

# i18n luka — isPolish inline w Wave panelach (5/9 plików — L-06, DP-10)
grep -rn "isPolish\|i18n\.language" \
  /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/src/components/AIChat/Wave5ArtifactRuntimePanel.tsx \
  /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/src/components/AIChat/Wave6ContextLearningPanel.tsx \
  /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/src/components/AIChat/Wave7ConnectorAdminPanel.tsx \
  /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/src/components/AIChat/Wave8AgentCatalogPanel.tsx \
  /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/src/components/AIChat/Wave9OutcomeAIOpsPanel.tsx
# Oczekiwane: ~5 wyników (świadomy dług DP-10 = akceptowalny w v1)
```

### Brakujące testy — backlog do dopisania (L-04, L-08)

| # | Plik docelowy | Priorytet |
|---|---|---|
| T1 | `tests/integration/routes/internalTools.middleware.test.ts` — non-dbr77.com → 404 | **P0** |
| T2 | `tests/integration/routes/wave6-context.routes.test.ts` | P1 |
| T3 | `tests/integration/routes/wave7-connectors.routes.test.ts` | P1 |
| T4 | `tests/integration/routes/wave8-agents.routes.test.ts` | P1 |
| T5 | `tests/integration/routes/wave9-outcomes.routes.test.ts` | P1 |
| T6 | `tests/unit/backend/wave6ContextLearningService.test.ts` | P2 |
| T7 | `tests/e2e/smoke/ai-os-artifacts-gate.spec.ts` — Artifacts V8 off → czytelny error | P1 |

---

## §FORMAT Format raportu + Definition of Done

### Format raportu (dla każdego punktu §1–§9)

```
§<numer>.<podnumer> <nazwa>
Kroki: [skrócony opis kroków]
Oczekiwane: [co powinno się stać]
Faktyczne: [co faktycznie się stało]
Status: PASS | FAIL | PASS_WITH_LIMITATIONS | BLOCKED
Dowód: [screenshot UI + URL żądania HTTP + status code + (opcjonalnie) [DB] wiersz tabeli]
Przy FAIL: plik:linia, opis przyczyny, propozycja fixu
```

### Znane otwarte defekty (nie FAIL przy testowaniu — odnotuj osobno)

| ID | Defekt | Priorytet | Status |
|---|---|---|---|
| L-01 | Artifacts panel przy V8 off — ~~cicha 404~~ NAPRAWIONE: `loadError` renderuje czytelny komunikat „ENABLE_V8_GLOBAL=true" + retry (`Wave5ArtifactRuntimePanel.tsx` ~:252–265) | P1 | **Zamknięta / regresja (przeklasyfikowane na PASS)** |
| L-04 | Brak testu middleware security (T1) | P0-test | Otwarta |
| L-05 | OAuth Wave 7 symulowany — brak labelu „Manual/Simulated" | P2 | Otwarta (D-02) |
| L-06 | i18n inline 5/9 Wave paneli | P2 | Świadomy dług DP-10 |
| L-07 | Surowy `<table>` w `AIOSWave0GateReport.tsx` | P2 | Otwarta |
| L-08 | Brak route-integration Wave 6–9 testów (T2–T5) | P1-test | Otwarta |

### Definition of Done (odhaczane przy akceptacji)

- [ ] 1. Wszystkie §1 Gating testy PASS (szczególnie SC6: non-dbr77 → 404)
- [ ] 2. Wszystkie SC1–SC5 PASS (Research/Action/Memory/Connector/Agent — lifecycle E2E)
- [ ] 3. §5.1 Artifacts V8 off — status L-01 odnotowany; test T7 dopisany lub istniejący błąd udokumentowany z screenshotem
- [ ] 4. Testy automatyczne (vitest + playwright smoke) — wszystkie zielone
- [ ] 5. Zero `console.error` w konsoli DevTools podczas całej sesji testowej
- [ ] 6. Polling cleanup (§P8) — PASS
- [ ] 7. Dark mode — wszystkie 8 paneli czytelne
- [ ] 8. Raport PASS/FAIL dla każdego z §1–§9 z dowodem (Network screenshot lub curl output)
