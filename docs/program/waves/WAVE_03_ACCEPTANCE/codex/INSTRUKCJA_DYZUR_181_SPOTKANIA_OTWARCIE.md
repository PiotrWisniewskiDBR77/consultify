# INSTRUKCJA DYŻURU nr 181 — Codex — „Otwarcie bety Spotkan (D-1) — flaga MODULE_MEETING na open, komplet zrzutow kanonicznym runtime i dowod, ze zwykly MEMBER wchodzi"

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
> **wyłącznie** `/private/tmp/cx-day181-spotkania-otwarcie`.

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
Zakres: **Meetings (moduł 08) — jedyny przełącznik SSOT `BETA_MENU_STATUS.MODULE_MEETING` steruje jednocześnie sidebarem, trasą frontu (`BetaGate`) i bramką API serwera (`closedBetaModuleGate`). Decyzja właściciela D-1 (`DECYZJE_WLASCICIELA_2026-08-30_WIECZOR.md`): otwieramy OD RAZU, zrzuty i odbiór wizualny idą PO otwarciu (właściciel nigdy nie widział modułu na żywo)**.
Trasy front: ``src/utils/betaMenuStatus.ts:57` (SSOT), `src/utils/betaAccess.ts:65-89` (`lockClosedBetaModules`, sidebar), `src/components/ProtectedRoute.tsx:105-142` (`BetaGate`, redirect do `/chat`), `src/routes/AppRoutes.tsx:2615-2740` (5 tras `/meeting` + `/meetings/**` owinięte `<BetaGate moduleId="MODULE_MEETING">`), `src/components/navigation/Sidebar/menuConfig.ts:175-181` (wpis menu), `src/components/Meeting/MeetingHub.tsx`, `src/components/Meeting/MeetingObjectPage.tsx`, `src/utils/pilotAccess.ts:72` (odczyt tej samej flagi, nie dotykasz)`. Trasy tył: ``server/src/sharedRuntime/utils/betaMenuStatus.ts:58` (GENEROWANY MIRROR — nie edytujesz ręcznie, tylko `node scripts/cleanup/sync-server-runtime-mirrors.mjs`), `server/src/middleware/betaGate.middleware.ts:19-46` (`createModuleGate`/`closedBetaModuleGate`), `server/src/routes/meeting.routes.ts:301-304` (montaż `verifyToken → isAuthenticated → closedBetaModuleGate`)`.

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
WT=/private/tmp/cx-day181-spotkania-otwarcie
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
git -C "$VAULT" worktree add "$WT" -b codex/day181-spotkania-otwarcie-20260830 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day181-spotkania-otwarcie/config.worktree"
cat "$VAULT/worktrees/cx-day181-spotkania-otwarcie/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day181-spotkania-otwarcie-scratch
mkdir -p /private/tmp/cx-day181-spotkania-otwarcie-artefakty

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
git -C "$WT" push github-backup codex/day181-spotkania-otwarcie-20260830
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 18661cc6a0..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `siedem` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day181-spotkania-otwarcie

# (T1) FLAGA DZIŚ ZAMKNIĘTA — DOKŁADNIE DWA WYSTĄPIENIA (klient + mirror)
grep -n "MODULE_MEETING: 'closed'" src/utils/betaMenuStatus.ts server/src/sharedRuntime/utils/betaMenuStatus.ts
#   oczekiwane: linia 57 w src/utils/betaMenuStatus.ts, linia 58 w mirrorze — oba 'closed'.
#   Jeśli linie się przesunęły, dopasuj się do TREŚCI, nie do numeru.

# (T2) JEDYNY SWITCH STERUJE TRZEMA WARSTWAMI NARAZ — potwierdź to w kodzie,
# zanim założysz, że wystarczy zmienić jeden plik
grep -n "BETA_MENU_STATUS\[moduleId\]\|createModuleGate('MODULE_MEETING')" server/src/middleware/betaGate.middleware.ts
grep -n "isBetaClosed(moduleId)" src/components/ProtectedRoute.tsx
#   oczekiwane: middleware serwera czyta MIRROR (server/src/sharedRuntime/...), BetaGate frontu
#   czyta src/utils/betaAccess.ts -> betaMenuStatus.ts. DWA NIEZALEŻNE pliki muszą się zgadzać —
#   stąd obowiązek uruchomienia sync-server-runtime-mirrors.mjs, nie samej edycji src/.

# (T3) CZTERY ZASTANE TESTY ZAŁOŻĄ 'closed' I PO FLIPIE MUSZĄ SIĘ ZŁAMAĆ —
# policz je, zanim zaczniesz, żeby wiedzieć, że Twoja zmiana faktycznie coś rusza
grep -n "toBe('closed')\|status).toBe(403)\|BETA_LOCKED" tests/unit/finance/financeFallbackGating.test.ts \
  tests/unit/backend/middleware/meetingBetaGate.test.ts \
  server/src/routes/__tests__/meeting.betaGate.gateway.day57.pg.test.ts \
  tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts
#   oczekiwane: trafienia w KAŻDYM z czterech plików. Uruchom je PRZED zmianą (BLOK 0) i zapisz
#   wynik do artefaktów jako punkt odniesienia "przed".

# (T4) CO NAPRAWDĘ CZYTA financeFallbackGating.test.ts — MODULE_MEETING tam jest
# WZORCEM "zamkniętego" modułu dla NIEZWIĄZANEJ funkcji (Finance fallback), nie testem Meetings
sed -n '60,146p' tests/unit/finance/financeFallbackGating.test.ts
#   oczekiwane: describe "beta gating — MODULE_MEETING (Meeting) is closed" używa MODULE_MEETING
#   jako PRZYKŁADU zamkniętej bety dla testów lockClosedBetaModules/isBetaLockedForRole — po
#   flipie ten przykład przestaje być prawdziwy i wymaga świadomej decyzji (patrz R1 pkt 2).

# (T5) TRASA /meetings I 4 SIOSTRZANE SĄ DZIŚ OWINIĘTE BetaGate — policz OWINIĘCIA
grep -n 'BetaGate moduleId="MODULE_MEETING"' src/routes/AppRoutes.tsx
#   oczekiwane: dokładnie 5 wystąpień (ROOT, OBJECT, MINUTES, DECISIONS, NOTE) — MINUTES/DECISIONS/
#   NOTE renderują dziś TEN SAM komponent MeetingObjectPage (stage 1, patrz komentarz nad ROOT ~2632).

# (T6) STAN RUNTIME HARNESSU — nazwa rodziny meetings w adoptedFixtureContracts
grep -n "consultify_w3_meetings_owner" scripts/dev/start-wave3-owner-runtime.mjs scripts/dev/seed-wave3-meetings-owner-review.mjs
#   oczekiwane: regex ^consultify_w3_meetings_owner_[a-z0-9_]+$ w OBU plikach, fixtureId
#   W3-MEETINGS-OWNER-v1. Twoja BAZA (consultify_w3_meetings_owner_cx181) MUSI pasować —
#   przeczytaj docs/program/funkcje/ODBIOR_177_PARTNER_STOP.md PRZED startem runtime: dyżur 177
#   stanął 0/25 na starcie właśnie dlatego, że użył gołego "cx177" zamiast prefiksu rodziny.

# (T7) PORT I MIEJSCE NA DYSKU
df -h /
lsof -nP -iTCP:6090 -iTCP:5032 -iTCP:5033 -sTCP:LISTEN
#   oczekiwane: df >5GB wolnego; lsof PUSTY (żaden z trzech portów nie jest zajęty)
```

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day181-spotkania-otwarcie-20260830` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6090`. Twój JEDYNY port harnessu to `5032 i 5033`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day181-pg`**. **ZAKAZANE:** `6012, 5433, 6047, 6054-6088, 5010-5029, 6404-6408 (odbiory nadzorcy i wcześniejsze dyżury), 6089/5030-5031 (dyżur 180), 6093-6096/5038-5045 (dyżury 184-187). ★ TRÓJKA RÓWNOLEGŁA — dodatkowo zakazane: 6091/5034-5035 (dyżur 182 — Czat) i 6092/5036-5037 (dyżur 183 — Moja praca). Twoje własne to WYŁĄCZNIE 6090 i 5032/5033. ★ PORT 5000 ZAJĘTY NA STAŁE przez macOS Control Center`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `★★ JEDYNA zmiana wartości domyślnej w tym dyżurze: `BETA_MENU_STATUS.MODULE_MEETING` w `src/utils/betaMenuStatus.ts:57` z `'closed'` na `'open'`, plus regeneracja mirrora serwera (`server/src/sharedRuntime/utils/betaMenuStatus.ts:58`) skryptem `node scripts/cleanup/sync-server-runtime-mirrors.mjs` — NIE edytujesz mirrora ręcznie, `npm run build` w `server/` ma drift-check. Zero innych flag. `BETA_ADMINS_EXEMPT` (zawsze `true`) zostaje nietknięta`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY181_SPOTKANIA_OTWARCIE_REPORT.md`. `docs/program/waves/WAVE_03_ACCEPTANCE/modules/08_MEETINGS/MODULE_ACCEPTANCE.md` — WYŁĄCZNIE sekcja „Integrator preflight observations” (nowe wiersze `MTG-PF-003` i dalej dla R2, technicznymi obserwacjami integratora, NIE „Piotr original wording” — właściciel jeszcze nic nie widział). Zakaz zmiany tabeli G00-G20, „Owner UI/UX/CX register” i „Owner verdict” — te należą do właściciela. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day181-spotkania-otwarcie-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day181-spotkania-otwarcie-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **NIE NAPRAWIASZ znanych defektów wizualnych/funkcjonalnych modułu w tym dyżurze.** `MODULE_ACCEPTANCE.md` G08-G10 już rejestrują: tytuły tabeli/kalendarza się ucinają, karta Details pokazuje surowe ID użytkowników i „Organizer null null”, interfejs jest w większości angielski, a `GET /decision-records` zwraca `[]` mimo zapisanej zgubionej decyzji w `meeting_notes.decisions_json` (G09, root cause udowodniony, NIE naprawiony). R2 ma je ZOBACZYĆ i wpisać do inwentarza (potwierdzić czy nadal żywe), nie naprawić — naprawa to osobny dyżur po akcepcie Piotra na zrzutach. ★★ **NIE ZMIENIASZ `dispatchKey`/`BetaGate`/`ProtectedRoute.tsx` poza tym, czego wymaga test regresji z R1** — `BetaGate` obsługuje 8+ innych modułów (Case Workspace, Audits, Economics, Presentations, Tabele…), zero zmian jego logiki. ★★ **NIE DOTYKASZ `src/utils/pilotAccess.ts`** — czyta tę samą flagę pośrednio (`isBetaClosed('MODULE_MEETING')` w warunku na linii 72) i automatycznie przestanie blokować po Twoim flipie; jeśli test tego nie potwierdza, zgłoś jako znalezisko, nie poprawiaj pliku. ★★ **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji** — wyłącznie lokalny kontener `cx-day181-pg`. | Decyzja właściciela D-1 (`docs/program/funkcje/DECYZJE_WLASCICIELA_2026-08-30_WIECZOR.md`, wiersz D-1): „Spotkania: otworzyć betę? TAK, OD RAZU (nie czekamy na zrzuty)”. Moduł 08 Meetings ma status `TECHNICAL_BROWSER_PASS / OWNER_REVIEW_PENDING` w `docs/program/waves/WAVE_03_ACCEPTANCE/modules/08_MEETINGS/MODULE_ACCEPTANCE.md` — mechanika istnieje i przeszła techniczny przegląd (G05 `PASS_TECHNICAL_BROWSER`), ale właściciel NIGDY nie widział ekranów na żywo (reguła 7 CLAUDE.md: Piotr nigdy nie jest pierwszym testerem wizualnym). Ten dyżur wykonuje literalnie D-1: otwiera flagę, a potem — dopiero PO otwarciu — robi kompletny, czysty zestaw zrzutów jako materiał do akceptu, zamiast czekać z otwarciem na akcept |

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
cd /private/tmp/cx-day181-spotkania-otwarcie

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day181-pg psql -U postgres -d consultify_w3_meetings_owner_cx181 \
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
cd /private/tmp/cx-day181-spotkania-otwarcie

docker run -d --name cx-day181-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=consultify_w3_meetings_owner_cx181 \
  -p 127.0.0.1:6090:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day181-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6090/consultify_w3_meetings_owner_cx181 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6090/consultify_w3_meetings_owner_cx181 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day181-spotkania-otwarcie && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6090/consultify_w3_meetings_owner_cx181 \
JWT_SECRET=cx181-test-secret-do-not-reuse \
npx vitest run server/src/routes/__tests__/meeting.betaGate.gateway.day57.pg.test.ts tests/unit/backend/middleware/meetingBetaGate.test.ts tests/unit/finance/financeFallbackGating.test.ts tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts src/routes/__tests__/meetingsCanonicalRoute.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day181-spotkania-otwarcie-artefakty/day181-vitest.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day181-spotkania-otwarcie && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/routes/__tests__/meeting.betaGate.gateway.day57.pg.test.ts tests/unit/backend/middleware/meetingBetaGate.test.ts tests/unit/finance/financeFallbackGating.test.ts tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts src/routes/__tests__/meetingsCanonicalRoute.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day181-spotkania-otwarcie-artefakty/day181-vitest.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day181-spotkania-otwarcie/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day181-pg psql -U postgres -d consultify_w3_meetings_owner_cx181 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day181-pg`.
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
> **(e) ★★ **Pierwsza, i to jest sedno T4: `tests/unit/finance/financeFallbackGating.test.ts` NIE jest testem Meetings — używa `MODULE_MEETING` jako STABILNEGO PRZYKŁADU zamkniętej bety, żeby przetestować generyczne `isBetaLockedForRole`/`lockClosedBetaModules`/`getBetaStatus` z `betaAccess.ts`.** Linie 64-68 (`expect(BETA_MENU_STATUS.MODULE_MEETING).toBe('closed')` itd.) i linie 130-146 (`lockClosedBetaModules` blokuje fałszywy wpis menu `{id:'MODULE_MEETING'}`) złamią się WPROST po flipie — `isBetaClosed('MODULE_MEETING')` zacznie zwracać `false`, więc funkcja przestanie blokować ten przykładowy wpis menu. To NIE jest regresja Twojej zmiany, to jest zastały test, który wybrał zły moduł jako przykład. Napraw go PODMIENIAJĄC przykładowy moduł na coś, co ZOSTAJE zamknięte po tym dyżurze — najbezpieczniejszy kandydat to `MODULE_CASE_WORKSPACE` (zamknięty podwójnie: `betaMenuStatus.ts` + osobna flaga runtime `isCaseWorkspaceEnabled()`, więc nie zgaśnie przy najbliższym kolejnym flipie tak łatwo jak Economics, który już ma zaplanowany flip po DEC-2026-08-28-177). Zmieniasz WYŁĄCZNIE identyfikator modułu użyty jako przykład w tym pliku — nie ruszasz `shouldFallbackToLegacyFinance` ani reszty pliku. ★★ **Druga: `server/src/routes/__tests__/meeting.betaGate.gateway.day57.pg.test.ts` ma DWIE grupy testów o różnym losie.** Grupa „Day 57 Meeting beta gate — real Gateway state” (linie ok. 22-63) woła REALNY `ApiGateway` i REALNĄ `closedBetaModuleGate` bez żadnego mocka — test `'MEMBER is denied by the real closed beta gate'` (`expect(response.status).toBe(403)`) złamie się i MUSI zostać odwrócony na `expect(response.status).toBe(200)` (i `response.body.code` nie jest `BETA_LOCKED`) — **to jest naturalny dom dla dowodu z R3 „MEMBER wchodzi”, nie pisz nowego testu od zera, rozszerz ten**. Druga grupa „isolated public switch contract” (na końcu pliku) wymusza status jawnym argumentem (`createModuleGate('MODULE_MEETING', () => 'open')`) i PRZEJDZIE bez zmian — nie myl tych dwóch grup. ★★ **Trzecia: `tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts` GF-06 (`'GF-06 mirrors the closed MODULE_MEETING boundary after authentication'`) na realnym Postgresie (wymaga `DATABASE_URL` + `DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1`) też zakłada 403 dla `member()` — odwróć na 200, przemianuj opis testu (nie jest już "closed boundary"), zostaw resztę pliku (GF-01..GF-35) nietkniętą. ★★ **Czwarta: `tests/unit/backend/middleware/meetingBetaGate.test.ts` woła `closedBetaModuleGate` BEZPOŚREDNIO z jego DOMYŚLNYM `resolveStatus` (czyta prawdziwy mirror z `server/src/sharedRuntime/utils/betaMenuStatus.ts`)** — test `'denies a direct API caller with role %s'` dla MEMBER/USER/'' (`expect(response.status).toHaveBeenCalledWith(403)`) złamie się identycznie jak GF-06. Test `keeps the client admin exemption` dla OWNER/ADMIN/administrator/SUPERADMIN dalej przejdzie (ci są zwolnieni niezależnie od statusu open/closed — sprawdź to w `createModuleGate`, linia z `role === 'OWNER' || ...`). Trzeci test tego pliku (mount `router.use(...closedBetaModuleGate)` w Gateway/routes) nie dotyczy statusu open/closed i zostaje bez zmian. ★★ **Piąta: mirror serwera to WYGENEROWANY plik z drift-checkiem w `npm run build`(server).** Jeśli edytujesz WYŁĄCZNIE `src/utils/betaMenuStatus.ts` i zapomnisz uruchomić `node scripts/cleanup/sync-server-runtime-mirrors.mjs`, `server/src/sharedRuntime/utils/betaMenuStatus.ts:58` zostanie z `'closed'` — middleware serwera (który czyta WYŁĄCZNIE mirror, nigdy `src/`) będzie dalej blokować MEMBER-a 403-ką, podczas gdy front już pokazuje moduł: rozjazd, w którym UI obiecuje dostęp, a API go odmawia. R3 MUSI dowieść obu warstw naraz (front render + realne wywołanie `/api/meeting`), inaczej fałszywie "zielone". ★★ **Szósta: nazwa bazy z prefiksem rodziny to bezpiecznik wydany PO STOP-ie dyżuru 177 (`docs/program/funkcje/ODBIOR_177_PARTNER_STOP.md`) — przeczytaj go w całości.** `adoptedFixtureContracts` w `scripts/dev/start-wave3-owner-runtime.mjs` (regex `^consultify_w3_meetings_owner_[a-z0-9_]+$` dla Meetings) wymaga TEJ SAMEJ rodziny w trybie `adopt-existing`; dyżury 178/179 tego jeszcze nie miały (były wydane przed odbiorem 177) — Ty masz i masz jej użyć: BAZA `consultify_w3_meetings_owner_cx181`, nie gołe `cx181`. ★★ **Siódma: MINUTES/DECISIONS/NOTE renderują dziś TEN SAM `MeetingObjectPage`** (komentarz w `AppRoutes.tsx` nad blokiem tras — „stage 1… full artifact ships [stage 2]”) — nie oczekuj trzech różnych ekranów przy zrzutach R2, jeden zrzut na trzy trasy plus dopisek "identyczna treść, stage 1" jest poprawnym wynikiem, nie brakiem roboty. ★★ **Ósma: `ProductionModuleGate enabled={!hideNonCoreModulesOnPublicProduction}` to TRZECIA, niezależna bramka na tych samych trasach** (widoczna w `AppRoutes.tsx` wewnątrz `BetaGate`) — dotyczy WYŁĄCZNIE produkcji publicznej, nie dotyka Twojego lokalnego runtime'u ani Twojego testu; wspomnij ją w raporcie jako zaobserwowaną, nie jako coś do wyłączenia.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day181-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day181-spotkania-otwarcie-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`pozycja R1 — flip flagi + synchronizacja mirrora + regresja czterech zastanych testów, które dziś ZAKŁADAJĄ 'closed' i po flipie muszą się złamać w przewidywalny, opisany sposób`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6090` albo `5032 i 5033` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6090` albo `5032 i 5033`** (`Z7`).

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

Decyzja właściciela D-1 (`docs/program/funkcje/DECYZJE_WLASCICIELA_2026-08-30_WIECZOR.md`):

> Spotkania: otworzyć betę? **TAK, OD RAZU** (nie czekamy na zrzuty)

Moduł 08 Meetings ma dziś status `TECHNICAL_BROWSER_PASS / OWNER_REVIEW_PENDING`
(`docs/program/waves/WAVE_03_ACCEPTANCE/modules/08_MEETINGS/MODULE_ACCEPTANCE.md`) —
mechanika przeszła techniczny przegląd (G05 `PASS_TECHNICAL_BROWSER`, aggregat
`156/156 PASS` + `5/5` strukturalnych), ale jest zamknięta za jednym przełącznikiem
SSOT, `BETA_MENU_STATUS.MODULE_MEETING` (`'closed'`), który steruje jednocześnie:

1. **sidebarem** — `lockClosedBetaModules` (`src/utils/betaAccess.ts:65-89`) dokłada
   `isLocked`/`lockedMessage`/`BETA_LOCKED` do wpisu menu dla nie-adminów;
2. **trasą frontu** — `BetaGate` (`src/components/ProtectedRoute.tsx:105-142`)
   przekierowuje na `/chat` (`Navigate to={ROUTES.AI_CHAT}`) każdego zalogowanego,
   nie-zwolnionego użytkownika, który trafi na `/meetings/**` bezpośrednim linkiem;
3. **API serwera** — `closedBetaModuleGate` (`server/src/middleware/betaGate.middleware.ts:19-46`),
   wpięty w `meeting.routes.ts:301-304` zaraz po uwierzytelnieniu, zwraca `403 BETA_LOCKED`
   dla każdego wywołania spoza roli ADMIN/OWNER/SUPERADMIN, niezależnie od tego, co robi UI.

Serwer NIE czyta `src/utils/betaMenuStatus.ts` bezpośrednio — backendowy obraz
Dockera jest budowany z `COPY server/ .` (`Dockerfile.api`), więc `server/src/**`
nigdy nie widzi `src/**`. Zamiast tego czyta WYGENEROWANY MIRROR
`server/src/sharedRuntime/utils/betaMenuStatus.ts`, syncowany skryptem
`scripts/cleanup/sync-server-runtime-mirrors.mjs` i pilnowany drift-checkiem
w `npm run build` (server). Edycja samego `src/utils/betaMenuStatus.ts` bez
uruchomienia tego skryptu zostawia serwer i front w rozjeździe: UI pokazuje moduł,
API dalej 403-kuje.

Właściciel **nigdy nie widział tego modułu na żywo** (reguła 7 CLAUDE.md — Piotr
nigdy nie jest pierwszym testerem wizualnym). Dlatego kolejność D-1 jest odwrócona
względem zwykłego trybu pracy: normalnie flaga wizualna zostaje OFF do akceptu na
czystym zrzucie, tu właściciel świadomie kazał otworzyć NAJPIERW, a dopiero PO
otwarciu zrobić komplet zrzutów jako materiał do jego przyszłego akceptu — nie do
odkrycia usterek.

# 2. TEZY ZLECENIA

- **T1.** Jeden flip w `src/utils/betaMenuStatus.ts:57` (`'closed'` → `'open'`) NIE
  wystarcza — bez regeneracji mirrora API serwera zostaje zamknięte, mimo że UI
  już pokazuje moduł. Musisz udowodnić OBIE warstwy naraz.
- **T2.** Co najmniej cztery zastałe testy zakładają dziś `MODULE_MEETING === 'closed'`
  i po flipie muszą się złamać w sposób, który TY przewidziałeś i opisałeś — nie
  odkryjesz tego przypadkiem po fakcie. Jeden z nich (`financeFallbackGating.test.ts`)
  używa Meetings jako przykładu dla NIEZWIĄZANEJ funkcji (Finance fallback) i wymaga
  podmiany przykładowego modułu, nie usunięcia asercji.
- **T3.** `server/src/routes/__tests__/meeting.betaGate.gateway.day57.pg.test.ts` i
  `tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts`
  wołają REALNĄ bramkę na realnym Postgresie z rolą `member` i dziś oczekują 403 —
  to jest gotowy dom na dowód R3 „MEMBER wchodzi”, odwrócenie tych dwóch asercji
  jest tańsze i mocniejsze niż pisanie nowego testu od zera.
- **T4.** Moduł ma już udokumentowane, nienaprawione defekty wizualne/funkcjonalne
  (G08-G10 w `MODULE_ACCEPTANCE.md`) — R2 ma je potwierdzić lub obalić na świeżych
  zrzutach, nie naprawiać.
- **T5.** Nazwa bazy dla harnessu `start-wave3-owner-runtime.mjs` w trybie
  `adopt-existing` MUSI pasować do rodziny `consultify_w3_meetings_owner_[a-z0-9_]+`
  — gołe `cxNNN` zablokowało dyżur 177 na starcie (`ODBIOR_177_PARTNER_STOP.md`).

# 3. POZYCJE DYŻURU

## R1 — flip flagi, synchronizacja mirrora, regresja czterech testów

**(1) Zmierz stan wejściowy** — uruchom cztery zastałe testy z komendy T3 w BLOKU 0
i zapisz wynik „przed” do artefaktów (będzie punktem odniesienia dla dowodu
mutacyjnego).

**(2) Flip.** `src/utils/betaMenuStatus.ts:57`: `MODULE_MEETING: 'closed'` →
`MODULE_MEETING: 'open'`. Zostaw komentarz przy wpisie aktualny (dziś: „Meeting
(M21 — post-GA beta per _FINISZ_MASTER_PLAN)”) — zamień go na krótką notatkę
z datą i odniesieniem do D-1, wzorem komentarza przy `MODULE_ECONOMICS` kilka
linii wyżej w tym samym pliku.

**(3) Synchronizacja mirrora.** `node scripts/cleanup/sync-server-runtime-mirrors.mjs`
z katalogu roboczego (skrypt czyta `process.cwd()`, uruchamiasz go z korzenia
worktree). Sprawdź, że `server/src/sharedRuntime/utils/betaMenuStatus.ts:58`
zmieniło się identycznie. Uruchom też `node scripts/cleanup/sync-server-runtime-mirrors.mjs --check`
— ma wyjść bez błędu (potwierdza brak driftu).

**(4) Regresja testów, świadomie.** Dla każdego z czterech plików z T3:
   - `tests/unit/backend/middleware/meetingBetaGate.test.ts` — test
     `'denies a direct API caller with role %s'` dla MEMBER/USER/'' dziś oczekuje
     403+`BETA_LOCKED`. Zamień na test potwierdzający, że `next()` jest wołane
     (moduł otwarty = brak blokady) dla tych samych ról. Test
     `'keeps the client admin exemption...'` zostaje bez zmian (admini są
     zwolnieni niezależnie od statusu).
   - `server/src/routes/__tests__/meeting.betaGate.gateway.day57.pg.test.ts` —
     grupa „real Gateway state”: `'MEMBER is denied by the real closed beta gate'`
     → odwróć na oczekiwanie 200 i przemianuj nazwę testu (nie jest już „denied”).
     Grupa „isolated public switch contract” (jawny `() => 'open'`) zostaje bez
     zmian.
   - `tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts`
     — `GF-06 mirrors the closed MODULE_MEETING boundary after authentication`:
     odwróć asercję dla `member()` na 200, przemianuj opis (nie jest już „closed
     boundary”). Reszta pliku (GF-01..GF-35) nietknięta.
   - `tests/unit/finance/financeFallbackGating.test.ts` — **NIE jest testem
     Meetings.** Używa `MODULE_MEETING` jako przykładu zamkniętej bety dla testów
     generycznych funkcji z `betaAccess.ts` (`isBetaLockedForRole`,
     `lockClosedBetaModules`, `getBetaStatus`). Podmień przykładowy moduł na
     `MODULE_CASE_WORKSPACE` (zamknięty podwójnie — `betaMenuStatus.ts` + osobna
     flaga runtime `isCaseWorkspaceEnabled()`, więc nie zgaśnie przy najbliższym
     kolejnym flipie tak łatwo jak `MODULE_ECONOMICS`, który już ma zaplanowany
     flip po `DEC-2026-08-28-177`). Zmieniasz WYŁĄCZNIE identyfikator modułu użyty
     jako przykład — `shouldFallbackToLegacyFinance` i cała reszta pliku zostają
     nietknięte.

**(5) Dowód lokalny, obie warstwy naraz.** Na `cx-day181-pg`: (i) front — zalogowany
MEMBER wchodzi na `/meetings` i widzi `MeetingHub`, bez przekierowania na `/chat`;
(ii) API — `GET /api/meeting` z tokenem MEMBER zwraca `200`, nie `403`; (iii) sidebar
— wpis „Meeting” nie ma `isLocked`/`BETA_LOCKED` dla roli MEMBER. Zrzut/log
każdego z trzech.

**Ukończone, gdy:** `sync-server-runtime-mirrors.mjs --check` przechodzi bez
błędu; cztery testy z T3 przechodzą w nowym kształcie; dowód (5) jest zapisany
z realnym tokenem MEMBER na realnym Postgresie, nie na mocku.

## R2 — komplet zrzutów kanonicznym runtime + inwentarz defektów (BEZ naprawy)

Uruchom `start-wave3-owner-runtime.mjs` w trybie `adopt-existing` na bazie
`consultify_w3_meetings_owner_cx181`, wyseedowanej `seed-wave3-meetings-owner-review.mjs`
(`provision` → `seed` z nowym manifestem → `readback`). Fixture ma stabilne
OWNER/ADMIN/MEMBER/revoked/foreign i trzy stany notatki: pending, rejected,
approved/materialized (kwit `0/0/1`).

Zrzuty — jasny i ciemny, każdy stan pusty i z danymi seedu, gdzie oba stany
istnieją:

1. **Lista `/meetings`** — `MeetingHub` (StandardTable/StandardModuleBar), pusty
   stan (nowa organizacja bez fixture) i pełny (trzy spotkania z fixture).
2. **Preview jednym kliknięciem** z listy (`StandardPreview`).
3. **Kebab wiersza** — dostępne akcje per rola (MEMBER vs ADMIN — patrz
   `canApproveMeetingNotes` w `MeetingHub.tsx`).
4. **Obiekt spotkania `/meetings/:meetingId`** — dla KAŻDEGO z trzech stanów
   notatki (pending/rejected/approved) osobno, stabilnym `meetingId` z fixture.
5. **`/meetings/:meetingId/minutes` i `/meetings/:meetingId/decisions`** — jeden
   zrzut wystarczy jeśli treść jest identyczna z (4) (dziś renderują ten sam
   `MeetingObjectPage`, stage 1 — potwierdź to w zrzucie, nie zakładaj).
6. **`/meetings/:meetingId/notes/:noteId`** — deep link do pojedynczej notatki.
7. **Kalendarz/lista toggle**, jeśli `MeetingHub` go faktycznie renderuje (ikona
   `CalendarDays` w imporcie) — potwierdź działanie przed zrzutem, nie zgaduj z
   samego importu.

Dla każdego zrzutu sprawdź i wpisz do inwentarza (bez naprawiania) STAN
znanych defektów z `MODULE_ACCEPTANCE.md`:

- **G08:** tytuły tabeli/kalendarza się ucinają; karta Details pokazuje surowe
  ID użytkowników i „Organizer null null”; interfejs w większości angielski.
- **G09:** `GET /decision-records` zwraca `[]` mimo zatwierdzonej decyzji zapisanej
  w `meeting_notes.decisions_json` — sekcja „Decisions & actions” renderuje 0
  mimo niepustego odczytu backendu (root cause udowodniony, NIE naprawiony).
- **G10:** sekcja „Decisions & actions” approved jest pusta mimo niepustego
  odczytu backendu; participant-name UX otwarty.

Dla każdego: **nadal żywy / już naprawiony / inny niż opisano** — z dowodem
(zrzut + jedno zdanie). Dopisz WŁASNE nowe znaleziska, jeśli je zobaczysz.

Wpisy do `docs/program/waves/WAVE_03_ACCEPTANCE/modules/08_MEETINGS/MODULE_ACCEPTANCE.md`,
sekcja „Integrator preflight observations” (kolejne ID `MTG-PF-003`, `-004`…) —
**nie** do „Owner UI/UX/CX register” (to pole właściciela, on jeszcze nic nie
widział) i **nie** do tabeli G00-G20 (te statusy zmienia tylko odbiór właściciela).

**Ukończone, gdy:** wszystkie 7 pozycji zrzucone jasny+ciemny×pusty/pełny (gdzie
oba stany mają sens), wpisy `MTG-PF-*` w karcie z jednoznacznym werdyktem per
znany defekt G08-G10, ścieżki zrzutów i `shasum -a 256` w raporcie.

## R3 — MEMBER wchodzi, nie ma przekierowania do czatu

To jest osadzone w R1(5) i R1(4) (odwrócenie GF-06 i „real Gateway state”) —
nie duplikuj roboty. Dopisz tu WYŁĄCZNIE brakujący front-end e2e krok, jeśli
żaden istniejący test go nie pokrywa: zalogowany MEMBER (nie ADMIN, nie OWNER)
klika „Meeting” w sidebarze → trafia na `/meetings`, a nie na `/chat` z modalem
`AccessBlockedModal`/`BETA_LOCKED`. Sprawdź też — jako obserwację, nie naprawę —
że `src/utils/pilotAccess.ts:72` (`isBetaClosed('MODULE_MEETING')` w warunku
pilota) automatycznie przestaje blokować po flipie, bo czyta tę samą funkcję;
jeśli test tego NIE potwierdza, wpisz jako znalezisko, nie edytuj pliku (poza
licencją tego dyżuru).

**Ukończone, gdy:** masz jeden dowód end-to-end (token/sesja MEMBER, żywy
Postgres) pokazujący: brak przekierowania na `/chat`, `200` z `/api/meeting`,
sidebar bez `BETA_LOCKED` dla tej roli.

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis | `src/utils/betaMenuStatus.ts` — wyłącznie wpis `MODULE_MEETING` (linia ~57) i jego komentarz |
| Zapis | `server/src/sharedRuntime/utils/betaMenuStatus.ts` — WYŁĄCZNIE przez uruchomienie `scripts/cleanup/sync-server-runtime-mirrors.mjs`; zakaz ręcznej edycji |
| Zapis | `tests/unit/backend/middleware/meetingBetaGate.test.ts`, `server/src/routes/__tests__/meeting.betaGate.gateway.day57.pg.test.ts`, `tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts` — wyłącznie asercje statusu open/closed dla roli MEMBER/USER/'' opisane w R1(4); zakaz zmian w innych testach tych plików |
| Zapis | `tests/unit/finance/financeFallbackGating.test.ts` — wyłącznie identyfikator przykładowego modułu (`MODULE_MEETING` → `MODULE_CASE_WORKSPACE`) w bloku `describe('beta gating...')` i `describe('lockClosedBetaModules...')`; zakaz zmian w `shouldFallbackToLegacyFinance` |
| Zapis | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/08_MEETINGS/MODULE_ACCEPTANCE.md` — wyłącznie sekcja „Integrator preflight observations” (nowe wiersze) |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY181_SPOTKANIA_OTWARCIE_REPORT.md` |
| Odczyt | `src/utils/betaAccess.ts`, `src/components/ProtectedRoute.tsx`, `src/routes/AppRoutes.tsx`, `src/components/navigation/Sidebar/menuConfig.ts`, `src/utils/pilotAccess.ts` — mechanizm gatingu; **nie zmieniasz** |
| Odczyt | `server/src/middleware/betaGate.middleware.ts`, `server/src/routes/meeting.routes.ts` — bramka API; **nie zmieniasz** poza tym, czego wymaga R1(4) w testach |
| Odczyt | `src/components/Meeting/MeetingHub.tsx`, `src/components/Meeting/MeetingObjectPage.tsx` — ekrany do zrzutów R2; **nie zmieniasz kodu**, tylko renderujesz |
| Odczyt | `scripts/dev/start-wave3-owner-runtime.mjs`, `scripts/dev/seed-wave3-meetings-owner-review.mjs`, `docs/program/funkcje/ODBIOR_177_PARTNER_STOP.md` — harness i jego pułapka nazwy bazy; **nie zmieniasz** |
| Odczyt | `src/routes/__tests__/meetingsCanonicalRoute.test.ts` — istniejące pokrycie tras `/meeting` → `/meetings`; **nie zmieniasz**, tylko uruchamiasz jako regresję |

★ **Rozłączność z dyżurami działającymi równolegle:** 182 (Czat — `server/src/jobs/workSignalProducerJob.ts`,
`src/components/AIChat/**`) i 183 (Moja praca — `src/utils/myWorkCalendarV2Flag.ts`,
`src/components/MyWork/**`) NIE dotykają żadnego pliku z Twojej tabeli i odwrotnie.
Nie dotykasz `server/src/sharedRuntime/utils/betaMenuStatus.ts` poza jednym
uruchomieniem skryptu syncu — jeśli sync dotknie innych plików niż `betaMenuStatus.ts`
(sprawdź `git diff` po uruchomieniu), STOP i zgłoś, bo to znaczy, że coś innego
w `src/` jest niesynchronizowane z niezwiązanym mirrorem i to nie Twoja sprawa
naprawiać w tym dyżurze.

# 5. TWARDE ZASADY

- ★★ **NIE naprawiasz G08/G09/G10 ani żadnego innego wizualnego/funkcjonalnego
  defektu Meetings** — R2 to inwentarz, nie remont. Naprawa wymaga osobnego
  dyżuru po akcepcie Piotra na zrzutach (reguła 7 CLAUDE.md).
- ★★ **Mirror serwera edytujesz WYŁĄCZNIE przez skrypt.** Ręczna edycja
  `server/src/sharedRuntime/utils/betaMenuStatus.ts` łamie drift-check w
  `npm run build` (server) i jest zakazana.
- ★★ **Nazwa bazy MUSI mieć prefiks rodziny** `consultify_w3_meetings_owner_` —
  gołe `cx181` zablokuje `start-wave3-owner-runtime.mjs` w trybie `adopt-existing`
  identycznie jak zablokowało dyżur 177. Przeczytaj `ODBIOR_177_PARTNER_STOP.md`
  w całości PRZED startem harnessu.
- **Cztery zastałe testy z T3 muszą zostać ŚWIADOMIE odwrócone**, nie usunięte i
  nie pominięte (`skip`). Test, który znika zamiast się dostosować, ukrywa
  regresję zamiast jej dowodzić.
- **`financeFallbackGating.test.ts` to nie Twój test funkcjonalny** — dotykasz go
  wyłącznie żeby przestał kłamać o module, którego już nie dotyczy; zero zmian
  w logice fallbacku finansów.
- **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.** Wyłącznie lokalny
  kontener `cx-day181-pg` z tej instrukcji.
- **Każdą cytowaną linię kodu sprawdzasz sam przed wklejeniem do raportu.** Numery
  w tej instrukcji zweryfikowano wobec markera `18661cc6a0`, ale plik żyje.
- ★ Port **5000 jest zajęty na stałe przez macOS Control Center**.
- **Sekcja „TWIERDZENIA NIEZWERYFIKOWANE” w raporcie jest obowiązkowa.** Wypisz
  w niej wprost co najmniej: czy `MINUTES`/`DECISIONS` faktycznie renderują
  identyczną treść z `OBJECT` (czy to się zmieniło od SHA markera); czy
  `pilotAccess.ts` rzeczywiście przestaje blokować bez zmiany kodu; oraz czy
  `ProductionModuleGate` (trzecia, niezależna bramka widoczna w `AppRoutes.tsx`)
  ma jakikolwiek wpływ na Twój lokalny runtime (oczekiwany wynik: nie, bo
  dotyczy wyłącznie produkcji publicznej — potwierdź to, nie zakładaj).
