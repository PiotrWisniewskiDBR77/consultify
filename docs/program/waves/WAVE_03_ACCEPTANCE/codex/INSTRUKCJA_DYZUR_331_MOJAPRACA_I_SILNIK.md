# INSTRUKCJA DYŻURU nr 331 — Codex — „Dyżury 295 (dowody Mojej Pracy) i 298 (silnik raportu Oceny) miał domknąć dyżur 322 i nie zaczął żadnego z nich — ten dyżur robi oba od zera w NOWYM worktree: (295) enumeracja kontrolek Idei dziś dowodzi tylko 12 z 226 sygnatur, bo test mierzy `idea-table` (lista Idei), nie realne narzędzie tabeli (`IdeaTableTool` montowane przez `idea-table-timeline-stuck.tsx`, `initialTool="table"`), i przechodzi nawet po wypatroszeniu handlera; (298) `buildAcceptedDrdReportModel`/`methodSessionReportMetadataService` mają zero konsumentów produkcyjnych mimo że DOCX z modelu jest piksel-w-piksel identyczny z zaakceptowanym 21-stronicowym prototypem (`DEC-2026-09-03-385`) — a repo niesie NIE JEDEN, tylko przynajmniej DWA inne już podłączone silniki raportu (DOCX przez `assessmentReportContractService` na `method-core.routes.ts`, i HTML przez `generateDrdReport`/`drdLlmNarrator` na `assessment-reports.routes.ts`, ten drugi z narratorem LLM już wpiętym BEZ żadnej flagi) — ustalenie relacji między wszystkimi jest warunkiem podłączenia, nie założeniem"

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
> **wyłącznie** `/private/tmp/cx-day331-mojapraca-i-silnik`.

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
Zakres: **PRZEKROJOWE — (a) Moja Praca/Idee: dowody enumeracji kontrolek na właściwym ekranie + ścieżka 409 na produkcyjnej trasie + Inicjatywy do kanonu (dyżur 295); (b) silnik raportu Oceny DRD: relacja z istniejącymi pipeline'ami + podłączenie + warunek tenantowy + narrator (dyżur 298). Z prawem zatrzymania PO KAŻDEJ pozycji i plikiem postępu `/private/tmp/cx-day331-postep.md`**.
Trasy front: `Pozycja (a): `src/components/MyWork/IdeaTableTool.tsx` i trzy siostrzane narzędzia Idei (mindmap/whiteboard/process-flow) w `src/components/MyWork/**`, `src/components/MyWork/__tests__/ideaTools.controlEnumeration.test.tsx` (★ dziś `describe.runIf(Boolean(HARNESS_URL))` — SKIP bez zmiennej środowiskowej, kontrakt `idea-table` ma `unique:27`, suma czterech ekranów = 226, dowiedziona mutacyjnie tylko część), `dev-render/screens/idea-table-timeline-stuck.tsx` (★ REALNY `<IdeaMapWorkspace initialTool="table">` → montuje REALNY `<IdeaTableTool>` — WŁAŚCIWY ekran do pomiaru), `dev-render/screens/idea-table.tsx` (★ to jest LISTA Idei — `<IdeaTableScreen>` — NIEWŁAŚCIWY ekran, dziś użyty przez kontrakt), `src/components/Initiatives/**` (R5 kanon `standard/`, 6 bloków podglądu)`. Trasy tył: `Pozycja (a): `server/src/routes/v8/my-work.routes.ts` (kod `NOTEBOOK_PAGE_CONFLICT`, linie ok. 1483-1489 i 1601-1607 — konflikty PUT/PATCH strony notatnika — TU idzie dowód wyścigu 409, bo ma frontowego wołacza w `NotebookContent.tsx`), KONTRA `server/src/routes/notebook.routes.ts` (`P07_CONCURRENT_EDIT_CONFLICT` — trasa bez frontowego wołacza, dowód na niej nie liczy się jako dowód produktu). Pozycja (b): `server/src/services/report/acceptedDrdReportModel.ts` (133 linii, zero wołaczy poza definicją), `server/src/services/report/methodSessionReportMetadataService.ts` (105 linii, zero wołaczy poza singletonem, `save()` linie ok. 69-90 z warunkiem tenantowym `WHERE EXISTS(...)` JUŻ W ZAPYTANIU ZAPISU), `server/src/routes/method-core.routes.ts` (trasa `/sessions/:sessionId/assessment-report.docx`, woła `assessmentReportContractService.build()` + `buildAssessmentDrdReportSchema()` — pipeline DOCX #1, już podłączony), `server/src/routes/assessment-reports.routes.ts` (★ trasa HTML z `buildDrdReportHtmlServer`/`generateDrdReport`, linie ok. 1105-1148 — pipeline #2, już podłączony, Z WŁASNYM narratorem LLM z `drdLlmNarrator.ts`/`makeLlmNarrator`, wpiętym BEZ żadnej flagi funkcyjnej — sprawdź to jako fakt, nie jako zadanie do naprawy w tym dyżurze, chyba że Twoja R4 każe scalić silniki)`.

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
WT=/private/tmp/cx-day331-mojapraca-i-silnik
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
git -C "$VAULT" worktree add "$WT" -b codex/day331-mojapraca-i-silnik-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day331-mojapraca-i-silnik/config.worktree"
cat "$VAULT/worktrees/cx-day331-mojapraca-i-silnik/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day331-mojapraca-i-silnik-scratch
mkdir -p /private/tmp/cx-day331-mojapraca-i-silnik-artefakty

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
git -C "$WT" push github-backup codex/day331-mojapraca-i-silnik-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 1c3d3da844ae03c87985a8f5dc74846a073c0220..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `10` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
# (1) TEZA: worktree 331 NIE ISTNIEJE — tworzysz nowy, z markera
ls -d /private/tmp/cx-day331-mojapraca-i-silnik
#   oczekiwane: "No such file or directory" — potwierdza, ze tworzysz od zera zgodnie z §0.1

# (2) TEZA: kontrakt enumeracji Idei mierzy 'idea-table' jako pojedynczy ekran z unique:27, suma 4 ekranow = 226
grep -n "idea-table\|unique:" src/components/MyWork/__tests__/ideaTools.controlEnumeration.test.tsx
#   oczekiwane: wpis 'idea-table': { ... unique: 27 ... }; suma unique czterech wierszy (53+65+81+27) = 226

# (3) TEZA: test enumeracji jest warunkowo pomijany bez zmiennej srodowiskowej
grep -n "describe.runIf\|HARNESS_URL" src/components/MyWork/__tests__/ideaTools.controlEnumeration.test.tsx
#   oczekiwane: `describe.runIf(Boolean(HARNESS_URL))` — test SKIP, gdy DAY295_IDEA_HARNESS_URL nieustawione

# (4) TEZA: screen 'idea-table' montuje LISTE (IdeaTableScreen), NIE narzedzie tabeli
grep -n "'idea-table':" dev-render/main.tsx
sed -n '2143,2146p' dev-render/main.tsx
#   oczekiwane: label zawiera "Idea jako tabela (pelny obiekt: lista + podglad...)" — to REKORD/LISTA, nie tool

# (5) TEZA: realne IdeaTableTool jest montowane przez ekran 'idea-table-timeline-stuck' z initialTool="table"
grep -n "initialTool" dev-render/screens/idea-table-timeline-stuck.tsx
#   oczekiwane: `initialTool="table"` — REALNY <IdeaMapWorkspace> → REALNY <IdeaTableTool>

# (6) TEZA: 409 NOTEBOOK_PAGE_CONFLICT istnieje na produkcyjnej trasie my-work.routes.ts, ma frontowego wolacza
grep -n "NOTEBOOK_PAGE_CONFLICT" server/src/routes/v8/my-work.routes.ts
grep -rln "NOTEBOOK_PAGE_CONFLICT" src/
#   oczekiwane: 3 trafienia w routes (ok. 1486,1603,1723), 1 plik front (`NotebookContent.tsx`)

# (7) TEZA: buildAcceptedDrdReportModel i methodSessionReportMetadataService maja PO JEDNYM trafieniu — wlasna definicja
git grep -n 'buildAcceptedDrdReportModel' -- server src scripts | grep -v __tests__
git grep -n 'methodSessionReportMetadataService' -- server src | grep -v __tests__
#   oczekiwane: dokladnie 1 wiersz kazde — definicja/singleton, zero wolaczy

# (8) TEZA: warunek tenantowy save() jest JUZ w zapytaniu zapisu (WHERE EXISTS przed ON CONFLICT), nie tylko w GET po zapisie
sed -n '69,92p' server/src/services/report/methodSessionReportMetadataService.ts
#   oczekiwane: `INSERT ... SELECT ... WHERE EXISTS (SELECT 1 FROM method_sessions WHERE id = ? AND organization_id = ?) ON CONFLICT ...`

# (9) TEZA: istnieje DRUGI juz podlaczony silnik raportu (HTML) z narratorem LLM bez zadnej flagi
grep -n "buildDrdReportHtmlServer\|llm =\|makeLlmNarrator" server/src/routes/assessment-reports.routes.ts server/src/services/report/drdReportGenerator.ts
#   oczekiwane: `assessment-reports.routes.ts` importuje `llmService` bezwarunkowo (try/catch fail-open) i przekazuje do `buildDrdReportHtmlServer`; `drdReportGenerator.ts` wola `makeLlmNarrator` gdy `options.llm` obecne — zero sprawdzenia flagi ENABLE_*

# (10) dysk, porty, kontener
df -h /
lsof -nP -iTCP:6357 -sTCP:LISTEN; lsof -nP -iTCP:5497 -sTCP:LISTEN; docker ps --format '{{.Names}}' | grep -c cx-day331 || true
#   oczekiwane: powyzej 5 GB wolnego dysku; oba porty puste; 0 kontenerow
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day331-mojapraca-i-silnik-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6357`. Twój JEDYNY port harnessu to `5497`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day331-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000, 5037, 5060-5061, 6000, 6665-6669 oraz reszta restricted ports Chromium. Zajęte przez hosta: 5432, 5433, 6012, 6379. Rodzeństwo paczki 04.09: 330 (6356/5496), 332 (6358/5498), 333 (6359/5499) — nie dotykasz. Cudze — worktree 292/293/297 używają portów NIEZNANYCH z tej instrukcji, nie zgaduj ich. Twoje własne wyłącznie: baza 6357, harness 5497. ★ ZAKAZ `pkill`/`killall``. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `Pozycja (b) 298: narrator LLM podłączony do NOWEJ ścieżki (jeśli R4 tak zdecyduje) ma flagę default OFF, także przy braku zmiennej środowiskowej, z testem fail-safe. **NIE dotykasz** istniejącego wpięcia narratora w `assessment-reports.routes.ts`/`drdReportGenerator.ts` — ono nie ma dziś żadnej flagi i to jest ZNALEZISKO do raportu (`DO DECYZJI WŁAŚCICIELA`), nie zadanie do naprawy w tym dyżurze, chyba że Twoja analiza R4 wprost każe scalić oba silniki pod jedną ścieżką. Podłączenie deterministycznego `buildAcceptedDrdReportModel` pod akcję generowania NIE idzie za flagą, jeśli R4 ustali że ma zastąpić/uzupełnić istniejący DOCX pipeline — to kod zatwierdzony przez właściciela (prototyp 21 stron), ma działać domyślnie`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh --ci`, `scripts/check-artefakt.sh`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`. Model uprawnień: `server/src/middleware/auth.middleware.ts`, tenant middleware wołane przez `my-work.routes.ts` i `method-core.routes.ts``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY331_MOJAPRACA_I_SILNIK_REPORT.md`. Dozwolone nowe/zmieniane pliki dokumentacyjne: raport zbiorczy pod `SCIEZKA_RAPORTU`, oraz — jeśli jeszcze nie istnieją — raporty per pozycja pod nazwami z instrukcji 295/298 (`CODEX_DAY295_MOJAPRACA_INICJATYWY_REPORT.md`, `CODEX_DAY298_SILNIK_RAPORTU_OCENY_REPORT.md` już ISTNIEJĄ z dyżuru 295/298 — dopisujesz sekcję "Dopisek dyżuru 331", nie kasujesz treści). Plik postępu `/private/tmp/cx-day331-postep.md` żyje POZA repo. Kod: zgodnie z zakresem instrukcji 295 i 298. Nowe pliki w `tests/` wymagają `git add -f`. **ZAKAZ edycji `MODULE_ACCEPTANCE.md`**. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day331-mojapraca-i-silnik-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day331-mojapraca-i-silnik-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ tworzenia dowodu 409 na `notebook.routes.ts`** — wyłącznie na produkcyjnej `my-work.routes.ts`. **ZAKAZ przyjęcia ekranu `idea-table` jako mianownika enumeracji** — właściwy ekran to `idea-table-timeline-stuck` z `initialTool="table"`. **ZAKAZ dodania nowej flagi funkcyjnej do JUŻ podłączonego, bezflagowego wpięcia narratora w `assessment-reports.routes.ts`/`drdReportGenerator.ts`** bez wyraźnego ustalenia w R4, że oba silniki mają się scalić — samo "to wygląda niebezpiecznie" nie jest licencją do zmiany pliku poza zakresem. **ZAKAZ podłączenia `buildAcceptedDrdReportModel` bez uprzedniego zmierzenia WSZYSTKICH pipeline'ów raportu w `server/src/services/report/`** (Krok 1, R4) — nie zakładaj, że są tylko dwa. **ZAKAZ manipulowania `WHERE EXISTS` w `save()` bez dowodu mutacyjnego pokazującego realny defekt** — jeśli mutacja pokaże, że zapis jest już bezpieczny, NIE dopisujesz drugiego warunku na wyrost | Dwie pozycje z kolejki 03.09/04.09 (295, 298) miały zostać domknięte przez dyżur 322 i żadna nie została rozpoczęta — worktree dla obu w ogóle nie istnieje. Enumeracja kontrolek Idei licząca się na złym ekranie daje fałszywe poczucie pokrycia (12/226 wygląda groźnie, ale prawdziwy mianownik może być zupełnie inny po zmianie ekranu). Podłączenie nowego silnika raportu bez zmierzenia wszystkich istniejących pipeline'ów grozi trzecim, konkurencyjnym generatorem tego samego dokumentu — repo ma już DWA (DOCX i HTML), z których jeden niesie już wpięty, bezflagowy narrator LLM, czego nikt dotąd nie zauważył |

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
cd /private/tmp/cx-day331-mojapraca-i-silnik

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day331-pg psql -U postgres -d cx331 \
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
cd /private/tmp/cx-day331-mojapraca-i-silnik

docker run -d --name cx-day331-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx331 \
  -p 127.0.0.1:6357:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day331-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6357/cx331 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6357/cx331 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day331-mojapraca-i-silnik && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6357/cx331 \
JWT_SECRET=cx331-test-secret-do-not-reuse \
npx vitest run testy front z roota (`npx vitest run src/components/MyWork/__tests__/ideaTools.controlEnumeration.test.tsx --retry=0`, z `DAY295_IDEA_HARNESS_URL` ustawionym na Twój harness przez `dev-render`); testy serwera z cwd `server/` i `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres DATABASE_URL=postgres://postgres:cx@127.0.0.1:6357/cx331` (`No test files found` z roota = błąd komendy, nie PASS); dowody mutacyjne obowiązkowe dla: enumeracji kontrolek (usuń handler jednej kontrolki, pokaż czerwony), warunku tenantowego `save()` (usuń `WHERE EXISTS`, pokaż że OBCY nadpisuje — albo pokaż że warunek JUŻ broni), wyścigu 409 na `my-work.routes.ts` (dwóch klientów edytuje tę samą stronę notatnika); dowód główny = plik postępu z dwiema pozycjami i werdyktem każdej --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day331-mojapraca-i-silnik-artefakty/day331-mojapraca-i-silnik.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day331-mojapraca-i-silnik && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run testy front z roota (`npx vitest run src/components/MyWork/__tests__/ideaTools.controlEnumeration.test.tsx --retry=0`, z `DAY295_IDEA_HARNESS_URL` ustawionym na Twój harness przez `dev-render`); testy serwera z cwd `server/` i `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres DATABASE_URL=postgres://postgres:cx@127.0.0.1:6357/cx331` (`No test files found` z roota = błąd komendy, nie PASS); dowody mutacyjne obowiązkowe dla: enumeracji kontrolek (usuń handler jednej kontrolki, pokaż czerwony), warunku tenantowego `save()` (usuń `WHERE EXISTS`, pokaż że OBCY nadpisuje — albo pokaż że warunek JUŻ broni), wyścigu 409 na `my-work.routes.ts` (dwóch klientów edytuje tę samą stronę notatnika); dowód główny = plik postępu z dwiema pozycjami i werdyktem każdej --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day331-mojapraca-i-silnik-artefakty/day331-mojapraca-i-silnik.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day331-mojapraca-i-silnik/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day331-pg psql -U postgres -d cx331 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day331-pg`.
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
> **(e) ★★★ **CZTERY PUŁAPKI.** (1) Kontrakt enumeracji Idei (`idea-table: unique 27`) mierzy LISTĘ Idei, nie NARZĘDZIE tabeli — po przełączeniu na właściwy ekran mianownik prawdopodobnie rośnie znacząco; nie zakładaj starej liczby po zmianie ekranu, zmierz na nowo. (2) `describe.runIf(Boolean(HARNESS_URL))` oznacza, że test PRZECHODZI (0 uruchomionych przypadków) kiedy zmienna środowiskowa nie jest ustawiona — `0 failed` w takim przebiegu NIE jest dowodem, tylko brakiem pomiaru (ten sam kształt co `Z18` pkt 18 w pułapkach środowiska). (3) `assessment-reports.routes.ts` importuje `llmService` bezwarunkowo w try/catch "fail-open" — to NIE jest to samo co `Z15` (zakaz LLM w Twoim WŁASNYM pomiarze/strażniku); to jest istniejąca funkcja PRODUKTU, poza zakresem naprawy w tym dyżurze, chyba że Twoja decyzja R4 o relacji pipeline'ów każe ją dotknąć wprost. (4) `save()` w `methodSessionReportMetadataService.ts` WYGLĄDA na podatny (czytany pobieżnie: "tenant sprawdzany dopiero przez GET po zapisie"), ale `WHERE EXISTS(...)` stoi w SAMYM zapytaniu `INSERT...SELECT`, przed `ON CONFLICT` — zweryfikuj mutacyjnie, zanim napiszesz w raporcie, że coś jest zepsute**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day331-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day331-mojapraca-i-silnik-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R0 (przeczytaj INSTRUKCJA_DYZUR_295.md i INSTRUKCJA_DYZUR_298.md w całości, załóż worktree z markera, załóż plik postępu z dwiema pozycjami stanu NIEROZPOCZĘTE) · R1 = (a) 295 R1-R2 (pomiar + enumeracja kontrolek NA WŁAŚCIWYM EKRANIE `idea-table-timeline-stuck`, z dowodem mutacyjnym celującym w zabezpieczenie handlera, nie w sam DOM) · R2 = (a) 295 R3 (ścieżka 409 na produkcyjnej `my-work.routes.ts`) · R3 = (a) 295 R4-R5 (komplet dowodu wizualnego czterech narzędzi Idei + Inicjatywy do kanonu `standard/`) · R4 = (b) 298 Krok 1-2 (enumeracja WSZYSTKICH pipeline'ów raportu w `server/src/services/report/`, ustalenie relacji `acceptedDrdReportModel` względem DOCX i HTML, podłączenie zgodnie z ustaloną relacją) · R5 = (b) 298 Krok 3-4 (weryfikacja mutacyjna warunku tenantowego `save()`, narrator LLM za flagą TYLKO jeśli podłączasz nową ścieżkę) · R6 (raport zbiorczy)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6357` albo `5497` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6357` albo `5497`** (`Z7`).

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

Dyżury 295 (dowody Mojej Pracy) i 298 (silnik raportu Oceny) zostały wybrane przez właściciela
03.09 wieczorem na TERAZ i miały zostać domknięte przez dyżur 322. **Żaden z nich nie został
rozpoczęty** — worktree dla obu w ogóle nie istnieje (worktree 312, które miało je zrobić
najpierw, zostało po zakończeniu tamtego dyżuru usunięte). Obie pozycje mają kształt „biblioteka
bez wywołania": poprawny, samodzielnie testowany kod bez realnego wołacza produkcyjnego albo bez
dowodu, że mierzy właściwy obiekt.

**Pozycja (a) — 295.** Enumeracja kontrolek czterech narzędzi Idei istnieje
(`ideaTools.controlEnumeration.test.tsx`) i deklaruje mianownik 226 unikalnych sygnatur (suma
kolumny `unique`: whiteboard 53 + mindmap 65 + processflow 81 + idea-table 27). Ale: (1) test jest
`describe.runIf(Boolean(HARNESS_URL))` — bez zmiennej `DAY295_IDEA_HARNESS_URL` **przechodzi z
zerem uruchomionych przypadków**, co wygląda jak PASS, a jest brakiem pomiaru; (2) wpis
`idea-table` w kontrakcie wskazuje na ekran `dev-render/screens/idea-table.tsx`, który montuje
`<IdeaTableScreen>` — to jest **LISTA Idei** (rekord jako wiersz tabeli), nie narzędzie budowania
tabeli. Realne `<IdeaTableTool>` (`src/components/MyWork/IdeaTableTool.tsx`) jest montowane przez
`<IdeaMapWorkspace initialTool="table">` na zupełnie innym ekranie —
`dev-render/screens/idea-table-timeline-stuck.tsx`. Mianownik `27` policzony na złym ekranie nic
nie mówi o prawdziwym narzędziu; (3) tam gdzie test faktycznie coś sprawdza, robi to na poziomie
DOM (`aria-label`, `role`, `aria-expanded`) — nie na poziomie efektu. Odbiorca zweryfikował, że
test zostaje zielony nawet po wypatroszeniu handlera jednej z kontrolek — klasyczny kształt „test
scenariusza nie broni zabezpieczenia".

**Pozycja (b) — 298.** `acceptedDrdReportModel.ts` (133 linie) i `methodSessionReportMetadataService.ts`
(105 linii) mają po jednym trafieniu `git grep` — własna definicja, zero konsumentów. DOCX
wyrenderowany z tego modelu jest **piksel-w-piksel identyczny** z zaakceptowanym 21-stronicowym
prototypem (`DEC-2026-09-03-385`, „Ten raport jest po prostu fantastyczny"). Ale podłączenie nie
jest proste dopisanie importu: repo ma **już DWA inne, żywe pipeline'y** generujące raport
z tej samej sesji DRD:

1. **DOCX** — `assessmentReportContractService.build()` + `buildAssessmentDrdReportSchema()`,
   zamontowany na `/sessions/:sessionId/assessment-report.docx` w `method-core.routes.ts`.
2. **HTML** — `generateDrdReport()` (`drdReportGenerator.ts`) wołany przez
   `buildDrdReportHtmlServer()` (`drdReportService.ts`), zamontowany w
   `assessment-reports.routes.ts` (linie ok. 1105-1148). Ten pipeline ma **już wpięty, żywy
   narrator LLM** (`drdLlmNarrator.ts`, `makeLlmNarrator`) — kod importuje `llmService`
   bezwarunkowo w bloku `try/catch` „fail-open" (jeśli import padnie, cicho spada na
   deterministyczny stub) i **nie ma przy tym żadnej flagi funkcyjnej `ENABLE_*`**. To jest
   fakt zastany, nie coś do naprawienia w tym dyżurze — dopóki Twoja analiza relacji (R4) nie
   każe scalić tego pipeline'u z `acceptedDrdReportModel`.

Podłączenie trzeciego silnika bez zmierzenia dwóch pierwszych grozi trzema konkurencyjnymi
generatorami tego samego dokumentu.

**Sprostowanie, którego nie wolno pominąć.** Poprzednia instrukcja (298) zakładała, że
`methodSessionReportMetadataService.save()` sprawdza tenanta dopiero przez `get()` PO zapisie —
**to jest błędna premisa nadzorcy, nie ustalenie wykonawcy**. Realny kod (linie ok. 69-90) ma
`INSERT ... SELECT ?,... WHERE EXISTS (SELECT 1 FROM method_sessions WHERE id = ? AND
organization_id = ?) ON CONFLICT (session_id) DO UPDATE ...` — warunek tenantowy stoi **w samym
zapytaniu zapisu**, przed `ON CONFLICT`. STOP, który dyżur 298 zgłosił wobec tej pozycji, był
**zasadny**. Twoim zadaniem w R5 jest zweryfikować to mutacyjnie, nie przepisać ślepo cudzą
diagnozę w żadną stronę.

## ★ Zmierz moje liczby sam

Twierdzę: worktree 331 nie istnieje (tworzysz od zera); kontrakt enumeracji ma `idea-table:
unique 27`, suma czterech wierszy = 226; test jest `describe.runIf(Boolean(HARNESS_URL))`;
ekran `idea-table` montuje `<IdeaTableScreen>` (lista), ekran `idea-table-timeline-stuck` montuje
realny `<IdeaTableTool>` przez `initialTool="table"`; `NOTEBOOK_PAGE_CONFLICT` istnieje w
`my-work.routes.ts` (trzy miejsca, ok. 1486/1603/1723) z frontowym wołaczem w
`NotebookContent.tsx`; `buildAcceptedDrdReportModel` i `methodSessionReportMetadataService` mają
po jednym trafieniu `git grep` (własna definicja); `save()` ma `WHERE EXISTS` w zapytaniu zapisu;
`assessment-reports.routes.ts` woła `llmService` bezwarunkowo, bez flagi. **Jeśli Twój pomiar
przeczy mojej liczbie, obowiązuje Twój — zapisz rozbieżność wprost.**

---

## B.1. TABELA LICENCJI PLIKOWYCH

> **★★ ZASTRZEŻENIE.** Powyższa tabela **JEST** licencją. Jeżeli plik, którego potrzebujesz,
> jest opisany jako „PEŁNA/WĄSKA LICENCJA" — **masz pozwolenie i STOP z tytułu »nie wolno mi«
> jest NIEZASADNY**. Jeżeli pliku nie ma w tabeli — domyślnie **TYLKO DO ODCZYTU**, produkt
> zastępczy: czerwony kontrakt + brief.

| Plik / wzorzec | Pozycja | Licencja | Zastępczy produkt |
| --- | --- | --- | --- |
| `src/components/MyWork/__tests__/ideaTools.controlEnumeration.test.tsx` | (a) | **★ PEŁNA LICENCJA** — poprawka mianownika `idea-table` (screen + oczekiwana liczba), wzmocnienie asercji do dowodu efektu | — |
| `src/components/MyWork/IdeaTableTool.tsx` i trzy siostrzane narzędzia Idei w `src/components/MyWork/**` | (a) | **★ WĄSKA LICENCJA: wyłącznie jeśli enumeracja znajdzie kontrolkę bez efektu (MARTWA)** — naprawa punktowa albo wpis `MARTWE` z plik:linia | Wpis `MARTWE` w raporcie |
| `dev-render/screens/idea-table-timeline-stuck.tsx`, `dev-render/main.tsx` (rejestracja ekranu) | (a) | **TYLKO ODCZYT** — ekran istnieje, wykorzystujesz go jako cel pomiaru | — |
| `server/src/routes/v8/my-work.routes.ts` | (a) | **★ WĄSKA LICENCJA: wyłącznie ciało odpowiedzi `409 NOTEBOOK_PAGE_CONFLICT`** (dodanie pola, NIE zmiana kodu statusu ani logiki blokady) | Czerwony kontrakt + brief |
| `src/components/MyWork/NotebookContent.tsx` | (a) | **★ WĄSKA LICENCJA: wyłącznie UI reakcji na 409** (komunikat, wybór zachowaj/weź cudze, odświeżenie) | Czerwony kontrakt + brief |
| `src/components/Initiatives/**` | (a), R5 | **★ WĄSKA LICENCJA: wyłącznie ujednolicenie do kanonu `standard/`** (6 bloków podglądu) | Czerwony kontrakt + brief |
| `server/src/services/report/acceptedDrdReportModel.ts`, `server/src/services/report/methodSessionReportMetadataService.ts` | (b) | **★ PEŁNA LICENCJA** | — |
| `server/src/routes/method-core.routes.ts` | (b) | **★ WĄSKA LICENCJA: wyłącznie podłączenie/wywołanie silnika**, w miejscu ustalonym w R4. **ZAKAZ** zmiany istniejących tras poza tym jednym punktem | Czerwony kontrakt + brief |
| `server/src/routes/assessment-reports.routes.ts`, `server/src/services/report/drdReportGenerator.ts`, `server/src/services/report/drdLlmNarrator.ts`, `server/src/services/report/drdReportService.ts` | (b) | **TYLKO ODCZYT — WYJĄTEK: wolno dotknąć WYŁĄCZNIE jeśli R4 jawnie ustali scalenie z `acceptedDrdReportModel`**, z opisem promienia rażenia PRZED zmianą | Wpis `DO DECYZJI WŁAŚCICIELA` z promieniem rażenia |
| `server/migrations/2026200[0-9]*.sql`, `server/migrations/202620[1][0-9]*.sql` | (b) | **★ PEŁNA LICENCJA, wyłącznie addytywnie**, przedział `20262000`–`20262019`, dla ewentualnej kolumny/flagi metryki badania | — |
| `tests/unit/backend/security/**`, `**/*.pg.test.ts` (NOWE) | (a),(b) | **★ PEŁNA LICENCJA**, `Z18`/`Z31` | — |
| `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY295_MOJAPRACA_INICJATYWY_REPORT.md`, `CODEX_DAY298_SILNIK_RAPORTU_OCENY_REPORT.md` | — | **PEŁNA LICENCJA na DOPISYWANIE** sekcji „Dopisek dyżuru 331" na końcu. **ZAKAZ kasowania istniejącej treści** | — |
| `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts` | wszystkie | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie |
| `scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh`, `scripts/check-artefakt.sh` | wszystkie | **TYLKO ODCZYT** | Musisz przechodzić zielono |
| `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` | — | **TYLKO ODCZYT** (`Z14`) | Errata w raporcie |
| `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY331_MOJAPRACA_I_SILNIK_REPORT.md` | R6 | **JEDYNY nowy raport zbiorczy** (`Z13`) | — |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis w raporcie z plik:linia i idziesz dalej |

---

## B.2. TABELA POZYCJI

| Pozycja | Nazwa | Rdzeń? | Przekrojowe? | DoD | Definicja ukończenia | Commit |
| --- | --- | --- | --- | --- | --- | --- |
| R0 | Odczyt 295+298 + plik postępu | TAK | NIE | bazowe | Wszystko przeczytane, plik postępu założony | brak |
| R1 (a) | Pomiar + enumeracja NA WŁAŚCIWYM EKRANIE | TAK | NIE | wg instr. 295 + 1 mianownik poprawiony | Kontrakt `idea-table` wskazuje `idea-table-timeline-stuck`; mianownik przeliczony; dowód mutacyjny celujący w handler, nie w DOM | `feat(myWork): enumeracja na wlasciwym ekranie tabeli Idei (331 R1)` |
| R2 (a) | Ścieżka 409 na produkcyjnej trasie | TAK | NIE — dowód: `Z12` nie chroni `NotebookContent.tsx` całościowo | 1 test wyścigu | Dwóch klientów edytuje tę samą stronę notatnika przez `my-work.routes.ts`; front reaguje na 409 (komunikat + wybór) | `feat(myWork): 409 NOTEBOOK_PAGE_CONFLICT na produkcyjnej trasie (331 R2)` |
| R3 (a) | Komplet dowodu Idei + Inicjatywy kanon | TAK | NIE | wg instr. 295 R4-R5 | 4×8 kadrów + Inicjatywy do kanonu `standard/` | `docs(myWork): dowod 4 narzedzi + inicjatywy kanon (331 R3)` |
| R4 (b) | Relacja pipeline'ów + podłączenie | TAK | NIE — dowód: `Z12` nie chroni `method-core.routes.ts` całościowo | 1 test relacji | Wszystkie pipeline'y raportu w `server/src/services/report/` wymienione; relacja `acceptedDrdReportModel` ↔ DOCX ↔ HTML ustalona pisemnie; silnik podłączony zgodnie z ustaleniem | `feat(report): relacja pipeline'ow + podlaczenie acceptedDrdReportModel (331 R4)` |
| R5 (b) | Tenant + narrator | TAK | NIE | 2 testy | Warunek tenantowy zweryfikowany mutacyjnie (naprawiony TYLKO jeśli dowód pokaże defekt); narrator za flagą OFF TYLKO jeśli podłączasz nową ścieżkę | `fix(report): weryfikacja tenantowa + narrator za flaga (331 R5)` |
| R6 | Raport zbiorczy | NIE | NIE | n/d | Struktura `§R.2`, TWIERDZENIA NIEZWERYFIKOWANE niepuste | `docs(day331): raport` |

> Żadna pozycja nie wymaga zmiany pliku jawnie nietykalnego bez wyjątku wymienionego w `B.1`.

---

## B.3. TABELA MIANOWNIKÓW

| # | Co liczę | Liczba autora | Komenda | Obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | Suma `unique` w kontrakcie enumeracji (4 ekrany) | 226 (53+65+81+27) | `grep -oE 'unique: [0-9]+' src/components/MyWork/__tests__/ideaTools.controlEnumeration.test.tsx` | TAK |
| 2 | `unique` dla `idea-table` (mierzony na ZŁYM ekranie) | 27 | jw., wiersz `idea-table` | ★ NIE — ekran jest listą, nie narzędziem; R1 przelicza na właściwym |
| 3 | Wystąpienia `initialTool="table"` w ekranach idea-table* | 1 (w `idea-table-timeline-stuck.tsx`) | `grep -n initialTool dev-render/screens/idea-table*.tsx` | TAK |
| 4 | Wołacze `buildAcceptedDrdReportModel` poza definicją/testem | 0 | `git grep -n 'buildAcceptedDrdReportModel' -- server src scripts \| grep -v __tests__` → 1 wiersz (definicja) | TAK |
| 5 | Wołacze `methodSessionReportMetadataService` poza singletonem/testem | 0 | analogicznie | TAK |
| 6 | Pipeline'y raportu DRD już podłączone (poza `acceptedDrdReportModel`) | 2 (DOCX, HTML) | `git grep -rn 'assessment-report.docx\|buildDrdReportHtmlServer' server/src/routes` | TAK — zmierz, czy nie ma trzeciego |
| 7 | Miejsca `NOTEBOOK_PAGE_CONFLICT` w produkcyjnej trasie | 3 | `grep -c NOTEBOOK_PAGE_CONFLICT server/src/routes/v8/my-work.routes.ts` | TAK |

---

## B.4. TABELA ROZŁĄCZNOŚCI

### B.4.1. Pliki zapisywane NA PEWNO

| # | Plik/katalog | Pozycja | Ryzyko kolizji |
| --- | --- | --- | --- |
| 1 | `src/components/MyWork/__tests__/ideaTools.controlEnumeration.test.tsx` | R1 | ZEROWE |
| 2 | `server/src/routes/v8/my-work.routes.ts` (wąsko, ciało 409) | R2 | NISKIE |
| 3 | `src/components/MyWork/NotebookContent.tsx` | R2 | NISKIE |
| 4 | `src/components/Initiatives/**` | R3 | NISKIE |
| 5 | `server/src/services/report/**`, `server/src/routes/method-core.routes.ts` | R4-R5 | NISKIE |
| 6 | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY331_MOJAPRACA_I_SILNIK_REPORT.md` | R6 | ZEROWE |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Pozycja | Warunek |
| --- | --- | --- |
| `server/src/routes/assessment-reports.routes.ts`, `drdReportGenerator.ts`, `drdLlmNarrator.ts` | R4 | Tylko jeśli R4 ustali scalenie z `acceptedDrdReportModel` — z opisanym promieniem rażenia PRZED zmianą |
| `server/migrations/20262000-20262019` (NOWE) | R4 | Tylko jeśli metryka badania wymaga nowej kolumny |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

```
src/components/Interview/** — dyżur 330
scripts/dev/testy-puste-skan.mjs, tests/unit/config/noEmptyAssertions.test.ts — dyżur 332
server/scripts/migrationOrdering.ts, tests/unit/backend/schema/** — dyżur 333
server/src/routes/notebook.routes.ts (P07_CONCURRENT_EDIT_CONFLICT) — trasa bez wołacza, poza zakresem
```

### B.4.4. Zasoby wyłączne

| Zasób | Wartość | Sprawdzone |
| --- | --- | --- |
| Port PostgreSQL | 6357 | `lsof -nP -iTCP:6357 -sTCP:LISTEN` → puste |
| Port harnessu | 5497 | `lsof -nP -iTCP:5497 -sTCP:LISTEN` → puste |
| Kontener | `cx-day331-pg` | `docker ps` → brak |
| Baza | `cx331` | n/d przed startem |
| Przedział migracji | `20262000`–`20262019` | `ls server/migrations/ \| grep -cE '^202620(0[0-9]\|1[0-9])'` → 0 |
| Gałąź | `codex/day331-mojapraca-i-silnik-20260904` | nie istnieje |
| Worktree | `/private/tmp/cx-day331-mojapraca-i-silnik` | nie istnieje |
| Flagi | narrator LLM (298, tylko jeśli nowa ścieżka), default OFF | `grep -rn <nazwa flagi> → 0 miejsc z true na stałe` |

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
cd /private/tmp/cx-day331-mojapraca-i-silnik
git diff --name-only --cached | tee /private/tmp/cx-day331-mojapraca-i-silnik-artefakty/staged.txt
grep -iE 'Interview/|testy-puste-skan|migrationOrdering|notebook\.routes\.ts$' /private/tmp/cx-day331-mojapraca-i-silnik-artefakty/staged.txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## R0 — ODCZYT I PLIK POSTĘPU

Przeczytaj `INSTRUKCJA_DYZUR_295.md` i `INSTRUKCJA_DYZUR_298.md` w całości. Wykonaj 10 komend
`§0.1`. Załóż `/private/tmp/cx-day331-postep.md` z dwiema pozycjami, stan `NIEROZPOCZĘTE`.
Aktualizujesz po każdej pozycji.

Prawo zatrzymania po tej pozycji.

## R1 — (a) POMIAR + ENUMERACJA NA WŁAŚCIWYM EKRANIE

Popraw kontrakt w `ideaTools.controlEnumeration.test.tsx`: wpis dla narzędzia tabeli ma wskazywać
ekran `idea-table-timeline-stuck` (`initialTool="table"`), nie `idea-table` (lista). Uruchom
harness (`DAY295_IDEA_HARNESS_URL` ustawione na Twój `dev-render` na porcie 5497), zmierz REALNĄ
liczbę widocznych kontrolek na nowym ekranie (bazowe + po otwarciu każdego menu) — zastąp `27`
zmierzoną wartością, zapisz w raporcie jako korektę mianownika. Dla WSZYSTKICH czterech narzędzi
wzmocnij asercję z samej obecności w DOM na dowód EFEKTU: dla reprezentatywnej próbki kontrolek
(minimum 10 na narzędzie) sprawdź, że kliknięcie wywołuje zmianę stanu/handler/trasę, nie tylko
że element istnieje z odpowiednim `role`/`aria-label`. **Dowód mutacyjny obowiązkowy i musi
celować w ZABEZPIECZENIE**: usuń handler jednej z sprawdzanych kontrolek w `IdeaTableTool.tsx`
(albo siostrzanym narzędziu), uruchom test — musi zaczerwienić się; przywróć przez `cp` (`Z27`)
— musi wrócić do zielonego.

Commit po R1. Zapis w pliku postępu.

## R2 — (a) ŚCIEŻKA 409 NA PRODUKCYJNEJ TRASIE

Kontener z pełnym łańcuchem migracji od zera na porcie 6357. Dwóch klientów edytuje tę samą
stronę notatnika przez `PUT`/`PATCH` na `server/src/routes/v8/my-work.routes.ts` — dowód
wyścigu: drugi zapis dostaje `409` z kodem `NOTEBOOK_PAGE_CONFLICT` i ciałem zawierającym świeżą
wersję strony (`data: fresh`). Front (`NotebookContent.tsx`): komunikat pl/en, wybór „zachowaj
moje / weź cudze / porównaj", odświeżenie po wyborze; zrzuty stanu konfliktu light/dark. **Zakaz
robienia tego dowodu na `notebook.routes.ts` (`P07_CONCURRENT_EDIT_CONFLICT`)** — ta trasa nie ma
frontowego wołacza, dowód na niej nie mówi nic o produkcie.

Commit po R2. Zapis w pliku postępu.

## R3 — (a) KOMPLET DOWODU + INICJATYWY DO KANONU

4 narzędzia × 8 kadrów (pl/en × light/dark × 1440/1024) na PRAWIDŁOWYCH ekranach (patrz R1) +
przebieg klawiaturą (`Tab`×5, bez pułapki fokusa). A11y zero realnych naruszeń. Inicjatywy:
napraw rozjazdy z kanonem `standard/` (6 bloków podglądu) tym samym mechanizmem co w
Realizacji/Ocenie; zrzuty PRZED/PO na REALNYM rekordzie otwartym z listy (nie z fikstury
pokazowej — patrz pamięć „inicjatywy-odbior-na-fiksturze-pokazowej"); test
`initiativeRecordCanon` zielony, jeśli istnieje.

Commit po R3. Zapis w pliku postępu.

## R4 — (b) RELACJA PIPELINE'ÓW + PODŁĄCZENIE

**Krok 1 — zmierz WSZYSTKIE pipeline'y, nie zakładaj że są dwa.** `git grep` po
`generateDrdReport\|buildDrdReport\|assessmentReportContractService\|acceptedDrdReportModel`
w całym `server/src/services/report/` i `server/src/routes/`. Na dzień pisania tej instrukcji
zidentyfikowane są: (1) DOCX przez `assessmentReportContractService` na
`/sessions/:sessionId/assessment-report.docx`; (2) HTML przez `generateDrdReport`/
`buildDrdReportHtmlServer` na `assessment-reports.routes.ts`, z już wpiętym, bezflagowym
narratorem LLM. **Sprawdź, czy jest trzeci** — nie zakładaj kompletności tej listy.

**Krok 2 — ustal relację pisemnie.** Dla `acceptedDrdReportModel` względem KAŻDEGO znalezionego
pipeline'u odpowiedz: ZASTĘPUJE (ten sam dokument, nowy silnik), UZUPEŁNIA (dodatkowa sekcja
metadanych z `methodSessionReportMetadataService` — zespół doradczy, kalendarz, rekomendacje) czy
to INNA funkcja produktowa (inny format/odbiorca). Jeśli wniosek różni się od założeń instrukcji
298 — to jest wynik merytoryczny, zapisz go i zaprojektuj podłączenie zgodnie z nim, nie ze
starym założeniem.

**Krok 3 — podłącz.** Realna ścieżka HTTP → silnik → odpowiedź, zgodnie z ustaloną relacją.

Commit po R4. Zapis w pliku postępu.

## R5 — (b) TENANT + NARRATOR

**Warunek tenantowy — zweryfikuj, nie zakładaj defektu.** `save()` ma dziś `WHERE EXISTS (SELECT
1 FROM method_sessions WHERE id = ? AND organization_id = ?)` w SAMYM `INSERT ... SELECT`, przed
`ON CONFLICT`. Dowód mutacyjny w OBIE strony: (a) spróbuj zapisać jako obcy tenant (inny
`organizationId` niż właściciel sesji) — sprawdź, czy zapis faktycznie nic nie zmienia (0 wierszy
dotkniętych, `get()` po tej próbie zwraca stan sprzed); (b) usuń warunek `WHERE EXISTS` i
powtórz — sprawdź, czy TERAZ obcy NADPISUJE. Jeśli (a) pokazuje, że ochrona już działa — napisz
to wprost w raporcie jako obaloną tezę poprzedniej instrukcji, NIE dopisuj drugiego warunku na
wyrost. Jeśli chcesz zamknąć teoretyczne okno wyścigu między `SELECT EXISTS` a zapisem, opakuj
całość w jawną transakcję z testem negatywnym „właściciel zapisuje / obcy nie nadpisuje", ale to
jest wzmocnienie obronne, nie naprawa potwierdzonego błędu.

**Narrator LLM — TYLKO jeśli R4 podłącza nową ścieżkę.** Jeśli R4 Krok 3 tworzy nowe wywołanie
generowania (niezależne od istniejącego bezflagowego wpięcia w `assessment-reports.routes.ts`):
nowa flaga, domyślnie OFF (także przy braku zmiennej środowiskowej), test fail-safe (błąd modelu
→ raport i tak powstaje, bez sekcji narracyjnej). **Nie dotykasz** istniejącego wpięcia w
`assessment-reports.routes.ts`/`drdReportGenerator.ts` — ono nie ma dziś flagi i to jest
ZNALEZISKO do raportu (`DO DECYZJI WŁAŚCICIELA` z opisem promienia rażenia), nie zadanie do
naprawy tutaj.

Commit po R5. Zapis w pliku postępu.

## R6 — RAPORT ZBIORCZY

Stan obu pozycji (domknięta/częściowa/nierozpoczęta, z powodem), stan pliku postępu, poprawiony
mianownik enumeracji Idei z R1, mapa wszystkich znalezionych pipeline'ów raportu i decyzja o
relacji z R4, wynik weryfikacji tenantowej z R5 (potwierdzona ochrona albo naprawiony defekt),
znalezisko o bezflagowym narratorze istniejącego pipeline'u HTML jako `DO DECYZJI WŁAŚCICIELA`,
TWIERDZENIA NIEZWERYFIKOWANE.

## Prawo zatrzymania

Obowiązuje po każdej pozycji z osobna. „R1-R2 domknięte, R3 rozpoczęte, R4-R5 nietknięte, plik
postępu aktualny" jest pełnowartościowym wynikiem. Podłączenie trzeciego silnika raportu bez
zmierzenia dwóch istniejących nie jest wynikiem — jest nowym długiem.
