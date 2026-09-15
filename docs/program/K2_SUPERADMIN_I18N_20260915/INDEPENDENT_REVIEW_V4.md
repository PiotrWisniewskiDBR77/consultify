# K2 SuperAdmin i18n — niezależny re-review v4

**Werdykt: HOLD wyłącznie przez błędny exact SHA review v3 w `SIGNED_RECEIPT_V4.md`; korekta dowodów v4 spełnia pozostałe warunki odbioru, a produkt jest byte-unchanged i zdrowy.** Kandydat exact `35c49077b66b066a3e7efe0e12dcc4f9f21c8441` poprawnie zastępuje błędne mianowniki 639 i 7310, lecz receipt zapisuje dla niezależnego review v3 nieistniejący obiekt `17938bf6f0dfe1bf9df357d2bd059d5acdb7cc9e`. Rzeczywisty commit to `17938bf6f04f20cbbe80b418bcf1bc0315ce17f6`.

## Niezmienność produktu

Drzewa `src`, `public/locales` i `tests` są identyczne między odebranym v3 `f2f90e17407f4ec5d91bcbfc2bb319852ad85e4f` a kandydatem v4. Delta v4 zawiera wyłącznie dokumenty i dowody K2. Nie wykonywano ponownie pełnego odbioru produktu.

## Mianownik importerów

`importer-full-results-v4.tsv` ma 96 unikalnych wierszy i jawne pola JSON Vitest. Niezależne przeliczenie daje dokładnie:

- 93/96 plików RC0;
- 546 zielonych asercji;
- 2 czerwone asercje;
- 1 czerwony suite przed zebraniem testów;
- 548 zebranych asercji łącznie.

Wszystkie sumy per wiersz są spójne. Trzy niezielone wiersze pozostają oznaczone `IDENTICAL`. Stary `importer-full-results-v3.tsv` zachowano jako ślad, ale nagłówki jednoznacznie opisują jego kolumny jako `reporter_*_events_INCORRECT_FOR_ASSERTIONS`; manifest, freeze i gates wskazują już właściwe liczby. Historyczne `639 GREEN` pozostaje tylko w review v3 jako opis znalezionego błędu, a nie jako aktualna deklaracja.

## TSC i rozmiar dowodów

`front-tsc-v4-summary.txt` zapisuje odtwarzalną komendę bez cache oraz wynik RC2, 177 diagnostyk, 7425 ścieżek wszystkich rozszerzeń i zero błędów w ścieżkach K2. Plik zawiera dokładnie 177 linii `error TS…`; żadna nie wskazuje `src/views/superadmin` ani `src/components/SuperAdmin`. Stary plik v3 oznacza 7310 jako `SUPERSEDED CACHE/FILTER ARTIFACT`.

Katalog dowodów zajmuje 1600 KiB, poniżej limitu 2 MiB.

## Łańcuch i jedyny bloker

Prawidłowo rozwiązują się:

- treść produktu i dowodów: `e5a7636bc01029a9e344acc570e86963a0b29f62`;
- freeze v3: `f8ebbd408185ddc5cf5d9903fcb457cc82371103`;
- receipt v3: `f2f90e17407f4ec5d91bcbfc2bb319852ad85e4f`;
- rzeczywisty review v3: `17938bf6f04f20cbbe80b418bcf1bc0315ce17f6`;
- korekta evidence: `69a7d4452a2bc387c731362e4f0978b51c620142`, tree `22a25ab1ee4d2904b006d3c7ad16dae24fda966c`;
- receipt v4: `35c49077b66b066a3e7efe0e12dcc4f9f21c8441`.

Relacja rodziców jest liniowa: `f2f90e… → 17938bf6… → 69a7d445… → 35c49077…`, a commit receipt v4 dodaje wyłącznie `SIGNED_RECEIPT_V4.md`. Wewnątrz tego pliku pole `Independent review v3` ma jednak błędny full SHA `17938bf6f0dfe…`, którego Git nie rozwiązuje. To narusza wymaganie exact readback i blokuje ACCEPT mimo poprawnego grafu commitów.

## Warunek ACCEPT

Zmienić wyłącznie `SIGNED_RECEIPT_V4.md`, wpisując `17938bf6f04f20cbbe80b418bcf1bc0315ce17f6`, następnie dodać nowy receipt wskazujący exact commit tej korekty. Produktu, locale, testów i pozostałych dowodów nie zmieniać.
