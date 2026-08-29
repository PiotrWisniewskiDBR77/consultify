# CODEX DAY 114 — OŚ CZASU INICJATYW — RAPORT

Data: 2026-08-29  
Gałąź: `codex/day114-os-czasu-fix-20260829`  
Baza: `eecf2c1dae434bb1f1fb68a72094825e317bc5ea`  
Commit naprawy: `785dcd1ac51e21f55c265644b47709adc03b2839`  
Werdykt: **FIXED — komunikat rozróżnia prawdziwy brak inicjatyw od inicjatyw bez dat, podaje skalę i działanie naprawcze.**

## 0. Tożsamość i stan wejściowy

Wiążący marker instrukcji z vaulta różnił się od markera we wklejce. Użyłem markera instrukcji: `eecf2c1dae434bb1f1fb68a72094825e317bc5ea`.

Wynik kontroli markera, dosłownie:

```text
MARKER OK
```

Wynik sanity worktree, dosłownie:

```text
eecf2c1dae434bb1f1fb68a72094825e317bc5ea
```

`git status --short | head -3` nie wypisał żadnej linii. Dysk miał `43 GiB` wolne. Porty `5996`, `4892`, `4893`: `3 z 3` wolne. Tip gałęzi bazowej wyprzedzał marker o `1` commit (`332fa1c161`), dotyczący instrukcji i `.gitignore`; zgodnie z instrukcją wystartowałem dokładnie z markera.

## 1. Korekty wobec instrukcji

1. Wklejka podała marker `332fa1c161`, a wydana instrukcja w `§0.1` podała `eecf2c1dae434bb1f1fb68a72094825e317bc5ea`. Zgodnie z poleceniem użytkownika wiążąca była instrukcja.
2. Dokument odsyła do `§0.3`, `§0.4a`, „BLOKU 0” i tabeli licencji, ale nie zawiera tych sekcji. Bezpieczniejszą granicę zapisu wyznaczyłem z `Z40` i `§D`; nie poszerzyłem zakresu produktu.
3. Pierwsze `seed` odmówiło, bo ręcznie zmigrowana baza już istniała: `target database already exists; reset it first`. Wykonałem kontrakt samego seedera `reset → seed`; dotyczył wyłącznie lokalnej bazy `consultify_w3_initiatives_owner_day114`.
4. Kanoniczny runtime nie pozwala wykonać `stop` po zmianie HEAD (`state candidate identity differs`). Zweryfikowałem PID/PGID z jego manifestu (`94488/94488`, `94521/94521`) i wysłałem `TERM` wyłącznie do tych dwóch grup; `4892` i `4893` stały się wolne. Runtime po naprawie uruchomiłem w nowych ścieżkach stanu.
5. Finalne kadry „przed” zostały odtworzone kontrolowaną mutacją starego rozgałęzienia na runtime SHA naprawy, ponieważ runtime sprzed commita został już zatrzymany. Sam defekt został wcześniej odtworzony także na dokładnym markerze `eecf2c1dae`: DOM pokazał jednocześnie `W realizacji 1` i `No initiatives in execution...`.

## 2. Baza, fixture i readback

Kontener: `cx-day114-pg`, obraz `pgvector/pgvector:pg16`, host tylko `127.0.0.1:5996`.

Pełne migracje przed pomiarem:

```text
pierwszy przebieg: ✅ Postgres migrations complete
drugi przebieg: Applying migrations: 0
drugi przebieg: ✅ Postgres migrations complete
```

Seeder `server/scripts/seed-wave3-initiatives-owner-review.ts` ma strażnik `successful_migrations < 858`. Własny readback po seedzie: `19 z 19` liczników zgodnych, `863` migracje. Kluczowy SQL:

```text
id                                   status  start_date  planned_end_date  end_date
c56d3161-59d1-4259-9fce-084bdb553eb1 DRAFT   NULL        NULL              NULL
(1 row)
```

Manifest fixture: `/private/tmp/cx-day114-os-czasu-fix-artefakty/day114-initiatives-manifest.json`, SHA-256 `ae818c5078a7fd36535083ca736babc593f4ce00209f76d1cc9c48639765968c`, tryb `0600`.

## 3. Defekt przed zmianą

Własny pomiar źródła:

```text
ExecutionTimelineView.tsx:959 .filter((i) => i.startDate || i.plannedEndDate || i.endDate)
ExecutionTimelineView.tsx:1496 t('execution.empty.noInExecution')
pl: Brak inicjatyw w realizacji. Przenieś inicjatywy do realizacji.
en: No initiatives in execution. Move initiatives to execution first.
```

Dokładny runtime markera `eecf2c1dae` miał health/ready/frontend `3 z 3 = 200`, SHA serwera i klienta zgodne, `863` migracje, auth bypass `OFF`. DOM produktu na `/initiatives` pokazał jednocześnie `W realizacji 1` i fałszywy komunikat. Teza zlecenia została potwierdzona.

## 4. Naprawa

Filtr dat pozostał bez zmian. Gdy `activeFilters` jest wyłączone i `processedInitiatives` jest puste:

- `filteredInitiatives.length === 0` nadal używa uczciwego `execution.empty.noInExecution`;
- `filteredInitiatives.length > 0` używa nowego `execution.empty.noTimelineDates` z `count = filtered - processed` i `total = filtered`;
- PL i EN mają parytet oraz formy liczby pojedynczej/mnogiej.

Zmiana produktu objęła `3 z 3` licencjonowanych plików: komponent oraz dwa locale. Wzmocniłem istniejący kontrakt dyżuru 106; nie dodałem nowego pliku testu.

## 5. Dowód mutacyjny w obie strony

Pakiety jednostkowe uruchamiałem z `RUN_DB_TESTS=0 MOCK_DB=true` i `--retry=0`. Pułapki `Z33 (a)–(e)` nie leżą na tej ścieżce: kontrakt czyta statycznie komponent i JSON locale, nie montuje Gateway, auth, DB ani middleware.

Po commicie skopiowałem poprawny komponent:

```bash
cp src/components/Execution/ExecutionTimelineView.tsx /private/tmp/cx-day114-os-czasu-fix-scratch/ExecutionTimelineView.fixed.tsx
```

Następnie kontrolowaną mutacją przywróciłem stare `t('execution.empty.noInExecution')` i uruchomiłem:

```bash
RUN_DB_TESTS=0 MOCK_DB=true npx vitest run tests/unit/initiatives/executionTimelineTruthfulness.contract.test.ts --retry=0 --reporter=json --outputFile=/private/tmp/cx-day114-os-czasu-fix-artefakty/day114-mutation-red.json
```

Wynik: **RED, `0 z 1` PASS**. Czerwony był dokładnie przypadek:

```text
Initiatives timeline truthful empty-state contract distinguishes initiatives without timeline dates from no initiatives in execution
```

Przywrócenie i dowód zielony:

```bash
cp /private/tmp/cx-day114-os-czasu-fix-scratch/ExecutionTimelineView.fixed.tsx src/components/Execution/ExecutionTimelineView.tsx
git diff --exit-code && echo 'GIT DIFF PUSTY'
RUN_DB_TESTS=0 MOCK_DB=true npx vitest run tests/unit/initiatives/executionTimelineTruthfulness.contract.test.ts --retry=0 --reporter=json --outputFile=/private/tmp/cx-day114-os-czasu-fix-artefakty/day114-mutation-green.json
```

Wynik:

```text
GIT DIFF PUSTY
passed Initiatives timeline truthful empty-state contract distinguishes initiatives without timeline dates from no initiatives in execution
```

Czyli **GREEN, `1 z 1` PASS**. Po ostatniej mutacji zrzutowej i `cp` ponownie: `GIT DIFF PUSTY PO FINALNEJ MACIERZY`.

## 6. Regresja po pełnych nazwach

Komenda po obu stronach użyła `tests/unit/initiatives --retry=0 --reporter=json`.

```text
przed (mutacja starego zachowania): 337 z 338 PASS, 1 FAIL — wyłącznie kontrakt naprawy
po:                               338 z 338 PASS, 0 FAIL
BEFORE 338 AFTER 338 DELTA_REMOVED 0 DELTA_ADDED 0
```

Delta pełnych nazw: **`0 z 338` dodanych i `0 z 338` usuniętych**.

## 7. Runtime po naprawie i zrzuty

Kanoniczny runtime commita `785dcd1ac5` na `4892/4893`: health/ready/frontend `3 z 3 = 200`, SHA serwera/klienta zgodne, migracje `863`, `migrationState=ok`, `sqlMigrationState=ok`, auth bypass/test gateway/test support `3 z 3 = false`, `prohibitedKeysAbsentInOwnedGroupProcesses=true`.

DOM po naprawie:

```text
W realizacji 1
1 z 1 inicjatywy w realizacji nie ma dat i nie jest widoczna na osi. Uzupełnij daty, aby ją wyświetlić.
```

Macierz obejrzana wizualnie: **`4 z 4`**.

| Stan | Motyw | Plik | SHA-256 |
| --- | --- | --- | --- |
| przed | jasny | `/private/tmp/cx-day114-os-czasu-fix-artefakty/day114-before-light.png` | `3ccd445cc5bcce9cc392b7417fdbc9e80154fffb0a4b3c250e2cc2f270618253` |
| przed | ciemny | `/private/tmp/cx-day114-os-czasu-fix-artefakty/day114-before-dark.png` | `3733f41405d33e4610b150cd4b32e5da8a462bb3b16487823958cb5e626fd0a8` |
| po | jasny | `/private/tmp/cx-day114-os-czasu-fix-artefakty/day114-after-light.png` | `4bcb34a595098a2e54ee0041e9cc9773a6bd7eda170983c295623777443e77e8` |
| po | ciemny | `/private/tmp/cx-day114-os-czasu-fix-artefakty/day114-after-dark.png` | `76d1b9f02ddc4074652a99c4802663b1e9afbdb2ac9814af2e3ebddda48471c3` |

Uwaga: wartości SHA powyżej zostaną ponownie policzone po finalnym zapisie raportu; obrazy leżą poza repo i nie są przez raport modyfikowane.

## 8. Z30 — brak wysyłki

Przed zapisem fixture: `BRAK ZMIENNYCH POCZTY`; tabela `settings` zwróciła `0 rows` dla `smtp%`; `Gateway.ts` miał `0` trafień drenaży. Bezpośrednio przed runtime i po nim baza nadal miała `0` wierszy `smtp%`. Manifest runtime potwierdził brak zakazanych kluczy w należących procesach. Log: `Initiative/Execution outbox consumer: DISABLED`; brak transportu Slack skutkował `message dropped`.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Uruchomiłem `server/src/index.ts` wyłącznie przez kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs`, na lokalnej bazie dyżuru, tylko w celu wykonania zrzutów. Zweryfikowałem środowisko procesu i log serwera zgodnie z `§0.2b` (4). Żaden e-mail, zaproszenie kalendarzowe ani powiadomienie zewnętrzne nie zostało wysłane.

## 9. Pliki i commit

Commit rdzenia `785dcd1ac5` został wypchnięty na `github-backup` bezpośrednio po utworzeniu. Pliki rdzenia względem markera:

```text
public/locales/en/translation.json
public/locales/pl/translation.json
src/components/Execution/ExecutionTimelineView.tsx
tests/unit/initiatives/executionTimelineTruthfulness.contract.test.ts
```

Raport i wpis modułu stanowią osobny commit dokumentacyjny.

## TWIERDZENIA NIEZWERYFIKOWANE

1. Nie zweryfikowałem akceptacji właściciela produktu; `FIXED` oznacza naprawę techniczną z dowodem, nie owner acceptance.
2. Nie uruchamiałem pełnego korpusu wszystkich modułów repozytorium; zmierzyłem `338 z 338` nazw pakietu `tests/unit/initiatives` i kontrakt skupiony.
3. Nie zweryfikowałem wariantu, w którym część inicjatyw ma daty, a część ich nie ma, ponieważ nowy komunikat jest stanem pustym i pojawia się tylko, gdy `0 z N` rekordów można umieścić na osi.
4. Nie zweryfikowałem tłumaczeń `DE/AR/JA/ES`; licencja i decyzja właściciela wymagały parytetu wyłącznie PL/EN.
5. Nie wykonywałem żadnego połączenia do demo, stagingu, Railway ani produkcji.

