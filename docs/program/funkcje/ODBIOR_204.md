# ODBIÓR 204 — MIGRACJA LEGACY `tasks` → KANON, ETAP 2 (audyt adwersaryjny)

Gałąź: `codex/day204-migracja-e2-20260831` @ `57364df97b`
Merge-base: `c7f13f588f35f2b761eea02c83f612dcdd215f7c`
Audyt wykonany: 2026-08-31, własna baza `cx-audit204-pg` (loopback 6199, usunięta `docker rm -f -v`)

## WERDYKT: SCALIĆ PO FIX — ocena **B/C** (B za bezpieczniki, C za idempotencję)

Kod jest bezpieczny i uczciwie opisany, ale **kluczowe twierdzenie tego odbioru —
idempotencja — nie jest chronione ŻADNYM testem** (dowód mutacyjny poniżej).
Ponadto limiter ma dziurę, przez którą „pilot 1 rekordu" (D-13) jest niewykonalny.

---

## 1. CO REALNIE WESZŁO (`git log --stat` od merge-base) — 3 commity, 6 plików, +763 linie

| Plik | Rola | Ocena |
|---|---|---|
| `server/migrations/20261722_legacy_task_cutover_step_ledger.sql` (+16) | nowa tabela klucza kroku | **addytywna, poprawna, ALE nieużywana przez kod produkcyjny** |
| `tests/integration/day204-r1-mines.realdb.test.ts` (+190) | 3 miny R1 (fingerprint / CAS / klucz kroku) | realny Postgres, 3/3 |
| `server/scripts/legacy-task-cutover-runner.ts` (+294) | runner migracji | rdzeń dyżuru |
| `tests/integration/day204-legacy-task-cutover-runner.realdb.test.ts` (+51) | test bezpieczników | **mimo nazwy `.realdb` NIE dotyka bazy** |
| `scripts/dev/day204-m3-shape-seed-local.mjs` (+73) | seed miniatury M3 (loopback-only) | poprawny |
| `docs/.../CODEX_DAY204_MIGRACJA_E2_REPORT.md` + `PLAN_MIGRACJI_TASKS_KANON.md` (+139) | raport / A9 planu | uczciwe, deklaruje `NOT_PROVEN` |

`legacy_task_cutover_step_ledger` jest zapisywana **wyłącznie z testu**
(`day204-r1-mines.realdb.test.ts:174,182`); runner jej nie zna — pisze do
zastanej `legacy_task_cutover_ledger` z dyżuru 197. To **biblioteka bez wywołania**.

## 2. RUNNER — odpowiedzi TWARDE

| Pytanie | Odpowiedź | Dowód |
|---|---|---|
| DRY-RUN? | **TAK, domyślny** | `legacy-task-cutover-runner.ts:171` `if (!options.write)`; odtworzone: run bez flag → `"mode":"DRY_RUN"`, 0 wierszy w ledgerze |
| Jawne potwierdzenie? | **TAK, dwustopniowe** | `--write` + `CONFIRM_LEGACY_TASK_CUTOVER=day204-write` (`:87`, `:139`). Odtworzone: bez zmiennej → `Confirmation required`, **exit=1** (zmierzony) |
| Limiter partii? | **TAK, ale DZIURAWY** | `:73` normalizacja do 1 bez `--confirm-batch`, `:51` sufit 10. **Limituje INICJATYWY, nie ZADANIA** |
| **IDEMPOTENTNY?** | **TAK w kodzie, ZERO w testach** | klucz: PK `(organization_id, legacy_task_id)` w `20261721_...sql:20`; runner: `NOT EXISTS` w selektorze (`:149-153`) + `SELECT checksum` → `continue` (`:200-208`) + `clientRequestId = tasks-canonical-v1:{org}:{taskId}` (`:191`). **Ale patrz §6** |

Empirycznie (moja baza): run #1 `--write` → 4 wiersze; run #2 identyczną komendą →
6 wierszy / 6 distinct, **zero duplikatów**. Mechanizm działa.
**Pułapka operacyjna:** run #2 tą samą komendą **nie jest no-opem** — filtr
`NOT EXISTS` przesuwa selektor na KOLEJNĄ inicjatywę i migruje nowe rekordy.
Operator powtarzający „komendę pilota" dla pewności dostaje NOWĄ migrację.

## 3. PILOT 1 REKORDU (D-13) — **BRAK BLOKUJĄCY**

Jednostką limitera jest inicjatywa, nie zadanie. **Ścieżki „dokładnie 1 rekord" nie ma.**
Gorzej — drugie zapytanie (`:166`) brzmi
`WHERE initiative_id IS NULL OR (organization_id || ':' || initiative_id) = ANY($1)`.
Gałąź `initiative_id IS NULL` jest **poza limiterem i poza jakimkolwiek zakresem
organizacji** (runner nie filtruje po `organization_id` w ogóle).

Odtworzony dry-run domyślny (= „pilot") na miniaturze: **4 zadania**, w tym
`task-personal-1` i `task-personal-2` — spoza wybranej inicjatywy.
Skala stagingu: „pilot" wciągnie 1 inicjatywę **+ wszystkie 265 zadań osobistych
ze WSZYSTKICH organizacji** i wpisze 265 wierszy do ledgera.

## 4. ROLLBACK — **NIE ISTNIEJE, nazywam wprost**

Zero skryptu cofania, zero flagi `--rollback`, zero migracji odwrotnej.
Jest **ślad forensyczny** wystarczający do ręcznej naprawy do przodu:
`canonical_id`, `case_version_before/after`, `batch_id`, `checksum`, `completed_at`.
Dodatkowo: ledger dopuszcza status `FAILED` i `PENDING` (`20261721_...sql:9`),
ale **runner nigdy żadnego z nich nie zapisuje** — wyjątek w pętli (`:206`, `:235`)
propaguje i **przerywa całą partię**, nie zostawiając w rejestrze śladu porażki.

## 5. TESTY URUCHOMIONE SAMODZIELNIE (vitest per plik, nie pełny suite)

| Plik | Wynik | Warunki |
|---|---|---|
| `day204-legacy-task-cutover-runner.realdb.test.ts` | **6/6 PASS** | bez bazy (test czysto argumentowy) |
| `day204-r1-mines.realdb.test.ts` | **3/3 PASS** | `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres`, świeży PG17 |
| `day197-legacy-task-cutover.realdb.test.ts` (regres) | **2/2 PASS** | j.w. |
| **razem** | **11/11** | zgodne z `day204-all-tests.json` |

Bramka świeżej bazy: pełny `migrate.postgres.ts` na PUSTEJ bazie przeszedł do
`✅ Postgres migrations complete` — migracja `20261722` jest bezpiecznie addytywna.
Walidator nazw: **92 → 92** (zmienił się tylko licznik plików 1088→1089) — potwierdzone.

## 6. MUTACJA WŁASNYMI RĘKAMI — **wynik rozstrzygający**

### Mutacja A — limiter: **TEST CZERWIENIEJE ✅**
`:73` `batchSize: args.includes('--confirm-batch') ? parsedBatch : 1` → `batchSize: parsedBatch`
→ **1 failed | 5 passed**, `AssertionError: expected 5 to be 1`. Przywrócone → 6/6.
Zgodne co do liczby z artefaktem wykonawcy. Limiter jest realnie chroniony.

### Mutacja B — idempotencja: **TEST NIE CZERWIENIEJE ❌ — TAUTOLOGIA**
Usunąłem **OBA** strażniki naraz:
- `:149-153` cały blok `AND NOT EXISTS (SELECT 1 FROM legacy_task_cutover_ledger ...)`
- `:204-208` cały blok `if (existing.rows[0]) { ...checksum conflict...; continue; }`

Uruchomione 3 pliki testowe (11 przypadków, realny Postgres):
**`Test Files 3 passed (3) / Tests 11 passed (11)`** — **zero regresji.**

Wniosek: idempotencja **nie ma pokrycia testowego w całym repozytorium**.
Jedyny importer runnera to test argumentowy; `day197-...` runnera nie dotyka;
runner nie ma wpięcia w `package.json`. Punkt „idempotentny" jest **NIEZROBIONY
dowodowo** — działa, ale nic go nie broni przed regresją.

Ponadto para `SELECT ... ` → `createExecutionTask` → `INSERT ledger` **nie jest
w jednej transakcji** (`:200`, `:238`, `:266`): awaria między poleceniem a wpisem
zostawia kanoniczne zadanie bez wiersza w rejestrze, a ponowienie uderza w
`aggregate version conflict` — dokładnie ta mina, którą test R1 #2 udowodnił,
i dla której **nie ma naprawy do przodu**.

Worktree przywrócony 1:1 (`git status` pusty, `md5 = fa93989d859dc97a2ffa127a3349e96d`
identyczne z kopią sprzed mutacji). Zakaz `git stash` dotrzymany (kopia przez `cp`).

## 7. Z28 (zdalne bazy) i Z31 (pinowanie DB_TYPE)

**Z31 — CZYSTE ✅.** `assertRealPostgresTestEnvironment()` wołane bez argumentów
(`day204-r1-mines...:50`), zero asercji na host/port/nazwę bazy/kontener.
`expect(process.env.DB_TYPE).toBe('postgres')` (`:51`) to asercja na typ, nie pin.

**Z28 — NARUSZONE STRUKTURALNIE ⚠️ (dług zastany, nie autorstwa 204).**
Runner **nie ma żadnej blokady bazy zdalnej**. `resolveScriptDatabaseTarget`
(`server/scripts/lib/scriptDatabaseTarget.ts:52-53`) woła tylko
`assertNoLocalDatabaseOutsideTests` i `assertNoPrivateRailwayDbHostOutsideRailway`.
Denylist obejmuje **wyłącznie produkcję** (odcisk `centerbeam`,
`databaseTargetResolver.ts:42`). **Demo i staging są całkowicie otwarte.**

Gorzej — kierunek jest ODWROTNY do Z28. Zmierzone:
```
$ DATABASE_URL=postgresql://...@127.0.0.1:6199/consultify npx tsx server/scripts/legacy-task-cutover-runner.ts
DATABASE_URL points to local host 127.0.0.1. This project requires the external Postgres target outside tests.
```
(`databaseTargetResolver.ts:139-143`). Runner **odmawia bazy lokalnej** i wprost
żąda „external Postgres target". Uruchomienie lokalne wymaga skłamania o
środowisku (`CI=true` / `NODE_ENV=test` / `VITEST`) — tak zrobił wykonawca i tak
zrobiłem ja. **Ścieżką najmniejszego oporu dla operatora jest wskazanie demo/stagingu.**
To jest realne ryzyko dla etapu 2 i musi być zamknięte KODEM przed pilotem.

## 8. Weryfikacja twierdzeń wykonawcy

| Twierdzenie | Werdykt |
|---|---|
| dry-run 4 zadania, te same reason codes | **POTWIERDZONE** — moje wyjście identyczne z `day204-r3-dry-run.json` |
| limiter mutowany 5/6, przywrócony 6/6 | **POTWIERDZONE** własną mutacją |
| 11/11 testów | **POTWIERDZONE** |
| walidator 92 przed / 92 po | **POTWIERDZONE** |
| „ścisłe A3 daje 0 z 467", `N` = `NOT_PROVEN`, brak `REPLAYED`, brak `listExecutionTasks` | **UCZCIWE** — raport sam deklaruje `STOP MERYTORYCZNY`; nie podnoszę tego jako zarzutu |
| „checksum ponowienia identyczny `9303ae10fb3081ede18eb81b3c2ba42a`" | **NIEUDOKUMENTOWANE** — brak w artefaktach; 32 znaki, a kod liczy sha256 (64). Twierdzenie bez pokrycia |
| brak zrzutu ledgera w artefaktach (8 SKIPPED / unmatched=0) | **BRAK ARTEFAKTU** — liczba wiarygodna, ale niepoparta |

---

## FIX-y (ponumerowane, do pliku i linii)

**FIX-204-1 (BLOKUJĄCY, D-13).** `server/scripts/legacy-task-cutover-runner.ts:166` —
gałąź `initiative_id IS NULL` jest poza limiterem i poza zakresem organizacji.
Dodać do obu zapytań predykat `organization_id = $org` (nowy WYMAGANY parametr
`--organization-id`) oraz objąć zadania osobiste tym samym limitem
(albo wykluczyć je z selektora zupełnie — A5(ii) i tak rekomenduje zostawienie
ich w legacy). Bez tego „pilot" na stagingu dotknie 265 rekordów w N organizacjach.

**FIX-204-2 (BLOKUJĄCY, D-13).** `legacy-task-cutover-runner.ts:82-84` —
dodać flagę `--max-tasks N` (domyślnie 1) egzekwowaną KODEM na liście `plan`
(`:170`), niezależną od limitu inicjatyw. D-13 mówi „pilot 1 rekordu";
dziś najmniejsza możliwa jednostka to cała inicjatywa + wszystkie osobiste.

**FIX-204-3 (BLOKUJĄCY, dowód).** Nowy przypadek realDB w
`tests/integration/day204-legacy-task-cutover-runner.realdb.test.ts` (dziś plik
nie dotyka bazy mimo sufiksu `.realdb`): zasiać 1 zadanie, wywołać ścieżkę zapisu
dwukrotnie, asertować `count(*) = count(DISTINCT legacy_task_id) = 1`.
Bramka przyjęcia: usunięcie `:149-153` **lub** `:204-208` MUSI dać czerwony.
Dziś usunięcie OBU daje 11/11 zielonych. Wymaga wyekstrahowania ciała `main()`
do eksportowanej funkcji przyjmującej `Pool` (dziś logika siedzi w `main()`,
niedostępna dla testu).

**FIX-204-4 (WYSOKI, Z28).** `server/scripts/lib/scriptDatabaseTarget.ts:49-91` —
dodać opcję `allowOnlyLoopback: true` i wywołać ją z runnera
(`legacy-task-cutover-runner.ts:132-137`), wzorem `scripts/dev/day204-m3-shape-seed-local.mjs:9-11`,
który to robi poprawnie. Alternatywnie: rozszerzyć denylist
o odciski demo/staging. Dziś jedynym blokowanym hostem jest produkcja
(`databaseTargetResolver.ts:42`), a baza lokalna jest ODRZUCANA
(`:139-143`) — operator jest wypychany na zdalną bazę.

**FIX-204-5 (WYSOKI, atomowość).** `legacy-task-cutover-runner.ts:238-282` —
`createExecutionTask` i `INSERT` do ledgera muszą lecieć w JEDNEJ transakcji
(albo ledger musi być zapisany PRZED poleceniem, ze statusem `PENDING`
i domknięciem na `MIGRATED`). Dziś crash w luce daje kanoniczne zadanie
bez wiersza rejestru i trwały `aggregate version conflict` bez naprawy do przodu.

**FIX-204-6 (ŚREDNI, obsługa błędu).** `legacy-task-cutover-runner.ts:206` i `:235` —
`throw` w pętli przerywa całą partię i nie zostawia śladu. Opakować per rekord
w `try/catch` i zapisywać `status='FAILED'` + `reason_code` (status jest już
dopuszczony przez `20261721_legacy_task_cutover_ledger.sql:9`, ale nieużywany).

**FIX-204-7 (ŚREDNI, martwy kod).** `server/migrations/20261722_legacy_task_cutover_step_ledger.sql` —
tabela ma tylko konsumenta testowego (`day204-r1-mines.realdb.test.ts:174,182`).
Albo wpiąć ją w runner (naturalny nośnik dla FIX-204-5), albo jawnie oznaczyć
w planie jako przygotowaną pod R2b i niewykorzystaną — dziś to migracja
schematu bez pisarza produkcyjnego.

**FIX-204-8 (NISKI, higiena).** Zmienić nazwę
`tests/integration/day204-legacy-task-cutover-runner.realdb.test.ts` na bez
sufiksu `.realdb` (plik nie woła `assertRealPostgresTestEnvironment()` i nie
otwiera połączenia) — albo domknąć FIX-204-3, który uczyni nazwę prawdziwą.
Sufiks `.realdb` bez strażnika to dokładnie ten kształt fałszywego „gotowe",
który program już raz zapłacił.

**FIX-204-9 (NISKI, raport).** `CODEX_DAY204_MIGRACJA_E2_REPORT.md` — checksum
`9303ae10fb3081ede18eb81b3c2ba42a` nie ma pokrycia w artefaktach i ma 32 znaki
przy sha256 w kodzie (`:91`). Usunąć albo dołożyć artefakt. Podobnie zrzut
ledgera „8 SKIPPED / unmatched=0" wymaga artefaktu.

---

## Uzasadnienie werdyktu

**SCALIĆ PO FIX**, nie NIE SCALAĆ — bo materiał jest realny (runner istnieje,
działa, ma dry-run i podwójne potwierdzenie; migracja jest addytywna i przechodzi
świeżą bazę; 11/11 testów odtworzone; raport sam uczciwie deklaruje `STOP` i
`NOT_PROVEN` zamiast malować sukces), a nic z tego nie jest jeszcze wpięte w
żadną ścieżkę uruchomieniową, więc scalenie samo w sobie nic nie rusza.

**Nie A** — dowód mutacyjny trzyma tylko w jedną stronę: limiter tak,
**idempotencja nie**. Kluczowe pytanie tego odbioru zostało odpowiedzone
w kodzie, ale nie zostało obronione testem.

**BRAMKA PRZED PILOTEM STAGINGOWYM: FIX-204-1..4 muszą być zamknięte.**
Uruchomienie dzisiejszego runnera na stagingu pod hasłem „pilot 1 rekordu"
dotknęłoby 265+ rekordów, a jedyną blokadą przed wskazaniem zdalnej bazy jest
dyscyplina operatora.
