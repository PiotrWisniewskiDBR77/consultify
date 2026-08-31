# CODEX DAY 215 — indeksacja raportów do bazy wiedzy AI

Data: 2026-08-31  
Marker: `fe33ce8036`  
Gałąź: `codex/day215-indeks-raportow-20260831`  
Status: **R1 ZROBIONE · R2 PARTIAL wobec Z22 / zielone wobec literalnego R2 · R3 ZMIERZONE · R4 ZROBIONE**

## 0. Stan wejściowy

Instrukcję odczytano w całości (1127 linii) z `github-backup/codex/m03-admin-20260824` w bare-vaulcie. Dokument miał stan `WYDANY`.

```text
fe33ce8036 lista dyzurow 211-222 w trzech falach; kazda pozycja z pomiaru 31.08, nie z planu
MARKER OK
```

Sanity worktree:

```text
fe33ce80360ac0b6751a5f605d6c758853a4dfa3
git status --short: brak wpisów
```

`df -h /`: 14 GiB dostępne (powyżej bramki 5 GB). `lsof` nie wykazał listenerów na 6155, 5100 ani 5101. `docker ps` wykazał cudze kontenery tylko na innych portach. Użyto wyłącznie `cx-day215-pg`, `127.0.0.1:6155`, baza `cx215`; runtime 5100/5101 nie był potrzebny.

Tip gałęzi bazowej był przed markerem o commity do `0a84c3d1b0`. `git diff --name-only fe33ce8036..github-backup/codex/m03-admin-20260824` nie wykazał zmian w `artifactKnowledgeIndexer.ts` ani `reportGenerationService.ts`; brak kolizji zasobowej. Rebase nie był wykonywany.

## 1. Wynik R1

- `artifactKnowledgeIndexer.ts:22-29` rozszerza wspólny rodzaj o `'report'`, bez zmiany semantyki `inferKnowledgeScope`.
- `artifactKnowledgeIndexer.ts:70-72` dodaje `indexReportArtifactForKnowledge` z tym samym kontraktem `{documentId, scope, chunkCount}`.
- `artifactKnowledgeIndexer.ts:74-95` dodaje testowalny builder markdown: filtr `enabled`, sortowanie `order_index`, nagłówki i pełna treść `generated_content || edited_content`.
- `reportGenerationService.ts:1849-1895` dodaje hook za istniejącą, nadal domyślnie wyłączoną flagą `ENABLE_ARTIFACT_KNOWLEDGE_INDEX`.
- Hook wykonuje dwa świeże odczyty: klasyfikacja `confidentiality` z tenantowym warunkiem (`:1851-1856`) i aktualne sekcje po generacji (`:1857-1877`). Nie używa `reportData.report.confidentiality` ani starego `reportData.sections`.
- Wywołanie jest fire-and-forget i loguje ostrzeżenie przy błędzie (`:1888-1894`).

Potwierdzono pomiarem lukę upstream: kolumna istnieje (`20260823_runtime_ddl_schema_convergence.sql:22`), lecz mapowanie `getReport()` w `reportBuilderService.ts:1399-1433` nie zawiera `confidentiality`. Dlatego świeży SELECT jest konieczny.

## 2. Wynik R2 i granica dowodu

Nowy test `report-builder-knowledge-index.http.pg.test.ts` wykonał realne `POST /api/report-builder/:id/generate`, podpisany JWT, realne `verifyToken`, produkcyjny router i realny PostgreSQL. Dla raportu wewnętrznego potwierdził HTTP 200, wpis `knowledge_docs` i wyszukiwalność przez `search_knowledge_base`; dla poufnego potwierdził `scope=user`, właściciela/organizację, brak globalnego embeddingu i brak wyniku wyszukiwania. Hook jest asynchroniczny, więc test polluje `knowledge_docs`.

**Granica:** literalne R2 nakazuje mirror pliku FIX-209 i bezpośrednie montowanie realnego routera. Z22 w tej samej instrukcji mówi, że wyłącznie `ApiGateway.getInstance().initializeRoutes(app)` dowodzi ścieżki produkcyjnej. Wybrano bezpieczną interpretację literalnej specyfikacji R2 i wzorca wskazanego przez autora, ale nie ogłaszam pełnego dowodu `ApiGateway`. Werdykt wobec Z22: **PARTIAL / consumer-path gap**. Kod produkcyjny jest zamontowany w Gateway, lecz w tym dyżurze nie wykonano żądania przez jego pełną inicjalizację.

## 3. Dowód mutacyjny

Kopia zielonego pliku:

```bash
cp server/src/services/knowledge/artifactKnowledgeIndexer.ts /private/tmp/cx-day215-indeks-raportow-scratch/artifactKnowledgeIndexer.ts.green
```

Mutacja: `inferKnowledgeScope()` zwracał na sztywno `'organization'`. Pierwszy przebieg zatrzymał się na pośrednim `scope`; poprawiono kolejność asercji i powtórzono, aby zmierzyć prawdziwy przeciek. Wynik właściwej mutacji:

```text
FAIL keeps a database-backed confidential report out of search_knowledge_base for another user
AssertionError: expected true to be false
Received: true
Test Files 1 failed (1); Tests 1 failed | 1 passed (2); --retry=0
```

To jest realny wynik `search_knowledge_base`, nie tylko stan pośredni. Cofnięcie:

```bash
cp /private/tmp/cx-day215-indeks-raportow-scratch/artifactKnowledgeIndexer.ts.green server/src/services/knowledge/artifactKnowledgeIndexer.ts
diff -u /private/tmp/cx-day215-indeks-raportow-scratch/artifactKnowledgeIndexer.ts.green server/src/services/knowledge/artifactKnowledgeIndexer.ts
# brak wyjścia
```

Po cofnięciu trzy kolejne pełne przebiegi były zielone.

## 4. R3 — pozostałe generatory

| generator | trwały artefakt z `id`? | pole poufności? | trasa HTTP | decyzja | powód |
|---|---|---|---|---|---|
| `management_reports` | TAK (`management_reports.id`) | NIE; `scope` to `PROJECT/PORTFOLIO`, czyli poziom agregacji | `POST /api/management-reports/generate` (`managementReports.routes.ts:52-67`) | **DEFER** | Schema `271_management_reports_extended.sql:14-46` ma `scope`, `share_token`, `share_expires_at`, ale nie ma `confidentiality`/`visibility`/`is_private`. Budowa klasyfikacji od zera to nowa powierzchnia produktowa i bezpieczeństwa. |
| `aiAssessmentReportGenerator` | NIE dla wyniku generatora | NIE DOTYCZY | `POST /api/assessment/:projectId/ai/reports/full` (`assessment-ai.routes.ts:833-850`) | **NIE DOTYCZY** | Generator `aiAssessmentReportGenerator.ts:157` zwraca strukturę; grep `INSERT INTO|dbRun|queryRun` dał 0 trafień, router robi bezpośrednio `res.json(result)`. Brak trwałego artefaktu post-persist. |

`server/src/routes/assessment/assessment-reports.routes.ts` (12 linii) tylko montuje router z `../assessment-reports.routes.js` (2898 linii); to jedna ścieżka, nie dwa generatory.

## 5. Korekty wobec instrukcji

1. `generateFullReport` ma **trzech**, nie dwóch produkcyjnych wołaczy: trasa `report-builder.routes.ts:2625`, scheduler `scheduledReportService.ts:553` oraz `generateReport()` w tym samym `reportGenerationService.ts:1960` na markerze. Hook wewnątrz `generateFullReport` obejmuje wszystkie trzy.
2. Pomiar `materializeDocumentArtifact` potwierdził siedem realnych wywołań (po odjęciu deklaracji i komentarza). `generateDeck` potwierdził trzy: route, deliverables i `artifactRegistryService.ts:4326`.
3. T8 nie został potwierdzony pozytywnie. Wręcz przeciwnie: UI `IntentStep.tsx:542-544` utrzymuje `intent.confidentiality`, ale `useReportBuilder.ts:255-272` wysyła do `POST /report-builder` tylko ogólny `config`. Trasa `report-builder.routes.ts:1919-1939` przekazuje do `createReport` tylko `config`, nie top-level `confidentiality`/inne pola V3, natomiast serwis wybiera gałąź V3 na podstawie `params.confidentiality` i rodzeństwa (`reportBuilderService.ts:1112-1120`). **DO DECYZJI WŁAŚCICIELA:** istnieje statycznie zmierzony wektor, w którym wybór poufności z UI nie trafia do kolumny i raport dostaje default `internal`. Nie naprawiano tego pliku — poza licencją dyżuru.
4. Sprzeczność Z22 kontra literalne R2 opisano w §2; nie rozszerzano testu poza wskazany wzorzec.
5. Pierwsza próba baseline nie wystartowała z powodu ścieżki `server/server/vitest.config.ts`; nie została policzona. Poprawny pomiar biegł z katalogu `server`, ścieżkami `src/...` i `--config vitest.config.ts`.

## 6. Zakres testów po nazwach

Baseline: 7/7, plik `/private/tmp/cx-day215-indeks-raportow-artefakty/przed.json`. Po zmianie: 11/11, plik `po.json`. `diff przed-nazwy.txt po-nazwy.txt` wykazał dokładnie cztery dodane nazwy i zero znikniętych:

```text
+ Day 215 report artifact knowledge index (real PostgreSQL) builds ordered markdown from enabled report sections
+ Day 215 report artifact knowledge index (real PostgreSQL) keeps a database-backed confidential report out of search_knowledge_base for another user
+ Day 215 report-builder /generate → knowledge index, real HTTP (real PostgreSQL) indexes an internal report through signed HTTP and makes its fresh section content searchable
+ Day 215 report-builder /generate → knowledge index, real HTTP (real PostgreSQL) reads confidential scope from the database and keeps the report out of global search
```

Pułapki: każdy przebieg miał w tej samej linii `RUN_DB_TESTS=1`, `MOCK_DB=false`, `DB_TYPE=postgres`, `NODE_ENV=test`, `ENABLE_V8_GLOBAL=true`, `ENABLE_TEST_AUTH_BYPASS=false`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, lokalny `DATABASE_URL`, `JWT_SECRET`, flagę indeksacji i `--retry=0`. Oba pliki instalują mock embeddingu w lokalnym `beforeEach`. Asercja `DB_TYPE=postgres` oraz log `DB_IDENTITY ... 127.0.0.1:6155/cx215` potwierdzają skuteczne środowisko. Polling wyłącza pułapkę fire-and-forget.

Trzy kolejne pełne przebiegi nowych plików:

```text
gate-1: 4 total, 4 passed, 0 failed, success=true
gate-2: 4 total, 4 passed, 0 failed, success=true
gate-3: 4 total, 4 passed, 0 failed, success=true
```

SHA-256:

```text
gate-1.json 0d15e5a4c1d663e11f8b85354799618b4340593751510abf9097aa802b5df99d
gate-2.json 6ab12155c7c11d1e1c19cc1403fcf8dbeb98c948f9beba11fc3c9e647579ab75
gate-3.json 6793212e4e79109174d19f85a4369a3d79226dd35112ebbb263b45d5ade3d249
po.json 70d702a1d8bdd692382747f55336c57b8d2749af4bea6e22f86ab3bebb11cc52
przed.json ebbd499f6f7201913ee16fdbf37f37f8b7d04c8e8459f8f3798aa63f261b4233
po-nazwy.txt 3728b20d4d25df911208afbdadeb22ee21a825c4324eedc73a082d19bc00b62c
przed-nazwy.txt fb6fc175ad9a42b8ba5bebc4ff45cb0f875220e4aeb9d62997df11d46e1069c8
```

## 7. Migracje i bezpieczeństwo wysyłki

Świeży `pgvector/pgvector:pg16`: pierwszy przebieg `Applying migrations: 659`, zakończony sukcesem; drugi `Applying migrations: 0`. Migracja `20260831_day209_knowledge_chunks_created_at.sql` istnieje. Nie dodano migracji.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## 8. Pliki i commity

`git diff --name-only fe33ce8036..HEAD` po R1/R2:

```text
server/src/routes/__tests__/report-builder-knowledge-index.http.pg.test.ts
server/src/services/knowledge/__tests__/reportArtifactKnowledgeIndexer.pg.test.ts
server/src/services/knowledge/artifactKnowledgeIndexer.ts
server/src/services/reportGenerationService.ts
```

Commit R1/R2: `1e3cb53c31 feat(day215): index generated reports in knowledge base`, wypchnięty na `github-backup/codex/day215-indeks-raportow-20260831` natychmiast po commicie.

## 9. TWIERDZENIA NIEZWERYFIKOWANE

- `reportData.report.confidentiality` jako brak mapowania: **potwierdzone statycznym pomiarem mapowania i testem HTTP czytającym bezpośrednio bazę**; nie wykonywano osobnej asercji JS, że własność ma wartość literalnie `undefined`.
- Gałąź V3 z frontu: **niepotwierdzona; statyczny pomiar wskazuje realną lukę transportu**, opisaną w §5.3. Nie wykonano całego wizarda w przeglądarce.
- Mutacja R1c: **potwierdzony prawdziwy przeciek przez `search_knowledge_base`**, nie tylko `scope`.
- Wołacze `generateDeck`: **zmierzone trzy**, w tym `artifactRegistryService.ts:4326`.
- R3: **oparte na pomiarze schematu i kodu**, nie na przepisaniu instrukcji.
- R1b przez HTTP: **potwierdzony realny router/JWT/PostgreSQL**, ale pełny `ApiGateway.initializeRoutes` nie został uruchomiony — PARTIAL wobec Z22.
- Trzy przebiegi powtarzalności: **wykonane naprawdę**, trzy odrębne JSON-y, każdy 4/4.
- Nie uruchamiano browsera ani klienta UI; brak akceptacji przeglądarkowej jest poza backendowym zakresem dyżuru.

## 10. Sprzątanie

Wykonano `docker rm -fv cx-day215-pg`; wynik: `cx-day215-pg`. Kontener i jego anonimowe wolumeny zostały usunięte.
