---
doc_id: funkcje-odbior-209
status: evidence
truth_type: work-status
established: 2026-08-31
---

# Odbiór adwersaryjny — dyżur 209 (17-J, indeksacja artefaktów do wiedzy AI)

**Werdykt: `C` — szkielet bezpieczny, GŁÓWNA ścieżka (skuteczna indeksacja)
NIE jest dowiedziona nawet raz w sposób deterministyczny. SCALIĆ PO FIX.**

Materiał: worktree `/private/tmp/cx-day209-indeksacja`, gałąź
`codex/day209-indeksacja-20260831`, 3 commity od merge-base
`29f004c670b677443364868df73106a2d6c300d4`. `git log --stat` zgodny z opisem
wykonawcy: `4a133bc73a` (dokumenty), `3331d27917` (decki), `7213f61ebc` (docs).
Oba commity kodu mają w tytule „(partial)" — wykonawca sam to sygnalizował,
nie ukrywał.

## Co wykonawca TWIERDZIŁ i co POTWIERDZIŁ nadzorca

| Teza wykonawcy | Werdykt | Dowód nadzorcy |
|---|---|---|
| Flaga `ENABLE_ARTIFACT_KNOWLEDGE_INDEX`, `default(false)`, realna implementacja | **PRAWDA** | `server/src/config/FeatureFlags.ts:52` (schema), `:234-238` (loader `!== undefined`... `=== 'true'`), `:270-272` (helper `isArtifactKnowledgeIndexEnabled`). Nie fantom — dwa realne miejsca wołania (patrz niżej). |
| Hook na końcu `materializeDocumentArtifact`, po trwałym zapisie | **PRAWDA** | `server/src/services/documentStudio/documentStudioService.ts:1263-1278`, bezpośrednio przed `return`, `void ...catch(logger.warn)` (fire-and-forget, nie blokuje zapisu artefaktu). |
| Hook zaraz po `UPDATE presentation_decks SET status='ready'` | **PRAWDA** | `server/src/services/presentationGeneratorService.ts:2415` (UPDATE) → `:2430` (hook), odczyt SELECT z `status='ready'` przed indeksacją. |
| `confidential\|restricted → user`, reszta → `organization` | **PRAWDA** | `server/src/services/knowledge/artifactKnowledgeIndexer.ts:14-19`. |
| `skipGlobalEmbeddingIndex` addytywny 4. parametr, `scope==='user'` → `true` | **PRAWDA** | `server/src/services/KnowledgeService.ts:672-677` (sygnatura, default `false`), `:717` (`if (!skipGlobalEmbeddingIndex && embedding...)`), wołanie w `artifactKnowledgeIndexer.ts:52-56`. |
| 7 realnych wołaczy `materializeDocumentArtifact` | **PRAWDA** | `grep` potwierdza dokładnie 7: `document-studio.routes.ts` ×2, `work-canvas.routes.ts` ×1, `docGenerationRuntime.ts` ×2, `chatTargetMappingService.ts` ×1, `ideaHandoffService.ts` ×1 (+ 1 komentarz w `documentsAdapter.ts`, zgodnie z zastrzeżeniem wykonawcy). To NIE jest „biblioteka bez wołacza". |
| `generateDeck` wołane produkcyjnie | **PRAWDA** | `presentations.routes.ts`, `deliverablesGenerationService.ts` — realne trasy, nie tylko testy. |
| STOP: `knowledge_chunks.created_at` brakuje na świeżym schemacie, blokuje R1/R2 | **PRAWDA, ale NIEPEŁNA** — patrz sekcja niżej | Odtworzone niezależnie dwa razy (offline migracja + osobny kontener pgvector). |
| „4 PASS / 2 FAIL" na RealPG | **ZGADZA SIĘ z pierwszym uruchomieniem na zimno** | Patrz sekcja Mutacja/Testy. |

## CZWARTA WARSTWA (wołacz) — WYNIK: jest, nie jest fantomem

Zweryfikowano osobiście: `materializeDocumentArtifact` i `generateDeck` mają
realnych, produkcyjnych wołaczy w trasach HTTP, nie tylko w testach. To
odróżnia dyżur 209 od znanego wzorca „biblioteka bez wywołania" — hook
faktycznie wpina się w prawdziwą ścieżkę zapisu.

## OCHRONA ZASIĘGU — zmutowano własnymi rękami, wynik: DZIAŁA

Dwie mutacje, obie przywrócone po teście (worktree czysty, `git status`
pusty, `git diff --stat` pusty):

**Mutacja 1** — `inferKnowledgeScope` (`artifactKnowledgeIndexer.ts:14`)
zamieniona na `return 'organization'` na sztywno (ignoruje
confidentiality). Wynik: **5 z 6 testów w
`artifactKnowledgeIndexer.pg.test.ts` poczerwieniało**, w tym najważniejszy:

```
does not return user A private content to user B through search_knowledge_base
AssertionError: expected true to be false
```

To jest realny, end-to-end dowód wycieku: prywatny sekret stał się
wyszukiwalny przez `search_knowledge_base` po zepsuciu klasyfikacji. Test NIE
jest tautologią — łapie prawdziwy przeciek.

**Mutacja 2** — wymuszono `skipGlobalEmbeddingIndex=false` na stałe w
wywołaniu `KnowledgeService.processDocument` (`artifactKnowledgeIndexer.ts:52-56`).
Wynik: niejednoznaczny (patrz Zastrzeżenie niżej) — tylko 1 test czerwony, ten
sam, który jest niezależnie od mutacji już losowo czerwony (patrz Flakiness).
Zastrzeżenie: to NIE obala mutacji 1 — świadczy raczej o tym, że zapis do
`ai_knowledge_embeddings` jest ogólnie zawodny (patrz niżej), więc test nie
mógł wykryć różnicy, bo zapis i tak się nie udawał niezależnie od flagi.

Mutacja 1 jest rozstrzygająca i jest to najważniejszy wynik całego audytu:
**ochrona zasięgu, czyli sedno bezpieczeństwa tego dyżuru, jest realna i
przetestowana.**

## Odtworzenie STOP-u i to, czego wykonawca NIE napisał

Zbudowano od zera świeży PostgreSQL 16 + pgvector (kontener Docker, port
6209) i uruchomiono **cały łańcuch migracji offline**
(`server/scripts/migrate.postgres.ts`, `NODE_ENV=test`) — zakończył się
`✅ Postgres migrations complete` bez błędów. Bezpośrednio po tym:

```
\d knowledge_chunks
```

— **brak kolumny `created_at`**. Przyczyna źródłowa (odczytana z plików, nie
zgadywana): `server/migrations/000_z_core_baseline.sql:416-423` tworzy
`knowledge_chunks` BEZ `created_at` w fazie NUMBERED (numer „000"), a
`server/migrations/266_knowledge_rag.sql:98-136` (też NUMBERED, numer „266",
więc leci PO „000" w tej samej fazie) ma `CREATE TABLE IF NOT EXISTS` z pełnym
schematem łącznie z `created_at` — ale to **no-op**, bo tabela już istnieje.
Żadna z późniejszych migracji DATED (`20260303_schema_alignment.sql`,
`20260719_baseline_gap.sql`, `20260830_day159_chunk_org_backfill.sql`,
`20261120_fresh_db_schema_gap_closure.sql`) nie dodaje `created_at`. To
**realna, przedmigracyjna luka**, potwierdzona niezależnie od raportu
wykonawcy — nie jego wymysł.

**Czego wykonawca nie napisał (odkrycie nadzorcy):** `server/src/database/PostgresDatabase.ts:1832-1841`
ma WŁASNY, osobny mechanizm samo-naprawy schematu przy starcie aplikacji
(`ensureKnowledgeChunkColumn('created_at', ...)`), niezależny od
`migrate.postgres.ts` i od `KnowledgeService.ensureKnowledgeSchema()`. To
sprawia, że błąd „brak `created_at`" jest **wyścigiem czasowym, nie trwałą
blokadą**: w pierwszym starcie procesu na świeżej bazie kolumna może jeszcze
nie istnieć w momencie pierwszego `INSERT` (odtworzone: 2 FAIL z 6), ale po
starcie/restarcie procesu naprawa się kończy i te same testy zaczynają
przechodzić (odtworzone: 1 FAIL z 6, inny test). Wniosek: to jest luka do
zamknięcia PRAWDZIWĄ migracją (`ALTER TABLE knowledge_chunks ADD COLUMN IF
NOT EXISTS created_at ...`), a nie fatalny blokier — ale dopóki jej nie ma,
zachowanie na produkcji zależy od kolejności startu procesu, co jest złym
kontraktem.

## ★ Nowe odkrycie nadzorcy: dodatkowa niezdiagnozowana zawodność (flakiness)

Po tym, jak `created_at` już istniał (drugi przebieg), test
„indexes an internal document into both Vault chunks and the default
embedding search" (`artifactKnowledgeIndexer.pg.test.ts:96`,
`expect(globalCount.rows[0]?.count).toBeGreaterThan(0)`):

- **PRZECHODZI** uruchomiony w izolacji (`-t "indexes an internal document"`);
- **CZERWIENIEJE** uruchomiony jako część pełnego pliku 6 testów (odtworzone
  dwukrotnie, ten sam wynik).

To znaczy: nawet GŁÓWNA, pozytywna ścieżka R1 (dokument organizacyjny ma
trafić do globalnego indeksu i być wyszukiwalny) **nie jest deterministycznie
udowodniona** — działa czasem, zależnie od kolejności testów/procesu.
Przyczyna nie zdiagnozowana do końca; podejrzany: `catch { /* ignore */ }`
bez logowania wokół `embeddingService.storeChunk(...)` w
`KnowledgeService.ts:718-724` — połyka błąd bez śladu, więc każda awaria tego
zapisu jest niewidoczna. To NIE jest luka wprowadzona przez dyżur 209 (kod
`processDocument` poza nowym parametrem jest niezmieniony), ale dyżur 209
opiera się na tej funkcji i dziedziczy jej zawodność.

## Testy — liczby z pierwszego zimnego przebiegu (dowód niezależny)

Uruchomiono `artifactKnowledgeIndexer.pg.test.ts` bezpośrednio (RealPG,
`RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres`) na świeżo zmigrowanej bazie:
**4 PASS / 2 FAIL**, oba FAIL identyczne z artefaktem wykonawcy
`day209-r1.json` (`expected 0 to be greater than 0` w tej samej linii). Hashe
SHA-256 wszystkich 7 plików dowodowych w
`/private/tmp/cx-day209-indeksacja-artefakty/` **zweryfikowane zgodne**
(`sha256sum -c`, wszystkie `OK`) — dowody nie są sfabrykowane.

Pełnego korpusu repo (783→785 suites) NIE odtwarzano — poza zakresem
(zakaz pełnego vitest repo w tym audycie); ocena oparta wyłącznie o dedykowany
plik testowy dyżuru, uruchomiony samodzielnie kilkukrotnie.

## Rozstrzygnięcie zakresu

- **Dokumenty (R1):** hook wpięty w realną ścieżkę, flaga realna, klasyfikacja
  scope + pominięcie globalnego zapisu dla prywatnych — udowodnione mutacją.
  Skuteczna indeksacja treści ORGANIZACYJNEJ (pozytywna ścieżka: ma trafić do
  globalnego wyszukiwania) — **NIE udowodniona deterministycznie** (flaky).
- **Decki (R2):** analogicznie wpięty, ekstrakcja tekstu z `deck_json`
  rozsądna i przetestowana. Ta sama zależność od zawodnego
  `KnowledgeService.processDocument`.
- **Oba razem:** kod NIE jest bezużyteczny — bezpiecznik prywatności (rdzeń
  ryzyka tego dyżuru) jest realny i przetestowany, flaga OFF domyślnie więc
  merge nie zagraża produkcji/demo. Ale obietnica „system odżywia się pracą"
  (dokumenty faktycznie trafiają do wiedzy i są wyszukiwalne) **nie jest
  spełniona ani razu w sposób powtarzalny**.

## Co zostaje do dorobienia (ponumerowane, plik:linia)

1. `server/src/services/KnowledgeService.ts:704` — INSERT do `knowledge_chunks`
   zależy od kolumny `created_at`, której offline-migracje
   (`server/migrations/000_z_core_baseline.sql:416-423`,
   `server/migrations/266_knowledge_rag.sql:98-136` jako no-op) nie
   gwarantują. Potrzebna PRAWDZIWA migracja `ALTER TABLE knowledge_chunks ADD
   COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP` (i
   `metadata`, z tego samego powodu), żeby zdjąć zależność od wyścigu ze
   startem aplikacji (`server/src/database/PostgresDatabase.ts:1832-1841`).
2. `server/src/services/KnowledgeService.ts:718-724` — cichy `catch {}` wokół
   `embeddingService.storeChunk(...)` bez logowania. Dodać logowanie błędu,
   zdiagnozować i naprawić przyczynę niezdeterminowanej awarii zapisu do
   `ai_knowledge_embeddings` dla treści organizacyjnej (odtworzone: test
   `artifactKnowledgeIndexer.pg.test.ts:96` czerwony w pełnym pliku, zielony
   w izolacji).
3. Dowód HTTP end-to-end przez ApiGateway + realny JWT + realna trasa (nie
   bezpośrednie wywołanie `indexDocumentArtifactForKnowledge`/
   `indexDeckArtifactForKnowledge` z testu) — sam wykonawca oznaczył to jako
   NIEZWERYFIKOWANE (sekcja 8 jego raportu); potwierdzone jako wciąż otwarte.
4. Flaga `ENABLE_ARTIFACT_KNOWLEDGE_INDEX` (`server/src/config/FeatureFlags.ts:52`)
   zostaje OFF do czasu zamknięcia punktów 1–3 i uzyskania w pełni zielonego,
   powtarzalnego przebiegu `artifactKnowledgeIndexer.pg.test.ts` (6/6, nie
   4/6 ani 5/6) — zgodnie z własną rekomendacją wykonawcy, potwierdzoną jako
   słuszna.
5. R3 (inwentarz generatorów raportów) — sam wykonawca zadeklarował „zero
   implementacji"; to POZA zakresem 209 (dokumenty/decki), nie liczyć jako
   dług tego dyżuru. Jeśli ma wejść „indeksacja raportów", to osobny dyżur
   bazujący na `reportGenerationService.ts` (`generateFullReport`, wskazany
   przez wykonawcę jako P1 kandydat).

## Mutacje — stan po audycie

Obie mutacje przywrócone. `git status --short` i `git diff --stat` w
worktree puste — zero artefaktów audytu pozostawionych w repo. Skrypty
pomocnicze (`scripts/_audit_day209_repro*.ts`) utworzone i usunięte w trakcie
audytu, nie wchodzą do commitów. Kontener Docker audytu (`cx-day209-audit-pg`)
i baza lokalna (`cx_day209_audit`) usunięte po zakończeniu.
