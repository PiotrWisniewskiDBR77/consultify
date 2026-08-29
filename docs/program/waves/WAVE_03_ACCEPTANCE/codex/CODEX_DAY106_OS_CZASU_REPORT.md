# CODEX DAY 106 — Inicjatywy: prawdziwość osi czasu

Data: 2026-08-29
Gałąź: `codex/day106-os-czasu-20260829`
Baza produktu: `5b29e4ec1b2f6180f4006be1f06ca1ebe3597f02`
Marker wydania instrukcji podany przez nadzorcę: `74a1d733e9`
Werdykt: **DEFECT REPRODUCED / ROOT CAUSE PROVEN / NOT FIXED — DO DECYZJI WŁAŚCICIELA**

## Wynik w jednym zdaniu

Na realnym lokalnym runtime, realnym PostgreSQL i z wyłączonym auth bypass odtworzyłem ekran, na którym chip pokazuje `W realizacji 1`, a ta sama oś czasu mówi `No initiatives in execution. Move initiatives to execution first.`; konkretny rekord jest w `IN_EXECUTION`, ale wypada wyłącznie na filtrze braku dat.

## §0 — baza, marker i rozbieżność instrukcji

Wynik §0.1 (2), dosłownie:

```text
74a1d733e9 docs(day105-108): trzecia partia — decyzja Spotkan, os czasu, karta Insight, jezyk
5b29e4ec1b docs(ledger): DEC-335..336 — warunki 1 i 2 stagingu zamkniete, zastrzezenie dev-render
[23 wcześniejsze pozycje logu]
MARKER OK
```

Wynik §0.1 (7), dosłownie:

```text
5b29e4ec1b2f6180f4006be1f06ca1ebe3597f02
```

Tip uciekł o jeden commit. `git log 5b29e4e..github-backup/codex/m03-admin-20260824` zwrócił `74a1d733e9`; diff obejmuje wyłącznie instrukcje dyżurów 105–108. Zgodnie z §0.1 pracowałem dokładnie z markera produktu `5b29e4e`, bez rebase.

### Korekty wobec instrukcji

1. Zlecenie wejściowe podaje `Marker: 74a1d733e9`, a §0.1 instrukcji podaje `MARKER=5b29e4ec...`. Bezpieczna interpretacja: `74a1d733e9` jest commitem wydającym instrukcję, a `5b29e4ec...` jest bazą produktu. Dowód: między nimi jest dokładnie jeden commit, który zmienia tylko cztery instrukcje. Nie zmieniłem bazy produktu.
2. §0.2c(A) pokazuje kontener z już istniejącą bazą `consultify_w3_initiatives_owner_day106`, natomiast seeder w `server/scripts/seed-wave3-initiatives-owner-review.ts:810-818` wymaga nieistniejącej bazy, tworzy ją i sam uruchamia `db:migrate:strict`. Uruchomiłem kontener tylko z administracyjną bazą `postgres`, a bazę dyżuru stworzył i zmigrował kanoniczny seeder. Dwa kolejne przebiegi migracji: `Applying migrations: 0`, oba zielone.
3. W wydanej instrukcji nie istnieją §0.3, §0.4 ani §0.4a, choć odwołują się do nich Z24 i tabela STOP. Nie zgadywałem brakującej tabeli licencji; zastosowałem jawny §D, który pozwala zapisać raport, `MODULE_ACCEPTANCE.md` i najwyżej jeden nowy test.

## K1 — kontrakt seedera: 4 z 4

| Pytanie | Wynik i dowód |
| --- | --- |
| Gdzie leży seeder | `server/scripts/seed-wave3-initiatives-owner-review.ts` |
| Gdzie i pod jaką komendą powstaje baza | `seed()` przy komendzie `seed`; sprawdzenie istnienia i `CREATE DATABASE` w `:803-815` |
| Kto robi migracje | Seeder uruchamia `npm run db:migrate:strict` w `:817-822` |
| Czy zakłada właściciela | Tak; `INSERT INTO users` i `INSERT INTO organization_members` w `:257-263` — brak pułapki zamka |

Seeder/readback: persony `6/6`, kandydaci `2/2`, zaakceptowany `1/1`, inicjatywa `1/1`, link Execution `1/1`, relacja `1/1`, pełny read model `1/1`, negatywne receipts `0/0`, migracje `863/863`. Manifest: `/private/tmp/cx-day106-os-czasu-artefakty/day106-owner-manifest.json`, SHA-256 `cd3cff0b9dc61fd2c5540e7ab34687cdcb6a272e293287447901bebc59db44d3`.

## K2 — sprzeczność na jednym zrzucie

Zrzut: `/private/tmp/cx-day106-os-czasu-artefakty/day106-timeline-contradiction.png`
SHA-256: `fe1a537fba8d1fc5161d2ce23b0777529d9bcbc2b574a459d861026157fdba97`
Wynik: `1 z 1` wymaganych zrzutów; oba sygnały widoczne jednocześnie.

Runtime: frontend `200`, health `200`, ready `200`, server/client marker `5b29e4ec1b2f`, PostgreSQL `127.0.0.1:5987`, serwer `4872`, klient `4873`, migracje `863`, auth/test bypass `OFF`, V8 global `ON`. Runtime manifest: `/tmp/consultify-wave3-runtime-manifest-day106.json`, SHA-256 `d157ee3a36049496af6a65ac6753a34a7774e2cfa2964b2c25ed671749ed2c29`.

## K3 — dwa pytania rdzenia

### Pytanie 1: skąd bierze się `1`

Read model rekordu `450814b6-309b-4fcc-874d-a321466a7a5e` ma `payload_json.lifecycleState='IN_EXECUTION'`. Adapter wpisuje projekcję do `displayStatus` (`initiativeRegisterProjection.ts:193-200`), a preset `IN_EXECUTION` obejmuje stan `IN_EXECUTION` (`:13-32`). Chip liczy `allInitiatives` po `displayStatus` (`InitiativesHub.tsx:2110-2129`). Mapowanie statusu pomocniczego zmienia `IN_EXECUTION` na `EXECUTING` (`initiativeRegisterProjection.ts:163-170`). To nie jest licznik legacy `initiatives.status`, który dla tego rekordu wynosi `DRAFT`.

### Pytanie 2: dlaczego oś widzi `0`

Ten sam rekord przechodzi filtr statusu: `filteredInitiatives` bez aktywnego filtra zwraca wszystkie inicjatywy (`ExecutionTimelineView.tsx:880-896`). Wypada dopiero na `processedInitiatives.filter(i => i.startDate || i.plannedEndDate || i.endDate)` (`:957-960`). Niezależny SQL readback: `start_date=NULL`, `planned_start_date=NULL`, `planned_end_date=NULL`, `end_date=NULL`; lifecycle pozostaje `IN_EXECUTION`. Przyczyna: **wyłącznie filtr dat, nie filtr statusu — 1 z 1 badanego rekordu**.

## K4 — wszystkie klucze pustego stanu: 1 z 1

| Klucz | Warunek wywołujący | Treść EN | Ocena |
| --- | --- | --- | --- |
| `execution.empty.noInExecution` | `initiativeRows.length === 0`, brak aktywnych filtrów (`ExecutionTimelineView.tsx:1489-1497`) | `No initiatives in execution. Move initiatives to execution first.` (`translation.json:11718`) | `0/1` zgodności: warunek oznacza też „inicjatywy istnieją, ale nie mają dat”; komunikat twierdzi coś innego |

`execution.timeline.noResults` jest stanem wyniku aktywnych filtrów, nie kluczem `execution.empty.*`; uwzględniam go osobno: treść odpowiada aktywnym filtrom, `1/1`.

## K5 — produkt: DO DECYZJI WŁAŚCICIELA

**DO DECYZJI WŁAŚCICIELA:** czy inicjatywa w realizacji bez dat ma być pokazana na osi jako jawny rekord „brak dat”, czy oś ma pozostać pusta z osobnym, prawdziwym komunikatem o braku dat/harmonogramu.

Nie rozstrzygnąłem tego samodzielnie, ponieważ zabrakło mi zatwierdzonego kontraktu produktowego określającego reprezentację inicjatyw bez dat na osi czasu. Niezależnie od wyboru, obecny komunikat nie może twierdzić, że inicjatywy nie ma w realizacji.

### Czerwony kontrakt

Nowy test `tests/unit/initiatives/executionTimelineTruthfulness.contract.test.ts` wymaga minimalnego, nieprzesądzającego wariantu prawdziwości: kod musi rozróżniać `filteredInitiatives.length > 0` od zera inicjatyw i użyć osobnego klucza `execution.empty.noTimelineDates`, którego treść mówi o datach/harmonogramie, a nie o przenoszeniu do realizacji. Test jest celowo czerwony; naprawy produktu i tłumaczeń nie wprowadziłem zgodnie z B.5 i §D.

Komenda i wynik:

```text
RUN_DB_TESTS=0 MOCK_DB=true npx vitest run tests/unit/initiatives/executionTimelineTruthfulness.contract.test.ts --retry=0 --reporter=json --outputFile=/private/tmp/cx-day106-os-czasu-artefakty/day106-red-contract.json
exit 1
fullName: Initiatives timeline truthful empty-state contract distinguishes initiatives without timeline dates from no initiatives in execution
status: failed
przyczyna: source nie zawiera `filteredInitiatives.length > 0`
```

JSON: SHA-256 `65ed8cf7ab83096dcf6a784caf8baf7e75b2ce38bd742fab549a41f236d42dbc`. Wynik czerwony jest oczekiwanym dowodem otwartego kontraktu, nie regresją ani twierdzeniem `FIXED`.

## Z30 — zero wysyłki

Przed zapisem fixture środowisko zwróciło `BRAK ZMIENNYCH POCZTY`. Po migracjach zapytanie `settings WHERE key LIKE 'smtp%'` zwróciło `0 rows`. `Gateway.ts` nie montuje drenażu; log runtime potwierdził `Initiative/Execution outbox consumer: DISABLED`. Manifest runtime potwierdza brak zabronionych kluczy w `5/5` procesach grup należących do dyżuru.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Uruchomiłem `server/src/index.ts` wyłącznie przez kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs`, na lokalnej bazie dyżuru, tylko w celu wykonania zrzutów. Zweryfikowałem środowisko procesu i log serwera zgodnie z `§0.2b` (4). Żaden e-mail, zaproszenie kalendarzowe ani powiadomienie zewnętrzne nie zostało wysłane.

## Trasy backendu ustalone z Gateway.ts

Mounted paths dla modułu: `/api/initiatives` (`Gateway.ts:680-700`), `/api/initiative-generator` (`:1090-1093`), `/api/pmo/initiatives` (`:1149`), `/api/report-initiatives` (`:1187`), `/api/vnext/results/initiatives` (`:1261`) i `/api/initiatives-v4` (`:1290`). Dowód ekranu korzysta z realnego `ApiGateway` uruchomionego przez pełny kanoniczny runtime.

## Pułapki Z33 dla dowodów

- Runtime/browser: (a) wyłączona przez `ENABLE_V8_GLOBAL=true`; (d) wyłączona przez `ENABLE_TEST_AUTH_BYPASS=false`; (c) nie dotyczy procesu runtime, bo manifest potwierdza PostgreSQL i 863 migracje; (e) nie maskowała wyniku — health/ready/frontend miały `200`, a ekran załadował realny rekord. (b) nie leży na ścieżce tego ekranu; nie używano middleware Results.
- Seeder/readback: nie był pakietem Vitest. Miał jawny lokalny `DATABASE_URL`, `MOCK_DB=false`, `DB_TYPE=postgres`, a niezależny SQL potwierdził rekord w bazie. Nie używał Gateway ani auth middleware.
- Czerwony kontrakt: czysto plikowy, `RUN_DB_TESTS=0 MOCK_DB=true`; nie dowodzi egzekucji, tylko utrwala oczekiwany invariant prawdziwości.

## Pomiar testu i zasięg

Wydana instrukcja odwołuje się do nieistniejącego §0.4a, więc nie ma definiowanej komendy pomiaru zasięgu. Wykonałem samodzielnie: nowy kontrakt `1/1` jest czerwony na dokładnie oczekiwanym braku; nie przepisałem żadnej cudzej liczby. Porównanie regresji po pełnych nazwach ograniczam do nowego pliku, ponieważ nie zmieniono kodu produkcyjnego ani infrastruktury testów.

## K7 — rozłączność

Zmiany repo: dokładnie raport, `MODULE_ACCEPTANCE.md` i jeden nowy test. `ExecutionTimelineView.tsx`, `public/locales/**`, `server/src/**`, infrastruktura testowa i rejestry: `0` zmian.

Sprzątanie zasobów własnych: kanoniczny stop potwierdził `ownedProcessGroupsOnly=true`, `processGroupsVerifiedTerminated=true`, `portsFree=true`; następnie usunąłem kontener z wolumenem przez `docker rm -fv cx-day106-pg`. Listenerów na `5987`, `4872`, `4873`: `0/3`. Log stopu: `/private/tmp/cx-day106-os-czasu-artefakty/day106-runtime-stop.log`, SHA-256 `045f9f3910b0b6ea1a71c584f9733ba7d2007d8b64fb9eecc9a5ecdbb55efc12`.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowałem wariantu tablet ani light theme; K2 wymagał jednego zrzutu sprzeczności, a nie macierzy wizualnej.
- Nie zweryfikowałem, jak powinien wyglądać docelowy rekord „brak dat”; to jawna decyzja właściciela.
- Nie wykonałem pełnej suity repo, ponieważ nie zmieniono produktu, a instrukcja nie zawiera odwoływanej definicji §0.4a; nie twierdzę, że pełny korpus jest zielony.
- Nie twierdzę, że filtr dat jest błędem. Udowodniłem, że komunikat opisuje inną przyczynę niż rzeczywista.

## Kryteria końcowe

| Kryterium | Wynik |
| --- | --- |
| K1 | `4/4 PASS` |
| K2 | `1/1 PASS` |
| K3 | `2/2 PASS` |
| K4 | `1/1` kluczy ocenionych; `0/1` zgodny z warunkiem |
| K5 | `1/1 DO DECYZJI`, bez zmiany produktu |
| K6 | `PASS`, sekcja niepusta (`4/4` wpisy) |
| K7 | `PASS`, `3/3` dozwolone klasy plików, `0` zmian produktu |
