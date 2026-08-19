---
agreement_id: MOD-AGR-08
module: Execution
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
accepted_by:
accepted_at:
last_reviewed: 2026-07-31
superseded_in_scope_by: ../../../modules/INITIATIVES_EXECUTION_FUNCTIONS_CANON.md
---

# Karta uzgodnienia — Execution

> **CURRENT TARGET OVERRIDE (2026-08-09):** Menu 2, table-first shell oraz funkcje `Realizacje / Praca / Zasoby / Sterowanie / Raporty` definiuje [`docs/modules/INITIATIVES_EXECUTION_FUNCTIONS_CANON.md`](../../../modules/INITIATIVES_EXECUTION_FUNCTIONS_CANON.md). Pozostałe granice i rationale tej karty zachowują wartość, o ile nie konkurują z nowym kanonem.

## 1. Definicja

**Execution** jest aktywnym systemem zarządzania realizacją zatwierdzonych
inicjatyw. Nie służy jedynie do rejestrowania zadań i pokazywania statusu.
Kontroluje wykonanie, motywuje uczestników, zapewnia właściwą informację,
wymusza potrzebne decyzje, raportuje sytuację i pomaga zarządzać zasobami.

Jego celem jest zrobić wszystko, co racjonalnie możliwe, aby dowieźć możliwie
dobry wynik, możliwie zgodnie z zatwierdzonym planem. Gdy plan przestaje być
realny albo optymalny, Execution ma pokazać problem odpowiednio wcześnie,
przygotować warianty reakcji i doprowadzić do świadomej decyzji.

Execution zarządza przede wszystkim:

- **informacją** — co naprawdę się dzieje, co się zmieniło i czego brakuje;
- **odpowiedzialnością** — kto ma wykonać pracę, podjąć decyzję lub zareagować;
- **decyzjami** — jakie rozstrzygnięcie jest potrzebne, do kiedy i z jakim
  wpływem;
- **czasem** — harmonogramem, terminami, critical path i opóźnieniami;
- **budżetem** — planem, zobowiązaniami, actual cost i forecastem;
- **ludźmi i capacity** — dostępnością, kompetencjami, przydziałami i
  przeciążeniami;
- **ryzykiem i zmianą** — przewidywaniem problemów i kontrolowaną reakcją;
- **energią realizacji** — rytmem pracy, przypomnieniami, uznaniem postępu,
  usuwaniem blokad i przejrzystą eskalacją.

Granice:

- Initiatives odpowiada: co i dlaczego chcemy zrobić;
- Execution odpowiada: kto, co, kiedy i w jaki sposób rzeczywiście wykonuje;
- Results odpowiada: czy wykonana zmiana przyniosła oczekiwany efekt;
- Finance odpowiada: ile wykonanie kosztowało i czy inwestycja była opłacalna;
- My Work pokazuje osobie jej zadania, decyzje i alerty.

## 1.1. Pętla zarządzania Execution

Execution pracuje jako ciągła pętla:

`Observe → Understand → Forecast → Decide → Act → Verify → Learn`

1. **Observe** — zbiera actual wykonania, czas, koszt, capacity, blokady i
   dowody.
2. **Understand** — porównuje actual z baseline i rozpoznaje przyczyny.
3. **Forecast** — przewiduje wpływ na milestone, budżet, zasoby i wynik.
4. **Decide** — wskazuje decyzję, warianty, trade-offs, ownera i deadline.
5. **Act** — uruchamia zatwierdzoną interwencję oraz przydziela działania.
6. **Verify** — sprawdza, czy interwencja poprawiła sytuację.
7. **Learn** — zapisuje lessons learned i poprawia dalszy plan.

Sam dashboard bez decyzji i działania nie spełnia celu Execution.

## 1.2. Motywowanie bez pozornej kontroli

Motywowanie oznacza wspieranie odpowiedzialności i tempa realizacji, a nie
mechaniczne wysyłanie przypomnień ani ocenianie aktywności użytkownika.
Execution:

- pokazuje sens zadania i jego wpływ na Initiative oraz wynik;
- daje jasne oczekiwania, definition of done i następny krok;
- przypomina przed terminem, nie dopiero po opóźnieniu;
- pokazuje postęp i osiągnięte milestones;
- rozpoznaje blokady oraz kieruje prośbę o pomoc do właściwej osoby;
- docenia ukończenie istotnego etapu;
- eskaluje brak reakcji proporcjonalnie i transparentnie;
- nie używa liczby kliknięć, czasu online ani sztucznej aktywności jako miary
  produktywności.

## 2. Kanoniczny przepływ

`Approved Initiative → Execution Brief → baseline plan → work packages →
tasks and milestones → resource confirmation → execution → monitoring →
intervention/change control → rollout → operational handover → closure →
Results and Finance reconciliation`

Initiative nie powinna od razu stawać się listą zadań. Najpierw powstaje
`Execution Brief`, przygotowywany przez Teresę z użytkownikiem:

- zakres i rezultat wdrożenia;
- kryteria gotowości;
- etapy i kamienie milowe;
- odpowiedzialności;
- zasoby i dostępność;
- budżet wykonania;
- zależności;
- ryzyka i assumptions;
- plan komunikacji;
- KPI wykonania oraz docelowe KPI Results;
- strategia rollout;
- kryteria zamknięcia.

Dopiero zaakceptowany brief tworzy baseline wykonania.

## 3. Kanoniczne obszary

1. **List** — pierwsza i domyślna zakładka: tabela wszystkich realizowanych
   inicjatyw z health, etapem, opóźnieniem, budżetem, ryzykiem, właścicielem i
   następną decyzją.
2. **Plan** — work packages, etapy, zadania, milestones, dependencies,
   critical path, baseline i zatwierdzone wersje planu.
3. **Work** — zadania, właściciele, terminy, statusy, dowody ukończenia i
   blokady; przydziały są widoczne również w My Work.
4. **Control Tower** — alerty, problemy, ryzyka, przeciążenia zasobów,
   opóźnienia, przekroczenia kosztów i decyzje wymagające interwencji.
5. **Rollout** — pilotaż, fale wdrożenia, readiness, cutover, adopcja,
   stabilizacja i przekazanie operacyjne.
6. **Reports** — raporty statusowe, governance packs, decisions, lessons
   learned oraz publikacja przez Materials.

Moduł zawsze otwiera `List`, chyba że użytkownik wraca przez deep link do
konkretnego Execution lub jego obiektu. Dashboard, Portfolio i Control Tower
nie zastępują listy i nie są domyślnym ekranem wejściowym.

## 4. Baseline i change control

Execution rozdziela:

- approved baseline;
- bieżący plan;
- actual wykonania;
- forecast zakończenia;
- proponowaną zmianę.

Zmiana terminu, kosztu, zakresu lub kluczowego milestone nie nadpisuje
baseline. Powstaje `Change Request` zawierający:

- przyczynę;
- wpływ na zakres, czas, koszt, zasoby i KPI;
- warianty decyzji;
- rekomendację Teresy;
- osobę zatwierdzającą;
- historię decyzji.

Po zatwierdzeniu powstaje nowa wersja planu. Wcześniejszy baseline pozostaje
dostępny do rozliczenia.

## 5. Zadania i odpowiedzialność

Każde zadanie zawiera:

- jednego odpowiedzialnego ownera;
- termin i priorytet;
- definicję ukończenia;
- powiązany work package i milestone;
- zależności;
- wymagany dowód;
- status blokady;
- szacowany i rzeczywisty nakład;
- historię zmian.

My Work nie tworzy alternatywnej kopii zadania. Pokazuje zadanie Execution w
osobistym kontekście użytkownika i zapisuje aktualizacje do tego samego obiektu.

## 6. RAID, sygnały i interwencje

Execution prowadzi jeden rejestr:

- Risks;
- Assumptions;
- Issues;
- Dependencies;
- Decisions.

Ryzyko opisuje możliwość przyszłego zdarzenia. Issue oznacza problem, który już
wystąpił. Nie są jednym statusem.

Przekroczenie progów automatycznie tworzy sygnał w Control Tower:

- opóźnienie;
- zagrożony milestone;
- blokada zależności;
- przeciążenie zasobu;
- przekroczenie kosztu;
- brak decyzji;
- nieskuteczne działanie naprawcze.

Sygnał prowadzi do wymaganej czynności: `acknowledge`, `assign`, `mitigate`,
`replan`, `escalate` albo `accept`.

## 7. Zasoby i capacity

Execution zarządza ograniczeniami wykonania: czasem, budżetem, ludźmi,
kompetencjami i dostępnością. Pokazuje:

- dostępną pojemność;
- obecne przydziały;
- konflikty terminów;
- wymagane kompetencje;
- zastępstwa;
- przeciążenia;
- koszt zasobu;
- planowany, zaangażowany i rzeczywisty budżet;
- estimate at completion oraz forecast daty zakończenia;
- wariancję czasu i kosztu względem baseline;
- koszt i wpływ opóźnienia.

Teresa może proponować przeplanowanie, zmianę właściciela lub wygładzenie
obciążenia, przesunięcie budżetu albo zmianę zakresu, ale nie wykonuje tych
zmian bez zatwierdzenia. Każda propozycja pokazuje wpływ na wynik, termin,
koszt, ryzyko i inne Initiative korzystające z tych samych zasobów.

Brak zasobu nie może być ukryty przez przypisanie zadania osobie bez realnej
dostępności. Konflikt capacity jest jawnym problemem zarządczym wymagającym
decyzji: zmiana priorytetu, terminu, zakresu, właściciela, budżetu lub sposobu
wykonania.

## 8. Rollout

Rollout jest częścią Execution, a nie osobnym modułem:

`Design → Pilot → Readiness Review → Wave planning → Cutover → Hypercare →
Stabilization → Operational handover`

Każda fala może mieć własne lokalizacje, użytkowników, kryteria gotowości,
ryzyka i decyzję go/no-go.

## 9. Zamknięcie

Initiative nie zostaje zamknięta tylko dlatego, że wszystkie zadania oznaczono
jako wykonane. Closure wymaga:

- wykonania lub jawnego odstąpienia od zakresu;
- rozliczenia milestone i zmian;
- zamknięcia albo zaakceptowania ryzyk i problemów;
- actual kosztu i czasu;
- przekazania operacyjnego;
- przypisania właścicieli przyszłych KPI;
- uruchomienia pomiarów w Results;
- aktualizacji Finance;
- lessons learned;
- zatwierdzenia przez właściwego reviewera.

Dozwolony jest stan: **Execution zakończone, rezultat jeszcze
niepotwierdzony**.

## 10. Teresa

Teresa pełni rolę aktywnego PM/PMO copilota:

- rozbija Initiative na sensowny plan;
- proponuje zależności, milestones i ryzyka;
- sprawdza kompletność odpowiedzialności;
- wykrywa opóźnienia i przeciążenia;
- przygotowuje warianty interwencji;
- prowadzi status review;
- sporządza raporty i decision briefs;
- przypomina o decyzjach i eskaluje brak reakcji.

Raportowanie Teresy ma odpowiadać na pytania zarządcze:

- co jest zgodne z planem, a co nie;
- co zagraża wynikowi i kiedy stanie się krytyczne;
- gdzie brakuje czasu, budżetu, ludzi lub kompetencji;
- jakie decyzje są potrzebne teraz;
- jakie są realne warianty i konsekwencje każdego z nich;
- kto powinien wykonać następny krok;
- czy wcześniejsza interwencja rzeczywiście zadziałała.

Teresa nie może samodzielnie:

- zmienić baseline;
- przesunąć zatwierdzonego milestone;
- zmienić ownera;
- zaakceptować ryzyka;
- zatwierdzić Change Request;
- zamknąć wykonania.

Wspólny kontrakt AI Initiatives–Execution opisuje
[`TERESA_INITIATIVE_TO_EXECUTION_AI_SYSTEM.md`](TERESA_INITIATIVE_TO_EXECUTION_AI_SYSTEM.md).
Execution używa tego samego `AI Management Case` i `AI Handoff Snapshot`, które
powstały podczas oceny sensu oraz wykonalności Initiative. Teresa nie rozpoczyna
zarządzania od pustego kontekstu.

Każdy forecast i każda interwencja muszą wskazywać evidence, counter-evidence,
assumptions, confidence, impact, wymagany approval oraz sposób późniejszego
sprawdzenia skuteczności.

## 11. Stan obecny

### Mamy

- `ExecutionHub` i starszy `FullExecutionView`;
- portfolio, timeline, manager i reports;
- tasks, decisions i action queue;
- risk, delay, budget i capacity signals;
- Control Tower;
- RAID i mitigations;
- baseline variance;
- resource balancing;
- rollout stages, readiness, cutover i closure;
- integracje z My Work, Results i Finance;
- interwencje `reassign`, `smooth`, `replan` i `escalate`.

### Fragmentacja

- aktywne są trzy wejścia: `/execution`, `/implementation` i `/rollout`;
- starszy `FullExecutionView` i nowszy `ExecutionHub` tworzą dwie powierzchnie;
- rollout posiada osobne kontrakty i rejestry;
- rozbudowany backend nie ma jednego udowodnionego pionu w UI;
- kilka ścieżek może duplikować task, KPI, budget albo closure;
- fallback i feature flags mogą maskować brak kompletnego runtime.

Docelowo pozostaje jedna nazwa i trasa **Execution**. Stare wejścia stają się
bezpiecznymi przekierowaniami po przygotowaniu mapy zależności.

## 12. Golden flow MVP

`Initiative approved → Execution Brief → baseline → tasks in My Work →
progress → delay signal → corrective intervention → approved replan →
rollout → closure → Results/Finance handoff`

## 12.1. Funkcje wynikające z benchmarku

Pełna analiza oraz źródła znajdują się w
[`EXECUTION_MARKET_BENCHMARK.md`](EXECUTION_MARKET_BENCHMARK.md).

Wykonawcza specyfikacja wszystkich obszarów i funkcji znajduje się w
[`EXECUTION_FUNCTION_CATALOG.md`](EXECUTION_FUNCTION_CATALOG.md). Jest ona
obowiązkową podstawą future-state, pakietów implementacyjnych i odbioru; sam
istniejący ekran, endpoint lub komponent nie stanowi dowodu ukończenia funkcji.

Każda z 89 zidentyfikowanych funkcji musi otrzymać osobną kartę według
[`EXECUTION_FUNCTION_SPEC_STANDARD.md`](EXECUTION_FUNCTION_SPEC_STANDARD.md).
Dopóki karta nie osiągnie `READY_FOR_TASK_BREAKDOWN`, nie może być podstawą
zadania dla agenta implementującego.

Poza zdolnościami już widocznymi w kodzie Execution potrzebuje:

- Execution Blueprints i trybów `Lite`, `Standard`, `Complex`;
- planowania WBS, critical path, float i constraints;
- wielu widoków tej samej prawdy: list, board, Gantt, calendar i timeline;
- what-if sandbox przed zatwierdzoną zmianą planu;
- forecasting daty zakończenia i estimate at completion;
- demand/capacity/skills planning między Initiative;
- kosztu opóźnienia oraz jawnych trade-offs;
- alert deduplication i action queue według wpływu;
- raportów dopasowanych do operatora, managera, sponsora i zarządu;
- biblioteki lessons learned wykorzystywanej przez Teresę;
- widoczności na poziomie portfolio, Initiative i pojedynczego elementu.

Zasadą przewodnią nie jest odtworzenie wszystkich funkcji konkurentów, lecz
połączenie ich najlepszych mechanizmów w jeden zarządczy closed loop:

`signal → diagnosis → options → decision → governed action → verification`

## 13. Kryteria ukończenia

1. Approved Initiative tworzy kontrolowany Execution Brief.
2. Baseline wymaga akceptacji i pozostaje niezmienny.
3. Zmiana tworzy Change Request oraz nową wersję planu.
4. Każde zadanie ma ownera, termin, DoD i lineage do Initiative.
5. My Work używa tego samego task write-truth.
6. Milestones i dependencies mają działające reguły statusu.
7. RAID rozróżnia risk, assumption, issue, dependency i decision.
8. Przekroczenie progu tworzy sygnał i wymagane działanie.
9. Interwencja ma preview, approval, audit trail i read-back.
10. Capacity opiera się na realnej dostępności i przydziałach.
11. Actual cost nie nadpisuje approved budget.
12. Rollout obsługuje readiness, waves, cutover i hypercare.
13. Closure wymaga operational handover i lessons learned.
14. Results otrzymuje KPI ownerów oraz sygnał rozpoczęcia pomiarów.
15. Finance otrzymuje actual cost i wersję baseline.
16. Teresa nie wykonuje zmian governance bez potwierdzenia.
17. Cross-org odczyt i zapis są blokowane.
18. Golden flow przechodzi E2E na stagingu.
19. UI spełnia wspólny kanon dark/light, responsive i accessibility.
20. Fallback nie maskuje błędu kanonicznego runtime.
21. Control Tower prowadzi od sygnału do decyzji, działania i weryfikacji.
22. System pokazuje plan, actual i forecast czasu oraz budżetu.
23. Przydział zasobu uwzględnia realną capacity i kompetencje.
24. Konflikt zasobów tworzy decyzję zarządczą, a nie ukryte przeciążenie.
25. Raport wskazuje wymagane decyzje i następne działania, nie tylko status.
26. Przypomnienia, uznanie postępu i eskalacje są proporcjonalne oraz
    audytowalne.
27. System nie używa pozornej aktywności jako miary produktywności.
28. Plan ma co najmniej list, board i timeline/Gantt nad tą samą prawdą.
29. System wyznacza albo jawnie planuje critical path i zależności.
30. Duża interwencja może zostać sprawdzona w what-if przed publikacją.
31. Portfolio pokazuje demand i capacity między wieloma Initiative.
32. Raport jest dopasowany do roli odbiorcy i zachowuje drill-down.
33. Pierwszą i domyślną zakładką jest tabela `List` realizowanych Initiative.
34. Teresa używa AI Handoff Snapshot i zachowuje ciągłość sensu Initiative.
35. Forecast wskazuje źródła, drivery, confidence i warunki zmiany.
36. Interwencja AI zawiera warianty, impact, preview, approval i verification.
37. Brak wystarczających danych daje `insufficient evidence`, nie zmyśloną radę.

## 14. Pytania do właściciela

1. Potwierdzone: pierwszą i domyślną zakładką jest `List` realizowanych
   inicjatyw. Do odbioru pozostaje kolejność Plan, Work, Control Tower, Rollout
   i Reports.
2. Czy rollout ma być wymagany dla każdej Initiative, czy tylko dla określonych
   typów wdrożeń?
3. Czy Execution Brief jest obowiązkowy dla wszystkich Initiative, czy
   dopuszczamy tryb uproszczony dla małych zmian?
4. Kto może zatwierdzać rebaseline i formalne closure?
