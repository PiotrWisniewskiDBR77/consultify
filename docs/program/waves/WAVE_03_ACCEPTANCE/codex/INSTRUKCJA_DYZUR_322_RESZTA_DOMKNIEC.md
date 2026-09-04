# INSTRUKCJA DYŻURU nr 322 — Codex — „Dyżur 312 domknął tylko pozycję (a) częściowo (WIP zastany, nie jego) — (b) 297 martwe od korzenia, (c) 293 biblioteka metodyk, (d) 292 R3-R6 menu Wywiadu, (e) 295 dowody Mojej Pracy, (f) 298 silnik raportu Oceny NIE ZOSTAŁY ROZPOCZĘTE (potwierdzone pomiarem: worktree 297 i 292 mają zero commitów ponad R1-R2, 293 ma niecommitowany zastany WIP 4 plików, 295/298 nie mają nawet worktree) — ten dyżur reużywa trzy istniejące worktree i zakłada jeden nowy dla dwóch ostatnich"

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
> **wyłącznie** `/private/tmp/cx-day322-reszta-domkniec`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `bc18bc7acac2ec825ebb3db2f1309738ab034d58`**
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
Zakres: **PRZEKROJOWE — pięć pozycji zostawionych przez odbiory adwersaryjne 03.09/04.09, w ustalonej kolejności wartości: (b) 297 martwe komponenty od korzenia → (c) 293 Biblioteka metodyk Oceny → (d) 292 R3-R6 menu akcji Wywiadu → (f) 298 silnik raportu Oceny (biblioteka bez wywołania) → (e) 295 dowody Mojej Pracy. Z prawem zatrzymania PO KAŻDEJ i plikiem postępu `/private/tmp/cx-day322-postep.md`**.
Trasy front: `Pozycja (c) 293: `src/components/assessment/AssessmentHub.tsx`, `src/components/assessment/library/AssessmentLibraryTab.tsx` (★ ma DZIŚ niecommitowany zastany WIP — patrz `§0.3` weryfikacja (2), NIE odrzucaj go bez przeczytania). Pozycja (d) 292: `src/components/Interview/**` (macierz akcji `interviewActionMatrix.ts`, kebab, 5 podglądów), test `src/components/Interview/__tests__/interviewActionMatrix.contract.test.tsx` (4. blok dziś jest `toContain('interviewActionMeta')` — grep po napisie, do wzmocnienia). Pozycja (e) 295: `src/components/MyWork/IdeaTableTool.tsx` i 3 siostrzane narzędzia Idei, `src/components/Initiatives/**` (R5 kanon). ★ Ekran `dev-render/screens/idea-table.tsx` to LISTA Idei — narzędzie TABELI montuje `dev-render/screens/idea-table-timeline-stuck.tsx` z `initialTool="table"` (zweryfikowane na markerze); dobór ekranu jest częścią dowodu`. Trasy tył: `Pozycja (b) 297: `scripts/dev/reachability-from-root.mjs` (NIE ISTNIEJE — piszesz od zera), `dev-render/main.tsx` jako jeden z korzeni grafu. Pozycja (f) 298: `server/src/services/report/acceptedDrdReportModel.ts` (94+ linii, ZERO wołaczy poza własną definicją — zweryfikowane `git grep`), `server/src/services/report/methodSessionReportMetadataService.ts` (105 linii, ZERO wołaczy poza singletonem), `server/src/routes/method-core.routes.ts` (trasa `/sessions/:sessionId/assessment-report.docx` już istnieje i woła INNY pipeline: `assessmentReportContractService.build()` + `buildAssessmentDrdReportSchema()` — ★ ustal relację między tymi dwoma silnikami PRZED podłączeniem, nie zakładaj). Pozycja (e) 295: `server/src/routes/v8/my-work.routes.ts` (kod `NOTEBOOK_PAGE_CONFLICT`, linie ok. 1486/1603/1723 — TU idzie wyścig produkcyjny), kontra `server/src/routes/v8/notebook.routes.ts` (`P07_CONCURRENT_EDIT_CONFLICT` — trasa BEZ frontowego wołacza, dowód wyścigu na niej nie liczy się jako dowód produktu)`.

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
WT=/private/tmp/cx-day322-reszta-domkniec
MARKER=bc18bc7acac2ec825ebb3db2f1309738ab034d58

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/grafika/m03-20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day322-reszta-domkniecia-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day322-reszta-domkniec/config.worktree"
cat "$VAULT/worktrees/cx-day322-reszta-domkniec/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day322-reszta-domkniec-scratch
mkdir -p /private/tmp/cx-day322-reszta-domkniec-artefakty

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
git -C "$VAULT" log --oneline bc18bc7acac2ec825ebb3db2f1309738ab034d58..github-backup/grafika/m03-20260902
git -C "$VAULT" diff --name-only bc18bc7acac2ec825ebb3db2f1309738ab034d58..github-backup/grafika/m03-20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day322-reszta-domkniecia-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only bc18bc7acac2ec825ebb3db2f1309738ab034d58..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `8` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
# ★ UWAGA: ten dyzur pracuje w CZTERECH drzewach (trzy zastane + jedno nowe). Ponizsze komendy
# uruchamiasz z katalogu domowego, PODAJAC sciezke przez -C. Nie robisz `cd` do cudzego worktree
# przed sprawdzeniem, ze on istnieje i na jakiej stoi galezi.

# (1) TEZA: TRZY worktree JUZ ISTNIEJA — reuzywasz, nie tworzysz nowych
ls -d /private/tmp/cx-day292-wywiad-menu /private/tmp/cx-day293-biblioteka /private/tmp/cx-day297-martwe-od-korzenia
for w in cx-day292-wywiad-menu cx-day293-biblioteka cx-day297-martwe-od-korzenia; do echo "--- $w"; git -C /private/tmp/$w log --oneline -5; git -C /private/tmp/$w branch --show-current; git -C /private/tmp/$w status --short | head -5; done
#   oczekiwane: trzy katalogi + galezie codex/day29*; ZAPISZ ostatni commit i STATUS (dirty/czysty) kazdego

# (2) ★ TEZA: 293 ma DZIS niecommitowany zastany WIP — NIE jest to Twoja praca, NIE odrzucaj bez przeczytania
git -C /private/tmp/cx-day293-biblioteka diff --stat
#   oczekiwane: ok. 4 zmienione pliki + 1 nowy katalog __tests__/, rzedu 300 wstawien — przeczytaj `git diff` w calosci przed jakakolwiek decyzja

# (3) TEZA: 292 ma tylko R1-R2 (2 commity ponad wspolnym przodkiem), R3-R6 nietkniete
git -C /private/tmp/cx-day292-wywiad-menu log --oneline 58ef0771d7..HEAD
#   oczekiwane: dokladnie 2 commity ("docs(interview): zmierz macierz" + "feat(interview): unify action matrix")

# (4) TEZA: czwarty test kontraktowy 292 jest grepem po stringu, nie asercja efektu
grep -n "toContain" /private/tmp/cx-day292-wywiad-menu/src/components/Interview/__tests__/interviewActionMatrix.contract.test.tsx
#   oczekiwane: co najmniej jedno trafienie `toContain('interviewActionMeta')` w bloku "is consumed by..."

# (5) TEZA: silnik raportu Oceny (298) ma zero wolaczy produkcyjnych — biblioteka bez wywolania
git grep -n 'buildAcceptedDrdReportModel' -- server src scripts | grep -v __tests__
git grep -n 'methodSessionReportMetadataService' -- server src | grep -v __tests__
#   oczekiwane: KAZDA komenda zwraca dokladnie JEDEN wiersz — WLASNA definicje/eksport, zero wywolan z innego miejsca

# (6) TEZA: istniejaca trasa raportu wola INNY pipeline (nie te dwa pliki)
grep -n "assessment-report.docx\|assessmentReportContractService\|buildAssessmentDrdReportSchema" server/src/routes/method-core.routes.ts
#   oczekiwane: trasa istnieje i wola inny serwis — ustal relacje miedzy nimi w R4, nie zakladaj

# (7) TEZA: idea-table.tsx to LISTA, narzedzie tabeli jest gdzie indziej
grep -n 'initialTool' dev-render/screens/idea-table-timeline-stuck.tsx dev-render/screens/idea-table.tsx
#   oczekiwane: initialTool="table" WYLACZNIE w idea-table-timeline-stuck.tsx

# (8) dysk i porty wolne
df -h /
lsof -nP -iTCP:5478 -sTCP:LISTEN; lsof -nP -iTCP:6338 -sTCP:LISTEN; docker ps --format '{{.Names}}' | grep -c cx-day322 || true
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day322-reszta-domkniecia-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6338`. Twój JEDYNY port harnessu to `5478`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day322-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000, 5037, 5060-5061, 6000, 6665-6669 oraz reszta restricted ports Chromium. Zajęte przez inne prace: 3020, 3022, 3025, 3027, 3030 (tor grafiki nadzorcy), 5322, 5410-5441 (agenci nadzorcy), 5442-5449 oraz 6311-6313 (odbiorcy nadzorcy), 5432 i 5433 (Postgres hosta), 6012, 6379 (redis), 7000, 7679, 7768, 11434. Cudze — dyżury 286-316 oraz rodzeństwo paczki 04.09: 317 (6333/5473), 318 (6334/5474), 323 (6339/5479); paczka 313-316/319-321 poza tą instrukcją, sprawdź sam. ★ UWAGA SZCZEGÓLNA: ten dyżur pracuje w TRZECH cudzych worktree naraz (292, 293, 297) — nawet tam używasz SWOJEGO portu 6338 i kontenera `cx-day322-pg`, nigdy portów, których używały oryginalne dyżury 292/293/297 (nieznane z tej instrukcji — nie zgaduj ich, nie odpalaj). Twoje własne: baza 6338, harness 5478. ★ ZAKAZ `pkill`/`killall` — zabijasz wyłącznie własne PID-y.`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `Pozycja (f) 298: narrator LLM ma powstać za flagą domyślnie OFF, z testem fail-safe (błąd modelu → raport i tak powstaje bez narracji). Flaga OFF także przy braku zmiennej środowiskowej. ★ Podpięcie deterministycznego silnika `buildAcceptedDrdReportModel` pod akcję generowania NIE idzie za flagą — to jest kod zatwierdzony, ma działać domyślnie, jeśli w R4 ustalisz, że rzeczywiście ma zastąpić/uzupełnić istniejący pipeline. Pozostałe pozycje bez flag`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: `Per pozycja, bramki z ORYGINALNEJ instrukcji domykanego dyżuru — przeczytaj `INSTRUKCJA_DYZUR_292.md`, `_293.md`, `_295.md`, `_297.md`, `_298.md` w `docs/program/waves/WAVE_03_ACCEPTANCE/codex/` w R0. Dodatkowo nietykalne: `scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh --ci`, `scripts/check-artefakt.sh`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY322_RESZTA_DOMKNIEC_REPORT.md`. Dozwolone nowe/zmieniane pliki dokumentacyjne: raport zbiorczy pod `SCIEZKA_RAPORTU` oraz raporty per domknięta pozycja pod nazwami z ORYGINALNYCH instrukcji, jeśli jeszcze nie istnieją (`CODEX_DAY297_…`, `CODEX_DAY293_…`, `CODEX_DAY292_…`, `CODEX_DAY298_…`, `CODEX_DAY295_…`). Plik postępu `/private/tmp/cx-day322-postep.md` żyje POZA repo, aktualizowany po KAŻDEJ pozycji. Kod: zgodnie z zakresem każdej domykanej pozycji, patrz `B.1`. Nowe pliki w `tests/` i `scripts/` wymagają `git add -f`. **ZAKAZ edycji `MODULE_ACCEPTANCE.md`**. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day322-reszta-domkniec-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day322-reszta-domkniec-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ tworzenia nowych worktree dla pozycji 292/293/297** — reużywasz istniejących, kontynuujesz na TEJ SAMEJ gałęzi od ostatniego commitu. **ZAKAZ odrzucania niecommitowanego WIP w 293 bez przeczytania `git diff` w całości** — może to być poprawna częściowa realizacja R1/R2 instrukcji 293. **ZAKAZ zmiany gałęzi tamtych trzech dyżurów na inną bazę i ZAKAZ `rebase`.** **ZAKAZ używania portów innych niż Twoje własne (6338/5478) nawet wewnątrz cudzych worktree.** **ZAKAZ ruszania kolejności `(b)297 → (c)293 → (d)292 → (f)298 → (e)295`.** **ZAKAZ podłączenia `buildAcceptedDrdReportModel` bez uprzedniego ustalenia relacji z już wpiętym `assessmentReportContractService`** (`§0.3` weryfikacja 6, pozycja R4) | Trzy worktree z częściową pracą już istnieją i ich odtworzenie od zera kosztowałoby więcej niż domknięcie; niecommitowany WIP w 293 to potencjalnie realna praca, której odrzucenie bez przeczytania byłoby dokładnie kształtem „robota niecommitowana w worktree” — odbiór na zacommitowanym stanie meldowałby fałszywie „niewykonane”. Ślepe podłączenie drugiego silnika raportu obok już działającego może zdublować albo skonfliktować generowanie dokumentu, którego właściciel dziś używa |

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
cd /private/tmp/cx-day322-reszta-domkniec

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day322-pg psql -U postgres -d cx322 \
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
cd /private/tmp/cx-day322-reszta-domkniec

docker run -d --name cx-day322-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx322 \
  -p 127.0.0.1:6338:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day322-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6338/cx322 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6338/cx322 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day322-reszta-domkniec && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6338/cx322 \
JWT_SECRET=cx322-test-secret-do-not-reuse \
npx vitest run testy per pozycja z oryginalnej instrukcji (292/293/295/297/298), zawsze `--retry=0`; testy serwera z cwd `server/` i `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres DATABASE_URL=postgres://postgres:cx@127.0.0.1:6338/cx322` (z roota `No test files found` = błąd komendy, nie PASS); dowody mutacyjne obowiązkowe dla: warunku tenantowego `methodSessionReportMetadataService.save()` (298), asercji efektu czwartego przypadku kontraktowego (292), asercji efektu enumeracji kontrolek Idei (295); dowód główny = plik postępu z pięcioma pozycjami i werdyktem każdej --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day322-reszta-domkniec-artefakty/day322-reszta-domkniec.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day322-reszta-domkniec && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run testy per pozycja z oryginalnej instrukcji (292/293/295/297/298), zawsze `--retry=0`; testy serwera z cwd `server/` i `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres DATABASE_URL=postgres://postgres:cx@127.0.0.1:6338/cx322` (z roota `No test files found` = błąd komendy, nie PASS); dowody mutacyjne obowiązkowe dla: warunku tenantowego `methodSessionReportMetadataService.save()` (298), asercji efektu czwartego przypadku kontraktowego (292), asercji efektu enumeracji kontrolek Idei (295); dowód główny = plik postępu z pięcioma pozycjami i werdyktem każdej --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day322-reszta-domkniec-artefakty/day322-reszta-domkniec.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day322-reszta-domkniec/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day322-pg psql -U postgres -d cx322 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day322-pg`.
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
> **(e) ★★★ **OSIEM PUŁAPEK.** (1) Nie twórz nowych worktree dla 292/293/297 — one istnieją; zaczynasz od `git -C <worktree> log --oneline -5` i kontynuujesz na tej samej gałęzi. (2) 293 ma dziś zastany, niecommitowany WIP (4 pliki, ~300 linii) — przeczytaj `git diff` PRZED jakąkolwiek decyzją; jeśli WIP jest poprawną realizacją R1/R2 instrukcji 293, dokończ i commituj; jeśli jest błędny, opisz dlaczego w raporcie i cofnij przez `cp` kopię (nigdy `git checkout --`/`git reset --hard` na cudzej niecommitowanej pracy bez zapisania jej gdzie indziej najpierw). (3) 292 ma zero commitów ponad R1-R2 — to jest fakt, nie oznaka porażki; R1-R2 zostały już scalone gdzie indziej. (4) Czwarty test kontraktowy 292 (`toContain('interviewActionMeta')`) jest grepem po stringu — wzmocnienie do asercji EFEKTU oznacza faktyczne wywołanie akcji z menu/paska i sprawdzenie efektu (np. wywołanej trasy albo otwartego modala), nie tylko obecności identyfikatora w pliku. (5) `buildAcceptedDrdReportModel` i `methodSessionReportMetadataService` mają PO JEDNYM trafieniu `git grep` — to jest ich WŁASNA definicja, nie wywołanie; zero konsumentów. (6) Istniejąca trasa `/sessions/:sessionId/assessment-report.docx` już woła INNY pipeline (`assessmentReportContractService`) — ustal relację (zastępuje/uzupełnia/inna funkcja) przed podłączeniem, inaczej ryzykujesz duplikat generatora. (7) `idea-table.tsx` to LISTA Idei, narzędzie TABELI jest w `idea-table-timeline-stuck.tsx` z `initialTool="table"` — dobór ekranu zmienia mianownik z 21/14 na 86/54 (zmierz swój). (8) Wyścig 409 na trasie `notebook.routes.ts` (`P07_CONCURRENT_EDIT_CONFLICT`) nie ma frontowego wołacza — powtórz dowód na produkcyjnej `my-work.routes.ts` (`NOTEBOOK_PAGE_CONFLICT`). Postęp zapisujesz na dysku w `/private/tmp/cx-day322-postep.md` po KAŻDEJ pozycji, nie w głowie**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day322-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day322-reszta-domkniec-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R0 (przeczytaj PIĘĆ oryginalnych instrukcji 292/293/295/297/298 w całości; historię trzech istniejących worktree; załóż plik postępu z pięcioma pozycjami stanu NIEROZPOCZĘTE) · R1 = (b) 297 w `/private/tmp/cx-day297-martwe-od-korzenia`: napisz `scripts/dev/reachability-from-root.mjs`, wykonaj R1-R6 instrukcji 297 · R2 = (c) 293 w `/private/tmp/cx-day293-biblioteka`: NAJPIERW oceń zastany WIP, potem dokończ instrukcję 293 od właściwego miejsca · R3 = (d) 292 w `/private/tmp/cx-day292-wywiad-menu`: R3-R6 instrukcji 292 + wzmocnienie czwartego testu kontraktowego do asercji efektu · R4 = (f) 298 w nowym worktree: ustal relację z istniejącym pipeline'em raportu, podłącz silnik, napraw warunek tenantowy z transakcją, narrator LLM za flagą OFF · R5 = (e) 295 w tym samym worktree: enumeracja kontrolek z asercją efektu na WŁAŚCIWYM ekranie, wyścig 409 na produkcyjnej trasie, R5 kanon Inicjatyw · R6 (raport zbiorczy)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6338` albo `5478` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6338` albo `5478`** (`Z7`).

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

Cztery odbiory adwersaryjne z nocy 03.09 nazwały z imienia to, co jest zrobione, i to, co tylko
wygląda na zrobione. Dyżur 312 dostał sześć pozycji w kolejce i domknął tylko pozycję (a) —
częściowo, bo zastany WIP wycieków (296) okazał się przekazywać `undefined` zamiast realnego
`req` do mappera. Pozycje (b)-(f) **nie zostały rozpoczęte** — potwierdzone własnym pomiarem
raportu 312 („Pozycje 297, 293, 292, 298 i 295 nie zostały rozpoczęte w tym przebiegu") i moim
niezależnym pomiarem dzisiaj: worktree 297 i 292 mają dokładnie zero i dwa commity odpowiednio
ponad wspólnym przodkiem (zgodne z wcześniejszymi ustaleniami), 293 ma niecommitowany zastany
WIP czterech plików, a worktree dla (e) i (f) w ogóle nie istnieje (worktree 312 zostało po
zakończeniu tamtego dyżuru usunięte).

Dwie z pięciu pozycji — mapper wycieków (poza zakresem tego dyżuru) i silnik raportu Oceny (f) —
mają kształt „biblioteka bez wywołania": poprawny, samodzielnie testowany kod bez ani jednego
konsumenta produkcyjnego. Domknięcie oznacza tu **podłączenie**, nie kolejny test.

## ★ Warunek startu: trzy worktree już istnieją

Nie twórz nowych dla 292, 293 i 297. Katalogi istnieją, mają częściową pracę i własne gałęzie.
Zaczynasz od odczytania ich historii (i, dla 293, od PRZECZYTANIA zastanego niecommitowanego
diffu — nie odrzucasz go bez przeczytania) i kontynuujesz od pierwszej niewykonanej pozycji, na
tej samej gałęzi. Dla pozycji (f) i (e) pracujesz w NOWYM worktree z markera, bo poprzedni
(dyżuru 312) już nie istnieje.

## ★ Zmierz moje liczby sam

Twierdzę: 292 ma dwa commity ponad wspólnym przodkiem (R1+R2 zrobione, R3-R6 nie); 293 ma zero
commitów, ale NIECOMMITOWANY WIP czterech plików; 297 ma czysty worktree bez żadnego postępu;
`buildAcceptedDrdReportModel` i `methodSessionReportMetadataService` mają po jednym trafieniu
`git grep` — własna definicja, zero wołaczy; `idea-table.tsx` to lista, narzędzie tabeli jest
w `idea-table-timeline-stuck.tsx`. **Jeśli Twój pomiar przeczy mojej liczbie, obowiązuje Twój —
zapisz rozbieżność wprost.**

---

## B.1. TABELA LICENCJI PLIKOWYCH

> **★★ ZASTRZEŻENIE.** Powyższa tabela **JEST** licencją. Jeżeli plik, którego potrzebujesz,
> jest opisany jako „PEŁNA/WĄSKA LICENCJA" — **masz pozwolenie i STOP z tytułu »nie wolno mi«
> jest NIEZASADNY**. Jeżeli pliku nie ma w tabeli — domyślnie **TYLKO DO ODCZYTU**, produkt
> zastępczy: czerwony kontrakt + brief.

| Plik / wzorzec | Pozycja | Licencja | Zastępczy produkt |
| --- | --- | --- | --- |
| `scripts/dev/reachability-from-root.mjs` (NOWY) | (b) 297 | **★ PEŁNA LICENCJA** | — |
| `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` (NOWY) | (b) 297 | **★ PEŁNA LICENCJA** | — |
| `tests/unit/canon/reachabilityFromRoot.test.ts` (NOWY) | (b) 297 | **★ PEŁNA LICENCJA**, `Z18`/`Z31` | — |
| `src/**` — WYŁĄCZNIE poddrzewa dowiedzione jako martwe od korzenia w R1 pozycji (b) | (b) 297 | **★ WĄSKA LICENCJA: wyłącznie USUWANIE**, zero nowej logiki. Poza zakresem: `settings/*` (DAY55), `SuperAdmin/*` (dług decyzyjny, nie usuwasz) | Czerwony kontrakt + brief |
| `src/components/assessment/AssessmentHub.tsx`, `src/components/assessment/library/AssessmentLibraryTab.tsx`, `src/components/assessment/library/__tests__/**`, `tests/components/assessment/library/AssessmentLibraryTab.test.tsx`, `src/components/assessment/__tests__/AssessmentLibraryTab.day178.empty-state.test.ts` | (c) 293 | **★ PEŁNA LICENCJA w zakresie Biblioteki metodyk** (patrz `INSTRUKCJA_DYZUR_293.md`) | — |
| `src/components/Interview/**`, `src/components/Interview/__tests__/**` | (d) 292 | **★ PEŁNA LICENCJA w zakresie R3-R6 macierzy akcji** (patrz `INSTRUKCJA_DYZUR_292.md`) | — |
| `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_MENU_AKCJI_WYWIAD_20260903.md` | (d) 292 | **PEŁNA LICENCJA** — uzupełnienie sekcji „Stan PO" | — |
| `server/src/services/report/acceptedDrdReportModel.ts`, `server/src/services/report/methodSessionReportMetadataService.ts` | (f) 298 | **★ PEŁNA LICENCJA** | — |
| `server/src/routes/method-core.routes.ts` | (f) 298 | **★ WĄSKA LICENCJA: WYŁĄCZNIE podłączenie/wywołanie silnika raportu**, w miejscu i sposobem ustalonym w R4 (po zbadaniu relacji z `assessmentReportContractService`). **ZAKAZ** zmiany istniejących tras poza tym jednym punktem | Czerwony kontrakt + brief |
| `server/migrations/2026110[1-9]*.sql`, `server/migrations/202611[1-4]*.sql` | (f) 298 | **★ PEŁNA LICENCJA, wyłącznie addytywnie**, dla ewentualnej kolumny/flagi metryki badania | — |
| `src/components/MyWork/IdeaTableTool.tsx` i trzy siostrzane narzędzia Idei w `src/components/MyWork/**`, `src/components/MyWork/__tests__/**` | (e) 295 | **★ PEŁNA LICENCJA w zakresie enumeracji kontrolek** (patrz `INSTRUKCJA_DYZUR_295.md`) | — |
| `src/components/Initiatives/**` | (e) 295 (R5) | **★ WĄSKA LICENCJA: wyłącznie ujednolicenie do kanonu `standard/`** (6 bloków podglądu, patrz instrukcja 295 R5) | Czerwony kontrakt + brief |
| `server/src/routes/v8/my-work.routes.ts` | (e) 295 | **★ WĄSKA LICENCJA: wyłącznie ciało odpowiedzi `409 NOTEBOOK_PAGE_CONFLICT`** (dodanie pola, nie zmiana kodu statusu ani logiki blokady) | Czerwony kontrakt + brief |
| `tests/unit/backend/security/**`, `**/*.pg.test.ts` (NOWE) | (f), (e) | **★ PEŁNA LICENCJA**, `Z18`/`Z31` | — |
| `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts` | wszystkie | **TYLKO ODCZYT — `Z18`** | Opis w raporcie |
| `scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh`, `scripts/check-artefakt.sh` | wszystkie | **TYLKO ODCZYT** | Musisz przechodzić zielono, nie zmieniać reguł |
| `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` | — | **TYLKO ODCZYT** (`Z14`) | Errata w raporcie |
| `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY322_RESZTA_DOMKNIEC_REPORT.md` | R6 | **JEDYNY nowy raport zbiorczy** (`Z13`) | — |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis w raporcie z plik:linia |

---

## B.2. TABELA POZYCJI

| Pozycja | Nazwa | Rdzeń? | Przekrojowe? | DoD | Definicja ukończenia | Commit |
| --- | --- | --- | --- | --- | --- | --- |
| R0 | Odczyt 5 instrukcji + historia 3 worktree + plik postępu | TAK | NIE | bazowe | Wszystko przeczytane, plik postępu założony | brak (bez zmian) |
| R1 (b)297 | Martwe od korzenia | TAK | NIE — dowód: `Z12` nie wymienia plików `src/**` jako nietykalnych poza wyjątkami | wg instr. 297 | R1-R6 instrukcji 297 wykonane albo uczciwie opisane jako częściowe | per poddrzewo, patrz instr. 297 |
| R2 (c)293 | Biblioteka metodyk | TAK | NIE | wg instr. 293 | Zastany WIP oceniony i albo dokończony, albo cofnięty z uzasadnieniem; reszta instrukcji 293 wykonana | per pozycja instr. 293 |
| R3 (d)292 | R3-R6 menu Wywiadu + wzmocnienie 4. testu | TAK | NIE | wg instr. 292 + 1 wzmocniona asercja | R3-R6 wykonane, czwarty blok kontraktowy asertuje EFEKT, nie string | per pozycja instr. 292 |
| R4 (f)298 | Silnik raportu — relacja + podłączenie + tenant + flaga | TAK | NIE — dowód: `Z12` nie chroni `method-core.routes.ts` całościowo, tylko punktowo | wg instr. 298 + 1 test tenantowy + 1 test fail-safe | Relacja z istniejącym pipeline'em ustalona i opisana; silnik podłączony pod realną akcję; `save()` broni tenanta W ZAPISIE z transakcją; narrator za flagą OFF | per krok, patrz R4 poniżej |
| R5 (e)295 | Enumeracja kontrolek + 409 + Inicjatywy kanon | TAK | NIE | wg instr. 295 | Enumeracja z asercją efektu na właściwym ekranie; wyścig powtórzony na produkcyjnej trasie; Inicjatywy do kanonu | per pozycja instr. 295 |
| R6 | Raport zbiorczy | NIE | NIE | n/d | Struktura `§R.2`, TWIERDZENIA NIEZWERYFIKOWANE niepuste | `docs(day322): raport` |

> Żadna pozycja nie wymaga zmiany pliku jawnie nietykalnego bez wyjątku wymienionego w `B.1`.

---

## B.3. TABELA MIANOWNIKÓW

| # | Co liczę | Liczba autora | Komenda | Obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | Commity 292 ponad wspólnym przodkiem | 2 | `git -C /private/tmp/cx-day292-wywiad-menu log --oneline 58ef0771d7..HEAD \| wc -l` | TAK |
| 2 | Pliki zmienione w niecommitowanym WIP 293 | 4 + 1 nowy katalog | `git -C /private/tmp/cx-day293-biblioteka diff --stat` | TAK |
| 3 | Wołacze `buildAcceptedDrdReportModel` poza testem/definicją | 0 | `git grep -n 'buildAcceptedDrdReportModel' -- server src scripts \| grep -v __tests__` → 1 wiersz (definicja) | TAK |
| 4 | Wołacze `methodSessionReportMetadataService` poza testem/definicją | 0 | analogicznie | TAK |
| 5 | `initialTool="table"` w ekranach idea-table | 1 (w `idea-table-timeline-stuck.tsx`) | `grep -n initialTool dev-render/screens/idea-table*.tsx` | TAK |
| 6 | Sygnatury kontrolek z efektem dowiedzionym (przed R5) | 12 z 226 (liczba odbiorcy — zmierz swój mianownik na właściwym ekranie) | test enumeracji z instr. 295 R2, uruchomiony na `idea-table-timeline-stuck.tsx` | ★ SPRAWDŹ — poprzedni pomiar mógł stać na złym ekranie (21/14 zamiast 86/54) |

---

## B.4. TABELA ROZŁĄCZNOŚCI

### B.4.1. Pliki zapisywane NA PEWNO

| # | Plik/katalog | Pozycja | Ryzyko kolizji |
| --- | --- | --- | --- |
| 1 | `scripts/dev/reachability-from-root.mjs` | R1 | ZEROWE |
| 2 | `src/components/assessment/**` (w zakresie 293) | R2 | ★★ WYSOKIE — zastany WIP, nie Twój; czytaj przed zapisem |
| 3 | `src/components/Interview/**` | R3 | ŚREDNIE — dzielone z 292's własnym torem, ale to Twój worktree teraz |
| 4 | `server/src/services/report/**`, `server/src/routes/method-core.routes.ts` | R4 | NISKIE |
| 5 | `src/components/MyWork/IdeaTableTool.tsx` i siostrzane, `src/components/Initiatives/**` | R5 | NISKIE |
| 6 | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY322_RESZTA_DOMKNIEC_REPORT.md` | R6 | ZEROWE |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Pozycja | Warunek |
| --- | --- | --- |
| `server/migrations/2026110*.sql` (NOWY) | R4 | Tylko jeśli R4 ustali, że metryka badania wymaga nowej kolumny |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

```
public/locales/*/translation.json (poza dopiskami wymuszonymi przez nowe UI) — dyżur 317
scripts/dev/testy-puste-skan.mjs — dyżur 318
src/components/Interview/__tests__/InsightCreatorModal.a11y.test.tsx — dyżur 323
server/src/middleware/appErrorMapper.ts i trasy wycieków — dyżur 296 (poza zakresem)
```

### B.4.4. Zasoby wyłączne

| Zasób | Wartość | Sprawdzone |
| --- | --- | --- |
| Port PostgreSQL | 6338 | `lsof -nP -iTCP:6338 -sTCP:LISTEN` → puste |
| Port harnessu | 5478 | `lsof -nP -iTCP:5478 -sTCP:LISTEN` → puste |
| Kontener | `cx-day322-pg` | `docker ps` → brak |
| Baza | `cx322` | n/d przed startem |
| Gałąź | `codex/day322-reszta-domkniecia-20260904` | nie istnieje |
| Worktree nowy | `/private/tmp/cx-day322-reszta-domkniec` | nie istnieje |
| Worktree reużywane | `cx-day292-wywiad-menu`, `cx-day293-biblioteka`, `cx-day297-martwe-od-korzenia` | istnieją, patrz weryfikacja (1) |
| Flagi | narrator LLM (298), default OFF | `grep -rn` nazwy flagi po jej dodaniu → 0 miejsc z `true` na stałe |

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
WT="$1"   # /private/tmp/cx-day297-martwe-od-korzenia albo -293/-292/-reszta-domkniec, zależnie od pozycji
cd "$WT"
git diff --name-only --cached | tee /private/tmp/cx-day322-reszta-domkniec-artefakty/staged-$(basename "$WT").txt
grep -iE 'public/locales/|testy-puste-skan|InsightCreatorModal.a11y|appErrorMapper' /private/tmp/cx-day322-reszta-domkniec-artefakty/staged-$(basename "$WT").txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## R0 — PIĘĆ INSTRUKCJI I PLIK POSTĘPU

Przeczytaj w całości `INSTRUKCJA_DYZUR_292.md`, `_293.md`, `_295.md`, `_297.md`, `_298.md`.
Odczytaj historię trzech istniejących worktree (komendy weryfikacyjne (1)-(2) w `§0.1`). Załóż
`/private/tmp/cx-day322-postep.md` z pięcioma pozycjami, stan `NIEROZPOCZĘTE`. Aktualizujesz go
**po każdej pozycji**.

Prawo zatrzymania po tej pozycji.

## R1 — (b) 297 MARTWE OD KORZENIA, w `/private/tmp/cx-day297-martwe-od-korzenia`

Wykonaj R1-R6 instrukcji 297 w całości: napisz `scripts/dev/reachability-from-root.mjs`
(narzędzie AST rozumiejące TS/TSX, aliasy `@/`, importy dynamiczne, rejestry po stringu; korzenie
= wejście aplikacji, `dev-render/main.tsx`, testy), porównaj z inwentarzem 238 z poprzedniego
pomiaru per-plik, usuwaj poddrzewa martwe od korzenia (pomijając dług decyzyjny `settings/*`,
`SuperAdmin/*`) jedno poddrzewo = jeden commit, zbuduj cztery tabele („zbudowane niepodłączone",
„test bez produktu", „za flagą", „dług decyzyjny"), postaw bezpiecznik
`tests/unit/canon/reachabilityFromRoot.test.ts` z linią bazową i dowodem na jednym celowo dodanym
martwym pliku.

Prawo zatrzymania po tej pozycji. Zapis w pliku postępu.

## R2 — (c) 293 BIBLIOTEKA METODYK, w `/private/tmp/cx-day293-biblioteka`

**Zanim cokolwiek zrobisz:** `git diff` w całości, żeby przeczytać zastany niecommitowany WIP
czterech plików. Oceń: czy to poprawna realizacja R1/R2 instrukcji 293 (pomiar biblioteki, sesje
poza biblioteką)? Jeśli TAK — dokończ i commituj z opisem, że kontynuujesz zastany WIP. Jeśli
NIE (błędne, niekompletne w sposób szkodliwy) — opisz dlaczego w raporcie, zabezpiecz kopię
przez `cp` do scratcha (nigdy `git checkout --`/`git reset --hard`), i zacznij od właściwego
miejsca instrukcji 293. Dokończ pozostałe pozycje instrukcji 293 od tego punktu.

Prawo zatrzymania po tej pozycji. Zapis w pliku postępu.

## R3 — (d) 292 R3-R6 MENU WYWIADU, w `/private/tmp/cx-day292-wywiad-menu`

Wykonaj R3 (Sesje + Szablony), R4 (Skrzynka + Wnioski + Inicjatywy Wywiadu), R5 (dowód — zrzuty
kebaba i podglądu dla 6 typów, light/dark, pl/en, test kontraktowy, lista czekowania część B),
R6 (raport) instrukcji 292 w całości. Dodatkowo: wzmocnij czwarty blok
`interviewActionMatrix.contract.test.tsx` („is consumed by...") z `toContain('interviewActionMeta')`
na asercję EFEKTU — np. renderuj każdy z pięciu komponentów (host kebaba + 4 podglądy), otwórz
menu/pasek akcji i sprawdź, że akcja z macierzy faktycznie wywołuje odpowiadający handler/trasę,
nie tylko że string `interviewActionMeta` występuje w pliku źródłowym. Dowód mutacyjny: usuń
wywołanie handlera z jednego z pięciu plików, pokaż że nowy test czerwienieje; przywróć, pokaż
zielony.

Prawo zatrzymania po tej pozycji. Zapis w pliku postępu.

## R4 — (f) 298 SILNIK RAPORTU OCENY, w nowym worktree `/private/tmp/cx-day322-reszta-domkniec`

**Krok 1 — ustal relację, nie zakładaj.** Przeczytaj `acceptedDrdReportModel.ts`,
`methodSessionReportMetadataService.ts` i istniejący pipeline w `method-core.routes.ts`
(`assessmentReportContractService.build()` + `buildAssessmentDrdReportSchema()`, trasa
`/sessions/:sessionId/assessment-report.docx`). Odpowiedz pisemnie w raporcie: czy
`acceptedDrdReportModel` ma ZASTĄPIĆ istniejący pipeline, UZUPEŁNIĆ go (np. dodatkowa sekcja
metadanych: zespół doradczy, kalendarz, rekomendacje z `methodSessionReportMetadataService`), czy
to inna funkcja produktowa (np. inny format dokumentu, inny odbiorca). Jeśli po przeczytaniu
kodu wniosek jest inny niż zakładała instrukcja 298 — to jest MERYTORYCZNY wynik, zapisz go
i zaprojektuj podłączenie zgodnie z tym, co znajdziesz.

**Krok 2 — podłącz** zgodnie z ustaloną relacją, tak żeby istniała **realna ścieżka HTTP → silnik
→ odpowiedź**, nie tylko import bez wywołania.

**Krok 3 — warunek tenantowy z transakcją.** `methodSessionReportMetadataService.save()` dziś
sprawdza tenanta dopiero przez `get()` PO `INSERT`, bez transakcji — dowód mutacyjny: usuń warunek
organizacji, pokaż że obcy NADPISUJE wiersz mimo że `save()` i tak zgłasza odmowę (bezpiecznik
nagradza defekt). Naprawa: warunek tenantowy w SAMYM zapisie (`WHERE organization_id = $n` w
`UPDATE`/`INSERT ... ON CONFLICT`), transakcja, test negatywny „właściciel zapisuje / obcy nie
nadpisuje" z dowodem mutacyjnym w obie strony.

**Krok 4 — narrator LLM za flagą.** Nowa flaga, domyślnie OFF (także przy braku zmiennej
środowiskowej), test fail-safe: błąd modelu → raport i tak powstaje, bez sekcji narracyjnej.

Prawo zatrzymania po tej pozycji. Zapis w pliku postępu.

## R5 — (e) 295 DOWODY MOJEJ PRACY, w tym samym worktree

Wykonaj R1-R6 instrukcji 295 w całości, z dwiema korektami wymuszonymi pomiarem: (1) mianownik
enumeracji kontrolek liczysz na WŁAŚCIWYM ekranie narzędzia tabeli
(`dev-render/screens/idea-table-timeline-stuck.tsx`, `initialTool="table"`), nie na liście Idei —
jeśli to zmienia mianownik z 21/14 na rzędu 86/54, zapisz to wprost i dokończ enumerację na
poprawnym ekranie; (2) dowód wyścigu 409 powtarzasz na produkcyjnej trasie
`server/src/routes/v8/my-work.routes.ts` (kod `NOTEBOOK_PAGE_CONFLICT`), nie na
`notebook.routes.ts` (`P07_CONCURRENT_EDIT_CONFLICT`), bo ta druga nie ma frontowego wołacza
i dowód na niej nie mówi nic o produkcie.

Prawo zatrzymania po tej pozycji. Zapis w pliku postępu.

## R6 — RAPORT ZBIORCZY

Stan każdej z pięciu pozycji (domknięta/częściowa/nierozpoczęta, z powodem), stan pliku postępu,
finalna zawartość czterech tabel z (b), decyzja o relacji dwóch pipeline'ów raportu z (f),
poprawiony mianownik enumeracji z (e), TWIERDZENIA NIEZWERYFIKOWANE.

## Prawo zatrzymania

Obowiązuje po każdej pozycji z osobna. „297 i 293 domknięte, 292 rozpoczęte, 298 i 295
nietknięte, plik postępu aktualny" jest pełnowartościowym wynikiem. Zamknięcie w rejestrze
pozycji, której nie domknąłeś w całości, nie jest — rejestr, który kłamie, kosztuje więcej niż
praca, której nie zrobiono.
