# ODBIÓR 210 — P0 BEZPIECZEŃSTWA: scope embeddingów (baza wiedzy AI)

Audyt adwersaryjny (Opus), 2026-08-31.
Gałąź: `codex/day210-scope-p0-20260831` @ `fc95f74966` (worktree `/private/tmp/cx-day210-scope-p0`).
Baza testowa: LOKALNY kontener `cx-day210-pg` (pgvector/pg16) `127.0.0.1:6150/cx210`. Zero połączeń do staging/demo/produkcji.

## WERDYKT: SCALIĆ PO FIX — ocena B

## ODPOWIEDŹ NA GŁÓWNE PYTANIE
**P0 (wyciek prywatnych sejfów innych osób przez embeddingi) JEST ZAMKNIĘTY.** Zamknięty na obu ścieżkach
`embeddingService`, a pozostałe ścieżki retrievalu (`knowledge_chunks`: `hybridSearch`/`bm25Search`/`_vectorSearch`/
`getContext`/`getContextKeyword`/`knowledgeIndexer`) były już wcześniej fail-closed (VLT-002).
ALE: bramka mutacyjna **nie przeszła w komplecie** (ścieżka fallback niepokryta testem), a warstwa `userId`
w produkcji jest **martwa** — żaden realny wołacz jej nie podaje. Stąd „PO FIX", nie „SCALIĆ".

---

## 1. Czy test realnie dowodzi wycieku?
TAK — to test na żywej bazie, nie sprawdzanie kształtu SQL-a.
`server/src/services/ai/__tests__/day210.embeddingScope.pg.test.ts`
- łączy się realnym `pg.Pool` do PostgreSQL z pgvector, przechodzi `assertRealPostgresTestEnvironment()`;
- fizycznie zapisuje dwa dokumenty przez `KnowledgeService.addDocument` + `processDocument` i **weryfikuje
  zapytaniem SQL, że wiersze naprawdę powstały** w `knowledge_chunks` i `ai_knowledge_embeddings` (test 1);
- wektor jest deterministyczny (mock `generateEmbedding`), więc brak zależności od OpenAI, ale samo
  wyszukiwanie idzie realnym operatorem pgvector `<=>`;
- asercja wycieku jest treściowa (marker w zwróconym `content`), nie strukturalna.
Dowód historyczny: `artefakty/r1-red.json` — przed naprawą test 2 CZERWONY z markerem prywatnym w wyniku.

### 1a. WADA TESTU (FIX-3)
`describe.skipIf(!enabled)` powoduje, że bez zmiennych środowiskowych suite **cicho POMIJA** 4 testy
(zweryfikowane: `RUN_DB_TESTS=0` → „4 skipped", exit 0). Strażnik `assertRealPostgresTestEnvironment`,
którego własna dokumentacja mówi „brak warunku = FAIL, nigdy SKIP", siedzi w `beforeAll` i **nigdy się nie
uruchamia**, bo `skipIf` zwiera obwód wcześniej. W CI bez env ten P0 wygląda na zielony.

## 2. `buildKnowledgeDocAccessFilter` — FAIL-CLOSED czy FAIL-OPEN?
`server/src/services/ai/embeddingService.ts:320-368`. **FAIL-CLOSED — potwierdzone czterema gałęziami,
sprawdzone empirycznie zapytaniami (sqlite3 3.44.2 + PG16):**

| sytuacja | zachowanie | ocena |
|---|---|---|
| `userId` obecny + kolumna `owner_id` | `NOT EXISTS (... scope='user' AND owner_id IS DISTINCT FROM $n)` | poprawne — cudze prywatne odcięte, własne przechodzi |
| **brak `userId`** | `NOT EXISTS (... scope='user')` — **wszystko prywatne odcięte** | **FAIL-CLOSED ✓** |
| brak kolumny `scope` | `NOT EXISTS (... d.id = e.document_id)` — przechodzą TYLKO embeddingi bez wiersza w `knowledge_docs` | fail-closed, ale kosztem CAŁEJ bazy wiedzy (FIX-4) |
| wyjątek przy odczycie `information_schema` / `PRAGMA` | `catch {}` → `hasScope=false` → gałąź jak wyżej | fail-closed ✓ |
| `scope='user'` + `owner_id IS NULL` (sierota) | `NULL IS DISTINCT FROM 'userA'` = TRUE → odcięte | fail-closed ✓ |

Zmierzone własnym zapytaniem na sqlite (dialekt naprawy jest poprawny, `IS DISTINCT FROM` wspierane od 3.39):
`userB → SHARED, NO_DOC_ROW` · `userA → PRIV_A, SHARED, NO_DOC_ROW` · `bez userId → SHARED, NO_DOC_ROW`
· `bez kolumny scope → tylko NO_DOC_ROW`.

## 3. Czy naprawa objęła OBIE ścieżki?
TAK, kodowo:
- pgvector: `embeddingService.ts:290-294` (`searchPg`)
- fallback in-memory/SQLite: `embeddingService.ts:221-223` (`searchSqlite`)
Obie gałęzie sprawdziłem ręcznym zapytaniem — semantyka i dialekt poprawne, w tym kolejność parametrów
pozycyjnych `?` w SQLite (organizationId przed userId — zgodna z kolejnością w `WHERE`).
**ALE testem pokryta jest tylko ścieżka pgvector** — patrz §6.

## 4. Wołający — kto przekazuje `userId`
Jedyny konsument `embeddingService.search()` w `server/src`:
- `server/src/services/ragService.ts:670` — **przekazuje `userId`** ✓ (po naprawie)

Wołający `ragService.searchRelevantChunks` (to oni zasilają powyższe):
1. `server/src/routes/ai.routes.ts:4284` — **BRAK `userId`** (idzie gałęzią `documentIds` → `hybridSearch`)
2. `server/src/services/ai/annaKnowledgeService.ts:255` — **BRAK `userId`** (gałąź `documentIds`)
3. `server/src/services/ai/virtualWorkerKnowledgeService.ts:287` — **BRAK `userId`** (gałąź `documentIds`)
4. `server/src/services/ai/tools/searchKnowledgeBase.ts:128` — przekazuje `context.userId` ✓, ale **obaj jego
   wołacze go nie podają**:
   - `server/src/services/reportGenerationService.ts:1191` — `{ organizationId }`
   - `server/src/services/report/drdReportGrounding.ts:103` — `{ organizationId }`
5. Realna powierzchnia czatu — `executeKBSearch`, `server/src/services/ai/toolDefinitions.ts:876` (to ONA
   obsługuje `search_knowledge_base` z czatu, NIE poprawiony plik `tools/searchKnowledgeBase.ts`) — w ogóle
   nie dotyka `embeddingService`; woła `ragService.hybridSearch`, które **nie ma parametru `userId`**.

WNIOSEK: w dzisiejszej produkcji `userId` jest ZAWSZE `undefined` → każde realne wywołanie ląduje w gałęzi
fail-closed. Bezpiecznie, ale zielony test „A widzi swój własny prywatny dokument" **jest wynikiem wyłącznie
laboratoryjnym** — produkcja tej zdolności nie umie wywołać. Warstwa `userId` to na dziś martwy kod.

## 5. Realne uruchomienie (moje, nie meldunek wykonawcy)
`RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres DATABASE_URL=postgresql://…@127.0.0.1:6150/cx210`

| przebieg | wynik |
|---|---|
| baseline (naprawa on) | **4/4 PASS**, 0 fail |
| MUTACJA A (filtr zdjęty w pgvector) | **3 pass / 1 FAIL** — pada „does not return user A private Vault document to user B" |
| MUTACJA B (filtr zdjęty w fallback) | **4/4 PASS — ZIELONO** |
| po przywróceniu obu | **4/4 PASS** |
Plik po mutacjach przywrócony bit w bit: `sha256 8ba038bb1e596d57ac9b3b787fe4fc6c42488afa6d141b9406578fe928f7837b`,
`git status` czysty, `git diff HEAD` pusty.

## 6. BRAMKA MUTACYJNA — WYNIK: 1/2
- (a) pgvector — **CZERWONA po mutacji ✓ pokryta**
- (b) fallback SQLite/in-memory — **ZOSTAŁA ZIELONA ✗ NIEPOKRYTA**
Przyczyna zmierzona w kodzie testu (linie 53-59): test wstrzykuje atrapę przez `RagService.setDependencies`,
której `search` woła **`searchPg` bezpośrednio**. Nie przechodzi więc ani przez dyspozytor `search()`
(`embeddingService.ts:196-203`), ani nigdy przez `searchSqlite`. Ubocznie: test nie dowodzi też, że
`search()` w ogóle przekazuje `userId` dalej do którejkolwiek implementacji.
Uczciwe rozróżnienie: ścieżka fallback jest **naprawiona** (sprawdziłem ją ręcznym zapytaniem, §2), ale
**niedowiedziona testem** — czyli nie jest chroniona przed regresją.

## 7. Test czułości (regresja) — CZY WŁAŚCICIEL WIDZI SWOJE
TAK na poziomie jednostki: test 4 „returns user A own private Vault document to user A" jest ZIELONY przy
włączonej naprawie — filtr `owner_id IS DISTINCT FROM $n` wpuszcza dokumenty właściciela.
Ręczne zapytanie potwierdza: `userA → PRIV_A` widoczne, `userB → PRIV_A` niewidoczne.
Naprawa NIE blokuje wszystkim wszystkiego.
ZASTRZEŻENIE: patrz §4 — w produkcji nikt nie podaje `userId`, więc realnie właściciel **też** nie zobaczy
swojego prywatnego dokumentu przez tę ścieżkę. To utrata funkcji, nie dziura bezpieczeństwa.

---

## LISTA FIX-ów

**FIX-1 (blokujący scalenie) — pokryć testem ścieżkę fallback.**
`server/src/services/ai/__tests__/day210.embeddingScope.pg.test.ts:53-59` — atrapa woła `searchPg` wprost.
Dodać bliźniaczy przypadek jadący przez `EmbeddingService.search()` (dyspozytor) i osobny przez
`searchSqlite` na bazie SQLite w pamięci. Kryterium: zdjęcie filtru z `embeddingService.ts:221-223` MUSI
zapalić czerwień.

**FIX-2 (blokujący) — przeprowadzić `userId` przez realny łańcuch albo świadomie go usunąć.**
Dziś martwy kod. Albo dowiązać:
`server/src/services/reportGenerationService.ts:1191` i `server/src/services/report/drdReportGrounding.ts:103`
(podać `userId` w drugim argumencie), `server/src/routes/ai.routes.ts:4284`,
`server/src/services/ai/annaKnowledgeService.ts:255`, `server/src/services/ai/virtualWorkerKnowledgeService.ts:287`,
oraz `ragService.hybridSearch` (`server/src/services/ragService.ts:861`) + `executeKBSearch`
(`server/src/services/ai/toolDefinitions.ts:876`) — albo jawnie zapisać w karcie, że gałąź owner-aware jest
na dziś nieosiągalna i test 4 pilnuje wyłącznie kontraktu funkcji.

**FIX-3 (blokujący) — test nie może się cicho pomijać.**
`day210.embeddingScope.pg.test.ts:33-39` — `describe.skipIf(!enabled)` zwiera strażnika
`assertRealPostgresTestEnvironment` (`tests/integration/_helpers/assertRealPostgres.ts`), który sam sobie
zakazuje SKIP-u. Bez env: „4 skipped", exit 0. Przenieść strażnika przed `skipIf` albo dopiąć suite do
bramki, która wymusza `RUN_DB_TESTS=1` dla testów P0.

**FIX-4 (poważny, nieblokujący) — gałąź „brak kolumny `scope`" kasuje CAŁĄ bazę wiedzy.**
`server/src/services/ai/embeddingService.ts:344-349` — `NOT EXISTS (... d.id = e.document_id)` przepuszcza
wyłącznie embeddingi bez wiersza w `knowledge_docs`. Kolumna `scope` powstaje tylko przez runtime-ALTER
(`KnowledgeService.ts:174`, `ContextDocumentService.ts:2398`), a `PostgresDatabase.initDb()` tworzy
`knowledge_docs` BEZ niej — przy niekorzystnej kolejności bootstrapu retrieval milknie bez śladu.
Dodać log ostrzegawczy i test na tę gałąź, albo wymusić kolumnę migracją.

**FIX-5 (średni) — cztery insertery nie ustawiają `scope`, a domyślna wartość kolumny to `'user'`.**
`ContextDocumentService.ts:2398` zakłada kolumnę jako `TEXT DEFAULT 'user'` (potwierdzone na bazie cx210:
`column_default = 'user'::text`). Wiersze wstawiane bez `scope` stają się PRYWATNE z `owner_id = NULL`, więc
po naprawie są niewidoczne dla wszystkich:
`server/src/services/ai/knowledgeIndexer.ts:868` (paczki narzędziowe / metodyka / książka DRD),
`server/src/routes/ai.routes.ts:599`, `server/src/routes/ai.routes.ts:868`,
`server/src/services/v8/insightSignalBridgeService.ts:203`.
Ryzyko istniało już wcześniej na ścieżce `knowledge_chunks` (VLT-002) — naprawa je podwaja, nie tworzy.
NIE ZMIERZONE na demo/produkcji (zakaz połączeń zdalnych) — do sprawdzenia zapytaniem przed promocją:
`SELECT source_type, scope, count(*) FROM knowledge_docs GROUP BY 1,2;`

**FIX-6 (średni) — dwie niezależne implementacje tej samej reguły dostępu.**
`embeddingService.buildKnowledgeDocAccessFilter` (`embeddingService.ts:320`) i
`ragService.appendKnowledgeDocAccessFilter` (`ragService.ts` — klauzula scope w linii 302) egzekwują tę samą
politykę dwoma kawałkami kodu, w dwóch dialektach, z różną obsługą `owner_id`. To dokładnie wzorzec
„naprawa per-wywołanie odrasta". Wydzielić jedno źródło reguły.

**FIX-7 (drobny) — `scope='project'` nieobsługiwany.**
`scope ∈ {user, project, organization}` (`KnowledgeService.ts:636`). Oba filtry pilnują wyłącznie `'user'`,
więc dokument sejfu projektowego jest w retrievalu widoczny dla całej organizacji, także dla osób spoza
projektu. Dług wcześniejszy niż 210, ale ta sama rodzina co P0 — zaadresować osobnym dyżurem.

**FIX-8 (drobny) — `ai_visibility`/`sensitivity` pomijane w retrievalu wektorowym.**
`knowledge_docs.ai_visibility` (NOT NULL, `'allowed'`) jest egzekwowane tylko w
`server/src/services/ai/documentGovernance.ts:34` dla listy załączników — ani `buildKnowledgeDocAccessFilter`,
ani `appendKnowledgeDocAccessFilter` go nie czytają. Dokument oznaczony jako niedostępny dla AI dalej
gruntuje odpowiedzi przez wyszukiwanie wektorowe. Dług wcześniejszy niż 210.

**FIX-9 (drobny) — koszt zapytania.** `buildKnowledgeDocAccessFilter` odpytuje `information_schema` /
`PRAGMA` przy KAŻDYM wyszukiwaniu. `knowledgeIndexer` (`knowledgeIndexer.ts:201`) ma na to cache
(`hasScopeColumnCache`) — zrobić tak samo.

---

## DOWODY
- `/private/tmp/claude-501/…/scratchpad/audit-baseline.json` — 4/4 PASS
- `…/audit-mutA.json` — mutacja pgvector, 1 FAIL (bramka OK)
- `…/audit-mutB.json` — mutacja fallback, 0 FAIL (bramka NIE zdana)
- `…/audit-restored.json` — po przywróceniu, 4/4 PASS
- artefakty wykonawcy: `/private/tmp/cx-day210-scope-p0-artefakty/{r1-red,r2-green,r2-mutation-red,r2-restored-green}.json`
  — odtworzone niezależnie, zgodne; wykonawca zrobił TYLKO mutację pgvector.
