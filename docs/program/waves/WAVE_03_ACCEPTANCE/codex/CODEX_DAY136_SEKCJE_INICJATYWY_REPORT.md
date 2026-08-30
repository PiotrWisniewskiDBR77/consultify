# CODEX DAY 136 — sekcje Inicjatywy

Data: 2026-08-30  
Gałąź: `codex/day136-sekcje-inicjatywy-20260830`  
Marker: `4378136c7dcbb37adeed1e41fb104c29314e34fd`  
Commit produktu i testów: `e3f0939a58`

## Stan wejściowy

Instrukcja miała stan `WYDANY`. Zastosowałem `§0.1-BIS`; nie wykonywałem fetchu,
tworzenia worktree ani pushu.

```text
$ git merge-base --is-ancestor 4378136c7d HEAD && echo "BAZA OK" || echo "MARKER BRAK — STOP"
BAZA OK
$ git status --short
[brak wyjścia]
$ git branch --show-current
codex/day136-sekcje-inicjatywy-20260830
$ ls -la node_modules
lrwxr-xr-x@ 1 piotrwisniewski wheel 56 Aug 30 07:45 node_modules -> /Users/piotrwisniewski/Developer/Consultify/node_modules
$ df -h /
Filesystem        Size    Used   Avail Capacity iused ifree %iused  Mounted on
/dev/disk3s1s1   1.8Ti    12Gi    30Gi    28%    459k  317M    0%   /
$ lsof -nP -iTCP:6020 -sTCP:LISTEN
[brak wyjścia — port wolny]
$ lsof -nP -iTCP:4938 -sTCP:LISTEN
[brak wyjścia — port wolny]
$ lsof -nP -iTCP:4939 -sTCP:LISTEN
[brak wyjścia — port wolny]
$ git rev-parse HEAD
4378136c7dcbb37adeed1e41fb104c29314e34fd
```

Stan T1–T4:

```text
$ grep -nE "'/:id/(stakeholders|raid|comments|linked-items)'" server/src/routes/pmo/initiatives.routes.ts
3673:router.get('/:id/stakeholders', InitiativeController.getStakeholders);
3675:  '/:id/stakeholders',
3697:router.get('/:id/raid', InitiativeController.getRaid);
3699:  '/:id/raid',
3720:router.get('/:id/comments', InitiativeController.getInitiativeComments);
3722:  '/:id/comments',
3960:router.get('/:id/linked-items', InitiativeController.getLinkedItems);
3962:  '/:id/linked-items',

$ grep -nE "case '(comments|stakeholders|raid|linked)" src/components/Initiatives/InitiativeDocumentView.tsx
9488:      case 'comments':
9561:        case 'comments':

$ ls src/components/Initiatives/sections/*.tsx | wc -l
36

$ ls src/components/MyWork/shared/*.tsx
[35 plików; pełny wynik zachowany w logu sesji, żadnego nie zmieniono]
```

Kontener `cx-day136-pg` działał wyłącznie na `127.0.0.1:6020`, obraz
`pgvector/pgvector:pg16`, baza `cx136`. Pierwszy przebieg zastosował migracje i
zakończył się `✅ Postgres migrations complete`; drugi: `Applying migrations: 0`
i `✅ Postgres migrations complete`.

## Korekty wobec instrukcji

1. T3 mówi „kilkanaście plików”; pomiar dał **36**.
2. T4 oczekuje „trzy pliki” w `MyWork/shared`; glob dał **35**. Wszystkie były
   wyłącznie do odczytu i żaden nie występuje w diffie.
3. Teza „backend gotowy” jest tylko częściowo prawdziwa. Realny
   `POST /api/initiatives/:id/raid` przez `ApiGateway` zwraca `409`:
   `EXECUTION_RUNTIME_V1_WRITE_REQUIRED`, `canonicalWriter=/api/initiatives/runtime-v1`.
   GET i legacy handler istnieją, ale platformowa bramka wycofała ten zapis.

## R1 — pomiar czterowarstwowy

| Sekcja | W1 komponent | W2 trasa | W3 realny wołacz | W4 twardy klucz renderu / osiągalność |
| --- | --- | --- | --- | --- |
| Komentarze | `sections/CommentsSection.tsx`; produkcyjnie prawy panel | `initiatives.routes.ts:3720–3729` | GET `InitiativeDocumentView.tsx:2727`; POST `:3829`; DELETE `:6030+` | prawy `ArtifactRightPanel`, sekcja `id: 'comments'` przy `:10145`; osiągalna zawsze z otwartej karty |
| Powiązania | `sections/LinkedItemsSection.tsx` | `initiatives.routes.ts:3960–3970` | wrapper wykonuje GET/POST/DELETE; główny ekran montuje go | `case 'attachments-links'` przy `InitiativeDocumentView.tsx:8142`, `registry:linkedItems` |
| RAID | `sections/RaidSection.tsx` | `initiatives.routes.ts:3697–3713` | wrapper wykonuje POST/PATCH/DELETE, wejściowy fetch GET przy `InitiativeDocumentView.tsx:2611` | `case 'risk-raid'` przy `:7678`, `registry:raid`; osiągalny, lecz POST zatrzymuje bramka 409 |
| Interesariusze | `sections/StakeholdersSection.tsx` | `initiatives.routes.ts:3673–3684` | wrapper wykonuje POST/DELETE, wejściowy fetch GET przy `InitiativeDocumentView.tsx:2666` | `case 'raci'` przy `:7515`, `registry:stakeholders` |

Wynik: na markerze komentarze miały render, ale fail-open zapis; linked items i
interesariusze miały wrappery bez montażu w aktywnym ekranie; RAID miał drugi,
lokalny canvas zamiast trwałego wrappera.

## R2 — podłączenie i prawda zapisu

- Zamontowałem istniejące `StakeholdersSection`, `RaidSection`,
  `LinkedItemsSection` i `AttachmentsSection`; nie utworzyłem nowego wyglądu.
- Usunąłem z aktywnej gałęzi lokalny RAID canvas oraz lokalny łącznik.
- Komentarz trafia do stanu i pokazuje sukces dopiero po odpowiedzi z `id`;
  przy błędzie draft zostaje. Delete komentarza ma rollback.
- Powiązania trafiają do stanu dopiero po odpowiedzi POST; delete usuwa stan
  dopiero po odpowiedzi serwera.
- RAID wrapper po 409 pokazuje błąd i usuwa lokalny wpis, więc ekran nie udaje
  trwałości.

Realny wynik mutacyjny:

| Sekcja | HTTP → DB → GET → DELETE → DB/GET | Wynik |
| --- | --- | --- |
| Komentarze | 201 → wiersz → odczyt → 200 → brak | PASS |
| Powiązania | 200 → wiersz → odczyt → 200 → brak | PASS |
| Interesariusze | 201 → wiersz → odczyt → 200 → brak | PASS |
| RAID | POST 409, liczba wierszy przed i po identyczna | STOP MERYTORYCZNY / czerwony kontrakt |

### STOP — R2 / RAID

Rodzaj: MERYTORYCZNY  
Powód: platformowa bramka odrzuca legacy write i wskazuje Runtime-v1, więc nie da
się wykonać wymaganej mutacji przez licencjonowaną trasę.  
Licencja, którą sprawdziłem: `server/src/routes/pmo/initiatives.routes.ts` —
**odczyt**, „trasy już istnieją — nie zmieniasz ich”; middleware i Runtime-v1
nie są w tabeli licencji.  
Dowód: test `RAID: legacy POST is blocked and leaves real PostgreSQL unchanged`;
HTTP 409 z kodem `EXECUTION_RUNTIME_V1_WRITE_REQUIRED`, readback DB bez zmiany.  
Co dostarczyłem ZAMIAST zmiany: czerwony kontrakt przez realny Gateway, negatywny
readback oraz montaż fail-closed wrappera bez placebo.  
Co zrobiłbym, gdyby zapadła decyzja X: po decyzji właściciela należałoby albo
wyprowadzić kanoniczne RAID commands w Runtime-v1 i przepiąć wrapper, albo jawnie
wyjąć ten typ zapisu z globalnej blokady. Następnie powtórzyć 201→GET→DELETE.  
Rekomendacja dla nadzorcy: osobny dyżur obejmujący Runtime-v1/bramkę i kontrakt
RAID; promień rażenia obejmuje wszystkie legacy execution writes.  
Stan: zacommitowano fail-closed konsument i czerwony test w `e3f0939a58`.  
Czy kontynuowałem pozostałe pozycje: TAK — R3 oraz raport wykonane.

## R3 — załączniki

```text
$ rg -n "attachments|upload|createObjectURL" server/src/routes/pmo/initiatives.routes.ts
2581: * timeline, technical, tasks, attachments, comments, activity). Sekcje z AI

$ SELECT ... FROM information_schema.tables WHERE table_name ILIKE '%initiative%attachment%' ...;
[0 wierszy]

$ rg -n "URL\.createObjectURL" src/components/Initiatives/InitiativeDocumentView.tsx src/components/Initiatives/sections/AttachmentsSection.tsx
src/components/Initiatives/sections/AttachmentsSection.tsx:31:          url: URL.createObjectURL(f),
src/components/Initiatives/InitiativeDocumentView.tsx:3861:      url: URL.createObjectURL(file),
src/components/Initiatives/InitiativeDocumentView.tsx:9235:      const url = URL.createObjectURL(blob);
```

Potwierdzono tezę: brak dedykowanej tabeli i tras załączników Inicjatywy, aktywny
upload jest lokalnym `blob:` URL. Niczego nie zbudowano.

## W-A — marker czerwony, zmiana zielona

Identyczna komenda, zawsze `--retry=0`:

```text
RUN_DB_TESTS=0 MOCK_DB=true npx vitest run \
  src/components/Initiatives/__tests__/initiativeSections.day136.test.ts \
  --retry=0 --reporter=json --outputFile=<marker/after.json>

MARKER: 1 total, 0 passed, 1 failed
TypeError: getInitiativePersistedSectionKey is not a function
fullName: Day 136 initiative persisted section render contract binds all four persisted sections to reachable InitiativeDocumentView branches

AFTER: 1 total, 1 passed, 0 failed
fullName: Day 136 initiative persisted section render contract binds all four persisted sections to reachable InitiativeDocumentView branches
```

Stan odkładano `cp` do scratch; nie użyto stash. Po przywróceniu `git diff --check`
był pusty.

## W-C — pomiar różnicowy pełnego katalogu testów Inicjatyw

```text
RUN_DB_TESTS=0 MOCK_DB=true npx vitest run src/components/Initiatives/__tests__ \
  --retry=0 --reporter=json --outputFile=<marker/after.json>

MARKER: total 166, passed 160, failed 2, pending 4
AFTER:  total 166, passed 161, failed 1, pending 4
```

Porównanie `fullName`:

- w obu: `upsertFinancialBlock language toggle still matches the same block via the stable marker token` — FAIL;
- tylko marker: kontrakt Day 136 — FAIL;
- tylko after: brak nowych porażek.

## Real-PG / Gateway

Komenda zawierała w tej samej linii `RUN_DB_TESTS=1 MOCK_DB=false
DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true
ENABLE_TEST_AUTH_BYPASS=false RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6020/cx136 JWT_SECRET=...`
oraz `--config server/vitest.config.ts --retry=0`.

Finalny JSON: 4 total, 4 passed, 0 failed. Pełne nazwy:

1. `... comments: POST -> DB/read HTTP -> DELETE -> DB/read HTTP`
2. `... linked items: POST -> DB/read HTTP -> DELETE -> DB/read HTTP`
3. `... RAID: legacy POST is blocked and leaves real PostgreSQL unchanged`
4. `... stakeholders: POST -> DB/read HTTP -> DELETE -> DB/read HTTP`

## Pułapki (a)–(e)

- (a) wyłączona przez `ENABLE_V8_GLOBAL=true`; test nie uznaje 404 za sukces.
- (b) ustawiono `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`; strażnik
  wyników nie jest celem, ale nie może fail-open.
- (c) `server/vitest.config.ts` faktycznie nadpisał pierwszy przebieg na sqlite.
  Test przywraca jawnie żądane `postgres` przed pierwszym importem DB/Gateway i
  pierwszy `beforeAll` asertuje `process.env.DB_TYPE === 'postgres'`. Log zawiera
  `DB_IDENTITY ... 127.0.0.1:6020/cx136`.
- (d) `ENABLE_TEST_AUTH_BYPASS=false`; każde żądanie ma podpisany JWT.
- (e) dowód nie opiera się na grep: wykonywalny kontrakt mapowania jest czerwony
  na markerze, a realne żądania przechodzą przez `ApiGateway.getInstance().initializeRoutes(app)`.

## Z30 — zero wysyłki

```text
$ env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL|ENABLE_LIVE_EMAIL)" || echo "BRAK ZMIENNYCH POCZTY"
BRAK ZMIENNYCH POCZTY
$ SELECT key, left(coalesce(value,''),8) FROM settings WHERE key LIKE 'smtp%';
(0 rows)
$ grep -n "startNotificationOutboxDrainCron\|outboxWorker\|platformOutboxDrainCron" server/src/Gateway.ts
[0 trafień]
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani
żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało
wysłane.

## Pozostałe kontrole

- `npx tsc --noEmit`: brak werdyktu — Node OOM przy limicie ok. 4 GiB po ~95 s;
  nie zapisuję PASS/FAIL dla kodu.
- targetowany ESLint testów: PASS po formatowaniu.
- ESLint wielkiego pliku produkcyjnego raportuje liczne zastane ostrzeżenia oraz
  import-sort; nie wykonano szerokiego autofixu. `prettier --check` pliku: PASS.
- `git diff --check`: PASS.

## Artefakty i SHA-256

```text
302485705a41f593d4920f95b0e7922a56643472c3ac9e8b76700f7e3e84ca77  day136-unit-marker.json
f7981305ca0ebadf2e698a40bd5ff8711b95e9661ec0a144af5b664056b07778  day136-unit-after.json
22cfed40df41656f1e38c9a4e9421f2391b7b4eb8f18de9f0938bfdb46bc0c39  day136-initiative-suite-marker.json
bf4ff3922b3150a58fbd70f457985f8e43e5ddef9e53d7a5fed82453f9ca101f  day136-initiative-suite-after.json
af0cc18b32e8c7e68c762cd02b83c02070310ce2d60d913aef780322208f69ee  day136-realpg-final.json
31b506f9e4c76da71e8457b9afb35ae1c4173c0940d1015820ceacc56097b4b3  migrate-1.log
eda85a0033d87f60f7c85afd88cec67dadaa1038907dd853935e5eb8c865f1b7  migrate-2.log
327c89b3044563a58d95d1989e8c34e6bfcd33bcff1f803013ea7dd34dce11ac  tsc-after.log
```

Wszystkie ścieżki zaczynają się od
`/private/tmp/cx-day136-sekcje-inicjatywy-artefakty/`.

## W-D — granica rozłączności

```text
$ git diff --name-only 4378136c7d..HEAD
src/components/Initiatives/InitiativeDocumentView.tsx
src/components/Initiatives/__tests__/initiativeSections.day136.pg.test.ts
src/components/Initiatives/__tests__/initiativeSections.day136.test.ts
```

Po commicie raportu dojdzie wyłącznie licencjonowany plik niniejszego raportu.
`src/components/MyWork/**` nie występuje.

## TWIERDZENIA NIEZWERYFIKOWANE

1. `NOT_PROVEN`: brak zrzutu przeglądarkowego na runtime 4938/4939; instrukcja
   nie wymagała nowego wyglądu, a dowód renderu wykonano kontraktem i osiągalną
   gałęzią, nie pełnym owner-runtime.
2. `EVIDENCE_MISSING`: pełny typecheck nie ukończył się z powodu OOM.
3. `PARTIAL`: R2 dla RAID nie ma mutacji 201→read→delete; udowodniono zamiast
   tego 409 i brak zmiany DB. Wymaga decyzji Runtime-v1/bramki poza licencją.
4. `NOT_PROVEN`: nie rozstrzygnięto, czy produktowo interesariusze mają pozostać
   we wspólnej sekcji RACI, czy dostać osobny element lewego menu; wybrano
   najmniejszą zmianę bez projektowania wyglądu.

## Werdykt

`PARTIAL / READY FOR SUPERVISOR REVIEW`: R1 i R3 ukończone; komentarze,
powiązania i interesariusze mają pełny real-PG dowód; wszystkie cztery sekcje są
osiągalne i fail-closed. R2/RAID pozostaje zasadnie zatrzymane przez kanoniczną
bramkę Runtime-v1. Nie pushowano.
