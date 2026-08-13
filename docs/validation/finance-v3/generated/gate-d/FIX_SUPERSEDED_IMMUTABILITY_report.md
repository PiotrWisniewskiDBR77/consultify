# FIX — treść wersji `SUPERSEDED` była swobodnie nadpisywalna

**Data:** 2026-08-10
**Gałąź:** `codex/finance-v3-apwave-fix-superseded` (odbita od `3e693c0872` na
`codex/finance-v3-apwave-fix-transition`; zamrożona
`codex/finance-v3-closeout-fanin` @ `19b4b06934` NIE była scalana, modyfikowana
ani pushowana)
**Worktree:** `/Users/piotrwisniewski/consultify-wt/apwave-fix-superseded`
**Commity:** `1fdc731767` (migracja), `ac74d665c0` (testy), `<ten raport>`

---

## 1. Wniosek

Luka **potwierdzona eksperymentalnie, zamknięta, przypięta 13 testami na
realnym PostgreSQL i zweryfikowana kontrolą negatywną**. Regresja czysta wobec
punktu odniesienia (344 → 357 = 344 + 13 nowych; **żaden preegzystujący test
się nie zaczerwienił**), więc **żaden legalny pisarz nie został zablokowany**.

Naprawa **nie wymagała ani jednego nowego wyjątku** na liście dozwolonych
kolumn — okazało się, że lista potrzebna dla `SUPERSEDED` jest dokładnie ta
sama, która działa już dla `ARCHIVED`/`INVALIDATED`. To jest główny wynik
analizy promienia rażenia z §3: obawa ze zlecenia („szeroka lista wyjątków
podważająca sens ochrony") **się nie zmaterializowała**, i to zostało
zmierzone, nie założone.

Zakres luki był większy, niż zapowiadało zgłoszenie: oprócz treści dało się też
**wskrzesić** wiersz `SUPERSEDED` z powrotem do `DRAFT`.

---

## 2. Dowód „czerwony przed"

Środowisko: własny efemeryczny klaster PostgreSQL 15, `initdb --locale=C`,
`LC_ALL=C` przy `initdb` i `pg_ctl start`, katalog danych
`/private/tmp/apwave-sup-pgdata` (poza repo), port **57733** (zakres
55000–59999, wolność sprawdzona `lsof` przed użyciem; nigdy 5432/28711/52824),
`listen_addresses=127.0.0.1`. Pełny zestaw migracji przez
`server/scripts/migrate.postgres.ts`, exit 0. Nie dotknięto współdzielonej
instancji Homebrew ani żadnego hosta demo/staging/prod.

Scenariusz: wersja doprowadzona do `SUPERSEDED` **realną ścieżką** — nie
ręcznym `UPDATE ... SET status='SUPERSEDED'`, tylko:
`createArtifact` → T2 `submit_for_review` → T4 `start_review` →
`approveVersion` (v1 = APPROVED) → `reopenVersion` (v2 = DRAFT, dziecko v1) →
T2/T4 na v2 → `approveVersion(v2)`, którego krok (b) **jest** T9
supersede-rodzica.

```
v1 approved: status=APPROVED version=4

=== v1 AFTER approving v2: status=SUPERSEDED version=4
    superseded_by=16b7500c-… superseded_at=set
=== v1 content BEFORE tamper: content_semantic_hash=null
    compute_snapshot_id=36123133-… source_working_revision_id=ccbc6dc8-…
=== donor v2: compute_snapshot_id=b9456661-… source_working_revision_id=7867b540-…

--- content_semantic_hash      : UPDATE ACCEPTED (changes=1) -> read-back = TAMPERED-SUPERSEDED-HASH
--- compute_snapshot_id        : UPDATE ACCEPTED (changes=1) -> read-back = b9456661-…
--- source_working_revision_id : UPDATE ACCEPTED (changes=1) -> read-back = 7867b540-…
--- status resurrection        : ACCEPTED (changes=1) -> status=DRAFT
--- LEGAL WRITE ok (changes=1): SET freshness='STALE_SOURCE', freshness_reason=…, stale_since=now()
--- LEGAL WRITE ok (changes=1): SET result_quality='PROVISIONAL' … AND status <> 'APPROVED'
```

Wszystkie trzy pola merytoryczne nadpisane, każde osobno, każde potwierdzone
**odczytem zwrotnym**, nie samym „UPDATE poszedł".

### 2.1 Pułapka, w którą wpadłem i którą zgłaszam

**Pierwsze podejście dało fałszywy dowód OCHRONY, której nie ma.** Nadpisywałem
`compute_snapshot_id`/`source_working_revision_id` losowym UUID-em i dostałem:

```
--- compute_snapshot_id        : REJECTED code=23503 … violates foreign key constraint "fk_finance_bv_compute_snapshot"
--- source_working_revision_id : REJECTED code=23503 … violates foreign key constraint "fk_finance_bv_source_wr"
```

To **nie jest** wyzwalacz niezmienności — to klucz obcy odrzucający nieistniejące
id. Gdybym na tym poprzestał, zaraportowałbym „2 z 3 pól są chronione", co jest
nieprawdą. Poprawka: wartości-dawcy brane z **realnej wersji siostrzanej** (v2),
więc są FK-poprawne i odrzucić je może **wyłącznie** wyzwalacz. Ta sama zasada
jest wpisana na stałe w nagłówek pliku testowego, żeby nikt jej nie cofnął.

### 2.2 Mechanizm

`finance_bv_enforce_immutability()`
(`server/migrations/20260809_finance_v3_b01_core_artifacts.sql:231`) strzegła
treści **wyłącznie** pod `IF TG_OP = 'UPDATE' AND OLD.status = 'APPROVED'`.
Migracja `20260823_finance_v3_bv_terminal_immutability.sql` dołożyła drugą
gałąź dla `OLD.status IN ('ARCHIVED','INVALIDATED')` i **świadomie zostawiła
`SUPERSEDED`**, zgłaszając to jako osobne znalezisko (§9 pkt 1 raportu
`FIX_TRANSITION_TERMINAL_ACTIONS_report.md`). Wiersz `SUPERSEDED` wypadał więc
z obu warunków — nie chroniło go nic.

Różnica wagi wobec tamtej naprawy: `ARCHIVED`/`INVALIDATED` były do 08-10
nieosiągalne (T10/T11 były martwe). `SUPERSEDED` jest osiągany **przy każdym
zatwierdzeniu następcy**, więc dotyczyło to treści **każdej wersji kiedykolwiek
wypartej przez nowszą** w całej historii systemu.

---

## 3. Promień rażenia — kto legalnie pisze do wiersza `SUPERSEDED`

To był rdzeń zadania, więc poniżej pełny przemiał, nie próbka. Przeszukane:
`server/src`, `server/scripts`, `server/migrations` — **każde** trafienie
sprawdzone wobec własnej klauzuli `WHERE`, a nie wobec samej nazwy tabeli.

### 3.1 Pisarze, którzy MOGĄ trafić w wiersz SUPERSEDED → kolumny dozwolone

| Kolumna | Kto pisze | Uzasadnienie |
|---|---|---|
| `result_quality` | wyzwalacz d01c, `20260810_finance_v3_d01c_real_company_integrity_fix.sql:288` — `UPDATE … SET result_quality = … WHERE business_version_id = NEW.business_version_id AND status <> 'APPROVED'` | Filtr `status <> 'APPROVED'` celuje w wiersze nie-zatwierdzone, więc **SUPERSEDED jest jednym z jego celów**. Zablokowanie = wysadzenie wyzwalacza rekoncyliacji zysków zatrzymanych. To etykieta jakości danych, nigdy treść finansowa. Już dozwolona dla ARCHIVED/INVALIDATED od 08-23 z tego samego powodu. |
| `freshness`, `freshness_reason`, `stale_since` | strumień propagacji świeżości | Wyparta wersja nadal musi dać się oznaczyć jako nieaktualna, gdy jej źródło zostanie zrestatowane. Dozwolone dla APPROVED od b01 i dla ARCHIVED/INVALIDATED od 08-23; odmówienie tego akurat SUPERSEDED zrobiłoby z niego bezpodstawny wyjątek. **Uczciwie:** dziś nie znalazłem produkcyjnego pisarza tych trzech kolumn — piszą je testy i (docelowo) propagacja; kanał zostaje otwarty, bo b01/08-23 tak go zaprojektowały, a zamknięcie go byłoby zmianą zachowania przemyconą przy okazji bugfixu. Zlecenie wskazywało `lineageFreshnessService.ts` jako podejrzanego — **taki plik nie istnieje w tym drzewie**; propagacja świeżości mieszka w `20260809_finance_v3_b03_lineage_freshness.sql` i pisze do własnej, dopisywalnej tabeli `finance_lineage_freshness_events`, a nie do `finance_business_versions`. |
| `updated_at` | sam wyzwalacz (`NEW.updated_at := now()`) | Musi zostać dozwolone, inaczej funkcja odrzuca własny zapis. |

### 3.2 Pisarze, którzy NIE dotykają wiersza SUPERSEDED — sprawdzone, nie założone

| Miejsce | Dlaczego nie dotyczy |
|---|---|
| `artifactVersionService.transition()` :331 | żadne przejście w `TRANSITIONS` nie ma `from: SUPERSEDED`; dodatkowo `UPDATE` niesie `AND status = <current.status>` |
| `approveVersion()` T9 supersede-rodzica :754 | `WHERE … AND status = 'APPROVED'` → `OLD.status = APPROVED`, więc trafia w gałąź APPROVED, **nietkniętą** tą zmianą |
| `approveVersion()` przełączenie statusu :763 | wiersz jest `IN_REVIEW` |
| `createArtifact()` :211, `reopenVersion()` :1034 (`source_working_revision_id`) | świeżo wstawiony wiersz `DRAFT` |
| `statementReconciliationService.ts:789` | `AND status = 'DRAFT'` |
| `server/scripts/finance-v3-backfill-dry-run.ts:314` | `WHERE … status NOT IN ('SUPERSEDED','ARCHIVED','INVALIDATED')` — **sam z siebie odmawia** przepisania już wypartego wiersza |
| `server/src/services/demo/atelierFinanceSeed.ts` | 0 wystąpień `finance_business_versions` (rusza wyłącznie stare tabele `financial_*`); jego dynamiczny `UPDATE ${table}` chodzi po `WHERE id = ?`, a ta tabela ma `business_version_id` |
| pozostałe 2 wyzwalacze na tabeli (`trg_finance_bv_mark_advisor_stale_on_recompute`, `trg_finance_bv_freeze_advisor_on_approval`) | oba `AFTER`, oba piszą tabele doradcy wyceny, nie tę |
| trasy HTTP `server/src/routes/v8/finance-v2/` | zero surowych `UPDATE finance_business_versions` |

Lista wyliczona z `pg_trigger` na żywym schemacie (4 wyzwalacze), nie z samej
lektury migracji.

### 3.3 Wniosek z analizy

Zbiór kolumn wymaganych dla `SUPERSEDED` **=** zbiór już obowiązujący dla
`ARCHIVED`/`INVALIDATED`. Nie trzeba było niczego rozszerzać. Dlatego zamiast
kopiować gałąź, **poszerzyłem strażnika z 08-23** z literału dwóch statusów na
pełny zbiór terminalny, lustrzany 1:1 wobec
`lifecycleService.TERMINAL_STATUSES = ['SUPERSEDED','ARCHIVED','INVALIDATED']`.
Jedno miejsce do nauczenia się, jeśli kiedyś powstanie przejście wychodzące ze
statusu terminalnego.

Zamrożenie statusu jest uprawnione: `SUPERSEDED` jest w `TERMINAL_STATUSES` i
**nie ma żadnego przejścia wychodzącego** w `TRANSITIONS`, a jedyny skrypt,
który mógłby chcieć taki wiersz ruszyć (backfill), już go pomija.

---

## 4. Naprawa

**Migracja addytywna:** `server/migrations/20260824_finance_v3_bv_superseded_immutability.sql`
— wyłącznie `CREATE OR REPLACE FUNCTION finance_bv_enforce_immutability()`.
Żadna tabela/kolumna/indeks/wyzwalacz nie ruszona; `20260809_…_b01_…` **i**
`20260823_…_terminal_immutability` pozostają bajt-w-bajt nietknięte; nazwa bez
słowa „seed"; brak SQLite-owego `DATETIME`; sortuje się po `20260823_*` (faza 1
runnera = sort kalendarzowy, `20260824` > `20260823`); ponowne uruchomienie
idempotentne. Gałąź `APPROVED` przeniesiona verbatim. Idiom, konwencja
komunikatów i lista dozwolonych — identyczne jak w migracji terminalnej.

Zmiana merytoryczna, w całości:

```sql
  terminal_statuses TEXT[] := ARRAY['SUPERSEDED', 'ARCHIVED', 'INVALIDATED'];
  …
- IF TG_OP = 'UPDATE' AND OLD.status IN ('ARCHIVED', 'INVALIDATED') THEN
+ IF TG_OP = 'UPDATE' AND OLD.status = ANY(terminal_statuses) THEN
```

Po naprawie ten sam prób co w §2:

```
--- content_semantic_hash      : REJECTED code=P0001 … is SUPERSEDED; its contents are frozen, only freshness/result_quality metadata may change
--- compute_snapshot_id        : REJECTED code=P0001 … (jw.)
--- source_working_revision_id : REJECTED code=P0001 … (jw.)
--- status resurrection        : REJECTED code=P0001 … is SUPERSEDED (terminal); no further status transition is allowed
--- LEGAL WRITE ok (changes=1): freshness/freshness_reason/stale_since
--- LEGAL WRITE ok (changes=1): result_quality … AND status <> 'APPROVED'
```

**Zero zmian w `artifactVersionService.ts`** — allowlista zlecenia dopuszczała
edycję warunkowo, testy wykazały, że nie jest potrzebna.

---

## 5. Testy na realnym PostgreSQL

Nowy plik: `server/src/services/finance/canonical/__tests__/artifactVersionSupersededImmutability.pg.test.ts`
(13 testów). Każdy wiersz `SUPERSEDED` produkowany **realną ścieżką** (reopen +
approve następcy), nigdy ręcznym `UPDATE … SET status='SUPERSEDED'`. Każdy
zapis dowodzony fizycznie (`changes` **oraz** niezależny odczyt zwrotny przez
`getBusinessVersion`). `content_semantic_hash` jest stemplowany realną wartością
jeszcze na wierszu `DRAFT`, żeby asercja „treść przetrwała" nie porównywała
NULL do NULL (co przeszłoby niezależnie od tego, czy wyzwalacz działa).

**Bramka zweryfikowana:** bez `RUN_DB_TESTS=1` **i** `MOCK_DB=false` plik
raportuje `13 skipped`, nie zielone zero.

**Dowód, że przebieg naprawdę dotknął bazy** (nie tylko „zielono") —
zapytania po zakończeniu, po organizacjach testowych tego pliku:

```
   status   | count            action       | count
------------+-------      -------------------+-------
 APPROVED   |    26       APPROVE            |    39
 DRAFT      |    12       CREATE             |    26
 SUPERSEDED |    13       REOPEN             |    25
                          START_REVIEW       |    39
                          SUBMIT_FOR_REVIEW  |    39
```

| # | Test | Wynik |
|---|---|---|
| 5.1 | zatwierdzenie następcy superseduje rodzica; `superseded_by_version_id`/`superseded_at` ustawione, a treść rodzica (`content_semantic_hash`, `compute_snapshot_id`, `source_working_revision_id`, `version`) **bajt w bajt** jak przed | PASS |
| 5.2 | łańcuch v1→v2→v3: v2 też się superseduje, a **już wyparte** v1 zostaje nietknięte | PASS |
| 5.3 | nadpisanie `content_semantic_hash` na SUPERSEDED odrzucone (wartość FK-poprawna) | PASS |
| 5.4 | nadpisanie `compute_snapshot_id` na SUPERSEDED odrzucone (dawca = v2, FK-poprawny) | PASS |
| 5.5 | nadpisanie `source_working_revision_id` na SUPERSEDED odrzucone (dawca = v2) | PASS |
| 5.6 | brak wskrzeszenia: `status` → `DRAFT` / `APPROVED` / `ARCHIVED` odrzucone | PASS ×3 |
| 5.7 | nie da się przepisać zapisu, **dlaczego** wersja została wyparta (`superseded_by_version_id`) | PASS |
| 5.8 | pierwotny niezmiennik b01 na wierszu **APPROVED** nadal działa, z niezmienionym komunikatem (brak dryfu) | PASS |
| **5.9** | **LEGALNY:** propagacja świeżości nadal oznacza SUPERSEDED jako `STALE_SOURCE` (`changes=1` + odczyt zwrotny) | PASS |
| **5.10** | **LEGALNY:** wzorzec zapisu wyzwalacza d01c (`SET result_quality … WHERE … AND status <> 'APPROVED'`) nadal ląduje (`changes=1` + odczyt zwrotny) | PASS |
| **5.11** | **LEGALNY:** wzorzec skryptu backfill (`… status NOT IN (…)`) nadal trafia **0 wierszy zamiast rzucać** | PASS |

```
Test Files  1 passed (1)
      Tests  13 passed (13)
```

Testy 5.9–5.11 są najważniejsze w tym pliku: to one, a nie odrzucenia,
dowodzą, że zaostrzenie statusu leżącego na gorącej ścieżce niczego nie zepsuło.

---

## 6. Kontrola negatywna

Ciało funkcji cofnięte w żywej bazie do wersji z 08-23 (`psql -f
20260823_finance_v3_bv_terminal_immutability.sql`), kod i pliki nietknięte:

```
× rejects rewriting content_semantic_hash on a SUPERSEDED version …
× rejects rewriting compute_snapshot_id on a SUPERSEDED version …
× rejects rewriting source_working_revision_id on a SUPERSEDED version …
× refuses to resurrect a SUPERSEDED version into DRAFT …
× refuses to resurrect a SUPERSEDED version into APPROVED …
× refuses to resurrect a SUPERSEDED version into ARCHIVED …
× refuses to rewrite the record of WHY the version was retired

Tests  7 failed | 6 passed (13)
```

Czerwienieje **dokładnie 7 testów niezmienności i ani jeden więcej**. Zielone
zostaje **całe 6 testów ścieżki supersede i legalnych pisarzy** — co dowodzi
dwóch rzeczy naraz: (a) to migracja niesie asercje niezmienności, (b) testy
legalnych pisarzy **nie są przypadkowo sprzężone** z naprawą, więc ich zieleń w
§5 jest niezależnym dowodem, a nie tautologią.

**Przywrócenie:** migracja zaaplikowana ponownie, `git diff` **pusty**, `git
status --porcelain` **pusty**, komplet 13 testów znów zielony.

---

## 7. Regresja

Punkt odniesienia zmierzony **przed** jakąkolwiek zmianą, na tej samej,
w pełni zmigrowanej bazie.

| Zakres | Przed | Po |
|---|---|---|
| `server/src/services/finance/canonical/__tests__/` (cały katalog) | **24 pliki / 344 PASS**, 0 skipped | **25 plików / 357 PASS**, 0 skipped |
| różnica | — | +1 plik / +13 testów = dokładnie mój nowy plik |
| **testy preegzystujące, które się zaczerwieniły** | — | **0** |
| `npx tsc --noEmit -p server/tsconfig.json` | — | **exit 0**, log pusty |
| pełny zestaw migracji na **świeżej** bazie (`finance_v3_sup_fresh`) | — | **exit 0**, 632 migracje, nowe ciało funkcji obecne w `pg_proc` |
| katalog canonical na tej świeżej bazie | — | **25 plików / 357 PASS** |

344 + 13 = 357 co do jednego. To jest dowód wprost, że **żaden legalny pisarz
nie został zablokowany** — gdyby zaostrzenie trafiło w działającą ścieżkę,
zaczerwieniłby się któryś z 344 testów bazowych.

Punkt odniesienia zgadza się z liczbą podaną w zleceniu (344 PASS / 24 pliki /
0 skipped) — nie ma rozbieżności do zgłoszenia.

---

## 8. Zmienione pliki

| Plik | Zmiana |
|---|---|
| `server/migrations/20260824_finance_v3_bv_superseded_immutability.sql` | **nowy**, addytywny — `CREATE OR REPLACE FUNCTION` z poszerzonym strażnikiem terminalnym |
| `server/src/services/finance/canonical/__tests__/artifactVersionSupersededImmutability.pg.test.ts` | **nowy** — 13 testów na realnym PostgreSQL |
| `docs/validation/finance-v3/generated/gate-d/FIX_SUPERSEDED_IMMUTABILITY_report.md` | **nowy** — ten raport |

Nic poza allowlistą nie zostało ruszone; `artifactVersionService.ts`
**nietknięty**. Żadna już zaaplikowana migracja nie została zmodyfikowana. Brak
pushu, brak scalenia z zamrożoną gałęzią, brak kontaktu z żywą bazą.

---

## 9. Znaleziska do osobnego rozpatrzenia

1. **Kanał świeżości na `finance_business_versions` nie ma dziś produkcyjnego
   pisarza.** `freshness`/`freshness_reason`/`stale_since` są allow-listowane
   w b01, w 08-23 i tutaj jako „strumień propagacji świeżości", ale w
   `server/src` piszą je wyłącznie testy. Propagacja z B03 dopisuje do
   `finance_lineage_freshness_events` i nie domyka pętli do kolumn na wersji.
   Albo ten kanał jest niedokończony, albo kolumny są martwe — warto
   rozstrzygnąć, bo dziś podpierają trzy pozycje na liście wyjątków.
2. **Znalezisko §9 pkt 1 poprzedniego raportu jest zamknięte** tą zmianą.
   Pozostają otwarte jego pkt 2 (T10/T11 bez wystawienia HTTP) i pkt 3 (klasa
   defektu: przejścia cyklu życia pokryte wyłącznie testami jednostkowymi nad
   funkcjami z założenia nieświadomymi SQL-a).
3. **Envelope terminalny jest teraz kompletny** — po tej zmianie żaden ze
   statusów w `TERMINAL_STATUSES` nie ma już luki niezmienności. Jeśli
   kiedykolwiek powstanie przejście wychodzące ze statusu terminalnego,
   `terminal_statuses` w tej funkcji jest jedynym miejscem do zmiany.

---

## 10. Reprodukcja

```bash
PORT=57733   # sprawdź lsof -i:$PORT; nigdy 5432/28711/52824
export LC_ALL=C
PGBIN=/opt/homebrew/opt/postgresql@15/bin      # @15, NIE @16
$PGBIN/initdb --locale=C -E UTF8 -D /private/tmp/apwave-sup-pgdata -U postgres
$PGBIN/pg_ctl -D /private/tmp/apwave-sup-pgdata \
  -o "-p $PORT -h 127.0.0.1 -k /private/tmp" -l /private/tmp/apwave-sup-pg.log start
$PGBIN/createdb -h 127.0.0.1 -p $PORT -U postgres finance_v3_sup

DB_TYPE=postgres NODE_ENV=test \
  DATABASE_URL=postgresql://postgres@127.0.0.1:$PORT/finance_v3_sup \
  npx tsx server/scripts/migrate.postgres.ts

cd server && DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
  DATABASE_URL=postgresql://postgres@127.0.0.1:$PORT/finance_v3_sup \
  npx vitest run --config vitest.config.ts \
    src/services/finance/canonical/__tests__/ --no-file-parallelism

# kontrola negatywna: cofnij ciało funkcji do wersji z 08-23
$PGBIN/psql -h 127.0.0.1 -p $PORT -U postgres -d finance_v3_sup \
  -f server/migrations/20260823_finance_v3_bv_terminal_immutability.sql
# …ponów testy (7 czerwonych) i przywróć:
$PGBIN/psql -h 127.0.0.1 -p $PORT -U postgres -d finance_v3_sup \
  -f server/migrations/20260824_finance_v3_bv_superseded_immutability.sql

$PGBIN/pg_ctl -D /private/tmp/apwave-sup-pgdata -m fast stop
rm -rf /private/tmp/apwave-sup-pgdata
```

Sprzątanie wykonane: `pg_ctl -m fast stop` + `rm -rf` katalogu danych na końcu
sesji; `ps aux` potwierdziło, że współdzielona instancja Homebrew pozostała
nietknięta.
