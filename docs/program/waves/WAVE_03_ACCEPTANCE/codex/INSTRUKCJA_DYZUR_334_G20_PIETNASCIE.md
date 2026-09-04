# INSTRUKCJA DYŻURU nr 334 — Codex — „★★★ BRAMKA G20 — PIĘTNAŚCIE POZYCJI `BLOKUJE` DOSTAJE OBIEKT ROZSTRZYGNIĘCIA. Licznik `scripts/dev/p0p1-licznik-e1.mjs` jest już w pełni maszynową bramką: wołany z CI jako `npm run check:p0p1-e1` w zadaniu `lint-typecheck`, `fetch-depth: 0` naprawiony i udowodniony parą klonów, kod wyjścia 1 przy `BLOKUJE > 0`. Mianownik 121, rozkład `NAPRAWIONE 30 · ZAMKNIETE_DEC 18 · ODLOZONE_DEC 58 · W_BUDOWIE 0 · BLOKUJE 15`. Zostało dokładnie jedno: piętnaście pozycji bez OBIEKTU rozstrzygnięcia — albo SHA realnej naprawy (NIE commit „checkpoint”: `gitShaState()` sam je odróżnia i wrzuca do `BLOKUJE`), albo przeklasyfikowanie z wierszem w tabeli decyzji i numerem `DEC`, który obejmuje pozycję IMIENNIE. Dwa tropy dane z góry: (1) `ASM-OWN-001`/`ASM-OWN-002` stoją na `DEC-2026-09-03-367` („TAK, teraz”) bez SHA wykonania — a biblioteka metodyk została scalona dyżurem 329 (gałąź 293, lokalny ref `e4dc14df6e`, merge `cc8f0b1999`, plik `AssessmentLibraryTab.tsx` +361/−144); sprawdź, czy to nie domyka obu; (2) `ASM-OWN-003` ma dziś `ZAMKNIETE_DEC` na `DEC-2026-09-03-364`, która mówi „PO BRAMKACH (fala 2)”, a jego bliźniak `ASM-OWN-003[OF]` ma na tej samej decyzji `ODLOZONE_DEC` — jedna z tych dwóch klasyfikacji jest błędna i masz rozstrzygnąć KTÓRA"

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
> **wyłącznie** `/private/tmp/cx-day334-g20-pietnascie`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `1c4b5a5635bafd38ef375227824ada9b62be186e`**
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
Zakres: **PRZEKROJOWE — bramka G20 („zero otwartych P0/P1”) macierzy odbioru fali 3. Przedmiotem pracy jest ROZSTRZYGNIĘCIE 15 pozycji korpusu P0/P1, nie kolejna naprawa produktu. Prawo zatrzymania PO KAŻDEJ pozycji `R`, z commitem, i plikiem postępu `/private/tmp/cx-day334-postep.md` (poza repo)**.
Trasy front: `Ten dyżur NIE ZMIENIA ANI JEDNEGO PLIKU w `src/`. Do ODCZYTU, wyłącznie jako materiał dowodowy przy rozstrzyganiu pozycji `ASM-OWN-001`/`ASM-OWN-002`: `src/components/assessment/library/AssessmentLibraryTab.tsx`, `src/components/assessment/AssessmentHub.tsx`, `src/components/assessment/library/__tests__/AssessmentLibraryTab.canon.test.tsx``. Trasy tył: `Ten dyżur NIE ZMIENIA ANI JEDNEGO PLIKU w `server/src/`. Do ODCZYTU, wyłącznie jako materiał dowodowy: `server/src/routes/method-core.routes.ts` (trasy `/api/method/packs`, `/sessions`, `/outputs` — cytowane w werdyktach runtime dyżuru 291 dla `ASM-OWN-001/002/003`), `server/src/services/results/**` (dla `RES-OWN-003` — writer 4 KPI / 3 OKR / 3 ROI)`.

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
WT=/private/tmp/cx-day334-g20-pietnascie
MARKER=1c4b5a5635bafd38ef375227824ada9b62be186e

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/grafika/m03-20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day334-g20-pietnascie-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day334-g20-pietnascie/config.worktree"
cat "$VAULT/worktrees/cx-day334-g20-pietnascie/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day334-g20-pietnascie-scratch
mkdir -p /private/tmp/cx-day334-g20-pietnascie-artefakty

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
git -C "$VAULT" log --oneline 1c4b5a5635bafd38ef375227824ada9b62be186e..github-backup/grafika/m03-20260902
git -C "$VAULT" diff --name-only 1c4b5a5635bafd38ef375227824ada9b62be186e..github-backup/grafika/m03-20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day334-g20-pietnascie-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 1c4b5a5635bafd38ef375227824ada9b62be186e..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `9` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA: licznik konczy sie kodem 1 i wypisuje BLOKUJE: 15
node scripts/dev/p0p1-licznik-e1.mjs >/dev/null 2>/tmp/cx334-licznik.err; echo "kod=$?"; cat /tmp/cx334-licznik.err
git -C "$WT" diff --stat -- docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md
#   oczekiwane: kod=1; na stderr "BLOKUJE: 15. Rejestr: <sciezka>"; git diff na rejestrze PUSTY
#   ★ Komenda NADPISUJE plik rejestru. Pusty diff dowodzi, ze rejestr w repo jest bajtowo
#   identyczny z wygenerowanym. Gdyby diff byl niepusty — to jest ZNALEZISKO do raportu.

# (2) TEZA: 15 pozycji BLOKUJE, wszystkie z powodem NIEROZSTRZYGNIETE, zero BRAK_SHA_DLA_NAPRAWIONE
node scripts/dev/p0p1-licznik-e1.mjs 2>/dev/null | grep '| BLOKUJE |' | awk -F'|' '{print $2" ::"$4}'
node scripts/dev/p0p1-licznik-e1.mjs 2>/dev/null | grep -c 'BRAK_SHA_DLA_NAPRAWIONE'
#   oczekiwane: 15 wierszy, kazdy z NIEROZSTRZYGNIETE; drugie polecenie: 0

# (3) TEZA: mianownik 121 i rozklad NAPRAWIONE 30 / ZAMKNIETE_DEC 18 / ODLOZONE_DEC 58 / W_BUDOWIE 0
node scripts/dev/p0p1-licznik-e1.mjs 2>/dev/null | grep -E '^Mianownik'
node scripts/dev/p0p1-licznik-e1.mjs 2>/dev/null | grep -c '^| `'
#   oczekiwane: "Mianownik: 121. NAPRAWIONE: 30; ZAMKNIETE_DEC: 18; ODLOZONE_DEC: 58; W_BUDOWIE: 0."
#   oraz 121 wierszy korpusu. Sprawdz arytmetyke SAM: 30+18+58+0+15 = 121.

# (4) TEZA: bramka jest zamontowana w CI i ma pelna historie (fetch-depth: 0)
grep -n 'check:p0p1-e1' package.json
grep -n -A3 'fetch-depth' .github/workflows/test-suite.yml | head -20
grep -n 'P0/P1 E1 zero-blockers gate' .github/workflows/test-suite.yml
#   oczekiwane: wpis w package.json; `fetch-depth: 0` w zadaniu `lint-typecheck`; nazwany krok bramki

# (5) ★★ TEZA ROZSTRZYGAJACA: gitShaState() ODROZNIA commit funkcyjny od migawki "checkpoint"
grep -n 'checkpoint\|SHA_CHECKPOINT\|log -1\|--format=%s' scripts/dev/p0p1-licznik-e1.mjs
#   oczekiwane: kod czyta TEMAT commita i ma osobny stan dla migawki. ★ To jest fundament
#   calego dyzuru: jesli tego NIE MA, teza zlecenia jest OBALONA — zapisz to i traktuj
#   "checkpoint" jako dopuszczalny SHA, wpisujac obalenie do "Korekt wobec instrukcji".

# (6) TEZA: ASM-OWN-003 ma ZAMKNIETE_DEC, a jego blizniak [OF] ma ODLOZONE_DEC — na TEJ SAMEJ decyzji
grep -n 'ASM-OWN-003' docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md
grep -n 'DEC-2026-09-03-364' docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
#   oczekiwane: dwa wiersze rejestru o roznych werdyktach; ledger cytuje "PO BRAMKACH (fala 2)"

# (7) TEZA: biblioteka metodyk (DEC-2026-09-03-367) zostala SCALONA i lezy na HEAD
git merge-base --is-ancestor e4dc14df6e HEAD && echo 'e4dc14df6e = PRZODEK HEAD' || echo 'NIE jest przodkiem'
git show --stat e4dc14df6e | head -20
grep -n 'DEC-2026-09-03-367' docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
#   oczekiwane: przodek; 6 plikow, AssessmentLibraryTab.tsx +361/-144; ledger mowi "TAK, teraz"

# (8) TEZA: pakiet testowy licznika jest ZIELONY pod node --test (NIE pod vitest)
node --test scripts/dev/__tests__/p0p1-licznik-e1.test.mjs 2>&1 | tail -12
#   oczekiwane: same PASS, 0 fail. ★ Uruchomienie przez vitest odda "No test files found",
#   a to jest BLAD KOMENDY, nie PASS (§0.2c).

# (9) zasoby: dysk, porty, kontener
df -h /
lsof -nP -iTCP:6370 -sTCP:LISTEN; lsof -nP -iTCP:5510 -sTCP:LISTEN
docker ps -a --format '{{.Names}}' | grep -c cx-day334 || true
#   oczekiwane: powyzej 5 GB wolnego; oba porty puste; 0 kontenerow
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day334-g20-pietnascie-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6370`. Twój JEDYNY port harnessu to `5510`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day334-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta restricted ports Chromium. Zajęte przez hosta i tor grafiki: 3020, 3022, 3025, 3027, 3030, 5432, 5433, 6012, 6379. Rodzeństwo TEJ paczki 04.09 — nie dotykasz: 335 (6371/5511), 336 (6372/5512), 337 (6373/5513). Starsze rodzeństwo 04.09: 330 (6356/5496), 331 (6357/5497), 332 (6358/5498), 333 (6359/5499). Cudze worktree 286-298 używają 6290-6299 i 5250-5269. Twoje własne wyłącznie: baza 6370, harness 5510. ★ ZAKAZ `pkill`/`killall` — zabijasz wyłącznie własne PID-y (zapisz `$!`)`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `BRAK. Ten dyżur nie dodaje, nie zmienia i nie przełącza ANI JEDNEJ flagi funkcyjnej. Jeżeli którakolwiek pozycja `BLOKUJE` wygląda na możliwą do zamknięcia przez włączenie flagi — to jest ZNALEZISKO do raportu i pozycja `DO DECYZJI WŁAŚCICIELA`, nigdy zmiana w tym dyżurze`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh --ci`, `scripts/check-artefakt.sh`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `server/src/middleware/auth.middleware.ts`. Dodatkowo NIETYKALNE do zapisu w tym dyżurze: `.github/workflows/*.yml` poza kroku `P0/P1 E1 zero-blockers gate (G20)` (wąska licencja z tabeli) oraz cała `server/migrations/**` (przedział nieprzydzielony)`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY334_G20_PIETNASCIE_REPORT.md`. Jedyny inny dokument do zmiany: `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md` — i WYŁĄCZNIE jako produkt uruchomienia skryptu, nigdy ręczną edycją. Dodatkowo dopuszczalna AKTUALIZACJA (dopisanie, nigdy nadpisanie) jednego wiersza w `docs/program/REJESTR_ZNALEZISK_20260903.md`. **ZAKAZ edycji jakiegokolwiek `MODULE_ACCEPTANCE.md`** — wiersz `G20` przepisuje odbiorca po weryfikacji Twojego raportu, nie Ty. Plik postępu `/private/tmp/cx-day334-postep.md` żyje POZA repo. Nowe pliki w `tests/` wymagają `git add -f`. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day334-g20-pietnascie-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day334-g20-pietnascie-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ OBNIŻENIA LICZBY `BLOKUJE` PRZEZ PRZENIESIENIE POZYCJI DO INNEGO KUBEŁKA.** Liczba spada wyłącznie przez rozstrzygnięcie OBIEKTU: SHA realnej naprawy albo `DEC` obejmujący pozycję IMIENNIE, z cytatem zdania. Spadek liczby bez tabeli rozstrzygnięć wiersz-po-wierszu = odrzucenie CAŁEGO dyżuru. **ZAKAZ cytowania commita „checkpoint” jako SHA naprawy** — także wtedy, gdy `git cat-file` go widzi. **ZAKAZ `continue-on-error`, warunku `if:` wygaszającego krok bramki i jakiegokolwiek progu tolerancji w CI** — bramka ma dziś prawo być czerwona. **ZAKAZ zmiany semantyki werdyktów licznika** bez wiersza w tabeli decyzji raportu. **ZAKAZ edycji pięciu dokumentów wejściowych** (`ROZLICZENIE_P0P1_20260903.md`, `ROZLICZENIE_P0P1_DECYZJE_20260903.md`, `DECYZJE_WLASCICIELA_P0P1_20260904.md`, `FALA_2_PO_STAGINGU.md`, `OWNER_DECISION_LEDGER_2026-08-24.md`) — to są słowa właściciela; nie „poprawiasz” ich, żeby licznik ładniej policzył | G20 jest ostatnią bramką macierzy, która nie ruszyła z `NOT_STARTED` w żadnym z 16 modułów, a licznik jest już gotowym, maszynowym narzędziem — brakuje wyłącznie rozstrzygnięcia 15 obiektów. Program ma imiennie zapisany kształt „dwa rejestry — licznik mierzy rozjazd”: liczba, która spadła bez rozstrzygnięcia obiektu, mierzy różnicę dwóch liczników, a nie stan produktu. Dodatkowo zastrzeżenie z odbioru dyżuru 328 pozostaje nierozstrzygnięte: dwie pozycje tej samej rodziny (`ASM-OWN-003` i `ASM-OWN-003[OF]`) mają różne werdykty na tej samej decyzji właściciela — a to znaczy, że co najmniej jedna klasyfikacja w rejestrze jest dziś fałszywa |

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
cd /private/tmp/cx-day334-g20-pietnascie

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day334-pg psql -U postgres -d cx334 \
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
cd /private/tmp/cx-day334-g20-pietnascie

docker run -d --name cx-day334-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx334 \
  -p 127.0.0.1:6370:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day334-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6370/cx334 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6370/cx334 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day334-g20-pietnascie && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6370/cx334 \
JWT_SECRET=cx334-test-secret-do-not-reuse-min-32-znaki \
npx vitest run Pakiet bezpiecznika licznika: `node --test scripts/dev/__tests__/p0p1-licznik-e1.test.mjs` (runner `node:test`, NIE `vitest`). Ten dyżur pracuje w wariancie (C) `§0.2c` — licznik nie dotyka bazy danych, kontenera NIE STAWIASZ; porty `6370`/`5510` i nazwa `cx-day334-pg` pozostają zarezerwowane i nieużyte. Dowody mutacyjne obowiązkowe dla: rozróżnienia commit funkcyjny kontra migawka (`gitShaState()`), oraz dla każdej reguły klasyfikacji, którą dotkniesz. Dowód główny = tabela 15 rozstrzygnięć, każde z komendą i wynikiem, plus nowa liczba `BLOKUJE` z komendą i kodem wyjścia --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day334-g20-pietnascie-artefakty/day334-g20-pietnascie.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day334-g20-pietnascie && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run Pakiet bezpiecznika licznika: `node --test scripts/dev/__tests__/p0p1-licznik-e1.test.mjs` (runner `node:test`, NIE `vitest`). Ten dyżur pracuje w wariancie (C) `§0.2c` — licznik nie dotyka bazy danych, kontenera NIE STAWIASZ; porty `6370`/`5510` i nazwa `cx-day334-pg` pozostają zarezerwowane i nieużyte. Dowody mutacyjne obowiązkowe dla: rozróżnienia commit funkcyjny kontra migawka (`gitShaState()`), oraz dla każdej reguły klasyfikacji, którą dotkniesz. Dowód główny = tabela 15 rozstrzygnięć, każde z komendą i wynikiem, plus nowa liczba `BLOKUJE` z komendą i kodem wyjścia --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day334-g20-pietnascie-artefakty/day334-g20-pietnascie.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day334-g20-pietnascie/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day334-pg psql -U postgres -d cx334 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day334-pg`.
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
> **(e) ★★★ **PIĘĆ PUŁAPEK.** (1) Uruchomienie licznika NADPISUJE plik rejestru w repo — po każdym przebiegu sprawdzasz `git diff` na tym pliku; niepusty diff bez Twojej zmiany rozstrzygnięć jest ZNALEZISKIEM, nie szumem. (2) `node scripts/…mjs | tail` gubi kod wyjścia — kod wyjścia mierzysz osobno, `PIPESTATUS` albo przekierowaniem do pliku; „exit 0” z potoku NIE jest dowodem zielonej bramki. (3) Pakiet testowy licznika chodzi pod `node --test`, NIE pod `vitest` — `No test files found` to BŁĄD KOMENDY, nie PASS. (4) `git cat-file -e <sha>` przechodzi dla commita „checkpoint” tak samo jak dla funkcyjnego — bramka na samym istnieniu commita jest bramką na cytacie, nie na naprawie; dowodem naprawy jest `git show --stat`, który pokazuje, że diff DOTYKA obiektu pozycji. (5) `grep --include` w `zsh` zwraca PUSTKĘ zamiast wyników — każdy `grep` z `--include` uruchamiasz przez `bash -c '…'` w cudzysłowach i sprawdzasz, że komenda w ogóle się wykonała; pustka nie jest wynikiem**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day334-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day334-g20-pietnascie-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (pomiar wejściowy i imienna lista 15 pozycji — porównanie z listą z tej instrukcji) · R2 (rozstrzygnięcie 15 pozycji: obiekt, nie kubełek — RDZEŃ) · R3 (rozstrzygnięcie sprzeczności `ASM-OWN-003` kontra `ASM-OWN-003[OF]` — RDZEŃ) · R4 (bezpiecznik na rozróżnienie migawki od commita funkcyjnego, z dowodem mutacyjnym w obie strony) · R5 (raport)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6370` albo `5510` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6370` albo `5510`** (`Z7`).

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

Bramka **G20 — „zero otwartych P0/P1"** jest jedyną bramką macierzy odbioru, która **we
wszystkich 16 modułach stoi na `NOT_STARTED`**. Nie dlatego, że nie ma narzędzia — narzędzie
jest gotowe i maszynowe. Dlatego, że **piętnaście obiektów nie ma rozstrzygnięcia.**

**Stan zastany, zmierzony na markerze `1c4b5a5635bafd38ef375227824ada9b62be186e`:**

- `scripts/dev/p0p1-licznik-e1.mjs` kończy się **kodem 1** przy `BLOKUJE > 0`, wypisuje na
  `stderr` liczbę i ścieżkę rejestru;
- jest wołany z CI jako `npm run check:p0p1-e1`, w zadaniu `lint-typecheck` pliku
  `.github/workflows/test-suite.yml`, a checkout tego zadania ma **`fetch-depth: 0`**
  (naprawa dowiedziona parą klonów w dyżurze 328 — **nie powtarzasz jej**);
- mianownik **121**, rozkład **`NAPRAWIONE 30 · ZAMKNIETE_DEC 18 · ODLOZONE_DEC 58
  · W_BUDOWIE 0 · BLOKUJE 15`**; arytmetyka `30 + 18 + 58 + 0 + 15 = 121` domyka się;
- wszystkie 15 pozycji `BLOKUJE` mają powód **`NIEROZSTRZYGNIETE`**, zero
  `BRAK_SHA_DLA_NAPRAWIONE`;
- `gitShaState()` **odróżnia commit funkcyjny od migawki** — commit z tematem `checkpoint …`
  **sam wpada do `BLOKUJE`** (to jest produkt dyżuru 328; **zmierz to komendą (5), zanim
  cokolwiek na tym oprzesz** — jeżeli mechanizmu nie ma, moja teza jest obalona i to jest
  cenniejszy wynik niż wykonanie planu).

**Dlaczego bramka jeszcze nie jest domknięta.** Bo `BLOKUJE = 15`, a każda z tych piętnastu
pozycji jest **obiektem bez rozstrzygnięcia**. Bramka nie zamknie się od żadnej zmiany
narzędzia — zamknie się dopiero wtedy, gdy każda pozycja dostanie **obiekt**: SHA realnej
naprawy albo decyzję właściciela obejmującą ją **imiennie**.

## ★ Zmierz moje liczby sam — pełna, imienna lista 15 pozycji

Twierdzę, że `node scripts/dev/p0p1-licznik-e1.mjs` na markerze wypisuje dokładnie te
piętnaście pozycji, wszystkie z powodem `NIEROZSTRZYGNIETE`:

| # | Pozycja | Powód zapisany w rejestrze |
| --- | --- | --- |
| 1 | `ASM-OWN-001` | `DEC-2026-09-03-367` nakazuje realizację TERAZ, ale brak SHA wykonania biblioteki metodyk |
| 2 | `ASM-OWN-002` | `DEC-2026-09-03-367` nakazuje realizację TERAZ, ale brak SHA zmiany kolumn katalogu |
| 3 | `EXE-OWN-003` | brak odzyskanego lokalnego seeda i SHA danych przeglądowych Execution |
| 4 | `EXE-OWN-005` | brak SHA pending checkpoint z nawigacją Menu 3 i powrotem do listy |
| 5 | `FIN-OWN-001` | runtime `d8561ed5c2` nie jest jednoznacznym SHA naprawy |
| 6 | `INI-OWN-001` | brak kompletnej fikstury 11 inicjatyw i dowodu przeglądarkowego jej pól lifecycle |
| 7 | `INT-INIT-AI-OBS-001` | brak osiągalnego wołacza `fill-section` i dowodu z realnym providerem AI |
| 8 | `MYW-CAL-REC-002` | decyzje wyznaczają kierunek, ale brak SHA rozszerzenia schematu spotkania |
| 9 | `MYW-CAL-REC-003` | `DEC-222` pozostawia wdrożenie otwarte; brak SHA UI dołączania artefaktu |
| 10 | `MYW-CV-REC-001` | checkpoint `af75a84e37` obejmuje 156 plików i nie izoluje zmiany Vault table/preview |
| 11 | `MYW-CV-REC-002` | źródło opisuje stan istniejący bez SHA naprawy |
| 12 | `MYW-DEC-REC-001` | checkpoint `4a36e8a745` obejmuje 82 pliki i nie izoluje zmiany Decisions list |
| 13 | `MYWORK-DEC-OWN-001` | checkpoint `4a36e8a745` jest tylko wspólną migawką dla `MYW-DEC-REC-001` |
| 14 | `RES-OWN-003` | brak licencjonowanego writera i cold readbacku 4 KPI / 3 OKR / 3 ROI z PostgreSQL |
| 15 | `RES-OWN-004` | źródło mówi „pre-existing" bez SHA naprawy |

**Wypisz swoją listę komendą (2) z `§0.3` i porównaj wiersz po wierszu. Rozbieżność jest
wynikiem, nie błędem — zapisz ją w „Korektach wobec instrukcji".**

Twierdzę dodatkowo:

- mianownik **121**, rozkład **30 / 18 / 58 / 0**, `BLOKUJE` **15**, kod wyjścia **1**;
- `git diff` na `REJESTR_P0P1_BLOKUJACE_G20.md` po uruchomieniu licznika jest **pusty**;
- `e4dc14df6e` (*feat(day293): continue inherited methodology library WIP*) **jest przodkiem
  `HEAD`**, wszedł merge'em `cc8f0b1999` w ramach dyżuru 329, dotyka **6 plików**, w tym
  `src/components/assessment/library/AssessmentLibraryTab.tsx` **+361 / −144**;
- `ASM-OWN-003` ma w rejestrze `ZAMKNIETE_DEC` na `DEC-2026-09-03-364`, a `ASM-OWN-003[OF]`
  ma `ODLOZONE_DEC` na `DEC-2026-08-27-147` **i tej samej** `DEC-2026-09-03-364`;
- `DEC-2026-09-03-364` w `OWNER_DECISION_LEDGER_2026-08-24.md` brzmi: właściciel
  **„PO BRAMKACH (fala 2)"**, a pozycja jest wpisana do `docs/program/FALA_2_PO_STAGINGU.md`.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.**

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: WEJŚCIE · PARSER · KLASYFIKATOR · RENDER · BRAMKA CI · MACIERZ ODBIORU

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany
czerwony kontrakt testowy + brief. Pozycja z takim produktem jest **ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Wejście: rozliczenie korpusu** | `docs/program/waves/WAVE_03_ACCEPTANCE/ROZLICZENIE_P0P1_20260903.md` | **TYLKO ODCZYT — BEZWZGLĘDNIE** | Rozstrzygnięcie idzie do raportu i do rejestru, nigdy do dokumentu wejściowego |
| **Wejście: decyzje korpusu** | `docs/program/waves/WAVE_03_ACCEPTANCE/ROZLICZENIE_P0P1_DECYZJE_20260903.md` | **TYLKO ODCZYT** | jak wyżej |
| **Wejście: decyzje właściciela** | `docs/program/DECYZJE_WLASCICIELA_P0P1_20260904.md` | **TYLKO ODCZYT — BEZWZGLĘDNIE.** To są słowa właściciela | jak wyżej |
| **Wejście: fala 2** | `docs/program/FALA_2_PO_STAGINGU.md` | **TYLKO ODCZYT** | jak wyżej |
| **Wejście: rejestr decyzji** | `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` | **TYLKO ODCZYT** (`Z14`) | Errata w raporcie, z cytatem obu wersji |
| **Walidator / parser / klasyfikator** | `scripts/dev/p0p1-licznik-e1.mjs` — funkcje wejścia (czytanie 5 dokumentów), parser wierszy korpusu, `gitShaState()`, tabela `DAY320_RESOLUTIONS`, render rejestru, kod wyjścia | **★ PEŁNA LICENCJA** w zakresie `R2`–`R4`. Zmiana `DAY320_RESOLUTIONS` wyłącznie w kierunku **mocniejszego dowodu** (SHA funkcyjny zamiast migawki, albo przeklasyfikowanie z `DEC`). **Zmiana semantyki werdyktów wymaga wiersza w tabeli decyzji raportu** | — |
| **Bezpiecznik narzędzia (testy)** | `scripts/dev/__tests__/p0p1-licznik-e1.test.mjs` | **★ PEŁNA LICENCJA**: wolno **dodawać** przypadki. Istniejące wolno zmienić **wyłącznie razem z jawnie opisaną zmianą kontraktu** — usunięcie asercji bez takiego wpisu = odrzucenie pozycji | — |
| **Repozytorium / wyjście: rejestr** | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md` | **★ PEŁNA LICENCJA — ale WYŁĄCZNIE jako PRODUKT SKRYPTU.** Ręczna edycja zakazana; jedyny dopuszczalny sposób zmiany to uruchomienie skryptu | — |
| **Wołacz `npm`** | `package.json`, sekcja `scripts`, wpis `check:p0p1-e1` | **★ WĄSKA LICENCJA:** wyłącznie ten jeden wpis. Zakaz zmiany zależności, wersji Node i pozostałych skryptów | Czerwony kontrakt + brief |
| **Bramka CI** | `.github/workflows/test-suite.yml`, krok `P0/P1 E1 zero-blockers gate (G20)` w zadaniu `lint-typecheck` | **★ WĄSKA LICENCJA:** wyłącznie **wzmocnienie tego jednego kroku** (jawniejszy komunikat, jawny komentarz). **Zakaz** zmiany wyzwalaczy, uprawnień, wersji Node, pozostałych kroków i tworzenia nowego workflow. **Zakaz `continue-on-error`, warunku `if:` wygaszającego krok i progu tolerancji** | Czerwony kontrakt + brief |
| **Macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md`, wiersz `G20` | **TYLKO ODCZYT — ZAKAZ ZAPISU.** Wiersz przepisuje odbiorca po weryfikacji Twojego raportu | Raport podaje **gotowy tekst wiersza** `G20` do wklejenia, z liczbą i komendą — jako propozycję, nie jako zmianę |
| **Materiał dowodowy: biblioteka metodyk** | `src/components/assessment/library/AssessmentLibraryTab.tsx`, `src/components/assessment/AssessmentHub.tsx`, `src/components/assessment/library/__tests__/AssessmentLibraryTab.canon.test.tsx` | **TYLKO ODCZYT** — czytasz je, żeby rozstrzygnąć `ASM-OWN-001`/`002`, nie żeby je zmieniać | Wpis do raportu: co ten kod robi i czy pokrywa treść `DEC-353`/`DEC-367` |
| **Materiał dowodowy: trasy Oceny i Wyników** | `server/src/routes/method-core.routes.ts`, `server/src/services/results/**` | **TYLKO ODCZYT** | jak wyżej |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA istniejącego wiersza** albo dopisanie jednego nowego — dopisujesz stan, nie kasujesz historii | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY334_G20_PIETNASCIE_REPORT.md` (**NOWY — nie istnieje na markerze**) | `R5` — **JEDYNY nowy dokument, jaki wolno Ci utworzyć** (`Z13`) | — |
| **Cudze tereny** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` wiersze `G15`/`G19` (dyżury 335, 336) · `src/components/MyWork/**`, `dev-render/**` (dyżur 337) · `src/**`, `server/src/**` (**ten dyżur NIE ZMIENIA PRODUKTU**) · `server/migrations/**` (przedział nieprzydzielony) | **TYLKO ODCZYT** | Wpis do raportu: plik, linia, problem, rekomendacja jako diff, **nienałożony** |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem `plik:linia` i idziesz dalej |

## ★★ ROZSTRZYGNIĘCIE WOBEC `§0.2c` I `Z39`

**(1) Wariant (C), bez kontenera.** Licznik nie dotyka bazy danych. Pracujesz w wariancie
(C) (`RUN_DB_TESTS=0 MOCK_DB=true`), **kontenera `cx-day334-pg` nie stawiasz**. Porty
`6370`/`5510` pozostają zarezerwowane niezależnie od tego, czy ich użyjesz. W raporcie
piszesz jednym zdaniem, że baza nie była potrzebna, i **nie udajesz dowodu bazodanowego**.
Dowód `§0.2b` (b) zastępujesz zdaniem o braku bazy dyżuru — to jest pełny dowód `Z30` przy
braku kontenera.

**(2) Wariant (B) nie ma zastosowania.** Pakiet testowy licznika używa runnera `node:test`.
Właściwa komenda to `node --test scripts/dev/__tests__/p0p1-licznik-e1.test.mjs`.
Uruchomienie przez `vitest` odda `No test files found`, **a to NIE jest `PASS`**.

**(3) `Z39` kontra „potwierdź w CI".** `Z39` zabrania uruchamiania realnych workflow, a
`test-suite.yml` i tak reaguje wyłącznie na gałęzie `main`, `develop`, `Londyn`, `demo` —
nasza linia to `grafika/m03-20260902`, więc **workflow nigdy się nie uruchomi przed
scaleniem**. Dyżur 328 udowodnił naprawę `fetch-depth` parą klonów offline. **Nie powtarzasz
tego pomiaru** — cytujesz go i idziesz dalej. Jeżeli chcesz go potwierdzić, robisz to
**dopiero po `R2`**, jako pozycję nadprogramową, i kasujesz klony po pomiarze
(`df -h /` przed i po; program stracił dobę na dysku zjedzonym przez klony).

## ★★ WARUNKI WSPÓLNE SERII — kontrola braku szkody ubocznej

Ten dyżur **nie zmienia ani jednego pliku w `src/` i `server/src/`**. Poniższe mierzysz
**PRZED pierwszym commitem i PO ostatnim**, i obie pary liczb wpisujesz do raportu:

```bash
cd "$WT"
# (a) liscie slownikow NIE MOGA ZMALEC
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
#   moje liczby: pl 35198, en 33065

# (b) trzy bramki kanonu maja konczyc sie kodem 0
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus-canon=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list-canon=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
#   moje liczby: wszystkie 0
```

**Jeżeli którakolwiek liczba zmaleje albo bramka zaczerwieni się od Twojej zmiany —
naprawiasz KODEM, nigdy progiem i nigdy `--no-verify`** (`Z35`).

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | kod wyjścia licznika przy `BLOKUJE > 0` | `1` | `node scripts/dev/p0p1-licznik-e1.mjs >/dev/null 2>&1; echo $?` | TAK — **bez potoku**, potok gubi kod wyjścia |
| 2 | pozycje `BLOKUJE` i ich powody | `15`, wszystkie `NIEROZSTRZYGNIETE` | komenda (2) z `§0.3` | TAK — grupuje po kolumnie „powód", nie po samej liczbie |
| 3 | mianownik korpusu | `121` | `node scripts/dev/p0p1-licznik-e1.mjs 2>/dev/null \| grep -c '^\| `'` | TAK |
| 4 | rozkład pozostałych werdyktów | `30 / 18 / 58 / 0` | komenda (3) z `§0.3` | TAK — suma z wierszem 2 daje 121, **sprawdź to jawnie** |
| 5 | czy rejestr w repo jest identyczny z generowanym | `git diff` pusty | `git diff --stat -- …/REJESTR_P0P1_BLOKUJACE_G20.md` po uruchomieniu | TAK |
| 6 | czy `gitShaState()` odróżnia migawkę od commita funkcyjnego | mechanizm **obecny** | komenda (5) z `§0.3` | TAK — czyta **temat** commita, nie samo jego istnienie |
| 7 | czy `e4dc14df6e` leży na `HEAD` | **TAK**, przodek | `git merge-base --is-ancestor e4dc14df6e HEAD; echo $?` | TAK |
| 8 | zasięg zmiany biblioteki metodyk | 6 plików, `AssessmentLibraryTab.tsx` +361/−144 | `git show --stat e4dc14df6e` | TAK — pokazuje, czy diff DOTYKA obiektu pozycji |
| 9 | werdykty pary `ASM-OWN-003` / `[OF]` | `ZAMKNIETE_DEC` kontra `ODLOZONE_DEC` | komenda (6) z `§0.3` | TAK |
| 10 | brzmienie `DEC-2026-09-03-364` | „PO BRAMKACH (fala 2)" | `grep -n 'DEC-2026-09-03-364' …/OWNER_DECISION_LEDGER_2026-08-24.md` | TAK — cytat, nie parafraza |
| 11 | testy pakietu licznika | wszystkie PASS, 0 fail | `node --test scripts/dev/__tests__/p0p1-licznik-e1.test.mjs` | TAK — runner `node:test`, **nie** `vitest` |
| 12 | liście słowników PL/EN | `35198` / `33065` | blok (a) „WARUNKÓW WSPÓLNYCH" | TAK |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:** `scripts/dev/p0p1-licznik-e1.mjs` ·
`scripts/dev/__tests__/p0p1-licznik-e1.test.mjs` ·
`docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md` (**wyłącznie jako
produkt skryptu**) · `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY334_G20_PIETNASCIE_REPORT.md`.

**Zapisujesz WARUNKOWO:** `.github/workflows/test-suite.yml` i `package.json` — wyłącznie
w zakresie wąskiej licencji z tabeli · `docs/program/REJESTR_ZNALEZISK_20260903.md`
(jeden wiersz, dopisany).

**JAWNIE NIE ZAPISZESZ:** `src/**`, `server/src/**`, `server/migrations/**`,
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/**` (macierz odbioru — także wiersz `G20`),
pięciu dokumentów wejściowych licznika, `dev-render/**`,
`src/components/MyWork/__tests__/ideaTools.controlEnumeration.test.tsx` (teren dyżuru 337),
`evidence/g19/**` (teren dyżuru 335), `evidence/g15/**` (teren dyżuru 336).

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day334-g20-pietnascie
git diff --name-only --cached | tee /private/tmp/cx-day334-g20-pietnascie-artefakty/staged.txt
bash -c "grep -iE '^src/|^server/src/|^server/migrations/|MODULE_ACCEPTANCE|ROZLICZENIE_P0P1|DECYZJE_WLASCICIELA|FALA_2_PO_STAGINGU|OWNER_DECISION_LEDGER|dev-render/|controlEnumeration|evidence/g19|evidence/g15' /private/tmp/cx-day334-g20-pietnascie-artefakty/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## R1 — POMIAR WEJŚCIOWY I IMIENNA LISTA (pierwsza pozycja)

1. Uruchom komendy (1)–(3) z `§0.3`. Do raportu idzie: **kod wyjścia**, liczba `BLOKUJE`,
   mianownik, rozkład czterech pozostałych werdyktów, **i jawnie policzona suma**.
2. **Wypisz swoją listę 15 pozycji** i porównaj z tabelą z tej instrukcji, wiersz po
   wierszu. Każda rozbieżność (inna pozycja, inny powód, inna liczba) idzie do „Korekt
   wobec instrukcji" **z komendą**.
3. Sprawdź `git diff` na rejestrze po uruchomieniu. **Niepusty diff bez Twojej zmiany jest
   ZNALEZISKIEM** — znaczy, że rejestr w repo rozjechał się z tym, co produkuje skrypt.
4. Uruchom pakiet bezpiecznika (`node --test`). Liczba testów i wynik do raportu.

**Wymagany dowód:** pięć liczb z komendami, tabela porównawcza 15 pozycji, stan `git diff`,
wynik pakietu. **Commit po `R1`.**

## R2 — PIĘTNAŚCIE POZYCJI: OBIEKT ROZSTRZYGNIĘCIA, NIE INNY KUBEŁEK (rdzeń)

**To jest ta pozycja, dla której dyżur istnieje.** Dla **każdej** z 15 pozycji produkujesz
wiersz tabeli z **jednym z czterech** rozstrzygnięć:

- **SHA naprawy znaleziony** — cytujesz SHA, pokazujesz `git cat-file -e <sha>^{commit}`,
  `git merge-base --is-ancestor <sha> HEAD`, **temat commita** i **`git show --stat <sha>`**.
  ★ Wiersz jest ważny **tylko wtedy, gdy `--stat` pokazuje, że diff DOTYKA obiektu pozycji**.
  Temat w rodzaju `checkpoint …` **nie jest** dowodem naprawy — i narzędzie już to widzi.
- **`DEC` właściciela obejmuje pozycję** — cytujesz identyfikator `DEC-…` **istniejący
  w `OWNER_DECISION_LEDGER_2026-08-24.md`** i **cytujesz zdanie**, z którego wynika, że
  pozycja jest objęta **imiennie**. Sam numer bez zdania nie wystarczy; „rodzina R-N" bez
  wymienienia identyfikatora pozycji też nie.
- **pozycja jest realnie otwarta** — zostaje `BLOKUJE`, ale z **opisem, czego brakuje do
  rozstrzygnięcia**, i jednym zdaniem: „czego konkretnie mi zabrakło, żeby rozstrzygnąć
  samodzielnie". **Wiersz bez tego zdania liczy się jako nierozstrzygnięty.**
- **`DO DECYZJI WŁAŚCICIELA`** — gdy rozstrzygnięcie jest decyzją produktową, nie pomiarem.
  Wtedy formułujesz **jedno konkretne pytanie**, na które da się odpowiedzieć „tak"/„nie",
  a nie opis problemu.

**Dwa tropy, które daję z góry — sprawdź je, nie przyjmuj:**

1. **`ASM-OWN-001` i `ASM-OWN-002`.** Oba stoją na `DEC-2026-09-03-367` („R-4 — Ocena:
   biblioteka metodyk i katalog, właściciel **TAK, teraz**"), zgodnej z `DEC-2026-09-03-353`
   (B2 — lista kolumn biblioteki: *Nazwa metodyki · Obszar · Opis w jednym zdaniu · Liczba
   pytań · Czas trwania · Status · Ostatnio użyta*; podgląd: pełny opis + lista osi +
   przycisk „Rozpocznij ocenę"). Biblioteka metodyk **została scalona** dyżurem 329
   (gałąź `codex/day293-…`, lokalny ref `e4dc14df6e`, merge `cc8f0b1999`).
   **Sprawdź, czy scalony kod realizuje treść `DEC-353`** — otwórz
   `AssessmentLibraryTab.tsx` i porównaj **kolumny i zawartość podglądu z listą z decyzji,
   pozycja po pozycji**. Jeżeli tak: `ASM-OWN-001` i/lub `ASM-OWN-002` dostają SHA
   `e4dc14df6e` jako SHA naprawy. Jeżeli częściowo: **wypisz, czego brakuje imiennie**
   i pozycja zostaje otwarta z tym opisem. ★ „Plik został zmieniony" **nie jest** dowodem —
   dowodem jest zgodność treści z decyzją.
2. **`MYW-CV-REC-001`, `MYW-DEC-REC-001`, `MYWORK-DEC-OWN-001`** stoją dziś na migawkach
   `af75a84e37` (156 plików) i `4a36e8a745` (82 pliki, użyty **dwukrotnie**). Dla każdej:
   albo **znajdujesz commit funkcyjny**, którego `--stat` dotyka Vault table/preview
   względnie listy Decisions (szukaj w historii tych ścieżek, nie w historii migawki),
   albo pozycja **zostaje otwarta** z opisem braku.

**★★ ZAKAZ NADRZĘDNY TEJ POZYCJI.** Nie wolno obniżyć liczby `BLOKUJE` przez **przeniesienie
pozycji do innego kubełka** bez rozstrzygnięcia obiektu. Liczba, która spadła bez obiektu,
mierzy rozjazd dwóch liczników, a nie stan produktu — program ma ten kształt zapisany
imiennie („dwa rejestry — licznik mierzy rozjazd"). **Spadek liczby bez tabeli rozstrzygnięć
= odrzucenie całego dyżuru.**

**Wymagany dowód:** tabela **15 wierszy**, każdy z komendą i jej wynikiem; nowa liczba
`BLOKUJE` z komendą i kodem wyjścia; imienna lista pozycji, które **zostały** otwarte, każda
z powodem i ze zdaniem „czego mi zabrakło"; osobna lista pozycji `DO DECYZJI WŁAŚCICIELA`
sformułowanych jako **pytania rozstrzygalne**. **Commit po `R2`.**

## R3 — SPRZECZNOŚĆ `ASM-OWN-003` KONTRA `ASM-OWN-003[OF]` (rdzeń)

Dwie pozycje tej samej rodziny mają **różne werdykty na tej samej decyzji właściciela**:

- `ASM-OWN-003` → `ZAMKNIETE_DEC`, źródło `DEC-2026-09-03-364`;
- `ASM-OWN-003[OF]` → `ODLOZONE_DEC`, źródła `DEC-2026-08-27-147` **i** `DEC-2026-09-03-364`.

A `DEC-2026-09-03-364` mówi wprost: właściciel **„PO BRAMKACH (fala 2)"**, i pozycja jest
wpisana do `FALA_2_PO_STAGINGU.md`. **„Po bramkach" to odłożenie, nie zamknięcie.**
Co najmniej jedna z tych dwóch klasyfikacji jest dziś fałszywa.

1. **Ustal, skąd bierze się różnica** — czy z reguły w kodzie licznika, czy z różnych
   wpisów w dokumentach wejściowych. Cytuj **linię kodu albo linię dokumentu**, nie wrażenie.
2. **Rozstrzygnij, który werdykt jest poprawny**, i **napraw regułę, nie wpis** — jeżeli
   przyczyną jest kod, poprawiasz kod; jeżeli przyczyną jest dokument wejściowy, **nie
   dotykasz dokumentu** (to słowa właściciela), tylko opisujesz rozjazd w raporcie
   i w rejestrze znalezisk.
3. **Sprawdź RODZINĘ, nie tylko tę parę.** Program ma zmierzony kształt „zlecenie obejmuje
   rodzinę": praca per zgłoszenie daje „poprawne w 2 z 3". **Wypisz wszystkie pozycje
   korpusu, które mają bliźniaka z sufiksem `[OF]`**, i pokaż ich pary werdyktów. Jeżeli
   znajdziesz kolejne rozbieżne pary — rozstrzygasz je tak samo.
4. **Dowód mutacyjny celujący w ZABEZPIECZENIE.** Po naprawie reguły: podstaw wpis, który
   PRZED naprawą przechodził jako `ZAMKNIETE_DEC` na decyzji odkładającej, i pokaż, że
   **po naprawie** licznik go **widzi** jako `ODLOZONE_DEC` (albo `BLOKUJE`). Mutacja
   odwrotna: **usuń naprawioną regułę** i pokaż, że nowy test **czerwieni się**.
   Cofasz przez `cp` do `/private/tmp/cx-day334-g20-pietnascie-scratch` (`Z27`), **nigdy
   `git stash`**; `git diff` po cofnięciu **pusty**.

**Wymagany dowód:** cytat obu wierszy rejestru, cytat zdania decyzji, wskazanie przyczyny
z `plik:linia`, tabela **wszystkich** par `X` / `X[OF]` z werdyktami, mutacja w obie strony
z pełną nazwą czerwonego testu (`Z37`), `git diff` po cofnięciu (pusty). **Commit po `R3`.**

## R4 — BEZPIECZNIK: MIGAWKA NIE JEST NAPRAWĄ

Niezależnie od tego, jak rozstrzygniesz pozycje z `R2`, **kontrakt „commit »checkpoint« nie
jest dowodem naprawy" ma być zabezpieczony testem**, a nie tylko regułą w kodzie.

1. Sprawdź komendą (5) z `§0.3`, **czy rozróżnienie w ogóle istnieje** w `gitShaState()`.
   ★ Jeżeli **nie istnieje** — moja teza jest **obalona**, zapisujesz to w „Korektach wobec
   instrukcji", **dobudowujesz rozróżnienie** i to staje się głównym produktem tej pozycji.
2. Dodaj do pakietu przypadek, który wstrzykuje (przez `options.shaCheck` albo równoważny
   punkt wstrzyknięcia — **bez dotykania git-a**) commit o temacie `checkpoint …` i wymusza,
   że werdykt **nie jest** `NAPRAWIONE`.
3. **Mutacja celuje w zabezpieczenie:** usuń gałąź kodu odpowiadającą za rozróżnienie
   i pokaż, że **nowy test czerwieni się**, podając jego **pełną nazwę**. Cofasz przez `cp`.
   ★ Test, który przechodzi zarówno przed, jak i po usunięciu zabezpieczenia, **nie broni
   niczego** — to jest kształt „test scenariusza nie broni zabezpieczenia" i jest podstawą
   odrzucenia pozycji.

**Wymagany dowód:** wynik komendy (5), nowy test, mutacja w obie strony z pełną nazwą
czerwonego przypadku, `git diff` po cofnięciu (pusty), liczba testów pakietu przed i po.
**Commit po `R4`.**

## R5 — RAPORT

Raport zawiera:

- **stan PRZED/PO**: kod wyjścia, `BLOKUJE`, mianownik, rozkład werdyktów, `git diff` na
  rejestrze;
- **tabelę 15 rozstrzygnięć** z `R2`, każde z komendą i wynikiem;
- **imienną listę pozycji, które zostały otwarte**, z powodem i ze zdaniem „czego mi
  zabrakło, żeby rozstrzygnąć samodzielnie";
- **osobną listę pytań `DO DECYZJI WŁAŚCICIELA`**, każde sformułowane tak, że da się na nie
  odpowiedzieć „tak"/„nie" — **nie opis problemu**;
- **rozstrzygnięcie `R3`** z tabelą wszystkich par `X` / `X[OF]`;
- **tabelę decyzji**: co zmieniłeś w regule klasyfikacji i dlaczego (bez tej tabeli zmiana
  semantyki jest niedopuszczalna);
- **wszystkie dowody mutacyjne dosłownie**, z pełnymi nazwami czerwonych testów;
- **gotowy tekst wiersza `G20`** do wklejenia do `MODULE_ACCEPTANCE.md` — jako propozycję
  dla odbiorcy, z liczbą i komendą; **sam wiersza NIE wpisujesz**;
- listę rozbieżności wobec liczb tej instrukcji;
- **niepustą sekcję „TWIERDZENIA NIEZWERYFIKOWANE"**;
- obowiązkowy **akapit `§0.2e`** dla każdego uruchomionego pakietu: która z pułapek go
  dotyczy, jak ją wyłączyłeś i co dowodzi, że wyłączyłeś. Dla licznika dopuszczalne
  „nie dotyczy" **z komendą pokazującą, że dany strażnik nie leży na ścieżce**.

★ **Zanim dopiszesz cokolwiek do jakiegokolwiek dokumentu, sprawdź, czy nie jest on
GENEROWANY przez skrypt:** `bash -c "grep -rl '<nazwa-pliku>' scripts/"`. Dopisek do pliku
generowanego znika przy następnym przebiegu — i program ma ten kształt zapisany.

**Commit po `R5`.**

## Próg odbioru

**Bramka G20 kończy się `exit 0`** — albo raport **imiennie** wyjaśnia, **które pozycje
i dlaczego** nie dają się rozstrzygnąć bez decyzji właściciela, i dla każdej takiej pozycji
zawiera **jedno rozstrzygalne pytanie**, a nie zgadywanie.

Zdanie „G20 zamknięta" postawione na liczbie, która spadła przez przeniesienie pozycji do
innego kubełka, **nie jest warte nic** i jest podstawą odrzucenia całego dyżuru.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „piętnaście pozycji dostało
obiekt rozstrzygnięcia, z czego N zamknięte SHA-mi funkcyjnymi, M decyzjami cytowanymi
imiennie, K zostało otwartych z opisem braku i pytaniem do właściciela; sprzeczność
`ASM-OWN-003` rozstrzygnięta i zabezpieczona testem; migawka nie przechodzi już jako
naprawa" — **jest pełnowartościowym wynikiem, nawet jeśli `BLOKUJE > 0`.**

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: **sprawdzasz
warunek NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na zapamiętanym wyniku.**
Wynik ponownego sprawdzenia wklejasz do raportu z datą i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Domknij bramkę G20" vs „zakaz przenoszenia pozycji do innego kubełka" | `R2`, zakaz nadrzędny: liczba spada **wyłącznie** przez rozstrzygnięcie obiektu; próg odbioru dopuszcza `BLOKUJE > 0` z listą pytań |
| „Bramka ma być zielona" vs „`BLOKUJE = 15` dziś" | Tabela licencji, wiersz „Bramka CI": bramka **ma dziś prawo być czerwona**; zakaz `continue-on-error`, `if:` i progu tolerancji |
| „Rozstrzygnij `ASM-OWN-003`" vs „`OWNER_DECISION_LEDGER` jest TYLKO DO ODCZYTU" | `R3` punkt 2: naprawiasz **regułę w kodzie**, a rozjazd dokumentu opisujesz w raporcie i rejestrze znalezisk — dokumentu nie dotykasz |
| „Nie zmieniasz semantyki werdyktów" vs „`R3`/`R4` zmieniają klasyfikację" | Tabela licencji, wiersz „Walidator": zmiana semantyki **wymaga wiersza w tabeli decyzji raportu** — i taki wiersz jest w `R3` i `R5` wymagany wprost |
| „`e4dc14df6e` domyka `ASM-OWN-001`" vs „nie przyjmuj tez z instrukcji" | `R2` trop 1: to jest **teza do sprawdzenia**, dowodem jest zgodność treści kodu z `DEC-353`, nie sam fakt scalenia; obalenie tezy jest sukcesem |
| „Potwierdź bramkę w CI" vs `Z39` i filtr gałęzi workflow | Sekcja „ROZSTRZYGNIĘCIE… (3)": dowód offline z dyżuru 328 **cytujesz**, realnego workflow **nie wywołujesz** |
| „`§0.2c` (A) każe postawić kontener" vs „licznik nie dotyka bazy" | Sekcja „ROZSTRZYGNIĘCIE… (1)": wiążący wariant **(C)**; porty i kontener zostają zarezerwowane i nieużyte |
| „`§0.2c` (B) każe uruchomić pakiet przez `vitest`" vs „pakiet chodzi pod `node --test`" | Sekcja „ROZSTRZYGNIĘCIE… (2)": wiążąca komenda `node --test`; `No test files found` **nie jest** `PASS` |
| „Wpisz wynik do macierzy G20" vs „`MODULE_ACCEPTANCE.md` TYLKO DO ODCZYTU" | Tabela licencji, wiersz „Macierz odbioru": produkujesz **gotowy tekst wiersza w raporcie**, wpisuje go odbiorca |
| „Zero nowych dokumentów" (`Z13`) vs „wiersz w rejestrze znalezisk" | Tabela licencji: to jest **AKTUALIZACJA istniejącego** dokumentu, dopisywana, nigdy nadpisywana; nowy dokument jest dokładnie jeden — raport `R5` |
| „Cofaj mutacje" vs `Z27` (zakaz `git stash`) | `R3` i `R4`: stan odkładasz przez `cp` do katalogu scratch **poza repo**, wracasz przez `cp`; `git diff` po cofnięciu ma być pusty |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 11 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — sprawdzone na markerze; jedyny nowy plik to raport `R5` |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 12 wierszy; wiersze 1–4 i 7–11 zmierzone przy wydaniu |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — wejście · parser · klasyfikator · bezpiecznik · repozytorium/rejestr · wołacz npm · bramka CI · macierz odbioru; w każdym wierszu stoi rzeczownik-produkt |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R1`–`R4` nie wymagają `auth.middleware.ts` ani `Gateway.ts`; `test-suite.yml` i `package.json` mają wąską, imienną licencję |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — 6370/5510 wolne, brak kontenera `cx-day334-pg`, brak gałęzi i worktree; 335/336/337 mają rozłączne porty i rozłączne pliki; przedział migracji nieprzydzielony |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z markera |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — `§0.2d` w komplecie; pułapki właściwe: nadpisywanie rejestru, potok gubiący kod wyjścia, `vitest` kontra `node --test`, migawka przechodząca `cat-file`, `grep --include` w `zsh` |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany", zero pól szablonu | TAK — kontrola generatora przy wydaniu |
