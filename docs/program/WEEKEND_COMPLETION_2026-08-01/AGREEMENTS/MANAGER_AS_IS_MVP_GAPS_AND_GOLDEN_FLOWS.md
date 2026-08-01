---
document_id: MANAGER-AS-IS-MVP-GAPS-GOLDEN-FLOWS
module: My Work
function: Manager
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Manager — remanent runtime, luki MVP i bramki jakości

## 1. Uczciwy werdykt

Stan: **REAL / PARTIAL / NOT YET A TRUSTED MANAGEMENT SYSTEM**.

Istnieje działający dashboard i kilka wartościowych projekcji. Nie istnieje
jeszcze pełny model pracy menedżera od sygnału przez interwencję do zmierzonego
rezultatu. Największym ryzykiem nie jest brak karty, lecz wiarygodność semantyki
danych i możliwość wykonania pozornie zarządczej akcji poza jednoznacznym
kontraktem właściciela.

## 2. Co istnieje w kodzie

| Obszar | Dowód | Ocena |
| --- | --- | --- |
| wejście i role | `MyWorkHub.tsx`; `admin`, `manager`, `superadmin` | częściowe — brak pełnego project scope |
| cockpit | `ExecutiveDashboard.tsx` | realny |
| portfolio health | `PortfolioHealthScore.tsx` | realny, definicja wymaga governance |
| KPI | `KPIGrid.tsx` | realny jako projekcja |
| action required | `ActionRequiredStrip.tsx` | realny, deduplikowany |
| decyzje | `DecisionQueuePreview.tsx` | realny preview; write contract do utwardzenia |
| zespół/capacity | `TeamPerformancePreview.tsx` | zdegradowany przez model czasu |
| AI | `AIOperatorOverviewCard.tsx`, sygnały w dashboardzie | częściowe |
| inicjatywy | karty postępu w `ExecutiveDashboard.tsx` | projekcja, nie pełne portfolio |
| ochrona credibility | `executiveData.ts` | realna osłona, nie naprawa źródła |

## 3. Krytyczna luka capacity

Backendowy agregat zestawia sumę estymat wszystkich otwartych zadań z jedną
tygodniową pulą godzin. Licznik i mianownik opisują inne horyzonty czasu. Wynik
rzędu kilkuset procent nie dowodzi przeciążenia; dowodzi błędnej jednostki.

Frontend traktuje wartości powyżej 130% jako `needs-config` i nie pokazuje
fałszywej liczby. To poprawne zachowanie ochronne. Docelowa naprawa wymaga:

- obowiązkowego `windowStart/windowEnd`;
- alokacji godzin do okresu, nie całego otwartego backlogu;
- kalendarza pracy, nieobecności i części etatu;
- rozróżnienia availability, allocation, demand i actuals;
- confidence oraz kompletności estymacji;
- agregacji po projekcie, zespole, roli i osobie zgodnie z ACL.

## 4. Priorytety MVP

### P0 — wiarygodność i bezpieczeństwo

1. Zdefiniować słownik każdej metryki, jej ownera, zakres czasu i źródło.
2. Naprawić time-windowed capacity albo pozostawić jawny stan niedostępności.
3. Zapewnić tenant/project ACL dla każdej projekcji i drill-downu.
   Dostęp ma dwie bramki: capability wejścia do Managera oraz skonfigurowany w
   Admin Panelu scope osób, zespołów, projektów lub jednostek. Obie bramki muszą
   obowiązywać także w API, eksporcie, wyszukiwaniu i rekomendacjach Teresy.
4. Wszystkie akcje Decisions/Tasks/Initiatives wykonywać przez kanoniczny
   endpoint z preview, permission check i read-back.
5. Odróżnić `no data`, `zero`, `stale`, `estimated` i `verified`.
6. Każdy alert musi mieć stabilną tożsamość i nie może być duplikowany.

### P1 — kompletny golden flow

1. Brief „Wymaga uwagi” z rankingiem wpływ × pilność.
2. Drill-down: sygnał -> przyczyna -> źródła -> zależności -> działanie.
3. Project/portfolio scope oraz zapisane widoki.
4. Teresa przygotowuje evidence-backed intervention draft.
5. Historia interwencji i pomiar, czy przyniosła rezultat.
6. Status updates z przypomnieniem i wskaźnikiem świeżości.

### P2 — rozwój po stabilnym MVP

- scenariusze portfelowe i optymalizacja wielokryterialna;
- skill-based capacity oraz hiring/procurement scenarios;
- prognozowanie wyniku i symulacje Monte Carlo;
- porównania benchmarkowe;
- automatyczne pakiety dla boardu i interesariuszy;
- uczenie się skuteczności rekomendacji Teresy.

## 5. Testy odbiorowe

### GF-MGR-00 — role i widoczność pracy

Member bez roli managera nie widzi zakładki i otrzymuje odmowę dla deep linku
oraz API. Manager zespołu A widzi wyłącznie dozwolone dane zespołu A; nie widzi
rekordów ani agregatów zespołu B. Po zmianie scope w Admin Panelu cache i
projekcje respektują zmianę, a audyt wskazuje administratora i zakres operacji.

### GF-MGR-01 — interwencja w blokadę

Manager widzi jedną zduplikowaną wcześniej blokadę tylko raz, otwiera jej
źródła, zleca Teresie draft interwencji, zatwierdza task/decision w module
właściciela i po read-backu widzi nowy stan.

### GF-MGR-02 — przeciążenie zespołu

System liczy demand i capacity dla tego samego tygodnia, wskazuje konflikt,
pozwala zasymulować przesunięcie, pokazuje wpływ na terminy i dopiero po
potwierdzeniu aktualizuje plan.

### GF-MGR-03 — niedowieziony KPI

KPI przekracza próg, system powiadamia ownera i managera zgodnie z eskalacją,
Teresa draftuje plan naprawczy, a karta pokazuje działania i późniejszy efekt.

### GF-MGR-04 — decyzja z konsekwencjami

Manager widzi decision brief, warianty, dane i blokowane elementy. Po decyzji
system aktualizuje kanoniczny rekord, zadania i zależności bez ukrytych kopii.

### GF-MGR-05 — status zarządczy

Teresa generuje draft na podstawie aktualnych danych, zaznacza luki i
sprzeczności. Człowiek edytuje, zatwierdza odbiorców i publikuje; wersja i
źródła pozostają audytowalne.

## 6. Zakazane skróty implementacyjne

- health score bez jawnej formuły i możliwości wejścia w składniki;
- czerwony kolor nadany wyłącznie z niskiego procentu ukończenia;
- capacity z całego backlogu dzielone przez tydzień;
- przyciski approve/reject omijające pełny decision contract;
- generatywny opis AI bez źródeł i świeżości;
- ranking ludzi na podstawie liczby tasków lub aktywności;
- ukrywanie zakładki bez równoczesnego zabezpieczenia endpointów i eksportów;
- wyliczanie agregatu z danych osób spoza dozwolonego management scope;
- deklarowanie sukcesu po HTTP 200 bez read-backu domeny.
