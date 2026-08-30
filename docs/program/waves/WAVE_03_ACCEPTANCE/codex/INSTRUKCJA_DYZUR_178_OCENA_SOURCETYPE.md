# INSTRUKCJA DYŻURU nr 178 — Codex — „Ocena — inicjatywy z Assessmentu odrzucane przez własną białą listę frontu bo backend nadpisuje sourceType frameworkiem"

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
> **wyłącznie** `/private/tmp/cx-day178-ocena`.

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
Zakres: **04_ASSESSMENT — werdykt NO_GO w rekonesansie; ten dyżur naprawia jedną nazwaną przyczynę, nie zamyka modułu**.
Trasy front: ``src/components/assessment/library/AssessmentLibraryTab.tsx` (wyłącznie propy `empty`/`error` przekazywane do `StandardTable`, ok. linii 397-411); `src/components/assessment/AssessmentHub.tsx` — WYŁĄCZNIE ODCZYT, `isAssessmentModuleInitiative` (linie 328-340) nie zmienia się chyba że pomiar po stronie backendu tego wymaga (patrz pułapki)`. Trasy tył: ``server/src/controllers/InitiativeController.ts` — wyłącznie metoda `getInitiatives` (statyczna, zaczyna się linia 174): SQL alias `source_framework` (ok. linii 211-215) i mapowanie `sourceType` (linia 363)`.

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
WT=/private/tmp/cx-day178-ocena
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
git -C "$VAULT" worktree add "$WT" -b codex/day178-ocena-20260830 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day178-ocena/config.worktree"
cat "$VAULT/worktrees/cx-day178-ocena/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day178-ocena-scratch
mkdir -p /private/tmp/cx-day178-ocena-artefakty

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
git -C "$WT" push github-backup codex/day178-ocena-20260830
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only d3d36cd5f5..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `pięć` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day178-ocena

# (T1) BACKEND NADPISUJE sourceType FRAMEWORKIEM
sed -n '211,216p' server/src/controllers/InitiativeController.ts
sed -n '360,368p' server/src/controllers/InitiativeController.ts
#   oczekiwane: alias `source_framework` w SQL (linia ~215), oraz
#   `sourceType: i.source_framework || i.source_type` w linii 363 — wygrywa framework.
#   Zauważ: `sourceFramework: i.source_framework` już istnieje osobno w linii 367 —
#   pole POPRAWNE już jest w odpowiedzi, tylko sourceType jest skażony.

# (T2) BIAŁA LISTA FRONTU WYMAGA PREFIKSU assessment*
sed -n '328,341p' src/components/assessment/AssessmentHub.tsx
grep -n "isAssessmentModuleInitiative" src/components/assessment/AssessmentHub.tsx
#   oczekiwane: whitelist st==='assessment'|'assessment_report'|'assessment_drd'|...
#   "DRD" (wartość realnie zwracana dziś) nie pasuje do żadnej.

# (T3) DOWÓD W REKONESANSIE
grep -n "przyczyna pustych Inicjatyw znaleziona" docs/program/funkcje/REKONESANS_ZAMKNIECIA_16_MODULOW.md

# (T4) INNI KONSUMENCI sourceType — MUSISZ SPRAWDZIĆ PRZED ZMIANĄ
grep -rn "\.sourceType\b\|sourceType:\|source_type" server/src/ src/ --include='*.ts' --include='*.tsx' | grep -v __tests__ | wc -l
grep -rln "\.sourceType\b" src/ --include='*.tsx' | grep -v __tests__
#   oczekiwane: policz WSZYSTKICH konsumentów przed zmianą — zero zgadywania.

# (T5) LIBRARY — ZAWSZE ZAKŁADA BŁĄD
sed -n '397,411p' src/components/assessment/library/AssessmentLibraryTab.tsx
grep -n "const data\s*=\|error=" src/components/assessment/library/AssessmentLibraryTab.tsx
#   oczekiwane: `empty.description` = "The methodology catalog could not be loaded." (angielski,
#   zakłada błąd), StandardTable BEZ propa `error` w ogóle — `data` pochodzi z METHODOLOGY_CATALOG
#   (stała), więc empty state jest dziś praktycznie nieosiągalny normalną drogą.
```

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day178-ocena-20260830` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6078`. Twój JEDYNY port harnessu to `5026 i 5027`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day178-pg`**. **ZAKAZANE:** `6012, 5433, 6047 i 6054-6055 oraz 6061-6067 (odbiory nadzorcy), 6068-6071/5010-5017 (dyżury 170-173), 6074/5018-5019 (174), 6075/5020-5021 (175), 6076/5022-5023 (176), 6077/5024-5025 (177), 6079/5028-5029 (179). ★ PORT 5000 ZAJĘTY NA STAŁE przez macOS Control Center`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak — ten dyżur NIE wprowadza ani nie zmienia żadnej flagi`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY178_OCENA_REPORT.md`. Nie zmieniasz żadnego `MODULE_ACCEPTANCE.md` — moduł Ocena ma werdykt NO_GO w rekonesansie z osobną decyzją zakresu remediacji właściciela; ten dyżur naprawia jedną nazwaną przyczynę, nie zamyka karty. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day178-ocena-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day178-ocena-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **ZAKAZ zmiany `sourceType` bez uprzedniego grepa WSZYSTKICH konsumentów.** Zamawiający wymaga w treści zlecenia: framework ma iść w OSOBNYM polu (już istnieje: `sourceFramework`, `InitiativeController.ts:367`) — `sourceType` przestaje być nadpisywany frameworkiem, ale MUSISZ sprawdzić każde miejsce w `server/src/` i `src/` czytające `.sourceType`/`source_type` z odpowiedzi tego endpointu i potwierdzić, że żadne z nich nie polegało po cichu na wartości frameworka (np. `"DRD"`) zamiast `"assessment"`. Jeśli znajdziesz taki konsument, NIE zmieniaj go po cichu — nazwij go w raporcie i albo dostosuj w ramach tej samej naprawy (jeśli to oczywiście ten sam błąd), albo zatrzymaj się i zgłoś jako osobną pozycję. **NIE ZMIENIASZ WYGLĄDU** poza tekstem pustego stanu Library. **NIE ROZSZERZASZ białej listy frontu (`isAssessmentModuleInitiative`) jako alternatywnego fixu** — zamawiający chce naprawy u źródła (backend przestaje nadpisywać), nie łatania frontu dodatkowymi wartościami (`'DRD'`, `'SIRI'` itd. do whitelisty) — to by ukryło ten sam błąd w kolejnym miejscu zamiast go usunąć. **NIE DOTYKASZ innych zapytań w `InitiativeController.ts`** poza `getInitiatives` (np. linia 3015 `sourceType: i.source_type` w innej metodzie jest POZA zakresem, chyba że zmierzysz identyczny defekt tam i zgłosisz osobno). **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.** | Rekonesans zamknięcia 16 modułów (`docs/program/funkcje/REKONESANS_ZAMKNIECIA_16_MODULOW.md`, sekcja „Znaleziska NOWE”) nazywa dokładną przyczynę pustej zakładki Inicjatywy w module Ocena: **„OCENA — przyczyna pustych Inicjatyw znaleziona: `InitiativeController.ts:~362` nadpisuje `sourceType` frameworkiem (`COALESCE(sa.framework_type, sa.assessment_type)` → np. `"DRD"`), a biała lista frontu (`AssessmentHub.tsx:328-340`) wymaga `assessment*` — rekord odrzucany MIMO istnienia danych. Jeden precyzyjny fix.”** Weryfikacja dziś potwierdza obie połówki: backend (`InitiativeController.ts:215` aliasuje `COALESCE(sa.framework_type, sa.assessment_type) as source_framework`, a linia 363 robi `sourceType: i.source_framework || i.source_type` — czyli WYGRYWA framework, np. `"DRD"`, nad realnym `source_type`, np. `"assessment"`); front (`AssessmentHub.tsx:328-340`, `isAssessmentModuleInitiative`) akceptuje wyłącznie `st === 'assessment'|'assessment_report'|'assessment_drd'|'assessment_siri'|'assessment_adma'` — `"DRD"` (bez prefiksu, wielkie litery) nie pasuje do żadnej wartości. Wynik: tabela Ocena → Inicjatywy filtruje `rawInits` przez `isAssessmentModuleInitiative` (linia 655) i rekord znika, mimo że backend już ma osobne, poprawne pole `sourceFramework: i.source_framework` (linia 367) obok skażonego `sourceType`. |

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
cd /private/tmp/cx-day178-ocena

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day178-pg psql -U postgres -d cx178 \
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
cd /private/tmp/cx-day178-ocena

docker run -d --name cx-day178-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx178 \
  -p 127.0.0.1:6078:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day178-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6078/cx178 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6078/cx178 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day178-ocena && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6078/cx178 \
JWT_SECRET=cx178-test-secret-do-not-reuse \
npx vitest run server/tests, tests/integration/initiatives, src/components/assessment/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day178-ocena-artefakty/day178-vitest.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day178-ocena && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/tests, tests/integration/initiatives, src/components/assessment/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day178-ocena-artefakty/day178-vitest.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day178-ocena/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day178-pg psql -U postgres -d cx178 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day178-pg`.
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
> **(e) ★★ **Pierwsza: pole `sourceFramework` JUŻ ISTNIEJE w odpowiedzi** (`InitiativeController.ts:367`, `sourceFramework: i.source_framework`) — nie musisz go dodawać, tylko przestać nadpisywać nim `sourceType` w linii 363. Zmiana to prawdopodobnie jedna linia: `sourceType: i.source_type` (bez `|| i.source_framework`/bez preferowania frameworka), NIE nowa kolumna SQL. Zweryfikuj sam, czy `i.source_type` (surowa kolumna z `SELECT i.*`) jest zawsze obecna i niepusta dla inicjatyw z Assessmentu — jeśli bywa `null`, ustal bezpieczny fallback (np. `'assessment'` z kontekstu joina) i uzasadnij w raporcie, nie zgaduj. **Druga: `AssessmentHub.tsx:328-340` czyta `row?.source_type || row?.sourceType`** — czyli sprawdza OBA warianty nazewnictwa (snake_case i camelCase). Upewnij się po naprawie backendu, który z nich faktycznie niesie poprawną wartość `'assessment'`/`'assessment_drd'` w realnej odpowiedzi API (nie zakładaj — sprawdź payload). **Trzecia: linia 3015 tego samego pliku backendu ma DRUGIE, osobne miejsce z `sourceType: i.source_type`** (inna metoda, inny endpoint) — to NIE jest ten sam bug i nie jest w licencji tego dyżuru; nie myl obu metod przy edycji, sprawdź dokładnie w której metodzie jesteś (`getInitiatives`, zaczyna się linia 174) przed zmianą linii 363. **Czwarta, dla R2: `data` w `AssessmentLibraryTab.tsx` pochodzi z `useMemo(() => METHODOLOGY_CATALOG.map(...), [])` — stałej, nie fetchu sieciowego.** To oznacza, że stan pusty tabeli jest dziś PRAKTYCZNIE nieosiągalny (katalog nigdy nie jest pusty), więc tekst "could not be loaded" jest fałszywy z definicji, nie tylko mylący. Zweryfikuj, czy `StandardTable` ma prop `error` (wzorem `src/components/assessment/AssessmentOutputsTab.tsx:320-346`, które POPRAWNIE rozdziela `error={hasLoadError ? ... : null}` od `empty={{title:'No insights yet', ...}}`) i zastosuj analogiczny wzorzec: albo usuń fałszywą sugestię błędu z tekstu pustego stanu (bo dla stałej listy 'pusty katalog' i 'błąd ładowania' to fizycznie różne rzeczy), albo — jeśli katalog faktycznie kiedyś może przyjść z sieci — dodaj realny `error` prop zasilany prawdziwym stanem błędu. Zdecyduj i uzasadnij, nie kopiuj mechanicznie wzorca bez sprawdzenia, czy `AssessmentLibraryTab` w ogóle ma jakikolwiek fetch, który mógłby zawieść. **Piąta: `empty.title`/`empty.description` w Library są dziś PO ANGIELSKU** (`'No assessment frameworks available'`, `'The methodology catalog could not be loaded.'`) w komponencie, który resztę tekstów renderuje przez `isPolish ? ... : ...` (linia 156 i dalej) — jeśli poprawiasz treść, zachowaj ten sam wzorzec dwujęzyczny, nie wprowadzaj `t()` jeśli reszta pliku go nie używa (sprawdź `grep -n "useTranslation\|isPolish"` przed wyborem mechanizmu).**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day178-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day178-ocena-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`pozycja R1 — inicjatywa z Assessmentu z realnym frameworkiem trafia do odpowiedzi API i przechodzi filtr frontu`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6078` albo `5026 i 5027` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6078` albo `5026 i 5027`** (`Z7`).

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

Jedna sprawa jest nazwana z precyzyjną przyczyną w rekonesansie zamknięcia, druga jest zauważona
przy okazji tego samego przeglądu kodu — obie zweryfikowane dziś, nie hipotezy.

**Pierwsza — przyczyna pustej zakładki Inicjatywy w module Ocena.**
`docs/program/funkcje/REKONESANS_ZAMKNIECIA_16_MODULOW.md`, sekcja „Znaleziska NOWE”, punkt 1:

```
OCENA — przyczyna pustych Inicjatyw znaleziona: InitiativeController.ts:~362 nadpisuje
sourceType frameworkiem (COALESCE(sa.framework_type, sa.assessment_type) → np. "DRD"), a biała
lista frontu (AssessmentHub.tsx:328-340) wymaga assessment* — rekord odrzucany MIMO istnienia
danych. Jeden precyzyjny fix.
```

Weryfikacja dzisiejsza potwierdza obie połówki dokładnie:

```sql
-- server/src/controllers/InitiativeController.ts:211-215 (metoda statyczna getInitiatives, linia 174)
SELECT i.*,
    ob.first_name as ob_first_name, ...
    COALESCE(sa.framework_type, sa.assessment_type) as source_framework
FROM initiatives i
LEFT JOIN assessments sa ON sa.id = COALESCE(i.source_assessment_id, i.source_id)
```

```ts
// linia 363
sourceType: i.source_framework || i.source_type,
...
// linia 367 — pole POPRAWNE już istnieje osobno, obok skażonego sourceType
sourceFramework: i.source_framework,
```

`source_framework` (np. `"DRD"`) wygrywa nad realnym `source_type` (np. `"assessment"`) w polu
`sourceType`, mimo że backend już wystawia framework osobno w `sourceFramework`. Front:

```ts
// src/components/assessment/AssessmentHub.tsx:328-340
const isAssessmentModuleInitiative = (row: any): boolean => {
  if (!row?.id) return false;
  const st = String(row?.source_type || row?.sourceType || '').toLowerCase();
  const sid = String(row?.source_id || row?.sourceId || '').trim();
  if (!sid) return false;
  return (
    st === 'assessment' || st === 'assessment_report' || st === 'assessment_drd' ||
    st === 'assessment_siri' || st === 'assessment_adma'
  );
};
```

`"drd"` (lowercased `"DRD"`) nie pasuje do żadnej z pięciu dozwolonych wartości — wszystkie
wymagają prefiksu `assessment`. Rekord z danymi jest odrzucany przez własną białą listę frontu,
bo backend podmienił pole, które ta lista czyta.

**Druga — tekst pustego stanu Library zawsze zakłada błąd.** Ten sam rekonesans (tabela „Tezy
OBALONE”) obalił hipotezę „Ocena: Insights bez uczciwego stanu pustego” — Insights MA uczciwy
stan pusty (`AssessmentOutputsTab.tsx:334-346`) — ale doprecyzował: „Library ma tekst mylący
(zakłada błąd ładowania)”. Weryfikacja dziś:

```ts
// src/components/assessment/library/AssessmentLibraryTab.tsx:397-411
<StandardTable
  columns={columns}
  data={data}
  loading={false}
  ...
  empty={{
    icon: LibraryIcon,
    title: 'No assessment frameworks available',
    description: 'The methodology catalog could not be loaded.',
  }}
/>
```

`data` pochodzi z `useMemo(() => METHODOLOGY_CATALOG.map((row) => ({ ...row })), [])` — stałej w
kodzie, nie z fetchu sieciowego (`AssessmentLibraryTab.tsx:343`). Tekst „could not be loaded”
zakłada awarię ładowania, która dla stałej listy nie może fizycznie wystąpić. Kontrastowy wzorzec
w tym samym module, `AssessmentOutputsTab.tsx:320-346`, poprawnie rozdziela `error={hasLoadError
? '...' : null}` (realny stan błędu fetchu) od `empty={{title:'No insights yet', ...}}` (realny
brak danych) — `StandardTable` wspiera oba propy, `AssessmentLibraryTab` używa tylko jednego, z
tekstem błędu tam, gdzie błędu być nie może.

# 2. TEZY ZLECENIA

- **T1.** `sourceType` przestaje nieść wartość frameworka. Framework ma już osobne miejsce
  (`sourceFramework`) — naprawa to przestanie nadpisywać, nie dodanie nowego pola.
- **T2.** Przed zmianą `sourceType` MUSISZ sprawdzić wszystkich konsumentów tego pola w
  `server/src/` i `src/` — zmiana wartości pola czytanego w wielu miejscach bez sprawdzenia jest
  dokładnie tym ryzykiem, przed którym ostrzega `CLAUDE.md` (masowa, nieprzemyślana podmiana).
- **T3.** Bramka R1 to dowód PG: inicjatywa z assessmentu z `framework_type='DRD'` pojawia się w
  odpowiedzi API i przechodzi filtr `isAssessmentModuleInitiative` frontu — dowód mutacyjny, nie
  odczyt kodu.
- **T4.** Tekst pustego stanu Library ma odróżniać „brak danych” od „błąd” — nawet jeśli w
  praktyce stan pusty jest dziś nieosiągalny (stała lista), tekst nie może kłamać o przyczynie.

# 3. POZYCJE DYŻURU

## R1 — sourceType przestaje być nadpisywany frameworkiem

Zmień `server/src/controllers/InitiativeController.ts:363` tak, by `sourceType` niósł realną
wartość `source_type` (np. `sourceType: i.source_type`), nie wynik frameworka. Framework
pozostaje dostępny wyłącznie przez już istniejące pole `sourceFramework` (linia 367) — nie
usuwasz go, nie duplikujesz.

Przed zmianą zgrepuj WSZYSTKICH konsumentów `.sourceType`/`sourceType:`/`source_type` w
`server/src/` i `src/` (poza testami) i wypisz w raporcie każde miejsce, które czyta pole z
odpowiedzi `GET /api/initiatives` (metoda `getInitiatives`, linia 174) — potwierdź dla każdego,
czy polegało po cichu na wartości frameworka. Jeśli tak, oceń: to ten sam błąd (napraw w ramach
tej pozycji) czy inny kontrakt (zatrzymaj się, zgłoś osobno, nie zmieniaj).

Uwaga: w tym samym pliku, INNA metoda ma osobne, niepowiązane wystąpienie `sourceType: i.source_type`
(linia ok. 3015) — to nie jest ten sam endpoint i nie jest w zakresie tej zmiany; nie edytuj go
przy okazji.

Sprawdź, czy `i.source_type` bywa `null`/puste dla inicjatyw z Assessmentu (surowa kolumna z
`SELECT i.*`) — jeśli tak, ustal bezpieczny fallback i uzasadnij go w raporcie zamiast zakładać.

**Ukończone, gdy:** test PG tworzy inicjatywę powiązaną z assessmentem, gdzie
`sa.framework_type = 'DRD'`, wywołuje `GET /api/initiatives` i potwierdza: (a) `sourceType` w
odpowiedzi to realna wartość źródła (np. `'assessment'`), NIE `'DRD'`; (b) `sourceFramework` w tej
samej odpowiedzi to `'DRD'`; (c) `isAssessmentModuleInitiative(row)` z frontu zwraca `true` dla
tego rekordu. Dowód mutacyjny — nie odczyt kodu.

## R2 — Library: brak danych ≠ błąd

Zmień wyłącznie propy przekazywane do `StandardTable` w `AssessmentLibraryTab.tsx` (ok. linii
397-411). Ustal najpierw fakt: czy `data` (z `METHODOLOGY_CATALOG`) może w tym komponencie
kiedykolwiek być rzeczywiście pusta lub czy istnieje jakikolwiek fetch, który mógłby zawieść — na
podstawie tego faktu wybierz i uzasadnij w raporcie jedno z dwóch:
- tekst pustego stanu przestaje sugerować błąd ładowania (bo go tu nie ma) i mówi uczciwie o
  braku pozycji w katalogu;
- albo, jeśli jest realny punkt awarii, dodaj analogiczny do `AssessmentOutputsTab.tsx` prop
  `error` zasilany prawdziwym stanem błędu, zostawiając `empty` dla faktycznego braku danych.

Zachowaj dwujęzyczny wzorzec pliku (`isPolish ? ... : ...`, linia 156 i dalej) — nie wprowadzaj
`t()`, jeśli reszta pliku go nie używa; sprawdź `grep -n "useTranslation\|isPolish"` przed
wyborem.

**Ukończone, gdy:** tekst pustego stanu Library nie twierdzi nieprawdy o przyczynie (błąd
ładowania) dla ścieżki, która nie może zawieść, oraz — jeśli dodano prop `error` — istnieje
scenariusz testowy pokazujący oba stany osobno.

## R3 — dowody

Dla R1: test integracyjny PG (lokalizacja: `server/tests` lub `tests/integration/initiatives`,
dopasuj do istniejącej konwencji najbliżej `InitiativeController` — sprawdź, co już tam jest)
opisany w „Ukończone, gdy” R1.

Dla R2: test/render-snapshot komponentu `AssessmentLibraryTab` (lokalizacja:
`src/components/assessment/__tests__/` jeśli istnieje analogiczny wzorzec, inaczej dopasuj do
sąsiadów) potwierdzający nową treść stanu pustego i — jeśli dotyczy — rozróżnienie `error`/`empty`.

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis | `server/src/controllers/InitiativeController.ts` — wyłącznie metoda `getInitiatives` (statyczna, linia 174): mapowanie `sourceType`, linia 363; zakaz zmian w innych metodach tego pliku (np. linia ~3015) |
| Zapis | `src/components/assessment/library/AssessmentLibraryTab.tsx` — wyłącznie propy `empty`/`error` przekazywane do `StandardTable`, ok. linii 397-411 |
| Zapis | testy `day178.*` — lokalizację potwierdź wg konwencji sąsiadującej z każdym zmienianym plikiem |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY178_OCENA_REPORT.md` |
| Odczyt | `src/components/assessment/AssessmentHub.tsx` — `isAssessmentModuleInitiative` (linie 328-340) i wywołanie filtra (linia 655); **nie zmieniasz whitelisty jako alternatywnego fixu** |
| Odczyt | `src/components/assessment/AssessmentOutputsTab.tsx` (linie 320-346) — wzorzec `error`/`empty` do naśladowania; nie zmieniasz |
| Odczyt | `docs/program/funkcje/REKONESANS_ZAMKNIECIA_16_MODULOW.md` — źródło R1/R2; nie zmieniasz |
| Odczyt | wszyscy konsumenci `.sourceType`/`source_type` znalezieni grepem przed zmianą R1 — tylko odczyt, chyba że w raporcie jawnie uzasadnisz rozszerzenie zakresu |

**Nietykalne imiennie:** `isAssessmentModuleInitiative` i cała biała lista frontu w
`AssessmentHub.tsx` (naprawa idzie od źródła w backendzie, nie przez rozszerzenie whitelisty);
inne metody `InitiativeController.ts` poza `getInitiatives`; żaden `MODULE_ACCEPTANCE.md`.

★ **Rozłączność z dyżurami działającymi równolegle (176 Ustawienia, 177 Partner, 179 Czat) oraz z
173/175:** 173 (`InitiativeTasksTab.tsx`, `UserTaskList.tsx`, `Portfolio/InitiativeSidePanel.tsx`,
`Initiatives/calendar/InitiativeCalendar.tsx`, `MyWork/DecisionDetailView.tsx` blok odczytu klucza,
root `vitest.config.ts`), 175 (`TaskDetailView.tsx` autozapis). Żaden z plików tego dyżuru
pokrywa się z żadnym z powyższych — `InitiativeController.ts` jest dotykany po raz pierwszy w tej
grupie dyżurów, wyłącznie w metodzie `getInitiatives`.

# 5. TWARDE ZASADY

- ★ **ZAKAZ zmiany `sourceType` bez uprzedniego grepa wszystkich konsumentów.** To jest dokładnie
  „naprawa per-wywołanie” ryzyko — pole czytane w wielu miejscach, zmiana bez sprawdzenia może
  cicho zepsuć inny konsument.
- **NIE rozszerzasz białej listy frontu** jako alternatywnego fixu — naprawiasz źródło.
- **Nie zmieniasz wyglądu** poza tekstem pustego stanu Library.
- **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.** Wszystko lokalnie.
- Pułapka: `No test files found` NIE jest `PASS`. Sprawdź `numTotalTests` > 0.
- Pułapka ogólna programu: bez `RUN_DB_TESTS=1` testy backendowe idą na MOCK DB — dowód R1 MUSI
  być na realnym PostgreSQL (`RUN_DB_TESTS=1`, `DB_TYPE=postgres`), inaczej `COALESCE`/join nie są
  realnie ćwiczone.
- ★ Port **5000 jest zajęty na stałe przez macOS Control Center** — nie używaj go do żadnego
  serwera pomocniczego.
- Wymóg sekcji „TWIERDZENIA NIEZWERYFIKOWANE" w raporcie końcowym — wypisz w niej wprost, jeśli
  nie zdążyłeś sprawdzić wszystkich konsumentów `sourceType` znalezionych grepem, albo jeśli nie
  ustaliłeś ostatecznie, czy `AssessmentLibraryTab` ma jakikolwiek realny punkt awarii ładowania.
