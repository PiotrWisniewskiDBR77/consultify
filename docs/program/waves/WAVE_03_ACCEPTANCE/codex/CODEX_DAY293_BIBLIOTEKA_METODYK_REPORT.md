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
