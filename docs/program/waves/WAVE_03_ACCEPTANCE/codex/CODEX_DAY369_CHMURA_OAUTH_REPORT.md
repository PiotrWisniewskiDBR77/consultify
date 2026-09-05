# CODEX DAY369 — CHMURA OAuth

Stan: **PARTIAL / rdzeń R2–R4 domknięty, R1 i R5 obaliły tezy reachability/runtime**.

## Baza i wejście

```text
MARKER OK
9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c
git status --short: (pusto)
```

Worktree: `/private/tmp/cx-day369-chmura-oauth`, gałąź `codex/day369-chmura-oauth-20260905`. Dysk: 69 GiB przed materializacją, 51 GiB przy pomiarze wejściowym. Porty 6440/5580 były wolne, kontenery day369: 0. Tip `github-backup/grafika/m03-20260902` uciekł do przodu; praca zgodnie z instrukcją pozostała na markerze.

## R0

Przeczytałem i zachowałem cztery zasady: token musi istnieć w realnym silniku; body nie jest źródłem tokenu; trzy systemy nie są jednym magazynem; izolacja obecnego silnika jest per-user, nie per-org.

## R1 — trzy systemy i korekta audytu

| System | Tabela | Wynik |
| --- | --- | --- |
| Cloud sources | `cloud_sources` | na markerze atrapa; po R2 bramka tokenu |
| Governed connectors | `integrations` | statyczny fallback `authUrl: callbackUrl`; świeży HTTP kończy się wcześniej `500 {}` |
| Silnik OAuth | `integration_oauth_tokens` | realne konfiguracje Google/OneDrive/Dropbox; źródło prawdy R2/R3 |

`CloudDataSettings.tsx` ma zero importerów i jest już w baseline. Instrukcja myliła jednak drugi ekran: `/settings/integrations` przekierowuje zwykłego użytkownika do `/settings/connected-apps`, gdzie `SettingsView.tsx:460` renderuje `ConnectedAppsSettings.tsx`, nie `IntegrationSettings.tsx`. To STOP MERYTORYCZNY R1; routing i reachable komponent pozostawiono bez zmian. Szczegóły: `evidence/chmura-oauth-20260905/day369/R1-rodzina.md`.

Env OAuth w dyżurze: brak `GOOGLE_CLIENT*`, `MICROSOFT_CLIENT*`, `DROPBOX_CLIENT*`. Staging/produkcja: NIEZMIERZONE.

## R2 — bramka źródła

Commit `0339de9299`. `POST /api/cloud/sources`:

- `google_drive`/`onedrive`/`dropbox` bez aktywnego tokenu verified usera: `409 CLOUD_PROVIDER_NOT_CONNECTED`;
- `sharepoint`/nieznany: `400 CLOUD_PROVIDER_UNSUPPORTED`;
- tokeny z body są ignorowane i kolumny `cloud_sources.access_token/refresh_token` pozostają `NULL`;
- user B nie korzysta z tokenu usera A z innej organizacji.

HTTP: `409` bez tokenu, `201` z zaszyfrowanym tokenem w `integration_oauth_tokens`, `409` cross-user, `400` SharePoint. Mutacja bramki (`false &&`) dała RED: `201` zamiast `409`; po przywróceniu GREEN: `409`. Pierwsza próba przywrócenia użyła złej ścieżki względnej i nie nałożyła kopii; poprawiono ścieżką absolutną przed GREEN i przed commitem.

Pełne nazwy R2:

```text
Day 369 — cloud sources require the real per-user OAuth token returns 409 and writes nothing when the verified user has no OAuth token
Day 369 — cloud sources require the real per-user OAuth token returns 201 with a stored token while ignoring request-body tokens
Day 369 — cloud sources require the real per-user OAuth token isolates tokens by verified user even across organizations
Day 369 — cloud sources require the real per-user OAuth token always rejects unsupported SharePoint with 400
```

## R3 — żywy token

Commit `806a1210b1`. Wszystkie dziewięć operacji Google Drive/OneDrive/Dropbox woła wspólny resolver oparty na `getValidAccessToken(source.userId, source.provider)`. Mock HTTP potwierdził URL Drive i nagłówek `Authorization: Bearer fake-google-token-day369`. Mutacja resolvera z powrotem do `source.accessToken` dała RED (`Google Drive access token not configured`); przywrócenie dało 5/5 GREEN.

## R4 — martwy, ale uczciwy komponent

Commit `f1f7532269`. `CloudDataSettings.tsx` czyta status OAuth. Dostawca nieskonfigurowany/niezatwierdzony ma disabled i „Integracja nieskonfigurowana”; brak tokenu uruchamia realny `/oauth/start/:provider` i nie robi POST źródła; istniejący token pozwala utworzyć nazwane źródło; SharePoint nie jest oferowany. Cztery testy behawioralne DOM: 4/4 GREEN. Po zmianie grep nadal zwraca wyłącznie sam plik — nie dodano montażu.

## R5 — trzeci mechanizm

Świeże żądanie przez realny ApiGateway/JWT/PG:

```text
POST /api/settings/integrations/google_drive/connect
DAY369_GOVERNED_CONNECT_HTTP 500 {}
```

Oczekiwanie instrukcji `200 + authUrl bez client_id` zostało obalone. Nie zmieniono asercji na 500. Brief i nienałożony diff: `evidence/chmura-oauth-20260905/day369/R5-governed-oauth-proposal.md`.

## PRZED / PO i korekty instrukcji

| Pomiar | PRZED | PO |
| --- | --- | --- |
| słowniki | pl 35200 / en 33067 | pl 35200 / en 33067 |
| focus/list/artefakt | 0/0/0 | 0/0/0 |
| reach | 1: jeden zastany plik test-only `initiativeKartaRealnyRekord.test.ts` | 1: zastany plik oraz `CloudDataSettings.tsx` przesunięty przez nowy test do test-only |

Instrukcja podawała pl 35204/en 33071 oraz trzy nowe pliki reach; marker dał pl 35200/en 33067 i jeden plik. Wyniki własnego pomiaru są wiążące.

Próba `reachability-from-root.mjs --update-baseline` została odrzucona komunikatem `Baseline update refused: the test-only set grew`. Nie obszedłem strażnika i nie edytowałem baseline ręcznie. R4 ma dowód zachowania, ale końcowy reach pozostaje **PARTIAL**: kod produkcyjny nadal jest martwy, a test zmienił jego klasyfikację z unreachable na test-only.

Artefakty końcowe:

```text
final-server.json: 5 passed / 0 failed; sha256 4b75c60fa888c6c7de64728bf4c398f3666bcd793ec432b9935c40c73e5618eb
final-front.json: 4 passed / 0 failed; sha256 6f0a0ac6f4afbfff8dc0ba707de2e85675ce1b00dd752c50e0ebf1cfb64c1fae
```

## §0.2e — pułapki dowodowe

Pakiet serwerowy: jawnie `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test`, `DATABASE_URL` na 127.0.0.1:6440/cx369, `ENABLE_V8_GLOBAL=true`, `ENABLE_TEST_AUTH_BYPASS=false`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, podpisany JWT, `--retry=0`; test asertuje `DB_TYPE=postgres`, a log podał `DB_IDENTITY ... 127.0.0.1:6440/cx369`. Trzy tabele integracji rozróżniono, token zasiano po lazy-create i zaszyfrowano.

Pakiet frontowy: `RUN_DB_TESTS=0 MOCK_DB=true`, bez DB/ApiGateway; dowodzi wyłącznie renderu i zachowania mockowanego klienta, nie produkcyjnego HTTP.

## Z30

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## TWIERDZENIA NIEZWERYFIKOWANE

- Env OAuth na stagingu/produkcji: NIEZMIERZONE, brak dostępu i zakaz Z28.
- Realny callback i wymiana kodu u Google/Microsoft/Dropbox: NIEZMIERZONE bez credentials i interakcji z dostawcą.
- Governed connect nie oddał `authUrl`; dokładna przyczyna ukrytego `500 {}` nie została naprawiona w pliku tylko-do-odczytu.
- Zachowanie na tipie gałęzi bazowej nowszym od markera: NIEZMIERZONE; integrację wykonuje nadzorca.

## PYTANIA DO WŁAŚCICIELA

1. Czy osobny dyżur ma naprawić governed connector flow dla trzech dostawców i najpierw rozpoznać `500 {}`? Szacunek: około 20–30 linii na dostawcę plus testy realdb/audit trail; promień większy niż ten dyżur.
2. Czy martwy `CloudDataSettings.tsx` ma zostać podłączony obok/zamiast `ConnectedAppsSettings.tsx`, czy usunięty jako duplikat? Uwaga: realnym ekranem na markerze jest `ConnectedAppsSettings`, nie `IntegrationSettings`.
3. Czy token per-user bez `organization_id` jest akceptowalny dla użytkownika należącego do wielu organizacji, czy potrzebny jest osobny dyżur migracji i modelu izolacji?

## Commity

```text
901befab90 docs(day369): measure cloud OAuth integration family
0339de9299 fix(cloud): require stored OAuth token for sources
806a1210b1 fix(cloud): resolve provider tokens from OAuth engine
f1f7532269 fix(settings): make cloud source OAuth connection honest
```

Macierzy odbioru nie zmieniono. Railway/demo/staging/produkcji nie dotknięto.
