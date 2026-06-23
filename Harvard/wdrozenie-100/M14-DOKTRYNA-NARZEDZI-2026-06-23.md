# M14 „Wdrożenie" — DOKTRYNA NARZĘDZI ZARZĄDZANIA REALIZACJĄ + PLAN WDROŻENIA

> Głęboka analiza (2026-06-23) wszystkich narzędzi modułu Execution/Wdrożenie: **cel każdego narzędzia → metodologia (doktryna, nie rynek — rynek oferuje mało) → stan obecny z kodu → luka merytoryczna → plan wdrożenia i zarządzania.** Metoda: 5 równoległych analiz eksperckich (PMO/McKinsey-grade) z weryfikacją żywego kodu. Żywy moduł = `ExecutionHub` (4 zakładki: Portfolio/Rollout/Raporty/Manager) + przekrojowe Execution Control.
>
> SSOT-doktryna, siostra `INITIATIVE_FORMULA.md` (M13). Towarzyszy jej `M14-ANALIZA-2026-06-23.md` (stan inżynierski/higiena).

---

## 0. STRESZCZENIE WYKONAWCZE

M14 ma **szkielet światowej klasy systemu zarządzania realizacją** — i to jest dobra wiadomość: są realne, DB-backed, org-scoped narzędzia (control tower z 5 kolejkami, bounded interventions z RACI-gate + mandatory readback + audit, RAID z pełnym schematem 5T/mitigation/appetite, Rollout z 5 rejestrami i prawdziwą historią KPI, status-reports z cyklem DRAFT→APPROVED→PUBLISHED, People-Change z capability/sentiment/communication spiętymi z backendem). To **nie jest mock** — to dojrzała baza.

Problem nie leży w „brakach", lecz w **trzech wzorcach systemowych**, które cofają moduł z poziomu „kokpit decyzyjny" do „bogaty dashboard opisowy":

1. **Fragmentacja — wiele konkurujących modeli tej samej rzeczywistości.** 3 źródła health-score, 2 Action Queue, 3 definicje „high risk", 4 modele sygnałów, 3 ścieżki zapisu RAID, 2 powierzchnie People-Change. Manager widzi inne liczby na różnych ekranach.
2. **Metodologia zadeklarowana, ale niepodłączona do akcji.** Risk appetite (`auto_escalate_above`) konfigurowalny — bez ani jednego czytelnika. Scoring P×I liczony — eskalacja jedzie na surowym `impact`. Kadencje raportów (Weekly/Monthly) — bez schedulera. Dystrybucja — loguje intencję, nic nie wysyła. Engine ADKAR — leży w `_backup`.
3. **Brak warstw konstrukcyjnych.** Zero EVM (health stoi na samodeklarowanym `% done`, nie SPI/CPI); `budgetHealth` policzony **odwrotnie**; brak baseline/rebaseline; brak `rollout_stages` (pilot→limited→full); zerwany handoff korzyści M14→M15.

**Teza naprawcza:** nie budować nowych narzędzi, lecz **skonsolidować do jednego źródła prawdy, podłączyć istniejącą metodologię do akcji i dołożyć 3 brakujące warstwy konstrukcyjne (EVM, stage-gating, value-handoff).**

---

## 1. DOKTRYNA NADRZĘDNA M14

> **M14 jest systemem zarządzania realizacją przez wyjątki, na jednym źródle prawdy, w rytmie przeglądu sterującego, gdzie wartość jest komunikowana i adoptowana — nie tylko wykonywana.**

Pięć filarów (przekrojowych dla wszystkich narzędzi):

1. **Zarządzanie przez wyjątki (PRINCE2).** Sterujący nie czyta wszystkiego — reaguje na **przekroczenia tolerancji** (czas/koszt/zakres/jakość/ryzyko/korzyści). Tolerancje są parametrem inicjatywy, nie globalną stałą. RED = przekroczenie tolerancji, nie kosmetyczny kolor.
2. **Jedno źródło prawdy.** Jeden silnik sygnałów, jedna kategoryzacja RAG, jeden health-score, jedna kolejka akcji, jedna ścieżka zapisu RAID. Każdy widok czerpie z tego samego rdzenia.
3. **Pomiar przez EVM, nie deklarację.** Schedule = SPI (EV/PV), Cost = CPI (EV/AC), prognoza = EAC/VAC. `% done` samodeklarowany jest antywzorcem. Każda metryka: wartość + cel + RAG + trend (Δ vs poprzednia migawka).
4. **Wartość przepływa przez bramki do realizacji korzyści.** Wdrożenie to kontrolowany przepływ pilot→limited→full→hypercare→closure z bramkami go/no-go, a korzyści (KPI delta, ROI) są **przekazywane do M15 Rezultaty**, nie kończą się na „zamknięte".
5. **Adopcja jest mierzalna (ADKAR).** Realizacja techniczna bez adopcji ludzkiej = „skończone, ale nikt nie używa". Awareness→Desire→Knowledge→Ability→Reinforcement jako pierwszoklasowy wymiar, z championami (Kotter) i prawdziwą komunikacją (z audytem dostarczenia).

---

## 2. NARZĘDZIA PER KLASTER

### KLASTER A — Portfolio Steering & Executive Cockpit (zakładka Portfolio)
**Doktryna klastra:** zarządzanie portfelem realizacji przez wyjątki, na jednym health-score (Balanced Scorecard 4-perspektywiczny napędzany EVM), w rytmie steering review; trzy soczewki na ten sam portfel (Table=kontrola, Kanban=przepływ z limitami WIP, Gantt=sekwencja z baseline+critical path).

| Narzędzie | Cel | Metodologia (doktryna) | Stan / Luka | Plan |
|---|---|---|---|---|
| **Executive Health Score** | Jedna liczba 0–100: „czy portfel pod kontrolą", drill-down do przyczyny | **Kaplan-Norton BSC** (4 perspektywy z jawnymi wagami) napędzany **EVM** (SPI≥0.95 GREEN / 0.85–0.95 AMBER / <0.85 RED, EAC=BAC/CPI); RED=przekroczenie tolerancji (PRINCE2) | **3 źródła prawdy** (FE `portfolioMetrics` ≠ `/api/execution/:p/health` ≠ `/pmo/health`); to średnia 4 proxy, `avgProgress` zamiast SPI; zero EVM | 1 serwis `portfolioHealthService` (SSOT), tabela `portfolio_health_snapshots` (migawki→trend), 4 perspektywy z wagami z configu org, FE konsumuje `/health` |
| **Snapshot wykonawczy** | One-pager za okres dla komitetu: postęp, alerty, KPI, ROI, ryzyka | **PMI Portfolio reporting** (wersjonowany, porównywalny m/m); priority alerts = wyjątki sortowane severity×impact | Typ bogaty i poprawny (dataQuality none/partial/good — uczciwy); brak wersjonowania/diff; `nextMilestones` to surogat z `planned_end` | Tabela `executive_snapshots` (diff m/m), local-fallback oznaczać `degraded` + blokować eksport do zarządu, osobny byt `initiative_milestones` |
| **Widoki: Table/Kanban/Gantt** | 3 soczewki: kontrola / przepływ / sekwencja+zależności | **Portfolio Kanban (Lean/SAFe)** z limitami WIP+aging; **CPM** z float/slack + **baseline vs actual** | Timeline najmocniejszy (realne zależności + critical path + governance-warnings); Kanban **bez WIP/aging**; Gantt **bez baseline** (widać „dziś późno", nie „o ile od planu") | Kanban: `wip_limit`+aging badge; Gantt: `initiative_baseline` + slip Δ; CPM po pełnym grafie (nie filtrowanym) |
| **Kafelki KPI** | 4–6 liczb w 5 sekund, klikalne do drill-down | Kafel = metryka+cel+RAG+trend | 🔴 **`budgetHealth` policzony ODWROTNIE** (FE: `100−actual/budget` → idealne wykonanie=0%; BE: liczy % inicjatyw z danymi=data-coverage). **Kafel finansowy kłamie.** | Zastąpić **CPI+VAC** (underspend ≠ zdrowie); każdy kafel: wartość+cel+RAG+trend; klikalny→action queue |

### KLASTER B — Exception Management & Control Tower (Portfolio + Execution Control)
**Doktryna klastra:** control tower — sygnały (leading) → kolejka wyjątków (priorytet wg ryzyka/pilności) → ograniczona interwencja (baseline-preserving) → mandatory readback → audyt.

| Narzędzie | Cel | Metodologia | Stan / Luka | Plan |
|---|---|---|---|---|
| **Action Queue** | Jeden strumień „co manager musi zrobić TERAZ" | **Mgmt-by-exception** (tylko poza tolerancją); **WSJF/Cost-of-Delay** priorytetyzacja | **2 równoległe Action Queue** (V8 lane vs legacy FE — różne progi); progi hardkodowane (14/7 d), nie tolerancje; sort bez WSJF (impactCount liczony, nieużywany) | Jedno źródło=V8 lane, wygasić legacy; tolerancje per inicjatywa; sort WSJF; metryka queue-health (wiek pozycji) |
| **Decisions buckets** | Sterowanie decision-latency | **RACI** (każda decyzja ma Accountable); **SLA per impact** + eskalacja czasowa | Eskalacja płaska (`status='escalated'` bez `escalated_to`, bez notyfikacji sponsora, bez Exception Report); SLA stała 14d dla wszystkich; brak blast-radius | `escalated_to` + realna notyfikacja (reuse M13 flow); SLA per impact (Crit 2d/High 3d); policzyć decyzję→blokowane encje (CoD) |
| **Blockers/Escalations** | Usuwać to co fizycznie zatrzymuje pracę | **Theory of Constraints** (blocker-aging→schodkowa eskalacja); zależność na ścieżce krytycznej=critical | `/interventions/escalate` **wzorcowy** (trwały RAID+audit+readback); ale lane-blockers: zawsze critical od dnia 0 (brak aging), owner=sam siebie | `blocked_at`→dni→severity schodkowo; flaga `on_critical_path`→auto-critical; escalate→owner=sponsor |
| **Execution Control signals** (risk/delay/budget/capacity) | Early-warning ZANIM kryzys | **EVM variance triggers** (SPI/CPI<próg); **5×5 risk matrix + appetite**; delay thresholds per priorytet | Bogate (risk/delay z „why slip", baseline-variance z `missing_baseline` posture — wzorcowe); ale **4 nakładające się modele**; wariancja w DNIACH nie SPI/CPI; **3 definicje „high risk"** | **Jeden silnik sygnałów** zasilający wszystkie widoki; jedna definicja RAG; dodać EVM SPI/CPI; tolerancje/appetite per projekt |
| **Intervention suggestions** | Od diagnozy do ograniczonego działania | **Bounded interventions** (zachowanie baseline, mandatory readback, RACI-gate) | Bardzo dojrzałe (permission-gate, audit, readback, baseline preserved); ale 🔴 `scope_reduction` **mutuje baseline** (`planned_end_date +21d`); brak what-if; AI verification zostaje `pending` | Naprawić `scope_reduction`→`forecast_end_date`; dry-run endpoint; closed-loop (sygnał przed/po) |

### KLASTER C — RAID & Risk Governance
**Doktryna klastra:** RAID jako **żywy system decyzyjny sterujący eskalacją**, nie pasywny rejestr. Typ RAID determinuje model, nie tylko etykietę. Apetyt musi egzekwować.

| Element | Cel | Metodologia | Stan / Luka | Plan |
|---|---|---|---|---|
| **Risk** | Które ryzyko wymaga odpowiedzi 4T, kto, do kiedy | **ISO 31000 / Orange Book**; **5×5 P×I** (PMBOK); response 4T (Terminate/Treat/Transfer/Tolerate); residual risk | Schemat porządny (5T, mitigation lifecycle); 🔴 **scoring odłączony od eskalacji** (`riskDetectionService` jedzie na surowym `impact`, ignoruje `risk_score`/`auto_escalate_above`); brak residual; brak review-date | Eskalacja na `risk_score≥auto_escalate_above`; dodać residual P×I + `review_due_date`; wymusić response_strategy ≥amber |
| **Assumption** | Niezweryfikowane przesłanki planu | **RAID/RAAIDD**: validation_status + trigger obalenia→Risk/Issue | 🔴 Dzieli WSZYSTKIE pola Risk (P×I bez sensu); `riskDetectionService` jawnie `if(type!=='RISK')continue` → **niewidoczne dla governance** | `validation_status/owner/due_date`; trigger invalidated→auto Risk/Issue; ukryć P×I dla assumptions |
| **Issue** | Co się już zmaterializowało (P=100%) | RAID: severity+SLA+link do ryzyka źródłowego | Infrastruktura jest (`materialized_at`); ale dziedziczy `probability` (bez sensu); `linked_items` **nigdy nie zapisywany/czytany** | Scoring po `impact`; `priority`+`resolution_due_date`+SLA; realny `linked_items` (issue←risk) |
| **Dependency** | Co blokuje z zewnątrz; kontrola łańcucha | **Dependency mgmt (PMI/SAFe)**: kierunek+typ+graf+cykle | 🔴 **To nie model zależności** — płaski wiersz z jedną stroną; brak `depends_on_id`/kierunku/typu/grafu | `depends_on_id`+direction+type+`needed_by`; graf (reuse wzorzec ganttDependencies M13); detekcja cykli/kaskady |
| **Scoring** | Jakościowe→liczba+kategoria | **5×5 P×I** + EMV (P%×strata finansowa) | **3×4 matryca** (niekanon); `\|\|1` cichy fallback (maskuje błąd jako LOW); **duplikat logiki** w InitiativeController | 5×5 (lub udokumentować 3×4); 1 serwis SSOT; dodać `financial_impact`/EMV; walidacja zamiast `\|\|1` |
| **Appetite thresholds** | Ile ryzyka org/inicjatywa akceptuje | **ISO 31000 appetite vs tolerance**; przekroczenie⇒eskalacja | 🔴 `auto_escalate_above` **bez ani jednego czytelnika** (martwa konfiguracja); brak walidacji spójności progów; `recalculate` ignoruje progi per-inicjatywa | Podłączyć do `riskDetectionService` (sygnał `APPETITE_BREACH`+notyfikacja); walidacja green<amber<red; recalc per-inicjatywa |
| **Heatmap** | Gdzie skupia się ekspozycja | Macierz P×I, tylko aktywne ryzyka | 🔴 Filtr `status!='RESOLVED'` **no-op** (RESOLVED nie istnieje w enumie) → **liczy CLOSED/REALIZED jako aktywne**, zawyża czerwień | Filtr `status NOT IN('CLOSED','REALIZED')`; po 5×5→25 komórek; heatmapa tylko RISK |

### KLASTER D — Rollout & Transition Management (zakładka Rollout)
**Doktryna klastra:** wdrożenie = **kontrolowany przepływ przez etapy z bramkami** (PRINCE2 Stage Boundaries + ITIL Service Transition), pilot→limited→full→hypercare→closure, z handoff korzyści do M15.

| Podwidok | Cel | Metodologia | Stan / Luka | Plan |
|---|---|---|---|---|
| **Master Plan** | Harmonogram fal wdrożenia | **PRINCE2 Stage Boundaries** + **ITIL deployment models** + rollout waves (pilot→limited→full) z entry/exit criteria | 🔴 **Brak tabeli** — Plan to projekcja `plannedStartDate` grupowana po kwartale; brak fazy/fali/bramki/baseline; heurystyka „overloaded>4" arbitralna | Tabela `rollout_stages` (wave_type, sequence, baseline, entry/exit_criteria); bramki Stage-Boundary; oś czasu zamiast kwartałów |
| **KPI Tracking** | Czy wdrożenie dowozi wartość | **Kaplan-Norton/Benefits Realization**; leading+lagging; KPI=exit-criterion | Najdojrzalszy: pełen CRUD + **realna historia time-series**; ale brak progów bramkowych, ownera, cadence, rebaseline; handoff M15 „preview only" | Dodać `owner/cadence/source/threshold/is_gate_metric`; gate-metrics→exit_criteria; auto-snapshot na koniec etapu; eksport delty do M15 |
| **Risk Register** | Ryzyka wdrożenia | **PRINCE2 Risk Theme / M_o_R**; P×I; „0 krytycznych"=exit-criterion | CRUD + derived z realnych sygnałów; ale P/I luźne stringi (brak score/rankingu); `owner_id` bez UI; brak powiązania z etapem/bramką | `score`+`stage_id`+`is_gate_blocker`; blockery OPEN blokują bramkę; promocja sygnałów→trwałe rekordy |
| **Change Log** | Kontrola zmian (RFC/CAB) | **ITIL Change Enablement + CAB**; **PRINCE2 Change Theme**; zmiana=warunek rebaseline | Rozjazd intencji: opisany „automatic timeline", realnie ręczny rejestr — **nic nie loguje się automatycznie**; brak workflow CAB | Dotrzymać „automatic" (emitować Change przy rebaseline/zmianie KPI/etapu); pola CAB; APPROVED→rebaseline |
| **Closure Checklist** | Kontrolowane domknięcie + handoff | **PRINCE2 Closing a Project + PIR**; benefits realization handoff | CRUD + derived (Handover/Sign-off/Closure — PMI/PRINCE2); 🔴 **handoff M15 jawnie „preview only"** (zerwane ogniwo); brak PIR jako struktury; brak bramki closure | **Realny sync M14→M15** (KPI delta+ROI→benefit owner); PIR jako artefakt; bramka closure (sign-off+0 blockerów+gate-metrics) |

### KLASTER E — Status Reporting & Organizational Change (zakładki Raporty + Manager)
**Doktryna klastra:** jedno źródło faktu, trzy poziomy głosu (team/sponsor/zarząd); honest status > zielony status; adopcja mierzalna (ADKAR); komunikacja naprawdę dociera (z audytem); kadencja egzekwuje rytm.

| Narzędzie | Cel | Metodologia | Stan / Luka | Plan |
|---|---|---|---|---|
| **Status Reports** | Cykliczny RAG-obraz dla 3 kręgów odbiorców | **PRINCE2 Highlight Report** + **PMI Performance Reports**; RAG roll-up; audience-tiering; kadencja napędza generację | Generacja **realna i grounded** (tasks/RAID/budżet/decyzje + trend); cykl DRAFT→APPROVED→PUBLISHED działa; 🔴 narracja szablonowa (nie AI); 🔴 **SCOPE+QUALITY hardkodowane GREEN**; 🔴 dystrybucja=atrapa (loguje, nie wysyła); brak schedulera | Narracja przez `llmService` (grounded); podłączyć SCOPE/QUALITY lub „N/A"; realny email-worker; node-cron kadencja→DRAFT (human-in-loop) |
| **Execution Report Catalog** | Rejestr „kontraktów raportowych" (audience/cadence/scope) | **PMI Communications Plan**; honest reporting (dataQuality) | Dobry doktrynalnie (audience+cadence+dataSources jawne); ale hardkodowany w ExecutionHub (4000+ lin.); `aiRecommendedActions:[]` zawsze puste; `exportReportPDF` eksportuje **Markdown** | Wyciągnąć do `reportRegistry.ts` (SSOT); podłączyć AI (managerAiService); realny PDF lub uczciwa nazwa |
| **Manager / People-Change lane** | Luki governance + ryzyka organizacyjne | **Prosci ADKAR** + **Kotter** (guiding coalition) | Realne dane (`no_owner/sponsor/dates`+bus_factor); AI prompt „change readiness" — ale dane wejściowe to tylko governance (model halucynuje adopcję) | Wzbogacić o sygnały adopcji (sentiment/capability); detekcja championów; wtedy AI ma na czym stać |
| **People-Change Workspace** | Pulpit adopcji: kompetencje/sentyment/komunikacja | **ADKAR** (Knowledge=capability, Desire=sentiment, Awareness=communication) + **TNA** + resistance mgmt | Najbliżej pełnego ADKAR (3 pod-zakładki spięte z realnym backendem); 🔴 „send" interesariuszy=atrapa (nie wysyła); brak **Champions**; brak **roll-upu ADKAR** (engine w `_backup`); niespięte z lane | Realny transport email (jeden serwis dystrybucji dla obu); reaktywować ADKAR roll-up (score A/D/K/A/R); Champions lane; declining pulse→problem w lane |

---

## 3. WZORCE SYSTEMOWE (przekrojowe)

**3.1. Fragmentacja — mapa konkurujących modeli** (główny dług architektoniczny):
| Co | Ile wariantów | Skutek |
|---|---|---|
| Health-score | 3 (FE portfolioMetrics / `/execution/health` / `/pmo/health`) | Liczba na kokpicie ≠ API ≠ governance |
| Action Queue | 2 (V8 lane / legacy FE) | Inne liczby na różnych ekranach |
| „High risk" | 3 (`score≥8` / `impact HIGH` / RAG `redMin=10`) | Niespójna eskalacja |
| Modele sygnałów | 4 (risk-signals/delay-signals/manager-lane/control-tower) | Nakładająca się prawda |
| Ścieżka zapisu RAID | 3 (raid.routes/InitiativeController/v8-execution) | Drift gwarantowany |
| People-Change | 2 (manager lane / Workspace, niespięte) | Sentyment nie tworzy problemu |

**3.2. Metodologia zadeklarowana, niepodłączona:** `auto_escalate_above` (0 czytelników), scoring P×I (eskalacja na surowym impact), kadencje (bez schedulera), dystrybucja (loguje, nie wysyła), ADKAR engine (w `_backup`), `linked_items` (zadeklarowane, nigdy nieużyte).

**3.3. Brakujące warstwy konstrukcyjne:** EVM (SPI/CPI/EAC), baseline/rebaseline, `rollout_stages` (pilot→limited→full gating), realny handoff M14→M15.

---

## 4. REALNE DEFEKTY (P0/P1)
**✅ P0 ZROBIONE (2026-06-23, commit `261569ddc1`, tsc 0, test security 5/5):**
- ✅ `DELETE /status-reports/:id` org-scoped + 404 (był cross-tenant delete).
- ✅ `/distribute` guard PUBLISHED → 409 (był rozsył DRAFT).
- ✅ `budgetHealth` FE→penalizacja overrun (był odwrotny); BE→null (był data-coverage).
- ✅ SCOPE→`NA` honest, QUALITY z realnego `openIssues` (były sztywne GREEN).
- ✅ Heatmap filtr → `NOT IN (CLOSED,REALIZED)` (był no-op `!= 'RESOLVED'`).
- ✅ `scope_reduction` → `forecast_end_date` (był baseline mutation; P03 §2.4.5).
- ✅ Domknięcie F0: usunięto 7 fałszywych stub-testów `tests/components/Implementation/`.

**🟡 P1 pozostałe (w falach F2/F4):** `auto_escalate_above`/`linked_items` martwe (F2/RAID); `exportReportPDF` to Markdown (F4); `recalculate` ignoruje progi per-inicjatywa (F2); dystrybucja/„send" nie wysyłają e-maili (F4).

---

## 5. PLAN WDROŻENIA I ZARZĄDZANIA (fale)

**Fala 1 — Konsolidacja (jedno źródło prawdy).** Najwyższy zwrot: usuwa fragmentację.
- Jeden `executionSignalEngine` → zasila lane+tower+signals, jedna kategoryzacja RAG.
- Jeden `portfolioHealthService` (SSOT) + migawki; FE konsumuje `/health`.
- Jedna Action Queue (V8 lane), wygasić legacy. Jedna ścieżka zapisu RAID (`raidScoringService` SSOT).

**Fala 2 — Podłączenie metodologii do akcji.**
- EVM: SPI/CPI/EAC/VAC w health + sygnałach; naprawić `budgetHealth`→CPI/VAC.
- Risk appetite egzekwuje: `auto_escalate_above`/`score_category`→`riskDetectionService` (sygnał APPETITE_BREACH+notyfikacja).
- Tolerancje per inicjatywa zamiast progów stałych; WSJF w sortowaniu kolejki.

**Fala 3 — Warstwa konstrukcyjna Rollout.**
- `rollout_stages` (pilot/limited/full) + mapowanie inicjatyw + bramki Stage-Boundary.
- Cross-register gating (KPI gate-metrics + Risk blockers + Closure sign-off → bramki).
- Baseline/rebaseline planu + Gantt baseline-bar; Change Log „automatic" przy rebaseline.

**Fala 4 — Łańcuch wartości i adopcja.**
- Realny handoff M14→M15 (KPI delta+ROI→benefit owner) — zamienić „preview".
- Realna dystrybucja (email-worker czytający `report_distributions`/`communication_send_log`, audit dostarczenia) — jeden serwis dla raportów i komunikacji zmiany.
- ADKAR roll-up (score A/D/K/A/R per inicjatywa) + Champions lane; spiąć sentiment/capability z managerskim lane.
- Narracja raportów przez AI (grounded); katalog→`reportRegistry.ts`; scheduler kadencji.

**Fala 5 — Domknięcia jakościowe.** Naprawa P0 (front-load: cross-org DELETE, distribute-PUBLISHED, SCOPE/QUALITY, heatmap filtr, scope_reduction baseline); residual risk; dependency graph; what-if dry-run; PIR; server PDF (`M14-ANALIZA` F3b).

**Model zarządzania (governance/kadencje):** Daily — blockers + krytyczne decyzje (Delivery Lead). Weekly — steering review na zamrożonej migawce health (PMO lead), triage Action Queue. Per etap — bramka Stage-Boundary (sponsor sign-off). Miesięcznie — Highlight Report do sponsora, przegląd ryzyk. Closure — PIR + handoff korzyści do M15.

---

## 6. NASTĘPNY KROK
Decyzja CEO: zatwierdzić doktrynę + kolejność fal. Rekomendacja: **Fala 1 (konsolidacja) + front-load P0** jako pierwszy sprint (najwyższy zwrot, usuwa „manager widzi inne liczby"), potem Fala 2 (EVM+appetite). Falę 4 (handoff M15) synchronizować z analizą M15.
