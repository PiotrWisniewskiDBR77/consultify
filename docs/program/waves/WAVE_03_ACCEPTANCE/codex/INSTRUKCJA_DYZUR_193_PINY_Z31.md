# INSTRUKCJA DYŻURU nr 193 — Codex — „Zbiorcze odpięcie pinów Z31 — co najmniej 7 testów przypiętych do bazy/portu wykonawcy (3 znane + 4 nowo znalezione sweepem), odepnij i uzielenij na obcym kontenerze"

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
> **wyłącznie** `/private/tmp/cx-day193-piny`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `b4651675f6`**
> **Gałąź bazowa: `github-backup/codex/m03-admin-20260824`**
> **Stan dokumentu: WYDANY**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo jakiekolwiek niewypelnione pole szablonu — **dokument nie
> jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.
> Ta ramka jest **jedynym** miejscem, w którym rozstrzyga się stan wydania.
> Objaśnienia w innych blokach cytowanych **nie** są powodem do STOP-u.

Data wystawienia: 2026-08-31.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.
Zakres: **PRZEKROJOWY — testy PostgreSQL w `server/src/**/__tests__` i `tests/`, nie jeden moduł produktowy; bezpiecznik Z31 (zakaz pinowania nazwy bazy/portu w testach)**.
Trasy front: `brak — ten dyżur nie dotyka `src/**``. Trasy tył: `brak zmian produktowych — WYŁĄCZNIE pliki testowe `*.pg.test.ts` wskazane w R1/R2 tej instrukcji, żadnego pliku serwisowego/routingu`.

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
WT=/private/tmp/cx-day193-piny
MARKER=b4651675f6

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day193-piny-z31-20260831 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day193-piny/config.worktree"
cat "$VAULT/worktrees/cx-day193-piny/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day193-piny-scratch
mkdir -p /private/tmp/cx-day193-piny-artefakty

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
git -C "$VAULT" log --oneline b4651675f6..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only b4651675f6..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day193-piny-z31-20260831
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only b4651675f6..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `sześć` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day193-piny

# (T1) trzy piny ZNANE — potwierdź linie dokładnie
sed -n '68p' server/src/routes/__tests__/day160.task-write-gate.pg.test.ts
#   oczekiwane: expect(target.rows[0]).toEqual({ database: 'cx160', port: 5432 });
sed -n '33,35p' server/src/routes/__tests__/presentations.templatePptx.day83.pg.test.ts
#   oczekiwane: expect(proof.database).toBe('cx_day83'); .host toBe('127.0.0.1'); .port toBe('5955');
sed -n '49,51p' server/src/routes/__tests__/presentations.templateContent.day186.pg.test.ts
#   oczekiwane: expect(proof.database).toBe('cx186'); .host toBe('127.0.0.1'); .port toBe('6095');

# (T2) SWEEP wzorzec 1 — porównanie identyczności obiektu {database, port}
grep -rn "toEqual({ database:" server/src tests
#   oczekiwane MINIMUM: day160:68, day168:38 (server/src/routes/__tests__/day168.kpi-bootstrap.pg.test.ts),
#   day139:35 (server/src/services/ai/__tests__/day139.projectTextGovernance.pg.test.ts),
#   day159:42 (server/src/services/ai/__tests__/day159.chunkOrgBackfill.pg.test.ts),
#   day169:46 (server/src/services/resultsVnext/okr/__tests__/day169.checkin-windows.pg.test.ts)
#   — jeśli wynik ma MNIEJ niż te pięć, coś się zmieniło od pomiaru instrukcji, zaufaj
#   świeżemu gerpowi, nie tej liście.

# (T3) SWEEP wzorzec 2 — literał nazwy bazy
grep -rn "toBe('cx" server/src tests
#   oczekiwane MINIMUM: day186:49 (cx186), day83:33 (cx_day83) — plus sprawdź czy sweep
#   złapał coś, czego nie ma w T2 (np. warianty toBe('cx168') osobno od toEqual).

# (T4) SWEEP wzorzec 3 — pełny connection string
grep -rn "DATABASE_URL).toBe('postgresql:" server/src tests
#   oczekiwane MINIMUM: day139:34, day159:41 — TRZECI wzorzec pinowania, spoza
#   'toEqual({ database:' i 'toBe(\'cx' — brief mówi "i podobne", to jest to "podobne".

# (T5) już naprawione — wzorce docelowe do skopiowania
grep -n "toBeGreaterThan(0)" server/src/routes/__tests__/day171.data-contracts.pg.test.ts
#   oczekiwane: expect(target.rows[0].database.length).toBeGreaterThan(0);
#               expect(target.rows[0].port).toBeGreaterThan(0);  (FIX-171)
grep -n "toMatch(/\^postgresql" server/src/workers/__tests__/day164.agent-dispatch-map.test.ts
#   oczekiwane: expect(databaseUrl).toMatch(/^postgresql:\/\/[^/]+@(127\.0\.0\.1|localhost):\d+\/[^/]+$/);  (FIX-174)
grep -n "DAY170_ARTIFACTS_DIR" server/src/routes/__tests__/day170.checkin-occurrences.pg.test.ts
#   oczekiwane: ARTIFACTS_DIR = process.env.DAY170_ARTIFACTS_DIR (opcjonalny) +
#               `if (ARTIFACT && existsSync(...))` — zapis pomijany bez env, nie ENOENT  (FIX-170)

# (T6) dowód liczby '6' z ODBIOR_186
grep -n "Licznik pinów Z31" docs/program/funkcje/ODBIOR_186_GEN4_TRESC.md
```

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day193-piny-z31-20260831` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6113`. Twój JEDYNY port harnessu to `5058 i 5059`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day193-pg`**. **ZAKAZANE:** `6012, 5433, 6047 i 6054-6107 (odbiory nadzorcy + dyżury 170-187), 5010-5047 (dyżury 170-187), 6404-6411, 6108/5048-5049 (day188, ta sama partia), 6109/5050-5051 (day189, ta sama partia), 6110-6112/5052-5057 (rezerwacja partii, dyżury 190-192, NIE używaj). ★ PORT 5000 ZAJĘTY NA STAŁE przez macOS Control Center. ★ PORT 5037 zajęty przez adb. UWAGA: ten dyżur z definicji testuje NA OBCYM kontenerze (nie 6113 wprost dla każdego testu — patrz R3, każdy odpięty test uruchamiasz na WSPÓLNYM, ale INNYM niż jego historyczny pin, kontenerze)`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak — ten dyżur NIE wprowadza ani jednej nowej flagi i NIE zmienia wartości domyślnej żadnej istniejącej`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY193_PINY_Z31_REPORT.md`. Nie dotyczy — ten dyżur jest przekrojowy (bezpiecznik testowy), nie moduł produktowy z `WAVE_03_ACCEPTANCE/modules/`. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day193-piny-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day193-piny-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **NIE zmieniasz treści testu poza samą asercją bazy/portu.** Zero dotyku logiki testowej, seedów, mutacji, oczekiwanych wartości biznesowych — WYŁĄCZNIE linia(e) asertująca tożsamość bazy/portu/connection-stringa. **NIE kasujesz testów, które dziś padają z INNEGO powodu niż pin** (np. day186 ma "zastane 4 FAIL mappera — bajt-identyczne z markerem, nie regresja" wg ODBIOR_186 — to nie jest w zakresie tego dyżuru, nie naprawiasz mappera). **NIE zmieniasz portu/nazwy własnego kontenera `cx-day193-pg`/6113 w samych testach** — testy po naprawie mają być PRZENOŚNE (działać na DOWOLNYM realnym Postgresie), nie mają zawierać `cx193`/6113 jako nowego twardego pinu w miejsce starego. **NIE pomijasz kroku R3** dla żadnego odpiętego testu — "test się kompiluje" albo "asercja wygląda dobrze" NIE jest dowodem, każdy MUSI faktycznie przejść (zielono) na obcym kontenerze, inaczej to nie jest odpięcie, tylko kosmetyka. **Jeśli sweep (R2) znajdzie wzorzec spoza trzech znanych (`toEqual({ database:`, `toBe('cx`, `DATABASE_URL).toBe('postgresql:`) — wypisz go i odepnij, nie ignoruj bo "nie pasuje dokładnie do przykładu".** **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.** | ODBIÓR_186_GEN4_TRESC.md (sekcja "Systemowe") zmierzył: pin bazy w teście dnia 186 skopiowany z zastanego testu dnia 83 (identyczny wzorzec `cx_day83:5955`) — defekt RODZINY testów prezentacji, nie pojedynczego dyżuru — i policzył: **"Licznik pinów Z31 w programie: 6 → dyżur 193: zbiorcze odpięcie (160, 164✓, 170✓, 171✓, 83, 186)"**, gdzie ✓ oznacza już naprawione przy dyżurach 164/170/171 (FIX-174/FIX-170/FIX-171 odpowiednio). Zostają nieodpięte: 160, 83, 186 — TRZY, nie sześć, bo trzy z sześciu już są zielone. Weryfikacja dziś potwierdza dokładne linie tych trzech ORAZ — sweepem tego samego wzorca po całym repo — znajduje CZTERY DODATKOWE, wcześniej niepoliczone piny (day168, day139, day159, day169; day139 i day159 mają dodatkowo pin CAŁEGO connection stringa, nie tylko database/port) — licznik programu "6" jest zaniżony, realny stan przed tym dyżurem to co najmniej 7 nieodpiętych. |

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
cd /private/tmp/cx-day193-piny

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day193-pg psql -U postgres -d cx193 \
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
cd /private/tmp/cx-day193-piny

docker run -d --name cx-day193-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx193 \
  -p 127.0.0.1:6113:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day193-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6113/cx193 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6113/cx193 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day193-piny && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6113/cx193 \
JWT_SECRET=cx193-test-secret-do-not-reuse \
npx vitest run server/src/**/__tests__, tests/ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day193-piny-artefakty/day193-vitest.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day193-piny && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/**/__tests__, tests/ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day193-piny-artefakty/day193-vitest.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day193-piny/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day193-pg psql -U postgres -d cx193 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day193-pg`.
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
> **(e) ★★ **Pierwsza: licznik "6" w ODBIOR_186 jest ZANIŻONY.** Sweep z pełnym wzorcem (T2+T3+T4 w §0) znajduje co najmniej CZTERY dodatkowe piny nieujęte w tamtym liczniku: `day168.kpi-bootstrap.pg.test.ts:38`, `day139.projectTextGovernance.pg.test.ts:35` (PLUS pin connection-stringa w linii 34 — DWA piny w jednym pliku), `day159.chunkOrgBackfill.pg.test.ts:42` (PLUS pin connection-stringa w linii 41 — też dwa), `day169.checkin-windows.pg.test.ts:46`. Nie zatrzymuj się na trzech znanych z brifu — R2 każe zrobić PEŁNY sweep, licznik programu nie jest sufitem. **Druga: trzy różne wzorce pinowania, nie jeden.** (a) `toEqual({ database: 'cxNNN', port: 5432 })` — porównanie całego obiektu; (b) `toBe('cxNNN')`/`toBe('cx_dayNN')` — porównanie samego stringa nazwy, zwykle w parze z osobnym `toBe('127.0.0.1')`/`toBe(PORT)`; (c) `expect(process.env.DATABASE_URL).toBe('postgresql://postgres:cx@127.0.0.1:PORT/cxNNN')` — pin CAŁEGO connection stringa, najgorszy przypadek bo łapie host+port+db+credentials w jednej asercji. Grep tylko po (a) i (b) — dosłownie z brifu — przegapi (c); "i podobne" w zleceniu oznacza właśnie ten trzeci wzorzec. **Trzecia: trzy gotowe wzorce naprawy już istnieją w repo, użyj ich literalnie, nie wymyślaj czwartego stylu.** FIX-171 (`day171.data-contracts.pg.test.ts:44,46`): `expect(target.rows[0].database.length).toBeGreaterThan(0); expect(target.rows[0].port).toBeGreaterThan(0);` — dla wzorca (a)/(b), gdy test i tak łączy się z realnym PG i tylko chce dowodu "to nie mock". FIX-174 (`day164.agent-dispatch-map.test.ts:89`): `expect(databaseUrl).toMatch(/^postgresql:\/\/[^/]+@(127\.0\.0\.1|localhost):\d+\/[^/]+$/);` — dla wzorca (c), gdy test chce dowodu "to lokalny realny Postgres", bez przypinania konkretnej nazwy/portu. FIX-170 (`day170.checkin-occurrences.pg.test.ts:18-19,51`): `const ARTIFACTS_DIR = process.env.DAY170_ARTIFACTS_DIR; const ARTIFACT = ARTIFACTS_DIR ? path.join(...) : null;` z zapisem chronionym `if (ARTIFACT && existsSync(...))` — dla PRZYPIĘTEJ ŚCIEŻKI ARTEFAKTÓW (osobna klasa od pinu bazy, ale ten sam duch: env zamiast twardego literału, pominięcie zamiast rzucenia). **Czwarta: day139 i day159 mają PODWÓJNY pin w jednym pliku** — sama naprawa `toEqual({database,port})` nie wystarczy, bo linia tuż nad nią (`process.env.DATABASE_URL).toBe('postgresql://...')`) pinuje to samo jeszcze raz, mocniej (cały string, nie tylko database+port) — napraw OBIE linie w każdym z tych dwóch plików, jedna naprawa bez drugiej zostawia test nadal nieprzenośnym. **Piąta: `assertRealPostgresTestEnvironment` (używana w większości tych testów) sama NIE pinuje nazwy/portu** — to osobna, już-bezpieczna funkcja pomocnicza sprawdzająca tylko "czy to realny PG, nie mock"; pin jest ZAWSZE w dodatkowej asercji NAD/POD jej wywołaniem, nie w niej samej — nie zmieniaj tej funkcji, szukaj pinu obok niej.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day193-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day193-piny-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`pozycja R1 — trzy piny znane z góry (day160, day83, day186); pozycja R2 — sweep repo za wzorcem i wypisanie WSZYSTKICH trafień; pozycja R3 — każdy odpięty test zielony na obcym, wspólnym kontenerze`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6113` albo `5058 i 5059` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6113` albo `5058 i 5059`** (`Z7`).

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

# 1. PO CO TEN DYŻUR ISTNIEJE

`ODBIÓR_186_GEN4_TRESC.md` (sekcja "Systemowe") zmierzył, że pin bazy w teście dnia 186
(`presentations.templateContent.day186.pg.test.ts`) był SKOPIOWANY z zastanego testu dnia
83 (`presentations.templatePptx.day83.pg.test.ts`) — identyczny wzorzec `cx_day83:5955`
przeklejony jako `cx186:6095`. To nie jest defekt jednego dyżuru, to defekt RODZINY testów
prezentacji: ktoś skopiował plik testowy razem z jego pinem, zamiast napisać przenośną
asercję od zera. Ten sam dokument policzył licznik programu:

> Licznik pinów Z31 w programie: 6 → dyżur 193: zbiorcze odpięcie
> (160, 164✓, 170✓, 171✓, 83, 186)

Znak ✓ oznacza już naprawione przy okazji innych dyżurów (164→FIX-174, 170→FIX-170,
171→FIX-171). Zostają nieodpięte trzy: **160, 83, 186** — to są TRZY znane na pewno
pozycje R1 tego dyżuru, ze zweryfikowanymi liniami:

- `server/src/routes/__tests__/day160.task-write-gate.pg.test.ts:68` —
  `expect(target.rows[0]).toEqual({ database: 'cx160', port: 5432 });`
- `server/src/routes/__tests__/presentations.templatePptx.day83.pg.test.ts:33-35` —
  `expect(proof.database).toBe('cx_day83'); expect(proof.host).toBe('127.0.0.1');
  expect(proof.port).toBe('5955');`
- `server/src/routes/__tests__/presentations.templateContent.day186.pg.test.ts:49-51` —
  `expect(proof.database).toBe('cx186'); expect(proof.host).toBe('127.0.0.1');
  expect(proof.port).toBe('6095');`

★ **Ale licznik "6" programu jest ZANIŻONY.** Sweep pełnego repozytorium za tym samym
wzorcem (i dwoma pokrewnymi, patrz R2) znajduje CZTERY dodatkowe, wcześniej niepoliczone
piny: `day168.kpi-bootstrap.pg.test.ts:38`, `day139.projectTextGovernance.pg.test.ts:35`
(plus DRUGI pin w linii 34 — cały connection string), `day159.chunkOrgBackfill.pg.test.ts:42`
(plus DRUGI pin w linii 41), `day169.checkin-windows.pg.test.ts:46`. Realny stan przed tym
dyżurem to co najmniej **7 nieodpiętych testów w 6 plikach** (day139 i day159 mają po
dwa piny każdy), nie 3. R2 tej instrukcji nie jest formalnością — jest głównym zadaniem.

# 2. TEZY ZLECENIA

- **T1.** Trzy piny nazwane wprost w zleceniu (160, 83, 186) są potwierdzone co do linii —
  odepnij je pierwsze, wzorem gotowych napraw FIX-171/FIX-174 (patrz R1).
- **T2.** Wzorzec pinowania ma TRZY warianty w repo, nie jeden: (a) `toEqual({ database:
  'cxNNN', port: PORT })`; (b) `toBe('cxNNN')`/`toBe('cx_dayNN')` w parze z osobnymi
  `toBe(HOST)`/`toBe(PORT)`; (c) `expect(process.env.DATABASE_URL).toBe('postgresql://...')`
  — pin całego connection stringa. Sweep musi pokryć wszystkie trzy, bo (c) nie pasuje do
  gerpów z brifu dosłownie ("i podobne" oznacza właśnie ten trzeci wariant).
- **T3.** Każdy odpięty test musi realnie przejść (zielono) na WSPÓLNYM, ale INNYM niż
  jego historyczny pin, kontenerze — sama zmiana asercji bez uruchomienia nie jest
  odpięciem, jest kosmetyką, którą następny audytor odkryje jako fałszywą zieleń.

# 3. POZYCJE DYŻURU

## R1 — trzy piny znane z góry

Dla każdego z trzech plików (day160, day83, day186) zamień pin na wzorzec ODPOWIADAJĄCY
temu, co dany test faktycznie sprawdza:

- Jeśli test tylko dowodzi "to realny Postgres, nie mock" (jak `day171.data-contracts.pg.test.ts`
  po FIX-171) — użyj tego samego wzorca: `expect(target.rows[0].database.length).toBeGreaterThan(0);
  expect(target.rows[0].port).toBeGreaterThan(0);` (dokładnie linie 44 i 46 tego pliku,
  skopiuj literalnie, dopasuj nazwę zmiennej do lokalnego kontekstu).
- day83 i day186 mają dodatkowo pin `.host).toBe('127.0.0.1')` — to część tego samego
  problemu, zdejmij razem z database/port, nie zostawiaj częściowo.

## R2 — sweep całego repo za wzorcem (i podobnymi)

Uruchom, i wypisz w raporcie WSZYSTKIE trafienia (nie tylko te już znane z R1):

```bash
grep -rn "toEqual({ database:" server/src tests
grep -rn "toBe('cx" server/src tests
grep -rn "DATABASE_URL).toBe('postgresql:" server/src tests
```

Dla każdego trafienia spoza R1, potwierdź czy to realny pin (asercja, która wymaga
DOKŁADNIE tej nazwy bazy/portu, i FAILuje/SKIPuje na innej) czy fałszywe trafienie
(np. porównanie w kodzie produkcyjnym, nie w teście — odsiej). Znane dziś dodatkowe
trafienia do potwierdzenia i odpięcia:

- `server/src/routes/__tests__/day168.kpi-bootstrap.pg.test.ts:38`
- `server/src/services/ai/__tests__/day139.projectTextGovernance.pg.test.ts:35` **oraz
  linia 34** (`DATABASE_URL).toBe('postgresql://postgres:cx@127.0.0.1:6023/cx139')`) —
  DWA piny w jednym pliku, napraw oba, jeden bez drugiego nie wystarcza
- `server/src/services/ai/__tests__/day159.chunkOrgBackfill.pg.test.ts:42` **oraz
  linia 41** (analogiczny pin connection stringa) — również dwa piny
- `server/src/services/resultsVnext/okr/__tests__/day169.checkin-windows.pg.test.ts:46`

Dla pinów wariantu (a)/(b) użyj wzorca FIX-171 (`toBeGreaterThan(0)` na długości nazwy i
na porcie). Dla pinów wariantu (c) — cały connection string — użyj wzorca FIX-174
(`day164.agent-dispatch-map.test.ts:89`): `expect(databaseUrl).toMatch(/^postgresql:\/\/[^/]+@(127\.0\.0\.1|localhost):\d+\/[^/]+$/);`
— dowodzi "to lokalny realny Postgres", bez przypinania konkretnej nazwy bazy/portu.

Jeśli sweep znajdzie test z pinowaną ścieżką artefaktów (osobna klasa od pinu bazy, ale
ten sam duch Z31) — użyj wzorca FIX-170 (`day170.checkin-occurrences.pg.test.ts:18-19,51`):
opcjonalny `process.env.<PREFIX>_ARTIFACTS_DIR`, `ARTIFACT = DIR ? path.join(...) : null`,
zapis chroniony `if (ARTIFACT && existsSync(...))` — na maszynie bez tej zmiennej test
POMIJA zapis zamiast rzucać ENOENT.

**Ukończone, gdy:** raport zawiera pełną listę trafień sweepu (plik:linia, wzorzec a/b/c,
decyzja), z uzasadnieniem dla każdego pominięcia (jeśli jakieś jest fałszywym trafieniem).

## R3 — każdy odpięty test zielony na obcym kontenerze

Postaw JEDEN wspólny kontener (nie jego pierwotny numer portu/nazwę bazy z historycznego
pinu) i uruchom na nim KAŻDY odpięty test z R1+R2 po kolei. Test wymagający specyficznego
seedu — postaw seed na tym samym wspólnym kontenerze przed uruchomieniem tego testu.
Test z głębszą zależnością od nazwy (np. ścieżka artefaktów, jak w FIX-170) — napraw wg
tego samego wzorca env-z-pominięciem.

Zbierz dowód: dla każdego z co najmniej 7 testów — nazwa pliku, wynik PRZED (czerwony/
skip na obcej bazie, z cytatem błędu) i PO (zielony, z liczbą `numTotalTests`/`numPassedTests`
z JSON-reportera, nie samą deklaracją "PASS").

**Ukończone, gdy:** wszystkie testy z R1+R2 przechodzą zielono na tym samym wspólnym
kontenerze (inna nazwa bazy i inny port niż ich historyczny pin), z dowodem PRZED/PO dla
każdego.

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis | `server/src/routes/__tests__/day160.task-write-gate.pg.test.ts` — wyłącznie asercja bazy/portu, linia ~68 |
| Zapis | `server/src/routes/__tests__/presentations.templatePptx.day83.pg.test.ts` — wyłącznie asercje bazy/hosta/portu, linie ~33-35 |
| Zapis | `server/src/routes/__tests__/presentations.templateContent.day186.pg.test.ts` — wyłącznie asercje bazy/hosta/portu, linie ~49-51 |
| Zapis | `server/src/routes/__tests__/day168.kpi-bootstrap.pg.test.ts` — wyłącznie asercja bazy/portu, linia ~38 |
| Zapis | `server/src/services/ai/__tests__/day139.projectTextGovernance.pg.test.ts` — wyłącznie asercje bazy/portu/connection stringa, linie ~34-35 |
| Zapis | `server/src/services/ai/__tests__/day159.chunkOrgBackfill.pg.test.ts` — wyłącznie asercje bazy/portu/connection stringa, linie ~41-42 |
| Zapis | `server/src/services/resultsVnext/okr/__tests__/day169.checkin-windows.pg.test.ts` — wyłącznie asercja bazy/portu, linia ~46 |
| Zapis | dowolny DODATKOWY plik `*.pg.test.ts`/`*.realpg.test.ts`/`*.realdb.test.ts` znaleziony w sweepie R2, WYŁĄCZNIE linia(e) asercji pinu — licencja rozszerza się automatycznie na każde potwierdzone trafienie sweepu, nie tylko listę powyżej |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY193_PINY_Z31_REPORT.md` z pełną listą sweepu i dowodami PRZED/PO |
| Odczyt | `server/src/routes/__tests__/day171.data-contracts.pg.test.ts` — wzorzec FIX-171; nie zmieniasz |
| Odczyt | `server/src/workers/__tests__/day164.agent-dispatch-map.test.ts` — wzorzec FIX-174; nie zmieniasz |
| Odczyt | `server/src/routes/__tests__/day170.checkin-occurrences.pg.test.ts` — wzorzec FIX-170; nie zmieniasz |
| Odczyt | `tests/integration/_helpers/assertRealPostgres.ts` — wspólny strażnik środowiska, sam NIE pinuje nazwy/portu; nie zmieniasz |
| Odczyt | `docs/program/funkcje/ODBIOR_186_GEN4_TRESC.md` — dowód zlecenia; nie zmieniasz |

**Nietykalne imiennie:** logika biznesowa/seedy/mutacje w KAŻDYM z powyższych plików poza
samą asercją pinu; `tests/integration/_helpers/assertRealPostgres.ts` (strażnik środowiska,
osobna funkcja od pinu — nie myl); własny kontener `cx-day193-pg`/6113 jako NOWY pin w
miejsce starego — testy po naprawie mają działać na DOWOLNYM realnym Postgresie.

★ **Rozłączność z dyżurami działającymi równolegle w tej samej partii:** 188 (backend
Partnera), 189 (i18n Partnera) — zero pokrycia plikowego z tym dyżurem, ten dyżur jest
czysto testowy/przekrojowy.

# 5. TWARDE ZASADY

- ★ **Nie zmieniasz treści testu poza asercją bazy/portu/connection stringa.** Zero
  dotyku seedów, mutacji, logiki biznesowej sprawdzanej przez test.
- **Nie kasujesz testów padających z innego powodu niż pin** (np. day186 ma zastane
  FAIL-e mappera niezwiązane z tym dyżurem — zostają, nie w zakresie).
- **Nie wprowadzasz nowego pinu w miejsce starego** — testy po naprawie działają na
  dowolnym realnym Postgresie, nie tylko na `cx193`/6113.
- **Sweep (R2) nie jest opcjonalny** — jeśli znajdziesz wzorzec spoza trzech znanych,
  odepnij go, nie pomijaj bo "nie było w brifie dosłownie".
- **Każdy odpięty test MUSI realnie przejść zielono na obcym kontenerze** — deklaracja
  bez uruchomienia nie jest dowodem.
- **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.**
- Pułapka: `No test files found` NIE jest `PASS`. Sprawdź `numTotalTests` > 0 w każdym
  wyniku przywoływanym jako dowód.
- ★ Port **5000 zajęty na stałe przez macOS Control Center**, port **5037 przez adb**.
- Wymóg sekcji „TWIERDZENIA NIEZWERYFIKOWANE" w raporcie końcowym — wypisz w niej wprost,
  jeśli sweep nie objął całego `server/src/**/__tests__` i `tests/` (np. pominąłeś jakiś
  podkatalog), albo jeśli któryś odpięty test wymagał seedu, którego nie zdążyłeś
  odtworzyć na wspólnym kontenerze i został pominięty w R3.
