---
doc_id: funkcje-odbior-200
status: canonical
truth_type: acceptance
established: 2026-08-31
---

# ODBIÓR 200 — panele Finansów · RDZEŃ SCALONY · dowody → FIX-200

R1 inwentarz + R2 osiągalność: **wykonane w całości** (21/21 paneli w rejestrze
Surface za `isFinanceValuePanelsEnabled` OFF; mutacja flagi → test fail-closed
czerwony; 3 różne ValuationWorkspace poprawnie rozróżnione; zero regresji 128→130
nazw). Zrzuty obejrzane (6): realne dane, kanon czysty, crimson tylko semantyczny.

## Do FIX-200 (wydany)
1. ★ **Wpis do docs/program/KOORDYNACJA.md** — nigdy nie powstał (cicha luka,
   nie zgłoszona); to jedyny kanał do toru grafiki.
2. Korekta wiersza CashForecastPanel w R1 (woła realny POST /finance-planning/
   cash-forecast — NIE „obliczenia lokalne").
3. Brakujące 28/42 zrzutów + 2 testy realnego API — nadzorca NADAJE wąską
   licencję na dedykowany harness Day-200 (STOP wykonawcy był zasadny: dev-render
   poza jego licencją).
4. R2-wrappery (10/19 endpointów bez typed clienta) — pozycja do rundy
   polerowania Finansów, nie do FIX (nagłówek raportu do sprostowania).
