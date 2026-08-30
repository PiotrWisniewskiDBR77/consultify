# INSTRUKCJA DYŻURU nr 170 — Codex — „Uzytkownik nadal nie moze zrobic check-inu - brakuje trasy odczytu okien i listy wyboru"

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
> **wyłącznie** `/private/tmp/cx-day170-okna-checkin`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `514c60b355`**
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
Zakres: **Wyniki - cele (OKR), odczyt okien check-inu i wybor okna w formularzu**.
Trasy front: ``src/components/ResultsVNext/okr/OkrCheckInRecordDialog.tsx` i `src/components/ResultsVNext/okr/okrCheckInApi.ts``. Trasy tył: ``server/src/routes/resultsVnext/okr.routes.ts` oraz `server/src/services/resultsVnext/okr/okrCheckInSummaryRepository.ts``.

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
WT=/private/tmp/cx-day170-okna-checkin
MARKER=514c60b355

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day170-okna-checkin-20260830 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day170-okna-checkin/config.worktree"
cat "$VAULT/worktrees/cx-day170-okna-checkin/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day170-okna-checkin-scratch
mkdir -p /private/tmp/cx-day170-okna-checkin-artefakty

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
git -C "$VAULT" log --oneline 514c60b355..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only 514c60b355..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day170-okna-checkin-20260830
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 514c60b355..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `cztery` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day170-okna-checkin

# (T1) BRAK TRASY ODCZYTU - potwierdz sam
grep -n "checkin_occurrences\|cadence-occurrences" server/src/routes/resultsVnext/okr.routes.ts
#   oczekiwane: JEDYNE trafienie to body.cadenceOccurrenceId w handlerze zapisu.
#   Zero tras GET listujacych okna.

# (T2) FRONT SAM TO PRZYZNAJE
sed -n '6,20p' src/components/ResultsVNext/okr/OkrCheckInRecordDialog.tsx
sed -n '10,35p' src/components/ResultsVNext/okr/okrCheckInApi.ts
#   oczekiwane: dwa dlugie komentarze 'HONEST GAP' / 'REAL, CONFIRMED GAP'.
#   ★ Autor SWIADOMIE odrzucil crypto.randomUUID() jako wypelniacz - nie psuj tego wyboru.

# (T3) CO JUZ ISTNIEJE - polowa roboty moze byc zrobiona
grep -n "checkin_occurrences" server/src/services/resultsVnext/okr/okrCheckInSummaryRepository.ts
#   oczekiwane: TRZY predykaty SQL (zlaczenie key_results -> sets -> occurrences,
#   wykluczenie okien z istniejacym check-inem). Licza AGREGATY, nie wyliczaja wierszy.
#   Nadaja sie do przepisania na enumeracje. NIE BUDUJ ICH OD NOWA.

# (T4) WZORZEC TRASY DO NASLADOWANIA
grep -n "key-results/:keyResultId" server/src/routes/resultsVnext/okr.routes.ts | head -4
#   oczekiwane: istniejace trasy per kluczowy rezultat. Skopiuj ich schemat
#   autoryzacji i zakresu organizacji - nie wymyslaj wlasnego.
```

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day170-okna-checkin-20260830` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6068`. Twój JEDYNY port harnessu to `5010 i 5011`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day170-pg`**. **ZAKAZANE:** `6012, 5433, 6047 i 6054-6055 oraz 6061-6067 (odbiory nadzorcy), 6051/4994-4995 (163), 6056/4998-4999 (165), 6069/5012-5013 (171), 6070/5014-5015 (172), 6071/5016-5017 (173). ★ PORT 5000 ZAJETY NA STALE przez macOS Control Center`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak - ten dyzur NIE wprowadza ani jednej nowej flagi i NIE zmienia wartosci domyslnej zadnej istniejacej`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY170_OKNA_CHECKIN_REPORT.md`. Nie zmieniasz zadnego `MODULE_ACCEPTANCE.md`. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day170-okna-checkin-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day170-okna-checkin-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **NIE OSLABIASZ WYMOGU `cadenceOccurrenceId`.** Pole zostaje **wymagane** w walidatorze (`resultsVnextOkr.validators.ts`, `z.string().uuid()`). Naprawa polega na **daniu uzytkownikowi realnej wartosci do wyboru**, a nie na uczynieniu pola opcjonalnym, nadaniu mu wartosci domyslnej ani tworzeniu okna w locie przy zapisie check-inu. ★★ **NIE FABRYKUJESZ IDENTYFIKATOROW.** Zero `crypto.randomUUID()` jako wypelniacza. Serwer przyjalby taka wartosc po cichu i powstalby check-in wobec okna, ktorego **nigdy nie zaplanowano** - czyli uszkodzenie danych. Autor obecnego komentarza swiadomie tego uniknal; **nie psuj tego wyboru**. **NIE RUSZASZ `okrCheckInScheduler.ts`** - zasiewanie okien jest zrobione i odebrane dyzurem 169. **NIE RUSZASZ logiki rollupu postepu** (`set_rollup(equal_average)`). **ZAKAZ ZMIANY WYGLADU poza jednym polem** - zamiana pola tekstowego na liste wyboru to jedyna dozwolona zmiana wizualna. Zero zmian ukladu, kolorow, typografii i pozostalych tekstow. **Zero polaczen do bazy zdalnej, demo, stagingu i produkcji.** | Dyzur 169 naprawil backend - okna sa zasiewane poprawnie w OBU kolejnosciach aktywacji, poza jakakolwiek flaga. **Ale cel wlasciciela nie zostal osiagniety** i odbior dostal ocene **D** na tej osi: nie istnieje ZADNA trasa GET eksponujaca okna, wiec pole `cadenceOccurrenceId` w formularzu jest zwyklym polem tekstowym na recznie wklejony UUID. Wlasciciel kluczowego rezultatu, robiacy check-in tygodnie po aktywacji, nie ma go skad wziac |

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
cd /private/tmp/cx-day170-okna-checkin

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day170-pg psql -U postgres -d cx170 \
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
cd /private/tmp/cx-day170-okna-checkin

docker run -d --name cx-day170-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx170 \
  -p 127.0.0.1:6068:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day170-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6068/cx170 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6068/cx170 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day170-okna-checkin && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6068/cx170 \
JWT_SECRET=cx170-test-secret-do-not-reuse \
npx vitest run server/src/routes/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day170-okna-checkin-artefakty/day170-vitest.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day170-okna-checkin && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/routes/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day170-okna-checkin-artefakty/day170-vitest.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day170-okna-checkin/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day170-pg psql -U postgres -d cx170 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day170-pg`.
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
> **(e) **Pierwsza: polowa roboty JUZ ISTNIEJE, ale nie tam, gdzie sie wydaje.** `okrCheckInSummaryRepository.ts` (284 linie) **nie ma listy okien** - liczy agregaty per kluczowy rezultat (`OVERDUE`/`DUE`/`CURRENT`/`UNKNOWN`, jeden `nextExpectedAt`, jeden `lastCheckIn`). **Gotowe sa natomiast TRZY predykaty SQL**: zlaczenie kluczowych rezultatow z zestawami i oknami oraz wykluczenie okien z istniejacym oryginalnym check-inem. **Przepisz je na enumeracje wierszy zamiast agregacji - nie pisz ich od nowa.** **Druga: trasa powinna byc per KLUCZOWY REZULTAT, nie per zestaw** - dialog operuje na jednym kluczowym rezultacie, a w `okr.routes.ts` **istnieje juz wzorzec** takich tras (`GET .../key-results/:keyResultId/check-ins`, `.../suggested-next-check-in-value`). Skopiuj ich schemat autoryzacji. Wariant per zestaw jest dopuszczalny **wylacznie z jawnym uzasadnieniem** z pomiaru R1. **Trzecia, techniczna: `window_start` i `window_end` w `okr_vnext_checkin_occurrences` to kolumny typu `DATE`, NIE `TIMESTAMPTZ`.** To ma znaczenie dla definicji 'okno biezace' - porownanie ze znacznikiem czasu da inny wynik niz porownanie z data. Sprawdz to, zanim napiszesz warunek. **Czwarta: komentarze 'HONEST GAP' staja sie NIEPRAWDA po Twojej naprawie.** Sa dwa - w `OkrCheckInRecordDialog.tsx:6-20` i w naglowku `okrCheckInApi.ts:10-35`. **Zaktualizuj OBA.** Nieaktualny komentarz jest gorszy niz jego brak, bo nastepny czytelnik uwierzy w luke, ktorej juz nie ma. **Piata: `DB_TYPE` przypiety do `sqlite` w `vitest.config.ts:210` ORAZ w `server/vitest.config.ts:17` (ten drugi naprawiony dyzurem 167 i honoruje juz linie komend). **W raporcie napisz WPROST, jakiego configu uzyles i gdzie lezy** - dyzur 168 zrobil to wzorowo, 162 przemilczal i audytor nie mogl odtworzyc przebiegu**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day170-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day170-okna-checkin-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`pozycje R2 i R3 - trasa odczytu okien oraz podlaczenie jej jako zrodla wyboru w formularzu check-inu`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6068` albo `5010 i 5011` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6068` albo `5010 i 5011`** (`Z7`).

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

Dyżur 169 naprawił kolejność zasiewania: aktywacja Cyklu i aktywacja Setu, **w dowolnej
kolejności**, produkują teraz realne wiersze w `okr_vnext_checkin_occurrences` i realne
obowiązki check-inu (`okrCheckInScheduler.ts`). To był krok wewnątrz serwera — nikt z zewnątrz
tego jeszcze nie widzi.

Odbiór 169 dostał **D** na osi celu właściciela, bo cel właściciela nigdy nie brzmiał „niech
baza ma wiersze" — brzmiał „niech użytkownik klikający Kluczowy Rezultat tygodnie po aktywacji
umie zrobić check-in". Naprawiony backend bez trasy odczytu to naprawa, której nikt nie może
użyć. Front (`src/components/ResultsVNext/okr/OkrCheckInRecordDialog.tsx:6-20`) mówi to wprost,
własnym komentarzem:

> „HONEST GAP — `cadenceOccurrenceId` has no picker source... no route anywhere in
> `okr.routes.ts` exposes `okr_vnext_checkin_occurrences`, so there is no real endpoint this
> form could call to populate a dropdown"

Pole `cadenceOccurrenceId` jest dziś zwykłym tekstowym inputem (`OkrCheckInRecordDialog.tsx:219-227`,
`data-testid="okr-checkin-cadence"`) z podpisem „wklej ręcznie". Sprawdzone na markerze
`514c60b355`: `git grep -n "checkin_occurrences" server/src/routes/resultsVnext/okr.routes.ts`
nie zwraca żadnej trasy `GET` — plik ma **3553 linie** i **62 rejestracje tras**, żadna nie
eksponuje tej tabeli. Jedyne miejsce, gdzie identyfikator okna w ogóle wypływa na zewnątrz, to
pole `checkInSeeding.cadenceOccurrenceIds` w odpowiedzi tras aktywacyjnych (`okr.routes.ts:865`,
`okr.routes.ts:1405`) — jednorazowy zrzut w chwili aktywacji, nieprzydatny tydzień później.

★ **Dobra praktyka do zachowania, nie do naprawienia:** autor `OkrCheckInRecordDialog.tsx` i
`okrCheckInApi.ts` **świadomie odrzucił** wypełnienie pola przez `crypto.randomUUID()` —
argument w komentarzu: serwer przyjąłby taką wartość jako identyfikator okna, którego
harmonogram nigdy nie wygenerował, czyli fabrykację danych pod przykrywką działającego UI.
Wybrano jawną, opisaną lukę zamiast cichego wypełniacza. **Nowa naprawa ma dać realne dane z
`okr_vnext_checkin_occurrences`, a nie usunąć ostrzeżenie i wstawić coś, co wygląda na
rozwiązane, a nie jest.**

## Czym ten dyżur NIE jest

Nie jest zmianą zasiewania okien — mechanizm z dyżuru 169 (`okrCheckInScheduler.ts`,
`generateCadenceOccurrencesAndSeedCheckInObligations`) jest zmierzony i odebrany, dostaje status
nietykalny imiennie. Nie jest zmianą walidatora `RecordOkrCheckInSchema` poza ewentualnym
dopisaniem nowego, osobnego schematu dla trasy odczytu — pole `cadenceOccurrenceId` w
istniejącym schemacie zapisu (`resultsVnextOkr.validators.ts:548`) zostaje `z.string().uuid()`
wymagane, tak jak jest. Nie jest przeprojektowaniem rollupu postępu (`set_rollup(equal_average)`)
ani logiki `staleness` w `okrCheckInSummaryRepository.ts` — ten plik czytasz w całości (284
linie), bo połowa potrzebnych predykatów SQL już tam istnieje w innej postaci, ale go nie
zmieniasz. Nie jest pracą nad Wynikami/Finansami (`server/src/services/resultsVnext/kpi/**`,
`src/components/Economics/**`) ani nad higieną — to terytorium dyżurów 171 i 173, biegnących
równolegle.

# 2. TEZY ZLECENIA

- **T1.** Dane potrzebne do wypełnienia listy okien check-inu w dużej części już istnieją w
  bazie i w części już istnieją w kodzie repozytorium (`okrCheckInSummaryRepository.ts` liczy
  „next due” i „overdue” per Kluczowy Rezultat identycznymi predykatami SQL) — brakuje wyłącznie
  warstwy HTTP + klienta + podłączenia formularza, nie nowej logiki domenowej.
- **T2.** `okr_vnext_checkin_occurrences` jest zasobem **per-Cykl**, nie per-Kluczowy-Rezultat
  (`window_start`/`window_end` żyją na poziomie Cyklu, `okr_vnext_checkin_occurrences.cycle_id` —
  migracja `20260822_rvn_okr_program_cycle.sql:155-164`) — trasa odczytu musi to uszanować:
  zwraca okna Cyklu Setu, do którego należy dany Kluczowy Rezultat, wzbogacone o to, czy AKURAT
  TEN Kluczowy Rezultat ma już do nich oryginalny (nie-korygujący) check-in.
- **T3.** Wymóg pola `cadenceOccurrenceId` w walidatorze zapisu jest poprawny i zostaje —
  problem nie jest w tym, że pole jest wymagane, tylko w tym, że użytkownik nie ma skąd wziąć
  wartości. Naprawa adresuje wyłącznie stronę podaży danych, nigdy stronę wymogu.
- **T4.** Fabrykacja identyfikatora (losowy UUID, tworzenie okna w locie przy zapisie) jest
  gorsza niż brak funkcji — koszt cichego uszkodzenia danych check-inu jest wyższy niż koszt
  jawnej, opisanej luki, którą dyżur 169/poprzednicy już świadomie zaakceptowali.

# 3. POZYCJE DYŻURU

## R1 — pomiar, zanim cokolwiek zbudujesz

Zanim napiszesz jedną linię trasy, ustal z plik:linia:

- Dokładny kształt `okr_vnext_checkin_occurrences` (`server/migrations/20260822_rvn_okr_program_cycle.sql:155-164`):
  `cadence_occurrence_id` (PK), `organization_id`, `cycle_id` (FK do `okr_vnext_cycles`),
  `window_start`/`window_end` — **kolumny typu `DATE`, nie `TIMESTAMPTZ`** — to ma znaczenie dla
  definicji „które okno jest bieżące” (granica dnia, nie chwili), `generated_at`, `generated_by`.
  Unikalność: `(cycle_id, window_start)`.
- Dokładny kształt `okr_vnext_checkins` (`server/migrations/20260825_rvn_okr_checkin.sql:34-99`):
  `cadence_occurrence_id` jest `NOT NULL REFERENCES okr_vnext_checkin_occurrences`, unikalny
  indeks częściowy `ux_okr_vnext_checkins_kr_occurrence_original` na
  `(key_result_id, cadence_occurrence_id) WHERE correction_of_checkin_id IS NULL` — to jest
  sposób, w jaki dziś odróżnia się „ten Kluczowy Rezultat ma już oryginalny check-in do tego
  okna” od „jeszcze nie ma”.
- Co dziś zwraca aktywacja: `checkInSeeding.cadenceOccurrenceIds: string[]`
  (`server/src/services/resultsVnext/okr/okrCheckInScheduler.ts:42,52` — pole na typie zwracanym,
  wypełniane liniami 91-97/146-158) i jak wpięte jest w trasy aktywacyjne
  (`okr.routes.ts:843-865` po aktywacji Cyklu, `okr.routes.ts:1385-1405` po aktywacji Setu).
  To dowodzi, że identyfikatory okien SĄ produkowane — tylko nie są nigdzie odczytywalne
  później, poza tym jednorazowym zrzutem.
- Co już liczy `okrCheckInSummaryRepository.ts::getSetCheckInSummary` (przeczytaj cały plik, 284
  linie): trzy zapytania per Set — `cadenceCountResult` (czy Cykl ma w ogóle jakiekolwiek okna,
  linie 151-157), `overdueResult` (per-KR „any_stale”, linie 181-194, kopia werbatim predykatu z
  `okrCheckInCommands.ts::loadSetCheckInFacts`, linie 201-245 tego drugiego pliku) i
  `nextDueResult` (per-KR `MIN(window_end)` wśród okien bez check-inu, linie 200-214). **Żadne z
  tych trzech zapytań nie zwraca listy okien z ich identyfikatorami** — liczą istnienie/minimum,
  nie enumerują wiersze `cadence_occurrence_id`. To jest dokładnie granica: SQL-owe cegiełki
  (join `okr_vnext_key_results → okr_vnext_sets → okr_vnext_checkin_occurrences`, warunek
  `status <> 'cancelled'`, wykluczenie okien z istniejącym oryginalnym check-inem) już istnieją
  i są do ponownego użycia — brakuje zapytania, które **wypisuje wiersze**, nie tylko je liczy.
- Czy pole „które okno jest bieżące” ma już gdzieś definicję. `okrCheckInCommands.ts:201-245`
  (`loadSetCheckInFacts`) definiuje `window_end < now()` = przeterminowane, `window_end >=
  now()` + brak check-inu = następne oczekujące (`MIN`). Nie ma osobnej definicji „to jedno okno
  jest AKTUALNIE otwarte” (`window_start <= dziś <= window_end`) nigdzie w kodzie na markerze —
  **potwierdź to grepem, nie zakładaj**; jeśli faktycznie nie istnieje, R2 musi ją wprowadzić i
  jawnie uzasadnić (np. „bieżące” = najmniejsze `window_end` spośród okien bez oryginalnego
  check-inu, zgodnie z istniejącym „next due”, żeby nie wymyślać nowego pojęcia obok
  istniejącego).

**Ukończone, gdy:** masz tabelę plik:linia → co dana ścieżka dziś robi/zwraca, i wiesz dokładnie
które trzy zapytania SQL z `okrCheckInSummaryRepository.ts`/`okrCheckInCommands.ts` przepisujesz
na wariant zwracający wiersze zamiast agregatu.

## R2 — trasa odczytu okien

**Zasięg: per Kluczowy Rezultat, nie per Set.** Uzasadnienie do wpisania w raporcie: dialog
otwierany jest z poziomu jednego Kluczowego Rezultatu (`OkrCheckInsView.tsx` — przyjmuje jeden
`keyResult: OkrKeyResultDto`, nie listę), więc naturalny adres to
`GET /key-results/:keyResultId/checkin-occurrences`, dokładnie wzorem sąsiednich tras w tym
samym pliku: `GET .../key-results/:keyResultId/check-ins` (`okr.routes.ts:1959-1960`) i
`GET .../key-results/:keyResultId/suggested-next-check-in-value` (`okr.routes.ts:2123-2124`).
Jeśli po R1 okaże się, że okna są czysto per-Cykl i UI korzystniej dostanie je raz per Set (np.
żeby nie odpytywać osobno dla każdego z kilku Kluczowych Rezultatów w tym samym Secie) —
**wolno wybrać wariant per-Set zamiast per-KR, ale uzasadnienie musi nazwać ten kompromis
wprost**, a nie zniknąć bez śladu.

Wzorzec do powielenia (nie wymyślaj własnego):

- `validateParams(OkrCheckInIdParamsSchema)` (schemat już istnieje,
  `resultsVnextOkr.validators.ts:522-524`, `{ keyResultId: z.string().uuid() }`) — reużyj,
  chyba że nowa trasa potrzebuje dodatkowego parametru, wtedy nowy schemat obok, nie mutacja
  istniejącego (inne trasy go współdzielą).
- `requireAuth(req, res)` na wejściu (identycznie w każdej trasie GET w tym pliku).
- `getKeyResult({ userId, organizationId, keyResultId })` (`okrObjectiveRepository.ts:179`) →
  `404 { error: 'OKR KeyResult not found', code: 'NOT_FOUND' }` gdy `null` — dokładnie ten sam
  blok co w `listCheckIns`/`recordCheckIn`/`suggestNextCheckInValue`
  (`okr.routes.ts:1966-1972`, `1963-1970`, `2130-2136`). Zero nowego schematu autoryzacji.
- Nowa funkcja repozytorium w `server/src/services/resultsVnext/okr/` — obok
  `okrCheckInSummaryRepository.ts`, tym samym stylem (`acquirePgClient` z
  `../../../database/PostgresDatabase.js`, `withReadClient`, brak transakcji bo czysty odczyt).
  Zwraca dla danego `keyResultId`+`organizationId`: listę okien Cyklu Setu tego Kluczowego
  Rezultatu (`cadence_occurrence_id`, `window_start`, `window_end`), dla każdego — czy TEN
  Kluczowy Rezultat ma już oryginalny check-in do niego (join po unikalnym indeksie częściowym
  z R1), i które okno (jeśli któreś) jest „bieżące” wg definicji ustalonej w R1.
- `handleOkrRouteError(res, err, '<nazwaOperacji>')` w `catch` — identycznie jak wszystkie
  pozostałe 60+ tras w tym pliku.

**Ukończone, gdy:** trasa istnieje, zwraca `200` z listą okien dla realnego Kluczowego Rezultatu
zasianego wcześniej w bazie testowej, `404` dla nieistniejącego/niewidocznego Kluczowego
Rezultatu, i pusty (nie błąd) wynik dla Kluczowego Rezultatu, którego Set jeszcze nie ma żadnych
okien (Cykl nieaktywowany) — to trzeci, brzegowy przypadek, sprawdź go osobno.

## R3 — podłączenie formularza

`OkrCheckInRecordDialog.tsx` zamienia input tekstowy (linie 219-227) na `<select>` — dokładnie
tej samej klasy `FIELD_CLASS` (linia 67-70), którą dialog już stosuje do dwóch innych pól wyboru
(`okr-checkin-status`, linie 262-277; `okr-checkin-confidence`, linie 285-297). Zero nowego
stylu, zero nowego układu — jedna zamiana kontrolki.

Dialog dostaje nowy prop (np. `occurrences: OkrCheckInOccurrenceOption[] | undefined`, wzorem
istniejącego `suggestion?: OkrSuggestNextCheckInValue | null` — `undefined` = ładowanie, pusta
tablica = brak okien, nie błąd). `OkrCheckInsView.tsx::openRecord` (linie 98-106) już dziś
odpala jedno wywołanie sieciowe przy otwarciu dialogu (`suggestNextCheckInValue`) — dodaj
analogiczne drugie wywołanie do nowego endpointu z R2, tym samym wzorcem `.then/.catch`.

Klient API: nowa funkcja w `src/components/ResultsVNext/okr/okrCheckInApi.ts`, obok
`listCheckIns`/`recordCheckIn`/`suggestNextCheckInValue`, tym samym `getJson<T>` (linie
120-145). Opcja w liście powinna dawać dość informacji, żeby `<option>` mogła pokazać zakres dat
i (jeśli już wykorzystane przez ten Kluczowy Rezultat) to zaznaczyć lub wykluczyć — R1/R2
rozstrzygają dokładny kształt.

★ **Usuń input tekstowy dopiero, gdy lista realnie działa** (endpoint zwraca dane z bazy, nie
placeholder) — inaczej powtarzasz błąd „naprawa działa na papierze, użytkownik nadal utknięty”.

Zaktualizuj komentarz „HONEST GAP” (`OkrCheckInRecordDialog.tsx:6-20`) i lustrzany nagłówek w
`okrCheckInApi.ts:10-35` — po naprawie oba twierdzą coś nieprawdziwego. Nie kasuj całej historii
luki bez śladu: zamień na krótką notatkę „naprawione dyżurem 170, patrz
`CODEX_DAY170_OKNA_CHECKIN_REPORT.md`” — nieaktualny komentarz, który dalej brzmi jak żywe
ostrzeżenie, jest gorszy niż jego brak, bo każe kolejnemu czytającemu bać się nieistniejącego
problemu.

★ **ZAKAZ zmiany wyglądu poza tym jednym polem.** Zamiana inputu na `<select>` to jedyna
dozwolona zmiana wizualna w tym dyżurze. Zero zmian układu siatki, kolorów, etykiet pozostałych
pól, zero nowych komponentów UI poza samą kontrolką wyboru.

**Ukończone, gdy:** formularz otwarty dla realnego Kluczowego Rezultatu z realnymi oknami w
bazie pokazuje listę wyboru wypełnioną z serwera (nie z placeholdera), zapis działa z wybraną
wartością, a oba komentarze „HONEST GAP” już nie kłamią.

## R4 — dowód od końca do końca i bramka odbioru właściciela

Nowa bramka odbioru (poprawka nadzorcy względem dyżuru 169, zapisz ją dosłownie w raporcie):

> użytkownik otwiera kartę celu → klika check-in → **wybiera okno z listy** → zapisuje → postęp
> przelicza się sam.

Dowód wymagany:

- Realny przebieg HTTP → Gateway → JWT → RealPG, wzorem
  `server/src/services/resultsVnext/okr/__tests__/day169.checkin-windows.pg.test.ts` (ten sam
  plik, do przeczytania jako wzorzec pułapek Z33: `ENABLE_V8_GLOBAL=true`,
  `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, `MOCK_DB=false`,
  `DATABASE_URL` na lokalny Postgres, `ENABLE_TEST_AUTH_BYPASS=false`, JWT podpisany).
- Nowy test `server/src/routes/__tests__/day170.checkin-occurrences.pg.test.ts`: aktywuj
  Cykl+Set+Cel+Kluczowy Rezultat przez HTTP (jak w dniu 169), wywołaj nową trasę `GET`, pokaż
  **surowym SQL-em** na `okr_vnext_checkin_occurrences`/`okr_vnext_checkins`, że zwrócone
  identyfikatory okien i flaga „już wykorzystane” zgadzają się z tym, co jest w bazie — nie ze
  statusem HTTP `200`. Następnie użyj zwróconego identyfikatora do realnego
  `POST .../check-ins` i sprawdź SQL-em, że `current_value`/`progress` na Kluczowym Rezultacie
  faktycznie się przeliczyły (ten sam wzorzec czytania po zapisie co w dniu 169's report,
  sekcja R3).
- Dowód mutacyjny: skopiuj zieloną trasę odczytu do scratch-katalogu (wzorem
  `/private/tmp/cx-day169-cele-checkin-scratch/` z dnia 169), popsuj warunek (np. zamień JOIN po
  `cycle_id` na zawsze pusty wynik lub odetnij filtr organizacji), pokaż że nazwany przypadek
  testu **czerwienieje**, przywróć plikiem `cp` (nie `git stash`), pokaż 2/2 `passed`,
  `npx tsc --noEmit -p server/tsconfig.json` czysty, `git diff --check` czysty.

**Ukończone, gdy:** raport ma sekcję R4 z dosłownymi nazwami zielonych przypadków, dowodem SQL
przed i po zapisie, i opisem mutacji z dokładnym miejscem cięcia w kodzie.

# 4. TABELA LICENCJI PLIKOWYCH — cała ścieżka danych, tabela → ekran

| Warstwa | Plik | Rola w tym dyżurze |
|---|---|---|
| Raport | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY170_OKNA_CHECKIN_REPORT.md` | Zapis — jedyny raport tego dyżuru |
| Repozytorium (nowe) | `server/src/services/resultsVnext/okr/` — nowy plik obok `okrCheckInSummaryRepository.ts` (np. `okrCheckInOccurrenceRepository.ts`) | Zapis — SELECT listy okien + flaga „już użyte” per KR |
| Kontroler/trasa | `server/src/routes/resultsVnext/okr.routes.ts` | Zapis — nowa trasa `GET`, wzorem linii 1959-1988/2123-2148 |
| Walidator | `server/src/validators/resultsVnextOkr.validators.ts` | Zapis TYLKO jeśli nowa trasa potrzebuje własnego params/query schema obok `OkrCheckInIdParamsSchema` (linie 522-524); `RecordOkrCheckInSchema` (linie 546-564, `cadenceOccurrenceId` na linii 548) — odczyt, bez zmian |
| Klient API frontu | `src/components/ResultsVNext/okr/okrCheckInApi.ts` | Zapis — nowa funkcja obok `listCheckIns`/`recordCheckIn`; aktualizacja nagłówka „REAL, CONFIRMED GAP” (linie 10-35) |
| Komponent formularza | `src/components/ResultsVNext/okr/OkrCheckInRecordDialog.tsx` | Zapis — input → select (linie 96, 121, 219-239), aktualizacja komentarza „HONEST GAP” (linie 6-26) |
| Komponent-rodzic | `src/components/ResultsVNext/okr/OkrCheckInsView.tsx` | Zapis — `openRecord` (linie 98-106) dociąga listę okien obok istniejącej sugestii; przekazanie nowego propa do dialogu (linie 206-217) |
| Test | `server/src/routes/__tests__/day170.checkin-occurrences.pg.test.ts` | Zapis — realny HTTP+PG dowód R4 |
| Odczyt (schemat) | `server/migrations/20260822_rvn_okr_program_cycle.sql` (linie 155-167, `okr_vnext_checkin_occurrences`) | Odczyt — nie zmieniasz |
| Odczyt (schemat) | `server/migrations/20260825_rvn_okr_checkin.sql` (linie 34-99, `okr_vnext_checkins`) | Odczyt — nie zmieniasz |
| Odczyt (predykaty do powielenia) | `server/src/services/resultsVnext/okr/okrCheckInCommands.ts` (`loadSetCheckInFacts`, linie 201-245) | Odczyt — źródło predykatów „przeterminowane”/„następne oczekujące”, wzorzec do skopiowania na wariant enumerujący |
| Odczyt (agregat-bliźniak) | `server/src/services/resultsVnext/okr/okrCheckInSummaryRepository.ts` (cały plik, 284 linie) | Odczyt — najbliższy istniejący kod tej samej domeny, NIE zmieniasz |
| Odczyt (zakaz) | `server/src/services/resultsVnext/okr/okrCheckInScheduler.ts` | Odczyt — zasiewanie okien z dyżuru 169, zmierzone i odebrane; **nie ruszasz** |
| Odczyt (typ KR) | `server/src/services/resultsVnext/okr/okrKeyResultTypes.ts` (linie 91-124, `OkrKeyResult.setId`) | Odczyt — potwierdza że KR niesie `setId`, potrzebne do JOIN-a przez Set do `cycle_id` |

**Nietykalne imiennie:** `okrCheckInScheduler.ts` (zasiewanie okien, dyżur 169, odebrane);
`server/src/routes/resultsVnext/okr.routes.ts` — trasy aktywacyjne, linie 815-1424 (blok
aktywacji Cyklu i Setu, `checkInSeeding`); `okrCheckInCommands.ts::recordCheckIn`/`correctCheckIn`
(logika zapisu i rollupu, dotykasz tylko jeśli R2 wymaga odczytu z tego pliku, zero zmian
zapisu); `server/src/services/resultsVnext/kpi/**`; `src/components/Economics/**`;
`server/migrations/20260830_day169_*` (jeśli istnieje — dyżur 169 wpiął zmianę zdarzeniową bez
nowej migracji, sprawdź to sam na markerze zamiast zakładać).

**Zasoby wyłączne:** własny kontener Postgres nazwany `cx-day170-pg`, własna baza, porty
sprawdzone jako wolne (`lsof -i :<port>` PRZED startem, nie po) — dzień 169 użył `6060`/`5008`/
`5009`, dzień 159 użył `6046`/`4986`/`4987`: **wybierz inne, wolne na Twoim markerze**, nie
zgaduj z tej listy. Port **5000 nigdy** (macOS Control Center). Żadnej bazy zdalnej, demo,
stagingu, produkcji.

# 5. BRAMKI ODBIORU

- **B1.** Bramka właściciela literalnie: użytkownik otwiera kartę celu → klika check-in →
  **wybiera okno z listy** (nie wkleja UUID) → zapisuje → postęp przelicza się sam. Zrzut lub
  opis kroku po kroku z realnymi danymi, nie deklaracja.
- **B2.** Nowa trasa `GET` zwraca `404` dla Kluczowego Rezultatu spoza organizacji wywołującego
  (ten sam strażnik co `listCheckIns`/`recordCheckIn` — `getKeyResult` z `organizationId`), nie
  `200` z pustą listą — pomylenie tych dwóch jest luką widoczności, nie funkcją.
- **B3.** Pole `cadenceOccurrenceId` w `RecordOkrCheckInSchema`
  (`resultsVnextOkr.validators.ts:548`) zostaje `z.string().uuid()` **wymagane** — diff nie
  dotyka tej linii ani nie dodaje `.optional()`/`.nullable()` obok niej.
- **B4. Zero fabrykacji.** `git grep -n "randomUUID" src/components/ResultsVNext/okr/` po
  zmianie nie pokazuje nowego użycia jako wypełniacza `cadenceOccurrenceId` (istniejące użycie
  `newOkrCheckInIdempotencyKey()` w `okrCheckInApi.ts:174-176` jest inną wartością, do klucza
  idempotencji — to zostaje, nie jest tym, co zakazane).
- **B5.** `okrCheckInScheduler.ts` nie zmieniony — diff dyżuru nie dotyka tego pliku (`git diff
  --stat` pokazuje to wprost w raporcie).
- **B6.** Komentarz „HONEST GAP” w `OkrCheckInRecordDialog.tsx` i nagłówek w `okrCheckInApi.ts`
  nie twierdzą już nieprawdy po zmianie — albo usunięte, albo zastąpione odniesieniem do tego
  dyżuru.
- **B7.** Zero zmian wizualnych poza zamianą pola tekstowego na listę wyboru — żadnych nowych
  klas, kolorów, przesunięć układu w `OkrCheckInRecordDialog.tsx`.
- **B8.** Test `day170.checkin-occurrences.pg.test.ts` przechodzi na lokalnym Postgresie z
  jawnie podanym configiem (`--config server/vitest.config.ts`, uruchomione z katalogu `server`)
  — raport wprost nazywa użyty plik configu i cytuje `DB_TYPE` z linii `server/vitest.config.ts:17`
  oraz `vitest.config.ts:210`, tak jak zrobił to dyżur 168, żeby audytor mógł odtworzyć przebieg.
- **B9.** `scripts/dev/day161-fresh-migration-check.sh` uruchomiony na pustej bazie, wynik
  wklejony do raportu dosłownie.
- **B10. Dowód mutacyjny obecny.** Raport pokazuje czerwony przebieg po celowym uszkodzeniu
  trasy odczytu, przywrócenie, i zielony przebieg po przywróceniu — nie samo „testy przechodzą”.
- **B11.** Raport ma sekcję „TWIERDZENIA NIEZWERYFIKOWANE” wypisującą wprost, czego NIE
  zmierzono bezpośrednio (np. zachowanie przy setkach okien na jednym Kluczowym Rezultacie,
  wydajność zapytania listującego) zamiast milczeć o brakach.
