---
doc_id: integration-consolidation-program
truth_type: delivery-status
status: canonical
owner: codex
implementation-lead: claude
last_reviewed: 2026-07-30
---

# Program scalania fragmentów aplikacji

## Diagnoza

Consultinity nie jest pustą aplikacją wymagającą budowy od zera. Repo zawiera
dużo częściowo gotowych rozwiązań, ale ich wartość jest ograniczona przez brak
pełnego spięcia:

- równoległe generacje widoków i usług;
- backend bez ukończonej powierzchni użytkownika;
- frontend korzystający z fallbacku, mocka lub starego API;
- komponent istniejący, ale niezamontowany w kanonicznym routingu;
- kilka wejść do tej samej funkcji;
- zapis bez read-backu w module właścicielskim;
- test lokalnego elementu bez dowodu całej podróży.

## Zmiana strategii

Domyślne pytanie nie brzmi już „co trzeba dopisać?”, lecz:

1. co już istnieje;
2. która implementacja ma najlepszy fundament;
3. czego brakuje między warstwami;
4. co scalić, przekierować, dokończyć lub wycofać;
5. jaki jeden E2E udowodni, że fragmenty tworzą funkcję.

Nie wolno tworzyć kolejnego Huba, V11 ani alternatywnej usługi bez wykazania,
że istniejących elementów nie można bezpiecznie scalić.

## Siedem warstw kompletnej funkcji

Każda funkcja musi mieć spójny łańcuch:

`wejście/nawigacja → frontend → stan → API → owner service → baza →
read-back/audit`

Ósmą warstwą jest dowód:

`test komponentu/API → E2E → smoke runtime`

Brak jednej warstwy oznacza fragment, nie ukończoną funkcję.

## Klasy fragmentów

| Klasa | Opis | Standardowa akcja |
| --- | --- | --- |
| `UI_ONLY` | gotowy ekran bez realnego backendu | podłączyć owner API albo ukryć |
| `BACKEND_ONLY` | działające API/usługa bez UI | zbudować minimalny frontend |
| `UNMOUNTED` | komponent istnieje, ale nie ma wejścia | zamontować lub oznaczyć historical |
| `PARALLEL` | kilka implementacji tego samego | wybrać kanon i migrować |
| `LEGACY_ALIAS` | stara trasa/widok | kontrolowany redirect i telemetryka |
| `FALLBACK_DEPENDENT` | sukces zależy od fallbacku | usunąć z głównej ścieżki |
| `NO_OWNER_WRITE` | zapis omija właściciela danych | przepiąć na owner lane |
| `NO_READBACK` | akcja nie potwierdza wyniku | dodać odczyt i błąd |
| `NO_E2E` | części mają testy, przepływ nie | zbudować golden flow |
| `CONCEPT_GAP` | implementacja nie ma jasnej wartości | wrócić do procesu koncepcyjnego |

## Sposób scalania

1. zamrozić dodawanie alternatyw;
2. zinwentaryzować wszystkie fragmenty funkcji;
3. wskazać implementację kanoniczną;
4. opisać luki pomiędzy warstwami;
5. wykonać najmniejszy pionowy slice end-to-end;
6. przełączyć kanoniczne wejście;
7. zachować redirect dla ważnych deep linków;
8. zmierzyć użycie legacy;
9. usunąć lub zarchiwizować dopiero po okresie ochronnym;
10. zaktualizować SSOT i evidence.

## Zakaz „wielkiego przepisywania”

Scalanie odbywa się pionowymi slice’ami. Nie wykonujemy jednego globalnego
refaktoru 369 widoków. Każdy pakiet obejmuje jedną funkcję użytkownika i
domyka jej pełny łańcuch.
