# INSTRUKCJA DYŻURU nr 369 — Codex — „★★★ CHMURA_OAUTH — „Zarządzaj źródłami w chmurze” w menu „+” Czatu tworzy **fikcyjne „połączone” źródło bez jakiejkolwiek autoryzacji OAuth**: `POST /api/cloud/sources` (`server/src/routes/cloud.routes.ts:82-116`) waliduje TYLKO `provider`+`name`, `accessToken`/`refreshToken` z body są opcjonalne i nigdy nie są sprawdzane wobec żadnego rzeczywistego tokenu — użytkownik dostaje `201` i status `active` bez okna logowania Google/Microsoft/Dropbox. Jednocześnie w repo ISTNIEJE realny, już działający silnik OAuth dla tych samych trzech dostawców (`server/src/services/integrationOAuthEngine.ts`, konektory `google_drive`/`onedrive`/`dropbox`, tabela `integration_oauth_tokens`, trasy `GET /api/settings/integrations/oauth/start/:connectorId` i `/oauth/callback` zamontowane w `server/src/routes/settings.routes.ts`) — `cloudDataService.ts` o nim nie wie (`grep` po `integration_oauth_tokens`/`getStoredToken` w `cloudDataService.ts` i `cloud.routes.ts` daje **zero trafień**). To jest „zbudowane, ale niepodłączone”, nie brak implementacji. ★★ DODATKOWO — **korekta audytu, zmierz sam**: front-endowy ekran, który audyt `D_pole_wpisywania.md`/`V1_weryfikacja_P1.md` opisał jako reachable Ustawienia→Integracje (`CloudDataSettings.tsx`), ma **ZERO importerów w `src/`** i jest oznaczony `unreachable` przez `scripts/dev/reachability-from-root.mjs` (wpis już jest w zaakceptowanym `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json:435` — nie jest to nowe odkrycie tego dyżuru, ale audyt czatu tego nie sprawdził). Realny ekran, na który faktycznie nawiguje `AddFilesMenu.tsx` (`navigate('/settings/integrations')`), to `IntegrationSettings.tsx` — a jego „Connect” dla `google_drive`/`onedrive`/`dropbox` idzie przez **trzeci, osobny mechanizm** (`server/src/services/v8/pmSyncExternalAuthMaterializationService.ts`, `buildGovernedExternalAuthSession`), który dla tych trzech konektorów NIE ma gałęzi (lista `shouldMaterializeCallbackDrivenAuth` zawiera tylko `jira,gmail,asana,teams,slack`) i spada do domyślnej gałęzi zwracającej `authUrl: callbackUrl` — URL bez `client_id`, bez `redirect_uri` do dostawcy, bez `response_type` — czyli TAKŻE atrapę, inną niż ta opisana przez audyt. Zakres tego dyżuru: uszczelnić rdzeń (`cloud.routes.ts`+`cloudDataService.ts`, oparty o istniejący silnik `integrationOAuthEngine`), naprawić martwy-ale-licencjonowany `CloudDataSettings.tsx` tak, żeby gdy zostanie kiedyś podłączony, był uczciwy, i **zmierzyć, nie naprawiać**, trzeci mechanizm w `pmSyncExternalAuthMaterializationService.ts` — to pytanie do właściciela, nie zadanie tego dyżuru (za duże, dotyka governed-connector/audit trail)"

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
> **wyłącznie** `/private/tmp/cx-day369-chmura-oauth`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c`**
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
Zakres: ****`13_CHAT`** (menu „+” pola wpisywania, `AddFilesMenu.tsx`→`CloudFilePicker.tsx`) **+ `15_SETTINGS`** (integracje chmurowe — `CloudDataSettings.tsx`, martwy, i `IntegrationSettings.tsx`, reachable). Rdzeń: uszczelnienie `POST /api/cloud/sources` i `cloudDataService.ts` o realny silnik OAuth (`integrationOAuthEngine.ts`) zamiast tworzenia „połączonych” źródeł bez tokenu. Produktem są cztery domknięcia: (1) `POST /api/cloud/sources` odrzuca tworzenie źródła bez ważnego tokenu z `integration_oauth_tokens`; (2) `cloudDataService.ts` czyta token żywo z silnika OAuth zamiast wierzyć kolumnie `cloud_sources.access_token`; (3) `CloudDataSettings.tsx` (martwy, ale licencjonowany) prowadzi realnie do startu OAuth silnika zamiast fałszywego `POST /sources`, a dla dostawcy nieskonfigurowanego jest uczciwie wyłączony; (4) pomiar i pytanie do właściciela o trzeci, osobny, też zepsuty mechanizm w `pmSyncExternalAuthMaterializationService.ts`, na który faktycznie trafia użytkownik z czatu. Prawo zatrzymania PO KAŻDEJ pozycji `R`, z commitem, plik postępu `/private/tmp/cx-day369-postep.md` (POZA repo)**.
Trasy front: `RDZEŃ frontu: `src/components/settings/CloudDataSettings.tsx` (martwy dziś, ale w zakresie tabeli licencji: napraw uczciwie mimo braku montażu, patrz `R4`) · `src/components/AIChat/AddFilesMenu.tsx` (TYLKO ODCZYT — dowód trasy nawigacji, `openIntegrationsSettings:255-263`) · `src/components/AIChat/CloudFilePicker.tsx` (TYLKO ODCZYT) · `src/hooks/useCloudIntegrations.ts` (TYLKO ODCZYT — już uczciwy, `connectProvider:50-61` tylko informuje) · `src/components/settings/IntegrationSettings.tsx` (TYLKO ODCZYT w tym dyżurze — to jest realnie reachable ekran, ale naprawa jego trzeciego mechanizmu jest `R5`, pomiar+pytanie, nie kod) · `src/services/api.ts` (WĄSKA LICENCJA — wolno dodać JEDNĄ nową metodę odczytu `GET /api/settings/integrations/oauth/status`, jeżeli jej dziś brak; zakaz zmiany istniejących metod `getCloudProviders`/`downloadCloudFile`/itd.). Reszta `src/**` `TYLKO ODCZYT``. Trasy tył: `★★ SEDNO, DWA MIEJSCA. **(a) Brama tworzenia źródła:** `server/src/routes/cloud.routes.ts`, `POST /sources` — wiersze **90-93** destrukturyzują `accessToken`/`refreshToken` z body jako OPCJONALNE i wiersze **91-93** wymagają wyłącznie `provider`+`name`; wiersze **97-107** wołają `createCloudSource` z tymi (niesprawdzonymi) polami wprost. **(b) Serwis dostawców:** `server/src/services/cloudDataService.ts` — dziewięć identycznych strażników `if (!source.accessToken) throw new Error('<Provider> access token not configured')` na liniach **162, 219, 403** (Google Drive), **460, 495, 539** (OneDrive), **565, 610, 648** (Dropbox); `source.accessToken` pochodzi WYŁĄCZNIE z kolumny `cloud_sources.access_token` (`mapCloudSource:957`), nigdy z `integration_oauth_tokens`. Realny silnik: `server/src/services/integrationOAuthEngine.ts` — `CONNECTOR_OAUTH_CONFIGS` ma `google_drive` (**265-277**, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`), `onedrive` (**278-288**, `MICROSOFT_CLIENT_ID`/`MICROSOFT_CLIENT_SECRET` — **NIE** `MS_*`/`AZURE_*`), `dropbox` (**289-307**, `DROPBOX_CLIENT_ID`/`DROPBOX_CLIENT_SECRET`); eksportowane `getStoredToken` (**710-742**) i `getValidAccessToken` (**747-767**, z auto-odświeżeniem) czytają tabelę `integration_oauth_tokens` po `(user_id, connector_id)` — kluczowane PER UŻYTKOWNIK, nie per organizacja (tabela nie ma kolumny `organization_id`). Trasy realnego OAuth: `GET /api/settings/integrations/oauth/start/:connectorId` (`settings.routes.ts:2116-2175`, zwraca `{authUrl,state}` z realnym `authorizeUrl` dostawcy) i `GET /api/settings/integrations/oauth/callback` (**2181-2261**, woła `exchangeCode`+`storeTokens`). **NIE** `server/src/services/v8/pmSyncExternalAuthMaterializationService.ts` — to trzeci, osobny mechanizm (patrz `R5`)`.

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
WT=/private/tmp/cx-day369-chmura-oauth
MARKER=9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/grafika/m03-20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day369-chmura-oauth-20260905 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day369-chmura-oauth/config.worktree"
cat "$VAULT/worktrees/cx-day369-chmura-oauth/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day369-chmura-oauth-scratch
mkdir -p /private/tmp/cx-day369-chmura-oauth-artefakty

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
git -C "$VAULT" log --oneline 9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c..github-backup/grafika/m03-20260902
git -C "$VAULT" diff --name-only 9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c..github-backup/grafika/m03-20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day369-chmura-oauth-20260905
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `dziesięć` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) ★★★ TEZA A: POST /sources wymaga TYLKO provider+name, token jest opcjonalny
sed -n '82,116p' server/src/routes/cloud.routes.ts
#   moje liczby: walidacja (linie 91-93) sprawdza wylacznie `!provider || !name`;
#   accessToken/refreshToken/rootFolderId/settings (linia 90) sa destrukturyzowane z body
#   i przekazane do createCloudSource (98-107) BEZ zadnej weryfikacji.

# (2) ★★★ TEZA B: DZIEWIEC identycznych straznikow "access token not configured"
#     — istnieja, ale zrodlem `source.accessToken` jest WYLACZNIE kolumna DB, nigdy silnik OAuth
bash -c "grep -n 'access token not configured' server/src/services/cloudDataService.ts"
bash -c "grep -n 'integration_oauth_tokens\|getStoredToken\|getValidAccessToken' server/src/services/cloudDataService.ts server/src/routes/cloud.routes.ts"
#   moje liczby: 9 straznikow na liniach 162,219,403,460,495,539,565,610,648;
#   DRUGI grep daje ZERO trafien — potwierdzone, cloudDataService nigdy nie czyta silnika OAuth.

# (3) ★★★ TEZA C: silnik OAuth dla tych samych trzech dostawcow JUZ ISTNIEJE i dziala gdzie indziej
bash -c "grep -n 'google_drive:\|onedrive:\|dropbox:\|envClientId\|envClientSecret' server/src/services/integrationOAuthEngine.ts" | sed -n '1,20p'
bash -c "grep -n 'router.get\|router.post' server/src/routes/settings.routes.ts | grep -i oauth"
#   moje liczby: google_drive:265, onedrive:278, dropbox:289; env GOOGLE_CLIENT_ID/SECRET,
#   MICROSOFT_CLIENT_ID/SECRET (NIE MS_*/AZURE_*), DROPBOX_CLIENT_ID/SECRET;
#   trasy oauth/start:2116, oauth/callback:2181 zamontowane w /api/settings (Gateway.ts:766).

# (4) ★★★ TEZA D — KOREKTA AUDYTU: CloudDataSettings.tsx (badany przez audyt jako reachable)
#     jest MARTWY — zero importerow w src/, i tak mowi wlasne narzedzie reachability
bash -c "grep -rln 'CloudDataSettings' src/ 2>/dev/null"
node scripts/dev/reachability-from-root.mjs 2>/dev/null | true
bash -c "grep -n 'CloudDataSettings' docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json"
#   moje liczby: grep zwraca WYLACZNIE sam plik (0 importerow); wpis jest JUZ w zaakceptowanym
#   baseline (linia 435) jako unreachable — nie jest to nowe odkrycie, audyt czatu tego nie sprawdzil.

# (5) TEZA E: realny ekran, na ktory nawiguje AddFilesMenu, to IntegrationSettings.tsx,
#     a jego "Connect" dla chmury spada w TRZECI, zepsuty na inny sposob mechanizm
sed -n '255,263p' src/components/AIChat/AddFilesMenu.tsx
bash -c "grep -n 'normalizeConnectorId(context.connectorId) ===\|shouldMaterializeCallbackDrivenAuth' server/src/services/v8/pmSyncExternalAuthMaterializationService.ts"
#   moje liczby: openIntegrationsSettings (255-263) robi navigate('/settings/integrations');
#   buildGovernedExternalAuthSession ma galezie TYLKO dla jira/gmail/asana/teams/slack (5),
#   google_drive/onedrive/dropbox spadaja do domyslnej galezi `authUrl: callbackUrl` (linie 338-343)
#   — URL bez client_id/redirect_uri do dostawcy. Inna atrapa niz D-1 z audytu.

# (6) TEZA F: GET /api/cloud/providers liczy "connected" z SAMEGO istnienia wiersza cloud_sources
sed -n '391,415p' server/src/routes/cloud.routes.ts
#   moje liczby: `isConnected` (414) sprawdza obecnosc w Set zbudowanym z `listCloudSources`
#   (401-409) — bez zadnego odczytu tokenu. Fikcyjne zrodlo z (1) OD RAZU pokazuje sie
#   w AddFilesMenu jako "connected".

# (7) TEZA G: schemat tabel — provider CHECK, integration_oauth_tokens bez migracji plikowej
bash -c "grep -n \"CHECK (provider\" server/migrations/553_cloud_data_sources.sql"
bash -c "grep -rl 'CREATE TABLE IF NOT EXISTS integration_oauth_tokens' server/migrations/ server/src/"
#   moje liczby: cloud_sources.provider CHECK IN ('google_drive','onedrive','dropbox','sharepoint');
#   integration_oauth_tokens NIE MA pliku migracji — tworzy ja leniwie ensureTokenTable()
#   w integrationOAuthEngine.ts (346-384), nigdy server/migrations/**.

# (8) zasoby: dysk, porty, kontener
df -h /
lsof -nP -iTCP:6440 -sTCP:LISTEN; lsof -nP -iTCP:5580 -sTCP:LISTEN
docker ps -a --format '{{.Names}}' | grep -c cx-day369 || true
#   oczekiwane przy wydaniu: >30 GB wolnego; oba porty puste; 0 kontenerow.

# (9) leaves slownikow i bramki kanonu na markerze
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
#   moje liczby: pl 35204, en 33071; focus=0, list=0, artefakt=0, reach=1 (NIE 0!).
#   ★ reach=1 na SAMYM MARKERZE, PRZED jakakolwiek Twoja zmiana — 3 NOWE pliki test-only
#   spoza Twojego zakresu (initiativeKartaRealnyRekord, macierz-sedno-20260905,
#   AdminSettingsModule.healthSectionI18n), CloudDataSettings.tsx NIE jest przyczyna
#   (jest juz w zaakceptowanym baseline). To jest ZASTANY stan — patrz WARUNKI WSPOLNE.

# (10) rejestr znaleziska — pierwsza wolna litera
bash -c "grep -nE '^## [A-Z]+\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -5"
#   moje liczby: ostatnia uzyta AF (dyzur 365) — nastepna wolna to AG.
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day369-chmura-oauth-20260905` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6440`. Twój JEDYNY port harnessu to `5580`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day369-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta restricted ports Chromium. Zajęte przez hosta i tor grafiki: 3020-3030, 5432, 5433, 6379. Rodzeństwo TEJ paczki 05.09 (367-373) — nie dotykasz: 367 (6438/5578), 368 (6439/5579), 370 (6441/5581), 371 (6442/5582), 372 (6443/5583), 373 (6444/5584). Twoje własne wyłącznie: baza **6440**, harness **5580**. ★ ZAKAZ `pkill`/`killall` — zabijasz wyłącznie własne PID-y (zapisz `$!`)`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `BRAK NOWYCH FLAG. Ten dyżur nie dodaje ani jednej flagi funkcyjnej i nie zmienia wartości domyślnej żadnej istniejącej. To jest naprawa DEFEKTU POTWIERDZONEGO (atrapa OAuth), nie nowy element UI — `CLAUDE.md`/`Z11` wymaga flagi tylko dla NOWEGO wizualium — tu zmienia się WYŁĄCZNIE zachowanie istniejących przycisków (`Connect` odrzuca fałszywe źródło zamiast je tworzyć; `Connect` w `CloudDataSettings.tsx` prowadzi do realnego OAuth zamiast fałszywego POST). Jeżeli w trakcie `R4` okaże się, że uczciwy stan wyłączony wymaga NOWEGO elementu UI (np. osobnego komunikatu inline) — dodajesz go bez flagi, bo to jest stan błędu/disabled istniejącego przycisku, nie nowy ekran`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh --ci`, `scripts/check-artefakt.sh`, `scripts/dev/reachability-from-root.mjs`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`, `server/src/middleware/auth.middleware.ts`, `server/src/services/ApiGateway.ts`, `server/src/Gateway.ts`, `server/src/services/v8/pmSyncExternalAuthMaterializationService.ts`, `server/src/services/integrationHubService.ts`, `server/src/routes/settings.routes.ts` (poza wąską licencją read-only), `public/locales/**`. Wszystkie **NIETYKALNE DO ZAPISU** w tym dyżurze — wolno je wołać/czytać w pomiarze`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY369_CHMURA_OAUTH_REPORT.md`. Jedyne inne dokumenty do zmiany: **jedna nowa sekcja** w `docs/program/REJESTR_ZNALEZISK_20260903.md` o PIERWSZEJ WOLNEJ literze — na markerze ostatnia użyta to **`AF`** (dyżur 365), więc następna to **`AG`** (★ jeżeli inny autor twierdzi, że to `AC` — to jest STARY pomiar, sprzed kilku równoległych dyżurów; sprawdzasz komendą tuż przed commitem, bo równolegle piszą inni autorzy) — oraz nowe pliki dowodowe pod `evidence/chmura-oauth-20260905/day369/` (katalog NIE ISTNIEJE na markerze — tworzysz go). Plik postępu `/private/tmp/cx-day369-postep.md` żyje POZA repo. ★★★ **MACIERZ ODBIORU JEST NIETYKALNA W TYM DYŻURZE** — żaden wiersz `G00`–`G20`, żaden moduł, w tym `13_CHAT` i `15_SETTINGS`. Jeżeli `reachability-from-root.mjs --check-baseline` odmówi z powodu Twoich NOWYCH plików testowych — wolno Ci `--update-baseline`, ale WYŁĄCZNIE gdy jedyną różnicą są TWOJE nowe pliki (skrypt i tak odmawia, jeśli zbiór `unreachable` się powiększył o coś innego). Nowe pliki w `tests/` wymagają `git add -f`. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day369-chmura-oauth-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day369-chmura-oauth-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ TWORZENIA ŹRÓDŁA CHMUROWEGO BEZ WERYFIKACJI TOKENU.** `POST /api/cloud/sources` MUSI odmówić (409/400 z kodem błędu) dla `provider` w `{google_drive,onedrive,dropbox}`, dopóki nie istnieje aktywny wiersz w `integration_oauth_tokens` dla `(req.userId, provider)`. Dla `provider='sharepoint'` (brak konektora w silniku OAuth) MUSI odmówić ZAWSZE, uczciwie (`CLOUD_PROVIDER_UNSUPPORTED`), nigdy nie tworzyć źródła „active”. ★★★ **ZAKAZ UFANIA TOKENOM Z BODY ŻĄDANIA.** `accessToken`/`refreshToken` przychodzące w `req.body` dla tych trzech dostawców MUSZĄ być ignorowane przy tworzeniu źródła — jedynym źródłem prawdy o tokenie jest silnik OAuth (`getStoredToken`/`getValidAccessToken`). Test, który tylko sprawdza obecność pola w body, a nie faktyczne pochodzenie zapisanego tokenu, nie jest dowodem. ★★★ **ZAKAZ MIESZANIA TABEL.** Nie dodajesz kolumny `organization_id` do `integration_oauth_tokens` i nie zmieniasz jej klucza unikalności (`UNIQUE(user_id, connector_id)`) — token zostaje PER UŻYTKOWNIK, zgodnie z resztą silnika (Ustawienia→Integracje); jeżeli to rodzi ryzyko izolacji między organizacjami tego samego użytkownika — piszesz to jako pytanie do właściciela w `R5`, nie zmieniasz schematu. ★★ **ZAKAZ NAPRAWY TRZECIEGO MECHANIZMU** (`pmSyncExternalAuthMaterializationService.ts`, governed connector flow używany realnie przez `IntegrationSettings.tsx`). To większa zmiana, dotyka `integrations`/audit trail — TYLKO pomiar, brief `plik:linia`, diff **nienałożony**, pytanie do właściciela. ★★ **ZAKAZ MONTOWANIA `CloudDataSettings.tsx` W NOWEJ TRASIE.** Komponent jest dziś martwy (zero importerów, potwierdzone `reachability-from-root.mjs`, wpis już w zaakceptowanym baseline) — naprawiasz JEGO KOD (żeby był uczciwy, gdy ktoś go kiedyś podłączy), ale NIE dodajesz nowego importu/trasy, która by go zamontowała — to jest decyzja produktowa (czy `/settings/integrations` ma pokazywać ten ekran zamiast/obok `IntegrationSettings.tsx`), idzie do `R5` jako pytanie. ★ **ZAKAZ `.skip`, `.todo`, `--retry` innego niż `0`, poszerzania `exclude`, zmiany oczekiwanego kodu odpowiedzi w asercji** (`Z35`). **ZAKAZ porównania po liczbach** (`Z37`) | Bo trzy różne miejsca w repo udają, że da się połączyć Google Drive/OneDrive/Dropbox z czatu, i **żadne z nich naprawdę tego nie robi** — a jednocześnie kawałek, który NAPRAWDĘ to robi (silnik OAuth w Ustawieniach→Integracje), stoi obok, gotowy, i nikt go nie podłączył do bramy tworzenia źródeł chmurowych. To jest dokładnie kształt „zbudowane, ale niepodłączone” z `docs/program/AUDYT_CZAT_PRZYCISKI_20260905/V1_weryfikacja_P1.md` — z tą różnicą, że sam audyt pomylił, KTÓRY z trzech mechanizmów jest reachable z ekranu, na który faktycznie nawiguje użytkownik. Naprawa rdzenia (bramka tokenu w `cloud.routes.ts`+`cloudDataService.ts`) jest tania i realna, bo silnik OAuth już istnieje, jest przetestowany gdzie indziej i nie wymaga pisania niczego od zera — trzeba go tylko PRZECZYTAĆ z właściwego miejsca zamiast ufać polu w body żądania |

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
cd /private/tmp/cx-day369-chmura-oauth

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day369-pg psql -U postgres -d cx369 \
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
cd /private/tmp/cx-day369-chmura-oauth

docker run -d --name cx-day369-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx369 \
  -p 127.0.0.1:6440:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day369-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6440/cx369 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6440/cx369 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day369-chmura-oauth && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6440/cx369 \
JWT_SECRET=cx369-test-secret-do-not-reuse-min-32-znaki \
npx vitest run Testy serwerowe (`.pg.test.ts`) z cwd `server/`, `--config server/vitest.config.ts`, na realnym PostgreSQL (`RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres`) — dowód bramki tokenu i dowód izolacji cross-org MUSZĄ iść przez realny `ApiGateway.getInstance().initializeRoutes(app)` + `supertest`, z podpisanym JWT (`jwt.sign({id,userId,organizationId,role,email}, JWT_SECRET,...)`, wzór: `server/src/routes/__tests__/day142.initiative-kpi-survival.pg.test.ts:91-98`), NIGDY wołaniem funkcji serwisu z pominięciem trasy (`Z22`). Test frontu (`CloudDataSettings.tsx`) idzie do `tests/unit/components/settings/` z `RUN_DB_TESTS=0 MOCK_DB=true`, wzorem `tests/unit/components/settings/ConnectedAppsSettings.honesty.test.tsx` (mock `Api`, render+`fireEvent`+`waitFor`, asercja na DOM/atrybutach, NIGDY `readFileSync`+`toContain`). Mock HTTP dostawcy w `R2` (Google Drive/OneDrive/Dropbox) rób przez podmianę globalnego `fetch` w danym pliku testowym (`vi.stubGlobal('fetch', ...)` albo lokalny mock modułu — NIE dotykasz `tests/__mocks__/**` globalnie, `Z18`), sprawdzasz realnie wywołany URL i nagłówek `Authorization: Bearer <token>` --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day369-chmura-oauth-artefakty/day369-chmura-oauth.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day369-chmura-oauth && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run Testy serwerowe (`.pg.test.ts`) z cwd `server/`, `--config server/vitest.config.ts`, na realnym PostgreSQL (`RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres`) — dowód bramki tokenu i dowód izolacji cross-org MUSZĄ iść przez realny `ApiGateway.getInstance().initializeRoutes(app)` + `supertest`, z podpisanym JWT (`jwt.sign({id,userId,organizationId,role,email}, JWT_SECRET,...)`, wzór: `server/src/routes/__tests__/day142.initiative-kpi-survival.pg.test.ts:91-98`), NIGDY wołaniem funkcji serwisu z pominięciem trasy (`Z22`). Test frontu (`CloudDataSettings.tsx`) idzie do `tests/unit/components/settings/` z `RUN_DB_TESTS=0 MOCK_DB=true`, wzorem `tests/unit/components/settings/ConnectedAppsSettings.honesty.test.tsx` (mock `Api`, render+`fireEvent`+`waitFor`, asercja na DOM/atrybutach, NIGDY `readFileSync`+`toContain`). Mock HTTP dostawcy w `R2` (Google Drive/OneDrive/Dropbox) rób przez podmianę globalnego `fetch` w danym pliku testowym (`vi.stubGlobal('fetch', ...)` albo lokalny mock modułu — NIE dotykasz `tests/__mocks__/**` globalnie, `Z18`), sprawdzasz realnie wywołany URL i nagłówek `Authorization: Bearer <token>` --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day369-chmura-oauth-artefakty/day369-chmura-oauth.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day369-chmura-oauth/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day369-pg psql -U postgres -d cx369 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day369-pg`.
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
> **(e) ★★★ **SZEŚĆ PUŁAPEK.** (1) **Trzy systemy integracji, nie jeden.** `cloud_sources`+`cloudDataService.ts` (ten dyżur), `integrations`+`integrationHubService.ts`+governed connector flow (`IntegrationSettings.tsx`, reachable, ale `R5` — pomiar), `integration_oauth_tokens`+`integrationOAuthEngine.ts` (jedyny realnie działający, dla `gmail`/`slack`/itd. i dla naszych trzech dostawców chmury — ale tylko gdy woła go poprawny ekran). Nie myl tabel: `cloud_sources.access_token` ≠ `integration_oauth_tokens.access_token` ≠ `integrations.config`. (2) **Reachable ≠ to, co mówi audyt.** `CloudDataSettings.tsx` ma zero importerów (`bash -c "grep -rln 'CloudDataSettings' src/"` → jeden plik, sam siebie) i jest w zaakceptowanym `reachability.baseline.json:435` jako `unreachable` — audyt czatu (D-1) założył, że to jest ekran otwierany z „Manage cloud sources”, a w rzeczywistości otwiera się `IntegrationSettings.tsx`. **Zmierz to sam, zanim uznasz, który plik naprawiasz.** (3) **`integration_oauth_tokens` nie ma migracji pliku** — tabelę tworzy leniwie `ensureTokenTable()` (`integrationOAuthEngine.ts:346-384`, `CREATE TABLE IF NOT EXISTS`) wywoływana przy pierwszym odczycie/zapisie. Żeby zasiać token w teście, wywołaj najpierw dowolną funkcję odczytu silnika (np. `getStoredToken`), a DOPIERO potem rób surowy `INSERT`. (4) **Token w `integration_oauth_tokens` jest SZYFROWANY** (`encryptSecret`/`decryptSecret` z `server/src/utils/secretEncryption.ts`) — surowy `INSERT` z niezaszyfrowanym stringiem sprawi, że `getStoredToken` zwróci bezsensowny `decryptSecret(...)` zamiast Twojego testowego tokenu; szyfruj tak samo jak `storeTokens` (linia 697). (5) **`storeTokens` wymaga zatwierdzonego konektora** (`isConnectorApproved`, wymaga `OAUTH_APPROVED_PROVIDER_REGISTRY` ze zgodnymi `scopes`) — to jest przeszkoda do SIANIA tokenu przez publiczne API silnika w teście; prostsza droga to surowy `INSERT` do `integration_oauth_tokens` (po `ensureTokenTable()`), nie wołanie `storeTokens` wprost. (6) **`integration_oauth_tokens` jest kluczowana `(user_id, connector_id)`, BEZ `organization_id`.** Token jest per-użytkownik. Test izolacji cross-org w tym dyżurze oznacza: user B (inna organizacja, BEZ własnego tokenu) nie może utworzyć źródła, mimo że user A (inna organizacja) ma token — bo `cloud.routes.ts` sprawdza token dla `req.userId`, nie dla `req.organizationId`. Nie projektuj izolacji na poziomie organizacji, której silnik dziś nie ma — zmierz to, co jest, i zapisz ograniczenie jako fakt, nie jako lukę do naprawienia w tym dyżurze**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day369-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day369-chmura-oauth-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R0 (twarde zasady: bramka tokenu zamiast atrapy, nie ufaj tokenowi z body, mianownik identyczny, para dowodów przy izolacji, nie myl trzech systemów integracji) · R1 (KROK 0 rodzina: wypisać WSZYSTKIE miejsca tworzące/oznaczające „połączone” źródło chmurowe, potwierdzić martwość `CloudDataSettings.tsx` i realność `IntegrationSettings.tsx`, zmierzyć env dostawców — RDZEŃ) · R2 (`POST /api/cloud/sources` odrzuca bez ważnego tokenu z `integration_oauth_tokens`, `sharepoint` zawsze odrzucony, token z body ignorowany — RDZEŃ) · R3 (`cloudDataService.ts` czyta `accessToken` żywo z `getValidAccessToken(userId, provider)` zamiast kolumny DB, dla trzech wpiętych dostawców, z dowodem mockowanego HTTP — RDZEŃ) · R4 (`CloudDataSettings.tsx` „Connect” prowadzi do realnego startu OAuth silnika albo jest uczciwie wyłączony z polskim komunikatem, gdy dostawca nieskonfigurowany — RDZEŃ) · R5 (pomiar trzeciego mechanizmu `pmSyncExternalAuthMaterializationService.ts`, raport, jawne pytania do właściciela)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6440` albo `5580` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6440` albo `5580`** (`Z7`).

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
