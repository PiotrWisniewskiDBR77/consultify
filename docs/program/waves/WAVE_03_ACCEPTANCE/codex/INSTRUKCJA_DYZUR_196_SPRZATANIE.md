# INSTRUKCJA DYŻURU nr 196 — Codex — „Sprzątanie zbiorcze z kart odbiorów — 4 małe, nazwane pozycje: surowy Source w Execution, kłamiący komentarz DEC-104, t() bez importu w UsageMeters, sprzeczny werdykt w dwóch kartach MODULE_ACCEPTANCE"

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
> **wyłącznie** `/private/tmp/cx-day196-sprzatanie`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `6894f3da05`**
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
Zakres: **Sprzątanie zbiorcze — cztery małe, niezależne, JUŻ NAZWANE pozycje z kart odbioru różnych modułów (Execution, Initiatives, Billing/Settings, Organization+Settings dokumentacja). Zero szukania własnych znalezisk — wszystkie cztery mają dziś dokładny adres plik:linia i dowód z wcześniejszego odbioru**.
Trasy front: ``src/components/Execution/ExecutionHub.tsx` — relacja `Source:` w prawym panelu preview (linie 5679-5683), `previewModel`/`selectedRow` (linie 5557-5558), `mapToPreviewModel` (linie 1993-2011), blok importów lokalnych (ok. linia 98); `src/components/Initiatives/InitiativeDocumentView.tsx` — komentarz DEC-104 (linie 5705-5712), `statusActions`/`stripStatusActions` (linie 1418, 1438), `handleStatusAction`/`updateInitiativeStatusWriteTruth` (linie 3025, 3148); `src/components/billing/UsageMeters.tsx` — cały plik (44 linie komponentu, brak `useTranslation`, użycie `t()` w linii 174); `src/components/Initiatives/InitiativeSourceLink.tsx` (odczyt — `getSourceDisplayLabel`, linie 12-40); `src/components/shared/BillingCore.tsx` (odczyt — wzorzec importu `useTranslation`, linie 13/252)`. Trasy tył: `brak — ten dyżur nie dotyka `server/**``.

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
WT=/private/tmp/cx-day196-sprzatanie
MARKER=6894f3da05

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day196-sprzatanie-20260831 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day196-sprzatanie/config.worktree"
cat "$VAULT/worktrees/cx-day196-sprzatanie/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day196-sprzatanie-scratch
mkdir -p /private/tmp/cx-day196-sprzatanie-artefakty

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
git -C "$VAULT" log --oneline 6894f3da05..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only 6894f3da05..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day196-sprzatanie-20260831
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 6894f3da05..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `siedem` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day196-sprzatanie

# (T1) R1 — SUROWY sourceType W EXECUTIONHUB, WZORZEC JUŻ ISTNIEJE GDZIE INDZIEJ
sed -n '5676,5684p' src/components/Execution/ExecutionHub.tsx
grep -n "getSourceDisplayLabel\|sourceFramework" src/components/Execution/ExecutionHub.tsx
#   oczekiwane: linia ~5680 pokazuje surowe `previewModel.sourceType`; getSourceDisplayLabel
#   NIE jest dziś importowany w tym pliku (zero trafień) — porównaj z InitiativesHub.tsx:1938
#   (`getSourceDisplayLabel(row.sourceType)`, już poprawny wzorzec).

# (T2) R1 — sourceFramework ISTNIEJE na selectedRow, ale NIE w typie previewModel
grep -n "sourceFramework" server/src/controllers/InitiativeController.ts
grep -n "sourceType\|sourceFramework" src/components/Initiatives/InitiativePreviewV3.tsx | head -5
#   oczekiwane: InitiativeController.ts linia ~367 `sourceFramework: i.source_framework`;
#   InitiativePreviewV3Model (typ) NIE ma pola sourceFramework — czytaj je z `selectedRow`
#   bezpośrednio (`(selectedRow as any)?.sourceFramework`), NIE dodawaj pola do współdzielonego
#   typu (ten typ ma dziś 4 innych konsumentów poza ExecutionHub — InitiativesHub, Discovery-
#   ToolsHub, ResultsInitiativesView — rozszerzenie typu ma szerszy promień niż ta pozycja).

# (T3) R2 — DEC-104 KŁAMIE, PRAWDZIWA ŚCIEŻKA ZAPISU JEST TUŻ OBOK
sed -n '5695,5715p' src/components/Initiatives/InitiativeDocumentView.tsx
grep -n "handleStatusAction = async\|updateInitiativeStatusWriteTruth(" src/components/Initiatives/InitiativeDocumentView.tsx
#   oczekiwane: komentarz DEC-104 (~5709) twierdzi "no card-level status write path exists";
#   handleStatusAction (~3025) woła updateInitiativeStatusWriteTruth (~3148) — realny PATCH.
#   Dowód zewnętrzny: docs/program/funkcje/ODBIOR_172_EKRANY_NIEPRAWDA.md (ocena przycisku A).

# (T4) R3 — POMIAR PRZED WYBOREM: t() bez importu + kto naprawdę importuje UsageMeters/SidebarUsage
grep -n "useTranslation\|const { t }" src/components/billing/UsageMeters.tsx
sed -n '170,178p' src/components/billing/UsageMeters.tsx
grep -rln "UsageMeters\b" src/ --include='*.tsx' --include='*.ts'
grep -rln "SidebarUsage\b" src/ --include='*.tsx' --include='*.ts'
#   oczekiwane: brak useTranslation w UsageMeters.tsx; t() użyty w linii 174 (bug realny, plik
#   kompiluje się mimo referencji do niezadeklarowanej zmiennej w JSX — wyjaśnij dlaczego w raporcie).
#   Importerzy UsageMeters oczekiwani: SidebarUsage.tsx, BillingSettings.tsx, BillingCore.tsx,
#   plus plik własny (4 trafienia) — DWA są ŻYWE (BillingSettings/BillingCore), więc miara mówi
#   FIX, nie kwarantanna. SidebarUsage.tsx importerzy oczekiwani: WYŁĄCZNIE plik własny (1 trafienie)
#   — zero konsumentów, martwy, ale to OSOBNY plik od tego z bugiem.

# (T4b) R3 — CZY DYŻUR 176 JUŻ TO NAPRAWIŁ NA TWOJEJ GAŁĘZI BAZOWEJ (unikaj podwójnej roboty)
git log --oneline --all --grep='day176' -- src/components/billing/UsageMeters.tsx | head -5
git merge-base --is-ancestor $(git log --all --grep='day176.*ustawienia' --format='%H' -1 2>/dev/null || echo HEAD) HEAD 2>/dev/null; echo "sprawdź ręcznie, powyższe jest tylko podpowiedzią"
#   jeśli T4 pokaże, że useTranslation JUŻ jest zaimportowane — ta pozycja jest zrobiona, zapisz
#   to w raporcie jako 'już naprawione (dyżur 176 lub inny), zero zmian' i przejdź dalej.

# (T5) R4 — SPRZECZNOŚĆ W DWÓCH KARTACH, DOKŁADNE LINIE
grep -n "Owner verdict\|^Decision:\|CLOSED_FINAL —" docs/program/waves/WAVE_03_ACCEPTANCE/modules/01_ORGANIZATION/MODULE_ACCEPTANCE.md
grep -n "Owner verdict\|^Decision:\|CLOSED_FINAL —" docs/program/waves/WAVE_03_ACCEPTANCE/modules/15_SETTINGS/MODULE_ACCEPTANCE.md
#   oczekiwane: w OBU plikach "## Owner verdict" + "Decision: ..." siedzi NAD "## CLOSED_FINAL —
#   2026-08-25" w tym samym pliku — sprzeczność potwierdzona w obu, nie tylko jednym.

# (T6) PORT I MIEJSCE NA DYSKU
df -h /
lsof -nP -iTCP:6121 -iTCP:5062 -iTCP:5063 -sTCP:LISTEN
#   oczekiwane: df >5GB wolnego; lsof PUSTY (żaden z trzech portów nie jest zajęty)
```

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day196-sprzatanie-20260831` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6121`. Twój JEDYNY port harnessu to `5062 i 5063`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day196-pg`**. **ZAKAZANE:** `6012, 5433, 6047, 6054-6119, 5010-5059, 6404-6411 (odbiory nadzorcy i wcześniejsze dyżury), 6120/5060-5061 (dyżur 194 — równoległy), 6122/5064-5065 (dyżur 195 — równoległy). Twoje własne WYŁĄCZNIE 6121 i 5062/5063. ★ PORT 5000 ZAJĘTY NA STAŁE przez macOS Control Center. ★ PORT 5037 ZAJĘTY NA STAŁE przez adb (Android Debug Bridge)`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak — ten dyżur NIE wprowadza ani jednej nowej flagi i NIE zmienia wartości domyślnej żadnej istniejącej`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY196_SPRZATANIE_REPORT.md`. Ten dyżur jest wyjątkiem od schematu „jeden dokument” — R4 dotyka DWÓCH kart: `docs/program/waves/WAVE_03_ACCEPTANCE/modules/01_ORGANIZATION/MODULE_ACCEPTANCE.md` i `.../15_SETTINGS/MODULE_ACCEPTANCE.md`, w OBU wyłącznie sekcja „## Owner verdict” (pole `Decision:` + odesłanie do sekcji CLOSED_FINAL poniżej, bez kasowania pozostałych pól/historii). Zakaz zmiany tabel G00-G20, „Owner UI/UX/CX register”, samej sekcji „## CLOSED_FINAL — 2026-08-25” (to jest ŹRÓDŁO prawdy, z którego R4 tylko czerpie SHA/tag/datę) i wszystkich sekcji „STAN PO DYŻURZE …” w 15_SETTINGS. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day196-sprzatanie-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day196-sprzatanie-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **Zero szukania własnych znalezisk.** Cztery pozycje są już nazwane z dokładnym adresem plik:linia i cytatem dowodowym — jeśli podczas pracy zobaczysz coś PIĄTEGO wartego naprawy, ZGŁOŚ w raporcie jako inwentarz, NIE naprawiaj przy okazji (rozrost zakresu bez decyzji właściciela). ★★ **R1: NIE rozszerzasz współdzielonego typu `InitiativePreviewV3Model`** o `sourceFramework` — czytaj z `selectedRow` bezpośrednio w miejscu użycia (patrz T2); ten typ ma 4 innych konsumentów (`InitiativesHub.tsx`, `DiscoveryToolsHub.tsx` ×2, `ResultsInitiativesView.tsx`) poza `ExecutionHub.tsx`, rozszerzenie typu ma szerszy promień niż ta pozycja pozwala. ★★ **R2: to jest WYŁĄCZNIE zmiana komentarza.** Zero zmiany zachowania — `stripStatusActions`, `handleStatusAction`, `updateInitiativeStatusWriteTruth` zostają nietknięte kodowo. ★★ **R3: NIE kasujesz `SidebarUsage.tsx`.** Nawet jeśli T4 potwierdzi zero importerów, to jest inwentarz do raportu (decyzja właściciela), nie licencja na kasowanie w tym dyżurze — dokładnie jak ustalił to dyżur 176 dla tej samej pary plików. Kwarantanna (`_quarantine/`) OBU plików jest opcją WYŁĄCZNIE jeśli T4 pokaże, że `UsageMeters` też ma zero żywych importerów — miara dzisiejsza (patrz DLACZEGO) mówi, że tak NIE jest; jeśli Twój pomiar da inny wynik niż tu opisany, STOP i zgłoś rozbieżność zamiast iść dalej z założeniem sprzed pomiaru. ★★ **R4: NIE kasujesz sekcji „## Owner verdict” ani żadnego z jej pól** (`Accepted SHA`, `Date`, `Accepted-out/deferred`, `Evidence manifest`) — dopisujesz odesłanie do `CLOSED_FINAL` i aktualizujesz WYŁĄCZNIE wartość `Decision:`, zachowując poprzednią wartość widoczną (przekreślenie, wzorem errata FIX-181 dla `MTG-PF-003/004`), nie milczącym nadpisaniem. ★★ **NIE zmieniasz `CLOSED_FINAL` ani żadnej sekcji `STAN PO DYŻURZE …`** w żadnym z dwóch plików — to jest ŹRÓDŁO, z którego R4 czerpie SHA/tag, nie cel edycji. ★★ **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.** | **R1 (Execution):** `ExecutionHub.tsx:5680-5681` pokazuje `${t('common.source','Source')}: ${previewModel.sourceType}` — surowy slug (np. dosłownie „assessment”), nie ludzką etykietę. Kontekst dyżuru 178 (`INSTRUKCJA_DYZUR_178_OCENA_SOURCETYPE.md`, rekonesans zamknięcia 16 modułów): `InitiativeController.ts` naprawiono tak, że `sourceType` niesie już czystą wartość (np. `assessment`) OBOK osobnego pola `sourceFramework` (np. `DRD`, linia 367: `sourceFramework: i.source_framework`). `getSourceDisplayLabel` (`InitiativeSourceLink.tsx:12`) i wzorzec łączenia etykieta+szczegół (`InitiativePreviewV3.tsx:520-525`, separator ` · `) są już używane gdzie indziej (`InitiativesHub.tsx:1938`) — ExecutionHub jest jedynym miejscem tej rodziny widoków, które tego nie robi. **R2 (Initiatives):** `ODBIOR_172_EKRANY_NIEPRAWDA.md` (WERDYKT: SCALONO, ocena przycisku statusu **A**) zmierzył mutacyjnie, że `updateInitiativeStatusWriteTruth` woła realny `PATCH /initiatives/…/status`, a front i backend dzielą jedną funkcję autoryzacji (`canExecuteGate`) — po czym nazwał wprost dwie pozycje do sprzątnięcia przy najbliższym dotknięciu plików, pierwsza: „`InitiativeDocumentView.tsx` ~:5709 — komentarz DEC-104 twierdzi »no card-level status write path exists« — kłamie obok naprawionej ścieżki”. **R3 (Billing):** Rekonesans zamknięcia 16 modułów zmierzył: `UsageMeters.tsx:174` woła `t(...)` bez `useTranslation`/`const { t }` w pliku (potwierdzone dziś: `grep` nie zwraca nic) — realny bug w ŻYWYM, importowanym komponencie (`BillingSettings.tsx`, `BillingCore.tsx` importują go dziś; `SidebarUsage.tsx` też go importuje, ale SAM ma zero importerów w całym `src/`, potwierdzone dziś). Dyżur 176 miał tę samą naprawę w licencji (`body176.md` R2) — **zweryfikuj przed startem, czy trafiła na `codex/m03-admin-20260824` (Twoją `GALAZ_BAZOWA`); jeśli tak, ta pozycja jest już zrobiona i odpada** (patrz blok 0, T-command dedykowany temu sprawdzeniu). **R4 (dokumentacja):** `docs/program/waves/WAVE_03_ACCEPTANCE/modules/01_ORGANIZATION/MODULE_ACCEPTANCE.md` (linie 140-146: `Decision: PENDING`) i `.../15_SETTINGS/MODULE_ACCEPTANCE.md` (linie 93-98: `Decision: OWNER_UI_DIRECTION_ACCEPTED / TECHNICAL_BROWSER_FINDINGS_OPEN`) mają sekcję „Owner verdict” z nieaktualnym `Decision` NAD sekcją „CLOSED_FINAL — 2026-08-25” (linie 148-158 / 101-112) w tym samym pliku — ten sam dokument twierdzi dwie sprzeczne rzeczy o swoim własnym stanie zależnie od tego, którą sekcję czytelnik zobaczy pierwszą |

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
cd /private/tmp/cx-day196-sprzatanie

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day196-pg psql -U postgres -d cx196 \
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
cd /private/tmp/cx-day196-sprzatanie

docker run -d --name cx-day196-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx196 \
  -p 127.0.0.1:6121:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day196-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6121/cx196 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6121/cx196 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day196-sprzatanie && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6121/cx196 \
JWT_SECRET=cx196-test-secret-do-not-reuse \
npx vitest run src/components/Execution/__tests__ src/components/Initiatives/__tests__ src/components/billing/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day196-sprzatanie-artefakty/day196-vitest.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day196-sprzatanie && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run src/components/Execution/__tests__ src/components/Initiatives/__tests__ src/components/billing/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day196-sprzatanie-artefakty/day196-vitest.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day196-sprzatanie/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day196-pg psql -U postgres -d cx196 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day196-pg`.
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
> **(e) ★★ **Pierwsza (R1): rozróżnij `getSourceDisplayLabel` (etykieta rodzaju źródła, np. „Ocena”) od `sourceFramework` (konkretny framework w ramach tego rodzaju, np. „DRD”/„SIRI”/„ADMA”) — to DWIE różne rzeczy, obie warte pokazania, żadna nie zastępuje drugiej.** `getSourceDisplayLabel(sourceType)` (`InitiativeSourceLink.tsx:12-40`) tłumaczy slug typu (`assessment`→„Ocena”/„Assessment”) — bez tego RAZEM z frameworkiem użytkownik nadal nie wie, jaki to typ źródła. Żaden istniejący konsument (`InitiativesHub.tsx:1938`, `InitiativePreviewV3Footer` w `InitiativePreviewV3.tsx:520-525`) nie łączy dziś obu w jednym miejscu — najbliższy precedens separatora to `InitiativePreviewV3Footer` (`sourceDisplayType ... sourceId.slice(0,8)…`, separator ` · `, linie 520-525) — trzymaj się TEGO separatora dla spójności wizualnej z resztą modułu Initiatives, zamiast wymyślać nowy (np. nawiasy). Format sugerowany: `${sourceLabel} · ${sourceFramework}`, pokazywany TYLKO gdy `sourceFramework` jest niepuste (fallback do samego `sourceLabel`, jak dziś). **Druga (R1): `selectedRow` (typ `FullInitiative`) jest w zasięgu w TYM SAMYM bloku co `relations=` (linia 5557 `const selectedRow = selectedSummaryInitiative`, ten sam `if (activeTab === 'list')` blok co linia 5680) — czytaj `(selectedRow as any)?.sourceFramework` stamtąd, NIE przez `previewModel` (który nie ma tego pola w typie, patrz ZAKAZ).** ★★ **Trzecia (R2): to jest komentarz, nie logika — precyzyjnie zacytuj DOWÓD z `ODBIOR_172_EKRANY_NIEPRAWDA.md` w nowej treści (odbiór adwersaryjny, mutacja niezależnie odtworzona, DRAFT→PENDING_REVIEW 200+zapis / bez roli 403+0), nie tylko napisz "to nieprawda" bez wskazania SKĄD to wiadomo.** ★★ **Czwarta (R3): `t` bez importu w JSX nie zawsze wywala kompilację — sprawdź i wyjaśnij w raporcie DLACZEGO ten plik dziś się buduje mimo referencji do niezadeklarowanej zmiennej** (hipoteza: transpilacja/typecheck w trybie użytym przez ten build nie łapie zasięgu JSX-interpolacji identycznie jak pełny `tsc --noEmit`; zweryfikuj, nie zgaduj). Napraw dodając `import { useTranslation } from 'react-i18next';` i `const { t } = useTranslation();` wewnątrz `UsageMeters` (`UsageMeters.tsx:44`, wzorem `BillingCore.tsx:13/252` — TEN plik importuje `UsageMeters` i już ma poprawny wzorzec obok), zachowując istniejący klucz `billing.usage.resetsOn` i domyślny polski tekst bez zmiany treści. ★★ **Piąta (R4): `15_SETTINGS` ma INNĄ wartość `Decision` niż `01_ORGANIZATION`** (`OWNER_UI_DIRECTION_ACCEPTED / TECHNICAL_BROWSER_FINDINGS_OPEN` kontra `PENDING`) — nie kopiuj mechanicznie tekstu poprawki między dwoma plikami, dostosuj przekreślone-stare/nowe do TREŚCI każdego pliku osobno. `15_SETTINGS` ma też DWIE sekcje „STAN PO DYŻURZE …” PO `CLOSED_FINAL` (dyżur 55, dyżur 124) — te już poprawnie mówią „nie zmieniają decyzji właściciela, SHA ani tagu” i zostają nietknięte; Twoja poprawka dotyczy WYŁĄCZNIE sekcji `## Owner verdict` PRZED `CLOSED_FINAL`, nie tych po nim.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day196-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day196-sprzatanie-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`cztery pozycje równorzędne R1-R4, każda mała, nazwana i niezależna od pozostałych trzech — brak wspólnego rdzenia, wykonaj i udowodnij każdą osobno`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6121` albo `5062 i 5063` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6121` albo `5062 i 5063`** (`Z7`).

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

Cztery drobne, nazwane pozycje wyszły z czterech różnych, wcześniejszych odbiorów.
Żadna nie jest hipotezą postawioną dziś — każda ma dokładny adres plik:linia i
cytat dowodowy z dokumentu źródłowego. To jest sprzątanie, nie eksploracja.

**R1 — Execution pokazuje surowy `sourceType`.** `ExecutionHub.tsx:5680-5681`:

```ts
relations={
  previewModel.sourceType
    ? [{ label: `${t('common.source', 'Source')}: ${previewModel.sourceType}` }]
    : []
}
```

Dyżur 178 (`INSTRUKCJA_DYZUR_178_OCENA_SOURCETYPE.md`, rekonesans zamknięcia 16
modułów) naprawił backend tak, że `InitiativeController.ts` dziś emituje CZYSTY
`sourceType` (np. `assessment`) OBOK osobnego pola `sourceFramework` (linia 367:
`sourceFramework: i.source_framework`, np. `DRD`/`SIRI`/`ADMA`). `getSourceDisplayLabel`
(`InitiativeSourceLink.tsx:12-40`) tłumaczy slugi typu na etykiety i jest już
używana w analogicznym miejscu (`InitiativesHub.tsx:1938`) — ExecutionHub jest
dziś jedynym miejscem tej rodziny widoków (Execution/Initiatives/Discovery/Results
dzielą `InitiativePreviewV3Model`), które pokazuje surowy slug zamiast etykiety.

**R2 — DEC-104 kłamie obok naprawionej ścieżki.** `ODBIOR_172_EKRANY_NIEPRAWDA.md`
(WERDYKT: SCALONO, przycisk statusu oceniony **A**, mutacja odtworzona
niezależnie) zmierzył: `updateInitiativeStatusWriteTruth` woła realny
`PATCH /initiatives/…/status`, front i backend dzielą jedną funkcję autoryzacji
(`canExecuteGate`) — DRAFT→PENDING_REVIEW daje 200+zapis, bez roli 403+zero
zapisu. Ten sam odbiór nazwał wprost pozycję do sprzątnięcia:

> `InitiativeDocumentView.tsx` ~:5709 — komentarz DEC-104 twierdzi „no
> card-level status write path exists" — kłamie obok naprawionej ścieżki.

**R3 — `t()` bez importu w `UsageMeters.tsx`.** Rekonesans zamknięcia 16 modułów
zmierzył dokładnie ten bug (linia 174, `t('billing.usage.resetsOn', ...)` bez
`useTranslation`/`const { t }` w pliku) i ustalił, że komponent NIE jest martwy —
importują go `BillingSettings.tsx` i `BillingCore.tsx` obok martwego
`SidebarUsage.tsx` (który importuje `UsageMeters`, ale sam ma zero importerów w
całym `src/`). Dyżur 176 miał identyczną naprawę w swojej licencji (`body176.md`,
pozycja R2) — **to może już być zrobione na Twojej gałęzi bazowej**, sprawdź
przed startem (blok 0, T4b) zamiast dublować robotę.

**R4 — dwie karty odbioru twierdzą dwie sprzeczne rzeczy o sobie.**
`01_ORGANIZATION/MODULE_ACCEPTANCE.md` ma sekcję „## Owner verdict” z
`Decision: \`PENDING\`` (linia 142) BEZPOŚREDNIO NAD sekcją
„## CLOSED_FINAL — 2026-08-25” (linia 148, `Werdykt właściciela: DEC-2026-08-24-11`
i `DEC-2026-08-24-15`, Final SHA `b5aa07a28f`, tag `final-01-organization`).
`15_SETTINGS/MODULE_ACCEPTANCE.md` ma ten sam kształt sprzeczności: `Decision:
\`OWNER_UI_DIRECTION_ACCEPTED / TECHNICAL_BROWSER_FINDINGS_OPEN\`` (linia 95) nad
„## CLOSED_FINAL — 2026-08-25” (linia 101, `DEC-2026-08-25-16`, Final SHA
`d5a1b6a99e`, tag `final-02-settings`). W obu plikach czytelnik, który zatrzyma
się na sekcji „Owner verdict”, dowie się czegoś przeciwnego niż ten sam dokument
mówi kawałek niżej.

# 2. TEZY ZLECENIA

- **T1.** Cztery pozycje są niezależne od siebie — brak wspólnej przyczyny, brak
  współdzielonych plików. Wykonaj i udowodnij każdą osobno; kolejność dowolna.
- **T2.** R1 wymaga DWÓCH rzeczy naraz (etykieta typu + framework), nie jednej —
  `getSourceDisplayLabel` i `sourceFramework` to różne wartości o różnym
  przeznaczeniu, żadna nie zastępuje drugiej.
- **T3.** R2 jest wyłącznie zmianą komentarza — zero zmiany zachowania kodu.
- **T4.** R3 wymaga POMIARU przed decyzją: `UsageMeters.tsx` ma dziś dwóch żywych
  importerów (`BillingSettings.tsx`, `BillingCore.tsx`) — to rozstrzyga na FIX,
  nie kwarantannę. `SidebarUsage.tsx` (zero importerów) zostaje osobnym wpisem
  inwentarzowym, nie kasujesz go w tym dyżurze.
- **T5.** R4 dotyka DWÓCH dokumentów (wyjątek od zwykłego schematu „jeden
  dokument do zmiany”) — każdy z inną dzisiejszą wartością `Decision`, popraw
  osobno, nie kopiuj tekstu między plikami.

# 3. POZYCJE DYŻURU

## R1 — Execution: etykieta źródła zamiast surowego sluga

Plik: `src/components/Execution/ExecutionHub.tsx`.

W bloku `if (activeTab === 'list')` (ten sam blok, w którym linia 5557 deklaruje
`const selectedRow = selectedSummaryInitiative;` i linia 5558
`const previewModel = selectedRow ? mapToPreviewModel(selectedRow) : null;`),
dodaj lokalne stałe tuż obok `previewModel` (nie w osobnej funkcji, ten sam
zasięg co `relations=` kilkadziesiąt linii niżej):

```ts
const sourceLabel = previewModel?.sourceType
  ? getSourceDisplayLabel(previewModel.sourceType)
  : '';
const sourceFrameworkValue = String((selectedRow as any)?.sourceFramework || '').trim();
```

Zmień `relations=` (linie 5679-5683) tak, żeby użyć `sourceLabel` zamiast
surowego `previewModel.sourceType`, i doklej `sourceFrameworkValue`, gdy jest
niepuste, separatorem ` · ` — wzorem `InitiativePreviewV3Footer`
(`InitiativePreviewV3.tsx:520-525`: `sourceDisplayType ? (sourceId ?
\`${sourceDisplayType} · ${sourceId.slice(0,8)}…\` : sourceDisplayType) : '—'`),
jedyny istniejący w tym module precedens łączenia etykiety z drugą wartością:

```ts
relations={
  sourceLabel
    ? [
        {
          label: `${t('common.source', 'Source')}: ${
            sourceFrameworkValue ? `${sourceLabel} · ${sourceFrameworkValue}` : sourceLabel
          }`,
        },
      ]
    : []
}
```

Dodaj import `getSourceDisplayLabel` z `../Initiatives/InitiativeSourceLink` w
bloku importów lokalnych, w kolejności alfabetycznej z sąsiadami (`../Initiatives/InitiativeCompactPanel`
linia 97, `../Initiatives/InitiativePreviewV3` linia 98 — nowy import wchodzi PO
`InitiativePreviewV3`, PRZED `../MyWork/Executive/PortfolioHealthScore` linia 99).

**NIE dodawaj `sourceFramework` do typu `InitiativePreviewV3Model`**
(`InitiativePreviewV3.tsx:27-45`) — ten typ ma dziś 4 innych konsumentów poza
`ExecutionHub.tsx` (`InitiativesHub.tsx`, `DiscoveryToolsHub.tsx` w dwóch
miejscach, `ResultsInitiativesView.tsx`); czytaj `sourceFramework` bezpośrednio z
`selectedRow` (typ `FullInitiative`, pole nietypowane, stąd `as any` — dokładnie
ten sam wzorzec co reszta `mapToPreviewModel`, np. linia 1998 `(i as any).axis`).

**Ukończone, gdy:** panel preview dla inicjatywy ze źródłem `assessment` +
`sourceFramework=DRD` pokazuje ludzką etykietę i framework (nie surowy slug),
render inicjatywy BEZ `sourceFramework` pokazuje samą etykietę (bez pustego
separatora), a render bez `sourceType` w ogóle nadal pokazuje `relations={[]}`.

## R2 — Initiatives: poprawka treści komentarza DEC-104

Plik: `src/components/Initiatives/InitiativeDocumentView.tsx`, linie ok.
5709-5712. Zamień treść komentarza (WYŁĄCZNIE komentarz, zero zmiany kodu wokół)
tak, żeby zamiast twierdzić brak ścieżki zapisu, wyjaśniała PRAWDZIWY powód, dla
którego `stripStatusActions` bywa puste — brak WYKONYWALNEGO przejścia dla
aktualnego użytkownika/stanu w `gateReadiness`, nie brak funkcji zapisu — i
wskazywała, gdzie ta ścieżka realnie żyje oraz jaki dowód ją potwierdza:

```ts
// DEC-104 (poprawione dyżurem 196, 2026-08-31 — pierwotne twierdzenie
// obalone przez odbiór 172): `stripStatusActions` bywa puste, gdy
// `gateReadiness.availableTransitions` nie oferuje żadnego wykonywalnego
// przejścia dla bieżącego użytkownika/stanu — NIE dlatego, że brakuje
// ścieżki zapisu na poziomie karty. Ścieżka zapisu istnieje i działa: to
// samo `onChange` wywołuje `handleStatusAction` (linia ~3025) →
// `updateInitiativeStatusWriteTruth` (linia ~3148), realny
// `PATCH /initiatives/:id/status`. Zweryfikowane mutacyjnie przez odbiór 172
// (docs/program/funkcje/ODBIOR_172_EKRANY_NIEPRAWDA.md): DRAFT→PENDING_REVIEW
// zwraca 200 i zapisuje; bez uprawnionej roli zwraca 403 i nie zapisuje nic.
// Title poniżej wyjaśnia WŁAŚCIWY powód pustej listy przejść, nie brak funkcji.
```

Dopasuj dokładne brzmienie do stylu reszty pliku (angielski dla komentarzy
technicznych, jak oryginał) — powyższe jest treścią do przekazania, nie
literalnym blokiem do wklejenia bez czytania kontekstu wokół.

**Ukończone, gdy:** `grep -n "no card-level status write path exists"` w tym
pliku zwraca ZERO trafień; nowy komentarz cytuje konkretny dowód (odbiór 172) i
konkretne linie (`handleStatusAction`, `updateInitiativeStatusWriteTruth`); zero
zmian w `stripStatusActions`/`statusActions`/`handleStatusAction` samych.

## R3 — Billing: `t()` bez importu w `UsageMeters.tsx`

Plik: `src/components/billing/UsageMeters.tsx`. **Najpierw zmierz** (blok 0, T4):
policz importerów `UsageMeters` i `SidebarUsage` osobno. Oczekiwany wynik (z
weryfikacji dzisiejszej, potwierdź sam): `UsageMeters` — importują `SidebarUsage.tsx`,
`BillingSettings.tsx`, `BillingCore.tsx` (dwa ŻYWE); `SidebarUsage` — importuje go
WYŁĄCZNIE własny plik (zero importerów).

**Jeśli pomiar się zgadza z oczekiwanym** (UsageMeters ma żywych importerów poza
`SidebarUsage`): napraw dodając brakujący import, WEWNĄTRZ komponentu
(`UsageMeters.tsx:44`, `export const UsageMeters: React.FC<UsageMetersProps> = (...) => {`):

```ts
import { useTranslation } from 'react-i18next';
```

(w bloku importów na górze pliku, obok istniejącego `import { AlertTriangle,
Database, HardDrive } from 'lucide-react';` i `import React from 'react';`) oraz:

```ts
const { t } = useTranslation();
```

(pierwsza linia ciała komponentu), wzorem `BillingCore.tsx` (linia 13 import,
linia 252 hook — TEN plik importuje `UsageMeters` i ma już poprawny wzorzec
obok). Zachowaj istniejący klucz `billing.usage.resetsOn` i domyślny polski
tekst w linii 174 BEZ zmiany treści.

**Jeśli pomiar pokaże coś INNEGO** niż oczekiwane (np. `BillingSettings.tsx`/
`BillingCore.tsx` już nie importują `UsageMeters`, albo import `useTranslation`
już istnieje — np. bo dyżur 176 to zrobił na Twojej gałęzi bazowej wcześniej):
STOP, zapisz w raporcie dokładny wynik pomiaru i albo pomiń pozycję jako „już
zrobione” (jeśli import już istnieje), albo rozważ kwarantannę `_quarantine/`
dla OBU plików (`UsageMeters.tsx` + `SidebarUsage.tsx`) TYLKO jeśli pomiar
faktycznie potwierdzi zero żywych importerów całego łańcucha — nie idź dalej z
założeniem sprzed pomiaru.

`SidebarUsage.tsx` (martwy, zero importerów) NIE kasujesz w żadnym z dwóch
przypadków — dopisz do inwentarza w raporcie: pełna ścieżka, dowód (`grep -rln`),
i że po naprawie R3 przestał dziedziczyć bug `t()` (gdyby kiedyś został
podłączony) — decyzja o skasowaniu/podłączeniu należy do właściciela.

**Ukończone, gdy:** `UsageMeters` renderuje się bez `ReferenceError`/ostrzeżenia
o niezadeklarowanej zmiennej `t` dla scenariusza z niepustym `usage.periodEnd`
(smoke-test w `src/components/billing/__tests__/`, wzorem istniejącego
`AddCardModal.honest.test.tsx` w tym samym katalogu — sprawdź jego strukturę
przed pisaniem nowego pliku); tekst nadal pokazuje poprawną polską frazę z
podstawioną datą; raport zawiera jednoznaczny wpis inwentarzowy dla
`SidebarUsage.tsx` z cytatem dowodu.

## R4 — dokumentacja: sprzeczny werdykt w dwóch kartach MODULE_ACCEPTANCE

Dwa pliki, każdy osobno, wzorem errata FIX-181 (`docs/program/waves/WAVE_03_ACCEPTANCE/modules/08_MEETINGS/MODULE_ACCEPTANCE.md`,
sekcja „Errata (FIX-181, 2026-08-30)” — przekreślenie starej wartości + jawne
wyjaśnienie, ZERO kasowania):

**`01_ORGANIZATION/MODULE_ACCEPTANCE.md`**, sekcja „## Owner verdict” (linie
140-146). Zmień WYŁĄCZNIE linię `Decision:` — zachowaj starą wartość widoczną
(przekreślenie), dodaj nową wartość i odesłanie:

```
Decision: ~~`PENDING`~~ → `CLOSED_FINAL` — patrz „CLOSED_FINAL — 2026-08-25”
poniżej (Werdykt właściciela: DEC-2026-08-24-11, DEC-2026-08-24-15; Final SHA
`b5aa07a28f`; tag `final-01-organization`). Ten wiersz niósł stan sprzed
odbioru właściciela; poprawka dyżuru 196, 2026-08-31.
```

Pozostałe pola sekcji (`Accepted SHA`, `Date`, `Accepted-out/deferred`, `Evidence
manifest`) zostają — dopasuj je do treści `CLOSED_FINAL` PONIŻEJ, jeśli mają dziś
wartość `—` (patrz treść sekcji CLOSED_FINAL dla SHA/daty/evidence — `evidence-m01-20260824/`).

**`15_SETTINGS/MODULE_ACCEPTANCE.md`**, sekcja „## Owner verdict” (linie 93-98).
Ta karta ma INNĄ dzisiejszą wartość `Decision` — nie kopiuj tekstu z
01_ORGANIZATION:

```
Decision: ~~`OWNER_UI_DIRECTION_ACCEPTED / TECHNICAL_BROWSER_FINDINGS_OPEN`~~ →
`CLOSED_FINAL` — patrz „CLOSED_FINAL — 2026-08-25” poniżej (Werdykt
właściciela: DEC-2026-08-25-16; Final SHA `d5a1b6a99e`; tag `final-02-settings`).
Ten wiersz niósł stan sprzed odbioru właściciela; poprawka dyżuru 196, 2026-08-31.
```

`Accepted-out/deferred` w tym pliku ma realną treść (destructive deletion/OAuth/
MFA deferred) — ZOSTAJE bez zmian, to wciąż aktualna informacja, nie dotyczy
sprzeczności `Decision`. Sekcje „STAN PO DYŻURZE 55” i „STAN PO DYŻURZE 124”
(już PO `CLOSED_FINAL` w tym pliku) już poprawnie mówią „nie zmieniają decyzji
właściciela, SHA ani tagu” — zostają nietknięte.

**Ukończone, gdy:** w OBU plikach `grep -n "^Decision:"` w sekcji „Owner verdict”
zwraca `CLOSED_FINAL` jako aktualną (nie przekreśloną) wartość; stara wartość
zostaje czytelna (przekreślona), nie skasowana; sekcje `CLOSED_FINAL` i „STAN PO
DYŻURZE …” w 15_SETTINGS nietknięte.

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis | `src/components/Execution/ExecutionHub.tsx` — wyłącznie blok `relations=` (linie ok. 5679-5683), nowe lokalne stałe `sourceLabel`/`sourceFrameworkValue` w tym samym zasięgu (ok. linia 5558), i nowy import `getSourceDisplayLabel` |
| Zapis | `src/components/Initiatives/InitiativeDocumentView.tsx` — wyłącznie treść komentarza DEC-104 (linie ok. 5709-5712); zero zmian kodu |
| Zapis | `src/components/billing/UsageMeters.tsx` — wyłącznie import `useTranslation` i hook `const { t }`; zakaz zmiany treści komunikatu i klucza `billing.usage.resetsOn` |
| Zapis | testy R1 (`src/components/Execution/__tests__/`) i R3 (`src/components/billing/__tests__/`) — lokalizację/konwencję potwierdź wg sąsiadów w każdym katalogu |
| Zapis | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/01_ORGANIZATION/MODULE_ACCEPTANCE.md` — wyłącznie pole `Decision:` w sekcji „## Owner verdict” (linie ok. 140-146) |
| Zapis | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/15_SETTINGS/MODULE_ACCEPTANCE.md` — wyłącznie pole `Decision:` w sekcji „## Owner verdict” (linie ok. 93-98) |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY196_SPRZATANIE_REPORT.md` |
| Zapis (warunkowo) | `_quarantine/` dla `UsageMeters.tsx` + `SidebarUsage.tsx` — WYŁĄCZNIE jeśli pomiar T4 obali oczekiwany wynik i potwierdzi zero żywych importerów całego łańcucha (patrz R3) |
| Odczyt | `src/components/Initiatives/InitiativeSourceLink.tsx` — `getSourceDisplayLabel`; **nie zmieniasz** |
| Odczyt | `src/components/Initiatives/InitiativePreviewV3.tsx` — typ `InitiativePreviewV3Model`, wzorzec separatora w `InitiativePreviewV3Footer`; **nie zmieniasz** (zakaz rozszerzania typu, patrz ZAKAZ) |
| Odczyt | `server/src/controllers/InitiativeController.ts` — pochodzenie `sourceFramework`; **nie zmieniasz** |
| Odczyt | `src/components/Initiatives/InitiativeDocumentView.tsx` — `statusActions`/`stripStatusActions`/`handleStatusAction`/`updateInitiativeStatusWriteTruth` (linie 1418, 1438, 3025, 3148) — kontekst dla R2; **nie zmieniasz** poza samym komentarzem |
| Odczyt | `docs/program/funkcje/ODBIOR_172_EKRANY_NIEPRAWDA.md`, `docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_178_OCENA_SOURCETYPE.md` — dowody R1/R2; **nie zmieniasz** |
| Odczyt | `src/components/shared/BillingCore.tsx`, `src/components/settings/BillingSettings.tsx` — importerzy `UsageMeters`, wzorzec `useTranslation`; **nie zmieniasz** |
| Odczyt | `src/components/SidebarUsage.tsx` — dowód inwentarza R3; **nie zmieniasz, nie kasujesz** (poza warunkowym `_quarantine/`, patrz wyżej) |
| Odczyt | sekcje „## CLOSED_FINAL — 2026-08-25” w obu plikach `MODULE_ACCEPTANCE.md` — źródło SHA/tag/daty dla R4; **nie zmieniasz** |

★ **Rozłączność z dyżurem 194 (równoległym):** 194 dotyka wyłącznie `src/components/Meeting/**`,
`server/src/routes/meeting.routes.ts`, `server/src/index.ts`, `08_MEETINGS/MODULE_ACCEPTANCE.md`
— zero pokrycia z tabelą powyżej.

# 5. TWARDE ZASADY

- ★★ **Zero szukania własnych znalezisk.** Cztery pozycje mają dokładny adres —
  jeśli zobaczysz coś piąte, zapisz w raporcie jako inwentarz, nie naprawiaj.
- ★★ **R1: nie rozszerzasz `InitiativePreviewV3Model`** — czytaj `sourceFramework`
  z `selectedRow` bezpośrednio, ten typ ma 4 innych konsumentów.
- ★★ **R2 jest wyłącznie komentarzem** — zero zmiany zachowania.
- ★★ **R3: nie kasujesz `SidebarUsage.tsx`** bez potwierdzonego pomiarem zerowego
  łańcucha importerów `UsageMeters` — miara dzisiejsza mówi FIX, nie kwarantanna;
  jeśli Twój pomiar da inny wynik, STOP i zgłoś, zanim pójdziesz dalej.
- ★★ **R4: nie kasujesz sekcji „Owner verdict” ani jej pól** — przekreślasz starą
  wartość, dopisujesz nową z odesłaniem; `CLOSED_FINAL` i sekcje „STAN PO
  DYŻURZE …” w 15_SETTINGS zostają nietknięte.
- **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.**
- Pułapka: `No test files found` NIE jest `PASS`. Sprawdź `numTotalTests` > 0.
- ★ Port **5000 zajęty na stałe przez macOS Control Center**, **5037 przez adb**.
- **Każdą cytowaną linię kodu/dokumentu sprawdzasz sam przed wklejeniem do
  raportu.** Numery w tej instrukcji zweryfikowano wobec markera `6894f3da05`,
  ale pliki żyją.
- **Sekcja „TWIERDZENIA NIEZWERYFIKOWANE” w raporcie jest obowiązkowa.** Wypisz
  w niej wprost co najmniej: czy R3 był już zrobiony na Twojej gałęzi bazowej
  przed startem (T4b); czy pomiar importerów `UsageMeters`/`SidebarUsage` w R3
  zgadzał się z oczekiwanym wynikiem instrukcji, czy różnił się (i jak); oraz
  czy w 15_SETTINGS istnieje jeszcze jakiś TRZECI dokument (poza dwoma sekcjami
  „STAN PO DYŻURZE”) odnoszący się do starej wartości `Decision`, którego ta
  poprawka nie objęła.
