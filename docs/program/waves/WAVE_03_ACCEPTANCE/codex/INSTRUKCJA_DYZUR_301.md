# INSTRUKCJA DYŻURU nr 301 — Codex — „★★★ Zdanie „22 pozycje blokują `G20`” jest dziś ręcznym odejmowaniem w trzech dokumentach naraz — a program już raz zapłacił za licznik, który mierzył różnicę dwóch rejestrów zamiast stanu rzeczy: ten dyżur pisze `scripts/dev/p0p1-licznik-e1.mjs`, który (1) wczytuje CZTERY źródła (`ROZLICZENIE_P0P1_20260903.md`, `ROZLICZENIE_P0P1_DECYZJE_20260903.md`, `DECYZJE_WLASCICIELA_P0P1_20260904.md`, `FALA_2_PO_STAGINGU.md`) plus ledger `OWNER_DECISION_LEDGER_2026-08-24.md`, (2) dla KAŻDEJ pozycji ustala dokładnie jeden werdykt z zamkniętego zbioru — `NAPRAWIONE` (z SHA, który MUSI istnieć i być przodkiem `HEAD`), `ZAMKNIETE_DEC` (z numerem `DEC`), `ODLOZONE_DEC` (z numerem `DEC`), `W_BUDOWIE` (z numerem dyżuru Codexa) albo `BLOKUJE` (brak jakiejkolwiek decyzji), (3) drukuje tabelę i JEDNĄ liczbę `BLOKUJE`, (4) generuje `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md` wyłącznie ze swojego wyjścia — plik jest wytworem skryptu, nie ręcznym dokumentem, (5) rozwiązuje kolizję identyfikatorów `ASM-OWN-001`…`ASM-OWN-028`, które w tym korpusie oznaczają DWA różne zbiory pozycji, jawnym sufiksem `[OF]` dla zbioru z `owner_feedback/04_ASSESSMENT/OWNER_FEEDBACK_REGISTER.md` (konwencja już użyta w `ROZLICZENIE_P0P1_DECYZJE_20260903.md`, przejmujesz ją, nie wymyślasz nowej), (6) ma test, który wywraca się, gdy ktoś doda pozycję bez werdyktu albo poda `DEC`, którego w ledgerze nie ma. ★ Zero zmian w `src/` i `server/src`."

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
> **wyłącznie** `/private/tmp/cx-day301-licznik-p0p1`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `416432abaf`**
> **Gałąź bazowa: `github-backup/grafika/m03-20260902`**
> **Stan dokumentu: WYDANY**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo jakiekolwiek niewypelnione pole szablonu — **dokument nie
> jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.
> Ta ramka jest **jedynym** miejscem, w którym rozstrzyga się stan wydania.
> Objaśnienia w innych blokach cytowanych **nie** są powodem do STOP-u.

Data wystawienia: 2026-09-03.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.
Zakres: ****PROGRAM — licznik bramki `G20` według reguły `E1`.** Właściciel 03.09 wieczorem przyjął regułę `E1` (`DEC-2026-09-03-362`, wiersz 414 w `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md`): pozycje ZAMKNIĘTE albo ODŁOŻONE decyzją właściciela z numerem `DEC` w rejestrze **nie blokują** bramki `G20`; blokują wyłącznie pozycje bez żadnej decyzji. Dziś ta reguła istnieje jako zdanie w rejestrze i jako ręcznie policzone liczby w trzech dokumentach, które nikt nie umie odtworzyć jednym poleceniem. Źródła: `ROZLICZENIE_P0P1_20260903.md` (386 linii, 85 unikalnych identyfikatorów pozycji), `ROZLICZENIE_P0P1_DECYZJE_20260903.md` (240 linii, 52 identyfikatory; sekcja `R1c` mówi o 32 pozycjach: 24 `ASM[OF]` + 8 `TLS`), `DECYZJE_WLASCICIELA_P0P1_20260904.md` (349 linii, 56 ponumerowanych wierszy — rodziny `R-1`…`R-20`), `FALA_2_PO_STAGINGU.md` (78 linii, 21 wierszy rejestru) oraz ledger (437 linii, **385 wierszy `DEC`**). Ten dyżur zamienia to w SKRYPT, który liczy sam i którego wynik da się sprawdzić mutacją.**.
Trasy front: `Brak — dyżur nie dotyka interfejsu. Jeżeli w trakcie pracy zobaczysz pozycję, której werdykt wymaga spojrzenia na ekran, NIE otwierasz przeglądarki: wpisujesz ją do kolumny „wymaga dowodu wzrokowego” i podajesz, który ekran trzeba obejrzeć oraz w którym dyżurze.`. Trasy tył: `Brak zmian po stronie serwera. Skrypt czyta wyłącznie pliki `docs/` i historię gita (`git cat-file -e <SHA>`, `git merge-base --is-ancestor <SHA> HEAD`) — każdy cytowany SHA musi być zweryfikowany, bo poprzednie rozliczenie robiło to ręcznie dla 24 SHA i to jest dokładnie ta praca, którą chcemy zautomatyzować.`.

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
WT=/private/tmp/cx-day301-licznik-p0p1
MARKER=416432abaf

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/grafika/m03-20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day301-licznik-p0p1-e1-20260903 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day301-licznik-p0p1/config.worktree"
cat "$VAULT/worktrees/cx-day301-licznik-p0p1/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day301-licznik-p0p1-scratch
mkdir -p /private/tmp/cx-day301-licznik-p0p1-artefakty

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
git -C "$VAULT" log --oneline 416432abaf..github-backup/grafika/m03-20260902
git -C "$VAULT" diff --name-only 416432abaf..github-backup/grafika/m03-20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day301-licznik-p0p1-e1-20260903
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 416432abaf..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `6` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"
W=docs/program/waves/WAVE_03_ACCEPTANCE

# (1) TEZA: regula E1 stoi w ledgerze jako DEC-2026-09-03-362
grep -n 'DEC-2026-09-03-362' $W/OWNER_DECISION_LEDGER_2026-08-24.md | cut -c1-200
grep -coE '^\| *DEC-' $W/OWNER_DECISION_LEDGER_2026-08-24.md
#   oczekiwane: trafienie w okolicy linii 414; 385 wierszy DEC — zapisz SWOJE liczby

# (2) TEZA: cztery zrodla maja tyle pozycji, ile mowie
wc -l $W/ROZLICZENIE_P0P1_20260903.md $W/ROZLICZENIE_P0P1_DECYZJE_20260903.md docs/program/DECYZJE_WLASCICIELA_P0P1_20260904.md docs/program/FALA_2_PO_STAGINGU.md
grep -oE '[A-Z]{2,6}-OWN-[0-9]{3}' $W/ROZLICZENIE_P0P1_20260903.md | sort -u | wc -l
grep -cE '^\| [0-9]+ \|' docs/program/DECYZJE_WLASCICIELA_P0P1_20260904.md
#   oczekiwane: 386 / 240 / 349 / 78 linii; 85 unikalnych ID; 56 ponumerowanych wierszy

# (3) TEZA: kolizja ASM-OWN-0XX jest realna, a sufiks [OF] juz istnieje
grep -n 'OF\]' $W/ROZLICZENIE_P0P1_DECYZJE_20260903.md | head -5
grep -oE 'ASM-OWN-0[0-9]{2}' $W/ROZLICZENIE_P0P1_20260903.md | sort -u | wc -l
#   oczekiwane: konwencja [OF] uzyta juz w R1c; 27 numerow ASM-OWN — sprawdz, ktore naleza do KTOREGO zbioru

# (4) TEZA: liczba 22 pochodzi z rozmowy, nie z pomiaru
grep -n 'z 56 do 22' $W/OWNER_DECISION_LEDGER_2026-08-24.md | cut -c1-160
#   oczekiwane: jedno trafienie. To jest TEZA DO OBALENIA ALBO POTWIERDZENIA TWOIM SKRYPTEM.

# (5) TEZA: wzorzec testu dla pliku .mjs istnieje w repo
ls scripts/wave3/__tests__/report-acceptance-gates.test.mjs 2>/dev/null && head -12 scripts/wave3/__tests__/report-acceptance-gates.test.mjs
#   oczekiwane: plik albo jego brak — rozstrzyga, ktorym runnerem piszesz swoj test

# (6) TEZA: dysk wolny; porty nie beda potrzebne, ale sprawdzasz
lsof -nP -iTCP:5280 -sTCP:LISTEN; lsof -nP -iTCP:5281 -sTCP:LISTEN; lsof -nP -iTCP:6305 -sTCP:LISTEN
df -h /
#   oczekiwane: puste lsof, powyzej 3 GB wolnego
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day301-licznik-p0p1-e1-20260903` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6305`. Twój JEDYNY port harnessu to `5280 i 5281`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day301-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta listy restricted ports Chromium. Zajęte przez inne prace (nie ruszasz): 3020, 3022, 3025, 3027, 3030 (tor grafiki nadzorcy), 5322, 5410-5441 (agenci nadzorcy), 5442-5449 oraz 6311-6313 (odbiorcy nadzorcy), 5432 i 5433 (Postgres hosta), 6012, 6379 (redis), 7000, 7679, 7768, 11434. Cudze — dyżury 286-300 (bazy 6290-6304, harness 5250-5279) oraz rodzeństwo z tej paczki: 302 (6306, 5282-5283), 303 (6307, 5284-5285), 304 (6308, 5286-5287), 305 (6309, 5288-5289), 306 (6310, 5290-5291), 307 (6314, 5292-5293), 308 (6315, 5294-5295), 309 (6316, 5296-5297), 310 (6317, 5298-5299), 311 (6318, 5300-5301). Twoje własne: baza 6305, harness 5280 i 5281. Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps. ★ ZAKAZ `pkill`/`killall` na `node`, `vite`, `playwright`, `grafika-zrzuty` — zabijasz wyłącznie własne PID-y (zapisz `$!`). ★ Ten dyżur nie potrzebuje bazy ani przeglądarki — kontener i porty są przypisane wyłącznie na wypadek, gdybyś musiał coś zweryfikować na żywej bazie; jeśli nie musisz, nie uruchamiasz ich wcale.`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `Brak flag — to narzędzie, nie funkcja produktu. Jeżeli skrypt miałby cokolwiek zmieniać w zachowaniu aplikacji, znaczy to, że wyszedłeś poza zakres.`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``scripts/dev/__tests__/p0p1-licznik-e1.test.mjs` (nowy — musi mieć dowód mutacyjny dla każdego twierdzenia) · `node scripts/dev/p0p1-licznik-e1.mjs` uruchomione dwukrotnie daje identyczny plik (wynik powtarzalny) · `scripts/check-list-canon.sh` (hook; nie dotyczy zakresu, nie omijaj) · zero zmian w `git diff --name-only -- src server/src``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY301_LICZNIK_P0P1_E1_REPORT.md`. Dozwolone nowe pliki: `scripts/dev/p0p1-licznik-e1.mjs`, `scripts/dev/__tests__/p0p1-licznik-e1.test.mjs`, `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md` (GENEROWANY) oraz raport pod `SCIEZKA_RAPORTU`. Nowe pliki w `scripts/` i `tests/` wymagają `git add -f`. **ZAKAZ edycji `MODULE_ACCEPTANCE.md` i plików źródłowych rozliczeń.**. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day301-licznik-p0p1-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day301-licznik-p0p1-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ zmian w `src/` i `server/src`** — to dyżur narzędziowy i audytowy. **ZAKAZ ręcznego pisania `REJESTR_P0P1_BLOKUJACE_G20.md`** — plik ma być wytworem skryptu, sprawdzalnym przez ponowne uruchomienie. **ZAKAZ stawiania werdyktu `NAPRAWIONE` bez zweryfikowanego gitem SHA.** **ZAKAZ zaliczania pozycji do kategorii bezpiecznej, gdy skrypt nie umiał jej rozstrzygnąć.** **ZAKAZ edycji plików źródłowych rozliczeń** (`ROZLICZENIE_P0P1_*`, `DECYZJE_WLASCICIELA_*`, ledger) — czytasz je, nie poprawiasz; rozbieżności wypisujesz w raporcie. **ZAKAZ edycji `MODULE_ACCEPTANCE.md`.** **ZAKAZ `git stash`.** **ZAKAZ `pkill`.** **ZAKAZ `--no-verify`.** | Bramka `G20` ma warunek „zero otwartych P0/P1”. Dopóki ten warunek jest ręcznym odejmowaniem w trzech dokumentach, nikt nie umie go powtórzyć ani obalić — a program ma już zapisany kształt fałszywego gotowe, w którym licznik mierzył RÓŻNICĘ DWÓCH REJESTRÓW zamiast rzeczywistego braku. Reguła `E1` bez skryptu jest zdaniem; ze skryptem jest bramką. Drugi powód: kolizja identyfikatorów `ASM-OWN-0XX` sprawia, że dwa różne zbiory pozycji wyglądają na jeden — przy promocji na demo to jest ryzyko policzenia zamkniętej pozycji zamiast otwartej. |

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
cd /private/tmp/cx-day301-licznik-p0p1

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day301-pg psql -U postgres -d cx301 \
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
cd /private/tmp/cx-day301-licznik-p0p1

docker run -d --name cx-day301-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx301 \
  -p 127.0.0.1:6305:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day301-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6305/cx301 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6305/cx301 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day301-licznik-p0p1 && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6305/cx301 \
JWT_SECRET=cx301-test-secret-do-not-reuse \
npx vitest run testy: `node --test scripts/dev/__tests__/p0p1-licznik-e1.test.mjs` albo `npx vitest run scripts/dev/__tests__/p0p1-licznik-e1.test.mjs` (ustal, którym runnerem chodzą pliki `.mjs` w tym repo — `scripts/wave3/__tests__/report-acceptance-gates.test.mjs` jest wzorcem, sprawdź jego nagłówek); dowód główny = powtarzalne uruchomienie skryptu + tabela werdyktów + opis każdej różnicy wobec liczby 22 z ledgera --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day301-licznik-p0p1-artefakty/day301-licznik-p0p1.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day301-licznik-p0p1 && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run testy: `node --test scripts/dev/__tests__/p0p1-licznik-e1.test.mjs` albo `npx vitest run scripts/dev/__tests__/p0p1-licznik-e1.test.mjs` (ustal, którym runnerem chodzą pliki `.mjs` w tym repo — `scripts/wave3/__tests__/report-acceptance-gates.test.mjs` jest wzorcem, sprawdź jego nagłówek); dowód główny = powtarzalne uruchomienie skryptu + tabela werdyktów + opis każdej różnicy wobec liczby 22 z ledgera --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day301-licznik-p0p1-artefakty/day301-licznik-p0p1.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day301-licznik-p0p1/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day301-pg psql -U postgres -d cx301 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day301-pg`.
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
> **(e) ★★★ SIEDEM PUŁAPEK. (1) ★ **Licznik mierzy OBIEKT, nie WPIS.** Werdykt `NAPRAWIONE` wolno postawić tylko wtedy, gdy cytowany SHA istnieje ORAZ jest przodkiem `HEAD` — sam wpis w dokumencie nie jest dowodem. Skrypt sprawdza to gitem i przy braku SHA stawia `BLOKUJE` z powodem `SHA_NIEISTNIEJACY`, nigdy nie ufa tekstowi. (2) **Brak pomiaru nie jest wynikiem.** Pozycja, dla której skrypt nie umie ustalić werdyktu, ląduje w `BLOKUJE` z powodem `NIEROZSTRZYGNIETE`, nie znika i nie trafia do żadnej kategorii bezpiecznej. Podłoga liczebności: jeśli po parsowaniu pozycji jest mniej niż 100, skrypt kończy się błędem („mianownik mniejszy niż spodziewany — parser zgubił źródło”), zamiast wypisać dumne zero. (3) **Kolizja identyfikatorów**: `ASM-OWN-001`…`ASM-OWN-028` występuje w DWÓCH różnych zbiorach. Sufiks `[OF]` dla zbioru z `owner_feedback` jest już użyty w `ROZLICZENIE_P0P1_DECYZJE_20260903.md` (linia 13 i sekcja `R1c`) — przejmujesz tę konwencję. Skrypt ma jawny test na to, że dwie pozycje o tym samym numerze i różnym zbiorze NIE zlewają się w jedną. (4) **Nie ufaj mojej liczbie 22.** Ledger mówi: reguła plus `DEC-364`…`DEC-383` sprowadza mianownik z 56 do 22. To liczba nadzorcy z rozmowy, nie wynik pomiaru. Twój skrypt ma ją policzyć niezależnie; jeżeli wyjdzie inna, obowiązuje Twoja, a różnicę opisujesz z nazwy pozycji. (5) **`DEC` musi istnieć.** Werdykt `ZAMKNIETE_DEC`/`ODLOZONE_DEC` wymaga numeru, który da się znaleźć w ledgerze — test negatywny: wstaw do źródła `DEC-2026-09-03-999`, skrypt ma się zaczerwienić. (6) **Cudzysłowy w skryptach**: pliki źródłowe są po polsku, z `„”`, myślnikami i `★`. Nie buduj wyrażeń regularnych przez sklejanie w powłoce; skrypt czyta pliki i parsuje w Node, a Ty nie przepuszczasz treści przez `heredoc` w powłoce. (7) **Dowód poza repo wyparowuje**: wszystko, co skrypt produkuje, ląduje w repo (`docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md`), nigdy w katalogu tymczasowym cytowanym w raporcie.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day301-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day301-licznik-p0p1-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (pomiar źródeł: ile pozycji w każdym z czterech plików, ile identyfikatorów unikalnych, ile wierszy `DEC` w ledgerze, gdzie występuje kolizja `ASM-OWN-0XX`; tabela źródło · liczba pozycji · format wiersza) · R2 (`scripts/dev/p0p1-licznik-e1.mjs`: parser czterech źródeł + ledgera, zamknięty zbiór werdyktów, weryfikacja SHA gitem, weryfikacja istnienia `DEC`, podłoga liczebności, sufiks `[OF]`) · R3 (generowanie `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md` wyłącznie z wyjścia skryptu; nagłówek z datą, markerem i komendą odtwarzającą) · R4 (`scripts/dev/__tests__/p0p1-licznik-e1.test.mjs`: test kolizji identyfikatorów, test nieistniejącego `DEC`, test nieistniejącego SHA, test podłogi liczebności, test „pozycja bez werdyktu ląduje w BLOKUJE”; dowody mutacyjne dla każdego) · R5 (uruchomienie na realnych źródłach, tabela wyników, porównanie z liczbą 22 z ledgera i opis KAŻDEJ różnicy z nazwy pozycji) · R6 (raport: liczba `BLOKUJE`, rozbieżności wobec dokumentów, pozycje wymagające dowodu wzrokowego, TWIERDZENIA NIEZWERYFIKOWANE)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6305` albo `5280 i 5281` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6305` albo `5280 i 5281`** (`Z7`).

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

Bramka `G20` ma warunek „zero otwartych P0/P1”. Dziś ten warunek jest ręcznym odejmowaniem
w trzech dokumentach i nikt nie umie go powtórzyć ani obalić. Program ma już zapisany kształt
fałszywego gotowe, w którym licznik mierzył różnicę dwóch rejestrów zamiast rzeczywistego braku
w bazie. Reguła `E1` bez skryptu jest zdaniem; ze skryptem jest bramką.

## ★ Zmierz moje liczby sam

Twierdzę: ledger ma 385 wierszy `DEC` i regułę `E1` jako `DEC-2026-09-03-362`; źródła mają
386 / 240 / 349 / 78 linii; w pierwszym rozliczeniu jest 85 unikalnych identyfikatorów;
pakiet decyzji ma 56 ponumerowanych wierszy; sufiks `[OF]` jest już użyty. Komendy z §0.3
to sprawdzają. **Jeśli Twój pomiar przeczy mojej liczbie, obowiązuje Twój.**

★★ Osobno: liczba **22 pozycje blokujące** pochodzi z rozmowy zapisanej w ledgerze, nie
z pomiaru. Twój skrypt ma ją policzyć niezależnie. Jeśli wyjdzie inna, obowiązuje Twoja,
a każdą różnicę opisujesz z nazwy pozycji — nie zaokrąglasz do mojej.

## R1 — POMIAR ŹRÓDEŁ (rdzeń)

Ile pozycji w każdym z czterech plików, ile identyfikatorów unikalnych, gdzie dokładnie leży
kolizja `ASM-OWN-0XX` i które numery należą do którego zbioru. Tabela źródło · liczba pozycji ·
format wiersza — parser powstaje z tej tabeli, nie z domysłu.

Commit po `R1`.

## R2 — SKRYPT (rdzeń)

`scripts/dev/p0p1-licznik-e1.mjs`. Zamknięty zbiór werdyktów: `NAPRAWIONE` (SHA zweryfikowany
gitem), `ZAMKNIETE_DEC`, `ODLOZONE_DEC`, `W_BUDOWIE` (numer dyżuru), `BLOKUJE`. Pozycja, której
skrypt nie umie rozstrzygnąć, ląduje w `BLOKUJE` z powodem — nigdy nie znika i nigdy nie trafia
do kategorii bezpiecznej. Podłoga liczebności: mniej niż 100 pozycji po parsowaniu to błąd
skryptu, nie dumne zero.

Commit po `R2`.

## R3 — REJESTR GENEROWANY (rdzeń)

`REJESTR_P0P1_BLOKUJACE_G20.md` powstaje wyłącznie z wyjścia skryptu, z nagłówkiem podającym
datę, marker i komendę odtwarzającą. Dwa uruchomienia mają dać identyczny plik.

Commit po `R3`.

## R4 — TESTY Z DOWODEM MUTACYJNYM (rdzeń)

Pięć twierdzeń, każde z mutacją: dwie pozycje o tym samym numerze i różnym zbiorze nie zlewają
się w jedną; nieistniejący numer decyzji czerwieni skrypt; nieistniejący SHA czerwieni skrypt;
podłoga liczebności działa; pozycja bez werdyktu ląduje w `BLOKUJE`.

Commit po `R4`.

## R5 — URUCHOMIENIE NA REALNYCH ŹRÓDŁACH (rdzeń)

Tabela wyników. Porównanie z liczbą 22 z ledgera. Każda różnica opisana z nazwy pozycji,
z podaniem, po której stronie leży błąd: w moim zdaniu, w dokumencie źródłowym czy w parserze.

Commit po `R5`.

## R6 — RAPORT

Liczba `BLOKUJE`. Rozbieżności wobec dokumentów. Pozycje wymagające dowodu wzrokowego,
z nazwą ekranu i wskazaniem dyżuru. TWIERDZENIA NIEZWERYFIKOWANE.

## Prawo zatrzymania

„Skrypt gotowy, parser rozstrzyga 96 pozycji ze 121, 25 wypisanych z nazwy jako nierozstrzygnięte”
jest wynikiem — i lepszym niż okrągła liczba bez pokrycia. Liczba `BLOKUJE`, której nie da się
odtworzyć ponownym uruchomieniem, nie jest warta nic.
