# INSTRUKCJA DYŻURU nr 198 — Codex — „Ocena — remediacja fixture Day92 (12/20 → retest) i uczciwy sourceType Initiatives po dyżurze 178"

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
> **wyłącznie** `/private/tmp/cx-day198-ocena-fixture`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `60581ed6b5`**
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
Zakres: **04_ASSESSMENT — remediacja fixture po Day92 (`PARTIAL_DAY92_12_OF_20`); NIE otwieramy pełnego odbioru ani werdyktu `EXPERT_NO_GO`, tylko pozycje z macierzy 20 zrzutów**.
Trasy front: ``src/components/assessment/AssessmentHub.tsx` (WYŁĄCZNIE do odczytu — `loadSupplementaryData` linie ok. 636-660, blok Reports linie ok. 2246-2260, blok Initiatives linie ok. 2360-2380; `isAssessmentModuleInitiative` linie 329-342), `src/components/assessment/library/AssessmentLibraryTab.tsx` (do odczytu, kontekst po dyżurze 178)`. Trasy tył: ``server/scripts/seed-wave3-assessment-owner-review.ts` (PEŁNA licencja w zakresie R1/R2 — dopisanie kroków seedu, zakaz zmiany kontraktu `create database`/manifestu), `server/src/controllers/InitiativeController.ts`, `server/src/method-core/outputs/MethodInitiativeDraftService.ts`, `server/src/routes/method-core.routes.ts`, `server/src/routes/assessment-reports.routes.ts` — WSZYSTKIE do odczytu, wołane WYŁĄCZNIE przez istniejące endpointy z poziomu seedera, nie modyfikowane`.

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
WT=/private/tmp/cx-day198-ocena-fixture
MARKER=60581ed6b5

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day198-ocena-fixture-20260831 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day198-ocena-fixture/config.worktree"
cat "$VAULT/worktrees/cx-day198-ocena-fixture/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day198-ocena-fixture-scratch
mkdir -p /private/tmp/cx-day198-ocena-fixture-artefakty

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
git -C "$VAULT" log --oneline 60581ed6b5..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only 60581ed6b5..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day198-ocena-fixture-20260831
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 60581ed6b5..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `sześć` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day198-ocena-fixture

# (T1) MACIERZ DAY92 — 12/20, cztery brakujące klasy stanów
grep -n "12 z 20\|Brakujące\|nieosiągalny" docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY92_ASSESSMENT_OWNER_REPORT.md | head -10
#   oczekiwane: Library empty, Insights empty, Reports full, Initiatives full — jasny+ciemny, 8 pozycji.

# (T2) FIX 178 — sourceType, commit realny
git log --oneline --all | grep 44f4163a84
git show 44f4163a84 -- server/src/controllers/InitiativeController.ts | grep -n "sourceType"
#   oczekiwane: `-        sourceType: i.source_framework || i.source_type,` / `+        sourceType: i.source_type,`

# (T3) SEEDER NIGDY NIE TWORZY WIERSZA initiatives/assessments — tylko method_*
grep -n "\.post(\|\.get(" server/scripts/seed-wave3-assessment-owner-review.ts
grep -c "assessments\b" server/scripts/seed-wave3-assessment-owner-review.ts
#   oczekiwane: same wywołania `/api/method/**`; drugi grep zwraca `0`.

# (T4) REPORTS CZYTA LEGACY assessment_reports, NIE Method Core
sed -n '640,650p' src/components/assessment/AssessmentHub.tsx
#   oczekiwane: `Api.getAssessmentReports(undefined)`, nie wywołanie `/api/method/**`.

# (T5) BRAK ŚCIEŻKI DRAFT -> REGISTERED INITIATIVE (decyzja architektoniczna)
sed -n '1,13p' server/src/method-core/outputs/MethodInitiativeDraftService.ts
sed -n '1950,1960p' server/src/routes/method-core.routes.ts
#   oczekiwane: komentarz wprost stwierdzający brak `register`/`registerInitiative`.

# (T6) NAZWA BAZY — rodzina assessment w adoptedFixtureContracts
grep -n "assessment_owner" scripts/dev/start-wave3-owner-runtime.mjs
#   oczekiwane: regex `^consultify_w3_assessment_owner_[a-z0-9_]+$`.
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day198-ocena-fixture-20260831` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6130`. Twój JEDYNY port harnessu to `5070 i 5071`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day198-pg`**. **ZAKAZANE:** `6012, 5433, 6047, 6054-6129, 5010-5069, 6404-6411 (odbiory nadzorcy + dyżury 170-196), 6131/5072-5073 (dyżur 200, ta sama partia — NIE używaj), 6132/5074-5075 (dyżur 202, ta sama partia — NIE używaj). ★ PORT 5000 ZAJĘTY NA STAŁE przez macOS Control Center. ★ PORT 5037 zajęty przez adb`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak — ten dyżur NIE wprowadza ani jednej nowej flagi i NIE zmienia wartości domyślnej żadnej istniejącej (w tym `ENABLE_V8_GLOBAL`, którego ten moduł w ogóle nie używa)`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY198_OCENA_REPORT.md`. `docs/program/waves/WAVE_03_ACCEPTANCE/modules/04_ASSESSMENT/MODULE_ACCEPTANCE.md` — WYŁĄCZNIE bounded update wzorem sekcji „Day 92” (nowa sekcja „Day 198”, aktualizacja liczby `X/20` w `G06`/`G10` z cytatem dowodu). Zakaz zmiany `Current gate:` na górze pliku — werdykt `EXPERT_NO_GO`/`OWNER_REVIEW_IN_PROGRESS` należy do właściciela. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day198-ocena-fixture-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day198-ocena-fixture-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **NIE PROJEKTUJESZ ścieżki API „draft → Registered Initiative”.** `MethodInitiativeDraftService.ts` i `method-core.routes.ts:1954-1958` dokumentują to jako świadomą decyzję produktową („Register as Initiative to decyzja człowieka”, poza Method Core) — dodanie takiej ścieżki jest decyzją właściciela, nie tego dyżuru. Jeśli R1/R3 wymaga wiersza w `initiatives` dla „Initiatives full”, tworzysz go z poziomu SEEDERA przez istniejący, ogólny endpoint tworzenia inicjatyw (albo — jeśli ten endpoint ma twardą bramę formuły/`projectId`, której nie da się spełnić z poziomu seedu bez fabrykowania treści — dokumentujesz to jako STOP MERYTORYCZNY tej pod-pozycji z cytatem bramy, nie obchodzisz jej surowym `INSERT`). **NIE ZMIENIASZ `MethodInitiativeDraftService.ts` ani `method-core.routes.ts`.** **NIE ZMIENIASZ kodu `AssessmentHub.tsx`** żeby Reports/Insights zaczęły czytać inne API — to byłaby zmiana architektury ("Reports powinien czytać Method Core"), poza licencją tej remediacji fixture; jedyny dozwolony fix jest po stronie seed/fixture. **NIE PODNOSISZ werdyktu `MODULE_ACCEPTANCE.md`** — `Current gate:` zostaje bez zmian, tylko bounded update liczby stanów w `G06`/`G10` wzorem sekcji „Day 92”. **NIE ZAKŁADASZ, że fix 178 rozwiązał „Initiatives full”** — to teza do zmierzenia (T2/T3 wyżej), nie fakt; jeśli po Twoim seedowaniu stan nadal jest nieosiągalny, zapisujesz to wprost, nie "naprawiasz" milcząco zmieniając zakres R1. **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.** | Dyżur 92 (`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY92_ASSESSMENT_OWNER_REPORT.md`) zmierzył wprost na fixture `W3-ASSESSMENT-OWNER-v1`: **12 z 20 zrzutów semantycznie poprawnych**, z ośmioma brakującymi w czterech klasach — Library empty (jasny/ciemny), Insights empty (jasny/ciemny), Reports full (jasny/ciemny), Initiatives full (jasny/ciemny). `MODULE_ACCEPTANCE.md` (`docs/program/waves/WAVE_03_ACCEPTANCE/modules/04_ASSESSMENT/MODULE_ACCEPTANCE.md`, sekcja „Day 92 owner screenshot packet”) niesie to jako `G06: PARTIAL_DAY92_12_OF_20` i `G10: PARTIAL_DAY92_MEASURED` — bounded update, werdykt `EXPERT_NO_GO` bez zmian. Dyżur 178 (`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY178_OCENA_REPORT.md`, commit `44f4163a84`) naprawił realny bug w `InitiativeController.ts:363` (`sourceType: i.source_framework || i.source_type` nadpisywało `'assessment'` frameworkiem `'DRD'`, więc filtr klienta `isAssessmentModuleInitiative` w `AssessmentHub.tsx:336` odrzucał rekord) — ale weryfikacja seedera (`server/scripts/seed-wave3-assessment-owner-review.ts:400-413`) pokazuje, że fixture Day92 tworzy WYŁĄCZNIE wiersz `method_initiative_drafts` przez `POST /api/method/outputs/{id}/initiative-drafts`, nigdy wiersz w tabeli `initiatives`, którą czyta `GET /api/initiatives?source=assessment`. `MethodInitiativeDraftService.ts:1-13` i `method-core.routes.ts:1954-1958` dokumentują to jako ŚWIADOMĄ decyzję architektoniczną — `method_initiative_drafts` NIE MA kolumny `initiative_id`, klasa nie ma metody `register`/`registerInitiative`, a „Register as Initiative” to decyzja człowieka w module Initiatives, poza zasięgiem Method Core. Fix 178 jest więc prawdziwy i potrzebny, ale osobno od pytania, czy fixture w ogóle wytwarza wiersz do przefiltrowania — to musi zmierzyć ten dyżur, nie zakładać. Równolegle, Reports czyta `Api.getAssessmentReports` → tabelę legacy `assessment_reports` (`AssessmentHub.tsx:645`, `assessment-reports.routes.ts:610-660`), której POST wymaga istniejącego wiersza w legacy `assessments` (`assessment-reports.routes.ts:855-865`) — seeder Method Core nie tworzy ANI JEDNEGO wiersza w `assessments` ani `assessment_reports` (zero trafień `grep -n "assessments\b" seed-wave3-assessment-owner-review.ts`). To dwa niezależne modele danych pod jednym menu — dokładnie to, co Day92 nazwał „Reports full nieosiągalny”. |

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
cd /private/tmp/cx-day198-ocena-fixture

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day198-pg psql -U postgres -d consultify_w3_assessment_owner_cx198 \
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
cd /private/tmp/cx-day198-ocena-fixture

docker run -d --name cx-day198-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=consultify_w3_assessment_owner_cx198 \
  -p 127.0.0.1:6130:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day198-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6130/consultify_w3_assessment_owner_cx198 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6130/consultify_w3_assessment_owner_cx198 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day198-ocena-fixture && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6130/consultify_w3_assessment_owner_cx198 \
JWT_SECRET=cx198-test-secret-do-not-reuse \
npx vitest run tests/integration/assessment, src/components/assessment/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day198-ocena-fixture-artefakty/day198-assessment.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day198-ocena-fixture && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run tests/integration/assessment, src/components/assessment/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day198-ocena-fixture-artefakty/day198-assessment.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day198-ocena-fixture/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day198-pg psql -U postgres -d consultify_w3_assessment_owner_cx198 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day198-pg`.
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
> **(e) ★★ **Pierwsza — nie myl dwóch systemów "inicjatyw".** `method_initiative_drafts` (Method Core, event-store, brak `initiative_id`) i `initiatives` (tabela klasyczna czytana przez `InitiativeController`/`GET /api/initiatives`) to DWA różne magazyny. Fix 178 poprawił mapowanie POLA w drugim z nich — nie stworzył mostu między nimi. Zanim uznasz R1/R3 dla Initiatives za zamknięte, MUSISZ zmierzyć: czy po Twoim seedzie istnieje realny wiersz w `initiatives` z `source_type='assessment'` i `organization_id` zgodnym z fixture, widoczny przez `GET /api/initiatives?source=assessment` przez realny `ApiGateway` z podpisanym JWT — sam fakt, że `sourceType` już się nie nadpisuje, nie wystarcza, jeśli wierszy jest zero. **Druga — Library nie ma pola statusu do filtrowania.** `AssessmentLibraryTab.tsx` (`grep -n "filter\|Filter" src/components/assessment/library/AssessmentLibraryTab.tsx` → zero trafień) renderuje statyczny katalog frameworków (DRD/SIRI/ADMA/CMMI/LEAN) bez pola "rejected"/"archived" — klik w filtr "Rejected 0" (widoczny gdzie indziej w hubie) nie ma żadnego efektu na tym ekranie, bo nie istnieje predykat, który by cokolwiek odfiltrował. Zanim zaczniesz "naprawiać filtr", zmierz czy filtr w ogóle jest częścią kontraktu Library, czy to R2 powinno wprost wnioskować "Library empty nie jest legalnym stanem tego ekranu, usuń go z macierzy 20" — obie odpowiedzi są dopuszczalne, żadna nie jest "się nie udało". **Trzecia — Insights ma ten sam kształt pułapki, ale z realnymi danymi.** Day92 zmierzył output/snapshot obecne w bazie, a mimo to filtr "Archived 0" nie odfiltrował niczego (bo output nie ma pola `archived`). Uczciwy pusty stan Insights może wymagać DRUGIEJ, celowo pustej organizacji w tym samym fixture (`dane bez wpisów`) zamiast naprawiania nieistniejącego filtra — sprawdź oba warianty i wybierz na podstawie pomiaru, nie domysłu. **Czwarta — `assessment_reports` wymaga wiersza w legacy `assessments`, którego Twój fixture nie ma.** `POST /api/assessment-reports` (`assessment-reports.routes.ts:855-865`) odpytuje `SELECT ... FROM assessments WHERE id=? AND organization_id=?` i zwraca `404`, jeśli brak. Zanim wywołasz `POST /api/assessment-reports` z seedera, MUSISZ najpierw wytworzyć wiersz `assessments` (sprawdź, czy istnieje do tego osobny, prostszy endpoint zamiast surowego `INSERT` — seeder Method Core konsekwentnie chodzi przez API, nie przez SQL, i to samo powinno dotyczyć Twojego dopisania). **Piąta — GET listy Reports nie filtruje po statusie**, więc wiersz w dowolnym stanie (`DRAFT` wystarczy) czyni ekran pełnym; nie musisz prowadzić rekordu przez cały workflow zatwierdzania, żeby osiągnąć "Reports full".**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day198-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day198-ocena-fixture-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`pozycja R1 — Reports osiąga uczciwy pełny stan (`07-reports-*-full.png`) przez naprawę seed/fixture, nie przez zmianę kodu produktu`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6130` albo `5070 i 5071` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6130` albo `5070 i 5071`** (`Z7`).

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

Dwie sprawy zostały zmierzone przy wcześniejszych odbiorach — żadna nie jest hipotezą postawioną
dziś.

**Pierwsza.** Dyżur 92 (`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY92_ASSESSMENT_OWNER_REPORT.md`)
zmierzył na fixture `W3-ASSESSMENT-OWNER-v1` macierz 5 powierzchni (Library, Processes, Insights,
Reports, Initiatives) × 2 stanów (pełny/pusty) × 2 motywów = 20 zrzutów. Wynik dosłowny:

```
Stan: PARTIAL — 12 Z 20 PLIKÓW / 12 Z 20 SENSOWNYCH
```

Osiem brakujących, w czterech klasach (jasny+ciemny każda):

- **Library empty** — nieosiągalny: kliknięcie filtra `Rejected 0` nie filtruje statycznego
  katalogu frameworków.
- **Insights empty** — nieosiągalny w niepustej fixture: `Archived 0` nie filtruje istniejącego
  outputu.
- **Reports full** — nieosiągalny: ekran czyta osobny `Api.getAssessmentReports`, nie Method Core
  output; readback miał 2 sesje i 1 frozen output, ekran pokazywał „No assessments found”.
- **Initiatives full** — nieosiągalny: ekran czyta `/initiatives?source=assessment`, nie Method
  Core initiative draft; readback miał 1 `method_initiative_drafts`, ekran pokazywał „No
  assessments found”.

`MODULE_ACCEPTANCE.md` niesie to jako bounded update `G06: PARTIAL_DAY92_12_OF_20` i
`G10: PARTIAL_DAY92_MEASURED` — werdykt modułu (`EXPERT_NO_GO / OWNER_REVIEW_IN_PROGRESS`) **nie
zmienił się** i nie zmienia się w tym dyżurze; to nie jest ponowny odbiór, tylko domknięcie
konkretnych, imiennie wskazanych pozycji z tej macierzy.

**Druga.** Dyżur 178 (`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY178_OCENA_REPORT.md`,
commit `44f4163a84`) naprawił realny bug:

```ts
// server/src/controllers/InitiativeController.ts:363, PRZED
sourceType: i.source_framework || i.source_type,
// PO
sourceType: i.source_type,
```

Gdy rekord miał ustawiony `source_framework` (np. `'DRD'`), backend zwracał `sourceType: 'DRD'`
zamiast `'assessment'` — a filtr klienta `isAssessmentModuleInitiative`
(`AssessmentHub.tsx:329-342`) dopuszcza wyłącznie `sourceType === 'assessment'` (lub
`assessment_report`/`assessment_drd`/`assessment_siri`/`assessment_adma`). Rekord z nadpisanym
`sourceType` znikał z listy Initiatives po stronie klienta. To jest prawdziwy, konkretny bug i fix
178 go poprawnie usuwa.

**Ale to NIE jest to samo, co „Initiatives full jest teraz osiągalne w fixture Day92”.** Weryfikacja
seedera (`server/scripts/seed-wave3-assessment-owner-review.ts:400-413`) pokazuje, że jedyne
działanie seedu wobec inicjatyw to:

```ts
const d = await request(app)
  .post(`/api/method/outputs/${output.id}/initiative-drafts`)
  .set(auth(toks.owner))
  .send({ findingIds: ..., title: ..., rationale: ..., expectedOutcome: ..., confidence: 'medium' });
```

To tworzy WYŁĄCZNIE wiersz w `method_initiative_drafts` — tabeli, która **nie ma kolumny
`initiative_id`** i której serwis **nie ma metody `register`/`registerInitiative`**
(`MethodInitiativeDraftService.ts:1-13`, dosłownie: „★ THIS CLASS HAS NO `register`/
`registerInitiative` METHOD… ‘Register as Initiative’ to decyzja człowieka” — poza zasięgiem tego
serwisu, z konstrukcji, nie przez zaniedbanie). `method-core.routes.ts:1954-1958` potwierdza to
z drugiej strony: „No `register`/`registerInitiative` call exists anywhere in this file… ‘Register
as Initiative’ has no HTTP path here by construction”. Innymi słowy: fixture Day92 **nigdy nie
tworzy wiersza w tabeli `initiatives`**, którą czyta `GET /api/initiatives?source=assessment` —
fix 178 poprawia mapowanie pola w tabeli, do której fixture nic nie wpisuje. Czy „Initiatives full”
jest po fixie 178 osiągalne, jest więc PYTANIEM DO ZMIERZENIA w tym dyżurze (R3), nie faktem do
przepisania z karty poprzedniego dyżuru.

Równolegle, „Reports full” ma inną, ale analogiczną przyczynę: `Api.getAssessmentReports`
(`AssessmentHub.tsx:645`) czyta legacy tabelę `assessment_reports`
(`server/src/routes/assessment-reports.routes.ts`), której `POST` wymaga istniejącego wiersza w
legacy tabeli `assessments` (`assessment-reports.routes.ts:855-865`, `404` jeśli brak). Seeder
Method Core nie tworzy ANI JEDNEGO wiersza w `assessments` — cały fixture chodzi przez
`/api/method/**` (sesje, zdarzenia, freeze, initiative-drafts), które są kompletnie osobnym modelem
danych od legacy `assessments`/`assessment_reports`. To jest dokładnie to, co odbiór 178 nazwał
„kod czysty” — bo `AssessmentHub.tsx` poprawnie czyta to, co istnieje; luka jest w tym, że fixture
nic tam nie zapisuje.

# 2. TEZY ZLECENIA

- **T1.** Macierz 20 stanów Day92 (12/20 sensownych) jest zmierzonym faktem, nie hipotezą — punkt
  wyjścia tego dyżuru, nie coś do ponownego udowadniania od zera.
- **T2.** Fix 178 (sourceType) jest realny i potrzebny, ale sam z siebie **nie dowodzi**, że
  „Initiatives full” jest dziś osiągalne w fixture Day92 — fixture nigdy nie tworzy wiersza w
  tabeli `initiatives`. Ta teza wymaga pomiaru w R3, nie założenia.
- **T3.** „Reports full” jest nieosiągalne z przyczyny **danych fixture**, nie kodu UI — Method
  Core (sesje/outputy) i legacy `assessments`/`assessment_reports` to dwa rozłączne magazyny, a
  seeder zasila wyłącznie pierwszy.
- **T4.** „Library empty” i „Insights empty” mogą być nieosiągalne z dwóch różnych powodów, które
  wymagają osobnego rozstrzygnięcia: (a) filtr istnieje wizualnie, ale nie ma predykatu, który by
  cokolwiek odfiltrował (Library — brak pola statusu w statycznym katalogu; Insights — output nie
  ma pola `archived`), albo (b) uczciwy pusty stan wymaga danych bez wpisów (druga, celowo pusta
  organizacja), nie naprawy filtra.

# 3. POZYCJE DYŻURU

## R1 — Reports osiąga uczciwy pełny stan (rdzeń)

Napraw **wyłącznie fixture/seed**, nie kod produktu. Rozszerz
`server/scripts/seed-wave3-assessment-owner-review.ts` tak, żeby po seedzie istniał co najmniej
jeden wiersz w legacy `assessment_reports`, widoczny przez `GET /api/assessment-reports` (który
nie filtruje po statusie — `DRAFT` wystarczy, patrz `assessment-reports.routes.ts:600-660`, brak
warunku `status` gdy `req.query.status` nie jest podany).

Kroki, w kolejności, wszystkie przez istniejące HTTP endpointy (ten sam wzorzec co reszta seedera —
`supertest`/`request(app)`, nie surowy `INSERT`, chyba że zmierzysz i udokumentujesz, że żaden
endpoint tego nie umożliwia):

1. Utwórz wiersz w legacy `assessments` dla tej samej organizacji co fixture Method Core (znajdź
   właściwy endpoint tworzenia — sprawdź `server/src/controllers/AssessmentController.ts` i trasy
   pod `/api/assessments`, zanim założysz, że trzeba pisać nowy kod).
2. Wywołaj `POST /api/assessment-reports` z `assessmentId` z kroku 1.
3. Cold readback: `GET /api/assessment-reports` (bez filtra statusu) zwraca ≥ 1 wiersz.

Jeżeli krok 1 wymaga pól/kontraktu, których nie da się uczciwie wypełnić bez fabrykowania danych
(np. sztywnej zależności od funkcji spoza zakresu Method Core) — to jest STOP MERYTORYCZNY tej
pod-pozycji z cytatem bramy blokującej, nie powód do surowego SQL ani do pominięcia R1 w całości.

**Ukończone, gdy:** świeży cold readback po Twoim seedzie pokazuje ≥ 1 wiersz `assessment_reports`
dla organizacji fixture, i realny zrzut ekranu `Reports` (jasny + ciemny) pokazuje treść zamiast
„No assessments found”.

## R2 — Library/Insights: uczciwy pusty stan, rozstrzygnięty pomiarem

Zmierz najpierw, zanim naprawisz cokolwiek:

1. Czy `AssessmentLibraryTab.tsx` ma w ogóle pole/predykat, po którym dałoby się COKOLWIEK
   odfiltrować do zera (`grep -n "filter\|Filter\|status" src/components/assessment/library/AssessmentLibraryTab.tsx`).
   Jeśli katalog jest statyczny i bez pola statusu — pusty stan tego ekranu nie jest osiągalny
   przez filtr DLA ŻADNEJ organizacji, i to jest wniosek do zapisania (`Library empty` nie jest
   legalnym stanem tego ekranu w obecnej architekturze), nie coś do "naprawienia" wymyślaniem
   nowego pola.
2. Czy Insights ma analogiczny brak (`Archived` bez pola `archived` na outpucie) — jeśli tak,
   sprawdź, czy uczciwy pusty stan jest osiągalny przez **drugą, celowo pustą organizację** w tym
   samym fixture (zero sesji Method Core dla tej organizacji) zamiast przez filtr na istniejących
   danych.

Wybierz i wykonaj DOKŁADNIE JEDNĄ z dwóch dróg na podstawie pomiaru — nie obie na wyczucie:
(a) jeśli istnieje realny predykat do naprawienia, napraw go najwęższą możliwą zmianą i udowodnij
mutacyjnie; (b) jeśli nie istnieje, rozszerz fixture o pustą organizację/perspektywę i użyj jej do
zrzutów empty. Jeśli żadna droga nie daje uczciwego wyniku w rozsądnym czasie — zapisz to jako
znalezisko dla właściciela („te dwa stany nie są dziś osiągalne żadną uczciwą drogą, oto dlaczego”)
zamiast fabrykować pozorny sukces.

**Ukończone, gdy:** dla obu ekranów (Library, Insights) masz albo realny zrzut pustego stanu (jasny
+ ciemny) osiągnięty jedną z dwóch dróg, albo udokumentowane, zmierzone uzasadnienie, dlaczego
żadna droga nie jest dziś uczciwa.

## R3 — pakiet 20/20 przez kanoniczny runtime + retest wiersza NO_GO w karcie

Uruchom `scripts/dev/start-wave3-owner-runtime.mjs` z bazą `consultify_w3_assessment_owner_cx198`
(fixture `W3-ASSESSMENT-OWNER-v1`) po Twoich zmianach z R1/R2. Wykonaj pełną macierz 5 powierzchni ×
2 stany × 2 motywy = 20 zrzutów, tym samym wzorcem oględzin co dyżur 92 (nagłówki/wartości,
ucięcia, UUID, liczby/daty, crimson-tylko-semantyka-krytyczna).

Dla Initiatives full: NIE zakładaj sukcesu z tytułu fixu 178. Zmierz realny łańcuch: seed → cold
readback SQL na `initiatives` (czy wiersz w ogóle istnieje) → `GET /api/initiatives?source=assessment`
przez realny `ApiGateway` z podpisanym JWT → zrzut ekranu. Jeśli wiersz w `initiatives` nie istnieje
(bo R1 się na to nie skupiał — patrz T2), zapisz wprost, że „Initiatives full” pozostaje
nieosiągalne z INNEGO powodu niż ten, który naprawił dyżur 178, i że to osobne finding, nie
regresja tej instrukcji.

Zaktualizuj `MODULE_ACCEPTANCE.md` **wyłącznie** przez dopisanie nowej sekcji „Day 198” wzorem
sekcji „Day 92” (ten sam format: `G06`/`G10` z nową liczbą `X/20`, cytat dowodu, zdanie „No product
verdict change”). Nie zmieniasz `Current gate:` na górze pliku — to decyzja właściciela.

**Ukończone, gdy:** masz zliczoną, uczciwą liczbę `X/20` z tego przebiegu (nie przepisaną z dyżuru
92), z plikami PNG + SHA-256 w `/private/tmp/cx-day198-ocena-fixture-artefakty`, i bounded update w karcie bez zmiany werdyktu.

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis | `server/scripts/seed-wave3-assessment-owner-review.ts` — WYŁĄCZNIE dopisanie kroków R1/R2 (nowe wywołania HTTP w `seed()`); zakaz zmiany kontraktu `create database`, wzorca nazwy bazy, wymogu `ASSESSMENT_OWNER_FIXTURE_CONFIRM=YES` i manifestu |
| Zapis | testy `day198.*` — lokalizację potwierdź wg konwencji sąsiadującej z każdym zmienianym plikiem (`tests/integration/assessment/`, `src/components/assessment/__tests__/`) |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY198_OCENA_REPORT.md` |
| Zapis (bounded, §R.1) | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/04_ASSESSMENT/MODULE_ACCEPTANCE.md` — WYŁĄCZNIE nowa sekcja „Day 198” wzorem „Day 92”; zakaz zmiany `Current gate:` |
| Odczyt | `src/components/assessment/AssessmentHub.tsx`, `src/components/assessment/library/AssessmentLibraryTab.tsx` — kontekst R1/R2; jeśli pomiar wykaże, że pozycja NAPRAWDĘ wymaga zmiany tu, produkujesz czerwony kontrakt + brief, nie zmieniasz pliku |
| Odczyt | `server/src/controllers/InitiativeController.ts`, `server/src/method-core/outputs/MethodInitiativeDraftService.ts`, `server/src/routes/method-core.routes.ts` — dowód T2/T3; **nie zmieniasz** (patrz `Z40`) |
| Odczyt | `server/src/routes/assessment-reports.routes.ts` — wołany WYŁĄCZNIE przez istniejące endpointy z seedera; nie zmieniasz |
| Odczyt | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY92_ASSESSMENT_OWNER_REPORT.md`, `CODEX_DAY178_OCENA_REPORT.md` — dowód tez; nie zmieniasz |
| Odczyt | `scripts/dev/start-wave3-owner-runtime.mjs` — kontrakt `adoptedFixtureContracts` dla rodziny `assessment`; nie zmieniasz |

**Nietykalne imiennie:** `Current gate:` w `MODULE_ACCEPTANCE.md` (werdykt właściciela);
`MethodInitiativeDraftService.ts` i cała ścieżka „Register as Initiative” (decyzja architektoniczna
poza tym dyżurem); `assessment-reports.routes.ts` i `method-core.routes.ts` jako kod (wołane, nie
zmieniane).

★ **Rozłączność z dyżurami równoległymi 200 (Finanse) i 202 (Spotkania):** żaden plik tego dyżuru
(`server/scripts/seed-wave3-assessment-owner-review.ts`, pliki `src/components/assessment/**`,
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/04_ASSESSMENT/**`) nie pokrywa się z zakresem
Finansów (`src/components/Economics/**`, `src/components/Finance/**`, `src/components/Benefits/**`,
`server/src/routes/v8/finance-valuation.routes.ts`) ani Spotkań (`src/components/Meeting/**`,
`public/locales/*/translation.json` klucze `meeting.*`). Port/baza/kontener wyłączne — patrz `Z7`.

# 5. TWARDE ZASADY

- ★ **NIE tworzysz ścieżki API „draft → Registered Initiative”.** To świadoma decyzja
  architektoniczna właściciela (cytat w `Z40`/`PULAPKA` powyżej), nie luka do załatania.
- **NIE zmieniasz kodu `AssessmentHub.tsx`** żeby czytał inne API dla Reports/Insights — jedyny
  dozwolony fix jest po stronie seed/fixture.
- **NIE zakładasz, że fix 178 domyka „Initiatives full”** — to zmierz w R3, z realnym cold
  readbackiem na tabeli `initiatives`, nie tylko z faktem, że `sourceType` już się nie nadpisuje.
- **NIE podnosisz werdyktu `MODULE_ACCEPTANCE.md`** — bounded update liczby stanów, `Current gate:`
  bez zmian.
- **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.** Wszystko lokalnie.
- Pułapka: `No test files found` NIE jest `PASS`. Sprawdź `numTotalTests` > 0 w każdym wyniku,
  który przywołujesz jako dowód.
- ★ Port **5000 jest zajęty na stałe przez macOS Control Center** — nie używaj go do żadnego
  serwera pomocniczego.
- Wymóg sekcji „TWIERDZENIA NIEZWERYFIKOWANE” w raporcie końcowym — wypisz w niej wprost, jeśli
  którakolwiek z ośmiu brakujących pozycji Day92 pozostała nieosiągalna także po Twoich zmianach, i
  dlaczego (uczciwy `X/20` poniżej 20 jest poprawnym, akceptowalnym wynikiem tego dyżuru — nie jest
  porażką, jeśli jest zmierzony i wyjaśniony).
