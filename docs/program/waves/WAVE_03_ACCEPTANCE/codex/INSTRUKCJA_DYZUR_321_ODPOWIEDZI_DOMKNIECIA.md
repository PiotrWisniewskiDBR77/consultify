# INSTRUKCJA DYŻURU nr 321 — Codex — „★★★ DOMKNIĘCIA PO DYŻURZE 313 — BEZPIECZEŃSTWO ODPOWIEDZI: odbiór adwersaryjny 04.09 POTWIERDZIŁ pracę 313 (35 wycieków surowej treści błędu zeszło do zera, trzy mutacje powtórzone RED→GREEN, `esbuild` 55/55, testy 13/13, codemod mappera w repo) i znalazł pięć rzeczy, których wykonawca nie zgłosił: ★ **efekt produktowy jest ODWROTNY do zakładanego** — mapper wybiera komunikat wyrażeniem `operational ? raw : MESSAGES[language][mappedCode]`, więc polski słownik działa WYŁĄCZNIE dla błędów NIE-operacyjnych, a naprawa dziedziczenia `AppError` sprawia, że naprawione klasy przepuszczają surowy komunikat, który w kodzie jest PO ANGIELSKU — wynik: polskie generyki i angielskie komunikaty biznesowe (to jest pozycja `R1` tego dyżuru: rozstrzygnąć, czy komunikaty biznesowe mają iść przez słownik, i wykonać); **guard jest ŚLEPY NA NAZWĘ ZMIENNEJ wyjątku** — mutacja z `dbFailure` przechodzi na zielono, bo ratchet 0 chroni tylko `err`/`error`/`e`; **`req` dotarł do 188 wywołań, ale 112 helperów nie ma `req` w zasięgu**, więc `Accept-Language` tam nie działa i polskie komunikaty i tak się nie uruchomią; **walidacja UUID w `router.use()` może WYGASIĆ CAŁY MODUŁ kont serwisowych**, bo `organizations.id` jest typu `TEXT` — wymagana jest para dowodów „obcy nie widzi” ORAZ „właściciel widzi” na realnym łańcuchu; **44 wycieki `ALTERNATE_LEAK_BASELINE` i 251 klas `*Error` bez `AppError` wciąż pod ratchetem**."

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
> **wyłącznie** `/private/tmp/cx-day321-odpowiedzi-domkniecia`.

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
Zakres: ****PRZEKROJOWE — SERWER: co zostało po dyżurze 313 w rodzinie „bezpieczeństwo odpowiedzi HTTP”.** Dyżur 313 jest scalony na linii `grafika/m03-20260902`; jego wynik potwierdza odbiór `docs/program/waves/WAVE_03_ACCEPTANCE/codex/ODBIOR_DYZUROW_307_311_312_20260904.md` i stan bezpiecznika `tests/unit/backend/security/noRawErrorMessage.test.ts` (`REMAINING_LEAK_BASELINE = 0`, `ALTERNATE_LEAK_BASELINE = 44`). Pięć zadań tego dyżuru pochodzi z odbioru: **(1)** efekt produktowy mappera — `server/src/middleware/appErrorMapper.ts:96` przepuszcza surowy komunikat dla błędów operacyjnych, więc polski słownik `MESSAGES.pl` obsługuje wyłącznie generyki, a komunikaty biznesowe idą po angielsku; **(2)** guard rozpoznaje wyłącznie zmienne o nazwie `err`, `error`, `e` — mutacja z inną nazwą przechodzi; **(3)** 112 helperów bez `req` w zasięgu (`, undefined,` spadło z 288 na 115, `req` przekazany w 188 wywołaniach); **(4)** `server/src/routes/admin/service-accounts.routes.ts` odrzuca 400 przy identyfikatorze spoza formatu UUID, a `organizations.id` jest `TEXT` w `server/migrations/000_z_core_baseline.sql` — ryzyko wygaszenia całego modułu dla wszystkich; **(5)** dług 44 + 251 pod ratchetem.**.
Trasy front: `**Brak zmian w `src/`.** Mierzysz wyłącznie, co front robi z polem komunikatu błędu — punkt wyjścia: `src/utils/apiError.ts` (normalizacja `details` i `error`, funkcja `flattenValidationDetails`). Od tego zależy kształt naprawy `R1`: czy komunikat ma być tłumaczony po stronie serwera, czy przez klucz tłumaczenia. ★ Pomiar tego łatwo sfałszować: `git grep -nE "\.details\b" -- src` oddaje pustkę, a `git grep -nE "\.details" -- src` daje kilkadziesiąt trafień — `\b` w `git grep -E` nie działa.`. Trasy tył: ``server/src/middleware/appErrorMapper.ts` (113 linii; linia 93 czyta `Accept-Language` z `req`, linia 94 ustala `operational`, linia 96 wybiera `operational ? raw : MESSAGES[language][mappedCode]` — to jest sedno `R1`) · `server/src/utils/ErrorHandler.ts` (klasa `AppError`: `statusCode`, `code`, `details`, `status`, `isOperational = true`) · `server/src/middleware/__tests__/appErrorMapper.test.ts` · `tests/unit/backend/security/noRawErrorMessage.test.ts` (wzorce `day296Pattern`, `fullFamilyPattern` i `alternateLeakPatterns` — WSZYSTKIE związane wyłącznie z `err|error|e`; `REMAINING_LEAK_BASELINE = 0`, `ALTERNATE_LEAK_BASELINE = 44`) · `server/src/routes/admin/service-accounts.routes.ts` (łańcuch `router.use(verifyToken)` → strażnik granicy organizacji → `validateUUID(organizationId)` i `validateUUID(userId)` z kodem 400 → sprawdzenie członkostwa w `organization_members` → `verifyAdmin` → `requireAudit`) · `server/src/utils/validation.ts` (`validateUUID` — plik przekrojowy, tylko odczyt) · `server/migrations/000_z_core_baseline.sql` (`organizations.id TEXT PRIMARY KEY`) · `server/src/routes/**` i `server/src/controllers/**` (rodzina `req` do mappera) · `scripts/dev/codemod-error-mapper*.mjs` (codemod nr 1 — wzorzec dla nowego) · `server/src/routes/__tests__/service-accounts.routes.test.ts` i `server/src/routes/__tests__/day22.highRiskAdminAudit.pg.test.ts` (istniejące kontrakty tego modułu).`.

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
WT=/private/tmp/cx-day321-odpowiedzi-domkniecia
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
git -C "$VAULT" worktree add "$WT" -b codex/day321-odpowiedzi-domkniecia-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day321-odpowiedzi-domkniecia/config.worktree"
cat "$VAULT/worktrees/cx-day321-odpowiedzi-domkniecia/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day321-odpowiedzi-domkniecia-scratch
mkdir -p /private/tmp/cx-day321-odpowiedzi-domkniecia-artefakty

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
git -C "$WT" push github-backup codex/day321-odpowiedzi-domkniecia-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only bc18bc7acac2ec825ebb3db2f1309738ab034d58..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `7` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA: mapper przepuszcza SUROWY komunikat dla bledow operacyjnych — slownik dziala tylko dla generykow
sed -n '90,100p' server/src/middleware/appErrorMapper.ts
wc -l server/src/middleware/appErrorMapper.ts
grep -n "MESSAGES" server/src/middleware/appErrorMapper.ts | head -4
#   oczekiwane: linia 93 czyta Accept-Language z req, 94 ustala `operational`,
#   96 brzmi: const message = operational ? raw : MESSAGES[language][mappedCode];
#   ★ TO JEST SEDNO R1. Slownik PL obsluguje wylacznie bledy NIE-operacyjne.

# (2) TEZA: guard rozpoznaje WYLACZNIE zmienne o nazwie err/error/e — inna nazwa przechodzi
sed -n '1,20p' tests/unit/backend/security/noRawErrorMessage.test.ts
grep -n "REMAINING_LEAK_BASELINE\|ALTERNATE_LEAK_BASELINE" tests/unit/backend/security/noRawErrorMessage.test.ts
RUN_DB_TESTS=0 MOCK_DB=true npx vitest run tests/unit/backend/security/noRawErrorMessage.test.ts --retry=0 2>&1 | tail -8
#   moje liczby: wszystkie trzy rodziny wzorcow zwiazane z (err|error|e);
#   REMAINING_LEAK_BASELINE = 0, ALTERNATE_LEAK_BASELINE = 44; pakiet ZIELONY.
#   ★ Wstaw sobie lokalnie wyciek z nazwa `dbFailure` i sprawdz, ze guard go NIE widzi. To wejscie do R2.

# (3) TEZA: `req` dotarl do 188 wolan, ale 115 miejsc dalej przekazuje undefined
grep -rn ", undefined," server/src/routes | grep -c mapAppErrorResponse
git grep -nE "mapAppErrorResponse\([^,)]*, req" -- server/src/routes | wc -l
git grep -c "mapAppErrorResponse" -- server/src/routes | awk -F: '{s+=$2} END {print s" wywolan w "NR" plikach"}'
#   moje liczby: 115 z `, undefined,`; 188 z przekazanym `req`.
#   ★ Odbior mowi o 112 helperach bez `req` w ZASIEGU — to inna definicja niz 115 wystapien tekstowych.
#   USTAL WLASNY mianownik komenda i zapisz roznice (Z24). Nie przepisuj zadnej z tych liczb.

# (4) TEZA: 251 unikalnych klas *Error nie dziedziczy AppError
git grep -h "export class [A-Za-z]*Error extends Error" -- server/src | grep -v __tests__ \
  | sed -E "s/.*export class ([A-Za-z]+Error) extends Error.*/\1/" | sort -u | wc -l
git grep -n "extends Error" -- server/src | grep -v AppError | grep -v __tests__ | grep -v "\.test\.ts" | wc -l
#   moje liczby: 251 unikalnych klas. ★ To NIE jest zakres tego dyzuru — zakres wyznaczasz
#   OSIAGALNOSCIA z trasy wolajacej mapper (R1 i R5), reszta idzie pod ratchet.

# (5) TEZA: walidacja UUID w router.use() stoi PRZED sprawdzeniem czlonkostwa, a organizations.id jest TEXT
sed -n '9,45p' server/src/routes/admin/service-accounts.routes.ts
grep -n "id TEXT PRIMARY KEY" server/migrations/000_z_core_baseline.sql | head -2
sed -n '6,10p' server/migrations/000_z_core_baseline.sql
#   oczekiwane: validateUUID(organizationId) i validateUUID(userId) z kodem 400 w globalnym router.use();
#   organizations.id zadeklarowane jako TEXT PRIMARY KEY, nie uuid.
#   ★ Jesli w zywej bazie sa organizacje spoza formatu UUID, ten straznik gasi CALY modul. To wejscie do R4.

# (6) TEZA: front czyta pole bledu — i ten pomiar latwo sfalszowac
git grep -nE "\.details\b" -- src | wc -l
git grep -nE "\.details" -- src | wc -l
grep -n "flattenValidationDetails" src/utils/apiError.ts | head -3
#   ★ PULAPKA: pierwsza komenda (z `\b`) odda PUSTKE, druga da kilkadziesiat trafien.
#   `\b` w `git grep -E` nie dziala i oddaje pustke zamiast bledu. Pustka nie jest wynikiem.

# (7) TEZA: zasoby wolne
lsof -nP -iTCP:5477 -sTCP:LISTEN; lsof -nP -iTCP:6337 -sTCP:LISTEN
docker ps --format "{{.Names}}" | grep -c cx-day321 || true
df -h /
#   oczekiwane: puste lsof, 0 kontenerow. Ten dyzur stawia baze od zera dla R4 —
#   ponizej 5 GB wolnego to STOP calosci (§0.5).
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day321-odpowiedzi-domkniecia-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6337`. Twój JEDYNY port harnessu to `5477`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day321-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta listy restricted ports Chromium. Zajęte przez inne prace (nie ruszasz): 3020, 3022, 3025, 3027, 3030 (tor grafiki nadzorcy), 5322, 5410-5441 (agenci nadzorcy), 5442-5458 oraz 6311-6322 (odbiorcy nadzorcy), 5432 i 5433 (Postgres hosta), 6012, 6379 (redis), 7000, 7679, 7768, 11434. Cudze — dyżury 286-318 (bazy 6290-6334, harness 5250-5474). Dyżury równoległe tej serii: 319 (baza 6335, harness 5475, kontener cx-day319-pg), 320 (baza 6336, harness 5476, kontener cx-day320-pg), 321 (baza 6337, harness 5477, kontener cx-day321-pg) — do CUDZEJ bazy nie łączysz się nawet do odczytu. Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps. ★ ZAKAZ `pkill`/`killall` na `node`, `vite`, `playwright` — zabijasz wyłącznie własne PID-y (zapisz `$!`).`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak — ten dyżur nie wprowadza ani jednej nowej flagi funkcyjnej i nie zmienia wartości domyślnej żadnej istniejącej`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/utils/validation.ts` (`validateUUID` — plik przekrojowy, wołany z wielu modułów) · `server/src/database/PostgresDatabase.ts` i `server/src/database/Database.ts` · `server/src/middleware/auth.middleware.ts` i `verifyAdmin`/`requireAudit` (model uprawnień — nietykalne) · `server/src/routes/__tests__/day22.highRiskAdminAudit.pg.test.ts` i `server/src/routes/__tests__/service-accounts.routes.test.ts` (istniejące kontrakty — wolno DODAĆ test, nie wolno usunąć asercji) · `server/scripts/migrate.postgres.ts` i `tests/unit/backend/schema/noRuntimeDdl.test.ts` (teren dyżuru 319) · `scripts/dev/p0p1-licznik-e1.mjs` i `.github/workflows/**` (teren dyżuru 320) · `scripts/check-list-canon.sh` i `scripts/check-artefakt.sh` (hooki; nie dotyczą zakresu, nie omijaj) · wszystkie przebiegi z `--retry=0`. ★ WYJĄTKI wymienione imiennie w tabeli licencji: `tests/unit/backend/security/noRawErrorMessage.test.ts` (rdzeń `R2` i `R5` — ratchet WYŁĄCZNIE w dół), `server/src/middleware/appErrorMapper.ts` (rdzeń `R1`), `server/src/routes/admin/service-accounts.routes.ts` (rdzeń `R4`)`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY321_ODPOWIEDZI_DOMKNIECIA_REPORT.md`. Dozwolony DRUGI dokument wynikowy: `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_ODPOWIEDZI_DOMKNIECIA_20260904.md` (tabela języka komunikatów PRZED/PO per klasa; tabela 112 helperów z kategorią (a)/(b)/(c); tabela 44 wycieków `ALTERNATE`; tabela klas `*Error` z kolumną osiągalności z trasy). Dozwolona AKTUALIZACJA istniejącego wiersza rodziny wycieków w `docs/program/REJESTR_ZNALEZISK_20260903.md` — dopisujesz stan, nie kasujesz historii. Kod wg tabeli licencji. Nowe pliki w `tests/` i `scripts/` wymagają `git add -f`. **ZAKAZ edycji `MODULE_ACCEPTANCE.md` — ten dyżur jest przekrojowy**. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day321-odpowiedzi-domkniecia-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day321-odpowiedzi-domkniecia-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ obniżania ratchetu bez naprawy** — `REMAINING_LEAK_BASELINE` i `ALTERNATE_LEAK_BASELINE` wolno zmienić WYŁĄCZNIE w dół i wyłącznie w commicie, który usuwa policzone wycieki; podniesienie progu istniejącego wzorca albo złagodzenie asercji = odrzucenie pozycji. **WYJĄTEK jawny: rozszerzenie wzorca w `R2` tworzy NOWY mianownik** — ratchet nowego wzorca ustawiasz na zmierzonej liczbie i opisujesz jej skład w raporcie. **ZAKAZ dowodu mutacyjnego kopiującego własny wzorzec** — mutacja celuje w inny zapis wycieku i w inną nazwę zmiennej niż ta, którą naprawiłeś. **ZAKAZ zamknięcia pozycji `R4` na samym dowodzie „obcy nie widzi”** — bez dowodu „właściciel widzi” pozycja jest NIEZROBIONA. **ZAKAZ osłabiania granicy międzyorganizacyjnej** — `ADMIN_BOUNDARY_VIOLATION`, `ADMIN_MEMBERSHIP_REQUIRED` i `ADMIN_ACCESS_REQUIRED` zostają. **ZAKAZ zmiany `validateUUID` w `server/src/utils/validation.ts`** — poprawka idzie do trasy. **ZAKAZ zmiany kodów HTTP i kształtu koperty odpowiedzi poza polem komunikatu**; każda zmiana kodu wymaga imiennego wiersza w tabeli raportu. **ZAKAZ przerabiania 251 klas `*Error` hurtem** — zakres wyznaczasz OSIĄGALNOŚCIĄ z trasy wołającej mapper, resztę spinasz ratchetem. **ZAKAZ ręcznej edycji więcej niż dziesięciu miejsc bez codemodu zapisanego w repo.** **ZAKAZ zabierania logom surowej treści.** **ZAKAZ zmian w `src/`.** **ZAKAZ zmiany domyślnego `isOperational` w `AppError` bez wiersza w tabeli decyzji raportu.** **ZAKAZ `git stash`, `pkill`, `killall`, `--no-verify`.** **ZAKAZ dotykania demo, stagingu i produkcji.** **ZAKAZ edycji `MODULE_ACCEPTANCE.md`.** | Dyżur 313 zamknął 35 wycieków i to jest realna praca — ale zdanie „bezpieczeństwo odpowiedzi domknięte” jest dziś nieprawdziwe w trzech kierunkach naraz. Bezpiecznik chroni trzy nazwy zmiennych zamiast rodziny, więc wyciek pod inną nazwą wejdzie bez oporu. Naprawa dziedziczenia `AppError` odwróciła efekt produktowy: właściciel dostaje polskie generyki i ANGIELSKIE komunikaty biznesowe, a nikt tego nie zgłosił, bo nikt nie sprawdził, co widzi klient. A strażnik formatu identyfikatora w `router.use()` może wyłączyć cały moduł kont serwisowych dla wszystkich i będzie wyglądał jak poprawny fail-closed — to jest kształt, który program ma zapisany jako „zamknięte przez wygaszenie” i który wystąpił trzy razy jednego dnia. Bez tego dyżuru rejestr będzie niósł „naprawione”, produkt będzie niósł angielszczyznę, a bramka bezpieczeństwa będzie przepuszczać rodzinę, którą miała zamknąć. |

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
cd /private/tmp/cx-day321-odpowiedzi-domkniecia

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day321-pg psql -U postgres -d cx321 \
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
cd /private/tmp/cx-day321-odpowiedzi-domkniecia

docker run -d --name cx-day321-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx321 \
  -p 127.0.0.1:6337:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day321-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6337/cx321 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6337/cx321 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day321-odpowiedzi-domkniecia && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6337/cx321 \
JWT_SECRET=cx321-test-secret-do-podpisu-tokenow-w-tym-dyzurze \
npx vitest run tests/unit/backend/security/noRawErrorMessage.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day321-odpowiedzi-domkniecia-artefakty/day321-guard-wyciekow.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day321-odpowiedzi-domkniecia && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run tests/unit/backend/security/noRawErrorMessage.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day321-odpowiedzi-domkniecia-artefakty/day321-guard-wyciekow.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day321-odpowiedzi-domkniecia/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day321-pg psql -U postgres -d cx321 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day321-pg`.
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
> **(e) ★★★ OSIEM PUŁAPEK TEGO DYŻURU. **(1) Naprawa bezpieczeństwa kupuje regresję produktu.** Mapper wybiera `operational ? raw : MESSAGES[language][mappedCode]` — im więcej klas dostanie `isOperational`, tym więcej ANGIELSKICH komunikatów zobaczy właściciel. Zanim naprawisz kolejną klasę, rozstrzygnij `R1`. **(2) Bezpiecznik chroni nazwy zmiennych, nie rodzinę.** Mutacja z `dbFailure` przechodzi mimo ratchetu 0. Twój dowód mutacyjny MUSI użyć nazwy, której guard dziś nie zna; mutacja z `err`/`error`/`e` niczego nie dowodzi. **(3) Zamknięte przez wygaszenie.** Fail-closed świeci zielono, gdy funkcja jest wyłączona dla WSZYSTKICH. Ten kształt wystąpił trzy razy jednego dnia. Dla `R4` wymagana jest PARA dowodów: „obcy nie widzi” ORAZ „właściciel widzi”, na realnym łańcuchu HTTP, nie na atrapie. **(4) Wołacz istnieje ≠ renderuje się, klucz istnieje ≠ przetłumaczony.** Klucz i18n obecny w `pl`, ale trzymający angielskie słowo, NIE jest przetłumaczony; audyt po istnieniu klucza melduje fałsz. **(5) Atrapa bazy kłamie w obie strony.** `NODE_ENV=test` bez `RUN_DB_TESTS=1` podstawia atrapę pod `DbPromise` — `pg.Pool` widzi wiersz, kod produkcyjny nie; `Database.ts` zwraca `changes: 1` dla każdego `UPDATE` niezależnie od `WHERE`. Dowód dla `R4` robisz na REALNYM Postgresie, na własnym porcie, po pełnym łańcuchu migracji od zera. **(6) `\b` w `git grep -E` oddaje PUSTKĘ zamiast błędu**, tak samo `grep --include` w `zsh`. Pustka nie jest wynikiem, dopóki drugą komendą nie potwierdzisz, że polecenie mierzy. **(7) Log MA prawo do surowej treści.** Wyciek liczy się WYŁĄCZNIE w odpowiedzi HTTP; guard ma już regułę `isResponseLine()` i okno wokół `logger.*` — nie zabieraj logom treści. **(8) Naprawa per wywołanie odrasta.** 112 helperów to RODZINA; wypisz rodzeństwo przed pierwszą zmianą, bo praca per zgłoszenie daje „poprawne w 2 z 3”.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day321-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day321-odpowiedzi-domkniecia-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (``R1`, `R2`, `R4``) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6337` albo `5477` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6337` albo `5477`** (`Z7`).

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

Dyżur 313 zrobił robotę, którą odbiór adwersaryjny 04.09 potwierdził: **35 wycieków surowej
treści błędu w odpowiedziach HTTP zeszło do zera** (`REMAINING_LEAK_BASELINE = 0`), trzy mutacje
powtórzone RED→GREEN, `esbuild` 55/55, testy 13/13, codemod mappera przeprowadzony i zapisany
w repo. To jest realna praca i nie podważasz jej.

Odbiór znalazł natomiast **pięć rzeczy, których wykonawca nie zgłosił**, i one są treścią
tego dyżuru.

**★ Pierwsza jest najważniejsza, bo zmienia to, co widzi klient — i nikt jej nie zauważył.**
`server/src/middleware/appErrorMapper.ts` wybiera komunikat tak:

```
const message = operational ? raw : MESSAGES[language][mappedCode];
```

Czyli **polski słownik działa WYŁĄCZNIE dla błędów NIE-operacyjnych**. Naprawa dziedziczenia
`AppError` z dyżuru 313 sprawiła, że naprawione klasy niosą `isOperational = true` — a więc
**przepuszczają surowy komunikat**. Ten komunikat w kodzie jest **po angielsku**.

Efekt produktowy jest zatem odwrotny do intencji zlecenia: **generyki są po polsku, a komunikaty
biznesowe — te, które klient naprawdę czyta — po angielsku.** Im więcej klas naprawisz w stylu
313, tym więcej angielszczyzny zobaczy właściciel. **To jest pozycja `R1` tego dyżuru** i ma
zostać najpierw rozstrzygnięta, a potem wykonana.

**Druga: guard jest ślepy na nazwę zmiennej wyjątku.** Wszystkie wzorce w
`tests/unit/backend/security/noRawErrorMessage.test.ts` wiążą się z `err`, `error` albo `e`.
Mutacja z nazwą `dbFailure` **przechodzi na zielono**, mimo że ratchet stoi na 0. Zabezpieczenie
chroni nazwy zmiennych, nie rodzinę wycieków.

**Trzecia: `req` dotarł do 188 wywołań, ale 112 zostało bez `req` w zasięgu.** Liczba
`, undefined,` spadła z 288 na 115. Pozostałe to **helpery bez `req` w zasięgu**, wypisane
imiennie w raporcie 313. Bez `req` nie ma `Accept-Language`, więc polski słownik i tak się nie
uruchamia — a to znaczy, że praca `R4` z dyżuru 313 jest **w tych miejscach niedokończona**,
a nie „wykonana z wyjątkami".

**Czwarta: walidacja UUID w `router.use()` może wygasić cały moduł.**
`server/src/routes/admin/service-accounts.routes.ts` odrzuca żądanie kodem 400, gdy
`organizationId` albo `userId` nie jest UUID-em. Kolumna `organizations.id` jest **`TEXT`**
(`server/migrations/000_z_core_baseline.sql`), nie `uuid`. Jeżeli w żywej bazie są organizacje
z identyfikatorem spoza formatu UUID, **cały moduł kont serwisowych przestaje działać dla
wszystkich** — i wygląda to jak zielony fail-closed. To jest zapisany kształt „zamknięte przez
wygaszenie": zabezpieczenie świeci na zielono, bo funkcja jest wyłączona dla każdego.

**Piąta: 44 wycieki `ALTERNATE_LEAK_BASELINE` wciąż tolerowane**, plus **251 unikalnych klas
`*Error` bez `AppError` pod ratchetem**. To jest dług policzony, nie naprawiony — i ma zostać
opisany uczciwie, a nie zamieciony.

## ★ Zmierz moje liczby sam

Twierdzę: `appErrorMapper.ts` ma **113 linii** i wybiera komunikat wyrażeniem
`operational ? raw : MESSAGES[language][mappedCode]`; `REMAINING_LEAK_BASELINE = 0`,
`ALTERNATE_LEAK_BASELINE = 44`; `, undefined,` przy wywołaniu mappera występuje **115 razy**,
a wywołań z przekazanym `req` jest **188**; unikalnych klas `*Error extends Error` poza testami
jest **251**; wszystkie wzorce guardu wiążą się wyłącznie z `err|error|e`; `organizations.id`
jest typu `TEXT`. Komendy z §0.3 to sprawdzają.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz
rozbieżność wprost.**

★★ Cztery ostrzeżenia do samego mierzenia. **(1)** `\b` w `git grep -E` oddaje **pustkę zamiast
błędu**; to samo robi `grep --include` w `zsh`. Pustka nie jest wynikiem, dopóki drugą komendą
nie potwierdzisz, że polecenie mierzy. **(2)** `NODE_ENV=test` bez `RUN_DB_TESTS=1` podstawia
**atrapę bazy** pod `DbPromise` — `pg.Pool` widzi wiersz, kod produkcyjny nie. **(3)**
`Database.ts` zwraca `changes: 1` dla każdego `UPDATE` niezależnie od `WHERE` — testy zapisu
warunkowego tylko na realnej bazie. **(4)** `--retry=0` jest obowiązkowe: test „atak odrzucony"
potrafi wyleczyć się skutkiem własnego ataku.

---

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA, WALIDATOR → TRASA → KONTROLER → SERWIS → REPOZYTORIUM

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany:
czerwony kontrakt testowy + brief (plik:linia · dlaczego · promień rażenia · jak wyglądałby
dowód mutacyjny). Pozycja z takim produktem jest **ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Mapper (rdzeń)** | `server/src/middleware/appErrorMapper.ts` | **★ PEŁNA LICENCJA** w zakresie `R1` i `R3`. Zakaz zmiany kształtu koperty odpowiedzi poza polem komunikatu; `errorCode` i `correlationId` zostają | — |
| **Klasa bazowa błędu** | `server/src/utils/ErrorHandler.ts` (`AppError`: `statusCode`, `code`, `details`, `status`, `isOperational`) | **★ WĄSKA LICENCJA:** wyłącznie to, co wynika z rozstrzygnięcia `R1` (np. rozróżnienie „komunikat gotowy do pokazania" od „komunikat surowy"). **Zakaz zmiany domyślnego `isOperational` bez wiersza w tabeli decyzji raportu** | Czerwony kontrakt + brief |
| **Walidator** | `server/src/utils/validation.ts` (`validateUUID`) | **TYLKO ODCZYT — plik przekrojowy.** Jeżeli `R4` wymaga innej walidacji, robisz to **w trasie**, nie w walidatorze współdzielonym | Czerwony kontrakt + brief: ilu wołaczy dotyczy zmiana i jaki jest promień rażenia |
| **Trasa (rdzeń `R4`)** | `server/src/routes/admin/service-accounts.routes.ts` | **★ PEŁNA LICENCJA** w zakresie `R4`. Zakaz osłabiania granicy międzyorganizacyjnej — `ADMIN_BOUNDARY_VIOLATION`, `ADMIN_MEMBERSHIP_REQUIRED` i `ADMIN_ACCESS_REQUIRED` zostają | — |
| **Trasy (rodzina `req`)** | `server/src/routes/**` (bez `__tests__`) | **★ PEŁNA LICENCJA** w zakresie `R2` i `R3`: wyłącznie przekazanie `req` do mappera i usunięcie wycieku. **Zakaz zmiany kodów HTTP i logiki biznesowej w tym samym commicie** | — |
| **Kontrolery** | `server/src/controllers/**` | **★ WĄSKA LICENCJA:** wyłącznie `R3` — przekazanie `req` tam, gdzie jest w zasięgu | Czerwony kontrakt + brief |
| **Serwisy (klasy domenowe)** | `server/src/services/**` — pliki z `export class *Error` | **★ WĄSKA LICENCJA:** wyłącznie zmiany wynikające z `R1` i `R5`, imiennie wymienione w raporcie. **Zakaz przerabiania 251 klas hurtem** | Wpis do tabeli długu + ratchet |
| **Repozytorium / warstwa bazy** | `server/src/database/PostgresDatabase.ts`, `server/src/database/Database.ts` | **TYLKO ODCZYT — BEZWZGLĘDNIE** | Czerwony kontrakt + brief |
| **Bezpiecznik wycieków** | `tests/unit/backend/security/noRawErrorMessage.test.ts` | **★ PEŁNA LICENCJA** w zakresie `R2` i `R5`. **Ratchet wolno zmieniać WYŁĄCZNIE W DÓŁ** i wyłącznie w commicie, który usuwa policzone wycieki. Podniesienie progu = odrzucenie pozycji | — |
| **Bezpieczniki mappera** | `server/src/middleware/__tests__/appErrorMapper.test.ts` | **★ PEŁNA LICENCJA**: dodawać wolno zawsze; zmiana istniejącej asercji wymaga jawnego wpisu o zmianie kontraktu | — |
| **Nowe testy** | `tests/**` i `server/src/**/__tests__/**` (NOWE pliki, w tym `.pg.test.ts`) | **★ PEŁNA LICENCJA**, z zastrzeżeniem `Z18` i `Z31`. Nowe pliki w `tests/` wymagają `git add -f` | — |
| **Codemod (istnieje)** | `scripts/dev/codemod-error-mapper-req.mjs` (57 linii, oparty na `typescript`, tryby `--check`/zapis, rozpoznaje `mapAppErrorResponse(..., undefined, ...)` i wypisuje kategorię `noReq`) | **★ PEŁNA LICENCJA** w zakresie `R3` — **rozszerzasz istniejący codemod, nie piszesz drugiego obok**. Kategoria `noReq` tego narzędzia jest Twoim punktem wyjścia do listy 112 helperów | — |
| **Codemod (pozostałe)** | `scripts/dev/codemod-error-mapper.mjs`, `scripts/dev/codemod-day313-raw-response-leaks.mjs` | **TYLKO ODCZYT** — wzorce z dyżurów 296 i 313. **Ręczna edycja więcej niż dziesięciu miejsc bez codemodu zapisanego w repo jest zakazana** | Brief w raporcie |
| **Front** | całe `src/`, w tym `src/utils/apiError.ts` | **TYLKO ODCZYT.** Mierzysz, co front robi z polem komunikatu, i **od tego zależy kształt naprawy `R1`** | Wpis do raportu z plik:linia |
| **Tłumaczenia** | `public/locales/pl/translation.json`, `public/locales/en/translation.json` | **★ WĄSKA LICENCJA:** wyłącznie wtedy, gdy `R1` rozstrzygnie na wariant „komunikat przez słownik", i wyłącznie klucze, które sam dodasz. ★ Klucz istniejący w `pl`, ale trzymający angielskie słowo, **nie jest przetłumaczony** — audyt po samym istnieniu klucza kłamie | — |
| **Raport 313 i odbiór** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY313_DOMKNIECIA2_BEZPIECZENSTWO_ODPOWIEDZI_REPORT.md` oraz `docs/program/waves/WAVE_03_ACCEPTANCE/codex/ODBIOR_DYZUROW_307_311_312_20260904.md` | **TYLKO ODCZYT** — źródło imiennej listy helperów bez `req` w zasięgu. **Weryfikujesz tę listę własną komendą; nie przepisujesz jej jako faktu** | — |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA istniejącego wiersza** rodziny wycieków — dopisujesz stan, nie kasujesz historii | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY321_ODPOWIEDZI_DOMKNIECIA_REPORT.md` | `R6` — **JEDYNY nowy dokument, jaki wolno Ci utworzyć** (`Z13`) | — |
| **Cudze tereny** | `tests/unit/backend/schema/noRuntimeDdl.test.ts`, `server/scripts/migrate.postgres.ts`, `scripts/dev/p0p1-licznik-e1.mjs`, `.github/workflows/**` | **TYLKO ODCZYT — tereny dyżurów 319 i 320** | Wpis do raportu: plik, linia, problem, **gotowa rekomendacja jako diff w bloku kodu, nienałożony** |

---

## R1 — SŁOWNIK KONTRA KOMUNIKAT BIZNESOWY (rdzeń — najważniejsza pozycja dyżuru)

**Najpierw rozstrzygnięcie, potem wykonanie. Rozstrzygnięcie ma stać w raporcie jako decyzja
z uzasadnieniem, nie jako domysł w kodzie.**

Zmierz i wypisz **zanim cokolwiek zmienisz**:

1. Ile komunikatów operacyjnych, które dziś przechodzą przez mapper jako `raw`, jest
   **po angielsku**, a ile po polsku. Liczba, komenda, próbka dziesięciu dosłownie.
2. Co widzi klient **dziś**, dla obu kategorii, przy nagłówku `Accept-Language: pl` i bez.
   Realne żądania HTTP, kod i ciało.
3. Kto na froncie ten komunikat wyświetla (`src/`, tylko odczyt) — bo od tego zależy, czy
   naprawa ma być po stronie serwera, czy klucza tłumaczenia.

Potem rozstrzygasz **jeden z trzech wariantów** i uzasadniasz wybór:

- **(A) komunikaty biznesowe idą przez słownik** — klasa niesie kod, słownik niesie treść
  w obu językach; komunikat w kodzie przestaje być tekstem dla klienta;
- **(B) komunikaty biznesowe zostają surowe, ale są po polsku** — wtedy trzeba je przetłumaczyć
  u źródła i pilnować tego bezpiecznikiem;
- **(C) wariant mieszany** — słownik jako podstawa, surowy komunikat jako awaryjny, z jawną
  regułą pierwszeństwa.

**Wybierasz i WYKONUJESZ na zmierzonym, imiennie wypisanym podzbiorze** — nie na wszystkich 251
klasach. Uczciwa granica jest wynikiem; udawana kompletność nie jest warta nic.

**★★ DOWÓD — para, nie pojedyncze żądanie.** Dla każdej naprawionej klasy: żądanie
z `Accept-Language: pl` daje komunikat **po polsku**, żądanie bez nagłówka daje komunikat
**po angielsku**, a `errorCode` i kod HTTP **nie zmieniają się**. Plus mutacja: cofnij naprawę
w jednym miejscu i pokaż, że test czerwieni się.

**Wymagany dowód:** tabela PRZED/PO per klasa (język, `errorCode`, kod HTTP), wyjścia żądań
dosłownie, wiersz w tabeli decyzji z wybranym wariantem i uzasadnieniem. **Commit po `R1`.**

## R2 — GUARD ŚLEPY NA NAZWĘ ZMIENNEJ (rdzeń)

Bezpiecznik ma łapać **rodzinę wycieków**, nie trzy nazwy zmiennych.

1. Rozszerz wzorce tak, żeby nazwa zmiennej wyjątku **nie decydowała** o wykryciu.
2. **Zmierz nowy mianownik.** Po rozszerzeniu wzorca liczba trafień wzrośnie — to nie jest
   regresja, to jest odsłonięty dług. Ratchety ustawiasz na **zmierzonej** liczbie i piszesz,
   z czego się składa.
3. Reguła „log ma prawo do surowej treści" **zostaje**: wyciek liczy się wyłącznie
   w odpowiedzi HTTP.

**★★ DOWÓD MUTACYJNY — warunek rozstrzygający.** Mutacja **musi celować w zabezpieczenie**:
wstaw wyciek z nazwą zmiennej, której guard dziś nie zna (`dbFailure` — dokładnie ta, która
przeszła w odbiorze), oraz co najmniej dwie inne nazwy własnego wyboru, każda w innym pliku
tras. Trzy pary RED/GREEN dosłownie. Mutacja używająca `err`/`error`/`e` **nie jest dowodem
tej pozycji** — ten zakres był zielony przed dyżurem.

**Wymagany dowód:** wyjście guardu PRZED i PO z liczbami, trzy pary RED/GREEN, tabela nowych
ratchetów z rozbiciem. **Commit po `R2`.**

## R3 — `req` W 112 HELPERACH (rdzeń)

112 miejsc nie ma `req` w zasięgu. Bez `req` nie ma `Accept-Language`, więc żaden polski
komunikat się tam nie uruchomi — **niezależnie od tego, jak rozstrzygniesz `R1`**.

1. **Weź imienną listę z raportu 313** i **zweryfikuj ją własną komendą** — nie przepisujesz
   cudzej listy jako faktu. Rozbieżność zapisujesz.
2. Podziel na trzy kategorie z liczbą: **(a)** `req` da się przekazać przez sygnaturę helpera;
   **(b)** helper jest wołany także spoza kontekstu żądania — potrzebny parametr opcjonalny;
   **(c)** helper w ogóle nie powinien mapować błędu (mapowanie należy do trasy).
3. Wykonaj **(a)** i **(b)**, grupami po dziesięć plików, **rozszerzając istniejący
   `scripts/dev/codemod-error-mapper-req.mjs`** (dyżur 313 już go napisał i to on wypisuje
   kategorię `noReq` — zacznij od uruchomienia go w trybie `--check`), `esbuild` każdego
   zmienionego pliku, **commit per grupa**. Drugiego codemodu obok nie piszesz.
4. Kategoria **(c)** idzie do tabeli z uzasadnieniem — to jest wynik, nie porażka.

**Wymagany dowód:** liczba `, undefined,` PRZED i PO z komendą, test „`pl` → polski, brak
nagłówka → angielski" dla co najmniej jednego helpera z każdej kategorii (a) i (b), mutacja
cofająca przekazanie `req` z wyjściem RED. **Commit per grupa.**

## R4 — WALIDACJA UUID: PARA DOWODÓW, NIE JEDEN (rdzeń)

`router.use()` w `service-accounts.routes.ts` odrzuca 400, gdy identyfikator nie jest UUID-em,
a kolumna `organizations.id` jest typu `TEXT`. Ryzyko: **cały moduł wygaszony dla wszystkich**.

**Kolejność jest wiążąca — najpierw pomiar, potem decyzja.**

1. **Zmierz na REALNEJ, żywej bazie** (własny kontener, pełny łańcuch migracji od zera plus
   dane, które sam założysz w obu kształtach), ile organizacji ma identyfikator **spoza**
   formatu UUID. Nie zgaduj po typie kolumny i nie zgaduj po produkcji.
2. **Wymagana jest PARA dowodów na realnym łańcuchu HTTP, nie na atrapie:**
   - **„obcy nie widzi"** — użytkownik spoza organizacji dostaje odmowę z właściwym kodem;
   - **„właściciel widzi"** — administrator własnej organizacji dostaje **200 i dane**,
     **także wtedy, gdy identyfikator organizacji nie jest UUID-em**.
   Sam pierwszy dowód **nie wystarcza** i nie jest podstawą do zamknięcia pozycji.
   Zielony fail-closed przy wygaszonej funkcji przeszedł już trzy razy jednego dnia.
3. Jeżeli para dowodów pokaże wygaszenie — naprawiasz **w trasie**: walidacja formatu przestaje
   być warunkiem dostępu, a zostaje warunkiem **sanityzacji zapytania**. Granica
   międzyorganizacyjna **zostaje nietknięta**.
4. Jeżeli para dowodów pokaże, że wygaszenia nie ma — **piszesz to wprost**, zostawiasz kod
   i dokładasz **test regresyjny na oba kształty identyfikatora**, żeby przyszła zmiana typu
   kolumny nie wygasiła modułu po cichu.

**Wymagany dowód:** liczba organizacji spoza formatu UUID z komendą SQL, cztery żądania HTTP
(obcy/właściciel × UUID/nie-UUID) z kodami i ciałami, nowy test `.pg.test.ts`. **Commit po `R4`.**

## R5 — DŁUG POLICZONY: 44 I 251

Nie zamykasz tego w jednym dyżurze i **nie udajesz, że zamykasz**.

- **44 wycieki `ALTERNATE_LEAK_BASELINE`**: tabela plik · linia · wariant · co może wyciec ·
  czy odpowiedź HTTP czy log. Ile z nich naprawisz — decydujesz sam i wpisujesz liczbę; ratchet
  schodzi **dokładnie o tyle**, ile naprawiłeś, **tym samym commitem**.
- **251 klas `*Error` bez `AppError`**: tabela z kolumną **osiągalności z trasy wołającej
  mapper** — bo tylko osiągalne klasy zmieniają cokolwiek dla klienta. Osiągalność **mierzysz,
  nie zgadujesz**. Reszta zostaje pod ratchetem z jawną liczbą.

**Wymagany dowód:** obie tabele, ratchety PRZED/PO z wyjściem testu, komenda pomiaru
osiągalności. **Commit po `R5`.**

## R6 — RAPORT

Raport zawiera: tabelę decyzji `R1` (wariant, uzasadnienie, zakres wykonania), tabelę PRZED/PO
języka komunikatów, wyjście guardu PRZED/PO z rozbiciem ratchetów, wszystkie dowody mutacyjne
**dosłownie**, cztery żądania HTTP z `R4`, tabele długu z `R5`, listę rozbieżności wobec liczb
tej instrukcji i **niepustą sekcję „TWIERDZENIA NIEZWERYFIKOWANE"**.

★ Osobna, **obowiązkowa** sekcja: **„Co się zmieniło dla klienta"** — trzy do pięciu zdań
po polsku, bez żargonu, o tym, co właściciel zobaczy inaczej niż wczoraj. Dyżur 313 zmienił
język połowy komunikatów w produkcie i nikt tego nie zapisał; to jest dokładnie ta luka.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem i pushem. Zdanie: „`R1` rozstrzygnięty
na wariant A i wykonany na 9 klasach osiągalnych z tras, guard przestał zależeć od nazwy
zmiennej i ma trzy nowe dowody mutacyjne, 60 z 112 helperów dostało `req`, reszta wypisana
z kategorią, moduł kont serwisowych sprawdzony parą dowodów i nie jest wygaszony, dług 44+251
opisany i spięty ratchetem" — **jest pełnowartościowym wynikiem**.

Zdanie „komunikaty naprawione" postawione na parze, w której działa tylko dowód „obcy nie
widzi", **nie jest warte nic — i dokładnie ten kształt wystąpił już trzy razy jednego dnia**.

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: **sprawdzasz warunek
NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na zapamiętanym wyniku**. Dyżur 300
przez to stał dobę po ustaniu blokady. Wynik ponownego sprawdzenia wklejasz do raportu z datą
i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Ratchet wolno zmieniać tylko w dół" vs „`R2` odsłoni więcej wycieków i liczba wzrośnie" | `R2` punkt 2: **nowy wzorzec = nowy mianownik**; ratchet ustawiasz na zmierzonej liczbie i opisujesz skład. Zakaz podnoszenia progu **istniejącego** wzorca bez naprawy |
| „Zero zmian w `src/`" vs „`R1` zależy od tego, co robi front" | Tabela licencji, wiersz „Front": front jest **mierzony**, nie zmieniany |
| „Nie zmieniasz kodów HTTP" vs „`R4` może wymagać innego kodu" | `R4` punkt 3: naprawa polega na **przeniesieniu walidacji z warunku dostępu na sanityzację zapytania**; kod HTTP zostaje, a każda zmiana kodu wymaga imiennego wiersza w raporcie |
| „`validateUUID` jest przekrojowy i nietykalny" vs „`R4` wymaga innej walidacji" | Tabela licencji, wiersz „Walidator": zmiana idzie **do trasy**, walidator współdzielony zostaje |
| „Nie przerabiasz 251 klas" vs „`R1` ma dać efekt produktowy" | `R1` i `R5`: wykonanie na **zmierzonym, imiennie wypisanym podzbiorze osiągalnym z tras**; reszta pod ratchetem |
| „Zakaz nowych flag" (`Z10`) vs „potrzebny przełącznik wariantu `R1`" | `R1`: wariant wybierasz **raz, na piśmie, i wykonujesz** — bez flagi funkcyjnej i bez zmian w `.env*` |
| „Nowe pliki testowe wolno tworzyć" vs „`Z13` zakazuje nowych dokumentów" | Tabela licencji, wiersze „Nowe testy" i „Raport dyżuru": `Z13` dotyczy **dokumentów rejestrowych**, nie plików testowych; nowe pliki w `tests/` wymagają `git add -f` |
