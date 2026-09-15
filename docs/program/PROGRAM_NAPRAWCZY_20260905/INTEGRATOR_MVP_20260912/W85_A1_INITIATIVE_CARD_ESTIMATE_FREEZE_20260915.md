# W85 A-1 — karty N, wycena i zatwierdzenie

**Werdykt: READY FOR CTO REVIEW.** Paczka rozszerza kanoniczny mechanizm publikacji i przeglądu kart inicjatywy z DEC-489 o audytowalną wycenę. Nie tworzy drugiego silnika zatwierdzania. Flaga pozostaje domyślnie wyłączona.

## Zakres i baza

- Baza: `9badae5335`.
- Gałąź: `codex/f2-a1-initiative-estimate-20260915`.
- Moduł: `05_INITIATIVES`; znacznik commitów: `[ODMROZENIE 05_INITIATIVES DEC-489]`.
- Bramka: `VITE_INITIATIVES_PORTFOLIO_ANALYSIS=false` w `.env.example` oraz jawny `ARG`/`ENV` w `Dockerfile.api`.
- Poza zakresem: deploy, staging writes, Railway, nowy silnik approval i usuwająca rollback migracja.

## Pomiar przed kodem

Samo wyszukanie słowa `estimate` nie opisywało pełnego stanu: model karty biznesowej miał wcześniej pola inwestycji, zwrotu i okresu zwrotu, ale wersjonowana karta N nie przechowywała kompletnego receipt wyceny człowieka. Kanoniczny przewód `publish -> review -> immutable version` oraz istniejące role review już istniały. Paczka rozszerza ten przewód o wycenę zamiast tworzyć równoległy lifecycle.

## Zachowanie produktu

- Publikacja przyjmuje parę `value` i `basis`, a serwer dopisuje autora i czas.
- Wersja po zatwierdzeniu kopiuje wycenę oraz pierwotnego autora/czas z wersji oczekującej.
- Karta N pokazuje wartość, podstawę, autora i czas wyceny.
- Użytkownik bez uprawnienia widzi przycisk zatwierdzenia jako wyłączony wraz z wyjaśnieniem; bezpośrednie wywołanie review zwraca `403` z kodem `INITIATIVE_REVIEW_FORBIDDEN`.
- Brak zasobu nadal daje `404`, więc odpowiedź nie ujawnia obcych danych organizacji.
- Przy fladze OFF nowe elementy UI nie są renderowane.

## Migracja

- `20262240_initiative_card_estimate.sql` dodaje cztery nullable pola do istniejącej tabeli `ie_initiative_card_versions`: `estimate_text`, `estimate_basis`, `estimated_by`, `estimated_at`.
- Check constraint wymaga pełnej czwórki albo jej całkowitego braku.
- Drugi przebieg na lokalnym PostgreSQL zakończył się powodzeniem; wszystkie cztery kolumny zostały odczytane z `information_schema`.
- Rollback jest addytywnym no-op (`SELECT 1`) i zachowuje dowód audytowy. Wycofanie produktu polega na wyłączeniu flagi; rollback nie używa `DROP`.

## Dowody

- Targeted component/API/importer tests: **42/42 PASS**.
- Real PostgreSQL persistence and ACCEPTED-version copy: **1/1 PASS**.
- Łącznie unikalny mianownik paczki: **43/43 PASS**, `--retry=0`.
- `check:artefakt`: **8 / 0 / 117 PASS**.
- `check:list-canon`: **349 PASS**.
- `check:jezyk:ci`: **PASS**, bez wzrostu długu.
- Server TypeScript: linia **22**, kandydat **22**, delta **0**; pierwsze trzy diagnostyki pozostają takie same jak na linii.
- Front TypeScript: linia **193**; kandydat przekroczył 120 s i nie wypisał diagnostyk, dlatego wynik to **TIMEOUT_120 / NOT_PROVEN**.
- `git diff --check`: **PASS**.

Dwa zrzuty pochodzą z rzeczywistego `NModeShell` i `DefinitionCardContent`, po angielsku, w jasnym motywie:

- `evidence/a1-card-estimate/a1-initiative-card-estimate-en-light.png`
- `evidence/a1-card-estimate/a1-initiative-card-estimate-en-light-action.png`

Pokazują kartę N, wycenę `40–60 h`, podstawę, autora/czas oraz widoczny wyłączony przycisk zatwierdzenia dla użytkownika bez uprawnienia. Oba pliki mają po około 54 KiB.

## Znane ograniczenia linii

Istniejące testy `initiativeCardProfiles.pg.test.ts` i ich odpowiednik gateway zakończyły się 35 czerwieniami przed logiką A-1. Przyczyną jest rozjazd historycznego fixture: lokalny klon schematu wymaga `initiative_templates.template_data`, a stare testy wstawiają wyłącznie `section_config`. Nie zmieniano tego niezależnego kontraktu w tej paczce. Pełny frontend TypeScript pozostaje nieudowodniony z powodu limitu 120 s. Paczka nie utworzyła rekordów na stagingu i nie łączyła się z bazą staging/demo.

## Commity produktu i dowodów

- `351e33cc0c` — zapis wyceny w kanonicznym review.
- `09ba929de0` — wycena i stan uprawnień w karcie N.
- `954c4d9aad` — RealPG receipt i HTTP 403.
- `ea8c4f4a7e` — addytywna zgodność read modelu.
- `a0cdbe1cf9` — wizualny receipt rzeczywistej karty N.

CTO podejmuje decyzję ACCEPT/HOLD. Ten dokument nie oznacza integracji ani wdrożenia.
