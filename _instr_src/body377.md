## Po co ten dyżur istnieje

Dyżur 369 zmierzył, że kliknięcie „Connect” dla Google Drive/OneDrive/Dropbox w Ustawienia→Integracje
(`ConnectedAppsSettings.tsx`) idzie przez REALNY, działający silnik OAuth
(`GET /api/settings/integrations/oauth/start/:connectorId`, `integrationOAuthEngine.ts`) — i naprawił
bramkę tokenu po stronie `cloud_sources`/czatu. Przy okazji (R5, tylko pomiar) trafił na **trzeci,
osobny mechanizm** — `pmSyncExternalAuthMaterializationService.ts`, `buildGovernedExternalAuthSession`
— i jednym, pojedynczym `curl`em zmierzył, że `POST /api/settings/integrations/google_drive/connect`
kończy się **`500 {}`**, zamiast teoretyzowanego w jego własnej instrukcji „200 + `authUrl` bez
`client_id`”. Ten dyżur idzie o krok dalej: znajduje PRZYCZYNĘ tego `500`, sprawdza, **które przyciski
w prawdziwej aplikacji faktycznie przez niego przechodzą**, i naprawia go tak, żeby przestał być gołym
`500`, a został uczciwą odmową.

**Przyczyna, zmierzona linia po linii:** `buildGovernedExternalAuthSession`
(`server/src/services/v8/pmSyncExternalAuthMaterializationService.ts:227-344`) jako swoją PIERWSZĄ
instrukcję (`:231`) woła `requireApprovedGovernedConnector(connectorId)` (`:124-135`). Ta funkcja
rzuca `Error('Governed external auth provider is not approved: ${connectorId}')` (rzuty na liniach
**128** i **133**) dla KAŻDEGO `connectorId`, który albo (a) nie jest jednym z zamrożonej piątki
`jira,gmail,asana,teams,slack` (`GOVERNED_CONNECTOR_REQUIRED_SCOPES:110-116`), albo (b) JEST w tej
piątce, ale zmienna środowiskowa `OAUTH_APPROVED_PROVIDER_REGISTRY` (czytana przez
`getRegistryApprovalDecision`, `server/src/services/oauthService.ts:114-136`) jest pusta lub nie
zawiera go z pasującymi zakresami. **Zmierzone: w tym środowisku dyżuru `OAUTH_APPROVED_PROVIDER_REGISTRY`
jest PUSTA** — więc funkcja odmawia dosłownie WSZYSTKIEMU, nie tylko chmurze.

**Dlaczego to NIE jest luka do załatania przepuszczeniem ruchu, tylko brzydkie ujawnienie zamierzonej
polityki:** komentarz tuż nad definicją rejestru (`pmSyncExternalAuthMaterializationService.ts:83-85`)
mówi wprost:

> `SET-MVP-OAUTH-001 / AMD-SET-OAUTH-APPROVED-OUT-002: external OAuth is excluded from MVP. Every
> reachable consent-URL producer in this file must fail closed unless the connector is explicitly
> approved through OAUTH_APPROVED_PROVIDER_REGISTRY.`

Odmowa jest ZAMIERZONA. Defektem tego dyżuru jest WYŁĄCZNIE to, że ta zamierzona odmowa objawia się
jako nieprzechwycony wyjątek → goły `500` bez kodu błędu i bez komunikatu, zamiast jako czytelna,
ustrukturyzowana odpowiedź, którą front może pokazać człowiekowi. Naprawa NIE zatwierdza żadnego
nowego dostawcy — to złamałoby politykę bezpieczeństwa udokumentowaną w kodzie.

**Rodzina, nie pojedynczy przycisk:** `buildGovernedExternalAuthSession` ma **SZEŚĆ** miejsc wywołania
w `server/src/`, i ŻADNE z nich nie przechwytuje akurat tego wyjątku:

| # | Plik:linia | Trasa HTTP |
| --- | --- | --- |
| 1 | `settings.routes.ts:1921` | `POST /api/settings/integrations/:provider/connect` (trasa od `:1882`) |
| 2 | `settings.routes.ts:2441` | `POST /api/settings/integrations/:provider/refresh` (trasa od `:2393`) |
| 3 | `settings.routes.ts:2522` | `PUT /api/settings/integrations/:provider/config` (trasa od `:2470`) |
| 4 | `routes/integrations/integrations.routes.ts:217` | `POST /api/integrations/connect/:provider` i alias `POST /api/integrations/:provider/connect` |
| 5 | `routes/v8/sync.routes.ts:1059` | v8 sync connect (kontekst do zmierzenia w `R1`) |
| 6 | `routes/v8/sync.routes.ts:1247` | v8 sync reconnect/refresh (kontekst do zmierzenia w `R1`) |

**Korekta wagi (ten sam wzorzec co dyżur 369 — zmierz, zanim uznasz, co jest „żywe”):** z tej szóstki,
policzone przeze mnie jako reachable z REALNEGO ekranu (`ConnectedAppsSettings.tsx`) jest wyłącznie
miejsce **#1**, i to WYŁĄCZNIE dla dostawcy `teams`. `jira` ma w rejestrze (`getGovernedExternalAuthConfigFields`,
`:216-224`) DODATKOWO wymagane `client_id`/`client_secret`, których front nigdy nie zbiera (katalog
frontu ma dla `jira` tylko `site_url`) — więc `jira` NIGDY nie osiąga `onboardingStatus==='pending_external_auth'`
i nigdy nie dociera do `buildGovernedExternalAuthSession` z tego ekranu. `monday` ma `authType:'api_key'`
— inna gałąź kodu, też nie woła tej funkcji. Jedyny front, który wywołuje miejsce #1 (i pośrednio #2)
BEZWARUNKOWO dla `google_drive`/`onedrive`/`dropbox` — `useUserIntegrations.ts` (`connect:130-150`,
`refreshToken:210-230`) — ma dokładnie DWÓCH konsumentów w `src/`, i OBAJ są już martwi, potwierdzeni
niezależnie w zaakceptowanym `reachability.baseline.json`: `UserIntegrations/index.tsx`+`IntegrationCard.tsx`
(linie ok. 475-476) i `NotificationChannelsSettings.tsx` (linia ok. 1413). Miejsca #3-#6 — reachability
z UI NIEZMIERZONA przed tym dyżurem; **R1 ma to zmierzyć**, nie zakładać.

## ★ Stan zastany, zmierzony przeze mnie na markerze `8f60ab998734adcdf61a080f4e1270c3dbdffceb`

| Co | Wartość zmierzona | Gdzie |
| --- | --- | --- |
| piątka zatwierdzonych connectorId | `jira`,`gmail`,`asana`,`teams`,`slack` (5) | `GOVERNED_CONNECTOR_REQUIRED_SCOPES:110-116` |
| komunikat rzucany dla niezatwierdzonego | `Governed external auth provider is not approved: <connectorId>` | `requireApprovedGovernedConnector:124-135`, rzuty 128/133 |
| `OAUTH_APPROVED_PROVIDER_REGISTRY` w środowisku dyżuru | PUSTA (nieustawiona) | `env \| grep OAUTH_APPROVED_PROVIDER_REGISTRY` → brak wyniku |
| konsekwencja pustej zmiennej | `requireApprovedGovernedConnector` odmawia RÓWNIEŻ zatwierdzonej piątce, nie tylko chmurze | `oauthService.ts:114-136`, `getRegistryApprovalDecision` zwraca `null` |
| `google_drive`/`onedrive`/`dropbox`/`box` w rejestrze `CONNECTORS` | `authType:'oauth2'`, `configFields:[]` (wszystkie 4) | `integrationHubService.ts:188,196,204,212` |
| konsekwencja pustych `configFields` | `hasAllRequiredFields` zawsze `true` → `onboardingStatus='pending_external_auth'` natychmiast | `settings.routes.ts:1675-1689`, `getPendingOnboardingStatus` |
| miejsca wywołania `buildGovernedExternalAuthSession` w `server/src/` | **6**, żadne nie przechwytuje komunikatu „not approved” | tabela wyżej, potwierdzone `grep` |
| jedyny wołacz reachable z `ConnectedAppsSettings.tsx` | miejsce #1, WYŁĄCZNIE dla `teams` | `submitConnectModal:1003-1078`, katalog `CATALOG` |
| dlaczego nie `jira` | brakujące `client_id`/`client_secret` (dodane tylko dla `jira` w rejestrze) nigdy niezebrane przez front | `getGovernedExternalAuthConfigFields:216-224` vs `CATALOG` (`jira` ma tylko `site_url`) |
| dlaczego nie `monday` | `authType:'api_key'`, inna gałąź, nie woła `buildGovernedExternalAuthSession` | `CATALOG` id `monday`, `submitConnectModal:1046-1066` |
| dwaj martwi wołacze tej samej trasy dla chmury | `UserIntegrations/index.tsx`+`IntegrationCard.tsx`, `NotificationChannelsSettings.tsx` | oba już w `reachability.baseline.json` (linie ok. 475-476, 1413) |
| `asyncHandler` przechwytuje throw synchroniczny | TAK, `.then(()=>fn()).catch(next)` | `server/src/utils/asyncHandler.ts:13-22` |
| error middleware w `Gateway.ts` | BRAK (potwierdzone `grep`) | — |
| error middleware w pełnym serwerze | `errorHandlerMiddleware`, `index.ts:1747` | `server/src/utils/ErrorHandler.ts:213-330` |
| zachowanie na gołym `ApiGateway` (bez `index.ts`) | `500`, ciało nieinformacyjne (zmierzone niezależnie w dyżurze 369: `{}`) | brak error middleware → domyślny handler Express |
| istniejąca częściowa obsługa błędu w `integrations.routes.ts` | łapie WYŁĄCZNIE `'Unknown connector:'` → `404`; „not approved” przelatuje przez `throw error;` | `:718-740` |
| dowód mutacyjny „przed zapisem” w komentarzu kodu | zapewnia, że zatwierdzenie jest sprawdzane PRZED `INSERT INTO integrations` | `:204-210`, do zweryfikowania w `R4`, nie tylko zaufać |
| SET-MVP-OAUTH-001 (decyduje kierunek naprawy) | „external OAuth is excluded from MVP… must fail closed unless approved” | `pmSyncExternalAuthMaterializationService.ts:83-85` |
| liście słowników | `pl 35294`, `en 33154` | `public/locales/**/translation.json` |
| cztery bezpieczniki kanonu | `focus=0`, `list=0`, `artefakt=0`, **`reach=1`** (49 zastanych plików test-only, w tym `CloudDataSettings.tsx` z dyżuru 369 — NIE Twoja przyczyna) | patrz niżej |
| REJESTR_ZNALEZISK — ostatnia litera | `AM` (dyżur 373) → następna wolna `AN` | `grep -nE '^## [A-Z]+\.'` |

## ★ Zmierz moje liczby sam

Twierdzę, na markerze: **6** miejsc wywołania `buildGovernedExternalAuthSession` w `server/src/`;
**0** z nich przechwytuje komunikat „not approved”; `OAUTH_APPROVED_PROVIDER_REGISTRY` **pusta** w tym
środowisku; jedyny front reachable to `ConnectedAppsSettings.tsx` dla dostawcy **`teams`** wyłącznie;
`jira` nigdy nie dociera do tej funkcji z UI (brakujące pola); dwaj pozostali wołacze
(`UserIntegrations/index.tsx`, `NotificationChannelsSettings.tsx`) już martwi w zaakceptowanym baseline;
`reach=1` z **49** zastanymi plikami test-only.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz
rozbieżność wprost.** W szczególności: miejsca #3-#6 z tabeli wyżej mają NIEZMIERZONĄ przeze mnie
reachability z UI — to jest Twoje zadanie w `R1`, nie założenie do przyjęcia bez sprawdzenia.

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: SILNIK ZATWIERDZEŃ · SZEŚĆ TRAS · FRONT · TESTY · DEV-RENDER

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany brief
z `plik:linia` oraz diff **nienałożony**. Pozycja z takim produktem jest **ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Silnik zatwierdzeń (klasyfikacja błędu)** | `server/src/services/v8/pmSyncExternalAuthMaterializationService.ts` | **★ PEŁNA LICENCJA** na dodanie JEDNEJ nowej, NIE-rzucającej funkcji eksportowanej (np. rozpoznanie po treści wyjątku albo osobny predykat sprawdzający zatwierdzenie bez rzucania — Twój wybór kształtu, uzasadnij w raporcie), którą wszystkie sześć wołaczy będzie mogło użyć IDENTYCZNIE. **Zakaz** zmiany `requireApprovedGovernedConnector`/`buildGovernedExternalAuthSession` tak, żeby przepuszczały niezatwierdzony konektor, i zakaz zmiany zachowania `materializeGovernedExternalAuthCallback` (`:350+`) — ta funkcja i jej wywołanie `requireApprovedGovernedConnector` (`:367`) mają zostać dokładnie takie jak dziś | Brief + diff nienałożony |
| **Sześć tras HTTP** | `server/src/routes/settings.routes.ts` (trzy miejsca: `:1921`,`:2441`,`:2522`), `server/src/routes/integrations/integrations.routes.ts` (`:217`), `server/src/routes/v8/sync.routes.ts` (`:1059`,`:1247`) | **★ PEŁNA LICENCJA, WĄSKA:** WYŁĄCZNIE opakowanie istniejącego wywołania `buildGovernedExternalAuthSession(...)` przechwyceniem nowej klasyfikacji z pliku wyżej i zwrócenie ustrukturyzowanej odpowiedzi (kod + polski komunikat) zamiast pozwolenia na `throw` do `next`. **Zakaz** zmiany istniejącej gałęzi `'Unknown connector:'`→`404` w `integrations.routes.ts:718-740` — dodajesz OBOK niej, nie zamiast. **Zakaz** zmiany logiki `willAttemptExternalAuth`/`onboardingStatus`/kolejności zapisów DB — te zostają nietknięte | Brief + diff nienałożony |
| **Rejestr zatwierdzeń (odczyt)** | `server/src/services/oauthService.ts`, `server/src/services/integrationHubService.ts` | **TYLKO ODCZYT** — wołasz `getRegistryApprovalDecision`/`CONNECTORS` pośrednio przez istniejący kod, nie zmieniasz tych plików | Brief, jeśli jednak potrzebne |
| **Front — jedyny żywy wołacz** | `src/components/settings/ConnectedAppsSettings.tsx` | **★ PEŁNA LICENCJA, WĄSKA:** WYŁĄCZNIE `submitConnectModal` (blok „For OAuth providers with config: store config before redirecting”, ok. `:1069-1075`) — sprawdź `resp.ok`/kod błędu z odpowiedzi `POST .../connect`, pokaż `toast.error` z komunikatem serwera i PRZERWIJ (nie wołaj `startOAuthFlow`) zamiast dzisiejszego bezwarunkowego `await fetch(...)` bez sprawdzenia. **Zakaz** zmian w `CATALOG`, `handleConnect`, `startOAuthFlow`, obsłudze `jira`/`monday` | — |
| **Front — tylko odczyt (dowód martwoty)** | `src/hooks/useUserIntegrations.ts`, `src/components/settings/UserIntegrations/index.tsx`, `IntegrationCard.tsx`, `src/components/settings/notifications/NotificationChannelsSettings.tsx` | **TYLKO ODCZYT** — dowód, że są już martwe/w baseline | Opis w raporcie |
| **Nowe testy serwerowe** | `server/src/routes/__tests__/day377.*.pg.test.ts` (nowy) | **★ PEŁNA LICENCJA**, z zastrzeżeniem `Z18`/`Z31` | — |
| **Nowe testy frontu** | `tests/unit/components/settings/ConnectedAppsSettings.governedConnectHonesty.test.tsx` (nowy) | **★ PEŁNA LICENCJA** | — |
| **Bezpieczniki i konfiguracja testów** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie |
| **Middleware / bramki platformowe** | `server/src/middleware/auth.middleware.ts`, `server/src/middleware/auditsStrictMembership.middleware.ts`, `server/src/services/ApiGateway.ts`, `server/src/Gateway.ts` | **NIETYKALNE DO ZAPISU** (`Z12`) | Brief |
| **Słowniki** | `public/locales/pl/translation.json`, `public/locales/en/translation.json` | **★ WYŁĄCZNIE DOPISYWANIE KLUCZY** (np. `settings.integrations.governedNotApproved`), parytet PL+EN w tym samym commicie, wartość PL naprawdę polska. Liście nie mogą zmaleć | — |
| **Reachability baseline** | `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` | **★ WĄSKA LICENCJA:** wolno dopisać WYŁĄCZNIE Twoje własne nowe pliki testowe, jeśli `--check-baseline` tego zażąda; zakaz dopisywania 49 cudzych zastanych pozycji | Opis w raporcie |
| **Dev-render (R5)** | `dev-render/main.tsx` (rejestracja), NOWY `dev-render/screens/day377-governed-connect.tsx` (wzór: `dev-render/screens/ustawienia-grupy.tsx`) | **★ PEŁNA LICENCJA** | — |
| **Nowe dowody** | `evidence/governed-connect-20260905/day377/**` (NIE ISTNIEJE — tworzysz) | **★ PEŁNA LICENCJA**; commitujesz przez `git add -f` | — |
| **Macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` | ★★★ **NIETYKALNE DO ZAPISU — ŻADEN wiersz, ŻADEN moduł**, w tym `13_CHAT` i `15_SETTINGS` | Rekomendacja w raporcie |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jedna nowa sekcja o pierwszej wolnej literze (`AN`, sprawdzonej komendą tuż przed commitem) | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY377_GOVERNED_CONNECT_REPORT.md` (**NOWY**) | `R5` — **JEDYNY nowy dokument rejestrowy** (`Z13`) | — |
| **Cudze tereny** | pozostałe dyżury paczki 367-376, pliki `AUDYT_CZAT_PRZYCISKI_20260905/*.md`, 49 zastanych plików test-only | **TYLKO ODCZYT** | Wpis do raportu, plik:linia, idziesz dalej |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem plik:linia i idziesz dalej |

## ★★ WARUNKI WSPÓLNE SERII

Mierzysz **PRZED pierwszym commitem i PO ostatnim**, obie pary liczb do raportu:

```bash
cd "$WT"
# (a) liscie slownikow NIE MOGA ZMALEC
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
#   moje liczby: pl 35294, en 33154

# (b) trzy bezpieczniki maja konczyc sie kodem 0; reach jest JUZ 1 na markerze
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus-canon=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list-canon=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
#   moje liczby PRZED: focus=0, list=0, artefakt=0, reach=1 (49 zastanych plikow test-only)
#   PO Twoich zmianach: focus/list/artefakt MUSZA zostac 0; reach MOZE zostac 1 z TYMI SAMYMI
#   49 zastanymi plikami — ale NIE WOLNO Ci dolozyc pozycji poza Twoimi wlasnymi nowymi testami
#   bez --update-baseline w tym samym commicie.
```

**Jeżeli którakolwiek liczba zmaleje albo bramka `focus`/`list`/`artefakt` zaczerwieni się od Twojej
zmiany — naprawiasz KODEM, nigdy progiem i nigdy `--no-verify`** (`Z35`).

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | miejsc wywołania `buildGovernedExternalAuthSession` w `server/src/` | `6` | komenda (5) z `§0.3` | TAK — cała rodzina |
| 2 | z nich przechwytujących komunikat „not approved” PRZED naprawą | `0` | odczyt każdego z 6 miejsc | TAK |
| 3 | connectorId w `GOVERNED_CONNECTOR_REQUIRED_SCOPES` | `5` (`jira,gmail,asana,teams,slack`) | komenda (1) | TAK |
| 4 | `OAUTH_APPROVED_PROVIDER_REGISTRY` ustawiona? | `NIE` (pusta) | komenda (3) | TAK — **rozstrzyga, czy piątka też jest odrzucana** |
| 5 | dostawców frontu reachable z `ConnectedAppsSettings.tsx`, którzy DOCIERAJĄ do `buildGovernedExternalAuthSession` | `1` (`teams`) | komenda (6) | TAK |
| 6 | martwych wołaczy tej samej trasy, już w baseline | `2` (`UserIntegrations/index.tsx`, `NotificationChannelsSettings.tsx`) | komenda (7) | TAK |
| 7 | `numTotalTests`/lista nazw pakietu naprawy, przed/po mutacją | — | `R3`/`R4` własny pomiar | TAK — `Z37`, porównanie po nazwach |
| 8 | liście słowników PL/EN | `35294`/`33154` | blok (a) „WARUNKÓW WSPÓLNYCH” | TAK |
| 9 | `reach` PRZED i PO, liczba plików | `1` / `49` | blok (b) „WARUNKÓW WSPÓLNYCH” | TAK — dowód, że nie dołożyłeś pozycji poza własnymi testami |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY377_GOVERNED_CONNECT_REPORT.md` ·
`evidence/governed-connect-20260905/day377/**` (nowe) ·
`server/src/services/v8/pmSyncExternalAuthMaterializationService.ts` (nowa, nie-rzucająca klasyfikacja) ·
`server/src/routes/settings.routes.ts` (trzy opakowania) ·
`server/src/routes/integrations/integrations.routes.ts` (jedno opakowanie, obok istniejącej gałęzi 404) ·
`server/src/routes/v8/sync.routes.ts` (dwa opakowania) ·
`src/components/settings/ConnectedAppsSettings.tsx` (`submitConnectModal`) ·
nowe pliki testowe w `server/src/routes/__tests__/**` i `tests/unit/components/settings/**` (`git add -f`) ·
`dev-render/main.tsx` + nowy `dev-render/screens/day377-governed-connect.tsx`.

**Zapisujesz WARUNKOWO:**
`public/locales/pl/translation.json` + `public/locales/en/translation.json` (WYŁĄCZNIE nowe klucze) ·
`docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` (WYŁĄCZNIE Twoje nowe pliki testowe) ·
`docs/program/REJESTR_ZNALEZISK_20260903.md` (jedna nowa sekcja, litera `AN` zweryfikowana tuż przed
commitem).

**JAWNIE NIE ZAPISZESZ:** `server/src/services/oauthService.ts`, `server/src/services/integrationHubService.ts`,
zmian w `requireApprovedGovernedConnector`/`buildGovernedExternalAuthSession` wykraczających poza dodanie
nowej, osobnej, nie-rzucającej funkcji, `materializeGovernedExternalAuthCallback` i jej wywołanie
`requireApprovedGovernedConnector:367`, `server/src/middleware/**`, `server/src/services/ApiGateway.ts`,
`server/src/Gateway.ts`, `server/migrations/**`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`,
`vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`,
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` (wszystkie 16),
`src/hooks/useUserIntegrations.ts`, `src/components/settings/UserIntegrations/**`,
`src/components/settings/notifications/NotificationChannelsSettings.tsx`, katalog `CATALOG` i
`handleConnect`/`startOAuthFlow` w `ConnectedAppsSettings.tsx`, 49 zastanych plików test-only wymienione
w „Stan zastany”.

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day377-governed-connect
git diff --name-only --cached | tee /private/tmp/cx-day377-governed-connect-artefakty/staged.txt
bash -c "grep -iE '^server/src/services/oauthService|^server/src/services/integrationHubService|^server/src/middleware/|ApiGateway|^server/src/Gateway|^server/migrations/|^tests/setup|^tests/helpers|^tests/__mocks__|vitest.*config|^\.github/|MODULE_ACCEPTANCE|useUserIntegrations\.ts|UserIntegrations/|NotificationChannelsSettings\.tsx' /private/tmp/cx-day377-governed-connect-artefakty/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## R0 — CZTERY TWARDE ZASADY TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

**(1) Naprawiasz KSZTAŁT błędu, nigdy WARUNEK odmowy.** `requireApprovedGovernedConnector` ma
POZOSTAĆ fail-closed dla każdego connectorId spoza zatwierdzonej piątki i dla każdej pustej/niepasującej
`OAUTH_APPROVED_PROVIDER_REGISTRY` — to jest udokumentowana polityka `SET-MVP-OAUTH-001`. Twoja zmiana
sprawia, że ta sama odmowa wychodzi na zewnątrz jako ustrukturyzowany kod błędu + polski komunikat,
zamiast gołego `500`.

**(2) Sześć miejsc to jedna rodzina.** Naprawa próbki (np. tylko `settings.routes.ts:1921`, bo to
jedyne reachable z `ConnectedAppsSettings.tsx`) NIE jest zrobiona — pozostałe pięć nadal będzie 500-ować
komukolwiek, kto do nich trafi (bezpośrednie API, przyszłe UI, testy integracyjne).

**(3) `materializeGovernedExternalAuthCallback` i jej wywołanie `requireApprovedGovernedConnector`
(`:367`) zostają dokładnie takie jak dziś.** To jest obsługa callbacku OAuth, inna ścieżka wykonania,
poza zakresem tego dyżuru — nie dotykasz jej, nawet pośrednio przez zmianę współdzielonej funkcji.

**(4) Nie mylisz „not approved” z „unknown connector”.** `integrations.routes.ts:718-740` ma już
poprawną obsługę dla nieznanego `provider` (`404`) — dodajesz ROZRÓŻNIENIE dla „not approved”, nie
nadpisujesz istniejącej gałęzi.

**Wymagany dowód:** cztery zdania w raporcie, że przeczytałeś te zasady, plus `git show --stat` każdego
commita. **Bez commita — to jest warunek, nie pozycja.**

## R1 — KROK 0: RODZINA SZEŚCIU MIEJSC, KOREKTA WAGI, ODTWORZENIE `500` (rdzeń)

1. **Potwierdź grepem WSZYSTKIE sześć miejsc** wywołania `buildGovernedExternalAuthSession` w
   `server/src/` (komenda (5) z `§0.3`) i dla każdego zapisz: plik:linia, trasa HTTP, metoda, czy
   istnieje jakiekolwiek przechwycenie wyjątku wokół wywołania. Jeżeli Twój grep da INNĄ liczbę niż
   `6` — to jest WYNIK, nie sprzeczność; opisz różnicę i kontynuuj z Twoją liczbą.
2. **Potwierdź `OAUTH_APPROVED_PROVIDER_REGISTRY` w Twoim środowisku dyżuru** (komenda (3)) i zapisz,
   czy jest pusta. Jeżeli NIE jest pusta (środowisko się zmieniło) — sprawdź, czy zawiera którykolwiek
   z pięciu zatwierdzonych connectorId z pasującymi zakresami, i zapisz to jako fakt zmieniający zasięg
   Twojej naprawy (być może `teams`/`jira`/itd. wtedy NIE rzucają — Twoja naprawa i tak musi działać
   poprawnie w OBU przypadkach, bo `OAUTH_APPROVED_PROVIDER_REGISTRY` może się różnić między środowiskami).
3. **Korekta wagi — potwierdź, który z sześciu jest reachable z żywego frontu.** Dla miejsca #1
   (`settings.routes.ts:1921`, wołane z `ConnectedAppsSettings.tsx`): przeczytaj `submitConnectModal`
   (`:1003-1078`) i katalog `CATALOG`, potwierdź, że jedynym dostawcą z `authType:'oauth2'` +
   `configFields` niepustym i ZGODNYM z rejestrem (bez dodatkowych pól jak `jira`) jest `teams`. Dla
   miejsc #2-#6: sprawdź grepem, czy JAKIKOLWIEK plik w `src/` (poza już-martwymi `useUserIntegrations.ts`
   i jego dwoma konsumentami) woła którąkolwiek z tych tras (`refresh`, `config` PUT, `/api/integrations/connect/:provider`,
   v8 sync connect/reconnect) i czy ten wołający komponent ma jakiegokolwiek importera w `src/` (nie tylko
   sam siebie) — jeśli tak, to jest NOWY, ważny wynik zmieniający wagę tego dyżuru; opisz to jako STOP
   MERYTORYCZNY z pełnym uzasadnieniem i kontynuuj naprawę WSZYSTKICH sześciu miejsc mimo to (rodzina
   nie zależy od tego, czy dany fragment jest dziś reachable).
4. **Odtwórz `500` na realnym PostgreSQL, na co najmniej DWÓCH z sześciu tras** (rekomendacja: #1 dla
   `provider='google_drive'` — bezwarunkowo nieodtwarzalne dla `teams`, bo `teams` NIE ma wypełnionych
   `client_id`/`client_secret` w tym rejestrze, więc użyj `google_drive`/`onedrive`/`dropbox`, żeby
   ominąć akurat ten warunek i trafić wprost w `requireApprovedGovernedConnector`; oraz #4,
   `POST /api/integrations/connect/google_drive`), przez realny `ApiGateway.getInstance().initializeRoutes(app)`
   + `supertest`, z podpisanym JWT i zasianym wierszem `organization_members` (`status='ACTIVE'`, patrz
   pułapka 5 w `§0.2d`). Zapisz dosłowny status i ciało odpowiedzi PRZED naprawą.
5. **Doczytaj prawdziwy komunikat**, jeśli ciało odpowiedzi jest nieinformacyjne: albo uruchom przez
   pełny `server/src/index.ts` (żeby zadziałało `errorHandlerMiddleware`), albo — jeśli to niepraktyczne
   w Twoim harnessie — potwierdź treść komunikatu przez odczyt kodu (już zmierzone w tej instrukcji:
   `Governed external auth provider is not approved: <connectorId>`) i zapisz, że nie uruchamiałeś
   pełnego serwera, jeśli tak było.

**Wymagany dowód:** tabela sześciu miejsc z werdyktem reachable/martwe · potwierdzenie wartości
`OAUTH_APPROVED_PROVIDER_REGISTRY` · dosłowny `500` z co najmniej dwóch tras, zmierzony PRZED naprawą.
**Commit po `R1`** (sam raport cząstkowy w `evidence/governed-connect-20260905/day377/R1-rodzina.md`,
zero kodu produktu).

## R2 — PRZYCZYNA ŹRÓDŁOWA, ZAPISANA Z LINIAMI (rdzeń)

1. Napisz precyzyjny łańcuch przyczynowy w raporcie: front (jeśli `teams`) lub bezpośrednie API →
   trasa HTTP (jedna z sześciu, plik:linia) → `willAttemptExternalAuth`/`requiresGovernedExternalAuth`
   (oblicz z `authType`+`onboardingStatus`) → `buildGovernedExternalAuthSession` (`:227`, pierwsza
   instrukcja `:231`) → `requireApprovedGovernedConnector` (`:124-135`) → `throw` (linia 128 lub 133,
   zależnie od tego, który z dwóch warunków zawiódł: nieznany connectorId vs znany, ale niezatwierdzony
   przez rejestr) → `asyncHandler` (`:13-22`) → `next(err)` → (gołe `ApiGateway`: domyślny handler
   Express, brak formatowania; pełny serwer: `errorHandlerMiddleware`, `500 INTERNAL_ERROR`).
2. Zacytuj DOSŁOWNIE komentarz `SET-MVP-OAUTH-001` (`:83-85`) jako dowód, że to jest zamierzona
   polityka, nie przypadkowa luka — to rozstrzyga wybór w `R3` na rzecz „uczciwe wyłączenie”, nie
   „przywróć działanie”.
3. Zapisz jawnie: naprawa NIE zmienia WARUNKU odmowy (kto jest odrzucany), zmienia WYŁĄCZNIE FORMAT
   odpowiedzi (jak wygląda odrzucenie).

**Wymagany dowód:** akapit łańcucha przyczynowego z linia-po-linii · cytat `SET-MVP-OAUTH-001` ·
zdanie rozstrzygające wybór gałęzi naprawy. **Commit po `R2`** (może być połączony z `R1`, jeśli
pracujesz ciągiem — zaznacz to w raporcie).

## R3 — NAPRAWA: JEDNA KLASYFIKACJA, SZEŚĆ MIEJSC, UCZCIWY FRONT (rdzeń)

1. **W `pmSyncExternalAuthMaterializationService.ts`** dodaj JEDNĄ nową, eksportowaną, NIE-rzucającą
   funkcję (Twój wybór kształtu — np. `isGovernedConnectorApprovalError(err: unknown): boolean`
   rozpoznająca po treści komunikatu z `requireApprovedGovernedConnector`, ALBO osobny, nie-rzucający
   `getGovernedConnectorApprovalStatus(connectorId): 'approved' | 'not_approved'` wywoływany PRZED
   `buildGovernedExternalAuthSession` jako pre-flight guard — uzasadnij wybór w raporcie). Funkcja
   MUSI dawać identyczny wynik dla WSZYSTKICH sześciu miejsc wywołania (ten sam mianownik — `Z24`).
2. **W każdym z sześciu miejsc z tabeli w R1** opakuj istniejące wywołanie `buildGovernedExternalAuthSession(...)`
   (albo poprzedź je pre-flight guardem z punktu 1) tak, żeby przy odrzuceniu:
   - trasa zwraca **`501`** (funkcja nie jest dostępna w tej wersji — nie `409`, żeby nie sugerować
     przejściowego stanu) z `{ error: '<polski komunikat>', code: 'GOVERNED_CONNECTOR_NOT_APPROVED' }`;
   - polski komunikat, np. `t`-owalny string frontu albo stały tekst API: „Integracja nie jest dostępna
     w tej wersji” — dodaj klucz i18n WYŁĄCZNIE jeśli front go faktycznie konsumuje (patrz punkt 3);
   - **żaden zapis do bazy nie następuje** — potwierdź to explicite (dowód w `R4` pkt 3), zgodnie z
     komentarzem `:204-210`, który to obiecuje;
   - gałąź `'Unknown connector:'`→`404` w `integrations.routes.ts:718-740` zostaje NIETKNIĘTA, dodajesz
     nową gałąź OBOK niej w tym samym `catch`.
3. **W `ConnectedAppsSettings.tsx`, `submitConnectModal`** (blok „For OAuth providers with config”):
   sprawdź `resp.ok` po `POST .../connect`; jeśli nie `ok`, odczytaj `{error,code}` z ciała, pokaż
   `toast.error(error)` i **PRZERWIJ** (nie wołaj `startOAuthFlow`, `setConnectModalApp(null)` dopiero
   po komunikacie albo zostaw modal otwarty — Twój wybór, opisz w raporcie). Dziś ten `fetch` jest
   bezwarunkowy i wynik ignorowany — to ma się zmienić.
4. **Dowód mutacyjny**: cofnij tymczasowo naprawę w JEDNYM z sześciu miejsc (`cp` do `SCRATCH`) — test
   tego miejsca ma **zaczerwienić się** (z powrotem goły `500`/nieustrukturyzowana odpowiedź); przywróć
   — ma **zzielenieć**; `git diff` po przywróceniu **pusty**. Powtórz dla PRZYNAJMNIEJ DWÓCH z sześciu
   miejsc (różne pliki), żeby dowód objął rodzinę, nie próbkę.

**Wymagany dowód:** diff nowej klasyfikacji + diff sześciu opakowań (każde jako osobny, mały fragment
diffu, żeby dało się je policzyć) · diff `ConnectedAppsSettings.tsx` · dowód mutacyjny w obie strony dla
≥2 miejsc · potwierdzenie zero-zapisu do bazy przy odrzuceniu. Nowe pliki:
`server/src/routes/__tests__/day377.governed-connect-honesty.pg.test.ts`,
`tests/unit/components/settings/ConnectedAppsSettings.governedConnectHonesty.test.tsx`.
**Commit po `R3`.**

## R4 — PARA DOWODÓW, IZOLACJA CROSS-ORG (rdzeń)

1. **Para dowodów, w jednym pakiecie, przez realny `ApiGateway`+`supertest`, na realnym PostgreSQL**,
   dla co najmniej DWÓCH z sześciu tras (rekomendacja: #1 `POST /integrations/google_drive/connect` i
   #4 `POST /integrations/connect/google_drive`): (a) PRZED naprawą (albo na cofniętej mutacji) —
   `500`/nieustrukturyzowana odpowiedź, zapisana dosłownie; (b) PO naprawie — `501` z
   `{error,code:'GOVERNED_CONNECTOR_NOT_APPROVED'}`, treść komunikatu w raporcie.
2. **Izolacja cross-org**: user A (organizacja 1) i user B (organizacja 2), OBAJ bez zatwierdzenia w
   `OAUTH_APPROVED_PROVIDER_REGISTRY` dla `google_drive` (czyli identyczny, dzisiejszy stan), OBAJ wołają
   `POST .../connect` dla `google_drive` — obaj dostają `501` GOVERNED_CONNECTOR_NOT_APPROVED, i po OBU
   wywołaniach `SELECT count(*) FROM integrations WHERE organization_id IN (org1,org2)` daje **zero**
   nowych wierszy dla ŻADNEJ z dwóch organizacji (dowód, że komentarz „zatwierdzenie sprawdzane przed
   zapisem” jest prawdziwy, nie tylko obiecany).
3. **Ten sam mianownik**: lista pełnych nazw testów pakietu naprawy PRZED i PO (`Z37`) dla obu nowych
   plików testowych.

**Wymagany dowód:** para `500`/`501` z pełnymi odpowiedziami HTTP dla ≥2 tras · dowód zero-zapisu
cross-org z zapytaniem SQL i wynikiem · lista pełnych nazw testów. **Commit po `R4`.**

## R5 — ZRZUTY EKRANU PL/EN, RAPORT, PYTANIA DO WŁAŚCICIELA

1. **Dev-render**: dodaj `dev-render/screens/day377-governed-connect.tsx` (wzór:
   `dev-render/screens/ustawienia-grupy.tsx`) renderujący `ConnectedAppsSettings.tsx` z mockiem `Api`/`fetch`
   symulującym odpowiedź `501 GOVERNED_CONNECTOR_NOT_APPROVED` dla próby połączenia `teams` (formularz
   z `tenant_id`), zarejestruj w `dev-render/main.tsx`. Zrzuć ekran PO Twojej naprawie z `submitConnectModal`
   pokazującym `toast.error` z polskim komunikatem — PL i EN, jasny motyw (dodaj dark, jeśli starczy
   czasu, nie jest to warunek odbioru tego dyżuru). Zapisz do `evidence/governed-connect-20260905/day377/`.
2. Raport zawiera: tabelę sześciu miejsc wywołania z werdyktem reachable/martwe (`R1`) · łańcuch
   przyczynowy z liniami i cytatem `SET-MVP-OAUTH-001` (`R2`) · diff nowej klasyfikacji + sześciu
   opakowań + frontu (`R3`) · parę dowodów `500`/`501` + izolację cross-org (`R4`) · zrzuty ekranu ·
   **niepustą sekcję „TWIERDZENIA NIEZWERYFIKOWANE”** (na pewno zawiera: czy `OAUTH_APPROVED_PROVIDER_REGISTRY`
   jest skonfigurowana na stagingu/produkcji — NIEZMIERZONE; czy `jira`/`asana`/`gmail`/`slack` mają
   dziś skądkolwiek działającą ścieżkę do `pending_external_auth` poza `teams` — NIEZMIERZONE poza
   tym, co ustalono dla `jira`) · obowiązkowy akapit `§0.2e` dla każdego uruchomionego pakietu.

★★ **Osobna, obowiązkowa sekcja: „PYTANIA DO WŁAŚCICIELA”.** Musi zawierać co najmniej: (1) czy
`OAUTH_APPROVED_PROVIDER_REGISTRY` ma zostać kiedyś skonfigurowana dla `google_drive`/`onedrive`/`dropbox`
(co wymagałoby decyzji bezpieczeństwa/produktu poza `SET-MVP-OAUTH-001` i osobnego dyżuru), czy chmura
ma zostać na zawsze poza governed connect (skoro realny OAuth dla niej już działa gdzie indziej,
dyżur 369); (2) czy front dla `jira` ma zostać poprawiony, żeby zbierał `client_id`/`client_secret`
(dziś nigdy nie dociera do governed connect z powodu brakujących pól) — osobny, mniejszy dyżur; (3)
czy dwaj martwi wołacze (`UserIntegrations/index.tsx`, `NotificationChannelsSettings.tsx`) mają zostać
usunięci jako zdublowany, niepodłączony kod, czy kiedyś podłączeni. Sekcja **nie może być pusta**.

★ Zanim dopiszesz cokolwiek do jakiegokolwiek dokumentu, sprawdź, czy nie jest GENEROWANY:
`bash -c "grep -rl '<nazwa-pliku>' scripts/"`. Sekcję w `REJESTR_ZNALEZISK_20260903.md` dopisujesz o
**pierwszej wolnej literze** — na markerze to `AN` — sprawdź komendą
`bash -c "grep -nE '^## [A-Z]+\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"` **TUŻ PRZED
COMMITEM**, bo równolegle piszą inni autorzy tego samego dnia.

**Commit po `R5`.**

## Próg odbioru

**Trzy domknięcia: WSZYSTKIE sześć miejsc wywołania `buildGovernedExternalAuthSession` odpowiadają
ustrukturyzowanym, nie-`500` błędem (kod + polski komunikat) dla niezatwierdzonego konektora, bez
zmiany WARUNKU odmowy; `ConnectedAppsSettings.tsx` pokazuje ten błąd użytkownikowi zamiast go połykać;
korekta wagi (który przycisk jest reachable) zmierzona i zapisana z dowodem. Para dowodów
`500 przed / 501 po` i dowód izolacji cross-org (zero zapisanych wierszy) obowiązkowe w tym samym
commicie co `R4`.**

Odbiorca odrzuci dyżur, w którym: choćby jedno z sześciu miejsc nadal zwraca goły `500`; naprawa
zatwierdziła nowy konektor albo zmieniła `OAUTH_APPROVED_PROVIDER_REGISTRY`/warunek odmowy;
`materializeGovernedExternalAuthCallback` została zmieniona; front dla `jira` został „naprawiony” bez
zatrzymania się na pytaniu do właściciela; `reach` urósł o cokolwiek poza własnymi nowymi testami;
zmienił się stan choćby jednego wiersza macierzy odbioru.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „rodzina sześciu miejsc zmierzona,
trzy z sześciu naprawione (`settings.routes.ts` całość), front dla `teams` uczciwy, pozostałe trzy
(`integrations.routes.ts`, dwa miejsca `sync.routes.ts`) zatrzymane na decyzji o kształcie wspólnej
klasyfikacji” — **jest pełnowartościowym wynikiem**, nawet jeżeli nie wszystkie sześć miejsc doszły do
końca `R3`.

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: **sprawdzasz warunek NA
BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na zapamiętanym wyniku.** Wynik ponownego
sprawdzenia wklejasz do raportu z datą i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Napraw governed connect, żeby działał” vs „nie zatwierdzaj nowych konektorów” | `R0` (1) + `DLACZEGO`: naprawiasz KSZTAŁT błędu, nie WARUNEK — SET-MVP-OAUTH-001 zostaje w mocy |
| „`ConnectedAppsSettings.tsx` jest żywym ekranem” vs „naprawiasz trasę backendową, do której front nie dociera dla chmury” | `R1` pkt 3: korekta wagi — naprawiasz WSZYSTKIE sześć tras niezależnie od dzisiejszej reachability, bo bezpośrednie API i przyszłe UI też mają prawo do uczciwej odpowiedzi |
| „Trasa `integrations.routes.ts` ma już `try/catch`” vs „nadal 500-uje” | `R3` pkt 2: istniejący `catch` łapie wyłącznie `'Unknown connector:'`; dodajesz NOWĄ gałąź obok, nie zastępujesz |
| „Silnik zatwierdzeń jest nietykalny dla `materializeGovernedExternalAuthCallback`” vs „musisz zmienić plik, w którym on mieszka” | Tabela licencji: dodajesz NOWĄ, osobną funkcję; istniejące funkcje i ich inni wołacze zostają bez zmian |
| „`jira` jest w zatwierdzonej piątce” vs „front nigdy go tam nie prowadzi” | `R1` pkt 3 + `PULAPKA` (3): to jest OSOBNY, opisany defekt (brakujące pola we froncie), NIE naprawiasz go w tym dyżurze, idzie do pytań właściciela |
| „`reach` ma kończyć się 0” vs „na markerze jest już 1 (49 plików)” | Warunki wspólne serii: dopuszczalne pozostanie `1` z TYMI SAMYMI 49 plikami; niedopuszczalny jest wzrost poza Twoje własne testy |
| „Dopisz sekcję do rejestru znalezisk” vs „równolegle piszą inni autorzy tego samego dnia” | `R5`: literę sprawdzasz komendą tuż przed commitem; jeśli `AN` zajęte — bierzesz kolejną wolną i piszesz to w raporcie |
| „Dowód mutacyjny dla całej rodziny” vs „sześć miejsc to dużo par RED/GREEN” | `R3` pkt 4: mutacja obowiązkowa dla ≥2 miejsc (różne pliki), reszta udowodniona przez wspólną klasyfikację + statyczny diff, opisane wprost w raporcie jako ograniczenie |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 8 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — `pmSyncExternalAuthMaterializationService.ts:83-135,227-348`, `settings.routes.ts:1882-2024,2393-2470,2470-2560`, `integrations.routes.ts:168-260,693-793`, `sync.routes.ts:1059,1247`, `ConnectedAppsSettings.tsx:624-1078`, `oauthService.ts:114-136`, `integrationHubService.ts:188-219`, `asyncHandler.ts:13-22`, `auditsStrictMembership.middleware.ts:44-60`, `ErrorHandler.ts:213-330` — wszystkie odczytane; `evidence/governed-connect-20260905/day377/` **jawnie oznaczony jako nieistniejący** |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 9 wierszy; wszystkie zmierzone przy wydaniu na markerze, w tym `reach=1` z 49 plikami i pusta `OAUTH_APPROVED_PROVIDER_REGISTRY` |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP” | TAK — silnik zatwierdzeń · sześć tras · rejestr (odczyt) · front żywy · front martwy (odczyt) · nowe testy serwer/front · infrastruktura testów · middleware · słowniki · reachability baseline · dev-render · nowe dowody · macierz · rejestr znalezisk · raport · cudze tereny |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R1` czyta i odtwarza, `R2` pisze przyczynę, `R3` dodaje jedną funkcję + sześć małych opakowań + jeden front, `R4` mierzy parę dowodów, `R5` renderuje+składa |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — 6448/5588 wolne (`lsof` przy wydaniu), brak kontenera `cx-day377-pg`, brak gałęzi/worktree; rodzeństwo 367-376 ma rozłączne porty z tej samej puli zarezerwowanej na 05.09 |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z markera |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — `§0.2d` w komplecie; pułapki właściwe: sześć miejsc nie jedno, pusty `OAUTH_APPROVED_PROVIDER_REGISTRY` odrzuca też piątkę, `jira` nieosiągalny z UI, dwa formaty odpowiedzi błędu zależnie od harnessu, zero-zapis do zweryfikowania a nie zaufania |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany”, zero pól szablonu | TAK — kontrola generatora przy wydaniu |
