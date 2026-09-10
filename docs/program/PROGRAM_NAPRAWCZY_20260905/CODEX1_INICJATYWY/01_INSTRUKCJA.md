# INSTRUKCJA — Codex — „INICJATYWY: JEDEN MAGAZYN DANYCH"

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
> **wyłącznie** `/Users/piotrwisniewski/Developer/codex-wt/codex1-inicjatywy`.
>
> **★★ DRUGI ZAKAZ MIEJSCA (08.09, incydent realny): NIE PRACUJESZ W `/private/tmp`.**
> Restart maszyny 08.09 wyczyścił `/private/tmp` i skasował worktree, sekrety
> i zrzuty sześciu wykonawców naraz. Twój worktree i wszystkie katalogi
> pomocnicze mają leżeć pod `/Users/piotrwisniewski/Developer/`, nie w `/private/tmp`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `4630b1ee4c`**
> **Gałąź bazowa: `origin/staging`** (w vaulcie; to jest linia integracyjna
> na dzień 2026-09-10, tip `4630b1ee4c` = „docs(plan): PLAN_CTO_20260910")
> **Stan dokumentu: WYDANY — 2026-09-10 14:30, CTO (Fable), marker `4630b1ee4c` = tip `origin/staging` po wdrożeniu run 34470281144**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo napis `MARKER_SHA` w nawiasach kątowych —
> **dokument nie jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.
> Ta ramka jest **jedynym** miejscem, w którym rozstrzyga się stan wydania.
> Objaśnienia w innych blokach cytowanych **nie** są powodem do STOP-u.

Data wystawienia: 2026-09-10.
Autor zlecenia: nadzorca sesji głównej (CTO), w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.
Zakres: **`05_INITIATIVES` + `06_EXECUTION` — warstwa DANYCH, zero zmian wyglądu.**
Pozycja programu: pojemnik 2, pozycja **2.3 „dwa magazyny → jedna projekcja"**
(`docs/program/TRZY_POJEMNIKI_PRACY_20260906.md:96`), wyciągnięta do przodu,
bo blokuje domknięcie pojemnika 1.
Trasy front: `/inicjatywy` (`InitiativesHub`), karta inicjatywy
(`InitiativeDocumentView`), `/realizacja` (`ExecutionHub`), `/moja-praca`,
`/wyniki`. **Front dotykasz WYŁĄCZNIE tam, gdzie przepinasz wołacza — żadnej
zmiany układu, kolorów, komponentów ani tekstów widocznych na ekranie.**
Trasy tył: `GET/POST /api/initiatives**` (zastane) oraz
`/api/initiatives/runtime-v1/**` (kanoniczne).

---

### 0.1. ★★ BAZA PRACY, MARKER I GAŁĄŹ — PROCEDURA DOSŁOWNA, Z VAULTA

**Repozytorium, z którego pracujesz, to BARE-vault, a nie checkout właściciela:**

```
/Users/piotrwisniewski/Developer/consultify-recovery-vault-20260820.git
```

Vault ma `extensions.worktreeConfig=true`. **To ma konsekwencję operacyjną,
którą MUSISZ obsłużyć — krok (4).**

**PIERWSZE KOMENDY — wklej dokładnie tak, po kolei:**

```bash
VAULT=/Users/piotrwisniewski/Developer/consultify-recovery-vault-20260820.git
WT=/Users/piotrwisniewski/Developer/codex-wt/codex1-inicjatywy
MARKER=4630b1ee4c

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego bloku
df -h /

# (1) fetch WYLACZNIE z `origin` (ODCZYT). NIGDY `--all` (remote `icloud-source`
#     jest martwy), NIGDY `git push origin` (Z1). Baza tego bloku zyje na
#     `origin/staging`, nie na `github-backup`.
git -C "$VAULT" fetch origin --prune

# (2) marker — warunek rodowodu
git -C "$VAULT" log --oneline -25 origin/staging
git -C "$VAULT" merge-base --is-ancestor "$MARKER" origin/staging \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZYSZ GO SAM, Z VAULTA, w ~/Developer/codex-wt
mkdir -p /Users/piotrwisniewski/Developer/codex-wt
git -C "$VAULT" worktree add "$WT" -b codex/inicjatywy-jeden-magazyn-20260910 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/codex1-inicjatywy/config.worktree"
cat "$VAULT/worktrees/codex1-inicjatywy/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13) — i POZA /private/tmp
mkdir -p /Users/piotrwisniewski/Developer/codex-wt/codex1-scratch
mkdir -p /Users/piotrwisniewski/Developer/codex-wt/codex1-artefakty

# (7) sanity
git -C "$WT" rev-parse HEAD
git -C "$WT" status --short | head -3
```

**Wynik komend (2) i (7) wklejasz do raportu dosłownie.**

> **★★ PUŁAPKA — REMOTE `icloud-source` JEST MARTWY.**
> Vault ma trzy remote'y: `origin` (żywy — **stąd fetch, ale NIGDY push**),
> `github-backup` (żywy, kopia zapasowa) i `icloud-source`, wskazujący na
> nieistniejący katalog `/private/tmp/consultify-staging-deploy-e6ca`.
> **Dlatego NIE WOLNO Ci wołać `git fetch --all`.**
> **Błąd `icloud-source` przy jakimkolwiek fetchu NIE JEST negatywnym wynikiem
> markera i NIE JEST powodem do STOP-u.** Jedynym negatywnym wynikiem markera
> jest napis `MARKER BRAK` z komendy `merge-base` powyżej.

**★★ KONTROLA BAZY PO WŁASNYCH COMMITACH (poprawka z dyżuru 133).**
„`git log -1` ma pokazać marker" jest prawdziwe **tylko przy pierwszym
uruchomieniu**. Po Twoim pierwszym commicie poprawna kontrola brzmi:

```bash
git -C "$WT" merge-base --is-ancestor "$MARKER" HEAD \
  && echo "BAZA OK — marker jest przodkiem HEAD" \
  || echo "MARKER BRAK — STOP"
```

**★★ REGUŁA ROZEJŚCIA (`DEC-2026-08-26-95`).**
Jeżeli marker **nie jest** przodkiem tipa albo gałąź nie istnieje — **STOP
całości**. Nie improwizujesz bazy: nie startujesz z `origin/demo`, `Londyn`,
`main` ani z gałęzi cudzych dyżurów.

Jeżeli marker **JEST** przodkiem, ale **tip uciekł do przodu — to NIE jest
STOP**. Startujesz **dokładnie z markera**, a do raportu wpisujesz:

```bash
git -C "$VAULT" log --oneline 4630b1ee4c..origin/staging
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie pracy: ZAKAZANY** (`Z3`).

**★★ ROZSTRZYGNIĘCIE `Z34a` KONTRA „NIE PUSHUJESZ" (wymagane przez szkielet
`docs/program/system-pracy/02_SZKIELET_INSTRUKCJI.md`, blok A.1-BIS punkt 2):**
**w TYM bloku NIE PUSHUJESZ NIC I NIGDZIE.** Twoja gałąź żyje we wspólnym
vaulcie, więc nadzorca ma do niej dostęp bez pushu. Commitujesz po każdym
etapie (E1…E6), a push i scalenie wykonuje wyłącznie nadzorca po odbiorze.
Wiersz `Z34a` w tabeli zakazów zostaje w dokumencie dla ciągłości numeracji,
ale **w tym bloku jest wyłączony tym akapitem**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 4630b1ee4c..HEAD
```

---

### 0.1a. ★★ WERYFIKACJA STANU WEJŚCIOWEGO — DZIEWIĘĆ KOMEND, WSZYSTKIE OBOWIĄZKOWE

Każda ma podany **wynik autora instrukcji**; rozbieżność idzie do „Korekt wobec
instrukcji", **nie do improwizacji**. **Twój pomiar jest wiążący, nie mój.**

```bash
cd "$WT"

# (1) ★★★ RDZEN: ile jest bramek istnienia inicjatywy pytajacych WYLACZNIE
#     tabele zastana. To jest miara calego bloku.
grep -rn "SELECT id FROM initiatives WHERE id" server/src | grep -v __tests__ | wc -l
#   moj wynik na markerze: 50 trafien w 19 plikach.
#   DOKLADNIE JEDNA z nich ma dzis fallback do rejestru kanonicznego
#   (InitiativeController.ts:3380 + 3387, commit 3ab51dfb3e z 10.09).

# (2) rozklad tych bramek po plikach — do tabeli w raporcie
grep -rn "SELECT id FROM initiatives WHERE id" server/src | grep -v __tests__ \
  | cut -d: -f1 | sort | uniq -c | sort -rn
#   moj wynik: results.routes.ts 11, InitiativeController.ts 10,
#   v8/execution-control.routes.ts 5, initiativeGovernanceService.ts 4,
#   pmo/initiatives.routes.ts 3, benefits.routes.ts 3, reszta po 1-2.

# (3) tworzenie inicjatywy z UI — czy naprawde pisze TYLKO do kanonu
grep -n "registerSourceProposal\|submitSourceProposal\|INSERT INTO initiatives" \
  src/services/initiativeWriteTruth.ts
#   moj wynik: submitSourceProposal ok. l.218, registerSourceProposal ok. l.246,
#   ZERO `INSERT INTO initiatives`. Kreator NIE dotyka tabeli zastanej.

# (4) most legacy->kanon zyje DZIS W PRZEGLADARCE, nie na serwerze
grep -rn "mergeLegacyInitiativesIntoRegister\|listLegacyInitiatives" src/ \
  | grep -v __tests__
#   moj wynik: definicja initiativeRegisterProjection.ts:482,
#   wolanie InitiativesHub.tsx:605, odczyt runtimeApi.ts:1274.
#   To jest adapter w ZLEJ WARSTWIE — patrz E2.

# (5) ile plikow serwera w ogole dotyka tabeli zastanej
grep -rln "FROM initiatives\|INSERT INTO initiatives\|UPDATE initiatives\|DELETE FROM initiatives" \
  server/src | grep -v __tests__ | wc -l
#   moj wynik: 161 plikow. To NIE jest lista do przepisania — to skala
#   powierzchni, ktora ma zobaczyc projekcje z E2.

# (6) middleware wycofania zapisow zastanych — stan po DEC-453
grep -n "LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS" -A 6 \
  server/src/middleware/executionSpineLegacyReadOnly.middleware.ts
#   moj wynik: 4 wzorce wycofane (start-execution|block|unblock, raid,
#   lifecycle-*, apply-template|apply-blueprint). PRZYWROCONE (czyli DZIALAJA
#   po staremu): milestones, resources, staffing-plans, budget-items,
#   gate-roles, move — bo nastepcy kanonicznego dla nich NIE MA.

# (7) kanoniczna lista inicjatyw — trasa istnieje?
grep -n "router.get(" -A 2 server/src/routes/pmo/initiativesExecutionRuntime.routes.ts \
  | grep -n "'/initiatives'"
#   moj wynik: blok `router.get('/initiatives', ...)` ok. l.2112-2113.

# (8) czy w Inicjatywach/Realizacji zostaly ciche polkniecia bledow
grep -rn "catch(() => {})" src/components/Initiatives src/components/Execution \
  | grep -v __tests__ | grep -v "^\S*: *[*/]"
#   moj wynik: 0 realnych wystapien (zostaly tylko KOMENTARZE o zakazie:
#   RaidSection.tsx:110, useInitiativeLifecycle.ts:83,
#   ExecutionControlSurface.tsx:1648 i :2929). W E4 masz ZAKAZ DODAWANIA
#   nowych, a nie zadanie sprzatania starych.

# (9) zasoby wylaczne: porty, kontener, przedzial migracji
lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | grep -E ":(6451|5591)\b" || echo "PORTY WOLNE"
docker ps -a --format '{{.Names}}' | grep -c "cx-codex1-inicjatywy-pg" || true
ls server/migrations | grep -cE "^2026213[0-9]"
#   moj wynik: PORTY WOLNE; 0 kontenerow; 0 zajetych numerow w 20262130-20262139.
```

---

### §0.4a — pomiar zasięgu testów (warunek oddania raportu, patrz `Z24`)

Zanim ogłosisz jakikolwiek wynik testów, zmierz zasięg PEŁNYMI NAZWAMI, nie liczbami:

1. PRZED zmianami produktu: uruchom pakiet(y) testów wskazane w licencji z
   `--reporter=json` i zapisz do artefaktów plik `przed-nazwy.txt` — po jednej
   PEŁNEJ nazwie testu na wiersz.
2. PO zmianach: to samo do `po-nazwy.txt`.
3. Do raportu wchodzi: `diff przed-nazwy.txt po-nazwy.txt` — nazwy DODANE (Twoje
   nowe testy) i nazwy ZNIKNIĘTE (każda zniknięta = wyjaśnienie albo STOP).
   `N passed` bez nazw NIE jest pomiarem. „Ta sama liczba" przy innym składzie
   nazw to fałszywa zieleń (`Z37`).
4. Przepisanie liczby z tej instrukcji, cudzego raportu albo rejestru =
   zawyżenie i podstawa odrzucenia raportu. Liczysz sam, u siebie, na swojej bazie.

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push`** — na żaden remote, na żadną gałąź. `git fetch origin` (ODCZYT) jest dozwolony i wymagany w `§0.1` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz** `origin/demo`, `Londyn`, `origin/staging` ani żadnej cudzej gałęzi `codex/*`, `mvp/*`, `fix/*`, `chore/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i jawnie zamówiony** | Cudze tory w toku — 10.09 biegło równolegle kilkanaście stanowisk |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie pracy | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS. **W tym bloku ma to konkretny skutek: `server/src/_backup/ts-js-collisions/mcp/mcpServer.js` ma 4 trafienia `FROM initiatives` — NIE liczysz go i NIE ruszasz** |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/Users/piotrwisniewski/Developer/wt/**` ani `/private/tmp/**`. **Wyjątek: katalogi, które SAM zakładasz w `§0.1`, są Twoje** | 10.09 żyło 26 równoległych worktree pod `~/Developer/wt/` |
| `Z7` | **★★ Twój JEDYNY port bazy to `6451`. Twój JEDYNY port harnessu to `5591`.** Nazwa kontenera: **`cx-codex1-inicjatywy-pg`**. **ZAKAZANE porty (zajęte, zmierzone 10.09): `5432`, `5433`, `6012`, `54400`, `54410`, `54418`, `55432`, `55439`, `55441`.** Sprawdzasz sam przed startem (`§0.1a` komenda 9) | Trzy incydenty zapisu do cudzej bazy |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego bloku** — nigdy demo, staging, produkcja ani cudza retained-DB | Demo i staging mają dziś OSOBNE bazy, ale obie są żywe i obie są poza Twoim zasięgiem |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi**, poza JEDNĄ jawnie zamówioną w `E2` (`ENABLE_INITIATIVE_UNIFIED_READ`, **default OFF**) | Krach 07-12: masowe włączenie flag wizualnych na żywo (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Ten blok **nie tworzy żadnego nowego ekranu** — jeżeli w trakcie uznasz, że musisz coś narysować, to jest STOP MERYTORYCZNY, nie zadanie | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: `server/src/middleware/auth.middleware.ts`, `server/src/Gateway.ts`, `server/src/middleware/v8FeatureGate.middleware.ts`, `server/src/middleware/betaGate.middleware.ts`, `server/src/services/effectiveAccessService.ts` | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/PROGRAM_NAPRAWCZY_20260905/CODEX1_INICJATYWY/98_RAPORT.md`. **Zrzuty, logi, manifesty i pliki wynikowe NIE wchodzą do repo** — leżą w `/Users/piotrwisniewski/Developer/codex-wt/codex1-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
| `Z14` | **Nie zmieniasz `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md`** i nie podważasz decyzji w kodzie. Uważasz, że decyzja się myli → **errata w raporcie** | SSOT decyzji właściciela |
| `Z15` | **Zero modelu językowego w tym bloku.** Żaden pomiar, strażnik, migracja ani test nie woła `llmService`, `/api/ai/**` ani `GoogleGenerativeAI` | `DEC-51` — zakaz atrapy AI; migracja danych nie ma prawa zależeć od sieci |
| `Z16` | **Nie usuwasz i nie „naprawiasz" uczciwych stanów pustych, `503 not_configured`, `null`, `UNKNOWN` ani nagrobków `410`** | Uczciwy `503` jest wzorcem POPRAWNYM |
| `Z17` | **Zakaz wszystkiego poza zakresem tego bloku** — z imiennymi licencjami z tabeli licencji | Rozłączność ze stanowiskami równoległymi |
| `Z18` | **★★ NAJOSTRZEJSZY — ABSOLUTNY zakaz modyfikowania globalnej infrastruktury testowej:** `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest.config.ts`, każdy `vitest.*.config.ts`, `server/vitest.config*.ts`, `playwright.config.ts`, `playwright.smoke.config.ts`, `tests/integration/_helpers/assertRealPostgres.ts` | Jedna zmiana globalnego mocka fałszuje wynik całego korpusu |
| `Z19` | **Nie odmontowujesz i nie kasujesz żadnego routera, middleware ani joba CI zamontowanego dziś** | Odmontowanie trasy potrafi zabić ekran, którego nie mierzysz |
| `Z20` | **★★ ZAKAZ uruchamiania testów DB bez jawnego kompletu env wskazującego kontener TEGO bloku, W TEJ SAMEJ LINII komendy.** Kolejność wiążąca: **NAJPIERW kontener + pełne migracje, DOPIERO potem jakikolwiek pomiar** | Trzy incydenty zapisu do cudzej bazy |
| `Z21` | **DoD wymaga DOWODU OSIĄGALNOŚCI, nie istnienia pliku** (`DEC-2026-08-26-104`). Pełna ścieżka: realne wejście HTTP → realny `ApiGateway` → `verifyToken` → trasa → handler → zapytanie → **wiersz w Twojej bazie** → odczyt, który ten wiersz podnosi → konsument w `src/` **albo jawne zdanie „brak konsumenta"** | Istnienie kodu ≠ działanie |
| `Z22` | **★★ Test wstrzykujący zależności albo montujący router w gołym `express()` NIE dowodzi ścieżki produkcyjnej** (`DEC-2026-08-26-107`). Dowodem jest `ApiGateway.getInstance().initializeRoutes(app)` | Replika rozjeżdża się z produkcją i nikt tego nie zauważa |
| `Z23` | **★★ ZERO ATRAP.** `200` z pustą kopertą tam, gdzie zapytanie padło, jest atrapą. Projekcja, która zwraca pustą listę zamiast błędu, gdy źródło padło, jest atrapą. **W tym bloku szczególnie: projekcja NIE MOŻE ukrywać rekordu, którego nie umie zmapować — ma go policzyć i wypisać** | `DEC-2026-08-25-21/22`, `DEC-51` |
| `Z24` | **Pomiar zasięgu testów wg `§0.4a` jest warunkiem oddania raportu.** Zawężony wybór albo **przepisanie cudzej liczby** = zawyżenie | Liczby autora instrukcji krążą po dokumentach i utrwalają się jako „fakt" |
| `Z25` | **★★ Testy realdb WYŁĄCZNIE z jawnym `DATABASE_URL` wskazującym Twój efemeryczny kontener** na porcie `6451` | **Port `5432` NASŁUCHUJE i nie jest Twój** — fallback = zapis do cudzych danych |
| `Z26` | **★★ Komplet env w tej samej linii — patrz `§0.2c`.** Bez `MOCK_DB=false` odczyty idą cicho na atrapę bazy; bez `ENABLE_V8_GLOBAL=true` część tras daje `404` **przed uwierzytelnieniem**; bez `ENABLE_TEST_AUTH_BYPASS=false` `verifyToken` **jest omijany** | Tak zginął dzień 23 |
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci.** Stan odkładasz przez `cp` do `codex1-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium |
| `Z28` | **★★ ZERO POŁĄCZEŃ DO RAILWAY, DEMO, STAGINGU I PRODUKCJI — w każdą stronę i każdym narzędziem.** Zakaz obejmuje `railway` CLI, `psql`/`docker exec psql` do hosta innego niż `127.0.0.1`, `curl`/`wget`/`fetch` do `*.railway.app`, `demo.consultify.ai`, `consultify.ai`, `staging.*` | **To jedyny zakaz, którego naruszenie zatrzymuje CAŁY blok.** „Przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą |
| `Z29` | **★★ Testy o kształcie „atak odrzucony + readback bez zmian" MUSZĄ biec BEZ PONAWIANIA: `--retry=0` w KAŻDEJ komendzie** i `retry: 0` w opcjach `describe`/`it` | Test „409 dla pisarza zastanego" leczy się skutkiem własnego ataku i raportuje `PASS`. **Stan na 04.09: `vitest.config.ts` ustawia `retry: 0` — zakaz zostaje w mocy, ale nie szukaj tu przyczyny niestabilności** |
| `Z30` | **★★ ZAKAZ REALNEJ WYSYŁKI E-MAILI, ZAPROSZEŃ KALENDARZOWYCH I POWIADOMIEŃ.** Przed pierwszym przebiegiem zapisującym **udowodnij w raporcie** protokół `§0.2b` | Wysłany e-mail jest **nieodwracalny**. **W tym bloku ma to ostrze: migracja z `E3` tworzy agregaty, a agregaty produkują `ie_outbox_events`** |
| `Z31` | **★★ ZAKAZ PRZYPINANIA STRAŻNIKA TESTU REALDB DO HOSTA, PORTU ALBO NAZWY BAZY.** Wołasz `await assertRealPostgresTestEnvironment()` **BEZ ARGUMENTÓW** | Dyżur 43 przypiął strażnik do swojej bazy: 30 przypadków stało się trwałym `SKIP`, pakiet raportuje `exit 0` i wygląda jak sukces |
| `Z32` | **★★ ZAKAZ WPISU `FIXED` / `VERIFIED` / `ZROBIONE_WG_DoD` BEZ DOWODU MUTACYJNEGO W OBIE STRONY.** Psujesz kod produkcyjny → test **CZERWONY**; cofasz → test **ZIELONY**; `git diff` po cofnięciu **pusty**. Obie komendy i oba wyniki dosłownie w raporcie. Mutację cofasz przez `cp` (`Z27`) | Dyżur 44 wpisał `FIXED` dla podatności, **która nigdy nie istniała** |
| `Z33` | **★★ PRZED KAŻDYM POMIAREM SPRAWDZASZ, CZY STRAŻNIK, KTÓRY MIERZYSZ, NIE WYŁĄCZA SIĘ SAM W TRYBIE TESTOWYM** — ramka `§0.2e` | Na `resultsInternalBetaVisibility.middleware.ts` zmierzono **416 fałszywych twierdzeń** |
| `Z34` | **★★ GREP DOWODZI, ŻE ŁAŃCUCH ISTNIEJE, NIE ŻE DZIAŁA.** Zdanie „działa" wolno Ci napisać wyłącznie po realnym żądaniu HTTP przez realny `ApiGateway`, z podpisanym JWT, na realnym Postgresie po pełnych migracjach — **i po zapisaniu KODU ODPOWIEDZI** | 28.08 zmierzono kompletny łańcuch, a każdy realny `POST` zwracał `500` |
| `Z34a` | **WYŁĄCZONY W TYM BLOKU** — patrz rozstrzygnięcie w `§0.1`: nie pushujesz nic i nigdzie, commitujesz po każdym etapie, push robi nadzorca | Numeracja `Z` jest wspólna dla wszystkich instrukcji i nie wolno jej przestawiać |
| `Z35` | **Zakaz „naprawiania" przez wyciszanie:** `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `.skip`, `.todo`, poszerzanie `exclude`/`testIgnore`, obniżanie progów, `--max-warnings`, `continue-on-error: true`. Uznajesz to za jedyne wyjście → **STOP z uzasadnieniem** | To choroba, którą program leczy, a nie narzędzie do jej leczenia |
| `Z36` | **Zakaz `eslint --fix` i `prettier --write` na czymkolwiek szerszym niż plik, który i tak zmieniasz z innego powodu** | Autofix skasowałby pracę **wszystkich** równoległych stanowisk |
| `Z37` | **Porównania testów po NAZWACH przypadków (`fullName`), NIGDY po liczbach** | Wektor maskowania regresji |
| `Z38` | **Zakaz usuwania i odmontowywania jakiegokolwiek joba CI.** Wolno dodać, wolno poprawić warunek | Bramki znikają łatwiej, niż wracają |
| `Z39` | **Zakaz uruchamiania realnych workflow GitHub Actions** — `gh workflow run`, `gh run rerun`, `act` z realnymi sekretami. Dowód robisz **statycznie** | Realny przebieg CI dotyka sekretów i środowisk poza Twoją kontrolą |
| `Z40` | **★★ ZAKAZ WŁAŚCIWY TEMU BLOKOWI: NIE KASUJESZ ANI NIE PRZEMIANOWUJESZ TABELI `initiatives` ANI ŻADNEJ TABELY `initiative_*`.** Migracja z `E3` jest **wyłącznie addytywna**: dopisuje agregaty w rejestrze kanonicznym i (opcjonalnie) kolumnę-znacznik. Zero `DROP`, zero `RENAME`, zero `DELETE` na danych zastanych, zero `TRUNCATE`. Zero modyfikacji **istniejących** plików w `server/migrations/**` | 09.09 czystka „sierot" skasowała 319 wierszy konfiguracji produktu, w tym baseline polityki — po niej **każde tworzenie inicjatywy zwracało `500`**. Tabela `initiatives` ma **713 wierszy w kopii stagingu** i jest cytowana przez 161 plików serwera; jej skasowanie byłoby nieodwracalną utratą danych klienta |

---

### 0.2b. ★★ PROTOKÓŁ `Z30` — ZERO WYSYŁKI, A MIMO TO PEŁNY DOWÓD

**(1) Czego NIE WOLNO Ci zrobić — nigdy:**
- ★ **NIE SZUKAJ flagi `ENABLE_LIVE_EMAIL`. Ona NIE ISTNIEJE** — `grep` po całym
  `server/src` i `src` daje zero trafień. To fantom powielany w starych
  instrukcjach. Realny warunek wysyłki: `emailService.ts` (ok. `:202`) tworzy
  transporter dopiero, gdy zobaczy **jednocześnie** `smtpConfig.host`
  i `smtpConfig.auth.user`, sklejone **najpierw z tabeli `settings`**, dopiero
  potem ze zmiennych środowiskowych. Bez tych dwóch wartości pisze na konsolę;
- ustawić `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_PORT`, `SMTP_FROM`
  gdziekolwiek;
- wstawić wiersza konfiguracji SMTP do tabeli `settings` w swojej bazie;
- uruchomić serwera pełnym `server/src/index.ts` — tam startują drenaże outboxów;
- wywołać ręcznie `drain*` / `startNotificationOutboxDrainCron` / `outboxWorker`.

**(2) Trzy dowody, które wklejasz do raportu ZANIM uruchomisz cokolwiek zapisującego:**

```bash
cd /Users/piotrwisniewski/Developer/codex-wt/codex1-inicjatywy

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY.
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-codex1-inicjatywy-pg psql -U postgres -d cx_codex1_inicjatywy \
  -c "SELECT key, left(coalesce(value,''),8) FROM settings WHERE key LIKE 'smtp%';"
#   oczekiwane: 0 wierszy. Jezeli tabela `settings` nie istnieje — wklej TEN blad,
#   to tez jest dowod.

# (c) zaden drenaz outboxu nie dziala w procesie testowym
grep -n "startNotificationOutboxDrainCron\|outboxWorker\|platformOutboxDrainCron" \
  server/src/Gateway.ts
#   oczekiwane: 0 trafien — drenaze startuja w server/src/index.ts, ktorego NIE uruchamiasz
```

**(3) ★★ DODATKOWY DOWÓD WŁAŚCIWY TEMU BLOKOWI.** Migracja z `E3` tworzy
agregaty, a każdy agregat dopisuje wiersze do `ie_outbox_events`. **Po `E3`
raport ma zawierać wynik:**

```bash
docker exec cx-codex1-inicjatywy-pg psql -U postgres -d cx_codex1_inicjatywy -Atc \
  "SELECT count(*) FROM ie_outbox_delivery_receipts;"
#   oczekiwane: 0 — zdarzenia moga LEZEC w outboxie, ale NIC nie zostalo doreczone,
#   bo zaden drenaz nie biegl.
```

**(4) Deklaracja obowiązkowa w raporcie, dosłownie:**
**„Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego bloku nie
zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani
żadnego drenażu outboxu. `ie_outbox_delivery_receipts` po migracji ma 0 wierszy.
Żaden e-mail, zaproszenie kalendarzowe ani powiadomienie nie zostało wysłane."**

---

### 0.2c. ★★ KOMPLET ZMIENNYCH ŚRODOWISKOWYCH — TRZY WARIANTY, ZAWSZE W JEDNEJ LINII

**Zmienna postawiona `export`-em wcześniej NIE LICZY SIĘ.** `vitest.config.ts`
przybija część wartości (`DB_TYPE='sqlite'`), więc komplet musi stać
**w tej samej linii komendy** — i masz **udowodnić, że nadpisał**, a nie założyć.

**(A) MIGRACJE — pełny łańcuch, przed jakimkolwiek pomiarem (`Z20`):**

```bash
cd /Users/piotrwisniewski/Developer/codex-wt/codex1-inicjatywy

docker run -d --name cx-codex1-inicjatywy-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx_codex1_inicjatywy \
  -p 127.0.0.1:6451:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-codex1-inicjatywy-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6451/cx_codex1_inicjatywy \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6451/cx_codex1_inicjatywy \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK.
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /Users/piotrwisniewski/Developer/codex-wt/codex1-inicjatywy && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6451/cx_codex1_inicjatywy \
JWT_SECRET=codex1-inicjatywy-lokalny-sekret-testowy \
npx vitest run <ŚCIEŻKI> --retry=0 \
  --reporter=json --outputFile=/Users/piotrwisniewski/Developer/codex-wt/codex1-artefakty/<NAZWA>.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje `No test files found`
— a to NIE jest `PASS`.** Sprawdź, którego configu wymaga dana ścieżka,
i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają połączenia):

```bash
cd /Users/piotrwisniewski/Developer/codex-wt/codex1-inicjatywy && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run <ŚCIEŻKI> --retry=0 \
  --reporter=json --outputFile=/Users/piotrwisniewski/Developer/codex-wt/codex1-artefakty/<NAZWA>.json
```

**To NIE jest naruszenie `Z26`, tylko warunek `Z25`.**
**Nigdy nie mieszasz: pakiet jednostkowy NIE jest dowodem egzekucji.**

**Znaczenie każdej zmiennej — musisz je znać, zanim ją wpiszesz:**

| Zmienna | Co się stanie, gdy jej zabraknie |
| --- | --- |
| `RUN_DB_TESTS=1` | `tests/setup.ts` pomija testy bazodanowe; pakiet raportuje `exit 0` |
| `MOCK_DB=false` | odczyty idą **cicho** na atrapę bazy, zapisy nigdzie nie lądują. **Atrapa `Database.ts:686` zwraca `changes:1` dla KAŻDEGO `UPDATE`, niezależnie od `WHERE` — Twój test migracji „zaktualizowano N wierszy" przeszedłby na niej zawsze** |
| `DB_TYPE=postgres` | `vitest.config.ts` przybija `sqlite` — mierzysz inny silnik, niż myślisz |
| `NODE_ENV=test` | runner migracji odmawia albo zwraca MOCK przy bazie lokalnej |
| `ENABLE_V8_GLOBAL=true` | część tras daje **fałszywe `404` PRZED uwierzytelnieniem** |
| `ENABLE_TEST_AUTH_BYPASS=false` | **`verifyToken` JEST OMIJANY** |
| `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` | strażnik Wyników przepuszcza wszystko przy `NODE_ENV=test`. **W tym bloku to krytyczne — `E5` dowodzi widoczności rekordu w module Wyniki** |
| `DATABASE_URL` | fallback na `localhost:5432`, który **nasłuchuje i nie jest Twój** |
| `JWT_SECRET` | podpisany JWT nie przejdzie przez `verifyToken`; dostaniesz `401` z niewłaściwego powodu |
| `--retry=0` | test „legacy zapis odrzucony" **leczy się skutkiem własnego ataku** i raportuje `PASS` |

---

### 0.2d. ★★ ZNANE PUŁAPKI ŚRODOWISKA — OSIEMNAŚCIE OGÓLNYCH + PIĘĆ WŁASNYCH

**Czytaj to, ZANIM uznasz cokolwiek za zepsute.**

1. **Vault jest BARE + `extensions.worktreeConfig=true`.** Po `git worktree add`
   **musisz** utworzyć `<vault>/worktrees/codex1-inicjatywy/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
2. **Remote `icloud-source` w vaulcie jest MARTWY.** Nie wołaj `git fetch --all`.
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`.** Każde zapytanie:
   `docker exec cx-codex1-inicjatywy-pg psql -U postgres -d cx_codex1_inicjatywy -c '…'`.
4. **Runner migracji wymaga `NODE_ENV=test` przy bazie lokalnej.**
5. **`vitest.config.ts` twardo ustawia `test.env.DB_TYPE='sqlite'`.** `DB_TYPE=postgres`
   musi stać **w tej samej linii komendy**, a Ty **udowadniasz w raporcie, że
   nadpisało** (asercja `expect(process.env.DB_TYPE).toBe('postgres')` w pierwszym
   `it` każdego nowego pakietu). Pliku **nie zmieniasz** (`Z18`).
6. **`JSON.parse` na kolumnie typu `json` działa na SQLite i wywala `500` na
   PostgreSQL** — sterownik `pg` zwraca już zdeserializowany obiekt.
   **W tym bloku dotyczy wprost `ie_aggregate_state.payload_json` (typ `jsonb`)** —
   nie parsuj go drugi raz.
7. **CI NIE URUCHAMIA TESTÓW dla naszych gałęzi.** „CI zielone" nie jest w tym
   repo żadnym dowodem. Dowodem jest wyłącznie Twój przebieg z `--retry=0`.
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv`.
9. **Reporter `basic` NIE ISTNIEJE w tej wersji vitest.** Używasz
   `--reporter=json --outputFile=<plik poza repo>`.
10. **`npx vitest run` bywa kończy się `exit 0` mimo czerwonych testów.**
    Liczby i nazwy czytasz z JSON-a, nie z kodu wyjścia.
11. **Nowe pliki w `tests/` wymagają `git add -f`.** Sprawdzasz `git status --short`
    po każdym commicie.
12. **`| head` na grepie produkuje FAŁSZYWE SIEROTY.** Werdykt „martwy czytelnik"
    wymaga grepu **bez obcięcia**, z wykluczeniem `__tests__` i komentarzy.
13. **ESM nie honoruje `NODE_PATH`.** Skrypt `.mjs` uruchamiany spoza repo nie
    znajdzie pakietów — rozwiązuj przez `createRequire(REPO + '/package.json')`.
14. **`postgres:15` NIE PRZECHODZI migracji** — brak rozszerzenia `vector`.
    Obraz obowiązkowy: `pgvector/pgvector:pg16`.
15. **`prettier` na wielkich plikach potrafi przepisać cały plik.** Wołasz
    `npx prettier --write <pliki>` wprost, tylko na plikach, które i tak zmieniasz.
    Reformat większy niż ~3× Twoje linie merytoryczne — **cofasz** (`cp`, nie `stash`).
16. **Istnieją testy tekstowe przez `readFileSync` + `toContain`,** które asertują
    **dosłowne linie kodu**. Zapalony po Twoim reformacie = regresja reformatu.
17. **`npx vitest` z roota bez właściwego configu daje `No test files found`.**
    To **nie jest `PASS`** — to jest brak pomiaru.
18. **`grep -rn … --include='*.ts'` w `zsh` potrafi zwrócić PUSTKĘ** zamiast wyników
    (`no matches found`). **Pustka nie jest wynikiem.** Albo cytuj wzorzec
    (`--include='*.ts'` w apostrofach i na końcu), albo używaj `grep -rn … server/src`
    bez `--include` i filtruj potokiem.

**PIĘĆ PUŁAPEK WŁASNYCH TEGO BLOKU (zmierzone, nie założone):**

19. **`information_schema` w tej bazie zwraca kolumny Z DWÓCH SCHEMATÓW.**
    W kopii stagingu obok `public` żyje schemat `fala5_backup` z własną tabelą
    `initiatives` (84 kolumny vs 106 w `public`). Zapytanie bez
    `table_schema='public'` **liczy podwójnie i niewidocznie**. Każde Twoje
    zapytanie do `information_schema` ma mieć jawny `table_schema`.
20. **Identyfikator inicjatywy ma DWA KSZTAŁTY.** Kanon nadaje
    `initiative-<uuid>` (`stableCommandId('initiative', …)`, `initiativeWriteTruth.ts:190`),
    tabela zastana trzyma dowolny `TEXT`. **Nie zakładaj wspólnego formatu** —
    dopasowanie robisz po pełnym łańcuchu znaków, a rozjazd formatów wypisujesz.
21. **Słowniki stanów są RÓŻNE i już się przeciekły.** Zastana kolumna `status`
    mówi `DRAFT/PROPOSED/PENDING_APPROVAL/APPROVED/IN_EXECUTION/REJECTED/CLOSED`,
    kanon mówi `REGISTERED_DRAFT/DEFINED/ANALYZING/READY_FOR_DECISION/
    APPROVED_BACKLOG/SCHEDULED/IN_EXECUTION/DELIVERED/BENEFITS_TRACKING/
    EFFECTIVENESS_REVIEWED/CLOSED/ARCHIVED`. **W kopii stagingu jeden agregat
    kanoniczny ma `lifecycleState = EXECUTING`, czyli słowo ze słownika ZASTANEGO** —
    przeciek już nastąpił. Tłumaczenie w obie strony masz gotowe w
    `src/contracts/initiatives-execution/statusMapping.ts` (72 linie,
    `mapInitiativeStatus`), ale **odpowiednika po stronie serwera NIE MA** —
    `find server/src -iname 'statusMapping*'` daje zero.
22. **Atrapa bazy kłamie o zapisie warunkowym.** `Database.ts:686` zwraca
    `changes: 1` dla każdego `UPDATE` niezależnie od `WHERE`. Każdy test migracji
    „przemigrowano N" uruchomiony bez `MOCK_DB=false` przechodzi zawsze.
23. **Bramka istnienia w `pmoValidation.middleware.ts:206` pyta
    `SELECT id FROM initiatives WHERE id = ?` BEZ `organization_id`.** To jedyna
    z 50 bramek bez zawężenia do organizacji. **NIE NAPRAWIASZ jej w tym bloku**
    (poza zakresem — to zmiana granicy tenanta) — **masz ją zgłosić w raporcie
    jako osobne znalezisko z plik:linia.**

---

> ### ★★ RAMKA DO `Z33` (`§0.2e`) — PUŁAPKI, KTÓRE FAŁSZUJĄ ZIELONY PRZEBIEG.
> **Zielona suita w tym repozytorium NIE JEST DOWODEM, dopóki nie wiesz, którą
> pułapkę omija.**
>
> **(a) `ENABLE_V8_GLOBAL` nieustawione → fałszywe `404` PRZED uwierzytelnieniem.**
> `server/src/middleware/v8FeatureGate.middleware.ts` czyta
> `process.env.ENABLE_V8_GLOBAL === 'true'`; przy braku zmiennej bramka odcina
> trasę **zanim** cokolwiek sprawdzi tożsamość. **W tym bloku dotyczy wprost
> `server/src/routes/v8/results.routes.ts` — a to tam siedzi 11 z 50 bramek istnienia.**
>
> **(b) `resultsInternalBetaVisibility.middleware.ts` przepuszcza wszystko przy
> `NODE_ENV=test`,** dopóki nie ustawisz
> `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`. **Na tym strażniku
> zmierzono 416 fałszywych twierdzeń o uprawnieniach.** `E5` dowodzi widoczności
> rekordu w module Wyniki — bez tej zmiennej Twój dowód jest bezwartościowy.
>
> **(c) `vitest.config.ts` twardo ustawia `test.env.DB_TYPE='sqlite'`.**
> `MOCK_DB=false DB_TYPE=postgres` w tej samej linii to jedyne wyjście (`Z18`).
>
> **(d) `ENABLE_TEST_AUTH_BYPASS`.** `server/src/middleware/auth.middleware.ts`
> zawiera gałąź `if (NODE_ENV === 'test' && ENABLE_TEST_AUTH_BYPASS === 'true')`
> — **`verifyToken` potrafi wyłączyć się sam w trybie testowym**.
>
> **(e) PUŁAPKA WŁAŚCIWA TEMU BLOKOWI: `requireCanonicalInitiativeExecutionWriter`
> odpowiada `409` PRZED handlerem.** Middleware jest zamontowany w
> `server/src/routes/pmo/initiatives.routes.ts:161`, a jego lista wzorców siedzi
> w `executionSpineLegacyReadOnly.middleware.ts` (stała
> `LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS`). Twój test „POST do trasy zastanej
> daje 409" **przejdzie także wtedy, gdy handler w ogóle nie istnieje** — bo
> odpowiedź wychodzi z middleware. Dowód `E4` musi rozróżniać `409` z middleware
> (ma pole `code: 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED'`) od `409` z Twojej logiki.
>
> **Obowiązek dowodowy.** Dla **każdego** pakietu uruchomionego jako dowód
> czegokolwiek raport zawiera akapit: *która z pułapek (a)–(e) dotyczy tego
> pakietu, jak ją wyłączyłem, i co konkretnie dowodzi, że wyłączyłem*.
> Akapit „nie dotyczy" jest dopuszczalny **tylko** z komendą pokazującą, że dany
> strażnik nie leży na ścieżce. **Pomiar bez tego akapitu nie liczy się jako dowód.**

---

### 0.5. Reguła STOP

**Przy jakiejkolwiek wątpliwości MERYTORYCZNEJ: STOP tego ETAPU i wpis
w raporcie — nigdy improwizacja. W tym programie zasadny STOP jest NAGRADZANY,
a zgadywanie karane.**

**Rozróżnij dwa rodzaje:**

- **STOP MERYTORYCZNY** (mile widziany): zmierzyłeś i wyszło inaczej, niż mówi
  ta instrukcja; brakuje informacji, której nikt poza właścicielem nie
  dostarczy; naprawa wymaga decyzji produktowej. **Wpisujesz do raportu
  i IDZIESZ DALEJ do następnego etapu.**
- **STOP PROCEDURALNY** (zakazany): „instrukcja jest sprzeczna", „ścieżka nie
  istnieje", „nie mam licencji na plik". **Ten rodzaj NIE zatrzymuje niczego.**

### ★★ TABELA: STOP PROCEDURALNY ZAKAZANY — DZIAŁANIE ZASTĘPCZE

| Powód, dla którego chciałbyś stanąć | Co robisz ZAMIAST STOP-u |
| --- | --- |
| „Musiałbym zmienić plik przekrojowy (`auth.middleware.ts` / `Gateway.ts` / bramkę platformową)" | **Czerwony kontrakt testowy + brief wynikowy** (tabela licencji, wiersz 1). Etap jest wtedy **ZROBIONY**, nie STOP |
| „Plik, którego potrzebuję, nie jest w tabeli licencji" | Traktujesz go jako **tylko do odczytu** i dajesz czerwony kontrakt + brief. Etap **ZROBIONY** |
| „Instrukcja jest wewnętrznie sprzeczna" | Sekcja **„JEŚLI COŚ JEST SPRZECZNE"** na końcu dokumentu. Wybierasz interpretację **bezpieczniejszą**, opisujesz w „Korektach", **kontynuujesz pozostałe etapy** |
| „Ścieżka podana w instrukcji nie istnieje" | Sprawdzasz `ls`, wpisujesz **swój wynik** do „Korekt", szukasz realnego odpowiednika i **idziesz dalej**. Rozbieżność pomiaru z instrukcją **nie jest sprzecznością — jest WYNIKIEM** |
| „Instrukcja podaje inną liczbę niż mój pomiar" | Podajesz **swoją** liczbę z komendą (`Z24`). To **nie jest** powód do STOP-u |
| „`git fetch` zwrócił błąd `icloud-source`" | To **nie jest** błąd. `§0.2d` pkt 2. Idziesz dalej |
| „`psql` nie istnieje na hoście" | `docker exec cx-codex1-inicjatywy-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit / commit-msg blokuje commit" | **Naprawiasz komunikatem albo kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em. Mechanizm znaczników odmrożenia opisany w `§0.6` |
| „Musiałbym odłożyć stan roboczy" | `cp` do `codex1-scratch`. `git stash` jest zakazem (`Z27`) |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie etapu |
| „Nie zdążę zrobić wszystkich etapów" | Robisz **rdzeń** (`E1`, `E2`, `E4`, `E6`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarz zrobiony, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6451` albo `5591` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO bloku jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji** (`Z28`);
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6451` albo `5591`** (`Z7`).

Format wpisu STOP:

```
### STOP — <etap>
Rodzaj: MERYTORYCZNY / PROCEDURALNY
Powód: <jedno zdanie>
Licencja, którą sprawdziłem: <cytat wiersza z tabeli licencji + wynik>
Dowód: <plik:linia albo komenda + wynik>
Co dostarczyłem ZAMIAST zmiany: <czerwony kontrakt / pomiar / gotowy diff / brief>
Co zrobiłbym, gdyby zapadła decyzja X: <2-3 zdania>
Rekomendacja dla nadzorcy: <co zmienić, gdzie, jaki promień rażenia>
Stan: NIE ZACOMMITOWANO / zacommitowano częściowo w <SHA>
Czy kontynuowałem pozostałe etapy: TAK / NIE + dlaczego
```

**★★ STOP bez wypełnionego pola „Licencja, którą sprawdziłem" jest NIEZASADNY
z definicji. STOP bez wypełnionego pola „Co dostarczyłem ZAMIAST zmiany" jest
NIEZASADNY z definicji.**

---

### 0.6. ★★ MECHANIZM ZAMROŻENIA I ZNACZNIKI ODMROŻENIA — CZYTAJ PRZED PIERWSZYM COMMITEM

Właściciel odbierał MVP moduł po module i po swoim „tak" moduł został
**zamrożony**. Rejestr zamrożeń: `docs/program/MVP_FINAL_ZAMROZONE.json`
(**nie edytujesz go ręcznie**, `Z13`). Procedura: `docs/program/MVP_FINAL_PROCEDURA.md`.

**Gdzie to blokuje (zmierzone, nie założone):**

- `.husky/pre-commit` — **TYLKO OSTRZEGA** (`scripts/mvp-final/check-freeze.sh --tylko-ostrzez || true`).
  Powód podany wprost w kodzie hooka: w `pre-commit` plik `.git/COMMIT_EDITMSG`
  trzyma jeszcze komunikat **POPRZEDNIEGO** commita, więc czytanie go tam byłoby
  teatrem zgodności.
- `.husky/commit-msg` — **TU BLOKUJE.** To jedyny hook, który dostaje PRAWDZIWY
  komunikat commita jako `$1`. Woła
  `bash scripts/mvp-final/check-freeze.sh --commit-msg="$1"` i przy braku
  znacznika kończy `exit 1`.

**Jedyna droga: znacznik w komunikacie commita, dosłownie:**

```
[ODMROZENIE <MODUL> DEC-<numer>]
```

**Dla tego bloku obowiązują DWA znaczniki**, bo dotykasz plików obu
zamrożonych modułów:

```
[ODMROZENIE 05_INITIATIVES DEC-453] [ODMROZENIE 06_EXECUTION DEC-453]
```

**Które z Twoich plików są zamrożone (zmierzone przeze mnie na markerze —
zweryfikuj sam skryptem poniżej):**

| Plik | Moduł w rejestrze |
| --- | --- |
| `src/components/Initiatives/InitiativesHub.tsx` | `05_INITIATIVES` |
| `src/components/Initiatives/initiativeRegisterProjection.ts` | `05_INITIATIVES` |
| `src/components/Execution/ExecutionHub.tsx` | `06_EXECUTION` |
| `server/src/**` (wszystkie pliki serwera z tego bloku) | **NIEZAMROŻONE** |
| `src/services/initiativeWriteTruth.ts`, `src/services/initiatives-execution/runtimeApi.ts` | **NIEZAMROŻONE** |

Sprawdzenie własne przed commitem:

```bash
cd /Users/piotrwisniewski/Developer/codex-wt/codex1-inicjatywy
bash scripts/mvp-final/check-freeze.sh --pliki $(git diff --cached --name-only) \
  --komunikat="proba"
```

**Zasada praktyczna:** znaczniki dopisujesz do **każdego** commita tego bloku —
także wtedy, gdy dany commit nie dotyka pliku zamrożonego. Nadmiarowy znacznik
niczego nie psuje, brakujący blokuje commit i kosztuje Cię przebieg.

**★ `--no-verify` jest ZAKAZEM (`§0.5`), nie obejściem.**

---

## ★ PO CO TEN BLOK ISTNIEJE

Właściciel produktu **cofnął odbiór dwóch modułów** 07.09 (`DEC-453`,
`docs/program/PROGRAM_NAPRAWCZY_20260905/01_INDEKS_I_HARMONOGRAM.md:367`),
słowami: *„Niestety, ani jedno, ani drugie nie działa. Także cofamy. Inicjatywy
i execution, funkcje związane z zarządzaniem nimi nie działają."*

Naprawa z 07–10.09 zdjęła objawy — ale **przyczyna została**: inicjatywa
w Consultify mieszka **w dwóch niezależnych magazynach**, a poszczególne ekrany
pytają raz jeden, raz drugi. Dopóki tak jest, każdy nowy ekran ma szansę mniej
więcej pół na pół trafić w magazyn, w którym rekordu nie ma — i będzie to
wyglądało jak nowa awaria, choć jest to ta sama, stara.

**Ten blok ma zamienić dwa magazyny w jeden kanon plus jedną projekcję.**
Nie ma zmieniać wyglądu **ani jednego piksela**.

---

## ★ STAN ZMIERZONY — 2026-09-10, na kopii bazy stagingu i na kodzie markera

**To jest rozkaz pomiarowy, nie prawda objawiona.** Każdą liczbę mierzysz sam
(`Z24`). Obalenie którejkolwiek tezy poniżej jest **sukcesem** tego bloku.

### (a) Dwa magazyny — nazwy, liczby, klucze

| Magazyn | Tabela | Klucz | Wiersze (kopia stagingu 10.09) |
| --- | --- | --- | --- |
| **KANON (runtime-v1)** | `ie_aggregate_state` (`aggregate_type='initiative'`) | `(organization_id, aggregate_type, aggregate_id)` + `version` | **29** agregatów typu `initiative` (189 wszystkich typów) |
| **ZASTANY (SQL)** | `initiatives` | `id` (TEXT), zawężenie po `organization_id` | **713** |

Rozjazd, zmierzony jednym zapytaniem:

```sql
SELECT 'agregat BEZ wiersza w initiatives', count(*)
  FROM ie_aggregate_state s
 WHERE s.aggregate_type='initiative'
   AND NOT EXISTS (SELECT 1 FROM initiatives i WHERE i.id=s.aggregate_id)
UNION ALL SELECT 'wiersz initiatives BEZ agregatu', count(*)
  FROM initiatives i
 WHERE NOT EXISTS (SELECT 1 FROM ie_aggregate_state s
                    WHERE s.aggregate_type='initiative' AND s.aggregate_id=i.id)
UNION ALL SELECT 'czesc wspolna', count(*)
  FROM initiatives i
  JOIN ie_aggregate_state s ON s.aggregate_type='initiative' AND s.aggregate_id=i.id;
```

**Mój wynik: 15 · 699 · 14.**
Czyli: **z 29 agregatów kanonicznych 15 nie ma wiersza zastanego** (to jest
dokładnie to, co widział właściciel), a **z 713 wierszy zastanych 699 nie ma
agregatu** (to jest skala migracji z `E3`). Część wspólna to 14 rekordów.

Otoczenie kanonu (do zrozumienia, nie do przepisania):
`ie_aggregate_relations` 188, `ie_command_receipts` 341, `ie_outbox_events` 341,
`ie_audit_events` 341, `ie_initiative_card_catalog` 26.
Otoczenie zastane: `initiative_milestones` **1070**, `initiative_kpis` 27,
`initiative_status_history` 81, `initiative_history` 11, `initiative_candidates` 5.
`initiative_drafts`, `generated_initiatives`, `assessment_initiatives` — **0 wierszy**.

**Zasięg organizacyjny — najostrzejsza liczba całego pomiaru:**
`initiatives` obejmuje **29 organizacji**, `ie_aggregate_state/initiative` —
**2 organizacje**. Kanon nie jest „nowszym magazynem tych samych danych".
Kanon jest **magazynem dwóch organizacji**, a produkt ma dwadzieścia dziewięć.

### (b) Kto pisze do którego magazynu

**PISARZ KANONICZNY — jedyna droga tworzenia z UI:**
- `src/services/initiativeWriteTruth.ts:180` `createInitiativeWriteTruth(...)` →
  `submitSourceProposal` (`runtimeApi.ts:485`) → `registerSourceProposal`
  (`runtimeApi.ts:541`) → `POST /api/initiatives/runtime-v1/registrations` →
  agregat w `ie_aggregate_state`. **Zero `INSERT INTO initiatives`.**
- Wołają go **cztery** powierzchnie (grep bez obcięcia, bez `__tests__`):
  `InitiativesHub.tsx:2999`, `Wizard/InitiativeCharterWizard.tsx:438`,
  `Wizard/InitiativeWizardModal.tsx:1280`, `Generator/adapters/interview.ts:96`.
- Trasy kanoniczne montuje `server/src/routes/pmo/initiatives.routes.ts:156-157`
  (`router.use('/runtime-v1', initiativesExecutionRuntimeRouter)` oraz
  `initiativesCapacityAdvisorRouter`).

**PISARZE ZASTANI — piszą do `initiatives` i NIE tworzą agregatu.**
Grep `INSERT INTO initiatives | UPDATE initiatives | DELETE FROM initiatives`
po `server/src` bez `__tests__` daje wiele trafień; najważniejsze produkcyjne:
`server/src/controllers/InitiativeController.ts:634`, `:694` (dwa różne `INSERT`),
`:1182`, `:1609`, `:2391`, `:2744`, `:2862`, `:3070` (`DELETE`);
`server/src/controllers/ToolController.ts:2701`, `:2719`;
`server/src/routes/assessment-workflow-v2.routes.ts:1391`, `:1416`;
`server/src/routes/report-builder.routes.ts:5651`, `:5706`, `:5741`;
`server/src/routes/my-work.routes.ts:7343`, `:7359`, `:7392`;
`server/src/routes/economics.routes.ts:1977`;
`server/src/routes/v8/execution-control.routes.ts:946`, `:1138`, `:1263`, `:1432`;
`server/src/routes/executionControl.routes.ts:265`;
`server/src/routes/portfolioOptimization.routes.ts:411`;
`server/src/routes/v8/interview-insights.routes.ts:1136`;
`server/src/routes/v8/my-work.routes.ts:3006`.

**Częściowe wycofanie zapisów zastanych już istnieje** —
`server/src/middleware/executionSpineLegacyReadOnly.middleware.ts`, zamontowane
w `initiatives.routes.ts:161`. Odpowiada `409` z
`code: 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED'` dla czterech wzorców ścieżek.
**Sześć ścieżek zostało ŚWIADOMIE PRZYWRÓCONYCH 07.09** (komentarz w pliku,
sekcja „ZAWEZENIE 07.09 (DEC-453)"): `milestones`, `resources`, `staffing-plans`,
`budget-items`, `gate-roles`, `move` — **bo kanoniczny następca dla nich NIE
ISTNIEJE albo pisze do innego modelu odczytu**. To jest dokładnie kształt,
któremu `E4` ma położyć kres: *ścieżka wycofana WYŁĄCZNIE wtedy, gdy istnieje
kanoniczna komenda pisząca do TEGO SAMEGO modelu odczytu.*

### (c) Kto czyta z którego magazynu

| Powierzchnia | Wołacz w `src/` | Trasa | Magazyn |
| --- | --- | --- | --- |
| Rejestr Inicjatyw (lista) | `runtimeApi.ts:1152` `listRegisteredInitiatives` | `GET /api/initiatives/runtime-v1/initiatives` (`initiativesExecutionRuntime.routes.ts:2112`) | **KANON** |
| Rejestr Inicjatyw (dopełnienie) | `runtimeApi.ts:1274` `listLegacyInitiatives` | `GET /api/initiatives` (`initiatives.routes.ts:1176` → `InitiativeController.getInitiatives:184`) | **ZASTANY** |
| Karta inicjatywy | `InitiativeDocumentView.tsx` | `GET /api/initiatives/:id` (`InitiativeController.getInitiativeById:447` → `planningPortfolioReadService.getInitiativeDetailRead:317`, `FROM initiatives i` `:326`) | **ZASTANY** |
| Kamienie milowe | zakładka Zadania karty | `GET /api/initiatives/:id/milestones` (`InitiativeController.ts:3380`) | **ZASTANY + fallback kanoniczny od 10.09** (`:3387`) |
| Kokpit Realizacji | `src/components/Execution/*` | mieszanka `runtime-v1/execution-cases` i tras zastanych (`executionRealData.ts` dokumentuje pomiar: `runtime-v1/execution-cases` → 0 rekordów, `/api/initiatives` → 72) | **OBA** |
| Moja Praca | `runtime-v1/my-work/*` oraz `server/src/routes/my-work.routes.ts:9008,9027,9096` | mieszanka | **OBA** |
| Wyniki | `src/components/ResultsVNext/kpiApi.ts` | `server/src/routes/v8/results.routes.ts` — **11 bramek `SELECT id FROM initiatives`** (`:544 :596 :663 :744 :1127 :1691 :2592 :2891 :3058 :3093 :3179`) | **ZASTANY** |
| Raporty | `report-builder.routes.ts`, `executionReports.routes.ts` | `FROM initiatives` (4 trafienia w report-builder) | **ZASTANY** |

**★★ NAJWAŻNIEJSZA LICZBA CAŁEGO BLOKU.**
Wzorzec „sprawdź, czy inicjatywa istnieje" jest w kodzie serwera powielony
**50 razy w 19 plikach** i **49 z nich pyta WYŁĄCZNIE tabelę zastaną**:

```
grep -rn "SELECT id FROM initiatives WHERE id" server/src | grep -v __tests__ | wc -l
```

Rozkład: `v8/results.routes.ts` 11 · `InitiativeController.ts` 10 ·
`v8/execution-control.routes.ts` 5 · `initiativeGovernanceService.ts` 4 ·
`pmo/initiatives.routes.ts` 3 · `benefits.routes.ts` 3 · `v8/execution.routes.ts` 2 ·
po jednym: `workCanvasService.ts`, `planningPortfolioReadService.ts`,
`interviewEnterpriseService.ts`, `initiativeKpiAssignmentService.ts`,
`initiativeClosureService.ts`, `financialModelingService.ts`,
`v8/interview-insights.routes.ts`, `v8/finance-value.routes.ts`,
`pmo/initiativeClosure.routes.ts`, `initiatives-additive.routes.ts`,
`pmoValidation.middleware.ts`, `DecisionController.ts`.

**Jedyna bramka z fallbackiem kanonicznym** to `InitiativeController.ts:3380+3387`
(commit `3ab51dfb3e`, 10.09). To jest **łatka na jednym z pięćdziesięciu otworów**,
a nie rozwiązanie — i dokładnie dlatego istnieje ten blok.

### (d) Czy istnieje już jakikolwiek adapter / projekcja

| Kandydat | Istnieje? | Co naprawdę robi |
| --- | --- | --- |
| `server/src/domain/initiatives-execution/postgresInitiativeReader.ts` (2092 linie, klasa `PostgresInitiativeReader:107`) | **TAK** | Czytnik **kanonu**, nie adapter. Prawie wszystkie zapytania to `FROM ie_aggregate_state`. **Jeden wyjątek: `:305` czyta `SELECT id, required_capacity_fte FROM initiatives`** — czyli sam kanoniczny czytnik już dziś sięga po kolumnę, której kanon nie ma |
| `server/src/services/initiative/initiativeTransitionService.ts` (2220 linii) | **TAK** | Przejścia stanów **w tabeli zastanej** (11 trafień `FROM/UPDATE initiatives`). To nie jest most |
| `server/src/services/v8/transformationInitiativeTransitionAdapterService.ts` | **TAK** (uwaga: leży w `services/v8/`, **nie** w `services/initiative/`) | Adapter przejść, nie adapter magazynu |
| `server/src/middleware/executionSpineLegacyReadOnly.middleware.ts` (105 linii) | **TAK** | Bramka `409` dla części zapisów zastanych. Kierunek dobry, zasięg cząstkowy (patrz `(b)`) |
| **`src/components/Initiatives/initiativeRegisterProjection.ts:482` `mergeLegacyInitiativesIntoRegister`** | **TAK** | **★★ TO JEST DZISIEJSZA PROJEKCJA — I ŻYJE W PRZEGLĄDARCE.** `InitiativesHub.tsx:605` pobiera obie listy dwoma osobnymi żądaniami i skleja je po `id` w kliencie. Komentarz w `runtimeApi.ts:1258-1272` opisuje to wprost jako most zbudowany 05.09 po pomiarze „71 rekordów zastanych, 0 kanonicznych" |
| Odpowiednik `statusMapping` po stronie serwera | **NIE** | `src/contracts/initiatives-execution/statusMapping.ts` istnieje (72 linie); `find server/src -iname 'statusMapping*'` → **zero** |

**Werdykt (d):** projekcja **istnieje, ale w złej warstwie**. Korzysta z niej
**jeden ekran z ośmiu**. Pozostałe siedem powierzchni — karta, kamienie, kokpit
Realizacji, Moja Praca, Wyniki, raporty, `GET /api/initiatives` — nie widzi
jej wcale, bo działa na serwerze, a most jest w kliencie.

### (e) Czy sygnał (1) jest prawdziwy — prześledzenie kreatora

**TAK, potwierdzony w trzech niezależnych miejscach:**

1. **Kod:** `createInitiativeWriteTruth` (`initiativeWriteTruth.ts:180-289`) robi
   dokładnie dwa wywołania (`submitSourceProposal`, `registerSourceProposal`),
   po czym czyta „na zimno" `readRegisteredInitiative(initiativeId)`.
   Identyfikator powstaje jako `stableCommandId('initiative', creationRequestId)`,
   czyli `initiative-<uuid>`. **Nigdzie w tej ścieżce nie ma `INSERT INTO initiatives`.**
2. **Baza:** 15 z 29 agregatów nie ma wiersza zastanego (zapytanie w `(a)`).
3. **Historia:** commit `3ab51dfb3e` (10.09) opisuje ten sam pomiar na żywym
   stagingu jako „16 z 30" i nazywa skutek: *„Każda inicjatywa utworzona
   przyciskiem »Utwórz« trafiała na to 404 od razu."*

**Dwa pozostałe sygnały też są prawdziwe:**
- kamienie milowe: naprawione obejściem `3ab51dfb3e` (jedna bramka z pięćdziesięciu);
- pętla autozapisu przez `status .default('DRAFT')`: naprawiona commitem
  `3f9a9a0d59` (09.09). **Przyczyna wciąż stoi w kodzie:**
  `server/src/validators/initiative.validators.ts:70`
  `status: InitiativeStatusEnum.optional().default('DRAFT')` — komentarz
  w `:133` opisuje mechanizm. **Nie ruszasz tego w tym bloku** (obejście działa),
  ale masz to wymienić w raporcie jako dług, który wróci przy zmianie kanonu stanów.

### ★ WERDYKT O PREMISIE ZLECENIA

Premisa nadzorcy jest **prawdziwa i zaniżona**. Zaniżona w dwóch miejscach:
- rozjazd nie jest symetryczny — **699 wierszy zastanych bez agregatu** to
  49-krotność liczby, o którą chodziło w zgłoszeniu (15);
- kanon obsługuje **2 organizacje z 29**, więc „przełączenie na kanon" bez
  migracji z `E3` **wygasiłoby produkt dla 27 organizacji**. To jest kształt
  `zamkniete-przez-wygaszenie` i jest to najpoważniejsze ryzyko tego bloku.

---

## ★ ZAKRES

1. **Jeden kanoniczny magazyn** inicjatywy: `ie_aggregate_state`
   (`aggregate_type='initiative'`), obsługiwany przez runtime-v1.
2. **Jedna projekcja po stronie SERWERA**, przez którą wszyscy zastani
   czytelnicy widzą także rekordy kanoniczne — bez duplikowania tabel.
3. **Migracja danych zastanych do kanonu** — addytywna, idempotentna, z trybem
   suchym, manifestem i przywracaniem.
4. **Przepięcie pisarzy** na kanon; trasy zastane odpowiadają `409` z tekstem
   po polsku **wyłącznie tam, gdzie następca realnie istnieje i pisze do tego
   samego modelu odczytu**.
5. **Test „nowy rekord z UI widać wszędzie"** — siedem powierzchni, dowód HTTP + SQL.
6. **Raport** w narzuconym układzie.

## ★ POZA ZAKRESEM — imiennie

- **Żadnych zmian wyglądu.** Zero zmian układu, kolorów, odstępów, ikon, tekstów
  widocznych na ekranie, komponentów `src/components/standard/**`, tokenów `c-*`.
  Front dotykasz **wyłącznie** tam, gdzie przepinasz wołacza z jednej funkcji
  na drugą, i diff ma to pokazywać.
- **Zero nowych ekranów** i zero nowych elementów interfejsu (`Z11`).
- **Produkcja nietykalna** (`Z8`, `Z28`).
- **Zero migracji modyfikujących istniejące pliki** w `server/migrations/**`.
  Wyłącznie NOWE pliki w przedziale `20262130`–`20262139`, wyłącznie addytywne (`Z40`).
- **Zero zmian globalnej infrastruktury testowej** (`Z18`).
- **Zero zmian modelu uprawnień i granicy tenanta** (`Z12`) — w tym **NIE
  naprawiasz** `pmoValidation.middleware.ts:206` (bramka bez `organization_id`),
  tylko ją zgłaszasz.
- **Nie kasujesz tabeli `initiatives` ani żadnej `initiative_*`** (`Z40`).
- **Nie ruszasz `initiative.validators.ts:70`** — dług opisany, nie naprawiany.
- **Nie budujesz nowego magazynu „trzeciego"** — żadnej tabeli cache, żadnej
  materializowanej kopii wierszy inicjatyw.

---

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: KLIENT · TRASA · KONTROLER · SERWIS · REPOZYTORIUM

> **★★ ZASTRZEŻENIE.** Ta tabela **JEST** licencją. Jeżeli plik, którego
> potrzebujesz, jest opisany jako „PEŁNA/WĄSKA LICENCJA" — **masz pozwolenie
> i STOP z tytułu »nie wolno mi« jest NIEZASADNY**. Jeżeli pliku nie ma
> w tabeli w ogóle — domyślnie jest **TYLKO DO ODCZYTU**, a Twoim produktem
> jest czerwony kontrakt + brief wg wiersza 1, **nie zatrzymanie bloku**.

| Plik / wzorzec | Licencja | Co robisz, gdy etap wymagałby zmiany pliku TYLKO-DO-ODCZYTU |
| --- | --- | --- |
| `server/src/middleware/auth.middleware.ts`, `server/src/Gateway.ts`, `server/src/middleware/v8FeatureGate.middleware.ts`, `server/src/middleware/betaGate.middleware.ts`, `server/src/services/effectiveAccessService.ts` | **TYLKO ODCZYT — BEZWZGLĘDNIE** (`Z12`) | Produktem etapu staje się **CZERWONY KONTRAKT TESTOWY**: nowy plik testu, który **dziś PADA** i opisuje żądane zachowanie, oznaczony `it('KONTRAKT CODEX1 — …')` z nagłówkiem `// CZERWONY Z ZAŁOŻENIA — nie regresja tego bloku`. Do tego **brief w raporcie**: plik:linia · dlaczego nie da się w module · promień rażenia · jak wyglądałby dowód mutacyjny. **Etap z takim produktem jest ZROBIONY, nie STOP** |
| `server/src/middleware/pmoValidation.middleware.ts` | **TYLKO ODCZYT** (granica tenanta, poza zakresem) | Wpis do raportu: `:206` pyta bez `organization_id`, gotowy diff w bloku kodu, **nienałożony** |
| **`server/src/domain/initiatives-execution/initiativeUnifiedReader.ts` (NOWY PLIK)** | **★ PEŁNA LICENCJA** — rdzeń `E2` | — |
| **`server/src/domain/initiatives-execution/__tests__/*.pg.test.ts` (NOWE)** | **★ PEŁNA LICENCJA**, z zastrzeżeniem `Z18` i `Z31` | — |
| `server/src/domain/initiatives-execution/postgresInitiativeReader.ts` | **★ WĄSKA LICENCJA:** wyłącznie dodanie metod odczytu potrzebnych projekcji `E2`. **Zakaz zmiany istniejących metod i ich sygnatur** | Czerwony kontrakt + brief |
| `server/src/controllers/InitiativeController.ts` | **★ PEŁNA LICENCJA** w zakresie `E2`/`E4` — podmiana bramek istnienia na projekcję i przepięcie pisarzy | — |
| `server/src/routes/pmo/initiatives.routes.ts` | **★ PEŁNA LICENCJA** w zakresie `E4` | — |
| `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts` | **★ WĄSKA LICENCJA:** wyłącznie DODANIE brakujących komend kanonicznych wymaganych przez `E4`. **Zakaz zmiany istniejących komend, ich kształtu odpowiedzi i kodów błędów** | Czerwony kontrakt + brief |
| `server/src/middleware/executionSpineLegacyReadOnly.middleware.ts` | **★ WĄSKA LICENCJA:** wyłącznie lista `LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS` i komentarz przy niej. **Zakaz zmiany kodu odpowiedzi, kodu błędu i sygnatur funkcji** | Czerwony kontrakt + brief |
| `server/src/services/v8/planningPortfolioReadService.ts`, `server/src/routes/v8/results.routes.ts`, `server/src/routes/v8/execution-control.routes.ts`, `server/src/routes/v8/execution.routes.ts`, `server/src/routes/benefits.routes.ts`, `server/src/routes/my-work.routes.ts`, `server/src/services/initiativeGovernanceService.ts`, `server/src/services/initiative/initiativeKpiAssignmentService.ts`, `server/src/services/initiative/initiativeClosureService.ts`, `server/src/services/workCanvasService.ts`, `server/src/services/interviewEnterpriseService.ts`, `server/src/services/financialModelingService.ts`, `server/src/routes/v8/interview-insights.routes.ts`, `server/src/routes/v8/finance-value.routes.ts`, `server/src/routes/pmo/initiativeClosure.routes.ts`, `server/src/routes/initiatives-additive.routes.ts`, `server/src/controllers/DecisionController.ts` | **★ WĄSKA LICENCJA:** wyłącznie **podmiana bramki istnienia** `SELECT id FROM initiatives WHERE id = …` na wywołanie projekcji z `E2`. **Zakaz jakiejkolwiek innej zmiany w tych plikach** — diff ma pokazywać wyłącznie linie bramki | Czerwony kontrakt + brief |
| `src/services/initiativeWriteTruth.ts`, `src/services/initiatives-execution/runtimeApi.ts` | **★ WĄSKA LICENCJA:** wyłącznie przepięcie wołacza i obsługa nowego kodu odmowy. **Zakaz zmiany tekstów widocznych dla użytkownika poza plikami tłumaczeń** | Czerwony kontrakt + brief |
| `src/components/Initiatives/InitiativesHub.tsx`, `src/components/Initiatives/initiativeRegisterProjection.ts`, `src/components/Execution/ExecutionHub.tsx` | **★ WĄSKA LICENCJA + ZAMROŻONE (`§0.6`, znaczniki obowiązkowe):** wyłącznie **usunięcie klienckiego mostu** po tym, jak `E2` postawi projekcję na serwerze. **Zakaz zmiany JSX, klas, kolejności kolumn, etykiet** — diff ma dotyczyć wyłącznie warstwy pobierania danych | Czerwony kontrakt + brief; jeżeli usunięcie mostu zmieniłoby cokolwiek na ekranie — **zostawiasz most i piszesz STOP MERYTORYCZNY** |
| **`scripts/dane/migruj-inicjatywy-do-kanonu.ts` (NOWY)** | **★ PEŁNA LICENCJA** — rdzeń `E3` | — |
| `scripts/dane/usun-organizacje.ts` | **TYLKO ODCZYT — WZORZEC** | Kopiujesz z niego kształt: `--dry-run` / `--apply` / `--rollback=<manifest.json>` / `--verify`, dwa klucze do trybu zapisującego, manifest w `evidence/**`, `--oczekiwany-host 127.0.0.1`. **Nie zmieniasz w nim ani litery** |
| `server/migrations/20262130_*.sql` … `20262139_*.sql` (**NOWE**) | **★ PEŁNA LICENCJA** w przedziale **`20262130`–`20262139`**, wyłącznie addytywne (`Z40`) | — |
| `server/migrations/**` (wszystkie istniejące pliki) | **TYLKO ODCZYT — BEZWZGLĘDNIE** | Nowy plik w Twoim przedziale, nigdy edycja cudzego |
| `public/locales/pl/translation.json`, `public/locales/en/translation.json` | **★ WYŁĄCZNIE DOPISYWANIE KLUCZY**, parytet PL+EN w tym samym commicie. Zakaz zmiany istniejących wartości | — |
| `tests/**` (NOWE pliki), `server/src/**/__tests__/**` (NOWE pliki), `tests/e2e/**` (NOWE pliki) | **★ PEŁNA LICENCJA**, z zastrzeżeniem `Z18` i `Z31`. **Nowe pliki w `tests/` wymagają `git add -f`** | — |
| `tests/e2e/smoke/tier0-initiative-create.spec.ts` | **TYLKO ODCZYT — WZORZEC dla `E5`** | Piszesz własny plik obok, nie modyfikujesz tego |
| `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `playwright*.config.ts`, `tests/integration/_helpers/assertRealPostgres.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Produktem jest **opis w raporcie**: co w konfiguracji blokuje pomiar, jaka byłaby zmiana i **jak obszedłeś to zmiennymi w linii komendy** |
| `src/contracts/initiatives-execution/statusMapping.ts` | **TYLKO ODCZYT — ŹRÓDŁO SŁOWNIKA** | Jeżeli `E2` potrzebuje tego tłumaczenia po stronie serwera, **tworzysz NOWY plik serwerowy** i w raporcie jawnie piszesz, że powstał drugi egzemplarz słownika oraz co trzeba zrobić, żeby były jednym |
| `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md`, `docs/program/MVP_FINAL_ZAMROZONE.json` | **TYLKO ODCZYT** (`Z13`, `Z14`) | Errata w raporcie |
| `docs/program/PROGRAM_NAPRAWCZY_20260905/CODEX1_INICJATYWY/98_RAPORT.md` | **JEDYNY nowy dokument, jaki wolno Ci utworzyć** (`Z13`) | — |
| `server/src/_backup/**`, warianty `PRESERVED_PRODUCT_WIP` | **NIETYKALNE** (`Z4`) | Nie liczysz i nie zmieniasz |
| **Wszystko inne** | **TYLKO ODCZYT** | Opisujesz potrzebę w raporcie z dowodem plik:linia i idziesz dalej |

**★ Uwaga do wiersza „WĄSKA LICENCJA na podmianę bramek".** Zanim zmienisz
sygnaturę czegokolwiek wspólnego, sprawdź, czy **typ** przez ten plik przepływa:

```bash
grep -rln "initiativeUnifiedReader" server/src | grep -v __tests__
```

Każdy znaleziony konsument albo wchodzi do licencji, albo zmiana typu jest
niewykonalna i trzeba ją zaprojektować inaczej.

---

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda (odtwarzalna, jedna linia) | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | bramki istnienia pytające tylko magazyn zastany | **50** | `grep -rn "SELECT id FROM initiatives WHERE id" server/src \| grep -v __tests__ \| wc -l` | TAK — wzorzec dosłowny, występuje w obu stylach parametrów (`?` i `$1`) |
| 2 | pliki z tymi bramkami | **19** | `grep -rn "SELECT id FROM initiatives WHERE id" server/src \| grep -v __tests__ \| cut -d: -f1 \| sort -u \| wc -l` | TAK |
| 3 | pliki serwera dotykające tabeli zastanej w ogóle | **161** | `grep -rln "FROM initiatives\|INSERT INTO initiatives\|UPDATE initiatives\|DELETE FROM initiatives" server/src \| grep -v __tests__ \| wc -l` | TAK — **pamiętaj o `Z4`: `server/src/_backup/**` odejmujesz** |
| 4 | agregaty `initiative` w kopii stagingu | **29** | `docker exec … -Atc "SELECT count(*) FROM ie_aggregate_state WHERE aggregate_type='initiative'"` | TAK |
| 5 | wiersze w tabeli zastanej | **713** | `docker exec … -Atc "SELECT count(*) FROM initiatives"` | TAK |
| 6 | agregaty bez wiersza zastanego | **15** | zapytanie z sekcji „STAN ZMIERZONY (a)" | TAK |
| 7 | wiersze zastane bez agregatu | **699** | zapytanie z sekcji „STAN ZMIERZONY (a)" | TAK |
| 8 | organizacje w tabeli zastanej / w kanonie | **29 / 2** | `docker exec … -Atc "SELECT count(DISTINCT organization_id) FROM initiatives"` oraz to samo na `ie_aggregate_state WHERE aggregate_type='initiative'` | TAK — **to jest liczba, która decyduje o kolejności `E3` przed `E4`** |
| 9 | wiersze zastane bez `project_id` | **78** | `docker exec … -Atc "SELECT count(*) FROM initiatives WHERE project_id IS NULL"` | TAK — kanon **wymaga** `projectId` (`initiativeWriteTruth.ts:186`) |
| 10 | wiersze zastane bez `owner_business_id` | **104** | `docker exec … -Atc "SELECT count(*) FROM initiatives WHERE owner_business_id IS NULL"` | TAK — kanon **wymaga** `initiativeOwnerId` |
| 11 | kamienie milowe w magazynie zastanym | **1070** | `docker exec … -Atc "SELECT count(*) FROM initiative_milestones"` | TAK |
| 12 | powierzchnie w `src/` wołające `createInitiativeWriteTruth` | **4** | `grep -rn "createInitiativeWriteTruth" src/ \| grep -v __tests__ \| grep -v "^src/services/initiativeWriteTruth.ts" \| grep -c "await\|import"` | TAK — sprawdź listę imiennie, nie tylko liczbę |
| 13 | wolne numery migracji w MOIM przedziale | **10** (`20262130`–`20262139`) | `ls server/migrations \| grep -cE "^2026213[0-9]"` → oczekiwane `0` zajętych | **TAK — sprawdź to osobno, to jest najczęstszy błąd wydania instrukcji** |
| 14 | najwyższy zajęty numer migracji | **20262107** | `ls server/migrations \| grep -oE "^[0-9]{8}" \| sort -u \| tail -1` | TAK |
| 15 | realne `.catch(() => {})` w Inicjatywach i Realizacji | **0** | `grep -rn "catch(() => {})" src/components/Initiatives src/components/Execution \| grep -v __tests__` (zostają same komentarze) | TAK |

**Reguła kontrolna:** komenda, której sam nie uruchomiłeś, nie wchodzi do raportu.
Rozbieżność z moją liczbą **nie jest sprzecznością — jest WYNIKIEM** (`§A.8` pkt 6).

---

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego bloku

### Pliki zapisywane NA PEWNO

| # | Plik | Rodzaj | Etap | Ryzyko kolizji |
| --- | --- | --- | --- | --- |
| 1 | `server/src/domain/initiatives-execution/initiativeUnifiedReader.ts` | **NOWY** | `E2` | ZEROWE |
| 2 | `server/src/controllers/InitiativeController.ts` | istniejący | `E2`, `E4` | **★★ WYSOKIE** — plik zmieniany 10.09 przez trzy różne naprawy; commituj małymi krokami |
| 3 | `server/src/routes/pmo/initiatives.routes.ts` | istniejący | `E4` | ŚREDNIE |
| 4 | `server/src/middleware/executionSpineLegacyReadOnly.middleware.ts` | istniejący | `E4` | ŚREDNIE |
| 5 | `scripts/dane/migruj-inicjatywy-do-kanonu.ts` | **NOWY** | `E3` | ZEROWE |
| 6 | `server/migrations/20262130_*.sql` | **NOWY** | `E3` | ZEROWE (przedział wyłączny) |
| 7 | `docs/program/PROGRAM_NAPRAWCZY_20260905/CODEX1_INICJATYWY/98_RAPORT.md` | **NOWY** | `E6` | ZEROWE |
| 8 | nowe pliki testowe (`__tests__`, `tests/e2e`) | **NOWE** | `E1`, `E5` | ZEROWE |

### Pliki zapisywane WARUNKOWO

| Plik | Etap | Warunek, po którego spełnieniu wolno zapisać |
| --- | --- | --- |
| 17 plików z bramkami istnienia (lista w tabeli licencji) | `E2` | **dopiero po** zielonym dowodzie mutacyjnym projekcji z `E2` na realnym Postgresie |
| `src/components/Initiatives/InitiativesHub.tsx`, `initiativeRegisterProjection.ts` | `E2` | **dopiero po** tym, jak `GET /api/initiatives` zwróci komplet (kanon + zastane) — udowodnione HTTP-em, nie gerpem |
| `src/components/Execution/ExecutionHub.tsx` | `E4` | tylko jeżeli przepięcie wołacza jest konieczne; **jeżeli nie jest — nie dotykasz** |
| `public/locales/{pl,en}/translation.json` | `E4` | tylko dla NOWEGO klucza komunikatu odmowy; parytet PL+EN w tym samym commicie |

### Pliki, których ten blok JAWNIE NIE ZAPISZE — imiennie

```
server/src/middleware/auth.middleware.ts
server/src/Gateway.ts
server/src/middleware/v8FeatureGate.middleware.ts
server/src/middleware/betaGate.middleware.ts
server/src/middleware/pmoValidation.middleware.ts
server/src/services/effectiveAccessService.ts
server/src/validators/initiative.validators.ts
server/src/_backup/**
scripts/dane/usun-organizacje.ts
tests/setup.ts, tests/helpers/**, tests/__mocks__/**
vitest*.config.ts, server/vitest.config*.ts, playwright*.config.ts
docs/program/MVP_FINAL_ZAMROZONE.json
docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
src/components/standard/**   (kanon UI list — ten blok nie dotyka wyglądu)
```

### Zasoby wyłączne tego bloku

| Zasób | Wartość | Sprawdzone (komenda) |
| --- | --- | --- |
| Port PostgreSQL | `6451` | `lsof -nP -iTCP -sTCP:LISTEN \| grep :6451` → pusto |
| Port harnessu | `5591` | `lsof -nP -iTCP -sTCP:LISTEN \| grep :5591` → pusto |
| Nazwa kontenera | `cx-codex1-inicjatywy-pg` | `docker ps -a --format '{{.Names}}' \| grep cx-codex1` → pusto |
| Nazwa bazy | `cx_codex1_inicjatywy` | — |
| **Przedział migracji** | **`20262130`–`20262139`** | `ls server/migrations \| grep -cE "^2026213[0-9]"` → `0` |
| Gałąź | `codex/inicjatywy-jeden-magazyn-20260910` | nie istnieje w vaulcie |
| Worktree | `/Users/piotrwisniewski/Developer/codex-wt/codex1-inicjatywy` | nie istnieje |
| Flaga funkcyjna | `ENABLE_INITIATIVE_UNIFIED_READ` — **default OFF** | `grep -rn "ENABLE_INITIATIVE_UNIFIED_READ" src server` → 0 trafień |

### Kontrola przed KAŻDYM commitem

```bash
cd /Users/piotrwisniewski/Developer/codex-wt/codex1-inicjatywy
git diff --name-only --cached | tee /Users/piotrwisniewski/Developer/codex-wt/codex1-artefakty/staged.txt
grep -iE 'auth\.middleware|Gateway\.ts|pmoValidation|vitest.*config|playwright.*config|tests/setup|_backup/|MVP_FINAL_ZAMROZONE|OWNER_DECISION_LEDGER|components/standard/' \
  /Users/piotrwisniewski/Developer/codex-wt/codex1-artefakty/staged.txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

# ETAPY

**Jeden etap = jeden commit = jeden werdykt.** Każdy commit niesie oba znaczniki
odmrożenia (`§0.6`). Rdzeń to `E1`, `E2`, `E4`, `E6` — jeżeli zabraknie czasu,
`E3` i `E5` opisujesz uczciwie jako niezrobione, **nigdy odwrotnie**.

| Etap | Nazwa | Rdzeń? | Wymaga plików przekrojowych? | DoD podniesione | Komunikat commita |
| --- | --- | --- | --- | --- | --- |
| `E1` | inwentarz + test charakteryzujący dzisiejszy rozjazd (CZERWONY) | **TAK** | NIE — dowód: cała praca w `__tests__` i `docs/**` | min. 6 nowych testów | `test(inicjatywy): test charakteryzujacy dwa magazyny (E1) [ODMROZENIE 05_INITIATIVES DEC-453] [ODMROZENIE 06_EXECUTION DEC-453]` |
| `E2` | kanon + projekcja serwerowa dla zastanych czytelników | **TAK** | NIE — dowód: `grep -rn "initiativeUnifiedReader" server/src/middleware server/src/Gateway.ts` → 0 | min. 10 | `feat(inicjatywy): jedna projekcja serwerowa nad dwoma magazynami (E2) [ODMROZENIE …]` |
| `E3` | migracja danych zastanych do kanonu (dry-run + manifest + rollback) | NIE | NIE | min. 6 | `feat(dane): migracja inicjatyw zastanych do kanonu, tryb suchy i przywracanie (E3) [ODMROZENIE …]` |
| `E4` | przepięcie pisarzy; legacy `409` po polsku tylko z realnym następcą | **TAK** | NIE | min. 8 | `feat(inicjatywy): jeden pisarz kanoniczny, odmowa po polsku (E4) [ODMROZENIE …]` |
| `E5` | test end-to-end „nowy rekord widać wszędzie" + testy mutacyjne | NIE | NIE | min. 7 | `test(inicjatywy): nowy rekord z UI widoczny na siedmiu powierzchniach (E5) [ODMROZENIE …]` |
| `E6` | raport | **TAK** | NIE | n/d | `docs(codex1): raport bloku jeden magazyn inicjatyw (E6) [ODMROZENIE …]` |

> **Kolumna „Wymaga plików przekrojowych?" jest wypełniona dla KAŻDEGO etapu,
> z dowodem przy odpowiedzi `NIE`. Żaden etap nie odpowiada `TAK` — to warunek
> wydania tej instrukcji. Jeżeli w trakcie odkryjesz, że etap jednak wymaga
> pliku przekrojowego, dostarczasz czerwony kontrakt + brief i etap jest
> ZROBIONY (`§0.5`).**

---

## E1 — INWENTARZ I TEST CHARAKTERYZUJĄCY DZISIEJSZY STAN (rdzeń)

**Cel:** zamienić opis z sekcji „STAN ZMIERZONY" w **wykonywalny, czerwony
dowód**. Po `E1` nikt już nie musi wierzyć na słowo, że rozjazd istnieje.

**Co robisz:**

1. **Inwentarz maszynowy.** Skrypt jednorazowy w
   `/Users/piotrwisniewski/Developer/codex-wt/codex1-artefakty/inwentarz.sh`
   (**poza repo**, `Z13`), który zapisuje do artefaktów:
   - listę wszystkich 50 bramek istnienia w formacie `plik:linia`;
   - listę wszystkich pisarzy zastanych (`INSERT/UPDATE/DELETE` na `initiatives`);
   - listę wszystkich wołaczy w `src/` z podziałem: woła kanon / woła zastane / woła oba.
   **Grep bez `| head`** (`§0.2d` pkt 12) i bez `--include` w `zsh` (pkt 18).
2. **Test charakteryzujący, CZERWONY na sygnale 1.** Nowy plik
   `server/src/domain/initiatives-execution/__tests__/dwaMagazynyRozjazd.pg.test.ts`.
   Przebieg testu, na realnym Postgresie, przez realny `ApiGateway` (`Z22`):
   - utwórz inicjatywę **tą samą drogą co UI** —
     `POST /api/initiatives/runtime-v1/registrations` (kształt ładunku
     odczytaj z `initiativeWriteTruth.ts:246-270`, nie zgaduj);
   - `GET /api/initiatives/runtime-v1/initiatives` → rekord **JEST**;
   - `GET /api/initiatives` → rekord **NIE MA GO** ← **to jest asercja czerwona
     po naprawie z `E2`, a dziś zielona**;
   - `SELECT count(*) FROM initiatives WHERE id = <id>` → **0**;
   - `GET /api/initiatives/:id` → **404**;
   - `GET /api/initiatives/:id/kpis` → sprawdź kod (bramka
     `InitiativeController.ts:3482`);
   - `GET /api/initiatives/:id/milestones` → **200** (bo `3ab51dfb3e` już to
     załatało — to jedyna z pięćdziesięciu).

   **Test ma być napisany tak, żeby po `E2` odwrócić TYLKO oczekiwane wartości,
   nie strukturę.** Oznacz go w nazwie: `it('CHARAKTERYSTYKA PRZED E2 — …')`.
3. **Pomiar zasięgu `§0.4a`** — `przed-nazwy.txt` powstaje TU, przed
   jakąkolwiek zmianą produktu.

**Definicja ukończenia (mierzalna):**
- plik testu istnieje, **przechodzi na zielono opisując DZISIEJSZY, zły stan**
  (charakterystyka, nie życzenie);
- raport zawiera wszystkie 15 liczb z tabeli mianowników **zmierzonych przez
  Ciebie**, obok moich, z komendą przy każdej;
- artefakty zawierają trzy listy z punktu 1 wraz z `shasum -a 256`.

**Komenda dowodowa:**
```bash
cd /Users/piotrwisniewski/Developer/codex-wt/codex1-inicjatywy && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6451/cx_codex1_inicjatywy \
JWT_SECRET=codex1-inicjatywy-lokalny-sekret-testowy \
npx vitest run --config server/vitest.config.ts \
  server/src/domain/initiatives-execution/__tests__/dwaMagazynyRozjazd.pg.test.ts \
  --retry=0 --reporter=json \
  --outputFile=/Users/piotrwisniewski/Developer/codex-wt/codex1-artefakty/e1.json
```

**Możliwe STOP-y w `E1`:**
- **kształt ładunku `registrations` nie zgadza się z tym, co czyta serwer** —
  wtedy STOP MERYTORYCZNY z wypisanym schematem walidacji z
  `initiativesExecutionRuntime.routes.ts` i pytaniem, które pole jest wiążące;
- **agregat powstaje, ale `GET runtime-v1/initiatives` go nie zwraca** — to
  byłaby awaria samego kanonu, poważniejsza niż cały ten blok. STOP z dowodem
  SQL (`SELECT * FROM ie_aggregate_state WHERE aggregate_id = …`).

---

## E2 — DECYZJA KANONU I PROJEKCJA DLA ZASTANYCH CZYTELNIKÓW (rdzeń)

**Decyzja architektoniczna, którą wykonujesz (nie podejmujesz):**
**kanonem jest runtime-v1 (`ie_aggregate_state`).** Uzasadnienie: to jedyny
magazyn z wersjonowaniem (`version`), pokwitowaniami komend
(`ie_command_receipts` 341), audytem (`ie_audit_events` 341) i outboxem — czyli
jedyny, w którym da się udowodnić, kto i kiedy zmienił rekord. Tabela zastana
takich gwarancji nie ma i nigdy nie będzie miała.

**★★ ALE: kanon obsługuje dziś 2 organizacje z 29.** Dlatego `E2` **NIE
przełącza czytelników na kanon**. `E2` stawia **projekcję, która widzi OBA
magazyny i zwraca jeden wynik** — z kanonem jako źródłem rozstrzygającym przy
kolizji identyfikatora.

**Co budujesz — jeden nowy plik, jedna odpowiedzialność:**

`server/src/domain/initiatives-execution/initiativeUnifiedReader.ts`

Minimalny kontrakt (nazwy dobierz sam, kształt jest wiążący):

| Funkcja | Co zwraca | Reguła |
| --- | --- | --- |
| `initiativeExists(orgId, initiativeId)` | `boolean` | `true`, jeżeli rekord jest **w którymkolwiek** magazynie, zawsze zawężone do `organization_id` |
| `readInitiativeHeader(orgId, initiativeId)` | wspólny, wąski kształt: `{ id, title, lifecycleState, projectId, ownerId, source: 'CANONICAL' \| 'LEGACY' }` albo `null` | Przy kolizji `id` **wygrywa kanon**; pole `source` jest obowiązkowe i idzie do logów, nie na ekran |
| `listInitiativeHeaders(orgId, filtry)` | lista powyższych | Suma obu magazynów, deduplikacja po `id`, **rekord niemapowalny NIE ZNIKA — jest liczony i wypisany** (`Z23`) |

**Twarde reguły `E2`:**

1. **Zero duplikowania tabel.** Projekcja **czyta** oba magazyny w locie. Zakaz
   tworzenia tabeli cache, tabeli mostu, kolumny-kopii i widoku
   materializowanego. Zwykły `VIEW` SQL jest dopuszczalny **tylko** jeśli
   udowodnisz, że nie da się tego zrobić w serwisie — i wtedy wchodzi jako
   NOWA migracja w Twoim przedziale.
2. **Tłumaczenie słowników stanów.** Front ma to w
   `src/contracts/initiatives-execution/statusMapping.ts:51` (`mapInitiativeStatus`,
   kierunki `legacy-to-runtime` i odwrotny). **Serwer nie ma odpowiednika.**
   Tworzysz go po stronie serwera i **jawnie piszesz w raporcie, że powstał
   drugi egzemplarz słownika** oraz co trzeba zrobić, żeby był jeden (to jest
   dług, nie sukces).
   **★ Pamiętaj o przecieku zmierzonym w `§0.2d` pkt 21:** w kanonie już siedzi
   `lifecycleState = EXECUTING`, czyli słowo ze słownika zastanego. Twoje
   tłumaczenie ma to **obsłużyć i policzyć**, nie wywalić się na tym.
3. **Granica tenanta bez zmian.** Każde zapytanie w projekcji ma
   `organization_id` w `WHERE`. Cudza inicjatywa dalej daje `404`. **To jest
   asercja testowa, nie deklaracja.**
4. **Flaga `ENABLE_INITIATIVE_UNIFIED_READ`, domyślnie `OFF`** (`Z10`).
   Przy `OFF` każdy podmieniony czytelnik zachowuje się **dokładnie jak dziś**
   (pyta tylko magazyn zastany). Przy `ON` pyta projekcję. **Domyślnej nie
   zmieniasz** — włączy ją nadzorca po odbiorze.
5. **Podmiana bramek — kolejność wiążąca.** Najpierw `InitiativeController.ts`
   (10 bramek), potem `v8/results.routes.ts` (11), potem reszta. Po każdym
   pliku: commit + przebieg testów. **Diff w plikach z wąską licencją ma
   dotykać WYŁĄCZNIE linii bramki.**
6. **Zdejmujesz kliencki most** (`mergeLegacyInitiativesIntoRegister`)
   **dopiero wtedy**, gdy `GET /api/initiatives` przy fladze `ON` zwraca komplet
   — udowodnione żądaniem HTTP, nie gerpem (`Z34`). **Jeżeli zdjęcie mostu
   zmieniłoby cokolwiek na ekranie — zostawiasz most i piszesz STOP.**

**Definicja ukończenia (mierzalna):**
- test z `E1` przy fladze `ON` ma **odwrócone** wyniki: `GET /api/initiatives`
  zwraca rekord kanoniczny, `GET /api/initiatives/:id` → `200`, `:id/kpis` → nie `404`;
- przy fladze `OFF` test z `E1` przechodzi **bez zmian** (brak regresji dla dzisiejszego zachowania);
- `grep -rn "SELECT id FROM initiatives WHERE id" server/src | grep -v __tests__ | wc -l`
  spada z **50** do liczby, którą wypisujesz imiennie, z listą pozostałych
  i powodem, dlaczego zostały;
- **dowód mutacyjny (`Z32`)**: psujesz jedną linię w `initiativeUnifiedReader.ts`
  (np. usuwasz gałąź kanoniczną) → test CZERWONY; cofasz przez `cp` → ZIELONY;
  `git diff` pusty. Obie komendy i oba wyniki w raporcie;
- **dowód izolacji tenanta**: żądanie z tokenem organizacji B o inicjatywę
  organizacji A → `404` przy fladze `ON` i przy `OFF`, `--retry=0` (`Z29`).

**Możliwe STOP-y w `E2`:**
- **kształty rekordu są nieuzgadnialne** — np. zastany wiersz nie ma
  odpowiednika `lifecycleState`, a mapowanie byłoby zgadywaniem. Wtedy STOP
  MERYTORYCZNY z tabelą „pole zastane → pole kanoniczne → czy da się wyliczyć";
- **projekcja wywraca wydajność** — jeżeli `listInitiativeHeaders` na 713
  wierszach przekracza 300 ms, STOP z pomiarem, propozycją indeksu jako
  NOWA migracja i pytaniem do nadzorcy;
- **konsument, którego licencja nie obejmuje** — czerwony kontrakt + brief.

---

## E3 — MIGRACJA DANYCH ZASTANYCH DO KANONU

**★★ NAJNIEBEZPIECZNIEJSZY ETAP CAŁEGO BLOKU. Przeczytaj `Z40` jeszcze raz.**

**Cel:** dla każdego z **699** wierszy zastanych bez agregatu utworzyć agregat
kanoniczny — **bez kasowania czegokolwiek**, idempotentnie, z manifestem
i przywracaniem.

**Wzorzec, który kopiujesz co do kształtu:** `scripts/dane/usun-organizacje.ts`
(1509 linii, TYLKO ODCZYT). Bierzesz z niego: `--dry-run` / `--apply` /
`--rollback=<manifest.json>` / `--verify`, **dwa klucze** do trybu zapisującego
(flaga + zmienna środowiskowa), `--oczekiwany-host 127.0.0.1`, manifest z datą
w nazwie, katalog `--manifest-dir`.

**Twój skrypt:** `scripts/dane/migruj-inicjatywy-do-kanonu.ts`

**Tryby (wszystkie obowiązkowe):**

| Tryb | Co robi | Warunek uruchomienia |
| --- | --- | --- |
| `--dry-run` | **DOMYŚLNY.** Liczy i wypisuje: ile wierszy kwalifikuje się, ile odpada i z jakiego powodu, jak wyglądałby agregat dla trzech przykładów | zawsze |
| `--apply` | Tworzy agregaty | flaga `--apply` **oraz** `MIGRACJA_INICJATYW_APPLY=true` **oraz** `--oczekiwany-host 127.0.0.1` |
| `--rollback=<manifest>` | Kasuje **wyłącznie** agregaty wypisane w manifeście, po `aggregate_id` | ścieżka do manifestu |
| `--verify` | Porównuje stan bazy z manifestem i wypisuje rozjazd | zawsze |

**Twarde reguły `E3`:**

1. **Wyłącznie addytywnie.** Zero `DELETE`, `DROP`, `TRUNCATE`, `RENAME` na
   danych zastanych. Migracja **nie zmienia ani jednego wiersza w `initiatives`**
   — dopisuje wiersze w `ie_aggregate_state` (i tam, gdzie kanon tego wymaga,
   w `ie_aggregate_relations`).
2. **Idempotencja jest asercją, nie deklaracją.** Drugi przebieg `--apply`
   ma dopisać **zero** nowych agregatów i zakończyć się bezbłędnie.
   **To jest osobny test.**
3. **★★ Rekordy niekwalifikowalne NIE SĄ zgadywane.** Pomiar:
   **78 wierszy nie ma `project_id`**, **104 nie mają `owner_business_id`**,
   a kanon **wymaga obu** (`initiativeWriteTruth.ts:186`:
   „Canonical initiative creation requires projectId and initiativeOwnerId").
   **Nie wymyślasz wartości domyślnych.** Takie wiersze:
   - **odpadają z migracji**,
   - **trafiają do manifestu jako `POMINIETE` z powodem**,
   - **są policzone w raporcie**,
   - i są **pytaniem do właściciela** w sekcji raportu „DO DECYZJI WŁAŚCICIELA",
     ze zdaniem „czego konkretnie mi zabrakło, żeby rozstrzygnąć samodzielnie".
4. **Manifest jest jedynym źródłem prawdy dla przywracania.** Zawiera:
   datę, SHA kodu, nazwę bazy, host, listę `aggregate_id` UTWORZONYCH, listę
   `POMINIETE` z powodami, liczby przed i po. Leży w artefaktach
   (`Z13`), a raport podaje ścieżkę i `shasum -a 256`.
   **★ Dowód poza repo wyparowuje** — dlatego w raporcie ma być `ls -l` manifestu
   z datą, nie samo zdanie „manifest powstał".
5. **Zero drenaży outboxu** (`Z30`, `§0.2b` pkt 3). Po `--apply` sprawdzasz, że
   `ie_outbox_delivery_receipts` ma 0 wierszy.
6. **Migracja SQL (jeżeli w ogóle potrzebna)** — wyłącznie NOWY plik
   w `20262130`–`20262139`, wyłącznie addytywny (indeks, kolumna-znacznik).
   **Nie edytujesz żadnego istniejącego pliku migracji** (`Z40`).
   **★ Uwaga na kolejność alfabetyczną:** migracja czytająca kolumnę, którą
   dodaje migracja o wyższym numerze, wywraca cały łańcuch na świeżej bazie.
   Dowodem idempotencji jest **dwukrotny pełny przebieg `migrate.postgres.ts`
   na PUSTEJ bazie**, nie na Twojej używanej.

**Definicja ukończenia (mierzalna):**
- `--dry-run` na kopii danych wypisuje liczby, które **sumują się do 699**
  (kwalifikowalne + pominięte);
- `--apply` uruchomiony dwa razy: pierwszy tworzy N agregatów, drugi tworzy **0**;
- po `--apply`: `SELECT count(*) FROM initiatives i WHERE NOT EXISTS (…)` spada
  z **699** do liczby pominiętych — i ta liczba zgadza się z manifestem;
- `--rollback=<manifest>` przywraca stan **co do wiersza**: liczby przed
  migracją i po przywróceniu są identyczne, a `--verify` to potwierdza;
- **żaden wiersz w `initiatives` się nie zmienił** — dowód:
  `SELECT md5(string_agg(id || coalesce(status,'') || coalesce(updated_at::text,''), '|' ORDER BY id)) FROM initiatives`
  przed i po ma tę samą wartość;
- `ie_outbox_delivery_receipts` = 0.

**Możliwe STOP-y w `E3`:**
- **liczba pominiętych przekracza 30% zbioru** — to nie jest migracja, tylko
  decyzja produktowa. STOP MERYTORYCZNY, manifest jako załącznik, pytanie
  do właściciela;
- **kanon odrzuca agregat z powodu reguły domenowej, której nie da się spełnić
  danymi zastanymi** — STOP z nazwą reguły i przykładem;
- **rollback nie odtwarza stanu co do wiersza** — **STOP CAŁEGO ETAPU
  i NIE COMMITUJESZ trybu `--apply`.** Skrypt bez działającego przywracania
  jest gorszy niż brak skryptu.

---

## E4 — PRZEPIĘCIE PISARZY (rdzeń)

**Cel:** jeden pisarz. Wszystkie `POST`/`PUT`/`PATCH`/`DELETE` dotyczące
inicjatywy wchodzą przez runtime-v1; trasy zastane odpowiadają `409`.

**★★ REGUŁA, KTÓRA JEST WAŻNIEJSZA NIŻ SAM CEL** (wpisana krwią 07.09,
komentarz w `executionSpineLegacyReadOnly.middleware.ts`, sekcja „ZAWEZENIE
07.09 (DEC-453)"):

> **Ścieżkę wolno wycofać WYŁĄCZNIE wtedy, gdy istnieje kanoniczna komenda
> runtime-v1 pisząca do TEGO SAMEGO modelu odczytu, który czyta ekran — albo
> gdy nikt tej ścieżki nie woła.**

Poprzednim razem wycofano ścieżki bez następcy. Skutek: „Dodaj element"
w RAID, kamieniach milowych, zasobach, planach obsady, pozycjach budżetu
i rolach bram odpowiadało `409`, **nic się nie działo**, a właściciel cofnął
odbiór dwóch modułów. **Nie powtarzasz tego.**

**Procedura na KAŻDĄ ścieżkę zapisu — cztery pytania, wszystkie z dowodem:**

| # | Pytanie | Dowód |
| --- | --- | --- |
| 1 | Czy ktoś ją woła z `src/`? | `grep -rn "<fragment ścieżki>" src/ \| grep -v __tests__` — **bez `\| head`** |
| 2 | Czy istnieje komenda kanoniczna robiąca to samo? | `plik:linia` w `initiativesExecutionRuntime.routes.ts` |
| 3 | Czy ta komenda pisze do **tego samego** modelu odczytu, który czyta ekran? | test na realnym Postgresie: zapis komendą kanoniczną → odczyt trasą, którą woła ekran → **rekord widoczny** |
| 4 | Czy odmowa dociera do człowieka po polsku? | żądanie HTTP + tekst z `public/locales/pl` |

**Rozstrzygnięcie zależnie od odpowiedzi:**

- **1=NIE** → ścieżka martwa, wolno wycofać. Wpisz do raportu, że jest martwa.
- **1=TAK, 2=NIE** → **NIE WYCOFUJESZ.** Wpisujesz do raportu jako „brakujący
  następca kanoniczny" z propozycją kształtu komendy.
- **1=TAK, 2=TAK, 3=NIE** → **NIE WYCOFUJESZ.** To jest dokładnie pułapka
  z 07.09: komenda istnieje, ale pisze gdzie indziej niż czyta ekran.
- **1=TAK, 2=TAK, 3=TAK** → **wycofujesz**: dopisujesz wzorzec do
  `LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS` i dodajesz test.

**Sześć ścieżek przywróconych 07.09 to Twoja lista robocza:**
`milestones` · `resources` · `staffing-plans` · `budget-items` · `gate-roles` · `move`.
Dla każdej przechodzisz cztery pytania i **wypisujesz odpowiedzi w raporcie**.
Jeżeli dla którejś zbudujesz brakującą komendę kanoniczną — masz na to
**wąską licencję** w `initiativesExecutionRuntime.routes.ts` (tylko DODANIE).

**Komunikat odmowy po polsku:**
- serwer niesie **wyłącznie kod i status** (dziś:
  `EXECUTION_RUNTIME_V1_WRITE_REQUIRED`), tekst siedzi w `public/locales`;
- lejek tłumaczący kod na zdanie już istnieje:
  `src/services/initiativeWriteTruth.ts` (funkcja opisująca odmowę, dodana
  commitem `4e53db522f` z 10.09) — **dopisujesz do niego kod, nie budujesz
  drugiego lejka**;
- **zakaz `.catch(() => {})`** w każdej ścieżce zapisu, którą dotykasz.
  **Pomiar dziś: 0 realnych wystąpień w `src/components/Initiatives`
  i `src/components/Execution`** (zostały same komentarze o zakazie) — więc
  to jest zakaz dodawania nowych, nie zadanie sprzątania starych.

**Definicja ukończenia (mierzalna):**
- tabela w raporcie: **każda** ścieżka zapisu inicjatywy × cztery odpowiedzi
  × werdykt (wycofana / zostaje / brak następcy);
- dla każdej **wycofanej** ścieżki test na realnym Postgresie:
  `409` z `code: 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED'` **oraz** dowód, że
  komenda kanoniczna robi to samo i **rekord jest widoczny w tym samym
  czytniku** (`Z21` — pełna ścieżka osiągalności);
- **rozróżnienie źródła `409`** (`§0.2e` pułapka (e)): test pokazuje, że `409`
  wychodzi z middleware, a nie z braku handlera — asercja na polu `code`
  i na `canonicalWriter`;
- żądanie HTTP w języku `pl` zwraca kod, a front pokazuje zdanie po polsku —
  test jednostkowy lejka + wpis w `pl` i `en` (parytet, ten sam commit);
- `--retry=0` w każdej komendzie testowej (`Z29`).

**Możliwe STOP-y w `E4`:**
- **komenda kanoniczna istnieje, ale ma inny kształt danych niż trasa zastana**
  (np. nie przyjmuje pola, które ekran wysyła) — STOP MERYTORYCZNY z tabelą
  pól i propozycją;
- **ekran woła trasę zastaną z miejsca, którego licencja nie obejmuje**
  (plik zamrożony, którego zmiana ruszyłaby wygląd) — czerwony kontrakt + brief;
- **wycofanie ścieżki zmieniłoby zachowanie widoczne dla użytkownika** —
  nie wycofujesz, piszesz STOP.

---

## E5 — TEST END-TO-END „NOWY REKORD Z UI WIDAĆ WSZĘDZIE"

**Cel:** jeden przebieg, który przechodzi przez **siedem** powierzchni i nie da
się go oszukać.

**Wzorzec (TYLKO ODCZYT):** `tests/e2e/smoke/tier0-initiative-create.spec.ts`.
Piszesz **nowy plik obok**, nie modyfikujesz tamtego.

**Scenariusz — kolejność wiążąca:**

1. Zalogowany użytkownik tworzy inicjatywę **przyciskiem w UI** (nie żądaniem
   HTTP — to jest cały sens: chodzi o drogę, którą idzie właściciel).
2. Zapamiętujesz `id` z odpowiedzi.
3. **Siedem sprawdzeń, każde osobną asercją:**

| # | Powierzchnia | Sprawdzenie | Warstwa dowodu |
| --- | --- | --- | --- |
| 1 | Rejestr inicjatyw | rekord na liście | Playwright (widok) |
| 2 | Podgląd / karta | `GET /api/initiatives/:id` → `200`, tytuł się zgadza | HTTP |
| 3 | `GET /api/initiatives` | rekord w kopercie | HTTP |
| 4 | Kokpit Realizacji | rekord osiągalny (lista albo powiązana sprawa) | HTTP + widok |
| 5 | Moja Praca | rekord osiągalny | HTTP |
| 6 | Wyniki | `GET` KPI dla `:id` **nie zwraca `404 INITIATIVE_NOT_FOUND`** | HTTP, **z `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`** |
| 7 | Raporty | generator raportu widzi rekord | HTTP |

4. **Warstwa SQL — obowiązkowa, bo HTTP potrafi kłamać kopertą:**
```sql
SELECT
  (SELECT count(*) FROM ie_aggregate_state WHERE aggregate_type='initiative' AND aggregate_id = :id) AS kanon,
  (SELECT count(*) FROM initiatives WHERE id = :id) AS zastany;
```
   Wynik wpisujesz do raportu. **Nie zakładasz, jaki ma być** — po `E2`
   projekcja może sprawić, że `zastany` = 0 i to jest w porządku, o ile
   wszystkie siedem sprawdzeń przeszło. **Ważne jest, żeby liczba była
   ZMIERZONA i OPISANA, nie żeby wyszła konkretna.**

**Testy mutacyjne bezpieczników (`Z32`) — trzy, każdy w obie strony:**

| Mutacja | Oczekiwanie |
| --- | --- |
| usuwasz gałąź kanoniczną w `initiativeUnifiedReader` | sprawdzenia 2, 3, 6 CZERWONE |
| usuwasz `organization_id` z jednego zapytania projekcji | test izolacji tenanta CZERWONY |
| usuwasz wzorzec z `LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS` | test `409` z `E4` CZERWONY |

Po każdej: cofasz przez `cp` (`Z27`), test ZIELONY, `git diff` **pusty**.
**Obie komendy i oba wyniki dosłownie w raporcie.**

**Definicja ukończenia:**
- siedem sprawdzeń zielonych w jednym przebiegu, `--retry=0`;
- zapytanie SQL wykonane i wynik w raporcie;
- trzy dowody mutacyjne w obie strony, z komendami;
- akapit `§0.2e`: która z pułapek (a)–(e) dotyczy tego pakietu i jak ją wyłączyłeś;
- `§0.4a`: `diff przed-nazwy.txt po-nazwy.txt` z listą nazw DODANYCH i ZNIKNIĘTYCH.

**Możliwe STOP-y w `E5`:**
- **Playwright nie wstaje na tej maszynie** — STOP MERYTORYCZNY, ale
  **sprawdzenia 2–7 robisz żądaniami HTTP przez realny `ApiGateway`**
  i etap jest ZROBIONY z adnotacją, że warstwa przeglądarki nie została
  zmierzona;
- **któreś sprawdzenie wymaga danych, których nie da się zasiać bez modelu
  językowego** (`Z15`) — opisujesz i pomijasz to jedno, reszta idzie.

**★ Zasada `Z23` w tym etapie:** `200` z pustą kopertą **nie jest** zaliczeniem
sprawdzenia. Asercja ma dotyczyć **treści** (identyfikatora, tytułu), nie kodu.

---

## E6 — RAPORT (rdzeń)

**Jedyny nowy dokument w repo** (`Z13`):
`docs/program/PROGRAM_NAPRAWCZY_20260905/CODEX1_INICJATYWY/98_RAPORT.md`

**Układ narzucony — nie zmieniasz kolejności ani nagłówków:**

```markdown
# RAPORT — CODEX1 — Inicjatywy: jeden magazyn danych

## 0. Metryka
Marker: <SHA> · gałąź: codex/inicjatywy-jeden-magazyn-20260910
SHA po każdym etapie: E1 <sha> · E2 <sha> · E3 <sha> · E4 <sha> · E5 <sha> · E6 <sha>
Wynik `git -C "$WT" merge-base --is-ancestor <MARKER> HEAD`: <wynik>
Wynik `git rev-parse HEAD` i `git status --short` z §0.1 krok (7): <dosłownie>
Kontener/baza/porty: <nazwa> / <baza> / 6451, 5591
Migracje: liczba zastosowanych w przebiegu 1 i 2, wynik idempotencji

## 1. K-PUNKTY — PRZED i PO
| K | Co mierzę | PRZED (mój pomiar) | PO (mój pomiar) | Komenda |
| K1 | bramki istnienia pytające tylko magazyn zastany | | | |
| K2 | pliki z tymi bramkami | | | |
| K3 | agregaty bez wiersza zastanego | | | |
| K4 | wiersze zastane bez agregatu | | | |
| K5 | organizacje w kanonie / w magazynie zastanym | | | |
| K6 | powierzchnie widzące nowy rekord (z 7) | | | |
| K7 | ścieżki zapisu zastane: wycofane / zostają / bez następcy | | | |
| K8 | wiersze pominięte przez migrację + powód | | | |
Obok każdej mojej liczby wpisz liczbę autora instrukcji i zaznacz rozbieżność.

## 2. Stan wejściowy — 9 komend z §0.1a
Wynik każdej dosłownie, obok wyniku autora instrukcji.

## 3. Etapy — po jednej sekcji na etap
Dla każdego: co zrobiłem · definicja ukończenia i czy spełniona · komendy
dowodowe z wynikami · akapit §0.2e (która pułapka, jak wyłączona) · SHA commita.

## 4. Dowody mutacyjne (Z32)
Dla każdego: komenda psująca · wynik CZERWONY · komenda cofająca (cp) ·
wynik ZIELONY · `git diff` pusty.

## 5. Pomiar zasięgu testów (§0.4a, Z24)
`diff przed-nazwy.txt po-nazwy.txt`: nazwy DODANE, nazwy ZNIKNIĘTE.
Każda zniknięta = wyjaśnienie.

## 6. Deklaracja Z30
Dosłowny akapit z §0.2b (4) + wynik `ie_outbox_delivery_receipts`.

## 7. Migracja danych — manifest
Ścieżka manifestu · `ls -l` · `shasum -a 256` · liczby przed/po ·
wynik `--verify` po rollbacku · dowód, że `initiatives` się nie zmieniła (md5).

## 8. Korekty wobec instrukcji
Każda rozbieżność mojego pomiaru z liczbą autora — jako WYNIK, nie sprzeczność.
Cytat obu zdań przy sprzecznościach wewnętrznych + którą interpretację wybrałem.

## 9. STOP-y
Format z §0.5, każdy z wypełnionymi polami „Licencja" i „Co dostarczyłem ZAMIAST".

## 10. TWIERDZENIA NIEZWERYFIKOWANE
Sekcja NIEPUSTA. Wszystko, co napisałem, a czego nie zmierzyłem u siebie.

## 11. DO DECYZJI WŁAŚCICIELA
Każdy wiersz ze zdaniem „czego konkretnie mi zabrakło, żeby rozstrzygnąć
samodzielnie". Minimum: co zrobić z wierszami bez `project_id` (78)
i bez `owner_business_id` (104).

## 12. ZNALEZISKA POBOCZNE
Minimum: `pmoValidation.middleware.ts:206` (bramka bez `organization_id`),
`initiative.validators.ts:70` (`status .default('DRAFT')` — przyczyna pętli
autozapisu wciąż w kodzie), drugi egzemplarz słownika stanów po stronie serwera.

## 13. Artefakty
Ścieżki poza repo + `shasum -a 256` każdego pliku.
```

**Definicja ukończenia `E6`:** wszystkie 14 sekcji obecne, sekcja 10 niepusta,
sekcja 11 niepusta, każda liczba z komendą.

---

## Próg odbioru

Nadzorca przyjmuje blok, gdy **wszystkie** poniższe są prawdziwe:

1. `E1`, `E2`, `E4`, `E6` zrobione; `E3` i `E5` zrobione **albo** uczciwie
   opisane jako niezrobione z powodem.
2. Test „nowy rekord widać wszędzie" pokazuje **co najmniej 6 z 7** powierzchni
   zielonych przy fladze `ON`, a każda niezielona ma nazwane wyjaśnienie.
3. Przy fladze `OFF` **zero regresji**: pomiar `§0.4a` nie pokazuje ani jednej
   nazwy testu, która ZNIKNĘŁA.
4. Trzy dowody mutacyjne w obie strony, z komendami i wynikami.
5. `git diff --name-only <MARKER>..HEAD` **nie zawiera ani jednego pliku**
   z listy „JAWNIE NIE ZAPISZE".
6. **Zero zmian wyglądu** — dowód:
   `git diff <MARKER>..HEAD -- src/ | grep -cE "^\+.*className|^-.*className"` → `0`
   (a jeżeli nie `0`, każda taka linia wyjaśniona imiennie w raporcie).
7. Manifest migracji istnieje, `--rollback` przywraca stan co do wiersza,
   a `md5` tabeli `initiatives` przed i po migracji jest identyczne.
8. Raport ma wszystkie 14 sekcji, sekcje 10 i 11 niepuste.

## Prawo zatrzymania

Masz prawo **zatrzymać dowolny etap** i oddać zamiast niego pomiar, czerwony
kontrakt albo brief. **Nie masz prawa** zatrzymać całego bloku z innego powodu
niż pięć wymienionych w `§0.5`.

**★ Trzy najcenniejsze rzeczy, jakie możesz oddać:** dowód, że coś, co uchodziło
za działające, nie działa; dowód, że coś, co uchodziło za zepsute, jest sprawne;
i uczciwe zdanie „tego nie zmierzyłem, bo…".

---

## ★★ JEŚLI COŚ W TEJ INSTRUKCJI JEST SPRZECZNE LUB NIEWYKONALNE

**Ta instrukcja była pisana i sprawdzana przez człowieka i model. Może mieć
błędy. Nie zatrzymuj przez nie pracy.**

**Procedura, dosłownie:**

1. **Opisz sprzeczność w raporcie**, w sekcji „Korekty wobec instrukcji":
   **cytat obu wykluczających się zdań z numerami paragrafów**, na czym polega
   konflikt, jaki masz dowód i co zrobiłeś.
2. **Wybierz interpretację BEZPIECZNIEJSZĄ.** Reguły rozstrzygające, w kolejności:
   - **nie ruszaj cudzego pliku** — gdy nie wiesz, czy masz licencję, **nie
     masz**; traktuj plik jako tylko do odczytu i dostarcz czerwony kontrakt + brief;
   - **nie osłabiaj asercji** — gdy test przeszkadza, opisujesz go, nie zmieniasz;
   - **nie kasuj** — gdy werdykt jest niepewny, wpisz `DO DECYZJI WŁAŚCICIELA`
     ze zdaniem **„czego konkretnie mi zabrakło, żeby rozstrzygnąć samodzielnie"**;
   - **nie włączaj** — gdy nie wiesz, czy flaga ma być `ON`, zostaje `OFF` (`Z10`/`Z11`);
   - **nie wysyłaj niczego na zewnątrz** — gdy nie masz pewności co do `Z30`, nie klikasz;
   - **nie poszerzaj dostępu** — gdy bramka jest niejednoznaczna, **odmawiasz
     zamiast przepuszczać**;
   - **nie migruj** — gdy nie wiesz, jaką wartość wpisać w polu wymaganym przez
     kanon, rekord **odpada z migracji i idzie do manifestu**, nie dostaje
     wartości wymyślonej;
   - **mierz zamiast zgadywać** — gdy instrukcja podaje liczbę, a Twój pomiar
     daje inną, **wiążący jest Twój pomiar z komendą** (`Z24`).
3. **KONTYNUUJESZ POZOSTAŁE ETAPY.**
4. **Zatrzymanie CAŁEGO bloku** — wyłącznie z pięciu powodów z `§0.5`.
5. **Nigdy nie „naprawiaj" instrukcji przez improwizację w kodzie.**
6. **★ Rozbieżność między pomiarem a tą instrukcją NIE JEST sprzecznością —
   jest WYNIKIEM.** Każda liczba, linia i teza w tym dokumencie to **rozkaz
   pomiarowy**, nie prawda objawiona.

**★ Ostatnie zdanie tej instrukcji i najważniejsze: obalenie którejkolwiek tezy
z sekcji „STAN ZMIERZONY" jest SUKCESEM tego bloku, a nie porażką. Zapisz to
w „Korektach wobec instrukcji" z dowodem i idź dalej.**

---

## AUDYT SPRZECZNOŚCI (wykonany przez autora przed wydaniem)

| Para wymagań, które mogłyby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| `Z34a` „push po pierwszym commicie" **kontra** „NIE pushuj" ze zlecenia | `§0.1`, akapit „ROZSTRZYGNIĘCIE `Z34a`" — push wyłączony, wiersz `Z34a` w tabeli oznaczony jako wyłączony |
| „fetch WYŁĄCZNIE z `github-backup`" (szkielet) **kontra** baza tego bloku na `origin/staging` | `§0.1` krok (1) + `Z1` — fetch z `origin` dozwolony jako ODCZYT, push zakazany na każdym remote |
| `Z10` „zero nowych flag" **kontra** `E2` wymagający flagi | `Z10` wymienia wyjątek imiennie: `ENABLE_INITIATIVE_UNIFIED_READ`, default OFF |
| `Z40` „nie kasujesz danych" **kontra** `E3` tryb `--rollback` | `E3` reguła 1 + tabela trybów: rollback kasuje **wyłącznie agregaty wypisane w manifeście**, nigdy wiersze zastane |
| „jeden kanon" **kontra** pomiar „kanon obsługuje 2 organizacje z 29" | `E2` teza wstępna: `E2` **nie przełącza** na kanon, tylko stawia projekcję nad oboma magazynami; przełączenie jest skutkiem `E3`, nie `E2` |
| „front tylko przepięcie wołaczy" **kontra** trzy pliki frontu zamrożone | tabela licencji, wiersz plików zamrożonych + `§0.6` znaczniki + warunek „jeżeli zmieniłoby ekran — STOP" |
| `Z30` „zero wysyłki" **kontra** `E3` tworzący zdarzenia w outboxie | `§0.2b` pkt 3 — dodatkowy dowód `ie_outbox_delivery_receipts` = 0 |
| `Z13` „jeden plik raportu" **kontra** manifest migracji | `Z13` + `E3` reguła 4 — manifest leży **poza repo**, w raporcie jest jego ścieżka i suma kontrolna |
| `Z18` „nie ruszasz konfiguracji testów" **kontra** potrzeba `DB_TYPE=postgres` | `§0.2c` + `§0.2d` pkt 5 — obejście zmiennymi w linii komendy, plik nietknięty |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej szkieletu)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wypisane i rozstrzygnięte w treści | **TAK** (tabela wyżej, 9 par) |
| 2 | Weryfikacja każdej ścieżki pliku na markerze; nieistniejące oznaczone jako `NOWY PLIK` | **TAK** — wszystkie ścieżki sprawdzone na worktree z linii `origin/staging`; pliki `initiativeUnifiedReader.ts`, `migruj-inicjatywy-do-kanonu.ts`, `98_RAPORT.md`, nowe testy i migracje oznaczone jako **NOWE**. ★ Sprostowanie wobec zlecenia: `transformationInitiativeTransitionAdapterService.ts` leży w `server/src/services/v8/`, **nie** w `server/src/services/initiative/` |
| 3 | Każda liczba ma komendę, uruchomioną przez autora na markerze | **TAK** — tabela mianowników, 15 wierszy |
| 4 | Tabela licencji kompletna, trzecia kolumna nigdy nie brzmi samo „STOP" | **TAK** — w każdym wierszu jest rzeczownik-produkt |
| 5 | Wykonalność per etap bez plików przekrojowych, udowodniona komendą | **TAK** — kolumna w tabeli etapów, wszystkie `NIE` |
| 6 | Zasoby wyłączne sprawdzone wobec stanowisk równoległych | **TAK** — porty `6451`/`5591` wolne, kontener nie istnieje, przedział migracji `20262130`–`20262139` pusty, gałąź i worktree nie istnieją, flaga = 0 trafień |
| 7 | Komendy paste-ready, pełne ścieżki, komplet env w jednej linii, `--retry=0` | **TAK** |
| 8 | Pułapki środowiska wklejone w całości + pułapki własne modułu | **TAK** — 18 ogólnych + 5 własnych (`§0.2d` pkt 19–23) |
| 9 | Samodzielność dokumentu — zero odwołań do rozmów, każdy kontekst ze ścieżką w repo | **TAK** |
| 10 | Klauzula sprzeczności pełna, `§0.5` z tabelą „STOP proceduralny zakazany" | **TAK**. `grep -c 'MARKER_SHA' 01_INSTRUKCJA.md` → **4** — to jedyne pola szablonu, które zostały; SHA markera wpisuje CTO przed wydaniem (linie 32, 75, 141, 158) |
