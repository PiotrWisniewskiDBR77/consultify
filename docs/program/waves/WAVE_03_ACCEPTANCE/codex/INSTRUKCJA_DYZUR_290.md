# INSTRUKCJA DYŻURU nr 290 — Codex — „★★★ Szesnaście bramek `G19` stoi na `NOT_STARTED`, a dług w kodzie jest już domknięty — brakuje DOWODU: inwentarz nadzorcy policzył, że macierz G06 na markerze `fee24bddb0` (pomiar #3, PASS 16/16) pokrywa 22 z 23 zmienionych komponentów współdzielonych, że 8 z 23 ma jakikolwiek test, a 15 nie ma żadnego, że jedyny niepokryty komponent `AIConsultantPanel` jest osiągalny tylko z ekranu `teresa-chipy-panel-artefaktu`, którego nie ma w `g06-macierz-ekrany.json`, że 3 zmienione middleware (`auth`, `mfaEnrollmentToken` — bez testu, `requireAudit`) i 12 tras nie są objęte żadnym pomiarem wizualnym, i że trasy zapisu z 03.09 (`day274/275/276/277`, `ai.routes`, `v8/chat`, `v8/teresa`) dowodzą się tylko na realnym PostgreSQL — ten dyżur wykonuje trzy bloki komend z inwentarza na zamrożonym markerze, dokłada ekran do macierzy i mierzy go kanonicznym narzędziem, pisze test dla `mfaEnrollmentToken.middleware.ts` i `initiativesExecutionRuntime.routes.ts`, robi przelot HTTP po 12 zmienionych trasach na własnym kontenerze, i oddaje tabelę 16 wierszy z gotowym zdaniem do `G19` w wariancie 1 z inwentarza (`TECHNICAL_REGRESSION_PASS / OWNER_RETEST_PENDING`). ★ NIE naprawiasz produktu poza testami i harnessem: czerwony test = znalezisko z klasą ZASTANA/NOWA (para baza/marker), nie samowolna naprawa."

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
> **wyłącznie** `/private/tmp/cx-day290-g19-regresja`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `67d235cfa0`**
> **Gałąź bazowa: `github-backup/grafika/m03-20260902`**
> **Stan dokumentu: WYDANY**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo jakiekolwiek niewypelnione pole szablonu — **dokument nie
> jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.
> Ta ramka jest **jedynym** miejscem, w którym rozstrzyga się stan wydania.
> Objaśnienia w innych blokach cytowanych **nie** są powodem do STOP-u.

Data wystawienia: 2026-09-03.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.
Zakres: ****PRZEKROJOWE — bramka `G19` „Later-change regression obligations resolved” dla WSZYSTKICH 16 modułów, JEDNYM przebiegiem.** Inwentarz nadzorcy z 03.09 (`docs/program/waves/WAVE_03_ACCEPTANCE/G19_INWENTARZ_OBOWIAZKOW_20260903.md` — PRZECZYTAJ W CAŁOŚCI w `W1`, to jest Twoja mapa) wykazał, że 16 odbiorów stoi na SHA z jednego okna 5 h dnia 02.09, więc zbiór zmienionych plików współdzielonych jest wspólny (28–49 plików per moduł, trzy zbiory zagnieżdżone) i obowiązek regresji jest JEDEN, nie szesnaście. Dyżur dowodowy: uruchomić wskazane bloki testów na zamrożonym markerze, dołożyć brakujące dowody dla czterech dziur (serwer, `AIConsultantPanel`, trasy zapisu na realnym Postgresie, `initiativesExecutionRuntime.routes.ts`), i oddać nadzorcy GOTOWE zdania do 16 wierszy `G19`.**.
Trasy front: `23 komponenty współdzielone z tabeli R2/R3 inwentarza (`src/components/standard/**`, `shared/**`, `ui/**`, `ExecutiveModuleShell/*`, `NModeLayout/*`) — mianownik ustalasz SAM: `git diff --name-only 316bce9dd9 67d235cfa0 -- src/components/standard src/components/shared src/components/ui | wc -l` (inwentarz mówi 49 dla bazy `316bce9dd9`; zmierz). Ekran do dołożenia: `teresa-chipy-panel-artefaktu` (`dev-render/screens/`; sprawdź nazwę w `dev-render/main.tsx`) → wiersz w `scripts/dev/g06-macierz-ekrany.json` w module, którego jest ekranem (ustal po wołaczu `AIConsultantPanel` w `src/`).`. Trasy tył: ``server/src/middleware/auth.middleware.ts`, `mfaEnrollmentToken.middleware.ts` (BEZ testu), `requireAudit.middleware.ts`; 12 tras z tabeli R2 inwentarza (wypisz je SAM z `git diff --name-only 316bce9dd9 67d235cfa0 -- server/src/routes`); `server/src/routes/initiativesExecutionRuntime.routes.ts` (zmiana `bb5465b296`, zero testów); trasy zapisu: `server/src/routes/__tests__/day274-ocena-dociera-do-listy.pg.test.ts`, `day275-method-outputs-kontrakt.pg.test.ts`, `day276-deck-autosave-persist.pg.test.ts`, `day276-workbook-cell-persist.pg.test.ts`, `day277-decyzje-zapis.pg.test.ts`, `ai.agentHubRateLimitRouting.test.ts`.`.

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
WT=/private/tmp/cx-day290-g19-regresja
MARKER=67d235cfa0

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/grafika/m03-20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day290-g19-regresja-wspoldzielona-20260903 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day290-g19-regresja/config.worktree"
cat "$VAULT/worktrees/cx-day290-g19-regresja/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day290-g19-regresja-scratch
mkdir -p /private/tmp/cx-day290-g19-regresja-artefakty

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
git -C "$VAULT" log --oneline 67d235cfa0..github-backup/grafika/m03-20260902
git -C "$VAULT" diff --name-only 67d235cfa0..github-backup/grafika/m03-20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day290-g19-regresja-wspoldzielona-20260903
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 67d235cfa0..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `6` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA: 16 wierszy G19 = NOT_STARTED; G06 = PASS 16/16 na markerze fee24bddb0 (pomiar #3)
grep -hE '^\|\s*G19\b' docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md | grep -c NOT_STARTED
grep -hE '^\|\s*G06\b' docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md | grep -c 'fee24bddb0'
#   oczekiwane: 16 i 16

# (2) TEZA: mianownik plikow wspoldzielonych od bazy 316bce9dd9 (inwentarz: 49 dla 01/08)
git diff --name-only 316bce9dd9 67d235cfa0 -- src/components/standard src/components/shared src/components/ui | wc -l
git diff --name-only 316bce9dd9 67d235cfa0 -- server/src/middleware server/src/routes | wc -l
#   oczekiwane: rzedu 20-50 i rzedu 15 — zapisz DOKLADNE liczby; to Twoj mianownik

# (3) TEZA: mfaEnrollmentToken.middleware.ts nie ma testu; initiativesExecutionRuntime.routes.ts nie ma testu
git grep -ln 'mfaEnrollmentToken' -- tests server/src/**/__tests__ | wc -l
git grep -ln 'initiativesExecutionRuntime' -- tests server/src/**/__tests__ | wc -l
#   oczekiwane: 0 i 0

# (4) TEZA: ekranu teresa-chipy-panel-artefaktu nie ma w macierzy, a AIConsultantPanel ma 0 ekranow
grep -c 'teresa-chipy-panel-artefaktu' scripts/dev/g06-macierz-ekrany.json
git grep -ln 'teresa-chipy-panel-artefaktu' -- dev-render | head -3
#   oczekiwane: 0 w macierzy; ekran istnieje w dev-render

# (5) TEZA: 18 + 6 + 6 plikow testow z inwentarza istnieje
sed -n '200,240p' docs/program/waves/WAVE_03_ACCEPTANCE/G19_INWENTARZ_OBOWIAZKOW_20260903.md | grep -oE '[a-zA-Z0-9_./-]+\.test\.[a-z]+' | while read f; do [ -f "$f" ] || echo "BRAK $f"; done
#   oczekiwane: zero linii BRAK; kazdy BRAK zapisz jako rozbieznosc

# (6) TEZA: porty i dysk wolne
lsof -nP -iTCP:5258 -sTCP:LISTEN; lsof -nP -iTCP:5259 -sTCP:LISTEN; lsof -nP -iTCP:6294 -sTCP:LISTEN; docker ps --format '{{.Names}}' | grep -c cx-day290 || true
df -h /
#   oczekiwane: puste lsof, 0 kontenerow, powyzej 3 GB wolnego
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day290-g19-regresja-wspoldzielona-20260903` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6294`. Twój JEDYNY port harnessu to `5258 i 5259`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day290-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta listy restricted ports Chromium. Zajęte przez inne prace (nie ruszasz): 3020, 3022, 3025, 3027, 3030 (tor grafiki nadzorcy), 5322, 5410-5415 (agenci nadzorcy), 5432 i 5433 (Postgres hosta), 6012, 6379 (redis), 7000, 7679, 7768, 11434. Cudze — dyżury 286 (baza 6290, harness 5250 i 5251), 287 (6291, 5252 i 5253), 288 (6292, 5254 i 5255), 289 (6293, 5256 i 5257), 291 (6295, 5260 i 5261) — nie dotykasz ich portów ani kontenerów. Twoje własne: baza 6294, harness 5258 i 5259. Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps. ★ ZAKAZ `pkill`/`killall` na `node`, `vite`, `playwright`, `grafika-zrzuty` — na tej maszynie biegną pomiary nadzorcy; zabijasz wyłącznie własne PID-y (zapisz `$!`).`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `ŻADNEJ flagi runtime. Jeśli któryś test bloku 1 jest czerwony z powodu flagi domyślnie OFF (Wyniki `resultsVNextFeatureFlags.ts`, Finanse `useFinance*Flag.ts`) — klasa ZA FLAGĄ, bez naprawy, wpis z nazwą flagi.`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``tests/unit/initiatives/initiativeRecordCanon.test.ts` (6 zielonych — uruchom na starcie i na końcu; czerwony = STOP, ktoś przywrócił skasowany komponent) · `scripts/check-list-canon.sh` · `scripts/check-focus-canon.sh --ci` · `scripts/dev/g06-macierz-uruchom.mjs` (czyta `g06-macierz-ekrany.json` — po Twojej edycji `node -e "JSON.parse(require('fs').readFileSync('scripts/dev/g06-macierz-ekrany.json','utf8'))"`) · `docs/program/waves/WAVE_03_ACCEPTANCE/G19_INWENTARZ_OBOWIAZKOW_20260903.md` (mapa dyżuru)`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY290_G19_REGRESJA_WSPOLDZIELONA_REPORT.md`. Dozwolone nowe pliki dokumentacyjne: raport pod `SCIEZKA_RAPORTU` oraz katalog `evidence/g19/` (logi vitest jako `.log`, `wynik.json` z R5, tabela przelotu HTTP jako `.md`/`.json`; `git add -f`, bo `evidence/.gitignore` blokuje `*.json`/`*.txt` — sprawdź zawartość pod kątem sekretów przed dodaniem). **ZAKAZ edycji `MODULE_ACCEPTANCE.md`** — wpisy robi nadzorca.. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day290-g19-regresja-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day290-g19-regresja-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ naprawiania produktu** (`src/` poza `dev-render/` i `scripts/dev/g06-macierz-ekrany.json`; `server/src` poza nowymi plikami testów) — czerwony test to znalezisko do raportu z klasą i parą baza/marker, nie samowolna naprawa; wyjątek: jednoznaczny błąd w SAMYM TEŚCIE (np. asercja na etykietę zmienioną decyzją właściciela z numerem DEC) — poprawka asercji z cytatem decyzji. **ZAKAZ `git stash`** (stos współdzielony) — użyj commitu WIP. **ZAKAZ edycji `MODULE_ACCEPTANCE.md`** — zdania do `G19` oddajesz w raporcie, nadzorca wkleja. **ZAKAZ pełnego `tests/unit`** (~17 000 testów). **ZAKAZ dotykania środowisk demo/staging/produkcji.** **ZAKAZ `--no-verify`.** | Definicja G19 w programie jest nieostra (inwentarz, znalezisko G19-Z1: cztery zdania w trzech plikach, żadnej listy powierzchni współdzielonych). Nadzorca przyjął definicję operacyjną z inwentarza (R1): G19 zamknięte, gdy dla każdego zmienionego pliku współdzielonego istnieje dowód na zamrożonym markerze — osobno wizualny (macierz G06) i osobno serwerowy (testy/przelot HTTP) — a plik bez żadnego z nich jest wypisany z nazwy jako otwarty dług. Bez tego dowodu 16 bramek stoi, a `G20` (finalny replay) ma w bramce wejściowej „All shared-component regression obligations are closed”. Program zna kształt „naprawa per-wywołanie odrasta” i „dowód poza repo wyparowuje” — dlatego dowód ma być w repo (logi vitest jako pliki w `evidence/`), nie w `/private/tmp`. |

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
cd /private/tmp/cx-day290-g19-regresja

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day290-pg psql -U postgres -d cx290 \
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
cd /private/tmp/cx-day290-g19-regresja

docker run -d --name cx-day290-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx290 \
  -p 127.0.0.1:6294:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day290-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6294/cx290 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6294/cx290 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day290-g19-regresja && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6294/cx290 \
JWT_SECRET=cx290-test-secret-do-not-reuse \
npx vitest run blok 1: 18 plików z inwentarza (cwd root); blok 2: 6 plików `tests/unit/backend/middleware/*`, `tests/unit/auth/*` (cwd root); blok 3: 6 plików `server/src/routes/__tests__/*.pg.test.ts` (cwd `server/`, `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres DATABASE_URL=postgres://…:6294/cx290`); nowe: `tests/unit/backend/middleware/mfaEnrollmentToken.middleware.test.ts`, `server/src/routes/__tests__/initiativesExecutionRuntime.dropdown.pg.test.ts`; dowód główny = logi w `evidence/g19/` + tabela 16 wierszy --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day290-g19-regresja-artefakty/day290-g19-regresja.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day290-g19-regresja && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run blok 1: 18 plików z inwentarza (cwd root); blok 2: 6 plików `tests/unit/backend/middleware/*`, `tests/unit/auth/*` (cwd root); blok 3: 6 plików `server/src/routes/__tests__/*.pg.test.ts` (cwd `server/`, `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres DATABASE_URL=postgres://…:6294/cx290`); nowe: `tests/unit/backend/middleware/mfaEnrollmentToken.middleware.test.ts`, `server/src/routes/__tests__/initiativesExecutionRuntime.dropdown.pg.test.ts`; dowód główny = logi w `evidence/g19/` + tabela 16 wierszy --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day290-g19-regresja-artefakty/day290-g19-regresja.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day290-g19-regresja/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day290-pg psql -U postgres -d cx290 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day290-pg`.
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
> **(e) ★★★ SZEŚĆ PUŁAPEK. (1) `npx vitest run --config server/vitest.config.ts` z roota daje `No test files found` — z cwd `server/` i ścieżką `src/...`; **`No test files found` to NIE jest PASS**, każdy przebieg z zerem plików zapisujesz jako BŁĄD KOMENDY. (2) `NODE_ENV=test` BEZ `RUN_DB_TESTS=1` podstawia atrapę bazy; `Database.ts:686` zwraca `changes:1` dla każdego `UPDATE` — blok 3 tylko z `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres DATABASE_URL=<Twój kontener 6294>` po pełnym łańcuchu migracji od zera (strict, bez `--safe`). (3) `tests/setup.ts:858-896` podmienia `global.fetch` na atrapę `ok:true` — test, który „przechodzi” przez sieć, niczego nie dowodzi; przy pisaniu nowych testów asertuj treść odpowiedzi/stan bazy, nie `ok`. (4) Klasyfikacja czerwieni ZASTANA/NOWA wymaga PARY: ten sam plik testu na bazie `316bce9dd9` (worktree `/private/tmp/cx-day290-baza`, symlink `node_modules`) i na markerze; bez pary nie wolno napisać „zastane”. Dziewięć czerwieni zastanych znanych nadzorcy (dyżur 286 je rozlicza): `chatActionHandler.createInitiative` (3), `executionWorkResources` (6) — jeśli trafisz na nie w bloku 1, zapisujesz, nie naprawiasz. (5) Kanoniczne narzędzie zrzutów `scripts/dev/grafika-zrzuty.mjs` uruchamiasz z flagami pomiaru #3: `--rozwin-sekcje=1 --klik-po-rozwinieciu=1 --osiad-po-rozwinieciu=1500 --a11y=1 --motywy=light,dark` dla `--jezyk=pl` i `en`, `--szerokosc=1440` i `1024` (8 kadrów); bez `--klik-po-rozwinieciu` skan leci bez podglądu (ślepa plama zmierzona 03.09). (6) Dodając ekran do `g06-macierz-ekrany.json` zachowaj KSZTAŁT wpisów (obejrzyj sąsiednie; niektóre moduły mają grupy z parametrami) — plik czyta `g06-macierz-uruchom.mjs`; JSON z polskim cudzysłowem ASCII psuł już ten mechanizm (A12 w rejestrze znalezisk) — zamykaj `”`.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day290-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day290-g19-regresja-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (pomiar mianownika: lista plików współdzielonych zmienionych `316bce9dd9..67d235cfa0` w `src/components/{standard,shared,ui}`, `server/src/middleware`, `server/src/routes` — liczby vs inwentarz; worktree bazowy `/private/tmp/cx-day290-baza` na `316bce9dd9`) · R2 (blok 1 — 18 plików testów podglądu/tabeli — na bazie i na markerze; log do `evidence/g19/blok1-<baza|marker>.log`; klasyfikacja czerwieni) · R3 (blok 2 — 6 plików middleware — jak R2; PLUS nowy test `tests/unit/backend/middleware/mfaEnrollmentToken.middleware.test.ts`: co middleware przepuszcza, co odrzuca, para „token właściwy → next()” / „token obcy/wygasły → 401/403”) · R4 (blok 3 — 6 testów tras zapisu na własnym kontenerze 6294 z `RUN_DB_TESTS=1`; PLUS nowy `server/src/routes/__tests__/initiativesExecutionRuntime.dropdown.pg.test.ts`: dropdown „Wybierz realizację” zwraca nazwę inicjatywy, nie surowe `executionCaseId` — zmiana `bb5465b296`; PLUS przelot HTTP po 12 zmienionych trasach na serwerze 5258: metoda · ścieżka · kod dla zalogowanego OWNER · kod dla obcej organizacji — tabela) · R5 (`AIConsultantPanel`: dołożenie `teresa-chipy-panel-artefaktu` do `g06-macierz-ekrany.json`, 8 kadrów kanonicznym narzędziem na własnym vite 5259, `wynik.json` do `evidence/g19/aiconsultantpanel/`; zero realnych naruszeń albo lista) · R6 (raport: tabela 16 wierszy moduł · SHA odbioru z `G18` · mianownik · dowód wizualny (marker `fee24bddb0`, pomiar #3) · dowód testowy (bloki 1–3, zielone/czerwone z klasą) · dowód serwerowy (przelot HTTP) · otwarte pliki z nazwy · GOTOWE ZDANIE do wiersza `G19` wg wariantu 1 z inwentarza R4)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6294` albo `5258 i 5259` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6294` albo `5258 i 5259`** (`Z7`).

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

Szesnaście wierszy `G19` stoi na `NOT_STARTED`. Inwentarz nadzorcy z 03.09 pokazał, że wszystkie
16 odbiorów stoi na SHA z jednego okna pięciu godzin 02.09, więc zbiór zmienionych plików
współdzielonych jest wspólny i obowiązek regresji jest jeden. Macierz G06 (pomiar #3, PASS 16/16)
pokrywa 22 z 23 zmienionych komponentów UI. Brakuje dowodu dla serwera (3 middleware, 12 tras),
dla `AIConsultantPanel` (ekran poza macierzą), dla tras zapisu (tylko realny Postgres) i dla
`initiativesExecutionRuntime.routes.ts` (zero testów). Ten dyżur dostarcza te dowody do repo
i oddaje gotowe zdania do 16 wierszy.

## ★ Zmierz moje liczby sam

Twierdzę (za inwentarzem): 28–49 plików współdzielonych per moduł od SHA odbioru; 23 komponenty UI,
8 z testem, 15 bez; 3 middleware i 12 tras; `mfaEnrollmentToken.middleware.ts` bez testu;
`teresa-chipy-panel-artefaktu` poza `g06-macierz-ekrany.json`. Komendy z §0.3 to sprawdzają.
**Jeśli Twój pomiar przeczy mojej liczbie, obowiązuje Twój.** Rozbieżność zapisujesz w raporcie
jako pierwsze znalezisko.

## R1 — MIANOWNIK I WORKTREE BAZOWY (rdzeń)

Lista plików współdzielonych zmienionych `316bce9dd9..67d235cfa0` (front i serwer) do
`evidence/g19/mianownik.md` z liczbami. Worktree bazowy `/private/tmp/cx-day290-baza` na
`316bce9dd9` z dowiązanym `node_modules` — do par ZASTANA/NOWA.
`tests/unit/initiatives/initiativeRecordCanon.test.ts` → 6 zielonych (inaczej STOP).

Commit po `R1`.

## R2 — BLOK 1: PODGLĄD I TABELA (rdzeń)

18 plików z inwentarza (linie 200–222), na bazie i na markerze. Logi do `evidence/g19/`.
Każda czerwień: plik · test · klasa (ZASTANA = czerwona też na bazie / NOWA = zielona na bazie,
czerwona na markerze / ZA FLAGĄ / PUSTA wg pułapki (3)) · powód. NOWA = znalezisko do raportu
z nazwą pliku produktu, który ją spowodował (`git log --oneline 316bce9dd9..67d235cfa0 -- <plik>`),
bez naprawy produktu.

Commit po `R2`.

## R3 — BLOK 2: MIDDLEWARE + NOWY TEST (rdzeń)

6 plików middleware jak w R2. Nowy `tests/unit/backend/middleware/mfaEnrollmentToken.middleware.test.ts`:
przeczytaj middleware i napisz parę dowodów na to, co ROBI (token właściwy → `next()`; token obcy,
wygasły, brakujący → kod odmowy z ciała middleware), plus jeden test negatywny na zabezpieczenie
(usunięcie sprawdzenia → test czerwony; pokaż wyjście, przywróć).

Commit po `R3`.

## R4 — BLOK 3: TRASY ZAPISU NA REALNYM POSTGRESIE + PRZELOT HTTP (rdzeń)

Kontener `pgvector/pgvector:pg16` na 6294, baza `cx290`, pełny łańcuch migracji od zera. Sześć
testów `.pg.test.ts` z cwd `server/` i `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres`. Nowy
`initiativesExecutionRuntime.dropdown.pg.test.ts`: odpowiedź trasy niesie nazwę inicjatywy,
nie surowe `executionCaseId` (zmiana `bb5465b296`). Serwer na 5258 na Twoim kontenerze; dwóch
użytkowników w dwóch organizacjach; dla każdej z 12 zmienionych tras: metoda · ścieżka · kod OWNER
własnej org · kod użytkownika obcej org (oczekiwane 403/404, nigdy 200 z cudzymi danymi).
Tabela do `evidence/g19/przelot-http.md`. Kontener usuwasz po pomiarze razem z wolumenem.

Commit po `R4`.

## R5 — `AIConsultantPanel`: EKRAN DO MACIERZY (rdzeń)

Dołóż `teresa-chipy-panel-artefaktu` do `scripts/dev/g06-macierz-ekrany.json` w module wołacza
(kształt wpisu jak sąsiednie). Własny vite na 5259 z markera. Osiem kadrów kanonicznym narzędziem
z flagami pomiaru #3 (pułapka (5)). `wynik.json` do `evidence/g19/aiconsultantpanel/`.
Zero realnych naruszeń (po odjęciu trzech reguł hosta: `landmark-one-main`, `page-has-heading-one`,
`region`) albo lista z regułą i węzłem — bez naprawy produktu.

Commit po `R5`.

## R6 — RAPORT Z GOTOWĄ TREŚCIĄ `G19` PER MODUŁ

Tabela 16 wierszy: moduł · SHA odbioru (wiersz `G18`) · mianownik · dowód wizualny (`fee24bddb0`,
pomiar #3) · blok 1/2/3 (zielone/czerwone z klasą) · przelot HTTP · otwarte pliki z nazwy ·
GOTOWE ZDANIE do wiersza `G19` w wariancie 1 z inwentarza (R4 inwentarza, linie 295–305), z
podstawionymi liczbami. Plus sekcja TWIERDZENIA NIEZWERYFIKOWANE i lista testów PUSTYCH.

## Prawo zatrzymania

„Bloki 1–2 wykonane na parze, blok 3 i przelot niewykonane z powodu X” jest pełnowartościowym
wynikiem. Wynik z czerwienią bez pary baza/marker nie jest wart nic. Wynik „zielone” bez logów
w `evidence/g19/` nie jest wart nic — dowód poza repo wyparowuje.
