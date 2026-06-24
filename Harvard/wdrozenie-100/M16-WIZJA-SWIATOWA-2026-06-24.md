# M16 „Finanse" — WIZJA POZIOMU ŚWIATOWEGO + INICJATYWY (analiza strategiczna)

> Czy M16 dowozi to, co najlepsi konsultanci świata używają do napędzania DECYZJI i WDROŻENIA transformacji? Co dodać/zmienić, by osiągnąć poziom światowy w zarządzaniu operacją i transformacją organizacji. Potencjalne inicjatywy per funkcjonalność + nowe funkcjonalności + standard graficzny. Synteza 4 soczewek partnerskich (value-office / decyzje-kapitał / FP&A-AI / złota-nić), ugruntowana w kodzie. Program wykonawczy: `M16-STAN-PRACY-ODBIORY.md`. Audyt techniczny: `M16-AUDYT-DETALICZNY-2026-06-24.md`.

---

## TEZA NADRZĘDNA (diagnoza wyższego rzędu niż audyt techniczny)
Audyt techniczny trafnie diagnozuje M16 jako **mocny FP&A (~70%) z martwymi obietnicami i split-brainem**. Ale z perspektywy *celu platformy* — napędzania transformacji — diagnoza jest ostrzejsza:

> **M16 zbudowano jako „finanse SPÓŁKI" (jak wygląda firma: sprawozdania→model→wskaźniki→DCF). Brakuje całej warstwy „finansów TRANSFORMACJI" (jak płynie wartość: inicjatywa→baseline→realizacja→zaksięgowany efekt). To dwie różne dyscypliny. Pierwszą M16 ma. Drugiej — która jest sednem pracy McKinsey RTS / BCG TURN / Bain RDP — praktycznie nie ma.**

**System dziś odpowiada na pytanie „ile warta jest TA inicjatywa / jak wygląda firma?". NIE odpowiada na pytania zarządu, które definiują światowego konsultanta:**
- *Które z 30 inicjatyw sfinansować, w jakiej kolejności, przy budżecie X i jakim ryzyku?* (brak portfela/alokacji kapitału)
- *Gdzie utknęła wartość transformacji i ile realnie „zeszło z budżetu"?* (brak value bridge / banking)
- *Czy to, co inicjatywa obiecała, uzgadnia się ze zaimportowanym sprawozdaniem?* (brak reconciliation realized↔księgi)

Most między M16 (liczby) a M13→M14→M15 (transformacja) jest **zadeklarowany typami w bazie, ale pusty** („Unlinked 86", inicjatywa rodzi się bez liczb). To większa luka niż wszystkie P0 audytu — bo P0 naprawiają *FP&A*, a tu brakuje *drugiego produktu* zbudowanego NA FP&A.

**Werdykt:** fundament (tie-out engine 3-statement + LLM import) to najtrudniejsza, rzadka na rynku część — i ją MAMY. Do poziomu światowego brakuje **trzech warstw nadbudowy + domknięcia złotej nici + moatu AI**. To nie przepisywanie — to celowa nadbudowa.

---

## 5 WARSTW DOCELOWYCH (architektura wartości poziomu światowego)

```
 W5  AI-NATIVE MOAT          driver-suggester · NL→model · anomaly · variance-narracja · copilot
 W4  ZŁOTA NIĆ (pętla)       M16→M13→M14→M15: business-case→realizacja→reconciliation vs księgi
 W3  MOTOR WARTOŚCI          value bridge · stage-gates · frozen baseline · run-rate · banking
 W2  DECYZJE & KAPITAŁ       portfolio board · capital rationing · rNPV · Monte Carlo · real options
 W1  PLANOWANIE FP&A         driver-tree · rolling forecast · variance bridge · scenariusze · what-if
 W0  PRAWDA KSIĘGOWA  ✅~70%  statements(tie-out) · model 3-statement · wskaźniki · DCF   ← MAMY
```
M16 dziś = solidne **W0**. Poziom światowy = **W0+W1+W2+W3+W4+W5**. Każda wyższa warstwa stoi na niższej (np. portfel decyzyjny W2 wymaga wiarygodnego NPV z W0, a value bridge W3 wymaga business-case z W4).

---

## CZY ZGODNE Z NAJLEPSZYMI? — gap per soczewka (zweryfikowane w kodzie)

| Soczewka | Co robią najlepsi | Stan M16 |
|--|--|--|
| **Value office** (RTS/TURN/RDP) | value bridge baseline→banked, stage-gates G0-G5, frozen baseline, run-rate/one-time split, leakage haircut, banking the value | 🔴 brak całej warstwy; jest tylko księgowy `approve` |
| **Decyzje & kapitał** | portfel NPV×ryzyko, capital rationing (PI/knapsack), hurdle-rate per ryzyko, rNPV, Monte Carlo, real options, efficient frontier | 🔴 kalkulator 1 inicjatywy; NPV 10%/WACC płaski; zero portfela |
| **FP&A produkt** (Pigment/Cube/Anaplan) | driver-based planning, rolling forecast, budget-vs-actual, scenariusze żywe, what-if | 🔴 brak warstwy forward-looking; scenariusze martwe; variance brak |
| **Złota nić** (TMO/MSP) | golden thread inicjatywa→KPI→linia→wartość, living business case, benefit S-curve, attribution, reconciliation | 🟡 80% w tabelach, ZERWANA na 4 szwach (inicjatywa pusta, Unlinked 86, handoff w martwą tabelę, brak reconciliation↔księgi) |

**Najtańsze „światowe" wygrane (dane JUŻ policzone, blokuje render/kontrakt):** football field wyceny (silnik liczy `valueBridge/scenarioComparison`, FE nie renderuje) · sensitivity heatmapa (silnik emituje `{table,waccGrid}`, FE oczekuje `matrix` → bug kontraktu) · attribution anti-double-count (`kpiAttributionService` liczy, niewpięty w rollup). Trzy światowe artefakty zablokowane wyłącznie bugami FE.

---

## POTENCJALNE INICJATYWY — per funkcjonalność (zdeduplikowane z 4 soczewek)

> Konwencja: **NOWA** = nowa funkcjonalność do dołożenia · **FIX** = ożywienie martwej skorupy · **DOMKNIĘCIE** = spięcie istniejących-ale-rozłączonych silników. ~40 inicjatyw zmapowanych na pfilary.

### PILAR 0 — Wiarygodność liczb (fundament, najtańsze wygrane)
- **P0.1 WACC/CAPM Engine (org-level SSOT)** [FIX] — realny WACC (ke=rf+β·ERP, kd·(1−t), wagi D/E) z istniejącego interfejsu `WaccBreakdown`; jedno źródło stopy dla wyceny i każdego NPV. Naprawia DWIE skorupy (flat-12 + hardcoded-10%).
- **P0.2 Football Field render** [FIX] — silnik liczy zakresy DCF/comps; FE dorobić render (poziome pasy + triangulacja).
- **P0.3 Sensitivity heatmap render** [FIX] — naprawa kontraktu FE↔BE (`table/waccGrid` → heatmapa WACC×g).
- **P0.4 Server-side finance engine jako SSOT** [DOMKNIĘCIE] — część obliczeń żyje w przeglądarce (rozjazd z deckiem/raportem); jeden audytowalny silnik liczb.

### PILAR 1 — Planowanie FP&A (W1, forward-looking)
- **P1.1 Driver-Tree Planner** [NOWA, fundament] — drzewo driverów (Przychód=klienci×ARPU×retencja), formuły komponowalne, propagacja do 3-statement.
- **P1.2 Multi-Scenario Compute** [FIX] — ożywić martwe scenariusze base/bull/bear (silnik liczy 1 przebieg → realny compute per-scenariusz, schemat outputs już wspiera).
- **P1.3 Rolling Forecast Engine** [NOWA] — re-forecast (actual+plan), roll-forward, snapshoty wersji.
- **P1.4 Budget-vs-Actual Variance Bridge** [NOWA, audyt P0] — waterfall plan→actual (wolumen/cena/mix/koszt), F/U, YTD, drill-down.
- **P1.5 What-if / Sensitivity real-time + Tornado** [NOWA] — suwaki driverów, natychmiastowy przelicz, tornado 1-zm. + heatmapa 2-zm.
- **P1.6 Schedules: Working-Capital + Debt + Depreciation + Tax** [NOWA] — DSO/DPO/DIO, harmonogram długu (odsetki z salda), amortyzacja z PPE, podatek=stawka×EBT (dziś ręczne/placeholder).
- **P1.7 Headcount / Workforce Planner** [NOWA] — plan per-rola (salary/ramp/loaded) → OPEX+cash.
- **P1.8 Cash / Liquidity Forecast** [NOWA] — direct cash, runway, min-cash alerty.

### PILAR 2 — Decyzje & alokacja kapitału (W2)
- **P2.1 Portfolio Prioritization Board** [NOWA] — bąbelki NPV×ryzyko×nakład, ranking, „fund/defer/kill"; zaciąga CAŁY portfel M13 (dziś link 1:1).
- **P2.2 Capital Rationing Solver** [NOWA] — PI ranking + 0/1 knapsack przy budżecie B; accepted/rejected/deferred.
- **P2.3 Hurdle-Rate per klasa ryzyka** [NOWA] — WACC + premia (rdzeń/transformacja+3-5pp/R&D+8-12pp); inicjatywa dziedziczy stopę po kategorii.
- **P2.4 Risk-Adjusted Value (rNPV)** [NOWA] — NPV×P(sukces) + leakage haircut; ranking po wartości skorygowanej.
- **P2.5 Monte Carlo na NPV** [NOWA] — rozkłady na driverach → histogram NPV, P(NPV>0), P10/P50/P90, VaR.
- **P2.6 Real-Options Valuation** [NOWA] — defer/scale/abandon (dwumianowa/B-S); rekomendacja „pilot→bramka→skala".
- **P2.7 Efficient Frontier portfela** [NOWA] — wartość vs ryzyko portfela; obecny vs optymalny mix.

### PILAR 3 — Motor wartości transformacji (W3, „value office")
- **P3.1 Value Bridge Waterfall** [NOWA, flagowy] — Baseline→Identified→Committed→In-flight→Realized→Banked; jeden obraz transformacji dla zarządu, drill-down do inicjatyw.
- **P3.2 Initiative Business-Case Generator** [DOMKNIĘCIE] — z inicjatywy M13 one-pager z liczbami (nakład/korzyść/NPV-z-realnym-WACC/payback/IRR) PRZED fundingiem.
- **P3.3 Value Capture Pipeline + Stage-Gates (G0-G5)** [NOWA] — lejek idea→business-case→approved→in-flight→realized→banked z bramkami + sign-off + kryteria dowodowe.
- **P3.4 Frozen Baseline & Value Ledger** [NOWA] — zamrożony baseline (kto/kiedy/dane) + audytowalny rejestr korekt wartości z provenance.
- **P3.5 Run-rate vs One-time Split + Phasing S-curve** [NOWA] — podział korzyści powtarzalnej/jednorazowej + krzywa dojścia do run-rate.
- **P3.6 Banking the Value (P&L wire)** [DOMKNIĘCIE] — wpięcie zatwierdzonej korzyści w budżet następnego okresu + actual-vs-plan (zależy od P1.4).
- **P3.7 Value Assurance Dashboard** [NOWA] — atestacja CFO-grade: które wartości zwalidowane/przez kogo/provenance, alerty „za bramką bez dowodu".

### PILAR 4 — Złota nić (W4, domknięcie pętli M16↔M13↔M14↔M15)
- **P4.1 Initiative-Finance Linkage Workflow** [DOMKNIĘCIE] — akcja „Powiąż" (domknięcie „Unlinked 86"); przypnij linię/analizę do ISTNIEJĄCEJ inicjatywy.
- **P4.2 Living Business Case** [DOMKNIĘCIE, najwyższy ROI] — przenieś capex/opex/revenueDelta/NPV/IRR z analizy do `roi_assumptions` inicjatywy; NPV re-liczone on-read (szew A: inicjatywa rodzi się „pusta").
- **P4.3 Benefit Profile S-curve** [NOWA] — `benefit_profile_points` (planned/actual cumulative per okres); plan vs actual = wczesny sygnał ślizgu.
- **P4.4 Benefits-Register Bridge M14→M15** [DOMKNIĘCIE] — naprawa G1: ResultsHub czyta `benefits_register` (dziś handoff trafia w martwą tabelę).
- **P4.5 Value Attribution Rollup** [DOMKNIĘCIE] — wepnij istniejący `kpiAttributionService` w agregat „total value delivered" (anti-double-count, `unexplainedRemainder`).
- **P4.6 Benefit Category Taxonomy** [NOWA] — hard/soft × cost-out/revenue-up/working-capital × run-rate/one-time; tylko hard-run-rate do reconciliation.
- **P4.7 Value-at-Risk on Slip** [DOMKNIĘCIE] — spięcie z M14 EVM/SPI: VaR=forecast×(1−scheduleHealth); heatmapa wartości zagrożonej.
- **P4.8 Realized-Value Reconciliation vs Sprawozdania** [DOMKNIĘCIE] — auto-konfrontacja `roi_realized_values` z `financial_statement_lines` przez `kpi_financial_mappings`; rozjazd>tolerancja=case.
- **P4.9 Leading/Lagging KPI Lineage** [NOWA] — flaga `kpi_kind` + link; cockpit ostrzega gdy leading drga a lagging nie.

### PILAR 5 — AI-native moat (W5, przewaga rynkowa)
- **P5.1 AI Driver-Suggester** [NOWA-AI] — z historii sprawozdań proponuje drzewo driverów + wartości bazowe (zwija tygodnie modelowania do minut).
- **P5.2 AI Variance Narration** [NOWA-AI] — „budżet odjechał 340k, 80% przez spadek wolumenu X + COGS +4pp" (gotowy komentarz CFO z bridge'a).
- **P5.3 Anomaly Detector @import** [NOWA-AI, najtańszy] — flaguje tie-out break / skok / błędną klasyfikację przy imporcie.
- **P5.4 NL→Model** [NOWA-AI] — prompt → gotowe drzewo driverów + 3-statement (onboarding bez eksperta).
- **P5.5 Decision Copilot** [NOWA-AI] — „co jeśli zatrudnię 5 osób w Q3?" → runway/EBITDA/breakeven + trade-off.
> Moat: P5.1-P5.4 operują na tie-out engine (zweryfikowane liczby pod spodem) → AI nie halucynuje. Tego Anaplan/Pigment nie mają natywnie.

### PILAR 6 — Konsolidacja architektury + testy (z audytu technicznego)
- **P6.1 Parytet V8-write valuations/budgets** → **P6.2 deprecation 3 legacy lane'ów** → **P6.3 konsolidacja 3 tabel „analiz" + dedup migracji** → **P6.4 testy gatingu/fallbacku/silników/E2E** (dziś ZERO na warstwach ryzyka).

### PILAR 7 — Domknięcie ingestii (Statements, z audytu)
- **P7.1 Cross-statement tie-out** (P&L↔BS↔CF) · **P7.2 smart-path human-in-loop** · **P7.3 naprawa brakującego CF** · **P7.4 FX** · **P7.5 multi-year** · **P7.6 OCR** · **P7.7 próg `ready`** · **P7.8 uczenie aliasów**.

---

## NOWE FUNKCJONALNOŚCI WARTE DOŁOŻENIA (odpowiedź wprost na pytanie)
**Tak — by osiągnąć poziom światowy trzeba dołożyć całe warstwy, nie tylko naprawić skorupy.** Najważniejsze NOWE (nieistniejące dziś):
1. **Portfolio decyzyjny + alokacja kapitału** (P2.1-P2.7) — bez tego system nie wspiera kluczowej decyzji konsultanta „co finansować".
2. **Motor wartości transformacji** (P3.1-P3.7) — value bridge, stage-gates, banking — sedno value-office.
3. **Warstwa planowania FP&A** (P1.1-P1.8) — driver-tree, rolling forecast, variance — różni „reporting tool" od „FP&A platform".
4. **AI-native moat** (P5.1-P5.5) — przewaga, której konkurenci nie mają natywnie.
Funkcjonalność M16 rośnie z 6 zakładek do **6 + 3 nowe powierzchnie**: **Planowanie** (driver-tree/scenariusze/variance), **Portfel decyzyjny** (alokacja kapitału), **Wartość transformacji** (value bridge/pipeline/assurance).

---

## STANDARD GRAFICZNY (kanon wizualny poziomu światowego)
Funkcje finansowe sprzedają się WIZUALNIE — standard graficzny jest częścią przewagi. **Wystandaryzowany kit wizualizacji finansowych** (analogicznie do `CANON.md`/Visual Standard v1) — jeden wspólny zestaw prymitywów, spójna semantyka kolorów, reużywalne komponenty:

| Prymityw | Funkcja | Kodowanie kanoniczne |
|--|--|--|
| **Value Bridge Waterfall** | P3.1, P1.4 | szary baseline → niebieski w-toku → zielony realized/banked → czerwony leakage; drill-down |
| **Football Field** | P0.2 wycena | poziome pasy zakresów DCF/comps/NAV + triangulacja |
| **Tornado / Sensitivity 2D** | P0.3, P1.5, P2.5 | poziome słupki sort. po \|ΔNPV\|, linia base; heatmapa WACC×g |
| **Portfolio Bubble** | P2.1, P2.4 | X=ryzyko, Y=NPV(rNPV), rozmiar=nakład, kolor=strategic-fit; kwadranty fund/kill |
| **Monte Carlo Histogram** | P2.5 | rozkład NPV, linia NPV=0, cieniowane P10/P50/P90, badge P(NPV>0) |
| **Efficient Frontier** | P2.7 | krzywa wartość vs ryzyko portfela; obecny vs optymalny |
| **Decision Tree** | P2.6, P3.3 | węzły decyzji/szansy, EMV, bramki go/kill |
| **S-curve realizacji** | P3.5, P4.3 | skumulowana realized vs plan w czasie (ramp) |
| **Golden-thread Sankey** | P4.1, P4.5 | inicjatywa→KPI→linia→wartość; sieroty (Unlinked) podświetlone |
| **Attribution Waterfall** | P4.5 | delta KPI rozbita na kontrybucje + `unexplainedRemainder` |
| **Baseline-Target-Realized Bullet** | P4.2, W4 | baseline·target(kreska)·forecast(cień)·actual(słupek) — 4 stany na pasku |
| **VaR Heatmapa** | P4.7 | inicjatywy×korzyści, kolor=value-at-risk z SPI |
| **Driver Tree** | P1.1 | graf węzłów+formuły, edytowalny inline, ścieżka wpływu |
| **Scenario Fan Chart** | P1.2, P1.3 | wachlarz base/bull/bear w czasie, zacieniony obszar |
| **Runway Gauge / Cash Curve** | P1.8 | linia cash→0 + min-cash threshold |

**Semantyka kolorów (spójna z Visual Standard v1 + RAG evmService):** zielony=on-track/favorable/realized · bursztyn=at-risk/warning · czerwień=missed/unfavorable/kill (TYLKO znaczeniowo, nie dekoracyjnie) · niebieski=in-progress/focus · szary=baseline/neutral. Football field i sensitivity heatmap **mają już dane w backendzie** — to pierwsze 2 światowe wizualizacje „za darmo".

**Standaryzacja pracy:** każda zakładka/powierzchnia M16 = ten sam wzorzec (panel z nagłówkiem · KPI-strip · główny wykres kanoniczny · tabela drill-down · akcje), flaga `ff_*`, fail-soft, zgodność z TABLE_AND_PREVIEW_CANON + nowy `FINANCE_VISUAL_CANON.md` (do utworzenia w F1).

---

## SEKWENCJA REKOMENDOWANA (wartość/wysiłek)
1. **Fundament wiarygodności** (P0.1 WACC + P0.2/P0.3 render-fixy = 2 światowe wizualizacje „za darmo") — najtańsze, odblokowuje resztę.
2. **Domknięcie złotej nici** (P4.2 living business case → P4.1 linkage → P4.4 benefits-bridge → P4.5 attribution) — naprawia 4 zerwane szwy, najwyższy ROI (silniki już liczą).
3. **Rdzeń wartości** (P3.2 business-case → P3.3 pipeline/gates → P3.1 value bridge → P3.6 banking).
4. **Decyzje** (P2.3 hurdle → P2.1 portfolio board → P2.4 rNPV → P2.2 rationing).
5. **Planowanie FP&A** (P1.1 driver-tree → P1.2 scenariusze → P1.4 variance → reszta).
6. **AI moat** (P5.3 anomaly najtańszy → P5.2 narration → P5.1 driver-suggester → P5.4 NL→model).
7. **Konsolidacja + testy + ingestia** (P6, P7) — równolegle, higiena.

→ Pełny rozpis zadań × 8 bramek w `M16-STAN-PRACY-ODBIORY.md`.
