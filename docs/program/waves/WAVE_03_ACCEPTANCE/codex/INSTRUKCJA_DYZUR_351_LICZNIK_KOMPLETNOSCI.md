# INSTRUKCJA DYŻURU nr 351 — Codex — „★★★ LICZNIK KOMPLETNOSCI — JEDNA DEFINICJA ZAMIAST SIEDMIU KOPII, ZEBY NAPRAWA DYZURU 346 NIE ODROSLA. Dyzur 346 (scalony) naprawil ZYWA SCIEZKE raportu Oceny: model → HTML/DOCX → narrator nie twierdzi juz 100% przy niepelnej sesji (7 z 39 → 18% / „Niewystarczajaca”; 39 z 39 → 100% / „Wysoka”), bronione trzema mutacjami. ★★ ALE formula `actual > 0 **LUB** target > 0` zyje dalej poza modelem, a `target` jest wpisany przez paczke metodyki dla WSZYSTKICH obszarow — wiec kazde takie miejsce zawsze zwroci komplet. ★★ MOJ POMIAR OBALIL LICZBE ZE ZLECENIA: nie „cztery miejsca”, tylko **SIEDEM miejsc w TRZECH plikach** — `server/src/services/report/drdVizAdapter.ts:81` i `:121`, `src/services/drdVizAdapter.ts:59` **i `:105`** (zlecenie podawalo `:58` i nie widzialo drugiego), `server/src/routes/assessment/assessment-hub.routes.ts:63`, `:76` i `:80` — plus SZESC dalszych trafien tego samego ksztaltu w innych plikach, ktore masz sklasyfikowac. ★★ SPROSTOWANIE, ktore masz zweryfikowac i wpisac: konsumenci liczby z adaptera FRONTOWEGO (`DRDReportTemplate.tsx` z kaflem „Completion”, `assessment/ReportEditor.tsx`) sa dzis `unreachable` — to **MINA, nie zywe klamstwo** — ale trasa `/api/assessments` jest **ZAMONTOWANA W `Gateway.ts:1110` i ma TRZECH wolaczy frontowych**, wiec tam defekt jest zywy. Prog: JEDNA definicja kompletnosci per drzewo, **mutacja PER MIEJSCE — kazda RED**, i dowod, ze po naprawie zadne z tych miejsc nie zwraca kompletu przy 7 z 39"

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
> **wyłącznie** `/private/tmp/cx-day351-licznik-kompletnosci`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `c0f690bae36a386de27f1a349fbb9674ec03c693`**
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
Zakres: **OCENA (DRD) — **licznik kompletnosci poza modelem raportu**: adapter wizualizacji (serwer i front) oraz trasa listy ocen `/api/assessments`. Przedmiotem pracy jest **ujednolicenie definicji** (jedno zrodlo prawdy per drzewo) i **dowod mutacyjny per miejsce**, nie przebudowa raportu, nie zmiana skal osi i nie ruszanie naprawy dyzuru 346. Prawo zatrzymania PO KAZDEJ pozycji `R`, z commitem, i plikiem postepu `/private/tmp/cx-day351-postep.md` (poza repo, aktualizowany po KAZDEJ pozycji — dowod poza repo wyparowuje, wiec dowody wlasciwe ida do `evidence/`)**.
Trasy front: ``src/services/drdVizAdapter.ts` (osiagalny z korzenia aplikacji przez `src/services/report/drdReportModel.ts`) · konsumenci jego `completionPercent`: `src/components/assessment/reports/templates/DRDReportTemplate.tsx` i `src/components/assessment/ReportEditor.tsx` — OBA `unreachable` na markerze (zmierz sam, komenda 7) · kafel „Completion” mieszka w `src/components/assessment/reports/AssessmentReportVisualizations.tsx` ok. 181 (plik osiagalny). Wolacze zywej trasy listy: `src/components/MyWork/TaskDetailView.tsx:1669`, `src/components/MyWork/DecisionDetailView.tsx:4930`, `src/components/Initiatives/InitiativeDocumentView.tsx:3962``. Trasy tył: `★★ SEDNO ZYWEJ SCIEZKI: `GET /api/assessments` i `GET /api/assessments/:id` — `server/src/routes/assessment/assessment-hub.routes.ts` (496 linii, 7 tras, `@ts-nocheck`), zamontowany w `server/src/Gateway.ts:1110`; funkcja `computeProgressFields` (ok. 42-105) wolana z trzech miejsc (`:158`, `:240`, `:352`). Po stronie serwera dodatkowo `server/src/services/report/drdVizAdapter.ts` (konsumowany przez `server/src/services/report/drdReportModel.ts:274`, ale WYLACZNIE przez `viz.dimensions` — zmierz to sam, komenda 4). `server/src/services/report/drdReportModel.ts` i `src/services/report/drdReportModel.ts` sa juz naprawione przez dyzur 346 i stanowia ZRODLO DEFINICJI, nie cel naprawy`.

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
WT=/private/tmp/cx-day351-licznik-kompletnosci
MARKER=c0f690bae36a386de27f1a349fbb9674ec03c693

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/grafika/m03-20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day351-licznik-kompletnosci-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day351-licznik-kompletnosci/config.worktree"
cat "$VAULT/worktrees/cx-day351-licznik-kompletnosci/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day351-licznik-kompletnosci-scratch
mkdir -p /private/tmp/cx-day351-licznik-kompletnosci-artefakty

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
git -C "$VAULT" log --oneline c0f690bae36a386de27f1a349fbb9674ec03c693..github-backup/grafika/m03-20260902
git -C "$VAULT" diff --name-only c0f690bae36a386de27f1a349fbb9674ec03c693..github-backup/grafika/m03-20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day351-licznik-kompletnosci-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only c0f690bae36a386de27f1a349fbb9674ec03c693..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `jedenascie` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day351-licznik-kompletnosci

# (1) ★ TEZA-PRZYCZYNA: formula „actual > 0 LUB target > 0" zyje POZA modelem raportu.
#     Cel jest wpisany przez paczke metodyki dla KAZDEGO obszaru, wiec alternatywa
#     zawsze zwroci komplet — niezaleznie od liczby odpowiedzi.
bash -c "grep -rn 'actual > 0 || \|actual) > 0 || \|current > 0 || \|achievedLevel > 0 || ' server/src/ src/ --include=*.ts --include=*.tsx | grep -v __tests__"
#   moje liczby: JEDENASCIE trafien w 11 plikach. ★ ZLECENIE MOWILO O CZTERECH MIEJSCACH
#   W TRZECH PLIKACH — moj pomiar to OBALIL. Twoim zadaniem jest policzyc je SAMEMU
#   i rozstrzygnac, ktore z nich licza KOMPLETNOSC, a ktore co innego (np. „czy wykres ma sygnal").

# (2) ★ TEZA: rdzen defektu to SIEDEM miejsc w TRZECH plikach
bash -c "grep -n 'actual > 0 || \|current > 0 || \|achievedLevel > 0 || ' server/src/services/report/drdVizAdapter.ts src/services/drdVizAdapter.ts server/src/routes/assessment/assessment-hub.routes.ts"
#   moje liczby: drdVizAdapter (serwer) :81 i :121 · drdVizAdapter (front) :59 i :105 ·
#   assessment-hub.routes :63, :76, :80. ★ ZLECENIE PODAWALO :58 dla frontu (jest :59)
#   i NIE WIDZIALO drugiego miejsca frontowego (:105) ani :63 na trasie.

# (3) ★ TEZA: model raportu jest JUZ naprawiony (dyzur 346) i tej naprawy NIE COFASZ
bash -c "grep -n -A2 'const assessedAreas' server/src/services/report/drdReportModel.ts src/services/report/drdReportModel.ts"
#   oczekiwane: OBA pliki maja `(s) => s && Number(s.actual) > 0` — bez alternatywy z `target`.
#   To jest DEFINICJA, ktora masz rozprowadzic, a nie zmienic.

# (4) ★ TEZA-SPROSTOWANIE: model raportu bierze z adaptera WYLACZNIE `dimensions`,
#     wiec zepsuty `completionPercent` adaptera NIE cofa naprawy 346
bash -c "grep -n 'viz\.' server/src/services/report/drdReportModel.ts src/services/report/drdReportModel.ts"
#   oczekiwane: same `viz.dimensions.map(...)`, ani jednego `viz.completionPercent`.
#   ★ Sprawdz to sam, ZANIM uznasz, ze raport klienta znow klamie.

# (5) ★★ TEZA ROZSTRZYGAJACA: trasa `/api/assessments` JEST ZAMONTOWANA I ZYWA
bash -c "grep -n 'assessmentHubRoutes' server/src/Gateway.ts"
bash -c "grep -rn \"Api.get('/assessments')\" src/ --include=*.tsx"
#   moje liczby: montaz w `Gateway.ts:1110`; TRZY wolacze frontowe
#   (`MyWork/TaskDetailView.tsx`, `MyWork/DecisionDetailView.tsx`, `Initiatives/InitiativeDocumentView.tsx`).
#   ★ To NIE jest mina — to jest zywa trasa.

# (6) ★ TEZA: kolumna `completion_percent` z bazy ZWIERA obliczenie osi
sed -n '85,100p' server/src/routes/assessment/assessment-hub.routes.ts
#   oczekiwane: `if (completionPercent > 0) { progress = completionPercent; }` PRZED galezia
#   liczaca `completedAxes`. Wniosek, ktory masz potwierdzic albo obalic: derywacja z osi
#   ma znaczenie tylko wtedy, gdy kolumna w bazie jest zerem.

# (7) ★ TEZA-SPROSTOWANIE: konsumenci zepsutej liczby z adaptera FRONTOWEGO sa nieosiagalni
node scripts/dev/reachability-from-root.mjs > /private/tmp/cx-day351-licznik-kompletnosci-artefakty/reach.json 2>/dev/null
node -e 'const r=JSON.parse(require("fs").readFileSync("/private/tmp/cx-day351-licznik-kompletnosci-artefakty/reach.json","utf8"));for(const p of ["src/components/assessment/reports/templates/DRDReportTemplate.tsx","src/components/assessment/ReportEditor.tsx","src/components/assessment/reports/AssessmentReportVisualizations.tsx","src/services/drdVizAdapter.ts"]){const f=r.files.find(x=>x.file===p);console.log(p,"→",f?f.classification:"BRAK");}'
#   moje liczby: DRDReportTemplate `unreachable` · ReportEditor `unreachable` ·
#   AssessmentReportVisualizations `app` · src/services/drdVizAdapter.ts `app`.
#   ★ PLIK adaptera jest osiagalny, ale jego `completionPercent` konsumuja WYLACZNIE dwa
#   nieosiagalne komponenty — to jest MINA, nie zywe klamstwo. Napisz to w raporcie dokladnie tak.

# (8) ★ TEZA: kafel „Completion" w warstwie wizualizacji istnieje i pokaze te liczbe po podlaczeniu
bash -c "grep -n 'completionPercent' src/components/assessment/reports/AssessmentReportVisualizations.tsx src/components/assessment/reports/templates/DRDReportTemplate.tsx"
#   oczekiwane: kafel `Completion` (`AssessmentReportVisualizations.tsx` ok. 181-186)
#   i `{vizData.completionPercent}%` w szablonie DRD (ok. 183).

# (9) ★ TEZA: testy dyzuru 346 istnieja i maja pozostac ZIELONE
ls tests/unit/report/day346.drdReportCompleteness.test.ts server/src/services/report/__tests__/day346.fullSession39.gateway.pg.test.ts
#   oczekiwane: oba pliki istnieja. Twoja zmiana nie ma prawa ich zaczerwienic.

# (10) TEZA: liscie slownikow i bramki na markerze
node -e 'const f=require("fs");function c(o){let n=0;const w=v=>{if(v&&typeof v==="object"){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ["pl","en"])console.log(l,c(JSON.parse(f.readFileSync("public/locales/"+l+"/translation.json","utf8"))));'
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus=$?"
bash scripts/check-list-canon.sh >/dev/null 2>&1; echo "list=$?"
bash scripts/check-artefakt.sh >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
#   moje liczby: pl 35199, en 33066 (★ NIE 35198/33065 — te liczby sa o jeden dzien stare);
#   focus=0, list=0, artefakt=0, reach=0

# (11) zasoby: dysk, porty, kontener
df -h /
lsof -nP -iTCP:6410 -sTCP:LISTEN; lsof -nP -iTCP:5550 -sTCP:LISTEN
docker ps -a --format '{{.Names}}' | grep -c cx-day351 || true
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day351-licznik-kompletnosci-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6410`. Twój JEDYNY port harnessu to `5550`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day351-pg`**. **ZAKAZANE:** `Zakazane na stale: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta restricted ports Chromium. Zajete przez hosta i tor grafiki: 3020, 3022, 3025, 3027, 3030, 5432, 5433, 6012, 6379. Rodzenstwo TEJ paczki (04.09 wieczor) — nie dotykasz: 352 (6411/5551), 353 (6412/5552), 354 (6413/5553). ★★ ROWNOLEGLE pisane sa instrukcje 355-358 przez innego autora; ich portow NIE ZNAM w chwili pisania tej instrukcji, wiec obowiazuje regula twarda: **bierzesz WYLACZNIE swoje dwa porty i zaden inny**, a port zajety jest powodem do STOP-u calosci (`Z7`), nigdy do podmiany numeru. Wczesniejsze rodzenstwo 04.09: 343-346 (6390-6393 / 5530-5533), 347 (6394/5534), 348 (6395/5535), 349 (6396/5536), 350 (6397/5537), 334-337 (6370-6373 / 5510-5513). Cudze worktree 286-298 uzywaja 6290-6299 i 5250-5269. Twoje wlasne wylacznie: baza 6410, harness 5550. ★ ZAKAZ `pkill`/`killall` — zabijasz wylacznie wlasne PID-y (zapisz `$!`)`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `BRAK. Ten dyzur nie dodaje, nie zmienia i nie przelacza ANI JEDNEJ flagi funkcyjnej. Zastane w promieniu: `isDrdReportEnabled` (default OFF, `src/utils/drdReportFlag.ts`) i `drdHttpSourceOfTruthV1` (default OFF) — **nie zmieniasz ich wartosci domyslnych**. Jezeli ktorys pomiar wymaga flagi `ON`, zeby przejsc — to jest ZNALEZISKO i granica dowodu, ktora wypisujesz z nazwy flagi, nigdy zmiana wartosci domyslnej`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh --ci`, `scripts/check-artefakt.sh`, `scripts/check-triada.sh`, `scripts/check-gestosc.sh`, `.husky/pre-commit`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`, `server/src/middleware/auth.middleware.ts`, `server/src/middleware/orgContext.middleware.ts`, `server/src/services/ApiGateway.ts`, `server/src/Gateway.ts`. Wszystkie NIETYKALNE DO ZAPISU — wolno je wolac w pomiarze, nie wolno ich zmieniac, takze wtedy gdy „wystarczylaby drobna zmiana, zeby test przeszedl”`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY351_LICZNIK_KOMPLETNOSCI_REPORT.md`. Jedyny inny dokument do zmiany: **jedna nowa sekcja** w `docs/program/REJESTR_ZNALEZISK_20260903.md` o PIERWSZEJ WOLNEJ literze — sekcje ida dzis do `Q`, ale rownolegle dopisuje inny autor, wiec litere sprawdzasz komenda `bash -c "grep -nE '^## [A-Z]\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"` TUZ PRZED commitem, nigdy z gory. **Nie zmieniasz zadnego `MODULE_ACCEPTANCE.md`** — ten dyzur nie dotyka macierzy odbioru (wiersze `G**` sa terenem dyzuru 353). Nowe pliki dowodowe ida do `evidence/licznik-kompletnosci-20260904/` (katalog NIE ISTNIEJE na markerze — tworzysz go, `git add -f`). Plik postepu `/private/tmp/cx-day351-postep.md` zyje POZA repo. Nowe pliki w `tests/` wymagaja `git add -f`. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day351-licznik-kompletnosci-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day351-licznik-kompletnosci-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ COFNIECIA NAPRAWY DYZURU 346.** `server/src/services/report/drdReportModel.ts` i `src/services/report/drdReportModel.ts` licza dzis `Number(s.actual) > 0` — to jest **DEFINICJA, ktora rozprowadzasz**, a nie kod do zmiany kierunku. Wolno Ci wylacznie zastapic ten literal wywolaniem wspolnego pomocnika o **identycznym zachowaniu**; testy `tests/unit/report/day346.drdReportCompleteness.test.ts` i `server/src/services/report/__tests__/day346.fullSession39.gateway.pg.test.ts` maja pozostac ZIELONE i **nie wolno ich oslabic ani przepisac**. ★★ **ZAKAZ UKRYCIA METRYKI JAKO NAPRAWY** — usuniecie kafla „Completion”, zwrocenie `null`/`undefined` zamiast liczby albo schowanie liczby za flaga NIE JEST naprawa i jest podstawa odrzucenia pozycji. ★★ **ZAKAZ MONTOWANIA, ODMONTOWYWANIA I DODAWANIA TRAS** — `assessment-hub.routes.ts` ma 7 tras i `@ts-nocheck`; dotykasz WYLACZNIE cialo `computeProgressFields`. ★★ **ZAKAZ PODLACZANIA NIEOSIAGALNYCH KONSUMENTOW** (`DRDReportTemplate.tsx`, `ReportEditor.tsx`) — naprawiasz w nich liczbe, ale **nie dopisujesz im wolacza** i nie zmieniasz osiagalnosci; to byloby odslonieciem ekranu bez akceptu (`Z11`). ★ **ZAKAZ `--retry` innego niz `0`, `.skip`, `.todo`, poszerzania `exclude` i zmiany asercji, zeby zzielenieć** | Naprawa per-wywolanie odrasta: defekt zalatany w jednym module wrocil po osmiu tygodniach w dwunastu plikach. Dyzur 346 naprawil model raportu; ten sam warunek zyje w siedmiu innych miejscach i przy nastepnym podlaczeniu ekranu wroci jako „nowy” defekt. Jedna definicja jest jedynym sposobem, zeby trzeci raz tego nie robic |

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
cd /private/tmp/cx-day351-licznik-kompletnosci

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day351-pg psql -U postgres -d cx351 \
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
cd /private/tmp/cx-day351-licznik-kompletnosci

docker run -d --name cx-day351-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx351 \
  -p 127.0.0.1:6410:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day351-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6410/cx351 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6410/cx351 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day351-licznik-kompletnosci && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6410/cx351 \
JWT_SECRET=cx351-test-secret-do-not-reuse-min-32-znaki \
npx vitest run Jednostkowe front + kontrakt parytetu: z roota, wariant (C) `RUN_DB_TESTS=0 MOCK_DB=true`, sciezki `tests/unit/report tests/unit/assessment`. Jednostkowe serwer: z roota, sciezka `server/src/services/report/__tests__` z `--config server/vitest.config.ts`. Trasa na realnym PG: z cwd `server/`, wariant (B) `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres` z kompletem zmiennych w tej samej linii. **Kazdy przelot z `--retry=0` i `--reporter=json --outputFile=<plik w ARTEFAKTY>`; `No test files found` i `Transform failed` to BLAD KOMENDY, nie `PASS`** --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day351-licznik-kompletnosci-artefakty/day351-licznik-kompletnosci.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day351-licznik-kompletnosci && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run Jednostkowe front + kontrakt parytetu: z roota, wariant (C) `RUN_DB_TESTS=0 MOCK_DB=true`, sciezki `tests/unit/report tests/unit/assessment`. Jednostkowe serwer: z roota, sciezka `server/src/services/report/__tests__` z `--config server/vitest.config.ts`. Trasa na realnym PG: z cwd `server/`, wariant (B) `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres` z kompletem zmiennych w tej samej linii. **Kazdy przelot z `--retry=0` i `--reporter=json --outputFile=<plik w ARTEFAKTY>`; `No test files found` i `Transform failed` to BLAD KOMENDY, nie `PASS`** --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day351-licznik-kompletnosci-artefakty/day351-licznik-kompletnosci.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day351-licznik-kompletnosci/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day351-pg psql -U postgres -d cx351 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day351-pg`.
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
> **(e) ★★★ **PIEC PULAPEK TEGO DYZURU.** **(1) Serwer i front to BLIZNIAKI, nie kopia zapasowa** — `server/src/services/report/drdVizAdapter.ts` i `src/services/drdVizAdapter.ts` to dwa drzewa, ktore **nie moga importowac jeden drugiego w produkcji**; „jedna definicja” znaczy tu **jedno zrodlo per drzewo plus kontrakt parytetu w tescie**, nie jeden plik dla obu. Naprawa jednego drzewa bez drugiego to dokladnie ten sam blad, ktory dyzur 346 musial naprawiac w dwoch plikach naraz. **(2) `viz.completionPercent` NIE jest konsumowany przez model raportu** — `drdReportModel` bierze z adaptera wylacznie `dimensions` (komenda 4). Jezeli tego nie sprawdzisz, napiszesz w raporcie, ze naprawa 346 jest cofnieta przez adapter, a to nieprawda. **(3) Trasa `/api/assessments` zwiera obliczenie**: `if (completionPercent > 0) progress = completionPercent` stoi PRZED galezia liczaca osie, wiec derywacja ma znaczenie tylko przy zerowej kolumnie w bazie — Twoj dowod na realnym PG musi celowac w ten wlasnie przypadek, inaczej mierzysz kolumne, a nie licznik. **(4) `assessment-hub.routes.ts` ma `@ts-nocheck` w pierwszej linii** — kompilator NIE zlapie Twojego bledu typu w tym pliku; dowodem poprawnosci jest wylacznie przelot testowy, nigdy „tsc przeszlo”. **(5) `DRDReportTemplate.tsx` i `ReportEditor.tsx` sa `unreachable`** — nie zobaczysz tam efektu w harnessie ani w aplikacji; dowodem dla nich jest test jednostkowy na funkcji, nie zrzut ekranu, a proba „pokazania” ich przez dopisanie wolacza jest zakazana (`Z40`)**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day351-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day351-licznik-kompletnosci-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (inwentarz WSZYSTKICH miejsc formuly z wlasnym pomiarem i klasyfikacja: kompletnosc / co innego) · R2 (jedna definicja per drzewo + kontrakt parytetu, mutacja PER MIEJSCE) · R3 (dowod na ZYWEJ trasie `/api/assessments` na realnym PostgreSQL)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6410` albo `5550` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6410` albo `5550`** (`Z7`).

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

Dyżur 346 (scalony, `3f84abd809`) naprawił **żywą ścieżkę** raportu Oceny. Przed nim raport
drukował klientowi „Kompletność `100%` · Obszary ocenione `39/39` · Wiarygodność `Wysoka`" przy
**siedmiu odpowiedziach na trzydzieści dziewięć obszarów**. Przyczyną był jeden warunek:

```
(s) => s && (Number(s.actual) > 0 || Number(s.target) > 0)
```

**Cel jest wpisany przez paczkę metodyki dla KAŻDEGO z 39 obszarów.** Alternatywa sprawia więc, że
licznik zawsze zrówna się z mianownikiem — niezależnie od tego, ile odpowiedzi naprawdę padło.
Po naprawie 346 oba pliki modelu liczą `Number(s.actual) > 0`, a sesja 7/39 daje 18%
i etykietę „Niewystarczająca"; sesja 39/39 dalej daje 100% i „Wysoka".

**Ta naprawa jest jednak lokalna.** Ta sama formuła żyje dalej poza modelem raportu — i tam
`target` znowu podnosi licznik. To jest dokładnie kształt „naprawa per-wywołanie odrasta":
defekt zalatany w jednym miejscu wraca po tygodniach w kilkunastu plikach, jako „nowy".

### ★ Co robi ten dyżur

Nie kolejną łatkę. **Jedną definicję kompletności**, rozprowadzoną po wszystkich miejscach, które
tę liczbę wyliczają, z **dowodem mutacyjnym osobno dla każdego miejsca**. Po tym dyżurze
przywrócenie alternatywy `|| target > 0` w dowolnym z tych miejsc ma **zaczerwienić test**.

---

## ★ Sprostowanie zlecenia — co mój pomiar na markerze skorygował

Zlecenie, z którego powstała ta instrukcja, mówiło o **czterech miejscach**:
`server/src/services/report/drdVizAdapter.ts:81` i `:121`, `src/services/drdVizAdapter.ts:58`
oraz `server/src/routes/assessment/assessment-hub.routes.ts:63,76,80`.
**Zmierzyłem to na markerze i zlecenie było nieścisłe w czterech punktach:**

1. **`src/services/drdVizAdapter.ts` — warunek stoi w wierszu `59`, nie `58`.**
2. **Ten sam plik ma DRUGIE takie miejsce, w wierszu `105`** (wariant „z osi",
   `buildDRDVisualizationDataFromAxes`), którego zlecenie nie widziało. Serwerowy bliźniak ma
   analogiczną parę: `:81` i `:121`.
3. **`assessment-hub.routes.ts:63` nie używa `actual`/`target`, tylko
   `data.achievedLevel > 0 || data.targetLevel > 0`** — ten sam kształt pod innymi nazwami pól.
   Wyszukiwanie po literale `actual` go **nie znajdzie**; szukaj po **kształcie
   „coś-tam > 0 `||` coś-tam > 0"**, nie po nazwie pola.
4. **Rdzeń to więc SIEDEM miejsc w TRZECH plikach, nie cztery.** A cały grep tego kształtu
   w `server/src/` i `src/` daje u mnie **jedenaście trafień w jedenastu plikach** — pozostałe
   cztery (`src/components/assessment/drd/drdAnswersAdapter.ts:76`,
   `src/components/assessment/tools/SIRIForm.tsx:143`,
   `src/components/assessment/tools/DRDForm.tsx:107`,
   `src/components/assessment/reports/AssessmentReportVisualizations.tsx:332`,
   `src/services/report/assessmentReportDataAdapter.ts:119`) **mogą liczyć coś zupełnie innego**
   niż kompletność (np. „czy wykres ma w ogóle sygnał"). **Twoim zadaniem jest je sklasyfikować,
   a nie zmienić hurtem.** Zmiana miejsca, które NIE liczy kompletności, jest regresją.

**Piąty punkt — sprostowanie do wpisania w raport, bo zmienia wagę defektu, a nie jego istnienie.**
Konsumenci błędnej liczby z adaptera **frontowego** — `DRDReportTemplate.tsx` (kafel
„Assessment completion {{completion}}%") i `src/components/assessment/ReportEditor.tsx` — są dziś
**`unreachable`** (sprawdziłem `scripts/dev/reachability-from-root.mjs`; sprawdź sam, komenda 7).
**To jest MINA, nie żywe kłamstwo.** Nie strasz w raporcie klienta czymś, czego klient dziś nie
widzi. **Ale naprawiasz to i tak** — mina rozbraja się przed podłączeniem, nie po nim.

**Szósty punkt, przeciwny:** trasa `/api/assessments` **JEST żywa**. Zamontowana w
`server/src/Gateway.ts:1110`, ma **trzech wołaczy frontowych**
(`Api.get('/assessments')` w `MyWork/TaskDetailView.tsx:1669`,
`MyWork/DecisionDetailView.tsx:4930`, `Initiatives/InitiativeDocumentView.tsx:3962`).
Tam oś liczy się jako zrobiona z samego celu **dzisiaj**.

**Siódmy punkt — sprostowanie, którego zlecenie nie zawierało, a które chroni Cię przed fałszywym
alarmem:** model raportu bierze z adaptera **wyłącznie `viz.dimensions`**
(`server/src/services/report/drdReportModel.ts:274`, `src/services/report/drdReportModel.ts:303`).
**Zepsuty `completionPercent` adaptera NIE cofa naprawy dyżuru 346.** Sprawdź to komendą 4, zanim
napiszesz, że raport klienta znowu kłamie.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz
rozbieżność wprost.**

---

## ★ Zmierz moje liczby sam

Twierdzę: kształt „`X > 0 || Y > 0`" ma w `server/src/` i `src/` **11** trafień; rdzeń dyżuru to
**7** miejsc w **3** plikach; obszarów metodyki DRD jest **39**; oba pliki modelu raportu liczą już
`Number(s.actual) > 0` i mają po **0** wystąpień alternatywy; `viz.completionPercent` ma
w modelach raportu **0** wystąpień; trasa `/api/assessments` jest zamontowana w **jednym** miejscu
(`Gateway.ts:1110`) i ma **3** wołaczy frontowych; `computeProgressFields` jest wołana z **3**
miejsc w swoim pliku; `DRDReportTemplate.tsx` i `ReportEditor.tsx` mają klasyfikację
**`unreachable`**, a `src/services/drdVizAdapter.ts` i `AssessmentReportVisualizations.tsx` —
**`app`**; liście `public/locales/pl/translation.json` = **35199**, `en` = **33066**.

**Każdą z tych liczb policz sam, u siebie, na swojej bazie. Przepisanie mojej liczby jest
zawyżeniem i podstawą odrzucenia raportu (`Z24`).** Wszystkie grepy uruchamiaj przez
`bash -c "…"` — `grep --include` w `zsh` zwraca pustkę zamiast wyniku, a **pustka nie jest
wynikiem, dopóki nie sprawdzisz, że polecenie się wykonało**.

---

## B.1. TABELA LICENCJI — CAŁA ŚCIEŻKA: WALIDATOR · TRASA · KONTROLER · SERWIS · ADAPTER · TESTY

> **★★ ZASTRZEŻENIE.** Poniższa tabela **JEST** licencją. Jeżeli plik, którego potrzebujesz, jest
> opisany jako „PEŁNA/WĄSKA LICENCJA" — **masz pozwolenie i STOP z tytułu »nie wolno mi« jest
> NIEZASADNY**. Jeżeli pliku nie ma w tabeli — domyślnie **TYLKO DO ODCZYTU**, a Twoim produktem
> jest czerwony kontrakt + brief, **nie zatrzymanie dyżuru**.

| Warstwa | Plik / wzorzec | Licencja | Co robisz, gdy pozycja wymagałaby zmiany pliku TYLKO-DO-ODCZYTU |
| --- | --- | --- | --- |
| **definicja — serwer (NOWY)** | `server/src/services/report/assessmentCompleteness.ts` (**NOWY**) | **★ PEŁNA LICENCJA.** Jedno źródło prawdy dla drzewa serwerowego: co liczy się jako „obszar z odpowiedzią" i jak z tego powstaje procent | — |
| **definicja — front (NOWY)** | `src/services/assessmentCompleteness.ts` (**NOWY**) | **★ PEŁNA LICENCJA.** Bliźniak frontowy o **identycznym zachowaniu**; parytet broniony kontraktem z `R2` | — |
| **adapter wizualizacji — serwer** | `server/src/services/report/drdVizAdapter.ts` | **★ WĄSKA LICENCJA: WYŁĄCZNIE dwa miejsca liczenia (`:81`, `:121`) i ich zastąpienie wywołaniem wspólnej definicji.** ZAKAZ zmiany kształtu zwracanego obiektu, kolorów osi, `maxLevel` i mapowania kluczy | Gotowy diff w bloku kodu, **nienałożony**, + brief: promień rażenia, co widzi klient przed i po |
| **adapter wizualizacji — front** | `src/services/drdVizAdapter.ts` | **★ WĄSKA LICENCJA: WYŁĄCZNIE dwa miejsca liczenia (`:59`, `:105`).** ★ To jest **bliźniak, nie kopia zapasowa** — naprawa jednego drzewa bez drugiego zostawia kłamstwo w drugim, dokładnie jak przed dyżurem 346 | Gotowy diff nienałożony + brief |
| **trasa listy ocen** | `server/src/routes/assessment/assessment-hub.routes.ts` | **★ WĄSKA LICENCJA: WYŁĄCZNIE ciało funkcji `computeProgressFields` (ok. 42-105).** **ZAKAZ dodawania, usuwania i przenoszenia tras** (plik ma 7 tras), zakaz zmiany kształtu odpowiedzi poza polem `progress`/`completedAxes`, zakaz zdejmowania `@ts-nocheck` | **CZERWONY KONTRAKT TESTOWY**: nowy plik testu, który **dziś PADA**, oznaczony `it('KONTRAKT DLA DYŻURU 351 — …')` z nagłówkiem `// CZERWONY Z ZAŁOŻENIA — nie regresja tego dyżuru`, + brief: plik:linia · promień rażenia · jak wyglądałby dowód mutacyjny. **Pozycja z takim produktem jest ZROBIONA, nie STOP** |
| **konsumenci nieosiągalni** | `src/components/assessment/reports/templates/DRDReportTemplate.tsx`, `src/components/assessment/ReportEditor.tsx` | **★ WĄSKA LICENCJA: WYŁĄCZNIE poprawność liczby i jej etykiety.** **ZAKAZ dopisania im wołacza produkcyjnego i zmiany osiągalności** (`Z11`, `Z40`) — odsłonięcie ekranu bez akceptu właściciela jest odrzuceniem pozycji | Opis w raporcie z dowodem plik:linia + gotowy diff nienałożony |
| **warstwa wizualizacji** | `src/components/assessment/reports/AssessmentReportVisualizations.tsx` | **★ WĄSKA LICENCJA: WYŁĄCZNIE etykieta i podpis kafla „Completion" (ok. 176-187)**, jeżeli poprawna liczba wymaga innego napisu (np. rozdzielenia „obszarów z odpowiedzią" od „obszarów z celem"). **ZAKAZ usunięcia kafla** — ukrycie metryki nie jest naprawą. ★ Wiersz `:332` (`hasSignal`) **prawdopodobnie NIE liczy kompletności** — sklasyfikuj go w `R1`, zanim ruszysz | Gotowy diff nienałożony + brief |
| **modele raportu (naprawa 346)** | `server/src/services/report/drdReportModel.ts`, `src/services/report/drdReportModel.ts` | **★ WĄSKA LICENCJA: WYŁĄCZNIE zastąpienie literału `(s) => s && Number(s.actual) > 0` wywołaniem wspólnej definicji, przy IDENTYCZNYM zachowaniu.** ZAKAZ zmiany progów `confidenceLabel`, sekcji raportu i skal osi (`Z40`) | Zostawiasz literał i opisujesz w raporcie, dlaczego wspólna definicja go nie obejmuje |
| **kandydaci do klasyfikacji** | `src/components/assessment/drd/drdAnswersAdapter.ts`, `src/components/assessment/tools/SIRIForm.tsx`, `src/components/assessment/tools/DRDForm.tsx`, `src/services/report/assessmentReportDataAdapter.ts` | **TYLKO ODCZYT DO CZASU KLASYFIKACJI W `R1`.** Jeżeli `R1` udowodni, że liczą **kompletność** — licencja rozszerza się do wąskiej, jak wyżej. Jeżeli liczą co innego — **zostawiasz je nietknięte i piszesz dlaczego** | Wpis w raporcie: plik, linia, co ta liczba naprawdę znaczy, dowód |
| **struktura metodyki** | `server/src/data/drdStructure.ts`, `src/services/drdStructure.ts` | **TYLKO ODCZYT** — `getTotalAreaCount()` jest poprawne; problem jest w liczniku, nie w mianowniku | Errata w raporcie |
| **flagi ujawniania** | `src/utils/drdReportFlag.ts`, bramka `drdHttpSourceOfTruthV1` w `useFeatureFlags.ts` | **TYLKO ODCZYT. ZAKAZ zmiany wartości domyślnej** (`Z10`, `Z11`) | Errata w raporcie |
| **walidator (NOWE pliki)** | `tests/unit/report/**`, `tests/unit/assessment/**`, `server/src/services/report/__tests__/**`, `server/src/routes/__tests__/**` | **★ PEŁNA LICENCJA**, z zastrzeżeniem `Z18` i `Z31`. **★ NOWE PLIKI TESTOWE dla warstwy frontowej kładziesz w `tests/`, NIGDY pod `src/`** — plik testowy pod `src/` czerwieni `node scripts/dev/reachability-from-root.mjs --check-baseline` (zdarzyło się 04.09 trzy razy). `git add -f` obowiązkowo | — |
| **walidator (ZASTANE, dyżur 346)** | `tests/unit/report/day346.drdReportCompleteness.test.ts`, `server/src/services/report/__tests__/day346.fullSession39.gateway.pg.test.ts` | **★ WĄSKA LICENCJA — WYŁĄCZNIE dopisywanie NOWYCH przypadków `it(...)`.** Zakaz zmiany i osłabiania istniejących asercji (`Z40`) | Nowy plik testowy obok, z nagłówkiem `// KONTRAKT DYŻURU 351` |
| **dowody** | `evidence/licznik-kompletnosci-20260904/**` (**NOWY**) | **★ PEŁNA LICENCJA**, `git add -f`. **★ Wszystkie wyniki `--reporter=json`, mutacje i wypisy inwentarza lądują TUTAJ, w repo** — 04.09 trzykrotnie trzeba było ratować dowody z katalogów tymczasowych. Katalog `ARTEFAKTY` jest roboczy; dowód jest w repo | — |
| **dowody dyżurów 339/346** | `evidence/silniki-raportu-oceny-20260904/**`, `evidence/raport-oceny-kompletnosc-20260904/**` | **TYLKO ODCZYT — CUDZE DOWODY** | Twoje artefakty idą do własnego katalogu |
| **rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **★ WĄSKA LICENCJA — WYŁĄCZNIE dopisanie JEDNEJ nowej sekcji o pierwszej wolnej literze.** Zakaz kasowania i przeredagowywania sekcji zastanych | — |
| **raport** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY351_LICZNIK_KOMPLETNOSCI_REPORT.md` (**NOWY**) | `§R.2` — **JEDYNY nowy dokument raportowy** (`Z13`) | — |
| **macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` | **TYLKO ODCZYT — teren dyżuru 353** | Wpis do raportu: który wiersz Twoja praca dotyka i jaki dowód dostarczyłeś; **nie zmieniasz stanu** |
| **bramki i infra testowa** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.husky/pre-commit`, `scripts/check-*.sh` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie: co blokuje pomiar, jaka byłaby zmiana, jak obszedłeś to zmiennymi w linii komendy. Pozycja jest **ZROBIONA** z takim opisem |
| **cudzy teren** | `src/components/standard/StandardPreview.tsx` i wołacze podglądu — **teren dyżuru 352**; `docs/program/waves/WAVE_03_ACCEPTANCE/modules/**` i `evidence/g19/**` — **teren dyżuru 353**; `src/components/DiscoveryTools/**`, `src/toolPacks/**`, `src/components/Discovery/**` — **teren dyżuru 354** | **TYLKO ODCZYT** | Wpis do raportu: plik, linia, treść problemu, **gotowa rekomendacja jako diff w bloku kodu, nienałożony**. Pozycja idzie dalej |
| — | **Wszystko inne** | **TYLKO ODCZYT** | Opisujesz potrzebę w raporcie z dowodem plik:linia i idziesz dalej |

---

## B.2. TABELA POZYCJI

**Jedna pozycja = jeden wiersz = jeden commit = jeden werdykt. Commit robisz PO KAŻDEJ pozycji,
push na `github-backup` po pierwszym commicie i po każdej kolejnej (`Z34a`).**

| Pozycja | Nazwa | Rdzeń? | Wymaga plików przekrojowych? | DoD podniesione | Definicja ukończenia | Komenda dowodowa | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | Inwentarz WSZYSTKICH miejsc formuły + klasyfikacja „kompletność / co innego" | TAK | NIE — dowód: inwentarz jest odczytem; `bash -c "grep -rn …"` nie dotyka żadnego pliku | bazowe | Imienna lista **każdego** trafienia kształtu `X > 0 \|\| Y > 0` z `plik:linia`, kolumną „co ta liczba znaczy" i werdyktem `KOMPLETNOŚĆ` / `INNE` + **własna liczba**; dla każdego `KOMPLETNOŚĆ` — czy jest osiągalny z korzenia | `bash -c "grep -rn 'actual > 0 \|\| \|current > 0 \|\| \|achievedLevel > 0 \|\| ' server/src/ src/"` + `node scripts/dev/reachability-from-root.mjs` | `docs(day351): inwentarz miejsc licznika kompletnosci (351 R1)` |
| R2 | **RDZEŃ: jedna definicja per drzewo + mutacja PER MIEJSCE** | TAK | NIE — dowód: `B.1` daje wąską licencję na każde miejsce z inwentarza | +1 test **na każde naprawione miejsce** | Wszystkie miejsca z werdyktem `KOMPLETNOŚĆ` wołają wspólną definicję; **kontrakt parytetu serwer↔front zielony**; **osobna mutacja na KAŻDE miejsce, każda RED**; testy dyżuru 346 dalej zielone | `npx vitest run tests/unit/report tests/unit/assessment --retry=0 --reporter=json --outputFile=…` + `npx vitest run server/src/services/report/__tests__ --config server/vitest.config.ts --retry=0 …` | `fix(assessment): jedna definicja kompletnosci zamiast siedmiu kopii (351 R2)` |
| R3 | **RDZEŃ: dowód na ŻYWEJ trasie `/api/assessments` na realnym PostgreSQL** | TAK | NIE — dowód: zmieniasz wyłącznie ciało `computeProgressFields`, nie montaż | +1 test PG | Kontener `cx-day351-pg` na `6410`, baza `cx351`, **dwa przebiegi migracji** (drugi bezbłędny i bez zmian); ocena DRD z **7 z 39** odpowiedziami i **zerową kolumną `completion_percent`**; trasa **nie** melduje osi jako zrobionej z samego celu; mutacja RED→GREEN z pustym `git diff` | `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres … npx vitest run server/src/routes/__tests__/day351.*.pg.test.ts --config server/vitest.config.ts --retry=0 …` | `fix(assessment-hub): postep osi liczony z odpowiedzi, nie z celow paczki (351 R3)` |
| R4 | Rozbrojenie miny: nieosiągalni konsumenci i kafel „Completion" | NIE | NIE | +1 test | `DRDReportTemplate.tsx` i `ReportEditor.tsx` dostają poprawną liczbę **bez** dopisania wołacza i **bez** zmiany osiągalności; etykieta kafla nie twierdzi więcej, niż wie; `reachability --check-baseline` dalej `exit 0` | `node scripts/dev/reachability-from-root.mjs --check-baseline; echo $?` | `fix(assessment): rozbroj mine kompletnosci w nieosiagalnych konsumentach (351 R4)` |
| R5 | Raport + jedna sekcja rejestru | NIE | NIE | n/d | Struktura `§R.2`, sekcja „TWIERDZENIA NIEZWERYFIKOWANE" **niepusta**, tabela rozbieżności wobec liczb tej instrukcji | — | `docs(day351): raport` |

> **Kolumna „Wymaga plików przekrojowych?" jest wypełniona dla KAŻDEJ pozycji, z dowodem przy
> odpowiedzi `NIE`.** Pliki przekrojowe w promieniu tego dyżuru to `server/src/Gateway.ts`
> (montaż trasy) i `auth.middleware.ts` — **żadna pozycja ich nie zmienia**, bo naprawa siedzi
> w ciele funkcji, nie w montażu. Jeśli uznasz, że musi — produktem jest czerwony kontrakt
> + brief, a pozycja jest **ZROBIONA**.

---

## B.3. TABELA MIANOWNIKÓW

**Każdą z tych liczb mierzysz sam (`Z24`) i podajesz swoją. Wszystkie komendy uruchamiasz
w `bash`, nigdy w `zsh`.**

| # | Co liczę | Liczba autora | Komenda | Obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | Trafienia kształtu `X > 0 \|\| Y > 0` w `server/src/` + `src/`, bez testów | 11 | `bash -c "grep -rn 'actual > 0 \|\| \|actual) > 0 \|\| \|current > 0 \|\| \|achievedLevel > 0 \|\| ' server/src/ src/ --include=*.ts --include=*.tsx \| grep -v __tests__"` | TAK — **szukam po KSZTAŁCIE, nie po nazwie pola**; wariant `achievedLevel` nie ma słowa `actual` |
| 2 | Z tego: miejsca liczące **kompletność** (rdzeń) | 7 w 3 plikach | `bash -c "grep -n 'actual > 0 \|\| \|current > 0 \|\| \|achievedLevel > 0 \|\| ' server/src/services/report/drdVizAdapter.ts src/services/drdVizAdapter.ts server/src/routes/assessment/assessment-hub.routes.ts"` | TAK — **to jest mianownik pozycji `R2`**; jeśli Twój wyjdzie inny, obowiązuje Twój |
| 3 | Obszary metodyki DRD | 39 | `bash -c "grep -n 'getTotalAreaCount' server/src/data/drdStructure.ts"` + wywołanie funkcji | TAK — to mianownik kompletności |
| 4 | Wystąpienia alternatywy w OBU modelach raportu (po naprawie 346) | 0 | `bash -c "grep -c 'actual) > 0 \|\|' server/src/services/report/drdReportModel.ts src/services/report/drdReportModel.ts"` | TAK — **potwierdza, że 346 nie jest cofnięte**; jeśli > 0, masz regresję do zgłoszenia |
| 5 | Użycia `viz.completionPercent` w modelach raportu | 0 | `bash -c "grep -n 'viz\\.' server/src/services/report/drdReportModel.ts src/services/report/drdReportModel.ts"` | TAK — same `viz.dimensions`; **stąd wniosek, że adapter nie cofa naprawy 346** |
| 6 | Montaże trasy `/api/assessments` | 1 (`Gateway.ts:1110`) | `bash -c "grep -n 'assessmentHubRoutes' server/src/Gateway.ts"` | TAK — **trasa jest ŻYWA**, to nie jest mina |
| 7 | Wołacze frontowe `Api.get('/assessments')` | 3 | `bash -c "grep -rn \\"Api.get('/assessments')\\" src/ --include=*.tsx"` | TAK — mierzy realną konsumpcję, nie samo istnienie trasy |
| 8 | Wywołania `computeProgressFields` w jej pliku | 3 (`:158`, `:240`, `:352`) | `bash -c "grep -n 'computeProgressFields' server/src/routes/assessment/assessment-hub.routes.ts"` | TAK — jedna naprawa obsługuje trzy trasy |
| 9 | Klasyfikacja osiągalności czterech plików z promienia | `unreachable` / `unreachable` / `app` / `app` | `node scripts/dev/reachability-from-root.mjs` + filtr po `file` | TAK — rozdziela „minę" od „żywego kłamstwa" |
| 10 | Liście `translation.json` | pl 35199 / en 33066 | `node -e 'const f=require("fs");function c(o){let n=0;const w=v=>{if(v&&typeof v==="object"){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ["pl","en"])console.log(l,c(JSON.parse(f.readFileSync("public/locales/"+l+"/translation.json","utf8"))));'` | TAK — **liczba nie może zmaleć** |

---

## B.4. TABELA ROZŁĄCZNOŚCI

### B.4.1. Pliki zapisywane NA PEWNO

| # | Plik | Rodzaj | Pozycja | Ryzyko kolizji |
| --- | --- | --- | --- | --- |
| 1 | `server/src/services/report/assessmentCompleteness.ts` | NOWY | R2 | ZEROWE |
| 2 | `src/services/assessmentCompleteness.ts` | NOWY | R2 | ZEROWE |
| 3 | `server/src/services/report/drdVizAdapter.ts` | ZASTANY | R2 | ŚREDNIE — konsumowany przez model raportu; **zmieniasz wyłącznie dwa miejsca liczenia** |
| 4 | `src/services/drdVizAdapter.ts` | ZASTANY | R2 | ŚREDNIE — bliźniak frontowy; **ta sama zmiana, ten sam commit** |
| 5 | `server/src/routes/assessment/assessment-hub.routes.ts` | ZASTANY | R3 | ★★ WYSOKIE — plik z `@ts-nocheck`, 7 tras; **wyłącznie ciało `computeProgressFields`** |
| 6 | `evidence/licznik-kompletnosci-20260904/**` | NOWY | R1/R2/R3 | ZEROWE — **twój** katalog dowodów |
| 7 | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY351_LICZNIK_KOMPLETNOSCI_REPORT.md` | NOWY | R5 | ZEROWE |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Pozycja | Warunek |
| --- | --- | --- |
| `server/src/services/report/drdReportModel.ts`, `src/services/report/drdReportModel.ts` | R2 | Tylko jeśli wspólna definicja daje **identyczne** zachowanie; testy dyżuru 346 muszą pozostać zielone bez zmiany asercji |
| `src/components/assessment/reports/templates/DRDReportTemplate.tsx`, `src/components/assessment/ReportEditor.tsx` | R4 | Wyłącznie poprawność liczby i etykiety; **zero zmian osiągalności**, `reachability --check-baseline` dalej `exit 0` |
| `src/components/assessment/reports/AssessmentReportVisualizations.tsx` | R4 | Wyłącznie etykieta/podpis kafla „Completion"; kafel zostaje. Wiersz `:332` tylko jeśli `R1` udowodnił, że liczy kompletność |
| `src/components/assessment/drd/drdAnswersAdapter.ts`, `tools/SIRIForm.tsx`, `tools/DRDForm.tsx`, `src/services/report/assessmentReportDataAdapter.ts` | R2 | Wyłącznie po werdykcie `KOMPLETNOŚĆ` w `R1`, z uzasadnieniem w raporcie |
| `tests/unit/**`, `server/src/**/__tests__/**` (NOWE) | R2/R3/R4 | `git add -f`; test musi czerwienić się od mutacji **ZABEZPIECZENIA**, nie mechanizmu |
| `docs/program/REJESTR_ZNALEZISK_20260903.md` | R5 | Jedna nowa sekcja o **pierwszej wolnej literze**, sprawdzonej komendą tuż przed commitem |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

```
server/src/Gateway.ts                                    — montaz tras, plik przekrojowy
server/src/middleware/auth.middleware.ts                 — bramka platformowa
server/src/middleware/orgContext.middleware.ts           — bramka platformowa
server/src/data/drdStructure.ts                          — mianownik jest poprawny
src/services/drdStructure.ts                             — jw.
src/utils/drdReportFlag.ts                               — flaga ujawniania, default OFF
tests/setup.ts, tests/helpers/**, tests/__mocks__/**     — Z18
vitest*.config.ts, server/vitest.config*.ts              — Z18
.husky/pre-commit, scripts/check-*.sh                    — bramki, Z18
docs/program/waves/WAVE_03_ACCEPTANCE/modules/**         — macierz odbioru, teren dyzuru 353
evidence/g19/**                                          — teren dyzuru 353
evidence/silniki-raportu-oceny-20260904/**               — CUDZE dowody (dyzur 339)
evidence/raport-oceny-kompletnosc-20260904/**            — CUDZE dowody (dyzur 346)
src/components/standard/StandardPreview.tsx              — teren dyzuru 352
src/components/DiscoveryTools/**, src/toolPacks/**       — teren dyzuru 354
src/components/Discovery/**                              — teren dyzuru 354
server/migrations/**                                     — przedzial NIEPRZYDZIELONY
public/locales/**                                        — ten dyzur nie dodaje kluczy
```

### B.4.4. Zasoby wyłączne

| Zasób | Wartość | Sprawdzone |
| --- | --- | --- |
| Port PostgreSQL | 6410 | `lsof -nP -iTCP:6410 -sTCP:LISTEN` → puste (zmierzone przy pisaniu instrukcji na markerze `c0f690bae3`) |
| Port harnessu | 5550 | `lsof -nP -iTCP:5550 -sTCP:LISTEN` → puste |
| Nazwa kontenera | `cx-day351-pg` | `docker ps -a --format '{{.Names}}' \| grep cx-day351` → brak |
| Nazwa bazy | `cx351` | n/d |
| **Przedział migracji** | **NIEPRZYDZIELONY** — dyżur nie dodaje migracji | `ls server/migrations/` — nie tworzysz tam nic; potrzeba migracji = **STOP MERYTORYCZNY z briefem** |
| Gałąź | `codex/day351-licznik-kompletnosci-20260904` | nie istnieje na `github-backup` (sprawdzone) |
| Worktree | `/private/tmp/cx-day351-licznik-kompletnosci` | nie istnieje (sprawdzone) |
| Flagi funkcyjne | **ŻADNA NOWA.** Zastane w promieniu: `isDrdReportEnabled` (OFF), `drdHttpSourceOfTruthV1` (OFF) | `bash -c "grep -rn 'VITE_.*DRD' .env* docker-compose* railway* 2>/dev/null"` → 0 trafień na markerze |

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
cd /private/tmp/cx-day351-licznik-kompletnosci
git diff --name-only --cached | tee /private/tmp/cx-day351-licznik-kompletnosci-artefakty/staged.txt
grep -iE 'Gateway\.ts|auth\.middleware|orgContext\.middleware|drdStructure|drdReportFlag|tests/setup|tests/helpers|tests/__mocks__|vitest.*config|\.husky/|scripts/check-|waves/WAVE_03_ACCEPTANCE/modules/|evidence/g19/|evidence/silniki-raportu-oceny|evidence/raport-oceny-kompletnosc|standard/StandardPreview|components/DiscoveryTools/|toolPacks/|components/Discovery/|server/migrations/|public/locales/' \
  /private/tmp/cx-day351-licznik-kompletnosci-artefakty/staged.txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged <plik>)" \
  || echo "rozlacznosc OK"

# ★ oba adaptery maja isc RAZEM — naprawa jednego drzewa zostawia klamstwo w drugim:
git diff --name-only --cached | grep -c 'drdVizAdapter.ts'
#   oczekiwane przy commicie R2: 2

# ★ NOWY plik testowy pod src/ czerwieni bezpiecznik osiagalnosci:
git diff --name-only --cached --diff-filter=A | grep -E '^src/.*\.(test|spec)\.(ts|tsx)$' \
  && echo "★★ NOWY TEST POD src/ — PRZENIES DO tests/" || echo "testy we wlasciwym miejscu"

# ★ dowody MAJA byc w repo, nie w katalogu tymczasowym:
git diff --name-only --cached | grep -c '^evidence/licznik-kompletnosci-20260904/'
#   oczekiwane przy commitach R1/R2/R3: co najmniej 1
```

---

## R1 — INWENTARZ WSZYSTKICH MIEJSC I KLASYFIKACJA

**Ta pozycja niczego nie naprawia.** Ma zamienić cztery liczby ze zlecenia na **Twój własny,
kompletny inwentarz** i rozstrzygnąć, które z tych miejsc liczą **kompletność**, a które co innego.

**(a) Grep po KSZTAŁCIE, nie po nazwie pola.** Wariant `achievedLevel > 0 || targetLevel > 0`
(`assessment-hub.routes.ts:63`) nie zawiera słowa `actual` — wyszukiwanie po nazwie pola go zgubi.
Podaj **swoją** liczbę trafień i swój wzorzec.

**(b) Tabela inwentarza.** Dla każdego trafienia: `plik:linia` · fragment kodu · **co ta liczba
naprawdę znaczy** (jedno zdanie) · werdykt `KOMPLETNOŚĆ` / `INNE` z uzasadnieniem · klasyfikacja
osiągalności pliku z `scripts/dev/reachability-from-root.mjs`.

**★ Werdykt `INNE` jest tak samo cenny jak `KOMPLETNOŚĆ`.** Przykład, który sam widzę i którego
nie rozstrzygam za Ciebie: `AssessmentReportVisualizations.tsx:332` liczy
`chartData.filter((d) => d.current > 0 || d.target > 0).length >= 3` i nazywa się `hasSignal` —
to wygląda na pytanie „czy wykres ma w ogóle co narysować", a nie na kompletność oceny. Zmiana
takiego miejsca byłaby **regresją**, nie naprawą.

**(c) Osobno wypisz, które miejsca są ŻYWE, a które są MINĄ.** Kryterium: klasyfikacja
osiągalności **konsumenta liczby**, nie samego pliku. `src/services/drdVizAdapter.ts` ma
klasyfikację `app`, ale jego `completionPercent` konsumują wyłącznie dwa pliki `unreachable` —
i to jest **mina**. Napisz to dokładnie tak; nie zamieniaj miny w alarm ani alarmu w minę.

Prawo zatrzymania po tej pozycji.

## R2 — RDZEŃ: JEDNA DEFINICJA PER DRZEWO, MUTACJA PER MIEJSCE

**To jest powód, dla którego ten dyżur istnieje.** Nie chodzi o siedem łatek, tylko o to, żeby
ósmego wystąpienia nie dało się napisać przez przypadek.

Wymagania, w kolejności rozstrzygającej:

1. **Jedna definicja per drzewo.** `server/src/services/report/assessmentCompleteness.ts`
   i `src/services/assessmentCompleteness.ts`. Serwer i front **nie mogą importować się
   nawzajem w produkcji** — dlatego „jedna definicja" znaczy tu **jedno źródło na drzewo**,
   a nie jeden plik dla obu. Definicja odpowiada na jedno pytanie: *co liczy się jako obszar
   z odpowiedzią* — i **cel wpisany przez paczkę metodyki nią nie jest**.
2. **Kontrakt parytetu.** Nowy test w `tests/` importuje **obie** definicje i na tym samym
   zestawie danych żąda **identycznego wyniku**. To jest bezpiecznik przeciwko rozjazdowi
   bliźniaków — tej samej klasy błędu, którą dyżur 346 musiał naprawiać w dwóch plikach naraz.
3. **Wszystkie miejsca z werdyktem `KOMPLETNOŚĆ` wołają wspólną definicję.** Żadne z nich nie
   ma prawa zostać z własnym literałem.
4. **Jeżeli „obszar z celem" warto pokazać — pokazujesz go jako OSOBNĄ liczbę z własną etykietą**,
   nigdy jako kompletność.
5. **Naprawa dyżuru 346 nie zmienia zachowania.** Zastąpienie literału wywołaniem jest dozwolone
   **tylko** wtedy, gdy testy 346 pozostają zielone bez dotknięcia ich asercji.

**Dowód wymagany, w tej kolejności:**

- **inwentarz z `R1` przebiegnięty ponownie**: zero miejsc z werdyktem `KOMPLETNOŚĆ`, które nie
  wołają wspólnej definicji;
- **na danych 7 z 39**: żadne z tych miejsc nie zwraca kompletu — podaj wartość **z każdego
  miejsca osobno**, nie jedną zbiorczą;
- **na danych 39 z 39**: każde zwraca komplet — czyli poprawka **nie psuje pełnej sesji**;
- **★★ MUTACJA PER MIEJSCE.** Dla **każdego** naprawionego miejsca osobno: przywróć w nim
  alternatywę `|| target > 0` (albo `|| targetLevel > 0`) → test **CZERWONY**; cofnij przez `cp`
  z kopii w `SCRATCH` (`Z27`, **nigdy `git stash`**) → **ZIELONY**; `git diff` po cofnięciu
  **pusty**. **Jedna mutacja „reprezentatywna" nie wystarcza** — mutacja, która czerwieni test
  z jednego miejsca, a przechodzi z drugiego, dowodzi, że drugie nie jest bronione;
- **mutacja kontrolna na kontrakcie parytetu**: zmień definicję **tylko w jednym drzewie** →
  kontrakt parytetu ma **CZERWIENIĆ**. Jeżeli przechodzi, Twój parytet nie jest bezpiecznikiem.

★ **Dowód mutacyjny ma celować w ZABEZPIECZENIE, nie w mechanizm** (`Z32`). Test, który czerwieni
się od byle zmiany w adapterze, ale nie od przywrócenia alternatywy, **nie broni niczego**.

Prawo zatrzymania po tej pozycji.

## R3 — RDZEŃ: DOWÓD NA ŻYWEJ TRASIE, NA REALNYM POSTGRESQL

**Dlaczego to jest rdzeń, a nie dodatek.** `/api/assessments` jest zamontowana w `Gateway.ts:1110`
i ma trzech wołaczy frontowych. To jedyne miejsce w promieniu tego dyżuru, gdzie defekt jest
**żywy dzisiaj**, a nie miną na przyszłość.

Wymagania:

1. **Kontener `cx-day351-pg` na porcie `6410`, baza `cx351`**, obraz `pgvector/pgvector:pg16`
   (`postgres:15` **nie przechodzi migracji** — brak rozszerzenia `vector`). **Dwa przebiegi
   migracji**, drugi bezbłędny i bez zmian (idempotencja). Oba logi do `evidence/`.
2. **★★ Test musi trafić w przypadek, w którym derywacja osi ma znaczenie.**
   `computeProgressFields` zwiera obliczenie: `if (completionPercent > 0) { progress = completionPercent; }`
   stoi **przed** gałęzią liczącą `completedAxes`. Jeżeli zasiejesz ocenę z niezerową kolumną
   `completion_percent`, **zmierzysz kolumnę, a nie licznik** — i Twój test przejdzie z całkiem
   innego powodu, niż myślisz. Sprawdź to komendą 6 i napisz w raporcie, jak zapewniłeś warunek.
3. **Sesja z odpowiedziami na 7 z 39 obszarów** założona na **Twojej** bazie i **Twoim** porcie,
   nigdy na demo, staging ani produkcji (`Z9`, `Z28`). Dane demo są twarzą produktu — po pomiarze
   `docker rm -fv cx-day351-pg` (bez `-v` wolumen zostaje), a w raporcie identyfikator oceny
   i sposób jej zasiania.
4. **Para asercji, nie pojedyncza liczba:** przy 7 z 39 trasa raportuje niepełny postęp
   **oraz** przy 39 z 39 raportuje pełny. Sam „niepełny" nie odróżnia naprawy od wygaszenia
   funkcji — to jest kształt „zamknięte przez wygaszenie".
5. **Dowód mutacyjny wycelowany w zabezpieczenie**: przywróć alternatywę w `computeProgressFields`
   → **CZERWONY**; cofnij przez `cp` → **ZIELONY**; `git diff` po cofnięciu **pusty**.
6. **`@ts-nocheck` w pierwszej linii pliku trasy** znaczy, że kompilator nie złapie Twojego błędu
   typu. **Dowodem poprawności jest wyłącznie przelot testowy**, nigdy „tsc przeszło".

**Jeżeli nie zdołasz zasiać oceny na realnym PG** — to jest **STOP MERYTORYCZNY z briefem**,
pełnowartościowy wynik pozycji: opisujesz, czego zabrakło, i podajesz, ile pracy potrzeba.
**Nie zastępujesz tego testem na atrapie bazy z adnotacją „przybliżenie"** — atrapa
(`Database.ts:686`) zwraca `changes:1` dla każdego `UPDATE` niezależnie od `WHERE` i nie jest
dowodem czegokolwiek o zapisie.

Prawo zatrzymania po tej pozycji.

## R4 — ROZBROJENIE MINY: NIEOSIĄGALNI KONSUMENCI I KAFEL „COMPLETION"

**Zacznij od sprostowania, nie od kodu.** `DRDReportTemplate.tsx` i `ReportEditor.tsx` są dziś
`unreachable` — **klient tej liczby nie widzi**. Zweryfikuj to sam (`B.3`, wiersz 9) i zapisz
wynik. Nie strasz w raporcie kłamstwem, którego nikt nie czyta.

Produkty pozycji:

1. **Poprawna liczba w obu komponentach** — przez wspólną definicję z `R2`, nie przez własny
   literał.
2. **Etykieta, która nie twierdzi więcej, niż wie.** Kafel „Completion" zostaje na miejscu;
   jeżeli poprawna liczba wymaga innego podpisu (np. rozdzielenia „obszarów z odpowiedzią" od
   „obszarów z celem") — zmieniasz podpis. **Usunięcie kafla nie jest naprawą** (`Z40`).
3. **★ Zero zmian osiągalności.** Nie dopisujesz wołacza, nie rejestrujesz trasy, nie zdejmujesz
   flagi. To byłoby odsłonięcie ekranu bez akceptu właściciela (`Z11`), a właściciel **nigdy nie
   jest pierwszym testerem wizualnym**. Dowód: `node scripts/dev/reachability-from-root.mjs
   --check-baseline` dalej `exit 0`, a klasyfikacja obu plików dalej `unreachable`.
4. **Jedno zdanie w raporcie**: co dokładnie zobaczy klient **w dniu, w którym ktoś te komponenty
   podłączy** — przed Twoją zmianą i po niej.

Prawo zatrzymania po tej pozycji.

## R5 — RAPORT I JEDNA SEKCJA REJESTRU

Struktura `§R.2`. Obowiązkowo:

- **tabela inwentarza z `R1`** w całości, z werdyktami `KOMPLETNOŚĆ`/`INNE` i uzasadnieniem
  każdego `INNE`;
- **wartości z KAŻDEGO naprawionego miejsca osobno**, przed i po, na danych 7/39 i 39/39;
- **wszystkie dowody mutacyjne z `R2` i `R3` dosłownie**, z komendami i wynikami, oraz pustymi
  `git diff` po cofnięciach;
- **wyniki obu przebiegów migracji** i `df -h /` przed i po;
- **tabela rozbieżności wobec liczb tej instrukcji** — każda liczba, którą Twój pomiar obalił;
- obowiązkowy akapit `§0.2e` dla **każdego** uruchomionego pakietu: która z pułapek (a)–(e) go
  dotyczy, jak ją wyłączyłeś i co dowodzi, że wyłączyłeś;
- deklaracja `Z30`;
- sekcja **TWIERDZENIA NIEZWERYFIKOWANE** **niepusta**. Wymień w niej co najmniej: zachowanie
  ekranu Oceny po włączeniu flagi `isDrdReportEnabled` (flagi nie włączasz), zachowanie
  `DRDReportTemplate.tsx` po jego podłączeniu (nie podłączasz), oraz to, czy kolumna
  `completion_percent` w bazie demo jest zerowa dla realnych ocen (bazy demo nie dotykasz).

★ Zanim dopiszesz cokolwiek do jakiegokolwiek dokumentu, sprawdź, czy nie jest GENEROWANY:
`bash -c "grep -rl '<nazwa-pliku>' scripts/"`. Sekcję w `REJESTR_ZNALEZISK_20260903.md`
dopisujesz o **pierwszej wolnej literze** — sprawdź ją komendą
`bash -c "grep -nE '^## [A-Z]\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"`
**tuż przed commitem**, bo równolegle pisze inny autor.

**Commit po `R5`.**

## Próg odbioru

**Istnieje jedna definicja kompletności per drzewo; każde miejsce, które `R1` uznał za liczące
kompletność, ją woła; KAŻDE takie miejsce ma WŁASNY dowód mutacyjny w kolorze RED; a żywa trasa
`/api/assessments` udowodniona jest na realnym PostgreSQL parą asercji 7/39 i 39/39.**

Odbiorca odrzuci dyżur, w którym: mutacja jest jedna „reprezentatywna" zamiast jednej na miejsce;
kafel „Completion" został usunięty zamiast poprawiony; testy dyżuru 346 zostały osłabione albo
przepisane; nieosiągalny komponent został podłączony; dowód zapisu stoi na atrapie bazy; albo
przepisano moje liczby zamiast zmierzyć własne.

## Prawo zatrzymania

Obowiązuje po każdej pozycji z osobna. „R1 zrobione, R2 zrobione, R3 rozpoczęte, R4-R5 nietknięte"
jest pełnowartościowym wynikiem — o ile R1 stoi na własnym inwentarzu, a R2 na mutacji **per
miejsce**.

**Odwrotna kolejność — inwentarz i raport zrobione, a licznik dalej w siedmiu kopiach — jest
podstawą odrzucenia.** Opisanie defektu nie jest jego naprawą.

---

## AUDYT SPRZECZNOŚCI — pary wymagań i miejsce rozstrzygnięcia

| Para wymagań, która mogłaby się wykluczać | Gdzie ROZSTRZYGNIĘTA w tym dokumencie |
| --- | --- |
| „Jedna definicja" **vs** „serwer i front to osobne drzewa, które nie mogą się importować" | `R2` punkt 1 i 2 — **jedno źródło na drzewo plus kontrakt parytetu w teście**; ta sprzeczność jest pozorna i tu jest rozstrzygnięta wprost |
| „Napraw wszystkie miejsca formuły" **vs** „zmiana miejsca, które liczy co innego, jest regresją" | `R1` punkt (b) — najpierw **klasyfikacja z werdyktem**, dopiero potem naprawa; werdykt `INNE` jest wynikiem, nie uchyleniem się |
| Zakaz `Z40` „nie cofasz naprawy 346" **vs** `R2` dotyka obu plików modelu raportu | `B.1` wiersz „modele raportu" i `R2` punkt 5 — wolno **wyłącznie** zastąpić literał wywołaniem o **identycznym** zachowaniu, przy zielonych i nietkniętych testach 346 |
| Zakaz `Z11` „nie odsłaniasz ekranu bez akceptu" **vs** `R4` naprawia dwa komponenty ekranowe | `R4` punkt 3 — naprawiasz **liczbę**, nie osiągalność; dowodem jest `reachability --check-baseline` `exit 0` i niezmieniona klasyfikacja `unreachable` |
| Zakaz `Z40` „nie ukrywasz metryki" **vs** „etykieta ma nie twierdzić więcej, niż wie" | `R4` punkt 2 — zmieniasz **podpis**, kafel zostaje; usunięcie kafla jest odrzuceniem pozycji |
| Zakaz `Z17` „nic poza zakresem" **vs** trasa `/api/assessments` jest plikiem z siedmioma trasami | `B.1` wiersz „trasa listy ocen" — licencja obejmuje **wyłącznie ciało `computeProgressFields`**; montaż, liczba tras i `@ts-nocheck` pozostają nietknięte |
| „Dowód na realnym PG" **vs** `Z9` „żadnej bazy poza własnym kontenerem" | `R3` punkt 3 — sesję zakładasz na `cx351` na porcie `6410`, po pomiarze `docker rm -fv`; demo, staging i produkcja są poza zasięgiem |
| „Test ma być zielony" **vs** zakaz osłabiania asercji (`Z40`) | `R3` punkt 6 i `Próg odbioru` — zielony **z właściwego powodu**; `@ts-nocheck` sprawia, że „tsc przeszło" nie jest dowodem niczego |
| Zakaz `Z13` „dokładnie JEDEN nowy dokument" **vs** `R1`/`R2`/`R3` piszą pliki dowodowe | `Z13` (pole „jedyny inny dokument") — `evidence/licznik-kompletnosci-20260904/` to **ślad**, nie dokument rejestrowy; nowy dokument rejestrowy jest dokładnie jeden — raport `R5` |
| „Dowody commituj do repo" **vs** `Z13` „zrzuty i pliki wynikowe NIE wchodzą do repo" | `B.1` wiersz „dowody" — **ta instrukcja daje jawną licencję na `evidence/licznik-kompletnosci-20260904/` z `git add -f`**; 04.09 trzykrotnie trzeba było ratować dowody z katalogów tymczasowych, więc tu licencja jest silniejsza od reguły ogólnej |
| „Cofaj mutacje" **vs** `Z27` (zakaz `git stash`) | `R2` i `R3` — kopia przez `cp` do `SCRATCH`; `git diff` po cofnięciu ma być pusty |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C szkieletu)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — patrz tabela wyżej | TAK — jedenaście par, każda rozstrzygnięta w treści |
| 2 | Każda ścieżka istnieje na markerze albo jest oznaczona `NOWY` | TAK — sprawdzone na worktree z markera `c0f690bae3`; zero `BRAK`. Trzy pliki oznaczone `NOWY`: dwie definicje i katalog dowodów |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — `B.3`, dziesięć wierszy; **cztery liczby ze zlecenia obalone własnym pomiarem** i wypisane w „Sprostowaniu" |
| 4 | Tabela licencji kompletna, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — każdy wiersz „tylko odczyt" ma rzeczownik-produkt (diff · brief · kontrakt · errata · opis) |
| 5 | Wykonalność per pozycja bez plików przekrojowych, z dowodem przy `NIE` | TAK — `B.2`, kolumna 4; naprawa siedzi w ciałach funkcji, `Gateway.ts` pozostaje nietknięty |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych (352, 353, 354 oraz starsze 343-350) | TAK — `B.4.4`; porty 6410/5550 zmierzone jako wolne, kontener i gałąź nie istnieją. ★ Instrukcje 355-358 pisze równolegle inny autor — dlatego `Z7` zaostrzony: port zajęty = STOP całości, nigdy podmiana numeru |
| 7 | Komendy paste-ready, z komentarzem oczekiwanego wyniku | TAK — wszystkie grepy przez `bash -c`, wszystkie przeloty z `--retry=0` i `--reporter=json` |
| 8 | Pułapki środowiska w całości + pułapki właściwe temu modułowi (pięć) | TAK — `§0.2d` osiemnaście punktów + `§0.2e` punkt (e) z pięcioma pułapkami tego dyżuru |
| 9 | Samodzielność — zero odwołań do rozmów i „poprzedniego dyżuru" bez ścieżki | TAK; każdy cytat pracy dyżuru 346 ma SHA commita albo ścieżkę pliku |
| 10 | Klauzula sprzeczności obecna; niewypełnionych pól szablonu: `0`; wierszy `Z`: `41` | TAK — sprawdzone przez generator, który blokuje zapis przy niespełnieniu |
