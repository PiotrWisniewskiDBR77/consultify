# INSTRUKCJA DYŻURU nr 327 — Codex — „★★★ BEZPIECZNIKI, KTÓRE NIE MIERZĄ — RODZINA, NIE POJEDYNCZY PRZYPADEK: pięć zmierzonych 04.09 bezpieczników przechodzi mutację, którą miał złapać (audyt PL/EN orzeka domyślnie „uzasadnione”, więc nowy napis „Milestone” daje defects=0; ratchet JSX z dyżuru 316 deklaruje sześć plików, a filtr `.tsx` sprawia, że otwiera trzy; guard wycieków HTTP nie zbiera nazwy zmiennej z formy `.catch((problem) => ...)` — 72 takie miejsca w trasach; ratchet martwego kodu z 297 pilnuje wyłącznie klasy `unreachable`, a 1010 plików siedzi w klasie `test-only`; guard DDL z 319 pomija 24 pliki `__tests__` z 58 wystąpieniami, bez wiersza uzasadniającego wymaganego przez własną regułę) — ten dyżur ZWĘŻA wykluczenia z dowodem mutacyjnym w obie strony, osobno mierzy DŁUG ODSŁONIĘTY i jako POZYCJĘ ZEROWĄ liczy całą rodzinę bezpieczników w repo, bo pięć to prawdopodobnie próbka"

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
> **wyłącznie** `/private/tmp/cx-day327-bezpieczniki-slepe`.

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
Zakres: **PRZEKROJOWE — BEZPIECZNIKI (ratchety, bramki zapadkowe, skanery repo). Zwężenie wykluczeń w pięciu zmierzonych bezpiecznikach, pomiar długu odsłoniętego i inwentarz całej rodziny bezpieczników w repo**.
Trasy front: `brak tras HTTP — to jest praca na WARSTWIE BEZPIECZNIKOW: `scripts/dev/i18n-pl-audyt.mjs`, `tests/unit/config/i18nParity.test.ts`, `tests/unit/config/i18nAuditClassification.test.ts`, `tests/unit/frontend/noRawErrorInJsx.test.ts``. Trasy tył: `brak tras HTTP — `tests/unit/backend/security/noRawErrorMessage.test.ts` i `tests/unit/backend/schema/noRuntimeDdl.test.ts`; obiekty mierzone (`server/src/routes/**`, `server/src/**/__tests__/**`, wymienione pliki w `src/`) są TYLKO DO ODCZYTU i służą wyłącznie za cel tymczasowej mutacji dowodowej cofanej przez `cp``.

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
WT=/private/tmp/cx-day327-bezpieczniki-slepe
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
git -C "$VAULT" worktree add "$WT" -b codex/day327-bezpieczniki-slepe-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day327-bezpieczniki-slepe/config.worktree"
cat "$VAULT/worktrees/cx-day327-bezpieczniki-slepe/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day327-bezpieczniki-slepe-scratch
mkdir -p /private/tmp/cx-day327-bezpieczniki-slepe-artefakty

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
git -C "$WT" push github-backup codex/day327-bezpieczniki-slepe-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 1c3d3da844ae03c87985a8f5dc74846a073c0220..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `7` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA: audyt PL/EN raportuje ZERO defektow, bo domyslna klasa to UZASADNIONE
node scripts/dev/i18n-pl-audyt.mjs
git checkout -- docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_JEZYK_PL_20260903.md
sed -n '120,124p' scripts/dev/i18n-pl-audyt.mjs
#   moje liczby: {"plLeaves":34325,"enLeaves":32336,"identical":505,"defects":0,
#   "justified":505,"defektEn":0,"plOnly":2005}. Ostatnia linia justification() to
#   `return 'termin dopuszczony po przegladzie semantycznym';` — czyli DOMYSLNA klasa
#   kazdego napisu to UZASADNIONE. ★ Ta komenda NADPISUJE rejestr; przywroc go tak,
#   jak pokazano wyzej.

# (2) TEZA: DEFEKT-PL rozpoznaje wylacznie liste wpisana na twardo (73 pozycje)
node -e "import('./scripts/dev/i18n-pl-audyt.mjs').then(m=>console.log('defectPlTranslations =', m.defectPlTranslations.size))"
grep -n "polishWordsInEnglish = " scripts/dev/i18n-pl-audyt.mjs
#   moje liczby: 73 pozycje na liscie DEFEKT-PL; DEFEKT-EN opiera sie na jednym
#   wyrazeniu regularnym ze skonczona lista slow + tescie na znaki diakrytyczne.

# (3) TEZA: noRawErrorInJsx DEKLARUJE 6 plikow, a OTWIERA 3
grep -n "COVERED_FILES = \|endsWith('.tsx')\|RAW_JSX = " tests/unit/frontend/noRawErrorInJsx.test.ts
grep -c "^  'src/" tests/unit/frontend/noRawErrorInJsx.test.ts
#   oczekiwane: `if (!file.endsWith('.tsx')) return [];` w rawErrorInterpolations().
#   Trzy pliki `.ts` z COVERED_FILES (api.ts, useReportBuilder.ts, useReportSections.ts)
#   NIE SA nigdy czytane. Test „obejmuje szesc jawnych plikow rdzenia" sprawdza
#   DLUGOSC TABLICY, nie odczyt.

# (4) TEZA: guard wyciekow HTTP nie zbiera nazwy zmiennej z `.catch((x) => ...)`
grep -n "catchVariableViolations\|VARIABLE_AGNOSTIC_LEAK_BASELINE\|ALTERNATE_LEAK_BASELINE" tests/unit/backend/security/noRawErrorMessage.test.ts
grep -rEoh "\.catch\s*\(\s*(async\s*)?\(\s*[A-Za-z_$][A-Za-z0-9_$]*" server/src/routes/ | wc -l
grep -rEoh "\.catch\s*\(\s*(async\s*)?[A-Za-z_$][A-Za-z0-9_$]*\s*=>" server/src/routes/ | wc -l
#   moje liczby: 72 wystapienia ksztaltu `.catch((ident) => ...)` w `server/src/routes`
#   i 0 wystapien ksztaltu `.catch(ident => ...)`. Zbieracz identyfikatorow w guardzie ma
#   wzorzec /catch\s*\(\s*([A-Za-z_$][\w$]*)/ — po `catch(` widzi DRUGI nawias i nie
#   dopasowuje nazwy. ★ Nadzorca podal „81 miejsc" i teze „ratchet chroni tylko
#   err|error|e". Moj pomiar mowi co innego: test „does not depend on the exception
#   variable name" ISTNIEJE (baseline 47) i obejmuje KAZDA nazwe z bloku `catch (x)`;
#   slepa plama to wylacznie ksztalt promisowy `.catch(cb)`. ZMIERZ SAM i zapisz,
#   ktora wersja jest prawdziwa u Ciebie.

# (5) TEZA: bezpiecznik DDL pomija katalogi __tests__
grep -n "__tests__" tests/unit/backend/schema/noRuntimeDdl.test.ts
node -e "const fs=require('fs'),p=require('path');function w(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>{if(e.isDirectory()&&e.name==='_backup')return[];const t=p.join(d,e.name);return e.isDirectory()?w(t):[t];});}let n=0,t=0;for(const f of w('server/src')){if(!f.includes('/__tests__/'))continue;const m=fs.readFileSync(f,'utf8').match(/CREATE TABLE IF NOT EXISTS/g);if(m){n++;t+=m.length;}}console.log('plikow __tests__ z DDL:',n,'wystapien:',t);"
#   moje liczby: 24 pliki, 58 wystapien `CREATE TABLE IF NOT EXISTS` w `__tests__`.
#   Regula R1 pkt 2 tamtego dyzuru wymaga wiersza uzasadniajacego dla kazdego
#   wylaczenia — dla `__tests__` takiego wiersza NIE MA.

# (6) TEZA: mianownik rodziny — ile jest w repo bezpiecznikow tego rodzaju
grep -oE '"check:[a-z0-9:-]+"' package.json | sort -u | wc -l
for f in $(grep -rlE "readdirSync|readFileSync" tests/ --include="*.ts" --include="*.tsx" 2>/dev/null); do grep -qE "BASELINE|ALLOWED|ALLOWLIST|ratchet|COVERED_FILES" "$f" && echo "$f"; done | wc -l
for f in $(grep -rlE "readdirSync|readFileSync" src server/src --include="*.ts" --include="*.tsx" 2>/dev/null | grep __tests__); do grep -qE "BASELINE|ALLOWED|ALLOWLIST|ratchet|COVERED_FILES" "$f" && echo "$f"; done | wc -l
#   moje liczby: 21 bramek `check:*` w package.json; 16 skanujacych bezpiecznikow
#   w `tests/`; 11 w `__tests__` wewnatrz `src`/`server/src`. To jest mianownik R0.
#   ★ Uruchamiaj to w BASH, nie w zsh — `grep --include` w zsh potrafi zwrocic pustke
#   zamiast wyniku, a pustka NIE JEST wynikiem (§0.2d).

# (7) TEZA: zasoby wolne i bramki kanonu dzis zielone
lsof -nP -iTCP:6353 -sTCP:LISTEN; lsof -nP -iTCP:5493 -sTCP:LISTEN
docker ps -a --format "{{.Names}}" | grep -c cx-day327 || true
bash scripts/check-list-canon.sh >/dev/null 2>&1; echo "list-canon=$?"
bash scripts/check-artefakt.sh  >/dev/null 2>&1; echo "artefakt=$?"
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus-canon=$?"
df -h /
#   oczekiwane: puste lsof, 0 kontenerow, trzy bramki `=0`. Ponizej 5 GB wolnego
#   to STOP calosci (§0.5). Moj pomiar dysku przy wydaniu: 77 GiB wolnego.
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day327-bezpieczniki-slepe-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6353`. Twój JEDYNY port harnessu to `5493`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day327-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta listy restricted ports Chromium. Zajęte przez inne prace (nie ruszasz): 3020, 3022, 3025, 3027, 3030 (tor grafiki nadzorcy), 5322, 5410-5441 (agenci nadzorcy), 5442-5479 oraz 6290-6339 (dyzury 286-323), 5432 i 5433 (Postgres hosta), 6012, 6379 (redis), 7000, 7679, 7768, 11434. Dyżury równoległe tej serii: 327 (baza 6353, harness 5493, kontener cx-day327-pg), 328 (baza 6354, harness 5494, kontener cx-day328-pg), 329 (baza 6355, harness 5495, kontener cx-day329-pg) — do CUDZEJ bazy nie łączysz się nawet do odczytu; każdy inny port z przedziałów 5300-5492, 5496-5499, 6300-6352 i 6356-6399 jest cudzy. Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps. ★ ZAKAZ `pkill`/`killall` na `node`, `vite`, `playwright` — zabijasz wyłącznie własne PID-y (zapisz `$!`).`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak — ten dyżur nie wprowadza ani jednej nowej flagi funkcyjnej i nie zmienia wartości domyślnej żadnej istniejącej`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``.github/workflows/**` w całości (teren dyzuru 328) · `package.json` · `server/src/middleware/auth.middleware.ts`, `server/src/Gateway.ts`, `server/src/middleware/orgContext.middleware.ts`, `server/src/middleware/v8FeatureGate.middleware.ts`, `server/src/middleware/resultsInternalBetaVisibility.middleware.ts` · `scripts/check-list-canon.sh`, `scripts/check-artefakt.sh`, `scripts/check-focus-canon.sh` (hooki — nie omijasz i nie zmieniasz) · `scripts/dev/p0p1-licznik-e1.mjs` i jego pakiet testowy (teren dyzuru 328) · `scripts/dev/reachability-from-root.mjs`, `tests/unit/canon/reachabilityFromRoot.test.ts`, `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` (teren dyzuru 329). ★ W tym dyżurze NIE MA wyjątku od `Z12` — żadna bramka platformowa nie jest zmieniana`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY327_BEZPIECZNIKI_SLEPE_REPORT.md`. ZAKAZ edycji `MODULE_ACCEPTANCE.md` — ten dyżur jest przekrojowy i nie domyka żadnego modułu. Nowe pliki w `tests/` wymagają `git add -f`. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day327-bezpieczniki-slepe-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day327-bezpieczniki-slepe-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ PODNOSZENIA PROGU BEZ POKAZANIA, CO NOWEGO BEZPIECZNIK WIDZI.** Wiersz tabeli `R6` z pustą kolumną „co NOWEGO widzi” = odrzucenie pozycji. **ZAKAZ poszerzania wykluczeń** (`exclude`, `testIgnore`, `continue`, `return []`, filtr rozszerzenia) w jakimkolwiek bezpieczniku — ten dyżur je ZWĘŻA, nigdy nie rozszerza. **ZAKAZ obniżania `ALTERNATE_LEAK_BASELINE`, `VARIABLE_AGNOSTIC_LEAK_BASELINE` i progów `i18nParity`.** **ZAKAZ kasowania listy `defectPlTranslations`** — wolno ją poszerzyć i wolno zmienić jej ROLĘ z definicji defektu na słownik podpowiedzi, ale nie wolno jej usunąć. **ZAKAZ zmiany nazw zmiennych i18next w `{{…}}`** — dyżur 317 rozjechał tak placeholder z wołaczem. **ZAKAZ scalania gałęzi `codex/day297-*` i `codex/day293-*`** oraz zakaz tworzenia u siebie plików z tych gałęzi — to teren dyżuru 329. **ZAKAZ naprawiania wycieków w `server/src/routes` i błędów w `src`** — ten dyżur naprawia BEZPIECZNIKI, nie produkt; mutacje dowodowe są tymczasowe i cofane przez `cp`. **ZAKAZ tworzenia pliku w `server/migrations/`** — przedział nieprzydzielony. **ZAKAZ `git stash`, `pkill`, `killall`, `--no-verify`.** **ZAKAZ edycji `MODULE_ACCEPTANCE.md`** — dyżur jest przekrojowy | Odbiory 04.09 zmierzyły PIĘĆ bezpieczników, które są zielone dlatego, że nie patrzą tam, gdzie boli: klasyfikacja języka domyślnie orzeka „uzasadnione”, ratchet JSX deklaruje sześć plików i otwiera trzy, guard wycieków nie widzi kształtu `.catch(callback)`, ratchet martwego kodu pilnuje jednej z czterech klas, a guard DDL pomija katalogi testowe bez wymaganego przez własną regułę wiersza uzasadniającego. Każdy z nich przeszedł mutację, którą miał złapać. To jest jeden wzorzec, nie pięć usterek — i pięć przypadków to prawdopodobnie próbka, dlatego pierwsza pozycja tego dyżuru liczy CAŁĄ rodzinę. Program zapisał ten kształt trzy razy: „brak pomiaru nie jest wynikiem”, „test scenariusza nie broni zabezpieczenia” i „bezpiecznik nagradza defekt”. Dopóki bezpiecznik nie podaje własnego mianownika, każde „zielono” jest zdaniem o niczym |

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
cd /private/tmp/cx-day327-bezpieczniki-slepe

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day327-pg psql -U postgres -d cx327 \
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
cd /private/tmp/cx-day327-bezpieczniki-slepe

docker run -d --name cx-day327-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx327 \
  -p 127.0.0.1:6353:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day327-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6353/cx327 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6353/cx327 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day327-bezpieczniki-slepe && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6353/cx327 \
JWT_SECRET=cx327-test-secret-do-podpisu-tokenow-w-tym-dyzurze \
npx vitest run tests/unit/config/i18nParity.test.ts tests/unit/config/i18nAuditClassification.test.ts tests/unit/frontend/noRawErrorInJsx.test.ts tests/unit/backend/security/noRawErrorMessage.test.ts tests/unit/backend/schema/noRuntimeDdl.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day327-bezpieczniki-slepe-artefakty/day327-bezpieczniki.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day327-bezpieczniki-slepe && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run tests/unit/config/i18nParity.test.ts tests/unit/config/i18nAuditClassification.test.ts tests/unit/frontend/noRawErrorInJsx.test.ts tests/unit/backend/security/noRawErrorMessage.test.ts tests/unit/backend/schema/noRuntimeDdl.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day327-bezpieczniki-slepe-artefakty/day327-bezpieczniki.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day327-bezpieczniki-slepe/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day327-pg psql -U postgres -d cx327 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day327-pg`.
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
> **(e) nie dotyczy — wszystkie pięć bezpieczników tego dyżuru to SKANERY PLIKÓW (`readFileSync`/`readdirSync`), żaden nie montuje routera ani nie przechodzi przez strażnika. Dowód, że żaden strażnik nie leży na ścieżce: `grep -lE "ApiGateway|verifyToken|v8FeatureGate|resultsInternalBetaVisibility" tests/unit/config/i18nParity.test.ts tests/unit/frontend/noRawErrorInJsx.test.ts tests/unit/backend/security/noRawErrorMessage.test.ts tests/unit/backend/schema/noRuntimeDdl.test.ts` — oczekiwane: zero trafień, uruchom to i wklej wynik. ★ Pułapka WŁAŚCIWA temu dyżurowi jest inna i groźniejsza: **bezpiecznik, który pilnuje sam siebie** — asercja `expect(COVERED_FILES).toHaveLength(6)` sprawdza długość tablicy, a nie to, czy którykolwiek z sześciu plików został odczytany**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day327-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day327-bezpieczniki-slepe-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R0, R1, R2, R3, R4`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6353` albo `5493` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6353` albo `5493`** (`Z7`).

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

Odbiory 04.09 znalazły **pięć bezpieczników, które są zielone dlatego, że nie patrzą tam,
gdzie boli**. To nie jest pięć osobnych usterek — to **jeden wzorzec**: bezpiecznik
deklaruje szeroki zakres, a mierzy wąski wycinek, i wynik „zielono" jest prawdziwy
wyłącznie o tym wycinku.

Program ma ten kształt zapisany trzy razy pod różnymi nazwami: „brak pomiaru nie jest
wynikiem", „test scenariusza nie broni zabezpieczenia" i „bezpiecznik nagradza defekt".
Wspólny mianownik: **mianownik**. Dopóki nie wiadomo, ile obiektów bezpiecznik naprawdę
otwiera, jego zieleń jest zdaniem o niczym.

**Pięć zmierzonych przypadków — każdy z dowodem mutacyjnym odbiorcy:**

1. **`scripts/dev/i18n-pl-audyt.mjs` — klasyfikacja `DEFEKT-PL` jest DEFINICJĄ, nie
   pomiarem.** Funkcja `justification()` kończy się bezwarunkowym
   `return 'termin dopuszczony po przeglądzie semantycznym'`, więc **domyślną klasą
   każdego napisu jest `UZASADNIONE`**, a `DEFEKT-PL` rozpoznaje wyłącznie **listę 73
   napisów wpisaną na twardo** (`defectPlTranslations`). Mutacja odbiorcy: nowy,
   nieprzetłumaczony napis „Milestone" (PL = EN) → `defects = 0`, bezpiecznik **zielony**.
   To samo po stronie `DEFEKT-EN`: `polishTextReason()` łapie tylko listę słów plus test
   na znaki diakrytyczne — mutacja „Zamknij dokument: {{nazwa}}" (realny polski napis
   w pliku EN, bez diakrytyków, bez słowa z listy) **przeszła na zielono**. Ratchet
   `tests/unit/config/i18nParity.test.ts` broni wyłącznie przed **cofnięciem** już
   naprawionych napisów (`defects ≤ 0`, `defektEn ≤ 0`) i przed **spadkiem liczby liści**.

2. **`tests/unit/frontend/noRawErrorInJsx.test.ts` (z dyżuru 316) — deklaruje pokrycie
   sześciu plików, a czyta trzy.** W `rawErrorInterpolations()` stoi
   `if (!file.endsWith('.tsx')) return [];`, więc `src/services/api.ts`,
   `src/components/ReportBuilder/useReportBuilder.ts` i `src/hooks/useReportSections.ts`
   **nigdy nie są otwierane**. Dopisanie do nich `{err.message}` → 7/7 PASS. Druga
   mutacja odbiorcy: `<span>{(problem as Error).message}</span>` w pliku **objętym**
   → też zielono, bo wzorzec `RAW_JSX` zna tylko `data.error`, `err.message`
   i `error.message`. Zdanie raportu 316 „odczytuje i sprawdza sześć produkcyjnych
   źródeł" **jest nieprawdziwe**. Test „obejmuje sześć jawnych plików rdzenia" sprawdza
   **długość tablicy**, a nie odczyt pliku — to jest bezpiecznik, który pilnuje sam
   siebie.

3. **Guard wycieków HTTP `tests/unit/backend/security/noRawErrorMessage.test.ts` — ślepy
   na kształt `.catch(callback)`.** Mutacja odbiorcy
   `.catch((problem) => res.json({ error: problem.message }))` **przeszła na zielono**.
   ★ **Moja korekta wobec tezy zlecenia, wprost:** teza brzmiała „ratchet chroni tylko
   `err|error|e`". Mój pomiar mówi co innego — test `does not depend on the exception
   variable name` **istnieje** (`VARIABLE_AGNOSTIC_LEAK_BASELINE = 47`) i zbiera **każdą**
   nazwę z bloku `catch (x) { … }`. Ślepa plama jest węższa i inna: zbieracz ma wzorzec
   `/catch\s*\(\s*([A-Za-z_$][\w$]*)/`, który po `catch(` napotyka **drugi nawias**
   i nie dopasowuje nazwy — czyli forma promisowa `.catch((ident) => …)` jest poza
   zasięgiem. Zmierzyłem **72** wystąpienia tej formy w `server/src/routes` i **0**
   wystąpień formy `.catch(ident => …)`. Nadzorca podał 81. **Zmierz sam i zapisz, która
   liczba jest Twoja.**

4. **Bezpiecznik martwego kodu z dyżuru 297 — ratchet pilnuje tylko klasy `unreachable`.**
   `scripts/dev/reachability-from-root.mjs --check-baseline` porównuje z bazą **wyłącznie
   pliki sklasyfikowane jako `unreachable` (729)**. Martwy plik produktowy, do którego
   został jeden test, ląduje w klasie `test-only` — a tych jest **1010** — i bramka
   kończy `exit 0`. ★★ **Ten przypadek NIE JEST Twoją pozycją naprawczą** (gałąź 297 nie
   jest scalona i należy do dyżuru 329). Twoim produktem jest **pomiar + brief +
   nienałożony diff** — patrz `R5`. Nie dotykasz tej gałęzi ani jej plików.

5. **`tests/unit/backend/schema/noRuntimeDdl.test.ts` (z dyżuru 319) — pomija `__tests__`.**
   Pętla ma `if (file.includes('/__tests__/')) continue;`, przez co **24 pliki z DDL
   w `server/src`** (**58** wystąpień `CREATE TABLE IF NOT EXISTS`) są poza pomiarem —
   **bez wiersza uzasadniającego**, którego wymaga własna reguła R1 pkt 2 tamtego dyżuru.

**Czego ten dyżur NIE robi.** Nie podnosi progów, nie poszerza wykluczeń i nie „zamyka"
niczego liczbą. **Podniesienie baseline'u bez pokazania, CO NOWEGO bezpiecznik teraz
widzi, jest odrzuceniem pozycji.**

## ★ Zmierz moje liczby sam

Twierdzę, na markerze `1c3d3da844ae03c87985a8f5dc74846a073c0220`:

- `node scripts/dev/i18n-pl-audyt.mjs` wypisuje
  `{"plLeaves":34325,"enLeaves":32336,"identical":505,"defects":0,"justified":505,"defektEn":0,"plOnly":2005}`;
  `defectPlTranslations` ma **73** pozycje; ostatnia instrukcja `justification()` to
  bezwarunkowy `return`;
- `noRawErrorInJsx.test.ts` deklaruje **6** plików i filtruje `.tsx`, więc otwiera **3**;
- `server/src/routes` ma **550** plików tras w zasięgu guarda wycieków, **72** wystąpienia
  `.catch((ident) => …)` i **0** wystąpień `.catch(ident => …)`; baseline'y guarda:
  `ALTERNATE_LEAK_BASELINE = 44`, `VARIABLE_AGNOSTIC_LEAK_BASELINE = 47`, rodzina
  `day296Pattern` = pusta, `fullFamilyPattern ≤ 0`;
- `noRuntimeDdl.test.ts` ma **135** wpisów w liście dozwolonych i pomija **24** pliki
  `__tests__` z **58** wystąpieniami DDL;
- narzędzie 297 (gałąź `codex/day297-martwe-komponenty-od-korzenia-20260903`, **NIE
  scalona**) klasyfikuje `app = 3040`, `harness-only = 29`, `test-only = 1010`,
  `unreachable = 729` przy mianowniku **4808** plików `src/`;
- mianownik rodziny bezpieczników: **21** bramek `check:*` w `package.json`, **16**
  skanujących bezpieczników w `tests/`, **11** w `__tests__` wewnątrz `src`/`server/src`;
- `check-list-canon.sh`, `check-artefakt.sh`, `check-focus-canon.sh --ci` kończą się
  kodem **0**; `check-list-canon` raportuje dług `368/368`, `check-artefakt` `8/9`,
  `check-focus-canon` baseline `61 plików / 169 wystąpień`.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.**

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: WEJŚCIE · SKANER · KLASYFIKATOR · ASERCJA · BRAMKA

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany
czerwony kontrakt testowy + brief. Pozycja z takim produktem jest **ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Skaner + klasyfikator (R1)** | `scripts/dev/i18n-pl-audyt.mjs` | **★ PEŁNA LICENCJA** w zakresie `R1`. Zakaz usuwania istniejących klas i zakaz kasowania listy `defectPlTranslations` — wolno ją **poszerzyć** i wolno **dołożyć** nową regułę wykrywającą | — |
| **Asercja + bramka (R1)** | `tests/unit/config/i18nParity.test.ts`, `tests/unit/config/i18nAuditClassification.test.ts` | **★ PEŁNA LICENCJA**: wolno **dodawać** asercje i **podnosić** baseline liczby liści. Obniżenie któregokolwiek progu albo osłabienie istniejącej asercji = odrzucenie pozycji | — |
| **Wejście (R1)** | `public/locales/pl/translation.json`, `public/locales/en/translation.json` | **★ WYŁĄCZNIE DOPISYWANIE KLUCZY**, parytet PL+EN w tym samym commicie. Zakaz zmiany istniejących wartości. **Liście nie mogą zmaleć**: pl `35198`, en `33065` (licznik surowy, schodzący w tablice) — audyt raportuje inaczej (`34325`/`32336`, bo traktuje tablicę jako liść); **obie liczby mierzysz sam i obie podajesz** | — |
| **Asercja (R2)** | `tests/unit/frontend/noRawErrorInJsx.test.ts` | **★ PEŁNA LICENCJA** w zakresie `R2` | — |
| **Obiekty mierzone (R2)** | `src/services/api.ts`, `src/components/ReportBuilder/useReportBuilder.ts`, `src/hooks/useReportSections.ts`, `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx`, `src/components/DocumentStudio/DocumentStudioTemplateArchitectView.tsx`, `src/components/Presentations/PresentationTemplateArchitectView.tsx` | **TYLKO ODCZYT** — to są obiekty pomiaru, nie teren naprawy. **Mutację dowodową nakładasz i cofasz przez `cp`** (`Z27`), a `git diff` po cofnięciu ma być pusty | Brief w raporcie: plik:linia, kształt wycieku, gotowy diff w bloku kodu, **nienałożony** |
| **Asercja (R3)** | `tests/unit/backend/security/noRawErrorMessage.test.ts` | **★ PEŁNA LICENCJA** w zakresie `R3`. Wolno **dodać** wykrywanie formy `.catch(callback)` i **podnieść** baseline długu, gdy urośnie z powodu odsłonięcia. **Zakaz obniżania** `ALTERNATE_LEAK_BASELINE`, `VARIABLE_AGNOSTIC_LEAK_BASELINE` bez wiersza w tabeli decyzji | — |
| **Obiekty mierzone (R3)** | `server/src/routes/**` | **TYLKO ODCZYT — BEZWZGLĘDNIE.** Ten dyżur **nie naprawia wycieków**, tylko naprawia bezpiecznik, który ich nie widzi | Brief: lista plik:linia z odsłoniętego długu + rekomendacja jako diff, nienałożony |
| **Asercja (R4)** | `tests/unit/backend/schema/noRuntimeDdl.test.ts` | **★ WĄSKA LICENCJA:** wyłącznie objęcie katalogów `__tests__` osobnym, **jawnym** pomiarem i lista dozwolonych dla nich. Zakaz kasowania i zmniejszania istniejącej listy `ALLOWED_RUNTIME_DDL_BY_FILE` | — |
| **Obiekty mierzone (R4)** | `server/src/**/__tests__/**` | **TYLKO ODCZYT** | Brief + tabela 24 plików |
| **Rodzina (R0)** | `scripts/dev/*.mjs`, `scripts/*.sh`, `tests/**`, `src/**/__tests__/**`, `server/src/**/__tests__/**` | **TYLKO ODCZYT na etapie `R0`** — `R0` jest **inwentarzem**, nie naprawą | Tabela inwentarza w raporcie |
| **Bezpiecznik 297 (R5)** | `scripts/dev/reachability-from-root.mjs`, `tests/unit/canon/reachabilityFromRoot.test.ts`, `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` (wszystkie na **niescalonej** gałęzi `codex/day297-martwe-komponenty-od-korzenia-20260903`) | **TYLKO ODCZYT — teren dyżuru 329.** Czytasz przez `git show <gałąź>:<ścieżka>`. **Zakaz scalania tej gałęzi i zakaz tworzenia tych plików u siebie** | **Brief + gotowy diff w bloku kodu, NIENAŁOŻONY**, plus imienna lista klas, których `--check-baseline` nie pilnuje. Pozycja z takim produktem jest **ZROBIONA** |
| **Cudze tereny** | `scripts/dev/p0p1-licznik-e1.mjs`, `scripts/dev/__tests__/p0p1-licznik-e1.test.mjs`, `.github/workflows/test-suite.yml`, `package.json`, `src/components/assessment/**` | **TYLKO ODCZYT — tereny dyżurów 328 i 329** | Wpis do raportu: plik, linia, problem, rekomendacja jako diff, nienałożony |
| **Nowe testy** | `tests/**` (NOWE pliki) | **★ PEŁNA LICENCJA**, z zastrzeżeniem `Z18` i `Z31`. **Nowe pliki wymagają `git add -f`** | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY327_BEZPIECZNIKI_SLEPE_REPORT.md` | `R7` — **JEDYNY nowy dokument, jaki wolno Ci utworzyć** (`Z13`) | — |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem plik:linia i idziesz dalej |

## ★★ ROZSTRZYGNIĘCIE WOBEC `§0.2c` — WARIANT (C), BEZ KONTENERA

`§0.2c` jest wklejany do każdej instrukcji dosłownie. **W tym dyżurze wiążący jest wariant
(C)** (`RUN_DB_TESTS=0 MOCK_DB=true`): wszystkie bezpieczniki z `R1`–`R5` to skanery
plików i **nie otwierają połączenia do bazy**. To nie jest sprzeczność do rozstrzygania
przez Ciebie — rozstrzygam ją tutaj:

- **kontenera nie stawiasz.** Porty `6353` i `5493` oraz nazwa `cx-day327-pg` pozostają
  zarezerwowane niezależnie od tego, czy ich użyjesz — nie oddajesz ich innemu dyżurowi
  i nie bierzesz cudzych;
- w raporcie piszesz jednym zdaniem, że baza nie była potrzebna, i **nie udajesz dowodu
  bazodanowego**. Brak pomiaru nie jest wynikiem — ale pomiar niepotrzebny nie jest dowodem;
- dowody `§0.2b` (a) i (c) wykonujesz mimo to; dowód (b) zastępujesz zdaniem
  „nie postawiłem kontenera, więc nie istnieje baza tego dyżuru, w której mogłaby być
  konfiguracja SMTP" — i **to jest pełny dowód `Z30` dla tego dyżuru**;
- `--retry=0` obowiązuje w **każdej** komendzie `vitest` (`Z29`).

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | liście `translation.json` wg audytu (tablica = liść) | pl `34325` / en `32336` | `node scripts/dev/i18n-pl-audyt.mjs` (potem `git checkout --` na rejestrze) | TAK — to jest liczba, którą porównuje ratchet `i18nParity` |
| 2 | liście `translation.json` licznikiem surowym (schodzi w tablice) | pl `35198` / en `33065` | `node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"` | TAK — **to jest druga, inna liczba tego samego pliku; obie są uczciwe i obie musisz podać** |
| 3 | pozycje listy `DEFEKT-PL` | `73` | `node -e "import('./scripts/dev/i18n-pl-audyt.mjs').then(m=>console.log(m.defectPlTranslations.size))"` | TAK |
| 4 | pliki deklarowane / faktycznie otwierane przez `noRawErrorInJsx` | `6` / `3` | `grep -c "^  'src/" tests/unit/frontend/noRawErrorInJsx.test.ts` oraz `grep -c "\.tsx'," tests/unit/frontend/noRawErrorInJsx.test.ts` | TAK — liczysz osobno deklarację i osobno rozszerzenia |
| 5 | pliki tras w zasięgu guarda wycieków | `550` | `node -e "const fs=require('fs'),p=require('path');function w(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>{const t=p.join(d,e.name);if(e.isDirectory())return e.name==='__tests__'?[]:w(t);return p.extname(e.name)==='.ts'&&!/\.(test\|spec)\.ts$/.test(e.name)?[t]:[];});}console.log(w('server/src/routes').length);"` | TAK — kopiuje dokładnie funkcję `routeFiles()` z guarda |
| 6 | wystąpienia `.catch((ident) => …)` w trasach | `72` | `grep -rEoh "\.catch\s*\(\s*(async\s*)?\(\s*[A-Za-z_$][A-Za-z0-9_$]*" server/src/routes/ \| wc -l` | TAK — **to jest kształt, którego zbieracz nie widzi** |
| 7 | pliki `__tests__` z DDL w `server/src` | `24` plików / `58` wystąpień | komenda (5) z `§0.3` | TAK — pętla jest kopią pętli z guarda, z odwróconym warunkiem `__tests__` |
| 8 | wpisy listy dozwolonych DDL | `135` | `grep -cE '^  "server/src' tests/unit/backend/schema/noRuntimeDdl.test.ts` | TAK |
| 9 | mianownik rodziny: bramki `check:*` | `21` | `grep -oE '"check:[a-z0-9:-]+"' package.json \| sort -u \| wc -l` | TAK |
| 10 | mianownik rodziny: skanujące bezpieczniki w `tests/` | `16` | pętla z komendy (6) w `§0.3` | TAK — filtruje po `readdirSync\|readFileSync` **i** po `BASELINE\|ALLOWED\|ratchet\|COVERED_FILES` |
| 11 | mianownik rodziny: skanujące bezpieczniki w `__tests__` | `11` | pętla z komendy (6) w `§0.3` | TAK |
| 12 | klasy narzędzia 297 (gałąź niescalona) | `3040/29/1010/729` z `4808` | `git show codex/day297-martwe-komponenty-od-korzenia-20260903:docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY297_MARTWE_OD_KORZENIA_REPORT.md` | TAK — **liczba cytowana z cudzego raportu; oznacz ją w swoim raporcie jako NIEZWERYFIKOWANĄ WŁASNYM PRZEBIEGIEM**, bo gałęzi nie wolno Ci scalić |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:** `scripts/dev/i18n-pl-audyt.mjs` · `tests/unit/config/i18nParity.test.ts`
· `tests/unit/config/i18nAuditClassification.test.ts` · `tests/unit/frontend/noRawErrorInJsx.test.ts`
· `tests/unit/backend/security/noRawErrorMessage.test.ts` ·
`tests/unit/backend/schema/noRuntimeDdl.test.ts` · nowe pliki w `tests/` ·
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY327_BEZPIECZNIKI_SLEPE_REPORT.md`.

**Zapisujesz WARUNKOWO:** `public/locales/pl/translation.json` i
`public/locales/en/translation.json` — **wyłącznie** jeżeli poszerzony audyt każe dodać
brakujący klucz; wtedy parytet PL+EN w tym samym commicie i **żaden liść nie znika**.

**JAWNIE NIE ZAPISZESZ:** `scripts/dev/p0p1-licznik-e1.mjs`, `scripts/dev/__tests__/**`,
`.github/workflows/**`, `package.json` (tereny dyżuru 328) · `scripts/dev/reachability-from-root.mjs`,
`tests/unit/canon/reachabilityFromRoot.test.ts`, `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json`,
`src/components/assessment/**`, `dev-render/**` (tereny dyżuru 329) · `server/src/**`
i `src/**` poza mutacjami dowodowymi cofniętymi przez `cp` · `server/migrations/**`
(**ten dyżur nie tworzy ani jednej migracji — przedział nieprzydzielony; plik migracji
w Twoim diffie jest naruszeniem rozłączności**).

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day327-bezpieczniki-slepe
git diff --name-only --cached | tee /private/tmp/cx-day327-bezpieczniki-slepe-artefakty/staged.txt
grep -iE 'p0p1-licznik|reachability|components/assessment|dev-render/|\.github/workflows|^package\.json|server/migrations/' \
  /private/tmp/cx-day327-bezpieczniki-slepe-artefakty/staged.txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## R0 — INWENTARZ RODZINY: ZNAJDŹ RESZTĘ (rdzeń, PIERWSZA POZYCJA)

**Te pięć przypadków to prawdopodobnie próbka.** Zanim cokolwiek naprawisz, policz rodzinę.

Dla **każdego** bezpiecznika z mianownika (`21` bramek `check:*` + `16` + `11` skanerów
testowych) odpowiadasz na **trzy pytania**, w tabeli, wiersz na bezpiecznik:

1. **Jaki jest mianownik?** — ile obiektów bezpiecznik **fizycznie otwiera**. Nie ile
   deklaruje, nie ile jest w liście — ile plików trafia do `readFileSync`. Filtr po
   rozszerzeniu, `continue` po katalogu, `return []` po nazwie: **każdy z nich zmniejsza
   mianownik i każdy wpisujesz osobno**.
2. **Czego asercja naprawdę broni?** — porównaj **zdanie w nazwie testu** ze **zbiorem,
   na którym stoi `expect`**. Rozbieżność między nimi to defekt, nawet gdy test jest
   zielony.
3. **Czy mutacja kształtu, który bezpiecznik DEKLARUJE, czerwieni go?** — nie mutacja
   mechanizmu, tylko **kształtu z deklaracji**. Wstaw najprostszy przypadek, który
   deklaracja obiecuje złapać, uruchom, zapisz wynik, cofnij przez `cp`.

**Werdykt per wiersz:** `SZCZELNY` / `WĄSKI MIANOWNIK` / `ASERCJA WĘŻSZA NIŻ DEKLARACJA`
/ `NIE MOŻE ZACZERWIENIĆ`. Ostatnia klasa jest najgroźniejsza — to bezpiecznik, który
nigdy nie mógł przejść na czerwono.

★ **Trzy pułapki pomiaru tej pozycji, wszystkie zmierzone w programie:**
- `grep --include` w `zsh` potrafi zwrócić **pustkę zamiast wyniku**. Pracujesz w `bash`;
  pustka nie jest wynikiem, dopóki nie sprawdzisz, że polecenie się wykonało;
- „`No test files found`" i „`Transform failed`" to **BŁĄD KOMENDY, nie `PASS`**;
- „plik bez importera" jako metoda liczy importy wewnątrz martwego poddrzewa jako żywe.
  Jeżeli Twój bezpiecznik używa tej metody, **wpisz to w kolumnę mianownika**.

**Wymagany dowód:** pełna tabela inwentarza (wiersz na bezpiecznik z mianownika, bez
skracania listy), komendy, którymi mierzyłeś mianowniki, i **imienna lista bezpieczników
spoza tych pięciu, które mają werdykt inny niż `SZCZELNY`**. Ta lista jest głównym
produktem dyżuru — to od niej zależy, czy program wie, ile jeszcze ślepych bezpieczników
ma. **Commit po `R0`.**

## R1 — AUDYT PL/EN MA MIERZYĆ, NIE DEFINIOWAĆ (rdzeń)

Dziś `justification()` klasyfikuje **domyślnie jako `UZASADNIONE`**, więc każdy nowy,
nieprzetłumaczony napis jest z definicji w porządku.

1. **Odwróć domyślną.** Napis identyczny PL = EN, który **nie pasuje do żadnej jawnej
   reguły uzasadniającej** (nazwa własna, skrót, jednostka, URL, placeholder, liczba,
   strefa czasowa, format daty, kod branżowy, wpis w `exact`), ma być klasyfikowany jako
   **defekt**, a nie jako termin dopuszczony. Lista `defectPlTranslations` przestaje być
   **definicją defektu** i staje się co najwyżej **słownikiem podpowiedzi tłumaczenia**.
2. **Rozszerz `DEFEKT-EN`.** Wykrywanie polskiego tekstu w pliku EN nie może stać na
   skończonej liście słów plus diakrytykach. Dołóż regułę, która łapie polski napis bez
   diakrytyków — minimum: końcówki fleksyjne, polskie funktory zdaniowe, kolejność
   „czasownik + rzeczownik" typowa dla etykiety przycisku. **Kryterium sukcesu jest
   mutacja, nie elegancja reguły.**
3. **Zachowaj wycięcie `{{…}}`.** Komentarz w pliku opisuje zmierzony incydent: dyżur 317
   „naprawił" `Close: {{nazwa}}` na `{{name}}` i rozjechał placeholder z wołaczem
   (`MyWorkHub.tsx` przekazuje `{ nazwa: doc.name }`), a `i18next` ma `skipOnVariables`
   domyślnie `true`, więc w interfejsie zostałby dosłowny `{{name}}`. **Nazwa zmiennej
   i18next nie jest tekstem dla użytkownika. Nie ruszasz tego.**

**★★ DOWÓD MUTACYJNY — celuje w ZABEZPIECZENIE, nie w mechanizm.** Dwie mutacje, obie
odtwarzające mutacje odbiorcy:

- do `pl` i `en` wstaw **ten sam** nowy klucz o wartości `Milestone` → audyt musi dać
  `defects ≥ 1`, a ratchet `i18nParity` **czerwony**;
- do `en` wstaw wartość `Zamknij dokument: {{nazwa}}` → `defektEn ≥ 1`, ratchet **czerwony**.

Dla każdej: wynik PRZED zmianą bezpiecznika (ma być **zielony** — to jest dowód ślepoty)
i PO (ma być **czerwony**). Mutacje cofasz przez `cp` (`Z27`), a `git diff` po cofnięciu
ma być **pusty**.

**★ DŁUG ODSŁONIĘTY.** Po zmianie klasyfikacji `defects` prawie na pewno przestanie być
zerem. **To nie jest regres — to koniec ślepoty.** Podnosisz baseline w
`i18nParity.test.ts` do **swojej zmierzonej liczby**, i **w tym samym commicie** wpisujesz
do raportu: ile pozycji odsłoniło się, ile z nich to realne braki tłumaczenia, ile to
fałszywe trafienia nowej reguły. **Baseline bez tego rozliczenia = odrzucenie pozycji.**

**Wymagany dowód:** liczby PRZED/PO z komendą, obie mutacje w obie strony, tabela długu
odsłoniętego, `git diff` na `translation.json` (ma być pusty albo wyłącznie addytywny).
**Commit po `R1`.**

## R2 — `noRawErrorInJsx` MA CZYTAĆ TO, CO DEKLARUJE (rdzeń)

1. **Usuń filtr rozszerzenia.** Trzy pliki `.ts` z `COVERED_FILES` mają być **otwierane**.
   Jeżeli w pliku `.ts` wzorzec JSX nie ma sensu, to **plik nie należy do listy** — nie
   wolno go trzymać na liście i nie czytać. Jedno z dwojga, z uzasadnieniem w raporcie.
2. **Rozszerz wzorzec.** `RAW_JSX` ma łapać też rzutowanie: `(x as Error).message`,
   `(x as any).message`, `String(x)` i `x?.message` w interpolacji JSX — nie tylko trzy
   nazwy `data.error`, `err.message`, `error.message`.
3. **Zamień asercję pilnującą samej siebie.** Test „obejmuje sześć jawnych plików rdzenia"
   sprawdza `toHaveLength(6)`. Ma dodatkowo asertować, że **każdy** plik z listy został
   faktycznie **odczytany** (np. przez policzenie odczytów albo przez asercję, że plik
   istnieje i ma niepustą treść). Bezpiecznik, którego zasięg nie jest asertowany, nie
   ma zasięgu.

**★★ DOWÓD MUTACYJNY.** Dwie mutacje odbiorcy, obie na produkcie, obie cofnięte przez `cp`:

- `{err.message}` w `src/services/api.ts` — dziś **zielono** (7/7 PASS), po naprawie
  **czerwono**;
- `<span>{(problem as Error).message}</span>` w pliku **objętym** listą — dziś **zielono**,
  po naprawie **czerwono**.

Dodatkowo mutacja odwrotna: **usuń swoje rozszerzenie** i pokaż, że nowy przypadek testowy
**czerwieni się** — bezpiecznik, którego nie da się zepsuć, niczego nie pilnuje.

**★ DŁUG ODSŁONIĘTY.** Jeżeli po otwarciu trzech plików `.ts` i po rozszerzeniu wzorca
`BASELINE` przestanie być zerem — **podnosisz go do swojej liczby i wypisujesz imiennie
każde odsłonięte miejsce plik:linia**. Naprawa samych wycieków **nie należy do tego
dyżuru** (`src/**` jest tylko do odczytu) — produktem jest **pomiar + brief + diff
nienałożony**.

**Wymagany dowód:** obie mutacje w obie strony dosłownie, `BASELINE` PRZED i PO, imienna
lista odsłoniętych miejsc, `git diff` po cofnięciu mutacji (pusty). **Commit po `R2`.**

## R3 — GUARD WYCIEKÓW MA WIDZIEĆ `.catch(callback)` (rdzeń)

1. **Rozszerz zbieracz identyfikatorów.** Dziś wzorzec `/catch\s*\(\s*([A-Za-z_$][\w$]*)/`
   nie dopasowuje formy `.catch((ident) => …)`, bo po `catch(` stoi drugi nawias. Zbieracz
   ma objąć: `.catch((x) => …)`, `.catch(async (x) => …)`, `.catch(function (x) { … })`,
   `.catch(x => …)` oraz parametr z adnotacją typu `.catch((x: unknown) => …)`.
2. **Zmierz osobno, ile z tych miejsc to realne wycieki**, a ile tylko wystąpienia formy.
   Kolumna „forma" i kolumna „wyciek" to **dwie różne liczby** — nie zlewaj ich.
3. **Nie ruszasz `server/src/routes/**`.** Ten dyżur naprawia bezpiecznik, nie wycieki.

**★★ DOWÓD MUTACYJNY.** Mutacja odbiorcy, dosłownie:
`.catch((problem) => res.json({ error: problem.message }))` wstawiona do dowolnej trasy
w `server/src/routes` (wybierz sam, podaj plik:linia). Dziś guard **przechodzi na zielono**
— to jest dowód ślepoty. Po naprawie ma być **czerwony**. Mutacja odwrotna: usuń swoje
rozszerzenie zbieracza i pokaż, że Twój nowy przypadek testowy **czerwieni się**. Cofasz
przez `cp`; `git diff` po cofnięciu **pusty**.

**★ DŁUG ODSŁONIĘTY.** Liczby `ALTERNATE_LEAK_BASELINE` i `VARIABLE_AGNOSTIC_LEAK_BASELINE`
mogą urosnąć. **Podniesienie ich jest dopuszczalne wyłącznie razem z imienną listą
odsłoniętych miejsc** (plik:linia:treść) w raporcie i wierszem w tabeli decyzji.
Podniesienie samej liczby = odrzucenie pozycji.

**Wymagany dowód:** mutacja w obie strony, obie baseline PRZED i PO, imienna lista długu,
komenda liczenia formy `.catch((ident) => …)` z Twoim wynikiem. **Commit po `R3`.**

## R4 — BEZPIECZNIK DDL MA OBEJMOWAĆ `__tests__` ALBO UZASADNIĆ WYŁĄCZENIE (rdzeń)

Dziś pętla ma `if (file.includes('/__tests__/')) continue;`, a własna reguła R1 pkt 2
dyżuru 319 wymaga **wiersza uzasadniającego dla każdego wyłączenia**. Takiego wiersza nie
ma. Rozstrzygasz jedno z dwojga i **wpisujesz do tabeli decyzji**:

- **objęcie**: `__tests__` dostają **własny, jawny pomiar** i **własną listę dozwolonych**
  (24 pliki / 58 wystąpień u mnie). Wtedy DDL w nowym pliku testowym przestaje być
  niewidoczny;
- **wyłączenie**: zostaje `continue`, ale **z komentarzem w kodzie i wierszem w raporcie**,
  który mówi **dlaczego** DDL w teście jest dopuszczalny i **co gwarantuje**, że taki
  test nie tworzy schematu, na którym potem stoi produkt.

**Trzeciej możliwości — cichego `continue` — nie ma.**

**★★ DOWÓD MUTACYJNY.** Dopisz `CREATE TABLE IF NOT EXISTS __day327_probe__ (id INT);`
do wybranego pliku w `server/src/**/__tests__/**` (podaj plik:linia). Dziś guard
**zielony**. Po objęciu — **czerwony**. Przy wariancie „wyłączenie z uzasadnieniem" mutacja
zostaje zielona, ale **wtedy dowodem pozycji jest wiersz uzasadniający, nie mutacja**,
i musisz to napisać wprost. Cofasz przez `cp`.

**Wymagany dowód:** tabela 24 plików z liczbą wystąpień, decyzja z uzasadnieniem, mutacja
w obie strony (przy wariancie objęcia), `git diff` po cofnięciu. **Commit po `R4`.**

## R5 — BEZPIECZNIK MARTWEGO KODU: TYLKO POMIAR I BRIEF (rdzeń, BEZ ZMIANY KODU)

★★ **Ta pozycja jest CELOWO bez licencji na zmianę.** Gałąź
`codex/day297-martwe-komponenty-od-korzenia-20260903` **nie jest scalona** i należy do
dyżuru 329. Gdybyś naprawił bezpiecznik u siebie, dwa dyżury zrobiłyby tę samą pracę na
dwóch gałęziach i zderzyłyby się przy scalaniu. **Nie scalasz tej gałęzi, nie tworzysz
tych plików u siebie.**

Twoim produktem jest:

1. **Pomiar**: przez `git show <gałąź>:<ścieżka>` odczytaj `scripts/dev/reachability-from-root.mjs`
   i wypisz, **których klas `--check-baseline` nie pilnuje**. U mnie pilnuje wyłącznie
   `unreachable`; klasy `test-only` (`1010` plików) i `harness-only` (`29`) nie blokują.
2. **Nazwanie wady metody**: `reachable()` bierze **wszystkie** pliki testowe jako
   korzenie, więc martwy plik produktowy z jednym testem jest „osiągalny". To jest ta sama
   pułapka, przez którą metoda „plik bez importera" liczy importy wewnątrz martwego
   poddrzewa jako żywe.
3. **Gotowy diff w bloku kodu, NIENAŁOŻONY** — jak objąć klasę `test-only` osobnym
   ratchetem, żeby nowy martwy plik z jednym testem nie przechodził.

**Wymagany dowód:** cytat funkcji `--check-baseline` z gałęzi, tabela klas z liczbami
(oznaczone jako **cytowane z cudzego raportu, niezweryfikowane własnym przebiegiem**),
diff w bloku kodu. **Commit po `R5`.**

## R6 — ROZLICZENIE DŁUGU ODSŁONIĘTEGO (rdzeń)

Jedna tabela zbiorcza, wiersz na bezpiecznik z `R1`–`R4`:

| bezpiecznik | próg PRZED | próg PO | co NOWEGO widzi | ile obiektów odsłoniło się | ile z nich to realne defekty | ile to fałszywe trafienia |

**★★ Reguła nadrzędna tego dyżuru:** wiersz, w którym kolumna „co NOWEGO widzi" jest
pusta, oznacza, że próg podniesiono **bez zysku** — i taka pozycja jest **odrzucona**.
Podniesienie baseline'u jest ceną za koniec ślepoty, nie sposobem na zieleń.

Osobno: **zdanie o kierunku**. Dla każdego bezpiecznika napisz, czy dług odsłonięty jest
do naprawienia w jednym dyżurze, czy wymaga własnego programu — i **kto ma go naprawić**,
skoro `src/**` i `server/src/**` są w tym dyżurze tylko do odczytu.

**Wymagany dowód:** tabela wypełniona w całości. **Commit po `R6`.**

## R7 — RAPORT

Raport zawiera: tabelę inwentarza z `R0` **w całości** (bez skracania listy), tabelę
mianowników z Twoimi liczbami obok moich, **wszystkie dowody mutacyjne dosłownie**
(komenda + wynik PRZED + wynik PO + `git diff` po cofnięciu), tabelę decyzji dla `R4`,
tabelę długu odsłoniętego z `R6`, brief i nienałożony diff z `R5`, listę rozbieżności
wobec liczb tej instrukcji oraz **niepustą sekcję „TWIERDZENIA NIEZWERYFIKOWANE"**.

Dodatkowo, obowiązkowo: **akapit `§0.2e`** dla każdego uruchomionego pakietu — która
z pułapek (a)–(e) go dotyczy, jak ją wyłączyłeś i co dowodzi, że wyłączyłeś. Dla skanerów
plikowych dopuszczalne jest „nie dotyczy" **z komendą pokazującą, że dany strażnik nie
leży na ścieżce**.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „inwentarz rodziny
policzony na N bezpiecznikach, z czego M ma werdykt inny niż `SZCZELNY`; trzy z pięciu
bezpieczników rozszerzone z dowodem mutacyjnym w obie strony; dwa opisane briefem" —
**jest pełnowartościowym wynikiem**.

Zdanie „bezpieczniki naprawione" postawione na podniesionym progu bez pokazania, co
nowego bezpiecznik teraz widzi, **nie jest warte nic** — i jest dokładnie tym kształtem,
który ten dyżur ma zlikwidować.

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: **sprawdzasz
warunek NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na zapamiętanym wyniku.**
Dyżur 300 przez to stał dobę po ustaniu blokady. Wynik ponownego sprawdzenia wklejasz do
raportu z datą i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Nie osłabiasz progów" (`Z35`) vs „`R1`/`R3` podnoszą baseline" | `R6`: podniesienie progu jest **dopuszczalne wyłącznie** razem z kolumną „co NOWEGO widzi" i imienną listą odsłoniętych obiektów; podniesienie bez tego = odrzucenie pozycji |
| „Rozszerz bezpiecznik martwego kodu" (teza zlecenia) vs „gałąź 297 nie jest scalona" | `R5`: pozycja jest **celowo bez licencji na zmianę** — produktem jest pomiar + brief + nienałożony diff; naprawa należy do dyżuru 329 |
| „`Z18` — zakaz dotykania infrastruktury testowej" vs „zmieniasz pliki w `tests/`" | Tabela licencji: `Z18` obejmuje `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**` i pliki `vitest*.config.ts` — **nie** obejmuje pojedynczych plików testowych wymienionych imiennie w tabeli licencji |
| „Nie zmieniasz `translation.json`" vs „`R1` może wymagać dodania klucza" | Tabela licencji, wiersz „Wejście (R1)": **wyłącznie dopisywanie**, parytet PL+EN w jednym commicie, żaden liść nie znika, obie liczby liści podane |
| „`§0.2c` (A) każe postawić kontener" vs „ten dyżur nie dotyka bazy" | Sekcja „ROZSTRZYGNIĘCIE WOBEC `§0.2c`": wiążący jest wariant **(C)**; porty zostają zarezerwowane i nieużyte |
| „`Z30` wymaga dowodu (b) z bazy" vs „nie stawiasz kontenera" | Ta sama sekcja: dowód (b) zastąpiony zdaniem o braku bazy dyżuru — to jest **pełny** dowód `Z30` przy braku kontenera |
| „Nie ruszasz `src/**` i `server/src/**`" vs „mutacje dowodowe są w tych katalogach" | Tabela licencji, wiersze „Obiekty mierzone": mutacja jest **tymczasowa**, nakładana i cofana przez `cp` (`Z27`), a `git diff` po cofnięciu ma być **pusty** — to nie jest zmiana produktu |
| „Naprawiasz wycieki" vs „`server/src/routes` tylko do odczytu" | `R3` punkt 3: ten dyżur naprawia **bezpiecznik**, nie wycieki; wycieki idą do briefu jako dług policzony |
| „Odbiór wymaga zrzutów" vs „ten dyżur nie zmienia żadnego ekranu" | Ten dyżur **nie dotyka warstwy wizualnej** — `src/**` jest tylko do odczytu, żaden ekran nie zmienia wyglądu, więc zrzuty nie mają przedmiotu. Wpisz to zdanie do raportu zamiast pustej sekcji |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 9 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — wszystkie ścieżki `R1`–`R4` sprawdzone `[ -e ]` na markerze; pliki `R5` oznaczone jako leżące na **niescalonej** gałęzi i czytane przez `git show` |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 12 wierszy, każda komenda wykonana na markerze |
| 4 | Tabela licencji kompletna, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — w każdym wierszu stoi rzeczownik-produkt (brief · diff · tabela · pomiar) |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — żadna pozycja nie wymaga `auth.middleware.ts`, `Gateway.ts` ani bramki platformowej; `R5` z góry ma opisany produkt zastępczy |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — `lsof` na `6353`/`5493` puste, brak kontenera `cx-day327-pg`, brak gałęzi i worktree; dyżury 328/329 mają rozłączne porty i rozłączne pliki; **przedział migracji nieprzydzielony, bo dyżur nie tworzy migracji** |
| 7 | Komendy paste-ready | TAK — bloki `§0.3` i `§R` wklejone bez edycji na worktree z markera |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — `§0.2d` w komplecie, pułapka `zsh`/`--include` i „`Transform failed` = błąd komendy" dopisane w `R0` |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę `git show` |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany", zero pól szablonu | TAK — kontrola generatora przy wydaniu |
