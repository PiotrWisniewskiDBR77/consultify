# Production Demo Launch Program - 2026-05-26

Status: `DRAFT_CONFIRMED_FOR_PLANNING`
Owner decyzyjny: Product / Delivery Owner
Zakres: obecna produkcja Consultify, sciezka demo/trial przed promocja

## 1. Cel

Uruchomic na obecnej produkcji bezpieczna, ograniczona sciezke:

```text
landing -> demo -> trial -> zalozenie organizacji -> ograniczony workspace -> contact / upgrade
```

Priorytetem programu jest bezpieczenstwo i sensowne pierwsze doswiadczenie uzytkownika, nie pelne przeniesienie wszystkich funkcji ze stagingu.

Program ma zapobiec:

- zapisom do wspolnego demo workspace,
- naruszeniu tenant isolation,
- uploadowi realnych danych bez gotowych polityk security/retention,
- eksportowi lub publicznemu share danych poza organizacje,
- aktywowaniu niedojrzalych funkcji governance/admin,
- ukrytym zapisom AI lub automatycznym decyzjom bez czlowieka.

## 2. Decyzja Release

Rekomendacja: `GO_WITH_P2` tylko dla ograniczonego trybu promocyjnego.

Nie robimy pelnego staging cutover. Produkcyjnie wypuszczamy `Limited Demo Program`, w ktorym ryzykowne funkcje sa ukryte, zablokowane albo pokazane jako locked/degraded state.

Pelny staging -> production pozostaje `NO_GO` do czasu osobnego audytu auth, RBAC, tenant isolation, upload/export/share i governance mutations.

## 3. Zakres Wchodzi

Do produkcyjnego demo wchodzi:

- public landing, pricing, contact, legal,
- public Anna / asystent na landing,
- demo workspace z przykladowa organizacja,
- demo session 24h, najlepiej session-scoped,
- demo banner i czytelne locked states,
- trial entry po rejestracji,
- podstawowy trial onboarding,
- podstawowy chat/AI z limitami,
- read-only podglad stabilnych modulow pokazowych:
  - My Work,
  - Results,
  - Execution,
  - Reports,
  - Tables,
  - Documents,
  - Presentations,
- CTA do:
  - `Start trial`,
  - `Create organization`,
  - `Contact sales`,
  - `Upgrade`.

## 4. Zakres Poza Release / Zaslepki

Na start produkcyjny blokujemy albo zaslepiamy:

- upload dokumentow klienta,
- eksporty raportow, PDF/DOCX/XLSX,
- public share links,
- zaproszenia zespolu w `Trial Entry`,
- role builder,
- zaawansowany Admin/SuperAdmin dla zwyklych userow,
- governance approvals:
  - approve,
  - cancel,
  - unblock,
  - role changes,
- AI memory write,
- AI `do actions` / autopilot,
- integracje i konektory,
- automatyzacje,
- operacje destrukcyjne,
- billing cancellation.

## 5. Tryby Dostepu

### 5.1 Public Mode

Uzytkownik niezalogowany.

Dozwolone:

- landing,
- public Anna,
- pricing,
- legal/contact,
- start demo,
- register/login.

Blokady:

- brak tenant API,
- brak workspace,
- brak upload/export/share.

### 5.2 Demo Mode

Uzytkownik oglada przykladowy workspace.

Zasady:

- demo jest read-only albo disposable session-scoped,
- zaden user nie zapisuje do wspoldzielonego demo org,
- wszystkie write actions zwracaja kontrolowany locked state,
- demo copy jasno mowi, ze dane sa przykladowe.

Wymagany fix P0:

- `X-Demo-Session-Org` musi byc walidowany wzgledem aktywnej sesji demo uzytkownika.
- System nie moze przyjac dowolnego org ID z headera.

### 5.3 Trial Entry

Uzytkownik ma konto, ale nie ma pelnego workspace/organizacji.

Dozwolone:

- ograniczony chat,
- onboarding,
- wybor profilu,
- create org,
- contact/upgrade.

Blokady:

- initiatives write,
- invites,
- upload,
- report generation/export,
- roadmap write,
- AI memory/knowledge write.

Wymagany fix P0:

- `trialEntryGuard` musi byc realnie podpiety na endpointach mutujacych.
- Nie wystarczy ukrycie przyciskow w UI.

### 5.4 Trial Organization

Uzytkownik ma trialowa organizacje.

Dozwolone:

- 1 projekt startowy,
- ograniczone AI,
- ograniczone inicjatywy/taski,
- podstawowy workspace,
- billing/contact CTA.

Blokady:

- public share,
- eksport,
- duzy upload,
- AI autopilot,
- zaawansowany admin/security,
- custom role management.

## 6. Fazy Wdrozenia

### Faza 0 - Freeze I Decyzja Zakresu

Czas: przed rozpoczeciem implementacji.

Decyzje:

- Produkcja startuje jako `Limited Demo Program`.
- Wszystkie funkcje poza zakresem sa locked/hidden.
- Priorytetem jest bezpieczenstwo, nie pelna funkcjonalnosc.

Wyjscie:

- lista funkcji enabled,
- lista funkcji locked,
- owner decyzji `GO / NO_GO`.

Gate:

- Jesli oczekiwany jest pelny staging cutover, zakres wraca do review.

### Faza 1 - Hardening P0

Czas: przed pierwszym deployem produkcyjnym.

Zadania:

1. Demo session isolation:
   - walidowac `X-Demo-Session-Org`,
   - akceptowac tylko aktywna sesje usera,
   - fallback/deny dla niepoprawnej sesji.
2. Trial Entry Guard:
   - podpiac guard do krytycznych endpointow,
   - egzekwowac blokady backendowo.
3. Demo write protection:
   - potwierdzic, ze `POST/PATCH/PUT/DELETE` w demo sa blokowane poza allowlista,
   - allowlista tylko dla `/api/demo/*` i auth.
4. Internal tools:
   - produkcja: hidden w UI,
   - backend: deny unless explicit allowlist.

Gate:

- `NO_GO`, jesli demo header pozwala zmienic org.
- `NO_GO`, jesli Trial Entry moze tworzyc trwale dane.

### Faza 2 - Kill-Switche Produkcyjne

Czas: przed deployem albo jako czesc deployu.

Docelowe flagi:

```text
DEMO_WRITES_ENABLED=false
TRIAL_INVITES_ENABLED=false
TRIAL_UPLOAD_ENABLED=false
TRIAL_EXPORT_ENABLED=false
TRIAL_AI_MEMORY_ENABLED=false
PUBLIC_SHARE_ENABLED=false
AI_AUTOPILOT_ENABLED=false
INTERNAL_TOOLS_ENABLED=false
```

Jesli pelna infrastruktura flag nie istnieje, wystarczy prosty env guard na backendzie oraz UI locked state.

Gate:

- Kazda funkcja wysokiego ryzyka musi byc wylaczalna bez duzego refaktoru.

### Faza 3 - UX Zaslepek

Czas: przed promocja.

Kazda zablokowana funkcja musi miec jasny komunikat.

Copy bazowe:

- Demo: `To jest tryb demonstracyjny. Dane sa przykladowe, a zmiany nie sa trwale.`
- Trial Entry: `Ta funkcja wymaga utworzenia organizacji.`
- Trial: `Ta funkcja jest dostepna po aktywacji planu lub kontakcie z zespolem.`

CTA:

- `Start trial`,
- `Create organization`,
- `Contact sales`,
- `Upgrade`,
- `Back to demo`.

Gate:

- Brak slepych `403/500` w sciezce promocyjnej zwyklego uzytkownika.

### Faza 4 - Produkcyjny Deploy

Czas: po przejsciu Fazy 1-3.

Kroki:

1. Production build.
2. Deploy na obecna produkcje.
3. Sprawdzic `/ping`.
4. Sprawdzic `/api/ready`.
5. Sprawdzic homepage.
6. Sprawdzic register/login.
7. Sprawdzic demo start.
8. Sprawdzic trial start.
9. Sprawdzic blokady write/upload/export/invite.
10. Sprawdzic logi 5xx.

Gate:

- `GO_WITH_P2`, jesli sciezka promo dziala i blokady sa kontrolowane.
- `NO_GO`, jesli sa 5xx w podstawowej sciezce albo naruszenie tenantow.

## 7. Minimalny Test Plan

### Public

- Landing laduje sie.
- Anna dziala albo pokazuje controlled degraded state.
- Pricing/contact/legal dzialaja.
- Public API bez tokena zwraca kontrolowane `401/403`, nie dane tenantowe.

### Demo

- Start demo dziala.
- Demo status dziala.
- Demo organization/stats dzialaja.
- Proba create/update/delete zwraca `DEMO_READ_ONLY`.
- Header z cudzym org ID nie przelacza organizacji.
- Demo banner jest widoczny.

### Trial Entry

- Login/register dziala.
- Trial status dziala.
- AI grace dziala w limicie.
- Create initiative zablokowane.
- Invite zablokowane.
- Upload zablokowany.
- Export zablokowany.
- AI memory write zablokowany.
- CTA prowadzi do create org/contact.

### Trial Org

- Create org dziala.
- Workspace laduje sie.
- Podstawowy chat dziala.
- Limity trial sa widoczne.
- Expired trial przechodzi read-only.
- Upgrade/contact CTA dziala.

## 8. Monitoring Po Starcie

Pierwsze 48h monitorowac:

- liczbe wejsc na landing,
- demo started,
- demo -> trial conversion,
- trial entry drop-off,
- create org success/fail,
- `DEMO_READ_ONLY`,
- `TRIAL_ENTRY_RESTRICTION`,
- `TRIAL_EXPIRED`,
- `AI_LIMIT_REACHED`,
- 401/403/404/500,
- AI cost/token usage,
- rate-limit hits,
- Sentry/runtime errors.

Alert P0:

- jakikolwiek cross-tenant symptom,
- 500 w login/demo/trial,
- public endpoint zwraca tenant data,
- demo write trafia do DB,
- upload/export/share aktywny bez decyzji.

## 9. Deep Readiness Audit - 2026-05-26

### 9.1 Executive Verdict

Po dodatkowym audycie backendu i frontendu werdykt jest ostrzejszy niz w pierwotnym planie:

```text
FULL SELF-SERVE DEMO/TRIAL: NO_GO
LIMITED PROMO DEMO:        GO only after P0 hardening
TRIAL ORGANIZATION:        GO_WITH_P2 only with upload/export/share/autopilot hidden or disabled
TRIAL ENTRY BOUNDARY:      NO_GO until trialEntryGuard is mounted in runtime
```

System ma dobre jadro:

- `AccessPolicyService` zna demo/trial/paid, limity, expiry, dunning i blocked actions.
- Demo API i demo session service istnieja.
- Frontend wysyla `X-Demo-Mode` gdy `isDemoMode=true`.
- UI ma `AccessBlockedModal`, `DemoModeBanner`, `GlobalAccessBanners`, `TrialBanner`, `TrialExpirationModal`.
- Limity demo/trial sa zdefiniowane i czesciowo egzekwowane przez AI/quota/invite.

Nie jest jeszcze gotowe pelne egzekwowanie:

- demo/trial guardy HTTP nie obejmuja wszystkich tras,
- trial entry guard istnieje, ale nie dziala w runtime,
- kill-switche z programu launch nie sa jeszcze materializowane w kodzie,
- upload/export/share/invite/admin/autopilot nie maja jednolitego deny-by-default,
- frontend pokazuje czesc akcji, ktore backend dopiero pozniej moze odrzucic.

### 9.2 Co Jest Gotowe

| Obszar | Stan | Dowod / pliki |
| --- | --- | --- |
| Core policy model | Gotowy jako logika centralna | `server/src/services/accessPolicyService.ts`, `server/src/services/access/AccessTypes.ts` |
| Demo middleware | Istnieje | `demoContextMiddleware`, `demoWriteProtection` w `server/src/middleware/demoGuard.middleware.ts` |
| Demo session service | Istnieje | `server/src/services/demo/demoSessionService.ts` |
| Demo API | Istnieje | `server/src/routes/demo.routes.ts` |
| Trial status API | Istnieje | `GET /api/trial/status` w `server/src/routes/trial.routes.ts` |
| Frontend demo header | Gotowy dla `X-Demo-Mode` | `src/services/api.ts` |
| Trial/demo banners | Gotowe bazowo | `src/components/layout/DemoModeBanner.tsx`, `src/components/layout/GlobalAccessBanners.tsx` |
| Access blocked modal | Gotowy bazowo | `src/components/access/AccessBlockedModal.tsx` |
| AI quota guard | Czesciowo gotowy | `enforceTokenQuota`, `AccessPolicyService.checkAccess(..., 'ai_call')` |
| Storage quota middleware | Istnieje, ale uzycie ograniczone | `enforceStorageQuota` w `server/src/middleware/quota.middleware.ts` |
| Invite service policy | Czesciowo gotowe | `InvitationService` uzywa `canInviteUsers` |
| Internal tools | Ma env deny | `INTERNAL_TOOLS_ENABLED` i `requireInternalToolsAccess` |

### 9.3 P0 - Musimy Dowiezc Przed Launch

1. **Przeniesc demo guardy wyzej w Gateway mount order.**

   Obecnie `demoContextMiddleware` i `demoWriteProtection` sa montowane dopiero po wielu routerach. Wczesniejsze trasy moga ominac globalna ochrone demo.

   Ryzykowne trasy przed demo guardem obejmuja m.in.:

   - `/api/ai`,
   - `/api/tools`,
   - `/api/workbook`,
   - `/api/assessment-workflow-v2`,
   - `/api/admin-data`,
   - `/api/billing`.

   Wymaganie:

   - `demoContextMiddleware` i `demoWriteProtection` powinny byc zamontowane mozliwie wczesnie w API gateway.
   - Allowlista pozostaje minimalna: `/api/demo/*`, `/api/auth/*` oraz ewentualnie jawnie zaakceptowane publiczne endpointy.

2. **Zweryfikowac `X-Demo-Session-Org` po stronie backendu.**

   Naglowek nie moze sam ustawic `req.organizationId`. Backend musi:

   - pobrac aktywna demo session dla `req.user.id`,
   - porownac `requestedSessionOrgId` z `session.session_org_id`,
   - zaakceptowac tylko zgodna aktywna sesje,
   - odrzucic lub zignorowac niezgodny header,
   - nigdy nie pozwolic wskazac cudzej organizacji.

3. **Podpiac `trialEntryGuard` realnie w runtime.**

   Guard istnieje, ale nie jest obecnie zauwazalnie zamontowany. Trzeba go podpiac:

   - globalnie po auth dla authed API, albo
   - punktowo na krytyczne powierzchnie mutujace.

   Dodatkowo trzeba poprawic `BLOCKED_ROUTES`, bo obecna lista nie odpowiada wszystkim faktycznym trasom:

   - invite: `/api/organizations/invitations`, nie tylko `/api/organizations/.*/invite`,
   - upload: `/api/documents/upload`, `/api/knowledge/documents`, assessment/report/table/canvas uploads,
   - AI memory: `/api/ai-memory/:key`, nie tylko `/api/ai/memory`.

4. **Wprowadzic kill-switche jako realne guardy.**

   Same flagi w planie nie wystarcza. Musza istniec w runtime:

   ```text
   DEMO_WRITES_ENABLED=false
   TRIAL_INVITES_ENABLED=false
   TRIAL_UPLOAD_ENABLED=false
   TRIAL_EXPORT_ENABLED=false
   TRIAL_AI_MEMORY_ENABLED=false
   PUBLIC_SHARE_ENABLED=false
   AI_AUTOPILOT_ENABLED=false
   INTERNAL_TOOLS_ENABLED=false
   ```

5. **Zablokowac wysokiego ryzyka surfaces deny-by-default.**

   Do czasu osobnego hardeningu blokujemy:

   - upload/import,
   - export,
   - public share links,
   - AI memory write,
   - AI operator/autopilot,
   - governance approvals,
   - advanced admin/security role writes,
   - invite poza zaakceptowanym trial org mode.

### 9.4 P1 - Musimy Dowiezc Zaraz Po P0 / Przed Szerszym Ruchem

| Obszar | Luka | Wymagane domkniecie |
| --- | --- | --- |
| `checkAccess` coverage | Uzycie punktowe, nie globalne | Helper/middleware per action: `create_project`, `create_initiative`, `invite_user`, `upload`, `write`, `ai_call` |
| Upload | `enforceStorageQuota` istnieje, ale nie obejmuje wszystkich uploadow | Podpiac do dokumentow, knowledge, assessment attachments, report-builder, notebook, branding, table/canvas uploads |
| Export/share | Wiele endpointow bez demo/trial policy | Kill-switch i backend guard przed eksportem/share |
| AI memory | `/api/ai-memory` moze byc mountowane bez trial/demo policy | Guard `TRIAL_AI_MEMORY_ENABLED` + demo block + audit |
| AI operator/autopilot | Mutacje AI operator bez jasnego trial/demo guardu | `AI_AUTOPILOT_ENABLED=false` i UI hide |
| Trial expired | UI ma banner/modal, ale twardy frontend gate jest slabym/stubowym elementem | Backend pozostaje source of truth; frontend powinien blokowac canvas/action surfaces proaktywnie |
| Frontend blocked actions | `isActionBlocked()` malo uzywane | Podlaczyc do upload/export/share/invite/admin/autopilot buttons |
| Demo state | Rozjazd `isDemoMode` vs `currentUser.isDemo` | Ujednolicic stan demo po login/register demo |
| CTA | Trzy sciezki demo -> trial | Ujednolicic na jedna kanoniczna sciezke |

### 9.5 P2 - Swiadome Ryzyka Akceptowalne Na Ograniczony Launch

Te elementy mozemy swiadomie zaakceptowac, jesli sa ukryte, zablokowane albo nie sa centralne dla promocji:

- niepelna i18n w czesci modalow demo,
- martwe lub duplikujace komponenty bannerow demo/trial,
- brak pelnego SuperAdmin dashboardu demo/trial analytics,
- brak pieknej finalnej grafiki wszystkich CTA,
- brak pelnego feature entitlement matrix,
- read-only/degraded UX w czesci modulow pokazowych,
- brak pelnej automatyki cleanup/cron dla demo sessions pod warunkiem, ze demo session cleanup dziala przy demo API i nie tworzy danych produkcyjnych.

### 9.6 Inventory Powierzchni Do Guardow / Kill-Switchy

| Surface | Przyklady backend | Frontend UX | Decyzja launch |
| --- | --- | --- | --- |
| Invite | `/api/organizations/invitations`, org member add | Team/invite buttons | Ukryc w demo/trial entry; trial org tylko po limicie i guardzie |
| Upload/import | documents, knowledge, assessment attachments, notebook, branding, report-builder, table/canvas | Upload buttons/dropzones | Ukryc/disabled dla demo i trial entry |
| Export | report-builder, document-studio, presentations, interview export, data export | Export buttons | Ukryc/disabled dla demo/trial entry; trial org tylko po decyzji |
| Share/public links | document-studio share-links, report-builder share, table view share, work-canvas share | Share buttons | `PUBLIC_SHARE_ENABLED=false` na launch |
| Report generation | assessment reports, report-builder, management reports | Generate/finalize/approve buttons | Read-only preview albo disabled |
| AI memory | `/api/ai-memory/:key` | Memory/settings writes | Disabled dla demo/trial entry |
| AI autopilot/operator | `/api/ai-operator`, table AI editor apply, Teresa/canvas autopilot apply | Autopilot/apply buttons | Hide/preview-only |
| Initiatives write | `/api/initiatives`, `/api/pmo/initiatives`, generated initiatives | Create/generate/promote | Demo/trial entry blocked; trial org limited |
| Admin/security | role builder, security settings, org roles | Admin/sidebar/settings | Hide in demo/trial entry; paid/admin only |
| Billing destructive | cancel/ownership/payment destructive actions | Billing settings | Hide except contact/upgrade/add payment |

### 9.7 Co Weryfikujemy Przed Decyzja GO

#### Backend smoke

- `GET /ping` -> 200.
- `GET /api/ready` -> ready.
- Public API bez tokena nie zwraca danych tenantowych.
- Demo start tworzy/odswieza aktywna session.
- Demo request z poprawnym `X-Demo-Session-Org` dziala.
- Demo request z cudzym `X-Demo-Session-Org` jest odrzucony albo ignorowany.
- Demo `POST/PATCH/PUT/DELETE` poza allowlista zwraca `DEMO_READ_ONLY`.
- Trial Entry user nie moze:
  - create initiative,
  - invite,
  - upload,
  - export,
  - write AI memory,
  - generate durable report,
  - use autopilot/do-actions.
- Trial org respektuje:
  - project limit,
  - user limit,
  - initiative limit,
  - AI call limit,
  - token budget,
  - storage limit.

#### Frontend smoke

- Landing -> demo entry -> app pokazuje demo banner.
- Demo ma jasny read-only copy.
- Demo blocked action pokazuje `AccessBlockedModal`, nie crash.
- Demo -> Start Trial prowadzi do jednej kanonicznej sciezki.
- Trial Entry pokazuje sensowny onboarding i CTA do org setup.
- Expired trial pokazuje persistent banner.
- Upload/export/share/invite/admin/autopilot sa hidden albo disabled przed kliknieciem.
- Brak pustego offsetu demo banner (`currentUser.isDemo` bez `isDemoMode`).

#### Runtime/log smoke

- Brak nowych 5xx w login/demo/trial/org setup.
- Brak cross-tenant symptomow.
- Brak demo writes do shared org.
- Logi nie ujawniaja payloadow wrazliwych.
- Rate-limit nie blokuje normalnej sciezki promo.

### 9.8 Co Swiadomie Blendujemy / Chowamy Na Launch

Na potrzeby promocji nie probujemy udowadniac, ze caly produkt jest kompletny. Swiadomie pokazujemy wartosc i chowamy obszary niedomkniete:

| Obszar | Jak chowamy | Kiedy wraca |
| --- | --- | --- |
| Upload realnych danych | Hide/disabled + copy `available after workspace activation` | Po security/retention/upload policy |
| Export/public share | Hide/disabled + `Contact sales / Upgrade` | Po audycie data leakage i tokenized share |
| Role builder/admin security | Ukryty w demo/trial entry | Po pelnym RBAC/admin hardening |
| AI memory writes | Disabled | Po privacy consent + audit/read-back |
| AI autopilot/do-actions | Preview/advisory only | Po human-in-the-loop + audit + capability guard |
| Governance approvals | Read-only / disabled | Po initiative gate guard coverage |
| Integracje/konektory | Hidden/degraded | Po osobnym connector security review |
| Advanced billing self-serve | Contact/sales fallback | Po potwierdzeniu Stripe/manual billing flow |
| Martwe legacy komponenty UI | Nie eksponowac | Cleanup po launchu |

### 9.9 Updated Readiness Matrix

| Obszar | Gotowosc | Werdykt |
| --- | --- | --- |
| Public landing / legal / pricing | Wysoka | `GO` po smoke |
| Public Anna | Srednia-wysoka | `GO_WITH_P2`, jesli degraded state dziala |
| Demo read-only value | Srednia | `GO_AFTER_P0` |
| Demo session isolation | Niska-srednia | `NO_GO` do walidacji headera |
| Trial Entry | Niska | `NO_GO` do mountu `trialEntryGuard` |
| Trial org limits | Srednia-wysoka | `GO_WITH_P2` |
| AI quota | Srednia | `GO_WITH_P2`, wymaga smoke kosztow/limitow |
| Upload/import | Niska | `HIDE` |
| Export/share | Niska | `HIDE` |
| Invites | Srednia w service layer, nierowna w route layer | `HIDE_IN_ENTRY`, trial org po guardzie |
| Admin/security | Niska dla self-serve | `HIDE` |
| AI autopilot/operator | Niska dla demo/trial | `HIDE/PREVIEW_ONLY` |
| Monitoring | Srednia | `GO_WITH_P2`, wymaga dashboard/log watch |

### 9.10 Updated Launch Gate

Przed jakimkolwiek ruchem produkcyjnym:

```text
Gate P0:
1. Demo guard mount order fixed.
2. X-Demo-Session-Org validated server-side.
3. trialEntryGuard mounted and routes corrected.
4. Kill-switches implemented for upload/export/share/invite/AI memory/autopilot.
5. Smoke public/demo/trial passes without 5xx and without tenant leakage.
```

Jesli dowozimy tylko P0 i chowamy P1/P2 surfaces:

```text
Launch verdict: GO_WITH_P2 for Limited Promo Demo
```

Jesli P0 nie jest dowiezione:

```text
Launch verdict: NO_GO
```

## 10. Kryteria GO

Mozemy ruszyc z promocja, jesli:

- Demo session isolation jest zabezpieczone.
- Trial Entry Guard dziala runtime.
- Upload/export/share/invite sa zaslepione lub kontrolowane.
- Public/demo/trial sciezka przechodzi manualnie.
- Produkcja ma poprawne CORS/cookies/JWT/frontend URL.
- Logi po deployu nie pokazuja nowych 5xx.
- UI jasno komunikuje ograniczenia.

## 11. Kryteria NO-GO

Nie ruszac, jesli:

- header demo moze wskazac cudzy org,
- trial entry moze tworzyc trwale dane,
- demo zapisuje do wspolnej organizacji,
- public share/export jest aktywny bez audytu,
- login/register/demo start maja 5xx,
- uzytkownik widzi broken UI zamiast locked state.

## 12. Risk Register

| Priorytet | Ryzyko | Skutek | Guardrail |
| --- | --- | --- | --- |
| P0 | Demo org spoof przez header | Cross-tenant access | Walidacja sesji demo po stronie backendu |
| P0 | Trial guard niepodpiety | Trial Entry tworzy trwale dane | Backend guard na endpointach mutujacych |
| P0 | Public share/export aktywny | Wyciek danych | Kill-switch + deny-by-default |
| P0 | Upload realnych danych bez polityk | Ryzyko security/compliance | Upload disabled dla demo/trial entry |
| P1 | User nie rozumie demo vs trial | Spadek zaufania / drop-off | Banner + locked states + CTA |
| P1 | Billing CTA prowadzi do niedzialajacego flow | Friction w konwersji | Contact/sales fallback |
| P1 | AI przekracza budzet tokenow | Koszt operacyjny | Trial AI limits + monitoring |
| P2 | Niektore moduly sa degraded | Gorszy odbior produktu | Read-only/degraded copy zamiast crash |

## 13. Nastepny Krok

Pierwszy pakiet wykonawczy:

1. Walidacja `X-Demo-Session-Org`.
2. Podpiecie `trialEntryGuard`.
3. Kill-switche dla upload/export/invite/share/AI memory.
4. Manual smoke public/demo/trial.

Po tym podejmujemy decyzje produkcyjna:

```text
GO_WITH_P2 - promocja moze ruszyc w ograniczonym trybie
NO_GO      - blokada do czasu usuniecia P0/P1
```

## 14. Plan Dokonczenia - Execution Program

Status: `READY_FOR_IMPLEMENTATION_PLANNING`

Cel tej sekcji: zamienic audyt gotowosci na konkretna kolejnosc prac, tak aby domknac ograniczony launch demo/trial bez wciagania pelnego staging cutover.

### 14.0 Execution Update - 2026-05-26

Status: `SPRINT_A_B_BACKEND_GUARDS_IMPLEMENTED_PENDING_FULL_SMOKE`

Zmiany wykonane:

- `server/src/Gateway.ts`: `demoContextMiddleware` i `demoWriteProtection` zostaly przeniesione bezposrednio po `apiLoggingMiddleware`, tak aby obejmowaly trasy montowane wczesniej przed starym guardem.
- `server/src/middleware/demoGuard.middleware.ts`: `X-Demo-Session-Org` nie jest juz zaufanym bypass/read-write sygnalem; session org jest akceptowany tylko po dopasowaniu do aktywnej sesji usera w `demo_sessions`.
- `server/src/middleware/auth.middleware.ts`: auth attach nie przepisuje juz `organizationId` na dowolny `X-Demo-Session-Org`; dla niezweryfikowanego demo headera fallbackuje do `DEMO_ORG_ID`.
- `server/src/middleware/trialEntryGuard.middleware.ts`: guard zostal dopasowany typowo do Express `RequestHandler`, z zachowaniem runtime castu do `TrialRequest`.
- `server/src/Gateway.ts`: `trialEntryGuard` zostal podpiety na krytyczne mutujace prefiksy: initiatives, projects, pmo initiatives/projects, organizations, invitations, media-ingestion, knowledge, trial, roadmap, assessment, reports, report-import.

Walidacja wykonana:

- `ReadLints` dla zmienionych plikow: `PASS`.
- `npm run typecheck` w `consultify/server`: `FAIL`, ale po poprawce `trialEntryGuard` nie pokazuje juz nowych bledow na mountach Sprint A/B; pozostaja istniejace bledy typow w `Gateway.ts` oraz `auth.middleware.ts` (`jsonwebtoken.VerifyOptions`).

Gate result: `GO_TO_SPRINT_C_WITH_CAUTION`

Pozostale ryzyka przed finalnym `GO_WITH_P2`:

- Brak jeszcze focused testow automatycznych dla spoofowanego `X-Demo-Session-Org` i Trial Entry blocked routes.
- Kill-switche upload/export/share/invite/AI memory/public share sa nadal do domkniecia w Sprint C.
- Globalny backend typecheck w repo nie jest zielony przez istniejace bledy poza zakresem Sprint A/B; przed deployem trzeba oprzec gate o focused smoke i/lub osobny cleanup typecheck.

### 14.0.1 Execution Update - Sprint C - 2026-05-26

Status: `SPRINT_C_BACKEND_KILL_SWITCHES_IMPLEMENTED_PENDING_SMOKE`

Zmiany wykonane:

- Dodano `server/src/middleware/highRiskSurfaceGuard.middleware.ts` jako wspolny backend guard dla powierzchni wysokiego ryzyka:
  - invite,
  - upload/import/ingestion,
  - export/download,
  - public share/share links,
  - AI memory write,
  - AI operator/autopilot.
- Guard rozpoznaje scope runtime:
  - `DEMO` blokowane deny-by-default,
  - `TRIAL_ENTRY` blokowane deny-by-default,
  - `TRIAL` blokowane, jesli odpowiednia flaga env nie jest `true`,
  - `PAID` przepuszczane, zeby promocyjne flagi nie zatrzymaly platnych organizacji.
- Podpieto guard w `server/src/Gateway.ts` na high-risk prefiksy:
  - documents,
  - knowledge,
  - media-ingestion,
  - organizations/invitations,
  - cloud,
  - branding,
  - document-studio,
  - report-builder,
  - report-import,
  - finance-statements,
  - ai-memory,
  - ai-operator.
- Poprawiono kolejnosc krytycznych mountow Trial Entry na `verifyToken -> trialEntryGuard -> router`, zeby guard mial realny kontekst usera. Bez tego czesc guardow gateway-level dzialala przed auth i mogla tylko przepuszczac request.
- Dodano lokalny alias `gatewayVerifyToken` jako `RequestHandler`, zeby nie rozszerzac runtime, ale uniknac dokladania nowych overloadow TypeScript dla nowych mountow.

Walidacja wykonana:

- `ReadLints` dla `Gateway.ts` i `highRiskSurfaceGuard.middleware.ts`: `PASS`.
- `npm run typecheck` w `consultify/server`: `FAIL`, ale nie pokazuje bledow dla `highRiskSurfaceGuard.middleware.ts`; pozostaja istniejace bledy w `Gateway.ts` przy starych mountach V8/internal/artifacts oraz `auth.middleware.ts` (`jsonwebtoken.VerifyOptions`).

Gate result: `GO_TO_SPRINT_D_WITH_CAUTION`

Pozostale ryzyka przed finalnym `GO_WITH_P2`:

- Brak jeszcze focused runtime smoke dla kazdej kategorii kill-switcha.
- Table Platform/public form surfaces nie zostaly objete szerokim guardem w Sprint C, zeby nie zlamac publicznych intake/form routes bez osobnego rozdzielenia mountow.
- User data export ma niespojny mount/opis (`dataExport.routes.ts` opisuje `/api/data-export`, gateway montuje pod `/api/user`), dlatego wymaga osobnej decyzji przed blokada produkcyjna.
- Globalny typecheck nadal nie jest zielony przez istniejace bledy repo, wiec finalny gate wymaga focused smoke i/lub osobnego cleanupu typow.

### 14.0.2 Execution Update - Sprint D - 2026-05-26

Status: `SPRINT_D_FRONTEND_ACCESS_GATES_IMPLEMENTED_PENDING_VISUAL_SMOKE`

Zmiany wykonane:

- Dodano `src/utils/accessBlocked.ts` jako centralny frontend helper dla kodow access-blocked.
- Helper obejmuje nowe backendowe kody Sprint C:
  - `TRIAL_INVITES_DISABLED`,
  - `TRIAL_UPLOAD_DISABLED`,
  - `TRIAL_EXPORT_DISABLED`,
  - `PUBLIC_SHARE_DISABLED`,
  - `TRIAL_AI_MEMORY_DISABLED`,
  - `AI_AUTOPILOT_DISABLED`,
  - oraz `TRIAL_ENTRY_RESTRICTION`.
- `src/components/access/AccessBlockedModal.tsx` mapuje teraz nowe kody na sensowne CTA:
  - Trial Entry -> create organization,
  - trial/demo high-risk disabled -> contact sales.
- `src/services/api.ts`, `src/services/api/baseClient.ts` i `src/services/apiUtils.ts` emituja teraz spójny event `access:blocked` dla nowych kodow, zamiast zostawiac usera z surowym `403`.

Walidacja wykonana:

- `ReadLints` dla zmienionych plikow frontendowych: `PASS`.
- `npm run type-check` w `consultify`: `FAIL`, ale tylko na istniejacych bledach poza Sprint D:
  - `FeedbackSidePanel.tsx`,
  - brak symbolu `Bot` w kilku komponentach MyWork/settings/superadmin.

Gate result: `GO_TO_SPRINT_E_WITH_CAUTION`

Pozostale ryzyka przed finalnym `GO_WITH_P2`:

- Brak jeszcze wizualnego smoke dla konkretnych surface: upload/export/share/invite/AI memory/autopilot.
- UI hide/disable przyciskow w kazdym module nie jest jeszcze kompletne; obecny Sprint D gwarantuje kontrolowany modal po kliknieciu/API 403, nie pelne ukrycie kazdego entry pointu.
- CTA sciezki wymagaja finalnego smoke (`/trial/create-org`, `/contact`, billing/settings).

### 14.0.3 Execution Update - Sprint E - 2026-05-26

Status: `STATIC_EVIDENCE_PASS_RUNTIME_SMOKE_REQUIRED`

Evidence statyczne:

- Demo guard:
  - `demoContextMiddleware` i `demoWriteProtection` sa montowane w `Gateway.ts` bezposrednio po `apiLoggingMiddleware`.
  - `X-Demo-Session-Org` jest walidowany przez `resolveValidatedDemoSessionOrgId`.
  - Niezweryfikowany demo session org fallbackuje do `DEMO_ORG_ID`.
  - Demo writes wymagaja `DEMO_WRITES_ENABLED=true` oraz zwalidowanej sesji; domyslnie deny.
- Trial Entry:
  - Krytyczne mounty maja kolejnosc `gatewayVerifyToken -> trialEntryGuard -> router`.
  - Guard zwraca kontrolowany `403 TRIAL_ENTRY_RESTRICTION` z CTA.
- Kill-switche:
  - `highRiskSurfaceGuard` obejmuje invite, upload/import/ingestion, export/download, public share/share-links, AI memory write, AI operator/autopilot.
  - `PAID` scope jest przepuszczany, zeby promocyjne flagi nie blokowaly platnych organizacji.
  - Trial/demo/trial-entry dostaja kontrolowany `403` i kody frontendowe.
- Frontend UX:
  - `accessBlocked.ts` centralizuje kody access-blocked.
  - `api.ts`, `api/baseClient.ts`, `apiUtils.ts` emituja `access:blocked`.
  - `AccessBlockedModal` mapuje nowe kody Sprint C na CTA.

Walidacja uruchomiona:

- `ReadLints` dla zmienionych backend/frontend plikow: `PASS`.
- `server npm run build`: `PASS`.
- `consultify npm run build`: pierwszy przebieg `FAIL` przez Node heap OOM przy renderowaniu chunkow; powtorka z `NODE_OPTIONS=--max-old-space-size=8192 npm run build`: `PASS`.
- `server npm run typecheck`: `FAIL` przez istniejace bledy `Gateway.ts` overload oraz `auth.middleware.ts` `jsonwebtoken.VerifyOptions`, bez nowych bledow w `highRiskSurfaceGuard`.
- `consultify npm run type-check`: `FAIL` przez istniejace bledy poza Sprint D (`FeedbackSidePanel.tsx`, brak `Bot` w kilku komponentach), bez bledow w nowych plikach Sprint D.

Build warnings:

- Rollup ostrzega o cyklicznym reeksporcie `INITIATIVE_STATUS_METADATA`.
- Vite ostrzega o dynamic/static import mix dla kilku duzych modulow.
- Czesc chunkow przekracza 500 kB.

Runtime smoke status:

- `NOT_RUN`: brak uruchomionego backend/frontend dev servera w terminalach podczas Sprint E.
- `NOT_RUN`: brak deploy id i commit SHA dla srodowiska produkcyjnego/stagingowego.
- `PASS`: focused runtime-style Vitest bez mutacji DB:
  - `tests/unit/backend/middleware/demoGuard.preferences.test.ts`,
  - `tests/unit/backend/middleware/highRiskSurfaceGuard.middleware.test.ts`,
  - `tests/unit/utils/accessBlocked.test.ts`.
  - Wynik: `3 files passed / 18 tests passed`.
- `SKIPPED_BY_DESIGN`: `smoke-demo-script-a.ts` nie zostal odpalony, bo tworzy trial org i zmienia demo preference w DB; wymaga jawnego wskazania bezpiecznego srodowiska.

Minimalny smoke wymagany przed publiczna promocja:

1. Health:
   - `/ping`,
   - `/api/ready`,
   - login/logout.
2. Demo:
   - start demo,
   - demo status/org,
   - fake `X-Demo-Session-Org` nie zmienia org context,
   - demo write -> `DEMO_READ_ONLY`.
3. Trial Entry:
   - create initiative blocked,
   - invite blocked,
   - upload/import blocked,
   - report export/share blocked,
   - AI memory/autopilot blocked,
   - allowed read/chat path nadal dziala.
4. Trial org:
   - high-risk flags false -> kontrolowany modal/CTA,
   - paid org sanity -> brak false positive.
5. Frontend:
   - kazdy nowy kod Sprint C pokazuje `AccessBlockedModal`,
   - CTA `/trial/create-org` i `/contact` dzialaja,
   - brak surowego `403/500` w promocyjnej sciezce demo/trial.

Gate result: `PASS_WITH_P2_FOCUSED_TESTS__STAGING_SMOKE_REQUIRED`

Decyzja launch:

- `NO_GO_FOR_FULL_PUBLIC_LAUNCH` bez runtime smoke.
- `GO_FOR_INTERNAL_STAGING_SMOKE` natychmiast.
- `GO_WITH_P2_FOR_LIMITED_PROMO` dopiero po zaliczeniu minimalnego smoke powyzej na docelowym srodowisku.

Focused test command:

```bash
npx vitest run \
  tests/unit/backend/middleware/demoGuard.preferences.test.ts \
  tests/unit/backend/middleware/highRiskSurfaceGuard.middleware.test.ts \
  tests/unit/utils/accessBlocked.test.ts \
  --maxWorkers=1 --maxConcurrency=1
```

### 14.0.4 Remote Smoke - demo.consultify.ai - 2026-05-26

Status: `REMOTE_SMOKE_PARTIAL_AUTH_REQUIRED`

Host: `https://demo.consultify.ai`

Health probes:

- `GET /ping` -> `200 pong`
- `GET /api/ready` -> `200 {"status":"ready","database":"ready"}`
- `GET /api/health` -> `200 {"status":"ok","database":"connected","environment":"production","redis":"connected"}`
- `GET /` -> `200 text/html`

Unauth/public probes:

- `GET /api/demo/status` -> `401 {"error":"No token provided"}`
- `POST /api/demo/toggle` -> `401 {"error":"No token provided"}`
- `GET /api/public/anna` -> `401 {"error":"No token provided"}`
- `GET /api/legal` -> `401 {"error":"No token provided"}`
- `GET /api/public/contact` -> `401 {"error":"No token provided"}`

Demo/high-risk probes without auth:

- `POST /api/projects` with `X-Demo-Mode:true`, fake `X-Demo-Session-Org` -> `401 {"error":"No token provided"}`
- `POST /api/initiatives` with `X-Demo-Mode:true`, fake `X-Demo-Session-Org` -> `401 {"error":"No token provided"}`
- `POST /api/report-builder/report-1/share` with `X-Demo-Mode:true`, fake `X-Demo-Session-Org` -> `401 {"error":"No token provided"}`
- `POST /api/knowledge/upload` with `X-Demo-Mode:true`, fake `X-Demo-Session-Org` -> `401 {"error":"No token provided"}`
- `POST /api/cloud/import` -> `401 {"error":"No token provided"}`
- `POST /api/document-studio/artifact-1/share-links` -> `401 {"error":"No token provided"}`
- `PUT /api/ai-memory/key` -> `401 {"error":"No token provided"}`
- `POST /api/ai-operator/profile` -> `401 {"error":"No token provided"}`

Interpretacja:

- Host demo jest zdrowy na poziomie health/readiness.
- Bez tokena nie da sie potwierdzic runtime zachowania `DEMO_READ_ONLY`, `TRIAL_ENTRY_RESTRICTION` ani nowych kodow kill-switch.
- Wynik `401` na write routes jest bezpieczny dla anonimowego uzytkownika, ale nie jest dowodem, ze nowe guardy Sprint A-D sa wdrozone na `demo.consultify.ai`.
- Publiczne endpointy `/api/public/anna`, `/api/legal`, `/api/public/contact` zwracaja `401`; jesli maja byc czescia public landing/demo path, to jest `P1/P2` do decyzji produktowej przed promocja.

Gate result: `REMOTE_GO_FOR_AUTHENTICATED_STAGING_SMOKE_ONLY`

Warunek podniesienia do `GO_WITH_P2_FOR_LIMITED_PROMO`:

- dostarczyc token/konto demo lub wykonac smoke z zalogowanej sesji,
- potwierdzic, ze docelowy deploy zawiera zmiany Sprint A-D,
- powtorzyc minimalny smoke: demo write, spoofed session org, trial entry writes, upload/export/share/invite/AI memory/autopilot, frontend modal CTA.

### 14.0.5 Authenticated Remote Smoke - demo.consultify.ai - 2026-05-26

Status: `AUTH_SMOKE_FAILS_DEMO_GUARD_CONFIRMATION`

Host: `https://demo.consultify.ai`

Auth:

- `POST /api/auth/login` -> `200`
- `GET /api/auth/me` -> `200`
- `GET /api/demo/status` -> `200`, `isDemoMode=false`
- `GET /api/organization/policy-snapshot` -> `200`, returned `orgType=PAID`, `isPaid=true`, `posture=trial_active`

Authenticated probes with `X-Demo-Mode:true` and fake `X-Demo-Session-Org`:

- `POST /api/projects` -> `429 ORG_NOT_FOUND`
- `POST /api/initiatives` -> `400 Invalid input`
- `POST /api/report-builder/report-1/share` -> `404 Report not found`
- `POST /api/knowledge/upload` -> `404 API_ROUTE_NOT_FOUND`

Expected after Sprint A/B:

- demo write probes should return controlled `403 DEMO_READ_ONLY` before reaching route validation/business logic.

Actual:

- requests reached downstream route/auth/business logic instead of being stopped by demo write protection.

High-risk probes without demo header:

- `POST /api/cloud/import` -> `400 required fields`
- `POST /api/document-studio/artifact-1/share-links` -> `201` and created a public share link for `artifact-1`
- `PUT /api/ai-memory/key` -> `409 MEMORY_REQUIRES_STEWARDSHIP`
- `POST /api/ai-operator/profile` -> `404 API_ROUTE_NOT_FOUND`

Cleanup:

- Smoke-created share link `share-link-1779852888849-5r1o8cf4` was revoked through the official revoke endpoint.
- Verification after cleanup: link status `revoked`.

Interpretacja:

- This authenticated account resolves as `PAID`, so high-risk kill-switches are not expected to block normal paid-org actions.
- However, demo-header probes should still prove demo write protection. They did not.
- Therefore `demo.consultify.ai` either does not yet run the Sprint A-D build or the deployment route order differs from the local implementation.

Gate result: `NO_GO_FOR_LIMITED_PROMO_UNTIL_DEPLOY_OR_ROUTE_ORDER_FIXED`

Required next action:

1. Deploy current Sprint A-D changes to `demo.consultify.ai` or confirm the exact commit/deploy id currently serving the host.
2. Re-run authenticated smoke with `X-Demo-Mode:true`:
   - `POST /api/projects`,
   - `POST /api/initiatives`,
   - `POST /api/report-builder/:id/share`,
   - upload/import endpoints.
3. Expected result before promo: controlled `403 DEMO_READ_ONLY` / configured access-blocked codes, not downstream `400/404/429`.

### 14.1 Zasada Wykonania

Pracujemy w malych, odwracalnych pakietach:

1. Najpierw security/runtime P0.
2. Potem kill-switche i zaslepki.
3. Potem UI consistency.
4. Na koncu smoke, logi, decyzja `GO_WITH_P2 / NO_GO`.

Nie rozszerzamy produktu w trakcie hardeningu. Wszystko, co nie jest potrzebne do bezpiecznej sciezki promocyjnej, chowamy albo blokujemy.

### 14.2 Sprint A - Backend P0 Guard Foundation

Cel: sprawic, aby demo/trial byly realnie egzekwowane backendowo.

Zakres:

1. Przeniesc `demoContextMiddleware` i `demoWriteProtection` wyzej w `Gateway.ts`.
2. Utrzymac minimalna allowliste:
   - `/api/demo/*`,
   - `/api/auth/*`,
   - jawnie zaakceptowane publiczne GET/health endpoints.
3. Zweryfikowac `X-Demo-Session-Org`:
   - odczyt aktywnej sesji usera,
   - match z `session.session_org_id`,
   - reject/ignore mismatch,
   - audit/log bez payloadow wrazliwych.
4. Dodac testy dla:
   - poprawnej sesji demo,
   - obcego `X-Demo-Session-Org`,
   - write w demo przed i po route mount order,
   - allowlist `/api/demo/*`.

Pliki:

- `server/src/Gateway.ts`
- `server/src/middleware/demoGuard.middleware.ts`
- `server/src/services/demo/demoSessionService.ts`
- testy middleware/gateway demo guard

Exit gate:

- Demo write protection dziala dla tras, ktore byly wczesniej przed guardem.
- Cudzy `X-Demo-Session-Org` nie zmienia tenant context.
- Brak regresji login/demo toggle.

### 14.3 Sprint B - Trial Entry Runtime Guard

Cel: `Trial Entry` przestaje byc tylko stanem w modelu i staje sie realnym backend boundary.

Zakres:

1. Podpiac `trialEntryGuard` po auth dla krytycznych tras albo globalnie dla authed API.
2. Poprawic `BLOCKED_ROUTES` do realnych endpointow:
   - initiatives,
   - pmo initiatives,
   - organizations invitations,
   - documents/knowledge uploads,
   - reports/report-builder exports,
   - roadmap,
   - AI memory,
   - durable report generation,
   - share/public links,
   - autopilot/operator actions.
3. Dodac helper, jesli regexy zaczna byc kruche:
   - `isTrialEntryBlockedRoute(method, path)`.
4. Dodac testy:
   - Trial Entry can chat/read allowed routes,
   - Trial Entry cannot upload/export/invite/create initiative/write memory,
   - non Trial Entry user nie dostaje false positive.

Pliki:

- `server/src/middleware/trialEntryGuard.middleware.ts`
- `server/src/Gateway.ts`
- wybrane route tests

Exit gate:

- Trial Entry nie tworzy trwalych danych.
- Trial Entry ma kontrolowany `403 TRIAL_ENTRY_RESTRICTION` z CTA.

### 14.4 Sprint C - Kill-Switche I High-Risk Surface Guards

Cel: miec szybkie operacyjne wylaczenie ryzykownych funkcji bez duzego refaktoru.

Zakres:

Wprowadzic backendowe env guardy:

```text
TRIAL_INVITES_ENABLED=false
TRIAL_UPLOAD_ENABLED=false
TRIAL_EXPORT_ENABLED=false
TRIAL_AI_MEMORY_ENABLED=false
PUBLIC_SHARE_ENABLED=false
AI_AUTOPILOT_ENABLED=false
```

Guardy maja obejmowac:

- invite,
- upload/import,
- export,
- public share,
- AI memory write,
- AI operator/autopilot,
- destructive governance/admin actions, jezeli sa widoczne w demo/trial.

Zasada:

- Dla demo: deny-by-default.
- Dla trial entry: deny-by-default.
- Dla trial org: allow tylko tam, gdzie mamy limit/capability/status guard.

Pliki kandydaci:

- `server/src/routes/organization/invitations.routes.ts`
- `server/src/controllers/OrganizationController.ts`
- `server/src/routes/documents.routes.ts`
- `server/src/routes/knowledge.routes.ts`
- `server/src/routes/report-builder.routes.ts`
- `server/src/routes/document-studio.routes.ts`
- `server/src/routes/work-canvas.routes.ts`
- `server/src/routes/table-platform.routes.ts`
- `server/src/routes/ai/ai-memory.routes.ts`
- `server/src/routes/ai-operator.routes.ts`

Exit gate:

- Gdy env flag = false, endpoint zwraca kontrolowany kod i CTA.
- Gdy env flag = true, nadal obowiazuje org/trial/demo policy.

### 14.5 Sprint D - Frontend UX Gates I Zaslepki

Cel: user nie ma widziec broken product ani slepych 403 jako normalnego doswiadczenia.

Zakres:

1. Ujednolicic demo state:
   - `currentUser.isDemo`,
   - `isDemoMode`,
   - `demoSessionOrgId`,
   - banner/padding.
2. Uzyc `AccessPolicyContext.isActionBlocked()` dla:
   - upload,
   - export,
   - share,
   - invite,
   - admin/security,
   - autopilot/do-actions.
3. Dla zablokowanych funkcji:
   - preferowac hide w demo,
   - disabled + tooltip/CTA w trial,
   - modal tylko jako fallback.
4. Ujednolicic CTA demo -> trial:
   - jedna kanoniczna sciezka,
   - bez rozjazdu `/trial/start`, `/auth?action=trial`, `/auth?step=login&from=demo`.
5. Zrobic `TrialExpiredGate` realnym UX gate albo jawnie zostawic jako no-op, ale wtedy wszystkie akcje maja blokowac sie przez snapshot/backend.

Pliki kandydaci:

- `src/layouts/MainLayout.tsx`
- `src/services/api.ts`
- `src/store/slices/demoSlice.ts`
- `src/routes/AppRoutes.tsx`
- `src/contexts/AccessPolicyContext.tsx`
- `src/components/access/AccessBlockedModal.tsx`
- `src/components/layout/DemoModeBanner.tsx`
- `src/components/layout/GlobalAccessBanners.tsx`
- surfaces upload/export/share/invite/admin/autopilot

Exit gate:

- Demo ma zawsze widoczny banner lub brak demo offsetu.
- Krytyczne funkcje sa hidden/disabled przed kliknieciem.
- CTA prowadza jedna sciezka.

### 14.6 Sprint E - Smoke, Evidence, Launch Gate

Cel: potwierdzic, ze ograniczony launch jest bezpieczny.

Backend smoke:

1. `/ping`
2. `/api/ready`
3. public unauthenticated API probes
4. demo start/status/org
5. demo write blocked
6. fake `X-Demo-Session-Org` blocked/ignored
7. trial entry blocked writes
8. trial org limits
9. upload/export/share/invite kill-switches
10. AI quota/token budget

Frontend smoke:

1. landing -> demo
2. demo banner visible
3. demo blocked action -> localized modal
4. demo -> trial CTA
5. trial entry onboarding
6. blocked upload/export/share/invite/admin/autopilot hidden/disabled
7. create org -> limited workspace
8. expired trial banner/modal

Runtime smoke:

1. deploy health
2. 5xx scan
3. 401/403 controlled scan
4. no tenant leakage
5. no sensitive logs
6. rate-limit sanity

Evidence required:

- commit SHA,
- deployment id,
- test commands,
- smoke results,
- known P2 residuals,
- final gate result.

Exit gate:

```text
GO_WITH_P2 - only if all P0 pass and hidden surfaces are confirmed
NO_GO      - any P0 failure
```

### 14.7 Execution Order

Kolejnosc bezpieczna:

1. Sprint A - backend demo guard foundation.
2. Sprint B - trial entry runtime guard.
3. Sprint C - kill-switche.
4. Sprint D - frontend zaslepki.
5. Sprint E - smoke i launch gate.

Nie zaczynamy Sprint D jako pierwszego, bo UI hide nie jest security boundary.

### 14.8 Hard Stops

Stop i decyzja ownera, jesli:

- demo header moze wskazac cudza organizacje,
- trial entry moze stworzyc trwale dane,
- upload/export/share dziala w demo/trial entry,
- runtime pokazuje nowe 5xx w login/demo/trial,
- brak jasnego rollbacku dla guardow,
- testy auth/tenant zaczynaja failowac w sposob niejasny.

### 14.9 Swiadomie Poza Tym Programem

Nie robimy teraz:

- pelnego RBAC refactoru,
- pelnego role builder hardening,
- public share productization,
- zaawansowanego upload pipeline,
- AI autopilot production readiness,
- integracji i konektorow,
- pelnego SuperAdmin analytics dashboardu,
- cleanup wszystkich martwych komponentow UI,
- pelnego staging -> production cutover.

Te tematy wracaja po limited launchu jako osobne pakiety.
