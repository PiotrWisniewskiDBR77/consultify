# INSTRUKCJA DYŻURU nr 219 — Codex — „niezgodności schematu w Rozliczeniach i Bezpieczeństwie + angielski w nawigacji"

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
> **wyłącznie** `/private/tmp/cx-day219-admin-schematy`.

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
Zakres: **14 Admin — Billing (`readBillingInvoices`), Security/SCIM (`readScimSummary`) w `adminP32.routes.ts`, globalna nawigacja (`useBreadcrumbs.ts`)**.
Trasy front: `/admin (zakładki Billing i Security w AdminSettingsModule; globalny breadcrumb renderowany przez AppRoutes.tsx dla każdej ścieżki /admin/*)`. Trasy tył: `GET /api/admin/billing/invoices, GET /api/admin/identity/scim (adminP32.routes.ts, montowane w Gateway.ts:639)`.

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
WT=/private/tmp/cx-day219-admin-schematy
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
git -C "$VAULT" worktree add "$WT" -b codex/day219-admin-schematy-20260901 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day219-admin-schematy/config.worktree"
cat "$VAULT/worktrees/cx-day219-admin-schematy/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day219-admin-schematy-scratch
mkdir -p /private/tmp/cx-day219-admin-schematy-artefakty

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
git -C "$WT" push github-backup codex/day219-admin-schematy-20260901
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 9fb7942a01..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `dwanaście` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.


```bash
cd /private/tmp/cx-day219-admin-schematy

# T1 — zapytanie readBillingInvoices i jego kolumny
sed -n '1587,1598p' server/src/routes/adminP32.routes.ts
#   oczekiwane: SELECT z issue_date w liscie kolumn i w ORDER BY

# T2 — trasa GET /billing/invoices zamontowana i wolana z frontu
grep -n "'/billing/invoices'" server/src/routes/adminP32.routes.ts
grep -n "getAdminBillingInvoices" src/services/api.ts src/components/Admin/AdminBillingFinOpsPanel.tsx
#   oczekiwane: handler w routes + wolacz w api.ts + konsument w panelu

# T3 — brak wlasnego try/catch wokol dbAll w readBillingInvoices
sed -n '1587,1598p' server/src/routes/adminP32.routes.ts | grep -c "try\|catch"
#   oczekiwane: 0

# T4 — front czyta due_date, nie issue_date; emptyMessage po angielsku
sed -n '579,596p' src/components/Admin/AdminBillingFinOpsPanel.tsx
#   oczekiwane: mapowanie czyta invoice.due_date; emptyMessage to string literal po angielsku

# T5 — 150_billing_phase2.sql jest wykluczony z Postgresa (numer < 500, nie zaczyna sie od 000_z_core_baseline)
grep -n "ALTER TABLE invoices" server/migrations/150_billing_phase2.sql | head -3
sed -n '260,269p' server/scripts/migrate.postgres.ts
#   oczekiwane: plik istnieje z ALTER TABLE, ale reguła isSqliteOnlyMigration go wyklucza (wersja 150 < 500)

# T6 — readScimSummary tworzy 4 tabele ad-hoc, wszystkie z organization_id w definicji
sed -n '2021,2071p' server/src/routes/adminP32.routes.ts
#   oczekiwane: 4x CREATE TABLE IF NOT EXISTS, kazda z kolumna organization_id

# T7 — 20260719_baseline_gap.sql tworzy te same 4 tabele WCZESNIEJ, dwie BEZ organization_id
grep -n 'create table if not exists "public"."scim_group_mappings"\|create table if not exists "public"."scim_sync_logs"\|create table if not exists "public"."scim_tokens"\|create table if not exists "public"."scim_conflict_log"' server/migrations/20260719_baseline_gap.sql
#   oczekiwane: 4 trafienia; zweryfikuj REALNIE ktore dwie definicje nie maja organization_id (patrz definicje kolumn w liniach nastepujacych po kazdym trafieniu)

# T9 — wzorzec hasColumn juz istnieje dla project_id
grep -n "scimMappingsHasProjectId\|hasColumn" server/src/services/scimGroupMappingService.ts server/src/utils/dbSchema.ts
#   oczekiwane: scimMappingsHasProjectId wola hasColumn(TABLE, 'project_id')

# T11 — ADMIN_SECTION_TITLES: osiem wpisow po angielsku, zero t()
sed -n '7,17p' src/hooks/useBreadcrumbs.ts
#   oczekiwane: obiekt z osmioma kluczami, wartosci to angielskie stringi literalne

# T12 — lancuch else if dla widokow Admina, tylko jedno miejsce wola t()
sed -n '274,286p' src/hooks/useBreadcrumbs.ts
grep -c "t(" <(sed -n '274,286p' src/hooks/useBreadcrumbs.ts)
#   oczekiwane: 1 (tylko ADMIN_OVERVIEW)

# T14 — useBreadcrumbs wpiety w AppRoutes i realnie renderowany
grep -n "useBreadcrumbs" src/routes/AppRoutes.tsx
#   oczekiwane: import + wywolanie w komponencie renderowanym dla kazdej trasy

# T15 — istniejaca przestrzen nazw sidebar.* w lokalizacji, do wzorowania nowych kluczy
grep -n '"adminPanel"' public/locales/pl/translation.json
#   oczekiwane: klucz sidebar.adminPanel istnieje z polska wartoscia
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day219-admin-schematy-20260901` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6162`. Twój JEDYNY port harnessu to `5112 i 5113`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day219-pg`**. **ZAKAZANE:** `6012, 5433, 6047, 6054-6160, 5010-5109, 6404-6411, 6161 (dyżur 218, równoległy), 5110-5111 (dyżur 218, równoległy); ZABRONIONE NA PRZÓD (dyżury 220-232): 6163-6175 oraz 5114-5139; NA STAŁE: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP/ERR_UNSAFE_PORT)`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak — naprawa schematu bazy i tłumaczenie istniejących etykiet, zero nowego ekranu w rozumieniu Z11, zero nowych flag funkcyjnych`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/auth.middleware.ts` (`verifyToken`) · `server/src/middleware/admin.middleware.ts` (rola ADMIN/OWNER/SUPERADMIN) · `getAdminActor` (`adminP32.routes.ts:286`, scope `billing:read`/`iam:read` — WEWNĄTRZ pliku, który edytujesz, NIE dotykasz tej funkcji) · `server/src/services/scimGroupMappingService.ts` (`hasColumn`-owy wzorzec, WYŁĄCZNIE odczyt jako wzorzec do T9/R2b)`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY219_ADMIN_SCHEMATY_REPORT.md`. Jedyny inny dokument do zmiany: `docs/program/waves/WAVE_03_ACCEPTANCE/modules/14_ADMIN/MODULE_ACCEPTANCE.md` — WYŁĄCZNIE nowy wpis dla wierszy Billing/Security/nawigacja (§6 tej instrukcji); zakaz dopisywania czegokolwiek o `ADM-OWN-001` poza cytatem status quo, bez zmiany głównej bramki modułu. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day219-admin-schematy-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day219-admin-schematy-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ Ten dyżur i dyżur 218 wchodzą W TEN SAM PLIK `server/src/routes/adminP32.routes.ts` tego samego dnia — Ty WYŁĄCZNIE w `readBillingInvoices` (ok. `:1587-1598`) i `readScimSummary` (ok. `:2021-2114`); dyżur 218 WYŁĄCZNIE w `readAiSummary`/`GET /ai/summary`. Przed pierwszym commitem sprawdź `git log`/gałąź `codex/day218-admin-polityki-20260901` pod kątem zmian w tym pliku i zgłoś kolizję ZANIM zaczniesz pisać. ★★ Migracje WYŁĄCZNIE w przedziale `20260936`–`20260939` (przedział `20260932`–`20260934` należy do dyżuru 218, TYLKO ODCZYT). ★★ ZAKAZ dotykania `ADM-OWN-001` (przebudowa architektury menu w 7 obszarach) — osobna, większa decyzja właściciela, ten dyżur WYŁĄCZNIE tłumaczy istniejące etykiety, nie zmienia struktury/liczby/kolejności sekcji menu. ★ Pułapka zmierzona DWA RAZY na tym module: statyczne czytanie migracji (`grep CREATE TABLE`) daje INNY wynik niż realny stan po pełnym łańcuchu — `000_initdb_*` i migracje <500 poza `000_z_core_baseline` są wykluczone z Postgresa (`migrate.postgres.ts:266-269`), a `20260719_baseline_gap.sql` tworzy tabele SCIM PRZED jakąkolwiek trasą aplikacji. Zawsze potwierdzaj `\d <tabela>` na świeżym kontenerze | Rozłączność plikowa z dyżurem 218: ten sam plik routingu edytowany przez dwa równoległe dyżury tego samego dnia. ADM-OWN-001 nietykalny: PAKIET_WERDYKT_ADMIN.md nazywa to „dużym, nierozstrzygniętym tematem", nie drobiazgiem — wymaga jawnej decyzji właściciela, nie cichego "przy okazji" podczas naprawy i18n. Pułapka pomiaru statycznego: nadzorca sam dwukrotnie błędnie wywnioskował strukturę tabeli z samego grepu migracji przy pisaniu tej instrukcji, zanim zweryfikował na żywym Postgresie — ten sam błąd popełniony przez wykonawcę byłby regresją metodyczną, nie tylko techniczną |

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
cd /private/tmp/cx-day219-admin-schematy

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day219-pg psql -U postgres -d cx219 \
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
cd /private/tmp/cx-day219-admin-schematy

docker run -d --name cx-day219-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx219 \
  -p 127.0.0.1:6162:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day219-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6162/cx219 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6162/cx219 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day219-admin-schematy && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6162/cx219 \
JWT_SECRET=cx219-test-secret-do-not-reuse \
npx vitest run server/src/routes/__tests__/adminP32.routes.test.ts tests/integration/adminBillingScimSchema.day219.test.ts tests/unit/frontend/useBreadcrumbs.day219.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day219-admin-schematy-artefakty/day219-admin-schematy.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day219-admin-schematy && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/routes/__tests__/adminP32.routes.test.ts tests/integration/adminBillingScimSchema.day219.test.ts tests/unit/frontend/useBreadcrumbs.day219.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day219-admin-schematy-artefakty/day219-admin-schematy.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day219-admin-schematy/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day219-pg psql -U postgres -d cx219 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day219-pg`.
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
> **(e) `readBillingInvoices` woła `dbAll(..., {fallback:true})` BEZ własnego try/catch (inaczej niż readAiSummary z dyżuru 218) — całe zachowanie na błędzie zależy od `DbPromise.ts`'s `all()`, która przy błędzie „column does not exist" loguje głośno, ale i tak zwraca `[]`. `readScimSummary` dodatkowo ma CZTERY własne `CREATE TABLE IF NOT EXISTS` na wstępie (`:2022-2071`), które są cichym no-opem, jeśli tabela już istnieje z INNĄ definicją (dokładnie to się dzieje dla scim_group_mappings/scim_sync_logs) — test, który nie usuwa/nie sprawdza REALNEJO stanu tabeli przed uruchomieniem handlera, może przejść fałszywie zielono, bo mockowana/pusta baza w teście nigdy nie odtwarza konfliktu między ad-hoc CREATE TABLE a wcześniejszą migracją. Zawsze testuj na kontenerze z PEŁNYM łańcuchem migracji, nigdy na pustej bazie, do której handler sam dopiero tworzy tabele**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day219-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day219-admin-schematy-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (kolumna issue_date) i R2 (organization_id na dwóch tabelach SCIM) — bez nich zapytania nadal padają na realnym Postgresie. R3 (i18n nawigacji) jest niezależny od R1/R2 i może być zrobiony osobno, jeśli zabraknie czasu`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6162` albo `5112 i 5113` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6162` albo `5112 i 5113`** (`Z7`).

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

`docs/program/funkcje/POMIAR_MODULOW_2026-08-31_WIECZOR.md:39-42` i
`docs/program/funkcje/PAKIET_WERDYKT_ADMIN.md:44,67-69` wymieniają, obok znaleziska AI Policy
(dyżur 218), dwie dalsze niezgodności schematu w module 14 Admin — Billing
(`invoices.issue_date`) i Security (SCIM `organization_id`) — oraz angielskie napisy w
globalnym pasku nawigacji. Żadne z tych trzech twierdzeń nie ma w źródłach numeru linii ani
nazwy tabeli poza `invoices`/`issue_date` — **ten dyżur mierzy wszystkie trzy sam, na realnym
Postgresie, nie na czytaniu kodu.**

★★ **Statyczne czytanie migracji tu KŁAMIE — nadzorca to sprawdził na własnej pomyłce.**
`server/migrations/` ma TRZY różne definicje `CREATE TABLE invoices` (`000_initdb_core_tables.sql`,
`000_zz_core_baseline_producers_fresh_db_gap.sql`, `160_configuration_enhancements.sql`) o
różnych zestawach kolumn. Alfabetyczne sortowanie plików sugerowałoby, że
`000_initdb_core_tables.sql` (najwęższa definicja, bez `invoice_number`/`due_date`/`paid_at`)
tworzy tabelę jako pierwszy. **To jest fałszywy wniosek**: `server/scripts/migrate.postgres.ts:266`
wyklucza z Postgresa każdy plik `000_initdb_*` (`isSqliteOnlyMigration`), więc realnie
tabelę tworzy `000_zz_core_baseline_producers_fresh_db_gap.sql` (ma `invoice_number`,
`due_date`, `paid_at` — te trzy kolumny ISTNIEJĄ). Zweryfikowane **na żywym kontenerze**
pełnym łańcuchem migracji: jedyna brakująca kolumna z zapytania w `adminP32.routes.ts` to
**dokładnie `issue_date`**, nic więcej. Ten sam mechanizm dotyczy SCIM niżej — **zawsze
kończ pomiar realnym `\d <tabela>` na świeżym kontenerze, nigdy samym `grep CREATE TABLE`.**

# 2. TEZY ZLECENIA — BILLING

Rozkazy pomiarowe, marker `9fb7942a01`. Rozbieżność wiąże Twój pomiar (`Z24`).

- **T1.** `readBillingInvoices` (`server/src/routes/adminP32.routes.ts:1587-1598`) wykonuje
  `SELECT id, invoice_number, status, amount_due, amount_paid, currency, issue_date, due_date,
  paid_at FROM invoices … ORDER BY issue_date DESC, created_at DESC LIMIT 50`. **Policz sam
  na świeżym Postgresie po pełnym łańcuchu migracji**, które z tych kolumn realnie istnieją —
  nie ufaj samemu `grep`. Zmierzone przez nadzorcę: WSZYSTKIE istnieją poza `issue_date`.
  Dowód: `SELECT …identyczne zapytanie…;` → `ERROR: column "issue_date" does not exist`,
  `HINT: Perhaps you meant to reference the column "invoices.due_date".`
- **T2.** Trasa `GET /billing/invoices` (`adminP32.routes.ts:2722-2730`, montowana pod
  `/api/admin`) → front `Api.getAdminBillingInvoices()` (`src/services/api.ts:10222-10225`) →
  konsument `AdminBillingFinOpsPanel.tsx:97,105,579-596`. **Osiągalna ścieżka produkcyjna.**
- **T3.** `readBillingInvoices` woła `dbAll(..., { fallback: true })` **bez własnego
  `try/catch`** — inaczej niż `readAiSummary` z dyżuru 218. Zachowanie przy błędzie zależy
  wyłącznie od `DbPromise.ts`. `all()` (`:202-306`) selektywnie wycisza log tylko dla
  „relation does not exist" (`isSilenceableMissingRelationError`, `:191-197`); błąd „column …
  does not exist" **loguje głośno** (`dbLogger.warn` + `logger.error`, `:277-282`), ale **w
  obu przypadkach zwraca `[]`** przy `fallback:true`. Front nie ma jak odróżnić „zero faktur"
  od „zapytanie padło".
- **T4.** `AdminBillingFinOpsPanel.tsx:583-590` mapuje wynik na kolumny UI i czyta
  `invoice.due_date`, **nie** `invoice.issue_date` — front nigdy nie wyświetla „daty
  wystawienia" wprost. Cały wpływ awarii na UI to **pusta lista** (linia `594`:
  `emptyMessage="No invoices yet for this workspace."` — ★ ta etykieta jest też twardo po
  angielsku, poza mapą `t()`; policz, czy to wchodzi w zakres tego dyżuru razem z `R3`
  poniżej, czy zostaje osobnym wpisem).
- **T5.** `150_billing_phase2.sql:416-427` dorzuca do `invoices` dwanaście kolumn (`template_id`
  … `auto_advance`), ale ten plik ma numer `150` (< 500) i nie zaczyna się od
  `000_z_core_baseline` → **wykluczony z Postgresa** tą samą regułą co `T1` w `§1`. Zmierz
  sam, czy którakolwiek z tych dwunastu kolumn realnie istnieje na Twoim kontenerze —
  nadzorca zmierzył, że NIE, ale to jest rozkaz pomiarowy, nie fakt do przepisania.

# 3. TEZY ZLECENIA — SECURITY / SCIM

- **T6.** `readScimSummary` (`adminP32.routes.ts:2021-2114`) na WSTĘPIE woła cztery
  `CREATE TABLE IF NOT EXISTS` (`scim_tokens` `:2022-2035`, `scim_group_mappings`
  `:2036-2048`, `scim_sync_logs` `:2049-2059`, `scim_conflict_log` `:2060-2071`) — WSZYSTKIE
  cztery zawierają kolumnę `organization_id` w swojej definicji. To read jako „samonaprawiający
  się schemat" — **ale `IF NOT EXISTS` jest no-opem, jeśli tabela już istnieje z INNĄ
  definicją.**
- **T7.** ★★ `server/migrations/20260719_baseline_gap.sql:8615-8659` tworzy te same cztery
  tabele WCZEŚNIEJ (migracja DATED, faza 1, biegnie przed odczytem żadnej trasy). Policz
  DOKŁADNIE, które z czterech definicji mają `organization_id`:
  `scim_conflict_log` (`:8615-8625`) **TAK**, `scim_group_mappings` (`:8628-8637`) **NIE**,
  `scim_sync_logs` (`:8640-8649`) **NIE**, `scim_tokens` (`:8651-8662`) **TAK**. Ponieważ ta
  migracja tworzy tabele jako pierwsza, `readScimSummary`'s własny `CREATE TABLE IF NOT
  EXISTS` dla `scim_group_mappings`/`scim_sync_logs` jest **no-opem** — realne tabele nie
  mają `organization_id`.
- **T8.** Dowód na żywym Postgresie (świeży kontener, pełny łańcuch migracji):
  `SELECT … FROM scim_group_mappings WHERE organization_id = ?` i analogiczne dla
  `scim_sync_logs` → `ERROR: column "organization_id" does not exist`. To samo zapytanie na
  `scim_tokens`/`scim_conflict_log` **działa** (kolumna istnieje). **Zakres realny: DWIE z
  czterech tabel, nie „SCIM" hurtem.**
- **T9.** Wzorzec obrony przed tym już istnieje w kodzie i jest **cudzy, tylko-do-odczytu**:
  `scimMappingsHasProjectId()` (`server/src/services/scimGroupMappingService.ts:65-71`) woła
  `hasColumn(TABLE, 'project_id')` (`server/src/utils/dbSchema.ts:129`) PRZED zapytaniem o
  `project_id` na tej samej tabeli — dokładnie ten patent, tylko dla innej kolumny. Migracja
  jest lepszym rozwiązaniem niż kopiowanie tego patentu dla `organization_id` (bo bez
  `organization_id` żadne zapytanie o tę tabelę w ogóle nie ma sensu — to nie jest opcjonalna
  kolumna), ale **rozstrzygasz i uzasadniasz w raporcie**, dlaczego migracja > obrona w kodzie
  tutaj.
- **T10.** `hasProjectDim` (`readScimSummary:2076-2085`) już dziś rozgałęzia zapytanie na
  `scim_group_mappings` w zależności od obecności `project_id` — jeśli dodajesz
  `organization_id` migracją, **nie dotykaj** tej gałęzi (`Z17` — poza zakresem tej naprawy).

# 4. TEZY ZLECENIA — i18n NAWIGACJA

- **T11.** `src/hooks/useBreadcrumbs.ts:7-17` — stała `ADMIN_SECTION_TITLES`, osiem wpisów,
  WSZYSTKIE po angielsku, ŻADEN nie woła `t()`: `overview: 'Overview'`, `ai: 'AI Governance &
  Operations'`, `audit: 'Audit, Compliance & Risk'`, plus `people`, `security`, `billing`,
  `integrations`, `operations`.
- **T12.** `useBreadcrumbs.ts:274-286` — łańcuch `else if` dla widoków Admina PODWAJA te same
  angielskie literały (nie odwołuje się do `ADMIN_SECTION_TITLES`, tylko wpisuje stringi
  osobno) — **osiem miejsc**, z czego JEDNO (`:280`, `ADMIN_OVERVIEW`) woła
  `t('assessment.overview', 'Overview')`, reszta nie. To jest już dziś DWIE listy tego samego
  („Overview" dla przeglądu Admina) w jednym pliku, częściowo przetłumaczone, częściowo nie —
  policz sam, ile faktycznie miejsc trzeba objąć.
- **T13.** Zewnętrzna otoczka „Panel Administratora" (`section = t('sidebar.adminPanel', 'Admin
  Panel')`, `:264`) **jest** przetłumaczona — tylko drugi poziom (`sub`) nie jest. To zgadza
  się z obserwacją z `PAKIET_WERDYKT_ADMIN.md:42-43`: „Panel Administratora **> Overview**".
- **T14.** Łańcuch osiągalności: `AppRoutes.tsx:915` woła `useBreadcrumbs()` i renderuje wynik
  w globalnym pasku — **realna ścieżka produkcyjna**, nie martwy kod. Znajdź dokładne miejsce
  renderu `breadcrumbs.section`/`.sub` w `AppRoutes.tsx` i podaj numer linii w raporcie
  (nie zmierzone przez nadzorcę — Twój pomiar).
- **T15.** Klucze `t()`, które MUSISZ dodać, mają już analogiczne rodzeństwo w
  `public/locales/pl/translation.json` pod `sidebar.*` (np. `sidebar.adminPanel`) — trzymaj
  się tej samej przestrzeni nazw (`sidebar.adminSection.*` albo podobnej), zamiast tworzyć
  równoległą pod `admin.*`, żeby nie było DWÓCH miejsc z tłumaczeniem tego samego pojęcia
  „Overview" (`admin.aiControlCenter.panel.unknown` już istnieje i znaczy co innego — nie
  myl z tym kluczem).

# 5. POZYCJE DYŻURU

## R1 — Billing: kolumna `issue_date`

**Cel:** `readBillingInvoices` przestaje odpytywać kolumnę, której nie ma; awaria zapytania
przestaje wyglądać identycznie jak „brak faktur".

### R1a — migracja (addytywna)

`server/migrations/20260936_admin_invoices_issue_date_column.sql`, przedział
`20260936`–`20260939`:

```sql
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS issue_date TIMESTAMP;
-- Backfill: dla istniejących wierszy "data wystawienia" nie jest znana wprost —
-- najbliższy uczciwy odpowiednik to created_at. Nie zgaduj due_date (to inny fakt
-- biznesowy — termin płatności, nie data wystawienia).
UPDATE invoices SET issue_date = created_at WHERE issue_date IS NULL;
```

Zmierz przed napisaniem: czy Postgres w tej wersji (sprawdź `pgvector/pgvector:pg16`)
obsługuje `ADD COLUMN IF NOT EXISTS` (tak, od PG9.6) — potwierdź komendą na swoim
kontenerze, nie z pamięci.

★ **Rozstrzygnięcie merytoryczne wymagane:** czy `issue_date` powinien mieć `DEFAULT
CURRENT_TIMESTAMP` dla NOWYCH wierszy (żeby przyszłe `INSERT`y bez jawnej wartości nie
tworzyły kolejnych `NULL`i)? Sprawdź `grep -rn "INSERT INTO invoices" server/src/` — czy
istnieje ścieżka tworząca faktury, i czy ta ścieżka będzie ustawiać `issue_date` jawnie. Jeśli
NIE — dodaj `DEFAULT CURRENT_TIMESTAMP`, uzasadnij w raporcie.

### R1b — zapytanie i front

Po migracji zapytanie w `:1589-1592` **działa bez zmian** — kolumna istnieje. Sprawdź mimo
to, czy front powinien zacząć wyświetlać `issue_date` (dziś czyta tylko `due_date`, `T4`) —
**to jest decyzja produktowa poza zakresem tej naprawy schematu** (`Z17`); jeśli dodajesz
kolumnę do UI, to osobna, jawnie uzasadniona podpozycja, nie milczący bonus.

### R1c — dowód „awaria ≠ pustka" (ta sama zasada co dyżur 218)

Mutacja: na kontenerze PO migracji `R1a`, wykonaj `ALTER TABLE invoices DROP COLUMN
issue_date;` ręcznie (symulacja regresji), uruchom test integracyjny wołający
`GET /api/admin/billing/invoices` przez `ApiGateway.getInstance().initializeRoutes(app)`
(`Z22`) — dziś odpowiedź to `200 {invoices: []}`, nieodróżnialne od organizacji bez faktur.
**Rozstrzygnij i zaimplementuj**, analogicznie do dyżuru 218 `R1b`/`R1c`: czy w ramach TEGO
dyżuru dokładasz ten sam wzorzec „status ok/unavailable" do `readBillingInvoices`, czy
uznajesz to za osobną pozycję poza zakresem (bo zamówienie mówi „niezgodność schematu", nie
„przebuduj obsługę błędów całego Billingu"). **Rekomendacja nadzorcy: TAK, dokładasz** — to
jest dokładnie ten sam kształt błędu, który dyżur 218 już nazwał i naprawił gdzie indziej w
tym samym pliku; zostawienie go tu byłoby niespójne w obrębie jednego modułu w jednym dniu.
Jeśli się nie zgodzisz i zmierzysz powód, żeby nie — **STOP merytoryczny z opisem**, nie po
cichu pomiń.

**Ukończone, gdy:** migracja addytywna istnieje i przechodzi dwa przebiegi idempotentnie;
`SELECT` z `:1589-1592` działa na świeżym kontenerze po migracji (dowód: identyczne
zapytanie w `psql`, zero błędu); decyzja o `DEFAULT`/backfill uzasadniona; decyzja o
`status ok/unavailable` podjęta i albo zaimplementowana, albo opisana jako STOP.

## R2 — Security: `organization_id` na `scim_group_mappings` i `scim_sync_logs`

**Cel:** obie tabele mają `organization_id`; zapytania filtrujące po niej przestają padać.

### R2a — migracja (addytywna)

`server/migrations/20260937_admin_scim_organization_id_backfill.sql` (w tym samym
przedziale `20260936`–`20260939`):

```sql
ALTER TABLE scim_group_mappings ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE scim_sync_logs ADD COLUMN IF NOT EXISTS organization_id TEXT;
CREATE INDEX IF NOT EXISTS idx_scim_group_mappings_org ON scim_group_mappings(organization_id);
CREATE INDEX IF NOT EXISTS idx_scim_sync_logs_org ON scim_sync_logs(organization_id);
```

★★ **Rozstrzygnięcie obowiązkowe: te tabele MOGĄ już mieć wiersze na bazach starszych niż
Twój świeży kontener testowy** (to jest tabela audytowa/logowa — `scim_sync_logs` z natury
rzeczy gromadzi historię). Backfill `organization_id` dla ISTNIEJĄCYCH wierszy **nie jest
możliwy z samej tabeli** (kolumna nigdy nie istniała, więc nie ma skąd wziąć wartości) —
opisz to w raporcie jako świadomy dług: stare wiersze zostają z `organization_id IS NULL`,
NOWE wiersze (po naprawie `readScimSummary`, jeśli on je zapisuje — sprawdź, czy w ogóle coś
dziś tam pisze: `grep -n "INSERT INTO scim_group_mappings\|INSERT INTO scim_sync_logs"
server/src/`) dostają wartość. Jeżeli **nic dziś tam nie pisze** — to wpisz to wprost, dług
jest czysto teoretyczny na tym markerze.

### R2b — rozstrzygnięcie `T9`: migracja, nie obrona w kodzie — ale uzasadnij

`hasColumn`-owy patent (`scimMappingsHasProjectId`) jest właściwy dla OPCJONALNYCH kolumn,
które mogą, ale nie muszą istnieć zależnie od stanu wdrożenia. `organization_id` na tabeli
tenant-scoped **nie jest opcjonalny** — brak izolacji organizacyjnej na tabeli, którą filtruje
się po `organization_id`, jest błędem bezpieczeństwa, nie tylko funkcjonalnym (bez tej kolumny
zapytanie nie może w ogóle wyrazić granicy tenantów). Migracja jest właściwym narzędziem.
Zapisz to zdanie (albo obalone przez Twój pomiar) w raporcie.

### R2c — dowód (Z29, para dowodowa `obcy nie widzi` + `właściciel widzi`)

1. **Zapytanie działa** — po migracji `SELECT … FROM scim_group_mappings WHERE
   organization_id = ?` na świeżym kontenerze zwraca `0` wierszy bez błędu (nie wyjątek).
2. **Izolacja tenantów (`obcy nie widzi`)** — wstaw wiersz `scim_group_mappings` z
   `organization_id = 'org-A'`, zapytaj jako `org-B` → zero wierszy.
3. **Właściciel widzi** — zapytaj jako `org-A` → wiersz obecny. **Samo (2) bez (3) nie jest
   dowodem** — mogłoby przechodzić przez wygaszoną funkcję.
4. **Mutacja** — cofnij migrację (`ALTER TABLE … DROP COLUMN organization_id`) na kopii
   kontenera, potwierdź że test z (1) czerwienieje z tym samym błędem `column … does not
   exist` co w `T8`. Przywróć.

**Ukończone, gdy:** obie kolumny istnieją po migracji; oba zapytania (`scim_group_mappings`,
`scim_sync_logs`) działają na świeżym kontenerze; para dowodowa izolacji zrobiona dla
przynajmniej jednej z dwóch tabel (wybierz tę, gdzie POMIAR wykazał realny odczyt, nie tylko
zapis); decyzja o backfillu i o migracji-vs-`hasColumn` opisana.

## R3 — i18n: globalna nawigacja Admina

**Cel:** drugi poziom breadcrumbu Admina (`sub`) jest po polsku, tak jak pierwszy (`section`).

### R3a — klucze

Dodaj klucze `t()` dla ośmiu wpisów `ADMIN_SECTION_TITLES` (`useBreadcrumbs.ts:7-17`) w OBU
plikach lokalizacji, w tym samym commicie (`B.1`). Przestrzeń nazw: **przeanalizuj `T15`
sam** — czy `sidebar.adminSection.*` czy inna, ale JEDNA, spójna z resztą pliku, nie
duplikująca `admin.aiControlCenter.panel.*` (inne znaczenie „Overview" w innym miejscu
ekranu).

### R3b — usuń podwójne źródło (`T12`)

Osiem literałów w `else if` (`:274-286`) ma czytać z TEJ SAMEJ mapy `t()`-owanej co `R3a`,
nie mieć własnych, osobnych stringów — dziś jest to już DWIE nieskoordynowane listy
(`ADMIN_SECTION_TITLES` i `else if`), z których jedna częściowo woła `t()` (`:280`), reszta
nie. Scal do jednego źródła prawdy.

### R3c — zakres: WYŁĄCZNIE globalna nawigacja, NIE `ADM-OWN-001`

★★ **`ADM-OWN-001`** (`PAKIET_WERDYKT_ADMIN.md:57-63`) to uwaga właściciela o przebudowie
architektury menu w siedmiu obszarach — **osobna, większa, nierozstrzygnięta decyzja**. Ten
dyżur **nie** przeprojektowuje struktury menu, **nie** zmienia które sekcje istnieją ani ich
kolejności — WYŁĄCZNIE tłumaczy istniejące angielskie etykiety na polskie, bez zmiany ich
liczby, treści czy hierarchii. Jeśli podczas pracy zobaczysz okazję do „przy okazji" poprawić
strukturę — **nie rób tego**, to jest dokładnie ten rodzaj pokusy, którą `CLAUDE.md` §5/§9
zakazuje („nic nie wchodzi bez akceptu właściciela", „zakaz masowego włączania").

**Ukończone, gdy:** wszystkie osiem etykiet Admina w globalnym breadcrumbie renderują się po
polsku w polskiej lokalizacji i po angielsku w angielskiej; test snapshot/DOM potwierdza brak
angielskich literałów w tym konkretnym pasku dla ścieżek `/admin/*`; `ADM-OWN-001` nietknięty.

### R3d — dowód (test i18n)

Test integracyjny/komponentowy: dla każdej z ośmiu wartości `pathSection`/`tabParam`/
`currentView` z `useBreadcrumbs.ts:274-286`, przy `i18n.language = 'pl'`, `sub` **nie
zawiera** żadnego z ośmiu oryginalnych angielskich literałów (`'Overview'`, `'People &
Access'`, `'Security & Identity'`, `'Billing & FinOps'`, `'AI Governance & Operations'`,
`'Integrations & Sync'`, `'Audit, Compliance & Risk'`, `'Organization Operations'`) —
asercja **na nieobecność**, nie tylko „test przechodzi". Mutacja: przywróć jeden z ośmiu
literałów na sztywno → test czerwony.

# 6. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis | `server/migrations/20260936_admin_invoices_issue_date_column.sql` (**NOWY**) |
| Zapis | `server/migrations/20260937_admin_scim_organization_id_backfill.sql` (**NOWY**) — oba wyłącznie w przedziale `20260936`–`20260939` |
| Zapis | `server/src/routes/adminP32.routes.ts` — WYŁĄCZNIE `readBillingInvoices` (ok. `:1587-1598`) i `readScimSummary` (ok. `:2021-2114`), oraz — jeśli `R1c` tego wymaga — dodanie statusu `ok/unavailable` wzorem dyżuru 218. **Zakaz zmian w `readAiSummary`/`GET /ai/summary`** — teren dyżuru 218, biegnie równolegle w tym samym pliku |
| Zapis | `src/components/Admin/AdminBillingFinOpsPanel.tsx` — WYŁĄCZNIE jeśli `R1c` wymaga rozróżnienia stanu na froncie; **zakaz zmiany innych zakładek** (`summary`, `plan`, `payments`, `controls`) |
| Zapis | `src/hooks/useBreadcrumbs.ts` — WYŁĄCZNIE `ADMIN_SECTION_TITLES` (`:7-17`) i gałąź `ADMIN VIEWS` (`:261-287`). **Zakaz zmian w innych sekcjach pliku** (STUDIO, SETTINGS, itd. — plik jest wspólny dla całej nawigacji aplikacji, nie tylko Admina) |
| Zapis | `public/locales/pl/translation.json`, `public/locales/en/translation.json` — WYŁĄCZNIE dopisywanie kluczy dla `R3a`, parytet w tym samym commicie |
| Zapis | NOWE pliki testowe `day219.*` w `server/src/routes/__tests__/`, `server/src/services/__tests__/`, `tests/integration/`, `tests/components/Admin/`, `tests/unit/` (dla `useBreadcrumbs`) — pełna licencja, `Z18`/`Z31`. Rozszerzanie `server/src/routes/__tests__/adminP32.routes.test.ts` dozwolone |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY219_ADMIN_SCHEMATY_REPORT.md` |
| Zapis (ograniczony) | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/14_ADMIN/MODULE_ACCEPTANCE.md` — WYŁĄCZNIE nowy wpis dla wierszy Billing/Security/nawigacja; **zakaz** dopisywania czegokolwiek o `ADM-OWN-001` poza cytatem status quo |
| Odczyt (ZAKAZ ZAPISU) | `server/src/routes/adminP32.routes.ts` — WSZYSTKO poza `readBillingInvoices`/`readScimSummary`, w szczególności `readAiSummary`/`GET /ai/summary` (**teren dyżuru 218**) |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/scimGroupMappingService.ts` · `server/src/utils/dbSchema.ts` — wzorzec `hasColumn`/`scimMappingsHasProjectId` do `T9`/`R2b`, nie zmieniasz |
| Odczyt (ZAKAZ ZAPISU) | `server/migrations/150_billing_phase2.sql` · `server/migrations/210_sso_scim.sql` · `server/migrations/711_sso_scim.sql` · `server/migrations/20260719_baseline_gap.sql` — dowód historyczny (`T5`, `T7`), **wyłączone z Postgresa albo tworzą inne tabele; nie edytujesz zastanych migracji nigdy** |
| Odczyt | `docs/program/funkcje/POMIAR_MODULOW_2026-08-31_WIECZOR.md` · `docs/program/funkcje/PAKIET_WERDYKT_ADMIN.md` |
| Odczyt | `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` (`Z14`) |

**Nietykalne imiennie:** wszystko poza `readBillingInvoices`/`readScimSummary` w
`adminP32.routes.ts` · każda zastana migracja (`150_billing_phase2.sql`,
`210_sso_scim.sql`, `711_sso_scim.sql`, `20260719_baseline_gap.sql` i wszystkie inne) ·
`hasColumn`/`dbSchema.ts` · struktura/kolejność/liczba sekcji menu Admina (`ADM-OWN-001`) ·
każdy `MODULE_ACCEPTANCE.md` poza jawnie licencjonowanym wpisem.

**Rozłączność z partią równoległą (dyżur 218 — TEN SAM PLIK, TEN SAM DZIEŃ):** patrz `§4`
instrukcji 218 — lustrzany zapis tutaj. **Przed pierwszym commitem sprawdź `git log`/gałąź
218 pod kątem zmian w `adminP32.routes.ts` i zgłoś kolizję ZANIM zaczniesz pisać.** Przedział
migracji tego dyżuru (`20260936`–`20260939`) jest **rozłączny** z przedziałem dyżuru 218
(`20260932`–`20260934`) — zostawiona luka `20260935`, `20260940`+ jest celowa, nie Twoja do
zajęcia.

# 7. TWARDE ZASADY

- ★★ **Zasada programu, nienaruszalna:** zabezpieczenie bez testu, który czerwienieje po
  jego usunięciu, jest nieudowodnione. Mutacje w `R1c`, `R2c.4`, `R3d` muszą celować w
  **zabezpieczenie** (kolumna istnieje / izolacja tenantów / brak angielskiego literału), nie
  w opakowujący mechanizm.
- ★★ **Para dowodowa wszędzie, gdzie chodzi o widoczność:** `R2c` wymaga zarówno „obcy nie
  widzi" (2), jak i „właściciel widzi" (3) — samo pierwsze bywa spełnione przez wygaszoną
  funkcję (zero wierszy zawsze, niezależnie od organizacji).
- ★★ **Obie migracje WYŁĄCZNIE addytywne**, w rozłącznych przedziałach `20260936`–`20260939`
  (ten dyżur) i `20260932`–`20260934` (dyżur 218, cudzy, TYLKO ODCZYT). Zweryfikowane na
  świeżym kontenerze **po pełnym łańcuchu**, nie na oko z listy plików.
- ★★ **Zawsze mierz na żywym Postgresie, nigdy samym `grep`/czytaniem SQL-a** — pułapka
  `000_initdb_*`/`isSqliteOnlyMigration` (`§1`) i pułapka `20260719_baseline_gap.sql`
  tworzącego SCIM tabele przed jakąkolwiek trasą (`T7`) obie pokazały, że statyczne czytanie
  migracji daje INNY wynik niż realny `\d <tabela>`. Ten sam błąd popełniony dwa razy w
  jednym dyżurze byłby wstydliwy — zmierz obie naprawy tą samą metodą.
- ★★ **`ADM-OWN-001` nietknięty** (`R3c`) — żadna zmiana struktury/liczby/kolejności sekcji
  menu Admina w tym dyżurze, wyłącznie tłumaczenie istniejących etykiet.
- ★ **Rozłączność `adminP32.routes.ts` z dyżurem 218** — sprawdź PRZED pierwszym commitem
  (`§6`).
- ★ **`Z13`:** logi, zrzuty, wyjścia bramek nie wchodzą do repo — leżą w
  `/private/tmp/cx-day219-admin-schematy-artefakty`, raport podaje ścieżki i
  `shasum -a 256`.
- Pułapka: bez `RUN_DB_TESTS=1` testy backendowe idą na MOCK DB. Pułapka: `No test files
  found` **nie jest** `PASS`. Pułapka: `Z37` — porównania testów po nazwach (`fullName`),
  nigdy po liczbach. Pułapka: `DB_TYPE` bywa przybity w configu.
- ★ Port **5000** (macOS Control Center), **5037** (`adb`), **5060-5061** (SIP) zajęte na
  stałe. Porty **6163-6175** i **5114-5139** zarezerwowane dla dyżurów 220-232 — nie bierz
  ich.
- ★★ **Sekcja „TWIERDZENIA NIEZWERYFIKOWANE" w raporcie jest OBOWIĄZKOWA.** Wypisz wprost co
  najmniej: czy potwierdziłeś na żywym Postgresie, że jedyną brakującą kolumną w zapytaniu
  faktur jest `issue_date` (`T1`) — czy przepisałeś to z instrukcji; czy potwierdziłeś, że
  DOKŁADNIE dwie z czterech tabel SCIM brakują `organization_id` (`T8`) — czy założyłeś
  wszystkie cztery; czy sprawdziłeś, że coś dziś w ogóle pisze do `scim_group_mappings`/
  `scim_sync_logs` (backfill `R2a`); czy `R1c` (status ok/unavailable dla faktur)
  zaimplementowałeś czy STOP-owałeś merytorycznie — i dlaczego; ile z ośmiu angielskich
  literałów `useBreadcrumbs.ts` faktycznie zmierzyłeś jako osiągalne pod `/admin/*` (`T14`);
  czy sprawdziłeś kolizję zasobową z dyżurem 218 w `adminP32.routes.ts` PRZED pierwszym
  commitem. **Brak tej sekcji jest podstawą odrzucenia dyżuru.**
