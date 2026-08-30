# INSTRUKCJA DYŻURU nr 182 — Codex — „Producent sygnalow Czatu ON (D-2) — lokalny dowod deterministycznej warstwy, inwentarz osmiu regul do karty 13_CHAT, wartosc env dla stagingu (nadzorca ustawia)"

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
> **wyłącznie** `/private/tmp/cx-day182-sygnaly-on`.

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
Zakres: **Chat (moduł 13) — warstwa deterministycznych sygnałów pracy (`ENABLE_SIGNAL_PRODUCER`), czytana wyłącznie na `process.env` (bez wpisu w `FeatureFlags.ts` — usunięty świadomie w FIX-7a dnia 18, bo prawdziwy czytelnik i tak sięga wprost do zmiennej). NIE dotyczy warstwy AI/interpretera (`ENABLE_SIGNAL_INTERPRETER`) — ta zostaje OFF, osobna, nierozstrzygnięta decyzja**.
Trasy front: ``src/components/AIChat/signalsFeed/ChatSignalsFeed.tsx` (tylko odczyt/obserwacja, nie zmieniasz — patrz pułapka trzecia), `src/components/AIChat/signalsFeed/ChatSignalsFeedPreview.tsx`, `dev-render/screens/chat-signals-feed.tsx` (już zarejestrowany w `dev-render/main.tsx:1313` — NIE jest sierotą mimo starszego raportu, sprawdź to sam)`. Trasy tył: ``server/src/jobs/workSignalProducerJob.ts` (kill-switch `isSignalProducerEnabled()` linia 10-12, `runDeterministicForOrganization`/`runDeterministicTick`), `server/src/services/signals/signalEvaluator.ts`, `server/src/services/signals/rules/index.ts` (8 reguł: `taskOverdueRule`, `taskDueSoonNotStartedRule`, `taskBlockedStaleRule`, `initiativeNoBaselineRule`, `decisionPendingStaleRule`, `decisionBlockingDependentsRule`, `kpiThresholdBreachedRule`, `budgetOverspendRule`), `server/src/cron/Scheduler.ts:103-115,251` (`registerWorkSignalProducerJob`, rejestracja BEZWARUNKOWA co 15 min), `server/src/routes/signals.routes.ts`, `server/src/services/signals/signalReadModel.ts``.

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
WT=/private/tmp/cx-day182-sygnaly-on
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
git -C "$VAULT" worktree add "$WT" -b codex/day182-sygnaly-on-20260830 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day182-sygnaly-on/config.worktree"
cat "$VAULT/worktrees/cx-day182-sygnaly-on/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day182-sygnaly-on-scratch
mkdir -p /private/tmp/cx-day182-sygnaly-on-artefakty

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
git -C "$WT" push github-backup codex/day182-sygnaly-on-20260830
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
cd /private/tmp/cx-day182-sygnaly-on

# (T1) FLAGA DZIŚ WYŁĄCZONA, CZYTANA WYŁĄCZNIE Z process.env
grep -n "ENABLE_SIGNAL_PRODUCER" server/src/jobs/workSignalProducerJob.ts
#   oczekiwane: linia ~10-12, `process.env.ENABLE_SIGNAL_PRODUCER === 'true'`. ZERO wpisu
#   w server/src/config/FeatureFlags.ts (usunięty świadomie FIX-7a dnia 18 — martwy odczyt).

# (T2) CRON REJESTRUJE SIĘ BEZWARUNKOWO — flaga gatuje TYLKO ewaluację w środku
sed -n '96,116p' server/src/cron/Scheduler.ts
grep -n "registerWorkSignalProducerJob()" server/src/cron/Scheduler.ts
#   oczekiwane: `*/15 * * * *` cron.schedule bez warunku na ENABLE_SIGNAL_PRODUCER; wywołanie
#   `registerWorkSignalProducerJob()` w linii ~251 wewnątrz Scheduler bez osobnej bramki poza
#   globalnym DISABLE_SCHEDULER (server/src/index.ts:612).

# (T3) OSIEM REGUŁ — ŹRÓDŁA DANYCH, ŻADNE Z NICH TO CZAT
cat server/src/services/signals/rules/index.ts
#   oczekiwane: 8 importów (task*, initiativeNoBaseline, decision*, kpiThresholdBreached,
#   budgetOverspend) z katalogów execution/decision/finance/results — zero katalogu chat/.

# (T4) FIXTURE CZATU NIE SEEDUJE ŻADNEJ Z TYCH TABEL
grep -n "INSERT INTO" scripts/dev/seed-wave3-chat-owner-review.mjs
#   oczekiwane: WYŁĄCZNIE organizations/users/organization_members/conversations/
#   conversation_messages/wave3_owner_fixture_markers. ZERO tasks/initiatives/decisions/
#   budget_overspend_signals/v8_kpi_signals — potwierdza, że Twój dowód R1 potrzebuje
#   DODATKOWEGO seedu (własnego, w Twoim teście, nie w współdzielonym seederze).

# (T5) SPRAWDŹ SAM CZY PRODUCENT/EWALUATOR UŻYWA REDIS — jeśli TAK, popraw KONTENER w tej
# instrukcji przed startem (patrz LISTA_PORTOW_ZAJETYCH); jeśli NIE (oczekiwany wynik), nie
# twórz kontenera Redis
grep -rEn "redis|Redis|bullmq|ioredis" server/src/jobs/workSignalProducerJob.ts \
  server/src/services/signals/signalEvaluator.ts server/src/services/signals/*.ts \
  server/src/services/signals/rules/**/*.ts server/src/routes/signals.routes.ts
#   oczekiwane (zweryfikowane przy składaniu tej instrukcji): PUSTY wynik.

# (T6) EKRAN HARNESSU JEST ZAREJESTROWANY — starszy raport (dyżur 48) go zgłaszał jako sierotę,
# sprawdź czy to nadal prawda
grep -n "'chat-signals-feed'" dev-render/main.tsx
#   oczekiwane (zweryfikowane przy składaniu tej instrukcji): trafienie ok. linii 1313 —
#   ekran JEST w rejestrze SCREENS. Jeśli Twój wynik jest inny, napraw tylko wpis rejestru
#   i zgłoś rozjazd z tą instrukcją w raporcie.
```

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day182-sygnaly-on-20260830` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6091`. Twój JEDYNY port harnessu to `5034 i 5035`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day182-pg`**. **ZAKAZANE:** `6012, 5433, 6047, 6054-6088, 5010-5029, 6404-6408 (odbiory nadzorcy i wcześniejsze dyżury), 6089/5030-5031 (dyżur 180), 6093-6096/5038-5045 (dyżury 184-187). ★ TRÓJKA RÓWNOLEGŁA — dodatkowo zakazane: 6090/5032-5033 (dyżur 181 — Spotkania) i 6092/5036-5037 (dyżur 183 — Moja praca). Twoje własne to WYŁĄCZNIE 6091 i 5034/5035. ★ REDIS NIE JEST WYMAGANY — sprawdź to sam w BLOKU 0 (komenda T5), ale zastane zbadanie w tej instrukcji: `workSignalProducerJob.ts`, `signalEvaluator.ts` i cała ścieżka `server/src/services/signals/**` używają wyłącznie `queryAll`/Postgres, zero importu `redis`/`bullmq`/`ioredis` — NIE twórz kontenera `cx-day182-redis`, port 6409 zostaje wolny, chyba że T5 pokaże inaczej. ★ PORT 5000 ZAJĘTY NA STAŁE przez macOS Control Center`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `★★ JEDYNA flaga tego dyżuru: `ENABLE_SIGNAL_PRODUCER` — ustawiasz ją WYŁĄCZNIE w powłoce własnego przebiegu testowego (`ENABLE_SIGNAL_PRODUCER=true npx vitest ...` / `ENABLE_SIGNAL_PRODUCER=true npm run dev` lokalnie), NIGDY w `.env`, `.env.example`, `docker-compose*`, `railway.json` ani jako nowa wartość domyślna w kodzie (`isSignalProducerEnabled()` w `workSignalProducerJob.ts:10-12` zostaje `process.env.ENABLE_SIGNAL_PRODUCER === 'true'`, bez zmiany). `ENABLE_SIGNAL_INTERPRETER` NIE jest w zakresie — zostaje OFF, nie dotykasz jej wartości ani czytelnika`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY182_SYGNALY_ON_REPORT.md`. `docs/program/waves/WAVE_03_ACCEPTANCE/modules/13_CHAT/MODULE_ACCEPTANCE.md` — wyłącznie dopisanie tabeli ośmiu reguł producenta (R2), NIE zmieniasz istniejących sekcji gate'ów/werdyktów. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day182-sygnaly-on-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day182-sygnaly-on-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **NIE WŁĄCZASZ `ENABLE_SIGNAL_INTERPRETER` ani nie dotykasz `server/src/services/signals/signalInterpreter.ts`.** To osobna, nierozstrzygnięta warstwa (P0 z odbioru dnia 18 dotyczył WŁAŚNIE tego pliku — sprawdź w raporcie, czy nadal jest martwy, ale nie naprawiaj: `signalInterpreter.ts` parsuje dziś `output.content` (nie `output.proposals`), co sugeruje, że P0 mógł już zostać naprawiony między dniem 18 a markerem — TO JEST DO ZWERYFIKOWANIA I OPISANIA, nie do poprawek). ★★ **NIE NAPRAWIASZ trzeciego stanu pustki w `ChatSignalsFeed.tsx:266-271`** (`t('chatSignals.empty.good')` pokazywany też dla świeżej organizacji bez danych źródłowych, zidentyfikowany w `DEC-2026-08-28-204` jako atrapa Z23) — wpisz jako znane, nienaprawione znalezisko do karty, nie zmieniaj pliku. ★★ **Zero zmian kodu poza WYJĄTKIEM:** jeśli `runDeterministicTick`/`runDeterministicForOrganization` realnie wywala się (nie zwraca kontrolowanego wyniku) przy `ENABLE_SIGNAL_PRODUCER=true` na realnym Postgresie — WTEDY i tylko wtedy minimalny fix z testem, opisany w raporcie jako odstępstwo od zakresu. ★★ **NIE dotykasz kolizji z dyżurem 47** (`/my-work/signals/{key}/snooze|dismiss|mute-type`) — zero zapisów przez te trasy w Twoim dowodzie, tylko odczyt feedu. ★★ **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji** — wyłącznie lokalny kontener `cx-day182-pg`. | Decyzja właściciela D-2 (`docs/program/funkcje/DECYZJE_WLASCICIELA_2026-08-30_WIECZOR.md`): „Czat: włączyć producenta sygnałów? TAK — `ENABLE_SIGNAL_PRODUCER=true`, lokalny dowód dyżurem, na STAGING ustawia nadzorca”. Odbiór dnia 18 (`OWNER_DECISION_LEDGER_2026-08-24.md`, `DEC-2026-08-26-107`) przyjął rdzeń deterministyczny pozytywnie (8/10 reguł realnych, tenant-safety potwierdzone dowodem mutacyjnym), ale wstrzymał merge do P0 warstwy AI (interpreter) — TA decyzja NIE dotyczy tego dyżuru: D-2 włącza wyłącznie deterministyczną warstwę. Dyżur 48 (`DEC-2026-08-28-204`) obalił własną wcześniejszą tezę nadzorcy „feed pusty, bo producent wyłączony” — żadna z ośmiu reguł nie czyta danych czatu, więc samo zdjęcie flagi nie napełni feedu u nowego klienta ani o jeden wiersz bez danych źródłowych (zadania/inicjatywy/decyzje/KPI/budżety) |

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
cd /private/tmp/cx-day182-sygnaly-on

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day182-pg psql -U postgres -d consultify_w3_chat_owner_cx182 \
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
cd /private/tmp/cx-day182-sygnaly-on

docker run -d --name cx-day182-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=consultify_w3_chat_owner_cx182 \
  -p 127.0.0.1:6091:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day182-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6091/consultify_w3_chat_owner_cx182 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6091/consultify_w3_chat_owner_cx182 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day182-sygnaly-on && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6091/consultify_w3_chat_owner_cx182 \
JWT_SECRET=cx182-test-secret-do-not-reuse \
npx vitest run server/src/services/signals/__tests__ tests/integration/routes/signals.feed.postgres.integration.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day182-sygnaly-on-artefakty/day182-vitest.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day182-sygnaly-on && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/services/signals/__tests__ tests/integration/routes/signals.feed.postgres.integration.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day182-sygnaly-on-artefakty/day182-vitest.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day182-sygnaly-on/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day182-pg psql -U postgres -d consultify_w3_chat_owner_cx182 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day182-pg`.
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
> **(e) ★★ **Pierwsza, i to jest sedno R1: fixture Czatu (`seed-wave3-chat-owner-review.mjs`) seeduje TYLKO organizacje/użytkowników/konwersacje — ZERO `tasks`/`initiatives`/`decisions`/`budget_overspend_signals`/`v8_kpi_signals`.** Osiem reguł deterministycznych (`server/src/services/signals/rules/index.ts`) czytają WYŁĄCZNIE te ostatnie tabele — potwierdzone niezależnie w `DEC-2026-08-28-204`: „Żadna z ośmiu reguł nie czyta danych czatu… zdjęcie flagi NIE napełni feedu u nowego klienta ani o jeden wiersz”. Sam flip `ENABLE_SIGNAL_PRODUCER=true` na fixture Czatu bez dodatkowych danych da PUSTY feed — to NIE jest dowód, że producent działa, to jest brak danych do zmierzenia. Musisz dopisać w SWOIM dowodzie (osobny plik testowy, NIE we współdzielonym `seed-wave3-chat-owner-review.mjs`) minimalny zestaw kwalifikujących wierszy pod org/user id z fixture Czatu — najtańsza droga: jeden wiersz `initiatives` bez `initiative_schedule_baselines` uruchamia `initiativeNoBaselineRule`, która **nie ma progu wieku** (zapala się natychmiast, potwierdzone w tym samym DEC-204 jako „realna droga do feedu sensownego od pierwszego dnia bez wymyślania danych”) — najprostszy, najbardziej wiarygodny sygnał do dowodu R1. ★★ **Druga: CRON rejestruje się BEZWARUNKOWO co 15 minut** (`Scheduler.ts:103-115`, wywołanie w linii ~251) — flaga gatuje WYŁĄCZNIE ewaluację wewnątrz `runDeterministicForOrganization`, nie samą rejestrację zadania. Przy `ENABLE_SIGNAL_PRODUCER=false` `recordDisabled` (`workSignalProducerJob.ts:20-31`) pisze wiersz `SKIPPED_DISABLED` do `work_signal_runs` TYLKO dla triggera `ON_DEMAND` — CRON (co 15 min × każda aktywna organizacja) świadomie NIE pisze nic, żeby nie napuchnąć tabeli (~96 wierszy/dobę/org, naprawione FIX-3 dnia 18). Twój dowód lokalny powinien wołać `runDeterministicForOrganization` bezpośrednio (albo `runDeterministicTick`) z ustawioną flagą w powłoce, NIE czekać na prawdziwy 15-minutowy cron. ★★ **Trzecia: trzeci stan pustki w `ChatSignalsFeed.tsx:266-271` KŁAMIE dla świeżej organizacji** — `feed.producerEnabled === true && zero signals` renderuje `t('chatSignals.empty.good')` („Warunki reguł nie są spełnione — to dobry stan”), co dla organizacji bez zakwalifikowanych danych źródłowych jest nieprawdą (reguły nie mają czego policzyć, nie "są spełnione i dobre"). To NIE blokuje Twojego dowodu R1 (Twój dowód ma dane, więc feed pokaże realne sygnały, nie ten stan) — ale MUSISZ to zaobserwować i wpisać do karty 13_CHAT jako znane, nienaprawione znalezisko (Z23, atrapa uczciwości), nie naprawiać. ★★ **Czwarta: ekran harnessu `dev-render/screens/chat-signals-feed.tsx` był kiedyś sierotą (dyżur 48, `DEC-2026-08-28-204`), ale przy tym markerze JEST już zarejestrowany** w `dev-render/main.tsx` (`'chat-signals-feed'` w rejestrze `SCREENS`, ok. linii 1313) — sprawdź to SAM komendą T6 zamiast ufać starszemu raportowi; jeśli nadal brakuje wpisu, dopisz DOKŁADNIE JEDEN wiersz rejestru i nic więcej. ★★ **Piąta: trzy zmienne środowiskowe grają w tym obszarze, tylko jedna jest Twoja.** `ENABLE_SIGNAL_PRODUCER` (Twoja, D-2), `DISABLE_SCHEDULER` (globalny wyłącznik całego crona, NIE dotykasz), `ENABLE_SIGNAL_INTERPRETER` (warstwa AI, NIE w zakresie D-2, zostaje OFF). Nie myl ich w raporcie ani w komendach. ★★ **Szósta, dla R3: wartość dla stagingu to WYŁĄCZNIE `ENABLE_SIGNAL_PRODUCER=true`** ustawiana jako zmienna środowiskowa serwisu Railway przez nadzorcę (skill `consultify-promocja-demo`) — Twoje zadanie to przygotować dokładną wartość + dokładną ścieżkę (nazwa usługi/env Railway z `DEC-2026-08-25-65`, kontrakt rozdzielenia staging/demo/production), NIE wykonać ustawienie. Zero komend `railway` w Twoim dyżurze.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day182-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day182-sygnaly-on-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`pozycja R1 — dowód, że deterministyczna warstwa realnie produkuje sygnały na seedzie i realnie trafiają do feedu, licząc się z tym, że fixture Czatu SAM Z SIEBIE nie zawiera danych, które reguły czytają`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6091` albo `5034 i 5035` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6091` albo `5034 i 5035`** (`Z7`).

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

Decyzja właściciela D-2 (`docs/program/funkcje/DECYZJE_WLASCICIELA_2026-08-30_WIECZOR.md`):

> Czat: włączyć producenta sygnałów? **TAK** — `ENABLE_SIGNAL_PRODUCER=true`,
> lokalny dowód dyżurem, na STAGING ustawia nadzorca (env Railway, procedura
> promocji)

Odbiór dnia 18 (`docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md`,
`DEC-2026-08-26-107`) przyjął rdzeń deterministyczny **pozytywnie** — migracje,
ewaluator, 8 z 10 reguł realnych z kompletem 4 testów każda, tenant-safety obu
tras potwierdzone dowodem mutacyjnym (neutralizacja filtru org → testy
czerwone) — ale wstrzymał merge do FIX-ów, głównie dlatego że **warstwa AI
(interpreter) była martwa**: `signalInterpreter.ts:101` czytał `output.proposals`,
podczas gdy `llmService.generateResponse` zwraca `{content, usage}` — pole
`proposals` nigdy nie istniało, więc interpreter zawsze zwracał zero propozycji.

**To NIE jest ta warstwa, którą włącza D-2.** `ENABLE_SIGNAL_PRODUCER` gatuje
wyłącznie warstwę **deterministyczną** (osiem reguł czytających wprost tabele
zadań/inicjatyw/decyzji/KPI/budżetów, bez LLM). `ENABLE_SIGNAL_INTERPRETER`
(warstwa AI, syntetyzująca wzorce z sygnałów deterministycznych) to osobna
flaga, osobna, nierozstrzygnięta jeszcze decyzja właściciela — zostaje OFF.

Dyżur 48 (`DEC-2026-08-28-204`) obalił własną wcześniejszą tezę nadzorcy
(„feed pusty, bo producent wyłączony”) — jest fałszywa co do przyczyny:

> Żadna z ośmiu reguł nie czyta danych czatu — czytają `tasks`, `initiatives` +
> `initiative_schedule_baselines`, `decisions` + `decision_impacts`,
> `v8_kpi_signals`, `budget_overspend_signals`. Zdjęcie flagi NIE napełni feedu
> u nowego klienta ani o jeden wiersz.

Ten sam odbiór dostarczył też dobrą wiadomość: `initiativeNoBaselineRule`
**nie ma progu wieku** — zapala się natychmiast na pierwszej inicjatywie bez
bazowego harmonogramu. To jest realna, tania droga do dowodu R1 bez wymyślania
fikcyjnych danych.

# 2. TEZY ZLECENIA

- **T1.** Fixture Czatu (`seed-wave3-chat-owner-review.mjs`) seeduje wyłącznie
  organizacje/użytkowników/konwersacje. Zero `tasks`/`initiatives`/`decisions`/
  `budget_overspend_signals`/`v8_kpi_signals`. Bez dodatkowych, kwalifikujących
  wierszy Twój dowód R1 na samym fixture Czatu da pusty feed — to nie dowodzi
  niczego.
- **T2.** CRON rejestruje się BEZWARUNKOWO co 15 minut (`Scheduler.ts:103-115`,
  wywołanie ok. linii 251) — flaga gatuje wyłącznie ewaluację wewnątrz
  `runDeterministicForOrganization`, nie samą rejestrację. Trzy zmienne grają
  w tym obszarze (`ENABLE_SIGNAL_PRODUCER`, `DISABLE_SCHEDULER`,
  `ENABLE_SIGNAL_INTERPRETER`) — tylko pierwsza jest Twoja.
- **T3.** `ChatSignalsFeed.tsx:266-271` pokazuje `chatSignals.empty.good` również
  dla organizacji bez żadnych zakwalifikowanych danych źródłowych — co jest
  nieuczciwe (reguły nie mają czego policzyć, to nie jest „dobry stan”),
  zidentyfikowane w `DEC-2026-08-28-204` jako atrapa w rozumieniu Z23. Zmierz
  i wpisz do karty, nie naprawiaj.
- **T4.** `ENABLE_SIGNAL_INTERPRETER` i `signalInterpreter.ts` NIE są w zakresie
  D-2 — nawet jeśli sprawdzisz i P0 z dnia 18 okaże się już naprawiony (kod
  dziś parsuje `output.content`, nie `output.proposals` — wygląda na
  naprawione), to informacja do raportu, nie licencja na włączenie.

# 3. POZYCJE DYŻURU

## R1 — dowód lokalny: producent realnie produkuje sygnały deterministyczne

**(1) Ustal, czy Redis jest potrzebny (T5 z bloku 0).** Zbadane przy składaniu
tej instrukcji: `workSignalProducerJob.ts`, `signalEvaluator.ts` i cała ścieżka
`server/src/services/signals/**` nie importują `redis`/`bullmq`/`ioredis` —
producent czyta i pisze wyłącznie przez `queryAll` (Postgres). Potwierdź to
sam przed startem; jeśli Twój wynik jest inny, dopisz kontener Redis do
instrukcji i uzasadnij w raporcie, dlaczego brief się mylił.

**(2) Wystaw fixture Czatu** (`provision` → `seed` z nowym manifestem →
`readback`) na `consultify_w3_chat_owner_cx182`.

**(3) Dopisz minimalne, kwalifikujące dane** pod org/user id z fixture Czatu —
**w swoim własnym pliku dowodowym, nie w `seed-wave3-chat-owner-review.mjs`**
(ten plik ma zamkniętą, sprawdzaną `PREFIX`/`FIXTURE_ID` odpowiedzialność za
Chat, nie za inne domeny). Najtańsza, najbardziej wiarygodna droga:
jeden wiersz `initiatives` bez odpowiadającego wiersza w
`initiative_schedule_baselines` — `initiativeNoBaselineRule`
(`server/src/services/signals/rules/execution/initiativeNoBaseline.ts`) nie ma
progu wieku i zapala się natychmiast. Jeśli chcesz szerszy dowód, dodaj też
jeden `task` z `due_date` w przeszłości i `status` różnym od `done` (dla
`taskOverdueRule`) — schemat kolumn czytaj wprost z plików reguł w
`server/src/services/signals/rules/**`, nie zgaduj nazw.

**(4) Ustaw `ENABLE_SIGNAL_PRODUCER=true` w powłoce** i wywołaj
`runDeterministicForOrganization({ organizationId, trigger: 'ON_DEMAND' })`
(bezpośrednio z testu/skryptu, nie czekaj na prawdziwy 15-minutowy cron).
Sprawdź: (i) `work_signal_runs` ma nowy wiersz ze statusem zakończenia (nie
`SKIPPED_DISABLED`); (ii) tabela odczytu sygnałów ma nowy wiersz dla reguły
`initiativeNoBaseline` (i innych, jeśli dodałeś więcej danych); (iii)
`ChatSignalsFeed.tsx` — wywołany przez realny endpoint `signals.routes.ts`,
nie zamockowany — pokazuje ten sygnał w UI, jasny i ciemny motyw, zrzut.

**(5) Dowód OFF→ON, nie tylko ON.** Ten sam scenariusz z
`ENABLE_SIGNAL_PRODUCER` nieustawionym (albo `false`) MUSI dać
`SKIPPED_DISABLED` dla `ON_DEMAND` (z wierszem w `work_signal_runs`) i ZERO
wiersza dla `CRON` (FIX-3 dnia 18 — bez tego CRON puchnie tabelą ~96
wierszy/dobę/organizację). Zrzut UI w tym stanie też — sprawdź, czy trafiasz
w trzeci stan pustki z T3 i czy Twój seed sprawia, że komunikat jest
uczciwy czy nieuczciwy dla TEJ konkretnej organizacji (Twoja ma dane, więc
po włączeniu nie powinna pokazać `chatSignals.empty.good` — jeśli pokazuje,
to nowe, realne znalezisko, nie zastałe).

**Ukończone, gdy:** masz zrzuty i logi obu stanów (OFF i ON) na realnym
Postgresie, `numTotalTests`/liczba faktycznie uruchomionych przypadków dla
każdego testu przywołanego jako dowód, i jawne potwierdzenie, że `ChatSignalsFeed`
pokazuje sygnał wyprodukowany Twoim dowodem (nie zamockowany endpoint).

## R2 — inwentarz ośmiu reguł do karty 13_CHAT

Tabela do `docs/program/waves/WAVE_03_ACCEPTANCE/modules/13_CHAT/MODULE_ACCEPTANCE.md`
(nowa sekcja, nie nadpisuj istniejących), jeden wiersz na regułę, kolumny:
`ruleId` · domena · tabela(-e) źródłowa(-e) · warunek zapłonu (z kodu, nie z
pamięci) · próg wieku/czasu (jeśli istnieje) · czy Twój dowód R1 go
wywołał (tak/nie/nie dotyczy). Źródło: `server/src/services/signals/rules/index.ts`
i osiem plików pod `execution/`, `decision/`, `finance/`, `results/`. Dla
każdej reguły podaj DOKŁADNĄ nazwę tabeli i kolumnę warunku z zapytania SQL —
nie parafrazuj.

Dopisz też jedno zdanie o `runToolWithRetry`-analogicznym ryzyku: czy CRON
(bezwarunkowo zarejestrowany, `*/15 * * * *`) i Twój `ON_DEMAND` mogą się
wyścigowo nałożyć na tę samą organizację w oknie testu — jeśli tak, opisz to
jako obserwację, nie naprawiaj.

**Ukończone, gdy:** tabela ośmiu reguł jest w karcie z realnymi nazwami
tabel/kolumn zweryfikowanymi w kodzie, plus status trzeciego stanu pustki
(T3) jako osobny wiersz „znane, nienaprawione”.

## R3 — wartość env dla stagingu (przygotowanie, NIE wykonanie)

Dokładna wartość: `ENABLE_SIGNAL_PRODUCER=true`. Napisz w raporcie:

- **Co NIE zmienia się razem z tym** — `ENABLE_SIGNAL_INTERPRETER` zostaje
  OFF (osobna decyzja); `DISABLE_SCHEDULER` zostaje jak jest (nie dotyczy tej
  flagi wprost, ale CRON i tak jest zawsze zarejestrowany).
- **Gdzie nadzorca ma ją ustawić** — zmienna środowiskowa usługi backendowej
  na `staging.consultify.ai` (kontrakt rozdziału staging/demo/produkcja,
  `DEC-2026-08-25-65`: staging = rozwój, demo = zamrożone; ta flaga wpływa
  wyłącznie na runtime serwera, zero migracji, zero zmiany schematu). NIE
  edytujesz `railway.json`/`railway.api.json`/`railway.frontend.json` — to
  robi nadzorca skillem `consultify-promocja-demo`.
- **Co nadzorca powinien zobaczyć po włączeniu** — wskazówka z Twojego R1:
  bez danych źródłowych (tasks/initiatives/decisions/KPI/budżety) w danej
  organizacji feed pozostanie pusty; to nie jest błąd włączenia, to brak
  danych. Jeśli na stagingu są organizacje z realnymi inicjatywami/zadaniami,
  feed powinien zacząć się zapełniać przy najbliższym tiku crona (do 15 min).

Zero komend `railway`, zero połączeń do stagingu w Twoim dyżurze — to
wyłącznie tekst do raportu.

**Ukończone, gdy:** raport ma gotowy do wklejenia fragment (wartość + miejsce
+ oczekiwany skutek) bez żadnej wykonanej akcji na Railway.

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis | testy `day182.*` w `server/src/services/signals/__tests__/` i/lub `tests/integration/routes/` — nowy dowodowy plik z seedem kwalifikujących danych (R1) |
| Zapis | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/13_CHAT/MODULE_ACCEPTANCE.md` — wyłącznie nowa sekcja z tabelą ośmiu reguł (R2) |
| Zapis | `dev-render/main.tsx` — WYŁĄCZNIE jeśli T6 z bloku 0 pokaże, że wpis `'chat-signals-feed'` w rejestrze `SCREENS` naprawdę zniknął (oczekiwany wynik: już istnieje, zero zmian) |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY182_SYGNALY_ON_REPORT.md` |
| Warunkowe (tylko jeśli producent wywala się na starcie) | `server/src/jobs/workSignalProducerJob.ts` — minimalny fix z testem, opisany jako odstępstwo od zakresu w raporcie |
| Odczyt | `server/src/cron/Scheduler.ts`, `server/src/index.ts:612` — rejestracja crona i globalny `DISABLE_SCHEDULER`; **nie zmieniasz** |
| Odczyt | `server/src/services/signals/rules/**`, `server/src/services/signals/signalEvaluator.ts`, `server/src/services/signals/ruleRegistry.ts` — inwentarz reguł do R2; **nie zmieniasz** |
| Odczyt | `server/src/services/signals/signalInterpreter.ts` — warstwa AI, poza zakresem D-2; **nie zmieniasz**, tylko obserwujesz i opisujesz stan |
| Odczyt | `src/components/AIChat/signalsFeed/ChatSignalsFeed.tsx`, `ChatSignalsFeedPreview.tsx` — konsument feedu do zrzutów R1/R2; **nie zmieniasz kodu** |
| Odczyt | `scripts/dev/seed-wave3-chat-owner-review.mjs` — fixture Czatu; **nie zmieniasz** (dopisujesz dane WŁASNYM skryptem/testem, nie tym plikiem) |
| Odczyt | `.env.example`, `railway.json`, `railway.api.json`, `railway.frontend.json` — **nie zmieniasz żadnego**; R3 to tylko tekst raportu |

★ **Rozłączność z dyżurami działającymi równolegle:** 181 (Spotkania —
`betaMenuStatus.ts`, `src/routes/AppRoutes.tsx`, `src/components/Meeting/**`)
i 183 (Moja praca — `myWorkCalendarV2Flag.ts`, `src/components/MyWork/**`) NIE
dotykają żadnego pliku z Twojej tabeli i odwrotnie.

# 5. TWARDE ZASADY

- ★★ **NIE WŁĄCZASZ `ENABLE_SIGNAL_INTERPRETER` nigdzie** — ani w kodzie, ani
  w powłoce testowej, ani jako rekomendacja w raporcie. To osobna, jeszcze
  nierozstrzygnięta decyzja właściciela.
- ★★ **`ENABLE_SIGNAL_PRODUCER` ustawiasz WYŁĄCZNIE w powłoce własnego
  przebiegu testowego.** Zero wpisów w `.env`, `.env.example`,
  `docker-compose*`, `railway*.json` i zero zmiany wartości domyślnej w
  `workSignalProducerJob.ts:10-12`.
- **Dodatkowe dane dla dowodu R1 idą do WŁASNEGO pliku testowego/seedu, nigdy
  do `seed-wave3-chat-owner-review.mjs`.** Ten plik ma zamkniętą,
  weryfikowaną odpowiedzialność za jedną rodzinę fixture (`W3-CHAT-OWNER-v1`).
- **Nie naprawiasz trzeciego stanu pustki (`ChatSignalsFeed.tsx:266-271`)
  ani żadnego innego zastałego defektu** — R2 to inwentarz, nie remont.
- **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.** Wyłącznie
  lokalny kontener `cx-day182-pg` (i WYŁĄCZNIE jeśli T5 każe, dodatkowy Redis).
- **Dowód tylko na realnym Postgresie.** `NODE_ENV=test` bez `RUN_DB_TESTS=1`
  po cichu podmienia bazę na mock (`server/src/database/Database.ts`) — cały
  dowód poszedłby w atrapę. `skipped` i `No test files found` to nie jest
  `PASS` — w każdym przywoływanym wyniku podaj `numTotalTests` i liczbę
  faktycznie uruchomionych przypadków.
- **Każdą cytowaną linię kodu sprawdzasz sam przed wklejeniem do raportu.**
  Numery w tej instrukcji zweryfikowano wobec markera `18661cc6a0`, ale plik
  żyje.
- ★ Port **5000 jest zajęty na stałe przez macOS Control Center**.
- **Sekcja „TWIERDZENIA NIEZWERYFIKOWANE” w raporcie jest obowiązkowa.**
  Wypisz w niej wprost co najmniej: czy Redis rzeczywiście nie jest potrzebny
  (T5); czy P0 warstwy AI z dnia 18 (`output.proposals` vs `output.content`)
  jest nadal żywy czy już naprawiony (obserwacja, nie naprawa); czy
  `dev-render/screens/chat-signals-feed.tsx` faktycznie jest już zarejestrowany
  w `SCREENS` (T6); oraz czy CRON i Twój `ON_DEMAND` dowód mogły się nałożyć
  w oknie testu.
