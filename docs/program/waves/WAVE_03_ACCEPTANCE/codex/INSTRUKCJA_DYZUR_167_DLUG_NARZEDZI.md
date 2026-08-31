# INSTRUKCJA DYŻURU nr 167 — Codex — „Splata dlugu w naszych narzedziach pomiarowych - cztery pozycje, kazda blokuje innych"

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
> **wyłącznie** `/private/tmp/cx-day167-dlug-narzedzi`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `22124537f7`**
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
Zakres: **Narzedzia pomiarowe programu - konfiguracja testow, bramki, inwentarze. NIE produkt**.
Trasy front: `brak - ten dyzur nie dotyka frontu`. Trasy tył: `brak zmian w `server/src` - dyzur dotyczy konfiguracji, testow w `tests/` i skryptow`.

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
WT=/private/tmp/cx-day167-dlug-narzedzi
MARKER=22124537f7

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day167-dlug-narzedzi-20260830 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day167-dlug-narzedzi/config.worktree"
cat "$VAULT/worktrees/cx-day167-dlug-narzedzi/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day167-dlug-narzedzi-scratch
mkdir -p /private/tmp/cx-day167-dlug-narzedzi-artefakty

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
git -C "$VAULT" log --oneline 22124537f7..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only 22124537f7..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day167-dlug-narzedzi-20260830
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 22124537f7..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `cztery` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day167-dlug-narzedzi

# (T1) ILE KONFIGURACJI PRZYPINA DB_TYPE - sa DWIE, nie jedna
grep -n "DB_TYPE" vitest.config.ts server/vitest.config.ts server/vitest.config.v8-db.ts
#   oczekiwane: vitest.config.ts:210 ORAZ server/vitest.config.ts:17.
#   Trzeci config nie ma tego wcale. Potwierdz sam.

# (T2) TESTY PINUJACE NIEPRAWDE O COFANIU
grep -n "rollback_available" tests/unit/backend/aiActionExecutor.wave3-runtime.test.ts tests/unit/ai/wave3-governance-contract.test.ts
grep -n "rollback_available" server/src/services/aiActionExecutor.ts
#   oczekiwane: w produkcie napis zostal WYLACZNIE w deklaracji typu (linia 146),
#   zadna sciezka wykonania go nie produkuje. Testy wymagaja, zeby produkt klamal.

# (T3) BRAMKA MIGRACJI NIE JEST WPIETA W NIC
grep -rn day161 package.json .github/workflows/ .husky/ || echo 'ZERO TRAFIEN - potwierdzone'
grep -n "pgvector" .github/workflows/test-suite.yml | head -2
#   CI ma usluge postgresa, ale to POSZLAKA za wyborem CI, nie dowod na docker run.

# (T4) SKALA WZORCA 'toContain na zrodle'
grep -rln readFileSync tests/ server/src src --include='*.test.ts' --include='*.test.tsx' | xargs grep -ln toContain | wc -l
#   To jest GORNA GRANICA, nie wynik - czesc z tych plikow czyta atrapy, nie zrodla.
#   Twoim zadaniem jest sklasyfikowac, nie przepisac te liczbe.
```

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day167-dlug-narzedzi-20260830` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6058`. Twój JEDYNY port harnessu to `5002 i 5003`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day167-pg`**. **ZAKAZANE:** `6012, 5433, 6047 i 6054-6055 (odbiory nadzorcy), 6051/4994-4995 (163), 6052/4996-4997 (164), 6056/4998-4999 (165), 6057/5000-5001 (166)`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak - ten dyzur NIE wprowadza ani jednej nowej flagi i NIE zmienia wartosci domyslnej zadnej istniejacej`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY167_DLUG_NARZEDZI_REPORT.md`. Nie zmieniasz zadnego `MODULE_ACCEPTANCE.md` - ten dyzur nie dotyka produktu. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day167-dlug-narzedzi-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day167-dlug-narzedzi-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **NIE ZMIENIASZ ZACHOWANIA PRODUKTU.** To dyzur o narzedziach. Zero zmian w `server/src/**` i `src/**`. Jedyne dozwolone zmiany to konfiguracja, testy w `tests/` i skrypty. **NIE ROBISZ MASOWEJ PODMIANY.** `CLAUDE.md` ostrzega wprost, ze masowa operacja tego typu raz juz zniszczyla wydane instrukcje. Pozycja 2 dotyczy **dwoch imiennie wskazanych plikow**; cala reszta to **inwentarz do osobnej decyzji**, nie naprawa. **NIE ZMIENIASZ `scripts/dev/day161-fresh-migration-check.sh`** - wpinasz ja, nie przepisujesz. **NIE DOTYKASZ `server/migrations/**`** - dyzur 166 ma tam wlasny plik. **Wybierasz JEDNO z dwoch** miejsc wpiecia bramki: CI albo hook. Nie oba. **Zero polaczen do bazy zdalnej, demo, stagingu i produkcji.** ★ **Przy pozycji 1 zmierz, ile testow biegnie dzis na sqlite, ZANIM zmienisz config - i pokaz te sama liczbe po zmianie.** Naprawa, ktora po cichu przelacza setki testow na inna baze, jest gorsza od przypiecia | To dyzur o **naszych wlasnych narzedziach**, nie o produkcie. Cztery pozycje kosztowaly realny czas w ciagu jednego dnia. Najostrzejszy dowod: 30.08 audytor uruchomil **dokladnie komende udokumentowana w raporcie dyzuru 162** i dostal `expected 'sqlite' to be 'postgres'` - nie mogl odtworzyc wyniku, dopoki recznie nie wylaczyl jednej linii konfiguracji. **Dowod, ktorego nikt nie odtworzy z raportu, nie jest dowodem.** Dopoki narzedzia klamia, kazdy kolejny dowod jest slabszy, niz moglby byc |

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
cd /private/tmp/cx-day167-dlug-narzedzi

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day167-pg psql -U postgres -d cx167 \
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
cd /private/tmp/cx-day167-dlug-narzedzi

docker run -d --name cx-day167-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx167 \
  -p 127.0.0.1:6058:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day167-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6058/cx167 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6058/cx167 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day167-dlug-narzedzi && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6058/cx167 \
JWT_SECRET=cx167-test-secret-do-not-reuse \
npx vitest run tests/unit --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day167-dlug-narzedzi-artefakty/day167-vitest.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day167-dlug-narzedzi && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run tests/unit --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day167-dlug-narzedzi-artefakty/day167-vitest.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day167-dlug-narzedzi/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day167-pg psql -U postgres -d cx167 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day167-pg`.
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
> **(e) **Pierwsza: przypiecie jest w DWOCH konfiguracjach, nie jednej.** Nadzorca wskazal poczatkowo tylko `server/vitest.config.ts:17`. Przeglad przy skladaniu tej instrukcji znalazl **ten sam wzorzec w `vitest.config.ts:210`** w korzeniu repo. Naprawa jednego pliku zostawia drugi. Trzeci config, `server/vitest.config.v8-db.ts`, nie ma tego wcale - przeczytaj go, bo moze byc gotowym wzorcem. **Druga: liczba testow z wzorcem 'toContain na zrodle' NIE JEST ZNANA.** Zgrubny grep nadzorcy (`readFileSync` plus `toContain` w tym samym pliku) daje **247 plikow**, a osobny szacunek innego przegladu dal **55**. Rozbieznosc jest szescioкrotna i **oba sa gornymi granicami** - czesc tych plikow czyta atrapy albo dane, nie kod zrodlowy. **Nie przepisuj zadnej z tych liczb do raportu jako faktu.** Twoim zadaniem jest **sklasyfikowac** wzorzec i podac liczbe, ktora sam zmierzyles metoda, ktora opiszesz. **Trzecia: liczba migracji rowniez jest nieaktualna w obiegu.** W `server/migrations/` jest dzis **1073 pliki**, a przebieg raportuje **868** - to sa dwie rozne miary (pliki na dysku kontra migracje uruchamialne po filtrze). Uzywaj wlasciwej i **nazwij, ktorej uzywasz**. **Czwarta: pozycja 4 to naprawa NARZEDZIA, nie polowanie na defekt.** Przy poprzednim przeliczeniu poprawka parsera **nie ujawnila zadnej nowej inwersji** - piec kandydatow zostalo pieciu. **Nie obiecuj, ze cos znajdziesz**, i nie naciagaj wyniku, zeby naprawa wygladala na oplacalna. Skrypt zrodlowy `day161-column-inventory.mjs` lezy w scratchu innej sesji i moze byc **poza Twoim zasiegiem** - wtedy odtworz go od zera pod nazwa z licencji i **powiedz wprost, ze odtwarzales, a nie poprawiales**. **Piata: `.husky/pre-commit` ma jawny komentarz o celowym unikaniu ciezkich sprawdzen** - przebieg bramki stawia kontener i migruje setki migracji. Zmierz czas, zanim zdecydujesz o miejscu wpiecia**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day167-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day167-dlug-narzedzi-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`pozycje 1 i 3 - konfiguracja testow przestaje uniemozliwiac odtworzenie dowodu, a bramka swiezych migracji zaczyna startowac bez udzialu czlowieka`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6058` albo `5002 i 5003` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6058` albo `5002 i 5003`** (`Z7`).

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

Ten dyżur nie poprawia produktu. Poprawia **narzędzia, którymi mierzymy, czy produkt działa** —
a te narzędzia same skłamały albo zawiodły w ciągu jednego dnia pracy, 30.08.2026, cztery razy
z rzędu.

**Pierwsze kłamstwo:** `server/vitest.config.ts:17` przypina `DB_TYPE: 'sqlite'` wewnątrz bloku
`test.env`. Blok `test.env` Vitesta wygrywa ze zmienną środowiskową ustawioną w linii poleceń —
to nie hipoteza, to udokumentowane zachowanie narzędzia. Skutek uboczny: 30.08 audytor
uruchomił dokładnie komendę zapisaną w raporcie dyżuru 162
(`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY162_DOMKNIECIE_POCHODZENIA_REPORT.md`,
sekcja „Testy i pułapki Z33” — tam wprost zapisano, że dyżur 162 użył **zewnętrznego configu
spoza repo**, bo standardowy `server/vitest.config.ts` sam by ustawił sqlite) i dostał
`expected 'sqlite' to be 'postgres'`. Raport, którego nikt nie odtworzy bez własnego obejścia
configu, nie jest dowodem — jest opisem tego, co zadziałało akurat temu jednemu wykonawcy, akurat
tamtego dnia.

**Drugie kłamstwo:** dwa testy pinują nieprawdę o cofaniu akcji AI. Dyżur 162 naprawił produkt —
`rollbackStateForResult` w `server/src/services/aiActionExecutor.ts:145-154` zwraca dziś
bezwarunkowo `rollback_unavailable` (nie ma mechanizmu cofania tej klasy akcji, więc produkt ma
o tym uczciwie mówić). Dwa testy nie nadążyły za tą naprawą i w dalszym ciągu żądają wartości
sprzed niej.

**Trzecie kłamstwo (a właściwie zaniechanie):** dyżur 161 zbudował i zweryfikował mutacyjnie
bramkę świeżych migracji (`scripts/dev/day161-fresh-migration-check.sh`) — działa, wykrywa
realny defekt. Ale nikt jej nigdzie nie podłączył. Bezpiecznik, który czeka, aż ktoś sobie o nim
przypomni i uruchomi ręcznie, zabezpiecza dokładnie tyle, ile bezpiecznik, którego nie ma.

**Czwarte kłamstwo:** inwentarz kolumn migracji (dyżur 161, skrypt w scratchu tamtej sesji) łapie
tylko pierwszą kolumnę z wieloklauzulowego `ALTER TABLE ... ADD COLUMN a, ADD COLUMN b, ADD
COLUMN c`. Konkretny, zweryfikowany w tym repozytorium przykład:
`server/migrations/20261039_settings_mfa_challenges.sql:16-22` —

```sql
ALTER TABLE trusted_devices
  ADD COLUMN IF NOT EXISTS organization_id text,
  ADD COLUMN IF NOT EXISTS credential_hash text,
  ADD COLUMN IF NOT EXISTS factor_generation integer NOT NULL DEFAULT 1,
  ...
```

`credential_hash` jest tu drugą klauzulą, nie pierwszą — parser łapiący wyłącznie pierwszą kolumnę
z `ALTER TABLE` zgubi ją jako producenta. A ten sam plik dalej **zapisuje i czyta**
`credential_hash` (linie 51, 61-62, 95, 106-107) — kolumna ma pełnoprawnego, żywego producenta,
tylko narzędzie inwentaryzujące go nie widzi.

Wszystkie cztery pozycje mają wspólny mianownik: **narzędzie pomiarowe, które nie mówi prawdy,
jest gorsze niż brak narzędzia** — bo brak narzędzia budzi czujność, a fałszywy zielony pasek ją
usypia.

## Czym ten dyżur NIE jest

Nie jest zmianą zachowania produktu — jedyne dopuszczalne dotknięcie `server/src` czy `src` to
dopasowanie **testu** do już naprawionego zachowania, nigdy odwrotnie, i tylko w dwóch imiennie
wskazanych plikach testowych z pozycji 2. Nie jest przepisaniem `scripts/dev/day161-fresh-
migration-check.sh` — ten skrypt jest już zweryfikowany mutacyjnie przez dyżur 161 i się go nie
rusza, tylko się go wpina. Nie jest polowaniem na nowe inwersje w łańcuchu migracji — pozycja 4
naprawia narzędzie pomiarowe; przy poprzednim przeliczeniu poprawka parsera nie zmieniła liczby
kandydatów na inwersję (5 zostało 5), więc nie ma podstaw, żeby obiecywać nowe odkrycie. Nie jest
generalną sanacją testów typu `toContain` na źródle — pozycja 2 dotyczy jednego imiennie
wskazanego wystąpienia; reszta populacji to inwentarz do osobnej decyzji, nie do naprawy w tym
dyżurze. Nie jest operacją na bazie demo/staging/produkcja — całość dzieje się lokalnie.

# 2. TEZY ZLECENIA

- **T1.** Blok `test.env` w konfiguracji Vitesta ma pierwszeństwo przed zmienną z linii poleceń
  — to zachowanie narzędzia, nie domysł, ale dowód musi być odtwarzalny (przed/po), nie opisowy,
  bo dowód opisowy z dyżuru 162 już raz zawiódł.
- **T2.** „Test kłamie” to nie jedna klasa defektu, tylko dwie niezależne. Jedna: asercja żąda
  wartości sprzecznej z już naprawionym produktem (pada realnie). Druga: asercja sprawdza
  obecność napisu w treści pliku źródłowego, a nie efekt działania kodu — taki test może świecić
  na zielono wiecznie, nawet gdy produkt nigdy tego napisu nie wyprodukuje. Obie wymagają innej
  naprawy i trzeba je nazwać osobno.
- **T3.** Bezpiecznik, który istnieje i działa, ale nie jest wpięty w żaden zautomatyzowany cykl
  (CI, hook), nie chroni nikogo — chroni tylko tego, kto akurat pamięta, żeby go odpalić ręcznie.
  Istnienie i poprawność skryptu (dyżur 161) to warunek konieczny — sam z siebie nie chroni
  niczego, dopóki nikt go nie uruchamia automatycznie.
- **T4.** Błąd parsera opartego o „pierwsza kolumna po `ALTER TABLE`” nie jest widoczny z lektury
  pojedynczego pliku migracji — ujawnia się dopiero przy przeliczeniu na realnym korpusie. Skala
  błędu wymaga pomiaru liczbowego, nie oszacowania z oka.

# 3. POZYCJE DYŻURU

## R1 — CLI ma wygrywać z `test.env` w `server/vitest.config.ts`

`server/vitest.config.ts:17` ustawia `DB_TYPE: 'sqlite'` jako literał wewnątrz `test.env`
(blok `test.env` zaczyna się w linii 9, kończy w linii 25). To wygrywa z każdą zmienną
`DB_TYPE` ustawioną przy wywołaniu z linii poleceń — Vitest stosuje `test.env` na proces testowy
niezależnie od tego, co odziedziczył z powłoki.

Dla porównania: w repo są jeszcze dwa pliki konfiguracji Vitesta poza tym objętym licencją —
`vitest.config.ts` w korzeniu repo ma **ten sam wzorzec** (`DB_TYPE: 'sqlite'` w linii 210, też
w bloku `test.env`, environment `jsdom`, inny zestaw testów), a `server/vitest.config.v8-db.ts`
**nie ma go wcale** — nie ustawia `DB_TYPE` w ogóle, tylko `V8_DB_TEST_MODE: 'real'`. Przejrzyj
oba, ale napraw wyłącznie plik z tabeli licencji (`server/vitest.config.ts`) — korzeń repo
`vitest.config.ts` obsługuje inny, znacznie szerszy zestaw testów (w tym frontendowe pod
`jsdom`) i jego naprawa to osobna decyzja, nie ten dyżur. Zapisz w raporcie, że drugi plik ma
ten sam wzorzec i nie został naprawiony celowo.

Zadanie: sprawić, żeby `DB_TYPE` z linii poleceń wygrywał, **bez zmiany domyślnego zachowania**
— kto nie poda `DB_TYPE` wcale, ma dostać `sqlite` tak jak dziś. To wymaga, żeby wartość w
`test.env` czytała `process.env.DB_TYPE` w momencie ewaluacji konfiguracji (nie przypisywała
stałej), z fallbackiem na `'sqlite'` — sam mechanizm i dokładny zapis zostaw sobie do decyzji
przy implementacji, ale obie własności (CLI wygrywa, brak CLI = sqlite jak dotąd) muszą być
dowiedzione osobno.

Pułapka do przypilnowania: nie wolno rozwalić przebiegów, które dziś **polegają** na sqlite w tym
configu. Zanim cokolwiek zmienisz, zmierz — liczbą plików testowych i liczbą testów — ile dziś
przechodzi pod `npx vitest run --config server/vitest.config.ts` bez żadnej zmiennej `DB_TYPE`
z zewnątrz. Po zmianie ta sama komenda musi dać identyczną liczbę.

**Ukończone, gdy:** masz dowód mutacyjny w obie strony — (a) przed naprawą, komenda z katalogu
`server/` z `DB_TYPE=postgres` w linii poleceń mimo to loguje/warunkuje na `sqlite`; (b) po
naprawie, ta sama komenda faktycznie działa na `postgres` (np. próbnik, który loguje
`process.env.DB_TYPE` albo się celowo wywala na brakującym `DATABASE_URL` zamiast cicho spaść na
sqlite); (c) bez żadnego `DB_TYPE` w linii poleceń wynik jest identyczny jak przed zmianą —
ta sama liczba przechodzących testów co w pomiarze „przed”.

## R2 — dwa testy przestają żądać nieprawdy o cofaniu

Dwa pliki, dwie różne klasy defektu.

**Plik pierwszy:** `tests/unit/backend/aiActionExecutor.wave3-runtime.test.ts`, linie 320 oraz
331-332:

```
320:    expect(executed.rollbackStatus).toBe('rollback_available');
...
331:      rollbackStatus: 'rollback_available',
332:      rollbackAvailable: true,
```

Produkt po naprawie dyżuru 162 (`server/src/services/aiActionExecutor.ts:145-154`,
`rollbackStateForResult`) zwraca bezwarunkowo:

```
150:  return {
151:    rollbackStatus: 'rollback_unavailable',
152:    rollbackAvailable: false,
153:  };
```

— i ta wartość spływa przez `executeAction` (linia 845: `const rollback =
rollbackStateForResult(result);`, dalej do zwracanego obiektu i do zapisu w audycie ledgera,
bez żadnej gałęzi warunkowej, która kiedykolwiek zwróciłaby `'rollback_available'`). Test w
obecnym kształcie żąda wartości, której produkt fizycznie nie potrafi wyprodukować — pada
realnie, nie teoretycznie. Zadanie: dopasuj obie asercje do `'rollback_unavailable'` /
`rollbackAvailable: false`, zgodnie z tym, co produkt faktycznie robi po naprawie 162. Nie
zmieniaj nic w `aiActionExecutor.ts` — to plik produkcyjny, poza licencją tego dyżuru.

**Plik drugi, osobna klasa defektu:** `tests/unit/ai/wave3-governance-contract.test.ts`, linia
116 (obok niej linia 117, którą zostawiasz — sprawdza uczciwy literał):

```
116:    expect(executor).toContain('rollback_available');
117:    expect(executor).toContain('rollback_unavailable');
```

`executor` w tym pliku to nie wynik wywołania funkcji — to surowy tekst pliku, wczytany
funkcją pomocniczą `read()` zdefiniowaną na górze pliku (linia 8: `return
readFileSync(resolve(root, relativePath), 'utf8');`). `toContain('rollback_available')` sprawdza
więc, czy **napis występuje gdziekolwiek w treści pliku źródłowego** — łącznie z deklaracją typu.
I faktycznie: w `server/src/services/aiActionExecutor.ts` napis `'rollback_available'` występuje
dokładnie raz, w linii 146, wyłącznie jako człon unii typu
(`'rollback_available' | 'rollback_unavailable'`) — żadna gałąź wykonania go nie zwraca i nie
przypisuje. Test przechodzi dziś zielono i będzie przechodził zielono nawet gdyby ktoś usunął
ostatni ślad działającego cofania z kodu wykonywalnego, dopóki słowo zostanie w komentarzu albo
w typie. **Mierzy obecność tekstu, nie zachowanie.**

Napraw ten jeden wiersz tak, żeby sprawdzał zachowanie, nie treść pliku (np. przez test
kontraktowy na realnym wywołaniu `rollbackStateForResult`/`executeAction`, analogicznie do
tego, co naprawia plik pierwszy) — linii 117 nie ruszasz, bo `rollback_unavailable` jest dziś
uczciwym literałem i jej ewentualna zamiana na test behawioralny to już wykroczenie poza
imiennie wskazane wystąpienie.

Przy okazji — **tylko przy okazji, nie jako osobne zadanie naprawcze** — policz, ile jeszcze
plików testowych w repo łączy wczytanie pliku źródłowego (`readFileSync` lub analogiczny wzorzec)
z asercją `toContain` na jego treści. Orientacyjny, szybki `grep` (wykonawca ma zmierzyć to
sam, dokładniej i wedle własnej metodyki) sugeruje rząd wielkości kilkudziesięciu plików w
`tests/unit` — to nie jest liczba do zaraportowania jako fakt, tylko sygnał, że warto policzyć
porządnie. Podaj w raporcie dokładną liczbę i listę plików (ścieżka + numer linii wystąpienia).
**Nie naprawiaj żadnego z nich** poza tym jednym, imiennie wskazanym powyżej — to materiał na
osobną decyzję właściciela, nie na samodzielną akcję w tym dyżurze.

**Ukończone, gdy:** oba testy z pliku pierwszego przechodzą zielono z asercjami zgodnymi z
`rollback_unavailable`/`false`; test z pliku drugiego (linia 116) przechodzi zielono dzięki
sprawdzeniu zachowania, a nie treści pliku, i pada, gdybyś (próbnie, do dowodu, nie na stałe)
podmienił `rollbackStateForResult` tak, żeby zwracała `'rollback_available'` — to dowód, że test
faktycznie coś teraz mierzy; masz gotową listę „ile plików w repo używa `toContain` na źródle”
z dokładną liczbą i ścieżkami.

## R3 — bramka świeżych migracji wpięta w cykl pracy

`scripts/dev/day161-fresh-migration-check.sh` istnieje, ma uprawnienia wykonywalne, stawia
kontener Postgresa (`docker run ... pgvector/pgvector:pg16`), migruje od zera przez
`server/scripts/migrate.postgres.ts`, sprawdza ledger `schema_migrations` i powtarza migrację,
żeby dowieść idempotencji (`grep -Fq 'Applying migrations: 0'`). Nic z tego nie jest podłączone
do żadnego zautomatyzowanego wyzwalacza:

```
$ grep -r day161 package.json .github/workflows/ .husky/
[zero trafień]
```

Zadanie: wybierz **jedno** miejsce spinające — CI (`.github/workflows/`) albo hook
(`.husky/`) — i uzasadnij wybór pomiarem, nie deklaracją. Materiał do decyzji, który masz w
repo:

- `.husky/pre-commit` ma na górze pliku wprost zapisaną zasadę: „Ciężkie checki
  (lint/typecheck/tests) pozostają wyłączone jak prosiłeś” — hook dziś celowo trzyma się
  wąskich, szybkich sprawdzeń (kanon list/artefaktów, oba uruchamiane na zbiorze zmienionych
  plików, bez kontenerów). Bramka dnia 161 stawia kontener od zera i przepuszcza przez niego
  cały katalog `server/migrations` (w chwili pisania tej instrukcji — 1073 pliki `.sql`;
  liczba w treści zlecenia, „koło 868”, jest starsza i pochodzi z innego punktu w czasie tej
  samej gałęzi — nie traktuj jej jako aktualnej, zmierz naprzeciw stanu, na którym pracujesz).
  Zmierz realny czas jednego przebiegu skryptu lokalnie i porównaj z czasem, jaki reszta hooka
  dziś zajmuje — dopiero to rozstrzyga, czy hook się nadaje.
- `.github/workflows/test-suite.yml` ma już dziś kilka zadań z blokiem `services:` stawiającym
  `pgvector/pgvector:pg16` jako kontener na `runs-on: ubuntu-latest` (np. zadanie
  „Acceptance Tests”, linie 388-410) — czyli obraz Postgresa z pgvector jest już w tym
  repozytorium rutynowo używany na runnerach GitHuba. To nie dowodzi, że runner ma Dockera w
  ogólności (żadnego bezpośredniego `docker run` w tych zadaniach nie ma — `services:` to
  warstwa GitHuba nad silnikiem kontenerów runnera), ale jest silną poszlaką, że środowisko CI
  tego repo już dziś współpracuje z kontenerami Postgresa na tym samym obrazie, którego chce
  użyć skrypt dnia 161. **Sprawdź to twardo, nie na poszlace**: jeśli wybierzesz CI, zweryfikuj
  wprost (dokumentacja runnera i/lub próbny krok `docker version` w nowym joba), że `ubuntu-
  latest` ma dostępny silnik Dockera dla bezpośredniego `docker run` (a nie tylko dla warstwy
  `services:`), bo skrypt dnia 161 woła `docker run`/`docker exec`/`docker ps` samodzielnie, nie
  przez `services:`.

Cokolwiek wybierzesz, nie przepisuj `scripts/dev/day161-fresh-migration-check.sh` — wpinasz go
jako krok, ewentualnie z dodatkowymi zmiennymi środowiskowymi przekazanymi z zewnątrz
(`DAY161_CONTAINER_NAME`, `DAY161_PG_PORT` i inne, które skrypt już dziś czyta z `env` z
wartościami domyślnymi), nie zmieniasz jego treści.

Jedyna dozwolona zmiana w `package.json` to dodanie **jednego** skryptu uruchamiającego bramkę
(np. wzorem istniejących `test:auth:day56:idle`, `test:fin005:pg` — nazwij analogicznie, jawnie
odwołując się do dnia 161) — zero zmian w `dependencies`/`devDependencies`.

**Ukończone, gdy:** masz pomiar czasu przebiegu skryptu (sekundy, nie „szybko”/„wolno”); masz
jawną decyzję CI-albo-husky z uzasadnieniem opartym na tym pomiarze; masz dowód, że wybrane
miejsce faktycznie odpala skrypt bez udziału człowieka — dla CI: przebieg joba w logu
pokazujący `DAY161_FRESH_MIGRATION_GATE=PASS`; dla husky: commit próbny pokazujący, że hook się
odpalił i przepuścił/zablokował zgodnie z oczekiwaniem. Jeśli wybrałeś CI, masz też dowód, że
runner ma Dockera dostępnego dla bezpośredniego `docker run` (nie tylko dla `services:`).

## R4 — parser inwentarza migracji: wieloklauzulowy `ALTER TABLE` gubi kolumny

Skrypt inwentaryzujący producenta każdej kolumny (`day161-column-inventory.mjs`) powstał w
scratchu sesji dyżuru 161 i nie wszedł do repozytorium. Odtwórz go pod nazwą
`scripts/dev/day167-column-inventory.mjs` i popraw wzorzec wykrywający producenta kolumny tak,
żeby z `ALTER TABLE x ADD COLUMN a, ADD COLUMN b, ADD COLUMN c` łapał **wszystkie** kolumny w
klauzuli, nie tylko pierwszą.

Dowód, że błąd jest realny, zweryfikowany w tym repozytorium: `server/migrations/
20261039_settings_mfa_challenges.sql:16-22` ma `ALTER TABLE trusted_devices` z sześcioma
klauzulami `ADD COLUMN IF NOT EXISTS` w jednym poleceniu; `credential_hash` jest drugą w
kolejności. Ten sam plik dalej zapisuje `credential_hash` (linie 51, 61-62) i czyta ją w
warunkach (`WHERE credential_hash IS NULL`, linia 85; `SET ... credential_hash SET NOT NULL`,
linia 95; indeks unikalny na niej, linie 106-107) — producent i konsument tej kolumny są w tym
samym pliku, a mimo to parser oparty na „pierwsza kolumna po `ALTER TABLE`” oznaczy ją jako bez
producenta.

Skala z treści zlecenia — 276 z 3278 wystąpień `ADD COLUMN` (około 8,4%) niepoliczonych jako
producent — pochodzi z przeliczenia wykonanego w dyżurze 161 na jego własnej kopii skryptu;
**nie odtworzyłem tej liczby niezależnie** (skrypt źródłowy leży w scratchu tamtej sesji, poza
zasięgiem tego audytu — zobacz sekcję „Twierdzenia niezweryfikowane”). Twoim zadaniem nie jest
uzgodnienie z tą liczbą — jest przeliczenie na nowo, po naprawie, na aktualnym stanie
`server/migrations/` na twojej gałęzi, i podanie własnej, świeżo zmierzonej pary liczb
(przed naprawą / po naprawie).

Uwaga z poprzedniego przeliczenia (dyżur 161): poprawka parsera **nie ujawniła żadnej nowej
inwersji** — liczba kandydatów na „kolumna czytana przed zapisem” została identyczna (5 przed, 5
po). To znaczy: to jest naprawa narzędzia pomiarowego, nie polowanie na nowy defekt w danych. Nie
obiecuj w raporcie, że coś nowego znajdziesz — jeśli znajdziesz, opisz to jako obserwację, nie
jako cel, który został spełniony.

**Ukończone, gdy:** `scripts/dev/day167-column-inventory.mjs` istnieje, uruchamia się bez
błędu na `server/migrations/`, i wobec `20261039_settings_mfa_challenges.sql` zwraca
`credential_hash` jako mającą producenta (nie `PRODUCER_NOT_PARSED`); masz parę liczb (ile
wystąpień `ADD COLUMN` łącznie, ile bez rozpoznanego producenta) zmierzoną przed i po naprawie
na twoim stanie repo; masz jawne stwierdzenie, czy poprawka zmieniła listę kandydatów na
inwersję względem tego, co dał stary (niepoprawiony) parser na tym samym stanie repo.

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY167_DLUG_NARZEDZI_REPORT.md` |
| Zapis | `server/vitest.config.ts` (wyłącznie wzorzec `DB_TYPE` w bloku `test.env`, linia 17) |
| Zapis | `tests/unit/backend/aiActionExecutor.wave3-runtime.test.ts` (wyłącznie linie 320, 331-332) |
| Zapis | `tests/unit/ai/wave3-governance-contract.test.ts` (wyłącznie linia 116) |
| Zapis | `.github/workflows/` **albo** `.husky/` — jedno z dwóch, wybrane i uzasadnione pomiarem; nie oba |
| Zapis | `package.json` — wyłącznie dodanie jednego skryptu uruchamiającego bramkę dnia 161; zero zmian w `dependencies`/`devDependencies` |
| Zapis | nowy `scripts/dev/day167-column-inventory.mjs` |
| Odczyt | `vitest.config.ts` (korzeń repo) — do porównania wzorca, nie do naprawy |
| Odczyt | `server/vitest.config.v8-db.ts` — do porównania wzorca, nie do naprawy |
| Odczyt | `server/src/services/aiActionExecutor.ts` — czytasz, żeby uzgodnić testy z prawdą; **nie zmieniasz** |
| Odczyt | `scripts/dev/day161-fresh-migration-check.sh` — czytasz, wpinasz jako krok; **nie zmieniasz treści** |
| Odczyt | `server/migrations/**` — materiał do pozycji R4; nic tu nie zapisujesz ani nie zmieniasz |

**Nietykalne imiennie:** cały `server/src/**` i `src/**` poza dwoma imiennie wskazanymi liniami
w dwóch plikach testowych z R2 — żadna inna linia w tych drzewach się nie zmienia w tym dyżurze;
`server/migrations/**` (terytorium dyżuru 166 ma tam własny, osobny plik); treść
`scripts/dev/day161-fresh-migration-check.sh` (wpinasz, nie przepisujesz); jakikolwiek plik
testowy poza dwoma imiennie wskazanymi w R2 (inwentarz z pozycji R2 to lista do raportu, nie
lista do naprawy).

**Zasoby wyłączne:** jeśli pozycja R1 lub R3 wymaga postawienia lokalnego Postgresa do dowodu,
używaj własnego kontenera i portu nienależącego do żadnego innego równoległego dyżuru (163-166)
ani do portów już zajętych przez dyżury 159-162 (6046, 6049, 6050 i pochodne) — wybierz wolny
port, sprawdź `lsof` przed startem, jak robi to już `day161-fresh-migration-check.sh`. Zero
połączeń do bazy zdalnej, demo, stagingu, produkcji.

★ **Rozłączność.** Równolegle biegną dyżury 163, 164, 165, 166. Nie dotykasz `server/src/**` ani
`src/**` poza dwiema imiennie wskazanymi liniami testowymi z R2. Nie dotykasz
`server/migrations/**`. Nie zmieniasz treści `scripts/dev/day161-fresh-migration-check.sh` —
wpinasz go, nie przepisujesz.

# 5. BRAMKI ODBIORU

- **B1. R1 ma dowód w obie strony.** Przed naprawą: komenda z `DB_TYPE=postgres` w linii poleceń,
  uruchomiona z katalogu `server/` przez `server/vitest.config.ts`, mimo to działa na sqlite. Po
  naprawie: ta sama komenda faktycznie działa na postgres. Bez żadnego `DB_TYPE` z zewnątrz —
  zachowanie identyczne jak przed zmianą (ta sama liczba przechodzących testów, zmierzona przed
  i po).
- **B2. R2, plik pierwszy, zgodność z prawdą.** `tests/unit/backend/aiActionExecutor.wave3-
  runtime.test.ts` (linie 320, 331-332) asertuje `rollback_unavailable`/`rollbackAvailable:
  false` — zgodnie z tym, co `rollbackStateForResult` w `server/src/services/
  aiActionExecutor.ts:145-154` faktycznie zwraca. Test przechodzi zielono.
- **B3. R2, plik drugi, mierzy zachowanie, nie tekst.** `tests/unit/ai/wave3-governance-
  contract.test.ts:116` przestaje sprawdzać obecność napisu w treści pliku źródłowego. Dowód:
  test pada, gdy (próbnie, do weryfikacji, nie na stałe) `rollbackStateForResult` zwraca
  `'rollback_available'` bez żadnej faktycznej ścieżki cofania.
- **B4. Inwentarz `toContain`-na-źródle jest policzony, nie naprawiony masowo.** Raport zawiera
  dokładną liczbę plików i listę (ścieżka + linia) wystąpień wzorca „wczytanie pliku źródłowego +
  `toContain` na jego treści” poza dwoma naprawionymi w tym dyżurze. Żaden z wypisanych plików
  nie został zmieniony.
- **B5. Bramka dnia 161 startuje bez udziału człowieka.** Wybrane miejsce spinające (CI albo
  husky, nie oba) faktycznie uruchamia `scripts/dev/day161-fresh-migration-check.sh` — dowód to
  log przebiegu (joba CI albo próbnego commitu) pokazujący `DAY161_FRESH_MIGRATION_GATE=PASS`.
  Treść skryptu jest niezmieniona.
- **B6. Wybór CI-albo-husky jest uzasadniony pomiarem.** Raport zawiera zmierzony czas jednego
  przebiegu bramki i jawne porównanie z charakterem istniejącego `.husky/pre-commit` (dziś
  celowo bez ciężkich, długich sprawdzeń) — decyzja wynika z liczby, nie z założenia. Jeśli
  wybór padł na CI, raport zawiera dowód, że runner ma dostępny silnik Dockera dla
  bezpośredniego `docker run` (nie tylko dla bloku `services:`).
- **B7. `package.json` dostał wyłącznie nowy skrypt.** `git diff` na `package.json` pokazuje
  jedną dodaną linię w `scripts` i zero zmian w `dependencies`/`devDependencies`.
- **B8. R4 naprawia parser, nie tylko go opisuje.** `scripts/dev/day167-column-inventory.mjs`
  istnieje, jest uruchamialny, i na `server/migrations/20261039_settings_mfa_challenges.sql`
  zwraca `credential_hash` jako mającą rozpoznanego producenta.
- **B9. R4 ma świeżo zmierzoną parę liczb.** Raport podaje liczbę wystąpień `ADD COLUMN` łącznie
  i liczbę niepoliczonych jako producent, zmierzoną na aktualnym stanie repo — przed i po
  naprawie parsera — i jawnie mówi, czy zmieniła się lista kandydatów na inwersję względem
  starego parsera na tym samym stanie repo. Raport nie obiecuje nowego defektu jako celu
  spełnionego, jeśli defekt się nie znalazł.
- **B10. Zero regresji zachowania produktu.** `git diff` dyżuru nie dotyka żadnej linii w
  `server/src/**` ani `src/**` poza dwiema imiennie wskazanymi liniami testowymi z R2.
- **B11. Zero zdalnych połączeń.** Cały dowód (R1, R3, R4 jeśli wymaga bazy) powstał na
  lokalnym Postgresie, na porcie nienależącym do innego, równoległego dyżuru.

# TWIERDZENIA NIEZWERYFIKOWANE

- **Liczby 276/3278 (~8,4%) z pozycji R4** pochodzą z przeliczenia wykonanego w dyżurze 161 na
  jego własnej, tymczasowej kopii skryptu inwentaryzującego (`day161-column-inventory.mjs`),
  która leży w scratchu tamtej sesji i nie jest częścią tego repozytorium ani dostępna z
  poziomu tego audytu. Nie odtworzyłem tych liczb niezależnie — mój orientacyjny `grep -c "ADD
  COLUMN"` na `server/migrations/*.sql` dał 2811 (dopasowanie dosłowne) i 3467 (bez rozróżniania
  wielkości liter), żadne z tego nie zgadza się z 3278 z treści zlecenia, bo nie znam dokładnej
  logiki parsowania oryginalnego skryptu (np. czy liczy wystąpienia tekstowe, czy sparsowane
  klauzule, czy pomija migracje zredagowane inaczej). Traktuj 276/3278 jako tło historyczne z
  poprzedniej sesji, nie jako liczbę do potwierdzenia — zadaniem R4 jest przeliczenie od zera na
  aktualnym stanie repo, własnym, odtworzonym skryptem.
- **„~868 migracji” z uzasadnienia wyboru CI/husky.** W chwili pisania tej instrukcji
  (gałąź `codex/m03-admin-20260824`, znacznik `22124537f7`) `server/migrations/*.sql` liczy
  **1073 pliki** — więcej niż „~868”. Liczba w treści zlecenia jest starszym pomiarem tej samej
  gałęzi z innego punktu w czasie (katalog rośnie z każdym dyżurem). Nie koryguj w raporcie tej
  rozbieżności jako błędu zlecenia — po prostu zmierz czas przebiegu bramki na aktualnym stanie,
  na którym faktycznie pracujesz.
- **Szacunek „kilkadziesiąt plików” dla populacji `toContain`-na-źródle w R2.** Mój orientacyjny
  `grep` (pliki w `tests/unit` łączące `readFileSync` i `toContain`) dał 55 trafień. To zgrubny
  sygnał kierunkowy z jednego, naiwnego zapytania — nie metodyka, którą ma zastosować wykonawca,
  i nie liczba do wpisania w raport bez własnego, dokładniejszego przeliczenia (np. część z tych
  55 plików może czytać plik z innego powodu niż sprawdzanie treści źródła kodu produkcyjnego).
- **Dostępność Dockera na `ubuntu-latest` dla bezpośredniego `docker run`.** Zweryfikowałem z
  repozytorium, że `.github/workflows/test-suite.yml` już dziś stawia kontenery Postgresa przez
  blok `services:` (np. zadanie „Acceptance Tests”, linie 388-410) na `runs-on: ubuntu-latest` —
  to działa przez warstwę GitHuba, nie przez bezpośrednie wywołanie `docker run` w kroku joba.
  Skrypt dnia 161 wywołuje `docker run`/`docker exec`/`docker ps` samodzielnie z poziomu powłoki
  — czy ten konkretny tryb dostępu do silnika Dockera jest dostępny na tych samych runnerach, nie
  sprawdziłem uruchomieniem (nie mam dostępu do CI z tego audytu). To pozycja do potwierdzenia
  przez wykonawcę R3, jeśli wybierze CI — zgodnie z tym, co już zapisano w treści pozycji R3 i w
  bramce B6.
