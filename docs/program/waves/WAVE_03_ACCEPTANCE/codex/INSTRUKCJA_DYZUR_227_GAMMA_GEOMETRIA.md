# INSTRUKCJA DYŻURU nr 227 — Codex — „Dwa zywe renderery PPTX o niezgodnej geometrii — kanoniczny PptxPipelineService+designTokens.ts (margines 0,5 cala, gora tresci 1,0) kontra zapasowy DeckStyler.ts z wlasna stala DECK_GRID (margines 0,6 cala, gora 1,7 — NIE w themeRegistry.ts jak zakladalo zamowienie), zapasowy wolany bezwarunkowo bez flagi z initiativeMaterializeService.ts:488; zero tokenow produktu (c-accent/c-primary/c-focus) po stronie serwera, zestaw 'harvard' (presentationVisualDirectorService.ts:254, A41034) rozjezdza sie z tokenem marki 85182F"

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
> **wyłącznie** `/private/tmp/cx-day227-gamma-geometria`.

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
Zakres: **Materialy / Prezentacje — renderery PPTX (report/pptx/PptxPipelineService kanoniczny, deliverables/DeckStyler.ts zapasowy) i most tokenow marki do serwera**.
Trasy front: `Brak zmian frontowych w tym dyzurze — `tailwind.config.js:172` i `src/index.css:19` sa WYLACZNIE zrodlem wartosci mostu (odczyt), front nietykalny`. Trasy tył: ``server/src/services/report/pptx/PptxPipelineService.ts` (kanoniczny, import `designTokens.ts` :20 — NIETYKALNY, zrodlo prawdy), `server/src/services/report/pptx/designTokens.ts` (stale `GRID`/`SPACING` ok. :41-51, margines 0.5, contentY 1.0 — NIETYKALNY); `server/src/services/deliverables/DeckStyler.ts` (stala `DECK_GRID` ok. :37-51, marginX 0.6, contentTop 1.7 — TU naprawiasz), `server/src/services/deliverables/themeRegistry.ts` (WYLACZNIE typografia/paleta 5 motywow, BEZ geometrii — czytasz, nie zmieniasz); `server/src/services/initiative/initiativeMaterializeService.ts::materializeDeck` (:477-495, wywolanie :488, bezwarunkowe, bez flagi — czytasz jako dowod, nie zmieniasz logiki wyboru); `server/src/services/deliverables/bundleExportRuntime.ts` (:193-216, prawdziwy primary→fallback dla glownego pliku — kontrast, nietykalny); `server/src/services/presentationVisualDirectorService.ts` (paleta `harvard` :254, TU naprawiasz jeden wpis)`.

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
WT=/private/tmp/cx-day227-gamma-geometria
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
git -C "$VAULT" worktree add "$WT" -b codex/day227-gamma-geometria-20260901 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day227-gamma-geometria/config.worktree"
cat "$VAULT/worktrees/cx-day227-gamma-geometria/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day227-gamma-geometria-scratch
mkdir -p /private/tmp/cx-day227-gamma-geometria-artefakty

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
git -C "$WT" push github-backup codex/day227-gamma-geometria-20260901
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 9fb7942a01..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `cztery` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day227-gamma-geometria

# (T1) POTWIERDZ GEOMETRIE KANONICZNA
grep -n "contentX\|contentY\|margin:" server/src/services/report/pptx/designTokens.ts
#   oczekiwane: contentX/margin 0.5, contentY 1.0.

# (T2) POTWIERDZ GEOMETRIE ZAPASOWA I JEJ PRAWDZIWA LOKALIZACJE
grep -n "marginX\|contentTop\|margin" server/src/services/deliverables/DeckStyler.ts server/src/services/deliverables/themeRegistry.ts
#   oczekiwane: DECK_GRID w DeckStyler.ts (marginX 0.6, contentTop 1.7); ZERO trafien w themeRegistry.ts.

# (T3) POTWIERDZ BRAK FLAGI I BEZWARUNKOWOSC WOLANIA
sed -n '470,496p' server/src/services/initiative/initiativeMaterializeService.ts
grep -ni "DECK\|PPTX" server/src/config/FeatureFlags.ts
#   oczekiwane: brak if/flagi przed wywolaniem deckPlansToPptxBuffer (:488); jedyna flaga to ENABLE_DECK_CONCLUSION_SLIDE (niezwiazana).

# (T4) POLICZ HEXY I ZESTAW 'HARVARD'
grep -oE "#[0-9A-Fa-f]{6}" server/src/services/report/pptx/designTokens.ts | wc -l
grep -oE "#[0-9A-Fa-f]{6}|'[0-9A-Fa-f]{6}'" server/src/services/deliverables/DeckStyler.ts | wc -l
grep -n "harvard" server/src/services/presentationVisualDirectorService.ts
grep -n "85182F\|A51C30" tailwind.config.js src/index.css
#   oczekiwane: 53 / 10; harvard: 'A41034' na linii ok. 254; token produktu 85182F.
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day227-gamma-geometria-20260901` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6171`. Twój JEDYNY port harnessu to `5130 i 5131`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day227-pg`**. **ZAKAZANE:** `6012, 5433, 6047 i 6054-6169 (odbiory nadzorcy i dyzury wczesniejsze) oraz 5010-5127, 6404-6411 (rezerwacje), 6170/5128-5129 (226, rownolegly), 6172/5132-5133 (228, rownolegly). ★ PORT 5000 ZAJETY NA STALE przez macOS Control Center, 5037 przez `adb`, 5060-5061 zajete. ZABRONIONE (dyzury 229-232): 6173-6175, 5134-5139`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `R1+R2 razem, jedna flaga `ENABLE_PPTX_CANONICAL_GEOMETRY` (nowa, default false) — gasi/wlacza jednoczesnie geometrie DeckStyler i podmiane wpisu 'harvard' na token marki`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY227_GAMMA_GEOMETRIA_REPORT.md`. Nie zmieniasz zadnego MODULE_ACCEPTANCE.md — ten dyzur jest naprawa silnika renderera, nie odbiorem ekranu modulu Materialy. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day227-gamma-geometria-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day227-gamma-geometria-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **NIE NAPRAWIASZ WYBORU RENDERERA.** Logika, ktory silnik jest wolany przez ktorego wolajacego (`initiativeMaterializeService.ts`, `bundleExportRuntime.ts`, `bundlePptxRuntime.ts`) jest NIETYKALNA — rozni sie per wolajacy (jeden ma prawdziwy fallback, drugi nie) i to jest osobna decyzja architektoniczna o szerszym zasiegu. **NIE MIGRUJESZ WSZYSTKICH HEXOW** — R2 naprawia WYLACZNIE wpis 'harvard' w `presentationVisualDirectorService.ts:254`, nie pozostale 12 palet Layout Directora ani `themeRegistry.ts`/`paletteLibrary.ts`/kompozyty kanoniczne. **NIE ZMIENIASZ `PptxPipelineService.ts` ani `designTokens.ts`** — sa zrodlem, nie celem. **NIE ZMIENIASZ `slideW`/`slideH`** — oba renderery juz sie zgadzaja co do rozmiaru platna, zmieniasz WYLACZNIE margines i gore tresci. | Zmierzone (GAMMA_G0_POMIAR.md + weryfikacja wlasna na SHA 9fb7942a01): kanoniczny renderer (PptxPipelineService+designTokens.ts) ma margines 0,5 cala i gore tresci 1,0; zapasowy (DeckStyler.ts, NIE themeRegistry.ts jak zakladalo pierwotne zamowienie — themeRegistry.ts ma wylacznie typografie/palete, zero geometrii) ma margines 0,6 i gore 1,7. Zapasowy jest wolany bezwarunkowo, bez flagi, bez fallbacku na kanoniczny z initiativeMaterializeService.ts:488 (potwierdzone: brak if/flagi przed wywolaniem). Zero tokenow CSS produktu (c-accent/c-primary/c-focus) czytanych po stronie serwera — serwer nie ma dostepu do zmiennych CSS przegladarki, mostu nie zbudowano. Nawet wewnetrznie niespojne: paleta 'harvard' (presentationVisualDirectorService.ts:254, #A41034) rozni sie od aktualnego tokenu marki (tailwind.config.js:172, #85182F) i od jego poprzednika (#A51C30) — trzy rozne czerwienie w repo. |

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
cd /private/tmp/cx-day227-gamma-geometria

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day227-pg psql -U postgres -d cx227 \
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
cd /private/tmp/cx-day227-gamma-geometria

docker run -d --name cx-day227-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx227 \
  -p 127.0.0.1:6171:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day227-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6171/cx227 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6171/cx227 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day227-gamma-geometria && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6171/cx227 \
JWT_SECRET=cx227-test-secret-do-not-reuse \
npx vitest run server/src/services/report/pptx/__tests__, server/src/services/deliverables/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day227-gamma-geometria-artefakty/day227-vitest.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day227-gamma-geometria && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/services/report/pptx/__tests__, server/src/services/deliverables/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day227-gamma-geometria-artefakty/day227-vitest.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day227-gamma-geometria/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day227-pg psql -U postgres -d cx227 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day227-pg`.
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
> **(e) ★★ **Geometria zapasowa NIE lezy w `themeRegistry.ts`, jak zakladalo pierwotne zamowienie — lezy w samym `DeckStyler.ts` (stala `DECK_GRID`).** `themeRegistry.ts` (205 linii) ma WYLACZNIE typografie i palete 5 motywow (`executive/modern/corporate/classic/clean`), `grep -n margin themeRegistry.ts` daje zero. Napraw to nieporozumienie w raporcie, nie kontynuuj go. **Druga: `initiativeMaterializeService.ts` NIE importuje `DeckStyler` ani `PptxPipelineService` bezposrednio** — wola `deckPlansToPptxBuffer` z `bundlePptxRuntime.ts`, ktore dopiero WEWNATRZ SIEBIE uzywa `DeckStyler`. **Trzecia, najwazniejsza: logika wyboru silnika NIE jest jednolita w calym produkcie.** `bundleExportRuntime.ts::exportBundleFiles` (ok. :193-216) ma PRAWDZIWY wzorzec primary→fallback (`PptxPipelineService` najpierw, `DeckStyler` tylko gdy null) dla glownego pliku — ale wariant 'dla zarzadu' (`pptxBoard`) w TYM SAMYM pliku jest bezwarunkowy, rownolegle do glownego. Nie generalizuj 'bezwarunkowo wszedzie' z jednego zmierzonego przypadku (`initiativeMaterializeService.ts`) na caly produkt. **Czwarta: zestaw 'harvard' NIE lezy w dwoch rendererach nazwanych w zamowieniu** — lezy w TRZECIM, osobnym systemie (`presentationVisualDirectorService.ts:254`, katalog `B1_PALETTE_PRIMARY_HEX`, 13 palet dla premium Layout Directora, za wlasna flaga, fail-open). Jego wartosc `#A41034` rozni sie od OBU wersji tokenu produktu (aktualnej `#85182F` i przestarzalej `#A51C30`) — trzy rozne czerwienie, zaden identyczny. **Piata: 9 wolajacych `PptxPipelineService`, tylko 1 realny importer `DeckStyler`** (`bundlePptxRuntime.ts:34`) — nie przepisuj 9 wolajacych kanonicznego, on juz jest zrodlem prawdy i sie nie zmienia.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day227-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day227-gamma-geometria-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (jedna geometria) i R3 (bramka: identycznosc zmierzona na realnych plikach) — bez nich ten sam produkt nadal wypuszcza pliki o dwoch roznych geometriach`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6171` albo `5130 i 5131` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6171` albo `5130 i 5131`** (`Z7`).

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

`docs/program/funkcje/GAMMA_G0_POMIAR.md` zmierzył coś, czego żadna liczba slajdów nie
naprawi: **ten sam produkt dziś potrafi wypuścić dwa pliki PPTX o różnej geometrii**, zależnie
od tego, którędy poszła generacja. Nie jest to kwestia gustu — to jest niespójność w
dosłownym znaczeniu: ten sam deck, dwa różne marginesy, dwie różne wysokości nagłówka.
Marzenie właściciela (`MARZENIE_GAMMA_DECKI.md`) mówi „prezentacje jakości Gammy" — a Gamma
ma **jedną** geometrię na cały produkt. My mamy dwie, i żadna nie czyta koloru marki.

Ten dyżur nie buduje trzeciego renderera i nie ujednolica WYBORU renderera (który plik
używa którego silnika) — to osobna decyzja architektoniczna z szerszym zasięgiem (patrz K3
niżej, gdzie pomiar znalazł, że logika wyboru różni się per wołający). Ten dyżur naprawia
**liczby**: sprawia, że niezależnie od tego, który silnik akurat renderuje, wynik ma tę samą
geometrię i sięga po ten sam, jeden zestaw kolorów marki.

## ★★ Pomiar wykonany na SHA `9fb7942a0117aaf4001836f00bf8bbdc4e717669` — zweryfikuj sam

**(K1) ★★ Kanoniczna geometria — potwierdzona dokładnie.** `server/src/services/report/pptx/
designTokens.ts`, stała `GRID` (blok ok. linii 41-50):

```ts
const GRID = {
  slideW: 10,
  slideH: 5.625,
  contentX: 0.5,
  contentY: 1.0,
  contentW: 9.0,
  contentH: 4.0,
  headerH: 0.8,
  footerY: 5.2,
};
```

i stała `SPACING` (bezpośrednio pod `GRID`): `margin: 0.5`. Zaimportowana w
`PptxPipelineService.ts:20` (`import { getDesignTokens } from './designTokens.js'`). Margines
= **0,5 cala**, góra treści (`contentY`) = **1,0**. Zmierz aktualne numery linii sam — mogły
się przesunąć.

**(K2) ★★ Zapasowa geometria — potwierdzona co do wartości, OBALONA co do pliku źródłowego.**
Zamówienie mówiło „`themeRegistry.ts` (margines 0,6 cala, góra 1,7)". **To jest nieprecyzyjne:
`themeRegistry.ts` (205 linii) nie ma geometrii w ogóle** — `grep -n "margin" themeRegistry.ts`
daje zero. Ten plik zawiera WYŁĄCZNIE typografię i paletę pięciu motywów (`executive / modern
/ corporate / classic / clean`, każdy `fontPair` + `palette`). **Geometria zapasowa leży w
`server/src/services/deliverables/DeckStyler.ts` samym w sobie**, stała `DECK_GRID`
(ok. linii 37-51):

```ts
// nagłówek pliku, linia ok. 18:
//   • Grid: consistent margins (0.6in) and a 16:9 canvas (10 × 5.625 in).
...
  marginX: 0.6,
  /** Top of the content band (below title). */
  contentTop: 1.7,
```

Margines = **0,6 cala**, góra treści (`contentTop`) = **1,7** — wartości z briefu są
poprawne, ale **poprawka do wpisania w raporcie: to jest `DeckStyler.ts`, nie
`themeRegistry.ts`.** `DeckStyler.ts:29` importuje z `themeRegistry.ts` WYŁĄCZNIE
`DeliverableTheme`, `PPT_TYPE_SCALE`, `resolveTheme` — typografię i paletę, nie geometrię.

**(K3) ★★ „Bezwarunkowo, bez flagi" — potwierdzone dla ścieżki inicjatyw, ale mechanizm
wyboru NIE jest jednolity w całym produkcie — zmierz to, zanim cokolwiek naprawisz.**
`initiativeMaterializeService.ts`, funkcja `materializeDeck` (linie ok. 477-495):

```ts
async function materializeDeck(views, company, portfolio): Promise<Buffer | null> {
  try {
    if (!views.length) return null;
    const plans = initiativeDeckPlans(views, portfolio, title);
    return await deckPlansToPptxBuffer(plans, { title, company, language: 'pl' });  // ~:488
  } catch (err) {
    logger.warn(...);
    return null;  // fail-soft: błąd → brak pliku, NIE fallback na inny renderer
  }
}
```

Ten plik **nie importuje ani `DeckStyler`, ani `PptxPipelineService` bezpośrednio** — woła
`deckPlansToPptxBuffer` (`server/src/services/deliverables/bundlePptxRuntime.ts`), które
DOPIERO wewnątrz siebie używa `DeckStyler` (bezwarunkowo, żadnego `if` wyboru silnika). Brak
flagi potwierdzony: `grep -i "DECK\|PPTX"` na `FeatureFlags.ts` zwraca wyłącznie
`ENABLE_DECK_CONCLUSION_SLIDE` (dotyczy slajdu „Wnioski", nie wyboru renderera), a w
`initiativeMaterializeService.ts` — zero. **To zdanie briefu jest prawdziwe dla tej
konkretnej ścieżki.**

★ **Ale nie generalizuj tego na cały produkt** — inny wołający,
`bundleExportRuntime.ts::exportBundleFiles` (linie ok. 193-216), ma PRAWDZIWY wzorzec
primary→fallback: najpierw `PptxPipelineService` (`spinePptxViaPipeline`), `DeckStyler`
wyłącznie gdy `pptx` wyszło `null`. Jedyny wyjątek w TYM pliku: wariant „dla zarządu"
(`pptxBoard`) woła `deckPlansToPptxBuffer`/`DeckStyler` bezwarunkowo, równolegle do głównego
pliku. **Wniosek: logika wyboru silnika różni się per wołający i NIE jest zakresem tego
dyżuru** — naprawiasz liczby geometrii, nie architekturę wyboru.

**(K4) ★★ Liczby kolorów — potwierdzone dokładnie dla dwóch plików nazwanych w zamówieniu,
łańcuch szerszy niż to sugerowało.** `grep -oE "#[0-9A-Fa-f]{6}"`:
- `designTokens.ts` (sam plik): **53** — zgodne z zamówieniem.
- `DeckStyler.ts` (sam plik): **10** — zgodne z zamówieniem
  (`#0C447C, #1D9E75, E3E7EE, F5F8FC, F2F9F6, 64748B, FFFFFF, 1D9E75, D97706, C0392B`).

Szerszy łańcuch (nieproszony wprost, ale istotny dla R2): pliki kompozytowe kanonicznego
renderera dokładają własne hexy (`RecommendationStack.ts`=5, `RiskTable.ts`=7,
`ProblemCauseImpact.ts`=4); zapasowy łańcuch ma więcej niż `DeckStyler.ts` sam:
`themeRegistry.ts`=20, `paletteLibrary.ts`=74, `bundlePptxRuntime.ts`=3. **Nie migrujesz
wszystkich tych hexów w tym dyżurze** — zakres R2 jest węższy, patrz niżej.

**(K5) ★★ `grep -rn "c-accent\|c-primary\|c-focus" server/src` → 0/0/0, potwierdzone.** Żaden
token CSS produktu nie jest czytany po stronie serwera nigdzie — nie tylko dla `c-accent`.

**(K6) ★★ Zestaw „harvard" — potwierdzony co do niespójności, OBALONY co do lokalizacji.**
Zamówienie sugerowało, że „harvard" leży w `designTokens.ts`/`themeRegistry.ts`. Zmierzone:
`grep -i harvard` w OBU tych plikach (i w `DeckStyler.ts`, `paletteLibrary.ts`) → **0**.
Zestaw „harvard" leży w **trzecim, osobnym systemie**:
`server/src/services/presentationVisualDirectorService.ts:254`
(katalog `B1_PALETTE_PRIMARY_HEX`, 13 palet dla premium Layout Director, za własną flagą,
fail-open):

```ts
254:  harvard: 'A41034',
```

Token produktu — `tailwind.config.js:172` (`DEFAULT: '#85182F', // brand canonical`) i
`src/index.css:19` (`--primary: 347 69% 31%; /* crimson-600 #85182F — HBS official (was 358
71% 38% #A51C30) */`). **Trzy różne wartości crimson w repo, żadna identyczna z pozostałymi:**
produkt aktualny `#85182F`, produkt przestarzały `#A51C30` (jawnie zastąpiony, komentarz
`was`), paleta „harvard" w visual directorze `#A41034`. To jest realna, zmierzona
niespójność — ale w **trzecim** pliku, nie w dwóch nazwanych w zamówieniu. Wpisz tę korektę
do raportu; nie zgaduj lokalizacji z zamówienia, kiedy pomiar mówi inaczej.

**(K7) Pełny zasięg callerów — dwa bardzo różne rozmiary.** `PptxPipelineService`
(instancjacje `new PptxPipelineService()`, poza testami) ma **dziewięciu** wołających:
`report-builder.routes.ts` (`:4203,:4433`), `my-work.routes.ts` (`:4587`),
`presentations.routes.ts` (`:603`), `report-builder-public.routes.ts` (`:476`),
`presentationGeneratorService.ts` (`:2354`), `valuationExportService.ts` (`:265`),
`transformationFinalOutputService.ts` (`:1139`), `bundleExportRuntime.ts` (`:141`),
`valuationPptxExportService.ts` (`:199`). `DeckStyler` ma **jeden** realny import
(`bundlePptxRuntime.ts:34`), konsumowany przez `deckPlansToPptxBuffer`, wołane z dwóch
miejsc: `bundleExportRuntime.ts` (`:224,:237`) i `initiativeMaterializeService.ts` (`:488`).
Zmierz to sam przed pisaniem kodu — **to jest powód, dla którego naprawiasz WARTOŚCI stałych
geometrii, nie przepisujesz wołających**: dziewięciu callerów `PptxPipelineService` to zbyt
duży, niepotrzebny zasięg zmian.

**(K8) `grep` krzyżowy `DeckStyler` × `PptxPipelineService` w testach → puste. Brak testu
porównującego geometrię obu ścieżek — potwierdzone.**

**(K9) `pptxgenjs` 4.0.1, `grep -ril gradient node_modules/pptxgenjs` → 0, potwierdzone.**
Paczka istnieje wyłącznie w `node_modules/` root — `server/node_modules/pptxgenjs` nie
istnieje.

# 2. TEZY ZLECENIA

- **T1.** Kanoniczna geometria (`designTokens.ts` `GRID`/`SPACING`): margines `0.5`,
  `contentY: 1.0`. Zmierz aktualne linie.
- **T2.** ★ Zapasowa geometria leży w `DeckStyler.ts` (`DECK_GRID`: `marginX: 0.6,
  contentTop: 1.7`), NIE w `themeRegistry.ts`. `themeRegistry.ts` niesie wyłącznie
  typografię/paletę pięciu motywów.
- **T3.** `initiativeMaterializeService.ts::materializeDeck` (`:477-495`) woła
  `deckPlansToPptxBuffer` bezwarunkowo, bez flagi, bez fallbacku na `PptxPipelineService` —
  ale ten wzorzec NIE jest uniwersalny; `bundleExportRuntime.ts` ma prawdziwy
  primary→fallback dla głównego pliku (wyjątek: wariant `pptxBoard` też bezwarunkowy).
- **T4.** Zero flagi kontrolującej wybór renderera gdziekolwiek w produkcie.
- **T5.** 53 hexów w `designTokens.ts`, 10 w `DeckStyler.ts` — dokładnie. Szerszy łańcuch
  (kompozyty kanoniczne + `themeRegistry.ts`/`paletteLibrary.ts`/`bundlePptxRuntime.ts`) ma
  więcej — poza zakresem migracji tego dyżuru.
- **T6.** `c-accent`, `c-primary`, `c-focus` — zero w `server/src`, bez wyjątku.
- **T7.** ★ Zestaw „harvard" (`A41034`) leży w `presentationVisualDirectorService.ts:254`,
  trzecim systemie, nie w dwóch rendererach nazwanych w zamówieniu. Token produktu aktualny:
  `#85182F` (`tailwind.config.js:172`). Trzy różne crimsony w repo.
- **T8.** Dziewięciu wołających `PptxPipelineService`, jeden realny importer `DeckStyler`
  (`bundlePptxRuntime.ts:34`), dwóch wołających `deckPlansToPptxBuffer`.
- **T9.** Zero testu porównującego geometrię obu ścieżek.

# 3. POZYCJE DYŻURU

## R1 — Jedna geometria: `DeckStyler` przestaje mieć własne liczby

**Cel:** `DECK_GRID` w `DeckStyler.ts` przestaje być niezależną stałą — margines i
`contentTop` pochodzą z **tego samego** źródła co `PptxPipelineService`, czyli
`designTokens.ts` `GRID`/`SPACING` (T1). Nie przepisujesz `PptxPipelineService` (jest już
kanoniczny) — przepisujesz `DeckStyler.ts`, żeby przestał mieć WŁASNE liczby.

Wymogi:
- za flagą `ENABLE_PPTX_CANONICAL_GEOMETRY` (nowa, `default false`, wzorem
  `ENABLE_DECK_CONCLUSION_SLIDE` w `server/src/config/FeatureFlags.ts`);
- **przy OFF: `DeckStyler.ts` renderuje z DZISIEJSZYMI wartościami** (`marginX: 0.6,
  contentTop: 1.7`) — bajt w bajt, żeby żaden dziś istniejący plik nie zmienił wyglądu bez
  akceptu właściciela;
- przy ON: `DeckStyler` czyta `contentX`/`margin` i `contentY` z `designTokens.ts` (import,
  nie duplikacja liczb — jedno źródło prawdy, żeby przyszła zmiana w jednym miejscu
  aktualizowała oba renderery);
- **zakaz zmiany `slideW`/`slideH`** (oba renderery już zgadzają się co do rozmiaru płótna
  `10 × 5.625`) — zmieniasz WYŁĄCZNIE margines i górę treści, bo to one się rozjeżdżają;
- **zakaz dotykania `PptxPipelineService.ts` i `designTokens.ts`** poza ewentualnym
  eksportem stałych, jeśli dziś nie są eksportowane — `designTokens.ts` jest źródłem,
  `DeckStyler.ts` jest tym, co się dostosowuje, nigdy odwrotnie.

**Ukończone, gdy:** przy ON oba renderery, wywołane z równoważnym wejściem, dają identyczny
margines i `contentY`/`contentTop` (dowód w R3); przy OFF `DeckStyler` niezmieniony
(zasercjonowane); zero zmian w `PptxPipelineService.ts`/`designTokens.ts`.

## R2 — Most tokenów produktu: jeden plik, jedna wartość crimson

**Cel:** serwer nie ma dostępu do zmiennych CSS przeglądarki (K5/T6) — to jest strukturalna
przeszkoda, nie zaniedbanie (`GAMMA_G0_POMIAR.md`). Budujesz **most**: nowy, mały plik
server-side z literalnymi wartościami tokenów marki, **zsynchronizowany ręcznie** z
`tailwind.config.js:172` i `src/index.css:19` — z komentarzem w nagłówku wprost mówiącym,
że to duplikat i skąd go aktualizować (serwer nie może importować frontendowego configu przez
granicę builda; to jest świadomy kompromis, nie przeoczenie).

Zakres WĄSKI, celowo — **nie migrujesz 53+10+20+74 hexów tego dyżuru**:
- nowy plik (np. `server/src/services/report/pptx/productBrandTokens.ts`) eksportuje
  WYŁĄCZNIE markowy crimson produktu (`#85182F`, nazwany stałą, np. `PRODUCT_BRAND_PRIMARY`)
  i — jeśli chcesz domknąć most solidniej — test higieniczny, który parsuje
  `tailwind.config.js` i asercjonuje, że wartość w moście **zgadza się** z `DEFAULT` w
  konfiguracji brandu (żeby dryf między frontem a mostem był czerwonym testem, nie cichym
  zapomnieniem);
- `presentationVisualDirectorService.ts:254` (`harvard: 'A41034'`) — jedyna konkretna
  naprawa niespójności z T7 w tym dyżurze: zamień na wartość z mostu, za TĄ SAMĄ flagą co R1
  (`ENABLE_PPTX_CANONICAL_GEOMETRY` — jedna flaga na „kanoniczne, spójne wartości", nie
  buduj drugiej);
- **zakaz** dotykania pozostałych 12 palet w `B1_PALETTE_PRIMARY_HEX` i zakaz migracji
  `themeRegistry.ts`/`paletteLibrary.ts`/kompozytów `RecommendationStack.ts`/`RiskTable.ts`/
  `ProblemCauseImpact.ts` — to są setki hexów świadomie zaprojektowanych jako odrębne palety
  motywów (`executive/modern/corporate/classic/clean` i 13 zestawów Layout Directora), nie
  błąd do naprawienia. Naprawiasz WYŁĄCZNIE punkt, gdzie nazwa („harvard") explicite
  odwołuje się do marki produktu i przez to KŁAMIE, gdy jej kolor nie zgadza się z marką.

**Ukończone, gdy:** most istnieje z jedną, udokumentowaną wartością; „harvard" w
`presentationVisualDirectorService.ts` używa mostu za flagą ON, dzisiejszej wartości przy
OFF; test dryfu (jeśli zbudowany) czerwienieje, gdy ktoś zmieni `tailwind.config.js` bez
zaktualizowania mostu — dowód mutacyjny.

## R3 — BRAMKA: ten sam deck, dwie drogi, identyczna geometria — zmierzona, nie zadeklarowana

To jest bramka z zamówienia dosłownie. Budujesz porównanie na **realnych wyjściach obu
silników** dla równoważnego wejścia (ten sam zestaw slajdów/treści, przepuszczony przez obie
ścieżki — `PptxPipelineService` i `deckPlansToPptxBuffer`/`DeckStyler`):

1. Wygeneruj plik `.pptx` drogą kanoniczną (`PptxPipelineService`) i drogą zapasową
   (`DeckStyler`) dla tego samego zestawu wejściowego, w JEDNYM przebiegu testu, bez modelu
   (`Z15` — treść slajdów wstrzykujesz jako dane testowe, nie generujesz przez AI).
2. Rozpakuj oba archiwa `.pptx` (są ZIP-em XML — użyj biblioteki już w repo albo
   `unzip`/parsowania XML, NIE „powinno pasować") i **odczytaj rzeczywiste współrzędne**
   pierwszego elementu treści na slajdzie (offset X/Y w EMU albo calach, po konwersji).
3. Asercja: przy fladze **ON** różnica marginesu i góry treści między dwoma plikami wynosi
   **zero** (w granicach zaokrąglenia jednostek biblioteki). Przy **OFF** różnica jest
   dokładnie taka, jak dziś: `0.6 − 0.5 = 0.1"` marginesu, `1.7 − 1.0 = 0.7"` góry treści —
   **zmierzona i zasercjonowana**, nie przepisana z tej instrukcji.
4. Dowód mutacyjny: cofnij R1 (przez `cp`, `Z27`) → test z kroku 3 (ON) czerwienieje →
   przywróć → zielony.

**Ukończone, gdy:** test porównuje realne bajty dwóch wygenerowanych plików, nie strukturę
kodu (`Z34` — grep dowodzi istnienia, nie działania); liczby przed/po R1 obie w raporcie;
test wpięty tak, by biegł bez `RUN_DB_TESTS`, jeśli żadna z dwóch ścieżek nie wymaga bazy do
samego renderu geometrii (zmierz, czy wymaga — jeśli tak, licencja na kontener jest już w
Twoim zestawie portów).

# 4. TABELA LICENCJI PLIKOWEJ

| Zakres | Ścieżki |
|---|---|
| Zapis | `server/src/config/FeatureFlags.ts` — WYŁĄCZNIE dodanie `ENABLE_PPTX_CANONICAL_GEOMETRY` (schemat wzorem `:50`, blok ładujący wzorem `:205`) |
| Zapis | `server/src/services/deliverables/DeckStyler.ts` — WYŁĄCZNIE stała `DECK_GRID` (`marginX`, `contentTop`): odczyt z `designTokens.ts` za flagą. Zakaz zmian w typografii, paletach motywów i logice renderu poza samą geometrią |
| Zapis | `server/src/services/presentationVisualDirectorService.ts` — WYŁĄCZNIE wpis `harvard:` w `B1_PALETTE_PRIMARY_HEX` (`:254`), za tą samą flagą. Zakaz zmian pozostałych 12 wpisów i zakaz zmiany logiki wyboru palety |
| Zapis (nowy plik) | `server/src/services/report/pptx/productBrandTokens.ts` (albo analogiczna nazwa) — most tokenów produktu, WYŁĄCZNIE marka crimson + (opcjonalnie) test dryfu wobec `tailwind.config.js` |
| Zapis | NOWE pliki testowe `day227.*` w `server/src/services/report/pptx/__tests__/`, `server/src/services/deliverables/__tests__/`, `tests/integration/` — pełna licencja (`Z18`/`Z31`). Nowe pliki w `tests/` wymagają `git add -f` |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY227_GAMMA_GEOMETRIA_REPORT.md` |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/report/pptx/PptxPipelineService.ts` · `server/src/services/report/pptx/designTokens.ts` — kanoniczne, są ŹRÓDŁEM, nie zmieniasz ich |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/deliverables/themeRegistry.ts` — typografia/paleta pięciu motywów; K2 potwierdziło, że geometrii tam nie ma, więc nie ma czego naprawiać |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/initiative/initiativeMaterializeService.ts` · `server/src/services/deliverables/bundleExportRuntime.ts` · `server/src/services/deliverables/bundlePptxRuntime.ts` — **logika wyboru silnika/fallbacku jest NIETYKALNA w tym dyżurze** (K3); naprawiasz liczby geometrii wewnątrz `DeckStyler`, nie to, kto go woła |
| Odczyt (ZAKAZ ZAPISU) | `tailwind.config.js` (`:172`) · `src/index.css` (`:19`) — źródło wartości mostu, front nietykalny z tego dyżuru |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/deliverables/paletteLibrary.ts` · kompozyty kanoniczne (`RecommendationStack.ts`, `RiskTable.ts`, `ProblemCauseImpact.ts`) · pozostałe 12 wpisów `B1_PALETTE_PRIMARY_HEX` — poza zakresem R2 (K4/K6), zmierzone i świadomie odłożone |
| Odczyt (ZAKAZ ZAPISU) | pozostałych **8** wołających `PptxPipelineService` spoza `initiativeMaterializeService`/`bundleExportRuntime` (`report-builder.routes.ts`, `my-work.routes.ts`, `presentations.routes.ts`, `report-builder-public.routes.ts`, `presentationGeneratorService.ts`, `valuationExportService.ts`, `transformationFinalOutputService.ts`, `valuationPptxExportService.ts`) — żadnego z nich nie dotykasz; `PptxPipelineService` się nie zmienia, więc oni się nie zmieniają |

**Nietykalne imiennie:** `PptxPipelineService.ts` (poza ewentualnym eksportem stałej, jeśli
brak) · logika wyboru renderera we WSZYSTKICH wołających · `themeRegistry.ts` ·
`paletteLibrary.ts` · pozostałe palety Layout Directora · front (`tailwind.config.js`,
`src/index.css`) · każdy `MODULE_ACCEPTANCE.md`.

**Rozłączność z partią równoległą:** dyżur 226 wchodzi w `presentations.routes.ts` i
ewentualnie w `presentationGeneratorService.ts` (WYŁĄCZNIE jeśli jego T7/K8 tego wymaga —
patrz jego instrukcja). Ty w `presentationGeneratorService.ts` **nie zmieniasz nic** (jest w
Twojej tabeli tylko jako „odczyt, wołający `PptxPipelineService`, nietykalny"), więc kolizja
zasobowa jest mało prawdopodobna, ale **sprawdź `git log` przed pierwszym commitem** i zgłoś,
jeśli oba dyżury faktycznie chcą pisać do tego samego pliku.

# 5. TWARDE ZASADY

- ★★ **JEDNA FLAGA NA GEOMETRIĘ I NA MOST TOKENÓW.** `ENABLE_PPTX_CANONICAL_GEOMETRY` gasi/
  włącza R1+R2 razem — to jest jedna decyzja właściciela „przełącz na spójne wartości", nie
  dwie osobne.
- ★★ **NIE NAPRAWIASZ WYBORU RENDERERA.** K3 pokazał, że logika `primary→fallback` różni się
  per wołający (`bundleExportRuntime.ts` ma prawdziwy fallback, `initiativeMaterializeService.ts`
  nie ma żadnego). To osobna decyzja architektoniczna o szerszym zasięgu niż ten dyżur. Twoim
  zadaniem jest sprawić, że wybór **przestaje mieć znaczenie**, bo obie ścieżki dają tę samą
  geometrię — nie przepisanie, kto kogo woła.
- ★★ **NIE MIGRUJESZ WSZYSTKICH HEXÓW.** R2 naprawia JEDEN nazwany punkt niespójności
  („harvard" vs marka produktu), nie cały system palet. Migrowanie 53+10+20+74 kolorów jest
  osobnym, dużym projektem — nie tym dyżurem.
- ★★ **PRZY OFF — BAJT W BAJT DZISIEJSZE.** Zarówno geometria `DeckStyler`, jak i paleta
  „harvard", mają zostać dokładnie takie jak dziś, dopóki właściciel nie zaakceptuje na
  zrzutach (`CLAUDE.md` §7, §9).
- ★★ **DOWODEM JEST BAJT WYNIKOWEGO PLIKU, NIE STRUKTURA KODU (`Z34`).** R3 czyta realne
  współrzędne z realnie wygenerowanego `.pptx`, nie porównuje literałów w źródle.
- ★ **`designTokens.ts` i `PptxPipelineService.ts` są źródłem, nigdy celem zmiany w tym
  dyżurze** — jeśli poczujesz pokusę „poprawić też kanoniczny", to jest sygnał, że wyszedłeś
  poza licencję.
- ★★ **`Z15` OBOWIĄZUJE.** Dowód R3 budujesz na danych testowych wstrzykniętych wprost, zero
  wołania modelu.
- ★ **`Z31`** — `assertRealPostgresTestEnvironment()` bez argumentów, jeśli w ogóle
  potrzebujesz bazy (zmierz, czy renderer geometrii jej wymaga — być może nie).
- ★ **Sprzątanie kontenera: `docker rm -f -v`** (jeśli kontener w ogóle powstał).
- ★ **`Z27`** — zakaz `git stash`, dowody przez `cp` do
  `/private/tmp/cx-day227-gamma-geometria-scratch`.
- **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji** (`Z28`).
- **Zakaz naprawiania przez wyciszanie**, zakaz usuwania zastanych testów.
- ★ **`§0.4a` — pomiar zasięgu testów jest warunkiem oddania raportu** (`Z24`).
- ★ **Zrzuty: `mean_luma` jasny/ciemny >150 różnicy.** Wymagane: dwa wyeksportowane pliki
  (kanoniczny/zapasowy) otwarte i porównane wizualnie przy fladze ON — pokaż, że marginesy
  się zgadzają. Napisz wprost, czy to realny eksport, czy atrapa.
- ★ **`Z13`** — logi, zrzuty, pliki `.pptx` z dowodu NIE wchodzą do repo, leżą w
  `/private/tmp/cx-day227-gamma-geometria-artefakty`, raport podaje ścieżki i `shasum -a 256`.
- Pułapka: `No test files found` nie jest `PASS`. Pułapka: liczby i NAZWY testów z JSON-a
  (`Z37`).
- ★ Porty **6171/5130-5131 wyłącznie Twoje**. Porty **6170/5128-5129** (226) i
  **6172/5132-5133** (228) zarezerwowane dla dyżurów równoległych. Porty **5000, 5037,
  5060-5061** zajęte na stałe. Porty **6173-6175, 5134-5139** zabronione (dyżury 229-232).
- ★★ **Sekcja „TWIERDZENIA NIEZWERYFIKOWANE" w raporcie jest OBOWIĄZKOWA.** Wypisz co
  najmniej: czy `themeRegistry.ts` naprawdę nie ma geometrii na Twojej bazie (potwierdź
  pomiarem — zamówienie się myliło, sprawdź, czy nadal); czy `initiativeMaterializeService.ts`
  nadal woła `DeckStyler` bez flagi i fallbacku przed Twoją zmianą; ile hexów policzyłeś w
  `designTokens.ts` i `DeckStyler.ts` i czy zgadza się z `53`/`10`; czy „harvard" nadal ma
  wartość różną od tokenu produktu przed naprawą i identyczną po; czy R3 czyta bajty
  wygenerowanego pliku czy tylko literały kodu; czy renderer geometrii wymagał bazy danych;
  czy zrzuty pochodzą z realnego eksportu. **Brak tej sekcji jest podstawą odrzucenia
  dyżuru.**
