# INSTRUKCJA DYŻURU nr 319 — Codex — „★★★ ZAKRES BEZPIECZNIKA DDL I TABELE BEZ POKRYCIA: bezpiecznik postawiony przez dyżur 310 (`tests/unit/backend/schema/noRuntimeDdl.test.ts`) skanuje WYŁĄCZNIE `server/src/services/`, czyli 197 z 504 wystąpień `CREATE TABLE IF NOT EXISTS` (39 %) — mutacja odbiorcy wstawiona do `server/src/controllers/AssessmentController.ts`, czyli do pliku, który dyżur 310 właśnie naprawiał, PRZESZŁA NA ZIELONO; ten dyżur (1) rozszerza zakres bezpiecznika na całe `server/src` i dowodzi tego TRZEMA mutacjami POZA `services/`, (2) mierzy mianownik na PUSTEJ bazie przez `information_schema` — nie parserem i nie grepem — i daje pokrycie migracyjne tabelom, które dziś istnieją wyłącznie dzięki DDL w locie (odbiór policzył 27), (3) naprawia `llm_providers.markup_multiplier`, czyli narzut kosztowy LLM i ekran `AdminLLMMultipliers`, który NIGDY nie działał na czystej bazie, bo kolumny nie ma w ŻADNEJ migracji, (4) czyści rejestr 310 z wierszy śmieciowych parsera i z fałszywych trafień kolumny „Migracja” (22 z 93 cytowanych plików runner Postgresa w ogóle nie uruchamia). ★ SPROSTOWANIE: teza „na świeżej bazie nikt się nie zarejestruje” jest OBALONA — `POST /api/auth/register` przez realny `ApiGateway` zwraca 200 na bazie zbudowanej wyłącznie z migracji; ryzyko materializuje się dopiero wtedy, gdy ktoś usunie DDL bez dopisania migracji."

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
> **wyłącznie** `/private/tmp/cx-day319-ddl-zakres`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `bc18bc7acac2ec825ebb3db2f1309738ab034d58`**
> **Gałąź bazowa: `github-backup/grafika/m03-20260902`**
> **Stan dokumentu: WYDANY**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo jakiekolwiek niewypelnione pole szablonu — **dokument nie
> jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.
> Ta ramka jest **jedynym** miejscem, w którym rozstrzyga się stan wydania.
> Objaśnienia w innych blokach cytowanych **nie** są powodem do STOP-u.

Data wystawienia: 2026-09-04.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.
Zakres: ****PRZEKROJOWE — SERWER: schemat poza migracjami, domknięcie po dyżurze 310.** Dyżur 310 jest scalony na linii `grafika/m03-20260902`; jego rejestr leży w `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_SCHEMAT_POZA_MIGRACJAMI_20260903.md`, a bezpiecznik w `tests/unit/backend/schema/noRuntimeDdl.test.ts`. Cztery zadania tego dyżuru pochodzą z odbioru adwersaryjnego 04.09: **(1)** zakres bezpiecznika — dziś wyłącznie `server/src/services`, mutacja w `server/src/controllers/AssessmentController.ts` przechodzi na zielono; **(2)** tabele bez pokrycia migracyjnego — mierzone `information_schema` na świeżej bazie po pełnym łańcuchu strict, NIE parserem; **(3)** `llm_providers.markup_multiplier` — kolumna nie występuje w `server/migrations/` ani razu, a czyta ją `server/src/services/ai/AIPipeline.ts`, `modelRouter.ts` i ekran `src/views/admin/AdminLLMMultipliers.tsx`; **(4)** czyszczenie rejestru 310. ★★ Kluczowa pułapka mierzenia, którą sam zweryfikowałem: `server/scripts/migrate.postgres.ts` POMIJA całe rodziny plików migracji (numer < 500 poza `000_z_core_baseline*`, wszystkie `000_initdb_*`, nazwy z `sqlite`/`fts5`, pliki `.sql.sql`, katalog `never-ran/`), więc statyczne „grep znalazł migrację” bywa FAŁSZYWE — tabela `mfa_attempts` ma `CREATE TABLE` w `000_initdb_core_tables.sql`, a mimo to nie powstaje na czystej bazie.**.
Trasy front: `**Brak zmian w `src/`.** Mierzysz wyłącznie, z czego czyta `src/views/admin/AdminLLMMultipliers.tsx` (pole `markup_multiplier`, linie 14, 23-24, 50, 62, 162) oraz `src/views/admin/TokenBillingManagementView.tsx` i `src/views/superadmin/BillingCenterView.tsx`, i czy po pozycji `R4` mają z czego czytać. Dowodem jest odpowiedź HTTP z trasy, nie zrzut ekranu.`. Trasy tył: ``tests/unit/backend/schema/noRuntimeDdl.test.ts` (bezpiecznik dyżuru 310 — dziś skanuje wyłącznie `server/src/services`) · `server/scripts/migrate.postgres.ts` (runner strict; predykat pomijania plików to BRAMKA PLATFORMOWA — tylko odczyt) · `server/src/database/DatabaseInitializer.ts` (67 wystąpień DDL) i `server/src/database/PostgresDatabase.ts` (73 wystąpienia) · `server/src/controllers/AssessmentController.ts` (cel mutacji dowodowej) · `server/src/controllers/SuperAdminController.ts` (11), `server/src/controllers/InterviewController.ts` (8), `server/src/controllers/ToolController.ts` (6) · `server/src/routes/testSupport.routes.ts` (11), `server/src/routes/adminP32.routes.ts` (8), `server/src/routes/llm.routes.ts` (7), `server/src/routes/resultsStrategic.routes.ts` (5), `server/src/routes/integrations/scim.routes.ts` (5) · `server/src/controllers/ai/LLMController.ts` (linie 449, 572, 592 — `markup_multiplier`) · `server/src/services/ai/AIPipeline.ts` (linie 2996-3008 — kolejność: kolumna → zmienna środowiskowa → wartość domyślna), `server/src/services/ai/modelRouter.ts` (132, 1462, 1778, 1801), `server/src/services/ai/llmConfigService.ts` (42) · `server/migrations/000_z_core_baseline.sql` (JEDYNA baza, którą runner uruchamia z rodziny 000) · `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_SCHEMAT_POZA_MIGRACJAMI_20260903.md` (518 wierszy tabeli) · `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY310_SCHEMAT_POZA_MIGRACJAMI_REPORT.md` (raport dyżuru 310 — tylko odczyt).`.

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
WT=/private/tmp/cx-day319-ddl-zakres
MARKER=bc18bc7acac2ec825ebb3db2f1309738ab034d58

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/grafika/m03-20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day319-ddl-zakres-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day319-ddl-zakres/config.worktree"
cat "$VAULT/worktrees/cx-day319-ddl-zakres/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day319-ddl-zakres-scratch
mkdir -p /private/tmp/cx-day319-ddl-zakres-artefakty

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
git -C "$VAULT" log --oneline bc18bc7acac2ec825ebb3db2f1309738ab034d58..github-backup/grafika/m03-20260902
git -C "$VAULT" diff --name-only bc18bc7acac2ec825ebb3db2f1309738ab034d58..github-backup/grafika/m03-20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day319-ddl-zakres-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only bc18bc7acac2ec825ebb3db2f1309738ab034d58..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `7` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA: DDL w locie = 504 wystapienia w 160 plikach server/src, z tego 197 w 98 plikach services
git grep -c "CREATE TABLE IF NOT EXISTS" -- server/src | awk -F: '{s+=$2} END {print s" wystapien w "NR" plikach"}'
git grep -c "CREATE TABLE IF NOT EXISTS" -- server/src/services | awk -F: '{s+=$2} END {print s" wystapien w "NR" plikach"}'
git grep -c "CREATE TABLE IF NOT EXISTS" -- server/src | grep -v "^server/src/services/" | sort -t: -k2 -nr | head -8
#   moje liczby: 504/160 razem, 197/98 w services -> bezpiecznik widzi 39 % rodziny.
#   ★ Rejestr 310 podaje 509/161/98 przy INNEJ metodzie liczenia, a naglowek mowi "PRZED: 531/164/100".
#   TRZY liczby, zadna nie jest bledem — to inne definicje. USTAL WLASNA i pracuj na niej (Z24).

# (2) TEZA: bezpiecznik skanuje WYLACZNIE server/src/services i jest dzis zielony
grep -n "server/src/services" tests/unit/backend/schema/noRuntimeDdl.test.ts | tail -4
grep -c "^  \"server/src/" tests/unit/backend/schema/noRuntimeDdl.test.ts
RUN_DB_TESTS=0 MOCK_DB=true npx vitest run tests/unit/backend/schema/noRuntimeDdl.test.ts --retry=0 2>&1 | tail -8
#   oczekiwane: dwa wywolania files(path.join(process.cwd(), 'server/src/services')), lista wyjatkow
#   per plik, pakiet ZIELONY. To jest Twoja linia bazowa dla R1.

# (3) TEZA: runner POMIJA cale rodziny plikow migracji — dlatego grep klamie o pokryciu
sed -n '250,290p' server/scripts/migrate.postgres.ts
ls server/migrations | wc -l
ls server/migrations/never-ran 2>/dev/null | wc -l
#   oczekiwane: predykat pomija 000_initdb_*, numer < 500 poza 000_z_core_baseline*, nazwy z sqlite/fts5,
#   pliki .sql.sql; 1108 plikow w server/migrations. ★ To jest NAJWAZNIEJSZA komenda tego bloku —
#   bez niej uznasz tabele z 000_initdb_core_tables.sql za pokryta, a ona nie powstanie.

# (4) TEZA: markup_multiplier nie istnieje w zadnej migracji, a czyta go kod i ekran administracyjny
git grep -c "markup_multiplier" -- server/migrations | wc -l
git grep -n "markup_multiplier" -- server/src | cut -d: -f1 | sort -u
git grep -n "markup_multiplier" -- src/views/admin/AdminLLMMultipliers.tsx | head -3
#   moje liczby: ZERO plikow migracji; piec plikow w server/src; ekran czyta pole wprost.

# (5) TEZA: rejestr 310 niesie wiersze smieciowe parsera i falszywe trafienia kolumny "Migracja"
grep -c '^|' docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_SCHEMAT_POZA_MIGRACJAMI_20260903.md
awk -F'|' '/^\| server/ {gsub(/ /,"",$4); if (length($4)<6 && $4!="") print $4}' \
  docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_SCHEMAT_POZA_MIGRACJAMI_20260903.md | sort | uniq -c
awk -F'|' '/^\| server/ {gsub(/ /,"",$5); if ($5!="BRAK") print $5}' \
  docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_SCHEMAT_POZA_MIGRACJAMI_20260903.md \
  | sed 's#server/migrations/##' | sort -u | wc -l
#   moje liczby: 518 wierszy tabeli; nazwy `is`, `and`, `for`, `in`, `below`, `jest`, `pass`, `w`, `won`, `...`;
#   93 unikalne pliki w kolumnie "Migracja", z czego 22 runner pomija (policz to sam komenda z punktu 3).

# (6) TEZA: moj przedzial migracji jest WOLNY
ls server/migrations | grep -cE "^2026125[0-9]"
ls server/migrations | grep -E "^20261[12]" | sort | tail -3
#   oczekiwane: 0 plikow w przedziale 20261250-20261259; najwyzszy istniejacy prefiks to 20261240.

# (7) TEZA: zasoby wolne
lsof -nP -iTCP:5475 -sTCP:LISTEN; lsof -nP -iTCP:6335 -sTCP:LISTEN
docker ps --format "{{.Names}}" | grep -c cx-day319 || true
df -h /
#   oczekiwane: puste lsof, 0 kontenerow. ★ Ten dyzur stawia baze OD ZERA wielokrotnie —
#   ponizej 5 GB wolnego to STOP calosci (§0.5).
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day319-ddl-zakres-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6335`. Twój JEDYNY port harnessu to `5475`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day319-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta listy restricted ports Chromium. Zajęte przez inne prace (nie ruszasz): 3020, 3022, 3025, 3027, 3030 (tor grafiki nadzorcy), 5322, 5410-5441 (agenci nadzorcy), 5442-5458 oraz 6311-6322 (odbiorcy nadzorcy), 5432 i 5433 (Postgres hosta), 6012, 6379 (redis), 7000, 7679, 7768, 11434. Cudze — dyżury 286-318 (bazy 6290-6334, harness 5250-5474). Dyżury równoległe tej serii: 319 (baza 6335, harness 5475, kontener cx-day319-pg), 320 (baza 6336, harness 5476, kontener cx-day320-pg), 321 (baza 6337, harness 5477, kontener cx-day321-pg) — do CUDZEJ bazy nie łączysz się nawet do odczytu. Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps. ★ ZAKAZ `pkill`/`killall` na `node`, `vite`, `playwright` — zabijasz wyłącznie własne PID-y (zapisz `$!`).`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak — ten dyżur nie wprowadza ani jednej nowej flagi funkcyjnej i nie zmienia wartości domyślnej żadnej istniejącej`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/scripts/migrate.postgres.ts` — predykat pomijania plików migracji rozstrzyga, co dostaje KAŻDE środowisko, demo i produkcja też (tylko odczyt) · `tests/unit/backend/security/*` · `tests/unit/backend/security/noRawErrorMessage.test.ts` (teren dyżuru 321) · `scripts/dev/p0p1-licznik-e1.mjs` i `.github/workflows/**` (teren dyżuru 320) · `server/migrations/000_z_core_baseline.sql` i `server/migrations/000_initdb_*.sql` · `scripts/check-list-canon.sh` i `scripts/check-artefakt.sh` (hooki; nie dotyczą zakresu, nie omijaj). ★ WYJĄTEK wymieniony imiennie w tabeli licencji: `tests/unit/backend/schema/noRuntimeDdl.test.ts` — to jest RDZEŃ tego dyżuru i masz pełną licencję na jego rozszerzenie`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY319_DDL_ZAKRES_REPORT.md`. Dozwolona AKTUALIZACJA (dopisanie, nigdy skasowanie) dwóch istniejących dokumentów: `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_SCHEMAT_POZA_MIGRACJAMI_20260903.md` (pozycja `R5`) oraz wiersza rodziny „schemat poza migracjami” w `docs/program/REJESTR_ZNALEZISK_20260903.md`. Kod i migracje wg tabeli licencji; nowa migracja WYŁĄCZNIE w przedziale `server/migrations/20261250_day319_*.sql`. Nowe pliki w `tests/` wymagają `git add -f`. **ZAKAZ edycji `MODULE_ACCEPTANCE.md` — ten dyżur jest przekrojowy**. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day319-ddl-zakres-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day319-ddl-zakres-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ zmiany predykatu pomijania plików w `server/scripts/migrate.postgres.ts`** — to rozstrzyga, co dostaje każde środowisko; brakujące pokrycie robisz NOWĄ migracją addytywną w swoim przedziale, nigdy odblokowaniem pominiętego pliku. **ZAKAZ edycji `000_z_core_baseline.sql`, `000_initdb_*.sql` i katalogu `never-ran/`.** **ZAKAZ migracji nieaddytywnych** — żadnego `DROP`, `ALTER ... TYPE`, zmiany klucza głównego ani usuwania kolumn. **ZAKAZ rozszerzania listy wyjątków bezpiecznika bez wiersza w raporcie** (plik · liczba · dlaczego · kto weźmie); listę wolno wyłącznie skracać w kolejnych dyżurach. **ZAKAZ mutacji dowodowej w pliku z listy wyjątków i w katalogu `services/`.** **ZAKAZ usuwania DDL w locie dla tabeli, dla której nie masz dowodu z `information_schema`, że powstaje z migracji.** **ZAKAZ cichego `catch` przy DDL, które zostaje jako strażnik — błąd ma być GŁOŚNY.** **ZAKAZ mieszania w jednym commicie usunięcia DDL ze zmianą logiki biznesowej.** **ZAKAZ zmiany domyślnej wartości narzutu kosztowego LLM** — to zmiana cennika; znalezisko wpisujesz i zostawiasz. **ZAKAZ kasowania wierszy rejestru 310** — wiersz śmieciowy dostaje status `ARTEFAKT_PARSERA`, nie znika. **ZAKAZ zmian w `src/`.** **ZAKAZ czytania `server/src/_backup/**` (`Z4`) — jeśli bezpiecznik ma ten katalog pomijać, ma to być jawny wyjątek z komentarzem.** **ZAKAZ `git stash`, `pkill`, `killall`, `--no-verify`.** **ZAKAZ dotykania demo, stagingu i produkcji.** **ZAKAZ edycji `MODULE_ACCEPTANCE.md`.** | Bramka G20 wymaga, żeby odtworzenie systemu po awarii opierało się na łańcuchu migracji. Dyżur 310 wykonał realną pracę i postawił bezpiecznik — ale bezpiecznik widzi mniej niż 40 % rodziny i mutacja w pliku, który 310 właśnie naprawiał, przeszła na zielono. Program ma to zapisane jako kształt „test scenariusza nie broni zabezpieczenia”: zielono jest dlatego, że zabezpieczenie patrzy gdzie indziej. Do tego rejestr, z którego wyprowadza się wszystkie liczby tej rodziny, niesie wiersze śmieciowe i kolumnę „Migracja” liczoną statycznie, podczas gdy runner pomija 22 z 93 cytowanych plików. Bez tego dyżuru rejestr będzie niósł „schemat domknięty”, świeże środowisko dalej będzie startowało w innym stanie niż poprzednie, a narzut kosztowy LLM — funkcja rozliczeniowa — nadal nie będzie działał na czystej bazie. |

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
cd /private/tmp/cx-day319-ddl-zakres

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day319-pg psql -U postgres -d cx319 \
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
cd /private/tmp/cx-day319-ddl-zakres

docker run -d --name cx-day319-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx319 \
  -p 127.0.0.1:6335:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day319-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6335/cx319 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6335/cx319 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day319-ddl-zakres && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6335/cx319 \
JWT_SECRET=cx319-test-secret-do-podpisu-tokenow-w-tym-dyzurze \
npx vitest run tests/unit/backend/schema/noRuntimeDdl.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day319-ddl-zakres-artefakty/day319-bezpiecznik-ddl.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day319-ddl-zakres && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run tests/unit/backend/schema/noRuntimeDdl.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day319-ddl-zakres-artefakty/day319-bezpiecznik-ddl.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day319-ddl-zakres/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day319-pg psql -U postgres -d cx319 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day319-pg`.
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
> **(e) ★★★ SZEŚĆ PUŁAPEK TEGO DYŻURU. **(1) Bezpiecznik, który nie patrzy tam, gdzie boli.** `noRuntimeDdl.test.ts` skanuje wyłącznie `server/src/services` — mutacja w `controllers/` przechodzi na zielono. Twój dowód mutacyjny MUSI leżeć POZA `services/` i MUSI trafiać w plik spoza listy wyjątków; mutacja w `services/` niczego nie dowodzi, bo ten zakres był zielony przed dyżurem. **(2) `grep` kłamie o pokryciu migracyjnym.** Runner pomija `000_initdb_*`, wszystko o numerze < 500 poza `000_z_core_baseline*`, nazwy z `sqlite`/`fts5`, pliki `.sql.sql` i katalog `never-ran/`. Zmierzone: 22 z 93 unikalnych plików cytowanych w kolumnie „Migracja” rejestru 310 nigdy się nie uruchamiają. Jedyny uczciwy mianownik to `information_schema` żywej pustej bazy. **(3) Obalona teza w obiegu.** „Na świeżej bazie nikt się nie zarejestruje” jest NIEPRAWDĄ — realny `POST /api/auth/register` przez `ApiGateway` zwrócił 200. Nie przepisujesz tej tezy i nie budujesz na niej uzasadnień. **(4) Migracja przyrostowa nie jest dowodem.** Łańcuch musi przechodzić OD ZERA, w kolejności alfabetycznej, na bazie bez ani jednej tabeli, dwa przebiegi (drugi bez zmian). Program ma zmierzony przypadek migracji czytającej kolumnę dodawaną później alfabetycznie. **(5) Atrapa bazy kłamie w obie strony.** `NODE_ENV=test` bez `RUN_DB_TESTS=1` podstawia atrapę pod `DbPromise` — `pg.Pool` widzi wiersz, kod produkcyjny nie; `Database.ts` zwraca `changes: 1` dla każdego `UPDATE` niezależnie od `WHERE`. Dowód schematu robisz na REALNYM Postgresie, na własnym porcie. **(6) Rejestr 310 niesie wiersze, które nie są wierszami.** Nazwy tabel `is`, `and`, `for`, `in`, `below`, `jest`, `pass`, `w`, `won`, `...` — jedna z nich dostała nawet fałszywe dopasowanie migracji. Każda liczba wyprowadzona z tego rejestru bez oczyszczenia jest zawyżona.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day319-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day319-ddl-zakres-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (``R1`, `R2`, `R3``) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6335` albo `5475` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6335` albo `5475`** (`Z7`).

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

Dyżur 310 zrobił dużą, realną pracę: usunął część `CREATE TABLE IF NOT EXISTS` z kodu serwera,
dopisał migracje i postawił bezpiecznik `tests/unit/backend/schema/noRuntimeDdl.test.ts`.
Odbiór adwersaryjny 04.09 potwierdził rdzeń — i znalazł cztery rzeczy, których nikt nie zgłosił.

**Pierwsza jest najważniejsza: bezpiecznik nie patrzy tam, gdzie boli.** Skanuje wyłącznie
katalog `server/src/services`, czyli mniej niż 40 % wystąpień. Odbiorca wstawił `CREATE TABLE
IF NOT EXISTS` do `server/src/controllers/AssessmentController.ts` — pliku, który dyżur 310
właśnie naprawiał — i **bezpiecznik przeszedł na zielono**. To jest ten sam kształt, który
program zapisał już jako „test scenariusza nie broni zabezpieczenia": mutacja celowała
w zabezpieczenie, nie w mechanizm, i zabezpieczenie jej nie zobaczyło.

**Druga: pokrycie migracyjne jest dziurawe, a statyczny `grep` o tym kłamie w obie strony.**
Runner Postgresa (`server/scripts/migrate.postgres.ts`) **pomija całe rodziny plików**:
wszystko o numerze mniejszym niż 500 poza `000_z_core_baseline*`, wszystkie `000_initdb_*`,
wszystko z `sqlite`/`fts5`/`.sql.sql` w nazwie oraz katalog `never-ran/`. Dlatego zdanie
„grep znalazł migrację tworzącą tę tabelę" **nie znaczy, że tabela powstanie na czystej bazie**.
Mój pomiar: rejestr 310 cytuje 93 unikalne pliki migracji w kolumnie „Migracja", z czego
**22 runner nigdy nie uruchamia**. Jedynym uczciwym mianownikiem jest `information_schema`
na ŻYWEJ, pustej bazie po pełnym łańcuchu strict — nie parser i nie `grep`.

**Trzecia: `llm_providers.markup_multiplier` nigdy nie działał na czystej bazie.** To narzut
kosztowy LLM (`server/src/services/ai/AIPipeline.ts`, `modelRouter.ts`) i ekran administracyjny
`src/views/admin/AdminLLMMultipliers.tsx`. Kolumna nie występuje w ŻADNYM pliku
`server/migrations/` ani razu. To jest zastany defekt, nie regresja dyżuru 310 — i ma zostać
nazwany, a nie ukryty.

**Czwarta: rejestr 310 niesie wiersze śmieciowe z parsera.** Nazwy tabel `is`, `and`, `for`,
`in`, `below`, `jest`, `pass`, `w`, `won`, `...` — a jedna z nich (`is`) dostała nawet fałszywe
dopasowanie do `server/migrations/20260411_partner_certification_v2.sql`. Dopóki tam siedzą,
każda liczba wyprowadzona z tego rejestru jest zawyżona i nie da się jej obronić.

## ★★★ SPROSTOWANIE, KTÓRE MASZ PRZECZYTAĆ, ZANIM ZACZNIESZ

W pamięci programu i w instrukcji dyżuru 310 stoi teza: **„na świeżej bazie nikt się nie
zarejestruje"**. Ta teza jest **OBALONA**. Odbiór 04.09 wykonał realne żądanie
`POST /api/auth/register` przez prawdziwy `ApiGateway`, na bazie zbudowanej **wyłącznie**
z łańcucha migracji, i dostał **HTTP 200**.

Ryzyko jest **węższe, niż głosi teza**: materializuje się dopiero wtedy, gdy ktoś usunie DDL
w locie bez dopisania odpowiadającej migracji. Nie przepisujesz obalonej tezy do swojego
raportu i **nie budujesz na niej uzasadnienia żadnej pozycji**. Twoim zadaniem jest zamknąć
realną dziurę (bezpiecznik + pokrycie migracyjne), a nie odtworzyć cudzy dramat.

Jeżeli Twój pomiar pokaże, że rejestracja jednak PADA — to jest wynik pierwszej klasy i
wpisujesz go z pełnym wyjściem HTTP. **Nie zakładasz ani jednego, ani drugiego przed pomiarem.**

## ★ Zmierz moje liczby sam

Twierdzę: `CREATE TABLE IF NOT EXISTS` występuje **504 razy w 160 plikach** `server/src`,
z czego **197 razy w 98 plikach** `server/src/services` — czyli bezpiecznik widzi **39 %**
rodziny. Rejestr 310 ma **518 wierszy tabeli**, w tym co najmniej **13 wierszy z nazwą tabeli,
która nazwą tabeli nie jest**, i cytuje **93 unikalne pliki migracji, z których 22 runner
pomija**. `markup_multiplier` występuje w migracjach **0 razy**, a w `server/src` — w pięciu
plikach. Odbiór policzył **27 tabel** istniejących na czystej bazie wyłącznie dzięki DDL
w locie. Komendy z §0.3 to sprawdzają.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz
rozbieżność wprost.** To jest sukces dyżuru, nie kłopot.

★★ Dwa ostrzeżenia do samego mierzenia. **(1)** `grep --include` w `zsh` oddaje pustkę zamiast
wyniku; `\b` w `git grep -E` też. **Pustka nie jest wynikiem, dopóki drugą komendą nie
potwierdzisz, że polecenie w ogóle mierzy.** **(2)** Liczba 27 pochodzi z `information_schema`
żywej bazy, a moja lista przykładowa (`mfa_attempts`, `user_consents`, `approved_domains`,
`scim_service_providers`, `user_quotas`, `subscriptions`) **przeczy statycznemu grepowi** —
cztery z tych sześciu MAJĄ plik migracji, tyle że w rodzinie, której runner nie uruchamia.
Ta sprzeczność jest **zamierzona i jest treścią pozycji `R2`**: masz ją rozstrzygnąć pomiarem
i nazwać przyczynę per tabela, a nie wybrać wygodniejszą liczbę.

---

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA, WALIDATOR → TRASA → KONTROLER → SERWIS → REPOZYTORIUM

Każdy plik, którego możesz chcieć dotknąć, ma tu wiersz. **Plik spoza tej tabeli traktujesz
jako TYLKO DO ODCZYTU** i produkujesz zamiast zmiany: czerwony kontrakt testowy + brief
(plik:linia · dlaczego · promień rażenia · jak wyglądałby dowód mutacyjny). Pozycja z takim
produktem jest **ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Bezpiecznik (rdzeń dyżuru)** | `tests/unit/backend/schema/noRuntimeDdl.test.ts` | **★ PEŁNA LICENCJA** w zakresie `R1` i `R5`. Lista wyjątków wolno **wyłącznie skracać**; każde nowe wejście na listę wymaga wiersza w raporcie z uzasadnieniem | — |
| **Bezpiecznik (nowy)** | `tests/unit/backend/schema/*.test.ts` (NOWE pliki) | **★ PEŁNA LICENCJA**, z zastrzeżeniem `Z18` i `Z31`. Nowe pliki w `tests/` wymagają `git add -f` | — |
| **Runner migracji (bramka platformowa)** | `server/scripts/migrate.postgres.ts` | **TYLKO ODCZYT — BEZWZGLĘDNIE.** Predykat pomijania plików (`000_initdb_*`, numer < 500, `sqlite`, `fts5`, `.sql.sql`, `never-ran/`) rozstrzyga, co dostaje KAŻDE środowisko — demo i produkcja też | Czerwony kontrakt + brief. Jeżeli uznasz, że predykat trzeba zmienić — to jest **osobny dyżur**, opisujesz go, nie robisz |
| **Migracje (przedział wyłączny)** | `server/migrations/20261250_day319_*.sql` | **★ PEŁNA LICENCJA** w przedziale **`20261250`–`20261259`**, wyłącznie **addytywne** | — |
| **Migracje (cudze)** | `server/migrations/**` poza Twoim przedziałem | **TYLKO ODCZYT.** Zakaz edycji `000_z_core_baseline.sql`, `000_initdb_*.sql` i czegokolwiek w `never-ran/` | Wpis do rejestru + rekomendacja jako diff w bloku kodu, nienałożony |
| **Trasa** | `server/src/routes/llm.routes.ts` | **★ WĄSKA LICENCJA:** wyłącznie usunięcie DDL w locie i zgodność z kolumną `markup_multiplier` (`R4`). Zakaz zmiany kodów HTTP, kształtu odpowiedzi i uprawnień | Czerwony kontrakt + brief |
| **Kontroler** | `server/src/controllers/ai/LLMController.ts` | **★ WĄSKA LICENCJA:** wyłącznie `R4` — `markup_multiplier` w odczycie i zapisie. Zakaz zmian w logice uprawnień | Czerwony kontrakt + brief |
| **Kontrolery (rodzina DDL)** | `server/src/controllers/**` | **★ PEŁNA LICENCJA** w zakresie `R3` — wyłącznie usuwanie DDL w locie i zamiana cichego `catch` na GŁOŚNY błąd. **Zakaz zmian logiki biznesowej w tym samym commicie** | — |
| **Serwis (narzut LLM)** | `server/src/services/ai/AIPipeline.ts`, `server/src/services/ai/modelRouter.ts`, `server/src/services/ai/llmConfigService.ts` | **★ WĄSKA LICENCJA:** wyłącznie `R4`. `llmConfigService.ts` dodatkowo w zakresie `R3` (dialekt) | Czerwony kontrakt + brief |
| **Serwisy (rodzina DDL)** | `server/src/services/**` | **★ PEŁNA LICENCJA** w zakresie `R3`, na tych samych warunkach co kontrolery | — |
| **Repozytorium / warstwa bazy** | `server/src/database/DatabaseInitializer.ts` (67 wystąpień), `server/src/database/PostgresDatabase.ts` (73 wystąpienia) | **★ WĄSKA LICENCJA:** wolno usunąć DDL w locie **tylko dla tabel, które w `R2` udowodniłeś jako pokryte migracją na PUSTEJ bazie**. `adaptQuery()` — **TYLKO ODCZYT** (prowadzi go inny dyżur) | Czerwony kontrakt + brief |
| **Trasy pomocnicze** | `server/src/routes/testSupport.routes.ts`, `server/src/routes/adminP32.routes.ts`, `server/src/routes/integrations/scim.routes.ts`, `server/src/routes/resultsStrategic.routes.ts` | **★ PEŁNA LICENCJA** w zakresie `R3` | — |
| **Front** | `src/views/admin/AdminLLMMultipliers.tsx` i całe `src/` | **TYLKO ODCZYT.** Mierzysz wyłącznie, **z czego ten ekran czyta** i czy po `R4` ma z czego czytać | Wpis do raportu: czy ekran działa PRZED i PO, z odpowiedzią HTTP |
| **Rejestr 310** | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_SCHEMAT_POZA_MIGRACJAMI_20260903.md` | **★ PEŁNA LICENCJA** w zakresie `R5` — **dopisujesz i prostujesz, nie kasujesz historii**: wiersz śmieciowy dostaje status `ARTEFAKT_PARSERA`, nie znika | — |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA istniejącego wiersza** dotyczącego rodziny „schemat poza migracjami" — dopisujesz stan, nie nadpisujesz | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY319_DDL_ZAKRES_REPORT.md` | `R6` — **JEDYNY nowy dokument, jaki wolno Ci utworzyć** (`Z13`) | — |
| **Cudze tereny** | `tests/unit/backend/security/noRawErrorMessage.test.ts`, `server/src/middleware/appErrorMapper.ts`, `scripts/dev/p0p1-licznik-e1.mjs` | **TYLKO ODCZYT — tereny dyżurów 320 i 321** | Wpis do raportu: plik, linia, problem, **gotowa rekomendacja jako diff w bloku kodu, nienałożony** |

---

## R1 — ZAKRES BEZPIECZNIKA (rdzeń)

Bezpiecznik ma widzieć **całe `server/src`**, nie sam katalog `services`.

Zanim rozszerzysz zakres, **zmierz mianownik**: ile wystąpień DDL leży poza `services`, w jakich
plikach i w ilu. Ta liczba jest wejściem do listy wyjątków — lista wyjątków po rozszerzeniu
będzie duża i **to jest w porządku**, bo długu nie da się spłacić w jednym dyżurze. **Nie jest
w porządku** bezpiecznik, który tego długu nie widzi.

Trzy warunki, każdy sprawdzalny:

1. **Zakres = `server/src`.** Jeśli po pomiarze uznasz, że trzeba szerzej (np. `server/scripts`,
   `server/src/_backup`), rozstrzygasz to **komendą i wpisem w raporcie**, nie domysłem.
   Katalog `server/src/_backup` jest objęty `Z4` — nie czytasz go i nie naprawiasz; jeżeli
   bezpiecznik ma go pomijać, ma to być **jawny wyjątek z komentarzem**, nie przypadek.
2. **Lista wyjątków jest per plik i z liczbą.** Nowe wejście na listę = wiersz w raporcie:
   plik · liczba · dlaczego nie da się dziś usunąć · kto to weźmie.
3. **Bezpiecznik czerwieni się przy DDL w pliku spoza listy — w KAŻDYM podkatalogu.**

**★★ DOWÓD MUTACYJNY — WARUNEK ROZSTRZYGAJĄCY TEJ POZYCJI.** Mutacja **MUSI celować
w zabezpieczenie, nie w mechanizm**, i **MUSI leżeć poza `server/src/services/`**. Wykonujesz
co najmniej **trzy mutacje, każda w innym katalogu**: `server/src/controllers/`,
`server/src/routes/`, `server/src/database/`. Jedna z nich ma być **dosłownie tą, która
przeszła na zielono w odbiorze**: `CREATE TABLE IF NOT EXISTS` w
`server/src/controllers/AssessmentController.ts`. Do raportu wchodzi **wyjście każdej mutacji
dosłownie** — RED przed cofnięciem, GREEN po cofnięciu.

Mutacja, która trafia w plik z listy wyjątków, **nie jest dowodem** — lista wyjątków ma prawo
ją przepuścić. Mutacja w pliku `services/` **nie jest dowodem tej pozycji**, bo dokładnie ten
zakres był już zielony przed dyżurem.

**Wymagany dowód:** wyjście bezpiecznika PRZED rozszerzeniem (zielony) i PO (zielony), plus
trzy pary RED/GREEN z trzech różnych katalogów, plus liczba pozycji na liście wyjątków PRZED
i PO. **Commit po `R1`.**

## R2 — MIANOWNIK NA PUSTEJ BAZIE (rdzeń)

To jest jedyny pomiar, który cokolwiek znaczy, i **nie wolno go zastąpić parserem**.

Kolejność jest wiążąca: **pusty Postgres → pełny łańcuch migracji w trybie strict → drugi
przebieg (idempotencja, bez zmian) → `information_schema` jako mianownik → realne żądanie HTTP**.

1. Kontener stawiasz sam, na swoim porcie, wg `§0.2c` wariant (A). Obraz `pgvector/pgvector:pg16`
   — `postgres:15` nie przejdzie migracji.
2. **Zapisujesz pełną listę tabel z `information_schema.tables`** po samym łańcuchu migracji.
   To jest mianownik A.
3. Uruchamiasz aplikację (`§0.2c` wariant B) tak, żeby DDL w locie miał szansę zadziałać,
   i **ponownie** czytasz `information_schema`. To jest mianownik B.
4. **Różnica B − A to lista tabel istniejących wyłącznie dzięki DDL w locie.** Odbiór policzył
   27. Zmierz swoją liczbę i **wpisz obie**.
5. Dla **każdej** tabeli z różnicy rozstrzygasz przyczynę i wpisujesz ją do rejestru jako
   osobną kolumnę: `BRAK_MIGRACJI` (nie ma pliku nigdzie) albo `MIGRACJA_POMIJANA` (plik jest,
   ale runner go nie uruchamia — wtedy podajesz **nazwę pliku i powód pominięcia**).

★ Przykład, który sam sprawdziłem i który masz potraktować jako pułapkę, a nie jako prawdę:
`mfa_attempts` ma `CREATE TABLE` w `server/migrations/000_initdb_core_tables.sql`, a mimo to
odbiór zaliczył ją do 27. Powód: `000_initdb_*` jest **pomijany** przez runner. To jest
`MIGRACJA_POMIJANA`, nie `BRAK_MIGRACJI`, i naprawia się **inaczej** (nowa migracja addytywna
w Twoim przedziale, **nigdy** przez odblokowanie pominiętego pliku).

**Wymagany dowód:** obie listy `information_schema` jako pliki w katalogu artefaktów z
`shasum -a 256`, wyjście obu przebiegów migracji, tabela różnicowa z kolumną przyczyny.
**Commit po `R2`.**

## R3 — POKRYCIE MIGRACYJNE I USUWANIE DDL (rdzeń)

Dla każdej tabeli z listy `R2`: **migracja addytywna w Twoim przedziale**, a potem usunięcie
odpowiadającego DDL w locie — **w tej kolejności, nie odwrotnie**.

Warunki:

- **Łańcuch od zera po KAŻDEJ grupie.** Migracja, która działa tylko przyrostowo na istniejącej
  bazie, nie jest dowodem — program ma zmierzony przypadek migracji czytającej kolumnę
  dodawaną później alfabetycznie, która wywracała całe odtworzenie.
- **Gdzie DDL zostaje jako strażnik — GŁOŚNY błąd, nigdy cichy `catch`.** Ciche przechwycenie
  nie tylko tworzy schemat poza migracjami; ukrywa fakt, że go nie stworzyło.
- **Commit per grupa tematyczna**, nie jeden commit na koniec. Praca niezacommitowana w worktree
  została raz odczytana przy odbiorze jako „0 z 294 niewykonane" — nie powtórz tego.
- Grupa, której nie zdążysz, **zostaje opisana z nazwy** w raporcie. To jest wynik.

**Wymagany dowód:** dla każdej grupy — wyjście pełnego łańcucha strict od zera (dwa przebiegi),
lista tabel z `information_schema` po grupie, wyjście bezpiecznika z `R1`. **Commit per grupa.**

## R4 — `markup_multiplier` (rdzeń)

Narzut kosztowy LLM nie działa na czystej bazie, bo kolumny `markup_multiplier` nie ma w żadnej
migracji. To zastany defekt — nazywasz go tak wprost i **nie przypisujesz go dyżurowi 310**.

1. Zmierz, gdzie kolumna powstaje dziś (DDL w locie) i kto ją czyta: `AIPipeline.ts`,
   `modelRouter.ts`, `LLMController.ts`, `llm.routes.ts`, plus ekran `AdminLLMMultipliers.tsx`.
2. Migracja addytywna w Twoim przedziale — kolumna z sensowną wartością domyślną, spójną
   z tym, co dziś robi kod (`AIPipeline.ts` opisuje kolejność: kolumna → zmienna środowiskowa
   → wartość domyślna; **odczytaj tę kolejność, nie zgaduj jej**).
3. **Dowód produktowy, nie sam SQL:** na PUSTEJ bazie po pełnym łańcuchu — realne żądanie HTTP
   do trasy, z której czyta ekran administracyjny, PRZED migracją i PO. Kod i ciało odpowiedzi
   dosłownie w raporcie.
4. **Zakaz zmiany domyślnego narzutu jako „przy okazji".** Zmiana wartości domyślnej to zmiana
   cennika — jeżeli uważasz, że dzisiejsza jest zła, wpisujesz to jako znalezisko i zostawiasz.

**Wymagany dowód:** para żądań HTTP PRZED/PO z kodem i ciałem, wyjście `information_schema.columns`
dla `llm_providers` PRZED/PO. **Commit po `R4`.**

## R5 — CZYSZCZENIE REJESTRU (rdzeń)

Rejestr 310 ma dziś dwa rodzaje fałszu i oba naprawiasz **przez dopisanie kolumny i statusu,
nigdy przez skasowanie wiersza**:

1. **Wiersze śmieciowe z parsera** — nazwa tabeli, która nazwą tabeli nie jest (`is`, `and`,
   `for`, `in`, `below`, `jest`, `pass`, `w`, `won`, `...`). Status `ARTEFAKT_PARSERA`,
   z komendą, którą je wykryłeś, i z liczbą.
2. **Fałszywe trafienia kolumny „Migracja"** — plik istnieje, ale runner go nie uruchamia.
   Status `MIGRACJA_POMIJANA` plus nazwa reguły pominięcia. Mój pomiar: 22 z 93 unikalnych
   plików cytowanych w tej kolumnie.
3. Nagłówek rejestru dostaje **jawny mianownik z `R2`** (`information_schema`, nie parser)
   i zdanie o tym, że kolumna „Migracja" była liczona statycznie.

**Wymagany dowód:** komenda wykrywająca wiersze śmieciowe z wynikiem liczbowym, komenda
wykrywająca pliki pomijane z wynikiem liczbowym, `git diff --stat` rejestru. **Commit po `R5`.**

## R6 — DOWÓD KOŃCOWY I RAPORT

Na **PUSTEJ** bazie, postawionej wyłącznie z łańcucha migracji:

- pełna lista tabel z `information_schema` — porównana z listą z `R2`;
- **realne żądanie `POST /api/auth/register` przez `ApiGateway`** z kodem i ciałem. Odbiór
  dostał 200; **Twój wynik jest wiążący, jakikolwiek będzie**;
- po jednym realnym żądaniu HTTP do trasy z pięciu różnych modułów, z kodem i ciałem;
- bezpiecznik z `R1` na zielono, z trzema parami mutacji dosłownie.

Raport zawiera: tabelę PRZED/PO liczb DDL, listę funkcji, które **nigdy nie działały na czystej
bazie** (to są znaleziska, nie Twoje regresje — masz je nazwać, nie ukryć), listę rozbieżności
wobec liczb tej instrukcji, i **niepustą sekcję „TWIERDZENIA NIEZWERYFIKOWANE"**.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem i pushem. Zdanie: „zakres bezpiecznika
rozszerzony na całe `server/src` i udowodniony trzema mutacjami poza `services/`, mianownik
zmierzony na pustej bazie przez `information_schema`, 14 z 27 tabel dostało migracje, reszta
wypisana z nazwy i przyczyny, `markup_multiplier` naprawiony i pokazany żądaniem HTTP, rejestr
oczyszczony" — **jest pełnowartościowym wynikiem**.

Zdanie „DDL usunięty" postawione na bezpieczniku, który nie umie go zobaczyć poza jednym
katalogiem, **nie jest warte nic — i dokładnie to już raz przeszło**.

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym (zajęty port, brak dysku, cudzy kontener) i
wracasz do niego później: **sprawdzasz warunek NA BIEŻĄCEJ LINII, nie ponownie na starym
markerze i nie na zapamiętanym wyniku**. Dyżur 300 przez to stał dobę po ustaniu blokady.
Wynik ponownego sprawdzenia wklejasz do raportu z datą i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Nietykalny runner migracji" (`Z12`) vs „daj pokrycie tabelom z pominiętych plików" | Tabela licencji, wiersz „Runner migracji": pokrycie robisz **nową migracją addytywną w swoim przedziale**, nigdy odblokowaniem pominiętego pliku |
| „Nie czytasz `server/src/_backup`" (`Z4`) vs „bezpiecznik skanuje całe `server/src`" | `R1` punkt 1: `_backup` ma być **jawnym wyjątkiem z komentarzem** w bezpieczniku; nie otwierasz tych plików |
| „Bezpiecznik ma się czerwienić przy DDL" vs „lista wyjątków po rozszerzeniu urośnie" | `R1` punkt 2: lista wyjątków jest **dozwolona i wymagana**, ale każde wejście ma wiersz w raporcie; wolno ją **wyłącznie skracać** w kolejnych dyżurach |
| „Zero zmian w `src/`" vs „`R4` ma dowieść, że ekran działa" | Tabela licencji, wiersz „Front": ekran jest **mierzony żądaniem HTTP**, nie zmieniany |
| „Teza o rejestracji z dyżuru 310" vs „sprostowanie" | Sekcja SPROSTOWANIE i `R6`: teza jest obalona, wiążący jest **Twój pomiar**, nie cudza teza |
| „Usuń DDL w locie" vs „nie zmieniaj logiki biznesowej" | Tabela licencji, wiersze „Kontrolery"/„Serwisy": usunięcie DDL i zmiana logiki **nie mogą być w jednym commicie** |
