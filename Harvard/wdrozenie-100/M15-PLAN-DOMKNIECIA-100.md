# M15 „Rezultaty" — PLAN DOMKNIĘCIA DO 100% (SSOT operacyjny)

> Start planu: 2026-06-25 · Branch: `feat/deliverables-w1` · Deploy odbioru: demo (worktree→origin/demo, Railway autodeploy)
> Środowisko verify: lokalny backend `:3001` (DOTENV_IGNORE_LOCAL=1) → staging-trolley, org DBR77 `a3e05d4a`. Login: **`piotr.wisniewski@dbr77.com`/123456**.
> Zasada twarda: M15 nie jest ZAMKNIĘTY póki nie ma 8/8. Każdy task ma własne bramki realizacji + dowód. Zero fake-greenów (każdy „green" = file:line / artefakt / live-verify).
> Dokumenty siostrzane: `M15-STAN-PRACY-ODBIORY.md` (master 36 zadań — PRZESZACOWANY, korygowany tym planem), `M15-WIZJA-I-PLAN-FUNKCJONALNY-2026-06-24.md`, `M15-ANALIZA-SWIATOWA-2026-06-24.md` (10 prymitywów + standard graficzny), `M15-AUDYT-2026-06-24.md`, `M15-PLAN-TESTOWANIA.md`. Spec testów: `Harvard/Testy manualne/TESTY_M15_REZULTATY_W1_W6.md` (180), wyniki: `WYNIKI_*_RUN1/2/3.md`.

---

## 0. PUNKT WYJŚCIA — prawda po audycie 2026-06-25

**Co JEST zrobione i zweryfikowane (twardo):**
- Rejestr bugów **BUG-01÷22 (+19b) domknięty** — sweep kontraktowy API **18/18 PASS live**.
- **370/370 testów unit serwisów** zielone (`tests/unit/results/`, 24 pliki) — warstwa logiki mocno pokryta.
- Rdzeń DB-backed i wiarygodny: **VDT (W2)**, **signals (W3)**, **value-intelligence + scorecard (W4)**, **BSC + BDN (W5)**, **narrative + finance-link (W6)**.
- 4 routery zamontowane (`Gateway.ts:923-926`), 5 paneli FE renderowanych za flagami.
- Transfer pracy poprzedniego agenta **poprawny** (git: `de0fdd1ddb` przodkiem `35127e7c6c`, zero strat).

**Co BLOKUJE 100% (luki głębi — sedno tego planu):**
| Obszar | Stan realny | Klasa luki |
|---|---|---|
| W5 Sustainment (5.7/5.8) | route **STUB** — `realizationPct:0`, `lastReviewIso:null` zaszyte → `sustained`/`at-risk` nieosiągalne | facada |
| W5 OKR (5.2) | `okrService` **martwy** (0 importów), brak UI | vapor |
| W5 DICE (5.6) | `diceScore` **nieosiągalny z HTTP** | martwy kod |
| W5 Adoption (5.5) | `adoptionScore` = realizacja/1000 — **proxy**, nie pomiar | proxy nieoznaczony |
| W1 Benefit Profiles (1.2) | endpoint działa, **żaden panel FE go nie woła** | sierota |
| W4/W6/W3 finanse (4.3/6.5/6.8/3.3) | realne agregaty + **zaszyte parametry** (`periodMonths=6`, mnożniki cashflow, syntetyczny pre-trend, `capacityFte=1`) | założenia nieoznaczone |
| W6 Anomaly (6.4) | **plik serwisu zagubiony** w previous-session sweep | brak |
| W6 Forecast/RCA (6.1/6.2) | serwisy gotowe, **UI = placeholder** | niepodpięte |
| W2 Value Funnel viz (2.19–2.24) | endpoint `/funnel` **404** | brak |
| **Testy systemowe** | **0** route/integration, **0** FE-component, **0** E2E dla W1–W6 (jedyny E2E = M14 handoff) | brak piramidy |
| **Manual 180** | nigdy nie przebiegł **czysto 180/180** po naprawach; **0 screenshotów** (artefakt Manual = 0/180) | brak dowodu |

**Korekta dashboardu (master SSOT pokazuje `M15 … 0/6 0/7 ⬜ NIE ROZP.` — nieprawda):**

| # | Moduł | Epiki | DoD | Kod | Manual | UI | →F | →UI | Status realny |
|---|---|---|---|---|---|---|---|---|---|
| M15 | Rezultaty | 5/6 | 4/7 | 370✅ (serwisy) / 0 (route+E2E) | 0/180 (artefakt) | 🟡 | ⬜ | ⬜ | 🟡 W TOKU — rdzeń zbudowany+otestowany na logice; domknięcie = ten plan |

---

## 1. SYSTEM ODBIORU — 8 bramek (jak w master SSOT)

**Bramki realizacji (CTO):** ① Kod · ② DoD 7/7 · ③ Epiki · ④ Testy (unit+integ+E2E zielone w CI) · ⑤ Zgodność UI/UX (10 prymitywów, kanon).
**Bramki odbioru (Piotr):** ⑥ Deploy demo · ⑦ →F (klikasz, działa) · ⑧ →UI (screeny, UX odebrany).
**ZAMKNIĘTY = 8/8.**

### DoD 7/7 — stan M15 + warunek domknięcia
| # | Kryterium | Stan | Warunek zaliczenia |
|---|---|---|---|
| 1 | Front↔back, zero fasad/mocków/martwych przycisków | 🔴 | Seria D — zlikwidować stub/vapor/sieroty/niepodpięte |
| 2 | Bezpieczeństwo (0 P0/P1, każda naprawa z testem regresji) | 🟡 | Seria T — testy izolacji org (SEC) + 401, regresje |
| 3 | i18n pełne PL/EN przez `t()` | 🟡 | Seria Z — audyt kluczy 5 paneli, 0 bare-missing |
| 4 | Tokeny kolorów (0 rose/hex, `EntityStatusChip`/`c.*`) | 🟡 | Seria U — skan 5 paneli + prymitywów |
| 5 | §27 (listy przez FilterableTable + Menu 1/2/3) | 🟡 | Seria U — sprawdzić listy sustainment/signals/scenariusze |
| 6 | E2E w PR-gate (scenariusze S zielone) | 🔴 | Seria T — route+E2E na CI |
| 7 | Zgodność komponentów ze standardem (SSOT canon) | 🟡 | Seria U — 10 prymitywów + 17 ekranów |

---

## 2. DECYZJE PIOTRA — build vs descope (potrzebne PRZED Serią D)

Kilka luk to fork „dobuduj teraz" vs „jawnie odroć do v1.1". Rekomendacja CTO w nawiasie. Potwierdź, a rozpisuję resztę na pod-kroki i ruszam.

| # | Obszar | Opcja A (build v1.0) | Opcja B (descope v1.1 z jawnym oznaczeniem) | Rekomendacja |
|---|---|---|---|---|
| Dec-1 | **OKR cascade (5.2)** | panel read-only Objective→KR + model danych | usuń fałszywe 🟢, BSC zostaje deliverable W5, OKR→v1.1 | **B** (brak źródła danych OKR; duży build; BSC pokrywa potrzebę zarządczą) |
| Dec-2 | **DICE (5.6)** | wepnij `diceScore` jako pole w `/adoption` + badge | descope | **A** (tanie: serwis+testy są, 1 pole + badge) |
| Dec-3 | **Adoption real (5.5)** | wepnij realny ADKAR/sentiment z M14 | zostaw proxy, ale **oznacz w UI** „proxy z realizacji" | **B** (proxy oznaczony uczciwie; realny ADKAR = v1.1 gdy M14 dane) |
| Dec-4 | **Anomaly (6.4)** | odtwórz serwis (z-score+IQR) + unit + placeholder UI | descope | **A** (odtworzenie serwisu tanie, przywraca epik 6.4) |
| Dec-5 | **Forecast/RCA UI (6.1/6.2)** | dobuduj read-only panele | zostaw jako „AI premium — v1.1" placeholder | **B** (serwisy gotowe+testowane; UI premium = naturalnie v1.1) |
| Dec-6 | **Value Funnel viz (2.19–2.24)** | wepnij endpoint `/funnel` + minimalna wiz | descope (6 scenariuszy) | **A** (`valueFunnelService` 18/18 gotowy; brakuje tylko trasy+viz) |
| Dec-7 | **Parametry syntetyczne** (periodMonths/capacityFte/cashflow/pre-trend) | wepnij realne źródła (effect_start_date, tabela capacity) | zostaw, ale **oznacz w UI jako założenia** + wepnij te, gdzie dane są | **MIX** (periodMonths z `effect_start_date` realnie; reszta = oznaczone założenie v1) |

> Domyślny rekomendowany zakres „M15 v1.0 ZAMKNIĘTY" = Dec-2 A, Dec-4 A, Dec-6 A; Dec-1/3/5 B (jawny descope z oznaczeniem); Dec-7 MIX. To domyka realne fasady, a premium/duże buildy uczciwie odracza — bez fałszywych 🟢.

### ✅ DECYZJA PIOTRA (2026-06-25): **ZAKRES MAKSYMALNY — wszystko teraz, pełne 6/6 epików, ZERO descope.**
Dec-1..7 = **wszystkie opcja A**:
- Dec-1 A: **OKR cascade** — model danych Objective→Key Results + panel read-only + scoring/check-in.
- Dec-2 A: **DICE** wepnięty w `/adoption` + badge.
- Dec-3 A: **realny ADKAR/sentiment z M14** jako predyktor ryzyka korzyści (nie proxy).
- Dec-4 A: **anomaly** serwis odtworzony (z-score+IQR) + unit + UI.
- Dec-5 A: **Forecast/RCA** — pełne read-only panele UI (nie placeholder).
- Dec-6 A: **Value Funnel** endpoint `/funnel` + wizualizacja.
- Dec-7 A: **realne źródła** parametrów — periodMonths z `effect_start_date`, capacity z realnej tabeli, cashflows/pre-trend z danych (gdzie dostępne; brak → jawne założenie oznaczone).

Rozszerzona Seria D (poniżej) zawiera dodatkowo **D10 (OKR cascade)** i **D11 (Forecast/RCA UI)**; D4 = realny ADKAR (nie tylko etykieta).

---

## 3. ZADANIA — serie D / T / U / Z

Legenda bramek per task: **Kod** (wpięte) · **DoD** (dotknięte kryteria) · **Test** (unit/integ/E2E) · **Manual** (Playwright+png) · **UI** (prymitywy/kanon) · **dowód**.

### SERIA D — Domknięcie funkcjonalne (DoD #1: zero fasad) — *rdzeń pracy*

| Task | Zakres | Pliki | Bramka odbioru (kryterium „done") |
|---|---|---|---|
| **D1** | **Sustainment de-stub** — `/sustainment` czyta realne dane: `ownershipTransferred` z `owner_user_id`/status COMPLETED; `realizationPct` z ROI (jak `/signals`); `lastReviewIso` = `initiative.updated_at` (proxy aktywności) lub `benefits_register` review-date. Cel: statusy `sustained`/`at-risk`/`overdue-review`/`unowned` **wszystkie osiągalne z realnych danych**. | `resultsExtended.routes.ts:338-377` | Endpoint zwraca ≥2 różne statusy na realnych danych DBR77 (live-verify curl); unit serwisu pokrywa 4 ścieżki; testy 5.15–5.20 odblokowane |
| **D2** | **Benefit-profiles → UI** — wepnij osierocony `/benefit-profiles` w panel (Strategic lub nowy „Profil korzyści"); render typ/kategoria/dis-benefit/realizationPct/owner. | `StrategicLayerPanel.tsx` (+ ew. nowy `BenefitProfilesPanel.tsx`), `ResultsHub.tsx` | Panel renderuje 9 profili DBR77 live (screenshot); flaga `ff_*`; testy 1.7–1.19 osiągalne z UI |
| **D3** | **DICE wire (Dec-2 A)** — `diceScore` jako pole w `/adoption` + badge „korzyść zagrożona adopcją" w panelu. | `resultsExtended.routes.ts:305-334`, `adoptionBenefitRiskService.ts`, `StrategicLayerPanel.tsx` | `/adoption` zwraca `diceScore`+flagę; badge widoczny; testy 5.6 osiągalne |
| **D4** | **Adoption honest-label (Dec-3 B)** — oznacz `adoptionScore` w UI jako „proxy z realizacji (v1)"; backend komentarz już jest. | `StrategicLayerPanel.tsx` | UI pokazuje etykietę proxy; brak udawania realnego pomiaru |
| **D5** | **Anomaly restore (Dec-4 A)** — odtwórz `kpiAnomalyService.ts` (z-score + IQR) + unit testy; placeholder UI w `AIInsightsPanel`. | nowy `services/results/kpiAnomalyService.ts`, `tests/unit/results/kpiAnomalyService.test.ts` | Serwis + ≥12 unit zielone; epik 6.4 przywrócony |
| **D6** | **Value Funnel endpoint+viz (Dec-6 A)** — trasa `/funnel` na `valueFunnelService` + `FunnelStage` prymityw w panelu. | nowy handler w `resultsExtended.routes.ts` lub `resultsValueIntelligence`, `ValueDriverTree`/nowy, `ResultsUIPrimitives.tsx` | `/funnel` 200 z etapami; viz renderuje; testy 2.19–2.24 osiągalne |
| **D7** | **Run-rate realny `periodMonths` (Dec-7 MIX)** — licz okno z `roi_assumptions.effect_start_date`→teraz zamiast `=6`; gdy brak daty, oznacz „założenie 6 mies." w UI. | `resultsExtended.routes.ts:200` | `periodMonths` wyliczone z danych ≥1 inicjatywy; etykieta założenia gdy brak |
| **D8** | **Oznacz pozostałe założenia (Dec-7 MIX)** — scenarios (mnożniki cashflow), counterfactual (pre-trend), reallocation (`capacityFte=1`) → widoczna nota „model/założenie v1" w UI; backend bez zmian. | `PortfolioInsightsPanel.tsx`, `AIInsightsPanel.tsx` | Każda sekcja z wyliczeniem pochodnym ma jawną notę założeń |
| **D9** | **Korekta master-trackera** — `M15-STAN-PRACY-ODBIORY.md`: zdejmij fałszywe 🟢 (5.2 OKR, 5.6 DICE przed D3, 5.7 sustainment przed D1), oznacz 🟡/🔴 z dowodem file:line; OKR/forecast/RCA → „v1.1" (jeśli Dec-1/5 = B). | `M15-STAN-PRACY-ODBIORY.md` | Tracker = prawda; zero rozbieżności z kodem |

### SERIA T — Testy: piramida systemowa (DoD #2/#6) — *bez tego brak powtarzalnego dowodu*

| Task | Zakres | Pliki | Bramka odbioru |
|---|---|---|---|
| **T1** | **Testy route/integration** dla 3 routerów (`results-extended`, `results-strategic`, `results-driver-tree`) — kontrakt każdego endpointu (kształt payloadu, aliasy, agregaty, izolacja org, 401). | nowe `tests/integration/results/*.routes.test.ts` | ≥1 plik/router, kontrakty z Run 1–3 zakodowane jako asercje, zielone w CI |
| **T2** | **Testy FE-component** 5 paneli (StrategicLayerPanel, ValueDriverTree, AIInsightsPanel, PortfolioInsightsPanel, + BenefitProfiles z D2) — render za flagą, empty-state, badge'e. | nowe `tests/components/results/*.test.tsx` | ≥1 plik/panel, mock API, zielone |
| **T3** | **E2E W1–W6** (Playwright + screenshot/scenariusz) — złota ścieżka każdej zakładki Strategic/AI za flagami; wzorzec z `m15-results-cockpit.spec.ts`. | nowe `tests/e2e/m15/*.spec.ts` | 6 spec (po 1/fala), screenshoty w `tests/e2e/screenshots/`, zielone |
| **T4** | **Pełny re-run Manual 180** — przejście `TESTY_M15_REZULTATY_W1_W6.md` §1–§6 po wszystkich naprawach, 1 screenshot/scenariusz, zapis `WYNIKI_*_RUN4.md`. Cel: **180/180 z dowodem** (PASS lub jawny descope/BLOCKED z przyczyną). | `WYNIKI_M15_REZULTATY_W1_W6_RUN4.md`, `tests/e2e/screenshots/cases/_montage_m15_*.png` | Artefakt Manual = 180/180 sklasyfikowane; brak „nigdy nie wykonane" |
| **T5** | **Testy SEC + regresji** (DoD #2) — izolacja org (2. konto), 401 bez tokenu, regresja każdego BUG-01÷22. | rozszerzenie T1 + `tests/integration/results/security.test.ts` | SEC zielone; każdy naprawiony bug ma test regresji |

### SERIA U — UI/UX: standard graficzny (DoD #4/#5/#7, kryt. 7)

| Task | Zakres | Pliki | Bramka odbioru |
|---|---|---|---|
| **U1** | **Migracja na 10 prymitywów M15** — panele używają `ResultsUIPrimitives` (ValueCard, RagPill, FunnelStage, ScorecardGrid, WaterfallBar, ExecValueHeader, ValueDrawer…), zero jednorazowych stylów. | `StrategicLayerPanel/AIInsightsPanel/PortfolioInsightsPanel/ValueDriverTree.tsx` | Każdy panel z prymitywów; 0 ad-hoc stylów |
| **U2** | **Tokeny + §27** — skan rose/hex w 5 panelach (→`c.*`/EntityStatusChip); listy (sustainment/signals/scenariusze) przez FilterableTable + Menu 1/2/3 gdzie listowe. | 5 paneli | 0 rose/hex; listy zgodne z §27 |
| **U3** | **Pakiet 17 ekranów** — capture spec light+dark, PL+EN, zapis `docs/qa/screens/m15-2026-XX/` + README mapa ekranów. | nowy `tests/e2e/m15/m15-ui-capture.spec.ts` | 17 ekranów × (light/dark) na dysku; README |

### SERIA Z — Zamknięcie + odbiory (bramki 6–8)

| Task | Zakres | Bramka odbioru |
|---|---|---|
| **Z1** | **i18n PL/EN** (DoD #3) — audyt kluczy 5 paneli, `check-bare-missing` = 0, live PL+EN. | 0 bare-missing; oba języki live |
| **Z2** | **Deploy demo** — merge `feat/deliverables-w1`→demo, flagi `ff_strategicLayer/ff_valueTree/ff_aiInsights/ff_portfolioInsights` ON na demo, Railway build SUCCESS. | M15 żywy na demo, flagi ON, /api/health 200 |
| **Z3** | **→F (Piotr)** — klikasz Strategic + AI+Portfolio na demo, wszystkie sekcje działają na realnych danych. | Piotr akceptuje funkcję |
| **Z4** | **→UI (audytor + Piotr)** — przegląd 17 ekranów (U3), UX odebrany. | Piotr akceptuje grafikę |

---

## 4. KOLEJNOŚĆ WYKONANIA (sekwencja)

```
DECYZJE (Dec-1..7)  →  SERIA D (D1→D9)  →  SERIA T (T1→T5)  →  SERIA U (U1→U3)  →  SERIA Z (Z1→Z4)
   ~10 min Piotr        rdzeń: fasady→0      piramida testów      standard graficzny    deploy+odbiory
```

Twardy warunek przejścia między seriami:
- D→T: wszystkie fasady zlikwidowane (DoD #1 ✅), master-tracker skorygowany (D9).
- T→U: piramida zielona w CI + Manual 180/180 z dowodem (DoD #2/#6 ✅).
- U→Z: 10 prymitywów + tokeny + §27 (DoD #4/#5/#7 ✅).
- Z: deploy + →F + →UI = **8/8 ZAMKNIĘTY**.

## 4b. POSTĘP — SERIA D ✅ UKOŃCZONA (2026-06-25)

Wszystkie fasady zlikwidowane, każda zmiana live-verified (curl, realne dane) + tsc clean. Commity na `feat/deliverables-w1`:

| Task | Status | Dowód live | Commit |
|---|---|---|---|
| D1 sustainment de-stub | ✅ | 3 statusy: sustained=31, overdue=18, unowned=68 (był tylko unowned) | `ef4a76a41e` |
| D3 DICE wire | ✅ | diceScore+zone w /adoption (10/win, 16/worry, 13/win) | `ef4a76a41e` |
| D4 realny ADKAR adoption | ✅ | dataSource=change-management; Data Analytics 0.90/improving, F1-26 0.20/declining/at-risk, F3 0.55/flat | `ef4a76a41e` |
| D5 anomaly restore | ✅ | kpiAnomalyService + 18 unit PASS | `ef4a76a41e` |
| D6 funnel endpoint+viz | ✅ | /funnel: ideas=105/validated=6/inflight=6 + VaR; FunnelStage w panelu | `ef4a76a41e`+`5439e5dd89` |
| D7 realny periodMonths | ✅ | =3 z effect_start_date (assumed:false), runRate=844k | `ef4a76a41e` |
| D8 realny capacity + założenia | ✅ | capacityAssumed flag + noty UI run-rate/realloc/scenarios | `ef4a76a41e`+`5439e5dd89` |
| D11 Forecast/RCA UI | ✅ | sekcje anomaly+forecast+RCA w AIInsightsPanel | `5439e5dd89` |
| D2 benefit-profiles→UI | ✅ | sekcja „Profil korzyści" (był sierota); 9 profili | `256296278b` |
| D10 OKR cascade | ✅ | /okr lazy-DDL+cascade: parent rollup=0.32, dzieci 0.76/0.22; sekcja UI kaskady | `256296278b` |
| D9 korekta trackera | ✅ | ten plik + M15-STAN-PRACY-ODBIORY (poniżej) | — |

**Stan DoD po Serii D:** #1 front↔back ✅ (0 fasad — wszystkie endpointy DB-backed, panele wpięte). Pozostaje #2/#6 (Seria T), #3/#4/#5/#7 (Seria U/Z).
**Pozostało do 8/8:** Seria T (testy route+FE+E2E + Manual 180) · Seria U (10 prymitywów już użyte przez panele — zostają screenshoty 17 ekr.) · Seria Z (i18n keys do translation.json, deploy, →F, →UI).

## 5. DEFINICJA UKOŃCZENIA (M15 = 8/8)

M15 „Rezultaty" jest ZAMKNIĘTY gdy:
1. ① Kod — 0 fasad (Seria D), master-tracker = prawda.
2. ② DoD 7/7 — wszystkie kryteria z dowodem.
3. ③ Epiki — 6 fal zielone (z jawnym descope OKR/forecast/RCA→v1.1, jeśli tak zdecydowano).
4. ④ Testy — route+FE+E2E zielone w CI **+ Manual 180/180** z artefaktem.
5. ⑤ UI/UX — 10 prymitywów, tokeny, §27.
6. ⑥ Deploy demo — żywy, flagi ON.
7. ⑦ →F — Piotr odebrał funkcję.
8. ⑧ →UI — Piotr odebrał grafikę.

> Po Twojej decyzji (Dec-1..7) rozpisuję D1 na pod-kroki techniczne i ruszam Serią D. Każdy task zamykam z dowodem (file:line / curl / screenshot) i odhaczam w tym pliku.
