# INSTRUKCJA DYŻURU nr 202 — Codex — „Spotkania — i18n listy/kalendarza/podglądu po polsku, rozłącznie z obiektem spotkania (dyżur 194)"

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
> **wyłącznie** `/private/tmp/cx-day202-spotkania-i18n`.

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
Zakres: **08_MEETINGS — i18n listy + kalendarza + podglądu (`MeetingHub.tsx`); NIE dotykamy `MeetingObjectPage.tsx` (strona obiektu = dyżur 194, rozłączność sprawdzona przy wydaniu, patrz `DLACZEGO`)**.
Trasy front: ``src/components/Meeting/MeetingHub.tsx` (PEŁNA licencja w zakresie i18n — teksty, nie logika), `public/locales/pl/translation.json` i `public/locales/en/translation.json` (WYŁĄCZNIE dopisywanie kluczy pod `meeting.*`, parytet PL+EN w tym samym commicie)`. Trasy tył: `brak — ten dyżur nie dotyka `server/**``.

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
WT=/private/tmp/cx-day202-spotkania-i18n
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
git -C "$VAULT" worktree add "$WT" -b codex/day202-spotkania-i18n-20260831 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day202-spotkania-i18n/config.worktree"
cat "$VAULT/worktrees/cx-day202-spotkania-i18n/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day202-spotkania-i18n-scratch
mkdir -p /private/tmp/cx-day202-spotkania-i18n-artefakty

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
git -C "$WT" push github-backup codex/day202-spotkania-i18n-20260831
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 60581ed6b5..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `pięć` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day202-spotkania-i18n

# (T1) CYTAT ODBIORU 181 — trzy angielskie frazy + sluggi
grep -n "Could not load the operator brief\|surowe sluggi\|niemal w całości po angielsku" docs/program/funkcje/ODBIOR_181_SPOTKANIA_OTWARCIE.md
#   oczekiwane: trzy trafienia dosłowne w sekcji "Dla toru grafiki / rejestru".

# (T2) TE FRAZY MAJĄ DZIŚ t() + PL W TRANSLATION.JSON — sprawdź, zanim uznasz je za brakujące
grep -n "meeting.empty\|meeting.sync.workspace\|meeting.operatorBriefError" src/components/Meeting/MeetingHub.tsx
python3 -c "import json; d=json.load(open('public/locales/pl/translation.json')); print(d.get('meeting',{}).get('empty'), d.get('meeting',{}).get('sync',{}).get('workspace'), d.get('meeting',{}).get('operatorBriefError'))"
#   oczekiwane: t() wywołania istnieją; PL string niepusty dla wszystkich trzech.

# (T3) SWEEP JEST STARY — zweryfikuj wiek i rozbieżność z dzisiejszym stanem pliku
git log -1 --format=%cd scripts/i18n-sweep/residue_meeting.txt
git rev-list --count $(git log -1 --format=%H -- scripts/i18n-sweep/residue_meeting.txt)..HEAD
sed -n '1165,1177p' src/components/Meeting/MeetingHub.tsx
#   oczekiwane: sweep sprzed tysięcy commitów; okolica starej linii 1170 ma dziś t() (rozbieżność potwierdzona).

# (T4) DYŻUR 194 DOTYKA WYŁĄCZNIE MeetingObjectPage.tsx
git diff --name-only 6894f3da05 github-backup/codex/day194-obiekt-spotkania-20260831 -- src server
#   oczekiwane: dokładnie MeetingObjectPage.tsx + jego test + jeden server test; BRAK MeetingHub.tsx.

# (T5) ATTENDEES = WOLNY TEKST, NIE ID — sprawdź, zanim zbudujesz resolver
grep -n "attendees: string\[\]\|attendees.join" src/components/Meeting/MeetingHub.tsx
grep -n "users.find(u => u.id === meeting.createdBy)" src/components/Meeting/MeetingObjectPage.tsx
#   oczekiwane: attendees to string[] wolnego tekstu w MeetingHub; jedyny realny resolver ID->nazwa jest w MeetingObjectPage.tsx (poza licencją).
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day202-spotkania-i18n-20260831` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6132`. Twój JEDYNY port harnessu to `5074 i 5075`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day202-pg`**. **ZAKAZANE:** `6012, 5433, 6047, 6054-6129, 5010-5069, 6404-6411 (odbiory nadzorcy + dyżury 170-196), 6130/5070-5071 (dyżur 198, ta sama partia — NIE używaj), 6131/5072-5073 (dyżur 200, ta sama partia — NIE używaj), 6120/… (dyżur 194, obiekt spotkania — jeśli jeszcze żywy, NIE używaj, sprawdź `docker ps` sam). ★ PORT 5000 ZAJĘTY NA STAŁE przez macOS Control Center. ★ PORT 5037 zajęty przez adb`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak — ten dyżur NIE wprowadza ani jednej nowej flagi i NIE zmienia wartości domyślnej żadnej istniejącej`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY202_SPOTKANIA_I18N_REPORT.md`. Nie zmieniasz `docs/program/waves/WAVE_03_ACCEPTANCE/modules/08_MEETINGS/MODULE_ACCEPTANCE.md` — ten dyżur nie jest ponownym odbiorem wizualnym całego modułu (obiekt spotkania pozostaje osobno blokujący, dyżur 194), tylko domknięciem i18n na liście/kalendarzu/podglądzie. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day202-spotkania-i18n-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day202-spotkania-i18n-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **ZAKAZ dotykania `src/components/Meeting/MeetingObjectPage.tsx` w JAKIMKOLWIEK zakresie** — nawet jednej linii i18n. To wyłączny teren dyżuru 194 (`git diff --name-only 6894f3da05 github-backup/codex/day194-obiekt-spotkania-20260831` — jedyne pliki produktowe: `MeetingObjectPage.tsx` + jego test). Jeśli podczas R1 znajdziesz angielskie teksty w tym pliku, wypisujesz je w raporcie jako `DO ROZWAŻENIA PRZEZ DYŻUR 194 (lub następcę)`, NIE naprawiasz. **ZAKAZ budowania resolvera ID→nazwa dla `attendees`, jeśli pomiar (T5) potwierdzi, że pole jest wolnym tekstem, nie referencją do użytkownika** — nie ma czego rozwiązywać; jeśli mimo to znajdziesz GDZIEŚ w `MeetingHub.tsx` realny slug/ID pokazywany zamiast nazwy, a backend NIE MA API do rozwiązania go na nazwę, oznacz to jawnie jako `DO_ZBUDOWANIA` (pozycja do decyzji właściciela), nie buduj prowizorycznego mapowania na sztywnej liście w froncie. **ZAKAZ ufania `scripts/i18n-sweep/residue_meeting.txt`/`missingT_meeting.txt`/`keys_meeting*.json` bez świeżej weryfikacji** — dane są sprzed >10 000 commitów (T3), część już naprawiona; traktuj je jako listę kandydatów do sprawdzenia, nie jako gotową listę do mechanicznego zaaplikowania. **ZAKAZ zmiany istniejących wartości w `translation.json`** — wyłącznie dopisywanie NOWYCH kluczy; jeśli klucz istnieje i ma sensowną wartość PL, ale runtime mimo to renderuje EN, przyczyna jest w kodzie/detekcji języka, nie w treści klucza — nie "popraw" wartości, których nie trzeba poprawiać. **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.** | `ODBIOR_181_SPOTKANIA_OTWARCIE.md` (dosłownie): „Interfejs Meetings niemal w całości po angielsku (pierwszy kontakt właściciela!); »Could not load the operator brief« na podglądzie; surowe sluggi uczestników”. Weryfikacja dzisiejsza jest BARDZIEJ NIUANSOWA niż to zdanie sugeruje — trzy odrębne mechanizmy, nie jeden brakujący `t()`: **(1) Realny, nienaprawiony brak `t()`.** `scripts/i18n-sweep/residue_meeting.txt` (z komitu `f7ae10c545`, **10297 commitów przed tym markerem** — STARE, traktuj jako kandydatów do ponownej weryfikacji, nie fakty) wylicza ~38 lokalizacji `NO_t_inScope` w `MeetingHub.tsx`, głównie w `MeetingCalendarView` (linie wg starego stanu pliku ok. 1170-1534). Część z nich jest już naprawiona — sprawdzone dziś: linie w okolicy starego `1170` mają dziś `t('meeting.modal.note', …)`/`t('common.cancel', 'Cancel')` — czyli plik dostał i18n-pracę PO tym sweepie i lista jest częściowo nieaktualna. R1 musi wygenerować listę NA NOWO (`node scripts/i18n-sweep/check-global.mjs` albo analogiczny świeży grep), nie kopiować starą. **(2) Klucz ma `t()`, ma PL, a mimo to `ODBIOR_181` widział angielski.** Zweryfikowane wprost: `meeting.empty` (PL: „Brak spotkań”), `meeting.sync.workspace` (PL: „Wspólna przestrzeń”), `meeting.operatorBriefError` (PL: „Nie udało się załadować briefu operatora.”), `meeting.previousMonth`/`meeting.today`/`meeting.nextMonth`/`meeting.more` — WSZYSTKIE mają dziś parytet PL+EN w `public/locales/*/translation.json`, i wszystkie miejsca w `MeetingHub.tsx` je poprawnie wołają przez `t()`. Jeśli mimo to zrzut `ODBIOR_181` pokazał angielski, przyczyna leży w RUNTIME — `src/i18n.ts` używa `i18next-browser-languagedetector` (wykrywanie z przeglądarki/localStorage, nie sztywne PL) — R1 musi zmierzyć, czy to jest bug wykrywania języka w harnessie zrzutów, czy realny błąd ładowania namespace, ZANIM założy, że brakuje tłumaczenia, które w rzeczywistości już istnieje. **(3) `MeetingObjectPage.tsx` jest WYŁĄCZONY z tego dyżuru.** `git show github-backup/codex/day194-obiekt-spotkania-20260831 --stat` i `git diff --name-only 6894f3da05 github-backup/codex/day194-obiekt-spotkania-20260831` pokazują, że dyżur 194 dotyka WYŁĄCZNIE `src/components/Meeting/MeetingObjectPage.tsx` (+ jego testy) — jedyny inny plik w katalogu `src/components/Meeting/` obok `MeetingHub.tsx`. `ODBIOR_181` sam stwierdza: „lista+kalendarz działają, obiekt NIE — 12/21 spinnerów”, więc obiekt spotkania jest osobnym, już przypisanym torem. „Surowe sluggi uczestników” z cytatu `ODBIOR_181` NIE zostało dziś znalezione w `MeetingHub.tsx` — pole `attendees` tam i w `MeetingObjectPage.tsx` jest zwykłym `string[]` (wolny tekst wpisywany w formularzu, `attendees.join(', ')`), bez żadnego ID/sluga do rozwiązania. Jedyny zmierzony dziś rzeczywisty resolver ID→nazwa dotyczy pola `createdBy`/„Organizer” w `MeetingObjectPage.tsx:1120` (`users.find(u => u.id === meeting.createdBy)`) — czyli w pliku dyżuru 194, nie w zakresie tego dyżuru. R1 musi to zmierzyć na świeżo (może to być stara/nieaktualna obserwacja, albo zjawisko wyłącznie w obiekcie), nie zakładać z góry, gdzie sluggi się pojawiają. |

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
cd /private/tmp/cx-day202-spotkania-i18n

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day202-pg psql -U postgres -d consultify_w3_meetings_owner_cx202 \
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
cd /private/tmp/cx-day202-spotkania-i18n

docker run -d --name cx-day202-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=consultify_w3_meetings_owner_cx202 \
  -p 127.0.0.1:6132:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day202-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6132/consultify_w3_meetings_owner_cx202 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6132/consultify_w3_meetings_owner_cx202 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day202-spotkania-i18n && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6132/consultify_w3_meetings_owner_cx202 \
JWT_SECRET=cx202-test-secret-do-not-reuse \
npx vitest run src/components/Meeting/__tests__, tests/unit/i18n --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day202-spotkania-i18n-artefakty/day202-meetings-i18n.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day202-spotkania-i18n && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run src/components/Meeting/__tests__, tests/unit/i18n --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day202-spotkania-i18n-artefakty/day202-meetings-i18n.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day202-spotkania-i18n/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day202-pg psql -U postgres -d consultify_w3_meetings_owner_cx202 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day202-pg`.
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
> **(e) ★★ **Pierwsza — nie myl "brak `t()`" z "jest `t()`, ale runtime pokazał EN".** To dwa różne finding-y wymagające dwóch różnych napraw (kod vs. albo nic, albo diagnoza detekcji języka) — sklasyfikuj KAŻDY tekst z inwentarza R1 do jednej z trzech kategorii z `DLACZEGO`, zanim zaczniesz cokolwiek zmieniać. **Druga — `src/i18n.ts` używa `i18next-browser-languagedetector`, nie sztywnego `lng: 'pl'`.** Jeśli Twój harness dev-render/zrzutów nie wymusza jawnie języka (np. przez `i18n.changeLanguage('pl')` albo parametr URL/`localStorage['i18nextLng']='pl'` PRZED renderem), zrzuty „po polsku” mogą i tak wyjść po angielsku z przyczyn niezwiązanych z brakującymi kluczami — sprawdź mechanizm wymuszenia języka w harnessie PRZED oskarżeniem kodu produktu. **Trzecia — `MeetingCalendarView` to osobny podkomponent wewnątrz `MeetingHub.tsx`** (od linii ok. 1497), z własnym `const { t } = useTranslation()` — literały w nim (nazwy dni tygodnia, etykiety miesięcy, jeśli renderowane przez `toLocaleDateString`) mogą pochodzić z `Intl`/`Date` (`locale` przekazywane jako `isPolish ? 'pl-PL' : 'en-US'`), nie z `translation.json` — nie próbuj i18n-ować przez klucze czegoś, co już poprawnie idzie przez `Intl` z właściwym locale; sprawdź źródło KAŻDEGO tekstu przed decyzją o mechanizmie naprawy. **Czwarta — zrzuty kontrolne R3 muszą pokazywać RZECZYWISTY, świeżo wygenerowany stan, nie ponownie stare zrzuty `docs/qa/screens/meeting/operator-brief-*-ERR.png`** widoczne w repo (to dowody STAREGO błędu, sprzed napraw) — nowe zrzuty idą do `/private/tmp/cx-day202-spotkania-i18n-artefakty`, nie nadpisują starych dowodowych plików w `docs/qa/screens/meeting/`. **Piąta — `meetingBetaGate`/beta-lock na module Meeting jest realny i osobny od i18n** (`tests/unit/backend/middleware/meetingBetaGate.test.ts`) — jeśli Twój harness dostanie `403 BETA_LOCKED` zamiast ekranu, to NIE jest błąd i18n, to inna bramka; nie „napraw” jej w tym dyżurze, tylko upewnij się, że Twój login/fixture ma dostęp (rolę spoza zamkniętej bety) zanim uznasz ekran za niedziałający.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day202-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day202-spotkania-i18n-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`pozycja R1 — inwentarz kompletny i sklasyfikowany (t()-brakujący vs. klucz-bez-PL vs. środowisko-nie-po-polsku), nie zgadywany`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6132` albo `5074 i 5075` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6132` albo `5074 i 5075`** (`Z7`).

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

`ODBIOR_181_SPOTKANIA_OTWARCIE.md` (`docs/program/funkcje/ODBIOR_181_SPOTKANIA_OTWARCIE.md`),
sekcja „Dla toru grafiki / rejestru”, mówi dosłownie:

```
Interfejs Meetings niemal w całości po angielsku (pierwszy kontakt właściciela!);
„Could not load the operator brief" na podglądzie; surowe sluggi uczestników;
```

Ten cytat jest realny i jest punktem wyjścia — ale weryfikacja dzisiejsza pokazuje obraz
BARDZIEJ NIUANSOWY niż „brakuje `t()`”, i ten dyżur musi go rozplątać na trzy osobne mechanizmy,
zanim cokolwiek naprawi.

**Mechanizm 1 — realny, dziś jeszcze nienaprawiony brak `t()`.** Istnieje historyczny sweep
i18n (`scripts/i18n-sweep/residue_meeting.txt`, `missingT_meeting.txt`, `keys_meeting.json`,
`keys_meeting_agent.json`), pochodzący z komitu `f7ae10c545` — **10297 commitów przed tym
markerem**. Lista wskazuje ok. 38 miejsc `NO_t_inScope` w `MeetingHub.tsx`, głównie w
`MeetingCalendarView`. Sprawdzone dziś: część z nich jest już naprawiona (np. okolica starej linii
1170 ma dziś `t('meeting.modal.note', …)` i `t('common.cancel', 'Cancel')`) — plik dostał i18n-pracę
po tym sweepie, i stara lista jest częściowo nieaktualna. Traktuj ją jako listę KANDYDATÓW do
ponownego sprawdzenia, nie jako gotowy plan robót.

**Mechanizm 2 — klucz ma `t()`, ma tłumaczenie PL, a mimo to `ODBIOR_181` widział angielski.**
Zweryfikowane wprost w `public/locales/pl/translation.json`:

```
meeting.empty              -> "Brak spotkań"
meeting.sync.workspace     -> "Wspólna przestrzeń"
meeting.operatorBriefError -> "Nie udało się załadować briefu operatora."
meeting.previousMonth      -> "Poprzedni miesiąc"
meeting.today              -> "Dziś"
meeting.nextMonth          -> "Następny miesiąc"
meeting.more               -> "więcej"
```

Wszystkie te klucze SĄ wołane przez `t()` w `MeetingHub.tsx` w miejscach dokładnie odpowiadających
cytowanym angielskim frazom z `ODBIOR_181` („No meetings yet” = `meeting.empty`, „Shared workspace”
= `meeting.sync.workspace`, „Could not load the operator brief.” = `meeting.operatorBriefError`).
Innymi słowy: kod i tłumaczenie są już poprawne dla dokładnie tych fraz, które recenzent zacytował
jako angielskie. To silny sygnał, że przyczyna leży w RUNTIME, nie w treści — `src/i18n.ts` używa
`i18next-browser-languagedetector` (wykrywanie języka z przeglądarki/localStorage, nie sztywne
`pl`), więc ekran renderowany bez jawnego wymuszenia języka może pokazać EN niezależnie od tego, co
jest w plikach tłumaczeń. R1 musi to zmierzyć — czy to bug wymuszania języka w harnessie zrzutów
`ODBIOR_181`, czy realny błąd ładowania namespace w konkretnym stanie ekranu — zamiast automatycznie
zakładać brakującą treść, której nie brakuje.

**Mechanizm 3 — zakres wyłączony: `MeetingObjectPage.tsx` należy do dyżuru 194.**
`src/components/Meeting/` ma dokładnie dwa pliki produktowe: `MeetingHub.tsx` (lista + kalendarz +
podgląd — ten dyżur) i `MeetingObjectPage.tsx` (pełny obiekt spotkania). `ODBIOR_181` sam to
rozgranicza: „lista+kalendarz działają, obiekt NIE — 12/21 spinnerów […] dyżur 194 (181-bis): strona
obiektu spotkania”. Sprawdzone dziś na branchu dyżuru 194:

```
git diff --name-only 6894f3da05 github-backup/codex/day194-obiekt-spotkania-20260831 -- src server
  server/src/routes/__tests__/meeting.object.day194.pg.test.ts
  src/components/Meeting/MeetingObjectPage.tsx
  src/components/Meeting/__tests__/MeetingObjectPage.test.tsx
```

Dokładnie i wyłącznie `MeetingObjectPage.tsx` (+ testy). Co do „surowych sluggów uczestników” z
cytatu `ODBIOR_181` — pole `attendees` jest w OBU plikach zwykłym `string[]` wolnego tekstu
(formularz z `textarea`, `splitLines`/`attendees.join('\n')`), bez żadnego ID/sluga użytkownika do
rozwiązywania. Jedyny realny resolver ID→nazwa znaleziony dziś w module dotyczy pola
`createdBy`/„Organizer” w `MeetingObjectPage.tsx:1120`
(`const organizerUser = users.find((u) => u.id === meeting.createdBy)`) — a to jest w pliku, którego
ten dyżur NIE dotyka. Jeśli R1 potwierdzi, że sluggi pojawiają się wyłącznie tam, pozycja idzie do
raportu jako `DO ROZWAŻENIA PRZEZ DYŻUR 194`, nie jest naprawiana tutaj.

# 2. TEZY ZLECENIA

- **T1.** Cytat `ODBIOR_181` jest realny, ale jego trzy elementy (angielski ogólnie / operator brief
  / sluggi) mają być zmierzone OSOBNO — nie jest gwarantowane, że wszystkie trzy mają tę samą
  przyczynę ani że wszystkie trzy są dziś jeszcze aktualne.
- **T2.** Sweep `scripts/i18n-sweep/residue_meeting.txt` i towarzyszące pliki są kandydatami
  sprzed >10 000 commitów — część już naprawiona. R1 wymaga świeżego pomiaru (regeneracja albo
  ręczny grep na obecnym stanie pliku), nie kopiowania starej listy.
- **T3.** `MeetingObjectPage.tsx` jest wyłączony z licencji tego dyżuru w całości — potwierdzone
  diffem branchu 194. Wszystko, co R1 znajdzie w tym pliku, trafia do raportu jako pozycja dla
  innego toru, nie jest naprawiane tutaj.
- **T4.** „Sluggi uczestników” prawdopodobnie NIE dotyczą pola `attendees` (wolny tekst w obu
  plikach) — jeśli tak, teza `ODBIOR_181` w tej części jest albo nieaktualna, albo dotyczy innego,
  jeszcze niezidentyfikowanego miejsca, które R1 musi albo znaleźć z dowodem, albo obalić z
  dowodem.

# 3. POZYCJE DYŻURU

## R1 — inwentarz angielskich tekstów Meetings, sklasyfikowany (rdzeń)

Zbuduj w raporcie tabelę WSZYSTKICH angielskich tekstów produktowych w `MeetingHub.tsx` (lista,
kalendarz, modal edycji, podgląd/preview), jeden wiersz na tekst, kolumny:

- tekst (cytat) i lokalizacja (plik:linia, na DZISIEJSZYM stanie pliku, nie ze starego sweepu),
- kategoria: **(A) brak `t()`** — realny kod do naprawy w R2; **(B) `t()` + brak klucza PL** —
  dopisanie klucza w `translation.json`; **(C) `t()` + klucz PL istnieje** — runtime/detekcja
  języka, nie treść; opisz DOWÓD dla tej kategorii (np. render testu z jawnym `i18n.changeLanguage('pl')`
  pokazujący poprawny PL — jeśli test przechodzi, przyczyna faktycznie leży poza treścią klucza),
- czy dotyczy `MeetingHub.tsx` (w zakresie) czy `MeetingObjectPage.tsx` (poza zakresem — wypisz, nie
  napraw).

Osobno zbadaj „sluggi uczestników”: zmierz DOKŁADNIE, gdzie w renderowanym UI (lista, kalendarz,
podgląd) mógłby pojawić się surowy identyfikator zamiast nazwy — sprawdź pole `attendees` (wolny
tekst — prawdopodobnie nie to), `createdBy` (ma resolver, ale w wyłączonym pliku), i wszelkie inne
pola referencyjne, jakie znajdziesz. Jeśli w zakresie `MeetingHub.tsx` istnieje resolver API, użyj
go; jeśli nie istnieje żadne API do rozwiązania ID→nazwa, oznacz pozycję `DO_ZBUDOWANIA` z
uzasadnieniem, nie buduj prowizorki.

**Ukończone, gdy:** tabela inwentarza jest kompletna dla `MeetingHub.tsx` (nie tylko powtórzenie
starego sweepu), każdy wiersz ma kategorię A/B/C z dowodem, i jest jawne rozstrzygnięcie („znaleziono
w pliku:linia” albo „nie znaleziono w zakresie tego dyżuru, patrz dyżur 194”) dla wątku sluggów.

## R2 — wykonanie

Dla kategorii (A): dodaj `t()` z kluczem w konwencji `meeting.*`, wzorem istniejących wywołań w tym
samym pliku; dopisz PL+EN w tym samym commicie (`public/locales/pl/translation.json`,
`public/locales/en/translation.json`) — WYŁĄCZNIE nowe klucze, zero zmian istniejących wartości.

Dla kategorii (B): dopisz brakującą wartość PL (i EN, jeśli też brakuje) dla istniejącego klucza —
nie zmieniasz nazwy klucza ani miejsca wywołania w kodzie.

Dla kategorii (C): NIE zmieniasz treści klucza (już poprawna). Zdiagnozuj i, jeśli to bug produktu
(nie tylko artefakt harnessu zrzutów), napraw najwęższą możliwą zmianą — np. jeśli namespace
`translation` ładuje się asynchronicznie i komponent renderuje się przed jego gotowością (wyścig),
to jest realny bug do naprawienia; jeśli to wyłącznie brak wymuszenia języka w Twoim własnym
harnessie zrzutów, to NIE jest bug produktu — opisz to jako ustalenie, nie jako naprawę.

Dla wątku sluggów: napraw WYŁĄCZNIE jeśli dowód R1 wskazuje miejsce wewnątrz `MeetingHub.tsx` z
istniejącym API do rozwiązania. W przeciwnym razie zostaw jako `DO_ZBUDOWANIA` w raporcie.

**Ukończone, gdy:** każda pozycja kategorii A i B ma commit, parytet PL+EN w tym samym commicie, i
żadna wartość istniejącego klucza nie została zmieniona (`git diff` na `translation.json` pokazuje
wyłącznie dodane linie w obiektach, nie zmienione).

## R3 — zrzuty kontrolne: lista + kalendarz + podgląd po polsku, ×2 motywy

Przez kanoniczny runtime (`scripts/dev/start-wave3-owner-runtime.mjs`, baza
`consultify_w3_meetings_owner_cx202`), z JAWNIE wymuszonym językiem PL (nie poleganie na domyślnej
detekcji przeglądarki — ustaw `i18n.changeLanguage('pl')`/`localStorage['i18nextLng']='pl'` przed
renderem i potwierdź to w raporcie). Zrzuty: lista (pełna + pusta, jeśli osiągalna), kalendarz,
podgląd z otwartym operator briefem — jasny i ciemny motyw. Nowe zrzuty do `/private/tmp/cx-day202-spotkania-i18n-artefakty`, NIE
nadpisujesz istniejących dowodowych plików w `docs/qa/screens/meeting/` (to dowody stanu
historycznego).

Jeśli harness zwróci `403 BETA_LOCKED` zamiast ekranu — to jest inna bramka
(`meetingBetaGate`/`closedBetaModuleGate`), nie i18n; upewnij się, że fixture/rola logowania ma
dostęp, zanim uznasz ekran za zepsuty.

**Ukończone, gdy:** masz komplet zrzutów (lista/kalendarz/podgląd × jasny/ciemny) z potwierdzeniem
w raporcie, że język był jawnie wymuszony na PL, i żaden z tekstów z kategorii A/B z R1 nie jest już
widoczny po angielsku na tych zrzutach.

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis | `src/components/Meeting/MeetingHub.tsx` — WYŁĄCZNIE teksty/i18n (kategorie A/C), zakaz zmiany logiki poza tym, co i18n wymaga |
| Zapis | `public/locales/pl/translation.json`, `public/locales/en/translation.json` — WYŁĄCZNIE dopisywanie kluczy pod `meeting.*`, parytet PL+EN w tym samym commicie, zakaz zmiany istniejących wartości |
| Zapis | testy `day202.*` — `src/components/Meeting/__tests__/`, `tests/unit/i18n/` |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY202_SPOTKANIA_I18N_REPORT.md` |
| Odczyt | `src/components/Meeting/MeetingObjectPage.tsx` i jego testy — **TYLKO ODCZYT, bezwzględnie**; teren dyżuru 194. Znaleziska idą do raportu jako `DO ROZWAŻENIA PRZEZ DYŻUR 194` |
| Odczyt | `src/i18n.ts` — kontekst detekcji języka (kategoria C); jeśli pomiar wykaże, że wymaga zmiany, produkujesz czerwony kontrakt + brief, nie zmieniasz pliku bez jawnego, wąskiego uzasadnienia w raporcie |
| Odczyt | `scripts/i18n-sweep/residue_meeting.txt`, `missingT_meeting.txt`, `keys_meeting.json`, `keys_meeting_agent.json` — kandydaci do weryfikacji, nie źródło prawdy; nie zmieniasz |
| Odczyt | `docs/program/funkcje/ODBIOR_181_SPOTKANIA_OTWARCIE.md` — dowód tez; nie zmieniasz |

**Nietykalne imiennie:** `src/components/Meeting/MeetingObjectPage.tsx` (dyżur 194, w całości);
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/08_MEETINGS/MODULE_ACCEPTANCE.md` (żaden update w
tym dyżurze); istniejące wartości w `translation.json` (wyłącznie dopisywanie).

★ **Rozłączność z dyżurem 194 (obiekt spotkania, w toku równolegle):** zero plików wspólnych —
`MeetingHub.tsx`/`translation.json` (ten dyżur) vs. `MeetingObjectPage.tsx` (194), potwierdzone
diffem branchu przy wydaniu (`DLACZEGO`). ★ **Rozłączność z dyżurami 198 (Ocena) i 200 (Finanse):**
zero plików wspólnych — `src/components/Meeting/**`, `public/locales/*/translation.json` (klucze
`meeting.*` wyłącznie) nie pokrywają się z `src/components/assessment/**` ani
`src/components/Economics/**`/`src/components/Finance/**`. Port/baza/kontener wyłączne — patrz `Z7`.

# 5. TWARDE ZASADY

- ★ **Zero dotknięć `MeetingObjectPage.tsx`** — nawet jednej linii, nawet i18n. Teren dyżuru 194.
- **Nie zmieniasz istniejących wartości w `translation.json`** — wyłącznie nowe klucze, parytet
  PL+EN w tym samym commicie.
- **Nie budujesz resolvera sluggów, jeśli nie ma dowodu, że jest potrzebny w zakresie tego pliku** —
  `DO_ZBUDOWANIA` w raporcie zamiast prowizorki.
- **Nie ufasz staremu sweepowi bez świeżej weryfikacji** — sprzed >10 000 commitów, częściowo
  nieaktualny.
- **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.**
- Pułapka: `No test files found` NIE jest `PASS`.
- ★ Port **5000 zajęty na stałe przez macOS Control Center**; **5037 przez adb**.
- Wymóg sekcji „TWIERDZENIA NIEZWERYFIKOWANE” — wypisz wprost, jeśli kategoria (C) („`t()` + klucz
  PL istnieje, a mimo to renderuje EN”) pozostała niezdiagnozowana dla którejkolwiek pozycji, i czy
  wątek „sluggów uczestników” został znaleziony, obalony, czy pozostał otwarty jako `DO_ZBUDOWANIA`.
