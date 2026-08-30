# INSTRUKCJA DYŻURU nr 176 — Codex — „Ustawienia — MEMBER cicho wraca do Profilu na 4 z 5 tras + inwentarz dwóch martwych/wadliwych komponentów billing"

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
> **wyłącznie** `/private/tmp/cx-day176-ustawienia`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `d3d36cd5f5`**
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
Zakres: **15_SETTINGS — domknięcie po day124 (odbiór wizualny PARTIAL); NIE otwieramy CLOSED_FINAL, tylko pozycje z rekonesansu**.
Trasy front: ``src/views/SettingsView.tsx` (wyłącznie efekt przekierowania pilota, linie 281-284), `src/components/billing/UsageMeters.tsx` (wyłącznie import `useTranslation` i wywołanie `t()` w linii 174)`. Trasy tył: `brak — ten dyżur nie dotyka `server/**``.

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
WT=/private/tmp/cx-day176-ustawienia
MARKER=d3d36cd5f5

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day176-ustawienia-20260830 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day176-ustawienia/config.worktree"
cat "$VAULT/worktrees/cx-day176-ustawienia/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day176-ustawienia-scratch
mkdir -p /private/tmp/cx-day176-ustawienia-artefakty

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
git -C "$VAULT" log --oneline d3d36cd5f5..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only d3d36cd5f5..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day176-ustawienia-20260830
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only d3d36cd5f5..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `cztery` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day176-ustawienia

# (T1) CICHY REDIRECT MEMBER — przyczyna
sed -n '247,251p;280,285p' src/views/SettingsView.tsx
#   oczekiwane: `isPilotParticipant = isPilotParticipantRole(currentUser?.role)`,
#   pilotAllowedSections = ['profile','auth-access','language','theme'],
#   navigate(getPilotDefaultSettingsRoute(), { replace: true }) BEZ komunikatu.

# (T2) MEMBER JEST W ZAKRESIE PILOTA
grep -n "'MEMBER'\|'TEAM_MEMBER'" src/utils/roleGuards.ts
#   oczekiwane: MEMBER i TEAM_MEMBER wewnątrz isPilotRestrictedRole.

# (T3) DOWÓD ODBIORU 124
grep -n "MEMBER:.*bezgłośnym przekierowaniem\|2 z 10 semantycznie" docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY124_USTAWIENIA_OWNER_REPORT.md
#   oczekiwane: potwierdzenie 8 z 10 cichych przekierowań MEMBER.

# (T4) BUG t() BEZ IMPORTU + MARTWY SidebarUsage
grep -n "useTranslation\|const { t }" src/components/billing/UsageMeters.tsx
sed -n '170,178p' src/components/billing/UsageMeters.tsx
grep -rln "SidebarUsage" src/ --include='*.tsx' --include='*.ts'
#   oczekiwane: brak useTranslation w UsageMeters.tsx (import pusty), t() użyty w linii 174;
#   SidebarUsage.tsx pojawia się WYŁĄCZNIE we własnym pliku — zero importerów.
```

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day176-ustawienia-20260830` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6076`. Twój JEDYNY port harnessu to `5022 i 5023`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day176-pg`**. **ZAKAZANE:** `6012, 5433, 6047 i 6054-6055 oraz 6061-6067 (odbiory nadzorcy), 6068-6071/5010-5017 (dyżury 170-173), 6074/5018-5019 (174), 6075/5020-5021 (175), 6077/5024-5025 (177), 6078/5026-5027 (178), 6079/5028-5029 (179). ★ PORT 5000 ZAJĘTY NA STAŁE przez macOS Control Center`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak — ten dyżur NIE wprowadza ani jednej nowej flagi i NIE zmienia wartości domyślnej żadnej istniejącej`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY176_USTAWIENIA_REPORT.md`. Nie zmieniasz `docs/program/waves/WAVE_03_ACCEPTANCE/modules/15_SETTINGS/MODULE_ACCEPTANCE.md` — CLOSED_FINAL Ustawień pozostaje bez zmiany werdyktu, to domknięcie pozycji rekonesansu, nie ponowny odbiór. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day176-ustawienia-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day176-ustawienia-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **NIE OTWIERASZ CLOSED_FINAL Ustawień.** To domknięcie pozycji rekonesansu, nie nowy odbiór wizualny — nie generujesz nowego pakietu 20 zrzutów, nie zmieniasz werdyktu `MODULE_ACCEPTANCE.md`. **NIE KASUJESZ `SidebarUsage.tsx` ani `UsageMeters.tsx`.** Martwy kod (`SidebarUsage`) idzie do inwentarza w raporcie, do osobnej decyzji właściciela — kasowanie martwego kodu na własną rękę nie jest w licencji tego dyżuru. **NIE ZMIENIASZ zakresu `PILOT_ALLOWED_SETTINGS_SECTIONS`/`pilotAllowedSections`** (jakie sekcje MEMBER widzi) — naprawiasz WYŁĄCZNIE brak komunikatu przy przekierowaniu, nie to, które sekcje są dozwolone; to osobna decyzja produktowa. **NIE ZMIENIASZ WYGLĄDU** poza dodaniem komunikatu (toast/banner tekstowy, wzorem istniejących `toast.success/toast.error` w `src/components/settings/AI*.tsx`) — żadnych nowych kolorów, ikon dekoracyjnych ani layoutu. **NIE DOTYKASZ innych efektów w `SettingsView.tsx`** (przekierowanie legacy-alias linie 252-270, przekierowanie ukrytych sekcji linie 292-306) — licencja obejmuje wyłącznie blok pilota (linie 281-284) i jego bezpośrednie sąsiedztwo importu. **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.** | Odbiór wizualny dyżuru 124 (`CODEX_DAY124_USTAWIENIA_OWNER_REPORT.md`, sekcja 6, macierz K3) zmierzył wprost: **`MEMBER: 2 z 10 semantycznie poprawne (Profil); pozostałe 8 z 10 są bezgłośnym przekierowaniem do Profilu`** — czyli 4 z 5 mierzonych powierzchni (Regionalizacja, Powiadomienia, Bezpieczeństwo, Dane i prywatność) w obu motywach. Kod potwierdza dziś przyczynę: `src/views/SettingsView.tsx:282-284` przekierowuje każdego uczestnika pilota (`isPilotParticipantRole`, obejmuje `MEMBER`/`TEAM_MEMBER`) na `/settings/profile`, jeśli aktywna sekcja nie jest jedną z czterech dozwolonych (`profile`, `auth-access`, `language`, `theme`) — **bez żadnego komunikatu, toastu ani banera**. Osobno: rekonesans zamknięcia 16 modułów (`docs/program/funkcje/REKONESANS_ZAMKNIECIA_16_MODULOW.md`, tabela obalonych tez) zmierzył realny bug w `UsageMeters.tsx:174` — wywołanie `t(...)` bez importu `useTranslation`/`t` w tym pliku — oraz ustalił, że `SidebarUsage.tsx` (jedyny importer `UsageMeters`, obok realnie używanych `BillingSettings.tsx`/`BillingCore.tsx`) sam ma **zero importerów** w całym `src/`. |

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
cd /private/tmp/cx-day176-ustawienia

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day176-pg psql -U postgres -d cx176 \
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
cd /private/tmp/cx-day176-ustawienia

docker run -d --name cx-day176-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx176 \
  -p 127.0.0.1:6076:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day176-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6076/cx176 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6076/cx176 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day176-ustawienia && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6076/cx176 \
JWT_SECRET=cx176-test-secret-do-not-reuse \
npx vitest run tests/unit, src/**/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day176-ustawienia-artefakty/day176-vitest.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day176-ustawienia && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run tests/unit, src/**/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day176-ustawienia-artefakty/day176-vitest.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day176-ustawienia/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day176-pg psql -U postgres -d cx176 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day176-pg`.
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
> **(e) ★★ **Pierwsza: w pliku istnieją DWA różne mechanizmy przekierowania do Profilu, nie pomyl ich.** Blok linii 281-284 (pilotowy, dla `MEMBER`/`TEAM_MEMBER`/`USER`/`GUEST`/`VIEWER`/`CLIENT` — `isPilotRestrictedRole`) jest tym z odbioru 124. Osobny blok linii 292-306 (`hiddenSections` — SET-28, ownership/handoff, `shortcuts`) przekierowuje z INNEGO powodu (funkcja jeszcze nie istnieje, nie rola) i NIE jest w zakresie R1 — nie dodawaj tam komunikatu, chyba że zmierzysz osobno, że i on jest cichy, i zgłosisz to jako nowe znalezisko, nie naprawiasz bez zapisu. **Druga: `SettingsSection` "pilotAllowedSections" (linia 248-251, lokalna zmienna) i `isPilotAllowedSettingsSection`/`PILOT_ALLOWED_SETTINGS_SECTIONS` (`src/utils/pilotAccess.ts:15-19`) NIE SĄ tym samym miejscem — obie listy dziś zawierają te same cztery wartości (`profile`,`auth-access`,`language`,`theme`), ale zdefiniowane osobno; sprawdź, którą realnie czyta efekt na linii 282 (`isPilotAllowedSettingsSection` z importu `pilotAccess.ts`) — lokalna `pilotAllowedSections` (linia 248-251) zasila WYŁĄCZNIE prop `allowedSections` sidebaru (linia 534), nie warunek przekierowania; nie jest martwa, ale to DWA OSOBNE źródła tej samej listy czterech wartości. Nie konsoliduj ich — poza licencją tego dyżuru — tylko odnotuj w raporcie jako osobne znalezisko. **Trzecia: plik nie importuje dziś `react-hot-toast`.** Sprawdź `grep -n "^import" src/views/SettingsView.tsx` przed edycją i dodaj import w kolejności zgodnej z resztą pliku (biblioteki zewnętrzne nad lokalnymi), analogicznie do wzorca w `src/components/settings/AIAutoCompleteSettings.tsx` (`toast.success(t('settings.ai.autocompleteSaved', ...))`). Komunikat MEMBER ma iść przez `t()` z polskim tekstem (plik już ma `const { t } = useTranslation()` w linii 241) i nowym kluczem w konwencji `settings.*` — NIE twardym stringiem angielskim. **Czwarta, dla UsageMeters: `t` bez importu to dziś martwy kod TYLKO w sensie 'nigdy nie renderowany bez wyjątku' — sprawdź, czy TypeScript/build w ogóle łapie ten błąd (referencja do niezadeklarowanej zmiennej w JSX) zanim założysz, że to nieszkodliwe; jeśli build przechodzi, wyjaśnij w raporcie DLACZEGO (np. transpilacja nie sprawdza zasięgu JSX-interpolacji w tym trybie).** Napraw dodając `import { useTranslation } from 'react-i18next'` i `const { t } = useTranslation();` wewnątrz komponentu, zachowując istniejący klucz `'billing.usage.resetsOn'` i domyślny polski tekst — nie zmieniaj treści. **Piąta: `UsageMeters` NIE jest martwy** (importerzy: `SidebarUsage.tsx`, `src/components/settings/BillingSettings.tsx`, `src/components/shared/BillingCore.tsx`) — martwy jest wyłącznie `SidebarUsage.tsx` sam. Nie myl tych dwóch faktów w raporcie.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day176-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day176-ustawienia-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`pozycja R1 — MEMBER dostaje uczciwy komunikat zamiast cichego powrotu do Profilu`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6076` albo `5022 i 5023` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6076` albo `5022 i 5023`** (`Z7`).

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

**Pierwsza.** Dyżur 124 (`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY124_USTAWIENIA_OWNER_REPORT.md`,
sekcja 6, macierz K3 „5 × 2 × 2") zmierzył wprost, zrzut po zrzucie:

```
MEMBER: 2 z 10 semantycznie poprawne (Profil); pozostałe 8 z 10 są bezgłośnym
przekierowaniem do Profilu
```

Dziesięć zrzutów MEMBER = pięć powierzchni (Profil, Regionalizacja, Powiadomienia,
Bezpieczeństwo, Dane i prywatność) razy dwa motywy. Profil działa (2/10 poprawne). Pozostałe
cztery powierzchnie — w obu motywach, więc 8/10 — cicho odbijają użytkownika z powrotem na
`/settings/profile`. Kod dziś potwierdza dokładną przyczynę:

```ts
// src/views/SettingsView.tsx:281-284
useEffect(() => {
  if (!isPilotParticipant) return;
  if (isPilotAllowedSettingsSection(activeSection)) return;
  navigate(getPilotDefaultSettingsRoute(), { replace: true });
}, [activeSection, isPilotParticipant, navigate]);
```

`isPilotParticipant` pochodzi z `isPilotParticipantRole(currentUser?.role)`
(`src/utils/pilotAccess.ts:90`), która deleguje do `isPilotRestrictedRole`
(`src/utils/roleGuards.ts:54`) — a ta funkcja wprost obejmuje `'MEMBER'` i `'TEAM_MEMBER'`
(linie 15-16). `isPilotAllowedSettingsSection` (`pilotAccess.ts:127-132`) dopuszcza tylko
cztery sekcje: `profile`, `auth-access`, `language`, `theme` — z pięciu mierzonych przez odbiór
124 tylko Profil jest w tej liście. `navigate(...)` nie poprzedza ani nie towarzyszy mu żaden
`toast`, `alert` ani baner — użytkownik MEMBER klikający w link do Regionalizacji ląduje z
powrotem na Profilu bez jednego słowa wyjaśnienia, jakby link nigdy nie istniał.

To NIE jest bug uprawnień (ograniczenie MEMBER do czterech sekcji podczas pilota jest świadomą
decyzją produktową, `PILOT_ALLOWED_SETTINGS_SECTIONS` istnieje właśnie po to). To jest brak
komunikatu przy egzekwowaniu tej decyzji — CLAUDE.md nazywa to wprost regułą UI: ekran ma
mówić „możesz/nie możesz i dlaczego”, nie milczeć.

**Druga.** Rekonesans zamknięcia 16 modułów (`docs/program/funkcje/REKONESANS_ZAMKNIECIA_16_MODULOW.md`,
tabela „Tezy OBALONE") zmierzył:

```
„UsageMeters wywala pasek boczny" (nadzorca) → Bug t() realny (UsageMeters.tsx:174), ale
komponent martwy — SidebarUsage ma zero importerów. Priorytet: sprzątanie, nie P0.
```

Weryfikacja dzisiejsza potwierdza oba fakty osobno:

```ts
// src/components/billing/UsageMeters.tsx — brak importu useTranslation, brak `const { t }`
// linia 174:
{t('billing.usage.resetsOn', 'Limit odnowi się {{date}}', { date: ... })}
```

`t` nie jest zadeklarowane nigdzie w pliku (`grep -n "useTranslation\|const { t }"` nie
zwraca nic) — to realny, żywy bug, bo `UsageMeters` NIE jest martwy: importują go
`src/components/settings/BillingSettings.tsx` i `src/components/shared/BillingCore.tsx` (obok
martwego `SidebarUsage.tsx`). Osobno, `SidebarUsage.tsx` sam ma zero importerów w całym `src/`
(`grep -rln "SidebarUsage" src/` zwraca wyłącznie własny plik) — martwy komponent, ale nie jego
zależność.

# 2. TEZY ZLECENIA

- **T1.** MEMBER ma dziś prawo widzieć tylko cztery sekcje Ustawień podczas pilota — to nie
  podlega zmianie w tym dyżurze. Zmienia się WYŁĄCZNIE to, czy użytkownik dostaje o tym
  informację w momencie odbicia.
- **T2.** `UsageMeters.tsx:174` jest błędem kompilacji/runtime w żywym, importowanym komponencie
  (nie martwym) — napraw przez dodanie brakującego `useTranslation`, bez zmiany treści komunikatu
  ani klucza tłumaczenia.
- **T3.** `SidebarUsage.tsx` jest martwym kodem (zero importerów) — to fakt do zainwentaryzowania
  w raporcie dla właściciela, nie do skasowania w tym dyżurze.

# 3. POZYCJE DYŻURU

## R1 — uczciwy komunikat przy przekierowaniu MEMBER

Zmień wyłącznie blok `src/views/SettingsView.tsx:281-284`. Dodaj widoczny dla użytkownika
komunikat (toast lub równoważny baner, wzorem istniejących wywołań `toast.success`/`toast.error`
w `src/components/settings/AI*.tsx`, np. `AIAutoCompleteSettings.tsx:89`) tuż przed lub w tym
samym efekcie co `navigate(...)`. Treść przez `t()` z nowym kluczem w konwencji `settings.*`
(plik już ma `const { t } = useTranslation()` w linii 241) i polskim tekstem wyjaśniającym, że
sekcja nie jest dostępna dla roli użytkownika podczas pilota — np. w duchu „Ta sekcja nie jest
dostępna w Twojej roli. Skontaktuj się z administratorem, jeśli potrzebujesz dostępu" (dopasuj
brzmienie do stylu istniejących komunikatów w tym samym pliku/module, nie kopiuj mechanicznie).

Plik nie importuje dziś `react-hot-toast` — sprawdź `grep -n "^import" src/views/SettingsView.tsx`
i dodaj import w kolejności zgodnej z resztą pliku.

Nie dotykaj sąsiednich efektów w tym samym pliku: przekierowanie legacy-alias (linie 252-270) i
przekierowanie ukrytych sekcji SET-28/`shortcuts` (linie 292-306) mają inny powód (funkcjonalny,
nie rolowy) i nie są w zakresie R1.

**Ukończone, gdy:** MEMBER, który wejdzie na `/settings/security` (lub dowolną z pozostałych
trzech zablokowanych sekcji), widzi komunikat błędu ORAZ ląduje na Profilu — obie rzeczy naraz,
nie tylko przekierowanie.

## R2 — inwentarz, nie kasowanie: UsageMeters + SidebarUsage

Napraw wyłącznie brak `useTranslation`/`t` w `UsageMeters.tsx` (dodaj import i hook, zachowaj
istniejący klucz `billing.usage.resetsOn` i domyślny polski tekst — zero zmian treści). To jest
naprawa błędu w żywym komponencie, nie sprzątanie.

`SidebarUsage.tsx` (zero importerów) NIE kasujesz. Wypisz w raporcie: pełną ścieżkę pliku, fakt
zerowej liczby importerów (dowód: `grep -rln "SidebarUsage" src/`), oraz że komponent w obecnym
stanie odziedziczyłby ten sam bug `t()` po naprawie `UsageMeters`, gdyby kiedyś został podłączony
— to do osobnej decyzji właściciela (skasować martwy komponent czy podłączyć go).

**Ukończone, gdy:** `UsageMeters.tsx` renderuje się bez `ReferenceError`/ostrzeżenia dla brakującej
zmiennej `t` w scenariuszu z ustawionym `periodEnd`, a raport zawiera jednoznaczny wpis
inwentarzowy dla `SidebarUsage.tsx` z cytatem dowodu.

## R3 — dowody

Dla R1: test (lokalizację potwierdź wg konwencji najbliższej `SettingsView.tsx` — sprawdź, czy
istnieje `src/views/__tests__/` lub `tests/components/views/`, dopasuj) symulujący MEMBER-a
wchodzącego na zablokowaną sekcję Ustawień i sprawdzający, że w warstwie `toast`/na ekranie
pojawia się komunikat błędu — nie tylko że `navigate` zostało wywołane.

Dla R2: test renderujący `UsageMeters` z niepustym `usage.periodEnd` i potwierdzający brak
błędu/ostrzeżenia związanego z `t`, plus render smoke-test dowodzący, że tekst nadal pokazuje
poprawną polską frazę z podstawioną datą.

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis | `src/views/SettingsView.tsx` — wyłącznie efekt pilota, linie 281-284, i jego import `toast` |
| Zapis | `src/components/billing/UsageMeters.tsx` — wyłącznie import `useTranslation` i hook `const { t }`; zakaz zmiany treści komunikatu i klucza `billing.usage.resetsOn` |
| Zapis | testy `day176.*` — lokalizację potwierdź wg konwencji sąsiadującej z każdym zmienianym plikiem |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY176_USTAWIENIA_REPORT.md` |
| Odczyt | `src/components/SidebarUsage.tsx` — dowód inwentarza; **nie zmieniasz, nie kasujesz** |
| Odczyt | `src/utils/pilotAccess.ts`, `src/utils/roleGuards.ts` — źródło reguły pilota; nie zmieniasz |
| Odczyt | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY124_USTAWIENIA_OWNER_REPORT.md` — dowód R1; nie zmieniasz |
| Odczyt | `docs/program/funkcje/REKONESANS_ZAMKNIECIA_16_MODULOW.md` — dowód R2; nie zmieniasz |
| Odczyt | `src/components/settings/BillingSettings.tsx`, `src/components/shared/BillingCore.tsx` — importerzy `UsageMeters`, kontekst żywego użycia; nie zmieniasz |

**Nietykalne imiennie:** `docs/program/waves/WAVE_03_ACCEPTANCE/modules/15_SETTINGS/MODULE_ACCEPTANCE.md`
(CLOSED_FINAL, werdykt bez zmian); `PILOT_ALLOWED_SETTINGS_SECTIONS`/`isPilotAllowedSettingsSection`
w `pilotAccess.ts` (zakres sekcji dla MEMBER — decyzja produktowa, nie ta naprawa); przekierowania
legacy-alias i SET-28 w `SettingsView.tsx` poza liniami 281-284.

★ **Rozłączność z dyżurami działającymi równolegle (177 Partner, 178 Ocena, 179 Czat) oraz z
173/175:** 173 (`InitiativeTasksTab.tsx`, `UserTaskList.tsx`, `Portfolio/InitiativeSidePanel.tsx`,
`Initiatives/calendar/InitiativeCalendar.tsx`, `MyWork/DecisionDetailView.tsx` blok odczytu klucza,
root `vitest.config.ts`), 175 (`TaskDetailView.tsx` autozapis). Żaden z plików tego dyżuru
(`SettingsView.tsx`, `UsageMeters.tsx`, `SidebarUsage.tsx`) nie pokrywa się z żadnym z powyższych.

# 5. TWARDE ZASADY

- ★ **NIE OTWIERASZ CLOSED_FINAL Ustawień.** Werdykt `MODULE_ACCEPTANCE.md` się nie zmienia — to
  domknięcie pozycji rekonesansu.
- **NIE KASUJESZ martwego kodu** (`SidebarUsage.tsx`) — inwentaryzujesz, nie usuwasz.
- **Nie zmieniasz zakresu sekcji dostępnych dla MEMBER** — tylko dodajesz komunikat przy już
  istniejącym przekierowaniu.
- **Nie zmieniasz wyglądu** poza dodaniem brakującego komunikatu (toast/baner tekstowy) i naprawą
  brakującego `useTranslation`.
- **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.** Wszystko lokalnie.
- Pułapka: `No test files found` NIE jest `PASS`. Sprawdź `numTotalTests` > 0 w każdym wyniku,
  który przywołujesz jako dowód.
- ★ Port **5000 jest zajęty na stałe przez macOS Control Center** — nie używaj go do żadnego
  serwera pomocniczego.
- Wymóg sekcji „TWIERDZENIA NIEZWERYFIKOWANE" w raporcie końcowym — wypisz w niej wprost, jeśli
  nie zdążyłeś zweryfikować renderowania wszystkich czterech zablokowanych sekcji (Regionalizacja,
  Powiadomienia, Bezpieczeństwo, Dane i prywatność) w obu motywach po zmianie, albo jeśli test R3
  dla `UsageMeters` pokrył tylko jeden z dwóch komponentów zależnych.
