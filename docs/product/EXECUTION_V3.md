# Execution (Wdrożenia) v3 — Operational Delivery Module (SSOT)

> **Status:** Draft (v3 SSOT)  
> **Cel:** Opisać kanonicznie moduł **Execution / Wdrożenia** jako miejsce operacyjnego prowadzenia realizacji inicjatyw po go‑live: postęp, ryzyka/blokery, decyzje, raportowanie, szybkie działania.  
> **Zasada:** Execution to *widok operacyjny* na Initiatives + Tasks/Decisions (bez tworzenia drugiego, równoległego workflow).

## 0) Powiązane SSOT (MUST)

- Operating model (flow + rola): `docs/product/OPERATING_MODEL_V3.md`
- Initiatives (lifecycle + governance): `docs/product/INITIATIVE_LEVEL_TEMPLATES_V3.md`, `docs/product/NMODE_MANAGEMENT_V3.md`
- UI/UX:
  - Module Hub: `docs/ui-standards/03-modules/module-hub-standard.md`
  - View modes: `docs/ui-standards/03-modules/view-modes-standard.md`
  - App Table: `docs/ui-standards/03-modules/app-table-standard.md`
  - Table + Preview: `docs/ui-standards/03-modules/table-preview-pane-standard.md`
- Results tracking (KPI/ROI): `docs/product/RESULTS_V3.md`, `docs/product/ROI_TRACKING_CONTRACT_V3.md`

Program / task: `docs/product/V3_IMPLEMENTATION_PROGRAM.md` → `V3-G01`

---

## 1) Po co istnieje Execution (problem → outcome)

Po zatwierdzeniu i uruchomieniu inicjatyw organizacja potrzebuje jednego miejsca, w którym:

- widać **co jest w realizacji**,
- widać **co się sypie** (opóźnienia, blokery, ryzyka),
- da się **szybko zareagować** (zmiana statusu, blocker, eskalacja, decyzja),
- można raportować postęp **w sposób spójny** z Initiatives i Results.

**Outcome:** w 30–120 sekund user widzi “gdzie jest czerwono” i ma jasne następne kroki.

---

## 2) Mental model (KANON v3)

Execution ma jeden mental model:

**Initiatives in execution → Signals → Actions → Reporting → Results**

- Execution NIE tworzy nowego lifecycle’u inicjatyw.
- Execution jest *operacyjną soczewką* (filtry + sygnały + quick actions) dla inicjatyw w statusach wykonawczych.

---

## 3) Surfaces (module hub) — minimalny zakres v3

### 3.1 Hub: “Execution initiatives” (MUST)

**Domyślny widok** to kolekcja inicjatyw w realizacji (np. statusy `EXECUTING` / `IN_PROGRESS` zgodnie z kanonem Initiatives).

View modes (KANON):

- `table` (domyślny)
- `kanban`
- `timeline`

**MUST:** stała kolejność ikon view-modes: `table → kanban → timeline → calendar → matrix → grid` (pokazujemy tylko dostępne).

### 3.2 Drill-down (MUST)

Z Execution zawsze można:

- otworzyć inicjatywę w N-mode (dynamic tabs)
- przejść do powiązanych tasków/decyzji (deep links)
- przejść do Results (KPI/ROI) dla inicjatywy (jeśli istnieje mapping)

---

## 4) UI/UX contracts (MUST)

### 4.1 Module Topbar i Command Row

- Module Topbar: **AI context (ikona-only) → +New (jeśli istnieje) → view-modes → Filters**
- Pomiędzy topbarem a kolekcją jest **jeden** Command Row (dynamic tabs / search / counters) — zero ad-hoc bannerów.

### 4.2 App Table Standard dla Execution (table view)

Table view musi spełniać:

- filtry w headerach kolumn (multiselect)
- resizable columns
- Actions column z kebab (⋮)
- brak dodatkowych mini-toolbarów pod topbarem

### 4.3 Preview pane (Outlook-style) — MUST

Execution jest modułem “triage”, więc preview pane jest krytyczne:

- **default OFF** (otwiera się po kliknięciu w wiersz)
- `X` zamyka preview i odzyskuje szerokość
- Enter/double-click otwiera full view (N-mode inicjatywy)

Preview content (minimalny kontrakt):

- tytuł + identity + status + priorytet
- “health summary”: overdue / blockers / risks / next milestone (jeśli istnieje)
- quick actions (tylko te, które istnieją w inicjatywie): np. “Mark blocked”, “Add risk”, “Open initiative”

---

## 5) Sygnały (Signals) — “co jest czerwone” (MUST)

Execution ma pokazywać sygnały w sposób deterministyczny (z danych), nie jako “opinia AI”.

Minimalne sygnały (R2):

- **Schedule**: opóźnienie względem planu (jeśli mamy daty)
- **Blockers**: czy inicjatywa ma blocker / krytyczne ryzyko
- **Decisions pending**: czy są decyzje oczekujące, które blokują
- **Tasks overdue**: liczba opóźnionych tasków przypiętych do inicjatywy
- **Missing plan data**: brak ownera / brak dat / brak KPI (jako WARN, nie hard blocker dla małych firm)

**MUST:** jeśli brak danych planu (brak dat/estimates) — UI nie udaje precyzyjnego raportowania; pokazuje “missing” i proponuje uzupełnienie.

---

## 6) Reporting (minimal) — co raportujemy i jak

Execution raportuje postęp na dwa sposoby:

1) **Sygnały w kolekcji** (ciągły obraz “co jest czerwone”)
2) **Status update w inicjatywie** (N-mode), które jest źródłem prawdy dla komentarzy i działań

W v3 minimal nie budujemy osobnego “war room”.  
Reporting odbywa się przez:

- statusy inicjatywy,
- ryzyka/blokery (RAID),
- taski i decyzje powiązane,
- (jeśli istnieje) milestone/plan dat.

---

## 7) AI w Execution (MUST — propose→accept)

AI w kontekście Execution:

- podpowiada co wymaga uwagi (“top blockers”, “największe opóźnienia”)
- proponuje działania (workarounds, eskalacje, zmiana priorytetu)
- **nigdy** nie wykonuje zmian bez kliknięcia

---

## 8) Data contract (high-level) — bez nowych modeli

**MUST:** Execution nie wprowadza nowych “duplikatów” inicjatyw.

Execution bazuje na:

- `Initiative` + lifecycle/status
- powiązania do `Task` i `Decision` (linking tables / source refs)
- `Risk/Blocker` jako część N-mode (RAID)
- (opcjonalnie) `Milestones` jeśli istnieją w planowaniu

Jeśli nie mamy danych (np. brak dat), UI pracuje w trybie “degraded but honest”.

---

## 9) Definition of Done (DoD) — v3

- Execution hub istnieje i pokazuje inicjatywy w realizacji
- widoki `table/kanban/timeline` działają i są spójne z view-modes standard
- table view spełnia App Table Standard
- preview pane działa zgodnie z “Outlook style” (selection→preview, Enter→open full)
- quick actions nie są “martwe” (mają handler, uprawnienia, error UX)

## 10) Acceptance / test plan (manual)

- 3 inicjatywy w realizacji:
  - table/kanban/timeline renderują poprawnie
  - filtry działają
  - preview otwiera się po kliknięciu i zamyka `X`
  - Enter otwiera inicjatywę w dynamic tabs
- zmiana statusu inicjatywy w Execution jest widoczna w Initiatives (i odwrotnie)

