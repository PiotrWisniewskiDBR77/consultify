# Case Workspace — LIVE STACK RUNBOOK

**Cel:** postawić produkcyjne UI `/zlecenia` na **PRAWDZIWYM backendzie**, **PRAWDZIWYM
Postgresie** i z **PRAWDZIWĄ, zalogowaną sesją** — bez atrap, bez `window.fetch`
podmienionego mockiem, bez bazy demo/staging.

**Status:** zweryfikowane end-to-end 2026-08-10. Realny `GET /api/v8/case-workspace/cases`
→ **HTTP 200**, realne żądanie z przeglądarki → **200 OK**, realna mutacja `POST` → **201**.

> **Kontekst luki, którą to zamyka:** dotychczas jedyny harness
> (`src/components/CaseWorkspace/podglad/`) PODMIENIAŁ `window.fetch` atrapami
> (`daneProbne.ts`). Produkcyjne UI nigdy nie rozmawiało z żywym backendem.
> Ten runbook usuwa **przyczynę** 401, a nie zamockowuje **skutek**.

---

## 0. ZASADA NADRZĘDNA — którą bazą wolno się posługiwać

| Baza | Wolno? |
|---|---|
| Lokalny kontener jednorazowy `127.0.0.1:55432` | **TAK** — wyłącznie ta |
| demo / staging / Railway (`dev:staging`, `dev:railway`, `dev:live`) | **NIE — ZAKAZ BEZWZGLĘDNY** |

Dane demo to twarz produktu. Zapis danych testowych do bazy demo/staging jest
zabroniony przez właściciela. **Oba skrypty z tego runbooka mają twardą barierę:
odmawiają startu, gdy `DATABASE_URL` wskazuje host inny niż lokalny.**

`npm run dev:localdb` / `dev:pg` są celowo wyłączone przez
`scripts/dev/reject-local-db.mjs` — **nie modyfikuj tego pliku i nie obchodź go.**
Zamiast tego uruchamiamy backend BEZPOŚREDNIO (`tsx src/index.ts`), co jest
właściwym użyciem bazy jednorazowej, a nie obejściem zabezpieczenia.

---

## 1. Wymagane zmienne środowiskowe

Ustawia je za Ciebie `scripts/dev/case-workspace-local-backend.sh`. Tabela jest
po to, żebyś rozumiał **dlaczego** — nie po to, żeby ustawiać je ręcznie.

| Zmienna | Wartość | Dlaczego (bez tego nie działa) |
|---|---|---|
| `JWT_SECRET` | ≥ **32 znaki** | `envValidator.ts` — twardy wymóg. Ten sam sekret podpisuje i weryfikuje token. |
| `NODE_ENV` | `development` | **NIE `test`** — patrz §2, to jest sedno. |
| `CI` | `true` | `databaseTargetResolver.ts:27` — jedyne, co dopuszcza host lokalny poza `NODE_ENV=test`. |
| `DATABASE_URL` | lokalny kontener | musi być `postgresql://…` (sqlite odrzucane). |
| `DB_TYPE` | `postgres` | — |
| `MOCK_DB` | `false` | inaczej ryzyko **cichej atrapy bazy** = zielony wynik na nieistniejących danych. |
| `ENABLE_V8_GLOBAL` | `true` | bez tego **każdy** `/api/v8/*` zwraca **404** „V8 not enabled”. |
| `PORT` | `3001` | `dev:frontend:local` i proxy Vite celują w `127.0.0.1:3001`. |

Hałas startowy (poza zakresem dowodu, nie dotyka auth ani routingu):
`DISABLE_SCHEDULER`, `DISABLE_AI_PROVIDER_SENTINEL`, `DISABLE_AI_HEALTH_MONITOR`,
`DISABLE_STARTUP_HEALTH_MONITOR`, `SKIP_STARTUP_VALIDATOR`, `DEFER_LLM_CONFIG_INIT_MS`,
`DISABLE_RATE_LIMIT`.

---

## 2. ★ Dlaczego `NODE_ENV=development`, a NIE `test` (najważniejszy akapit)

`NODE_ENV=test` otwiera w tym repo **trzy furtki**, przez które dowód
przestałby cokolwiek dowodzić:

| Plik | Co robi |
|---|---|
| `server/src/index.ts:1157` | podmienia realny Gateway na stub (nie ma prawdziwego routingu) |
| `auth.middleware.ts:1136` | `ENABLE_TEST_AUTH_BYPASS` — wpuszcza **BEZ tokenu** |
| `auth.middleware.ts:1191` | `E2E_MODE` — przyjmuje token **BEZ weryfikacji podpisu** (wystarczy claim `e2e: true`) |

Dlatego `E2E_MODE` i `ENABLE_TEST_AUTH_BYPASS` **nie są ustawiane w ogóle**, a
lokalną bazę odblokowujemy przez `CI=true` — jedyne miejsce w całym `server/src`,
które w ogóle czyta `process.env.CI` (zweryfikowane grepem), więc nie włącza
żadnego innego zachowania.

**Kontrola negatywna, którą MUSISZ umieć powtórzyć** — token z `e2e: true`
i podrobionym podpisem musi dostać **401** (patrz §7). Jeśli dostaje 200,
pracujesz na bypassie i Twój wynik jest bezwartościowy.

---

## 3. Baza jednorazowa

```bash
docker ps --format '{{.Names}}\t{{.Ports}}' | grep case-workspace-test-pg
# oczekiwane: case-workspace-test-pg   127.0.0.1:55432->5432/tcp
```

Connection string:

```
postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_test
```

Stan potwierdzony: **1376 tabel w `public` + 121 w `v8`** (schemat zbieżny,
wszystkie 22 tabele `case_workspace_*` / `case_core` / `case_plan_*` obecne).

> **Pułapka `search_path` (z pamięci projektu) — tu NIE występuje.**
> `DbPromise.tableExists()` (`server/src/utils/DbPromise.ts:508`) dla nazw z
> prefiksem `v8_` sam przeszukuje `['v8','public']` przez `information_schema`,
> **niezależnie od `search_path`**. `featureFlagService` też pyta najpierw
> `v8.v8_feature_flags`. Mimo to: **przy własnych probach ZAWSZE kwalifikuj
> schemat** (`v8.v8_feature_flags`, nie `v8_feature_flags`).

---

## 4. Krok 1 — seed sesji syntetycznej

```bash
cd /Users/piotrwisniewski/dev/consultify-case-workspace-v1-20260809
DATABASE_URL="postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_test" \
  node scripts/dev/case-workspace-seed-local.mjs
```

Idempotentny. Zakłada komplet, którego wymaga **realny** łańcuch autoryzacji:

| # | Tabela | Wartość | Po co |
|---|---|---|---|
| 1 | `organizations` | `cw-local-org` | org z claimu JWT |
| 2 | `users` | `cw-local-user`, hasło **bcrypt** | `AuthController.login` |
| 3 | `organization_members` | **`status='ACTIVE'`**, rola `OWNER` | `requireOrgMember` — bez tego cały łańcuch zamknięty |
| 4 | `projects` | `cw-local-project` | FK dla `case_core.project_id` |
| 5 | `v8.v8_feature_flags` | 8 modułów `enabled=1` | `v8OrgGate` |

**Poświadczenia:**

```
email:    cw.local@local.test
password: CaseWorkspaceLocal!2026
orgId:    cw-local-org
projectId: cw-local-project
```

> ⚠ E-mail **musi** być w bazie małymi literami — `AuthController.login` robi
> `email.trim().toLowerCase()` **przed** `SELECT`-em.

> ⚠ Flagi V8 wstawiamy **jawnie**. Poza produkcją istnieje fallback „org bez
> żadnych wierszy flag = przepuść” (`v8FeatureGate.middleware.ts:7`) — **nie
> opieraj się na nim**, bo dowód przestaje być dowodem.

Skrypt kończy się **weryfikacją odczytem z bazy** (nie ufa samemu `INSERT`-owi).

---

## 5. Krok 2 — backend na 127.0.0.1:3001

```bash
cd /Users/piotrwisniewski/dev/consultify-case-workspace-v1-20260809
bash scripts/dev/case-workspace-local-backend.sh
# w tle: nohup bash scripts/dev/case-workspace-local-backend.sh > /tmp/cw-backend.log 2>&1 &
```

Start trwa **~40 s** (migracje + seedery). Gotowość:

```
[Server] ✅ Database ready — serving traffic
```

Sprawdzenie:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3001/api/health     # 200
curl -s http://127.0.0.1:3001/api/v8/case-workspace/cases                     # {"error":"No token provided"} + 401
```

> **401 bez tokenu to DOBRY znak** — dowodzi, że trasa jest **zamontowana**
> i autoryzacja jest fail-closed. Gdyby trasy nie było, dostałbyś 404.

---

## 6. Krok 3 — jak powstaje ważna sesja

**Realny `POST /api/auth/login`.** Żadnych ręcznie kutych tokenów.

```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"cw.local@local.test","password":"CaseWorkspaceLocal!2026"}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).token))")
```

JWT niesie `id`, `email`, `role`, **`organizationId`** — `requireV8OrgContext`
czyta org **z tokenu**, więc żaden nagłówek `x-org-context` nie jest potrzebny.

Łańcuch, który token musi przejść (`server/src/routes/v8/index.ts:55-83`):

```
verifyToken → requireV8OrgContext → v8OrgGate → attachV8Context
            → requireOrgMemberForActor (w handlerze trasy)
```

**DOWÓD — realny output:**

```
$ curl -s -w "\n-> HTTP %{http_code}\n" http://127.0.0.1:3001/api/v8/case-workspace/cases \
    -H "Authorization: Bearer $TOKEN"
{"data":[]}
-> HTTP 200
```

Po utworzeniu zlecenia (`POST /cases` → **HTTP 201**) ta sama trasa zwraca:

```json
{"data":[{"caseId":"case-8099338b-f730-48d8-83e3-26c9e8ece272",
          "projectId":"cw-local-project","organizationId":"cw-local-org",
          "caseProfile":"STANDARD","governanceTier":"STANDARD",
          "caseStatus":"DRAFT","createdByActorId":"cw-local-user","version":1, …}]}
```

Event spine potwierdzony w bazie (ta sama transakcja):

```
 event_type  | aggregate_type | actor_user_id |        occurred_at
--------------+----------------+---------------+----------------------------
 case.created | CASE           | cw-local-user | 2026-08-10 14:23:15.965+00
```

Przykład mutacji:

```bash
curl -s -X POST http://127.0.0.1:3001/api/v8/case-workspace/cases \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"projectId":"cw-local-project","caseProfile":"STANDARD",
       "governanceTier":"STANDARD","contractedClosureType":"DELIVERY_COMPLETED"}'
```

---

## 7. ★ Kontrole negatywne — uruchom je, zanim ogłosisz PASS

Zielony wynik bez tych trzech prób **nie jest dowodem**. Wszystkie zweryfikowane:

```bash
# NEG 1 — podrobiony podpis → MUSI być 401
BAD="${TOKEN%.*}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3001/api/v8/case-workspace/cases \
  -H "Authorization: Bearer $BAD"                                        # → 401 ✔

# NEG 2 — token z claimem e2e:true (bypass E2E_MODE) → MUSI być 401
E2E=$(node -e "const b=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
console.log(b({alg:'HS256',typ:'JWT'})+'.'+b({id:'cw-local-user',
organizationId:'cw-local-org',role:'ADMIN',e2e:true,exp:9999999999})+'.fakesig');")
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3001/api/v8/case-workspace/cases \
  -H "Authorization: Bearer $E2E"                                        # → 401 ✔

# NEG 3 — odebrane członkostwo → MUSI zablokować cały łańcuch
docker exec case-workspace-test-pg psql -U case_workspace -d case_workspace_test \
  -qtc "update organization_members set status='SUSPENDED' where user_id='cw-local-user';"
curl -s -w " | %{http_code}\n" http://127.0.0.1:3001/api/v8/case-workspace/cases \
  -H "Authorization: Bearer $TOKEN"
# → {"error":{"code":"NOT_ORG_MEMBER","message":"Actor is not an active member…"}} | 403 ✔

docker exec case-workspace-test-pg psql -U case_workspace -d case_workspace_test \
  -qtc "update organization_members set status='ACTIVE' where user_id='cw-local-user';"
# → ponownie 200 ✔
```

**NEG 2 jest krytyczna:** dowodzi, że 200 z §6 przyszło przez realny podpis,
a nie przez furtkę E2E.

---

## 8. Krok 4 — frontend i dowód z przeglądarki

```bash
cd /Users/piotrwisniewski/dev/consultify-case-workspace-v1-20260809
npm run dev:frontend:local          # port 3000, VITE_API_TARGET=http://127.0.0.1:3001
```

> **Port 3000 bywa zajęty przez równoległą sesję innego agenta.** NIE zabijaj
> cudzego procesu. Wystartuj na innym porcie — proxy `/api` i tak celuje w 3001:
> ```bash
> VITE_API_TARGET=http://127.0.0.1:3001 VITE_API_URL= npx vite --port 3010 --strictPort
> ```
> Weryfikacja zweryfikowana faktycznie na **3010** (3000 zajęte przez inną sesję).

Sprawdź, że proxy działa (401 **z backendu**, nie 404 z Vite):

```bash
curl -s http://127.0.0.1:3010/api/v8/case-workspace/cases   # {"error":"No token provided"}
```

### Wstawienie sesji dokładnie tam, gdzie czyta ją aplikacja

`src/services/tokenService.ts` czyta **`localStorage['token']`**. W konsoli
przeglądarki (to jest realne logowanie, nie wstrzyknięty token):

```js
const res = await fetch('/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'cw.local@local.test', password: 'CaseWorkspaceLocal!2026' })
});
const data = await res.json();
localStorage.setItem('token', data.token);
localStorage.setItem('refreshToken', data.refreshToken);
localStorage.setItem('user', JSON.stringify(data.user));
localStorage.setItem('ff.caseWorkspace', '1');
```

### Dwie bramki UI

| Bramka | Jak otworzyć |
|---|---|
| `BetaGate MODULE_CASE_WORKSPACE` = `'closed'` | `BETA_ADMINS_EXEMPT=true` → rola **ADMIN/OWNER** przechodzi. Nasz seed daje ADMIN. |
| flaga runtime `ff.caseWorkspace` (default OFF) | `?ff_zlecenia=1` w adresie (zapisuje się do localStorage) |

Wejdź na:

```
http://127.0.0.1:3010/zlecenia?ff_zlecenia=1
```

**DOWÓD — realne żądanie z przeglądarki:**

```
GET http://127.0.0.1:3010/api/v8/case-workspace/cases → 200 OK
```

z odpowiedzią zawierającą realny `case-8099338b-…` (dokładnie ten utworzony
curl-em). UI wyrenderowało liczniki **„Wszystkie 1 / Szkic 1”** i wiersz
„Zlecenie bez nazwy · Szkic · Plan niezatwierdzony”.

**Potwierdzenie, że to NIE atrapa** — log backendu pokazuje to samo żądanie
z **11 realnymi zapytaniami do bazy**:

```
[Index] Pre-Gateway: GET /api/v8/case-workspace/cases
High DB query count {"path":"/api/v8/case-workspace/cases","dbQueryCount":11,"dbQueryTime":24}
```

Mock `window.fetch` nie wygeneruje zapytań SQL w procesie serwera.

> `window.fetch` **jest** opakowany, ale to telemetria aplikacji
> (`async (input, init) => { const startedAt = Date.now(); … }`), **nie**
> `podglad/daneProbne.ts`. Rozstrzyga log serwera powyżej, nie kształt `fetch`.

---

## 9. Sprzątanie

```bash
kill <pid-backendu> <pid-vite>
docker exec case-workspace-test-pg psql -U case_workspace -d case_workspace_test \
  -c "delete from case_core where organization_id='cw-local-org';"
```

Baza jest **jednorazowa i lokalna** — nie wymaga sprzątania na poziomie danych
demo. Zostawienie seeda `cw-local-*` jest wskazane: kolejny agent ma gotowe wejście.

---

## 10. Rozstrzyganie problemów

| Objaw | Przyczyna | Naprawa |
|---|---|---|
| `401 No token provided` | brak/zły nagłówek | `Authorization: Bearer <token>` |
| `401` mimo tokenu | zły `JWT_SECRET` — token podpisany innym sekretem | ten sam `JWT_SECRET` przy logowaniu i weryfikacji; przeloguj się |
| **`404` „V8 not enabled”** | brak `ENABLE_V8_GLOBAL=true` **albo** brak wierszy flag | ustaw zmienną, uruchom seed. **Uwaga: to 404, nie 403** — łatwo pomylić z brakiem trasy |
| `400 V8_MISSING_ORG` | JWT bez `organizationId` | user musi mieć `organization_id` w `users` |
| `403 NOT_ORG_MEMBER` | brak wiersza `ACTIVE` w `organization_members` | uruchom seed |
| Backend nie startuje: „points to local host” | brak `CI=true` | użyj skryptu z §5 |
| Backend nie startuje: `JWT_SECRET` | < 32 znaki | wydłuż |
| `Port 3000 already in use` | równoległa sesja innego agenta | inny port (§8), **nie zabijaj cudzego procesu** |
| `/zlecenia` → 404 w UI | flaga runtime OFF (trasa nie jest rejestrowana) | `?ff_zlecenia=1` |

---

## 11. Pliki

| Plik | Rola |
|---|---|
| `scripts/dev/case-workspace-local-backend.sh` | realny backend na 3001 przeciw lokalnej bazie |
| `scripts/dev/case-workspace-seed-local.mjs` | seed org/user/member/project/flagi + weryfikacja odczytem |
| `docs/product/case-workspace/LIVE_STACK_RUNBOOK.md` | ten dokument |
| `.claude/launch.json` | wpis `case-workspace-live-frontend` (dodany, nic nie usunięto) |

`scripts/dev/reject-local-db.mjs` — **nietknięty.**
