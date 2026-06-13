# WP M14 — Wdrożenie (Execution) · dokończenie do 100%

**Pula:** core · **Karta:** `Harvard/modules/M14-wdrozenie/KARTA_AUDYTU.md` (ocena 52/100) · **Rozmiar:** L (5 tabel Rollout→FilterableTable, ~141 kluczy i18n PL) · **Żywy bloker:** brak otwartych P0 (P0 cross-org NAPRAWIONE)
**Faza programu:** FAZA 2 (klienci) → FAZA 4 (sweepy: §27 Rollout + i18n) · **Master:** `Harvard/wdrozenie-100/MASTER.md`

## 1. Stan obecny (jednym akapitem)
Najsolidniejszy rdzeń z modułów core — executive dashboard (Health Score liczony z realnych danych, nie fabrykowany), 3 widoki portfela z kanban DnD + inline-status, Action Queue/RAID/Decisions na org-scoped SQL (`ExecutionController.ts:744-900`), zakładka Rollout (Plan/KPI/Risks/Change/Closure) z trwałymi danymi na `/api/rollout/*` (migracja `20260608_rollout_tables.sql`), raporty z live-data bez fabrykowanych liczb (`reportContentGenerator.ts`), reuse dokumentu inicjatywy z M13, handoff czatu Teresy. **Naprawione w audycie:** cross-org write budżetu `recalcInitiativeActualTotal` (`b9f2dee9d2` — `UPDATE initiatives SET actual_budget_total WHERE id=? AND organization_id=?`); cross-org write `task_dependencies` 2-step verify (`9974596da7`); osierocony `routes/execution.routes.ts` usunięty (`2fe1c81be3`); `budgetHealth=100` hardcode → real calculation (`84757dc672`); Manager V8 degradation amber baner (`229cb35565`); control tower outer-catch baner (Fala 2e); W13 i18n Wave8 (`84757dc672`). Brak otwartych P0.

## 2. Luki do DoD

### (a) BACKEND / API (FAZA 2)
- **[P1] gating pilota tylko klient.** Rollout CRUD blokowany `readOnly` w UI, ale serwer `requireOrgRole('user')` przepuszcza CRUD przez API. Fix: gating serwerowy (`requireOrgRole` + capability) → pilot API → 403.
- **[P2] ciche degradacje `catch→[]`** bez komunikatu: PMO execution-health (`ExecutionHub.tsx:1301`), action-queue (`:1317`) — sygnały lecą do `[]`, user nie wie o niedostępności control-tower/risk/budget. (Manager lanes + control tower timeline = NAPRAWIONE banerem; pozostaje PMO health/action-queue.) Fix: baner/log jak w pozostałych.
- **[P3] `ON CONFLICT (id) DO UPDATE` bez org-guard** — `risk_signal_alerts` (`v8/execution-control.routes.ts:128-132`), `delay_signals` (`:410-418`) → cross-org tamper flagi dismiss.

### (b) FRONTEND / UX (FAZA 3)
- **[P2] martwy kod do wycięcia** — `ImplementationView.tsx` (importowany, nigdy renderowany), `views/ExecutionView.tsx` (hardcode `projectId="default"`), `ExecutionDetailPanel.tsx`. Kandydaci do weryfikacji konsumentów: `PeopleChangeWorkspace`/`RiskSignalsPanel`/`DelayDetectionPanel`/`ReportCompactPanel`.
- **[INTEGRACJA P1] feed-forward M14→M15 martwy.** `ExecutionHub.tsx:945` — ROI fallback puste; M15 czyta własne tabele niezależnie; brak eksportu sygnałów (budget_health, roi_delta) do `v8_roi_realization_entries` + brak deep-linku `?initiativeId=` do Results. **Dziura w kręgosłupie produktu.** Fix: realny export sygnałów przy zmianie snapshotu + deep-link Execution→Results.

### (c) INTEGRACJA / TESTY E2E (FAZA 2 + 4)
- **[P0 testowy] `rollout.routes` bez testów BE** (S5 trwałość) — dodać `server/src/routes/__tests__/rollout.routes.test.ts`.
- **[P0 testowy] env-drift** — decision-management PG `role "iris" does not exist`; E2E hardcoded `localhost:3005`; execution-center E2E ×6 (`status-filter-EXECUTING` nie istnieje, handoff `/benefits` blokowany beta-gatingiem M15).
- **[P1] zero pokrycia S2 (kanban-DnD), S6 (raporty live-data)**; action-queue/health endpoint nietestowany.
- **[P1] CI** — `test-suite.yml` tylko `main`/`develop` → PR `feat/*`→`Londyn` nie uruchamia żadnego testu M14; nawet na main/develop joby „Deferred". Deploy-gate smoke nightly (21/21); execution-center+decision-mgmt weekly (czerwone). Dodać `Londyn` + promować kluczowe do PR-gate.
- **[P2]** mock-drift react-i18next (3, PeopleChangeWorkspace, `t(key,{defaultValue})`).

### (d) §27 + i18n (FAZA 4 — największy dług)
- **[P1] 5 tabel Rollout poza kanonem** (KPI/Risk/Change/Closure/Plan) — surowy `<table>` (`RegisterTable`, `RolloutTab:1130`): zero preview/filtrów/sortu/resize/kebaba/bulk. **Największy dług §27.** → `FilterableTable`+preview+filtry+sort+resize+kebab+bulk.
- **[P1] §27.D bulk-bar Portfel** = tylko „N selected · Clear" (`ExecutionHub.tsx:4855-4870`) — zero akcji.
- **[P2] §27.F Manager lanes** CSS grid zamiast `FilterableTable` (brak filtrów/sortu).
- **[P2] ~141 kluczy `t()` brak w PL `translation.json`** (działa przez inline-fallback) + hardcoded stringi w presetach raportów (`:3338-3343`). Symetria kluczy 399=399, ale PL niekompletne. Dopisać ~141 kluczy PL.

## 3. Kroki realizacji
1. **(FAZA 2)** Gating pilota serwerowo — Rollout CRUD odrzuca pilota (`requireOrgRole` + capability), pilot API → 403.
2. **(FAZA 2)** Baner przy cichej degradacji PMO health/action-queue (`:1301/:1317`).
3. **(FAZA 2, INTEGRACJA)** Feed-forward M14→M15: export sygnałów ROI do `v8_roi_realization_entries` + deep-link `?initiativeId=` do Results.
4. **(FAZA 2/4)** Testy: BE `rollout.routes` (S5), kanban-DnD (S2), raporty live-data (S6), action-queue/health; fix env-drift (seed/role „iris", `localhost:3005`); rewrite execution-center E2E.
5. **(FAZA 3)** Wytnij martwy kod (`ImplementationView`/`views/ExecutionView`/`ExecutionDetailPanel` + zweryfikuj 4 kandydatów); org-guard `ON CONFLICT` dismiss (`risk_signal_alerts`/`delay_signals`).
6. **(FAZA 4)** §27 Rollout 5 tabel → FilterableTable; bulk-bar Portfel z akcjami; Manager lanes → FilterableTable; ~141 kluczy PL + presety raportów do `t()`; dodać `Londyn` do CI + PR-gate.

## 4. DoD (6 kryteriów — bramka 6/6)
1. **Front↔back:** zero martwych przycisków (bulk-bar z akcjami); feed-forward M14→M15 żywy (zmiana budżetu → sygnał w M15); Rollout trwały po reload; budgetHealth z realnych danych (naprawione).
2. **Bezpieczeństwo:** cross-org budżet + task_dependencies zamknięte (naprawione); gating pilota serwerowy (403); org-guard na `ON CONFLICT` dismiss.
3. **i18n:** ~141 kluczy PL dopisane; 0 inline-fallbacków, 0 hardcoded w presetach.
4. **Tokeny:** Visual Standard.
5. **§27:** 5 tabel Rollout + Manager lanes przez FilterableTable; bulk-bar Portfel z akcjami; A-S czyste per tabela.
6. **E2E w PR-gate:** S5 (rollout BE) + S2 (kanban-DnD) zielone na `Londyn`.

## 5. Weryfikacja
- Cross-org: admin org-A nie nadpisze budżetu inicjatywy org-B; cross-org task_dep → 403 `EXECUTION_TASK_ORG_MISMATCH` (testy; naprawione).
- Pilot: rola pilot wywołuje Rollout CRUD przez API → 403.
- S2: kanban DnD status → reload → trwałość (żywe przejście + screenshot).
- S5: Rollout edycja (Plan/KPI/Risks/Change/Closure) → reload → trwałe (`/api/rollout/*`).
- Feed-forward: zmiana budżetu/snapshotu w M14 pojawia się jako sygnał w M15 Rezultaty.
- §27: 5 tabel Rollout z preview/filtrami/sortem/kebabem (screenshot).
- **Kluczowe Railway:** wartość `ENABLE_V8_GLOBAL` na staging/prod (decyduje o Manager lanes + osiągalności v8 ścieżek); migracja `20260608_rollout_tables.sql` zastosowana. **Uwaga DB:** dev `.env` → Railway PROD — ostrożność z zapisami przy smoke.

## 6. Zależności
- Reuse dokumentu/panelu inicjatywy ← M13; decyzje/taski w Action Queue ← M03; handoff czatu ← M01.
- **Feed-forward M14→M15** — koordynować z WP M15 (deep-link celuje w beta-closed Rezultaty; domknąć po otwarciu bety — per MASTER §5 zależności).
- §27 Rollout + persistKey + RC — wspólny wzorzec z M03/M10/M13 (sweep FAZA 4).
- CI `Londyn` + i18n PL keys — systemowe wspólne z M01/M03/M10/M13/M25.
