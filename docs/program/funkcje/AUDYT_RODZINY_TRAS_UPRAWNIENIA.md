# Audyt: dziury w uprawnieniach tej samej klasy (rodziny tras, 2026-09-01)

**Zlecenie:** mandat CTO, w reakcji na dziurę znalezioną tego samego dnia w
`server/src/routes/table-platform.routes.ts` (`/forms/:formId` GET/PATCH/DELETE bez
`PermissionsService.requireFormAccess`) — token organizacji B czytał (`200`) i kasował
(`204`) formularz organizacji A. Zadanie: znaleźć **trzecią, czwartą i dziesiątą** taką
dziurę w `server/src/routes/**`.

**Gałąź:** `audyt/rodziny-tras-uprawnienia-20260901` (bare `consultify-recovery-vault-20260820.git`),
zbudowana na świeżym pobraniu `github-backup/codex/m03-admin-20260824`.
**SHA tipa:** `1556b98b4c` (fix(dev-render): brakująca klamra po day237...).
Push wyłącznie na `github-backup` (origin jest publiczny — nie dotknięty).

---

## PIERWSZE ZDANIE: ile dziur pozwala ZMIENIAĆ albo KASOWAĆ cudze dane

**Sześć.** Trzy potwierdzone jako **żywe na produkcji/demo w obecnej konfiguracji**
(montowane bez żadnej bramki), trzy potwierdzone w kodzie ale **obecnie wygaszone na
demo przez osobną, niezwiązaną z uprawnieniami flagę `mountStub`/`ENABLE_STUB_ROUTES`**
(patrz sekcja „Pułapka: kod dziurawy ≠ trasa żywa na demo” — żywe na każdym innym
środowisku, jeden flip flagi od bycia żywe wszędzie).

Wcześniejsza wersja tego zdania podawała 4+2 — sprostowane 2026-09-01 (dyżur 254)
po ponownym zliczeniu wierszy szczegółowej sekcji „Pułapka” niżej.

Najgroźniejsza: **PMO Project Members** — obca organizacja może **dopisać samą siebie
jako ADMIN do cudzego projektu** (nie tylko czytać/kasować — **wstrzyknąć tożsamość**
do cudzej firmy).

---

## Metoda

1. Przesiew statyczny: 6221 deklaracji tras w `server/src/routes/**`, z tego 923 tras
   przyjmujących identyfikator obiektu wprost (`:xId`/`:id`) w operacjach GET-jeden/PUT/PATCH/DELETE/POST-na-obiekcie.
2. Odjęcie tras już dotkniętych wcześniejszą historią napraw cross-org/IDOR/tenant
   (294 commity `git log --grep`, 290 plików tras) → **291 plików nie dotkniętych żadną
   znaną naprawą tej klasy**.
3. Filtr heurystyczny (obecność `organization_id`/`organizationId`/`orgId`/`requireOrgAccess`
   itd. w pliku trasy lub w wywoływanym kontrolerze/serwisie) → 198 kandydatów.
4. Dla każdego kandydata: **odczyt kodu aż do faktycznego zapytania SQL** (trasa → kontroler/serwis
   → `WHERE`), bo duża część kodu deleguje org-check do warstwy serwisu (fałszywe alarmy:
   `interview-enterprise`, `pmo/stakeholders`, `pmo/execution`, `ai/aiPlaybooks` runs — WSZYSTKIE
   poprawnie scope'ują przez `organizationId` przekazywany w dół; `pmo/rbac`, `billing/pricing`,
   `modelRegistry`, `content/email-templates`, `ai/aiPlaybooks` templates — globalna konfiguracja
   platformy pod `verifySuperAdmin`, nie per-organizacja, więc nie dotyczy tej klasy dziury).
5. Sprawdzenie montowania w `server/src/Gateway.ts` PRZED ogłoszeniem dziury — dwa martwe
   pliki odrzucone (`server/src/routes/webhooks.routes.ts` i `server/src/routes/pmo/stage-gates.routes.ts`
   nigdy nie są importowane/montowane — realna trasa `/api/webhooks` i `/api/stage-gates` to
   INNE, poprawione pliki).
6. Dla każdego finalnego podejrzenia: **dowód na żywo** — kontener `audyt-upr-pg` (Postgres 16
   + pgvector, port `6211`), `server/scripts/migrate.postgres.ts` na pustej bazie (726 migracji,
   0 błędów), realny `server/src/Gateway.ts` na porcie `5186`, dwie organizacje utworzone przez
   prawdziwy `POST /api/auth/register` (podpisane JWT, prawdziwy bcrypt), para dowodowa
   **obcy widzi/działa** + **właściciel widzi skutek** na każdą dziurę.

---

## Tabela rodzin (od najgroźniejszych)

| # | Rodzina | Trasa | Kontrola | Dowód (kod odpowiedzi) | Skutek dla właściciela |
|---|---|---|---|---|---|
| 1 | **PMO Project Members** | `POST /api/project-members/:projectId`<br>`PUT /api/project-members/:projectId/:memberId`<br>`DELETE /api/project-members/:projectId/:memberId`<br>`GET /api/project-members/:projectId` | **BRAK** — tylko `verifyToken`+`isAuthenticated`, zero porównania `projectId` z `organizationId` wołającego | `POST` org B → `201 {"success":true,"id":"997029ee...","role":"ADMIN"}`; następnie `GET` org A → widzi obcego użytkownika `orgB.attacker@...` jako **członka ADMIN swojego projektu** | **Obca firma może wstrzyknąć swojego użytkownika jako ADMIN do cudzego projektu** (nie tylko czytać/kasować — uzyskać przyczółek z rolą decyzyjną wewnątrz rywala), a także czytać, zmieniać rolę i usuwać prawdziwych członków cudzego zespołu |
| 2 | **Consultify Studio (canvas/mind-map)** | `GET/PUT/DELETE /api/studio/documents/:id`<br>`GET/POST /api/studio/documents/:id/snapshots`<br>`POST /api/studio/snapshots/:snapshotId/restore` | **BRAK w całym serwisie** — `StudioService.getDocument(documentId, userId)` przyjmuje `userId` ale **nigdy go nie używa** w zapytaniu (`WHERE id = ?` tylko); `deleteDocument`/`getSnapshots` nie przyjmują nawet parametru właściciela | `GET` org B → `200` pełna treść „OrgA Secret Canvas"; `PUT` org B → `200`, nazwa zmieniona na „PWNED BY ORG B", potwierdzone odczytem org A; `DELETE` org B (drugi dokument) → `200 {"success":true}`, potwierdzone `404` u org A | **Obca firma może odczytać, nadpisać i trwale skasować** dowolny dokument Studio (jedno z 8 kluczowych narzędzi Harvard) dowolnej organizacji — pełny CRUD, nie tylko odczyt |
| 3 | **Notifications — Escalations** | `GET /api/notifications/escalations/:projectId`<br>`POST /api/notifications/escalations/:projectId/run` | **BRAK** — `EscalationService.getEscalations(projectId, status)` i `runAutoEscalation(projectId)` nie przyjmują `organizationId` w ogóle; trasa wymaga tylko globalnej roli `ADMIN`, nie relacji do projektu | `GET` org B → `200`, pełna treść decyzji „OrgA Confidential Board Decision"; `POST .../run` org B → `200 {"processed":1,"redAlerts":1}`; SQL readback: `escalation_level` zmieniony `NORMAL→red`, `updated_at` świeży | **Obcy administrator może odczytać i ZMIENIĆ** stan eskalacji/decyzji (`decisions.escalation_level`, `status`) cudzego projektu |
| 4 | **Permission Requests** (zatwierdzanie eskalacji uprawnień) | `PUT /api/permission-requests/:id/approve`<br>`PUT /api/permission-requests/:id/reject` | **BRAK** — `verifyAdmin` sprawdza tylko, że wołający jest adminem/właścicielem W SWOJEJ organizacji, nie że wniosek `:id` należy do tej organizacji | `PUT .../approve` org B → `200 {"success":true}`; readback org A: wniosek `status: "approved"` mimo że zatwierdził go administrator **innej firmy** | **Obcy administrator może zatwierdzić lub odrzucić wniosek o podniesienie uprawnień** złożony przez pracownika innej organizacji — rubber-stamp cudzej eskalacji uprawnień. **Ale patrz „Pułapka” niżej — obecnie niedostępna na demo** |
| 5 | **Videos** | `DELETE /api/videos/:id` | **BRAK** — `DELETE FROM videos WHERE id = ?`, brak `organization_id` mimo że przy tworzeniu jest zapisywany | Kod: `server/src/routes/videos.routes.ts:56-63` — dowód statyczny, live-proof pominięty z braku czasu (wzorzec identyczny jak #1/#2) | **Obcy może trwale skasować** materiał wideo dowolnej organizacji. **Patrz „Pułapka” — obecnie niedostępna na demo** |
| 6 | **AI Context** | `DELETE /api/context/:id` | **BRAK** — `DELETE FROM ai_contexts WHERE id = ?`, brak `organization_id` | Kod: `server/src/routes/context.routes.ts:116-123` — dowód statyczny | **Obcy może trwale skasować** kontekst AI dowolnej organizacji. **Patrz „Pułapka" — obecnie 501 na demo, nie 404/200** |

Dla porównania — trasa naprawiona wcześniej dziś (wzorzec):
`server/src/routes/table-platform.routes.ts:2839/2851/2869` `/forms/:formId` z `requireFormAccess`.

---

## PUŁAPKA: kod dziurawy ≠ trasa żywa na demo (odwrotność zwykłej pułapki)

Zwykle w tym programie ostrzegaliśmy: „flaga OFF w kodzie ≠ wyłączone na demo" (kod
wygląda na bezpieczny, a demo i tak jest podatne). Tutaj znaleziono **odwrotny** przypadek —
ważny, żeby nie ogłosić fałszywego alarmu ani fałszywego spokoju:

`server/src/Gateway.ts:518-533` definiuje `mountStub()` — trasa jest montowana WPROST
tylko gdy `enableStubRoutes = !isProduction || ENABLE_STUB_ROUTES==='true'`
(`Gateway.ts:485-486`). Komentarz w kodzie (`Gateway.ts:508-512`) potwierdza wprost:
*„prod + ENABLE_STUB_ROUTES unset — this IS the current state on demo"*. Dla tras spoza
11-elementowej listy `STUB_NAMES_WITH_LIVE_UI_ON_DEMO` (`Gateway.ts:503-516`) skutek to
**cichy 404** (trasa w ogóle niezmontowana); dla tras na liście — **uczciwe 501**.

- `permissionRequestsRoutes`, `videoRoutes` — **NIE** są na liście → na demo/produkcji
  (`NODE_ENV=production`, `ENABLE_STUB_ROUTES` niewystawione) trasy #4 i #5 dają **404**,
  nie są dziś exploitowalne na `demo.consultify.ai`.
- `contextRoutes` — **JEST** na liście → na demo dostaje uczciwe **501**, też nie exploitowalne.
- **Ale**: dziura #1 (Project Members), #2 (Studio) i #3 (Notifications Escalations) są
  montowane **bezwarunkowo** (`app.use(...)` wprost, `Gateway.ts:1159`, `:1338`, `:905`) —
  **żywe na demo/produkcji already, dziś, bez żadnego flagowania.**

Konsekwencja dla właściciela: #4/#5/#6 to prawdziwe błędy w kodzie (ten sam brak kontroli
organizacji), które **staną się natychmiast exploitowalne** w chwili gdy: (a) ktoś ustawi
`ENABLE_STUB_ROUTES=true` na Railway (łatwa zmiana operacyjna, nie code review), (b) te
trasy zostaną kiedyś dograne do UI i dopisane do listy 11 (jak stało się już dla 11 innych
nazw), albo (c) na dowolnym środowisku innym niż produkcja (staging, jeśli tam
`NODE_ENV != production`; lokalny dev; CI) — tam są żywe **już teraz**.

---

## Dowód na żywo — szczegóły techniczne

- Kontener: `audyt-upr-pg` (`pgvector/pgvector:pg16`), port `6211`, baza `audyt_upr`.
- Migracje: `NODE_ENV=test RUN_DB_TESTS=1 DATABASE_URL=postgresql://postgres:postgres@localhost:6211/audyt_upr DB_TYPE=postgres npx tsx server/scripts/migrate.postgres.ts` → `✅ Postgres migrations complete` (726 plików, 0 pominiętych, 0 błędów).
- Serwer: `npx tsx server/src/index.ts`, port `5186`, `NODE_ENV=test` (wymagane, by ominąć
  blokadę „refusing local DATABASE_URL outside tests" w `server/src/config/databaseTargetResolver.ts` —
  legalna ścieżka testowa, nie obejście zabezpieczenia produkcyjnego), `RUN_DB_TESTS=1`
  (żeby `Database.ts` NIE podstawił atrapy bazy — pułapka z pamięci projektu), health-check
  `GET /api/health` → `200 {"status":"ok","database":"connected"}`.
- Organizacja A: `POST /api/auth/register` → `organizationId=5dc43fbd-d547-41f8-ba3c-3a5f5c80c444`,
  użytkownik `orgA.owner@audyt-test.local` (rola ADMIN, prawdziwy podpisany JWT).
- Organizacja B (atakujący): `organizationId=b3d4913e-39f2-4480-8bb5-d52773c64300`,
  użytkownik `orgB.attacker@audyt-test.local` (rola ADMIN).
- Każda dziura #1-#3 ma **obie** nogi dowodu: negatywną („obcy sięga") i pozytywną
  („właściciel nadal widzi/działa normalnie, a skutek ataku jest u niego widoczny") —
  m.in. `GET /api/studio/documents` przez org A po ataku nadal zwraca `200` z listą
  własnych (zmodyfikowanych) dokumentów; `GET /api/project-members/:projectId` przez
  org A pokazuje wstrzykniętego członka.

---

## Rodziny sprawdzone i uznane za BEZPIECZNE (dla kontrastu — pokazują, że kontrola bywa poprawna)

| Rodzina | Dlaczego bezpieczna |
|---|---|
| `pmo/stakeholders.routes.ts` (`StakeholderRegistryController`) | `getOne/update/remove` przekazują `req.user.organizationId` do `stakeholderRegistryService.*RegistryEntry(orgId, id)` — realny `WHERE` po obu kolumnach |
| `pmo/execution.routes.ts`, `pmo/roadmap.routes.ts`, `pmo/capacity.routes.ts`, `pmo/pmo-analysis.routes.ts` (kontrolery) | Każda metoda kontrolera jawnie filtruje `WHERE ... AND organization_id = ?` |
| `interview-enterprise.routes.ts` (segments/quotas/distributions/findings) | `identity.orgId` konsekwentnie przekazywany do `interviewEnterpriseService.*`; `getSegments` ma nawet dedykowany test `interviewEnterpriseService.getSegments.crossOrg.pg.test.ts` |
| `resultsVnext/kpiRecoveryChildren.routes.ts` | Kontekst z `organizationId` przekazywany do warstwy `atomicWrite`/`CommandCapabilityGuard` konsekwentnie na każdej mutacji |
| `ai/aiPlaybooks.routes.ts` — `/instances/:id` (pause/resume/cancel/retry) | `AIPlaybooksController.getScopedRun(id, organizationId)` porównuje `run.organizationId !== organizationId`. **Zastrzeżenie:** porównanie jest pominięte gdy `run.organizationId` jest fałszywe (null) — nieprzebadane na żywo, niska pewność, wymaga rekordu z `organization_id IS NULL` żeby być exploitowalne |
| `organization/rbac.routes.ts` (`DELETE /roles/:id`), `modelRegistry.routes.ts`, `billing/pricing.routes.ts`, `billing/promo.routes.ts`, `content/email-templates.routes.ts` | Tabele **globalne dla platformy** (brak kolumny `organization_id`), gate `verifySuperAdmin` — poza zakresem tej klasy dziury z definicji |
| `webauthn.routes.ts` (`DELETE /credentials/:credentialId`) | Scope po `user_id`, nie `organization_id` — poprawnie, bo poświadczenie WebAuthn jest własnością użytkownika, nie organizacji |
| `sessions.routes.ts`, `user/userGoals.routes.ts` | Scope po `user_id` w każdym zapytaniu — poprawne |

Martwy kod odrzucony (nie stanowi dziury, bo nieosiągalny):
`server/src/routes/webhooks.routes.ts` (PUT/DELETE `/:id` bez żadnej kontroli —
ale plik nigdy nie jest importowany w `Gateway.ts`; realna trasa `/api/webhooks` to
`server/src/routes/integrations/webhooks.routes.ts`, wcześniej audytowana/naprawiana),
`server/src/routes/pmo/stage-gates.routes.ts` (POST `/project/:projectId/:gateId/approve|reject`
bez kontroli organizacji, gate `requireProjectCapability` domyślnie w trybie `shadow`
czyli i tak nie blokuje — ale `pmo/index.ts`, jedyne miejsce montujące ten plik, nigdy
nie jest zaimportowany w `Gateway.ts`; realna trasa `/api/stage-gates` to
`server/src/routes/stageGates.routes.ts` → `StageGateController`, **już naprawiona**,
komentarz w kodzie opisuje dokładnie tę wcześniejszą naprawę), `server/src/routes/projects.routes.ts`
i `server/src/routes/tasks.routes.ts` (czyste atrapy zwracające `null`/`[]`, zero dostępu do bazy).

---

## Czego NIE dało się sprawdzić i dlaczego

- **291 plików tras** nie dotkniętych dotychczasową historią napraw cross-org/IDOR —
  z tego przesiano statycznie **198 kandydatów**, z których **indywidualnie odczytano kod
  ok. 30** (wymienione wyżej, bezpieczne lub dziurawe). **Pozostałe ~168 kandydatów
  NIE zostało jeszcze odczytanych** — są to głównie: `ai/*` (ai-ab-testing, ai-budgets,
  ai-drafts, ai-training, aiExplain, aiAnalytics, aiAsync — część już zweryfikowana jako
  bezpieczna przez wzorzec `superAdminGuard`/`getScopedRun`, ale nie każda trasa w tych
  plikach osobno), `assessment/assessment-ai.routes.ts` (7 tras `:projectId/ai/*`),
  `billing/settlements.routes.ts`, `billing/tokenBilling.routes.ts`, `revenue.routes.ts`,
  `knowledgeBase.routes.ts`, `scenarios.routes.ts`, `baselines.routes.ts`,
  `assessmentEvidence.routes.ts`, `core-docs.routes.ts`, `help.routes.ts`,
  `llmHealth.routes.ts`, `caseWorkspace/intake.routes.ts`, `public-mini-assessment.routes.ts`,
  `v8/admin/partner-review.routes.ts`, `organization/rbac.routes.ts` (`/roles/:roleId/permissions`
  — sprawdzone tylko `/roles/:id` DELETE, nie warianty `:roleId/permissions`), `sessions.routes.ts`
  duplikat w `user/sessions.routes.ts`, `user/user-security-advanced.routes.ts`.
- **290 plików „dotkniętych" wcześniejszą historią napraw** — potraktowane jako niższe
  ryzyko i **NIE spot-checkowane** w tym audycie (poza `table-platform.routes.ts`, który
  był już wzorcem zadania). Historia napraw pokazuje wzorzec „naprawiono część rodziny,
  reszta zapomniana" (dokładnie to, co znaleziono dziś rano w `table-platform`) — **ryzyko
  podobnych resztkowych dziur w tych 290 plikach jest realne i niezbadane.**
- **Live-proof wykonano tylko dla 3 z 6 znalezionych dziur** (Project Members, Studio,
  Notifications Escalations) — dla Permission Requests/Videos/Context dowód jest **wyłącznie
  z czytania kodu** (SQL bez `WHERE organization_id`), bez uruchomienia przeciwko żywej
  bazie, z braku czasu w tej sesji. Wzorzec identyczny jak potwierdzone na żywo #1-#3,
  więc pewność wysoka, ale nie 100%.
- Trasy zagnieżdżone pod `caseWorkspace/*`, `finance-v2/*`, `resultsVnext/*` (poza
  `kpiRecoveryChildren`) mają własne, rozbudowane warstwy `_shared/access.ts` —
  nie audytowane w tej sesji, wymagają osobnego przebiegu z uwagi na objętość.

---

## Rekomendacja (bez naprawy — poza zakresem tego audytu)

Wzorzec naprawy z dzisiejszego poranka (`requireFormAccess` przed handlerem) jest
bezpośrednio przenaszalny na #1-#3: dodać middleware/inline-check porównujący
`organization_id` obiektu docelowego (`project_id`/`document.organization_id`) z
`req.user.organizationId` PRZED jakimkolwiek odczytem/zapisem, zwracać `404` (nie `403` —
nie ujawniać istnienia cudzego obiektu) przy niezgodności. Dla #4-#6 to samo, niezależnie
od tego że `mountStub` je dziś maskuje — maskowanie nie jest naprawą (patrz sekcja
„Pułapka" wyżej).

## Dzień 242 — stan po weryfikacji i naprawie

- Permission Requests: pełna rodzina to `GET /`, `POST /`, `PUT /:id/approve`,
  `PUT /:id/reject`; oba PUT mają teraz wspólny check właściciela i `404`
  (`server/src/routes/permissionRequests.routes.ts:19-28,78-118`). Dowód mutacyjny:
  bez checków oba ataki zwracały `200`, po przywróceniu `404`; SQL readback zachował
  `pending`, a właściciel uzyskał odpowiednio `approved`/`rejected`.
- AI Context: pełna rodzina to `GET /`, `POST /`, `PUT /:id`, `DELETE /:id`; oba
  mutatory mają wspólny check (`server/src/routes/context.routes.ts:18-29,79-143`).
  Bez checków oba ataki zwracały `200`, po przywróceniu `404`; SQL readback potwierdził
  brak nadpisania/usunięcia, a właściciel nadal wykonał oba zapisy.
- Videos: pełna rodzina to `GET /`, `POST /`, `DELETE /:id`; DELETE ma check
  (`server/src/routes/videos.routes.ts:16-25,67-77`), ale pełny live-proof jest
  `EVIDENCE_MISSING`: po 880 migracjach w świeżym PG brak tabeli `videos` (kontrakt
  `day242-videos-org-isolation.realpg.test.ts` jest czerwony: `[]` zamiast kolumny
  `organization_id`).
- Przesiew R3 ujawnił kolejne statycznie potwierdzone kandydaty poza licencją:
  AI A/B Testing mutuje eksperymenty po samym `id`
  (`server/src/services/ai/abTesting.ts:83,165,182-282`), AI Budgets mutuje budżety,
  alerty i model permissions po samym `id`
  (`server/src/services/aiBudgetService.ts:235-290,566-572`), a AI Drafts approve/reject
  wywołuje serwis bez `userId`/`organizationId`, który aktualizuje po `id`
  (`server/src/routes/ai/ai-drafts.routes.ts:310-389`,
  `server/src/services/ai/draftService.ts:39-78`). Nie naprawiano ich w Dniu 242.
## Dzień 246 — domiar: kolejne 60-80 kandydatów przeczytane

Na markerze `df7f13056f` zregenerowano 154 kandydatów i przeczytano 70 rzeczywistych tras (69 z listy + `journeyAnalytics.routes.ts` za barrel `audits/index.ts`). Wynik: 61 bezpiecznych, 6 globalnych/platformowych, 3 dziurawe-niepoprawione. Pełne dowody i liczby endpointów: `CODEX_DAY246_DOMIAR_AUDYTU_REPORT.md`.

| Klasyfikacja | Pliki i dowód |
|---|---|
| bezpieczny (61) | Wszystkie wiersze oznaczone BEZPIECZNY w raporcie; dowód `plik:linia` w tabeli R2. |
| globalny-poza-zakresem (6) | `admin/ai-observability.routes.ts:12`, `admin/backup.routes.ts:13`, `ai-prompts.routes.ts:58`, `billing/billingAdmin.routes.ts:21`, `help.routes.ts:86`, `integrations/webhooks.routes.ts:174`. |
| dziurawy-niepoprawiony (3) | `assessment-enterprise.routes.ts:16-22`, `enterprise-platform.routes.ts:16-22`, `final-batch.routes.ts:16-22`: klient-kontrolowany fallback `req.query.organizationId`. |
## Dzień 247 — próba z kategorii już naprawione

Deterministyczna próbka: 18 z odtworzonej populacji 143 (ziarno `20260901`) plus obowiązkowy `table-platform.routes.ts`, razem 19. Szczegółowy zakres i ograniczenia: `CODEX_DAY247_PROBKA_NAPRAWIONE_REPORT.md`.

| Plik | Klasyfikacja | Dowód |
|---|---|---|
| `admin/service-accounts.routes.ts` | BEZPIECZNY | `:14` organization context |
| `benefits.routes.ts` | BEZPIECZNY | `:52` router tenant wall |
| `finance-enterprise.routes.ts` | BEZPIECZNY | `:20` scoped `userId/orgId` |
| `method-core.routes.ts` | BEZPIECZNY | `:15`, `:1763` tenant gate + scoped helper |
| `my-work/home.routes.ts` | POZA ZAKRESEM | brak kwalifikującej mutacji |
| `organization/branding.routes.ts` | BEZPIECZNY | `:41` org access |
| `partners.routes.ts` | BEZPIECZNY/GLOBALNY | `:226`; osobne routery super-admin/config |
| `performance.routes.ts` | POZA ZAKRESEM | brak mutacji |
| `pmo/projects.routes.ts` | BEZPIECZNY | `:22`, `:180-384` org/capability gates |
| `presentationStudio.routes.ts` | BEZPIECZNY | `:18` tenant scope |
| `research.routes.ts` | BEZPIECZNY | `:39` organization context |
| `results-enterprise.routes.ts` | BEZPIECZNY | `:19` scoped `userId/orgId` |
| `resultsVnext/okr.routes.ts` | BEZPIECZNY | `:16` `requireOrgAccess` |
| `share.routes.ts` | BEZPIECZNY DLA KRYTERIUM | `:273-278`, `:607-613`, `:670-675` owner/org checks |
| `table-platform.relations-explain.routes.ts` | POZA ZAKRESEM | `:25`, brak mutacji |
| `user/preferences.routes.ts` | BEZPIECZNY | `:14`, zapis po `userId` |
| `v8/partner.routes.ts` | BEZPIECZNY | `:2` partner-org scope |
| `wave7-connectors.routes.ts` | BEZPIECZNY | `:20` auth context z organizacją |
| `table-platform.routes.ts` | **DZIURAWY** | trasy `:2964-2983` → `AutomationService.ts:134-145`; trasy `:4368-4388` → `WebhookRelayService.ts:101-111`, wszędzie zapis tylko po `id` |

**Kryterium: TAK.** Znaleziono co najmniej jedną dodatkową dziurę klasy „mutujący endpoint bez `organization_id` aż do `WHERE`”. Kategoria „już naprawione” **przestaje być kategorią**, na której można polegać bez czytania. Rekomendacja: pełny, niewyrywkowy przegląd całej populacji. Bez naprawy produktu i bez live-proof — zgodnie z licencją dnia 247.
