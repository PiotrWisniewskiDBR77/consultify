# INSTRUKCJA DYŻURU nr 160 — Codex — „Potwierdzenie runtime bramy 409 na zapisie zadan - pomiar, nie naprawa"

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
> **wyłącznie** `/private/tmp/cx-day160-brama-zadania`.

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
Zakres: **Moja Praca / Inicjatywy - kanoniczna sciezka zapisu zadania**.
Trasy front: ``src/services/apiTyped.ts:257`, `src/hooks/useActionHandler.ts:428`, `src/services/chatActionHandler.ts:120`, `src/components/MyWork/TaskDetailModal.tsx:164` - do odczytu i inwentarza obslugi bledu`. Trasy tył: ``server/src/routes/pmo/tasks.routes.ts`, `server/src/middleware/executionSpineLegacyReadOnly.middleware.ts`, `server/src/Gateway.ts:903` - wylacznie do odczytu`.

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
WT=/private/tmp/cx-day160-brama-zadania
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
git -C "$VAULT" worktree add "$WT" -b codex/day160-brama-zadania-20260830 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day160-brama-zadania/config.worktree"
cat "$VAULT/worktrees/cx-day160-brama-zadania/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day160-brama-zadania-scratch
mkdir -p /private/tmp/cx-day160-brama-zadania-artefakty

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
git -C "$WT" push github-backup codex/day160-brama-zadania-20260830
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
cd /private/tmp/cx-day160-brama-zadania

# (T1) BRAMA I JEJ BEZWARUNKOWOSC
grep -n "READ_ONLY_METHODS\|res.status(409)\|GOVERNED_EXECUTION_CONTROL_COMMANDS" server/src/middleware/executionSpineLegacyReadOnly.middleware.ts
#   oczekiwane: odmowa dla kazdej metody spoza GET/HEAD/OPTIONS, jeden wyjatek budzetowy.
#   Potwierdz sam, ze NIE MA zadnej flagi ani warunku srodowiskowego.

# (T2) ILE TRAS MUTUJACYCH JEST ZA BRAMA
grep -n "router.use(requireCanonicalExecutionWriter)" server/src/routes/pmo/tasks.routes.ts
grep -cE "^router\.(post|put|patch|delete)" server/src/routes/pmo/tasks.routes.ts
#   oczekiwane: brama w linii 67, 23 trasy mutujace. Sprawdz, ile z nich jest PRZED linia 67.

# (T3) GDZIE ROUTER JEST ZAMONTOWANY
grep -n "taskRoutes" server/src/Gateway.ts
#   oczekiwane: dwa montaze. Ustal, ktory z nich trafia front.

# (T4) KTO PISZE DO TABELI tasks
grep -rn "INSERT INTO tasks" server/src --include='*.ts' | grep -v __tests__ | head
#   oczekiwane: TaskController. Ustal, czy ISTNIEJE JAKAKOLWIEK inna trasa,
#   ktora dzis wstawi wiersz do tej tabeli. To rozstrzyga zakres szkody.
```

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day160-brama-zadania-20260830` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6048`. Twój JEDYNY port harnessu to `4988 i 4989`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day160-pg`**. **ZAKAZANE:** `6012, 5433, 6039/4972-4973 (153), 6044/4982-4983 (157), 6045/4984-4985 (158), 6046/4986-4987 (159), 6047 (odbior nadzorcy 159), 6049/4990-4991 (161), 6050/4992-4993 (162)`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak - ten dyzur NIE wprowadza ani jednej nowej flagi i NIE zmienia wartosci domyslnej zadnej istniejacej`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY160_BRAMA_ZADANIA_REPORT.md`. Nie zmieniasz zadnego `MODULE_ACCEPTANCE.md` - ten dyzur jest pomiarowy i nie zamyka zadnego modulu menu. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day160-brama-zadania-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day160-brama-zadania-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **ZERO ZMIAN KODU PRODUKTU. NIE NAPRAWIASZ BRAMY, NIE COFASZ COMMITA bb57239243, NIE DODAJESZ ZADNEGO POLECENIA KANONICZNEGO.** Ten dyzur ma wylacznie ZMIERZYC i przygotowac material do decyzji wlasciciela. Wolno Ci dodac plik pomiarowy i raport - nic wiecej. **Zero polaczen do bazy zdalnej, demo, stagingu i produkcji.** Jesli w trakcie pomiaru odkryjesz, ze zapis zadania JEDNAK dziala, to jest wynik rownie cenny jak potwierdzenie - zglos go tak samo glosno i nie naginaj pomiaru do tezy nadzorcy | Cztery dyzury (140, 141, 149, 153) trafily w te sama przyczyne z czterech stron. Brama z commita bb57239243 z 19.08 wycofala stara powierzchnie zapisu, nie budujac zamiennika dla tabeli tasks. Wszystko poza ostatnim ogniwem jest udowodnione: brama uruchomiona realnie zwraca 409, montaz potwierdzony w Gateway.ts:903, siedmiu wolaczy frontu znalezionych. Brakuje jednego pomiaru, a od niego zalezy decyzja wlasciciela wartka tygodni pracy |

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
cd /private/tmp/cx-day160-brama-zadania

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL|ENABLE_LIVE_EMAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day160-pg psql -U postgres -d cx160 \
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
cd /private/tmp/cx-day160-brama-zadania

docker run -d --name cx-day160-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx160 \
  -p 127.0.0.1:6048:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day160-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6048/cx160 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6048/cx160 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day160-brama-zadania && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6048/cx160 \
JWT_SECRET=cx160-test-secret-do-not-reuse \
npx vitest run server/src/routes/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day160-brama-zadania-artefakty/day160-vitest.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day160-brama-zadania && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/routes/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day160-brama-zadania-artefakty/day160-vitest.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day160-brama-zadania/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day160-pg psql -U postgres -d cx160 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day160-pg`.
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
> **(e) **Polecenie kanoniczne NIE JEST zamiennikiem operacji legacy - to inny agregat w innym magazynie.** Legacy pisze `INSERT INTO tasks` (`TaskController.ts:1286`), kanoniczne `execution.task.create` idzie przez `materialCommand.ts` do `INSERT INTO ie_aggregate_state` (`postgresMaterialCommandUnitOfWork.ts:295`). Plik `server/src/domain/initiatives-execution/executionWork.ts` **nie zawiera ani jednego SQL-a** dotykajacego tabeli `tasks`. Nie policz tych dwoch sciezek jako jednej tylko dlatego, ze obie nazywaja sie 'create task'. Druga pulapka: `server/src/routes/pmo/index.ts` montuje te routery po raz drugi, ale **nie ma konsumenta** - to martwy agregator, nie druga zywa trasa**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day160-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day160-brama-zadania-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`pozycja R1 - dowod end-to-end przez realny HTTP, ze zapis zadania konczy sie kodem 409 albo ze konczy sie inaczej, niz zaklada nadzorca`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6048` albo `4988 i 4989` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6048` albo `4988 i 4989`** (`Z7`).

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

Commit `bb572392438ddba14847205c2c6a0302df440e5c` (19.08.2026, „feat(execution): retire legacy
write surfaces”) wprowadził bramę, która na papierze zamyka legacy-zapis do zadań: każda metoda
inna niż `GET`/`HEAD`/`OPTIONS` trafiająca do routera zadań dostaje `409` z kodem
`EXECUTION_RUNTIME_V1_WRITE_REQUIRED` (`server/src/middleware/executionSpineLegacyReadOnly.middleware.ts:22-44`,
stała kodu w linii 3). `server/src/routes/pmo/tasks.routes.ts:67` montuje tę bramę
(`router.use(requireCanonicalExecutionWriter)`) i wszystkie 23 trasy mutujące w tym pliku
(`router.post`/`put`/`delete`, pierwsza w linii 90, ostatnia w linii 1360) leżą PO tej linii.
Router jest zamontowany dwa razy: `/api/tasks` (`server/src/Gateway.ts:903`) i
`/api/pmo/tasks` (`server/src/Gateway.ts:1150`) — to ten sam plik `tasks.routes.ts`, więc obie
ścieżki URL dziedziczą tę samą bramę.

To wszystko jest udowodnione **statycznie** — grepem i czytaniem kodu. Czego brakuje: nikt nie
odpalił realnego żądania HTTP przez tę bramę i nie sprawdził, co naprawdę wraca i co naprawdę
dzieje się w bazie. „Kod tak mówi” to nie to samo co „serwer tak robi” — to właśnie ósmy i
dziesiąty kształt fałszywego gotowe z korpusu metodyki: wołacz istnieje, ale nikt nie sprawdził,
czy się wykonuje tak, jak czyta się kod.

Do tego dochodzi ustalenie z dzisiejszej weryfikacji tego dyżuru, które **zmienia obraz sprawy**:
brama w `tasks.routes.ts` nie jest jedynym miejscem, które pisze do tabeli `tasks`. Grep
`INSERT INTO tasks` po całym `server/src` (bez `__tests__`) zwraca **ponad 20 miejsc** w różnych
plikach — część z nich leży pod inną bramą (`server/src/routes/executionControl.routes.ts:930`
jest osłonięty na poziomie montowania: `server/src/routes/v8/index.ts:107` —
`v8Router.use('/execution-control', requireCanonicalExecutionWriter, executionControlRoutes)`),
ale przynajmniej jedna wygląda na kompletnie NIEOSŁONIĘTĄ i realnie używaną z frontu:
`POST /api/my-work/personal-tasks` (deklaracja trasy `server/src/routes/my-work.routes.ts:1282`,
`INSERT INTO tasks` w linii 1379). Plik `my-work.routes.ts` ma własny łańcuch `router.use(...)`
(`apiAuthRateLimiter`, `verifyToken`, `validateOrgMembership`, `demoContextMiddleware` — linie
106-110) i **nigdzie** w tym pliku nie ma `requireCanonicalExecutionWriter` (sprawdzone grepem —
zero trafień). Montowanie: `server/src/Gateway.ts:1036` (`app.use('/api/my-work', myWorkRoutes)`)
— też bez bramy w wywołaniu montującym (w przeciwieństwie do `execution-control`, które bramę
dostaje właśnie w linii montowania). Front realnie tego używa: `Api.createPersonalTask`
(`src/services/api.ts:4841`) robi `fetch(`${API_URL}/my-work/personal-tasks`, { method: 'POST', ... })`
(linia 4855) i jest wołane z co najmniej sześciu miejsc:
`src/components/MyWork/NotebookContent.tsx:2045`, `src/components/MyWork/TaskDetailView.tsx:1310`,
`src/components/MyWork/shared/PostDecisionFollowUp.tsx:102`,
`src/components/MyWork/notebook/ConvertChecklistModal.tsx:87`,
`src/components/MyWork/notebook/ActionItemsPanel.tsx:73` i `:102`.

To jest **twierdzenie do potwierdzenia w tym dyżurze**, nie fakt zamknięty — grep pokazuje kod,
nie runtime. Jeśli się potwierdzi realnym żądaniem + odczytem bazy, znaczy to, że teza „tworzenie
zadania jest dziś zepsute w całym produkcie” jest fałszywa w tej postaci: zepsuta jest jedna
rodzina tras (`tasks.routes.ts`, projektowe/inicjatywowe zadania), a osobna, równoległa rodzina
(„personal tasks”) wciąż pisze do tej samej tabeli `tasks` bez przechodzenia przez bramę. Dla
klienta różnica jest ogromna: „nie da się utworzyć żadnego zadania” vs „nie da się utworzyć
zadania powiązanego z inicjatywą/projektem, ale luźne zadanie osobiste — tak”.

## Czym ten dyżur NIE jest

Nie jest naprawą bramy ani decyzją między wariantem A (dobudować polecenia kanoniczne) a
wariantem B (cofnąć/zawęzić bramę) — to zostaje do decyzji właściciela na podstawie materiału z
R4. Nie jest pełnym audytem wszystkich ~20 miejsc `INSERT INTO tasks` znalezionych grepem — masz
je wypisać i sklasyfikować (osłonięte/nieosłonięte), ale głęboki dowód end-to-end (realne
żądanie + odczyt bazy) rób tylko dla dwóch tras: kanonicznej `POST /api/tasks` (żeby potwierdzić
409) i dla `POST /api/my-work/personal-tasks` (żeby potwierdzić lukę). Nie jest zmianą
`executionSpineLegacyReadOnly.middleware.ts`, `tasks.routes.ts`, `my-work.routes.ts` ani
żadnego innego pliku produktu — zero zmian kodu poza testem/skryptem pomiarowym i raportem. Nie
jest operacją na demo/staging/produkcji — wyłącznie własny kontener Postgres. Nie jest audytem
polecenia kanonicznego Runtime-v1 (`postgresMaterialCommandUnitOfWork.ts`) pod kątem poprawności
— jego istnienie i to, że pisze do innego magazynu (`ie_aggregate_state`, INSERT w linii 295), już
jest ustalone i wystarczające jako tło dla R4.

# 2. TEZY ZLECENIA

- **T1.** Brama w `tasks.routes.ts` blokuje w kodzie źródłowym każdą metodę zapisu — ale nikt nie
  zmierzył tego realnym żądaniem HTTP z prawdziwym tokenem na żywym serwerze. Dopóki nie ma
  dosłownej pary żądanie/odpowiedź, to teza, nie fakt.
- **T2.** Siedmiu (a być może więcej — policz sam) wołaczy frontu trafia w tę bramę. Nie wiadomo,
  co widzi użytkownik w każdym przypadku — może być cichy toast, może być nieobsłużony wyjątek,
  może być coś jeszcze innego. To trzeba wypisać po pliku:linii, nie zgadywać.
- **T3.** Tabela `tasks` ma więcej niż jednego pisarza w `server/src`, i przynajmniej jeden
  (`POST /api/my-work/personal-tasks`) statycznie wygląda na nieosłonięty i wołany z frontu.
  Trzeba to potwierdzić lub obalić realnym żądaniem + odczytem bazy — jeśli się potwierdzi, teza
  „produkt nie może dziś tworzyć zadań” jest fałszywa w tej ogólności.
- **T4.** Materiał decyzyjny (A: dobudować polecenia kanoniczne dla `tasks` / B: cofnąć lub
  zawęzić bramę z 19.08) musi mieć koszt i ryzyko dla każdego wariantu — bez rekomendacji, to
  materiał dla właściciela, nie decyzja Codexa.

# 3. POZYCJE DYŻURU

## R1 — dowód end-to-end przez realny HTTP dla kanonicznej trasy `/api/tasks`

Postaw serwer na lokalnym Postgresie (własny kontener, zasady niżej), zaloguj się realnym
tokenem, wyślij prawdziwe żądania na `POST /api/tasks` (utworzenie), `PUT /api/tasks/:id`
(edycja), `DELETE /api/tasks/:id` (kasowanie) i na dodanie komentarza
(`POST /api/tasks/:id/comments` — sprawdź dokładną ścieżkę w `tasks.routes.ts`, linia ok. 1187
wg wcześniejszego przeglądu, potwierdź sam). Zapisz dosłowny kod HTTP i dosłowne ciało
odpowiedzi dla każdego. Po każdym żądaniu sprawdź surowym SQL-em, czy wiersz w `tasks` (lub w
tabeli komentarzy) powstał, zmienił się lub zniknął — nie ufaj tylko kodowi odpowiedzi. Zrób to
też dla `DELETE /api/budget/entries/:id` (jedyny wyjątek w bramie,
`executionSpineLegacyReadOnly.middleware.ts:11`) — potwierdź, że TEN endpoint przechodzi, a
wszystkie pozostałe nie.

**Ukończone, gdy:** masz plik z dosłownymi parami żądanie→odpowiedź dla wszystkich powyższych
tras plus stan bazy przed/po każdym wywołaniu, i wynik zgadza się (albo jawnie nie zgadza się —
zapisz to w „TWIERDZENIA NIEZWERYFIKOWANE”) z tym, co mówi czytanie kodu w części 1.

## R2 — inwentarz obsługi 409 we froncie

Znajdź w `src/` KAŻDE wywołanie, które trafia w bramę na `/tasks` (zacznij od siedmiu znanych:
`src/services/apiTyped.ts:257`, `src/hooks/useActionHandler.ts:428`,
`src/services/chatActionHandler.ts:120`, `src/components/MyWork/TaskDetailModal.tsx:164`,
`src/components/Initiatives/InitiativeDocumentView.tsx:3514`,
`src/components/Initiatives/sections/TasksMilestonesSection.tsx:788`,
`src/components/Results/ResultsKpiReportsView.tsx:516` — ale policz sam, czy jest ich więcej,
także dla `PUT`/`DELETE` na `/tasks/:id`, nie tylko `POST`). Dla każdego ustal: czy wywołanie ma
`try/catch` obejmujący ten konkretny `await`; co widzi użytkownik (konkretny tekst komunikatu,
jeśli jest — np. `useActionHandler.ts:438` pokazuje `toast.error('Failed to create task')`, ale
zweryfikuj TY, nie kopiuj tego przykładu bez sprawdzenia); czy komunikat rozróżnia „brama 409” od
innej awarii sieciowej, czy pokazuje to samo; czy front się wywraca (nieobsłużony wyjątek,
zawieszony spinner) gdy `catch` nie istnieje lub nie obejmuje właściwego wywołania. Podaj
plik:linia dla każdego wołacza i każdego miejsca obsługi błędu.

**Ukończone, gdy:** masz tabelę wołacz → ma catch? → co widzi użytkownik → czy się wywraca, dla
każdego znalezionego miejsca, z plikiem i linią.

## R3 — czy istnieje działająca ścieżka utworzenia zadania w produkcie

To pozycja, w której dyżur już ma punkt startowy z dzisiejszej weryfikacji (część 1) — dokończ
ją, nie zaczynaj od zera. Grep `INSERT INTO tasks` po `server/src` (bez `__tests__`) daje listę
kandydatów w plikach m.in.: `mcpServer.ts`, `ai/actionProposalEngine.ts`,
`ai/actionExecutors/taskExecutor.ts`, `controllers/DecisionController.ts` (dwa miejsca),
`controllers/TaskController.ts:1286`, `routes/executionControl.routes.ts:930`,
`routes/my-work.routes.ts` (dwa miejsca, w tym :1379), `routes/feedback.routes.ts:1174` (funkcja
`createTaskForFeedback`, deklaracja `feedback.routes.ts:1115`), `routes/v8/results.routes.ts`
(dwa miejsca), `routes/v8/my-work.routes.ts:2868`, `routes/my-work/calendar.routes.ts:929`,
`routes/pmo/initiatives.routes.ts` (dwa miejsca, pod `requireCanonicalInitiativeExecutionWriter`,
`initiatives.routes.ts:160`), `routes/integrations/automation.routes.ts:406`,
`services/aiActionExecutor.ts:1101`, `services/InterviewAssignmentService.ts:1348`,
`services/TaskService.ts:153`, `services/blueprintService.ts:302`,
`services/initiativeGovernanceService.ts:451`, `services/demo/demoSeedService.ts:2339`,
`services/resultsVnext/kpi/kpiRecoveryChildCommands.ts:434`,
`services/health/healthProbeService.ts:800`. Dla każdego pliku ustal: czy trasa/serwis leży pod
`requireCanonicalExecutionWriter` lub `requireCanonicalInitiativeExecutionWriter` (sprawdź
montowanie routera w `Gateway.ts` i w `routes/v8/index.ts` — nie zgaduj z nazwy pliku, jak w
przypadku `execution-control`, gdzie brama siedzi w linii montowania, nie w samym pliku
routingu); czy jest wołany z frontu, czy tylko wewnętrznie (np. `feedback.routes.ts` tworzy
zadanie jako efekt uboczny zgłoszenia ticketu, nie jako ogólna akcja użytkownika — potwierdź to
zamiast zakładać).

Następnie zrób realny dowód end-to-end (jak w R1) dla `POST /api/my-work/personal-tasks`
(front: `Api.createPersonalTask`, `src/services/api.ts:4841`, wołane m.in. z
`src/components/MyWork/NotebookContent.tsx:2045` i `TaskDetailView.tsx:1310`): prawdziwe żądanie,
dosłowna odpowiedź, i przede wszystkim odczyt bazy — czy wiersz w `tasks` naprawdę powstał, jaki
ma `task_type`, i czy ma wypełnione `initiative_id`/`project_id` (z lektury handlera w
`my-work.routes.ts` w okolicy linii 1282-1379 wygląda na to, że NIE ustawia `initiative_id` ani
`project_id` — potwierdź to sam, to rozstrzyga, czy to jest „prawdziwe zadanie robocze” czy tylko
osobisty to-do bez powiązania z inicjatywą). Rozstrzygnij: czy dziś da się w produkcie utworzyć
JAKIEKOLWIEK zadanie, i czy da się utworzyć zadanie powiązane z inicjatywą/projektem — to dwa
różne pytania, odpowiedz na oba osobno.

**Ukończone, gdy:** masz tabelę wszystkich znalezionych pisarzy `tasks` z kolumnami
plik:linia / osłonięty czy nie / wołany z frontu czy tylko wewnętrznie, plus dowód end-to-end
(żądanie+odpowiedź+stan bazy) dla `personal-tasks`, plus jednoznaczna odpowiedź na oba pytania z
akapitu wyżej.

## R4 — materiał do decyzji właściciela

Bez rekomendowania wyboru: opisz wariant A (dobudować w Runtime-v1 polecenia kanoniczne, które
faktycznie piszą do `tasks` albo migrują `tasks` pod `ie_aggregate_state`) i wariant B (cofnąć
lub zawęzić bramę `requireCanonicalExecutionWriter` z 19.08, np. przywrócić zapis dla wybranych
tras). Dla każdego: co trzeba technicznie zrobić (wymień konkretne pliki, które by to dotknęło —
na podstawie tego, co już przeczytałeś w R1-R3), zgrubny rząd wielkości pracy (dni robocze, nie
godziny co do minuty), i ryzyko (np. wariant B przywraca zapis do `tasks`, ale zostawia dwa
rozłączne magazyry na zawsze; wariant A wymaga przepisania 23 tras i migracji istniejących
wierszy `tasks` do `ie_aggregate_state`, albo utrzymania obu na stałe). Uwzględnij w kosztach
odkrycie z R3 — jeśli `personal-tasks` faktycznie omija bramę, to część funkcji produktu już
dziś działa poza Runtime-v1, co jest argumentem za lub przeciw każdemu wariantowi (napisz który i
dlaczego, ale nie wybieraj za właściciela).

**Ukończone, gdy:** raport ma sekcję z dwoma wariantami, każdy z listą dotkniętych plików,
szacunkiem pracy i ryzykiem, i bez zdania rekomendującego jeden z nich.

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY160_BRAMA_ZADANIA_REPORT.md` |
| Zapis | test/skrypt pomiarowy `server/src/routes/__tests__/day160.task-write-gate.pg.test.ts` (przybita nazwa, jedyny dozwolony plik kodu) |
| Odczyt | `server/src/middleware/executionSpineLegacyReadOnly.middleware.ts` — **nie zmieniasz** |
| Odczyt | `server/src/routes/pmo/tasks.routes.ts` — **nie zmieniasz** |
| Odczyt | `server/src/routes/my-work.routes.ts`, `server/src/routes/feedback.routes.ts`, `server/src/routes/executionControl.routes.ts`, `server/src/routes/v8/index.ts`, `server/src/routes/pmo/initiatives.routes.ts` — i pozostałe pliki z listy R3, wszystkie tylko do czytania |
| Odczyt | `server/src/Gateway.ts` |
| Odczyt | `server/src/controllers/TaskController.ts`, `server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.ts` |
| Odczyt | `src/services/api.ts`, `src/services/apiTyped.ts`, `src/hooks/useActionHandler.ts`, `src/services/chatActionHandler.ts` i pozostałe pliki wołające `/tasks` z R2 |
| Odczyt | `server/scripts/migrate.postgres.ts`, `server/vitest.config.ts`, `server/src/database/Database.ts` |

**Nietykalne imiennie:** cały `src/**` (tylko odczyt, zero zmian); wszystkie pliki produktu
wymienione wyżej w „Odczyt”; wszystkie migracje w `server/migrations/` — ten dyżur nie tworzy
migracji, bo nie zmienia schematu; `server/src/routes/__tests__/day157.*`,
`server/src/routes/__tests__/day158.*`, `server/src/services/ai/__tests__/day159.*`.

**Zasoby wyłączne:** baza na porcie `6047`, kontener `cx-day160-pg`, runtime na portach `4988`
i `4989`. Żadnego innego portu, żadnej bazy zdalnej, żadnego połączenia z demo/staging/produkcją.

# 5. BRAMKI ODBIORU

- **B1.** R1 ma dosłowne pary żądanie→odpowiedź (kod HTTP + ciało) dla `POST`/`PUT`/`DELETE`
  na `/api/tasks` i dla komentarza, plus stan bazy przed/po każdym wywołaniu — nie tylko kod
  odpowiedzi.
- **B2.** R1 potwierdza osobno, że `DELETE /api/budget/entries/:id` przechodzi przez bramę
  (jedyny wyjątek), realnym żądaniem, nie czytaniem regexa.
- **B3.** R2 ma tabelę wołacz → plik:linia → ma catch? → komunikat dla użytkownika → czy front
  się wywraca, dla wszystkich znalezionych wywołań `/tasks` (co najmniej siedmiu znanych, plus
  wszystkie dodatkowo znalezione).
- **B4.** R3 ma pełną listę pisarzy `tasks` znalezionych grepem w `server/src`, z kolumną
  osłonięty/nieosłonięty ustaloną przez sprawdzenie miejsca montowania routera, nie nazwy pliku.
- **B5.** R3 ma dowód end-to-end (żądanie + odpowiedź + odczyt bazy, z wypełnieniem
  `initiative_id`/`project_id`) dla `POST /api/my-work/personal-tasks` i jednoznaczną odpowiedź,
  czy to jest funkcjonalny zamiennik tworzenia zadania, czy tylko osobny, niepowiązany z
  inicjatywą byt.
- **B6. Zero zmian produktu.** Diff dyżuru dotyka wyłącznie
  `server/src/routes/__tests__/day160.task-write-gate.pg.test.ts` i raportu w
  `docs/program/waves/WAVE_03_ACCEPTANCE/codex/`. Żaden plik z tabeli „Odczyt” nie jest
  zmieniony.
- **B7. Zero zdalnych baz.** Cały pomiar wykonany na `cx-day160-pg` (port `6047`, runtime
  `4988`/`4989`) — żadnego połączenia z demo/staging/produkcją w logach ani w kodzie testu.
- **B8.** Raport ma sekcję „TWIERDZENIA NIEZWERYFIKOWANE” — jeśli którejś części R1-R4 nie dało
  się domknąć dowodem, jest to tam napisane wprost, a nie pominięte milczeniem.
- **B9.** R4 ma oba warianty (A i B) z listą dotkniętych plików, szacunkiem pracy i ryzykiem dla
  każdego, i nie zawiera zdania rekomendującego jeden z nich jako wybór Codexa.
