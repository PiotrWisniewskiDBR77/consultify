# INSTRUKCJA DYŻURU nr 345 — Codex — „Panel Idei i Notatnika — domknięcie po dyżurze 342: zagnieżdżona para elementów aside, zgubiona szerokość i zmieniona nazwa dostępna przy fladze ON, martwa ścieżka env w trzech plikach flag, oraz para zrzutów Notatnika, której dziś NIE MOŻNA pokazać właścicielowi"

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
> **wyłącznie** `/private/tmp/cx-day345-panel-idei-dod`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `6a4919f72d`**
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
Zakres: **Moja Praca — prawy panel Idei i Notatnika (powłoka prototypu, powłoka SPEC-A, wspólny ArtifactRightPanel) · rodzina flag z obliczanym dostępem do env**.
Trasy front: `/my-work → Notatnik (`src/components/MyWork/notebook/NotebookRightRail.tsx`) i Idee (`src/components/standard/IdeaRightPanel.tsx`), powłoka prototypu (`src/components/MyWork/prototypes/IdeaNotebookRightPanelPrototype.tsx`), wspólny panel (`src/components/standard/ArtifactRightPanel.tsx`), flagi (`src/utils/ideaNotebookRightPanelPrototypeFlag.ts`, `src/utils/artifactRightRailFlag.ts`, `src/components/MyWork/notebook/notebookSpecAShellFlag.ts`), harnessy `dev-render/screens/prawy-pas-notatnik-system.tsx` i `dev-render/screens/mywork-notebook-rail-speca.tsx``. Trasy tył: `brak — dyżur jest frontowy; PostgreSQL służy wyłącznie migracjom, dowodowi `Z30` i ewentualnemu uruchomieniu runtime'u do zrzutów`.

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
WT=/private/tmp/cx-day345-panel-idei-dod
MARKER=6a4919f72d

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/grafika/m03-20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day345-panel-idei-dod-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day345-panel-idei-dod/config.worktree"
cat "$VAULT/worktrees/cx-day345-panel-idei-dod/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day345-panel-idei-dod-scratch
mkdir -p /private/tmp/cx-day345-panel-idei-dod-artefakty

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
git -C "$VAULT" log --oneline 6a4919f72d..github-backup/grafika/m03-20260902
git -C "$VAULT" diff --name-only 6a4919f72d..github-backup/grafika/m03-20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day345-panel-idei-dod-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 6a4919f72d..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `dziesięć` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day345-panel-idei-dod

# (1) ★ TEZA: powloka prototypu ma WLASNY <aside>, a `ArtifactRightPanel` MA DRUGI
grep -n '<aside' src/components/MyWork/prototypes/IdeaNotebookRightPanelPrototype.tsx \
                 src/components/standard/ArtifactRightPanel.tsx \
                 src/components/MyWork/notebook/NotebookRightRail.tsx
#   oczekiwane: prototyp ok. 80; ArtifactRightPanel ok. 527; NotebookRightRail ok. 421 (galaz legacy).
#   Prototyp renderuje `<ArtifactRightPanel>` WEWNATRZ swojego `<aside>` — stad para zagniezdzona.

# (2) ★ TEZA: prototyp ma TWARDA szerokosc, panel ma szerokosc z tokena
grep -n 'w-\[min(360px' src/components/MyWork/prototypes/IdeaNotebookRightPanelPrototype.tsx
grep -n 'ntype-right-panel-width' src/components/standard/ArtifactRightPanel.tsx \
                                  src/components/MyWork/notebook/NotebookRightRail.tsx
#   oczekiwane: prototyp `w-[min(360px,100vw)]` (i `max-[1279px]:w-[min(420px,100vw)]`);
#   panel `width = 'var(--ntype-right-panel-width)'` ok. 332. Token to 320 px — stad roznica 40 px.

# (3) ★ TEZA: nazwa dostepna panelu ZMIENIA SIE przy ON
grep -n 'aria-label' src/components/MyWork/prototypes/IdeaNotebookRightPanelPrototype.tsx \
                     src/components/MyWork/notebook/NotebookRightRail.tsx
#   oczekiwane: prototyp `aria-label={title}` (tytul notatki); legacy i sciezka SPEC-A
#   `t('notebook.rightRail.label', 'Document details and context')`. To sa DWIE ROZNE nazwy.

# (4) ★ TEZA: TRZY pliki flag tej sciezki maja OBLICZANY dostep do env (Vite go nie podstawia)
grep -n 'env?\.\[ENV_KEY\]\|env\.\[ENV_KEY\]\|meta.env?\.\[' \
  src/utils/ideaNotebookRightPanelPrototypeFlag.ts \
  src/utils/artifactRightRailFlag.ts \
  src/components/MyWork/notebook/notebookSpecAShellFlag.ts
#   oczekiwane: po jednym trafieniu w kazdym z trzech plikow.
#   Wzor NAPRAWY (statyczny dostep) — dyzur 341: src/utils/dynamicSwotSevenStagesFlag.ts

# (5) ★ TEZA: to jest RODZINA, nie trzy przypadki — policz jej rozmiar SAM
bash -c "grep -rl 'meta.env?\.\[\|meta?.env?\.\[\|env\[ENV_KEY\]' src/ | wc -l"
#   moja liczba: ok. 124 plikow. NIE naprawiasz ich wszystkich — naprawiasz TRZY z licencji
#   i oddajesz nadzorcy inwentarz reszty. Podaj SWOJA liczbe i komende, ktora ja dala.

# (6) ★ TEZA: dwa ekrany harnessu z odbioru NIE MONTUJA produkcyjnego hosta
grep -n '^import' dev-render/screens/notatnik-centrum-mysli.tsx | head -8
grep -n '^import' dev-render/screens/mywork-idea-inspector-lekki.tsx | head -8
grep -n 'NotebookRightRail' dev-render/screens/prawy-pas-notatnik-system.tsx \
                            dev-render/screens/mywork-notebook-rail-speca.tsx
#   oczekiwane: pierwsze dwa NIE importuja `NotebookRightRail` ani `IdeaRightPanel`;
#   ostatnie dwa importuja. Stad pary bajtowo identyczne — zly przyrzad, nie zly produkt.

# (7) TEZA: pierwszenstwo trzech flag jest takie, jak opisal dyzur 342
sed -n '370,385p' src/components/MyWork/notebook/NotebookRightRail.tsx
#   oczekiwane: `specAShellEnabled` z `isNotebookSpecAShellEnabled()`, `artifactRailEnabled`
#   z `isArtifactRightRailEnabled()`, `declareSections = specAShellEnabled || artifactRailEnabled`

# (8) TEZA: brama prototypu opakowuje realna sciezke jako `legacy`
sed -n '87,93p' src/components/MyWork/prototypes/IdeaNotebookRightPanelPrototype.tsx
#   oczekiwane: `if (!isIdeaNotebookRightPanelPrototypeEnabled()) return <>{legacy}</>;`

# (9) TEZA: liscie i18n
node -e 'const c=p=>{const o=JSON.parse(require("fs").readFileSync(p,"utf8"));let n=0;const w=x=>{if(Array.isArray(x))x.forEach(w);else if(x&&typeof x==="object")Object.values(x).forEach(w);else n++;};w(o);return n;};console.log(c("public/locales/pl/translation.json"),c("public/locales/en/translation.json"))'
#   oczekiwane: 35198 33065 — te liczby NIE MOGA zmalec

# (10) zasoby wolne
df -h /
lsof -nP -iTCP:6392 -sTCP:LISTEN; lsof -nP -iTCP:5532 -sTCP:LISTEN
docker ps -a --format '{{.Names}}' | grep cx-day345 || echo 'brak kontenera'
#   oczekiwane: powyzej 5 GB wolnego; oba porty puste; brak kontenera
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day345-panel-idei-dod-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6392`. Twój JEDYNY port harnessu to `5532`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day345-pg`**. **ZAKAZANE:** `5530, 5531, 5533 (runtime dyżurów 343, 344 i 346), 6390, 6391, 6393 (bazy dyżurów 343, 344 i 346), 5432 (cudzy nasłuch na hoście), a także wszystkie porty dyżurów 347-350, które inny autor wydaje równolegle w tej samej serii`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `ŻADNA — dyżur nie zakłada ani jednej NOWEJ flagi i nie zmienia wartości domyślnej żadnej zastanej. Pracuje na trzech zastanych: `ideaNotebookRightPanelPrototypeFlag` (default OFF), `artifactRightRailFlag` (default OFF) i `notebookSpecAShellFlag` (default ON, zmieniony świadomą decyzją DEC 03.09 R-11) — naprawia wyłącznie ich MARTWĄ ŚCIEŻKĘ ENV, nie ich domyślne`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/auth.middleware.ts`, `server/src/Gateway.ts`, `server/src/middleware/resultsInternalBetaVisibility.middleware.ts`, `server/src/middleware/appErrorMapper.ts`, `src/services/api.ts``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY345_PANEL_IDEI_DOD_REPORT.md`. Jedyny inny dokument do zmiany: `docs/program/waves/WAVE_03_ACCEPTANCE/modules/07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md` (istnieje na markerze; wyłącznie AKTUALIZACJA wierszy dotkniętych przez dyżur 342 i ewentualne dopisanie NOWEGO wiersza — zakaz kasowania i przeredagowywania pozostałych wierszy, `Z32`).. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day345-panel-idei-dod-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day345-panel-idei-dod-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ ZAKAZ OGŁOSZENIA `PASS` DLA DoD §18.1 BEZ ZMIERZONEJ PARY LICZB: szerokość panelu w pikselach przy OFF i przy ON, oraz liczba elementów `aside` w poddrzewie panelu przy OFF i przy ON. Dyżur 342 ogłosił `PASS` i to ogłoszenie było zawyżone — trzy pozycje listy nie były zmierzone. ★★ ZAKAZ ZMIANY WARTOŚCI DOMYŚLNEJ KTÓREJKOLWIEK Z TRZECH FLAG. ★★ ZAKAZ PRZERABIANIA `ArtifactRightPanel.tsx` — to jest wspólny panel sześciu powierzchni; naprawa ma być po stronie POWŁOKI PROTOTYPU, nie po stronie panelu, który dziś zachowuje się poprawnie. ★★ ZAKAZ POKAZANIA WŁAŚCICIELOWI PARY ZRZUTÓW, W KTÓREJ JEST CHOĆBY JEDEN BŁĄD KONSOLI ALBO SZARY PASEK SZKIELETU ZAMIAST TREŚCI. | Dyżur 342 (scalony) realnie podłączył panel — powłoka dostaje prawdziwe `sections` hosta, atrapy zostały wyłącznie jako fallback, treść urosła (Idee 749 → 798 znaków, Notatnik 860 → 958), zero nowych flag, pierwszeństwo flag potwierdzone mutacją przewodu, 17/17 PASS. Usunął też kłamiący przyrząd. Ale odbiór 04.09 pokazał, że deklaracja `PASS` dla DoD §18.1 obejmowała punkty, których nikt nie zmierzył, a para zrzutów Notatnika nie nadaje się do pokazania. Pamięć programu: „przyrząd kłamie, a oko przywyka" i „para bajtowo identyczna = zero dowodu" — dlatego próg tego dyżuru jest liczbowy, nie opisowy. |

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
cd /private/tmp/cx-day345-panel-idei-dod

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day345-pg psql -U postgres -d cx345 \
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
cd /private/tmp/cx-day345-panel-idei-dod

docker run -d --name cx-day345-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx345 \
  -p 127.0.0.1:6392:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day345-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6392/cx345 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6392/cx345 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day345-panel-idei-dod && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6392/cx345 \
JWT_SECRET=cx345-test-secret-do-not-reuse \
npx vitest run tests/unit/mywork tests/unit/flags --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day345-panel-idei-dod-artefakty/day345-panel-idei.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day345-panel-idei-dod && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run tests/unit/mywork tests/unit/flags --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day345-panel-idei-dod-artefakty/day345-panel-idei.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day345-panel-idei-dod/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day345-pg psql -U postgres -d cx345 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day345-pg`.
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
> **(e) EKRANY `dev-render/screens/notatnik-centrum-mysli.tsx` I `dev-render/screens/mywork-idea-inspector-lekki.tsx` NIE IMPORTUJĄ PRODUKCYJNEGO HOSTA PANELU. Zmierzone na markerze: pierwszy importuje `NotebookPresenceStack` i `NotebookReminderChip`, drugi nie importuje niczego z panelu — żaden z nich nie montuje `NotebookRightRail` ani `IdeaRightPanel`. Dlatego przełączenie flagi niczego w nich nie zmienia i para zrzutów wychodzi BAJTOWO IDENTYCZNA — to nie jest defekt produktu, tylko wybór niewłaściwego przyrządu. Ekrany, które montują realny host, to `dev-render/screens/prawy-pas-notatnik-system.tsx` i `dev-render/screens/mywork-notebook-rail-speca.tsx` (oba importują `NotebookRightRail` i `Api`). Druga pułapka: `notebookSpecAShellFlag` ma wartość domyślną ON, a dwie pozostałe OFF — pierwszeństwo rozstrzygania to `artifactRightRailFlag` > prototyp > `notebookSpecAShellFlag`, więc „flaga ON" bez podania KTÓREJ flagi nie jest opisem stanu. Trzecia: rozwijanie sekcji potrafi zamknąć podgląd, a skan zrobiony w trakcie animacji daje fałszywy kontrast — porównuj DŁUGOŚĆ TEKSTU z opcją i bez, zanim ogłosisz różnicę**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day345-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day345-panel-idei-dod-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1, R2, R4`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6392` albo `5532` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6392` albo `5532`** (`Z7`).

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

Prawy panel Idei i Notatnika był przez wiele tygodni przykładem **„zbudowane, ale niepodłączone”**:
istniała zaakceptowana powłoka prototypu, istniał wspólny `ArtifactRightPanel`, istniały sekcje
hosta — i nie było między nimi przewodu. Dyżur 342 (scalony jako `660482d485`) ten przewód
**naprawdę zrobił**:

- powłoka dostaje **prawdziwe `sections` hosta**, a atrapy zostały wyłącznie jako `fallback`
  (`IdeaNotebookRightPanelPrototype.tsx`, `const sections = hostSections ?? fallbackSections`);
- **treść urosła**: Idee 749 → 798 znaków, Notatnik 860 → 958;
- **zero nowych flag**; pierwszeństwo `artifactRightRailFlag` > prototyp > `notebookSpecAShellFlag`
  potwierdzone;
- mutacja przewodu RED→GREEN, 17/17 PASS;
- usunięty **kłamiący przyrząd**: `PrototypeHarness` podmieniał cały realny ekran na samotny
  prototyp, więc każdy poprzedni zrzut pokazywał nie produkt.

**Ten dyżur niczego z tego nie cofa.** Domykają go trzy zastrzeżenia odbioru 04.09.

### Zastrzeżenie 1 — ★ DEKLARACJA `PASS` DLA DoD §18.1 JEST ZAWYŻONA

Trzy punkty listy nie zostały zmierzone, a wszystkie trzy przy fladze ON **zmieniają się na
gorsze**:

1. **Szerokość panelu ginie.** Powłoka prototypu ma **twardo wpisaną** szerokość
   `w-[min(360px,100vw)]` (plus `max-[1279px]:w-[min(420px,100vw)]`), a produkcyjna ścieżka bierze
   szerokość z tokena `--ntype-right-panel-width` (`ArtifactRightPanel.tsx` ok. 332). Token jest
   **wspólnym źródłem szerokości sześciu prawych paneli** i został ustawiony świadomie: dyżur 164
   usunął z Notatnika dokładnie takie ręczne 360 px, bo pas był o 40 px szerszy od kart N
   (komentarz w `NotebookRightRail.tsx` ok. 1027-1033 opisuje to wprost). **Prototyp przywrócił
   defekt, który już raz naprawiono.**
2. **Powstaje zagnieżdżona para elementów `aside`.** Powłoka prototypu renderuje własny `<aside>`
   (ok. 80) i **wewnątrz niego** `<ArtifactRightPanel>`, który renderuje **drugi `<aside>`**
   (ok. 527). Dwa landmarki `complementary` jeden w drugim to nie jest kosmetyka — czytnik ekranu
   ogłasza dwa panele tam, gdzie jest jeden.
3. **Zmienia się nazwa dostępna panelu.** Ścieżka produkcyjna nazywa panel
   `t('notebook.rightRail.label', 'Document details and context')`; powłoka prototypu nazywa go
   **tytułem notatki** (`aria-label={title}`). Ten sam obiekt ma dwie różne nazwy zależnie od
   flagi.

### Zastrzeżenie 2 — ★ FLAGA MA MARTWĄ ŚCIEŻKĘ ENV

Wszystkie trzy pliki flag tej ścieżki czytają zmienną środowiskową **dostępem obliczanym**:

```
const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
… parseFlag(meta.env?.[ENV_KEY]) …
```

**Vite podstawia wartość wyłącznie przy dostępie STATYCZNYM.** Zapis obliczany zostaje w bundlu
nierozwiązany i cicho zwraca `undefined`, czyli warstwa env **nie działa** — działają tylko
`?query` i `localStorage`.

To jest **dokładnie ten defekt, który dyżur 341 wykrył na żywym bundlu i naprawił u siebie**:
`src/utils/dynamicSwotSevenStagesFlag.ts` niesie dziś komentarz „Keep the access static: Vite
replaces this expression in the browser bundle, while a computed `import.meta.env[ENV_KEY]` remains
unresolved”. **Zrób tak samo w swoich trzech plikach** — i nazwij resztę rodziny, nie naprawiając
jej (patrz `R3`, punkt 3).

### Zastrzeżenie 3 — ★ PARA ZRZUTÓW NOTATNIKA NIE NADAJE SIĘ DO POKAZANIA

Odbiór 04.09 zmierzył:

- **centrum dokumentu to szare paski szkieletu**, nie treść;
- **dziewięć błędów konsoli w obu stanach**;
- panel przewinięty, **tytuł ucięty**;
- ekrany `notatnik-centrum-mysli` i `mywork-idea-inspector-lekki` dają pary **bajtowo identyczne**.

**Przyczynę czwartego punktu zmierzyłem i jest inna, niż mówiło zlecenie** — patrz sprostowanie
niżej. Pierwsze trzy zostają jako defekty do usunięcia: właściciel nie może zobaczyć ekranu, na
którym centrum jest puste, a konsola się pali.

## ★ Sprostowanie zlecenia — co mój pomiar na markerze skorygował

1. **„Flaga ma martwą ścieżkę env — to dokładnie ten defekt, który dyżur 341 wykrył i naprawił;
   zrób tak samo”.** Zgadza się co do defektu i co do wzorca. **Ale ten defekt nie dotyczy jednej
   flagi — dotyczy TRZECH plików na Twojej ścieżce i ok. 124 plików w całym `src/`.** To jest
   rodzina, nie przypadek. Naprawiasz **trzy z licencji** i oddajesz nadzorcy **inwentarz reszty**
   z własną liczbą; nie wchodzisz w 124 pliki (`R3` punkt 3).
2. **„Ekrany `notatnik-centrum-mysli` i `mywork-idea-inspector-lekki` dają pary bajtowo identyczne,
   bo nie montują produkcyjnego hosta”.** **Potwierdzam i doprecyzowuję:**
   `notatnik-centrum-mysli.tsx` importuje `NotebookPresenceStack` i `NotebookReminderChip`,
   a `mywork-idea-inspector-lekki.tsx` nie importuje niczego z panelu — **żaden z nich nie
   importuje `NotebookRightRail` ani `IdeaRightPanel`.** To znaczy, że identyczna para **nie jest
   dowodem defektu produktu** — jest dowodem, że użyto niewłaściwego przyrządu.
   **Ekrany, które montują realny host, już istnieją:** `dev-render/screens/prawy-pas-notatnik-system.tsx`
   i `dev-render/screens/mywork-notebook-rail-speca.tsx`. Zaczynasz od nich (`R4`).
3. **„§18.1 ogłoszone `PASS` jest zawyżone”.** Potwierdzam co do trzech punktów wymienionych wyżej.
   **Reszta deklaracji dyżuru 342 obroniła się w odbiorze** — nie przepisuj całego wiersza odbioru
   modułu na czerwono; poprawiasz trzy punkty i mówisz, które to.
4. **`notebookSpecAShellFlag` ma wartość domyślną ON, nie OFF.** To jest **świadoma decyzja
   właściciela** (DEC 03.09 wieczór, wiersz `R-11` / `MYW-NBK-CORE-001`, zapis w
   `docs/program/DECYZJE_WLASCICIELA_P0P1_20260904.md`). **Nie „naprawiaj” tego przez zmianę
   defaultu.** Zdanie „flaga ON” bez podania **której** flagi nie jest opisem stanu — w tej
   ścieżce działają trzy i mają pierwszeństwo.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz
rozbieżność wprost.**

## ★ Zmierz moje liczby sam

Twierdzę: powłoka prototypu ma **1** własny `<aside>` (ok. 80), `ArtifactRightPanel` ma **1**
(ok. 527), więc przy ON w poddrzewie panelu jest ich **2**; szerokość prototypu to
`min(360px,100vw)`, a produkcyjna to token `--ntype-right-panel-width` = **320 px**, czyli różnica
**40 px**; nazwy dostępne są **2 różne**; plików flag z obliczanym dostępem do env na Twojej
ścieżce jest **3**, a w całym `src/` około **124**; ekranów harnessu montujących realny host są
**2**, a tych z odbioru — **0**; treść po podłączeniu: Idee **798** znaków, Notatnik **958**;
liście `public/locales/pl/translation.json` = **35198**, `en` = **33065**.

**Każdą z tych liczb policz sam, u siebie, na swojej bazie. Przepisanie mojej liczby jest
zawyżeniem i podstawą odrzucenia raportu (`Z24`).**

---

## B.1. TABELA LICENCJI PLIKOWYCH — CAŁA ŚCIEŻKA

> **★★ ZASTRZEŻENIE.** Poniższa tabela **JEST** licencją. Jeżeli plik, którego potrzebujesz, jest
> opisany jako „PEŁNA/WĄSKA LICENCJA” — **masz pozwolenie i STOP z tytułu »nie wolno mi« jest
> NIEZASADNY**. Jeżeli pliku nie ma w tabeli — domyślnie **TYLKO DO ODCZYTU**, a Twoim produktem
> jest czerwony kontrakt + brief, **nie zatrzymanie dyżuru**.

| Warstwa | Plik / wzorzec | Licencja | Co robisz, gdy pozycja wymagałaby zmiany pliku TYLKO-DO-ODCZYTU |
| --- | --- | --- | --- |
| **powłoka prototypu (rdzeń dyżuru)** | `src/components/MyWork/prototypes/IdeaNotebookRightPanelPrototype.tsx` | **★ PEŁNA LICENCJA — WYŁĄCZNIE w zakresie: (a) usunięcia zagnieżdżenia `aside`; (b) oddania szerokości tokenowi `--ntype-right-panel-width`; (c) ustabilizowania nazwy dostępnej.** ZAKAZ zmiany zawartości sekcji, kolejności i `fallbackSections` — kompozycja została zaakceptowana przez właściciela | Gotowy diff w bloku kodu, **nienałożony**, + brief: promień rażenia, co widzi właściciel przed i po |
| **wspólny panel** | `src/components/standard/ArtifactRightPanel.tsx` | **TYLKO ODCZYT — PLIK PRZEKROJOWY.** Renderuje `<aside>` i szerokość z tokena **poprawnie** i obsługuje sześć powierzchni; naprawa ma być po stronie powłoki, nie panelu | **CZERWONY KONTRAKT TESTOWY**: nowy plik testu, który **dziś PADA** i opisuje żądane zachowanie, oznaczony `it('KONTRAKT DLA DYŻURU 345 — …')` z nagłówkiem `// CZERWONY Z ZAŁOŻENIA — nie regresja tego dyżuru`, + brief: plik:linia · promień rażenia (ile powierzchni) · jak wyglądałby dowód mutacyjny. **Pozycja z takim produktem jest ZROBIONA, nie STOP** |
| **wspólna szyna** | `src/components/standard/ArtifactRightRail.tsx` | **TYLKO ODCZYT — PLIK PRZEKROJOWY** (jedenaście prawych szyn w promieniu) | jak wyżej |
| **host Notatnika** | `src/components/MyWork/notebook/NotebookRightRail.tsx` | **★ WĄSKA LICENCJA — WYŁĄCZNIE przekazanie do bramy prototypu tego, czego brakuje jej do zachowania szerokości i nazwy dostępnej** (np. jawny `ariaLabel`). ZAKAZ zmiany gałęzi `legacyRail` i `specAPanel` — one są zastane i zaakceptowane | Gotowy diff nienałożony + brief |
| **host Idei** | `src/components/standard/IdeaRightPanel.tsx` | **★ WĄSKA LICENCJA — jak wyżej**, wyłącznie wokół wywołania `IdeaNotebookRightPanelPrototypeGate` (ok. 422-427) | Gotowy diff nienałożony + brief |
| **flagi (rdzeń dyżuru)** | `src/utils/ideaNotebookRightPanelPrototypeFlag.ts`, `src/utils/artifactRightRailFlag.ts`, `src/components/MyWork/notebook/notebookSpecAShellFlag.ts` | **★ WĄSKA LICENCJA — WYŁĄCZNIE zamiana obliczanego dostępu `meta.env?.[ENV_KEY]` na dostęp STATYCZNY do konkretnej zmiennej.** **ZAKAZ zmiany wartości domyślnej którejkolwiek z trzech** (OFF, OFF, ON — trzecia zmieniona świadomą decyzją właściciela). **ZAKAZ wpisu do `.env*`, `docker-compose*`, `railway*`** (`Z10`). ★ `artifactRightRailFlag.ts` jest czytany przez **jedenaście** powierzchni — zmiana ma być zachowawcza i pokryta testem defaultu | — |
| **wzorzec naprawy flagi** | `src/utils/dynamicSwotSevenStagesFlag.ts` | **TYLKO ODCZYT — to jest wzorzec, nie materiał do edycji** | Errata w raporcie |
| **rodzina flag (reszta)** | pozostałe ok. 121 plików `src/utils/*Flag.ts` i `src/components/**/*Flags.ts` z tym samym obliczanym dostępem | **BEZ LICENCJI — TYLKO ODCZYT I POLICZENIE.** Ten dyżur ich NIE naprawia | Inwentarz w rejestrze: liczba, komenda, lista plików, szacunek pracy, rekomendacja kolejności. **Pozycja z takim produktem jest ZROBIONA** |
| **walidator (NOWE pliki)** | `tests/unit/mywork/**`, `tests/unit/flags/**` | **★ PEŁNA LICENCJA**, z zastrzeżeniem `Z18` i `Z31`. **★ NOWE PLIKI TESTOWE KŁADZIESZ W `tests/`, NIGDY POD `src/`** — dyżur 342 położył swoje testy pod `src/`, bezpiecznik osiągalności zaczerwienił się i trzeba było je przenosić osobnym commitem (`6a4919f72d`, marker tego dyżuru). **Nie powtórz tego.** `git add -f` obowiązkowo | — |
| **walidator (ZASTANE)** | `src/components/MyWork/notebook/__tests__/NotebookRightRail.behavior.test.tsx`, `src/components/MyWork/prototypes/__tests__/IdeaNotebookRightPanelProductionWire.test.tsx`, `src/components/MyWork/notebook/__tests__/notebookSpecAShellFlag.test.ts`, `tests/unit/flags/flagiDomyslnieOn.test.ts` | **★ WĄSKA LICENCJA — WYŁĄCZNIE dopisywanie NOWYCH przypadków `it(...)` do plików, KTÓRE JUŻ ISTNIEJĄ.** Zakaz zmiany i osłabiania istniejących asercji (`Z40`). Każdy NOWY plik idzie do `tests/` | Nowy plik testowy w `tests/`, z nagłówkiem `// KONTRAKT DYŻURU 345` |
| **przyrząd (właściwy)** | `dev-render/screens/prawy-pas-notatnik-system.tsx`, `dev-render/screens/mywork-notebook-rail-speca.tsx`, `dev-render/main.tsx` | **★ PEŁNA LICENCJA** — oba montują realny `NotebookRightRail`. To jest właściwe miejsce pomiaru. **Host harnessu nie jest produktem**; kontrolki harnessu nie mogą wejść w kadr | — |
| **przyrząd (niewłaściwy)** | `dev-render/screens/notatnik-centrum-mysli.tsx`, `dev-render/screens/mywork-idea-inspector-lekki.tsx` | **★ WĄSKA LICENCJA — wyłącznie dopisanie montażu realnego hosta, jeżeli uznasz to za tańsze niż nowy ekran.** ZAKAZ zmiany zastanej kompozycji tych ekranów — inne dyżury robią z nich zrzuty | Opis w raporcie + gotowy diff nienałożony |
| **narzędzie zrzutów** | `scripts/dev/grafika-zrzuty.mjs` | **★ WĄSKA LICENCJA — WYŁĄCZNIE zmiany ADDYTYWNE i OPT-IN** (nowy parametr, domyślnie wyłączony). **ZAKAZ zmiany zachowania domyślnego.** **ZAKAZ pisania własnego skryptu zrzutowego obok kanonicznego** — doraźny skrypt obok kanonicznego dał już raz parę identycznych obrazów i meldunek sukcesu | Opis brakującej zdolności w raporcie + gotowy diff |
| **i18n** | `public/locales/pl/translation.json`, `public/locales/en/translation.json` | **★ WYŁĄCZNIE DOPISYWANIE KLUCZY**, parytet PL+EN w tym samym commicie. Zakaz zmiany istniejących wartości. **Liczba liści nie może zmaleć** (35198 / 33065). ★ Klucz w `pl` trzymający angielskie słowo NIE jest przetłumaczony | — |
| **odbiór modułu** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md` | **★ WĄSKA LICENCJA — wyłącznie aktualizacja wierszy dotkniętych przez dyżur 342 i dopisanie NOWEGO wiersza.** Zakaz kasowania i przeredagowywania pozostałych (`Z32`) | — |
| **dowody** | `evidence/panel-idei-dod-20260904/**` (**NOWY**) | **★ PEŁNA LICENCJA**, `git add -f` | — |
| **raport** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY345_PANEL_IDEI_DOD_REPORT.md` (**NOWY**) | `§R.2` — **JEDYNY nowy dokument raportowy** (`Z13`) | — |
| **migracje** | `server/migrations/**` | **BEZ LICENCJI — ten dyżur nie dodaje ani nie zmienia żadnej migracji.** Przedział nie jest mu przydzielony | Uznasz migrację za potrzebną → **STOP MERYTORYCZNY z briefem**, przechodzisz do następnej pozycji |
| **kanon (dokumentacja)** | `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md` (§18.1), `docs/ui-standards/TRIADA_KANON.md`, `docs/program/grafika/ANALIZA_PRAWY_PANEL.md`, `docs/program/grafika/KANON_Z_ODBIOROW.md` | **TYLKO ODCZYT** | Errata w raporcie |
| **infra testowa** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie: co blokuje pomiar, jaka byłaby zmiana, jak obszedłeś to zmiennymi w linii komendy. Pozycja jest **ZROBIONA** z takim opisem |
| **cudzy teren** | `src/components/Initiatives/**` — **teren dyżuru 343**; `src/components/DiscoveryTools/**` — **teren dyżuru 344**; `server/src/services/report/**`, `server/src/routes/assessment-reports.routes.ts` — **teren dyżuru 346**; wszystko dotknięte przez dyżury 347-350 tej serii | **TYLKO ODCZYT** | Wpis do raportu: plik, linia, treść problemu, **gotowa rekomendacja jako diff w bloku kodu, nienałożony**. Pozycja idzie dalej |
| — | **Wszystko inne** | **TYLKO ODCZYT** | Opisujesz potrzebę w raporcie z dowodem plik:linia i idziesz dalej |

---

## B.2. TABELA POZYCJI

**Jedna pozycja = jeden wiersz = jeden commit = jeden werdykt. Commit robisz PO KAŻDEJ pozycji,
push na `github-backup` po pierwszym commicie i po każdej kolejnej (`Z34a`).**

| Pozycja | Nazwa | Rdzeń? | Wymaga plików przekrojowych? | DoD podniesione | Definicja ukończenia | Komenda dowodowa | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | Pomiar wejściowy §18.1: trzy pary liczb, nie trzy zdania | TAK | NIE — dowód: `grep -n '<aside' …` i `grep -n 'w-\[min(360px' …` pokazują, że pomiar jest odczytem, a reszta idzie z DOM | bazowe | Zmierzone przy OFF i przy ON: **szerokość panelu w px**, **liczba `aside` w poddrzewie panelu**, **nazwa dostępna panelu**. Sześć wartości, każda z komendą | `node scripts/dev/grafika-zrzuty.mjs --zlicz='aside:aside;panel:[data-testid="notebook-artifact-right-rail"]' --wynik-json=…` ×2 + odczyt `getBoundingClientRect().width` i `aria-label` z DOM | `docs(day345): pomiar wejsciowy §18.1 — szerokosc, aside, nazwa dostepna (345 R1)` |
| R2 | **RDZEŃ: `aside` niezagnieżdżone, szerokość zachowana, nazwa dostępna stabilna** | TAK | NIE — dowód: `B.1` daje pełną licencję na powłokę prototypu w wąskim zakresie | +1 test broniący ZACHOWANIA | Przy ON: **dokładnie 1** `aside` w poddrzewie panelu; szerokość **równa** szerokości przy OFF; nazwa dostępna **identyczna** jak przy OFF. Test montuje komponent i asertuje wszystkie trzy | `npx vitest run tests/unit/mywork --retry=0 --reporter=json --outputFile=…` | `fix(mywork): panel prototypu bez zagniezdzonego aside, szerokosc i nazwa jak w produkcji (345 R2)` |
| R3 | Trzy flagi ze statycznym dostępem do env + inwentarz rodziny | NIE | NIE | +1 test | Trzy pliki czytają env dostępem statycznym; **wartości domyślne bez zmian** (OFF/OFF/ON); test defaultu dla każdej; mutacja odwracająca default → **RED**. Inwentarz reszty rodziny z własną liczbą i komendą | `npx vitest run tests/unit/flags --retry=0 --reporter=json --outputFile=…` + `grep -rn '<nazwy trzech zmiennych>' .env* docker-compose* railway* 2>/dev/null` → 0 trafień | `fix(flags): statyczny dostep do env w trzech flagach panelu, defaulty bez zmian (345 R3)` |
| R4 | **RDZEŃ: para zrzutów Notatnika gotowa do pokazania właścicielowi** | TAK | NIE | n/d | Zrzuty z ekranu montującego **realny host**; **zero błędów konsoli** w obu stanach; centrum dokumentu z **treścią, nie szkieletem**; tytuł panelu **nieucięty**; sekcje ROZWINIĘTE; **różne sumy `shasum -a 256`** + średnia jasność; light + dark | `node scripts/dev/grafika-zrzuty.mjs …` + `shasum -a 256 evidence/panel-idei-dod-20260904/*.png` + zrzut konsoli do pliku | `docs(day345): para zrzutow Notatnika bez bledow konsoli i bez szkieletu (345 R4)` |
| R5 | Para zrzutów Idei — ten sam próg | NIE | NIE | n/d | Jak `R4`, dla `IdeaRightPanel` | jw. | `docs(day345): para zrzutow panelu Idei (345 R5)` |
| R6 | Raport + sprostowanie odbioru modułu | NIE | NIE | n/d | Struktura `§R.2`, sekcja „TWIERDZENIA NIEZWERYFIKOWANE” **niepusta**; w `07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md` poprawione **trzy punkty** §18.1, reszta wiersza nietknięta | — | `docs(day345): raport i sprostowanie trzech punktow §18.1` |

> **Kolumna „Wymaga plików przekrojowych?” jest wypełniona dla KAŻDEJ pozycji, z dowodem przy
> odpowiedzi `NIE`.** Pliki przekrojowe w promieniu tego dyżuru to
> `src/components/standard/ArtifactRightPanel.tsx` i `ArtifactRightRail.tsx` — **żadna pozycja ich
> nie zmienia**, bo oba zachowują się poprawnie, a defekt jest w powłoce prototypu. Jeśli uznasz,
> że musi — produktem jest czerwony kontrakt + brief, a pozycja jest **ZROBIONA**.

---

## B.3. TABELA MIANOWNIKÓW

**Każdą z tych liczb mierzysz sam (`Z24`) i podajesz swoją. Wszystkie komendy uruchamiasz
w `bash`, nigdy w `zsh` — `grep --include` w `zsh` zwraca pustkę zamiast wyniku, a pustka nie jest
wynikiem, dopóki nie sprawdzisz, że polecenie się wykonało.**

| # | Co liczę | Liczba autora | Komenda | Obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | Elementy `aside` w poddrzewie panelu przy OFF | 1 | `--zlicz='aside:aside'` na ekranie montującym realny host | TAK — **jedyny dopuszczalny przyrząd**; nigdy liczenie ze zrzutu |
| 2 | Elementy `aside` w poddrzewie panelu przy ON | 2 | jw. | TAK — powłoka prototypu ok. 80 + `ArtifactRightPanel` ok. 527 |
| 3 | Szerokość panelu przy OFF | 320 px (token `--ntype-right-panel-width`) | `getBoundingClientRect().width` z DOM | TAK — token deklarowany w `ArtifactRightPanel.tsx` ok. 214 i 332 |
| 4 | Szerokość panelu przy ON | 360 px (twarde `w-[min(360px,100vw)]`) | jw. | TAK — różnica 40 px to ten sam defekt, który naprawił dyżur 164 |
| 5 | Nazwy dostępne panelu (OFF vs ON) | 2 różne | `aria-label` z DOM w obu stanach | TAK — `'Document details and context'` vs tytuł notatki |
| 6 | Pliki flag Twojej ścieżki z obliczanym dostępem do env | 3 | `grep -n 'meta.env?\.\[\|meta?.env?\.\[' src/utils/ideaNotebookRightPanelPrototypeFlag.ts src/utils/artifactRightRailFlag.ts src/components/MyWork/notebook/notebookSpecAShellFlag.ts` | TAK — po jednym w każdym |
| 7 | Cała rodzina plików z tym samym zapisem w `src/` | ok. 124 | `bash -c "grep -rl 'meta.env?\.\[\|meta?.env?\.\[\|env\[ENV_KEY\]' src/ \| wc -l"` | TAK — **podaj swoją liczbę i swoją komendę**; ten dyżur naprawia 3, inwentaryzuje resztę |
| 8 | Powierzchnie czytające `isArtifactRightRailEnabled` | 11 | `grep -rln 'isArtifactRightRailEnabled' src/ dev-render/` | TAK — promień rażenia zmiany w tym pliku flagi |
| 9 | Ekrany harnessu montujące realny host panelu | 2 | `grep -rln 'NotebookRightRail\|IdeaRightPanel' dev-render/screens/` | TAK — `prawy-pas-notatnik-system.tsx`, `mywork-notebook-rail-speca.tsx`; ekrany z odbioru dają **0** |
| 10 | Liście `translation.json` | pl 35198 / en 33065 | `node -e 'const c=p=>{const o=JSON.parse(require("fs").readFileSync(p,"utf8"));let n=0;const w=x=>{if(Array.isArray(x))x.forEach(w);else if(x&&typeof x==="object")Object.values(x).forEach(w);else n++;};w(o);return n;};console.log(c("public/locales/pl/translation.json"),c("public/locales/en/translation.json"))'` | TAK — **liczba nie może zmaleć** |

---

## B.4. TABELA ROZŁĄCZNOŚCI

### B.4.1. Pliki zapisywane NA PEWNO

| # | Plik | Rodzaj | Pozycja | Ryzyko kolizji |
| --- | --- | --- | --- | --- |
| 1 | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY345_PANEL_IDEI_DOD_REPORT.md` | NOWY | R6 | ZEROWE |
| 2 | `evidence/panel-idei-dod-20260904/**` | NOWY | R1/R4/R5 | ZEROWE |
| 3 | `src/components/MyWork/prototypes/IdeaNotebookRightPanelPrototype.tsx` | ZASTANY | R2 | ŚREDNIE — dotknięty przez dyżur 342; **zmieniasz trzy zakresy z `B.1`, nigdy kompozycję sekcji** |
| 4 | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md` | ZASTANY — aktualizacja wierszy | R6 | ŚREDNIE — aktualizowany przez dyżur 342; **poprawiasz trzy punkty, nie przepisujesz dokumentu** |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Pozycja | Warunek |
| --- | --- | --- |
| `src/utils/ideaNotebookRightPanelPrototypeFlag.ts` | R3 | Wyłącznie statyczny dostęp do env; default `false` bez zmian |
| `src/utils/artifactRightRailFlag.ts` | R3 | Jak wyżej; ★ czytany przez 11 powierzchni — test defaultu obowiązkowy |
| `src/components/MyWork/notebook/notebookSpecAShellFlag.ts` | R3 | Jak wyżej; **default `true` bez zmian** (decyzja właściciela `R-11`) |
| `src/components/MyWork/notebook/NotebookRightRail.tsx`, `src/components/standard/IdeaRightPanel.tsx` | R2 | Tylko jeżeli brama prototypu potrzebuje jawnego `ariaLabel` albo szerokości od hosta |
| `tests/unit/mywork/**`, `tests/unit/flags/**` (NOWE) | R2/R3 | `git add -f`; test musi czerwienić się od mutacji ZABEZPIECZENIA, nie mechanizmu |
| `dev-render/screens/prawy-pas-notatnik-system.tsx`, `mywork-notebook-rail-speca.tsx`, `dev-render/main.tsx` | R1/R4/R5 | Tylko jeżeli przyrząd nie pozwala zamontować obu stanów z realną treścią; kontrolki harnessu poza kadrem |
| `dev-render/screens/notatnik-centrum-mysli.tsx`, `mywork-idea-inspector-lekki.tsx` | R4/R5 | Wyłącznie dopisanie montażu realnego hosta; zastana kompozycja bez zmian |
| `scripts/dev/grafika-zrzuty.mjs` | R1/R4/R5 | Tylko addytywnie i opt-in; zachowanie domyślne bit w bit jak dziś |
| `public/locales/{pl,en}/translation.json` | R2 | Tylko dopisanie kluczy, parytet w tym samym commicie, liczba liści nie maleje |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

```
src/components/standard/ArtifactRightPanel.tsx           — przekrojowy, zachowuje sie poprawnie
src/components/standard/ArtifactRightRail.tsx            — przekrojowy, 11 prawych szyn
src/utils/dynamicSwotSevenStagesFlag.ts                  — wzorzec naprawy, nie material do edycji
pozostale ok. 121 plikow flag z obliczanym dostepem      — inwentarz, nie naprawa
src/components/Initiatives/**                            — teren dyzuru 343
src/components/DiscoveryTools/**                         — teren dyzuru 344
server/src/services/report/**                            — teren dyzuru 346
server/src/routes/assessment-reports.routes.ts           — teren dyzuru 346
server/migrations/**                                     — przedzial nieprzydzielony
```

### B.4.4. Zasoby wyłączne

| Zasób | Wartość | Sprawdzone |
| --- | --- | --- |
| Port PostgreSQL | 6392 | `lsof -nP -iTCP:6392 -sTCP:LISTEN` → puste (sprawdzone przy pisaniu instrukcji, marker `6a4919f72d`) |
| Port harnessu | 5532 | `lsof -nP -iTCP:5532 -sTCP:LISTEN` → puste |
| Nazwa kontenera | `cx-day345-pg` | `docker ps -a --format '{{.Names}}' \| grep cx-day345` → brak |
| Nazwa bazy | `cx345` | n/d |
| **Przedział migracji** | **NIEPRZYDZIELONY** — dyżur nie dodaje migracji | n/d |
| Gałąź | `codex/day345-panel-idei-dod-20260904` | nie istnieje na `github-backup` |
| Worktree | `/private/tmp/cx-day345-panel-idei-dod` | nie istnieje |
| Flagi funkcyjne | trzy **ZASTANE**: `ideaNotebookRightPanelPrototypeFlag` (OFF), `artifactRightRailFlag` (OFF), `notebookSpecAShellFlag` (**ON**, decyzja właściciela `R-11`). **Żadnej nowej, żadna domyślna nie zmienia się** | `grep -rn 'VITE_IDEA_NOTEBOOK_RIGHT_PANEL_PROTOTYPE\|VITE_ARTIFACT_RIGHT_RAIL_ENABLED\|VITE_ENABLE_NOTEBOOK_SPEC_A_SHELL' .env* docker-compose* railway* 2>/dev/null` → 0 trafień na markerze |

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
cd /private/tmp/cx-day345-panel-idei-dod
git diff --name-only --cached | tee /private/tmp/cx-day345-panel-idei-dod-artefakty/staged.txt
grep -iE 'standard/ArtifactRightPanel|standard/ArtifactRightRail|dynamicSwotSevenStagesFlag|components/Initiatives/|components/DiscoveryTools/|services/report/|assessment-reports\.routes|server/migrations/' \
  /private/tmp/cx-day345-panel-idei-dod-artefakty/staged.txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged <plik>)" \
  || echo "rozlacznosc OK"

# ★ NOWY plik testowy pod src/ czerwieni bezpiecznik osiagalnosci — to sie zdarzylo dyzurowi 342:
git diff --name-only --cached --diff-filter=A | grep -E '^src/.*\.(test|spec)\.(ts|tsx)$' \
  && echo "★★ NOWY TEST POD src/ — PRZENIES DO tests/" || echo "testy we wlasciwym miejscu"

# ★ zadna z trzech flag nie zmienila domyslnej:
git diff --cached -- src/utils/ideaNotebookRightPanelPrototypeFlag.ts \
  src/utils/artifactRightRailFlag.ts \
  src/components/MyWork/notebook/notebookSpecAShellFlag.ts | grep -E '^[-+].*ENABLE_.*=' \
  && echo "★★ SPRAWDZ, CZY NIE RUSZYLES WARTOSCI DOMYSLNEJ" || echo "domyslne nietkniete"
```

---

## R1 — POMIAR WEJŚCIOWY §18.1: TRZY PARY LICZB, NIE TRZY ZDANIA

**Ta pozycja nie naprawia niczego.** Ma zamienić trzy zastrzeżenia opisowe na **sześć wartości**,
które da się porównać po naprawie.

| # | Co mierzysz | Przy OFF | Przy ON |
| --- | --- | --- | --- |
| 1 | Szerokość panelu w px (`getBoundingClientRect().width`) | ? | ? |
| 2 | Liczba elementów `aside` w poddrzewie panelu | ? | ? |
| 3 | Nazwa dostępna panelu (`aria-label` korzenia) | ? | ? |

**Pomiar robisz na ekranie, który montuje REALNY host** — `dev-render/screens/prawy-pas-notatnik-system.tsx`
albo `dev-render/screens/mywork-notebook-rail-speca.tsx`. **Ekrany `notatnik-centrum-mysli`
i `mywork-idea-inspector-lekki` nie montują hosta i dadzą Ci parę bajtowo identyczną** — to nie
byłby wynik, tylko brak pomiaru.

```bash
cd /private/tmp/cx-day345-panel-idei-dod
node scripts/dev/grafika-zrzuty.mjs \
  --zlicz='aside:aside;panel:[data-testid="notebook-artifact-right-rail"]' \
  --wynik-json=/private/tmp/cx-day345-panel-idei-dod-artefakty/r1-off.json \
  <pozostałe parametry przelotu wg pomocy narzędzia>
#   oczekiwane OFF: aside 1   ·   oczekiwane ON: aside 2
```

**Podaj też, KTÓRA z trzech flag była w każdym przebiegu włączona.** „Flaga ON” bez nazwy nie jest
opisem stanu — pierwszeństwo to `artifactRightRailFlag` > prototyp > `notebookSpecAShellFlag`,
a trzecia jest domyślnie **ON**.

Prawo zatrzymania po tej pozycji.

## R2 — RDZEŃ: `aside` NIEZAGNIEŻDŻONE, SZEROKOŚĆ ZACHOWANA, NAZWA DOSTĘPNA STABILNA

Wymagania, w kolejności rozstrzygającej:

1. **Przy ON w poddrzewie panelu jest DOKŁADNIE JEDEN `aside`.** Rozwiązanie po stronie powłoki
   prototypu: albo jej korzeń przestaje być `aside` (zostaje `div`, bo landmark niesie już
   `ArtifactRightPanel`), albo powłoka przestaje renderować `ArtifactRightPanel` z jego własnym
   landmarkiem. **Wybierasz jedno, uzasadniasz w raporcie i nie ruszasz `ArtifactRightPanel.tsx`.**
2. **Szerokość przy ON jest RÓWNA szerokości przy OFF.** Twarde `w-[min(360px,100vw)]` ustępuje
   tokenowi `--ntype-right-panel-width`. To jest powrót do rozstrzygnięcia dyżuru 164, opisanego
   w komentarzu w `NotebookRightRail.tsx` — **przeczytaj ten komentarz przed zmianą**, żeby nie
   cofnąć jej po raz drugi.
3. **Nazwa dostępna jest identyczna w obu stanach.** Panel ma jedną tożsamość niezależnie od tego,
   za którą flagą stoi.
4. **Zawartość, kolejność sekcji i `fallbackSections` bez zmian** — kompozycja jest zaakceptowana.

**Dowód mutacyjny wycelowany w ZABEZPIECZENIE, nie w mechanizm** (`Z32`), w obie strony:

- przywróć twardą szerokość `w-[min(360px,100vw)]` → test **CZERWONY**;
- przywróć własny `<aside>` w powłoce prototypu → test **CZERWONY**;
- przywróć `aria-label={title}` → test **CZERWONY**;
- cofnij każdą przez `cp` z kopii w katalogu scratch (`Z27`, **nigdy `git stash`**) → **ZIELONY**,
  `git diff` po cofnięciu **pusty**.

**Jeżeli którakolwiek z trzech mutacji nie czerwieni — pozycja jest NIEZROBIONA.** Test, który
asertuje samą obecność komponentu, nie broni żadnego z tych trzech punktów.

Prawo zatrzymania po tej pozycji.

## R3 — TRZY FLAGI ZE STATYCZNYM DOSTĘPEM DO ENV + INWENTARZ RODZINY

1. **Trzy pliki z licencji czytają zmienną środowiskową dostępem STATYCZNYM.** Wzorzec:
   `src/utils/dynamicSwotSevenStagesFlag.ts` (naprawa dyżuru 341, z komentarzem wyjaśniającym
   dlaczego). Kolejność warstw i wartości domyślne **bez zmian**.
2. **Wartość domyślna każdej z trzech zostaje taka, jaka jest** — OFF, OFF i **ON**. Trzecia jest
   ON **świadomą decyzją właściciela** (`R-11`, `MYW-NBK-CORE-001`); zmiana jej na OFF byłaby
   cofnięciem decyzji, nie naprawą. Test defaultu dla każdej z trzech; **mutacja odwracająca
   default → RED**.
3. **Inwentarz rodziny.** Ten sam obliczany zapis jest w całym `src/` w ok. **124** plikach.
   **Nie naprawiasz ich.** Produktem jest wpis w rejestrze: własna liczba, komenda, która ją dała,
   pełna lista ścieżek (w załączniku poza repo, z sumą `shasum -a 256`), szacunek pracy
   i rekomendacja kolejności — które flagi mają realny wpływ na to, co widzi właściciel.
   **Pozycja z takim produktem jest ZROBIONA, nie STOP.**
4. **Zero wpisów** do `.env*`, `docker-compose*`, `railway*` (`Z10`) — sprawdzasz komendą
   i wklejasz wynik.

Prawo zatrzymania po tej pozycji.

## R4 — RDZEŃ: PARA ZRZUTÓW NOTATNIKA, KTÓRĄ MOŻNA POKAZAĆ WŁAŚCICIELOWI

**★ Właściciel NIGDY nie jest pierwszym testerem wizualnym.** Ty renderujesz realny ekran, Ty
robisz zrzut, zrzut ma być **czysty**: tokeny `c-*`, zero ozdób, **zero kontrolek harnessu
w kadrze**.

Próg — **wszystkie warunki naraz**, bo trzy z nich odbiór 04.09 zmierzył jako złamane:

- ekran **montuje realny host** (`prawy-pas-notatnik-system.tsx` albo `mywork-notebook-rail-speca.tsx`);
- **ZERO błędów konsoli** w obu stanach; zrzut konsoli idzie do pliku dowodowego. Odbiór naliczył
  **dziewięć** — wypisz swoje co do sztuki;
- **centrum dokumentu pokazuje TREŚĆ, nie szare paski szkieletu.** Jeżeli host czeka na dane,
  poczekaj na nie albo podaj mu dane; zrzut szkieletu nie jest zrzutem ekranu;
- **tytuł panelu nieucięty**, panel nieprzewinięty;
- **sekcje ROZWINIĘTE**; rozwijaj tak, żeby nie zamykało to podglądu, a skan rób po zakończeniu
  animacji — skan w połowie przejścia daje fałszywy kontrast;
- **`shasum -a 256` obu plików RÓŻNE** + średnia jasność obu. **Para bajtowo identyczna = ZERO
  dowodu**; to samo dotyczy pary light/dark;
- harness kanoniczny `scripts/dev/grafika-zrzuty.mjs`, **zakaz własnego skryptu obok**.

**Jeżeli któregokolwiek warunku nie da się spełnić — mówisz to wprost i nie przedstawiasz pary jako
gotowej.** „Prawie gotowa para” jest gorsza od braku pary, bo właściciel odbiera ją jako produkt.

Prawo zatrzymania po tej pozycji.

## R5 — PARA ZRZUTÓW PANELU IDEI — TEN SAM PRÓG

To samo co `R4`, dla `IdeaRightPanel` (ścieżka `src/components/standard/IdeaRightPanel.tsx`,
brama ok. 422-427). Jeżeli nie ma ekranu harnessu montującego realny host Idei — **napisz go**
(masz pełną licencję na `dev-render/`), zamiast mierzyć na ekranie, który hosta nie montuje.

Prawo zatrzymania po tej pozycji.

## R6 — RAPORT I SPROSTOWANIE ODBIORU MODUŁU

Struktura `§R.2`. Obowiązkowo: sześć wartości z `R1` (przed) i sześć po naprawie; **trzy dowody
mutacyjne z `R2` dosłownie**; wynik komendy „zero wpisów do `.env*`” i własna liczba rodziny
z `R3`; sumy i jasności obu par z `R4`/`R5` plus liczba błędów konsoli w każdym kadrze; sekcja
**TWIERDZENIA NIEZWERYFIKOWANE** niepusta.

**Sprostowanie w `docs/program/waves/WAVE_03_ACCEPTANCE/modules/07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md`:**
poprawiasz **trzy punkty** DoD §18.1, które były zawyżone, i **zostawiasz resztę wiersza** —
podłączenie panelu przez dyżur 342 obroniło się w odbiorze i nie wolno go zaniżyć (`Z32`).

## Prawo zatrzymania

Obowiązuje po każdej pozycji z osobna. „R1 zrobione, R2 zrobione, R4 zrobione, R3/R5 nietknięte”
jest pełnowartościowym wynikiem — o ile R1 stoi na liczbach z DOM, a R2 na **wszystkich trzech**
dowodach mutacyjnych.

**Odwrotna kolejność — flagi (R3) poprawione, a §18.1 dalej niezmierzone — jest podstawą
odrzucenia.** I odrębnie: **para zrzutów z błędami konsoli albo ze szkieletem zamiast treści nie
jest wynikiem pozycji `R4`**, choćby wszystko inne było zrobione.

---

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C szkieletu)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — patrz tabela niżej | TAK |
| 2 | Każda ścieżka istnieje na markerze albo jest oznaczona `NOWY` | TAK — sprawdzone na worktree z markera `6a4919f72d`; zero `BRAK` |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — `B.3`, dziesięć wierszy |
| 4 | Tabela licencji kompletna, trzecia kolumna nigdy nie brzmi samo „STOP” | TAK — każdy wiersz „tylko odczyt” ma rzeczownik-produkt (diff · brief · kontrakt · inwentarz · errata) |
| 5 | Wykonalność per pozycja bez plików przekrojowych, z dowodem przy `NIE` | TAK — `B.2`, kolumna 4 |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych (343, 344, 346 oraz 347-350) | TAK — `B.4.4`; porty 5532/6392 zmierzone jako wolne, kontener i gałąź nie istnieją |
| 7 | Komendy paste-ready, z komentarzem oczekiwanego wyniku | TAK |
| 8 | Pułapki środowiska w całości + pułapki właściwe temu modułowi (trzy) | TAK — `§0.2e` punkt (e) |
| 9 | Samodzielność — zero odwołań do rozmów i „poprzedniego dyżuru” bez ścieżki | TAK |
| 10 | Klauzula sprzeczności obecna; niewypełnionych pól szablonu: `0`; wierszy `Z`: `41` | TAK |

### AUDYT SPRZECZNOŚCI — pary wymagań i miejsce rozstrzygnięcia

| Para wymagań, która mogłaby się wykluczać | Gdzie ROZSTRZYGNIĘTA w tym dokumencie |
| --- | --- |
| Zakaz `Z10` „zero nowych flag i zero zmian domyślnych” **vs** `R3` zmienia pliki flag | `Z10` (pole wyjątku) — **żadnej nowej flagi i żadnej zmiany wartości domyślnej**; zmienia się wyłącznie sposób odczytu warstwy env |
| Zakaz `Z11` „nie odsłaniasz nowego ekranu bez akceptu” **vs** `R4`/`R5` wymagają kadrów przy ON | `R4` + `Z11` — flagę włączasz **wyłącznie w swoim harnessie**; do repo nie wchodzi żadna zmiana wartości domyślnej |
| Zakaz `Z40` „nie ruszaj `ArtifactRightPanel`” **vs** `R2` ma usunąć zagnieżdżony `aside` | `R2` punkt 1 — landmark usuwasz **w powłoce prototypu**, nie w panelu; panel zachowuje się poprawnie i obsługuje sześć powierzchni |
| Zakaz `Z40` „nie zmieniaj wartości domyślnej” **vs** `notebookSpecAShellFlag` ma default ON, co wygląda jak naruszenie kanonu „flagi domyślnie OFF” | `R3` punkt 2 — default ON jest **świadomą decyzją właściciela** (`R-11`, `MYW-NBK-CORE-001`), zapisaną w `docs/program/DECYZJE_WLASCICIELA_P0P1_20260904.md`; zmiana na OFF byłaby cofnięciem decyzji |
| „Zlecenie obejmuje rodzinę” **vs** `Z13`/zakres jednego dyżuru | `R3` punkt 3 i `B.1`, wiersz „rodzina flag (reszta)” — naprawiasz TRZY pliki z licencji, resztę **inwentaryzujesz**; inwentarz jest pełnowartościowym produktem pozycji |
| Zakaz `Z13` „dokładnie JEDEN nowy dokument” **vs** `R6` pisze do `MODULE_ACCEPTANCE.md` | `Z13` (pole „jedyny inny dokument”) — raport + jeden imiennie wskazany, **zastany** plik odbioru modułu |
| Zakaz `Z32` „nie zaniżasz odbioru modułu” **vs** `R6` każe poprawić `PASS` na słabszy | `R6` — poprawiasz **trzy punkty** §18.1, które nie były zmierzone; podłączenie panelu przez dyżur 342 zostaje uznane, bo obroniło się w odbiorze |
| Zakaz `Z15` „zero modelu językowego” **vs** panel deklaruje tryb Teresy | `Z15` bez wyjątku — tryb Teresy nie ma dziś skutku wizualnego (decyzja 2026-09-01 „jedna Teresa, w swoim oknie”), a żaden pomiar tego dyżuru nie przechodzi przez `llmService` ani `/api/ai/**` |
| Zakaz `Z30` „zero wysyłki” **vs** `R4`/`R5` mogą uruchomić pełny runtime do zrzutów | `§0.2b` punkt (4) — wyjątek wyłącznie dla zrzutów, po dowodach (a) i (b), z deklaracją dosłowną w raporcie |
| Zakaz `Z18` „infra testowa tylko do odczytu” **vs** `R2` potrzebuje montażu komponentu React | `B.1`, wiersz „infra testowa” — środowisko `jsdom` i potrzebne zmienne stawiasz **w linii komendy**, nie w `vitest*.config.ts`; opis w raporcie czyni pozycję ZROBIONĄ |
