# CODEX — DYŻUR 213 — RAPORT ZASIĘGU `knowledge_docs`

Data: 2026-08-31  
Marker: `fe33ce8036`  
Gałąź: `codex/day213-zasieg-20260831`  
Worktree: `/private/tmp/cx-day213-zasieg`

## Werdykt

| Pozycja | Stan | Wynik |
| --- | --- | --- |
| A.1 | `PARTIAL / KOD GOTOWY` | Cztery insertery zapisują jawne `scope='organization'`; cztery kontrakty były czerwone przed zmianą i zielone po zmianie. Dwa insertery serwisowe mają realPG readback. Dwa handlery HTTP mają realny kod handlera, lecz zastany test montuje router z mockami, nie pełny `ApiGateway` + realPG, więc pełne Z21/Z22 nie jest udowodnione. |
| A.2 | `VERIFIED` | Jedno źródło reguły w `knowledgeDocAccessFilter.ts`; oba konsumery używają funkcji wspólnej. Mutacja jednego miejsca czerwieni oba tory. |
| A.3 | `VERIFIED W ZAKRESIE DYŻURU` | Brak listy projektów wyklucza `scope='project'`; właściwa lista wpuszcza, obca wyklucza. Przewleczenie listy do realnych producentów kontekstu pozostaje osobnym brakiem. |
| A.4 | `VERIFIED` | Retrieval wyklucza `ai_visibility!='allowed'` oraz `sensitivity='confidential'` w obu torach. |
| A.5 | `VERIFIED` | Dedykowana migracja `961`, pełny fresh-DB 874, replay 0, default `'user'`. |

## Start i marker — wynik dosłowny

```text
0a84c3d1b0 instrukcje dyzurow 211-217 (fala A+B) — 7 instrukcji napisanych rownolegle, kazda z wlasnym pomiarem kodu; korekty autorskie: liczba 87 obalona (jest 4/2), trop mostu SWOT obalony, prog 41 zamiast 46
f443936158 KOREKTA: liczba 87 plikow dotknietych pulapka atrap byla bledna (moj zgrubny awk podany jako pomiar); sonda robotnika zwalidowana na znanym przypadku daje 4 pliki / 2 realnie zagrozone, 130 jako gorna granica
7e087e6120 213: znalezisko z pisania instrukcji — ragService fail-OPEN przy braku kolumny scope (embeddingService fail-closed), scope=project produkowany przez zywa trase i nieobslugiwany przez zaden filtr
...
fe33ce8036 lista dyzurow 211-222 w trzech falach; kazda pozycja z pomiaru 31.08, nie z planu
MARKER OK
```

```text
fe33ce80360ac0b6751a5f605d6c758853a4dfa3
```

Tip był przed markerem o nowsze commity; zgodnie z `DEC-2026-08-26-95` praca rozpoczęła się dokładnie z markera. Lista różnic tipa została zmierzona; scalenie pozostaje po stronie nadzorcy.

## Tezy T1–T6

- T1 potwierdzona: cztery listy INSERT nie zawierały `scope`.
- T2 skorygowana operacyjnie: dwa runtime-ALTER-y rzeczywiście są sprzeczne, ale na świeżej bazie po pełnych migracjach żaden nie wygrywa — `20260719_baseline_gap.sql` tworzył `scope DEFAULT 'user'` przed pierwszym requestem. A.5 eliminuje zależność od wielkiego pliku.
- T3 potwierdzona: żywy producent `scope='project'` istnieje; oba filtry nie znały projektu.
- T4 potwierdzona: embedding był fail-closed, rag fail-open przy braku `scope`.
- T5 potwierdzona: retrieval nie znał `ai_visibility`/`sensitivity`.
- T6 potwierdzona: przed A.5 brakowało dedykowanej migracji; istniały tylko baseline'y `000`, `20260303`, `20260719`.

## Implementacja

### A.1

- `knowledgeIndexer.insertDocument`: jawny literał w PostgreSQL, `ON CONFLICT`, oraz SQLite `INSERT OR REPLACE`.
- `POST /api/ai/attachments/ingest`: jawny literał w INSERT transakcyjnym.
- `POST /api/ai/attachments/ingest-url`: jawny literał w INSERT.
- `indexInsightInKnowledgeBase`: jawny literał w INSERT i `ON CONFLICT`.

Cztery czerwienie przed zmianą:

- `knowledgeIndexer`: otrzymano `user`, oczekiwano `organization`;
- insight: otrzymano `user`, oczekiwano `organization`;
- upload pliku: SQL nie zawierał `scope`;
- upload URL: SQL nie zawierał `scope`.

Po zmianie: 2/2 realPG serwisów i 9/9 testów routera. Brak pełnego `ApiGateway` + signed JWT + realPG readback dla dwóch tras oznacza `PARTIAL`, nie `VERIFIED`.

### A.2–A.4

Wybrano nowy czysty plik `server/src/services/ai/knowledgeDocAccessFilter.ts`, ponieważ reguła nie należy semantycznie ani do embeddingów, ani do BM25, a oba są równorzędnymi konsumentami. Funkcja przyjmuje dialekt, indeks pierwszego parametru, alias, userId i listę projektów.

Jedna mutacja w funkcji wspólnej usunęła ograniczenie projektu i governance. Wynik: 5/5 czerwonych, w tym osobna czerwień embedding i rag dla projektu oraz czerwienie dla `blocked` i `confidential`. Po przywróceniu: 5/5 zielonych.

Reguła projektu jest fail-closed: brak listy projektów nie daje dostępu. Grep wszystkich produkcyjnych wołaczy nie wykazał istniejącego przekazywania `projectId`/`projectIds`; opcjonalny kontrakt jest gotowy, lecz jego zasilenie wymaga osobnego zakresu.

Reguła governance jest zgodna z `documentGovernance.ts`: tylko `allowed` przechodzi bez zatwierdzenia konwersacyjnego, a `confidential` jest blokowane. `documentGovernance.ts` i jego wołacze nie zostały zmienione.

### A.5

Pomiar bezpośrednio przed utworzeniem:

```text
960_notification_types_ai_cost_budget.sql
```

Pomiar przy commicie:

```text
960_notification_types_ai_cost_budget.sql
961_knowledge_docs_scope.sql
```

Migracja:

```sql
ALTER TABLE knowledge_docs
  ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'user';
```

Fresh DB: `Applying migrations: 874`, zakończone `Postgres migrations complete`. Replay: `Applying migrations: 0`. `\d knowledge_docs` przed aplikacją pokazało `scope text DEFAULT 'user'::text`. Runtime-ALTER-y pozostawiono świadomie dla starszych środowisk.

## Testy i zasięg nazw

Sekwencyjny wynik końcowy (`--retry=0`):

- Day210 embedding realPG: 7/7;
- Day210 real-chain: 2/2;
- Day213 A.1 serwisy realPG: 2/2;
- Day213 A.2–A.4 realPG: 5/5;
- route contract: 9/9;
- rag unit: 2/2.

Pierwszy wspólny przebieg równoległy dał 8 czerwieni przez konkurencyjne `PostgresDatabase.initDb()` (`duplicate key ... pg_class_relname_nsp_index`). Powtórka sekwencyjna tych samych plików była w całości zielona; równoległego wyniku nie przedstawiam jako PASS ani jako regresji produktu.

`diff przed-nazwy.txt po-nazwy.txt`: 16 nazw dodanych, 0 znikniętych. Dziewięć z dodanych nazw pochodzi z istniejącego pakietu tras, który nie był w początkowym, węższym uruchomieniu; siedem to nowe przypadki Day213.

Artefakty:

- `/private/tmp/cx-day213-zasieg-artefakty/migrations-after-pass1.log` — `698e41487e0a0e8bca7a2653c6fdc5c404e266d4860d47979a671593435755ad`
- `/private/tmp/cx-day213-zasieg-artefakty/migrations-after-pass2.log` — `7eb813555dccbcd66b873d57a8c3e6eee34031b85c8e97ac8d2d388966aed8e1`
- `/private/tmp/cx-day213-zasieg-artefakty/przed-nazwy.txt` — `8f3edfe81541004e7a06c58260f5c6c1cb7d4e743f1cb830a11504a351cc5792`
- `/private/tmp/cx-day213-zasieg-artefakty/po-nazwy.txt` — `3f472bf89daba142163029df1d03b1818e293c890aa60e28311f1af5a6cb47e0`

Pułapki środowiska: `DB_TYPE=postgres`, `MOCK_DB=false`, `RUN_DB_TESTS=1`, realny `DATABASE_URL`, `ENABLE_TEST_AUTH_BYPASS=false`, `ENABLE_V8_GLOBAL=true`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` oraz `--retry=0` były w tej samej linii dla testów DB. Strażnik `assertRealPostgresTestEnvironment()` był wołany bez argumentów. Route contract jest jednostkowy i jawnie nie jest dowodem realPG.

## Bezpieczeństwo wysyłki

```text
BRAK ZMIENNYCH POCZTY
SELECT ... FROM settings WHERE key LIKE 'smtp%': 0 rows
grep drenazow w Gateway.ts: 0 trafien
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Commity

```text
a66b843ae8 fix(day213): make knowledge document inserter scope explicit
b5f2b55aa7 refactor(day213): unify knowledge document access filtering
800b6809d5 fix(day213): fail closed for project-scoped knowledge
d31be8a8d2 fix(day213): enforce document governance in retrieval
55bb217bcb fix(day213): add dedicated knowledge scope migration
```

Każdy commit został wypchnięty na `github-backup/codex/day213-zasieg-20260831`.

## Pliki zmienione

```text
server/migrations/961_knowledge_docs_scope.sql
server/src/routes/__tests__/ai.routes.attachments-ingest.test.ts
server/src/routes/ai.routes.ts
server/src/services/ai/__tests__/day213.inserter-scope.pg.test.ts
server/src/services/ai/__tests__/day213.knowledge-access.pg.test.ts
server/src/services/ai/embeddingService.ts
server/src/services/ai/knowledgeDocAccessFilter.ts
server/src/services/ai/knowledgeIndexer.ts
server/src/services/ragService.ts
server/src/services/v8/insightSignalBridgeService.ts
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY213_ZASIEG_REPORT.md
```

## Korekty wobec instrukcji

1. T2: pełne migracje na markerze już tworzą `scope DEFAULT 'user'`; nie da się uczciwie wskazać runtime-ALTER-u jako zwycięzcy na bazie po wymaganym bloku migracji. Zmierzony zwycięzca to migracja, nie runtime.
2. Wspólne równoległe uruchomienie plików realPG wywołało kolizję initDb; wiążące wyniki pochodzą z osobnych, sekwencyjnych procesów.
3. A.1 route proof nie spełnia Z22: zastany plik testowy sam dokumentuje mockowany router. Zmiana jest zakodowana, ale pełny odbiór dwóch tras wymaga nowego testu `ApiGateway` + JWT + realPG.

## TWIERDZENIA NIEZWERYFIKOWANE

- (a) Nie zmierzono zwycięzcy wyścigu dwóch runtime-ALTER-ów po usunięciu kolumny; po obowiązkowych pełnych migracjach kolumna już istnieje. Zmierzono, że przed aplikacją ma default `'user'`.
- (b) Zmierzono w `\d`, że `ai_visibility` i `sensitivity` istnieją niezależnie, są `NOT NULL` i mają defaulty odpowiednio `allowed`/`internal`; ich pełny łańcuch bootstrapów nie został zmapowany plik po pliku.
- (c) Przeszukano wszystkie produkcyjne wołania `searchRelevantChunks` i `embeddingService.search`; nie znaleziono realnego przekazywania `projectId`/`projectIds` poza nowym kontraktem w dwóch serwisach.
- (d) `scope='project'` zniknął w realPG przez dispatcher embeddingów i realny hybrid/bm25 rag; nie wykonano browser/HTTP e2e od uploadu Vault do czatu.
- (e) Porównano właściciela w `embeddingService.ts` z nowym neutralnym plikiem; wybrano neutralny plik, aby żaden z dwóch konsumentów nie był źródłem prawdy drugiego.
- (f) Numer 961 był wolny na początku tworzenia i ponownie zmierzony bezpośrednio przy commicie.
- (g) Na starcie porty 6153/5096/5097 były wolne, sąsiednie pasmo także; wolne miejsce wynosiło 9.3 GiB przy T9 (16 GiB przy pierwszym pomiarze).

## Checklist nadzorcy

Tylko do odczytu, wykonać wyłącznie na właściwie zatwierdzonym środowisku:

```sql
SELECT source_type, scope, count(*)
FROM knowledge_docs
GROUP BY 1, 2
ORDER BY 1, 2;
```

Nie wykonywałem tego zapytania poza lokalnym `cx-day213-pg`.
