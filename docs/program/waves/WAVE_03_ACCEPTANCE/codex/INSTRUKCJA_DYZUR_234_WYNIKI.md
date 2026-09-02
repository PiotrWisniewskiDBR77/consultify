# INSTRUKCJA DYŻURU nr 234 — Codex — „★★ WYNIKI — KOMPLET EKRANÓW DO ZRZUTÓW WŁAŚCICIELA, który nigdy ich nie widział (`CLAUDE.md` reguła 7). Pomiar potwierdza kontrakt kart KPI/OKR/ROI (30 sekcji, reprodukowalny), potwierdza „crosswalk/backfill — zero wołaczy” (kod istnieje i jest testowany na realnej bazie, ale ŻADEN front ani route go nie woła), ale **obala mianownik „135”** (dwie niezależne metody liczenia dały 130 i 146, nigdy 135) i pokazuje że **OKR i ROI są dziś domyślnie NIEOSIĄGALNE nawet na demo** — tylko KPI ma promocję default-on"

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
> **wyłącznie** `/private/tmp/cx-day234-wyniki`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `142686b772`**
> **Gałąź bazowa: `github-backup/codex/m03-admin-20260824`**
> **Stan dokumentu: WYDANY**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo jakiekolwiek niewypelnione pole szablonu — **dokument nie
> jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.
> Ta ramka jest **jedynym** miejscem, w którym rozstrzyga się stan wydania.
> Objaśnienia w innych blokach cytowanych **nie** są powodem do STOP-u.

Data wystawienia: 2026-09-01.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.
Zakres: ****09 WYNIKI (`/results`) — moduł, którego właściciel nigdy nie widział na oczy.** Zmierzone na markerze `142686b772`: trzynaście tras w `src/routes/AppRoutes.tsx:2865-3188`, wszystkie za łańcuchem `BetaGate moduleId="MODULE_BENEFITS"` → `ProductionModuleGate` → `RouteErrorBoundary`. Trzy domeny — KPI (rejestr `ResultsKpiRegistryPage.tsx`, pełne narzędzie `KpiToolPage.tsx` z **8 sekcjami**, `:605-1000`), OKR (rejestr `ResultsOkrRegistryPage.tsx`, pełne narzędzie `OkrSetToolPage`/`OkrSetWorkspace.tsx` z **6 zakładkami**, `:160-165`), ROI (rejestr `ResultsRoiRegistryPage.tsx`, pełne narzędzie `RoiCaseToolPage` z **16 fazami** rozbitymi na cztery komponenty `RoiCaseModelWorkspace.tsx`/`RoiCaseDecisionWorkspace.tsx`/`RoiCaseRealizeValueWorkspace.tsx`/`RoiCaseLearnWorkspace.tsx`). Liczby 8/6/16 potwierdzone niezależną reprodukcją komend z `docs/program/funkcje/KONTRAKT_KART_KPI_OKR_ROI.md` (30 wierszy, sekcja „Jak odtworzyć numery”). Flagi domenowe (`resultsVNextFeatureFlags.ts:34-53`): `kpiRegistry` domyślnie **ON** na demo/stage/dev od 2026-08-27 (`DEC-2026-08-26-112`), `roiRegistry` i `okrRegistry` domyślnie **OFF WSZĘDZIE**, w tym na demo (`:172-174`, jawny komentarz „No default-on set yet”). Dwa globalne override'y omijają wszystkie trzy naraz: `resultsOwnerReviewMode.ts:20` (`?ff_wave3ResultsOwnerReview`) i `demoAcceptanceProfile.ts:27-31` (`VITE_DEMO_ACCEPTANCE`).**.
Trasy front: ``src/components/ResultsVNext/ResultsKpiRegistryPage.tsx` (`:824` bramka flagi) · `ResultsRoiRegistryPage.tsx:28` · `ResultsOkrRegistryPage.tsx:30` · pełne narzędzia `KpiToolPage.tsx`, `OkrSetWorkspace.tsx`, `RoiCaseModelWorkspace.tsx`+3 siostrzane pliki ROI · `ResultsOwnerReviewEntry.tsx` (wejście `/results`, redirect do KPI) · `src/utils/resultsVNextFeatureFlags.ts` (flagi domenowe) · `src/utils/resultsOwnerReviewMode.ts` · `src/utils/demoAcceptanceProfile.ts`. ★★ Ósmy kształt fałszywego gotowe: wywołanie API istnieje, front go nie woła — dokładnie to potwierdzone dla crosswalk/backfill (`§1.2`). Kanon list: `docs/ui-standards/TRIADA_KANON.md``. Trasy tył: ``server/src/Gateway.ts:1233-1287` — 12 montaży pod `/api/vnext/results/**` (kolejność specyficzne-przed-ogólnymi jest WIĄŻĄCA, komentarze `:1238-1242,1250-1252,1255-1258`). Kontrakt pełny: `docs/program/funkcje/KONTRAKT_KART_KPI_OKR_ROI.md` (30 sekcji, metoda odtwarzania numerów zweryfikowana samodzielnie). Crosswalk/backfill: `server/src/services/resultsVnext/kpi/kpiCrosswalkService.ts:36,74` (`registerConfirmedInitiativeKpiMappings`, `readInitiativeKpiCrosswalkCounts`), `kpiShadowReadService.ts:56` (`runInitiativeKpiShadowRead`) — jedyni wołacze to `server/src/routes/__tests__/day158.results-source-unchanged.pg.test.ts:103-115` i `day158.kpi-crosswalk.pg.test.ts:124-182`; **zero** w `server/src/Gateway.ts`, zero w `src/`. Izolacja tenancka (RES-PF-011): `tests/integration/results/day46.mutator-tenant-isolation.realpg.test.ts` — 4 testy (`:130,154,176,198`), nagłówek `:10-20` sam przyznaje mianownik „135” bez odtwarzalnej komendy`.

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
WT=/private/tmp/cx-day234-wyniki
MARKER=142686b772

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day234-wyniki-20260901 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day234-wyniki/config.worktree"
cat "$VAULT/worktrees/cx-day234-wyniki/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day234-wyniki-scratch
mkdir -p /private/tmp/cx-day234-wyniki-artefakty

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
git -C "$VAULT" log --oneline 142686b772..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only 142686b772..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day234-wyniki-20260901
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 142686b772..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `9` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA: kontrakt kart KPI 8 / OKR 6 / ROI 16 jest reprodukowalny
grep -cE '^\| [0-9]+ \|' docs/program/funkcje/KONTRAKT_KART_KPI_OKR_ROI.md
#   oczekiwane: 30 wierszy razem (8+6+16); przeczytaj sekcje "Jak odtworzyc numery" i uruchom
#   przynajmniej jedna komende awk stamtad, porownaj wynik z tabela

# (2) TEZA: crosswalk/backfill ISTNIEJE i jest testowany, ale ma ZERO wolaczy produktowych
grep -n "export async function registerConfirmedInitiativeKpiMappings\|export async function readInitiativeKpiCrosswalkCounts" server/src/services/resultsVnext/kpi/kpiCrosswalkService.ts
grep -rn "registerConfirmedInitiativeKpiMappings\|readInitiativeKpiCrosswalkCounts\|runInitiativeKpiShadowRead" server/src/ src/ | grep -vE '\.(test|spec)\.|__tests__'
#   oczekiwane: definicje istnieja; druga komenda zwraca PUSTO poza plikami __tests__
grep -n "crosswalk\|ShadowRead" server/src/Gateway.ts
#   oczekiwane: brak trafien — zaden route nie montuje tego mechanizmu

# (3) TEZA: mianownik "135" nie ma w repo odtwarzalnej komendy — policz SAM dwiema metodami
grep -cE "^router\.(post|put|patch|delete)\(" server/src/routes/resultsVnext/*.routes.ts
sed -n '1,25p' tests/integration/results/day46.mutator-tenant-isolation.realpg.test.ts
#   oczekiwane: nagłówek pliku PRZYZNAJE mianownik 135 bez pokazanej komendy — Twoim zadaniem
#   jest policzyć WŁASNĄ metodą i wpisać liczbę + komendę do raportu, nie przepisywać "135"

# (4) TEZA: 4/4 testy izolacji tenanckiej sa realne (ApiGateway + PG + niezalezny odczyt)
grep -n "^  it(" tests/integration/results/day46.mutator-tenant-isolation.realpg.test.ts
grep -n "ApiGateway.getInstance\|new Pool(" tests/integration/results/day46.mutator-tenant-isolation.realpg.test.ts
#   oczekiwane: 4 testy, realny ApiGateway + osobne polaczenie PG do weryfikacji

# (5) TEZA: KPI domyslnie ON na demo/stage/dev, OKR i ROI domyslnie OFF wszedzie
sed -n '30,55p' src/utils/resultsVNextFeatureFlags.ts
sed -n '165,186p' src/utils/resultsVNextFeatureFlags.ts
#   oczekiwane: kpiRegistry host-gated ON; roiRegistry/okrRegistry OFF bez wyjatku hosta

# (6) TEZA: dyzur 170 mial bledny pierwszy raport, odrzucony przez niezalezny odbior
git log --oneline --all | grep -i "170"
sed -n '1,25p' docs/program/funkcje/ODBIOR_170_OKNA_CHECKIN.md
#   oczekiwane: commit "odbior 170: NIE SCALAC" istnieje PRZED mergem "dyzur 170 + FIX-170"

# (7) TEZA: RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE to escape-hatch TESTOW, nie produkcyjny przelacznik
sed -n '1,80p' server/src/middleware/resultsInternalBetaVisibility.middleware.ts
#   oczekiwane: warunek na NODE_ENV==='test' obejmuje bypass; poza testem middleware zawsze
#   czyta organization_members

# (8) TEZA: trasy front sa owiniete tym samym lancuchem bramek na wszystkich 13 route'ach
grep -n "ROUTES.RESULTS" src/routes/AppRoutes.tsx | head -15
#   oczekiwane: 13 wpisow, wszystkie pod BetaGate MODULE_BENEFITS

# (9) miejsce na dysku
df -h /
#   oczekiwane: powyzej 5 GB wolnego
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day234-wyniki-20260901` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6182`. Twój JEDYNY port harnessu to `5152 i 5153`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day234-pg`**. **ZAKAZANE:** `5000 (macOS Control Center, zajety na stale), 5037 (adb), 5060-5061, 6012, 5433, 6047, 6054-6176, 5010-5141, 6404-6411, 6600-6820 (odbiory i FIX-y) — oraz porty siostrzanych dyzurow tej samej fali Z2, ktore sa cudze: baza 6181 i harness 5150-5151 (dyzur 233 Finanse), baza 6183 i harness 5154-5155 (dyzur 235 Materialy). Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `ŻADNEJ nowej flagi i ŻADNEJ zmiany wartości domyślnej istniejącej flagi. Harness `dev-render` wymusza `roiRegistry`/`okrRegistry` WYŁĄCZNIE przez query-param przy renderze zrzutu (`?ff_resultsVNextRoi=1`, `?ff_resultsVNextOkr=1`), nigdy zmianą kodu. `Z10` obowiązuje bez wyjątku`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/services/aiRoleGuard.ts` · `server/src/services/chatPermissionService.ts` · `server/src/services/aiPolicyEngine.ts` · `server/src/services/aiRunLedgerService.ts` · `server/src/services/ai/chatPolicyGateway.ts` · `server/src/services/ai/webSearchGovernance.ts` · `server/src/services/ai/sideEffectTools.ts` · `server/src/services/ai/knowledgeDocAccessFilter.ts` · `server/src/routes/presentationExportGate.ts` · `server/src/middleware/auth.middleware.ts` · `server/src/middleware/v8FeatureGate.middleware.ts` · `server/src/middleware/resultsInternalBetaVisibility.middleware.ts` · `server/src/database/Database.ts` · `vitest.config.ts` · `tests/setup.ts``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY234_WYNIKI_REPORT.md`. Jedyny inny dokument, który wolno Ci dotknąć, to `docs/program/waves/WAVE_03_ACCEPTANCE/modules/09_RESULTS/MODULE_ACCEPTANCE.md` (§R.1) — WYŁĄCZNIE dopisanie nowej sekcji na końcu pliku ze zmierzonym stanem, każde zdanie z dowodem `plik:linia`. Zakaz kasowania lub przepisywania istniejących wierszy tabel. Zakaz wpisywania `FIXED`/`VERIFIED` — ten dyżur mierzy i dokumentuje, nie naprawia mechanizmu (poza wąskim wyjątkiem `R3`, który ma własną parę dowodową). **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day234-wyniki-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day234-wyniki-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
| `Z28` | **★★ ZERO POŁĄCZEŃ DO RAILWAY, DEMO, STAGINGU I PRODUKCJI — w każdą stronę i każdym narzędziem.** Zakaz obejmuje `railway` CLI, `psql`/`docker exec psql` do hosta innego niż `127.0.0.1`, `curl`/`wget`/`fetch` do `*.railway.app`, `demo.consultify.ai`, `consultify.ai`, `staging.*` | Produkcja NIETYKALNA; demo i staging są jedną bazą. **To jedyny zakaz, którego naruszenie zatrzymuje CAŁY dyżur** |
| `Z29` | **★★ Testy o kształcie „atak odrzucony + readback bez zmian" MUSZĄ biec BEZ PONAWIANIA: `--retry=0` w KAŻDEJ komendzie** i `retry: 0` w opcjach `describe`/`it`, jeśli plik je ustawia | `vitest.config.ts` ustawia `retry: CI ? 3 : 1`. Przy otwartej dziurze pierwszy przebieg realnie zmienia stan, asercja pada, Vitest ponawia — i test **raportuje `PASS` mimo otwartej dziury**. Udowodnione na module Partner |
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
| `Z40` | **ZAKAZ MONTOWANIA TRASY HTTP DLA CROSSWALK/BACKFILL.** To jest kompletny, przetestowany na realnym PG mechanizm (`kpiCrosswalkService.ts`, `kpiShadowReadService.ts`), ale bez wołacza — dobudowanie trasy/przycisku to osobny, przyszły dyżur wymagający decyzji produktowej (KIEDY i JAK crosswalk ma być uruchamiany — ręcznie przez OWNER, czy zadaniem w tle). **ZAKAZ przyjmowania liczby „135” jako prawdziwej bez własnej reprodukcji** — dwie niezależne metody dały 130 i 146; jeżeli Twoja trzecia metoda da czwartą liczbę, wpisujesz WSZYSTKIE TRZY do raportu, nie wybierasz jednej. **ZAKAZ zmiany domyślnej wartości `roiRegistry`/`okrRegistry` na ON** — to jest decyzja właściciela po zrzutach, nie techniczna | Tablica zamknięć (`REKONESANS_ZAMKNIECIA_16_MODULOW.md:85`) mówi: „170 skończony (odbiór w toku); kontrakty kart KPI/OKR/ROI (RES-OWN-007/008); crosswalk/backfill nadal zero wołaczy; F.2 4/135”. Trzy z czterech elementów tego zdania są potwierdzone wprost w kodzie — ale „170 skończony” jest niedopowiedziane (backend doszedł do A dopiero po tym, jak niezależny odbiór ODRZUCIŁ pierwszy raport wykonawcy — błąd strefy czasowej + test-tautologia, `ODBIOR_170_OKNA_CHECKIN.md`), a UI pickera okien check-in nadal nie ma dowodu wizualnego (bramka B1 otwarta). Ten dyżur dostarcza ten dowód i uczciwie koryguje mianownik F.2 |

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
cd /private/tmp/cx-day234-wyniki

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day234-pg psql -U postgres -d cx234 \
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
cd /private/tmp/cx-day234-wyniki

docker run -d --name cx-day234-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx234 \
  -p 127.0.0.1:6182:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day234-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6182/cx234 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6182/cx234 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day234-wyniki && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6182/cx234 \
JWT_SECRET=cx234-test-secret-do-not-reuse \
npx vitest run server/src/routes/__tests__ tests/integration/results dev-render/screens src/components/ResultsVNext/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day234-wyniki-artefakty/day234-pakiet.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day234-wyniki && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/routes/__tests__ tests/integration/results dev-render/screens src/components/ResultsVNext/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day234-wyniki-artefakty/day234-pakiet.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day234-wyniki/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day234-pg psql -U postgres -d cx234 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day234-pg`.
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
> **(e) ★★ **OKR I ROI SĄ DOMYŚLNIE NIEWIDOCZNE WSZĘDZIE, W TYM NA DEMO** — inaczej niż KPI, które ma promocję default-on od 27.08. Jeżeli montujesz harness bez jawnego `?ff_resultsVNextRoi=1`/`?ff_resultsVNextOkr=1` (albo `?ff_wave3ResultsOwnerReview=1`/`VITE_DEMO_ACCEPTANCE`), zobaczysz tylko KPI i uznasz błędnie, że OKR/ROI nie istnieją. **Druga pułapka:** `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE` (env `enforce`) jest WYŁĄCZNIE escape-hatch dla testów jednostkowych (`resultsInternalBetaVisibility.middleware.ts:27-33`) — w produkcji i poza `NODE_ENV=test` middleware ZAWSZE wymusza sprawdzenie roli z bazy, niezależnie od tej zmiennej; nie myl jej z przełącznikiem produkcyjnym. **Trzecia pułapka:** dyżur 170 naprawił błąd strefy czasowej w `okrCheckInOccurrenceRepository.ts:21-23` (`toISOString().slice(0,10)` przesuwał datę o dobę w `Europe/Warsaw`, niewidoczne na Railway/UTC) — jeżeli Twój harness renderuje daty check-inów, zmierz strefę czasową renderu, nie tylko czy się renderuje**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day234-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day234-wyniki-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (harness KPI/OKR/ROI — rejestry i pełne narzędzia, zrzuty, para dowodowa OFF/ON) · R2 (korekta MODULE_ACCEPTANCE.md — mianownik F.2, status 170) · R3 (opcjonalnie: bramka HTTP dla crosswalk — TYLKO jeśli mieści się bez szóstego mechanizmu i bez nowej decyzji produktowej; domyślnie pozycja opisowa, nie budowlana)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6182` albo `5152 i 5153` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6182` albo `5152 i 5153`** (`Z7`).

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

# 1. PO CO TEN DYŻUR ISTNIEJE

Moduł **09 Wyniki** to drugi z trzech modułów fali Z2 — właściciel **nigdy nie widział go
na oczy**. Cel: doprowadzić moduł do stanu, w którym da się pokazać **komplet ekranów
na czystych zrzutach** (`CLAUDE.md` reguła 7), nie „naprawić wszystko”.

## ★★ POMIAR CZTERECH TWIERDZEŃ TABLICY ZAMKNIĘĆ — wykonany na SHA `142686b772`

Tablica zamknięć (`docs/program/funkcje/REKONESANS_ZAMKNIECIA_16_MODULOW.md:85`): „170
skończony (odbiór w toku); kontrakty kart KPI/OKR/ROI (RES-OWN-007/008); crosswalk/backfill
nadal zero wołaczy; F.2 4/135”. Sprawdź każde u siebie (komendy w `§0`).

### 1. Kontrakt kart KPI/OKR/ROI — POTWIERDZONE W 100%, reprodukowalne

`docs/program/funkcje/KONTRAKT_KART_KPI_OKR_ROI.md` (263 linie, `status: canonical`,
`established: 2026-08-31`) ma **30 wierszy** = KPI 8 (`:28-45`) + OKR 6 (`:48-63`) + ROI 16
(`:66-96`) — dokładnie jak twierdzi RES-OWN-007/008. **Metoda „Jak odtworzyć numery”
(`:163-186`) DZIAŁA** — reprodukowana samodzielnie: awk na `roi.routes.ts` dał identyczne
numery linii dla wierszy ROI #8/#9/#15/#16, zgodnie z erratą FIX-199 (opisującą wcześniejszą
zamianę #8↔#9). Definicje w komponentach też się zgadzają: KPI
(`grep -n "^    id: '" KpiToolPage.tsx` → `605,665,729,743,797,836,970,1000`), OKR
(`OkrSetWorkspace.tsx:160-165`), ROI (cztery pliki workspace, sumarycznie 16). **To jeden
z niewielu dokumentów w tym programie, który przeszedł niezależną weryfikację bez
żadnej poprawki — traktuj go jako zaufane źródło prawdy o liczbie sekcji.**

### 2. ★★★ „crosswalk/backfill nadal zero wołaczy” — POTWIERDZONE, opisz jako wzorcowy przykład kształtu programu

Definicje: `server/src/services/resultsVnext/kpi/kpiCrosswalkService.ts:36`
(`registerConfirmedInitiativeKpiMappings`), `:74` (`readInitiativeKpiCrosswalkCounts`),
`kpiShadowReadService.ts:56` (`runInitiativeKpiShadowRead`). Komentarz w kodzie
(`kpiCrosswalkService.ts:31-34`) mówi wprost: *„Registers only caller-supplied, explicitly
confirmed identities. There is intentionally no discovery by name, unit, code, or any
other heuristic”* — mechanizm ręcznego mapowania `initiative_kpis` → `rvn_kpi_definitions`
plus „shadow read” porównujący wartości. **Grep za wywołaniami zwraca ZERO poza dwoma
plikami testowymi**: `server/src/routes/__tests__/day158.results-source-unchanged.pg.test.ts:103-115`
i `day158.kpi-crosswalk.pg.test.ts:124-182`. **Zero w `src/` w ogóle** (żadnego
wystąpienia słowa „crosswalk” we froncie). **Zero w `server/src/Gateway.ts`** — żaden
route nie montuje tego mechanizmu.

To jest kompletny, solidnie przetestowany na realnym Postgresie mechanizm (`INSERT ...
ON CONFLICT DO NOTHING`, tenant-scoped przez `WHERE source.organization_id = $5`), ale
**kompletnie odcięty od jakiegokolwiek przepływu użytkownika** — z perspektywy działającej
aplikacji ten mechanizm **nie istnieje**: nie ma przycisku, ekranu ani zadania w tle,
które by go uruchamiały. To jest ten sam kształt fałszywego „gotowe”, który ten program
już wielokrotnie mierzył pod innymi nazwami w innych modułach — „biblioteka bez wywołania”.

### 3. „F.2 pokryte w 4 na 135” — licznik wiarygodny, MIANOWNIK NIEWERYFIKOWALNY

`tests/integration/results/day46.mutator-tenant-isolation.realpg.test.ts` (230 linii,
**4 testy**: `:130,154,176,198`) — realny `ApiGateway` (`:95`), realny JWT ADMIN org B,
atak na realny zasób org A, asercja odrzucenia + **niezależny odczyt PG** (`new Pool(...)`)
potwierdzający brak mutacji. **To nie jest atrapa** — dowód mutacyjny w komentarzu na
końcu pliku.

Ale **nagłówek pliku (`:10-20`) sam przyznaje**: *„RESULTS_DAY46C_REPORT_20260828.md
measured 135 mutating routes across 9 families... with 0/135 covered”* — i **nie podaje
żadnej odtwarzalnej komendy** dla liczby 135 (w przeciwieństwie do kontraktu kart w
punkcie 1, który taką komendę podaje i którą dało się odtworzyć). Próba niezależnej
reprodukcji dwiema metodami dała **dwa różne wyniki, żaden nie 135**: literalny
`grep -cE "^router\.(post|put|patch|delete)\("` na 12 zamontowanych routerach = **130**;
po doliczeniu tras montowanych przez funkcje-szablony (`mountLifecycleRoute`,
`mountTransitionRoute` i podobne, gdzie jedna linia `router.post(` w ciele funkcji jest
wywoływana wielokrotnie z różnymi ścieżkami) = **146**. **Twoim zadaniem jest policzyć
WŁASNĄ, trzecią metodą i wpisać do raportu WSZYSTKIE trzy liczby z komendami — nie
wybierać tej, która najbardziej pasuje.** Pięć z dziewięciu rodzin (KPI legacy, ROI
legacy, OKR legacy, KPI deviation-cases, KPI scorecards) nie ma **żadnego** testu
izolacji tenanckiej, nawet reprezentatywnego.

### 4. Dyżur 170 „skończony” — technicznie broniące się, ale niedopowiedziane

Historia commitów jest bardziej złożona niż jedno zdanie tablicy sugeruje: wydanie
(`ca8da11f53`) → fix (`226b5aaae4`) → **raport wykonawcy** (`89fd32e413`, ten cytowany
w tablicy) → **34 minuty później: `645e5b9fc0` „odbior 170: NIE SCALAC”** — niezależny
odbiór ODRZUCIŁ pierwszy raport, znajdując dwie realne wady, których raport wykonawcy
sam nie zgłosił: (a) `okrCheckInOccurrenceRepository.ts:21-23` —
`toISOString().slice(0,10)` przesuwał datę o dobę wstecz poza UTC (zmierzone: DB
`2026-08-01` → API `2026-07-31` dla `Europe/Warsaw`, niewidoczne na Railway/UTC,
widoczne u właściciela); (b) commit `226b5aaae4` bez żadnej asercji — test-tautologia.
Po `FIX-170` (`080516f294`, `913edb8ad3`) i mergu (`ab82afbc1b`) backend jest oceniony
na **A**. Ale `docs/program/funkcje/ODBIOR_170_OKNA_CHECKIN.md:10` wprost: *„UI zostaje
C do zamknięcia bramki B1 (zrzut z `?ff_resultsVNextOkr=1` — reguła 7)”* — i **nikt tej
bramki nie zamknął po tym wpisie**. Skoro `okrRegistry` jest domyślnie OFF wszędzie,
ekran pickera okien check-in **nadal nikt nie widział wizualnie**. „170 skończony” w
wierszu 38 tablicy i „170 skończony (odbiór w toku)” w wierszu 85 tej samej tablicy
mówią różne rzeczy o tym samym dyżurze — **wiersz 85 jest dokładniejszy**.

## Czego ten dyżur świadomie NIE robi

- **Nie montuje trasy HTTP dla crosswalk/backfill.** To decyzja produktowa (kiedy i jak
  uruchamiać mapowanie), nie techniczna — osobny, przyszły dyżur.
- **Nie zmienia domyślnej wartości `roiRegistry`/`okrRegistry`.**
- **Nie rozstrzyga, która z trzech liczb (130/135/146) jest „prawdziwym” mianownikiem
  F.2** — wpisuje wszystkie trzy z komendami.

---

# 2. TEZY ZLECENIA

| # | Teza | Jak sprawdzasz |
|---|---|---|
| T1 | Kontrakt kart 8/6/16 jest reprodukowalny | komenda (1) |
| T2 | Crosswalk/backfill ma zero wołaczy poza testami | komenda (2) |
| T3 | Mianownik „135” nie ma odtwarzalnej komendy w repo | komenda (3) |
| T4 | 4/4 testy izolacji tenanckiej są realne | komenda (4) |
| T5 | KPI domyślnie ON, OKR/ROI domyślnie OFF wszędzie | komenda (5) |
| T6 | Dyżur 170 miał odrzucony pierwszy raport | komenda (6) |
| T7 | `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE` to escape-hatch testów, nie przełącznik produkcyjny | komenda (7) |
| T8 | Trzynaście tras frontu jest za jednym łańcuchem bramek | komenda (8) |

---

# 3. POZYCJE DYŻURU

## R1 — HARNESS KPI/OKR/ROI (rdzeń, dowodowy)

**Cel:** pierwszy realny widok trzech domen Wyników, jaki właściciel kiedykolwiek zobaczy
— w tym dwóch (OKR, ROI), które dziś nie są widoczne nawet na demo.

Montujesz `dev-render/screens/day234-wyniki-rejestry.tsx` +
`dev-render/screens/day234-wyniki-narzedzia.tsx` (+ wpisy w `dev-render/main.tsx`),
renderujące **realne** komponenty: trzy rejestry (`ResultsKpiRegistryPage`,
`ResultsRoiRegistryPage`, `ResultsOkrRegistryPage`) i reprezentatywny wycinek pełnych
narzędzi (KPI: 2-3 z 8 sekcji; OKR: 2-3 z 6; ROI: 3-4 z 16 — nie musisz pokazać
wszystkich 30, ale opisz w raporcie, które pominąłeś).

### R1a — PARA DOWODOWA „obcy nie widzi / właściciel widzi”

| przebieg | oczekiwane |
|---|---|
| bez żadnych query-param | KPI widoczne (default ON demo/stage/dev), OKR i ROI **niewidoczne** |
| z `?ff_resultsVNextRoi=1&?ff_resultsVNextOkr=1` | wszystkie trzy domeny widoczne |
| z `?ff_wave3ResultsOwnerReview=1` | wszystkie trzy naraz, przez master-override |

### R1b — zrzuty

Trzy rejestry × dwa motywy = 6, plus reprezentatywny wycinek pełnych narzędzi (min. 2 na
domenę) × dwa motywy. `mean_luma` każdej pary, różnica **> 150** (komenda w `§5`).

### R1c — data check-inu w strefie czasowej

Jeżeli harness renderuje daty check-inów OKR — zmierz, czy renderowana data odpowiada
dacie z fixture w strefie `Europe/Warsaw`, nie w UTC (patrz `PULAPKA_WLASCIWA_TEMU_MODULOWI`,
błąd naprawiony w 170, ale sprawdź czy się nie odrodził w Twoim wycinku renderu).

## R2 — KOREKTA `MODULE_ACCEPTANCE.md` (rdzeń, dokumentacyjny)

Dopisujesz na końcu `docs/program/waves/WAVE_03_ACCEPTANCE/modules/09_RESULTS/MODULE_ACCEPTANCE.md`
nową sekcję z: (a) trzema liczbami mianownika F.2 (130/146/Twoja własna) z komendami;
(b) pięcioma rodzinami bez pokrycia izolacji tenanckiej; (c) doprecyzowaniem stanu
dyżuru 170 — backend A po FIX-170, UI C z otwartą bramką B1; (d) statusem crosswalk —
„kod istnieje, zero wołaczy” z dowodem. **Nie kasujesz** istniejących wierszy.

## R3 — OPCJONALNA POZYCJA OPISOWA: crosswalk/backfill (nie-rdzeń)

**Nie budujesz trasy.** Piszesz w raporcie krótką specyfikację (pół strony): jaki byłby
najmniejszy bezpieczny sposób wywołania tego mechanizmu (np. akcja z poziomu karty
inicjatywy „Potwierdź mapowanie KPI”, albo zadanie administracyjne uruchamiane ręcznie
przez OWNER) — **bez implementacji**, jako materiał do decyzji właściciela.

## R4 — RAPORT DYŻURU (rdzeń)

Struktura `§R.2`, sekcja „TWIERDZENIA NIEZWERYFIKOWANE” obowiązkowa. Dołącz tabelę
mianowników (`§0.4a`) — w tym WSZYSTKIE TRZY liczby dla F.2 (130/146/Twoja), z komendami.

---

# 4. TABELA LICENCJI PLIKOWYCH

Ten dyżur jest **pomiarowo-dowodowy**. Licencja zapisu jest wąska.

| Zakres | Ścieżki |
|---|---|
| Zapis (NOWE) | `dev-render/screens/day234-wyniki-rejestry.tsx`, `dev-render/screens/day234-wyniki-narzedzia.tsx` + wpisy w `dev-render/main.tsx` |
| Zapis (WĄSKO) | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/09_RESULTS/MODULE_ACCEPTANCE.md` — WYŁĄCZNIE nowa sekcja na końcu pliku (`R2`) |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY234_WYNIKI_REPORT.md` |
| Odczyt (ZAKAZ ZAPISU) | `src/components/ResultsVNext/**` — montujesz w harnessie, nie zmieniasz logiki |
| Odczyt (ZAKAZ ZAPISU) | `server/src/routes/resultsVnext/**`, `server/src/services/resultsVnext/**` — zero zmian backendu |
| Odczyt (ZAKAZ ZAPISU) | `server/src/Gateway.ts` — **zero nowych montaży tras**, w szczególności zero montażu crosswalk/backfill (`R3` jest opisowa, nie budowlana) |
| Odczyt (ZAKAZ ZAPISU) | `src/utils/resultsVNextFeatureFlags.ts`, `resultsOwnerReviewMode.ts`, `demoAcceptanceProfile.ts` — flagi nietykalne |
| Odczyt (ZAKAZ ZAPISU) | `server/src/middleware/resultsInternalBetaVisibility.middleware.ts` — bramka nietykalna |
| Odczyt (ZAKAZ ZAPISU) | `vitest.config.ts` · `tests/setup.ts` · `server/src/database/Database.ts` (`Z18`) |
| Odczyt | `docs/program/funkcje/REKONESANS_ZAMKNIECIA_16_MODULOW.md` · `KONTRAKT_KART_KPI_OKR_ROI.md` · `RESULTS_DAY46C_REPORT_20260828.md` · `ODBIOR_170_OKNA_CHECKIN.md` · `docs/ui-standards/TRIADA_KANON.md` |
| Odczyt (ZAKAZ ZAPISU) | `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` (`Z14`) |

**Nietykalne imiennie:** `server/src/Gateway.ts` (zero nowych montaży) ·
`kpiCrosswalkService.ts`/`kpiShadowReadService.ts` (odczyt, zero wołań) ·
`resultsInternalBetaVisibility.middleware.ts` · `resultsVNextFeatureFlags.ts` ·
`vitest.config.ts` · `tests/setup.ts` · `Database.ts` · każdy inny `MODULE_ACCEPTANCE.md`
poza Wyników.

---

# 5. TWARDE ZASADY

- ★★ **CEL JEST ZRZUT, NIE NAPRAWA.** Błąd głębszy niż „stan pusty renderuje się źle”
  (np. narzędzie rzuca wyjątkiem) — opisujesz w raporcie, nie naprawiasz w locie.
- ★★ **ZAKAZ WYBIERANIA JEDNEJ LICZBY DLA F.2.** Wpisujesz 130, 146 i swoją własną
  (jeśli inna), z komendami dla każdej. Wybór „prawdziwej” liczby jest decyzją
  nadzorcy, nie Twoją.
- ★★ **ZAKAZ MONTOWANIA TRASY DLA CROSSWALK/BACKFILL.** `R3` jest opisowa. Pokusa
  „skoro kod już jest przetestowany, wystarczy dodać jeden `app.use(...)`” jest
  dokładnie tym, czego zakazuje ta pozycja — to decyzja produktowa (jak i kiedy
  uruchamiać mapowanie), nie techniczna.
- ★★ **FLAGA DOMYŚLNIE WYŁĄCZONA POZOSTAJE WYŁĄCZONA.** `roiRegistry`/`okrRegistry`
  wymuszasz WYŁĄCZNIE query-paramem w harnessie.
- ★★ **WŁAŚCICIEL NIGDY NIE JEST PIERWSZYM TESTEREM WIZUALNYM.** Para jasny/ciemny:
  `mean_luma` obu i różnica **> 150**:
  ```bash
  node -e "const s=require('sharp');s(process.argv[1]).stats().then(r=>console.log(process.argv[1], (0.2126*r.channels[0].mean+0.7152*r.channels[1].mean+0.0722*r.channels[2].mean).toFixed(1)))" <plik.png>
  ```
- ★★ **W RAPORCIE PISZESZ WPROST, CZY DANE NA ZRZUCIE POCHODZĄ Z REALNEGO PRZEBIEGU CZY
  Z RĘCZNYCH PROPSÓW.**
- ★★ **STREFA CZASOWA CHECK-INÓW OKR JEST ZMIERZONYM RYZYKIEM (dyżur 170).** Jeżeli
  Twój wycinek renderu pokazuje daty, zmierz je w `Europe/Warsaw`, nie w UTC środowiska
  CI.
- ★ **PUŁAPKI ŚRODOWISKA:** `server/src/database/Database.ts` ok. `:80-88` cicho
  podstawia atrapę bazy bez `RUN_DB_TESTS=1`; `:686` atrapa zwraca `changes:1` dla
  KAŻDEGO `UPDATE`; `vitest.config.ts:210` przypina `DB_TYPE='sqlite'`;
  `tests/setup.ts:896` podmienia `global.fetch`; **`grep --include` w tej powłoce
  zwraca pustkę zamiast wyników — filtruj potokiem** (`grep -v`), nie flagą `--include`.
- ★ **`Z13`:** zrzuty i wyniki NIE wchodzą do repo — leżą w `/private/tmp/cx-day234-wyniki-artefakty`, raport
  podaje ścieżki i `shasum -a 256`.
- ★ **PUSH WYŁĄCZNIE NA `github-backup`.**
- ★★ **SEKCJA „TWIERDZENIA NIEZWERYFIKOWANE” W RAPORCIE JEST OBOWIĄZKOWA.**
