---
doc_id: ssot-completeness-matrix
truth_type: delivery-status
status: canonical
owner: product-engineering
last_reviewed: 2026-07-30
---

# Macierz kompletności źródeł prawdy

## Werdykt

Mamy kompletną **mapę dokumentacji i odpowiedzialności**, ale nie mamy jeszcze
kompletnego, zweryfikowanego runtime całego produktu. To rozróżnienie jest
obowiązkowe.

| Obszar | Czy mamy źródło? | Czy zweryfikowane? | Stan |
| --- | --- | --- | --- |
| wizja i obietnica | tak | produktowo | komplet mapy |
| 16 pozycji menu | tak | kod nawigacji | komplet |
| kontrakty funkcjonalne | 16/16 | nierówno per moduł | komplet struktury |
| AS-IS vs TO-BE | tak | Chat najgłębiej | wymaga dalszych audytów |
| własność obiektów | tak | częściowo | wymaga schema/API review |
| przepływy cross-module | tak | częściowo | wymaga E2E |
| UI/UX | tak | częściowo | duży zasób, wymaga redukcji konfliktów |
| architektura | tak | mapa datowana | wymaga automatycznej inwentaryzacji |
| API | kod istnieje | brak jednego aktualnego katalogu | luka |
| model danych | migracje istnieją | dokumenty częściowo sprzeczne | luka P0 |
| AI i governance | liczne źródła | nierówno | luka przekrojowa |
| role/capabilities | liczne źródła | brak jednego wygenerowanego wykazu | luka P0 |
| integracje | liczne źródła | brak jednolitego health catalog | luka |
| bezpieczeństwo | źródła istnieją | pełny skan nieuruchomiony | luka |
| środowiska/release | runbook istnieje | stan zewnętrzny niezweryfikowany | luka |
| backup/restore | skrypty i opisy | świeży restore test niepotwierdzony | luka P0 |
| testy | szeroki zestaw | nie wszystkie zielone | luka |
| observability/incydenty | implementacja i dokumenty | nierówno | luka |
| lokalizacja/a11y | skrypty i standardy | pełna bramka nieuruchomiona | luka |
| historia decyzji | zachowana | nadmiar i duplikaty | kontrolowana historia |
| integracja pionowa funkcji | program utworzony | mapa fragmentów do wykonania | luka P0 |

## Brakujące źródła wykonawcze

Najważniejsze następne artefakty nie powinny być pisane ręcznie, lecz
generowane lub audytowane z kodu:

1. aktualny katalog endpointów i ich guardów;
2. aktualny katalog tabel/encji i ownership;
3. macierz capabilities: frontend, backend i role;
4. katalog integracji z konfiguracją, ownerem i health checkiem;
5. rejestr feature flags i środowisk;
6. raport backup → restore;
7. globalny release gate z jednym revision ID;
8. klasyfikacja 1076 dokumentów deklarujących „SSOT/kanon”.
9. mapa route → UI → API → guard → service → data → test dla 16 modułów.

## Definicja „mamy wszystko”

Można ją ogłosić dopiero, gdy:

- każdy kontrakt ma aktualny AS-IS i dowód runtime;
- API, schema i capabilities są zinwentaryzowane automatycznie;
- wszystkie P0 mają właściciela i test;
- staging/production oraz restore są zweryfikowane;
- nie ma dwóch aktywnych kanonów dla jednego zakresu;
- pełna bramka release przechodzi na wskazanym commicie.
