# INSTRUKCJA DYŻURU nr 320 — Codex — „★★★ LICZNIK P0/P1 REGUŁY E1 MA PRZESTAĆ BYĆ POMIAREM, A STAĆ SIĘ BRAMKĄ — TO JEST DYŻUR, OD KTÓREGO ZALEŻY ZAMKNIĘCIE G20: odbiór adwersaryjny 04.09 POTWIERDZIŁ rdzeń narzędzia z dyżuru 301 (`BLOKUJE = 25` odtworzone niezależnie na dwóch stanach repo, wygenerowany rejestr bajtowo identyczny z tym w repo, 5 z 5 mutacji zabezpieczeń czerwieni dokładnie jeden test, licznik liczy OBIEKTY, a nie różnicę dwóch rejestrów), ale jako bramka narzędzie nie działa w pięciu miejscach: skrypt kończy `exit 0` także przy `BLOKUJE = 25`; `grep` po `.github/`, `scripts/` i `package.json` daje ZERO wołaczy, więc G20 zamyka dziś człowiek czytający plik; `MARKER` i `SNAPSHOT_DATE` są zaszyte jako stałe, więc przebieg za trzy miesiące będzie nieodróżnialny od dzisiejszego; skrypt jest OSTRZEJSZY niż deklarowana reguła E1 — „25” to 13 `NIEROZSTRZYGNIETE` plus 12 `BRAK_SHA_DLA_NAPRAWIONE`, a §R3 raportu 301 mówi, że `NAPRAWIONE` nie blokują; proza raportu §R6 fałszywie nazywa blokującymi cztery pozycje (`MYW-PHOTO-003`/`-010` = `ODLOZONE_DEC`, `-005`/`-011` = `ZAMKNIETE_DEC`) — rację ma wygenerowany rejestr, myli się proza. ★ Osobno: 22 z 96 werdyktów „nie blokuje” wisi na dziedziczeniu decyzji DEC z rodziny `## R-N.`; bez niego `BLOKUJE` skacze 25 → 47 — mechanizm jest merytorycznie poprawny, ale ma być JAWNIE UDOKUMENTOWANY I OTESTOWANY, a nie ukryty w heurystyce."

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
> **wyłącznie** `/private/tmp/cx-day320-licznik-g20`.

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
Zakres: ****PRZEKROJOWE — NARZĘDZIA PROGRAMU I BRAMKA CI (bez produktu).** Rdzeń: `scripts/dev/p0p1-licznik-e1.mjs` (dyżur 301), jego pakiet testowy `scripts/dev/__tests__/p0p1-licznik-e1.test.mjs` (5 testów, runner `node --test`, NIE `vitest`) oraz wygenerowany rejestr `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md`. Pięć źródeł wejściowych (wszystkie TYLKO DO ODCZYTU) wymienia funkcja `pathsFor()` w skrypcie: `ROZLICZENIE_P0P1_20260903.md`, `ROZLICZENIE_P0P1_DECYZJE_20260903.md`, `docs/program/DECYZJE_WLASCICIELA_P0P1_20260904.md`, `docs/program/FALA_2_PO_STAGINGU.md`, `OWNER_DECISION_LEDGER_2026-08-24.md`. Bramka CI dochodzi w `.github/workflows/test-suite.yml`, w istniejącym zadaniu `lint-typecheck`, obok bramek zapadkowych `check:colors`, `check:list-canon`, `check:artefakt`, `check:triada:all`, `verify:canonical-16`. **Ten dyżur nie dotyka ani jednej linii produktu** — ani `server/src`, ani `src`.**.
Trasy front: `**Brak — ten dyżur nie zmienia i nie mierzy niczego w `src/`.**`. Trasy tył: ``scripts/dev/p0p1-licznik-e1.mjs` (rdzeń: `MARKER = '416432abaf'` i `SNAPSHOT_DATE = '2026-09-04'` jako stałe; `classify()` z pięcioma werdyktami; `addOwnerEvidence()` z dziedziczeniem DEC po nagłówku `## R-N.`; `renderRegister()` składający nagłówek; blok uruchomieniowy na końcu pliku, który **nie ustawia kodu wyjścia**) · `scripts/dev/__tests__/p0p1-licznik-e1.test.mjs` (5 testów mutacyjnych, `node --test`) · `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md` (produkt skryptu — nie edytujesz go ręcznie) · `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY301_LICZNIK_P0P1_E1_REPORT.md` (§R3 deklaruje regułę E1, §R6 niesie prozę do sprostowania) · `.github/workflows/test-suite.yml` (zadanie `lint-typecheck`) · `package.json` (sekcja `scripts`, konwencja `check:*`) · pięć dokumentów wejściowych wymienionych w `pathsFor()` — **wszystkie tylko do odczytu**.`.

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
WT=/private/tmp/cx-day320-licznik-g20
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
git -C "$VAULT" worktree add "$WT" -b codex/day320-licznik-g20-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day320-licznik-g20/config.worktree"
cat "$VAULT/worktrees/cx-day320-licznik-g20/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day320-licznik-g20-scratch
mkdir -p /private/tmp/cx-day320-licznik-g20-artefakty

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
git -C "$WT" push github-backup codex/day320-licznik-g20-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only bc18bc7acac2ec825ebb3db2f1309738ab034d58..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `6` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA: skrypt konczy exit 0 MIMO 25 pozycji blokujacych
node scripts/dev/p0p1-licznik-e1.mjs > /dev/null 2>&1; echo "kod wyjscia = $?"
grep -n "BLOKUJE:" docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md | head -2
git diff --stat -- docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md
#   moje liczby: kod wyjscia 0; naglowek "**BLOKUJE: 25**"; git diff PUSTY (rejestr w repo jest
#   bajtowo identyczny z wygenerowanym — to jest potwierdzony rdzen narzedzia, nie defekt).
#   ★ Ta komenda NADPISUJE plik rejestru. Po pomiarze przywroc go: git checkout -- <ten plik>.

# (2) TEZA: 25 to 13 NIEROZSTRZYGNIETE + 12 BRAK_SHA_DLA_NAPRAWIONE
node scripts/dev/p0p1-licznik-e1.mjs 2>/dev/null \
  | awk -F'|' '/^\| `/ {gsub(/ /,"",$3); gsub(/ /,"",$4); if($3=="BLOKUJE") print $4}' | sort | uniq -c
node scripts/dev/p0p1-licznik-e1.mjs 2>/dev/null | grep -c '^| `'
git checkout -- docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md
#   moje liczby: 13 NIEROZSTRZYGNIETE, 12 BRAK_SHA_DLA_NAPRAWIONE, mianownik 121 pozycji.
#   ★ Porownaj to z §R3 raportu 301, ktory deklaruje, ze NAPRAWIONE nie blokuja. To jest tabela z R1.

# (3) TEZA: pakiet testowy dziala przez node --test, a NIE przez vitest
node --test scripts/dev/__tests__/p0p1-licznik-e1.test.mjs 2>&1 | tail -8
grep -c "^test(" scripts/dev/__tests__/p0p1-licznik-e1.test.mjs
#   oczekiwane: 5 testow, 5 pass, 0 fail. ★ Nie uruchamiaj tego przez vitest —
#   dostaniesz "No test files found", a to NIE jest PASS (§0.2c).

# (4) TEZA: ZERO wolaczy skryptu w CI, skryptach i package.json
grep -rn "p0p1-licznik-e1" .github/ scripts/ package.json 2>/dev/null | grep -v "scripts/dev/p0p1-licznik-e1.mjs" | grep -v "scripts/dev/__tests__" | wc -l
grep -n "MARKER = \|SNAPSHOT_DATE = " scripts/dev/p0p1-licznik-e1.mjs
tail -5 scripts/dev/p0p1-licznik-e1.mjs
#   moje liczby: 0 wolaczy; MARKER i SNAPSHOT_DATE zaszyte jako stale;
#   blok uruchomieniowy na koncu pliku pisze rejestr na stdout i NIE ustawia kodu wyjscia.

# (5) TEZA: dziedziczenie DEC z rodziny `## R-N.` odpowiada za 22 z 96 werdyktow "nie blokuje"
grep -n "addOwnerEvidence\|activeFamily\|familyDec" scripts/dev/p0p1-licznik-e1.mjs
grep -cE "^##\s+R-[0-9]+\." docs/program/DECYZJE_WLASCICIELA_P0P1_20260904.md
#   oczekiwane: funkcja addOwnerEvidence() buduje mape rodzina -> DEC i dokleja ja do KAZDEJ linii
#   pod naglowkiem `## R-N.`. ★ Moj pomiar: wylaczenie tego mechanizmu podnosi BLOKUJE z 25 na 47.
#   ZMIERZ TO SAM (tymczasowa mutacja lokalna, cofnieta przed commitem) — to jest wejscie do R5.

# (6) TEZA: zasoby wolne i miejsce dla bramki CI istnieje
lsof -nP -iTCP:5476 -sTCP:LISTEN; lsof -nP -iTCP:6336 -sTCP:LISTEN
docker ps --format "{{.Names}}" | grep -c cx-day320 || true
grep -n "lint-typecheck\|npm run check:" .github/workflows/test-suite.yml | head -12
df -h /
#   oczekiwane: puste lsof, 0 kontenerow; zadanie `lint-typecheck` z seria krokow `npm run check:*`
#   — tam dokladasz swoj krok. Ponizej 5 GB wolnego to STOP calosci (§0.5).
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day320-licznik-g20-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6336`. Twój JEDYNY port harnessu to `5476`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day320-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta listy restricted ports Chromium. Zajęte przez inne prace (nie ruszasz): 3020, 3022, 3025, 3027, 3030 (tor grafiki nadzorcy), 5322, 5410-5441 (agenci nadzorcy), 5442-5458 oraz 6311-6322 (odbiorcy nadzorcy), 5432 i 5433 (Postgres hosta), 6012, 6379 (redis), 7000, 7679, 7768, 11434. Cudze — dyżury 286-318 (bazy 6290-6334, harness 5250-5474). Dyżury równoległe tej serii: 319 (baza 6335, harness 5475, kontener cx-day319-pg), 320 (baza 6336, harness 5476, kontener cx-day320-pg), 321 (baza 6337, harness 5477, kontener cx-day321-pg) — do CUDZEJ bazy nie łączysz się nawet do odczytu. Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps. ★ ZAKAZ `pkill`/`killall` na `node`, `vite`, `playwright` — zabijasz wyłącznie własne PID-y (zapisz `$!`).`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak — ten dyżur nie wprowadza ani jednej nowej flagi funkcyjnej i nie zmienia wartości domyślnej żadnej istniejącej`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``.github/workflows/day161-fresh-migration-gate.yml`, `security-scan.yml`, `railway-deploy.yml`, `e2e-nightly.yml`, `e2e-weekly.yml`, `i18n-check.yml`, `module-contract-rerun.yml`, `recovery-ownership-gate.yml`, `domain-closure-smoke.yml` — **tylko odczyt, czytasz je jako wzór** · pięć dokumentów wejściowych licznika (`pathsFor()`), w szczególności `docs/program/DECYZJE_WLASCICIELA_P0P1_20260904.md`, które są słowami właściciela · `tests/unit/backend/schema/noRuntimeDdl.test.ts` i `server/scripts/migrate.postgres.ts` (teren dyżuru 319) · `tests/unit/backend/security/noRawErrorMessage.test.ts` i `server/src/middleware/appErrorMapper.ts` (teren dyżuru 321) · `scripts/check-list-canon.sh` i `scripts/check-artefakt.sh` (hooki; nie omijaj). ★ WYJĄTKI wymienione imiennie w tabeli licencji: **jeden dodany krok** w zadaniu `lint-typecheck` pliku `.github/workflows/test-suite.yml` oraz **jeden dodany wpis** w sekcji `scripts` pliku `package.json``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY320_LICZNIK_G20_REPORT.md`. Dozwolona AKTUALIZACJA (dopisanie, nigdy skasowanie) dwóch istniejących dokumentów: sprostowanie w §R6 pliku `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY301_LICZNIK_P0P1_E1_REPORT.md` (dopisane OBOK oryginalnego zdania, z datą i komendą) oraz wiersza dotyczącego licznika P0/P1 w `docs/program/REJESTR_ZNALEZISK_20260903.md`. Plik `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md` zmienia się WYŁĄCZNIE jako produkt uruchomienia skryptu — ręczna edycja jest zakazana. Nowe pliki w `scripts/` i `tests/` wymagają `git add -f`. **ZAKAZ edycji `MODULE_ACCEPTANCE.md` — ten dyżur jest przekrojowy**. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day320-licznik-g20-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day320-licznik-g20-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ ręcznej edycji `REJESTR_P0P1_BLOKUJACE_G20.md`** — plik zmienia się WYŁĄCZNIE jako produkt uruchomienia skryptu. **ZAKAZ jakiejkolwiek zmiany pięciu dokumentów wejściowych** wymienionych w `pathsFor()`, w szczególności `docs/program/DECYZJE_WLASCICIELA_P0P1_20260904.md` — to są słowa właściciela. **ZAKAZ obniżania liczby `BLOKUJE` przez przeniesienie pozycji do innego kubełka** bez rozstrzygnięcia obiektu i bez wiersza w tabeli decyzji. **ZAKAZ osłabiania pięciu istniejących testów** — dodawać wolno zawsze, zmieniać istniejącą asercję wolno wyłącznie razem z jawnym wpisem o zmianie kontraktu. **ZAKAZ `continue-on-error`, warunków `if:` wygaszających krok i progów tolerancji w bramce CI.** **ZAKAZ tworzenia nowego pliku workflow** — dokładasz jeden krok do istniejącego zadania `lint-typecheck`. **ZAKAZ zmiany wyzwalaczy, uprawnień, wersji Node i pozostałych kroków `test-suite.yml`.** **ZAKAZ zmiany zależności i wersji w `package.json`** — dokładasz dokładnie jeden wpis w sekcji `scripts`. **ZAKAZ usunięcia dziedziczenia DEC** — masz je udokumentować i otestować, nie skasować. **ZAKAZ nadpisywania prozy raportu 301** — sprostowanie staje OBOK, z datą i komendą. **ZAKAZ dotykania `server/src` i `src`** — ten dyżur nie zmienia produktu. **ZAKAZ `git stash`, `pkill`, `killall`, `--no-verify`.** **ZAKAZ dotykania demo, stagingu i produkcji.** **ZAKAZ edycji `MODULE_ACCEPTANCE.md`.** | Bramka G20 („zero otwartych P0/P1”) jest dziś zamykana przez człowieka, który czyta plik. Narzędzie, które miało to zautomatyzować, mierzy poprawnie — i kończy się kodem zero przy 25 pozycjach blokujących, nikt go nie woła, a jego nagłówek za trzy miesiące będzie wyglądał identycznie jak dziś. To jest dokładnie ten kształt, który program ma zapisany dwa razy: „bezpiecznik, który nigdy nie mógł przejść” i „dowód poza repo wyparowuje” — narzędzie istnieje, wynik istnieje, a łańcuch od wyniku do decyzji jest przerwany. Do tego proza raportu 301 przeczy własnemu rejestrowi w czterech pozycjach, a skrypt jest ostrzejszy niż reguła, którą deklaruje. Dopóki tak jest, każde zdanie „G20 zamknięta” będzie oparte na czyjejś lekturze, a nie na przebiegu. |

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
cd /private/tmp/cx-day320-licznik-g20

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day320-pg psql -U postgres -d cx320 \
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
cd /private/tmp/cx-day320-licznik-g20

docker run -d --name cx-day320-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx320 \
  -p 127.0.0.1:6336:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day320-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6336/cx320 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6336/cx320 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day320-licznik-g20 && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6336/cx320 \
JWT_SECRET=cx320-test-secret-do-podpisu-tokenow-w-tym-dyzurze \
npx vitest run scripts/dev/__tests__/p0p1-licznik-e1.test.mjs --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day320-licznik-g20-artefakty/day320-licznik-e1.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day320-licznik-g20 && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run scripts/dev/__tests__/p0p1-licznik-e1.test.mjs --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day320-licznik-g20-artefakty/day320-licznik-e1.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day320-licznik-g20/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day320-pg psql -U postgres -d cx320 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day320-pg`.
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
> **(e) ★★★ SIEDEM PUŁAPEK TEGO DYŻURU. **(1) Pakiet testowy NIE jest pakietem `vitest`.** Uruchamia go `node --test scripts/dev/__tests__/p0p1-licznik-e1.test.mjs`. `vitest` odda `No test files found`, a to NIE jest `PASS` (`§0.2c`). **(2) Bramka bez wołacza nie jest bramką.** Zmierzone: zero wołaczy w `.github/`, `scripts/` i `package.json`. Dodanie kodu wyjścia bez dodania kroku CI zostawia stan sprzed dyżuru. **(3) Duży push pomija workflow z filtrem `paths` W CISZY.** Program ma zmierzony przypadek: push około tysiąca commitów nie wyzwolił workflow, a obserwator zameldował zielone ze STAREGO przebiegu. Przeczytaj wyzwalacze `test-suite.yml` i wpisz do raportu, na co reaguje. **(4) Bramka będzie dziś CZERWONA i to jest zamierzone.** Nie obchodzisz tego progiem, `continue-on-error` ani warunkiem `if:`. **(5) Liczba, która spadła bez rozstrzygnięcia obiektów, to rozjazd rejestrów, nie postęp.** Przeniesienie 12 pozycji `BRAK_SHA` do innego kubełka po to, żeby `BLOKUJE` zmalało, jest podstawą odrzucenia pozycji. **(6) Dziedziczenie DEC to oś nośna wyniku.** 22 z 96 werdyktów „nie blokuje” od niego zależy; bez niego 25 → 47. Jest merytorycznie poprawne (sprawdzone ręcznie na rodzinach `R-7` i `R-8`) — i właśnie dlatego ma być udokumentowane i otestowane, a nie ukryte. **(7) Brak pomiaru nie jest wynikiem.** Bezpiecznik, który przechodzi, bo nie miał czego zmierzyć (pusty korpus, brak pliku, podłoga liczebności), niczego nie pilnuje — `evaluateCorpus()` ma już podłogę `DEFAULT_FLOOR`; sprawdź, czy Twoja bramka nie da się przejść w ten sam sposób.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day320-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day320-licznik-g20-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (``R1`, `R2`, `R3`, `R6``) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6336` albo `5476` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6336` albo `5476`** (`Z7`).

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

Dyżur 301 zbudował `scripts/dev/p0p1-licznik-e1.mjs` — narzędzie, które z pięciu dokumentów
rozliczeniowych składa jeden rejestr pozycji P0/P1 i wystawia werdykt per pozycja. Odbiór
adwersaryjny 04.09 **potwierdził rdzeń**, i to mocno:

- liczba `BLOKUJE = 25` odtworzyła się **niezależnie na dwóch różnych stanach repozytorium**;
- wygenerowany rejestr jest **bajtowo identyczny** z tym, który leży w repo (`git diff` pusty);
- **5 z 5 mutacji zabezpieczeń** czerwieni **dokładnie jeden** test — bezpiecznik jest celny,
  nie przypadkowy;
- licznik liczy **OBIEKTY** (pozycje z korpusu), a nie różnicę dwóch rejestrów. To jest
  dokładnie ta pułapka, którą program ma zapisaną jako „dwa rejestry — licznik mierzy rozjazd",
  i licznik w nią **nie wpadł**.

To jest dobre narzędzie pomiarowe. **Bramką nie jest — i o to chodzi w tym dyżurze.**

Bramka G20 („zero otwartych P0/P1") jest dziś zamykana **przez człowieka, który czyta plik**.
Pięć rzeczy stoi na drodze:

1. **Skrypt kończy `exit 0` także przy `BLOKUJE = 25`.** Zmierzone: `node scripts/dev/p0p1-licznik-e1.mjs`
   → kod wyjścia `0`, rejestr z nagłówkiem `**BLOKUJE: 25**`. CI, które by go zawołało, byłoby zielone.
2. **Nikt go nie woła.** `grep` po `.github/`, `scripts/` i `package.json` daje **zero wołaczy**.
3. **`MARKER` i `SNAPSHOT_DATE` są zaszyte jako stałe** (`MARKER = '416432abaf'`,
   `SNAPSHOT_DATE = '2026-09-04'`). Przebieg za trzy miesiące wypisze **ten sam nagłówek** i będzie
   **nieodróżnialny od dzisiejszego**. To jest wprost kształt „dowód poza repo wyparowuje",
   tylko w drugą stronę: dowód, który nie wie, kiedy powstał.
4. **Skrypt jest OSTRZEJSZY niż reguła, którą deklaruje.** `25` to **13 `NIEROZSTRZYGNIETE`
   + 12 `BRAK_SHA_DLA_NAPRAWIONE`**. Raport dyżuru 301 w §R3 mówi, że pozycje `NAPRAWIONE`
   nie blokują — a 12 pozycji ląduje w `BLOKUJE` **wyłącznie za brak cytatu SHA**.
   Albo skrypt ma się zgadzać z regułą E1, albo reguła ma zostać zmieniona **świadomie i na piśmie**.
   Dziś nie zgadza się ani jedno, ani drugie.
5. **Proza raportu §R6 kłamie o czterech pozycjach.** Nazywa blokującymi `MYW-PHOTO-003`,
   `MYW-PHOTO-005`, `MYW-PHOTO-010` i `MYW-PHOTO-011`, podczas gdy wygenerowany rejestr daje im
   `ODLOZONE_DEC` (003, 010) i `ZAMKNIETE_DEC` (005, 011). **Rację ma rejestr, myli się proza.**

Do tego jedna rzecz, która **nie jest defektem, ale jest osią nośną liczby i nie wolno jej
zostawić w heurystyce**: **22 z 96 werdyktów „nie blokuje" wisi na dziedziczeniu decyzji DEC
z rodziny `## R-N.`** w dokumencie decyzji właściciela. Bez tego dziedziczenia `BLOKUJE`
skacze **25 → 47**. Odbiór sprawdził dziedziczenie ręcznie na rodzinach `R-7` i `R-8` i uznał
je za **merytorycznie poprawne**. Ale mechanizm, od którego zależy prawie połowa różnicy
w wyniku bramki, **ma być jawnie udokumentowany i otestowany**, a nie ukryty w dwóch pętlach
funkcji pomocniczej.

## ★ Zmierz moje liczby sam

Twierdzę: `node scripts/dev/p0p1-licznik-e1.mjs` kończy się **kodem 0** i wypisuje
**`BLOKUJE: 25`**, na które składa się **13 `NIEROZSTRZYGNIETE`** i **12
`BRAK_SHA_DLA_NAPRAWIONE`**; mianownik to **121 pozycji**; pakiet
`scripts/dev/__tests__/p0p1-licznik-e1.test.mjs` ma **5 testów i wszystkie przechodzą**
(uruchamiany przez `node --test`, **nie** przez `vitest`); wołaczy skryptu w `.github/`,
`scripts/` i `package.json` jest **0**; wyłączenie dziedziczenia DEC podnosi `BLOKUJE`
z **25 na 47**. Komendy z §0.3 to sprawdzają.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz
rozbieżność wprost.**

★★ Jedno ostrzeżenie: pakiet testowy tego narzędzia **nie jest pakietem `vitest`**.
Uruchomienie go przez `vitest` da `No test files found`, **a to NIE jest `PASS`** (`§0.2c`).
Właściwy runner to `node --test scripts/dev/__tests__/p0p1-licznik-e1.test.mjs`.
To narzędzie nie dotyka bazy — pracujesz w wariancie (C) z `§0.2c`. Kontener stawiasz
**tylko wtedy**, gdy Twoja bramka CI ma realnie przejść pełny przebieg; jeśli nie — zapisujesz
w raporcie, że baza nie była potrzebna, i **nie udajesz dowodu bazodanowego**.

---

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA, WEJŚCIE → PARSER → KLASYFIKATOR → RENDER → BRAMKA CI

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany:
czerwony kontrakt testowy + brief. Pozycja z takim produktem jest **ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Narzędzie (rdzeń)** | `scripts/dev/p0p1-licznik-e1.mjs` | **★ PEŁNA LICENCJA** w zakresie `R2`–`R6`. Zakaz zmiany semantyki werdyktów bez wiersza w tabeli decyzji raportu | — |
| **Bezpiecznik narzędzia** | `scripts/dev/__tests__/p0p1-licznik-e1.test.mjs` | **★ PEŁNA LICENCJA**: wolno **dodawać** testy. Istniejące 5 testów **wolno zmienić wyłącznie razem z jawnie opisaną zmianą kontraktu** — usunięcie asercji bez takiego wpisu = odrzucenie pozycji | — |
| **Wejście: rozliczenie** | `docs/program/waves/WAVE_03_ACCEPTANCE/ROZLICZENIE_P0P1_20260903.md` | **TYLKO ODCZYT** | Wpis do raportu + rekomendacja jako diff, nienałożony |
| **Wejście: decyzje** | `docs/program/waves/WAVE_03_ACCEPTANCE/ROZLICZENIE_P0P1_DECYZJE_20260903.md` | **TYLKO ODCZYT** | jak wyżej |
| **Wejście: decyzje właściciela** | `docs/program/DECYZJE_WLASCICIELA_P0P1_20260904.md` | **TYLKO ODCZYT — BEZWZGLĘDNIE.** To są słowa właściciela; nie „poprawiasz" ich, żeby licznik ładniej policzył | jak wyżej |
| **Wejście: fala 2** | `docs/program/FALA_2_PO_STAGINGU.md` | **TYLKO ODCZYT** | jak wyżej |
| **Wejście: rejestr decyzji** | `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` | **TYLKO ODCZYT** | jak wyżej |
| **Wyjście: rejestr** | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md` | **★ PEŁNA LICENCJA — ale wyłącznie jako PRODUKT SKRYPTU.** Ręczna edycja tego pliku jest zakazana; jedyny dopuszczalny sposób zmiany to uruchomienie skryptu | — |
| **Bramka CI** | `.github/workflows/test-suite.yml` | **★ WĄSKA LICENCJA:** wyłącznie **dodanie jednego kroku** w istniejącym zadaniu `lint-typecheck`, obok pozostałych bramek zapadkowych. Zakaz zmiany wyzwalaczy, uprawnień, wersji Node i pozostałych kroków | Czerwony kontrakt + brief |
| **Bramka CI (alternatywa)** | `.github/workflows/day161-fresh-migration-gate.yml` i pozostałe workflow | **TYLKO ODCZYT** — czytasz je jako wzór, nie zmieniasz | Brief w raporcie |
| **Wołacz `npm`** | `package.json` (sekcja `scripts`) | **★ WĄSKA LICENCJA:** wyłącznie dodanie **jednego** wpisu w konwencji istniejących bramek (`check:*`). Zakaz zmiany zależności, wersji i pozostałych skryptów | Czerwony kontrakt + brief |
| **Raport 301** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY301_LICZNIK_P0P1_E1_REPORT.md` | **★ WĄSKA LICENCJA:** wyłącznie `R6` — **sprostowanie dopisane, nie nadpisane**. Oryginalne zdanie zostaje, obok niego staje sprostowanie z datą i komendą | — |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA istniejącego wiersza** dotyczącego licznika P0/P1 — dopisujesz stan, nie kasujesz historii | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY320_LICZNIK_G20_REPORT.md` | `R7` — **JEDYNY nowy dokument, jaki wolno Ci utworzyć** (`Z13`) | — |
| **Cudze tereny** | `tests/unit/backend/schema/noRuntimeDdl.test.ts`, `server/scripts/migrate.postgres.ts`, `tests/unit/backend/security/noRawErrorMessage.test.ts`, `server/src/middleware/appErrorMapper.ts` | **TYLKO ODCZYT — tereny dyżurów 319 i 321** | Wpis do raportu: plik, linia, problem, **gotowa rekomendacja jako diff w bloku kodu, nienałożony** |

---

## ★★ ROZSTRZYGNIĘCIE WOBEC `§0.2c` — WARIANT (B) NIE DOTYCZY TEGO DYŻURU

`§0.2c` jest wklejany do każdej instrukcji dosłownie i jego wariant (B) pokazuje uruchomienie
pakietu testowego przez `npx vitest`. **W tym dyżurze wariant (B) NIE MA ZASTOSOWANIA** i nie
jest sprzecznością do rozstrzygania przez Ciebie — rozstrzygam ją tutaj:

- pakiet `scripts/dev/__tests__/p0p1-licznik-e1.test.mjs` używa runnera `node:test`, więc
  właściwa komenda brzmi **`node --test scripts/dev/__tests__/p0p1-licznik-e1.test.mjs`**;
- uruchomienie go przez `vitest` odda `No test files found`, **a to NIE jest `PASS`**;
- ten dyżur **nie dotyka bazy danych**. Domyślnie pracujesz w wariancie **(C)**
  (`RUN_DB_TESTS=0 MOCK_DB=true`) i **nie stawiasz kontenera**.
- Kontener z wariantu (A) stawiasz **wyłącznie wtedy**, gdy zdecydujesz, że Twoja bramka CI
  musi przejść pełny przebieg lokalnie. Jeżeli go nie stawiasz — **wpisujesz do raportu, że baza
  nie była potrzebna**, i nie udajesz dowodu bazodanowego. Brak pomiaru nie jest wynikiem, ale
  pomiar niepotrzebny nie jest dowodem.

Twoje porty i nazwa kontenera pozostają zarezerwowane niezależnie od tego, czy ich użyjesz —
nie oddajesz ich innemu dyżurowi i nie bierzesz cudzych.

---

## R1 — POMIAR I ZGODNOŚĆ Z REGUŁĄ E1 (rdzeń)

Zanim cokolwiek zmienisz, ustal **własny** stan wejściowy i **własny** mianownik:

- kod wyjścia i pełne wyjście `node scripts/dev/p0p1-licznik-e1.mjs`;
- mianownik (ile pozycji), rozkład wszystkich pięciu werdyktów, rozkład **powodów** wewnątrz
  `BLOKUJE`;
- wynik `node --test scripts/dev/__tests__/p0p1-licznik-e1.test.mjs`;
- liczba wołaczy skryptu w `.github/`, `scripts/`, `package.json`.

Potem **jedna tabela, która jest sednem pozycji**: *reguła E1, jak jest zadeklarowana* obok
*co skrypt faktycznie robi*, wiersz na każdy werdykt. Kolumna trzecia: `ZGODNE` /
`SKRYPT_OSTRZEJSZY` / `SKRYPT_ŁAGODNIEJSZY`, z cytatem linii kodu i cytatem zdania deklaracji.

**Wymagany dowód:** wszystkie cztery pomiary dosłownie + tabela zgodności. **Commit po `R1`.**

## R2 — EXIT ≠ 0 PRZY `BLOKUJE > 0` (rdzeń)

Skrypt ma **kończyć się kodem niezerowym**, gdy `BLOKUJE > 0`, i **kodem 0**, gdy `BLOKUJE = 0`.

Trzy warunki:

1. Kod wyjścia liczony z **rzeczywistej liczby**, nie z progu zaszytego w kodzie.
2. **Tryb informacyjny musi istnieć** — przełącznik, który generuje rejestr **bez** czerwienienia
   (potrzebny do samego odświeżania rejestru). Domyślnie **bramka jest włączona**; luźny tryb
   jest opcją, którą trzeba podać jawnie, nigdy odwrotnie.
3. Komunikat na `stderr` mówi **ile** pozycji blokuje i **gdzie** leży rejestr.

**★★ DOWÓD MUTACYJNY.** Mutacja celuje **w bramkę, nie w mechanizm**: podstawiasz korpus,
w którym `BLOKUJE = 0`, i sprawdzasz `exit 0`; potem korpus z jedną pozycją blokującą i
sprawdzasz `exit ≠ 0`. Dodatkowo mutacja odwrotna: **usuń warunek kodu wyjścia** i pokaż, że
nowy test **czerwieni się** — bezpiecznik, którego nie da się zepsuć, niczego nie pilnuje.
Wyjścia wszystkich trzech przebiegów dosłownie.

**Wymagany dowód:** trzy pary komenda/kod wyjścia + nowy test w pakiecie. **Commit po `R2`.**

## R3 — WOŁACZ W CI (rdzeń)

Bramka, której nikt nie woła, nie jest bramką.

1. **Wpis `npm run`** w konwencji istniejących bramek zapadkowych (`check:colors`,
   `check:list-canon`, `check:artefakt`, `check:triada:all`) — czytasz je i **naśladujesz
   nazewnictwo**, nie wymyślasz własnego.
2. **Krok w `.github/workflows/test-suite.yml`**, w istniejącym zadaniu `lint-typecheck`,
   obok pozostałych bramek. Nie tworzysz nowego workflow.
3. **Sprawdzasz, czy krok w ogóle się uruchomi.** Program ma zmierzony przypadek workflow
   z filtrem `paths`, który przy dużym pushu **został pominięty w ciszy**, a obserwator
   zameldował zielone ze **starego** przebiegu. Zadanie `lint-typecheck` w `test-suite.yml`
   masz **przeczytać i wpisać do raportu, na jakie zdarzenia i ścieżki reaguje** — a jeśli
   filtr sprawiłby, że Twoja bramka bywa pomijana, **nazywasz to wprost**.

★ Bramka będzie dziś **czerwona** (bo `BLOKUJE = 25`). **To jest zamierzone i nie jest powodem
do STOP-u.** Nie obchodzisz tego progiem, `continue-on-error` ani warunkiem `if:`. Bramka ma
mówić prawdę od pierwszego dnia; zamknie się wtedy, gdy pozycje zostaną rozstrzygnięte.

**Wymagany dowód:** treść dodanego kroku i wpisu `npm`, lokalny przebieg dokładnie tej samej
komendy, którą woła CI, z kodem wyjścia, oraz akapit o wyzwalaczach i filtrach `paths`.
**Commit po `R3`.**

## R4 — MARKER I DATA Z ARGUMENTÓW (rdzeń)

`MARKER` i `SNAPSHOT_DATE` przestają być stałymi w kodzie.

- Marker domyślnie z **realnego stanu repozytorium** (`git rev-parse`), data domyślnie
  z **chwili przebiegu** — oba nadpisywalne argumentem, dla odtwarzalności historycznej.
- Nagłówek rejestru ma dodatkowo nieść **komendę, którą go odtworzysz**, z tymi argumentami.
- Test: dwa przebiegi z różnymi argumentami dają **różne nagłówki** i **identyczną tabelę**
  werdyktów. To jest dokładnie ten bezpiecznik, którego brak sprawia, że rejestr sprzed
  trzech miesięcy wygląda jak dzisiejszy.

**Wymagany dowód:** dwa nagłówki obok siebie + `diff` części tabelarycznej (ma być pusty)
+ nowy test. **Commit po `R4`.**

## R5 — DZIEDZICZENIE DEC: JAWNE I OTESTOWANE (rdzeń)

22 z 96 werdyktów „nie blokuje" stoi na dziedziczeniu decyzji z nagłówka rodziny `## R-N.`
Bez niego `BLOKUJE` rośnie z 25 do 47. **Nie usuwasz tego mechanizmu — czynisz go widocznym.**

1. **Dokumentacja w kodzie**: komentarz przy funkcji, który mówi wprost, że pozycja bez
   własnego cytatu DEC dziedziczy decyzję rodziny, i **dlaczego** to jest uprawnione.
2. **Test jednostkowy dziedziczenia**: pozycja bez własnego DEC w rodzinie z DEC → werdykt
   dziedziczony; ta sama pozycja w rodzinie bez DEC → `BLOKUJE`. Plus mutacja: **wyłącz
   dziedziczenie i pokaż, że test czerwieni się**.
3. **Kolumna w rejestrze**: przy każdym werdykcie opartym na dziedziczeniu ma być widać,
   że jest dziedziczony **i z której rodziny**. Czytelnik rejestru ma to widzieć bez czytania
   kodu.
4. Do raportu: **imienna lista tych 22 pozycji** (albo Twoja liczba) z rodziną i decyzją.

**Wymagany dowód:** liczby `BLOKUJE` z dziedziczeniem i bez (dwa przebiegi), lista imienna,
nowy test + jego mutacja. **Commit po `R5`.**

## R6 — 12 POZYCJI `BRAK_SHA` I PROZA RAPORTU (rdzeń)

**Część A — 12 pozycji `BRAK_SHA_DLA_NAPRAWIONE`.** Każda jest opisana jako naprawiona, ale
nie cytuje SHA. Dla **każdej** rozstrzygasz jedno z trojga i wpisujesz do tabeli:

- **SHA znaleziony** — cytujesz go, sprawdzasz `git merge-base --is-ancestor` i pozycja
  przestaje blokować **z dowodu**, nie z życzliwości;
- **SHA nie istnieje** — pozycja zostaje `BLOKUJE`, ale z **właściwym powodem**
  (`NIEROZSTRZYGNIETE`), nie z powodu proceduralnego;
- **reguła E1 mówi, że taka pozycja nie blokuje** — wtedy **zmieniasz deklarację**, świadomie
  i na piśmie: wiersz w tabeli decyzji raportu, cytat starej i nowej reguły, i zmiana
  w kodzie razem z testem.

**Nie wolno** po prostu przenieść tych 12 do innego kubełka, żeby liczba spadła. Liczba, która
spadła bez rozstrzygnięcia obiektów, jest tym samym rozjazdem dwóch rejestrów, którego licznik
dotąd unikał.

**Część B — proza raportu 301 §R6.** Cztery pozycje (`MYW-PHOTO-003`, `-005`, `-010`, `-011`)
są tam nazwane blokującymi, a rejestr daje im `ODLOZONE_DEC` / `ZAMKNIETE_DEC`.
**Sprostowanie dopisujesz obok, nie zamiast** — z datą, z komendą i z cytatem obu wersji.
Sprawdź **wszystkie** pozycje wymienione w tamtym akapicie, nie tylko te cztery: naprawa
per zgłoszenie daje „poprawne w 2 z 3".

**Wymagany dowód:** tabela 12 pozycji z rozstrzygnięciem i dowodem per pozycja; `git diff`
sprostowania; nowa liczba `BLOKUJE` z komendą. **Commit po `R6`.**

## R7 — RAPORT

Raport zawiera: stan PRZED/PO (kod wyjścia, `BLOKUJE`, rozkład powodów), tabelę zgodności
z regułą E1 z `R1`, tabelę decyzji (co zmieniłeś w regule i dlaczego), tabelę 12 pozycji
`BRAK_SHA`, imienną listę pozycji zależnych od dziedziczenia DEC, treść kroku CI i dowód,
że się uruchamia, wszystkie dowody mutacyjne **dosłownie**, listę rozbieżności wobec liczb
tej instrukcji i **niepustą sekcję „TWIERDZENIA NIEZWERYFIKOWANE"**.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem i pushem. Zdanie: „skrypt zwraca kod
niezerowy przy `BLOKUJE > 0` i jest wołany z CI, marker i data pochodzą z argumentów,
dziedziczenie DEC udokumentowane i otestowane, 7 z 12 pozycji `BRAK_SHA` dostało SHA, 5
przeklasyfikowano z uzasadnieniem, proza raportu 301 sprostowana" — **jest pełnowartościowym
wynikiem i domyka bramkę G20 od strony narzędzia**.

Zdanie „licznik gotowy" postawione na skrypcie, który przy 25 blokujących pozycjach kończy się
zerem i którego nikt nie woła, **nie jest warte nic**.

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: **sprawdzasz warunek
NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na zapamiętanym wyniku**. Dyżur 300
przez to stał dobę po ustaniu blokady. Wynik ponownego sprawdzenia wklejasz do raportu z datą
i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Nie osłabiasz istniejących testów" vs „`R2`/`R4`/`R5` dodają testy do tego samego pliku" | Tabela licencji, wiersz „Bezpiecznik narzędzia": **dodawać wolno zawsze**, zmieniać istniejące — tylko razem z jawnym wpisem o zmianie kontraktu |
| „Bramka ma być zielona w CI" vs „`BLOKUJE = 25` dziś" | `R3`, akapit oznaczony ★: **bramka ma być dziś czerwona**, to jest zamierzone; zakaz `continue-on-error` i progów |
| „Zero nowych flag" (`Z10`) vs „tryb informacyjny w `R2`" | `R2` punkt 2: to **argument uruchomienia skryptu**, nie flaga funkcyjna produktu; nie dotyka `.env*`, `docker-compose*` ani `railway*` |
| „Rejestr wolno zmieniać" vs „rejestr jest produktem skryptu" | Tabela licencji, wiersz „Wyjście: rejestr": **jedyny dopuszczalny sposób zmiany to uruchomienie skryptu**; ręczna edycja zakazana |
| „Skrypt ma zgadzać się z regułą E1" vs „nie zmniejszaj liczby blokujących sztucznie" | `R6` część A: wolno **zmienić deklarację reguły**, ale wyłącznie świadomie, z wierszem w tabeli decyzji i testem; zakazane jest samo przeniesienie pozycji do innego kubełka |
| `§0.2c` wariant (B) każe uruchomić pakiet przez `vitest` vs pakiet działa pod `node --test` | Sekcja „ROZSTRZYGNIĘCIE WOBEC `§0.2c`": wiążąca jest komenda `node --test`; wariant (B) w tym dyżurze nie ma zastosowania |
| `§0.2c` wariant (A) każe postawić kontener vs ten dyżur nie dotyka bazy | Ta sama sekcja: domyślny jest wariant (C) bez kontenera; kontener stawiasz opcjonalnie i zapisujesz decyzję w raporcie |
| „Nie zmieniasz dokumentów wejściowych" vs „trzeba rozstrzygnąć 12 pozycji" | Tabela licencji, wiersze „Wejście: *": rozstrzygnięcie idzie do **raportu i rejestru**, dokumenty wejściowe zostają nietknięte |
