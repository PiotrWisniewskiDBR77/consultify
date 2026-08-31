# CODEX DAY 148 — ZAŁĄCZNIKI FRONT

Data: 2026-08-30
Gałąź: `codex/day148-zalaczniki-front-20260830`
Marker: `cefa960d00`
Werdykt: **PARTIAL** — wołacze upload/list/delete Zadania i Decyzji oraz download Zadania działają przez realny `ApiGateway` i PostgreSQL; F5 obu widoków i uwierzytelniony download Decyzji pozostają poza wąską licencją plikową.

## Stan wejściowy

Polecenia §0.1-BIS i wynik dosłowny:

```text
$ git merge-base --is-ancestor cefa960d00 HEAD && echo "BAZA OK" || echo "MARKER BRAK — STOP"
BAZA OK
$ git status --short
$ git branch --show-current
codex/day148-zalaczniki-front-20260830
$ ls -la node_modules
lrwxr-xr-x@ 1 piotrwisniewski wheel 56 Aug 30 11:01 node_modules -> /Users/piotrwisniewski/Developer/Consultify/node_modules
$ df -h /
Filesystem        Size    Used   Avail Capacity iused ifree %iused Mounted on
/dev/disk3s1s1   1.8Ti    12Gi    15Gi    44%    459k  159M    0% /
PORT 6034 WOLNY
PORT 4962 WOLNY
PORT 4963 WOLNY
```

Kontener: `cx-day148-pg`, obraz `pgvector/pgvector:pg16`, mapowanie `127.0.0.1:6034:5432`, baza `cx148`.

Migracje:

```text
pierwszy przebieg: ✅ Postgres migrations complete
drugi przebieg: Applying migrations: 0
drugi przebieg: ✅ Postgres migrations complete
```

## Korekty wobec instrukcji

1. §0.1 zawiera obce komendy dyżuru 144 (`/private/tmp/cx-day144-wskaznik-rozlaczenie`, KPI). §0.1-BIS nadpisuje §0.1; nie dotykałem cudzego worktree i wykonałem wyłącznie sanity BIS.
2. Z24 odsyła do nieistniejącego §0.4a. Zgodnie z §0.1-BIS odwołanie pominąłem.
3. Literal `JWT_SECRET=cx148-test-secret-do-not-reuse` z §0.2c nie spełnia walidacji minimum 32 znaków. Realny pakiet zwrócił 401 i log `JWT_SECRET must be at least 32 characters`. Powtórzyłem z jednorazowym `cx148-test-secret-do-not-reuse-00000000`; dopiero wtedy `verifyToken` przyjął JWT.
4. R1/R2 wymagają przetrwania F5, lecz tabela licencji zezwala w Task wyłącznie na dwa handlery i `onDownload`, a w Decision wyłącznie na dwa handlery. Stan po wejściu nadal pochodzi z `task.attachments` (`TaskDetailView.tsx:1094`) i `decision.attachments` (`DecisionDetailView.tsx:2060-2061`), nie z `GET /object-attachments/...`. Bez licencji na load/effect nie zmieniłem tego.
5. T4/B6 wymagają uwierzytelnionego downloadu Decyzji, ale `AttachmentsLinksCanvas` nie ma propa download i wykonuje `window.open(a.url)` (`AttachmentsLinksCanvas.tsx:842-847`); plik i markup wywołania są imiennie nietykalne. Nie zamieniłem chronionej trasy w blob URL jako źródło prawdy.

## R1 — Zadanie

- Upload wysyła każdy plik jako multipart pod polem `file`, potem pobiera świeżą listę.
- Mapowanie odpowiedzi serwera następuje dopiero po sukcesie API; handler zwraca `{ok:true}` dopiero po reloadzie, a wyjątek daje `{ok:false,error}`.
- Delete najpierw woła API, następnie odświeża listę.
- `AttachmentsSection.onDownload` wykonuje uwierzytelniony fetch, blob, tymczasowy link, click i revoke.
- Real-PG: upload/list/download/delete przez `ApiGateway`; wiersz miał poprawne `object_id`, `organization_id` i rozmiar, pobrana treść była identyczna, po delete readback był pusty.

Stan R1: **PARTIAL** wyłącznie z powodu nieudowodnionego F5 (patrz STOP poniżej).

## R2 — Decyzja

- Te same dwa handlery karmią `AttachmentsLinksCanvas` i bespoke tabelę.
- Upload/delete są server-first, zachowują `isDecisionStageLocked`, a błędy pokazują `toast.error` bez sukcesu.
- Real-PG: upload/list/delete przez `ApiGateway`; wiersz miał poprawne `decision_id`/`organization_id`; 403 nieuczestnika pozostawił bazę bez zmian.

Stan R2: **PARTIAL** z powodu F5 oraz braku legalnej drogi uwierzytelnionego downloadu w dwóch widokach Decyzji.

## R3 — lokalny blob URL

```text
$ grep -rn "URL.createObjectURL" src/components/MyWork/TaskDetailView.tsx src/components/MyWork/DecisionDetailView.tsx
src/components/MyWork/TaskDetailView.tsx:1521:      const url = URL.createObjectURL(blob);
```

Jedyne trafienie jest wymaganym, krótkotrwałym blobem pobrania. Ścieżki uploadu nie tworzą lokalnego URL; `attachment.url` jest mapowane na trasę serwera. Przetrwanie F5: **NIE ZWERYFIKOWANO / NIE UKOŃCZONO** z powodu granicy licencji opisanej wyżej.

## R4 — mapowanie kształtu

| Backend | Front | Mapowanie / wynik |
|---|---|---|
| `id` | `id` | `String(id)` |
| `fileName` | `name` | bezpośrednie, fallback `attachment` |
| `mimeType` | `type` | bezpośrednie; wystarcza `canPreview()` dla `image/*` i `application/pdf` |
| `sizeBytes` | `size` | `Number(sizeBytes)`, używane do prezentacji rozmiaru |
| `createdAt` | `uploadedAt` | bezpośrednie jako string |
| `createdBy` | `uploadedBy?` | surowe ID użytkownika; backend nie zwraca nazwy — prawdziwa dziura prezentacyjna do osobnego dyżuru |
| `objectType`, `objectId`, `organizationId` | brak | kontekst trasy/stanu, nie jest prezentowany |
| `storageKey` | brak | celowo nieujawniany w UI |
| brak | `url` | wyliczana chroniona trasa downloadu |
| brak | `thumbnailUrl?` | pozostaje puste; kafel nie ma miniatury, ale modal obrazu/PDF rozpoznaje typ; dla Decyzji download nadal blokuje auth |

## W-A i W-C — czerwony → zielony, porównanie po fullName

Ta sama komenda jednostkowa, `--retry=0`, reporter JSON.

Przed zmianą: 4 testy, 4 failed, 0 pending. Każdy fullName padł na braku eksportowanej funkcji wołacza:

```text
failed: ... uploads every task file, reloads server state, and maps the download route
failed: ... deletes a task attachment and only then reloads server state
failed: ... downloads a task attachment through the authenticated API caller
failed: ... uses the same server-first contract for decision upload and delete
```

Po zmianie: 4 testy, 0 failed, 0 pending; dokładnie te same cztery fullName mają status `passed`.

Real-PG, zewnętrzny config, uruchomienie z `server/`, `--retry=0`: 3 testy, 3 passed, 0 failed, 0 pending:

```text
passed: ... persists, lists, downloads, and deletes a task attachment through the caller
passed: ... persists and deletes a decision attachment through the same caller contract
passed: ... refuses a non-participant and leaves the database unchanged
```

## Pułapki (a)–(e)

- Pakiet jednostkowy: nie montuje Gateway ani DB; (a)–(e) nie leżą na ścieżce. `RUN_DB_TESTS=0 MOCK_DB=true`; dowodzi kontraktu wywołań i mapowania, nie egzekucji.
- Pakiet real-PG: (a) wyłączone przez `ENABLE_V8_GLOBAL=true`; (b) przez `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`; (c) przez zewnętrzny config bez `DB_TYPE=sqlite` oraz asercję `DB_TYPE === postgres`; (d) przez `ENABLE_TEST_AUTH_BYPASS=false` i realny podpisany JWT; (e) nie dotyczy — brak ścieżki KPI. Log podał `DB_IDENTITY ... 127.0.0.1:6034/cx148`.

## Z30 — zero wysyłki

```text
BRAK ZMIENNYCH POCZTY
SELECT ... FROM settings WHERE key LIKE 'smtp%': (0 rows)
grep ... server/src/Gateway.ts: BRAK DRENAZY W Gateway.ts
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## STOP — F5 i download Decyzji

Rodzaj: MERYTORYCZNY
Powód: spełnienie B4 i decision-części B6 wymaga zmian poza wąską licencją handlerów.
Licencja, którą sprawdziłem: `TaskDetailView.tsx — tylko handleUploadAttachments, handleDeleteAttachment, onDownload`; `DecisionDetailView.tsx — tylko te same dwie funkcje`; `AttachmentsLinksCanvas.tsx — nietykalny`.
Dowód: `TaskDetailView.tsx:1094`, `DecisionDetailView.tsx:2060-2061`, `AttachmentsLinksCanvas.tsx:842-847`.
Co dostarczyłem ZAMIAST zmiany: czerwono-zielony kontrakt wołaczy, realny `ApiGateway`/PG upload-list-download-delete Zadania, upload-list-delete Decyzji, 403/readback oraz precyzyjny brief granicy.
Co zrobiłbym, gdyby zapadła decyzja X: rozszerzyłbym licencję o load/effect obu widoków, aby przy wejściu wołać listę; dodałbym kontrakt `onDownload` do `AttachmentsLinksCanvas` i podłączył ten sam auth-fetch-blob.
Rekomendacja dla nadzorcy: wydać osobny, rozłączny dyżur na hydration obu widoków oraz uwierzytelniony download canvas/bespoke Decision.
Stan: zacommitowano częściowo w `d5842b4071` i `4cc7becc31`.
Czy kontynuowałem pozostałe pozycje: TAK — R3 zmierzono, R4 opisano pole po polu.

## W-D — granica rozłączności

```text
$ git diff --name-only cefa960d00..HEAD
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY148_ZALACZNIKI_FRONT_REPORT.md
src/components/MyWork/DecisionDetailView.tsx
src/components/MyWork/TaskDetailView.tsx
src/components/MyWork/__tests__/day148.objectAttachments.realpg.test.ts
src/components/MyWork/__tests__/day148.objectAttachments.test.ts
```

`git diff --name-only ... -- server src/components/MyWork/shared src/components/shared/NModeSections/AttachmentsLinksCanvas.tsx` zwrócił 0 ścieżek. Backend, migracje, współdzielony `MutationResult`, notebook i canvas mają zero zmian.

## Artefakty

```text
4a7b4539a7a506829d6f6a84082bc51a70b89c034f2f08f844b45713c6a1e4f4  day148-before.json
dd9692e2c1b7b32e395d01ff5f080162a44878311d9002621e3dc74798e4d4f3  day148-after-final.json
8fa5990045ce3a5a1d1b2a6bb855358d60ef73eea3973a24fc4636502c9fae4a  day148-realpg-final.json
b3801d73342e88f2c82c2b3bef7da125f6eaaa18982e542ac2d7994847a4e220  migrate-first.log
0f5dc446ce36db4b7d72c4ccb63d436e9c6a37abc6bc12b4ba51ee052031a30e  migrate-second.log
```

Pełne ścieżki: `/private/tmp/cx-day148-zalaczniki-front-artefakty/<nazwa>`.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano F5 w Zadaniu ani Decyzji; statyczny dowód wskazuje, że osobna lista `object_attachments` nie jest ładowana przy wejściu.
- Nie zweryfikowano pobrania chronionego pliku z `AttachmentsLinksCanvas` ani bespoke tabeli Decyzji; canvas nadal używa `window.open`.
- Nie wykonano zrzutów UI ani pełnego runtime na portach 4962/4963, ponieważ nie było legalnej drogi do pełnego B4/B6 bez rozszerzenia licencji.
- ESLint dwóch wielkich widoków ma zastane błędy/ostrzeżenia (m.in. sortowanie importów); nie uruchomiono szerokiego autofixu. Dwa nowe testy mają 0 błędów i 2 ostrzeżenia `no-explicit-any` w odczycie dowodowym.

## Commity i push

```text
d5842b4071 fix(my-work): persist task attachments via API
4cc7becc31 fix(my-work): persist decision attachments via API
```

Push: **NIE WYKONANO**, zgodnie z §0.1-BIS.
