---
doc_kind: AI_AND_KNOWLEDGE_CONTRACT
function_id: MW_NOTEBOOK
status: REVIEW
last_updated: 2026-07-31
---

# Notes — capture, wyszukiwanie, Teresa i wiedza

## 1. Capture first

Szybkie zapisanie nie wymaga wyboru tagu, projektu ani typu. Minimalny input to treść, link lub plik. Brak klasyfikacji kieruje stronę do `Capture Inbox` ze statusem `inbox`.

Obsługiwane wejścia docelowe:

| Wejście | Zachowywane dane | Wynik |
| --- | --- | --- |
| wpis ręczny | autor, czas, tekst | strona inbox/active |
| link/web clip | URL, tytuł, czas pobrania, fragment | strona ze źródłem |
| plik PDF/XLSX/TXT/MD | oryginał, metadane, wynik ekstrakcji | strona + source file |
| e-mail | nadawca, temat, data, message ID | strona z provenance |
| chat/meeting | conversation/meeting ID, cytat, uczestnicy | strona z backlinkiem |
| głos | audio lub polityka retencji, transkrypt | strona z oznaczeniem transkrypcji |

Ekstrakcja nigdy nie udaje oryginału. System pokazuje, co pochodzi ze źródła, co zostało znormalizowane, a co dopisało AI.

## 2. Triage Inbox

Triage można wykonać pojedynczo lub grupowo. Działania: przenieś do notatnika, ustaw projekt/widoczność, dodaj temat, przypnij, oznacz do przeglądu, rozpocznij pracę, archiwizuj. Teresa może zaproponować klasyfikację i duplikaty, ale nie usuwa ani nie udostępnia treści samodzielnie.

## 3. Wyszukiwanie

Jedno pole obsługuje dwa tryby:

- dokładny: tytuł, treść, tag, osoba, projekt, plik;
- semantyczny: znaczenie i podobieństwo.

Zakres jest jawny: bieżąca strona, notatnik, wszystkie dostępne notatki albo projekt. Wynik pokazuje tytuł, trafny fragment, źródło, aktualność, zakres dostępu oraz powód dopasowania. Odpowiedź RAG musi cytować konkretne strony/bloki; brak dowodu daje odpowiedź `nie znaleziono wystarczającej podstawy`.

## 4. Rola Teresy

Teresa działa na czterech poziomach:

1. **Capture** — tworzy notatkę z rozmowy, zachowując cytat i kontekst.
2. **Develop** — porządkuje, streszcza, rozwija, tworzy checklistę/tabelę, proponuje pytania i luki.
3. **Knowledge quality** — wykrywa sprzeczności, przestarzałość, brak źródeł, duplikaty i osierocone strony.
4. **Handoff** — przygotowuje preview kandydata do innego modułu i wyjaśnia, co zostanie przeniesione.

Teresa nie może:

- zmienić widoczności, usunąć strony lub zatwierdzić biznesowej prawdy bez człowieka;
- przepisać źródła ani ukryć niepewności;
- wykonać kanonicznego zapisu do Ideas, Initiatives, Tasks, Decisions lub Materials;
- użyć prywatnej treści w szerszym kontekście bez uprawnienia.

## 5. Kontrakt propozycji AI

Każda propozycja zawiera:

- `proposal_id`, typ operacji i model/prompt version;
- zakres wejścia i użyte źródła;
- proposed patch albo preview nowego artefaktu;
- uzasadnienie, confidence i wykryte ryzyka;
- status `proposed`, `accepted` albo `rejected`;
- autora decyzji i czas.

Dla zmiany istniejącej treści wymagany jest diff. `Accept` tworzy nową wersję strony. `Reject` niczego nie mutuje. Działania można przyjąć fragmentami, jeśli wynik ma więcej niż jeden element.

## 6. Jakość wiedzy

Każda strona ma niezależne atrybuty:

- provenance: źródła i cytaty;
- verification: `unverified`, `verified`, `disputed`;
- freshness: data przeglądu, `staleAt` i właściciel aktualizacji;
- maturity: sygnał rozwoju strony, nie ocena prawdziwości;
- visibility: `private` albo `project`;
- relations: topics, mentions, backlinks i powiązane obiekty.

Weryfikacja oznacza świadome potwierdzenie przez uprawnioną osobę. AI może rekomendować weryfikację, ale nie nadaje statusu `verified`.

## 7. Output i handoff

| Cel | Minimalny payload | Warunek sukcesu |
| --- | --- | --- |
| Idea | tytuł, opis, problem/szansa, source page ID | Ideas zwraca candidate ID |
| Task | działanie, owner proposal, termin proposal, kontekst | właściciel tasków zwraca ID |
| Decision | pytanie decyzyjne, opcje, przesłanki, deadline | Decisions zwraca ID |
| Initiative | problem, rezultat, zakres, przesłanki, ryzyka | Initiatives zapisuje draft-kandydata |
| Material | typ, outline/treść, źródła | Materials zapisuje draft artefaktu |

Przed wysłaniem system pokazuje podsumowanie jak Gamma: co powstanie, jakie założenia zostaną użyte, gdzie trafi rezultat i czego brakuje. Konwersja jest idempotentna; ponowienie nie tworzy duplikatu. Strona zachowuje backlink i listę outputów.

## 8. Bezpieczeństwo

- wyszukiwanie i AI respektują ACL przed retrieval, nie dopiero przy wyświetleniu;
- prywatna strona pozostaje prywatna także w embeddingach, cache i logach;
- zmiana na `project` wymaga jawnego potwierdzenia;
- source file i załączniki dziedziczą co najmniej restrykcyjność strony;
- eksport ostrzega o treści poufnej i zachowuje attribution.

## 9. Metryki jakości

- czas od capture do zapisania;
- odsetek Inbox starszy niż ustalony próg;
- skuteczność odnalezienia strony i zero-result rate;
- udział outputów z poprawnym read-backiem;
- liczba konfliktów bez utraty danych;
- acceptance/rejection propozycji AI;
- udział stron biznesowo użytych bez źródła lub weryfikacji.
