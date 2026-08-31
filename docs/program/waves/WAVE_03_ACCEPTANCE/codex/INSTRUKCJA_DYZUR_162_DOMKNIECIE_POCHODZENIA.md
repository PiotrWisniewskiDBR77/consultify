# INSTRUKCJA DYŻURU nr 162 — Codex — „Domkniecie sladu pochodzenia i usuniecie nieprawdziwego wpisu o cofaniu z dziennika audytu"

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
> **wyłącznie** `/private/tmp/cx-day162-domkniecie-pochodzenia`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `218d020958`**
> **Gałąź bazowa: `github-backup/codex/m03-admin-20260824`**
> **Stan dokumentu: WYDANY**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo jakiekolwiek niewypelnione pole szablonu — **dokument nie
> jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.
> Ta ramka jest **jedynym** miejscem, w którym rozstrzyga się stan wydania.
> Objaśnienia w innych blokach cytowanych **nie** są powodem do STOP-u.

Data wystawienia: 2026-08-30.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.
Zakres: **Moja Praca / Teresa - pochodzenie zadan i uczciwosc dziennika audytu**.
Trasy front: `brak zmian - front wylacznie do odczytu przy ustalaniu, czy ktokolwiek czyta pochodzenie`. Trasy tył: `\`server/src/services/aiActionExecutor.ts\`, \`server/src/ai/actionExecutors/taskExecutor.ts\`, \`server/src/routes/my-work.routes.ts\` (trasa \`POST /personal-tasks\`); do odczytu: \`src/components/AIChat/ActionCenter.tsx\`, \`server/src/controllers/TaskController.ts\`, \`server/src/services/v8/teresaCopilotService.ts\` jako wzorzec uczciwego zapisu`.

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
WT=/private/tmp/cx-day162-domkniecie-pochodzenia
MARKER=218d020958

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day162-domkniecie-pochodzenia-20260830 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day162-domkniecie-pochodzenia/config.worktree"
cat "$VAULT/worktrees/cx-day162-domkniecie-pochodzenia/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day162-domkniecie-pochodzenia-scratch
mkdir -p /private/tmp/cx-day162-domkniecie-pochodzenia-artefakty

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
git -C "$VAULT" log --oneline 218d020958..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only 218d020958..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day162-domkniecie-pochodzenia-20260830
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 218d020958..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `cztery` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day162-domkniecie-pochodzenia

# (T1) CZY NAPIS O COFANIU MA JAKIEGOKOLWIEK CZYTELNIKA
grep -rn "rollback_available\|rollbackStatus\|rollbackStrategy" server/src src --include='*.ts' --include='*.tsx' | grep -v __tests__
#   oczekiwane: same miejsca ZAPISU w aiActionExecutor.ts, zero odczytow.
#   Potwierdz sam. Jesli znajdziesz czytelnika, cala teza dyzuru sie zmienia - zglos to.

# (T2) CZY ISTNIEJE JAKAKOLWIEK TRASA COFANIA MATERIALIZACJI
grep -nE "^router\.(get|post|put|patch|delete)" server/src/routes/my-work/agent-materialization.routes.ts
#   oczekiwane: piec tras, zero DELETE/undo/revert.

# (T3) CZY KOLUMNA tasks.source MA CZYTELNIKA
grep -rn "\.source\b" server/src src --include='*.ts' --include='*.tsx' | grep -i task | grep -v source_type | grep -v source_id | head
#   To rozstrzyga pozycje R3. Kolumna bez czytelnika NIE POTRZEBUJE pisarza.
#   Nie dopisuj pisarza tylko dlatego, ze kolumna istnieje.

# (T4) CZY TABELA AUDYTU JEST APPEND-ONLY
grep -rn "admin_audit_logs\|audit_events\|append.only\|APPEND_ONLY" server/migrations/*.sql | head -8
#   Ustal to ZANIM cokolwiek zmienisz w ksztalcie wpisu.
```

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day162-domkniecie-pochodzenia-20260830` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6050`. Twój JEDYNY port harnessu to `4992 i 4993`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day162-pg`**. **ZAKAZANE:** `6012, 5433, 6039/4972-4973 (153), 6044/4982-4983 (157), 6045/4984-4985 (158), 6046/4986-4987 (159), 6047 (odbior nadzorcy 159), 6048/4988-4989 (160), 6049/4990-4991 (161)`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak - ten dyzur NIE wprowadza ani jednej nowej flagi i NIE zmienia wartosci domyslnej zadnej istniejacej`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY162_DOMKNIECIE_POCHODZENIA_REPORT.md`. Nie zmieniasz zadnego `MODULE_ACCEPTANCE.md` - ten dyzur nie zamyka modulu menu. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day162-domkniecie-pochodzenia-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day162-domkniecie-pochodzenia-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **NIE RUSZASZ WPISOW AUDYTU, KTORE JUZ SA W BAZIE.** Zmiana dotyczy wylacznie tego, co produkt zapisze OD TERAZ. Przepisywanie historii audytu jest zakazane bezwarunkowo, takze na bazie lokalnej. **NIE ZMIENIASZ ZADNEGO ISTNIEJACEGO PLIKU MIGRACJI** - rownolegle biegnie dyzur 161, ktory dotyka \`server/migrations/*.sql\`; masz prawo utworzyc wylacznie jeden nowy plik o nazwie \`server/migrations/20260830_day162_provenance_closure.sql\` i tylko wtedy, gdy pomiar wykaze, ze jest potrzebny. **NIE ZDEJMUJESZ I NIE ZAWEZASZ BRAMY 409** - to jest terytorium dyzuru 160 i osobnej decyzji wlasciciela. Naprawiasz pochodzenie na sciezce, ktora **dzis dziala**, nie otwierasz zamknietej. **NIE ZMIENIASZ \`teresaCopilotService.ts\`** - sluzy wylacznie za wzorzec do odczytu. **Zero polaczen do bazy zdalnej, demo, stagingu i produkcji.** | Odbior dyzuru 157 wykryl, ze produkt zapisuje \`rollbackStatus: 'rollback_available'\` ze strategia \`delete_created_output_refs\`, a mechanizmu cofania dla tej sciezki nie ma. **Nadzorca zalozyl, ze napisu nikt nie czyta - i to bylo blednie.** Napis jest renderowany czlowiekowi: \`src/components/AIChat/ActionCenter.tsx:311\` wyswietla doslownie \`Rollback: rollback available\`, na realnej trasie (\`src/routes/AppRoutes.tsx:1754\`). **To czyni sprawe powazniejsza, nie lzejsza: klamstwo widzi uzytkownik, nie tylko dziennik.** Druga sprawa: kolumna \`tasks.source\` ma pisarza i czytelnika, ale **jedyny pisarz siedzi za brama 409**, a jedyna dzialajaca sciezka tworzenia zadania go nie zapisuje - wiec plakietka pochodzenia klamie tak samo |

---

### 0.2b. ★★ PROTOKÓŁ `Z30` — ZERO WYSYŁKI, A MIMO TO PEŁNY DOWÓD

**(1) Czego NIE WOLNO Ci zrobić — nigdy:**
- ustawić `ENABLE_LIVE_EMAIL` na `true`;
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
cd /private/tmp/cx-day162-domkniecie-pochodzenia

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL|ENABLE_LIVE_EMAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day162-pg psql -U postgres -d cx162 \
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
cd /private/tmp/cx-day162-domkniecie-pochodzenia

docker run -d --name cx-day162-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx162 \
  -p 127.0.0.1:6050:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day162-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6050/cx162 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6050/cx162 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day162-domkniecie-pochodzenia && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6050/cx162 \
JWT_SECRET=cx162-test-secret-do-not-reuse \
npx vitest run server/src/services/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day162-domkniecie-pochodzenia-artefakty/day162-vitest.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day162-domkniecie-pochodzenia && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/services/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day162-domkniecie-pochodzenia-artefakty/day162-vitest.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day162-domkniecie-pochodzenia/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day162-pg psql -U postgres -d cx162 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day162-pg`.
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
> **(e) **Trzy ustalenia nadzorcy zostaly OBALONE przy skladaniu tej instrukcji. Nie powtarzaj ich za nim.** (1) \`rollback_available\` **MA czytelnika** - \`ActionCenter.tsx:311\` renderuje ten napis uzytkownikowi. Nadzorca twierdzil, ze czytelnika nie ma. (2) \`tasks.source\` **MA pisarza i czytelnika** - zapis \`TaskController.ts:1291\`, odczyt \`:747\` (z domyslka \`t.source || 'manual'\`), walidacja \`task.validators.ts:36,63\`, front rysuje plakietke AI/Manual w \`TasksMilestonesSection.tsx:699,949,1516\`. Teza dyzuru 157 o braku pisarza byla bledna. **Prawdziwy defekt jest inny i ostrzejszy:** jedyny pisarz \`source\` siedzi w \`createTask\` **za brama 409**, a dzialajaca sciezka \`POST /api/my-work/personal-tasks\` (\`my-work.routes.ts:1379\`) zapisuje wylacznie \`source_type\` i \`source_id\`, i to **warunkowo** - \`source\` nie zapisuje **nigdy**. Skutek: kazde zadanie utworzone dzialajaca droga pokazuje sie jako **'Manual'**, nawet gdy stworzyl je agent. (3) Sciezka \`server/src/services/taskExecutor.ts\` **nie istnieje** - prawdziwa to \`server/src/ai/actionExecutors/taskExecutor.ts\`. **Czwarta pulapka, techniczna:** \`ai_run_ledger.audit\` jest **NADPISYWANY** (\`aiRunLedgerService.ts:264-278\`, UPDATE), wiec nie jest append-only; \`ai_run_events.details\` dostaje wylacznie INSERT, ale to **konwencja kodu, nie ograniczenie bazy**. Sprawdz to sam, zanim zmienisz ksztalt wpisu. **Piata:** gotowy wzorzec uczciwego zapisu juz istnieje w \`teresaCopilotService.ts\` (\`rollback_unavailable\` domyslnie, \`rolled_back\` dopiero po realnym cofnieciu) - **przeczytaj go i nasladuj, nie wymyslaj wlasnego**; tego pliku NIE zmieniasz.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day162-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day162-domkniecie-pochodzenia-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`pozycja R2 - produkt przestaje pokazywac czlowiekowi nieprawde o dostepnosci cofania, z dowodem mutacyjnym; oraz R3 - plakietka pochodzenia zadania przestaje klamac`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6050` albo `4992 i 4993` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6050` albo `4992 i 4993`** (`Z7`).

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

Dyżur 157 zostawił dwa różne braki pod jedną nazwą „ślad pochodzenia" i jedno realne kłamstwo
w dzienniku audytu. Ten dyżur domyka pierwsze i usuwa drugie. Zanim jednak cokolwiek naprawisz,
przeczytaj poniższą korektę do ustaleń nadzorcy — jedno z nich, po weryfikacji w kodzie, okazało
się **nieprawdziwe**, i to zmienia kształt zadania.

## Korekta ustaleń nadzorcy (zweryfikowana w kodzie, nie w dokumentach)

**Ustalenie A nadzorcy („`tasks.source` nie ma ani jednego pisarza") jest błędne.** Zarówno
raport dyżuru 157 (`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY157_SLAD_POCHODZENIA_REPORT.md`,
sekcja R1: „`tasks.source` ... NIE; brak jawnego pisarza") jak i brief tego dyżuru powtarzają tę
tezę bez sprawdzenia całego łańcucha. Realny pisarz istnieje i jest w pełni okablowany:

- `server/src/validators/task.validators.ts:36` — `TaskSourceEnum = z.enum(['manual', 'ai'])`.
- `server/src/validators/task.validators.ts:63` — `CreateTaskSchema` ma pole
  `source: TaskSourceEnum.optional().default('manual')`. To pole PRZECHODZI walidację żądania.
- `server/src/controllers/TaskController.ts:1229` — `finalSource = source === 'ai' ? 'ai' : 'manual'`.
- `server/src/controllers/TaskController.ts:1291` — kolumna `source` w liście `INSERT INTO tasks (...)`.
- `server/src/controllers/TaskController.ts:1332` — `finalSource` jako parametr tego INSERT-u.
- `server/src/routes/pmo/tasks.routes.ts:90-95` — `POST /` (czyli `POST /api/tasks`) woła
  `TaskController.createTask` po walidacji `CreateTaskSchema`. Ścieżka jest żywa i osiągalna z HTTP.
- Odczyt: `server/src/controllers/TaskController.ts:747` i `:1052` — `source: t.source || 'manual'`
  w odpowiedzi `GET /tasks` i `GET /tasks/:id`.
- Odczyt frontu: `src/components/Initiatives/InitiativeDocumentView.tsx:2655` mapuje
  `source: t.source || 'manual'` z odpowiedzi `GET /tasks?initiativeId=...`, zapisuje do
  `TaskItem.source` (typ w `src/components/Initiatives/sections/types.ts:69`,
  `'manual' | 'ai'`).
- Odczyt UI: `src/components/Initiatives/sections/TasksMilestonesSection.tsx:699, :949, :1516`
  czyta `task.source`, żeby pokazać plakietkę „AI"/„Manual" i przefiltrować listę zadań w
  widoku Inicjatywy → Zadania i kamienie milowe (`SOURCE_CONFIG[source]`).

Czyli `tasks.source` jest żywą, w pełni okablowaną funkcją produktu: konsultant widzi w
Inicjatywach, czy zadanie powstało ręcznie czy z AI. **Nie usuwasz tej kolumny i nie zgłaszasz
jej jako martwej — to byłby błąd na podstawie niesprawdzonego założenia.**

**Ustalenie B nadzorcy o ścieżce pliku jest częściowo błędne.** `server/src/services/taskExecutor.ts`
**nie istnieje**. Prawdziwa ścieżka to `server/src/ai/actionExecutors/taskExecutor.ts` (94 linie,
wołana z `server/src/ai/actionExecutionAdapter.ts` i `server/src/services/ai/tools/createTask.ts`
— czyli z narzędzia „utwórz zadanie" dostępnego AI w rozmowie czatowej, ścieżka `/api/my-work/chat-actions`
wg komentarza na górze pliku). Ta ścieżka rzeczywiście nie zapisuje żadnej kolumny pochodzenia —
`add('organization_id', ...)` przez `add('updated_by', ...)` (linie 55-67) nie wywołuje `add('source', ...)`
ani `add('source_type', ...)`. Skoro `tasks.source` ma DOMYŚLNĄ wartość `'manual'` na poziomie
Postgresa (`server/migrations/20260213_task_source_origin.sql`:
`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual'`), zadanie utworzone
tą drogą przez AI **pokazuje się w Inicjatywach jako „Manual"** — realny, widoczny błąd etykiety,
nie tylko brak danych.

Ta sama mechanika dotyczy `server/src/services/aiActionExecutor.ts:1092` (`_executeCreateTask`,
INSERT na linii 1101): kolumny `id, organization_id, project_id, title, description, assignee_id,
due_date, status, created_by` — bez `source`, `source_type`, `source_id`. Wołane z
`executeAction` (linia 828), czyli z zatwierdzonej propozycji AI (`POST` na `AIActionExecutor.executeAction`,
zamontowane w `server/src/routes/ai.routes.ts` ok. linii 6888 i 7952-8000). Ten sam skutek:
zadanie utworzone przez zatwierdzoną akcję AI dostaje domyślne `source='manual'` i kłamie w UI.

**Ustalenie C nadzorcy o dzienniku audytu jest w większości trafne, ale jedno zdanie jest
nieprawdziwe i to akurat najważniejsze zdanie: „ten napis nie jest nigdzie odczytywany".**
Jest odczytywany:

- `src/components/AIChat/ActionCenter.tsx:311` —
  `` Rollback: {String(selectedAudit.audit?.rollbackStatus || 'rollback_unavailable').replace(/_/g,' ')} ``.
  To dosłowny napis „Rollback: rollback available", widoczny CZŁOWIEKOWI w panelu „Audit Viewer".
- Ten komponent jest zamontowany pod realnym routem: `src/routes/AppRoutes.tsx:1754`
  (`ROUTES.AI_OS.ACTION_CENTER`, ścieżka `/ai/action-center` —
  `src/routes/routeConfig.ts:304`), w `renderInternalToolsShell`. To ekran wewnętrzny/dla
  administracji, nie dla klienta końcowego — ale to wciąż realny, osiągalny ekran, nie martwy kod.

To znaczy: kłamstwo nie jest teoretyczne. Ktoś, kto otworzy `/ai/action-center` i kliknie
akcję wykonaną przez AI, zobaczy dosłowny napis „Rollback: rollback available" — i nie ma
żadnego przycisku ani endpointu, który by to cofnięcie wykonał. To CZYNI naprawę ważniejszą,
nie mniej ważną, niż sugerował brief.

**Korekta routera „dowodu braku cofania".** Router `server/src/routes/my-work/agent-materialization.routes.ts`
(5 tras, potwierdzone: 2×GET linie 32/40, 3×POST linie 51/64/76, zero DELETE/undo/revert) —
to jest PRAWDA, ale to jest router **innej funkcji** (materializacja z propozycji agenta,
obszar dyżuru 157 — `source_type`/`source_id` dla `myw_agent_proposal`), nie router obsługujący
`AIActionExecutor.executeAction`. Prawdziwy dowód braku cofania dla ŚCIEŻKI Z PUNKTU C to
`server/src/routes/ai.routes.ts` — sprawdź go: grep `undo|rollback|revert` w tym pliku (poza
liniami 652-653, które są `client.query('ROLLBACK')` transakcji SQL, nie endpointem) nie daje
żadnej trasy operującej na `ai_actions`/`ai_run_ledger`. Zweryfikuj to jeszcze raz sam, zanim
napiszesz to w raporcie jako fakt — ja sprawdziłem to statycznie, nie na żywym API.

**Ważne dla wariantu naprawy (b) — tabela `ai_run_ledger` NIE jest append-only.**
`server/src/services/aiRunLedgerService.ts:264-278` — funkcja `recordAIRunEvent` robi
`UPDATE ai_run_ledger SET status = ?, output_refs = ?, audit = ?, ...` przy KAŻDYM zdarzeniu,
scalając stary `audit` JSON z nowym (`auditPatch` linia ~237-243). Czyli pole `audit.rollbackStatus`
w tabeli `ai_run_ledger` jest już dziś nadpisywane wielokrotnie w toku życia jednego przebiegu —
zmiana tego, co się tam zapisuje OD TERAZ, nie łamie żadnej gwarancji „append-only", bo takiej
gwarancji na tej kolumnie nie ma. Osobna tabela, `ai_run_events` (schemat w tym samym pliku,
linie 174-183; INSERT na liniach 254-261), dostaje wyłącznie INSERT w całym tym pliku — zachowuje
się jak dziennik zdarzeń append-only, ale to konwencja kodu, nie ograniczenie bazy (brak triggera
blokującego UPDATE/DELETE). Sprawdź samodzielnie, czy poza `aiRunLedgerService.ts` coś jeszcze
pisze do tych dwóch tabel (na dziś: `grep` znajduje tylko odczyty w
`wave7ConnectorRuntimeService.ts:467` i `wave8AgentRuntimeService.ts:740`).

**Wzorzec uczciwego zapisu już istnieje w kodzie — nie w plikach tego dyżuru, tylko do
przeczytania.** `server/src/services/v8/teresaCopilotService.ts` (poza licencją zapisu — WYŁĄCZNIE
odczyt, jeśli w ogóle) robi dokładnie to, czego brakuje w `aiActionExecutor.ts`: przy zakończeniu
wykonania handoffu zapisuje `rollbackStatus: 'rollback_unavailable'` (linia ok. 1849) jako
DOMYŚLNĄ, pesymistyczną wartość — i dopiero funkcja `undoProposal` (linia 1923), po realnym
wykonaniu cofnięcia dla modułu `excele`, nadpisuje na `rollbackStatus: 'rolled_back'` (linia ok.
2068). Dla `kpi`/`roi`/`okr` `undoProposal` jawnie rzuca błąd „undo nie jest wspierane" zamiast
fabrykować cofnięcie. To jest wariant (b) nadzorcy, już wdrożony gdzie indziej w tej samej bazie
kodu — masz go jako wzorzec do naśladowania w `aiActionExecutor.ts`, nie do kopiowania pliku.

## Czym ten dyżur NIE jest

Nie jest przeróbką `teresaCopilotService.ts` — ten plik czytasz jako wzorzec, nie zmieniasz
(nie ma go w tabeli licencji). Nie jest budową mechanizmu cofania dla `_executeCreateTask` ani
dla żadnej innej akcji AI — jeśli mechanizmu nie ma, dziennik audytu ma to mówić wprost, kropka;
budowa realnego cofania to osobny, przyszły dyżur. Nie jest zmianą routera
`agent-materialization.routes.ts` ani żadnego pliku z zakresu dyżuru 157/161 poza jednym wyjątkiem
opisanym niżej w zakazie migracji. Nie jest przepisywaniem `TaskService.ts` pod WSZYSTKICH sześciu
wołających — `TaskService.createTask()` ma dziś sześciu wołających
(`work-canvas.routes.ts`, `v8/interview-insights.routes.ts`, `canvasMaterialize.ts`,
`cqrs/task/CreateTask.ts`, `myWork/agentApprovedMaterializationService.ts`,
`resultsVnext/kpi/kpiRecoveryChildCommands.ts`, `meeting/meetingNoteTaskFunnelService.ts` — sprawdź
tę listę sam, mogła się zmienić) i nie wiadomo bez pomiaru, które z nich są jednoznacznie
AI-owe. Nie zgadujesz tego — patrz pozycja R3.

# 2. TEZY ZLECENIA

- **T1.** `rollbackStatus: 'rollback_available'` w dzienniku audytu AI jest odczytywany przez
  człowieka na realnym, osiągalnym ekranie (`/ai/action-center`) i nie odpowiada mu żaden
  mechanizm cofania. To jest fałszywy zapis w produkcie, nie martwy kod — priorytet 1 tego
  dyżuru.
- **T2.** Naprawa dziennika audytu ma dotyczyć wyłącznie tego, co produkt zapisze OD TERAZ.
  `ai_run_ledger.audit` jest już dziś nadpisywany na każdym zdarzeniu (nie jest append-only) —
  zmiana treści zapisu nie łamie żadnej istniejącej gwarancji. `ai_run_events.details` jest
  insert-only z konwencji kodu — twoja zmiana też tam tylko dopisuje nowe zdarzenia, nie
  modyfikuje starych.
- **T3.** `tasks.source` to żywa funkcja produktu (plakietka AI/Manual w Inicjatywach) z
  realnym pisarzem (`TaskController.createTask`, ścieżka ręczna z UI/API) i realnym czytelnikiem.
  Dwie AUTONOMICZNE ścieżki tworzenia zadania przez AI (`aiActionExecutor.ts` `_executeCreateTask`,
  `ai/actionExecutors/taskExecutor.ts`) nigdy jej nie ustawiają, więc zadania utworzone tam
  pokazują się jako „Manual" mimo że powstały z AI — to błąd etykiety do naprawienia, bo obie
  ścieżki ZAWSZE tworzą zadanie z inicjatywy AI (nie ma tu niejednoznaczności, w przeciwieństwie
  do `TaskService.ts`).
- **T4.** `TaskService.ts` ma wielu wołających o niejasnym pochodzeniu (część może być
  user-driven, część AI-driven) — nie wolno zgadywać `source='ai'` dla wszystkich. Wymaga
  pomiaru per-wołający, zanim cokolwiek się tam zmieni.

# 3. POZYCJE DYŻURU

## R1 — pomiar zasięgu kłamstwa w dzienniku audytu

Na lokalnym Postgresie (kontener wyłączny, patrz zasoby) zasiej scenariusze `ai_actions` →
`executeAction` przez co najmniej dwa typy akcji (`CREATE_DRAFT_TASK` i jeszcze jeden z
`ACTION_TYPES`, np. `CREATE_DRAFT_INITIATIVE` lub `CREATE_DRAFT_DECISION` — sprawdź nazwy stałych
w `server/src/services/aiActionExecutor.ts`). Dla każdego policz: ile wpisów `ai_run_events.details`
i `ai_run_ledger.audit` niesie `rollbackStatus: 'rollback_available'` kontra `'rollback_unavailable'`.
Sprawdź też **czy `rollback_unavailable` jest gdziekolwiek czytany** poza `ActionCenter.tsx:311`
(gdzie oba warianty trafiają do tego samego napisu) — jeśli znajdziesz asymetrię (np. coś
warunkuje UI tylko na `rollback_available`, nigdy na `rollback_unavailable`), zapisz to w
raporcie jako osobne ustalenie z plik:linia.

**Ukończone, gdy:** masz w raporcie tabelę typ akcji → liczba `rollback_available` / liczba
`rollback_unavailable` na zasianym zbiorze lokalnym, z dowodem `SELECT` na obu tabelach
(`ai_run_ledger`, `ai_run_events`).

## R2 — usunięcie kłamstwa: wariant (b), wartość uczciwa

W `server/src/services/aiActionExecutor.ts` zmień `rollbackStateForResult` (dziś linie 145-163)
tak, by domyślnie zwracała `rollback_unavailable`, i podnoś ją do `rollback_available` WYŁĄCZNIE
tam, gdzie faktycznie istnieje ścieżka cofnięcia dla danego typu akcji. Zmierz najpierw (jak w R1),
czy TAKA ścieżka istnieje dla którejkolwiek z akcji obsługiwanych przez `executeAction` (linia 779)
— `grep` po `ai.routes.ts` wskazuje, że nie istnieje dla żadnej. Jeśli pomiar to potwierdzi,
najprostsza uczciwa naprawa to: funkcja zawsze zwraca `rollback_unavailable`,
`rollbackAvailable: false`, `rollbackStrategy: undefined` — usuń logikę `hasOutputRef`, bo dziś
ona kłamie systematycznie (KAŻDA udana akcja z polem `*Id` w wyniku dostaje fałszywe
`rollback_available`). Nie zmieniasz kształtu JSON-a (`rollbackStatus`/`rollbackAvailable`/
`rollbackStrategy` zostają jako klucze) — to jest właśnie wariant (b): wartość się zmienia,
kontrakt nie.

**Ukończone, gdy:** masz dowód mutacyjny — przywróć na chwilę starą (kłamiącą) wersję
`rollbackStateForResult`, pokaż że test z R4 wtedy PADA, przywróć naprawioną wersję, pokaż że
test PRZECHODZI, i pokaż czyste `git diff` na koniec.

## R3 — pomiar wołających `TaskService.createTask` i decyzja o `source`

Dla każdego z sześciu (zweryfikuj aktualną liczbę) wołających `TaskService.createTask` ustal
z kodu wywołania: czy tworzone zadanie jest zawsze inicjowane przez człowieka, zawsze przez AI,
czy zależnie od kontekstu. Zapisz to jako tabelę wołający → charakter → dowód (plik:linia).
Na tej podstawie zdecyduj: (a) jeśli znajdziesz wołającego, który JEDNOZNACZNIE i ZAWSZE tworzy
zadanie z inicjatywy AI (analogicznie do `_executeCreateTask`/`taskExecutor.ts` — zero
niejednoznaczności), dodaj `source` jako opcjonalny parametr `CreateTaskInput` w `TaskService.ts`
i ustaw go na `'ai'` tylko dla tego wołającego; (b) dla wszystkich pozostałych — NIE ZGADUJESZ,
zostawiasz domyślne zachowanie (DB default `'manual'`) i zapisujesz w raporcie, że wymaga to
osobnego pomiaru per-wołający, którego ten dyżur nie robi.

**Ukończone, gdy:** raport ma tabelę 6-7 wołających z jednoznacznym wskazaniem, dla którego (jeśli
któregokolwiek) `source='ai'` jest bezpieczne do dopisania, i kodowa zmiana (jeśli jest) dotyczy
wyłącznie tego jednego przypadku, nigdy „na wszelki wypadek" wszystkich.

## R4 — domknięcie pochodzenia na dwóch autonomicznych ścieżkach AI

W `server/src/services/aiActionExecutor.ts` (`_executeCreateTask`, INSERT na linii ~1101) i w
`server/src/ai/actionExecutors/taskExecutor.ts` (linie 55-67, funkcja `add(...)`) dopisz zapis
`source = 'ai'` do tworzonego wiersza `tasks`. W `aiActionExecutor.ts` dodaj kolumnę `source`
wprost do listy INSERT-u z wartością `'ai'` (ta ścieżka nie ma dynamicznego schematu kolumn jak
`taskExecutor.ts` — sprawdź, czy Postgres ma tę kolumnę zawsze, migracja
`20260213_task_source_origin.sql` jest addytywna i bezwarunkowa, więc powinna być). W
`taskExecutor.ts` dodaj `add('source', 'ai')` do łańcucha `add(...)` (ten plik już ma obronny
wzorzec `cols.has(col)` — trzymaj się go, nie omijaj). Sprawdź też, czy warto dopisać
`source_type`/`source_id` na tych samych ścieżkach (kolumny istnieją od dyżuru 157 w niektórych
miejscach) — jeśli tak, uzasadnij czym miałyby być wypełnione (nazwa akcji? `action.id`?) i
zapisz decyzję w raporcie; jeśli nie masz jednoznacznej wartości do wpisania, zostaw je puste i
napisz dlaczego, zamiast wpisywać coś zgadniętego.

**Ukończone, gdy:** masz dowód mutacyjny na lokalnym Postgresie — utwórz zadanie każdą z dwóch
ścieżek (bezpośrednie wywołanie funkcji w teście, nie przez pełny HTTP jeśli to zbyt kosztowne —
ale zapisz jasno w raporcie, czy test poszedł przez pełną ścieżkę HTTP czy przez wywołanie
funkcji), pokaż `SELECT source FROM tasks WHERE id = ...` zwraca `'ai'`, nie `'manual'`.

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis | `server/src/services/aiActionExecutor.ts` |
| Zapis | `server/src/ai/actionExecutors/taskExecutor.ts` (uwaga: NIE `server/src/services/taskExecutor.ts` — ten plik nie istnieje) |
| Zapis | `server/src/services/TaskService.ts` (tylko zgodnie z decyzją R3 — może pozostać nietknięty, jeśli pomiar nie da jednoznacznego wołającego) |
| Zapis | test `server/src/services/__tests__/day162.provenance-audit-honesty.pg.test.ts` |
| Zapis | ewentualna migracja WYŁĄCZNIE `server/migrations/20260830_day162_provenance_closure.sql` (zobacz zakaz niżej — twórz ją tylko jeśli R3/R4 tego wymagają; jeśli nie dodajesz żadnej nowej kolumny, NIE twórz tego pliku) |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY162_DOMKNIECIE_POCHODZENIA_REPORT.md` |
| Odczyt | `server/src/controllers/TaskController.ts` — **nie zmieniasz** (ścieżka ręczna już działa poprawnie) |
| Odczyt | `server/src/validators/task.validators.ts`, `server/src/routes/pmo/tasks.routes.ts` |
| Odczyt | `src/components/AIChat/ActionCenter.tsx`, `src/routes/AppRoutes.tsx`, `src/routes/routeConfig.ts` |
| Odczyt | `src/components/Initiatives/InitiativeDocumentView.tsx`, `src/components/Initiatives/sections/TasksMilestonesSection.tsx`, `src/components/Initiatives/sections/types.ts` |
| Odczyt | `server/src/services/aiRunLedgerService.ts` — **nie zmieniasz** (schemat i UPDATE/INSERT tabel `ai_run_ledger`/`ai_run_events` zostają jak są) |
| Odczyt | `server/src/services/v8/teresaCopilotService.ts` — wzorzec wariantu (b), **nie zmieniasz** |
| Odczyt | `server/src/routes/ai.routes.ts` (dowód braku trasy undo/rollback dla `AIActionExecutor.executeAction`) |
| Odczyt | `server/migrations/20260213_task_source_origin.sql`, `server/migrations/20260311_origin_tracking.sql` |

**Nietykalne imiennie:** cały `src/**` (odczyt dozwolony, zapis zabroniony — to dyżur backendu);
`server/src/routes/my-work/agent-materialization.routes.ts` i wszystko z zakresu dyżuru 157
(`server/src/services/myWork/agentApprovedMaterializationService.ts`,
`server/src/services/decisionService.ts`, `server/src/services/notebookService.ts`); wszystkie
migracje poza `20260830_day162_provenance_closure.sql` — **w szczególności `server/migrations/*.sql`
dotykane równolegle przez dyżur 161 (strażniki `ADD COLUMN IF NOT EXISTS`) — zakaz zmiany
jakiegokolwiek ISTNIEJĄCEGO pliku migracji w tym dyżurze, bezwarunkowo**; testy dyżurów
132/139/157/158/159 (`server/src/routes/__tests__/day132.*`,
`server/src/services/organizationContext/__tests__/day132.*`,
`server/src/services/ai/__tests__/day132.*`, `server/src/services/ai/__tests__/day139.*`,
`server/src/routes/__tests__/day157.*`, `server/migrations/20260830_day158_*`,
`server/migrations/20260830_day159_*`).

**Zasoby wyłączne:** baza na porcie `6049`, kontener `cx-day162-pg`, runtime na portach `4992`
i `4993`. Żadnego innego portu, żadnej bazy zdalnej. Kontenery `cx-day157-pg`/`cx-day158-pg`/
`cx-day159-pg`/`cx-day161-pg` mogą działać równolegle na swoich portach — nie łącz się z nimi.

# 5. BRAMKI ODBIORU

- **B1. Korekta odnotowana.** Raport wprost stwierdza, że ustalenie nadzorcy „`tasks.source`
  bez pisarza" było błędne, i cytuje pełny łańcuch pisarz→czytelnik (walidator→kontroler→
  route→front) z plik:linia. Nie milczysz o tej korekcie.
- **B2. Kłamstwo audytu usunięte dla nowych zapisów.** Po zmianie w `aiActionExecutor.ts`,
  każdy NOWY wpis w `ai_run_events.details` i `ai_run_ledger.audit` dla akcji obsługiwanych
  przez `executeAction` niesie `rollbackStatus` zgodny ze stanem faktycznym (czyli, jeśli pomiar
  R1/R2 potwierdzi brak jakiegokolwiek mechanizmu cofania — zawsze `rollback_unavailable`).
- **B3. Historia nietknięta.** Żaden istniejący wiersz `ai_run_ledger`/`ai_run_events` w bazie
  lokalnej sprzed zmiany nie został zmodyfikowany przez ten dyżur — dowód: `COUNT(*)` i suma
  kontrolna/hash starych wierszy identyczne przed i po (poza nowymi wierszami z testów).
- **B4. `tasks.source` domknięty na dwóch autonomicznych ścieżkach AI.** Dowód mutacyjny:
  zadanie utworzone przez `_executeCreateTask` i przez `TaskExecutor.execute` ma
  `source = 'ai'` w bazie, nie `'manual'`.
- **B5. `TaskService.ts` nietknięty bez pomiaru.** Jeśli R3 nie znalazł jednoznacznie AI-owego
  wołającego, plik pozostaje bez zmian — commit to potwierdza (brak diffu na tym pliku).
  Jeśli zmiana jest, dotyczy wyłącznie jednego zidentyfikowanego wołającego, z uzasadnieniem
  w raporcie.
- **B6. Zero nowych migracji, jeśli nie są potrzebne.** Jeśli R2 i R4 nie wymagają nowej kolumny
  (a nie powinny — `tasks.source`, `source_type`, `source_id` już istnieją), plik
  `20260830_day162_provenance_closure.sql` NIE powstaje. Tworzysz go tylko z konkretnym,
  nazwanym powodem zapisanym w raporcie.
- **B7. Zero zmian w istniejących migracjach.** `git diff` na `server/migrations/` (poza
  ewentualnym nowym plikiem z B6) jest pusty — sprawdzasz to jawnie przed commitem, bo dyżur 161
  pracuje równolegle w tym samym katalogu.
- **B8.** Testy `day162.*` przechodzą na lokalnym Postgresie (kontener `cx-day162-pg`, port
  `6049`, `RUN_DB_TESTS=1`, config poza repo bo `server/vitest.config.ts:17` przypina
  `DB_TYPE: 'sqlite'` w bloku `test.env`).
- **B9.** Raport ma sekcję „TWIERDZENIA NIEZWERYFIKOWANE" — w szczególności: czy `TaskService.ts`
  ma dziś dokładnie sześciu wołających czy liczba się zmieniła; czy poza `ActionCenter.tsx` i
  `wave7ConnectorRuntimeService.ts`/`wave8AgentRuntimeService.ts` istnieje jeszcze jakiś czytelnik
  `ai_run_ledger`/`ai_run_events`, którego ten dyżur nie znalazł; czy pełna ścieżka HTTP (nie
  tylko wywołanie funkcji) dla obu naprawionych executorów AI została faktycznie sprawdzona.
