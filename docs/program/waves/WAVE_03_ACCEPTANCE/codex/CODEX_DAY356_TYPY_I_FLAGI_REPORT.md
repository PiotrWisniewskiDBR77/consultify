# CODEX DAY 356 — TYPY I FLAGI

## Werdykt

`R1–R5 ZROBIONE` na markerze `c0f690bae36a386de27f1a349fbb9674ec03c693`.
Nie jest to odbiór modułu ani produkcji. Nie uruchomiono bazy, runtime'u, Railway ani CI.

Przeczytałem i zastosowałem trzy zasady R0. Bezpiecznik istnieje dopiero z parą mutacja
RED / cofnięcie GREEN. Mutacje celowały w zabezpieczany kontrakt, a nie w składnię lub
wartość domyślną. Nie osłabiłem `ariaLabel: string`, konfiguracji TypeScript ani asercji.

## Wejście i marker

```text
c0f690bae36a386de27f1a349fbb9674ec03c693
MARKER OK
```

Worktree: `/private/tmp/cx-day356-typy-i-flagi`.
Gałąź: `codex/day356-typy-i-flagi-20260904`.
Tip gałęzi bazowej był nowszy o osiem commitów; zgodnie z instrukcją praca zaczęła się
dokładnie z markera, bez rebase. Dysk: 36 GiB wolne. Porty 6415/5555 były wolne.

## R1 — typy

Stan przed:

```text
./node_modules/.bin/tsc --noEmit -p tsconfig.json
EXIT_CODE=134, real 88.70 s, OOM

node --max-old-space-size=8192 ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
EXIT_CODE=2, error TS=92, TS2741=5
```

Stan po dopisaniu pięciu niepustych, kontekstowych etykiet:

```text
./node_modules/.bin/tsc --noEmit -p tsconfig.json
EXIT_CODE=134, real 70.22 s, OOM

node --max-old-space-size=8192 ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
EXIT_CODE=2, error TS=87, TS2741 w badanym pliku=0
```

Pierwsza propozycja etykiet, identyczna z tytułem, dała 3/6 FAIL przez zduplikowane nazwy
dostępności. Została odrzucona przed commitem. Finalne wartości „Panel narzędzi idei” i
„Panel narzędzi notatki” dały 6/6 PASS bez zmiany asercji.

Obaj żywi konsumenci przekazują `ariaLabel`: `NotebookRightRail.tsx:1042` i
`IdeaRightPanel.tsx:426` w kontekście wywołań znalezionych przy 1038/422. Brak potrzeby
nienałożonej poprawki tych plików.

Bezpiecznik `scripts/check-idea-notebook-prototype-types.mjs` analizuje jeden jawny plik,
sam uruchamia proces z limitem 8192 MB, odrzuca brak pliku/pusty pomiar jako błąd komendy
i wypisuje liczbę analizowanych plików oraz diagnostyki `plik:linia`.

### Para mutacyjna 1 — R1

```text
mutacja: usunięto ariaLabel z pierwszego wywołania
TYPE_GUARD analyzedFiles=1 heapMb=8192 diagnostics=1
...IdeaNotebookRightPanelPrototype.test.tsx:16:35 TS2741 ...
EXIT_CODE=1

cofnięcie przez cp:
TYPE_GUARD analyzedFiles=1 heapMb=8192 diagnostics=0
EXIT_CODE=0
```

## R2 — H1 i dostęp statyczny Vite

**H1 potwierdzona.** Po mutacji statyczny → obliczony cały `tests/unit/flags/` pozostał
zielony: `numTotalTests=28`, `numPassedTests=28`, `numFailedTests=0`.

Wybrano skan źródeł z jawną listą trzech naprawionych flag. Jest szybki, deterministyczny
i bez sieci. Odrzucono skan gotowego bundle jako kosztowniejszy, gdy ten konkretny kontrakt
można jednoznacznie sprawdzić statycznie. Test strażnika osobno pokrywa obie formy:
`meta.env?.[K]` i `meta?.env?.[K]` (3/3 PASS).

### Para mutacyjna 2 — R2

```text
mutacja: statyczny dostęp flagi panelu cofnięty do meta?.env?.[ENV_KEY]
src/utils/ideaNotebookRightPanelPrototypeFlag.ts:27 computed import.meta.env access is forbidden
STATIC_FLAG_GUARD analyzedFiles=3 violations=2
EXIT_CODE=1

cofnięcie przez cp:
STATIC_FLAG_GUARD analyzedFiles=3 violations=0
EXIT_CODE=0
git diff flagi: pusty
```

Pełny `tests/unit/flags/` po pracy: 28/28 PASS. Porównanie 28 pełnych nazw przed i po jest
puste; żadna nazwa nie zniknęła ani nie została dodana w tym katalogu.

## R3 — oba defekty jednocześnie

### Para mutacyjna 3 — stan zastany typów

```text
TYPE_GUARD analyzedFiles=1 heapMb=8192 diagnostics=5
wiersze 16, 22, 29, 36, 44 — TS2741
EXIT_CODE=1

po przywróceniu: diagnostics=0, EXIT_CODE=0
```

### Para mutacyjna 4 — stan zastany flagi

```text
STATIC_FLAG_GUARD analyzedFiles=3 violations=2
plik flagi:27 dostęp obliczony; brak wymaganego wyrażenia statycznego
EXIT_CODE=1

po przywróceniu: violations=0, EXIT_CODE=0
```

SHA-256 surowych dowodów:

- `r3-zastany-type-red.txt`: `55b0d9f84b8f1cd34e0e2c1b004e821a60d791e820f84f6dec20c8101a1ecf44`
- `r3-zastany-flag-red.txt`: `1e7827dcc9cd622f03b719987626a3874cb056f91b4d08550ec6d6de53d56d31`
- `r3-naprawiony-type-green.txt`: `3a65352c5125c294d41779b249176812047f8c19534c8c09ad05bd42afc0c0aa`
- `r3-naprawiony-flag-green.txt`: `0aea2957343c7d70523e63e2f2583ca3ada728e959a383c3cf1df4f620835f22`

## R4 — pełny inwentarz

Wzorzec: `meta\??\.env\??\.?\[`; wynik: 109 unikalnych plików. Klasyfikację wykonano
pełnym `node scripts/dev/reachability-from-root.mjs`, nie metodą per-plik i nie na próbce.

- `ŻYWY` (`classification=app`): 105
- `MARTWY` (`classification=unreachable`): 2
- `NIEORZECZONY` (`test-only` lub `harness-only`): 2
- **żywe ∧ obliczone: 105**

TSV ma 112 wierszy danych dla 109 plików, bo pojedynczy helper
`artifactStudioFlags.ts` przyjmuje cztery jawne klucze VITE i został rozpisany na cztery
wiersze zamiast wpisania fałszywej nazwy `key`. Nie zmieniono żadnego pliku tej rodziny.
Wzór przyszłej poprawki: `evidence/day356/wzorcowy-diff-nienalozony.patch`.

## Pułapki §0.2e i zakres dowodu

- Pełny `tsc`: dotyczy pułapka (e); wyłączona przez jawne 8192 MB. Kod 2 oznacza zastany
  dług 87 błędów, nie błąd bezpiecznika punktowego. Przebieg domyślny 134 dowodzi OOM.
- Test punktowego strażnika typów i test UI: (a)–(d) nie leżą na ścieżce; to frontowe testy
  jednostkowe z `RUN_DB_TESTS=0 MOCK_DB=true`. Pułapkę (e) wyłącza sam strażnik.
- `tests/unit/flags/` i test strażnika flag: (a)–(e) nie dotyczą egzekucji DB/auth; uruchomiono
  `RUN_DB_TESTS=0 MOCK_DB=true --retry=0`. JSON potwierdza realnie odkryte 28 przypadków.
- Reachability: statyczna analiza grafu importów, bez DB/auth/runtime; pułapki (a)–(e) nie
  leżą na ścieżce. `--check-baseline` przed zmianami zwrócił 0.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Nie uruchomiłem bazy,
`server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie
kalendarzowe nie zostało wysłane.

## Warunki wspólne i korekty wobec instrukcji

- Słowniki przed: PL 35199 / EN 33066, nie 35198 / 33065 z instrukcji. To pomiar markera;
  dyżur słowników nie zmienił.
- `focus-canon=0`, `list-canon=0`, `artefakt=0`, `reach=0` przed zmianami.
- Liczby rodziny 109 / 122 / 136 potwierdzone.
- TSC przed/po: 92 → 87; brak wzrostu.
- Domyślna sterta OOM po 88.70 s przed i 70.22 s po, a nie około 73 s w obu przebiegach.

## Commity i statystyki

```text
1119cf2831 test(day356): guard prototype call-site types
beb181c79c test(day356): reject computed Vite flag access
59e38825f5 test(day356): prove both guards against inherited defects
80d22d598f docs(day356): inventory computed Vite flag family
```

Każdy commit został pokazany przez `git show --stat` i wypchnięty na `github-backup` po
pozycji R. Commit R5 zostanie dopisany przez historię gałęzi.

## CO NADAL WYMAGA OSOBNEGO ZLECENIA

Naprawa 105 żywych plików z dostępem obliczonym wymaga osobnego, podzielonego zlecenia.
Inwentarz obejmuje wiele niezależnych rodzin flag i jeden helper wielokluczowy; nie należy
robić mechanicznej zamiany bez sprawdzenia kluczy oraz wartości domyślnych. Wzór dla prostego
przypadku jest w nienałożonym diffie. Dwa pliki `NIEORZECZONY` wymagają decyzji, czy
harness/test-only zaliczać do długu produkcyjnego.

## PYTANIA DO WŁAŚCICIELA

1. Czy oba nowe bezpieczniki mają zostać podłączone do CI jako bramki blokujące — tak/nie?
2. Czy dwa pliki `test-only` / `harness-only` mają wejść do przyszłego zlecenia naprawy
   razem ze 105 plikami aplikacji — tak/nie?

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano zachowania gotowego bundle przeglądarkowego; wybrano strażnik źródeł.
- Nie zweryfikowano żadnej z 105 pozostałych flag w runtime ani wizualnie.
- Nie uruchomiono CI; podłączenie jest świadomie pozostawione do decyzji właściciela.
- Nie udowodniono, że `test-only` i `harness-only` są martwe produktowo; zachowano
  `NIEORZECZONY`.
