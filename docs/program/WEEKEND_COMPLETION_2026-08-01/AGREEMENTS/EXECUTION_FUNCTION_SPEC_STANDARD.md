---
doc_id: execution-function-spec-standard-2026-07-31
module: Execution
truth_type: product-target
status: CANONICAL_STANDARD
owner: product
prepared_by: codex
last_reviewed: 2026-07-31
---

# Execution — standard opisu pojedynczej funkcji

## 1. Zasada

Każda funkcja Execution ma własny, jednoznaczny kontrakt. Nazwa funkcji i
krótki opis w tabeli nie wystarczają do utworzenia zadania implementacyjnego.

Karta jest kompletna dopiero po opisaniu wszystkich poniższych pól. Jeśli pole
nie ma zastosowania, karta podaje `N/A` wraz z uzasadnieniem. Nie pozostawiamy
domyślnych założeń programiście.

## 2. Obowiązkowa struktura Function Card

### A. Tożsamość

- stabilny `function_id`;
- nazwa użytkowa;
- jednozdaniowy cel;
- problem, który rozwiązuje;
- priorytet `MVP/NEXT/LATER`;
- status `CONCEPT/DRAFT/READY/IMPLEMENTED/VERIFIED/ACCEPTED`;
- właściciel produktu i właściciel techniczny.

### B. Zakres

- co funkcja obejmuje;
- czego świadomie nie obejmuje;
- moduł będący właścicielem prawdy;
- zależności od innych funkcji;
- ograniczenia wersji MVP.

### C. Użytkownicy i uprawnienia

- primary actor;
- secondary actors;
- role odczytu, tworzenia, edycji, zatwierdzania i usuwania;
- zasada self-approval;
- widoczność organizacyjna i item-level;
- zachowanie dla użytkownika bez uprawnień.

### D. Trigger i wejście

- wszystkie miejsca uruchomienia;
- trigger ręczny, automatyczny lub systemowy;
- required inputs;
- optional inputs i defaults;
- source object oraz source version;
- idempotency i ochrona przed duplikatem.

### E. Preconditions

- wymagany status obiektu;
- wymagane dane;
- wymagane integracje;
- wymagane zgody;
- warunki blokujące.

### F. Happy path krok po kroku

Numerowana sekwencja od pierwszej czynności użytkownika do read-backu.
Każdy krok wskazuje:

- aktora;
- akcję;
- reakcję systemu;
- zapisane dane;
- możliwy punkt review lub approval.

### G. Warianty

- alternatywne poprawne ścieżki;
- tryb Lite/Standard/Complex;
- bulk action;
- mobile/quick action;
- uruchomienie przez Teresę;
- uruchomienie przez automation/API.

### H. Model danych

- encje i pola;
- required/optional;
- typy, jednostki i formaty;
- relacje;
- source of truth;
- versioning;
- retention i archive.

### I. Stany i przejścia

- kompletna state machine;
- aktor lub zdarzenie powodujące przejście;
- guards;
- stany terminalne;
- reopen/rollback;
- zakazane przejścia.

### J. Reguły biznesowe

- obliczenia;
- progi;
- walidacje;
- materiality;
- kolejność rozstrzygania reguł;
- zachowanie po zmianie konfiguracji.

### K. UI/UX

- miejsce w module;
- list/table/preview/workspace;
- pola i kolejność;
- primary CTA i secondary actions;
- confirmation;
- filtry, sortowanie i wyszukiwanie;
- responsive;
- accessibility;
- zgodność z kanonem UI Consultify.

### L. Stany interfejsu

- loading;
- empty;
- partial;
- stale;
- error;
- forbidden;
- conflict;
- archived;
- offline/retry, jeśli dotyczy.

### M. Teresa i automatyzacja

- co Teresa może odczytać;
- co może zaproponować;
- co może przygotować jako draft;
- co wymaga potwierdzenia;
- czego nie może wykonać;
- wymagane confidence, explanation i provenance.

### N. Powiadomienia i eskalacje

- odbiorcy;
- trigger;
- kanały;
- deduplikacja;
- terminy reakcji;
- escalation path;
- deep link;
- zasady wyciszenia.

### O. Integracje

Dla każdej integracji:

- producer;
- consumer;
- payload;
- source version;
- moment handoffu;
- retry;
- idempotency;
- read-back;
- zachowanie przy niedostępności.

### P. Audit i bezpieczeństwo

- rejestrowane zdarzenia;
- before/after;
- actor i acting-on-behalf-of;
- tenant/org isolation;
- dane wrażliwe;
- eksport i retention;
- operacje wymagające dodatkowego potwierdzenia.

### Q. Telemetria funkcji

- rozpoczęcie;
- ukończenie;
- porzucenie;
- czas przejścia;
- błąd;
- retry;
- approval/rejection;
- wynik biznesowy bez monitorowania pozornej aktywności pracownika.

### R. Scenariusze negatywne

Co najmniej:

- brak wymaganych danych;
- brak uprawnień;
- obiekt innej organizacji;
- duplikat;
- stale source version;
- konflikt równoczesnej zmiany;
- błąd integracji;
- częściowy zapis;
- ponowienie po timeout;
- obiekt zarchiwizowany.

### S. Acceptance scenarios

Scenariusze w formacie:

`Given → When → Then`

Minimum:

1. happy path;
2. alternate path;
3. validation;
4. permission;
5. cross-org denial;
6. conflict;
7. integration/read-back;
8. error and recovery;
9. audit trail;
10. UI/accessibility.

### T. Dowód ukończenia

- test jednostkowy reguł;
- test kontraktu API;
- test integracyjny;
- E2E na stagingu;
- screenshot/video właściwego runtime;
- fixture lub rekord testowy;
- link do diffu;
- znane ograniczenia;
- decyzja odbiorowa.

## 3. Bramka `READY_FOR_TASK_BREAKDOWN`

Funkcja może zostać rozpisana na zadania implementacyjne dopiero, gdy:

1. sekcje A–T są kompletne;
2. granice modułów są zatwierdzone;
3. nie ma sprzeczności z glossary i decision register;
4. source of truth jest wskazany;
5. stany i przejścia są jednoznaczne;
6. role i uprawnienia są opisane;
7. acceptance scenarios pozwalają stwierdzić `pass/fail`;
8. otwarte pytania są rozwiązane albo jawnie wyłączone z zakresu;
9. karta ma status `READY`.

Agent implementujący nie może samodzielnie wypełniać luk produktowych.

## 4. Bramka `DONE`

`IMPLEMENTED` nie oznacza `DONE`. Funkcja jest ukończona dopiero po:

`IMPLEMENTED → VERIFIED → ACCEPTED`

- `IMPLEMENTED` — kod i testy autora;
- `VERIFIED` — niezależna kontrola kontraktu, integracji i runtime;
- `ACCEPTED` — odbiór biznesowy, jeśli funkcja wymaga oceny produktu.

## 5. Rejestr kompletności

Katalog Execution zawiera obecnie **89 stabilnych identyfikatorów funkcji**.
Każdy otrzyma osobną Function Card zgodną z tym standardem.

Do tego czasu:

- katalog funkcji jest mapą zakresu;
- szczegółowe kontrakty grupowe są materiałem roboczym;
- żaden nieopisany element nie jest gotowy do przekazania programiście;
- status całego modułu pozostaje `DRAFT_FOR_OWNER_REVIEW`.
