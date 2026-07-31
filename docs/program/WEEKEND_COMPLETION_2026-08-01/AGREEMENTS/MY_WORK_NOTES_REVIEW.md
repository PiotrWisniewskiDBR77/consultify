---
doc_kind: PRODUCT_FUNCTION_REVIEW
module_id: MODULE_MY_WORK
function_id: MW_NOTEBOOK
status: REVIEW
owner_business: user
owner_tech: user
last_updated: 2026-07-31
---

# My Work — Notes / Notatki

## 1. Decyzja produktowa

`Notatki` są osobistym i projektowym warsztatem wiedzy roboczej. Służą do szybkiego zapisania informacji, rozwinięcia jej w uporządkowaną wiedzę, zweryfikowania oraz świadomego przekazania wyniku do innych części Consultify.

Nie są repozytorium dokumentów organizacji (`Materials`), tablicą pomysłów (`Ideas`) ani właścicielem tasków, decyzji i inicjatyw. Mogą przygotować kandydatów dla tych modułów, lecz zapis kanoniczny wykonuje moduł docelowy.

## 2. Jeden słownik produktu

| Pojęcie | Znaczenie |
| --- | --- |
| `Notatki` / `Notes` | funkcja w `My Work` |
| `Notatnik` / `Notebook` | kolekcja stron o określonym zakresie i dostępie |
| `Strona` / `Page` | pojedyncza notatka, która ma własny cykl życia |
| `Blok` / `Block` | najmniejszy edytowalny element strony |
| `Capture Inbox` | kolejka treści zapisanych bez obowiązkowej klasyfikacji |
| `Źródło` | plik, link, rozmowa, e-mail lub wpis użytkownika, z którego pochodzi treść |

Słowo `Folder` nie jest nazwą kanonicznego obiektu. Może kiedyś zostać użyte jako dodatkowe grupowanie notatników, ale nie może być zamiennikiem `Notatnika`.

## 3. Główne zadania użytkownika

1. zapisać myśl, link, plik, fragment rozmowy albo wiadomość bez przerywania pracy;
2. odnaleźć notatkę przez strukturę, metadane albo wyszukiwanie semantyczne;
3. rozwinąć i uporządkować treść ręcznie lub z pomocą Teresy;
4. ustalić źródła, aktualność i poziom weryfikacji wiedzy;
5. połączyć stronę z innymi stronami i obiektami aplikacji;
6. wyprowadzić zatwierdzony rezultat: idea, task, decyzja, kandydat inicjatywy albo materiał roboczy.

## 4. Architektura funkcji

```text
My Work / Notatki
├── Biblioteka notatników
│   ├── prywatne
│   └── projektowe / zespołowe
└── Notatnik
    ├── Capture Inbox
    ├── Strony aktywne
    ├── Do przeglądu
    ├── Przypięte / ostatnie / osierocone
    ├── Tematy i relacje
    └── Strona
        ├── edytor blokowy
        ├── źródła i załączniki
        ├── kontekst i backlinki
        ├── historia wersji
        ├── Teresa / działania AI
        └── jawne handoffy
```

Szczegółowe kontrakty:

- [architektura informacji i edytor](NOTES_INFORMATION_ARCHITECTURE_AND_EDITOR_STANDARD.md);
- [capture, wyszukiwanie, wiedza i Teresa](NOTES_CAPTURE_SEARCH_AI_AND_KNOWLEDGE_CONTRACT.md);
- [minimalistyczny prawy panel](NOTES_RIGHT_RAIL_MINIMALISM_STANDARD.md);
- [benchmark rynku i brakujące zdolności](NOTES_MARKET_BENCHMARK_AND_CAPABILITY_GAPS.md);
- [kompletny katalog funkcji](NOTES_COMPLETE_FUNCTION_CATALOG.md);
- [finalny blueprint wdrożeniowy](NOTES_TARGET_IMPLEMENTATION_BLUEPRINT.md);
- [stan obecny, luki MVP i pytania](NOTES_AS_IS_MVP_GAPS_AND_QUESTIONS.md).

## 5. Przepływ podstawowy

`Capture → Inbox → Triage → Develop → Verify → Connect → Approve output → Owner-module read-back`

1. Treść trafia do `Inbox`, jeśli użytkownik nie wybrał miejsca docelowego.
2. Triage ustala notatnik, temat, status, właściciela i ewentualny projekt.
3. Użytkownik albo Teresa rozwija treść. Każda zmiana AI jest propozycją.
4. Przed wykorzystaniem biznesowym system pokazuje źródła, założenia, aktualność i status weryfikacji.
5. Konwersja tworzy nowy obiekt-kandydata z backlinkiem do strony; nie nadpisuje notatki.
6. Sukces handoffu jest potwierdzony dopiero po odczycie zwrotnym modułu docelowego.

## 6. Cykl życia strony

| Status | Znaczenie | Dopuszczalne przejście |
| --- | --- | --- |
| `inbox` | uchwycona, jeszcze niesklasyfikowana | `active`, `archived` |
| `active` | świadomie rozwijana lub używana | `converted`, `archived`, ponownie `inbox` przy zwrocie do triage |
| `converted` | ma co najmniej jeden zatwierdzony wynik w innym module | nadal edytowalna z wersjonowaniem; może być `archived` |
| `archived` | wyłączona z bieżącej pracy, zachowana i wyszukiwalna | `active` po przywróceniu |

Status treści jest oddzielny od `verificationStatus` (`unverified`, `verified`, `disputed`) oraz od aktualności (`fresh`, `stale`). Nie wolno łączyć tych osi w jeden badge.

## 7. Standard jakości

Notatka gotowa do użycia biznesowego ma:

- jasny tytuł i czytelną strukturę;
- autora, zakres dostępu i datę aktualizacji;
- źródło albo jawne oznaczenie, że treść jest założeniem;
- rozdzielone fakty, interpretacje, decyzje i działania;
- widoczne powiązania oraz brak ukrytych zapisów do innych modułów;
- wersję i historię zmian przy pracy zespołowej;
- wyraźny status weryfikacji i aktualności.

## 8. Granice odpowiedzialności

| Obszar | Właściciel kanoniczny | Rola Notatek |
| --- | --- | --- |
| wiedza robocza i strony | Notes | pełna edycja i wersjonowanie |
| pliki organizacyjne | Materials | źródło/załącznik albo draft materiału |
| idee | Ideas | kandydat z cytatem i backlinkiem |
| inicjatywy | Initiatives | draft-kandydat, bez zatwierdzania lifecycle |
| taski i decyzje | My Work / Execution | propozycja, właściciel docelowy zatwierdza |
| trwała pamięć Teresy | warstwa knowledge/memory | wyłącznie jawna promocja zgodna z ACL |

## 9. Definition of Done dokumentacji

Pakiet jest gotowy do rozpisania implementacji, gdy:

- nazwy, hierarchia, menu i przejścia statusów są jednoznaczne;
- każdy input, output i zapis AI ma właściciela;
- wymagania P0/P1/P2 są oddzielone od istniejącego kodu;
- przypadki pusty/loading/error/degraded/conflict mają następny krok;
- testy pokrywają save/resume, provenance, ACL, wersje i handoff read-back.
