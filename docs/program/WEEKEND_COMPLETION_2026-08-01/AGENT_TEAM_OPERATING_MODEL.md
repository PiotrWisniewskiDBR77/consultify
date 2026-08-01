---
doc_id: claude-agent-team-operating-model
truth_type: operations
status: canonical
owner: codex
business-owner: piotr
last_reviewed: 2026-07-30
---

# Model zespołu agentów Claude

## Struktura

```text
Piotr — Product Owner
└── Codex — Program Manager / Lead Integrator / Quality Gate
    ├── Claude Discovery Agent
    ├── Claude Frontend Agent
    ├── Claude Backend & Data Agent
    ├── Claude Integration Agent
    ├── Claude Test & Evidence Agent
    └── Claude Security & Operations Agent
```

Role są logiczne. Jeden agent może pełnić więcej niż jedną rolę przy małym
pakiecie, ale nie może sam sobie zatwierdzić pracy.

## Odpowiedzialność Piotra

- wybór rezultatu biznesowego;
- decyzje koncepcyjne i priorytety;
- akceptacja kompromisów;
- odbiór produktu z perspektywy użytkownika;
- końcowa decyzja release.

## Odpowiedzialność Codex

- utrzymywanie programu, boardu i SSOT;
- rozbicie pracy na pionowe, niekolidujące pakiety;
- wybór kolejności i zależności;
- przydział agentów oraz kontrola WIP;
- ochrona istniejących zmian i historii;
- przegląd raportów, diffów, migracji i testów;
- integracja wyników wielu agentów;
- wykrywanie rozjazdów frontend–backend–dane;
- eskalowanie decyzji produktowych do Piotra;
- rekomendacja `GO / GO_WITH_GAPS / NO_GO`.

## Tory agentów

### Discovery Agent

Mapuje istniejące fragmenty. Nie implementuje. Dostarcza route, UI, API,
service, dane, testy, flagi, duplikaty i rekomendację losu.

### Frontend Agent

Domyka kanoniczną podróż użytkownika, stany i integrację z realnym API. Nie
tworzy lokalnych mocków jako rozwiązania produkcyjnego.

### Backend & Data Agent

Domyka owner service, guardy, walidację, migracje, transakcje, read-back i
audyt. Nie projektuje samodzielnie UX ani celu funkcji.

### Integration Agent

Łączy fragmenty w pionowy slice. Sprawdza kontrakt danych i usuwa zależność
głównej ścieżki od fallbacku. Nie zatwierdza własnego wyniku.

### Test & Evidence Agent

Tworzy testy kontraktu i E2E, odtwarza błędy, zapisuje evidence dla revision.
Nie łagodzi oczekiwań tylko po to, aby test stał się zielony.

### Security & Operations Agent

Sprawdza tenancy, capabilities, sekrety, migracje, backup, restore,
observability i rollback.

## Zasady pracy równoległej

- maksymalnie trzy aktywne pakiety, tylko gdy nie dotykają wspólnych ownerów;
- jeden plik lub owner service ma jednego aktywnego wykonawcę;
- zmiana kontraktu API blokuje równoległy frontend do czasu zamrożenia
  interfejsu;
- migracje są sekwencyjne;
- routing i wspólne komponenty mają osobne okno integracyjne;
- agent nie scala samodzielnie pracy innego agenta;
- Codex rozstrzyga konflikty i kolejność integracji.

## Assignment card

Każdy agent otrzymuje:

- ID pakietu;
- revision bazowy;
- kontrakt i oczekiwany rezultat;
- dozwolone pliki/ownery;
- zależności;
- zakazy;
- kryteria akceptacji;
- testy;
- format raportu;
- informację, kto wykona niezależny review.

Brak któregokolwiek elementu oznacza, że agent nie rozpoczyna implementacji.

## Przekazanie między agentami

Agent nie przekazuje pracy bezpośrednio jako „gotowej”. Zwraca artefakt do
Codex. Codex:

1. sprawdza zakres i dowody;
2. aktualizuje zależności;
3. przygotowuje kolejny pakiet;
4. dopiero wtedy uruchamia następny tor.

Zapobiega to sytuacji, w której agent frontendowy zakłada inny kontrakt niż
backendowy, a agent testowy testuje jeszcze trzeci wariant.

## Bramka integratora

Praca zespołu jest ukończona dopiero, gdy:

- istnieje jedno kanoniczne wejście;
- frontend używa rzeczywistego API;
- API używa owner service i trwałych danych;
- role i tenant są egzekwowane;
- read-back pokazuje wynik;
- audit i rollback są znane;
- test niezależny przechodzi;
- alternatywna implementacja ma określony los;
- SSOT opisuje stan po integracji.
