---
doc_id: SEC-PUB-001
truth_type: operations
status: READY_FOR_DECISION
owner: codex
product_owner: piotr
priority: P1
depends_on: OPS-DEMO-002
last_reviewed: 2026-08-01
---

# SEC-PUB-001 — anonimowa powierzchnia zapisu API

## Werdykt

Stan: **FINDING — rejestr do triage'u, nic nie jest naprawiane w tym pakiecie,
z jednym wyjątkiem: pozycja P0 `POST /api/system/repair` została USUNIĘTA (2026-08-01).**

> **AKTUALIZACJA 2026-08-01 — P0 zamknięty.** `POST /api/system/repair` nie istnieje.
> Handler usunięto z `server/src/routes/system-health.routes.ts`; w jego miejscu stoi
> komentarz z warunkami ewentualnego przywrócenia. Regresję pilnuje
> `tests/integration/systemHealthRepairRemoved.contract.test.ts`, który uruchamia
> **realną aplikację** (`server/src/index`) i szpieguje `child_process.exec`.
> Rejestr poniżej liczy więc **54 trasy** (było 55) i **16 przypadkowych** (było 17).
>
> Przy okazji usunięcia skorygowano dwa błędy tego dokumentu i dopisano dwa nowe
> ustalenia — patrz „Korekty i uzupełnienia (2026-08-01)” na końcu.

W API istnieje **55 tras zapisujących** (`POST` / `PUT` / `PATCH` / `DELETE`), do których
handler dochodzi **bez jakiegokolwiek uwierzytelnienia w łańcuchu middleware** — bez
`verifyToken`, bez `optionalAuth`, bez `verifyApiKey`, bez guarda administracyjnego, bez
weryfikacji podpisu. Anonimowy klient z internetu wywołuje je dokładnie tak samo jak
zalogowany użytkownik.

**To NIE jest eskalacja poświadczeniem demo i NIE blokuje `OPS-DEMO-002`.** Te trasy
w ogóle nie czytają poświadczenia: nie ma czego eskalować. Principal demo dostaje na nich
dokładnie tyle, ile przypadkowy przechodzień. Praca jest niezależna od pakietu wejścia do
demo i może iść własnym tempem — z jednym wyjątkiem opisanym niżej
(`/api/system/repair`), który miał charakter P0 i nie czekał na kolejkę — **jest już
usunięty** (2026-08-01).

Z 55 tras **38 jest publicznych z zamysłu** (rejestracja, reset hasła, webhooki
z własnym podpisem, formularze publiczne, linki udostępnione tokenem), a **17 jest
publicznych przez przypadek** — wyglądają na trasy sesyjne i takimi nie są.

Osobno: **7 tras w tej powierzchni wyprowadza tożsamość użytkownika lub tenanta
z CIAŁA ŻĄDANIA**, a nie z sesji. To ta sama klasa defektu, którą `OPS-DEMO-002`
właśnie zamknął w `/api/demo/record-event`.

## Jak powstała ta lista

Nie przyjęto liczby z przeglądu adwersaryjnego (68). Lista została wyprowadzona od nowa,
skryptem, i ręcznie zweryfikowana.

Metoda:

1. rozwiązanie **wszystkich** punktów montażu `app.use('/api/...', ...)` w
   `server/src/Gateway.ts` **oraz** `server/src/index.ts` z powrotem do modułu tras
   (rozwiązanie aliasów importu, w tym `import { verifyToken as gatewayVerifyToken }`);
2. rozwiązanie montażu warunkowego `mountStub(path, router, name)` (Gateway.ts:397) —
   te routery są montowane **tylko** gdy `enableStubRoutes`, czyli poza produkcją albo
   przy `ENABLE_STUB_ROUTES=true`;
3. rekurencyjne zejście przez zagnieżdżone routery (`router.use('/prefix', subRouter)`),
   z dziedziczeniem guardów montażowych i `router.use(...)` bez ścieżki;
4. rozróżnienie routerów w plikach eksportujących **kilka** routerów (7 takich plików —
   m.in. `v8/knowledge-base.routes.ts` ma osobny `router` pod auth i osobny
   `publicKnowledgeBaseRoutes` bez auth) — dopasowanie po nazwie eksportu;
5. uznanie za „uwierzytelnione” każdego z: `verifyToken`, `optionalAuth`,
   `isAuthenticated`, `requireRole`, `requirePermission`, `verifySuperAdmin`,
   `verifyAdmin`, `superAdminGuard`, `requireInternalToolsAccess`, `verifyScimToken`,
   `integrationApiKeyAuth`, `slackVerifyMiddleware`, `optionalVerifyToken`,
   `transactionReadinessGuards` — łącznie z aliasami lokalnymi i tablicami guardów
   rozwijanymi spreadem.

Skrypt: `/private/tmp/anon-write-audit/enum.mjs` (poza repozytorium, zgodnie z zaleceniem).

### Dlaczego 55, a nie 68

| Powód rozbieżności | Wpływ |
| --- | --- |
| Przegląd liczył jako „bez auth” trasy z guardem **innym** niż `verifyToken`/`optionalAuth` | `-` ok. 100 tras: `verifySuperAdmin` (`llm.routes.ts`, `systemHealth.routes.ts`, `feedback.routes.ts`), `superAdminGuard = [verifyToken, verifySuperAdmin]` (`modelRegistry.routes.ts`), `verifyScimToken` (`integrations/scim.routes.ts`), `gatewayVerifyToken` (alias `verifyToken` w Gateway) |
| Trasy montowane przez `mountStub()` — poza produkcją nie istnieją | `-` 1 pozycja została (`/api/verify/resend`), reszta odpadła jako niedostępna produkcyjnie |
| `app.use('/api/metrics', dbMetricsRoutes)` jest **zakomentowany** (`index.ts:149`) | `-2` (`POST /api/metrics/slow-queries/export`, `DELETE /api/metrics/slow-queries` — nie są zamontowane) |
| Moduły tras w ogóle niezamontowane (duplikaty na poziomie `routes/` obok kanonicznych `routes/pmo/`, `routes/user/`) | `-` kilkanaście plików: `routes/tasks.routes.ts`, `routes/initiatives.routes.ts`, `routes/users.routes.ts`, `routes/projects.routes.ts`, `routes/webhooks.routes.ts`, `routes/api-keys.routes.ts` i inne — martwy kod, nie powierzchnia |
| Trasy pominięte przez naiwny parser (komentarz z apostrofem rozjeżdżał licznik nawiasów; router o nazwie innej niż `router`, np. `v8Router`, `publicFormRouter`) | `+` m.in. `POST /api/errors`, `POST /api/auth/register`, `POST /api/share/:token/unlock`, `POST /api/table-platform/public/forms/:slug/submit`, 6 tras `document-studio/share-links/*` |

Pokrycie: skrypt przeszedł **300 z 331** plików tras zawierających zapis; pozostałe 31 to
albo moduły niezamontowane (brak importera prowadzącego do `Gateway.ts`/`index.ts`), albo
podrouterty rejestrowane funkcją (`registerNotebookVersionsRoutes(router)` w
`v8/notebook.routes.ts`) — te ostatnie leżą pod `v8Router`, który ma blankietowe
`v8Router.use(verifyToken)` (`server/src/routes/v8/index.ts:46`), więc są uwierzytelnione
niezależnie od sposobu rejestracji.

Weryfikacja na gałęzi `fix/ops-demo-002-public-entry`, HEAD `8930b50935`.
**Uwaga o numerach linii:** `server/src/routes/auth.routes.ts` jest w tym worktree
modyfikowany równolegle przez inny strumień pracy. Numery linii dla tego jednego pliku
traktuj jako orientacyjne — kotwicą jest ścieżka trasy, nie linia.

---

## Rejestr — 55 tras

Legenda kolumn:

- **Kubeł** — `PUB` = publiczna z zamysłu, `ACC` = publiczna przez przypadek;
- **Limit** — dedykowany limiter na trasie (globalny `apiLimiter` z `index.ts:1075`
  obowiązuje wszędzie i nie jest tu liczony);
- **Walid.** — walidacja ciała (`validateBody(...)` lub schemat `zod` w handlerze);
- **Tenant z ciała** — tożsamość użytkownika lub organizacji brana z `req.body`
  / `req.query` zamiast z sesji.

### `/api/auth` — wejście i cykl życia konta (9)

| M | Ścieżka | Plik:linia | Kubeł | Zapisuje | Limit | Walid. | Tenant z ciała |
| --- | --- | --- | --- | --- | --- | --- | --- |
| POST | `/api/auth/login` | `server/src/routes/auth.routes.ts:199` | PUB | — (sesja) | `authLimiter` (`index.ts:1083`) | tak | nie |
| POST | `/api/auth/refresh` | `server/src/routes/auth.routes.ts:202` | PUB | `refresh_tokens` (przez `RefreshTokenService`) | nie | tak | nie |
| POST | `/api/auth/register` | `server/src/routes/auth.routes.ts:1511` | PUB | `users`, `organizations`, `organization_members`, `access_codes`, `access_code_usage`, `organization_discounts`, `organization_limits` | `authLimiter` (`index.ts:1084`) | tak | nie |
| POST | `/api/auth/register-demo` | `server/src/routes/auth.routes.ts:1061` | PUB | `users`, `demo_sessions` | `demoSignupIpRateLimiter` + `demoSignupIdentityRateLimiter` | tak | nie |
| POST | `/api/auth/demo-login` | `server/src/routes/auth.routes.ts:1358` | PUB | `users`, `organizations` | nie | nie | nie |
| POST | `/api/auth/forgot-password` | `server/src/routes/auth.routes.ts:2145` | PUB | `password_resets` | nie | tak | nie |
| POST | `/api/auth/reset-password` | `server/src/routes/auth.routes.ts:2204` | PUB | `users`, `password_resets` | nie | tak | nie |
| POST | `/api/auth/verify-email` | `server/src/routes/auth.routes.ts:2296` | PUB | `verification_tokens`, `users` (przez `emailVerificationService`) | nie | tak | nie |
| POST | `/api/auth/login-history` | `server/src/routes/user/loginHistory.routes.ts:102` | **ACC** | `login_history` | nie | **nie** | **tak — `req.body.userId`** |

`/api/auth/demo-login` jest domyślnie zamknięte na poziomie handlera
(`isDemoLoginGatewayOpen()` → `410 DEMO_LOGIN_DEPRECATED`), więc mimo braku guarda
w łańcuchu nie stanowi otwartej powierzchni.

### `/api/webhooks`, `/api/token-billing` — przyjęcia zewnętrzne (8)

| M | Ścieżka | Plik:linia | Kubeł | Zapisuje | Podpis | Walid. | Tenant z ciała |
| --- | --- | --- | --- | --- | --- | --- | --- |
| POST | `/api/webhooks/stripe` | `server/src/routes/webhooks/stripe.routes.ts:147` | PUB | zdarzenia Stripe (idempotentne) | **tak** — `stripe.webhooks.constructEvent` | tak | nie |
| POST | `/api/token-billing/webhook` | `server/src/routes/billing/tokenBilling.routes.ts:287` | PUB | kredyty tokenów (`TokenBillingService.creditTokens`) | **tak** — `STRIPE_WEBHOOK_SECRET` | nie | `session.metadata` (ze Stripe, nie od klienta) |
| POST | `/api/webhooks/v8-sync/inbound/:registrationId` | `server/src/routes/webhooks/v8-sync-inbound.routes.ts:20` | PUB | `v8_webhook_deliveries`, `integration_audit_log`, `v8_webhook_registrations` | **tak** — HMAC-SHA256 per rejestracja, brak sekretu = `500` | tak | z rekordu rejestracji |
| POST | `/api/webhooks/sellix` | `server/src/routes/webhooks/sellix.routes.ts:32` | **ACC** | zdarzenia rozliczeniowe | **warunkowy** — tylko gdy `config.webhookSecret` ustawiony | tak | **tak — `body.organizationId` (`:58`)** |
| POST | `/api/webhooks/inbox/slack` | `server/src/routes/webhooks/inbox.routes.ts:38` | **ACC** | `inbox_connector_items` | **warunkowy** — tylko gdy `INBOX_WEBHOOK_SECRET` ustawiony (`:26`) | nie | **tak — `?orgId=` / `X-Inbox-Org-Id`** |
| POST | `/api/webhooks/github` | `server/src/routes/integrations/webhooks.routes.ts:46` | **ACC** | `webhook_events` | **brak** | nie | nie |
| POST | `/api/webhooks/jira/:integrationId` | `server/src/routes/integrations/webhooks.routes.ts:63` | **ACC** | `webhook_events`, **`tasks`**, `integration_sync_mappings` | **brak** | nie | z `:integrationId` (parametr ścieżki, bez weryfikacji) |
| POST | `/api/webhooks/:provider` | `server/src/routes/integrations/webhooks.routes.ts:150` | **ACC** | `webhook_events` | **brak** | nie | nie |

`/api/webhooks/:provider` to catch-all: dowolna ścieżka pod `/api/webhooks/<cokolwiek>`
zapisuje `JSON.stringify(req.body)` do `webhook_events` bez limitu rozmiaru.

### `/api/public/*` + licznik KB — powierzchnia marketingowa i lejek (13)

| M | Ścieżka | Plik:linia | Kubeł | Zapisuje | Limit | Walid. | Tenant z ciała |
| --- | --- | --- | --- | --- | --- | --- | --- |
| POST | `/api/public/contact` | `server/src/routes/public-contact.routes.ts:158` | PUB | `public_contact_requests` | `defaultRateLimiter` | tak | nie |
| POST | `/api/public/partner-applications` | `server/src/routes/public-partner-applications.routes.ts:29` | PUB | zgłoszenia partnerskie | `defaultRateLimiter` | tak | nie |
| POST | `/api/public/partner/track-click` | `server/src/routes/partners.routes.ts:2252` | PUB | klik referralowy (`PartnerReferralService.trackClick`) | **nie** | nie | `referralCode` z ciała (weryfikowany wyszukaniem partnera) |
| POST | `/api/public/booking/:consultantSlug/book` | `server/src/routes/public-booking.routes.ts:43` | PUB | rezerwacja terminu | `authRateLimiter` | nie | ze slugu |
| POST | `/api/public/mini-assessment/start` | `server/src/routes/public-mini-assessment.routes.ts:22` | PUB | sesja mini-assessmentu | `authRateLimiter` | nie | nie |
| POST | `/api/public/mini-assessment/:token/draft` | `server/src/routes/public-mini-assessment.routes.ts:69` | PUB | wersja robocza | `authRateLimiter` | nie | z tokenu |
| POST | `/api/public/mini-assessment/:token/submit` | `server/src/routes/public-mini-assessment.routes.ts:96` | PUB | wynik | `authRateLimiter` | nie | z tokenu |
| POST | `/api/public/report/:token/verify-password` | `server/src/routes/report-builder-public.routes.ts:624` | PUB | — (weryfikacja hasła) | **nie** | nie | z tokenu |
| POST | `/api/public/anna/chat` | `server/src/routes/public-anna.routes.ts:932` | PUB | log rozmowy + **wywołanie LLM** | **nie** | tak | nie |
| POST | `/api/public/anna/funnel-event` | `server/src/routes/public-anna.routes.ts:1331` | PUB | zdarzenie lejka | **nie** | tak | nie |
| POST | `/api/public/anna/voice-event` | `server/src/routes/public-anna.routes.ts:1381` | PUB | zdarzenie głosowe | **nie** | tak | nie |
| POST | `/api/public/kb-v8/articles/:id/view` | `server/src/routes/v8/knowledge-base.routes.ts:173` | PUB | licznik odsłon | **nie** (`v8FeatureGate`) | nie | nie |
| POST | `/api/kb/articles/:id/view` | `server/src/routes/knowledgeBase.routes.ts:154` | PUB | licznik odsłon (`KnowledgeBaseService.trackView`) | **nie** | nie | `sessionId` z ciała |

`/api/public/anna/chat` jest jedyną trasą w tej powierzchni, która **anonimowo pali
budżet LLM** i nie ma dedykowanego limitera.

### Linki udostępnione tokenem (9)

| M | Ścieżka | Plik:linia | Kubeł | Zapisuje | Limit | Nośnik uprawnienia |
| --- | --- | --- | --- | --- | --- | --- |
| POST | `/api/document-studio/share-links/resolve` | `server/src/routes/document-studio.routes.ts:5024` | PUB | konsumpcja tokenu | `publicShareLinkLimiter` | token w ciele |
| POST | `/api/document-studio/share-links/document` | `server/src/routes/document-studio.routes.ts:5054` | PUB | konsumpcja tokenu | `publicShareLinkLimiter` | token w ciele |
| POST | `/api/document-studio/share-links/comments/list` | `server/src/routes/document-studio.routes.ts:5087` | PUB | — (odczyt przez POST) | `publicShareLinkLimiter` | token w ciele |
| POST | `/api/document-studio/share-links/edit-session` | `server/src/routes/document-studio.routes.ts:5118` | PUB | sesja edycji | `publicShareLinkLimiter` | token + `accessScope` |
| POST | `/api/document-studio/share-links/comments` | `server/src/routes/document-studio.routes.ts:5154` | PUB | komentarz | `publicShareLinkLimiter` | token + `accessScope` |
| POST | `/api/document-studio/share-links/comments/:commentId/reply` | `server/src/routes/document-studio.routes.ts:5216` | PUB | odpowiedź | `publicShareLinkLimiter` | token + `accessScope` |
| POST | `/api/share/:token/unlock` | `server/src/routes/share.routes.ts:404` | PUB | `conversation_shares` (upgrade hasła) | własny `rateLimitConsume(token, ip)` | token + hasło (scrypt) |
| POST | `/api/table-platform/public/forms/jwt/:token/submit` | `server/src/routes/table-platform.form-public.routes.ts:109` | PUB | wiersz formularza | `publicFormLimiter` + `requireIntakeEnabled` | JWT w ścieżce |
| POST | `/api/table-platform/public/forms/:slug/submit` | `server/src/routes/table-platform.routes.ts:4141` | PUB | wiersz formularza (`FormService.submitForm`) | **nie**, **brak `requireIntakeEnabled`** | sam slug |

Wariant `:slug` jest wyraźnie słabszy od wariantu `jwt/:token`: ten sam zapis, ale bez
limitera i bez bramki `requireIntakeEnabled`. Do wyrównania.

### SSO, zaproszenia, kody dostępu (5)

| M | Ścieżka | Plik:linia | Kubeł | Zapisuje | Limit | Walid. | Tenant z ciała |
| --- | --- | --- | --- | --- | --- | --- | --- |
| POST | `/api/sso/oidc/callback` | `server/src/routes/integrations/sso.routes.ts:310` | PUB | `sso_auth_states` (DELETE), sesja | **nie** | nie | ze `state` (jednorazowy, wygasający) |
| POST | `/api/sso/saml/callback` | `server/src/routes/integrations/sso.routes.ts:426` | PUB | `sso_auth_states` (DELETE), sesja | **nie** | nie | ze `state` |
| POST | `/api/invitations/accept` | `server/src/routes/organization/invitations.routes.ts:82` | PUB | członkostwo | `apiAuthRateLimiter` + `invitePublicRateLimiter` | tak | z tokenu zaproszenia |
| POST | `/api/access-codes/accept` | `server/src/routes/accessCodes.routes.ts:257` | PUB | `access_code_usage`, członkostwo | `acceptLimiter` | **nie** | **tak — `req.body.userId` (`:266`)** |
| POST | `/api/access-control/requests` | `server/src/routes/access-control.routes.ts:39` | PUB | `access_requests` | **nie** | **nie** | nie |

### Trasy publiczne przez przypadek — reszta (11)

Pozostałe 6 pozycji kubła `ACC` opisano wyżej: 5 webhooków bez podpisu (sekcja
webhooków) i `POST /api/auth/login-history` (sekcja `/api/auth`).

| M | Ścieżka | Plik:linia | Zapisuje / robi | Limit | Walid. | Tenant z ciała |
| --- | --- | --- | --- | --- | --- | --- |
| ~~POST~~ | ~~`/api/system/repair`~~ **USUNIĘTA 2026-08-01** | `server/src/routes/system-health.routes.ts:427` (komentarz w miejscu handlera) | ~~**`child_process.exec('npm run db:test')`**~~ — trasa nie istnieje, `child_process` nie występuje już w tym pliku | — | — | — |
| POST | `/api/access-control/codes/register` | `server/src/routes/access-control.routes.ts:387` | `users`, `access_codes`, `access_code_usage` — **druga ścieżka rejestracji** | nie | nie | `code` + `email` z ciała |
| POST | `/api/analytics/journey/track` | `server/src/routes/journeyAnalytics.routes.ts:16` | zdarzenia journey (`behaviorIntelligenceService.ingestJourneyEvent`) | `apiAuthRateLimiter` | nie | **tak — `userId` i `organizationId`** |
| POST | `/api/analytics/journey/track/batch` | `server/src/routes/journeyAnalytics.routes.ts:37` | zdarzenia journey (wsad) | `apiAuthRateLimiter` | nie | **tak — `userId` i `organizationId`** |
| POST | `/api/feedback/ai-insights` | `server/src/routes/feedback.routes.ts:3030` | **wywołanie LLM** (`feedbackAIService.generateInsights`) | nie | nie | **tak — `req.body.userId` (`:3034`)** |
| POST | `/api/llm/status/refresh` | `server/src/routes/llm.routes.ts:497` | wychodzące sondy do wszystkich dostawców LLM (timeout 8 s) | nie | nie | — |
| POST | `/api/llm/status/test/:provider` | `server/src/routes/llm.routes.ts:509` | wychodząca sonda + ujawnia konfigurację dostawcy | nie | nie | — |
| POST | `/api/errors` | `server/src/routes/client-errors.routes.ts:133` | `client_error_events` | nie (jest własny dedup w pamięci) | obcięcie pól (`clamp`) | nie |
| POST | `/api/verify/resend` | `server/src/routes/verify.routes.ts:45` | — (odpowiada `404 User not found`) | nie | nie | `email` z ciała |
| POST | `/api/test-support/bootstrap` | `server/src/routes/testSupport.routes.ts:563` | `organizations`, `users`, `organization_members`, `test_support_runs` | nie | nie | — |
| POST | `/api/test-support/cleanup` | `server/src/routes/testSupport.routes.ts:702` | `users`, `organizations`, `test_support_runs` (usuwanie) | nie | nie | — |

Dwie pozycje z tej sekcji **nie są dostępne produkcyjnie**, ale zostają w rejestrze,
bo ich zamknięcie zależy od konfiguracji, nie od kodu:

- `/api/test-support/*` — montowane tylko przy `NODE_ENV=test` **i**
  `ENABLE_TEST_SUPPORT=true` (`Gateway.ts:355-358`); handler dodatkowo wymaga
  `TEST_SUPPORT_KEY`. Ryzyko jest **konfiguracyjne**: ustawienie obu zmiennych na
  stagingu otwiera anonimowe tworzenie i kasowanie organizacji.
- `/api/verify/resend` — montowane przez `mountStub` (`Gateway.ts:1092`), czyli tylko
  gdy `enableStubRoutes` (poza produkcją albo `ENABLE_STUB_ROUTES=true`).

## Klasyfikacja — uzasadnienie

### Publiczne z zamysłu (38)

Kryterium: trasa **musi** działać bez sesji, żeby produkt spełniał swoją funkcję, i ma
własny, niesesyjny nośnik uprawnienia.

| Grupa | Uzasadnienie |
| --- | --- |
| `auth/login`, `register`, `register-demo`, `refresh`, `forgot-password`, `reset-password`, `verify-email` (7) | Z definicji poprzedzają sesję albo ją wytwarzają. Uprawnienie niesie hasło, token resetu lub token weryfikacyjny. |
| `auth/demo-login` (1) | Publiczna z zamysłu historycznie; obecnie zamknięta w handlerze (`410`). |
| `webhooks/stripe`, `token-billing/webhook`, `webhooks/v8-sync/inbound/:registrationId` (3) | Nadawcą jest system zewnętrzny bez konta w Consultify. Uprawnienie niesie **podpis** — Stripe `constructEvent`, HMAC-SHA256 per rejestracja. To poprawny wzorzec. |
| `document-studio/share-links/*` (6), `share/:token/unlock`, `table-platform/public/forms/*` (2) (9) | Udostępnienie linkiem: odbiorca z definicji nie ma konta. Uprawnienie niesie token/JWT, a `accessScope` bramkuje mutację. `resolve` zwraca jedno `404` dla „nie ma / cofnięty / wygasł”, więc nie da się enumerować tokenów. |
| `public/*` (12) | Landing, lejek, formularz kontaktowy, mini-assessment, booking, licznik odsłon KB-v8. Anonim to cała docelowa grupa. |
| `sso/oidc/callback`, `sso/saml/callback` (2) | Callback IdP przychodzi zanim powstanie sesja; uprawnienie niesie jednorazowy, wygasający `state` z `sso_auth_states`. |
| `invitations/accept`, `access-codes/accept`, `access-control/requests` (3) | Zapraszany/proszący z definicji nie ma jeszcze konta w organizacji. Uprawnienie niesie token zaproszenia albo kod dostępu. |
| `kb/articles/:id/view` (1) | Licznik odsłon dla anonimowego czytelnika dokumentacji — komentarz w kodzie mówi to wprost („anonymous allowed”, `knowledgeBase.routes.ts:152`). Bliźniak `public/kb-v8/...` policzony wyżej w `public/*`. |

„Publiczna z zamysłu” **nie znaczy „w porządku”**: 4 z nich mają defekty wypisane
w sekcji zaleceń (brak limitera na `public/anna/chat`, brak limitera i bramki na
`table-platform/public/forms/:slug/submit`, brak walidacji na `access-control/requests`,
zaufanie do `req.body.userId` na `access-codes/accept`).

### Publiczne przez przypadek (17)

Kryterium: trasa robi coś, co ma sens **wyłącznie** dla znanego aktora, albo powiela
ścieżkę, która gdzie indziej jest chroniona.

| Trasa | Dlaczego przypadek |
| --- | --- |
| `POST /api/system/repair` **(USUNIĘTA 2026-08-01)** | Uruchamiała proces powłoki na serwerze. **KOREKTA:** zdanie „nie ma żadnego wywołania z frontu (`grep` po `src/` — zero trafień)” było **nieprawdziwe co do dowodu, prawdziwe co do wniosku**. Trafienie w `src/` istnieje: `src/views/SystemHealthDashboard.tsx:45` (`runAutoRepair`). Ten konsument był jednak martwy podwójnie: (a) plik nie jest **nigdzie importowany** (zero trafień na `SystemHealthDashboard` poza samą definicją), (b) wołał `POST /api/system/health/repair`, a trasa nasłuchiwała na `/api/system/repair` — więc nawet po wyrenderowaniu dostałby odpowiedź odmowną. Realnego konsumenta nie było, usunięcie było bezpieczne. Montowana bezwarunkowo w `index.ts:150`, **przed** Gatewayem, więc żaden guard bramy jej nie obejmował. Bliźniaczy moduł `systemHealth.routes.ts` montowany pod `/api/system-health` ma na każdej mutacji `verifySuperAdmin` — czyli sam projekt uznaje tę klasę operacji za superadmińską. |
| `POST /api/auth/login-history` | Zapisuje wiersz `login_history` dla **dowolnego** `userId` z ciała. Rejestr forensyczny, który każdy może zatruć. Sąsiednie trasy w tym samym pliku (`GET /suspicious`) mają `verifyToken`. |
| `POST /api/llm/status/refresh`, `POST /api/llm/status/test/:provider` | Jedyni konsumenci to `src/views/admin/AdminLLMView.tsx` i `src/components/Admin/AI/ModelsProvidersTab.tsx` — ekrany administracyjne. Wszystkie pozostałe mutacje w `llm.routes.ts` mają `verifySuperAdmin`. Te dwie są wyjątkiem bez uzasadnienia. |
| `POST /api/feedback/ai-insights` | Sąsiednie trasy administracyjne w `feedback.routes.ts` mają `verifySuperAdmin`, publiczne zgłoszenia mają `optionalVerifyToken` + `feedbackRateLimiter`. Ta jedna nie ma nic — a wywołuje model. |
| `POST /api/analytics/journey/track`, `.../batch` | Cała reszta `journeyAnalytics.routes.ts` (odczyty) ma `verifyToken` + `isAuthenticated` (`:56-58`). Zapis ma tylko limiter. |
| `POST /api/access-control/codes/register` | **Druga, równoległa ścieżka rejestracji** obok `/api/auth/register`: tworzy `users`, konsumuje `access_codes`, dopisuje `access_code_usage`. Nie przeszła żadnej z hardeningowych poprawek z `OPS-DEMO-002` (normalizacja adresu, limitery, walidacja schematem). Jeśli ma zostać, musi dostać ten sam zestaw kontroli; jeśli nie — do usunięcia. |
| `POST /api/webhooks/github`, `.../jira/:integrationId`, `.../:provider` | Deklarują się jako webhooki, ale **nie weryfikują podpisu w ogóle**. `jira/:integrationId` dodatkowo **aktualizuje `tasks`** po mapowaniu `integration_sync_mappings` — czyli anonim modyfikuje dane produkcyjne tenanta, znając samo `:integrationId`. |
| `POST /api/webhooks/inbox/slack` | Sekret jest sprawdzany **tylko gdy `INBOX_WEBHOOK_SECRET` jest ustawiony** (`inbox.routes.ts:26`). Przy pustej zmiennej trasa przyjmuje dowolne `?orgId=` i wstawia wiersz do `inbox_connector_items` w **cudzej** organizacji. Fail-open. |
| `POST /api/webhooks/sellix` | Ten sam wzorzec: `if (config?.webhookSecret)` — brak konfiguracji znosi weryfikację, a `organizationId` idzie z ciała. |
| `POST /api/errors` | Formalnie telemetria, ale to nieograniczony kanał zapisu do `client_error_events` bez dedykowanego limitera. Klasyfikacja graniczna — zostaje w ACC, bo kanał zapisu bez limitu to kanał zapisu bez limitu. |
| `POST /api/verify/resend` | Wyrocznia enumeracyjna: `404 User not found` vs `200`. Dziś tylko pod `mountStub`. |
| `POST /api/test-support/bootstrap`, `.../cleanup` | Tworzą i **kasują** organizacje oraz użytkowników. Bezpieczne wyłącznie dzięki dwóm zmiennym środowiskowym. |

---

## P1 — zaufanie do wołającego (`caller trust`)

Ta sama klasa defektu, którą `OPS-DEMO-002` zamknął w `/api/demo/record-event`:
tożsamość i tenant pochodzą z ciała żądania, a w łańcuchu nie ma nic, co by je
zweryfikowało. **Do naprawienia przed publicznym stagingiem.**

### P1.1 — `/api/analytics/journey/track` i `/track/batch` (wskazane w zleceniu)

`server/src/routes/journeyAnalytics.routes.ts:20-21` i `:41-42`:

```
const userId = (req as any).user?.id || req.body.userId;
const organizationId = (req as any).user?.organizationId || req.body.organizationId || null;
```

W łańcuchu jest wyłącznie `apiAuthRateLimiter`, więc `req.user` jest **zawsze**
`undefined` — oba pola pochodzą w 100% z ciała. Kontrola `if (!userId) return 401`
sprawdza jedynie, czy pole jest niepuste. Skutek: dowolny klient dopisuje zdarzenia
journey pod dowolnym `userId` w dowolnej organizacji. Zatruwa to warstwę
`behaviorIntelligenceService`, z której czytają panele lejka.

### P1.2 — pozostałe wystąpienia na trasach bez uwierzytelnienia

| # | Miejsce | Kod | Skutek |
| --- | --- | --- | --- |
| P1.2a | `server/src/routes/feedback.routes.ts:3034` (`POST /api/feedback/ai-insights`) | `const { context, userId } = req.body; const actualUserId = userId || req.user?.id;` | Anonim generuje insight LLM w kontekście dowolnego użytkownika. Ciało ma **pierwszeństwo** nad sesją. |
| P1.2b | `server/src/routes/accessCodes.routes.ts:266` (`POST /api/access-codes/accept`) | `const actorUserId = req.user?.id || bodyUserId;` | Anonim konsumuje kod dostępu **w imieniu wskazanego `userId`**, dopisując go do organizacji właściciela kodu. |
| P1.2c | `server/src/routes/user/loginHistory.routes.ts:105` (`POST /api/auth/login-history`) | `const { userId, ipAddress, userAgent, location, status } = req.body;` → `INSERT INTO login_history` | Pełna kontrola nad rekordem forensycznym: fałszywe „udane logowania”, fałszywe IP i lokalizacje. Rejestr `login_history` był już raz źródłem błędnego wniosku operacyjnego (2026-07-31, Elkomtech). |
| P1.2d | `server/src/routes/webhooks/sellix.routes.ts:58` | `const organizationId = body.organizationId ? String(body.organizationId) : null;` | Przy nieustawionym `webhookSecret` — zdarzenie rozliczeniowe przypisane do dowolnej organizacji. |
| P1.2e | `server/src/routes/webhooks/inbox.routes.ts:23-27` | `const orgId = req.query.orgId ?? req.headers['x-inbox-org-id']; if (INBOX_WEBHOOK_SECRET && secret !== ...) return null;` | Przy nieustawionym `INBOX_WEBHOOK_SECRET` — wstrzyknięcie pozycji do skrzynki dowolnej organizacji. |

### P3 — ten sam kształt na trasach **uwierzytelnionych**

Nie są anonimową powierzchnią, ale to ta sama wada projektowa: ciało ma pierwszeństwo
nad sesją albo ją nadpisuje. Do uporządkowania przy okazji, nie przed stagingiem.

| Miejsce | Guard w łańcuchu | Kod |
| --- | --- | --- |
| `server/src/routes/assessment/assessment-workflow.routes.ts:1573`, `:1663`, `:1740` | `verifyToken` (`:33`) | `String(req.body?.userId \|\| req.user?.id \|\| 'user-default')` — ciało **przed** sesją; obecność użytkownika w sesji assessmentu jest podszywalna |
| `server/src/routes/feedback.routes.ts:1706` | `verifySuperAdmin` | `const changedBy = (req as any).user?.id \|\| req.body.userId \|\| null` — atrybucja zmiany statusu |
| `server/src/routes/feedback.routes.ts:2759`, `:2850-2851` | `optionalVerifyToken` | `const actualUserId = userId \|\| req.user?.id` — ciało przed sesją |
| `server/src/controllers/InvitationController.ts:112` | `verifyToken` | `const organizationId = bodyOrgId \|\| req.user?.organizationId` — zaproszenie do organizacji z ciała |
| `server/src/routes/llm.routes.ts:947`, `:1484`, `:1620` | `verifySuperAdmin` | `organizationId` z ciała — dla narzędzia superadmina dopuszczalne, ale wymaga jawnej decyzji |
| `server/src/routes/module-access.routes.ts:204-208` | `verifyToken` | `organizationId`/`userId` z ciała na ścieżce administracyjnej |
| `server/src/routes/managementReports.routes.ts:40` | `verifyToken` (`:25`) | `req.organizationId \|\| req.body.organizationId` |
| `server/src/controllers/SuperAdminController.ts:1075`, `:4110`, `:4504` | superadmin | `organizationId`/`userId`/`adminId` z ciała |

Osobno: `server/src/routes/webhooks.routes.ts:182` ma identyczny wzorzec
(`req.user?.organizationId || req.body.organization_id`), ale **ten moduł nie jest
zamontowany** (kanoniczny jest `routes/integrations/webhooks.routes.ts`). Do usunięcia
razem z resztą martwych duplikatów, nie do naprawy.

---

## Zalecenia

### 1. Zamknąć natychmiast — bez czekania na kolejkę (P0/P1)

„Zamknąć” znaczy tu konkretnie:

| Trasa | Co zrobić | Dlaczego tak |
| --- | --- | --- |
| `POST /api/system/repair` | ~~**Usunąć trasę.** Nie dodawać guarda.~~ → **ZROBIONE 2026-08-01.** | Brak realnego konsumenta (jedyne trafienie w `src/` to martwy, nieimportowany widok wołający inną ścieżkę); funkcja to `exec('npm run db:test')`, która na Railway nie ma sensu operacyjnego. Guard zostawiłby zdalne uruchamianie powłoki jako „funkcję”. Warunki ewentualnego przywrócenia zapisano w komentarzu w miejscu handlera: osobny router superadmiński + `requireSuperAdmin`, jawna flaga env domyślnie `false`, **zero `child_process` w procesie webowym** (dedykowany worker), zamek rozproszony, rate limiting, wpis audytowy, timeout wykonania i kontrola współbieżności. |
| `POST /api/webhooks/github` | **Podpis.** `X-Hub-Signature-256`, HMAC-SHA256 z sekretu per integracja, odrzucenie przy braku sekretu (jak w `v8-sync-inbound`). | To webhook z definicji — auth sesyjny nie ma zastosowania, właściwym mechanizmem jest podpis. |
| `POST /api/webhooks/jira/:integrationId` | **Podpis** + weryfikacja, że `:integrationId` należy do organizacji, której dotyczy `tasks`. | Trasa zapisuje do `tasks`. Bez podpisu to anonimowa mutacja danych tenanta. |
| `POST /api/webhooks/:provider` | **Usunąć catch-all.** Zostawić wyłącznie jawnie zarejestrowanych dostawców. | Nieograniczony `INSERT` sterowany ścieżką to nie jest interfejs, to worek. |
| `POST /api/webhooks/inbox/slack` | **Zamknąć fail-open:** brak `INBOX_WEBHOOK_SECRET` = `500`, nigdy „przepuść”. Docelowo `slackVerifyMiddleware` (już istnieje w `slack/slackInbound.routes.ts`). | Sekret opcjonalny to sekret nieistniejący. |
| `POST /api/webhooks/sellix` | **Zamknąć fail-open:** brak `config.webhookSecret` = `500`. `organizationId` brać **z rejestracji webhooka**, nie z ciała. | Jak wyżej. |
| `POST /api/auth/login-history` | **Usunąć trasę.** | Wpis do `login_history` musi powstawać **po stronie serwera** w ścieżce logowania, z `userId` z właśnie wydanej sesji. Trasa HTTP przyjmująca `userId` z ciała nie da się zabezpieczyć bez sesji, a z sesją jest zbędna. |
| `POST /api/llm/status/refresh`, `POST /api/llm/status/test/:provider` | **Wymóg auth:** `verifyToken` + `verifySuperAdmin`, tak jak reszta `llm.routes.ts`. | Jedyni konsumenci to ekrany admina. |
| `POST /api/feedback/ai-insights` | **Wymóg auth:** `optionalVerifyToken` → nie wystarczy; użyć `verifyToken`. `userId` **wyłącznie** z `req.user`, pole z ciała usunąć. | Wywołanie LLM na koszt organizacji. |
| `POST /api/analytics/journey/track`, `.../batch` | **Wymóg auth:** `verifyToken` + `isAuthenticated` (jak odczyty w tym samym pliku). `userId`/`organizationId` **wyłącznie** z `req.user`; pola z ciała usunąć, nie tylko zdeprecjonować. | Zlecenie wskazuje to jako P1. |
| `POST /api/access-codes/accept` | Zostaje publiczna, ale `bodyUserId` **usunąć**. Gdy nie ma sesji, kod ma być konsumowany na ścieżce rejestracji (`register` + kod), nie przez wskazanie cudzego `userId`. | Nośnikiem uprawnienia jest kod, nie identyfikator ofiary. |
| `POST /api/access-control/codes/register` | **Decyzja: usunąć albo wyrównać.** Jeśli zostaje — normalizacja adresu (`LOWER`), `authLimiter`, `validateBody`, identyczna obsługa duplikatu jak w `/api/auth/register`. | Dziś to obejście wszystkich zabezpieczeń rejestracji zamkniętych w `OPS-DEMO-002`. |

### 2. Rate limiting

Globalny `apiLimiter` (`index.ts:1075`) to jedna wspólna pula na całe `/api` — nie jest
zabezpieczeniem trasy, tylko zaworem. Dedykowanego limitera brakuje na:

- `POST /api/public/anna/chat` — **najpilniejsze**, anonimowo pali budżet LLM;
- `POST /api/public/anna/funnel-event`, `.../voice-event`;
- `POST /api/public/partner/track-click` — zawyżanie statystyk partnerskich;
- `POST /api/public/report/:token/verify-password` — brute force hasła raportu
  (dla porównania `/api/share/:token/unlock` ma własny `rateLimitConsume(token, ip)`);
- `POST /api/table-platform/public/forms/:slug/submit`;
- `POST /api/access-control/requests`;
- `POST /api/errors`;
- `POST /api/sso/oidc/callback`, `POST /api/sso/saml/callback`;
- `POST /api/kb/articles/:id/view`, `POST /api/public/kb-v8/articles/:id/view`.

Zasada do przyjęcia: **każda trasa zapisująca bez sesji ma dedykowany limiter kluczowany
tożsamością sieciową** — wzorzec już wdrożony w `OPS-DEMO-002`
(`demoSignupIpRateLimiter`, klucz hashowany, nie surowy adres e-mail).

### 3. Atrybucja tenanta

Reguła: **`organizationId` i `userId` nigdy nie pochodzą z ciała żądania.** Dopuszczalne
źródła to dokładnie trzy:

1. sesja (`req.user`);
2. rekord wskazany nieodgadywalnym tokenem (share link, zaproszenie, `sso_auth_states`,
   `v8_webhook_registrations`);
3. rekord rejestracji webhooka wyszukany po zweryfikowanym podpisem identyfikatorze.

Do egzekwowania mechanicznie. Najtańsza bramka: skrypt na wzór
`scripts/check-list-canon.sh`, który blokuje commit z wzorcem
`req.body.organizationId` / `req.body.userId` / `req.user?.X || req.body.X`
w `server/src/routes/**` poza jawną listą wyjątków. Bez bramki wzorzec wróci — dziś jest
w 8 plikach, a `req.user?.X || req.body.X` powstał niezależnie co najmniej trzy razy.

### 4. Walidacja ciała

`validateBody(...)` ma dziś **8 z 55** tras (7 w `/api/auth` + `invitations/accept`).
Kolejnych 9 waliduje schematem wewnątrz handlera (`public/anna` ×3, `public/contact`,
`public/partner-applications`, `share/:token/unlock`, `webhooks/sellix`,
`webhooks/stripe`, `webhooks/v8-sync/inbound`). **Pozostałe 38 tras nie waliduje nic.**
Priorytet dla
tych, które piszą do bazy bez ograniczenia rozmiaru:

- `POST /api/webhooks/*` — `JSON.stringify(req.body)` prosto do `webhook_events`;
- `POST /api/access-control/requests` — sześć pól bez sprawdzenia typu ani długości
  (`email`, `firstName`, `lastName`, `phone`, `organizationName`, `requestType`);
- `POST /api/access-control/codes/register` — `email`, `password` bez schematu;
- `POST /api/table-platform/public/forms/:slug/submit` — `data` sprawdzone tylko przez
  `typeof === 'object'`.

Wzorzec do naśladowania: `POST /api/errors` (`client-errors.routes.ts:141-146`) — każde
pole przechodzi przez `clamp(value, maxLen)` przed zapisem.

### 5. Konfiguracja środowiska (nie kod)

Do potwierdzenia na Railway przed publicznym stagingiem:

- `ENABLE_TEST_SUPPORT` **nieustawione** i `TEST_SUPPORT_KEY` **nieustawione** —
  inaczej `/api/test-support/cleanup` kasuje organizacje anonimowo;
- `ENABLE_STUB_ROUTES` **nieustawione** — inaczej wraca `/api/verify/resend` i reszta
  listy `mountStub`;
- `INBOX_WEBHOOK_SECRET` **ustawione** — dopóki fail-open nie jest naprawiony w kodzie,
  to jedyna rzecz, która trzyma `/api/webhooks/inbox/slack` zamknięte;
- sekret webhooka Sellix ustawiony — analogicznie.

---

## Czego ten pakiet **nie** twierdzi

1. **Nie jest to eskalacja demo.** Żadna z 55 tras nie czyta poświadczenia, więc żadna
   nie rozszerza uprawnień konta demo. `OPS-DEMO-002` może iść dalej niezależnie.
2. **Nie zweryfikowano tego na żywym środowisku.** Rejestr jest wyprowadzony ze statycznej
   analizy montażu i łańcuchów middleware na HEAD `8930b50935`. Zgodnie ze złotą regułą
   #1 (`CLAUDE.md`) każdą pozycję przed naprawą należy potwierdzić realnym żądaniem —
   najtaniej `curl` bez nagłówka `Authorization` na staging, po jednej trasie.
3. **Nie sprawdzano guardów wewnątrz handlerów.** Klasyfikacja opisuje **łańcuch
   middleware**. Trasa może mieć własną kontrolę w ciele funkcji — tak jest np.
   z `/api/auth/demo-login` (`isDemoLoginGatewayOpen()`) i z
   `/api/webhooks/v8-sync/inbound/:registrationId` (HMAC w handlerze). Takie przypadki
   opisano jawnie w tabelach; dla pozostałych zakłada się brak.
4. **Nie zmieniono ani jednego pliku poza tym dokumentem.**

## Bramki

Uruchomione na HEAD `8930b50935`:

```
bash scripts/check-ssot-paths.sh
→ check-ssot-paths: OK — wszystkie ścieżki SSOT z CLAUDE.md istnieją.   (exit 0)

node scripts/docs/check-ssot-registry.mjs
→ check-ssot-registry: OK
  - centralna mapa istnieje
  - wszystkie zarejestrowane źródła istnieją
  - 16 pozycji dokumentacji odpowiada menu aplikacji
  - podsystemy techniczne są przypisane do pozycji menu
  - brak numerowanych kopii w rejestrze kanonicznym
  - komplet katalogu SSOT: 10/10
  - komplet centrum dowodzenia: 14/14                                   (exit 0)
```

### Rejestracja w indeksach wspólnych — wymagana, NIE wykonana

Konwencja katalogu wymaga wpisu w plikach współdzielonych. Nie zostały dotknięte
(równolegle pracują nad nimi inne strumienie). Do dopisania przez właściciela indeksu:

1. `docs/program/WEEKEND_COMPLETION_2026-08-01/ACCEPTANCE_BOARD.md`, tabela
   „Odkrycia stagingowe wymagające naprawy”:

   ```
   | `SEC-PUB-001` | Anonimowa powierzchnia zapisu API | READY_FOR_DECISION | 54 trasy zapisu bez auth (P0 `/api/system/repair` USUNIĘTY 2026-08-01); 16 przypadkowych; 7 przypadków zaufania do ciała żądania; +2 nowe pozycje do triage'u (K3 `execSync` na `/ping`, K4 `GET /api/system-health` bez guarda); niezależne od OPS-DEMO-002 |
   ```

2. `docs/program/WEEKEND_COMPLETION_2026-08-01/README.md` — odnośnik
   `[SEC-PUB-001](PACKETS/SEC-PUB-001_ANONYMOUS_WRITE_SURFACE.md)` obok istniejących
   odnośników do `OPS-DEMO-002` i `SEC-AUTH-001`.

## Korekty i uzupełnienia (2026-08-01)

Ustalone przy usuwaniu P0, **na żywej aplikacji** (nie z lektury kodu): sondą
`supertest` po realnym `server/src/index`.

### K1. Ścieżka w rejestrze była poprawna — mylił się opis zadania

Zlecenie naprawy wskazywało `POST /api/system-health/repair` (mount `Gateway.ts:643`)
i twierdziło, że komentarz handlera podaje złą ścieżkę. **Jest odwrotnie.** To dwa różne
pliki o mylnie podobnych nazwach:

| Plik | Montowany w | Pod | Guardy |
| --- | --- | --- | --- |
| `routes/system-health.routes.ts` (z myślnikiem) | `index.ts:150` | `/api/system` | **żadnych** ← tu był defekt |
| `routes/systemHealth.routes.ts` (camelCase) | `Gateway.ts:643` | `/api/system-health` | `defaultRateLimiter` + `verifySuperAdmin` na mutacjach |

Zmierzone: `POST /api/system-health/repair` → `401` (trasa nigdy nie istniała),
`POST /api/system/repair` → `500` przy realnym `exec` / `200` przy zamockowanym.
Rejestr (`:189`) miał więc rację, a `Gateway.ts` nie był w ogóle dotknięty tą naprawą.

### K2. Aplikacja nie odpowiada `404` na nieznane `/api/*`

Sonda: `POST /api/system/definitely-not-a-route` → **`401`**, nie `404`. Catch-all
odrzuca żądanie przed jakimkolwiek handlerem 404. Ma to znaczenie dla każdego testu
regresji w tym pakiecie: asercja „usunięta trasa zwraca 404” byłaby **fałszywie
czerwona**. Właściwa asercja to „nieodróżnialna od trasy, której nigdy nie było”.

### K3. NOWE — drugi anonimowy shell-out: `execSync` na `/ping`

`server/src/controllers/HealthCheckController.ts:36,41` woła
`execSync('git rev-parse --short HEAD')` i `execSync('git rev-parse --abbrev-ref HEAD')`.
Kontroler jest podpięty jako `app.get('/ping', HealthCheckController.ping)`
(`index.ts:112`) — **bez uwierzytelnienia**.

Ocena — **niższa waga niż `/repair`, ale nie zero**:

- argumenty są **stałe**, brak wejścia od użytkownika → **brak wstrzyknięcia polecenia**;
- odpala się tylko gdy **brak** `gitSha`/`gitBranch` w env (`:25-32`) — na Railway env
  jest ustawione, więc na produkcji ścieżka jest zwykle martwa;
- ale w środowisku bez tych zmiennych **każde anonimowe `/ping` forkuje dwa procesy**,
  synchronicznie, blokując pętlę zdarzeń → wektor wyczerpania zasobów.

**Rekomendacja (nie wykonana — poza zakresem tego zlecenia):** policzyć raz przy starcie
i zapamiętać, albo wymagać env i nie sięgać po `git` w runtime.

### K4. NOWE — `GET /api/system-health` jest publiczny

Bliźniaczy moduł ma `verifySuperAdmin` na mutacjach i na większości odczytów, ale
**trasa bazowa** (`systemHealth.routes.ts:75`) go nie ma. Zmierzone: `GET /api/system-health`
→ **`200` bez poświadczenia** (dla kontrastu `GET /api/system-health/detailed` → `401`).
To ujawnienie stanu infrastruktury, nie zapis — dlatego jest poza rejestrem tego pakietu
(rejestr obejmuje `POST`/`PUT`/`PATCH`/`DELETE`). **Nie naprawiane:** plik należy do
innego strumienia prac. Do triage'u jako osobna pozycja.

### K5. Pozostałe `exec`/`spawn` w `routes/` i `controllers/` — czyste

Przegląd `server/src/routes/**` i `server/src/controllers/**` pod kątem `child_process`,
`execAsync`, `exec(`, `spawn(`: poza K3 wszystkie trafienia to **fałszywe alarmy** —
`RegExp.prototype.exec` (`aiMemory.routes.ts:393`, `report-builder.routes.ts:3536`,
`presentations.routes.ts:795`) i `DbPromise.exec` / `db.exec`, czyli SQL, nie powłoka
(`testSupport.routes.ts` ×7, `assessment-level-attachments.routes.ts:63`).
**Innych anonimowych shell-outów nie ma.**

## Stan

`READY_FOR_DECISION` — rejestr kompletny i zweryfikowany statycznie; pozycja P0
dodatkowo zweryfikowana dynamicznie i **zamknięta**. Kolejność i termin naprawy reszty
ustala właściciel. Rekomendacja techniczna: pozostałe pozycje z sekcji „Zamknąć
natychmiast” (11 pozycji, 13 tras — po odjęciu zamkniętego `/api/system/repair`) przed
wystawieniem stagingu publicznie; reszta zwykłą kolejką. Do triage'u dochodzą dwie nowe
pozycje z korekt: **K3** (`execSync` na anonimowym `/ping`) i **K4**
(`GET /api/system-health` bez guarda).
