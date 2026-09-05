# Dwie blokady strukturalne odbioru 05.09 — pomiar i naprawa

Gałąź: `agent/blokady-roi-approver-20260905` (baza: linia m03, `1cea82c7c0`).
Źródło zlecenia: `evidence/odbior-zywo-20260905/RUNDA2_RAPORT.md`, sekcja
„Defekty odsłonięte przy okazji" → dwie pozycje oznaczone jako blokady strukturalne.

| Commit | Zakres |
|---|---|
| `1e886fc4cb` | ROI — włączenie domeny przez OWNER/ADMIN z UI |
| `c3055af1af` | Ocena — właściciel organizacji może zamrozić |
| `4dc7f4ba42` | Testy realdb + HTTP-pg na obie blokady |
| (ostatni commit gałęzi) | Zrzuty, ekrany harnessu, ten raport |

---

## BLOKADA 1 — domena ROI wygaszona dla organizacji

### Co zmierzyłem (mechanizm, nie dokumentacja)

Polityka ma pełną, działającą mechanikę serwerową — brakowało jednego przewodu do UI.

| Element | Gdzie | Stan przed |
|---|---|---|
| Tabela polityki | `server/migrations/20261020_roi_governed_visibility_policy.sql` → `rvn_roi_visibility_governance` (1 wiersz/organizacja, PK, **append-only** trigger) | istnieje |
| Komenda publikacji | `visibilityResolver.publishRoiGovernedVisibilityPolicy` — wymaga **same-tenant ACTIVE OWNER/ADMIN** czytanego wprost z `organization_members` | istnieje |
| Trasa publikacji | `POST /api/vnext/results/roi/visibility-policy` (`roi.routes.ts`) | istnieje |
| **Wołacz w `src/`** | — | **ZERO** (`rg "visibility-policy" src/` → pustka) |
| Bramka odczytu | `resolveRoiGovernedVisibility` → `NO_GOVERNED_POLICY` gdy brak wiersza | fail-closed |
| Skutek na `GET /cases` | `roi.routes.ts` przy odmowie zwraca `200 {cases: []}` — **nigdy 403** (świadoma zasada niewyciekania) | pusty rejestr |
| Skutek na `POST /cases` | `roiCaseCommands.createRoiCase` → `RoiCaseCreationNotAuthorizedError` → 403 `ROI_CASE_CREATION_NOT_AUTHORIZED` | odmowa |

**Kto publikuje:** OWNER albo ADMIN organizacji (wiersz `organization_members`,
`UPPER(status)='ACTIVE'`). **Nie superadmin z samego tokenu** — ta bramka celowo nie
konsultuje wildcardu 15A (`resolveRoiGovernedVisibility`, komentarz w kodzie: token
SUPERADMIN bez wiersza członkostwa jest tu odmawiany).

**Dlaczego DBR77 jej nie ma:** bo nikt nigdy nie wywołał tej trasy — nie było skąd.
Endpoint powstał w pakiecie AMD-FLOW-ROI-VISIBILITY-002 razem z testami i fixturami
testowymi, ale interfejs nigdy nie dostał ani przycisku, ani odczytu stanu. To
dwunasty kształt z rejestru („biblioteka bez wywołania") w czystej postaci.

### Co zrobiłem

Naprawa **produktowa, bez rozmiękczania reguły**: fail-closed zostaje fail-closed —
żadnego domyślnego `OPEN_ORG`, żadnej fabrykowanej polityki, zero zmian w regule dostępu.
Dołożony jest brakujący przewód:

1. `visibilityResolver.getRoiGovernedVisibilityPolicyStatus()` — czysty odczyt:
   `{published, publication, canPublish, blocker}`; `canPublish` liczone **tą samą**
   funkcją `readSameTenantActiveMembershipRole`, której używa komenda publikacji, więc
   ekran nie może zaproponować akcji, której serwer i tak odmówi.
2. `GET /api/vnext/results/roi/visibility-policy` (`roi.routes.ts`).
3. Klient: `getRoiVisibilityPolicyStatus()` + `publishRoiVisibilityPolicy()` (`roiApi.ts`).
4. `ResultsRoiHub.tsx` — gdy domena wygaszona:
   * stan pusty mówi **co** jest nie tak i **kto** to włącza (zamiast „Brak spraw ROI");
   * przycisk Menu 2 zmienia się z „Nowa sprawa ROI" (który zawsze kończył się 403) na
     „Włącz ROI dla organizacji" — **tylko** dla OWNER/ADMIN; zwykły członek nie dostaje
     przycisku wcale, tylko wyjaśnienie.
   Komponenty standardowe bez zmian (`StandardModuleBar.primaryCta`, `StandardTable.empty`)
   — zero własnej tabeli, zero własnego menu.

Odblokowuje to trzy ekrany naraz: rejestr ROI, model ROI, pełne narzędzie ROI.

### Dowód

`server/src/services/resultsVnext/platform/__tests__/roiGovernedVisibilityStatus.realdb.test.ts`
— **2/2 PASS** na realnym Postgresie (pełny schemat, 1803 tabele):

* przed publikacją: OWNER i ADMIN → `canPublish: true`; MEMBER → `ORDINARY_MEMBER_DENIED`;
  członkostwo REVOKED **z rolą OWNER** → `NOT_ACTIVE_MEMBER`; brak wiersza → `NOT_ACTIVE_MEMBER`;
* publikacja **zdejmuje blokadę**: `resolveRoiGovernedVisibility` zwraca
  `NO_GOVERNED_POLICY` przed i `{allow:true, reason:'OWNER'}` po — a to jest dokładnie ta
  odmowa, którą `createRoiCase` zamienia na zmierzone 403.

**Mutacja (dowód, że test broni zabezpieczenia, nie mechanizmu):** skasowanie bramki roli
w `getRoiGovernedVisibilityPolicyStatus` (zawsze `canPublish: true`) → test 1 **FAIL**
(`expected true to be false`), test 2 nadal PASS. Kod przywrócony, `git diff` czysty.

**Regresja:** `roiGovernedVisibility20.realdb.test.ts` + `roi.routes.test.ts` +
`roiFinanceSeam.routes.test.ts` → **72/72 PASS** (część z 163 wyżej).

---

## BLOKADA 2 — rola `approver` nie ma UI w całej aplikacji

### Co zmierzyłem (przepływ zamrażania)

| Element | Gdzie |
|---|---|
| Kto może zamrozić | `contracts/session.ts` → `TRANSITION_AUTHORITY.frozen = ['approver']` |
| Egzekucja | `MethodSessionService.transition()` — role procesowe czytane z `method_session_roles` |
| Trasy | `POST /api/method/sessions/:id/freeze` (ta, której używa UI) oraz `POST /api/method/sessions/:id/approvals` (`decision:'approved'`) — obie idą przez `transition()` |
| Nadanie roli | `POST /api/method/sessions/:id/roles` — **istnieje**, ale `rg` w `src/` → **zero wołaczy**; dodatkowo samo-nadanie `approver` jest odmawiane (`self_elevation_forbidden`, `POWER_ROLES`) |
| Kto ma role na starcie | twórca sesji dostaje automatycznie procesową rolę `owner` (`method-core.routes.ts`, `POST /sessions`) — nigdy `approver` |
| UI | `DrdHttpMethodWorkspaceScreen` → `canFreeze = state.roles.includes('approver')` |

**Wniosek:** w organizacji z jednym kontem zamrożenie było **strukturalnie nieosiągalne** —
przycisk „Zamroź" wyłączony na zawsze, a razem z nim Output, raport z oceny i prezentacja
z oceny. Nie brak danych; brak drugiego krzesła, którego nie da się obsadzić.

### Co zrobiłem

**Mechanizmu ról nie ruszam.** `TRANSITION_AUTHORITY.frozen` dalej brzmi `['approver']`,
`self_elevation_forbidden` dalej działa, `POWER_ROLES` bez zmian. Dołożona jest wąska,
nazwana furtka:

1. `contracts/session.ts` — `TransitionResult.ok` niesie opcjonalne
   `authority: 'process_role' | 'organization_owner'` (żaden istniejący `result.ok` nie
   wymaga zmiany).
2. `MethodSessionService.transition()` — gdy role procesowe nie wystarczają **i tylko dla
   celu `frozen`**, dopuszczamy **same-tenant ACTIVE OWNER organizacji**
   (`organization_members`, `UPPER(status)='ACTIVE'`, `UPPER(role)='OWNER'`) — ta sama
   kanoniczna ścieżka, z której korzysta `effectiveAccessService.readApplicationRole` i
   bramka ROI wyżej. Świadomie **nie** procesowa rola `owner` sesji: tę twórca dostaje
   automatycznie, więc oparcie się o nią skasowałoby rozdział obowiązków dla każdej sesji.
   Fail-closed w każdą stronę: brak wiersza / status ≠ ACTIVE / rola ≠ OWNER / błąd odczytu
   tabeli → odmowa dokładnie jak dotąd.
3. `POST /sessions/:id/freeze` — gdy prawo wzięło się z roli właściciela organizacji,
   dopisujemy wiersz do `method_approvals` (`decision:'approved'`, `actor_user_id`,
   komentarz „Zamrożone przez właściciela organizacji…"). To ten sam ślad, który raport
   z oceny czyta jako „kto zatwierdził" (`src/components/assessment/report/reportApi.ts`).
   Zamrożenie przez prawdziwego approvera idzie przez `/approvals`, który swój wiersz
   zapisuje sam — **nie dublujemy**.
4. `DrdHttpMethodWorkspaceScreen` — `canFreeze` odblokowane także dla właściciela
   organizacji (to steruje wyłącznie WIDOKIEM; decyduje serwer). Przy okazji złapane
   odrzucenie `runtime.freeze()`, żeby ewentualna odmowa lądowała na pasku błędu, a nie
   jako nieobsłużony wyjątek w konsoli.

### Dowód

`server/src/method-core/__tests__/ownerFreeze.http.pg.test.ts` — **5/5 PASS** przez realne
HTTP na realnym Postgresie:

1. **[ALLOW]** org-OWNER **bez** roli `approver` (sprawdzone zapytaniem do
   `method_session_roles`: pusto) zamraża → 200, `state='frozen'`, `frozen_snapshot_id`
   ustawione, Output powstaje, a `method_approvals` ma **dokładnie 1** wiersz z jego id;
   ten sam wiersz widać w `GET /sessions/:id/approvals`.
2. **[DENY]** aktywny MEMBER (twórca sesji, role robocze `owner`+`lead_assessor`) → 403
   `missing_permission` / `requiredRole: approver`, sesja zostaje `in_review`, zero
   wierszy decyzji, zero migawek.
3. **[DENY]** członkostwo REVOKED z rolą OWNER → 403 (decyduje status, nie rola).
4. **[ZAKRES]** furtka tylko dla `frozen`: org-OWNER nie przeprowadzi `frozen → closed`
   (403, `requiredRole: owner`).
5. **[BEZ DUBLA]** prawdziwy `approver` zamrażający przez `/freeze` nie zostawia
   dodatkowego wiersza decyzji.

**Mutacje (5, każda celuje w inne zabezpieczenie):**

| Mutacja | Skutek |
|---|---|
| kasuję całą furtkę (`ownerMayFreeze = false`) | FAIL testy **1** i **4** |
| kasuję warunek `status = ACTIVE` | FAIL test **3** |
| kasuję zawężenie `to === 'frozen'` | FAIL test **4** |
| kasuję zapis śladu „kto zamroził" | FAIL test **1** |
| zapisuję ślad bezwarunkowo | FAIL test **5** |

Kod po każdej mutacji przywracany; `git status` czysty.

**Regresja:** `rolesAndApprovals.http.pg.test.ts`, `freezeOutputFlow.integration.test.ts`,
`http.integration.test.ts`, `drdVerticalSlice.e2e.test.ts`, `siriFullFlow.integration.test.ts`
→ **91/91 PASS**. W szczególności R2 („aktor bez roli approver nie zamrozi") dalej zielony:
użytkownicy w tych plikach nie mają wierszy w `organization_members`, więc furtka ich nie
dotyczy — rozdział obowiązków nie został skasowany.

---

## Zrzuty — i uczciwie, czego NIE pokazują

`evidence/blokady-20260905/` (jasny + ciemny, 1440×900, `deviceScaleFactor=2`):

| Plik | Co pokazuje |
|---|---|
| `roi-01-wygaszone-owner-light.png` | rejestr ROI, domena wygaszona, właściciel: komunikat + „Włącz ROI dla organizacji" (stan pusty **i** Menu 2) |
| `roi-02-po-wlaczeniu-owner-light.png` | ten sam ekran **po kliknięciu** — wraca normalny „Brak spraw ROI" + „Nowa sprawa ROI" |
| `roi-03-wygaszone-czlonek-light.png` | zwykły członek: samo wyjaśnienie, **zero** przycisku (ani w kadrze, ani w Menu 2) |
| `roi-04-wygaszone-owner-dark.png` | to samo w ciemnym motywie (tokeny `c-*`, CTA neutralne — zero crimsona) |
| `drd-01-zamroz-wlasciciel-org-light.png` | sesja DRD „do przeglądu", panel Akceptacje: **„Zamroź" aktywny** dla właściciela organizacji, choć nikt nie ma roli `approver` |
| `drd-01b-…-kadr.png` / `drd-02-zamroz-czlonek-light.png` | ten sam kadr obok siebie: aktywny (właściciel) vs **wyszarzony** (zwykły członek) |
| `drd-03-zamroz-wlasciciel-org-dark.png` | wersja ciemna |

**Czego te zrzuty NIE dowodzą — wprost, bez owijania:**

1. **To harness `dev-render`, nie aplikacja na żywo.** Mountuje PRAWDZIWE komponenty
   produkcyjne (`ResultsRoiHub`, `DrdHttpMethodWorkspaceScreen` — zero reimplementacji) i
   podmienia **wyłącznie warstwę HTTP**. Pokazują wygląd i logikę klienta; **nie**
   pokazują zachowania serwera.
2. **Zrzutu z aplikacji na żywo dziś zrobić się nie da, z dwóch niezależnych powodów:**
   * lokalny frontend chodzi na **proxy do backendu stagingu**, gdzie nowej trasy
     `GET /visibility-policy` jeszcze nie ma (byłoby 404 → ekran spadłby do starego,
     przed-naprawowego stanu), a `/freeze` dalej odmawiałby 403;
   * **backendu nie da się uruchomić lokalnie**: `server/src/config/databaseTargetResolver.ts`
     twardo odrzuca lokalny `DATABASE_URL` poza testami
     („This project requires the external Postgres target outside tests"), a
     `npm run dev:localdb`/`dev:backend:pg` są celowo wyłączone
     (`scripts/dev/reject-local-db.mjs`). **Nie obchodziłem tego bezpiecznika.**
   Zachowanie serwera dowodzą więc testy na realnym Postgresie, nie obraz.
3. **Sesja odbiorowa wygasła w trakcie mojej pracy.** `/private/tmp/odbior-auth/auth.json`
   zniknął o 08:50 (trwa ponowne logowanie właściciela — `zaloguj3.log`), a
   `POST /api/auth/refresh` z zapisanym refresh-tokenem zwraca 401. Żadnego zrzutu
   zalogowanej sesji na stagingu nie dało się zrobić — i **żadnego zapisu do stagingu nie
   wykonałem** (zamrożenie oceny z UI byłoby zapisem, więc nawet gdyby sesja żyła, nie
   klikałbym).

**Co zostaje do zobaczenia po wdrożeniu na staging (jedna rzecz, nie lista):** ta sama
para ekranów na realnych danych DBR77 — po tym, jak właściciel raz kliknie „Włącz ROI dla
organizacji".

---

## Ryzyko, które trzeba znać przed wdrożeniem

Obie naprawy stoją na **jednym** założeniu: konto właściciela DBR77 ma wiersz w
`organization_members` z `role='OWNER'` i `status='ACTIVE'` dla organizacji
`a3e05d4a-…`. **Tego nie zmierzyłem na żywej bazie** — sesja wygasła, a zapytania do bazy
stagingu mam zabronione. Token JWT niesie `role: "OWNER"`, ale to nie to samo źródło
(`verifyToken` nadpisuje rolę z `organization_members`, gdy wiersz istnieje).

Gdyby tego wiersza nie było, obie naprawy **zachowają się fail-closed** (czyli: dokładnie
jak dziś, bez regresji), ale nie odblokują właściciela — i byłby to kształt „zamknięte
przez wygaszenie". Dlatego status ROI wraca do klienta z polem `blocker`, a nie samym
`false`: ekran wtedy powie „politykę może opublikować właściciel lub administrator", co
jest czytelnym sygnałem, że to członkostwo, nie kod, wymaga poprawy.

**Pomiar do zrobienia jedną komendą po odzyskaniu sesji** (GET, bez zapisu):
`GET /api/organizations/a3e05d4a-5397-419d-b486-8e44366c0063/members` — sprawdzić rolę i
status konta `piotr.wisniewski@dbr77.com`.

## Czego świadomie nie zrobiłem

* Nie dodałem ekranu nadawania procesowych ról sesji (`POST /sessions/:id/roles` dalej
  nie ma wołacza w `src/`). Właściciel organizacji ma teraz drogę do zamrożenia; pełna
  obsada ról (approver/reviewer/respondent z UI) to osobna, większa robota.
* Nie tknąłem `resolveRoiGovernedVisibility` ani `publishRoiGovernedVisibilityPolicy` —
  reguły dostępu ROI są dokładnie te, które były.
* Nie uruchomiłem pełnego `tsc`/`vitest` repo (zakaz); pliki sprawdzone `esbuild`-em
  per plik, testy tylko wskazane.

## Jak powtórzyć pomiary

**Baza — i lekcja przy okazji.** Pierwszy przebieg zrobiłem na cudzym, cudzym-agenta
kontenerze (`mat-prov-wzorce-system-20260905`, port 5440), klonując z niego bazę przez
`CREATE DATABASE … TEMPLATE …`. W trakcie mojej pracy **ten kontener zniknął** (usunął go
właściciel), a razem z nim mój klon — czyli zielony bieg zacząłby wisieć na dowodzie,
którego już nie ma (kształt „dowód poza repo wyparowuje"). Nawiasem: bezpiecznik w moim
własnym teście zadziałał — przy nieosiągalnej bazie `beforeAll` **rzucił** zamiast
zameldować zielone.

Dlatego wszystkie liczby w tym raporcie pochodzą z bazy zbudowanej **od zera z migracji
tego repozytorium**, którą da się odtworzyć jedną komendą:

```
docker run -d --name blokady-pg-20260905 -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=blokady_20260905 -p 5441:5432 pgvector/pgvector:pg17
docker exec blokady-pg-20260905 psql -U postgres -d blokady_20260905 \
  -c "CREATE EXTENSION IF NOT EXISTS vector"
NODE_ENV=test DB_TYPE=postgres \
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5441/blokady_20260905" \
npx tsx server/scripts/migrate.postgres.ts      # strict, przechodzi w całości na PUSTEJ bazie
```

Na tej bazie: **7/7 PASS** (dwa nowe pliki) i **163/163 PASS** (osiem plików regresji:
5 × method-core + `roiGovernedVisibility20.realdb` + `roi.routes` + `roiFinanceSeam.routes`).

```
NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false \
POSTGRES_SKIP_INIT_IN_TEST=1 AI_PROVIDER_MODE=mock \
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5441/blokady_20260905" \
npx vitest run \
  server/src/services/resultsVnext/platform/__tests__/roiGovernedVisibilityStatus.realdb.test.ts \
  server/src/method-core/__tests__/ownerFreeze.http.pg.test.ts
```

Zrzuty: `npx vite --config dev-render/vite.config.ts --port 3081 --strictPort`, potem
`node dev-render/shot.mjs <plik.png> "http://localhost:3081/dev-render/index.html?screen=roi-visibility-activation&uwagi=0&…"`.
