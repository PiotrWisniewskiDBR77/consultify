# INSTRUKCJA DYŻURU nr 183 — Codex — „Kalendarz Mojej pracy ON teraz (D-6) — ustalenie przyczyny rewertu 25.08, retest po fladze default ON, STOP jeśli przyczyna nadal żywa"

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
> **wyłącznie** `/private/tmp/cx-day183-kalendarz-on`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `18661cc6a0`**
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
Zakres: **My Work (Moja praca) — zakładka Calendar. Flaga `ff_myWorkCalendarV2` (`src/utils/myWorkCalendarV2Flag.ts`) steruje WYŁĄCZNIE tym, czy zakładka renderuje `CalendarV2` (ten sam `CalendarView`, tylko `initialViewMode="week"` + `includeOwnEvents`) czy `CalendarView` wprost (`initialViewMode` domyślne, miesiąc) — zakładka Calendar istnieje i działa NIEZALEŻNIE od tej flagi, flip zmienia tylko domyślny widok, nie włącza nieistniejącej funkcji**.
Trasy front: ``src/utils/myWorkCalendarV2Flag.ts:1-30` (SSOT flagi, cache), `src/components/MyWork/CalendarV2/CalendarV2.tsx` (cienki wrapper), `src/components/MyWork/Calendar/CalendarView.tsx` (rzeczywista logika, w tym `persist`/reschedule + toasty błędów), `src/components/MyWork/MyWorkHub.tsx:3980-3999` (gałąź `case 'calendar'`), `src/components/MyWork/Calendar/CalendarCreateEventModal.tsx`, `src/utils/__tests__/myWorkCalendarV2Flag.test.ts``. Trasy tył: `brak zmian po stronie serwera — flaga jest czysto frontowa (query/localStorage/env, bez odpowiednika serwerowego jak `betaMenuStatus.ts`). Odczyt kontekstowy (nie zmieniasz): trasy `/my-work/calendar/**` używane przez `CalendarView.tsx` (`getMyWorkCalendarConflicts`, `createMyWorkCalendarEvent`, reschedule)`.

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
WT=/private/tmp/cx-day183-kalendarz-on
MARKER=18661cc6a0

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day183-kalendarz-on-20260830 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day183-kalendarz-on/config.worktree"
cat "$VAULT/worktrees/cx-day183-kalendarz-on/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day183-kalendarz-on-scratch
mkdir -p /private/tmp/cx-day183-kalendarz-on-artefakty

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
git -C "$VAULT" log --oneline 18661cc6a0..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only 18661cc6a0..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day183-kalendarz-on-20260830
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 18661cc6a0..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `sześć` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day183-kalendarz-on

# (T1) FLAGA DZIŚ DOMYŚLNIE OFF
sed -n '1,27p' src/utils/myWorkCalendarV2Flag.ts
#   oczekiwane: linia ~24, `cached = query ?? local ?? env ?? false`.

# (T2) HISTORIA WŁĄCZENIA I REWERTU — odtwórz z tej instrukcji, potem sprawdź sam
git log --oneline --all -- src/utils/myWorkCalendarV2Flag.ts
#   oczekiwane trzy commity: ae8bb727d4 (dodanie flagi default OFF), b5cd84d663
#   (flip default ON, DEC-2026-08-25-50, 2026-08-25 15:57:46), 97a55adff1
#   (Revert "...flip... default to ON...", 2026-08-25 17:33:07 — 96 minut później,
#   TEGO SAMEGO DNIA).
git show b5cd84d663 -s --format='%H %ad %s' --date=iso
git show 97a55adff1 -s --format='%H %ad %s' --date=iso
git show 97a55adff1 -- src/utils/myWorkCalendarV2Flag.ts src/components/MyWork/CalendarV2/CalendarV2.tsx
#   oczekiwane: diff dotyka WYŁĄCZNIE default+komentarze+opis testu — ZERO zmian w logice
#   CalendarV2/CalendarView. To jest fakt do potwierdzenia, nie do założenia.

# (T3) PRZYCZYNA WPROST Z TREŚCI ZBIORCZEGO MERGU I DEC-68..71
git show 3e2a3f1c62 -s --format='%B'
git show 3e2a3f1c62 --stat
#   oczekiwane: commit-message "P0 parity regressions found by skeptic"; stat dotyka DWÓCH
#   flag naraz (myWorkCalendarV2Flag.ts I ideaInspectorRightRailFlag.ts) — sprawdź, czy P0
#   dotyczy Twojej flagi czy sąsiedniej (patrz T4).
grep -n "DEC-2026-08-25-68\|DEC-2026-08-25-69\|DEC-2026-08-25-70\|DEC-2026-08-25-71" \
  docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
#   oczekiwane: DEC-70 "OWNER: Sejf CHANGE, Kalendarz ACCEPT"; DEC-71 potwierdza, że werdykty
#   ACCEPT partii F "pozostają ważne TYLKO DLA: listy Pomysłów, ... Kalendarza V2" — czyli
#   właściciel osobno i wprost zaakceptował Kalendarz, mimo że reszta partii F wróciła CHANGE.

# (T4) CZY "P0 PARITY REGRESSION" ZNALEZIONY PRZEZ SCEPTYKA DOTYCZY KALENDARZA CZY SZYNY
git show ea3174c7fc -s --format='%B'
git show ea3174c7fc -- tests/components/MyWork/IdeaMapWorkspace.preferredTool-regression.test.tsx
#   oczekiwane: commit ea3174c7fc (flip ff_ideaInspectorRightRail ON) opisuje regresję W TEŚCIE
#   preferredTool (Api.getMyIdeaConversions bez mocka -> TypeError w IdeaMapWorkspace) — to jest
#   inspektor Idea, NIE kalendarz. Potwierdź samodzielnie, że żaden analogiczny plik/commit nie
#   wspomina P0 w kontekście CalendarV2/CalendarView — jeśli znajdziesz taki, to zmienia werdykt
#   R1 na STOP.

# (T5) SPÓJNOŚĆ Z NAPRAWĄ TOASTÓW BŁĘDÓW Z DYŻURU 173 (InitiativeCalendar, INNY komponent)
grep -n "toast.error\|catch" src/components/MyWork/Calendar/CalendarView.tsx
grep -n "InitiativeCalendar.persist" docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY173_DOMKNIECIA_REPORT.md
#   oczekiwane: CalendarView.tsx ma JUŻ rozróżnione toasty (409 konflikt wersji, 403 zakaz,
#   404 nie znaleziono, ogólny fallback) — bogatszy zestaw niż jednolity catch dodany dyżurem 173
#   do INNEGO pliku (InitiativeCalendar w module Initiatives). Potwierdź to sam, nie licz na ten
#   wynik jako gotowy — chodzi o to, żeby nie przenieść mylnie "naprawy" z 173 tam, gdzie już jej
#   nie trzeba.

# (T6) ZAKŁADKA CALENDAR ISTNIEJE NIEZALEŻNIE OD FLAGI
sed -n '3978,4000p' src/components/MyWork/MyWorkHub.tsx
#   oczekiwane: case 'calendar' renderuje ZAWSZE jakiś kalendarz (CalendarV2 gdy flaga ON, inaczej
#   CalendarView) — flip nie odkrywa nieistniejącej funkcji, zmienia tylko wariant domyślny.
```

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day183-kalendarz-on-20260830` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6092`. Twój JEDYNY port harnessu to `5036 i 5037`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day183-pg`**. **ZAKAZANE:** `6012, 5433, 6047, 6054-6088, 5010-5029, 6404-6408 (odbiory nadzorcy i wcześniejsze dyżury), 6089/5030-5031 (dyżur 180), 6093-6096/5038-5045 (dyżury 184-187). ★ TRÓJKA RÓWNOLEGŁA — dodatkowo zakazane: 6090/5032-5033 (dyżur 181 — Spotkania) i 6091/5034-5035 (dyżur 182 — Czat). Twoje własne to WYŁĄCZNIE 6092 i 5036/5037. ★ PORT 5000 ZAJĘTY NA STAŁE przez macOS Control Center`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `★★ JEDYNA zmiana wartości domyślnej w tym dyżurze: `src/utils/myWorkCalendarV2Flag.ts:24` (`return (cached = query ?? local ?? env ?? false);`) → domyślne `true`, WYŁĄCZNIE jeśli R1 potwierdzi, że przyczyna rewertu z 25.08 nie dotyczy tej flagi (patrz R1/R3). `query`/`localStorage`/`env` zostają jako jawny opt-out — nie usuwasz tego mechanizmu. Zero innych flag — `Radar` (`MyWorkHub.tsx:235`, hidden/paused) i `ff_ideaInspectorRightRail` (`src/utils/ideaInspectorRightRailFlag.ts`, dalej OFF, backlog po-MVP wg D-6) zostają NIETKNIĘTE`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY183_KALENDARZ_ON_REPORT.md`. Nie zmieniasz żadnego `MODULE_ACCEPTANCE.md` — ten dyżur nie ma przypisanej karty modułu w briefie nadzorcy; jeśli podczas pracy znajdziesz kartę „My Work”/„09_MYWORK” i uznasz, że wpis się przyda, zgłoś to jako propozycję w raporcie zamiast edytować bez licencji. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day183-kalendarz-on-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day183-kalendarz-on-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **NIE WŁĄCZASZ `ff_ideaInspectorRightRail`.** To sąsiednia flaga z tego samego zbiorczego mergu (`3e2a3f1c62`) i tej samej decyzji `DEC-2026-08-25-50` — ale NIE jest częścią D-6 (D-6 mówi wyłącznie „kalendarz”). Właściciel dał jej osobny, negatywny werdykt (`DEC-2026-08-25-68`: „Ta tabela właściwości po prawej stronie to jest jakiś dramat”) — zostaje OFF do przeprojektowania i nowego akceptu (`DEC-2026-08-26-90` pokazuje, że jej włączenie ma osobną, jeszcze nierozliczoną ścieżkę). ★★ **NIE dotykasz `Radar`** (`MyWorkHub.tsx:235`, `890`, `3931` — hidden/paused, literał zostaje wg D-6: „Radar po-MVP”). ★★ **Jeśli T3/T4 pokażą, że przyczyna rewertu DOTYCZY kalendarza (nie tylko szyny)** — STOP z pełnym opisem w raporcie zamiast włączania flagi. To NIE jest porażka dyżuru — to jest dokładnie to, o co prosi R3. ★★ **Zero zmian w `CalendarView.tsx`/`CalendarV2.tsx` poza tym, czego wymaga ewentualna naprawa z T5** — jeśli toasty już są kompletne (oczekiwany wynik), zero zmian w logice reschedule/persist. ★★ **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.** | Decyzja właściciela D-6 (`docs/program/funkcje/DECYZJE_WLASCICIELA_2026-08-30_WIECZOR.md`): „Moja praca — Kalendarz ON TERAZ; Radar po-MVP”. Flaga `ff_myWorkCalendarV2` była już RAZ włączona 25.08 (commit `b5cd84d663`, konsekwencja `DEC-2026-08-25-50` — właściciel zaakceptował polish dnia 3 na 11 zrzutach) i zrewertowana TEGO SAMEGO DNIA (commit `97a55adff1`, w ramach zbiorczego mergu `3e2a3f1c62` „revert: My Work flag defaults back to OFF — runbook cofania — P0 parity regressions found by skeptic”). Ten dyżur ma odtworzyć CAŁY łańcuch przyczynowy z treści commitów i późniejszych wpisów `OWNER_DECISION_LEDGER_2026-08-24.md` (`DEC-2026-08-25-70/71`), zanim ponownie włączy flagę — zakaz włączania na skróty, bo decyzja właściciela nie zwalnia z ustalenia, czy powód rewertu wciąż istnieje (reguła 8 CLAUDE.md, przycisk cofania działa w obie strony) |

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
cd /private/tmp/cx-day183-kalendarz-on

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day183-pg psql -U postgres -d consultify_w3_my_work_owner_cx183 \
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
cd /private/tmp/cx-day183-kalendarz-on

docker run -d --name cx-day183-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=consultify_w3_my_work_owner_cx183 \
  -p 127.0.0.1:6092:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day183-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6092/consultify_w3_my_work_owner_cx183 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6092/consultify_w3_my_work_owner_cx183 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day183-kalendarz-on && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6092/consultify_w3_my_work_owner_cx183 \
JWT_SECRET=cx183-test-secret-do-not-reuse \
npx vitest run src/utils/__tests__/myWorkCalendarV2Flag.test.ts src/components/MyWork/CalendarV2/__tests__ src/components/MyWork/Calendar/__tests__ tests/components/MyWork/CalendarCreateEventModal.test.tsx tests/components/MyWork/CalendarCreateEventModal.v2.test.tsx tests/components/MyWork/CalendarCreateEventModal.attendees.test.tsx tests/components/MyWork/CalendarCreateEventModal.confirmDialogStacking.test.tsx --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day183-kalendarz-on-artefakty/day183-vitest.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day183-kalendarz-on && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run src/utils/__tests__/myWorkCalendarV2Flag.test.ts src/components/MyWork/CalendarV2/__tests__ src/components/MyWork/Calendar/__tests__ tests/components/MyWork/CalendarCreateEventModal.test.tsx tests/components/MyWork/CalendarCreateEventModal.v2.test.tsx tests/components/MyWork/CalendarCreateEventModal.attendees.test.tsx tests/components/MyWork/CalendarCreateEventModal.confirmDialogStacking.test.tsx --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day183-kalendarz-on-artefakty/day183-vitest.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day183-kalendarz-on/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day183-pg psql -U postgres -d consultify_w3_my_work_owner_cx183 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day183-pg`.
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
> **(e) ★★ **Pierwsza, i to jest sedno R1: rewert `3e2a3f1c62` jest ZBIORCZY — dotyka DWÓCH niepowiązanych flag naraz** (`ff_myWorkCalendarV2` i `ff_ideaInspectorRightRail`), a commit-message „P0 parity regressions found by skeptic” nie mówi, KTÓREJ z nich dotyczy P0. Dowód w kodzie wskazuje jednoznacznie na szynę inspektora: jedyny plik z nazwą zawierającą „regression” dotknięty przez flip-ON (`tests/components/MyWork/IdeaMapWorkspace.preferredTool-regression.test.tsx`, commit `ea3174c7fc`) opisuje `TypeError` w efekcie lineage konwersji `IdeaMapWorkspace` (`Api.getMyIdeaConversions` bez mocka) — komponent inspektora, nie kalendarza. Sam diff rewertu dla `CalendarV2.tsx` (`97a55adff1`) zmienia WYŁĄCZNIE komentarz i domyślną wartość flagi — zero zmian w logice. **Nie bierz tego za gotowy dowód — to jest hipoteza silnie poparta kodem, którą MASZ zweryfikować własnym przeglądem T3/T4, zanim napiszesz w raporcie "przyczyna nie dotyczy kalendarza".** ★★ **Druga: właściciel dał kalendarzowi WŁASNY, POZYTYWNY werdykt PO rewercie, tego samego dnia.** `DEC-2026-08-25-70` (2026-08-25 20:59:45, czyli ~3,5 h PO rewercie o 17:33): „OWNER: Sejf CHANGE, Kalendarz ACCEPT”. `DEC-2026-08-25-71` (proces-korekta po tym, jak właściciel słusznie odrzucił zrzuty partii F pokazujące stan SPRZED rozliczenia jego uwag z 22-23.08) explicité potwierdza: „Werdykty ACCEPT z partii F pozostają ważne TYLKO DLA: listy Pomysłów, rynny/inline-AI/narożnika Notatnika, **Kalendarza V2**”. Czyli nawet stare, potencjalnie nieświeże zrzuty kalendarza nie wywołały zastrzeżenia — w przeciwieństwie do inspektora/szyny Notatnika/Sejfu, które dostały CHANGE. To NIE zwalnia Cię z T3/T4 (werdykt smakowy właściciela na zrzutach to nie to samo co techniczna regresja parytetu znaleziona przez sceptyka), ale jest silnym, udokumentowanym sygnałem w stronę "bezpieczne do włączenia". ★★ **Trzecia: `CalendarV2` to NIE osobny komponent z osobną logiką — to cienki wrapper na `CalendarView` z dwoma zmienionymi propsami** (`initialViewMode="week"`, `includeOwnEvents`). Cała logika zapisu/reschedule/toastów błędów (`CalendarView.tsx`) jest WSPÓLNA dla obu wariantów flagi i JUŻ ma bogatszy zestaw toastów (409/403/404/ogólny) niż to, co dyżur 173 dopiero dopisywał do zupełnie INNEGO komponentu (`InitiativeCalendar` w module Initiatives, używanego wyłącznie w `TimelineSection.tsx`) — te dwa komponenty nie mają wspólnego kodu, "spójność" z T5 to porównanie WZORCA jakości, nie wspólnego pliku. Nie pomyl `InitiativeCalendar.persist` (Initiatives, dyżur 173, naprawiony) z `CalendarView`'s reschedule handlerem (My Work, ten dyżur). ★★ **Czwarta: zakładka Calendar w My Work renderuje SIĘ ZAWSZE** — `case 'calendar'` w `MyWorkHub.tsx:3980` nie ma warunku beta/gate, flaga wybiera WYŁĄCZNIE między dwoma wariantami tego samego komponentu. Retest R2 nie polega na "odkryciu" nowego ekranu, tylko na potwierdzeniu, że domyślny widok zmienił się z miesiąca na tydzień i że `includeOwnEvents` faktycznie zmienia zawartość (jakie wydarzenia się pokazują) — zweryfikuj różnicę na zrzutach przed/po, nie zakładaj jej z nazwy propsa. ★★ **Piąta: test `src/utils/__tests__/myWorkCalendarV2Flag.test.ts` ma DOKŁADNIE ten sam kształt zmiany, jaki 25.08 już raz wykonano i raz zrewertowano** — commit `b5cd84d663` jest gotowym wzorcem (`'defaults ON with no query or local override'` zamiast `'defaults OFF...'`, drugi test przestawiony na jawny opt-OUT zamiast opt-IN). Powtórz TĘ SAMĄ zmianę, nie wymyślaj nowego kształtu testu. ★★ **Szósta: `tests/components/MyWork/CalendarCreateEventModal.test.tsx` traci pokrycie ścieżki legacy (task-backed creation, bez pól attendees/godziny), jeśli nie przywrócisz pinningu.** Commit `b5cd84d663` dodał (a rewert usunął) jawny `vi.mock('.../myWorkCalendarV2Flag', () => ({ isMyWorkCalendarV2Enabled: () => false }))` w tym pliku, z uzasadnieniem: ta suita celowo testuje PRZED-V2 ścieżkę, której nie duplikują `CalendarCreateEventModal.v2.test.tsx`/`.attendees.test.tsx`. Przywróć DOKŁADNIE ten sam blok — inaczej po fladze default ON ta suita zacznie po cichu jeździć na V2 i finalnie przestanie sprawdzać to, co miała sprawdzać.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day183-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day183-kalendarz-on-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`pozycja R1 — ustalenie SHA i PRZYCZYNY rewertu z 25.08 wprost z treści commitów, rozstrzygnięcie czy przyczyna dotyczy TEJ flagi czy sąsiedniej (`ff_ideaInspectorRightRail`), i tylko wtedy przejście do R2`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6092` albo `5036 i 5037` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6092` albo `5036 i 5037`** (`Z7`).

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

Decyzja właściciela D-6 (`docs/program/funkcje/DECYZJE_WLASCICIELA_2026-08-30_WIECZOR.md`):

> Moja praca | **Kalendarz ON TERAZ; Radar po-MVP** | dyżur: włączenie flagi
> kalendarza + retest; Radar → backlog po-MVP (literał zostaje)

Flaga `ff_myWorkCalendarV2` (`src/utils/myWorkCalendarV2Flag.ts`) była już
RAZ włączona i tego samego dnia zrewertowana:

| Zdarzenie | Commit | Kiedy |
|---|---|---|
| Flaga dodana, default OFF | `ae8bb727d4` | wcześniej |
| Flip default → ON, konsekwencja `DEC-2026-08-25-50` | `b5cd84d663` | 2026-08-25 15:57:46 |
| Revert flipu | `97a55adff1` (część zbiorczego mergu `3e2a3f1c62`) | 2026-08-25 17:33:07 |

Zbiorczy commit-message rewertu: „revert: My Work flag defaults back to OFF
(runbook cofania — P0 parity regressions found by skeptic)”. **Ten rewert
dotyka DWÓCH niepowiązanych flag naraz** — `ff_myWorkCalendarV2` i
`ff_ideaInspectorRightRail` (druga flaga, szyna właściwości Idea Inspector) —
obie flipnięte tego samego dnia przez tę samą decyzję `DEC-2026-08-25-50` i
zrewertowane tym samym zbiorczym mergem.

Dowód w kodzie wskazuje, że techniczna regresja („P0 parity”) dotyczyła
SZYNY, nie kalendarza: jedyny plik z „regression” w nazwie dotknięty flipem-ON
to `tests/components/MyWork/IdeaMapWorkspace.preferredTool-regression.test.tsx`
(commit `ea3174c7fc`, flip `ff_ideaInspectorRightRail`), opisujący `TypeError`
w efekcie lineage konwersji `IdeaMapWorkspace` (`Api.getMyIdeaConversions` bez
mocka po włączeniu rail-a). Diff rewertu dla `CalendarV2.tsx` zmienia
WYŁĄCZNIE komentarz — zero zmian w logice.

Później tego samego dnia (`OWNER_DECISION_LEDGER_2026-08-24.md`,
`DEC-2026-08-25-70`, 20:59:45 — ~3,5 godziny PO rewercie) właściciel dał
kalendarzowi WŁASNY, osobny werdykt: „OWNER: Sejf CHANGE, **Kalendarz
ACCEPT**”. Proces-korekta `DEC-2026-08-25-71` (po tym, jak właściciel
słusznie odrzucił resztę partii F za nieświeże zrzuty) potwierdza wprost:
werdykty ACCEPT partii F „pozostają ważne TYLKO DLA: listy Pomysłów,
rynny/inline-AI/narożnika Notatnika, **Kalendarza V2**”.

To jest silny, udokumentowany sygnał — ale NIE jest substytutem T3/T4 z bloku
0 tej instrukcji. Werdykt smakowy właściciela na zrzutach i techniczna
regresja parytetu znaleziona przez sceptyka to dwie różne rzeczy; ten dyżur
ma je rozdzielić z treści commitów, nie zgadywać.

# 2. TEZY ZLECENIA

- **T1.** Rewert `3e2a3f1c62` jest zbiorczy (dwie flagi). Musisz ustalić z
  treści commitów, KTÓRA flaga miała realną, techniczną regresję, zanim
  zdecydujesz, że kalendarz jest bezpieczny do włączenia.
- **T2.** `CalendarV2` nie ma własnej logiki — jest cienkim wrapperem na
  `CalendarView` z dwoma zmienionymi propsami (`initialViewMode="week"`,
  `includeOwnEvents`). Cała logika zapisu/reschedule/toastów błędów jest
  współdzielona i JUŻ ma bogatszy zestaw obsługi błędów (409/403/404/ogólny)
  niż to, co dyżur 173 dopisał do zupełnie innego komponentu
  (`InitiativeCalendar`, moduł Initiatives).
- **T3.** Zakładka Calendar w My Work renderuje się zawsze, niezależnie od
  flagi — flip nie odkrywa nieistniejącej funkcji, zmienia tylko domyślny
  wariant. Retest polega na potwierdzeniu RÓŻNICY (tydzień zamiast miesiąca,
  własne wydarzenia), nie na odkryciu nowego ekranu.
- **T4.** Jeśli T1 pokaże, że przyczyna rewertu DOTYCZY kalendarza (nie tylko
  szyny) — to jest STOP, nie przeszkoda do ominięcia. Decyzja właściciela
  „kalendarz ON teraz” nie zwalnia z ustalenia, czy powód rewertu wciąż
  istnieje (reguła 8 CLAUDE.md).

# 3. POZYCJE DYŻURU

## R1 — ustal SHA i przyczynę rewertu, rozstrzygnij czy dotyczy kalendarza

Wykonaj dosłownie komendy T1-T6 z bloku 0 (BLOK 0 tej instrukcji). Zapisz do
raportu, jako osobną, jawną sekcję „HISTORIA FLAGI”:

1. Trzy SHA (dodanie, flip, revert) z dokładnym czasem.
2. Pełną treść commit-message rewertu `3e2a3f1c62` i diff dla
   `CalendarV2.tsx`/`myWorkCalendarV2Flag.ts` w `97a55adff1`.
3. Treść `DEC-2026-08-25-68/69/70/71` z `OWNER_DECISION_LEDGER_2026-08-24.md`,
   z jawnym wskazaniem, który werdykt dotyczy kalendarza (ACCEPT) i który
   dotyczy sąsiednich powierzchni (CHANGE).
4. Treść commit-message i diff `ea3174c7fc` (flip `ff_ideaInspectorRightRail`)
   jako dowód, że test „preferredTool-regression” dotyczy szyny, nie
   kalendarza.
5. **Twój własny werdykt**, wprost: „przyczyna rewertu dotyczy
   `ff_ideaInspectorRightRail` / dotyczy obu flag / dotyczy też kalendarza” —
   z uzasadnieniem opartym na (1)-(4), nie na domysłach.

**Ukończone, gdy:** raport ma kompletny, cytowany łańcuch przyczynowy i
jednoznaczny werdykt, na podstawie którego R2 albo się wykonuje, albo STOP-uje
(R3).

## R2 — włączenie domyślne + retest (WYŁĄCZNIE jeśli R1 daje zielone światło)

**(1) Flip.** `src/utils/myWorkCalendarV2Flag.ts:24`:
`cached = query ?? local ?? env ?? false` → `... ?? true`. Zaktualizuj
komentarz nad funkcją tak jak zrobił to `b5cd84d663` (odniesienie do decyzji,
tu: D-6 zamiast `DEC-2026-08-25-50`).

**(2) Odbuduj testy dokładnie wzorem `b5cd84d663`** (ten sam kształt zmiany,
już raz wykonany):
   - `src/utils/__tests__/myWorkCalendarV2Flag.test.ts` — `'defaults OFF...'`
     → `'defaults ON with no query or local override'`
     (`expect(isMyWorkCalendarV2Enabled()).toBe(true)`); drugi test na jawny
     opt-OUT (`'off'`) zamiast opt-IN (`'1'`), symetrycznie do commitu wzorca.
   - `tests/components/MyWork/CalendarCreateEventModal.test.tsx` — przywróć
     `vi.mock('../../../src/utils/myWorkCalendarV2Flag', () => ({
     isMyWorkCalendarV2Enabled: () => false }))` z tym samym komentarzem
     uzasadniającym (suita testuje celowo ścieżkę pre-V2, nieduplikowaną przez
     `.v2.test.tsx`/`.attendees.test.tsx`).
   - `src/components/MyWork/CalendarV2/CalendarV2.tsx` — komentarz zmień z
     „Default-off” na „Default-on”, analogicznie do `b5cd84d663`.

**(3) Retest funkcjonalny na `consultify_w3_my_work_owner_cx183`.** Fixture
`W3-MY-WORK-OWNER-v1` (`scripts/dev/seed-wave3-my-work-owner-review-owned.mjs`).
Sprawdź na żywo: (i) zakładka Calendar domyślnie pokazuje widok tygodniowy,
nie miesięczny; (ii) `includeOwnEvents` faktycznie zmienia treść (porównaj
listę wydarzeń przed/po na tych samych danych fixture); (iii) tworzenie
wydarzenia (`CalendarCreateEventModal`) działa; (iv) przeciągnięcie/zmiana
terminu (`persist`/reschedule w `CalendarView.tsx`) kończy się sukcesem I
osobno — symulowanym błędem (409/403/404/500) — pokazuje właściwy toast, nie
cichą porażkę.

**(4) Zrzuty jasny + ciemny**, stan pusty (organizacja bez wydarzeń) i pełny
(fixture), dla widoku tygodniowego (nowy domyślny).

**Ukończone, gdy:** flaga ma default `true`, trzy testy z (2) przechodzą w
nowym kształcie, retest (3) ma dowód na żywym Postgresie dla wszystkich
czterech punktów, zrzuty (4) są w artefaktach.

## R3 — STOP zamiast włączenia (jeśli R1 tak każe)

Jeśli R1 ustali, że przyczyna rewertu z 25.08 DOTYCZY kalendarza (nie tylko
szyny inspektora) i wciąż jest aktualna (kod nie zmienił się od tego czasu w
sposób, który by ją usunął) — **zatrzymaj się na R1, nie wykonuj R2.** Wpisz
do raportu: cytat z dowodu, dlaczego przyczyna nadal żywa, i co trzeba
naprawić przed bezpiecznym włączeniem. To jest w pełni ukończony wynik tego
dyżuru, nie porażka — zakaz drogi na skróty („decyzja właściciela kazała, więc
włączam mimo zastrzeżeń”) jest jawnym wymogiem D-6/R3 tego briefu.

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis | `src/utils/myWorkCalendarV2Flag.ts` — wyłącznie wartość domyślna (linia ~24) i jej komentarz, WYŁĄCZNIE jeśli R1 daje zielone światło |
| Zapis | `src/components/MyWork/CalendarV2/CalendarV2.tsx` — wyłącznie komentarz nagłówkowy (Default-off → Default-on) |
| Zapis | `src/utils/__tests__/myWorkCalendarV2Flag.test.ts` — wyłącznie dwa testy opisane w R2(2), wzorem `b5cd84d663` |
| Zapis | `tests/components/MyWork/CalendarCreateEventModal.test.tsx` — wyłącznie przywrócenie bloku `vi.mock('.../myWorkCalendarV2Flag', ...)` opisanego w R2(2) |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY183_KALENDARZ_ON_REPORT.md` |
| Warunkowe (tylko jeśli T5 z bloku 0 pokaże realny brak toastu błędu w `CalendarView.tsx`) | `src/components/MyWork/Calendar/CalendarView.tsx` — wyłącznie brakujący catch/toast na ścieżce reschedule/persist, z testem; opisz jako odstępstwo od zakresu w raporcie |
| Odczyt | `src/components/MyWork/MyWorkHub.tsx` — gałąź `case 'calendar'` (linie ok. 3980-3999); **nie zmieniasz** |
| Odczyt | `src/components/Initiatives/calendar/InitiativeCalendar.tsx` — INNY komponent (moduł Initiatives, dyżur 173); **nie zmieniasz**, tylko porównujesz jakość obsługi błędów |
| Odczyt | `src/utils/ideaInspectorRightRailFlag.ts` — sąsiednia flaga z tej samej decyzji `DEC-2026-08-25-50`; **nie zmieniasz**, poza zakresem D-6 |
| Odczyt | `scripts/dev/seed-wave3-my-work-owner-review-owned.mjs`, `scripts/dev/seed-wave3-my-work-owner-review.mjs` (compat entrypoint) — fixture do retestu R2; **nie zmieniasz** |
| Odczyt | `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md`, `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY173_DOMKNIECIA_REPORT.md` — źródła historii/spójności; **nie zmieniasz** |

★ **Rozłączność z dyżurami działającymi równolegle:** 181 (Spotkania) i 182
(Czat) nie dotykają żadnego pliku z Twojej tabeli i odwrotnie. Nie dotykasz
`src/utils/ideaInspectorRightRailFlag.ts` ani jakiegokolwiek pliku
`IdeaMapWorkspace*`/`IdeaInspector*` — to sąsiedni, nierozliczony jeszcze
temat spoza D-6.

# 5. TWARDE ZASADY

- ★★ **NIE WŁĄCZASZ `ff_ideaInspectorRightRail`.** Poza zakresem D-6, osobny,
  negatywny werdykt właściciela (`DEC-2026-08-25-68`), osobna, nierozliczona
  ścieżka (`DEC-2026-08-26-90`).
- ★★ **NIE dotykasz `Radar`** (`MyWorkHub.tsx:235/890/3931`) — literał
  „po-MVP” zostaje, D-6 to mówi wprost.
- ★★ **Jeśli R1 wskaże, że przyczyna rewertu dotyczy kalendarza — STOP na
  R1, zero flipu.** To jest poprawny, kompletny wynik tego dyżuru.
- **Testy z R2(2) odtwarzasz wzorem `b5cd84d663`, nie wymyślasz nowego
  kształtu.** To już raz zostało zrobione i raz zrewertowane — powtórz tę
  samą, sprawdzoną zmianę.
- **Nie mylisz `InitiativeCalendar` (Initiatives, dyżur 173) z `CalendarView`
  (My Work, ten dyżur).** To dwa różne komponenty bez wspólnego kodu; T5 to
  porównanie jakości wzorca, nie wspólny plik do naprawy.
- **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.** Wyłącznie
  lokalny kontener `cx-day183-pg`.
- **Każdą cytowaną linię kodu i każdy SHA sprawdzasz sam przed wklejeniem do
  raportu.** Numery i SHA w tej instrukcji zweryfikowano wobec markera
  `18661cc6a0`, ale plik żyje i historia gita jest długa — potwierdź
  dokładne SHA komendami z bloku 0, nie przepisuj z pamięci.
- ★ Port **5000 jest zajęty na stałe przez macOS Control Center**.
- **Sekcja „TWIERDZENIA NIEZWERYFIKOWANE” w raporcie jest obowiązkowa.**
  Wypisz w niej wprost co najmniej: czy przyczyna „P0 parity regression”
  rzeczywiście dotyczy WYŁĄCZNIE `ff_ideaInspectorRightRail` (T1-T4 z bloku
  0) czy też częściowo kalendarza; czy `includeOwnEvents` realnie zmienia
  wyświetlaną treść (nie tylko istnieje jako prop); czy toasty błędów w
  `CalendarView.tsx` faktycznie pokrywają wszystkie ścieżki błędu reschedule
  (409/403/404/ogólny) na żywym Postgresie, nie tylko w kodzie źródłowym.
