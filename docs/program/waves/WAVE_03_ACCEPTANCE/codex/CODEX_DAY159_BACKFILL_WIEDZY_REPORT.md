# CODEX DAY 159 — backfill znaczników organizacji i kwarantanna

Data: 2026-08-30

Gałąź: `codex/day159-backfill-wiedzy-20260830`

Marker: `43322a8b31`

Werdykt wykonawcy: **GOTOWE DO ODBIORU, BEZ PUSHU**

## Stan wejściowy

Instrukcja została odczytana w całości z
`/private/tmp/cx-day159-backfill-wiedzy-scratch/INSTRUKCJA_DYZUR_159.md`.
Zastosowałem `§0.1-BIS`; pominąłem kroki `(1), (3), (4), (5), (6)` z `§0.1`.

```text
$ git merge-base --is-ancestor 43322a8b31 HEAD && echo "BAZA OK" || echo "MARKER BRAK — STOP"
BAZA OK
$ git status --short
<pusto>
$ git branch --show-current
codex/day159-backfill-wiedzy-20260830
$ ls -la node_modules
lrwxr-xr-x@ 1 piotrwisniewski wheel 56 Aug 30 12:31 node_modules -> /Users/piotrwisniewski/Developer/Consultify/node_modules
$ df -h /
Filesystem        Size    Used   Avail Capacity iused ifree %iused Mounted on
/dev/disk3s1s1   1.8Ti    12Gi    23Gi    34%    459k  245M    0% /
$ git rev-parse HEAD
43322a8b31e57bbf10f52b8656cec2712d1bac45
$ git status --short | head -3
<pusto>
```

Porty `6046`, `4986`, `4987`: brak listenerów. Kontener `cx-day159-pg` nie
istniał przed startem. Uruchomiono wyłącznie
`pgvector/pgvector:pg16` na `127.0.0.1:6046`, baza `cx159`.

Obowiązkowe pomiary T1–T4 z instrukcji:

```text
$ grep -rn "organization_id" server/migrations-v2/001_baseline_20260413.sql 2>/dev/null | grep -i chunk | head -3
server/migrations-v2/001_baseline_20260413.sql:64544:CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_org ON public.knowledge_chunks USING btree (organization_id);
$ grep -rhoE "CREATE TABLE (IF NOT EXISTS )?knowledge_chunks" server/migrations*/*.sql | head -2
CREATE TABLE IF NOT EXISTS knowledge_chunks
CREATE TABLE IF NOT EXISTS knowledge_chunks
$ grep -rn "doc_id\|document_id" server/migrations*/*.sql | grep -i "knowledge_chunks" | head -5
server/migrations-archive/000_initdb_core_tables.sql:2353:        CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_doc ON knowledge_chunks(doc_id);
server/migrations-archive/031_performance_indexes.sql:184:ON knowledge_chunks(doc_id);
server/migrations-archive/266_knowledge_rag.sql:141:CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_doc ON knowledge_chunks(document_id);
server/migrations-v2/001_baseline_20260413.sql:64530:CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_doc ON public.knowledge_chunks USING btree (document_id);
server/migrations-v2/001_baseline_20260413.sql:81477:-- Name: knowledge_chunks knowledge_chunks_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
$ grep -rn "knowledge_chunks" server/src --include='*.ts' | grep -v __tests__ | head -6
server/src/database/conflictTargets.ts:104:  knowledge_chunks: ['id'],
server/src/database/DatabaseInitializer.ts:182:  'knowledge_chunks',
server/src/database/PostgresDatabase.ts:1825:    await query(`CREATE TABLE IF NOT EXISTS knowledge_chunks(
server/src/database/PostgresDatabase.ts:1835:      if (!(await columnExists('knowledge_chunks', col))) {
server/src/database/PostgresDatabase.ts:1836:        await query(`ALTER TABLE knowledge_chunks ADD COLUMN ${ddl}`);
server/src/database/PostgresDatabase.ts:3827:    if (await columnExists('knowledge_chunks', 'document_id')) {
$ grep -c "filterDocumentsByVisibility" server/src/services/ai/documentGovernance.ts
3
```

Pełny pierwszy przebieg migracji zakończył się `✅ Postgres migrations complete`.
Drugi przebieg: `Applying migrations: 0`, `✅ Postgres migrations complete`.

## Korekty wobec instrukcji

1. `§0.1-BIS`: „kolumna docelowa ... JUŻ ISTNIEJE”. Pomiar po pełnych
   migracjach markera przez `information_schema.columns` pokazał 10 kolumn:
   `id, doc_id, content, chunk_index, embedding, scope, is_active, document_id,
   section_title, metadata`; `organization_id` nie istniała. Obowiązkowy grep
   T1 pokazał indeks, nie definicję kolumny. Bezpieczna korekta: przybita
   migracja używa addytywnego
   `ALTER TABLE ... ADD COLUMN IF NOT EXISTS organization_id TEXT`.
2. R1 wymienia `project_id` fragmentu „jeśli obecny”. Na realnym schemacie
   markera nie jest obecny, dlatego pokrycie tej ścieżki wynosi uczciwie 0/10.
3. T3 z `head -6` nie dociera do konsumentów. Pełny pomiar znalazł odczyt w
   `ContextRetrievalService.ts:309-313` i `ragService.ts:485-486,573-574,
   802-803,988-989`.
4. `Z24` odsyła do nieistniejącego `§0.4a`; zgodnie z `§0.1-BIS` odwołanie
   pominięto. Zasięg dowodowy jest opisany nazwami wszystkich przypadków.
5. Filtr kwarantanny nie został wpięty w żywą ścieżkę. Pełny grep
   `org_quarantined|listEligibleChunks` wskazuje wyłącznie nowy serwis i test.
   To zamierzona granica tego dyżuru, nie twierdzenie o ochronie rozmowy już dziś.

## R1 — pokrycie źródeł na własnej fixturze

Zasiano 10 fragmentów: stare dowiązanie, nowe dowiązanie, oba zgodne,
metadata, konflikt, sierota, dokument bez organizacji i jeden fragment wcześniej
oznaczony. Pokrycie oznacza obecność niepustego kandydata z danej ścieżki;
konflikt jest poprawnie liczony w obu ścieżkach, ale nie jest backfillowany.

| Ścieżka | Pokrycie | Procent |
|---|---:|---:|
| `doc_id -> knowledge_docs.organization_id` | 4/10 | 40% |
| `document_id -> knowledge_docs.organization_id` | 4/10 | 40% |
| `knowledge_chunks.project_id` | 0/10 | 0% — kolumny brak |
| `metadata.organization_id` | 1/10 | 10% |
| unia, dokładnie jedna różna organizacja, przy `organization_id IS NULL` | 6/10 | 60% |

Podstawą R2 jest unia fail-closed: ustawienie następuje tylko wtedy, gdy zbiór
różnych kandydatów ma dokładnie jeden element. Nie ma arbitralnego priorytetu,
który ukryłby konflikt między `doc_id` i `document_id`.

## R2 — backfill i odwracalność

Bezpośredni rehearsal przybitej migracji na danych zasianych przed jej
uruchomieniem:

```text
PRZED: total=10, missing=9, pretagged=1
Applying migrations: 1
→ 20260830_day159_chunk_org_backfill.sql
✅ Postgres migrations complete
PO: total=10, missing=3, backfilled=6, quarantined=3, pretagged_preserved=1

org_backfill_source:
doc_id=2
document_id=2
doc_id+document_id=1
metadata.organization_id=1

ROLLBACK: rolled_back=6
PO ROLLBACKU: total=10, missing_after_rollback=9, pretagged_after_rollback=1
```

Rollback dotyka wyłącznie wierszy z jednoczesnym
`org_backfilled_at IS NOT NULL` i `org_backfill_source IS NOT NULL`. Wcześniej
oznaczony fragment zachował organizację.

## R3 — kwarantanna bez kasowania

Po backfillu: 6 odtworzonych, 3 kwarantannowane, 1 wcześniej oznaczony.
Powody kwarantanny: `no_organization_candidate=2`,
`conflicting_organization_candidates=1`. `COUNT(*)` pozostał równy 10.
Serwis loguje:

```text
[ChunkOrgBackfill] completed {"backfilled":6,"quarantined":3}
```

`listEligibleChunks` demonstruje zapytanie wykluczające
`org_quarantined=TRUE`, ale nie ma jeszcze konsumenta w żywym wyszukiwaniu.
Nie usunięto żadnego fragmentu.

## R4 — koszt przyszłego zamknięcia filtru

Na własnej fixturze 3/10 = 30% fragmentów wypadłoby z puli kandydatów.
Spośród 6 dokumentów mających dowiązane fragmenty 3/6 = 50% byłoby
efektywnie niemych (wszystkie ich dowiązane fragmenty są w kwarantannie).

Mechaniczna ekstrapolacja własnych 30% na tło `26 177` daje około `7 853`
fragmentów. Osobno, tło nadzorcy 70% odpowiada około `18 324`; nie jest to
pomiar tego dyżuru ani odczyt żywej bazy.

Rekomendacja dla następnego dyżuru: przed zamknięciem filtru zmierzyć na
kontrolowanej kopii realny udział kwarantanny i dokumentów niemych, a następnie
fail-closed wpiąć `organization_id + org_quarantined=FALSE` w oba konsumenty;
nie używać proporcji fixtury jako prognozy produkcyjnej.

## W-A / W-C — czerwony i zielony przebieg tej samej komendy

Oba przebiegi użyły zewnętrznego configu bez `DB_TYPE='sqlite'`, z katalogu
`server/`, pełnym inline env, `DATABASE_URL` do `127.0.0.1:6046/cx159` oraz
`--retry=0`.

```text
RED (marker produkcyjny + nowy kontrakt, przed implementacją):
success=false, numTotalTests=3, numFailedTests=3,
numPassedTests=0, numPendingTests=0
Wszystkie trzy nazwy failed z powodu braku chunkOrgBackfillService.js.

GREEN (po implementacji, finalny zakres czterech przypadków):
success=true, numTotalTests=4, numFailedTests=0,
numPassedTests=4, numPendingTests=0
```

Pełne nazwy finalne:

```text
PASS measures doc_id and document_id separately, including the absent project_id path
PASS backfills only unique answers, quarantines unresolved rows, and deletes nothing
PASS measures the quarantined candidate share and effectively silent parent documents
PASS rolls back exactly rows marked as backfilled and preserves the pretagged row
```

W-A dotyczy R1–R3: kontrakt był czerwony przed powstaniem serwisu i zielony po
implementacji. R4 jest pozycją pomiarową; sztuczna mutacja kodu nie ma do niej
zastosowania.

## Pułapki (a)–(e) dla pakietu `day159.*`

- (a) `ENABLE_V8_GLOBAL=true` ustawione inline; pakiet nie montuje Gateway ani
  trasy, więc 404 nie jest możliwym źródłem zieleni.
- (b) `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` ustawione inline;
  middleware nie leży na bezpośredniej ścieżce serwisu.
- (c) użyto `/private/tmp/cx-day159-backfill-wiedzy-scratch/vitest.day159.config.ts`,
  który nie przypina `DB_TYPE`; pierwszy hook asertuje
  `process.env.DB_TYPE === 'postgres'`, nazwę bazy `cx159`, URL `:6046` i
  `inet_server_port()=5432` wewnątrz kontenera.
- (d) `ENABLE_TEST_AUTH_BYPASS=false` ustawione inline; pakiet nie twierdzi, że
  mierzy uwierzytelnienie ani HTTP.
- (e) oba dowiązania zmierzono osobno: 4/10 i 4/10. Konflikt nie został
  rozstrzygnięty priorytetem, tylko skwarantannowany.

## Z30 — zero wysyłki

```text
$ env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL|ENABLE_LIVE_EMAIL)" || echo "BRAK ZMIENNYCH POCZTY"
BRAK ZMIENNYCH POCZTY
$ docker exec cx-day159-pg psql -U postgres -d cx159 -c "SELECT key, left(coalesce(value,''),8) FROM settings WHERE key LIKE 'smtp%';"
(0 rows)
$ grep -n "startNotificationOutboxDrainCron\|outboxWorker\|platformOutboxDrainCron" server/src/Gateway.ts
<0 trafień>
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani
żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało
wysłane.

## W-D — granica rozłączności

```text
$ git diff --name-only 43322a8b31..HEAD
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY159_BACKFILL_WIEDZY_REPORT.md
server/migrations/20260830_day159_chunk_org_backfill.sql
server/src/services/ai/__tests__/day159.chunkOrgBackfill.pg.test.ts
server/src/services/ai/chunkOrgBackfillService.ts
```

Wszystkie cztery pliki są w tabeli licencji. `AIPipeline.ts`,
`ContextRetrievalService.ts`, `ragService.ts` i `documentGovernance.ts` nie są
zmienione. Filtr wyszukiwania pozostaje otwarty.

Commity lokalne przed raportem:

```text
806b27bf31 feat(day159): add chunk organization backfill quarantine
bf053bd111 test(day159): prove backfill quarantine on real postgres
```

Nie wykonano pushu.

## Artefakty poza repo

| Artefakt | SHA-256 |
|---|---|
| `/private/tmp/cx-day159-backfill-wiedzy-artefakty/day159-red.json` | `9d306085dd72d3fa70f7e172a39ca98269ba1da07926ab243cbde32387f3de1a` |
| `/private/tmp/cx-day159-backfill-wiedzy-artefakty/day159-final-clean.json` | `94653ba151607f525f114b955ba4391d2c8185fc9241a7f22ca87550a51d88ef` |
| `/private/tmp/cx-day159-backfill-wiedzy-artefakty/day159-final-verbose.log` | `2e3976fe5399d77be19a2f7cf2a8b5d1c82e28e84775dd60754027c12bcc01a6` |
| `/private/tmp/cx-day159-backfill-wiedzy-artefakty/day159-migration-before.log` | `dbedf20deb3e684b31fec06852a6874154a9cb7e0dd66f55cb17709a2ae70636` |
| `/private/tmp/cx-day159-backfill-wiedzy-artefakty/day159-migration-apply.log` | `e1de1f34f85d71d880e59d2f29bb863abe18e64a3f12f8377500961eb54d0594` |
| `/private/tmp/cx-day159-backfill-wiedzy-artefakty/day159-migration-after-rollback.log` | `e543a953211649c05b63c59d920f3ab09ec1ec06c02717e733c2d27aebeee97e` |
| `/private/tmp/cx-day159-backfill-wiedzy-artefakty/migrate-first.log` | `7a3a4008e24adbe7fd6efbca3967a0e2401fd673be045678088ef0958d211350` |
| `/private/tmp/cx-day159-backfill-wiedzy-artefakty/migrate-second.log` | `da5bd3e38bc3784be28d4de1bf8e012612e50c208b2afc13acffda45192c9e09` |
| `/private/tmp/cx-day159-backfill-wiedzy-scratch/vitest.day159.config.ts` | `419ee3524093ee12c86636c03fd3d2c7f3e2e34991cc893727bf8b9a7085d740` |

## TWIERDZENIA NIEZWERYFIKOWANE

1. Nie zweryfikowano liczby `26 177` ani 70% na żywej bazie; połączenia do
   demo, stagingu i produkcji były zakazane i nie zostały wykonane.
2. Nie zweryfikowano rozkładu pokrycia ani kosztu jakościowego na danych
   klientów. Wyniki 40%/40%/10%/30% dotyczą wyłącznie celowej fixtury 10 wierszy.
3. Nie zweryfikowano ochrony realnej rozmowy po kwarantannie, ponieważ zgodnie
   z zakresem filtr nie został wpięty w żywe wyszukiwanie. Dziś nowy mechanizm
   jest osiągalny jako serwis, ale brak jego konsumenta w `src/` poza testem.
4. Nie wykonano HTTP przez `ApiGateway`, ponieważ dyżur nie dodaje trasy ani
   nie twierdzi, że mechanizm jest dostępny przez HTTP.
5. Nie wykonywano runtime na portach `4986/4987`; nie był potrzebny do dowodu
   migracji i real-PG.
