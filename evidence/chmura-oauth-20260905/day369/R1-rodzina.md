# R1 — rodzina integracji i reachability

Data pomiaru: 2026-09-05. Baza: marker `9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c`.

## Cztery zasady R0

1. Bramka `POST /api/cloud/sources` musi odmówić bez tokenu silnika OAuth; `sharepoint` zawsze jest nieobsługiwany.
2. Tokeny z body żądania nie są źródłem prawdy i muszą być ignorowane.
3. `cloud_sources`, `integrations` i `integration_oauth_tokens` to trzy różne systemy; ten dyżur łączy pierwszy z trzecim.
4. Izolację mierzę per użytkownik; brak `organization_id` w `integration_oauth_tokens` pozostaje pytaniem produktowym.

## Pomiar rodziny

| Wejście | Magazyn / mechanizm | Wynik |
| --- | --- | --- |
| `POST /api/cloud/sources` | `cloud_sources`; `cloud.routes.ts:82-116` | Atrapa na markerze: wymagane tylko `provider` i `name`, token z body opcjonalny i przepisywany bez walidacji. |
| `POST /api/settings/integrations/:provider/connect` | `integrations`; `settings.routes.ts:1882-2026` + governed external auth | Dla chmury fallback `authUrl: callbackUrl`, bez parametrów OAuth dostawcy. |
| `GET /api/settings/integrations/oauth/start/:connectorId` | `integration_oauth_tokens`; `integrationOAuthEngine.ts` | Realny silnik OAuth dla `google_drive`, `onedrive`, `dropbox`; env dostawców w środowisku dyżuru: brak. |

`CloudDataSettings.tsx`: `grep -rln 'CloudDataSettings' src/` zwrócił wyłącznie `src/components/settings/CloudDataSettings.tsx`; wpis istnieje w `reachability.baseline.json:435`.

## Korekta wobec instrukcji — STOP MERYTORYCZNY R1

Instrukcja twierdzi, że realnie zamontowanym ekranem jest `IntegrationSettings.tsx`. Pomiar na markerze obala tę tezę:

- `src/routes/routeConfig.ts:240` mapuje alias `/settings/integrations`;
- `src/views/settings/syncEntryResolver.ts:18` przekierowuje zwykłego użytkownika do `/settings/connected-apps`, a admina do admin integrations;
- `src/views/SettingsView.tsx:42,460` importuje i renderuje `ConnectedAppsSettings`;
- `IntegrationSettings.tsx` nie ma importera w tej ścieżce.

Rodzaj: MERYTORYCZNY. Licencja: pliki frontu reachable są tylko do odczytu. Zamiast zmiany dostarczono pomiar i brief. Pozostałe pozycje są kontynuowane bez modyfikowania `ConnectedAppsSettings.tsx` ani routingu.

## Trzeci mechanizm

`buildGovernedExternalAuthSession` ma jawne gałęzie wyłącznie dla `jira`, `gmail`, `asana`, `teams`, `slack`. `google_drive`, `onedrive`, `dropbox` spadają do fallbacku `authUrl: callbackUrl`. Przykładowy wynik ma kształt lokalnego callbacku `/api/settings/integrations/oauth/materialize/callback?state=...`; nie zawiera `client_id`, dostawcy `redirect_uri` ani `response_type`.

## Korekty liczników wejściowych

- słowniki: `pl 35200`, `en 33067`, nie `35204/33071`;
- `reach=1`, ale lista ma jeden zastany plik test-only: `src/components/Initiatives/__tests__/initiativeKartaRealnyRekord.test.ts`, nie trzy;
- env `GOOGLE_CLIENT*`, `MICROSOFT_CLIENT*`, `DROPBOX_CLIENT*`: brak;
- staging/produkcja: NIEZMIERZONE, brak dostępu zgodnie z Z28.
