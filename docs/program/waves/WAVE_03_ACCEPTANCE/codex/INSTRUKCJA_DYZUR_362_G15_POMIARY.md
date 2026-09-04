# INSTRUKCJA DYŻURU nr 362 — Codex — „★★★ G15 — WYKONAĆ CZTERY BRAKUJĄCE POMIARY SERWEROWE, NIE ZAWĘZIĆ KRYTERIUM. Cztery moduły stoją na `PARTIAL_PASS / SERVER_NOT_MEASURED`: `04_ASSESSMENT`, `09_RESULTS`, `12_AUDITS`, `15_SETTINGS`. To jest BRAK POMIARU, nie stwierdzona czerwień. Zadanie: wykonać brakujące pomiary serwerowe na realnym PostgreSQL i zamknąć te wiersze, jeżeli wychodzą zielone — na kryterium, którym zamknięto `13_CHAT` (front 462/462/0 + serwer 67/67/0, realny PG, `--retry=0`, `MOCK_DB=false`, mianownik DOSŁOWNIE z §R1 rejestru G15, nic z niego nie wolno wyjąć). ★★★ ŻADEN `PARTIAL` nie może stać się `PASS` przez zawężenie kryterium; jeżeli kryterium jest źle postawione, PISZESZ PYTANIE, nie poprawiasz po cichu. ★★ `15_SETTINGS` NIE MA ścieżki serwerowej w §R1 — nie wpisujesz mu `PASS 0/0`; dyżur 336 świadomie odrzucił tę okazję i ZADAŁ O TO PYTANIE, które do dziś jest BEZ ODPOWIEDZI"

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
> **wyłącznie** `/private/tmp/cx-day362-g15-pomiary`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `2a7273e087cbd3e44344725b524f6ddd79d5badc`**
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
Zakres: **BRAMKA ODBIORU `G15` („Integrator self-QA and impacted regression”) — **cztery moduły ze stanem `PARTIAL_PASS / SERVER_NOT_MEASURED`: `04_ASSESSMENT`, `09_RESULTS`, `12_AUDITS`, `15_SETTINGS`**. Przedmiotem pracy jest **wykonanie brakującego pomiaru serwerowego** i wpis do macierzy z dowodem — nie naprawa produktu i nie zmiana kryterium. ★ SSOT mianownika: `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_G15_SAMOKONTROLA_20260903.md`, sekcja **§R1 — mapa modułów i mianownik plików testowych**. ★★ **Pozostałych DWUNASTU wierszy `G15` nie dotykasz** — w tym CZTERECH ze stanem `NOT_MEASURED / RED_LEGACY_*_CONFIRMED` (`05`, `06`, `08`, `16`), które są innym gatunkiem braku i innym zleceniem**.
Trasy front: `Front tych czterech modułów jest **już zmierzony i zielony** wg wierszy macierzy (`04` — 620/620 po korekcie asercji stanu pustego; `09` — 418/418; `12` — 17/17; `15` — 13/13) i **odtwarzasz go na swojej bazie jako drugą połowę kryterium**, bo kryterium `13_CHAT` brzmi „front **i** serwer”. Katalogi frontowe bierzesz **dosłownie z §R1**, nic z nich nie wyjmując. ★ Ten dyżur **nie renderuje ekranów, nie robi zrzutów i nie zmienia ani jednego pliku w `src/`** — jedyny kontakt z `src/` to **odczyt** i uruchomienie testów`. Trasy tył: `★★ SEDNO DYŻURU. Ścieżki serwerowe **dosłownie z §R1 rejestru `G15`**: `04_ASSESSMENT` → `server/src/routes/assessment*/__tests__`, `server/src/services/assessment*/__tests__` · `09_RESULTS` → `server/src/routes/resultsVnext/__tests__`, `server/src/services/results*/**/__tests__` · `12_AUDITS` → `server/src/routes/audits/__tests__`, `server/src/services/audits/__tests__`, `server/src/services/auditProgram*/__tests__` · `15_SETTINGS` → **★ §R1 NIE WYMIENIA ANI JEDNEGO KATALOGU SERWEROWEGO** (tylko `src/components/settings/__tests__` i `tests/unit/settings`). ★★★ `09_RESULTS` to **rodzina, w której dyżur 347 udowodnił, że 401 z 542 czerwieni serwerowych było artefaktem pomiaru** — wymuszony `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` na izolowanych kontraktach tras, które nie tworzą realnej fikstury `organization_members`. Reguła kolejnych pomiarów jest zapisana w rejestrze `G15`, sekcja „Aktualizacja dyżuru 347” (trzy punkty) — **stosujesz ją PER PAKIET, nigdy hurtem**. `server/src/routes/resultsVnext/__tests__/okr.routes.test.ts` daje `0/118` z `enforce` i `118/118` bez niego, na tych samych 118 przypadkach`.

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
WT=/private/tmp/cx-day362-g15-pomiary
MARKER=2a7273e087cbd3e44344725b524f6ddd79d5badc

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/grafika/m03-20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day362-g15-pomiary-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day362-g15-pomiary/config.worktree"
cat "$VAULT/worktrees/cx-day362-g15-pomiary/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day362-g15-pomiary-scratch
mkdir -p /private/tmp/cx-day362-g15-pomiary-artefakty

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
git -C "$VAULT" log --oneline 2a7273e087cbd3e44344725b524f6ddd79d5badc..github-backup/grafika/m03-20260902
git -C "$VAULT" diff --name-only 2a7273e087cbd3e44344725b524f6ddd79d5badc..github-backup/grafika/m03-20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day362-g15-pomiary-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 2a7273e087cbd3e44344725b524f6ddd79d5badc..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `osiem` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day362-g15-pomiary

# (1) ★★★ ROZKLAD 16 WIERSZY G15 — sprawdz SAM, bo zlecenie podalo go NIEDOKLADNIE
bash -c "for d in docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/; do printf '%s ' \$(basename \$d); grep -E '^\| G15 +\|' \$d/MODULE_ACCEPTANCE.md | head -1 | awk -F'|' '{print \$4}'; done"
#   moje liczby: 2 x PASS (01, 13) · 10 x PARTIAL_PASS · 4 x NOT_MEASURED
#   ★★★ CZTERY 'SERVER_NOT_MEASURED' TO **PARTIAL_PASS**, NIE 'NOT_MEASURED': 04, 09, 12, 15.
#   ★★★ CZTERY 'NOT_MEASURED' TO CO INNEGO: 05, 06, 08, 16 (podtyp RED_LEGACY_*_CONFIRMED)
#   i sa POZA zakresem tego dyzuru. Zlecenie zlepilo te dwie grupy w jedna — sprawdz i zapisz.

# (2) MIANOWNIK — SSOT to §R1 rejestru G15, DOSLOWNIE
bash -c "sed -n '/^## R1 — mapa modulow\|^## R1 — mapa modułów/,/^## R1 — wspol\|^## R1 — współ/p' docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_G15_SAMOKONTROLA_20260903.md"
#   ★ oczekiwane: tabela 16 wierszy. Twoje cztery: 04 (33), 09 (67), 12 (41), 15 (7).
#   ★★ 15_SETTINGS ma w tej tabeli WYLACZNIE dwa katalogi FRONTOWE — zero serwerowych.

# (3) REGULA POMIARU PO DYZURZE 347 — trzy punkty, stosujesz PER PAKIET
bash -c "sed -n '/^## Aktualizacja dyzuru 347\|^## Aktualizacja dyżuru 347/,\$p' docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_G15_SAMOKONTROLA_20260903.md"
#   oczekiwane: trzy punkty o `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`

# (4) ★★ SUROWE POMIARY DYZURU 336 SA W REPO — czytasz je, ZANIM cokolwiek uruchomisz
ls evidence/g15/day336-artefakty/*serwer.json | wc -l
#   moja liczba: 15 plikow (15_SETTINGS nie ma, bo nie ma sciezki serwerowej)
node -e 'for (const f of ["04-assessment","09-results","12-audits"]) { const j=JSON.parse(require("fs").readFileSync(`evidence/g15/day336-artefakty/${f}-serwer.json`,"utf8")); console.log(f, "total", j.numTotalTests, "pass", j.numPassedTests, "fail", j.numFailedTests, "suitesFail", j.numFailedTestSuites); }'
#   moje liczby: 04 -> 113/113/0, suitesFail 0 · 09 -> 567/136/413, suitesFail 175 · 12 -> 317/244/1, suitesFail 2
#   ★★★ 04_ASSESSMENT MIAL SERWER ZMIERZONY I ZIELONY (113/113/0) NA `1c4b5a5635`, A WIERSZ
#   DALEJ MOWI 'SERVER_NOT_MEASURED'. To jest Twoje pierwsze pytanie do samego siebie w R1.
#   ★★★ 09_RESULTS to rodzina z artefaktu pomiarowego dyzuru 347 — 413 czerwieni NIE JEST
#   liczba defektow, dopoki nie powtorzysz pomiaru wg reguly z (3).

# (5) KRYTERIUM, NA KTORYM STOJA DWA ISTNIEJACE PASS — czytasz oba doslownie
bash -c "grep -hE '^\| G15 +\|' docs/program/waves/WAVE_03_ACCEPTANCE/modules/13_CHAT/MODULE_ACCEPTANCE.md" | cut -c1-700
#   oczekiwane: 'front 462/462 PASS; serwer chatHandoff + chatToSchema 67/67 PASS na realnym
#   lokalnym PostgreSQL, --retry=0, zero bledow suity' + dowod w tym samym commicie
bash -c "grep -hE '^\| G15 +\|' docs/program/waves/WAVE_03_ACCEPTANCE/modules/01_ORGANIZATION/MODULE_ACCEPTANCE.md" | cut -c1-700
#   oczekiwane: 'G15 PASS (front+RealPG) — 11 plikow, 22/22 zielone'

# (6) ★★★ DWA PYTANIA O KRYTERIUM SA JUZ ZADANE I BEZ ODPOWIEDZI — sprawdz sam
bash -c "sed -n '/^## PYTANIA DO WLASCICIELA O KRYTERIUM\|^## PYTANIA DO WŁAŚCICIELA O KRYTERIUM/,/^## Werdykt/p' docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY336_G15_ROZKLAD_REPORT.md"
#   oczekiwane: pytanie 1 o warstwe serwerowa 15_SETTINGS, pytanie 2 o dlug zastany
bash -c "grep -rn '15_SETTINGS' docs/program/REJESTR_ZNALEZISK_20260903.md docs/program/DECYZJE_WLASCICIELA_P0P1_20260904.md docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md | head"
#   moja liczba: ZERO trafien. Czyli oba pytania z 04.09 sa BEZ ODPOWIEDZI — nie zadajesz ich
#   po raz drugi jako nowych, tylko ESKALUJESZ jako nierozstrzygniete, z data pierwszego zadania.

# (7) BAZA POROWNAWCZA MUSI SIE KOMPILOWAC — to juz raz przewrocilo pomiar
bash -c "grep -n 'PreviewAIHintStrip' docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY336_G15_ROZKLAD_REPORT.md | head -3"
#   oczekiwane: opis, ze baza `f65c4ff6a0` miala NIEROZSTRZYGNIETY marker konfliktu
#   w `PreviewAIHintStrip.tsx:110`, wiec pliki dotykajace jej grafu importow wykonaly ZERO
#   przypadkow, a 13 z nich raport 286 mimo to sklasyfikowal jako NOWA.
#   ★ Jesli robisz pare z baza — powtarzasz jawna kopie tego pliku z HEAD i zapisujesz to.

# (8) LISCIE SLOWNIKOW I CZTERY BRAMKI — maja byc IDENTYCZNE przed i po calym dyzurze
node -e 'const f=require("fs");function c(o){let n=0;const w=v=>{if(v&&typeof v==="object"){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ["pl","en"])console.log(l,c(JSON.parse(f.readFileSync("public/locales/"+l+"/translation.json","utf8"))));'
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
#   moje liczby: pl 35199, en 33066; focus=0, list=0, artefakt=0, reach=0
#   ★ raport 336 podaje 35198/33065 — te liczby sa o dzien stare, moje sa dzisiejsze.
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day362-g15-pomiary-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6433`. Twój JEDYNY port harnessu to `5573`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day362-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta restricted ports Chromium. Zajęte przez hosta i tor grafiki: 3020, 3022, 3025, 3027, 3030, 5432, 5433, 6012, 6379. Rodzeństwo TEJ paczki (04.09 noc) — **nie dotykasz cudzych**: 359 (6430/5570), 360 (6431/5571), 361 (6432/5572), 362 (6433/5573). Wcześniejsze rodzeństwo 04.09: 343-346 (6390-6393 / 5530-5533), 347 (6394/5534), 348 (6395/5535), 349 (6396/5536), 350 (6397/5537), 351 (6410/5550), 352 (6411/5551), 353 (6412/5552), 354 (6413/5553), 355-358. ★★ RÓWNOLEGLE inny autor pisze instrukcje **363-366**; ich portów NIE ZNAM, więc obowiązuje reguła twarda: **bierzesz WYŁĄCZNIE swoje dwa porty i żaden inny**, a port zajęty jest powodem do STOP-u całości (`Z7`), nigdy do podmiany numeru. **Twoje własne wyłącznie: baza 6433, runtime 5573.** Zmierzyłem 04.09: `5570-5573` i `6430-6433` wszystkie wolne, kontenery `cx-day359-pg`…`cx-day362-pg` nie istnieją. ★ ZAKAZ `pkill`/`killall` — zabijasz wyłącznie własne PID-y (zapisz `$!` po starcie każdego procesu w tle)`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `BRAK zmian flag. ★★ ALE **flagi są tu częścią pomiaru**, nie tłem: wariant serwerowy niesie `ENABLE_V8_GLOBAL=true`, `ENABLE_TEST_AUTH_BYPASS=false` i **warunkowo** `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`. Każdą z nich **zapisujesz przy każdym przelocie**, bo to one rozstrzygają, czy czerwień jest defektem, czy artefaktem. ★★★ Zmiana wartości flagi po to, żeby wyszło zielono, jest **zawężeniem kryterium** i unieważnia dyżur — a jawne, uzasadnione zdjęcie `enforce` z izolowanego kontraktu tras jest **zgodne z regułą z rejestru** i wymaga zdania uzasadnienia w raporcie. Różnica jest w tym, czy wariant dobrałeś **do rodzaju pakietu**, czy **do oczekiwanego wyniku**. ★ Wiersz macierzy `09_RESULTS` mówi też „flagi Wyników pozostały OFF” — jeżeli Twój pomiar to obali, jest to znalezisko, nie okazja`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh --ci`, `scripts/check-artefakt.sh`, `scripts/check-triada.sh`, `scripts/check-gestosc.sh`, `scripts/dev/reachability-from-root.mjs`, `scripts/dev/p0p1-licznik-e1.mjs` i jego test, `.husky/pre-commit`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`. Wszystkie **NIETYKALNE DO ZAPISU** — wolno je wołać w pomiarze, nie wolno ich zmieniać. ★★★ To jest w tym dyżurze **najważniejszy zakaz**: `G15` mierzy się konfigiem i zmiennymi środowiskowymi, więc pokusa „poprawienia” configu, żeby wyszło zielono, jest tu największa w całym programie. Zmiana `vitest.config.ts`, `tests/setup.ts` albo `server/vitest.config*.ts` po to, żeby pomiar wyszedł lepiej, jest **zawężeniem kryterium** i unieważnia dyżur. ★ Bramka, która przechodzi, bo nie mogła nic zmierzyć, nie jest wynikiem: każde wywołanie zapisujesz z kodem wyjścia ORAZ z `numTotalTests``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY362_G15_POMIARY_REPORT.md`. Jedyne inne dokumenty do zmiany: **(a)** wiersze `G15` w `docs/program/waves/WAVE_03_ACCEPTANCE/modules/{04_ASSESSMENT,09_RESULTS,12_AUDITS,15_SETTINGS}/MODULE_ACCEPTANCE.md` — **WYŁĄCZNIE kolumna `G15`, WYŁĄCZNIE w tych czterech modułach, WYŁĄCZNIE z dowodem w tym samym commicie**. **Pozostałych dwunastu wierszy `G15` nie dotykasz**, w szczególności `05`, `06`, `08`, `16` (`NOT_MEASURED / RED_LEGACY_*_CONFIRMED` — inny gatunek braku, inne zlecenie) oraz `01` i `13` (`PASS` — nie „poprawiasz” ich brzmienia). `G16`, `G18`, `G19`, `G20` nietykalne w każdym module (`G19` to dyżury 360 i 361, `G20` to dyżur 359). **(b)** **dopisanie sekcji „Aktualizacja dyżuru 362”** na końcu `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_G15_SAMOKONTROLA_20260903.md` — **wyłącznie dopisanie na końcu**, zakaz zmiany §R1 i sekcji zastanych. **(c)** **jedna nowa sekcja** w `docs/program/REJESTR_ZNALEZISK_20260903.md` — Twoja litera to **`AD`**; sprawdzasz ją komendą `bash -c "grep -nE '^## [A-Z]+[.]' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -5"` TUŻ PRZED commitem (dziś sekcje idą do `Z`, litera `V` wolna, ale zarezerwowana — nie zajmuj jej; jeżeli `AD` zajęta, bierzesz pierwszą wolną i zapisujesz to w raporcie). ★★ WSZYSTKIE dowody idą do `evidence/g15/day362/` (katalog NIE ISTNIEJE na markerze — tworzysz go) z `git add -f`; ta instrukcja daje na to jawną licencję. Plik postępu `/private/tmp/cx-day362-postep.md` żyje POZA repo. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day362-g15-pomiary-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day362-g15-pomiary-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
| `Z28` | **★★ ZERO POŁĄCZEŃ DO RAILWAY, DEMO, STAGINGU I PRODUKCJI — w każdą stronę i każdym narzędziem.** Zakaz obejmuje `railway` CLI, `psql`/`docker exec psql` do hosta innego niż `127.0.0.1`, `curl`/`wget`/`fetch` do `*.railway.app`, `demo.consultify.ai`, `consultify.ai`, `staging.*` | Produkcja NIETYKALNA; demo i staging są jedną bazą. **To jedyny zakaz, którego naruszenie zatrzymuje CAŁY dyżur** |
| `Z29` | **★★ Testy o kształcie „atak odrzucony + readback bez zmian" MUSZĄ biec BEZ PONAWIANIA: `--retry=0` w KAŻDEJ komendzie** i `retry: 0` w opcjach `describe`/`it`, jeśli plik je ustawia | **Historycznie** `vitest.config.ts` ustawiał `retry: CI ? 3 : 1` i to unieważniało całą rodzinę testów izolacji: przy otwartej dziurze pierwszy przebieg realnie zmieniał stan, asercja padała, Vitest ponawiał — i test **raportował `PASS` mimo otwartej dziury** (dowód: `tests/integration/_retrymask/`, archetyp dyżuru 42). **Stan na 04.09: `vitest.config.ts:339` ustawia `retry: 0`, a `server/vitest.config.ts` nie ustawia `retry` wcale.** Zakaz zostaje w mocy — dotyczy `--retry=N` w CLI i `retry` w opcjach `describe`/`it` — ale **nie szukaj tu przyczyny niestabilności**: ponowień w konfiguracji już nie ma |
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
| `Z40` | ★★★ **ZAKAZ ZAMIANY `PARTIAL` NA `PASS` PRZEZ ZAWĘŻENIE KRYTERIUM.** To jest kształt „bezpiecznik nagradza defekt”. Mianownik bierzesz **DOSŁOWNIE z §R1** rejestru `G15`; **nic z niego nie wolno wyjąć** — ani pliku, ani katalogu, ani „nieistotnej” suity. Dyżur 336 miał **cztery okazje do taniej zieleni** i **z żadnej nie skorzystał**; obowiązuje ten sam standard. ★★★ **ZAKAZ WPISANIA `15_SETTINGS` `PASS 0/0`.** §R1 nie wymienia dla niego ANI JEDNEJ ścieżki serwerowej. Pomiar `0/0` kończy się `exit 0` i **nie jest pomiarem** — brak pomiaru nie jest wynikiem. To była jedna z czterech świadomie odrzuconych okazji dyżuru 336. ★★★ **ZAKAZ CICHEJ POPRAWY KRYTERIUM.** Jeżeli uważasz, że kryterium jest źle postawione — **piszesz pytanie do właściciela**, nie zmieniasz definicji. ★★ **ZAKAZ ZADANIA PO RAZ DRUGI PYTANIA, KTÓRE JUŻ ZADANO.** Dyżur 336 zadał 04.09 dwa pytania o kryterium `G15` i **oba są bez odpowiedzi**. Eskalujesz je z datą pierwszego zadania, a nie zgłaszasz jako nowe — inaczej wyprodukujesz trzecie rozliczenie tej samej sprawy. ★★★ **ZAKAZ ZMIANY HARNESSU I CONFIGU POMIARU** (`vitest*.config.ts`, `server/vitest.config*.ts`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`). W tym dyżurze to jest zakaz nr 1: `G15` mierzy się konfigiem, więc „poprawienie” configu jest tożsame z podrobieniem wyniku. ★★★ **WIERSZ MACIERZY ZMIENIA STAN WYŁĄCZNIE Z DOWODEM ZAŁĄCZONYM W TYM SAMYM COMMICIE** — `git show --stat` musi zawierać plik z `evidence/g15/day362/**`; commit bez dowodu cofasz przez `git reset --soft HEAD~1`. **Wpis bez dowodu = odrzucenie całego dyżuru.** ★★ **`TECHNICAL_REGRESSION_PASS` BYŁ ODRZUCONY DWA RAZY** i nie wolno go wprowadzić pod żadną nazwą — zakaz obejmuje `MACHINE_PASS`, `TECHNICAL_PASS`, `SERVER_PASS_PARTIAL`, `PASS (zakres serwerowy)` i każdy inny kształt brzmiący jak zaliczenie bez pełnego mianownika. ★★ **ZAKAZ NAPRAWIANIA CZERWIENI.** Ten dyżur **mierzy i klasyfikuje**; naprawa czerwieni zastanych to inne zlecenie. Znaleziony defekt idzie do raportu jako `plik:linia` + **diff nienałożony**. ★★ **ZAKAZ WYMUSZENIA `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` HURTEM** — to jest dokładnie błąd, który dyżur 347 zdiagnozował jako źródło 401 z 542 czerwieni. Stosujesz regułę z rejestru **per pakiet**. ★★ **ZAKAZ POŁĄCZENIA DO STAGINGU, DEMO I PRODUKCJI W KAŻDĄ STRONĘ** (`Z28`). ★ **ZAKAZ `pkill`/`killall`, `git stash`, `git push` poza własną gałęzią, `git fetch --all` oraz scalania czegokolwiek** | Bo `SERVER_NOT_MEASURED` to **brak pomiaru**, nie stwierdzona czerwień — a brak pomiaru jest najgorszym stanem, jaki bramka może mieć: wygląda jak dług, a może być zielenią, której nikt nie odebrał. ★ Dowód, że to nie jest teoria: **`04_ASSESSMENT` ma w repo surowy wynik serwerowy `113/113/0` z zerem błędów suity** (dyżur 336, `evidence/g15/day336-artefakty/04-assessment-serwer.json`) — a jego wiersz od tamtej pory mówi `SERVER_NOT_MEASURED`. Jeden odczyt pliku, który już leży w repo, może zamienić brak w `PASS`. ★ Dowód, że w drugą stronę też: **`09_RESULTS` pokazuje `413` czerwieni serwerowych**, ale dyżur 347 udowodnił, że **401 z 542 czerwieni całego programu było artefaktem pomiaru** — wymuszonym `enforce` na izolowanych kontraktach tras. Kto zaplanuje naprawę 413 defektów, zaplanuje pracę, której nie ma. ★ I dowód, że łatwa zieleń jest pułapką: **`15_SETTINGS` nie ma ścieżki serwerowej w §R1** — `PASS 0/0` byłby zielony, przeszedłby każdą bramkę i **nie znaczyłby nic**. Dyżur 336 miał cztery takie okazje i z żadnej nie skorzystał; zamiast tego zadał dwa pytania o kryterium, które **do dziś nie mają odpowiedzi**. Ten dyżur ma dokończyć pomiar i **eskalować te pytania**, a nie ominąć je zieloną liczbą |

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
cd /private/tmp/cx-day362-g15-pomiary

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day362-pg psql -U postgres -d cx362 \
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
cd /private/tmp/cx-day362-g15-pomiary

docker run -d --name cx-day362-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx362 \
  -p 127.0.0.1:6433:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day362-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6433/cx362 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6433/cx362 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day362-g15-pomiary && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6433/cx362 \
JWT_SECRET=cx362-test-secret-do-not-reuse-min-32-znaki \
npx vitest run Przeloty serwerowe na REALNYM PostgreSQL (kontener `cx-day362-pg`, port `6433`, baza `cx362`, obraz `pgvector/pgvector:pg16` — `postgres:15` **nie przechodzi migracji**). **Wariant bazowy, dosłownie ten, którym dyżur 336 mierzył 15 modułów:** `cwd=server`, `--config vitest.config.ts`, `--retry=0`, realny `DATABASE_URL`, `RUN_DB_TESTS=1`, `MOCK_DB=false`, `DB_TYPE=postgres`, `NODE_ENV=test`, `ENABLE_V8_GLOBAL=true`, `ENABLE_TEST_AUTH_BYPASS=false`, lokalny `JWT_SECRET`. ★★★ **RÓŻNICA WOBEC 336, KTÓRA JEST SENSEM TEGO DYŻURU:** `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` stosujesz **PER PAKIET wg reguły z rejestru** (sekcja „Aktualizacja dyżuru 347”), **nigdy hurtem** — pakiety dowodzące koperty widoczności z `enforce`, izolowane kontrakty HTTP bez niego, pakiet realnego Gateway/PG bez `enforce` tylko z jawnym uzasadnieniem. Migracje **dwoma przebiegami na bazie OD ZERA**; drugi ma dać `Applying migrations: 0`. ★★ PUŁAPKA: `NODE_ENV=test` **bez** `RUN_DB_TESTS=1` podstawia atrapę bazy pod `DbPromise` — `pg.Pool` widzi wiersz, kod produkcyjny nie; atrapa zwraca `changes:1` dla każdego `UPDATE` niezależnie od `WHERE` (`server/src/database/Database.ts:686`). ★★ PUŁAPKA RÓWNOLEGŁOŚCI, ZAMKNIĘTA 04.09: wiele forków Vitest wołało `initDb()` na jednej bazie, PostgreSQL zwracał `42701` / `23505`; naprawa (advisory lock) w `server/src/database/PostgresDatabase.ts:1570-1573,3880-3883`. Jeżeli mimo to zobaczysz te kody — **znalezisko, nie powód do `--retry`**. **Każdy przelot z `--retry=0` i `--reporter=json --outputFile=<plik w ARTEFAKTY>`; podajesz `numTotalTests`, `numFailedTests` ORAZ `numFailedTestSuites`. Przelot z zerem wykonanych przypadków kończy się `exit 0` i NIE JEST POMIAREM. `No test files found` oraz `Transform failed` to BŁĄD KOMENDY, nie `PASS`.** ★★★ **Klasyfikacja czerwieni WYŁĄCZNIE po `fullName`**, nigdy po liczbach — 04.09 dwa różne zestawy nazw dały tę samą trójkę liczb, a dyżur 286 sklasyfikował 13 przypadków jako `NOWA` wyłącznie dlatego, że baza porównawcza się nie skompilowała --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day362-g15-pomiary-artefakty/day362-g15-pomiary.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day362-g15-pomiary && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run Przeloty serwerowe na REALNYM PostgreSQL (kontener `cx-day362-pg`, port `6433`, baza `cx362`, obraz `pgvector/pgvector:pg16` — `postgres:15` **nie przechodzi migracji**). **Wariant bazowy, dosłownie ten, którym dyżur 336 mierzył 15 modułów:** `cwd=server`, `--config vitest.config.ts`, `--retry=0`, realny `DATABASE_URL`, `RUN_DB_TESTS=1`, `MOCK_DB=false`, `DB_TYPE=postgres`, `NODE_ENV=test`, `ENABLE_V8_GLOBAL=true`, `ENABLE_TEST_AUTH_BYPASS=false`, lokalny `JWT_SECRET`. ★★★ **RÓŻNICA WOBEC 336, KTÓRA JEST SENSEM TEGO DYŻURU:** `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` stosujesz **PER PAKIET wg reguły z rejestru** (sekcja „Aktualizacja dyżuru 347”), **nigdy hurtem** — pakiety dowodzące koperty widoczności z `enforce`, izolowane kontrakty HTTP bez niego, pakiet realnego Gateway/PG bez `enforce` tylko z jawnym uzasadnieniem. Migracje **dwoma przebiegami na bazie OD ZERA**; drugi ma dać `Applying migrations: 0`. ★★ PUŁAPKA: `NODE_ENV=test` **bez** `RUN_DB_TESTS=1` podstawia atrapę bazy pod `DbPromise` — `pg.Pool` widzi wiersz, kod produkcyjny nie; atrapa zwraca `changes:1` dla każdego `UPDATE` niezależnie od `WHERE` (`server/src/database/Database.ts:686`). ★★ PUŁAPKA RÓWNOLEGŁOŚCI, ZAMKNIĘTA 04.09: wiele forków Vitest wołało `initDb()` na jednej bazie, PostgreSQL zwracał `42701` / `23505`; naprawa (advisory lock) w `server/src/database/PostgresDatabase.ts:1570-1573,3880-3883`. Jeżeli mimo to zobaczysz te kody — **znalezisko, nie powód do `--retry`**. **Każdy przelot z `--retry=0` i `--reporter=json --outputFile=<plik w ARTEFAKTY>`; podajesz `numTotalTests`, `numFailedTests` ORAZ `numFailedTestSuites`. Przelot z zerem wykonanych przypadków kończy się `exit 0` i NIE JEST POMIAREM. `No test files found` oraz `Transform failed` to BŁĄD KOMENDY, nie `PASS`.** ★★★ **Klasyfikacja czerwieni WYŁĄCZNIE po `fullName`**, nigdy po liczbach — 04.09 dwa różne zestawy nazw dały tę samą trójkę liczb, a dyżur 286 sklasyfikował 13 przypadków jako `NOWA` wyłącznie dlatego, że baza porównawcza się nie skompilowała --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day362-g15-pomiary-artefakty/day362-g15-pomiary.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day362-g15-pomiary/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day362-pg psql -U postgres -d cx362 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day362-pg`.
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
> **(e) ★★★ **SIEDEM PUŁAPEK TEGO DYŻURU.** **(1) Tania zieleń jest tu wszędzie.** `15_SETTINGS` bez ścieżki serwerowej daje `PASS 0/0`; wyjęcie jednego czerwonego pliku z mianownika daje `PASS`; wąski zestaw katalogów daje `PASS`. Wszystkie trzy są **zawężeniem kryterium** i wszystkie trzy dyżur 336 świadomie odrzucił. **(2) Wymuszony `enforce` produkuje czerwień, która nie jest defektem.** Dyżur 347 zmierzył to na `okr.routes.test.ts`: te same 118 przypadków dają `0/118` z `enforce` i `118/118` bez. Zanim nazwiesz cokolwiek w `09_RESULTS` czerwienią, sprawdź, **czy nie mierzysz tym samym zepsutym wariantem**. **(3) Baza porównawcza musi się kompilować.** Baza `f65c4ff6a0` miała nierozstrzygnięty **marker konfliktu** w `src/components/shared/PreviewPane/PreviewAIHintStrip.tsx:110`; pliki dotykające jej grafu importów wykonały **zero przypadków**, a raport dyżuru 286 sklasyfikował 13 z nich jako `NOWA`. `Transform failed` to **błąd komendy**, nie zielona baza. Jeżeli robisz parę z bazą — powtarzasz jawną kopię tego pliku z HEAD i **zapisujesz tę ingerencję**. **(4) Klasyfikacja po liczbach kłamie.** Porównujesz **zbiory pełnych nazw** (`fullName`), a nie trójki liczb. Zapisz `przed-nazwy.txt`, `po-nazwy.txt` i ich `diff`. **(5) `numTotalTests` bez `numFailedTestSuites` ukrywa błędy uruchomienia.** Dyżur 336 znalazł **10 plików/suit, które nie wykonały czerwonej asercji** — to nie są ani zielone, ani czerwone, to są **błędy komendy**. Podajesz obie liczby zawsze. **(6) Pomiar sprzed dwóch dni nie jest dzisiejszym pomiarem.** `04_ASSESSMENT` `113/113/0` pochodzi z markera `1c4b5a5635`; Twój marker to `2a7273e087`. Odczyt starego artefaktu jest **wskazówką**, nie dowodem — dowodem jest Twój przelot. **(7) Pytanie zadane i niezauważone wraca jako nowe.** Dwa pytania o kryterium `G15` z 04.09 są bez odpowiedzi. Eskalujesz je **z datą pierwszego zadania i nazwą dyżuru**, żeby właściciel widział, że pyta się go po raz drugi — a nie pierwszy**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day362-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day362-g15-pomiary-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R0 (trzy twarde zasady — czytasz) · R1 (**rozkład 16 wierszy i mianownik z §R1** — potwierdzenie albo obalenie mojego sprostowania o `PARTIAL_PASS` vs `NOT_MEASURED`; odczyt surowych artefaktów 336) · R2 (**front czterech modułów** na własnej bazie, mianownik dosłownie z §R1) · R3 (**serwer `04`, `09`, `12`** — wariant per pakiet wg reguły 347, klasyfikacja czerwieni po `fullName`) · R4 (**`15_SETTINGS`** — brak ścieżki serwerowej: co z tym zrobić, bez `PASS 0/0`) · R5 (wpisy do macierzy z dowodem + **eskalacja dwóch pytań o kryterium**) · R6 (raport, sekcja w rejestrze `G15`, jedna sekcja w rejestrze znalezisk). **Commit po KAŻDEJ pozycji `R`, a w `R3` po każdym module**; pozycja bez commita jest pozycją niewykonaną`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6433` albo `5573` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6433` albo `5573`** (`Z7`).

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

Bramka `G15` („Integrator self-QA and impacted regression") ma dziś **dwa** `PASS`
(`01_ORGANIZATION`, `13_CHAT`) i **czternaście** wierszy otwartych. Cztery z nich stoją na
`PARTIAL_PASS / SERVER_NOT_MEASURED`:

> `04_ASSESSMENT` · `09_RESULTS` · `12_AUDITS` · `15_SETTINGS`

**`SERVER_NOT_MEASURED` to BRAK POMIARU, nie stwierdzona czerwień.** To jest najgorszy stan,
jaki bramka może mieć: wygląda jak dług, a może być zielenią, której nikt nie odebrał — albo
czerwienią, której nikt nie widział.

**Zadanie: wykonać brakujące pomiary serwerowe i zamknąć te wiersze, jeżeli wychodzą zielone.**
Na kryterium, którym zamknięto `13_CHAT` — jedyne `PASS` zdobyte 04.09:

> front `462/462/0` **+** serwer `67/67/0`, realny lokalny PostgreSQL, `--retry=0`,
> `MOCK_DB=false`, **zero błędów suity**, **mianownik dosłownie z §R1 rejestru `G15`** —
> nic z niego nie wolno wyjąć. Dowód w tym samym commicie.

To samo kryterium stoi pod drugim `PASS`: `01_ORGANIZATION` — „front+RealPG", 11 plików,
22/22 zielone.

★★★ **ŻADEN `PARTIAL` nie może stać się `PASS` przez zawężenie kryterium.** To jest kształt
„bezpiecznik nagradza defekt". Jeżeli kryterium jest źle postawione — **piszesz pytanie
do właściciela, nie poprawiasz po cichu**. Dyżur 336 miał **cztery okazje do taniej zieleni**
i **z żadnej nie skorzystał**. Ten sam standard.

---

## ★★ SPROSTOWANIE ZLECENIA — jedna liczba obalona, jedna doprecyzowana

Zlecenie, z którego powstała ta instrukcja, opisało rozkład `G15` jako:
*„2 `PASS`, 10 `PARTIAL_PASS` (podtypy `RED_LEGACY_*`), 4 `NOT_MEASURED` (`SERVER_NOT_MEASURED`)"*.

**Zmierzyłem to na markerze `2a7273e087` i to jest NIEDOKŁADNE.**

| Grupa | Ile | Moduły | Podtyp |
| --- | ---: | --- | --- |
| `PASS` | **2** | `01_ORGANIZATION`, `13_CHAT` | — |
| `PARTIAL_PASS` | **10** | `02`, `03`, `04`, `07`, `09`, `10`, `11`, `12`, `14`, `15` | `RED_LEGACY_*` **ORAZ** `SERVER_NOT_MEASURED` |
| `NOT_MEASURED` | **4** | `05`, `06`, `08`, `16` | `RED_LEGACY_1_CONFIRMED` ×3, `RED_LEGACY_2_CONFIRMED` ×1 |

★★★ **To są DWIE RÓŻNE GRUPY, a zlecenie zlepiło je w jedną.**

- **Cztery `SERVER_NOT_MEASURED` to `04`, `09`, `12`, `15`** — i ich stan to **`PARTIAL_PASS`**,
  nie `NOT_MEASURED`. **To jest Twój zakres.**
- **Cztery `NOT_MEASURED` to `05`, `06`, `08`, `16`** — z podtypem `RED_LEGACY_*_CONFIRMED`,
  czyli **potwierdzony dług zastany**, a nie brak pomiaru. **To jest inny gatunek braku,
  inne zlecenie i NIE DOTYKASZ tych wierszy.**

**Potwierdź to własnym pomiarem w `R1`** (komenda `(1)` z bloku weryfikacji) i zapisz wynik.
Gdyby mój rozkład okazał się błędny — **obowiązuje Twój**.

**Reszta tez zlecenia — POTWIERDZONA:**

| Teza | Mój pomiar |
| --- | --- |
| `13_CHAT` zamknięto na `front 462/462/0` + `serwer 67/67/0` | **potwierdzone** — cytat wprost z wiersza `G15` modułu `13` |
| `01_ORGANIZATION` stoi na „front+RealPG" | **potwierdzone** |
| `15_SETTINGS` nie ma ścieżki serwerowej w §R1 | **potwierdzone** — §R1 wymienia dla niego wyłącznie `src/components/settings/__tests__` i `tests/unit/settings` |
| dyżur 347: `401` z `542` czerwieni serwerowych to artefakt pomiaru | **potwierdzone** — reguła zapisana w rejestrze `G15`, sekcja „Aktualizacja dyżuru 347"; `okr.routes.test.ts` daje `0/118` z `enforce` i `118/118` bez |
| artefakty `evidence/g15/day336-artefakty/`, `day347/`, `day355-artefakty/` | **potwierdzone**, wszystkie trzy istnieją |
| liście słowników `pl 35199` / `en 33066` | **potwierdzone** (raport 336 podaje `35198`/`33065` — o dzień stare) |

---

## ★★★ TRZY FAKTY Z SUROWYCH ARTEFAKTÓW, KTÓRE ZMIENIAJĄ SKALĘ TEGO DYŻURU

Odczytałem `evidence/g15/day336-artefakty/*-serwer.json` (15 plików; `15_SETTINGS` nie ma,
bo nie ma ścieżki serwerowej). Dla Twoich trzech modułów z warstwą serwerową:

| Moduł | `numTotalTests` | pass | fail | **failed suites** | Co to znaczy |
| --- | ---: | ---: | ---: | ---: | --- |
| `04_ASSESSMENT` | `113` | `113` | `0` | **`0`** | ★★★ **serwer BYŁ zmierzony i wyszedł CZYSTO** na markerze `1c4b5a5635` — a wiersz od tamtej pory mówi `SERVER_NOT_MEASURED` |
| `09_RESULTS` | `567` | `136` | `413` | **`175`** | ★★★ **rodzina artefaktu pomiarowego 347** — `413` **nie jest liczbą defektów**, dopóki nie powtórzysz pomiaru z wariantem dobranym per pakiet |
| `12_AUDITS` | `317` | `244` | `1` | **`2`** | jedna czerwień imiennie: `auditProgramFixtures — fixture skali Audits (Postgres realny — AUD-MVP-DATA-001) CLEANUP: po sprzątaniu wszystkie pięć liczników wraca do zera, zero wierszy claude_a_ pozostaje` w `server/src/services/auditProgram*/__tests__/fixtureGenerator.pg.test.ts`. ★ `317 − 244 − 1 = 72` — sprawdź, czym są te 72 (pending? skipped? błąd suity?) |

★★ **To są WSKAZÓWKI, nie dowody.** Pochodzą z markera `1c4b5a5635`, Twój marker to
`2a7273e087`. **Dowodem jest Twój przelot.** Ale wiedza, że `04` prawdopodobnie jest zielone,
a `413` w `09` prawdopodobnie nie jest liczbą defektów, oszczędza Ci dnia pracy w złą stronę.

★★ **Mianowniki plików.** §R1 rejestru (pomiar na `35afcb15fd`) mówi:
`04 = 33`, `09 = 67`, `12 = 41`, `15 = 7`. Raport dyżuru 336 (pomiar na HEAD) mówi:
`04 = 53`, `09 = 69`, `12 = 40`, `15 = 7`. **Te liczby się różnią i to jest w porządku** —
liczba plików rośnie z pracą. **Mianownikiem obowiązującym są KATALOGI z §R1, nie liczba
plików z któregokolwiek raportu.** Policz pliki dziś sam, zapisz rozjazd i **nie zawężaj
katalogów, żeby liczba się zgodziła**.

★ **Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.**

---

## ★★ DWA PYTANIA O KRYTERIUM, KTÓRE JUŻ ZADANO I KTÓRE NIE MAJĄ ODPOWIEDZI

Dyżur 336 zakończył 04.09 raport sekcją „PYTANIA DO WŁAŚCICIELA O KRYTERIUM":

1. *Czy `15_SETTINGS` ma mieć warstwę serwerową w mianowniku `G15`, mimo że §R1 wymienia
   wyłącznie dwa katalogi frontowe?*
2. *Czy potwierdzony dług zastany ma nadal blokować `PASS` `G15`, czy `G15` ma raportować
   osobno regresję względem bazy i bezwzględną zieleń bieżącego mianownika?*

**Sprawdziłem: ani jedno nie ma odpowiedzi.** `grep` po rejestrze znalezisk, po decyzjach
właściciela `P0/P1` i po ledgerze decyzji nie znajduje `15_SETTINGS` w żadnym z nich.

★★★ **Nie zadajesz tych pytań po raz drugi jako nowych.** Eskalujesz je **z datą pierwszego
zadania i nazwą dyżuru**, żeby właściciel widział, że pytamy po raz drugi — inaczej
wyprodukujemy trzecie rozliczenie tej samej sprawy, a to już nas w tym programie kosztowało.
★ Pytanie 2 jest przy okazji pytaniem o los **wszystkich dziesięciu** `PARTIAL_PASS`, nie
tylko Twoich czterech — powiedz to wprost.

---

## B.1. TABELA LICENCJI — CAŁA ŚCIEŻKA

| Warstwa | Ścieżka | Licencja | Produkt |
| --- | --- | --- | --- |
| **SSOT mianownika (odczyt)** | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_G15_SAMOKONTROLA_20260903.md`, §R1 | **★ TYLKO ODCZYT. Zakaz zmiany §R1.** Katalogi bierzesz z niego dosłownie | lista katalogów per moduł + policzone dziś pliki |
| **rejestr `G15` — dopisanie** | ten sam plik, **koniec pliku** | **★ WĄSKA — WYŁĄCZNIE nowa sekcja „Aktualizacja dyżuru 362"** na końcu. Zakaz zmiany sekcji zastanych | jedna sekcja |
| **surowe artefakty 336/347/355 (odczyt)** | `evidence/g15/day336-artefakty/**`, `evidence/g15/day347/**`, `evidence/g15/day355-artefakty/**`, `evidence/g15/day336-r*.md` | **tylko odczyt** | liczby wejściowe + porównanie z Twoimi |
| **macierz — CZTERY moduły** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/{04_ASSESSMENT,09_RESULTS,12_AUDITS,15_SETTINGS}/MODULE_ACCEPTANCE.md` | **★ WĄSKA — WYŁĄCZNIE wiersz `G15`**, wyłącznie w tych czterech, **wyłącznie z dowodem w tym samym commicie** | zmieniony wiersz + dowód |
| **macierz — POZOSTAŁYCH 12** | `modules/{01,02,03,05,06,07,08,10,11,13,14,16}_*/MODULE_ACCEPTANCE.md` | **★ ZAKAZ ZAPISU** — w szczególności `05`, `06`, `08`, `16` (`NOT_MEASURED / RED_LEGACY_*_CONFIRMED`, inne zlecenie) oraz `01` i `13` (`PASS`, nie „poprawiasz" ich brzmienia) | brak zmian |
| **testy modułów (uruchomienie)** | katalogi z §R1 dla `04`, `09`, `12`, `15` — front i serwer | **odczyt + uruchomienie.** ★ **ZAKAZ zmiany treści testu**, żeby wyszedł zielony | `*.json` przelotów + `fullName` |
| **konfiguracja pomiaru** | `vitest*.config.ts`, `server/vitest.config*.ts`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**` | **★★★ NIETYKALNE DO ZAPISU — zakaz nr 1 tego dyżuru.** `G15` mierzy się konfigiem, więc „poprawienie" configu jest tożsame z podrobieniem wyniku | wypisane zmienne przy każdym przelocie |
| **zmienne środowiskowe** | `RUN_DB_TESTS`, `MOCK_DB`, `DB_TYPE`, `NODE_ENV`, `ENABLE_V8_GLOBAL`, `ENABLE_TEST_AUTH_BYPASS`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE`, `JWT_SECRET` | **dobierasz do RODZAJU PAKIETU wg reguły z rejestru (sekcja 347)** — nigdy do oczekiwanego wyniku; **każdy przelot zapisuje pełny zestaw** | zestaw zmiennych w logu każdego przelotu |
| **dowody** | `evidence/g15/day362/**` (**NOWY** katalog) | **zapis, `git add -f`** — jawna licencja na `*.json`, `*.log`, `*.txt`; „zakaz binariów w repo" byłby wymyślonym powodem | wszystkie przeloty + `przed-nazwy.txt`/`po-nazwy.txt`/`diff` |
| **raport** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY362_G15_POMIARY_REPORT.md` | **zapis (główny produkt)** | raport |
| **rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **★ WĄSKA — JEDNA nowa sekcja, litera `AD`**; zakaz zajmowania litery `V` | jedna sekcja |
| **kod produktu** | `src/**`, `server/src/**` | **★ ZAKAZ ZAPISU.** Ten dyżur **mierzy i klasyfikuje**, nie naprawia. Znaleziony defekt → `plik:linia` + **diff nienałożony** | wpis w raporcie |
| **bramki zastane** | `scripts/check-*.sh`, `scripts/dev/reachability-from-root.mjs`, `scripts/dev/p0p1-licznik-e1.mjs`, `.github/workflows/**` | **NIETYKALNE DO ZAPISU** — wolno wołać w pomiarze | wyniki `0` |

---

## B.2. TABELA POZYCJI

| Poz. | Co robi | Rdzeń? | Wykonalne bez pliku przekrojowego? | Commit |
| --- | --- | --- | --- | --- |
| `R0` | trzy twarde zasady — czytasz | — | — | — |
| `R1` | rozkład 16 wierszy + mianownik z §R1 + odczyt artefaktów 336 | TAK | TAK — sam odczyt | **TAK** |
| `R2` | front czterech modułów na własnej bazie | TAK | TAK — katalogi rozłączne per moduł | **TAK** |
| `R3` | serwer `04`, `09`, `12` — wariant per pakiet | TAK | TAK — każdy moduł osobno | **TAK ×3** |
| `R4` | `15_SETTINGS` — brak ścieżki serwerowej | TAK | TAK — dokument + jedno pytanie | **TAK** |
| `R5` | wpisy do macierzy + eskalacja dwóch pytań | TAK | TAK | **TAK** |
| `R6` | raport, sekcja rejestru `G15`, sekcja rejestru znalezisk | — | TAK | **TAK** |

★ **Commit po KAŻDEJ pozycji `R`, a w `R3` po każdym module.**

---

## B.3. TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | wiersze `G15`: `PASS` / `PARTIAL_PASS` / `NOT_MEASURED` | `2` / `10` / `4` | `(1)` | TAK — ★ **sprostowanie zlecenia** |
| 2 | moduły `SERVER_NOT_MEASURED` | `4`: `04`, `09`, `12`, `15` | `(1)` | TAK — **Twój zakres** |
| 3 | moduły `NOT_MEASURED / RED_LEGACY_*_CONFIRMED` | `4`: `05`, `06`, `08`, `16` | `(1)` | TAK — **poza zakresem, nie dotykasz** |
| 4 | pliki testowe wg §R1 | `04=33`, `09=67`, `12=41`, `15=7` | `(2)` + własny `find` | TAK — ★ raport 336 mierzył na HEAD `53`/`69`/`40`/`7`; **policz dziś sam** |
| 5 | serwerowe JSON-y dyżuru 336 | `15` plików | `(4)` | TAK — `15_SETTINGS` nie ma i **to jest poprawne** |
| 6 | `04_ASSESSMENT` serwer (336) | `113` / `113` / `0`, suit `0` | `(4)` | TAK — wskazówka, nie dowód |
| 7 | `09_RESULTS` serwer (336) | `567` / `136` / `413`, suit `175` | `(4)` | TAK — ★ **artefakt pomiaru 347, nie liczba defektów** |
| 8 | `12_AUDITS` serwer (336) | `317` / `244` / `1`, suit `2` | `(4)` | TAK — ★ `317−244−1 = 72`, **ustal, czym są** |
| 9 | pytania o kryterium bez odpowiedzi | `2`, zadane 04.09 przez dyżur 336 | `(6)` | TAK |
| 10 | wierszy zmienionych / dowodów załączonych | — | `R5`, dwa liczniki | TAK — **muszą być równe** |
| 11 | liście słowników i cztery bramki | `35199` / `33066`, cztery `0` | `(8)` | TAK — identyczne przed i po |

---

## B.4. TABELA ROZŁĄCZNOŚCI

### B.4.1. Pliki zapisywane NA PEWNO

| Plik | Pozycja | Zakres |
| --- | --- | --- |
| `evidence/g15/day362/**` | `R1`–`R5` | **NOWY** katalog; wszystkie `*.json`, `*.log`, `przed-nazwy.txt`, `po-nazwy.txt`, `diff` |
| `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY362_G15_POMIARY_REPORT.md` | `R6` | główny produkt |
| `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_G15_SAMOKONTROLA_20260903.md` | `R6` | **wyłącznie** sekcja „Aktualizacja dyżuru 362" **na końcu** |
| `docs/program/REJESTR_ZNALEZISK_20260903.md` | `R6` | jedna nowa sekcja, litera `AD` |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Warunek | Zakres |
| --- | --- | --- |
| `modules/{04_ASSESSMENT,09_RESULTS,12_AUDITS}/MODULE_ACCEPTANCE.md` | gdy `R2`+`R3` dadzą pełny pomiar | **wyłącznie wiersz `G15`** |
| `modules/15_SETTINGS/MODULE_ACCEPTANCE.md` | **wyłącznie** gdy `R4` da stan, który **nie jest** `PASS 0/0` | **wyłącznie wiersz `G15`** |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

`src/**` · `server/src/**` · `public/locales/**` · **dwanaście plików `MODULE_ACCEPTANCE.md`
poza czterema Twoimi** · żaden wiersz macierzy poza `G15` · §R1 rejestru `G15` ·
`vitest*.config.ts` · `server/vitest.config*.ts` · `tests/setup.ts` · `tests/helpers/**` ·
`tests/__mocks__/**` · `scripts/**` · `.github/workflows/**` ·
żaden plik dyżurów 359, 360, 361 ani 363–366.

★ Plik postępu `/private/tmp/cx-day362-postep.md` żyje **poza repo**.

### B.4.4. Zasoby wyłączne

Baza **6433**, runtime **5573**, kontener **`cx-day362-pg`**, baza **`cx362`**,
worktree `/private/tmp/cx-day362-g15-pomiary`, gałąź `codex/day362-g15-pomiary-20260904`.
Sprawdziłem 04.09: oba porty wolne, kontener nie istnieje, worktree nie istnieje,
gałąź nie istnieje.

★★ **Port zajęty = STOP CAŁOŚCI (`Z7`), NIGDY podmiana numeru.**

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
git status --short                  # zero plikow spoza tabeli B.4.1/B.4.2
git diff --cached --stat            # ★ commit dotykajacy macierzy MUSI zawierac plik dowodowy
git diff -- src/ server/src/        # PUSTY
bash -c "git diff --cached --name-only | grep -E 'vitest.*config|tests/setup|tests/helpers|tests/__mocks__' && echo 'STOP: harness nietykalny' || echo 'harness nietkniety'"
bash -c "git diff --cached --name-only | grep -E 'modules/(01|02|03|05|06|07|08|10|11|13|14|16)_' && echo 'STOP: cudzy modul' || echo 'cudze moduly nietkniete'"
bash -c "git diff --cached -- docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_G15_SAMOKONTROLA_20260903.md | grep -E '^-[^-]' && echo 'STOP: kasujesz rejestr G15' || echo 'rejestr G15 tylko dopisany'"
bash -c "grep -rnE '^(<{7}|>{7}|={7})' \$(git diff --cached --name-only)"   # zero znacznikow konfliktu
```

### B.4.6. ★★ ROZŁĄCZNOŚĆ Z DYŻURAMI RÓWNOLEGŁYMI — czytaj, zanim dotkniesz macierzy

Cztery dyżury tej paczki dotykają **tych samych plików** `MODULE_ACCEPTANCE.md`, ale
**rozłącznych kolumn i modułów**:

| Dyżur | Kolumna | Moduły |
| --- | --- | --- |
| 359 | `G20` | wszystkie 16 |
| 360 | `G19` | `01`, `04`, `05`, `06`, `08`, `11`, `13` |
| 361 | `G19` | `02`, `03`, `07`, `09`, `10`, `12`, `14`, `15`, `16` |
| **362 (Ty)** | **`G15`** | **`04`, `09`, `12`, `15`** |

★ **Twoje pliki `04`, `09`, `12`, `15` są dotykane także przez inne dyżury — w INNYCH
kolumnach.** Konflikt scalenia rozstrzyga **nadzorca**. Nie próbujesz go uprzedzić, nie
scalasz cudzej gałęzi, nie „porządkujesz" cudzej kolumny i nie poprawiasz cudzego wiersza,
nawet jeżeli uważasz, że jest zły — **to jest znalezisko do raportu, nie do edytora**.

---

## R0 — TRZY TWARDE ZASADY (przeczytaj, zanim cokolwiek zrobisz)

**ZASADA 1 — wiersz macierzy zmienia stan WYŁĄCZNIE z dowodem załączonym w TYM SAMYM
commicie.** `git show --stat` musi zawierać plik z `evidence/g15/day362/**`. Commit bez dowodu
**cofasz przez `git reset --soft HEAD~1`**. **Wpis bez dowodu = odrzucenie całego dyżuru.**

**ZASADA 2 — nie wolno „naprawiać" bramki przez nadpisanie mianownika ani zawężenie
kryterium.** Mianownik to **katalogi z §R1, dosłownie**. Nie wyjmujesz pliku, katalogu ani
„nieistotnej" suity. Nie zmieniasz configu ani `setup.ts`. Nie dobierasz zmiennej
środowiskowej do oczekiwanego wyniku. **Jeżeli kryterium jest źle postawione — piszesz
pytanie, nie poprawiasz.**

**ZASADA 3 — `TECHNICAL_REGRESSION_PASS` był odrzucony DWA RAZY i nie wolno go wprowadzić pod
żadną nazwą** — ani `SERVER_PASS_PARTIAL`, ani `PASS (zakres serwerowy)`, ani `MACHINE_PASS`.
`PASS` w `G15` znaczy dokładnie tyle, ile znaczy przy `13_CHAT`: **front i serwer, pełny
mianownik z §R1, realny PG, `--retry=0`, zero błędów suity**. Nic mniej.

★ **Jeżeli uważasz, że te trzy zasady razem czynią część dyżuru niewykonalną — to jest wynik
i zapisujesz go jako pytanie. Nie obchodzisz ich.**

---

## R1 — ROZKŁAD, MIANOWNIK, ODCZYT ARTEFAKTÓW (rdzeń, tani)

1. **Potwierdź albo obal moje sprostowanie** o `PARTIAL_PASS` vs `NOT_MEASURED` — komenda
   `(1)`. Wypisz **wszystkie 16** wierszy ze stanem i podtypem. To zajmuje minutę i chroni
   Cię przed pracą nad złymi czterema modułami.
2. **Wypisz katalogi z §R1** dla `04`, `09`, `12`, `15` — dosłownie, front i serwer osobno.
   **Policz pliki dziś sam** (`find`/`rg`) i zapisz obok liczb historycznych
   (§R1: `33`/`67`/`41`/`7`; raport 336 na HEAD: `53`/`69`/`40`/`7`). **Rozjazd zapisujesz,
   nie naprawiasz zawężeniem katalogów.**
3. **Odczytaj surowe JSON-y dyżuru 336** dla `04`, `09`, `12` (komenda `(4)`). Zapisz
   `numTotalTests`, `numPassedTests`, `numFailedTests`, `numFailedTestSuites`.
   ★ Dla `12_AUDITS` **ustal, czym jest różnica `317 − 244 − 1 = 72`** — pending, skipped
   czy błąd suity. To rozstrzyga, czy `12` w ogóle może dostać `PASS`.
4. **Wypisz pełne nazwy (`fullName`) wszystkich czerwonych przypadków** z tych trzech plików
   do `evidence/g15/day362/przed-nazwy.txt`. To jest Twoja baza porównawcza —
   **porównania robisz po nazwach, nigdy po liczbach**.
5. **Przeczytaj regułę z sekcji „Aktualizacja dyżuru 347"** rejestru `G15` (trzy punkty)
   i wypisz, **który z Twoich pakietów wchodzi do której kategorii**. To jest plan `R3`.

**Wymagany dowód:** `evidence/g15/day362/r1-rozklad-i-mianownik.md` — 16 wierszy stanu,
katalogi §R1 dla czterech modułów, policzone dziś liczby plików obok historycznych, tabela
z JSON-ów 336, orzeczenie o `72` w `12_AUDITS`, przypisanie pakietów do kategorii 347 ·
`przed-nazwy.txt`. **Commit po `R1`.**

---

## R2 — FRONT CZTERECH MODUŁÓW (rdzeń)

Kryterium `13_CHAT` brzmi „front **i** serwer". Front tych czterech jest wg macierzy zielony,
ale **wiersz zamykasz swoim pomiarem, nie cudzym**.

1. Uruchom front **dla każdego z czterech modułów osobno**, na katalogach **dosłownie z §R1**.
   `--retry=0`, `--reporter=json --outputFile=<ARTEFAKTY>`.
2. Podaj `numTotalTests`, `numPassedTests`, `numFailedTests` **oraz `numFailedTestSuites`**.
   ★★ **Sama trójka liczb nie wystarcza**: dyżur 336 znalazł **10 plików/suit, które nie
   wykonały czerwonej asercji** — to nie są ani zielone, ani czerwone, to są **błędy
   komendy**. `numFailedTestSuites > 0` przy `numFailedTests = 0` znaczy, że coś się nie
   uruchomiło.
3. Porównaj z liczbami z macierzy (`04` — 620/620; `09` — 418/418; `12` — 17/17; `15` — 13/13).
   **Rozjazd zapisujesz.** Porównanie po **nazwach**, nie po liczbach.
4. ★ Przelot z **zerem** wykonanych przypadków kończy się `exit 0` i **nie jest pomiarem**.
   `No test files found` i `Transform failed` to **BŁĄD KOMENDY**, nie `PASS`.

**Wymagany dowód:** cztery `*.json` w `evidence/g15/day362/` · tabela z czterema liczbami
per moduł · porównanie po nazwach. **Commit po `R2`.**

---

## R3 — SERWER `04`, `09`, `12` (rdzeń, commit ×3)

1. Kontener `cx-day362-pg`, port `6433`, baza `cx362`, obraz `pgvector/pgvector:pg16`.
   Migracje **dwoma przebiegami na bazie OD ZERA**; drugi ma dać `Applying migrations: 0`.
   Oba logi do `evidence/g15/day362/`.
2. **Wariant bazowy** (dosłownie ten, którym 336 mierzył 15 modułów): `cwd=server`,
   `--config vitest.config.ts`, `--retry=0`, realny `DATABASE_URL`, `RUN_DB_TESTS=1`,
   `MOCK_DB=false`, `DB_TYPE=postgres`, `NODE_ENV=test`, `ENABLE_V8_GLOBAL=true`,
   `ENABLE_TEST_AUTH_BYPASS=false`, lokalny `JWT_SECRET`.
   **Zapisujesz pełny zestaw zmiennych przy KAŻDYM przelocie.**
3. ★★★ **`RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` stosujesz PER PAKIET**, wg
   trzech punktów reguły z rejestru — **nigdy hurtem**. To jest cała różnica wobec 336:
   - pakiety dowodzące **koperty widoczności** (`tests/acceptance/res-internal-beta-visibility.mounted.pg.test.ts`,
     `tests/integration/results/day46.*.realpg.test.ts`) — **zawsze z `enforce`**;
   - **izolowane pakiety kontraktu HTTP**, które zastępują middleware i nie tworzą realnej
     fikstury `organization_members` — **bez `enforce`**;
   - pakiet realnego Gateway/PG **bez `enforce` tylko wtedy**, gdy jego celem nie jest dowód
     koperty **i raport jawnie to uzasadnia**; domyślnie dowody uprawnień zostają fail-closed.
   ★ **Dla każdego pakietu zapisujesz, do której kategorii go przypisałeś i dlaczego.**
   Wariant dobrany do **rodzaju pakietu** jest poprawny; wariant dobrany do **oczekiwanego
   wyniku** jest podrobieniem pomiaru.
4. **Klasyfikacja czerwieni po `fullName`**, wobec `przed-nazwy.txt` z `R1`:
   `ZASTANA` (ta sama pełna nazwa czerwona wcześniej) · `NOWA` (nazwa czerwona dziś, zielona
   wcześniej) · `ZMIANA ZAKRESU` (nazwa zniknęła lub przybyła) · `BŁĄD KOMENDY` (suita nie
   wykonała ani jednej asercji). Zapisz `po-nazwy.txt` i `przed-po-nazwy.diff`.
5. ★★ **Jeżeli robisz parę z bazą `f65c4ff6a0`** — powtarzasz jawną kopię
   `src/components/shared/PreviewPane/PreviewAIHintStrip.tsx` z HEAD (baza ma tam
   **nierozstrzygnięty marker konfliktu** w wierszu `110`, przez co pliki dotykające jej grafu
   importów wykonały **zero przypadków**) i **zapisujesz tę ingerencję** oraz `git status --short`
   przed usunięciem worktree bazy.
6. **Sprzątanie:** `docker rm -fv cx-day362-pg` (bez `-v` wolumen zostaje), `df -h /` przed
   i po. ★ **Zakaz `pkill`/`killall`** — zabijasz wyłącznie własne PID-y.

★★ **Czego NIE robisz w `R3`:** nie naprawiasz ani jednej czerwieni. Ten dyżur mierzy
i klasyfikuje. Znaleziony defekt idzie do raportu jako `plik:linia` + **diff nienałożony**.

**Wymagany dowód (per moduł):** `*.json` przelotu · pełny zestaw zmiennych · przypisanie
każdego pakietu do kategorii 347 z uzasadnieniem · tabela klasyfikacji po `fullName` ·
dwa logi migracji · `df -h /` przed i po. **Commit po każdym module.**

---

## R4 — `15_SETTINGS`: MODUŁ BEZ ŚCIEŻKI SERWEROWEJ (rdzeń, krótki)

§R1 wymienia dla `15_SETTINGS` **wyłącznie** `src/components/settings/__tests__` i
`tests/unit/settings`. **Zero katalogów serwerowych.** Dyżur 336 z tego powodu **nie
wyprodukował dla niego JSON-a serwerowego i nie wpisał `PASS 0/0`** — i **zadał o to pytanie**,
które do dziś jest bez odpowiedzi.

**Twoje trzy kroki:**

1. **Sprawdź, czy §R1 ma rację.** Czy w repo istnieje **jakikolwiek** katalog testów
   serwerowych, który logicznie należy do Ustawień (kandydaci do sprawdzenia, nie ustalenia:
   `server/src/routes/**settings**`, `server/src/services/**settings**`, trasy profilu
   i preferencji użytkownika)? Wypisz co znalazłeś, z liczbą plików.
   ★ **Znalezienie takiego katalogu NIE upoważnia Cię do dopisania go do §R1** — §R1 jest
   nietykalne. Jest to **materiał do pytania**.
2. **Nie wpisujesz `PASS 0/0`.** Stan wiersza po Twoim dyżurze to albo `PARTIAL_PASS` z
   uzupełnionym frontem i **jawnym zdaniem, że warstwa serwerowa jest poza mianownikiem wg
   §R1 i czeka na decyzję**, albo bez zmian — nigdy zieleń przez pustkę.
3. **Eskaluj pytanie 1 dyżuru 336** — z datą pierwszego zadania (`2026-09-04`), nazwą dyżuru
   i **Twoim pomiarem z punktu 1** jako materiałem do decyzji. Pytanie ma być
   **rozstrzygalne**: wybór z wypisanymi konsekwencjami, nie „co robimy?".

**Wymagany dowód:** `evidence/g15/day362/r4-settings.md` — wynik poszukiwania katalogów
serwerowych z liczbami · brzmienie wiersza · rozstrzygalne pytanie. **Commit po `R4`.**

---

## R5 — WPISY DO MACIERZY I ESKALACJA PYTAŃ (rdzeń)

1. **Dla każdego z czterech modułów** ustal stan na podstawie `R2`+`R3`+`R4`:

| Warunek | Stan |
| --- | --- |
| front zielony **i** serwer zielony **i** pełny mianownik §R1 **i** zero błędów suity | **`PASS`** — z liczbami front i serwer, jak przy `13_CHAT` |
| pomiar wykonany, ale czerwień **`ZASTANA`** została | `PARTIAL_PASS / RED_LEGACY_<n>` — z **imienną** listą pełnych nazw |
| pomiar wykonany, czerwień **`NOWA`** | `PARTIAL_PASS / RED_NEW_<n>` — z imienną listą; **to jest znalezisko**, nie tło |
| `numFailedTestSuites > 0` przy `numFailedTests = 0` | **`BŁĄD KOMENDY`** — pomiar nieudany, stan **nie** idzie na `PASS` |
| brak ścieżki w §R1 (`15_SETTINGS`) | **NIGDY `PASS 0/0`** — patrz `R4` |

2. **Każdy zmieniony wiersz niesie w kolumnie dowodu:** liczby front (`X/X/0`), liczby serwer
   (`Y/Y/0` albo imienną czerwień), **`numFailedTestSuites`**, wariant zmiennych, marker
   pomiaru (`2a7273e087`), datę i **ścieżkę artefaktu** w `evidence/g15/day362/`.
3. **Wpis i dowód idą JEDNYM commitem.**
4. **Policz: ile wierszy zmieniłeś, ile dowodów załączyłeś. Te dwie liczby mają być równe.**
5. **Eskaluj DWA pytania dyżuru 336** — z datą pierwszego zadania, nazwą dyżuru i Twoim
   materiałem. ★ Pytanie 2 („czy potwierdzony dług zastany ma nadal blokować `PASS`") dotyczy
   **wszystkich dziesięciu** `PARTIAL_PASS`, nie tylko Twoich czterech — powiedz to wprost,
   bo od odpowiedzi zależy, czy `G15` domknie się w jednym dyżurze, czy w sześciu.
6. **Zero zmienionych wierszy jest dopuszczalnym wynikiem** — po wykonaniu `R2`–`R4`,
   z powodem **per moduł**.

**Wymagany dowód:** `git show --stat` każdego commita dotykającego macierzy · tabela
„wiersz → stan → dowód" · dwie zgodne liczby · dwa eskalowane pytania. **Commit po `R5`.**

---

## R6 — RAPORT I DWIE SEKCJE REJESTRÓW

Raport `CODEX_DAY362_G15_POMIARY_REPORT.md` zawiera, w tej kolejności:

1. **Każdą liczbę z tej instrukcji, którą Twój pomiar obalił** — osobną sekcją, na początku;
   w szczególności potwierdzenie albo obalenie mojego sprostowania `PARTIAL_PASS`
   vs `NOT_MEASURED`.
2. `R1`: rozkład 16 wierszy, katalogi §R1, policzone dziś pliki obok historycznych,
   orzeczenie o `72` w `12_AUDITS`.
3. `R2`: front czterech modułów — cztery liczby per moduł, porównanie po nazwach.
4. `R3`: serwer `04`, `09`, `12` — per pakiet: kategoria wg reguły 347, wariant zmiennych,
   liczby, klasyfikacja czerwieni po `fullName`. ★ **Ile czerwieni `09_RESULTS` okazało się
   artefaktem pomiaru, a ile zostało po poprawnym wariancie** — to jest najważniejsza liczba
   tego raportu.
5. `R4`: `15_SETTINGS` — co znalazłeś, dlaczego nie ma `PASS 0/0`.
6. `R5`: tabela „wiersz → stan → dowód", dwie zgodne liczby.
7. **Dwa eskalowane pytania o kryterium** — z datą pierwszego zadania i konsekwencjami.
8. **Defekty znalezione, ale nienaprawione** — `plik:linia` + diff nienałożony.
9. Co zostało niewykonane i dlaczego — imiennie.
10. `df -h /` przed i po; potwierdzenie usunięcia kontenera.

**Sekcja „Aktualizacja dyżuru 362"** na końcu
`docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_G15_SAMOKONTROLA_20260903.md` — **dopisana,
nigdy zamiast czegoś**. Zawiera: marker pomiaru, cztery moduły, wariant per pakiet, liczby,
i **regułę dla kolejnych pomiarów**, jeżeli Twój dyżur ją doprecyzował.

Sekcja w `docs/program/REJESTR_ZNALEZISK_20260903.md` — **litera `AD`**, sprawdzana komendą
**tuż przed commitem**:
`bash -c "grep -nE '^## [A-Z]+[.]' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -5"`.
Dziś sekcje idą do `Z`; litera `V` jest **wolna, ale zarezerwowana** — nie zajmuj jej.
Jeżeli `AD` jest zajęta, bierzesz pierwszą wolną i **zapisujesz to w raporcie**.

**Commit po `R6`.**

---

## Próg odbioru

Dyżur jest odebrany, gdy **wszystkie** poniższe są prawdziwe:

1. `R1` potwierdził albo obalił rozkład 16 wierszy i wypisał katalogi §R1 dla czterech
   modułów, z policzonymi dziś liczbami plików.
2. `R2` dał front dla **każdego** z czterech modułów, z `numTotalTests` **i**
   `numFailedTestSuites`, na katalogach **dosłownie z §R1**.
3. `R3` dał serwer dla `04`, `09`, `12`, z **wariantem dobranym PER PAKIET** wg reguły 347
   i uzasadnieniem dla każdego pakietu.
4. Klasyfikacja czerwieni wykonana **po `fullName`**, z plikami `przed-nazwy.txt`,
   `po-nazwy.txt` i `diff` w repo.
5. Raport podaje **imiennie**, ile czerwieni `09_RESULTS` było artefaktem pomiaru, a ile
   zostało.
6. `15_SETTINGS` **nie dostał `PASS 0/0`**; `R4` wypisał wynik poszukiwania katalogów
   serwerowych i **rozstrzygalne pytanie**.
7. **Żaden `PARTIAL` nie stał się `PASS` przez wyjęcie czegokolwiek z mianownika**, przez
   zmianę configu, `setup.ts`, treści testu ani przez dobór zmiennej do wyniku;
   `git diff` na kodzie produktu i na harnessie **pusty**.
8. Każdy zmieniony wiersz niesie **liczby front + serwer + `numFailedTestSuites` + wariant +
   marker + datę + ścieżkę artefaktu** i ma dowód w **tym samym** commicie; **liczba wierszy
   = liczbie dowodów**.
9. **Dwa pytania o kryterium eskalowane z datą pierwszego zadania** (04.09, dyżur 336),
   nie zgłoszone jako nowe.
10. Liście słowników i cztery bramki identyczne przed i po; **dwanaście cudzych wierszy `G15`
    nietkniętych**; §R1 rejestru `G15` nietknięte; kontener usunięty; `df -h /` przed i po.

---

## Prawo zatrzymania

Zatrzymujesz się i piszesz **STOP** z powodem, jeżeli:

- którykolwiek z Twoich portów (`6433`, `5573`) jest zajęty — **STOP całości, nigdy podmiana**;
- §R1 rejestru `G15` albo `evidence/g15/day336-artefakty/**` **nie istnieje** — wtedy zniknął
  SSOT mianownika albo baza porównawcza i trzeba to zgłosić, a nie mierzyć na własnym
  mianowniku;
- migracje nie przechodzą dwukrotnie na czystej bazie;
- doprowadzenie któregokolwiek wiersza do `PASS` wymagałoby **wyjęcia czegokolwiek
  z mianownika**, zmiany configu, `setup.ts` albo treści testu;
- pakiet nie daje się przypisać do żadnej z trzech kategorii reguły 347 — **wtedy STOP dla
  tego pakietu**, opis dlaczego, i pytanie do właściciela; nie dobierasz wariantu „na oko".

★ **Zatrzymanie z konkretnym powodem jest pełnowartościowym wynikiem dyżuru.**
Zmyślony dowód nie jest.

---

## AUDYT SPRZECZNOŚCI — pary wymagań i miejsce rozstrzygnięcia

| Para | Rozstrzygnięcie |
| --- | --- |
| „zamknij wiersze, jeżeli wychodzą zielone" × „zakaz zawężenia kryterium" | `R5`, tabela warunków — `PASS` wyłącznie przy pełnym mianowniku §R1 i zerze błędów suity |
| „`15_SETTINGS` też jest w zakresie" × „nie ma ścieżki serwerowej" | `R4` — nie `PASS 0/0`; front uzupełniony, warstwa serwerowa jako **eskalowane pytanie** |
| „wykonaj pomiar serwerowy" × „nie naprawiaj czerwieni" | `R3` punkt „czego NIE robisz" — mierzysz i klasyfikujesz; defekt → `plik:linia` + diff nienałożony |
| „stosuj wariant 336" × „347 udowodnił, że wariant 336 był zły" | `R3` punkt 3 — wariant bazowy z 336, ale `enforce` **per pakiet** wg reguły z rejestru |
| „`04` ma w repo `113/113/0`" × „to wciąż `SERVER_NOT_MEASURED`" | `R1` punkt 3 + `R3` — stary artefakt jest **wskazówką**, dowodem jest Twój przelot na Twoim markerze |
| „mianownik §R1 = `33`" × „raport 336 mierzy `53`" | `B.3` wiersz 4 — obowiązują **katalogi** §R1, nie liczba z raportu; rozjazd zapisujesz |
| „porównaj z bazą `f65c4ff6a0`" × „baza się nie kompilowała" | `R3` punkt 5 — jawna kopia `PreviewAIHintStrip.tsx` z HEAD, ingerencja zapisana |
| „zadaj pytanie o kryterium" × „zakaz pytania po raz drugi" | `R4`/`R5` — **eskalacja z datą pierwszego zadania**, nie nowe zgłoszenie |
| „`git add -f` dla dowodów" × „zakaz binariów w repo" | `B.1` — jawna licencja na `evidence/g15/day362/**` |
| „dopisz do rejestru `G15`" × „§R1 nietykalne" | `B.1` — **wyłącznie nowa sekcja na końcu**; bezpiecznik w `B.4.5` sprawdza brak skasowanych linii |
| „mandat CTO — decyduj sam" × „dwa pytania do właściciela" | `R5` punkt 5 — wariant pomiaru i klasyfikację rozstrzygasz sam; **definicja kryterium bramki** jest regułą programu i idzie do właściciela |

---

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C szkieletu)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności | TAK — jedenaście par, każda rozstrzygnięta w treści |
| 2 | Każda ścieżka istnieje na markerze albo jest oznaczona `NOWY` | TAK — sprawdzone na `2a7273e087`; zero `BRAK`. Oznaczone `NOWY`: `evidence/g15/day362/**`, raport, sekcja „Aktualizacja dyżuru 362", sekcja `AD` |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — `B.3`, jedenaście wierszy; ★ **rozkład wierszy `G15` ze zlecenia OBALONY własnym pomiarem** (cztery `SERVER_NOT_MEASURED` to `PARTIAL_PASS`, a cztery `NOT_MEASURED` to inne moduły) |
| 4 | Tabela licencji kompletna, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — każdy wiersz „tylko odczyt" ma rzeczownik-produkt (lista katalogów · liczby · zestaw zmiennych) |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `B.2`, kolumna 4; katalogi testów są rozłączne per moduł |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — `B.4.4` i **`B.4.6`** (rozłączność kolumn i modułów wobec 359, 360, 361); `6433`/`5573` zmierzone jako wolne. ★ 363–366 pisze inny autor — `Z7` zaostrzony |
| 7 | Komendy paste-ready, z komentarzem oczekiwanego wyniku | TAK — wszystkie grepy przez `bash -c`, wszystkie przeloty z `--retry=0` i `--reporter=json` |
| 8 | Pułapki środowiska w całości + pułapki właściwe temu dyżurowi (siedem) | TAK — `§0.2d` w części A + siedem pułapek w polu pułapek |
| 9 | Samodzielność — zero odwołań do rozmów bez ścieżki | TAK; każdy cytat pracy 286, 336, 347 i 355 ma ścieżkę artefaktu albo `plik:linia` |
| 10 | Klauzula sprzeczności obecna; niewypełnionych pól szablonu: `0`; wierszy `Z`: `41` | TAK — sprawdzone przez generator, który blokuje zapis przy niespełnieniu |
