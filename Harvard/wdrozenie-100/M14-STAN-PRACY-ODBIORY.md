# M14 „Wdrożenie" — STAN PRACY + ODBIORY (program budowy)

> Program budowy + system odbiorów dla M14 Execution/Wdrożenie — analogiczny do `M13-STAN-PRACY-ODBIORY.md`. Wszystkie zadania dla wszystkich funkcjonalności (8 fal F1–F8), każde z 8 bramkami odbioru. SSOT pracy + akceptacji. Stan: 2026-06-23.
>
> Dokumenty siostrzane: `M14-PLAN.md` (master-plan), `M14-DOKTRYNA-NARZEDZI-2026-06-23.md` (cele+metodologia), `M14-RAPORT-BRAKOW-RYNEK-2026-06-23.md` (braki+rynek), `M14-AUDYT-AUTONOMICZNY-2026-06-23.md` (stan po przelocie).

## STATUS PRAWDY (2026-06-23)
- Żywy moduł = `ExecutionHub` (zakładki Portfolio/Rollout/Raporty/Manager) + Execution Control. Martwy duplikat `Implementation/` usunięty (F0).
- **F0** P0 ✅ · **F1** rdzeń ✅ (zdeployowane demo) · **F2** fundament+wpięcie additive 🟢 · **F3** 3/5 🟡 · **F4–F8** ⬜ planowane.
- Backend w większości REALNY+DB-backed. tsc 0 (FE+backend), 66/66 testów M14, zero regresji. Prod (centerbeam) nietknięty.

## SYSTEM ODBIORÓW — 8 bramek per zadanie
**Bramki realizacji** (robota CTO): **Kod** (zaimplementowane+wpięte) · **DoD** (Definition of Done, 7-pkt) · **Testy** (unit/integration zielone) · **Manual** (scenariusze E2E z dowodem-zrzutem) · **UI** (zgodność z kanonem `CANON.md`/§27).
**Bramki akceptacji** (Twoja robota, Piotr): **→F** (klikasz na demo, działa funkcjonalnie) · **→UI** (Ty + ja akceptujemy grafikę).
**ZAMKNIĘTY 8/8** = wszystkie zielone. **🟢 GOTOWY** = realizacja ✅, czeka →F/→UI.

---

## TABLICA ZBIORCZA

| # | Zadanie / funkcjonalność | Fala | Kod | DoD | Testy | Manual | UI | →F | →UI | Status |
|--|--|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|--|
| 0.1 | P0 defekty (DELETE org-scope, distribute PUBLISHED, budgetHealth, SCOPE/QUALITY, heatmap-filtr, scope_reduction) | F0 | ✅ | ✅ | ✅ 5/5 | 0/6 | ✅ | ⬜ | ⬜ | 🟢 DEPLOYED demo (`261569ddc1`) |
| 0.2 | Higiena martwego kodu (`Implementation/` 9 komp. + workqueue) | F0 | ✅ | ✅ | ✅ 26/26 | N/A | ✅ | ⬜ | ⬜ | 🟢 DEPLOYED (`5dc7d21090`) |
| 1.1 | Health-score SSOT (kokpit==API) | F1 | ✅ | ✅ | 🟡 live | 0/3 | ✅ | ⬜ | ⬜ | 🟢 DEPLOYED (`aba2599c98`) |
| 1.2 | Action Queue → kanoniczny klasyfikator high-risk | F1 | ✅ | ✅ | ✅ 3/3 | 0/3 | N/A | ⬜ | ⬜ | 🟢 DEPLOYED (`ac70cccebb`) |
| 1.3 | RAID scoring → 1 ścieżka (zweryfikowane już-kanoniczne) | F1 | ✅ | ✅ | ✅ | N/A | N/A | ⬜ | ⬜ | 🟢 ZWERYFIKOWANE |
| 2.1 | Fundament EVM (rdzeń ANSI-748 + derywacja milestone-weighted) | F2 | ✅ | ✅ | ✅ 8/8 | N/A | N/A | ⬜ | ⬜ | 🟢 DEPLOYED (`90ff87ed98`) |
| 2.2 | Portfolio EVM roll-up wpięty additive w `/execution/health` | F2 | ✅ | ✅ | ✅ | 0/2 | N/A | ⬜ | ⬜ | 🟢 DEPLOYED (`f386b9f83c`) |
| 2.3 | Cost-actuals → CPI (wpięcie budget actuals) | F2 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ pozostaje |
| 2.4 | Swap healthScore: avgProgress → EVM (po live-verify) | F2 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ pozostaje |
| 2.5 | Gantt baseline-vs-actual + rebaseline | F2 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ pozostaje |
| 3.1 | Risk appetite egzekwuje (`auto_escalate_above` + APPETITE_BREACH) | F3 | ✅ | ✅ | ✅ 4/4 | 0/2 | N/A | ⬜ | ⬜ | 🟢 DEPLOYED (`c52c514650`) |
| 3.2 | WSJF/Cost-of-Delay w sorcie Action Queue | F3 | ✅ | ✅ | ✅ 4/4 | 0/2 | N/A | ⬜ | ⬜ | 🟢 DEPLOYED (`0b5964599a`) |
| 3.3 | SLA decyzji per-priority | F3 | ✅ | ✅ | ✅ 3/3 | 0/2 | N/A | ⬜ | ⬜ | 🟢 DEPLOYED (`06486bd3af`) |
| 3.4 | Eskalacja prawdziwa (`escalated_to`+notyfikacja sponsora+Exception Report) | F3 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ pozostaje |
| 3.5 | Tolerancje per inicjatywa | F3 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ pozostaje |
| 4.1 | Model alokacji/dostępności per inicjatywa | F4 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ pozostaje |
| 4.2 | Capacity vs demand + resource heatmap | F4 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ pozostaje |
| 4.3 | Upgrade sygnału capacity (z modelowania) | F4 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ pozostaje |
| 5.1 | `rollout_stages` (pilot→limited→full→hypercare→closure) + entry/exit | F5 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ pozostaje |
| 5.2 | Cross-register gate (KPI∧Risk∧Closure → Go/Kill/Hold) | F5 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ pozostaje |
| 5.3 | Baseline/rebaseline planu | F5 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ pozostaje |
| 5.4 | Cutover runbook + rollback triggers | F5 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ pozostaje |
| 5.5 | Change Log „automatic" + lekki RFC/CAB | F5 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ pozostaje |
| 6.1 | Handoff M14→M15 (Benefits Register: owner/KPI/baseline/target/cadence) | F6 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ pozostaje |
| 6.2 | Email-worker + audyt dostarczenia (1 serwis dla raportów+komunikacji) | F6 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ pozostaje |
| 6.3 | Scheduler kadencji (node-cron → auto-DRAFT, human-in-loop) | F6 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ pozostaje |
| 6.4 | Narracja raportów przez AI (grounded) + `reportRegistry.ts` SSOT | F6 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ pozostaje |
| 6.5 | ADKAR roll-up (reaktywacja engine z `_backup`, A/D/K/A/R, <3=barrier) | F6 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ pozostaje |
| 6.6 | Champions/change-agent network + spięcie sentiment→Manager lane | F6 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ pozostaje |
| 7.1 | Heurystyczna predykcja ryzyka/opóźnień (na EVM+slip-trend) | F7 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ pozostaje |
| 7.2 | Grounded AI triage (cytuje sygnał) + auto-priorytetyzacja | F7 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ pozostaje |
| 7.3 | What-if sandbox (health + capacity) + dry-run interwencji | F7 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ pozostaje |
| 8.1 | Dependency model + graf + detekcja cykli/kaskady | F8 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ pozostaje |
| 8.2 | Assumption validation + Issue linked_items + SLA | F8 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ pozostaje |
| 8.3 | 5×5 matryca + EMV + heatmap inherent/residual | F8 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ pozostaje |
| 8.4 | Server PDF raportów (audit trail) | F8 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ pozostaje |
| 8.5 | PIR jako artefakt (lessons learned) | F8 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ pozostaje |

**Postęp programu:** 35 zadań · **8 GOTOWE code-side** (0.1–3.3, zdeployowane demo, czekają →F/→UI) · **0 ZAMKNIĘTYCH 8/8** (brak →F/→UI Piotra) · **27 pozostaje** (F2 reszta 3 · F3 reszta 2 · F4 3 · F5 5 · F6 6 · F7 3 · F8 5). Manual gate globalnie 0/~50 (E2E real-data jak M13 = osobny przebieg). Ekrany: 1 (`f1-cockpit-health-ssot`).

**Słownik statusu:** ⬜ NIE ROZPOCZĘTY · 🟡 W TOKU · 🟢 GOTOWY DO ODBIORU (realizacja ✅, czeka →F/→UI) · ✅ ZAMKNIĘTY (8/8).

---

# ODBIORY SZCZEGÓŁOWE (per fala)

## FALA F0 — Higiena + P0 (✅ DEPLOYED)
**0.1 P0 defekty** · DoD 7/7 ✅ · Dowód: `261569ddc1`, test security 5/5, tsc 0. Manual: 6 scenariuszy (cross-org-delete blok, distribute-DRAFT blok, budgetHealth, SCOPE=NA, heatmap, scope_reduction) — do wykonania na demo. →F: klik na demo. →UI: N/A (backend).
**0.2 Martwy kod** · usunięto 13 plików/5597 linii, żywy moduł 26/26. →F: moduł działa = potwierdzone (screenshot kokpitu).

## FALA F1 — Konsolidacja (✅ DEPLOYED demo)
**1.1 Health SSOT** · `ExecutionHub` konsumuje `/execution/health` (autorytatywny), własna kalkulacja = fallback degraded; `healthScoreSource` flaguje. Dowód `aba2599c98`, kokpit renderuje czysto (0 błędów). Manual: M1 liczba kokpit==API · M2 fallback gdy endpoint pada · M3 dark/light. →F: otwórz Implementation→sprawdź health.
**1.2 Action Queue klasyfikator** · legacy getActionQueue: `impact IN(...)` → `calculateRiskScore`+`categorizeScore` (non-GREEN), ranking P×I. `ac70cccebb`, 3/3. Manual: kolejka pokazuje te same „high-risk" co heatmapa.
**1.3 RAID scoring 1-ścieżka** · zweryfikowane: wszystkie 3 write-paths używają `raidScoringService` (audyt przeszacował „duplikat").

## FALA F2 — Baseline & pełny EVM (🟢 fundament / ⬜ reszta)
**2.1 Fundament EVM** · `evmService`: computeEvm (SPI/CPI/SV/CV/EAC/VAC/TCPI/RAG) + deriveInitiativeEvm (PV time-phasing, EV milestone-weighted, AC). `90ff87ed98`, 8/8. DoD: matematyka ANSI-748 ✅, null-safety ✅, testy ✅.
**2.2 Portfolio roll-up** · `derivePortfolioEvm` + pole `evm` w `/execution/health` (additive, coverage). `f386b9f83c`. Manual: kokpit pokazuje SPI portfela.
**2.3–2.5 (⬜):** cost-actuals→CPI (join budget_transactions) · swap healthScore na EVM (po live-verify) · Gantt baseline-vs-actual+rebaseline (schema baseline). DoD do zdefiniowania przy starcie.

## FALA F3 — Metodologia do akcji (🟡 3/5)
**3.1 Appetite** · `auto_escalate_above` ożywiony, sygnał APPETITE_BREACH, eskalacja na kanoniczny score. `c52c514650`, 4/4. Manual: ryzyko ≥ próg → APPETITE_BREACH; HIGH×LOW (GREEN) NIE eskaluje.
**3.2 WSJF** · `actionQueueCodScore` (severity×pilność×blast). `0b5964599a`, 4/4. Manual: krytyczna decyzja przed drobnym taskiem; RED przed AMBER.
**3.3 SLA decyzji** · per-priority (Crit 2d/High 3d/Med 7d/Low 14d). `06486bd3af`, 3/3. Manual: krytyczna eskaluje szybciej.
**3.4–3.5 (⬜):** eskalacja prawdziwa (`escalated_to`+notyfikacja sponsora, reuse flow M13) · tolerancje per inicjatywa (schema+reads).

## FALE F4–F8 — pozostają (⬜ planowane)
Każde zadanie startuje z definicją DoD (7-pkt) + epiki, potem Kod→Testy→Manual→UI→deploy demo→→F/→UI. Charakter: **nowe podsystemy** (migracje DB + model + UI + live-verify) — rekomendowane jako osobne sprinty/autonomiczne sesje schema-owe.
- **F4 Capacity** (3): model alokacji · capacity vs demand + heatmap · sygnał capacity.
- **F5 Stage-gating** (5): rollout_stages · cross-register gate · baseline · cutover/rollback · Change Log automatic.
- **F6 Wartość+adopcja** (6): handoff M15 · email-worker · scheduler · narracja AI · ADKAR roll-up · Champions.
- **F7 Predykcja+what-if** (3): predykcja heurystyczna · grounded triage · what-if+capacity.
- **F8 Domknięcia** (5): dependency graph · assumption/issue · 5×5+EMV · server PDF · PIR.

---

## ZASADY PRACY (jak M13)
Każde zadanie: osobny PR → DoD 7/7 → testy zielone → tsc 0 → Manual (E2E real-data, proxy local-FE→demo-BE) → UI canon → deploy demo → **Twój odbiór →F/→UI**. Konsolidacja (F1) przed resztą — zrobiona. Manual gate domykany przebiegiem E2E real-data (metoda z M13). Prod tylko za osobną zgodą.

## NASTĘPNY KROK
Odbierz 8 GOTOWYCH zadań na demo (→F/→UI). Potem: F2 dokończenie (najwyższa wartość) → F3 reszta → F4–F8 sprintami.
