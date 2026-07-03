# M14 „Wdrożenie" — PLAN ROZWOJU (SSOT)

> Master-plan modułu M14 Execution/Wdrożenie — jak `INITIATIVE_FORMULA` był dla M13. Konsoliduje analizę braków + skan rynku + decyzje CEO w jeden, priorytetyzowany plan rozwoju **wszystkich funkcjonalności** M14. Stan: 2026-06-23.
>
> Dokumenty źródłowe: `M14-DOKTRYNA-NARZEDZI-2026-06-23.md` (cele+metodologia), `M14-RAPORT-BRAKOW-RYNEK-2026-06-23.md` (braki+rynek), `M14-ANALIZA-2026-06-23.md` (stan inżynierski).

## Decyzje zamknięte (CEO, 2026-06-23)
- **EVM:** PEŁNY (PV/EV/AC → SPI/CPI/SV/CV/EAC/VAC).
- **Predykcja AI:** heurystyka v1 (reguły na EVM/slip; ML → v1.1).
- **What-if:** health + capacity (pełny scenario z modelem zasobów).
- **Poza v1:** DAP-telemetria, Monte Carlo/QSRA, bow-tie, feature-flag-runtime SDK, NL-rule builder, multi-instance federation.

## Teza
M14 ma dojrzały szkielet (control tower, bounded interventions z audytem, RAID 5T, Rollout, People-Change). Plan **nie buduje narzędzi w próżni** — konsoliduje do jednego źródła prawdy, podłącza metodologię do akcji, dokłada brakujące warstwy konstrukcyjne (EVM, capacity, stage-gating, value-handoff). Każda fala = osobny PR + testy + deploy demo + odbiór.

---

## FALE ROZWOJU

### F0 — Defekty P0 ✅ ZROBIONE (`261569ddc1`)
Cross-org DELETE · distribute-PUBLISHED · budgetHealth · SCOPE/QUALITY · heatmap-filtr · scope_reduction-baseline. Test security 5/5, tsc 0.

### F1 — Konsolidacja (jedno źródło prawdy) · fundament
- `executionSignalEngine` — jeden silnik sygnałów (zamiast 4 nakładających się modeli) + jedna definicja RAG/„high risk".
- `portfolioHealthService` (SSOT) + `portfolio_health_snapshots` (trend/diff) — FE konsumuje `/health`.
- Jedna Action Queue (V8 lane, wygasić legacy). Jedna ścieżka zapisu RAID (`raidScoringService` SSOT).
- **Efekt:** „manager widzi te same liczby na każdym ekranie". Wzorzec: Smartsheet Control Center / Jira Align.

### F2 — Baseline & PEŁNY EVM · pomiar zamiast deklaracji
- Schedule baseline + **time-phased cost baseline (PV)** z harmonogramu×BAC.
- **EV** milestone-weighted (`initiative_milestones`) + **AC** z `executionBudgetService` → **SPI/CPI/SV/CV/EAC/VAC**.
- EVM w health-score + kaflach + sygnałach. Gantt **baseline-vs-actual** + rebaseline (audyt).
- Wzorzec: MS Project+Power BI, Clarity, ANSI-748.

### F3 — Metodologia do akcji
- **WSJF/Cost-of-Delay** w sorcie Action Queue + blast-radius decyzji.
- **Risk appetite egzekwuje:** `auto_escalate_above`/`score_category` → sygnał `APPETITE_BREACH` + notyfikacja; residual risk; SSOT scoringu.
- **Eskalacja prawdziwa:** `escalated_to` + notyfikacja sponsora + Exception Report; SLA per-impact; blocker-aging + `on_critical_path`.
- **Tolerancje per inicjatywa** (PRINCE2) zamiast progów stałych.

### F4 — Capacity & Resource model · NOWA warstwa
- Rozbudowa `workloadCapacityService` → alokacje/dostępność per inicjatywa + capacity vs demand + resource heatmap + upgrade sygnału capacity.
- **Fundament pod what-if+capacity (F7).** Wzorzec: Planview Resource Heat Map, Clarity supply/demand.

### F5 — Stage-gating Rollout · kontrolowany przepływ
- `rollout_stages` (pilot→limited→full→**hypercare**→closure) + entry/exit criteria + baseline.
- **Cross-register gate** (KPI gate-metric ∧ Risk blocker=0 ∧ Closure sign-off → Go/Conditional/Hold/Kill).
- Cutover runbook + rollback triggers; Change Log „automatic" + lekki RFC/CAB.
- Wzorzec: ITIL/LaunchDarkly rings, Sopheon Accolade, PRINCE2 stage boundaries, ServiceNow Change.

### F6 — Wartość + adopcja + komunikacja
- **Realny handoff M14→M15** (Benefits Register: owner/KPI/baseline/target/cadence; delta KPI+ROI → benefit owner).
- **Email-worker + audyt dostarczenia** (jeden serwis dla raportów i komunikacji zmiany — naprawia 2 atrapy).
- **Scheduler kadencji** (node-cron → auto-DRAFT, human-in-loop) + narracja AI grounded + `reportRegistry.ts` SSOT.
- **ADKAR roll-up** (reaktywacja engine z `_backup`, A/D/K/A/R, <3=barrier) + **Champions lane** + spięcie sentiment→Manager lane.
- Wzorzec: Kaplan-Norton BRM, Power BI subscriptions, Prosci Proxima, Kotter, Culture Amp.

### F7 — Predykcja (heurystyka) + What-if (health+capacity) · premium
- **Heurystyczna predykcja** ryzyka/opóźnień na EVM(F2)+slip-trend+historii (reguły, nie ML).
- **Grounded AI triage** (cytuje sygnał, koniec halucynacji) + auto-priorytetyzacja.
- **What-if sandbox** wykorzystujący EVM(F2)+capacity(F4): przesuń inicjatywę → efekt na health I capacity; dry-run interwencji.
- Wzorzec: Wrike Work Intelligence, Planview/ServiceNow scenario.

### F8 — Domknięcia
PIR artefakt · 5×5 matryca + EMV + heatmap residual · server PDF (F3b) · dependency cycle/cascade · assumption/issue wyłamanie z modelu Risk.

---

## ROZWÓJ PER MODUŁ (funkcjonalność → fale)

| Moduł / funkcjonalność | Fale rozwoju |
|---|---|
| **Portfolio cockpit** (health, snapshot, KPI) | F1 (SSOT health) → F2 (EVM w kaflach) → F7 (AI insights, what-if) |
| **Widoki** (Table/Kanban/Gantt) | F2 (Gantt baseline) → F7 (what-if sandbox) |
| **Control Tower** (Action Queue, signals) | F1 (1 silnik) → F3 (WSJF, tolerancje) → F7 (predykcja) |
| **Decisions / Blockers / Escalations** | F1 (konsolidacja) → F3 (eskalacja prawdziwa, SLA, aging) |
| **Interventions** | F3 (playbook) → F7 (dry-run, closed-loop) |
| **RAID & Risk** | F1 (SSOT zapisu) → F3 (appetite, residual) → F8 (5×5, EMV, dependency graph) |
| **Rollout** (Plan/KPI/Risk/Change/Closure) | F5 (stages, cross-register gate, cutover) |
| **Status Reports** | F6 (scheduler, email, narracja AI, registry) → F8 (server PDF) |
| **People-Change** (ADKAR/Champions/sentiment) | F6 (ADKAR roll-up, Champions, email) |
| **Handoff M14→M15** | F6 (Benefits Register, realny sync) |
| **Capacity / Resource** | F4 (model) → F7 (what-if+capacity) |

## Governance / kadencje (model zarządzania)
Daily — blockers + krytyczne decyzje (Delivery Lead). Weekly — steering review na zamrożonej migawce health (PMO). Per etap — bramka Stage-Boundary (sponsor sign-off). Miesięcznie — Highlight Report. Closure — PIR + handoff korzyści do M15.

## Sposób pracy
Każda fala: osobny PR → testy (unit/integration) → tsc 0 → deploy demo → odbiór →F/→UI. Konsolidacja (F1) najpierw — bez niej każda nowa zdolność mnoży rozjazd.
