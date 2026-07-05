# M13 — SZEROKA ANALIZA NA REALNYCH DANYCH (demo, org Piotra) · 2026-06-23

> Metoda: zasilona org demo Piotra (`a3e05d4a`, baza Railway **demo — NIE prod**) → 5 inicjatyw `[M13SEED]` + flagowa „Automatyzacja onboardingu HR" (4 taski, łańcuch zależności, 3 decyzje GO_NO_GO/budżet/zakres). Zdjęcia: demo SPA nie hydratuje headless-cold → **lokalny frontend (renderuje) + proxy `/api`→demo (realne dane) + Bearer-auth Piotra**. **24 zdjęcia** w `docs/qa/screens/m13-exec/real-*.png`. Ocena **dwukryterialna (jakość + grafika)** przez 3 agentów-audytorów.

---

## Werdykty zbiorcze (per artefakt)

| Artefakt | Zdjęcia | PASS | Werdykt |
|---|--:|--:|---|
| **Inicjatywy** (hub kanban/grid/timeline/analysis/dark/light + dokument + sekcje gates/raid/kpis/financial) | 11 | 9 | 🟢 z 2 do live-verify |
| **Taski** (sekcja §27 + dark/light) | 3 | 3 | 🟢 PASS |
| **Decyzje** (sekcja + GO_NO_GO banner + dark/light) | 3 | 3 | 🟢 PASS (wzorcowe) |
| **Kalendarz** (month/week/dark/light) | 4 | 4 | 🟢 PASS |
| **Gantt** (deps/critical + zoom day/month) | 3 | bary+zoom ✅ / deps ❌→naprawione | 🟡 bug danych naprawiony |
| **Notyfikacje** (centrum in-app) | 1 | render ✅ / treść ❌ | 🟡 artefakt headless |

**Potwierdzone twardo (realne dane, zalogowany jako Piotr Wiśniewski):** hub z 5 seedami + 82 istniejącymi rozłożonymi po statusach; flagowa otwiera dokument 26-sekcji; Tasks §27 (4 taski, statusy todo/in_progress, daty czerwcowe); **Decisions z amber gate-banner GO_NO_GO + 4 decyzje**; Kalendarz z chipami tasków na właściwych dniach; dark/light spójne wszędzie. **Brak naruszeń „no danger-fill"** — cała czerwień (overdue, Overallocated 4500%, BLOCKED gate, markery Gantt=brand) UZASADNIONA.

---

## DEFEKTY znalezione (z root-cause + statusem)

### 🔴 D1 — Gantt: linie zależności + ścieżka krytyczna NIEWIDOCZNE → NAPRAWIONE (bug Postgres)
- **Objaw:** na 3 zdjęciach Gantt agent widzi bary + działający zoom (day szerszy / month węższy), ale **brak linii zależności (SVG) i wyróżnienia ścieżki krytycznej** — sztandarowych funkcji V1.
- **Root-cause (zbadany, nie zgadywany):** `task.dependsOnId` z seedu nie zapisał się; dependencies tworzone przez `POST /tasks/:id/dependencies` (201 OK), ALE `GET /:id/task-dependencies` zwracał `sourceTaskId:"undefined"`, `taskId:"undefined"` — **node-pg zwija niecytowane aliasy SQL do lowercase** (`as fromTaskId`→`fromtaskid`), a `getInitiativeTaskDependenciesRead` czytał `row.fromTaskId` (camelCase) → `undefined` → `String(undefined)="undefined"`. FE dostawał śmieci → `ganttDependencies=[]` → zero linii. Klasyk [[finding_pg_bigint_jsonb_serialization]].
- **Status:** ✅ **NAPRAWIONE** — `planningPortfolioReadService.getInitiativeTaskDependenciesRead` czyta case-robust (`row[k] ?? row[k.toLowerCase()]`); 3 testy (Postgres-lowercase + SQLite-camelCase + org-scope). **Wizualny dowód na demo wymaga re-deployu** (demo ma stary build) — po deployu Gantt pokaże linie+ścieżkę (dane zależności już zasiane). Sama funkcja V1 (SVG+computeCriticalPath) potwierdzona component-testami.

### ✅ D1b — Gantt linie zależności: architektoniczny rozjazd FE → ROZWIĄZANE (opcja A)
- **Naprawione 2026-06-23 (CTO, opcja A):** `TimelinePlanner` (główny widok) dostał prop `dependencies` i wyprowadza `row.dependsOnId` z `task_dependencies` (mapa successor→predecessor; ręczne `rowOverrides` nadal wygrywają). Plus naprawiony `ganttDependencies` w InitiativeGantt (`sourceTaskId`+dedup).
- **Dowód end-to-end (DOM, realne dane demo):** `{plannerDep:3, igDep:3, critRings:3}` — OBA Gantty rysują 3 linie zależności (Analiza→Projekt→Wdrożenie/Szkolenie) + ścieżka krytyczna 3 węzły. Test `m13-demo-proxy` „linie zależności…" ZIELONY. Regresja: 24/24 (Gantt+TimelineSection+computeCriticalPath). tsc clean.
- Zrzut: `real-gantt-deps-FIXED.png`. (Linie cienkie/subtelne przy pełnej skali strony — to konektory `stroke-dasharray`/`#94a3b8`, nie bary.)

### (historyczne) 🟠 D1b — diagnoza rozjazdu (przed naprawą)
- **Co odkryte po deployu D1:** endpoint `task-dependencies` zwraca już realne ID (D1 ✅, zweryfikowane live na demo: 6 wpisów z `sourceTaskId/taskId` 4 tasków flagowej). MIMO TO linie nie renderują (DOM: 0 `<path stroke=#94a3b8|#f43f5e>`, 0 `ring-rose-400`).
- **Root-cause (zdiagnozowany do dna):** **DWA Gantty + DWA źródła zależności w FE:**
  - `TimelinePlanner.TimelineGanttView` (`TimelinePlanner.tsx:3920`) = **główny widok** — rysuje linie z **ręcznego `row.dependsOnId`** (schedulingMode `after_previous`, edytor Table). **NIE czyta** kontekstu `dependencies`/task_dependencies.
  - `InitiativeGantt` (`scheduleView='gantt'`, funkcje V1 `a8cfca1df4`) = czyta kontekst `dependencies` (task_dependencies). **Naprawione tu** (`TimelineSection.ganttDependencies`: czytał `sourceId` zamiast `sourceTaskId` + brak dedup 2 kierunków → `[]`; teraz mapuje + dedup; tsc+9/9 testów). Ale to **nie jest domyślny widok** (`scheduleView` default `'none'`).
  - Zasiane dane poszły do `task_dependencies` (ścieżka b), a domyślny widok rysuje ze ścieżki a → żaden Gantt nie pokazuje linii bez podpięcia.
- **Status:** 🟠 **DECYZJA TECHNICZNA (CTO) potrzebna** — opcje: **(A)** wpiąć `task_dependencies` w `TimelinePlanner.rows.dependsOnId` (jedno źródło prawdy zależności, główny widok zyskuje linie) · **(B)** uczynić `InitiativeGantt` domyślnym Ganttem (default `scheduleView='gantt'`) · **(C)** skonsolidować dwa Gantty w jeden. Rekomendacja: **A** (najmniej inwazyjne, jedno źródło). NIE hackowane na końcu sesji — wymaga świadomego refaktoru + review. Test `m13-demo-proxy` „linie zależności…" oznaczony `test.fixme` jako żywy TODO. Backend D1 zostaje realną korzyścią (każdy konsument endpointu dostaje poprawne dane).

### ✅ D2 — Sekcje KPIs & Benefits / Financial Analysis → NIE bug (rozstrzygnięte kodem)
- **Weryfikacja kodu:** `FinancialAnalysisSection` **zawsze** renderuje karty CAPEX/OPEX/ROI/NPV/Payback (wartość albo `-`), nigdy blank. `KpisSection` ma `EmptyStateInline` (CTA „Analyze with AI"). Oba renderują treść/empty-state, nie pustkę.
- **Root-cause objawu:** wąski kadr/scroll headless — sekcja nie weszła w viewport zrzutu. Dane finansowe dosiane na flagową (CAPEX 250k/OPEX 60k/ROI 2.4x, API 200) → karty pokażą liczby.
- **Status:** ✅ ZAMKNIĘTE — nie defekt. Render potwierdzi się w realnej przeglądarce przy →F.

### ✅ D3 — Centrum notyfikacji „Loading…" → NIE bug (rozstrzygnięte kodem + endpointem)
- **Weryfikacja kodu:** `NotificationCenter.loadNotifications` ma `setLoading(false)` w **`finally`** (linia 331) → loader ZAWSZE znika (content lub empty-state „No notifications"). Nie ma ścieżki wiecznego loadera.
- **Weryfikacja endpointu:** `GET /api/notifications?limit=50` → **200 w 0.45s z realną listą** (Piotr MA notyfikacje na demo). W realnej przeglądarce: fetch 0.45s → lista.
- **Root-cause objawu:** czysty artefakt headless/proxy — zrzut złapany w trakcie fetcha (latencja proxy), zanim `finally` rozwiązał loader. Wzorzec M09 (headless zostawia widok w skeletonie).
- **Status:** ✅ ZAMKNIĘTE — nie defekt.

### ⬜ D4 — Brak zdjęcia `real-ini-hub-all` (zakładka All / 13 statusów)
- **Root-cause:** przełącznik „All"/widoki to ikony bez tekstu → selektor nie trafił. Złapane: kanban, grid, timeline (3/4 widoki), `real-ini-list` też pominięty.
- **Status:** ⬜ drobny gap harnessu (selektor ikon), nie bug produktu.

### ℹ️ D5 — Duplikaty w danych istniejącej org (timeline 3× te same nazwy, 0%)
- W portfolio Timeline widać po 3× „Cloud Migration Phase 2", „Cybersecurity…", „RPA…" z 0%. To dane ISTNIEJĄCEJ org Piotra (nie mój seed) — jakość danych, nie bug UI.

---

## Co to znaczy dla bramek (Manual / →F / →UI)

- **Manual** — teraz mamy **24 realne zdjęcia z danych** + ocenę dwukryterialną. Pierwsza solidna partia dowodów (nie blank/MOCK_DB). 4 z 5 artefaktów PASS wizualnie+funkcjonalnie; Gantt-deps po re-deployu, notyfikacje/KPIs po live-verify.
- **→F / →UI** — Twoja bramka: możesz wejść na **demo.consultify.ai (realna przeglądarka — hydratuje OK)** zalogować się i klikać odbiory na zasianych bogatych danych.

## Następne kroki (rekomendacja)
1. **Deploy fixa D1 na demo** → Gantt pokaże linie zależności + ścieżkę krytyczną na flagowej (dane już są).
2. **Live-verify D2/D3** w realnej przeglądarce (KPIs/Financial empty vs render; notyfikacje loader vs empty-state).
3. Reszta scenariuszy 5×30 tą samą metodą (rozbudowa kolumny Manual).
