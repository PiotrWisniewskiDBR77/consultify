# INSTRUKCJA DYŻURU nr 199 — Codex — „Wyniki — KONTRAKT kart KPI/OKR/ROI spisany z REALNYCH tras (RES-OWN-008) i domkniecie DWOCH pustych sekcji karty KPI, ktore tlumacza sie komentarzem nieprawdziwym na tym markerze (obie trasy ISTNIEJA), plus seed przegladowy i PIERWSZE zrzuty kart dla wlasciciela"

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
> **wyłącznie** `/private/tmp/cx-day199-karty-wynikow`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `60581ed6b5`**
> **Gałąź bazowa: `github-backup/codex/m03-admin-20260824`**
> **Stan dokumentu: WYDANY**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo jakiekolwiek niewypelnione pole szablonu — **dokument nie
> jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.
> Ta ramka jest **jedynym** miejscem, w którym rozstrzyga się stan wydania.
> Objaśnienia w innych blokach cytowanych **nie** są powodem do STOP-u.

Data wystawienia: 2026-08-31.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.
Zakres: **09_RESULTS — karty (pelne narzedzia) KPI, OKR i ROI w rodzinie Results vNext. Zrodlo zamowienia: rejestr `RES-OWN` w `docs/program/waves/WAVE_03_ACCEPTANCE/modules/09_RESULTS/MODULE_ACCEPTANCE.md`, pozycje `RES-OWN-007` (stan: ROUTES_AND_EXISTING_CARDS_RECONNECTED / WORKFLOW_REMEDIATION_AND_OWNER_REVIEW_OPEN) i `RES-OWN-008` (stan: OPEN_SPEC_RECONCILIATION)**.
Trasy front: `Karty: KPI `/results/kpi/:kpiId` (`src/routes/routeConfig.ts:164`, montaz `src/routes/AppRoutes.tsx:2951`, komponent `src/components/ResultsVNext/kpiTool/KpiToolPage.tsx`, tablica 8 sekcji `:979-988`); ROI `/results/roi/cases/:roiCaseId` (`routeConfig.ts:169`, `AppRoutes.tsx:3029`, `roi/RoiCaseToolPage.tsx` -> `roi/RoiCaseFullTool.tsx`, 4 fazy x 16 podzakladek, `roi/RoiCasePhaseNav.tsx:26-40`); OKR `/results/okr/sets/:okrSetId` (`routeConfig.ts:180`, `AppRoutes.tsx:3106`, `okr/OkrSetToolPage.tsx` -> `okr/OkrSetWorkspace.tsx`, 6 zakladek `:159-166`). Dodatkowo `/results/kpi/:kpiId/deviation-cases/:caseId` (`routeConfig.ts:165`). Wejscie odbioru: `ResultsOwnerReviewEntry.tsx:12` to czysty `<Navigate to={ROUTES.RESULTS_KPI.ROOT} replace/>`. Otwieranie karty z rejestru NIE idzie przez podwojne klikniecie (w `src/components/ResultsVNext/**` nie ma ani jednego `onRowDoubleClick`) — idzie przez kebab i akcje w podgladzie: `ResultsKpiRegistryPage.tsx:1537` i `:1595-1596`, `ResultsOkrHub.tsx:607-608` i `:621-622`, `ResultsRoiHub.tsx:676-677`. ★ ZMIENIASZ WYLACZNIE `kpiTool/KpiToolPage.tsx` (dwie sekcje) oraz warstwe klienta domeny (`src/components/ResultsVNext/kpiApi.ts` i/albo `kpiScorecards/kpiScorecardApi.ts`) o dwa wolacze. Cala reszta = odczyt`. Trasy tył: `Rodzina `/api/vnext/results/**`, 13 routerow zamontowanych w `server/src/Gateway.ts:1233-1286` (kolejnosc rejestracji jest znaczaca — Express dopasowuje po kolejnosci, nie po specyficznosci; komentarze `:1238-1243`, `:1246-1249`, `:1255-1258`). Prefiksy: `/search` `:1237`, `/kpi/deviation-cases` `:1244`, `/kpi/recovery-cards` `:1245`, `/kpi/scorecards` `:1249`, `/kpi/legacy` `:1254`, `/kpi` `:1259` i `:1260`, `/initiatives` `:1261`, `/roi` `:1267` i `:1276`, `/roi/legacy` `:1272`, `/okr/legacy` `:1281`, `/okr` `:1286`. ★★ DWIE TRASY, KTORE SA SEDNEM R2 i ktorych front NIE WOLA: `GET /vnext/results/kpi/scorecards/for-kpi/:kpiId` (`server/src/routes/resultsVnext/kpiScorecard.routes.ts:458`, handler `listVisibleScorecardsForKpi`, komentarz `:447-456` nazywa to „reverse lookup”) oraz `GET /vnext/results/kpi/:kpiId/history` (`server/src/routes/resultsVnext/kpi.routes.ts:469`, handler `getKpiHistory`, odpowiedz `{entries, nextCursor}` `:489`). Pochodzenie obu: `docs/product/results-vnext/RN_G6_SRV_GAPS.md:7,126`. ★ Trasa, ktorej NIE MA i ktorej NIE BUDUJESZ: agregat dzialan korygujacych per KPI — istnieje wylacznie `GET /:caseId/corrective-actions` per sprawa (`server/src/routes/resultsVnext/kpiDeviation.routes.ts:542`). ★★ Kazdy router tej rodziny ma `router.use(requireResultsInternalBetaVisibility)` (`server/src/middleware/resultsInternalBetaVisibility.middleware.ts`) — koperta bety, NIETYKALNA`.

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
WT=/private/tmp/cx-day199-karty-wynikow
MARKER=60581ed6b5

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day199-karty-wynikow-20260831 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day199-karty-wynikow/config.worktree"
cat "$VAULT/worktrees/cx-day199-karty-wynikow/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day199-karty-wynikow-scratch
mkdir -p /private/tmp/cx-day199-karty-wynikow-artefakty

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
git -C "$VAULT" log --oneline 60581ed6b5..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only 60581ed6b5..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day199-karty-wynikow-20260831
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 60581ed6b5..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `siedem` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day199-karty-wynikow

# (T1) ILE SEKCJI MA KARTA KPI — policz z tablicy, nie z opowiesci
sed -n '979,988p' src/components/ResultsVNext/kpiTool/KpiToolPage.tsx
grep -n "hasData: false" src/components/ResultsVNext/kpiTool/KpiToolPage.tsx
#   oczekiwane: tablica z OSMIOMA sekcjami; dokladnie DWA trafienia `hasData: false`
#   (sekcje `scorecards` ok. :946-960 i `history` ok. :963-977).

# (T2) ★ DWIE TRASY, KTORYCH "NIE MA" — sprawdz, ze SA, i ze nikt ich nie wola
sed -n '447,462p' server/src/routes/resultsVnext/kpiScorecard.routes.ts
sed -n '465,492p' server/src/routes/resultsVnext/kpi.routes.ts
sed -n '950,977p' src/components/ResultsVNext/kpiTool/KpiToolPage.tsx
grep -rn "for-kpi" src/ | grep -v __tests__ || echo "BRAK WOLACZA for-kpi"
grep -rn "kpiId}/history\|/history'" src/components/ResultsVNext/ | grep -v __tests__ || echo "BRAK WOLACZA history"
#   oczekiwane: `router.get('/for-kpi/:kpiId'` (ok. :458) i `router.get('/:kpiId/history'`
#   (ok. :469, odpowiedz `{entries, nextCursor}` ok. :489); w karcie komentarze
#   twierdzace, ze tych tras NIE MA; oba grepy po `src/` — BEZ WOLACZA.
#   Jesli znajdziesz wolacza — to obala sedno R2 i idzie do Korekt.

# (T3) ILE ZAKLADEK MA KARTA OKR
sed -n '159,166p;100,133p' src/components/ResultsVNext/okr/OkrSetWorkspace.tsx
#   oczekiwane: SZESC pozycji w tablicy zakladek; `objectives` niesie drill-down
#   Objectives -> KeyResults -> CheckIns, wiec "Objectives" i "KRs" to JEDNA zakladka.

# (T4) ILE PODZAKLADEK MA KARTA ROI — cztery fazy, nie jedna
sed -n '26,40p' src/components/ResultsVNext/roi/RoiCasePhaseNav.tsx
sed -n '639,646p' src/components/ResultsVNext/roi/RoiCaseModelWorkspace.tsx
sed -n '90,93p' src/components/ResultsVNext/roi/RoiCaseDecisionWorkspace.tsx
sed -n '225,231p' src/components/ResultsVNext/roi/RoiCaseRealizeValueWorkspace.tsx
sed -n '165,169p' src/components/ResultsVNext/roi/RoiCaseLearnWorkspace.tsx
#   oczekiwane: liczniki faz build/decision/realize/learn = 6/2/5/3 (razem 16) i
#   cztery tablice zakladek zgodne z tymi licznikami. Materiał zbiorczy wymieniał
#   wylacznie faze 1 — podaj SWOJA liczbe z mianownikiem.

# (T5) ★ PULAPKA NAZEWNICZA — tabele OKR NIE maja prefiksu `rvn_`
grep -rlo "CREATE TABLE IF NOT EXISTS okr_vnext_[a-z_]*" server/migrations/ | head -3
grep -rho "CREATE TABLE IF NOT EXISTS okr_vnext_[a-z_]*" server/migrations/ | sort -u | wc -l
grep -rho "CREATE TABLE IF NOT EXISTS rvn_okr_[a-z_]*" server/migrations/ | sort -u | wc -l
#   oczekiwane: kilkanascie tabel `okr_vnext_*` i ZERO tabel `rvn_okr_*`, mimo ze
#   pliki migracji nazywaja sie `20260822_rvn_okr_*`. Grep po `rvn_` przegapi CALY OKR.

# (T6) FLAGI KART — wartosci domyslne, ktorych NIE ZMIENIASZ
sed -n '146,176p' src/components/ResultsVNext/resultsVNextFeatureFlags.ts
#   oczekiwane: `kpiRegistry` wlaczony poza publiczna produkcja (ok. :165-169);
#   `roiRegistry` i `okrRegistry` WYLACZONE na kazdym hoscie (ok. :172-174).
#   Do zrzutow podajesz ?ff_resultsVNextRoi=1 i ?ff_resultsVNextOkr=1 w ADRESIE.

# (T7) SEED I NAZWA BAZY — czego seed nie tworzy i dlaczego baza nie moze byc `cx199`
grep -o "INSERT INTO [a-z_]*" server/scripts/seed-wave3-results-owner-review.ts | sort -u
sed -n '23,24p' server/scripts/seed-wave3-results-owner-review.ts
sed -n '30,34p' scripts/dev/start-wave3-owner-runtime.mjs
#   oczekiwane: lista tabel seeda BEZ m.in. rvn_roi_assumptions, rvn_roi_cost_lines,
#   rvn_roi_benefit_lines, rvn_roi_scenarios, rvn_kpi_scorecards, okr_vnext_alignments;
#   oraz DWA niezalezne straznikami wzorca nazwy `^consultify_w3_results_owner_[a-z0-9_]+$`
#   (seed :23 i starter runtime :32). Dlatego Twoja baza nazywa sie consultify_w3_results_owner_cx199.
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day199-karty-wynikow-20260831` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6129`. Twój JEDYNY port harnessu to `5068 i 5069`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day199-pg`**. **ZAKAZANE:** `6012, 5433, 6047, 6054-6127, 5010-5065, 6404-6411 (zajete przez wczesniejsze dyzury i odbiory nadzorcy), oraz wzajemnie porty partii rownoleglej: 6128-6132 i 5066-5075 poza wlasnym przydzialem. Twoj wylaczny przydzial to baza `6129` i harness `5068 i 5069` — nic wiecej (jeden port harnessu na dev-render Vite, drugi na runtime odbioru, jesli go podnosisz). ★ PORT 5000 ZAJETY NA STALE przez macOS Control Center. ★ PORT 5037 ZAJETY przez `adb` (serwer Androida). ★★ Zwroc uwage, ze `scripts/dev/start-wave3-owner-runtime.mjs` odmawia portow `3940/3941/4363/4364` (lista chroniona w kodzie) — to nie sa Twoje porty i nie probujesz ich uzyc. ★ Ta lista jest rozkazem pomiarowym, nie gwarancja — zweryfikuj `lsof -i` i `docker ps` przed startem i wpisz wynik `X z 3` do raportu`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak nowej flagi i brak zmiany wartosci domyslnej jakiejkolwiek istniejacej. Uzasadnienie do potwierdzenia albo obalenia przez Ciebie w raporcie: (a) nie tworzysz nowego ekranu — obie sekcje, ktore domykasz, sa juz zamontowane w karcie KPI i dzis renderuja `GapNotice`, wiec zmiana jest wymiana tresci istniejacej sekcji, nie nowym wizualium; (b) flagi `resultsVNextRoi` i `resultsVNextOkr` sa `default OFF` na kazdym hoscie (`src/components/ResultsVNext/resultsVNextFeatureFlags.ts:172-174`), a `resultsVNextKpi` jest ON poza publiczna produkcja (`:165-169`) — te wartosci ZOSTAJA nietkniete (`Z10`), a do zrzutow i do runtime'u podajesz flagi PARAMETREM ADRESU (`?ff_resultsVNextRoi=1`, `?ff_resultsVNextOkr=1`); (c) zrzuty kart robisz TY i ida do wlasciciela do AKCEPTU, nie do odkrywania zepsucia (`CLAUDE.md` §7). ★ Jesli Twoja zmiana w sekcji `scorecards` albo `history` okaze sie widoczna inaczej, niz zaklada ta instrukcja — nazwij to w raporcie jako zmiane widoczna dla uzytkownika do swiadomej akceptacji wlasciciela, nie chowaj pod „domkniecie spiecia”`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, w szczegolnosci `resultsInternalBetaVisibility.middleware.ts` (koperta bety Wynikow) i kazde `router.use(requireResultsInternalBetaVisibility)` w `server/src/routes/resultsVnext/**`; `server/src/Gateway.ts` (montaze `:1233-1286`); `server/src/routes/v8/index.ts`; `server/src/services/aiRoleGuard.ts`; `server/src/services/chatPermissionService.ts`; `server/src/routes/auth*.ts`; wszystko pod `server/src/services/betaAccess*`; oraz caly `server/src/routes/resultsVnext/**` (odczyt TAK, zapis NIE — zadnej nowej trasy w tym dyzurze)`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY199_KARTY_WYNIKOW_REPORT.md`. Dopisujesz wynik dyzuru 199 do DWOCH wierszy rejestru `RES-OWN` w `docs/program/waves/WAVE_03_ACCEPTANCE/modules/09_RESULTS/MODULE_ACCEPTANCE.md`: `RES-OWN-007` (kolumny `Current behavior`, `Decision/status`, `Fix commit`, `Self-QA`) i `RES-OWN-008` (te same kolumny; `OPEN_SPEC_RECONCILIATION` moze sie zmienic wylacznie w zakresie, ktory Twoj kontrakt FAKTYCZNIE pokrywa — `Z32` zakazuje wpisu `FIXED`/`VERIFIED` bez dowodu mutacyjnego). NIE dotykasz `RES-OWN-001..006`, tabeli bramek `G00-G20`, obserwacji `RES-PF-001..011`, sekcji „Owner verdict” ani zadnego innego `MODULE_ACCEPTANCE.md`. ★ Osobno, na mocy imiennego wyjatku od `Z13`, tworzysz JEDEN nowy dokument: `docs/program/funkcje/KONTRAKT_KART_KPI_OKR_ROI.md` — to jest produkt pozycji R1 i jedyny nowy plik dokumentacyjny poza raportem. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day199-karty-wynikow-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day199-karty-wynikow-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **`RES-OWN-007` JEST WIAZACY: NIE GENERUJESZ TRZECIEJ IMPLEMENTACJI.** Zakaz nowego komponentu karty, nowej powloki, nowego adaptera danych i nowej trasy API. Karty istnieja i montuja sie — Twoja praca to kontrakt (R1), dwa wolacze do JUZ ISTNIEJACYCH tras (R2) i dane plus zrzuty (R3). ★★ **ZAKAZ BUDOWANIA CZEGOKOLWIEK DLA SEKCJI `correctiveActions`.** Brak agregatu per KPI to realna luka serwerowa; jej miejsce jest w kontrakcie jako `DO_ZBUDOWANIA`. Dorobienie trasy „przy okazji” jest zlamaniem RES-OWN-007 i `Z17`. ★★ **CALY `src/components/ResultsVNext/roi/**` JEST TYLKO DO ODCZYTU** — niescalona praca „ROI: trzy ekrany scalone w JEDNA karte N” zyje poza skarbcem (33 commity lokalnego rozjazdu, m.in. plik `RoiCaseCardSections.ts`, ktorego na markerze nie ma). Gdybys uznal, ze musisz tam wejsc — STOP MERYTORYCZNY pozycji z opisem; scalenie rozwiaze nadzorca, nie Ty. ★★ **NIE RUSZASZ KOPERTY BETY WYNIKOW.** `server/src/middleware/resultsInternalBetaVisibility.middleware.ts` jest fail-closed (`503` przy awarii bazy, `:69-73`), robi swiezy `SELECT role FROM organization_members` (`:50-59`), przepuszcza wylacznie `OWNER`/`ADMIN` (`:61-67`) — i **przy `NODE_ENV=test` wylacza sie sam, jesli nie ma `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` (`:27-33`)**. Na tym strazniku zmierzono 416 falszywych twierdzen o uprawnieniach jednego modulu. KAZDA Twoja komenda testowa dotykajaca tras Wynikow ma te zmienna W TEJ SAMEJ LINII (`Z33`, `§0.2c`); bez niej Twoj zielony wynik nic nie znaczy. ★★ **NIE RUSZASZ `F.2`** — izolacji miedzynajemczej tras mutujacych `/api/vnext/results/**` (`RES-PF-011`: realny defekt cross-tenant znaleziony i zamkniety, `4 z 135` mutatorow udowodnione). Ani kodu, ani testu `tests/integration/results/day46.mutator-tenant-isolation.realpg.test.ts`, ani wiersza w rejestrze. ★★ **NAZWA BAZY NIE JEST DOWOLNA.** Seed (`server/scripts/seed-wave3-results-owner-review.ts:23`) i starter runtime (`scripts/dev/start-wave3-owner-runtime.mjs:32`) NIEZALEZNIE wymagaja wzorca `^consultify_w3_results_owner_[a-z0-9_]+$`. Dlatego Twoja baza nazywa sie `consultify_w3_results_owner_cx199`, a nie `cx199` — i to jest zgodne z `Z7`, bo niesie numer dyzuru. Kontener nazywa sie `cx-day199-pg`. ★★ **`Z10`/`Z11` — nie zmieniasz wartosci domyslnej zadnej flagi `resultsVNext*`.** Flagi podajesz PARAMETREM ADRESU. Zmiana domyslnej na `ON` = odrzucenie pozycji. ★★ **`Z31` — ZAKAZ PINOWANIA STRAZNIKA REALDB DO HOSTA, PORTU ALBO NAZWY BAZY.** `await assertRealPostgresTestEnvironment()` BEZ ARGUMENTOW, w szczegolnosci bez `expectedDatabase`. Dyzur 43 przypial straznika do swojej bazy i po usunieciu kontenera 30 przypadkow dowodowych stalo sie trwalym `SKIP` przy `exit 0`; w programie odnotowano SZESC takich incydentow. Nie dokladaj siodmego. ★★ **`Z13` — zrzuty, logi i pliki wynikowe NIE wchodza do repo.** Narzedzie zrzutowe zapisuje do `evidence/grafika/<katalog>` wzgledem `process.cwd()`, wiec uruchamiasz je Z KATALOGU ARTEFAKTOW (dokladna komenda w pozycji R3b), a po zrzutach pokazujesz `git status --porcelain` w raporcie. ★★ **`Z27` — ZAKAZ `git stash`** w kazdej postaci; stan odkladasz przez `cp` do scratcha. ★★ **`Z15` obowiazuje w calosci — zero modelu jezykowego w tym dyzurze.** Zaden pomiar, ekran ani seed nie wola `llmService`, `/api/ai/**` ani `GoogleGenerativeAI`. Ten dyzur nie ma licencji na klucz. ★★ **`Z28` — zero polaczen do bazy zdalnej, demo, stagingu i produkcji.** Wszystko lokalnie, na Twoim jednorazowym kontenerze. ★★ **Sprzatanie kontenera: `docker rm -f -v`** — z flaga `-v`. ★★ **Zakaz naprawiania przez wyciszanie** (`@ts-ignore`, `.skip`, poszerzanie `exclude`, `--no-verify`) i zakaz usuwania zastanych testow | Wlasciciel powiedzial 2026-08-23 dwie rzeczy naraz i obie sa w rejestrze `RES-OWN`. `RES-OWN-007`: „Wszystkie narzedzia – czyli karty KPI, OKR i ROI – trzeba wygenerowac ponownie”, a rejestr rozstrzygnal to na „Reconcile each mounted card with the owner contract rather than generating a third implementation”. `RES-OWN-008`: „Dokladnie opisac, jak to narzedzie ma wygladac, jak ma sie laczyc z backendem i jak ma realizowac swoje zadania”, z oczekiwaniem „Produce implementation-ready per-domain card contracts and mapping to existing APIs” PRZED dalszym kodowaniem. ★★ POMIAR WYKONANY PRZY PISANIU TEJ INSTRUKCJI, NA MARKERZE 60581ed6b5, do obalenia przez Ciebie: karty istnieja, montuja sie i maja RAZEM 30 sekcji (KPI 8, OKR 6, ROI 16 w czterech fazach), z czego 27 juz dzis czyta realne trasy. To jest lepsza wiadomosc, niz zakladalo zamowienie, i zwezi prace kodowa do jednego celnego miejsca. ★★ ODKRYCIE, KTORE JEST SEDNEM R2: dwie puste sekcje karty KPI tlumacza sie w kodzie komentarzem, ktory na tym markerze jest NIEPRAWDZIWY — `KpiToolPage.tsx:954-956` twierdzi „No reverse kpi -> scorecards endpoint exists”, a `:971-973` twierdzi „No GET exists for KPI history/events anywhere in the domain”. Obie trasy istnieja: `kpiScorecard.routes.ts:458` (`GET /for-kpi/:kpiId`) i `kpi.routes.ts:469` (`GET /:kpiId/history`), dolozone pozniej przez prace opisana w `docs/product/results-vnext/RN_G6_SRV_GAPS.md:7,126` — i nikt nie wrocil do karty. `git grep` po `src/` daje ZERO wolaczy obu tras. To jest dokladnie „spiecie”, o ktore prosi RES-OWN-007, i nie jest trzecia implementacja. ★★ DRUGIE ODKRYCIE — KOLIZJA ZASOBOWA: galaz `codex/m03-admin-20260824` w katalogu nadzorcy jest 33 commity do przodu wobec `github-backup`, a wsrod nich sa „ROI: trzy ekrany scalone w JEDNA karte N” (`f3fe2cdb47`), poprawka importow (`b6de6f9951`) i przeglad nocny Wynikow (`60160b5f82`); dotykaja siedmiu plikow `src/components/ResultsVNext/roi/**` oraz `kpiTool/KpiDeviationCaseSubview.tsx`, w tym pliku `RoiCaseCardSections.ts`, ktorego na markerze NIE MA. Dlatego caly katalog `roi/**` jest w tym dyzurze tylko do odczytu — Twoja praca kodowa i tak tam nie siega. ★ Trzecia sekcja karty KPI (`correctiveActions`) jest niepelna z INNEGO powodu: w domenie istnieje wylacznie trasa per sprawa (`kpiDeviation.routes.ts:542`), brak agregatu per KPI. To jest realna luka SERWEROWA i jej miejsce jest w kontrakcie jako `DO_ZBUDOWANIA`, nie w tym dyzurze jako kod |

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
cd /private/tmp/cx-day199-karty-wynikow

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day199-pg psql -U postgres -d consultify_w3_results_owner_cx199 \
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
cd /private/tmp/cx-day199-karty-wynikow

docker run -d --name cx-day199-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=consultify_w3_results_owner_cx199 \
  -p 127.0.0.1:6129:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day199-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6129/consultify_w3_results_owner_cx199 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6129/consultify_w3_results_owner_cx199 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day199-karty-wynikow && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6129/consultify_w3_results_owner_cx199 \
JWT_SECRET=cx199-test-secret-do-not-reuse \
npx vitest run tests/resultsVnext/kpi --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day199-karty-wynikow-artefakty/day199-karty-wynikow.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day199-karty-wynikow && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run tests/resultsVnext/kpi --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day199-karty-wynikow-artefakty/day199-karty-wynikow.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day199-karty-wynikow/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day199-pg psql -U postgres -d consultify_w3_results_owner_cx199 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day199-pg`.
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
> **(e) ★★ **Pierwsza: komentarz w kodzie jest tu ZRODLEM BLEDU, nie zrodlem prawdy.** Dwie sekcje karty KPI sa puste, bo ktos w komentarzu napisal, ze tras nie ma — a trasy dolozono pozniej i nikt do karty nie wrocil. Jedyna faktyczna specyfikacja sekcji kart zyje dzis w naglowkach komentarzy (`KpiToolPage.tsx:23-63`, `OkrSetWorkspace.tsx:11-31`, `RoiCaseFullTool.tsx:15-28`) — i co najmniej dwa punkty z osmiu w KPI sa nieaktualne. **Do kontraktu (R1) nie kopiujesz ani jednego zdania z tych komentarzy.** Piszesz z kodu i z tras, kazda pozycja zweryfikowana osobno. ★★ **Druga: `grep rvn_` przegapi CALY OKR.** Migracje nazywaja sie `20260822_rvn_okr_program_cycle.sql`, `20260823_rvn_okr_set.sql` itd., ale tworza tabele z prefiksem `okr_vnext_` (m.in. `okr_vnext_sets`, `okr_vnext_objectives`, `okr_vnext_key_results`, `okr_vnext_checkins`, `okr_vnext_alignments`, `okr_vnext_support_requests`, `okr_vnext_reflections`, `okr_vnext_reviews`). Nazwa pliku migracji NIE JEST nazwa tabeli. Jesli policzysz pokrycie seeda grepem po `rvn_`, wyjdzie Ci, ze OKR jest pokryty w 100%, i zmierzysz nie ten zbior. ★★ **Trzecia: tryb `?sampleData=results-vnext` NIE pokrywa sekcji kart — pokrywa rejestry.** `src/components/ResultsVNext/resultsVNextOwnerSampleData.ts` jest podpiety do osmiu funkcji (`src/components/ResultsVNext/kpiApi.ts:237,256,284,546`, `okrApi.ts:192,218,247,271`, `roiApi.ts:269,301`) i ZADNA z nich nie obsluguje `kpiDeviationApi`, `kpiInitiativeImpactApi`, `okrObjectiveApi` ani `roiCaseFullToolApi`. Karta otwarta w trybie sample jest w wiekszosci pusta i uderza w prawdziwy backend. Nie uzywaj tego trybu jako dowodu, ze karta „dziala z danymi”. ★★ **Czwarta: zrzut z harnessu dev-render dowodzi WYGLADU, nie DANYCH.** Trzy ekrany kart (`results-vnext-kpi-tool`, `results-vnext-okr-workspace`, `results-vnext-roi-full-tool`) montuja REALNE komponenty, ale stubuja `Api`/`window.fetch` wlasnym magazynem w pamieci. To jest dokladnie ten harness, ktorego wymaga `CLAUDE.md` §7 (Ty robisz zrzut przed wlascicielem) — ale przy kazdym zrzucie MUSISZ napisac jednym zdaniem, czego on dowodzi, a czego nie. Dowodem danych jest R3a (readback SQL + realny `GET` przez `ApiGateway`), dowodem wygladu jest R3b. Pomylenie tych dwoch to gotowy falszywy zielony. Uwaga dodatkowa z naglowka `results-vnext-roi-full-tool.tsx:5-11`: piec starszych ekranow `results-vnext-*` re-sklada widok z prezenterow zamiast montowac gotowy komponent — zrzut z NICH nie dowodzi orkiestracji. Trzy ekrany kart te luke domykaja; nie mieszaj ich z pozostalymi. ★★ **Piata: runtime `adopt-existing` ma trzy bramki, o ktore ludzie sie rozbijaja.** `scripts/dev/start-wave3-owner-runtime.mjs` wymaga `WAVE3_RUNTIME_CONFIRM=YES`, `WAVE3_RUNTIME_EXPECTED_SHA` ROWNEGO biezacemu `HEAD` oraz `WAVE3_RUNTIME_DIRTY_FINGERPRINT` ROWNEGO biezacemu odciskowi. **Odcisk zmienia sie po KAZDYM commicie i po kazdej edycji pliku** — pobierasz go na nowo komenda `node scripts/dev/start-wave3-owner-runtime.mjs fingerprint`. Manifest fixture'u (plik `0600`, `ownershipState:'FINAL'`, nonce, marker w tabeli `wave3_owner_fixture_markers`) **produkuje sam seed** — nie piszesz go recznie i nie podrabiasz. ★★ **Szosta: seed ma wlasny readback i to on jest jego wartoscia.** Blok `count(*)` z porownaniem do `expected` (`server/scripts/seed-wave3-results-owner-review.ts:511-543`) rzuca `Readback failed: <klucz>` przy kazdej rozbieznosci. Jesli dolozysz wiersze i NIE rozszerzysz tego bloku, dolozysz dane, ktorych nikt nie sprawdza — i seed przestanie byc dowodem. To jest warunek ukonczenia R3a, nie sugestia. ★★ **Siodma: karta OKR i karta ROI maja INNA powloke niz KPI.** KPI uzywa `NModeShell` + `ArtifactRightPanel` (uzasadnienie w naglowku `KpiToolPage.tsx:9-21`), a OKR i ROI uzywaja `StandardModuleBar` z zakladkami i nie maja prawego panelu artefaktu. To jest niespojnosc do WPISANIA do kontraktu jako pozycja inwentarzowa — **nie do naprawienia w tym dyzurze**. Przebudowa powloki karty to osobna praca ze skillem `consultify-artefakty` i wlasnym akceptem wlasciciela. ★★ **Osma: rejestry vNext nie maja podwojnego klikniecia, a KPI nawiguje inaczej niz reszta.** W `src/components/ResultsVNext/**` nie ma ani jednego `onRowDoubleClick` (jest wylacznie w legacy `src/components/Results/`). OKR i ROI doklejaja `window.location.search` przy nawigacji do karty (`ResultsOkrHub.tsx:607`, `ResultsRoiHub.tsx:676`), a KPI nie dokleja (`ResultsKpiRegistryPage.tsx:1537`, `:1596`) i polega na obejsciu w `resultsVNextFeatureFlags.ts:126-134`. Obie rzeczy ida do kontraktu i do raportu jako inwentarz — **zadnej z nich nie „naprawiasz” w tym dyzurze**, bo promien razenia zmiany nawigacji przy wlaczonych flagach wychodzi poza Twoja licencje**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day199-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day199-karty-wynikow-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 — `docs/program/funkcje/KONTRAKT_KART_KPI_OKR_ROI.md`: jeden wiersz na KAZDA sekcje kazdej z trzech kart (autor naliczyl 30 — policz sam), z kolumnami sekcja / definicja w kodzie / trasa API / rejestracja trasy / wolacz we froncie / tabele zrodlowe / stan pusty / stan bledu / werdykt, plus sekcje „LUKI — DO_ZBUDOWANIA” i „TRASY BEZ KONSUMENTA”. R2 — domkniecie spiecia DWOCH sekcji karty KPI (`scorecards` i `history`) do istniejacych tras, z usunieciem dwoch nieprawdziwych komentarzy i z dowodem mutacyjnym w obie strony`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6129` albo `5068 i 5069` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6129` albo `5068 i 5069`** (`Z7`).

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

Właściciel powiedział o kartach Wyników dwie rzeczy naraz i obie są w rejestrze
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/09_RESULTS/MODULE_ACCEPTANCE.md`:

> `RES-OWN-007` (2026-08-23): „Wszystkie narzędzia – czyli karty KPI, OKR i ROI –
> trzeba wygenerować ponownie."
> Decyzja rejestru: **`Reconcile each mounted card with the owner contract rather
> than generating a third implementation`** · stan
> `ROUTES_AND_EXISTING_CARDS_RECONNECTED / WORKFLOW_REMEDIATION_AND_OWNER_REVIEW_OPEN`

> `RES-OWN-008` (2026-08-23): „Dokładnie opisać, jak to narzędzie ma wyglądać, jak
> ma się łączyć z backendem i jak ma realizować swoje zadania… zgodnie z całością
> grafiki aplikacji." · stan `OPEN_SPEC_RECONCILIATION`
> Oczekiwanie rejestru: **`Produce implementation-ready per-domain card contracts
> and mapping to existing APIs`** — *przed* dalszym kodowaniem.

Czyli: **nie budujesz trzeciej implementacji. Spisujesz kontrakt istniejących kart
z REALNYCH tras i domykasz to, co pomiar wskaże jako niepodłączone.**

**Pomiar wykonany przy pisaniu tej instrukcji, na markerze `60581ed6b5`** (do
obalenia przez Ciebie — patrz `Z24`). Karty istnieją, montują się i mają
**30 sekcji razem**, nie 5+7+6, jak mówił materiał zbiorczy:

| Karta | Trasa | Komponent wejściowy | Sekcji | Czyta realne API | Hybryda | **Pusta atrapa** |
|---|---|---|---|---|---|---|
| KPI | `/results/kpi/:kpiId` | `kpiTool/KpiToolPage.tsx` | **8** | 5 | 1 | **2** |
| OKR | `/results/okr/sets/:okrSetId` | `okr/OkrSetToolPage.tsx` → `OkrSetWorkspace.tsx` | **6** | 6 | 0 | 0 |
| ROI | `/results/roi/cases/:roiCaseId` | `roi/RoiCaseToolPage.tsx` → `RoiCaseFullTool.tsx` | **16** (4 fazy) | 16 | 0 | 0 |

**To jest lepsza wiadomość, niż zakładał brief: `27 z 30` sekcji już dziś czyta
realne trasy.** Praca kodowa tego dyżuru jest więc WĄSKA i celna — i dokładnie
dlatego dokument kontraktu (R1) jest tu produktem ważniejszym niż kod.

## ★★ ODKRYCIE, które zmienia sens R2

Dwie puste sekcje karty KPI **tłumaczą się w kodzie komentarzem, który jest dziś
nieprawdziwy.** `src/components/ResultsVNext/kpiTool/KpiToolPage.tsx`:

```ts
// :954-956  (sekcja `scorecards`)
// "No reverse kpi -> scorecards endpoint exists
//  (kpiScorecard.routes.ts only has GET /:scorecardId/items, never the reverse)."

// :971-973  (sekcja `history`)
// "No GET exists for KPI history/events anywhere in the domain
//  (checked kpi.routes.ts ...)"
```

**Obie trasy ISTNIEJĄ na tym markerze:**

- `server/src/routes/resultsVnext/kpiScorecard.routes.ts:458` →
  `GET '/for-kpi/:kpiId'` → `listVisibleScorecardsForKpi`; komentarz w kodzie
  `:447-456` nazywa to wprost „reverse lookup".
- `server/src/routes/resultsVnext/kpi.routes.ts:469` → `GET '/:kpiId/history'` →
  `getKpiHistory`, zwraca `{ entries, nextCursor }` (`:489`).

Ich pochodzenie: `docs/product/results-vnext/RN_G6_SRV_GAPS.md:7,126` — trasy
dołożono po tym, jak napisano komentarz w karcie. **Nikt nie wrócił do karty.**
`git grep 'for-kpi'` i `git grep '/history'` po `src/` na markerze dają **zero**
trafień w kodzie Wyników — front nie ma dla nich ani jednego wołacza.

To jest podręcznikowy przypadek z metodyki programu („wołacz istnieje ≠ renderuje
się", odwrócony: **trasa istnieje, wołacza nigdy nie dopisano, a kod tłumaczy się
nieaktualnym zdaniem**). Domknięcie tych dwóch sekcji jest DOKŁADNIE „spięciem",
o które prosi `RES-OWN-007`, i **nie jest** trzecią implementacją.

**Trzecia niepełna sekcja jest inna i NIE domykasz jej kodem.** Sekcja
`correctiveActions` (`KpiToolPage.tsx:773-803`) uczciwie mówi `GapNotice` i linkuje
do spraw odchyleń, bo w domenie istnieje wyłącznie `GET '/:caseId/corrective-actions'`
(`kpiDeviation.routes.ts:542`) — per SPRAWA, nie ma agregatu per KPI. To jest realna
luka SERWEROWA i jej miejsce jest w kontrakcie jako pozycja `DO_ZBUDOWANIA`, nie
w tym dyżurze jako kod (`RES-OWN-007`: zakaz budowy na dziko).

## ★★ DRUGIE ODKRYCIE — kolizja z pracą, której NIE MA W SKARBCU

Gałąź `codex/m03-admin-20260824` w lokalnym katalogu nadzorcy jest **33 commity
do przodu wobec `github-backup`**, a wśród tych commitów są:

```
f3fe2cdb47 ROI: trzy ekrany scalone w JEDNA karte N — jedno menu zamiast trzech,
           wszystkie 17 podwidokow zachowane
b6de6f9951 ROI: brakujacy import RoiCardModeProps w czterech plikach
60160b5f82 przeglad nocny: Inicjatywy, Realizacja, Wyniki — 30 z 33 na swiezych zrzutach
```

Dotknięte pliki: `src/components/ResultsVNext/roi/RoiCaseCardSections.ts` (plik,
którego **na markerze nie ma**), `RoiCaseFullTool.tsx`, `RoiCaseModelWorkspace.tsx`,
`RoiCaseDecisionWorkspace.tsx`, `RoiCaseRealizeValueWorkspace.tsx`,
`RoiCaseLearnWorkspace.tsx`, `RoiPirOutcomesTab.tsx`, `kpiTool/KpiDeviationCaseSubview.tsx`.

**Skutek dla Ciebie: `src/components/ResultsVNext/roi/**` jest w tym dyżurze
NIETYKALNY** (tabela licencji, `Z17`). Twoja praca kodowa i tak tam nie sięga —
pomiar wyżej mówi, że wszystkie `16 z 16` zakładek ROI czytają realne API. Gdybyś
mimo to uznał, że musisz tam wejść: **STOP MERYTORYCZNY tej pozycji** z opisem, bo
scalenie rozwiąże nadzorca, nie Ty.

# 2. TEZY ZLECENIA

Wszystkie poniższe to **rozkaz pomiarowy, nie prawda objawiona**. Obalenie
którejkolwiek jest sukcesem dyżuru i wchodzi do „Korekt wobec instrukcji".

- **T1.** Karta KPI ma **8** sekcji (`KpiToolPage.tsx:979-988`), z czego dwie
  (`scorecards` `:946-960`, `history` `:963-977`) mają `hasData:false` i jedyną
  treścią jest `GapNotice`. Policz sekcje SAM z tablicy, nie przepisuj ósemki.
- **T2.** Obie trasy, których te sekcje „nie mają", istnieją:
  `kpiScorecard.routes.ts:458` i `kpi.routes.ts:469`. Sprawdź obie i **sprawdź
  kształt odpowiedzi**, zanim napiszesz wołacza.
- **T3.** Karta OKR ma **6** zakładek (`OkrSetWorkspace.tsx:159-166`), nie 7 —
  „Objectives" i „Key Results" to JEDNA zakładka z drill-downem (`:100-133`).
  Wszystkie sześć czyta realne API.
- **T4.** Karta ROI to **4 fazy × 16 pod-zakładek**, nie 6 sekcji; materiał
  zbiorczy wymieniał wyłącznie fazę 1 (`RoiCasePhaseNav.tsx:28-33`;
  `RoiCaseModelWorkspace.tsx:639-646`, `RoiCaseDecisionWorkspace.tsx:90-93`,
  `RoiCaseRealizeValueWorkspace.tsx:225-231`, `RoiCaseLearnWorkspace.tsx:165-169`).
- **T5.** ★ **Tabele OKR NIE mają prefiksu `rvn_`.** Migracje nazywają się
  `20260822_rvn_okr_*`, ale tworzą tabele `okr_vnext_*` (15 sztuk). `grep rvn_`
  przegapi CAŁY OKR. Zweryfikuj przed jakimkolwiek liczeniem pokrycia seeda.
- **T6.** Flagi `roiRegistry` i `okrRegistry` są `default OFF` **na każdym hoście**
  (`src/components/ResultsVNext/resultsVNextFeatureFlags.ts:172-174`), a
  `kpiRegistry` jest ON poza publiczną produkcją (`:165-169`). Bez `?ff_resultsVNextRoi=1`
  / `?ff_resultsVNextOkr=1` karty ROI i OKR pokazują stan pusty „narzędzie jeszcze
  nie włączone". **Nie zmieniasz tych wartości domyślnych** (`Z10`).
- **T7.** Seed `server/scripts/seed-wave3-results-owner-review.ts` pokrywa
  ~`10 z 30` sekcji: **piętnaście** tabel potrzebnych sekcjom kart nie dostaje
  ani jednego `INSERT` (lista w R3). Policz to sam, tabela po tabeli.

# 3. POZYCJE DYŻURU

## R1 — KONTRAKT KART, spisany z REALNYCH tras (rdzeń, produkt główny)

**Tworzysz JEDEN nowy plik:** `docs/program/funkcje/KONTRAKT_KART_KPI_OKR_ROI.md`.
To jest jedyny nowy dokument, na który masz licencję (wyjątek od `Z13`, wpisany
imiennie w tabeli licencji). Nagłówek YAML wzorem sąsiadów w tym katalogu
(np. `PLAN_MIGRACJI_TASKS_KANON.md:1-7`):

```yaml
---
doc_id: funkcje-kontrakt-kart-kpi-okr-roi
status: canonical
owner: piotr
truth_type: design
established: 2026-08-31
---
```

**Kształt obowiązkowy: JEDEN WIERSZ NA SEKCJĘ KARTY, wszystkie 30, bez „…".**
Trzy tabele (KPI / OKR / ROI), każda z kolumnami:

| # | Sekcja (id + etykieta PL) | Definicja w kodzie (plik:linia) | Trasa API (metoda + pełna ścieżka) | Rejestracja trasy (plik:linia) | Wołacz we froncie (plik:linia) | Tabele źródłowe | Stan pusty | Stan błędu | Werdykt |

**Werdykt** dla każdej sekcji jest JEDNYM z czterech, bez wariantów pośrednich:
`SPIĘTA` · `SPIĘTA_CZĘŚCIOWO` (napisz czego brakuje) · `DO_SPIĘCIA` (trasa jest,
wołacza nie ma) · `DO_ZBUDOWANIA` (trasy nie ma — pozycja dla przyszłego dyżuru).

**Zasady twarde tej pozycji:**

- ★ **Każda trasa w kolumnie „Trasa API" ma być przez Ciebie ZWERYFIKOWANA
  osobno** — plik trasy + linia `router.get/post/...` + linia montażu w
  `server/src/Gateway.ts`. Trasa, której nie znalazłeś w obu miejscach, nie ma
  prawa wejść do kontraktu jako istniejąca. To nie jest przepisywanie tej
  instrukcji: liczby poniżej są DO OBALENIA.
- ★ **Kolumna „Wołacz we froncie" pustego wiersza to nie porażka, tylko WYNIK.**
  Sekcja z trasą i bez wołacza dostaje `DO_SPIĘCIA` — i to jest dokładnie ta
  lista, z której bierze się R2.
- ★ **Stan pusty i stan błędu opisujesz z KODU**, nie z życzenia: co konkretnie
  renderuje komponent, gdy odpowiedź jest pusta, a co gdy `fetch` rzuci. Jeżeli
  sekcja nie ma żadnej obsługi błędu — wpisujesz `brak obsługi błędu` i to jest
  pozycja do rejestru, nie do naprawy w tym dyżurze.
- ★ **Sekcja „LUKI — DO_ZBUDOWANIA" na końcu dokumentu**, wierszami, z kosztem
  rzędu wielkości i wskazaniem, czego brakuje (trasa? serwis? repozytorium?).
  Minimum, które ma tam trafić po Twojej weryfikacji: agregat działań
  korygujących per KPI (dziś tylko per sprawa, `kpiDeviation.routes.ts:542`).
- ★ **Sekcja „TRASY BEZ KONSUMENTA"** — trasy Wyników, których nikt we froncie
  nie woła. Pomiar autora do obalenia: `GET /vnext/results/kpi/:kpiId/trend`
  (`kpi.routes.ts:433`), `GET /vnext/results/kpi/:kpiId/next-obligation`
  (`kpi.routes.ts:496`) oraz obie trasy z R2 przed jego wykonaniem. Komenda
  odtwarzająca dla każdej: `git grep -n '<fragment ścieżki>' -- src/`.
- ★ **Nie kopiujesz do kontraktu tekstu z komentarzy w komponentach.** Dwa z nich
  są dziś nieprawdziwe (patrz sekcja 1) — kontrakt ma opisywać KOD I TRASY, nie
  cudze zdania o nich.

**Ukończone, gdy:** dokument istnieje, ma wszystkie 30 wierszy (albo Twoją inną,
zmierzoną liczbę z mianownikiem i wyjaśnieniem różnicy), każda trasa ma dwie
lokalizacje (definicja + montaż), sekcje „LUKI" i „TRASY BEZ KONSUMENTA" są
niepuste albo jawnie uzasadnione jako puste.

## R2 — domknięcie spięcia: DWIE sekcje karty KPI (rdzeń)

**Zakres jest zamknięty i wynika z pomiaru, nie z ambicji:** sekcje `scorecards`
i `history` w `src/components/ResultsVNext/kpiTool/KpiToolPage.tsx`. Nic więcej.

Kolejność pracy:

1. **Najpierw zmierz kontrakt odpowiedzi obu tras** — przeczytaj handlery
   (`kpiScorecard.routes.ts:458`, `kpi.routes.ts:469`) i serwisy, które wołają.
   Zapisz w raporcie DOSŁOWNY kształt koperty każdej z nich. Nie zgaduj.
2. **Dopisz wołacza w warstwie klienta domeny**, wzorem sąsiadów.
   ★ **Uwaga na ścieżkę — `kpiApi.ts` NIE leży w `kpiTool/`.** Klient KPI to
   `src/components/ResultsVNext/kpiApi.ts` (`getKpi` `:255`,
   `getKpiCurrentDefinitionVersion` `:281`, `listKpiMeasurements` `:542`), a
   klient kart wyników to osobny plik `src/components/ResultsVNext/kpiScorecards/kpiScorecardApi.ts`
   (`listKpiScorecards` `:193`, `getKpiScorecard` `:212`, `listKpiScorecardItems` `:226`).
   W `kpiTool/` leżą wyłącznie `kpiDeviationApi.ts` i `kpiInitiativeImpactApi.ts`.
   **Rozstrzygnij i uzasadnij w raporcie, do którego z tych plików trafia każdy
   z dwóch nowych wołaczy** — naturalny podział to `for-kpi` do
   `kpiScorecardApi.ts`, `history` do `kpiApi.ts`, ale to ma być Twoja decyzja
   poparta konwencją sąsiadów, nie przepisanie tego zdania.
   Nowe funkcje mają wyglądać jak sąsiedzi w wybranym pliku: ta sama obsługa
   błędu i ten sam sposób budowania URL. **Zakaz `fetch` wprost z komponentu.**
3. **Podmień `GapNotice` na realną treść** w obu sekcjach. Sekcja ma mieć:
   stan ładowania, stan pusty (uczciwy, `Z16` — pusto to nie błąd), stan błędu,
   i treść. Kanon wyglądu bierzesz z sekcji, które w tej samej karcie już to
   robią (np. `deviations` `:719-771`), nie wymyślasz nowego.
4. ★ **USUŃ dwa nieprawdziwe komentarze** — `KpiToolPage.tsx:952-957` i `:969-975`
   oraz ich odpowiedniki w nagłówku pliku (`:53-58`, `:59-63`). Zostawienie ich
   po naprawie utrwala dokładnie ten błąd, który ten dyżur likwiduje.
5. **`hasData`** obu sekcji ma odtąd wynikać z danych, nie być zaszytym `false`.

★★ **Zakaz budowania czegokolwiek dla sekcji `correctiveActions`.** Ona ma być
opisana w kontrakcie jako `DO_ZBUDOWANIA` (brak trasy agregującej) i zostaje
w kodzie bez zmian. Dorobienie trasy „przy okazji" jest złamaniem `RES-OWN-007`
i `Z17`.

**Wiersz rejestru otwiera właściwą kartę — zweryfikuj, nie zakładaj.** Pomiar
autora: w rejestrach vNext **nie ma `onRowDoubleClick`** (`git grep onRowDoubleClick
-- src/components/ResultsVNext` → zero); kartę otwiera kebab albo akcja w preview:
`ResultsKpiRegistryPage.tsx:1537` (kebab) i `:1595-1596` (preview),
`ResultsOkrHub.tsx:607-608, 621-622`, `ResultsRoiHub.tsx:676-677`. Rozbieżność
między KPI a resztą: **OKR i ROI doklejają `window.location.search`** (żeby flaga
przeżyła nawigację), **KPI nie dokleja** — polega na obejściu w
`resultsVNextFeatureFlags.ts:126-134`. **Nie „naprawiaj" tego w tym dyżurze** —
wpisz do kontraktu (R1) i do raportu jako pozycję inwentarzową; zmiana zachowania
nawigacji przy włączonych flagach ma promień rażenia poza tym dyżurem.

**Ukończone, gdy:** obie sekcje renderują dane z realnych tras; nowy test
komponentowy dowodzi tego dla obu (osobno stan pusty i stan z danymi); dowód
mutacyjny w obie strony (`Z32`) — psujesz URL wołacza → test CZERWONY, cofasz →
ZIELONY, `git diff` po cofnięciu pusty; nieprawdziwe komentarze usunięte.

## R3 — seed przeglądowy + PIERWSZE ZRZUTY KART DLA WŁAŚCICIELA

★ **Właściciel NIGDY nie widział tych kart z danymi. Reguła 7 `CLAUDE.md`: nie
jest pierwszym testerem wizualnym — zrzut robisz Ty, i ma być czysty.**

### R3a — seed

Rozszerzasz **istniejący** `server/scripts/seed-wave3-results-owner-review.ts`.
Nie tworzysz drugiego seeda. Nie zmieniasz jego kontraktu własności (nonce,
manifest `0600`, `wave3_owner_fixture_markers`) — to jest strażnik, nie ozdoba.

Pomiar autora — **piętnaście tabel bez ani jednego `INSERT` w dzisiejszym
seedzie** (policz sam, `grep -o 'INSERT INTO [a-z_]*' | sort -u` i porównaj
z listą tabel per sekcja z R1):

| Tabela | Sekcja karty, która przez to jest pusta |
|---|---|
| `rvn_kpi_corrective_actions` | KPI §5 działania korygujące |
| `rvn_kpi_initiative_impacts` | KPI §6 inicjatywy wpływające |
| `rvn_kpi_scorecards`, `rvn_kpi_scorecard_items` | KPI §7 karty wyników |
| `rvn_kpi_recovery_actions` | podwidok sprawy odchylenia |
| `rvn_roi_assumptions` | ROI Build → Założenia |
| `rvn_roi_cost_lines` | ROI Build → Koszty |
| `rvn_roi_benefit_lines`, `rvn_roi_benefit_evidence_links` | ROI Build → Korzyści |
| `rvn_roi_scenarios` | ROI Build → Scenariusze |
| `rvn_roi_calculation_policy` | ROI Build → Baseline i polityka (połowa) |
| `rvn_roi_forecast_versions` | ROI Realize → Prognoza |
| `rvn_roi_variances` | ROI Realize → Wariancje |
| `okr_vnext_alignments` | OKR → Dopasowania |
| `okr_vnext_support_requests` | OKR → Rozmowy i wsparcie |
| `okr_vnext_reflections` | OKR → Przegląd i refleksja |

Dokładasz wiersze do tych tabel — **dane sensowne biznesowo, po polsku, spójne
z resztą fixture'u** (te same org/user/inicjatywa/KPI/sprawa ROI/zestaw OKR).
Dane demo są twarzą produktu: zero `test`, `foo`, `Lorem ipsum`, zero dat
w przyszłości bez powodu.

★ **Seed ma własny readback** (`:511-543`, blok `count(*)` z porównaniem do
`expected`). Każdy nowy wiersz **musi** wejść do tego bloku — inaczej dokładasz
dane, których nikt nie sprawdza, i seed przestaje być dowodem. To jest warunek
ukończenia pozycji, nie sugestia.

★ **Odczyt przez realną trasę, nie tylko SQL** (`Z21`, `Z34`): po seedzie
podnosisz runtime i **dla każdej z trzech kart wykonujesz co najmniej jeden realny
`GET` przez `ApiGateway` z podpisanym JWT**, i zapisujesz KOD ODPOWIEDZI oraz
liczbę wierszy. Zielony SQL bez `HTTP 200` nie zamyka tej pozycji.

### R3b — zrzuty

**Harness już istnieje i montuje REALNE komponenty kart** (`dev-render/main.tsx`:
`results-vnext-kpi-tool` `:665-668`, `results-vnext-okr-workspace` `:650-653`,
`results-vnext-roi-full-tool` `:615-618`). Uruchamiasz go na SWOIM porcie:

```bash
cd /private/tmp/cx-day199-karty-wynikow && npx vite --config dev-render/vite.config.ts --port <PIERWSZY_PORT_HARNESSU> --strictPort
```

Zrzuty robisz narzędziem `scripts/dev/grafika-zrzuty.mjs`, po `2` motywy na
ekran (`--motywy=light,dark` jest wartością domyślną), z `uwagi=0` (narzędzie
podaje ten parametr samo — panel uwag nie ma prawa być na zrzucie do akceptu).

★★ **`Z13`: zrzuty NIE wchodzą do repo.** Narzędzie zapisuje do
`evidence/grafika/<katalog>` **względem `process.cwd()`**, więc uruchamiasz je
z katalogu artefaktów, nie z worktree:

```bash
mkdir -p /private/tmp/cx-day199-karty-wynikow-artefakty && cd /private/tmp/cx-day199-karty-wynikow-artefakty && \
  node /private/tmp/cx-day199-karty-wynikow/scripts/dev/grafika-zrzuty.mjs \
    --base=http://127.0.0.1:<PIERWSZY_PORT_HARNESSU> \
    --ekrany=results-vnext-kpi-tool,results-vnext-okr-workspace,results-vnext-roi-full-tool \
    --katalog=199-karty-wynikow --faza=PO --jezyk=pl
#   oczekiwane: 6 plików PNG w /private/tmp/cx-day199-karty-wynikow-artefakty/evidence/grafika/199-karty-wynikow/
#   Po zrzutach: `git -C /private/tmp/cx-day199-karty-wynikow status --porcelain` MUSI być czysty
#   w zakresie evidence/ — jeśli nie jest, przenieś pliki i powtórz kontrolę.
```

★ **Zrzut z harnessu dowodzi WYGLĄDU, nie danych.** Ekrany kart stubują
`Api`/`window.fetch` własnym magazynem w pamięci. Napisz to w raporcie wprost,
jednym zdaniem, obok zrzutów — mylenie tych dwóch dowodów to gotowy fałszywy
zielony, a właściciel ma dostać uczciwy podpis pod obrazkiem. Dowodem DANYCH jest
R3a (SQL readback + realny `GET`), dowodem WYGLĄDU jest R3b.

★ **Zrzut czysty:** zero pastylek harnessu, zero gwiazdek i ozdób, tokeny `c-*`,
oba motywy. Obejrzyj każdy plik WŁASNYMI OCZAMI przed wpisaniem go do raportu —
„skrypt się wykonał" nie jest oglądaniem (`CLAUDE.md` §7).

**Ukończone, gdy:** seed rozszerzony i jego readback rozszerzony razem z nim;
SQL + realny `GET` dla trzech kart w raporcie z kodami odpowiedzi; `6` zrzutów
(3 ekrany × 2 motywy) w katalogu artefaktów z `shasum -a 256`; `git status`
w zakresie `evidence/` czysty; przy każdym zrzucie zdanie, czego on dowodzi,
a czego nie.

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis (NOWY PLIK) | `docs/program/funkcje/KONTRAKT_KART_KPI_OKR_ROI.md` — **imienny wyjątek od `Z13`**, jedyny nowy dokument w tym dyżurze poza raportem |
| Zapis | `src/components/ResultsVNext/kpiTool/KpiToolPage.tsx` — WYŁĄCZNIE sekcje `scorecards` (`:946-960`) i `history` (`:963-977`), ich `hasData`, oraz usunięcie nieprawdziwych komentarzy (`:53-63`, `:952-957`, `:969-975`). **Zakaz zmian w sekcjach `performance`, `contract`, `measurements`, `deviations`, `correctiveActions`, `initiatives`** |
| Zapis | `src/components/ResultsVNext/kpiApi.ts` — WYŁĄCZNIE nowa funkcja wołająca `GET /:kpiId/history`, wzorem `getKpiCurrentDefinitionVersion` (`:281`) i `listKpiMeasurements` (`:542`); **zakaz zmian w istniejących funkcjach i w bramce `sampleData`** (`:237`, `:256`, `:284`, `:546`) |
| Zapis | `src/components/ResultsVNext/kpiScorecards/kpiScorecardApi.ts` — WYŁĄCZNIE nowa funkcja wołająca `GET /scorecards/for-kpi/:kpiId`, wzorem `listKpiScorecards` (`:193`) i `listKpiScorecardItems` (`:226`); zakaz zmian w istniejących funkcjach. ★ Jeżeli Twoje rozstrzygnięcie z R2 kroku 2 umieści oba wołacze w jednym pliku — drugi wiersz tej licencji zostaje niewykorzystany, i piszesz to w raporcie |
| Zapis | NOWE pliki testowe `day199.*` w `tests/resultsVnext/kpi/` — lokalizację i konwencję potwierdź wg sąsiadów w tym katalogu (`deviationStateMachine.test.ts`, `initiativeKpiImpactCommands.test.ts`) oraz w `tests/components/Results/`; `Z18` i `Z31` obowiązują. **Nowe pliki w `tests/` wymagają `git add -f`** |
| Zapis | `server/scripts/seed-wave3-results-owner-review.ts` — WYŁĄCZNIE nowe `INSERT`-y do 15 tabel z R3a **oraz** rozszerzenie bloku readbacku (`:511-543`) o te wiersze. **Zakaz zmian w kontrakcie własności**: guard nazwy bazy (`:23`), `ownershipNonce` (`:81`), `wave3_owner_fixture_markers` (`:147-155`), `dropDb()` (`:27-75`), kształt manifestu (`:582-649`) |
| Zapis | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/09_RESULTS/MODULE_ACCEPTANCE.md` — WYŁĄCZNIE wiersze `RES-OWN-007` i `RES-OWN-008` w tabeli „Owner UI/UX/CX register": kolumny `Current behavior`, `Decision/status`, `Self-QA`, `Fix commit`. **Nie dotykasz** `RES-OWN-001..006`, tabel `G00–G20`, `RES-PF-001..011`, „Owner verdict" ani żadnego innego `MODULE_ACCEPTANCE.md` |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY199_KARTY_WYNIKOW_REPORT.md` |
| Odczyt (ZAKAZ ZAPISU) | ★★ `src/components/ResultsVNext/roi/**` — CAŁY katalog. Powód: niescalona praca „ROI: trzy ekrany scalone w JEDNĄ kartę N" żyje poza skarbcem (patrz sekcja 1). Wchodzisz tam wyłącznie czytać do kontraktu |
| Odczyt | `src/components/ResultsVNext/okr/**` (`OkrSetWorkspace.tsx`, `OkrSetToolPage.tsx`, `OkrObjectivesView`, `OkrKeyResultsView`, `OkrCheckInsView`, `OkrAlignmentsView`, `OkrSupportView`, `OkrReviewReflectionView`, `OkrHistoryView`, `okrApi.ts`) — źródło wierszy kontraktu; **nie zmieniasz** |
| Odczyt | `server/src/routes/resultsVnext/**` — WSZYSTKIE routery (`kpi`, `kpiDeviation`, `kpiPerspectives`, `kpiScorecard`, `kpiRecoveryChildren`, `kpiLegacyArchive`, `roi`, `roiPerspectives`, `roiLegacyArchive`, `okr`, `okrLegacyArchive`, `search`) — źródło kolumny „Trasa API"; **nie zmieniasz ani jednej trasy** |
| Odczyt | `server/src/Gateway.ts:1233-1286` — montaże rodziny `/api/vnext/results/**`, kolumna „Rejestracja trasy"; **nie zmieniasz** (`Z12`, `Z19`) |
| Odczyt | ★★ `server/src/middleware/resultsInternalBetaVisibility.middleware.ts` — koperta bety Wyników; **NIETYKALNA** (patrz ZAKAZ) |
| Odczyt | `src/components/ResultsVNext/resultsVNextFeatureFlags.ts` — wartości domyślne flag; **nie zmieniasz** (`Z10`) |
| Odczyt | `src/components/ResultsVNext/resultsVNextOwnerSampleData.ts`, `ResultsVNextRegistryShell.tsx`, `ResultsKpiRegistryPage.tsx`, `ResultsOkrHub.tsx`, `ResultsRoiHub.tsx`, `ResultsOwnerReviewEntry.tsx`, `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` — kontekst tras i otwierania kart; **nie zmieniasz** |
| Odczyt | `dev-render/main.tsx`, `dev-render/screens/results-vnext-{kpi-tool,okr-workspace,roi-full-tool}.tsx`, `dev-render/vite.config.ts`, `scripts/dev/grafika-zrzuty.mjs` — harness zrzutów; **nie zmieniasz** |
| Odczyt | `scripts/dev/start-wave3-owner-runtime.mjs` — adopcja bazy fixture'u; **nie zmieniasz** |
| Odczyt | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/09_RESULTS/MODULE_ACCEPTANCE.md` (rejestr `RES-OWN`), `docs/product/results-vnext/RN_G6_SRV_GAPS.md`, `RN_G6_UIFIX.md`, `RN_G2_UI_SCOPE.md` — dowody i historia; **nie zmieniasz** |

**Nietykalne imiennie:** koperta bety Wyników i każdy `router.use(requireResultsInternalBetaVisibility)`;
pozycja `F.2` (izolacja międzynajemcza tras mutujących `/api/vnext/results/**`,
`RES-PF-011`) i test `tests/integration/results/day46.mutator-tenant-isolation.realpg.test.ts`;
wartości domyślne flag `resultsVNext*`; cały `src/components/ResultsVNext/roi/**`;
kontrakt własności fixture'u w seedzie.

**Rozłączność z partią równoległą:** ten dyżur dotyka karty KPI, seeda Wyników,
jednego nowego dokumentu i dwóch wierszy w `09_RESULTS/MODULE_ACCEPTANCE.md`.
Przed pierwszym commitem sprawdź `git log` gałęzi bazowej, czy któryś z równolegle
biegnących dyżurów (198, 200, 202) nie wszedł w te same pliki — jeśli tak, zgłoś
kolizję zasobową **zanim** zaczniesz pisać, nie po.

# 5. TWARDE ZASADY

- ★★ **`RES-OWN-007` jest wiążący: NIE GENERUJESZ TRZECIEJ IMPLEMENTACJI.**
  Zakaz nowego komponentu karty, nowej powłoki, nowego adaptera danych, nowej
  trasy. Karty istnieją i montują się — Twoja praca to kontrakt (R1), dwa
  wołacze (R2) i dane (R3).
- ★★ **NIE RUSZASZ KOPERTY BETY WYNIKÓW.** `resultsInternalBetaVisibility.middleware.ts`
  jest fail-closed (`503` przy awarii bazy, `:69-73`) i **przy `NODE_ENV=test`
  wyłącza się sam, jeśli nie ma `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`
  (`:27-33`)**. Na tym strażniku zmierzono **416 fałszywych twierdzeń** o uprawnieniach
  jednego modułu. **Każda Twoja komenda testowa dotykająca tras Wyników ma tę
  zmienną w tej samej linii** (`Z33`, `§0.2c`). Bez niej Twój zielony wynik nic
  nie znaczy.
- ★★ **NIE RUSZASZ `F.2`** — izolacji międzynajemczej tras mutujących
  `/api/vnext/results/**` (`RES-PF-011`: realny defekt cross-tenant znaleziony
  i zamknięty, `4 z 135` mutatorów udowodnione). Ani testu, ani kodu, ani wiersza
  w rejestrze.
- ★★ **NAZWA BAZY NIE JEST DOWOLNA.** Zarówno seed (`seed-wave3-results-owner-review.ts:23`),
  jak i starter runtime (`scripts/dev/start-wave3-owner-runtime.mjs:32`) wymagają
  wzorca `^consultify_w3_results_owner_[a-z0-9_]+$`. Dlatego Twoja baza nazywa się
  **`consultify_w3_results_owner_cx199`**, a nie `cx199` — i to jest zgodne z `Z7`, bo niesie numer dyżuru.
  Kontener i tak nazywa się `cx-day199-pg`.
- ★★ **Runtime `adopt-existing` ma trzy bramki, o które ludzie się rozbijają**
  (`start-wave3-owner-runtime.mjs`): `WAVE3_RUNTIME_CONFIRM=YES`,
  `WAVE3_RUNTIME_EXPECTED_SHA` **równy bieżącemu `HEAD`**, i
  `WAVE3_RUNTIME_DIRTY_FINGERPRINT` **równy bieżącemu odciskowi**. Po KAŻDYM
  commicie odcisk się zmienia — pobierasz go na nowo komendą
  `node scripts/dev/start-wave3-owner-runtime.mjs fingerprint`. Manifest fixture'u
  (`0600`, `ownershipState:'FINAL'`) **produkuje sam seed** — nie piszesz go ręcznie.
- ★★ **`Z31` — ZAKAZ PINOWANIA STRAŻNIKA REALDB DO HOSTA, PORTU ALBO NAZWY BAZY.**
  `await assertRealPostgresTestEnvironment()` **BEZ ARGUMENTÓW**, bez
  `expectedDatabase`, bez asercji na `DATABASE_URL`. Dyżur 43 przypiął strażnika
  do swojej bazy i po usunięciu kontenera **30 przypadków dowodowych stało się
  trwałym `SKIP`** przy `exit 0`; w programie odnotowano **sześć** takich
  incydentów. Nie dokładaj siódmego.
- ★ **`Z10` — nie zmieniasz wartości domyślnych flag** `resultsVNextRoi`,
  `resultsVNextOkr`, `resultsVNextKpi`. Do zrzutów i do runtime'u podajesz je
  parametrem adresu (`?ff_resultsVNextRoi=1`, `?ff_resultsVNextOkr=1`), nie
  zmianą w kodzie. Zmiana domyślnej na `ON` = odrzucenie pozycji (`Z11`).
- ★ **Sprzątanie kontenera: `docker rm -f -v`** — z flagą `-v`, inaczej wolumen
  zostaje na dysku i po kilku dyżurach kończy się miejsce.
- ★ **`Z13`: zrzuty, logi i pliki wynikowe NIE wchodzą do repo.** Leżą w
  `/private/tmp/cx-day199-karty-wynikow-artefakty`, a raport podaje ścieżki i `shasum -a 256`. Po zrzutach
  sprawdzasz `git status --porcelain` i pokazujesz wynik w raporcie.
- ★ **Hook `pre-commit` odpali się na Twoim `.tsx`**: `check-list-canon.sh`,
  `check-triada.sh`, `check-gestosc.sh`, `check-focus-canon.sh --ci` oraz
  `verify:canonical-16` (ten ostatni **zawsze**, przy każdym commicie).
  **Naprawiasz kodem, nie omijasz** — `--no-verify` jest zakazem, nie STOP-em.
- ★ **Pułapka nr 1 `CLAUDE.md`: `primary-*` w Tailwind = crimson `#85182F`.**
  Czerwień tylko dla semantyki krytycznej; fokus przez `c-focus`. Twoje dwie nowe
  sekcje mają wyglądać jak sąsiednie sekcje tej samej karty, nie jak nowy pomysł.
- **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji** (`Z28`).
- Pułapka: bez `RUN_DB_TESTS=1` testy backendowe idą na MOCK DB. Pułapka:
  `No test files found` **nie jest** `PASS` — sprawdź `numTotalTests > 0`.
  Pułapka: `npx vitest run` bywa kończy się `exit 0` mimo czerwonych testów —
  liczby i **nazwy** czytasz z JSON-a (`Z37`, `§0.4a`).
- ★ Port **5000 zajęty na stałe przez macOS Control Center**; port **5037** zajęty
  przez `adb` — nie używaj żadnego z nich.
- **Sekcja „TWIERDZENIA NIEZWERYFIKOWANE" w raporcie jest obowiązkowa.** Wypisz
  w niej wprost co najmniej: czy kontrakt R1 obejmuje WSZYSTKIE sekcje wszystkich
  trzech kart, czy próbkę (i jaką); czy sprawdziłeś każdą trasę w DWÓCH miejscach
  (definicja + montaż), czy tylko w jednym; czy liczba `30` sekcji zgodziła się
  z Twoim pomiarem; czy poza seedem Wyników istnieją inne seedy
  (`server/scripts/seed-results-full-demo.ts`, `seed-results-module.ts`), które
  wypełniają brakujące tabele — i czy je sprawdziłeś, czy założyłeś; czy zrzuty
  R3b oglądałeś oczami, czy tylko sprawdziłeś, że pliki powstały. Brak takiej
  sekcji jest podstawą odrzucenia dyżuru.
