# INSTRUKCJA DYŻURU nr 328 — Codex — „★★★ DOMKNIĘCIE BRAMKI G20 — licznik P0/P1 jest już bramką (kod wyjścia 1 przy `BLOKUJE > 0`, wołany z CI jako `npm run check:p0p1-e1` w zadaniu `lint-typecheck`, checkout ma `fetch-depth: 0`), ale trzy rzeczy stoją między nim a zamknięciem: (1) naprawa `fetch-depth` jest NIEDOWIEDZIONA, a „potwierdź w przebiegu CI” jest niewykonalne i zakazane naraz — `test-suite.yml` reaguje wyłącznie na `main/develop/Londyn/demo`, więc na linii `grafika/m03-*` nie wyzwala się nigdy, a `Z39` zabrania go wywoływać; dowodem zastępczym jest para klonów offline, zmierzona przy wydaniu: `--depth 50` → `BLOKUJE 49` (17 NIEROZSTRZYGNIETE + 32 SHA_NIEISTNIEJACY), klon pełny → `BLOKUJE 17`; (2) 17 realnych pozycji `BLOKUJE` nie ma obiektu rozstrzygnięcia, a przeniesienie do innego kubełka rozstrzygnięciem NIE JEST; (3) trzy z siedmiu rozstrzygnięć SHA wiszą na commitach „checkpoint” (`af75a84e37`, `4a36e8a745` użyty dwukrotnie) — to dowód cytatu, nie dowód naprawy. Dziedziczenie DEC z rodziny `## R-N.` jest potwierdzone i bronione (17 → 39 po wyłączeniu, czerwieni dokładnie jeden test) — masz je ZMIERZYĆ, nie ruszać"

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
> **wyłącznie** `/private/tmp/cx-day328-g20-domkniecie`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `1c3d3da844ae03c87985a8f5dc74846a073c0220`**
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
Zakres: **PRZEKROJOWE — BRAMKA G20 (licznik P0/P1 reguły E1). Dowód naprawy `fetch-depth` przez reprodukcję offline, rozstrzygnięcie 17 pozycji blokujących obiekt po obiekcie, wymiana trzech rozstrzygnięć stojących na commitach „checkpoint”, pomiar dziedziczenia decyzji DEC**.
Trasy front: `brak tras HTTP — to jest praca na WARSTWIE BRAMKI: `scripts/dev/p0p1-licznik-e1.mjs`, `scripts/dev/__tests__/p0p1-licznik-e1.test.mjs`, `package.json` (wpis `check:p0p1-e1`), `.github/workflows/test-suite.yml` (zadanie `lint-typecheck`)`. Trasy tył: `brak tras HTTP — wejściem licznika jest pięć dokumentów rozliczeniowych wskazanych przez `pathsFor()` (`ROZLICZENIE_P0P1_20260903.md`, `ROZLICZENIE_P0P1_DECYZJE_20260903.md`, `DECYZJE_WLASCICIELA_P0P1_20260904.md`, `FALA_2_PO_STAGINGU.md`, `OWNER_DECISION_LEDGER_2026-08-24.md`), a wyjściem `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md` — wyłącznie jako produkt skryptu`.

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
WT=/private/tmp/cx-day328-g20-domkniecie
MARKER=1c3d3da844ae03c87985a8f5dc74846a073c0220

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/grafika/m03-20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day328-g20-domkniecie-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day328-g20-domkniecie/config.worktree"
cat "$VAULT/worktrees/cx-day328-g20-domkniecie/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day328-g20-domkniecie-scratch
mkdir -p /private/tmp/cx-day328-g20-domkniecie-artefakty

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
git -C "$VAULT" log --oneline 1c3d3da844ae03c87985a8f5dc74846a073c0220..github-backup/grafika/m03-20260902
git -C "$VAULT" diff --name-only 1c3d3da844ae03c87985a8f5dc74846a073c0220..github-backup/grafika/m03-20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day328-g20-domkniecie-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 1c3d3da844ae03c87985a8f5dc74846a073c0220..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `9` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA: licznik konczy sie kodem NIEZEROWYM przy BLOKUJE > 0
node scripts/dev/p0p1-licznik-e1.mjs > /dev/null 2>/tmp/day328-stderr.txt; echo "kod wyjscia = $?"
cat /tmp/day328-stderr.txt
git diff --stat -- docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md
git checkout -- docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md
#   moje liczby: kod wyjscia 1; na stderr "BLOKUJE: 17. Rejestr: <sciezka>"; git diff PUSTY
#   (rejestr w repo jest bajtowo identyczny z wygenerowanym).
#   ★ Ta komenda NADPISUJE plik rejestru — przywroc go tak, jak pokazano wyzej.

# (2) TEZA: 17 to SAME NIEROZSTRZYGNIETE, mianownik 121, arytmetyka 25 - 7 - 1 = 17
node scripts/dev/p0p1-licznik-e1.mjs 2>/dev/null \
  | awk -F'|' '/^\| `/ {gsub(/ /,"",$3); gsub(/ /,"",$4); if($3=="BLOKUJE") print $4}' | sort | uniq -c
node scripts/dev/p0p1-licznik-e1.mjs 2>/dev/null | grep -c '^| `'
node scripts/dev/p0p1-licznik-e1.mjs 2>/dev/null | sed -n '8p'
git checkout -- docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md
#   moje liczby: 17 NIEROZSTRZYGNIETE i ZERO BRAK_SHA_DLA_NAPRAWIONE; mianownik 121;
#   linia 8 rejestru: "Mianownik: 121. NAPRAWIONE: 33; ZAMKNIETE_DEC: 13; ODLOZONE_DEC: 58; W_BUDOWIE: 0."
#   17 + 33 + 13 + 58 + 0 = 121. Dyzur 320 zamknal 7 pozycji przez SHA i 1 przez DEC: 25 - 7 - 1 = 17.

# (3) TEZA: bramka jest ZAMONTOWANA w CI i ma pelna historie
grep -n "check:p0p1-e1" package.json .github/workflows/test-suite.yml
sed -n '50,62p'  .github/workflows/test-suite.yml
sed -n '100,110p' .github/workflows/test-suite.yml
#   oczekiwane: wpis `"check:p0p1-e1": "node scripts/dev/p0p1-licznik-e1.mjs"` w package.json,
#   krok "P0/P1 E1 zero-blockers gate (G20)" w zadaniu `lint-typecheck`, oraz `fetch-depth: 0`
#   w kroku `actions/checkout@v4` tego zadania.

# (4) ★★ TEZA ROZSTRZYGAJACA: workflow NIE URUCHAMIA SIE na naszej linii galezi
sed -n '1,10p' .github/workflows/test-suite.yml
git rev-parse --abbrev-ref HEAD
#   oczekiwane: `on: push/pull_request: branches: [main, develop, Londyn, demo]`.
#   Nasza galaz bazowa to `grafika/m03-20260902`, a galaz dyzuru to `codex/day328-*`.
#   ★ WNIOSEK, ktory musisz zapisac w raporcie: „realny przebieg CI” dla tej bramki
#   NIE ISTNIEJE i nie moze istniec przed scaleniem na `Londyn`/`demo` — a `Z39` i tak
#   zabrania wywolywania workflow. Dowodem jest reprodukcja offline z komendy (5).

# (5) ★★ REPRODUKCJA WARUNKOW CI OFFLINE — plytki klon kontra pelny
#     (to jest dowod, ktory zastepuje „przebieg CI”; zero sieci, zero Railway, zero demo)
mkdir -p /private/tmp/cx-day328-g20-domkniecie-artefakty
rm -rf /private/tmp/cx-day328-g20-domkniecie-artefakty/klon-plytki
git clone --quiet --depth 50 --single-branch --branch codex/day328-g20-domkniecie-20260904 \
  "file://$WT" /private/tmp/cx-day328-g20-domkniecie-artefakty/klon-plytki
( cd /private/tmp/cx-day328-g20-domkniecie-artefakty/klon-plytki \
  && git rev-list --count HEAD \
  && node scripts/dev/p0p1-licznik-e1.mjs >/dev/null; echo "kod plytki = $?" )
( cd /private/tmp/cx-day328-g20-domkniecie-artefakty/klon-plytki \
  && node scripts/dev/p0p1-licznik-e1.mjs 2>/dev/null \
  | awk -F'|' '/^\| `/ {gsub(/ /,"",$3); gsub(/ /,"",$4); if($3=="BLOKUJE") print $4}' \
  | sed 's/:.*//' | sort | uniq -c )
#   moje liczby (zmierzone przy wydaniu, na klonie z tego samego markera):
#   plytki klon --depth 50 -> BLOKUJE 49 = 17 NIEROZSTRZYGNIETE + 32 SHA_NIEISTNIEJACY, kod 1;
#   pelny klon (odpowiednik `fetch-depth: 0`) -> BLOKUJE 17, kod 1.
#   ★ Ta para liczb JEST dowodem naprawy `fetch-depth`. Klon pelny wykonaj tak samo,
#   bez `--depth`. Oba katalogi kasujesz po pomiarze (`rm -rf`) — leza POZA repo (Z13).

# (6) TEZA: dziedziczenie DEC odpowiada za roznice 17 -> 39
grep -n "addOwnerEvidence\|familyDec\|activeFamily" scripts/dev/p0p1-licznik-e1.mjs | head
grep -cE '^\|\s*R-[0-9]+\b.*DEC-[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]+' docs/program/DECYZJE_WLASCICIELA_P0P1_20260904.md
#   moje liczby: wylaczenie dziedziczenia (tymczasowa mutacja lokalna, cofnieta przez `cp`)
#   podnosi BLOKUJE z 17 na 39 — delta 22. Wierszy `| R-N ... DEC-...` naliczylem 20, nie 22.
#   ★ Nadzorca podal, ze delta rowna sie DOKLADNIE liczbie tych wierszy. Moj pomiar tego NIE
#   POTWIERDZA (22 vs 20). ZMIERZ SAM i zapisz, ktora liczba jest Twoja — to wchodzi do R4.

# (7) TEZA: siedem rozstrzygniec SHA, z czego trzy wisza na commitach "checkpoint"
sed -n '20,33p' scripts/dev/p0p1-licznik-e1.mjs
for s in b470536a91 af75a84e37 4a36e8a745 655d629675 a995ca4c20; do \
  printf "%s  " "$s"; git log -1 --format='%s' "$s"; \
  printf "   odleglosc od HEAD: "; git rev-list --count "$s"..HEAD; done
#   moje liczby: af75a84e37 = "checkpoint: preserve wave 3 owner review work" (MYW-CV-REC-001);
#   4a36e8a745 = "checkpoint wave 3 recovery candidate" (MYW-DEC-REC-001 i MYWORK-DEC-OWN-001,
#   uzyty DWUKROTNIE). Pozostale cztery wpisy cytuja commity funkcyjne. Odleglosci od HEAD:
#   3952-4595 commitow — dlatego plytki klon je gubi.

# (8) TEZA: pakiet testowy licznika dziala przez node --test i jest ZIELONY
node --test scripts/dev/__tests__/p0p1-licznik-e1.test.mjs 2>&1 | tail -8
git checkout -- docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md
#   oczekiwane: 9 testow, 9 pass, 0 fail. ★ Nie uruchamiaj tego przez vitest —
#   dostaniesz "No test files found", a to NIE jest PASS (§0.2c).

# (9) TEZA: zasoby wolne
lsof -nP -iTCP:6354 -sTCP:LISTEN; lsof -nP -iTCP:5494 -sTCP:LISTEN
docker ps -a --format "{{.Names}}" | grep -c cx-day328 || true
df -h /
#   oczekiwane: puste lsof, 0 kontenerow. Ponizej 5 GB wolnego to STOP calosci (§0.5).
#   ★ Klony z komendy (5) zajmuja miejsce — sprawdz `df -h /` PRZED nimi i PO nich.
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day328-g20-domkniecie-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6354`. Twój JEDYNY port harnessu to `5494`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day328-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta listy restricted ports Chromium. Zajęte przez inne prace (nie ruszasz): 3020, 3022, 3025, 3027, 3030 (tor grafiki nadzorcy), 5322, 5410-5441 (agenci nadzorcy), 5442-5479 oraz 6290-6339 (dyzury 286-323), 5432 i 5433 (Postgres hosta), 6012, 6379 (redis), 7000, 7679, 7768, 11434. Dyżury równoległe tej serii: 327 (baza 6353, harness 5493, kontener cx-day327-pg), 328 (baza 6354, harness 5494, kontener cx-day328-pg), 329 (baza 6355, harness 5495, kontener cx-day329-pg) — do CUDZEJ bazy nie łączysz się nawet do odczytu; każdy inny port z przedziałów 5300-5492, 5496-5499, 6300-6352 i 6356-6399 jest cudzy. Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps. ★ ZAKAZ `pkill`/`killall` na `node`, `vite`, `playwright` — zabijasz wyłącznie własne PID-y (zapisz `$!`).`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak — ten dyżur nie wprowadza ani jednej nowej flagi funkcyjnej i nie zmienia wartości domyślnej żadnej istniejącej`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``.github/workflows/day161-fresh-migration-gate.yml`, `security-scan.yml`, `railway-deploy.yml`, `e2e-nightly.yml`, `e2e-weekly.yml`, `i18n-check.yml`, `module-contract-rerun.yml`, `recovery-ownership-gate.yml`, `domain-closure-smoke.yml` — tylko odczyt, czytasz je jako wzór · `server/src/middleware/auth.middleware.ts`, `server/src/Gateway.ts`, `server/src/middleware/orgContext.middleware.ts` · pięć dokumentów wejściowych licznika (`pathsFor()`), w szczególności `docs/program/DECYZJE_WLASCICIELA_P0P1_20260904.md` — to są słowa właściciela · `scripts/check-list-canon.sh`, `scripts/check-artefakt.sh`, `scripts/check-focus-canon.sh` (hooki; nie omijasz) · `scripts/dev/i18n-pl-audyt.mjs` i bezpieczniki dyżuru 327 · `scripts/dev/reachability-from-root.mjs` i pliki dyżuru 329. ★ WYJĄTKI wymienione imiennie w tabeli licencji: **wzmocnienie jednego istniejącego kroku** w zadaniu `lint-typecheck` pliku `.github/workflows/test-suite.yml` oraz **wpis `check:p0p1-e1`** w sekcji `scripts` pliku `package.json``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY328_G20_DOMKNIECIE_REPORT.md`. ZAKAZ edycji `MODULE_ACCEPTANCE.md` — ten dyżur jest przekrojowy. Dozwolona AKTUALIZACJA (dopisanie, nigdy skasowanie) dwóch istniejących dokumentów: sprostowanie w §R6 pliku `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY301_LICZNIK_P0P1_E1_REPORT.md` (dopisane OBOK oryginalnego zdania, z datą i komendą) oraz jednego wiersza dotyczącego licznika P0/P1 w `docs/program/REJESTR_ZNALEZISK_20260903.md`. Plik `REJESTR_P0P1_BLOKUJACE_G20.md` zmienia się WYŁĄCZNIE jako produkt uruchomienia skryptu — ręczna edycja jest zakazana. Nowe pliki w `tests/` i `scripts/` wymagają `git add -f`. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day328-g20-domkniecie-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day328-g20-domkniecie-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ OBNIŻANIA LICZBY `BLOKUJE` PRZEZ PRZENIESIENIE POZYCJI DO INNEGO KUBEŁKA.** Liczba spada wyłącznie przez rozstrzygnięcie OBIEKTU, wiersz po wierszu, z komendą i wynikiem. **ZAKAZ ręcznej edycji `REJESTR_P0P1_BLOKUJACE_G20.md`** — plik zmienia się WYŁĄCZNIE jako produkt uruchomienia skryptu. **ZAKAZ jakiejkolwiek zmiany pięciu dokumentów wejściowych** wymienionych w `pathsFor()`, w szczególności `docs/program/DECYZJE_WLASCICIELA_P0P1_20260904.md`. **ZAKAZ usunięcia dziedziczenia DEC** — masz je zmierzyć i opisać, nie skasować; wyłączenie jest tymczasową mutacją pomiarową cofaną przez `cp`. **ZAKAZ `continue-on-error`, warunku `if:` wygaszającego krok, progu tolerancji i `--max-warnings`** w bramce CI — bramka ma DZIŚ być czerwona i to jest zamierzone. **ZAKAZ tworzenia nowego pliku workflow** i zakaz zmiany wyzwalaczy, uprawnień, wersji Node oraz pozostałych kroków `test-suite.yml`. **ZAKAZ zmiany zależności i wersji w `package.json`.** **ZAKAZ osłabiania dziewięciu istniejących testów licznika** — dodawać wolno zawsze, zmieniać istniejącą asercję wolno wyłącznie razem z jawnym wpisem o zmianie kontraktu. **ZAKAZ nadpisywania prozy raportu 301** — sprostowanie staje OBOK, z datą i komendą. **ZAKAZ dotykania katalogów `src/` i `server/src/`** — ten dyżur nie zmienia produktu. **ZAKAZ tworzenia pliku w `server/migrations/`** — przedział nieprzydzielony. **ZAKAZ zostawienia klonów pomiarowych na dysku** — kasujesz je po pomiarze, `df -h /` przed i po. **ZAKAZ `git stash`, `pkill`, `killall`, `--no-verify`** | Bramka G20 („zero otwartych P0/P1”) była przez cały program zamykana przez człowieka czytającego plik. Dyżur 301 zbudował licznik, 320 zamienił go w bramkę, nadzorca naprawił `fetch-depth` — i na tym stanęło. Zostały trzy rzeczy tego samego rodzaju: liczba, która wygląda na domkniętą, a stoi na czymś, co jej nie unosi. Naprawa `fetch-depth` jest twierdzeniem w komentarzu, a nie przebiegiem; 17 pozycji blokujących nie ma obiektu rozstrzygnięcia; trzy z siedmiu rozstrzygnięć SHA cytują commity „checkpoint”, czyli migawki, które nie mówią, że cokolwiek naprawiono. Program ma zapisane dwa kształty, które się tu spotykają: „bezpiecznik, który nigdy nie mógł przejść” (przy płytkim klonie liczba wynosiła 49 i bramka nie mogła się zazielenić) oraz „dwa rejestry — licznik mierzy rozjazd” (liczba spadająca bez rozstrzygnięcia obiektu). Dopóki tak jest, każde zdanie „G20 zamknięta” będzie oparte na czyjejś lekturze, a nie na przebiegu |

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
cd /private/tmp/cx-day328-g20-domkniecie

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day328-pg psql -U postgres -d cx328 \
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
cd /private/tmp/cx-day328-g20-domkniecie

docker run -d --name cx-day328-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx328 \
  -p 127.0.0.1:6354:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day328-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6354/cx328 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6354/cx328 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day328-g20-domkniecie && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6354/cx328 \
JWT_SECRET=cx328-test-secret-do-podpisu-tokenow-w-tym-dyzurze \
npx vitest run scripts/dev/__tests__/p0p1-licznik-e1.test.mjs --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day328-g20-domkniecie-artefakty/day328-g20.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day328-g20-domkniecie && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run scripts/dev/__tests__/p0p1-licznik-e1.test.mjs --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day328-g20-domkniecie-artefakty/day328-g20.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day328-g20-domkniecie/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day328-pg psql -U postgres -d cx328 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day328-pg`.
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
> **(e) nie dotyczy — licznik P0/P1 to skaner dokumentów tekstowych plus dwa wywołania `git`; nie montuje routera, nie przechodzi przez żadnego strażnika i nie otwiera połączenia do bazy. Dowód, że żaden strażnik nie leży na ścieżce: `grep -lE "ApiGateway|verifyToken|v8FeatureGate|resultsInternalBetaVisibility" scripts/dev/p0p1-licznik-e1.mjs scripts/dev/__tests__/p0p1-licznik-e1.test.mjs` — oczekiwane: zero trafień, uruchom to i wklej wynik. ★ Pułapka WŁAŚCIWA temu dyżurowi jest inna: **głębokość klonu**. Ten sam skrypt, ten sam korpus i ten sam marker dają `BLOKUJE 17` w klonie pełnym i `BLOKUJE 49` w klonie `--depth 50`, bo `git cat-file` nie widzi commitów odległych o ~4000 pozycji. Środowisko pomiaru zmienia wynik bramki — i to jest dokładnie ten rodzaj kłamstwa przyrządu, którego ten dyżur ma dowieść liczbami**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day328-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day328-g20-domkniecie-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1, R2, R3, R4`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6354` albo `5494` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6354` albo `5494`** (`Z7`).

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

Bramka **G20 — „zero otwartych P0/P1"** przez cały program była zamykana **przez człowieka,
który czyta plik**. Dyżur 301 zbudował licznik, dyżur 320 zamienił go w bramkę, a nadzorca
naprawił jedną rzecz, której 320 nie mógł zobaczyć. **Zostały trzy rzeczy — i wszystkie
trzy są tego samego rodzaju: liczba, która wygląda na domkniętą, a stoi na czymś, co jej
nie unosi.**

**Stan zastany, zmierzony na markerze:**

- `scripts/dev/p0p1-licznik-e1.mjs` kończy się **kodem 1** przy `BLOKUJE > 0` i wypisuje
  na `stderr` liczbę oraz ścieżkę rejestru;
- jest wołany z CI: `npm run check:p0p1-e1` w zadaniu `lint-typecheck` pliku
  `.github/workflows/test-suite.yml`;
- checkout tego zadania ma już **`fetch-depth: 0`** (poprzednio `50`);
- pakiet `scripts/dev/__tests__/p0p1-licznik-e1.test.mjs` — **9 testów, 9 PASS** pod
  `node --test`;
- lokalnie: `BLOKUJE = 17`, mianownik `121`, rozkład `NAPRAWIONE 33 · ZAMKNIETE_DEC 13
  · ODLOZONE_DEC 58 · W_BUDOWIE 0`, wszystkie 17 z powodem `NIEROZSTRZYGNIETE`
  (zero `BRAK_SHA_DLA_NAPRAWIONE`). Arytmetyka `25 − 7 − 1 = 17` **domyka się**.

**Dlaczego to jeszcze nie jest domknięte:**

1. **Naprawa `fetch-depth` jest NIEDOWIEDZIONA.** Komentarz w workflow twierdzi, że przy
   płytkim klonie skrypt widział `NAPRAWIONE: 1` i `BLOKUJE: 49` z 32 wierszami
   `SHA_NIEISTNIEJACY`. **Twierdzenie bez przebiegu jest tezą, nie faktem.** ★★ I tu jest
   pułapka, którą rozstrzygam za Ciebie: **„potwierdź w realnym przebiegu CI" jest
   w tym repozytorium NIEWYKONALNE i zakazane naraz.** `test-suite.yml` reaguje wyłącznie
   na gałęzie `main`, `develop`, `Londyn`, `demo` — nasza linia to `grafika/m03-20260902`,
   więc workflow **nigdy się nie uruchamia**; a `Z39` niezależnie zabrania wywoływania
   realnych workflow. **Dowodem zastępczym, w pełni równoważnym, jest reprodukcja offline
   z `§0.3` komenda (5)**: płytki klon `--depth 50` kontra klon pełny, oba z Twojej
   gałęzi, przez `file://`, bez sieci. Zmierzyłem to przy wydaniu: **płytki → `BLOKUJE 49`
   (17 `NIEROZSTRZYGNIETE` + 32 `SHA_NIEISTNIEJACY`), pełny → `BLOKUJE 17`.** To jest para
   liczb, której brakowało.
2. **17 realnych pozycji `BLOKUJE` nie ma rozstrzygnięcia obiektu.** Wszystkie mają powód
   `NIEROZSTRZYGNIETE`. Bramka nie zamknie się od żadnej zmiany narzędzia — zamknie się
   dopiero wtedy, gdy **każda z tych 17 pozycji dostanie obiekt rozstrzygnięcia**.
   ★ **Przeniesienie do innego kubełka nie jest rozstrzygnięciem.** Program ma zmierzony
   kształt „dwa rejestry — licznik mierzy rozjazd": liczba, która spadła bez rozstrzygnięcia
   obiektu, mierzy różnicę liczników, a nie stan produktu.
3. **Trzy z siedmiu rozstrzygnięć SHA wiszą na commitach „checkpoint".**
   `af75a84e37` = *checkpoint: preserve wave 3 owner review work* (`MYW-CV-REC-001`);
   `4a36e8a745` = *checkpoint wave 3 recovery candidate*, użyty **dwukrotnie**
   (`MYW-DEC-REC-001`, `MYWORK-DEC-OWN-001`). Formalnie przechodzą bramkę — `git cat-file`
   je widzi i są przodkami `HEAD`. Merytorycznie to **dowód cytatu, nie dowód naprawy**:
   commit-migawka nie mówi, że cokolwiek naprawiono. Pozostałe cztery wpisy cytują commity
   funkcyjne (`feat(execution)…`, `feat(mywork)…`, `fix(mywork)…`) i są w porządku.

**Co odbiór POTWIERDZIŁ i czego nie ruszasz.** Dziedziczenie decyzji `DEC` z rodziny
`## R-N.` jest **jawne, udokumentowane komentarzem w kodzie, otestowane i bronione**:
wyłączenie go podnosi `BLOKUJE` z **17 na 39**, a czerwieni się **dokładnie jeden** test.
Mechanizm jest merytorycznie poprawny — masz go **zmierzyć i opisać, nie usunąć**.
Osobno: **proza §R6 raportu 301 była błędna, a rację miał wygenerowany rejestr** — cztery
pozycje `MYW-PHOTO-*` nazwane tam blokującymi mają w rejestrze `ODLOZONE_DEC`/`ZAMKNIETE_DEC`.

## ★ Zmierz moje liczby sam

Twierdzę, na markerze `1c3d3da844ae03c87985a8f5dc74846a073c0220`:

- `node scripts/dev/p0p1-licznik-e1.mjs` → kod wyjścia **1**, stderr `BLOKUJE: 17`,
  `git diff` na rejestrze **pusty**;
- mianownik **121**; `NAPRAWIONE 33 · ZAMKNIETE_DEC 13 · ODLOZONE_DEC 58 · W_BUDOWIE 0
  · BLOKUJE 17`; wszystkie 17 to `NIEROZSTRZYGNIETE`;
- **płytki klon `--depth 50` → `BLOKUJE 49` = 17 `NIEROZSTRZYGNIETE` + 32
  `SHA_NIEISTNIEJACY`; klon pełny → `BLOKUJE 17`**;
- `test-suite.yml` reaguje na `push`/`pull_request` wyłącznie dla gałęzi
  `[main, develop, Londyn, demo]`; `fetch-depth: 0` stoi w zadaniu `lint-typecheck`
  (wiersz ok. 60), krok `P0/P1 E1 zero-blockers gate (G20)` ok. wiersza 105;
- `DAY320_RESOLUTIONS` ma **12** wpisów: **7** typu `SHA` (6 różnych SHA, `b470536a91`
  i `4a36e8a745` po dwa razy), **1** typu `DECISION`, **4** typu `UNRESOLVED`;
- SHA cytowane w rozstrzygnięciach leżą **3952–4595** commitów od `HEAD`;
- wyłączenie dziedziczenia `DEC`: `BLOKUJE 17 → 39`, **delta 22**; wierszy
  `| R-N … DEC-…` w dokumencie decyzji właściciela naliczyłem **20**, nie 22 —
  **to jest rozbieżność wobec tezy zlecenia i masz ją rozstrzygnąć własnym pomiarem**;
- `node --test scripts/dev/__tests__/p0p1-licznik-e1.test.mjs` → **9 testów, 9 PASS**.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.**

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: WEJŚCIE · PARSER · KLASYFIKATOR · RENDER · BRAMKA CI

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany
czerwony kontrakt testowy + brief. Pozycja z takim produktem jest **ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Narzędzie (rdzeń)** | `scripts/dev/p0p1-licznik-e1.mjs` | **★ PEŁNA LICENCJA** w zakresie `R2`–`R4`. **Zakaz zmiany semantyki werdyktów** bez wiersza w tabeli decyzji raportu. Zmiana `DAY320_RESOLUTIONS` wyłącznie w kierunku **mocniejszego dowodu** (SHA funkcyjny zamiast `checkpoint`, albo przeklasyfikowanie) | — |
| **Bezpiecznik narzędzia** | `scripts/dev/__tests__/p0p1-licznik-e1.test.mjs` | **★ PEŁNA LICENCJA**: wolno **dodawać** testy. Istniejące 9 wolno zmienić **wyłącznie razem z jawnie opisaną zmianą kontraktu** — usunięcie asercji bez takiego wpisu = odrzucenie pozycji | — |
| **Wyjście: rejestr** | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md` | **★ PEŁNA LICENCJA — ale WYŁĄCZNIE jako PRODUKT SKRYPTU.** Ręczna edycja zakazana; jedyny dopuszczalny sposób zmiany to uruchomienie skryptu | — |
| **Bramka CI** | `.github/workflows/test-suite.yml` | **★ WĄSKA LICENCJA:** wyłącznie **wzmocnienie istniejącego kroku** `P0/P1 E1 zero-blockers gate (G20)` w zadaniu `lint-typecheck` (np. jawny komunikat, jawny `fetch-depth` w komentarzu). **Zakaz** zmiany wyzwalaczy, uprawnień, wersji Node, pozostałych kroków i tworzenia nowego workflow. **Zakaz `continue-on-error`, warunku `if:` wygaszającego krok i progu tolerancji** | Czerwony kontrakt + brief |
| **Wołacz `npm`** | `package.json` (sekcja `scripts`) | **★ WĄSKA LICENCJA:** wyłącznie wpis `check:p0p1-e1` i ewentualny wariant informacyjny obok. Zakaz zmiany zależności, wersji i pozostałych skryptów | Czerwony kontrakt + brief |
| **Wejście: rozliczenie** | `docs/program/waves/WAVE_03_ACCEPTANCE/ROZLICZENIE_P0P1_20260903.md` | **TYLKO ODCZYT** | Rozstrzygnięcie idzie do **raportu i rejestru**, nie do dokumentu wejściowego |
| **Wejście: decyzje** | `docs/program/waves/WAVE_03_ACCEPTANCE/ROZLICZENIE_P0P1_DECYZJE_20260903.md` | **TYLKO ODCZYT** | jak wyżej |
| **Wejście: decyzje właściciela** | `docs/program/DECYZJE_WLASCICIELA_P0P1_20260904.md` | **TYLKO ODCZYT — BEZWZGLĘDNIE.** To są słowa właściciela; nie „poprawiasz" ich, żeby licznik ładniej policzył | jak wyżej |
| **Wejście: fala 2** | `docs/program/FALA_2_PO_STAGINGU.md` | **TYLKO ODCZYT** | jak wyżej |
| **Wejście: rejestr decyzji** | `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` | **TYLKO ODCZYT** (`Z14`) | Errata w raporcie |
| **Raport 301** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY301_LICZNIK_P0P1_E1_REPORT.md` | **★ WĄSKA LICENCJA:** wyłącznie **sprostowanie dopisane, nie nadpisane** — oryginalne zdanie zostaje, obok staje sprostowanie z datą i komendą | — |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA istniejącego wiersza** dotyczącego licznika P0/P1 — dopisujesz stan, nie kasujesz historii | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY328_G20_DOMKNIECIE_REPORT.md` (**NOWY — nie istnieje na markerze**) | `R6` — **JEDYNY nowy dokument, jaki wolno Ci utworzyć** (`Z13`) | — |
| **Cudze tereny** | `scripts/dev/i18n-pl-audyt.mjs`, `tests/unit/config/i18n*`, `tests/unit/frontend/noRawErrorInJsx.test.ts`, `tests/unit/backend/security/noRawErrorMessage.test.ts`, `tests/unit/backend/schema/noRuntimeDdl.test.ts` (dyżur 327) · `scripts/dev/reachability-from-root.mjs` (**NIE ISTNIEJE na markerze — leży na niescalonej gałęzi `codex/day297-…`**), `src/components/assessment/**`, `dev-render/**` (dyżur 329) | **TYLKO ODCZYT** | Wpis do raportu: plik, linia, problem, rekomendacja jako diff, **nienałożony** |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem plik:linia i idziesz dalej |

## ★★ ROZSTRZYGNIĘCIE WOBEC `§0.2c` I `Z39` — DWIE SPRZECZNOŚCI, OBIE ROZSTRZYGNIĘTE TUTAJ

**(1) Wariant (C), bez kontenera.** Licznik nie dotyka bazy danych. Pracujesz w wariancie
(C) (`RUN_DB_TESTS=0 MOCK_DB=true`), **kontenera nie stawiasz**. Porty `6354`/`5494`
i nazwa `cx-day328-pg` pozostają zarezerwowane niezależnie od tego, czy ich użyjesz.
W raporcie piszesz jednym zdaniem, że baza nie była potrzebna, i **nie udajesz dowodu
bazodanowego**. Dowód `§0.2b` (b) zastępujesz zdaniem o braku bazy dyżuru — to jest pełny
dowód `Z30` przy braku kontenera.

**(2) Wariant (B) nie ma zastosowania.** Pakiet testowy licznika używa runnera `node:test`.
Właściwa komenda to `node --test scripts/dev/__tests__/p0p1-licznik-e1.test.mjs`.
Uruchomienie przez `vitest` odda `No test files found`, **a to NIE jest `PASS`**.

**(3) `Z39` kontra „potwierdź w przebiegu CI".** `Z39` zabrania uruchamiania realnych
workflow. Niezależnie od tego `test-suite.yml` **w ogóle nie wyzwala się na naszej linii
gałęzi**. Wiążąca jest reprodukcja offline z `§0.3` komenda (5): dwa klony przez `file://`,
z Twojej gałęzi, bez sieci — jeden `--depth 50`, drugi pełny. **To jest dowód, nie
namiastka**: uruchamiasz dokładnie tę samą komendę, którą woła CI, w dokładnie tym samym
kształcie klonu.

## ★★ WARUNKI WSPÓLNE SERII — obowiązują mimo że ten dyżur nie dotyka produktu

Ten dyżur **nie zmienia ani jednego pliku w `src/` i `server/src/`**, więc poniższe
warunki są u Ciebie **kontrolą braku szkody ubocznej**, a nie przedmiotem pracy. Mierzysz
je **PRZED pierwszym commitem i PO ostatnim**, i obie liczby wpisujesz do raportu:

```bash
cd "$WT"
# (a) liscie slownikow NIE MOGA ZMALEC
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
#   moje liczby: pl 35198, en 33065

# (b) trzy bramki kanonu maja konczyc sie kodem 0
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus-canon=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list-canon=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
#   moje liczby: wszystkie 0; dlug wejsciowy: list-canon 368/368, artefakt 8/9,
#   focus-canon baseline 61 plikow / 169 wystapien
```

**Jeżeli którakolwiek liczba zmaleje albo bramka zaczerwieni się od Twojej zmiany —
naprawiasz KODEM, nigdy progiem i nigdy `--no-verify`** (`Z35`). Jeżeli zaczerwieniła się
z powodu zastanego, **udowodnij to komendą na markerze** i wpisz do „Korekt wobec
instrukcji".

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | kod wyjścia licznika przy `BLOKUJE > 0` | `1` | `node scripts/dev/p0p1-licznik-e1.mjs >/dev/null 2>&1; echo $?` | TAK |
| 2 | pozycje `BLOKUJE` i ich powody | `17`, wszystkie `NIEROZSTRZYGNIETE` | komenda (2) z `§0.3` | TAK — grupuje po kolumnie „powód", nie po samej liczbie |
| 3 | mianownik korpusu | `121` | `node scripts/dev/p0p1-licznik-e1.mjs 2>/dev/null \| grep -c '^\| \`'` | TAK |
| 4 | rozkład pozostałych werdyktów | `33/13/58/0` | `node scripts/dev/p0p1-licznik-e1.mjs 2>/dev/null \| sed -n '8p'` | TAK — suma z wierszem 2 daje 121, sprawdź to |
| 5 | `BLOKUJE` w klonie `--depth 50` | `49` = `17` + `32` | komenda (5) z `§0.3` | TAK — **to jest reprodukcja warunków CI, nie analogia** |
| 6 | `BLOKUJE` w klonie pełnym | `17` | komenda (5) z `§0.3`, bez `--depth` | TAK |
| 7 | wpisy `DAY320_RESOLUTIONS` wg typu | `7 SHA · 1 DECISION · 4 UNRESOLVED` | `sed -n '20,33p' scripts/dev/p0p1-licznik-e1.mjs` | TAK |
| 8 | z tego rozstrzygnięcia na commitach `checkpoint` | `3` z `7` (2 różne SHA) | komenda (7) z `§0.3` | TAK — czyta **temat commita**, nie samo jego istnienie |
| 9 | odległość cytowanych SHA od `HEAD` | `3952`–`4595` | `git rev-list --count <SHA>..HEAD` | TAK — to wyjaśnia, dlaczego płytki klon je gubi |
| 10 | delta po wyłączeniu dziedziczenia `DEC` | `17 → 39`, delta `22` | tymczasowa mutacja `addOwnerEvidence()`, cofnięta przez `cp` (`Z27`) | TAK |
| 11 | wiersze `\| R-N … DEC-…` w dokumencie właściciela | `20` | komenda (6) z `§0.3` | TAK — **moja liczba (20) przeczy tezie zlecenia (22); rozstrzygasz własnym pomiarem** |
| 12 | testy pakietu licznika | `9` PASS | `node --test scripts/dev/__tests__/p0p1-licznik-e1.test.mjs` | TAK — runner `node:test`, **nie** `vitest` |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:** `scripts/dev/p0p1-licznik-e1.mjs` ·
`scripts/dev/__tests__/p0p1-licznik-e1.test.mjs` ·
`docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md` (wyłącznie jako
produkt skryptu) · `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY328_G20_DOMKNIECIE_REPORT.md`.

**Zapisujesz WARUNKOWO:** `.github/workflows/test-suite.yml` i `package.json` — wyłącznie
w zakresie wąskiej licencji z tabeli · `…/codex/CODEX_DAY301_LICZNIK_P0P1_E1_REPORT.md`
(sprostowanie **dopisane**) · `docs/program/REJESTR_ZNALEZISK_20260903.md` (jeden wiersz).

**JAWNIE NIE ZAPISZESZ:** `scripts/dev/i18n-pl-audyt.mjs`, `tests/unit/config/**`,
`tests/unit/frontend/noRawErrorInJsx.test.ts`, `tests/unit/backend/security/**`,
`tests/unit/backend/schema/**` (teren dyżuru 327) · `scripts/dev/reachability-from-root.mjs`,
`tests/unit/canon/**`, `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json`,
`src/components/assessment/**`, `dev-render/**` (teren dyżuru 329) · `src/**`,
`server/src/**` (ten dyżur **nie zmienia produktu**) · `server/migrations/**` (**przedział
nieprzydzielony — dyżur nie tworzy migracji**) · pięć dokumentów wejściowych licznika.

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day328-g20-domkniecie
git diff --name-only --cached | tee /private/tmp/cx-day328-g20-domkniecie-artefakty/staged.txt
grep -iE 'i18n-pl-audyt|noRawError|noRuntimeDdl|reachability|components/assessment|dev-render/|^src/|^server/src/|server/migrations/|ROZLICZENIE_P0P1|DECYZJE_WLASCICIELA|FALA_2_PO_STAGINGU|OWNER_DECISION_LEDGER' \
  /private/tmp/cx-day328-g20-domkniecie-artefakty/staged.txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## R1 — DOWÓD NAPRAWY `fetch-depth` (rdzeń, PIERWSZA POZYCJA)

**Naprawa `fetch-depth: 50 → 0` jest dziś twierdzeniem w komentarzu, a nie faktem
z przebiegu.** Ta pozycja zamienia to w dowód.

1. **Reprodukcja obu stron.** Komenda (5) z `§0.3`: klon `--depth 50` i klon pełny, oba
   z **Twojej** gałęzi, przez `file://`, bez sieci. Do raportu idą **cztery liczby**:
   kod wyjścia i `BLOKUJE` dla każdego klonu, plus rozkład powodów. U mnie: płytki
   `49 = 17 + 32 SHA_NIEISTNIEJACY`, pełny `17`.
2. **Nazwanie mechanizmu.** Wyjaśnij w raporcie **dlaczego** płytki klon psuje wynik:
   `gitShaState()` woła `git cat-file -e <sha>^{commit}` i `git merge-base --is-ancestor`,
   a cytowane SHA leżą 3952–4595 commitów od `HEAD`. **Podaj swoje odległości.**
3. **Rozstrzygnięcie o „przebiegu CI".** Zapisz w raporcie, **na jakie gałęzie reaguje**
   `test-suite.yml`, i wprost: że dla linii `grafika/m03-*` bramka **nie uruchamia się
   w ogóle**, więc „zielone CI" nie jest i nie będzie dowodem przed scaleniem na
   `Londyn`/`demo`. To jest zmierzony kształt „duży push nie wyzwala workflow" —
   z tą różnicą, że tu nie wyzwala go **filtr gałęzi**, nie filtr ścieżek.
4. **Zabezpiecz to testem.** Dodaj do pakietu przypadek, który przy `shaCheck` zwracającym
   `SHA_NIEISTNIEJACY` (wstrzykiwanym przez `options.shaCheck`, bez dotykania git-a)
   wymusza wynik `BLOKUJE` z tym właśnie powodem. **Mutacja:** usuń gałąź obsługującą
   `SHA_NIEISTNIEJACY` i pokaż, że nowy test **czerwieni się**.

★ **Sprzątanie:** oba klony leżą w `/private/tmp/cx-day328-g20-domkniecie-artefakty/`
(**poza repo**, `Z13`) i **kasujesz je po pomiarze**. `df -h /` przed i po. Program stracił
dobę na dysku zjedzonym przez niesprzątnięte klony.

**Wymagany dowód:** cztery liczby z dwóch klonów, akapit o wyzwalaczach workflow, nowy
test + jego mutacja, `df -h /` przed i po. **Commit po `R1`.**

## R2 — SIEDEMNAŚCIE POZYCJI `BLOKUJE`: OBIEKT ROZSTRZYGNIĘCIA, NIE INNY KUBEŁEK (rdzeń)

Siedemnaście pozycji, wszystkie z powodem `NIEROZSTRZYGNIETE`. U mnie są to:
`ASM-OWN-001`, `ASM-OWN-002`, `ASM-OWN-003`, `EXE-OWN-001`, `EXE-OWN-003`, `EXE-OWN-005`,
`FIN-OWN-001`, `INI-OWN-001`, `INT-INIT-AI-OBS-001`, `MYW-CAL-REC-002`, `MYW-CAL-REC-003`,
`MYW-CV-REC-002`, `RES-OWN-003`, `RES-OWN-004`, `TLS-CHAIN-OWN-001`, `TLS-MENU-OWN-001`,
`TLS-REC-OWN-001`. **Wypisz swoją listę i porównaj — rozbieżność jest wynikiem, nie błędem.**

Dla **każdej** pozycji, wiersz w tabeli, jedno z czterech:

- **SHA naprawy znaleziony** — cytujesz go, sprawdzasz `git cat-file -e` i
  `git merge-base --is-ancestor`, **i podajesz temat commita**. ★ Temat w rodzaju
  `checkpoint …` **nie jest** dowodem naprawy (patrz `R3`);
- **DEC właściciela obejmuje pozycję** — cytujesz identyfikator `DEC-…` **istniejący
  w rejestrze decyzji** i cytujesz zdanie, z którego wynika, że pozycja jest objęta;
- **pozycja jest realnie otwarta** — zostaje `BLOKUJE`, ale z **opisem, czego brakuje do
  rozstrzygnięcia**, i jednym zdaniem „czego konkretnie mi zabrakło, żeby rozstrzygnąć
  samodzielnie". Wiersz bez tego zdania liczy się jako nierozstrzygnięty;
- **`DO DECYZJI WŁAŚCICIELA`** — gdy rozstrzygnięcie jest decyzją produktową, nie pomiarem.

**★★ ZAKAZ NADRZĘDNY TEJ POZYCJI.** Nie wolno obniżyć liczby `BLOKUJE` przez **przeniesienie
pozycji do innego kubełka** bez rozstrzygnięcia obiektu. Liczba, która spadła bez obiektu,
mierzy rozjazd dwóch liczników, a nie stan produktu — i program ma ten kształt zapisany
imiennie. **Spadek liczby bez tabeli rozstrzygnięć = odrzucenie pozycji.**

**Wymagany dowód:** tabela 17 wierszy, każdy z komendą i wynikiem; nowa liczba `BLOKUJE`
z komendą; imienna lista pozycji, które **zostały** otwarte, z powodem. **Commit po `R2`.**

## R3 — TRZY ROZSTRZYGNIĘCIA NA COMMICIE „CHECKPOINT" (rdzeń)

`af75a84e37` (*checkpoint: preserve wave 3 owner review work*) i `4a36e8a745`
(*checkpoint wave 3 recovery candidate*, użyty **dwukrotnie**) zamykają trzy pozycje:
`MYW-CV-REC-001`, `MYW-DEC-REC-001`, `MYWORK-DEC-OWN-001`. **Bramka je przepuszcza, bo
sprawdza istnienie commita, a nie jego treść.** To jest dowód cytatu, nie dowód naprawy.

Dla **każdej z trzech** rozstrzygasz jedno z trojga:

- **znajdujesz SHA realnej zmiany** — commit, którego diff **dotyka obiektu pozycji**;
  cytujesz `git show --stat <sha>` i pokazujesz, że zmiana dotyczy właśnie tej rzeczy;
- **przeklasyfikowujesz pozycję** na `NIEROZSTRZYGNIETE` z opisem, czego brakuje;
- **zostawiasz `checkpoint`, ale świadomie i na piśmie** — wiersz w tabeli decyzji, cytat
  starej i nowej reguły, i **uzasadnienie, dlaczego commit-migawka jest w tym wypadku
  wystarczającym dowodem**. Bez takiego wiersza wariant jest niedopuszczalny.

**★ Wzmocnienie narzędzia (obowiązkowe).** Niezależnie od rozstrzygnięcia trzech pozycji,
`gitShaState()` ma zacząć **odróżniać commit funkcyjny od migawki**: minimum to odczyt
tematu commita i osobny stan (np. `SHA_CHECKPOINT`), który **jest raportowany w rejestrze**.
Czy taki stan blokuje, czy tylko oznacza — rozstrzygasz i wpisujesz do tabeli decyzji;
**cichy brak rozróżnienia jest wykluczony**.

**★★ DOWÓD MUTACYJNY — celuje w ZABEZPIECZENIE.** Podstaw do `DAY320_RESOLUTIONS` wpis
z SHA commita `checkpoint` dla pozycji, która dziś przechodzi, i pokaż, że **po Twojej
zmianie** rejestr to **widzi** (nowy stan albo `BLOKUJE`), a **przed nią** przechodziło
jako `NAPRAWIONE`. Mutacja odwrotna: usuń rozróżnienie i pokaż, że nowy test **czerwieni
się**. Cofasz przez `cp` (`Z27`); `git diff` po cofnięciu **pusty**.

**Wymagany dowód:** trzy wiersze rozstrzygnięcia z `git show --stat`, wiersz w tabeli
decyzji, mutacja w obie strony, nowa liczba `BLOKUJE`. **Commit po `R3`.**

## R4 — DZIEDZICZENIE `DEC`: ZMIERZ, NIE RUSZAJ (rdzeń)

Mechanizm jest **poprawny i broniony** — masz go **zmierzyć i udokumentować w raporcie**,
a nie zmieniać.

1. **Dwa przebiegi**: z dziedziczeniem i bez (tymczasowa mutacja `addOwnerEvidence()`,
   cofnięta przez `cp`). U mnie `17 → 39`, delta **22**.
2. **Rozstrzygnij rozbieżność liczb.** Teza zlecenia mówi, że delta równa się **dokładnie**
   liczbie wierszy `| R-N … DEC-…` w dokumencie decyzji właściciela. Ja naliczyłem tych
   wierszy **20**, a delta wyszła **22**. **Zmierz oba i napisz, skąd bierze się różnica**
   — albo pokaż, że różnicy u Ciebie nie ma. To jest jedyna pozycja tego dyżuru, w której
   głównym produktem jest **wyjaśnienie**, a nie zmiana.
3. **Imienna lista** pozycji, których werdykt stoi na dziedziczeniu, z rodziną i decyzją.
   Kolumna `inheritance` w rejestrze już to niesie — wypisz ją.
4. **Potwierdź celność bezpiecznika**: wyłączenie dziedziczenia ma czerwienić **dokładnie
   jeden** test, nie „jakieś testy". Podaj **pełną nazwę** czerwonego przypadku (`Z37`).

**Wymagany dowód:** dwie liczby z komendami, wyjaśnienie różnicy 22 vs 20, imienna lista,
pełna nazwa czerwonego testu, `git diff` po cofnięciu mutacji (pusty). **Commit po `R4`.**

## R5 — SPROSTOWANIE PROZY RAPORTU 301

Proza §R6 raportu 301 nazywa blokującymi `MYW-PHOTO-003`, `-005`, `-010`, `-011`, a rejestr
daje im `ODLOZONE_DEC` (003, 010) i `ZAMKNIETE_DEC` (005, 011). **Rację ma rejestr.**

- **Sprostowanie dopisujesz OBOK, nie zamiast** — z datą, z komendą i z cytatem obu wersji.
- **Sprawdź WSZYSTKIE pozycje wymienione w tamtym akapicie, nie tylko te cztery.** Praca
  per zgłoszenie daje „poprawne w 2 z 3"; wypisz rodzeństwo, zanim uznasz rodzinę za
  rozliczoną.
- Jeżeli dyżur 320 już naniósł to sprostowanie — **sprawdź to i napisz wprost, że pozycja
  jest bezprzedmiotowa**, z `git log` na tym pliku. Powtórne dopisanie tego samego
  sprostowania byłoby drugim rejestrem tej samej rzeczy.

**Wymagany dowód:** `git diff` sprostowania albo dowód, że już istnieje; lista wszystkich
pozycji z tamtego akapitu z ich werdyktem z rejestru. **Commit po `R5`.**

## R6 — RAPORT

Raport zawiera: stan PRZED/PO (kod wyjścia, `BLOKUJE`, rozkład powodów), **cztery liczby
z dwóch klonów** z `R1`, akapit o wyzwalaczach `test-suite.yml`, tabelę 17 rozstrzygnięć
z `R2`, trzy wiersze `checkpoint` z `R3` z `git show --stat`, tabelę decyzji (co zmieniłeś
w regule i dlaczego), dwie liczby dziedziczenia i wyjaśnienie różnicy z `R4`, stan
sprostowania z `R5`, **wszystkie dowody mutacyjne dosłownie**, listę rozbieżności wobec
liczb tej instrukcji i **niepustą sekcję „TWIERDZENIA NIEZWERYFIKOWANE"**.

Dodatkowo, obowiązkowo: **akapit `§0.2e`** dla każdego uruchomionego pakietu — która
z pułapek (a)–(e) go dotyczy, jak ją wyłączyłeś i co dowodzi, że wyłączyłeś. Dla licznika
dopuszczalne „nie dotyczy" **z komendą pokazującą, że dany strażnik nie leży na ścieżce**.

## Próg odbioru

Bramka G20 jest **zamykana przez maszynę**, z liczbą **identyczną w klonie pełnym
i w warunkach CI**, i **bez ani jednej pozycji stojącej na commicie „checkpoint"** —
albo z jawnym wierszem w tabeli decyzji, który taki commit dopuszcza z uzasadnieniem.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „naprawa `fetch-depth`
udowodniona parą klonów (49 kontra 17), 17 pozycji dostało obiekt rozstrzygnięcia,
z czego N zamknięte SHA-mi funkcyjnymi, M zostało otwartych z opisem braku; trzy
rozstrzygnięcia `checkpoint` wymienione albo przeklasyfikowane; narzędzie odróżnia migawkę
od commita funkcyjnego" — **jest pełnowartościowym wynikiem i domyka G20 od strony
narzędzia**.

Zdanie „G20 zamknięta" postawione na liczbie, która spadła przez przeniesienie pozycji do
innego kubełka, **nie jest warte nic**.

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: **sprawdzasz
warunek NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na zapamiętanym wyniku.**
Wynik ponownego sprawdzenia wklejasz do raportu z datą i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Potwierdź w realnym przebiegu CI" vs `Z39` („zakaz uruchamiania realnych workflow") | Sekcja „ROZSTRZYGNIĘCIE… (3)" i `R1`: wiążąca jest **reprodukcja offline** parą klonów `file://`; realnego workflow **nie wywołujesz** |
| „Potwierdź w CI" vs „workflow nie reaguje na naszą gałąź" | `R1` punkt 3: fakt zapisujesz w raporcie jako **wynik**, nie jako przeszkodę; bramka zacznie biec dopiero po scaleniu na `Londyn`/`demo` |
| „Bramka ma być zielona" vs „`BLOKUJE = 17` dziś" | `R2`: bramka ma **dziś być czerwona** — to jest zamierzone; zakaz `continue-on-error`, warunku `if:` i progu tolerancji stoi w tabeli licencji i w `Z40` |
| „Zmniejsz liczbę `BLOKUJE`" vs „nie przenoś pozycji do innego kubełka" | `R2`, zakaz nadrzędny: liczba spada **wyłącznie** przez rozstrzygnięcie obiektu, wiersz po wierszu |
| „`checkpoint` przechodzi bramkę" vs „to nie jest dowód naprawy" | `R3`: trzy drogi rozstrzygnięcia, w tym świadome dopuszczenie **z wierszem w tabeli decyzji**; cichy brak rozróżnienia wykluczony |
| „Nie zmieniasz semantyki werdyktów" vs „`R3` dokłada stan `SHA_CHECKPOINT`" | Tabela licencji, wiersz „Narzędzie": zmiana semantyki **wymaga wiersza w tabeli decyzji raportu** — i taki wiersz jest w `R3` wymagany wprost |
| „Nie usuwasz dziedziczenia `DEC`" vs „`R4` każe je wyłączyć" | `R4` punkt 1: wyłączenie jest **tymczasową mutacją pomiarową**, cofaną przez `cp`; `git diff` po cofnięciu ma być pusty |
| „Zero nowych dokumentów" (`Z13`) vs „sprostowanie w raporcie 301 i wiersz w rejestrze znalezisk" | Tabela licencji: to są **AKTUALIZACJE istniejących** dokumentów, dopisywane, nigdy nadpisywane; nowy dokument jest dokładnie jeden — raport `R6` |
| „`§0.2c` (A) każe postawić kontener" vs „ten dyżur nie dotyka bazy" | Sekcja „ROZSTRZYGNIĘCIE… (1)": wiążący wariant **(C)**; porty zostają zarezerwowane i nieużyte |
| „`§0.2c` (B) każe uruchomić pakiet przez `vitest`" vs „pakiet działa pod `node --test`" | Sekcja „ROZSTRZYGNIĘCIE… (2)": wiążąca komenda `node --test`; `No test files found` **nie jest** `PASS` |
| „Klony ułatwiają dowód" vs „`Z13` zabrania plików wynikowych w repo" i próg 5 GB | `R1`, akapit „Sprzątanie": klony leżą **poza repo**, są kasowane po pomiarze, `df -h /` przed i po |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 11 par, w tym **sprzeczność zlecenia z `Z39`** rozstrzygnięta na korzyść reprodukcji offline |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — wszystkie ścieżki sprawdzone `[ -e ]`; jedyny nowy plik to raport `R6` |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 12 wierszy; **wiersze 5 i 6 zmierzone realnymi klonami przy wydaniu** |
| 4 | Tabela licencji kompletna, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — w każdym wierszu stoi rzeczownik-produkt |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R1`–`R5` nie wymagają `auth.middleware.ts` ani `Gateway.ts`; `test-suite.yml` i `package.json` mają **wąską, imienną licencję** |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — `lsof` na `6354`/`5494` puste, brak kontenera `cx-day328-pg`, brak gałęzi i worktree; 327 i 329 mają rozłączne porty i rozłączne pliki; **przedział migracji nieprzydzielony** |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z markera, łącznie z parą klonów |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — `§0.2d` w komplecie; pułapki właściwe: `vitest` kontra `node --test`, filtr gałęzi w workflow, dysk zjadany przez klony |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany", zero pól szablonu | TAK — kontrola generatora przy wydaniu |
