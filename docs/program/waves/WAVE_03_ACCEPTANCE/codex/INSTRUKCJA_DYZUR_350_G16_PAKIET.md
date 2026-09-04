# INSTRUKCJA DYŻURU nr 350 — Codex — „★★★ PAKIET PRZELOTU WŁAŚCICIELA — ZAKTUALIZOWAĆ GO DO BIEŻĄCEGO STANU, MODUŁ PO MODULE, PRZED DRUGĄ TURĄ. `G16` to jedyna bramka macierzy, której NIE ZAMKNIE MASZYNA: 16 wierszy `TECHNICAL_PACKET_READY / OWNER_RETEST_PENDING` czeka na oczy właściciela. Pakiet istnieje — `docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md`, 381 wierszy, 16 sekcji modułowych — ale **zdezaktualizował się**. ★★ Mój pomiar: od commita, który go ostatnio poprawił (`3cb7390766`, 04.09 o 05:44), weszło **49 scaleń** i zmieniło się **171 plików produktu** (`src/` i `server/src/`), z czego **66 w `src/components/AIChat`**, **51 w `server/src/routes`**, 8 w `MyWork`, 5 w `Interview`, po 3 w `assessment` i `DiscoveryTools`, po 2 w `Initiatives` i `DocumentStudio`. To NIE jest „kilkanaście scaleń”. ★★ Pakiet podaje własną wersję stagingu jako `fb6547b7d0` — commit, który jest dziś **325 commitów za `HEAD`**; nadzorca podaje `1c4b5a5635` (72 commity za `HEAD`). **Tej rozbieżności NIE rozstrzygasz sam połączeniem do stagingu — `Z28` tego zakazuje bezwzględnie** — tylko zapisujesz ją wprost jako pytanie. ★★★ **NIE WPISUJESZ ANI JEDNEGO WIERSZA `G16` JAKO `PASS`** — to robi właściciel po przelocie, nie dyżur"

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
> **wyłącznie** `/private/tmp/cx-day350-g16-pakiet`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `6a4919f72db338e7f49a2cacb3787d20cc649883`**
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
Zakres: **PRZEKROJOWE — bramka `G16` („Owner acceptance flight”) macierzy odbioru fali 3, wszystkie 16 modułów, oraz jeden dokument: `docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md`. Przedmiotem pracy jest **AKTUALIZACJA PAKIETU**, a nie zmiana produktu i nie zmiana stanu wierszy `G16`. **Ten dyżur nie pisze ani jednej linii kodu produkcyjnego.** Prawo zatrzymania PO KAŻDEJ pozycji `R`, z commitem, i plikiem postępu `/private/tmp/cx-day350-postep.md` (poza repo)**.
Trasy front: `Wszystkie katalogi frontu są **TYLKO DO ODCZYTU** — czytasz je, żeby sprawdzić, czy zdanie z pakietu jest nadal prawdziwe. Ciężar zmian od czasu napisania pakietu, moje liczby: `src/components/AIChat` **66 plików**, `src/components/MyWork` **8**, `src/components/Interview` **5**, `src/components/assessment` **3**, `src/components/DiscoveryTools` **3**, `src/components/Initiatives` **2**, `src/components/DocumentStudio` **2**, po jednym w `ui`, `standard`, `shared`, `layout`, `ReportBuilder`, `Presentations`, `App.tsx`, `src/hooks/useReportSections.ts`, `src/services/api.ts`, `src/services/chatSuggestionsPreference.ts`, `src/store/useToolStore.ts`, `src/toolPacks/packs/dynamicSwot.pack.ts`, `src/utils/dynamicSwotSevenStagesFlag.ts`. Flagi wprowadzone lub zmienione w tym oknie, wszystkie **default OFF**: `VITE_VF1_DYNAMIC_SWOT_SEVEN_STAGES`, `VITE_VF1_INITIATIVE_SECTIONS_COMPLETE`, `VITE_VF1_DECISION_CARD_CONTRACT`, `VITE_VF1_DECISION_SPECA`, `VITE_VF1_INITIATIVE_CARD_CONTRACT``. Trasy tył: `Wszystkie katalogi serwera są **TYLKO DO ODCZYTU**. Ciężar zmian od czasu napisania pakietu: `server/src/routes` **51 plików**, `server/src/services` **10**, po 2 w `middleware` i `database`, 1 w `controllers`. ★★ Źródła, z których czerpiesz treść aktualizacji — wszystkie do ODCZYTU: `docs/program/REJESTR_ZNALEZISK_20260903.md` (sekcje `M` i `N` opisują decyzje `DEC-386`…`DEC-391` i to, co właściciel zobaczy inaczej), `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md`, `docs/program/FALA_2_PO_STAGINGU.md` (co świadomie NIE jest zrobione), `docs/program/DECYZJE_WLASCICIELA_DO_PODJECIA_20260904.md`, `docs/program/waves/WAVE_03_ACCEPTANCE/AUDYT_PRZEWODOW_ODBIORU_20260903.md`, wiersze `G14` i `G16` szesnastu plików `MODULE_ACCEPTANCE.md`, komunikaty 49 scaleń (`git log --oneline --merges --first-parent 3cb7390766..HEAD`) oraz raporty odbiorowe `ODBIOR_DYZUROW_*_20260904.md``.

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
WT=/private/tmp/cx-day350-g16-pakiet
MARKER=6a4919f72db338e7f49a2cacb3787d20cc649883

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/grafika/m03-20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day350-g16-pakiet-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day350-g16-pakiet/config.worktree"
cat "$VAULT/worktrees/cx-day350-g16-pakiet/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day350-g16-pakiet-scratch
mkdir -p /private/tmp/cx-day350-g16-pakiet-artefakty

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
git -C "$VAULT" log --oneline 6a4919f72db338e7f49a2cacb3787d20cc649883..github-backup/grafika/m03-20260902
git -C "$VAULT" diff --name-only 6a4919f72db338e7f49a2cacb3787d20cc649883..github-backup/grafika/m03-20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day350-g16-pakiet-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 6a4919f72db338e7f49a2cacb3787d20cc649883..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `9` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA: pakiet istnieje, ma 381 wierszy i 16 sekcji modulowych
wc -l docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md
bash -c "grep -cE '^## [0-9]+\. ' docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md"
bash -c "grep -nE '^## ' docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md"
#   moje liczby: 381 wierszy; 16 sekcji modulowych; naglowki dodatkowe:
#   'Zanim zaczniesz', 'Jak zglaszac uwage', 'Czego NIE zglaszaj nigdy',
#   'Znane ograniczenia stagingu', 'Tabela do wypelnienia', 'Zrodla tego pakietu'

# (2) ★★ TEZA ROZSTRZYGAJACA: pakiet zdezaktualizowal sie o 49 scalen i 171 plikow produktu
git log --oneline -1 -- docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md
SHA_PAKIETU=$(git log --format=%H -1 -- docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md)
git log --oneline --merges --first-parent "$SHA_PAKIETU"..HEAD | wc -l
git diff --name-only "$SHA_PAKIETU" HEAD -- src server/src | wc -l
#   moje liczby: ostatni commit pakietu 3cb7390766 (04.09 05:44); 49 scalen; 171 plikow produktu

# (3) ★★ TEZA: ciezar zmian nie rozklada sie rowno — 66 plikow to JEDEN modul (Czat)
git diff --name-only 3cb7390766 HEAD -- src server/src \
  | sed 's#^\(src/components/[^/]*\)/.*#\1#; s#^\(src/views/[^/]*\)/.*#\1#; s#^\(server/src/[^/]*\)/.*#\1#' \
  | sort | uniq -c | sort -rn | head -12
#   moje liczby: AIChat 66 · server/src/routes 51 · server/src/services 10 · MyWork 8 ·
#   Interview 5 · assessment 3 · DiscoveryTools 3 · Initiatives 2 · DocumentStudio 2

# (4) ★★ TEZA: wszystkie 16 wierszy G16 stoja na TECHNICAL_PACKET_READY / OWNER_RETEST_PENDING
for m in docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/; do \
  printf '%-20s :: ' "$(basename $m)"; \
  grep -E '^\|[[:space:]]*G16\b' "$m/MODULE_ACCEPTANCE.md" | head -1 | awk -F'|' '{gsub(/^ +| +$/,"",$4); print $4}'; \
done
#   moje liczby: 16 z 16 = `TECHNICAL_PACKET_READY / OWNER_RETEST_PENDING`, bez wyjatku.
#   ★ Ani jednego z nich NIE zmieniasz na PASS — to robi wlasciciel po przelocie

# (5) ★★ TEZA: pakiet podaje wersje stagingu, ktora rozjezdza sie z ta od nadzorcy
bash -c "grep -n 'fb6547b7d0\|58ef0771d7\|1c4b5a5635' docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md"
for s in fb6547b7d0 1c4b5a5635; do printf '%s ' $s; \
  git merge-base --is-ancestor $s HEAD && echo "przodek, do HEAD: $(git rev-list --count $s..HEAD)" || echo 'NIE przodek'; done
#   moje liczby: pakiet mowi fb6547b7d0 (325 commitow za HEAD); nadzorca podaje 1c4b5a5635 (72).
#   ★★ NIE sprawdzasz tego polaczeniem do stagingu — `Z28` zakazuje bezwzglednie. Zapisujesz rozbieznosc

# (6) TEZA: naprawa kart inicjatyw jest ZA FLAGA WYLACZONA — wlasciciel dalej zobaczy 6 z 24 sekcji
bash -c "grep -n 'VITE_VF1_INITIATIVE_SECTIONS_COMPLETE\|DEC-388' src/components/Initiatives/sections/initiativeCardContract.ts | head -6"
bash -c "grep -rn 'DEC-388' docs/program/REJESTR_ZNALEZISK_20260903.md | head -3"
#   oczekiwane: flaga domyslnie OFF; decyzja DEC-388 opisana w sekcji N rejestru znalezisk.
#   ★ To jest STAN OCZEKIWANY, nie defekt do zgloszenia — i musi trafic do pakietu

# (7) TEZA: zrodla pakietu istnieja i nie sa generowane
ls docs/program/FALA_2_PO_STAGINGU.md \
   docs/program/DECYZJE_WLASCICIELA_DO_PODJECIA_20260904.md \
   docs/program/waves/WAVE_03_ACCEPTANCE/AUDYT_PRZEWODOW_ODBIORU_20260903.md \
   docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
bash -c "grep -rl 'PRZELOT_WLASCICIELA' scripts/" ; echo "kod grepa=$?"
#   oczekiwane: cztery pliki istnieja; grep w scripts/ NIC nie znajduje (kod 1) =>
#   pakiet NIE jest generowany i wolno go edytowac recznie

# (8) TEZA: liscie slownikow i bramki kanonu na markerze
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus=$?"
bash scripts/check-list-canon.sh >/dev/null 2>&1; echo "list=$?"
bash scripts/check-artefakt.sh >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
#   moje liczby: pl 35198, en 33065; focus=0, list=0, artefakt=0, reach=0

# (9) zasoby: dysk, porty, kontener
df -h /
lsof -nP -iTCP:6397 -sTCP:LISTEN; lsof -nP -iTCP:5537 -sTCP:LISTEN
docker ps -a --format '{{.Names}}' | grep -c cx-day350 || true
#   oczekiwane: powyzej 5 GB wolnego; oba porty puste; 0 kontenerow.
#   ★ Ten dyzur najprawdopodobniej NIE potrzebuje bazy — jezeli jej nie postawisz, napisz to wprost
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day350-g16-pakiet-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6397`. Twój JEDYNY port harnessu to `5537`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day350-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta restricted ports Chromium. Zajęte przez hosta i tor grafiki: 3020, 3022, 3025, 3027, 3030, 5432, 5433, 6012, 6379. Rodzeństwo TEJ paczki 04.09 — nie dotykasz: 347 (6394/5534), 348 (6395/5535), 349 (6396/5536). Równoległa paczka 343-346 ma zarezerwowany przedział 6390-6393 i 5530-5533 — również nie dotykasz. Starsze rodzeństwo 04.09: 334 (6370/5510), 335 (6371/5511), 336 (6372/5512), 337 (6373/5513). Cudze worktree 286-298 używają 6290-6299 i 5250-5269. Twoje własne wyłącznie: baza 6397, harness 5537. ★ ZAKAZ `pkill`/`killall` — zabijasz wyłącznie własne PID-y (zapisz `$!`). ★★ Ten dyżur jest dokumentacyjny i najprawdopodobniej NIE potrzebuje ani bazy, ani harnessu — zasoby są przydzielone jako rezerwa. **Jeżeli ich nie użyjesz, napisz to w raporcie wprost**; niepostawiony kontener jest wynikiem poprawnym, ukryty niepostawiony kontener nie`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `BRAK. Ten dyżur nie dodaje, nie zmienia i nie przełącza ANI JEDNEJ flagi funkcyjnej — ani w kodzie, ani w `.env*`, ani nigdzie indziej. ★★ Flagi, które **OPISUJESZ w pakiecie jako stan oczekiwany** (wszystkie **default OFF**, i taki mają zostać): `VITE_VF1_INITIATIVE_SECTIONS_COMPLETE` (`DEC-388` — dlatego karta inicjatywy dalej pokazuje 6 sekcji z 24), `VITE_VF1_INITIATIVE_CARD_CONTRACT` (`DEC-387`), `VITE_VF1_DYNAMIC_SWOT_SEVEN_STAGES`, `VITE_VF1_DECISION_CARD_CONTRACT`, `VITE_VF1_DECISION_SPECA`. **Opisanie flagi w dokumencie nie jest jej włączeniem — włączenie którejkolwiek z nich jest odrzuceniem dyżuru** (`Z10`, `Z11`)`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh --ci`, `scripts/check-artefakt.sh`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`, `server/src/middleware/auth.middleware.ts`, `server/src/services/ApiGateway.ts`. Wszystkie NIETYKALNE DO ZAPISU. ★ W tym dyżurze cały `src/**` i `server/src/**` jest nietykalny do zapisu — to jest dyżur dokumentacyjny`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY350_G16_PAKIET_REPORT.md`. Jedyny inny dokument do zmiany: `docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md` — **to jest główny produkt tego dyżuru**, aktualizowany przez poprawianie istniejących sekcji i dopisywanie nowych, nigdy przez przepisanie całości od zera. **ZAKAZ dotykania jakiegokolwiek `MODULE_ACCEPTANCE.md`** — w szczególności ZAKAZ wpisania `PASS` do wiersza `G16` w którymkolwiek z 16 modułów; ten wiersz zmienia właściciel po przelocie, nie dyżur. Dodatkowo wolno: utworzyć pliki dowodowe pod `evidence/g16/day350/` (katalog NIE ISTNIEJE na markerze — tworzysz go) oraz dopisać jedną nową sekcję do `docs/program/REJESTR_ZNALEZISK_20260903.md` o PIERWSZEJ WOLNEJ literze (sekcje idą dziś do `O`, ale równoległy autor też dopisuje — literę sprawdzasz komendą tuż przed commitem, nie zakładasz z góry). Plik postępu `/private/tmp/cx-day350-postep.md` żyje POZA repo. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day350-g16-pakiet-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day350-g16-pakiet-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ WPISANIA `PASS` DO WIERSZA `G16` W JAKIMKOLWIEK MODULE — I ZAKAZ DOTYKANIA JAKIEGOKOLWIEK `MODULE_ACCEPTANCE.md` W OGÓLE.** `G16` to jedyna bramka, której nie zamyka maszyna; zamyka ją właściciel oczami, po przelocie. Dyżur, który sam podniósł ten wiersz, sfałszował odbiór. **ZAKAZ POŁĄCZENIA DO STAGINGU, DEMO I PRODUKCJI W KAŻDĄ STRONĘ** (`Z28`) — nie sprawdzasz `/api/health`, nie robisz `curl` po `staging.consultify.ai`, nie logujesz się na konto odbiorowe właściciela. Rozbieżność znacznika stagingu zapisujesz jako **pytanie**, nie rozstrzygasz jej pomiarem. **ZAKAZ ZMIANY JAKIEGOKOLWIEK PLIKU W `src/` I `server/src/`** — ten dyżur nie pisze kodu; znaleziony defekt idzie do raportu jako rekomendacja z `plik:linia` i **diffem nienałożonym**. **ZAKAZ WŁĄCZENIA KTÓREJKOLWIEK FLAGI**, także tej, którą opisujesz jako stan oczekiwany. **ZAKAZ PRZEPISANIA PAKIETU OD ZERA** — właściciel czytał już poprzednią wersję; zmiany mają być punktowe, a każda poprawiona sekcja ma **cytować commit, który ją zdezaktualizował**. **ZAKAZ WPISANIA ZDANIA, KTÓREGO NIE MASZ Z CZEGO POTWIERDZIĆ W REPO** — pakiet czyta właściciel i każde nieprawdziwe zdanie kosztuje jego czas oraz zaufanie | `G16` jest jedyną bramką macierzy, której nie zamknie maszyna — 16 wierszy stoi na `TECHNICAL_PACKET_READY / OWNER_RETEST_PENDING` i czeka wyłącznie na oczy właściciela. Pakiet, po którym ma przelecieć, powstał 04.09 rano; od tego czasu weszło **49 scaleń i 171 zmienionych plików produktu**. Właściciel, który dostanie nieaktualny pakiet, zgłosi jako defekty rzeczy już naprawione i przeoczy te naprawione wczoraj — a to jest jego czas, najdroższy zasób programu. **Najgorszy możliwy wynik to pakiet, który każe zgłaszać coś, co jest świadomą decyzją z numerem** — na przykład kartę inicjatywy pokazującą 6 sekcji z 24, bo naprawa `DEC-388` czeka za flagą wyłączoną |

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
cd /private/tmp/cx-day350-g16-pakiet

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day350-pg psql -U postgres -d cx350 \
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
cd /private/tmp/cx-day350-g16-pakiet

docker run -d --name cx-day350-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx350 \
  -p 127.0.0.1:6397:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day350-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6397/cx350 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6397/cx350 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day350-g16-pakiet && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6397/cx350 \
JWT_SECRET=cx350-test-secret-do-not-reuse-min-32-znaki \
npx vitest run Ten dyżur **nie uruchamia pakietów testowych produktu** i nie potrzebuje bazy. Jedyne komendy, które wykonujesz, to odczyty `git` (`log`, `diff --name-only`, `show`), `grep` przez `bash -c '…'`, `ls` i cztery bezpieczniki kanonu plus `reachability --check-baseline` — wszystkie mają kończyć się kodem `0`, bo niczego w kodzie nie zmieniasz. **Jeżeli mimo to postawisz kontener, opisujesz po co**; jeżeli nie postawisz — piszesz to wprost, a `docker ps -a | grep -c cx-day350` ma dać `0` na koniec. Każde zdanie, które wstawiasz do pakietu, ma **odtwarzalne źródło w repo**: SHA commita, ścieżkę pliku z numerem wiersza albo numer decyzji `DEC-*` --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day350-g16-pakiet-artefakty/day350-g16-pakiet.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day350-g16-pakiet && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run Ten dyżur **nie uruchamia pakietów testowych produktu** i nie potrzebuje bazy. Jedyne komendy, które wykonujesz, to odczyty `git` (`log`, `diff --name-only`, `show`), `grep` przez `bash -c '…'`, `ls` i cztery bezpieczniki kanonu plus `reachability --check-baseline` — wszystkie mają kończyć się kodem `0`, bo niczego w kodzie nie zmieniasz. **Jeżeli mimo to postawisz kontener, opisujesz po co**; jeżeli nie postawisz — piszesz to wprost, a `docker ps -a | grep -c cx-day350` ma dać `0` na koniec. Każde zdanie, które wstawiasz do pakietu, ma **odtwarzalne źródło w repo**: SHA commita, ścieżkę pliku z numerem wiersza albo numer decyzji `DEC-*` --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day350-g16-pakiet-artefakty/day350-g16-pakiet.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day350-g16-pakiet/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day350-pg psql -U postgres -d cx350 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day350-pg`.
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
> **(e) ★★★ **SIEDEM PUŁAPEK.** (1) **Naprawa za flagą OFF wygląda dla właściciela jak brak funkcji.** Program ma to zmierzone trzy razy w jeden dzień: gdy właściciel pisze „dalej nie mam X”, w trzech przypadkach na trzy funkcja była gotowa i wyłączona. Każda naprawa scalona z flagą OFF **musi** trafić na listę „stan oczekiwany, nie zgłaszaj”, z numerem decyzji. (2) **`git log` mierzy scalenia, nie to, co widzi właściciel** — scalony kod za flagą OFF nie zmienia ekranu; scalony dokument nie zmienia nic. Rozróżniaj: „zmienione w repo” ≠ „widoczne na stagingu”. (3) **Staging nie jest `HEAD`.** Pakiet mówi `fb6547b7d0`, nadzorca mówi `1c4b5a5635`, `HEAD` jest jeszcze dalej; zdanie „naprawiliśmy to wczoraj” jest **fałszem dla właściciela**, jeżeli naprawa nie doszła do stagingu. **Nie sprawdzasz tego połączeniem (`Z28`) — zapisujesz jako pytanie.** (4) **Rekord pokazowy zamiast prawdziwego.** Pakiet ma złotą zasadę: właściciel otwiera rekord z prawdziwą nazwą, nie „Showcase”. Program ma zmierzony przypadek, w którym zaakceptowany widok dostawały wyłącznie identyfikatory pokazowe, a realny rekord otwierał coś innego — dlatego ta zasada zostaje w każdej sekcji, której dotyczy. (5) **Zwinięta sekcja nie jest dowodem** — jeżeli piszesz właścicielowi „sprawdź sekcję X”, napisz też, że ma ją **rozwinąć**; zrzut ze zwiniętym blokiem pokazał kiedyś naprawiony fragment i angielską sekcję obok. (6) **Klucz istnieje ≠ przetłumaczony** — jeżeli aktualizujesz zdania o języku PL/EN, sprawdzaj WARTOŚĆ klucza, nie jego istnienie. (7) **`grep --include` w `zsh` zwraca pustkę zamiast wyników** — uruchamiaj przez `bash -c '…'` i sprawdzaj kod wyjścia; pustka nie jest wynikiem, dopóki nie wiesz, że komenda się wykonała**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day350-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day350-g16-pakiet-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R0 (twarde zasady: zakaz `PASS` w `G16`, zakaz połączenia do stagingu, zakaz przepisania pakietu od zera) · R1 (inwentarz dryfu pakietu: 49 scaleń i 171 plików przypisane do 16 modułów — RDZEŃ) · R2 (przegląd sekcji „Co się zmieniło” i „Czego NIE zgłaszaj” moduł po module, z cytatem commita — RDZEŃ) · R3 (lista „stan oczekiwany, nie zgłaszaj” — naprawy za flagami OFF i decyzje z numerem — RDZEŃ) · R4 (lista „zobaczysz inaczej niż wczoraj” — naprawy scalone 04.09, które właściciel realnie zobaczy) · R5 (spójność całego pakietu: prawdziwe nazwy rekordów, jedna linia na uwagę, wersja stagingu jako pytanie) · R6 (raport + pytania do właściciela)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6397` albo `5537` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6397` albo `5537`** (`Z7`).

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

`G16` — **„Owner acceptance flight"** — jest **jedyną bramką macierzy, której nie zamknie
maszyna**. Wszystkie 16 wierszy stoją dziś na `TECHNICAL_PACKET_READY / OWNER_RETEST_PENDING`
i czekają wyłącznie na **oczy właściciela**.

Pakiet, po którym właściciel ma przelecieć, **istnieje**:
`docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md` — 381 wierszy, 16 sekcji modułowych,
wspólne zasady zgłaszania, lista znanych ograniczeń stagingu i tabela do wypełnienia.

**Problem: pakiet się zdezaktualizował.** Zmierzyłem to sam:

| Co | Liczba |
| --- | --- |
| ostatni commit pakietu | `3cb7390766`, **04.09 o 05:44** |
| scaleń od tamtej pory (`--merges --first-parent`) | **49** |
| zmienionych plików produktu (`src/` + `server/src/`) | **171** |

**Ciężar zmian nie rozkłada się równo — i to jest najważniejsza wskazówka tego dyżuru:**

| Obszar | Zmienionych plików |
| --- | --- |
| `src/components/AIChat` | **66** |
| `server/src/routes` | **51** |
| `server/src/services` | 10 |
| `src/components/MyWork` | 8 |
| `src/components/Interview` | 5 |
| `src/components/assessment` | 3 |
| `src/components/DiscoveryTools` | 3 |
| `src/components/Initiatives` | 2 |
| `src/components/DocumentStudio` | 2 |
| pojedyncze pliki | `ui`, `standard`, `shared`, `layout`, `ReportBuilder`, `Presentations`, `App.tsx`, `hooks/useReportSections.ts`, `services/api.ts`, `services/chatSuggestionsPreference.ts`, `store/useToolStore.ts`, `toolPacks/packs/dynamicSwot.pack.ts`, `utils/dynamicSwotSevenStagesFlag.ts` |

**To nie jest „kilkanaście scaleń".** Sekcja pakietu o Czacie opisuje moduł, w którym zmieniło
się 66 plików — i to jest pierwsze miejsce, które musisz sprawdzić.

## ★★ Czego ten dyżur NIE robi

- **Nie wpisuje ani jednego wiersza `G16` jako `PASS`.** Ten wiersz podnosi właściciel po
  przelocie. Dyżur, który sam go podniósł, sfałszował odbiór. **Nie dotykasz w ogóle żadnego
  `MODULE_ACCEPTANCE.md`.**
- **Nie łączy się ze stagingiem, demo ani produkcją — w żadną stronę** (`Z28`). Nie robisz
  `curl` po `/api/health`, nie logujesz się na konto odbiorowe właściciela, nie sprawdzasz
  ekranów własnymi oczami przez przeglądarkę.
- **Nie zmienia ani jednego pliku w `src/` i `server/src/`.** Znaleziony defekt idzie do
  raportu jako rekomendacja z `plik:linia` i **diffem nienałożonym**.
- **Nie włącza żadnej flagi** — także tej, którą opisujesz jako stan oczekiwany.
- **Nie przepisuje pakietu od zera.** Właściciel czytał już poprzednią wersję; zmiany są
  punktowe, a każda poprawiona sekcja **cytuje commit, który ją zdezaktualizował**.

## ★★ Rozbieżność, której NIE rozstrzygasz sam

Pakiet podaje własną wersję stagingu: **`fb6547b7d0`**, potwierdzoną `/api/health` 04.09
o 05:33. Nadzorca, wydając ten dyżur, podaje **`1c4b5a5635`**.

Moje pomiary dystansu od `HEAD`:

| Znacznik | Dystans do `HEAD` |
| --- | --- |
| `fb6547b7d0` (wersja z pakietu) | **325 commitów** |
| `1c4b5a5635` (wersja od nadzorcy) | **72 commity** |

**`Z28` zakazuje Ci połączenia ze stagingiem bezwzględnie — to jedyny zakaz, którego naruszenie
zatrzymuje CAŁY dyżur.** Więc **nie rozstrzygasz tego pomiarem**. Zamiast tego:

1. wpisujesz do pakietu wartość podaną przez nadzorcę, **oznaczoną jawnie** jako podaną
   z zewnątrz i niezweryfikowaną przez dyżur (`Z28`);
2. odnotowujesz w pakiecie i w raporcie, że **poprzednie brzmienie mówiło `fb6547b7d0`**;
3. stawiasz **pytanie rozstrzygalne** w `R6`: *„Który znacznik naprawdę stoi dziś na stagingu
   i czy ma zostać zredeployowany przed przelotem?"*

★ **To jest ważne merytorycznie, nie formalnie.** Jeżeli staging stoi 325 commitów za `HEAD`,
to każde zdanie w pakiecie o naprawie z 04.09 jest **fałszem dla właściciela** — funkcja jest
w repo, ale nie na ekranie, który on ogląda. Każda taka pozycja musi być w pakiecie oznaczona
warunkowo („jeżeli staging został zredeployowany po `<SHA>`").

## ★ Zmierz moje liczby sam

Twierdzę, na markerze `6a4919f72db338e7f49a2cacb3787d20cc649883`:

- pakiet ma **381 wierszy** i **16 sekcji modułowych**, plus sześć sekcji wspólnych;
- ostatni commit pakietu to `3cb7390766` z 04.09 o 05:44; po nim **49 scaleń** i **171
  zmienionych plików produktu**;
- rozkład zmian: **AIChat 66**, `server/src/routes` **51**, `server/src/services` 10,
  `MyWork` 8, `Interview` 5, `assessment` 3, `DiscoveryTools` 3, `Initiatives` 2,
  `DocumentStudio` 2;
- **16 z 16** wierszy `G16` = `TECHNICAL_PACKET_READY / OWNER_RETEST_PENDING`;
- `fb6547b7d0` = **325** commitów za `HEAD`; `1c4b5a5635` = **72**;
- pakiet **nie jest generowany** przez żaden skrypt (`grep -rl 'PRZELOT_WLASCICIELA' scripts/`
  nie znajduje nic) — edycja ręczna jest bezpieczna;
- flaga `VITE_VF1_INITIATIVE_SECTIONS_COMPLETE` (`DEC-388`) jest **domyślnie OFF**;
- liście słowników: **pl 35198**, **en 33065**; cztery bezpieczniki (`focus-canon`,
  `list-canon`, `artefakt`, `reachability --check-baseline`) kończą się kodem **0**.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.**

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: WALIDATOR · TRASA · KONTROLER · SERWIS · REPOZYTORIUM · TESTY · MACIERZ ODBIORU

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU**. Ten dyżur jest dokumentacyjny —
produktem „tylko odczytu" jest **wpis do raportu z rekomendacją jako diff nienałożony**,
nie czerwony kontrakt testowy.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Walidator / schematy** | `server/src/schemas/**`, `server/src/validators/**` | **TYLKO ODCZYT** | Cytat wiersza + wpis do raportu |
| **Trasa (montaż)** | `server/src/services/ApiGateway.ts`, `server/src/routes/v8/index.ts` | **TYLKO ODCZYT — NIE WOŁASZ I NIE ZMIENIASZ.** Ten dyżur nie uruchamia serwera | Opis w raporcie |
| **Kontroler / trasy** | `server/src/routes/**`, `server/src/controllers/**` | **TYLKO ODCZYT** — 51 plików zmienionych od pakietu; czytasz je, żeby sprawdzić prawdziwość zdań | Wpis: plik, linia, problem, rekomendacja jako diff **nienałożony** |
| **Serwis / repozytorium** | `server/src/services/**`, `server/src/domain/**`, `server/src/repositories/**` | **TYLKO ODCZYT** | jak wyżej |
| **Middleware / model uprawnień** | `server/src/middleware/**` | **NIETYKALNE DO ZAPISU** (`Z12`) | Brief |
| **Produkt UI — wszystkie moduły** | `src/**` bez wyjątku | **TYLKO ODCZYT — BEZWZGLĘDNIE.** Ten dyżur nie pisze kodu | Wpis do raportu z `plik:linia` |
| **Flagi funkcyjne** | `src/utils/dynamicSwotSevenStagesFlag.ts`, `src/components/Initiatives/sections/initiativeCardContract.ts`, `.env*`, `docker-compose*`, `railway*` | **TYLKO ODCZYT.** ★ Wolno **OPISAĆ** flagę w pakiecie; **włączenie którejkolwiek jest odrzuceniem dyżuru** (`Z10`, `Z11`) | Nazwa flagi + wartość domyślna do pakietu |
| **Testy** | wszystko pod `tests/`, `__tests__/` | **TYLKO ODCZYT** — ten dyżur niczego nie uruchamia poza bezpiecznikami kanonu | — |
| **Bezpieczniki i konfiguracja testów** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie |
| **★ PAKIET PRZELOTU** | `docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md` | **★ PEŁNA LICENCJA NA AKTUALIZACJĘ — to jest główny produkt dyżuru.** Poprawiasz istniejące sekcje i dopisujesz nowe; **zakaz przepisania całości od zera**; każda poprawiona sekcja cytuje commit, który ją zdezaktualizował | — |
| **Źródła treści** | `REJESTR_ZNALEZISK_20260903.md` (sekcje `M`, `N`), `OWNER_DECISION_LEDGER_2026-08-24.md`, `FALA_2_PO_STAGINGU.md`, `DECYZJE_WLASCICIELA_DO_PODJECIA_20260904.md`, `AUDYT_PRZEWODOW_ODBIORU_20260903.md`, `ODBIOR_DYZUROW_*_20260904.md`, wiersze `G14` i `G16` szesnastu `MODULE_ACCEPTANCE.md` | **TYLKO ODCZYT** — `Z14` zakazuje zmieniania rejestru decyzji właściciela | Errata w raporcie, jeżeli uważasz, że decyzja się myli |
| **Macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` | **NIETYKALNA — ZAKAZ ZAPISU DO KTÓREGOKOLWIEK PLIKU.** W szczególności **ZAKAZ `PASS` w wierszu `G16`**; `G15` należy do dyżuru 347, `G19` do 348 | — |
| **Dowody** | `evidence/g16/day350/**` (**katalog NIE ISTNIEJE na markerze — tworzysz go**) | **★ PEŁNA LICENCJA na tworzenie i dopisywanie** — tu leży inwentarz dryfu z `R1` | — |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jedna nowa sekcja o **pierwszej wolnej literze**, sprawdzonej komendą tuż przed commitem | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY350_G16_PAKIET_REPORT.md` (**NOWY**) | `R6` — **JEDYNY nowy dokument rejestrowy, jaki wolno Ci utworzyć** (`Z13`) | — |
| **Cudze tereny** | `evidence/g15/**`, `resultsInternalBetaVisibility.middleware.ts` (dyżur 347) · `evidence/g19/**`, `G19_INWENTARZ_OBOWIAZKOW_20260903.md` (dyżur 348) · trzy pliki czterech czerwieni powłoki i sześć plików Bloku 3 (dyżur 349) · wszystko wokół `DEC-388`, kafli SWOT, panelu Idei i kompletności raportu **po stronie KODU** (dyżury 343-346) | **TYLKO ODCZYT** | Wpis do raportu |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem `plik:linia` i idziesz dalej |

★★ **Rozstrzygnięcie kolizji z dyżurami 343-346.** Równolegle biegnie paczka dyżurów wokół
`DEC-388`, kafli SWOT, panelu Idei i kompletności raportu. Oni pracują na **KODZIE**, Ty na
**DOKUMENCIE**. Pakiet przelotu jest **wyłącznie Twój**; kod tych tematów jest wyłącznie ich.
Jeżeli w trakcie pracy stwierdzisz, że któraś z tych rzeczy zmieni to, co właściciel zobaczy —
**opisujesz to w pakiecie jako stan bieżący z numerem decyzji i zaznaczasz, że praca trwa**,
i nie zaglądasz do ich gałęzi.

## ★★ WARUNKI WSPÓLNE SERII

Mierzysz **PRZED pierwszym commitem i PO ostatnim**, obie pary liczb do raportu:

```bash
cd "$WT"
# (a) liscie slownikow NIE MOGA ZMALEC
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
#   moje liczby: pl 35198, en 33065

# (b) cztery bezpieczniki maja konczyc sie kodem 0
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus-canon=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list-canon=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
#   moje liczby: wszystkie 0
```

★ W tym dyżurze wszystkie te liczby mają **pozostać identyczne** przed i po — nie zmieniasz
ani kodu, ani słowników. **Jakakolwiek zmiana którejkolwiek z nich oznacza, że wyszedłeś
poza zakres** i cofasz zmianę.

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | wiersze pakietu i sekcje modułowe | `381` / `16` | komenda (1) z `§0.3` | TAK |
| 2 | ostatni commit pakietu | `3cb7390766`, 04.09 05:44 | komenda (2) z `§0.3` | TAK — `git log -1 --` po ścieżce pliku |
| 3 | scalenia od pakietu | `49` | komenda (2) z `§0.3` | TAK — `--merges --first-parent`, czyli linia główna |
| 4 | zmienione pliki produktu | `171` | komenda (2) z `§0.3` | TAK — ograniczone do `src` i `server/src` |
| 5 | rozkład zmian per obszar | AIChat `66`, routes `51`, … | komenda (3) z `§0.3` | TAK — **suma ma się zgodzić ze 171, sprawdź to jawnie** |
| 6 | stan 16 wierszy `G16` | `16 × TECHNICAL_PACKET_READY / OWNER_RETEST_PENDING` | komenda (4) z `§0.3` | TAK |
| 7 | dystans dwóch znaczników stagingu | `325` / `72` | komenda (5) z `§0.3` | TAK — **i to jest JEDYNY dozwolony sposób; `curl` do stagingu jest zakazany** |
| 8 | czy naprawa kart inicjatyw jest za flagą OFF | TAK, `VITE_VF1_INITIATIVE_SECTIONS_COMPLETE` | komenda (6) z `§0.3` | TAK — czyta wartość domyślną, nie samo istnienie flagi |
| 9 | czy pakiet jest generowany | **nie** | komenda (7) z `§0.3` | TAK — `grep -rl` w `scripts/`, przez `bash -c` |
| 10 | ile sekcji modułowych wymagało poprawki | — | `R2`, licznik własny | TAK — **liczba ma się zgadzać z liczbą cytowanych commitów** |
| 11 | ile pozycji trafiło na listę „stan oczekiwany" | — | `R3`, licznik własny | TAK — **każda z numerem decyzji `DEC-*`** |
| 12 | liście słowników i bezpieczniki | `35198` / `33065`, cztery `0` | blok „WARUNKÓW WSPÓLNYCH" | TAK — mają być identyczne przed i po |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md` (**główny produkt**) ·
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY350_G16_PAKIET_REPORT.md` ·
`evidence/g16/day350/**` (nowy katalog).

**Zapisujesz WARUNKOWO:**
`docs/program/REJESTR_ZNALEZISK_20260903.md` (jedna nowa sekcja o pierwszej wolnej literze).

**JAWNIE NIE ZAPISZESZ:** `src/**`, `server/src/**`, `public/locales/**`, `tests/**`,
`scripts/**`, `.env*`, `docker-compose*`, `railway*`, `.github/workflows/**`,
`server/migrations/**`, **żadnego `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md`**,
`OWNER_DECISION_LEDGER_2026-08-24.md`, `FALA_2_PO_STAGINGU.md`, `evidence/g15/**`,
`evidence/g19/**`.

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day350-g16-pakiet
git diff --name-only --cached | tee /private/tmp/cx-day350-g16-pakiet-artefakty/staged.txt
bash -c "grep -iE '^src/|^server/|^public/|^tests/|^scripts/|^\.env|docker-compose|railway|^\.github/|MODULE_ACCEPTANCE|OWNER_DECISION_LEDGER|FALA_2_PO_STAGINGU|^evidence/g15/|^evidence/g19/' /private/tmp/cx-day350-g16-pakiet-artefakty/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"

# ★★ druga kontrola, wlasciwa TEMU dyzurowi: ani jednego PASS wstawionego do bramki
git diff --cached -U0 | bash -c "grep -nE '^\+.*G16.*PASS'" \
  && echo "★★★ WPIS PASS DO G16 — TO JEST ZAKAZ NADRZEDNY TEGO DYZURU, COFNIJ" \
  || echo "brak wpisow do G16 OK"
```

---

## R0 — TRZY TWARDE ZASADY TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

**(1) `G16` podnosi właściciel, nie dyżur.** Nie wpisujesz `PASS` do wiersza `G16` w żadnym
module i **nie dotykasz w ogóle żadnego `MODULE_ACCEPTANCE.md`**. Druga kontrola przed
commitem (blok wyżej) sprawdza to mechanicznie.

**(2) Zero połączeń ze stagingiem, demo i produkcją** (`Z28`) — to jedyny zakaz, którego
naruszenie zatrzymuje CAŁY dyżur. Wszystko, co wiesz o stagingu, pochodzi z repo albo od
nadzorcy, i tak jest oznaczone w pakiecie.

**(3) Każde zdanie, które wstawiasz do pakietu, ma odtwarzalne źródło w repo** — SHA commita,
ścieżka pliku z numerem wiersza albo numer decyzji `DEC-*`. **Pakiet czyta właściciel; jedno
nieprawdziwe zdanie kosztuje jego czas i zaufanie.** Zdanie, którego nie masz z czego
potwierdzić, **nie wchodzi do pakietu** — wchodzi do raportu jako pytanie.

**Wymagany dowód:** trzy zdania w raporcie, że przeczytałeś te zasady, plus wynik obu kontroli
przed każdym commitem. **Bez commita — to jest warunek, nie pozycja.**

## R1 — INWENTARZ DRYFU PAKIETU, PRZYPISANY DO 16 MODUŁÓW (rdzeń)

1. Uruchom komendy (2) i (3) z `§0.3`. Do raportu i do
   `evidence/g16/day350/dryf-pakietu.md` idą: SHA i data commita pakietu, liczba scaleń,
   liczba plików produktu, rozkład per obszar.
2. **Wypisz 49 scaleń z nazwy** — `git log --oneline --merges --first-parent <SHA>..HEAD` —
   i **przypisz każde do modułu albo do „przekrojowe"**. Komunikaty scaleń niosą numer dyżuru
   i werdykt odbioru; to wystarczy do przypisania większości.
3. **Przypisz 171 zmienionych plików do 16 modułów pakietu.** Mapowanie katalogów na moduły
   pakietu (Chat, My Work, Interview, Tools, Assessment, Initiatives, Execution, Results,
   Finance, Materials, Audits, Meeting, Organization, Admin Panel, Settings, Partner Portal)
   wyprowadzasz z `docs/FUNCTIONAL_DOCUMENTATION.md` albo z nazw katalogów, i **zapisujesz
   swoje mapowanie jawnie** — żeby dało się je sprawdzić.
4. **Wynikiem jest tabela 16 wierszy:** moduł · ile scaleń go dotknęło · ile plików · **czy
   sekcja pakietu wymaga sprawdzenia (TAK/NIE)**. Moduł z zerem zmian dostaje `NIE` i to jest
   uczciwy wynik.

★ **Zero zmian w module nie znaczy, że jego sekcja jest aktualna** — mogła być nieaktualna już
w chwili pisania. Sekcje z `NIE` i tak przeglądasz w `R2`, tylko szybciej.

**Wymagany dowód:** `dryf-pakietu.md` z imienną listą 49 scaleń i mapowaniem plików ·
tabela 16 wierszy · jawne mapowanie katalog→moduł. **Commit po `R1`.**

## R2 — PRZEGLĄD SEKCJI MODUŁ PO MODULE, Z CYTATEM COMMITA (rdzeń)

**Dla KAŻDEGO z 16 modułów** otwierasz jego sekcję w pakiecie i sprawdzasz **trzy rzeczy**:

1. **„Kroki"** — czy ścieżka, którą każesz właścicielowi przejść, nadal istnieje (menu, przycisk,
   nazwa ekranu). Sprawdzasz w kodzie, nie zgadujesz.
2. **„Co się zmieniło"** — czy opisana zmiana jest nadal prawdziwa, i czy **nie doszły nowe**,
   których właściciel jeszcze nie widział.
3. **„Czego NIE zgłaszaj"** — czy pozycja nadal jest odłożona, czy może **została w międzyczasie
   zrobiona** (wtedy znika z tej listy i przechodzi do „Co się zmieniło"), oraz czy nie brakuje
   nowej pozycji.

**Każda poprawiona sekcja MUSI cytować commit, który ją zdezaktualizował** — w formie
`(zdezaktualizowane przez <SHA> — <krótki opis>)`. Poprawka bez cytatu jest podstawą odrzucenia
pozycji.

★★ **Zacznij od Czatu (sekcja 1).** 66 zmienionych plików to jedna trzecia całego dryfu
i największe ryzyko, że pakiet mówi o ekranie, którego już nie ma — w tym oknie scalono między
innymi usunięcie martwego poddrzewa czatu.

★ **Nie ruszaj tego, co jest nadal prawdziwe.** Sekcja bez zmian to **poprawny wynik**;
zapisujesz „sprawdzona, bez zmian" i idziesz dalej. Przepisywanie sprawnych zdań to szum,
który właściciel będzie musiał przeczytać drugi raz.

★ **Złota zasada pakietu zostaje w każdej sekcji, której dotyczy:** właściciel otwiera rekord
z **prawdziwą nazwą** (klient, projekt, inicjatywa), **nie** „Showcase"/„Przykład"/„Demo".
Program ma zmierzony przypadek, w którym zaakceptowany widok dostawały wyłącznie identyfikatory
pokazowe, a realny rekord otwierał coś zupełnie innego.

**Wymagany dowód:** dla każdego z 16 modułów jedna z dwóch odpowiedzi — „sprawdzona, bez zmian"
albo lista poprawek z cytatem SHA przy każdej. **Commit po `R2`** (wolno commitować partiami
po kilka modułów, byle każdy commit był kompletny dla swoich modułów).

## R3 — LISTA „STAN OCZEKIWANY, NIE ZGŁASZAJ" (rdzeń)

**To jest pozycja, która najbardziej oszczędza czas właściciela** — i której brak jest
najdroższym błędem tego dyżuru.

Program ma zmierzone trzy przypadki jednego dnia, w których właściciel napisał „dalej nie mam
X", a funkcja była **gotowa i wyłączona za flagą**. Dlatego:

1. **Wypisz KAŻDĄ naprawę scaloną w tym oknie, która jest za flagą `default OFF`** — bo
   właściciel **jej nie zobaczy**, i musi wiedzieć, że to nie jest defekt. Flagi do sprawdzenia
   (wszystkie domyślnie OFF): `VITE_VF1_INITIATIVE_SECTIONS_COMPLETE` (`DEC-388`),
   `VITE_VF1_INITIATIVE_CARD_CONTRACT` (`DEC-387`), `VITE_VF1_DYNAMIC_SWOT_SEVEN_STAGES`,
   `VITE_VF1_DECISION_CARD_CONTRACT`, `VITE_VF1_DECISION_SPECA`. **Sprawdź, czy nie ma
   kolejnych** — komendą, nie z pamięci.
2. **Pozycja wzorcowa, którą MASZ dopisać** (jeżeli jej jeszcze nie ma): *karty inicjatyw
   nadal pokazują 6 sekcji z 24 — naprawa `DEC-388` jest scalona, ale flaga
   `VITE_VF1_INITIATIVE_SECTIONS_COMPLETE` jest wyłączona; to NIE jest defekt do zgłoszenia,
   to stan oczekiwany do akceptu.* **Sprawdź liczbę „6 z 24" sam** — sekcja `N1` rejestru
   znalezisk podaje ją jako zmierzoną, ale program ma zapisany przypadek, w którym podobna
   liczba („11 z 15") okazała się **pojemnością kadru zrzutu**, a nie liczbą sekcji.
3. **Wypisz każdą pozycję odłożoną do fali 2** z numerem decyzji — źródło
   `docs/program/FALA_2_PO_STAGINGU.md` i `OWNER_DECISION_LEDGER_2026-08-24.md`.
4. **Wypisz decyzje właściciela z 04.09**, które zmieniają to, co ma i czego nie ma zgłaszać —
   `DEC-386`…`DEC-391`, opisane w sekcjach `M` i `N` rejestru znalezisk.
5. **Każda pozycja tej listy MA numer decyzji albo SHA commita.** Pozycja bez numeru to zdanie
   bez pokrycia i nie wchodzi do pakietu.

**Wymagany dowód:** kompletna lista „stan oczekiwany, nie zgłaszaj", każda pozycja z numerem
decyzji albo SHA · własny pomiar liczby sekcji karty inicjatywy · lista flag `default OFF`
zmierzona komendą. **Commit po `R3`.**

## R4 — LISTA „ZOBACZYSZ INACZEJ NIŻ WCZORAJ"

Lustrzane odbicie `R3`: **co właściciel realnie zobaczy inaczej** po naprawach scalonych 04.09.

1. Dla każdej naprawy z tego okna rozstrzygnij: **czy jest za flagą (→ `R3`), czy działa
   domyślnie (→ tutaj)**. Rozstrzygasz komendą, nie z komunikatu scalenia.
2. Dla każdej pozycji „zobaczysz inaczej" podaj: **moduł · ekran · co było · co jest ·
   SHA naprawy**.
3. ★★ **Oznacz każdą pozycję warunkiem stagingu.** Jeżeli staging stoi za `HEAD` (a według
   pakietu jest 325 commitów za), to naprawa scalona wczoraj **nie jest na ekranie właściciela**.
   Zapis obowiązkowy: „widoczne, **jeżeli** staging został zredeployowany po `<SHA>`".
   **Bez tego zastrzeżenia pakiet obiecuje właścicielowi rzeczy, których nie zobaczy.**

**Wymagany dowód:** tabela „zobaczysz inaczej" z pięcioma kolumnami · przy każdej pozycji
warunek stagingu · rozstrzygnięcie flaga/domyślnie zrobione komendą. **Commit po `R4`.**

## R5 — SPÓJNOŚĆ CAŁEGO PAKIETU

1. **Zasady wspólne** — sprawdź, czy sekcje „Zanim zaczniesz", „Jak zgłaszać uwagę", „Czego
   NIE zgłaszaj nigdy" i „Znane ograniczenia stagingu" są nadal prawdziwe. W szczególności:
   punkt o flagach Wyników/Finansów/Organizacji/kreatora wywiadu włączonych 03.09 wieczorem —
   **czy to nadal aktualne dzień później?**
2. **Wersja stagingu** — wpisz wartość podaną przez nadzorcę, **oznaczoną jako niezweryfikowana
   przez dyżur** (`Z28`), i odnotuj poprzednie brzmienie `fb6547b7d0`.
3. **Format zgłaszania zostaje**: jedna linia na uwagę plus zrzut, w formacie
   `moduł · ekran · co widzę · co oczekiwałem · zrzut`. **Nie zmieniasz tego formatu** —
   właściciel go już zna.
4. **Właściciel nie musi robić wszystkiego naraz** — sprawdź, czy pakiet to mówi wprost,
   i jeżeli nie, dopisz jedno zdanie. Tabela do wypełnienia ma kolumnę `Data`, więc przelot
   rozłożony na raty jest przewidziany.
5. **Tam, gdzie każesz sprawdzić sekcję na ekranie, napisz, że ma ją ROZWINĄĆ.** Program ma
   zmierzony przypadek, w którym zrzut ze zwiniętą sekcją pokazał naprawiony fragment
   i niepoprawiony obok.
6. **Zdania o języku PL/EN** — jeżeli któreś aktualizujesz, sprawdzaj **wartość** klucza
   w `public/locales/*/translation.json`, nie samo jego istnienie. Klucz może istnieć w `pl`
   i trzymać angielskie słowo.

**Wymagany dowód:** sześć odpowiedzi, po jednej na punkt, każda z cytatem źródła.
**Commit po `R5`.**

## R6 — RAPORT I PYTANIA DO WŁAŚCICIELA

Raport zawiera: inwentarz dryfu z `R1` · listę 16 modułów z werdyktem „bez zmian" / „poprawione,
oto co i na podstawie jakiego commita" z `R2` · kompletną listę „stan oczekiwany, nie zgłaszaj"
z `R3` · tabelę „zobaczysz inaczej" z `R4` · sześć odpowiedzi o spójności z `R5` · listę
rozbieżności wobec liczb tej instrukcji · **niepustą sekcję „TWIERDZENIA NIEZWERYFIKOWANE"** ·
jawne zdanie, czy postawiłeś kontener (jeżeli nie — to jest poprawny wynik).

★★ **Osobna, obowiązkowa sekcja: „PYTANIA DO WŁAŚCICIELA I NADZORCY".** Minimum dwa pytania
rozstrzygalne:

- *„Który znacznik naprawdę stoi dziś na stagingu — `fb6547b7d0` z pakietu czy `1c4b5a5635`
  od nadzorcy — i czy staging ma być zredeployowany PRZED przelotem?"* Bez odpowiedzi część
  pakietu obiecuje właścicielowi rzeczy, których nie zobaczy.
- *„Czy naprawy za flagami `default OFF` (`DEC-387`, `DEC-388` i pozostałe) mają zostać
  włączone przed przelotem, czy właściciel ma je zobaczyć dopiero po akcepcie na zrzutach?"*
  ★ **Sam ich nie włączasz — to decyzja właściciela** (`Z11`).

★★ **Osobna sekcja: „CZEGO PAKIET NADAL NIE OBEJMUJE".** Jeżeli któryś moduł ma naprawy
scalone, ale nie da się ich zweryfikować bez stagingu na właściwym SHA — piszesz to wprost.
Uczciwe „nie wiem, bo nie mogłem sprawdzić" jest lepsze niż zdanie, które właściciel odkryje
jako nieprawdziwe.

★ Zanim dopiszesz cokolwiek do jakiegokolwiek dokumentu, sprawdź, czy nie jest GENEROWANY:
`bash -c "grep -rl '<nazwa-pliku>' scripts/"`. Sekcję w `REJESTR_ZNALEZISK_20260903.md`
dopisujesz o **pierwszej wolnej literze** — sprawdź ją komendą
`bash -c "grep -nE '^## [A-Z]\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"`
**tuż przed commitem**, bo równolegle pisze inny autor.

**Commit po `R6`.**

## Próg odbioru

**Pakiet przejrzany moduł po module — każdy z 16 ma werdykt „sprawdzona, bez zmian" albo listę
poprawek, w której KAŻDA cytuje commit, który sekcję zdezaktualizował; lista „stan oczekiwany,
nie zgłaszaj" jest kompletna i każda jej pozycja ma numer decyzji albo SHA; a żaden wiersz
`G16` nie zmienił stanu.**

Odbiorca odrzuci dyżur, w którym pojawi się `PASS` w `G16` albo jakakolwiek zmiana
`MODULE_ACCEPTANCE.md`; w którym pakiet przepisano od zera; w którym poprawka nie cytuje
commita; w którym wstawiono zdanie bez pokrycia w repo; albo w którym włączono jakąkolwiek
flagę.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „dryf przypisany do 16 modułów,
sekcje 1-8 przejrzane i poprawione z cytatami, lista stanu oczekiwanego kompletna, sekcje 9-16
nieprzejrzane" — **jest pełnowartościowym wynikiem**; właściciel może wtedy zacząć przelot od
modułów, które są gotowe, bo pakiet sam mówi, że nie musi robić wszystkiego naraz.

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: **sprawdzasz
warunek NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na zapamiętanym wyniku.**
Wynik ponownego sprawdzenia wklejasz do raportu z datą i godziną. ★ Dla tego dyżuru ma to
szczególne znaczenie: liczba scaleń i zmienionych plików rośnie z każdą godziną, więc
**inwentarz z `R1` przeliczasz od nowa**, jeżeli wracasz następnego dnia.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Zaktualizuj pakiet o stan stagingu" vs `Z28` (zero połączeń) | `R0` (2) i `R5` punkt 2: wartość pochodzi od nadzorcy i jest **oznaczona jako niezweryfikowana**; rozbieżność idzie do `R6` jako pytanie, nie do pomiaru |
| „Bramka `G16` czeka na odbiór" vs „nie dotykasz macierzy" | `R0` (1) i tabela licencji: `G16` podnosi **właściciel**; dyżur dostarcza pakiet, nie werdykt |
| „Opisz flagi w pakiecie" vs `Z10`/`Z11` (zakaz zmiany flag) | `POZYCJE_Z_FLAGAMI` i `R3`: **opisanie nie jest włączeniem**; włączenie którejkolwiek jest odrzuceniem dyżuru, a decyzja o włączeniu należy do właściciela (`R6`) |
| „Popraw nieaktualne sekcje" vs „zakaz przepisania od zera" | `R2`: sekcja bez zmian dostaje werdykt „sprawdzona, bez zmian"; poprawki są punktowe i cytują SHA |
| „Wypisz, co właściciel zobaczy inaczej" vs „staging jest za `HEAD`" | `R4` punkt 3: każda pozycja dostaje warunek „widoczne, jeżeli staging zredeployowany po `<SHA>`" |
| „Sprawdź, czy ścieżka z Kroków istnieje" vs „nie uruchamiasz produktu" | `R2` punkt 1: sprawdzasz **w kodzie** (`grep` po etykiecie, komponencie, trasie), nie przez uruchomienie; jeżeli nie da się rozstrzygnąć statycznie — to jest pozycja do `R6` „czego pakiet nie obejmuje" |
| „Karty inicjatyw pokazują 6 z 24" vs „nie ufaj cudzym liczbom" | `R3` punkt 2: liczbę **mierzysz sam**; program ma zapisany przypadek, w którym analogiczna liczba okazała się pojemnością kadru zrzutu, nie liczbą sekcji |
| „Temat `DEC-388` jest terenem dyżurów 343-346" vs „opisujesz go w pakiecie" | Akapit pod tabelą licencji: oni pracują na KODZIE, Ty na DOKUMENCIE; nie zaglądasz do ich gałęzi i opisujesz stan bieżący z numerem decyzji |
| „Zero nowych dokumentów" (`Z13`) vs „pliki dowodowe i sekcja rejestru" | Tabela licencji: rejestr znalezisk to **AKTUALIZACJA istniejącego**, `evidence/g16/day350/` to **ślad**; nowy dokument rejestrowy jest dokładnie jeden — raport `R6` |
| „Kontener przydzielony" vs „dyżur go nie potrzebuje" | `SCIEZKI` i `LISTA_PORTOW_ZAJETYCH`: zasoby są rezerwą; niepostawienie kontenera jest wynikiem poprawnym **pod warunkiem napisania tego wprost** |
| „Rejestr decyzji jest źródłem" vs `Z14` (zakaz zmiany rejestru decyzji) | Tabela licencji: `OWNER_DECISION_LEDGER_2026-08-24.md` jest **TYLKO DO ODCZYTU**; uważasz, że decyzja się myli → **errata w raporcie**, nigdy zmiana w rejestrze |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 11 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — pakiet, rejestr znalezisk, rejestr decyzji, `FALA_2_PO_STAGINGU.md`, `DECYZJE_WLASCICIELA_DO_PODJECIA_20260904.md`, `AUDYT_PRZEWODOW_ODBIORU_20260903.md`, `dynamicSwotSevenStagesFlag.ts`, `initiativeCardContract.ts` sprawdzone; `evidence/g16/day350/` **jawnie oznaczony jako nieistniejący** |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 12 wierszy; wiersze 1-9 i 12 zmierzone przy wydaniu na markerze |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — walidator · montaż · kontroler · serwis/repozytorium · middleware · UI · flagi · testy · infrastruktura testów · pakiet · źródła treści · macierz · dowody · rejestr · raport · cudze tereny |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — cały dyżur jest dokumentacyjny; ani jedna pozycja nie wymaga zmiany kodu ani uruchomienia produktu |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — 6397/5537 wolne (`lsof` przy wydaniu), brak kontenera `cx-day350-pg`, brak gałęzi `codex/day350-*` i worktree; 347/348/349 mają rozłączne porty i pliki; paczka 343-346 ma zarezerwowany przedział 6390-6393/5530-5533, a kolizja tematyczna `DEC-388` rozstrzygnięta imiennie: oni KOD, ten dyżur DOKUMENT |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z markera |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — `§0.2d` w komplecie; pułapki właściwe: naprawa za flagą OFF wygląda jak brak funkcji, `git log` ≠ to, co widzi właściciel, staging nie jest `HEAD`, rekord pokazowy zamiast prawdziwego, zwinięta sekcja nie jest dowodem, klucz istnieje ≠ przetłumaczony, `grep --include` w `zsh` |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę; jedyna informacja z zewnątrz (znacznik stagingu od nadzorcy) jest jawnie oznaczona jako taka |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany", zero pól szablonu | TAK — kontrola generatora przy wydaniu |
