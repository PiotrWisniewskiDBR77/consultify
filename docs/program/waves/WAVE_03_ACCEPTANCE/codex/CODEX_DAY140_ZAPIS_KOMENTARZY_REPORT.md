# CODEX DAY 140 — zapis komentarzy Zadania i Decyzji

Data pomiaru: 2026-08-30  
Gałąź: `codex/day140-zapis-komentarzy-20260830`  
Marker: `251ca29e53`  
Werdykt: **R2 udowodnione; R1 PARTIAL / STOP MERYTORYCZNY; R3 PARTIAL; R4 zmierzone.**

Nie wpisuję `FIXED` dla Zadania. Realny Gateway odrzuca jego POST kodem 409.

## Stan wejściowy

### §0.1-BIS

```text
$ git merge-base --is-ancestor 251ca29e53 HEAD && echo "BAZA OK" || echo "MARKER BRAK — STOP"
BAZA OK
$ git status --short
<pusto>
$ git branch --show-current
codex/day140-zapis-komentarzy-20260830
$ ls -la node_modules
lrwxr-xr-x@ 1 piotrwisniewski wheel 56 Aug 30 09:47 node_modules -> /Users/piotrwisniewski/Developer/Consultify/node_modules
$ df -h /
Filesystem        Size    Used   Avail Capacity iused ifree %iused Mounted on
/dev/disk3s1s1   1.8Ti    12Gi    24Gi    34%    459k  250M    0% /
$ lsof -nP -iTCP:6026 -sTCP:LISTEN
<pusto>
$ lsof -nP -iTCP:4946 -sTCP:LISTEN
<pusto>
$ lsof -nP -iTCP:4947 -sTCP:LISTEN
<pusto>
$ git rev-parse HEAD
251ca29e539b41ee3a143eb0cfa0a5c7c2b78198
```

### T1–T4, komendy literalne

```text
$ grep -n "handleAddComment" -A18 src/components/MyWork/TaskDetailView.tsx | grep -nE "fetch|Api\.|axios|V8MyWorkApi|setComments"
13:1430-      setComments(
19:1436-      setComments([...comments, newComment]);

$ grep -n "handleAddComment" -A18 src/components/MyWork/DecisionDetailView.tsx | grep -nE "fetch|Api\.|axios|V8MyWorkApi|setComments"
<pusto>

$ grep -nE "comment" server/src/routes/v8/my-work.routes.ts | head -12
<pusto>

$ grep -n "MutationResult" src/components/MyWork/shared/CommentsSection.tsx | head -6
25:import type { MutationResult } from './AttachmentsSection';
44:  onAddComment: (content: string, parentId?: string) => Promise<MutationResult>;
45:  onDeleteComment: (commentId: string) => Promise<MutationResult>;
46:  onLikeComment: (commentId: string) => Promise<MutationResult>;
47:  onGenerateAIComment?: () => Promise<MutationResult>;
```

## Korekty wobec instrukcji

1. T2 literalnie zwróciło zero, bo handler Decyzji leży dalej niż zakres `-A18`. Pomiar bez obcięcia potwierdził lokalne `setComments` i lokalny activity log w okolicy dawnej linii 4004.
2. T3 jest fałszywa: `server/src/routes/v8/my-work.routes.ts` nie zawiera tras komentarzy Task/Decision. Realne trasy są w `server/src/routes/pmo/tasks.routes.ts` oraz `server/src/routes/pmo/decisions.routes.ts`.
3. `§0.1-BIS` rozstrzyga konflikt Z34a: nie wykonano żadnego pushu.
4. `§0.1-BIS` stwierdza, że odwołanie Z24 do nieistniejącego `§0.4a` jest martwe; pominięto je. W-D i W-C zmierzono normalnie.
5. Instrukcja twierdzi, że R1 można zamknąć istniejącą trasą. Realny POST przez `ApiGateway` zwrócił:

```json
{
  "status": 409,
  "error": "Legacy execution writes are retired. Use the canonical Runtime-v1 execution API.",
  "code": "EXECUTION_RUNTIME_V1_WRITE_REQUIRED",
  "canonicalWriter": "/api/initiatives/runtime-v1"
}
```

To wynik, nie sprzeczność proceduralna. Nie improwizowałem canonical writer dla komentarza.

## Z30 — zero wysyłki

Przed pierwszym zapisem:

```text
$ env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL|ENABLE_LIVE_EMAIL)" || echo "BRAK ZMIENNYCH POCZTY"
BRAK ZMIENNYCH POCZTY
$ grep -n "startNotificationOutboxDrainCron\|outboxWorker\|platformOutboxDrainCron" server/src/Gateway.ts
<pusto>
$ docker exec cx-day140-pg psql -U postgres -d cx140 -c "SELECT key, left(coalesce(value,''),8) FROM settings WHERE key LIKE 'smtp%';"
 key | left
-----+------
(0 rows)
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Migracje

Obraz: `pgvector/pgvector:pg16`, kontener `cx-day140-pg`, host wyłącznie `127.0.0.1:6026`, baza `cx140`.

Pierwszy pełny przebieg zakończył się `✅ Postgres migrations complete`. Drugi:

```text
Applying migrations: 0
✅ Postgres migrations complete
```

Artefakty: `/private/tmp/cx-day140-zapis-komentarzy-artefakty/migrate-1.log` (`1bd59251d821864521c607aca45f1b15dae125572ab31ddc24f3ae613f798c57`) i `migrate-2.log` (`9f7aeae9c7811c1c72f570e6999fbf5289280c4bfb63f4b025bfbe520fdb5b84`).

## R1 — Zadanie

Commit `88d35ac44c` usuwa lokalne dopisywanie/sukces. Caller:

- POST-uje przez istniejące `Api.addTaskComment`;
- dopiero po potwierdzeniu wykonuje GET i zastępuje stan readbackiem serwera;
- na błędzie zwraca `{ok:false,error}`;
- GET przy otwarciu widoku pobiera listę serwerową;
- reply i like zwracają uczciwy błąd, bo serwer nie ma tych kontraktów.

Realny PG/Gateway: POST = 409, `task_comments` przed i po = 0 wierszy. Dlatego R1 nie spełnia B1.

### STOP — R1

Rodzaj: MERYTORYCZNY  
Powód: realny `/api/tasks/:taskId/comments` jest blokowany przez platformową bramkę legacy writes kodem 409.  
Licencja, którą sprawdziłem: `TaskDetailView.tsx — zapis wąski R1/R3`; `server/src/routes/pmo/tasks.routes.ts` i bramka platformowa nie są licencjonowane do zapisu.  
Dowód: `day140-pg-add.json`, pełna nazwa `POST + GET task comment persists and is returned`, FAIL `expected 409 to be 200`; niezależny SELECT = 0 rows.  
Co dostarczyłem ZAMIAST zmiany: czerwony kontrakt real-HTTP/PG oraz caller, który nie pokazuje sukcesu po 409.  
Co zrobiłbym, gdyby zapadła decyzja X: wskazany właściciel canonical Runtime-v1 powinien określić trasę komentarzy Task albo wyjątek od bramki. Następnie caller można przepiąć bez zmiany widżetu.  
Rekomendacja dla nadzorcy: osobna licencja na canonical writer/bramkę; promień obejmuje wszystkie legacy task writes.  
Stan: częściowo zacommitowano w `88d35ac44c`.  
Czy kontynuowałem pozostałe pozycje: TAK — R2/R3/R4.

## R2 — Decyzja

Commit `aa17ef9fe2`:

- odczyt agregatu z `GET /api/decisions/:id/detail`;
- POST `{body}` do `/api/decisions/:id/comments`;
- po POST ponowny aggregate GET i stan wyłącznie z serwera;
- DELETE, aggregate GET i readback bez usuniętego komentarza;
- lokalny activity log dopiero po potwierdzonym POST.

Dowód real-HTTP: `ApiGateway.getInstance().initializeRoutes(app)`, podpisany JWT, `ENABLE_TEST_AUTH_BYPASS=false`, `DB_TYPE=postgres` sprawdzone w pierwszym `beforeAll`.

SELECT przed delete:

```text
id                                   | decision_id    | author_id   | body                    | deleted_at
b19c62df-1e0d-4908-bdff-112914eb43fc | day140-decision| day140-user | DAY140 DECISION COMMENT | null
33210dcd-71db-41d4-b1d1-5dd267c804ab | day140-decision| day140-user | DAY140 DECISION COMMENT | null
```

Dwa wiersze powstały w dwóch jawnych, ręcznych przebiegach ADD z `--retry=0`, nie z retry runnera. Oba usunięto tym samym endpointem. Końcowy SELECT aktywnych komentarzy: `0 rows`.

Artefakty SELECT: `select-before-delete.txt` (`96c90ecce5bc3edab92b1e9cd7f2b6722ed117f79c8c488b2327b94829eae6da`) i `select-after-delete.txt` (`6d1e009a334c16b54215ca447953f3bc7a001e5f7c8f92e46f622f5386946bbe`).

## R3 — usuwanie i polubienie

- Delete Decyzji: PASS real HTTP + soft-delete w DB + aggregate GET bez wiersza.
- Delete Zadania: niezmierzalne po callerze, bo POST Zadania nie tworzy wiersza; STOP R1.
- Like Task i Decision: brak tras serwerowych; handler zwraca `{ok:false,error}`. Nie zbudowano tras bez licencji.
- Replies Task i Decision: brak pól/tras `parentId`; handler zwraca `{ok:false,error}` zamiast cichej utraty relacji.

### STOP — R3 likes/replies

Rodzaj: MERYTORYCZNY  
Powód: routery Task/Decision nie mają tras polubień ani relacji parent/reply.  
Licencja, którą sprawdziłem: oba widoki mają wąski zapis R3; routery są tylko do odczytu lub poza tabelą licencji.  
Dowód: `rg` routerów znajduje GET/POST/DELETE Task oraz POST/PUT/DELETE Decision, zero like/reaction i zero parentId.  
Co dostarczyłem ZAMIAST zmiany: fail-closed caller zwracający `{ok:false,error}` oraz R4 poniżej.  
Co zrobiłbym, gdyby zapadła decyzja X: zaprojektować DTO reakcji i reply, migrację oraz tenant-scoped endpointy; dopiero potem włączyć caller.  
Rekomendacja dla nadzorcy: osobny dyżur backend + migracje; promień obejmuje schemat komentarza, DTO i UI reply/like.  
Stan: zachowanie fail-closed w commitach `88d35ac44c` i `aa17ef9fe2`.  
Czy kontynuowałem pozostałe pozycje: TAK.

## R4 — porównanie kształtów

| Pole UI | Task GET | Task POST | Decision aggregate/POST |
|---|---|---|---|
| `id` | tak | tak | tak |
| `content` | `content` | `content` | `body` |
| `authorId` | `userId` | `userId` | `authorId` |
| `authorName` | `user.firstName/lastName` | brak | brak |
| `authorAvatar` | `user.avatarUrl` | brak | brak |
| `likes`, `likedByMe` | brak | brak | brak |
| `parentId`, `replies` | brak | brak | brak |
| `updatedAt` | tak | tak | tak |

Mapowanie nie wymyśla autora, reakcji ani relacji. Dla braku nazwy pokazuje identyfikator autora; likes pozostaje 0 tylko jako prezentacyjny brak wsparcia, a mutacja like jest odrzucana.

## W-A — mutacja czerwony → zielony

Komenda w każdym przebiegu:

```bash
RUN_DB_TESTS=0 MOCK_DB=true npx vitest run \
  src/components/MyWork/__tests__/CommentPersistence.day140.test.ts \
  --retry=0 --reporter=verbose
```

- Marker tylko `TaskDetailView.tsx`: 3 FAIL (`addTaskCommentAndReload/deleteTaskCommentAndReload is not a function`), 2 PASS decyzji. Artefakt `wa-task-before.log`, SHA-256 `e5fb7e0230d9b77be0f36a7fbb3e2ddd815281861d6f9c9a3731fde3184ea5b6`.
- Marker tylko `DecisionDetailView.tsx`: 2 FAIL (`addDecisionCommentAndReload/deleteDecisionCommentAndReload is not a function`), 3 PASS task. Artefakt `wa-decision-before.log`, SHA-256 `b53071815cf32ee3574a312c8a520bb2caec2727753536ee472ea89a944e1498`.
- Po przywróceniu przez `cp`: 5 PASS, 0 FAIL; `git diff --exit-code` dla obu plików: `DIFF PO COFNIĘCIU PUSTY`.

## W-C — ten sam przebieg, pełne nazwy

Marker obu plików: `success:false`, 0 PASS, 5 FAIL. Po zmianie: `success:true`, 5 PASS, 0 FAIL. Pełne nazwy są identyczne:

1. `task add waits for POST and replaces UI data with the server readback`
2. `task delete waits for DELETE and returns the server readback`
3. `task add rejects and never reports readback when the server rejects`
4. `decision add POSTs body then replaces UI data with aggregate server readback`
5. `decision delete waits for DELETE and returns aggregate server readback`

Artefakty: `wc-marker.json` (`1ff25989585f2f02f91ac1da7d90fcc6f2a85e47834aac54f46676759833ee8d`) i `wc-after.json` (`80da746f91dc77957fb0cbfbfb18e84c7223d9669668e070729ff9f2e69ae595`).

## Pułapki (a)–(e) per pakiet

Pakiet jednostkowy nie dotyka Gateway ani DB; uruchomiony z `RUN_DB_TESTS=0 MOCK_DB=true`. (a), (b), (c), (d) nie leżą na ścieżce; (e) Notebook nie jest importowany ani modyfikowany.

Pakiet PG:

- (a) `ENABLE_V8_GLOBAL=true` w tej samej linii;
- (b) `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` w tej samej linii;
- (c) zewnętrzny `/private/tmp/cx-day140-zapis-komentarzy-scratch/vitest.day140.pg.config.ts` nie przypina DB_TYPE; pierwszy `beforeAll` asertuje `postgres`; log `DB_IDENTITY ... 127.0.0.1:6026/cx140`;
- (d) `ENABLE_TEST_AUTH_BYPASS=false`, podpisany JWT przeszedł realne `verifyToken` (Decyzja 201; wcześniejszy błędny sekret dał 401 i nie został policzony jako PASS);
- (e) Notebook nie leży na ścieżce.

Każda komenda PG miała `--retry=0` i pełny inline env.

## W-D — granica licencji

```text
$ git diff --name-only 251ca29e53..HEAD
src/components/MyWork/DecisionDetailView.tsx
src/components/MyWork/TaskDetailView.tsx
src/components/MyWork/__tests__/CommentPersistence.day140.pg.test.ts
src/components/MyWork/__tests__/CommentPersistence.day140.test.ts
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY140_ZAPIS_KOMENTARZY_REPORT.md
```

Wszystkie pliki są w tabeli licencji. Zero zmian w `shared/*Section.tsx`, `Initiatives/**`, `Benefits/**`, `Meeting/**`, routerach, middleware i migracjach.

## Lint i testy

- Nowe testy: ESLint 0 errors, 15 ostrzeżeń `no-explicit-any`.
- Dwa wielkie widoki: uruchomiony lint bez fix; wykazał istniejące błędy sortowania importów i setki zastanych ostrzeżeń. Nie wykonano szerokiego autofixu.
- Jednostkowy wynik końcowy: 5/5 PASS po pełnych nazwach.
- PG ADD: Decision PASS, Task FAIL 409; dwa testy DELETE pominięte przez jawną fazę. Pominiecie nie jest traktowane jako PASS.
- PG DELETE: Decision PASS, Task FAIL z braku taskowego wiersza; dwa testy ADD pominięte przez jawną fazę. Pominiecie nie jest traktowane jako PASS.

## Commity

```text
88d35ac44c fix(my-work): route task comments through server caller
aa17ef9fe2 fix(my-work): persist decision comment lifecycle
```

Nie pushowano.

## TWIERDZENIA NIEZWERYFIKOWANE

1. Nie zweryfikowano zachowania w pełnym runtime przeglądarkowym na portach 4946/4947; nie było potrzeby uruchamiania `server/src/index.ts`, a dowód R2 jest real HTTP/Gateway/PG.
2. Nie zweryfikowano, czy `/api/initiatives/runtime-v1` ma zatwierdzony kontrakt komentarza Task; komunikat 409 wskazuje tylko canonical writer ogólnie. Zgadywanie payloadu byłoby naruszeniem STOP.
3. Nie zweryfikowano delete Task na wierszu utworzonym przez UI, bo realny POST Task nie tworzy wiersza.
4. Nie zweryfikowano reakcji ani replies, bo serwer nie ma tras/pól; UI teraz odmawia zamiast udawać sukces.
5. Nie zweryfikowano nazwy autora Decyzji, bo DTO nie dostarcza profilu; UI pokazuje `authorId` jako uczciwy fallback.
