# CODEX DAY 162 — domknięcie pochodzenia i uczciwość audytu

## Werdykt

**PARTIAL — rdzeń R2/R4 naprawiony i udowodniony mutacyjnie na RealPG; pełna ścieżka HTTP niezmierzona, a jeden zastany test poza licencją utrwala stary, nieprawdziwy kontrakt.**

Gałąź: `codex/day162-domkniecie-pochodzenia-20260830`  
Marker: `218d020958`  
Pierwszy commit i push: `894739cfc63be667202cb9558786e88c46dd9313`

Nie oznaczam pracy jako akceptacji właściciela ani pełnego DoD runtime.

## Wejście i baza

Wynik markera, dosłownie:

```text
MARKER OK
```

Wynik sanity, dosłownie:

```text
218d020958a0470e043ce5be9537a1b15f351884
```

`git status --short | head -3` nie wypisał żadnej linii. Dysk przed startem: `27Gi` wolne. Tip `github-backup/codex/m03-admin-20260824` był przed markerem o 18 commitów; zgodnie z DEC wystartowałem dokładnie z markera, bez rebase.

Worktree został ostatecznie utworzony z bare-vaulta w `/private/tmp/cx-day162-domkniecie-pochodzenia`, z `config.worktree` ustawiającym `core.bare=false`. Początkowa próba zastała krótkotrwały samodzielny klon i kolidującą gałąź; oba zniknęły równolegle przed rozpoczęciem zapisu. Nie kasowałem ich ani nie resetowałem. Po ich zniknięciu wykonałem dosłowną procedurę vaulta.

Porty `6050`, `4992`, `4993` były wolne. Użyta baza: kontener `cx-day162-pg`, obraz `pgvector/pgvector:pg16`, `127.0.0.1:6050/cx162`. Pierwszy przebieg zastosował `868` migracji, drugi `0`; oba zakończyły się `Postgres migrations complete`.

## Korekty wobec instrukcji

1. **Sprzeczny port.** §0.2/Z7, §0.2c oraz tabela STOP mówią `6050`; tabela zasobów i B8 mówią `6049`. `6049` jest jednocześnie wymieniony jako zakazany port dyżuru 161. Wybrałem bezpieczniejsze i wielokrotnie powtórzone `6050`.
2. **Brak §0.4a.** Z24 odsyła do §0.4a, ale dokument nie zawiera takiej sekcji. Zmierzyłem zasięg sam: pełny `rg` znalazł 9 plików testowych odnoszących się do executorów/kontraktu — nowy RealPG i 8 zastanych plików jednostkowych.
3. **Liczba wołających TaskService.** Instrukcja mówi o 6–7; pomiar bez testów znalazł 5 rzeczywistych wywołań `TaskService.createTask`, nie licząc komentarza-adaptera w KPI.
4. **`tasks.source` ma pisarza i czytelnika.** Teza o braku pisarza była błędna. Łańcuch statyczny: walidator `server/src/validators/task.validators.ts:36,63` → `TaskController.createTask` (`server/src/controllers/TaskController.ts:1229,1291,1332`) → `POST /api/tasks` (`server/src/routes/pmo/tasks.routes.ts:90-95`) → odczyt kontrolera `:747,1052` → mapowanie frontu `src/components/Initiatives/InitiativeDocumentView.tsx:2652-2659` → filtr/plakietka `src/components/Initiatives/sections/TasksMilestonesSection.tsx:699,949,1516-1517`.
5. **Czytelnik rollback istnieje.** `src/components/AIChat/ActionCenter.tsx:311` renderuje `rollbackStatus`; komponent jest na `/ai/action-center` przez `src/routes/AppRoutes.tsx:1752-1755` i `src/routes/routeConfig.ts:304`.

## R1 — zasięg nieprawdziwego wpisu

Przed naprawą test wykonał przez `AIActionExecutor.executeAction` dwa zatwierdzone typy akcji na RealPG. Zapis przed zmianą:

| Typ akcji | ai_run_ledger available / unavailable | ai_run_events available / unavailable |
| --- | ---: | ---: |
| `CREATE_DRAFT_TASK` | 1 / 0 | 1 / 0 |
| `CREATE_DRAFT_DECISION` | 1 / 0 | 1 / 0 |

Po naprawie:

| Typ akcji | ai_run_ledger available / unavailable | ai_run_events available / unavailable |
| --- | ---: | ---: |
| `CREATE_DRAFT_TASK` | 0 / 1 | 0 / 1 |
| `CREATE_DRAFT_DECISION` | 0 / 1 | 0 / 1 |

Dowód SELECT znajduje się w `day162-select-proof.log` jako `DAY162_SELECT_AI_RUN_LEDGER` i `DAY162_SELECT_AI_RUN_EVENTS`. Oba zwracają po dwa `rollback_unavailable`.

Grep `undo|rollback|revert` w `server/src/routes/ai.routes.ts` znalazł rollbacki transakcji SQL (`571`, `578`, `652-653`) i niezależne pole `wasUndone` authoringu (`9221+`), lecz zero endpointów cofających materializację `AIActionExecutor`. Router `agent-materialization.routes.ts` ma 2×GET i 3×POST, ale dotyczy innej funkcji.

Poza `ActionCenter.tsx:311` nie znalazłem konsumenta rozróżniającego `rollback_available` od `rollback_unavailable`. `wave7ConnectorRuntimeService.ts:467` i `wave8AgentRuntimeService.ts:740` czytają wyłącznie `run_id`, `organization_id`, `status`.

## R2 — uczciwy status cofania

`rollbackStateForResult` zachowuje kształt kontraktu, ale dla akcji obsługiwanych przez `executeAction` zwraca teraz zawsze:

```text
rollbackStatus: rollback_unavailable
rollbackAvailable: false
rollbackStrategy: undefined (w audycie serializowane jako null)
```

Nie istnieje zmierzona ścieżka cofania, więc żaden typ nie jest podnoszony do `rollback_available`.

Dowód mutacyjny po commicie:

- chwilowe przywrócenie starego `hasOutputRef` → `day162-mutation-red.json`: 1/2 RED, pełna nazwa `writes honest rollback_unavailable for two executed action types and preserves history`, otrzymano dwa `rollback_available`;
- powrót do naprawionej wersji przez `cp` → `day162-mutation-green.json`: 2/2 GREEN;
- `git diff --exit-code -- server/src/services/aiActionExecutor.ts` po przywróceniu: pusty.

## R3 — wołający TaskService.createTask

| Wołający | Charakter | Dowód / decyzja |
| --- | --- | --- |
| `services/cqrs/task/CreateTask.ts:21-40` | zależny od komendy człowieka/systemu | Generyczny CQRS, brak dowodu „zawsze AI”; bez zmiany. |
| `services/canvasMaterialize.ts:596-614` | człowiek zatwierdza materializację treści Canvas | Tag `ai` nie dowodzi autonomicznej inicjatywy; bez zmiany. |
| `routes/v8/interview-insights.routes.ts:1036-1050` | człowiek wybiera handoff insightu | Pochodzenie insightu nie jest tożsame z autonomicznym utworzeniem; bez zmiany. |
| `services/myWork/agentApprovedMaterializationService.ts:223-238` | jednoznacznie AI, po zatwierdzeniu propozycji | `sourceType='myw_agent_proposal'`; plik jest imiennie nietykalny w tym dyżurze. Czerwony brief poniżej. |
| `services/meeting/meetingNoteTaskFunnelService.ts:88-136` | zależny od AI/heurystycznego ekstraktora i ręcznej konwersji | Komentarz wprost mówi „AI/heuristic extractor”; brak jednoznaczności; bez zmiany. |

`TaskService.ts` pozostał nietknięty. Nie można bezpiecznie dodać parametru i ustawić go w jedynym jednoznacznym callerze bez zmiany imiennie nietykalnego `agentApprovedMaterializationService.ts`. Brief dla licencjonowanego dyżuru: dodać `source?: 'manual'|'ai'` do wejścia `TaskService`, kolumnę `source` do INSERT-u i przekazać `'ai'` wyłącznie z `myw_agent_proposal`, z RealPG readback i mutacją.

## R4 — dwie autonomiczne ścieżki AI

- `server/src/services/aiActionExecutor.ts`: INSERT `_executeCreateTask` zapisuje literalne `source='ai'`.
- `server/src/ai/actionExecutors/taskExecutor.ts`: kolumnowo-obronny łańcuch zawiera `add('source', 'ai')`.
- `source_type/source_id` pozostają puste: executor czatowy nie dostaje stabilnego ID propozycji w kontrakcie `TaskPayload/metadata`, a wpisanie nazwy akcji lub przypadkowego ID byłoby zgadywaniem.
- Nowa migracja nie powstała; pełny łańcuch potwierdził istniejące `source`, `source_type`, `source_id`, a `source` ma default `'manual'`.

RealPG SELECT po obu wywołaniach zwrócił dwa wiersze `source='ai'` (`DAY162_SELECT_TASK_SOURCE`). Były to bezpośrednie wywołania funkcji, nie pełny HTTP.

## Historia audytu i cleanup

Test zasiał osobny historyczny ledger/event z `rollback_available`, policzył `COUNT(*)=1` i hash łączący `audit`, `details` oraz oba statusy przed i po nowych wykonaniach. Hash i count pozostały identyczne. Żaden stary wiersz nie był UPDATE/DELETE w toku scenariusza.

Po testach:

```text
day162_rows_left = 0
day162_tasks_left = 0
```

Nie powstała migracja; `git diff --name-only 218d020958..HEAD -- server/migrations/` jest pusty.

## Testy i pułapki Z33

### RealPG day162

Komenda zawierała w tej samej linii: `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6050/cx162 JWT_SECRET=... --retry=0`. Zewnętrzny config nie ustawia SQLite; pierwszy `beforeAll` asertuje `DB_TYPE === 'postgres'`, a strażnik `assertRealPostgresTestEnvironment()` został wywołany bez argumentów. Log dowodzi `DB_IDENTITY ... 127.0.0.1:6050/cx162`.

Pułapki (a), (b), (d) nie leżą na bezpośredniej ścieżce funkcji bez HTTP, ale ich zmienne zostały mimo to ustawione fail-closed. Pułapka (c) została wyłączona zewnętrznym configiem i asercją DB_TYPE. Pułapka (e) jest przedmiotem testu: realny czytelnik audytu i żywy `tasks.source` zostały zweryfikowane statycznie, a zapis wykonany na PG.

Wynik finalny: 1 plik, 2/2 testy GREEN, 0 skip, bez retry.

### Zastany pakiet jednostkowy

Pełny pomiar 8 plików z `RUN_DB_TESTS=0 MOCK_DB=true --retry=0`: 75 przypadków, 74 PASS, 1 FAIL, 0 skip. Ten pakiet nie jest dowodem egzekucji ani bazy. Pułapki (a)-(d) nie są mierzoną własnością; (e) dotyczy bezpośrednio kontraktu.

Czerwony kontrakt poza licencją:

```text
tests/unit/backend/aiActionExecutor.wave3-runtime.test.ts:320
expected rollback_unavailable to be rollback_available
```

To stare oczekiwanie utrwala właśnie usunięte kłamstwo. Pliku nie zmieniłem, bo tabela licencji zezwala na zapis wyłącznie nowego testu day162. Brief: właściciel/nadzorca powinien zmienić oczekiwanie linii 320 na `rollback_unavailable`, zachowując pozostałe asercje lifecycle.

Lint trzech zmienionych plików: `0` błędów, `67` ostrzeżeń; 3 nowe ostrzeżenia to celowe `console.info` niosące dowody SELECT, reszta jest zastana w executorach.

## Z30 — deklaracja

Przed testami:

```text
BRAK ZMIENNYCH POCZTY
settings WHERE key LIKE 'smtp%': 0 rows
Gateway.ts grep drenaży: 0 trafień
```

**Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.**

Executor utworzył wyłącznie lokalne rekordy powiadomień w efemerycznej bazie. Próby enrichmentu integracji nie znalazły konfiguracji; nie uruchomiono zewnętrznego transportu.

## Artefakty i SHA-256

- `day162-mutation-red.json` — `880238ea28c82a31ae7097911cf2a0de46377e1051833fdd44950c1157d164d9`
- `day162-mutation-green.json` — `a02642df4948f7d75455753a8219e88754a57fea3cfc05eecd9b2749f6051502`
- `day162-select-proof.log` — `dde1ec032d9b9c1a68aaa6416ab1e0f9eb21fbfbb0a4ef31224d524e1ed8f230`
- `day162-affected-unit.json` — `137087843a921155c4e4ba2346e968f9670ae99e6fa95fc655ff6c1aae2d3d39`
- `migrations-pass1.log` — `cd8f2b2baa735a4a136a8ac0654c2c499982015161dce065819c06b30f7720f8`
- `migrations-pass2.log` — `ec7ed4c365ff10c7242de999912a06f2c54be3576b830cfa1e2e69ba11a58f8c`

Wszystkie leżą poza repo w `/private/tmp/cx-day162-domkniecie-pochodzenia-artefakty`.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie sprawdziłem pełnej ścieżki HTTP przez realny `ApiGateway` i podpisany JWT dla żadnego z dwóch executorów; dowód R4 jest bezpośrednim wywołaniem funkcji na RealPG.
- Statyczny grep nie dowodzi runtime reachability `/ai/action-center`; potwierdza montaż route/komponentu, ale nie wykonano przeglądarkowego wejścia.
- Nie dowiodłem, że poza wyszukanymi plikami nie ma dynamicznego czytelnika `ai_run_ledger`/`ai_run_events` budującego SQL poza literalami.
- Nie rozstrzygnąłem produktu dla `source='ai'` w materializacji `myw_agent_proposal`, bo wymagany caller jest imiennie poza licencją zapisu.
- Nie uruchomiłem całego repozytoryjnego korpusu testów; zmierzyłem pełny zestaw plików trafionych przez zdefiniowany grep zmienionych executorów/kontraktu.
