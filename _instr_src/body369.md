## Po co ten dyżur istnieje

„Zarządzaj źródłami w chmurze" w menu „+" pola wpisywania Czatu (Google Drive / OneDrive /
Dropbox) to dziś **atrapa**: kliknięcie „Connect" tworzy w bazie wiersz `cloud_sources` ze
statusem `active`, bez jakiegokolwiek okna logowania u dostawcy. Jednocześnie w repo **już
istnieje** realny, działający silnik OAuth dla tych samych trzech dostawców — używany dziś
przez Ustawienia→Integracje dla innych konektorów (`gmail`, `slack`, ...). To jest kształt
„zbudowane, ale niepodłączone": nie trzeba pisać OAuth od zera, trzeba spiąć dwa istniejące
mechanizmy.

**Ale audyt, z którego wywodzi się ten dyżur, pomylił jedną rzecz** — i to jest część zlecenia,
nie tylko kontekst. `D_pole_wpisywania.md` (D-1) i `V1_weryfikacja_P1.md` opisują
`CloudDataSettings.tsx` jako ekran otwierany z „Manage cloud sources" w Ustawieniach→Integracje.
**Zmierzone na markerze: `CloudDataSettings.tsx` ma ZERO importerów w `src/`** — jest martwym
kodem, potwierdzonym niezależnie przez własne narzędzie repo
(`scripts/dev/reachability-from-root.mjs` klasyfikuje go `unreachable`, wpis jest już
w zaakceptowanym `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json:435`).

Realny ekran, na który faktycznie nawiguje `AddFilesMenu.tsx`
(`openIntegrationsSettings`, `navigate('/settings/integrations')`), to
`IntegrationSettings.tsx`. Jego przycisk „Connect" dla `google_drive`/`onedrive`/`dropbox`
idzie przez **trzeci, zupełnie osobny mechanizm** —
`server/src/services/v8/pmSyncExternalAuthMaterializationService.ts`,
`buildGovernedExternalAuthSession` — który ma gotowe gałęzie tylko dla pięciu konektorów
(`jira`, `gmail`, `asana`, `teams`, `slack`; funkcja `shouldMaterializeCallbackDrivenAuth`).
Dla `google_drive`/`onedrive`/`dropbox` kod spada do domyślnej gałęzi, która zwraca
`authUrl: callbackUrl` — adres BEZ `client_id`, BEZ `redirect_uri` do dostawcy, BEZ
`response_type`. To jest TAKŻE atrapa, ale inna niż ta opisana przez audyt, w innym pliku,
w innej tabeli (`integrations`, nie `cloud_sources`).

Trzy systemy integracji, żaden nie podłączony do właściwego sąsiada:

| System | Tabela | Plik główny | Stan |
| --- | --- | --- | --- |
| Źródła plików w czacie | `cloud_sources` | `cloud.routes.ts` + `cloudDataService.ts` | atrapa (D-1) — **ten dyżur** |
| Governed connectors (Ustawienia, ekran REACHABLE) | `integrations` | `pmSyncExternalAuthMaterializationService.ts` | atrapa dla 3 dostawców chmury — **tylko pomiar w tym dyżurze** |
| Silnik OAuth (Ustawienia, `gmail`/`slack`/...) | `integration_oauth_tokens` | `integrationOAuthEngine.ts` | **realny, działający** — źródło prawdy, którego reszta ma użyć |

**Zakres tego dyżuru**: uszczelnić pierwszy wiersz tabeli o istniejący trzeci wiersz (to jest
tani, bo silnik już istnieje i jest przetestowany gdzie indziej). Drugi wiersz — **tylko
zmierzyć i zapytać właściciela** — to większa zmiana, dotyka governed-connector/audit trail
i wykracza poza jeden dyżur.

## ★ Stan zastany, zmierzony przeze mnie na markerze `9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c`

| Co | Wartość zmierzona | Gdzie |
| --- | --- | --- |
| walidacja `POST /sources` | tylko `provider`+`name` | `cloud.routes.ts:91-93` |
| token z body — wymagany? | NIE, opcjonalny, przekazany dalej bez sprawdzenia | `cloud.routes.ts:90,98-107` |
| strażniki „access token not configured" | **9**, identyczny kształt | `cloudDataService.ts:162,219,403,460,495,539,565,610,648` |
| źródło `source.accessToken` w strażnikach | WYŁĄCZNIE kolumna `cloud_sources.access_token` | `mapCloudSource:957` |
| odwołania do `integration_oauth_tokens`/`getStoredToken` w `cloudDataService.ts`/`cloud.routes.ts` | **0** | potwierdzone `grep` |
| konektory silnika OAuth dla chmury | `google_drive`, `onedrive`, `dropbox` — realny `authorizeUrl`/`tokenUrl` | `integrationOAuthEngine.ts:265-307` |
| env dostawców | `GOOGLE_CLIENT_ID/SECRET`, `MICROSOFT_CLIENT_ID/SECRET` (NIE `MS_*`/`AZURE_*`), `DROPBOX_CLIENT_ID/SECRET` | `integrationOAuthEngine.ts:275-276,286-287,304-305` |
| trasy realnego OAuth | `GET oauth/start/:connectorId`, `GET oauth/callback` | `settings.routes.ts:2116-2175,2181-2261`, montaż `/api/settings` (`Gateway.ts:766`) |
| `CloudDataSettings.tsx` — importerów w `src/` | **0** | `grep -rln 'CloudDataSettings' src/` → sam plik |
| `CloudDataSettings.tsx` — klasyfikacja reachability | `unreachable`, JUŻ w zaakceptowanym baseline | `reachability.baseline.json:435` |
| ekran, na który faktycznie nawiguje `AddFilesMenu` | `IntegrationSettings.tsx` (przez `/settings/integrations`) | `AddFilesMenu.tsx:255-263`, `routeConfig.ts:240` |
| trzeci mechanizm — gałęzie obsłużone | tylko `jira,gmail,asana,teams,slack` (5) | `pmSyncExternalAuthMaterializationService.ts:241-336,346-348` |
| trzeci mechanizm — fallback dla chmury | `authUrl: callbackUrl` (bez `client_id`/`redirect_uri`) | `pmSyncExternalAuthMaterializationService.ts:338-343` |
| `GET /api/cloud/providers` — `connected` liczone z czego | z SAMEGO istnienia wiersza `cloud_sources`, nie z tokenu | `cloud.routes.ts:398-414` |
| `integration_oauth_tokens` — migracja plikowa | **BRAK** — tworzona leniwie `CREATE TABLE IF NOT EXISTS` | `integrationOAuthEngine.ts:346-384` |
| `cloud_sources.provider` CHECK | `IN ('google_drive','onedrive','dropbox','sharepoint')` | `553_cloud_data_sources.sql` |
| `sharepoint` w silniku OAuth | brak konektora (tylko `box`, nie `sharepoint`) | `CONNECTOR_OAUTH_CONFIGS` |
| liście słowników | `pl 35204`, `en 33071` | `public/locales/**/translation.json` |
| cztery bezpieczniki kanonu | `focus=0`, `list=0`, `artefakt=0`, **`reach=1`** | patrz niżej |
| REJESTR_ZNALEZISK — ostatnia litera | `AF` (dyżur 365) → następna wolna `AG` | `grep -nE '^## [A-Z]+\.'` |

**★★ `reach=1` na SAMYM MARKERZE, przed jakąkolwiek zmianą tego dyżuru.** Przyczyna: TRZY
nowe pliki test-only spoza tego zakresu (`initiativeKartaRealnyRekord.test.ts`,
`macierz-sedno-20260905.test.tsx`, `AdminSettingsModule.healthSectionI18n.test.ts`) —
zostawione przez inne, równoległe dyżury bez aktualizacji baseline.
**`CloudDataSettings.tsx` NIE jest przyczyną** tego `reach=1` — jest już w zaakceptowanym
baseline. Nie naprawiasz cudzych trzech plików (`Z17`); mierzysz PRZED i PO i pilnujesz, żeby
Twoje własne nowe pliki testowe nie dołożyły CZWARTEJ pozycji do żadnej z list.

## ★ Zmierz moje liczby sam

Twierdzę, na markerze: **9** strażników „access token not configured" w `cloudDataService.ts`;
**0** odwołań do `integration_oauth_tokens` z `cloud.routes.ts`/`cloudDataService.ts`; **0**
importerów `CloudDataSettings.tsx` w `src/` (dead code, już w zaakceptowanym baseline); realny
ekran otwierany z czatu to `IntegrationSettings.tsx`, nie `CloudDataSettings.tsx`; trzeci
mechanizm (`pmSyncExternalAuthMaterializationService.ts`) obsługuje tylko 5 konektorów, nie
zawiera `google_drive`/`onedrive`/`dropbox`; `reach=1` na samym markerze z przyczyny niezwiązanej
z tym dyżurem; liście słowników `pl 35204`, `en 33071`.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.**

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: WALIDATOR · TRASA · SERWIS · SILNIK OAUTH · FRONT · TESTY

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany
brief z `plik:linia` oraz diff **nienałożony**. Pozycja z takim produktem jest
**ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Brama tworzenia źródła** | `server/src/routes/cloud.routes.ts`, trasa `POST /sources` | **★ PEŁNA LICENCJA** na dodanie bramki tokenu (`R2`). Reszta pliku (`GET /sources`, `DELETE`, `/files`, `/upload`, `/import`, `/sync`, `GET /providers`) — **TYLKO ODCZYT**, chyba że `R2`/`R3` udowodnią konieczność drobnej zmiany (np. `GET /providers` — patrz `R2` pkt 6) | Brief + diff nienałożony |
| **Serwis dostawców** | `server/src/services/cloudDataService.ts` | **★ PEŁNA LICENCJA** w zakresie `R3`: podmiana źródła `accessToken` na `getValidAccessToken` z silnika OAuth. **Zakaz** zmiany kształtu `CloudSource`/`CloudFile`, zakaz kasowania strażników (mają zostać, tylko dostają prawdziwy token) | — |
| **Silnik OAuth (odczyt)** | `server/src/services/integrationOAuthEngine.ts` | **TYLKO ODCZYT — WOŁASZ funkcje `getStoredToken`/`getValidAccessToken`/`isConnectorConfigured`/`getConnectorAvailability`, NIE ZMIENIASZ pliku.** Jeżeli brakuje eksportu, którego potrzebujesz — brief + diff nienałożony, nie dopisujesz eksportu bez zatrzymania się na `R1` | Brief z `plik:linia` + diff nienałożony |
| **Trasy realnego OAuth** | `server/src/routes/settings.routes.ts` — `GET oauth/start/:connectorId`, `GET oauth/callback`, `GET oauth/status` | **TYLKO ODCZYT — WOŁASZ przez HTTP, nie zmieniasz.** ★ WĄSKA LICENCJA: jeżeli front (`R4`) faktycznie potrzebuje endpointu, którego dziś brak (nie `oauth/status` — ten istnieje, `:2317-2330`) — brief zamiast zmiany | Brief + diff nienałożony |
| **Governed connector flow (trzeci mechanizm)** | `server/src/services/v8/pmSyncExternalAuthMaterializationService.ts`, `server/src/services/integrationHubService.ts`, `server/src/routes/settings.routes.ts` (`POST /integrations/:provider/connect`) | **TYLKO ODCZYT — `R5`, pomiar.** Dotyka governed-connector/audit trail, `Z12`-podobne ryzyko | Brief `plik:linia` + diff nienałożony + pytanie do właściciela |
| **Tabela `cloud_sources` / migracja** | `server/migrations/553_cloud_data_sources.sql`, tabela `integration_oauth_tokens` (bez pliku migracji) | **TYLKO ODCZYT.** Migracja NOWA wolno WYŁĄCZNIE jeśli `R2`/`R3` udowodnią brakującą kolumnę — dziś brak dowodu takiej potrzeby (obie tabele mają wszystko, czego trzeba) | Brief, jeśli jednak zabraknie kolumny |
| **Front — ekran martwy, ale w zakresie** | `src/components/settings/CloudDataSettings.tsx` | **★ PEŁNA LICENCJA** na naprawę „Connect"/formularza dodawania źródła (`R4`). **Zakaz** dodawania importu/trasy, która by go zamontowała (to decyzja produktowa, `R5`) | — |
| **Front — tylko odczyt** | `src/components/AIChat/AddFilesMenu.tsx`, `src/components/AIChat/CloudFilePicker.tsx`, `src/hooks/useCloudIntegrations.ts`, `src/components/settings/IntegrationSettings.tsx` | **TYLKO ODCZYT** — dowód trasy nawigacji i stanu trzeciego mechanizmu | Opis w raporcie |
| **Klient API** | `src/services/api.ts` | **★ WĄSKA LICENCJA:** wolno dodać JEDNĄ metodę czytającą `GET /api/settings/integrations/oauth/status`, jeżeli jej dziś brak — zakaz zmiany istniejących metod cloud/integrations | Brief, jeśli metoda już istnieje pod inną nazwą |
| **Nowe testy** | `tests/**` (nowe pliki), `server/src/routes/__tests__/**` (nowe pliki, `git add -f`) | **★ PEŁNA LICENCJA**, z zastrzeżeniem `Z18`/`Z31` | — |
| **Bezpieczniki i konfiguracja testów** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie |
| **Middleware / bramki platformowe** | `server/src/middleware/auth.middleware.ts`, `server/src/services/ApiGateway.ts`, `server/src/Gateway.ts` | **NIETYKALNE DO ZAPISU** (`Z12`) | Brief |
| **Słowniki** | `public/locales/pl/translation.json`, `public/locales/en/translation.json` | **★ WYŁĄCZNIE DOPISYWANIE KLUCZY** (np. `cloud.notConfigured`), parytet PL+EN w tym samym commicie, wartość PL naprawdę polska. Liście nie mogą zmaleć | — |
| **Reachability baseline** | `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` | **★ WĄSKA LICENCJA:** wolno dopisać WYŁĄCZNIE Twoje własne nowe pliki testowe, jeśli `--check-baseline` tego zażąda; zakaz dopisywania cudzych trzech plików z `§ Stan zastany` (to nie Twój dyżur) | Opis w raporcie, zostaw cudze 3 pliki czerwone jak zastane |
| **Nowe dowody** | `evidence/chmura-oauth-20260905/day369/**` (NIE ISTNIEJE — tworzysz) | **★ PEŁNA LICENCJA**; commitujesz przez `git add -f` | — |
| **Macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` | ★★★ **NIETYKALNE DO ZAPISU — ŻADEN wiersz, ŻADEN moduł**, w tym `13_CHAT` i `15_SETTINGS` | Rekomendacja w raporcie |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jedna nowa sekcja o pierwszej wolnej literze (`AG`, sprawdzonej komendą tuż przed commitem) | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY369_CHMURA_OAUTH_REPORT.md` (**NOWY**) | `R5` — **JEDYNY nowy dokument rejestrowy** (`Z13`) | — |
| **Cudze tereny** | pozostałe 5 dyżurów paczki 367-373 (inne pliki `AUDYT_CZAT_PRZYCISKI_20260905/*.md`), trzy pliki test-only z „Stan zastany" | **TYLKO ODCZYT** | Wpis do raportu, plik:linia, idziesz dalej |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem plik:linia i idziesz dalej |

## ★★ WARUNKI WSPÓLNE SERII

Mierzysz **PRZED pierwszym commitem i PO ostatnim**, obie pary liczb do raportu:

```bash
cd "$WT"
# (a) liscie slownikow NIE MOGA ZMALEC
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
#   moje liczby: pl 35204, en 33071

# (b) trzy bezpieczniki maja konczyc sie kodem 0; reach jest JUZ 1 na markerze
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus-canon=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list-canon=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
#   moje liczby PRZED: focus=0, list=0, artefakt=0, reach=1 (3 cudze pliki test-only, zastane)
#   PO Twoich zmianach: focus/list/artefakt MUSZA zostac 0; reach MOZE zostac 1 z TYMI SAMYMI
#   3 cudzymi plikami — ale NIE WOLNO Ci dolozyc czwartej pozycji (swojego nowego testu) do
#   listy unreachable/test-only bez --update-baseline w tym samym commicie.
```

**Jeżeli którakolwiek liczba zmaleje albo bramka `focus`/`list`/`artefakt` zaczerwieni się od
Twojej zmiany — naprawiasz KODEM, nigdy progiem i nigdy `--no-verify`** (`Z35`). Dla `reach`:
dopuszczalne jest, że zostaje `1` z tymi samymi trzema cudzymi plikami; niedopuszczalne jest,
żeby lista się powiększyła o coś Twojego bez `--update-baseline`.

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | strażników „access token not configured" | `9` | komenda (2) z `§0.3` | TAK — czyta `cloudDataService.ts` |
| 2 | odwołań do `integration_oauth_tokens` z warstwy cloud | `0` | komenda (2) | TAK — to jest dowód „zbudowane, niepodłączone" |
| 3 | importerów `CloudDataSettings.tsx` w `src/` | `0` | komenda (4) | TAK — **rozstrzyga, który plik jest reachable** |
| 4 | konektorów chmury w silniku OAuth | `3` (`google_drive`,`onedrive`,`dropbox`) | komenda (3) | TAK |
| 5 | konektorów obsłużonych przez trzeci mechanizm | `5` (`jira,gmail,asana,teams,slack`) — **BEZ chmury** | komenda (5) | TAK — dowód drugiej atrapy |
| 6 | czy `sharepoint` ma konektor OAuth | `NIE` (brak w `CONNECTOR_OAUTH_CONFIGS`) | komenda (7) | TAK |
| 7 | `numTotalTests`/lista nazw pakietu bramki tokenu, przed/po mutacją | — | `R2` własny pomiar | TAK — `Z37`, porównanie po nazwach |
| 8 | liście słowników PL/EN | `35204`/`33071` | blok (a) „WARUNKÓW WSPÓLNYCH" | TAK |
| 9 | `reach` PRZED i PO, z listą plików | `1` / lista 3 nazw | blok (b) „WARUNKÓW WSPÓLNYCH" | TAK — dowód, że nie dołożyłeś czwartej pozycji |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY369_CHMURA_OAUTH_REPORT.md` ·
`evidence/chmura-oauth-20260905/day369/**` (nowe) ·
`server/src/routes/cloud.routes.ts` (bramka tokenu w `POST /sources`) ·
`server/src/services/cloudDataService.ts` (`accessToken` żywy z silnika) ·
`src/components/settings/CloudDataSettings.tsx` (Connect → realny OAuth albo uczciwie
wyłączony) · nowe pliki testowe w `tests/**` i `server/src/routes/__tests__/**` (`git add -f`).

**Zapisujesz WARUNKOWO:**
`src/services/api.ts` (WYŁĄCZNIE nowa metoda `oauth/status`, jeśli brak) ·
`public/locales/pl/translation.json` + `public/locales/en/translation.json` (WYŁĄCZNIE nowe
klucze, np. `cloud.notConfigured`) ·
`docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` (WYŁĄCZNIE Twoje nowe
pliki testowe, jeśli `--check-baseline` tego zażąda) ·
`docs/program/REJESTR_ZNALEZISK_20260903.md` (jedna nowa sekcja, litera `AG` zweryfikowana
tuż przed commitem).

**JAWNIE NIE ZAPISZESZ:** `server/src/services/integrationOAuthEngine.ts`,
`server/src/services/v8/pmSyncExternalAuthMaterializationService.ts`,
`server/src/services/integrationHubService.ts`, `server/src/routes/settings.routes.ts` (poza
ewentualną nową metodą API po stronie klienta — sam plik trasy zostaje NIETKNIĘTY),
`server/src/middleware/**`, `server/src/services/ApiGateway.ts`, `server/src/Gateway.ts`,
`server/migrations/**` (chyba że `R2`/`R3` udowodnią brakującą kolumnę — dziś brak dowodu),
`tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`,
`server/vitest.config*.ts`, `.github/workflows/**`,
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` (wszystkie 16),
`src/components/AIChat/AddFilesMenu.tsx`, `src/components/AIChat/CloudFilePicker.tsx`,
`src/hooks/useCloudIntegrations.ts`, `src/components/settings/IntegrationSettings.tsx`,
trzy cudze pliki test-only wymienione w „Stan zastany".

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day369-chmura-oauth
git diff --name-only --cached | tee /private/tmp/cx-day369-chmura-oauth-artefakty/staged.txt
bash -c "grep -iE '^server/src/services/integrationOAuthEngine|^server/src/services/v8/pmSyncExternalAuthMaterializationService|^server/src/services/integrationHubService|^server/src/middleware/|ApiGateway|^server/src/Gateway|^server/migrations/|^tests/setup|^tests/helpers|^tests/__mocks__|vitest.*config|^\.github/|MODULE_ACCEPTANCE|AddFilesMenu\.tsx|CloudFilePicker\.tsx|useCloudIntegrations\.ts|IntegrationSettings\.tsx' /private/tmp/cx-day369-chmura-oauth-artefakty/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## R0 — CZTERY TWARDE ZASADY TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

**(1) Bramka tokenu, nigdy atrapa.** `POST /api/cloud/sources` dla `google_drive`/`onedrive`/
`dropbox` MUSI odmówić utworzenia źródła, dopóki nie istnieje aktywny wiersz w
`integration_oauth_tokens` dla `(req.userId, provider)`. Dla `sharepoint` (brak konektora)
odmawia ZAWSZE. Żaden wiersz `cloud_sources` ze statusem `active` nie może powstać bez
prawdziwego tokenu za sobą.

**(2) Nie ufasz tokenowi z body żądania.** `accessToken`/`refreshToken` z `req.body` dla tych
trzech dostawców są IGNOROWANE przy tworzeniu źródła — jedynym źródłem prawdy jest silnik OAuth.
Test, który sprawdza tylko obecność pola, a nie jego faktyczne pochodzenie, nie jest dowodem.

**(3) Nie mylisz trzech systemów integracji.** `cloud_sources` ≠ `integrations` ≠
`integration_oauth_tokens`. Ten dyżur podłącza pierwszy do trzeciego. Drugi (governed connector
flow, realnie reachable z czatu przez `IntegrationSettings.tsx`) — TYLKO mierzysz i pytasz.

**(4) Izolacja jest per użytkownik, nie per organizacja — bo silnik tak jest zbudowany.**
`integration_oauth_tokens` nie ma kolumny `organization_id`. Dowód izolacji w tym dyżurze:
user B (inna organizacja, BEZ własnego tokenu) nie tworzy źródła, mimo że user A (inna
organizacja) ma token. Nie projektujesz izolacji na poziomie organizacji, którego silnik dziś
nie ma — to jest pytanie do właściciela, nie zadanie do wykonania samodzielnie.

**Wymagany dowód:** cztery zdania w raporcie, że przeczytałeś te zasady, plus `git show --stat`
każdego commita. **Bez commita — to jest warunek, nie pozycja.**

## R1 — KROK 0: RODZINA TRZECH SYSTEMÓW, MARTWY EKRAN, REACHABLE EKRAN (rdzeń)

1. **Wypisz WSZYSTKIE miejsca**, które dziś tworzą lub oznaczają jako „połączone" źródło
   chmurowe dla `google_drive`/`onedrive`/`dropbox`: `POST /api/cloud/sources`
   (`cloud.routes.ts`) i `POST /api/settings/integrations/:provider/connect`
   (`settings.routes.ts:1882-2026`, dla `providerMeta` z `category: 'cloud_storage'`
   w `defaultIntegrationProviders:1560-1575`). Dla każdego: czy tworzy realny token, czy
   atrapę, i w jakiej tabeli.
2. **Potwierdź martwość `CloudDataSettings.tsx`**: `grep -rln 'CloudDataSettings' src/` (ma
   dać wyłącznie sam plik) i porównaj z
   `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` (ma już tam być, linia
   ok. 435). Jeżeli Twój pomiar da INNY wynik (np. znajdziesz importera, którego ja nie
   znalazłem) — to jest WYNIK, nie sprzeczność; **zmienia to całą resztę dyżuru** (R4 stałby
   się rdzeniem frontu naprawdę używanym przez klienta) — zatrzymaj się na tej pozycji i opisz
   to jako STOP MERYTORYCZNY z pełnym uzasadnieniem.
3. **Potwierdź, który ekran faktycznie otwiera `AddFilesMenu.tsx`**: przeczytaj
   `openIntegrationsSettings` (`:255-263`) i `routeConfig.ts:240`, znajdź komponent zamontowany
   pod `ROUTES.SETTINGS.INTEGRATIONS` (`grep -rn 'ROUTES.SETTINGS.INTEGRATIONS\|SETTINGS_INTEGRATIONS'
   src/layouts/ src/views/`). Zapisz nazwę komponentu i ścieżkę pliku.
4. **Zmierz env dostawców** — czy `GOOGLE_CLIENT_ID`, `MICROSOFT_CLIENT_ID`, `DROPBOX_CLIENT_ID`
   (i sekrety) są ustawione w Twoim środowisku dyżuru: `env | grep -iE
   '^(GOOGLE_CLIENT|MICROSOFT_CLIENT|DROPBOX_CLIENT)'`. **Prawie na pewno BRAK** — to jest
   oczekiwane i NIE jest powodem do STOP-u; oznacza, że `isConnectorConfigured('google_drive')`
   zwróci `false` w Twoim środowisku testowym, i Twoje testy `R2`/`R4` muszą to obsłużyć
   (np. przez zasianie tokenu bezpośrednio w bazie, z pominięciem `generateAuthUrl`, które i
   tak wymaga tych zmiennych). **Czy staging/produkcja mają te zmienne — NIEZMIERZONE, brak
   dostępu; zapisz to wprost, nie zgaduj.**
5. **Zmierz trzeci mechanizm** (`pmSyncExternalAuthMaterializationService.ts`) — potwierdź, że
   `google_drive`/`onedrive`/`dropbox` NIE są w żadnej z gałęzi `241-336` i spadają do
   `338-343`. Skonstruuj (bez wysyłania) przykładowy `authUrl`, jaki by powstał, i pokaż, że
   brakuje mu `client_id`/`redirect_uri`/`response_type`.

**Wymagany dowód:** tabela dwóch/trzech miejsc tworzenia „połączenia" z werdyktem atrapa/realne
· wynik `grep` dla `CloudDataSettings.tsx` · nazwa i ścieżka realnie zamontowanego komponentu ·
wynik `env | grep` dla trzech dostawców · analiza gałęzi trzeciego mechanizmu. **Commit po
`R1`** (sam raport cząstkowy w `evidence/chmura-oauth-20260905/day369/R1-rodzina.md`, zero
kodu produktu).

## R2 — `POST /api/cloud/sources`: BRAMKA TOKENU (rdzeń)

1. **KROK 0 rodziny w kodzie**: w `cloud.routes.ts`, `POST /sources` — dodaj funkcję (w tym
   pliku albo w `cloudDataService.ts`, Twój wybór, uzasadnij) `hasActiveCloudToken(userId,
   provider)`, która dla `provider` w `{google_drive,onedrive,dropbox}` woła
   `integrationOAuthEngine.getStoredToken(userId, provider)` i zwraca `true` tylko jeśli wynik
   nie jest `null`; dla `sharepoint` (i wszystkiego innego) zwraca zawsze `false`.
2. **Brama**: jeżeli `!hasActiveCloudToken(...)` — `provider` w trzech wpiętych: `409` z
   `{ error: '...', code: 'CLOUD_PROVIDER_NOT_CONNECTED' }`; `provider === 'sharepoint'` albo
   nieznany: `400` z `{ error: '...', code: 'CLOUD_PROVIDER_UNSUPPORTED' }`.
3. **Ignoruj token z body.** `accessToken`/`refreshToken` z `req.body` NIE trafiają do
   `createCloudSource` dla tych trzech dostawców — usuń je z payloadu przed wywołaniem
   (`createCloudSource` może dostać `undefined` dla obu pól; `access_token`/`refresh_token`
   w wierszu `cloud_sources` zostają puste — token do wywołań dostawcy przyjdzie żywo z
   silnika, patrz `R3`).
4. **Dowód mutacyjny**: usuń tymczasowo warunek bramki (`cp` do `SCRATCH`) — nowy test ma
   **zaczerwienić się** (źródło powstaje mimo braku tokenu); przywróć — ma **zzielenieć**;
   `git diff` po przywróceniu **pusty**.
5. **Para dowodów, w jednym pakiecie, przez realny `ApiGateway`+`supertest`, na realnym
   PostgreSQL**: (a) użytkownik BEZ wiersza w `integration_oauth_tokens` dostaje `409` na
   `POST /api/cloud/sources {provider:'google_drive', name:'X'}`; (b) użytkownik z zasianym
   (zaszyfrowanym, przez `ensureTokenTable()`+surowy `INSERT`, patrz pułapki 3-5) aktywnym
   tokenem dla `google_drive` dostaje `201`, a zapisany wiersz `cloud_sources.access_token`
   pozostaje `NULL`/pusty (bo token z body był ignorowany — dowód punktu 3).
6. **Izolacja cross-user/cross-org**: user B, inna organizacja, BEZ własnego tokenu, nie
   tworzy źródła (`409`), mimo że user A (inna organizacja) MA aktywny token dla tego samego
   `provider`. Zapisz to jako dowód nazwany „izolacja" w raporcie.
7. **`sharepoint` zawsze `400`**, niezależnie od tego, czy istnieje jakikolwiek token gdziekolwiek.

**Wymagany dowód:** diff bramki · dosłowna komenda i wynik mutacji w obie strony · `git diff`
pusty po przywróceniu · para „409 bez tokenu / 201 z tokenem" z pełnymi odpowiedziami HTTP ·
dowód izolacji cross-user · dowód `400` dla `sharepoint` · lista pełnych nazw testów przed/po
(`Z37`). Nowy plik: `server/src/routes/__tests__/day369.cloud-sources-oauth-gate.pg.test.ts`.
**Commit po `R2`.**

## R3 — `cloudDataService.ts`: TOKEN ŻYWY Z SILNIKA (rdzeń)

1. Dla `listGoogleDriveFiles`/`downloadGoogleDriveFile`/`uploadGoogleDriveFile` i analogicznych
   funkcji OneDrive/Dropbox (dziewięć miejsc z `§ Stan zastany`) — **przed** użyciem
   `source.accessToken`, spróbuj `const liveToken = await
   integrationOAuthEngine.getValidAccessToken(source.userId, source.provider)`; jeżeli
   `liveToken` istnieje, użyj go zamiast `source.accessToken`; jeżeli nie istnieje, strażnik
   rzuca ten sam błąd co dziś (`'<Provider> access token not configured'`) — zachowanie
   błędu przy braku tokenu **nie zmienia się**, zmienia się WYŁĄCZNIE źródło tokenu przy jego
   obecności.
2. `getValidAccessToken` sam odświeża token po wygaśnięciu (`integrationOAuthEngine.ts:747-767`)
   — nie duplikuj tej logiki w `cloudDataService.ts`.
3. **Dowód mockowanego HTTP dostawcy**: w nowym teście zasiej token dla `google_drive` w
   `integration_oauth_tokens` (wartość fikcyjna, np. `fake-google-token-day369`, zaszyfrowana
   tak samo jak `storeTokens`), zamockuj globalny `fetch` (`vi.stubGlobal` albo lokalny mock
   modułu, NIE `tests/__mocks__/**`), wywołaj `listCloudFiles(sourceId, organizationId)` i
   sprawdź: (a) URL zawiera `www.googleapis.com/drive/v3/files`; (b) nagłówek
   `Authorization` to dokładnie `Bearer fake-google-token-day369` — token z SILNIKA, nie
   z żadnej wartości ustawionej ręcznie w kolumnie `cloud_sources.access_token`.
4. **Dowód mutacyjny**: cofnij podmianę źródła tokenu (`cp` ze `SCRATCH`) — test z punktu 3 ma
   **zaczerwienić się** (bo bez zmiany kod użyłby `source.accessToken`, który w tym teście
   celowo zostaje pusty/inny niż token z silnika); przywróć — ma **zzielenieć**.
5. **Nie osłabiasz istniejących testów** tego pliku, jeśli jakieś istnieją — `grep -rl
   "cloudDataService" tests/ server/src/**/__tests__/` i zmierz mianownik przed/po.

**Wymagany dowód:** diff trzech funkcji (minimum: `listGoogleDriveFiles`,
`downloadGoogleDriveFile`, jedna z OneDrive/Dropbox jako dowód, że wzorzec jest powtarzalny —
**KROK 0 wymaga zastosowania do WSZYSTKICH dziewięciu**, nie próbki) · mock HTTP z URL-em i
nagłówkiem `Authorization` zapisanym dosłownie · dowód mutacyjny w obie strony. **Commit po
`R3`.**

## R4 — `CloudDataSettings.tsx`: POŁĄCZ PROWADZI DO REALNEGO OAUTH ALBO JEST UCZCIWIE WYŁĄCZONY (rdzeń)

**Ten komponent jest dziś martwy (R1). Naprawiasz go mimo to — jest w tabeli licencji, i jeśli
kiedyś zostanie podłączony, ma być uczciwy od pierwszego dnia. Nie dodajesz importu, który by
go zamontował (`Z40` tego dyżuru).**

1. Na starcie komponentu (obok istniejącego `fetchSources`) pobierz
   `GET /api/settings/integrations/oauth/status` (dodaj metodę w `src/services/api.ts`,
   jeśli jej brak — WĄSKA LICENCJA) i zapamiętaj `availability` (`{[connectorId]:
   {configured, approved, authType}}`) oraz `connected` (lista `connectorId` z aktywnym
   tokenem).
2. **Formularz dodawania źródła** (`showAddForm`): dla wybranego `newProvider`:
   - jeżeli `provider === 'sharepoint'` → pole `newProvider` w ogóle nie proponuje tej opcji
     ALBO opcja jest widoczna, ale wybranie jej pokazuje komunikat
     `t('cloud.unsupported', 'Ten dostawca nie jest obsługiwany')` i blokuje przycisk;
   - jeżeli `availability[provider]` nie ma `configured && approved` → przycisk „Connect"
     WYŁĄCZONY (`disabled`), obok tekst `t('cloud.notConfigured', 'Integracja
     nieskonfigurowana')` — **NIGDY fałszywe „połączono"**;
   - jeżeli skonfigurowany, ale `provider` NIE jest w `connected` (brak aktywnego tokenu) →
     przycisk „Connect" nawiguje (`window.location.href = result.authUrl`, po
     `GET /api/settings/integrations/oauth/start/:provider`) do realnego OAuth dostawcy —
     **NIE** woła `POST /api/cloud/sources`;
   - jeżeli skonfigurowany I `provider` JEST w `connected` (token już istnieje z Ustawień) →
     formularz zachowuje się jak dziś: `POST /api/cloud/sources` (teraz przejdzie, bo `R2`
     widzi token) tworzy nazwany wiersz `cloud_sources`.
3. **Usuń** bezwarunkowe wywołanie `POST /api/cloud/sources` z `handleAdd` dla ścieżki „brak
   tokenu" — zastąp rozgałęzieniem z punktu 2.
4. **Test behawioralny** (`tests/unit/components/settings/CloudDataSettings.honesty.test.tsx`,
   wzór `ConnectedAppsSettings.honesty.test.tsx`): mock `Api`, trzy scenariusze — (a)
   `availability.google_drive.configured=false` → przycisk `disabled`, widoczny tekst
   „nieskonfigurowana"; (b) `configured=true`, brak w `connected` → klik nawiguje (asercja na
   wywołanym `Api`/`window.location`, NIE na tekście źródła komponentu); (c) `configured=true`
   + w `connected` → klik woła `POST /api/cloud/sources` i po sukcesie źródło pojawia się na
   liście. **Zakaz `readFileSync`+`toContain`.**

**Wymagany dowód:** diff komponentu · trzy scenariusze testu z asercją na DOM/wywołaniach, nie
na tekście pliku · potwierdzenie, że `sharepoint` nigdy nie tworzy `active` źródła · potwierdzenie
braku nowego importu montującego komponent (`git diff --stat` pokazuje wyłącznie
`CloudDataSettings.tsx` i nowy test, zero zmian w routingu). **Commit po `R4`.**

## R5 — POMIAR TRZECIEGO MECHANIZMU, RAPORT, PYTANIA DO WŁAŚCICIELA

1. **Nie naprawiasz** `pmSyncExternalAuthMaterializationService.ts`. Produkt: brief `plik:linia`
   (`241-344`) + diff **nienałożony**, pokazujący jak wyglądałaby gałąź dla `google_drive` (na
   wzór gałęzi `gmail:261-279`, z `authorizeUrl`/`tokenUrl`/`scopes` wziętymi z
   `CONNECTOR_OAUTH_CONFIGS.google_drive` — **żeby pokazać, że naprawa jest wykonalna i tania**,
   nie żeby ją nałożyć).
2. **Kontrolny przelot**: potwierdź raz jeszcze (świeżym `curl`/testem przez `ApiGateway`), że
   `POST /api/settings/integrations/google_drive/connect` dziś zwraca `authUrl` bez
   `client_id` — to jest dowód nienaruszalności tezy z `R1`.
3. Raport zawiera: tabelę trzech systemów integracji (z „Po co") wypełnioną wynikami pomiaru ·
   dowód KROK 0 z `R1` (w tym: czy Twój pomiar potwierdził czy obalił „CloudDataSettings.tsx
   martwy" — obalenie jest sukcesem, nie porażką) · diff bramki tokenu z `R2` z parą dowodów
   `409`/`201` i izolacją · diff `cloudDataService.ts` z `R3` z mockiem HTTP · diff
   `CloudDataSettings.tsx` z `R4` z trzema scenariuszami testu · brief+diff nienałożony
   trzeciego mechanizmu z `R5` · tabelę „PRZED/PO" dla `reach` (lista plików test-only i
   unreachable, dowód że nie urosła o nic poza Twoimi własnymi nowymi testami) ·
   **niepustą sekcję „TWIERDZENIA NIEZWERYFIKOWANE"** (na pewno zawiera: env dostawców na
   stagingu/produkcji — NIEZMIERZONE, brak dostępu) · obowiązkowy akapit `§0.2e` dla każdego
   uruchomionego pakietu.

★★ **Osobna, obowiązkowa sekcja: „PYTANIA DO WŁAŚCICIELA".** Musi zawierać co najmniej:
(1) czy naprawiać trzeci mechanizm (`pmSyncExternalAuthMaterializationService.ts`) w osobnym
dyżurze, żeby `IntegrationSettings.tsx` (ekran realnie reachable z czatu) też prowadził do
realnego OAuth dla chmury — tak/nie, z oszacowaniem rozmiaru z `R5` pkt 1; (2) czy
`CloudDataSettings.tsx` ma zostać kiedyś podłączony pod `/settings/integrations` (zamiast albo
obok `IntegrationSettings.tsx`), skoro dziś jest martwy, czy raczej usunięty jako zdublowany —
decyzja produktowa, nie techniczna; (3) czy izolacja per-użytkownik (nie per-organizację) w
`integration_oauth_tokens` jest akceptowalna dla kont należących do wielu organizacji, czy
wymaga osobnego dyżuru rozszerzającego schemat. Sekcja **nie może być pusta**.

★ Zanim dopiszesz cokolwiek do jakiegokolwiek dokumentu, sprawdź, czy nie jest GENEROWANY:
`bash -c "grep -rl '<nazwa-pliku>' scripts/"`. Sekcję w `REJESTR_ZNALEZISK_20260903.md`
dopisujesz o **pierwszej wolnej literze** — na markerze to `AG` — sprawdź komendą
`bash -c "grep -nE '^## [A-Z]+\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"`
**tuż przed commitem**, bo równolegle piszą inni autorzy (paczka 367-373 tego samego dnia).

**Commit po `R5`.**

## Próg odbioru

**Cztery domknięcia: `POST /api/cloud/sources` odrzuca tworzenie źródła bez ważnego tokenu z
`integration_oauth_tokens` dla trzech wpiętych dostawców i zawsze dla `sharepoint`;
`cloudDataService.ts` używa żywego tokenu z silnika OAuth zamiast kolumny bazy; `CloudDataSettings.tsx`
prowadzi „Connect" do realnego startu OAuth albo jest uczciwie wyłączony z polskim komunikatem;
korekta audytu (który plik jest reachable) zmierzona i zapisana z dowodem. Para dowodów
`409 bez tokenu / 201 z tokenem` i dowód izolacji cross-user obowiązkowe w tym samym commicie
co `R2`.**

Odbiorca odrzuci dyżur, w którym: źródło chmurowe nadal powstaje bez tokenu; token z body
żądania jest nadal używany; `CloudDataSettings.tsx` zostaje zamontowany w nowej trasie bez
flagi i bez akceptu; trzeci mechanizm został „naprawiony" bez zatrzymania się na pytaniu do
właściciela; `reach` urósł o cokolwiek poza trzema zastanymi plikami bez `--update-baseline`;
zmienił się stan choćby jednego wiersza macierzy odbioru.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „bramka tokenu działa i ma
parę dowodów, `cloudDataService.ts` czyta token żywo dla Google Drive, front dla OneDrive/
Dropbox zatrzymany na decyzji o komunikacie" — **jest pełnowartościowym wynikiem**, nawet
jeżeli nie wszystkie trzy dostawce doszły do końca `R4`.

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: **sprawdzasz
warunek NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na zapamiętanym wyniku.**
Wynik ponownego sprawdzenia wklejasz do raportu z datą i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Napraw ekran z Ustawień→Integracje" vs „CloudDataSettings.tsx jest martwy" | `R1` pkt 2 + `Jedyny`/`Z40`: naprawiasz JEGO KOD, ale nie montujesz nowej trasy — to jest pytanie do właściciela w `R5`, nie zadanie do samodzielnego rozstrzygnięcia |
| „Silnik OAuth jest nietykalny (`Z12`-podobny)" vs „musisz go użyć" | Tabela licencji: **wołasz** funkcje eksportowane, nie zmieniasz pliku; jeśli brakuje eksportu — brief, nie edycja |
| „Nie ufaj tokenowi z body" vs „`createCloudSource` przyjmuje `accessToken` jako parametr" | `R2` pkt 3: dla trzech wpiętych dostawców payload do `createCloudSource` ma te pola wyzerowane; sama funkcja `createCloudSource` zostaje niezmieniona (nadal PRZYJMUJE opcjonalny token — używają jej być może inne, nieaudytowane ścieżki) |
| „Izolacja cross-org" vs „token jest per-użytkownik, bez organization_id" | `R0` (4) i pułapka (6): dowód izolacji jest per-użytkownik (user B bez tokenu ≠ user A z tokenem), nie per-organizację; ograniczenie schematu idzie do pytań właściciela |
| „Napraw trzeci mechanizm" vs „to za duża zmiana na jeden dyżur" | `R5`: TYLKO pomiar + diff nienałożony + pytanie; `ZAKAZ_WLASCIWY_TEMU_DYZUROWI` to wymusza wprost |
| „`reach` ma kończyć się 0" vs „na markerze jest już 1" | Warunki wspólne serii: dopuszczalne pozostanie `1` z TYMI SAMYMI trzema zastanymi plikami; niedopuszczalny jest wzrost |
| „Dopisz sekcję do rejestru znalezisk" vs „równolegle piszą inni autorzy (367-373 tego samego dnia)" | `R5`: literę sprawdzasz komendą tuż przed commitem; jeśli `AG` zajęte — bierzesz kolejną wolną i piszesz to w raporcie |
| „Audyt mówi, że D-1 dotyczy CloudDataSettings.tsx" vs „Twój pomiar może to obalić" | `R1` pkt 2: obalenie jest WYNIKIEM, nie sprzecznością — zmienia zakres `R4`, opisujesz i kontynuujesz |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 8 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — `cloud.routes.ts:82-116,391-440`, `cloudDataService.ts:73-158,160-767`, `integrationOAuthEngine.ts:265-896`, `settings.routes.ts:1485-1575,1882-2330`, `pmSyncExternalAuthMaterializationService.ts:180-348`, `CloudDataSettings.tsx` (cały), `AddFilesMenu.tsx:250-263` sprawdzone; `evidence/chmura-oauth-20260905/day369/` **jawnie oznaczony jako nieistniejący** |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 9 wierszy; wszystkie zmierzone przy wydaniu na markerze, w tym `reach=1` z konkretną listą trzech plików |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — brama · serwis · silnik OAuth (odczyt) · trasy realnego OAuth · governed connector (pomiar) · migracje · front martwy · front tylko-odczyt · klient API · nowe testy · infrastruktura testów · middleware · słowniki · reachability baseline · nowe dowody · macierz · rejestr znalezisk · raport · cudze tereny |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R1` czyta, `R2` dotyka jednej trasy, `R3` dotyka jednego serwisu (wzorzec powtarzalny 9×), `R4` jednego martwego komponentu, `R5` składa+mierzy |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — 6440/5580 wolne (`lsof` przy wydaniu), brak kontenera `cx-day369-pg`, brak gałęzi/worktree; rodzeństwo 367,368,370-373 ma rozłączne porty z tej samej puli zarezerwowanej na 05.09 |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z markera |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — `§0.2d` w komplecie; pułapki właściwe: trzy systemy integracji, reachable≠audyt, brak migracji pliku dla `integration_oauth_tokens`, token szyfrowany, `storeTokens` wymaga zatwierdzenia, izolacja per-użytkownik |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany", zero pól szablonu | TAK — kontrola generatora przy wydaniu |
