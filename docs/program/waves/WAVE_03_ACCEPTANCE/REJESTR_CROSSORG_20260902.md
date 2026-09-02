---
doc_id: rejestr-crossorg-20260902
status: measured
owner: piotr
truth_type: evidence
established: 2026-09-02
---

# Rejestr weryfikacji dziur cross-org — pomiar 2026-09-02

**Zlecenie:** zweryfikować, czy sześć dziur cross-org z
`docs/program/funkcje/AUDYT_RODZINY_TRAS_UPRAWNIENIA.md` (2026-09-01) jest naprawdę
zamkniętych. **POMIAR, nie naprawa** — żaden plik produkcyjny nie został zmieniony
poza tymczasowymi mutacjami K4, przywróconymi co do bajtu (`git status` czysty).

**Marker:** `6fe16e2bd4`. **Gałąź:** `agent/crossorg-weryfikacja-20260902`.
**Środowisko:** Postgres 16 + pgvector w kontenerze `ag-crossorg-pg` na `127.0.0.1:6270`,
baza `agcross` od zera; migracje **dwukrotnie** (`882` zastosowanych / **`0` w drugim
przebiegu** — idempotencja potwierdzona). Realny `ApiGateway.getInstance().initializeRoutes(app)`
na porcie `5262` (`scripts/crossorg/harness-server.ts`), z jawnym probem bazy w logu:
`DB PROBE: {"db":"agcross","v":"PostgreSQL 16.15..."}` — to NIE jest atrapa `DbPromise`.
Pomiar skryptem `npx tsx scripts/crossorg/proof.ts`, **nie przez `vitest`** (atrapa
`global.fetch` w `tests/setup.ts:858-896` dałaby fałszywy sukces).

**Dwie organizacje założone realną trasą** `POST /api/auth/register` (podpisane JWT,
prawdziwy bcrypt), nie `INSERT`-em:
- **A (właściciel)** `organizationId=5557766b-5a6d-48ed-ba63-af023543509a`, user `3e6d9b25-…`
- **B (obcy/atakujący)** `organizationId=0efcc01d-557e-4670-bda0-9a5069e304a3`, user `0227e462-…`

Każde twierdzenie o zapisie potwierdzone **odczytem na zimno** przez `pg.Client`
(pułapka `Database.ts:686` — `changes:1` dla każdego `UPDATE` — omijana z definicji).

---

## ★ Napotkana i obejścia pułapka: rejestracja pada na świeżej bazie (42704)

Potwierdzone co do joty. `server/src/services/emailVerificationService.ts:26` tworzy
w locie `email_verification_tokens` w **dialekcie SQLite** (`DATETIME`), czego Postgres
nie zna → `error: type "datetime" does not exist` (`code: 42704`) i **ubicie całego
procesu serwera** (unhandled rejection, brak error middleware w `Gateway.ts`).

Obejście na potrzeby pomiaru (nie naprawa — to dyżur 281): tabela założona ręcznie
z `TIMESTAMP`. Zmierzone: `CREATE TABLE IF NOT EXISTS` w dialekcie SQLite **nie wywraca
się**, gdy tabela już istnieje (Postgres daje `NOTICE ... skipping`).

---

## Tabela werdyktów

| # | Rodzina | Trasa (plik:linia) | Para dowodów | Dowód mutacyjny | **WERDYKT** |
|---|---|---|---|---|---|
| 1 | **Wnioski o uprawnienia** | `server/src/routes/permissionRequests.routes.ts:85` (`PUT /api/permission-requests/:id/approve`) i `:107` (`/reject`); strażnik `:19` | **PASS** — obcy `404`, `status` w bazie dalej `pending`; właściciel `200`, `status=approved` / `rejected`, `resolved_by` = user A | **SKUTECZNY** — po skasowaniu strażnika obcy `200`, w bazie `status=approved`, `resolved_by` = **user B** | **ZAMKNIĘTA** |
| 2 | **Wideo** | `server/src/routes/videos.routes.ts:72` (`DELETE /api/videos/:id`); strażnik `:16` | **NIE DA SIĘ ZBUDOWAĆ** — tabela `videos` **nie powstaje z żadnej z 1087 migracji**; `POST /api/videos` zwraca `201` i **nie zapisuje nic** (fail-soft `DbPromise`); `GET` właściciela `[]`; `DELETE` obcego `404` **i `DELETE` właściciela też `404`** | mutacja zmienia obie strony na `200`, ale **nadal nie ma danych** — test nie broni niczego | **WYGASZONA** |
| 3 | **Kontekst AI — DWIE trasy (potwierdzone)** | `server/src/routes/context.routes.ts:86` (`PUT /api/context/:id`) i `:137` (`DELETE /api/context/:id`); strażnik `:18` | **PASS na obu trasach** — obcy `404` + rekord nietknięty / nieskasowany; właściciel `200` + zmiana nazwy / usunięcie wiersza potwierdzone na zimno | **SKUTECZNY na obu** — po skasowaniu strażnika obcy `200`, nazwa `PWNED BY ORG B`, `DELETE` obcego usuwa wiersz | **ZAMKNIĘTA** (strażnik), ale rodzina funkcjonalnie martwa — patrz niżej |
| 4 | **Wstrzyknięcie obcego administratora do projektu** | `server/src/routes/pmo/project-members.routes.ts:80/130/197/267/342` (`GET/POST/PUT/DELETE /api/project-members/:projectId(/:memberId)`); strażnik `:55` | **PASS** — obcy `GET/POST/PUT/DELETE` = `404`, zero wstrzykniętych wierszy; właściciel `POST` `201`, `GET` `200` (1 członek), `DELETE` `200` z pustym odczytem na zimno | **SKUTECZNY** — po skasowaniu strażnika obcy `GET 200`, `POST 201` z **realnym wierszem `project_members` dla user B w projekcie org A**, `PUT 200` (rola `VIEWER`), `DELETE 200` | **ZAMKNIĘTA** |
| 5 | **CRUD cudzych dokumentów (Studio)** | `server/src/routes/studio.routes.ts:41/110/167/194/216/244`; strażnik `server/src/services/StudioService.ts:125` | **PASS** — obcy `GET/PUT/DELETE` = `404`, `GET /snapshots` = `200` z **0** elementów przy **1** u właściciela, `POST /snapshots/:id/restore` = `404`; właściciel `GET/PUT/DELETE/snapshots/restore` = `200/201` z potwierdzonym skutkiem | **SKUTECZNY** — po skasowaniu strażnika obcy czyta (`200`), nadpisuje na `PWNED BY ORG B`, widzi snapshoty (1) i **kasuje dokument** | **ZAMKNIĘTA** |
| 6 | **Zmiana cudzych eskalacji** | `server/src/routes/notifications/notifications.routes.ts:467` (`GET /api/notifications/escalations/:projectId`) i `:495` (`POST .../run`); strażnik `server/src/services/escalationService.ts:169`, wołany `:185` i `:208` | **PASS** — obcy `GET` = `200` `[]` bez wycieku tytułu, `POST /run` = `processed:0` i `escalation_level` + `updated_at` **bit w bit takie same** na zimno; właściciel `GET` widzi swoją decyzję, `POST /run` = `processed:2, redAlerts:1`, poziom `NORMAL → red` | **SKUTECZNY** — po skasowaniu strażnika obcy `GET` zwraca pełną treść `OrgA Confidential Board Decision`, a `POST /run` zmienia `escalation_level` na `red` i `updated_at` na dziś | **ZAMKNIĘTA** |

**Wynik zbiorczy pary dowodów:** `34/36 PASS` przed mutacją, `14/36` po mutacji,
`34/36` po przywróceniu. Dwie pozycje „nie-PASS" to **znaleziska o wygaszeniu**
(#2 i kanał tworzenia #3), nie porażki strażnika.

---

## ★ Znalezisko 1 — Wideo: „zamknięte przez wygaszenie" w czystej postaci

`grep -rniE "create table (if not exists )?videos"` po całym `server/` i `src/` daje
**zero trafień**; `server/migrations/` ma 1087 plików i żaden nie zakłada `videos`.
Skutek zmierzony na żywym Gatewayu:

```
POST /api/videos (org A)      -> 201 {"success":true,"id":"…"}   ← NIC nie zapisano
GET  /api/videos (org A)      -> 200 []
DELETE /api/videos/:id (org B) -> 404   ← "obcy nie może"
DELETE /api/videos/:id (org A) -> 404   ← WŁAŚCICIEL TEŻ NIE MOŻE
```

Fail-soft odpowiada `server/src/utils/DbPromise.ts` (`fallback = true` domyślnie,
błędy „table doesn't exist" świadomie **nie są nawet logowane**). Strażnik
`videoBelongsToOrg` czyta z nieistniejącej tabeli → `null` → `false` → `404` **dla
każdego**. Noga negatywna jest zielona wyłącznie dlatego, że funkcja nie działa dla nikogo.

Sam autor naprawy zostawił uczciwy test warunku wstępnego —
`server/src/routes/__tests__/day242-videos-org-isolation.realpg.test.ts` — i ten test
**pada** na bazie od zera (`expected [] to deeply equal [{ column_name: 'organization_id' }]`).
Uruchomione przeze mnie: `1 failed | 2 passed (3 pliki)`, `1 failed | 4 passed (5 testów)`.

**Wniosek:** dziury #5 z audytu nie da się dziś ani wykorzystać, ani udowodnić, że jest
zamknięta. To nie jest zabezpieczenie — to awaria udająca zabezpieczenie.

## ★ Znalezisko 2 — Kontekst AI: strażnik działa, ale rodzina jest martwa

Twierdzenie z `SCIEZKA_WYJSCIA_V2.md`, że **kontekst AI ma dwie trasy, nie jedną**,
jest **prawdziwe i potwierdzone**: `PUT /api/context/:id` (`context.routes.ts:86`)
oraz `DELETE /api/context/:id` (`:137`). Audyt z 01.09 wymieniał tylko `DELETE` —
naprawa objęła obie. Poza `context.routes.ts` **nie ma innej trasy mutującej
`ai_contexts`** (sprawdzone: jedyny inny czytelnik to
`OrganizationContextService.ts:1217`, wyłącznie `SELECT ... WHERE organization_id = ?`).

Ale kanał tworzenia i listowania jest **zepsuty na schemacie od zera**:
`ai_contexts` **nie ma kolumny `user_id`**, a trasa `POST /api/context`
(`context.routes.ts:62`) wymienia ją w `INSERT`, zaś `GET /api/context`
(`context.routes.ts:41`) w `WHERE (user_id = ? OR organization_id = ?)`. Zmierzone:

```
POST /api/context (org A) -> 201 {"success":true,"id":"…"}   ← 0 wierszy w ai_contexts
log serwera: [DB:Promise] Statement error {"error":"column \"user_id\" of relation \"ai_contexts\" does not exist"}
GET  /api/context (org A) -> 200 []   ← przy 1 wierszu org A wstawionym wprost do bazy
```

Dlatego parę dowodów dla strażnika zbudowałem na rekordzie **wstawionym wprost do bazy**
(ten sam obejściowy chwyt stosuje istniejący test
`day242-context-org-isolation.realpg.test.ts`). Na takim rekordzie strażnik broni
poprawnie w obie strony i mutacja go obala — więc **kod zabezpieczenia jest prawdziwy**.
Werdykt dla rodziny jako funkcji: nieużywalna, dopóki `POST`/`GET` nie zostaną naprawione.

## ★ Znalezisko 3 — trzy „naprawione" rodziny są naprawione naprawdę

Twierdzenie z `SCIEZKA_WYJSCIA_V2.md` („kontrola obecna, testy regresyjne na realnym
Postgresie istnieją") **potwierdzone własnym pomiarem**, nie odczytem dokumentu.
Wszystkie trzy (#4 wstrzyknięcie administratora, #5 CRUD dokumentów, #6 eskalacje)
mają pełną parę dowodów i **skuteczny dowód mutacyjny**. Najmocniejszy: po skasowaniu
`projectBelongsToOrg` organizacja B **realnie wstawia swojego użytkownika jako ADMIN
do projektu organizacji A** (`POST -> 201`, wiersz `project_members` obecny na zimno);
po przywróceniu strażnika `404` i zero wierszy.

**Uwaga porządkowa:** przebieg mutacyjny **zostawia realne uszkodzenie danych**
(user B jako członek projektu org A, dokument nadpisany na `PWNED BY ORG B`,
`escalation_level` cudzej decyzji na `red`). W tym pomiarze posprzątane ręcznie;
przy powtarzaniu — sprzątać, bo to jest dowód na to, że atak jest realny.

---

## Pułapka montowania — co to znaczy dla stagingu

`Gateway.ts:485-486` liczy `enableStubRoutes = !isProduction || ENABLE_STUB_ROUTES==='true'`.

- `permissionRequestsRoutes` (`Gateway.ts:920`) i `videoRoutes` (`:1319`) — poza listą
  `STUB_NAMES_WITH_LIVE_UI_ON_DEMO` → na produkcji **cichy 404** (trasa niezmontowana).
- `contextRoutes` (`Gateway.ts:1070`) — **na liście** (`:508`) → uczciwe `501`.
- `projectMembersRoutes` (`:1159`), `studioRoutes` (`:1338`), notyfikacje (`:905`) —
  montowane **bezwarunkowo**, żywe wszędzie.

`Dockerfile`, `Dockerfile.api` i `Dockerfile.ie-demo` ustawiają `ENV NODE_ENV=production`,
a `ENABLE_STUB_ROUTES` nie jest ustawiane w żadnym pliku wdrożeniowym w repo (tylko
w trzech testach jednostkowych bramki). **Więc na demo i na stagingu #1/#2/#3 są
wygaszone montowaniem** — ale w moim pomiarze (`NODE_ENV=test`) były żywe, i to na nich
zmierzyłem strażników.

---

## Jak powtórzyć

```bash
docker run -d --name ag-crossorg-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=agcross \
  -p 127.0.0.1:6270:5432 pgvector/pgvector:pg16
source scripts/crossorg/env.sh
npx tsx server/scripts/migrate.postgres.ts        # dwa razy: 882 -> 0
docker exec ag-crossorg-pg psql -U postgres -d agcross -c \
  "CREATE TABLE IF NOT EXISTS email_verification_tokens (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, \
   email TEXT NOT NULL, token_hash TEXT NOT NULL, expires_at TIMESTAMP NOT NULL, used_at TIMESTAMP, \
   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);"   # obejście 42704, patrz wyżej
npx tsx scripts/crossorg/harness-server.ts &      # realny ApiGateway na 5262
# POST /api/auth/register x2 -> TOK_A, TOK_B, ORG_A_ID, ORG_B_ID, USER_A_ID, USER_B_ID
npx tsx scripts/crossorg/proof.ts
```

Dowody surowe w repo: `scripts/crossorg/wynik-bazowy.log` (przed mutacją),
`scripts/crossorg/wynik-mutacja.log` (po skasowaniu strażników),
`scripts/crossorg/wynik-po-przywroceniu.log` (powrót do stanu bazowego).
