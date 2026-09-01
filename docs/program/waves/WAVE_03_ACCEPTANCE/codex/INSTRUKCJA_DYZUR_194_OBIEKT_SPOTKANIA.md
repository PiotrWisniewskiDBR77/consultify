# INSTRUKCJA DYŻURU nr 194 — Codex — „Spotkania 181-bis — diagnoza runtime i naprawa wiecznego spinnera na stronie obiektu (12/21 zrzutow dyzuru 181), dowod zrzutem tresci jasny+ciemny"

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
> **wyłącznie** `/private/tmp/cx-day194-obiekt-spotkania`.

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
Zakres: **Meetings (moduł 08) — strona obiektu spotkania `/meetings/:meetingId` (i siostrzane `/minutes`, `/decisions`, `/notes/:noteId`, wszystkie renderujące dziś TEN SAM `MeetingObjectPage`, stage 1). To jest 181-bis: FIX-181 (`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_FIX181_REPORT.md`, gałąź `codex/day181-spotkania-otwarcie-20260830`) obalił hipotezę membership-403 dla ADMIN/OWNER/MEMBER na fixture `W3-MEETINGS-OWNER-v1` jako przyczynę 12/21 zamrożonych spinnerów z dyżuru 181, ale NIE ustalił przyczyny realnej — sam raport nazywa to wprost `PRZYCZYNA NIE POTWIERDZONA` i zostawia jawny „Wsad do dyżuru 181-bis” (sekcja 3, trzy konkretne kroki). `ODBIOR_181_SPOTKANIA_OTWARCIE.md` wskazuje ten dyżur po numerze: „przyczyna głębsza, opisana plik:linia w CODEX_FIX181_REPORT → dyżur 194 (181-bis)”**.
Trasy front: ``src/components/Meeting/MeetingObjectPage.tsx` — `loadMeeting` (linie 293-314, jedyne miejsce wołające `setLoading`), orkiestracja czterech równoległych wywołań zależnych od `meeting?.id` (linie 534-544, NIE bramkują `loading`), gałęzie renderu `loading`/`loadError`/`notFound` (linie 582-618); `src/services/api.ts` — `getMeeting` (linie 3586-3589, pojedynczy `fetch` BEZ `fetchWithRetry`), `handleResponse` (linie 975-1122, zawsze rozstrzyga promise dla KAŻDEGO statusu HTTP); `src/components/Meeting/__tests__/MeetingObjectPage.test.tsx` (istniejący mock-API unit test — dom dla ew. nowej asercji frontu, jeśli przyczyna jest po tej stronie)`. Trasy tył: ``server/src/routes/meeting.routes.ts` — `canAccessMeeting`/`isMeetingAdmin` (linie 138-157), `requireActiveMeetingMembership` (linie 165-198), `denyMeetingAccess` (404, nie 403 — linie 159-162), `GET /:id` (linie 333-351, obok `router.use(requireActiveMeetingMembership)` linia 304); `server/src/index.ts` — readiness gate `/api/ready`/`createReadinessGate` (linie ok. 203-260), IIFE `databaseInitPromise` sterowane `shouldInitializeTestDatabase` (linie ok. 298-330+), bramka montażu Gateway `shouldMountTestGatewayRoutes` (linie ok. 1316-1329); `server/src/startup/testModeGates.ts` (cała treść — pułapka `RUN_DB_TESTS`, kontekst, NIE edytujesz); `scripts/dev/start-wave3-owner-runtime.mjs` (blok `serverEnv`, linie 644-663 — już poprawnie omija pułapkę przez `NODE_ENV: 'development'`, NIE edytujesz)`.

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
WT=/private/tmp/cx-day194-obiekt-spotkania
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
git -C "$VAULT" worktree add "$WT" -b codex/day194-obiekt-spotkania-20260831 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day194-obiekt-spotkania/config.worktree"
cat "$VAULT/worktrees/cx-day194-obiekt-spotkania/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day194-obiekt-spotkania-scratch
mkdir -p /private/tmp/cx-day194-obiekt-spotkania-artefakty

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
git -C "$WT" push github-backup codex/day194-obiekt-spotkania-20260831
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
cd /private/tmp/cx-day194-obiekt-spotkania

# (T1) STAN MASZYNY LOLA/LOADERROR/NOTFOUND — trzy gałęzie, jedno źródło setLoading
grep -n "setLoading(\|if (loading)\|if (loadError)\|if (notFound" src/components/Meeting/MeetingObjectPage.tsx
#   oczekiwane: setLoading TYLKO w loadMeeting (linie ~294 true, ~312 finally false);
#   trzy gałęzie renderu w kolejności loading -> loadError -> notFound||!meeting (~582,590,605).
#   Jeśli numery się przesunęły, dopasuj się do TREŚCI. Brak czwartej, ukrytej ścieżki ustawiającej
#   loading=true poza loadMeeting byłby MOCNYM tropem — potwierdź jego brak, nie zakładaj.

# (T2) getMeeting JEST POJEDYNCZYM fetch, BEZ retry — 503/403/404/500 ZAWSZE rozstrzyga promise
sed -n '3580,3592p' src/services/api.ts
grep -n "const handleResponse" src/services/api.ts
#   oczekiwane: `fetch(...)` (nie `fetchWithRetry`) + `handleResponse(res, ...)`; handleResponse
#   kończy się `return res.json()` (ok) LUB `throw err` (nie-ok) dla KAŻDEGO statusu — realna
#   odpowiedź HTTP (jakakolwiek) nie może sama z siebie zostawić `loading=true` na stałe.

# (T3) HIPOTEZA 403 DLA ADMIN/OWNER/MEMBER — OBALONA W FIX-181, NIE licytuj od nowa statycznie
sed -n '138,199p' server/src/routes/meeting.routes.ts
#   oczekiwane: isMeetingAdmin (linia 138) omija canAccessMeeting dla ADMIN/OWNER/SUPERADMIN;
#   requireActiveMeetingMembership (linia 165) sprawdza WYŁĄCZNIE organization_members.status,
#   nie "uczestnictwo w spotkaniu" mimo nazwy; denyMeetingAccess zwraca 404, nie 403 (linia 159-162).
#   Zweryfikuj to w PRZEGLĄDARCE na żywym Postgresie (T-block R1), nie tylko w kodzie.

# (T4) PUŁAPKA RUN_DB_TESTS — dlaczego kanoniczny runtime jej unika, a ad-hoc skrypt może w nią wpaść
grep -n "runsRealDbInTestMode\|shouldInitializeTestDatabase\|shouldMountTestGatewayRoutes" server/src/startup/testModeGates.ts
grep -n "NODE_ENV: 'development'\|MOCK_DB: 'false'" scripts/dev/start-wave3-owner-runtime.mjs
#   oczekiwane: pod NODE_ENV=test bez RUN_DB_TESTS=1 (i MOCK_DB!=false), dbReady NIGDY nie zostaje
#   true (IIFE w index.ts się nie odpala) — KAŻDA trasa poza /api/health* zwraca 503 "starting" na
#   zawsze, imitując "zawieszenie". Kanoniczny runtime startuje serwer z NODE_ENV=development —
#   ta bramka wtedy w ogóle nie obowiązuje. Jeśli budujesz WŁASNY skrypt diagnostyczny poza
#   harnessem, ustaw identyczne zmienne albo NODE_ENV=development, inaczej powtórzysz pułapkę
#   FIX-181 (dwie "przeszkody środowiskowe" w sekcji 3 raportu pasują do tego wzorca).

# (T5) FIXTURE — stabilne ID trzech spotkań i person
grep -n "pendingMeeting:\|rejectedMeeting:\|approvedMeeting:\|owner:\|admin:\|member:" scripts/dev/seed-wave3-meetings-owner-review.mjs
#   oczekiwane: w3-mtg-pending-meeting-v1 / w3-mtg-rejected-meeting-v1 / w3-mtg-approved-meeting-v1;
#   persony w3-mtg-owner-user-v1 / w3-mtg-admin-user-v1 / w3-mtg-member-user-v1.

# (T6) NASTĘPNY WOLNY NUMER W KARCIE — potwierdź, karta żyje od FIX-181
grep -n "MTG-PF-00[0-9]" docs/program/waves/WAVE_03_ACCEPTANCE/modules/08_MEETINGS/MODULE_ACCEPTANCE.md
#   oczekiwane: MTG-PF-001..006 istnieją, 006 ma status FIXED_VERIFIED (FIX-181); Twój wpis to 007.

# (T7) PORT I MIEJSCE NA DYSKU
df -h /
lsof -nP -iTCP:6120 -iTCP:5060 -iTCP:5061 -sTCP:LISTEN
#   oczekiwane: df >5GB wolnego; lsof PUSTY (żaden z trzech portów nie jest zajęty)
```

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day194-obiekt-spotkania-20260831` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6120`. Twój JEDYNY port harnessu to `5060 i 5061`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day194-pg`**. **ZAKAZANE:** `6012, 5433, 6047, 6054-6119, 5010-5059, 6404-6411 (odbiory nadzorcy i wcześniejsze dyżury), 6121/5062-5063 (dyżur 196 — równoległy), 6122/5064-5065 (dyżur 195 — równoległy). Twoje własne WYŁĄCZNIE 6120 i 5060/5061. ★ PORT 5000 ZAJĘTY NA STAŁE przez macOS Control Center. ★ PORT 5037 ZAJĘTY NA STAŁE przez adb (Android Debug Bridge)`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak — `BETA_MENU_STATUS.MODULE_MEETING` jest już `'open'` (flip dyżuru 181, marker potwierdza `src/utils/betaMenuStatus.ts:57` i mirror `server/src/sharedRuntime/utils/betaMenuStatus.ts:58` identyczne). Ten dyżur nie zmienia żadnej flagi ani jej wartości domyślnej`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY194_OBIEKT_SPOTKANIA_REPORT.md`. `docs/program/waves/WAVE_03_ACCEPTANCE/modules/08_MEETINGS/MODULE_ACCEPTANCE.md` — WYŁĄCZNIE nowy wiersz `MTG-PF-007` w sekcji „Integrator preflight observations” (kolejny wolny numer po `MTG-PF-006`, potwierdź to grepem przed pisaniem, karta żyje). Zakaz zmiany wierszy `MTG-PF-001`..`MTG-PF-006`, sekcji „Errata (FIX-181...)”, tabeli G00-G20, „Owner UI/UX/CX register” i „Owner verdict” — moduł nie ma dziś `CLOSED_FINAL` (gate: `TECHNICAL_BROWSER_PASS / OWNER_REVIEW_PENDING`), nie zmieniasz tego gate'u. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day194-obiekt-spotkania-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day194-obiekt-spotkania-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **NIE naprawiasz G08/G09/G10** (surowe ID uczestników, „Organizer null null”, mieszany PL/EN, `Decisions 0` mimo receiptu) — to UDOKUMENTOWANE, ODDZIELNE, znane defekty z `MODULE_ACCEPTANCE.md` (potwierdzone jeszcze żywe w errata FIX-181), poza zakresem tego dyżuru; jeśli po drodze zaobserwujesz ich stan, dopisz do inwentarza `MTG-PF-007`, nie naprawiaj przy okazji. ★★ **NIE ZMIENIASZ `BETA_MENU_STATUS`/`pilotAccess.ts`** — otwarcie jest już zrobione i poprawne (dyżur 181/FIX-181), zero powodu tego dotykać. ★★ **NIE KASUJESZ ani nie przepisujesz wierszy `MTG-PF-001`..`MTG-PF-006`** ani sekcji „Errata (FIX-181, 2026-08-30)” — dopisujesz WYŁĄCZNIE nowy wiersz `MTG-PF-007`. ★★ **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji** — wyłącznie lokalny kontener `cx-day194-pg`. ★★ **Zakaz naprawy na ślepo bez diagnozy runtime.** Jeśli po pełnym wysiłku (przeglądarka + sieć + logi + kanoniczny runtime, nie tylko analiza statyczna) przyczyna zostaje częściowo otwarta — nie wolno ogłosić fałszywego „naprawione”; opisz precyzyjnie, dokładnie jak zrobił to FIX-181 dla swojej części łamigłówki. Musisz JEDNAK i tak dostarczyć R2 w części „uczciwy stan błędu” (patrz PUŁAPKA druga) — te dwa wymogi nie są tym samym i nie zwalniają się nawzajem. | `ODBIOR_181_SPOTKANIA_OTWARCIE.md` (SCALONO PO FIX-181): „12/21 spinnerów nazwane per plik [...] przyczyna głębsza, opisana plik:linia w CODEX_FIX181_REPORT → dyżur 194 (181-bis): strona obiektu spotkania. Do tego czasu: lista+kalendarz działają, obiekt NIE”. `CODEX_FIX181_REPORT.md` sekcja 3 przyznaje wprost: obalono JEDNĄ płytką hipotezę (403 z `requireActiveMeetingMembership` dla ADMIN/OWNER/MEMBER na fixture `W3-MEETINGS-OWNER-v1` — middleware wywołuje `next()`, nie 403, dla tych ról na tym seedzie), ale „NIE ustalono ostatecznej przyczyny 12 zamrożonych spinnerów”; pełny żywy serwer + realna odpowiedź HTTP na `GET /meeting/:id` dla zalogowanego ADMIN nie został odtworzony w tamtej sesji (dwie przeszkody środowiskowe opisane, obie w konfiguracji, nie w kodzie produktowym). Sekcja „Wsad do dyżuru 181-bis” nazywa wprost trzy kroki, które ten dyżur ma podjąć: (1) realna przeglądarka z `waitFor` przed zrzutem + `read_network_requests`/`read_console_messages`; (2) zdiagnozować hang gotowości serwera; (3) ustalić dlaczego `DbPromise.get()` cicho zwraca `null` |

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
cd /private/tmp/cx-day194-obiekt-spotkania

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day194-pg psql -U postgres -d consultify_w3_meetings_owner_cx194 \
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
cd /private/tmp/cx-day194-obiekt-spotkania

docker run -d --name cx-day194-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=consultify_w3_meetings_owner_cx194 \
  -p 127.0.0.1:6120:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day194-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6120/consultify_w3_meetings_owner_cx194 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6120/consultify_w3_meetings_owner_cx194 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day194-obiekt-spotkania && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6120/consultify_w3_meetings_owner_cx194 \
JWT_SECRET=cx194-test-secret-do-not-reuse \
npx vitest run src/components/Meeting/__tests__/MeetingObjectPage.test.tsx tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts server/src/routes/__tests__/meeting.routes.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day194-obiekt-spotkania-artefakty/day194-vitest.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day194-obiekt-spotkania && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run src/components/Meeting/__tests__/MeetingObjectPage.test.tsx tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts server/src/routes/__tests__/meeting.routes.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day194-obiekt-spotkania-artefakty/day194-vitest.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day194-obiekt-spotkania/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day194-pg psql -U postgres -d consultify_w3_meetings_owner_cx194 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day194-pg`.
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
> **(e) ★★ **Pierwsza — pułapka `RUN_DB_TESTS`, to jest DOKŁADNIE ta wskazówka nadzorcy z briefu.** `server/src/index.ts` (komentarz „A14 fix”, linie ok. 298-313) i `server/src/startup/testModeGates.ts` (cały plik, zwłaszcza `runsRealDbInTestMode`/`shouldInitializeTestDatabase`/`shouldMountTestGatewayRoutes`) dokumentują incydent: pod `NODE_ENV=test` BEZ `RUN_DB_TESTS=1` (i `MOCK_DB!=false`), `databaseInitPromise` w ogóle się nie odpala — `dbReady` zostaje `false` NA ZAWSZE, nie dlatego że coś wisi, tylko dlatego że kod, który miałby to ustawić, nigdy nie zaczął działać. `createReadinessGate` (`server/src/index.ts` ok. linia 260) trzyma WTEDY każdą trasę poza `/api/health*` na 503 "starting" bez końca — to WYGLĄDA jak zawieszenie, ale jest błędem konfiguracji uruchomienia, nie defektem produktu. Kanoniczny `start-wave3-owner-runtime.mjs` (linie 644-663) tej pułapki unika strukturalnie, bo startuje serwer z `NODE_ENV: 'development'` (bramka `!isTestMode(env)` jest wtedy prawdziwa niezależnie od `RUN_DB_TESTS`) — UŻYWAJ TEGO HARNESSU jako pierwszego wyboru. Jeśli mimo to budujesz własny skrypt diagnostyczny (np. do sprawdzenia `DbPromise.get()` osobno, tak jak FIX-181), ustaw identyczne zmienne środowiskowe co harness albo `NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false` RAZEM — nie `NODE_ENV=test` samo. **Nie zapisuj tego w raporcie jako "potwierdzona przyczyna FIX-181" — FIX-181 nie zdiagnozował do końca, czy to był realny hang czy zła konfiguracja jego własnego skryptu; to Twoja hipoteza robocza do zweryfikowania, nie fakt do przepisania.** ★★ **Druga — dlaczego samo `getMeeting`/`handleResponse` matematycznie NIE MOŻE tłumaczyć wiecznego spinnera, jeśli serwer w ogóle odpowiada.** `getMeeting` (`src/services/api.ts:3586-3589`) to pojedynczy `fetch`, bez `fetchWithRetry`, bez pętli. `handleResponse` (linie 975-1122) dla KAŻDEGO statusu HTTP (200, 403, 404, 503, 500...) albo `return`-uje, albo `throw`-uje — nigdy nie zawiesza promise. `loadMeeting` (`MeetingObjectPage.tsx:293-314`) ma `try/catch/finally` z `setLoading(false)` bezwarunkowo w `finally`. Więc: JEŚLI serwer faktycznie odpowiada (jakimkolwiek kodem), spinner MUSI zniknąć. Prawdziwy wieczny spinner wymaga albo (a) połączenia, które nigdy nie dostaje odpowiedzi na poziomie sieci (nie samego 503/403), albo (b) czegoś, co POWTÓRNIE ustawia `loading=true` już PO sukcesie (przeszukaj plik pod kątem innych wywołań `setLoading` — dziś ich nie ma, ale sprawdź w swoim stanie kodu), albo (c) artefaktu czasu przechwytywania zrzutu (FIX-181 własna, wciąż otwarta hipoteza — zrzut zrobiony przed `waitFor` zniknięcia spinnera). R1 MA rozstrzygnąć między (a)/(b)/(c) na żywo, nie zgadywać. ★★ **Trzecia — `canAccessMeeting`/`requireActiveMeetingMembership` różnicują ADMIN od MEMBER inaczej niż mogłoby się wydawać.** MEMBER dostaje 404 (nie 403!) jeśli nie jest `createdBy` ani w `attendees` (`meeting.routes.ts:148-157`, `denyMeetingAccess` linia 159-162 — celowe ukrycie istnienia rekordu). ADMIN/OWNER/SUPERADMIN omijają to przez `isMeetingAdmin` (linia 138). 12 zrzutów-spinnerów z dyżuru 181 mają w nazwie `admin-meetings-*` — to persona ADMIN, nie MEMBER — więc `canAccessMeeting` w ogóle nie wchodzi w grę dla tych konkretnych zrzutów (ADMIN zawsze przechodzi). Nie trać czasu na ponowne dowodzenie tego, co FIX-181 już ustalił dla ADMIN (sekcja 3, dowód mutacyjny na `pg.Client`) — zrób to, czego FIX-181 NIE zrobił: żywa przeglądarka + realny HTTP round-trip dla tej samej persony. ★★ **Czwarta — MINUTES/DECISIONS/NOTE renderują TEN SAM `MeetingObjectPage`** (stage 1, komentarz w `AppRoutes.tsx` nad blokiem tras Meeting) — napraw raz w tym komponencie, nie diagnozuj cztery razy osobno; ale osobno POTWIERDŹ zrzutem, że to nadal prawda (nie zakładaj z komentarza). ★★ **Piąta — nazewnictwo zrzutów R3 MUSI pasować do istniejących cytatów w karcie** (`admin-meetings-approved-{light,dark}.png`, `-pending-`, `-rejected-` — dokładnie te nazwy cytuje errata FIX-181 dla `MTG-PF-003/004/005`), żeby nowy wpis `MTG-PF-007` dało się czytać obok nich bez gubienia kontekstu — nie wymyślaj nowego schematu nazw.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day194-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day194-obiekt-spotkania-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`pozycja R1 — ustalenie PRZYCZYNY wiecznego spinnera metodą runtime (przeglądarka + sieć + logi serwera na kanonicznym runtcie), nie analizą statyczną; R2 zależy wprost od tego, co R1 znajdzie`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6120` albo `5060 i 5061` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6120` albo `5060 i 5061`** (`Z7`).

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

`ODBIOR_181_SPOTKANIA_OTWARCIE.md` (SCALONO PO FIX-181) zamknął otwarcie bety Spotkań
(D-1) z jednym jawnym, nazwanym po numerze blokerem:

> 12/21 spinnerów nazwane per plik. Diagnoza spinnera: hipoteza membership-403
> OBALONA na fixture właściciela (persony ACTIVE, spotkania dostępne) — przyczyna
> głębsza, opisana plik:linia w CODEX_FIX181_REPORT → **dyżur 194 (181-bis): strona
> obiektu spotkania**. Do tego czasu: lista+kalendarz działają, obiekt NIE.

To NIE jest hipoteza postawiona dziś — to jest wprost nazwane zadanie, z konkretnym
raportem-poprzednikiem. `CODEX_FIX181_REPORT.md` (gałąź `codex/day181-spotkania-otwarcie-20260830`,
sekcja 3) jest uczciwy o stanie: obalił JEDNĄ, płytką hipotezę i przyznaje wprost, że
nie odtworzył problemu na żywo:

> Obalono jedną konkretną, płytką hipotezę (403 z `requireActiveMeetingMembership`
> dla ADMIN/OWNER/MEMBER tego fixture), ale NIE ustalono ostatecznej przyczyny 12
> zamrożonych spinnerów w zrzutach dyżuru 181.

Dowód obalenia: na kontenerze `cx-fix181-pg` z fixture `W3-MEETINGS-OWNER-v1`
zapytano bazę bezpośrednio (`pg.Client`, z pominięciem warstwy aplikacyjnej) o to,
co sprawdza `requireActiveMeetingMembership` — dla ADMIN membership jest `ACTIVE`,
więc middleware wywołuje `next()`, **nie zwraca 403**. Ale sama próba postawienia
PEŁNEGO żywego serwera + realnej odpowiedzi HTTP na `GET /meeting/:id` dla
zalogowanego ADMIN nie powiodła się w oknie ~40 minut — dwie osobne przeszkody
środowiskowe (opisane w raporcie jako niepewne: albo realny hang gotowości serwera,
albo zła konfiguracja jednorazowego skryptu diagnostycznego). Sekcja „Wsad do
dyżuru 181-bis” tego raportu nazywa wprost trzy kroki, które ten dyżur ma podjąć —
p. 3. TEZY ZLECENIA.

Weryfikacja dzisiejsza (na marker `6894f3da05`) dokłada twardy fakt, którego
FIX-181 nie miał: `server/src/index.ts` i `server/src/startup/testModeGates.ts`
dokumentują (komentarz „A14 fix”, 2026-08-13 — **wcześniej niż FIX-181**) dokładnie
tę klasę pułapki, w którą FIX-181 mógł wpaść własnym skryptem diagnostycznym: pod
`NODE_ENV=test` bez `RUN_DB_TESTS=1` (i `MOCK_DB≠false`), sekwencja inicjalizacji
bazy (`databaseInitPromise`) **nigdy się nie odpala** — `dbReady` zostaje `false`
na zawsze, nie dlatego że coś realnie wisi, tylko dlatego że kod, który miałby to
ustawić, nigdy nie zaczął działać. `createReadinessGate` trzyma wtedy KAŻDĄ trasę
poza `/api/health*` na `503 "starting"` bez końca — z zewnątrz wygląda to jak
zawieszenie serwera. To NIE jest udowodniona przyczyna spinnerów z dyżuru 181 (te
zrzuty powstały kanonicznym runtime'em `start-wave3-owner-runtime.mjs`, który tej
pułapki unika strukturalnie — patrz p. 5 PUŁAPKA pierwsza) — to jest wyjaśnienie,
dlaczego FIX-181 mógł nie zdołać odtworzyć problemu SWOIM osobnym, ad-hoc skryptem
w tamtej sesji. Traktuj to jako zweryfikowany fakt o kodzie, nie jako gotową
przyczynę dzisiejszego zadania — hipotezę roboczą buduje R1, na żywo.

# 2. TEZY ZLECENIA

- **T1.** Hipoteza membership-403 (403 z `requireActiveMeetingMembership`) jest
  OBALONA dla person ADMIN/OWNER/MEMBER na fixture `W3-MEETINGS-OWNER-v1` — nie
  licytuj jej od nowa statyczną analizą kodu; FIX-181 już to zmierzył mutacyjnie na
  żywej bazie. Twoja robota zaczyna się TAM, gdzie FIX-181 się zatrzymał: żywa
  przeglądarka, nie `pg.Client`.
- **T2.** `getMeeting` (`src/services/api.ts:3586-3589`) jest pojedynczym `fetch`
  bez retry, a `handleResponse` (linie 975-1122) rozstrzyga promise dla KAŻDEGO
  statusu HTTP. Jeśli serwer faktycznie odpowiada (jakimkolwiek kodem), `loadMeeting`
  (`MeetingObjectPage.tsx:293-314`, `finally { setLoading(false) }` bezwarunkowo)
  MUSI wyjść ze stanu `loading`. Prawdziwy wieczny spinner wymaga więc albo braku
  odpowiedzi na poziomie sieci, albo czegoś, co ponownie ustawia `loading=true` po
  sukcesie, albo artefaktu czasu przechwytywania zrzutu — nie samego 403/404/503.
- **T3.** MINUTES/DECISIONS/NOTE renderują dziś TEN SAM `MeetingObjectPage`
  (stage 1) co OBJECT — jedna naprawa w tym komponencie naprawia (potencjalnie)
  wszystkie cztery trasy naraz. Potwierdź to zrzutem, nie tylko komentarzem w
  `AppRoutes.tsx`.
- **T4.** Pułapka `RUN_DB_TESTS` (p. 1) jest realna w kodzie, ale NIE jest
  automatycznie przyczyną spinnerów z dyżuru 181 — te zrzuty powstały kanonicznym
  runtime'em, który tej pułapki unika (`NODE_ENV: 'development'` w
  `start-wave3-owner-runtime.mjs:646`). Jeśli budujesz WŁASNY skrypt diagnostyczny
  poza harnessem (np. do sprawdzenia hipotezy o `DbPromise.get()` z sekcji 3 FIX-181),
  ta pułapka jest realnym zagrożeniem DLA CIEBIE — nie dla runtime'u zrzutów 181.

# 3. POZYCJE DYŻURU

## R1 — diagnoza runtime do PRZYCZYNY (żywa przeglądarka, nie analiza statyczna)

Postaw kanoniczny runtime `start-wave3-owner-runtime.mjs` na bazie
`consultify_w3_meetings_owner_cx194` (prefiks rodziny `meetings`,
`adoptedFixtureContracts` w skrypcie — patrz T4/T6 w bloku 0), wyseedowanej
`seed-wave3-meetings-owner-review.mjs` (fixture `W3-MEETINGS-OWNER-v1`, te same
trzy spotkania co dyżur 181: `w3-mtg-pending-meeting-v1`,
`w3-mtg-rejected-meeting-v1`, `w3-mtg-approved-meeting-v1`).

Otwórz w przeglądarce `/meetings/w3-mtg-approved-meeting-v1` (i pending/rejected)
zalogowany jako `w3-mtg-admin-user-v1` (dokładnie ta persona, której zrzuty z
dyżuru 181 są spinnerami — `admin-meetings-*`). Dla każdego z trzech:

1. **Sieć na żywo** (`read_network_requests`): czy żądanie `GET /api/meeting/:id`
   w ogóle DOSTAJE odpowiedź? Jaki status, jaki czas (ms)? Czy w ogóle zostało
   wysłane (sprawdź URL — literalny `meetingId` z adresu, nie placeholder)?
2. **Konsola** (`read_console_messages`): błędy JS, ostrzeżenia React, cokolwiek
   związanego z `MeetingObjectPage`/`loadMeeting`.
3. **Logi serwera** (`server.log` z katalogu stanu harnessu): co loguje backend dla
   tego żądania — czy w ogóle je odbiera, czy `requireActiveMeetingMembership`/
   `GET /:id` handler faktycznie się wykonuje.
4. **`waitFor` przed osądem**: nie osądzaj po pierwszym zrzucie — poczekaj (np.
   `waitFor(() => !screen.queryByText(/loading/i))` lub odpowiednik przeglądarkowy)
   kilka sekund i sprawdź, czy spinner faktycznie NIE znika, czy tylko znika wolno
   (artefakt czasu przechwytywania — hipoteza FIX-181, wciąż otwarta).

Rozstrzygnij MIĘDZY trzema kandydatami (nie zgaduj — patrz p. 5 PUŁAPKA druga):
(a) żądanie sieciowe faktycznie nigdy nie dostaje odpowiedzi (prawdziwy hang —
sprawdź, czy to gotowość serwera, port, proxy Vite, coś innego); (b) coś w
komponencie/store ustawia `loading=true` PONOWNIE po sukcesie (przeszukaj CAŁY
plik pod kątem innych wywołań `setLoading`, nie tylko `loadMeeting`); (c) to był
artefakt czasu przechwytywania zrzutu w dyżurze 181 (spinner realnie znika, tylko
wolniej niż skrypt zrzutów czekał) — jeśli (c), to znaczy, że KOD dziś działa
poprawnie i R2 sprowadza się do zabezpieczenia (patrz niżej), nie do naprawy bugu.

**Ukończone, gdy:** masz jednoznaczną odpowiedź, KTÓRY z (a)/(b)/(c) to jest — z
dowodem (network log + console log + server log dla przynajmniej jednego z trzech
stanów notatki), nie hipotezę.

## R2 — naprawa przyczyny + uczciwy stan błędu zamiast wiecznego spinnera

Zależnie od tego, co znajdzie R1:

- **Jeśli (a) realny hang sieciowy/serwerowy:** napraw konkretną, nazwaną
  przyczynę (np. błędna konfiguracja gotowości, port, cokolwiek zdiagnozowane) w
  minimalnym zakresie — nie przepisuj `databaseReadiness`/`index.ts` szerzej niż
  wymaga naprawiony defekt.
- **Jeśli (b) kod ponownie ustawia `loading=true` po sukcesie:** napraw dokładnie
  to miejsce; nie zmieniaj architektury trzech gałęzi renderu
  (`loading`/`loadError`/`notFound`, linie 582-618) — ta triada jest już
  poprawnym wzorcem „uczciwego stanu błędu” w TYM pliku (odrzuca 404 jako
  `notFound`, każdy inny błąd jako `loadError` z `ErrorState` + `retry={() =>
  void loadMeeting()}`) i nie wymaga wzorca z innego miejsca w kodzie.
- **Jeśli (c) to był artefakt czasu przechwytywania zrzutu:** kod może dziś nie
  wymagać naprawy funkcjonalnej — ale i tak DOŁÓŻ zabezpieczenie: ograniczony
  czasowo timeout na `Api.getMeeting(meetingId)` w `loadMeeting` (np.
  `AbortController` z rozsądnym limitem, kilkanaście-kilkadziesiąt sekund,
  uzasadnij wybraną wartość w raporcie), który — jeśli żądanie faktycznie nigdy
  się nie rozstrzygnie na poziomie sieci — kończy się jawnym `loadError` zamiast
  spinnera bez końca. To NIE jest wzorzec z `useActionHandler.ts` (ten hook
  obsługuje dispatch akcji czatu/POST z `setIsExecuting`/`try…finally`, nie
  ładowanie GET z retry — sprawdź `src/hooks/useActionHandler.ts` sam, zanim
  uznasz, że jest tu bezpośrednio zastosowalny) — to jest rozszerzenie ISTNIEJĄCEJ
  triady stanu w `MeetingObjectPage.tsx`, żeby pokryła też kategorię „żądanie
  nigdy się nie rozstrzyga”, którą dziś nie pokrywa żadna gałąź.

Niezależnie od gałęzi: **dowód przez realny Gateway.** Test integracyjny (real
Postgres, real `apiGateway`, wzorem `tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts`)
potwierdzający, że `GET /api/meeting/:id` dla ADMIN zwraca `200` z ciałem dla
WSZYSTKICH TRZECH stanów fixture (pending/rejected/approved) — jeśli taki test już
istnieje i przechodzi, powołaj się na niego zamiast pisać nowy. Jeśli przyczyna
jest po stronie frontu, rozszerz `src/components/Meeting/__tests__/MeetingObjectPage.test.tsx`
o asercję renderu treści (nie tylko statusu HTTP).

**Ukończone, gdy:** test przez realny Gateway (nie mock) potwierdza 200+treść dla
trzech stanów notatki; front realnie renderuje kartę obiektu (nie spinner) w
przeglądarce dla tych samych trzech stanów; jeśli R1 rozstrzygnął na (a) lub (b),
konkretna przyczyna jest naprawiona i nazwana w raporcie; zabezpieczenie
timeout/honest-error z gałęzi (c) jest na miejscu niezależnie od wyniku R1 (obrona
w głąb — kategoria „żądanie nigdy się nie rozstrzyga” pozostaje możliwa nawet po
naprawie dzisiejszej, nazwanej przyczyny).

## R3 — dowód zrzutem: strona obiektu z TREŚCIĄ, jasny i ciemny

Na tym samym kanonicznym runtcie/fixture: zrzuty strony obiektu dla WSZYSTKICH
TRZECH stanów notatki (pending/rejected/approved), jasny i ciemny motyw — 6
plików, nazewnictwo zgodne z konwencją dyżuru 181 (`admin-meetings-{pending,
rejected,approved}-{light,dark}.png`), żeby dało się je czytać obok istniejących
cytatów `MTG-PF-003/004/005` w karcie bez gubienia kontekstu.

**Obejrzyj każdy plik SAM** (otwórz, nie zakładaj z nazwy) i napisz w raporcie, co
faktycznie widać — konkretnie: czy to jest treść karty (nie spinner), czy tytuł/
sekcje się renderują, czy G08 (surowe ID, „Organizer null null”, mieszany PL/EN)
jest nadal widoczny (inwentarz, NIE naprawiasz — p. 5 ZAKAZ pierwszy).

Dopisz `MTG-PF-007` do `docs/program/waves/WAVE_03_ACCEPTANCE/modules/08_MEETINGS/MODULE_ACCEPTANCE.md`,
sekcja „Integrator preflight observations”: przyczyna (a/b/c z R1), naprawa (R2),
i werdykt per stan notatki z odniesieniem do plików zrzutów. Jeśli R1 zostawia
przyczynę częściowo otwartą pomimo pełnego wysiłku — napisz to wprost, tak jak
zrobił FIX-181 dla `MTG-PF-006` wcześniej, nie zamiataj.

**Ukończone, gdy:** 6 plików zrzutów istnieją, każdy obejrzany osobiście z
opisanym co widać; `MTG-PF-007` w karcie z jednoznacznym per-stan werdyktem i
odniesieniem do plików; `shasum -a 256` zrzutów w raporcie.

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis | `src/components/Meeting/MeetingObjectPage.tsx` — wyłącznie to, czego wymaga naprawa zdiagnozowana w R1/R2 (gałąź `loadMeeting`/stan `loading`/`loadError`/`notFound`); zakaz zmiany innych sekcji komponentu (Protokół, Decyzje, follow-upy) poza tym, co naprawa realnie dotyka |
| Zapis | `src/components/Meeting/__tests__/MeetingObjectPage.test.tsx` — wyłącznie nowa/rozszerzona asercja pokrywająca naprawę R2, jeśli przyczyna jest po stronie frontu |
| Zapis | test integracyjny real-Gateway dla R2 — rozszerzenie `tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts` LUB nowy plik `server/src/routes/__tests__/meeting.*.day194.pg.test.ts`, jeśli istniejący plik nie pasuje strukturalnie (uzasadnij wybór) |
| Zapis | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/08_MEETINGS/MODULE_ACCEPTANCE.md` — wyłącznie nowy wiersz `MTG-PF-007` w sekcji „Integrator preflight observations” |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY194_OBIEKT_SPOTKANIA_REPORT.md` |
| Zapis (warunkowo) | konkretny plik serwera zawierający naprawioną, NAZWANĄ przyczynę z R1 gałąź (a) — dopisz do tej tabeli w raporcie DOKŁADNIE który plik/linię dotknąłeś, jeśli ta gałąź się potwierdzi; instrukcja nie może wymienić pliku z góry, bo przyczyna nie jest dziś znana |
| Odczyt | `server/src/routes/meeting.routes.ts` — `canAccessMeeting`/`isMeetingAdmin`/`requireActiveMeetingMembership`/`GET /:id`; **nie zmieniasz** poza tym, czego wymaga R1 gałąź (a) |
| Odczyt | `src/services/api.ts` — `getMeeting`/`handleResponse`; **nie zmieniasz** poza dodaniem timeoutu w R2 gałąź (c), jeśli to tam ma sens architektonicznie zamiast w `MeetingObjectPage.tsx` |
| Odczyt | `server/src/index.ts`, `server/src/startup/testModeGates.ts` — kontekst pułapki `RUN_DB_TESTS`; **nie zmieniasz** |
| Odczyt | `scripts/dev/start-wave3-owner-runtime.mjs`, `scripts/dev/seed-wave3-meetings-owner-review.mjs` — harness i fixture; **nie zmieniasz** |
| Odczyt | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_FIX181_REPORT.md`, `docs/program/funkcje/ODBIOR_181_SPOTKANIA_OTWARCIE.md` — kontekst zlecenia; **nie zmieniasz** |

**Nietykalne imiennie:** `MTG-PF-001`..`MTG-PF-006` i sekcja „Errata (FIX-181,
2026-08-30)” w `MODULE_ACCEPTANCE.md` (dopisujesz obok, nie zmieniasz); tabela
G00-G20, „Owner UI/UX/CX register”, „Owner verdict” tego samego pliku (moduł nie
ma dziś `CLOSED_FINAL`); `BETA_MENU_STATUS`/`pilotAccess.ts` (już poprawne).

★ **Rozłączność z dyżurem 196 (równoległym):** 196 dotyka `ExecutionHub.tsx`,
`InitiativeDocumentView.tsx`, `UsageMeters.tsx`, `01_ORGANIZATION`/`15_SETTINGS`
`MODULE_ACCEPTANCE.md` — zero pokrycia z tabelą powyżej.

# 5. TWARDE ZASADY

- ★★ **Diagnoza MUSI być runtime (przeglądarka + sieć + logi), nie analiza
  statyczna kodu.** FIX-181 już zrobił analizę statyczną i doszedł do ściany —
  powtórzenie tego samego bez żywego serwera nie posunie sprawy.
- ★★ **Nie naprawiasz G08/G09/G10** — to osobne, udokumentowane defekty; R3 ma
  je ZOBACZYĆ i zapisać stan, nie naprawić.
- ★★ **Nie zgaduj-napraw bez diagnozy.** Jeśli przyczyna zostaje częściowo
  otwarta mimo pełnego wysiłku — opisz precyzyjnie (wzorem FIX-181 dla
  `MTG-PF-006` wcześniej), nie ogłaszaj fałszywego „naprawione”. Zabezpieczenie
  honest-error z R2 gałąź (c) i tak jest obowiązkowe niezależnie od wyniku.
- **Nie zmieniasz `BETA_MENU_STATUS`/`pilotAccess.ts`** — już otwarte poprawnie.
- **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.** Wyłącznie
  lokalny kontener `cx-day194-pg`.
- Pułapka: `No test files found` NIE jest `PASS`. Sprawdź `numTotalTests` > 0.
- ★ Port **5000 zajęty na stałe przez macOS Control Center**, **5037 przez adb**.
- **Każdą cytowaną linię kodu sprawdzasz sam przed wklejeniem do raportu.** Numery
  w tej instrukcji zweryfikowano wobec markera `6894f3da05`, ale plik żyje.
- **Sekcja „TWIERDZENIA NIEZWERYFIKOWANE” w raporcie jest obowiązkowa.** Wypisz w
  niej wprost co najmniej: która z gałęzi (a)/(b)/(c) z R1 pozostała
  niedowiedziona, jeśli którakolwiek; czy MINUTES/DECISIONS/NOTE faktycznie
  renderują identyczną treść z OBJECT po Twojej naprawie (czy to się nadal
  zgadza z komentarzem w `AppRoutes.tsx`); oraz czy pułapka `RUN_DB_TESTS`
  faktycznie odegrała jakąkolwiek rolę w Twojej własnej sesji diagnostycznej, czy
  była tylko kontekstem, którego uniknąłeś dzięki kanonicznemu harnessowi.
