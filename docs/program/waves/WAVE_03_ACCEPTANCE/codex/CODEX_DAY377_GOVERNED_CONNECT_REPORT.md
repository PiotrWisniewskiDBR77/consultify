# CODEX DAY 377 — GOVERNED CONNECT

Stan: **ZROBIONE_WG_DoD lokalnie na markerze**, bez wdrożenia i bez zmiany decyzji produktowej.

## Baza pracy i marker

Instrukcja z vaulta została przeczytana w całości (1097 linii). Katalog właściciela nie był czytany ani zapisywany; jedynym kontaktem jest dozwolony symlink `node_modules`.

```text
MARKER OK
Preparing worktree (new branch 'codex/day377-governed-connect-20260905')
8f60ab998734adcdf61a080f4e1270c3dbdffceb
```

Sanity `git status --short | head -3` było puste. Tip `github-backup/grafika/m03-20260902` uciekł do przodu; zgodnie z `DEC-2026-08-26-95` praca rozpoczęła się dokładnie na markerze. Nowsze commity i ich diff zostały zmierzone przed startem; integrację wykonuje nadzorca.

## R0 — cztery zasady

Naprawiłem kształt błędu, nie warunek odmowy. Potraktowałem sześć wywołań jako jedną rodzinę. `materializeGovernedExternalAuthCallback` i jej strażnik pozostały nietknięte. Zastana gałąź `Unknown connector` nadal zwraca osobne `404`.

## R1 — rodzina i korekta wagi

| # | Miejsce | HTTP | Przed | Reachability z UI |
| --- | --- | --- | --- | --- |
| 1 | `settings.routes.ts:1921` | `POST /api/settings/integrations/:provider/connect` | brak catch | żywe z `ConnectedAppsSettings` wyłącznie dla `teams` |
| 2 | `settings.routes.ts:2441` | `POST …/:provider/refresh` | brak catch | martwy `useUserIntegrations` |
| 3 | `settings.routes.ts:2522` | `PUT …/:provider/config` | brak catch | martwy `useUserIntegrations` |
| 4 | `integrations.routes.ts:217` | `POST /api/integrations/connect/:provider` i alias | catch tylko `Unknown connector` | martwy `NotificationChannelsSettings`; brak innego wołacza |
| 5 | `sync.routes.ts:1059` | `POST /api/v8/sync/integrations/:id/configure` | szeroki `403`, surowy komunikat | metoda klienta bez konsumenta |
| 6 | `sync.routes.ts:1247` | `POST /api/v8/sync/integrations/:id/reauth` | szeroki `403`, surowy komunikat | metoda klienta bez konsumenta |

Korekta wobec instrukcji: twierdzenie, że 0/6 miało przechwycenie, jest częściowo obalone. Dwa miejsca v8 miały przechwycenie, ale zwracały niespójny kontrakt i ujawniały surowy komunikat. Pomiar środowiska: `OAUTH_APPROVED_PROVIDER_REGISTRY` pusta. Jira nie dociera z żywego frontu do governed connect, bo front zbiera tylko `site_url`, a backend wymaga także `client_id/client_secret`.

RealPG PRZED: `POST /api/settings/integrations/google_drive/connect` → `500 {}`; `POST /api/integrations/connect/google_drive` → `500 {}`.

## R2 — przyczyna

Front `teams` albo bezpośrednie API → handler wylicza `pending_external_auth` → `buildGovernedExternalAuthSession` → jako pierwszą operację woła `requireApprovedGovernedConnector` → brak pasującej decyzji rejestru powoduje `throw` → `asyncHandler.catch(next)` → goły `ApiGateway`, bez error middleware, zwraca `500 {}`.

Komentarz rozstrzygający: “SET-MVP-OAUTH-001 / AMD-SET-OAUTH-APPROVED-OUT-002: external OAuth is excluded from MVP. Every reachable consent-URL producer in this file must fail closed unless the connector is explicitly approved through OAUTH_APPROVED_PROVIDER_REGISTRY.”

Odmowa jest celowa. Zmiana nie poszerza dostępu; uczytelnia wyłącznie odpowiedź.

## R3 — naprawa

Dodałem eksportowany, nierzu­cający predykat `isGovernedConnectorApprovalError(error)`. Rozpoznaje wyłącznie dokładny prefiks wyjątku strażnika, więc nie myli go z `Unknown connector` ani innymi awariami. Wszystkie sześć miejsc używa tego samego predykatu i zwraca:

```json
{"error":"Integracja nie jest dostępna w tej wersji","code":"GOVERNED_CONNECTOR_NOT_APPROVED"}
```

ze statusem `501`. `ConnectedAppsSettings.submitConnectModal` sprawdza `resp.ok`, pokazuje `toast.error(error)` i kończy obsługę przed `startOAuthFlow`; modal zostaje otwarty.

## R4 — dowody zachowania

RealPG PO: obie trasy zwracają `501` z kontraktem wyżej. User A/org A i user B/org B dostali tę samą odmowę. SQL:

```sql
SELECT organization_id, count(*) FROM integrations
WHERE connector_id='google_drive' GROUP BY organization_id;
```

zwrócił `(0 rows)`. Żaden tenant nie dostał efektu ubocznego.

Pełne nazwy serwera, PRZED czerwone / PO zielone:

- `Day 377 — governed connector rejection is honest and tenant-safe returns structured 501 from the settings connect route`
- `Day 377 — governed connector rejection is honest and tenant-safe returns structured 501 from the canonical integrations connect route`
- `Day 377 — governed connector rejection is honest and tenant-safe rejects both organizations without writing integration rows`

Front, zielony:

- `ConnectedAppsSettings governed connect honesty shows the server rejection and does not start OAuth for Teams`

Mutacja 1 w `settings.routes.ts` przywróciła `500` i zaczerwieniła pierwszy przypadek. Mutacja 2 w `integrations.routes.ts` przywróciła `500` i zaczerwieniła drugi. Po obu przywróceniach `git diff --exit-code` był czysty; pełny pakiet końcowy 3/3 PASS. Szczegóły: `evidence/governed-connect-20260905/day377/R4-realpg-mutation.md`.

Pułapki: serwer uruchomiono z realnym `ApiGateway`, podpisanym JWT, aktywnym członkostwem, `DB_TYPE=postgres`, `MOCK_DB=false`, `ENABLE_TEST_AUTH_BYPASS=false`, `ENABLE_V8_GLOBAL=true`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, lokalnym `DATABASE_URL=…127.0.0.1:6448/cx377` i `--retry=0` w tej samej komendzie. `DB_IDENTITY` potwierdził bazę. Test frontu był tylko jednostkowym dowodem DOM/fetch/toast.

## R5 — zrzuty

- `evidence/governed-connect-20260905/day377/governed-connect-pl-light.png` — SHA-256 `bfd776d101cf230a128b79eaaf54f36fd94f27c5cd405eb78dd56e139b64ef0f`.
- `evidence/governed-connect-20260905/day377/governed-connect-en-light.png` — SHA-256 `5308527613c5fa7ac3bdf7733f74aaac9a9ed26e1a6688419c93200a6e60bc98`.

Oba pokazują realny `ConnectedAppsSettings`, otwarty formularz Teams i widoczny toast z polskim komunikatem API. PL/EN różnią się językiem powłoki; komunikat API pozostaje polski zgodnie z kontraktem zlecenia. Browserowy test lokalny potwierdził widoczność toastu i pozostawienie modala otwartego.

## Bramki końcowe

- leaf count PRZED/PO: PL `35294 → 35294`, EN `33154 → 33154`.
- `focus=0`, `list=0`, `artefakt=0` PRZED i PO.
- `reach=1`; lista pozostała dokładnie `49` zastanych plików test-only. Nowe testy dyżuru nie zwiększyły mianownika.
- Nie zmieniono słowników, baseline reachability, macierzy odbioru, middleware, Gateway ani rejestrów OAuth.

## Commity i statystyki

```text
7ab161da0e evidence(day377): zmierz rodzine governed connect i 500
 1 file changed, 47 insertions(+)
e254ed30c7 fix(integrations): zwracaj uczciwa odmowe governed connect
 7 files changed, 301 insertions(+), 30 deletions(-)
1490cc74d1 evidence(day377): dowiedz 500 do 501 i izolacje tenantow
 1 file changed, 46 insertions(+)
```

R5 jest commitem obejmującym ten raport, rejestr, dev-render i dwa PNG; jego SHA jest tipem gałęzi po odbiorze. Po każdym commicie wykonano push wyłącznie na `github-backup/codex/day377-governed-connect-20260905`.

## Bezpieczeństwo wysyłki

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## TWIERDZENIA NIEZWERYFIKOWANE

- `OAUTH_APPROVED_PROVIDER_REGISTRY` na stagingu i produkcji: **NIEZMIERZONE**; środowiska zdalne były zakazane.
- Czy `jira`, `asana`, `gmail` lub `slack` mają inną, działającą ścieżkę do `pending_external_auth` poza ustaleniami dla Jira: **NIEZMIERZONE**.
- Wszystkich sześciu tras nie wywołano dynamicznie; zachowanie dwóch tras zmierzono RealPG, a pozostałe cztery objęto wspólnym predykatem i statycznym mianownikiem. To ograniczenie dowodu, nie twierdzenie o wdrożeniu.
- Staging, produkcja, deploy i odbiór właściciela: **NIEZWERYFIKOWANE**.

## PYTANIA DO WŁAŚCICIELA

1. Czy `OAUTH_APPROVED_PROVIDER_REGISTRY` ma kiedyś zatwierdzić `google_drive`/`onedrive`/`dropbox`, czy chmura ma pozostać poza governed connect, skoro jej właściwy OAuth działa innym mechanizmem? To wymaga osobnej decyzji bezpieczeństwa i osobnego dyżuru.
2. Czy osobny mały dyżur ma uzupełnić frontend Jira o `client_id/client_secret`, czy Jira ma pozostać nieosiągalna w tym mechanizmie?
3. Czy martwe `UserIntegrations/index.tsx` i `NotificationChannelsSettings.tsx` usunąć jako duplikaty, czy zachować do przyszłego podłączenia?

Moja rekomendacja: nie zatwierdzać chmury w governed connect bez jawnego modelu odpowiedzialności za drugi mechanizm OAuth; najpierw rozstrzygnąć, który mechanizm jest kanoniczny. Jira i martwe wołacze powinny dostać osobne, wąskie dyżury, żeby nie mieszać decyzji produktowej z naprawą błędu.
