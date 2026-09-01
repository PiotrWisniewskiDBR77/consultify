# INSTRUKCJA DYŻURU nr 264 — Codex — „★★ WYNIKI — REKOMENDACJA MIANOWNIKA F.2 (`146` vs `152`, `135` WYCOFANE, `130` SUPERSEDOWANE) BEZ WYBORU KANONICZNEGO w karcie modułu (`docs/program/waves/WAVE_03_ACCEPTANCE/modules/09_RESULTS/MODULE_ACCEPTANCE.md`, sekcja „Pomiar dyżuru 234" ma już trzy odtwarzalne komendy, ale nie ma rekomendacji), PLUS crosswalk/backfill KPI (`kpiCrosswalkService.ts:36,74`, `kpiShadowReadService.ts:56`) z ZERO wołaczy produktowych bez decyzji podłączyć/usunąć. ★ KONTEKST OBOWIĄZKOWY, NIETYKALNY: na realnym `demo.consultify.ai` OKR i ROI SĄ widoczne — `VITE_DEMO_ACCEPTANCE` (`src/utils/demoAcceptanceProfile.ts:27-31`) działa jako wczesny `return true` omijający logikę flag w SZEŚCIU rodzinach (`resultsVNextFeatureFlags.ts:173` + pięć rodzin pomysłów/artefaktów), potwierdzone przez właściciela w Railway 28.08 (`DEC-2026-08-28-216`); demo NIETKNIĘTE (`DEC-2026-08-28-227`) — ta zmienna zostaje bez zmian w tym dyżurze, bez wyjątku."

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
> **wyłącznie** `/private/tmp/cx-day264-wyniki-mianownik`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `df7f13056f`**
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
Zakres: **Wyniki (`docs/modules/09_wyniki/`) — WYŁĄCZNIE rekomendacja mianownika F.2 (bez wyboru), wariant montażu crosswalk/backfill (bez wyboru), i uzupełnienie karty modułu o kontekst `VITE_DEMO_ACCEPTANCE`. Nie dotyczy pozostałych tez T1-T8 dyżuru 234 (już potwierdzonych), stanu dyżuru 170 (rozdzielony, poza zakresem) ani pięciu rodzin bez dowodu izolacji tenant (poza zakresem).**.
Trasy front: ``src/utils/demoAcceptanceProfile.ts` · `src/components/ResultsVNext/resultsVNextFeatureFlags.ts` · `src/utils/artifactStudioFlags.ts` · `src/utils/ideaFinancialCaseFlag.ts` · `src/utils/ideaDecisionLogFlag.ts` · `src/utils/ideaDetailsInPanelFlag.ts` · `src/utils/ideaBusinessCaseSchemaFlag.ts` — WSZYSTKIE TYLKO ODCZYT, bez wyjątku, demo NIETKNIĘTE`. Trasy tył: ``server/src/routes/resultsVnext/*.routes.ts` · `server/src/Gateway.ts:1233-1287` (introspekcja montażu) · `server/src/services/resultsVnext/kpi/kpiCrosswalkService.ts` · `server/src/services/resultsVnext/kpi/kpiShadowReadService.ts` — wszystkie TYLKO ODCZYT`.

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
WT=/private/tmp/cx-day264-wyniki-mianownik
MARKER=df7f13056f

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day264-wyniki-mianownik-20260901 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day264-wyniki-mianownik/config.worktree"
cat "$VAULT/worktrees/cx-day264-wyniki-mianownik/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day264-wyniki-mianownik-scratch
mkdir -p /private/tmp/cx-day264-wyniki-mianownik-artefakty

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
git -C "$VAULT" log --oneline df7f13056f..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only df7f13056f..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day264-wyniki-mianownik-20260901
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only df7f13056f..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `8` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA: komenda 146 daje dzis 146
direct=$(grep -hEc '^router\.(post|put|patch|delete)\(' server/src/routes/resultsVnext/*.routes.ts | awk '{s+=$1} END{print s}')
defs=$(grep -hEc '^function mount(Lifecycle|Escalation|Transition|SetTransition)Route' server/src/routes/resultsVnext/*.routes.ts | awk '{s+=$1} END{print s}')
calls=$(grep -hE '^mount(Lifecycle|Escalation|Transition|SetTransition)Route\(' server/src/routes/resultsVnext/*.routes.ts | wc -l | tr -d ' ')
echo "direct=$direct defs=$defs calls=$calls result=$((direct-defs+calls))"
#   oczekiwane: result=146

# (2) TEZA: komenda 152 daje dzis 152 (pelny jednowierszowiec w karcie modulu, sekcja 'Pomiar dyzuru 234' — przepisz go stamtad, nie z pamieci, i uruchom)
grep -n "Komenda .152." docs/program/waves/WAVE_03_ACCEPTANCE/modules/09_RESULTS/MODULE_ACCEPTANCE.md
#   oczekiwane: znajdziesz odnosnik do CODEX_DAY234_WYNIKI_REPORT.md z pelna komenda

# (3) TEZA: 135 nie jest odtwarzalne
sed -n '10,18p' tests/integration/results/day46.mutator-tenant-isolation.realpg.test.ts
#   oczekiwane: brak komendy odtwarzajacej 135

# (4) TEZA: crosswalk/backfill ma zero wolaczy poza definicjami i testami
grep -rn "kpiCrosswalkService\|kpiShadowReadService" server/src/ src/ | grep -v '__tests__\|kpiCrosswalkService.ts\|kpiShadowReadService.ts'
#   oczekiwane: pusto

# (5) TEZA: karta 09_RESULTS nie ma dzis wzmianki VITE_DEMO_ACCEPTANCE
grep -n "VITE_DEMO_ACCEPTANCE" docs/program/waves/WAVE_03_ACCEPTANCE/modules/09_RESULTS/MODULE_ACCEPTANCE.md
#   oczekiwane: pusto

# (6) TEZA: demoAcceptanceFlags.test.ts istnieje, jest przodkiem markera, dzis przechodzi
git merge-base --is-ancestor 3c3a51406f "$MARKER" && echo "ANCESTOR OK"
npx vitest run src/utils/__tests__/demoAcceptanceFlags.test.ts --retry=0
#   oczekiwane: ANCESTOR OK; PASS, w tym test 'centrally enables all Results VNext domains'

# (7) TEZA: resultsVNextFeatureFlags.test.ts ma dzis 13 przypadkow, zaden nie wspomina demo
grep -c "  it(" src/components/ResultsVNext/__tests__/resultsVNextFeatureFlags.test.ts
grep -n "VITE_DEMO_ACCEPTANCE\|isDemoAcceptanceProfileEnabled" src/components/ResultsVNext/__tests__/resultsVNextFeatureFlags.test.ts
#   oczekiwane: 13; drugi grep pusty

# (8) TEZA: miejsce na dysku wystarcza
df -h /
#   oczekiwane: powyzej 5 GB wolnego — ponizej tego STOP calego dyzuru
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day264-wyniki-mianownik-20260901` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6268`. Twój JEDYNY port harnessu to `5248 i 5249`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day264-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061. Zajęte przez inne prace (nie ruszasz): 6012, 5433, 6047, 6054-6259, 5010-5239, 6404-6411, 6600-6830. Twoje własne: baza 6268, harness 5248 i 5249. Cudze — siostrzane dyżury TEJ SAMEJ paczki DOMKNIĘĆ MODUŁOWYCH, nie dotykasz: baza 6260 i harness 5240 i 5241 (dyżur 260 Czat) · baza 6262 i harness 5242 i 5243 (dyżur 261 Moja Praca) · baza 6264 i harness 5244 i 5245 (dyżur 262 Spotkania) · baza 6266 i harness 5246 i 5247 (dyżur 263 Partner). Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `★★★ ŻADNEJ nowej flagi i ŻADNEJ zmiany wartości domyślnej istniejącej flagi — bez wyjątku, `Z10`/`Z28` łącznie. W SZCZEGÓLNOŚCI: ZAKAZ dotykania `VITE_DEMO_ACCEPTANCE`, `isDemoAcceptanceProfileEnabled` i żadnej z sześciu rodzin flag, które ją czytają — w kodzie, w `.env*`, w Railway. `DEC-2026-08-28-227` (demo NIETKNIĘTE) jest decyzją właściciela, nie sugestią do zweryfikowania.`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``src/utils/pilotAccess.ts` · `src/utils/roleGuards.ts` · `src/components/RouterSync.tsx` · `src/components/navigation/Sidebar/Sidebar.tsx` · `src/utils/betaMenuStatus.ts` · `server/src/middleware/auth.middleware.ts` · `server/src/middleware/admin.middleware.ts` · `server/src/middleware/rbac.middleware.ts` · `server/src/middleware/effectiveCapability.middleware.ts` · `server/src/database/Database.ts` · `vitest.config.ts` · `tests/setup.ts``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY264_WYNIKI_REPORT.md`. Jedyny inny dokument, który wolno Ci dotknąć: `docs/program/waves/WAVE_03_ACCEPTANCE/modules/09_RESULTS/MODULE_ACCEPTANCE.md` — WYŁĄCZNIE nowa sekcja „## Dzień 264 — rekomendacja mianownika F.2, wariant crosswalk, kontekst `VITE_DEMO_ACCEPTANCE`" na końcu pliku z `R2a`/`R2b`/wnioskiem `R1` o pokryciu testowym. Zakaz kasowania, nadpisywania lub przepisywania istniejącej treści, w tym sekcji „Pomiar dyżuru 234".. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day264-wyniki-mianownik-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day264-wyniki-mianownik-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ZAKAZ wyboru kanonicznego mianownika F.2 (`146` vs `152`) — prezentujesz rekomendację, decyzja u nadzorcy. ZAKAZ montowania crosswalk/backfill w produkcie — prezentujesz wariant z kosztem, decyzja u właściciela. ZAKAZ jakiejkolwiek zmiany `VITE_DEMO_ACCEPTANCE`/`isDemoAcceptanceProfileEnabled`/sześciu rodzin flag, nawet tymczasowej do testu — `Z28` nie ma wyjątku „tylko do pomiaru". ZAKAZ tworzenia duplikatu testu pokrywającego ścieżkę demo, jeśli `R1` potwierdzi, że `demoAcceptanceFlags.test.ts` już to pokrywa. | Karta modułu ma już surowe dane trzech metod liczenia (130/146/152) z dyżuru 234, ale zero rekomendacji — «wybór należy do nadzorcy» zapisane w `SPROSTOWANIE_WIDOCZNOSC_WYNIKOW.md` nigdy nie dostało materiału do wyboru. Ta sama notatka zleca dwa inne zadania (dopisać `VITE_DEMO_ACCEPTANCE` do karty, dodać pokrycie testowe ścieżki demo) — pierwsze wciąż niezrobione, drugie ma niejednoznaczny stan wymagający weryfikacji, nie założenia. Właściciel ma dziś mało tokenów i chce przepchnąć ~40 dyżurów jednym ruchem — potrzebuje gotowej rekomendacji z uzasadnieniem i domkniętych zaległych zadań z notatki sprostowania, bez ruszania świętej zmiennej demo. |

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
cd /private/tmp/cx-day264-wyniki-mianownik

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day264-pg psql -U postgres -d cx264 \
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
cd /private/tmp/cx-day264-wyniki-mianownik

docker run -d --name cx-day264-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx264 \
  -p 127.0.0.1:6268:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day264-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6268/cx264 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6268/cx264 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day264-wyniki-mianownik && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6268/cx264 \
JWT_SECRET=cx264-test-secret-do-not-reuse \
npx vitest run src/utils/__tests__/demoAcceptanceFlags.test.ts src/components/ResultsVNext/__tests__/resultsVNextFeatureFlags.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day264-wyniki-mianownik-artefakty/day264-wyniki-mianownik.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day264-wyniki-mianownik && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run src/utils/__tests__/demoAcceptanceFlags.test.ts src/components/ResultsVNext/__tests__/resultsVNextFeatureFlags.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day264-wyniki-mianownik-artefakty/day264-wyniki-mianownik.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day264-wyniki-mianownik/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day264-pg psql -U postgres -d cx264 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day264-pg`.
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
> **(e) ★★★ DEMO JEST NIETYKALNE — TO NIE JEST TYLKO `Z10`, TO ODRĘBNA, TWARDSZA DECYZJA WŁAŚCICIELA (`DEC-2026-08-28-227`) PO INCYDENCIE «NADZORCA PODAŁ FAŁSZ».** Nadzorca sam pomylił się w tej sprawie 1.09 (czytał wartości domyślne flag w kodzie i uznał je za stan produktu, nie widząc dwóch `return true` wyżej w tej samej funkcji) — dokładnie ta sama pułapka czeka na Ciebie, jeśli w `R1`/`R2` będziesz cytować wyłącznie wartości domyślne flag bez `VITE_DEMO_ACCEPTANCE` jako kontekstu. KAŻDA liczba dostępności w Twoim raporcie MUSI podawać oba konteksty naraz (goły kod / realne demo), nigdy jeden bez drugiego. Druga pułapka: zadanie „dodać pokrycie testowe" z `SPROSTOWANIE_WIDOCZNOSC_WYNIKOW.md` może być JUŻ zrobione w innym pliku niż wskazywała notatka (`demoAcceptanceFlags.test.ts`, nie `resultsVNextFeatureFlags.test.ts`) — to jest dokładnie wzorzec „hipoteza nadzorcy staje się faktem": zmierz sam, nie przepisuj cudzego zdania.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day264-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day264-wyniki-mianownik-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (weryfikacja trzech komend F.2, zero wołaczy crosswalk, i rozstrzygnięcie rozbieżności pokrycia testowego demo na własnym SHA) · R2a (rekomendacja mianownika, bez wyboru) · R2b (wariant crosswalk z kosztem, bez wyboru) · R3 (wpis do karty modułu: rekomendacja + wariant + kontekst `VITE_DEMO_ACCEPTANCE`, wąska licencja) · R4 (raport dyżuru)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6268` albo `5248 i 5249` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6268` albo `5248 i 5249`** (`Z7`).

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

Dwie odrębne sprawy w module Wyniki, obie zmierzone 1.09, żadna dziś w pełni
domknięta w karcie modułu.

## (a) Mianownik pokrycia F.2 — `146` czy `152`, `135` WYCOFANE

Karta modułu (`docs/program/waves/WAVE_03_ACCEPTANCE/modules/09_RESULTS/MODULE_ACCEPTANCE.md`,
sekcja „Pomiar dyżuru 234") ma już udokumentowane **trzy odtwarzalne metody**
liczenia mutujących tras Results (`server/src/routes/resultsVnext/*.routes.ts`)
na markerze `e99e81301ac8c9cc9b945eb44b7365fa7ff055d6` — **ale bez
rekomendacji**, którą z dwóch końcowych kandydatek uznać za kanoniczną:

| Metoda | Wynik | Co liczy | Ograniczenie |
| --- | --- | --- | --- |
| literalne rejestracje `router.(post\|put\|patch\|delete)(` | `130` | też pojedyncze linie definicji helperów, nie rozwija wywołań | najsłabsza, tylko punkt wyjścia |
| literalne minus definicje helperów plus wywołania helperów | `146` | nadal tylko rejestracje o rozpoznanym kształcie tekstowym | statyczna, nie widzi montażu przez Gateway |
| introspekcja zbudowanych stosów Express (`router.stack`) w runtime | `152` | jedyna metoda, która faktycznie URUCHAMIA moduły i czyta zamontowane trasy | wymaga `npx tsx`, wolniejsza |

**`135`** (z wcześniejszego raportu, `tests/integration/results/day46.mutator-tenant-isolation.realpg.test.ts:10-18`)
**nie jest odtwarzalne żadną z tych metod i zostaje wycofane z obiegu.**

## (b) Crosswalk/backfill KPI — biblioteka bez wołacza

`kpiCrosswalkService.ts:36,74` i `kpiShadowReadService.ts:56` implementują
zapis i odczyt tenant-scoped mapowań KPI oraz jawnie niemontowany shadow
read — ale **zero wołaczy produktowych**: grep bez testów zwraca wyłącznie
definicje, `Gateway.ts` bez trafień. To jest kształt „biblioteka bez
wywołania" — kod istnieje i jest gotowy, ale nic w produkcie go nie
uruchamia. Karta modułu ma już ten fakt zapisany, ale **bez decyzji**:
podłączyć czy usunąć.

## ★ Kontekst obowiązkowy — `VITE_DEMO_ACCEPTANCE`, demo NIETKNIĘTE

**Na realnym `demo.consultify.ai` OKR i ROI SĄ widoczne.** Zmienna
`VITE_DEMO_ACCEPTANCE` (`src/utils/demoAcceptanceProfile.ts:27-31`,
`DEMO_ACCEPTANCE_ENV_KEY`) jest tam ustawiona (potwierdzone przez właściciela
w panelu Railway 28.08, `DEC-2026-08-28-216`) i działa jako **wczesny
`return true`**, który omija logikę flag **poniżej niego w tej samej
funkcji** — w SZEŚCIU rodzinach: `resultsVNextFeatureFlags.ts:173`
(Wyniki: KPI+ROI+OKR naraz) oraz pięć rodzin w obszarze pomysłów/studia
artefaktów (`artifactStudioFlags.ts:161,186`, `ideaFinancialCaseFlag.ts:67`,
`ideaDecisionLogFlag.ts:70`, `ideaDetailsInPanelFlag.ts:87`,
`ideaBusinessCaseSchemaFlag.ts:55`). **„Flaga OFF w kodzie" ≠ „wyłączone na
demo".** Na gołym kodzie bez zmiennej nieosiągalne są **24 z 33** elementów;
na realnym demo — **0 z 33** (`docs/program/funkcje/SPROSTOWANIE_WIDOCZNOSC_WYNIKOW.md`).

**Decyzja właściciela z 28.08 (`DEC-2026-08-28-227`): demo NIETKNIĘTE.** Ta
zmienna zostaje, nikt jej nie zmienia bez jego decyzji. **`Z10`/`Z28`
obowiązują bez wyjątku w tym dyżurze** — nie dotykasz `VITE_DEMO_ACCEPTANCE`,
`isDemoAcceptanceProfileEnabled` ani żadnego z sześciu miejsc, które je
czytają, poza ODCZYTEM.

### Zadania zapisane w `SPROSTOWANIE_WIDOCZNOSC_WYNIKOW.md` — stan wejściowy do zweryfikowania

1. „Dopisać stan `VITE_DEMO_ACCEPTANCE` i jego wpływ do karty modułu
   Wyników" — **sprawdzone przy pisaniu tej instrukcji: karta
   `09_RESULTS/MODULE_ACCEPTANCE.md` dziś NIE ma tej wzmianki** (zero
   trafień `grep -n "VITE_DEMO_ACCEPTANCE" .../09_RESULTS/MODULE_ACCEPTANCE.md`)
   — zadanie NIEZROBIONE, ten dyżur je wykonuje w `R3`.
2. „Dodać do pakietu testów flag przypadek pokrywający tę ścieżkę — dziś ma
   zero pokrycia" — **★ PRZY PISANIU TEJ INSTRUKCJI ZNALEZIONO ROZBIEŻNOŚĆ,
   DO ZWERYFIKOWANIA PRZEZ CIEBIE W `R1`, NIE DO PRZYJĘCIA NA SŁOWO.** Test
   `src/utils/__tests__/demoAcceptanceFlags.test.ts`, `it('centrally enables
   all Results VNext domains', ...)` (dodany commitem `3c3a51406f`,
   2026-08-26, **przodek markera** `df7f13056f`) asercjuje
   `isResultsVNextFlagEnabled('kpiRegistry'|'roiRegistry'|'okrRegistry',
   { env: { VITE_DEMO_ACCEPTANCE: 'true' }, ... })` równe `true` — to WYGLĄDA
   jak dokładnie ta ścieżka. Możliwe wyjaśnienia: (i) „zero pokrycia" odnosi
   się WĄSKO do konkretnego zestawu „13/13 PASS" cytowanego w tezie T5
   instrukcji 234 (`src/components/ResultsVNext/__tests__/resultsVNextFeatureFlags.test.ts`,
   policzone: dokładnie 13 `it(`, ŻADEN nie wspomina `VITE_DEMO_ACCEPTANCE`)
   — w takim razie zdanie w `SPROSTOWANIE...` jest niedoprecyzowane, nie
   fałszywe; (ii) test w `demoAcceptanceFlags.test.ts` faktycznie pokrywa tę
   ścieżkę i zadanie 2 jest JUŻ ZROBIONE, tylko nikt tego nie zapisał.
   **Rozstrzygnij w `R1` i zapisz wniosek w raporcie — nie twórz duplikatu
   testu, jeśli pokrycie już istnieje.**
3. „Rozstrzygnąć kanoniczny mianownik pokrycia: 130/146/152... wybór należy
   do nadzorcy, nie do wykonawcy" — ten dyżur dostarcza rekomendację, NIE
   wybiera (`R2a`).

## Czego ten dyżur świadomie NIE robi

- **Nie zmienia `VITE_DEMO_ACCEPTANCE`, `isDemoAcceptanceProfileEnabled` ani
  żadnej z sześciu rodzin flag, które ją czytają.** Demo NIETKNIĘTE (`DEC-2026-08-28-227`).
- **Nie wybiera kanonicznego mianownika F.2.** Prezentuje obie końcowe
  komendy (`146`, `152`) z rekomendacją — wybór u nadzorcy.
- **Nie montuje crosswalk/backfill w produkcie.** Prezentuje wariant
  montażu z kosztem — decyzja u właściciela.
- **Nie tworzy duplikatu testu**, jeśli `R1` potwierdzi, że pokrycie już
  istnieje (`demoAcceptanceFlags.test.ts`).

---

# 2. TEZY ZLECENIA

| # | Teza | Jak sprawdzasz |
|---|---|---|
| T1 | Komenda `146` i komenda `152` dają dziś te same wyniki co w karcie modułu (`146`, `152`) | komenda (1), (2) |
| T2 | `135` nie jest odtwarzalne żadną z trzech metod | komenda (3) |
| T3 | `kpiCrosswalkService.ts`/`kpiShadowReadService.ts` mają dziś zero wołaczy poza definicjami i testami | komenda (4) |
| T4 | Karta `09_RESULTS/MODULE_ACCEPTANCE.md` nie ma dziś wzmianki `VITE_DEMO_ACCEPTANCE` | komenda (5) |
| T5 | `demoAcceptanceFlags.test.ts` istnieje, jest przodkiem markera i dziś przechodzi z asercją na `isResultsVNextFlagEnabled` + demo source | komenda (6) |
| T6 | `resultsVNextFeatureFlags.test.ts` ma dziś dokładnie 13 przypadków, żaden nie wspomina `VITE_DEMO_ACCEPTANCE` | komenda (7) |
| T7 | Miejsce na dysku wystarcza | komenda (8) |

---

# 3. POZYCJE DYŻURU

## R1 — WERYFIKACJA STANU NA WŁASNYM SHA (rdzeń, warunek wejścia)

Wykonaj **wszystkie 8 komend** z `§0.1`. Rozstrzygnij jednoznacznie
rozbieżność z zadania 2 (§1) — wpisz do raportu jedno z dwóch: „pokrycie już
istnieje w `demoAcceptanceFlags.test.ts`, zadanie 2 z `SPROSTOWANIE...` jest
zrobione i nieopisane" ALBO „pokrycie jest niewystarczające, bo `<konkretny
powód>`, zadanie 2 pozostaje otwarte" — z cytatem testu jako dowodem w obu
przypadkach.

## R2a — REKOMENDACJA MIANOWNIKA F.2 (rdzeń, dokumentacyjny)

Odtwórz OBIE komendy (`146` i `152`, pełne jednowierszowce z karty modułu —
przepisz je z `09_RESULTS/MODULE_ACCEPTANCE.md`, nie z pamięci) na własnym
SHA i zapisz dosłowne wyjścia. Zbuduj rekomendację jednym akapitem: co
dokładnie liczy każda metoda, dlaczego `152` (introspekcja runtime) lepiej
odpowiada na pytanie „ile unikalnych mutujących metoda+pełna-ścieżka
faktycznie zarejestrowały routery montowane przez Gateway", a `146` jest
tańsza/szybsza, ale statyczna. **Zakończ zdaniem wprost: „Rekomendacja audytora:
<146 albo 152>, uzasadnienie: <…>. Decyzja kanoniczna należy do nadzorcy."**
Nie usuwaj `130` i `135` z dokumentu — kontekst historyczny, jawnie oznaczony
jako odrzucony/wycofany.

## R2b — WARIANT CROSSWALK/BACKFILL, Z KOSZTEM (rdzeń, dokumentacyjny)

Dwa warianty, z kosztem:

**Wariant A — montaż minimalny.** Ręczna akcja `OWNER`/`ADMIN` „Potwierdź
mapowanie KPI" na karcie inicjatywy. Żądanie przyjmuje WYŁĄCZNIE jawne pary
`sourceId` + `canonicalKpiId` wybrane przez człowieka, nigdy dopasowanie po
nazwie/kodzie. Backend przechodzi przez istniejące auth/membership/Results
visibility gates, zapisuje mapowanie tenant-scoped, zwraca liczby
requested/inserted/rejected; UI odczytuje wynik i shadow comparison.
Wymaga idempotency key, audytu aktora, niezależnego odczytu. Koszt: średni —
nowy endpoint + wpięcie UI na istniejącej karcie inicjatywy, logika
zapisu/odczytu już istnieje w `kpiCrosswalkService.ts`.
**Alternatywa niższego kosztu w tym samym wariancie:** ręczny job
administracyjny OWNER (mniejszy promień UI, gorsza widoczność kontekstu) —
opisz oba pod-warianty A1/A2 z ich kosztem.

**Wariant B — nie montować, zostawić jako udokumentowaną, świadomie
nieużywaną bibliotekę.** Koszt: zero. Ryzyko: kod wisi bez konsumenta —
kolejny audyt znajdzie go jako „biblioteka bez wywołania" ponownie, chyba że
zostanie jawnie oznaczony w karcie jako `KNOWN_DECISION / NOT_MOUNTED_BY_DESIGN`
z datą i uzasadnieniem (żeby nie był mylony z zapomnianym niedokończeniem).

Nie wybieraj. Zapisz oba w tabeli z kosztem i rekomendacją jawnie oznaczoną
jako NIE decyzja.

## R3 — WPIS DO KARTY MODUŁU (wąska licencja, `J`)

Dopisz na końcu `docs/program/waves/WAVE_03_ACCEPTANCE/modules/09_RESULTS/MODULE_ACCEPTANCE.md`
**wyłącznie nową sekcję** „## Dzień 264 — rekomendacja mianownika F.2,
wariant crosswalk, kontekst `VITE_DEMO_ACCEPTANCE`" zawierającą:

1. Rekomendację z `R2a` (bez usuwania istniejącej sekcji „Pomiar dyżuru 234").
2. Tabelę wariantów z `R2b`.
3. **Nową, osobną wzmiankę o `VITE_DEMO_ACCEPTANCE`** zgodnie z zadaniem 1 z
   `SPROSTOWANIE_WIDOCZNOSC_WYNIKOW.md`: że na realnym demo OKR/ROI SĄ
   widoczne przez tę zmienną, że demo jest NIETKNIĘTE (`DEC-2026-08-28-227`),
   i że karta liczby dostępności (np. „24/33 nieosiągalne") musi ZAWSZE
   podawać oba konteksty — goły kod i realne demo — nigdy sam.
4. Wniosek z `R1` o stanie zadania 2 (pokrycie testowe ścieżki demo).

Zero zmian w istniejącej treści pliku poza tym dopiskiem.

## R4 — RAPORT DYŻURU (rdzeń)

Streszczenie, `R1`-`R3` z pełnymi dowodami, sekcja „TWIERDZENIA
NIEZWERYFIKOWANE" (obowiązkowa nawet pusta), sekcja „Korekty wobec
instrukcji" (obowiązkowa nawet pusta). Dołącz pełne wyjścia komend, ścieżki
artefaktów w `/private/tmp/cx-day264-wyniki-mianownik-artefakty` z `shasum -a 256`.

---

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Odczyt (ZAKAZ ZAPISU) | `server/src/routes/resultsVnext/*.routes.ts` · `server/src/Gateway.ts` (WYŁĄCZNIE introspekcja montażu, `:1233-1287`) — kontekst `R2a`, nie zmieniasz |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/resultsVnext/kpi/kpiCrosswalkService.ts` · `server/src/services/resultsVnext/kpi/kpiShadowReadService.ts` — kontekst `R2b`, nie zmieniasz |
| **★★ Odczyt WYŁĄCZNIE (ZAKAZ ZAPISU, bez wyjątku, `Z10`/`Z28`)** | `src/utils/demoAcceptanceProfile.ts` · `src/components/ResultsVNext/resultsVNextFeatureFlags.ts` · `src/utils/artifactStudioFlags.ts` · `src/utils/ideaFinancialCaseFlag.ts` · `src/utils/ideaDecisionLogFlag.ts` · `src/utils/ideaDetailsInPanelFlag.ts` · `src/utils/ideaBusinessCaseSchemaFlag.ts` — demo NIETKNIĘTE, `DEC-2026-08-28-227` |
| Odczyt (ZAKAZ ZAPISU) | `src/utils/__tests__/demoAcceptanceFlags.test.ts` · `src/components/ResultsVNext/__tests__/resultsVNextFeatureFlags.test.ts` — weryfikujesz pokrycie w `R1`, nie zmieniasz. Jeśli `R1` ustali, że pokrycia NAPRAWDĘ brakuje — opisz brakujący przypadek jako gotowy blok kodu w raporcie, NIE dodawaj go jako plik w tym dyżurze (poza zakresem zapisu) |
| Zapis (WĄSKO, `J`) | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/09_RESULTS/MODULE_ACCEPTANCE.md` — wyłącznie nowa sekcja na końcu, zakaz kasowania/przepisywania istniejącej treści, w tym sekcji „Pomiar dyżuru 234" |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY264_WYNIKI_REPORT.md` |
| Odczyt (ZAKAZ ZAPISU) | `vitest.config.ts` · `tests/setup.ts` (`Z18`) · `server/src/database/Database.ts` |
| **Wszystko inne** | **TYLKO ODCZYT** — opisujesz potrzebę w raporcie z `plik:linia` i idziesz dalej |

---

# 5. TWARDE ZASADY

- ★★★ **DEMO NIETKNIĘTE — `Z10`/`Z28` BEZ WYJĄTKU.** Ani `VITE_DEMO_ACCEPTANCE`,
  ani `isDemoAcceptanceProfileEnabled`, ani żadna z sześciu rodzin flag,
  które ją czytają, nie zmienia się w tym dyżurze — ani w kodzie, ani w
  `.env*`, ani w Railway. `DEC-2026-08-28-227` jest decyzją właściciela,
  nie sugestią.
- ★★ **NIE WYBIERASZ MIANOWNIKA F.2 ANI WARIANTU CROSSWALK.** Oba produkty
  tego dyżuru to materiał decyzyjny z jawną rekomendacją oznaczoną jako
  NIE decyzja.
- ★★ **ROZBIEŻNOŚĆ Z ZADANIA 2 (§1) MUSI BYĆ ROZSTRZYGNIĘTA POMIAREM, NIE
  PRZEPISANA Z `SPROSTOWANIE...` NA SŁOWO.** To jest dokładnie wzorzec
  „hipoteza nadzorcy staje się faktem" — teza w dokumencie wraca jako
  „zweryfikowany fakt" bez ponownego zmierzenia. Ty mierzysz.
- ★ **KAŻDA LICZBA DOSTĘPNOŚCI (np. „X/33 nieosiągalne") MA PODAWAĆ OBA
  KONTEKSTY RAZEM: goły kod i realne demo.** Sam jeden kontekst bez
  drugiego jest dokładnie błędem, który spowodował sprostowanie 1.09.
- ★ **`Z13`/`J`:** logi i pliki wynikowe NIE wchodzą do repo — leżą w
  `/private/tmp/cx-day264-wyniki-mianownik-artefakty`, raport podaje ścieżki i `shasum -a 256`.
- ★ **PUSH WYŁĄCZNIE NA `github-backup`.** `origin` jest PUBLICZNY.
- ★★ **SEKCJA „TWIERDZENIA NIEZWERYFIKOWANE" W RAPORCIE JEST OBOWIĄZKOWA.** Brak tej sekcji
  jest podstawą odrzucenia dyżuru.
