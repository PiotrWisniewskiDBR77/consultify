# AP-03 / AP-09 / AP-11 — domknięcie fali kontraktowej (P-6 + dwa błędy typów)

**Werdykt:** stan `AP_03_AP_09_AP_11_CONTRACT_CANDIDATE_READY_FOR_REVIEW` jest **OSIĄGALNY** —
jedyna blokada z weryfikacji końcowej (2 czerwone testy) zniknęła, oba pomiary powtórzone.

- **Gałąź:** `codex/finance-v3-apwave-fanin`, baza weryfikacji `85ff1edef8`
- **Baza zamrożona:** `codex/finance-v3-closeout-fanin` @ `19b4b06934` — nietknięta, bez merge'a, bez pusha
- **Poprzedni dokument:** `APWAVE_FINAL_VERIFICATION_report.md` (werdykt `NOT READY`, punkt P-6)
- **Data:** 2026-08-10
- **Zmienione pliki:** wyłącznie **trzy pliki testowe** + ten raport. Zero kodu produkcyjnego,
  zero migracji, zero `tsconfig.json`.
- **Baza danych:** efemeryczny PostgreSQL 15.15 (Homebrew), `initdb --locale=C`, port **57431**
  (sprawdzony `lsof`), gniazdo `/tmp/apwclose`. **Żadnego kontaktu ze staging/demo/produkcją.**
  Sprzątnięte na końcu.

---

## 1. Zadanie 1 — dwa przestarzałe testy w `lineageFreshnessService.pg.test.ts`

### 1.1 Co było

Autor `ap11-staleness` **przypiął testem** bloker WP-B02 (`transition({action:'invalidate'})`
na wersji APPROVED rzucał `P0001 … is APPROVED; only status and its associated metadata
columns may change`, bo `UPDATE` inkrementował `version`, a `version` nie jest na allow-liście
strażnika niezmienności). Krok 2 sekwencji §6.4 musiał wtedy obejść tę drogę i wołać
`propagateStaleness()` bezpośrednio. Autor zostawił instrukcję na piśmie: po naprawie test
odwrócić, a krok 2 przepisać na realną ścieżkę. Strumień `fix-transition` naprawę dostarczył.

### 1.2 Co zrobiono

**a) Test-bloker → kontrola pozytywna.** Asercja „rzuca" zamieniona na „udaje się i propaguje".
Test nie tylko sprawdza, że nie ma wyjątku — mierzy **dokładnie to, co naprawiono**:

- `result.businessVersion.status === 'INVALIDATED'`, `invalidated_reason` zapisany;
- **`version` NIE jest podbity** dla wiersza, którego stary status to APPROVED — to jest ta
  jedna linijka, którą odrzucał strażnik;
- podsumowanie propagacji: `visited 1 · marked 1 · eventsWritten 1 · reasonCode
  SOURCE_INVALIDATED · newState STALE_SOURCE · recomputeEnqueued false · depthLimitReached false`;
- **fizyczny read-back** potomka: `STALE_SOURCE` / `SOURCE_INVALIDATED`, `stale_since` ustawione,
  a `version` / `status` / `compute_snapshot_id` / `content_semantic_hash` /
  `source_working_revision_id` **bajt w bajt takie same** jak przed — czyli oznaczenie ruszyło
  wyłącznie kolumny świeżości;
- dokładnie **jeden** wiersz w `finance_lineage_freshness_events`, z realnym `triggering_edge_id`,
  `previous_state CURRENT` → `new_state STALE_SOURCE`;
- odcisk „nic nie przeliczono": `compute_jobs`, `compute_job_outputs`, `compute_job_runs` = 0.

**Nowa izolowana organizacja fixture (org E, dwa wierzchołki APPROVED).** Kontrola pozytywna
celowo NIE konsumuje eskalacji org B — bo krok 2 musi ją wykonać sam, na potomku, który nie jest
jeszcze `SOURCE_INVALIDATED`. Oba wierzchołki org E są APPROVED, bo (i) `invalidate` (T11) nie
przyjmuje innego stanu źródła i (ii) APPROVED-owy potomek to przypadek, który strażnik B01
odrzuci najchętniej.

**b) Krok 2 → realna ścieżka.** Zamiast `propagateStaleness()` krok 2 jedzie teraz przez
`artifactVersionService.transition({action:'invalidate'})` na `bStatement1`. Poza tym, co było,
dołożone: `visited 1 · marked 1 · reasonSuppressed 0 · unchanged 0`, sprawdzenie stanu
wejściowego (`NEW_SOURCE_VERSION` przed), oraz **wiersz ledgera eskalacji**
(`STALE_SOURCE → STALE_SOURCE`, `reason_code SOURCE_INVALIDATED`, `triggering_version_id =
bStatement1`). Zachowana asercja nośna: eskalacja powodu **nie resetuje** `stale_since`.

**c) Komentarze.** Opisują stan po naprawie; historia przypiętej wady została zachowana jednym
akapitem („ten test był kiedyś odwrócony, bo…"), żeby nie zgubić kontekstu WP-B02.

**Czy coś osłabiono: nie.** Bilans testów w pliku bez zmian (13). Asercji przybyło — kontrola
pozytywna ma ich 31 wobec 5 w teście-blokerze, krok 2 ma 17 wobec 5. Żadna asercja nie stała
się trywialnie prawdziwa: każda liczba pochodzi z read-backu bazy albo ze zwrotki serwisu, a
kontrola negatywna (niżej) dowodzi, że test realnie mierzy naprawę.

### 1.3 Kontrola negatywna (obowiązkowa)

Tymczasowe cofnięcie naprawy w `artifactVersionService.ts`
(`const versionSet = ', version = version + 1';`, **niecommitowane**):

```
× transition(invalidate) on an APPROVED version SUCCEEDS and propagates SOURCE_INVALIDATED …
× step 2: a STRONGER reason (SOURCE_INVALIDATED) overrides the weaker one, keeping stale_since
× step 3: a WEAKER reason arriving later does NOT overwrite it, but IS recorded in the ledger
error: finance_business_versions: … is APPROVED; only status and its associated metadata columns may change
Tests  3 failed | 10 passed (13)
```

Oba odwrócone testy czerwienieją z ORYGINALNYM błędem strażnika, a krok 3 kaskaduje (bez
eskalacji z kroku 2 nie ma czego tłumić). Plik produkcyjny przywrócony; `git diff` dla
`artifactVersionService.ts` **pusty** (0 linii).

Dodatkowo kontrola bramki bazodanowej — bez `RUN_DB_TESTS=1` / `MOCK_DB=false`:
`Test Files 1 skipped (1) · Tests 13 skipped (13)`. Zielone wyniki nie są atrapą (potwierdzone
też fizycznie: po przebiegu w bazie 5 organizacji `AP-11*` i 168 wierszy
`finance_business_versions`).

---

## 2. Zadanie 2 — dwa błędy typów dopisane przez tę falę

| Plik / linia | Błąd | Naprawa |
|---|---|---|
| `workspace/__tests__/lineageNavigatorContract.test.ts:548` | TS2339 `sort` na `readonly string[]` | kopia przed sortowaniem (`[...ids].sort()`) — `sort()` w miejscu mutowałby wyjście kontraktu |
| `workspace/__tests__/moduleAdapters.test.ts:203` | TS2554 oczekiwano 2 argumentów, podano 1 | dopisany wymagany `sourceStatus: 'APPROVED'` (status nieterminalny — adapter deklaruje, co może zrodzić ŻYWY artefakt) |

Obie naprawy są **zachowawcze wobec runtime'u**: brakujący `sourceStatus` był dotąd `undefined`,
a `isTerminalVersionStatus(undefined)` jest fałszywe, więc wynik funkcji się nie zmienia.

**Pomiar** (tymczasowy `server/tsconfig.apwave-close-tmp.json` bez `**/*.test.ts` i `**/*.spec.ts`
w `exclude`; **plik usunięty po pomiarze, niecommitowany**):

| | Błędów `error TS` |
|---|---:|
| przed | **355** |
| po | **353** |

Różnica zbiorów błędów przed/po to **dokładnie te dwie pozycje** — żaden nowy błąd nie powstał.
Pozostałe **353** to zastany dług spoza tej fali; nietknięty (pytanie P-3 do właściciela
pozostaje otwarte).

---

## 3. Zadanie 3 — ponowne pomiary

### Punkt 2 — cały `server/src/services/finance/` na realnym PG

```
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=… \
  npx vitest run src/services/finance --no-file-parallelism      # z katalogu server/
```

| | Plików | Testów | Passed | Failed | Skipped |
|---|---:|---:|---:|---:|---:|
| poprzednio | 36 | 638 | 636 | **2** | 0 |
| **teraz** | **36** | **638** | **638** | **0** | **0** |

Wymóg „0 failed, 0 skipped" — **spełniony**.

### Punkt 6 — regresja wobec zamrożonego ROI-E007

| Zakres | Plików | Testów | Passed | Failed | Skipped | Baza zamrożona |
|---|---:|---:|---:|---:|---:|---|
| `tests/resultsVnext/roi/` | 37 | **120** | 120 | 0 | 0 | 120/120 — **zgodne** |
| `tests/resultsVnext/` | 55 | **278** | 278 | 0 | 0 | 278/278 — **zgodne** |

**Uwaga metodyczna, ważniejsza niż same liczby.** Te suity trzeba uruchamiać z
`DB_TYPE=postgres MOCK_DB=false RUN_DB_TESTS=1` **oraz** własnym `DATABASE_URL`. Bez tego:

1. `tests/setup.ts:392` podstawia **domyślny** `DATABASE_URL` na
   `postgresql://iris:iris_test@localhost:5432/iris_test` — na maszynie deweloperskiej ten host
   ODPOWIADA (lokalny Homebrew), więc przebieg cicho łączy się z cudzą bazą zamiast pominąć testy;
   u mnie dało to `34 failed (37)` na braku schematu ROI (nic tam nie zapisano — suity padają na
   sondzie schematu przed pierwszym `INSERT`; sprawdzone).
2. Nawet z poprawnym `DATABASE_URL`, ale bez `DB_TYPE`/`MOCK_DB`, `vitest.config.ts` narzuca
   `DB_TYPE: 'sqlite'`, a `tests/setup.ts` `MOCK_DB=true` — wtedy test pisze fixture'y do realnego
   PG własnym klientem `pg`, a **serwis czyta z atrapy**, co daje mylące
   `Error: Initiative not found` w `roiObligationsSurviveInitiativeClosure.realdb.test.ts`.
   Kontrola: ten sam plik na czystej bazie **przy HEAD, bez moich zmian**, też pada — czyli to
   artefakt środowiska, nie regresja fali; z pełnym kompletem flag przechodzi.

Każdy z pomiarów jechał na **osobnej, świeżo zmigrowanej** bazie efemerycznej (`migrate.postgres.ts`
bez `--safe`, exit 0) — te suity nie są idempotentne między przebiegami na tej samej bazie
(powtórka daje `created:false`).

---

## 4. Stan po tej pracy

| Punkt weryfikacji końcowej | Było | Teraz |
|---|---|---|
| 1. Migracje strict fresh | PASS | PASS (bez zmian, migracji nie ruszano) |
| 2. `server/src/services/finance/` | **FAIL 2/638** | **PASS 638/638** |
| 3. Pisarz `freshness*` | PASS | bez zmian |
| 4. Most Escape AP-03 ↔ AP-09 | PASS (z otwartą zależnością) | bez zmian |
| 5. Typecheck | PASS / luka 355 | PASS / luka **353** (fala nie dokłada już nic) |
| 6. Regresja ROI-E007 | PASS | **PASS, zgodne co do jednego** |
| 7. Czystość allowlisty | PASS | bez zmian (dopisane 3 pliki testowe + ten raport) |

**`AP_03_AP_09_AP_11_CONTRACT_CANDIDATE_READY_FOR_REVIEW` — osiągalny.**

Bez zmian pozostają wszystkie pozycje `EVIDENCE_MISSING` z §8 poprzedniego raportu (21 otwartych)
oraz pytania P-1…P-5 do właściciela. **P-6 jest zamknięte tym dokumentem.** Przypomnienie, żeby
werdykt nie zabrzmiał szerzej, niż jest: ta fala dowodzi poprawności **kontraktów**, nie działania
produktu — warstwy UI ani produkcyjnych callerów nadal nie ma.

---

## 5. Reprodukcja

```bash
PGBIN=/opt/homebrew/opt/postgresql@15/bin           # NIE @16
PGDATA=<scratchpad>/pgdata ; PGSOCK=/tmp/apwclose ; PORT=57431   # lsof-sprawdzony
LC_ALL=C $PGBIN/initdb -D "$PGDATA" -U postgres -E UTF8 --locale=C
LC_ALL=C $PGBIN/pg_ctl -D "$PGDATA" -o "-p $PORT -k $PGSOCK -c listen_addresses=127.0.0.1" start

# osobna świeża baza NA KAŻDY pomiar
$PGBIN/psql -h 127.0.0.1 -p $PORT -U postgres -c "CREATE DATABASE apwave_close2;"
NODE_ENV=test DB_TYPE=postgres DATABASE_URL="…/apwave_close2" npx tsx server/scripts/migrate.postgres.ts

# punkt 2
cd server && DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
  DATABASE_URL="…/apwave_close2" npx vitest run src/services/finance --no-file-parallelism

# punkt 6 (pełny komplet flag — patrz §3)
DB_TYPE=postgres MOCK_DB=false RUN_DB_TESTS=1 DATABASE_URL="…/apwave_roi_b" \
  npx vitest run tests/resultsVnext/roi --no-file-parallelism
DB_TYPE=postgres MOCK_DB=false RUN_DB_TESTS=1 DATABASE_URL="…/apwave_roi_e" \
  npx vitest run tests/resultsVnext --no-file-parallelism

$PGBIN/pg_ctl -D "$PGDATA" -m fast stop && rm -rf "$PGDATA" "$PGSOCK"
```

Sprzątanie wykonane. Współdzielone instancje Homebrew nietknięte.
