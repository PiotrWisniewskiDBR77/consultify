---
doc_kind: PRODUCT_FUNCTION_REVIEW
module_id: MODULE_MY_WORK
function_id: MW_CALENDAR
status: REVIEW
last_updated: 2026-07-31
---

# My Work — Kalendarz

## 1. Misja

Kalendarz jest warstwą czasu całego Consultify. Łączy zobowiązania z zewnętrznych kalendarzy z taskami, decyzjami, spotkaniami, kamieniami milowymi i blokami pracy, aby użytkownik widział nie tylko `co` i `do kiedy`, lecz także `kiedy realnie zostanie wykonane`.

Kalendarz nie jest właścicielem taska, decyzji, inicjatywy ani spotkania. Wyświetla ich projekcję czasową i przekazuje zatwierdzone zmiany do właściciela obiektu.

## 2. Kluczowe rezultaty

- jedno wiarygodne miejsce planowania czasu;
- widoczna dostępność i obciążenie;
- ochrona czasu na priorytety;
- wykrywanie konfliktów przed zatwierdzeniem;
- przygotowanie i follow-up spotkań;
- synchronizacja bez duplikatów i silent overwrite;
- jasne rozróżnienie danych świeżych, stale i niepełnych.

## 3. Obiekty wyświetlane

| Typ | Właściciel | Zachowanie w Kalendarzu |
| --- | --- | --- |
| external event | Google/Microsoft/CalDAV | mirror lub write-through według uprawnień |
| Consultify event | Calendar/Meeting zależnie od typu | natywny event |
| task due | Tasks | marker deadline |
| task work block | Tasks + Calendar projection | blok planowanej pracy |
| decision deadline/review | Decisions | deadline lub slot decyzyjny |
| initiative milestone | Initiatives/Execution | milestone read-only lub owner handoff |
| meeting | Meeting | termin, uczestnicy, briefing i follow-up |
| focus block | Calendar | chroniony czas pracy |
| approval/escalation window | owner workflow | projekcja okna wymaganej reakcji |

## 4. Widoki

`Miesiąc` służy orientacji i deadline'om. `Tydzień` jest głównym widokiem planowania. `Dzień` wspiera wykonywanie i analizę obciążenia. `Lista/Agenda` służy szybkiemu skanowaniu, mobile i dostępności. Widok zapamiętuje zakres i filtry użytkownika.

### Projekty wielotygodniowe

Projekt lub inicjatywa trwająca wiele dni/tygodni nie jest renderowana jako ciągły, gruby event bar. Taki pasek niszczy czytelność siatki i błędnie sugeruje całodobowe zajęcie czasu.

- początek/koniec projektu: dyskretne znaczniki punktowe;
- milestone/gate/deadline: punkt/romb na konkretnym dniu;
- aktywność projektu w zakresie: cienka, neutralna kropkowana prowadnica wyłącznie w nagłówku tygodnia/miesiąca albo mała kropka projektu w komórce dnia;
- konkretna praca: zwykły time block dopiero po zaplanowaniu;
- projekt stale widoczny opcjonalnie jako filtr/lane/legend item, nie jako event;
- hover/click punktu otwiera podsumowanie projektu i najbliższy milestone.

Domyślny miesiąc pokazuje maksymalnie kilka punktów projektowych na dzień, następne agreguje jako `+N`. Kolor projektu jest subtelny; status/ryzyko mają osobny semantyczny sygnał.

## 5. Główny przepływ

`Connect sources → Sync/read → Unify → Detect load/conflict → Propose → Approve → Write owner/provider → Read-back → Monitor`

Każdy zapis poza lokalnym draftem wymaga potwierdzenia systemu docelowego. Brak read-backu daje `pending`, nigdy `success`.

## 6. Menu i minimalizm

- Menu 1: `My Work`;
- Menu 2: `Inbox & Calendar` albo osobne wejście zależnie od finalnego menu;
- Menu 3: `Today`, poprzedni/następny zakres, Month/Week/Day/List, `+`, Search;
- lewy panel: mini-calendar, źródła i maksymalnie jeden zwinięty filtr zaawansowany;
- prawy panel nie jest stały; szczegóły wydarzenia otwierają lekki drawer;
- status źródeł jest pojedynczym kompaktowym wskaźnikiem, nie serią dużych kart.

## 7. Teresa

Teresa jest planistą i konsultantem, nie autonomicznym właścicielem kalendarza. Może:

- przygotować plan dnia/tygodnia;
- znaleźć brak czasu dla priorytetów;
- zaproponować focus blocks, prep i follow-up;
- wykryć overload, double booking i ryzyko deadline;
- zaproponować przesunięcia z uzasadnieniem i wpływem;
- przygotować slot na decyzję lub review inicjatywy.

Zmiana uczestników, czasu zewnętrznego eventu, deadline'u owner object oraz seria cykliczna zawsze przechodzą `proposal → preview impact → approve → conditional write → read-back`.

## 8. Dokumenty pakietu

- [kompletny katalog funkcji](CALENDAR_COMPLETE_FUNCTION_CATALOG.md);
- [kontrakt synchronizacji i interoperacyjności](CALENDAR_SYNCHRONIZATION_AND_INTEROPERABILITY_CONTRACT.md);
- [UX, Teresa i planowanie obciążenia](CALENDAR_UX_AI_AND_CAPACITY_STANDARD.md);
- [AS-IS, luki MVP i golden flows](CALENDAR_AS_IS_MVP_GAPS_AND_QUESTIONS.md).

## 9. Standard jakości

- każdy event ma źródło, external/internal ID, timezone i sync state;
- free/busy nigdy nie ujawnia tytułu ani opisu;
- recurrence zachowuje series master, instances, exceptions i cancellation;
- drag/drop respektuje edit authority i etag;
- nieaktualny source pokazuje `last successful sync`;
- konflikt jest stanem produktu z akcją naprawczą;
- czas jest przechowywany jednoznacznie i renderowany w wybranej strefie;
- all-day nie jest zamieniany na blok 00:00–24:00.
