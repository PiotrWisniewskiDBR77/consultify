# INSTRUKCJA DYŻURU nr 272 — Codex — „★★ INICJATYWY — CICHE ZAPISY, DOWÓD KONKRETNY. Test `day241.lazy-fields-audit-gap.pg.test.ts` z raportu `CODEX_DAY241_INICJATYWY_REPORT.md` **NIE ISTNIEJE** na tym markerze (dyżur 241 wszedł jako `DOC_EVIDENCE_ONLY`) — **ODTWARZASZ GO** z opisu w raporcie: `PUT /api/initiatives/:id` z ciałem zawierającym WYŁĄCZNIE `hypothesisStatement` zapisuje wartość (kolumna `hypothesis_statement`), ale `initiative_history` idzie 0→0. Przyczyna zmierzona w kodzie: `InitiativeController.ts` `updateInitiative` (linia 741), pętla `LAZY_FIELDS` (linie 998-1023) pcha do `updates`/`params` (SQL), ale **NIGDY** do `changes` (tablica zadeklarowana w linii 926, zasilana w liniach 942/967 dla innych pól) — a linia ok. 1055 loguje do `initiative_history` TYLKO `if (changes.length > 0)`. Druga część: **sweep** `10` surowych `UPDATE initiatives` w `InitiativeController.ts` — zmierzone bezpośrednio: `submitForReview` (~2132, status→'review', ŻADEN audyt w promieniu 45 linii, trasa NIE jest objęta `requireCanonicalInitiativeExecutionWriter`) to POTWIERDZONA żywa cicha ścieżka; `blockInitiative` (~2385, status→'blocked', komentarz w kodzie WPROST przyznaje brak `initiative_history`) ma trasę `POST /:id/block` OBJĘTĄ `router.use(requireCanonicalInitiativeExecutionWriter)` (`pmo/initiatives.routes.ts:160`, wzorzec `LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS` w `executionSpineLegacyReadOnly.middleware.ts` zawiera `block|unblock|start-execution|move`) — **KANDYDAT NA MARTWY KOD za middleware'em zwracającym `409`**, wymaga dowodu HTTP, nie zgadywania. CZTERY lokalizacje z pierwotnego brifu nadzorcy (`executionControl.routes.ts:261`, `v8/execution-control.routes.ts` pole `status`, `jobs/initiativeAutoStartJob.ts`, `DecisionController.ts:347`) zmierzone bezpośrednio w kodzie jako **JUŻ NAPRAWIONE** (komentarze `INI-005 fix, 2026-08-01` / `INI-005 follow-up fix` — trzy z nich idą dziś przez `executeInitiativeTransition`, czwarta pisze do ISTNIEJĄCEGO `execution_audit_log` z jawną blokadą pola `status`) — patrz `§ Sprostowania nadzorcy`, TA INSTRUKCJA ICH NIE NAPRAWIA PONOWNIE."

Dokument samodzielny. Zakładam, że dostajesz **TYLKO ten plik** i repozytorium
Consultify. Nie masz dostępu do rozmowy, w której powstał, ani do instrukcji
poprzednich dyżurów. Wszystko, czego potrzebujesz, jest poniżej albo pod
wskazanymi ścieżkami w repo.

> ### ★★ ZAKAZ NR 1 — KATALOG WŁAŚCICIELA. CZYTASZ TO, ZANIM URUCHOMISZ COKOLWIEK.
>
> **Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani
> do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`.
> Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**
> wg `DEC-2026-08-26-86`. Twoje miejsce pracy to **wyłącznie**
> `/private/tmp/cx-day272-inicjatywy-audyt`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `444d789363`**
> **Gałąź bazowa: `github-backup/integracja/20260902`**
> **Stan dokumentu: WYDANY**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo jakiekolwiek niewypełnione pole szablonu —
> **dokument nie jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.

Data wystawienia: 2026-09-02.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.
Zakres: **Inicjatywy — ciche zapisy przez ślad audytu. Odtworzenie i naprawa luki `LAZY_FIELDS`; ograniczony, imiennie wyliczony sweep pozostałych surowych `UPDATE initiatives` w `InitiativeController.ts`; para testowa „obcy nie widzi / właściciel widzi" na realnym łańcuchu wzorem `day31.canonical-writer-contract.pg.test.ts`.**
Trasy front: `brak w zakresie ZAPISU tego dyżuru — przekrojowy backend`.
Trasy tył: `server/src/controllers/InitiativeController.ts` (rdzeń — `updateInitiative` linie 741-1075, `submitForReview` ~2100-2145, `blockInitiative` ~2370-2400, `approveInitiative` ~2200-2260, `archiveInitiative` ~2760-2800; **PEŁNA LICENCJA WYŁĄCZNIE w zakresie pozycji `§A.2`/`§A.3` niżej**) · `server/src/middleware/executionSpineLegacyReadOnly.middleware.ts` (odczyt + **WĄSKA LICENCJA** — dokładnie jedna linia w `LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS`, TYLKO jeśli `§A.3` wybierze wariant „zamknięcie 409") · `server/src/services/initiative/initiativeTransitionService.ts` (odczyt — wzorzec audytu `initiative_history`) · `server/src/routes/pmo/initiatives.routes.ts` (odczyt — mapa tras/middleware) · `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY241_INICJATYWY_REPORT.md` (odczyt, materiał wiążący) · `server/src/routes/pmo/__tests__/day31.canonical-writer-contract.pg.test.ts` (odczyt — wzorzec pary „obcy/właściciel").

---

## ★ SPROSTOWANIA NADZORCY (zmierzone bezpośrednio w kodzie, różnią się od pierwotnego brifu)

Pierwotny brief nadzorcy wskazywał PIĘĆ lokalizacji jako „ciche/nieaudytowane
zapisy statusu". Bezpośredni odczyt kodu na markerze `444d789363` pokazuje, że
**CZTERY z pięciu są już naprawione**:

1. **`server/src/routes/v8/execution-control.routes.ts`** (komentarz przy
   `TIMELINE_UPDATABLE_FIELDS`, „INI-005 follow-up fix (2026-08-01)"): pole
   `status` zostało **usunięte** z listy pól, które ten endpoint może zapisać
   — próba `{field:'status',...}` dostaje `400 TIMELINE_UPDATE_STATUS_FORBIDDEN`.
2. **`server/src/jobs/initiativeAutoStartJob.ts`** (komentarz „INI-005 fix"):
   job **nie pisze już** `initiatives.status` sam — deleguje do
   `executeInitiativeTransition` przez systemowego aktora.
3. **`server/src/controllers/DecisionController.ts:347`**
   (`refreshInitiativeDecisionBlock`): komentarz opisuje HISTORYCZNY błąd,
   sekcja „FIX" niżej pokazuje, że dziś przechodzi przez
   `executeInitiativeTransition` (bramka UNBLOCK).
4. **`server/src/routes/executionControl.routes.ts:261`** (`/timeline-update`):
   endpoint jest `admin`-only, **jawnie odrzuca** pole `status` (`400`), a
   każdy zapis pisze do `execution_audit_log` (osobna, istniejąca tabela
   audytowa — nie `ie_audit_events`, ale funkcjonalnie realny ślad z
   `old_value`/`new_value`/`changed_by`). To NIE jest cicha ścieżka.

**Ta instrukcja NIE dotyka żadnego z tych czterech plików w zakresie zapisu**
(dozwolony wyłącznie odczyt jako kontekst). Jeśli Twój własny pomiar w `R1`
pokaże co innego niż powyższe cztery punkty — to jest WYNIK, nie sprzeczność
(`Z24`): wpisz do „Korekt wobec instrukcji" i **wtedy** rozważ, czy dana
lokalizacja wchodzi do sweepu `§A.3` (patrz procedura tam).

**Piąta lokalizacja z brifu — `LAZY_FIELDS` w `InitiativeController.ts` —
JEST POTWIERDZONA jako żywa luka i jest rdzeniem tego dyżuru (`§A.1`/`§A.2`).**

---

### 0.1. ★★ BAZA PRACY, MARKER I GAŁĄŹ — PROCEDURA DOSŁOWNA, Z VAULTA

```bash
VAULT=/Users/piotrwisniewski/Developer/consultify-recovery-vault-20260820.git
WT=/private/tmp/cx-day272-inicjatywy-audyt
MARKER=444d789363

# (0) miejsce na dysku
df -h /

# (1) fetch WYLACZNIE z github-backup
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/integracja/20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/integracja/20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree
git -C "$VAULT" worktree add "$WT" -b codex/day272-inicjatywy-audyt-20260902 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day272-inicjatywy-audyt/config.worktree"
cat "$VAULT/worktrees/cx-day272-inicjatywy-audyt/config.worktree"

# (5) node_modules przez SYMLINK
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day272-inicjatywy-audyt-scratch
mkdir -p /private/tmp/cx-day272-inicjatywy-audyt-artefakty

# (7) sanity
git -C "$WT" rev-parse HEAD
git -C "$WT" status --short | head -3
```

**Wynik komend (2) i (7) wklejasz do raportu dosłownie.**

> **★★ PUŁAPKA — REMOTE `icloud-source` JEST MARTWY.** Nie wołaj
> `git fetch --all`. Jego błąd nie jest powodem do STOP-u.

**★★ REGUŁA ROZEJŚCIA.** Marker nieprzodek/gałąź nieistniejąca → STOP całego
dyżuru. Marker przodek, tip uciekł do przodu → NIE STOP, startujesz z markera,
wpisujesz do raportu `git log --oneline 444d789363..github-backup/integracja/20260902`.
**Rebase zakazany.** **Nie pushujesz sam** — nadzorca po odbiorze.

**Komenda bazowa dla listy dotkniętych plików:**

```bash
git -C "$WT" diff --name-only 444d789363..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `10` komend, wszystkie obowiązkowe.**

```bash
cd "$WT"

# (1) TEZA: test day241.lazy-fields-audit-gap.pg.test.ts NIE ISTNIEJE
find . -iname "*lazy-fields*" -not -path "*/node_modules/*"
#   oczekiwane: 0 wynikow

# (2) TEZA: LAZY_FIELDS petla NIE zasila `changes` (updateInitiative)
sed -n '920,1025p' server/src/controllers/InitiativeController.ts
#   oczekiwane: `const changes` linia ok. 926; `changes.push` na liniach ok. 942, 967;
#   PETLA `for (const f of LAZY_FIELDS)` (ok. 1005-1023) NIE ZAWIERA `changes.push`

# (3) TEZA: initiative_history logowanie jest warunkowe `if (changes.length > 0)`
sed -n '1050,1075p' server/src/controllers/InitiativeController.ts
#   oczekiwane: `if (changes.length > 0) { ... INSERT INTO initiative_history ... }`

# (4) TEZA: submitForReview (~2132) to surowy UPDATE bez audytu w poblizu
sed -n '2115,2145p' server/src/controllers/InitiativeController.ts
grep -n "initiative_history\|ie_audit_events" <(sed -n '2100,2180p' server/src/controllers/InitiativeController.ts)
#   oczekiwane: `UPDATE initiatives SET status='review'...`; drugi grep -> 0 trafien

# (5) TEZA: blockInitiative (~2385) ma komentarz przyznajacy brak audytu, ALE
#     trasa POST /:id/block jest objeta requireCanonicalInitiativeExecutionWriter
sed -n '2365,2400p' server/src/controllers/InitiativeController.ts
grep -n "router.use(requireCanonicalInitiativeExecutionWriter)" server/src/routes/pmo/initiatives.routes.ts
grep -n "block\|unblock\|start-execution\|move" server/src/middleware/executionSpineLegacyReadOnly.middleware.ts | head -5
#   oczekiwane: komentarz "Converting blockInitiative to a thin adapter is real,
#   necessary follow-up work"; router.use na linii ok. 160; wzorzec regex zawiera
#   "start-execution|block|unblock|move"

# (6) TEZA: cztery lokalizacje z brifu sa JUZ naprawione (patrz Sprostowania nadzorcy)
grep -n "TIMELINE_UPDATE_STATUS_FORBIDDEN" server/src/routes/v8/execution-control.routes.ts
grep -n "executeInitiativeTransition" server/src/jobs/initiativeAutoStartJob.ts
grep -n "executeInitiativeTransition" server/src/controllers/DecisionController.ts
grep -n "execution_audit_log" server/src/routes/executionControl.routes.ts
#   oczekiwane: wszystkie cztery greps NIEPUSTE

# (7) TEZA: ie_audit_events i initiative_history istnieja jako tabele
grep -rn "CREATE TABLE.*ie_audit_events" server/migrations/932_initiatives_execution_material_commands.sql
grep -rln "CREATE TABLE.*initiative_history" server/migrations/
#   oczekiwane: obie definicje istnieja

# (8) TEZA: initiativeTransitionService.ts jest wzorcem audytu poprawnego
grep -n "INSERT INTO initiative_history" server/src/services/initiative/initiativeTransitionService.ts
#   oczekiwane: co najmniej 1 trafienie

# (9) TEZA: day31.canonical-writer-contract.pg.test.ts to wzorzec pary obcy/wlasciciel
grep -n "describe(\|it(" server/src/routes/pmo/__tests__/day31.canonical-writer-contract.pg.test.ts | head -10
#   oczekiwane: co najmniej jeden `it` sprawdzajacy status 401/403/404 dla obcego
#   tenanta i co najmniej jeden sprawdzajacy sukces dla wlasciciela

# (10) miejsce na dysku
df -h /
#   oczekiwane: powyzej 5 GB wolnego
```

---

### §0.4a — pomiar zasięgu testów (warunek oddania raportu, patrz `Z24`)

1. PRZED zmianami: uruchom pakiety wskazane w licencji z `--reporter=json`,
   zapisz `przed-nazwy.txt` (po jednej pełnej nazwie testu na wiersz).
2. PO zmianach: to samo do `po-nazwy.txt`.
3. `diff przed-nazwy.txt po-nazwy.txt` w raporcie — dodane/zniknięte nazwy.
4. Przepisanie liczby z instrukcji/cudzego raportu = zawyżenie. Liczysz sam.

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`.** Ten dyżur NIE PUSHUJE W OGÓLE | Push wykonuje wyłącznie nadzorca |
| `Z2` | **Nie zmieniasz/pushujesz** `origin/demo`, `Londyn`, `integracja/20260902`, cudze gałęzie. Odczyt dozwolony | Cudze tory w toku |
| `Z3` | **Żadnego `--force`, `reset --hard` na gałęziach współdzielonych, żadnego `rebase`** | Krach 3/4 |
| `Z4` | **Nie czytasz/kopiujesz WIP właściciela ani `server/src/_backup/**`** | Śmietnik kolizji |
| `Z5` | **★★ Nie dotykasz `/Users/piotrwisniewski/Developer/Consultify`** poza symlinkiem | STOP dyżuru 53 |
| `Z6` | **Nie dotykasz cudzych worktree** poza własnymi | Żyje ich ponad 100 |
| `Z7` | **★★ Port bazy `6284`. Port harnessu `5264 i 5265`.** Kontener: **`cx-day272-pg`**. Zajęte na stałe: 5000, 5037, 5060-5061. Zajęte przez inne prace: 6012, 5433, 6047, 6054-6282, 5010-5263, 6404-6411, 6600-6830. Cudze — paczka 270-273: baza 6280 harness 5260-5261 (270) · baza 6282 harness 5262-5263 (271) · baza 6286 harness 5266-5267 (273). Sprawdzasz sam | Trzy incydenty zapisu do cudzej bazy |
| `Z8` | **Zero interakcji z Railway** | Produkcja NIETYKALNA |
| `Z9` | **Żadnej bazy poza lokalnym kontenerem** | Baza demo/staging to JEDNA baza |
| `Z10` | **★★ Zero nowych flag funkcyjnych.** Ten dyżur ich nie potrzebuje — naprawa audytu nie jest zmianą widoczną w UI | Krach 07-12 |
| `Z11` | **NIE DOTYCZY** — zero nowych ekranów, dyżur zapleczowy | `CLAUDE.md` reguła 7 |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne bezwzględnie: `server/src/middleware/auth.middleware.ts` · `server/src/database/Database.ts` · `vitest.config.ts` · `tests/setup.ts`. **`executionSpineLegacyReadOnly.middleware.ts` ma WĄSKI wyjątek opisany w `§A.3`** — dokładnie jedna linia w tablicy ścieżek, żadna zmiana logiki funkcji | Pliki przekrojowe |
| `Z13` | **Dokładnie JEDEN plik raportu:** `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY272_INICJATYWY_REPORT.md`. Zrzuty/logi w `/private/tmp/cx-day272-inicjatywy-audyt-artefakty` | Dokumentacja rośnie szybciej niż produkt |
| `Z14` | **Nie zmieniasz `OWNER_DECISION_LEDGER_2026-08-24.md`** | SSOT decyzji właściciela |
| `Z15` | **Zero modelu językowego** | `DEC-51` |
| `Z16` | **Nie usuwasz uczciwych stanów pustych/409** | Zero placebo |
| `Z17` | **Zakaz wszystkiego poza zakresem** | Podział z dyżurami równoległymi |
| `Z18` | **★★ NAJOSTRZEJSZY — zakaz globalnej infrastruktury testowej** | Jedna zmiana fałszuje cały korpus |
| `Z19` | **Nie odmontowujesz routera/middleware/joba CI.** Jeśli `§A.3` uzna `blockInitiative` za martwy kod za middleware'em 409 — **NIE USUWASZ** ani handlera, ani trasy, ani middleware'u; dokumentujesz w raporcie | Bramki znikają łatwiej niż wracają |
| `Z20` | **★★ ZAKAZ testów DB bez pełnego env w tej samej linii.** NAJPIERW kontener + migracje, DOPIERO pomiar | Trzy incydenty zapisu do cudzej bazy |
| `Z21` | **DoD wymaga DOWODU OSIĄGALNOŚCI** — realny HTTP przez `ApiGateway`, nie tylko wywołanie funkcji | Istnienie kodu ≠ działanie |
| `Z22` | **★★ Test montujący router w gołym `express()` NIE dowodzi ścieżki produkcyjnej.** Dowód: `ApiGateway.getInstance().initializeRoutes(app)` | Replika rozjeżdża się z produkcją |
| `Z23` | **★★ ZERO ATRAP.** `200` z pustą kopertą tam, gdzie zapytanie padło, jest atrapą | `DEC-51` |
| `Z24` | **Pomiar zasięgu wg `§0.4a` jest warunkiem raportu** | Liczby krążą i utrwalają się jako fakt |
| `Z25` | **★★ Testy realdb WYŁĄCZNIE z jawnym `DATABASE_URL`** | Port 5432 nasłuchuje i nie jest Twój |
| `Z26` | **★★ Komplet env w tej samej linii — `§0.2c`** | Tak zginął dzień 23 |
| `Z27` | **★★ ZAKAZ `git stash`.** `cp` do `/private/tmp/cx-day272-inicjatywy-audyt-scratch` | Schowek współdzielony |
| `Z28` | **★★ ZERO POŁĄCZEŃ DO RAILWAY, DEMO, STAGINGU I PRODUKCJI** | Jedyny zakaz zatrzymujący CAŁY dyżur |
| `Z29` | **★★ Testy „atak odrzucony" BEZ PONAWIANIA: `--retry=0`** | `retry: CI?3:1` |
| `Z30` | **★★ ZAKAZ REALNEJ WYSYŁKI** — `§0.2b` | Nieodwracalne |
| `Z31` | **★★ ZAKAZ PRZYPINANIA STRAŻNIKA REALDB DO HOSTA/PORTU/BAZY** | Dyżur 43: 30 SKIP |
| `Z32` | **★★ ZAKAZ `FIXED` BEZ DOWODU MUTACYJNEGO W OBIE STRONY.** `§A.2`: cofnij `changes.push` w LAZY_FIELDS → test **CZERWONY**; przywróć → **ZIELONY**; `git diff` po przywróceniu **pusty** | Dyżur 44: FIXED bez podatności |
| `Z33` | **★★ SPRAWDŹ, CZY STRAŻNIK SIĘ NIE WYŁĄCZA SAM W TESTACH** — `§0.2e` | 416 fałszywych twierdzeń |
| `Z34` | **★★ GREP DOWODZI, ŻE ISTNIEJE, NIE ŻE DZIAŁA.** „Działa" tylko po realnym `PUT`/`POST` przez `ApiGateway`, realnym Postgresie, po sprawdzeniu wiersza w `initiative_history` | ÓSMY kształt fałszywego gotowe |
| `Z34a` | **NIE DOTYCZY** — brak pushu | — |
| `Z35` | **Zakaz naprawiania przez wyciszanie** | Choroba, którą program leczy |
| `Z36` | **Zakaz `eslint --fix`/`prettier --write` szerzej niż zmieniany plik** | Autofix niszczy pracę równoległą |
| `Z37` | **Porównania testów po NAZWACH, nie liczbach** | Wektor maskowania regresji |
| `Z38` | **Zakaz usuwania jobów CI** | Bramki znikają łatwiej niż wracają |
| `Z39` | **Zakaz uruchamiania realnych workflow GitHub Actions** | Dotyka sekretów poza kontrolą |
| `Z40` | **ZAKAZ ponownej naprawy czterech lokalizacji z `§ Sprostowania nadzorcy`** — są już naprawione, dotykasz ich WYŁĄCZNIE do odczytu jako kontekstu. **ZAKAZ budowy wariantu C** (osobny rejestr zatwierdzeń) — jawnie odłożony decyzją właściciela. **ZAKAZ przemiatania całych ~100 pozostałych plików** — sweep `§A.3` ograniczony do 10 wywołań `UPDATE initiatives` w `InitiativeController.ts`, reszta idzie do raportu jako INWENTARZ z klasyfikacją bez zmian, nie jako naprawa tego dyżuru. **ZAKAZ usuwania `blockInitiative`/jego trasy**, nawet jeśli sweep potwierdzi martwy kod — to dokumentacja, nie sprzątanie (`Z19`) | `CODEX_DAY241_INICJATYWY_REPORT.md` R1 wylicza mianowniki, nie całą powierzchnię; wariant B (runtime-v1 + ie_audit_events dla osiągalnych cichych ścieżek) jest jedyną zamówioną architekturą |

---

### 0.2b. ★★ PROTOKÓŁ `Z30`

**(1) Zakaz:** `SMTP_*`/`RESEND`/`SENDGRID`/`MAIL*` w env/`.env*`/`docker-compose*`;
wiersz SMTP w `settings`; pełny `server/src/index.ts` na testy; ręczne `drain*`.

**(2) Dowody:**

```bash
cd /private/tmp/cx-day272-inicjatywy-audyt
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"
docker exec cx-day272-pg psql -U postgres -d cx272 \
  -c "SELECT key, left(coalesce(value,''),8) FROM settings WHERE key LIKE 'smtp%';"
#   oczekiwane: 0 wierszy albo "relation settings does not exist"
```

**(3) Deklaracja obowiązkowa w raporcie, dosłownie:** **„Nie ustawiłem żadnej
zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy
konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego
drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało
wysłane."**

---

### 0.2c. ★★ KOMPLET ZMIENNYCH ŚRODOWISKOWYCH — TRZY WARIANTY, ZAWSZE W JEDNEJ LINII

**(A) MIGRACJE — pełny łańcuch (`Z20`), ten dyżur NIE dodaje migracji, ale
BAZA musi być świeża i pełna, żeby `initiative_history`/`ie_audit_events`
istniały:**

```bash
cd /private/tmp/cx-day272-inicjatywy-audyt

docker run -d --name cx-day272-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx272 \
  -p 127.0.0.1:6284:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji

until docker exec cx-day272-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6284/cx272 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6284/cx272 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**(B) PAKIETY DOTYKAJĄCE BAZY (HTTP przez `ApiGateway`):**

```bash
cd /private/tmp/cx-day272-inicjatywy-audyt && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6284/cx272 \
JWT_SECRET=cx272-test-secret-do-not-reuse \
npx vitest run server/src/controllers/__tests__/day272-lazy-fields-audit-gap.pg.test.ts \
  server/src/controllers/__tests__/day272-silent-writes-foreign-owner.pg.test.ts --retry=0 \
  --config server/vitest.config.ts \
  --reporter=json --outputFile=/private/tmp/cx-day272-inicjatywy-audyt-artefakty/day272-pakiet.json
```

**Znaczenie każdej zmiennej:**

| Zmienna | Co się stanie, gdy jej zabraknie |
| --- | --- |
| `RUN_DB_TESTS=1` | testy DB pominięte, `exit 0` fałszywy |
| `MOCK_DB=false` | odczyty cicho na atrapę |
| `DB_TYPE=postgres` | `vitest.config.ts` przybija `sqlite` |
| `NODE_ENV=test` | runner migracji odmawia/MOCK |
| `ENABLE_V8_GLOBAL=true` | fałszywe `404` przed uwierzytelnieniem, JEŚLI trasa jest v8 — `InitiativeController` jest montowany przez PMO router, zmierz w `R1` czy dotyczy |
| `ENABLE_TEST_AUTH_BYPASS=false` | `verifyToken` omijany |
| `DATABASE_URL` | fallback na `localhost:5432`, nie Twój |
| `JWT_SECRET` | podpisany JWT nie przejdzie |
| `--retry=0` | test „atak odrzucony" leczy się skutkiem ataku |

---

### 0.2d. ★★ ZNANE PUŁAPKI ŚRODOWISKA — OSIEMNAŚCIE

1. Vault BARE + `worktreeConfig=true` — krok (4) w `§0.1`.
2. `icloud-source` MARTWY, nie `fetch --all`.
3. Host bez `psql` — `docker exec cx-day272-pg psql -U postgres -d cx272 -c '…'`.
4. Runner migracji wymaga `NODE_ENV=test`.
5. `vitest.config.ts` przybija `DB_TYPE='sqlite'` — nadpisz w tej samej linii.
6. `JSON.parse` na `json` działa na SQLite, wywala `500` na PG.
7. CI nie uruchamia testów naszych gałęzi — nie jest dowodem.
8. `docker rm -f` bez `-v` nie kasuje wolumenu — `docker rm -fv cx-day272-pg`.
9. Reporter `basic` nie istnieje.
10. `npx vitest run` bywa `exit 0` mimo czerwonych testów.
11. Nowe pliki w `__tests__/` wymagają `git add -f`.
12. `| head` na grepie sierot produkuje fałszywe sieroty.
13. ESM nie honoruje `NODE_PATH`.
14. `github-backup` nie ma `main`/`develop`/`Londyn`/`demo`.
15. `postgres:15` nie przechodzi migracji — `pgvector/pgvector:pg16`.
16. `prettier` na wielkich plikach potrafi przepisać cały plik.
17. Testy tekstowe przez `readFileSync`+`toContain` na dosłownych liniach.
18. `npx vitest` z roota bez configu — `No test files found` to nie `PASS`.

---

### 0.2e. ★★ RAMKA DO `Z33`

> **(a) `ENABLE_V8_GLOBAL` nieustawione → fałszywe `404`.** DOTYCZY, jeśli
> Twoje testy `§A.1`/`§A.4` idą przez realny HTTP na trasę zamontowaną pod
> bramką V8 — zmierz w `R1`: `grep -n "v8FeatureGate\|ENABLE_V8_GLOBAL" server/src/routes/pmo/initiatives.routes.ts server/src/Gateway.ts`.
>
> **(b) `resultsInternalBetaVisibility.middleware.ts`.** Zmierz czy leży na
> ścieżce `pmo/initiatives.routes.ts` — jeśli 0 trafień, „nie dotyczy" z
> dowodem.
>
> **(c) `vitest.config.ts` `DB_TYPE='sqlite'`.** DOTYCZY — `DB_TYPE=postgres`
> w tej samej linii, dowód: `expect(process.env.DB_TYPE).toBe('postgres')`
> w pierwszym `it`.
>
> **(d) `ENABLE_TEST_AUTH_BYPASS`.** DOTYCZY dla testów HTTP z tokenem.
>
> **(e) ★★ PUŁAPKA WŁAŚCIWA TEMU DYŻUROWI —
> `requireCanonicalInitiativeExecutionWriter` gasi `blockInitiative` PRZED
> handlerem.** Test HTTP na `POST /:id/block` dostanie `409
> EXECUTION_RUNTIME_V1_WRITE_REQUIRED` niezależnie od tego, co jest w środku
> kontrolera — **to NIE jest dowód, że kontroler jest naprawiony**, to dowód,
> że middleware gasi trasę. Żeby zmierzyć REALNY stan kodu kontrolera,
> potrzebujesz albo testu jednostkowego wołającego `blockInitiative` wprost
> (z zamockowanym `req`/`res`, poza `ApiGateway` — dopuszczalne WYŁĄCZNIE dla
> tego jednego pomiaru „czy kod w środku jest martwy", **nie** jako dowód
> ścieżki produkcyjnej, `Z22`), albo jawnego stwierdzenia w raporcie: „nie
> zmierzyłem stanu wnętrza `blockInitiative`, bo middleware gasi trasę
> produkcyjną — to samo w sobie jest wystarczającym dowodem martwoty na
> ścieżce HTTP".
>
> **Obowiązek dowodowy.** Dla każdego pakietu: akapit *która pułapka
> dotyczy, jak wyłączona, co dowodzi*. „Nie dotyczy" tylko z komendą-dowodem.

---

### 0.5. Reguła STOP

**MERYTORYCZNY** (mile widziany) vs **PROCEDURALNY** (zakazany) — jak w
metodyce programu. Poniżej działania zastępcze:

| Powód | Co robisz ZAMIAST STOP-u |
| --- | --- |
| „Musiałbym zmienić plik przekrojowy" | Czerwony kontrakt + brief. Pozycja **ZROBIONA** |
| „Plik nie jest w tabeli licencji" | Tylko do odczytu + czerwony kontrakt + brief |
| „Instrukcja sprzeczna" | Sekcja „JEŚLI COŚ JEST SPRZECZNE" |
| „Ścieżka nie istnieje" | `ls`, wpis do Korekt, szukasz odpowiednika |
| „Dwie różne liczby" | Twój pomiar wiąże (`Z24`) |
| „`icloud-source` błąd" | Nie jest błędem |
| „`psql` nie istnieje" | `docker exec cx-day272-pg psql …` |
| „Hook blokuje commit" | Naprawiasz kodem, `--no-verify` zakazany |
| „Musiałbym odłożyć stan" | `cp` do scratcha |
| „Test przeszkadza" | Nie osłabiasz asercji |
| „Nie zdążę wszystkiego" | Rdzeń (`§A.1`, `§A.2`) + uczciwy opis reszty |
| „Port `6284`/`5264-5265` zajęty" | **STOP całości** |
| „`blockInitiative` wygląda na martwy kod" | **To NIE jest powód do STOP-u ani do naprawy** — dokumentujesz w `§A.3`, `Z19`/`Z40` zakazują usuwania |

**Zatrzymanie CAŁEGO dyżuru wyłącznie przy:** `MARKER BRAK` · połączeniu do
bazy zdalnej (`Z28`) · ryzyku utraty danych/wysyłce (`Z30`) · <5 GB dysku ·
zajętym porcie `6284`/`5264`/`5265` (`Z7`).

---

## B.1. TABELA LICENCJI PLIKOWYCH

> **★★ ZASTRZEŻENIE.** Plik nieopisany w tabeli jest domyślnie TYLKO DO
> ODCZYTU; produktem jest czerwony kontrakt + brief, **nie zatrzymanie
> dyżuru**.

| Plik / wzorzec | Licencja | Co robisz, gdy pozycja wymagałaby zmiany pliku TYLKO-DO-ODCZYTU |
| --- | --- | --- |
| `server/src/middleware/auth.middleware.ts`, `server/src/database/Database.ts`, `vitest.config.ts`, `tests/setup.ts` | **TYLKO ODCZYT — BEZWZGLĘDNIE** | Czerwony kontrakt + brief |
| `server/src/controllers/InitiativeController.ts` | **★ WĄSKA LICENCJA:** wyłącznie (a) pętla `LAZY_FIELDS` w `updateInitiative` (dopisanie `changes.push`, linie ok. 998-1023); (b) DOKŁADNIE te raw-`UPDATE` call-site'y, które `§A.3` klasyfikuje jako `NAPRAW` (max. tyle, ile sweep potwierdzi jako otwarte — nie więcej niż 10 lokalizacji wymienionych w `§A.3`). Zakaz zmiany reszty pliku (2900+ linii) | Czerwony kontrakt + brief |
| `server/src/middleware/executionSpineLegacyReadOnly.middleware.ts` | **★ WĄSKA LICENCJA:** dokładnie jedna linia w `LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS`, TYLKO jeśli `§A.3` dla danej lokalizacji wybiera wariant „zamknięcie 409". Zakaz zmiany logiki funkcji, zakaz zmiany `GOVERNED_EXECUTION_CONTROL_COMMANDS` | Czerwony kontrakt + brief |
| `server/src/services/initiative/initiativeTransitionService.ts` | **TYLKO ODCZYT** — wzorzec, nie dotykasz | Dowód w raporcie |
| `tests/**` (NOWE), `server/src/**/__tests__/**` (NOWE) | **★ PEŁNA LICENCJA**, z zastrzeżeniem `Z18`/`Z31` | — |
| `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY272_INICJATYWY_REPORT.md` | `§R.2` — **JEDYNY nowy dokument** (`Z13`) | — |
| `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` | **TYLKO ODCZYT** (`Z14`) | Errata w raporcie |
| `server/src/routes/v8/execution-control.routes.ts`, `server/src/jobs/initiativeAutoStartJob.ts`, `server/src/controllers/DecisionController.ts`, `server/src/routes/executionControl.routes.ts` | **TYLKO ODCZYT** — już naprawione (`§ Sprostowania nadzorcy`), kontekst wyłącznie | Dowód w raporcie, `Z40` |
| **Wszystko inne** | **TYLKO ODCZYT** | Opisujesz w raporcie z dowodem plik:linia |

---

## B.2. TABELA POZYCJI Z DEFINICJĄ UKOŃCZENIA PER POZYCJA

| Pozycja | Nazwa jednym zdaniem | Rdzeń? | Wymaga plików przekrojowych? | DoD podniesione | Definicja ukończenia | Komenda dowodowa | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `§A.1` | odtworzenie testu `day241` (czerwony) | TAK | NIE — dowód: test w `__tests__/`, poza plikami z `Z12` | 1 | Nowy test `server/src/controllers/__tests__/day272-lazy-fields-audit-gap.pg.test.ts`: `PUT /api/initiatives/:id` z ciałem `{hypothesisStatement: "..."}` WYŁĄCZNIE; asercja `initiative_history` liczba wierszy PRZED = PO (0 delty) na kodzie SPRZED naprawy — MUSI BYĆ CZERWONY (asercja „liczba wierszy wzrosła" pada) | `§0.2c (B)` | `test(initiatives): odtworz czerwony dowod day241 lazy-fields (A.1)` |
| `§A.2` | naprawa `LAZY_FIELDS` — audyt dostaje wpis | TAK | NIE — dowód: zmiana w tym samym pliku co `§A.1` test | 0 nowych (ten sam test z `§A.1` zmienia werdykt) | `changes.push({field, oldValue, newValue})` dodane w pętli `LAZY_FIELDS`; test z `§A.1` **ZIELONY** na kodzie PO naprawie; dowód mutacyjny w obie strony | mutacja opisana niżej | `fix(initiatives): LAZY_FIELDS zasila audyt initiative_history (A.2)` |
| `§A.3` | sweep 10 surowych `UPDATE initiatives` w `InitiativeController.ts` | TAK | CZĘŚCIOWO — `blockInitiative` może wymagać zmiany w `executionSpineLegacyReadOnly.middleware.ts` (WĄSKA LICENCJA już przyznana powyżej, więc `NIE` w sensie blokującym) | 0-4 (zależnie od liczby OTWARTYCH pozycji) | Tabela w raporcie: dla KAŻDEJ z 10 lokalizacji (linie ok. 1061, 1454, 2132, 2246, 2385, 2593, 2711, 2798 + dwie dodatkowe, które sam znajdziesz przez pełny grep) — klasyfikacja AUDYTOWANY (dowód: insert nearby) / OTWARTY-NAPRAW (dowód: brak audytu + trasa osiągalna) / OTWARTY-MARTWY (dowód: trasa gaszona przez middleware, `§0.2e (e)`); dla KAŻDEGO `OTWARTY-NAPRAW` — albo naprawa (audyt przez `initiative_history`/`ie_audit_events`), albo zamknięcie 409 (dopisanie ścieżki do `LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS`), decyzja per wiersz z uzasadnieniem | grepy z `§0.1` weryfikacji (4)(5) + pełny przegląd pozostałych 8 | `fix(initiatives): sweep surowych UPDATE — audyt lub zamkniecie 409 (A.3)` |
| `§A.4` | para „obcy nie widzi / właściciel widzi" na jednej naprawionej ścieżce | TAK | NIE | 2 | Nowy test `server/src/controllers/__tests__/day272-silent-writes-foreign-owner.pg.test.ts` wzorem `day31.canonical-writer-contract.pg.test.ts`: (1) obcy tenant próbujący `PUT`/`POST` na naprawioną z `§A.3` ścieżkę dostaje `401`/`403`/`404` (zmierz który, zgodnie z konwencją repo); (2) właściciel (poprawny tenant) wykonuje tę samą operację i dostaje sukces + wiersz w `initiative_history`/`ie_audit_events` | `§0.2c (B)` | `test(initiatives): para obcy/wlasciciel na naprawionej sciezce (A.4)` |
| `§R.2` | raport dyżuru | NIE | NIE | n/d | struktura z `§R.2` | — | `docs(day272): raport dyzuru (R.2)` |

> **Kolumna „Wymaga plików przekrojowych?"** — `§A.1`,`§A.2`,`§A.4` = `NIE` z
> dowodem (dotykają wyłącznie `InitiativeController.ts` i nowych plików
> testowych). `§A.3` = `CZĘŚCIOWO` — jedyny plik przekrojowy, którego może
> dotknąć, ma już przyznaną wąską licencję w `B.1`, więc nie jest to
> niewykonalność, tylko jawnie ograniczony zakres.

---

## B.3. TABELA MIANOWNIKÓW

| # | Co liczę | Liczba autora instrukcji | Komenda | Czy obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | surowe `UPDATE initiatives` w `InitiativeController.ts` | 10 | `grep -c "UPDATE initiatives" server/src/controllers/InitiativeController.ts` | TAK |
| 2 | lokalizacje z brifu już naprawione (INI-005) | 4 z 5 | policz ręcznie z `§ Sprostowania nadzorcy`, zweryfikuj każdą komendą (6) w `§0.1` | TAK |
| 3 | pisarze `ie_audit_events` w `server/src/` | 3 | `grep -rln "ie_audit_events" server/src/ --include="*.ts" \| grep -v __tests__ \| wc -l` | TAK |
| 4 | `changes.push` w pętli `LAZY_FIELDS` przed naprawą | 0 | `sed -n '998,1023p' server/src/controllers/InitiativeController.ts \| grep -c "changes.push"` | TAK |
| 5 | testy istniejące dziś dla `day241`/`lazy-fields` | 0 | `find . -iname "*lazy-fields*" -not -path "*/node_modules/*" \| wc -l` | TAK |

---

## B.4. TABELA ROZŁĄCZNOŚCI — PLIKI DO ZAPISU TEGO DYŻURU

### B.4.1. Pliki zapisywane NA PEWNO

| # | Plik | Rodzaj | Pozycja | Ryzyko kolizji |
| --- | --- | --- | --- | --- |
| 1 | `server/src/controllers/__tests__/day272-lazy-fields-audit-gap.pg.test.ts` | NOWY | `§A.1`/`§A.2` | ZEROWE |
| 2 | `server/src/controllers/__tests__/day272-silent-writes-foreign-owner.pg.test.ts` | NOWY | `§A.4` | ZEROWE |
| 3 | `server/src/controllers/InitiativeController.ts` | istniejący (2900+ linii) | `§A.2`/`§A.3` | **★★ WYSOKIE — plik współdzielony**; commit MUSI dotykać wyłącznie linii wymienionych w licencji, sprawdź `git diff --stat` przed każdym commitem |
| 4 | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY272_INICJATYWY_REPORT.md` | NOWY | `§R.2` | ZEROWE |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Pozycja | Warunek |
| --- | --- | --- |
| `server/src/middleware/executionSpineLegacyReadOnly.middleware.ts` | `§A.3` | tylko jeśli sweep wybiera „zamknięcie 409" dla którejś lokalizacji, dokładnie jedna linia dodana do `LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS` |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

```
server/src/routes/v8/execution-control.routes.ts
server/src/jobs/initiativeAutoStartJob.ts
server/src/controllers/DecisionController.ts
server/src/routes/executionControl.routes.ts
server/src/middleware/auth.middleware.ts
server/src/database/Database.ts
Wszystko w src/ (front) — dyzur przekrojowy backend
```

### B.4.4. Zasoby wyłączne tego dyżuru

| Zasób | Wartość | Sprawdzone |
| --- | --- | --- |
| Port PostgreSQL | `6284` | `lsof -nP -iTCP:6284 -sTCP:LISTEN` |
| Port harnessu | `5264 i 5265` | jw. |
| Nazwa kontenera | `cx-day272-pg` | `docker ps --format '{{.Names}}'` |
| Nazwa bazy | `cx272` | — |
| Przedział migracji | **NIE DOTYCZY — zero nowych migracji** | `ls server/migrations/ | grep -cE "^202619[23]"` → 0 (rezerwacja pusta) |
| Gałąź | `codex/day272-inicjatywy-audyt-20260902` | nie istnieje |
| Worktree | `/private/tmp/cx-day272-inicjatywy-audyt` | nie istnieje |
| Flagi funkcyjne | brak — zero nowych | `grep -rn "INICJATYWY_AUDYT" server/src/ src/ → 0` |

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
cd /private/tmp/cx-day272-inicjatywy-audyt
git diff --name-only --cached | tee /private/tmp/cx-day272-inicjatywy-audyt-artefakty/staged.txt
grep -iE 'v8/execution-control\.routes\.ts$|initiativeAutoStartJob\.ts$|DecisionController\.ts$|routes/executionControl\.routes\.ts$|auth\.middleware\.ts$|Database\.ts$' \
  /private/tmp/cx-day272-inicjatywy-audyt-artefakty/staged.txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
git diff --stat --cached server/src/controllers/InitiativeController.ts
#   przeczytaj wynik: liczba zmienionych linii MA byc mala (dziesiatki, nie setki)
```

---
---

# POZYCJE ROBOCZE — SZCZEGÓŁY

## §A.1 — Odtworzenie czerwonego dowodu

Napisz test HTTP (przez `ApiGateway`, `Z22`) który:

1. Zakłada organizację, użytkownika, inicjatywę.
2. Liczy `SELECT COUNT(*) FROM initiative_history WHERE initiative_id = $1`
   PRZED.
3. Wysyła `PUT /api/initiatives/:id` z ciałem `{ hypothesisStatement: "test
   day272" }` — **WYŁĄCZNIE** to jedno pole, zero innych.
4. Liczy `initiative_history` PO.
5. Asertuje: `po > przed` (co najmniej jeden nowy wiersz).

Uruchom na kodzie SPRZED naprawy (`§A.2` jeszcze niezrobione) — **MUSI BYĆ
CZERWONY**. Wklej pełny wynik do raportu.

## §A.2 — Naprawa

W `updateInitiative`, pętla `LAZY_FIELDS` (ok. linii 1005-1023), dopisz
`changes.push({ field: f.key, oldValue: <wartość przed>, newValue: val })`
analogicznie do wzorca w liniach 942/967 (przeczytaj dokładnie te dwa
miejsca — potrzebujesz `oldValue` sprzed zmiany, prawdopodobnie z `existing`
obiektu już wczytanego wcześniej w funkcji; zmierz to w `R1`, nie zgaduj
nazwy zmiennej).

**Dowód mutacyjny (`Z32`, obowiązkowy):**

```bash
cp server/src/controllers/InitiativeController.ts /private/tmp/cx-day272-inicjatywy-audyt-scratch/InitiativeController.original.ts
# usun REALNIE Twoj nowy `changes.push(...)` z petli LAZY_FIELDS
# URUCHOM test §A.1 -> MUSI byc CZERWONY
cp /private/tmp/cx-day272-inicjatywy-audyt-scratch/InitiativeController.original.ts server/src/controllers/InitiativeController.ts
git diff --stat server/src/controllers/InitiativeController.ts   # PUSTE
# przywroc TWOJA naprawe recznie (nie z kopii - kopia jest sprzed A.2)
# URUCHOM test ponownie -> MUSI byc ZIELONY
```

## §A.3 — Sweep 10 lokalizacji

Znajdź WSZYSTKIE 10 (albo więcej, jeśli Twój `grep -c` z `B.3` wiersz 1
zwróci inną liczbę — to jest wynik, nie sprzeczność) wystąpień `UPDATE
initiatives` w pliku. Dla każdej wypełnij wiersz tabeli w raporcie:

| Linia (Twoja, na markerze) | Funkcja | Trasa HTTP (jeśli ustalisz) | Audyt nearby? (dowód) | Trasa objęta `requireCanonicalInitiativeExecutionWriter`? | Klasyfikacja | Akcja |
| --- | --- | --- | --- | --- | --- | --- |

Znane punkty startowe (zweryfikuj, nie przepisuj bezkrytycznie):

- **~1061, ~1454** (`updateInitiative`, `EXE-06` progress) — komentarze w
  kodzie sugerują istniejący audyt `initiative_history` w tej samej funkcji;
  potwierdź `changes.push` faktycznie obejmuje te pola.
- **~2132** (`submitForReview`) — POTWIERDZONY brak audytu w promieniu 45
  linii, trasa (zmierz jej ścieżkę HTTP w `pmo/initiatives.routes.ts`) NIE
  jest w `LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS` → **OTWARTY-NAPRAW** albo
  **OTWARTY-409** (Twoja decyzja, uzasadnij).
- **~2246** (`approveInitiative`) — zmierz czy audyt jest gdzieś w tej
  funkcji poza oknem +45 linii sprawdzonym w tej instrukcji.
- **~2385** (`blockInitiative`) — trasa `/:id/block` OBJĘTA middleware'em
  (409 przed handlerem); zmierz zgodnie z `§0.2e (e)` czy kod wewnątrz jest
  faktycznie martwy → **OTWARTY-MARTWY** (dokumentuj, nie usuwaj) albo, jeśli
  pomiar pokaże, że middleware NIE gasi tej trasy (np. inny router ją montuje
  bez tego `router.use`) → **OTWARTY-NAPRAW**.
- **~2593, ~2711** — komentarze/kontekst sugerują istniejący
  `INSERT INTO initiative_history` w tej samej funkcji; potwierdź.
- **~2798** (`archiveInitiative`) — zmierz od zera, brak wcześniejszego
  ustalenia w tej instrukcji.

Dla każdego wiersza `OTWARTY-NAPRAW`: albo dopisz zapis audytu (wzorem
`initiativeTransitionService.ts`, `INSERT INTO initiative_history`), albo — z
uzasadnieniem w raporcie dlaczego naprawa audytu jest tu niewłaściwa (np. bo
funkcjonalnie ścieżka powinna być całkiem zamknięta) — dodaj jej wzorzec ścieżki
do `LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS` (wąska licencja w `B.1`) i
zweryfikuj testem, że zwraca `409`.

## §A.4 — Para „obcy nie widzi / właściciel widzi"

Wybierz JEDNĄ ścieżkę naprawioną w `§A.2` albo `§A.3` (Twoja decyzja, opisz
którą i dlaczego). Wzorem `day31.canonical-writer-contract.pg.test.ts`:
test tworzy DWIE organizacje (własną i obcą), obcy token próbuje
zapis/odczyt na zasobie właściciela → oczekiwany kod (zmierz konwencję repo:
`404` dla ukrycia istnienia, zgodnie z `Z40` wzorcem z dyżuru 242, chyba że
Twój pomiar na tej konkretnej trasie pokaże inaczej — wtedy to jest wynik,
nie łamanie konwencji) — właściciel wykonuje tę samą operację i dostaje
sukces + wiersz audytu.

---
---

## §R.1 — Podniesienie rejestru (NIE DOTYCZY tego dyżuru)

Brak przypisanego pliku `MODULE_ACCEPTANCE.md`.

## §R.2 — Raport dyżuru

Dokładnie jeden plik:
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY272_INICJATYWY_REPORT.md`

Struktura: nagłówek · weryfikacja wejściowa (10 komend) · `§A.1`-`§A.4` z
dowodami · **tabela sweepu 10 lokalizacji w pełni wypełniona** · Korekty
wobec instrukcji (w tym potwierdzenie/obalenie `§ Sprostowania nadzorcy`) ·
STOP-y, jeśli były · TWIERDZENIA NIEZWERYFIKOWANE · **INWENTARZ pozostałych
plików spoza `InitiativeController.ts`, które piszą do `initiatives`, z
klasyfikacją bez zmian** (osobna sekcja, `Z40`) · manifest artefaktów z
`shasum -a 256`.

---
---

## ★★ JEŚLI COŚ W TEJ INSTRUKCJI JEST SPRZECZNE LUB NIEWYKONALNE

**Ta instrukcja była pisana i sprawdzana przez człowieka i model. Może mieć
błędy. Nie zatrzymuj przez nie dyżuru.**

1. **Opisz sprzeczność w raporcie** — cytat, numery paragrafów, dowód.
2. **Interpretacja BEZPIECZNIEJSZA:** nie ruszaj cudzego pliku · nie osłabiaj
   asercji · nie kasuj (`DO DECYZJI WŁAŚCICIELA`) · nie włączaj flagi · nie
   wysyłaj na zewnątrz · nie poszerzaj dostępu · mierz zamiast zgadywać.
3. **KONTYNUUJESZ POZOSTAŁE POZYCJE.**
4. **Zatrzymanie CAŁEGO dyżuru** — wyłącznie z pięciu powodów `§0.5`.
5. **Nigdy nie „naprawiaj" instrukcji przez improwizację w kodzie.**
6. **★ Rozbieżność między pomiarem a tą instrukcją NIE JEST sprzecznością —
   jest WYNIKIEM.**

**★ Ostatnie zdanie i najważniejsze: obalenie którejkolwiek tezy z tytułu
tego dokumentu (włącznie z „§ Sprostowania nadzorcy") jest SUKCESEM dyżuru,
nie porażką. Zapisz w „Korektach wobec instrukcji" z dowodem i idź dalej.**

---
---

## AUDYT WYKONANY PRZEZ AUTORA

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — brak par wzajemnie wykluczających się | TAK |
| 2 | Każda ścieżka pliku zweryfikowana na markerze `444d789363` | TAK |
| 3 | Każda liczba ma odtwarzalną komendę (`B.3`) | TAK |
| 4 | Tabela licencji kompletna, trzecia kolumna nigdy „STOP" | TAK |
| 5 | Wykonalność per pozycja bez plików przekrojowych — z dowodem | TAK |
| 6 | Przydział zasobów sprawdzony wobec 270/271/273 | TAK |
| 7 | Komendy paste-ready, komplet env w jednej linii, `--retry=0` | TAK |
| 8 | Pułapki środowiska w całości (18 + `§0.2e (e)` własna) | TAK |
| 9 | Samodzielność dokumentu | TAK |
| 10 | Klauzula sprzeczności; `grep -c '<<' <plik>` → `0` | TAK |
