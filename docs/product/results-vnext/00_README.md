# Consultify Results Next — pakiet wdrożeniowy

> Status: APPROVED FOR IMPLEMENTATION PLANNING  
> Data decyzji: 2026-08-09  
> Właściciel produktu: Founder  
> Właściciel architektury: Chief Product & System Architect  
> Zakres: KPI Management, ROI & Benefits Realization, OKR Management, Teresa, MyWork, Decisions

## 1. Cel pakietu

Ten katalog jest nadrzędnym pakietem wdrożeniowym przebudowy obszaru Results. Rozdziela wspólną architekturę od trzech niezależnych kontraktów domenowych, aby KPI, ROI i OKR nie zostały wtłoczone w jeden generyczny model.

Pakiet powstał po:

- pełnej analizie trzech specyfikacji dostarczonych 2026-08-09;
- audycie istniejącej dokumentacji Results, KPI, ROI, OKR, tabel, preview i Teresy;
- audycie aktualnego kodu, API, migracji i danych realDB;
- dwóch rundach analizy konsorcjum: domenowej oraz krytyczno-wdrożeniowej;
- zatwierdzeniu decyzji założycielskich 1A–15B.

## 2. Dokumenty

1. [`01_RESULTS_MASTER_IMPLEMENTATION_PLAN.md`](./01_RESULTS_MASTER_IMPLEMENTATION_PLAN.md)  
   Nadrzędna architektura, osiem etapów, wspólny shell, governance, Teresa, zależności, bramki i program odbioru.

2. [`02_KPI_IMPLEMENTATION_PLAN.md`](./02_KPI_IMPLEMENTATION_PLAN.md)  
   Centralny KPI, Scorecards, Measurements, deviation-to-action i effectiveness verification.

3. [`03_ROI_IMPLEMENTATION_PLAN.md`](./03_ROI_IMPLEMENTATION_PLAN.md)  
   Initiative-bound ROI Case, Approved/Forecast/Actual, Benefits Realization i przyszły most do Finance.

4. [`04_OKR_IMPLEMENTATION_PLAN.md`](./04_OKR_IMPLEMENTATION_PLAN.md)  
   OKR Program, Cycle, Set, Objectives, Key Results, Check-ins, Alignment i Reflection.

5. [`05_CONSORTIUM_CRITICAL_REVIEW.md`](./05_CONSORTIUM_CRITICAL_REVIEW.md)  
   Adwersaryjny cross-review planów, znalezione sprzeczności, poprawki i końcowy werdykt dokumentacyjny.

6. [`06_ACCEPTANCE_AND_VERIFICATION_HANDBOOK.md`](./06_ACCEPTANCE_AND_VERIFICATION_HANDBOOK.md)  
   Nadrzędny kontrakt odbioru funkcjonalnego, danych, bezpieczeństwa, Teresy, UI/CX, realDB i exact-SHA runtime.

7. [`07_EPIC_AND_TRACEABILITY_LEDGER.md`](./07_EPIC_AND_TRACEABILITY_LEDGER.md)  
   Globalne epiki, feature coverage, identyfikatory acceptance oraz obowiązkowe mapowanie do testów i dowodów.

8. [`08_CLAUDE_COMPLETE_EXECUTION_PROMPT.md`](./08_CLAUDE_COMPLETE_EXECUTION_PROMPT.md)  
   Gotowy prompt przekazujący Claude’owi całe wykonanie jako jeden terminalny cel realizowany przez kontrolowane pakiety.

## 3. Hierarchia prawdy

W obrębie programu Results Next obowiązuje kolejność:

1. jawne decyzje Foundera zapisane w master planie;
2. trzy nowe specyfikacje KPI/ROI/OKR dostarczone 2026-08-09;
3. ten pakiet wdrożeniowy;
4. aktualny kanon tabel i preview;
5. wcześniejsze dokumenty Results v8 jako źródło historyczne i materiał do odzyskania;
6. obecny kod i schemat jako stan `AS-IS`, nie jako automatyczny kanon produktu.

Jeśli wcześniejszy dokument dopuszcza standalone ROI, bezpośrednie dziedziczenie KR z KPI, utożsamia Cycle z OKR Set albo definiuje inną tabelę listową, rozstrzygnięcia tego pakietu mają pierwszeństwo dla Results Next.

## 4. Zasady użycia

- Nie rozpoczynać głębokiej implementacji bez zamknięcia Gate 0 z master planu.
- Nie budować wspólnej tabeli `results_items` ani wspólnego lifecycle KPI/ROI/OKR.
- Nie przepisywać danych legacy do nowych agregatów.
- Legacy pozostaje archiwum read-only; fizyczne usunięcie wymaga osobnej zgody.
- Każdy pionowy przyrost kończy się realnym zapisem, reloadem, cold reopen i dowodem uprawnień.
- Teresa działa od początku, ale przez typed proposals i obowiązujące uprawnienia.
- Kod, mock, screenshot i zielony build nie są samodzielnym dowodem ukończenia.

## 5. Status wdrożenia

Dokumentacja określa target i kolejność. Nie oznacza, że target został zaimplementowany, zmigrowany lub przyjęty na runtime. Status poszczególnych etapów musi być prowadzony w osobnym execution ledgerze powiązanym z dokładnym SHA i dowodami.
