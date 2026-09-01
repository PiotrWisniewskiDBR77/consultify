# INSTRUKCJA DYŻURU nr 218 — Codex — „ekran polityk AI pokazuje zera zamiast błędu — trzy niezależne przyczyny, nie jedna"

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
> **wyłącznie** `/private/tmp/cx-day218-admin-polityki`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `9fb7942a01`**
> **Gałąź bazowa: `github-backup/codex/m03-admin-20260824`**
> **Stan dokumentu: WYDANY**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo jakiekolwiek niewypelnione pole szablonu — **dokument nie
> jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.
> Ta ramka jest **jedynym** miejscem, w którym rozstrzyga się stan wydania.
> Objaśnienia w innych blokach cytowanych **nie** są powodem do STOP-u.

Data wystawienia: 2026-09-01.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.
Zakres: **14 Admin — ekran AI Policy (`AdminAIControlCenterPanel` pod `/admin`), backend `adminP32.routes.ts` funkcja `readAiSummary`**.
Trasy front: `/admin (zakładka Governance/AI, komponent AdminAIControlCenterPanel wewnątrz AdminSettingsModule)`. Trasy tył: `GET /api/admin/ai/summary (adminP32.routes.ts, montowany w Gateway.ts:639)`.

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
WT=/private/tmp/cx-day218-admin-polityki
MARKER=9fb7942a01

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day218-admin-polityki-20260901 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day218-admin-polityki/config.worktree"
cat "$VAULT/worktrees/cx-day218-admin-polityki/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day218-admin-polityki-scratch
mkdir -p /private/tmp/cx-day218-admin-polityki-artefakty

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
git -C "$VAULT" log --oneline 9fb7942a01..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only 9fb7942a01..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day218-admin-polityki-20260901
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 9fb7942a01..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `dziewięć (T1–T8, z T3 rozbitym na dwie komendy T3/T3b)` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.


```bash
cd /private/tmp/cx-day218-admin-polityki

# T1 — zadna migracja nie tworzy llm_org_policies
grep -rl llm_org_policies server/migrations/
#   oczekiwane: brak wyjscia (0 trafien)

# T2 — trasa GET /ai/summary istnieje i jest zamontowana pod /api/admin
grep -n "router.get(\n  '/ai/summary'" server/src/routes/adminP32.routes.ts || grep -n "'/ai/summary'" server/src/routes/adminP32.routes.ts
grep -n "adminP32Routes" server/src/Gateway.ts
#   oczekiwane: handler '/ai/summary' w adminP32.routes.ts + app.use('/api/admin', adminP32Routes) w Gateway.ts

# T3 — PolicySummary NIE ma pol policyLevel/modelCount/budgetStatus
sed -n '48,59p' server/src/services/aiPolicyEngine.ts
#   oczekiwane: pola currentLevel/description/capabilities/internetEnabled/auditRequired — BRAK policyLevel/modelCount/budgetStatus

# T3b — front czyta te nieistniejace pola
grep -n "policyLevel\|modelCount\|budgetStatus" src/components/Admin/AdminAIControlCenterPanel.tsx
#   oczekiwane: co najmniej 3 trafienia (typ + dwa miejsca odczytu)

# T4 — OrgContextPolicy NIE ma defaultSensitivity/allowExternalContext
sed -n '25,28p' server/src/services/ai/contextGovernance.ts
grep -n "defaultSensitivity\|allowExternalContext" src/components/Admin/AdminAIControlCenterPanel.tsx
#   oczekiwane: typ ma categories/piiRedaction/retention; front czyta pola spoza tego typu

# T5 — tabele zrodlowe ai_policies i organization_ai_settings istnieja w migracjach
grep -rln "CREATE TABLE.*ai_policies\b" server/migrations/
grep -rln "CREATE TABLE.*organization_ai_settings" server/migrations/
#   oczekiwane: co najmniej jedno trafienie kazde — potwierdz REALNIE na swiezym kontenerze po migracjach (\d ai_policies), nie samym grepem

# T6 — get() w DbPromise.ts nie ma selektywnego wyciszania (w odroznieniu od all())
grep -n "isSilenceableMissingRelationError" server/src/utils/DbPromise.ts
#   oczekiwane: wystepuje w funkcji all(), NIE w get()

# T7 — trzy niezalezne try/catch w readAiSummary
sed -n '1485,1524p' server/src/routes/adminP32.routes.ts
#   oczekiwane: trzy bloki try/catch, kazdy zeruje swoje pole na null bez zapisania faktu bledu

# T8 — brak dev-render harnessu dla tego ekranu dzis
grep -rl "AdminSettingsModule\|AdminAIControlCenterPanel" dev-render/screens/
#   oczekiwane: brak wyjscia (0 trafien)
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day218-admin-polityki-20260901` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6161`. Twój JEDYNY port harnessu to `5110 i 5111`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day218-pg`**. **ZAKAZANE:** `6012, 5433, 6047, 6054-6160, 5010-5109, 6404-6411, 6162 (dyżur 219, równoległy), 5112-5113 (dyżur 219, równoległy); ZABRONIONE NA PRZÓD (dyżury 220-232): 6163-6175 oraz 5114-5139; NA STAŁE: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP/ERR_UNSAFE_PORT)`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak — ten dyżur NAPRAWIA istniejący, dziś zamontowany ekran (błędne dane → uczciwy stan), nie wprowadza nowego ekranu w rozumieniu Z11. Zero nowych flag funkcyjnych`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/auth.middleware.ts` (`verifyToken`) · `server/src/middleware/admin.middleware.ts` (rola ADMIN/OWNER/SUPERADMIN) · `getAdminActor` (`adminP32.routes.ts:286`, WEWNĄTRZ pliku, który edytujesz — NIE dotykasz tej funkcji, tylko `readAiSummary`/handler `GET /ai/summary`) · `server/src/services/aiRoleGuard.ts`/`server/src/services/regulatoryModeGuard.ts` (czytane tranzytywnie przez `AIPolicyEngine.getEffectivePolicy`, wyłącznie odczyt)`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY218_ADMIN_POLITYKI_REPORT.md`. Jedyny inny dokument do zmiany: `docs/program/waves/WAVE_03_ACCEPTANCE/modules/14_ADMIN/MODULE_ACCEPTANCE.md` — WYŁĄCZNIE nowy wpis `PARTIAL_PROGRESS`/`FIXED` dla wiersza AI Policy (§4 tej instrukcji), bez zmiany głównej bramki modułu. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day218-admin-polityki-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day218-admin-polityki-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ Ten dyżur i dyżur 219 wchodzą W TEN SAM PLIK `server/src/routes/adminP32.routes.ts` tego samego dnia — Ty WYŁĄCZNIE w `readAiSummary` (ok. `:1485-1524`) i handler `GET /ai/summary` (ok. `:2559-2567`); dyżur 219 WYŁĄCZNIE w `readBillingInvoices`/`readScimSummary`. Przed pierwszym commitem sprawdź `git log`/gałąź `codex/day219-admin-schematy-20260901` pod kątem zmian w tym pliku i zgłoś kolizję ZANIM zaczniesz pisać — NIE zakładaj rozłączności, zmierz ją. ★★ Migracja WYŁĄCZNIE w przedziale `20260932`–`20260934` (przedział `20260936`–`20260939` należy do dyżuru 219, TYLKO ODCZYT). ★★ Zakaz fabrykowania metryk bez backendu (R2b/R3) — `modelCount`/`budgetStatus`/`defaultSensitivity`/`allowExternalContext` nie mają dziś żadnego backendu; realny odpowiednik albo jawne „niedostępne", nigdy wymyślona liczba. ★ Pułapka migracji: `server/scripts/migrate.postgres.ts:266` wyklucza z Postgresa KAŻDY plik zaczynający się od `000_initdb_` — nie licz kolejności migracji z samego `ls`/`grep CREATE TABLE`, zmierz na świeżym kontenerze po pełnym łańcuchu | Rozłączność plikowa z dyżurem 219: oba dyżury edytują ten sam ~2900-liniowy plik routingu tego samego dnia — kolizja bez wcześniejszego sprawdzenia potrafi nadpisać cudzy commit przy scalaniu. Zakaz fabrykowania metryk: `POMIAR_MODULOW_2026-08-31_WIECZOR.md:36-37` nazywa ten dokładny wzorzec („awaria zamieniona w pustą wartość, pokazana jako stan faktyczny") ósmą klasą kłamstwa programu — wymyślona liczba zamiast `null` byłaby DZIEWIĄTĄ, gorszą, bo wygląda wiarygodnie |

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
cd /private/tmp/cx-day218-admin-polityki

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day218-pg psql -U postgres -d cx218 \
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
cd /private/tmp/cx-day218-admin-polityki

docker run -d --name cx-day218-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx218 \
  -p 127.0.0.1:6161:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day218-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6161/cx218 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6161/cx218 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day218-admin-polityki && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6161/cx218 \
JWT_SECRET=cx218-test-secret-do-not-reuse \
npx vitest run server/src/routes/__tests__/adminP32.routes.test.ts tests/integration/adminAiPolicySummary.day218.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day218-admin-polityki-artefakty/day218-admin-polityki.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day218-admin-polityki && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/routes/__tests__/adminP32.routes.test.ts tests/integration/adminAiPolicySummary.day218.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day218-admin-polityki-artefakty/day218-admin-polityki.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day218-admin-polityki/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day218-pg psql -U postgres -d cx218 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day218-pg`.
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
> **(e) `server/src/utils/DbPromise.ts` ma DWIE różne funkcje o różnym zachowaniu logowania na błędzie: `all()` (`:202-306`) selektywnie wycisza log WYŁĄCZNIE dla błędów „relation does not exist"/„no such table" (`isSilenceableMissingRelationError`, `:191-197`), inne błędy (np. „column does not exist") loguje zawsze; `get()` (`:326-427`) NIE MA tego rozróżnienia — loguje KAŻDY błąd. Ale OBIE, przy domyślnym `{fallback:true}`, zwracają `[]`/`null` niezależnie od tego, czy zapytanie się powiodło z zerem wierszy, czy rzuciło wyjątek — więc test asercjonujący samą WARTOŚĆ zwróconą przez `readAiSummary` (a nie stan bazy PRZED wywołaniem) przejdzie identycznie w obu światach, w trybie testowym i produkcyjnym. Nie jest to klasyczna pułapka „strażnik wyłącza się w NODE_ENV=test" z (a)-(d) wyżej — to strukturalnie ten sam efekt (fałszywa zieleń), tylko bez przełącznika środowiskowego: zawsze musisz osobno dowieść stanu bazy PRZED wywołaniem endpointu, nie tylko sprawdzić kształt odpowiedzi**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day218-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day218-admin-polityki-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (tabela llm_org_policies + rozróżnienie awaria/pustka) i R2+R3 (kontrakt pól governanceSummary/contextPolicy) — bez nich ekran nadal kłamie na 2 z 3 kafelków nawet po naprawie tabeli. R4 (zrzuty) jest dowodem, nie rdzeniem, ale bez niego pozycja nie jest odbieralna wg CLAUDE.md reguły 7`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6161` albo `5110 i 5111` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6161` albo `5110 i 5111`** (`Z7`).

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

Pomiar modułów z 31.08 wieczorem (`docs/program/funkcje/POMIAR_MODULOW_2026-08-31_WIECZOR.md:23-42`,
tip `9850d2bcd8`) i pakiet werdyktowy Admina (`docs/program/funkcje/PAKIET_WERDYKT_ADMIN.md:19-20,44-51`,
tip `c50847c25974d9a38783ab02362c8078716dab53`) zgodnie nazywają to **najpoważniejszym
znaleziskiem** posiedzenia D-17: ekran „AI Policy" w module 14 Admin renderuje się
poprawnie i po polsku, ale pokazuje dane, których nie ma — „Poziom zarządzania: Nieznany",
„Postawa modelu: 0", „Kontrole kontekstu: n/d". Oba dokumenty przypisują to jednej
przyczynie: `server/src/routes/adminP32.routes.ts:1513-1521` odpytuje tabelę
`llm_org_policies`, której żadna migracja nie tworzy.

★★ **Pomiar wykonany na MARKERZE `9fb7942a01` obala połowę tej diagnozy — zweryfikuj sam,
to jest rozkaz pomiarowy, nie prawda objawiona.** Ekran ma TRZY niezależne źródła danych,
nie jedno, i tylko JEDNO z nich faktycznie zależy od `llm_org_policies`:

| Kafelek na ekranie | Pole we froncie | Realne źródło backendu | Zgodność kształtu |
|---|---|---|---|
| „Poziom zarządzania" / „Postawa modelu" | `governanceSummary.policyLevel`, `.modelCount`, `.budgetStatus` (`AdminAIControlCenterPanel.tsx:11-15,77-99`) | `AIPolicyEngine.getPolicySummary()` zwraca `{currentLevel, description, capabilities, internetEnabled, auditRequired}` (`aiPolicyEngine.ts:48-59,374-395`) | **BRAK — pola nie istnieją w ogóle w typie `PolicySummary`** |
| „Kontrole kontekstu" | `contextPolicy.defaultSensitivity`, `.allowExternalContext` (`:17,113-122`) | `getOrgContextPolicy()` zwraca `{categories, piiRedaction, retention}` (`contextGovernance.ts:25-28,45-68`) | **BRAK — pola nie istnieją w typie `OrgContextPolicy`** |
| „Stan przeglądu" | `llmPolicy.review_state` (`:18,84-87`) | `SELECT … FROM llm_org_policies …` (`adminP32.routes.ts:1512-1520`) | Tabela genialnie brakuje — **to jest jedyny kafelek, który faktycznie diagnozuje `POMIAR`/`PAKIET`** |

Innymi słowy: **dwa z trzech pustych kafelków nie mają nic wspólnego z brakującą tabelą.**
`governanceSummary` i `contextPolicy` przychodzą z serwisów, których tabele **istnieją**
(`ai_policies`, `organization_ai_settings` — obie tworzone w
`server/migrations/000_zz_core_baseline_producers_fresh_db_gap.sql` i
`900_prod_missing_tables_hotfix.sql`) i które **zwracają realne dane** — front czyta je pod
**złymi nazwami pól**. Gdyby ten dyżur naprawił WYŁĄCZNIE `llm_org_policies` (zakres, z jakim
został zamówiony), ekran nadal pokazywałby „Nieznany" i „0" na dwóch z trzech kafelków. To
jest powód, dla którego pozycje `R2` i `R3` niżej wchodzą do tego dyżuru, mimo że nie ma o nich
mowy w zamówieniu — **obalenie tezy zamówienia jest tu sukcesem, nie odstępstwem** (§0.8 tej
instrukcji).

Trzecia warstwa problemu, wspólna dla wszystkich trzech kafelków: **nawet po naprawie
brakującej tabeli, awaria zapytania i „zero wierszy" nadal zwracają IDENTYCZNĄ wartość
(`null`) do wywołującego.** `readAiSummary` (`adminP32.routes.ts:1485-1524`) łapie błąd
i ustawia `null` — dokładnie to samo, co dostałby przy pustym, ale poprawnym wyniku. To jest
ósma nazwana klasa kłamstwa z `POMIAR_MODULOW_2026-08-31_WIECZOR.md:36-37`: **awaria zamieniona
w pustą wartość, pokazana jako stan faktyczny.** Naprawa tabeli usuwa JEDNĄ okazję do tej
awarii (`relation does not exist`), ale nie usuwa KLASY błędu — każda przyszła awaria bazy
(timeout, utrata połączenia, literówka w kolejnej migracji) nadal wyląduje jako to samo „n/d".
`R1c` niżej wymaga zamknięcia całej klasy, nie jednego wystąpienia.

## ★ Pomiar dodatkowy: serwer i tak wie, że coś jest nie tak — tylko nie mówi o tym API

`server/src/utils/DbPromise.ts` ma DWIE funkcje o różnym zachowaniu logowania, obie używane
w `adminP32.routes.ts`:

- `all()` (`DbPromise.ts:202-306`) od NAPRAWY 2 (`:175-190`, `staging-fixes-20260826,
  TRI-MUST-05`) **selektywnie wycisza** log tylko dla `relation "..." does not exist` /
  `no such table` / `Database not initialized` (`isSilenceableMissingRelationError`,
  `:191-197`) — błąd „column does not exist" loguje zawsze głośno. **Ale w OBU przypadkach,
  przy `fallback:true` (domyślne), funkcja i tak zwraca `[]` do wywołującego** — logowanie
  i wartość zwracana to dwie osobne decyzje.
- `get()` (`:326-427`) **nie ma** selektywnego wyciszania w ogóle — loguje `dbLogger.warn` +
  `logger.error` na KAŻDYM błędzie, ale **też zawsze zwraca `null` przy `fallback:true`**
  (domyślne, i to jest dokładnie to, czego używa `llmPolicy = await dbGet(…, { fallback: true
  })`, `adminP32.routes.ts:1512-1520`).

**Wniosek pomiarowy:** błąd `relation "llm_org_policies" does not exist` **jest dziś widoczny
w logu serwera** (bo to `dbGet`, nie `dbAll`) — ale ginie między logiem a odpowiedzią HTTP.
Naprawa tego dyżuru **nie wymyśla nowego mechanizmu logowania** — przenosi rozróżnienie,
które serwer już ma w logu, do odpowiedzi API i do ekranu.

# 2. TEZY ZLECENIA

Rozkazy pomiarowe. Numery linii z SHA na `github-backup/codex/m03-admin-20260824`, marker
`9fb7942a01`. Jeśli u Ciebie inne — wiążący jest plik (`Z24`), rozbieżność do raportu.

- **T1.** `server/src/routes/adminP32.routes.ts:1511-1521` — zapytanie `SELECT mode,
  review_state, internet_enabled, audit_required, updated_at FROM llm_org_policies WHERE
  organization_id = ? …` w funkcji `readAiSummary`. **Policz sam:**
  `grep -rl llm_org_policies server/migrations/` → zero trafień (żadna migracja nie tworzy
  tej tabeli).
- **T2.** `router.get('/ai/summary', …)` (`adminP32.routes.ts:2559-2567`) montowany jako
  `GET /api/admin/ai/summary` przez `app.use('/api/admin', adminP32Routes)`
  (`server/src/Gateway.ts:639`); front woła go z `Api.getAdminAISummary()`
  (`src/services/api.ts:10145-10148`), konsument: `AdminAIControlCenterPanel.tsx:58-64`,
  zamontowany w `AdminSettingsModule.tsx:473` (linia importu `:8`) — to jest realna,
  osiągalna ścieżka produkcyjna, nie martwy kod.
- **T3.** ★★ `AIPolicyEngine.getPolicySummary()` (`server/src/services/aiPolicyEngine.ts:374-395`)
  zwraca **`{currentLevel, description, capabilities, internetEnabled, auditRequired}`**.
  Typ `PolicySummary` (`:48-59`) **nie ma** pól `policyLevel`, `modelCount` ani
  `budgetStatus`. Front czyta właśnie te trzy nieistniejące pola
  (`AdminAIControlCenterPanel.tsx:11-15, 80-81, 98`). **To jest niezależna przyczyna
  „Nieznany"/„0", nie objaw brakującej tabeli `llm_org_policies`.**
- **T4.** ★★ `getOrgContextPolicy()` (`server/src/services/ai/contextGovernance.ts:45-68`)
  zwraca **`{categories, piiRedaction, retention}`** (typ `OrgContextPolicy`, `:25-28`).
  Front czyta `contextPolicy.defaultSensitivity` i `.allowExternalContext`
  (`AdminAIControlCenterPanel.tsx:17, 113-122`) — **pól tych nie ma w typie w ogóle.**
  Niezależna trzecia przyczyna.
- **T5.** Tabele, na których `getPolicySummary`/`getOrgContextPolicy` się opierają
  (`ai_policies`, `organization_ai_settings`) **istnieją** — `grep -rln "CREATE TABLE.*ai_policies\b"
  server/migrations/` i `grep -rln "CREATE TABLE.*organization_ai_settings"
  server/migrations/` dają trafienia w `000_initdb_core_tables.sql`,
  `000_zz_core_baseline_producers_fresh_db_gap.sql`, `900_prod_missing_tables_hotfix.sql`.
  **Policz sam, czy na realnym Postgresie po pełnych migracjach obie istnieją** — to
  rozstrzyga, czy `T3`/`T4` są naprawialne bez migracji, czy potrzebują jej też.
- **T6.** `dbGet` używany dla `llmPolicy` (`server/src/utils/DbPromise.ts:326-427`, funkcja
  `get`) **nie ma** selektywnego wyciszania logu (`isSilenceableMissingRelationError` istnieje
  wyłącznie w `all()`, `:191-197`) — **loguje głośno na każdym błędzie**, ale **przy
  `{fallback:true}` (domyślne) zawsze zwraca `null`**, nieodróżnialnie od „zero wierszy,
  zapytanie ok". Serwer **widzi** różnicę w logu; odpowiedź HTTP **nie niesie** jej dalej.
- **T7.** `readAiSummary` (`:1485-1524`) ma **trzy niezależne bloki `try/catch`** —
  `governancePolicy`/`governanceSummary` (`:1491-1502`), `contextPolicy` (`:1504-1509`),
  `llmPolicy` (`:1511-1522`) — każdy zeruje swoje pole na `null` bez zapisania FAKTU, że
  wystąpił błąd. Napraw wszystkie trzy jednym spójnym wzorcem, nie tylko trzeci.
- **T8.** Zrzuty day111b (`PAKIET_WERDYKT_ADMIN.md:37,46`) pokazują ten ekran pod ścieżką
  `/private/tmp/cx-day111-admin-artefakty/ai-policy-{light,dark}-{empty-attempt,full}.png` —
  **nie ma dziś dev-render harnessu dla `AdminAIControlCenterPanel`/`AdminSettingsModule`**:
  `grep -rl "AdminSettingsModule\|AdminAIControlCenterPanel" dev-render/screens/` → zero.
  Zrzuty day111b powstały więc przez pełny runtime, nie harness — **policz to sam i zdecyduj**,
  czy budujesz nowy dev-render story (wzorzec: `dev-render/screens/admin-command-center-panel.tsx`,
  narrow fetch-stub + `MemoryRouter`) czy używasz `§0.2b(4)`.

# 3. POZYCJE DYŻURU

## R1 — tabela `llm_org_policies` (addytywna) + rozróżnienie awaria/pustka na WSZYSTKICH
## trzech ścieżkach `readAiSummary`

**Cel:** po tej pozycji żaden z trzech `try/catch` w `readAiSummary` nie zamienia awarii
zapytania w tę samą wartość, co „zapytanie wykonało się i zwróciło zero wierszy".

### R1a — migracja

Nowy plik `server/migrations/20260932_admin_llm_org_policies_table.sql`, **czysto
addytywny** (`CREATE TABLE IF NOT EXISTS`), kolumny DOKŁADNIE takie, jakich oczekuje
zapytanie w `:1512-1518` (`mode`, `review_state`, `internet_enabled`, `audit_required`,
`updated_at`) plus `id`, `organization_id`, `created_at`:

```sql
CREATE TABLE IF NOT EXISTS llm_org_policies (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    mode TEXT,
    review_state TEXT,
    internet_enabled INTEGER DEFAULT 0,
    audit_required INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_llm_org_policies_org_updated
    ON llm_org_policies(organization_id, updated_at DESC);
```

Weryfikuj: nazewnictwo kolumn dopasuj do `SELECT` w `:1512-1518` — jeśli Twój pomiar linii
się przesunął, zapytanie jest wiążące (`Z24`), nie ten wzorzec.

★ **Pułapka migracji (zmierzona na tym samym module w dyżurach 218/219 przez nadzorcę):**
migracje wykonują się alfabetycznie w obrębie fazy (`server/scripts/migrate.postgres.ts:198-238`,
sekcja „Deterministic execution-order contract"), a plik z prefiksem `000_initdb_` jest
**automatycznie wykluczony z Postgresa** (`isSqliteOnlyMigration`, `:266`:
`if (f.startsWith('000_initdb_')) return true;`) — nie licz numeracji na oko, **zmierz na
realnym, świeżym kontenerze** (`§0.4` niżej), inaczej Twoja migracja może wylądować w fazie,
w której tabela referencyjna (`organizations`) jeszcze nie istnieje.

### R1b — jeden wzorzec „awaria ≠ pustka" na trzech blokach `readAiSummary`

Nie owijaj `llmPolicy = await dbGet(...)` w kolejny gołe `try { } catch { llmPolicy = null;
}`. Zamiast tego każdy z trzech bloków ma zwracać **parę** (wartość, status), np.:

```ts
type Fetched<T> = { value: T | null; status: 'ok' | 'unavailable' };
```

- `llmPolicy`: `status: 'unavailable'` wyłącznie gdy zapytanie **rzuciło** (błąd sterownika —
  wywołaj bez `{fallback:true}` albo złap wyjątek przed nim, żeby nie stracić rozróżnienia
  `T6`); `status: 'ok', value: null` gdy zapytanie wykonało się i zwróciło **zero wierszy**
  (organizacja naprawdę nie ma jeszcze polityki — to jest UCZCIWY stan pusty, **Z16
  zabrania go „naprawiać"**).
- `governanceSummary`/`governancePolicy`: analogicznie — `AIPolicyEngine.getEffectivePolicy`
  ma WEWNĘTRZNY `safeDbGet` (`aiPolicyEngine.ts:137-145`), który **już** zamienia błędy
  schematu na wartości domyślne z logiem `logger.warn` — sprawdź, czy to Ci wystarcza jako
  „ok" (bo `EffectivePolicy` zawsze ma jakąś wartość) czy potrzebujesz osobnego statusu na
  poziomie `readAiSummary` dla przypadku, gdy `getEffectivePolicy`/`getPolicySummary` **rzuci
  w całości** (np. `AppError` z `:150-157`, gdy brakuje `AIRoleGuard`/`RegulatoryModeGuard`).
- `contextPolicy`: `getOrgContextPolicy` (`contextGovernance.ts:45-68`) **też już** ma
  wewnętrzny `try/catch` zwracający `DEFAULT_POLICY` na błędach innych niż `SyntaxError`
  (`:61-68`) — ten sam wybór do podjęcia jak wyżej.

Odpowiedź `GET /api/admin/ai/summary` niesie te statusy do frontu (rozszerz kształt
`summary`, addytywnie — nie usuwaj istniejących pól, konsumenci poza tym ekranem mogą już
czytać stare kształty, sprawdź `grep -rn "summary.governancePolicy\|summary.llmPolicy"
src/`).

### R1c — front: „Niedostępne" ≠ „Nieznany"/„n/d"/„0"

`AdminAIControlCenterPanel.tsx` dostaje nowe statusy i renderuje **trzeci, odróżnialny**
stan dla `status === 'unavailable'` — osobny od istniejących kluczy i18n `unknown`
(„Nieznany") i `notAvailable` („n/d"), bo te dwa już dziś oznaczają „skonfigurowane na
pusto", nie „nie dało się sprawdzić". Nowe klucze w OBU plikach lokalizacji w TYM SAMYM
commicie (licencja `B.1`):

```json
"admin.aiControlCenter.panel.unavailable": "Niedostępne (błąd sprawdzania)"
```
```json
"admin.aiControlCenter.panel.unavailable": "Unavailable (check failed)"
```

Dokładne miejsce w UI (który kafelek, jaki styl) — Twoja decyzja, ale musi być **wzrokiem
odróżnialne** od „Nieznany"/„0"/„n/d" na zrzucie (nie tylko w DOM-ie/i18n-key).

**Ukończone, gdy:** migracja istnieje i jest addytywna; wszystkie trzy bloki
`readAiSummary` rozróżniają błąd od pustego wyniku; front pokazuje trzeci, wizualnie
odróżnialny stan; **dowód mutacyjny** poniżej (`R1d`) jest zielony/czerwony w obu kierunkach.

### R1d — dowód (Z29, Z32)

1. **Migracja + idempotencja** — pełny łańcuch od pustej bazy, `§0.4a`(A), dwa przebiegi.
2. **Kontrakt pól** — test jednostkowy asercjonujący, że `PolicySummary`/`OrgContextPolicy`
   TYPY **nie mają** pól, które front kiedyś czytał pod starą nazwą (żeby przyszła zmiana typu
   złamała kompilację frontu, nie ciche „undefined"); i test integracyjny na realnym
   Postgresie: zapisz `ai_policies`/`organization_ai_settings` z realną wartością, wywołaj
   `GET /api/admin/ai/summary` przez `ApiGateway.getInstance().initializeRoutes(app)` (`Z22`),
   asercjonuj że **realna** wartość (nie „Nieznany"/„0"/„n/d") trafia do odpowiedzi.
3. **Mutacja dla `R1b`/`R1c` (dowód właściwy):** w kontenerze dyżuru **usuń** tabelę
   `llm_org_policies` (`DROP TABLE llm_org_policies;` przez `docker exec … psql`) PO
   migracjach — odtwarzasz dokładny scenariusz `T1`. Test asercjonuje `status === 'unavailable'`
   dla `llmPolicy`, **nie** `null` bez statusu. Cofnięcie (`cp` przywraca kod, nowy kontener
   przywraca tabelę) → test zielony ponownie. Zapisz oba wyniki w raporcie.
4. **Para dowodowa dla pustego stanu:** organizacja bez żadnego wiersza w `llm_org_policies`
   (tabela ISTNIEJE, zero wierszy) → `status === 'ok', value === null` — **to jest wynik
   POPRAWNY**, test na to też musi istnieć, żeby ktoś kiedyś nie „naprawił" uczciwej pustki
   (`Z16`).

## R2 — kontrakt `governanceSummary`: dopasuj front do realnych pól `AIPolicyEngine`

**Cel:** „Poziom zarządzania" i „Postawa modelu" pokazują dane, które **istnieją** w
`AIPolicyEngine.getPolicySummary()`, pod właściwymi nazwami — zero fabrykowania nowych
metryk backendu w tym dyżurze (`Z10`: brak nowych funkcji).

### R2a — mapowanie 1:1, jawnie w tabeli

| Kafelek dziś czyta | Istnieje w `PolicySummary`? | Co realnie wstawić |
|---|---|---|
| `governanceSummary.policyLevel` | NIE (jest `currentLevel`) | `currentLevel` |
| `governanceSummary.modelCount` | **NIE — koncept nie istnieje w ogóle** | brak realnego odpowiednika — patrz `R2b` |
| `governanceSummary.budgetStatus` | **NIE — koncept nie istnieje w ogóle** | brak realnego odpowiednika — patrz `R2b` |

### R2b — dla pól bez realnego odpowiednika: NIE fabrykuj, oznacz uczciwie

`modelCount` i `budgetStatus` nie mają dziś ŻADNEGO backendu — ani w `AIPolicyEngine`, ani
gdzie indziej w `readAiSummary`. Ten dyżur **nie buduje** licznika modeli ani statusu budżetu
od zera (poza zakresem, `Z17`). Dwie legalne drogi, wybierasz i uzasadniasz w raporcie:

- **(a)** zastąp kafelek „Postawa modelu" czymś, co realnie istnieje w `PolicySummary`
  (np. `capabilities.canExecuteActions`/`internetEnabled`/`auditRequired`) — inna treść
  kafelka, ale prawdziwa;
- **(b)** zostaw kafelek, ale renderuj go jako `notAvailable`/`unavailable` (jeśli uznasz,
  że to raczej „nie wiadomo" niż „błąd") z jawnym komentarzem w kodzie, że koncept nie ma
  dziś backendu.

**Zakaz:** wpisania stałej `0`, wpisania fałszywego `modelCount: 1` czy podobnego —
to byłoby dokładnie ta sama klasa kłamstwa, którą ten dyżur ma zamknąć.

**Ukończone, gdy:** `policyLevel`→`currentLevel` zamienione; `modelCount`/`budgetStatus`
albo zastąpione realnym polem, albo jawnie oznaczone jako niedostępne — nigdy fabrykowane;
test na realnym Postgresie dowodzi, że zmiana `policyLevel` w bazie zmienia widoczną wartość
kafelka (nie tylko że kafelek się renderuje).

## R3 — kontrakt `contextPolicy`: to samo dla „Kontrole kontekstu"

**Cel:** analogiczny do `R2`, dla trzeciego kafelka.

| Kafelek dziś czyta | Istnieje w `OrgContextPolicy`? | Co realnie wstawić |
|---|---|---|
| `contextPolicy.defaultSensitivity` | NIE | najbliższy realny odpowiednik: `piiRedaction` (`'inherit'\|'off'\|'on'`) |
| `contextPolicy.allowExternalContext` | NIE wprost | wyprowadź z `categories` (np. `ORG_DOCUMENTS`/`ORG_FINANCIAL_SUMMARY` — **zmierz, który klucz realnie odpowiada „kontekst zewnętrzny" w tym module**, nie zgaduj) |

Ten sam zakaz fabrykowania jak w `R2b`. Jeśli żaden klucz `categories` nie odpowiada
sensownie „kontekst zewnętrzny" — kafelek dostaje `unavailable`, z uzasadnieniem w
raporcie, **nie** wymyślony boolean.

**Ukończone, gdy:** kafelek czyta pole, które faktycznie istnieje w `OrgContextPolicy`;
zmiana `piiRedaction` w bazie zmienia widoczną wartość (dowód mutacyjny); żadne pole nie
jest fabrykowane.

## R4 — dowód wzrokiem (CLAUDE.md reguła 7 — Piotr nie jest pierwszym testerem)

Nie ma dziś dev-render harnessu dla tego ekranu (`T8`). Zbuduj
`dev-render/screens/admin-ai-control-center-panel.tsx` wzorem
`dev-render/screens/admin-command-center-panel.tsx` (nagłówek pliku tamtego wzorca opisuje
dokładnie ten patent: `MemoryRouter`, wąski stub `window.fetch` kluczowany podciągiem URL,
NIE catch-all na `/api/*`) + wpis w `dev-render/main.tsx`. Trzy stany do sfotografowania,
jasny i ciemny motyw (6 zrzutów):

1. **pełne dane** — `governanceSummary.currentLevel`, `piiRedaction` i `llmPolicy` z realną
   wartością (organizacja z wierszem w `llm_org_policies`);
2. **uczciwa pustka** — organizacja bez wiersza w `llm_org_policies`, ale z `ai_policies`
   ustawionym (pokazuje różnicę między „nieskonfigurowane" a „nieznane");
3. **niedostępne** — stub `fetch` zwraca `500`/rzuca, pokazuje nowy stan `unavailable` z `R1c`.

To NIE jest nowy ekran w rozumieniu `Z11` (istniejący ekran, istniejąca trasa, poprawka
treści) — nie wymaga nowej flagi `default OFF`, ale **wymaga** zrzutów przed jakimkolwiek
odbiorem właściciela, `mean_luma` jasny/ciemny > 150 różnicy.

**Ukończone, gdy:** 6 zrzutów istnieją pod `/private/tmp/cx-day218-admin-polityki-artefakty/`,
`shasum -a 256` w raporcie, opis który zrzut to który stan.

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis | `server/migrations/20260932_admin_llm_org_policies_table.sql` (**NOWY**) — jedyny plik migracji tego dyżuru, wyłącznie w przedziale `20260932`–`20260934` |
| Zapis | `server/src/routes/adminP32.routes.ts` — WYŁĄCZNIE funkcja `readAiSummary` (`:1485-1524`) i handler `GET /ai/summary` (`:2559-2567`); zakaz zmian w innych funkcjach tego pliku (2900+ linii, wspólny z dyżurem 219 — sprawdź rozłączność przed pierwszym commitem) |
| Zapis | `server/src/services/aiPolicyEngine.ts` — WYŁĄCZNIE jeśli `R1b` wymaga dodania statusu wokół `getEffectivePolicy`/`getPolicySummary`; **zakaz zmiany semantyki `POLICY_HIERARCHY`, `safeDbGet`, logiki `Regulatory Mode`** |
| Zapis | `server/src/services/ai/contextGovernance.ts` — WYŁĄCZNIE jeśli `R1b`/`R3` wymaga dodania statusu wokół `getOrgContextPolicy`; **zakaz zmiany `DEFAULT_POLICY`, `updateOrgContextPolicy`** |
| Zapis | `src/components/Admin/AdminAIControlCenterPanel.tsx` — pełna licencja w zakresie trzech kafelków (`R1c`, `R2`, `R3`); **zakaz zmian w `activeTab`/routing do `OrgAISettingsView`/`AIModule`** |
| Zapis | `src/services/api.ts` — WYŁĄCZNIE typ zwracany `getAdminAISummary` (jeśli TS tego wymaga), zero zmiany URL/metody |
| Zapis | `public/locales/pl/translation.json`, `public/locales/en/translation.json` — WYŁĄCZNIE dopisywanie kluczy pod `admin.aiControlCenter.panel.*`, parytet w tym samym commicie |
| Zapis | NOWY `dev-render/screens/admin-ai-control-center-panel.tsx` + wpis w `dev-render/main.tsx` |
| Zapis | NOWE pliki testowe `day218.*` w `server/src/routes/__tests__/`, `server/src/services/__tests__/`, `tests/integration/`, `tests/components/Admin/` — pełna licencja, `Z18`/`Z31`. Rozszerzanie ISTNIEJĄCEGO `server/src/routes/__tests__/adminP32.routes.test.ts` też dozwolone (nie jest chroniony `Z18` — to test per-route, nie globalna infrastruktura) |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY218_ADMIN_POLITYKI_REPORT.md` |
| Zapis (ograniczony) | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/14_ADMIN/MODULE_ACCEPTANCE.md` — WYŁĄCZNIE nowy wpis `PARTIAL_PROGRESS`/`FIXED` dla wiersza AI Policy, bez zmiany głównej bramki `TECHNICAL_BROWSER_PARTIAL/…` (`Z32`: dowód mutacyjny obowiązuje przed każdym `FIXED`) |
| Odczyt (ZAKAZ ZAPISU) | `server/src/utils/DbPromise.ts` — czytasz `isSilenceableMissingRelationError`/`all()`/`get()` jako wzorzec (`T6`), **nie zmieniasz** — plik globalny, dotyka setek wywołań w całym repo, zmiana tu nie jest w zakresie jednego ekranu |
| Odczyt (ZAKAZ ZAPISU) | `server/src/routes/adminP32.routes.ts` — WSZYSTKO poza `readAiSummary`/`GET /ai/summary`, w szczególności funkcje billingu i SCIM (**teren dyżuru 219**, biegnie równolegle w tych samych liniach pliku — sprawdź `git log`/gałąź równoległą przed pierwszym commitem, zgłoś kolizję zasobową ZANIM zaczniesz pisać) |
| Odczyt | `docs/program/funkcje/POMIAR_MODULOW_2026-08-31_WIECZOR.md` · `docs/program/funkcje/PAKIET_WERDYKT_ADMIN.md` · `docs/program/waves/WAVE_03_ACCEPTANCE/modules/14_ADMIN/MODULE_ACCEPTANCE.md` (poza wpisem z `§4`) |
| Odczyt | `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` (`Z14`) |

**Nietykalne imiennie:** `DbPromise.ts` (poza odczytem) · wszystko poza `readAiSummary`/`GET
/ai/summary` w `adminP32.routes.ts` · `AIRoleGuard`/`RegulatoryModeGuard` (czytane
tranzytywnie przez `getEffectivePolicy`, nie dotykasz) · każdy `MODULE_ACCEPTANCE.md` poza
wpisem `§4` · `ADM-OWN-001` i cała architektura menu (osobna, większa decyzja właściciela —
**nie ruszasz**).

**Rozłączność z partią równoległą (dyżur 219 — TEN SAM PLIK, TEN SAM DZIEŃ):** oba dyżury
wchodzą w `server/src/routes/adminP32.routes.ts`. Ten dyżur: WYŁĄCZNIE linie `1485-1524` i
`2559-2567`. Dyżur 219: WYŁĄCZNIE funkcje billingu (`readBillingInvoices`, ok. `:1587-1598`)
i SCIM (`readScimSummary`, ok. `:2021-2114`). **Przed pierwszym commitem sprawdź realny stan
pliku na `github-backup/codex/m03-admin-20260824`** — numery linii w tej instrukcji są z
markera `9fb7942a01`, dyżur równoległy mógł już przesunąć resztę pliku.

# 5. TWARDE ZASADY

- ★★ **Zasada programu, nienaruszalna:** zabezpieczenie bez testu, który czerwienieje po
  jego usunięciu, jest nieudowodnione. Mutacja w `R1d.3` musi celować w **zabezpieczenie**
  (rozróżnienie status `unavailable`/`ok`), nie w sam mechanizm zapisu do bazy.
- ★★ **Para dowodowa wszędzie, gdzie chodzi o widoczność danych:** dla KAŻDEGO z trzech
  kafelków pokaż zarówno „dane realne widoczne" (organizacja z wypełnioną tabelą), jak i
  „stan pusty poprawnie odróżniony od awarii" — samo pierwsze nie wystarcza.
- ★★ **Zakaz fabrykowania metryk bez backendu** (`R2b`, `R3`) — `modelCount`, `budgetStatus`,
  `defaultSensitivity`, `allowExternalContext` albo dostają realny odpowiednik z pomiaru,
  albo jawny stan „niedostępne". Wymyślona liczba jest gorsza niż `0`, bo wygląda na
  wiarygodną.
- ★★ **Migracja WYŁĄCZNIE addytywna**, w przedziale `20260932`–`20260934`, zweryfikowanym na
  świeżym kontenerze **po** pełnym łańcuchu (pułapka `000_initdb_`/faz migracji, `T1`/`R1a`).
  Dowód: pełny łańcuch od pustej bazy + drugi przebieg idempotentny (`§0.4a` policzone).
- ★★ **`Z16` obowiązuje wprost w tym dyżurze:** organizacja bez żadnej skonfigurowanej
  polityki AI ma nadal pokazywać uczciwą pustkę (`ok`/`null`, nie `unavailable`) — to NIE
  jest błąd do naprawienia, to jest poprawny stan produktu. Test na to jest obowiązkowy,
  żeby nikt tego pusstanu nie „naprawił" w przyszłości.
- ★ **Rozłączność `adminP32.routes.ts` z dyżurem 219** — patrz `§4` wyżej, sprawdź PRZED
  pierwszym commitem.
- ★ Pułapka: `all()` i `get()` w `DbPromise.ts` mają RÓŻNE zasady logowania (`T6`) — nie
  zakładaj symetrii, zmierz każdą osobno, jeśli Twoja naprawa dotyka obu.
- ★ Zrzuty: `mean_luma` jasny/ciemny > 150 różnicy, bez wyjątku (`R4`).
- ★ **`Z13`:** logi, zrzuty, wyjścia bramek nie wchodzą do repo — leżą w
  `/private/tmp/cx-day218-admin-polityki-artefakty`, raport podaje ścieżki i `shasum -a 256`.
- Pułapka: bez `RUN_DB_TESTS=1` testy backendowe idą na MOCK DB. Pułapka: `No test files
  found` **nie jest** `PASS`. Pułapka: liczby i nazwy testów czytasz z JSON-a (`Z37`), nigdy
  z kodu wyjścia. Pułapka: `DB_TYPE` bywa przybity w configu — zmierz, co realnie widzi
  proces.
- ★ Port **5000 zajęty na stałe** (macOS Control Center), **5037** (`adb`), **5060-5061**
  (SIP). Porty **6163-6175** i **5114-5139** zarezerwowane dla dyżurów 220-232 — nie bierz
  ich, nawet jeśli wyglądają na wolne dziś.
- ★★ **Sekcja „TWIERDZENIA NIEZWERYFIKOWANE" w raporcie jest OBOWIĄZKOWA.** Wypisz wprost co
  najmniej: czy potwierdziłeś pomiarem, że `governanceSummary`/`contextPolicy` NIE zależą od
  `llm_org_policies` (`T3`/`T4`), czy przyjąłeś to z instrukcji; czy `ai_policies` i
  `organization_ai_settings` istnieją na Twoim świeżym kontenerze (`T5`) — zmierzone czy
  założone; czy mutacja `R1d.3` (usunięcie tabeli PO migracjach) faktycznie odróżnia
  `unavailable` od `ok`; czy `R2b`/`R3` skończyły się realnym polem czy jawnym
  „niedostępne" — dla każdego z dwóch pól osobno; czy 6 zrzutów pochodzi z realnego
  `fetch` przez dev-render stub czy z gołych propsów; czy sprawdziłeś kolizję zasobową z
  dyżurem 219 w `adminP32.routes.ts` PRZED pierwszym commitem. **Brak tej sekcji jest
  podstawą odrzucenia dyżuru.**
