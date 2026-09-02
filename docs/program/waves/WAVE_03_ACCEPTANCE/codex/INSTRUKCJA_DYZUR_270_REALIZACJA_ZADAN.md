# INSTRUKCJA DYŻURU nr 270 — Codex — „★★ JEDEN MAGAZYN ZADAŃ, ETAP 1 — FIX-y z `ODBIOR_204.md` (limiter D-13, idempotencja) SĄ JUŻ WDROŻONE na tym markerze (`server/scripts/legacy-task-cutover-runner.ts:96-105` = FIX-204-1 blokujący organizationId, `:266` = FIX-204-3 Guard B idempotencji per-task, `:412-429` = FIX-216-3 `ON CONFLICT (organization_id, legacy_task_id) DO UPDATE`) — TEN DYŻUR NIE BUDUJE ICH OD NOWA, tylko DOWODZI MUTACYJNIE, że trzymają na aktualnym SHA, bo `ODBIOR_204.md` sam stwierdza (`§`Mutacja B`), że w chwili tamtego odbioru idempotencja »NIE CZERWIENIEJE — TAUTOLOGIA« i »nie ma pokrycia testowego w całym repozytorium«. Po dowodzie: PILOT DOKŁADNIE 1 REKORDU na LOKALNEJ bazie (seed `scripts/dev/day204-m3-shape-seed-local.mjs`, ISTNIEJE). Trzecia pozycja: skrypt SQL do pliku (`scripts/dev/day270-legacy-fields-fill.sql`, NOWY) mierzący wypełnienie 64 z 80 kolumn legacy `tasks` bez prostego odpowiednika w kanonie (lista w `CODEX_DAY239_REALIZACJA_REPORT.md` R2) — uruchamiasz go TYLKO na swojej lokalnej bazie, na stagingu uruchomi go NADZORCA. Czwarta pozycja: tabela `legacy_task_cutover_step_ledger` (`server/migrations/20261722_legacy_task_cutover_step_ledger.sql`) ma zapis wyłącznie z testu `tests/integration/day204-r1-mines.realdb.test.ts` — `legacy-task-cutover-runner.ts` NIGDY do niej nie pisze (`grep` zero trafień) — to jest ÓSMY kształt fałszywego »gotowe« (biblioteka bez wywołania z produkcyjnej ścieżki) i wymaga DECYZJI zapisanej w raporcie: podłączyć runner do ledgera kroków ALBO oznaczyć jako martwą w rejestrze. ZAKAZ transferu masowego — pilot to i tylko to jeden rekord."

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
> **wyłącznie** `/private/tmp/cx-day270-realizacja-zadan`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `444d789363`**
> **Gałąź bazowa: `github-backup/integracja/20260902`**
> **Stan dokumentu: WYDANY**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo jakiekolwiek niewypełnione pole szablonu —
> **dokument nie jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.
> Ta ramka jest **jedynym** miejscem, w którym rozstrzyga się stan wydania.
> Objaśnienia w innych blokach cytowanych **nie** są powodem do STOP-u.
>
> **Uwaga o gałęzi bazowej.** `integracja/20260902` to gałąź budowana
> równolegle przez agenta integracji z czterech linii wave-3 (wynik audytu:
> `docs/program/funkcje/…` raport integracji z 2026-09-02, bramka budowy
> zielona na `444d789363`). Marker jest **przodkiem** tipa — sprawdzasz to
> sam w kroku (2) poniżej. Jeżeli w chwili startu marker NIE jest przodkiem —
> **STOP całego dyżuru** wg reguły rozejścia niżej.

Data wystawienia: 2026-09-02.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.
Zakres: **Realizacja — jeden magazyn zadań (`ExecutionTask`/`runtime-v1`), etap 1: dowód mutacyjny dwóch FIX-ów z `ODBIOR_204.md` (limiter D-13 + idempotencja), pilot transferu DOKŁADNIE 1 rekordu na lokalnej bazie, pomiar wypełnienia 64 pól legacy jako skrypt SQL w repo, decyzja o `legacy_task_cutover_step_ledger`.**
Trasy front: `brak w zakresie ZAPISU tego dyżuru — magazyn zadań dziś nie ma frontu przełączającego się między legacy i kanonem; jeśli w R1 znajdziesz żywy front czytający legacy `tasks` bezpośrednio, opisz go w raporcie, NIE zmieniaj`.
Trasy tył: `server/scripts/legacy-task-cutover-runner.ts` (odczyt + dowód mutacyjny, ZAKAZ przepisywania logiki FIX-204-1/204-2/204-3/216-3) · `server/migrations/20261721_legacy_task_cutover_ledger.sql` i `server/migrations/20261722_legacy_task_cutover_step_ledger.sql` (odczyt) · `scripts/dev/day204-m3-shape-seed-local.mjs` (odczyt, seed pilota) · `scripts/dev/day270-legacy-fields-fill.sql` (**NOWY**, pełna licencja) · `server/src/domain/initiatives-execution/executionWork.ts` (odczyt — kontrakt `ExecutionTask`, 17 pól) · `server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.ts` (odczyt — jedyny dziś pisarz do `legacy_task_cutover_step_ledger`, przez `tests/integration/day204-r1-mines.realdb.test.ts`) · `docs/program/funkcje/ODBIOR_204.md` (odczyt, materiał wiążący) · `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY239_REALIZACJA_REPORT.md` (odczyt, lista 64 pól w R2).

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
WT=/private/tmp/cx-day270-realizacja-zadan
MARKER=444d789363

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/integracja/20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/integracja/20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day270-realizacja-zadan-20260902 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day270-realizacja-zadan/config.worktree"
cat "$VAULT/worktrees/cx-day270-realizacja-zadan/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day270-realizacja-zadan-scratch
mkdir -p /private/tmp/cx-day270-realizacja-zadan-artefakty

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
git -C "$VAULT" log --oneline 444d789363..github-backup/integracja/20260902
git -C "$VAULT" diff --name-only 444d789363..github-backup/integracja/20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**Nie pushujesz sam** (patrz `A.1-BIS (2)` w metodyce — wybór dla dyżurów
odbieranych przez nadzorcę: **push wykonuje nadzorca po odbiorze**). Trzymasz
commity lokalnie na `$WT`, jeden commit na pozycję.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 444d789363..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `10` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA: FIX-204-1 (D-13, limiter organizacji) jest wdrozony na tym markerze
sed -n '90,125p' server/scripts/legacy-task-cutover-runner.ts
#   oczekiwane: `--organization-id` jest WYMAGANY (bez niego throw), komentarz
#   cytuje "D-13 (pilot 1 record, then batches)"

# (2) TEZA: galaz `initiative_id IS NULL` (osobiste zadania) jest dzis W ZAKRESIE
#     organizacji, nie poza nim (to bylo FIX-204-2)
sed -n '195,235p' server/scripts/legacy-task-cutover-runner.ts
#   oczekiwane: zapytanie SELECT filtruje `WHERE organization_id = $1` i
#   grupuje `organization_id, initiative_id` (personal branch objety filtrem)

# (3) TEZA: FIX-204-3 "Guard B" (idempotencja per-task) istnieje jako kod
sed -n '260,290p' server/scripts/legacy-task-cutover-runner.ts
grep -n "ON CONFLICT (organization_id, legacy_task_id)" server/scripts/legacy-task-cutover-runner.ts
#   oczekiwane: komentarz "FIX-204-3", nizej w pliku `ON CONFLICT (organization_id,
#   legacy_task_id) DO UPDATE SET` (linia ok. 429), z komentarzem FIX-216-3
#   ostrzegajacym przed "unqualified ON CONFLICT DO NOTHING"

# (4) TEZA: mimo (1)-(3), ODBIOR_204.md twierdzi ze idempotencja NIE MA
#     pokrycia testowego w calym repo (to jest powod tej pozycji dyzuru)
grep -n "idempotencja.*nie ma pokrycia\|TAUTOLOGIA\|NIEZROBIONY" docs/program/funkcje/ODBIOR_204.md
#   oczekiwane: co najmniej 2 trafienia, w tym zdanie o tautologii Mutacji B

# (5) TEZA: seed pilota M3 istnieje i jest gotowy do uzycia
test -f scripts/dev/day204-m3-shape-seed-local.mjs && echo "SEED OK" || echo "SEED BRAK"
grep -n "day204-m3-org\|refuses non-loopback" scripts/dev/day204-m3-shape-seed-local.mjs
#   oczekiwane: SEED OK; skrypt odmawia nie-loopback hosta (bezpiecznik wbudowany)

# (6) TEZA: legacy_task_cutover_step_ledger istnieje jako tabela, ale runner
#     NIGDY do niej nie pisze
grep -c "legacy_task_cutover_step_ledger" server/scripts/legacy-task-cutover-runner.ts
grep -rln "legacy_task_cutover_step_ledger" . --include="*.ts" --include="*.mjs" 2>/dev/null | grep -v node_modules
#   oczekiwane: pierwszy grep -> 0; drugi grep -> WYLACZNIE
#   tests/integration/day204-r1-mines.realdb.test.ts i
#   server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.ts
#   (runner nie jest na liscie)

# (7) TEZA: lista 64 pol legacy bez prostego odpowiednika jest w raporcie 239, R2
grep -n "64 z 80 kolumn\|Wniosek tabeli" docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY239_REALIZACJA_REPORT.md
#   oczekiwane: zdanie "traci tresc 64 z 80 kolumn bez prostego odpowiednika"

# (8) TEZA: kontrakt ExecutionTask ma 17 pol najwyzszego poziomu, w payload_json
grep -n "taskId, executionCaseId" docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY239_REALIZACJA_REPORT.md
sed -n '1,40p' server/src/domain/initiatives-execution/executionWork.ts | grep -n "interface\|Task"
#   oczekiwane: raport cytuje 17 nazw pol; plik zrodlowy potwierdza interfejs

# (9) TEZA: legacy tabela `tasks` istnieje z ok. 80 kolumnami (nie liczysz jej
#     tu w calosci — tylko potwierdzasz istnienie definicji)
grep -rln "CREATE TABLE.*\btasks\b" server/migrations/ | head -3
#   oczekiwane: co najmniej jedna migracja definiujaca `tasks`

# (10) miejsce na dysku
df -h /
#   oczekiwane: powyzej 5 GB wolnego — ponizej tego STOP calego dyzuru
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Ten dyżur **NIE PUSHUJE W OGÓLE** (push robi nadzorca po odbiorze, patrz `§0.1`) | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `integracja/20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6280`. Twój JEDYNY port harnessu to `5260 i 5261`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day270-pg`**. **ZAKAZANE:** Zajęte na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061. Zajęte przez inne prace (nie ruszasz): 6012, 5433, 6047, 6054-6278, 5010-5259, 6404-6411, 6600-6830. Twoje własne: baza 6280, harness 5260 i 5261. Cudze — siostrzane dyżury TEJ SAMEJ paczki (270-273, wydane tego samego dnia, ten sam nadzorca), nie dotykasz: baza 6282 harness 5262-5263 (dyżur 271 Assessment) · baza 6284 harness 5264-5265 (dyżur 272 Inicjatywy) · baza 6286 harness 5266-5267 (dyżur 273 Gamma). Sprawdzasz sam przed startem: `lsof -nP -iTCP:PORT -sTCP:LISTEN` oraz `docker ps` | Trzy incydenty zapisu do cudzej bazy |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB. **W SZCZEGÓLNOŚCI: skrypt SQL pomiaru pól legacy (pozycja `§A.3`) uruchamiasz WYŁĄCZNIE na swojej lokalnej bazie** — na stagingu uruchomi go nadzorca, TY nie masz do stagingu dostępu | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Ten dyżur nie wymaga ŻADNEJ nowej flagi — pilot 1 rekordu uruchamiasz komendą CLI (`legacy-task-cutover-runner.ts --organization-id=... --max-tasks=1`), nie przełącznikiem produktowym | Krach 07-12: masowe włączenie flag wizualnych na żywo |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Ten dyżur nie tworzy żadnego nowego ekranu — jest przekrojowy/zapleczowy | `CLAUDE.md` reguła 7 |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: `server/src/middleware/auth.middleware.ts` · `server/src/database/Database.ts` · `vitest.config.ts` · `tests/setup.ts` | Pliki przekrojowe |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY270_REALIZACJA_REPORT.md`. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day270-realizacja-zadan-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
| `Z14` | **Nie zmieniasz `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md`** i nie podważasz decyzji w kodzie. Uważasz, że decyzja się myli → **errata w raporcie** | SSOT decyzji właściciela |
| `Z15` | **Zero modelu językowego w tym dyżurze.** Żaden pomiar, strażnik ani skrypt nie woła `llmService`, `/api/ai/**` ani `GoogleGenerativeAI` | `DEC-51` |
| `Z16` | **Nie usuwasz i nie „naprawiasz" uczciwych stanów pustych, `503 not_configured`, `null`, `UNKNOWN` ani nagrobków `410`** | „Zero placebo i atrap" |
| `Z17` | **Zakaz wszystkiego poza zakresem tego dyżuru** — z imiennymi licencjami z tabeli licencji | Podział front/tył i rozłączność z dyżurami równoległymi |
| `Z18` | **★★ NAJOSTRZEJSZY — ABSOLUTNY zakaz modyfikowania globalnej infrastruktury testowej:** `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest.config.ts`, każdy `vitest.*.config.ts`, `server/vitest.config*.ts`, `tests/integration/_helpers/assertRealPostgres.ts` | Jedna zmiana globalnego mocka fałszuje wynik całego korpusu |
| `Z19` | **Nie odmontowujesz i nie kasujesz żadnego routera, middleware ani joba CI zamontowanego dziś** | Odmontowanie trasy potrafi zabić ekran, którego nie mierzysz |
| `Z20` | **★★ ZAKAZ uruchamiania testów DB bez jawnego kompletu env wskazującego kontener TEGO dyżuru, W TEJ SAMEJ LINII komendy.** Kolejność BLOKU 0 jest wiążąca: **NAJPIERW kontener + pełne migracje, DOPIERO potem jakikolwiek pomiar** | Trzy incydenty zapisu do cudzej bazy |
| `Z21` | **DoD wymaga DOWODU OSIĄGALNOŚCI, nie istnienia pliku** (`DEC-2026-08-26-104`) | Istnienie kodu ≠ działanie |
| `Z22` | **★★ Test wstrzykujący zależności albo montujący router w gołym `express()` NIE dowodzi ścieżki produkcyjnej.** Ten dyżur nie dotyka tras HTTP — dowody idą przez realny Postgres i realny runner CLI, nie przez `ApiGateway` | Replika rozjeżdża się z produkcją |
| `Z23` | **★★ ZERO ATRAP.** `200`/`OK` z pustą kopertą tam, gdzie zapytanie padło, jest atrapą. Pilot, który twierdzi „1 rekord", a przenosi 0 albo więcej niż 1, jest atrapą | `DEC-2026-08-25-21/22`, `DEC-51` |
| `Z24` | **Pomiar zasięgu testów wg `§0.4a` jest warunkiem oddania raportu.** Zawężony wybór albo **przepisanie cudzej liczby** = zawyżenie i podstawa odrzucenia | Liczby autora instrukcji i nadzorcy krążą po dokumentach i utrwalają się jako „fakt" |
| `Z25` | **★★ Testy realdb WYŁĄCZNIE z jawnym `DATABASE_URL` wskazującym Twój efemeryczny kontener.** `tests/setup.ts` ma bezpiecznik i rzuca błędem zamiast fallbacku | Port `5432` NASŁUCHUJE i nie jest Twój |
| `Z26` | **★★ Komplet env w tej samej linii — patrz `§0.2c`.** | Tak zginął dzień 23 |
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci.** Stan odkładasz przez `cp` do `/private/tmp/cx-day270-realizacja-zadan-scratch` i wracasz przez `cp` | Schowek współdzielony między worktree |
| `Z28` | **★★ ZERO POŁĄCZEŃ DO RAILWAY, DEMO, STAGINGU I PRODUKCJI — w każdą stronę i każdym narzędziem.** **W SZCZEGÓLNOŚCI dotyczy to skryptu pomiaru pól legacy (`§A.3`)** — Ty go tylko PISZESZ i URUCHAMIASZ LOKALNIE; wykonanie na stagingu NIE JEST Twoim zadaniem | Produkcja NIETYKALNA; to jedyny zakaz zatrzymujący CAŁY dyżur |
| `Z29` | **★★ Testy o kształcie „atak odrzucony + readback bez zmian" MUSZĄ biec BEZ PONAWIANIA: `--retry=0`** | `vitest.config.ts` ustawia `retry: CI ? 3 : 1` |
| `Z30` | **★★ ZAKAZ REALNEJ WYSYŁKI E-MAILI, ZAPROSZEŃ KALENDARZOWYCH I POWIADOMIEŃ.** Protokół `§0.2b` | Nieodwracalne |
| `Z31` | **★★ ZAKAZ PRZYPINANIA STRAŻNIKA TESTU REALDB DO HOSTA, PORTU ALBO NAZWY BAZY.** `await assertRealPostgresTestEnvironment()` **BEZ ARGUMENTÓW** | Dyżur 43: 30 przypadków stało się trwałym `SKIP` |
| `Z32` | **★★ ZAKAZ WPISU `FIXED` / `VERIFIED` / `ZROBIONE_WG_DoD` BEZ DOWODU MUTACYJNEGO W OBIE STRONY.** Dla pozycji `§A.1` (idempotencja): psujesz `ON CONFLICT DO UPDATE` → test **CZERWONY**; cofasz przez `cp` → test **ZIELONY**; `git diff` po cofnięciu **pusty** | Dyżur 44 wpisał `FIXED` dla podatności, która nigdy nie istniała |
| `Z33` | **★★ PRZED KAŻDYM POMIAREM SPRAWDZASZ, CZY STRAŻNIK, KTÓRY MIERZYSZ, NIE WYŁĄCZA SIĘ SAM W TRYBIE TESTOWYM** — ramka `§0.2e` | Na `resultsInternalBetaVisibility.middleware.ts` zmierzono 416 fałszywych twierdzeń |
| `Z34` | **★★ GREP DOWODZI, ŻE ŁAŃCUCH ISTNIEJE, NIE ŻE DZIAŁA.** Zdanie „działa" wolno Ci napisać wyłącznie po realnym uruchomieniu runnera na realnym Postgresie po pełnych migracjach — **i po policzeniu wierszy w tabeli** | Istnienie kodu ≠ działanie |
| `Z34a` | **NIE DOTYCZY W TYM DYŻURZE** — ten dyżur nie pushuje w ogóle (patrz `Z1`, `§0.1`) | — |
| `Z35` | **Zakaz „naprawiania" przez wyciszanie:** `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `.skip`, `.todo`, poszerzanie `exclude`, obniżanie progów pokrycia | To jest choroba, którą program leczy |
| `Z36` | **Zakaz `eslint --fix` i `prettier --write` na czymkolwiek szerszym niż plik, który i tak zmieniasz z innego powodu** | Autofix dotknąłby pracy równoległych dyżurów |
| `Z37` | **Porównania testów po NAZWACH przypadków, NIGDY po liczbach** | Wektor maskowania regresji |
| `Z38` | **Zakaz usuwania i odmontowywania jakiegokolwiek joba CI** | Bramki znikają łatwiej, niż wracają |
| `Z39` | **Zakaz uruchamiania realnych workflow GitHub Actions** | Realny przebieg CI dotyka sekretów poza Twoją kontrolą |
| `Z40` | **ZAKAZ zmiany logiki `legacy-task-cutover-runner.ts` (FIX-204-1/204-2/204-3/216-3)** — dotykasz go WYŁĄCZNIE do odczytu jako dowodu w `§A.1`/`§A.2`; jeśli mutacja dowodowa wymaga tymczasowej zmiany, robisz ją przez `cp` kopii (`Z27`) i przywracasz oryginał, `git diff` po przywróceniu ma być **pusty**. **ZAKAZ transferu masowego** — `§A.2` to i tylko to jeden rekord (`--max-tasks=1`), na Twojej lokalnej bazie z seedem `day204-m3-shape-seed-local.mjs`; jeśli chcesz zademonstrować partie, opisz to jako rekomendację w raporcie, nie wykonuj. **ZAKAZ kasowania migracji `20261722_legacy_task_cutover_step_ledger.sql`** niezależnie od decyzji w `§A.4` — decyzja „martwa" oznacza wpis w rejestrze, nie `DROP TABLE` ani usunięcie pliku migracji. **ZAKAZ pisania nowej logiki transferu od zera** — jeśli runner ma defekt inny niż brak wpięcia step-ledgera, opisujesz go jako `DO DECYZJI WŁAŚCICIELA`, nie naprawiasz w tym dyżurze | `ODBIOR_204.md` ustaliło werdykt „SCALIĆ PO FIX" (ocena B/C) na dwóch konkretnych brakach dowodowych — ten dyżur zamyka DOWÓD, nie przepisuje architektury transferu, która jest już zaakceptowana |

---

### 0.2b. ★★ PROTOKÓŁ `Z30` — ZERO WYSYŁKI, A MIMO TO PEŁNY DOWÓD

**(1) Czego NIE WOLNO Ci zrobić — nigdy:**
- ustawić `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_PORT`, `SMTP_FROM`
  w środowisku, w `.env*`, w `docker-compose*` ani nigdzie indziej;
- wstawić wiersza konfiguracji SMTP do tabeli ustawień w swojej bazie;
- uruchomić serwera pełnym `server/src/index.ts` — ten dyżur nie potrzebuje
  serwera HTTP w ogóle, wszystkie dowody idą przez CLI runnera i `psql`;
- wywołać ręcznie żadnej funkcji `drain*` / `startNotificationOutboxDrainCron`
  / `outboxWorker`.

**(2) Dwa dowody, które wklejasz do raportu ZANIM uruchomisz cokolwiek zapisującego:**

```bash
cd /private/tmp/cx-day270-realizacja-zadan

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) tabela `settings` (jesli istnieje) nie ma konfiguracji SMTP na Twojej bazie
docker exec cx-day270-pg psql -U postgres -d cx270 \
  -c "SELECT key, left(coalesce(value,''),8) FROM settings WHERE key LIKE 'smtp%';"
#   oczekiwane: 0 wierszy albo blad "relation settings does not exist" (tez dowod)
```

**(3) Deklaracja obowiązkowa w raporcie, dosłownie:**
**„Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani
żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało
wysłane."** Ten dyżur nie ma wyjątku zrzutów odbiorowych — nie dotyka UI.

---

### 0.2c. ★★ KOMPLET ZMIENNYCH ŚRODOWISKOWYCH — TRZY WARIANTY, ZAWSZE W JEDNEJ LINII

**Zmienna postawiona `export`-em wcześniej NIE LICZY SIĘ.** `vitest.config.ts`
przybija część wartości (`DB_TYPE='sqlite'`), więc komplet musi stać
**w tej samej linii komendy** — i masz **udowodnić, że nadpisał**, a nie założyć.

**(A) MIGRACJE — pełny łańcuch, przed jakimkolwiek pomiarem (`Z20`):**

```bash
cd /private/tmp/cx-day270-realizacja-zadan

docker run -d --name cx-day270-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx270 \
  -p 127.0.0.1:6280:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day270-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6280/cx270 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja migracji, nie
# mylic z idempotencja runnera z pozycji A.1):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6280/cx270 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**(B) SEED PILOTA (po migracjach, przed każdym uruchomieniem runnera w `§A.2`):**

```bash
cd /private/tmp/cx-day270-realizacja-zadan && \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6280/cx270 \
  node scripts/dev/day204-m3-shape-seed-local.mjs
```

**(C) PAKIETY DOTYKAJĄCE BAZY (testy `§A.1`, `§A.2`):**

```bash
cd /private/tmp/cx-day270-realizacja-zadan && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6280/cx270 \
JWT_SECRET=cx270-test-secret-do-not-reuse \
npx vitest run tests/integration/day270-legacy-cutover-idempotency.realdb.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day270-realizacja-zadan-artefakty/day270-pakiet.json
```

Ten pakiet jest **czysto integracyjny na realnym Postgresie** — nie przechodzi
przez `ApiGateway` (ten dyżur nie ma tras HTTP), więc `ENABLE_V8_GLOBAL` i
`ENABLE_TEST_AUTH_BYPASS` **nie mają tu zastosowania** (patrz `§0.2e (e)`).

**(D) SKRYPT SQL POMIARU PÓL (`§A.3`) — jednorazowe uruchomienie lokalne:**

```bash
docker exec -i cx-day270-pg psql -U postgres -d cx270 \
  < scripts/dev/day270-legacy-fields-fill.sql \
  | tee /private/tmp/cx-day270-realizacja-zadan-artefakty/day270-legacy-fields-local.txt
```

**Znaczenie każdej zmiennej — musisz je znać, zanim ją wpiszesz:**

| Zmienna | Co się stanie, gdy jej zabraknie |
| --- | --- |
| `RUN_DB_TESTS=1` | `tests/setup.ts` pomija testy bazodanowe; pakiet raportuje `exit 0` |
| `MOCK_DB=false` | odczyty idą **cicho** na atrapę bazy, zapisy nigdzie nie lądują |
| `DB_TYPE=postgres` | `vitest.config.ts` przybija `sqlite` — mierzysz inny silnik, niż myślisz |
| `NODE_ENV=test` | runner migracji odmawia albo zwraca MOCK przy bazie lokalnej |
| `DATABASE_URL` | fallback na `localhost:5432`, który **nasłuchuje i nie jest Twój** |
| `JWT_SECRET` | nie dotyczy testów tego dyżuru (brak HTTP), zostawiasz dla spójności komendy |
| `--retry=0` | test „atak odrzucony" leczy się skutkiem własnego ataku i raportuje `PASS` |

---

### 0.2d. ★★ ZNANE PUŁAPKI ŚRODOWISKA — OSIEMNAŚCIE, KAŻDA KOSZTOWAŁA GODZINY

**Czytaj to, ZANIM uznasz cokolwiek za zepsute.**

1. **Vault jest BARE + `extensions.worktreeConfig=true`.** Po `git worktree add`
   **musisz** utworzyć `<vault>/worktrees/cx-day270-realizacja-zadan/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
2. **Remote `icloud-source` w vaulcie jest MARTWY.** Nie wołaj `git fetch --all`.
3. **Host NIE MA binarki `psql`.** Każde zapytanie:
   `docker exec cx-day270-pg psql -U postgres -d cx270 -c '…'`.
4. **Runner migracji wymaga `NODE_ENV=test` przy bazie lokalnej.**
5. **`vitest.config.ts` twardo ustawia `test.env.DB_TYPE='sqlite'`.**
   `DB_TYPE=postgres` musi stać **w tej samej linii komendy**. Pliku **nie
   zmieniasz** (`Z18`).
6. **`JSON.parse` na kolumnie typu `json` działa na SQLite i wywala `500` na
   PostgreSQL.** Nie dotyczy CLI runnera bezpośrednio, ale dotyczy każdego
   ewentualnego dodatkowego testu, który czyta `payload_json`.
7. **CI NIE URUCHAMIA TESTÓW dla naszych gałęzi.** „CI zielone" nie jest
   żadnym dowodem w tym repo.
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie:
   `docker rm -fv cx-day270-pg`.
9. **Reporter `basic` NIE ISTNIEJE w tej wersji vitest.**
10. **`npx vitest run` bywa kończy się `exit 0` mimo czerwonych testów** przy
    przekierowaniu wyjścia. Liczby i nazwy czytasz z JSON-a.
11. **Nowe pliki w `tests/` wymagają `git add -f`.**
12. **`| head` na grepie sierot produkuje FAŁSZYWE SIEROTY.**
13. **ESM nie honoruje `NODE_PATH`.** `scripts/dev/day270-legacy-fields-fill.sql`
    to plik `.sql`, nie skrypt — nie dotyczy, ale jeśli piszesz pomocniczy
    `.mjs`, uruchamiany spoza repo, pamiętaj o tym.
14. **Na remote `github-backup` NIE MA gałęzi `main`, `develop`, `Londyn`
    ani `demo`.**
15. **`postgres:15` NIE PRZECHODZI migracji.** Obraz obowiązkowy:
    `pgvector/pgvector:pg16`.
16. **`prettier` na wielkich plikach potrafi przepisać cały plik.** Nie
    uruchamiasz go na `legacy-task-cutover-runner.ts` (526 linii) bez
    bardzo dobrego powodu.
17. **Istnieją testy tekstowe przez `readFileSync` + `toContain`.**
18. **`npx vitest` z roota bez właściwego configu daje `No test files found`.**
    To **nie jest `PASS`**.

---

### 0.2e. ★★ RAMKA DO `Z33` — PUŁAPKI, KTÓRE FAŁSZUJĄ ZIELONY PRZEBIEG

> **(a) `ENABLE_V8_GLOBAL` nieustawione → fałszywe `404` PRZED uwierzytelnieniem.**
> **NIE DOTYCZY tego dyżuru — zero tras HTTP w zakresie**, dowody idą przez
> CLI runnera na realnym Postgresie. Wpisujesz to zdanie wprost w raporcie
> przy każdym pakiecie.
>
> **(b) `resultsInternalBetaVisibility.middleware.ts` przepuszcza wszystko przy
> `NODE_ENV=test`.** **NIE DOTYCZY** — z tego samego powodu co (a).
>
> **(c) `vitest.config.ts` twardo ustawia `test.env.DB_TYPE='sqlite'`.**
> **DOTYCZY** — `MOCK_DB=false DB_TYPE=postgres` w tej samej linii to jedyne
> wyjście; pliku nie zmieniasz (`Z18`). Dowód: pierwszy `it` pakietu `§A.1`
> asertuje `expect(process.env.DB_TYPE).toBe('postgres')`.
>
> **(d) `ENABLE_TEST_AUTH_BYPASS`.** **NIE DOTYCZY** — brak `verifyToken` na
> tej ścieżce.
>
> **(e) ★★ PUŁAPKA WŁAŚCIWA TEMU DYŻUROWI — dwie idempotencje, nie mylić.**
> „Idempotencja" w tym dyżurze ma DWA różne znaczenia i test na jedno nie
> dowodzi drugiego: (i) idempotencja **migracji** (`§0.2c (A)`, drugi
> przebieg `migrate.postgres.ts` bez zmian) — to strażnik schematu; (ii)
> idempotencja **runnera cutover** (`§A.1`, `ON CONFLICT (organization_id,
> legacy_task_id) DO UPDATE`) — to strażnik danych, chroni przed
> zdublowaniem transferu przy powtórnym uruchomieniu tej samej komendy.
> `ODBIOR_204.md` mówi wyłącznie o (ii). Pomiar (i) bez (ii) **nie jest
> dowodem dla tej pozycji**.
>
> **Obowiązek dowodowy.** Dla **każdego** pakietu uruchomionego jako dowód
> czegokolwiek raport zawiera akapit: *która z pułapek (a)–(e) dotyczy tego
> pakietu, jak ją wyłączyłem, i co konkretnie dowodzi, że wyłączyłem*.
> Akapit „nie dotyczy" jest dopuszczalny **tylko** z komendą pokazującą, że
> dany strażnik nie leży na ścieżce. **Pomiar bez tego akapitu nie liczy się
> jako dowód.**

---

### 0.5. Reguła STOP

**Przy jakiejkolwiek wątpliwości MERYTORYCZNEJ: STOP tej POZYCJI i wpis
w raporcie — nigdy improwizacja. W tym programie zasadny STOP jest NAGRADZANY,
a zgadywanie karane.**

**Rozróżnij dwa rodzaje:**

- **STOP MERYTORYCZNY** (mile widziany): zmierzyłeś i wyszło inaczej, niż mówi
  ta instrukcja; brakuje informacji, której nikt poza właścicielem nie
  dostarczy; naprawa wymaga decyzji produktowej. **Wpisujesz do raportu
  i IDZIESZ DALEJ do następnej pozycji.**
- **STOP PROCEDURALNY** (zakazany): „instrukcja jest sprzeczna", „ścieżka nie
  istnieje", „nie mam licencji na plik". **Ten rodzaj NIE zatrzymuje niczego.**

### ★★ TABELA: STOP PROCEDURALNY ZAKAZANY — DZIAŁANIE ZASTĘPCZE

| Powód, dla którego chciałbyś stanąć | Co robisz ZAMIAST STOP-u |
| --- | --- |
| „Musiałbym zmienić plik przekrojowy (`auth.middleware.ts` / `Database.ts`)" | **Czerwony kontrakt testowy + brief wynikowy** (tabela licencji, wiersz TYLKO ODCZYT). Pozycja jest wtedy **ZROBIONA**, nie STOP |
| „Plik, którego potrzebuję, nie jest w tabeli licencji" | Traktujesz go jako **tylko do odczytu** i dajesz czerwony kontrakt + brief. Pozycja **ZROBIONA** |
| „Instrukcja jest wewnętrznie sprzeczna" | Sekcja **„JEŚLI COŚ JEST SPRZECZNE"** na końcu dokumentu |
| „Ścieżka podana w instrukcji nie istnieje" | Sprawdzasz `ls`, wpisujesz **swój wynik** do „Korekt", szukasz realnego odpowiednika |
| „Instrukcja podaje dwie różne liczby" | Mierzysz sam, podajesz **swoją** liczbę z komendą (`Z24`) |
| „`git fetch` zwrócił błąd `icloud-source`" | To **nie jest** błąd. Idziesz dalej |
| „`psql` nie istnieje na hoście" | `docker exec cx-day270-pg psql …` |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day270-realizacja-zadan-scratch`. `git stash` jest zakazem |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`§A.1`, `§A.2`) i **uczciwie opisujesz resztę jako niezrobioną** |
| „Port `6280` albo `5260/5261` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`**;
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji** (`Z28`);
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku**;
5. **zajętym porcie `6280` albo `5260`/`5261`** (`Z7`).

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

---

## B.1. TABELA LICENCJI PLIKOWYCH

> **★★ ZASTRZEŻENIE.** Powyższa tabela **JEST** licencją. Jeżeli plik, którego
> potrzebujesz, jest opisany jako „PEŁNA/WĄSKA LICENCJA" — **masz pozwolenie
> i STOP z tytułu »nie wolno mi« jest NIEZASADNY**. Jeżeli pliku nie ma
> w tabeli w ogóle — domyślnie jest **TYLKO DO ODCZYTU**, a Twoim produktem
> jest czerwony kontrakt + brief, **nie zatrzymanie dyżuru**.

| Plik / wzorzec | Licencja | Co robisz, gdy pozycja wymagałaby zmiany pliku TYLKO-DO-ODCZYTU |
| --- | --- | --- |
| `server/src/middleware/auth.middleware.ts`, `server/src/database/Database.ts`, `vitest.config.ts`, `tests/setup.ts` | **TYLKO ODCZYT — BEZWZGLĘDNIE** | Czerwony kontrakt testowy + brief w raporcie. Pozycja **ZROBIONA, nie STOP** |
| `server/scripts/legacy-task-cutover-runner.ts` | **TYLKO ODCZYT** poza mutacją dowodową tymczasową (`Z40`) — logiki FIX-204-*/216-3 nie przepisujesz | Cofasz mutację przez `cp`, `git diff` pusty po przywróceniu |
| `server/migrations/20261721_legacy_task_cutover_ledger.sql`, `server/migrations/20261722_legacy_task_cutover_step_ledger.sql` | **TYLKO ODCZYT** — zakaz `DROP`/zmiany istniejących migracji | Dowód/decyzja w raporcie, nie zmiana pliku |
| `scripts/dev/day204-m3-shape-seed-local.mjs` | **TYLKO ODCZYT** | — (uruchamiasz jak jest) |
| `scripts/dev/day270-legacy-fields-fill.sql` (**NOWY**) | **★ PEŁNA LICENCJA** | — |
| `tests/integration/day270-legacy-cutover-idempotency.realdb.test.ts` (**NOWY**) | **★ PEŁNA LICENCJA**, z zastrzeżeniem `Z18` i `Z31` | — |
| `server/src/domain/initiatives-execution/executionWork.ts`, `postgresMaterialCommandUnitOfWork.ts` | **TYLKO ODCZYT** | Dowód w raporcie |
| `public/locales/pl/translation.json`, `public/locales/en/translation.json` | **NIE DOTYCZY** — ten dyżur nie dodaje UI | — |
| `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY270_REALIZACJA_REPORT.md` | `§R.2` — **JEDYNY nowy dokument, jaki wolno Ci utworzyć** (`Z13`) | — |
| `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` | **TYLKO ODCZYT** (`Z14`) | Errata w raporcie |
| **Wszystko inne** | **TYLKO ODCZYT** | Opisujesz potrzebę w raporcie z dowodem plik:linia i idziesz dalej |

---

## B.2. TABELA POZYCJI Z DEFINICJĄ UKOŃCZENIA PER POZYCJA

| Pozycja | Nazwa jednym zdaniem | Rdzeń? | Wymaga plików przekrojowych? | DoD podniesione (min. testów) | Definicja ukończenia — co dokładnie musi być prawdą | Komenda dowodowa | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `§A.1` | dowód mutacyjny idempotencji runnera (Guard B / `ON CONFLICT DO UPDATE`) | TAK | NIE — dowód: cały pakiet jest CLI+SQL, zero HTTP | 2 (jeden test: mutacja czerwona, przywrócenie zielone) | Nowy test `tests/integration/day270-legacy-cutover-idempotency.realdb.test.ts` uruchamia runner DWA razy na tym samym rekordzie i asertuje: (1) liczba wierszy w `tasks` po drugim biegu = liczba po pierwszym; (2) po usunięciu klauzuli `ON CONFLICT` (mutacja w kopii pliku, `cp`) ta sama asercja **pada** | `§0.2c (C)` + mutacja opisana w `§A.1` niżej | `test(legacy-cutover): dowod mutacyjny idempotencji runnera (A.1)` |
| `§A.2` | pilot dokładnie 1 rekordu na lokalnej bazie | TAK | NIE | bazowe (0 nowych — to jest operacja, nie test) | Runner uruchomiony z `--organization-id=day204-m3-org --max-tasks=1` na bazie po seedzie `day204-m3-shape-seed-local.mjs`; **dokładnie 1** nowy wiersz w kanonicznym magazynie i **dokładnie 1** wiersz w `legacy_task_cutover_ledger`, policzone `SELECT COUNT(*)` przed i po | `docker exec cx-day270-pg psql … -c "SELECT COUNT(*) FROM legacy_task_cutover_ledger WHERE organization_id='day204-m3-org'"` przed/po | `docs(day270): log pilota 1 rekordu — wynik w raporcie (A.2)` (bez zmian w kodzie, jeśli runner nie wymaga poprawek) |
| `§A.3` | skrypt SQL pomiaru wypełnienia 64 pól legacy | TAK | NIE | n/d (skrypt SQL, nie test vitest) | `scripts/dev/day270-legacy-fields-fill.sql` istnieje, liczy `COUNT(*) FILTER (WHERE col IS NOT NULL)` dla WSZYSTKICH 64 kolumn z R2 raportu 239 (lista w `§A.3` niżej) na tabeli `tasks`; uruchomiony na Twojej lokalnej bazie (seed + realne dane, jeśli są), wynik w artefaktach; raport wprost pisze zdanie: „na stagingu uruchomi ten sam skrypt nadzorca" | `§0.2c (D)` | `feat(day270): skrypt pomiaru wypelnienia 64 pol legacy (A.3)` |
| `§A.4` | decyzja o `legacy_task_cutover_step_ledger` (podłączyć albo oznaczyć martwą) | NIE | NIE | n/d | Raport zawiera jawną decyzję z uzasadnieniem: (a) PODŁĄCZYĆ — jeśli tak, opisujesz JAK (który krok runnera powinien pisać `step_key`) jako rekomendację, **nie implementujesz** w tym dyżurze (poza zakresem etapu 1); albo (b) MARTWA — wpis w raporcie z dowodem `grep` zero konsumentów z produkcyjnej ścieżki | grep z `§0.1` weryfikacji (6) | brak zmian kodu — wpis w `§R.2` |
| `§R.2` | raport dyżuru | NIE | NIE | n/d | struktura z `§R.2`, sekcja „TWIERDZENIA NIEZWERYFIKOWANE" niepusta jeśli cokolwiek zostało nieskończone | — | `docs(day270): raport dyzuru (R.2)` |

> **Kolumna „Wymaga plików przekrojowych?" musi być wypełniona dla KAŻDEJ
> pozycji, z dowodem przy odpowiedzi `NIE`.** Wszystkie cztery pozycje robocze
> tego dyżuru odpowiadają `NIE` — dowód: żadna nie dotyka `auth.middleware.ts`,
> `Database.ts` ani tras HTTP; wszystkie idą przez CLI runnera i bezpośrednie
> zapytania SQL na lokalnym Postgresie.

---

## B.3. TABELA MIANOWNIKÓW

| # | Co liczę | Liczba autora instrukcji | Komenda, którą ją policzyłem (odtwarzalna, jedna linia) | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | linie `legacy-task-cutover-runner.ts` | 526 | `wc -l server/scripts/legacy-task-cutover-runner.ts` | TAK |
| 2 | kolumny legacy `tasks` bez prostego odpowiednika w kanonie (raport 239, R2) | 64 (z 80) | `grep -c "| K " docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY239_REALIZACJA_REPORT.md` (orientacyjnie — pełna lista jest w tabeli R2 tego raportu, wiersze 1-80) | TAK — zweryfikuj samodzielnie licząc wiersze tabeli R2 |
| 3 | pola najwyższego poziomu `ExecutionTask` | 17 | `grep -oE "^\s*[a-zA-Z]+:" server/src/domain/initiatives-execution/executionWork.ts \| sed -n '/interface ExecutionTask/,/^}/p'` (albo policz ręcznie w bloku interfejsu ok. linii 25-50) | TAK |
| 4 | pliki dziś piszące do `legacy_task_cutover_step_ledger` | 0 (z runnera), 2 (test + unit-of-work) | `grep -rln "legacy_task_cutover_step_ledger" . --include="*.ts" --include="*.mjs" \| grep -v node_modules` | TAK |
| 5 | wolne numery migracji w przedziale tego dyżuru | n/d — ten dyżur NIE tworzy migracji | — | n/d |

**Reguła kontrolna dla autora:** dla każdego wiersza wykonaj komendę i sprawdź,
czy zwraca niepusty, sensowny wynik na markerze. Wiersz 2 wymaga od wykonawcy
**ręcznego** przeliczenia tabeli R2 raportu 239 (kolumna klasyfikacji), bo
formatowanie tabeli markdown nie gwarantuje stabilnego grepu — **to jest
świadomie zostawione jako zadanie pomiarowe wykonawcy**, nie automatyzowane
tu na siłę.

---

## B.4. TABELA ROZŁĄCZNOŚCI — PLIKI DO ZAPISU TEGO DYŻURU

### B.4.1. Pliki zapisywane NA PEWNO

| # | Plik | Rodzaj (istniejący / NOWY) | Pozycja | Ryzyko kolizji + z kim |
| --- | --- | --- | --- | --- |
| 1 | `scripts/dev/day270-legacy-fields-fill.sql` | NOWY | `§A.3` | ZEROWE — nazwa niesie numer dyżuru |
| 2 | `tests/integration/day270-legacy-cutover-idempotency.realdb.test.ts` | NOWY | `§A.1` | ZEROWE |
| 3 | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY270_REALIZACJA_REPORT.md` | NOWY | `§R.2` | ZEROWE |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Pozycja | Warunek, po którego spełnieniu wolno zapisać |
| --- | --- | --- |
| kopia robocza `legacy-task-cutover-runner.ts` w scratchu | `§A.1` | wyłącznie do mutacji dowodowej, cofnięta przed commitem, `git diff` pusty |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE — imiennie

```
server/scripts/legacy-task-cutover-runner.ts (poza tymczasowa mutacja dowodowa)
server/migrations/20261721_legacy_task_cutover_ledger.sql
server/migrations/20261722_legacy_task_cutover_step_ledger.sql (zadna nowa migracja tworzaca dla niej wywolania)
Wszystko w src/ (front) — ten dyzur jest wylacznie zapleczowy
```

### B.4.4. Zasoby wyłączne tego dyżuru

| Zasób | Wartość | Sprawdzone (komenda + wynik) |
| --- | --- | --- |
| Port PostgreSQL | `6280` | `lsof -nP -iTCP:6280 -sTCP:LISTEN` → wykonawca sprawdza sam przed startem |
| Port harnessu | `5260 i 5261` | jw. — nie dotyczy tego dyżuru (brak harnessu HTTP), zarezerwowane dla spójności z paczką |
| Nazwa kontenera | `cx-day270-pg` | `docker ps --format '{{.Names}}'` → nie może zawierać `cx-day270-pg` przed startem |
| Nazwa bazy | `cx270` | — |
| Przedział migracji | **NIE DOTYCZY — zero nowych migracji w tym dyżurze** | `ls server/migrations/ | grep -cE "^202619[01]"` → oczekiwane 0 (rezerwacja pusta, nieużywana) |
| Gałąź | `codex/day270-realizacja-zadan-20260902` | nie istnieje na `github-backup` |
| Worktree | `/private/tmp/cx-day270-realizacja-zadan` | nie istnieje |
| Flagi funkcyjne | brak — zero nowych flag | `grep -rn "REALIZACJA_ZADAN" server/src/ src/ → 0 trafień` |

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
cd /private/tmp/cx-day270-realizacja-zadan
git diff --name-only --cached | tee /private/tmp/cx-day270-realizacja-zadan-artefakty/staged.txt
grep -iE 'legacy-task-cutover-runner\.ts$|20261721|20261722' /private/tmp/cx-day270-realizacja-zadan-artefakty/staged.txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---
---

# POZYCJE ROBOCZE — SZCZEGÓŁY

## §A.1 — Dowód mutacyjny idempotencji runnera (Guard B)

**Kontekst.** `ODBIOR_204.md` (`§Mutacja B`) stwierdza wprost: mutacja usuwająca
ochronę idempotencji **NIE spowodowała** czerwonego testu w całym repozytorium
— „tautologia", zero pokrycia. To jest luka DOWODOWA, nie luka w kodzie: kod
FIX-204-3/216-3 (`legacy-task-cutover-runner.ts:266-290`, `:412-429`) **już
istnieje** na tym markerze. Twoim zadaniem jest napisać test, który tę ochronę
**realnie** obciąża.

**Co budujesz.** Nowy plik `tests/integration/day270-legacy-cutover-idempotency.realdb.test.ts`:

1. Seeduje minimalny fixture (1 organizacja, 1 inicjatywa, 1 legacy task) —
   możesz użyć fragmentu `day204-m3-shape-seed-local.mjs` albo insertów
   inline w teście (Twoja decyzja, opisz w raporcie którą wybrałeś).
2. Uruchamia runner (przez `execFileSync`/import bezpośredni funkcji — sprawdź
   w pliku, czy eksportuje funkcję wywoływalną z testu, czy trzeba spawnować
   proces `tsx`; zmierz to samodzielnie i opisz w raporcie) z
   `--organization-id=<fixture> --max-tasks=1` **DWA RAZY POD RZĄD** na tym
   samym rekordzie.
3. Asertuje: `SELECT COUNT(*) FROM legacy_task_cutover_ledger WHERE
   legacy_task_id = $1` = **1** (nie 2) po drugim biegu.
4. Asertuje: kanoniczny magazyn (sprawdź nazwę tabeli/miejsca zapisu w
   `postgresMaterialCommandUnitOfWork.ts` albo tam, gdzie runner faktycznie
   zapisuje `ExecutionTask` — zmierz to w `R1`, nie zgaduj) ma **dokładnie 1**
   wiersz dla tego zadania, nie 2.

**Dowód mutacyjny (`Z32`, obowiązkowy):**

```bash
cp server/scripts/legacy-task-cutover-runner.ts /private/tmp/cx-day270-realizacja-zadan-scratch/runner-original.ts
# usun REALNIE klauzule ON CONFLICT (linia ok. 429) w roboczej kopii pliku w
# WT (nie w scratchu) — zastap ja np. samym INSERT bez ON CONFLICT, tak zeby
# drugi bieg probowal wstawic duplikat
# URUCHOM test z §0.2c (C) -> MUSI byc CZERWONY
# przywroc oryginal:
cp /private/tmp/cx-day270-realizacja-zadan-scratch/runner-original.ts server/scripts/legacy-task-cutover-runner.ts
git diff --stat server/scripts/legacy-task-cutover-runner.ts   # MA BYC PUSTE
# URUCHOM test ponownie -> MUSI byc ZIELONY
```

Obie komendy testowe i oba wyniki (czerwony/zielony) wklejasz do raportu
dosłownie, razem z `git diff` po przywróceniu.

---

## §A.2 — Pilot dokładnie 1 rekordu (lokalnie)

Po zielonym `§A.1` i po seedzie (`§0.2c B`):

```bash
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6280/cx270 \
  npx tsx server/scripts/legacy-task-cutover-runner.ts \
  --organization-id=day204-m3-org --max-tasks=1 \
  | tee /private/tmp/cx-day270-realizacja-zadan-artefakty/day270-pilot-run.log
```

(Sprawdź samodzielnie realną nazwę CLI-flag i sposób wywołania pliku — plik
może eksportować funkcję zamiast `main()` uruchamianego wprost; jeśli `tsx
server/scripts/legacy-task-cutover-runner.ts …` nie działa, zmierz w R1 jak
plik jest faktycznie wołany — poszukaj `package.json`/innych skryptów
wywołujących go, albo napisz cienki wrapper w `scratch`, NIE w repo, jeśli to
jedyny sposób odpalenia funkcji.)

**Przed i po**, policz wiersze:

```bash
docker exec cx-day270-pg psql -U postgres -d cx270 \
  -c "SELECT COUNT(*) FROM legacy_task_cutover_ledger WHERE organization_id='day204-m3-org';"
docker exec cx-day270-pg psql -U postgres -d cx270 \
  -c "SELECT COUNT(*) FROM tasks WHERE organization_id='day204-m3-org';"
```

**Definicja ukończenia:** dokładnie **+1** wiersz w `legacy_task_cutover_ledger`
po pilocie względem przed, i **0** zmian w liczbie wierszy `tasks` (transfer
kopiuje, nie usuwa źródła — zweryfikuj to założenie w kodzie runnera i opisz,
jeśli jest inaczej). Jeśli pilot przeniesie 0 albo więcej niż 1 rekord — to
jest **STOP MERYTORYCZNY** tej pozycji, nie do obejścia: opisz dokładnie co
się stało, z pełnym logiem, i nie kontynuuj partii.

---

## §A.3 — Skrypt SQL pomiaru wypełnienia 64 pól legacy

**Cel.** Dać nadzorcy gotowy, odtwarzalny skrypt do policzenia na stagingu,
ile z 64 kolumn `tasks` (bez prostego odpowiednika w kanonie, lista w
`CODEX_DAY239_REALIZACJA_REPORT.md`, sekcja R2, wiersze tabeli 1-80,
klasyfikacja „K") ma realnie niepuste wartości. **Ty NIE uruchamiasz go na
stagingu (`Z9`, `Z28`)** — tylko piszesz i uruchamiasz lokalnie na seedzie/
swojej bazie testowej.

**Co budujesz.** `scripts/dev/day270-legacy-fields-fill.sql`, jeden `SELECT`
w kształcie:

```sql
SELECT
  COUNT(*) AS total_rows,
  COUNT(checklist) AS checklist_filled,
  COUNT(attachments) AS attachments_filled,
  COUNT(tags) AS tags_filled,
  COUNT(task_type) AS task_type_filled,
  -- ... jedna kolumna na kazde z 64 pol z listy R2 (skopiuj DOKLADNIE nazwy
  -- kolumn z tabeli R2 raportu 239 — NIE zgaduj nazw, przepisz je z pliku)
  COUNT(idea_id) AS idea_id_filled
FROM tasks;
```

Przepisz **wszystkie 64** nazwy kolumn z tabeli R2 raportu 239 dosłownie —
znajdziesz je w `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY239_REALIZACJA_REPORT.md`,
wiersze tabeli oznaczone klasyfikacją `K` (kolumna ostatnia tabeli w R2).
Jeżeli licząc samodzielnie naliczysz inną liczbę niż 64 — **to jest wynik,
nie sprzeczność** (`Z24`): wpisz swoją liczbę do raportu z dowodem (numery
wierszy tabeli, które policzyłeś jako `K`).

Dołącz nagłówek komentarza w pliku SQL:

```sql
-- day270-legacy-fields-fill.sql
-- Pomiar wypelnienia kolumn legacy `tasks` bez prostego odpowiednika w
-- kanonicznym ExecutionTask (klasyfikacja "K", CODEX_DAY239_REALIZACJA_REPORT.md R2).
-- URUCHAMIANE PRZEZ NADZORCE NA STAGINGU. Codex uruchamia WYLACZNIE lokalnie (Z9, Z28).
```

Uruchom lokalnie (`§0.2c D`) i wklej wynik do raportu i artefaktów.

---

## §A.4 — Decyzja: `legacy_task_cutover_step_ledger`

Zmierzone w weryfikacji wejściowej (6): tabela istnieje (migracja
`20261722`), ale **runner nigdy do niej nie pisze** — jedyny pisarz w
repozytorium to `postgresMaterialCommandUnitOfWork.ts`, wywoływany wyłącznie
z testu `tests/integration/day204-r1-mines.realdb.test.ts`, **nie** z
`legacy-task-cutover-runner.ts`. To jest ÓSMY kształt fałszywego „gotowe" —
biblioteka bez wywołania z produkcyjnej ścieżki transferu.

**Zadanie:** zapisz w raporcie jedną z dwóch decyzji, z uzasadnieniem opartym
na pomiarze, nie na domysłach:

- **PODŁĄCZYĆ** — jeśli uznasz, że runner cutover POWINIEN zapisywać krok do
  `legacy_task_cutover_step_ledger` (np. jako ślad audytowy per etap
  transferu), opisz DOKŁADNIE które miejsce w runnerze (numer linii) i jaki
  `step_key`/`command_type` powinno wstawić. **Nie implementuj tego w tym
  dyżurze** — to należy do etapu 2 (poza zakresem `§0.2` `Z17`).
- **MARTWA** — jeśli uznasz, że `postgresMaterialCommandUnitOfWork.ts` obsługuje
  zupełnie inny przepływ (M3 material commands, nie legacy cutover) i tabela
  `step_ledger` jest po prostu przygotowana pod przyszłą funkcję niezwiązaną
  z tym dyżurem, wpisz to jako wniosek z dowodem (`grep` obu ścieżek kodu,
  porównanie ich domen).

**Nie kasujesz** migracji ani tabeli w żadnym wariancie (`Z40`).

---
---

## §R.1 — Podniesienie rejestru (NIE DOTYCZY tego dyżuru)

Ten dyżur jest przekrojowy/zapleczowy i nie ma przypisanego pliku
`MODULE_ACCEPTANCE.md`. Nie tworzysz ani nie zmieniasz żadnego takiego pliku.

## §R.2 — Raport dyżuru

Dokładnie jeden plik:
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY270_REALIZACJA_REPORT.md`

Struktura obowiązkowa:

1. **Nagłówek** — SHA markera, gałąź, data, czas trwania.
2. **Wynik weryfikacji stanu wejściowego** — 10 komend z `§0.1`, wklejone
   dosłownie z wynikami.
3. **`§A.1`** — kod testu, oba przebiegi mutacyjne (czerwony/zielony), pełne
   nazwy testów przed/po (`§0.4a`).
4. **`§A.2`** — log pilota, liczby przed/po.
5. **`§A.3`** — treść skryptu SQL (albo link do pliku), wynik lokalny.
6. **`§A.4`** — decyzja z uzasadnieniem.
7. **Korekty wobec instrukcji** — każda rozbieżność pomiaru z tym dokumentem.
8. **STOP-y**, jeśli były, w formacie z `§0.5`.
9. **TWIERDZENIA NIEZWERYFIKOWANE** — sekcja obowiązkowa, niepusta jeśli
   cokolwiek zostało nieskończone albo niepewne.
10. **Manifest artefaktów** — ścieżki w `/private/tmp/cx-day270-realizacja-zadan-artefakty`
    i `shasum -a 256` każdego pliku wynikowego.

---
---

## ★★ JEŚLI COŚ W TEJ INSTRUKCJI JEST SPRZECZNE LUB NIEWYKONALNE

**Ta instrukcja była pisana i sprawdzana przez człowieka i model. Może mieć
błędy. Nie zatrzymuj przez nie dyżuru.**

**Procedura, dosłownie:**

1. **Opisz sprzeczność w raporcie**, w sekcji „Korekty wobec instrukcji":
   cytat obu wykluczających się zdań z numerami paragrafów, na czym polega
   konflikt, jaki masz dowód i co zrobiłeś.
2. **Wybierz interpretację BEZPIECZNIEJSZĄ.** Reguły rozstrzygające, w tej
   kolejności: nie ruszaj cudzego pliku · nie osłabiaj asercji · nie kasuj
   (wpisz `DO DECYZJI WŁAŚCICIELA`) · nie włączaj flagi · nie wysyłaj niczego
   na zewnątrz · nie poszerzaj dostępu · mierz zamiast zgadywać.
3. **KONTYNUUJESZ POZOSTAŁE POZYCJE.**
4. **Zatrzymanie CAŁEGO dyżuru** — wyłącznie z pięciu powodów w `§0.5`.
5. **Nigdy nie „naprawiaj" instrukcji przez improwizację w kodzie.**
6. **★ Rozbieżność między pomiarem a tą instrukcją NIE JEST sprzecznością —
   jest WYNIKIEM.**

**★ Ostatnie zdanie tej instrukcji i najważniejsze: obalenie którejkolwiek
tezy z sekcji „TEZY ZLECENIA…" (tytuł dokumentu, weryfikacja wejściowa) jest
SUKCESEM dyżuru, a nie porażką. Zapisz to w „Korektach wobec instrukcji"
z dowodem i idź dalej.**

---
---

## AUDYT WYKONANY PRZEZ AUTORA

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — brak par wymagań wzajemnie się wykluczających znalezionych przy pisaniu | TAK |
| 2 | Każda ścieżka pliku zweryfikowana na markerze `444d789363` przed wydaniem | TAK |
| 3 | Każda liczba ma odtwarzalną komendę (tabela `B.3`) | TAK |
| 4 | Tabela licencji kompletna, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK |
| 5 | Wykonalność per pozycja bez plików przekrojowych — wszystkie 4 pozycje `NIE` z dowodem | TAK |
| 6 | Przydział zasobów wyłącznych sprawdzony wobec dyżurów 271-273 (ta sama paczka) | TAK |
| 7 | Komendy paste-ready, pełne ścieżki, komplet env w jednej linii, `--retry=0` | TAK |
| 8 | Pułapki środowiska wklejone w całości (18 rdzenia + `§0.2e (e)` własna) | TAK |
| 9 | Samodzielność dokumentu — zero odwołań do ustaleń poza repo | TAK |
| 10 | Klauzula sprzeczności obecna i pełna; `grep -c '<<' <plik>` → `0` | TAK |
