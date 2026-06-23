# M14 „Wdrożenie" — RAPORT BRAKÓW + SKAN RYNKU + KOMPLETNY PLAN

> Deliverable PRZED kodowaniem (na żądanie CEO). Głęboka analiza braków per funkcjonalność + skan rynku (co liderzy PPM/execution/change oferują, czego nam brak) + kompletny, priorytetyzowany plan. Metoda: 5 równoległych analiz eksperckich z badaniem rynku (WebSearch). Buduje na `M14-DOKTRYNA-NARZEDZI-2026-06-23.md` (cele+metodologia) i `M14-ANALIZA-2026-06-23.md` (stan inżynierski). P0-defekty już zamknięte (`261569ddc1`).

---

## 0. STRESZCZENIE — gdzie jesteśmy vs rynek

**Pozycja:** M14 ma dojrzałe, DB-backed narzędzia (control tower, bounded interventions z audytem, RAID 5T, Rollout z historią KPI, People-Change z capability/sentiment/communication). Rynek **nie oferuje zintegrowanego** „execution inicjatyw + adopcja zmiany w jednym" — dzieli się na PPM (Planview/Clarity/ServiceNow SPM), work-mgmt (monday/Asana/Wrike) i change-mgmt (Prosci/WalkMe/Culture Amp). **Nasza przewaga = zintegrowana doktryna.** Ale brakuje nam konkretnych zdolności, które liderzy mają.

**3 największe luki różnicujące vs rynek (gdzie liderzy nas wyprzedzają):**
1. **EVM + forecasting** — liderzy (MS Project+Power BI, Clarity) liczą SPI/CPI/EAC/VAC i prognozują trajektorię; my mamy `avgProgress` (stan dziś, nie dokąd zmierza).
2. **Predykcyjne/leading AI** — monday Risk Insights, Wrike Work Intelligence, MS Copilot, Planview Anvi przewidują ryzyko/opóźnienie ZANIM kryzys; my mamy progi reaktywne.
3. **Scenario / what-if** — Planview, ServiceNow SPM (Q2'25), Clarity, Smartsheet modelują trade-offy w sandboxie; my zmieniamy tylko trwale.

**Enabler dla wszystkiego:** konsolidacja do jednego źródła prawdy (dziś 3 health-score / 2 Action Queue / 4 modele sygnałów / 3 ścieżki RAID) — bez tego każda nowa zdolność mnoży rozjazd.

**Co rynek POTWIERDZA jako naszą przewagę (jesteśmy do przodu):** zintegrowany RAID+execution+change, honest reporting (dataQuality/degraded — rzadkie u konkurencji), bounded interventions z mandatory readback + audit (wzorcowe).

---

## 1. RAPORT BRAKÓW per funkcjonalność

### A. Portfolio Steering & Executive Cockpit
| Funkcja | Brak (capability) | Waga |
|---|---|---|
| Health Score | brak forecastu trajektorii; wagi perspektyw nie-konfigurowalne; brak roll-up wielopoziomowego; migawki historyczne nie istnieją | P0 |
| Snapshot wykonawczy | brak wersjonowania/diff m/m; brak drill-down do przyczyny zmiany; degraded eksportowalny do zarządu | P1 |
| Gantt/Timeline | **brak baseline vs actual** + rebaseline; critical path na filtrowanym grafie; brak roadmap-mode | P0/P1 |
| Kafle KPI | **brak EVM (SPI/CPI/VAC) jako treści**; brak sparkline-trendu; brak klikalności do action-queue | P0 |
| Table/Kanban | brak what-if sandbox; brak WIP/aging/flow-metrics; brak saved-views per rola | P1 |
| AI cockpit | brak grounded portfolio insights + predykcji (delay/overrun) | P1 |

### B. Exception Management & Control Tower
| Funkcja | Brak | Waga |
|---|---|---|
| Action Queue | **2 kolejki** (rozjazd liczb); progi hardkodowane nie tolerancje; **brak WSJF/CoD w sorcie**; brak queue-health | P0 |
| Decisions | eskalacja płaska (bez `escalated_to`/notyfikacji/Exception Report); SLA stała nie per-impact; brak blast-radius | P0 |
| Blockers | brak aging (zawsze critical od d0); owner=sam siebie; brak flagi `on_critical_path` | P1 |
| Signals | **4 nakładające się modele**; wariancja w dniach nie SPI/CPI; **3 def. „high risk"**; brak forecastu/anomaly | P0 |
| Interventions | brak what-if/dry-run; brak closed-loop (sygnał przed/po); brak playbooka | P1 |
| AI triage | karmiony tylko governance→halucynuje; `aiRecommendedActions:[]`; brak auto-priorytetyzacji | P1 |

### C. RAID & Risk Governance
| Element | Brak | Waga |
|---|---|---|
| Risk | scoring odłączony od eskalacji (jedzie na surowym impact); **brak residual risk**; brak review-date/velocity | P0 |
| Scoring | **3×4 nie 5×5**; cichy `\|\|1`; **duplikat logiki** (3 ścieżki zapisu); brak EMV | P0 |
| Appetite | **`auto_escalate_above` 0 czytelników** (martwy); brak walidacji progów; recalc ignoruje per-inicjatywa | P0 |
| Dependency | **to nie model** (płaski wiersz); brak kierunku/grafu/detekcji cykli/kaskady | P0 |
| Assumption | dzieli pola Risk (P×I bez sensu); niewidoczne dla governance; brak validation+trigger | P1 |
| Issue | dziedziczy probability; `linked_items` martwy; brak SLA/resolution-date | P1 |
| Heatmap | 3×4 (nie 25); miesza typy; brak inherent/residual (P0 filtr już naprawiony) | P1 |

### D. Rollout & Transition Management
| Podwidok | Brak | Waga |
|---|---|---|
| Master Plan | **BRAK `rollout_stages`** (Plan=projekcja kwartałów); brak pilot→limited→full→hypercare→closure; brak entry/exit criteria; brak baseline; brak cutover-runbook/rollback | P0 |
| KPI Tracking | brak progów bramkowych (`is_gate_metric`); brak owner/cadence/source; **handoff M15 „preview only"** | P0 |
| Risk Register | P/I luźne stringi (brak score); brak `stage_id`/`is_gate_blocker`; sygnały nie promują się do rejestru | P0/P1 |
| Change Log | **nic nie loguje automatycznie** mimo „automatic"; brak CAB/RFC; APPROVED≠rebaseline | P0 |
| Closure | **brak bramki closure**; brak PIR jako struktury; brak hypercare jako etapu | P0/P1 |
| Przekrojowo | **brak cross-register gating** (KPI+Risk+Closure → jedna bramka go/no-go) | P0 |

### E. Status Reporting & Organizational Change
| Funkcja | Brak | Waga |
|---|---|---|
| Status Reports | **brak schedulera kadencji**; **dystrybucja nie wysyła e-maili**; narracja szablonowa nie-AI (SCOPE/QUALITY P0 już naprawione) | P0/P1 |
| Report Catalog | hardkodowany (nie `reportRegistry.ts`); `aiRecommendedActions:[]`; export to Markdown nie PDF | P1 |
| Manager lane | AI karmiony tylko governance→halucynuje adopcję | P1 |
| People-Change | **„send" nie wysyła**; **brak Champions** (Kotter); **brak ADKAR roll-up** (engine w `_backup`); sentiment niespięty z lane | P0/P1 |

---

## 2. SKAN RYNKU — co liderzy oferują, czego nam brak

| Zdolność rynkowa | Kto oferuje (wzorzec) | Mamy? | Wartość |
|---|---|---|---|
| **EVM dashboards (SPI/CPI/EAC/VAC)** | MS Project+Power BI, Clarity | ❌ | Wysoka — filar doktryny |
| **What-if / scenario planning** | Planview, ServiceNow SPM Q2'25, Clarity, Smartsheet | ❌ | Wysoka — przeskok dashboard→kokpit |
| **Predykcja ryzyka/opóźnień (leading AI)** | monday Risk Insights, Wrike Work Intelligence, MS Copilot, Planview Anvi | ❌ (reaktywne progi) | Bardzo wysoka — premium-feel |
| **Baseline vs actual + rebaseline** | MS Project, monday, Smartsheet, Wrike | ❌ | Wysoka, tani |
| **Predykcja→auto-trigger (closed loop)** | Wrike (risk→Automation), monday AI blocks, Asana Smart Rules | ❌ | Wysoka |
| **SLA + escalation rules (pause/resume, routing)** | monday/JSM automations, Jira SLA | 🟡 płaska | Wysoka |
| **WSJF / Cost-of-Delay prioritization** | Planview AI, SAFe Portfolio Kanban | ❌ (dane są, nieużyte) | Wysoka, tani |
| **Inherent→Residual→Target risk** | ServiceNow GRC, ISO 31000, Origami | ❌ (tylko inherent) | Wysoka |
| **Risk appetite breach workflow** | ServiceNow GRC, Orange Book | 🟡 próg martwy | Wysoka, tani |
| **Dependency graph + cycle detection** | Riskonnect, PMI/SAFe | ❌ | Wysoka (reuse wzorzec M13) |
| **EMV (P×strata) / Monte Carlo** | Predict!, @RISK, Safran | ❌ | EMV średnia/tani; Monte Carlo pomijamy |
| **Phased/wave rollout + rings/canary** | ServiceNow Release, ITIL, LaunchDarkly | ❌ | Wysoka — rdzeń transition |
| **Stage-gate entry/exit + Go/Kill/Hold** | Sopheon Accolade, Stage-Gate, PRINCE2 | ❌ | Wysoka |
| **Guarded release (metryka-bramka→rollback)** | LaunchDarkly | ❌ | Wysoka (uzasadnia gate-metric) |
| **Cutover runbook + rollback triggers** | AWS, Cutover.com | ❌ | Średnia/Wysoka |
| **Hypercare / Early Life Support** | ITIL 4 | ❌ | Średnia |
| **CAB workbench / change risk scoring** | ServiceNow Change | ❌ | Średnia (lekki RFC) |
| **Benefits Register + benefit-owner accountability** | Kaplan-Norton/BRM, PRINCE2 | 🟡 KPI bez owner | Wysoka — handoff M15 |
| **PIR jako artefakt** | Atlassian, ITIL, PRINCE2 | ❌ | Średnia |
| **Scheduled report distribution + delivery audit** | Power BI subscriptions, Tableau Pulse | ❌ (nie wysyła) | Wysoka |
| **AI narrative + anomaly w raporcie** | Power BI Copilot, Tableau Pulse, Smartsheet AI | ❌ szablon | Wysoka |
| **ADKAR scoring (1-5, <3 barrier)** | Prosci Proxima | ❌ (engine w _backup) | Wysoka — filar 5 |
| **Champion/change-agent network** | Kotter, OCM Solution | ❌ | Wysoka |
| **Sentiment/pulse + change-readiness** | Culture Amp (Change Confidence) | 🟡 bez engine | Średnia/Wysoka |
| **Capacity vs demand + resource heatmap** | Planview, Clarity, monday Workload | ❌ | **POMIJAMY v1** (nowa warstwa modelu zasobów) |
| **DAP adoption analytics (feature usage)** | Pendo, WalkMe, Whatfix | ❌ | **POMIJAMY** (wymaga telemetrii produktu klienta) |
| **Monte Carlo / QSRA** | Predict!, Safran | ❌ | **POMIJAMY** (EMV daje 80% za 5%) |
| **Bow-tie analysis** | Origami, Sphera | ❌ | **POMIJAMY** (dla safety-critical, nie inicjatyw) |
| **Feature-flag runtime (SDK)** | LaunchDarkly | ❌ | **POMIJAMY** (bierzemy model rings, nie infra) |

---

## 3. KOMPLETNY PLAN (fale, market-validated)

> Zasada nadrzędna (z doktryny): **nie budować nowych narzędzi w próżni — konsolidować do jednego źródła prawdy, podłączać metodologię do akcji, dokładać brakujące warstwy konstrukcyjne.** Rynek doprecyzował CO i wg jakiego wzorca.

**✅ FALA 0 — P0 defekty (ZROBIONE `261569ddc1`):** cross-org DELETE, distribute-PUBLISHED, budgetHealth, SCOPE/QUALITY, heatmap-filtr, scope_reduction-baseline.

**FALA 1 — Konsolidacja (jedno źródło prawdy) [fundament, P0].**
- `executionSignalEngine` (1 silnik zasilający lane+tower+signals) + 1 definicja RAG/„high risk".
- `portfolioHealthService` (SSOT) + `portfolio_health_snapshots` (trend/diff) — FE konsumuje `/health`.
- 1 Action Queue (V8 lane, wygasić legacy). 1 ścieżka zapisu RAID (`raidScoringService` SSOT).
- *Wzorzec: Smartsheet Control Center / Jira Align real-time roll-up.*

**FALA 2 — Metodologia do akcji [P0/P1].**
- **EVM:** SPI/CPI/EAC/VAC w health + kaflach (zastępuje `avgProgress`). *MS Project+Power BI, Clarity.*
- **WSJF/CoD** w sorcie Action Queue + blast-radius decyzji (dane już są). *Planview/SAFe.*
- **Risk appetite egzekwuje:** `auto_escalate_above`/`score_category`→sygnał `APPETITE_BREACH`+notyfikacja; walidacja progów; residual risk; SSOT scoringu. *ServiceNow GRC, ISO 31000.*
- **Eskalacja prawdziwa:** `escalated_to`+notyfikacja sponsora+Exception Report; SLA per-impact; blocker-aging+`on_critical_path`. *monday/JSM automations.*
- **Tolerancje per inicjatywa** zamiast progów stałych. *PRINCE2.*

**FALA 3 — Warstwa konstrukcyjna Rollout [P0].**
- `rollout_stages` (pilot→limited→full→**hypercare**→closure) + entry/exit criteria + baseline/rebaseline. *ITIL deployment models, LaunchDarkly rings, PRINCE2 stage plan.*
- **Cross-register gate** (KPI `is_gate_metric` ∧ Risk `is_gate_blocker`=0 ∧ Closure sign-off → Go/Conditional/Hold/Kill). *Sopheon Accolade, LaunchDarkly guarded release.*
- Baseline na Gantt + critical path na pełnym grafie (łączy z Falą 1/cockpit).
- Change Log „automatic" (emisja przy rebaseline/zmianie KPI/etapu) + lekki RFC. *ServiceNow Change.*

**FALA 4 — Łańcuch wartości + adopcja + komunikacja [P0/P1].**
- **Realny handoff M14→M15** (KPI delta+ROI→benefit-owner, Benefits Register: owner/KPI/baseline/target/cadence). *Kaplan-Norton/PRINCE2 BRM.*
- **Email-worker + audyt dostarczenia** (1 serwis dla raportów i komunikacji zmiany — naprawia 2 atrapy). *Power BI subscriptions.*
- **Scheduler kadencji** (node-cron→auto-DRAFT, human-in-loop). *Power BI subscription frequency.*
- **Narracja raportów przez AI** (grounded) + `reportRegistry.ts` SSOT. *Power BI Copilot, Tableau Pulse.*
- **ADKAR roll-up** (reaktywować engine z `_backup`, score A/D/K/A/R, <3=barrier) + **Champions lane** + spięcie sentiment→Manager lane. *Prosci Proxima, Kotter, Culture Amp.*

**FALA 5 — Predykcja / premium AI [P1, po konsolidacji].**
- **Predykcja ryzyka/opóźnień (leading)** na EVM+historii+slip-trend → poziom + przyczyna ZANIM próg. *Wrike Work Intelligence, monday Risk Insights, MS Copilot.*
- **Grounded AI triage** (cytuje sygnał, koniec halucynacji) + auto-priorytetyzacja.
- **What-if/scenario** (read-only sandbox: przesuń inicjatywę→efekt na health; dry-run interwencji). *Planview, ServiceNow SPM, Smartsheet.*
- *Uwaga: predykcja zbudowana na skonsolidowanych sygnałach (Fala 1) — nie wcześniej.*

**FALA 6 — Domknięcia jakościowe [P1/P2].** Cutover runbook+rollback triggers; PIR artefakt; 5×5 matryca+EMV+heatmap residual; server PDF (z `M14-ANALIZA` F3b); dependency cycle/cascade; assumption/issue wyłamanie z Risk.

**ŚWIADOMIE POZA ZAKRESEM (v1):** capacity/resource modeling, DAP adoption telemetry, Monte Carlo/QSRA, bow-tie, feature-flag runtime SDK, NL-rule builder, multi-instance federation. (Uzasadnienia w §2.)

---

## 4. DECYZJE DLA CEO (przed startem kodowania)
1. **Kolejność:** rekomendacja = Fala 1→2→3→4→5→6 (konsolidacja najpierw — bez niej reszta mnoży rozjazd). Akceptujesz?
2. **Głębokość EVM:** pełny EVM (PV/EV/AC z baseline kosztowym) czy uproszczony (SPI z dat + CPI z budżetu)? Pełny wymaga baseline kosztowego per inicjatywa.
3. **Predykcyjne AI (Fala 5):** heurystyka (tanio, deterministyczne reguły na EVM/slip) czy ML na historii (dłużej, wymaga danych)? Rekomendacja: heurystyka v1, ML v1.1.
4. **What-if zakres:** tylko health (tanio) czy health+capacity (wymaga modelu zasobów = duża warstwa)? Rekomendacja: health v1.
5. **Handoff M15:** budujemy teraz (Fala 4) czy czekamy aż M15 wyjdzie z beta? (Łączy się z analizą M15.)
6. **Pominięcia:** potwierdzasz listę „poza zakresem v1" (capacity/DAP/Monte Carlo/bow-tie/feature-flags)?

Po akceptacji ruszam kodowo od **Fali 1 (konsolidacja)** — każdy krok z testem + weryfikacją, deploy na demo.

---

## 5. PLAN DOPRACOWANY (po decyzjach CEO 2026-06-23)

**Decyzje CEO:** (2) **pełny EVM (PV/EV/AC)**; (3) predykcja = **heurystyka v1**; (4) what-if = **health + capacity**. Te wybory rozszerzają zakres: pełny EVM wymaga time-phased cost baseline, a what-if+capacity wymaga warstwy modelu zasobów (wcześniej „poza v1"). **Weryfikacja fundamentów (osadzenie w realiach):** istnieją już `workloadCapacityService`/`CapacityController`/`capacity.routes` + migracja `647_v4_workload_capacity` + pole `required_capacity_fte`; `executionBudgetService` (AC/actuals) + `cost_capex/opex` (BAC); **`293_initiative_milestones` istnieje** (nie surogat). → ambitne wybory są wykonalne, bo budują na istniejącej infrze.

**Konsekwencja: program rośnie z 6 do 8 fal** (capacity przestaje być pominięciem, EVM pogłębiony). Wartość ląduje przyrostowo per fala.

| Fala | Zakres (po decyzjach) | Buduje na / wzorzec | Status |
|---|---|---|---|
| **F0** | P0 defekty (bezpieczeństwo+poprawność) | — | ✅ `261569ddc1` |
| **F1 — Konsolidacja** | 1 `executionSignalEngine` + 1 `portfolioHealthService` (SSOT, migawki) + 1 Action Queue (V8 lane) + 1 ścieżka RAID. Likwiduje 3 health-score/2 queue/4 sygnały/3 RAID. | Smartsheet Control Center / Jira Align roll-up | fundament |
| **F2 — Baseline & PEŁNY EVM** | Schedule baseline + **time-phased cost baseline (PV)** z harmonogramu×BAC + **EV** (milestone-weighted via `initiative_milestones` lub % complete) + **AC** z `executionBudgetService` → **SPI/CPI/SV/CV/EAC/VAC** w health+kaflach+sygnałach. Gantt baseline-vs-actual + rebaseline (audyt). | MS Project+Power BI, Clarity, ANSI-748 EVM | **rozszerzony (decyzja 2)** |
| **F3 — Metodologia do akcji** | WSJF/CoD w sorcie queue + blast-radius; risk appetite egzekwuje (`APPETITE_BREACH`+notyfikacja)+residual+SSOT scoringu; eskalacja prawdziwa (`escalated_to`+sponsor+Exception Report)+SLA per-impact+blocker-aging; tolerancje per inicjatywa | PRINCE2, ServiceNow GRC, SAFe WSJF, monday automations | — |
| **F4 — Capacity & Resource model** | Rozbudowa `workloadCapacityService` → alokacje/dostępność per inicjatywa + capacity vs demand + resource heatmap + upgrade sygnału capacity. **Fundament pod what-if+capacity.** | Planview Resource Heat Map, Clarity supply/demand | **NOWA fala (decyzja 4)** |
| **F5 — Stage-gating Rollout** | `rollout_stages` (pilot→limited→full→**hypercare**→closure)+entry/exit+baseline; **cross-register gate** (KPI gate-metric ∧ Risk blocker=0 ∧ sign-off→Go/Kill/Hold); cutover runbook+rollback triggers; Change Log „automatic"+RFC | ITIL/LaunchDarkly rings, Sopheon, PRINCE2, ServiceNow Change | — |
| **F6 — Wartość + adopcja + komunikacja** | Realny handoff M14→M15 (Benefits Register: owner/KPI/baseline/target/cadence); email-worker+audyt dostarczenia (1 serwis); scheduler kadencji→auto-DRAFT; narracja AI grounded+`reportRegistry.ts`; **ADKAR roll-up** (reaktywacja z `_backup`)+**Champions**+sentiment→lane | Kaplan-Norton BRM, Power BI subs, Prosci Proxima, Kotter, Culture Amp | — |
| **F7 — Predykcja (heurystyka) + What-if (health+capacity)** | Heurystyczna predykcja ryzyka/opóźnień na EVM(F2)+slip-trend+historii (reguły, nie ML); grounded AI triage; **what-if sandbox** wykorzystujący EVM(F2)+capacity(F4): przesuń inicjatywę→efekt na health I capacity; dry-run interwencji | Wrike Work Intelligence (wzorzec), Planview/ServiceNow scenario | **what-if rozszerzony (decyzja 4)** |
| **F8 — Domknięcia** | PIR artefakt; 5×5 matryca+EMV+heatmap residual; server PDF (F3b); dependency cycle/cascade; assumption/issue wyłamanie | PMBOK, ITIL PIR | — |

**Pozostałe pominięcia v1 (niezmienione):** DAP-telemetria (Pendo/WalkMe — wymaga in-app produktu klienta), Monte Carlo/QSRA (EMV wystarcza), bow-tie, feature-flag-runtime SDK, NL-rule builder, multi-instance federation.

**Jeden otwarty punkt do rozstrzygnięcia (pełny EVM):** PV (planned value) wymaga **time-phasingu budżetu** wzdłuż harmonogramu + wyboru metody EV. Rekomendacja: BAC (`cost_capex+cost_opex`) rozłożony liniowo lub wg wag kamieni milowych (`initiative_milestones`); EV = Σ(ukończone kamienie × ich waga budżetowa) lub % complete × BAC; **baseline zamrażany przy wejściu w realizację / na bramce planowania** (PRINCE2 baseline). To jedyna nowa decyzja metodyczna — reszta buduje na istniejącej infrze.

**Sekwencja wartości:** F1 (spójność — „manager widzi te same liczby") → F2 (wiarygodny pomiar EVM) → F3 (działanie wg metodologii) → F4 (zasoby) → F5 (kontrolowane wdrożenie) → F6 (wartość+adopcja domyka łańcuch) → F7 (premium: predykcja+what-if) → F8 (polish). Każda fala = osobny PR z testami + deploy demo + odbiór.
