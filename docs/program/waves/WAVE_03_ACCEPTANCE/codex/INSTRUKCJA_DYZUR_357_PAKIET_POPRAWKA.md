# INSTRUKCJA DYŻURU nr 357 — Codex — „★★★ PAKIET PRZELOTU WŁAŚCICIELA — DWIE POPRAWKI PRZED WYSŁANIEM, ANI JEDNEGO WIERSZA `G16` WIĘCEJ. Dyżur 350 odświeżył `docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md` i zrobił to dobrze: **żaden wiersz `G16` nie zmienił stanu** (sprawdziłem wszystkie 16 — wszystkie `TECHNICAL_PACKET_READY / OWNER_RETEST_PENDING`), rozbieżność SHA zapisana wzorowo (obie wartości, jawnie „nie zweryfikowano", pytanie do nadzorcy — zero zgadywania), lista „stan oczekiwany, nie zgłaszaj" zawiera karty inicjatyw 6 z 24 z numerami decyzji. ★★ ALE SĄ DWA BŁĘDY, które właściciel zobaczy jako zepsuty produkt. **(1)** Wiersz „Zobaczysz inaczej" o Ideach/Notatniku (wiersz **390**, powtórzony w akapicie **91-92**) mówi „widoczne, jeżeli staging zredeployowany po `660482d485`" — a panel siedzi za flagą `ff_idea_notebook_right_panel_prototype`, której **domyślna wartość to `false`** (`src/utils/ideaNotebookRightPanelPrototypeFlag.ts:27`). Po dowolnym redeployu właściciel zobaczy STARY panel i zgłosi to jako brak funkcji. Wiersze Tools i Initiatives mają dopisek „domyślnie OFF", ten go nie ma. **(2)** `1c4b5a5635` występuje **dwa razy w dwóch różnych znaczeniach**: w wierszu **16** jako SHA stagingu podany przez nadzorcę, a w wierszach **65** i **389** jako SHA odblokowujący usunięcie martwego poddrzewa Czatu. ★ Zasada nienaruszalna: **żaden wiersz `G16` nie może zmienić stanu** — to robi właściciel po przelocie, nie ten dyżur"

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
> **wyłącznie** `/private/tmp/cx-day357-pakiet-poprawka`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `29fcbd4de20ca26d2febc50d9455128cab47ffce`**
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
Zakres: **DOKUMENTACYJNE — **jeden plik**: `docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md`. Ten dyżur **nie zmienia ani jednej linii kodu produktu, ani jednego testu, ani jednego wiersza macierzy odbioru**. Zadaniem są dwie imienne poprawki treści z cytatem źródła oraz przegląd, czy od commita `2d74ea1d75` (odświeżenie dyżuru 350) nie doszło nic, co znów dezaktualizuje pakiet. Prawo zatrzymania PO KAŻDEJ pozycji `R`, z commitem, i plikiem postępu `/private/tmp/cx-day357-postep.md` (poza repo)**.
Trasy front: `Ten dyżur **czyta** front i **niczego w nim nie zmienia**. Źródło prawdy dla poprawki (1): `src/utils/ideaNotebookRightPanelPrototypeFlag.ts` — wiersz **1** (`QUERY_KEY = 'ff_idea_notebook_right_panel_prototype'`), wiersz **27** (`return parseFlag(import.meta.env.VITE_IDEA_NOTEBOOK_RIGHT_PANEL_PROTOTYPE) ?? false;` — **domyślna `false`**), oraz `src/components/MyWork/prototypes/IdeaNotebookRightPanelPrototype.tsx:97` (`if (!isIdeaNotebookRightPanelPrototypeEnabled()) return <>{legacy}</>;` — bramka przy `OFF` zwraca STARY panel). Żywi konsumenci bramki: `src/components/MyWork/notebook/NotebookRightRail.tsx:1038`, `src/components/standard/IdeaRightPanel.tsx:422``. Trasy tył: `Ten dyżur **nie dotyka serwera**. `server/**` pozostaje `TYLKO ODCZYT` bez wyjątku. Nie stawiasz bazy i nie uruchamiasz żadnego testu `pg`/`realpg` — przydzielone Ci `cx-day357-pg` na porcie `6416` jest rezerwacją i **domyślnie go nie używasz**. **`Z28` obowiązuje w pełni: ZERO połączeń do `staging.consultify.ai`, `demo.consultify.ai`, `consultify.ai` i `*.railway.app` — także po to, żeby „sprawdzić, co właściciel zobaczy". SHA stagingu ustala nadzorca, nie Ty**`.

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
WT=/private/tmp/cx-day357-pakiet-poprawka
MARKER=29fcbd4de20ca26d2febc50d9455128cab47ffce

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/grafika/m03-20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day357-pakiet-poprawka-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day357-pakiet-poprawka/config.worktree"
cat "$VAULT/worktrees/cx-day357-pakiet-poprawka/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day357-scratch
mkdir -p /private/tmp/cx-day357-pakiet-poprawka-artefakty

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
git -C "$VAULT" log --oneline 29fcbd4de20ca26d2febc50d9455128cab47ffce..github-backup/grafika/m03-20260902
git -C "$VAULT" diff --name-only 29fcbd4de20ca26d2febc50d9455128cab47ffce..github-backup/grafika/m03-20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day357-pakiet-poprawka-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 29fcbd4de20ca26d2febc50d9455128cab47ffce..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `8` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA: pakiet istnieje i ma znany rozmiar
wc -l docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md
#   moja liczba: 438 wierszy

# (2) ★★★ TEZA GLOWNA (1) — wiersz o Ideach/Notatniku NIE MA dopisku o fladze,
#     a rodzenstwo Tools/Initiatives ma
sed -n '386,394p' docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md
#   oczekiwane: wiersz My Work | Idee/Notatnik konczy sie "widoczne, jezeli staging zredeployowany
#   po 660482d485" — BEZ slowa "OFF"; wiersze Tools i Initiatives koncza sie "domyslnie OFF"

# (3) ★★★ ZRODLO POPRAWKI (1) — domyslna wartosc flagi to false
sed -n '1,3p;25,31p' src/utils/ideaNotebookRightPanelPrototypeFlag.ts
bash -c "grep -n 'isIdeaNotebookRightPanelPrototypeEnabled()' src/components/MyWork/prototypes/IdeaNotebookRightPanelPrototype.tsx"
#   oczekiwane: klucz 'ff_idea_notebook_right_panel_prototype'; wiersz 27 konczy sie '?? false';
#   bramka w wierszu 97 przy OFF zwraca <>{legacy}</> czyli STARY panel

# (4) ★★★ TEZA GLOWNA (2) — 1c4b5a5635 w DWOCH roznych znaczeniach
bash -c "grep -n '1c4b5a5635' docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md"
#   moje liczby: TRZY trafienia — wiersz 16 (SHA stagingu podany przez nadzorce),
#   wiersz 65 (SHA odblokowujacy usuniecie martwego poddrzewa Czatu), wiersz 389 (to samo, w tabeli)

# (5) ★★ ZASADA NIENARUSZALNA — wszystkie 16 wierszy G16 sa dzis w JEDNYM stanie
for f in docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md; do
  echo "$(basename $(dirname $f)) :: $(bash -c "grep -oE 'TECHNICAL_PACKET_READY[^\`]*' $f" | head -1)"
done
#   moje liczby: WSZYSTKIE 16 modulow = 'TECHNICAL_PACKET_READY / OWNER_RETEST_PENDING'
#   ★ To jest stan, ktory po Twoim dyzurze ma byc IDENTYCZNY. Zmiane robi wlasciciel, nie Ty.

# (6) ★★ SKALA DRYFU — policz sam, nie wierz mojej liczbie
C=$(git log -1 --format=%H -- docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md)
F=$(git log --format=%H --reverse -- docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md | head -1)
echo "ostatni commit pakietu: $C"; echo "pierwszy commit pakietu: $F"
echo "od ostatniego: scalen $(git log --merges --oneline $C..HEAD | wc -l), plikow produktu $(git diff --name-only $C..HEAD -- src server/src | wc -l)"
echo "od pierwszego: scalen $(git log --merges --oneline $F..HEAD | wc -l), plikow produktu $(git diff --name-only $F..HEAD -- src server/src | wc -l)"
#   moje liczby: ostatni commit 2d74ea1d75 (350, 04.09 15:36) · pierwszy c950ede121 (03.09 21:28)
#   od ostatniego: 11 scalen, 17 plikow produktu · od pierwszego: 102 scalenia, 337 plikow produktu
#   ★★ ZLECENIE NADZORCY MOWILO "49 scalen i 171 plikow produktu". To liczba SPRZED odswiezenia 350
#   i dzis jest nieaktualna w OBIE strony. Wiazacy jest TWOJ pomiar.

# (7) TEZA: 17 plikow dryfu od 350 zawiera pliki PRZEKROJOWE podgladu i tabeli
git diff --name-only 2d74ea1d75..HEAD -- src server/src
#   oczekiwane: m.in. FilterableTable.tsx, StandardPreview.tsx, TableWithPreviewLayout.tsx,
#   NotebookRightRail.tsx, IdeaRightPanel.tsx, ideaNotebookRightPanelPrototypeFlag.ts
#   ★ Trzy pierwsze sa wspolne dla WSZYSTKICH 16 modulow — sprawdz, czy nie unieważniaja pakietu

# (8) TEZA: liscie slownikow i bramki kanonu na markerze
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
#   moje liczby: pl 35198 · en 33065 · wszystkie cztery bramki = 0
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day357-pakiet-poprawka-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6416`. Twój JEDYNY port harnessu to `5556`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day357-pg`**. **ZAKAZANE:** `porty `5554`/`6414` (dyżur 355), `5555`/`6415` (dyżur 356), `5557`/`6417` (dyżur 358) oraz WSZYSTKIE porty spoza pary `5556`/`6416`; kontenery `cx-day355-pg`, `cx-day356-pg`, `cx-day358-pg` i każdy inny `cx-day*-pg``. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak — ten dyżur **nie zamawia ani jednej flagi, nie zmienia ani jednej wartości domyślnej i nie włącza niczego**. Flagi wyłącznie **opisuje** w dokumencie dla właściciela, cytując `plik:linia` jako źródło każdego zdania o domyślnej wartości`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``src/**` w całości, `server/**` w całości, `public/locales/**`, `tests/**`, `scripts/**`, `vitest*.config.ts`, `tsconfig*.json`, `.github/workflows/**`, `server/migrations/**` oraz **wszystkie 16 plików `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md`**`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY357_PAKIET_POPRAWKA_REPORT.md`. **Nie zmieniasz żadnego `MODULE_ACCEPTANCE.md` — to jest ZASADA NIENARUSZALNA tego dyżuru, nie zalecenie.** Wszystkie 16 wierszy `G16` mają po Twoim dyżurze wyglądać **identycznie** jak przed nim; sprawdzasz to imiennie przez `git diff` w `R3`. Jedyny plik, który zmieniasz merytorycznie, to `docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md`. Dodatkowo wolno: zapisać dowody pod `evidence/day357/` (**katalog NIE ISTNIEJE na markerze — tworzysz go**, `git add -f`) oraz dopisać jedną nową sekcję w `docs/program/REJESTR_ZNALEZISK_20260903.md` o PIERWSZEJ WOLNEJ literze (sekcje doszły dziś do `Q`, ale równolegle dopisują inni autorzy — literę sprawdzasz komendą tuż przed commitem). Plik postępu `/private/tmp/cx-day357-postep.md` żyje POZA repo. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day357-pakiet-poprawka-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day357-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **★★ ZAKAZ ZGADYWANIA SHA STAGINGU I ZAKAZ ROZSTRZYGANIA ROZBIEŻNOŚCI WERSJI.** Pakiet zapisuje dziś dwie wartości (`1c4b5a5635` od nadzorcy, `fb6547b7d0` potwierdzone 04.09 o 05:33) i jawnie mówi „nie zweryfikowano" — **to jest wzorowe i zostaje**. Nie wybierasz jednej, nie kasujesz drugiej, nie łączysz się ze stagingiem, żeby sprawdzić (`Z28`). Twoja poprawka (2) **rozdziela DWA ZNACZENIA tego samego napisu**, a nie rozstrzyga, który SHA jest prawdziwy. **★★ ZAKAZ ZMIANY STANU JAKIEGOKOLWIEK WIERSZA `G` w jakimkolwiek `MODULE_ACCEPTANCE.md`** — także `G16`, także „tylko o jeden stopień", także „bo dowód jest oczywisty" | Pakiet idzie do właściciela, który po nim orzeka o 16 modułach. Zdanie „zobaczysz X" o funkcji za flagą domyślnie wyłączoną kosztuje dwa razy: właściciel zgłasza brak funkcji, a program zużywa dyżur na odkrycie, że funkcja jest gotowa. Ten kształt wystąpił trzy razy jednego dnia i w każdym przypadku funkcja była zrobiona |

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
cd /private/tmp/cx-day357-pakiet-poprawka

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day357-pg psql -U postgres -d cx357 \
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
cd /private/tmp/cx-day357-pakiet-poprawka

docker run -d --name cx-day357-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx357 \
  -p 127.0.0.1:6416:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day357-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6416/cx357 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6416/cx357 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day357-pakiet-poprawka && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6416/cx357 \
JWT_SECRET=cx357-test-secret-do-not-reuse-min-32-znaki \
npx vitest run tests/unit/flags/ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day357-pakiet-poprawka-artefakty/kontrola-flag.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day357-pakiet-poprawka && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run tests/unit/flags/ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day357-pakiet-poprawka-artefakty/kontrola-flag.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day357-pakiet-poprawka/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day357-pg psql -U postgres -d cx357 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day357-pg`.
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
> **(e) **(e) ★★ PUŁAPKA WŁAŚCIWA TEMU DYŻUROWI: dokument opisujący produkt starzeje się ciszej niż kod.** Pakiet ma dziś **438 wierszy** i jest napisany w drugiej osobie do właściciela; każde zdanie „zobaczysz" jest twierdzeniem o runtime, którego autor pakietu **nie zweryfikował na stagingu** (bo `Z28` tego zakazuje) i którego **nie może zweryfikować**. Jedyne, co możesz zrobić, to **związać każde takie zdanie z `plik:linia` w repo** — flaga, jej domyślna wartość, bramka, która przy `OFF` zwraca stary widok. Zdanie bez takiej kotwicy jest w tym dokumencie **długiem, nie informacją**. Sprawdź jawnie w `R2`, ile zdań „zobaczysz/widoczne" nie ma kotwicy, i wypisz je**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day357-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day357-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (``R1`, `R2`, `R3``) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6416` albo `5556` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6416` albo `5556`** (`Z7`).

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

## ★★ UZUPEŁNIENIE DO SEKCJI „JEŚLI COŚ W TEJ INSTRUKCJI JEST SPRZECZNE" (wyżej)

Sekcja wyżej obowiązuje w całości. Poniższe dwa zdania mają **pierwszeństwo**
przed jej brzmieniem — pierwszego w niej nie ma, a drugie odsyła do sekcji,
która w tym dokumencie nazywa się inaczej.

1. **★ Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz rozbieżność wprost.**
   Dotyczy KAŻDEJ liczby w tym dokumencie, także tych, które autor zmierzył sam przy wydaniu.
2. **★ Obalenie którejkolwiek tezy z sekcji „MOJA HIPOTEZA" albo „Zmierz moje
   liczby sam" jest SUKCESEM dyżuru, a nie porażką.** Zapisz to w „Korektach
   wobec instrukcji" z dowodem i idź dalej. (Sekcja wyżej mówi „TEZY
   ZLECENIA…" — w tym dokumencie te sekcje noszą nazwy podane tutaj.)

---

## Po co ten dyżur istnieje

`docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md` to **438 wierszy napisanych
w drugiej osobie do właściciela**. Po jego przeczytaniu właściciel orzeka o 16 modułach
naraz. Każdy wiersz tego pakietu jest więc mnożnikiem: zdanie prawdziwe oszczędza dzień,
zdanie fałszywe kosztuje dwa — raz na zgłoszenie nieistniejącego defektu, drugi raz na
dyżur, który odkrywa, że funkcja od dawna jest zrobiona.

**Dyżur 350 odświeżył ten pakiet i zrobił to dobrze.** Sprawdziłem to imiennie przy
wydaniu tej instrukcji i mówię to wprost, bo pochwała jest tu informacją, nie uprzejmością:

- **żaden wiersz `G16` nie zmienił stanu** — wszystkie 16 modułów mają dziś
  `TECHNICAL_PACKET_READY / OWNER_RETEST_PENDING`, dokładnie tak, jak przed dyżurem 350;
- **rozbieżność SHA zapisana wzorowo** — pakiet podaje OBIE wartości (`1c4b5a5635` od
  nadzorcy i `fb6547b7d0` potwierdzone 04.09 o 05:33), mówi jawnie „nie zweryfikował go
  na stagingu, ponieważ obowiązuje bezwzględny zakaz połączenia (`Z28`)" i kieruje pytanie
  do nadzorcy. **Zero zgadywania. To zostaje bez zmian.**
- **lista „Stan oczekiwany — nie zgłaszaj"** zawiera karty inicjatyw 6 z 24 z numerami
  decyzji (`DEC-387`, `DEC-388`) i z SHA.

**Ale są dwa błędy, które właściciel zobaczy jako zepsuty produkt.** Ten dyżur nanosi
dokładnie te dwie poprawki, sprawdza, czy nie mają rodzeństwa, i **nie robi nic więcej**.

**(1) Wiersz o Ideach/Notatniku jest nieprawdziwy.** Wiersz **390** mówi:
„widoczne, jeżeli staging zredeployowany po `660482d485`". Panel siedzi za flagą
`ff_idea_notebook_right_panel_prototype`, której **domyślna wartość to `false`**
(`src/utils/ideaNotebookRightPanelPrototypeFlag.ts:27` — `?? false`), a bramka przy
`OFF` **zwraca stary panel** (`src/components/MyWork/prototypes/IdeaNotebookRightPanelPrototype.tsx:97`
— `if (!isIdeaNotebookRightPanelPrototypeEnabled()) return <>{legacy}</>;`). Po dowolnym
redeployu właściciel zobaczy **STARY** panel i zgłosi to jako brak funkcji. Sąsiednie wiersze
Tools (**392**) i Initiatives (**393**) mają dopisek „domyślnie OFF" — ten go nie ma.

**(2) `1c4b5a5635` znaczy w tym dokumencie dwie różne rzeczy.** W wierszu **16** jest to
**SHA stagingu podany przez nadzorcę** (ten sporny, obok `fb6547b7d0`). W wierszach **65**
i **389** jest to **SHA, który usunął martwe poddrzewo Czatu**. Czytelnik, który zapamięta
pierwsze znaczenie, przeczyta wiersz 389 jako „to już jest na stagingu" — a to zupełnie
inne twierdzenie. Rozdzielasz oba znaczenia w treści; **nie rozstrzygasz, który SHA jest
prawdziwy** (to należy do nadzorcy, a `Z28` i tak zabrania sprawdzenia).

**Dlaczego to trafia na dyżur, a nie „poprawię przy okazji": Pakiet idzie do właściciela, który po nim orzeka o 16 modułach. Zdanie „zobaczysz X" o funkcji za flagą domyślnie wyłączoną kosztuje dwa razy: właściciel zgłasza brak funkcji, a program zużywa dyżur na odkrycie, że funkcja jest gotowa. Ten kształt wystąpił trzy razy jednego dnia i w każdym przypadku funkcja była zrobiona**

---

## ★★ ZASADA NIENARUSZALNA TEGO DYŻURU

**Żaden wiersz `G16` w żadnym z 16 plików `MODULE_ACCEPTANCE.md` nie może zmienić stanu.**
Ani o stopień, ani „bo dowód jest oczywisty", ani „bo i tak przejdzie". Stan `G16` zmienia
**właściciel po przelocie**, na podstawie tego, co zobaczy — nie dyżur, który przygotowuje
mu dokument. Dowodzisz tego imiennie przez `git diff` w `R3`. Naruszenie = odrzucenie
całego dyżuru, nie pozycji.

---

## ★★ MOJA HIPOTEZA — masz ją OBALIĆ ALBO POTWIERDZIĆ, nie przyjąć

| # | Teza | Na czym ją opieram | Jak ją obalisz |
| --- | --- | --- | --- |
| `H1` | Wiersz **390** jest nieprawdziwy, bo flaga jest domyślnie `false` | `ideaNotebookRightPanelPrototypeFlag.ts:27` (`?? false`) + bramka `IdeaNotebookRightPanelPrototype.tsx:97` zwracająca `legacy` | Pokaż, że coś **poza** tą flagą włącza panel po redeployu (np. inny konsument renderuje nowy panel bez bramki). Wtedy wiersz 390 jest prawdziwy, a moja teza pada |
| `H2` | Tylko wiersz **390** ma ten defekt; wiersze **388**, **389** i **391** są w porządku | Tools i Initiatives mają jawne „domyślnie OFF"; nie zmierzyłem flag Czatu i Wywiadu | **Zmierz rodzeństwo.** Jeżeli preferencja chipów Czatu albo kontrakt menu akcji Wywiadu też siedzą za flagą domyślnie `OFF`, moja teza jest obalona i poprawiasz też te wiersze |
| `H3` | `1c4b5a5635` występuje **trzy razy** i w **dwóch** znaczeniach | `grep` przy wydaniu: wiersze 16, 65, 389 | Policz sam. Inna liczba trafień albo trzecie znaczenie = teza obalona |
| `H4` | W pakiecie jest **9** zdań o kształcie „zobaczysz"/„widoczne", a część z nich nie ma kotwicy `plik:linia` | `grep -c 'zobaczysz\|widoczne'` = 9 przy wydaniu | Policz sam i wypisz, **które** mają kotwicę, a które nie. Jeżeli wszystkie mają, moja teza pada i piszesz to wprost |
| `H5` | Dryf od odświeżenia 350 (`2d74ea1d75`) to **11 scaleń i 17 plików produktu**, w tym trzy pliki przekrojowe wspólne dla wszystkich 16 modułów | pomiar przy wydaniu, komenda (6) w `§0.3` | Policz sam na SWOIM markerze. **Zlecenie nadzorcy mówiło „49 scaleń i 171 plików produktu" — sam to obaliłem: to liczba SPRZED odświeżenia 350 i dziś jest nieaktualna w OBIE strony.** Twój pomiar jest wiążący |

---

## ★ Zmierz moje liczby sam

Wszystkie liczby w tym dokumencie zmierzyłem na markerze `29fcbd4de20ca26d2febc50d9455128cab47ffce` komendami z `§0.3`
i każda z nich jest **rozkazem pomiarowym**, nie faktem. Jedna liczba została już przez autora
obalona przy wydaniu i zapisuję to jawnie, żeby nie wróciła jako „fakt":

> **Zlecenie mówiło: „poprzedni pomiar dał 49 scaleń i 171 plików produktu (69 w Czacie,
> 51 w `server/src/routes`)".** Zmierzyłem to na markerze wydania: od ostatniego commita
> pakietu (`2d74ea1d75`, dyżur 350) jest **11 scaleń i 17 plików produktu**, a od pierwszego
> commita pakietu (`c950ede121`) — **102 scalenia i 337 plików produktu**. Liczba `49/171`
> nie odpowiada żadnemu z tych dwóch punktów odniesienia. **Nie przepisuj jej.** Zmierz
> własną i podaj, od którego commita liczysz.

---

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: PAKIET · ŹRÓDŁA TWIERDZEŃ · MACIERZE ODBIORU · DOWODY · RAPORT

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany wpis
w raporcie z `plik:linia` i rekomendacją jako diff **nienałożony**. Pozycja z takim produktem
jest **ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Pakiet przelotu (jedyny plik merytoryczny)** | `docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md` | **★ PEŁNA LICENCJA w zakresie `R1`, `R2` i `R4`.** Zakaz kasowania rozbieżności SHA z wiersza 16, zakaz wybierania jednego SHA, zakaz usuwania zdania „nie zweryfikował go na stagingu", zakaz skracania listy „Czego NIE zgłaszaj" | — |
| **Źródło twierdzenia o fladze Idei/Notatnika** | `src/utils/ideaNotebookRightPanelPrototypeFlag.ts`, `src/components/MyWork/prototypes/IdeaNotebookRightPanelPrototype.tsx` | **TYLKO ODCZYT.** Wolno czytać i **cytować `plik:linia`** w treści pakietu. **Zakaz zmiany wartości domyślnej** (`Z10`) i zakaz zmiany bramki (`Z11`) | Cytat `plik:linia` w pakiecie i w raporcie |
| **Żywi konsumenci bramki** | `src/components/MyWork/notebook/NotebookRightRail.tsx:1038`, `src/components/standard/IdeaRightPanel.tsx:422` | **TYLKO ODCZYT** — sprawdzasz je w `R1` po to, żeby móc obalić `H1`, nie żeby je zmienić | Wpis do raportu |
| **Rodzina flag rodzeństwa (`R2`)** | `src/utils/*Flag*.ts` (**126 plików** w `src/utils` przy wydaniu), `src/components/**/*Flag*.ts` | **TYLKO ODCZYT — inwentaryzujesz, nie naprawiasz.** Interesują Cię wyłącznie flagi stojące za wierszami **388**, **389**, **391** tabeli „Zobaczysz inaczej" | Wpis: wiersz pakietu, flaga, `plik:linia`, wartość domyślna |
| **Macierze odbioru — WSZYSTKIE 16** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` | **★★ NIETYKALNE DO ZAPISU — ZASADA NIENARUSZALNA.** Nie zmieniasz żadnego wiersza `G`, w szczególności `G16`. Odczyt (`grep`, `git diff`) jest obowiązkowy w `R3` | Dowód `git diff` w `R3` |
| **Kod produktu i testy** | `src/**`, `server/**`, `tests/**`, `scripts/**`, `public/locales/**` | **TYLKO ODCZYT — BEZWZGLĘDNIE.** Ten dyżur nie zmienia ani jednej linii kodu, ani jednego testu | Wpis do raportu: plik, linia, problem, diff **nienałożony** |
| **Konfiguracja i CI** | `vitest*.config.ts`, `tsconfig*.json`, `.github/workflows/**`, `server/migrations/**`, `docker-compose*`, `railway*` | **NIETYKALNE DO ZAPISU** (`Z12`, `Z18`, `Z38`, `Z39`) | Opis w raporcie |
| **Dowody** | `evidence/day357/**` (**katalog NIE ISTNIEJE na markerze — tworzysz go**, `git add -f`) | **★ PEŁNA LICENCJA na tworzenie i dopisywanie.** Wszystkie dowody tego dyżuru lądują TUTAJ, w repo, a nie w katalogu tymczasowym | — |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jedna nowa sekcja o **pierwszej wolnej literze**, sprawdzonej komendą tuż przed commitem (dziś doszły do `Q`) | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY357_PAKIET_POPRAWKA_REPORT.md` (**NOWY**) | `R5` — **JEDYNY nowy dokument rejestrowy, jaki wolno Ci utworzyć** (`Z13`) | — |
| **Cudze tereny** | `server/src/routes/v8/finance-v2/__tests__/**`, `evidence/g15/**` (dyżur 355) · `src/components/MyWork/prototypes/__tests__/**`, `tests/unit/flags/**`, `evidence/day356/**` (dyżur 356) · `server/src/routes/__tests__/day27{4,5,6,7}-*.pg.test.ts`, `evidence/g19/**`, `vitest.config.ts`, `server/vitest.config.ts` (dyżur 358) · licznik kompletności, 20 ekranów podglądu, wiersz `G19`, etykiety narzędzi (dyżury 351-354) | **TYLKO ODCZYT** | Wpis do raportu |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem `plik:linia` i idziesz dalej |

---

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

# (c) ★★ WLASCIWY TEMU DYZUROWI — 16 wierszy G16 PRZED i PO
for f in docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md; do
  echo "$(basename $(dirname $f)) :: $(bash -c "grep -oE 'TECHNICAL_PACKET_READY[^\`]*' $f" | head -1)"
done | tee evidence/day357/g16-przed.txt   # ★ najpierw: mkdir -p evidence/day357
#   moje liczby: WSZYSTKIE 16 = 'TECHNICAL_PACKET_READY / OWNER_RETEST_PENDING'
```

**Ten dyżur nie zmienia kodu, więc (a) i (b) MUSZĄ dać identyczny wynik przed i po.**
Jakakolwiek różnica oznacza, że dotknąłeś czegoś spoza licencji — **cofasz to, zanim
zrobisz cokolwiek innego.**

---

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | wierszy pakietu | `438` | komenda (1) z `§0.3` | TAK |
| 2 | trafień `1c4b5a5635` w pakiecie | `3` (wiersze 16, 65, 389) | komenda (4) z `§0.3` | TAK — **`grep` przez `bash -c`, bo w `zsh` bywa pusty** |
| 3 | znaczeń, w jakich występuje `1c4b5a5635` | `2` | odczyt kontekstu wierszy 16, 65, 389 | TAK — to jest sedno poprawki (2) |
| 4 | wartość domyślna flagi panelu Idei/Notatnika | `false` | komenda (3) z `§0.3` | TAK — **to jest źródło poprawki (1)** |
| 5 | wierszy tabeli „Zobaczysz inaczej" z dopiskiem „domyślnie OFF" | `2` z `6` (Tools, Initiatives) | komenda (2) z `§0.3` | TAK — **rodzeństwo, którego mój wiersz nie ma** |
| 6 | zdań „zobaczysz"/„widoczne" w pakiecie | `9` | `bash -c "grep -c 'zobaczysz\|widoczne' <pakiet>"` | TAK — `H4` |
| 7 | wierszy `G16` w stanie `TECHNICAL_PACKET_READY / OWNER_RETEST_PENDING` | `16` z `16` | komenda (5) z `§0.3` | TAK — **to jest stan, który ma się NIE ZMIENIĆ** |
| 8 | dryf od odświeżenia 350 (`2d74ea1d75`) | `11` scaleń, `17` plików produktu | komenda (6) z `§0.3` | TAK — **obala liczbę `49/171` ze zlecenia** |
| 9 | dryf od pierwszego commita pakietu (`c950ede121`) | `102` scalenia, `337` plików produktu | komenda (6) z `§0.3` | TAK |
| 10 | pliki przekrojowe w dryfie od 350 | `3` (`FilterableTable.tsx`, `StandardPreview.tsx`, `TableWithPreviewLayout.tsx`) | komenda (7) z `§0.3` | TAK — **wspólne dla wszystkich 16 modułów** |
| 11 | liście słowników PL/EN | `35198` / `33065` | blok (a) „WARUNKÓW WSPÓLNYCH" | TAK |

---

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md` ·
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY357_PAKIET_POPRAWKA_REPORT.md` ·
`evidence/day357/**` (nowy katalog, `git add -f`).

**Zapisujesz WARUNKOWO:**
`docs/program/REJESTR_ZNALEZISK_20260903.md` (jedna nowa sekcja, tylko jeżeli `R2` albo `R3`
znajdą coś, czego rejestr nie ma).

**JAWNIE NIE ZAPISZESZ:** `src/**`, `server/**`, `tests/**`, `scripts/**`, `public/locales/**`,
`vitest*.config.ts`, `tsconfig*.json`, `.github/workflows/**`, `server/migrations/**`,
**wszystkie 16 plików `MODULE_ACCEPTANCE.md`**, `evidence/g15/**`, `evidence/g19/**`,
`evidence/day356/**`, `OWNER_DECISION_LEDGER_2026-08-24.md`.

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day357-pakiet-poprawka
mkdir -p evidence/day357
git diff --name-only --cached | tee evidence/day357/staged.txt
bash -c "grep -iE '^src/|^server/|^tests/|^scripts/|^public/locales/|vitest.*config|^tsconfig|^\.github/|MODULE_ACCEPTANCE|OWNER_DECISION_LEDGER|evidence/g1[59]|evidence/day356' evidence/day357/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## R0 — TRZY TWARDE ZASADY TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

1. **Każda poprawka niesie CYTAT ŹRÓDŁA.** Zdanie, które wstawiasz do pakietu, ma podawać
   `plik:linia` (np. `ideaNotebookRightPanelPrototypeFlag.ts:27`). Zdanie bez kotwicy jest
   w tym dokumencie **długiem, nie informacją** — dokładnie tym, co naprawiasz.
2. **Nie rozstrzygasz sporu o SHA stagingu.** Poprawka (2) **rozdziela dwa znaczenia
   tego samego napisu**; nie wybiera prawdziwego SHA, nie kasuje drugiej wartości i nie
   łączy się ze stagingiem, żeby sprawdzić (`Z28` — to jedyny zakaz, którego naruszenie
   zatrzymuje CAŁY dyżur).
3. **Zero zmian stanu `G16`.** Robisz `evidence/day357/g16-przed.txt` przed pierwszą zmianą
   i `g16-po.txt` po ostatniej, i pokazujesz w raporcie, że `diff` obu plików jest **pusty**.
   To nie jest formalność — to jest warunek odbioru.

---

## R1 — POPRAWKA (1): WIERSZ O IDEACH/NOTATNIKU I JEGO RODZEŃSTWO (rdzeń)

1. **Udowodnij źródło, zanim poprawisz.** Wklej do raportu wynik komendy (3) z `§0.3`:
   klucz flagi, wiersz z `?? false`, wiersz bramki zwracającej `legacy`. **Bez tych trzech
   cytatów poprawka jest opinią, nie faktem.**
2. **Sprawdź, czy `H1` da się obalić.** Otwórz obu żywych konsumentów
   (`NotebookRightRail.tsx:1038`, `IdeaRightPanel.tsx:422`) i odpowiedz na jedno pytanie:
   **czy istnieje ścieżka renderująca nowy panel z pominięciem bramki?** Jeżeli tak — `H1`
   pada, wiersz 390 jest prawdziwy, poprawki (1) NIE nanosisz i piszesz to w raporcie jako
   obalenie tezy autora. To jest **sukces**, nie porażka.
3. **Nanieś poprawkę** — wiersz 390 tabeli „Zobaczysz inaczej" ma po Twojej zmianie mówić
   **to samo, co wiersze Tools i Initiatives**: kod jest scalony po `660482d485`, ale panel
   siedzi za flagą `ff_idea_notebook_right_panel_prototype` **domyślnie OFF**, więc bez
   decyzji o włączeniu właściciel nadal zobaczy stary panel — **i to nie jest defekt**.
   Sformułowanie dobierasz sam; wiążący jest sens i obecność kotwicy `plik:linia`.
4. **★ RODZINA (`H2`) — obowiązkowa, nie opcjonalna.** Ten sam kształt sprawdź dla
   **wszystkich sześciu** wierszy tabeli (388 Chat/menu, 389 Chat/panel, 390 My Work,
   391 Interview, 392 Tools, 393 Initiatives). Dla każdego podaj w raporcie: czy stoi za
   flagą, jaka to flaga, `plik:linia` wartości domyślnej. **Wiersz za flagą domyślnie `OFF`
   bez dopisku poprawiasz tak samo.** Wiersz, który nie stoi za flagą, zostawiasz i piszesz
   o nim jedno zdanie. Pominięcie rodzeństwa to znany błąd tego programu: praca
   per-zgłoszenie daje „poprawne w 2 z 3".
5. **Zapisz dowód do repo:** `evidence/day357/r1-flagi-wierszy.md` z tabelą sześciu wierszy.
   **`git add -f`.**

**Commit po `R1`. Push na `github-backup` (`Z34a`).**

---

## R2 — POPRAWKA (2): DWA ZNACZENIA JEDNEGO SHA I ZDANIA BEZ KOTWICY (rdzeń)

1. **Policz trafienia sam** (komenda (4) z `§0.3`) i wypisz kontekst każdego. Moja liczba
   to `3` trafienia w `2` znaczeniach. Inna liczba = teza `H3` obalona, zapisujesz to.
2. **Rozdziel znaczenia w treści.** Po Twojej zmianie czytelnik ma z samego zdania wiedzieć,
   o którym znaczeniu mowa — bez cofania się do wiersza 16. Najtańszy kształt: przy każdym
   wystąpieniu z drugiego znaczenia dopisz, **czego ten SHA dotyczy** („commit usuwający
   martwe poddrzewo Czatu"), a przy wierszu 16 zostaw jawną informację, że to **sporny**
   znacznik wersji stagingu, obok `fb6547b7d0`. Formę dobierasz sam.
3. **★ ZAKAZ:** nie kasujesz `fb6547b7d0`, nie wybierasz „prawdziwego" SHA, nie usuwasz
   zdania o niezweryfikowaniu, nie łączysz się ze stagingiem (`Z28`).
4. **Audyt zdań bez kotwicy (`H4`).** Wypisz wszystkie zdania o kształcie „zobaczysz" /
   „widoczne" (moja liczba: `9`) i dla każdego odpowiedz **TAK/NIE**: czy ma kotwicę
   `plik:linia` albo SHA. Zdania bez kotwicy **wypisujesz w raporcie jako dług** — nie
   musisz ich wszystkich naprawiać w tym dyżurze, ale nie wolno Ci ich przemilczeć.
   Jeżeli któreś jest **fałszywe** tak jak wiersz 390 — poprawiasz je tutaj.
5. **Zapisz dowód:** `evidence/day357/r2-kotwice.md`. **`git add -f`.**

**Commit po `R2`. Push.**

---

## R3 — DOWÓD, ŻE `G16` SIĘ NIE RUSZYŁ, I PRZEGLĄD DRYFU (rdzeń)

1. **Dowód imienny, nie zapewnienie.** Wygeneruj `evidence/day357/g16-po.txt` tą samą
   komendą co `g16-przed.txt` i wklej do raportu wynik:
   `diff evidence/day357/g16-przed.txt evidence/day357/g16-po.txt` — **ma być pusty**.
   Dodatkowo: `git diff --name-only <marker>..HEAD -- docs/program/waves/WAVE_03_ACCEPTANCE/modules/`
   — **ma być pusty**. Oba wyniki dosłownie w raporcie.
2. **Policz dryf sam** (komenda (6) z `§0.3`), od **obu** punktów odniesienia, i podaj,
   od którego liczysz. Pamiętaj, że liczba `49/171` ze zlecenia nadzorcy jest przez autora
   tej instrukcji **obalona** — nie przepisuj jej.
3. **★ Przegląd, czy dryf unieważnia pakiet.** Weź listę plików produktu zmienionych od
   `2d74ea1d75` (komenda (7)) i dla **każdego** odpowiedz jednym zdaniem: czy zmienia to,
   co właściciel zobaczy na ekranie opisanym w pakiecie. **Szczególną uwagę zwróć na trzy
   pliki przekrojowe** — `FilterableTable.tsx`, `StandardPreview.tsx`,
   `TableWithPreviewLayout.tsx` — bo są wspólne dla **wszystkich 16 modułów**: jedna zmiana
   w nich dotyka każdego ekranu listowego w pakiecie.
4. **Jeżeli znajdziesz coś, co dezaktualizuje pakiet** — dopisujesz to do pakietu tak samo
   jak poprawki (1) i (2): z kotwicą, bez zmiany stanu `G16`. **Jeżeli nic nie znajdziesz,
   piszesz to wprost jednym zdaniem** — „przejrzałem 17 plików, żaden nie zmienia treści
   pakietu" jest pełnowartościowym wynikiem, o ile faktycznie przejrzałeś wszystkie.
5. **Zapisz dowód:** `evidence/day357/r3-dryf.md` + `g16-przed.txt` + `g16-po.txt`.
   **`git add -f`.**

**Commit po `R3`. Push.**

---

## R4 — LISTA „STAN OCZEKIWANY — NIE ZGŁASZAJ": UZUPEŁNIENIE O KONTEKST KART INICJATYW

1. Lista „Stan oczekiwany — nie zgłaszaj" już dziś mówi o kartach inicjatyw 6 z 24 i podaje
   `DEC-387`/`DEC-388` oraz SHA. **Brakuje jej jednego zdania**: że to jest stan **naprawiony**,
   a nie stan **zepsuty** — naprawa jest scalona i siedzi za flagą `ff_initiative_sections_complete`
   (`src/utils/initiativeSectionsCompleteFlag.ts:1`), domyślnie wyłączoną, wprowadzoną
   dyżurami **338** i **343** na mocy **`DEC-388`**. Dopisz to.
2. **★ Sprawdź, zanim dopiszesz.** Otwórz `src/utils/initiativeSectionsCompleteFlag.ts`
   i potwierdź nazwę klucza oraz wartość domyślną. Jeżeli klucz albo domyślna wartość jest
   inna, niż podaję — **wiążący jest Twój pomiar**, a moja teza idzie do „Korekt wobec
   instrukcji".
3. Ten sam test zastosuj do pozostałych pozycji listy „Stan oczekiwany": czy każda niesie
   **numer decyzji** albo **SHA**. Pozycję bez żadnej kotwicy wypisz w raporcie.
4. **Zapisz dowód:** `evidence/day357/r4-stan-oczekiwany.md`. **`git add -f`.**

**Commit po `R4`. Push.**

---

## R5 — RAPORT, JAWNE LICZBY I PYTANIA DO NADZORCY

Raport zawiera: obie poprawki z **cytatem źródła** przy każdej · odpowiedź na `H1`–`H5`
(„potwierdzona / obalona", każda z komendą i wynikiem) · tabelę sześciu wierszy „Zobaczysz
inaczej" z flagami · listę zdań „zobaczysz/widoczne" z odpowiedzią TAK/NIE o kotwicę ·
**pusty `diff` `g16-przed.txt` ↔ `g16-po.txt` wklejony dosłownie** · własny pomiar dryfu
z podaniem punktu odniesienia · **niepustą sekcję „TWIERDZENIA NIEZWERYFIKOWANE"** (co
najmniej jedno zdanie: nie sprawdziłeś stagingu, bo `Z28`).

★★ **Osobna, obowiązkowa sekcja: „PYTANIA DO NADZORCY".** Co najmniej jedno pytanie jest
w tym dyżurze pewne: **który SHA opisuje wersję stagingu — `1c4b5a5635` czy `fb6547b7d0`?**
Zadajesz je jako pytanie rozstrzygalne („tak"/„nie" albo „A"/„B") i **nie rozstrzygasz go
sam**. Jeżeli masz inne — dopisz. Sekcja nie może być pusta.

★ Zanim dopiszesz cokolwiek do jakiegokolwiek dokumentu, sprawdź, czy nie jest GENEROWANY:
`bash -c "grep -rl 'PRZELOT_WLASCICIELA_STAGING_20260904' scripts/"`. Sekcję
w `REJESTR_ZNALEZISK_20260903.md` dopisujesz o **pierwszej wolnej literze** — sprawdź ją
komendą `bash -c "grep -nE '^## [A-Z]\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"`
**tuż przed commitem**, bo równolegle piszą inni autorzy (dziś sekcje doszły do `Q`).

**Commit po `R5`. Push.**

---

## Próg odbioru

**Obie poprawki naniesione, każda z cytatem źródła (`plik:linia`). Rodzeństwo sześciu wierszy
„Zobaczysz inaczej" sprawdzone imiennie. Przegląd dryfu od dyżuru 350 wykonany na PEŁNEJ liście
plików produktu. `diff` stanu `G16` przed i po — PUSTY, wklejony dosłownie. Zero zmian
w `MODULE_ACCEPTANCE.md`.**

Odbiorca odrzuci dyżur, w którym: zmieniono stan choćby jednego wiersza `G`; wybrano jeden
SHA stagingu albo skasowano drugi; poprawiono wiersz 390 bez sprawdzenia pozostałych pięciu;
przepisano liczbę `49/171` zamiast zmierzyć własną; wstawiono do pakietu zdanie o runtime
**bez kotwicy `plik:linia`**; albo połączono się ze stagingiem, żeby „tylko sprawdzić" (`Z28`).

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „poprawka (1) naniesiona
z cytatem, poprawka (2) naniesiona, rodzeństwo sprawdzone — dwa wiersze z sześciu też były
za flagą i też je poprawiłem; przeglądu dryfu nie dokończyłem, przejrzałem 9 z 17 plików,
oto które" — **jest pełnowartościowym wynikiem.** Zdanie „przejrzałem dryf" bez listy
plików nie jest.

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: **sprawdzasz
warunek NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na zapamiętanym wyniku.**
Wynik ponownego sprawdzenia wklejasz do raportu z datą i godziną. Dotyczy to zwłaszcza
liczby wierszy pakietu i numerów wierszy 16/65/389/390 — **równolegle biegną inne dyżury
i pakiet mógł się przesunąć.** Numery wierszy w tym dokumencie zawsze potwierdzaj komendą,
nigdy z pamięci.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która może wyglądać na sprzeczną | Rozstrzygnięcie |
| --- | --- |
| „Popraw wiersz o SHA" vs „nie rozstrzygaj, który SHA jest prawdziwy" | `R0` (2) i `R2` (2): poprawka **rozdziela dwa znaczenia napisu**, nie wybiera wartości; wiersz 16 zostaje ze sporem i obiema wartościami |
| „Pakiet mówi o tym, co właściciel zobaczy" vs `Z28` (zakaz połączenia ze stagingiem) | `R0` (1): każde zdanie o runtime wiążesz z `plik:linia` w repo; runtime stagingu jest **poza Twoim zasięgiem z definicji** i piszesz to w „TWIERDZENIACH NIEZWERYFIKOWANYCH" |
| „Cytuj `plik:linia` z `src/`" vs „`src/**` TYLKO ODCZYT" | Tabela licencji: odczyt i cytowanie są jawnie dozwolone i **zamówione**; zakaz dotyczy zapisu |
| „Sprawdź rodzeństwo sześciu wierszy" vs „ten dyżur zmienia dwie rzeczy" | `R1` (4): sprawdzenie rodzeństwa jest **pomiarem**; poprawiasz tyle wierszy, ile jest fałszywych — jeżeli fałszywy jest tylko jeden, poprawiasz jeden i piszesz, że pozostałe sprawdziłeś |
| „Nie zmieniasz `MODULE_ACCEPTANCE.md`" vs „przegląd dryfu może wykazać regresję modułu" | `R3` (4): regresję **opisujesz w pakiecie i w raporcie**; stan wiersza `G` zmienia właściciel po przelocie, nigdy ten dyżur |
| „Instrukcja mówi 49 scaleń i 171 plików" vs „mój pomiar mówi co innego" | Sekcja „Zmierz moje liczby sam": autor obalił tę liczbę **przy wydaniu**; wiążący jest pomiar wykonawcy (`Z24`) |
| „Dopisz kontekst do listy stanu oczekiwanego" vs `Z13` (nie tworzysz dokumentów) | `Z13` zakazuje **nowych dokumentów rejestrowych**; dopisanie zdania do istniejącego pakietu jest jawnie zamówione |
| „Zapisz dowody" vs „to dyżur dokumentacyjny, nie ma dowodów" | Tabela licencji, wiersz „Dowody": dowodem są pliki `evidence/day357/**` w **repo** (`git add -f`), nie ścieżki w `/private/tmp` — dowód poza repo wyparowuje |
| „Numery wierszy 16/65/389/390" vs „równolegle piszą inni" | Sekcja „Wznowienie": numery wierszy potwierdzasz komendą tuż przed edycją; podane tu są z markera wydania |
| „Dopisz sekcję do rejestru znalezisk" vs „równolegle dopisują inni autorzy" | `R5`: literę sekcji sprawdzasz komendą **tuż przed commitem**, nie zakładasz z góry |
| „Przydzielono Ci bazę i port" vs „nie stawiasz bazy" | `TRASY_TYL`: `cx-day357-pg`/`6416` to **rezerwacja rozłączności**, nie polecenie; ten dyżur nie uruchamia testów DB |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 11 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — pakiet (438 wierszy), `ideaNotebookRightPanelPrototypeFlag.ts:1/27`, `IdeaNotebookRightPanelPrototype.tsx:97`, `NotebookRightRail.tsx:1038`, `IdeaRightPanel.tsx:422`, `initiativeSectionsCompleteFlag.ts:1`, 16 plików `MODULE_ACCEPTANCE.md` — sprawdzone komendami przy wydaniu; `evidence/day357/` **jawnie oznaczony jako nieistniejący** |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 11 wierszy; wszystkie zmierzone przy wydaniu na markerze |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — pakiet · źródło twierdzenia o fladze · żywi konsumenci · rodzina flag · 16 macierzy odbioru · kod i testy · konfiguracja i CI · dowody · rejestr znalezisk · raport · cudze tereny |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R1`–`R4` zmieniają wyłącznie jeden plik dokumentacyjny i katalog dowodów; zero plików kodu |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — `6416`/`5556` zarezerwowane i nieużywane; 355/356/358 mają rozłączne porty (`6414`/`5554`, `6415`/`5555`, `6417`/`5557`) i **rozłączne pliki**; dyżury 351-354 mają rozłączny temat |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z markera |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — `§0.2d` w komplecie; pułapki właściwe: dokument starzejący się ciszej niż kod, zdanie o runtime bez kotwicy, `grep --include` w `zsh` dający pustkę, dowód poza repo, numery wierszy przesuwane przez równoległych autorów |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany", zero pól szablonu | TAK — kontrola generatora przy wydaniu |
