# INSTRUKCJA DYŻURU nr 233 — Codex — „★★ FINANSE — KOMPLET EKRANÓW DO ZRZUTÓW WŁAŚCICIELA, który nigdy ich nie widział (`CLAUDE.md` reguła 7). Zero nowego mechanizmu: tylko dev-render harness montujący REALNE komponenty (pięć rejestrów + panele wyceny), korekta tablicy zamknięć modułów (nie 19, lecz **5 z 21** paneli ma backend, a flaga blokująca front to `VITE_FINANCE_VALUE_PANELS`, nie `ENABLE_V8_GLOBAL`) i uczciwy opis kosztu obu wariantów „Management report w MVP czy poza” — bez rozstrzygania pytania właściciela"

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
> **wyłącznie** `/private/tmp/cx-day233-finanse`.

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
Zakres: ****10 FINANSE (`/finance`) — moduł, którego właściciel nigdy nie widział na oczy.** Zmierzone na markerze `142686b772`: routing płaski — sześć tras w `src/routes/AppRoutes.tsx:2308-2422` (`/economics`→redirect, `/finance`, `/finance/statements/:id`, `/finance/models/:id`, `/finance/analyses/:id`, `/finance/predictions/:id`, `/finance/valuations/:id`), wszystkie renderują `EconomicsView.tsx:21-23` → `FinanceHub.tsx` (4203 linii). Pięć zakładek listy (`FinanceHub.tsx:1558-1585`: Statements/Analysis/Models/Prediction/Enterprise valuation) i pięć warsztatów szczegółu Finance v3 (`FinanceHub.tsx:313-357`), z czego **cztery domyślnie OFF** (`useFinanceStatementPackWorkspaceV2Flag.ts:20,33`; `useFinanceBaselineWorkspaceFlag.ts:24,32`; `useFinancePredictionWorkspaceFlag.ts:20,29`; `useFinanceAnalysisWorkspaceFlag.ts:22,31` — wszystkie `false`) i **jeden domyślnie ON** (`useFinanceValuationWorkspaceFlag.ts:25,36` — `true` po `AMD-FIN-VALUATION-V3-001`, 2026-08-18). Master-override wszystkich naraz: `src/utils/financeOwnerReviewMode.ts` (`?ff_wave3FinanceOwnerReview`), fail-closed na publicznym hoście produkcyjnym. Osobna powierzchnia „Panele wyceny”: `FinanceValuePanelsSurface.tsx` (21 zakładek, `PANELS` obiekt `:5-72`), montowana wyłącznie na liście `valuation` (`FinanceHub.tsx:4065`) pod flagą frontową `VITE_FINANCE_VALUE_PANELS` (`src/utils/financeValuePanelsFlag.ts`, cały plik 39 linii, domyślnie `false`, fail-closed). **Trzy twierdzenia tablicy zamknięć (`docs/program/funkcje/REKONESANS_ZAMKNIECIA_16_MODULOW.md:84`) zweryfikowane w tym dyżurze — patrz `§1`.****.
Trasy front: ``src/components/Economics/FinanceHub.tsx` (4203 linie, pięć zakładek listy `:1558-1585`, pięć warsztatów `:313-357`) · `src/components/Economics/FinanceValuePanelsSurface.tsx` (21 paneli, montaż `FinanceHub.tsx:4065`) · pięć hooków flag `src/hooks/useFinance*WorkspaceFlag.ts` · `src/utils/financeValuePanelsFlag.ts` · `src/utils/financeOwnerReviewMode.ts` · `src/components/Finance/Valuation/steps/ExportStep.tsx` (uczciwy placeholder braku eksportu wyceny, `:21-26`). ★★ Ósmy kształt fałszywego gotowe: komponent zaimportowany ≠ realnie renderowany z danymi — **każdy zrzut musi pochodzić z realnego montażu przez `dev-render` harness z fixture danych**, nigdy z atrapy propsów. Kanon list: `docs/ui-standards/TRIADA_KANON.md` (`StandardModuleBar`/`StandardTable`/`StandardPreview`) — pięć rejestrów Finansów już używa tej triady, **nie przebudowujesz jej**, tylko montujesz do zrzutu`. Trasy tył: ``server/src/Gateway.ts:1476-1482` — kolejność montażu: wąski bypass `financeStatementMountedSurface.ts` PRZED `v8FeatureGate`, potem `v8Router` (zawiera WSZYSTKIE trasy `/api/v8/finance*`) ZA `v8FeatureGate`. Bramka: `server/src/middleware/v8FeatureGate.middleware.ts:14-21` — `ENABLE_V8_GLOBAL !== 'true'` → `404 V8_DISABLED` przed auth. Rodziny tras: `server/src/routes/v8/finance-v2/*` (14 pod-routerów, w tym `valuation.routes.ts` z polem `currency` `:685`) · `finance-valuation.routes.ts` (19 endpointów, `:136-560` — Monte Carlo/Real Options/Efficient Frontier/Sensitivity/Scenarios, JEDYNA rodzina realnie podpięta pod panele) · `finance-intelligence.routes.ts` (13) · `finance-planning.routes.ts` (17) · `finance-value.routes.ts` (25) · `financeValueRoutes.ts` (6) — te cztery ostatnie rodziny NIE mają konsumenta w 16 pozostałych panelach, zmierzone `§1`. Waluta: `server/src/services/finance/canonical/valuationAdvisorService.ts:283-290` (`loadValuationCurrency`, czyta WYŁĄCZNIE `organization_profiles.currency`, honest null bez defaultu)`.

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
WT=/private/tmp/cx-day233-finanse
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
git -C "$VAULT" worktree add "$WT" -b codex/day233-finanse-20260901 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day233-finanse/config.worktree"
cat "$VAULT/worktrees/cx-day233-finanse/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day233-finanse-scratch
mkdir -p /private/tmp/cx-day233-finanse-artefakty

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
git -C "$WT" push github-backup codex/day233-finanse-20260901
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

# (1) TEZA: tablica zamkniec klamie o liczbie paneli — realnie 21 kompontentow, nie 19
grep -n "^  [a-zA-Z]*: lazy" src/components/Economics/FinanceValuePanelsSurface.tsx | wc -l
ls src/components/Economics/panels/*.tsx | wc -l
#   oczekiwane: 21 i 21 — dwadziescia jeden paneli ISTNIEJE jako komponent, nie dziewietnascie

# (2) TEZA: tylko 5 rodzin backendu jest realnie podpietych pod te 21 komponentow
grep -c "^router\.\(get\|post\)(" server/src/routes/v8/finance-valuation.routes.ts
grep -rln "finance-valuation\b" src/components/Economics/panels/*.tsx
#   oczekiwane: 19 endpointow w JEDNEJ rodzinie tras, ktora obsluguje wylacznie 5 paneli
#   (Monte Carlo, Real Options, Efficient Frontier, Sensitivity, Scenarios)

# (3) TEZA: flaga frontowa paneli i flaga backendowa V8 to DWIE ROZNE zmienne
sed -n '1,20p' src/utils/financeValuePanelsFlag.ts
grep -n "ENABLE_V8_GLOBAL" server/src/config/FeatureFlags.ts server/src/middleware/v8FeatureGate.middleware.ts
#   oczekiwane: VITE_FINANCE_VALUE_PANELS (front, default false) vs ENABLE_V8_GLOBAL (backend,
#   Zod default false), dwie niezalezne bramki

# (4) TEZA: Management report wyceny nie istnieje w kodzie — uczciwy placeholder
sed -n '1,32p' src/components/Finance/Valuation/steps/ExportStep.tsx
grep -rniE "management.report" src/components/Finance server/src/routes/v8/finance-v2 server/src/routes/v8/finance-valuation.routes.ts
#   oczekiwane: plik ExportStep.tsx opisuje HONEST GAP wprost w komentarzu; zero trafien
#   w kodzie Wyceny dla frazy management report

# (5) TEZA: cztery z pieciu warsztatow Finance v3 sa dzis domyslnie OFF, jeden ON
grep -n "enabled:\|default" src/hooks/useFinanceStatementPackWorkspaceV2Flag.ts src/hooks/useFinanceBaselineWorkspaceFlag.ts src/hooks/useFinancePredictionWorkspaceFlag.ts src/hooks/useFinanceAnalysisWorkspaceFlag.ts src/hooks/useFinanceValuationWorkspaceFlag.ts
#   oczekiwane: cztery pierwsze false, ostatni (walidacja) true

# (6) TEZA: dyzur 171 naprawil walute i trzy inne pola kontraktu, z dowodem mutacyjnym
sed -n '280,292p' server/src/services/finance/canonical/valuationAdvisorService.ts
sed -n '125,145p' server/src/routes/__tests__/day171.data-contracts.pg.test.ts
#   oczekiwane: loadValuationCurrency czyta WYLACZNIE organization_profiles.currency,
#   test 3/3 PASS w tym asercja null->PLN po wstawieniu profilu

# (7) TEZA: brama ENABLE_V8_GLOBAL ma juz trwaly test mutacyjny w repo
sed -n '165,182p' server/src/routes/v8/__tests__/day200.monte-carlo-npv.pg.test.ts
#   oczekiwane: test usuwajacy process.env.ENABLE_V8_GLOBAL i asertujacy 404 V8_DISABLED

# (8) TEZA: piec rejestrow Finansow renderuje ten sam plaski routing bez osobnych komponentow
grep -n "ROUTES.FINANCE\|/finance/" src/routes/AppRoutes.tsx | sed -n '1,10p'
#   oczekiwane: szesc tras, wszystkie EconomicsView

# (9) TEZA: miejsce na dysku wystarcza na dyzur (~1,7 GB)
df -h /
#   oczekiwane: powyzej 5 GB wolnego — ponizej tego STOP calego dyzuru (patrz Z incydentow)
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day233-finanse-20260901` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6181`. Twój JEDYNY port harnessu to `5150 i 5151`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day233-pg`**. **ZAKAZANE:** `5000 (macOS Control Center, zajety na stale), 5037 (adb), 5060-5061, 6012, 5433, 6047, 6054-6176, 5010-5141, 6404-6411, 6600-6820 (odbiory i FIX-y) — oraz porty siostrzanych dyzurow tej samej fali Z2, ktore sa cudze: baza 6182 i harness 5152-5153 (dyzur 234 Wyniki), baza 6183 i harness 5154-5155 (dyzur 235 Materialy). Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `ŻADNEJ nowej flagi i ŻADNEJ zmiany wartości domyślnej istniejącej flagi. Ten dyżur jest pomiarowo-dowodowy: harness `dev-render` wymusza istniejące flagi (`VITE_FINANCE_VALUE_PANELS`, `ff_wave3FinanceOwnerReview`) WYŁĄCZNIE przez query-param przy renderze zrzutu, nigdy przez zmianę kodu domyślnej wartości. `Z10` obowiązuje bez wyjątku`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/services/aiRoleGuard.ts` · `server/src/services/chatPermissionService.ts` · `server/src/services/aiPolicyEngine.ts` · `server/src/services/aiRunLedgerService.ts` · `server/src/services/ai/chatPolicyGateway.ts` · `server/src/services/ai/webSearchGovernance.ts` · `server/src/services/ai/sideEffectTools.ts` · `server/src/services/ai/knowledgeDocAccessFilter.ts` · `server/src/routes/presentationExportGate.ts` · `server/src/middleware/auth.middleware.ts` · `server/src/middleware/v8FeatureGate.middleware.ts` · `server/src/middleware/resultsInternalBetaVisibility.middleware.ts` · `server/src/database/Database.ts` · `vitest.config.ts` · `tests/setup.ts``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY233_FINANSE_REPORT.md`. Jedyny inny dokument, który wolno Ci dotknąć, to `docs/program/waves/WAVE_03_ACCEPTANCE/modules/10_FINANCE/MODULE_ACCEPTANCE.md` (§R.1) — WYŁĄCZNIE dopisanie nowej sekcji na końcu pliku ze zmierzonym stanem (ekrany/flagi/panele), każde zdanie z dowodem `plik:linia`. Zakaz kasowania, nadpisywania lub przepisywania istniejących wierszy tabel. Zakaz wpisywania `FIXED`/`VERIFIED` — ten dyżur nie naprawia mechanizmu, tylko mierzy i dokumentuje (`Z32` nie ma tu zastosowania, bo nie padają takie słowa). **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day233-finanse-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day233-finanse-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **ZAKAZ DOBUDOWY BACKENDU DLA 16 NIEPODPIĘTYCH PANELI.** Cel dyżuru to zrzuty, nie naprawa. Jeżeli podczas montażu w harnessie okaże się, że panel bez backendu (`BankingValuePanel`, `CashForecastPanel`, `DriverPlannerPanel`, `DriverTreePanel`, `ExtendedRatiosPanel`, `HeadcountPlannerPanel`, `InvestmentAppraisalPanel`, `RollingForecastPanel`, `ValuationVisualsPanel`, `ValueAttributionPanel`, `ValueCapturePipelinePanel`, `ValueLedgerPanel`, `ValueOfficePanel`, `VarianceBridgePanel`, `VarianceNarrationPanel`, `EvBasketFootballField`) rzuca błędem zamiast pokazać uczciwy stan pusty — **naprawiasz WYŁĄCZNIE tyle, żeby panel pokazał uczciwy komunikat braku backendu, nie więcej**. Budowa 16 tras backendu to osobny, przyszły dyżur, którego rozmiar dopiero ten pomiar ujawnia. **ZAKAZ ROZSTRZYGANIA pytania właściciela „Management report w MVP czy poza”** — opisujesz koszt obu wariantów w raporcie, decyzję zostawiasz otwartą | Tablica zamknięć modułów (`REKONESANS_ZAMKNIECIA_16_MODULOW.md:84`) mówi „podpięcie 19 paneli (135, za `ENABLE_V8_GLOBAL=false`)” — **to zdanie jest błędne w dwóch miejscach jednocześnie i błąd ten sam dokument już raz obalił** (`docs/program/funkcje/ODBIOR_135_PANELE_FINANSOWE.md:25-43`, commit `9694189232`, poprzedzający commit tabeli `1abf43dbd4` o osiem godzin): naprawdę podpiętych jest **5 z 21**, a flagą frontową jest `VITE_FINANCE_VALUE_PANELS`, nie `ENABLE_V8_GLOBAL` (backendowy globalny wyłącznik CAŁEGO `/api/v8`, nie tylko Finansów). Ten dyżur istnieje, żeby (a) dać właścicielowi pierwszy realny widok modułu, którego nigdy nie widział, i (b) uczciwie skorygować liczbę w dokumencie kanonicznym, zanim ktoś zaplanuje na jej podstawie kolejny dyżur |

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
cd /private/tmp/cx-day233-finanse

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day233-pg psql -U postgres -d cx233 \
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
cd /private/tmp/cx-day233-finanse

docker run -d --name cx-day233-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx233 \
  -p 127.0.0.1:6181:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day233-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6181/cx233 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6181/cx233 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day233-finanse && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6181/cx233 \
JWT_SECRET=cx233-test-secret-do-not-reuse \
npx vitest run src/components/Economics/__tests__ server/src/routes/v8/__tests__ server/src/routes/v8/finance-v2/__tests__ dev-render/screens --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day233-finanse-artefakty/day233-pakiet.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day233-finanse && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run src/components/Economics/__tests__ server/src/routes/v8/__tests__ server/src/routes/v8/finance-v2/__tests__ dev-render/screens --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day233-finanse-artefakty/day233-pakiet.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day233-finanse/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day233-pg psql -U postgres -d cx233 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day233-pg`.
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
> **(e) ★★ **DWIE RÓŻNE FLAGI, DWIE RÓŻNE WARSTWY — NIE POMYL ICH.** `VITE_FINANCE_VALUE_PANELS` (`src/utils/financeValuePanelsFlag.ts:7`, front, per-przeglądarka, domyślnie `false`) decyduje, czy `FinanceValuePanelsSurface` w ogóle się montuje. `ENABLE_V8_GLOBAL` (`server/src/config/FeatureFlags.ts:31`, backend, globalny, domyślnie `false` poza lokalnym `.env.example`) decyduje, czy CAŁY `/api/v8/*` odpowiada, czy `404 V8_DISABLED` — **dotyczy też modułów niezwiązanych z Finansami** (Assessment, Execution, Agent, Partner). Włączenie jednej bez drugiej daje różne, mylące stany: front renderuje panel, backend odpowiada 404 (albo odwrotnie — backend gotowy, front pusty). **W harnessie musisz jawnie ustawić OBIE, osobno, i opisać co widać przy każdej kombinacji z osobna.** Druga pułapka: `InvestmentAppraisalPanel` (jeden z 21) renderuje się DZIŚ wyłącznie w swoim własnym teście — zero renderu produktowego (`ODBIOR_135...md:25-30`) — licz go jako panel bez renderu produktowego, nie jako szósty podpięty**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day233-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day233-finanse-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (harness pięciu rejestrów Finansów, zrzuty) · R2 (harness 21 paneli wyceny, 5 z wynikiem + 16 z uczciwym stanem pustym, zrzuty) · R3 (korekta MODULE_ACCEPTANCE.md — liczby i flagi)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6181` albo `5150 i 5151` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6181` albo `5150 i 5151`** (`Z7`).

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

Moduł **10 Finanse** to jeden z trzech modułów fali Z2 — właściciel **nigdy nie widział go
na oczy** w obecnym kształcie (`CLAUDE.md` reguła 7). Cel tego dyżuru **nie jest „napraw
wszystko"** — jest nim doprowadzenie modułu do stanu, w którym da się pokazać **komplet
ekranów na czystych zrzutach**, i dopiero wtedy właściciel patrzy.

## ★★ POMIAR OBALA DWIE Z TRZECH TEZ TABLICY ZAMKNIĘĆ — wykonany na SHA `142686b772`

Tablica zamknięć modułów (`docs/program/funkcje/REKONESANS_ZAMKNIECIA_16_MODULOW.md:84`)
mówi o Finansach: „waluta (171 wydany); podpięcie 19 paneli (135, za
`ENABLE_V8_GLOBAL=false`); „Management report" wyceny NIE istnieje w kodzie". Sprawdź
każde z tych trzech zdań u siebie (komendy w `§0`) — poniżej wynik tego sprawdzenia.

### 1. Waluta (dyżur 171) — PRAWDA, ale węższa niż nazwa sugeruje

Dyżur 171 to naprawa **czterech pól kontraktu danych** (waluta, nazwa KPI, nazwy osób,
jednostka wskaźnika Analizy), nie osobny dyżur „waluta". Realnie zmienione:
`server/src/services/finance/canonical/valuationAdvisorService.ts:283-290`
(`loadValuationCurrency`) czyta **wyłącznie** `organization_profiles.currency` (nullable,
bez fałszywego defaultu) i **świadomie nie czyta** `organizations.billing_currency`
(kolumna billingowa SaaS, `DEFAULT 'USD'`) — to była naprawa pomyłki „waluta operacyjna
= waluta rozliczeniowa". Trasa: `server/src/routes/v8/finance-v2/valuation.routes.ts:685`
(`GET /valuation/variants/:id/results`, pole `currency` w odpowiedzi). Test na realnym
Postgresie: `server/src/routes/__tests__/day171.data-contracts.pg.test.ts:132,142` —
`loadValuationCurrency` zwraca `null` bez profilu, `'PLN'` po wstawieniu profilu, dowód
mutacyjny (wymuszenie `null` czerwieni oczekiwanie `'PLN'`, cofnięcie daje `3/3 PASS`,
opisany w `CODEX_DAY171_KONTRAKTY_DANYCH_REPORT.md:141`). Przy okazji naprawiono realny
bug: `src/components/Finance/Valuation/ValuationWorkspace.tsx:281-289` — zakładki
`'methods'`/`'sensitivity'` wcześniej nigdy nie ładowały `results`, więc pole `currency`
by tam i tak nie dotarło.

**Zastrzeżenie z własnego raportu wykonawcy 171** (`CODEX_DAY171...REPORT.md:157`,
`R3 = PARTIAL`): dowód jest przez HTTP+SQL+mutację, **bez** dowodu wizualnego w
przeglądarce trzech ekranów Finansów. **To jest dokładnie luka, którą ten dyżur zamyka
w `R1`.**

### 2. ★★★ „podpięcie 19 paneli" — CZĘŚCIOWO FAŁSZYWE, i ten sam program to już raz ustalił

To jest najważniejsze ustalenie tego dyżuru. Zdanie z tablicy zamknięć ma **dwa błędy
jednocześnie**, i to nie jest nowe odkrycie — dokument `docs/program/funkcje/ODBIOR_135_PANELE_FINANSOWE.md:25-43`
(commit `9694189232`, **osiem godzin przed** commitem samej tablicy `1abf43dbd4`, którego
jest przodkiem) już to obalił: *„Mój piąty błąd autorski — dziewiętnaście tras nie znaczy
dziewiętnaście paneli... Realny stan: 5 paneli gotowych do podpięcia teraz, 16 wymaga
osobnego pomiaru"*. Mimo to tablica zamknięć cytuje dokładnie tę już obaloną liczbę.

**Błąd 2a — liczba paneli:** `FinanceValuePanelsSurface.tsx:5-72` ma **21** kluczy
(lazy-importy), katalog `src/components/Economics/panels/` ma **21** plików `.tsx`.
Komponenty **istnieją w 100%** i **są realnie zamontowane w DOM** — test
`src/components/Economics/__tests__/day200.FinanceValuePanelsSurface.test.tsx:19-27`
liczy `screen.getAllByRole('tab')` = **21** przy fladze ON. Ale **tylko 5 z 21** ma realne
backendowe okablowanie: `MonteCarloNpvPanel`, `RealOptionsPanel`,
`EfficientFrontierPanel`, `WhatIfSensitivityPanel`, `ScenarioComputePanel` — wszystkie
przez jedną rodzinę tras `finance-valuation.routes.ts` (19 endpointów, `:136-560`,
dowód e2e `19/19 → 200 + hasData=true` przez realny `ApiGateway`+JWT+Postgres,
`CODEX_DAY135...REPORT.md:103-109`). Pozostałe **16 paneli** (`BankingValue`,
`CashForecast`, `DriverPlanner`, `DriverTree`, `ExtendedRatios`, `HeadcountPlanner`,
`InvestmentAppraisal`, `RollingForecast`, `ValuationVisuals`, `ValueAttribution`,
`ValueCapturePipeline`, `ValueLedger`, `ValueOffice`, `VarianceBridge`,
`VarianceNarration`, `EvBasketFootballField`) należą do **czterech innych** rodzin tras
(`finance-intelligence.routes.ts` 13 endpointów, `finance-planning.routes.ts` 17,
`finance-value.routes.ts` 25, `financeValueRoutes.ts` 6), które **nie zostały zmierzone
ani podpięte** w dyżurze 135 — brak w kolumnie „W2 backend" dla każdego z nich
(`CODEX_DAY135...REPORT.md:42-70`). `InvestmentAppraisalPanel` renderuje się dziś
**wyłącznie w swoim własnym teście**, zero renderu produktowego (`ODBIOR_135...md:25-30`).

**Błąd 2b — flaga:** tablica podaje `ENABLE_V8_GLOBAL` jako flagę blokującą panele.
To jest **backendowy, globalny wyłącznik CAŁEGO `/api/v8/*`**
(`server/src/config/FeatureFlags.ts:31`, Zod `default(false)`; bramka
`server/src/middleware/v8FeatureGate.middleware.ts:14-21` — `!globalEnabled` →
`404 V8_DISABLED` przed auth), montowany w `server/src/Gateway.ts:1481-1482` **przed**
`v8Router`, z wąskim bypassem wyłącznie dla Sprawozdań
(`financeStatementMountedSurface.ts:12-49`). To NIE jest flaga, która „podpina" panele
na froncie — realna flaga frontowa to **`VITE_FINANCE_VALUE_PANELS`**
(`src/utils/financeValuePanelsFlag.ts`, cały plik 39 linii: query `ff_financeValuePanels`
→ localStorage → env → **default `false`**, fail-closed). `ENABLE_V8_GLOBAL=false`
faktycznie blokuje backend WSZYSTKICH 21 paneli (bo cała rodzina `finance-valuation.routes.ts`
leży pod `v8Router`) — ale to jest osobna, backendowa warstwa, dotycząca też modułów
niezwiązanych z Finansami. **Domyślne wartości**: `.env.example:211` ustawia
`ENABLE_V8_GLOBAL=true` tylko dla lokalnego dewelopmentu; `.env.staging.example` i
`.env.production.example` nie ustawiają jej w ogóle → obowiązuje Zod-default `false`.

**Test mutacyjny dla `ENABLE_V8_GLOBAL` już istnieje w repo jako stały test** (nie tylko
jednorazowy dowód w raporcie): `server/src/routes/v8/__tests__/day200.monte-carlo-npv.pg.test.ts:170-180`
— usuwa `process.env.ENABLE_V8_GLOBAL`, asertuje `404`/`V8_DISABLED`. Analogicznie
`server/src/routes/v8/finance-v2/__tests__/day23.default-mount-reachability.pg.test.ts:32-56`
dowodzi tego dla wszystkich pięciu kanonicznych ekranów Finansów jednocześnie, i
odróżnia to od wąskiego bypassu Sprawozdań (`401`, nie `V8_DISABLED`).

### 3. „Management report" wyceny NIE ISTNIEJE — PRAWDA bez zastrzeżeń

Pełny grep (case-insensitive) za `management report`/`management_report` w `src/` i
`server/src/` nie zwraca żadnego trafienia powiązanego z Wyceną Finansów. Jedyne
trafienia to zupełnie inny moduł (`src/types/core.ts:5726-6224`, typ `ManagementReport`
w PMO/Wyniki — niepowiązany). Krok Eksportu Wyceny jest **świadomym, uczciwym
placeholderem**: `src/components/Finance/Valuation/steps/ExportStep.tsx:3-8,21-26` —
komentarz wprost: *„HONEST GAP: `valuation.routes.ts` (21 endpointów) has NO export
endpoint... `REPORT_EXPORT` exists in the shared `FinanceArtifactType` enum, but nothing
in the Valuation surface produces one"*, tekst na ekranie: *„Eksport wyceny nie jest dziś
dostępny"*. Niezależny, historyczny dowód wizualny z dyżuru 74
(`CODEX_DAY74_FINANCE_PROOF_REPORT.md:91-98`): licznik przycisków „Management report" na
żywym UI = **0/5**, ta sama linia `ExportStep.tsx:21` co dziś, plik niezmieniony od
tamtej pory.

**To zdanie nie wymaga korekty. Zostawiasz je w tablicy zamknięć bez zmian.**

## Czego ten dyżur świadomie NIE robi

- **Nie dobudowuje backendu dla 16 niepodpiętych paneli.** To osobny, przyszły dyżur,
  którego rozmiar ten pomiar dopiero ujawnia (patrz `ZAKAZ_WLASCIWY_TEMU_DYZUROWI`).
- **Nie rozstrzyga pytania właściciela** „Management report w MVP czy poza" — opisujesz
  koszt obu wariantów w raporcie (`R4`), decyzja zostaje otwarta.
- **Nie zmienia żadnej wartości domyślnej flagi.**
- **Nie buduje eksportu Wyceny.**

---

# 2. TEZY ZLECENIA

| # | Teza | Jak sprawdzasz |
|---|---|---|
| T1 | 21 komponentów-paneli istnieje, nie 19 | komenda (1) |
| T2 | Tylko 5 z 21 ma realny backend, przez jedną rodzinę tras | komenda (2) |
| T3 | Flaga frontowa (`VITE_FINANCE_VALUE_PANELS`) i backendowa (`ENABLE_V8_GLOBAL`) to dwie różne rzeczy | komenda (3) |
| T4 | Management report wyceny nie istnieje — uczciwy placeholder | komenda (4) |
| T5 | Cztery z pięciu warsztatów Finance v3 są dziś OFF, jeden ON | komenda (5) |
| T6 | Dyżur 171 naprawił walutę z dowodem mutacyjnym, ale bez dowodu wizualnego | komenda (6) |
| T7 | Brama `ENABLE_V8_GLOBAL` ma trwały test mutacyjny | komenda (7) |
| T8 | Routing modułu jest płaski — sześć tras, jeden komponent | komenda (8) |

---

# 3. POZYCJE DYŻURU

## R1 — HARNESS PIĘCIU REJESTRÓW FINANSÓW (rdzeń, dowodowy)

**Cel:** pierwszy realny, przeglądalny widok modułu, jaki właściciel kiedykolwiek zobaczy.

Montujesz `dev-render/screens/day233-finanse-rejestry.tsx` (+ wpis w `dev-render/main.tsx`),
renderujący **realny** `FinanceHub` z fixture danych analogiczną do
`server/scripts/seed-wave3-finance-owner-review.ts` (możesz użyć samego fixture'u JSON,
nie musisz stawiać bazy dla samego zrzutu listy — ale jeśli chcesz pokazać warsztat
`valuation` z realnymi liczbami, patrz `R1c`). Pięć zakładek listy: Statements, Analysis,
Models, Prediction, Enterprise valuation.

### R1a — PARA DOWODOWA „obcy nie widzi / właściciel widzi"

| przebieg | oczekiwane |
|---|---|
| bez `ff_wave3FinanceOwnerReview` i bez flag warsztatów | cztery warsztaty (Statement/Baseline/Prediction/Analysis) niedostępne, tylko `valuation` (domyślnie ON) dostępny |
| z `?ff_wave3FinanceOwnerReview=1` | wszystkich pięć warsztatów dostępnych, dane fixture widoczne |
| na publicznym hoście produkcyjnym (symulacja `isPublicProductionHost`) | override **nie działa** — fail-closed, zmierz to w `financeOwnerReviewMode.ts` |

### R1b — zrzuty

Pięć rejestrów × dwa motywy = **10 obrazów**, plus jeden dodatkowy dla pustego stanu
(honest empty, nie atrapa). `mean_luma` każdej pary jasny/ciemny, różnica **> 150**
(komenda w `§5`, wzorem innych dyżurów tej fali).

### R1c — warsztat Wyceny z realnymi liczbami (opcjonalnie, jeśli czas pozwala)

Jeśli stawiasz lokalny Postgres i realny fixture: dyżur 74 zmierzył EV `-6 422 709,196 PLN`
przy WACC `8,93%`, metoda DCF (FCFF) — możesz odtworzyć ten przebieg i pokazać ekran
Wyceny z realnymi liczbami zamiast placeholderowych. Nie jest to wymagane do ukończenia
`R1` — priorytetem jest harness bez bazy, oparty na fixture JSON.

## R2 — HARNESS 21 PANELI WYCENY (rdzeń, dowodowy)

**Cel:** pokazać uczciwy stan — 5 paneli z policzonym wynikiem, 16 z uczciwym stanem
braku backendu, nie atrapą.

Montujesz `dev-render/screens/day233-finanse-panele.tsx`, wymuszasz
`VITE_FINANCE_VALUE_PANELS` przez query-param harnessu (`ff_financeValuePanels=1`,
**nigdy** zmianą kodu domyślnej wartości).

### R2a — pięć paneli z wynikiem

Wzorem `src/components/Economics/__tests__/FinanceValuePanelsHarness.test.tsx:9-19`:
Monte Carlo (histogram), Real Options, Efficient Frontier (heatmapa), What-if Sensitivity
(tornado), Scenarios (fan-chart). ★★ **Zrzut ODBIOR_135 pokazał tylko formularze wejściowe,
nigdy wyniku** (`ODBIOR_135...md:45-58`) — Twój zrzut MUSI pokazać policzony wynik, nie
sam formularz. Jeżeli harness wymaga uruchomienia obliczenia (kliknięcie/submit) przed
zrzutem — zrób to i opisz krok w raporcie.

### R2b — szesnaście paneli bez backendu

Dla każdego: jeśli renderuje pusty/błędny stan zamiast uczciwego komunikatu „brak
backendu" — **naprawiasz WYŁĄCZNIE tyle, żeby pokazał uczciwy stan pusty**, wzorem
`Z16` (nie usuwasz uczciwych stanów pustych, ale też nie chowasz błędu pod pustym
UI, gdy naprawdę jest awaria). Nie dobudowujesz żadnej trasy backendu — to zakazane
(`ZAKAZ_WLASCIWY_TEMU_DYZUROWI`). `InvestmentAppraisalPanel` policz osobno jako „panel
bez renderu produktowego" i zmierz, czy w harnessie w ogóle się montuje.

### R2c — zrzuty

21 zakładek panelu, w praktyce grupowane w jeden zrzut listy zakładek + 5 zrzutów wyniku
+ 1-2 reprezentatywne zrzuty stanu pustego (nie wszystkich 16 osobno, żeby nie zalać
raportu) × dwa motywy. Opisz w raporcie, które 16 pominąłeś i dlaczego to wystarcza.

## R3 — KOREKTA `MODULE_ACCEPTANCE.md` (rdzeń, dokumentacyjny)

Dopisujesz na końcu `docs/program/waves/WAVE_03_ACCEPTANCE/modules/10_FINANCE/MODULE_ACCEPTANCE.md`
nową sekcję (np. `## Dzień 233 — korekta liczby paneli i flagi`) ze zmierzonym stanem
z `§1.2` tego dokumentu: **5 z 21**, nie 19; dwie różne flagi (front `VITE_FINANCE_VALUE_PANELS`,
backend `ENABLE_V8_GLOBAL`); lista 16 rodzin bez backendu z ich plikami tras.
**Nie kasujesz i nie przepisujesz** istniejących wierszy — to jest dopisek, nie edycja.
Link do `ODBIOR_135_PANELE_FINANSOWE.md` jako pierwotne źródło korekty (żeby przyszły
autor instrukcji nie powtórzył błędu tablicy zamknięć).

## R4 — OTWARTE PYTANIE: KOSZT „MANAGEMENT REPORT" (nie-rdzeń, do raportu)

**Nie rozstrzygasz.** W raporcie opisujesz dwa warianty jednym akapitem każdy:

- **W MVP:** trzeba zaprojektować kontrakt eksportu wyceny (`REPORT_EXPORT` już istnieje
  jako typ w `FinanceArtifactType`, ale nic go nie produkuje dla Wyceny), zbudować trasę,
  UI kroku eksportu (dziś honest placeholder), i decyzję o formacie (PDF/DOCX — porównaj
  z istniejącym `documentPdfRenderer` z Materiałów, jeśli da się reużyć).
- **Poza MVP:** placeholder `ExportStep.tsx` zostaje, właściciel wie, że tego przycisku
  nie ma, zero dodatkowej pracy teraz — ryzyko: to jest ekran, który właściciel zobaczy
  na zrzutach `R1`, i zapyta o niego.

## R5 — RAPORT DYŻURU (rdzeń)

Struktura z `§R.2`, sekcja „TWIERDZENIA NIEZWERYFIKOWANE" obowiązkowa nawet jeśli pusta
(wpisz „brak" z uzasadnieniem). Dołącz tabelę mianowników (`§0.4a`) i pełne wyjścia
komend z `§0` tego dokumentu.

---

# 4. TABELA LICENCJI PLIKOWYCH

Ten dyżur jest **pomiarowo-dowodowy**, nie buduje mechanizmu — licencja zapisu jest
świadomie wąska.

| Zakres | Ścieżki |
|---|---|
| Zapis (NOWE) | `dev-render/screens/day233-finanse-rejestry.tsx`, `dev-render/screens/day233-finanse-panele.tsx` + wpisy w `dev-render/main.tsx` |
| Zapis (WĄSKO) | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/10_FINANCE/MODULE_ACCEPTANCE.md` — WYŁĄCZNIE nowa sekcja na końcu pliku (`R3`), zakaz kasowania/przepisywania istniejących wierszy |
| Zapis (WĄSKO, tylko jeśli `R2b` tego wymaga) | poszczególne pliki `src/components/Economics/panels/*.tsx` — WYŁĄCZNIE zmiana renderu stanu pustego z błędu na uczciwy komunikat braku backendu. Zakaz dodawania nowych wywołań API |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY233_FINANSE_REPORT.md` |
| Odczyt (ZAKAZ ZAPISU) | `src/components/Economics/FinanceHub.tsx` · `FinanceValuePanelsSurface.tsx` · wszystkie hooki `useFinance*WorkspaceFlag.ts` · `src/utils/financeValuePanelsFlag.ts` · `src/utils/financeOwnerReviewMode.ts` — montujesz je w harnessie, **nie zmieniasz ich logiki** |
| Odczyt (ZAKAZ ZAPISU) | cała rodzina `server/src/routes/v8/finance*.routes.ts`, `server/src/services/finance/**` — zero zmian backendu w tym dyżurze |
| Odczyt (ZAKAZ ZAPISU) | `server/src/middleware/v8FeatureGate.middleware.ts` · `server/src/config/FeatureFlags.ts` — bramka i flagi nietykalne |
| Odczyt (ZAKAZ ZAPISU) | `vitest.config.ts` · `tests/setup.ts` · `server/src/database/Database.ts` (`Z18`) |
| Odczyt | `docs/program/funkcje/REKONESANS_ZAMKNIECIA_16_MODULOW.md` · `ODBIOR_135_PANELE_FINANSOWE.md` · `CODEX_DAY135_PANELE_FINANSOWE_REPORT.md` · `CODEX_DAY171_KONTRAKTY_DANYCH_REPORT.md` · `CODEX_DAY74_FINANCE_PROOF_REPORT.md` · `docs/ui-standards/TRIADA_KANON.md` |
| Odczyt (ZAKAZ ZAPISU) | `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` (`Z14`) |

**Nietykalne imiennie:** `v8FeatureGate.middleware.ts` · `FeatureFlags.ts` · cała rodzina
tras `finance-valuation.routes.ts`/`finance-v2/*`/`finance-intelligence.routes.ts`/
`finance-planning.routes.ts`/`finance-value.routes.ts`/`financeValueRoutes.ts` ·
`vitest.config.ts` · `tests/setup.ts` · `Database.ts` · każdy inny `MODULE_ACCEPTANCE.md`
poza Finansów.

---

# 5. TWARDE ZASADY

- ★★ **CEL JEST ZRZUT, NIE NAPRAWA.** Jeżeli podczas montażu w harnessie znajdziesz błąd
  produkcyjny głębszy niż „stan pusty renderuje się źle" (np. panel produkcyjny rzuca
  wyjątkiem i wywala całą stronę) — **nie naprawiasz go w locie**. Opisujesz w raporcie
  jako osobne ustalenie z `plik:linia`, robisz zrzut najbliższego uczciwego stanu, jaki
  się da (nawet ekranu błędu), i idziesz dalej.
- ★★ **NIE MYL DWÓCH FLAG.** `VITE_FINANCE_VALUE_PANELS` (front) i `ENABLE_V8_GLOBAL`
  (backend, globalny) to różne mechanizmy na różnych warstwach — patrz `§1.2` i
  `PULAPKA_WLASCIWA_TEMU_MODULOWI`. Każdy zrzut w raporcie ma adnotację, które dwie
  flagi (i w jakim stanie) były aktywne podczas jego wykonania.
- ★★ **ZERO KOREKTY BEZ DOWODU.** Sekcja `R3` w `MODULE_ACCEPTANCE.md` — każde zdanie
  ma `plik:linia`. Zakaz przepisywania liczby „5 z 21" bez samodzielnego przeliczenia
  komendami z `§0`.
- ★★ **FLAGA DOMYŚLNIE WYŁĄCZONA POZOSTAJE WYŁĄCZONA** (`CLAUDE.md` §7, §9). Harness
  wymusza stan WYŁĄCZNIE przez query-param przy renderze, nigdy zmianą kodu.
- ★★ **WŁAŚCICIEL NIGDY NIE JEST PIERWSZYM TESTEREM WIZUALNYM.** Zrzuty robisz Ty.
  Para jasny/ciemny musi się REALNIE różnić — `mean_luma` obu obrazów i różnica **> 150**:
  ```bash
  node -e "const s=require('sharp');s(process.argv[1]).stats().then(r=>console.log(process.argv[1], (0.2126*r.channels[0].mean+0.7152*r.channels[1].mean+0.0722*r.channels[2].mean).toFixed(1)))" <plik.png>
  ```
- ★★ **W RAPORCIE PISZESZ WPROST, CZY DANE NA ZRZUCIE POCHODZĄ Z REALNEGO PRZEBIEGU
  (fixture przez `dev-render` montujący prawdziwy komponent) CZY Z RĘCZNYCH PROPSÓW.**
  Zrzut zamockowanej powłoki nie jest dowodem renderu.
- ★★ **ZABEZPIECZENIE BEZ TESTU, KTÓRY CZERWIENIEJE PO JEGO USUNIĘCIU, JEST
  NIEUDOWODNIONE.** Dotyczy to istniejącej bramy `ENABLE_V8_GLOBAL` — jeśli w `R2` z
  jakiegokolwiek powodu dotykasz kodu wokół niej (nie powinieneś), test z `§1.2` (T7)
  musi pozostać czerwony po usunięciu bramy i zielony po jej przywróceniu.
- ★ **PUŁAPKI ŚRODOWISKA — SPRAWDŹ KAŻDĄ U SIEBIE:** `server/src/database/Database.ts`
  ok. `:80-88` cicho podstawia atrapę bazy bez `RUN_DB_TESTS=1`; `Database.ts:686`
  atrapa zwraca `changes:1` dla KAŻDEGO `UPDATE` — testy zapisu warunkowego wyłącznie na
  realnej bazie; `vitest.config.ts:210` przypina `DB_TYPE='sqlite'`; `tests/setup.ts:896`
  podmienia `global.fetch`; komentarze w kodzie bywają nieaktualne (ten dyżur sam jest
  dowodem — komentarz-teza tablicy zamknięć okazał się fałszywy) — **sprawdzaj logikę,
  nie ufaj opisowi**.
- ★ **`Z13`:** logi, zrzuty i pliki wynikowe NIE wchodzą do repo — leżą w
  `/private/tmp/cx-day233-finanse-artefakty`, raport podaje ścieżki i `shasum -a 256`.
- ★ **PUSH WYŁĄCZNIE NA `github-backup`.** `origin` jest PUBLICZNY.
- ★★ **SEKCJA „TWIERDZENIA NIEZWERYFIKOWANE" W RAPORCIE JEST OBOWIĄZKOWA.** Brak tej
  sekcji jest podstawą odrzucenia dyżuru.

---

## ★ KOREKTA NADZORCY (dopisana przed wydaniem, 2026-09-01) — liczba paneli jest SPORNA

Autor instrukcji napisał, że **5 z 21** paneli wyceny ma zaplecze, i powołał się na
plik `server/src/routes/finance-valuation.routes.ts`. **Sprawdziłem: taki plik
nie istnieje w repozytorium.** Powołanie jest błędne, więc liczba nie ma pokrycia.

Mój własny pomiar mówi co innego na innej warstwie: **18 z 21** paneli
(`src/components/Economics/panels/*.tsx`) **woła jakiś adres zaplecza**.
Trzy nie wołają nic: `ValuationVisualsPanel`, `EvBasketFootballField`, `DriverPlannerPanel`.

**To nie jest sprzeczność — to dwie różne warstwy tej samej czwórki:**
*komponent istnieje · jest renderowany · wartość dociera · zaplecze ją obsługuje*.
„Panel woła adres" i „adres odpowiada danymi" to **nie to samo**; front może wołać
trasę, której nie ma, i dostawać cicho pustkę. **W tym programie zdarzyło się to
siedem razy.**

### Rozkaz — to jest PIERWSZE zadanie dyżuru, przed czymkolwiek innym

Zmierz to sam, na uruchomionym zapleczu z realną bazą, i **podaj wynik jako tabelę:
panel · wołany adres · kod odpowiedzi · czy w treści są dane, czy pustka.**
Nie przyjmuj ani „5", ani „18" — obie liczby są cudzymi twierdzeniami.

Dopóki tej tabeli nie ma, **żadna wycena pracy nad panelami nie jest wiążąca**.
