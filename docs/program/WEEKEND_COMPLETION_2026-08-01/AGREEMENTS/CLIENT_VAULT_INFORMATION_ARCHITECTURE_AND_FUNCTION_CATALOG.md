---
document_id: CLIENT-VAULT-IA-FUNCTION-CATALOG
module: My Work / Client Vault
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Client Vault — architektura informacji i pełny katalog funkcji

## 1. Lista sejfów

Kolumny podstawowe: nazwa, liczba dokumentów, rozmiar, dokumenty w wiedzy AI,
błędy indeksowania i ostatnia zmiana. Search przeszukuje nazwy sejfów/projektów.
Nie dokładamy kolumn, które nie prowadzą do decyzji użytkownika.

Wiersz otwiera sejf; Menu 3 zawiera dostęp, ustawienia, retencję i operacje
administracyjne zależne od roli. Mój sejf i Sejf organizacji są systemowe i nie
mogą być usunięte. Sejf projektu wynika z projektu i jego członkostwa.

## 2. Wnętrze sejfu

### Menu i widoki

- `Documents` — podstawowa tabela plików i folderów;
- `Collections` — dynamiczne lub ręczne zestawy do pracy;
- `Reviews` — Review Tables i ich wyniki;
- `Knowledge` — publikacje baz wiedzy;
- `Activity` — audyt i zdarzenia dostępu.

Menu 2 pozostaje nawigacją huba. Filtry dokumentów są bezpośrednio nad tabelą:
folder, typ, kategoria, tag, status indeksu, sensitivity, AI visibility, autor,
data, wersja i source connector.

### Kolumny dokumentów

Nazwa, typ, folder, kategoria/tagi, zakres, rozmiar, status/wiedza AI, wersja,
ostatnia zmiana. Kolumny opcjonalne są w managerze tabeli. Błąd indeksowania ma
konkretny powód i akcję `Napraw/Ponów`, nie sam czerwony status.

### Akcje

- upload pliku/folderu, drag-and-drop, skan mobile;
- import z connectora i konfiguracja one-way sync;
- nowy folder/kolekcja/Review Table/Knowledge Base;
- preview, pobranie, kopiowanie linku, przeniesienie i zmiana metadanych;
- nowa wersja, porównanie wersji, restore i oznaczenie canonical;
- `Ask Teresa`, `Summarize`, `Extract findings`, `Compare`, `Create review table`;
- link do obiektu aplikacji; proposal Insight/Decision/Task/Initiative/Material;
- archive/delete zgodnie z retencją i legal hold;
- bulk: tag, folder, collection, access, reindex, export, archive.

## 3. Preview dokumentu

Preview ma zachować strony i układ, obsługiwać wyszukiwanie, miniatury, zoom,
tekst/OCR i bezpośrednie przejście do cytatu. Prawy panel zawiera:

1. Overview: status, owner, scope, sensitivity, AI visibility;
2. Metadata: typ, język, daty, kontrahenci/tematy i custom fields;
3. AI: summary, findings, entities, suggested tags i pytania;
4. Relations: projekty, obiekty Consultify, kolekcje i Knowledge Bases;
5. Versions: checksum, source, diff i canonical version;
6. Activity: upload, odczyt, retrieval, eksport, share i zmiany ACL.

AI-generated metadata jest propozycją z confidence i provenance. Zatwierdzone
metadane człowieka nie są nadpisywane bez diffu.

## 4. Review Table

Review Table analizuje wiele dokumentów tym samym zestawem pytań/kolumn.
Kolumna ma nazwę, instrukcję, typ danych, dozwolone wartości, wymagane cytowanie,
walidację i wersję promptu. Komórka pokazuje wynik, confidence, źródło oraz stan
`unreviewed/accepted/edited/rejected/not_found`.

Obsługa: template, własne kolumny, filtrowanie, sortowanie, grouped review,
rerun wybranych komórek, human review, eksport CSV/XLSX i przekazanie wyników do
Materials/Finance/Tools/Audit. Prompt review jest widoczny tylko zgodnie z ACL.

## 5. Knowledge Base

Knowledge Base jest publikowaną, wersjonowaną kolekcją zatwierdzonych źródeł,
np. metodologie, templates, standardy, playbooki i wiedza klienta. Ma ownera,
opis zastosowania, audience, source manifest, quality review, wersję, datę
ważności i status `draft/review/published/deprecated/archived`.

Publikacja uruchamia kontrolę dostępu, duplikatów, nieaktualnych wersji,
malware/DLP i kompletności indeksu. Konsumenci mogą pinować konkretną wersję
albo śledzić latest. Usunięcie źródła pokazuje impact przed wykonaniem.

## 6. Empty, loading i degraded states

- pusty sejf wyjaśnia różnicę między uploadem, sync i Knowledge Base;
- processing pokazuje etap, kolejkę i możliwość bezpiecznego opuszczenia widoku;
- partial indexing pokazuje liczbę gotowych/błędnych dokumentów;
- brak uprawnień nie ujawnia nazwy ani metadanych chronionego pliku;
- stale sync pokazuje ostatnią udaną synchronizację;
- unsupported/encrypted file prowadzi do naprawy, nie znika bez śladu.

## 7. Pytania do wspólnego odbioru

1. Czy `Collections`, `Reviews` i `Knowledge` mają być zakładkami od MVP, czy widokami zapisanymi?
2. Jakie pięć kategorii startowych zastępuje obecny generyczny słownik?
3. Czy foldery mogą być zagnieżdżone bez limitu, czy maksymalnie 2–3 poziomy?
4. Czy użytkownik może zmienić scope dokumentu samodzielnie po publikacji?
5. Które formaty eksportu Review Table są wymagane na staging?

## 8. Numerowany katalog funkcji do backlogu

| ID | Funkcja | Zachowanie i kryterium odbioru | Fala |
| --- | --- | --- | --- |
| VLT-F-001 | Lista sejfów | wyłącznie dostępne scope; liczniki zgodne z wnętrzem | MVP |
| VLT-F-002 | Search/deep link | brak metadata leak, permission check i bezpieczny powrót | MVP |
| VLT-F-003 | Dokumenty i filtry | pagination/virtualization, sort, filter i saved state | MVP |
| VLT-F-004 | Foldery | create/rename/move/delete-empty; folder nie zmienia ACL | MVP |
| VLT-F-005 | Upload pliku/folderu | review destination, async progress, retry i raport pominięć | MVP |
| VLT-F-006 | Metadata i scope | audyt, impact preview i autoryzacja zmiany | MVP |
| VLT-F-007 | Processing health | etap, chunks, failure reason i naprawa | MVP |
| VLT-F-008 | Preview | format-aware viewer, search i citation anchors | MVP |
| VLT-F-009 | Versions | immutable version, canonical, diff i stale impact | MVP |
| VLT-F-010 | Ask/Search | source picker, corpus summary i cytowana odpowiedź | MVP |
| VLT-F-011 | Summarize/Compare | jawny zakres, konflikty i citations | MVP |
| VLT-F-012 | Deep analysis | edytowalny plan, async run i manifest | P1 |
| VLT-F-013 | Collections | manual/dynamic set bez kopiowania plików | P1 |
| VLT-F-014 | Review definition | corpus, instructions, columns i cost preview | P1 |
| VLT-F-015 | Review execution | jobs per cell, pause/retry/rerun i version safety | P1 |
| VLT-F-016 | Human review | assign, verify, edit, flag, comment i activity | P1 |
| VLT-F-017 | Review reuse/export | chat z cell citations, XLSX/CSV i mapping | P1 |
| VLT-F-018 | KB draft/review | manifest, purpose, audience i quality check | P1 |
| VLT-F-019 | KB publish/lifecycle | immutable version, deprecate, archive i impact | P1 |
| VLT-F-020 | Connector binding | capabilities, minimum scope i folder preview | P1 |
| VLT-F-021 | One-way sync | create/update/move/delete policy i freshness | P1 |
| VLT-F-022 | Relations/proposals | provenance, preview/diff, owner read-back | MVP |
| VLT-F-023 | Sharing/content controls | role, expiry, download/export/prompt restrictions | P1 |
| VLT-F-024 | Archive/delete/hold | dependency check, grace, hold i purge | P1 |
| VLT-F-025 | Audit/admin health | historia dostępu i operacyjny stan wiedzy | MVP/P1 |
| VLT-F-026 | Mobile capture | scan/OCR/upload i poprawa metadanych | P1 |

Każda karta backlogu musi wskazać ID funkcji, encje, API, role, stany UI,
zdarzenia, testy i dokumenty standardu, które realizuje.

## 9. Invariants całej funkcji

- listy, liczniki, preview, download i AI używają tej samej policy;
- async action pokazuje job state i jest idempotentna;
- AI nie używa dokumentu `processing/failed/quarantined`;
- każda treść AI ma manifest źródeł albo jawny status bez źródeł;
- bulk nie omija permission check per item;
- utrata źródłowego ACL natychmiast unieważnia retrieval/cache access;
- zmiana version/prompt/model nie nadpisuje zweryfikowanego wyniku bez historii.
