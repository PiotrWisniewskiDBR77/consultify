# INSTRUKCJA DYŻURU nr 71 — Codex — „Izolacja schematu testowego — 48 plików niszczy wspólny schemat i zatruwa kolejne suity"

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
> **wyłącznie** `/private/tmp/cx-day71-schema`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `5aca498cfdf1b36d59812a7e3e4df6c8d0043aeb`**
> **Gałąź bazowa: `github-backup/codex/m03-admin-20260824`**
> **Stan dokumentu: WYDANY**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo jakiekolwiek niewypełnione pole szablonu — **dokument nie
> jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.
> Ta ramka jest **jedynym** miejscem, w którym rozstrzyga się stan wydania.
> Objaśnienia w innych blokach cytowanych **nie** są powodem do STOP-u.

Data wystawienia: 2026-08-29.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.
Zakres: **PRZEKROJOWY — infrastruktura testowa, wyłącznie wnętrze plików testowych**.
Trasy front: `brak — ten dyżur nie dotyka `src/``. Trasy tył: `brak zmian tras; `server/src` dotykasz WYŁĄCZNIE w plikach `*.test.ts` z listy §B`.

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
WT=/private/tmp/cx-day71-schema
MARKER=5aca498cfdf1b36d59812a7e3e4df6c8d0043aeb

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day71-schema-isolation-20260829 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day71-schema/config.worktree"
cat "$VAULT/worktrees/cx-day71-schema/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day71-scratch
mkdir -p /private/tmp/cx-day71-artefakty

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
git -C "$VAULT" log --oneline 5aca498cfdf1b36d59812a7e3e4df6c8d0043aeb..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only 5aca498cfdf1b36d59812a7e3e4df6c8d0043aeb..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day71-schema-isolation-20260829
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 5aca498cfdf1b36d59812a7e3e4df6c8d0043aeb..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `4` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

Komplet komend weryfikacji stanu wejściowego znajdziesz w **§A** tego dokumentu (W1–W4). Wykonujesz je wszystkie.

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day71-schema-isolation-20260829` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `5943`. Twój JEDYNY port harnessu to `4650`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day71-pg`**. **ZAKAZANE:** ``5432` (NASŁUCHUJE i NIE JEST TWÓJ), `5000`, `5037`, `5838`, `5835`, `5830`, `5816`, `5932`, `5933`, `3990`, `4342`, `4380`, `4381`, `4390`, oraz `5941`/`4630` (dyżur 69) i `5942`/`4640` (dyżur 70) — oba biegną równolegle`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak — ten dyżur nie wprowadza ani nie zmienia żadnej flagi`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest.config.ts`, każdy `vitest.*.config.ts`, `server/vitest.config*.ts`, `tests/integration/_helpers/assertRealPostgres.ts` — **wszystkie objęte `Z18`, bez wyjątku w tym dyżurze**`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY71_SCHEMA_ISOLATION_REPORT.md`. Nie zmieniasz żadnego `MODULE_ACCEPTANCE.md`, bo ten dyżur jest przekrojowy. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day71-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day71-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **★★ ZAKAZ ZMIANY TEGO, CO TEST SPRAWDZA.** Wolno Ci dodać wyłącznie przygotowanie i sprzątanie schematu (§D). Zakazana zmiana asercji, oczekiwanych wartości, danych wejściowych „żeby przeszedł", usunięcie przypadku, `.skip`, `.todo` | Ten dyżur naprawia INFRASTRUKTURĘ, w której test padał z powodu sąsiada. Pokusa „przy okazji poprawię asercję, skoro i tak tu jestem" jest największa właśnie tutaj — a to zamieniłoby pomiar w wyciszanie i zniszczyło jedyny wiarygodny punkt odniesienia, jaki mamy dla 302 rekordów NOT_PROVEN |

---

### 0.2b. ★★ PROTOKÓŁ `Z30` — ZERO WYSYŁKI, A MIMO TO PEŁNY DOWÓD

**(1) Czego NIE WOLNO Ci zrobić — nigdy:**
- ustawić `SMTP_ENABLED` na `true`;
- ustawić `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_PORT`, `SMTP_FROM`
  w środowisku, w `.env*`, w `docker-compose*` ani nigdzie indziej;
- wstawić wiersza konfiguracji SMTP do tabeli ustawień w swojej bazie;
- uruchomić serwera pełnym `server/src/index.ts` — **tam startują drenaże
  outboxów**; Twoje testy montują `ApiGateway`, nie cały serwer, i to jest
  różnica, która trzyma `Z30`;
- wywołać ręcznie żadnej funkcji `drain*` / `startNotificationOutboxDrainCron`
  / `outboxWorker`.

**(2) Trzy dowody, które wklejasz do raportu ZANIM uruchomisz cokolwiek
zapisującego:**

```bash
cd /private/tmp/cx-day71-schema

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL|SMTP_ENABLED)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day71-pg psql -U postgres -d cx_day71 \
  -c "SELECT key, left(coalesce(value,''),8) FROM settings WHERE key LIKE 'smtp%';"
#   oczekiwane: 0 wierszy. Jezeli tabela `settings` nie istnieje — wklej TEN blad,
#   to tez jest dowod (nie ma skad wziac konfiguracji poczty).

# (c) zaden drenaz outboxu nie dziala w Twoim procesie testowym
grep -n "startNotificationOutboxDrainCron\|outboxWorker\|platformOutboxDrainCron" server/src/Gateway.ts
#   oczekiwane: 0 trafien — drenaze startuja w server/src/index.ts, ktorego NIE uruchamiasz
```

**(3) Deklaracja obowiązkowa w raporcie, dosłownie:**
**„Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani
żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało
wysłane."**

---

### 0.2c. ★★ KOMPLET ZMIENNYCH ŚRODOWISKOWYCH — TRZY WARIANTY, ZAWSZE W JEDNEJ LINII

**Zmienna postawiona `export`-em wcześniej NIE LICZY SIĘ.** `vitest.config.ts`
przybija część wartości (`DB_TYPE='sqlite'`), więc komplet musi stać
**w tej samej linii komendy** — i masz **udowodnić, że nadpisał**, a nie założyć.

**(A) MIGRACJE — pełny łańcuch, przed jakimkolwiek pomiarem (`Z20`):**

```bash
cd /private/tmp/cx-day71-schema

docker run -d --name cx-day71-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx_day71 \
  -p 127.0.0.1:5943:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day71-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:5943/cx_day71 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:5943/cx_day71 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day71-schema && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:5943/cx_day71 \
JWT_SECRET=cx-day71-local-secret \
npx vitest run <ścieżki pakietu, który mierzysz> --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day71-artefakty/<nazwa pliku wynikowego>.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day71-schema && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run <ścieżki pakietu, który mierzysz> --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day71-artefakty/<nazwa pliku wynikowego>.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day71-schema/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day71-pg psql -U postgres -d cx_day71 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day71-pg`.
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
> **(e) **(e) PUŁAPKA TEGO DYŻURU — pakiet niszczy schemat, więc KOLEJNOŚĆ PLIKÓW zmienia wynik.** Ten sam plik potrafi być zielony uruchomiony sam i czerwony w pakiecie, albo odwrotnie. Dlatego pomiar przed i po robisz **tym samym pakietem, w tej samej kolejności, na tak samo świeżej bazie** — inaczej porównujesz dwie różne rzeczy**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day71-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day71-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`§C.1 faza dowodowa (bramka)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `5943` albo `4650` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `5943` albo `4650`** (`Z7`).

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
---

# §A. TEZY ZLECENIA — ROZKAZY POMIAROWE, NIE FAKTY

★★ **Każda liczba poniżej jest MOJA. Odtwórz ją, nie przyjmuj.**
**Obalenie mojej tezy jest SUKCESEM dyżuru.** W tym programie hipoteza nadzorcy
wpisana do instrukcji wróciła już raz do rejestru jako „zweryfikowany fakt",
opisując podatność, której nigdy nie było.

| # | Teza do zmierzenia | Moja liczba | Jak sprawdziłem |
| --- | --- | --- | --- |
| T1 | Pliki testowe robiące `DROP TABLE` / `TRUNCATE TABLE` / `DROP SCHEMA public` | **52** | `grep -rlniE "DROP TABLE\|TRUNCATE TABLE\|DROP SCHEMA public" tests/ server/src --include='*.test.ts'` |
| T2 | Z tych — mające już własny schemat (`CREATE SCHEMA`) | **4** | przecięcie z `grep -rl "CREATE SCHEMA"` |
| T3 | **SPRAWCY BEZ IZOLACJI — mianownik tego dyżuru** | **48** | różnica T1 − T2, lista imienna w §B |
| T4 | Wzorzec naprawy jest już sprawdzony w repo | — | `tests/integration/partners/m16-final-repair.realdb.test.ts:47-49,159` |

**Komendy weryfikacji stanu wejściowego — obowiązkowe, wynik dosłownie do raportu:**

```bash
cd /private/tmp/cx-day71-schema

# (W1) sprawcy
grep -rlniE "DROP TABLE|TRUNCATE TABLE|DROP SCHEMA public" tests/ server/src --include='*.test.ts' | sort -u | wc -l
#   oczekiwane autora: 52

# (W2) juz izolowane
grep -rl "CREATE SCHEMA" tests/ server/src --include='*.test.ts' | sort -u | wc -l
#   oczekiwane autora: co najmniej 4 z powyzszych

# (W3) mianownik dyzuru
comm -23 \
  <(grep -rlniE "DROP TABLE|TRUNCATE TABLE|DROP SCHEMA public" tests/ server/src --include='*.test.ts' | sort -u) \
  <(grep -rl "CREATE SCHEMA" tests/ server/src --include='*.test.ts' | sort -u) | wc -l
#   oczekiwane autora: 48

# (W4) wzorzec zrodlowy
sed -n '44,52p;157,161p' tests/integration/partners/m16-final-repair.realdb.test.ts
#   oczekiwane: DROP SCHEMA IF EXISTS ... CASCADE / CREATE SCHEMA ... / SET search_path ...
```

---

# §B. SKĄD TO SIĘ WZIĘŁO — CZYTAJ, ZANIM ZACZNIESZ

Nocna klasyfikacja długu integracyjnego (`DEC-2026-08-29-259..261`) uruchomiła
**163 pliki** na świeżej bazie, po pełnym migratorze, z pełnym zestawem env.
**Zielone w całości: 4 ze 163.** Raport nazwał przyczynę wprost:

> pakiet testowy **sam niszczy współdzielony schemat** — usuwa albo zastępuje
> tabelę `organizations`, po czym kolejne pliki dostają
> `column plan of relation organizations does not exist`.
> To samo dotyczy tabel `help` i `projects`.

Nadzorca potwierdził to niezależnie greptem: `DROP TABLE` w 43 plikach `tests/`,
a w mianowniku §B poniżej znajdziesz **imiennie** `m13-organization-profile-persistence.test.ts`
(tabela `organizations`) i `routes/helpRoutes.test.ts` (tabela `help`) — dokładnie te,
które raport wskazał, choć raport ich nie nazwał.

★ **To nie jest zjawisko nowe.** Ten sam wektor złapano tydzień temu przy teście
M16, który usuwał publiczne tabele rdzeniowe i zatruwał kolejne suity
(`DEC-2026-08-28-251`). **M16 nie był wyjątkiem — był pierwszym złapanym okazem.**
Dostał własny schemat i to zadziałało; read-back potwierdził, że publiczna tabela
`users` zachowała 68 kolumn.

> ### ★★ CZEGO TEN DYŻUR **NIE** TWIERDZI
> Nie twierdzimy, że izolacja schematu naprawi 302 rekordy `NOT_PROVEN`.
> To jest **hipoteza do zmierzenia**, i dokładnie temu służy **bramka §C.1**.
> Jeżeli próbka nie pokaże poprawy — **to jest wynik, nie porażka**, i dyżur
> kończy się na fazie 1 z uczciwym raportem. Nie „dociągaj" wyniku.

## Mianownik — 48 plików, imiennie

1. `server/src/controllers/__tests__/ini005-negative-controls.pg.test.ts`
2. `server/src/controllers/__tests__/ini005-portfolio-resources-roadmap.pg.test.ts`
3. `server/src/routes/interviewDelivery/__tests__/interviewEvidenceIngestToKnowledge.pg.test.ts`
4. `server/src/services/__tests__/canvasIdeaMaterializeSchemaGuard.p07c.pg.test.ts`
5. `server/src/services/__tests__/executionActionRegistryService.pg.test.ts`
6. `server/src/services/__tests__/libraryContentMerge.pg.test.ts`
7. `server/src/services/audits/__tests__/independenceScanCursor.realdb.test.ts`
8. `server/src/services/demo/__tests__/atelierFinanceLateWrite.pg.test.ts`
9. `server/src/services/demo/__tests__/atelierFinancePinnedTransaction.pg.test.ts`
10. `server/src/services/finance/canonical/__tests__/budgetRegistrationService.pg.test.ts`
11. `server/src/services/initiative/__tests__/initiativeCapabilityMatrix.pg.test.ts`
12. `server/src/services/v8/__tests__/integration/t3-migrations/migrationIntegrity.test.ts`
13. `server/src/services/v8/__tests__/v8-rollback-procedure.test.ts`
14. `tests/acceptance/h65-rbac.e2e.test.ts`
15. `tests/integration/ai/organizations-trial-tokens-used-migration.realpg.test.ts`
16. `tests/integration/case-workspace-fresh-install-migration-order.realdb.test.ts`
17. `tests/integration/deliverables/r2-inline-ai-security.test.ts`
18. `tests/integration/deliverables/r5-table-cf-security.test.ts`
19. `tests/integration/initiativeGovernance.goalRollup.tenant.pg.test.ts`
20. `tests/integration/initiatives/m05fix01-candidate-acceptance-receipt.pg.test.ts`
21. `tests/integration/kpiScorecardService.tenant.pg.test.ts`
22. `tests/integration/kpiVisibility.res11.pg.test.ts`
23. `tests/integration/m01-prun-base-runtime-migration-discovery.realdb.test.ts`
24. `tests/integration/m02b-decision-migration-932.realdb.test.ts`
25. `tests/integration/m02b-migration-runner.realdb.test.ts`
26. `tests/integration/m02b-preflight-checksum.realdb.test.ts`
27. `tests/integration/m02b-startup-readiness.realdb.test.ts`
28. `tests/integration/m02p18-runner-identity-reconciliation.realdb.test.ts`
29. `tests/integration/m13-organization-profile-persistence.test.ts`
30. `tests/integration/migration-ordering-parity.realdb.test.ts`
31. `tests/integration/mywork/managerSnapshot.realdb.test.ts`
32. `tests/integration/partners/partner-economics-mounted-auth.realpg.test.ts`
33. `tests/integration/partners/partner-economics-telemetry.realdb.test.ts`
34. `tests/integration/partners/partner-legacy-cutover.realdb.test.ts`
35. `tests/integration/routes/billing.routes.full.l3.test.ts`
36. `tests/integration/routes/conversations.attachments.get-missing-table.realdb.test.ts`
37. `tests/integration/routes/helpRoutes.test.ts`
38. `tests/integration/routes/workbook.golden-roundtrip.sqlite.integration.test.ts`
39. `tests/integration/scripts/migrationRunnerStrict.realpg.test.ts`
40. `tests/integration/test-support/testSupportRoutes.test.ts`
41. `tests/integration/webhooks-events-superadmin.realpg.test.ts`
42. `tests/security/billing/billing-auth-boundaries.test.ts`
43. `tests/security/sanitization-real.test.ts`
44. `tests/unit/backend/admin.validators.test.ts`
45. `tests/unit/backend/security/inputSanitization.test.ts`
46. `tests/unit/backend/services/scimRoleTranslation.test.ts`
47. `tests/unit/initiatives/initiative-validators.test.ts`
48. `tests/unit/server/utils/security.utils.test.ts`

---

# §C. POZYCJE

### C.1. ★★ FAZA DOWODOWA — BRAMKA. NIE PRZECHODZISZ DALEJ BEZ NIEJ.

1. Zmierz **stan wyjściowy**: uruchom pakiet integracyjny na świeżej bazie
   i zapisz wynik **po NAZWACH testów** (`fullName`), nie po liczbach (`Z37`).
2. Wybierz **próbkę 5 plików** z listy §B. Do próbki **obowiązkowo** wchodzą:
   - `tests/integration/m13-organization-profile-persistence.test.ts` (niszczy `organizations`),
   - `tests/integration/routes/helpRoutes.test.ts` (niszczy `help`).
   Pozostałe trzy wybierasz sam i uzasadniasz wybór.
3. Zastosuj do nich wzorzec M16 (§D).
4. Zmierz **ponownie**, tym samym pakietem, na tak samo świeżej bazie.
5. **Podaj różnicę po NAZWACH: które testy zmieniły stan z czerwonego na zielony,
   a które odwrotnie.**

**Bramka:** jeżeli naprawa **pięciu** plików zapala na zielono testy
**w innych plikach** — hipoteza potwierdzona, przechodzisz do C.2.
Jeżeli nie zapala nic poza tymi plikami — **hipoteza obalona, STOP, raport.**
To jest pełnoprawne zakończenie dyżuru i wynik wart tyle samo co naprawa.

### C.2. Reszta listy

Pozostałe 43 pliki, wzorcem z §D, partiami po 5–8, commit + push po każdej partii.
Po **trzech** nieudanych podejściach do jednego pliku: zostaw, wpisz do
NIEZWERYFIKOWANE, idź dalej.

### C.3. Pomiar końcowy

Pełny pakiet integracyjny na świeżej bazie, porównanie **po NAZWACH** ze stanem
z C.1 kroku 1. Podajesz trzy listy: **naprawione**, **nadal czerwone**,
**★ nowe czerwone** (ta trzecia musi być PUSTA — `K4`).

---

# §D. WZORZEC NAPRAWY — DOSŁOWNY, ZE SPRAWDZONEGO ŹRÓDŁA

Źródło: `tests/integration/partners/m16-final-repair.realdb.test.ts`.

W `beforeAll` danego pliku:

```ts
await sql.query(`DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE`);
await sql.query(`CREATE SCHEMA ${TEST_SCHEMA}`);
await sql.query(`SET search_path TO ${TEST_SCHEMA}, public`);
```

W `afterAll`:

```ts
await sql?.query(`DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE`);
```

`TEST_SCHEMA` musi być **unikalna per plik** i wyprowadzona z jego nazwy —
dwa pliki z tą samą nazwą schematu odtworzą dokładnie ten problem, który usuwasz.

> ### ★★ ZAKAZ NR 1 TEGO DYŻURU — NIE ZMIENIASZ TEGO, **CO** TEST SPRAWDZA
>
> Wolno Ci dodać **wyłącznie** przygotowanie i sprzątanie schematu.
> **ZAKAZANE:** zmiana asercji, zmiana oczekiwanych wartości, usunięcie
> przypadku testowego, `.skip`, `.todo`, poszerzenie `exclude`, zmiana danych
> wejściowych testu „żeby przeszedł" (`Z35`).
> Zmieniasz **GDZIE** test działa, nigdy **CO** sprawdza.
> Test, który po izolacji nadal pada, **ma prawo padać** — to jest wynik
> pomiarowy i wpisujesz go do raportu, a nie naprawiasz przez asercję.

> ### ★★ `Z18` OBOWIĄZUJE W PEŁNI — BEZ WYJĄTKU
>
> Naprawa dzieje się **wyłącznie wewnątrz plików testowych z listy §B**.
> **NIE dotykasz** `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`,
> `vitest.config.ts`, żadnego `vitest.*.config.ts`, `server/vitest.config*.ts`
> ani `tests/integration/_helpers/assertRealPostgres.ts`.
> Nadzorca sprawdził przed wydaniem, że wzorzec M16 **nie wymaga** globalnego
> setupu — cztery linie SQL siedzą w samym pliku. Jeżeli uznasz, że jednak
> wymaga — **STOP z uzasadnieniem**, nie cicha zmiana.
> To jest najostrzejszy zakaz w programie: jedna zmiana globalnego mocka
> fałszuje wynik całego korpusu.

---

# §E. TWARDE KRYTERIA KOŃCOWE

| # | Kryterium | Jak dowodzisz |
| --- | --- | --- |
| **K1** | Bramka C.1 rozstrzygnięta jednoznacznie | podajesz różnicę po NAZWACH; „hipoteza potwierdzona" albo „obalona", nigdy „wygląda lepiej" |
| **K2** | ★ Dowód mutacyjny na jednym pliku (`Z32`) | cofnij izolację w jednym naprawionym pliku → test **czerwony**; przywróć → **zielony**; `git diff` po przywróceniu **pusty**. Obie komendy i oba wyniki dosłownie. Mutację cofasz przez `cp`, **nigdy `git stash`** (`Z27`) |
| **K3** | Kompilacja produkcyjna serwera | `cd server && rm -rf dist && NODE_OPTIONS="--max-old-space-size=3072" ../node_modules/.bin/tsc --build tsconfig.build.json` |
| **K4** | Lista **nowych czerwonych** jest PUSTA | porównanie po NAZWACH (`Z37`); jeśli niepusta — to regresja i zgłaszasz ją jako blokadę |
| **K5** | `git diff --name-only` wobec markera zawiera **wyłącznie** pliki `*.test.ts` z listy §B oraz raport | zero plików z `Z18`, zero `src/`, zero `server/src` poza plikami testowymi z listy. Wynik komendy wklejasz do raportu |
| **K6** | Sekcja NIEZWERYFIKOWANE obowiązkowa | pliki zostawione po trzech podejściach, testy nadal czerwone, mianownik PRAWDZIWY (`Z24`) |

★ **Zdanie podsumowujące raportu MUSI zawierać mianownik**, nie samą liczbę.
Piszesz „naprawiono N z 48", nigdy „naprawiono N". Dwa raporty tego samego dnia
podały liczbę bez mianownika i oba wymagały sprostowania przez nadzorcę.

---

# §F. TABELA ROZŁĄCZNOŚCI

**Zapisujesz NA PEWNO:** 48 plików `*.test.ts` wymienionych imiennie w §B ·
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY71_SCHEMA_ISOLATION_REPORT.md`

**JAWNIE NIE ZAPISUJESZ:** czegokolwiek w `src/` · czegokolwiek w `server/src/`
poza plikami `*.test.ts` z listy · żadnego pliku objętego `Z18` ·
`public/locales/**` · migracji · `MODULE_ACCEPTANCE.md` ·
`OWNER_DECISION_LEDGER_2026-08-24.md` (`Z14`)

★ **Dwa dyżury biegną RÓWNOLEGLE i ich terenów NIE dotykasz** (`Z6`):
**dyżur 69** — `public/locales/**` i pliki `.tsx` w `src/`, port `5941`;
**dyżur 70** — `modules/10_FINANCE/**` i seeder Finansów, port `5942`.
Rozłączność zweryfikowana przez nadzorcę przed wydaniem: żaden z 48 plików
z Twojej listy nie występuje w terenie 69 ani 70.
