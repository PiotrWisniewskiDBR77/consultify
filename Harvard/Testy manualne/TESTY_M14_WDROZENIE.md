# TESTY — M14 Wdrożenie (Execution / Implementation)

> **Moduł:** M14 Wdrożenie (`/implementation`, alias `/execution`) — wg `Harvard/podzial/_MODULE_MAP_V2.md`
> **Zakres tej paczki:** pełen hub egzekucji inicjatyw — Executive Dashboard (Health Score), 3 widoki portfela (tabela/kanban/timeline), Action Queue, RAID log, zakładka Rollout (Plan/KPI/Risks/Change/Closure — trwałe dane), zakładka Raporty (generacja z live-data), Manager/people_change. Połączenia cross-module: M13→M14→M15, M14→M03, M14→M01.
> **Cel:** agent testujący weryfikuje każdą sekcję E2E — UI + stan + payload Network + stan DB. Bez potwierdzenia w Network każdy test trybu = FAIL.
> **Inwentarz:** `Harvard/podzial/inventory/INV_D_inicjatywy_wdrozenie_rezultaty_finanse.md` (sekcja WDROŻENIE, poz. 1–13)
> **Teczka:** `Harvard/wdrozenie-100/M14-wdrozenie.md` — epiki F1–F6, luki L-01–L-09, decyzje D-01/D-02
> **Karta audytu:** `Harvard/modules/M14-wdrozenie/KARTA_AUDYTU.md` — ocena 52/100, 7 scenariuszy S1–S7
> **Legenda:** `[MANUAL]` = ręczna weryfikacja (DnD / OAuth / incognito); `[FLAG]` = zależy od flagi ENV / roli; `[DB]` = dowód obejmuje wiersz w DB
> **Data:** 2026-06-16

---

## §0 Kontekst architektoniczny

### Komponenty i pliki źródłowe

| Obszar | Komponent | Plik |
|---|---|---|
| Główny hub | `ExecutionHub` | `src/components/Execution/ExecutionHub.tsx` (~5048 l.) |
| Widok kanban portfela | `ExecutionInitiativesKanbanView` | `src/components/Execution/ExecutionInitiativesKanbanView.tsx` |
| Widok timeline | `ExecutionTimelineView` | `src/components/Execution/ExecutionTimelineView.tsx` |
| Widok workload | `ExecutionWorkloadView` | `src/components/Execution/ExecutionWorkloadView.tsx` |
| Widok Manager | `ExecutionManagementView` | `src/components/Execution/ExecutionManagementView.tsx` |
| People Change Workspace | `PeopleChangeWorkspace` | `src/components/Execution/PeopleChangeWorkspace.tsx` |
| Zakładka Rollout | `RolloutTab` | `src/components/Execution/RolloutTab.tsx` |
| Widok dokumentu raportu | `ReportDocumentView` | `src/components/Execution/ReportDocumentView.tsx` |
| Generacja raportów | `reportContentGenerator` | `src/components/Reports/reportContentGenerator.ts` |
| Dokument inicjatywy (reuse) | `InitiativeDocumentView` | `src/components/Initiatives/InitiativeDocumentView.tsx` (lazy) |
| Podgląd inicjatywy | `InitiativePreviewV3` | `src/components/Initiatives/InitiativePreviewV3.tsx` |
| Backend — egzekucja | `ExecutionController` | `server/src/controllers/ExecutionController.ts` |
| Backend — portfel/CRUD | `pmo/execution.routes.ts` | `server/src/routes/pmo/execution.routes.ts` (5 verbs) |
| Backend — Rollout | `rollout.routes.ts` | `server/src/routes/rollout.routes.ts` (17 endpointów) |
| Backend — RAID | `raid.routes.ts` | `server/src/routes/raid.routes.ts` (10 verbs) |
| Backend — executive aggregate | `executiveAggregate.routes.ts` | `server/src/routes/executiveAggregate.routes.ts` |
| Backend — execution-control (V8) | `executionControl.routes.ts` | `server/src/routes/executionControl.routes.ts` |

### Mapa endpointów

| Grupa | Endpoint | Metoda | Opis |
|---|---|---|---|
| Dashboard | `GET /api/executive/aggregate?projectId=&period=` | GET | Health Score + snapshot |
| Portfolio health | `GET /api/execution/:projectId/health` | GET | portfolio health (PMO) |
| Action Queue | `GET /api/execution/:projectId/action-queue` | GET | overdue decisions/risks/tasks |
| Blockers | `GET /api/execution/:projectId/blockers` | GET | zablokowane zadania |
| Gate check | `POST /api/execution/:projectId/gate-check` | POST | Decision Gate check |
| Inicjatywy (lista) | `GET /api/pmo/initiatives` | GET | lista inicjatyw portfela |
| Status inicjatywy | `PATCH /api/pmo/initiatives/:id/status` | PATCH | zmiana statusu (kanban DnD) |
| RAID (lista/tworzenie) | `GET /api/raid` / `POST /api/raid` | GET/POST | lista i tworzenie pozycji RAID |
| RAID (edycja/usunięcie) | `PATCH /api/raid/:id` / `DELETE /api/raid/:id` | PATCH/DELETE | edycja i usunięcie |
| RAID heatmap | `GET /api/raid/heatmap` | GET | macierz ryzyk |
| RAID analytics | `GET /api/raid/analytics` | GET | agregaty RAID |
| Rollout KPIs | `GET/POST /api/rollout/kpis` | GET/POST | lista i tworzenie KPI |
| Rollout KPI | `PATCH/DELETE /api/rollout/kpis/:id` | PATCH/DELETE | edycja i usunięcie |
| Rollout KPI history | `GET /api/rollout/kpis/:id/history` | GET | time-series KPI |
| Rollout Risks | `GET/POST /api/rollout/risks` | GET/POST | lista i tworzenie ryzyk |
| Rollout Risk | `PATCH/DELETE /api/rollout/risks/:id` | PATCH/DELETE | edycja i usunięcie |
| Rollout Changes | `GET/POST /api/rollout/changes` | GET/POST | lista i tworzenie zmian |
| Rollout Change | `PATCH/DELETE /api/rollout/changes/:id` | PATCH/DELETE | edycja i usunięcie |
| Rollout Closures | `GET/POST /api/rollout/closures` | GET/POST | lista i tworzenie closure |
| Rollout Closure | `PATCH/DELETE /api/rollout/closures/:id` | PATCH/DELETE | edycja i usunięcie |
| Raporty (generacja) | `reportContentGenerator` (FE) | — | generacja z live-data (FE serwis) |
| Manager lanes | `GET /api/v8/execution-control/manager/...` | GET | [FLAG: ENABLE_V8_GLOBAL] |

### Zakładki ExecutionHub

| ID zakładki | Etykieta | ViewMode | Opis |
|---|---|---|---|
| `list` (default) | Portfolio | `table`/`kanban`/`timeline` | 3 widoki portfela |
| `rollout` | Rollout | — | 5 pod-tabów: Plan/KPI/Risks/Change/Closure |
| `reports` | Raporty | `table`/`grid` | katalog raportów + generacja |
| `people_change` | Manager | — | people change lanes, V8 [FLAG] |

### Stan globalny i zasada E2E

- `ExecutionHub` zarządza własnym stanem (`useState`): `activeTab`, `viewMode`, `initiatives`, `currentProjectId`, `activeFilters`, `activeStatusFilter`, `activeDocumentId`, `managerV8Degraded`.
- **Zasada weryfikacji E2E (obowiązkowa):** każda akcja modyfikująca dane (tworzenie/edycja/usunięcie/zmiana statusu) MUSI być potwierdzona:
  1. Żądaniem HTTP w zakładce Network (DevTools) — poprawny endpoint + metoda + payload.
  2. Odpowiedzią 200/201 z serwera (nie 400/500).
  3. Persistencją po hard-refresh strony (F5 / Ctrl+R) — dane muszą przetrwać przeładowanie.
- Sama zmiana wyglądu UI (aktualizacja DOM bez żądania) = FAIL testu.

### Role i gating

| Rola | Dostęp |
|---|---|
| `OWNER` / `ADMIN` | Pełny CRUD wszystkich sekcji |
| `MANAGER` | Pełny CRUD, widok Manager lanes [FLAG: ENABLE_V8_GLOBAL] |
| `USER` / `member` | Rollout CRUD (serwer przepuszcza — L-01!), brak Manager |
| Pilot VTS | `readOnly` w UI Rollout, serwer przepuszcza (luka L-01) |

---

## Setup środowiska testowego

1. Uruchom dev server (`npm run dev`) — frontend na `:3000`, backend na `:3001`.
2. Zaloguj się jako **OWNER DBR77** (pełny dostęp, brak beta-gatingu).
3. Upewnij się, że w org DBR77 istnieje co najmniej **3–5 inicjatyw** w statusie `EXECUTING` i co najmniej 1 w `BLOCKED`. Jeśli brak — stwórz z poziomu M13 (Inicjatywy → zmień status na EXECUTING).
4. Otwórz **DevTools → Network** (filtr: `/api/execution`, `/api/rollout`, `/api/raid`, `/api/executive`) + **Console** (zero błędów = wymóg).
5. Sprawdź zmienną `ENABLE_V8_GLOBAL` w `.env` — odnotuj wartość przed testami (decyduje o dostępności Manager lanes).
6. Przygotuj drugi login (rola `USER` — inny user tej samej org lub innej org) do testów cross-org i gating.
7. Wejdź na `/implementation` (lub `/execution` — powinien przekierować).

---

## §1 — Executive Dashboard (Health Score + snapshot)

*Epik F1 + Scenariusz S1 z karty audytu*

### 1.1 Ładowanie dashboardu i Health Score

- Wejdź na `/implementation` z `OWNER DBR77` zalogowanym.
- **Asercja UI:** panel dashboardu renderuje się — widoczne kafelki z KPI (np. „Active", „At Risk", „Completed", „Budget Health").
- **Asercja — żadnego 100% hardcode:** kafelek „Budget Health" musi pokazywać wartość obliczoną z danych DB (nie zawsze 100%). Sprawdź w DevTools → Network żądanie `GET /api/executive/aggregate?projectId=...` — odpowiedź JSON musi zawierać `overview.budgetHealth` jako liczbę inną niż statyczne 100, jeśli są jakiekolwiek wydatki. Commit `84757dc672` naprawił hardcode — zweryfikuj.
- **Asercja — live data (nie mock):** w payloadzie odpowiedzi musi być `overview.initiativeCount > 0` zgodnie z rzeczywistą liczbą inicjatyw EXECUTING w DB.
- W przypadku braku danych (0 inicjatyw EXECUTING) — dashboard ukrywa kafelek budżetu lub pokazuje „N/A" (nie 100%).

### 1.2 Kafelki KPI (Active / At Risk / Completed / Resources)

- **Active (Executing):** liczba powinna odpowiadać inicjatywom z `status=EXECUTING` w DB. Sprawdź Network odpowiedź — pole `initiatives.executingCount` lub `overview.executingCount`.
- **At Risk / Blocked:** liczba inicjatyw z `status=BLOCKED` lub sygnałem ryzyka z V8.
- **Completed:** inicjatywy z `status=DONE`.
- **Budget Health:** wartość `Math.max(0, Math.round(100 - (totalActual / totalBudget) * 100))` — niezerowa przy istnieniu wpisów budżetowych.
- Każdy kafelek musi być klikalny lub podświetlony interaktywnie (hover-state).

### 1.3 Filtry dashboardu

- **Filtr „Scope" (projekt):** zmień projekt w selektorze projektu (`currentProjectId`) — lista inicjatyw powinna się przefiltrować, a Network powinien wysłać nowe żądanie z innym `projectId`.
- **Filtr statusu (`activeStatusFilter`):** klik w chip statusu (np. „EXECUTING") → lista filtruje się do inicjatyw z tym statusem. Sprawdź że zmiana `activeStatusFilter` nie wysyła osobnego żądania HTTP — filtr jest klientem (dane już załadowane).
- **Asercja:** po kliknięciu filtra URL aktualizuje się (`?tab=list&status=EXECUTING`) lub state zmienia się widocznie.

### 1.4 Drill-down z dashboardu do szczegółów inicjatywy

- W widoku listy portfela kliknij w wiersz inicjatywy → otwiera się panel boczny `InitiativePreviewV3` (sidebar).
- **Asercja:** panel boczny zawiera sekcje: overview, taskProgress, status, właściciel.
- Klik „Otwórz pełny dokument" lub ikona `→` → otwiera `InitiativeDocumentView` (lazy-import; dokument inicjatywy reusowany z M13).
- **Asercja E2E:** dokument inicjatywy w M14 jest tym samym widokiem co M13 — treść identyczna z `/initiatives/:id`.

### 1.5 Baner degradacji PMO health / Action Queue [FLAG]

- Zablokuj endpointy `GET /api/execution/:projectId/health` i `GET /api/execution/:projectId/action-queue` (np. przez DevTools → Network → Block request URL lub testuj bez V8 dostępnego).
- **Asercja (luka L-02 — weryfikacja stanu):** aktualnie `catch→[]` bez banera — dashboard pokazuje puste wyniki bez komunikatu. Odnotuj jako KNOWN FAIL jeśli baner nie pojawia się.
- **Oczekiwane zachowanie docelowe:** widoczny baner „Dane health/kolejki niedostępne — spróbuj ponownie" zamiast cicho pustej sekcji.

---

## §2 — Widoki Portfela (Lista / Kanban / Timeline)

*Epik F1 + Scenariusz S2 z karty audytu*

### 2.1 Widok Lista (tabela FilterableTable)

- Zakładka domyślna — widok `list` z `viewMode=table`.
- **Asercja UI:** tabela wyświetla inicjatywy z kolumnami: Nazwa, Status, Postęp, Termin, Właściciel, Budżet.
- **Sortowanie:** klik w nagłówek kolumny „Status" → sortuje rosnąco; klik ponownie → malejąco. Stan sortowania widoczny (ikona ↑↓).
- **Filtrowanie:** klik w chip filtru (np. `EXECUTING`) → tabela odfiltruje się; klik w `BLOCKED` → tylko zablokowane. Kombinacja filtrów (AND).
- **Wyszukiwanie:** wpisz nazwę inicjatywy w searchbox → tabela pokazuje pasujące wyniki real-time (brak nowego żądania HTTP — filtrowanie klientem).
- **Preview panel:** klik w wiersz inicjatywy → otwiera `TableWithPreviewLayout` sidebar `InitiativePreviewV3`.
  - Sidebar zawiera: tytuł, status, postęp paska, listę kluczowych zadań, opis.
  - „Zamknij" (X) → sidebar znika, fokus wraca na tabelę.
- **Bulk bar:** zaznacz ≥2 inicjatywy checkboxami → pojawia się bulk-bar „N selected · Clear".
  - **Asercja (luka L-06 — KNOWN FAIL):** bulk-bar pokazuje TYLKO „N selected · Clear" bez akcji wsadowych. Odnotuj jako dług (epik F5, Z-14).

### 2.2 Widok Kanban (drag & drop statusów) [MANUAL]

- Przełącz widok → `viewMode=kanban` (ikona tablicy).
- **Asercja UI:** kolumny Kanban: `todo` / `in_progress` / `review` / `blocked` / `done` — każda z etykietą i liczbą kart.
- `data-testid="kanban-column-{id}"` musi istnieć w DOM dla każdej kolumny.
- **DnD (Manual):** uchwyć kartę inicjatywy, przesuń do kolumny „done" → puść.
  - **Asercja E2E:** Network pokazuje `PATCH /api/pmo/initiatives/:id/status` z ciałem `{ "status": "DONE" }` (lub mapowanym statusem z `KANBAN_STATUS_MAP`).
  - Odpowiedź 200 OK.
  - **Persistencja [DB]:** odśwież stronę → inicjatywa jest nadal w kolumnie „done" (status zachowany w DB).
- **DnD cancel (Manual):** uchwyć kartę, wróć do tej samej kolumny lub wciśnij Escape → status NIE zmienia się, brak żądania PATCH.
- **Asercja — brak zbędnych żądań:** DnD w obrębie tej samej kolumny nie wysyła żądania PATCH.

### 2.3 Widok Timeline (Gantt / daty) [MANUAL]

- Przełącz na `viewMode=timeline`.
- **Asercja UI:** linia czasu renderuje inicjatywy jako paski (Gantt) z datami `startDate` i `endDate`. Oś X = kalendarz (tygodnie/miesiące).
- Sygnały opóźnień (`DelaySignalItem`) i ryzyk (`RiskSignalItem`) widoczne jako znaczniki na linii czasu.
- **Hover na pasku:** tooltip z nazwą inicjatywy, datami, % postępu.
- **Klik pasku:** otwiera sidebar inicjatywy (jak w widoku listy).
- Jeśli inicjatywa nie ma dat → pasek pokazuje szary placeholder (brak crasha).

### 2.4 Przełączanie między widokami (stan zachowany)

- Będąc w widoku lista, ustaw filtr statusu „EXECUTING".
- Przełącz na kanban → filtr `EXECUTING` nadal aktywny (kanban pokazuje tylko EXECUTING).
- Przełącz na timeline → ten sam filtr.
- Wróć na lista → filtr nadal aktywny.
- **Asercja:** `activeStatusFilter` przeżywa zmiany `viewMode` — stan zachowany.
- **Asercja URL:** URL aktualizuje się przy każdej zmianie (`?tab=list&view=table`, `?tab=list&view=kanban`, `?tab=list&view=timeline`) — deep-link działa.

### 2.5 Widok z głębokiego linku do inicjatywy

- W pasku adresu wpisz `/implementation?initiativeId=<istniejące_id>` (lub `?tab=list`).
- **Asercja:** lista ładuje się, sidebar inicjatywy otwiera się automatycznie dla podanego ID.
- Nieistniejące ID → sidebar nie otwiera się, brak crasha, ewentualny komunikat „Nie znaleziono".

---

## §3 — Action Queue

*Epik F1 + Scenariusz S3 z karty audytu*

### 3.1 Ładowanie Action Queue

- W ExecutionHub znajdź sekcję Action Queue (w dashboardzie lub w dedykowanym panelu akcji).
- **Asercja Network:** żądanie `GET /api/execution/:projectId/action-queue` — odpowiedź zawiera tablice: `overdueDecisions`, `highRiskItems` (P×I), `overdueTasks`.
- Wyświetlenie każdej kategorii jako osobnej sekcji z liczbą elementów.
- **Asercja — live data:** elementy odpowiadają rzeczywistym przeterminowanym decyzjom/ryzykom/zadaniom z DB (sprawdź daty `dueDate < today`).

### 3.2 Pozycje Action Queue — interakcje

- **Przeterminowana decyzja:** klik na pozycję → otwiera detal decyzji (lub deeplink do M03 Decyzje).
- **Ryzyko P×I:** klik na ryzyko → otwiera detal RAID (lub sidebar).
- **Przeterminowane zadanie:** klik na zadanie → otwiera detal zadania.
- Każda pozycja ma: tytuł, właściciela, datę terminu, status „overdue" (wizualne wyróżnienie — np. czerwona ikona zegara).

### 3.3 Akcja na elemencie Action Queue

- Na przeterminowanej decyzji (jeśli dostępne inline): zmień status na „APPROVED" lub „DEFERRED".
  - **Asercja E2E:** `PATCH /api/my-work/decisions/:id` lub odpowiedni endpoint z `{ "status": "APPROVED" }`.
  - 200 OK → element znika z Action Queue (lub zmienia stan wizualny).
  - Po odświeżeniu — element nie wraca w tym samym stanie.
- **[DB]:** sprawdź w DB tabela `decisions` — `status` zmienione.

### 3.4 Cicha degradacja [FLAG]

- Gdy `GET /api/execution/:projectId/action-queue` zwróci błąd 500 (np. symulacja przez blokadę URL w DevTools):
  - **Asercja (luka L-02):** UI pokazuje pusty stan BEZ banera błędu. Odnotuj jako KNOWN FAIL.
  - Docelowe zachowanie: baner „Action Queue niedostępna" (epik F2 / Z-06).

---

## §4 — RAID (Risks, Assumptions, Issues, Dependencies)

*Scenariusz S4 z karty audytu*

### 4.1 Wyświetlanie RAID log

- W ExecutionHub znajdź sekcję RAID (widoczną w dashboardzie lub przez zakładkę inicjatywy).
- **Asercja Network:** `GET /api/raid?initiativeId=<id>` lub `GET /api/raid?projectId=<id>` — lista pozycji RAID z polami: `id`, `type` (risk/assumption/issue/dependency), `title`, `description`, `severity` (impact), `probability`, `riskScore`, `status`, `ownerId`, `dueDate`.
- Wyświetlenie per kategoria (4 zakładki lub sekcje: Risks / Assumptions / Issues / Dependencies).
- Liczniki pending/overdue widoczne w nagłówku zakładek.

### 4.2 Tworzenie pozycji RAID [DB]

- Klik „Dodaj ryzyko" (lub „Add Risk") → otwarcie formularza/modala.
- **Pola wymagane:** Tytuł (min 1 char), Typ (risk/assumption/issue/dependency), Opis.
- **Pola opcjonalne:** Prawdopodobieństwo (low/medium/high), Wpływ/Impact (low/medium/high), Właściciel, Termin.
- Wypełnij: `type=risk`, `title="Ryzyko testowe"`, `probability=high`, `impact=high`.
- Klik „Zapisz".
- **Asercja E2E:** `POST /api/raid` z payloadem `{ "type": "risk", "title": "Ryzyko testowe", "probability": "high", "impact": "high", "initiativeId": "<id>", "organizationId": "<orgId>" }`.
- Odpowiedź 201 z `{ "id": "<nowe_id>", "riskScore": <obliczona_wartość>, "scoreCategory": "critical"/"high"/... }`.
- **[DB]:** tabela `raid_items` — nowy wiersz z `organization_id = req.user.organizationId` (nie możliwość wstrzyknięcia cudzego orgId).
- Po zapisie element pojawia się natychmiast na liście (optimistic update lub re-fetch).

### 4.3 Edycja pozycji RAID [DB]

- Znajdź utworzoną pozycję RAID (z §4.2).
- Klik „Edytuj" (lub inline-edit) → formularz z załadowanymi danymi.
- Zmień `probability` z `high` na `medium`.
- Klik „Zapisz".
- **Asercja E2E:** `PATCH /api/raid/:id` z ciałem `{ "probability": "medium" }` (partial update).
- Odpowiedź 200 z zaktualizowanym `riskScore`.
- **Asercja — recalc ryzyka:** `riskScore` obliczony przez `calculateRiskScore(probability, impact)` z `raidScoringService` — sprawdź w Network że wartość zmieniła się.
- **[DB]:** tabela `raid_items` — `probability = 'medium'`, `updated_at` zaktualizowane.

### 4.4 Usunięcie pozycji RAID [DB]

- Na pozycji RAID klik „Usuń" (lub ikona kosza) → modal potwierdzenia.
- Potwierdź usunięcie.
- **Asercja E2E:** `DELETE /api/raid/:id`.
- Odpowiedź 200 lub 204.
- Pozycja znika z listy.
- **[DB]:** wiersz usunięty z `raid_items`.
- Odśwież stronę → pozycja nie wraca.

### 4.5 Walidacje RAID

- **Pusty tytuł:** klik „Zapisz" bez tytułu → błąd walidacji, formularz nie zamyka się. Brak żądania POST.
- **Prawdopodobieństwo poza zakresem:** jeśli formularz przyjmuje string — sprawdź że tylko low/medium/high jest akceptowane.
- **Brak wymaganego `type`:** błąd walidacji po stronie FE lub serwera (400).

### 4.6 Filtry per kategorię RAID

- Zakładka „Risks" — tylko elementy z `type=risk`.
- Zakładka „Issues" — tylko `type=issue`.
- Zakładka „Dependencies" — tylko `type=dependency`.
- Zakładka „Assumptions" — tylko `type=assumption`.
- Filtr nie wysyła nowego żądania HTTP — filtrowanie klientem (dane załadowane jednorazowo per inicjatywa).

### 4.7 Heatmapa ryzyk [MANUAL]

- Jeśli dostępna sekcja „Risk Heatmap" — sprawdź `GET /api/raid/heatmap?projectId=<id>`.
- **Asercja:** macierz 3×3 lub 5×5 (probability × impact) z liczbami ryzyk per komórkę.
- Klik na komórkę → filtruje listę do ryzyk w danym bucket.

### 4.8 Cross-org security RAID [DB]

- Zaloguj się jako admin org B.
- Pobierz `id` pozycji RAID należącej do org A.
- Wykonaj `PATCH /api/raid/<id_org_A>` bezpośrednio (przez curl / DevTools fetch).
- **Asercja:** odpowiedź 403 lub 404 (org A nie widoczna dla org B — `WHERE organization_id = req.user.organizationId`).

---

## §5 — Rollout (Plan / KPI / Risks / Change / Closure)

*Epik F1/F2 + Scenariusz S5 z karty audytu — kluczowy test persistencji (naprawa Rollout)*

### 5.1 Nawigacja do zakładki Rollout

- Klik w zakładkę „Rollout" w ExecutionHub (lub URL `?tab=rollout`).
- **Asercja:** `RolloutTab` renderuje się z 5 pod-zakładkami: „Master Plan", „KPI Tracking", „Risk Register", „Change Log", „Closure Checklist".
- Etykiety po polsku: `execution.rollout.plan.title` = „Master Plan" (lub PL jeśli language=pl).
- **Asercja Network:** przy wejściu w zakładkę Rollout wykonywane są żądania:
  - `GET /api/rollout/kpis?projectId=<id>&organizationId=<id>` — lista KPI
  - `GET /api/rollout/risks?projectId=<id>` — lista ryzyk
  - `GET /api/rollout/changes?projectId=<id>` — lista zmian
  - `GET /api/rollout/closures?projectId=<id>` — lista closure
- Wszystkie odpowiedzi 200 (brak 404 — rollout.routes.ts jest zamontowany w Gateway.ts:825).

### 5.2 KPI Tracking — CRUD [DB]

#### Tworzenie KPI
- Klik „Add KPI" (w `menuCta` per teczka — CTA przeniesione, nie w toolbar!).
- Formularz: Nazwa KPI, Baseline, Target, Aktualna wartość, Jednostka (np. %).
- Wypełnij: `name="Satysf. pracowników"`, `baseline=60`, `target=85`, `currentValue=65`, `unit="%"`.
- Klik „Zapisz".
- **Asercja E2E:** `POST /api/rollout/kpis` z payloadem `{ "name": "Satysf. pracowników", "baseline": 60, "target": 85, "currentValue": 65, "unit": "%", "projectId": "<id>" }`.
- Odpowiedź 201 z `{ "kpi": { "id": "...", ... } }`.
- **[DB]:** tabela `rollout_kpis` — nowy wiersz z `organization_id`.

#### Edycja KPI
- Klik „Edytuj" przy KPI → formularz z danymi.
- Zmień `currentValue` na 70.
- **Asercja E2E:** `PATCH /api/rollout/kpis/:id` z `{ "currentValue": 70 }`.
- 200 OK, wartość zaktualizowana w tabeli.
- **[DB]:** `current_value = 70`, `updated_at` aktualne.

#### Usunięcie KPI
- Klik „Usuń" → potwierdzenie → `DELETE /api/rollout/kpis/:id`.
- 200 OK, KPI znika.

#### Persistencja po reload [DB]
- Po utworzeniu KPI — naciśnij **F5** (hard refresh strony).
- **Asercja KLUCZOWA:** KPI wciąż widoczny na liście po przeładowaniu.
- To jest dowód naprawy Rollout (poprzednio dane ginęły na refresh — in-memory storage; teraz trwałe w `rollout_kpis` via `20260608_rollout_tables.sql`).

#### History time-series KPI
- Dla istniejącego KPI — sprawdź `GET /api/rollout/kpis/:id/history`.
- Odpowiedź zawiera tablicę `history` z historią wartości (jeśli backfill istnieje).

### 5.3 Risk Register (Rollout) — CRUD [DB]

- Klik „Add Risk" w zakładce Risks.
- Formularz: Tytuł, Prawdopodobieństwo (low/medium/high), Wpływ (low/medium/high), Właściciel.
- Wypełnij i zapisz.
- **Asercja E2E:** `POST /api/rollout/risks` z `{ "title": "...", "probability": "high", "impact": "medium", ... }`.
- 201 OK, ryzyko pojawia się na liście.
- Edycja: `PATCH /api/rollout/risks/:id` — zmień prawdopodobieństwo.
- Usunięcie: `DELETE /api/rollout/risks/:id`.
- **Persistencja [DB]:** odśwież → ryzyko przeżywa reload.
- **Derived risks:** gdy brak ręcznych ryzyk (`risks.length === 0`) ale `derivedRisks.length > 0` — zakładka pokazuje auto-derived ryzyko z sygnałów V8. Odnotuj czy widoczne.

### 5.4 Change Log — CRUD [DB]

- Klik „Add Change" w zakładce Change Log.
- Formularz: Tytuł zmiany, Opis, Status (planned/in_progress/completed/cancelled).
- Wypełnij i zapisz.
- **Asercja E2E:** `POST /api/rollout/changes` — 201 OK.
- Edycja status na „completed": `PATCH /api/rollout/changes/:id`.
- Usunięcie: `DELETE /api/rollout/changes/:id`.
- **Persistencja [DB]:** reload → zmiana przeżywa.

### 5.5 Closure Checklist — CRUD [DB]

- Zakładka „Closure Checklist".
- Klik „Add Closure item".
- **Asercja:** `POST /api/rollout/closures` — 201 OK.
- Toggle status (completed/pending): `PATCH /api/rollout/closures/:id`.
- **Persistencja [DB]:** reload → closure item przeżywa.
- **Derived closures:** gdy brak manualnych closure (`closures.length === 0`) ale `derivedClosures.length > 0` — auto-derived closure z inicjatyw w statusie DONE widoczne.

### 5.6 Master Plan (Plan)

- Zakładka „Master Plan" — lista etapów wdrożenia z inicjatywami.
- Jeśli zakładka jest read-only (dane z inicjatyw) — sprawdź że renderuje się bez błędów.
- Dla pilota VTS [FLAG]: Rollout CRUD zablokowany w UI (przyciski „Add" niewidoczne lub disabled). Serwer NADAL przepuszcza (`requireOrgRole('user')`) — luka L-01, odnotuj KNOWN GAP.

### 5.7 Org-scope isolation Rollout [DB]

- Wykonaj `GET /api/rollout/kpis` jako user z org B.
- **Asercja:** odpowiedź zawiera TYLKO KPI z org B (`WHERE organization_id = req.user.organizationId`). Brak KPI z org A.
- Próba `PATCH /api/rollout/kpis/<id_z_org_A>` jako org B → 404 lub 403.

### 5.8 Surowe `<table>` (dług §27) [MANUAL]

- W zakładkach Rollout — sprawdź DOM (DevTools → Elements).
- **Asercja (luka L-06 — KNOWN FAIL):** `RegisterTable` renderuje surowy element HTML `<table>` zamiast `FilterableTable`. Brak: preview rowu, filtrów, sortu, resize kolumn, kebab menu, bulk-bar.
- Odnotuj jako dług epiku F5 (Z-13 → sweep Faza 4 z DP-9).

---

## §6 — Raporty (generacja z live-data)

*Scenariusz S6 z karty audytu*

### 6.1 Katalog raportów

- Klik w zakładkę „Raporty" (lub `?tab=reports`).
- **Asercja UI:** wyświetla się katalog raportów — `viewMode=table` lub `viewMode=grid`.
- Presety w command-row: „ALL" (11), „Weekly" (4), „Monthly" (4), „Bi-weekly" (2), „On demand" (2), „Sponsor" (5).
  - **Asercja (luka L-07 — i18n):** etykiety presetów są hardcoded po angielsku (`'Weekly'`, `'Monthly'`, etc.) — nie korzystają z `t()`. Przy language=pl nadal angielskie. Odnotuj jako KNOWN dług.
- Filtr presetów działa klientem (nie wysyła HTTP).

### 6.2 Przełączanie widoków katalog (table / grid)

- Przełącz `viewMode` na grid → kafle raportów z ikonami i tagami.
- Przełącz z powrotem na table → lista.
- Żadne przełączenie nie wysyła nowego żądania HTTP.

### 6.3 Generator raportu (Wizard) — generacja z live-data

- Klik „Nowy raport" lub „Generate" → otwiera wizard generatora.
- **Krok 1 — Typ raportu:** wybierz typ (np. „Status Report" / „Executive Summary" / „Risk Report").
- **Krok 2 — Zakres:** wybierz inicjatywy / projekt / zakres dat (`periodFrom`, `periodTo`).
- **Krok 3 — Generuj:** klik „Generate".
- **Asercja kluczowa — live data (nie mock):** funkcja `generateReportDocument(...)` z `reportContentGenerator.ts` wywołana z `reportDataContext` zawierającym dane z DB (initiatives, tasks, decisions).
- **Asercja — brak fabrykowanych liczb:** wygenerowany raport NIE może zawierać hardcoded numerów niezwiązanych z danymi (np. „inicjatywy: 42" gdy DB ma 5). Sprawdź że liczby w raporcie odpowiadają danym z DB.
- Raport pojawia się w katalogu jako wpis z `type=wizard`.

### 6.4 Wyświetlanie wygenerowanego raportu

- Klik w raport z katalogu → otwiera `ReportDocumentView`.
- **Asercja:** treść raportu renderuje się (nie biały ekran, nie „Loading...").
- Dla raportu wygenerowanego przez AI (`handleGenerateReport`):
  - **Asercja E2E:** wywołanie do `reportContentGenerator` z `isPolish` flagą (jeśli `i18n.language==='pl'`).
  - Treść raportu w odpowiednim języku (PL lub EN).
- Przycisk „Wróć" / „Back" → powrót do katalogu.

### 6.5 Typy raportów (pokrycie)

Sprawdź każdy dostępny typ w katalogu:
- **Status Report** — status inicjatyw, % wykonania.
- **Progress Report** — timeline, milestones.
- **Risk Report** — RAID summary, heatmapa.
- **Executive Summary** — dla Sponsor/Steering.
- **Resource Report** (jeśli dostępny) — workload.
- Każdy typ generuje treść inną od innych (nie identyczny szablon).

### 6.6 Eksport raportu (PDF / DOCX)

- W `ReportDocumentView` szukaj przycisku „Eksportuj PDF" lub „Pobierz DOCX".
- Klik „Eksportuj" → plik pobiera się.
- **Asercja:** plik nie jest pusty (rozmiar > 0 kB), otwiera się poprawnie.
- Jeśli eksport nie jest zaimplementowany — sprawdź czy przycisk jest disabled lub ukryty (nie crashuje).

### 6.7 Czat Teresy z kontekstem egzekucji (handoff)

- W ExecutionHub klik otwiera panel czatu Teresy.
- **Asercja Network:** żądanie do chatu zawiera kontekst egzekucji (`lane: 'execution_reports'` lub `'execution_portfolio'`) — sprawdź payload `ExecutionHub.tsx:1683`.
- Wpisz: „Podsumuj stan portfela wdrożeń."
- Teresa odpowiada z realnymi danymi (nazwy inicjatyw, liczby z DB — nie hallucynacje).
- **Asercja:** odpowiedź Teresy zawiera `executingCount`, nazwy inicjatyw z aktualnego portfela.

---

## §7 — Manager / People Change

*Scenariusz S7 z karty audytu — zależy od flagi `ENABLE_V8_GLOBAL`* [FLAG]

### 7.1 Gating V8 — baner degradacji

- Z `ENABLE_V8_GLOBAL=false` (lub niedostępne V8) wejdź w zakładkę „Manager" (`?tab=people_change`).
- **Asercja (commit `229cb35565`):** pojawia się amber baner „Manager wymaga V8 — niedostępne w tej konfiguracji" (lub podobny). NIE puste lanes bez komunikatu.
- Baner zawiera informację jak włączyć (`ENABLE_V8_GLOBAL=true` lub kontakt admina).
- `managerV8Degraded=true` → `ExecutionManagementView` renderuje z `v8Degraded={true}`.

### 7.2 Manager lanes (z `ENABLE_V8_GLOBAL=true`) [FLAG]

- Wymagany: restart dev server z `ENABLE_V8_GLOBAL=true` lub środowisko z włączonym V8.
- Wejdź w zakładkę „Manager".
- **Asercja Network:** `getManagerProblems(laneId, projectId)` → `GET /api/v8/execution-control/manager/<laneId>?projectId=<id>`.
  - Sprawdź że `V8ExecutionControlApi.getManagerProblems` wysyła żądania dla każdej z lanes: `action-queue`, `decisions`, `blockers`, `workload`, `risk`, `people-change`.
  - Odpowiedzi 200 (nie 404).
- **Asercja UI:** dla każdej lane widoczna lista elementów (nie puste).
- Jeśli V8 dostępne ale `getManagerProblems` zwraca 404 — `catch→[]` bez banera (luka L-02, KNOWN FAIL).

### 7.3 People Change lanes

- W zakładce Manager znajdź sekcję „People Change" (change management, komunikacja, training, resistance).
- **Asercja UI:** widoczne lane'y: Communication, Training, Resistance, Champions.
- Klik na element people-change → otwiera detal (lub sidebar).

### 7.4 AI recommendation panel [FLAG]

- Jeśli V8 dostępne — szukaj panelu AI rekomendacji w Manager.
- Klik „Generuj rekomendację" → żądanie do AI.
- **Asercja:** treść rekomendacji oparta na danych aktualnych inicjatyw (nie generyk).

### 7.5 Przypisanie ról do osób (RACI)

- W dokumencie inicjatywy (otwartym z M14) — zakładka „Team / RACI".
- Dodaj osobę do roli „Manager" lub „Change Lead".
- **Asercja E2E:** `PATCH /api/pmo/initiatives/:id` lub dedykowany endpoint z danymi RACI.
- **[DB]:** zmiana zapisana.

---

## §8 — Ścieżki cross-module

### 8.1 M13 → M14: inicjatywa APPROVED/EXECUTING → widok w portfelu

- W M13 (Inicjatywy) zmień status inicjatywy na `EXECUTING`.
- **Asercja E2E:** `PATCH /api/pmo/initiatives/:id/status { "status": "EXECUTING" }`.
- Przejdź do M14 (`/implementation`) — inicjatywa widoczna w portfelu w odpowiedniej kolumnie (lista/kanban).
- Sprawdź że Health Score dashboardu odzwierciedla nową inicjatywę (`executingCount++`).

### 8.2 M14 → M03: Action Queue → Zadania w My Work

- W Action Queue znajdź przeterminowane zadanie.
- Klik → sprawdź czy otwiera detal zadania z M03 (deep-link `?taskId=<id>` do `/my-work/tasks`).
- **Asercja:** URL zmienia się na `/my-work/tasks?taskId=<id>` lub otwiera sidebar z zadaniem.
- Ewentualnie EventBus (`mywork-open-item`) zamiast nawigacji.

### 8.3 M14 → M15: Rollout DONE → Rezultaty (feed-forward)

- W M14 zmień status inicjatywy na `DONE` (przez kanban lub PATCH).
- Przejdź do M15 (`/benefits`) — sprawdź status.
- **Asercja (luka L-05 — KNOWN FAIL / DP-6):** feed-forward M14→M15 jest aktualnie martwy (brak exportu sygnałów ROI). M15 jest beta-CLOSED (`D-01`). Odnotuj jako KNOWN GAP z komunikatem „preview" jeśli widoczny.
- Sprawdź czy w ExecutionHub widoczny jest komunikat „preview" zamiast przycisku sync (per DP-6).

### 8.4 M14 → M01: Czat o wdrożeniu

- W ExecutionHub otwórz czat Teresy (ikona czatu).
- Wyślij wiadomość: „Jakie inicjatywy są zagrożone?"
- **Asercja Network:** payload zawiera `lane: 'execution_portfolio'` + kontekst egzekucji (`entityId`, `entityType: 'execution'`).
- Teresa odpowiada z danymi z portfela (inicjatywy BLOCKED lub at-risk).

### 8.5 Panel boczny inicjatywy (reuse z M13)

- Otwórz detal inicjatywy z poziomu M14 (klik w wiersz → sidebar lub pełny dokument).
- **Asercja:** dokument inicjatywy pokazuje wszystkie sekcje: overview, problemDefinition, scope, tasks, RAID (osobny `raid_items`), decisions, KPIs, gates, timeline.
- Edycja w dokumencie (np. zmiana opisu) → `PATCH /api/pmo/initiatives/:id`.
- Zmiany widoczne w M13 po powrocie (ten sam widok).

---

## §9 — Mapa epików (pokrycie pełne)

| Epik | Scenariusz | Sekcja testu |
|---|---|---|
| **F1 — Integralność danych** (DONE, L-09 naprawione) | S1–S5 | §1–§5 |
| **F2 — Gating + degradacja** (L-01/L-02/L-03) | S1/S3/S7 | §1.5, §3.4, §7.1–7.2, §4.8 |
| **F3 — Feed-forward M14→M15** (L-05, DP-6) | S5 | §8.3 |
| **F4 — Testy** (L-08) | S2/S5/S6 | §9 regresja |
| **F5 — §27 + i18n** (L-06/L-07, DP-8/9) | S5/S6 | §5.8, §6.1 i18n |
| **F6 — Cleanup martwego kodu** (L-04, D-02) | — | §10 martwy kod |

---

## §10 — Martwy kod (weryfikacja)

### 10.1 Pliki do usunięcia (L-04)

Wykonaj grepy, potwierdź że następujące pliki NIE są importowane w żadnym aktywnym komponencie:

```bash
grep -rn "ImplementationView" src/ --include="*.tsx" --include="*.ts"
grep -rn "ExecutionView" src/views/ --include="*.tsx"
grep -rn "ExecutionDetailPanel" src/ --include="*.tsx" --include="*.ts"
```

- `ImplementationView.tsx` — importowany ale nigdy renderowany → kandydat do usunięcia.
- `views/ExecutionView.tsx` — hardcode `projectId="default"` → martwy.
- `ExecutionDetailPanel.tsx` → martwy.

**Asercja:** brak aktywnych konsumentów = bezpieczne usunięcie (per DP-7).

### 10.2 Kandydaci do weryfikacji (D-02 = wytnij, DP-5 = za flagą)

```bash
grep -rn "PeopleChangeWorkspace\|RiskSignalsPanel\|DelayDetectionPanel\|ReportCompactPanel" src/ --include="*.tsx" | grep -v "__tests__"
```

Odnotuj wyniki — czy któryś jest aktywnie importowany i renderowany?

---

## §11 — Testy przekrojowe

### 11.1 Persistencja (kluczowy wymóg Rollout)

- **Test 5-punktowy Rollout:** stwórz po 1 rekordzie w każdym z 5 rejestrów Rollout (Plan / KPI / Risks / Change / Closure) → zamknij browser → otwórz ponownie → wszystkie 5 rekordów przeżyło.
- **[DB]:** weryfikacja bezpośrednia: `SELECT * FROM rollout_kpis WHERE organization_id=<id>` powinno zwrócić rekordy.

### 11.2 Disabled states podczas ładowania

- Przy `isLoading=true` (wolne łącze / throttle w DevTools) — przyciski Create/Save/Generate muszą być `disabled`, spinner widoczny.
- Brak podwójnego submitu (klik wielokrotny podczas loading → tylko 1 żądanie HTTP).

### 11.3 i18n (PL / EN)

- Zmień język na **PL** (ustawienia → język → Polski) — sprawdź M14:
  - Tytuły zakładek Rollout po polsku: „Master Plan", „Śledzenie KPI", „Rejestr ryzyk", „Dziennik zmian", „Zamknięcie".
  - **Asercja (luka L-07):** ~141 kluczy PL brakuje w `translation.json` — fallback do angielskich etykiet. Odnotuj konkretne przykłady jako KNOWN FAIL.
  - `isPolish` flag w `ExecutionHub.tsx:564` wpływa na `generateReportDocument` — raporty po PL.
- Zmień na **EN** → etykiety angielskie. Żaden tekst nie zostaje po polsku (brak `isPolish` leakage).

### 11.4 Dark mode

- Przełącz na dark mode (ustawienia lub system).
- **Asercja:** wszystkie sekcje M14 czytelne w dark mode — brak białych tekstów na białym tle, brak niezmienionych `#ffffff` hardcode w `ExecutionHub.tsx`.
- Sprawdź 7 hex w `src/components/Execution/` (grep `2026-06-13` z teczki) — czy są to palety wykresów (legalne per DP-8) czy UI-chrome hardkod.

### 11.5 Zero błędów konsoli

- Przez cały czas testowania konsola DevTools = zero błędów (Warning dozwolone).
- **Krytyczne:** brak `Uncaught TypeError`, brak `Cannot read property of undefined`, brak `ResizeObserver loop error` (jeśli bez obsługi).
- `ENABLE_V8_GLOBAL=false` → brak `console.error` o 404 (powinien być obsłużony przez `catch`).

### 11.6 A11y (dostępność)

- Wszystkie przyciski mają `aria-label` lub czytelny tekst (nie samo ikona bez opisu).
- Modale (`dialog`) mają `aria-modal="true"` i `aria-labelledby`.
- Fokus po zamknięciu modala wraca do triggera.
- Nawigacja klawiaturowa przez zakładki Rollout (Tab → Enter / Spacja).

### 11.7 Wydajność (N+1 alert)

- Otwórz zakładkę Rollout z projektId ustawionym.
- **Asercja:** 4 żądania GET (kpis/risks/changes/closures) — maksymalnie równoległe (Promise.all), nie sekwencyjne.
- Dashboard: `GET /api/executive/aggregate` = 1 żądanie (nie N żądań per inicjatywę).
- `ExecutionHub` puli inicjatyw nie ładuje N+1 razy przy przełączaniu widoków.

---

## §12 — Regresja (testy automatyczne do uruchomienia)

Uruchom lokalnie przed każdym PR do `Londyn`:

```bash
# Z katalogu projektu
npx vitest run src/components/Execution/__tests__/RolloutTab.smoke.test.tsx
npx vitest run src/components/Execution/__tests__/ManagerApproval.smoke.test.tsx
```

**Oczekiwane wyniki (ze stanu 2026-06-13, 633 PASS / 23 FAIL):**

| Test | Stan | Komentarz |
|---|---|---|
| `RolloutTab.smoke` | 2 FAIL | CTA „Add KPI" przeniesione do `menuCta` — UI-drift, selektor nieaktualny (L-08) |
| `ManagerApproval.smoke` | — | Sprawdź aktualny stan |
| `PeopleChangeWorkspace` unit | 3 FAIL | mock-drift `react-i18next` — `t(key,{defaultValue})` vs mock pozycyjny (L-08) |
| BE rollout.routes | BRAK | Brak `rollout.routes.test.ts` — najwyższy priorytet testowy (P0-test, Z-09) |
| execution-center E2E | 6/10 FAIL | `status-filter-EXECUTING` nie istnieje; handoff `/benefits` blokowany beta-M15 (L-08) |

**Do napisania (L-08, Z-09/Z-10):**
- `server/src/routes/__tests__/rollout.routes.test.ts` — testy BE S5 trwałości (CRUD × 5 rejestrów).
- Kanban DnD test (S2) — brak pokrycia.
- `executionReports` test (S6) — brak pokrycia.

---

## §13 — Format raportu testowego

Dla każdej sekcji (§1–§8) wypełnij:

```markdown
### [Mxx.Y] <Nazwa testu>
- **Status:** PASS / FAIL / SKIP / KNOWN FAIL
- **Dowód UI:** <opis stanu ekranu lub screenshot>
- **Dowód Network:** <endpoint + metoda + status HTTP + kluczowe pola payload>
- **Dowód DB:** <wynik zapytania SQL lub opis weryfikacji> [opcjonalne dla §4/§5]
- **Komentarz:** <opis problemu jeśli FAIL, numer luki jeśli KNOWN FAIL>
```

**Przykład:**

```markdown
### [M14.3.2] Tworzenie KPI Rollout — persistencja
- **Status:** PASS
- **Dowód UI:** Formularz zamknął się, KPI „Satysf. pracowników" widoczny na liście.
- **Dowód Network:** POST /api/rollout/kpis → 201 { "kpi": { "id": "abc123", ... } }
- **Dowód DB:** SELECT * FROM rollout_kpis WHERE id='abc123' → 1 wiersz z organization_id='org_DBR77'
- **Komentarz:** Persistencja potwierdzona po F5 (naprawa vs stan sprzed 2026-06-08).
```

---

## §14 — Definition of Done (DoD) M14

Test M14 jest **zaliczony** gdy:

1. **Integralność danych:**
   - Health Score obliczony z DB (nie 100% hardcode) — commit `84757dc672` zweryfikowany live.
   - Cross-org write budżetu: org-scope `AND organization_id` w `recalcInitiativeActualTotal` — commit `b9f2dee9d2` zweryfikowany (read-only proof przez próbę PATCH cross-org → 403/404).
   - `task_dependencies` 2-step org verify — commit `9974596da7` zweryfikowany.

2. **Rollout trwałość:**
   - 5 rejestrów Rollout (KPI/Risk/Change/Closure/Plan) przeżywają hard-refresh przeglądarki — dowód DB.

3. **RAID CRUD:**
   - Pełny cykl add/edit/delete dla typu `risk` z potwierdzeniem w Network i DB.

4. **Kanban DnD:**
   - Zmiana statusu inicjatywy przez DnD → `PATCH /api/pmo/initiatives/:id/status` → trwałość po reload.

5. **Raporty live-data:**
   - Co najmniej 1 wygenerowany raport z danymi niefabrykowanymi (liczby z DB).

6. **Manager degradation:**
   - Baner amber gdy `ENABLE_V8_GLOBAL=false` — commit `229cb35565` zweryfikowany.

7. **Zero crash:**
   - Żadna sekcja nie powoduje białego ekranu (white screen of death).
   - Konsola bez `Uncaught` błędów.

8. **i18n:**
   - `isPolish=true` → raporty generowane po polsku.
   - Luki (`~141 kluczy PL`) udokumentowane jako KNOWN FAIL z epiku F5.

**Znane FAIL (nie blokują zaliczenia — dokumentacja wystarczy):**
- L-01: pilot CRUD tylko w UI (serwer przepuszcza) — dokumentacja KNOWN GAP.
- L-02: cicha degradacja PMO health/action-queue bez banera — dokumentacja KNOWN FAIL.
- L-06: 5 tabel Rollout jako surowy `<table>` (poza §27) — dokumentacja długu.
- L-07: ~141 kluczy PL brak — dokumentacja z przykładami.
