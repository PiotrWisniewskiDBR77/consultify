# INSTRUKCJA DYŻURU nr 163 — Codex — „Uzytkownik traci swoja prace w karcie zadania - pomiar wszystkich sekcji i wzorzec trwalosci dla jednej"

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
> **wyłącznie** `/private/tmp/cx-day163-utrata-pracy-karty`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `23bc57aaf3`**
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
Zakres: **Moja Praca - karta zadania, trwalosc sekcji**.
Trasy front: ``src/components/MyWork/TaskDetailView.tsx` - zapis; sekcje deklarowane w `TaskDetailView.tsx:2919-2963``. Trasy tył: ``server/src/routes/pmo/tasks.routes.ts` (WYLACZNIE nowa trasa sekcji), `server/src/controllers/TaskController.ts`, `server/src/validators/task.validators.ts``.

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
WT=/private/tmp/cx-day163-utrata-pracy-karty
MARKER=23bc57aaf3

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day163-utrata-pracy-karty-20260830 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day163-utrata-pracy-karty/config.worktree"
cat "$VAULT/worktrees/cx-day163-utrata-pracy-karty/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day163-utrata-pracy-karty-scratch
mkdir -p /private/tmp/cx-day163-utrata-pracy-karty-artefakty

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
git -C "$VAULT" log --oneline 23bc57aaf3..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only 23bc57aaf3..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day163-utrata-pracy-karty-20260830
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 23bc57aaf3..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `cztery` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day163-utrata-pracy-karty

# (T1) CZY WCZYTANIE REKORDU W OGOLE DOTYKA TYCH SEKCJI
grep -n "setRisks\|setAlternatives\|setImplementationIdeas\|setEvidenceItems\|setDependencies" src/components/MyWork/TaskDetailView.tsx
#   oczekiwane: same akcje uzytkownika i odpowiedzi AI. ZERO wywolan z loadTask
#   (loadTask to okolice :1079-1163, mapuje 23 pola). Policz sam.

# (T2) CZY ISTNIEJE DOKAD ZAPISAC
grep -rnE "/(risks|alternatives|implementation-ideas|evidence|raci)" server/src/routes/pmo/tasks.routes.ts
grep -rlniE "task_risks|task_alternatives|task_implementation|task_evidence" server/migrations/*.sql
#   oczekiwane: OBA puste. Brak trasy i brak tabeli. Potwierdz sam.

# (T3) WZORZEC DO NASLADOWANIA, KTORY JUZ ISTNIEJE
sed -n '25,32p' server/migrations/902_decision_structured_columns.sql
#   oczekiwane: decisions.alternatives JSONB. Przeczytaj i oceN, czy sie nadaje.

# (T4) SEKCJA Z INFRASTRUKTURA, ALE ODLACZONA
grep -n "setDependencies" src/components/MyWork/TaskDetailView.tsx
grep -n "getTaskDependencies" server/src/controllers/TaskController.ts
#   oczekiwane: backend ISTNIEJE (TaskController.ts:3035), a front ma setDependencies
#   WYLACZNIE jako deklaracje stanu (:654) i nigdy go nie wola. To trzeci wzorzec awarii.
```

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day163-utrata-pracy-karty-20260830` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6051`. Twój JEDYNY port harnessu to `4994 i 4995`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day163-pg`**. **ZAKAZANE:** `6012, 5433, 6039 (153), 6044 (157), 6045 (158), 6046 (159), 6047 (odbior nadzorcy), 6048/4988-4989 (160), 6049/4990-4991 (161), 6050/4992-4993 (162), 6052/4996-4997 (164)`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak - ten dyzur NIE wprowadza ani jednej nowej flagi i NIE zmienia wartosci domyslnej zadnej istniejacej`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY163_UTRATA_PRACY_KARTY_REPORT.md`. Nie zmieniasz zadnego `MODULE_ACCEPTANCE.md` - ten dyzur nie zamyka modulu menu. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day163-utrata-pracy-karty-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day163-utrata-pracy-karty-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **NIE KASUJESZ I NIE UKRYWASZ ZADNEJ SEKCJI KARTY** - nawet gdy okaze sie iluzja. O usunieciu decyduje wlasciciel; martwe odkladamy, nie kasujemy. **NIE ZDEJMUJESZ I NIE ZAWEZASZ BRAMY 409** (`tasks.routes.ts:67`) - to terytorium dyzuru 160 i osobnej decyzji wlasciciela. **NIE DOTYKASZ `my-work.routes.ts`** (terytorium 162) - czytasz go tylko, zeby wiedziec, ktora trasa tworzyc zadanie w R2. **NIE DOTYKASZ `server/src/services/aiActionExecutor.ts`** (162). **NIE ZMIENIASZ ZADNEGO ISTNIEJACEGO PLIKU MIGRACJI** (terytorium 161) - masz prawo utworzyc wylacznie `server/migrations/20260830_day163_task_sections.sql`. **Zero polaczen do bazy zdalnej, demo, stagingu i produkcji.** **R4 budujesz dla JEDNEJ sekcji, nie dla czterech** - wzorzec idzie do akceptu wlasciciela, reszta osobnym dyzurem. Zbudowanie wszystkich naraz przed akceptem wzorca to zmarnowana praca | To jest **priorytet zero z odbioru wlasciciela** (FALA 0 w `docs/program/grafika/PLAN_PO_ODBIORZE.md`) - jedyny temat, w ktorym **uzytkownik traci swoja prace**. Slowa wlasciciela z karty odbioru: 'informacje przekazane nie sa wysylane do serwera, tylko zostaja w pamieci przegladarki. Mam nadzieje, ze to jest jakis blad'. Nadzorca zmierzyl cztery warstwy i **wszystkie sa puste**: brak kolumny, brak pola w walidatorze, brak trasy, brak wysylki z frontu. To nie jest brak sciezki odczytu - to brak czegokolwiek |

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
cd /private/tmp/cx-day163-utrata-pracy-karty

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day163-pg psql -U postgres -d cx163 \
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
cd /private/tmp/cx-day163-utrata-pracy-karty

docker run -d --name cx-day163-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx163 \
  -p 127.0.0.1:6051:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day163-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6051/cx163 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6051/cx163 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day163-utrata-pracy-karty && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6051/cx163 \
JWT_SECRET=cx163-test-secret-do-not-reuse \
npx vitest run server/src/routes/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day163-utrata-pracy-karty-artefakty/day163-vitest.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day163-utrata-pracy-karty && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/routes/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day163-utrata-pracy-karty-artefakty/day163-vitest.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day163-utrata-pracy-karty/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day163-pg psql -U postgres -d cx163 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day163-pg`.
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
> **(e) **Brak trwalosci NIE jest jednorodny - sa trzy rozne wzorce awarii i kazdy wymaga innej naprawy.** **(A) calkowita cisza:** `risk-alternatives`, `implementation`, `governance` - zero ostrzezenia w interfejsie, uzytkownik nie ma jak sie dowiedziec. **(B) cisza uczciwie oznaczona:** `evidence` ma w `taskGeneratedSectionPersistence.ts` jawna etykiete `local-only` i realny baner w interfejsie - to prawdopodobnie ten baner, o ktorym pisze wlasciciel. **(C) infrastruktura odlaczona:** `dependencies` ma **prawdziwa trase i kontroler** (`TaskController.ts:3035`, `:3225`), ale front ma `setDependencies` wylacznie jako deklaracje stanu (`TaskDetailView.tsx:654`) i **nigdy go nie wola**. Backend gotowy, front nie pyta. Nie policz tych trzech przypadkow jako jednego defektu. **Druga pulapka: `cards.json` NIE ISTNIEJE w repozytorium** - to niesledzony plik roboczy innego toru, nie ma go w Twoim klonie. Lista sekcji pochodzi z kodu: `TaskDetailView.tsx:2919-2963` (osiem sekcji lewej kolumny) plus `comments` i `activity-log` zarezerwowane dla prawego panelu (`:2969-2975`) = dziesiec, co zgadza sie z komentarzem '4 z 10 sekcji' w `TaskDetailView.tsx:422`. **Trzecia: `localStorage.setItem('consultify-task-draft:...')` (`:1255`, `:1379`) jest zapisem w JEDNA STRONE** - nic w pliku go nie odczytuje z powrotem. Szkic nie ratuje danych po odswiezeniu; nie pomyl jego obecnosci z dzialajaca trwaloscia. **Czwarta: trasa `POST /api/tasks` odpowiada 409** (brama `tasks.routes.ts:67`). Dzialajaca sciezka tworzenia zadania to `POST /api/my-work/personal-tasks` (`my-work.routes.ts:1282`). **Uzyj dzialajacej** - inaczej pomiar R2 utknie na 409 i pomylisz brame z utrata danych. **Piata: migracja musi przejsc pelny przebieg od PUSTEJ bazy.** Kolejnosc ustala `server/scripts/migrationOrdering.ts` (`sortMigrationsDeterministically`, wolane z `migrate.postgres.ts:853`), NIE zwykly `files.sort()`. 30.08 brak straznika kolumny wywrocil caly lancuch i zepsul odtworzenie bazy po awarii**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day163-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day163-utrata-pracy-karty-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`pozycje R1 i R2 - pelny pomiar trwalosci wszystkich sekcji karty oraz dowod utraty na zywym runtime; bez nich naprawa bylaby zgadywaniem`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6051` albo `4994 i 4995` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6051` albo `4994 i 4995`** (`Z7`).

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

To jest priorytet zero z odbioru właściciela. `docs/program/grafika/PLAN_PO_ODBIORZE.md`,
sekcja „FALA 0 — utrata danych” (linie 42-59), mówi wprost: *„To jedyny temat, w którym
użytkownik traci swoją pracę. Nie jest kosmetyczny i nie czeka na inne fale.”* Karta decyzji,
słowa właściciela cytowane w tym samym pliku: *„informacje przekazane nie są wysyłane do
serwera, tylko zostają w pamięci przeglądarki. Mam nadzieję, że to jest jakiś błąd”*.

Nadzorca zmierzył w kodzie (30.08, zweryfikowane ponownie na markerze `23bc57aaf3`):
`setRisks`, `setAlternatives`, `setImplementationIdeas`, `setEvidenceItems` w
`src/components/MyWork/TaskDetailView.tsx` są wołane wyłącznie z akcji użytkownika i z
odpowiedzi AI — **ani razu** w `loadTask` (linie 1079-1163, gdzie karta wczytuje rekord z
serwera). `loadTask` mapuje 23 pola (`title`, `description`, `expectedOutcome`, `status`,
`priority`, `dueDate`, `startedAt`, `blockedReason`, `ownerId`, `assigneeId`, `initiativeId`,
`projectId`, `projectName`, `createdBy`, `createdAt`, `tags`, `checklist`, `attachments`,
`comments`, `linkedItems`, `sourceType`, `sourceId`, `versionToken`, `blockedByDecisionId`) —
i żadnego z pól czterech spornych sekcji.

Trasa `POST /api/tasks` (montaż `server/src/routes/pmo/tasks.routes.ts:67`,
`router.use(requireCanonicalExecutionWriter)`) odpowiada dziś `409`
(`server/src/middleware/executionSpineLegacyReadOnly.middleware.ts:39`,
`res.status(409).json(...)`) — to bramka dyżuru 160, nietykalna tutaj. Żywa ścieżka tworzenia
zadania to `POST /api/my-work/personal-tasks` (`server/src/routes/my-work.routes.ts:1282`),
odczytu — `GET /api/my-work/personal-tasks/:id` (`server/src/routes/my-work.routes.ts:1456`).
`grep -nE "/(risks|alternatives|implementation-ideas|evidence|raci)"
server/src/routes/pmo/tasks.routes.ts` zwraca pustą listę. Brak tabel `task_risks` /
`task_alternatives` / `task_implementation` / `task_evidence` w `server/migrations/*.sql`.
`server/src/validators/task.validators.ts` (schemat `CreateTaskSchema`, linie 41-89) nie zna
pól `risks`, `alternatives`, `implementationIdeas`, `raci` ani `stakeholders` — zna za to
`checklist` (linia 71) i `evidenceRequired` (linia 76, ale to bulgar/flaga wymaganych typów
dowodu, nie lista pozycji `evidenceItems`).

**Jedno doprecyzowanie, którego nadzorca w pierwszym pomiarze nie miał: nie wszystkie cztery
sekcje są zepsute w ten sam sposób.** Zweryfikuj to jako pierwszy krok R1 — poniżej jest opis
trzech różnych wzorców, jakie znaleziono, ale to jest **hipoteza do potwierdzenia**, nie gotowy
wynik:

- **Wzorzec A — całkowita cisza, bez ostrzeżenia.** `risk-alternatives`, `implementation`,
  `governance` (RACI) nie mają wpisu w `TASK_AI_CARD_META`
  (`TaskDetailView.tsx:417-434`) — są w `TASK_AI_CONTRACT_NONE` (linie 436-455) z jawnym
  wykluczeniem AI-kontraktu, renderują się przez zwykły formularz, **bez** komponentu
  `NModeCardState` i bez jego `persistenceNotice`. Użytkownik wpisujący ryzyko, alternatywę,
  pomysł realizacji albo osobę RACI nie widzi ŻADNEGO ostrzeżenia, że to zniknie.
- **Wzorzec B — cisza, ale z uczciwą etykietą.** `evidence` JEST w `TASK_AI_CARD_META`
  (backend key `evidence`) i renderuje się przez `NModeCardState` z
  `persistenceNotice` — plik `src/components/MyWork/taskGeneratedSectionPersistence.ts`
  klasyfikuje `evidence: 'local-only'`, co produkuje w UI dokładnie ten tekst (klucz
  `myWork.taskDetail.generatedSectionLocalOnlyNotice`, `TaskDetailView.tsx:4585-4588`):
  *„This draft is local to this view and is not included in the server Task Save.”* To jest
  najbliższy kandydat na „baner na ekranie”, o którym pisze `PLAN_PO_ODBIORZE.md`. Dane i tak
  giną — ale użytkownik jest o tym poinformowany w chwili wpisywania, nie dowiaduje się dopiero
  po odświeżeniu.
- **Wzorzec C — infrastruktura istnieje, ale osobno.** `dependencies` ma **realną** trasę
  (`GET /:id/dependencies`, `POST /:id/dependencies`, `server/src/routes/pmo/tasks.routes.ts:1342-1348`)
  i kontroler (`TaskController.getTaskDependencies`/`addTaskDependency`,
  `server/src/controllers/TaskController.ts:3035`, `:3225`) z prawdziwą tabelą zależności
  (`predecessor_id`/`successor_id`). Ale stan `dependencies` w `TaskDetailView.tsx:654`
  (`useState<TaskDependency[]>([])`) **nigdy nie ma wołania `setDependencies`** w całym pliku —
  sekcja w karcie jest na stałe pustą listą, odłączoną od tej realnej trasy. Klasyfikacja
  `taskGeneratedSectionPersistence.ts` nazywa to `'reference-only'`. To nie jest ten sam defekt
  co A/B — to czwarty kształt: „wołacz istnieje, ale nikt go nie woła z tego ekranu”.

Dodatkowo: `handleSave` w `TaskDetailView.tsx` zapisuje przed wysyłką **lokalny szkic** do
`localStorage` pod kluczem `` `consultify-task-draft:${taskId || 'new'}` `` (linia 1255, drugie
wystąpienie w `handleOpenChat` — linia 1379, ten drugi zawiera nawet `stakeholders`). **Żadne
miejsce w pliku nie odczytuje tego klucza z powrotem** (`grep -rn "consultify-task-draft" src/`
poza dwoma zapisami — zero trafień na odczyt). To dosłownie „zostaje w pamięci przeglądarki”,
ale nawet ten szkic się nie przywraca po odświeżeniu — to zapis-w-jedną-stronę, nie sejf
awaryjny. Zmierz to w R2 zamiast zakładać, że localStorage chociaż częściowo ratuje użytkownika.

## Czym ten dyżur NIE jest

Nie jest naprawą bramy `POST /api/tasks` (`409`) — to terytorium dyżuru 160, którego NIE
zdejmujesz i NIE zawężasz. Nie jest zmianą `aiActionExecutor.ts` / `ai/actionExecutors/
taskExecutor.ts` / `my-work.routes.ts` — te pliki należą do dyżuru 162; czytasz
`my-work.routes.ts` wyłącznie po to, by wiedzieć, którą trasą utworzyć zadanie w R2. Nie jest
naprawą wszystkich czterech (czy pięciu, licząc `dependencies`) sekcji naraz — R4 buduje
trwałość dla JEDNEJ, wskazanej przez właściciela. Nie jest kasowaniem ani ukrywaniem żadnej
sekcji karty, nawet gdy pomiar wykaże, że jest iluzją — o usunięciu decyduje właściciel, nie ten
dyżur. Nie jest operacją na bazie demo, stagingu ani produkcji — wyłącznie lokalny kontener
jednorazowy.

# 2. TEZY ZLECENIA

- **T1.** Karta zadania ma dziesięć sekcji (osiem w lewej kolumnie —
  `description-scope`, `implementation`, `risk-alternatives`, `checklist`, `dependencies`,
  `evidence`, `governance`, `attachments-links`, zdefiniowane w `TaskDetailView.tsx:2919-2963` —
  plus dwie zarezerwowane dla prawego panelu, `comments` i `activity-log`, zjechane tam z pełną
  funkcją per komentarz w liniach 2969-2975). Komentarz w kodzie (`TaskDetailView.tsx:422`)
  mówi wprost: *„Przed tą migracją kontrakt miały 4 z 10 sekcji, a pozostałe 6 milczało”* — to
  jest o kontrakcie AI (Regeneruj/Edytuj/Zaakceptuj), nie o zapisie na serwer, ale liczba
  dziesięciu sekcji jest tym samym pierwotnym punktem odniesienia. Zweryfikuj tę listę dziesięciu
  niezależnie — nie ma w repo żadnego pliku `cards.json` (sprawdzone: nie istnieje na dysku ani
  w historii gita), więc jedynym źródłem prawdy o liczbie i tożsamości sekcji jest sam kod karty.
- **T2.** Brak ścieżki zapisu nie jest jednorodny. Jedna sekcja (`evidence`) ma uczciwe
  ostrzeżenie w UI w chwili wpisywania danych; trzy (`implementation`, `risk-alternatives`,
  `governance`) nie mają żadnego; jedna (`dependencies`) ma realną infrastrukturę backendu,
  z którą karta się po prostu nie łączy. Te cztery przypadki wymagają różnych napraw, nie jednej
  wspólnej migracji — R1 ma to rozdzielić z dowodem plik:linia dla każdego.
- **T3.** Trwałość, którą projektujesz w R3, ma wzorzec do naśladowania w tym samym repo:
  `decisions.alternatives JSONB` (`server/migrations/902_decision_structured_columns.sql:29`) —
  i `DecisionDetailView.tsx` faktycznie czyta ten backend (`setAlternatives`/`setRisks` wołane
  przy wczytaniu rekordu decyzji, nie tylko z akcji użytkownika — to jest żywy kontrprzykład
  „jak to powinno wyglądać” w tym samym pliku komponentu-siostry). Sprawdź, czy ten wzorzec
  faktycznie się nadaje do przeniesienia na `tasks`, czy ma ograniczenia (np. rozmiar, brak
  historii wersji, brak per-item audytu).
- **T4.** Jeśli pomiar R1/R2 pokaże, że którakolwiek z czterech sekcji JEDNAK dociera do
  serwera (ścieżką, której nadzorca nie widział — np. przez inny endpoint, przez
  `taskExecutor.ts` z dyżuru 162, przez customFields) — to jest wynik równie wartościowy jak
  potwierdzenie utraty. Zgłoś go głośno i nie buduj trwałości, która już istnieje.

# 3. POZYCJE DYŻURU

## R1 — pomiar rozstrzygający, PRZED jakąkolwiek naprawą

Dla każdej z dziesięciu sekcji karty zadania (lista w T1) ustal osobno, z dowodem plik:linia:

1. Czy istnieje kolumna/tabela w schemacie (`server/migrations/*.sql`,
   `server/migrations-v2/*.sql`)?
2. Czy pole istnieje w `server/src/validators/task.validators.ts`
   (`CreateTaskSchema`/`UpdateTaskSchema`)?
3. Czy istnieje trasa w `server/src/routes/pmo/tasks.routes.ts` LUB
   `server/src/routes/my-work.routes.ts` (obie sprawdź — karta czyta/pisze przez tę drugą)?
4. Czy front wysyła te dane (`handleSave`, `personalPayload`/`payload` w `TaskDetailView.tsx`
   — sprawdź obie zmienne, bo się różnią co do zestawu pól)?
5. Czy front je wczytuje (`loadTask`)?

Wynik: tabela dziesięć wierszy na pięć kolumn (TAK/NIE + plik:linia dla każdej odpowiedzi TAK).
Nie zakładaj z góry, że wszystkie cztery podejrzane sekcje (`implementation`,
`risk-alternatives`, `evidence`, `governance`) są zepsute identycznie — hipoteza we wstępie
(wzorce A/B/C) mówi, że NIE są, i wymaga potwierdzenia albo obalenia per sekcja. Sprawdź
też `dependencies` osobno pod kątem wzorca C: istnieje trasa (`tasks.routes.ts:1342-1348`,
`TaskController.ts:3035`) — potwierdź czy front jej używa w OGÓLE (jakikolwiek ekran, nie tylko
`TaskDetailView`), czy jest martwa wszędzie.

**Ukończone, gdy:** masz tabelę 10×5 z dowodami i jedno zdanie na sekcję: „iluzja” /
„działa” / „częściowo — infrastruktura jest, karta jej nie używa”.

## R2 — dowód utraty na żywym runtime

Postaw lokalny serwer + Postgres (kontener wyłącznie tego dyżuru, zobacz limity portów w
tabeli licencji). Utwórz zadanie **przez działającą trasę**
`POST /api/my-work/personal-tasks` (`my-work.routes.ts:1282`) — **nie** przez `POST /api/tasks`
(`409`, gate dyżuru 160, nie ruszasz). Otwórz kartę, wpisz dane w każdą z czterech (lub pięciu,
z `dependencies`) podejrzanych sekcji, zapisz przez UI, **odśwież stronę** (pełny reload, nie
tylko ponowne wyrenderowanie), sprawdź co zostało w formularzu. Zapisz dosłowny wynik dla każdej
sekcji.

Dodatkowo — bo znaleziono zapis do `localStorage` bez odczytu (`TaskDetailView.tsx:1255`,
`:1379`, klucz `` `consultify-task-draft:${taskId}` ``): po odświeżeniu sprawdź w konsoli
przeglądarki (albo w DevTools Application → Local Storage), czy klucz istnieje i co zawiera, ORAZ
czy formularz go w ogóle próbuje odczytać. Potwierdź albo obal: „szkic w `localStorage` istnieje,
ale nic go nie przywraca — to nie jest siatka bezpieczeństwa, to martwy zapis”.

Osobno sprawdź w bazie surowym SQL-em (`psql` do kontenera tego dyżuru), czy którekolwiek z
wpisanych danych wylądowało w jakiejkolwiek kolumnie `tasks` (np. w `custom_fields`, jeśli coś
tam trafia) — to zamienia wniosek statyczny w zmierzony fakt, zamiast wierzyć że „skoro nie ma
kolumny, to na pewno nic się nie zapisało” (customFields jest w walidatorze, linia 86 —
sprawdź, czy przypadkiem coś tam nie ucieka).

**Ukończone, gdy:** masz dosłowny zapis „przed odświeżeniem / po odświeżeniu” dla każdej z
badanych sekcji + wynik zapytania SQL + wynik sprawdzenia `localStorage`.

## R3 — projekt naprawy, nie naprawa

Zaprojektuj trwałość dla sekcji, które jej nie mają (wynik R1 rozstrzyga, dla ilu). Rozważ i
uzasadnij wybór, z kosztem każdego wariantu:

- **(a) Osobne tabele per sekcja** (`task_risks`, `task_alternatives`, `task_implementation_ideas`,
  `task_raci`) — najbliższe modelowi relacyjnemu, umożliwia indeksy i FK per-item, ale cztery
  migracje, cztery zestawy CRUD, najdroższe do wdrożenia.
- **(b) Jedna tabela `task_sections` z typem i treścią JSON** — jedna migracja, jeden serwis,
  ale traci typowanie per sekcja i utrudnia zapytania po polu wewnątrz treści.
- **(c) Kolumny JSONB wprost na `tasks`** (wzorem `decisions.alternatives` —
  `server/migrations/902_decision_structured_columns.sql:29`) — najtańsze, spójne z istniejącym
  wzorcem w `DecisionDetailView`/`decisions`, ale każda kolumna to osobny `ALTER TABLE` i osobna
  gałąź w `UpdateTaskSchema`.

Przeczytaj `902_decision_structured_columns.sql` w całości i powiedz jawnie, czy nadaje się do
naśladowania bez zmian, czy ma ograniczenie, które trzeba obejść na `tasks` (np. `decisions` nie
ma dziś odpowiednika `dependencies` z wzorca C — nie musisz tego rozwiązywać, tylko odnotować).

**Ukończone, gdy:** masz rekomendację jednego wariantu z uzasadnieniem opartym o R1 (ile
sekcji, jaki kształt danych) i R2 (co realnie trzeba odtworzyć), plus jawnie odrzucone
alternatywy z powodem odrzucenia.

## R4 — wdrożenie WYBRANEGO wariantu dla JEDNEJ sekcji, jako wzorzec

Wybierz **`Ryzyko i alternatywy`** (`risk-alternatives`) — właściciel wymienił ją wprost w karcie
odbioru, ma najbliższy istniejący wzorzec (`decisions.alternatives` JSONB) i dziś nie ma
kompletnie żadnej warstwy (wzorzec A z T2: bez ostrzeżenia w UI, bez trasy, bez pola
walidatora). Zbuduj od końca do końca:

1. **Migracja** `server/migrations/20260830_day163_task_sections.sql` — addytywna, dopisuje
   kolumnę/kolumny na `tasks` (albo nową tabelę, zgodnie z R3), z pełnym przebiegiem od PUSTEJ
   bazy. Kolejność wykonania migracji ustala `sortMigrationsDeterministically`
   (`server/scripts/migrationOrdering.ts:359`, wołane z `server/scripts/migrate.postgres.ts:853`)
   — **nie** zwykły `files.sort()`. Jeśli migracja czyta jakąkolwiek istniejącą kolumnę, dodaj na
   początku strażnik `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS <kolumna> <typ>;` — 30.08 brak
   takiego strażnika wywrócił cały łańcuch migracji w innym dyżurze.
2. **Walidator** — nowe pole(a) w `server/src/validators/task.validators.ts`
   (`CreateTaskSchema`/`UpdateTaskSchema`), bo `validateBody()` przycina nieznane klucze
   (`z.object()` domyślnie odrzuca) — komentarz w pliku przy liniach 87-92 opisuje dokładnie ten
   mechanizm na przykładzie `idempotencyKey`.
3. **Trasa** — WYŁĄCZNIE nowa trasa sekcji w `server/src/routes/pmo/tasks.routes.ts`. Nie
   dotykasz linii 67 (`requireCanonicalExecutionWriter`) ani żadnej istniejącej trasy. Jeśli
   nowa trasa mutująca też przechodzi przez ten sam middleware-stack i dostanie `409` — to jest
   wynik do zgłoszenia (errata), nie powód do modyfikacji bramki.
4. **Kontroler** — `server/src/controllers/TaskController.ts`, nowa metoda obok istniejących
   wzorców (np. `getTaskDependencies`/`addTaskDependency` jako przykład stylu, linie 3035/3225).
5. **Zapis i odczyt we froncie** — `TaskDetailView.tsx`: `loadTask` musi wywołać
   `setRisks`/`setAlternatives` po pobraniu rekordu; `handleSave`
   (`payload`/`personalPayload`, linie ok. 1215-1247) musi wysyłać nowe pole(a). Dodaj też
   `persistenceNotice`, jeśli sekcja wejdzie do `TASK_AI_CARD_META` — albo jawnie zostaw ją poza
   (z dopisanym powodem w `TASK_AI_CONTRACT_NONE`), ale wtedy user nadal nie dostaje ostrzeżenia
   — rozstrzygnij to świadomie i opisz decyzję w raporcie.
6. **Test z dowodem mutacyjnym** — `server/src/routes/__tests__/day163.task-sections-persistence.pg.test.ts`
   (wzorem stylu `day158.kpi-crosswalk.pg.test.ts`, `day157.provenance-revert.pg.test.ts` w tym
   samym katalogu): utwórz zadanie, zapisz ryzyka/alternatywy, wczytaj ponownie z nowego
   zapytania (nowe połączenie/klient, nie z pamięci procesu), potwierdź że dane wróciły.
   Dowód mutacyjny: celowo zepsuj kod produkcyjny (np. usuń `setRisks` z `loadTask` albo usuń
   `WHERE`/kolumnę z zapytania SQL), pokaż że test PADA, przywróć, pokaż czyste `git diff`.

Reszta trzech sekcji (`implementation`, `evidence`, `governance`/`dependencies`) idzie osobnym
dyżurem po akceptacji tego wzorca przez właściciela — nie buduj ich tutaj, nawet gdyby wzorzec
okazał się trywialny do powielenia.

**Ukończone, gdy:** test `day163.*` przechodzi na lokalnym Postgresie, dowód mutacyjny jest w
raporcie (log PASS→FAIL→PASS), migracja przechodzi od pustej bazy, a `risk-alternatives`
przeżywa odświeżenie strony w R2-stylu ręcznej próbie.

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżka |
|---|---|
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY163_UTRATA_PRACY_KARTY_REPORT.md` |
| Zapis | `src/components/MyWork/TaskDetailView.tsx` — TYLKO `loadTask`, `handleSave`/`payload`/`personalPayload`, `taskNSections`/`TASK_AI_CARD_META`/`TASK_AI_CONTRACT_NONE` w zakresie sekcji `risk-alternatives` |
| Zapis | `server/src/validators/task.validators.ts` — TYLKO dopisanie nowych opcjonalnych pól dla `risk-alternatives` |
| Zapis | `server/src/routes/pmo/tasks.routes.ts` — WYŁĄCZNIE dodanie nowej trasy sekcji; **NIE dotykasz linii 67 ani żadnej istniejącej trasy** |
| Zapis | `server/src/controllers/TaskController.ts` — nowa metoda dla sekcji `risk-alternatives` |
| Zapis | test `server/src/routes/__tests__/day163.task-sections-persistence.pg.test.ts` |
| Zapis | migracja WYŁĄCZNIE `server/migrations/20260830_day163_task_sections.sql` |
| Odczyt | `src/components/MyWork/taskGeneratedSectionPersistence.ts` |
| Odczyt | `src/components/MyWork/DecisionDetailView.tsx` (wzorzec porównawczy — sekcja żyjąca) |
| Odczyt | `server/migrations/902_decision_structured_columns.sql` |
| Odczyt | `server/src/routes/my-work.routes.ts` — WYŁĄCZNIE żeby wiedzieć którą trasą tworzyć zadanie w R2; **nie zmieniasz** |
| Odczyt | `server/scripts/migrationOrdering.ts`, `server/scripts/migrate.postgres.ts` |
| Odczyt | `docs/program/grafika/PLAN_PO_ODBIORZE.md` (sekcja FALA 0) |

★ **ROZŁĄCZNOŚĆ:** równolegle biegną dyżury 160 (czyta `tasks.routes.ts`, **nie pisze** —
Twoja nowa trasa nie koliduje, bo dodajesz, nie zmieniasz istniejące), 161 (`server/migrations/*.sql`
— WYŁĄCZNIE pliki istniejące na markerze, Twój nowy plik migracji go nie dotyczy), 162
(`aiActionExecutor.ts`, `ai/actionExecutors/taskExecutor.ts`, `my-work.routes.ts`). **Nie
dotykasz `my-work.routes.ts`, `aiActionExecutor.ts` ani `taskExecutor.ts`** — `my-work.routes.ts`
czytasz tylko, żeby wiedzieć którą trasą utworzyć zadanie w R2.

# 5. BRAMKI ODBIORU

- **B1.** R1 ma tabelę 10×5 (sekcja × {kolumna, walidator, trasa, wysyłka, odczyt}) z dowodem
  plik:linia dla każdego TAK — nie deklaracją bez dowodu.
- **B2.** R1 rozróżnia jawnie wzorce A/B/C z T2 (cisza bez ostrzeżenia / cisza z ostrzeżeniem /
  infrastruktura odłączona) zamiast traktować cztery-pięć sekcji jako jeden, jednorodny defekt.
- **B3.** R2 ma dosłowny wynik „przed odświeżeniem / po odświeżeniu” dla każdej badanej sekcji,
  wynik zapytania SQL na żywej (lokalnej) bazie, i rozstrzygnięcie czy `localStorage`
  (`consultify-task-draft:*`) jest realnym zapisem odczytywanym z powrotem, czy zapisem-w-jedną-
  stronę.
- **B4.** R2 tworzy zadanie WYŁĄCZNIE przez `POST /api/my-work/personal-tasks` — jeśli w
  raporcie pojawi się `409` z `POST /api/tasks`, to znaczy że pomiar poszedł złą trasą i jest
  nieważny, nie że dane giną.
- **B5.** R3 ma rekomendację jednego wariantu trwałości z jawnie odrzuconymi alternatywami i
  oceną `decisions.alternatives JSONB` jako wzorca (nadaje się / nie nadaje się — z powodem).
- **B6.** R4 obejmuje DOKŁADNIE jedną sekcję (`risk-alternatives`) od migracji po test — nie
  cztery, nie „przy okazji też evidence”.
- **B7.** Migracja `20260830_day163_task_sections.sql` przechodzi pełny przebieg od PUSTEJ bazy
  (nie przyrostem na bazie już zmigrowanej) i ma strażnik `ADD COLUMN IF NOT EXISTS`, jeśli czyta
  istniejącą kolumnę.
- **B8.** Test `day163.task-sections-persistence.pg.test.ts` ma dowód mutacyjny: log pokazujący
  PASS → (celowe zepsucie produkcyjnego kodu) → FAIL → (przywrócenie) → PASS, i czyste
  `git diff` na końcu.
- **B9.** Diff dyżuru nie dotyka linii 67 `tasks.routes.ts` ani żadnej istniejącej trasy w tym
  pliku, nie dotyka `my-work.routes.ts`, `aiActionExecutor.ts`, `ai/actionExecutors/taskExecutor.ts`
  ani żadnej migracji poza `20260830_day163_task_sections.sql`.
- **B10.** Żadna z dziesięciu sekcji karty nie została skasowana ani ukryta — jeśli R1 uzna
  którąś za iluzoryczną, zostaje opisana jako taka w raporcie, nie usunięta z UI.
- **B11.** Raport zawiera sekcję „TWIERDZENIA NIEZWERYFIKOWANE” wypisującą wprost te ustalenia
  nadzorcy, których wykonawca NIE zdążył/nie zdołał potwierdzić samodzielnie z dowodem
  plik:linia, oraz odnotowuje wynik sprawdzenia `cards.json` (plik, którego instrukcja nadzorcy
  się spodziewała, a którego nie ma w repo — źle podana nazwa źródła, poprawiona na sam kod
  karty jako jedyne źródło prawdy o liczbie sekcji).
