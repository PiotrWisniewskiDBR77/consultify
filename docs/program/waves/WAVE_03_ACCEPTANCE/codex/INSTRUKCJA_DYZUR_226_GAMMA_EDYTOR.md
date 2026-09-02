# INSTRUKCJA DYŻURU nr 226 — Codex — „Martwy edytor motywu prezentacji: customTemplate ginie w destrukturyzacji req.body handlera PUT /templates/:id (presentations.routes.ts:1566-1567), 13 zestawow kolorystycznych zapisuje colorTemplateId ktorego buildTemplateRuntimeFromRow nigdy nie czyta (presentationTemplateRuntimeService.ts:372-452) — czerwony test kontraktowy (presentationCustomTemplateContract.test.ts, 4/4 fail) juz czeka w repo na naprawe"

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
> **wyłącznie** `/private/tmp/cx-day226-gamma-edytor`.

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
Zakres: **Materialy / Prezentacje — edytor motywu (PresentationTemplateArchitectView) i backend szablonow prezentacji (presentations.routes.ts, presentationTemplateRuntimeService.ts, presentationTemplateCompatibilityService.ts)**.
Trasy front: ``src/components/Presentations/PresentationTemplateArchitectView.tsx` (`handleSave()` :501-528 — juz poprawny, tylko do odczytu w tym dyzurze), `src/services/presentationTemplateArchitect.ts` (`updatePresentationTemplate` :251-256, `Api.put`), `src/components/shared/colorPatterns/curatedColorSets.ts` (13 zestawow, :37-234), `src/components/shared/colorPatterns/ColorPatternPicker.tsx``. Trasy tył: ``PUT /api/presentations/templates/:id` — `server/src/routes/presentations.routes.ts:1542` (`router.put`), destrukturyzacja `req.body` `:1566-1567` (gubi `customTemplate`), scalanie `layoutPolicyJson` `:1569-1589` (wzorzec dla `colorTemplateId`, do skopiowania dla `customTemplate`); `server/src/services/presentationTemplateRuntimeService.ts::buildTemplateRuntimeFromRow` `:372-452` (nie zna `colorTemplateId`) i interfejs `PresentationTemplateRuntime` `:174-195`; `server/src/services/presentationTemplateCompatibilityService.ts::normalizeTemplatePayload` `:32-33` (wzorzec odczytu, juz poprawny, nietykalny); `server/src/services/presentationApprovedTemplateService.ts::resolveApprovedPresentationTemplate` `:52-61`; callerzy w `server/src/services/presentationGeneratorService.ts:1526,1715``.

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
WT=/private/tmp/cx-day226-gamma-edytor
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
git -C "$VAULT" worktree add "$WT" -b codex/day226-gamma-edytor-20260901 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day226-gamma-edytor/config.worktree"
cat "$VAULT/worktrees/cx-day226-gamma-edytor/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day226-gamma-edytor-scratch
mkdir -p /private/tmp/cx-day226-gamma-edytor-artefakty

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
git -C "$WT" push github-backup codex/day226-gamma-edytor-20260901
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
cd /private/tmp/cx-day226-gamma-edytor

# (T1) POTWIERDZ, ZE customTemplate NADAL GINIE
sed -n '1560,1610p' server/src/routes/presentations.routes.ts
#   oczekiwane: destrukturyzacja linia ok. 1566-1567 BEZ customTemplate; warunek scalania
#   layoutPolicyJson ok. 1576 czyta wylacznie colorTemplateId.

# (T2) POTWIERDZ FRONT — customTemplate JEST WYSYLANY
sed -n '495,520p' src/components/Presentations/PresentationTemplateArchitectView.tsx
#   oczekiwane: handleSave() wysyla customTemplate: editCustomTemplate w body PUT.

# (T3) URUCHOM CZERWONY TEST KONTRAKTOWY — juz istnieje
RUN_DB_TESTS=1 DATABASE_URL=postgres://... node_modules/.bin/vitest run \
  server/src/routes/__tests__/presentationCustomTemplateContract.test.ts
#   oczekiwane: 4 failed (4) — to jest specyfikacja Twojej naprawy R1.

# (T4) POTWIERDZ, ZE buildTemplateRuntimeFromRow NIE ZNA colorTemplateId
grep -n "colorTemplateId\|color_template_id" server/src/services/presentationTemplateRuntimeService.ts
#   oczekiwane: 0 wynikow.
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day226-gamma-edytor-20260901` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6170`. Twój JEDYNY port harnessu to `5128 i 5129`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day226-pg`**. **ZAKAZANE:** `6012, 5433, 6047 i 6054-6169 (odbiory nadzorcy i dyzury wczesniejsze) oraz 5010-5127, 6404-6411 (rezerwacje), 6171/5130-5131 (227, rownolegly), 6172/5132-5133 (228, rownolegly). ★ PORT 5000 ZAJETY NA STALE przez macOS Control Center, 5037 przez `adb`, 5060-5061 zajete. ZABRONIONE (dyzury 229-232): 6173-6175, 5134-5139`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `R1+R2+R3 razem, jedna flaga `ENABLE_PRESENTATION_TEMPLATE_CUSTOM_SAVE` (nowa, default false) — gasi/wlacza caly lancuch zapis→odczyt→(jesli zywa) konsumpcja w eksporcie`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY226_GAMMA_EDYTOR_REPORT.md`. Nie zmieniasz zadnego MODULE_ACCEPTANCE.md — ten dyzur jest naprawa silnika backendowego, nie odbiorem ekranu modulu Materialy. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day226-gamma-edytor-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day226-gamma-edytor-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **NIE PRZEBUDOWUJESZ EDYTORA.** Wzorzec Gammy (szesc zakladek: Colors/Fonts/Logo/Design/Images/Charts) i wbudowane sprawdzanie kontrastu sa zmierzone jako realne luki (K9 w instrukcji), ale sa **poza zakresem** — edytor ma dzis 0 zakladek (plaski formularz) i to zostaje bez zmian. **NIE ZAKLADASZ konsumpcji w renderze PPTX** — masz to ZMIERZYC (R2), nie zalozyc, ze runtime.customTemplate.theme.* dociera do pliku. **NIE BUDUJESZ drugiej flagi** na zapis i osobnej na odczyt — jedna flaga na caly lancuch. **NIE DOTYKASZ geometrii/marginesow PPTX** (renderer) — to zakres dyzuru 227. **NIE ZMIENIASZ walidatora** — `validatePresentationCustomTemplate` musi byc ta sama funkcja po stronie zapisu i odczytu. | Zmierzone (GAMMA_G0_POMIAR.md, established 2026-09-01, potwierdzone ponownie na SHA 9fb7942a01): front wysyla customTemplate w handleSave() (PresentationTemplateArchitectView.tsx:517), backend PUT /templates/:id (presentations.routes.ts:1566-1567) go nigdy nie czyta z req.body — konsultant ustawia kroje i kolory, dostaje potwierdzenie zapisu, a dane gina po stronie serwera. Drugi martwy kanal: 13 zestawow kolorystycznych (curatedColorSets.ts) zapisuje colorTemplateId poprawnie, ale buildTemplateRuntimeFromRow (presentationTemplateRuntimeService.ts) go nigdy nie czyta — 0 odwolan w calej funkcji i w zwracanym typie. Znalezisko dodatkowe: czerwony test kontraktowy juz istnieje w repo (presentationCustomTemplateContract.test.ts, 4/4 fail) — specyfikacja naprawy jest juz napisana, nie trzeba jej wymyslac od zera. |

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
cd /private/tmp/cx-day226-gamma-edytor

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day226-pg psql -U postgres -d cx226 \
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
cd /private/tmp/cx-day226-gamma-edytor

docker run -d --name cx-day226-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx226 \
  -p 127.0.0.1:6170:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day226-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6170/cx226 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6170/cx226 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day226-gamma-edytor && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6170/cx226 \
JWT_SECRET=cx226-test-secret-do-not-reuse \
npx vitest run server/src/routes/__tests__, server/src/services/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day226-gamma-edytor-artefakty/day226-vitest.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day226-gamma-edytor && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/routes/__tests__, server/src/services/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day226-gamma-edytor-artefakty/day226-vitest.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day226-gamma-edytor/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day226-pg psql -U postgres -d cx226 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day226-pg`.
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
> **(e) ★★ **Metoda HTTP to `PUT`, nie `PATCH`.** Zamowienie mowilo o PATCH — zmierzone: `Api.put()` na froncie, `router.put('/templates/:id', ...)` na backendzie (`presentations.routes.ts:1542`). Uzywaj `PUT /api/presentations/templates/:id` wszedzie, PATCH nigdzie w kodzie nie wystepuje dla tej trasy. **Druga: strona odczytu JUZ oczekuje `customTemplate` w `layout_policy_json`** — `presentationTemplateCompatibilityService.ts:32-33` (`normalizeTemplatePayload`) zaklada, ze `layout_policy_json.customTemplate` istnieje. To NIE jest kod do zmiany — to jest GOTOWY wzorzec pokazujacy dokladnie, gdzie ma trafic pole po naprawie zapisu. **Trzecia: czerwony test kontraktowy juz jest w repo** (`presentationCustomTemplateContract.test.ts`, 4/4 fail) — przeczytaj go PRZED pisaniem kodu, jego asercje sa gotowa specyfikacja, ale moga nie pasowac 1:1 do ksztaltu, ktory wybierzesz — dopasuj pomiarem, nie zgadywaniem, i uzasadnij kazda zmiane asercji w raporcie. **Czwarta, najwazniejsza: konsumpcja w realnym renderze PPTX NIE JEST zmierzona.** Jedyny realny caller `buildTemplateRuntimeFromRow` (poza testami) to `presentationApprovedTemplateService.ts:58`, dzialajacy WYLACZNIE dla szablonow w stanie `approved`. Czy stamtad `runtime.customTemplate.theme.*` faktycznie dociera do bajtow pliku PPTX — to jest Twoj pierwszy krok pomiarowy w R2 (K8/T7 w instrukcji), nie zalozenie. Jesli obalisz zywa konsumpcje — napisz to wprost w raporcie jako trzeci martwy kanal, poza licencja tego dyzuru (naprawa renderera to 227), i ogniwo 3 bramki R3 NIE MOZE przejsc falszywie zielono. **Piata: dwie martwe luki (zakladki, kontrast) sa realne, ale swiadomie odlozone (K9)** — nie buduj ich, wpisz do raportu jako kandydat na osobny dyzur.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day226-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day226-gamma-edytor-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (zapis customTemplate) i R2 (odczyt colorTemplateId w buildTemplateRuntimeFromRow) — bez nich konsultant nadal traci prace przy kazdym zapisie motywu`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6170` albo `5128 i 5129` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6170` albo `5128 i 5129`** (`Z7`).

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

Właściciel prowadzi swoje doradztwo w Gammie: sześć motywów per linia biznesowa, **367
prezentacji na jednym motywie** (`docs/program/funkcje/GAMMA_G3_OBCHOD_MENU.md`). Jego
marzenie nie jest „ładniejsze slajdy" — jest **koniec rozdwojenia**: dziś treść żyje w
Consultify, a artefakt powstaje w Gammie, bo każdą prezentację trzeba przepisać ręcznie z
tego, co system już wie (`docs/program/funkcje/MARZENIE_GAMMA_DECKI.md`).

Rekonesans G-0 (`docs/program/funkcje/GAMMA_G0_POMIAR.md`) znalazł, że najgroźniejszy problem
nie jest brakiem funkcji — jest **kłamstwem interfejsu**:

> Konsultant ustawia kroje i kolory, zapisuje, dostaje potwierdzenie — i **jego praca znika
> po stronie serwera**.

Ten dyżur naprawia dokładnie to zdanie. Nic więcej — nie przebudowuje edytora, nie dokłada
zakładek, nie zmienia wyglądu. Naprawia **dwa martwe kanały**, żeby to, co konsultant widzi
w edytorze, było tym, co wyleci w pliku.

## ★★ Pomiar wykonany na SHA `9fb7942a0117aaf4001836f00bf8bbdc4e717669` — zweryfikuj sam

Wszystko poniżej to **rozkaz pomiarowy**, nie prawda objawiona. Numery linii są z tego SHA;
jeśli u Ciebie są inne, wiążący jest plik (`Z24`), a rozbieżność wpisujesz do raportu.

**(K1) ★ Metoda HTTP to `PUT`, nie `PATCH`.** Zamówienie tego dyżuru mówiło „backend PATCH
`/templates/:id`". Zmierzone: front woła `Api.put()` (`src/services/api.ts`, realny
`fetch(..., {method:'PUT'})`), serwis `updatePresentationTemplate`
(`src/services/presentationTemplateArchitect.ts:251-256`) robi `Api.put(`/presentations/
templates/${id}`, patch)`, a handler w `server/src/routes/presentations.routes.ts:1542` to
`router.put('/templates/:id', ...)`. Pełny, realny endpoint: **`PUT
/api/presentations/templates/:id`**. Używaj tej nazwy w raporcie i w testach — „PATCH" nigdzie
w kodzie nie występuje dla tej trasy.

**(K2) ★★ `handleSave()` naprawdę wysyła `customTemplate` — linia zgadza się z zamówieniem.**
`src/components/Presentations/PresentationTemplateArchitectView.tsx:501-528`:

```ts
501:  const handleSave = async (): Promise<void> => {
502:    if (!selectedTemplate) return;
...
506:      await updatePresentationTemplate(selectedTemplate.id, {
507:        name: editName.trim() || undefined,
...
511:        theme: editTheme.trim() || undefined,
512:        outlineJson: editOutline,
513:        // '' means "no color pattern chosen" — send null so the server can
514:        // tell "leave unchanged" (undefined, never sent) apart from
515:        // "explicitly cleared" (null) once a value existed.
516:        colorTemplateId: editColorTemplateId || null,
517:        customTemplate: editCustomTemplate,
518:      });
```

Kształt `customTemplate` (`UpdatePresentationTemplateInput`,
`src/services/presentationTemplateArchitect.ts:186-198`, typ
`PresentationCustomTemplateDefinition` linie 93-114): `version`, `variables[]`,
`theme{titleFont,bodyFont,primaryColor,backgroundColor,surfaceColor,textColor,accentColor,
logoDataUri?}`, `layouts`, `layoutMapping`. **Front nie jest winowajcą — nie zmieniasz tam
nic w ramach naprawy zapisu.**

**(K3) ★★ Backend gubi pole DOKŁADNIE tam, gdzie wskazało zamówienie.**
`server/src/routes/presentations.routes.ts:1566-1567`:

```ts
1566:    const { name, description, audience, goal, theme, outlineJson, maxSlides, colorTemplateId } =
1567:      req.body;
```

`customTemplate` **nie jest w tej liście**. Nie ma walidacji, nie ma `undefined` w logu —
pole po prostu nigdy nie jest czytane z `req.body`. `colorTemplateId` natomiast JEST
obsłużony (linie 1569-1589): scalany do wolnej kolumny `layout_policy_json` (typ `text`,
domyślnie `'{}'`, migracja `server/migrations/20260719_baseline_gap.sql:7788,7794`):

```ts
1575:    let layoutPolicyJson: string | null = null;
1576:    if (colorTemplateId !== undefined) {
1577:      let currentLayoutPolicy: Record<string, unknown> = {};
1578:      if (existing?.layout_policy_json) {
1579:        try { currentLayoutPolicy = JSON.parse(existing.layout_policy_json) || {}; }
1580:        catch { currentLayoutPolicy = {}; }
1582:      }
1585:      layoutPolicyJson = JSON.stringify({
1586:        ...currentLayoutPolicy,
1587:        colorTemplateId: colorTemplateId || null,
1588:      });
1589:    }
```

Zapis SQL (linie 1591-1606) zapisuje `layoutPolicyJson` do kolumny — a `customTemplate`,
którego backend nigdy nie odczytał z `req.body`, **nie ma jak tam trafić.**

**(K4) ★★ Strona odczytu JUŻ oczekuje `customTemplate` w `layout_policy_json` — to jest
połowa wdrożenia, nie projekt od zera.** `presentationTemplateCompatibilityService.ts:32-33`
(funkcja `normalizeTemplatePayload`):

```ts
32:  template.color_template_id = template.layout_policy_json?.colorTemplateId ?? null;
33:  template.custom_template = template.layout_policy_json?.customTemplate ?? null;
```

Ta funkcja **zakłada**, że `customTemplate` leży pod `layout_policy_json.customTemplate` —
dokładnie tak, jak w R1 masz go tam włożyć. To jest **nietykalny wzorzec do skopiowania**,
nie kod do zmiany.

**(K5) ★★ 13 zestawów kolorystycznych — liczba się zgadza, `colorTemplateId` zapisuje się
poprawnie, ale `buildTemplateRuntimeFromRow` o nim nie wie.** `curatedColorSets.ts:37-234` ma
dokładnie **13** wpisów `id:` (`harvard, ocean, slate, forest, ember, midnight, arctic, sand,
indigo, graphite, olive, burgundy, teal`). `editColorTemplateId` zapisuje się poprawnie
(K3). Ale `server/src/services/presentationTemplateRuntimeService.ts:372-452`
(`buildTemplateRuntimeFromRow`) — **0 odwołań do `colorTemplateId`** w całej funkcji
(`grep -n "colorTemplateId\|color_template_id"` → zero), a interfejs zwracany
`PresentationTemplateRuntime` (linie 174-195) **nie ma tego pola w ogóle**. `customTemplate`
funkcja czyta poprawnie (linie 442-448, z `layoutPolicy.customTemplate`) — ale wejście jest
dziś zawsze puste, bo K3 je gubi po drodze. **Dwa martwe kanały, dwie różne przyczyny:**
`customTemplate` ginie przy ZAPISIE, `colorTemplateId` ginie przy ODCZYCIE runtime.

**(K6) `grep -rn "curatedColorSets" server/src` → 0 trafień, potwierdzone.** Backend nie ma
żadnej wiedzy o 13 zestawach — jedyny łącznik to string `colorTemplateId`.

**(K7) ★★ ZNALEZISKO — czerwony test kontraktowy JUŻ istnieje w repo, nie trzeba go pisać od
zera.** `server/src/routes/__tests__/presentationCustomTemplateContract.test.ts` (55 linii),
test `'merges custom contract updates without dropping color-template metadata'`
(linie 37-42) oczekuje fragmentów kodu w handlerze, których dziś tam nie ma
(`colorTemplateId !== undefined || customTemplate !== undefined`,
`{ customTemplate: customTemplate || null }`, `validatePresentationCustomTemplate
(customTemplate)`). Uruchomiony samodzielnie: **4 failed (4)**, cały plik czerwony.
**Przeczytaj go PRZED pisaniem kodu** — jego asercje to gotowa specyfikacja naprawy R1, ale
mogą nie pasować 1:1 do kształtu, który wybierzesz; dopasuj je pomiarem, nie zgadywaniem.

**(K8) ★ Konsumpcja `customTemplate`/`colorTemplateId` w REALNYM RENDERZE PPTX nie jest
zmierzona i NIE WOLNO Ci jej zakładać.** Jedyny realny caller `buildTemplateRuntimeFromRow`
(poza testami) to `presentationApprovedTemplateService.ts:58`
(`resolveApprovedPresentationTemplate`, działa WYŁĄCZNIE dla szablonów w stanie `approved`),
wołany z `presentationGeneratorService.ts:1526` i `:1715`. Czy `runtime.customTemplate.
theme.*` faktycznie dociera do miejsca, które pisze kolory/kroje do pliku PPTX — **to jest
Twój pierwszy krok pomiarowy w R2, nie założenie z tej instrukcji.**

**(K9) Poza zakresem — zmierzone, ale ŚWIADOMIE ODŁOŻONE.** Wzorzec z obchodu Gammy
(`GAMMA_G3_OBCHOD_MENU.md`) mówi o edytorze z sześcioma zakładkami (`Colors · Fonts · Logo ·
Design · Images · Charts`) i wbudowanym sprawdzaniem kontrastu przy każdym polu koloru.
Zmierzone: `PresentationTemplateArchitectView.tsx` ma dziś **0 zakładek** (`grep -ni "tab"` —
same fałszywe trafienia na `table`) — jest jednym płaskim formularzem — i **0 trafień na
„contrast"**. To są realne luki względem wzorca, ale **NIE są zakresem tego dyżuru** — ten
dyżur naprawia dwa martwe kanały zapisu/odczytu, nie przebudowuje UI edytora. Wpisz obie luki
do raportu jako „zmierzone, poza zakresem, kandydat na osobny dyżur" — nie buduj zakładek i
nie dokładaj sprawdzania kontrastu.

# 2. TEZY ZLECENIA

Każda to rozkaz pomiarowy. Numery linii z SHA `9fb7942a0117aaf4001836f00bf8bbdc4e717669`.

- **T1.** Realny endpoint to `PUT /api/presentations/templates/:id`
  (`presentations.routes.ts:1542-1543`), nie `PATCH`. Używaj tej nazwy wszędzie.
- **T2.** `req.body` w handlerze (`:1566-1567`) nie zawiera `customTemplate` — sprawdź sam,
  że to jest wciąż prawda na Twojej bazie.
- **T3.** `colorTemplateId` zapisuje się poprawnie do `layout_policy_json.colorTemplateId`
  (`:1576-1588`); to jest WZORZEC, po którym masz dopisać analogiczną gałąź dla
  `customTemplate`.
- **T4.** `normalizeTemplatePayload` (`presentationTemplateCompatibilityService.ts:32-33`)
  już czyta `layout_policy_json.customTemplate` — nie zmieniasz tego pliku, kopiujesz jego
  założenie.
- **T5.** `buildTemplateRuntimeFromRow` (`presentationTemplateRuntimeService.ts:372-452`) nie
  zna `colorTemplateId` — ani w ciele funkcji, ani w zwracanym typie
  `PresentationTemplateRuntime` (`:174-195`).
- **T6.** Test `presentationCustomTemplateContract.test.ts` istnieje i jest czerwony
  (4/4 fail) — przeczytaj go, zanim napiszesz linijkę kodu.
- **T7.** Ścieżka konsumpcji runtime → realny plik PPTX przechodzi przez
  `resolveApprovedPresentationTemplate` (`presentationApprovedTemplateService.ts:52-61`,
  tylko dla `state === 'approved'`) → `presentationGeneratorService.ts:1526,1715`. Czy stamtąd
  `runtime.customTemplate.theme.*` faktycznie trafia do bajtów pliku — **zmierz, nie zakładaj**.
- **T8.** Front (`PresentationTemplateArchitectView.tsx`, `presentationTemplateArchitect.ts`,
  `curatedColorSets.ts`, `ColorPatternPicker.tsx`) jest dziś **poprawny** — problem jest
  wyłącznie po stronie backendu. Nie zmieniasz frontu poza tym, czego zażąda flaga (§3 R3).

# 3. POZYCJE DYŻURU

## R1 — SAVE: `customTemplate` przestaje ginąć w `PUT /templates/:id`

**Cel:** handler (`presentations.routes.ts:1542`) dopisuje `customTemplate` do
destrukturyzacji `req.body` (`:1566-1567`) i scala go do `layoutPolicyJson` dokładnie tym
samym wzorcem, którym dziś scala `colorTemplateId` (`:1576-1589`) — warunek rozszerzony na
`colorTemplateId !== undefined || customTemplate !== undefined`, walidacja przez
`validatePresentationCustomTemplate` (ten sam walidator, którego dziś używa
`buildTemplateRuntimeFromRow:444-447` po stronie odczytu — TA SAMA funkcja, żeby zapis i
odczyt zgadzały się co do kształtu) **przed** zapisem do bazy, nie po.

Wymogi:
- gałąź scalania `customTemplate` idzie za flagą `ENABLE_PRESENTATION_TEMPLATE_CUSTOM_SAVE`
  (nowa, `default false` — dodajesz w `server/src/config/FeatureFlags.ts` wzorem
  `ENABLE_DECK_CONCLUSION_SLIDE` — schemat `:50`, blok ładujący `:205`);
- **przy fladze OFF: zachowanie bajt w bajt dzisiejsze**, czyli `customTemplate` NADAL ginie
  — to jest zakaz zmiany zachowania bez akceptu właściciela, nie przeoczenie. Zasercjonuj to
  wprost osobnym testem (przy OFF: PUT z `customTemplate` w body → odczyt `layout_policy_json`
  → pole nieobecne, identycznie jak dziś);
- przy fladze ON: PUT z `customTemplate` → `layout_policy_json.customTemplate` w bazie ma tę
  samą wartość (po walidacji/normalizacji), a błąd walidacji zwraca kod błędu, nie ciche
  odrzucenie;
- dopasuj `presentationCustomTemplateContract.test.ts` (T6) do wybranego kształtu i **zazielen
  go** — jeśli zmienisz którąkolwiek asercję, uzasadnij to w raporcie jednym zdaniem.

**Ukończone, gdy:** test kontraktowy zielony za ON, dowód mutacyjny w obie strony (ON: pole
persystuje; OFF: pole nadal ginie, zasercjonowane), walidator ten sam co po stronie odczytu.

## R2 — READ: `colorTemplateId` przestaje być niewidzialny dla runtime

**Cel:** `PresentationTemplateRuntime` (`presentationTemplateRuntimeService.ts:174-195`)
dostaje pole `colorTemplateId: string | null`, a `buildTemplateRuntimeFromRow` (`:372-452`)
je wypełnia z `layoutPolicy?.colorTemplateId ?? null` (ten sam `layoutPolicy` już
sparsowany na linii 404 — **nie parsujesz JSON drugi raz**).

★ **Krok pomiarowy PRZED kodem (K8/T7), obowiązkowy:** prześledź, dokąd faktycznie idzie
`runtime.customTemplate.theme.*` i (po tej pozycji) `runtime.colorTemplateId` — od
`resolveApprovedPresentationTemplate` (`presentationApprovedTemplateService.ts:52-61`) przez
`presentationGeneratorService.ts:1526` i `:1715`, aż do miejsca, które pisze kolor/krój do
`pptxgenjs`. Jeżeli po drodze nie ma miejsca, które CZYTA te pola z `runtime` — to jest TRZECI
martwy kanał, którego zamówienie nie nazwało, i masz go **zmierzyć i nazwać w raporcie**, nie
naprawiać po cichu poza licencją (patrz §4, zakaz zmian w rendererze PPTX — to zakres dyżuru
227). Jeśli konsumpcja istnieje — podaj plik:linia i zacytuj.

Wymogi:
- gałąź czytania `colorTemplateId` w `buildTemplateRuntimeFromRow` idzie za TĄ SAMĄ flagą co
  R1 (`ENABLE_PRESENTATION_TEMPLATE_CUSTOM_SAVE`) — jedna flaga na cały łańcuch zapis→odczyt,
  zakaz budowy drugiej;
- przy OFF: `PresentationTemplateRuntime.colorTemplateId` zawsze `undefined`/nieobecne —
  bajt w bajt dzisiejsze zachowanie (pole dziś nie istnieje w typie);
- przy ON: dla szablonu z zapisanym `colorTemplateId` runtime niesie tę samą wartość.

**Ukończone, gdy:** dowód mutacyjny w obie strony na poziomie runtime (nie tylko bazy); łańcuch
konsumpcji z T7 zmierzony i opisany w raporcie — ZMIERZONY, nie założony — z jawnym zdaniem
„dociera do pliku" albo „nie dociera, trzeci martwy kanał, poza licencją tego dyżuru".

## R3 — BRAMKA: dowód przez realną trasę HTTP, zapis → odczyt → plik

To jest bramka z zamówienia, dosłownie: **zapis motywu z niestandardowymi krojami i kolorami
⇒ odczyt zwraca te same wartości ⇒ wyeksportowany plik ich używa.** Trzy ogniwa, każde z
osobnym dowodem mutacyjnym, przy fladze ON:

1. **Zapis.** Realny `PUT /api/presentations/templates/:id` przez `ApiGateway` (nie router
   wstrzyknięty gołym `express()` — `Z22`), z `customTemplate.theme.titleFont` i
   `colorTemplateId` różnymi od wartości domyślnej. Asercja: wiersz w `presentation_templates`
   ma `layout_policy_json` zawierający OBA pola z podanymi wartościami.
2. **Odczyt.** `GET` szablonu (albo bezpośrednie wywołanie `buildTemplateRuntimeFromRow` na
   świeżo pobranym wierszu — wybierz i uzasadnij) zwraca `customTemplate.theme.titleFont` i
   `colorTemplateId` **identyczne** z tym, co zapisano w kroku 1.
3. **Plik.** Jeżeli T7/R2 potwierdziło żywą konsumpcję: wygeneruj (albo zasymuluj najniższym
   punktem wejścia, który realnie biegnie bez modelu — `Z15` obowiązuje, zero wołania
   `llmService`/`/api/ai/**`) eksport PPTX dla szablonu `approved` i **wykaż w pliku
   wynikowym** (parsowanie XML z archiwum `.pptx`, nie „powinno działać") ślad ustawionego
   koloru/kroju. Jeżeli T7/R2 obaliło żywą konsumpcję — ogniwo 3 bramki **nie może przejść
   fałszywie zielono**: napisz w raporcie wprost „ogniwo 3 nie przechodzi, bo konsumpcji nie
   ma — to jest trzeci martwy kanał, zgłoszony do osobnej decyzji", i to jest uczciwy,
   akceptowalny wynik tej pozycji.

Przy fladze OFF: powtórz kroki 1-2 i wykaż, że wynik jest **dokładnie dzisiejszy** —
`customTemplate` ginie w kroku 1, `colorTemplateId` jest niewidzialne w kroku 2.

**Ukończone, gdy:** trzy ogniwa (albo jawnie odnotowane niepowodzenie ogniwa 3) z dowodem
mutacyjnym ON/OFF; zero atrap (`Z23`) — żadne z ogniw nie jest „struktura istnieje", tylko
realna wartość przeczytana z realnego miejsca.

# 4. TABELA LICENCJI PLIKOWEJ

Licencja obejmuje CAŁĄ ścieżkę: flaga → zapis → odczyt runtime → (jeśli żywe) konsumpcja w
eksporcie → test kontraktowy → nowe testy. Pominięcie ogniwa zmusiłoby Cię do złamania
licencji albo do połowy roboty.

| Zakres | Ścieżki |
|---|---|
| Zapis | `server/src/config/FeatureFlags.ts` — WYŁĄCZNIE dodanie `ENABLE_PRESENTATION_TEMPLATE_CUSTOM_SAVE` (schemat wzorem `:50`, blok ładujący wzorem `:205`). Zakaz zmiany wartości domyślnej jakiejkolwiek istniejącej flagi |
| Zapis | `server/src/routes/presentations.routes.ts` — WYŁĄCZNIE handler `router.put('/templates/:id', ...)` (`:1542-1606`): destrukturyzacja `req.body`, rozszerzenie warunku scalania `layoutPolicyJson`, wywołanie `validatePresentationCustomTemplate`. Zakaz zmian w handlerze `router.get('/templates/:id', ...)` (`:1451`) i w innych trasach tego pliku |
| Zapis | `server/src/services/presentationTemplateRuntimeService.ts` — WYŁĄCZNIE `buildTemplateRuntimeFromRow` (`:372-452`) i interfejs `PresentationTemplateRuntime` (`:174-195`): dodanie pola `colorTemplateId` i jego wypełnienia. Zakaz zmian w `familyForTemplate` i innych eksportach pliku |
| Zapis (warunkowy, WYŁĄCZNIE jeśli T7 potwierdzi żywą konsumpcję) | Plik(i) w łańcuchu `presentationGeneratorService.ts` (`:1526`, `:1715`) do miejsca, gdzie runtime pisze kolor/krój do `pptxgenjs` — WYŁĄCZNIE odczyt nowego pola `colorTemplateId`/naprawionego `customTemplate`, za tą samą flagą. **Zakaz zmiany geometrii, marginesów i jakiejkolwiek stałej stylu poza kolorem/krojem z motywu** — to jest zakres dyżuru 227, nie 226 |
| Zapis | `server/src/routes/__tests__/presentationCustomTemplateContract.test.ts` — dopasowanie asercji do wybranego kształtu implementacji, z uzasadnieniem zmiany w raporcie |
| Zapis | NOWE pliki testowe `day226.*` w `server/src/routes/__tests__/`, `server/src/services/__tests__/`, `tests/integration/` — pełna licencja, z zastrzeżeniem `Z18`/`Z31`. Nowe pliki w `tests/` wymagają `git add -f` |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY226_GAMMA_EDYTOR_REPORT.md` |
| Odczyt (ZAKAZ ZAPISU) | `src/components/Presentations/PresentationTemplateArchitectView.tsx` · `src/services/presentationTemplateArchitect.ts` · `src/components/shared/colorPatterns/curatedColorSets.ts` · `src/components/shared/colorPatterns/ColorPatternPicker.tsx` — front jest dziś poprawny (T8); nie dodajesz zakładek, nie dodajesz kontrastu (K9) |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/presentationTemplateCompatibilityService.ts` (`:32-33`) — wzorzec do skopiowania, nie kod do zmiany |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/presentationApprovedTemplateService.ts` — czytasz jako ogniwo łańcucha T7, nie zmieniasz semantyki `approved`-gate |
| Odczyt (ZAKAZ ZAPISU) | `server/migrations/20260719_baseline_gap.sql` (`:7788,:7794`) — schemat `layout_policy_json` jest ustalony (`text`, `default '{}'`); żadnej nowej migracji nie potrzebujesz i żadnej nie tworzysz |
| Odczyt | `docs/program/funkcje/GAMMA_G0_POMIAR.md` · `GAMMA_G3_OBCHOD_MENU.md` · `MARZENIE_GAMMA_DECKI.md` — kontekst „po co"; nie edytujesz |

**Nietykalne imiennie:** `presentationTemplateCompatibilityService.ts` ·
`presentationApprovedTemplateService.ts` (semantyka `approved`) ·
`PresentationTemplateArchitectView.tsx` (front) · `curatedColorSets.ts` ·
`server/migrations/**` (zero nowych migracji) · geometria/marginesy PPTX (dyżur 227) ·
każdy `MODULE_ACCEPTANCE.md`.

**Rozłączność z partią równoległą:** dyżur 227 wchodzi w renderer PPTX
(`report/pptx/PptxPipelineService`, `deliverables/DeckStyler.ts`) i w `initiativeMaterializeService.ts`
— **nie te same pliki co 226**, ale oba mogą dotknąć `presentationGeneratorService.ts`, jeśli
T7 tego dyżuru wymaga zmiany w konsumpcji. **Przed pierwszym commitem w tym pliku** sprawdź
`git log` gałęzi bazowej pod kątem równoległego dyżuru 227 i zgłoś kolizję zasobową ZANIM
zaczniesz pisać, nie po.

# 5. TWARDE ZASADY

- ★★ **JEDNA FLAGA NA CAŁY ŁAŃCUCH.** `ENABLE_PRESENTATION_TEMPLATE_CUSTOM_SAVE` gasi/włącza
  R1+R2+R3 razem. Zakaz budowy osobnej flagi na zapis i osobnej na odczyt — rozjechałyby się,
  jak dziś rozjechały się `customTemplate` i `colorTemplateId`.
- ★★ **PRZY OFF — BAJT W BAJT DZISIEJSZE ZACHOWANIE, WŁĄCZNIE Z BŁĘDEM.** `customTemplate` ma
  dalej ginąć, `colorTemplateId` ma dalej być niewidzialne dla runtime, dopóki właściciel nie
  zaakceptuje na zrzutach (`CLAUDE.md` §7, §9). Pokusa „skoro naprawiam, to od razu włączmy" jest
  tu najgroźniejsza — to jest DOKŁADNIE ten sam błąd, który skasował godziny pracy 07-11/07-12.
- ★★ **NIE ZAKŁADASZ KONSUMPCJI W RENDERZE — MIERZYSZ JĄ (T7/K8).** Zdanie „plik używa
  koloru" wolno napisać wyłącznie po zmierzeniu XML wynikowego pliku, nie po przeczytaniu, że
  `runtime.customTemplate` istnieje jako pole.
- ★★ **DOWODEM JEST STAN BAZY I STAN PLIKU, NIE BRAK BŁĘDU.** Asercja porównuje wartość przed
  i po, nie „nie było wyjątku".
- ★ **ZAKAZ PRZEBUDOWY EDYTORA.** Sześć zakładek i sprawdzanie kontrastu z wzorca Gammy (K9)
  są zmierzone i **poza zakresem**. Zbudowanie ich tutaj jest naruszeniem licencji, nie
  bonusem.
- ★ **WALIDATOR JEST WSPÓLNY.** `validatePresentationCustomTemplate` musi być tym samym
  wywołaniem po stronie zapisu (R1) i odczytu (już istnieje w `buildTemplateRuntimeFromRow:
  444-447`) — zakaz pisania drugiego walidatora o innych regułach.
- ★★ **`Z15` OBOWIĄZUJE BEZ WYJĄTKU** w tym dyżurze — zero wołania modelu. Dowód eksportu
  pliku (R3, ogniwo 3) budujesz na szablonie `approved` z ustawionymi wartościami wprost w
  bazie testowej, nie przez generowanie treści przez AI.
- ★ **`Z31` — zakaz przypinania strażnika RealDB do hosta/portu/nazwy bazy.** Wołasz
  `await assertRealPostgresTestEnvironment()` bez argumentów.
- ★ **Sprzątanie kontenera: `docker rm -f -v`.**
- ★ **`Z27` — zakaz `git stash`.** Dowody mutacyjne przez `cp` do `/private/tmp/cx-day226-gamma-edytor-scratch`.
- **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji** (`Z28`).
- **Zakaz naprawiania przez wyciszanie** i zakaz usuwania zastanych testów — asercje testu
  kontraktowego (K7/T6) wolno **zmienić** z uzasadnieniem, nie skasować.
- ★ **`§0.4a` — pomiar zasięgu testów jest warunkiem oddania raportu** (`Z24`).
- ★ **Zrzuty: `mean_luma` jasny/ciemny >150 różnicy, bez wyjątku.** Wymagane zrzuty: edytor
  motywu z niestandardowym kolorem/krojem ustawionym i zapisanym (ON), ×2 motywy — dowód, że
  po odświeżeniu strony wartości nie zniknęły. W raporcie napisz wprost, czy zrzut pochodzi z
  realnego przebiegu przez `ApiGateway`, czy z propsów w harnessie.
- ★ **`Z13`:** logi, zrzuty i wyjścia bramek nie wchodzą do repo — leżą w
  `/private/tmp/cx-day226-gamma-edytor-artefakty`, raport podaje ścieżki i `shasum -a 256`.
- Pułapka: bez `RUN_DB_TESTS=1` testy backendowe idą na MOCK DB. Pułapka: `No test files
  found` nie jest `PASS`. Pułapka: liczby i NAZWY testów czytasz z JSON-a (`Z37`).
- ★ Porty **6170/5128-5129 wyłącznie Twoje**. Porty **6171/5130-5131** (227) i
  **6172/5132-5133** (228) zarezerwowane dla dyżurów równoległych — nie bierz ich. Porty
  **5000, 5037, 5060-5061** zajęte na stałe. Porty **6173-6175, 5134-5139** zabronione
  (dyżury 229-232).
- ★★ **Sekcja „TWIERDZENIA NIEZWERYFIKOWANE" w raporcie jest OBOWIĄZKOWA.** Wypisz co
  najmniej: czy `customTemplate` NADAL ginie na Twojej bazie przed naprawą (potwierdź
  pomiarem, nie przepisz z tej instrukcji); czy test kontraktowy był czerwony przed Twoją
  zmianą i jest zielony po; czy zmierzyłeś łańcuch konsumpcji T7/K8 i jaki jest wynik (dociera
  do pliku / trzeci martwy kanał); czy przy OFF zachowanie jest bajt w bajt dzisiejsze
  (zasercjonowane, nie założone); czy walidator zapisu i odczytu to naprawdę ta sama funkcja;
  czy zrzuty pochodzą z realnego przebiegu. **Brak tej sekcji jest podstawą odrzucenia
  dyżuru.**
