# M15 „Rezultaty" — STAN PRACY + ODBIORY (program budowy)

> Program budowy + system odbiorów dla M15 Benefits Realization — analogiczny do `M13/M14-STAN-PRACY-ODBIORY.md`. Wszystkie zadania dla wszystkich funkcjonalności (6 fal W1–W6), każde z 8 bramkami odbioru. SSOT pracy + akceptacji. Stan: 2026-06-24.
>
> Dokumenty siostrzane: `M15-WIZJA-I-PLAN-FUNKCJONALNY-2026-06-24.md` (wizja+cel), `M15-ANALIZA-SWIATOWA-2026-06-24.md` (benchmark światowy+luki+inicjatywy+standard graficzny), `M15-AUDYT-2026-06-24.md` (stan techniczny).

## STATUS PRAWDY (2026-06-24)
- Żywy moduł = `ResultsHub` (5 zakładek: Initiatives/KPI/Reports/ROI/ROI-Analysis), trasa `/benefits`, BetaGate `MODULE_BENEFITS`. Backend: 4 routery realne+DB (`v8/results` kanon + `results-kpi-reports` + `results-v4` + `benefits` legacy).
- **Diagnoza światowa:** M15 ma światowej klasy SILNIK POMIARU (KPI/time-series/atrybucja T048/ROI T046/finanse T049/deviation R1) ale słabą warstwę VALUE-ASSURANCE + DECYZJI + NARRACJI ZARZĄDCZEJ. Program W1–W6 dobudowuje tę warstwę do poziomu Transformation Office (McKinsey/BCG/Bain).
- **Najważniejsze luki:** brak value-driver-tree, stage-gated value (banked vs forecast), lejka wartości, silnika decyzji (dołóż/interweniuj/zabij), transformation scorecard; + rozłączony handoff M14→M15 (G1).
- Prod (centerbeam) NIETKNIĘTY. Środowisko verify = lokalny FE→staging-trolley org a3e05d4a (jak M14).

## SYSTEM ODBIORÓW — 8 bramek per zadanie
**Bramki realizacji** (CTO): **Kod** (zaimplementowane+wpięte) · **DoD** (7-pkt) · **Testy** (unit/integration zielone) · **Manual** (E2E z dowodem-zrzutem) · **UI** (zgodność z kanonem graficznym M15 — Część V analizy + `CANON.md`).
**Bramki akceptacji** (Piotr): **→F** (klikasz, działa funkcjonalnie) · **→UI** (akceptacja grafiki wg standardu M15).
**ZAMKNIĘTY 8/8** = wszystkie zielone. **🟢 GOTOWY** = realizacja ✅, czeka →F/→UI.

> **Standard graficzny (warunek każdej bramki UI):** każdy nowy widok składa się z 10 prymitywów M15 (Value Card, RAG+confidence pill, driver-tree viz, waterfall, funnel, scorecard/BSC grid, BDN map, trend chart, executive value header, drawer 7-sekcyjny) — Część V `M15-ANALIZA-SWIATOWA`. Zero jednorazowych stylów. Wszystko za flagami `resultsFeatureFlags` (default OFF), light/dark + i18n PL/EN od startu.

---

## TABLICA ZBIORCZA

| # | Zadanie / funkcjonalność | Fala | Filar | Kod | DoD | Testy | Manual | UI | →F | →UI | Status |
|--|--|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|--|
| 1.1 | **G1**: Handoff M14→M15 widoczny (decyzja a/b/c → `benefits_register`↔`initiative_kpis`) | W1 | P4.3 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ P0 — rozłączenie łańcucha |
| 1.2 | Profil korzyści nad KPI (typ/kategoria/dis-benefit/wiele-KPI/właściciel biznesowy) | W1 | P4.2 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 1.3 | Higiena martwego kodu (4 pliki: benefits.routes 2, results-enterprise.routes 2, ResultsSummaryView, OperationalAnalysisView) + ocena folderu Benefits/ | W1 | P14.1 | ⬜ | ⬜ | ⬜ | N/A | N/A | ⬜ | ⬜ | ⬜ — grep-referencji najpierw |
| 1.4 | `resultsFeatureFlags.ts` (analog executionFeatureFlags) + live-verify istniejących ścieżek + Playwright `m15-results-cockpit.spec.ts` (baseline KPI/ROI/deviation) | W1 | G5 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 2.1 | Value Driver Tree — model danych (węzły cel/driver/KPI/inicjatywa + krawędzie z wagą) | W2 | P1.1 | ⬜ | ⬜ | ⬜ | N/A | N/A | ⬜ | ⬜ | ⬜ rdzeń światowy |
| 2.2 | Driver Tree — sizing bottom-up (KPI delta × `kpi_financial_mappings` → roll-up do celu) | W2 | P1.3 | ⬜ | ⬜ | ⬜ | N/A | N/A | ⬜ | ⬜ | ⬜ |
| 2.3 | Driver Tree — interaktywna wizualizacja (rozwijanie, roll-up, baseline/target/current per węzeł) | W2 | P1.2 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 2.4 | Stage-gated value L0–L5 + confidence % per etap (model + przejścia) | W2 | P2.1 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ rdzeń światowy |
| 2.5 | Banked vs forecast + wartość ryzyko-ważona (value × confidence) | W2 | P2.2 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 2.6 | Value bridge / historia zmian wartości (dlaczego sized→realized się różni) | W2 | P2.4 | ⬜ | ⬜ | ⬜ | N/A | ⬜ | ⬜ | ⬜ | ⬜ |
| 2.7 | Lejek wartości portfela (ideas→validated→in-flight→realized: count+wartość per etap) | W2 | P3.1 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ rdzeń światowy |
| 2.8 | Leakage + value-at-risk + drill-down do inicjatyw | W2 | P3.2 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 3.1 | Silnik rekomendacji DOŁÓŻ / INTERWENIUJ / ZABIJ per inicjatywa (realizacja+confidence+adopcja) | W3 | P7.1 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ wsparcie decyzji |
| 3.2 | Pętla zwrotna do M14: zagrożona korzyść → sygnał w Manager-lane + eskalacja sponsora | W3 | P7.2 | ⬜ | ⬜ | ⬜ | ⬜ | N/A | ⬜ | ⬜ | ⬜ domyka pętlę M15→M14 |
| 3.3 | Re-alokacja: rekomendacja przesunięcia zasobów do high-realizing (spięcie capacity M14 4.1/4.2) | W3 | P7.3 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 4.1 | Transformation Scorecard — exec dashboard: zabankowane/w-realizacji/zagrożone (PLN+% celu) | W4 | P9.1 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ FINAŁ — obietnica appki |
| 4.2 | Waterfall wartości portfela + trend + top-korzyści + top-ryzyka | W4 | P9.2 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 4.3 | Run-rate vs in-year (kiedy wartość ląduje) | W4 | P5.1 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 4.4 | Board-pack / auto-narracja wartości (eksport raport+deck przez generatory M17–M20) | W4 | P9.3 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 5.1 | Domknięcie Goals/Scorecards (tworzenie celu end-to-end) | W5 | P6.1 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ (G2 — najpierw zweryfikuj atrapę) |
| 5.2 | OKR cascade (Objective→Key Results, kaskada org, scoring, check-in) | W5 | P6.2 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 5.3 | Balanced Scorecard (4 perspektywy: finanse/klient/procesy/rozwój) | W5 | P6.3 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 5.4 | Benefits Dependency Network — wizualna mapa enabler→zmiana→korzyść→cel | W5 | P6.4 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ „wow" wizualny |
| 5.5 | Adopcja→korzyść: wpięcie ADKAR/champions/sentiment z M14 jako predyktor ryzyka korzyści | W5 | P10.1 | ⬜ | ⬜ | ⬜ | ⬜ | N/A | ⬜ | ⬜ | ⬜ |
| 5.6 | DICE change-success score → flaga „korzyść zagrożona przez słabą adopcję" | W5 | P10.2 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 5.7 | Sustain: transfer własności do biznesu + cadence review + sustainment plan | W5 | P8 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 5.8 | Governance calendar / benefit review meeting (agenda+decyzje+action-tracking, spięcie ze schedulerami) | W5 | P11 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 6.1 | AI prognoza trajektorii KPI (trafimy w cel?) + alert wyprzedzający | W6 | P12.1 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 6.2 | AI sugestia RCA / akcji naprawczej dla deviation | W6 | P12.2 | ⬜ | ⬜ | ⬜ | ⬜ | N/A | ⬜ | ⬜ | ⬜ |
| 6.3 | AI narracja wartości (executive summary z danych portfela) | W6 | P12.3 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 6.4 | AI wykrywanie anomalii w pomiarach + benchmark branżowy | W6 | P12.4 | ⬜ | ⬜ | ⬜ | ⬜ | N/A | ⬜ | ⬜ | ⬜ |
| 6.5 | Scenariusze + analiza wrażliwości + IRR (rozszerzenie ROI) | W6 | P5.2 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 6.6 | Spięcie z modułem Finanse (M16) — jedno źródło prawdy finansowej | W6 | P5.3 | ⬜ | ⬜ | ⬜ | ⬜ | N/A | ⬜ | ⬜ | ⬜ |
| 6.7 | Domknięcie enterprise-reporting: Schedules / Wallboards / Connectors (submit end-to-end) | W6 | P13 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ (G2 — zweryfikuj atrapy najpierw) |
| 6.8 | Counterfactual baseline (co by się stało bez inicjatywy) — wzmocnienie atrybucji | W6 | P4.1 | ⬜ | ⬜ | ⬜ | ⬜ | N/A | ⬜ | ⬜ | ⬜ |
| 6.9 | **Standard graficzny M15** — biblioteka 10 prymitywów + migracja istniejących widoków | W6 | P-UI | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ przekrojowe (warunek bramek UI) |
| 6.10 | V8 vs legacy `/benefits` — udokumentować, oznaczyć deprecated (bez wygaszania) | W6 | P14.2 | ⬜ | ⬜ | ⬜ | N/A | N/A | ⬜ | ⬜ | ⬜ dług |

**Razem: 36 zadań / 6 fal.**

---

## FALE — CO I PO CO

### W1 — Domknięcie łańcucha i fundament (P0)
Bez tego dane z M14 nie płyną do M15 i nie ma na czym budować. Naprawa rozłączenia handoffu (1.1), profil korzyści jako fundament modelu (1.2), higiena (1.3), infrastruktura flag + weryfikacji (1.4). **Wynik:** korzyść z zamknięcia M14 widoczna i śledzona w M15.

### W2 — Value-assurance core (SKOK ŚWIATOWY)
To czyni z M15 value-capture engine McKinsey-grade: driver-tree (2.1–2.3) dekomponuje cel finansowy do inicjatyw; stage-gated value + confidence + banked/forecast (2.4–2.6); lejek wartości + leakage (2.7–2.8). **Wynik:** „ile wartości, z jaką pewnością, gdzie wycieka".

### W3 — Decyzje + pętla z M14 (wsparcie decyzji)
Silnik rekomendacji dołóż/interweniuj/zabij (3.1), domknięcie pętli zwrotnej do wdrożenia M14 (3.2), re-alokacja zasobów (3.3). **Wynik:** system nie tylko mierzy, ale doradza decyzję i uruchamia akcję w M14.

### W4 — Narracja wartości (FINAŁ obietnicy aplikacji)
Transformation scorecard dla zarządu (4.1), waterfall+trend (4.2), run-rate/in-year (4.3), board-pack przez generatory (4.4). **Wynik:** jednoekranowy dowód opłacalności transformacji — to po co istnieje M15.

### W5 — Warstwa strategiczna + adopcja + utrzymanie
Domknięcie Goals (5.1), OKR cascade (5.2), Balanced Scorecard (5.3), BDN map (5.4), adopcja→korzyść z M14 (5.5–5.6), sustain+własność+cadence (5.7), governance (5.8). **Wynik:** klej strategiczny + trwałość wartości po projekcie.

### W6 — AI premium + finanse + enterprise + standard graficzny
AI (6.1–6.4), scenariusze/IRR/spięcie M16 (6.5–6.6), domknięcie enterprise-reporting (6.7), counterfactual (6.8), **standard graficzny przekrojowo (6.9)**, dług legacy (6.10). **Wynik:** inteligencja nad danymi + spójność wizualna + domknięcie długów.

---

## DECYZJE PRZED STARTEM (z Części VI wizji + analizy)
1. Model korzyści: wzbogacony KPI vs osobna encja `benefit` (wpływa na 1.2).
2. Handoff G1: wariant a/b/c (wpływa na 1.1).
3. Zakres warstwy strategicznej: pełne OKR+BSC+BDN czy najpierw BDN (W5).
4. Priorytet W3 (decyzje) vs W4 (narracja) — co pierwsze po W2.
5. Premium AI (W6): model + funkcje pierwsze.

> Po decyzjach: rozpisuję każde zadanie fali na pod-kroki techniczne (jak robiłem dla M14: serwis+route+test+UI+Playwright) i ruszam budowę falami, z weryfikacją live i bramkami odbioru.
