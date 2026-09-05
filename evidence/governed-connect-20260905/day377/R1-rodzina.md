# Dyżur 377 — R1/R2: rodzina i przyczyna

## Warunki R0

1. Naprawa zmienia wyłącznie kształt błędu, nigdy warunek odmowy wynikający z `SET-MVP-OAUTH-001`.
2. Sześć miejsc wywołania stanowi jedną rodzinę i wszystkie musi konsumować wspólna klasyfikacja.
3. `materializeGovernedExternalAuthCallback` oraz jej wywołanie strażnika pozostają nietknięte.
4. Błąd `Unknown connector` pozostaje osobną gałęzią `404`; nie wolno go utożsamiać z odmową zatwierdzenia.

## Stan i rodzina przed naprawą

`OAUTH_APPROVED_PROVIDER_REGISTRY` nie jest ustawiona w środowisku dyżuru. Odczyt źródła potwierdza pięć kluczy w `GOVERNED_CONNECTOR_REQUIRED_SCOPES`: `jira`, `gmail`, `asana`, `teams`, `slack`. Brak decyzji rejestru powoduje odmowę również dla tej piątki.

| # | Miejsce wywołania | Trasa HTTP | Przechwycenie przed naprawą | Reachability z `src/` |
| --- | --- | --- | --- | --- |
| 1 | `server/src/routes/settings.routes.ts:1921` | `POST /api/settings/integrations/:provider/connect` | brak | żywa z `ConnectedAppsSettings.tsx` tylko dla `teams`; `jira` nie zbiera wymaganych `client_id/client_secret` |
| 2 | `server/src/routes/settings.routes.ts:2441` | `POST /api/settings/integrations/:provider/refresh` | brak | wyłącznie `useUserIntegrations.ts`; jego konsumenci są w baseline |
| 3 | `server/src/routes/settings.routes.ts:2522` | `PUT /api/settings/integrations/:provider/config` | brak | wyłącznie `useUserIntegrations.ts`; jego konsumenci są w baseline |
| 4 | `server/src/routes/integrations/integrations.routes.ts:217` | `POST /api/integrations/connect/:provider` i alias `POST /api/integrations/:provider/connect` | `catch` obsługuje tylko `Unknown connector` jako `404`; odmowa zatwierdzenia jest ponownie rzucana | `NotificationChannelsSettings.tsx` jest w baseline; brak innego wołacza w `src/` |
| 5 | `server/src/routes/v8/sync.routes.ts:1059` | `POST /api/v8/sync/integrations/:integrationId/configure` | szeroki `catch` zwracał `403` z surowym komunikatem i kodem `GOVERNED_EXTERNAL_AUTH_NOT_APPROVED`, bez wspólnej klasyfikacji | klient API istnieje, ale `configureIntegration` nie ma konsumenta w `src/` |
| 6 | `server/src/routes/v8/sync.routes.ts:1247` | `POST /api/v8/sync/integrations/:integrationId/reauth` | szeroki `catch` jak wyżej | `reauthIntegration` nie ma konsumenta w `src/` |

Korekta wobec instrukcji: teza „zero z sześciu ma dedykowane przechwycenie” jest częściowo obalona. Dwa miejsca w `sync.routes.ts` miały szerokie przechwycenie zwracające `403`, ale ujawniały surowy komunikat i używały innego kodu. Nadal wymagają ujednolicenia do kontraktu `501/GOVERNED_CONNECTOR_NOT_APPROVED`.

## RealPG RED przed naprawą

Pakiet: `server/src/routes/__tests__/day377.governed-connect-honesty.pg.test.ts`, realny `ApiGateway`, podpisany JWT, `organization_members.status='ACTIVE'`, PostgreSQL `127.0.0.1:6448/cx377`, `--retry=0`.

- `POST /api/settings/integrations/google_drive/connect` → `500 {}`.
- `POST /api/integrations/connect/google_drive` → `500 {}`.
- Wszystkie 3 pełne nazwy testów były czerwone, ponieważ oczekiwały `501`, a otrzymały `500`.

Artefakt JSON: `/private/tmp/cx-day377-governed-connect-artefakty/day377-before.json`.

## Łańcuch przyczynowy R2

Żywy front dla `teams` albo bezpośrednie API wchodzi do jednej z sześciu tras. `authType='oauth2'` wraz z kompletną konfiguracją daje `pending_external_auth`, więc handler wywołuje `buildGovernedExternalAuthSession` (`pmSyncExternalAuthMaterializationService.ts:227`, strażnik jako pierwsza instrukcja około linii 231). `requireApprovedGovernedConnector` (`:124-135`) rzuca na pierwszym warunku dla connectorId spoza piątki albo na drugim, gdy `getRegistryApprovalDecision` zwraca `null`. `asyncHandler` (`server/src/utils/asyncHandler.ts:13-22`) przekazuje wyjątek do `next(err)`. Sam `ApiGateway` nie montuje error middleware, dlatego pomiar kończy się `500 {}`; pełny serwer sklasyfikowałby go jako ogólny `500 INTERNAL_ERROR`.

Komentarz rozstrzygający kierunek naprawy brzmi: “SET-MVP-OAUTH-001 / AMD-SET-OAUTH-APPROVED-OUT-002: external OAuth is excluded from MVP. Every reachable consent-URL producer in this file must fail closed unless the connector is explicitly approved through OAUTH_APPROVED_PROVIDER_REGISTRY.”

Odmowa jest zamierzoną polityką. Naprawa nie zmienia tego, kto jest odrzucany; zmienia wyłącznie format odpowiedzi na uczciwy, ustrukturyzowany błąd.

## Pułapki dowodowe

Pakiet RealPG miał w tej samej linii `RUN_DB_TESTS=1`, `MOCK_DB=false`, `DB_TYPE=postgres`, `ENABLE_V8_GLOBAL=true`, `ENABLE_TEST_AUTH_BYPASS=false`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, jawny lokalny `DATABASE_URL` i `JWT_SECRET`. Pierwszy test potwierdza `DB_TYPE=postgres`; log `DB_IDENTITY` wskazał `127.0.0.1:6448/cx377`. Użyto realnego `ApiGateway`, nie gołego routera. `--retry=0` uniemożliwia maskowanie zapisu ponowieniem.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.
