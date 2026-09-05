# INSTRUKCJA DYŻURU nr 376 — Codex — „★ CZTERY MAŁE DOMKNIĘCIA POZOSTAWIONE OTWARTE PRZEZ DYŻURY 368/373: zrzut i porządek. **R1** — dyżur 368 podpiął fallback nawigacji przycisku „Akcje biznesowe” (`UnifiedChatPanel.tsx:816-819`, flaga `chatBusinessActionsNav`, `DEFAULT_FLAGS`, `useFeatureFlags.tsx:111-118`, `defaultValue:false`) do `/ai-actions`, ale NIE dostarczył zrzutu wymaganego przez `CLAUDE.md` regułą 7 — raport 368 zgłosił `BLOCKED_AUTH` („lokalny produkt… PIN, `dev-render/**` nie ma licencji zapisu”). **Mój pomiar obala ten STOP**: `dev-render/screens/chat-split-teresa-right.tsx` (istnieje na markerze, 142 linie) montuje DOKŁADNIE realny `<UnifiedChatPanel mode="full">` bez logowania — zaszywa `useAppStore.setState({currentUser:…})` i podmienia tylko wywołania `Api` przy montażu. Ten sam wzorzec, plus lokalny override flagi przez `localStorage` (`STORAGE_KEY='consultify_feature_flags'`, `useFeatureFlags.tsx:449-451`) i `<FeatureFlagsProvider config={{enableLocalOverrides:true}}>`, wystarczy do zrzutu — zero PIN-u, zero nowego backendu. **Drugi obalony twierdzenie**: raport 368 NIE prosił o ARG/ENV Dockera, ale zlecenie tego dyżuru każe je dodać „bez tego flaga nigdy nie wejdzie na staging”. `ODBIOR_368.md` wiersz 12 już to zmierzył i ROZSTRZYGNĄŁ: `chatBusinessActionsNav` żyje w `DEFAULT_FLAGS` (`useFeatureFlags.tsx`) — stała TS wkompilowana w bundle plus opcjonalny zdalny override przez `GET {API_URL}/feature-flags/runtime` (tabela `feature_flags`) — to INNY mechanizm niż `VITE_*` flagi budowane w Dockerze (`agentPlanFlag.ts` i ~150 wpisów `ARG VITE_*` w `Dockerfile.frontend`/`Dockerfile.api`); żaden z pozostałych 24 wpisów `DEFAULT_FLAGS` (`myWorkNotebookV2` itd.) też nie ma wpisu w Dockerfile — spójny wzorzec, nie luka. Ten dyżur ma TĘ TEZĘ ZWERYFIKOWAĆ PONOWNIE, nie mechanicznie dopisać martwy ARG. **R2** — `InputHintStrip.tsx` (`src/components/AIChat/`, `test-only` w pomiarze `reachability-from-root.mjs` na bieżącym markerze) miał zostać usunięty w dyżurze 373, ale STOP: KROK 0 znalazł DRUGI, nielicencjonowany mock w `tests/components/AIChat/EnhancedChatInput.teresa-error-toast.test.tsx:85` (obok już licencjonowanego `src/components/AIChat/__tests__/EnhancedChatInput.teresaVoice.test.tsx:98`) — `ODBIOR_373.md`/`CODEX_DAY373…REPORT.md` sekcja „STOP — InputHintStrip” pyta wprost, czy rozszerzyć licencję o tę jedną linię. Ten dyżur ODPOWIADA TAK i licencjonuje usunięcie komponentu + jego dedykowanego testu + OBU mocków. **R3** — `CloudDataSettings.tsx` (`src/components/settings/`, `test-only`) jest martwym duplikatem `ConnectedAppsSettings.tsx` (`app`, montowany pod `/settings/connected-apps`, `SettingsView.tsx:460`) — potwierdzone `ODBIOR_369`/`CODEX_DAY369…REPORT.md` pytaniem 2 do właściciela. Mój pomiar: `CloudDataSettings.tsx` jest JEDYNYM wołaczem `POST /api/cloud/sources` (bramka zabezpieczona w 369 R2 — wymaga realnego per-user tokenu OAuth) w całym `src/`; `AddFilesMenu.tsx`/`CloudFilePicker.tsx` w Czacie wołają WYŁĄCZNIE `GET /api/cloud/sources` (`Api.listCloudFiles`, `services/api.ts:18148-18164`) — czytanie, nie tworzenie — a link „Zarządzaj” z `AddFilesMenu.tsx:258` nawiguje do `/settings/integrations`, które renderuje `ConnectedAppsSettings.tsx`, korzystający z ZUPEŁNIE INNEGO systemu (tabela `integrations`, trasy `/api/settings/integrations/*`, `settings.routes.ts:1883-2032`) — governed connectors, o którym `CODEX_DAY369…REPORT.md` R5 już zmierzył `500 {}` na `google_drive/connect` i zgłosił jako osobny, większy dyżur (Q1, „20-30 linii na dostawcę”). Rodzina do usunięcia z `CloudDataSettings.tsx`: dedykowany test `tests/unit/components/settings/CloudDataSettings.honesty.test.tsx` (4 testy behawioralne, import realnego komponentu) ORAZ dwa testy źródło-czytające w `tests/integration/services/cloud-sync.p01ext.test.ts:274-291` (`'CloudDataSettings has sync button'`, `'CloudDataSettings supports all providers'`) — nieopisane przez zlecenie, znalezione w KROK 0. **R4** — `reachability --check-baseline` kończy się na bieżącym markerze kodem 1 z powodu 49 skumulowanych, nowych plików `test-only` (dług dyżurów 367-375, żaden pojedynczy dyżur nie może ich zaakceptować hurtowo — `--update-baseline` jest CAŁOŚCIOWY, odmawia gdy JAKIKOLWIEK nowy plik nie jest już w starym `baseline`, nie ma trybu selektywnego). Trzy z tych 49 są jawnie zlecone do adjudykacji: `src/utils/__tests__/initiativeBridgeFlag.envStaticRead.test.ts` (importuje `INITIATIVE_BRIDGE_FLAG_KEYS` z `../initiativeBridgeFlag.ts`, `app:true`), `src/utils/__tests__/zaiTeresaFlag.envStaticRead.test.ts` (importuje `ZAI_TERESA_FLAG_KEYS` z `../zaiTeresaFlag.ts`, `app:true`), `src/views/admin/__tests__/AdminSettingsModule.healthSectionI18n.test.ts` (czyta realne `public/locales/{pl,en}/translation.json`, zero mocków, guard i18n dla `AdminSettingsModule.tsx`, `app:true`) — wszystkie trzy legalne, nieosierocone testy. Ponieważ skrypt nie ma trybu selektywnego, ten dyżur DOPISUJE mu jeden, wąski, testowany tryb (`--update-baseline-add=<lista-plików>`), który dodaje WYŁĄCZNIE wskazane pliki do zaakceptowanych zbiorów, odmawiając, jeśli którykolwiek podany plik nie jest dziś `unreachable`/`test-only` — i używa go DOKŁADNIE na tych trzech plikach, zero innych."

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
> **wyłącznie** `/private/tmp/cx-day376-akcje-zrzut-porzadki`.

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
Zakres: ****13_CHAT** (R1, R2) + **Ustawienia/chmura** (R3) + **narzędzie osiągalności współdzielone przez cały program** (R4). Cztery niezależne, małe pozycje pozostawione otwarte przez dyżury 368/369/373: (R1) dev-render zrzut PL/EN × light/dark przycisku „Akcje biznesowe” za lokalnie włączoną flagą `chatBusinessActionsNav` + ponowna weryfikacja tezy o ARG/ENV Dockera; (R2) domknięcie usunięcia `InputHintStrip.tsx` po rozszerzeniu licencji o drugi mock; (R3) usunięcie martwego duplikatu `CloudDataSettings.tsx` + pisemne ustalenie, która trasa realnie obsługuje „Zarządzaj źródłami w chmurze” w Czacie i czy ma ochronę tokenem równoważną tej z dyżuru 369; (R4) wąski, testowany tryb selektywnej aktualizacji `reachability.baseline.json` dla dokładnie trzech zastanych plików testowych. Zero zmian w `server/src/**` poza CZYTANIEM (R3 dowód).**.
Trasy front: ``src/components/AIChat/UnifiedChatPanel.tsx` (TYLKO ODCZYT — cel R1 to zrzut, nie zmiana kodu), `src/hooks/useFeatureFlags.tsx` (TYLKO ODCZYT — weryfikacja mechanizmu flagi), `dev-render/screens/chat-split-teresa-right.tsx` (TYLKO ODCZYT — wzorzec) + NOWY plik `dev-render/screens/chat-business-actions-nav.tsx` (R1) · `src/components/AIChat/InputHintStrip.tsx` + `src/components/AIChat/__tests__/InputHintStrip.test.tsx` (USUWANE, R2) + dwie linie mocków w `src/components/AIChat/__tests__/EnhancedChatInput.teresaVoice.test.tsx` i `tests/components/AIChat/EnhancedChatInput.teresa-error-toast.test.tsx` (R2) · `src/components/settings/CloudDataSettings.tsx` (USUWANY, R3) + `tests/unit/components/settings/CloudDataSettings.honesty.test.tsx` (USUWANY, R3) + dwa testy w `tests/integration/services/cloud-sync.p01ext.test.ts` (R3) + TYLKO ODCZYT: `src/components/settings/ConnectedAppsSettings.tsx`, `src/components/AIChat/AddFilesMenu.tsx`, `src/components/AIChat/CloudFilePicker.tsx`, `src/services/api.ts` (fragmenty `listCloudFiles`/`Api.get('/api/cloud/sources')`) · `scripts/dev/reachability-from-root.mjs` (R4 — WĄSKA LICENCJA NA DOPISANIE JEDNEGO TRYBU CLI, patrz tabela licencji) + `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` (R4, WYŁĄCZNIE przez nowy tryb) + nowy test dla tego trybu.`. Trasy tył: `**BRAK zmian.** R3 czyta (nie zmienia) `server/src/routes/cloud.routes.ts` (`POST /api/cloud/sources`, zabezpieczone w dyżurze 369) i `server/src/routes/settings.routes.ts` (`/integrations/:provider/connect` i sąsiednie, governed connectors) wyłącznie jako dowód `plik:linia` do raportu. Żaden z czterech punktów tego dyżuru nie dotyka `server/src/**` do zapisu, żadna baza danych nie jest wymagana do żadnej pozycji — cały dyżur jest frontendowy + jeden skrypt Node (R4) uruchamiany lokalnie bez sieci.`.

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
WT=/private/tmp/cx-day376-akcje-zrzut-porzadki
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
git -C "$VAULT" worktree add "$WT" -b codex/day376-akcje-zrzut-porzadki-20260905 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day376-akcje-zrzut-porzadki/config.worktree"
cat "$VAULT/worktrees/cx-day376-akcje-zrzut-porzadki/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day376-akcje-zrzut-porzadki-scratch
mkdir -p /private/tmp/cx-day376-akcje-zrzut-porzadki-artefakty

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
git -C "$WT" push github-backup codex/day376-akcje-zrzut-porzadki-20260905
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 8f60ab998734adcdf61a080f4e1270c3dbdffceb..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `dwanaście` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) R1 — flaga istnieje, domyslnie OFF, gdzie jest fallback
grep -n "chatBusinessActionsNav" src/hooks/useFeatureFlags.tsx src/components/AIChat/UnifiedChatPanel.tsx
#   moje liczby: useFeatureFlags.tsx:111 (id), :114 (defaultValue:false), :117 (allowLocalOverride:true);
#   UnifiedChatPanel.tsx:816 (isEnabled), :817-819 (handleNavigateToActions fallback -> ROUTES.AI_ACTIONS),
#   :6805-6820 (render przycisku, data-testid="chat-business-button").

# (2) R1 — teza ODBIOR_368: BRAK ARG/ENV w Dockerfile dla CALEGO DEFAULT_FLAGS, nie tylko tej flagi
bash -c "grep -n 'chatBusinessActionsNav\|myWorkNotebookV2\|assessmentFiveSurfacesV1' Dockerfile.api Dockerfile.frontend"
#   moje liczby: ZERO trafien w obu plikach dla wszystkich trzech nazw flag DEFAULT_FLAGS — spojne,
#   potwierdza ze caly system DEFAULT_FLAGS (25 wpisow w useFeatureFlags.tsx) nie korzysta z ARG Dockera.
grep -n "import.meta.env" src/hooks/useFeatureFlags.tsx
#   moje liczby: 0 trafien — DEFAULT_FLAGS nie czyta VITE_* w ogole, tylko localStorage/remote/rollout/default.

# (3) R1 — precedens dev-render bez logowania dla realnego UnifiedChatPanel
sed -n '1,25p;60,80p' dev-render/screens/chat-split-teresa-right.tsx
#   moje liczby: plik istnieje, 142 linie, montuje <UnifiedChatPanel mode="full"> realny import z
#   src/components/AIChat/UnifiedChatPanel.tsx, zero ekranu logowania, useAppStore.setState ustawia
#   currentUser+currentOrganization jawnie PRZED renderem.

# (4) R2 — cala rodzina InputHintStrip (KROK 0)
bash -c "grep -rn 'InputHintStrip' src/ tests/ dev-render/"
#   moje liczby: definicja+eksport w InputHintStrip.tsx (4 wystapienia wlasne), dedykowany test
#   InputHintStrip.test.tsx (12 wystapien wlasnych), DWA mocki w cudzych testach:
#   src/components/AIChat/__tests__/EnhancedChatInput.teresaVoice.test.tsx:98 oraz
#   tests/components/AIChat/EnhancedChatInput.teresa-error-toast.test.tsx:85. Zero innych trafien.

# (5) R2 — klasyfikacja osiagalnosci od korzenia
node scripts/dev/reachability-from-root.mjs > /tmp/reach376-verify.json
python3 -c "
import json
d=json.load(open('/tmp/reach376-verify.json'))
for r in d['files']:
    if 'InputHintStrip' in r['file']: print(r['classification'], r['file'])
"
#   moje liczby: test-only dla src/components/AIChat/InputHintStrip.tsx (zero importera w app/harness).

# (6) R3 — cala rodzina CloudDataSettings (KROK 0), w tym plik NIEWYMIENIONY w zleceniu
bash -c "grep -rln 'CloudDataSettings' src/ tests/ dev-render/"
#   moje liczby: src/components/settings/CloudDataSettings.tsx (definicja),
#   tests/unit/components/settings/CloudDataSettings.honesty.test.tsx (dedykowany, 4 testy behawioralne),
#   tests/integration/services/cloud-sync.p01ext.test.ts (DWA testy zrodlo-czytajace, linie :274-291,
#   NIEOPISANE przez zlecenie — znalezisko wlasne, wchodzi do licencji tego dyzuru).

# (7) R3 — ktora trasa jest zywa, ktora martwa
python3 -c "
import json
d=json.load(open('/tmp/reach376-verify.json'))
for r in d['files']:
    if r['file'] in ('src/components/settings/CloudDataSettings.tsx','src/components/settings/ConnectedAppsSettings.tsx','src/components/AIChat/ActionCenter.tsx'):
        print(r['classification'].ljust(12), r['file'])
"
#   moje liczby: test-only CloudDataSettings.tsx; app ConnectedAppsSettings.tsx; app ActionCenter.tsx.

# (8) R3 — jedyny wolacz POST /api/cloud/sources w calym src/
bash -c "grep -rn \"cloud/sources\" src/ server/src/ | grep -v __tests__"
#   moje liczby: jedyny POST tworzacy zrodlo to CloudDataSettings.tsx:142 (Api.post('/api/cloud/sources',...));
#   pozostale odwolania w services/api.ts sa GET (listCloudFiles i pochodne, linie 18131-18210).

# (9) R3 — AddFilesMenu/CloudFilePicker: ktora bramka, ktory link "Zarzadzaj"
grep -n "listCloudFiles\|/settings/integrations\|cloud/sources" src/components/AIChat/CloudFilePicker.tsx src/components/AIChat/AddFilesMenu.tsx src/services/api.ts | head -20
#   moje liczby: CloudFilePicker.tsx:106 wola Api.listCloudFiles (GET /api/cloud/sources, services/api.ts:18151);
#   AddFilesMenu.tsx:258 navigate('/settings/integrations') — DWIE ROZNE trasy/tabele, nie ta sama bramka.

# (10) R4 — pelny pomiar + trzy pliki docelowe + check-baseline
node scripts/dev/reachability-from-root.mjs --check-baseline; echo "reach=$?"
python3 -c "
import json
d=json.load(open('/tmp/reach376-verify.json'))
for n in ['initiativeBridgeFlag.envStaticRead','zaiTeresaFlag.envStaticRead','AdminSettingsModule.healthSectionI18n']:
    for r in d['files']:
        if n in r['file']: print(r['classification'], r['file'])
"
#   moje liczby: reach=1, log wypisuje 49 nowych plikow test-only (dlug 367-375); wszystkie trzy pliki
#   docelowe klasyfikuja sie test-only i ZADEN nie jest jeszcze w baseline.

# (11) i18n + trzy bezpieczniki kanonu (nie R4 — te sa NIEZALEZNE od reachability)
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
#   moje liczby: leaf pl 35294 / en 33154; focus=0 list=0 artefakt=0.

# (12) rejestr znalezisk, dysk, porty, kontenery
bash -c "grep -nE '^## [A-Z]+\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"
df -h /
lsof -nP -iTCP:6447 -sTCP:LISTEN; lsof -nP -iTCP:5587 -sTCP:LISTEN
docker ps -a --format '{{.Names}}' | grep -c cx-day376 || true
#   moje liczby: ostatnia litera AM (dyzur 373) -> Twoj wpis dostaje AN, SPRAWDZ PONOWNIE tuz przed
#   commitem; ~34 GiB wolne; oba porty puste; 0 kontenerow cx-day376.
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day376-akcje-zrzut-porzadki-20260905` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6447`. Twój JEDYNY port harnessu to `5587`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day376-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta restricted ports Chromium. Zajęte przez hosta: 3000, 3020-3030, 5432, 5433, 6379. Rodzeństwo tej samej fali 05.09, NIE dotykasz ich portów/plików/gałęzi: 367-373 już scalone do markera (porty 6438-6444/5578-5584, zwolnione, ale historycznie ich — nie zajmuj ponownie żadnego z nich na wypadek nakładki); bieżące/następne dyżury tej podfali: 374 (baza 6445/harness 5585), 375 (6446/5586), 377 (6448/5588). Twoje własne wyłącznie: baza 6447, harness 5587. ★ ZAKAZ `pkill`/`killall` — zabijasz wyłącznie własne PID-y (zapisz `$!`).`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `**ZERO NOWYCH FLAG.** `chatBusinessActionsNav` już istnieje (dyżur 368, `defaultValue:false`) — ten dyżur go NIE zmienia, tylko go DOKUMENTUJE zrzutem z LOKALNIE włączoną flagą (override w `localStorage` własnego dev-render ekranu, nigdy w kodzie produktu). R2 i R3 usuwają martwy kod — mniej UI, nie więcej, więc bez flagi. R4 to zmiana narzędzia deweloperskiego (skrypt CI), nie UI. Żadna pozycja tego dyżuru nie zmienia domyślnej wartości żadnej flagi ani nie odsłania niczego nowego użytkownikowi produkcyjnemu.`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh --ci`, `scripts/check-artefakt.sh`, `node scripts/dev/reachability-from-root.mjs --check-baseline` (R4 dodaje mu nowy tryb — WĄSKA LICENCJA, patrz tabela), `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`, `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` (wszystkie 16). Wszystkie NIETYKALNE DO ZAPISU poza jawnie opisanym wąskim wyjątkiem `reachability-from-root.mjs` w tabeli licencji.`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY376_AKCJE_ZRZUT_PORZADKI_REPORT.md`. Jedyne inne dokumenty do zmiany: **jedna nowa sekcja** w `docs/program/REJESTR_ZNALEZISK_20260903.md` o PIERWSZEJ WOLNEJ literze (w chwili pisania tej instrukcji ostatnia użyta to `AM`, dyżur 373 — sprawdź komendą `bash -c "grep -nE '^## [A-Z]+\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"` TUŻ PRZED commitem, bo równolegle piszą autorzy 374/375/377) — spodziewana litera `AN`, ale TWÓJ pomiar rozstrzyga · nowy katalog dowodowy `evidence/akcje-zrzut-porzadki-20260905/` (NIE ISTNIEJE na markerze — tworzysz) · WĄSKO: `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json`, WYŁĄCZNIE przez nowy tryb `--update-baseline-add` dodany w `R4`, WYŁĄCZNIE dla trzech imiennie wskazanych plików. ★★★ MACIERZ ODBIORU JEST NIETYKALNA W TYM DYŻURZE — żaden wiersz, żaden moduł. Plik postępu `/private/tmp/cx-day376-akcje-zrzut-porzadki-scratch/postep.md` żyje POZA repo. Nowe testy w `tests/` (R4: test nowego trybu skryptu) wymagają `git add -f` — sprawdź SAM przed commitem czy dotyczy.. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day376-akcje-zrzut-porzadki-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day376-akcje-zrzut-porzadki-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ ZMIANY WARTOŚCI `defaultValue` FLAGI `chatBusinessActionsNav`.** Zostaje `false`. R1 dostarcza WYŁĄCZNIE zrzut z lokalnym override'em w dev-render — zero zmiany w `useFeatureFlags.tsx` poza (jeśli Twój pomiar to potwierdzi) dodaniem ARG/ENV do Dockerfile, co jest samo w sobie WARUNKOWE (patrz `R1` pkt 2) i NIGDY nie zmienia, co flaga robi w kodzie. ★★★ **ZAKAZ MECHANICZNEGO DOPISANIA MARTWEGO ARG-a.** Jeżeli Twój pomiar potwierdzi tezę `ODBIOR_368.md` (flaga jest w pełni client-side + zdalny override przez bazę, ZERO odczytu `import.meta.env.VITE_*` w całym `DEFAULT_FLAGS`), NIE dopisujesz `ARG VITE_CHAT_BUSINESS_ACTIONS_NAV`/`ENV` do żadnego Dockerfile — taki wpis byłby fantomem (nic go nie czyta), a `Dockerfile.frontend` ma własny, jawny bezpiecznik przeciwko dokładnie odwrotnemu błędowi (flaga kliencka BEZ ARG-a), nie przeciwko nadmiarowi. Zamiast tego piszesz w raporcie: „zweryfikowano ponownie, teza `ODBIOR_368` się potwierdza, ARG pominięty celowo, uzasadnienie: …”. ★★★ **ZAKAZ LOGOWANIA/PIN-U W DEV-RENDER.** Zrzut R1 idzie WYŁĄCZNIE przez wzorzec `chat-split-teresa-right.tsx` (`useAppStore.setState`, zero realnego backendu, zero ekranu logowania) — jeśli napotkasz ekran logowania, to znaczy że nie skopiowałeś wzorca poprawnie, nie że zrzut jest niemożliwy. ★★ **ZAKAZ USUNIĘCIA `InputHintStrip.tsx` BEZ OBU MOCKÓW W JEDNYM COMMICIE.** `src/components/AIChat/__tests__/EnhancedChatInput.teresaVoice.test.tsx:98` I `tests/components/AIChat/EnhancedChatInput.teresa-error-toast.test.tsx:85` idą w TYM SAMYM commicie co usunięcie komponentu i jego dedykowanego testu — usunięcie tylko jednego z dwóch mocków zostawia dziurawy import w drugim. ★★ **ZAKAZ ROZSZERZANIA NAPRAWY NA GOVERNED CONNECTORS.** `500 {}` na `/api/settings/integrations/google_drive/connect` (zmierzone w dyżurze 369, R5) jest POZA ZAKRESEM — nie naprawiasz go, nie dotykasz `settings.routes.ts` do zapisu, tylko cytujesz jako dowód w `R3`. Jeśli Twój pomiar potwierdzi brak równoważnej ochrony tokenem w tej trasie, piszesz to jako pytanie do właściciela z rekomendacją zakresu następnego dyżuru — NIE próbujesz scalić dwóch systemów w tym dyżurze. ★★ **ZAKAZ USUNIĘCIA `CloudDataSettings.tsx` BEZ TRZECH PLIKÓW RODZINY.** Dedykowany test (`tests/unit/components/settings/CloudDataSettings.honesty.test.tsx`) usuwasz w CAŁOŚCI; z `tests/integration/services/cloud-sync.p01ext.test.ts` usuwasz WYŁĄCZNIE dwa imiennie wskazane `it()` (`:274-291`), resztę pliku (`CloudFilePicker`, `Api service`, backend `CONNECTORS`) zostawiasz nietkniętą. ★★ **ZAKAZ EDYCJI `reachability.baseline.json` RĘCZNIE.** R4 dopisuje skryptowi NOWY, WĄSKI tryb (`--update-baseline-add=<lista>`) i URUCHAMIA GO — zero edycji pliku JSON edytorem tekstu, zero copy-paste wartości. ★★ **ZAKAZ UŻYCIA NOWEGO TRYBU DO CZEGOKOLWIEK POZA TRZEMA WSKAZANYMI PLIKAMI.** Pozostałych 46 nowych plików `test-only`/`unreachable` (dług 367-375) ZOSTAJE czerwone w `--check-baseline` — to oczekiwane i opisane w `R4`, nie Twoja regresja i nie Twoje zadanie. ★ **ZAKAZ `.skip`, `.todo`, `--retry` innego niż `0`, poszerzania `exclude`** (`Z35`). ★ **ZAKAZ PORÓWNANIA LICZBY TESTÓW BEZ PEŁNYCH NAZW** (`Z37`) — każde usunięcie/dodanie testu dokumentujesz `fullName`, nie samą liczbą. | Bo trzy z czterech pozycji to dokończenie dyżurów, które same, uczciwie, zatrzymały się na warunku wejściowym zamiast improwizować: 368 nie miał dowodu, że zrzut jest w ogóle możliwy bez PIN-u (jest — precedens leży w repo od dawna); 373 znalazł drugi mock, którego instrukcja nie przewidziała, i słusznie nie usunął komponentu na pół (teraz licencja jest pełna); 369 zmierzył, że martwy ekran jest jedynym wołaczem naprawionej bramki, i zapytał, co z nim zrobić (odpowiedź: usuń, i sprawdź czy żywy ekran nie ma tej samej dziury, którą 369 załatał w martwym). Czwarta pozycja jest inna: to nie dokończenie cudzego STOP-u, tylko naprawa samego mechanizmu, który przez pięć dni pracy równoległej urósł do stanu, w którym żaden pojedynczy dyżur nie mógł już legalnie zaktualizować bezpiecznika bez przejęcia cudzego długu. Odkładanie tego dalej oznacza, że dziewiąty i dziesiąty autor natrafi na ten sam mur. |

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
cd /private/tmp/cx-day376-akcje-zrzut-porzadki

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day376-pg psql -U postgres -d cx376 \
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
cd /private/tmp/cx-day376-akcje-zrzut-porzadki

docker run -d --name cx-day376-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx376 \
  -p 127.0.0.1:6447:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day376-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6447/cx376 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6447/cx376 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day376-akcje-zrzut-porzadki && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6447/cx376 \
JWT_SECRET=cx376-test-secret-do-not-reuse-min-32-znaki \
npx vitest run Wszystkie testy tego dyżuru to testy FRONTU/narzędziowe, `RUN_DB_TESTS=0 MOCK_DB=true` (zero bazy, zero serwera potrzebne do R1-R4). Uruchamiaj per plik: `npx vitest run <plik> --retry=0 --reporter=json --outputFile=/private/tmp/cx-day376-akcje-zrzut-porzadki-artefakty/<etykieta>.json`. Nowy test trybu `--update-baseline-add` (R4) kolokujesz w `scripts/dev/__tests__/reachability-from-root.updateBaselineAdd.test.mjs` lub `tests/` root wg tego, gdzie dziś leżą testy innych skryptów `scripts/dev/` (sprawdź SAM — jeśli nie istnieje żaden istniejący wzorzec testowania skryptu w `scripts/dev/`, kolokuj obok skryptu i udokumentuj wybór). Zakaz pełnego `vitest`/`tsc` bez filtra pliku. Zrzuty R1 przez jednorazowy skrypt Playwright `scripts/dev/akcje-zrzut-porzadki-screenshots.mjs` (wzorzec: `scripts/dev/idbridge-screenshots.mjs` — fresh `browser.newContext` per zrzut, `colorScheme` z `theme`, `page.goto(...,{waitUntil:'networkidle'})`), przeciwko `npx vite --config dev-render/vite.config.ts --port 5587` uruchomionemu w tle (zapisz `$!`, zabij TYLKO ten PID na koniec). --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day376-akcje-zrzut-porzadki-artefakty/day376-akcje-zrzut-porzadki.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day376-akcje-zrzut-porzadki && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run Wszystkie testy tego dyżuru to testy FRONTU/narzędziowe, `RUN_DB_TESTS=0 MOCK_DB=true` (zero bazy, zero serwera potrzebne do R1-R4). Uruchamiaj per plik: `npx vitest run <plik> --retry=0 --reporter=json --outputFile=/private/tmp/cx-day376-akcje-zrzut-porzadki-artefakty/<etykieta>.json`. Nowy test trybu `--update-baseline-add` (R4) kolokujesz w `scripts/dev/__tests__/reachability-from-root.updateBaselineAdd.test.mjs` lub `tests/` root wg tego, gdzie dziś leżą testy innych skryptów `scripts/dev/` (sprawdź SAM — jeśli nie istnieje żaden istniejący wzorzec testowania skryptu w `scripts/dev/`, kolokuj obok skryptu i udokumentuj wybór). Zakaz pełnego `vitest`/`tsc` bez filtra pliku. Zrzuty R1 przez jednorazowy skrypt Playwright `scripts/dev/akcje-zrzut-porzadki-screenshots.mjs` (wzorzec: `scripts/dev/idbridge-screenshots.mjs` — fresh `browser.newContext` per zrzut, `colorScheme` z `theme`, `page.goto(...,{waitUntil:'networkidle'})`), przeciwko `npx vite --config dev-render/vite.config.ts --port 5587` uruchomionemu w tle (zapisz `$!`, zabij TYLKO ten PID na koniec). --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day376-akcje-zrzut-porzadki-artefakty/day376-akcje-zrzut-porzadki.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day376-akcje-zrzut-porzadki/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day376-pg psql -U postgres -d cx376 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day376-pg`.
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
> **(e) ★★★ **PIĘĆ PUŁAPEK.** (1) **„BLOCKED_AUTH” bywa wygodnym skrótem, nie faktem.** 368 zgłosił zerowy dowód wizualny, bo „lokalny PIN” — ale `dev-render/` w ogóle nie przechodzi przez ekran logowania produktu, jeśli zaszyjesz store tak jak `chat-split-teresa-right.tsx`; sprawdź precedens PRZED napisaniem własnego STOP-u. (2) **`FeatureFlagsProvider` bez `config={{enableLocalOverrides:true}}` ignoruje `localStorage`.** `useFeatureFlags.tsx` ma priorytet local>remote>rollout>default, ale TYLKO gdy `enableLocalOverrides` jest `true` w konfiguracji providera — produkcyjny `AppProviders.tsx` przekazuje to warunkowo przez `VITE_ENABLE_LOCAL_FEATURE_FLAG_OVERRIDES`; Twój dev-render ekran musi ustawić to jawnie w propsie, inaczej override w `localStorage` jest po cichu ignorowany i zrzut pokaże flagę OFF mimo ustawionego `localStorage`. (3) **Dwa różne systemy „cloud” w tym samym repo.** `cloud_sources`/`POST /api/cloud/sources` (naprawiony w 369) i `integrations`/`/api/settings/integrations/*` (governed connectors, wciąż `500` na `google_drive`) NIE dzielą żadnej tabeli ani trasy — merge ich w jednym dyżurze to inny, większy projekt; pomyl je i napiszesz fałszywe „ta sama bramka” w raporcie. (4) **`reachability-from-root.mjs --update-baseline` jest całościowy z konstrukcji** (`unreachable.some(f=>!previous.files.includes(f))` — jedno odrzucenie blokuje CAŁY zapis) — nie próbuj obejść tego przez uruchomienie go zwyczajnie po ręcznym dopisaniu trzech plików do JSON-a najpierw: to nadal byłaby ręczna edycja, tylko oklejona wywołaniem skryptu potem. (5) **Test-only nie znaczy osierocony.** Wszystkie trzy pliki z `R4` importują żywy, `app:true` moduł (albo czytają żywy zasób i18n) — „test-only” tu opisuje WYŁĄCZNIE brak montażu w `src/index.tsx`/`dev-render/main.tsx`, nie brak wartości; nie myl tego ze stanem `InputHintStrip.tsx`/`CloudDataSettings.tsx`, gdzie test-only oznacza faktycznie martwy komponent produkcyjny.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day376-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day376-akcje-zrzut-porzadki-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R0 (twarde zasady: dowod przez realny montaz bez logowania, KROK 0 rodziny przed kazdym usunieciem, zakaz martwego ARG-a, licencja skryptu bezpiecznika wyłącznie na jeden nowy tryb) · R1 (zrzut dev-render PL/EN x light/dark przycisku Akcje biznesowe za lokalnym override flagi + ponowna weryfikacja tezy Dockera — RDZEN) · R2 (dokonczenie usuniecia InputHintStrip.tsx + oba mocki w jednym commicie — RDZEN) · R3 (usuniecie CloudDataSettings.tsx + jego rodziny + pisemne ustalenie ktora trasa jest zywa i czy ma rownowazna ochrone tokenem — RDZEN) · R4 (dopisanie wąskiego, testowanego trybu --update-baseline-add do reachability-from-root.mjs i uzycie go na trzech wskazanych plikach — RDZEN) · R5 (raport i pytania do wlasciciela)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6447` albo `5587` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6447` albo `5587`** (`Z7`).

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

Cztery małe, niezależne domknięcia zostawione przez dyżury 368/369/373 — każdy
z nich zatrzymał się uczciwie na warunku wejściowym zamiast improwizować.
Ten dyżur nie otwiera nowego śledztwa: dokańcza trzy zamknięte STOP-y i
naprawia jeden mechanizm, który sam stanął w poprzek pracy.

**R1 — zrzut przycisku „Akcje biznesowe” (dyżur 368).** 368 podpiął żywy cel
nawigacji za flagą `chatBusinessActionsNav` (`useFeatureFlags.tsx:111-118`,
`defaultValue:false`) i fallback wewnątrz `UnifiedChatPanel.tsx:816-819`
(`handleNavigateToActions`). Raport 368 zgłosił `BLOCKED_AUTH` — rzekomy brak
możliwości zrzutu bez PIN-u lokalnego produktu. **To jest fałszywy STOP.**
`dev-render/screens/chat-split-teresa-right.tsx` (istnieje na markerze) montuje
DOKŁADNIE ten sam `<UnifiedChatPanel mode="full">`, bez logowania, zaszywając
`useAppStore.setState({currentUser: …})` przed renderem. Ten sam wzorzec plus
lokalny override flagi w `localStorage` wystarczy do zrzutu. Dodatkowo:
zlecenie tego dyżuru każe dopisać ARG/ENV `VITE_*` do obu Dockerfile-ów „bo bez
tego flaga nigdy nie wejdzie na staging” — ale `ODBIOR_368.md` (wiersz 12) już
to zmierzył i rozstrzygnął w drugą stronę: `chatBusinessActionsNav` żyje w
`DEFAULT_FLAGS`, systemie w pełni client-side (stała TS w bundlu) plus
opcjonalny zdalny override przez `GET {API_URL}/feature-flags/runtime` — INNY
mechanizm niż flagi `VITE_*` budowane w Dockerze. Ten dyżur ma tę tezę
zweryfikować PONOWNIE, nie mechanicznie dopisać martwy ARG.

**R2 — dokończenie usunięcia `InputHintStrip.tsx` (dyżur 373).** 373 zmierzył
`test-only` i chciał usunąć, ale KROK 0 znalazł DRUGI, nielicencjonowany mock
w `tests/components/AIChat/EnhancedChatInput.teresa-error-toast.test.tsx:85`
(obok już licencjonowanego `EnhancedChatInput.teresaVoice.test.tsx:98`) i
słusznie się zatrzymał, zamiast usuwać komponent na pół. `CODEX_DAY373_…
REPORT.md` sekcja „STOP — InputHintStrip” pyta wprost, czy rozszerzyć
licencję o tę jedną linię. **Ten dyżur odpowiada TAK.**

**R3 — usunięcie martwego duplikatu `CloudDataSettings.tsx` (dyżur 369).**
369 naprawił bramkę `POST /api/cloud/sources` (wymaga realnego, per-user
tokenu OAuth) i uczciwie udokumentował, że jej jedynym wołaczem jest martwy
`CloudDataSettings.tsx` — pytanie 2 do właściciela brzmiało: podłączyć czy
usunąć. **Ten dyżur usuwa** (zgodnie z zamówieniem), i dodatkowo ustala
pisemnie, którą trasę realnie widzi użytkownik pod „Zarządzaj źródłami w
chmurze” w Czacie, i czy ma ona ochronę tokenem równoważną tej z 369.

**R4 — bezpiecznik osiągalności utknął na całościowym mechanizmie.**
`reachability --check-baseline` kończy się dziś kodem `1` z powodu 49
skumulowanych nowych plików `test-only` (dług pięciu dni pracy równoległej,
dyżury 367-375) — żaden pojedynczy dyżur nie mógł ich zaakceptować, bo
`--update-baseline` jest CAŁOŚCIOWY (odmawia zapisu, jeśli JAKIKOLWIEK nowy
plik nie jest już w starym baseline — dokładnie to zablokowało `--update-
baseline` w dyżurach 368 i 369, obaj to udokumentowali). Trzy z tych 49 są
jawnie zlecone do adjudykacji tutaj. Ponieważ skrypt nie ma trybu
selektywnego, ten dyżur mu go dopisuje — wąsko, testowanie, i używa go
DOKŁADNIE na tych trzech plikach.

## ★ Stan zastany, zmierzony przeze mnie na markerze `8f60ab998734adcdf61a080f4e1270c3dbdffceb`

| Co | Wartość zmierzona | Gdzie |
| --- | --- | --- |
| `chatBusinessActionsNav` — definicja i fallback | istnieje, `defaultValue:false`, fallback do `ROUTES.AI_ACTIONS` | `useFeatureFlags.tsx:111-118`, `UnifiedChatPanel.tsx:816-819,6805-6820` |
| ARG/ENV `VITE_*` dla `chatBusinessActionsNav`/`myWorkNotebookV2`/`assessmentFiveSurfacesV1` w obu Dockerfile | **0** wystąpień, dla wszystkich trzech, w obu plikach | `Dockerfile.api`, `Dockerfile.frontend` |
| `import.meta.env` w `useFeatureFlags.tsx` | **0** wystąpień — cały `DEFAULT_FLAGS` rozstrzyga się przez local override/remote DB/rollout/default, nigdy przez `VITE_*` | `src/hooks/useFeatureFlags.tsx` (`flags` `useMemo`, linie ~530-570) |
| precedens dev-render montujący realny `UnifiedChatPanel` bez logowania | **istnieje**, 142 linii, `useAppStore.setState` zamiast realnego auth | `dev-render/screens/chat-split-teresa-right.tsx` |
| rodzina `InputHintStrip` (KROK 0) | komponent + dedykowany test + **2** mocki w cudzych testach | `InputHintStrip.tsx`, `__tests__/InputHintStrip.test.tsx`, `EnhancedChatInput.teresaVoice.test.tsx:98`, `tests/components/AIChat/EnhancedChatInput.teresa-error-toast.test.tsx:85` |
| klasyfikacja `InputHintStrip.tsx` (osiągalność od korzenia) | `test-only` | `node scripts/dev/reachability-from-root.mjs` |
| rodzina `CloudDataSettings` (KROK 0) | komponent + dedykowany test + **2** testy źródło-czytające w cudzym pliku (nieopisane przez zlecenie) | `CloudDataSettings.tsx`, `tests/unit/components/settings/CloudDataSettings.honesty.test.tsx`, `tests/integration/services/cloud-sync.p01ext.test.ts:274-291` |
| klasyfikacja `CloudDataSettings.tsx` / `ConnectedAppsSettings.tsx` / `ActionCenter.tsx` | `test-only` / `app` / `app` | `reachability-from-root.mjs` |
| jedyny wołacz `POST /api/cloud/sources` (tworzenie źródła) w `src/` | `CloudDataSettings.tsx:142` | `grep -rn "cloud/sources" src/` |
| trasa realnie wywoływana przez `AddFilesMenu`/`CloudFilePicker` w Czacie | `GET /api/cloud/sources` (odczyt, `Api.listCloudFiles`) do listowania; link „Zarządzaj” nawiguje do `/settings/integrations` → `ConnectedAppsSettings.tsx` (INNY system, tabela `integrations`) | `CloudFilePicker.tsx:106`, `AddFilesMenu.tsx:258`, `services/api.ts:18148-18164` |
| stan trasy governed connectors (`/api/settings/integrations/:provider/connect`) | `500 {}` na `google_drive`, zmierzone niezależnie w dyżurze 369 (R5), poza zakresem tego dyżuru | `CODEX_DAY369_CHMURA_OAUTH_REPORT.md` §R5 |
| `reachability --check-baseline` na markerze | `exit 1`, **49** nowych plików `test-only` (dług 367-375) | komenda (10) `§0.3` |
| klasyfikacja trzech plików docelowych `R4` | wszystkie **`test-only`**, żaden jeszcze nie w baseline | `src/utils/__tests__/initiativeBridgeFlag.envStaticRead.test.ts`, `.../zaiTeresaFlag.envStaticRead.test.ts`, `src/views/admin/__tests__/AdminSettingsModule.healthSectionI18n.test.ts` |
| co importują/czytają te trzy pliki | dwa importują żywy (`app:true`) moduł flagi; jeden czyta realne `public/locales/{pl,en}/translation.json`, zero mocków | patrz `R4` pkt 1 |
| leaf-count słowników | **pl 35294**, **en 33154** | `public/locales/{pl,en}/translation.json` |
| trzy bezpieczniki kanonu | focus=0, list=0, artefakt=0 | komenda (11) `§0.3` |
| ostatnia użyta litera w `REJESTR_ZNALEZISK_20260903.md` w chwili pisania | `AM` (dyżur 373) | `grep -nE '^## [A-Z]+\.' … \| tail -3` — **sprawdź SAM tuż przed commitem** |
| tip gałęzi bazowej vs marker | marker jest przodkiem, tip uciekł o **1** commit (`d8d03863da`, drobna poprawka typu w `UnifiedChatPanel.tsx`, niezwiązana z żadną pozycją tego dyżuru) | `git log --oneline <MARKER>..github-backup/grafika/m03-20260902` |

## ★ Zmierz moje liczby sam

Twierdzę, na markerze: **0** wystąpień ARG/ENV `VITE_*` dla jakiejkolwiek
flagi `DEFAULT_FLAGS` w obu Dockerfile (nie tylko `chatBusinessActionsNav`);
**0** odczytów `import.meta.env` w całym `useFeatureFlags.tsx`; precedens
dev-render (`chat-split-teresa-right.tsx`) montuje realny komponent bez
logowania; rodzina `InputHintStrip` = komponent + test + **2** mocki (nie 1);
rodzina `CloudDataSettings` = komponent + **2** pliki testowe (jeden
dedykowany do usunięcia w całości, jeden do usunięcia częściowego — **2**
konkretne `it()`, nie cały plik); jedyny wołacz `POST /api/cloud/sources` to
`CloudDataSettings.tsx`; Czat naprawdę woła `GET /api/cloud/sources` do
odczytu i nawiguje do CAŁKIEM INNEJ trasy (`/settings/integrations`) do
zarządzania; `reachability --check-baseline` daje `exit 1` z **49** nowymi
plikami `test-only`, z których dokładnie **3** są w zakresie tego dyżuru.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ
pomiar — zapisz rozbieżność wprost.** W szczególności: jeżeli grep w Dockerfile
znajdzie COKOLWIEK dla którejkolwiek nazwy flagi `DEFAULT_FLAGS` — to obala
tezę `ODBIOR_368` i zmienia `R1` z „pomiń ARG” na „zbadaj dlaczego jest
wyjątek”; jeżeli rodzina `InputHintStrip`/`CloudDataSettings` ma więcej
członków niż tu wypisano — wklej pełną listę i rozszerz `R2`/`R3` o nie.

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz
zamiast zmiany brief z `plik:linia` oraz diff **nienałożony**. Pozycja z takim
produktem jest **ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Dev-render — nowy ekran (R1)** | `dev-render/screens/chat-business-actions-nav.tsx` (**NOWY**) | **PEŁNA LICENCJA** — wzorzec dosłowny `chat-split-teresa-right.tsx`: realny `<UnifiedChatPanel mode="full">`, `useAppStore.setState`, `<FeatureFlagsProvider config={{enableLocalOverrides:true}}>`, `localStorage` override flagi PRZED renderem. Zero zmian w `UnifiedChatPanel.tsx` | — |
| **Dev-render — rejestr ekranów** | `dev-render/main.tsx` | **★ WĄSKA LICENCJA**: dopisanie JEDNEGO wpisu `React.lazy` + wpisu w rejestrze `SCREENS` dla nowego ekranu, wzorem sąsiednich wpisów. **Zakaz** zmiany istniejących wpisów | — |
| **Komponent czatu — cel R1 (TYLKO ODCZYT)** | `src/components/AIChat/UnifiedChatPanel.tsx`, `src/hooks/useFeatureFlags.tsx` | **TYLKO ODCZYT** w tym dyżurze — R1 dostarcza zrzut, nie zmienia zachowania flagi. Jeśli pomiar (2) w `§0.3` obali tezę `ODBIOR_368` i pokaże, że flaga jednak potrzebuje ARG-a Dockera — patrz wiersz „Dockerfile” niżej, WCIĄŻ zero zmian w tych dwóch plikach | Brief, jeśli pomiar każe inaczej |
| **Dockerfile — WARUNKOWO (R1)** | `Dockerfile.api`, `Dockerfile.frontend` | **★ WARUNKOWA LICENCJA**: wolno dopisać `ARG VITE_CHAT_BUSINESS_ACTIONS_NAV` + `ENV VITE_CHAT_BUSINESS_ACTIONS_NAV=${VITE_CHAT_BUSINESS_ACTIONS_NAV}` **WYŁĄCZNIE** jeśli Twój pomiar (2) `§0.3` obali tezę `ODBIOR_368` (czyli znajdziesz JAKIKOLWIEK odczyt `import.meta.env.VITE_*` w ścieżce `chatBusinessActionsNav`, dziś go tam nie ma) I dopiszesz odpowiadający, wąski odczyt w kodzie w TYM SAMYM commicie. Jeśli pomiar POTWIERDZI tezę (oczekiwane) — **NIE dotykasz tych plików**, piszesz uzasadnienie w raporcie | Brief z uzasadnieniem „ARG pominięty celowo” |
| **`InputHintStrip` (R2, usuwany)** | `src/components/AIChat/InputHintStrip.tsx`, `src/components/AIChat/__tests__/InputHintStrip.test.tsx` | **LICENCJA NA USUNIĘCIE**, warunkowa TYLKO na potwierdzenie `test-only` przez Twój pomiar (oczekiwane, patrz stan zastany) | Jeśli pomiar pokaże `app`: zatrzymujesz się, brief |
| **Dwa mocki `InputHintStrip` (R2)** | `src/components/AIChat/__tests__/EnhancedChatInput.teresaVoice.test.tsx` (linia `:98`), `tests/components/AIChat/EnhancedChatInput.teresa-error-toast.test.tsx` (linia `:85`) | **★ WĄSKA LICENCJA NA USUNIĘCIE DOKŁADNIE JEDNEJ LINII W KAŻDYM** — `vi.mock(...)` wskazujący usuwany komponent. **Zakaz** jakiejkolwiek innej zmiany w tych dwóch plikach | — |
| **`CloudDataSettings` (R3, usuwany)** | `src/components/settings/CloudDataSettings.tsx`, `tests/unit/components/settings/CloudDataSettings.honesty.test.tsx` | **LICENCJA NA USUNIĘCIE W CAŁOŚCI**, warunkowa na potwierdzenie `test-only`/zero importera poza tym testem (oczekiwane) | Jeśli `app`: STOP, brief |
| **Dwa testy w cudzym pliku (R3)** | `tests/integration/services/cloud-sync.p01ext.test.ts`, WYŁĄCZNIE `it('CloudDataSettings has sync button', …)` i `it('CloudDataSettings supports all providers', …)` (linie `:274-291`) | **★ WĄSKA LICENCJA NA USUNIĘCIE DOKŁADNIE TYCH DWÓCH `it()`**. **Zakaz** dotykania `describe('Cloud Storage — Frontend')`'s pozostałych dwóch testów (`CloudFilePicker exists…`, `Api service has cloud file methods…`) i całej reszty pliku (backend `CONNECTORS`, sync) | — |
| **Ustalenie trasy „Zarządzaj źródłami” (R3, TYLKO ODCZYT)** | `src/components/settings/ConnectedAppsSettings.tsx`, `src/components/AIChat/AddFilesMenu.tsx`, `src/components/AIChat/CloudFilePicker.tsx`, `src/services/api.ts` (fragmenty `listCloudFiles`), `server/src/routes/cloud.routes.ts`, `server/src/routes/settings.routes.ts` | **TYLKO ODCZYT** — dowód do raportu (`plik:linia`), zero zmian. Governed connectors `500 {}` (dyżur 369 R5) POZA ZAKRESEM — cytujesz, nie naprawiasz | Wpis do raportu + pytanie do właściciela jeśli ochrona nierównoważna |
| **Skrypt bezpiecznika osiągalności (R4)** | `scripts/dev/reachability-from-root.mjs` | **★ WĄSKA LICENCJA NA DOPISANIE JEDNEGO NOWEGO TRYBU CLI** (`--update-baseline-add=<ścieżka1>,<ścieżka2>,…`) — patrz `R4` pkt 2 dla dokładnej specyfikacji. **Zakaz** zmiany istniejącego zachowania `--update-baseline`, `--check-baseline`, `--unreachable-only` czy trybu bezargumentowego (dump JSON) | Brief, jeśli zmiana okaże się niewykonalna bez ryzyka dla istniejących trybów |
| **Test nowego trybu (R4)** | nowy plik testowy dla `reachability-from-root.mjs --update-baseline-add` (lokalizacja do ustalenia przez Ciebie — patrz `§0.2` SCIEZKI) | **PEŁNA LICENCJA** — dowód zachowania: (a) dodaje wskazany plik, jeśli jest dziś `unreachable`/`test-only` i nie jest jeszcze w baseline; (b) ODRZUCA (kod ≠0, zero zapisu) jeśli wskazany plik jest `app`/`harness-only`; (c) NIE usuwa/nie zmienia żadnego istniejącego wpisu baseline; (d) idempotentny — drugie uruchomienie z tym samym plikiem nie zmienia niczego | — |
| **Baseline osiągalności (R4)** | `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` | **★ WĄSKA LICENCJA: WYŁĄCZNIE przez nowy tryb `--update-baseline-add`**, WYŁĄCZNIE dla trzech imiennie wskazanych plików. **Zakaz** edycji ręcznej, **zakaz** użycia zwykłego `--update-baseline` (całościowy, przejąłby pozostałe 46 nowych plików) | — |
| **Pozostałe 46 nowych plików `test-only`/`unreachable` (R4, poza zakresem)** | dowolne pliki z listy „New test-only files” poza trzema wskazanymi | **TYLKO ODCZYT — POZA ZAKRESEM.** Zostają czerwone w `--check-baseline` po tym dyżurze — to oczekiwane, opisz w raporcie | Wpis do raportu, lista plików |
| **Bezpieczniki kanonu (logika)** | `scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh`, `scripts/check-artefakt.sh` | **NIETYKALNE DO ZAPISU** — wolno wyłącznie URUCHAMIAĆ | Opis w raporcie |
| **Infrastruktura testowa** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**` | **TYLKO ODCZYT — `Z18`** | Opis w raporcie |
| **`server/src/**` — cały serwer** | — | **TYLKO ODCZYT.** Żadna trasa serwerowa nie jest dotykana w tym dyżurze | Brief, jeśli coś znajdziesz przypadkiem |
| **Macierz odbioru, rejestry bramek** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md`, `REJESTR_G15_SAMOKONTROLA_20260903.md`, `G19_INWENTARZ_OBOWIAZKOW_20260903.md` | **NIETYKALNE DO ZAPISU** — poza zakresem tego dyżuru | Rekomendacja w raporcie |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jedna nowa sekcja o pierwszej wolnej literze, sprawdzonej TUŻ PRZED commitem | — |
| **Nowe dowody** | `evidence/akcje-zrzut-porzadki-20260905/**` (**NIE ISTNIEJE — tworzysz**) | **PEŁNA LICENCJA** | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY376_AKCJE_ZRZUT_PORZADKI_REPORT.md` (**NOWY**) | `R5` — JEDYNY nowy dokument rejestrowy (`Z13`) | — |
| **Cudze tereny** | `docs/program/AUDYT_CZAT_PRZYCISKI_20260905/**`, rodzeństwo 367-375/377, governed connectors 500 (dyżur 369 R5), pozostałe defekty D-2/D-3/D-5/D-6 nieopisane tu | **TYLKO ODCZYT** | Wpis do raportu |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem `plik:linia` i idziesz dalej |

## ★★ WARUNKI WSPÓLNE SERII

Mierzysz **PRZED pierwszym commitem i PO ostatnim**, obie pary liczb do raportu:

```bash
cd "$WT"
# (a) liscie slownikow — TEN DYZUR NIE DODAJE ANI NIE USUWA ZADNEGO KLUCZA I18N,
#     wiec liczby maja byc IDENTYCZNE przed i po (zero pozycji dotyka public/locales/**)
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
#   moje liczby PRZED: pl 35294, en 33154 — PO: identyczne. Jesli sie zmienily, to jest
#   NARUSZENIE ROZLACZNOSCI (zaden R nie ma licencji na public/locales/**), nie osiagniecie.

# (b) trzy bezpieczniki kanonu maja konczyc sie kodem 0 -- NIEZALEZNE od tego dyzuru
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus-canon=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list-canon=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
#   moje liczby: wszystkie 0 na markerze, maja zostac 0.

# (c) reachability — PRZED: exit 1 z 49 nowymi plikami. PO R2/R3: 47 (dwa pliki produkcyjne
#     usuniete znikaja z listy kandydatow, NIE z listy "New" bo nigdy tam nie byly jako
#     unreachable nowe — sprawdz sam, czy usuniecie zmienia totals.unreachable/test-only).
#     PO R4: dokladnie 3 mniej w logu "New test-only files" (46 zostaje, to oczekiwane).
node scripts/dev/reachability-from-root.mjs --check-baseline; echo "reach=$?"
#   moje liczby PRZED: reach=1, 49 nowych plikow test-only. PO: reach=1 WCIAZ (46 zostaje —
#   to NIE jest regresja tego dyzuru), log ma zawierac DOKLADNIE 46 nazw, zaden z trzech
#   plikow R4 nie moze juz tam byc, InputHintStrip.tsx/CloudDataSettings.tsx znikaja z totals
#   (usuniete pliki nie istnieja, wiec nie sa juz nigdzie klasyfikowane).
```

**Jeżeli liczba słowników się zmieni, bramka `list-canon`/`focus-canon`/`artefakt`
się zaczerwieni od Twojej zmiany, albo log `reach` po `R4` pokaże inną liczbę niż
46 pozostałych — naprawiasz KODEM, nigdy progiem i nigdy `--no-verify`** (`Z35`).

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | ARG/ENV `VITE_*` dla dowolnej flagi `DEFAULT_FLAGS` w obu Dockerfile | `0` | komenda (2) `§0.3` | TAK — **jeśli >0, teza `ODBIOR_368` upada, `R1` pkt 2 zmienia się na „napraw” zamiast „pomiń”** |
| 2 | odczyty `import.meta.env` w `useFeatureFlags.tsx` | `0` | `grep -n "import.meta.env" src/hooks/useFeatureFlags.tsx` | TAK |
| 3 | rodzina `InputHintStrip` (komponent + testy + mocki) | `4` plików (komponent, dedykowany test, 2 mocki) | komenda (4) `§0.3` | TAK — **KROK 0, wypisz pełną listę, nie tylko liczbę** |
| 4 | rodzina `CloudDataSettings` (komponent + testy) | `3` plików (komponent, dedykowany test, 1 cudzy plik z 2 `it()`) | komenda (6) `§0.3` | TAK — **KROK 0, ten trzeci plik NIE jest w zleceniu, to Twoje własne znalezisko** |
| 5 | wołacze `POST /api/cloud/sources` (tworzenie) w `src/` | `1` (`CloudDataSettings.tsx:142`) | komenda (8) `§0.3` | TAK |
| 6 | trasa realnie obsługująca link „Zarządzaj” z Czatu | `/settings/integrations` → `ConnectedAppsSettings.tsx`, INNY system niż `cloud_sources` | komenda (9) `§0.3` | TAK |
| 7 | nowe pliki `test-only` blokujące `reachability --check-baseline` na markerze | `49` | komenda (10) `§0.3` | TAK |
| 8 | z nich, w zakresie tego dyżuru (`R4`) | `3`, wszystkie klasyfikowane `test-only`, wszystkie importują/czytają żywy zasób | komenda (10) `§0.3` | TAK |
| 9 | leaf-count PL/EN | `35294` / `33154` | komenda (11) `§0.3` | TAK — **ma zostać identyczne po całym dyżurze** |
| 10 | ostatnia litera w rejestrze znalezisk | `AM` w chwili pisania | komenda (12) `§0.3` | TAK — **sprawdź PONOWNIE tuż przed commitem** |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`dev-render/screens/chat-business-actions-nav.tsx` (nowy) ·
`dev-render/main.tsx` (jeden wpis rejestru) ·
`scripts/dev/akcje-zrzut-porzadki-screenshots.mjs` (nowy, poza licencją formalną —
narzędzie jednorazowe, jak `scripts/dev/idbridge-screenshots.mjs`, commituj normalnie) ·
USUNIĘCIE `src/components/AIChat/InputHintStrip.tsx` +
`src/components/AIChat/__tests__/InputHintStrip.test.tsx` ·
jedna linia w `EnhancedChatInput.teresaVoice.test.tsx` (`:98`) i jedna w
`tests/components/AIChat/EnhancedChatInput.teresa-error-toast.test.tsx` (`:85`) ·
USUNIĘCIE `src/components/settings/CloudDataSettings.tsx` +
`tests/unit/components/settings/CloudDataSettings.honesty.test.tsx` ·
dwa `it()` w `tests/integration/services/cloud-sync.p01ext.test.ts` (`:274-291`) ·
`scripts/dev/reachability-from-root.mjs` (jeden nowy tryb CLI) ·
nowy test tego trybu ·
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY376_AKCJE_ZRZUT_PORZADKI_REPORT.md` ·
`evidence/akcje-zrzut-porzadki-20260905/**`.

**Zapisujesz WARUNKOWO:**
`Dockerfile.api`/`Dockerfile.frontend` (WYŁĄCZNIE jeśli mianownik #1 obali tezę
`ODBIOR_368` — patrz tabela licencji) ·
`docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` (WYŁĄCZNIE
przez nowy tryb `--update-baseline-add`, WYŁĄCZNIE dla trzech plików z `R4`) ·
`docs/program/REJESTR_ZNALEZISK_20260903.md` (jedna nowa sekcja).

**JAWNIE NIE ZAPISZESZ:** `src/components/AIChat/UnifiedChatPanel.tsx`,
`src/hooks/useFeatureFlags.tsx`, `public/locales/**` (żadnego klucza),
`src/components/settings/ConnectedAppsSettings.tsx`,
`src/components/AIChat/AddFilesMenu.tsx`, `src/components/AIChat/CloudFilePicker.tsx`,
`src/services/api.ts`, `server/src/**` (cały), reszta
`tests/integration/services/cloud-sync.p01ext.test.ts` poza dwoma wskazanymi `it()`,
`tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`,
`server/vitest.config*.ts`, `.github/workflows/**`, `scripts/check-list-canon.sh`,
`scripts/check-focus-canon.sh`, `scripts/check-artefakt.sh`,
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` (wszystkie),
`REJESTR_G15_SAMOKONTROLA_20260903.md`, `G19_INWENTARZ_OBOWIAZKOW_20260903.md`,
jakikolwiek plik `docs/program/AUDYT_CZAT_PRZYCISKI_20260905/**`.

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day376-akcje-zrzut-porzadki
git diff --name-only --cached | tee /private/tmp/cx-day376-akcje-zrzut-porzadki-artefakty/staged.txt
bash -c "grep -iE '^src/components/AIChat/UnifiedChatPanel\.tsx$|^src/hooks/useFeatureFlags\.tsx$|^public/locales/|^src/components/settings/ConnectedAppsSettings|^src/components/AIChat/(AddFilesMenu|CloudFilePicker)\.tsx$|^src/services/api\.ts$|^server/src/|^tests/setup|^tests/helpers|^tests/__mocks__|vitest.*config|^\.github/|MODULE_ACCEPTANCE|REJESTR_G15|G19_INWENTARZ|AUDYT_CZAT_PRZYCISKI' /private/tmp/cx-day376-akcje-zrzut-porzadki-artefakty/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## R0 — CZTERY TWARDE ZASADY TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

**(1) Dowód idzie przez realny montaż, bez logowania, wzorem istniejącego
precedensu.** `dev-render/screens/chat-split-teresa-right.tsx` już dowodzi, że
`UnifiedChatPanel` montuje się bez ekranu logowania, jeśli zaszyjesz
`useAppStore` PRZED renderem. Jeśli napotkasz cokolwiek przypominające ekran
logowania albo PIN w Twoim nowym ekranie — to znaczy, że nie skopiowałeś wzorca
poprawnie, nie że zrzut jest niemożliwy. Nie zgłaszaj `BLOCKED_AUTH` bez
pokazania, czym różni się Twoja sytuacja od tego precedensu.

**(2) KROK 0 — cała rodzina, przed KAŻDYM usunięciem.** Dla `InputHintStrip` i
dla `CloudDataSettings` wypisujesz WSZYSTKIE miejsca, które o nich wspominają
(`grep -rn <Nazwa> src/ tests/ dev-render/`), i rozstrzygasz KAŻDE trafienie:
realny import (blokuje usunięcie), `vi.mock`/`vi.doMock` (usuń w tym samym
commicie), test-czytający-źródło (usuń dokładnie wskazany fragment), komentarz
(nie blokuje). Ta instrukcja wypisuje rodzinę, jaką zmierzył autor — Twój
pomiar może znaleźć więcej; jeśli tak, rozszerzasz `R2`/`R3` o znalezione
pozycje, nie milczysz o nich.

**(3) Nie dopisujesz martwego kodu do bezpieczników.** `R1` ma warunkową
licencję na Dockerfile — używasz jej TYLKO jeśli pomiar rzeczywiście obali
tezę `ODBIOR_368`. `R4` dodaje skryptowi nowy tryb, ale ten tryb ma mieć TEST,
który dowodzi, że ODRZUCA plik nieklasyfikowany jako `unreachable`/`test-only`
— nowy mechanizm bezpiecznika, który sam nie ma dowodu na to, że odmawia w
złym przypadku, jest gorszy niż brak mechanizmu.

**(4) Governed connectors (`/api/settings/integrations/*`, `500 {}` na
`google_drive`) są POZA ZAKRESEM.** `R3` ma je zmierzyć i zacytować jako dowód
w pytaniu do właściciela — nie naprawiać. Rozmiar tej naprawy (dyżur 369 R5:
„20-30 linii na dostawcę plus testy”) jest nieproporcjonalny do reszty tego
dyżuru.

**Wymagany dowód:** cztery zdania w raporcie, że przeczytałeś te zasady, plus
`git show --stat` każdego commita. **Bez commita — to jest warunek, nie
pozycja.**

## R1 — ZRZUT „AKCJE BIZNESOWE” + PONOWNA WERYFIKACJA TEZY DOCKERA (rdzeń)

1. **Zweryfikuj tezę `ODBIOR_368`.** Uruchom komendy (1)-(2) z `§0.3`. Jeśli
   potwierdzają (oczekiwane: `0` ARG-ów, `0` odczytów `import.meta.env` w
   `useFeatureFlags.tsx`, ten sam wzorzec braku ARG-a dla WSZYSTKICH 25
   wpisów `DEFAULT_FLAGS`, nie tylko `chatBusinessActionsNav`) — **pomijasz
   Dockerfile w ogóle**, piszesz w raporcie „zweryfikowano ponownie na
   markerze `8f60ab998734…`, teza się potwierdza, ARG pominięty celowo” z
   cytatem swojej komendy. Jeśli pomiar obali tezę (znajdziesz odczyt
   `VITE_*` na tej ścieżce) — korzystasz z warunkowej licencji na Dockerfile
   (tabela licencji), dopisujesz ARG/ENV **i** odpowiadający kod w jednym
   commicie, z dowodem testowym.
2. **Zbuduj nowy ekran dev-render**, `dev-render/screens/chat-business-
   actions-nav.tsx`, kopiując strukturę `chat-split-teresa-right.tsx`
   niemal 1:1: `MemoryRouter`, ten sam stos providerów, `useAppStore.setState`
   z fikcyjnym, w pełni wypełnionym `currentUser`/`currentOrganization`,
   stuby na `Api` (te same wywołania co w montażu `/chat`: `getConversations`,
   `getConversationMessages`/`getMessages`, `workCanvasListDrafts`). RÓŻNICA
   od wzorca: (a) **PRZED** renderem, `localStorage.setItem('consultify_
   feature_flags', JSON.stringify({ chatBusinessActionsNav: true }))`
   (`STORAGE_KEY` z `useFeatureFlags.tsx`); (b) `<FeatureFlagsProvider
   config={{ enableLocalOverrides: true }}>` (BEZ tego override w
   `localStorage` jest po cichu ignorowany — `Pułapka` 2 tej instrukcji);
   (c) NIE musisz otwierać panelu roboczego (`?workPanel=1`) — cel zrzutu to
   nagłówek z widocznym przyciskiem „Akcje biznesowe” i target `/ai-actions`
   po kliku, nie split kanwy.
3. **Dodaj wpis do `dev-render/main.tsx`** (`React.lazy` + rejestr `SCREENS`),
   wzorem sąsiednich wpisów, `?screen=chat-business-actions-nav`.
4. **Uruchom harness na porcie 5587** (`npx vite --config dev-render/
   vite.config.ts --port 5587 &`, zapisz `$!`) i **napisz jednorazowy skrypt
   Playwright** `scripts/dev/akcje-zrzut-porzadki-screenshots.mjs` (wzorzec:
   `scripts/dev/idbridge-screenshots.mjs` — fresh `browser.newContext` per
   zrzut, `colorScheme` zgodny z `theme`, `waitUntil:'networkidle'`),
   robiący **cztery** zrzuty: `?lang=pl&theme=light`, `?lang=pl&theme=dark`,
   `?lang=en&theme=light`, `?lang=en&theme=dark` — każdy pokazujący
   widoczny przycisk „Akcje biznesowe” (ikona `Briefcase`, `data-testid=
   "chat-business-button"`) w nagłówku czatu.
5. **Dowód klikalności.** Osobno od zrzutów: test renderujący ten sam
   ekran/komponent z flagą włączoną lokalnie, klika przycisk, sprawdza że
   nawigacja trafia do `/ai-actions` (ten dowód mógł już istnieć z dyżuru
   368 — sprawdź `src/components/AIChat/__tests__/UnifiedChatPanel.
   przewodyChat.test.tsx`; jeśli test tam już to sprawdza i jest zielony na
   Twoim markerze, NIE duplikujesz go, cytujesz w raporcie zamiast pisać
   nowy).
6. **Zamknij harness** (`kill $PID`, NIGDY `pkill`), zapisz cztery PNG do
   `evidence/akcje-zrzut-porzadki-20260905/chat-business-actions-nav/`.

**Wymagany dowód:** wynik weryfikacji tezy `ODBIOR_368` (komendy (1)-(2)
`§0.3`) · cztery zrzuty PL/EN × light/dark z widocznym przyciskiem · dowód
klikalności (nowy albo zacytowany istniejący) · (WARUNKOWO) diff Dockerfile +
kod + test, jeśli teza upadła. **Commit po `R1`.**

## R2 — DOKOŃCZENIE USUNIĘCIA `InputHintStrip.tsx` (rdzeń)

1. **KROK 0 — potwierdź rodzinę.** Uruchom komendę (4) `§0.3`. Moja lista:
   komponent, jego dedykowany test, oraz DWA mocki w `EnhancedChatInput.
   teresaVoice.test.tsx:98` i `tests/components/AIChat/EnhancedChatInput.
   teresa-error-toast.test.tsx:85`. Jeśli znajdziesz więcej — dopisz do listy
   i usuń wszystkie w tym samym commicie.
2. **Zmierz reachability od korzenia** (komenda (5) `§0.3`) — oczekiwane
   `test-only`. Jeśli wyjdzie `app`/`harness-only` — **STOP na tej pozycji**,
   nie usuwasz, piszesz dlaczego (to dokładnie scenariusz `ActionCenter.tsx`
   z dyżuru 373).
3. **Dowód `vitest` przed/po dla OBU plików z mockiem.** Uruchom
   `npx vitest run src/components/AIChat/__tests__/EnhancedChatInput.
   teresaVoice.test.tsx --retry=0 --reporter=json --outputFile=…` i
   `npx vitest run tests/components/AIChat/EnhancedChatInput.teresa-error-
   toast.test.tsx --retry=0 --reporter=json --outputFile=…` — zapisz pełne
   nazwy testów PRZED usunięciem (mock obecny, komponent obecny).
4. **Usuń w JEDNYM commicie**: `InputHintStrip.tsx`, jego dedykowany test,
   linię `:98` w `teresaVoice.test.tsx`, linię `:85` w `teresa-error-toast.
   test.tsx`.
5. **Powtórz oba pakiety `vitest`** — ta sama lista pełnych nazw (poza
   usuniętą linią mocka, która nie jest testem), oba zielone, ten sam
   mianownik.
6. **Dowód „zero importerów pozostałych”**: `grep -rn "InputHintStrip" src/
   tests/ dev-render/` ma dać **zero** wyników.
7. **`esbuild` per plik** na obu dotkniętych plikach testowych, żeby
   potwierdzić brak błędu importu.

**Wymagany dowód:** lista rodziny (KROK 0) · klasyfikacja reachability ·
`vitest` przed/po dla obu plików z mockiem, te same pełne nazwy · dowód „zero
importerów” · `esbuild` obu plików. **Commit po `R2`.**

## R3 — USUNIĘCIE `CloudDataSettings.tsx` + USTALENIE ŻYWEJ TRASY (rdzeń)

1. **KROK 0 — potwierdź rodzinę** (komenda (6) `§0.3`). Moja lista: komponent,
   jego dedykowany test (`tests/unit/components/settings/CloudDataSettings.
   honesty.test.tsx`, usuwasz w całości), oraz DWA `it()` w `tests/
   integration/services/cloud-sync.p01ext.test.ts:274-291` (usuwasz TYLKO te
   dwa, reszta pliku zostaje — `CloudFilePicker`/`Api service`/backend
   `CONNECTORS` są POZA licencją tej pozycji).
2. **Zmierz reachability od korzenia** (komenda (7) `§0.3`) — oczekiwane
   `test-only` dla `CloudDataSettings.tsx`, `app` dla `ConnectedAppsSettings.
   tsx` i `ActionCenter.tsx` (kontrola, nie cel usunięcia). Jeśli
   `CloudDataSettings.tsx` wyjdzie `app` — STOP, nie usuwasz.
3. **Potwierdź, że jest jedynym wołaczem `POST /api/cloud/sources`**
   (komenda (8) `§0.3`) — jeśli znajdziesz DRUGIEGO wołacza gdziekolwiek w
   `src/`, zatrzymujesz się i piszesz o tym w raporcie zamiast usuwać.
4. **Ustal, która trasa realnie obsługuje „Zarządzaj źródłami w chmurze” w
   Czacie** (komenda (9) `§0.3`). Moje pomiar: `CloudFilePicker.tsx` woła
   WYŁĄCZNIE `GET /api/cloud/sources` (odczyt istniejących źródeł —
   `cloud_sources`, tabela naprawiona w dyżurze 369); `AddFilesMenu.tsx:258`
   nawiguje do `/settings/integrations`, które montuje `ConnectedAppsSettings.
   tsx` (`SettingsView.tsx:460`), korzystający z INNEGO systemu (tabela
   `integrations`, trasy `/api/settings/integrations/*`, `settings.routes.
   ts:1883-2032`). Sprawdź to SAM — jeśli Twój pomiar potwierdza (oczekiwane):
   napisz w raporcie WPROST, że są to DWA ROZŁĄCZNE systemy bez wspólnej
   tabeli ani trasy, że usunięcie `CloudDataSettings.tsx` NIE zamyka żadnej
   luki bezpieczeństwa na żywej trasie (bo żywa trasa nigdy nie korzystała z
   naprawionej bramki), i że sam fakt usunięcia martwego kodu nie czyni
   `ConnectedAppsSettings`/governed connectors bezpieczniejszym ani gorszym.
5. **Oceń ochronę tokenem na żywej trasie, TYLKO CZYTAJĄC.** Sprawdź, czy
   `/integrations/:provider/connect` (`settings.routes.ts:1883-2032`) wymaga
   `verifyToken` (tak, jak reszta `settings.routes.ts`) i czy przyjmuje token
   dostawcy z ciała żądania (`req.body`) zamiast wymagać realnego OAuth —
   jeśli tak, to jest analogiczna (ale NIE identyczna, bo inna tabela) luka
   do tej, którą 369 naprawił w `cloud_sources`. NIE naprawiasz jej —
   piszesz dokładny `plik:linia` + ocenę w raporcie i w sekcji „PYTANIA DO
   WŁAŚCICIELA” z rekomendacją, czy zasługuje na własny dyżur (podobnym
   rozmiarem do 369 R5's `500 {}`, czy mniejszym).
6. **Dowód `vitest` przed/po** dla `tests/integration/services/cloud-sync.
   p01ext.test.ts` — pełne nazwy testów PRZED (4 w opisywanym `describe`)
   i PO (2, tylko `CloudFilePicker`/`Api service`) — potwierdź że TE DWA
   pozostałe nie zmieniły treści ani statusu.
7. **Usuń w JEDNYM commicie**: `CloudDataSettings.tsx`, jego dedykowany test
   w całości, dwa `it()` w cudzym pliku.
8. **Dowód „zero importerów pozostałych”**: `grep -rn "CloudDataSettings"
   src/ tests/ dev-render/` ma dać **zero** wyników.
9. **`esbuild` per plik** na pozostałym po edycji `cloud-sync.p01ext.test.ts`.

**Wymagany dowód:** lista rodziny (KROK 0) · klasyfikacja reachability trzech
komponentów · dowód jedynego wołacza · pisemne ustalenie żywej trasy +
sprawdzenie ochrony tokenem (TYLKO ODCZYT) · `vitest` przed/po dla cudzego
pliku testowego, pełne nazwy · dowód „zero importerów” · `esbuild`.
**Commit po `R3`.**

## R4 — TRYB SELEKTYWNY `reachability-from-root.mjs` + TRZY PLIKI (rdzeń)

1. **Zmierz od zera na SWOIM worktree** (komenda (10) `§0.3`) — potwierdź:
   `exit 1`, `N` nowych plików `test-only`/`unreachable` (moja liczba: `49`,
   Twoja może się różnić o pliki, które inni autorzy scalili między
   napisaniem tej instrukcji a Twoim startem — jeśli tak, zapisz to jako
   korektę, nie jako powód do rozszerzenia zakresu). Potwierdź, że dokładnie
   TRZY z nich to `src/utils/__tests__/initiativeBridgeFlag.envStaticRead.
   test.ts`, `src/utils/__tests__/zaiTeresaFlag.envStaticRead.test.ts`,
   `src/views/admin/__tests__/AdminSettingsModule.healthSectionI18n.test.ts`.
2. **Dopisz nowy tryb CLI do `scripts/dev/reachability-from-root.mjs`**:
   `--update-baseline-add=<ścieżka1>,<ścieżka2>,…` (ścieżki względne repo,
   dokładnie w formacie kolumny `file` z dumpu JSON tego skryptu). Logika:
   (a) oblicz bieżącą klasyfikację jak dziś; (b) dla KAŻDEJ podanej ścieżki:
   jeśli klasyfikacja to `unreachable` — dodaj do `unreachable`-owej listy
   baseline (jeśli jeszcze jej tam nie ma); jeśli `test-only` — analogicznie
   do `testOnlyFiles`; jeśli `app`/`harness-only` albo ścieżka nie istnieje w
   ogóle w bieżącym pomiarze — **rzuć błąd i zakończ kodem ≠0, ZERO zapisu do
   pliku**; (c) wczytaj istniejący baseline, ZSUMUJ (nie zastępuj) nowe
   wpisy z istniejącymi (zachowaj WSZYSTKIE stare wpisy nietknięte, nawet
   jeśli któryś z nich stał się dziś czymś innym niż `unreachable`/`test-
   only` — ten tryb NIGDY nic nie usuwa, tylko dodaje); (d) zapisz
   `schemaVersion: 2` (bez zmiany schematu), wypisz dokładnie co dodałeś.
   Istniejące tryby (`--update-baseline`, `--check-baseline`,
   `--unreachable-only`, dump bezargumentowy) mają zachować się IDENTYCZNIE
   jak dziś — dowiedź tego testem regresyjnym (uruchom każdy z nich przed i
   po Twojej zmianie skryptu, porównaj wyjście bajt-w-bajt na tym samym
   stanie repo).
3. **Napisz test nowego trybu** (lokalizacja wg `§0.2` SCIEZKI), który
   dowodzi: (a) dodanie realnego, dziś-`test-only` pliku fixture kończy się
   sukcesem i baseline zawiera nową ścieżkę; (b) próba dodania pliku, który
   jest `app` (np. plik fixture importowany przez fikcyjny root testu, albo
   jeden z realnych plików `app:true` tego repo) kończy się odmową, kodem
   ≠0, i baseline NIE ZMIENIA SIĘ (porównaj hash pliku przed/po); (c) drugie
   uruchomienie z tym samym argumentem jest no-opem (idempotencja); (d)
   żaden istniejący wpis baseline nie zniknął (porównaj zbiór PRZED ⊆ zbiór
   PO).
4. **Uruchom `--update-baseline-add`** DOKŁADNIE z trzema plikami z punktu 1,
   w jednym wywołaniu. Zapisz diff `reachability.baseline.json` (dokładnie
   trzy nowe linie w odpowiednich tablicach, zero innych zmian).
5. **Zmierz `--check-baseline` PO**: oczekiwane WCIĄŻ `exit 1` (46
   pozostałych plików to NIE Twoja regresja), ale log „New test-only files”
   ma być krótszy o dokładnie 3, i żaden z trzech plików `R4` nie może się
   tam już pojawić.
6. **Cztery bezpieczniki** (`check-list-canon.sh`, `check-focus-canon.sh
   --ci`, `check-artefakt.sh` — kod `0`; `--check-baseline` — `exit 1`,
   OPISANY jako oczekiwany, nie regresja).

**Wymagany dowód:** diff skryptu (nowy tryb) · test regresyjny istniejących
trybów (wyjście identyczne przed/po) · test nowego trybu (4 przypadki z
punktu 3) · diff baseline (dokładnie 3 nowe wpisy) · `--check-baseline`
PRZED/PO z pełnym logiem (49 → 46 nazw, dokładnie te trzy zniknęły).
**Commit po `R4`.**

## R5 — RAPORT I PYTANIA DO WŁAŚCICIELA

Raport (`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY376_AKCJE_
ZRZUT_PORZADKI_REPORT.md`) zawiera: wynik weryfikacji tezy `ODBIOR_368`
(potwierdzona/obalona, z dowodem) · cztery zrzuty R1 (ścieżki w
`evidence/`) i dowód klikalności · potwierdzenie usunięcia `InputHintStrip.
tsx` z pełną rodziną (w tym oba mocki) · potwierdzenie usunięcia
`CloudDataSettings.tsx` z pełną rodziną (w tym trzeci, nieopisany w zleceniu
plik) · pisemne ustalenie, która trasa obsługuje „Zarządzaj źródłami w
chmurze” w Czacie i ocenę jej ochrony tokenem (TYLKO ODCZYT, nie naprawa) ·
opis nowego trybu `reachability-from-root.mjs --update-baseline-add` z
dowodem czterech przypadków testowych · stan `reachability --check-baseline`
PRZED/PO (49 → 46, lista pozostałych 46 do wiadomości, nie do naprawy) ·
rozbieżności liczb wobec tej instrukcji · **niepustą sekcję „TWIERDZENIA
NIEZWERYFIKOWANE”**.

★★ **Osobna, obowiązkowa sekcja: „PYTANIA DO WŁAŚCICIELA”.** Musi zawierać co
najmniej: (1) czy zrzut R1 jest akceptowany — jeśli tak, kiedy flaga
`chatBusinessActionsNav` ma dostać `defaultValue: true` i redeploy (osobna
decyzja, poza tym dyżurem); (2) czy `/api/settings/integrations/:provider/
connect` (governed connectors, `500 {}` na `google_drive`, dyżur 369 R5)
zasługuje na własny dyżur naprawczy TERAZ, i czy ma dostać ochronę tokenem
równoważną tej z `cloud_sources` — z Twoją oceną rozmiaru z `R3` pkt 5; (3)
czy pozostałe 46 plików `test-only`/`unreachable` blokujących
`reachability --check-baseline` mają dostać własny dyżur porządkowy, czy
zostają jako znany, tolerowany dług do czasu, aż każdy z nich trafi na wokandę
osobno.

★ Zanim dopiszesz cokolwiek do jakiegokolwiek dokumentu, sprawdź, czy nie jest
GENEROWANY: `bash -c "grep -rl '<nazwa-pliku>' scripts/"`.

**Commit po `R5`.**

## Próg odbioru

**Cztery pozycje domknięte: zrzut PL/EN × light/dark istnieje i pokazuje
przycisk „Akcje biznesowe” za lokalnie włączoną flagą (flaga domyślna
pozostaje OFF w kodzie); teza o ARG/ENV Dockera zweryfikowana ponownie z
jawnym wynikiem (potwierdzona = pominięta, obalona = naprawiona w tym samym
commicie); `InputHintStrip.tsx` usunięty razem z obydwoma mockami, zero
importerów pozostałych; `CloudDataSettings.tsx` usunięty razem z pełną
rodziną (w tym plikiem znalezionym samodzielnie), z pisemnym ustaleniem, która
trasa jest żywa i czy ma równoważną ochronę tokenem; `reachability-from-root.
mjs` ma nowy, przetestowany tryb selektywny, użyty DOKŁADNIE na trzech
wskazanych plikach, `--check-baseline` przechodzi z 49 na 46 pozostałych
nowych plików.**

Odbiorca odrzuci dyżur, w którym: dopisano martwy ARG do Dockerfile bez
odpowiadającego kodu; usunięto plik, który okazał się żywy; pozostał dziurawy
mock albo import po usunięciu; nowy tryb `--update-baseline-add` przyjął plik
`app`/`harness-only` bez odmowy; baseline zyskał więcej niż trzy nowe wpisy
albo stracił którykolwiek istniejący; naprawiono (zamiast opisano) governed
connectors; leaf-count słowników się zmienił; którykolwiek z trzech
bezpieczników kanonu się zaczerwienił.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „R1 i R2
zrobione i udowodnione, R3 zatrzymany po ustaleniu żywej trasy — token na
`/integrations/:provider/connect` wygląda na słabszy, ale naprawa wykracza
poza ten dyżur, R4 niewykonane bo zabrakło czasu” — **jest pełnowartościowym
wynikiem**, jeśli każda zrobiona pozycja ma commit i dowód.

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później:
**sprawdzasz warunek NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie
na zapamiętanym wyniku.** Wynik ponownego sprawdzenia wklejasz do raportu z
datą i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Dodaj ARG/ENV do Dockera, bo bez tego flaga nigdy nie wejdzie na staging” vs „`ODBIOR_368` już zmierzył, że ten mechanizm nie używa ARG-ów” | `R1` pkt 1: pomiar rozstrzyga — jeśli teza się potwierdza, ARG pomijasz celowo i piszesz dlaczego; martwy ARG nigdy nie jest poprawną odpowiedzią |
| „Zrzut jest wymagany” vs „368 zgłosił `BLOCKED_AUTH`” | `R0` (1) i `R1` pkt 2: precedens `chat-split-teresa-right.tsx` obala STOP, kopiujesz wzorzec zamiast wynajdywać własny |
| „Usuń `InputHintStrip.tsx`” vs „373 zatrzymał się na drugim mocku” | `R2`: ta instrukcja rozszerza licencję o dokładnie tę jedną linię, którą 373 opisał jako brakującą |
| „Usuń martwy duplikat” vs „nie napraw architektury cloud” | `R3` pkt 4-5: usuwasz plik, ustalasz i opisujesz rozjazd systemów, NIE scalasz ich w tym dyżurze |
| „Zaktualizuj baseline dla trzech plików” vs „`--update-baseline` jest całościowy i odmówi” | `R4`: nowy, wąski tryb CLI zamiast istniejącego całościowego — rozwiązuje sprzeczność kodem, nie ręczną edycją |
| „Bezpiecznik ma zostać zielony” vs „46 innych plików wciąż go czerwieni” | „Warunki wspólne”: próg to „46 pozostałych, nie 49”, nie literalne `exit 0` |
| „KROK 0 wypisuje całą rodzinę” vs „zlecenie wymienia tylko dwa pliki na pozycję” | `R2`/`R3`: Twój pomiar może znaleźć więcej (jak trzeci plik `CloudDataSettings` w `cloud-sync.p01ext.test.ts`) — rozszerzasz licencję o znalezione pozycje, nie ignorujesz ich |
| „Nowy tryb ma dodawać wpisy” vs „baseline nietykalny ręcznie” | `R4` pkt 2: dodawanie WYŁĄCZNIE przez nowy, przetestowany kod skryptu, zero edycji JSON-a edytorem |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 8 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — wszystkie ścieżki R1-R4 odczytane przez autora na markerze `8f60ab998734…`; `dev-render/screens/chat-business-actions-nav.tsx` i `evidence/akcje-zrzut-porzadki-20260905/` jawnie oznaczone jako nieistniejące |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 10 wierszy, wszystkie zmierzone na markerze, w tym ponowne zmierzenie tezy `ODBIOR_368` |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP” | TAK — dev-render (2 pozycje) · Dockerfile warunkowo · InputHintStrip + 2 mocki · CloudDataSettings + 2 testy w cudzym pliku · ustalenie trasy (odczyt) · skrypt bezpiecznika + jego test · baseline · pozostałe 46 poza zakresem · bezpieczniki logiki · infrastruktura testowa · serwer · macierz · rejestr · dowody · raport · cudze tereny · reszta |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — R1 dotyka wyłącznie `dev-render/**` (+ warunkowo 2 Dockerfile), R2 dwa pliki + dwie linie, R3 dwa pliki + jeden cudzy z dwoma `it()`, R4 jeden skrypt + jego test |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — porty 6447/5587 własne, rodzeństwo 374/375/377 na innych portach, 367-373 już scalone do markera |
| 7 | Komendy paste-ready | TAK — bloki `§0.3`, „WARUNKI WSPÓLNE” i kontrola rozłączności uruchomione w całości na tym markerze |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — pięć pułapek własnych (fałszywy BLOCKED_AUTH, `enableLocalOverrides` wymagany jawnie, dwa rozłączne systemy cloud, całościowość `--update-baseline`, test-only ≠ osierocony) |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany”, zero pól szablonu | TAK — kontrola generatora przy wydaniu |
