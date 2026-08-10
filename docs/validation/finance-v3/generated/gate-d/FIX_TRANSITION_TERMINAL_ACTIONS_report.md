# FIX — T10 `archive` / T11 `invalidate` were dead in production

**Data:** 2026-08-10
**Gałąź:** `codex/finance-v3-apwave-fix-transition` (odbita od zaakceptowanego
`19b4b06934` na `codex/finance-v3-closeout-fanin`; zamrożona gałąź NIE była
scalana, modyfikowana ani pushowana)
**Worktree:** `/Users/piotrwisniewski/consultify-wt/apwave-fix-transition`
**Commity:** `331454ae22` (naprawa + migracja), `f64abecf94` (testy), `<ten raport>`

---

## 1. Wniosek

Dwie operacje cyklu życia wersji biznesowej — **T10 `archive`** i **T11
`invalidate`** — **rzucały surowy błąd Postgresa bezwarunkowo** i nie dało się
ich wykonać na żadnej realnej bazie. Defekt potwierdzony eksperymentalnie,
naprawiony, przypięty testem na realnym PostgreSQL i zweryfikowany kontrolą
negatywną.

Przy okazji naprawy odkryto i zamknięto **drugą, sąsiednią dziurę**: wiersz w
statusie `ARCHIVED`/`INVALIDATED` w ogóle nie był chroniony przez wyzwalacz
niezmienności, więc jego treść (`content_semantic_hash`, `compute_snapshot_id`)
dało się dowolnie nadpisać. To nie jest kosmetyka — bez tego naprawa T10/T11
otwierałaby furtkę: „zarchiwizuj zatwierdzoną wersję, żeby odblokować jej
zawartość".

---

## 2. Dowód „czerwony przed"

Środowisko: własny efemeryczny klaster PostgreSQL 15.15, `initdb --locale=C`,
`LC_ALL=C`, katalog danych `/private/tmp/apwave-fix-pgdata` (poza repo), port
`57431` (zakres 55000–59999, wolność potwierdzona `lsof` przed użyciem),
`listen_addresses=127.0.0.1`. Pełny zestaw migracji przez
`server/scripts/migrate.postgres.ts`, 0 błędów. Nigdy nie dotknięto
współdzielonej instancji Homebrew ani żadnego hosta demo/staging/prod.

Scenariusz: przez **realne serwisy** zbudowano wersję w statusie `APPROVED`
(`createArtifact` → T2 `submit_for_review` → T4 `start_review` → `approveVersion`),
po czym wywołano `transition()` z akcją `archive`, a na drugiej wersji `invalidate`.

```
=== archive: bv=e438490c-… status=APPROVED version=4
THROWN name   : error
THROWN code   : P0001
THROWN message: finance_business_versions: e438490c-… is APPROVED; only status
                and its associated metadata columns may change
THROWN where  : PL/pgSQL function finance_bv_enforce_immutability() line 27 at RAISE
ROW AFTER: status=APPROVED version=4

=== invalidate: bv=794293e4-… status=APPROVED version=4
THROWN name   : error
THROWN code   : P0001
THROWN message: finance_business_versions: 794293e4-… is APPROVED; only status
                and its associated metadata columns may change
THROWN where  : PL/pgSQL function finance_bv_enforce_immutability() line 27 at RAISE
ROW AFTER: status=APPROVED version=4

=== CONTROL (ten sam UPDATE bez inkrementacji): {"status":"ARCHIVED","version":4}
```

Wiersz **nie ruszył się** w obu przypadkach (`status=APPROVED` po próbie), a
kontrola bez `version = version + 1` przeszła — co izoluje przyczynę do samej
inkrementacji, nie do reszty instrukcji.

### 2.1 Mechanizm

* `artifactVersionService.transition()` wykonywał `SET status = ?, version = version + 1 …`
  dla **każdej** akcji.
* `finance_bv_enforce_immutability()`
  (`server/migrations/20260809_finance_v3_b01_core_artifacts.sql:231`) dla wiersza,
  którego `OLD.status = 'APPROVED'`, porównuje `to_jsonb(OLD)`/`to_jsonb(NEW)` z
  pominięciem listy dozwolonych kluczy. Lista: `status`,
  `superseded_by_version_id`, `invalidated_reason`, `updated_at`, `archived_by`,
  `archived_at`, `superseded_at`, `freshness`, `freshness_reason`, `stale_since`.
  **Nie ma na niej `version`.**
* `lifecycleService.TRANSITIONS`: `archive` (T10) i `invalidate` (T11) to
  **jedyne** dwa przejścia, których `from` to `['APPROVED']`. Czyli dokładnie te
  dwa i tylko te dwa trafiały w wyzwalacz.

### 2.2 Dlaczego nikt tego nie złapał

Jedyne pokrycie T10/T11 to `lifecycleService.test.ts` — czysty test jednostkowy
`validateTransition()`, funkcji zadeklarowanej jako pure („does not know about
`expectedVersion`/CAS (that is a DB-level concern in the caller)"). Nigdy nie
dochodzi do SQL, więc strukturalnie nie mógł tego zobaczyć. Żaden test `.pg` nie
wywoływał `archive` ani `invalidate`.

---

## 3. Wybór drogi naprawy — i dlaczego ta

Rozważane były dwie drogi wskazane w zleceniu. **Wybrano (a): nie inkrementować
`version` przy przejściu wychodzącym z `APPROVED`.**

### 3.1 Rozstrzygający argument: wzorzec, który JUŻ działa

W tym samym pliku istnieje **druga** operacja `APPROVED` → status terminalny:
**T9**, czyli „supersede rodzica" wewnątrz `approveVersion()`
(`artifactVersionService.ts`, ~linia 700). T9 działa na produkcji od zawsze.
Wygląda tak:

```sql
UPDATE finance_business_versions
   SET status = 'SUPERSEDED', superseded_at = now(), superseded_by_version_id = ?
 WHERE business_version_id = ? AND organization_id = ? AND status = 'APPROVED'
```

Dwie rzeczy naraz: **nie rusza `version`** i **strzeże współbieżności statusem
w `WHERE`**, nie licznikiem. To jest gotowy wzorzec w tym samym pliku, dla tej
samej klasy przejścia. Zlecenie kazało poszukać „jakiegoś wzorca do
naśladowania" przy przejściu z APPROVED — to jest właśnie on. Naprawa (a)
sprowadza T10/T11 do zachowania T9. Naprawa (b) zrobiłaby z T10/T11 wyjątek od
reguły, którą sąsiednia linia kodu już stosuje.

*Uwaga porządkowa:* reopen (T12) nie jest tu kontrprzykładem — `reopenVersion()`
**nigdy nie wykonuje `UPDATE` na wierszu vN** (to jego udokumentowany
niezmiennik, WP-B02 §6.2 krok 6). Do wyzwalacza w ogóle nie dochodzi. Realnym
punktem odniesienia dla „przejścia z APPROVED, które działa" jest T9, nie reopen.

### 3.2 Dlaczego NIE rozszerzenie listy w wyzwalaczu

Poluzowanie listy dozwolonych kolumn dla wierszy `APPROVED` obowiązywałoby
**każdego pisarza do tej tabeli, na zawsze**, żeby kupić licznik, którego ta
ścieżka nie potrzebuje (§3.3). Do tego `version` i tak nigdy nie był kompletnym
licznikiem zmian wiersza `APPROVED`: dozwolone zapisy `freshness` /
`freshness_reason` / `stale_since` (strumień propagacji świeżości) ruszają ten
wiersz **nie podnosząc `version`**, z dokładnie tego samego powodu. Dodanie
`version` do listy utrwaliłoby fikcję, że ten licznik cokolwiek na wierszu
zatwierdzonym gwarantuje.

### 3.3 Czy CAS została zachowana — TAK, i oto dokładnie jak

Nie usunięto ochrony po cichu. Bilans:

| Warstwa | Przed | Po |
|---|---|---|
| Optymistyczny odczyt `current.version !== params.expectedVersion` | jest | **bez zmian** |
| `WHERE … AND version = ?` w `UPDATE` | jest | **bez zmian** |
| `version = version + 1` (sygnał po zapisie) | jest (i wysadza całą operację) | brak dla przejść z `APPROVED`; **zachowany bez zmian dla wszystkich pozostałych** |
| `WHERE … AND status = ?` | brak | **dodane** (idiom T9) |

Utracony jest wyłącznie sygnał *po* zapisie i zastępuje go strażnik statusu —
zastępuje go w pełni, bo `ARCHIVED` i `INVALIDATED` są w `TERMINAL_STATUSES` i
**nie mają żadnego przejścia wychodzącego** w tablicy `TRANSITIONS`. Konkretnie
przy wyścigu: przegrywający wątek blokuje się na `SELECT … FOR UPDATE`, po
commicie zwycięzcy odczytuje wiersz ponownie (izolacja READ COMMITTED — `BEGIN`
bez zmiany poziomu), widzi status terminalny i zostaje odrzucony przez
`validateTransition()` **typowanym** `STATE_PRECONDITION_FAILED`. Nie ma
przebiegu, w którym zgubiona aktualizacja przechodzi, i nie ma przebiegu, w
którym wyciekłby surowy błąd bazy. Zmierzone, nie założone — §5.4.

Dodatkowo komunikat w gałęzi `VERSION_CONFLICT` w `transition()` przestał być
gołym „Version conflict" i niesie teraz oczekiwaną wersję oraz status.

---

## 4. Druga dziura, odkryta przy okazji — i zamknięta

Wyzwalacz z b01 strzeże treści **wyłącznie** pod warunkiem
`IF TG_OP = 'UPDATE' AND OLD.status = 'APPROVED'`. Wiersz `ARCHIVED` /
`INVALIDATED` / `SUPERSEDED` wypada z tego warunku w całości.

Zmierzone na schemacie sprzed migracji (surowy `UPDATE`, z pominięciem serwisów):

```
NOTICE:  ARCHIVED content_semantic_hash: UPDATE ACCEPTED (rows=1)
NOTICE:  APPROVED content_semantic_hash: REJECTED -> finance_business_versions:
         794293e4-… is APPROVED; only status and its associated metadata columns may change
```

Dopóki T10/T11 były martwe, przez serwisy nie dało się wyprodukować wiersza
`ARCHIVED`/`INVALIDATED` — naprawa czyni te statusy osiągalnymi po raz pierwszy,
więc ekspozycja staje się realna. Zostawienie tego oznaczałoby, że archiwizacja
zatwierdzonej wersji jest tylnym wejściem do jej zawartości.

**Migracja addytywna:** `server/migrations/20260823_finance_v3_bv_terminal_immutability.sql`
— wyłącznie `CREATE OR REPLACE FUNCTION finance_bv_enforce_immutability()`.
Żadna tabela/kolumna/indeks/wyzwalacz nie jest ruszana, plik b01 pozostaje
bajt‑w‑bajt nietknięty, brak słowa „seed", brak SQLite‑owego `DATETIME`,
ponowne uruchomienie jest idempotentne. Gałąź `APPROVED` przeniesiona verbatim
z b01. Dołożona gałąź:

* `OLD.status IN ('ARCHIVED','INVALIDATED')` → status nie może się już zmienić
  (żadnego wskrzeszania), a treść jest zamrożona.
* Nadal zapisywalne na wierszu terminalnym: `updated_at`, `freshness`,
  `freshness_reason`, `stale_since` (strumień propagacji świeżości musi móc
  oznaczyć archiwalną wersję jako nieaktualną) oraz `result_quality` — to
  ostatnie dlatego, że wyzwalacz z
  `20260810_finance_v3_d01c_real_company_integrity_fix.sql:288` pisze je
  klauzulą `WHERE … AND status <> 'APPROVED'`, czyli celuje dokładnie w te
  wiersze. Utrzymanie go zapisywalnym to decyzja o **zerowej zmianie
  zachowania** dla istniejącej ścieżki; to etykieta jakości danych, nigdy treść
  finansowa.
* Zamrożone m.in. `archived_by`/`archived_at`/`invalidated_reason`/`superseded_*`
  — powodu wycofania wersji nie da się przepisać po fakcie.

**Świadomie NIE objęto `SUPERSEDED`.** Ma identyczną lukę, ale jest osiągalny od
dawna (T9 w `approveVersion` oraz `server/scripts/finance-v3-backfill-dry-run.ts`),
więc zamknięcie go ma szerszy promień rażenia niż ten bugfix. **Zgłaszam jako
osobne znalezisko, nie doklejam po cichu.**

---

## 5. Testy na realnym PostgreSQL

Nowy plik: `server/src/services/finance/canonical/__tests__/artifactVersionTerminalTransitions.pg.test.ts`
(12 testów). Każdy zapis dowodzony **fizycznie** (`changes`/`rowCount` **oraz**
niezależny odczyt zwrotny przez `getBusinessVersion`), nigdy wnioskowany z
`ok: true` — w tej sesji fałszywy dowód typu „UPDATE 0 wygląda jak PASS" już
wystąpił.

**Bramka zweryfikowana:** bez `RUN_DB_TESTS=1` **i** `MOCK_DB=false` plik
raportuje `12 skipped`, nie zielone zero.

| # | Test | Wynik |
|---|---|---|
| 5.1 | `archive` z APPROVED → `ARCHIVED`, `archived_by`/`archived_at` ustawione, 1 wiersz audytu `ARCHIVE` (`APPROVED`→`ARCHIVED`) | PASS |
| 5.2 | `invalidate` z APPROVED → `INVALIDATED`, powód utrwalony w wierszu i w audycie | PASS |
| 5.3 | `invalidate` z pustym powodem nadal odrzucone (`REASON_REQUIRED`), wiersz się nie rusza | PASS |
| 5.4 | zmiana `content_semantic_hash` na wierszu **APPROVED** nadal odrzucona (pierwotny niezmiennik b01) | PASS |
| 5.5 | zmiana `content_semantic_hash` / `compute_snapshot_id` na **ARCHIVED** i **INVALIDATED** odrzucona (4 przypadki), a treść po próbie identyczna jak przed archiwizacją | PASS ×4 |
| 5.6 | wersji terminalnej nie da się wskrzesić surowym `UPDATE … SET status='APPROVED'` | PASS |
| 5.7 | `freshness`/`freshness_reason`/`stale_since` **nadal** ruszają się na wersji terminalnej (`changes = 1` + odczyt zwrotny) | PASS |
| 5.8 | **współbieżność:** dwa jednoczesne `archive` (`Promise.allSettled`, dwa osobne połączenia z puli) — dokładnie 1 wygrywa, dokładnie 1 przegrywa, **zero odrzuconych promise'ów** (przegrany dostaje typowany `STATE_PRECONDITION_FAILED` z czytelnym komunikatem, nie surowy błąd bazy), w bazie **dokładnie jeden** wiersz audytu `ARCHIVE` | PASS |
| 5.9 | nieaktualny `expectedVersion` nadal odrzucany przez CAS (`VERSION_CONFLICT`) na przejściu nieterminalnym, którego inkrementacja `version` pozostała nietknięta (`version === staleVersion + 1`) | PASS |

```
Test Files  1 passed (1)
      Tests  12 passed (12)
```

Weryfikacja, że przebieg naprawdę dotknął bazy (nie tylko „zielono"):

```
 status           | count        action            | count
------------------+-------      -------------------+-------
 APPROVED         |     2       APPROVE            |    11
 ARCHIVED         |     6       ARCHIVE            |     6
 INVALIDATED      |     3       CREATE             |    12
 READY_FOR_REVIEW |     1       INVALIDATE         |     3
```

---

## 6. Kontrola negatywna

Obie połowy naprawy cofnięte **niezależnie**, żeby pokazać, że każda jest
nośna dokładnie dla tego, co deklaruje.

**6a — cofnięta połowa serwisowa** (`versionSet` z powrotem na bezwarunkowe
`, version = version + 1`):

```
Tests  9 failed | 3 passed (12)
error: finance_business_versions: c704672d-… is APPROVED; only status and its
       associated metadata columns may change        (×8)
```

Czerwienieją **dokładnie na pierwotnym błędzie P0001**. Zielone zostają te 3,
które nie potrzebują dojść do statusu terminalnego (5.3 `REASON_REQUIRED`,
5.4 naruszenie na APPROVED, 5.9 CAS) — czyli dokładnie te, których ta połowa
nie dotyczy.

**6b — cofnięta połowa migracyjna** (przywrócone ciało funkcji z b01 w żywej
bazie, kod serwisu nietknięty):

```
Tests  5 failed | 7 passed (12)
  × rejects a ARCHIVED version having its content_semantic_hash rewritten
  × rejects a ARCHIVED version having its compute_snapshot_id rewritten
  × rejects a INVALIDATED version having its content_semantic_hash rewritten
  × rejects a INVALIDATED version having its compute_snapshot_id rewritten
  × keeps a terminal version terminal (no resurrection via a raw status UPDATE)
```

Czerwienieją **wyłącznie** testy niezmienności terminalnej; `archive`/
`invalidate`/współbieżność zostają zielone. Potwierdza to, że obie połowy są
rozłączne i żadna nie maskuje drugiej.

**Przywrócenie:** obie połowy przywrócone, `git diff` **pusty**, `git status
--porcelain` **pusty**, komplet 12 testów znów zielony.

---

## 7. Regresja

| Zakres | Wynik |
|---|---|
| `server/src/services/finance/canonical/__tests__/` (cały katalog) | **24 pliki / 344 testy — wszystkie PASS**, 0 skipped |
| ten sam katalog **bez** mojego nowego pliku (baza porównawcza) | 23 pliki / **332 testy PASS** |
| `src/services/finance` + `src/routes/v8/finance-v2` | 33 pliki / **529 testów PASS** |
| `npx tsc --noEmit -p server/tsconfig.json` | **exit 0**, 0 błędów (log pusty) |
| pełny zestaw migracji na **świeżej** bazie (`finance_v3_apwave_fresh`) | **exit 0**, 631 migracji, nowa funkcja obecna w `pg_proc` |
| katalog canonical na tej świeżej bazie | 24 pliki / **344 testy PASS** |

**Rozbieżność względem liczby z zlecenia:** podano „309 testów w tym katalogu na
zaakceptowanym SHA"; mierzę **332** testy preegzystujące (bez mojego pliku),
wszystkie zielone. Nie dotykałem żadnego z nich, więc 332 to liczba tego
katalogu na tym drzewie przy w pełni zmigrowanej realnej bazie. Wcześniejsze
309 pochodzi najpewniej z pomiaru, w którym część zestawów `.pg` się pomijała
albo z innego drzewa — **zgłaszam różnicę zamiast ją wygładzać**; 0 testów jest
dziś pomijanych i 0 czerwonych.

---

## 8. Zmienione pliki

| Plik | Zmiana |
|---|---|
| `server/src/services/finance/canonical/artifactVersionService.ts` | `transition()`: brak inkrementacji `version` przy `current.status === 'APPROVED'`, dodany strażnik `AND status = ?`, bogatszy komunikat `VERSION_CONFLICT` + komentarz „dlaczego" |
| `server/migrations/20260823_finance_v3_bv_terminal_immutability.sql` | **nowy**, addytywny — `CREATE OR REPLACE FUNCTION finance_bv_enforce_immutability()` z gałęzią terminalną |
| `server/src/services/finance/canonical/__tests__/artifactVersionTerminalTransitions.pg.test.ts` | **nowy** — 12 testów na realnym PostgreSQL |
| `docs/validation/finance-v3/generated/gate-d/FIX_TRANSITION_TERMINAL_ACTIONS_report.md` | **nowy** — ten raport |

Nic poza allowlistą nie zostało ruszone. Żadna już zaaplikowana migracja nie
została zmodyfikowana. Brak pushu, brak scalenia z zamrożoną gałęzią, brak
kontaktu z żywą bazą.

---

## 9. Znaleziska do osobnego rozpatrzenia

1. **`SUPERSEDED` ma tę samą lukę niezmienności treści co `ARCHIVED`/`INVALIDATED`**
   (§4). Jest osiągalny od dawna przez T9 i przez backfill, więc treść każdej
   wersji wypartej przez nowszą jest dziś swobodnie nadpisywalna surowym SQL-em.
   Świadomie poza zakresem tego bugfixu.
2. **T10/T11 nie mają wystawienia w HTTP.** `server/src/routes/v8/finance-v2/models.routes.ts`
   obsługuje reopen i pozostałe przejścia; nie znalazłem trasy wołającej
   `transition()` z akcją `archive`/`invalidate`. Naprawa odblokowuje warstwę
   serwisową — dopóki nie ma callera produkcyjnego, użytkownik i tak tych
   operacji nie wywoła. Wymaga rozstrzygnięcia, czy to zamierzone.
3. **Klasa defektu, nie pojedynczy przypadek.** Defekt przeżył, bo jedyne
   pokrycie było czysto jednostkowe nad funkcją z założenia nieświadomą SQL-a.
   Warto przejrzeć pozostałe przejścia cyklu życia pod kątem „czy istnieje test
   dotykający bazy", a nie „czy istnieje test".

---

## 10. Reprodukcja

```bash
PORT=57431   # sprawdź lsof -i:$PORT; nigdy 5432/28711/52824
export LC_ALL=C
PGBIN=/opt/homebrew/opt/postgresql@15/bin      # @15, NIE @16 (brak pgvector łamie migracje)
$PGBIN/initdb --locale=C -E UTF8 -D /private/tmp/apwave-fix-pgdata -U postgres
$PGBIN/pg_ctl -D /private/tmp/apwave-fix-pgdata \
  -o "-p $PORT -h 127.0.0.1 -k /private/tmp" -l /private/tmp/apwave-pg.log start
$PGBIN/createdb -h 127.0.0.1 -p $PORT -U postgres finance_v3_apwave_fix

DB_TYPE=postgres NODE_ENV=test \
  DATABASE_URL=postgresql://postgres@127.0.0.1:$PORT/finance_v3_apwave_fix \
  npx tsx server/scripts/migrate.postgres.ts

cd server && DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
  DATABASE_URL=postgresql://postgres@127.0.0.1:$PORT/finance_v3_apwave_fix \
  npx vitest run --config vitest.config.ts \
    src/services/finance/canonical/__tests__/ --no-file-parallelism

$PGBIN/pg_ctl -D /private/tmp/apwave-fix-pgdata -m fast stop
rm -rf /private/tmp/apwave-fix-pgdata
```

Sprzątanie wykonane: `pg_ctl -m fast stop` + `rm -rf` katalogu danych na końcu
sesji; `ps aux` potwierdziło, że współdzielona instancja Homebrew pozostała
nietknięta.
