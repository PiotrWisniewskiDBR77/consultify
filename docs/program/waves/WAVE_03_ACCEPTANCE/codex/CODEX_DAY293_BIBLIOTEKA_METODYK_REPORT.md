# CODEX DAY 293 — BIBLIOTEKA METODYK

Stan po wznowieniu w dyżurze 322: **CZĘŚCIOWE**.

## Ocena zastanego WIP

Przeczytano pełny niecommitowany diff: 4 zmienione pliki (304 dodania, 144 usunięcia) oraz nowy test kontraktowy. WIP jest zgodny z rdzeniem R1/R2 instrukcji 293, dlatego został zachowany i dokończony bez odrzucania cudzej pracy.

- Biblioteka renderuje czysty katalog pięciu metodyk, bez rekordów sesji.
- `StandardTable` ma dokładnie siedem kolumn B2: nazwa, obszar, opis, liczba pytań, czas trwania, status, ostatnio użyta.
- Dane nieistniejące w katalogu (`duration`, `lastUsed`, część liczników pytań) pozostają `null` i są prezentowane jako `—`; nie zostały wymyślone.
- `StandardPreview` pokazuje opis, osie/obszary i istniejącą akcję `Rozpocznij ocenę` tylko dla wspieranego DRD.
- Filtry huba dotyczą metodyk i statusu katalogowego, nie statusów sesji.

## Pomiar testów po zmianie

Komenda użyła `RUN_DB_TESTS=0 MOCK_DB=true`, `--retry=0` i reportera JSON. Wynik: 9/9 pełnych przypadków PASS. Plik: `/private/tmp/cx-day322-reszta-domkniec-artefakty/day293-library-po.json`.

Nowe pełne nazwy kontraktu:

- `AssessmentLibraryTab B2 canonical contract declares exactly seven B2 columns and no session rows`
- `AssessmentLibraryTab B2 canonical contract opens StandardPreview with axes and the existing start action`

Pakiet jest czysto komponentowy; nie dowodzi ApiGateway, JWT ani PostgreSQL i nie jest tak raportowany.

## Twierdzenia niezweryfikowane

Nie wykonano wymaganych 8 kadrów light/dark pl/en, pełnego przeglądu checklisty triady, porównania wizualnego PRZED/PO ani akceptu właściciela. Nie dowiedziono również produkcyjnego HTTP dla rozpoczęcia oceny w tym przebiegu. Pozycja nie jest domknięta.

## Domknięcie w dyżurze 329 — 2026-09-04

- Wykonano porównanie PRZED/PO: osiem różnych plików PNG (PL/EN, light/dark) ma różne SHA-256, zmierzoną jasność i rozmiar. Kanoniczne narzędzie oznaczyło jednak wszystkie jako `wynik BRAK`, ponieważ po obowiązkowej próbie rozwinięcia nadal wykrywało prawidłowo zwinięte kontrolki wyszukiwania, filtrów, ustawień widoku i akcji wiersza. Kadry są materiałem diagnostycznym, a nie pełnym dowodem odbiorowym.
- Sprawdzono widoczną triadę w kadrach oraz `check-list-canon`: ekran korzysta z realnego `StandardTable` i `StandardPreview`; nie powstała bespoke tabela. Dodany test bez mocka renderuje `table[data-min-table-width]` i kontrolkę ustawień widoku.
- Porównanie pełnych nazw testów PRZED/PO nie wykazało nazw znikniętych; doszły trzy przypadki kontraktu Biblioteki, w tym test realnej tabeli.
- Akcept właściciela: **nadal niezweryfikowany**; dyżur 329 go nie ogłasza.
- Produkcyjny HTTP dla akcji „Rozpocznij ocenę”: **nadal niezweryfikowany** i poza zakresem dyżuru 329.
