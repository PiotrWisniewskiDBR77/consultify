# INSTRUKCJA DYŻURU nr 169 — Codex — „Nikt nie tworzy okien check-inu, wiec celu nie da sie zaktualizowac droga produkcyjna"

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
> **wyłącznie** `/private/tmp/cx-day169-cele-checkin`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `18ba1bd3cf`**
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
Zakres: **Wyniki - cele (OKR), okna check-inu i cykl zycia zestawu**.
Trasy front: `brak zmian - dyzur nie dotyka frontu`. Trasy tył: ``server/src/routes/resultsVnext/okr.routes.ts`, `server/src/services/resultsVnext/okr/okrCheckInScheduler.ts`, `server/src/services/resultsVnext/okr/okrCycleScheduler.ts``.

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
WT=/private/tmp/cx-day169-cele-checkin
MARKER=18ba1bd3cf

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day169-cele-checkin-20260830 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day169-cele-checkin/config.worktree"
cat "$VAULT/worktrees/cx-day169-cele-checkin/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day169-cele-checkin-scratch
mkdir -p /private/tmp/cx-day169-cele-checkin-artefakty

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
git -C "$VAULT" log --oneline 18ba1bd3cf..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only 18ba1bd3cf..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day169-cele-checkin-20260830
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 18ba1bd3cf..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `cztery` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day169-cele-checkin

# (T1) GENERATOR NIE MA ANI JEDNEGO WOLACZA
grep -rn "generateCadenceOccurrencesAndSeedCheckInObligations" server/src src --include='*.ts' --include='*.tsx'
#   oczekiwane: definicja (okrCheckInScheduler.ts:64) plus DWA KOMENTARZE
#   (okrCheckInScheduler.ts:31, okrCycleScheduler.ts:279). Zero wywolan.

# (T2) ★ DRUGI BLAD, WEWNATRZ TEJ SAMEJ FUNKCJI
sed -n '64,80p' server/src/services/resultsVnext/okr/okrCheckInScheduler.ts
#   oczekiwane: wczesniejszy powrot gdy createdOccurrenceIds jest puste,
#   a zapytanie filtruje WHERE cadence_occurrence_id = ANY(createdOccurrenceIds).
#   Czyli obowiazki powstaja WYLACZNIE dla okien utworzonych w TYM wywolaniu.

# (T3) DWIE NIEZALEZNE SCIEZKI AKTYWACJI
sed -n '857p;1376p' server/src/routes/resultsVnext/okr.routes.ts
#   oczekiwane: /cycles/:cycleId/activate i /sets/:setId/activate.
#   Nic nie wymusza kolejnosci miedzy nimi. To jest sedno pozycji R2.

# (T4) ZERO POKRYCIA TESTOWEGO
ls -d server/src/services/resultsVnext/okr/__tests__ 2>/dev/null || echo 'BRAK katalogu testow'
#   oczekiwane: katalogu nie ma. Tworzysz go jako pierwszy.
```

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day169-cele-checkin-20260830` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6060`. Twój JEDYNY port harnessu to `5008 i 5009`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day169-pg`**. **ZAKAZANE:** `6012, 5433, 6047 i 6054-6055 oraz 6062-6063 (odbiory nadzorcy), 6051/4994-4995 (163), 6056/4998-4999 (165), 6057/5004-5005 (166), 6058/5002-5003 (167), 6059/5006-5007 (168). ★ PORT 5000 ZAJETY NA STALE przez macOS Control Center - nigdy go nie uzywaj`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak - ten dyzur NIE wprowadza ani jednej nowej flagi i NIE zmienia wartosci domyslnej zadnej istniejacej`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY169_CELE_CHECKIN_REPORT.md`. Nie zmieniasz zadnego `MODULE_ACCEPTANCE.md`. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day169-cele-checkin-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day169-cele-checkin-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **NIE OSLABIASZ WYMOGU `cadenceOccurrenceId`. TO JEST ZAKAZ NAJWYZSZEJ WAGI.** Check-in ma dostac **REALNE OKNO**, a nie obejscie walidacji. Naprawa, ktora czyni to pole opcjonalnym, nadaje mu wartosc domyslna albo tworzy okno w locie przy zapisie, jest **niedopuszczalna** - okna czasowe sa tym, co czyni check-in rozliczalnym w czasie. Bez nich zostaje pole tekstowe bez znaczenia. **NIE RUSZASZ LOGIKI ROLLUPU POSTEPU** - `set_rollup(equal_average)` dziala i zostal zmierzony przez drugi tor. Postep celu przelicza sie sam z kluczowych rezultatow. **NIE BUDUJESZ TRZECIEGO MECHANIZMU HARMONOGRAMOWANIA**, dopoki nie udowodnisz, ze zaden z istniejacych sie nie nadaje - a przeglad przy skladaniu tej instrukcji wskazuje, ze **poller cykliczny rozwiazuje problem, ktory nie istnieje** (patrz pulapki). `sourceReference` **MIERZYSZ I OPISUJESZ, NIE NAPRAWIASZ** - to swiadoma decyzja projektowa (D09, `OKR_E003_DESIGN.md:445`), nie przeoczenie; osobna decyzja wlasciciela. **NIE DOTYKASZ NICZEGO POD `server/src/services/resultsVnext/kpi/**`** - to terytorium dyzuru 168. **NIE ZMIENIASZ `server/src/workers/**` ani `server/src/cron/Scheduler.ts`** - czytac wolno, zmieniac nie; jesli wpiecie wymagaloby zmiany w `Scheduler.ts`, **ZATRZYMAJ SIE i zapytaj** (terytorium dyzuru 165). **Zero polaczen do bazy zdalnej, demo, stagingu i produkcji.** | **Dyzur priorytetowy zlecony wprost przez wlasciciela.** `POST .../check-ins` wymaga `cadenceOccurrenceId`, a zwykly uzytkownik nie ma jak go zdobyc. Funkcja tworzaca okna czasowe **nie ma ani jednego wywolania** - robotnik drugiego toru musial uruchomic ja recznie osobnym skryptem, zeby w ogole przetestowac lancuch. **Check-in jest dzis niewykonalny droga produkcyjna**, wiec cel jest ladny i nieuzywalny |

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
cd /private/tmp/cx-day169-cele-checkin

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day169-pg psql -U postgres -d cx169 \
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
cd /private/tmp/cx-day169-cele-checkin

docker run -d --name cx-day169-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx169 \
  -p 127.0.0.1:6060:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day169-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6060/cx169 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6060/cx169 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day169-cele-checkin && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6060/cx169 \
JWT_SECRET=cx169-test-secret-do-not-reuse \
npx vitest run server/src/services/resultsVnext/okr/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day169-cele-checkin-artefakty/day169-vitest.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day169-cele-checkin && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/services/resultsVnext/okr/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day169-cele-checkin-artefakty/day169-vitest.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day169-cele-checkin/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day169-pg psql -U postgres -d cx169 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day169-pg`.
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
> **(e) ★★ **NAJWAZNIEJSZA: w funkcji, ktora nigdy nie jest wolana, siedzi DRUGI blad.** `generateCadenceOccurrencesAndSeedCheckInObligations` (`okrCheckInScheduler.ts:70-72`) zasiewa obowiazki **wylacznie dla okien utworzonych w tym samym wywolaniu**: przy pustym `createdOccurrenceIds` robi wczesniejszy powrot, a zapytanie filtruje `WHERE cadence_occurrence_id = ANY(createdOccurrenceIds)`. A `generateCadenceOccurrences` materializuje **wszystkie** okna cyklu za jednym razem. **Skutek: zestaw aktywowany PO cyklu nie dostanie zadnego obowiazku check-inu. Nigdy.** Dlatego zaczepienie generatora wylacznie o aktywacje cyklu **nie zamyka sprawy** - sciezka aktywacji zestawu musi **uzupelnic obowiazki wobec JUZ ISTNIEJACYCH okien**, nie tylko nowo utworzonych. Obie kolejnosci musza byc przetestowane od konca do konca. **Druga: sciezki aktywacji sa DWIE i sa rozlaczne** - `POST /cycles/:cycleId/activate` (`okr.routes.ts:857`, `okrCycleCommands.ts:489`) i `POST /sets/:setId/activate` (`okr.routes.ts:1376`, `okrSetCommands.ts:1358`). **Nic nie wymusza kolejnosci miedzy nimi.** **Trzecia: poller cykliczny rozwiazuje problem, ktory nie istnieje.** `generateCadenceOccurrences` liczy **caly zakres okien cyklu za jednym razem** - nie ma potrzeby okna kroczacego. Wlasciwym ksztaltem jest **zaczep zdarzeniowy w obu trasach aktywacji**, nie nowy cron. **Czwarta, pulapka flagi:** `agentPlanSchedulerJob.ts:72` i `Scheduler.ts:879` sa **za flaga `ENABLE_AI_TASKS_WORKER`, domyslnie WYLACZONA i nie wolno jej wlaczac**. Gdybys wpial generator tam, **check-iny nie ruszylyby u nikogo** - zbudowalbys druga biblioteke bez wywolania. `wave8AgentScheduleJob` jest domyslnie wlaczony, ale **scisle zwiazany z tabela `wave8_agent_schedules`** i logika uruchamiania agenta - to nie jest ogolny tyk zegara. **Piata: ten katalog nie ma ANI JEDNEGO testu.** `server/src/services/resultsVnext/okr/__tests__` nie istnieje. Generator nigdy nie byl przetestowany jednostkowo - **tworzysz pokrycie od zera**, wiec nie masz siatki bezpieczenstwa pod soba. **Szosta: `DB_TYPE` przypiety do `sqlite` w `vitest.config.ts:210` (korzen). `server/vitest.config.ts` naprawiony dyzurem 167 i honoruje juz linie komend, **root config NIE**. W raporcie napisz WPROST, jakiego configu uzyles i gdzie lezy**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day169-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day169-cele-checkin-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`pozycje R2 i R3 - wpiecie generatora okien w OBIE sciezki aktywacji oraz dowod, ze check-in wykonuje sie bez recznego uruchamiania czegokolwiek skryptem`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6060` albo `5008 i 5009` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6060` albo `5008 i 5009`** (`Z7`).

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

Dyżur zlecony wprost przez właściciela 2026-08-30, jako **DYŻUR B** z dwóch dyżurów
priorytetowych toru funkcji (`docs/program/KOORDYNACJA.md`, sekcja „DYŻUR B — cel: nikt nie
tworzy okien check-inu”, w kontekście pomiaru „POMIAR MECHANIKI: wskaźniki, cele i ROI”).
Właściciel uznał go za **ważniejszy niż cokolwiek graficznego** — bez niego cel jest ładny i
nieużywalny.

Pomiar nadzorcy, potwierdzony greppem, nie domysłem: `POST .../key-results/:keyResultId/check-ins`
wymaga w ciele `cadenceOccurrenceId` — pole `z.string().uuid()`, **bez `.optional()`**
(`server/src/validators/resultsVnextOkr.validators.ts:546`). Żadna trasa serwera nie zwraca
listy okien czasowych, z których zwykły użytkownik mógłby ten identyfikator wziąć — grep po
`checkin_occurrences`/`CadenceOccurrence`/`cadence-occurrences` w
`server/src/routes/resultsVnext/okr.routes.ts` **nie daje ani jednego trafienia**. Zwykły
użytkownik nie ma drogi do check-inu. Robotnik drugiego toru musiał wywołać generator ręcznie
osobnym skryptem, żeby w ogóle przetestować łańcuch KR → check-in → rollup.

Przyczyna jest jedna, zweryfikowana greppem: funkcja
`generateCadenceOccurrencesAndSeedCheckInObligations`
(`server/src/services/resultsVnext/okr/okrCheckInScheduler.ts:64`) — ta, która przekłada
zadeklarowaną częstotliwość check-inów na realne okna czasowe (`okr_vnext_checkin_occurrences`)
i zasiewa z nich obowiązki (`rvn_platform_obligations`) — **nie ma ani jednego wywołania w
uruchomionej aplikacji**. Grep po jej nazwie w całym `server/src/` poza jej własną definicją
zwraca wyłącznie dwa komentarze projektowe: `server/src/services/resultsVnext/okr/okrCycleScheduler.ts:279`
i nagłówek sekcji w tym samym pliku, `okrCheckInScheduler.ts:31`. Zero wywołań w kodzie
wykonywanym. Katalog `server/src/services/resultsVnext/okr/` **nie ma nawet podkatalogu
`__tests__`** — funkcja nie jest tylko niewpięta, jest też nieprzetestowana na żadnym poziomie.

★ To jest **jedenasty kształt fałszywego gotowe**, nazwany w tym programie 30.08: **biblioteka
bez wywołania**. Kod istnieje, ma komplet typów, ma docstring odsyłający do design §8.2/§8.3,
cytuje decyzję P10 z `OKR_E004_DESIGN.md`, wygląda na gotowy produkt — i nikt go nigdy nie
uruchamia poza testem jednostkowym, którego zresztą też nie ma. Różni się od siódmego kształtu
(„wołacz istnieje ≠ renderuje się” — komponent frontendowy nigdy niewyrenderowany) tym, że tu
nie ma nawet wołacza po stronie backendu: żaden route, żaden cron, żaden inny serwis jej nie
importuje do wywołania (import w `okrCheckInScheduler.ts` samej siebie się nie liczy).

Drugie ustalenie nadzorcy z tego samego pomiaru, na tej samej sesji: postęp celu **działa sam** —
`set_rollup(equal_average)` przelicza `overall_progress`/`attention_state` z kluczowych
rezultatów bez ręcznego wpisywania. To jest zmierzone, potwierdzone mutacyjnie, i **nie wolno
tego ruszać** w tym dyżurze — jedyny powód, dla którego cel „prawie działa”, to właśnie ten
kawałek.

Trzecie ustalenie, osobne od check-inu: wiązanie kluczowego rezultatu ze wskaźnikiem albo
inicjatywą (`sourceReference`) jest **wyłącznie opisowe z rozmysłem projektowym, nie z
zaniedbania** — `docs/product/results-vnext/OKR_E003_DESIGN.md:445` mówi to wprost w komentarzu
przy kolumnie: `source_reference TEXT NULL, -- opaque string; NEVER a live FK to
kpi_*/rvn_kpi_*/initiative_kpis`. To jest AC-012, „isolating AC” epiki E004
(`okrCheckInSuggestionService.ts:1-30`), zbudowana specjalnie po to, by zablokować powrót
znanego defektu legacy (`okrService.ts::getSuggestedValueForKeyResult` czytające
`kpi_time_series` wprost). W UI to pole to zwykły `<input type="text">`
(`src/components/ResultsVNext/okr/OkrKeyResultFormModal.tsx:528-531`) — użytkownik może wpisać
cokolwiek, nic tego nie waliduje, nic z tego nie napędza rollupu ani żadnej automatyzacji. To
osobna, świadoma decyzja projektowa, nie luka do naprawy — **w tym dyżurze wyłącznie mierzysz
zasięg i opisujesz w raporcie jako pozycję do decyzji właściciela**, nie zmieniasz kodu.

## Czym ten dyżur NIE jest

Nie jest naprawą rollupu postępu — `okrSetRollupCalculator.ts`/`applySetRollupUpdate` działają i
są zmierzone; jedyny dozwolony kontakt z tym kodem jest przez istniejące, niezmodyfikowane
wywołanie wewnątrz `detectAndFlagMissedCheckIns` (`okrCheckInScheduler.ts:185`), którego też nie
zmieniasz. Nie jest naprawą `sourceReference` — to osobna decyzja właściciela, mierzysz i
opisujesz, nie kodujesz obejścia ani walidacji FK. Nie jest DYŻUREM A (wskaźnik: brak trasy
publikującej politykę widoczności, `409 NO_ACTIVE_VISIBILITY_POLICY`) — to równoległy, osobny
dyżur tego samego programu, inny plik, inny robotnik. Nie jest budową trzeciego mechanizmu
harmonogramowania — zanim napiszesz choćby jedną linię nowego crona, masz dowód, że
`agentPlanSchedulerJob` i `wave8AgentScheduleJob` się nie nadają (patrz R2). Nie jest zmianą
`server/src/workers/**` ani `server/src/cron/Scheduler.ts` — to terytorium dyżuru 165; czytać
wolno, zmieniać nie, a jeśli dojdziesz do wniosku, że bez zmiany w `Scheduler.ts` się nie da,
**zatrzymujesz się i pytasz**, nie obchodzisz zakazu przez np. nowy plik importowany z niego.
Nie jest zmianą niczego pod `server/src/services/resultsVnext/kpi/**` — terytorium dyżuru 168.
Nie jest osłabieniem wymogu `cadenceOccurrenceId` w `RecordOkrCheckInSchema` — okno ma być
realne, nie opcjonalne.

# 2. TEZY ZLECENIA

- **T1.** Check-in jest dziś niewykonalny drogą produkcyjną — nie dlatego, że walidacja jest za
  ostra, tylko dlatego, że nic po drugiej stronie nie produkuje wartości, której walidacja
  wymaga. Naprawa polega na wypełnieniu okna, nie na rozluźnieniu wymogu.
- **T2.** `generateCadenceOccurrencesAndSeedCheckInObligations` jest bibliotekowo kompletna —
  ma test do napisania, nie logikę do przepisania. Weryfikacja własnym czytaniem: liczy okna z
  `active_start_at` do `final_update_due_at` na podstawie przypiętej migawki polityki cyklu
  (`okrCycleScheduler.ts:295-350`, `computeCadenceWindows`), wstawia je idempotentnie
  (`ON CONFLICT (cycle_id, window_start) DO NOTHING`), i zasiewa obowiązki `check_in` dla KR-ów
  należących do **aktywnych** Setów (`s.status = 'active'`, `okrCheckInScheduler.ts:86`).
  Zadanie R2 to ją WYWOŁAĆ we właściwym momencie, nie przepisać.
- **T3.** Cykl życia Programu → Cyklu → Setu → Celu → KR → check-in ma DWA niezależne miejsca
  aktywacji, nie jedno: Cykl aktywuje się przez `POST /cycles/:cycleId/activate`
  (`okr.routes.ts:857`, `drafting → active`, spec `OKR_CYCLE_ACTIVATE_SPEC`,
  `okrCycleCommands.ts:489-494`), a Set aktywuje się NIEZALEŻNIE przez
  `POST /sets/:setId/activate` (`okr.routes.ts:1376`, `approved → active`, spec
  `OKR_SET_ACTIVATE_SPEC`, `okrSetCommands.ts:1358-1363`). Nic w kodzie nie wymusza kolejności
  między nimi — Set może aktywować się PRZED aktywacją Cyklu albo DŁUGO PO niej (typowy przepływ:
  Cykl aktywuje się raz, Setów przybywa i każdy jest zatwierdzany osobno w kolejnych dniach).
  Zmierz to zanim zdecydujesz, gdzie wpiąć generator — jedno miejsce aktywacji nie wystarcza,
  jeśli chcesz pokryć oba porządki.
- **T4.** ★ Odkryta pułapka w samej funkcji, którą R2 musi rozstrzygnąć, nie przeoczyć:
  `generateCadenceOccurrencesAndSeedCheckInObligations` zasiewa obowiązki WYŁĄCZNIE dla okien z
  `generated.createdOccurrenceIds` — okien UTWORZONYCH W TYM SAMYM WYWOŁANIU
  (`okrCheckInScheduler.ts:70-72`: jeśli `createdOccurrenceIds.length === 0`, funkcja zwraca
  `obligationsSeeded: 0` i kończy, nie dotykając istniejących okien). Ponieważ
  `generateCadenceOccurrences` materializuje WSZYSTKIE okna Cyklu od razu, w jednym przebiegu
  (`okrCycleScheduler.ts:296-303`: „from `active_start_at` through `final_update_due_at`” —
  nie ma pojęcia „kolejne okno w przyszłości”), drugie i każde następne wywołanie dla tego
  samego Cyklu zwróci `createdOccurrenceIds: []` (wszystkie okna już istnieją, `ON CONFLICT DO
  NOTHING`). Skutek: jeśli wpięcie ograniczy się do samej aktywacji Cyklu, KR należący do Setu,
  który aktywuje się PÓŹNIEJ, **nie dostanie ANI JEDNEGO obowiązku check-inu, na zawsze** — bo w
  momencie jedynego wywołania z niepustym `createdOccurrenceIds` ten Set jeszcze nie był
  aktywny, a żadne kolejne wywołanie już nie ma nowych okien do przetworzenia. To jest gotowy,
  ukryty drugi wariant tego samego objawu — R2 ma go rozstrzygnąć jawnie, nie zignorować, bo
  inaczej dyżur wygląda na zamknięty, a w praktyce działa tylko dla Setów aktywnych w chwili
  aktywacji Cyklu.
- **T5.** `createObligation` jest idempotentna przez `ON CONFLICT (organization_id,
  deduplication_key) DO NOTHING` (`server/src/services/resultsVnext/platform/obligations.ts:99`),
  a klucz deduplikacji w `okrCheckInScheduler.ts:101` zawiera `cadence_occurrence_id` — więc
  jakikolwiek dodatkowy przebieg zasiewania obowiązków dla ISTNIEJĄCYCH okien (nie tylko nowo
  utworzonych) jest z natury bezpieczny do wielokrotnego wywołania. To otwiera R2 furtkę: da się
  rozszerzyć krok zasiewania, żeby przy aktywacji Setu zasiał obowiązki po WSZYSTKICH już
  istniejących oknach Cyklu dla KR-ów tego Setu, bez ryzyka duplikatu.

# 3. POZYCJE DYŻURU

## R1 — mapa cyklu życia PRZED naprawą

Prześledź i udokumentuj z plik:linia cały łańcuch: Program → Cykl → Set → Cel/KR → check-in.
Dla każdego ogniwa zapisz: co je dziś uruchamia (trasa HTTP / funkcja / cron), czy istnieje, czy
jest realnie wołane. Konkretnie zweryfikuj i wpisz do mapy:

- Aktywacja Cyklu: `POST /cycles/:cycleId/activate` → `mountTransitionRoute`
  (`okr.routes.ts:805-849`, chroniona `requireAdminWrite = requireOrgRole('admin',
  'superadmin')`, `okr.routes.ts:488`) → `runOkrCycleLifecycleTransition`
  (`okrCycleCommands.ts:380`) ze spec `OKR_CYCLE_ACTIVATE_SPEC`. **Ta trasa działa i jest
  wołana przez ludzi.**
- Automatyczna alternatywa aktywacji Cyklu: `proposeAndExecuteDueCycleTransitions`
  (`okrCycleScheduler.ts:92`) — deliberately unwired, design decision P10 wpisana wprost w
  nagłówek pliku (`okrCycleScheduler.ts:1-8`: „wiring an actual periodic trigger is out of
  scope for this epic”). **To NIE jest ten sam defekt co DYŻUR B — to świadoma decyzja
  projektowa poza epiką E004, zostaw ją nietkniętą i wspomnij w raporcie jako obserwację, nie
  jako coś do naprawienia w tym dyżurze.**
- Aktywacja Setu: `POST /sets/:setId/activate` → `mountSetTransitionRoute`
  (`okr.routes.ts:1327-1372`, bramkowana capability `OKR_SET_CAPABILITIES.activate` przez
  `access`/`assertCommandCapability`, nie przez `requireAdminWrite`) →
  `runOkrSetLifecycleTransition` (`okrSetCommands.ts:1253`) ze spec `OKR_SET_ACTIVATE_SPEC`
  (`approved → active`). **Ta trasa też działa i jest niezależna od aktywacji Cyklu (T3).**
- Generowanie okien: `generateCadenceOccurrences` (`okrCycleScheduler.ts:296`) — wywoływana
  WYŁĄCZNIE przez `generateCadenceOccurrencesAndSeedCheckInObligations`
  (`okrCheckInScheduler.ts:64`), która sama nie ma żadnego wywołania (patrz sekcja 1).
- Check-in: `POST /key-results/:keyResultId/check-ins` (`okr.routes.ts:1957`) wymaga
  `cadenceOccurrenceId` (`resultsVnextOkr.validators.ts:546`) — bez istniejącego wiersza w
  `okr_vnext_checkin_occurrences` ten identyfikator nie istnieje nigdzie, skąd użytkownik mógłby
  go pobrać.

**Dowód na czystej bazie:** zasiej Program → Cykl → Set → Cel → KR aż do stanu, w którym Cykl
i Set są `active`, aktywuj OBIE ścieżką HTTP (nie wywołaniem funkcji wewnętrznej), i pokaż
surowym `SELECT COUNT(*) FROM okr_vnext_checkin_occurrences WHERE cycle_id = $1` = 0. To jest
dowód objawu, nie założenie.

**Ukończone, gdy:** masz mapę ogniwo → uruchamiacz → istnieje/wołane (tak/nie) z plik:linia dla
każdego, jawnie odnotowaną pułapkę T4 (Set aktywowany po Cyklu), i dowód SQL z czystej bazy że
dziś okna nie powstają żadną z dwóch ścieżek aktywacji.

## R2 — wpięcie generatora w cykl życia

Zanim napiszesz jedną linię nowego mechanizmu harmonogramowania, sprawdź istniejące wzorce i
udowodnij pisemnie, dlaczego się nadają albo nie:

- **`agentPlanSchedulerJob`** (`server/src/jobs/agentPlanSchedulerJob.ts:72`, wołany co 2 minuty
  z `server/src/cron/Scheduler.ts:878-885` jako `job38`) — bramkowany
  `if (process.env.ENABLE_AI_TASKS_WORKER !== 'true') return`. Ta sama bramka istnieje osobno w
  `server/src/cron/Scheduler.ts:879`. ★ **Ta flaga jest domyślnie WYŁĄCZONA (brak `=== 'false'`,
  jest odwrotna polaryzacja: kod wymaga `=== 'true'` explicite) i NIE WOLNO jej włączać** —
  jeśli wpięcie generatora check-inów trafi za tę bramkę, check-iny nie ruszą u NIKOGO, dopóki
  ktoś ręcznie nie ustawi zmiennej środowiskowej produkcyjnie — czyli powstanie DRUGA biblioteka
  bez wywołania, tylko lepiej ukryta (kod formalnie „wpięty”, ale za flagą, która nigdy nie jest
  `true`). Ten mechanizm w ogóle nie pasuje strukturalnie — dyspatchuje plany agentowe
  (`AGENT_BACKGROUND_TASK`), nie ma nic wspólnego z domeną OKR.
- **`wave8AgentScheduleJob`** (`server/src/jobs/wave8AgentScheduleJob.ts:12`, wołany co minutę z
  `Scheduler.ts:913-921` jako `job40`, bramkowany odwrotnie —
  `if (process.env.AGENT_SCHEDULE_CRON_ENABLED === 'false') return`, czyli domyślnie WŁĄCZONY.
  Pod spodem `processDueWave8AgentSchedules`
  (`server/src/services/wave8AgentRuntimeService.ts:1194`) czyta WYŁĄCZNIE tabelę
  `wave8_agent_schedules` i uruchamia agentów (`canonical_run_id`, leasing, `launchWave8Agent`) —
  to nie jest generyczny „tick”, w który można wstrzyknąć dowolną logikę OKR; żeby użyć tego
  mechanizmu, trzeba by upchnąć harmonogram check-inów jako fałszywy wiersz agentowy, co jest
  nadużyciem cudzej tabeli, nie reużyciem wzorca.
- **Architektoniczny fakt rozstrzygający sprawę:** `generateCadenceOccurrences`
  (`okrCycleScheduler.ts:296-303`) materializuje WSZYSTKIE okna Cyklu od `active_start_at` do
  `final_update_due_at` W JEDNYM PRZEBIEGU — to nie jest funkcja, która „odkrywa kolejne okno w
  miarę upływu czasu” i wymaga cyklicznego dopytywania. Cykliczny tick rozwiązywałby problem,
  którego tu nie ma (nie ma potrzeby „doganiania” nowych okien co jakiś czas dla JEDNEGO Cyklu —
  raz wygenerowane, są kompletne na cały jego czas trwania). Potrzebny jest PUNKT ZDARZENIOWY, nie
  polling.

**Rekomendacja do uzasadnienia w raporcie (nie zakładaj z góry — sprawdź na własnych danych):**
wpięcie w **obie trasy aktywacji, zdarzeniowo, po stronie route'a**, nie crona:
`mountTransitionRoute`'a dla `OKR_CYCLE_ACTIVATE_SPEC` (`okr.routes.ts:823-841`, wywołanie PO
`outcome.outcome === 'applied'`) oraz `mountSetTransitionRoute`'a dla `OKR_SET_ACTIVATE_SPEC`
(`okr.routes.ts:1350-1366`, analogicznie). Dla aktywacji Cyklu: wywołanie
`generateCadenceOccurrencesAndSeedCheckInObligations({ organizationId, cycleId })` bez zmian —
generuje okna i zasiewa obowiązki dla Setów już aktywnych w tej chwili. Dla aktywacji Setu:
musisz rozstrzygnąć T4 — albo rozszerzasz krok zasiewania obowiązków tak, by dla nowo
aktywowanego Setu zasiał obowiązki po WSZYSTKICH już istniejących oknach Cyklu (bezpieczne dzięki
T5 — dedup po `cadence_occurrence_id` w `deduplicationKey`), albo dodajesz sąsiednią,
jednoznacznie nazwaną funkcję do tego samego pliku. Obie ścieżki wywołania mają być
best-effort — błąd zasiewania nie może zablokować samej transakcji aktywacji (Cykl/Set MA się
aktywować, nawet jeśli seeding check-inów akurat padnie; zaloguj i policz błąd, nie przerywaj
odpowiedzi HTTP 200).

Jeśli po zmierzeniu dojdziesz do innego wniosku niż powyższy (np. że jedno miejsce pokrywa oba
przypadki, bo w praktyce Set nigdy nie aktywuje się po Cyklu z powodu jakiegoś nieznanego mi
jeszcze guarda) —
**udowodnij to z kodu i z testu na czystej bazie**, nie z założenia. Jeśli dojdziesz do wniosku,
że jednak trzeba dotknąć `Scheduler.ts` — zatrzymaj się i zgłoś to zamiast wpinać.

**Ukończone, gdy:** masz pisemne uzasadnienie odrzucenia obu istniejących mechanizmów
cyklicznych (z cytatem linii bramki `ENABLE_AI_TASKS_WORKER` i opisem `wave8_agent_schedules`),
nazwane imiennie miejsce/miejsca wpięcia, i jawne rozstrzygnięcie T4 (jak dokładnie Set
aktywowany po Cyklu dostaje obowiązki check-inu).

## R3 — dowód od końca do końca na czystej bazie

Przejdź całą ścieżkę: Program → Cykl → Set → Cel → KR → **check-in BEZ ręcznego wywoływania
czegokolwiek skryptem, wyłącznie żądaniami HTTP jak zrobiłby to prawdziwy użytkownik** → postęp
przeliczony automatycznie przez `set_rollup(equal_average)` (nietknięty, tylko zaobserwowany).
To jest bramka odbioru zapisana przez właściciela wprost w KOORDYNACJA.md — jeśli check-in
wymaga ręcznego kroku, dyżur NIE jest zamknięty, niezależnie od tego, ile testów przechodzi.

Test musi pokryć **oba scenariusze z T3/T4**, osobno, każdy z dowodem SQL:
1. Set aktywowany PRZED aktywacją Cyklu (albo w tej samej sekundzie) — KR dostaje obowiązek
   check-inu, użytkownik pobiera `cadenceOccurrenceId` (z odpowiedzi trasy zasiewającej albo z
   istniejącej trasy listującej — sprawdź czy taka jest, a jeśli nie ma żadnej trasy zwracającej
   okna, to osobny brak do odnotowania w raporcie, nie do naprawienia w tym dyżurze, chyba że
   jest niezbędny do zamknięcia bramki odbioru — wtedy zgłoś to jako rozszerzenie zakresu i
   zatrzymaj się przed zbudowaniem czegoś poza tabelą licencji), i wykonuje `POST
   .../check-ins` ze zwykłej trasy produkcyjnej.
2. Set aktywowany PO aktywacji Cyklu (np. Cykl aktywuje się, potem mija czas, potem Set
   przechodzi `approved → active`) — KR TEGO Setu również dostaje obowiązek check-inu. Jeśli
   ten scenariusz nie przechodzi, dyżur nie jest ukończony, nawet jeśli scenariusz 1 przechodzi
   bezbłędnie — to jest dokładnie ten rodzaj częściowej naprawy, który program już raz nazwał
   fałszywym gotowe.

Dowód z bazy surowym SQL na `okr_vnext_checkin_occurrences` i `rvn_platform_obligations` przed i
po każdym kroku, nie ze statusu HTTP.

**Ukończone, gdy:** masz dwa niezależne przebiegi (scenariusz 1 i 2), każdy z: żądaniami HTTP
identycznymi z tym, co zrobiłby użytkownik produkcyjny (żadnego wywołania funkcji serwisowej
wprost z testu, żadnego skryptu obchodzącego trasy), `SELECT` przed/po pokazującym powstanie
okna i obowiązku, i finalnym `POST .../check-ins` kończącym się `2xx`, po którym rollup Setu/Celu
zmienia się widocznie w bazie bez ręcznej ingerencji.

## R4 — dowód mutacyjny

Zepsuj celowo wpięcie generatora (np. usuń tymczasowo wywołanie z trasy aktywacji Cyklu albo
Setu), uruchom test z R3 i pokaż, że pada dokładnie w tym miejscu, którego się spodziewasz (brak
okna / brak obowiązku / `400`/`404` na `cadenceOccurrenceId` nieistniejącym w bazie) — nie
gdziekolwiek indziej z niepowiązanego powodu. Przywróć wpięcie, pokaż zielony test i czyste
drzewo git (`git status --short` puste poza plikami z tabeli licencji).

**Ukończone, gdy:** masz log/log-fragment czerwonego przebiegu z podciętym wpięciem, log
zielonego przebiegu po przywróceniu, i `git status --short` bez niespodzianek.

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY169_CELE_CHECKIN_REPORT.md` |
| Zapis | `server/src/services/resultsVnext/okr/okrCheckInScheduler.ts` (rozszerzenie zasiewania obowiązków pod T4 — addytywnie, bez zmiany istniejącego zachowania `generateCadenceOccurrencesAndSeedCheckInObligations` dla Setów już aktywnych) |
| Zapis | `server/src/routes/resultsVnext/okr.routes.ts` — wywołanie generatora wewnątrz `mountTransitionRoute` (spec `OKR_CYCLE_ACTIVATE_SPEC`, linie ok. 823-841) i `mountSetTransitionRoute` (spec `OKR_SET_ACTIVATE_SPEC`, linie ok. 1350-1366), best-effort, po `outcome.outcome === 'applied'` |
| Zapis | test `server/src/services/resultsVnext/okr/__tests__/day169.checkin-windows.pg.test.ts` (katalog `__tests__` tu jeszcze nie istnieje — utworzysz go) |
| Zapis | migracja WYŁĄCZNIE `server/migrations/20260830_day169_okr_cadence_windows.sql`, i tylko jeśli pomiar w R1/R2 wykaże realną potrzebę schematu — wszystkie zaangażowane tabele (`okr_vnext_checkin_occurrences`, `rvn_platform_obligations`, `okr_vnext_sets`, `okr_vnext_cycles`) już istnieją z wcześniejszych migracji (`20260825_rvn_okr_checkin.sql`, `20260811_rvn_platform_obligations.sql`, `20260822_rvn_okr_program_cycle.sql`) — jeśli wpięcie nie wymaga nowej kolumny, NIE twórz tego pliku i napisz to wprost w raporcie |
| Odczyt | `server/src/services/resultsVnext/okr/okrCycleScheduler.ts` — `generateCadenceOccurrences`, `proposeAndExecuteDueCycleTransitions` (nie zmieniasz) |
| Odczyt | `server/src/services/resultsVnext/okr/okrCycleCommands.ts` — `runOkrCycleLifecycleTransition`, `OKR_CYCLE_ACTIVATE_SPEC` |
| Odczyt | `server/src/services/resultsVnext/okr/okrSetCommands.ts` — `runOkrSetLifecycleTransition`, `OKR_SET_ACTIVATE_SPEC` |
| Odczyt | `server/src/services/resultsVnext/platform/obligations.ts` — `createObligation` (dedup, nie zmieniasz) |
| Odczyt | `server/src/validators/resultsVnextOkr.validators.ts` — `RecordOkrCheckInSchema` (nie osłabiasz `cadenceOccurrenceId`) |
| Odczyt | `server/src/jobs/agentPlanSchedulerJob.ts`, `server/src/jobs/wave8AgentScheduleJob.ts`, `server/src/services/wave8AgentRuntimeService.ts` — wzorce do odrzucenia/uzasadnienia w R2, nie zmieniasz |
| Odczyt | `server/src/cron/Scheduler.ts` — wyłącznie odczyt (`job38`, `job40`), zakaz zmian, patrz sekcja „Czym ten dyżur NIE jest” |
| Odczyt | `server/scripts/migrationOrdering.ts` (`sortMigrationsDeterministically`), `server/scripts/migrate.postgres.ts:853` |
| Odczyt | `docs/product/results-vnext/OKR_E003_DESIGN.md`, `OKR_E004_DESIGN.md` — kontekst D09/P10, `sourceReference` |
| Odczyt | `src/components/ResultsVNext/okr/OkrKeyResultFormModal.tsx` — dowód że `sourceReference` to wolny tekst (linia pomiaru R-drugiego-znaleziska) |

★ ROZŁĄCZNOŚĆ (obowiązuje jawnie): równolegle biegną 163 (zadania), 165 (agent), 166 (decyzje),
167 (konfiguracja i testy), 168 (wskaźniki/KPI). **Nie dotykasz niczego pod
`server/src/services/resultsVnext/kpi/**`.** **Nie dotykasz `server/src/workers/**` ani
`server/src/cron/Scheduler.ts` w zakresie zmian** — czytać wolno, zmieniać nie; jeśli wpięcie
wymaga zmiany w `Scheduler.ts`, **zatrzymujesz się i pytasz**, to terytorium dyżuru 165. Nie
dotykasz `okrSetRollupCalculator.ts` ani logiki `applySetRollupUpdate` — działa, jest zmierzona,
nienaruszalna w tym dyżurze. Nie dodajesz walidacji/FK dla `sourceReference` — to terytorium
osobnej decyzji właściciela.

# 5. BRAMKI ODBIORU

- **B1.** R1 ma kompletną mapę ogniw z plik:linia i dowód SQL z czystej bazy, że dziś żadna z
  dwóch tras aktywacji nie tworzy okien check-inu.
- **B2. Zero osłabienia walidacji.** `cadenceOccurrenceId` w `RecordOkrCheckInSchema`
  (`resultsVnextOkr.validators.ts:546`) pozostaje `z.string().uuid()` bez `.optional()` — diff
  dyżuru nie dotyka tego wiersza inaczej niż przez brak zmiany.
- **B3. Brak trzeciego mechanizmu harmonogramowania.** Raport ma pisemne, imienne uzasadnienie
  odrzucenia `agentPlanSchedulerJob` (cytat bramki `ENABLE_AI_TASKS_WORKER !== 'true'`,
  `agentPlanSchedulerJob.ts:72` i `Scheduler.ts:879`) i `wave8AgentScheduleJob` (opis sprzężenia
  z tabelą `wave8_agent_schedules`) — diff nie dodaje nowego wpisu `cron.schedule(...)` w
  `Scheduler.ts`.
- **B4. Rozstrzygnięcie T4 udowodnione, nie zadeklarowane.** Scenariusz „Set aktywowany po
  Cyklu” z R3 kończy się realnym obowiązkiem check-inu w bazie — nie samym stwierdzeniem w
  raporcie, że „powinno działać”.
- **B5. Dowód end-to-end wyłącznie żądaniami HTTP.** R3 nie zawiera ani jednego bezpośredniego
  wywołania `generateCadenceOccurrencesAndSeedCheckInObligations`/`recordCheckIn` z poziomu
  testu z pominięciem trasy HTTP — cała ścieżka idzie przez `supertest`/realny Gateway, tak jak
  poszedłby użytkownik.
- **B6. Rollup nietknięty.** Diff dyżuru nie zawiera zmian w `okrSetRollupCalculator.ts` ani w
  ciele `applySetRollupUpdate` — wywołanie w `detectAndFlagMissedCheckIns` pozostaje
  bajt-w-bajt identyczne.
- **B7. `sourceReference` zmierzony, nie naprawiony.** Raport ma sekcję z zasięgiem (gdzie pole
  jest wolnym tekstem, gdzie się wyświetla, że nic go nie waliduje) i rekomendacją dla
  właściciela — diff dyżuru nie dodaje żadnej walidacji/FK dla tego pola.
- **B8. Migracja tylko jeśli potrzebna, i poprawna jeśli powstanie.** Jeśli migracja
  `20260830_day169_okr_cadence_windows.sql` powstanie: przechodzi pełny przebieg od PUSTEJ bazy
  przez `sortMigrationsDeterministically` (nie `files.sort()`), ma strażnik
  `ADD COLUMN IF NOT EXISTS` jeśli czyta nową kolumnę, i wynik `scripts/dev/day161-fresh-migration-check.sh`
  jest wklejony w raporcie. Jeśli migracja NIE powstanie, raport mówi to wprost i uzasadnia
  dlaczego istniejący schemat pokrył potrzebę bez zmiany.
- **B9. Configi vitest ujawnione.** Raport wprost podaje, którego configu użyto do testu
  `day169.*.pg.test.ts` i cytuje `DB_TYPE: 'sqlite'` z `server/vitest.config.ts:17` oraz
  `vitest.config.ts:210` jako pułapkę, której się uniknęło (nie `No test files found` uznane za
  `PASS`).
- **B10. R4 udokumentowane.** Czerwony przebieg z podciętym wpięciem, zielony po przywróceniu,
  czyste `git status --short`.
- **B11. Sekcja „TWIERDZENIA NIEZWERYFIKOWANE” obecna** w raporcie końcowym, wymieniająca
  wszystko, czego nie zdążono sprawdzić bezpośrednio (np. zachowanie na demo/staging, których
  ten dyżur nie dotyka i dotykać nie może).
