# K2 SuperAdmin i18n — niezależny re-review v3

**Werdykt: HOLD wyłącznie na dowodzie liczbowym i spójności freeze; produktowa poprawka K2 jest zdrowa.** Kandydat `f2f90e17407f4ec5d91bcbfc2bb319852ad85e4f` zamyka blokery produktu z review v2: pełny front TSC wraca do 177 z zerem błędów w ścieżkach K2, status `pending` ma poprawną formę „Oczekująca” i jest pokazany na czystym zrzucie, a semantyczne tłumaczenia oraz formuła pozostają poprawne. Odbioru nie można jednak oznaczyć ACCEPT, ponieważ `639 GREEN` nie jest liczbą zielonych testów: zapisany parser doliczył po jednym zielonym wyniku pliku do asercji dla każdego z 93 plików RC0. Freeze ma również błędny, nieistniejący pełny SHA commitu treści i deklaruje nieodtwarzalny mianownik `7310` plików TSC.

## Tożsamość

- Exact candidate i backup wykonawcy: `f2f90e17407f4ec5d91bcbfc2bb319852ad85e4f`.
- Exact base W73: `f2628a0d36af85d97bcbe67b820d728c7c2f2f28`.
- Prawidłowy łańcuch: treść/dowody `e5a7636bc01029a9e344acc570e86963a0b29f62` → freeze `f8ebbd408185ddc5cf5d9903fcb457cc82371103` → receipt `f2f90e17407f4ec5d91bcbfc2bb319852ad85e4f`.
- `f8ebbd…` dodaje tylko `FREEZE.md`, a `f2f90e…` tylko `SIGNED_RECEIPT_V3.md`; backup wykonawcy wskazuje exact candidate.
- `FREEZE.md` podaje `e5a7636bc0f6d86681cae20e8b19b503497fbf56`; taki obiekt Git nie istnieje. `SIGNED_RECEIPT_V3.md` podaje prawidłowy `e5a7636bc01029a9e344acc570e86963a0b29f62`.

## P2 — poprawić mianownik testów importerów

Niezależny przebieg uruchomił każdy z 96 plików osobno przez `vitest --retry=0 --reporter=json`, z limitem 120 s na plik. Poprawny wynik to:

- **93/96 plików testowych RC0**;
- **546 zielonych asercji**;
- **2 czerwone asercje**;
- **1 czerwony suite przed zebraniem testów** (`resource-management-components.test.tsx`, 0 zebranych asercji).

Deklarowane `639 GREEN / 3 RED` powstało przez liczenie symboli raportera verbose. Dla każdego pliku RC0 parser policzył zieloną linię `Test Files 1 passed` razem z asercjami: `546 + 93 = 639`. Po czerwonej stronie policzył dwie czerwone asercje i jeden czerwony suite: `2 + 1 = 3`. Kolumny `passed`/`failed` w `importer-full-results-v3.tsv` są więc liczbą zdarzeń raportera, mimo że dokument nazywa je liczbami testów. Wymagane jest przepisanie TSV z JSON Vitest albo jawne nazwanie metryki; freeze i manifest muszą podawać właściwy mianownik powyżej.

Trzy niezielone pliki są uczciwie exact-base-identical:

- `PartnerEconomicsApprovedOut.ui.test.tsx`: 1/2, brak Routera; blob testu `29e2b48…` i `PartnerSettlementsView.tsx` `cd8302ba…` identyczne;
- `resource-management-components.test.tsx`: suite nie startuje przez nieistniejący `BudgetDashboard`; blob testu `b121ac17…` identyczny, źródło nie istnieje po obu stronach;
- `settings-admin-superadmin.p31-33.test.ts`: 78/79, zastana tekstowa asercja; blob testu `adb180d1…` i `adminNavigation.ts` `fdaced1f…` identyczne.

## Pełna delta i NONE_FOUND

Niezależne porównanie z bazą daje dokładnie 180 zmienionych TSX. Mapa ma 180 wierszy: 83 pliki źródłowe mają łącznie 93 unikalne bezpośrednie importery, a 97 ma `NONE_FOUND`. Lista uruchomień ma 96 plików: 93 importery, własny test K2 oraz dwa source-contract.

Próbka `NONE_FOUND` była sprawdzona po nazwie i po rzeczywistych importach, między innymi dla `AlertPlaygroundTester`, `EmailConfigurationPanel`, `SuperAdminDashboard`, `OperationsHealthDrilldownPanel`, `ReleasePanel`, `DashboardBuilderView` i `PricingPlansAdvancedView`. Nazwane testy `EmailConfigurationPanel` i `SuperAdminDashboard` definiują lokalne stuby zamiast importować produkt, więc `NONE_FOUND` jest w tych przypadkach uczciwe. Esbuild pełnych 180/180 plików produktu przechodzi.

## Semantyka, UI i LLM

- Test K2: 3/3 GREEN. Pełny sweep 539 pierwotnych kluczy oraz 17 kluczy Organizations zachowuje parytet EN/PL, placeholdery i znaczenie. Wskazane wcześniej błędy grant/reveal/target audience/secret rotation/Failed/rate limiting/telemetry są poprawione, a `SUM(revenue) / COUNT(users)` pozostaje literalnie niezmienione.
- Organizations PL jest rzeczywiście polskie: tytuł, opis, akcje, zakładki, wyszukiwarka, komunikat, nagłówki, statusy „Aktywna” i „Oczekująca”. Zrzut `organizations-pl-pending-light.png` obejrzano; trwały log potwierdza screenshot RC0, konsolę 0 i sieć 4xx/5xx 0.
- Zmiana oczekiwania LLM na `/own model ID/i` nie ukrywa polskiej regresji. Test działa w domyślnym EN i kończy 6/6 GREEN; niezależny odczyt realnego zasobu przez `createRealT('pl')` zwraca `lub wpisz własne ID modelu`.
- Evidence ma 1540 KiB, poniżej limitu 2 MiB.

## Pozostałe bramki

- Pełny front TSC: RC2, **177** błędów, **0 owned K2**. Niezależny `--listFiles` bez incremental nalicza 7425 ścieżek; freeze podaje 7310 po przebiegu z `--incremental`. Liczba błędów i owned gate są odtworzone, lecz `7310` nie jest porównywalnym mianownikiem bez zapisu cache/komendy wejściowej.
- Server TSC: RC0.
- `check:jezyk:ci`: RC0, K4en -600, K7 -168; w zakresie zostaje K4en 1 (`pending:` jako klucz techniczny), K7 0.
- `check-list-canon`: 349 = baseline 349. `check-artefakt`: 8 / 0 / 117 = baseline.
- Pełny build: RC0, 10754 moduły. Esbuild delty: 180/180 GREEN.
- `git diff --check`: RC0. Brak nowych migracji i brak nowych `as any` w delcie K2.

## Warunek ACCEPT

Nie zmieniać produktu. Wygenerować `importer-full-results-v4.tsv` z pól JSON Vitest i podać 546 passed assertions / 2 failed assertions / 1 failed suite oraz 93/96 RC0. Poprawić te liczby w manifeście i freeze, zapisać odtwarzalną metodę liczenia TSC albo usunąć 7310, oraz poprawić SHA treści w `FREEZE.md` na `e5a7636bc01029a9e344acc570e86963a0b29f62`. Nowy signed receipt ma wskazywać exact commit dokumentów. Produkt nie wymaga kolejnej poprawki.
