# INSTRUKCJA DYŻURU nr 377 — Codex — „★★★ GOVERNED_CONNECT — trzeci mechanizm łączenia integracji (`buildGovernedExternalAuthSession`, `server/src/services/v8/pmSyncExternalAuthMaterializationService.ts:227-344`) rzuca nieprzechwycony wyjątek `Governed external auth provider is not approved: <connectorId>` (`requireApprovedGovernedConnector:124-135`, rzut na liniach 128/133) dla KAŻDEGO konektora spoza zamrożonej piątki `jira,gmail,asana,teams,slack` (`GOVERNED_CONNECTOR_REQUIRED_SCOPES:110-116`) — w tym dla `google_drive`/`onedrive`/`dropbox`/`box` (rejestr `CONNECTORS` w `server/src/services/integrationHubService.ts:188-219`, wszystkie `authType:'oauth2'`, `configFields:[]`, więc `getPendingOnboardingStatus` w `server/src/routes/settings.routes.ts:1675-1689` zwraca natychmiast `pending_external_auth`) — a nawet dla samej zatwierdzonej piątki, GDY zmienna środowiskowa `OAUTH_APPROVED_PROVIDER_REGISTRY` (parsowana przez `getRegistryApprovalDecision`, `server/src/services/oauthService.ts:114-136`) jest niepusta i nie zawiera danego konektora — zmierzone: w tym środowisku dyżuru zmienna jest PUSTA, więc `requireApprovedGovernedConnector` odmawia WSZYSTKIEGO. Ten rzut przechodzi nieprzechwycony przez `asyncHandler` (`server/src/utils/asyncHandler.ts:13-22`, `.catch(next)`) do domyślnego obsłużenia błędu Express — na gołym `ApiGateway` (`Gateway.ts` NIE ma własnego error middleware, potwierdzone grepem) to surowe `500` z pustym/nieinformacyjnym ciałem (zmierzone niezależnie w dyżurze 369: `DAY369_GOVERNED_CONNECT_HTTP 500 {}`); na PEŁNYM serwerze (`server/src/index.ts:1747`, `errorHandlerMiddleware`, `server/src/utils/ErrorHandler.ts:213-330`) to ustrukturyzowane `500 {status:'error',error:{code:'INTERNAL_ERROR',message:'Something went very wrong!'}}` z prawdziwym komunikatem i stackiem WYŁĄCZNIE w logu serwera (`logger.error`, bo błąd nie jest `AppError` ani ma `statusCode`). ★★ KLUCZOWY DOWÓD DECYDUJĄCY O KIERUNKU NAPRAWY: komentarz w źródle (`pmSyncExternalAuthMaterializationService.ts:83-85`) mówi wprost — `SET-MVP-OAUTH-001 / AMD-SET-OAUTH-APPROVED-OUT-002: external OAuth is excluded from MVP. Every reachable consent-URL producer in this file must fail closed unless the connector is explicitly approved` — czyli SAMO odmawianie połączenia dla niezatwierdzonych konektorów jest ZAMIERZONĄ polityką bezpieczeństwa/produktu, NIE dziurą do załatania. Defektem tego dyżuru NIE jest to, że mechanizm odmawia — tylko to, że odmawia BRZYDKO (goły, nieczytelny `500`) zamiast uczciwie (kod błędu + polski komunikat). ★★ RODZINA: `buildGovernedExternalAuthSession` ma SZEŚĆ miejsc wywołania w `server/src/`, wszystkie bez przechwycenia tego konkretnego wyjątku: `settings.routes.ts:1921` (`POST /integrations/:provider/connect`), `settings.routes.ts:2441` (`POST /integrations/:provider/refresh`), `settings.routes.ts:2522` (`PUT /integrations/:provider/config`), `routes/integrations/integrations.routes.ts:217` (`POST /connect/:provider` i alias `POST /:provider/connect`, montowane pod `/api/integrations` w `Gateway.ts:807`), `routes/v8/sync.routes.ts:1059,1247` (dwa miejsca, v8 sync). ★★ KOREKTA WAGI (wzór dyżuru 369): z tych sześciu, JEDYNE potwierdzone jako wywoływane z REALNIE osiągalnego ekranu (`ConnectedAppsSettings.tsx`, ten sam ekran co w dyżurze 369) to `settings.routes.ts:1921`, i to WYŁĄCZNIE dla dostawcy `teams` (jedyny w katalogu frontu z `authType:'oauth2'` i niepustym `configFields` dopasowanym 1:1 do rejestru — `jira` ma w rejestrze DODATKOWE pola `client_id`/`client_secret` doklejane przez `getGovernedExternalAuthConfigFields` (linie 216-224), których front nigdy nie zbiera, więc `jira` nigdy nie osiąga `pending_external_auth`; `monday` ma `authType:'api_key'`, inna gałąź, nie wywołuje `buildGovernedExternalAuthSession`). Jedyny front wołający tę funkcję dla `google_drive`/`onedrive`/`dropbox` bezwarunkowo — `useUserIntegrations.ts:130-150` (`connect`) i `:210-230` (`refreshToken`) — ma ZERO żywych importerów: jedyny konsument (`UserIntegrations/index.tsx`) jest już w zaakceptowanym `reachability.baseline.json:475-476`. Podobnie martwy jest drugi konsument tej samej trasy, `NotificationChannelsSettings.tsx` (`connectChannel:138-142`, woła `POST /api/integrations/${channel}/connect`) — już w `reachability.baseline.json:1413`. Zakres tego dyżuru: uczciwe zamknięcie WSZYSTKICH SZEŚCIU miejsc wywołania jedną, współdzieloną klasyfikacją błędu (bez próby zatwierdzenia nowych konektorów — to złamałoby SET-MVP-OAUTH-001 i wymaga decyzji właściciela nad `OAUTH_APPROVED_PROVIDER_REGISTRY`, idzie do R5)"

Dokument samodzielny. Zakładam, że dostajesz **TYLKO ten plik** i repozytorium
Consultify. Nie masz dostępu do rozmowy, w której powstał, ani do instrukcji
poprzednich dyżurów. Wszystko, czego potrzebujesz, jest poniżej albo pod
wskazanymi ścieżkami w repo.

> ### ★★ ZAKAZ NR 1 — KATALOG WŁAŚCICIELA. CZYTASZ TO, ZANIM URUCHOMISZ COKOLWIEK.
>
> **Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani
> do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`,
> ani `git fetch`, ani `git worktree add`.
> To brudny checkout właściciela produktu i jest **NIETYKALNY**.
> Jedyny dozwolony kontakt z tą ścieżką to **symlink `node_modules` (odczyt)**
> wg `DEC-2026-08-26-86`.
>
> **★★ TO JEST NAJCZĘSTSZA PRZYCZYNA STRACONEJ GODZINY W TYM PROGRAMIE.**
> Instrukcja dyżuru 53 kazała wykonać `git fetch --all` i `git worktree add`
> „w root-repo" — wykonawca zrobił to w katalogu właściciela, `Z5` zablokowało
> pracę i dyżur stanął na STOP-ie, który nie miał prawa powstać.
> **Dlatego w `§0.1` masz PEŁNĄ, DOSŁOWNĄ procedurę worktree Z VAULTA.**
> Nie improwizuj jej i nie zastępuj „swoim sposobem". Twoje miejsce pracy to
> **wyłącznie** `/private/tmp/cx-day377-governed-connect`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `8f60ab998734adcdf61a080f4e1270c3dbdffceb`**
> **Gałąź bazowa: `github-backup/grafika/m03-20260902`**
> **Stan dokumentu: WYDANY**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo jakiekolwiek niewypelnione pole szablonu — **dokument nie
> jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.
> Ta ramka jest **jedynym** miejscem, w którym rozstrzyga się stan wydania.
> Objaśnienia w innych blokach cytowanych **nie** są powodem do STOP-u.

Data wystawienia: 2026-09-05.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.
Zakres: ****`15_SETTINGS`** (Połączone aplikacje, `ConnectedAppsSettings.tsx`) **+ konsekwencja dla `13_CHAT`** (menu „+” nawiguje tu przez `AddFilesMenu.tsx`, TYLKO ODCZYT w tym dyżurze). Rdzeń: zamknąć goły `500` trzeciego mechanizmu integracji (`pmSyncExternalAuthMaterializationService.ts`, wywoływany z sześciu tras w `settings.routes.ts`, `routes/integrations/integrations.routes.ts` i `routes/v8/sync.routes.ts`) jednym, uczciwym kodem błędu + polskim komunikatem, zgodnie z udokumentowaną w kodzie polityką `SET-MVP-OAUTH-001` (external OAuth poza MVP dla niezatwierdzonych konektorów). Produktem są trzy domknięcia: (1) wszystkie sześć miejsc wywołania `buildGovernedExternalAuthSession` odpowiada ustrukturyzowanym, nie-500 błędem, gdy konektor nie jest zatwierdzony (żaden ślepy `500`, żadne fałszywe „połączono”); (2) `ConnectedAppsSettings.tsx`, jedyny żywy front wołający tę ścieżkę (dla `teams`), pokazuje ten błąd użytkownikowi zamiast go połykać; (3) pomiar i pytanie do właściciela o to, czy `OAUTH_APPROVED_PROVIDER_REGISTRY` ma być kiedyś skonfigurowane dla chmury (`google_drive`/`onedrive`/`dropbox`), co wymagałoby osobnej decyzji produktowo-bezpieczeństwowej i osobnego dyżuru. Prawo zatrzymania PO KAŻDEJ pozycji `R`, z commitem, plik postępu `/private/tmp/cx-day377-postep.md` (POZA repo)**.
Trasy front: `RDZEŃ frontu: `src/components/settings/ConnectedAppsSettings.tsx` (WĄSKA LICENCJA: WYŁĄCZNIE `submitConnectModal` — fragment linii ok. `1069-1075`, „For OAuth providers with config: store config before redirecting” — dziś WYNIK `POST .../connect` jest ignorowany, `await fetch(...)` bez `if(!resp.ok)`; masz to naprawić tak, żeby błąd zatrzymywał redirect do `startOAuthFlow` i pokazywał `toast.error` z komunikatem z serwera. Reszta pliku, w tym `startOAuthFlow:877-901`, `handleConnect:906-926`, katalog `CATALOG` — TYLKO ODCZYT) · `src/hooks/useUserIntegrations.ts` (TYLKO ODCZYT — dowód drugiego, martwego wołacza) · `src/components/settings/UserIntegrations/index.tsx`, `IntegrationCard.tsx`, `src/components/settings/notifications/NotificationChannelsSettings.tsx` (TYLKO ODCZYT — oba już w zaakceptowanym `reachability.baseline.json`, dowód martwoty) · `dev-render/main.tsx` + NOWY `dev-render/screens/day377-governed-connect.tsx` (PEŁNA LICENCJA na R5, wzór: `dev-render/screens/ustawienia-grupy.tsx`). Reszta `src/**` TYLKO ODCZYT`. Trasy tył: `★★ RDZEŃ, SZEŚĆ MIEJSC WYWOŁANIA — WSZYSTKIE w zakresie naprawy (KROK 0, nie próbka). (a) `server/src/routes/settings.routes.ts:1921` wewnątrz `POST /integrations/:provider/connect` (trasa zaczyna się `:1882`, `willAttemptExternalAuth:1918-1919`); (b) `settings.routes.ts:2441` wewnątrz `POST /integrations/:provider/refresh` (trasa `:2393`); (c) `settings.routes.ts:2522` wewnątrz `PUT /integrations/:provider/config` (trasa `:2470`, `willAttemptExternalAuth:2519-2520`); (d) `server/src/routes/integrations/integrations.routes.ts:217` wewnątrz `connectGovernedConnectorIntegration` (`:168-260`), wołanej z `POST /connect/:provider` (`:693-720`, kanoniczna) i aliasu `POST /:provider/connect` (`:775+`) — montaż `/api/integrations` w `Gateway.ts:807`; UWAGA: ta funkcja JUŻ ma częściowy `try/catch` w wywołującej trasie (`:718-740`), ale łapie WYŁĄCZNIE komunikat `'Unknown connector:'` (mapowany na `404`) — komunikat „not approved” PRZELATUJE przez `throw error;` na końcu bloku catch, nienaruszony; (e)(f) `server/src/routes/v8/sync.routes.ts:1059` i `:1247` (dwa niezależne miejsca, v8 sync — TYLKO ODCZYT dla zrozumienia kontekstu wywołania, PEŁNA LICENCJA na dodanie identycznego przechwycenia). ★★ ŹRÓDŁO PRAWDY (silnik zatwierdzeń, WĄSKA LICENCJA — patrz TABELA LICENCJI): `server/src/services/v8/pmSyncExternalAuthMaterializationService.ts` — `GOVERNED_CONNECTOR_REQUIRED_SCOPES:110-116` (`jira,gmail,asana,teams,slack`), `requireApprovedGovernedConnector:124-135` (rzuca `Error('Governed external auth provider is not approved: ${connectorId}')` na liniach 128 i 133), `buildGovernedExternalAuthSession:227-344` (wywołuje `requireApprovedGovernedConnector` jako PIERWSZĄ linię, `:231`), `shouldMaterializeCallbackDrivenAuth:346-348` (osobna funkcja, tej samej piątki, używana przez callback — NIE dotykasz `materializeGovernedExternalAuthCallback:350+`, poza zakresem). `server/src/services/oauthService.ts:114-136`, `getRegistryApprovalDecision` — czyta `process.env.OAUTH_APPROVED_PROVIDER_REGISTRY` (JSON), zwraca `null` gdy zmienna pusta LUB konektor nieobecny/niekompletny w JSON-ie. `server/src/services/integrationHubService.ts:188-219` — rejestr `CONNECTORS` dla `google_drive`/`onedrive`/`dropbox`/`box`, wszystkie `authType:'oauth2'`, `configFields:[]`. `server/src/utils/asyncHandler.ts:13-22` (przechwytuje throw→`next`). `server/src/index.ts:1747`, `server/src/utils/ErrorHandler.ts:213-330` (`errorHandlerMiddleware`, TYLKO na pełnym serwerze — `Gateway.ts` sam go NIE montuje)`.

---

### 0.1. ★★ BAZA PRACY, MARKER I GAŁĄŹ — PROCEDURA DOSŁOWNA, Z VAULTA

**Repozytorium, z którego pracujesz, to BARE-vault, a nie checkout właściciela:**

```
/Users/piotrwisniewski/Developer/consultify-recovery-vault-20260820.git
```

Vault ma `extensions.worktreeConfig=true`. **To ma konsekwencję operacyjną,
którą MUSISZ obsłużyć — krok (4).**

**PIERWSZE KOMENDY DYŻURU — wklej dokładnie tak, po kolei:**

```bash
VAULT=/Users/piotrwisniewski/Developer/consultify-recovery-vault-20260820.git
WT=/private/tmp/cx-day377-governed-connect
MARKER=8f60ab998734adcdf61a080f4e1270c3dbdffceb

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/grafika/m03-20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day377-governed-connect-20260905 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day377-governed-connect/config.worktree"
cat "$VAULT/worktrees/cx-day377-governed-connect/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day377-governed-connect-scratch
mkdir -p /private/tmp/cx-day377-governed-connect-artefakty

# (7) sanity
git -C "$WT" rev-parse HEAD
git -C "$WT" status --short | head -3
```

**Wynik komend (2) i (7) wklejasz do raportu dosłownie.**

> **★★ PUŁAPKA — REMOTE `icloud-source` JEST MARTWY.**
> Vault ma trzy remote'y: `github-backup` (żywy, jedyny Twój),
> `origin` (**zakazany do pushu**, `Z1`) i `icloud-source`, wskazujący na
> nieistniejący katalog `/private/tmp/consultify-staging-deploy-e6ca`.
> **Dlatego NIE WOLNO Ci wołać `git fetch --all`.**
> **Błąd `icloud-source` przy jakimkolwiek fetchu NIE JEST negatywnym wynikiem
> markera i NIE JEST powodem do STOP-u.** Jedynym negatywnym wynikiem markera
> jest napis `MARKER BRAK` z komendy `merge-base` powyżej.

**★★ REGUŁA ROZEJŚCIA (`DEC-2026-08-26-95`).**
Jeżeli marker **nie jest** przodkiem tipa albo gałąź nie istnieje — **STOP
całego dyżuru**. Nie improwizujesz bazy: nie startujesz z `origin/demo`,
`main`, `Londyn`, `codex/preserve-*`, `codex/day*-instrukcja-*` ani z żadnej
gałęzi cudzych dyżurów.

Jeżeli marker **JEST** przodkiem, ale **tip uciekł do przodu — to NIE jest
STOP**. Startujesz **dokładnie z markera**, a do raportu wpisujesz:

```bash
git -C "$VAULT" log --oneline 8f60ab998734adcdf61a080f4e1270c3dbdffceb..github-backup/grafika/m03-20260902
git -C "$VAULT" diff --name-only 8f60ab998734adcdf61a080f4e1270c3dbdffceb..github-backup/grafika/m03-20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day377-governed-connect-20260905
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 8f60ab998734adcdf61a080f4e1270c3dbdffceb..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `jedenaście` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) ★★★ TEZA A: rejestr piatki zatwierdzonych konektorow + funkcja rzucajaca
sed -n '108,135p' server/src/services/v8/pmSyncExternalAuthMaterializationService.ts
#   moje liczby: GOVERNED_CONNECTOR_REQUIRED_SCOPES (110-116) ma dokladnie piec kluczy:
#   jira,gmail,asana,teams,slack; requireApprovedGovernedConnector (124-135) rzuca
#   'Governed external auth provider is not approved: ${connectorId}' na liniach 128 i 133
#   dla kazdego connectorId spoza tej piatki ORAZ gdy getRegistryApprovalDecision zwroci null.

# (2) ★★★ TEZA B: polityka SET-MVP-OAUTH-001 udokumentowana w kodzie ZANIM napiszesz naprawe
sed -n '80,109p' server/src/services/v8/pmSyncExternalAuthMaterializationService.ts
#   moje liczby: komentarz (83-85) mowi wprost 'external OAuth is excluded from MVP' —
#   to rozstrzyga wybor z R3 na rzecz 'uczciwe wylaczenie', NIE 'przywroc dzialanie'.

# (3) ★★★ TEZA C: OAUTH_APPROVED_PROVIDER_REGISTRY jest PUSTA w tym srodowisku
bash -c "env | grep -i OAUTH_APPROVED_PROVIDER_REGISTRY"
sed -n '108,136p' server/src/services/oauthService.ts
#   moje liczby: zmienna nieustawiona (pusty wynik grep) -> getRegistryApprovalDecision
#   zwraca null dla KAZDEGO klucza -> odmawia rowniez zatwierdzonej piatce w tym srodowisku.

# (4) ★★★ TEZA D: rejestr CONNECTORS — google_drive/onedrive/dropbox/box maja puste configFields
bash -c "grep -n \"google_drive:\|onedrive:\|dropbox:\|box:\|authType:\|configFields:\" server/src/services/integrationHubService.ts" | sed -n '1,40p'
#   moje liczby: google_drive:188, onedrive:196, dropbox:204, box:212 — wszystkie
#   authType:'oauth2', configFields:[] -> hasAllRequiredFields zawsze true.

# (5) ★★★ TEZA E — RODZINA: SZESC miejsc wywolania buildGovernedExternalAuthSession w server/src
bash -c "grep -rn 'buildGovernedExternalAuthSession(' server/src --include='*.ts' | grep -v '__tests__\|export function'"
#   moje liczby: 6 trafien — settings.routes.ts:1921,2441,2522; integrations.routes.ts:217;
#   sync.routes.ts:1059,1247. Zero z nich ma try/catch dedykowany komunikatowi 'not approved'
#   (integrations.routes.ts:718-740 lapie WYLACZNIE 'Unknown connector:').

# (6) TEZA F — KOREKTA WAGI: ktory z szesciu jest zywy z ConnectedAppsSettings.tsx
bash -c "grep -n \"id: 'jira'\|id: 'teams'\|id: 'monday'\|id: 'google_drive'\|id: 'onedrive'\|id: 'dropbox'\|configFields:\|authType:\" src/components/settings/ConnectedAppsSettings.tsx" | sed -n '1,30p'
sed -n '1003,1078p' src/components/settings/ConnectedAppsSettings.tsx
#   moje liczby: jedynym dostawca frontu z authType oauth2 + configFields niepuste I ZGODNE
#   z rejestrem (bez dodatkowych pol jak jira) jest 'teams' (configFields:['tenant_id']) ->
#   jedyna zywa sciezka do buildGovernedExternalAuthSession z tego ekranu.

# (7) TEZA G: dwaj martwi wolacze tej samej trasy dla google_drive/onedrive/dropbox
bash -c "grep -rln 'UserIntegrations' src/ --include='*.tsx'"
bash -c "grep -n 'UserIntegrations\|NotificationChannelsSettings' docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json"
#   moje liczby: UserIntegrations/index.tsx i IntegrationCard.tsx juz w baseline (linie ok.
#   475-476); NotificationChannelsSettings.tsx juz w baseline (linia ok. 1413) — oba martwe,
#   ZASTANE, nie Twoje nowe odkrycie.

# (8) asyncHandler przechwytuje throw synchroniczny -> next(err); Gateway.ts bez error middleware
sed -n '1,22p' server/src/utils/asyncHandler.ts
bash -c "grep -n 'errorHandler\|app.use((err' server/src/Gateway.ts" || echo "BRAK w Gateway.ts (oczekiwane)"
#   moje liczby: asyncHandler .then().catch(next) potwierdzony; grep w Gateway.ts PUSTY.

# (9) requireActiveAuditsMembership — kontrakt testu pg
sed -n '44,60p' server/src/middleware/auditsStrictMembership.middleware.ts
#   moje liczby: SELECT status FROM organization_members WHERE user_id=? AND organization_id=?;
#   active = status.toUpperCase()==='ACTIVE'.

# (10) zasoby: dysk, porty, kontener
df -h /
lsof -nP -iTCP:6448 -sTCP:LISTEN; lsof -nP -iTCP:5588 -sTCP:LISTEN
docker ps -a --format '{{.Names}}' | grep -c cx-day377 || true
#   oczekiwane przy wydaniu: >20 GB wolnego; oba porty puste; 0 kontenerow.

# (11) leaves slownikow, bramki kanonu, rejestr — na markerze
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
bash -c "grep -nE '^## [A-Z]+\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"
#   moje liczby: pl 35294, en 33154; focus=0, list=0, artefakt=0, reach=1 (49 zastanych
#   plikow test-only, w tym CloudDataSettings.tsx z dyzuru 369 — nie Twoja przyczyna);
#   ostatnia litera rejestru AM (dyzur 373) -> nastepna wolna AN.
```

---

### §0.4a — pomiar zasięgu testów (warunek oddania raportu, patrz `Z24`)

Zanim ogłosisz jakikolwiek wynik testów, zmierz zasięg PEŁNYMI NAZWAMI, nie liczbami:

1. PRZED zmianami produktu: uruchom pakiet(y) testów wskazane w licencji z
   `--reporter=json` (albo zapisz listę `describe/it` z wyjścia) i zapisz do
   artefaktów plik `przed-nazwy.txt` — po jednej PEŁNEJ nazwie testu na wiersz.
2. PO zmianach: to samo do `po-nazwy.txt`.
3. Do raportu wchodzi: `diff przed-nazwy.txt po-nazwy.txt` — nazwy DODANE (twoje
   nowe testy) i nazwy ZNIKNIĘTE (każda zniknięta = wyjaśnienie albo STOP).
   `N passed` bez nazw NIE jest pomiarem. „Ta sama liczba" przy innym składzie
   nazw to fałszywa zieleń (Z37).
4. Przepisanie liczby z instrukcji, cudzego raportu albo rejestru = zawyżenie
   i podstawa odrzucenia raportu. Liczysz sam, u siebie, na swojej bazie.

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day377-governed-connect-20260905` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6448`. Twój JEDYNY port harnessu to `5588`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day377-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta restricted ports Chromium. Zajęte przez hosta i tor grafiki: 3020-3030, 5432, 5433, 6379. Rodzeństwo paczki 05.09 (367-376) — nie dotykasz: 367 (6438/5578), 368 (6439/5579), 369 (6440/5580), 370 (6441/5581), 371 (6442/5582), 372 (6443/5583), 373 (6444/5584), 374 (6445/5585), 375 (6446/5586), 376 (6447/5587). Twoje własne wyłącznie: baza **6448**, harness **5588**. ★ ZAKAZ `pkill`/`killall` — zabijasz wyłącznie własne PID-y (zapisz `$!`)`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `BRAK NOWYCH FLAG. Ten dyżur nie dodaje ani jednej flagi funkcyjnej i nie zmienia wartości domyślnej żadnej istniejącej. To jest naprawa DEFEKTU POTWIERDZONEGO (goły `500` zamiast uczciwej odmowy) — zmienia się WYŁĄCZNIE kształt ODPOWIEDZI BŁĘDU sześciu tras backendowych i sposób, w jaki `ConnectedAppsSettings.tsx` pokazuje ten błąd. Zachowanie POWODZENIA (dla zatwierdzonych konektorów, gdy `OAUTH_APPROVED_PROVIDER_REGISTRY` kiedyś zostanie skonfigurowany) NIE zmienia się. Jeżeli komunikat błędu w UI wymaga nowego elementu wizualnego (np. inline banner zamiast toastu) — dodajesz najprostszy istniejący wzorzec (`toast.error`, już używany w tym pliku), nie nowy komponent, więc flaga nie jest wymagana`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh --ci`, `scripts/check-artefakt.sh`, `scripts/dev/reachability-from-root.mjs`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`, `server/src/middleware/auth.middleware.ts`, `server/src/middleware/auditsStrictMembership.middleware.ts`, `server/src/services/ApiGateway.ts`, `server/src/Gateway.ts`, `server/src/services/oauthService.ts`, `public/locales/**`. Wszystkie **NIETYKALNE DO ZAPISU** w tym dyżurze — wolno je wołać/czytać w pomiarze`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY377_GOVERNED_CONNECT_REPORT.md`. Jedyne inne dokumenty do zmiany: **jedna nowa sekcja** w `docs/program/REJESTR_ZNALEZISK_20260903.md` o PIERWSZEJ WOLNEJ literze — na markerze ostatnia użyta to **`AM`** (dyżur 373), więc następna to **`AN`** (★ sprawdzasz komendą `bash -c "grep -nE '^## [A-Z]+\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"` TUŻ PRZED COMMITEM, bo równolegle piszą inni autorzy tego samego dnia — jeżeli `AN` zajęte, bierzesz kolejną wolną i piszesz to w raporcie) — oraz nowe pliki dowodowe pod `evidence/governed-connect-20260905/day377/` (katalog NIE ISTNIEJE na markerze — tworzysz go). Plik postępu `/private/tmp/cx-day377-postep.md` żyje POZA repo. ★★★ **MACIERZ ODBIORU JEST NIETYKALNA W TYM DYŻURZE** — żaden wiersz `G00`–`G20`, żaden moduł, w tym `13_CHAT` i `15_SETTINGS`. Jeżeli `reachability-from-root.mjs --check-baseline` odmówi z powodu Twoich NOWYCH plików testowych — wolno Ci `--update-baseline`, WYŁĄCZNIE gdy jedyną różnicą są TWOJE nowe pliki (skrypt i tak odmawia, jeśli zbiór `unreachable`/`test-only` się powiększy o coś INNEGO niż Twoje). Nowe pliki w `tests/` i `server/src/**/__tests__/` wymagają `git add -f`. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day377-governed-connect-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
| `Z14` | **Nie zmieniasz `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md`** i nie podważasz decyzji w kodzie. Uważasz, że decyzja się myli → **errata w raporcie** | SSOT decyzji właściciela |
| `Z15` | **Zero modelu językowego w tym dyżurze.** Żaden pomiar, strażnik ani ekran nie woła `llmService`, `/api/ai/**` ani `GoogleGenerativeAI` | `DEC-51` — zakaz atrapy AI; bezpieczeństwo nie ma prawa zależeć od sieci |
| `Z16` | **Nie usuwasz i nie „naprawiasz" uczciwych stanów pustych, `503 not_configured`, `null`, `UNKNOWN` ani nagrobków `410`** | „Zero placebo i atrap"; uczciwy `503` jest wzorcem POPRAWNYM |
| `Z17` | **Zakaz wszystkiego poza zakresem tego dyżuru** — z imiennymi licencjami z tabeli licencji | Podział front/tył i rozłączność z dyżurami równoległymi |
| `Z18` | **★★ NAJOSTRZEJSZY — ABSOLUTNY zakaz modyfikowania globalnej infrastruktury testowej:** `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest.config.ts`, każdy `vitest.*.config.ts`, `server/vitest.config*.ts`, `tests/integration/_helpers/assertRealPostgres.ts` | Jedna zmiana globalnego mocka fałszuje wynik całego korpusu |
| `Z19` | **Nie odmontowujesz i nie kasujesz żadnego routera, middleware ani joba CI zamontowanego dziś** | Odmontowanie trasy potrafi zabić ekran, którego nie mierzysz; bramki znikają łatwiej, niż wracają |
| `Z20` | **★★ ZAKAZ uruchamiania testów DB bez jawnego kompletu env wskazującego kontener TEGO dyżuru, W TEJ SAMEJ LINII komendy.** Kolejność BLOKU 0 jest wiążąca: **NAJPIERW kontener + pełne migracje, DOPIERO potem jakikolwiek pomiar** | Trzy incydenty zapisu do cudzej bazy |
| `Z21` | **DoD wymaga DOWODU OSIĄGALNOŚCI, nie istnienia pliku** (`DEC-2026-08-26-104`). Pełna ścieżka: realne wejście HTTP → realny `ApiGateway` → `verifyToken` → trasa → handler → zapytanie → **wiersz w Twojej bazie** → odczyt, który ten wiersz podnosi → konsument w `src/` **albo jawne zdanie „brak konsumenta"** | Istnienie kodu ≠ działanie |
| `Z22` | **★★ Test wstrzykujący zależności albo montujący router w gołym `express()` NIE dowodzi ścieżki produkcyjnej** (`DEC-2026-08-26-107`). Dowodem jest `ApiGateway.getInstance().initializeRoutes(app)` | Replika rozjeżdża się z produkcją i nikt tego nie zauważa |
| `Z23` | **★★ ZERO ATRAP.** `200` z pustą kopertą tam, gdzie zapytanie padło, jest atrapą. `0` tam, gdzie wartość jest nieznana, jest atrapą. Ekran, który zapisuje do magazynu, którego nikt nie czyta, jest atrapą. Przycisk bez trasy jest atrapą | `DEC-2026-08-25-21/22`, `DEC-51` |
| `Z24` | **Pomiar zasięgu testów wg `§0.4a` jest warunkiem oddania raportu.** Zawężony wybór albo **przepisanie cudzej liczby** = zawyżenie i podstawa odrzucenia | Liczby autora instrukcji i nadzorcy krążą po dokumentach i utrwalają się jako „fakt" |
| `Z25` | **★★ Testy realdb WYŁĄCZNIE z jawnym `DATABASE_URL` wskazującym Twój efemeryczny kontener.** `tests/setup.ts` ma bezpiecznik i rzuca błędem zamiast fallbacku | **Port `5432` NASŁUCHUJE i nie jest Twój** — fallback = zapis do cudzych danych |
| `Z26` | **★★ Komplet env w tej samej linii — patrz `§0.2c`.** Bez `MOCK_DB=false` odczyty idą cicho na atrapę bazy; bez `ENABLE_V8_GLOBAL=true` część tras daje `404` **przed uwierzytelnieniem**; bez `ENABLE_TEST_AUTH_BYPASS=false` `verifyToken` **jest omijany** | Tak zginął dzień 23 |
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day377-governed-connect-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
| `Z28` | **★★ ZERO POŁĄCZEŃ DO RAILWAY, DEMO, STAGINGU I PRODUKCJI — w każdą stronę i każdym narzędziem.** Zakaz obejmuje `railway` CLI, `psql`/`docker exec psql` do hosta innego niż `127.0.0.1`, `curl`/`wget`/`fetch` do `*.railway.app`, `demo.consultify.ai`, `consultify.ai`, `staging.*` | Produkcja NIETYKALNA; demo i staging są jedną bazą. **To jedyny zakaz, którego naruszenie zatrzymuje CAŁY dyżur** |
| `Z29` | **★★ Testy o kształcie „atak odrzucony + readback bez zmian" MUSZĄ biec BEZ PONAWIANIA: `--retry=0` w KAŻDEJ komendzie** i `retry: 0` w opcjach `describe`/`it`, jeśli plik je ustawia | **Historycznie** `vitest.config.ts` ustawiał `retry: CI ? 3 : 1` i to unieważniało całą rodzinę testów izolacji: przy otwartej dziurze pierwszy przebieg realnie zmieniał stan, asercja padała, Vitest ponawiał — i test **raportował `PASS` mimo otwartej dziury** (dowód: `tests/integration/_retrymask/`, archetyp dyżuru 42). **Stan na 04.09: `vitest.config.ts:339` ustawia `retry: 0`, a `server/vitest.config.ts` nie ustawia `retry` wcale.** Zakaz zostaje w mocy — dotyczy `--retry=N` w CLI i `retry` w opcjach `describe`/`it` — ale **nie szukaj tu przyczyny niestabilności**: ponowień w konfiguracji już nie ma |
| `Z30` | **★★ ZAKAZ REALNEJ WYSYŁKI E-MAILI, ZAPROSZEŃ KALENDARZOWYCH I POWIADOMIEŃ.** Przed pierwszym przebiegiem zapisującym **udowodnij w raporcie**, że dostawca poczty jest atrapą — protokół `§0.2b` | Wysłany e-mail i zaproszenie kalendarzowe są **nieodwracalne** i trafiają do skrzynek osób trzecich |
| `Z31` | **★★ ZAKAZ PRZYPINANIA STRAŻNIKA TESTU REALDB DO HOSTA, PORTU ALBO NAZWY BAZY.** Wołasz `await assertRealPostgresTestEnvironment()` **BEZ ARGUMENTÓW**, w szczególności bez `expectedDatabase` | Dyżur 43 przypiął strażnik do swojej bazy: po usunięciu kontenera **30 przypadków dowodowych stało się trwałym `SKIP`**, pakiet raportuje `exit 0` i wygląda jak sukces |
| `Z32` | **★★ ZAKAZ WPISU `FIXED` / `VERIFIED` / `ZROBIONE_WG_DoD` BEZ DOWODU MUTACYJNEGO W OBIE STRONY.** Psujesz kod produkcyjny → test **CZERWONY**; cofasz → test **ZIELONY**; `git diff` po cofnięciu **pusty**. Obie komendy i oba wyniki dosłownie w raporcie. Mutację cofasz przez `cp` (`Z27`), nigdy `git stash` | Dyżur 44 wpisał `FIXED` dla podatności, **która nigdy nie istniała** — test przechodził także przed zmianą, bo asercja była tautologią |
| `Z33` | **★★ PRZED KAŻDYM POMIAREM SPRAWDZASZ, CZY STRAŻNIK, KTÓRY MIERZYSZ, NIE WYŁĄCZA SIĘ SAM W TRYBIE TESTOWYM** — ramka `§0.2d` | Na `resultsInternalBetaVisibility.middleware.ts` zmierzono **416 fałszywych twierdzeń** o uprawnieniach jednego modułu |
| `Z34` | **★★ GREP DOWODZI, ŻE ŁAŃCUCH ISTNIEJE, NIE ŻE DZIAŁA.** Zdanie „działa" wolno Ci napisać wyłącznie po realnym żądaniu HTTP przez realny `ApiGateway`, z podpisanym JWT, na realnym Postgresie po pełnych migracjach — **i po zapisaniu KODU ODPOWIEDZI** | 28.08 w module kalendarza zmierzono kompletny łańcuch komponent → `fetch` → trasa → handler → `INSERT`. **Każdy realny `POST` zwracał `500`**, bo `req.db` nigdy nie było ustawiane w tej gałęzi montażu |
| `Z34a` | **★★ PO PIERWSZYM COMMICIE ROBISZ PUSH NA `github-backup`**, a potem po każdej pozycji | 28.08 trzy dyżury pracowały cały dzień bez kopii zapasowej |
| `Z35` | **Zakaz „naprawiania" przez wyciszanie:** `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `.skip`, `.todo`, poszerzanie `exclude`/`testIgnore`, obniżanie progów pokrycia, `--max-warnings`, `continue-on-error: true` na jobie testowym. Uznajesz to za jedyne wyjście → **STOP z uzasadnieniem**, nie cichy commit | To jest choroba, którą program leczy, a nie narzędzie do jej leczenia |
| `Z36` | **Zakaz `eslint --fix` i `prettier --write` na czymkolwiek szerszym niż plik, który i tak zmieniasz z innego powodu.** Zakaz `--fix` na katalogu, na `.`, na globie | Autofix dotknąłby tysięcy plików i skasował pracę **wszystkich** równoległych dyżurów |
| `Z37` | **Porównania testów po NAZWACH przypadków (`fullName`), NIGDY po liczbach.** „Było 300 PASS, jest 300 PASS" nie jest dowodem — jeden test mógł zgasnąć, a drugi się zapalić | Wektor maskowania regresji |
| `Z38` | **Zakaz usuwania i odmontowywania jakiegokolwiek joba CI.** Wolno dodać, wolno poprawić warunek. Usunięcie = STOP z rekomendacją | Bramki znikają łatwiej, niż wracają |
| `Z39` | **Zakaz uruchamiania realnych workflow GitHub Actions** — `gh workflow run`, `gh run rerun`, `act` z realnymi sekretami, push wyzwalający CI na `main`/`develop`/`Londyn`/`demo`. Dowód robisz **statycznie** | Realny przebieg CI dotyka sekretów i środowisk poza Twoją kontrolą |
| `Z40` | ★★★ **ZAKAZ ZATWIERDZANIA NOWYCH KONEKTORÓW.** Nie dopisujesz `google_drive`/`onedrive`/`dropbox`/`box` do `GOVERNED_CONNECTOR_REQUIRED_SCOPES`, nie ustawiasz `OAUTH_APPROVED_PROVIDER_REGISTRY`, nie zmieniasz `requireApprovedGovernedConnector`/`buildGovernedExternalAuthSession` tak, żeby przepuszczały niezatwierdzony konektor — to złamałoby udokumentowaną w kodzie politykę `SET-MVP-OAUTH-001` (komentarz `pmSyncExternalAuthMaterializationService.ts:83-85`). Naprawiasz WYŁĄCZNIE KSZTAŁT ODPOWIEDZI BŁĘDU (goły `500` → ustrukturyzowany kod + polski komunikat), nigdy WARUNEK odmowy. ★★★ **ZAKAZ ZMIANY KONTRAKTU `requireApprovedGovernedConnector`/`buildGovernedExternalAuthSession` DLA ICH INNYCH WOŁACZY.** `requireApprovedGovernedConnector` jest też wywoływana przez `materializeGovernedExternalAuthCallback` (`:367`, obsługa callbacku OAuth) — TA ścieżka ma zostać dokładnie taka jak dziś (nadal rzuca, fail-closed); Twoja naprawa dotyka WYŁĄCZNIE sześciu tras HTTP wypisanych w `TRASY_TYL`, przez DODANIE osobnej, nie-rzucającej klasyfikacji/przechwycenia PRZED lub WOKÓŁ wywołania, nie przez zmianę samej funkcji zatwierdzającej. ★★★ **ZAKAZ MIESZANIA Z BŁĘDEM „Unknown connector”.** `routes/integrations/integrations.routes.ts:718-740` ma już poprawną obsługę dla nieznanego konektora (`404`) — Twoja zmiana ma dodać ROZRÓŻNIENIE dla „not approved”, nie nadpisywać istniejącej gałęzi `404`. ★★ **ZAKAZ NAPRAWY `ConnectedAppsSettings.tsx` DLA `jira`/`monday`.** `jira` nigdy nie osiąga `pending_external_auth` z powodu brakujących pól (`client_id`/`client_secret`) — to ODDZIELNY, nieopisany w tym dyżurze defekt (front nigdy nie zbiera tych pól); zmierz i zapisz jako TWIERDZENIE NIEZWERYFIKOWANE/pytanie, NIE naprawiaj w tym dyżurze (poszerzenie licencji ponad `submitConnectModal`). `monday` (api_key) nie wywołuje `buildGovernedExternalAuthSession` — poza zakresem. ★ **ZAKAZ `.skip`, `.todo`, `--retry` innego niż `0`, poszerzania `exclude`, zmiany oczekiwanego kodu odpowiedzi w istniejącej asercji** (`Z35`). **ZAKAZ porównania po liczbach** (`Z37`) — pełne nazwy testów przed/po | Bo trzeci mechanizm integracji ma w kodzie WŁASNY, udokumentowany, zamierzony powód odmowy (SET-MVP-OAUTH-001 — OAuth zewnętrzny poza zakresem MVP dla niezatwierdzonych konektorów) — ale realizuje tę odmowę w sposób, który wygląda jak awaria: goły `500`, bez kodu błędu, bez komunikatu, w sześciu miejscach naraz. To dokładnie różnica między „funkcja nie istnieje” a „funkcja istnieje i POPRAWNIE odmawia, ale robi to nieuczciwie” — trzeci kształt fałszywego stanu z korpusu Consultify (`docs/program/...`, patrz też pamięć `flaga-off-w-kodzie-nie-znaczy-wylaczona`). Naprawa jest tania: nie trzeba włączać ani jednego nowego dostawcy, trzeba tylko przestać ujawniać wewnętrzny wyjątek klientowi jako `500` i zacząć odpowiadać kodem błędu, który front może pokazać człowiekowi |

---

### 0.2b. ★★ PROTOKÓŁ `Z30` — ZERO WYSYŁKI, A MIMO TO PEŁNY DOWÓD

**(1) Czego NIE WOLNO Ci zrobić — nigdy:**
- ★ **UWAGA — SPROSTOWANIE 2026-08-30.** Ten szkielet wymieniał tu wcześniej
  przełącznik `ENABLE_LIVE_EMAIL`. **Taka flaga NIE ISTNIEJE w kodzie** — `grep`
  po całym `server/src` i `src` daje zero trafień. Był to fantom, powielany
  w każdej wydanej instrukcji. **Nie szukaj go i nie raportuj, że jest wyłączony.**
  Realny warunek wysyłki jest inny i opisany w punkcie (2) poniżej: poczta wychodzi
  wyłącznie wtedy, gdy `emailService.ts:202` zobaczy **jednocześnie** `smtpConfig.host`
  i `smtpConfig.auth.user`, sklejone **najpierw z tabeli `settings`**, dopiero potem
  ze zmiennych środowiskowych. Bez tych dwóch wartości serwis pisze na konsolę;
- ustawić `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_PORT`, `SMTP_FROM`
  w środowisku, w `.env*`, w `docker-compose*` ani nigdzie indziej;
- wstawić wiersza konfiguracji SMTP do tabeli ustawień w swojej bazie;
- uruchomić serwera pełnym `server/src/index.ts` **na potrzeby testów** — tam
  startują drenaże outboxów; testy montują `ApiGateway`, nie cały serwer
  (`Z22`);
- uruchomić `server/src/index.ts` na potrzeby zrzutów inaczej niż przez
  kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs` i bez spełnienia
  wszystkich warunków z punktu (4) poniżej;
- wywołać ręcznie żadnej funkcji `drain*` / `startNotificationOutboxDrainCron`
  / `outboxWorker`.

**(2) Trzy dowody, które wklejasz do raportu ZANIM uruchomisz cokolwiek
zapisującego:**

```bash
cd /private/tmp/cx-day377-governed-connect

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day377-pg psql -U postgres -d cx377 \
  -c "SELECT key, left(coalesce(value,''),8) FROM settings WHERE key LIKE 'smtp%';"
#   oczekiwane: 0 wierszy. Jezeli tabela `settings` nie istnieje — wklej TEN blad,
#   to tez jest dowod (nie ma skad wziac konfiguracji poczty).

# (c) dla TESTOW: zaden drenaz outboxu nie dziala w procesie testowym
grep -n "startNotificationOutboxDrainCron\|outboxWorker\|platformOutboxDrainCron" server/src/Gateway.ts
#   oczekiwane: 0 trafien — drenaze startuja w server/src/index.ts, ktorego NIE uruchamiasz
```

**(3) Deklaracja obowiązkowa dla TESTÓW w raporcie, dosłownie:**
**„Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani
żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało
wysłane."**

**(4) Wyjątek wyłącznie dla ZRZUTÓW ODBIOROWYCH — pełny produkt, nie replika.**
Pełny `server/src/index.ts` wolno uruchomić wyłącznie przez kanoniczny
`scripts/dev/start-wave3-owner-runtime.mjs`, po wykonaniu dowodów (a) i (b),
oraz tylko gdy wszystkie poniższe warunki są spełnione imiennie:

- runtime pracuje wyłącznie na efemerycznej lokalnej bazie dyżuru pod
  `127.0.0.1`, na zasobach przydzielonych w instrukcji; nie wolno adoptować
  bazy zawierającej jakikolwiek klucz `smtp%`;
- środowisko procesu serwera pochodzi z `childEnv(...)`, ma
  `DOTENV_DISABLED='1'` i nie zawiera `SMTP_*`, `RESEND`, `SENDGRID` ani
  `MAIL*`; trzeba to potwierdzić dla uruchomionego procesu, nie tylko dla
  powłoki wywołującej;
- zapytanie z dowodu (b), wykonane po wszystkich migracjach i seedach, zwraca
  `0` wierszy bezpośrednio przed startem runtime'u;
- nie ustawiasz flag drenaży na `true`, nie wywołujesz żadnego drenażu ręcznie
  i nie wykonujesz żadnej operacji, która tworzy wiadomość, zaproszenie lub
  powiadomienie; runtime służy wyłącznie do odczytu i wykonania zrzutów;
- po starcie ponownie sprawdzasz środowisko należącego do Ciebie procesu oraz
  log serwera. Trafienie konfiguracji poczty, próby realnego transportu albo
  niejednoznaczność dowodu oznacza natychmiastowe zatrzymanie runtime'u i STOP
  całego dyżuru (`Z30`).

Brak konfiguracji nie wyłącza samych drenaży: w runtime z realną bazą startują
one domyślnie. Ochroną jest fail-closed protokół powyżej — `emailService`
tworzy realny transporter dopiero przy jednoczesnej obecności hosta i
użytkownika SMTP; bez nich pozostaje atrapą konsolową. Dowody (a) i (b)
obowiązują zatem zarówno testy, jak i zrzuty odbiorowe.

**Deklaracja obowiązkowa dla ZRZUTÓW ODBIOROWYCH w raporcie, dosłownie:**
**„Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Uruchomiłem `server/src/index.ts` wyłącznie
przez kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs`, na lokalnej bazie
dyżuru, tylko w celu wykonania zrzutów. Zweryfikowałem środowisko procesu i log
serwera zgodnie z `§0.2b` (4). Żaden e-mail, zaproszenie kalendarzowe ani
powiadomienie zewnętrzne nie zostało wysłane."**

**Ostrzeżenie wsteczne (`DEC-2026-08-29-314`):** dyżury `70`, `72`, `73`,
`76`, `81` i `85` uruchomiły kanoniczny runtime do zrzutów, przez co
sześciokrotnie naruszyły wcześniejsze bezwarunkowe brzmienie `§0.2b`. Do szkody
nie doszło, ponieważ niezależny protokół `Z30` wymagał wykazania, że dostawca
poczty jest atrapą. To ostrzeżenie nie znosi zakazu ani nie zastępuje dowodów.

---

### 0.2c. ★★ KOMPLET ZMIENNYCH ŚRODOWISKOWYCH — TRZY WARIANTY, ZAWSZE W JEDNEJ LINII

**Zmienna postawiona `export`-em wcześniej NIE LICZY SIĘ.** `vitest.config.ts`
przybija część wartości (`DB_TYPE='sqlite'`), więc komplet musi stać
**w tej samej linii komendy** — i masz **udowodnić, że nadpisał**, a nie założyć.

**(A) MIGRACJE — pełny łańcuch, przed jakimkolwiek pomiarem (`Z20`):**

```bash
cd /private/tmp/cx-day377-governed-connect

docker run -d --name cx-day377-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx377 \
  -p 127.0.0.1:6448:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day377-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6448/cx377 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6448/cx377 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day377-governed-connect && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6448/cx377 \
JWT_SECRET=cx377-test-secret-do-not-reuse-min-32-znaki \
npx vitest run Testy serwerowe (`.pg.test.ts`) z cwd `server/`, `--config server/vitest.config.ts`, na realnym PostgreSQL (`RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres`) — dowód `500`→ustrukturyzowany błąd i dowód izolacji cross-org MUSZĄ iść przez realny `ApiGateway.getInstance().initializeRoutes(app)` + `supertest`, z podpisanym JWT (`jwt.sign({id,userId,organizationId,role,email}, JWT_SECRET,...)`, wzór: `server/src/routes/__tests__/day369.cloud-sources-oauth-gate.pg.test.ts:91-98`, ISTNIEJE na tym markerze). ★ Trasy w `TRASY_TYL` (a)-(d) wymagają `requireActiveAuditsMembership` (`server/src/middleware/auditsStrictMembership.middleware.ts:50-56`) — MUSISZ zasiać wiersz `organization_members` ze `status='ACTIVE'` (dokładnie ta wartość, porównanie `toUpperCase()==='ACTIVE'`) dla testowego użytkownika i organizacji, inaczej dostaniesz `403 ORG_MEMBERSHIP_REVOKED` zamiast Twojego dowodu — nie myl tego z bramką tego dyżuru. Test frontu (`ConnectedAppsSettings.tsx`) idzie do `tests/unit/components/settings/`, wzorem `ConnectedAppsSettings.honesty.test.tsx` (ISTNIEJE na markerze — PRZECZYTAJ w całości przed pisaniem nowego testu, żeby nie duplikować mocków), `RUN_DB_TESTS=0 MOCK_DB=true`, mock globalnego `fetch` (`vi.stubGlobal`), asercja na DOM/`toast`/wywołaniach, NIGDY `readFileSync`+`toContain` --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day377-governed-connect-artefakty/day377-governed-connect.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day377-governed-connect && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run Testy serwerowe (`.pg.test.ts`) z cwd `server/`, `--config server/vitest.config.ts`, na realnym PostgreSQL (`RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres`) — dowód `500`→ustrukturyzowany błąd i dowód izolacji cross-org MUSZĄ iść przez realny `ApiGateway.getInstance().initializeRoutes(app)` + `supertest`, z podpisanym JWT (`jwt.sign({id,userId,organizationId,role,email}, JWT_SECRET,...)`, wzór: `server/src/routes/__tests__/day369.cloud-sources-oauth-gate.pg.test.ts:91-98`, ISTNIEJE na tym markerze). ★ Trasy w `TRASY_TYL` (a)-(d) wymagają `requireActiveAuditsMembership` (`server/src/middleware/auditsStrictMembership.middleware.ts:50-56`) — MUSISZ zasiać wiersz `organization_members` ze `status='ACTIVE'` (dokładnie ta wartość, porównanie `toUpperCase()==='ACTIVE'`) dla testowego użytkownika i organizacji, inaczej dostaniesz `403 ORG_MEMBERSHIP_REVOKED` zamiast Twojego dowodu — nie myl tego z bramką tego dyżuru. Test frontu (`ConnectedAppsSettings.tsx`) idzie do `tests/unit/components/settings/`, wzorem `ConnectedAppsSettings.honesty.test.tsx` (ISTNIEJE na markerze — PRZECZYTAJ w całości przed pisaniem nowego testu, żeby nie duplikować mocków), `RUN_DB_TESTS=0 MOCK_DB=true`, mock globalnego `fetch` (`vi.stubGlobal`), asercja na DOM/`toast`/wywołaniach, NIGDY `readFileSync`+`toContain` --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day377-governed-connect-artefakty/day377-governed-connect.json
```

**To NIE jest naruszenie `Z26`, tylko warunek `Z25`:** bez `DATABASE_URL`
`tests/setup.ts` rzuciłby błędem przy `RUN_DB_TESTS=1`.
**Nigdy nie mieszasz: pakiet jednostkowy NIE jest dowodem egzekucji.**

**Znaczenie każdej zmiennej — musisz je znać, zanim ją wpiszesz:**

| Zmienna | Co się stanie, gdy jej zabraknie |
| --- | --- |
| `RUN_DB_TESTS=1` | `tests/setup.ts` pomija testy bazodanowe; pakiet raportuje `exit 0` |
| `MOCK_DB=false` | odczyty idą **cicho** na atrapę bazy, zapisy nigdzie nie lądują |
| `DB_TYPE=postgres` | `vitest.config.ts` przybija `sqlite` — mierzysz inny silnik, niż myślisz |
| `NODE_ENV=test` | runner migracji odmawia albo zwraca MOCK przy bazie lokalnej |
| `ENABLE_V8_GLOBAL=true` | część tras daje **fałszywe `404` PRZED uwierzytelnieniem** |
| `ENABLE_TEST_AUTH_BYPASS=false` | **`verifyToken` JEST OMIJANY** — każdy test uwierzytelniania przechodzi z fałszywego powodu |
| `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` | strażnik przepuszcza wszystko przy `NODE_ENV=test` (416 fałszywych twierdzeń) |
| `DATABASE_URL` | fallback na `localhost:5432`, który **nasłuchuje i nie jest Twój** |
| `JWT_SECRET` | podpisany JWT nie przejdzie przez `verifyToken`; dostaniesz `401` z niewłaściwego powodu |
| `--retry=0` | test „atak odrzucony" **leczy się skutkiem własnego ataku** i raportuje `PASS` |

---

### 0.2d. ★★ ZNANE PUŁAPKI ŚRODOWISKA — OSIEMNAŚCIE, KAŻDA KOSZTOWAŁA GODZINY

**Czytaj to, ZANIM uznasz cokolwiek za zepsute.**

1. **Vault jest BARE + `extensions.worktreeConfig=true`.** Po `git worktree add`
   **musisz** utworzyć `<vault>/worktrees/cx-day377-governed-connect/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day377-pg psql -U postgres -d cx377 -c '…'`.
4. **Runner migracji wymaga `NODE_ENV=test` przy bazie lokalnej.** Bez tego
   strażnik localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
   (`server/scripts/migrate.postgres.ts:640-650`).
5. **`vitest.config.ts` (ok. `:209-210`) twardo ustawia `test.env.DB_TYPE='sqlite'`.**
   Zmienna z powłoki bywa nadpisywana — `DB_TYPE=postgres` musi stać
   **w tej samej linii komendy**, a Ty **udowadniasz w raporcie, że nadpisało**
   (asercja `expect(process.env.DB_TYPE).toBe('postgres')` w pierwszym `it`
   każdego nowego pakietu). Pliku **nie zmieniasz** (`Z18`).
6. **`JSON.parse` na kolumnie typu `json` działa na SQLite i wywala `500` na
   PostgreSQL** — sterownik `pg` zwraca już zdeserializowany obiekt. Jeżeli
   kolumny są `TEXT`, kształt `500` nie występuje, ale występuje kształt
   **cichej utraty danych**. Każdy `500` widoczny na PG a nie na SQLite sprawdź
   najpierw pod tym kątem (`DEC-2026-08-28-245`).
7. **CI NIE URUCHAMIA TESTÓW dla naszych gałęzi.** Joby `test-suite.yml` są
   warunkowane na `main`/`develop`, a my jesteśmy na `Londyn`/`demo`;
   `lint-typecheck` pada na zastanych błędach `tsc`, a `pr-gate` czyta wynik
   pominiętego joba jako sukces (`DEC-2026-08-28-246`). **„CI zielone" nie jest
   w tym repo żadnym dowodem.** Dowodem jest wyłącznie Twój przebieg z `--retry=0`.
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day377-pg`.
9. **Reporter `basic` NIE ISTNIEJE w tej wersji vitest** (`--reporter=basic` →
   `Failed to load custom Reporter from basic`). Do porównania nazw używasz
   `--reporter=json --outputFile=<plik poza repo>`.
10. **`npx vitest run` bywa kończy się `exit 0` mimo czerwonych testów** przy
    przekierowaniu wyjścia. **Nie ufaj kodowi wyjścia** — liczby i nazwy czytasz
    z JSON-a.
11. **Nowe pliki w `tests/` wymagają `git add -f`** (katalog bywa ignorowany
    częściowo). Sprawdzasz `git status --short` po każdym commicie.
12. **`| head` na grepie sierot produkuje FAŁSZYWE SIEROTY.** Werdykt „martwy
    komponent" wymaga grepu **bez obcięcia**, z wykluczeniem `__tests__`
    i komentarzy.
13. **ESM nie honoruje `NODE_PATH`.** Skrypt `.mjs` uruchamiany spoza repo nie
    znajdzie pakietów — rozwiązuj je przez `createRequire(REPO + '/package.json')`.
14. **Na remote `github-backup` NIE MA gałęzi `main`, `develop`, `Londyn` ani
    `demo`** — są na `origin` (`origin/develop` **stoi od 2026-06-02**).
    Pracujemy na linii `Londyn`/`demo`.
15. **`postgres:15` NIE PRZECHODZI migracji** — brak rozszerzenia `vector`.
    Obraz obowiązkowy: `pgvector/pgvector:pg16`.
16. **`prettier` na wielkich plikach potrafi przepisać cały plik.** W repo
    **nie ma** skryptu `format` — wołasz `npx prettier --write <pliki>` wprost.
    Jeżeli wynik reformatu przekracza ~3× liczbę Twoich linii merytorycznych —
    **cofasz reformat** (`cp` z kopii wg `Z27`, nigdy `git stash`), zostawiasz
    styl zastany i wpisujesz to do raportu.
17. **Istnieją testy tekstowe przez `readFileSync` + `toContain`,** które
    asertują **dosłowne linie kodu**. Reformat takiej linii wywala test.
    Jeżeli test zapali się od Twojego reformatu — **to jest regresja Twojego
    reformatu, nie „test do poprawienia"**: cofasz reformat.
18. **`npx vitest` z roota bez właściwego configu daje `No test files found`.**
    To **nie jest `PASS`** — to jest brak pomiaru.

---

> **★★ RAMKA DO `Z33` — PUŁAPKI, KTÓRE FAŁSZUJĄ ZIELONY PRZEBIEG.**
> **Zielona suita w tym repozytorium NIE JEST DOWODEM, dopóki nie wiesz, którą
> pułapkę omija.**
>
> **(a) `ENABLE_V8_GLOBAL` nieustawione → fałszywe `404` PRZED uwierzytelnieniem.**
> `server/src/middleware/v8FeatureGate.middleware.ts:15` czyta
> `process.env.ENABLE_V8_GLOBAL === 'true'`; przy braku zmiennej bramka odcina
> trasę **zanim** cokolwiek sprawdzi tożsamość. Twój test „obcy tenant dostaje
> `404`" przechodzi wtedy z całkiem innego powodu, niż myślisz.
>
> **(b) `resultsInternalBetaVisibility.middleware.ts` przepuszcza wszystko przy
> `NODE_ENV=test`,** dopóki nie ustawisz
> `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`. **Na tym strażniku
> zmierzono 416 fałszywych twierdzeń o uprawnieniach.**
>
> **(c) `vitest.config.ts` twardo ustawia `test.env.DB_TYPE='sqlite'`.** Część
> „testów bazodanowych" idzie na atrapę. `MOCK_DB=false DB_TYPE=postgres`
> w tej samej linii to jedyne wyjście; pliku nie zmieniasz (`Z18`).
>
> **(d) `ENABLE_TEST_AUTH_BYPASS`.** `server/src/middleware/auth.middleware.ts`
> zawiera gałąź: `if (NODE_ENV === 'test' && ENABLE_TEST_AUTH_BYPASS === 'true')`
> — czyli **`verifyToken` potrafi wyłączyć się sam w trybie testowym**.
>
> **(e) ★★★ **PIĘĆ PUŁAPEK.** (1) **Sześć miejsc, nie jedno.** Dyżur 369 zmierzył TYLKO jedno wywołanie (bezpośredni `curl` na `POST /integrations/google_drive/connect`) i słusznie oznaczył resztę jako „tylko pomiar”. Ten dyżur naprawia WSZYSTKIE sześć — pomiń choćby jedno, a `KROK 0` (rodzina) jest złamany. (2) **`requireApprovedGovernedConnector` rzuca dla WIĘKSZEJ liczby przypadków niż „nieznany konektor chmurowy”.** Gdy `OAUTH_APPROVED_PROVIDER_REGISTRY` jest pusta (zmierzone: jest pusta w tym środowisku) — rzuca RÓWNIEŻ dla `jira`/`gmail`/`asana`/`teams`/`slack`, czyli teoretycznie zatwierdzonej piątki. Twoja naprawa (ustrukturyzowany błąd zamiast `500`) MUSI działać identycznie dla całej piątki, nie tylko dla „obcych” konektorów — nie zgaduj po nazwie, testuj po FAKTYCZNYM zachowaniu funkcji w tym środowisku. (3) **`jira` nigdy nie dociera do `buildGovernedExternalAuthSession` przez `ConnectedAppsSettings.tsx`.** `getGovernedExternalAuthConfigFields` (`:216-224`) dokleja `client_id`/`client_secret` do wymaganych pól TYLKO dla `jira` — front (`CATALOG` w `ConnectedAppsSettings.tsx`) zbiera wyłącznie `site_url`, więc `hasAllRequiredFields` jest zawsze `false` dla `jira`, `onboardingStatus` nigdy nie jest `pending_external_auth`, i cała ścieżka `buildGovernedExternalAuthSession` jest dla `jira` NIEOSIĄGALNA z UI. Nie zakładaj, że „jira działa, więc mój test na jira jest reprezentatywny” — reprezentatywny jest WYŁĄCZNIE `teams`. (4) **Dwa formaty odpowiedzi błędu w zależności od tego, jak testujesz.** Goły `ApiGateway.getInstance().initializeRoutes(app)` (bez `server/src/index.ts`) NIE ma zamontowanego `errorHandlerMiddleware` — dostaniesz `500` z ciałem, którego NIE MOŻESZ polegać na treści (zmierzone w 369: `{}`); żeby zobaczyć prawdziwy komunikat/kod, albo uruchom przez pełny `index.ts`, albo czytaj `logger.error` w logu serwera (który loguje pełną wiadomość i stack ZAWSZE, niezależnie od tego, czy middleware jest zamontowane — bo logowanie siedzi W `errorHandlerMiddleware` samym, więc jeśli middleware nie jest zamontowane, log w ogóle nie powstanie — sprawdź to i zapisz wynik). Twoja NAPRAWA ma sprawiać, że odpowiedź jest ustrukturyzowana NIEZALEŻNIE od tego, który serwer ją obsługuje — bo poprawka jest w samej trasie (przechwycenie PRZED przekazaniem do `next`), nie w globalnym error handlerze. (5) **`connectGovernedConnectorIntegration` w `integrations.routes.ts` ma efekty uboczne PRZED wywołaniem `buildGovernedExternalAuthSession`? NIE — sprawdź to sam.** Kod ma komentarz obiecujący, że zatwierdzenie jest sprawdzane PRZED jakimkolwiek zapisem (`:204-210`) — Twój dowód mutacyjny/izolacji MA to zweryfikować wprost (zero wierszy w `integrations` po odrzuceniu), nie tylko zaufać komentarzowi**
>
> **Obowiązek dowodowy.** Dla **każdego** pakietu uruchomionego jako dowód
> czegokolwiek raport zawiera akapit: *która z pułapek (a)–(e) dotyczy tego
> pakietu, jak ją wyłączyłem, i co konkretnie dowodzi, że wyłączyłem*.
> Akapit „nie dotyczy" jest dopuszczalny **tylko** z komendą pokazującą, że dany
> strażnik nie leży na ścieżce. **Pomiar bez tego akapitu nie liczy się jako dowód.**

---

### 0.5. Reguła STOP

**Przy jakiejkolwiek wątpliwości MERYTORYCZNEJ: STOP tej POZYCJI i wpis
w raporcie — nigdy improwizacja. W tym programie zasadny STOP jest NAGRADZANY,
a zgadywanie karane** (dzień 23 dostał `SUPERVISOR_ACCEPT` za STOP,
`DEC-2026-08-26-130`).

**Rozróżnij dwa rodzaje:**

- **STOP MERYTORYCZNY** (mile widziany): zmierzyłeś i wyszło inaczej, niż mówi
  ta instrukcja; brakuje informacji, której nikt poza właścicielem nie
  dostarczy; naprawa wymaga decyzji produktowej. **Wpisujesz do raportu
  i IDZIESZ DALEJ do następnej pozycji.**
- **STOP PROCEDURALNY** (zakazany): „instrukcja jest sprzeczna", „ścieżka nie
  istnieje", „nie mam licencji na plik". **Ten rodzaj NIE zatrzymuje niczego** —
  patrz tabela niżej i sekcja końcowa.

### ★★ TABELA: STOP PROCEDURALNY ZAKAZANY — DZIAŁANIE ZASTĘPCZE

| Powód, dla którego chciałbyś stanąć | Co robisz ZAMIAST STOP-u |
| --- | --- |
| „Musiałbym zmienić plik przekrojowy (`auth.middleware.ts` / `Gateway.ts` / bramkę platformową)" | **Czerwony kontrakt testowy + brief wynikowy** (tabela licencji, wiersz 1). Pozycja jest wtedy **ZROBIONA**, nie STOP |
| „Plik, którego potrzebuję, nie jest w tabeli licencji" | Traktujesz go jako **tylko do odczytu** i dajesz czerwony kontrakt + brief. Pozycja **ZROBIONA** |
| „Instrukcja jest wewnętrznie sprzeczna" | Sekcja **„JEŚLI COŚ JEST SPRZECZNE"** na końcu dokumentu. Wybierasz interpretację **bezpieczniejszą**, opisujesz w „Korektach", **kontynuujesz pozostałe pozycje** |
| „Ścieżka podana w instrukcji nie istnieje" | Sprawdzasz `ls`, wpisujesz **swój wynik** do „Korekt", szukasz realnego odpowiednika i **idziesz dalej**. Rozbieżność pomiaru z instrukcją **nie jest sprzecznością — jest WYNIKIEM** |
| „Instrukcja podaje dwie różne liczby" | Mierzysz sam, podajesz **swoją** liczbę z komendą (`Z24`). To **nie jest** powód do STOP-u |
| „`git fetch` zwrócił błąd `icloud-source`" | To **nie jest** błąd. `§0.2d` pkt 2. Idziesz dalej |
| „`psql` nie istnieje na hoście" | `docker exec cx-day377-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day377-governed-connect-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R0 (twarde zasady: naprawiasz KSZTAŁT błędu, nigdy WARUNEK odmowy; nie zatwierdzasz nowych konektorów; sześć miejsc to jedna rodzina; `materializeGovernedExternalAuthCallback` zostaje nietknięta) · R1 (KROK 0 rodzina: potwierdzić SZEŚĆ miejsc wywołania, potwierdzić SET-MVP-OAUTH-001 jako rozstrzygający dowód kierunku naprawy, potwierdzić który z sześciu jest żywy z `ConnectedAppsSettings.tsx` (`teams`) a które martwe (`UserIntegrations`/`NotificationChannelsSettings`, już w baseline), odtworzyć `500` na realnym PG dla co najmniej dwóch tras — RDZEŃ) · R2 (napisać przyczynę źródłową z liniami: `requireApprovedGovernedConnector` + brak `OAUTH_APPROVED_PROVIDER_REGISTRY` + brak przechwycenia w sześciu wołaczach — RDZEŃ) · R3 (dodać jedną współdzieloną, NIE-rzucającą klasyfikację błędu „konektor niezatwierdzony” i użyć jej we WSZYSTKICH sześciu miejscach, zwracając ustrukturyzowany kod + polski komunikat zamiast `500`; naprawić `ConnectedAppsSettings.tsx` `submitConnectModal`, żeby pokazywał ten błąd zamiast go połykać — RDZEŃ) · R4 (para dowodów `500`→ustrukturyzowany błąd na co najmniej dwóch z sześciu tras, dowód mutacyjny, dowód izolacji cross-org — zero wierszy `integrations` po odrzuceniu — RDZEŃ) · R5 (zrzuty ekranu PL/EN przez dev-render, raport, pytania do właściciela o `OAUTH_APPROVED_PROVIDER_REGISTRY` i o `jira`)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6448` albo `5588` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6448` albo `5588`** (`Z7`).

Format wpisu STOP:

```
### STOP — <pozycja>
Rodzaj: MERYTORYCZNY / PROCEDURALNY
Powód: <jedno zdanie>
Licencja, którą sprawdziłem: <cytat wiersza z tabeli licencji + wynik>
Dowód: <plik:linia albo komenda + wynik>
Co dostarczyłem ZAMIAST zmiany: <czerwony kontrakt / pomiar / gotowy diff / brief>
Co zrobiłbym, gdyby zapadła decyzja X: <2-3 zdania>
Rekomendacja dla nadzorcy: <co zmienić, gdzie, jaki promień rażenia>
Stan: NIE ZACOMMITOWANO / zacommitowano częściowo w <SHA>
Czy kontynuowałem pozostałe pozycje: TAK / NIE + dlaczego
```

**★★ STOP bez wypełnionego pola „Licencja, którą sprawdziłem" jest NIEZASADNY
z definicji. STOP bez wypełnionego pola „Co dostarczyłem ZAMIAST zmiany" jest
NIEZASADNY z definicji.**

---

## ★★ JEŚLI COŚ W TEJ INSTRUKCJI JEST SPRZECZNE LUB NIEWYKONALNE

**Ta instrukcja była pisana i sprawdzana przez człowieka i model. Może mieć
błędy. Nie zatrzymuj przez nie dyżuru.**

**Procedura, dosłownie:**

1. **Opisz sprzeczność w raporcie**, w sekcji „Korekty wobec instrukcji":
   **cytat obu wykluczających się zdań z numerami paragrafów**, na czym polega
   konflikt, jaki masz dowód i co zrobiłeś.
2. **Wybierz interpretację BEZPIECZNIEJSZĄ.** Reguły rozstrzygające,
   w tej kolejności:
   - **nie ruszaj cudzego pliku** — gdy nie wiesz, czy masz licencję, **nie
     masz**; traktuj plik jako tylko do odczytu i dostarcz czerwony kontrakt
     + brief;
   - **nie osłabiaj asercji** — gdy test przeszkadza, opisujesz go, nie
     zmieniasz;
   - **nie kasuj** — gdy werdykt jest niepewny, wpisz `DO DECYZJI WŁAŚCICIELA`
     ze zdaniem **„czego konkretnie mi zabrakło, żeby rozstrzygnąć
     samodzielnie"** (wiersz bez tego zdania liczy się jako nierozstrzygnięty);
   - **nie włączaj** — gdy nie wiesz, czy flaga ma być `ON`, zostaje `OFF`
     (`Z10`/`Z11`);
   - **nie wysyłaj niczego na zewnątrz** — gdy nie masz pewności co do `Z30`,
     nie klikasz;
   - **nie poszerzaj dostępu** — gdy bramka jest niejednoznaczna, **odmawiasz
     zamiast przepuszczać**;
   - **mierz zamiast zgadywać** — gdy instrukcja podaje liczbę, a Twój pomiar
     daje inną, **wiążący jest Twój pomiar z komendą** (`Z24`).
3. **KONTYNUUJESZ POZOSTAŁE POZYCJE.** Sprzeczność w jednym paragrafie nie
   zwalnia z pozostałych ani z raportu.
4. **Zatrzymanie CAŁEGO dyżuru** — wyłącznie z pięciu powodów wymienionych
   w `§0.5`.
5. **Nigdy nie „naprawiaj" instrukcji przez improwizację w kodzie.**
   Sprzeczność w dokumencie rozwiązuje się **wpisem w raporcie**, nie zmianą
   w produkcie.
6. **★ Rozbieżność między pomiarem a tą instrukcją NIE JEST sprzecznością —
   jest WYNIKIEM.** Każda liczba, linia i teza w tym dokumencie to **rozkaz
   pomiarowy**, nie prawda objawiona.

**★ Trzy najcenniejsze rzeczy, jakie możesz oddać:** dowód, że coś, co uchodziło
za działające, nie działa; dowód, że coś, co uchodziło za zepsute, jest sprawne;
i uczciwe zdanie „tego nie zmierzyłem, bo…".

**★ Ostatnie zdanie tej instrukcji i najważniejsze: obalenie którejkolwiek tezy
z sekcji „TEZY ZLECENIA…" jest SUKCESEM dyżuru, a nie porażką. Zapisz to
w „Korektach wobec instrukcji" z dowodem i idź dalej.**

---

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
