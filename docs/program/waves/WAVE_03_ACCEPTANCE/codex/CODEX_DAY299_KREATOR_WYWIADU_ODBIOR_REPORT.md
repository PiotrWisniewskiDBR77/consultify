# Dyżur 299 — odbiór kreatorów

Marker: `416432abafe31a390a909cf7e460a4bad7bef191` (`MARKER OK`)  
Gałąź: `codex/day299-kreator-wywiadu-odbior-20260903`  
Stan początkowy: czysty worktree.

## R1 — pomiar

- Rodzina `creator-shell|creatorShell`: 6 plików, zgodnie z tezą instrukcji.
- Powierzchnie produktowe: 2 — `InsightCreatorModal` (wejście w Interview) i `InitiativeWizardModal` (wejścia `InitiativesHub` / `UnifiedCreateLauncher`).
- Flaga jest domyślnie ON od `ba0da208a3`; inicjatywy importują i wywołują ten sam `isInterviewCreatorShellEnabled`.
- Część B listy `TRIADA_KANON.md`: 43 punkty.
- Bazowy test a11y: 12 przypadków, 8 PASS i 4 FAIL; wszystkie cztery padają na starym wzorcu `Insight Title *` / `Tytuł wniosków *`.
- Dostępna nazwa wyrenderowanego pola według realnego DOM z Testing Library wynika z powiązanego `label` i brzmi `Insight Title (required)` / `Tytuł wniosków (wymagane)`. Produkt zachowuje `htmlFor=insight-creator-title`, `id=insight-creator-title`, `required` i `aria-required=true`; czerwone są zestarzałe asercje.

Łańcuch harnessu montuje realny `InsightCreatorModal`, ale jego host nie jest produkcyjnym wejściem. Łańcuch produktu Interview i wejście Initiatives nie zostały uruchomione przed R2, dlatego nie stawiam twierdzeń o geometrii na podstawie samego harnessu.

Artefakty: `/private/tmp/cx-day299-kreator-wywiadu-artefakty/r1-static.txt`, `przed.json`, `przed-nazwy.txt`.

## Korekty wobec instrukcji

Tezy liczbowe zostały potwierdzone. Instrukcja nie zawiera zapowiadanej „tabeli licencji”. Jednocześnie Z12 nazywa `src/components/Interview/__tests__/InsightCreatorModal.a11y.test.tsx` nietykalnym do zapisu, a R2 nakazuje naprawić cztery zestarzałe asercje właśnie w tym pliku. Bez imiennego wyjątku bezpieczniejsza interpretacja zabrania tej edycji.

### STOP — R2 cztery czerwone

Rodzaj: MERYTORYCZNY  
Powód: produkt ma poprawne wiązanie i nową zatwierdzoną nazwę dostępną, lecz jedyny plik z błędnymi asercjami jest jawnie nietykalny, a instrukcja nie zawiera tabeli licencji ani wyjątku.  
Licencja, którą sprawdziłem: Z12 — „Nietykalne do zapisu: `src/components/Interview/__tests__/InsightCreatorModal.a11y.test.tsx`”; wynik: brak tabeli licencji i brak imiennego wyjątku w całym dokumencie.  
Dowód: `przed.json` — 4/12 FAIL na wzorcach kończących się ` *`; DOM pokazuje istniejące `label[for=insight-creator-title]` i `input#insight-creator-title`.  
Co dostarczyłem ZAMIAST zmiany: pomiar 12 pełnych nazw, rozstrzygnięcie przyczyny i gotowy brief: cztery wywołania `getByLabelText` powinny oczekiwać odpowiednio `/^Insight Title \\(required\\)$/` i `/^Tytuł wniosków \\(wymagane\\)$/`, po czym wymagany jest RED po usunięciu `htmlFor` i GREEN po przywróceniu.  
Co zrobiłbym, gdyby zapadła decyzja X: po jawnej licencji zmieniłbym wyłącznie cztery wzorce, wykonał mutację `htmlFor`, porównał pełne nazwy przed/po i nie dotykał produktu.  
Rekomendacja dla nadzorcy: dopisać do instrukcji tabelę licencji z wyjątkiem dla jednego testu; promień zmiany to cztery asercje bez zmiany produkcji.  
Stan: zacommitowano częściowo w `3c15d51ee5`.  
Czy kontynuowałem pozostałe pozycje: TAK pomiarem zależności; R3–R5 nie otrzymują fałszywego odbioru, ponieważ wymagają zielonego kontraktu R2 i pełnego lokalnego przebiegu wizualnego.

## R3–R5 — stan

Nie utworzono rejestru 43×2 ani kadrów: brak kompletnego wykonania, a więc brak podstaw do znaków ✓/✗. Nie uruchomiono runtime'u, portów ani bazy. Blok A11Y 41–43, pełny cykl fokusa i zachowanie zagnieżdżonego `Esc` pozostają **NIEZWERYFIKOWANE**. Skan statyczny ujawnił dodatkowo użycie `--color-primary-600` w dekoracji nagłówka `WizardModal`; bez pełnej listy i oględzin nie kwalifikuję go jako naprawiony ani jako defekt.

## R6 — werdykt

Stan dyżuru: **CZĘŚCIOWE**. R1 wykonane; R2 rozstrzygnięte pomiarem, lecz naprawa jest zablokowana brakiem licencji; R3–R5 niewykonane. Twierdzenia o przejściu listy 43×2, ośmiu obejrzanych kadrach, Tab/Shift+Tab, jednopoziomowym Esc i pełnym `focus-visible` są **NIEZWERYFIKOWANE**.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

Baza dyżuru nie została utworzona; zdanie o konfiguracji SMTP oznacza brak możliwego źródła tych wierszy, nie wykonane zapytanie SQL.
