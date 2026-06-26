# M16 FINANSE — PLAN DOMKNIĘCIA DO 100% (SSOT operacyjny modułu)

Start domknięcia: **2026-06-25** · Branch: **feat/deliverables-w1** (→ docelowo Londyn) · Deploy odbioru: **demo.consultify.ai**
Zasada twarda: **żaden obszar nie jest ZAMKNIĘTY, póki nie ma 8/8.** Idziemy obszar po obszarze (6 funkcjonalności FinanceHub). Zero fałszywej zieleni.

> **Podstawa planu = niezależny audyt przeniesienia 2026-06-25** ([M16-WERYFIKACJA-PRZENIESIENIA-2026-06-25.md](M16-WERYFIKACJA-PRZENIESIENIA-2026-06-25.md)). Ustalenia, które kształtują ten plan:
> 1. **Przeniesienie kompletne** — cała praca M16 przetrwała rebase (zweryfikowane przez treść); jedyna strata = alias `/finance/value`, już przywrócony (`4fed634985`).
> 2. **Testy automatyczne: 604/604 zielone** (55 plików). **Manualne: 180 case'ów istnieje, ale tylko 63 wykonane (45 PASS / 18 FAIL / 114 SKIP).**
> 3. **Dokumentacja poprzedniego agenta jest NIEAKTUALNA** (sprzed napraw): `M16-AUDYT-DETALICZNY` (06-24) wymienia 10 P0 UI, część już domknięta późniejszymi commitami (panele wired, endpointy, alias). **Dlatego prawda o stanie = dopiero żywy re-test.**
> 4. **Backend ~70% zrobiony+otestowany, FE ~30% potwierdzone w UI.** „Zielony test" ≠ „działa i widać w UI".

## Legenda
⬜ niezrobione · 🟡 w toku · ✅ zrobione+odebrane · 🔴 potwierdzony defekt · ❔ wymaga żywego re-testu (prawda nieznana)

---

## DoD globalny M16 (7 kryteriów)
1. **Front↔back** — DCF/WACC/ratio/NPV/IRR/scenariusze/variance na realnych danych, trwałe po reload; degraded banner widoczny; zero martwych przycisków/UI-fake.
2. **Bezpieczeństwo** — 0 żywych P0/P1; legacy IDOR zamknięty (test regresji); beta-guard na route v8.
3. **i18n** — pełne PL/EN przez `t()` (0 `isPolish` w `Economics/`).
4. **Tokeny** — 0 korupcji rose/hex (wykresy = legalny budżet hex DP-8, jak M13 graf).
5. **§27** — listy przez FilterableTable + Menu 1/2/3 (CanonicalStatementTable uzasadniony).
6. **E2E w PR-gate** — scenariusze M16 zielone na CI.
7. **Zgodność UI/UX** — komponenty wg SSOT canon, bez odstępstw P0/P1.

---

## TABELA ODBIORU M16 (8 etapów — stan na 2026-06-25 po audycie)

| # | Etap | Stan | Dowód / co zostało |
|---|------|------|--------------------|
| 1 | **Kod** — luki funkcjonalne/security | 🟡 | 15 bugów fix w kodzie + alias przywrócony; **10 P0 UI ze stale-audytu = ❔ do re-weryfikacji**; `useFinanceData` loguje „Maximum update depth" (residuum BUG-01) |
| 2 | **DoD 7/7** | 🟡 | #2/#3/#4/#5 prawdopodobnie met (audyt 06-13); #1 front↔back i #7 UI = ❔ (FE-fake); #6 E2E auto ✅ |
| 3 | **Epiki** (6 funkcjonalności) | 🟡 | backend F1–F9 ✅+testy; FE-wiring 6 obszarów = ❔ |
| 4 | **Testy** Kod / Manual | 🟡 | **Kod 604/604 ✅**; **Manual 63/180** (45P/18F/114SKIP) — domknąć do 180/180 |
| 5 | **Zgodność UI/UX** | ⬜ | brak audytu wizualnego 6 zakładek |
| 6 | **Deploy demo** | ⬜ | gałąź pushnięta na origin; deploy demo = bramka wstępna (Piotr) |
| 7 | **→F ODBIÓR FUNKCJA** (Piotr) | ⬜ | po re-teście + deploy |
| 8 | **→UI ODBIÓR grafik** (audytor+Piotr) | ⬜ | po deploy |

**M16 ZAMKNIĘTY = 8/8.**

---

## BRAMKA WSTĘPNA (przed re-testem — akcje Piotra)
| | Co | Po co |
|---|---|---|
| ⬜ | **Deploy demo/staging** (z terminala Piotra lub wskazanie gałęzi Railway) | bez żywego env z danymi nie domkniemy 114 SKIP ani →F |
| ⬜ | **Seed danych finansowych** na demo (statement+model+analiza+wycena+inwestycja dla org testowej) | 114 SKIP padło głównie na „brak danych" |
| ⬜ | (opc.) decyzje D1–D5 z `M16-finanse.md` (split-brain V8/legacy, zakres v1) | część P0 to świadome decyzje, nie kod |

---

## TASKI PER OBSZAR (6 funkcjonalności × własny mini-cykl)

> Wzorzec każdego obszaru: **T.0 re-test live (ustal prawdę)** → **T.x domknij potwierdzone luki** → **T.test 30/30 manual** → **odbiór**. Numeracja: S=Statements, M=Models, A=Analysis, P=Prediction, W=Valuation, I=Investment, X=cross-cutting.

### OBSZAR S — Statements (Sprawozdania) · stan: 🟡 silny rdzeń
Audyt: import LLM-mapping + tie-out per-typ + readiness 4-stanowy działają. P0 wg stale-audytu: brak cross-statement tie-out (P&L↔BS↔CF), 1 statement bez CF.
| Task | Opis | Odbiór |
|---|---|---|
| ⬜ S.0 | Re-test live MC-16S-01..30 na demo z danymi (rozbij 18 SKIP tej zakładki) | ≥28/30 PASS lub każdy nie-PASS z dowodem (bug/KG) |
| ⬜ S.1 | Potwierdź BUG-03 fix (`/statements/:id/ratios`) działa na żywo | MC-16S-15 PASS |
| ⬜ S.2 | Cross-statement tie-out (P&L↔BS↔CF) — zaimplementuj lub zarejestruj jako KG-v1 (decyzja) | tie-out widoczny w UI ALBO wpisemny KG |
| ⬜ S.3 | Import PDF/XLSX (case'y wymagające pliku) — re-test z realnym plikiem | upload→mapping→readiness zielony |
| ⬜ S.odb | 30/30 manual + screeny | →F + →UI |

### OBSZAR M — Models (Modele) · stan: 🟡 realny engine, 🔴 scenariusze
Audyt: event-driven 3-statement engine + true tie-out + approve + versioning DB ✅. **P0: scenariusze base/bull/bear = UI-fake (martwe); dwa silniki rozjechane.**
| Task | Opis | Odbiór |
|---|---|---|
| ⬜ M.0 | Re-test live MC-16M-01..30 (rozbij 12 SKIP) | ≥27/30 lub dowód |
| ⬜ M.1 | 🔴 **Scenariusze base/bull/bear — spiąć UI z realnym compute** (scenarioComputeService istnieje) zamiast hardcode ±15% | przełączenie scenariusza zmienia liczby z backendu (Network + reload) |
| ⬜ M.2 | Potwierdź 6 endpointów (duplicate/analyze/events/outputs/export — BUG-04/09/10/11/12) na żywo | MC-16M-05/07 + reszta PASS |
| ⬜ M.3 | Rozjazd dwóch silników — ustalić SSOT (financeCalcEngine) + udokumentować/scalić | 1 silnik liczy, brak rozbieżności liczb model↔analiza |
| ⬜ M.odb | 30/30 + screeny | →F + →UI |

### OBSZAR A — Analysis (Analizy) · stan: 🟡 liczy, UI nie pokazuje
Audyt: 18 wskaźników + NPV/IRR + inicjatywy→M13 ✅. **P0: bogatszy `ratioAnalysisService` (34 wsk. ROE/ROA/ROIC/DuPont + benchmarki) NIEUŻYWANY w UI.**
| Task | Opis | Odbiór |
|---|---|---|
| ⬜ A.0 | Re-test live MC-16A-01..30 (rozbij 16 SKIP) | ≥26/30 lub dowód |
| ⬜ A.1 | 🔴 **Spiąć UI z `ratioAnalysisService` (34 wsk.)** zamiast 18 — pokazać DuPont + benchmarki p25/median/p75 | UI pokazuje 34 wsk. + benchmark |
| ⬜ A.2 | Potwierdź economics endpointy (insights/business-case/decisions — BUG-06/07/08) na żywo | MC-16A-16 + reszta PASS |
| ⬜ A.3 | Selektor typu analizy (KG-02/03: zawsze „comprehensive") — dodać lub KG-v1 | selektor działa ALBO pisemny KG |
| ⬜ A.odb | 30/30 + screeny | →F + →UI |

### OBSZAR P — Prediction (Predykcja/Budżety) · stan: 🔴 brak variance
Audyt: baseline + approve CAPEX-gated ✅. **P0: całkowity brak variance (budget-vs-actual); budżet = skorupa (driver-pola NIE liczone); scenariusze ±15% hardcoded.** VarianceBridgePanel montowany bez `lines` (KG-01).
| Task | Opis | Odbiór |
|---|---|---|
| ⬜ P.0 | Re-test live MC-16P-01..30 (rozbij 23 SKIP — najwięcej!) | ≥25/30 lub dowód |
| ⬜ P.1 | 🔴 **Variance bridge — podać `lines` prop z realnych danych** (varianceBridgeService + 21/21 testów istnieje, brak wiring) | waterfall plan→actual renderuje realne pozycje |
| ⬜ P.2 | 🔴 **Budżet driver-based** — pola driverów faktycznie liczą (nie skorupa) | zmiana drivera zmienia budżet |
| ⬜ P.3 | Scenariusze sterowalne (nie ±15% hardcode) | wspólne z M.1 (ten sam silnik) |
| ⬜ P.odb | 30/30 + screeny | →F + →UI |

### OBSZAR W — Valuation (Wycena) · stan: 🟡 DCF liczy, 🔴 WACC/sensitivity
Audyt: DCF + Gordon + exit + tornado + snapshot approve ✅. **P0: WACC flat (nie CAPM mimo że WACC/CAPM engine 9/9 istnieje); sensitivity 2D nie renderuje (bug kontraktu FE).**
| Task | Opis | Odbiór |
|---|---|---|
| ⬜ W.0 | Re-test live MC-16W-01..30 (rozbij 21 SKIP) | ≥26/30 lub dowód |
| ⬜ W.1 | 🔴 **WACC z CAPM w UI** (engine 9/9 istnieje — spiąć zamiast flat-12) | UI pokazuje WACC derived (np. 8.94) z parametrów |
| ⬜ W.2 | 🔴 **Sensitivity heatmap renderuje** — napraw bug kontraktu FE (ValuationVisualsPanel) | heatmap 2D widoczna z danymi |
| ⬜ W.3 | Potwierdź `valuations/:id/assumptions` (BUG-13) na żywo | MC-16W PASS |
| ⬜ W.4 | DCF compute „Manual forecast missing" 500 — naprawić ścieżkę danych prognozy | DCF liczy z prognozy bez 500 |
| ⬜ W.odb | 30/30 + screeny | →F + →UI |

### OBSZAR I — Investment (Inwestycje) · stan: ❔ panel istnieje (stale-audyt mylił)
Audyt kodu: **InvestmentAppraisalPanel ISTNIEJE + wired** (stale-audyt 06-24 mówił „brak" — był sprzed buildu). Alias `/finance/value/appraise` przywrócony. **Do potwierdzenia: czy NPV/IRR/MIRR/PI liczą realnie czy 10% hardcoded.**
| Task | Opis | Odbiór |
|---|---|---|
| ⬜ I.0 | Re-test live MC-16I-01..30 (rozbij 24 SKIP — najwięcej!) | ≥25/30 lub dowód |
| ⬜ I.1 | Potwierdź BUG-02/05 fix — `/finance/value/appraise` zwraca NPV/IRR (po aliasie) z sesją | MC-16I-02 PASS (200, nie 404/401-auth) |
| ⬜ I.2 | Zweryfikuj NPV/IRR/MIRR/payback/PI liczone z realnych cashflows (nie hardcode 10%) | wynik zmienia się z inputem; WACC input z CAPM |
| ⬜ I.3 | Go/no-go verdict + wrażliwość | verdict z hurdle-rate |
| ⬜ I.odb | 30/30 + screeny | →F + →UI |

### OBSZAR X — Cross-cutting
| Task | Opis | Odbiór |
|---|---|---|
| ✅ X.1 | Alias `/finance/value` przywrócony po rebase | `4fed634985`, zweryfikowany w drzewie |
| ⬜ X.2 | 🔴 `useFinanceData` „Maximum update depth" — domknąć residuum BUG-01 (lane polling) | brak warna w teście + brak pętli req w Network |
| ⬜ X.3 | DoD #3 i18n — potwierdź 0 `isPolish` w `Economics/` (lub Faza 4 jak M01-M04) | grep = 0 ALBO odroczenie wpisane |
| ⬜ X.4 | Synchronizuj `M16-STAN-PRACY-ODBIORY.md` z rzeczywistością (usuń sprzeczności GREEN-vs-P0) | tracker zgodny z re-testem |
| ⬜ X.5 | Manual gate jako spec Playwright + screeny (180/180, jak M06-M09) | artefakty `.png` per case |
| ⬜ X.6 | Deploy demo + re-test na żywym env | moduł żywy + 6 obszarów re-tested |

---

## SYSTEM ODBIORU (jak domykamy etapy)
- **Etap 1 Kod**: każdy 🔴/❔ z tabeli obszarów → albo fix z testem regresji, albo pisemny KG-v1 (decyzja Piotra). Zero „UI-fake".
- **Etap 4 Testy**: Kod = pełny zestaw 604 zielony (✅). **Manual = 180/180**: każdy case wykonany w Playwright z ≥1 screenshotem (live-klik bez artefaktu ≠ zaliczony). FAIL dozwolony tylko z przypisanym BUG/KG.
- **Etap 5 UI/UX**: 22 ekrany M16 — screeny light+dark, zgodność z canon, 0 odstępstw P0/P1.
- **Etap 6 Deploy**: żywy na demo.consultify.ai (build SUCCESS, /ping 200).
- **Etap 7 →F**: Piotr klika 6 zakładek na demo — każda funkcja działa (nie placeholder).
- **Etap 8 →UI**: audytor + Piotr — pakiet 22 ekranów, UX odebrany.
- **ZAMKNIĘTY**: 8/8, wpis daty + kto przy odbiorach 7–8.

## KOLEJNOŚĆ WYKONANIA (rekomendacja)
1. **Bramka wstępna** (Piotr: deploy + seed danych) — odblokowuje wszystko.
2. **Faza re-test (T.0 × 6)** — równolegle 6 agentów, każdy 1 zakładka, ustalają prawdę (rozbijają 114 SKIP). Wynik: realna mapa 🔴 vs ✅.
3. **Faza fix** — domknij potwierdzone 🔴 (priorytet: P Prediction-variance, M scenariusze, W WACC/sensitivity — najcięższe).
4. **Faza domknięcia** — 180/180 manual + UI audyt + DoD 7/7 + sync trackera.
5. **Deploy + →F + →UI** — odbiór Piotra per obszar, potem M16 ZAMKNIĘTY 8/8.
