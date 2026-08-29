# CODEX — DYŻUR 105 — SPOTKANIA — DECYZJA

Stan roboczy: pomiar w toku. Naprawa komponentu jest poza licencją i nie będzie wprowadzana.

## 0. Tożsamość i stan wejściowy

- Dokument: `WYDANY`, odczytany w całości: `701 z 701` linii.
- Marker publikacji podany w zleceniu: `74a1d733e9` = `docs(day105-108): trzecia partia — decyzja Spotkan, os czasu, karta Insight, jezyk`.
- Marker bazy z wydanej instrukcji: `5b29e4ec1b2f6180f4006be1f06ca1ebe3597f02`.
- Gałąź: `codex/day105-spotkania-decyzja-20260829`.
- Worktree: `/private/tmp/cx-day105-spotkania-decyzja`.
- Zasoby wyłączne: PostgreSQL `5986`; runtime `4870/4871`.
- Wolne miejsce: `60 GiB` (`60 GiB >= 5 GiB`).
- Porty przed startem: `5986 WOLNY`, `4870 WOLNY`, `4871 WOLNY` (`3 z 3`).

### Wynik markera — dosłownie

```text
74a1d733e9 docs(day105-108): trzecia partia — decyzja Spotkan, os czasu, karta Insight, jezyk
5b29e4ec1b docs(ledger): DEC-335..336 — warunki 1 i 2 stagingu zamkniete, zastrzezenie dev-render
86af83c7a6 fix(flags): orgRedesignV1 fail-CLOSED i domyslnie OFF do czasu odbioru wizualnego
2fdbecfaf4 merge: dyzur day102 — day102-wycena-500
6010daac4f merge: dyzur day101 — day101-spotkania-odbior
51f42bf613 merge: dyzur day100 — day100-mojapraca-odbior
0d331e2599 merge: dyzur day98 — day98-notatnik-spec-a
b7ce79bb08 docs(day101): record owned runtime cleanup evidence
05f7f7096b docs(day98): bind corrected clean dark screenshot
a25cedb828 docs(day100): record owned runtime cleanup
ebc0cc38c4 docs(day102): record owned database cleanup
dacdc89027 docs(day101): record Meetings owner visual acceptance
c9a94c0457 docs(day100): record My Work owner review packet
63192bd3b0 test(finance): diagnose valuation gateway 500
e9814fd34e feat(notebook): adopt SPEC-A shell behind default-off flag
a20e3304e2 merge: odblokowanie seedera Narzedzi — bootstrap wlasciciela + organization_members
9f72faab38 merge: dyzur 99 — kreatory 53 z 53, DoD od 3/16 do 9/16
467dada60d fix(wave3-tools-seed): add organization_members row for the fixture owner
57a396a146 docs(ledger): DEC-333..334 — SPEC-A zmierzone wzrokiem, powloka OK, tresc karty pusta
7f389636ed merge: dyzur 95 — DoD 6/16, 5/16, 3/16; dokument twierdzil 'niemal gotowe'
45cf12f7de docs(day99): record owned runtime cleanup
3afc15dc51 docs(day98,100,101,102): druga partia — Notatnik, Moja Praca, Spotkania, wycena 500
146e6f7caf merge: dyzur 97 — zasadny STOP, wykonal poprawke nadzorcy, uniewaznil wlasne robocze oceny
e87cb11fa4 merge: dyzur 96 — zasadny STOP, 0 z 12 zrzutow, wykryl zamek seedera
32f896d041 docs(day99): record creator visual acceptance evidence
MARKER OK
```

### Wynik sanity worktree — dosłownie

```text
5b29e4ec1b2f6180f4006be1f06ca1ebe3597f02
```

`git status --short | head -3` nie zwrócił żadnej linii (`0 z 3` możliwych linii), czyli worktree był czysty.

### Rozejście marker–tip

`1 z 1` commitów ponad marker jest wyłącznie dokumentacyjny:

```text
74a1d733e9 docs(day105-108): trzecia partia — decyzja Spotkan, os czasu, karta Insight, jezyk
```

Dotyczy `4 z 4` instrukcji dni 105–108; scalenie pozostaje po stronie nadzorcy.

## 1. Kontrakt seedera — 4 z 4 przed kontenerem

1. Seeder: `scripts/dev/seed-wave3-meetings-owner-review.mjs` (`plik:1-15`).
2. Baza powstaje w `provision(url, dbName)` przez `CREATE DATABASE` (`plik:60-63`), pod komendą CLI `provision` wybieraną w `main()` (`plik:145`). W tym dyżurze kontener otrzymuje bazę już przez `POSTGRES_DB`, więc nie wywołuję `provision`; pełny runner migracji wykonuję zgodnie z §0.2c(A).
3. W ścieżce `provision` migracje wykonuje `server/scripts/migrate.postgres.ts` przez `spawnSync` (`plik:62`). W ścieżce dyżuru ten sam runner uruchamiam jawnie dwa razy z kompletem env.
4. Seeder **zakłada** właściciela i członkostwo: `INSERT INTO users` oraz `INSERT INTO organization_members` (`plik:105-123`, dokładne inserty `:111`). Nie ma pułapki zamka SELECT-only.

Strażnik nazwy bazy: prefiks `consultify_w3_meetings_owner_` (`plik:29`) i walidacja loopback/nazwy (`plik:50-57`); `consultify_w3_meetings_owner_day105` pasuje `1 z 1`.

## 2. Z30 — protokół przed pierwszym zapisem

Dowód (a), środowisko powłoki:

```text
BRAK ZMIENNYCH POCZTY
```

Dowód (c), `grep -n "startNotificationOutboxDrainCron\|outboxWorker\|platformOutboxDrainCron" server/src/Gateway.ts`: `0` trafień.

Dowód (b) z lokalnej bazy zostanie dopisany po pełnych migracjach, a przed seedem i startem runtime. Do tego czasu nie uruchamiam seedera ani runtime.

## Korekty wobec instrukcji

- Wiadomość zlecająca nazywa `74a1d733e9` markerem, natomiast §0.1 wydanej instrukcji nazywa markerem bazy `5b29e4ec…`. Historia rozstrzyga role bez improwizacji: `74a1d733e9` publikuje instrukcje, a `5b29e4ec…` jest jego bezpośrednim przodkiem i bazą kodu. Worktree utworzono dokładnie z `5b29e4ec…`.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano jeszcze przyczyny utraty decyzji od bazy do piksela; pomiary B.1–B.3 są w toku.
- Nie zweryfikowano jeszcze, czy lokalna baza po pełnych migracjach ma tabelę `settings` i `0` wierszy `smtp%`.
- Nie zweryfikowano jeszcze żadnego twierdzenia o działaniu realnej trasy HTTP ani kanonicznego runtime.

