# INSTRUKCJA DYŻURU nr 221 — Codex — „Warsztat Audytow (decyzja wlasciciela D-5, 30.08, postep dzis ZEROWY) — pomiar tego co istnieje, projekt archetypu, prototyp w dev-render na realistycznych mock-danych, zrzuty jasny+ciemny z dowodem realnej roznicy motywu, wpis do KOORDYNACJA.md; ZERO budowy silnika, flaga wlasna default OFF wylacznie jako scaffold"

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
> **wyłącznie** `/private/tmp/cx-day221-audyty-warsztat`.

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
Zakres: **12 Audyty — warsztat odbioru (`AUD-OR-20260829-004`, `MODULE_ACCEPTANCE.md:120`), decyzja wlasciciela `D-5` (`docs/program/funkcje/DECYZJE_WLASCICIELA_2026-08-30_WIECZOR.md:26`, runda 2, 30.08 wieczor): "BUDUJEMY WARSZTAT TERAZ" — skutek operacyjny: prototyp -> akcept wlasciciela -> budowa za flaga OFF; wpis do `docs/program/KOORDYNACJA.md`. TEN DYZUR KONCZY SIE NA PROTOTYPIE, nie na budowie**.
Trasy front: `Dzisiejsza powierzchnia (do pomiaru i NIE do zmiany): `/audit-programs` (`src/routes/AppRoutes.tsx:1625`) -> `AuditsMethodHub.tsx` (szesc zakladek StandardModuleBar). Nowa powierzchnia tego dyzuru: WYLACZNIE `dev-render/screens/day221-audyty-warsztat*.tsx` (NOWY plik, montowany w `dev-render/main.tsx`, ZERO polaczenia z realnym API/routerem produktu)`. Trasy tył: `Zero nowych tras backendowych w tym dyzurze. Odczyt WYLACZNIE: `server/src/services/audits/programService.ts`, `reportService.ts`, `outputService.ts` (jakie pola dzis istnieja, do zaprojektowania jakich dana warsztat moglby pokazac PO budowie — nie w tym dyzurze)`.

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
WT=/private/tmp/cx-day221-audyty-warsztat
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
git -C "$VAULT" worktree add "$WT" -b codex/day221-audyty-warsztat-20260901 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day221-audyty-warsztat/config.worktree"
cat "$VAULT/worktrees/cx-day221-audyty-warsztat/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day221-audyty-warsztat-scratch
mkdir -p /private/tmp/cx-day221-audyty-warsztat-artefakty

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
git -C "$WT" push github-backup codex/day221-audyty-warsztat-20260901
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 9fb7942a01..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `sześć` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day221-audyty-warsztat

# (W1) tresc decyzji D-5, doslownie
sed -n '20,27p' docs/program/funkcje/DECYZJE_WLASCICIELA_2026-08-30_WIECZOR.md
#   oczekiwane: wiersz D-5 "BUDUJEMY WARSZTAT TERAZ" (wbrew rekomendacji, decyzja swiadoma),
#   skutek: +3-4 dyzury; regula 7: prototyp->akcept->budowa za flaga OFF; wpis do KOORDYNACJA.md

# (W2) czy wpis w KOORDYNACJA.md juz istnieje (wymog D-5)
grep -in "audyt" docs/program/KOORDYNACJA.md
#   oczekiwane: ZERO trafien dotyczacych modulu 12 Audyty (dopuszczalne przypadkowe slowo w innym
#   kontekscie, np. "audytowalny" przy module nie-audytowym) — wpis wymagany przez D-5 NIE ISTNIEJE

# (W3) czy jakikolwiek prototyp dev-render dla warsztatu Audytow juz istnieje
find dev-render/screens -iname "*audit*"
#   oczekiwane: brak pliku dotyczacego warsztatu Audytow (istniejace pliki audit* naleza do
#   innych modulow/celow — zweryfikuj tresc kazdego trafienia)

# (W4) status AUD-OR-004 i czy opis "warsztat overview" istnieje gdziekolwiek jako specyfikacja
grep -n "AUD-OR-20260829-004" docs/program/waves/WAVE_03_ACCEPTANCE/modules/12_AUDITS/MODULE_ACCEPTANCE.md
grep -rl "warsztat overview" docs
#   oczekiwane: wiersz 004 OPEN, opisuje NIEODTWORZONY "warsztat overview" (18 ogniw/4 fazy/prawy
#   panel); fraza "warsztat overview" wystepuje TYLKO w MODULE_ACCEPTANCE.md i
#   CODEX_DAY109_AUDYTY_OWNER_REPORT.md — brak osobnej specyfikacji do odtworzenia, projektujesz
#   OD NOWA, nie "przywracasz" nic

# (W5) dzisiejsza powierzchnia hubu — ile zakladek, jeden czy wiecej route'ow
grep -n "id: '" src/components/Audit/method/AuditsMethodHub.tsx | grep -E "library|processes|outputs|reports|findings|initiatives"
grep -n "audit-programs\"" src/routes/AppRoutes.tsx | head -5
#   oczekiwane: szesc zakladek StandardModuleBar, jeden wejsciowy route `/audit-programs`

# (W6) czy nazwa flagi jest wolna
grep -rn "ENABLE_AUDITS_WORKSHOP" server/src src
#   oczekiwane: zero trafien — nazwa flagi wolna do deklaracji w R2
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day221-audyty-warsztat-20260901` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6164`. Twój JEDYNY port harnessu to `5116 i 5117`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day221-pg`**. **ZAKAZANE:** `zajete: 6012, 5433, 6047, 6054-6162, 5010-5113, 6404-6411 · ZABRONIONE (rezerwacja innych dyzurow, w tym 6163/5114-5115 dyzuru 220): 6165-6175, 5118-5139 · zakazane na stale: 5000 (macOS Control Center), 5037 (adb), 5060-5061`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w ``ENABLE_AUDITS_WORKSHOP` — DEKLARACJA WYLACZNIE (wpis w `FeatureFlagsSchema` + blok ladujacy, wzorem innych `ENABLE_*`), `z.boolean().default(false)`, ZERO wolaczy, ZERO zmiany zachowania jakiegokolwiek istniejacego ekranu. To jest scaffold pod PRZYSZLY dyzur budowy, jawnie zamowiony przez D-5 ("budowa za flaga OFF")`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**` w szczegolnosci `auth.middleware.ts` (`verifyToken`), `rbac.middleware.ts` (`requireOrgAccess`), `demoGuard.middleware.ts`, `rateLimiting.middleware.ts` — montowane na `server/src/routes/audit-programs.routes.ts:23-26,43`. Ten dyzur NIE dotyka zadnej trasy, wiec bramki sa czysto informacyjne (zeby prototyp w R4 nie zaklamal, jakie dane API realnie zwraca)`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY221_AUDYTY_WARSZTAT_REPORT.md`. Jedyny inny dokument do zmiany: `docs/program/waves/WAVE_03_ACCEPTANCE/modules/12_AUDITS/MODULE_ACCEPTANCE.md` — WYLACZNIE dopisujesz JEDNO zdanie przy wierszu `AUD-OR-20260829-004` (linia 120): ze prototyp warsztatu istnieje pod wskazana sciezka dev-render, oczekuje akceptu wlasciciela na zrzutach, status WIERSZA zostaje `OPEN` (akcept nie zapadl w tym dyzurze). Nie zmieniasz zadnego innego wiersza, w tym `-001/-002/-003/-005` (dyzur 220). **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day221-audyty-warsztat-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day221-audyty-warsztat-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ZAKAZ_WLASCIWY_TEMU_DYZUROWI — Zakaz jakiejkolwiek zmiany w `src/components/Audit/method/**` (produkcyjny hub) i w `server/src/routes/audit-programs.routes.ts`/`server/src/services/audits/**`. Ten dyzur PROJEKTUJE i PROTOTYPUJE poza produktem (`dev-render/` + jedna deklaracja flagi) — zero wplywu na to, co dzis widzi jakikolwiek uzytkownik. Zakaz montowania prototypu pod realna trase produktu | CLAUDE.md regula 7 (wlasciciel nigdy pierwszym testerem) i regula 9 (zakaz masowego wlaczania, kanon tabel twardo) razem: warsztat to NOWY wyglad dla modulu, ktory dzis jest kanonicznym `StandardTable`; wejscie prosto do produktu bez akceptu na czystym zrzucie jest dokladnie wzorcem krachu 07-11/07-12 opisanym w CLAUDE.md |

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
cd /private/tmp/cx-day221-audyty-warsztat

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day221-pg psql -U postgres -d cx221 \
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
cd /private/tmp/cx-day221-audyty-warsztat

docker run -d --name cx-day221-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx221 \
  -p 127.0.0.1:6164:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day221-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6164/cx221 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6164/cx221 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day221-audyty-warsztat && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6164/cx221 \
JWT_SECRET=cx221-test-secret-do-not-reuse \
npx vitest run tests/unit/scripts/day221-feature-flags.test.mjs (NOWY, jesli istnieje wzorzec testu deklaracji flagi — sprawdz FeatureFlags.test.ts) src/components/Audit/method/__tests__/ (URUCHOM CALY KATALOG jako regresja read-only, dowod ze prototyp NIE dotknal produkcyjnego huba, 19 plikow, policz sam ile testow, zero nowych w tym katalogu w tym dyzurze) --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day221-audyty-warsztat-artefakty/day221-audyty-warsztat.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day221-audyty-warsztat && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run tests/unit/scripts/day221-feature-flags.test.mjs (NOWY, jesli istnieje wzorzec testu deklaracji flagi — sprawdz FeatureFlags.test.ts) src/components/Audit/method/__tests__/ (URUCHOM CALY KATALOG jako regresja read-only, dowod ze prototyp NIE dotknal produkcyjnego huba, 19 plikow, policz sam ile testow, zero nowych w tym katalogu w tym dyzurze) --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day221-audyty-warsztat-artefakty/day221-audyty-warsztat.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day221-audyty-warsztat/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day221-pg psql -U postgres -d cx221 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day221-pg`.
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
> **(e) nie dotyczy — ten dyzur nie dotyka zadnej trasy chronionej bramka; prototyp zyje wylacznie w `dev-render/`, ktory nie przechodzi przez `verifyToken`/`requireOrgAccess`/`demoContextMiddleware`; dowod: `grep -rn "audit-programs\|verifyToken" dev-render/main.tsx` -> zero trafien (dev-render to statyczny harness bez routera produktu)**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day221-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day221-audyty-warsztat-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (pomiar + projekt archetypu, spisany w raporcie) i R4 (prototyp dev-render + zrzuty jasny/ciemny z dowodem roznicy motywu) sa RDZENIEM — to one dostarczaja material do akceptu wlasciciela, ktory jest calym celem tego dyzuru. R2 (deklaracja flagi) i R6 (wpis KOORDYNACJA.md) sa krotkie i tanie, rob je zawsze. Jesli zabraknie czasu — R3 (spisany projekt/wireframe jako czesc raportu) mozesz skrocic, ale R1/R4 sa niepodzielne`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6164` albo `5116 i 5117` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6164` albo `5116 i 5117`** (`Z7`).

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

`docs/program/funkcje/DECYZJE_WLASCICIELA_2026-08-30_WIECZOR.md:26` (Runda 2, ta sama sesja
30.08 wieczór):

> | D-5 | Audyty: powierzchnia odbioru | **BUDUJEMY WARSZTAT TERAZ** (wbrew rekomendacji —
> decyzja świadoma) | +3-4 dyżury; UWAGA reguła 7: warsztat to NOWY wygląd → najpierw
> prototyp → akcept właściciela → budowa za flagą OFF; wpis do KOORDYNACJA.md (styk z
> grafiką) |

To jest cytat, nie parafraza. Trzy zobowiązania w jednym wierszu: **(1)** prototyp przed
budową, **(2)** akcept właściciela na zrzutach przed czymkolwiek dalej, **(3)** wpis do
`docs/program/KOORDYNACJA.md`. Zmierzone na SHA `9fb7942a01`: **żadne z trzech nie istnieje.**

`docs/program/funkcje/FALA_Z1_2026-08-31.md:38,45` potwierdza to samo, dzień później:
„**warsztat D-5**: prototyp → akcept → budowa za flagą (decyzja zapadła 30.08, **postęp
zerowy**)" i „Admina i Audyty (warsztat D-5 **w ogóle nieuwzględniony jako praca**)".

**★★ TEN DYŻUR KOŃCZY SIĘ PROTOTYPEM. Zero budowy silnika, zero zmiany w
`src/components/Audit/method/**`, zero nowej trasy backendowej.** Jedyny produkcyjny artefakt
to JEDNA deklaracja flagi (`R2`), sama w sobie bezczynna — scaffold pod przyszły dyżur budowy,
który dostanie ODRĘBNĄ instrukcję PO akcepcie właściciela na zrzutach z tego dyżuru.

## ★ Pomiar wykonany na SHA `9fb7942a01` — zweryfikuj sam

**(K1) `KOORDYNACJA.md` nie ma ŻADNEGO wpisu o Audytach.** Plik ma 613 linii;
`grep -in "audyt" docs/program/KOORDYNACJA.md` daje jedno trafienie w linii 521 — słowo
„audytowalny" w zdaniu o zupełnie innym module (generator dokumentów), nie o module 12.
Wymóg D-5 „wpis do KOORDYNACJA.md" jest **niespełniony**.

**(K2) Zero pliku dev-render dla warsztatu Audytów.** `find dev-render/screens -iname
"*audit*"` zwraca WYŁĄCZNIE `exe-002-004-ui-audit.tsx` — to moduł **07 Execution**
(„audit" w nazwie odnosi się do audytu wykonania inicjatywy, nie do modułu 12). Zero
prototypu.

**(K3) Opis „warsztat overview", do którego odsyła `AUD-OR-20260829-004`, nie ma własnej
specyfikacji — istnieje wyłącznie jako cytat wewnątrz DWÓCH raportów.**
`grep -rl "warsztat overview" docs` zwraca dokładnie: `MODULE_ACCEPTANCE.md` i
`CODEX_DAY109_AUDYTY_OWNER_REPORT.md`. Ten drugi (`:10`) mówi:

> Realny produkt działa jako spójny hub tabelaryczny, ale **nie odtwarza zaakceptowanego
> dev-renderu „warsztat overview"** opisanego w §A instrukcji.

„§A instrukcji" to odniesienie do instrukcji dyżuru **sprzed** 109, której obecny checkout
(SHA `9fb7942a01`) nie zawiera jako osobnego pliku — nie znalazłem specyfikacji „18 ogniw /
4 fazy / prawy panel" nigdzie poza tym jednym zdaniem cytatu. **Wniosek: nie ma nic do
„odtworzenia".** Projektujesz warsztat OD NOWA w `R1`/`R3`, ewentualnie inspirując się frazą
„18 ogniw / 4 fazy / prawy panel" jako punktem wyjścia do rozmowy z nadzorcą, nie jako
gotową specyfikacją do skopiowania.

**(K4) Dzisiejsza powierzchnia to kanoniczny `StandardTable`/`StandardModuleBar`, sześć
zakładek, jeden route.** `AuditsMethodHub.tsx:371-406` — `library`, `processes` (Sesje),
`outputs`, `reports` (Raporty), `findings` (Ustalenia), `initiatives`. Wejście:
`/audit-programs` (`src/routes/AppRoutes.tsx:1625`). To jest zgodne z `CLAUDE.md` §1 i §9
(Materiały/Tools = wzór poprawny) — **warsztat, jeśli powstanie, zastępuje albo uzupełnia
TĘ powierzchnię, więc projekt musi zacząć od tego, co dziś realnie działa, nie od pustej
kartki.**

**(K5) Nazwa `ENABLE_AUDITS_WORKSHOP` jest wolna.** `grep -rn "ENABLE_AUDITS_WORKSHOP"
server/src src` — zero trafień w całym repo.

**(K6) Kanon do zastosowania nie jest oczywisty z góry — to jest pytanie projektowe, nie
formalność.** `CLAUDE.md` rozróżnia **listy** (`consultify-triada`, `StandardTable`) od
**artefaktów** (`consultify-artefakty`, SPEC-A, „ekrany-obiekty otwierane z tożsamością").
„Warsztat" jako **powierzchnia pracy nad JEDNYM programem audytowym** (nie lista wielu
programów) brzmi bliżej archetypu artefaktu (Canvas albo Record) niż listy — ale mogłoby też
być listą z bogatszym podglądem (`consultify-preview`). **Rozstrzygnięcie tego pytania jest
częścią `R3`, nie założeniem tej instrukcji.**

# 2. TEZY ZLECENIA

- **T1.** Decyzja `D-5` (`DECYZJE_WLASCICIELA_2026-08-30_WIECZOR.md:26`) zobowiązuje do
  TRZECH rzeczy: prototyp, akcept właściciela, wpis do `KOORDYNACJA.md`. Zmierzone: zero z
  trzech istnieje na SHA `9fb7942a01`.
- **T2.** `KOORDYNACJA.md` (613 linii) ma zero merytorycznych wystąpień słowa „audyt"
  dotyczących modułu 12 — jedno trafienie w `:521` dotyczy innego modułu.
- **T3.** `dev-render/screens/` nie ma pliku dla warsztatu Audytów; jedyny plik z „audit" w
  nazwie (`exe-002-004-ui-audit.tsx`) należy do modułu 07 Execution.
- **T4.** Fraza „warsztat overview" (referencja `AUD-OR-20260829-004`) istnieje wyłącznie w
  `MODULE_ACCEPTANCE.md:120` i `CODEX_DAY109_AUDYTY_OWNER_REPORT.md:10` jako cytat — bez
  osobnej specyfikacji do odtworzenia. Projektujesz od nowa.
- **T5.** Dzisiejsza powierzchnia to sześć zakładek `StandardModuleBar` pod jednym route'em
  `/audit-programs` (`AuditsMethodHub.tsx:371-406`, `AppRoutes.tsx:1625`) — punkt wyjścia
  projektu, nie coś do zignorowania.
- **T6.** Nazwa flagi `ENABLE_AUDITS_WORKSHOP` jest wolna w całym repo (zero trafień).

# 3. POZYCJE DYŻURU

## R1 — Inwentarz tego, co dziś istnieje (rdzeń)

Spisz w raporcie, z `plik:linia`: (a) wszystkie sześć zakładek dzisiejszego hubu i co każda
pokazuje (kolumny, akcje wiersza, `StandardPreview`); (b) jakie dane backend już zwraca per
zakładka (`programService.ts`, `reportService.ts`, `outputService.ts`, `findingsService.ts`
jeśli istnieje — zmierz nazwy plików sam, nie zakładaj) — to jest inwentarz DANYCH dostępnych
dla przyszłego warsztatu, nie tylko dzisiejszego UI; (c) trzy poprzednie decyzje właściciela
dotyczące Audytów (`D-3` PDF, `D-4` powierzchnia odbiorów, `D-5` warsztat) i ich status
wykonania. Ten inwentarz jest **wejściem** do `R3`, nie balastem raportu.

## R2 — Deklaracja flagi `ENABLE_AUDITS_WORKSHOP` (scaffold, zero wołaczy)

Dopisz do `server/src/config/FeatureFlags.ts`: wpis w `FeatureFlagsSchema`
(`z.boolean().default(false)`, wzorem sąsiednich `ENABLE_*`) + wpis w bloku ładującym.
**Zero miejsc w kodzie, które tę flagę odczytują.** To jest jedyny dozwolony zapis do kodu
produkcyjnego w całym tym dyżurze — dokładnie jedna deklaracja, uzasadniona wprost przez D-5
(„budowa za flagą OFF" wymaga, żeby flaga istniała, zanim ktokolwiek zacznie ją czytać).

**Test dowodzący:** test istnienia flagi w schemacie z wartością domyślną `false` (wzorzec —
znajdź istniejący test `FeatureFlags` w `server/src/config/__tests__/` jeśli istnieje, albo
najbliższy odpowiednik).
**Mutacja-gate:** zmień domyślną wartość na `true` w kopii pliku (`cp`, `Z27`) — test musi
zaczerwienić się; przywróć.

## R3 — Projekt archetypu warsztatu (spisany w raporcie, nie osobny plik — `Z13`)

Rozstrzygnij `K6`: czy warsztat to artefakt (SPEC-A — który z pięciu archetypów: Canvas /
Dokument / Rekord / Matryca / Deck najbliżej pasuje do „pracy nad jednym programem
audytowym"?) czy bogatsza lista (SPEC-L z rozbudowanym `consultify-preview`). Użyj skilla
`consultify-artefakty` LUB `consultify-triada` odpowiednio do rozstrzygnięcia — **przeczytaj
oba SSOT** (`Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md` i
`docs/ui-standards/TRIADA_KANON.md`) przed decyzją, nie po. Opisz w raporcie: (a) wybrany
archetyp i uzasadnienie w 3-5 zdaniach z odniesieniem do `R1`(inwentarza); (b) makietę
tekstową/wireframe (sekcje ekranu, co jest w prawym panelu jeśli artefakt, jaka nawigacja
między „ogniwami" jeśli to jest struktura procesu); (c) czego warsztat NIE robi w pierwszej
wersji (żeby `R4` nie próbował zaprototypować wszystkiego naraz).

## R4 — ★★ Prototyp w `dev-render`, dane realistyczne (rdzeń)

Nowy plik `dev-render/screens/day221-audyty-warsztat.tsx` (wzorzec: dowolny istniejący ekran
w `dev-render/screens/` — real komponent + mock dane, real CSS/tokeny `c-*`, real i18n),
wpięty do `dev-render/main.tsx` (rejestr `SCREENS`, wzorzec istniejących wpisów). Dane
mock: **realistyczne** — polskie nazwy programu/kryteriów/ustaleń, długości wartości
zbliżone do tego, co dyżur 220 zmierzył w Sesjach/Raportach/Ustaleniach (nie
`"Lorem ipsum"`, nie jednoliterowe placeholdery). Zero wywołania realnego API — to jest
harness, nie integracja.

**★ ZAKAZ montowania pod realną trasą `/audit-programs`.** Prototyp żyje wyłącznie pod
`?screen=day221-audyty-warsztat` w dev-render.

## R5 — ★★ Zrzuty jasny + ciemny, z dowodem że to NIE jest ten sam obraz

Zrzut jasny i zrzut ciemny, oba do `/private/tmp/cx-day221-audyty-warsztat-artefakty` (`Z13`, nie do repo). W raporcie:
`shasum -a 256` OBU plików (muszą się różnić — identyczny hash = dowód, że motyw nie
zadziałał) + **`mean_luma` obu zrzutów, z liczbą, nie opisem** — różnica musi przekraczać
**150** (konwencja programu, ten sam próg co w dyżurze 207: „duplikat zamiast motywu" —
para light/dark = ten sam obraz pod dwiema nazwami — jest **TRZYNASTYM nazwanym kształtem
fałszywego „gotowe"** w tym programie, złapanym już raz na innym module). Jeśli motyw
ustawia się po hydratacji (znany wzorzec w tym repo) i pierwszy zrzut wychodzi błędny —
użyj `addInitScript` albo równoważnego mechanizmu wymuszającego motyw PRZED pierwszym
renderem, nie ufaj domyślnemu stanowi strony.

## R6 — Wpis do `docs/program/KOORDYNACJA.md` (wymóg D-5, „styk z grafiką")

DOPISZ (nie usuwaj, nie przestawiaj istniejącej treści) krótką sekcję/wiersz: co to jest
(warsztat Audytów, moduł 12), gdzie jest prototyp (ścieżka `dev-render`), jaki jest status
(oczekuje akceptu właściciela na zrzutach z `R5`), jaka flaga jest zarezerwowana
(`ENABLE_AUDITS_WORKSHOP`, default OFF). To jest dokładnie to, co D-5 nazwał „styk z
grafiką" — inne osoby/dyżury pracujące nad Audytami muszą wiedzieć, że warsztat jest w
drodze, zanim zaczną coś kolidującego.

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis | `server/src/config/FeatureFlags.ts` — WYŁĄCZNIE dodanie `ENABLE_AUDITS_WORKSHOP` (schemat + loader), zero innych zmian |
| Zapis | NOWY `dev-render/screens/day221-audyty-warsztat.tsx` (i pliki pomocnicze `day221-audyty-warsztat-*.tsx` jeśli archetyp wymaga rozbicia na podekrany) |
| Zapis | `dev-render/main.tsx` — WYŁĄCZNIE dopisanie wpisu do rejestru `SCREENS` dla nowego ekranu, wzorem istniejących |
| Zapis (warunkowy) | NOWY test dla `R2` (`server/src/config/__tests__/` albo najbliższy istniejący wzorzec) |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY221_AUDYTY_WARSZTAT_REPORT.md` |
| Zapis (ograniczony) | `docs/program/KOORDYNACJA.md` — WYŁĄCZNIE nowy wpis/sekcja (dopisanie, nie edycja istniejącej treści) |
| Zapis (ograniczony) | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/12_AUDITS/MODULE_ACCEPTANCE.md` — WYŁĄCZNIE jedno zdanie przy wierszu `-004` (linia 120), patrz `§0` pole „Jedyny inny dokument" |
| Odczyt (ZAKAZ ZAPISU) | `src/components/Audit/method/**` (CAŁY katalog) — inwentarz w `R1` czyta, `R4` się WZORUJE, nic tu się nie zmienia |
| Odczyt (ZAKAZ ZAPISU) | `server/src/routes/audit-programs.routes.ts`, `server/src/services/audits/**`, `server/src/middleware/**` |
| Odczyt (ZAKAZ ZAPISU) | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/12_AUDITS/MODULE_ACCEPTANCE.md` wiersze `-001/-002/-003/-005` — dyżur 220 |
| Odczyt | `docs/program/funkcje/DECYZJE_WLASCICIELA_2026-08-30_WIECZOR.md`, `docs/program/funkcje/FALA_Z1_2026-08-31.md`, `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY109_AUDYTY_OWNER_REPORT.md`, `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md`, `docs/ui-standards/TRIADA_KANON.md` |

**Nietykalne imiennie:** `src/components/Audit/method/**` (CAŁY katalog, zero wyjątków) ·
`server/src/routes/audit-programs.routes.ts` · `server/src/services/audits/**` ·
`server/src/middleware/**` · każdy wiersz `MODULE_ACCEPTANCE.md` poza `-004` · dowolna inna
flaga w `FeatureFlags.ts`.

**Kolizja zasobowa z dyżurem 220:** oba dopisują do `MODULE_ACCEPTANCE.md`. **Przed
pierwszym commitem do tego pliku** sprawdź `git log`, czy 220 już scalił swoją zmianę — jeśli
tak, dopisujesz PO nim. `KOORDYNACJA.md` jest dotykany WYŁĄCZNIE przez ten dyżur (220 go nie
dotyka) — kolizja tu nie powinna wystąpić, ale sprawdź mimo to.

# 5. TWARDE ZASADY

- ★★ **Ten dyżur NIE buduje warsztatu. Buduje DOWÓD dla decyzji o warsztacie.** Jeśli pod
  presją czasu skusi Cię „skoro już projektuję, to od razu wepnę to do `/audit-programs`" —
  to jest dokładnie zakazany ruch. `CLAUDE.md` §7: „Zakaz „włącz flagę i zobacz" jako
  pierwszego sprawdzenia."
- ★★ **Właściciel akceptuje PROTOTYP, nie zapowiedź.** Raport bez realnych zrzutów jasny+
  ciemny z `R5` jest nieukończony, niezależnie od tego, jak dobry jest opis w `R3`.
- ★★ **Zakaz piątego archetypu wymyślonego na miejscu bez uzasadnienia.** `R3` wybiera Z
  ISTNIEJĄCEGO kanonu (SPEC-A pięć archetypów, albo SPEC-L) — jeśli żaden nie pasuje, to jest
  **STOP merytoryczny pozycji z opisem**, zgłoszony nadzorcy, nie autorska szósta kategoria.
- ★★ **`mean_luma` różnica > 150 jest bezwzględna** (`R5`). Bez tej liczby w raporcie
  zrzuty nie są dowodem.
- ★ **Jedna flaga, `default false`, zero wołaczy** (`Z10`, `POZYCJE_Z_FLAGAMI`). To NIE jest
  wyjątek od zakazu masowego włączania — to jest deklaracja bez żadnego efektu.
- ★ **`AUD-OR-20260829-004` zostaje `OPEN` po tym dyżurze.** Zamyka go dopiero akcept
  właściciela na zrzutach z `R5`, wykonany przez nadzorcę — nie Ty w tym dyżurze.
- ★★ **Sekcja „TWIERDZENIA NIEZWERYFIKOWANE" w raporcie jest OBOWIĄZKOWA.** Wypisz wprost co
  najmniej: czy archetyp z `R3` został wybrany na podstawie realnego przeczytania OBU SSOT
  (`ARTIFACT_ANATOMY_STANDARD.md`, `TRIADA_KANON.md`) czy z pamięci; czy dane mock w `R4` są
  „realistyczne" w sensie zmierzonym (porównane do realnych długości wartości z dyżuru 220)
  czy tylko subiektywnie; czy `mean_luma` obu zrzutów policzone narzędziem czy oszacowane;
  czy wpis do `KOORDYNACJA.md` jest w miejscu, gdzie inni faktycznie go zobaczą (blisko innych
  wpisów modułowych, nie zakopany); czy sprawdziłeś kolizję z dyżurem 220 na
  `MODULE_ACCEPTANCE.md` przed commitem. Brak tej sekcji jest podstawą odrzucenia dyżuru.
