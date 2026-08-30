# CODEX DAY 139 — TEKSTY PROJEKTU

Stan: **ZROBIONE / dowód mutacyjny real-PG**

Gałąź: `codex/day139-teksty-projektu-20260830`

Marker: `4378136c7d`

Commit rdzenia: `9704dbb803`

## Stan wejściowy

### §0.1-BIS

```text
$ git merge-base --is-ancestor 4378136c7d HEAD && echo "BAZA OK" || echo "MARKER BRAK — STOP"
BAZA OK
$ git status --short
[brak wyjścia]
$ git branch --show-current
codex/day139-teksty-projektu-20260830
$ ls -la node_modules
lrwxr-xr-x@ 1 piotrwisniewski wheel 56 Aug 30 07:45 node_modules -> /Users/piotrwisniewski/Developer/Consultify/node_modules
$ df -h /
/dev/disk3s1s1 1.8Ti 12Gi 30Gi 29% 459k 315M 0% /
$ lsof 6023,4944,4945
PORT 6023 WOLNY
PORT 4944 WOLNY
PORT 4945 WOLNY
```

### T1

`sed -n '1100,1132p' server/src/services/ai/AIPipeline.ts` pokazał bezpośredni JOIN:

```sql
SELECT k.title, k.content
FROM conversations c
JOIN project_knowledge k ON k.project_id = c.chat_project_id
WHERE c.id = ? AND k.kind = 'text' AND k.content IS NOT NULL
```

W bloku nie było strażnika; wynik zgodny z tezą T1.

### T2 — przed zmianą

Komenda: `grep -rn "filterDocumentsByVisibility" server/src --include='*.ts' | grep -v __tests__`

```text
server/src/services/aiContextBuilder.ts:978:        const access = await filterDocumentsByVisibility(
server/src/services/organizationContext/ContextRetrievalService.ts:189:    const access = await filterDocumentsByVisibility(
server/src/services/organizationContext/ContextRetrievalService.ts:379:      const access = await filterDocumentsByVisibility(ids, projectId || undefined);
```

Pomiar: 3 realne wywołania; AIPipeline nie był wołaczem.

### T3 — schemat przed projektem naprawy

Migracja `server/migrations/774_project_knowledge.sql` oraz realny Postgres po pełnych migracjach dały:

```text
id, project_id, kind, title, content, doc_id, added_by, added_at,
version, content_hash, hash_basis, provenance_json, updated_at
```

`project_knowledge` nie ma `ai_visibility` ani `sensitivity`. `doc_id` jest opisany kontraktem migracji jako `for kind='file'`; dla tekstu nie ma wiarygodnego powiązania. Wybrałem drogę **(b), kwarantanna fail-closed**. Nie powieliłem polityki poufności w SQL.

### T4 — pełny inwentarz czytelników

Komenda: `grep -rn "project_knowledge" server/src --include='*.ts' | grep -v __tests__ | grep -v migrations`

- `server/src/services/ai/AIPipeline.ts:1108` — czyta teksty i włącza je do `customInstructions`, czyli promptu. Naprawione w tym dyżurze.
- `server/src/routes/ai.routes.ts:4033` — czyta `doc_id` wpisów `kind='file'` i poszerza RAG scope; treść może trafić do promptu przez dalszy retrieval. Plik imiennie nietykalny; ścieżka była uszczelniona dyżurem 132.
- `server/src/routes/chat-projects.routes.ts:81,96-101,875,947,1027,1053` — schema/CRUD list/create/update/delete; ta ścieżka sama nie przekazuje treści do modelu.

## Korekty wobec instrukcji

1. `§0.2c` twierdzi, że `DB_TYPE=postgres` w tej samej linii nadpisze config. Pomiar z `server/vitest.config.ts` dał `DB_TYPE: sqlite` i 1 suite failed/1 test skipped. Oba configi wpisują `test.env.DB_TYPE='sqlite'`. Z18 zakazuje ich zmiany. Test przyjmuje więc dodatkowe `DAY139_EFFECTIVE_DB_TYPE=postgres` z tej samej linii, ustawia efektywny `DB_TYPE` przed dynamicznym importem DB, asertywnie sprawdza `DB_TYPE`, dokładny `DATABASE_URL`, `current_database()='cx139'` i port serwera 5432. Log DB potwierdził `DB_IDENTITY ... 127.0.0.1:6023/cx139`.
2. Pierwsza próba `--config server/vitest.config.ts` z roota odkryła 0 suite/0 testów; nie została uznana za PASS. Właściwy przebieg wykonano z katalogu `server`, `--config vitest.config.ts`.
3. Pierwsza techniczna próba mutacji podała rootowe ścieżki z cwd `server`; `cp` i checkout odmówiły, więc kod nie został zmieniony. Wynik testu był nieważny i został nadpisany.
4. Pierwsza wersja asercji przechodziła także na markerze. Została odrzucona jako niedowodowa; finalny test wymaga obecności niepoufnego project brief (dowód osiągnięcia ścieżki) oraz nieobecności sekretu.
5. Cały `AIPipeline.ts` nie przechodzi zastanego `prettier --check`. Nie uruchomiłem `--write` na tym dużym pliku, aby nie przepisać zakresu poza wąską licencją. Nowy test przechodzi `prettier --check`; `git diff --check` jest czysty.

## R1 — naprawa

Zapytanie pobiera teraz także `doc_id`. Jedyny istniejący SSOT, `filterDocumentsByVisibility`, otrzymuje powiązane identyfikatory, projekt i rozmowę. Do promptu przechodzą tylko teksty, których dokument nadrzędny znalazł się w `access.allowed`. Wpis bez `doc_id`, nieistniejący dokument, `blocked`, `requires_approval`, `confidential` albo błąd strażnika jest odrzucany. Liczba wpisów kwarantanny jest logowana. `documentGovernance.ts`, migracje, flagi i pliki nietykalne pozostały bez zmian.

## R2 — test różnicujący na realnym PostgreSQL

Komenda obu przebiegów (różniła się wyłącznie wersja produkcyjnego `AIPipeline.ts`):

```bash
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres DAY139_EFFECTIVE_DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6023/cx139 \
JWT_SECRET=cx139-test-secret-do-not-reuse \
npx vitest run src/services/ai/__tests__/day139.projectTextGovernance.pg.test.ts \
  --config vitest.config.ts --retry=0 --reporter=json --outputFile=<artefakt>
```

Pełna nazwa przypadku:

```text
Day 139 R2 — project text governance on real PostgreSQL excludes a project text whose governance parent is confidential
```

Przed naprawą (`AIPipeline.ts` z markera):

```text
success=false; total=1; passed=0; failed=1; pending=0
AssertionError: expected '[Project brief] ...' not to contain
'DAY139_CONFIDENTIAL_PROJECT_TEXT_MUST_NOT_ENTER_PROMPT'
```

Po naprawie:

```text
success=true; total=1; passed=1; failed=0; pending=0
```

Jawny stan poufności fixture (`SELECT` w transakcji zakończonej `ROLLBACK`):

```text
id                 | kind | doc_id            | ai_visibility | sensitivity
day139-report-text | text | day139-report-doc | allowed       | confidential
(1 row)
```

## W-C — pomiar różnicowy

Ta sama komenda i ta sama pełna nazwa: marker = 1 FAIL, zmiana = 1 PASS. Nie ma dodatkowych przypadków, które mogłyby zamaskować różnicę.

## R4 — po zmianie

Pełne realne miejsca wywołania po zmianie:

```text
server/src/services/aiContextBuilder.ts:978
server/src/services/ai/AIPipeline.ts:1121
server/src/services/organizationContext/ContextRetrievalService.ts:189
server/src/services/organizationContext/ContextRetrievalService.ts:379
```

Pomiar wzrósł z 3 do 4. Nie dodano nowej drogi promptu omijającej strażnika.

## Pułapki (a)–(e) dla pakietu R2

- (a) `ENABLE_V8_GLOBAL=true`; test nie idzie przez HTTP/V8, ale wartość jest jawna.
- (b) `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`; ten middleware nie leży na wywołanej prywatnej ścieżce `buildContext`.
- (c) wyłączone jawnie przez `MOCK_DB=false`, efektywny `DB_TYPE=postgres`, exact `DATABASE_URL`, asercje DB i log `DB_IDENTITY`.
- (d) `ENABLE_TEST_AUTH_BYPASS=false`; test nie dowodzi HTTP/JWT i nie przedstawia się jako dowód Z21/Z34.
- (e) zmierzona przed naprawą: tabela nie ma pól poufności; test wiąże tekst przez `doc_id` z realnym `knowledge_docs.sensitivity='confidential'` i wywołuje jedyny strażnik.

## Z30 — brak wysyłki

```text
BRAK ZMIENNYCH POCZTY
BRAK DRENAZY W GATEWAY
SELECT ... FROM settings WHERE key LIKE 'smtp%': (0 rows)
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Artefakty

- `/private/tmp/cx-day139-teksty-projektu-artefakty/day139-before.json`
- `/private/tmp/cx-day139-teksty-projektu-artefakty/day139-after.json`

```text
c4c0d7d6109ff4d683c3ee6ddd2c40501389a36e7a2b9f004610649f9ebfb003  day139-before.json
03c907ed111383a9449bb1c75bd860cb08f492449a3fa49bbe50772506fca328  day139-after.json
```

## W-D — granica rozłączności

Oczekiwane `git diff --name-only 4378136c7d..HEAD` po commicie raportu:

```text
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY139_TEKSTY_PROJEKTU_REPORT.md
server/src/services/ai/AIPipeline.ts
server/src/services/ai/__tests__/day139.projectTextGovernance.pg.test.ts
```

Wszystkie trzy pliki są w tabeli licencji. Nie pushowano.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie wykonano realnego HTTP przez `ApiGateway` ani wywołania dostawcy modelu, bo dyżur dotyczy prywatnego budowania kontekstu, a Z15 zabrania wywołania LLM. Wynik nie jest przedstawiany jako pełny dowód Z21/Z34.
- Nie zweryfikowano produktowej migracji istniejących tekstów bez `doc_id`; bieżąca naprawa świadomie je kwarantannuje fail-closed i loguje liczbę.
- Nie udowodniono, że wszystkie historyczne wpisy tekstowe mają dokument nadrzędny; pomiar schematu wskazuje coś przeciwnego.
- Nie uruchomiono szerokiej suity `server/src/services/ai/__tests__`; dowód obejmuje dokładnie uruchomiony przypadek o pełnej nazwie podanej wyżej.
