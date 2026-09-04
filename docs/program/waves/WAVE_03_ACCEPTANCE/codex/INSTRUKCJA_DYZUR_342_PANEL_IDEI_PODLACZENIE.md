# INSTRUKCJA DYŻURU nr 342 — Codex — „★★★ ZBUDOWANE, ALE NIEPODŁĄCZONE — dyżur 302 zbudował jeden wspólny prawy panel Idei i Notatnika, odebrany adwersaryjnie, i sam zaraportował, że 8 z 8 kadrów bez flagi jest bit w bit identycznych i konsumentów produkcyjnych jest ZERO: komponent istnieje, ale nic go nie renderuje. TEN dyżur NIE BUDUJE PANELU OD NOWA — on dokłada OSTATNI PRZEWÓD do realnych ekranów Idei i Notatnika: (1) mierzy sam osiągalność od korzenia dla prototypu i dla trzech dzisiejszych paneli (moja teza: prototyp i jego flaga są `harness-only`, a `IdeaContextPanel` 1289 linii, `NotebookContextPanel` 867 i `NotebookRightRail` 1037 są `app`), (2) ★ rozstrzyga KONKURENCJĘ FLAG — na prawym panelu Notatnika rządzą dziś `artifactRightRailFlag` (default OFF) i `notebookSpecAShellFlag` (default ON), a `artifactRightRailFlag` dotyka też `standard/IdeaRightPanel.tsx`, więc prototyp 302 byłby TRZECIĄ flagą w tym samym miejscu; wykonawca ma napisać, KTÓRA wygrywa, zamiast dokładać kolejną, (3) ★ rozstrzyga, do którego z DWÓCH kanonów należy panel — `ArtifactRightPanel` powłoki SPEC-A (61 plików) czy `PreviewPaneShell` podglądu z listy — i tych dwóch nie miesza, (4) ★ pilnuje, żeby podłączenie NIE BYŁO PODMIANĄ TREŚCI: prototyp ma 86 linii i 19-34 % tekstu dzisiejszych paneli, więc wstawienie go 1:1 jest REGRESJĄ, nie przewodem, (5) dowodzi kadrem z REALNEGO ekranu, na którym panel widać — para OFF/ON nie bajtowo identyczna, sekcje rozwinięte, sumy kontrolne i średnia jasność podane. Flaga kończy dyżur DOMYŚLNIE OFF; włączenie wyłącznie po akcepcie właściciela na zrzutach."

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
> **wyłącznie** `/private/tmp/cx-day342-panel-idei-podlaczenie`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `74c07919cea7ab55dc9fde5fbd911f7f955ed425`**
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
Zakres: **07_MY_WORK_AGENT — prawy panel Idei i Notatnika: podłączenie prototypu do realnych ekranów (B3 / DEC-2026-09-03-354, kontynuacja dyżuru 302; uwagi właściciela UW-07-14, UW-07-17, UW-07-18)**.
Trasy front: `/my-work → Idee (`IdeaMapWorkspace`, `IdeaWorkspaceTools`, `IdeaRecommendationMap`) i Notatnik (`NotebookRightRail` → `NotebookContextPanel`); harness: `?screen=ideas-teresa-panel`, `?screen=mywork-notebook-rail-speca`, `?screen=notatnik-centrum-mysli`, `?screen=mywork-idea-inspector-lekki``. Trasy tył: `brak własnych tras — panel czyta dane już pobrane przez ekrany Idei i Notatnika; ewentualne braki modelu danych OPISUJESZ, nie dorabiasz`.

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
WT=/private/tmp/cx-day342-panel-idei-podlaczenie
MARKER=74c07919cea7ab55dc9fde5fbd911f7f955ed425

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/grafika/m03-20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day342-panel-idei-podlaczenie-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day342-panel-idei-podlaczenie/config.worktree"
cat "$VAULT/worktrees/cx-day342-panel-idei-podlaczenie/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day342-panel-idei-podlaczenie-scratch
mkdir -p /private/tmp/cx-day342-panel-idei-podlaczenie-artefakty

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
git -C "$VAULT" log --oneline 74c07919cea7ab55dc9fde5fbd911f7f955ed425..github-backup/grafika/m03-20260902
git -C "$VAULT" diff --name-only 74c07919cea7ab55dc9fde5fbd911f7f955ed425..github-backup/grafika/m03-20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day342-panel-idei-podlaczenie-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 74c07919cea7ab55dc9fde5fbd911f7f955ed425..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `8` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

cd "$WT"

# (1) TEZA: prototyp dyzuru 302 ma ZERO konsumentow produkcyjnych.
#     ZSH ZJADA `--include` — dlatego wszystko przez `bash -c` w cudzyslowach.
bash -c 'grep -rl "IdeaNotebookRightPanelPrototype\|ideaNotebookRightPanelPrototypeFlag\|ff_idea_notebook_right_panel_prototype" src server dev-render tests scripts 2>/dev/null' | sort
#   oczekiwane: DOKLADNIE 4 sciezki — sam prototyp, jego flaga, jego test i `dev-render/main.tsx`.
#   Ani jednego trafienia w produkcyjnej sciezce `src/` i ani jednego w `server/`.
#   Jezeli sciezek jest wiecej — MOJA TEZA JEST OBALONA; wypisz je i opisz, co juz jest podlaczone.

# (2) TEZA: prototyp i jego flaga sa `harness-only`, a trzy dzisiejsze panele sa `app`.
node scripts/dev/reachability-from-root.mjs \
  > /private/tmp/cx-day342-panel-idei-podlaczenie-artefakty/reach-przed.json
node -e 'const d=require("/private/tmp/cx-day342-panel-idei-podlaczenie-artefakty/reach-przed.json");for(const w of ["src/components/MyWork/prototypes/IdeaNotebookRightPanelPrototype.tsx","src/utils/ideaNotebookRightPanelPrototypeFlag.ts","src/components/MyWork/IdeaContextPanel.tsx","src/components/MyWork/notebook/NotebookContextPanel.tsx","src/components/MyWork/notebook/NotebookRightRail.tsx","src/components/standard/IdeaRightPanel.tsx","src/components/standard/ArtifactRightPanel.tsx"]){const r=d.files.find(f=>f.file===w);console.log((r?r.classification:"BRAK W INDEKSIE").padEnd(14),w);}console.log(JSON.stringify(d.totals));'
#   oczekiwane: prototyp i flaga = `harness-only`; pozostale piec = `app`;
#   totals app 3044 / harness-only 30 / test-only 1017 / unreachable 719

# (3) TEZA: prototyp to POWLOKA, nie nastepca tresci — 86 linii wobec 3193.
wc -l src/components/MyWork/prototypes/IdeaNotebookRightPanelPrototype.tsx \
      src/utils/ideaNotebookRightPanelPrototypeFlag.ts \
      src/components/MyWork/IdeaContextPanel.tsx \
      src/components/MyWork/notebook/NotebookContextPanel.tsx \
      src/components/MyWork/notebook/NotebookRightRail.tsx
#   oczekiwane: 86 / 36 / 1289 / 867 / 1037.
#   ★ Odbior 302 zmierzyl, ze przy fladze ON strona ma 255-262 znaki tekstu, a dzisiejsze ekrany
#   761-1344 — czyli prototyp to 19-34 % tresci. PODMIANA 1:1 JEST REGRESJA, nie podlaczeniem.

# (4) TEZA (★ najwazniejsza): flag rzadzacych tym samym miejscem jest WIECEJ NIZ JEDNA.
for f in ideaPanel6SectionsFlag artifactRightRailFlag notebookSpecAShellFlag ideaDetailsInPanelFlag ideaNotebookRightPanelPrototypeFlag; do
  printf '%-36s ' "$f"; bash -c "grep -rl '$f' src --include='*.ts' --include='*.tsx' 2>/dev/null | wc -l"
done
bash -c "grep -rl 'artifactRightRailFlag' src --include='*.ts' --include='*.tsx'"
#   oczekiwane: 6 / 10 / 2 / 4 / 1 (ostatnia to sama flaga prototypu — jej jedyny wolacz,
#   `dev-render/main.tsx`, lezy POZA `src/`, i to jest wlasnie caly problem tego dyzuru).
#   ★ `artifactRightRailFlag` i `notebookSpecAShellFlag` obie dotykaja `NotebookRightRail.tsx`,
#   a `artifactRightRailFlag` dotyka takze `src/components/standard/IdeaRightPanel.tsx`.
#   Czyli na prawym panelu Notatnika ZUZ dzis rzadza DWIE flagi, a prototyp 302 bylby TRZECIA.

# (5) TEZA: wartosci domyslne tych flag NIE SA jednakowe i jedna omija flage profilem.
bash -c 'grep -n "return true\|return false\|ENABLE_ARTIFACT_RIGHT_RAIL\|ENABLE_NOTEBOOK_SPEC_A_SHELL\|isDemoAcceptanceProfileEnabled" src/components/MyWork/panel/ideaPanel6SectionsFlag.ts src/utils/artifactRightRailFlag.ts src/components/MyWork/notebook/notebookSpecAShellFlag.ts src/utils/ideaDetailsInPanelFlag.ts src/utils/ideaNotebookRightPanelPrototypeFlag.ts'
#   oczekiwane: ideaPanel6Sections domyslnie ON (brak zmiennej -> `true`), notebookSpecAShell ON,
#   artifactRightRail OFF, prototyp 302 OFF, a `ideaDetailsInPanelFlag:87` ma
#   `if (isDemoAcceptanceProfileEnabled(...)) return true` — czyli PROFIL OMIJA FLAGE.
#   To jest dwudziesty ksztalt falszywego „gotowe”: flaga OFF w kodzie nie znaczy wylaczona.

# (6) TEZA: kanony sa DWA i nie wolno ich mieszac.
bash -c 'find src -name "ArtifactRightPanel.tsx" -o -name "PreviewPaneShell.tsx"'
bash -c 'grep -rl "ArtifactRightPanel" src --include="*.tsx" --include="*.ts" | wc -l'
bash -c 'grep -n "ArtifactRightPanel\|PreviewPaneShell" src/components/MyWork/prototypes/IdeaNotebookRightPanelPrototype.tsx'
#   oczekiwane: `src/components/standard/ArtifactRightPanel.tsx` (61 plikow go uzywa) oraz
#   `src/components/ui/ResizableTable/PreviewPaneShell.tsx` (kanon podgladu z listy).
#   ★ Ustal, do KTOREGO z nich nalezy to, co zbudowal dyzur 302, i tego sie trzymaj.

# (7) TEZA: cztery ekrany odbiorowe sa w macierzy i nie wolno ich z niej usuwac.
for s in ideas-teresa-panel mywork-notebook-rail-speca notatnik-centrum-mysli mywork-idea-inspector-lekki; do
  printf '%-32s ' "$s"; bash -c "grep -c '\"$s\"' scripts/dev/g06-macierz-ekrany.json"
done
#   oczekiwane: po 1 dla kazdego.

# (8) TEZA: porty, kontenery i dysk wolne; liscie i18n na starcie.
lsof -nP -iTCP:6378 -sTCP:LISTEN
lsof -nP -iTCP:5518 -sTCP:LISTEN
docker ps --format '{{.Names}}'
df -h /
node -e 'const fs=require("fs");const f=o=>{let n=0;for(const k in o){const v=o[k];n+=(v&&typeof v==="object")?f(v):1}return n};for(const l of ["pl","en"])console.log(l,f(JSON.parse(fs.readFileSync("public/locales/"+l+"/translation.json","utf8"))));'
#   oczekiwane: puste `lsof`, brak kontenera `cx-day342-pg`, powyzej 3 GB wolnego,
#   `pl 35198` i `en 33065`.

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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day342-panel-idei-podlaczenie-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6378`. Twój JEDYNY port harnessu to `5518`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day342-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta listy restricted ports Chromium. Zajęte przez inne prace (nie ruszasz): 3020, 3022, 3025, 3027, 3030 (tor grafiki nadzorcy), 5322, 5410-5441 (agenci nadzorcy), 5442-5458 oraz 6311-6322 (odbiorcy nadzorcy), 5432 i 5433 (Postgres hosta), 6012, 6379 (redis), 7000, 7679, 7768, 11434. Cudze — dyżury 286-340 (bazy 6290-6376, harness 5250-5516); ten przedział jest ZAREZERWOWANY w całości, nawet jeżeli akurat nic w nim nie stoi. Dyżury równoległe tej serii: 341 (baza 6377, harness 5517, kontener cx-day341-pg), 342 (baza 6378, harness 5518, kontener cx-day342-pg) — do CUDZEJ bazy nie łączysz się nawet do odczytu. Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps. ★ ZAKAZ `pkill`/`killall` na `node`, `vite`, `playwright` — zabijasz wyłącznie własne PID-y (zapisz `$!`).`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `R3 — wyłącznie ISTNIEJĄCA flaga `ff_idea_notebook_right_panel_prototype` (`src/utils/ideaNotebookRightPanelPrototypeFlag.ts`, zbudowana przez dyżur 302, domyślnie OFF). NIE tworzysz nowej flagi, NIE zmieniasz wartości domyślnej żadnej z flag konkurencyjnych (`ff_ideaPanel6Sections`, `artifactRightRailFlag`, `notebookSpecAShellFlag`, `ideaDetailsInPanelFlag`) — dyżur kończy się z flagą prototypu OFF`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``scripts/check-artefakt.sh`, `scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh` (hooki — uruchamiasz, NIE edytujesz; wszystkie trzy MUSZĄ zostać zielone) · `scripts/dev/grafika-zrzuty.mjs` (kanoniczny harness zrzutów — wolno dołożyć WYŁĄCZNIE opcję opt-in, nigdy zmienić zachowanie domyślne) · `scripts/dev/g06-macierz-ekrany.json` (★ ZAKAZ usuwania jakiegokolwiek ekranu) · `scripts/dev/reachability-from-root.mjs` oraz `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` (uruchamiasz `--check-baseline`, NIE aktualizujesz bazy odniesienia) · `src/components/standard/ArtifactRightPanel.tsx` (kanoniczna powłoka prawego panelu, 61 konsumentów — TYLKO ODCZYT) · `src/components/ui/ResizableTable/PreviewPaneShell.tsx` (kanon podglądu z listy — TYLKO ODCZYT) · `server/scripts/migrate.postgres.ts` · `tests/unit/backend/security/**` · `.github/workflows/**` · `public/locales/pl/translation.json` i `public/locales/en/translation.json` (wolno WYŁĄCZNIE dopisywać klucze; liczba liści nie może zmaleć)`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY342_PANEL_IDEI_PODLACZENIE_REPORT.md`. Dozwolona AKTUALIZACJA (dopisanie wiersza, nigdy skasowanie) dokładnie jednego istniejącego dokumentu: `docs/program/waves/WAVE_03_ACCEPTANCE/modules/07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md` (§R.1), wyłącznie w wierszu dotyczącym prawego panelu Idei i Notatnika.. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day342-panel-idei-podlaczenie-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day342-panel-idei-podlaczenie-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ BUDOWANIA PANELU OD NOWA.** Komponent, jego flaga i jego testy JUŻ ISTNIEJĄ — zbudował je dyżur 302 i przeszedł odbiór adwersaryjny. Twoim produktem jest PRZEWÓD, nie druga implementacja. **ZAKAZ DOKŁADANIA CZWARTEJ FLAGI** do prawego panelu — jeżeli miejsce jest już sterowane dwiema, rozstrzygasz która wygrywa i to OPISUJESZ. **★★ ZAKAZ PODMIANY 1:1** — prototyp ma 86 linii i 19-34 % tekstu dzisiejszych paneli; wstawienie go w miejsce `IdeaContextPanel`/`NotebookContextPanel` bez przeniesienia treści jest REGRESJĄ i podstawą odrzucenia gałęzi. **ZAKAZ zmiany wartości domyślnej JAKIEJKOLWIEK flagi** — ani prototypu, ani `ff_ideaPanel6Sections`, ani `notebookSpecAShellFlag`, ani `artifactRightRailFlag`. **ZAKAZ mieszania kanonów** `ArtifactRightPanel` (SPEC-A) i `PreviewPaneShell` (podgląd z listy). **ZAKAZ `primary-*`** — każdy numer to crimson `#85182F`, dozwolony wyłącznie jako semantyka krytyczna; stany aktywne neutralne, fokus `c-focus`. **ZAKAZ własnego skryptu zrzutów obok `scripts/dev/grafika-zrzuty.mjs`.** **ZAKAZ usuwania ekranu z `scripts/dev/g06-macierz-ekrany.json`** na podstawie pomiaru, którego drugi pomiar nie potwierdza. **ZAKAZ meldowania „podłączone” na podstawie grepa wołacza** — grep dowodzi drugiej warstwy z czterech; dowodem jest KADR Z REALNEGO EKRANU. **ZAKAZ `git stash`, `pkill`, `killall`, `--no-verify`, `git fetch --all`.** **ZAKAZ dotykania demo, stagingu i produkcji.** **ZAKAZ zmian w `src/toolPacks/**`, `src/store/useToolStore.ts` i `src/components/DiscoveryTools/**`** — to jest teren dyżuru 341. | Dyżur 302 zrobił dobrą robotę i sam zmierzył jej zasięg: 8 z 8 kadrów bez flagi bit w bit identycznych, zero konsumentów produkcyjnych. To jest ten sam kształt co w dyżurze 341 — właściwa rzecz w kodzie, brakuje ostatniego przewodu. Właściciel widzi taki stan jako BRAK FUNKCJI, nie jako „gotowe za flagą”; ma to zapisane trzy razy jednego dnia. Bez tego dyżuru odpowiedź na uwagi UW-07-14/17/18 („te dra-meni powinny wyglądać tak samo i rządzić się tymi samymi zasadami”) leży w repo i nie dociera do nikogo. |

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
cd /private/tmp/cx-day342-panel-idei-podlaczenie

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day342-pg psql -U postgres -d cx342 \
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
cd /private/tmp/cx-day342-panel-idei-podlaczenie

docker run -d --name cx-day342-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx342 \
  -p 127.0.0.1:6378:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day342-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6378/cx342 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6378/cx342 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day342-panel-idei-podlaczenie && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6378/cx342 \
JWT_SECRET=cx342-jwt-secret-do-testow \
npx vitest run src/components/MyWork/prototypes/__tests__ src/components/MyWork/notebook/__tests__ src/components/MyWork/panel/__tests__ src/utils/__tests__/artifactStudioFlags.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day342-panel-idei-podlaczenie-artefakty/day342-testy.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day342-panel-idei-podlaczenie && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run src/components/MyWork/prototypes/__tests__ src/components/MyWork/notebook/__tests__ src/components/MyWork/panel/__tests__ src/utils/__tests__/artifactStudioFlags.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day342-panel-idei-podlaczenie-artefakty/day342-testy.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day342-panel-idei-podlaczenie/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day342-pg psql -U postgres -d cx342 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day342-pg`.
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
> **(e) **(e) PRZYRZĄD KŁAMIE CZTEREMA SPOSOBAMI, A OKO PRZYWYKA.** Ten moduł ma to udokumentowane imiennie: (1) harness bywa hostem, którego łańcuch przodków różni się od realnej trasy — 3 z 6 „defektów wysokości” 02.09 to był przyrząd, nie produkt; (2) rozwijanie sekcji potrafi ZAMKNĄĆ podgląd, a skan w trakcie animacji daje fałszywy kontrast — porównuj długość tekstu z opcją i bez; (3) para light/dark bywa tym samym obrazem pod dwiema nazwami — dlatego obok sumy kontrolnej podajesz średnią jasność; (4) `ideaDetailsInPanelFlag:87` ma `if (isDemoAcceptanceProfileEnabled(...)) return true` — **profil środowiskowy OMIJA flagę**, więc „flaga OFF w kodzie” nie znaczy „wyłączona w harnessie”. Osobno: `npx vitest run` na nieistniejącej ścieżce wypisuje `No test files found` i kończy się kodem 0 — to BŁĄD KOMENDY, nie PASS; `Transform failed` również. Akapit dowodowy dla każdego pakietu musi podać, która z pułapek (a)–(e) go dotyczy**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day342-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day342-panel-idei-podlaczenie-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R2, R3, R5`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6378` albo `5518` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6378` albo `5518`** (`Z7`).

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

Dyżur 302 zbudował **jeden wspólny prawy panel dla Idei i Notatnika** — dokładnie to, o co
prosił właściciel w `UW-07-18` („te dra-meni powinny wyglądać tak samo, mieć te same elementy,
rządzić się tymi samymi zasadami”). Panel osadza kanoniczną powłokę, ma sześć sekcji w
kanonicznej kolejności, zero crimsona, parę light/dark o różnej treści tonalnej, wersję PL i EN.
Przeszedł odbiór adwersaryjny i został oceniony **SCALIĆ**.

I nie widzi go nikt. Dyżur 302 sam to zmierzył i zapisał: **8 z 8 kadrów bez flagi bit w bit
identycznych z HEAD, zero konsumentów produkcyjnych.** Trafienia grepa: sam prototyp, jego flaga,
jego test i `dev-render/main.tsx`. Ani jednego w produkcyjnej ścieżce `src/`.

Ten dyżur jest dyżurem od przewodu. **Nie od budowania panelu.** Jeżeli w połowie pracy piszesz
nowy komponent panelu, nową flagę albo drugi układ sekcji — ta instrukcja jest zła, i masz
STOP-pytanie, a nie licencję na drugą implementację.

## ★ Cztery warstwy — i której dowodzi grep

1. komponent **istnieje** w repo,
2. jest **importowany**,
3. jest **renderowany** na realnym ekranie,
4. **dociera do użytkownika** — widać go.

`grep` wołacza dowodzi **warstwy 2**. Zielony test komponentu dowodzi **warstwy 1**. Dyżur 302
ma obie. **Twoim dowodem końcowym jest warstwa 4: kadr z REALNEGO ekranu Idei albo Notatnika,
na którym panel widać** — nie kadr panelu sfotografowanego samego na pustym tle, bo taki już
jest i niczego nie rozstrzyga.

## ★★ PODŁĄCZENIE TO NIE PODMIANA — najważniejsze zdanie tej instrukcji

Prototyp ma **86 linii**. Dzisiejsze panele mają **1289 + 867 + 1037 = 3193 linie**. Odbiór 302
zmierzył, że przy fladze ON strona ma **255-262 znaki tekstu**, a dzisiejsze ekrany **761-1344** —
czyli prototyp niesie **19-34 %** dzisiejszej treści. Wszystkie sekcje poza Akcjami i dwiema
atrapami właściwości są **puste**, bo model danych nie ma dziś historii, komentarzy ani
provenance.

**Wstawienie prototypu w miejsce `IdeaContextPanel` albo `NotebookContextPanel` jeden do jednego
jest REGRESJĄ, nie przewodem, i jest podstawą odrzucenia gałęzi.** Podłączenie znaczy: przy
fladze ON użytkownik dostaje **wspólny układ z dzisiejszą treścią**, a nie wspólny układ zamiast
treści. Jeżeli przeniesienie treści nie mieści się w tym dyżurze — to jest uprawnione
zatrzymanie z opisem, ile tego jest (`R2`), a nie powód do skrócenia panelu.

## ★ Zmierz moje liczby sam

Twierdzę: trafień grepa dla prototypu jest 4; prototyp i jego flaga są `harness-only`, a
`IdeaContextPanel`, `NotebookContextPanel`, `NotebookRightRail`, `IdeaRightPanel` i
`ArtifactRightPanel` są `app`; `ArtifactRightPanel` ma 61 konsumentów; flag dotykających prawego
panelu jest co najmniej pięć, a domyślne wartości **nie są jednakowe**
(`ff_ideaPanel6Sections` **ON**, `notebookSpecAShellFlag` **ON**, `artifactRightRailFlag` **OFF**,
prototyp 302 **OFF**), przy czym `ideaDetailsInPanelFlag:87` **omija flagę profilem
środowiskowym**; liście i18n to `pl 35198` / `en 33065`.

**Jeżeli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.** Obalenie mojej tezy jest sukcesem dyżuru, nie porażką.

## ★ Właściciel nigdy nie jest pierwszym testerem wizualnym

Zasada nienaruszalna (`CLAUDE.md` §7). Zanim właściciel zobaczy JAKIKOLWIEK ekran: renderujesz
go sam w harnessie, robisz zrzut sam, oglądasz go sam (`Read`), i dopiero taki zrzut idzie do
akceptu. Zrzut ma być czysty — zero ozdób, tokeny `c-*`. **Zakaz „włącz flagę i zobacz” jako
pierwszego sprawdzenia.** Flaga kończy dyżur OFF; włączenie po akcepcie.

---

# TABELA LICENCJI PLIKOWYCH — CAŁA ŚCIEŻKA

Licencja obejmuje **całą ścieżkę**: komponent · powłoka · flaga · hook · serwis · harness · test.

| Plik / wzorzec | Licencja | Co robisz, gdy pozycja wymagałaby zmiany pliku TYLKO-DO-ODCZYTU |
| --- | --- | --- |
| `src/components/standard/ArtifactRightPanel.tsx` | **TYLKO ODCZYT — BEZWZGLĘDNIE** (kanoniczna powłoka, 61 konsumentów) | Produktem pozycji staje się **CZERWONY KONTRAKT TESTOWY**: nowy plik testu, który **dziś PADA** i opisuje żądane zachowanie, oznaczony `it('KONTRAKT DLA DYŻURU 342 — …')` z nagłówkiem `// CZERWONY Z ZAŁOŻENIA — nie regresja tego dyżuru`. Do tego **brief w raporcie**: plik:linia · dlaczego nie da się w module · promień rażenia (ile montaży, ile modułów) · jak wyglądałby dowód mutacyjny. **Pozycja z takim produktem jest ZROBIONA, nie STOP** |
| `src/components/ui/ResizableTable/PreviewPaneShell.tsx` | **TYLKO ODCZYT** (kanon podglądu z listy — inny kanon niż SPEC-A) | jak wyżej |
| **KOMPONENT** · `src/components/MyWork/prototypes/IdeaNotebookRightPanelPrototype.tsx` | **★ PEŁNA LICENCJA** w zakresie `R3` — wyłącznie tyle, ile potrzeba, żeby panel przyjął REALNĄ treść ekranów, a nie atrapy | — |
| **FLAGA** · `src/utils/ideaNotebookRightPanelPrototypeFlag.ts` | **★ WĄSKA LICENCJA:** wyłącznie udostępnienie tej samej flagi konsumentom produkcyjnym w zakresie `R3`. **Zakaz zmiany wartości domyślnej** i zakaz rozszerzania listy dozwolonych wartości | Czerwony kontrakt + brief |
| **POWIERZCHNIA IDEE** · `src/components/MyWork/IdeaContextPanel.tsx`, `src/components/MyWork/IdeaWorkspaceTools.tsx`, `src/components/MyWork/IdeaMapWorkspace.tsx` | **★ WĄSKA LICENCJA:** wyłącznie miejsce montażu prawego panelu (rozgałęzienie za flagą) w zakresie `R3`. **Zakaz usuwania dzisiejszej treści** i zakaz zmiany wyglądu przy fladze OFF | Czerwony kontrakt + brief |
| **POWIERZCHNIA NOTATNIK** · `src/components/MyWork/notebook/NotebookRightRail.tsx`, `src/components/MyWork/notebook/NotebookContextPanel.tsx` | **★ WĄSKA LICENCJA:** jak wyżej. ★ `NotebookRightRail` jest już sterowany DWIEMA flagami (`artifactRightRailFlag`, `notebookSpecAShellFlag`) — zmiana wolno wyłącznie taka, która wynika z rozstrzygnięcia `R2` | Czerwony kontrakt + brief |
| `src/components/standard/IdeaRightPanel.tsx` | **★ WĄSKA LICENCJA:** wyłącznie jeżeli `R2` rozstrzygnie, że to jest właściwy punkt wpięcia. Zakaz jakiejkolwiek innej zmiany | Czerwony kontrakt + brief |
| `src/components/MyWork/prototypes/__tests__/**`, `src/components/MyWork/notebook/__tests__/**`, `src/components/MyWork/panel/__tests__/**`, `tests/**` (NOWE pliki) | **★ PEŁNA LICENCJA**, z zastrzeżeniem `Z18` i `Z31` | — |
| `dev-render/screens/ideas-teresa-panel.tsx`, `dev-render/screens/mywork-notebook-rail-speca.tsx`, `dev-render/screens/notatnik-centrum-mysli.tsx`, `dev-render/screens/mywork-idea-inspector-lekki.tsx`, `dev-render/main.tsx` | **★ WĄSKA LICENCJA:** wyłącznie tyle, ile potrzeba, żeby harness pokazał REALNY ekran z panelem, w zakresie `R5`. **Zakaz podmiany realnego komponentu na atrapę** i zakaz fotografowania panelu samego na pustym tle jako dowodu warstwy 4 | Brief w raporcie |
| `scripts/dev/grafika-zrzuty.mjs` | **★ WĄSKA LICENCJA:** wyłącznie **dołożenie opcji opt-in**, z wartością domyślną zachowującą dzisiejsze zachowanie co do bitu. **Zakaz pisania własnego skryptu zrzutów obok** | Brief w raporcie |
| `public/locales/pl/translation.json`, `public/locales/en/translation.json` | **★ WYŁĄCZNIE DOPISYWANIE KLUCZY**, parytet PL+EN w tym samym commicie. Zakaz zmiany istniejących wartości | — |
| `src/utils/artifactRightRailFlag.ts`, `src/components/MyWork/notebook/notebookSpecAShellFlag.ts`, `src/components/MyWork/panel/ideaPanel6SectionsFlag.ts`, `src/utils/ideaDetailsInPanelFlag.ts`, `src/utils/artifactStudioFlags.ts`, `src/utils/orgRedesignFlag.ts` | **TYLKO ODCZYT — flagi konkurencyjne** | Produktem `R2` jest **tabela pierwszeństwa**: która flaga rządzi którym miejscem, jaka ma wartość domyślną, co się dzieje przy każdej kombinacji. **Nie zmieniasz żadnej z nich** |
| `src/components/MyWork/mindmap/UnifiedNodeDetailDrawer.tsx` | **TYLKO ODCZYT** (2101 linii, wspólny dla Mapy myśli i Tablicy) | Wpis do raportu z rekomendacją jako diff w bloku kodu, nienałożony |
| `scripts/dev/g06-macierz-ekrany.json` | **TYLKO ODCZYT** | Ekranu nie usuwa się z macierzy na podstawie pomiaru, którego drugi pomiar nie potwierdza |
| `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` | **TYLKO ODCZYT** | Uruchamiasz `--check-baseline`; czerwień jest wynikiem pomiaru do raportu, nie powodem do aktualizacji bazy odniesienia |
| `src/toolPacks/**`, `src/store/useToolStore.ts`, `src/components/DiscoveryTools/**` | **TYLKO ODCZYT — teren dyżuru `341`** | Wpis do raportu: plik, linia, treść problemu, **gotowa rekomendacja naprawy jako diff w bloku kodu, nienałożony**. Pozycja idzie dalej |
| `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `tests/integration/_helpers/assertRealPostgres.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Produktem jest **opis w raporcie**: co w konfiguracji blokuje pomiar, jaka byłaby zmiana i **jak obszedłeś to zmiennymi w linii komendy**. Pozycja jest zrobiona z takim opisem |
| `docs/program/waves/WAVE_03_ACCEPTANCE/modules/07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md` | `§R.1`, z zastrzeżeniem `Z32` | — |
| `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY342_PANEL_IDEI_PODLACZENIE_REPORT.md` | `§R.2` — **JEDYNY nowy dokument, jaki wolno Ci utworzyć** (`Z13`) | — |
| `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` | **TYLKO ODCZYT** (`Z14`) | Errata w raporcie |
| **Wszystko inne** | **TYLKO ODCZYT** | Opisujesz potrzebę w raporcie z dowodem `plik:linia` i idziesz dalej |

> **★★ ZASTRZEŻENIE.** Powyższa tabela **JEST** licencją. Jeżeli plik, którego
> potrzebujesz, jest opisany jako „PEŁNA/WĄSKA LICENCJA" — **masz pozwolenie
> i STOP z tytułu »nie wolno mi« jest NIEZASADNY**. Jeżeli pliku nie ma
> w tabeli w ogóle — domyślnie jest **TYLKO DO ODCZYTU**, a Twoim produktem
> jest czerwony kontrakt + brief wg wiersza 1, **nie zatrzymanie dyżuru**.

---

# POZYCJE R1–R6

## R1 — POMIAR: GDZIE PANEL MA SIĘ POJAWIĆ I CO TAM DZIŚ JEST (rdzeń pomiarowy)

Wymagane produkty:

1. **Tabela osiągalności** — dla prototypu, jego flagi i każdego kandydata na punkt wpięcia:
   `plik · klasyfikacja przed · przewidywana po · czy konsument jest żywy`. Źródło:
   `node scripts/dev/reachability-from-root.mjs`. ★ Podłączenie do konsumenta `unreachable`,
   `test-only` albo `harness-only` niczego nie zmienia.
2. **Tabela czterech warstw dla stanu DZIŚ**: co dowodzi warstwy 1, 2, 3 i 4 dla prototypu 302,
   z komendą przy każdej. Moja teza: 1 i 2 są, 3 i 4 nie ma.
3. **Inwentarz treści dzisiejszych paneli**: sekcja po sekcji, co pokazuje `IdeaContextPanel`,
   co `NotebookContextPanel`, co `NotebookRightRail`, i **co z tego prototyp dziś umie, a czego
   nie**. To jest wejście do rozstrzygnięcia z akapitu „podłączenie to nie podmiana”.
4. **Odpowiedź na pytanie kanonu**: czy to, co zbudował dyżur 302, należy do powłoki SPEC-A
   (`ArtifactRightPanel`) czy do podglądu z listy (`PreviewPaneShell`) — z cytatem i numerem
   paragrafu z `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md`. Wskaż, którego z dwóch
   kanonów panel faktycznie używa w kodzie, i czy to się zgadza.

Commit po `R1`.

## R2 — ROZSTRZYGNIĘCIE: KTÓRA FLAGA WYGRYWA I CO ZNACZY „PODŁĄCZONY” (rdzeń)

To jest najtrudniejsza pozycja tego dyżuru i **nie wolno jej przeskoczyć.**

**(a) Tabela pierwszeństwa flag.** Wiersz na każdą flagę dotykającą prawego panelu Idei albo
Notatnika. Kolumny: flaga · plik · miejsce, którym rządzi · wartość domyślna · co się dzieje,
gdy jest ON · co, gdy OFF · czy omija ją profil środowiskowy. Znane mi pozycje:

- `ff_ideaPanel6Sections` (`src/components/MyWork/panel/ideaPanel6SectionsFlag.ts`, 6 konsumentów,
  **default ON** — brak zmiennej daje `true`),
- `artifactRightRailFlag` (`src/utils/artifactRightRailFlag.ts`, 10 konsumentów, **default OFF**;
  dotyka `NotebookRightRail.tsx` **i** `standard/IdeaRightPanel.tsx`; jego własny komentarz mówi,
  że wzorzec Teresy na szynie został **odrzucony** przez właściciela 2026-09-01 i że
  `NotebookRightRail` „czeka na przepisanie”),
- `notebookSpecAShellFlag` (`src/components/MyWork/notebook/notebookSpecAShellFlag.ts`,
  **default ON** po decyzji właściciela z 03.09),
- `ideaDetailsInPanelFlag` (`src/utils/ideaDetailsInPanelFlag.ts`, **default OFF**, ale linia 87
  ma `if (isDemoAcceptanceProfileEnabled(...)) return true` — **profil omija flagę**),
- `artifactStudioFlags`, `orgRedesignFlag` — sprawdź, czy w ogóle dotyczą tego miejsca; jeżeli
  nie, napisz to wprost z dowodem, zamiast je przemilczeć,
- `ff_idea_notebook_right_panel_prototype` — flaga dyżuru 302, **default OFF**.

**Wynik (a) to jedno zdanie na każde miejsce: „tym miejscem rządzi flaga X, a Y jest wobec niej
nadrzędna/podrzędna, dowód: plik:linia”.** ★ Jeżeli dwie flagi sterują tym samym miejscem,
**rozstrzygasz która wygrywa i to opisujesz — nie dokładasz trzeciej.**

**(b) Definicja „podłączony” dla tego dyżuru,** napisana słowem przed kodem: co dokładnie
użytkownik ma zobaczyć przy ON i co przy OFF, w Ideach i w Notatniku, sekcja po sekcji.
Definicja musi jawnie odpowiedzieć: **czy panel przy ON niesie dzisiejszą treść, czy jej część,
czy jej nie niesie** — i jeżeli nie całą, to ile jej brakuje **liczbą** (znaki tekstu, sekcje).

**(c) Rozstrzygnięcie kanonu** z `R1` pkt 4, jednym zdaniem, z numerem paragrafu.

Commit po `R2`.

## R3 — PRZEWÓD (rdzeń)

Podłączenie zgodne z `R2`, za **istniejącą** flagą, domyślnie OFF.

- Punkt wpięcia dokładnie tam, gdzie wskazał `R2` — nie „gdzie było najłatwiej”.
- Przy OFF: widok **identyczny** z dzisiejszym. Dowodzisz tego zrzutem o **identycznej sumie
  kontrolnej** względem markera, nie zapewnieniem.
- Przy ON: panel widoczny na realnym ekranie, z treścią zgodną z definicją z `R2(b)`.
- **Zero nowych flag.** Zero zmian wartości domyślnych — także flag konkurencyjnych.
- **Zero `primary-*`** w tym, co dokładasz: każdy numer to crimson `#85182F`, dozwolony wyłącznie
  jako semantyka krytyczna; stany aktywne neutralne, fokus przez `c-focus`.
- Klawiatura: `Tab`, `Esc`, `focus-visible` — panel wpięty w realny ekran musi być dostępny
  z klawiatury, a nie tylko wyglądać.
- Testy: (1) przy OFF drzewo DOM realnego ekranu **niezmienione**; (2) przy ON panel **jest**
  w drzewie realnego ekranu — asercja na uchwycie DOM, nie na obrazku; (3) flaga konkurencyjna
  ustawiona przeciwnie nie wywraca widoku (kombinacje z tabeli `R2(a)`).

**Dowód mutacyjny — celuje w ZABEZPIECZENIE, nie w mechanizm.** Zamień wartość domyślną flagi
prototypu na `true` (przez `cp` do katalogu odkładczego, **nigdy `git stash`**) → mają
zaczerwienić się **dokładnie** testy broniące OFF, a nie „jakieś”. Cofnij przez `cp`, pokaż
`git status` czysty. Drugi dowód: usuń wpięcie panelu → test warstwy 4 (obecność w DOM realnego
ekranu) ma paść.

Commit po `R3`.

## R4 — TRWAŁOŚĆ I ZIMNY ODCZYT (warunkowy)

Jeżeli `R2` rozstrzygnie, że panel cokolwiek **zapisuje** (stan sekcji, szerokość, wybór
zakładki) — dowodzisz trwałości na realnej bazie `cx342` (port `6378`), pełny łańcuch migracji
strict od zera + drugi przebieg dla idempotencji, i **odczyt na zimno osobnym klientem**. Atrapa
bazy melduje sukces każdego zapisu niezależnie od warunku — dowód jest ważny wyłącznie na realnym
Postgresie.

Jeżeli panel **niczego nie zapisuje** — pozycja jest `n/d`, ale **z dowodem**: komenda pokazująca,
że w ścieżce panelu nie ma zapisu. „n/d” bez komendy nie jest wynikiem.

Commit po `R4` (także wtedy, gdy produktem jest samo `n/d` z dowodem).

## R5 — KADRY Z REALNEGO EKRANU (rdzeń dowodowy)

Kanoniczny `scripts/dev/grafika-zrzuty.mjs`, port `5518`, cztery ekrany z macierzy:
`ideas-teresa-panel`, `mywork-notebook-rail-speca`, `notatnik-centrum-mysli`,
`mywork-idea-inspector-lekki`. Każdy w light i dark, PL; dla dwóch dołóż EN.

Wymagane wprost:

- **para OFF/ON NIE MOŻE być bajtowo identyczna** — podajesz `shasum -a 256` każdego pliku;
  identyczne sumy oznaczają, że przewód nie działa, i to jest wynik do zapisania, a nie do
  przemilczenia;
- **para light/dark też nie może być tym samym obrazem pod dwiema nazwami** — obok sumy
  kontrolnej podajesz **średnią jasność**; para, w której obie mają `mean_luma > 150`, jest
  podejrzana i wymaga obejrzenia;
- **sekcje ROZWINIĘTE** (`--rozwin-sekcje=1`) — zwinięta sekcja nie jest dowodem; jednocześnie
  sprawdzasz, czy rozwijanie nie zamyka podglądu (znany defekt przyrządu w tym module) przez
  porównanie długości tekstu z opcją i bez;
- **kadr pokazuje REALNY ekran**, z Notatnikiem/tabelą obok, a nie panel sam na pustym tle —
  to jest cała różnica między warstwą 3 a warstwą 4;
- **każdy kadr obejrzany przez `Read`** i opisany z nazwy: co widać, ile sekcji, jakie etykiety;
- lista czekowania część B w zakresie dotyczącym powłoki panelu, literalnie, z „n/d + powód”,
  oraz lista odbioru `§18.1` `ARTIFACT_ANATOMY_STANDARD.md`, jeżeli `R2` rozstrzygnie, że to
  jest artefakt SPEC-A.

Bramki: `bash scripts/check-artefakt.sh`, `bash scripts/check-list-canon.sh`,
`bash scripts/check-focus-canon.sh --ci` — **wszystkie trzy zielone**, liczby porównane z bazą
odniesienia (dług nie rośnie).

Commit po `R5`.

## R6 — RAPORT

Struktura z `§R.2`, a ponadto obowiązkowo:

- **tabela czterech warstw** dla stanu PO dyżurze, z komendą przy każdej;
- **tabela pierwszeństwa flag** z `R2(a)` w wersji końcowej, ze zdaniem „tym miejscem rządzi X”;
- **rozstrzygnięcie kanonu** (SPEC-A vs podgląd z listy) z numerem paragrafu;
- **bilans treści**: ile treści niesie panel przy ON wobec dzisiejszej, liczbą; czego brakuje
  w modelu danych, imiennie (dyżur 302 wypisał pięć struktur — sprawdź, czy nadal pięć);
- **tabela osiągalności przed/po** + wynik `--check-baseline`;
- **cztery pytania TAK/NIE dyżuru 302** — czy nadal otwarte, czy któreś rozstrzygnął ten dyżur;
- sekcja **KOREKTY WOBEC INSTRUKCJI** — każda moja liczba, której Twój pomiar nie potwierdził;
- sekcja **TWIERDZENIA NIEZWERYFIKOWANE**, niepusta;
- zdanie wprost, czy flaga kończy dyżur **OFF** (ma kończyć) i **które dokładnie zrzuty**
  właściciel ma obejrzeć, żeby móc powiedzieć „włączamy”, w sensownej dla oka kolejności.

---

# TABELA POZYCJI Z DEFINICJĄ UKOŃCZENIA

| Pozycja | Nazwa jednym zdaniem | Rdzeń? | Wymaga plików przekrojowych? | DoD podniesione (min. testów) | Definicja ukończenia — co dokładnie musi być prawdą | Komenda dowodowa | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `R1` | pomiar: osiągalność, cztery warstwy, inwentarz treści, kanon | TAK (pomiarowy) | NIE — dowód: `git diff --name-only` po `R1` pokazuje wyłącznie raport | bazowe | Tabela osiągalności; tabela czterech warstw dla stanu DZIŚ; inwentarz treści trzech paneli sekcja po sekcji; odpowiedź na pytanie kanonu z numerem paragrafu | `node scripts/dev/reachability-from-root.mjs` + grepy z `§0.3` | `docs(day342): pomiar warstw, tresci i kanonu (R1)` |
| `R2` | rozstrzygnięcie: która flaga wygrywa i co znaczy „podłączony” | **TAK — rdzeń** | NIE — dowód: pozycja nie zmienia ani jednego pliku kodu | bazowe | Tabela pierwszeństwa flag z wartościami domyślnymi i profilem; definicja „podłączony” słowem przed kodem, z liczbą brakującej treści; rozstrzygnięcie kanonu | grepy z `§0.3` komendy (4), (5), (6) | `docs(day342): pierwszenstwo flag i definicja podlaczenia (R2)` |
| `R3` | przewód: panel widoczny na realnym ekranie za istniejącą flagą OFF | **TAK — rdzeń** | NIE — dowód: `git diff --name-only` zawiera wyłącznie pliki z tabeli licencji | **+3** (OFF drzewo DOM niezmienione; ON panel obecny w DOM realnego ekranu; kombinacja z flagą konkurencyjną) | Przy ON panel widoczny w Ideach i w Notatniku; przy OFF widok identyczny; zero nowych flag; zero `primary-*`; `Tab`/`Esc`/`focus-visible` działają; dwa dowody mutacyjne celujące w zabezpieczenie | `npx vitest run src/components/MyWork/prototypes/__tests__ src/components/MyWork/notebook/__tests__ --retry=0` | `feat(day342): podlaczenie prawego panelu Idei i Notatnika za flaga OFF (R3)` |
| `R4` | trwałość i zimny odczyt — albo uzasadnione `n/d` | NIE (warunkowy) | NIE | +2 jeżeli dotyczy, inaczej n/d | Albo dowód trwałości na realnej bazie z zimnym odczytem osobnym klientem, albo `n/d` **z komendą** pokazującą brak zapisu w ścieżce panelu | `DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6378/cx342 RUN_DB_TESTS=1 npx vitest run … --retry=0` | `test(day342): trwalosc panelu albo dowod n/d (R4)` |
| `R5` | kadry z REALNEGO ekranu, OFF/ON, które pokazują różnicę | **TAK — rdzeń dowodowy** | NIE — dowód: harness i skrypt zrzutów mają WĄSKĄ licencję | bazowe + 3 bramki wizualne | 4 ekrany × light/dark × OFF/ON; `shasum` pary OFF/ON **różne**; `mean_luma` pary light/dark **różne**; sekcje rozwinięte; kadr pokazuje realny ekran, nie panel na pustym tle; każdy obejrzany przez `Read`; trzy bramki zielone | `node scripts/dev/grafika-zrzuty.mjs …` + `shasum -a 256` + `bash scripts/check-focus-canon.sh --ci` | `test(day342): kadry OFF/ON z realnych ekranow (R5)` |
| `R6` | raport dyżuru | NIE | NIE | n/d | struktura z `§R.2`, sekcja „TWIERDZENIA NIEZWERYFIKOWANE" niepusta, sekcja „KOREKTY WOBEC INSTRUKCJI" wypełniona | — | `docs(day342): raport dyzuru (R6)` |
| `§R.1` | podniesienie `MODULE_ACCEPTANCE.md` do stanu faktycznego | NIE | NIE | n/d | Wiersz prawego panelu Idei i Notatnika w `07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md` opisuje stan PO dyżurze, z jawnym „za flagą OFF” | — | `docs(day342): MODULE_ACCEPTANCE 07_MY_WORK_AGENT (R.1)` |

> **Kolumna „Wymaga plików przekrojowych?" musi być wypełniona dla KAŻDEJ
> pozycji, z dowodem przy odpowiedzi `NIE`.** Jeżeli którakolwiek pozycja
> odpowiada `TAK`, autor instrukcji ma obowiązek albo przenieść ją do innego
> dyżuru, albo z góry opisać produkt zastępczy (czerwony kontrakt + brief).
> **Wykonawca nie może odkryć niewykonalności pozycji w jej połowie.**

**★ Commit po KAŻDEJ pozycji R** i `git push github-backup codex/day342-panel-idei-podlaczenie-20260904`
po każdym commicie (`Z34a`). Pozycja bez commitu jest pozycją niewykonaną, choćby kod leżał
w katalogu roboczym.

---

# TABELA MIANOWNIKÓW

| # | Co liczę | Liczba autora instrukcji | Komenda, którą ją policzyłem (odtwarzalna, jedna linia) | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | pliki wołające prototyp 302 albo jego flagę | `4` (prototyp, flaga, test, `dev-render/main.tsx`) | `bash -c 'grep -rl "IdeaNotebookRightPanelPrototype\|ideaNotebookRightPanelPrototypeFlag\|ff_idea_notebook_right_panel_prototype" src server dev-render tests scripts'` | TAK — obejmuje `server/` i `dev-render/`, więc odróżnia „harness” od „produkt” |
| 2 | klasyfikacja osiągalności prototypu i jego flagi | `harness-only` | `node scripts/dev/reachability-from-root.mjs` + filtr po ścieżce | TAK — osiągalność liczona od korzenia `src/index.tsx`, nie po imporcie sąsiada |
| 3 | klasyfikacja trzech dzisiejszych paneli | `app` (wszystkie trzy) | jak wyżej | TAK |
| 4 | linie prototypu | `86` | `wc -l src/components/MyWork/prototypes/IdeaNotebookRightPanelPrototype.tsx` | TAK |
| 5 | linie trzech dzisiejszych paneli | `1289` / `867` / `1037` (razem `3193`) | `wc -l src/components/MyWork/IdeaContextPanel.tsx src/components/MyWork/notebook/NotebookContextPanel.tsx src/components/MyWork/notebook/NotebookRightRail.tsx` | TAK |
| 6 | udział treści prototypu wobec dzisiejszej | `19-34 %` (255-262 znaki wobec 761-1344) | pomiar odbioru 302 — **zweryfikuj sam** długością tekstu ze zrzutów `R5` | TAK, ale to liczba CUDZA — Twój pomiar wygrywa |
| 7 | konsumenci `ArtifactRightPanel` | `61` | `bash -c 'grep -rl "ArtifactRightPanel" src --include="*.tsx" --include="*.ts" \| wc -l'` | TAK |
| 8 | konsumenci flag konkurencyjnych | `ideaPanel6SectionsFlag 6` · `artifactRightRailFlag 10` · `notebookSpecAShellFlag 2` · `ideaDetailsInPanelFlag 4` | `bash -c "grep -rl '<flaga>' src --include='*.ts' --include='*.tsx' \| wc -l"` | TAK |
| 9 | wartości domyślne flag | `ideaPanel6Sections ON` · `notebookSpecAShell ON` · `artifactRightRail OFF` · `ideaDetailsInPanel OFF (ale profil omija)` · `prototyp 302 OFF` | `bash -c 'grep -n "return true\|return false\|ENABLE_" <pliki flag>'` | **TAK — sprawdź to osobno; „flaga OFF w kodzie” nie znaczy „wyłączona”** |
| 10 | ekrany odbiorowe w macierzy `g06` | `4` (po 1 trafieniu każdy) | `bash -c "grep -c '\"<ekran>\"' scripts/dev/g06-macierz-ekrany.json"` | TAK |
| 11 | liście i18n `pl` / `en` na markerze | `35198` / `33065` | `node -e '…'` z `§0.3` komenda (8) | TAK — liczy liście, nie klucze najwyższego poziomu |
| 12 | wolne numery migracji w MOIM przedziale `20261280`–`20261289` | `0 zajętych` | `bash -c 'ls server/migrations/ \| grep -cE "^2026128"'` | **TAK — sprawdź to osobno, to jest najczęstszy błąd (CZĘŚĆ D, błąd 2)** |

**Jeżeli Twój pomiar przeczy którejkolwiek z tych liczb — obowiązuje TWÓJ pomiar.
Zapisz rozbieżność wprost w sekcji „KOREKTY WOBEC INSTRUKCJI”.**

---

# TABELA ROZŁĄCZNOŚCI — PLIKI DO ZAPISU TEGO DYŻURU

## Pliki zapisywane NA PEWNO

| # | Plik | Rodzaj | Pozycja | Ryzyko kolizji + z kim |
| --- | --- | --- | --- | --- |
| 1 | `src/components/MyWork/prototypes/IdeaNotebookRightPanelPrototype.tsx` | istniejący | `R3` | ZEROWE |
| 2 | `src/components/MyWork/prototypes/__tests__/**` | istniejący/NOWE | `R3` | ZEROWE |
| 3 | `docs/…/CODEX_DAY342_PANEL_IDEI_PODLACZENIE_REPORT.md` | NOWY | `R6` | ZEROWE |

## Pliki zapisywane WARUNKOWO

| Plik | Pozycja | Warunek, po którego spełnieniu wolno zapisać |
| --- | --- | --- |
| `src/components/MyWork/IdeaContextPanel.tsx`, `IdeaWorkspaceTools.tsx`, `IdeaMapWorkspace.tsx` | `R3` | Tylko jeżeli `R2` wskaże ten punkt wpięcia. Wyłącznie rozgałęzienie za flagą; zakaz usuwania dzisiejszej treści |
| `src/components/MyWork/notebook/NotebookRightRail.tsx`, `NotebookContextPanel.tsx` | `R3` | Tylko jeżeli `R2` wskaże ten punkt wpięcia **i** rozstrzygnie pierwszeństwo wobec `artifactRightRailFlag` oraz `notebookSpecAShellFlag` |
| `src/components/standard/IdeaRightPanel.tsx` | `R3` | Tylko jeżeli `R2` rozstrzygnie, że to jest właściwy punkt wpięcia dla Idei |
| `src/utils/ideaNotebookRightPanelPrototypeFlag.ts` | `R3` | Tylko jeżeli konsument produkcyjny wymaga udostępnienia flagi. **Wartość domyślna zostaje OFF** |
| `dev-render/screens/{ideas-teresa-panel,mywork-notebook-rail-speca,notatnik-centrum-mysli,mywork-idea-inspector-lekki}.tsx`, `dev-render/main.tsx` | `R5` | Tylko jeżeli harness nie pokaże realnego ekranu z panelem bez zmiany |
| `scripts/dev/grafika-zrzuty.mjs` | `R5` | Tylko jako NOWA opcja opt-in; domyślne zachowanie identyczne co do bitu |
| `public/locales/{pl,en}/translation.json` | `R3` | Tylko dopisanie kluczy, parytet PL+EN w jednym commicie, liczba liści rośnie albo zostaje |
| `server/migrations/20261280_day342_*.sql` | `R4` | Tylko jeżeli `R4` udowodni, że panel zapisuje stan i brakuje kolumny. Wyłącznie addytywna |
| `docs/…/modules/07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md` | `§R.1` | Zawsze na końcu, wyłącznie wiersz prawego panelu Idei i Notatnika |

## Pliki, których ten dyżur JAWNIE NIE ZAPISZE — imiennie

```
src/components/standard/ArtifactRightPanel.tsx     — kanoniczna powłoka, 61 konsumentów
src/components/ui/ResizableTable/PreviewPaneShell.tsx — kanon podgladu z listy
src/utils/artifactRightRailFlag.ts                 — flaga konkurencyjna, tylko odczyt
src/components/MyWork/notebook/notebookSpecAShellFlag.ts — flaga konkurencyjna, tylko odczyt
src/components/MyWork/panel/ideaPanel6SectionsFlag.ts    — flaga konkurencyjna, tylko odczyt
src/utils/ideaDetailsInPanelFlag.ts                — flaga konkurencyjna, tylko odczyt
src/utils/artifactStudioFlags.ts, src/utils/orgRedesignFlag.ts — flagi konkurencyjne
src/components/MyWork/mindmap/UnifiedNodeDetailDrawer.tsx — 2101 linii, wspolny
src/toolPacks/**, src/store/useToolStore.ts, src/components/DiscoveryTools/** — teren dyzuru 341
scripts/dev/g06-macierz-ekrany.json                — macierz ekranow, tylko odczyt
docs/.../reachability.baseline.json                — baza odniesienia osiagalnosci
tests/setup.ts, tests/helpers/**, vitest*.config.ts — Z18
.github/workflows/**                               — bramki CI
```

## Zasoby wyłączne tego dyżuru

| Zasób | Wartość | Sprawdzone (komenda + wynik) |
| --- | --- | --- |
| Port PostgreSQL | `6378` | `lsof -nP -iTCP:6378 -sTCP:LISTEN` → pusto |
| Port harnessu | `5518` | `lsof -nP -iTCP:5518 -sTCP:LISTEN` → pusto |
| Nazwa kontenera | `cx-day342-pg` | `docker ps --format '{{.Names}}' \| grep -c cx-day342-pg` → 0 |
| Nazwa bazy | `cx342` | tworzona przez `docker run` z `§0.2c` |
| **Przedział migracji** | **`20261280`–`20261289`** | `bash -c 'ls server/migrations/ \| grep -cE "^2026128"'` → 0 |
| Gałąź | `codex/day342-panel-idei-podlaczenie-20260904` | nie istnieje na `github-backup` |
| Worktree | `/private/tmp/cx-day342-panel-idei-podlaczenie` | nie istnieje |
| Flagi funkcyjne | `ff_idea_notebook_right_panel_prototype` — ISTNIEJĄCA, default **OFF**, nie zmieniasz wartości domyślnej; **zero nowych flag**; flagi konkurencyjne tylko do odczytu | `bash -c 'grep -rn "ff_idea_notebook_right_panel_prototype" src \| wc -l'` |

## Kontrola przed KAŻDYM commitem

```bash
cd /private/tmp/cx-day342-panel-idei-podlaczenie
git diff --name-only --cached | tee /private/tmp/cx-day342-panel-idei-podlaczenie-artefakty/staged.txt
grep -iE 'toolPacks|useToolStore|DiscoveryTools|ArtifactRightPanel.tsx|PreviewPaneShell|artifactRightRailFlag|notebookSpecAShellFlag|ideaPanel6SectionsFlag|ideaDetailsInPanelFlag|g06-macierz-ekrany|reachability.baseline' \
  /private/tmp/cx-day342-panel-idei-podlaczenie-artefakty/staged.txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## Prawo zatrzymania

„`R1` i `R2` wykonane, tabela pierwszeństwa flag gotowa, oto jedno pytanie do właściciela”
**jest wynikiem** — i lepszym niż trzecia flaga w tym samym miejscu albo panel wstawiony
w miejsce treści, której nie niesie.

Natomiast **nie jest** uprawnionym zatrzymaniem: „nie ma harnessu” (są cztery ekrany w macierzy),
„nie wolno mi ruszyć pliku” (tabela licencji jest licencją), „nie da się zmierzyć osiągalności”
(jest `reachability-from-root.mjs`), „kadry już są” (są kadry panelu na pustym tle — to warstwa 3,
nie 4), „testy przechodzą, więc działa” (to warstwa 1 z czterech).

**★ Ostatnie zdanie i najważniejsze: obalenie którejkolwiek mojej tezy jest SUKCESEM dyżuru,
a nie porażką. Jeżeli zmierzysz, że panel już jest podłączony i ta instrukcja opisuje zrobioną
pracę — napisz to wprost w pierwszym commicie i zatrzymaj się. Jeżeli Twój pomiar przeczy
liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz rozbieżność wprost.**
