# V3 Backorder (BO) — rejestr rzeczy “nie teraz”
>
> **Status:** Canonical (operational)  
> **Owner:** Piotr  
> **Last updated:** 2026-02-28  
>
> **Cel:** Jedno miejsce na wszystkie rzeczy, które:
> - pojawiają się w trakcie sprintu,
> - są poza cutline sprintu,
> - albo są zablokowane zależnością,
> żeby **nie gubić pomysłów** i **nie rozwalać sprintu**.

---

## 0) Zasada nadrzędna

**Sprint scope jest święty.**  
Jeśli coś nie mieści się w aktualnym sprincie — **nie dyskutujemy w nieskończoność**, tylko:

1) wpis do Backorder (BO),
2) wskazanie zależności/blokera,
3) wstępny proponowany sprint docelowy,
4) wracamy do tego w “Backorder Grooming” po sprincie.

---

## 1) Statusy BO

- `open` — wpis dodany, nieprzypięty do sprintu
- `planned(Sx)` — zaplanowany do konkretnego sprintu
- `in_progress` — w realizacji w aktualnym sprincie (wyjątek: tylko jeśli wchodzi do scope)
- `done` — zrobione i zmergowane do `main`
- `dropped` — świadomie wycięte (z uzasadnieniem)

---

## 2) Minimalny format wpisu (MUST)

> Każdy wpis musi mieć twardy “anchor”, żeby dało się go potem automatycznie/łatwo zamykać.

**BO-YYYYMMDD-### — Tytuł**

- **Status:** open | planned(Sx) | in_progress | done | dropped
- **Source:** Sprint Sx | SSOT (`<file>`) | idea | bug | feedback
- **Reason:** cutline | blocked-by | too-big | not-agreed | polish
- **Depends on / blocks:** `V3-…` i/lub `BO-…`
- **SSOT refs:** lista plików (jeśli dotyczy)
- **Acceptance (app):** 1–3 kroki odbioru w aplikacji
- **Implementation anchor (MUST, min 1):**
  - **PR:** `#NNN` (preferowane)
  - **Commit:** `<sha>`
  - **V3 task:** `V3-…` (plus PR/commit)
- **Notes:** (opcjonalnie) linki, screeny, krótkie uzasadnienie

---

## 3) Jak “zamyka się” BO (żeby nie powtarzać pracy)

### 3.1 Konwencja referencji w PR (MUST)

Każdy PR, który realizuje BO, musi zawierać w tytule lub opisie:

- `BO-YYYYMMDD-###`

### 3.2 Zasada “no repeat”

Jeśli w trakcie kolejnego sprintu pojawia się pomysł, który już istnieje jako BO:
- dopisujemy komentarz do istniejącego BO (nie tworzymy duplikatu),
- aktualizujemy `planned(Sx)` jeśli zmieniamy plan.

### 3.3 “Auto-close” (później)

W przyszłości można dodać prosty skrypt/CI, który:
- skanuje PR-y/commity pod kątem `BO-…`,
- generuje raport “open vs done”.

To jest **opcjonalne**. Najważniejsza jest dyscyplina referencji `BO-…` w PR.

---

## 4) Backorder Grooming (rytuał po sprincie)

Po każdym sprincie (30–45 min):

1) **Review**: nowe BO z sprintu (czy są dobrze opisane).
2) **Triage**: `open` → `planned(Sx)` albo `dropped`.
3) **Dependencies**: jeśli BO jest `blocked-by`, wskazujemy najbliższy sprint, w którym zależność będzie zamknięta.
4) **Cutline sanity**: jeśli backlog puchnie, coś musi wypaść.

---

## 5) Indeks BO (lista aktywnych)

> Wpisuj poniżej w kolejności dodawania.

### BO-20260228-001 — DiscoveryToolsHub: brak PreviewPane (table+preview layout)

- **Status:** open
- **Source:** Sprint S1
- **Reason:** too-big (wymaga integracji TableWithPreviewLayout + PreviewPaneShell)
- **Depends on / blocks:** V3-A07
- **SSOT refs:** `docs/ui-standards/03-modules/table-preview-pane-standard.md`
- **Acceptance (app):**
  - W Tools hub, single-click na wiersz tabeli otwiera podgląd w panelu po prawej (PreviewPaneShell)
  - Przycisk X zamyka podgląd
  - Double-click / Enter otwiera pełny widok w Dynamic Tabs
- **Implementation anchor:** (empty — do realizacji w S2/S3)
- **Notes:** Obecnie single-click otwiera od razu pełny dokument w Dynamic Tabs, pomijając krok podglądu.

---

### BO-20260228-002 — PresentationsHub: brak PreviewPane

- **Status:** open
- **Source:** Sprint S1
- **Reason:** too-big
- **Depends on / blocks:** V3-A07
- **SSOT refs:** `docs/ui-standards/03-modules/table-preview-pane-standard.md`
- **Acceptance (app):**
  - W Presentations hub, single-click otwiera podgląd w PreviewPaneShell
  - Double-click / Enter otwiera pełny widok w Dynamic Tabs
- **Implementation anchor:** (empty)
- **Notes:** Obecnie single-click otwiera od razu pełny widok.

---

### BO-20260228-003 — InitiativesHub: migracja CompactPanel → PreviewPaneShell + double-click/Enter

- **Status:** open
- **Source:** Sprint S1
- **Reason:** too-big (wymaga zamienić InitiativeCompactPanel na standard PreviewPaneShell + dodać handlery)
- **Depends on / blocks:** V3-A07
- **SSOT refs:** `docs/ui-standards/03-modules/table-preview-pane-standard.md`
- **Acceptance (app):**
  - Single-click otwiera PreviewPaneShell (nie custom CompactPanel)
  - Double-click na wiersz → otwiera pełny widok w Dynamic Tabs
  - Enter na zaznaczonym wierszu → otwiera pełny widok
- **Implementation anchor:** (empty)
- **Notes:** Obecny InitiativeCompactPanel działa jako side panel (X close OK), ale nie jest standardowym PreviewPaneShell i brakuje obsługi double-click/Enter.

---

### BO-20260228-004 — ResultsHub: zamienić KPITimeSeriesDrawer na PreviewPaneShell

- **Status:** open
- **Source:** Sprint S1
- **Reason:** too-big
- **Depends on / blocks:** V3-A07
- **SSOT refs:** `docs/ui-standards/03-modules/table-preview-pane-standard.md`
- **Acceptance (app):**
  - Single-click otwiera PreviewPaneShell zamiast drawera
  - Double-click / Enter otwiera pełny widok w Dynamic Tabs
- **Implementation anchor:** (empty)
- **Notes:** Drawer zapewnia close (X), ale nie jest standardowym PreviewPaneShell. Brak double-click/Enter.

---

### BO-20260228-005 — ReportsHub: migracja custom preview panel → PreviewPaneShell + double-click/Enter

- **Status:** open
- **Source:** Sprint S1
- **Reason:** too-big
- **Depends on / blocks:** V3-A07
- **SSOT refs:** `docs/ui-standards/03-modules/table-preview-pane-standard.md`
- **Acceptance (app):**
  - Preview panel użyty przez ReportsHub zamieniony na PreviewPaneShell
  - Double-click / Enter otwiera pełny widok w Dynamic Tabs
- **Implementation anchor:** (empty)
- **Notes:** Obecny panel ma single-click i X close, ale brakuje double-click/Enter oraz nie korzysta ze standardowego komponentu.

---

### BO-20260228-006 — PresentationsHub: orphan navigation (window.location.href) dla assessment/finance

- **Status:** open
- **Source:** Sprint S1
- **Reason:** blocked-by (assessment/finance huby nie wspierają jeszcze deep-link dynamic tabs)
- **Depends on / blocks:** V3-A03
- **SSOT refs:** `docs/ui-standards/03-modules/module-hub-standard.md`
- **Acceptance (app):**
  - "Open source" dla assessment/finance otwiera się w Dynamic Tabs docelowego huba (nie window.location.href)
- **Implementation anchor:** (empty)
- **Notes:** Nawigacja do narzędzi (`tool` sourceType) już naprawiona na deep-link w S1. Assessment i finance wymagają wsparcia po stronie tych hubów.

---

### BO-20260228-007 — Interview Hub: Insights/Templates tab-specific controls mogą wizualnie wyglądać jak dodatkowe paski

- **Status:** open
- **Source:** Sprint S1
- **Reason:** polish
- **Depends on / blocks:** —
- **SSOT refs:** `docs/ui-standards/03-modules/module-hub-standard.md`
- **Acceptance (app):**
  - Kontrolki tab-specific (group-by, card view switcher) w Insights i "Nowy szablon" w Templates nie tworzą wizualnie dodatkowego rzędu
- **Implementation anchor:** (empty)
- **Notes:** Technicznie kontrolki są w nav bar (nie poniżej command row), ale mogą wrappować na wąskich ekranach. Rozważyć konsolidację do jednego rzędu lub przeniesienie do CommandRow.

