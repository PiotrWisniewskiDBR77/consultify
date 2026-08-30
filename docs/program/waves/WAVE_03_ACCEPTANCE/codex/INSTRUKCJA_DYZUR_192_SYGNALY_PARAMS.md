# INSTRUKCJA DYŻURU nr 192 — Codex — „Sygnały deterministyczne — 5 z 8 reguł renderuje surowy `{{value}}` bo żadna nie ustawia `bodyParams`; przelot w evaluatorze już istnieje, brakuje tylko wypełnienia po stronie reguł"

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
> **wyłącznie** `/private/tmp/cx-day192-sygnaly-params`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `b4651675f6`**
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
Zakres: **Chat (moduł 13) — warstwa deterministycznych sygnałów pracy (`server/src/services/signals/**`), ta sama warstwa, którą dyżur 182 włączył (`ENABLE_SIGNAL_PRODUCER`). NIE dotyczy warstwy AI/interpretera**.
Trasy front: `brak — ten dyżur nie dotyka żadnego pliku `src/**`. Front (`src/components/AIChat/signalsFeed/signalPresentation.ts`, `public/locales/{pl,en}/translation.json` klucze `chatSignals.rule.*`) już poprawnie robi i18next-interpolację `{{value}}` — problem jest wyłącznie w tym, że serwer dziś wysyła puste `bodyParams`. Dotykasz tych plików TYLKO do odczytu/weryfikacji, nie do zmian`. Trasy tył: `Pięć plików reguł: `server/src/services/signals/rules/execution/taskOverdue.ts`, `.../taskDueSoonNotStarted.ts`, `.../taskBlockedStale.ts`, `server/src/services/signals/rules/decision/pendingStale.ts`, `.../blockingDependents.ts`. Odczyt (nie zmieniasz): `server/src/services/signals/signalEvaluator.ts` (przelot `hit.titleParams ?? {}`/`hit.bodyParams ?? {}` do kolumn `title_params`/`body_params` — już istnieje, ok. linii 125-126 i 162-164), `server/src/services/signals/signalReadModel.ts` (odczyt feedu, znane drugie dno — patrz pułapka piąta), `server/src/types/workSignals.ts` (`RuleHit.titleParams`/`bodyParams` już opcjonalnie zadeklarowane, nie zmieniasz typu)`.

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
WT=/private/tmp/cx-day192-sygnaly-params
MARKER=b4651675f6

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day192-sygnaly-params-20260831 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day192-sygnaly-params/config.worktree"
cat "$VAULT/worktrees/cx-day192-sygnaly-params/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day192-sygnaly-params-scratch
mkdir -p /private/tmp/cx-day192-sygnaly-params-artefakty

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
git -C "$VAULT" log --oneline b4651675f6..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only b4651675f6..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day192-sygnaly-params-20260831
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only b4651675f6..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `sześć` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day192-sygnaly-params

# (T1) OSIEM REGUŁ, PIĘĆ PARAMETRYCZNYCH — potwierdź nazwy plików/ID, nie zgaduj
cat server/src/services/signals/rules/index.ts
grep -n "ruleId:" server/src/services/signals/rules/execution/*.ts server/src/services/signals/rules/decision/*.ts
#   oczekiwane: 8 reguł zarejestrowanych; ID pięciu parametrycznych to `exec.task.overdue`,
#   `exec.task.due_soon_not_started`, `exec.task.blocked_stale`, `dec.pending_stale`,
#   `dec.blocking_dependents`.

# (T2) ŻADNA Z PIĘCIU NIE USTAWIA titleParams/bodyParams DZIŚ
grep -n "titleParams\|bodyParams" server/src/services/signals/rules/execution/taskOverdue.ts \
  server/src/services/signals/rules/execution/taskDueSoonNotStarted.ts \
  server/src/services/signals/rules/execution/taskBlockedStale.ts \
  server/src/services/signals/rules/decision/pendingStale.ts \
  server/src/services/signals/rules/decision/blockingDependents.ts
#   oczekiwane: ZERO trafień w pięciu plikach — każda reguła zwraca `RuleHit` tylko z `data`,
#   mimo że `observedValue` (dokładnie ta liczba, której brakuje w treści) jest już policzone
#   w tym samym `return`.

# (T3) PRZELOT W EVALUATORZE JUŻ ISTNIEJE — to NIE jest miejsce naprawy
grep -n "titleParams\|bodyParams" server/src/services/signals/signalEvaluator.ts
#   oczekiwane: `JSON.stringify(hit.titleParams ?? {})` i `JSON.stringify(hit.bodyParams ?? {})`
#   już zapisują te pola do `title_params`/`body_params` — jeśli reguła je poda, evaluator je
#   zapisze bez żadnej zmiany kodu evaluatora.

# (T4) PLACEHOLDER JEST TYLKO W BODY, TYLKO {{value}} (nie {{count}}) — sprawdź sam, nie zgaduj
grep -n "exec.task.overdue\|exec.task.due_soon_not_started\|exec.task.blocked_stale\|dec.pending_stale\|dec.blocking_dependents" server/src/services/signals/i18n/dictionary.ts
grep -n "chatSignals.rule.signals.exec.task\|chatSignals.rule.signals.dec" public/locales/pl/translation.json public/locales/en/translation.json
#   oczekiwane: `body` pięciu reguł ma `{value}` (serwer, dictionary.ts) / `{{value}}` (klient,
#   locale JSON) — DWIE RÓŻNE konwencje interpolacji w dwóch różnych warstwach; `title` żadnej z
#   pięciu nie ma placeholdera.

# (T5) DRUGIE DNO: signalReadModel.ts MIESZA wartość z evidence TYLKO dla server-side stringa,
# NIE dla tego, co widzi klient — to tłumaczy, dlaczego bug jest widoczny wyłącznie w UI
sed -n '110,150p' server/src/services/signals/signalReadModel.ts
#   oczekiwane: lokalna zmienna `bodyParams` (z `value: evidence[0]?.observedValue`) użyta TYLKO
#   do `translateSignal(row.body_key, bodyParams, ...)` (server-rendered `body`); DTO zwracane do
#   klienta ma `bodyParams: parseJson(row.body_params, {})` — surową, pustą kolumnę.

# (T6) KLIENT ROBI WŁASNĄ RETRANSLACJĘ, DLATEGO FALLBACK NA row.body NIE URUCHAMIA SIĘ
grep -n "translated\|dto.bodyParams\|dto.bodyKey" src/components/AIChat/signalsFeed/signalPresentation.ts
#   oczekiwane: `t(chatSignals.rule.\${key}, {...params, defaultValue: ''})` — fallback do
#   `dto.body` uruchamia się TYLKO gdy klucz jest NIEZNANY w katalogu i18next, nie gdy parametry
#   są puste. Klucz istnieje (T4) → i18next renderuje `{{value}}` dosłownie zamiast się poddać.
```

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day192-sygnaly-params-20260831` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6112`. Twój JEDYNY port harnessu to `5056 i 5057`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day192-pg`**. **ZAKAZANE:** `6012, 5433, 6047, 6054-6110, 5010-5053, 6404-6411 (odbiory nadzorcy i wcześniejsze dyżury). ★ WZAJEMNIE z dyżurem 191 (równoległym, inny obszar kodu — renderer PDF, zero wspólnych plików zapisu): 6111/5054-5055. Zajęte też: 6108-6109-6113/5048-5051-5058-5059. Twoje własne to WYŁĄCZNIE 6112 i 5056/5057. ★ REDIS NIE JEST WYMAGANY — cała ścieżka `server/src/services/signals/**` używa wyłącznie Postgres (potwierdzone dyżurem 182); nie twórz kontenera Redis. ★ PORT 5000 ZAJĘTY NA STAŁE przez macOS Control Center. ★ PORT 5037 zajęty przez adb — nie używaj`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak nowej flagi. `ENABLE_SIGNAL_PRODUCER` istnieje już (dyżur 182) — ustawiasz ją WYŁĄCZNIE w powłoce własnego przebiegu testowego, jak w 182, NIGDY jako nową wartość domyślną w kodzie`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY192_SYGNALY_PARAMS_REPORT.md`. Nie zmieniasz żadnego `MODULE_ACCEPTANCE.md` — to naprawa silnika sygnałów (przekrojowa, czytana przez wiele modułów: Moja Praca, Wykonanie, Decyzje), nie odbiór wizualny jednego modułu. Jeśli chcesz, dopisz jeden wiersz do inwentarza reguł w `docs/program/waves/WAVE_03_ACCEPTANCE/modules/13_CHAT/MODULE_ACCEPTANCE.md` (dyżur 182 już tam dopisał tabelę ośmiu reguł R2) — zmieniasz WYŁĄCZNIE ten jeden wiersz/kolumnę statusu placeholderów, nic więcej w tym pliku. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day192-sygnaly-params-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day192-sygnaly-params-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **ZAKAZ zmian samych warunków reguł** — progi (`>= 7`, `259_200_000` ms, `432_000_000` ms), `WHERE` w zapytaniach SQL, `severity`, `maxPerRunPerOrg`, `minSeverityToSurface` zostają identyczne co do bajtu. Jedyna dozwolona zmiana w tych pięciu plikach to DODANIE pola `bodyParams: { value: <istniejąca zmienna observedValue lub jej odpowiednik> }` do obiektu zwracanego z `evaluate()`. ★★ **NIE dotykasz pozostałych trzech reguł** (`initiativeNoBaselineRule`, `kpiThresholdBreachedRule`, `budgetOverspendRule`) — ich `body` nie ma placeholdera (potwierdź to sam w T4, nie zakładaj z briefu); jeśli Twoja weryfikacja pokaże inaczej, STOP i opisz rozjazd zamiast cichej zmiany zakresu. ★★ **NIE zmieniasz `signalEvaluator.ts`** — przelot już działa (T3), zmiana tam byłaby niepotrzebnym ryzykiem regresji dla ośmiu reguł naraz. ★★ **NIE zmieniasz `signalReadModel.ts`** — mimo znaleziska „drugiego dna” (T5/pułapka piąta), poprawny fix jest na poziomie reguł (kolumna `body_params` ma zawierać realną wartość od początku), nie łatanie objawu w warstwie odczytu. ★★ **NIE zmieniasz `server/src/types/workSignals.ts`** — pola `titleParams`/`bodyParams` już są opcjonalnie zadeklarowane w `RuleHit`, nic nie trzeba dodawać do typu. ★★ **NIE zmieniasz layoutu/wyglądu** `ChatSignalsFeed.tsx`/`ChatSignalsFeedPreview.tsx` — to naprawa danych wejściowych do i18next, nie ekranu. ★★ **NIE dotykasz `dictionary.ts` ani plików locale** — placeholdery już tam są poprawne (T4), problem jest wyłącznie po stronie danych. ★★ **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.** | Znalezisko 1 z odbioru 182 (`docs/program/funkcje/ODBIOR_182_SYGNALY_ON.md`, „ODBIÓR 182 — producent sygnałów ON · SCALONO (A)”): „★ 5/8 reguł renderuje surowy `{{value}}` w treści sygnału — żadna reguła nie wypełnia `titleParams`/`bodyParams` (grep: zero trafień w rules/**), więc klient dostaje literalny placeholder zamiast liczby dni. → dyżur 192.” Weryfikacja dzisiejsza (SHA `b4651675f6`) potwierdza dokładnie: `server/src/services/signals/rules/index.ts` rejestruje 8 reguł; pięć z nich (`taskOverdueRule`, `taskDueSoonNotStartedRule`, `taskBlockedStaleRule`, `decisionPendingStaleRule`, `decisionBlockingDependentsRule`) mają w `server/src/services/signals/i18n/dictionary.ts` i w `public/locales/{pl,en}/translation.json` (klucz `chatSignals.rule.signals.*.body`) placeholder `{{value}}` w treści — TYLKO w treści, żaden `title` z tych pięciu ma placeholder. Pozostałe trzy (`initiativeNoBaselineRule`, `kpiThresholdBreachedRule`, `budgetOverspendRule`) mają statyczny tekst bez placeholderów — poza zakresem. Evaluator (`signalEvaluator.ts`) JUŻ dziś zapisuje `hit.titleParams ?? {}`/`hit.bodyParams ?? {}` do kolumn `title_params`/`body_params` — przelot istnieje. Żadna z pięciu reguł nie ustawia tych pól w zwracanym obiekcie (`RuleHit`), więc kolumny zawsze zapisują domyślne `'{}'::jsonb` (`server/migrations/20261080_chat_signals_day18_work_signals.sql:15,17`) i klient (`signalPresentation.ts`, i18next) interpoluje `{{value}}` pustymi parametrami. |

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
cd /private/tmp/cx-day192-sygnaly-params

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day192-pg psql -U postgres -d cx192 \
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
cd /private/tmp/cx-day192-sygnaly-params

docker run -d --name cx-day192-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx192 \
  -p 127.0.0.1:6112:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day192-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6112/cx192 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6112/cx192 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day192-sygnaly-params && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6112/cx192 \
JWT_SECRET=cx192-test-secret-do-not-reuse \
npx vitest run server/src/services/signals/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day192-sygnaly-params-artefakty/day192-vitest.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day192-sygnaly-params && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/services/signals/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day192-sygnaly-params-artefakty/day192-vitest.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day192-sygnaly-params/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day192-pg psql -U postgres -d cx192 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day192-pg`.
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
> **(e) ★★ **Pierwsza: wartość do wstawienia jest JUŻ POLICZONA w każdej z pięciu reguł — nie licz jej drugi raz.** `taskOverdueRule`/`taskDueSoonNotStartedRule`/`taskBlockedStaleRule`/`decisionPendingStaleRule` mają `observedValue: Math.floor(...)`/`Math.ceil(...)` (dni) w tym samym obiekcie zwracanym z `evaluate()` — dodaj `bodyParams: { value: observedValue }` obok, odwołując się do tej samej zmiennej/wyrażenia (nie duplikuj logiki dat). `decisionBlockingDependentsRule` ma `observedValue: dependents.length` — to LICZBA OBIEKTÓW, nie dni; nie myl semantyki, tekst „Decyzja blokuje N obiektów” ma sens tylko z liczbą, nie z dniami. ★★ **Druga: TYLKO `body` ma placeholder, `title` żadnej z pięciu reguł go nie ma** (T4) — nie dodawaj `titleParams` „na wszelki wypadek”; jeśli Twoja własna weryfikacja pokaże, że jednak jakiś `title` ma `{{...}}`, dodaj `titleParams` tam i tylko tam, z opisem w raporcie. ★★ **Trzecia: dwie różne konwencje interpolacji w dwóch warstwach — nie myl ich.** `server/src/services/signals/i18n/dictionary.ts` (`translateSignal`) używa `{value}` (pojedynczy nawias, regex `\{([^}]+)\}`) do wytworzenia SERWEROWEGO stringa `row.body`/`row.title` — to DZIAŁA już dziś poprawnie, bo `signalReadModel.ts` miesza `evidence[0].observedValue` do lokalnej zmiennej użytej DO TEGO celu. Front (`signalPresentation.ts`, i18next) używa `{{value}}` (podwójny nawias) i CZYTA `dto.bodyParams` — SUROWĄ kolumnę `body_params`, bez tego mieszania. Naprawiasz TYLKO drugą ścieżkę (kolumnę `body_params`), pierwsza już działa i nie wymaga zmian. ★★ **Czwarta, i to jest sedno, dlaczego bug jest niewidoczny po stronie serwera: `signalReadModel.ts` (T5) liczy wzbogacony `bodyParams` (z `value` z `evidence[0]`) WYŁĄCZNIE po to, żeby wytworzyć `row.body` (wygodny string serwerowy) — ale to, co faktycznie trafia do klienta jako `dto.bodyParams`, to surowa, niewzbogacona kolumna z bazy.** Klient NIE używa `row.body`/`dto.body` jako pierwszego wyboru — `signalPresentation.ts` robi WŁASNĄ retranslację przez i18next z kluczem `chatSignals.rule.\${bodyKey}` i `dto.bodyParams`, i pada z powrotem na `dto.body` TYLKO gdy klucz jest nieznany w katalogu. Klucz jest znany (bo istnieje w `translation.json`) — więc i18next renderuje szablon z pustymi parametrami, dając dosłowny `{{value}}`, zamiast skorzystać z gotowego `dto.body`. To wyjaśnia, dlaczego nikt tego nie złapał po stronie backendu: serwerowy `body`/`title` (gdyby ktoś je obejrzał osobno) wygląda poprawnie. ★★ **Piąta: dowód R3 musi przejść przez CAŁĄ ścieżkę, nie tylko `evaluate()`.** Sam test jednostkowy reguły (sprawdzający `hit.bodyParams`) nie dowodzi, że kolumna `body_params` w Postgresie faktycznie się zapisała, ani że klient faktycznie wyrenderuje liczbę — potrzebujesz testu przez `signalEvaluator` (zapis) LUB przez realny odczyt `work_signals.body_params` po przebiegu producenta (wzorem dowodu R1 z dyżuru 182), plus symulacji/wywołania i18next (albo bezpośrednio funkcji z `signalPresentation.ts`) na obu katalogach (`pl`/`en`) potwierdzającej, że wynikowy string zawiera liczbę, nie `{{`.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day192-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day192-sygnaly-params-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`pozycja R1 — inwentarz dokładny pięciu reguł parametrycznych (jaki placeholder, skąd wartość); pozycja R2 — każda z pięciu reguł ustawia `bodyParams: { value: <już policzona wartość> }` na zwracanym `RuleHit`, zero zmian progów/SQL`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6112` albo `5056 i 5057` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6112` albo `5056 i 5057`** (`Z7`).

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

Znalezisko 1 z odbioru 182 (`docs/program/funkcje/ODBIOR_182_SYGNALY_ON.md`, „ODBIÓR 182 —
producent sygnałów ON · SCALONO (A)"):

> ★ **5/8 reguł renderuje surowy `{{value}}`** w treści sygnału — żadna reguła nie wypełnia
> `titleParams`/`bodyParams` (grep: zero trafień w rules/**), więc klient dostaje literalny
> placeholder zamiast liczby dni. **→ dyżur 192.**

Odbiór 182 ocenił producenta wysoko (dowód A, zakres A, inwentarz A) — deterministyczna warstwa
realnie zapisuje sygnały do Postgresa, mutacja działa w obie strony, inwentarz ośmiu reguł zgadza
się z kodem. To znalezisko NIE podważa tamtej oceny — jest defektem osobnym, jednym poziomem
wyżej: dane są policzone poprawnie, ale nigdy nie docierają do treści, którą widzi użytkownik.

Weryfikacja dzisiejsza (SHA `b4651675f6`) potwierdza dokładnie i precyzuje mechanizm:

**Osiem reguł, pięć parametrycznych.** `server/src/services/signals/rules/index.ts` rejestruje
`taskOverdueRule`, `taskDueSoonNotStartedRule`, `taskBlockedStaleRule`, `initiativeNoBaselineRule`,
`decisionPendingStaleRule`, `decisionBlockingDependentsRule`, `kpiThresholdBreachedRule`,
`budgetOverspendRule`. Pięć pierwszych (poza `initiativeNoBaselineRule`) mają w treści (`body`,
klucz `chatSignals.rule.signals.*`) placeholder `{{value}}`:

```
signals.exec.task.overdue.body            → 'Zadanie jest po terminie o {{value}} dni.'
signals.exec.task.due_soon_not_started.body → 'Do terminu pozostało {{value}} dni.'
signals.exec.task.blocked_stale.body       → 'Brak aktualizacji od {{value}} dni.'
signals.dec.pending_stale.body             → 'Decyzja oczekuje od {{value}} dni.'
signals.dec.blocking_dependents.body       → 'Decyzja blokuje {{value}} obiektów.'
```

**Żaden `title` z tych pięciu ma placeholder** — tylko `body`. Pozostałe trzy reguły
(`initiativeNoBaselineRule`, `kpiThresholdBreachedRule`, `budgetOverspendRule`) mają statyczny
tekst bez placeholderów w ogóle — poza zakresem tego dyżuru.

**Przelot już istnieje — to nie jest miejsce naprawy.** `signalEvaluator.ts` już dziś zapisuje:

```ts
JSON.stringify(hit.titleParams ?? {}),
JSON.stringify(hit.bodyParams ?? {}),
```

do kolumn `title_params`/`body_params` (`work_signals`, `jsonb NOT NULL DEFAULT '{}'::jsonb`).
Problem jest wyłącznie w tym, że żadna z pięciu reguł nie ustawia `bodyParams` na zwracanym
`RuleHit` — mimo że wartość, której brakuje w treści, jest JUŻ POLICZONA w tym samym `return`
(`observedValue`). Kolumna zawsze zapisuje domyślne `{}`.

**Znalezisko ponad brief — drugie dno, dlaczego bug jest niewidoczny po stronie serwera.**
`signalReadModel.ts` (odczyt feedu) miesza lokalną zmienną:

```ts
const bodyParams = {
  value: parseJson<SignalEvidence[]>(row.evidence, [])[0]?.observedValue,
  ...parseJson(row.body_params, {}),
};
// ...
body: translateSignal(row.body_key, bodyParams, params.locale),
```

— ale ten wzbogacony `bodyParams` (z `value` wziętym z `evidence[0]`) jest użyty WYŁĄCZNIE do
wytworzenia wygodnego, server-side stringa `row.body` (konwencja `{value}`, pojedynczy nawias,
`dictionary.ts`). To, co faktycznie trafia do klienta jako `dto.bodyParams`, to SUROWA,
niewzbogacona kolumna (`bodyParams: parseJson(row.body_params, {})`, kilka linii niżej). Klient
(`signalPresentation.ts`) NIE używa `dto.body` jako pierwszego wyboru — robi WŁASNĄ retranslację
przez i18next (`t('chatSignals.rule.' + key, { ...dto.bodyParams, defaultValue: '' })`, konwencja
`{{value}}`, podwójny nawias) i pada z powrotem na `dto.body` TYLKO gdy klucz jest NIEZNANY w
katalogu — nie gdy parametry są puste. Klucz istnieje (jest w `translation.json`), więc i18next
renderuje szablon z pustymi parametrami: dosłowny `{{value}}`. To wyjaśnia, dlaczego nikt tego nie
złapał, patrząc na serwer osobno — `row.body` (gdyby ktoś go obejrzał) wygląda poprawnie.

# 2. TEZY ZLECENIA

- **T1.** Wartość do wstawienia jest już policzona w każdej z pięciu reguł (`observedValue`) —
  naprawa to dodanie `bodyParams: { value: <ta sama zmienna> }` do zwracanego obiektu, nie
  ponowne liczenie dni/liczby obiektów.
- **T2.** TYLKO `body` ma placeholder, nigdy `title`, dla wszystkich pięciu reguł — potwierdź to
  sam (T4 bloku wejściowego) zamiast zakładać z góry, że oba pola wymagają params.
- **T3.** Przelot w `signalEvaluator.ts` istnieje i działa — zero zmian tam. Naprawa jest
  WYŁĄCZNIE w pięciu plikach reguł.
- **T4.** `signalReadModel.ts` ma osobny mechanizm mieszania wartości z `evidence`, ale służy on
  wyłącznie server-side stringowi (`row.body`), nie temu, co widzi klient — nie jest to
  alternatywne miejsce naprawy i nie wolno go dotykać w ramach tego dyżuru.
- **T5.** `decisionBlockingDependentsRule` liczy LICZBĘ OBIEKTÓW (`dependents.length`), nie dni —
  semantyka różni się od pozostałych czterech reguł (dni); nie kopiuj mechanicznie tego samego
  komentarza/nazwy zmiennej między regułami bez sprawdzenia sensu zdania.

# 3. POZYCJE DYŻURU

## R1 — inwentarz pięciu reguł parametrycznych

Dla każdej z pięciu reguł potwierdź i zapisz w raporcie (tabela): `ruleId`, plik, nazwa
placeholdera w `body` (oczekiwane: wszystkie pięć to `{{value}}`, żadne `{{count}}` — ale
zweryfikuj samodzielnie, nie przepisz z tej instrukcji bez sprawdzenia), i skąd bierze się
wartość:

| ruleId | plik | co liczy `observedValue` |
|---|---|---|
| `exec.task.overdue` | `rules/execution/taskOverdue.ts` | dni po terminie (`Math.max(1, Math.floor((now - due_date)/86400000))`) |
| `exec.task.due_soon_not_started` | `rules/execution/taskDueSoonNotStarted.ts` | dni do terminu (`Math.ceil((due_date - now)/86400000)`) |
| `exec.task.blocked_stale` | `rules/execution/taskBlockedStale.ts` | dni bez aktualizacji (`Math.floor((now - updated_at)/86400000)`) |
| `dec.pending_stale` | `rules/decision/pendingStale.ts` | dni oczekiwania (`Math.floor((now - created_at)/86400000)`) |
| `dec.blocking_dependents` | `rules/decision/blockingDependents.ts` | liczba zablokowanych obiektów (`dependents.length`) |

Potwierdź tę tabelę własnym `grep`/odczytem — jeśli którakolwiek wartość różni się od tego, co tu
napisano (np. inna jednostka, inne zaokrąglenie), popraw w raporcie i wyjaśnij rozbieżność.

## R2 — każda reguła ustawia `bodyParams`

W każdym z pięciu plików dodaj `bodyParams: { value: <istniejąca zmienna/wyrażenie observedValue> }`
do obiektu zwracanego z `evaluate()`, obok istniejących pól (`subjectId`, `projectId`,
`observedValue`, `observedAt`, `data`) — nie wewnątrz `data`, jako siostrzane pole. Przykład dla
`taskOverdueRule` (analogicznie dla pozostałych czterech):

```ts
return rows.map((row) => ({
  subjectId: row.id,
  projectId: row.project_id,
  observedValue: Math.max(1, Math.floor((ctx.now.getTime() - new Date(row.due_date).getTime()) / 86_400_000)),
  observedAt: ctx.now.toISOString(),
  data: { assigneeId: row.assignee_id },
  bodyParams: { value: /* ta sama wartość co observedValue powyżej — nie licz drugi raz */ },
}));
```

Zero zmian progów, `WHERE`, `severity`, `maxPerRunPerOrg`, `minSeverityToSurface` — dosłownie
jedno nowe pole na regułę. Jeśli w R1 potwierdzisz, że któryś `title` też ma placeholder, dodaj
analogicznie `titleParams` TYLKO tam.

**Ukończone, gdy:** wszystkie pięć plików reguł zwraca `bodyParams: { value: N }` z realną
liczbą; `signalEvaluator.ts`, `signalReadModel.ts`, `workSignals.ts` — zero zmian (potwierdź
diffem w raporcie, że te trzy pliki są nietknięte).

## R3 — dowód: liczba, nie `{{`, po polsku i angielsku

Dowód musi przejść przez CAŁĄ ścieżkę, nie zatrzymać się na `evaluate()`:

1. Test jednostkowy/PG rozszerzający `executionRules.postgres.test.ts` i
   `decisionRules.postgres.test.ts` (istniejące pliki, wzorzec `SignalRule.evaluate` na realnym
   PostgreSQL) — potwierdź `hit.bodyParams` równe `{ value: N }` dla znanego fixture (N
   policzone niezależnie od testu, np. `due_date` ustawiony na `now - 3 dni` → oczekiwane `N=3`).
2. Test/dowód end-to-end na realnym Postgresie (wzorem R1 z dyżuru 182: `ENABLE_SIGNAL_PRODUCER=true`,
   `runDeterministicForOrganization`/`runDeterministicTick`) potwierdzający, że kolumna
   `work_signals.body_params` w bazie zawiera realną wartość (nie `{}`) po przebiegu producenta —
   `SELECT body_params FROM work_signals WHERE rule_id = 'exec.task.overdue'` jako dowód
   dosłowny w raporcie.
3. Symulacja/wywołanie warstwy klienta — albo bezpośrednio funkcji z `signalPresentation.ts`
   (`signalBody`), albo i18next z załadowanymi katalogami `pl`/`en` i kluczem
   `chatSignals.rule.signals.exec.task.overdue.body` + `{ value: 3 }` — potwierdzające, że
   wynikowy string zawiera liczbę (`"Zadanie jest po terminie o 3 dni."` /
   `"The task is 3 days overdue."`), nie `{{value}}`, w OBU językach.
4. **Zrzut feedu** (wzorem dowodu 182: `dev-render/screens/chat-signals-feed.tsx`, porty
   `5056`/`5057`) pokazujący realny sygnał z liczbą w treści, nie placeholderem — co najmniej
   jeden zrzut z realną wartością zamiast `{{value}}`.

**Ukończone, gdy:** dowody 1-3 są zielone i mutacyjne (cofnięcie zmiany w regule → test/dowód
czerwony z tą samą przyczyną); zrzut feedu istnieje w artefaktach i pokazuje liczbę w treści
sygnału.

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis | `server/src/services/signals/rules/execution/taskOverdue.ts` — wyłącznie dodanie `bodyParams` |
| Zapis | `server/src/services/signals/rules/execution/taskDueSoonNotStarted.ts` — wyłącznie dodanie `bodyParams` |
| Zapis | `server/src/services/signals/rules/execution/taskBlockedStale.ts` — wyłącznie dodanie `bodyParams` |
| Zapis | `server/src/services/signals/rules/decision/pendingStale.ts` — wyłącznie dodanie `bodyParams` |
| Zapis | `server/src/services/signals/rules/decision/blockingDependents.ts` — wyłącznie dodanie `bodyParams` |
| Zapis | `server/src/services/signals/__tests__/executionRules.postgres.test.ts`, `decisionRules.postgres.test.ts` — rozszerzenie o asercje `bodyParams` |
| Zapis | testy `day192.*` nowe (end-to-end producent → kolumna DB → klient), jeśli istniejące pliki nie wystarczają |
| Zapis (opcjonalnie) | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/13_CHAT/MODULE_ACCEPTANCE.md` — wyłącznie jeden wiersz/kolumna w tabeli ośmiu reguł (dyżur 182), status placeholderów |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY192_SYGNALY_PARAMS_REPORT.md` |
| Odczyt | `server/src/services/signals/signalEvaluator.ts` — przelot już poprawny; nie zmieniasz |
| Odczyt | `server/src/services/signals/signalReadModel.ts` — kontekst „drugiego dna"; nie zmieniasz |
| Odczyt | `server/src/types/workSignals.ts` — `RuleHit` już ma pola opcjonalne; nie zmieniasz |
| Odczyt | `server/src/services/signals/i18n/dictionary.ts`, `public/locales/{pl,en}/translation.json` — źródło placeholderów; nie zmieniasz |
| Odczyt | `src/components/AIChat/signalsFeed/signalPresentation.ts` — mechanizm klienta; nie zmieniasz |
| Odczyt | `docs/program/funkcje/ODBIOR_182_SYGNALY_ON.md` — źródło zlecenia (znalezisko 1); nie zmieniasz |

**Nietykalne imiennie:** `signalEvaluator.ts`, `signalReadModel.ts`, `workSignals.ts`,
`dictionary.ts`, pliki locale, `signalPresentation.ts`, `ChatSignalsFeed.tsx`,
`ChatSignalsFeedPreview.tsx`; pozostałe trzy reguły (`initiativeNoBaseline.ts`,
`kpiThresholdBreached.ts`, `budgetOverspend.ts`) — chyba że R1 obali ich brak placeholderów, w
którym wypadku STOP i opisz zamiast cicho rozszerzać zakres.

★ **Rozłączność z dyżurem 191 (równoległym):** 191 pracuje wyłącznie w
`server/src/services/documentStudio/documentPdfRenderer.ts` i testach Document Studio/Audytów —
zero pokrycia z plikami tego dyżuru (`server/src/services/signals/**`). Zero wspólnych plików
zapisu.

# 5. TWARDE ZASADY

- ★ **Zakaz zmian progów/warunków reguł.** Jedyna dozwolona zmiana w pięciu plikach reguł to
  dodanie pola `bodyParams` — SQL `WHERE`, stałe czasowe (`86_400_000`, `259_200_000`,
  `432_000_000`), `severity`, `maxPerRunPerOrg` zostają identyczne co do bajtu.
- **Nie zmieniasz `signalEvaluator.ts` ani `signalReadModel.ts`** — przelot już istnieje;
  „drugie dno" w read modelu jest do opisania w raporcie, nie do naprawy.
- **Nie zmieniasz layoutu feedu** (`ChatSignalsFeed.tsx`/`ChatSignalsFeedPreview.tsx`) — to
  naprawa danych, nie ekranu.
- **Dowód musi przejść przez całą ścieżkę**: reguła → kolumna `body_params` w Postgresie →
  render klienta (i18next, oba języki) — sam zielony test jednostkowy reguły nie wystarcza.
- Wzór dowodu: dyżur 182 (ocena A) — realny zapis do PG, mutacja w obie strony, sha256
  artefaktów, zrzut feedu obejrzany własnymi oczami.
- Pułapka ogólna programu: bez `RUN_DB_TESTS=1` testy backendowe idą na MOCK DB — dowód
  end-to-end MUSI być na realnym PostgreSQL.
- Pułapka: `No test files found` NIE jest `PASS`. Sprawdź `numTotalTests` > 0.
- ★ Port **5000 jest zajęty na stałe przez macOS Control Center**; **5037 przez adb** — nie
  używaj ich do żadnego serwera pomocniczego.
- **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.** Wszystko lokalnie, na
  `cx-day192-pg`.
- Wymóg sekcji „TWIERDZENIA NIEZWERYFIKOWANE" w raporcie końcowym — wypisz w niej wprost, jeśli
  nie zdążyłeś potwierdzić wszystkich pięciu wartości w tabeli R1 niezależnie od tej instrukcji,
  albo jeśli dowód R3 pokrył tylko jeden z dwóch języków (pl/en).
