# Raport dyżuru 309 — testy puste

Stan: **CZĘŚCIOWE**. R1/R2/R5/R6 wykonano. R3 nie ma wymaganych 20 mutacji funkcji produkcyjnych, dlatego żaden blok nie otrzymał klasy `PUSTY`; R4 nie został wykonany. To ograniczenie jest częścią wyniku, nie domniemanym PASS.

## Wejście

- Worktree: `/private/tmp/cx-day309-testy-puste`.
- Gałąź: `codex/day309-testy-puste-inwentarz-20260903`.
- Marker: `416432abafe31a390a909cf7e460a4bad7bef191`.
- PostgreSQL: wyłącznie lokalny `cx-day309-pg`, `127.0.0.1:6316/cx309`, `pgvector/pgvector:pg16`; migracje strict przeszły na pustej bazie.
- Porty 5296/5297/6316 były wolne; dysk miał 23 GiB wolnego.

Dosłowny marker i sanity:

```text
MARKER OK
[core]
        bare = false
416432abafe31a390a909cf7e460a4bad7bef191
```

`git status --short | head -3` był pusty. Start nastąpił dokładnie z markera; nie wykonano rebase ani pushu.

## Z30

Środowisko: `BRAK ZMIENNYCH POCZTY`; lokalna tabela `settings` dla `smtp%`: 0 wierszy; `Gateway.ts` nie uruchamia drainera. **Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.**

## Pomiary wejściowe

- Pliki `*.test.ts|tsx|mts`: 5383 — zgodne z tezą.
- `toBeDefined()`: 1902 w 699 plikach — zgodne z tezą.
- Ścisły kształt `expect(res|response|r.ok).toBe(true)`: 50 — zgodne z tezą.
- `global.fetch = vi.fn` zaczyna się w `tests/setup.ts:896`; atrapa zwraca `ok:true`, `status:200`, `{data:[]}`.
- Bieżący `Database.ts` nie melduje już `changes:1` dla każdego zapisu: używa wyniku `applyInsert/applyUpdate/applyDelete`, a zero zmian zwraca 0. Teza instrukcji jest nieaktualna.
- `_DB_PREFIX`: szeroki grep znalazł 50 plików, natomiast w mianowniku testów skaner znalazł 37. Nie przepisano liczby 43 z DEC jako bieżącego faktu.
- `playwright.config.ts:84` ma obecnie `retries: 0`, nie `CI ? 2 : 0`; opisany wektor E2E został już zamknięty na markerze.
- Raport 286 przeczytano jako źródło metody: nie zawiera listy PUSTYCH testów i sam mówi, że nie był audytem całego repo.

## R1/R2 — skaner i klasyfikacja

`scripts/dev/testy-puste-skan.mjs` parsuje TypeScript AST wszystkich 5383 plików. Rozpoznał 42 413 bloków `it/test`, pominął 0 plików i znalazł 21 bloków, których wszystkie asercje należą do ścisłego słabego zbioru oraz których ciało ma sygnał sieci/bazy.

Klasy: `SŁABY=20`, `UZASADNIONY=1`, `PUSTY=0`. Każdy kandydat jest nazwany w `REJESTR_TESTY_PUSTE_20260903.md`. `PUSTY=0` nie oznacza, że pustych testów nie ma; oznacza, że nie wykonano celowanej mutacji produktu wymaganej do tej klasy.

Skaner jest konserwatywny i ma znane false-negative: dopasowuje tylko literalne `expect` w pojedynczym bloku i ścisły słownik matcherów; helpery, aliasy i asercje rozproszone pozostają `NIEZWERYFIKOWANE`.

## R3 — dowód mutacyjny

Wymóg minimum 20 mutacji funkcji produkcyjnych nie został wykonany. Nie wolno było na tej podstawie nadać żadnemu z 21 kandydatów klasy `PUSTY`. Rejestr pozostawia 20 jako `SŁABY`, a 1 jako `UZASADNIONY` smoke.

Nie zamieniono mutacji skanera/atrapy na dowód produktu: byłoby to obejściem wymogu „skasuj ciało funkcji produkcyjnej”. R3 ma stan NIEZROBIONE.

## R4 — wzmocnienie

Nie zmieniono 21 testów. Instrukcja jednocześnie pozwala `test.todo` z powodem (R4) i zakazuje `.todo` (Z35). Wybrano bezpieczniejsze „nie osłabiaj/nie kasuj”: kandydaci pozostają jawnie w rejestrze do weryfikacji. R4 ma stan NIEZROBIONE.

## R5 — bezpiecznik i pięć twierdzeń

`tests/unit/config/noEmptyAssertions.test.ts` uruchamia ten sam skaner i blokuje wzrost ponad baseline 21, zmianę mianownika bez aktualizacji oraz pominięcia parsera.

Dowód mutacyjny bezpiecznika z `--retry=0`:

```text
GREEN: baseline 21
mutacja: nowy test z fetch + jedyną expect(response.ok).toBe(true)
RED: MUTATION_EXIT=1
przywrócenie przez usunięcie wyłącznie pliku mutacji
GREEN: 1/1
```

Pakiet bezpiecznika retry wraz z istniejącym `vitestNoRetry.contract`: 5/5 PASS. Pełne nazwy są w `guards-final.json`.

Cztery pliki obejmujące pięć dawniej fałszywych twierdzeń DEC-2026-08-28-186 uruchomiono razem z `--retry=0`: 35/35 PASS. Na markerze zielone są obecnie: clone-on-write, Admin Sessions bulk revoke, dwa przypadki DLP i create Security Incident. Bez nowej mutacji produktu jest to stan bieżący testów, nie niezależny dowód naprawy.

## Pułapki dowodowe

- Pakiety są jednostkowe (`RUN_DB_TESTS=0 MOCK_DB=true`), więc nie dowodzą realnego HTTP/PG; służą wyłącznie analizie kształtu asercji i widoków.
- Każdy przebieg miał `--retry=0`; `vitestNoRetry.contract` potwierdził brak retry globalnego.
- Wyniki odczytano z JSON po pełnych nazwach, nie z samego exit code.
- Skaner nie nazywa kandydata `PUSTY` bez mutacji, więc atrapa `fetch` nie staje się automatycznie werdyktem.
- Nie uruchomiono E2E ani CI; `playwright.config.ts` tylko odczytano statycznie.

## Korekty wobec instrukcji

1. Teza `Database.ts:686 changes:1 dla każdego UPDATE` jest obalona przez kod na markerze: `changes` zależy od trzech funkcji apply i może wynieść 0.
2. Teza `playwright.config.ts:80 retries: CI?2:0` jest obalona: bieżąca linia 84 ma `retries: 0`.
3. Rodzina DB-prefix ma 50 plików w szerokim grep i 37 w mianowniku skanera, nie 43. Bez analizy 29 nazw zmiennych we wszystkich workflow nie ogłoszono „nigdy nie biegną” jako dowodu.
4. Instrukcja odwołuje się do nieobecnej tabeli licencji oraz zawiera niewykonalny placeholder `npx vitest run testy: ...`; użyto wyłącznie imiennie dozwolonych plików z Z12/Z13 i konkretnych komend.
5. R4 zezwala na `test.todo`, podczas gdy Z35 go zakazuje. Nie dodano `.todo` ani nie osłabiono testów.
6. Z34a wymaga pushu, lecz nadrzędny łańcuch go zakazuje. Nie wykonano pushu.

## Commity

1. `2b032e28c4` — R1 skaner.
2. `f2d5d01310` — R2 rejestr klasyfikacji.
3. `351cc7f352` — R5 bezpiecznik i wyniki.

Końcowy raport/rejestr jest osobnym commitem R6. Brak commitów R3/R4 odzwierciedla brak wykonania, nie pominięcie w raporcie.

## Artefakty

- `five-security-claims.json`: `62b347c0e7163455d35010affabd2c6172f348c66c06711c91cad509f80c2b5c`
- `guards-final.json`: `80db7848d5c8dc0f8112ed7d8087fc09ef3b6a897205e38466df2de891e1129e`
- `no-empty-green.json`: `714bce3f1a46a57e01a3a66fa1a5679e1c02b2a19d01c580f784cca798477b94`
- `no-empty-mutation-red.json`: `7204a56fd952203f93d8371a0e7b5d0e9e05fab7700655ac9eee795489768aec`
- `no-empty-restored-green.json`: `166f698fbc909be201a5f38578e7cc1fcfed22e241a262717ef42be3c217e693`

TWIERDZENIA NIEZWERYFIKOWANE: istnienie bloków PUSTYCH poza ścisłym skanerem; wszystkie 21 kandydatów wobec mutacji produktu; wszystkie 37/50 plików DB-prefix wobec realnych workflow; zachowanie E2E/CI; zachowanie demo/staging/produkcji (nie dotykano).
