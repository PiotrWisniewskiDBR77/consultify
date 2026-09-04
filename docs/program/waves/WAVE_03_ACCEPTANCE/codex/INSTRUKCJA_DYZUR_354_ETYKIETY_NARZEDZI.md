# INSTRUKCJA DYŻURU nr 354 — Codex — „★★★ ANGIELSKIE ETYKIETY W NARZĘDZIACH FAZOWYCH — CAŁA RODZINA, NIE SIÓDMA ŁATKA. Dyżur 344 wpiął przewód do kafli etapów i odsłonił defekt, którego wcześniej nikt nie mógł zobaczyć, bo kafli renderowało się ZERO: `label: isPolish ? 'Mission & Context' : 'Mission & Context'` — angielski w OBU gałęziach warunku języka, plus hybrydy typu `'Przygotuj final source summary'`. Nadzorca naprawił SZEŚĆ, biorąc polskie nazwy z `src/toolPacks/packs/dynamicSwot.pack.ts` (`title: { pl, en }` — to samo źródło, które zasila lewe drzewo). Ten dyżur robi RESZTĘ RODZINY i dokłada BEZPIECZNIK, który nie pozwoli jej odrosnąć — z dowodem mutacyjnym W OBIE STRONY: że łapie prawdziwy defekt i że NIE czerwieni się na uzasadnionych identycznościach (`Status`, `SWOT`, marki, akronimy). ★★ Kafle NIE SĄ ZA FLAGĄ — bramkuje je `toolType === 'dynamic-swot'` — więc po scaleniu te etykiety widzi KAŻDY użytkownik"

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
> **wyłącznie** `/private/tmp/cx-day354-etykiety-narzedzi`.

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
Zakres: **NARZĘDZIA (`03_TOOLS`) — **warstwa etykiet narzędzi fazowych**: logika kompletności `src/components/DiscoveryTools/toolCompletion.ts` (787 linii, 125 wystąpień `isPolish`, 105 ternary z dwoma literałami) oraz cała rodzina `src/components/DiscoveryTools/**` i `src/toolPacks/**` (162 pliki w zakresie, 256 ternary). ★ **Źródłem prawdy nazw są `title: { pl, en }` w 19 paczkach `src/toolPacks/packs/*.pack.ts`** — nie tłumaczysz na własną rękę, gdy nazwa tam istnieje. ★★ Ekran do oceny wzrokiem: `dev-render/screens/tools-swot-session-workspace.tsx` (`dev-render/main.tsx:293` i `:1890`)**.
Trasy front: `★★ SEDNO: `src/components/DiscoveryTools/toolCompletion.ts` — `computeDynamicSwotPhaseSummaries` i `computeDynamicSwotOverallReadiness` produkują etykiety kafli. Konsument: `src/components/DiscoveryTools/ToolDocumentView.tsx` — wiersze **521**, **529**, **534**, **1210**, **1255** (bramkowanie `toolType === 'dynamic-swot'`, **ZERO odwołań do flagi**), render kafli w **1121**–**1144** (`data-testid="dynamic-swot-phase-overview"`, `data-testid="dynamic-swot-phase-tile"`, `data-testid="dynamic-swot-readiness-badge"` — to są Twoje uchwyty do `--zlicz`). Rodzeństwo do przejrzenia: reszta `src/components/DiscoveryTools/**` (m.in. `steps/`, `shared/`, `tools/DynamicSWOT/`) oraz `src/toolPacks/**`. Ekran harnessu: `dev-render/screens/tools-swot-session-workspace.tsx``. Trasy tył: `BRAK — ten dyżur nie dotyka serwera. Nie ma trasy HTTP, nie ma kontrolera, nie ma repozytorium. ★ Kontener PostgreSQL (`cx-day354-pg`, port `6413`, baza `cx354`) jest zarezerwowany **wyłącznie na wypadek**, gdyby któryś przelot testowy okazał się wymagać realnej bazy; **domyślnie go nie stawiasz**. Jeżeli go postawisz — obraz `pgvector/pgvector:pg16` (`postgres:15` nie przechodzi migracji), dwa przebiegi migracji, `docker rm -fv cx-day354-pg` na koniec, `df -h /` przed i po`.

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
WT=/private/tmp/cx-day354-etykiety-narzedzi
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
git -C "$VAULT" worktree add "$WT" -b codex/day354-etykiety-narzedzi-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day354-etykiety-narzedzi/config.worktree"
cat "$VAULT/worktrees/cx-day354-etykiety-narzedzi/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day354-etykiety-narzedzi-scratch
mkdir -p /private/tmp/cx-day354-etykiety-narzedzi-artefakty

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
git -C "$WT" push github-backup codex/day354-etykiety-narzedzi-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 29fcbd4de20ca26d2febc50d9455128cab47ffce..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `osiem` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day354-etykiety-narzedzi

# (1) SUROWE LICZBY W BADANYM PLIKU
wc -l < src/components/DiscoveryTools/toolCompletion.ts
bash -c "grep -c 'isPolish' src/components/DiscoveryTools/toolCompletion.ts"
bash -c "grep -oE \"isPolish [?] '[^']*' : '[^']*'\" src/components/DiscoveryTools/toolCompletion.ts | wc -l"
#   moje liczby: 787 linii, 125 wystapien `isPolish`, 105 ternary z dwoma literalami

# (2) ★★★ KSZTALT A — OBIE GALEZIE IDENTYCZNE (backreferencja)
bash -c "grep -nE \"isPolish [?] '([^']*)' : '\\1'\" src/components/DiscoveryTools/toolCompletion.ts"
#   moje trafienia: 654 ('Portfolio mission') i 692 ('Risk mission') — DWA.
#   ★★★ ZLECENIE MOWILO „ok. 73 podejrzanych etykiet” — MOJ POMIAR TO OBALIL.
#   Podejrzanych jest 30 z 105 (2 ksztaltu A + 28 hybryd). ZMIERZ TO SAM I PODAJ SWOJA LICZBE.

# (3) KSZTALT A W SZERSZYM ZAKRESIE — TU SA FALSZYWE ALARMY
bash -c "grep -rnE \"isPolish [?] '([^']*)' : '\\1'\" src/components/DiscoveryTools src/toolPacks"
#   moje trafienia: 4, z czego DWA UZASADNIONE — ContextStep.tsx:674 (separator ', ')
#   i toolSessionDetailsBuilder.ts:167 ('Status'). ★ To jest powod, dla ktorego bezpiecznik
#   MUSI miec liste uzasadnien, a nie sam wzorzec. W calym `src/` ksztalt A daje u mnie 77 —
#   dlatego bramka na ZERZE nigdy nie moglaby przejsc, i ma miec RATCHET.

# (4) ZRODLO PRAWDY: polskie nazwy sa w paczkach, nie do wymyslenia
bash -c "grep -nE \"title: [{] pl:\" src/toolPacks/packs/dynamicSwot.pack.ts"
#   oczekiwane 7 wierszy: 101 'Misja i kontekst' · 112 'Wejscie i eksploracja' · 123 'Budowa SWOT'
#   · 134 'Synteza i napiecia' · 145 'Wyniki i dzialania' · 307 'Rekomendacje' · 315 'Przeglad'
ls src/toolPacks/packs/ | wc -l
#   moja liczba: 19 paczek

# (5) ★★ KAFLE NIE SA ZA FLAGA — bramkuje je TYP NARZEDZIA
bash -c "grep -n \"toolType === 'dynamic-swot'\" src/components/DiscoveryTools/ToolDocumentView.tsx"
#   oczekiwane: 521, 529, 534, 1210, 1255 — ZERO odwolan do flagi funkcyjnej.
#   ★ Po scaleniu te etykiety widzi KAZDY. To nie jest praca „za flaga OFF do akceptu”.

# (6) LISTA UZASADNIONYCH IDENTYCZNOSCI JUZ ISTNIEJE — importujesz, NIE kopiujesz
bash -c "grep -n 'export function justification\|export function polishTextReason\|allowedPolishNames' scripts/dev/i18n-pl-audyt.mjs"
#   oczekiwane: obie funkcje EKSPORTOWANE. ★★ Ten skrypt audytuje LISCIE translation.json,
#   NIE ternary w kodzie — wiec nie uruchomisz go „tak po prostu”. Masz z niego ZAIMPORTOWAC
#   `justification`. Kopia listy = drugi rejestr, a dwa rejestry mierza rozjazd.

# (7) EKRAN I NARZEDZIE ZRZUTOWE ISTNIEJA
bash -c "grep -n \"tools-swot-session-workspace\" dev-render/main.tsx"
#   oczekiwane: 293 (lazy import) i 1890 (wpis w SCREENS)
bash -c "grep -n \"arg('zlicz'\|arg('porownaj-z'\|arg('base'\|arg('wynik-json'\" scripts/dev/grafika-zrzuty.mjs"
#   oczekiwane: --base (DOMYSLNIE 3020 — NIE TWOJ PORT!), --zlicz (DEC-387), --porownaj-z, --wynik-json

# (8) BRAMKI I LISCIE SLOWNIKOW — maja pozostac IDENTYCZNE przed i po
node -e 'const f=require("fs");function c(o){let n=0;const w=v=>{if(v&&typeof v==="object"){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ["pl","en"])console.log(l,c(JSON.parse(f.readFileSync("public/locales/"+l+"/translation.json","utf8"))));'
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
#   moje liczby: pl 35199, en 33066 (★ NIE 35198/33065 — te ze zlecenia sa o dzien stare;
#   sprawdzilem to takze prosto z obiektu commita); focus=0, list=0, artefakt=0, reach=0
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day354-etykiety-narzedzi-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6413`. Twój JEDYNY port harnessu to `5553`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day354-pg`**. **ZAKAZANE:** `Zakazane na stale: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta restricted ports Chromium. Zajęte przez hosta i tor grafiki: 3020, 3022, 3025, 3027, 3030, 5432, 5433, 6012, 6379 — ★★ **TO JEST WAŻNE WŁAŚNIE DLA CIEBIE: kanoniczny harness `dev-render` słucha domyślnie na 3020 i ten port NIE JEST TWÓJ.** Swój harness Vite podnosisz na **5553** (`--port 5553 --strictPort`) i **każde** wywołanie narzędzia zrzutowego dostaje `--base=http://127.0.0.1:5553`. Zapomnienie tego parametru zrobi zrzut CUDZEGO ekranu i po obrazku tego nie poznasz. Rodzeństwo TEJ paczki (04.09 wieczór) — nie dotykasz: 351 (6410/5550), 352 (6411/5551), 353 (6412/5552). ★★ RÓWNOLEGLE pisane są instrukcje 355-358 przez innego autora; ich portów NIE ZNAM w chwili pisania, więc obowiązuje reguła twarda: **bierzesz WYŁĄCZNIE swoje dwa porty i żaden inny**, a port zajęty jest powodem do STOP-u całości (`Z7`), nigdy do podmiany numeru. Wcześniejsze rodzeństwo 04.09: 343-346 (6390-6393 / 5530-5533), 347 (6394/5534), 348 (6395/5535), 349 (6396/5536), 350 (6397/5537). Twoje własne wyłącznie: baza 6413, harness 5553. ★ ZAKAZ `pkill`/`killall` — zapisz `$!` po starcie Vite i zabij WYŁĄCZNIE swój PID`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `BRAK — i to jest **najważniejsza informacja o ryzyku tego dyżuru**. Kafle etapów są bramkowane wyłącznie `toolType === 'dynamic-swot'` (`ToolDocumentView.tsx`, pięć miejsc), **a NIE flagą funkcyjną**. Oznacza to, że każda etykieta, którą tu poprawisz albo popsujesz, wchodzi na żywo dla wszystkich użytkowników natychmiast po scaleniu. ★★ **Nie zakładasz nowej flagi** — to byłaby zmiana architektury poza zakresem; **opisujesz stan zastany jako ryzyko w raporcie** (`R5` punkt 7). ★ Ten dyżur nie dodaje, nie zmienia i nie przełącza ANI JEDNEJ flagi`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh --ci`, `scripts/check-artefakt.sh`, `scripts/check-triada.sh`, `scripts/check-gestosc.sh`, `scripts/dev/reachability-from-root.mjs`, `scripts/dev/i18n-pl-audyt.mjs`, `.husky/pre-commit`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `.github/workflows/**`, `scripts/dev/grafika-zrzuty.mjs` oraz `scripts/dev/lib/checkScreenshotPairState.mjs`. Wszystkie NIETYKALNE DO ZAPISU — wolno je wołać w pomiarze. ★★ DWA WYJĄTKI, obydwa jawnie licencjonowane przez tę instrukcję: **(1)** `.husky/pre-commit` — dopisanie JEDNEGO nowego bloku dla nowego bezpiecznika, wzorowanego na blokach `check-list-canon` (wiersz ~9) i `check-artefakt` (wiersz ~20); zakaz zmiany bloków istniejących. **(2)** `scripts/dev/check-etykiety-dwujezyczne.mjs` — NOWY plik, Twój produkt. ★ `scripts/dev/i18n-pl-audyt.mjs` **importujesz, nie zmieniasz**. ★★ Każde wywołanie bramki zapisujesz z kodem wyjścia ORAZ z liczbą zbadanych obiektów — bramka, która przeszła, bo nic nie zmierzyła, nie jest wynikiem`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY354_ETYKIETY_NARZEDZI_REPORT.md`. Jedyny inny dokument do zmiany: **jedna nowa sekcja** w `docs/program/REJESTR_ZNALEZISK_20260903.md` o PIERWSZEJ WOLNEJ literze — sekcje idą dziś do `Q`, ale równolegle dopisuje inny autor, więc literę sprawdzasz komendą `bash -c "grep -nE '^## [A-Z][.]' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"` TUŻ PRZED commitem, nigdy z góry. **Nie zmieniasz żadnego `MODULE_ACCEPTANCE.md`** (teren dyżuru 353) ani niczego w `public/locales/**` — ten dyżur poprawia literały w KODZIE, a liście słowników mają zostać `35199`/`33066`. ★★ WSZYSTKIE zrzuty i logi idą do `evidence/etykiety-narzedzi-20260904/` (katalog NIE ISTNIEJE na markerze — tworzysz go) z `git add -f`; ta instrukcja daje na to jawną licencję, więc „zakaz binariów w repo” byłby wymyślonym powodem (04.09 zdarzyło się to CZTERY RAZY i za każdym razem trzeba było ratować dowody z katalogów tymczasowych). Nowe testy idą do `tests/unit/i18n/`, **NIGDY pod `src/`**, i też wymagają `git add -f`. Plik postępu `/private/tmp/cx-day354-postep.md` żyje POZA repo. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day354-etykiety-narzedzi-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day354-etykiety-narzedzi-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ TŁUMACZENIA NA WŁASNĄ RĘKĘ TAM, GDZIE NAZWA ISTNIEJE W PACZCE.** Źródłem prawdy są `title: { pl, en }` w `src/toolPacks/packs/*.pack.ts` — to samo źródło, które zasila lewe drzewo. Etykieta wymyślona przez wykonawcę rozjedzie kafel z drzewem i defekt wróci w innym kształcie. Gdzie nazwy w paczce NIE MA — **oznaczasz jako PROPOZYCJĘ DO AKCEPTU**, nie wprowadzasz po cichu. ★★★ **ZAKAZ TŁUMACZENIA TEGO, CO MA ZOSTAĆ IDENTYCZNE** — marki, akronimy (`SWOT`, `KPI`, `ROI`), „Status”, „Tempo”, separatory, placeholdery. Lista uzasadnionych identyczności jest zbudowana w `scripts/dev/i18n-pl-audyt.mjs` i **to ona rozstrzyga**, nie Twoje wyczucie. ★★★ **ZAKAZ ZMIANY PACZEK** `src/toolPacks/packs/**` — są tylko do odczytu; zmiana paczki zmieniłaby też lewe drzewo. ★★★ **ZAKAZ BEZPIECZNIKA NA ZERZE.** Kształt A daje dziś w całym `src/` 77 trafień; bramka wymagająca zera byłaby bramką, która NIGDY nie mogła przejść, a czerwień przypisałaby się produktowi. Ma być RATCHET z baseline'em **i PODŁOGA LICZEBNOŚCI** — zero zbadanych obiektów to CZERWIEŃ, nie zieleń. ★★ **ZAKAZ KOPIOWANIA LISTY UZASADNIEŃ** — importujesz z `i18n-pl-audyt.mjs`; kopia to drugi rejestr, a dwa rejestry mierzą rozjazd. ★★ **ZAKAZ ZMIANY `public/locales/**`, JAKIEGOKOLWIEK `MODULE_ACCEPTANCE.md`, `grafika-zrzuty.mjs` I `checkScreenshotPairState.mjs`.** ★★ **ZAKAZ OSŁABIANIA ISTNIEJĄCYCH ASERCJI** w `tests/unit/tools/dynamicSwotPhaseOverview.render.test.tsx` (184 wiersze z dyżuru 344) — rozszerzasz je, nie rozluźniasz. ★★ **ZAKAZ POŁĄCZENIA DO STAGINGU, DEMO I PRODUKCJI W KAŻDĄ STRONĘ** (`Z28`). ★ **ZAKAZ `pkill`/`killall`, `git stash`, `git push`, `git fetch --all` oraz scalania czegokolwiek** | Bo naprawa per-zgłoszenie daje „poprawne w dwóch z trzech”, a naprawa per-wywołanie odrasta: defekt zalatany w jednym module wrócił po ośmiu tygodniach w dwunastu plikach. Dyżur 344 naprawił sześć etykiet — te, które akurat były widoczne na jednym kadrze. W tym samym pliku zostaje ich więcej, w tej samej rodzinie zostaje ich jeszcze więcej, i **każda z nich wejdzie na żywo dla wszystkich**, bo kafle nie są za flagą. ★ Drugi powód jest ważniejszy od pierwszego: to jest kształt „klucz istnieje ≠ przetłumaczony”. Audyt liczący ISTNIENIE gałęzi polskiej melduje „przetłumaczone”, gdy ta gałąź trzyma angielskie słowo. Dlatego produktem tego dyżuru nie jest lista poprawek, tylko **bezpiecznik z dowodem mutacyjnym w obie strony** — żeby nikt nie musiał tego oglądać oczami po raz trzeci |

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
cd /private/tmp/cx-day354-etykiety-narzedzi

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day354-pg psql -U postgres -d cx354 \
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
cd /private/tmp/cx-day354-etykiety-narzedzi

docker run -d --name cx-day354-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx354 \
  -p 127.0.0.1:6413:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day354-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6413/cx354 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6413/cx354 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day354-etykiety-narzedzi && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6413/cx354 \
JWT_SECRET=cx354-test-secret-do-not-reuse-min-32-znaki \
npx vitest run Jednostkowe front, z roota, wariant (C) `RUN_DB_TESTS=0 MOCK_DB=true`, ścieżki `tests/unit/tools tests/unit/i18n` — **uruchamiasz, żeby udowodnić brak regresji**, i **nie naprawiasz** tego, co czerwone z powodów spoza tego dyżuru. Nowe testy tego dyżuru kładziesz w `tests/unit/i18n/`, **NIGDY pod `src/`**, z `git add -f`. **Każdy przelot z `--retry=0` i `--reporter=json --outputFile=<plik w ARTEFAKTY>`; podajesz `numTotalTests`. Przelot z zerem wykonanych przypadków kończy się `exit 0` i NIE JEST POMIAREM. `No test files found` oraz `Transform failed` to BŁĄD KOMENDY, nie `PASS`.** ★ Po każdej partii poprawek: `npx esbuild <zmienione pliki> --outdir=/dev/null` — `Transform failed` traktujesz jako błąd komendy, nie jako „brak zmian”. ★ Na koniec `node scripts/dev/reachability-from-root.mjs --check-baseline` musi dać `0` --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day354-etykiety-narzedzi-artefakty/day354-etykiety-narzedzi.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day354-etykiety-narzedzi && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run Jednostkowe front, z roota, wariant (C) `RUN_DB_TESTS=0 MOCK_DB=true`, ścieżki `tests/unit/tools tests/unit/i18n` — **uruchamiasz, żeby udowodnić brak regresji**, i **nie naprawiasz** tego, co czerwone z powodów spoza tego dyżuru. Nowe testy tego dyżuru kładziesz w `tests/unit/i18n/`, **NIGDY pod `src/`**, z `git add -f`. **Każdy przelot z `--retry=0` i `--reporter=json --outputFile=<plik w ARTEFAKTY>`; podajesz `numTotalTests`. Przelot z zerem wykonanych przypadków kończy się `exit 0` i NIE JEST POMIAREM. `No test files found` oraz `Transform failed` to BŁĄD KOMENDY, nie `PASS`.** ★ Po każdej partii poprawek: `npx esbuild <zmienione pliki> --outdir=/dev/null` — `Transform failed` traktujesz jako błąd komendy, nie jako „brak zmian”. ★ Na koniec `node scripts/dev/reachability-from-root.mjs --check-baseline` musi dać `0` --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day354-etykiety-narzedzi-artefakty/day354-etykiety-narzedzi.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day354-etykiety-narzedzi/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day354-pg psql -U postgres -d cx354 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day354-pg`.
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
> **(e) ★★★ **SZEŚĆ PUŁAPEK TEGO DYŻURU.** **(1) Klucz istnieje ≠ przetłumaczony.** Gałąź polska ISTNIEJE we wszystkich 105 ternary badanego pliku — i w 30 z nich trzyma angielskie słowo. Audyt liczący istnienie gałęzi zamelduje „100% przetłumaczone”. Licznik ma porównywać TREŚĆ obu gałęzi, nie ich obecność. **(2) `grep --include` w `zsh` zwraca pustkę zamiast wyników** — trafiło to trzy razy jednego dnia i raz zostało zacommitowane jako fałsz. **Pustka nie jest wynikiem, dopóki nie sprawdzisz, że polecenie się wykonało.** Wszystkie grepy przez `bash -c` z cudzysłowami. **(3) Bezpiecznik nagradza defekt.** Para zrzutów przechodzi kontrolę jasności tym łatwiej, im MNIEJSZA zmiana — a zmiana pięciu napisów prawie nie zmienia luminancji. Próg `150` w `checkScreenshotPairState.mjs` jest tu BEZUŻYTECZNY; dowodem jest **mechaniczne zliczenie przez `--zlicz`** (`DEC-387`), nie obrazek. **(4) Przyrząd pokazuje nie produkt.** 3 z 6 „defektów” jednego dnia okazało się hostem harnessu. Porównaj łańcuch przodków kafla w `dev-render` i w realnej trasie; różnicę zapisz jako granicę dowodu. **Harness nie jest produktem** — zmiana ekranu jest ostatecznością i wymaga uzasadnienia w raporcie. **(5) Duplikat zamiast motywu.** Para light/dark bywa tym samym obrazem pod dwiema nazwami. **Suma kontrolna KAŻDEGO z czterech plików idzie do raportu.** **(6) Brak pomiaru nie jest wynikiem.** Bezpiecznik przechodzi, gdy wejście jest puste, gdy nikt go nie poprosił, albo gdy ginie na ścieżce macOS przed pierwszym pomiarem — bramka CI już raz zginęła w ten sposób i czerwień przypisała się produktowi. Dlatego Twój bezpiecznik **MUSI wypisywać liczbę zbadanych plików i ternary, i czerwienieć przy zerze****
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day354-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day354-etykiety-narzedzi-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (**KROK 0** — inwentarz CAŁEJ rodziny własnym licznikiem, rozdzielenie kształtu A od hybryd, klasyfikacja DEFEKT / UZASADNIONA IDENTYCZNOŚĆ / PROPOZYCJA, wskazanie źródła nazwy w paczce) · R2 (**bezpiecznik PRZED naprawą** — ratchet, podłoga liczebności, import listy uzasadnień, rejestracja w hooku, **TRZY dowody mutacyjne w obie strony**) · R3 (naprawa rodziny: kształt A, potem hybrydy, nazwy z paczek, rozszerzenie testu kafli) · R4 (para zrzutów light+dark z **mechanicznym zliczeniem** i sumami kontrolnymi, kadr z drzewem I kaflami jednocześnie) · R5 (raport, sekcja rejestru, **lista PROPOZYCJI do akceptu**). **Commit po KAŻDEJ pozycji `R`**`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6413` albo `5553` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6413` albo `5553`** (`Z7`).

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

Dyżur 344 zbudował kafle etapów w narzędziu fazowym `dynamic-swot`. Odbiór zaliczył je
technicznie (OFF 5/5, ON 7/7, zero crimsona, zero błędów konsoli) i **mimo to wydał werdykt
NIE POKAZYWAĆ WŁAŚCICIELOWI**, z jednego powodu: na kadrze polskie drzewo po lewej
(„Misja i kontekst", „Budowa SWOT") stało obok **angielskich kafli**. Przyczyna była
w `src/components/DiscoveryTools/toolCompletion.ts`:

```
label: isPolish ? 'Mission & Context' : 'Mission & Context'
```

**Angielski w OBU gałęziach warunku języka.** Pięć takich etykiet plus hybryda
`'Przygotuj final source summary'`. Nadzorca naprawił sześć, biorąc polskie nazwy
z `src/toolPacks/packs/dynamicSwot.pack.ts`, gdzie każda faza ma `title: { pl, en }` —
**to samo źródło, które zasila lewe drzewo** (commit `c0f690bae3`).

★★ **Dyżur 344 tego defektu nie stworzył — ODSŁONIŁ go.** Do tej pory kafli renderowało się
zero, więc nikt nigdy nie zobaczył ich etykiet. To jest kształt „zbudowane, ale
niepodłączone": właściwa rzecz siedziała w kodzie, brakowało ostatniego przewodu — a gdy
przewód wpięto, wyszło na jaw, że rzecz jest po angielsku.

★★★ **I to nie jest za flagą.** Kafle są bramkowane wyłącznie `toolType === 'dynamic-swot'`
(`src/components/DiscoveryTools/ToolDocumentView.tsx`, wiersze `521`, `529`, `534`, `1210`,
`1255`) — **nie flagą**. Po scaleniu wchodzą na żywo dla wszystkich.

### ★ Co robi ten dyżur

Nie siódmą łatkę. **Całą rodzinę** — bo naprawa per-zgłoszenie daje „poprawne w dwóch
z trzech", a naprawa per-wywołanie odrasta (defekt zalatany w jednym module wrócił po ośmiu
tygodniach w dwunastu plikach). Plus **bezpiecznik, który nie pozwoli tej rodzinie odrosnąć**,
z dowodem mutacyjnym **w obie strony**: że łapie prawdziwy defekt **i** że nie czerwieni się
na uzasadnionych identycznościach.

---

## ★★★ SPROSTOWANIE ZLECENIA — liczba „~73 podejrzanych etykiet" jest OBALONA

Zlecenie, z którego powstała ta instrukcja, mówiło: *„w tym samym pliku zostaje jeszcze
ok. 73 podejrzanych etykiet tego kształtu"*. **Zmierzyłem to na markerze `29fcbd4de2`
i liczba jest inna.** Napisałem własny licznik, który parsuje ternary `isPolish ? 'X' : 'Y'`
i rozdziela dwa **różne** kształty defektu:

| Zakres | Plików | Ternary `isPolish` z dwoma literałami | **Obie gałęzie IDENTYCZNE** | **HYBRYDY** (gałąź PL zawiera angielskie słowo obecne też w gałęzi EN) |
| --- | --- | --- | --- | --- |
| `src/components/DiscoveryTools/toolCompletion.ts` | 1 | **105** | **2** | **28** |
| `src/components/DiscoveryTools/` + `src/toolPacks/` | 162 | **256** | **4** | **38** |
| całe `src/` | 4814 | **3756** | **77** | **258** |

**W badanym pliku podejrzanych etykiet jest `30` (2 + 28), nie `73`** — z `105` ternary,
a nie z `73`. ★ Podejrzewam, skąd wzięła się liczba `73`: `105` ternary minus `~32` już
poprawnych. **To jest zgadywanie, nie pomiar. Zmierz to sam i podaj SWOJĄ liczbę.**

### Dwa różne kształty — nie myl ich

**KSZTAŁT A — obie gałęzie identyczne.** Dwa wystąpienia w badanym pliku, oba prawdziwe:

```
toolCompletion.ts:654   label: isPolish ? 'Portfolio mission' : 'Portfolio mission',
toolCompletion.ts:692   label: isPolish ? 'Risk mission'      : 'Risk mission',
```

★★ **W szerszym zakresie ten sam wzorzec daje FAŁSZYWE ALARMY** i to jest ważne dla
konstrukcji bezpiecznika:

```
src/components/DiscoveryTools/steps/ContextStep.tsx:674            ', '      ← separator, NIE etykieta
src/components/DiscoveryTools/toolSessionDetailsBuilder.ts:167     'Status'  ← UZASADNIONA identyczność
```

**KSZTAŁT B — hybryda.** Gałąź polska zawiera angielski rdzeń. To jest kształt, który
zlecenie nazwało „linia ~519", i on rzeczywiście tam jest:

```
toolCompletion.ts:519   isPolish ? 'Mission zdefiniowana'          : 'Mission defined'
toolCompletion.ts:298   isPolish ? 'Brak mission brief'            : 'Missing mission'
toolCompletion.ts:317   isPolish ? 'Brak final source summary'     : 'Missing final source summary'   (×5 w pliku)
toolCompletion.ts:552   isPolish ? 'Final source summary gotowe'   : 'Final source summary ready'     (×5 w pliku)
toolCompletion.ts:375   isPolish ? 'Brak growth mission'           : 'Missing growth mission'
toolCompletion.ts:410   isPolish ? 'Brak portfolio mission'        : 'Missing portfolio mission'
toolCompletion.ts:418   isPolish ? 'Brak trade-offów portfolio'    : 'Missing portfolio trade-offs'
toolCompletion.ts:492   isPolish ? 'Brak pomiaru baseline'         : 'Missing baseline measurement'
toolCompletion.ts:495   isPolish ? 'Brak re-estymacji target'      : 'Missing target re-estimation'
```

★ **`SWOT` jest uzasadnioną identycznością** (akronim branżowy) — `'Brak kart SWOT'` i
`'Budowa SWOT'` **nie są defektem**. Mój licznik je łapie, bo jest prosty; Twój ma je
odsiać przez listę uzasadnień (patrz `R2`).

★ **Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.**

---

## ★ Zmierz moje liczby sam

```bash
cd /private/tmp/cx-day354-etykiety-narzedzi

# (a) surowe liczby w badanym pliku
wc -l < src/components/DiscoveryTools/toolCompletion.ts
bash -c "grep -c 'isPolish' src/components/DiscoveryTools/toolCompletion.ts"
bash -c "grep -oE \"isPolish [?] '[^']*' : '[^']*'\" src/components/DiscoveryTools/toolCompletion.ts | wc -l"
#   moje liczby: 787 linii, 125 wystapien `isPolish`, 105 ternary z dwoma literalami

# (b) KSZTALT A — obie galezie identyczne (backreferencja w grep -E)
bash -c "grep -nE \"isPolish [?] '([^']*)' : '\\1'\" src/components/DiscoveryTools/toolCompletion.ts"
#   moje trafienia: 654 ('Portfolio mission'), 692 ('Risk mission') — DWA, nie 73

# (c) KSZTALT A w szerszym zakresie — TU SA FALSZYWE ALARMY
bash -c "grep -rnE \"isPolish [?] '([^']*)' : '\\1'\" src/components/DiscoveryTools src/toolPacks"
#   moje trafienia: 4, z czego DWA sa uzasadnione — ContextStep.tsx:674 (separator ', ')
#   i toolSessionDetailsBuilder.ts:167 ('Status'). To jest powod, dla ktorego bezpiecznik
#   MUSI miec liste uzasadnien, a nie tylko wzorzec.

# (d) ZRODLO PRAWDY: polskie nazwy faz sa w paczce, nie do wymyslenia
bash -c "grep -nE \"title: [{] pl:\" src/toolPacks/packs/dynamicSwot.pack.ts"
#   oczekiwane 7 wierszy: 101 'Misja i kontekst' · 112 'Wejscie i eksploracja' · 123 'Budowa SWOT'
#   · 134 'Synteza i napiecia' · 145 'Wyniki i dzialania' · 307 'Rekomendacje' · 315 'Przeglad'
ls src/toolPacks/packs/ | wc -l
#   moja liczba: 19 paczek

# (e) KAFLE NIE SA ZA FLAGA — sa bramkowane typem narzedzia
bash -c "grep -n \"toolType === 'dynamic-swot'\" src/components/DiscoveryTools/ToolDocumentView.tsx"
#   oczekiwane: 521, 529, 534, 1210, 1255 — ZERO odwolan do flagi.
#   ★ Po scaleniu te etykiety widzi KAZDY uzytkownik. To nie jest praca „za flaga OFF”.

# (f) LISTA UZASADNIONYCH IDENTYCZNOSCI JUZ ISTNIEJE — nie pisz jej od nowa
bash -c "grep -n 'export function justification\|export function polishTextReason\|allowedPolishNames' scripts/dev/i18n-pl-audyt.mjs"
#   oczekiwane: `justification` i `polishTextReason` sa EKSPORTOWANE (wiersze ~118 i ~108).
#   ★★ Ten skrypt audytuje LISCIE translation.json, NIE ternary w kodzie — wiec nie mozesz go
#   po prostu uruchomic. Masz z niego ZAIMPORTOWAC `justification`, nie skopiowac jej.

# (g) EKRAN I NARZEDZIE ZRZUTOWE ISTNIEJA
bash -c "grep -n \"tools-swot-session-workspace\" dev-render/main.tsx"
#   oczekiwane: 293 (lazy import) i 1890 (wpis w SCREENS)
bash -c "grep -n \"arg('zlicz'\|arg('porownaj-z'\|arg('base'\" scripts/dev/grafika-zrzuty.mjs"
#   oczekiwane: --base (domyslnie 3020 — NIE TWOJ PORT), --zlicz (DEC-387), --porownaj-z

# (h) BRAMKI I LISCIE SLOWNIKOW
node -e 'const f=require("fs");function c(o){let n=0;const w=v=>{if(v&&typeof v==="object"){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ["pl","en"])console.log(l,c(JSON.parse(f.readFileSync("public/locales/"+l+"/translation.json","utf8"))));'
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
#   moje liczby: pl 35199, en 33066 (★ NIE 35198/33065 — te ze zlecenia sa o dzien stare);
#   focus=0, list=0, artefakt=0, reach=0.
#   ★ Liscie slownikow maja pozostac IDENTYCZNE — ten dyzur poprawia literaly w kodzie,
#   nie dotyka `public/locales/**`.
```

---

## B.1. TABELA LICENCJI — CAŁA ŚCIEŻKA: ŹRÓDŁO NAZW · LOGIKA · WIDOK · HARNESS · TESTY · BEZPIECZNIK

| Warstwa | Ścieżka | Licencja | Produkt |
| --- | --- | --- | --- |
| **źródło prawdy nazw** | `src/toolPacks/packs/*.pack.ts` (19 paczek, każda z `title: { pl, en }`) | **★ TYLKO ODCZYT.** Nazwy bierzesz stąd — **nie tłumaczysz na własną rękę, gdy nazwa istnieje w paczce**. Zmiana paczki zmieniłaby też lewe drzewo i wyszłaby poza zakres | mapa „etykieta → `title.pl` z paczki" |
| **logika kompletności** | `src/components/DiscoveryTools/toolCompletion.ts` (787 linii, 105 ternary) | **ZAPIS** — rdzeń naprawy | poprawione literały |
| **rodzeństwo — reszta rodziny** | `src/components/DiscoveryTools/**` (162 pliki w zakresie z `src/toolPacks/`) | **ZAPIS** — ale wyłącznie literały etykiet; ★ **KROK 0 to wypisanie rodzeństwa**, praca per-zgłoszenie daje „poprawne w 2 z 3" | lista rodzeństwa + poprawki |
| **widok kafli** | `src/components/DiscoveryTools/ToolDocumentView.tsx` (`521`, `529`, `534`, `1210`, `1255`) | **TYLKO ODCZYT** — ustalasz, że kafle **nie są za flagą**, i zapisujesz to zdaniem w raporcie | zdanie o bramkowaniu |
| **lista uzasadnionych identyczności** | `scripts/dev/i18n-pl-audyt.mjs` (`justification`, `polishTextReason`, `allowedPolishNames`) | **TYLKO ODCZYT + IMPORT.** ★ **Zakaz kopiowania listy** — bezpiecznik ma ją **importować**, żeby jedna zmiana listy działała w obu miejscach | import, nie kopia |
| **nowy bezpiecznik** | `scripts/dev/check-etykiety-dwujezyczne.mjs` (**NOWY**) | **ZAPIS** — wzorzec „obie gałęzie warunku języka identyczne", z ratchetem i podłogą liczebności | skrypt + baseline |
| **rejestracja bezpiecznika** | `.husky/pre-commit` | **★ WĄSKA — dopisanie JEDNEGO bloku wzorowanego na blokach `check-list-canon`/`check-artefakt`.** Zakaz zmiany istniejących bloków | jeden blok |
| **testy bezpiecznika** | `tests/unit/i18n/**` (**NIGDY pod `src/`**) | **ZAPIS**, `git add -f` — test łapania defektu **i** test braku fałszywego alarmu | dwa testy |
| **test regresyjny kafli** | `tests/unit/tools/dynamicSwotPhaseOverview.render.test.tsx` (istnieje, 184 wiersze, z dyżuru 344) | **ZAPIS** — rozszerzasz o asercję polskich etykiet; ★ **zakaz osłabiania istniejących asercji** | rozszerzony test |
| **ekran harnessu** | `dev-render/screens/tools-swot-session-workspace.tsx` (`dev-render/main.tsx:293`, `:1890`) | **ZAPIS WARUNKOWY** — tylko jeżeli `R4` udowodni, że inaczej nie da się zrobić pary zrzutów; ★ **harness nie jest produktem** | ewentualna zmiana + uzasadnienie |
| **narzędzie zrzutowe** | `scripts/dev/grafika-zrzuty.mjs`, `scripts/dev/lib/checkScreenshotPairState.mjs` | **NIETYKALNE DO ZAPISU** — wolno wołać z `--base`, `--zlicz`, `--porownaj-z` | para zrzutów + zliczenia |
| **słowniki** | `public/locales/**` | **★ ZAKAZ ZAPISU.** Ten dyżur poprawia literały w kodzie; liście mają zostać `35199`/`33066` | liczby identyczne przed i po |
| **dowody** | `evidence/etykiety-narzedzi-20260904/**` (**NOWY**) | **ZAPIS, `git add -f`** — jawna licencja na zrzuty i logi | wszystkie artefakty |
| **raport** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY354_ETYKIETY_NARZEDZI_REPORT.md` | **ZAPIS (główny produkt)** | raport |
| **rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **★ WĄSKA — jedna nowa sekcja o pierwszej wolnej literze** | jedna sekcja |
| **macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` | **★ ZAKAZ ZAPISU** — teren dyżuru 353 | — |
| **bramki zastane** | `scripts/check-*.sh`, `tests/setup.ts`, `tests/helpers/**`, `vitest*.config.ts`, `.github/workflows/**` | **NIETYKALNE DO ZAPISU** | kody wyjścia + liczba zbadanych obiektów |

---

## B.2. TABELA POZYCJI

| Poz. | Co robi | Rdzeń? | Wykonalne bez pliku przekrojowego? | Commit |
| --- | --- | --- | --- | --- |
| `R1` | **KROK 0** — inwentarz CAŁEJ rodziny z własnym licznikiem i klasyfikacją | TAK | TAK — sam pomiar | **TAK** |
| `R2` | bezpiecznik + jego dwa testy + rejestracja w hooku | TAK | TAK — nowy plik + jeden blok w hooku | **TAK** |
| `R3` | naprawa rodziny: kształt A, potem kształt B, nazwy z paczek | TAK | TAK — literały w ciałach funkcji | **TAK** |
| `R4` | para zrzutów z **mechanicznym** zliczeniem polskich kafli | TAK | TAK — harness na własnym porcie | **TAK** |
| `R5` | raport, sekcja rejestru, lista propozycji do akceptu | — | TAK | **TAK** |

★ **Commit po KAŻDEJ pozycji `R`.**

---

## B.3. TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | linie `toolCompletion.ts` | `787` | `(a)` | TAK |
| 2 | wystąpienia `isPolish` w pliku | `125` | `(a)` | TAK |
| 3 | ternary z dwoma literałami w pliku | `105` | `(a)` | TAK |
| 4 | kształt A w pliku | `2` | `(b)` | TAK — ★ **zlecenie mówiło „~73"; OBALONE** |
| 5 | kształt B (hybrydy) w pliku | `28` | licznik własny (`R1`) | TAK |
| 6 | podejrzane razem w pliku | `30` z `105` | `4` + `5` | TAK |
| 7 | kształt A w `DiscoveryTools`+`toolPacks` | `4`, z czego **2 uzasadnione** | `(c)` | TAK — ★ to jest dowód, że sam wzorzec nie wystarczy |
| 8 | kształt A w całym `src/` | `77` | licznik własny | TAK — ★ dlatego bezpiecznik ma **ratchet**, nie zero |
| 9 | hybrydy w całym `src/` | `258` | licznik własny | TAK — ★ **poza zakresem tego dyżuru**, do raportu |
| 10 | paczki narzędzi | `19` | `(d)` | TAK |
| 11 | tytuły faz w `dynamicSwot.pack.ts` | `7` | `(d)` | TAK |
| 12 | miejsc bramkowania kafli typem, nie flagą | `5` | `(e)` | TAK |
| 13 | naprawionych etykiet | — | `R3`, licznik własny | TAK — **to jest próg odbioru** |
| 14 | liście słowników i bramki | `35199`/`33066`, cztery `0` | `(h)` | TAK — identyczne przed i po |

---

## B.4. TABELA ROZŁĄCZNOŚCI

### B.4.1. Pliki zapisywane NA PEWNO

`src/components/DiscoveryTools/toolCompletion.ts` · `scripts/dev/check-etykiety-dwujezyczne.mjs`
(**NOWY**) · `.husky/pre-commit` (jeden blok) · `tests/unit/i18n/**` (**NOWE**, `git add -f`) ·
`tests/unit/tools/dynamicSwotPhaseOverview.render.test.tsx` (rozszerzenie) ·
`evidence/etykiety-narzedzi-20260904/**` (**NOWY**, `git add -f`) · raport · jedna sekcja rejestru.

### B.4.2. Pliki zapisywane WARUNKOWO

Pozostałe pliki w `src/components/DiscoveryTools/**` i `src/toolPacks/**` — **tylko te,
dla których `R1` wykaże defekt**, i tylko w zakresie literału etykiety ·
`dev-render/screens/tools-swot-session-workspace.tsx` — tylko jeżeli `R4` udowodni, że
inaczej nie da się zrobić pary, z uzasadnieniem w raporcie.

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

`public/locales/**` · żaden `MODULE_ACCEPTANCE.md` (teren 353) · `server/src/**` ·
`scripts/dev/grafika-zrzuty.mjs` · `scripts/dev/lib/checkScreenshotPairState.mjs` ·
`scripts/dev/i18n-pl-audyt.mjs` (★ **importujesz, nie zmieniasz**) · `scripts/check-*.sh` ·
`docs/ui-standards/**` · pliki dyżurów 351, 352, 353 ani 355–358.

★ Plik postępu `/private/tmp/cx-day354-postep.md` żyje **poza repo**.

### B.4.4. Zasoby wyłączne

Baza **6413**, runtime **5553**, kontener **`cx-day354-pg`**, baza **`cx354`**,
worktree `/private/tmp/cx-day354-etykiety-narzedzi`,
gałąź `codex/day354-etykiety-narzedzi-20260904`.
Sprawdziłem 04.09: porty wolne, kontener nie istnieje, worktree nie istnieje, gałąź nie istnieje.

★★ **Kanoniczny harness `dev-render` słucha domyślnie na `3020` i ten port NIE JEST TWÓJ.**
Swój Vite podnosisz na **5553** i **każde** wywołanie narzędzia zrzutowego dostaje
`--base=http://127.0.0.1:5553`. Zapomnienie tego parametru zrobi zrzut **cudzego** ekranu
i nie zobaczysz tego po obrazku.

★★ **Port zajęty = STOP CAŁOŚCI (`Z7`), NIGDY podmiana numeru.**

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
git status --short                       # zero plikow spoza B.4.1/B.4.2
git diff --cached -- public/locales       # PUSTY
bash -c "grep -rnE '^(<{7}|>{7}|={7})' $(git diff --cached --name-only)"   # zero znacznikow konfliktu
node scripts/dev/check-etykiety-dwujezyczne.mjs; echo "etykiety=$?"        # 0 + liczba zbadanych
npx esbuild $(git diff --cached --name-only -- 'src/**/*.ts' 'src/**/*.tsx') --outdir=/dev/null 2>&1 | tail -3
#   ★ `Transform failed` to BLAD KOMENDY, nie „brak zmian”
```

---

## R1 — KROK 0: INWENTARZ CAŁEJ RODZINY (rdzeń)

★★ **Zanim naprawisz cokolwiek, wypisz rodzeństwo.** Praca per-zgłoszenie daje „poprawne
w dwóch z trzech" i to jest błąd zlecającego, nie wykonawcy — dlatego ta pozycja jest
pierwsza i ma własny commit.

1. **Napisz własny licznik** (może żyć w `scripts/dev/`, może być tymczasowy w `SCRATCH` —
   ale jeżeli zostaje w repo, to jako część bezpiecznika z `R2`, nie jako drugi skrypt obok).
   Ma parsować ternary warunku języka i **rozdzielać dwa kształty**:
   - **A** — obie gałęzie identyczne;
   - **B** — gałąź polska zawiera słowo (≥4 znaki, bez polskich znaków diakrytycznych)
     obecne też w gałęzi angielskiej.
   ★ Wzorzec warunku to nie tylko `isPolish` — sprawdź, czy w rodzinie nie żyją warianty
   (`isPL`, `lang === 'pl'`, `i18n.language`), i **udokumentuj, których szukałeś**.
2. **Uruchom go w trzech zakresach** z tabeli `B.3` (badany plik · `DiscoveryTools`+`toolPacks` ·
   całe `src/`) i **porównaj z moimi liczbami**. Rozjazd zapisujesz; obowiązuje Twój pomiar.
3. **Sklasyfikuj każde trafienie** w zakresie `DiscoveryTools`+`toolPacks` do jednej z trzech
   kategorii:
   - **DEFEKT** — jest polski odpowiednik, gałąź PL go nie ma;
   - **UZASADNIONA IDENTYCZNOŚĆ** — marka, akronim (`SWOT`, `KPI`, `ROI`), słowo identyczne
     w obu językach („Status", „Tempo"), separator, placeholder;
   - **PROPOZYCJA** — nazwy nie ma w żadnej paczce, więc trzeba ją wymyślić.
4. **Dla każdego DEFEKTU wskaż źródło nazwy**: `plik:linia` w `src/toolPacks/packs/*.pack.ts`
   z odpowiednim `title.pl`. ★ **Jeżeli nazwy w paczce nie ma — to jest PROPOZYCJA, nie
   defekt do cichego przetłumaczenia.**
5. ★ **Hybrydy w całym `src/` (`258` u mnie) są POZA ZAKRESEM tego dyżuru** — podajesz liczbę
   do raportu jako rozmiar długu, i nic więcej. Zakresem jest `DiscoveryTools` + `toolPacks`.

**Wymagany dowód:** `evidence/etykiety-narzedzi-20260904/r1-inwentarz.md` z tabelą
`plik:linia | kształt | PL | EN | kategoria | źródło nazwy` · trzy liczby zakresowe obok
moich · lista wariantów warunku, których szukałeś. **Commit po `R1`.**

---

## R2 — BEZPIECZNIK, KTÓRY NIE POZWOLI RODZINIE ODROSNĄĆ (rdzeń)

`scripts/dev/check-etykiety-dwujezyczne.mjs`. Wymagania — **wszystkie twarde**:

1. **Wykrywa kształt A** („obie gałęzie warunku języka identyczne") w zdefiniowanym zakresie.
   Zakres domyślny: `src/components/DiscoveryTools` + `src/toolPacks`. ★ Całe `src/` ma dziś
   `77` trafień, więc bramka na zerze byłaby bramką, która **nigdy nie mogła przejść**.
2. **Importuje `justification` z `scripts/dev/i18n-pl-audyt.mjs`** — nie kopiuje jej.
   Jedna zmiana listy uzasadnień ma działać w obu miejscach. Jeżeli import okaże się
   niewykonalny (inny kształt danych wejściowych), **napisz dlaczego** i zaproponuj
   najmniejszą zmianę, która go umożliwia — ale nie wprowadzaj jej sam w tym dyżurze.
3. **Ma RATCHET, nie zero**: baseline zapisany w pliku obok skryptu; bramka czerwienieje,
   gdy liczba trafień **rośnie**, i przypomina o obniżeniu baseline'u, gdy maleje.
   Wzoruj się na `scripts/check-artefakt.sh` (dzisiejszy stan: `8`, baseline `9`).
4. ★★ **PODŁOGA LICZEBNOŚCI.** Skrypt **wypisuje liczbę zbadanych plików i liczbę zbadanych
   ternary** i **kończy się błędem, gdy ta liczba jest zerowa albo drastycznie niższa od
   baseline'u**. Powód: bezpiecznik przechodzi, gdy nie może nic zmierzyć — złe `--include`
   w `zsh`, zmieniona ścieżka, ginięcie na ścieżce macOS przed pierwszym pomiarem.
   **Bramka, która nic nie zmierzyła, ma być CZERWONA, nie zielona.**
5. **Rejestracja w `.husky/pre-commit`** — jeden nowy blok, wzorowany na blokach
   `check-list-canon` (wiersz `9`) i `check-artefakt` (wiersz `20`). Zakaz zmiany istniejących.

### ★★ DOWÓD MUTACYJNY W OBIE STRONY — to jest właściwy produkt tej pozycji

Bezpiecznik jednowymiarowy daje fałszywy spokój. Wymagam **dwóch** mutacji i **dwóch** testów
w `tests/unit/i18n/` (★ **NIGDY pod `src/`**, `git add -f`):

| Kierunek | Mutacja | Oczekiwanie |
| --- | --- | --- |
| **ŁAPIE DEFEKT** | wstaw do pliku w zakresie etykietę `isPolish ? 'Mission & Context' : 'Mission & Context'` (dokładnie ten literał, który 344 odsłonił) | bezpiecznik **CZERWONY**, z komunikatem wskazującym `plik:linia` |
| **NIE ŁAPIE UZASADNIONEGO** | wstaw `isPolish ? 'Status' : 'Status'` oraz `isPolish ? 'SWOT' : 'SWOT'` | bezpiecznik **ZIELONY** — inaczej wyprodukujesz bramkę, którą wszyscy zaczną obchodzić |
| **PODŁOGA DZIAŁA** | wskaż skryptowi zakres, który nie istnieje (`--zakres=src/nie-ma-takiego`) | bezpiecznik **CZERWONY** z komunikatem „zero zbadanych obiektów", **nie zielony** |

★ **Mutacje wprowadzasz po kopii przez `cp` do `SCRATCH` i przywracasz przez `cp` —
nigdy `git stash` (`Z27`).** `git diff` po przywróceniu **pusty**, dosłownie w raporcie.

★★ **Mutacja ma celować w ZABEZPIECZENIE, nie w mechanizm.** Zabezpieczeniem jest tu
**wykrycie identycznych gałęzi**. Test, który czerwienieje dlatego, że zepsułeś parser albo
odczyt pliku, **niczego nie dowodzi** — to jest kształt „test scenariusza nie broni
zabezpieczenia" (3 z 4 dyżurów miały zielone testy po skasowaniu zabezpieczenia).

**Wymagany dowód:** skrypt + baseline · blok w hooku · dwa testy w `tests/unit/i18n/` ·
trzy mutacje z wynikami · `git diff` pusty · wynik `node scripts/dev/check-etykiety-dwujezyczne.mjs`
z **liczbą zbadanych obiektów**. **Commit po `R2`.**

★ **Kolejność jest celowa: bezpiecznik POWSTAJE PRZED naprawą.** Dzięki temu naprawa z `R3`
jest mierzona przez narzędzie, a nie przez oko, a spadek liczby trafień jest dowodem.

---

## R3 — NAPRAWA CAŁEJ RODZINY (rdzeń)

1. **Kształt A najpierw** — dwa wystąpienia w badanym pliku (`654` `'Portfolio mission'`,
   `692` `'Risk mission'`). Nazwy z paczek: `portfolioPriority.pack.ts` i
   `riskUncertainty.pack.ts`. ★ **Jeżeli w paczce nie ma odpowiadającego `title.pl` —
   to jest PROPOZYCJA i oznaczasz ją jako propozycję do akceptu, nie jako naprawę.**
2. **Kształt B** — hybrydy z listy `R1`. Zasada rozstrzygająca:
   - `'Brak final source summary'` → nazwa fazy istnieje w paczkach jako `title.pl`
     (sprawdź `dynamicSwot.pack.ts` i rodzeństwo) → **naprawa**;
   - `'Brak kart SWOT'`, `'Budowa SWOT'` → `SWOT` to akronim → **NIE ruszasz**;
   - `'Brak pomiaru baseline'`, `'Brak re-estymacji target'` → nazw nie ma w paczce →
     **PROPOZYCJA**, oznaczona, nie wprowadzona po cichu.
3. ★★ **Zakaz tłumaczenia tego, co ma zostać identyczne** — marki, akronimy, „Status",
   „Tempo". Lista uzasadnionych identyczności jest w `scripts/dev/i18n-pl-audyt.mjs`
   i **to ona rozstrzyga**, a nie Twoje wyczucie.
4. **Po każdej partii uruchom bezpiecznik z `R2`** i zapisz liczbę trafień. Ciąg liczb
   (przed → po każdej partii → po) idzie do raportu.
5. **Rozszerz `tests/unit/tools/dynamicSwotPhaseOverview.render.test.tsx`** o asercję, że
   przy `isPolish=true` kafle mają polskie etykiety — imiennie, nie przez `not.toContain('&')`.
   ★ **Zakaz osłabiania istniejących asercji** — jeżeli któraś zaczyna przeszkadzać,
   to jest sygnał, że naprawa poszła za daleko.
6. **`npx esbuild` na każdym zmienionym pliku** po każdej partii. ★ `Transform failed` to
   **BŁĄD KOMENDY**, nie „brak zmian".

**Wymagany dowód:** diff per plik · **własna liczba naprawionych etykiet** · osobna lista
PROPOZYCJI (z uzasadnieniem, dlaczego nazwy nie ma w paczce) · ciąg liczb z bezpiecznika ·
wynik `esbuild`. **Commit po `R3`** (albo po każdej partii — wtedy kilka commitów).

---

## R4 — PARA ZRZUTÓW Z MECHANICZNYM ZLICZENIEM (rdzeń)

★★★ **Kontrola musi być mechaniczna, bo oko przywyka.** Przez cały dzień patrzyłem na
zrzuty, na których kontrolki harnessu zasłaniały produkt, i tego nie zobaczyłem.

1. Podnieś Vite na **`5553`** (`--port 5553 --strictPort`), zapisz `$!`.
   ★ **Zakaz `pkill`/`killall`** — na koniec zabijasz wyłącznie swój PID.
2. Zrzuty ekranu `tools-swot-session-workspace`, faza `PRZED` (przed `R3`, z gałęzi bazowej
   albo z kopii) i `PO`, **oba z `--base=http://127.0.0.1:5553`**, oba w light i dark.
3. ★★★ **Zliczenie mechaniczne przez `--zlicz`** (`DEC-387`) — to jest właściwy dowód, **nie
   jasność obrazu**. Podaj co najmniej: liczbę kafli, liczbę kafli, których tekst pasuje do
   `title.pl` z paczki, liczbę kafli z angielskim rdzeniem. Wynik ląduje w `--wynik-json`.
   ★ **Bezpiecznik jasności `checkScreenshotPairState.mjs` (próg `150`) jest tu BEZUŻYTECZNY** —
   zmiana pięciu napisów prawie nie zmienia luminancji, a bezpiecznik jednowymiarowy przechodzi
   tym łatwiej, im mniejsza zmiana. **Nie powołuj się na niego jako na dowód naprawy.**
4. ★★ **Para bajtowo identyczna = ZERO dowodu** (kształt „duplikat zamiast motywu").
   **Suma kontrolna KAŻDEGO pliku idzie do raportu.**
5. ★★ **Na kadrze ma być widać JEDNOCZEŚNIE polskie drzewo po lewej i polskie kafle obok** —
   to jest dokładnie ten kadr, na którym odbiór 344 zobaczył defekt. Zrzut samych kafli,
   bez drzewa, **nie zamyka tej pozycji**.
6. ★ **Sprawdź, czy nie mierzysz przyrządu.** 3 z 6 „defektów" jednego dnia okazało się
   hostem harnessu, nie produktem. Porównaj łańcuch przodków kafla w harnessie i w realnej
   trasie; jeżeli się różni, **zapisz to jako granicę dowodu**.

**Wymagany dowód:** cztery zrzuty (PRZED/PO × light/dark) w
`evidence/etykiety-narzedzi-20260904/` z `git add -f` · sumy kontrolne wszystkich czterech ·
`--wynik-json` ze zliczeniami PRZED i PO · zdanie o łańcuchu przodków. **Commit po `R4`.**

---

## R5 — RAPORT, REJESTR I LISTA PROPOZYCJI

Raport `CODEX_DAY354_ETYKIETY_NARZEDZI_REPORT.md`:

1. **Każda liczba z tej instrukcji, którą Twój pomiar obalił** — osobną sekcją, wprost.
   Zaczynając od `~73`.
2. Inwentarz `R1`: trzy zakresy, trzy kategorie, warianty warunku których szukałeś.
3. Bezpiecznik: co wykrywa, jaki ma baseline, jaka jest podłoga liczebności, **trzy mutacje
   z wynikami**.
4. **Własna liczba naprawionych etykiet** — z rozbiciem na kształt A i kształt B.
5. **Lista PROPOZYCJI do akceptu właściciela** — nazwy, których nie ma w żadnej paczce.
   Format: `plik:linia | obecny PL | obecny EN | proponowany PL | dlaczego nie ma w paczce`.
6. **Rozmiar długu poza zakresem**: hybrydy w całym `src/` (u mnie `258`), kształt A w całym
   `src/` (u mnie `77`) — jako liczby, bez pracy.
7. Zdanie o bramkowaniu kafli: **typem narzędzia, nie flagą** → po scaleniu widzi je każdy.
8. Co niewykonane i dlaczego, imiennie.

Sekcja w `docs/program/REJESTR_ZNALEZISK_20260903.md` o **pierwszej wolnej literze**,
sprawdzonej komendą **tuż przed commitem**.

**Commit po `R5`.**

---

## Próg odbioru

1. **Własna liczba naprawionych etykiet**, z rozbiciem na kształt A i B, i zgodna z liczbą
   diffów w `git show --stat`.
2. **Para zrzutów narzędzia fazowego z polskimi kaflami OBOK polskiego drzewa**, w light
   i dark, z **sumami kontrolnymi** i z **mechanicznym zliczeniem** przez `--zlicz` —
   nie z odwołaniem do jasności obrazu.
3. **Bezpiecznik istnieje, jest zarejestrowany w hooku i ma TRZY dowody mutacyjne**:
   czerwienieje na wstawionym defekcie · **nie** czerwienieje na `'Status'`/`'SWOT'` ·
   czerwienieje przy zerze zbadanych obiektów.
4. `git diff` po przywróceniu każdej mutacji **pusty**.
5. Nowe testy w `tests/`, **ani jednego pod `src/`**;
   `node scripts/dev/reachability-from-root.mjs --check-baseline` → `0`.
6. Liście słowników `35199`/`33066` **niezmienione**; cztery bramki `0`.
7. `esbuild` czysty na każdym zmienionym pliku; **`Transform failed` traktowane jako błąd**.
8. Lista PROPOZYCJI wypisana i **oznaczona jako propozycja**, nie wprowadzona po cichu.
9. Żadna nazwa nie została wymyślona tam, gdzie istnieje `title.pl` w paczce.
10. Zero zmian w `public/locales/**`, `MODULE_ACCEPTANCE.md`, `grafika-zrzuty.mjs`
    i `i18n-pl-audyt.mjs`.

---

## Prawo zatrzymania

Zatrzymujesz się i piszesz **STOP** z powodem, jeżeli:

- port `5553` albo `6413` jest zajęty — **STOP całości, nigdy podmiana numeru**;
- import `justification` z `i18n-pl-audyt.mjs` jest niewykonalny **i** jedyną alternatywą
  byłoby skopiowanie listy (kopia to drugi rejestr, a dwa rejestry mierzą rozjazd);
- bezpiecznik czerwienieje na `'Status'` albo `'SWOT'` i nie umiesz tego odsiać bez
  wpisania wyjątku na sztywno — wyjątek na sztywno jest listą numer dwa;
- liczba defektów okaże się taka, że naprawa wymagałaby zmiany paczek — **paczki są
  źródłem prawdy i tylko do odczytu**;
- para zrzutów wychodzi bajtowo identyczna i nie umiesz pokazać różnicy zliczeniem.

★ **Zatrzymanie z konkretnym powodem jest pełnowartościowym wynikiem. Zmyślony dowód nie jest.**

---

## AUDYT SPRZECZNOŚCI — pary wymagań i miejsce rozstrzygnięcia

| Para | Rozstrzygnięcie |
| --- | --- |
| „napraw całą rodzinę" × „zakres to `DiscoveryTools`+`toolPacks`" | `R1` punkt 5 — rodzina = zakres; `258` hybryd w całym `src/` to **liczba do raportu**, nie praca |
| „bezpiecznik na zerze" × „`77` trafień w `src/`" | `R2` punkt 3 — **ratchet z baseline'em**, nie zero; bramka na zerze nigdy nie mogłaby przejść |
| „wzorzec obie gałęzie identyczne" × „`', '` i `'Status'` też pasują" | `R2` punkt 2 — lista uzasadnień **importowana** z `i18n-pl-audyt.mjs` i dowód mutacyjny w drugą stronę |
| „nie tłumacz na własną rękę" × „napraw etykietę bez nazwy w paczce" | `R3` punkt 2 — brak nazwy w paczce = **PROPOZYCJA do akceptu**, nie cicha naprawa |
| „dowód wizualny" × „bezpiecznik jasności próg `150`" | `R4` punkt 3 — dla zmiany pięciu napisów luminancja jest bezużyteczna; dowodem jest **`--zlicz`** |
| „zrzut PO pokazuje naprawę" × „na kadrze ma być drzewo i kafle" | `R4` punkt 5 — zrzut samych kafli nie zamyka pozycji |
| „bezpiecznik przed naprawą" × „commit po każdej pozycji" | `R2` przed `R3` celowo — spadek liczby trafień jest wtedy dowodem, a nie deklaracją |
| „nowe testy w `tests/`" × „test kafli już istnieje" | `B.1` — istniejący `tests/unit/tools/dynamicSwotPhaseOverview.render.test.tsx` **rozszerzasz**; nowe testy bezpiecznika idą do `tests/unit/i18n/` |
| „to nie jest za flagą" × „wygląd tylko za flagą do akceptu" | `R5` punkt 7 — **stan zastany**, nie Twoja decyzja; opisujesz go w raporcie jako ryzyko, nie zakładasz nowej flagi |
| „`~73` etykiety" × mój pomiar `30` z `105` | Sprostowanie na górze + `B.3` wiersze 4-6 — **obowiązuje Twój pomiar** |
| „harness można zmienić" × „harness nie jest produktem" | `B.4.2` — zmiana ekranu **warunkowa**, z uzasadnieniem w raporcie, i nigdy zamiast naprawy produktu |

---

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C szkieletu)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — patrz tabela wyżej | TAK — jedenaście par, każda rozstrzygnięta w treści |
| 2 | Każda ścieżka istnieje na markerze albo jest oznaczona `NOWY` | TAK — sprawdzone na markerze `29fcbd4de2`; zero `BRAK`. Oznaczone `NOWY`: `scripts/dev/check-etykiety-dwujezyczne.mjs`, `tests/unit/i18n/**`, `evidence/etykiety-narzedzi-20260904/**` |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — `B.3`, czternaście wierszy; **dwie liczby ze zlecenia obalone własnym pomiarem** (`~73` → `30` z `105`; liście `35199/33066` zamiast `35198/33065`) |
| 4 | Tabela licencji kompletna, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — każdy wiersz „tylko odczyt" ma rzeczownik-produkt (mapa · zdanie · import · zliczenia) |
| 5 | Wykonalność per pozycja bez plików przekrojowych, z dowodem przy `NIE` | TAK — `B.2`, kolumna 4; naprawa to literały w ciałach funkcji, `ToolDocumentView.tsx` pozostaje nietknięty |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — `B.4.4`; porty `6413`/`5553` zmierzone jako wolne, kontener, worktree i gałąź nie istnieją. ★★ Jawnie wyłączony port `3020` (kanoniczny `dev-render`). ★ 355-358 pisze równolegle inny autor — `Z7` zaostrzony |
| 7 | Komendy paste-ready, z komentarzem oczekiwanego wyniku | TAK — wszystkie grepy przez `bash -c` (★ `--include` w `zsh` zwraca pustkę), wszystkie wywołania zrzutowe z `--base` na własnym porcie |
| 8 | Pułapki środowiska w całości + pułapki właściwe temu dyżurowi (sześć) | TAK — `§0.2d` w części A + sześć pułapek tego dyżuru w polu pułapek |
| 9 | Samodzielność — zero odwołań do rozmów bez ścieżki | TAK; naprawa 344 zacytowana jako commit `c0f690bae3` z pełnym komunikatem, wszystkie wiersze z numerami |
| 10 | Klauzula sprzeczności obecna; niewypełnionych pól szablonu: `0`; wierszy `Z`: `41` | TAK — sprawdzone przez generator, który blokuje zapis przy niespełnieniu |
