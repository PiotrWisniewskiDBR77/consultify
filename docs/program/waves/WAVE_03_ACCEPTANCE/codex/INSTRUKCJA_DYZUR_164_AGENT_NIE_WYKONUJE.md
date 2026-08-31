# INSTRUKCJA DYŻURU nr 164 — Codex — „Agent tworzy plan i go nie wykonuje - mapa sciezki, ryzyko wlaczenia, material do decyzji wlasciciela"

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
> **wyłącznie** `/private/tmp/cx-day164-agent-nie-wykonuje`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `23bc57aaf3`**
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
Zakres: **Czat / Teresa - wykonywanie planu agenta od konca do konca**.
Trasy front: ``src/components/AIChat/AgentPlanPanel.tsx`, `src/components/AIChat/AgentHubShell.tsx`, `src/services/agentPlan.api.ts` - do odczytu i mapy`. Trasy tył: ``server/src/routes/ai/agent-plan.routes.ts`, `server/src/services/ai/agentTaskDispatchService.ts`, `server/src/jobs/agentPlanSchedulerJob.ts`, `server/src/cron/Scheduler.ts`, `server/src/workers/**` - wylacznie do odczytu`.

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
WT=/private/tmp/cx-day164-agent-nie-wykonuje
MARKER=23bc57aaf3

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day164-agent-nie-wykonuje-20260830 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day164-agent-nie-wykonuje/config.worktree"
cat "$VAULT/worktrees/cx-day164-agent-nie-wykonuje/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day164-agent-nie-wykonuje-scratch
mkdir -p /private/tmp/cx-day164-agent-nie-wykonuje-artefakty

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
git -C "$VAULT" log --oneline 23bc57aaf3..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only 23bc57aaf3..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day164-agent-nie-wykonuje-20260830
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 23bc57aaf3..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `cztery` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day164-agent-nie-wykonuje

# (T1) PODWOJNA BRAMKA - trzy miejsca, jedna flaga
grep -rn "ENABLE_AI_TASKS_WORKER" server/src --include='*.ts' | grep -v __tests__
#   oczekiwane: agentTaskDispatchService.ts, agentPlanSchedulerJob.ts:72, Scheduler.ts:879,
#   aiWorkerRuntime.ts. Ustal sam, czy ominiecie JEDNEJ bramki cokolwiek daje.

# (T2) PIERWSZY PUNKT ZERWANIA
grep -n "DISABLED" server/src/services/ai/agentTaskDispatchService.ts
#   UWAGA: plan grafiki podaje sciezke BEZ segmentu /ai/ - to bledne wskazanie.
#   Prawdziwa sciezka: server/src/services/ai/agentTaskDispatchService.ts

# (T3) DRUGI PUNKT ZERWANIA - NIEZALEZNY OD FLAGI
grep -n "runAgentPlan(" src/components/AIChat/AgentPlanPanel.tsx
#   oczekiwane: front destrukturyzuje WYLACZNIE { plan }, a odpowiedz niesie tez
#   pole 'dispatch'. Czyli nawet gdyby backend powiedzial 'nie udalo sie' -
#   UI by tego NIE POKAZAL. To tlumaczy '200 i nic sie nie dzieje'.

# (T4) CZY COKOLWIEK WYSLE POCZTE
grep -rn "MEETING_INVITES_LIVE" server/src --include='*.ts' | grep -v __tests__
#   To jest REALNA bramka zaproszen. Flaga ENABLE_LIVE_EMAIL NIE ISTNIEJE -
#   nie szukaj jej i nie raportuj, ze jest wylaczona.
```

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day164-agent-nie-wykonuje-20260830` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6052`. Twój JEDYNY port harnessu to `4996 i 4997`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day164-pg`**. **ZAKAZANE:** `6012, 5433, 6039 (153), 6044 (157), 6045 (158), 6046 (159), 6047 (odbior nadzorcy), 6048/4988-4989 (160), 6049/4990-4991 (161), 6050/4992-4993 (162), 6051/4994-4995 (163)`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w ``ENABLE_AI_TASKS_WORKER` - **NIE ZMIENIASZ jej wartosci domyslnej w repo**; wlaczasz ja wylacznie w zmiennej srodowiskowej swojej lokalnej sesji na potrzeby pomiaru R2`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY164_AGENT_NIE_WYKONUJE_REPORT.md`. Nie zmieniasz zadnego `MODULE_ACCEPTANCE.md` - ten dyzur jest pomiarowy. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day164-agent-nie-wykonuje-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day164-agent-nie-wykonuje-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **NIE WLACZASZ FLAGI W REPO.** Zero zmian wartosci domyslnej `ENABLE_AI_TASKS_WORKER`. Flaga zostaje wylaczona po Twoim dyzurze - wlaczenie to **decyzja wlasciciela**, a komentarz 'after owner approval' w kodzie jest tam nieprzypadkowo. Wlaczasz ja wylacznie w zmiennej srodowiskowej swojej lokalnej sesji. **Domyslnie ten dyzur NIE ZMIENIA KODU PRODUKTU** - jesli znajdziesz defekt blokujacy pomiar, OPISZ go, nie naprawiaj. **Zero polaczen do bazy zdalnej, demo, stagingu i produkcji** - worker dzialajacy na cudzych danych to najgorszy mozliwy wynik tego dyzuru. **Zero realnej wysylki poczty i zaproszen** - sprawdz `MEETING_INVITES_LIVE`, `SMTP_HOST`, `SMTP_USER` oraz wiersze `smtp_%` w tabeli `settings` ZANIM cokolwiek uruchomisz. **Jesli worker zacznie palic budzet modelu jezykowego - ZATRZYMAJ SIE i zglos.** Zasadny STOP jest tu pochwala. **NIE DOTYKASZ `server/src/services/aiActionExecutor.ts`** - to terytorium rownolegle biegnacego dyzuru 162, nawet jesli sciezka agenta przez ten plik przechodzi; czytac wolno | Odbior wlasciciela (FALA 6 w `docs/program/grafika/PLAN_PO_ODBIORZE.md`) zmierzyl: **plan sie tworzy (201, trzy kroki w bazie), uruchomienie zwraca 200 i NIE ROBI NIC.** Wlasciciel powiedzial wprost, ze czeka go 'cala produkcja bardzo madrego agenta' - to dla niego temat pierwszej wagi. Sciezka ma dziesiec ogniw, wszystkie istnieja w kodzie, trzy sa za flaga, a front dodatkowo **gubi informacje o niepowodzeniu**. Nikt nie wie, co sie stanie po wlaczeniu - i tego ma dowiedziec sie ten dyzur, ZANIM ktokolwiek cokolwiek wlaczy |

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
cd /private/tmp/cx-day164-agent-nie-wykonuje

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day164-pg psql -U postgres -d cx164 \
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
cd /private/tmp/cx-day164-agent-nie-wykonuje

docker run -d --name cx-day164-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx164 \
  -p 127.0.0.1:6052:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day164-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6052/cx164 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6052/cx164 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day164-agent-nie-wykonuje && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6052/cx164 \
JWT_SECRET=cx164-test-secret-do-not-reuse \
npx vitest run server/src/workers/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day164-agent-nie-wykonuje-artefakty/day164-vitest.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day164-agent-nie-wykonuje && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/workers/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day164-agent-nie-wykonuje-artefakty/day164-vitest.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day164-agent-nie-wykonuje/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day164-pg psql -U postgres -d cx164 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day164-pg`.
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
> **(e) **Testy tej sciezki ustawiaja flage na `true` i przechodza - to NIE dowodzi, ze sciezka dziala w produkcie.** To ksztalt nazwany 30.08: 'biblioteka bez wywolania' - kod z zielonymi testami i zerem konsumentow. Dla KAZDEGO z dziesieciu ogniw sprawdz osobno, czy wola je cokolwiek poza testem. **Druga pulapka - dwa punkty zerwania, nie jeden.** Flaga to jedno; drugie jest we froncie: `AgentPlanPanel.tsx:369` robi `const { plan: updated } = await runAgentPlan(...)` i **wyrzuca pole `dispatch`**, ktore niesie informacje o niepowodzeniu. Dlatego uzytkownik widzi sukces przy calkowitym braku dzialania. Naprawa samej flagi tego NIE naprawi. **Trzecia: dwie sprzecznosci w kodzie do ZARAPORTOWANIA, nie naprawiania** - `agentPlanFlag.ts:22` deklaruje domyslnie ON, a komentarz w `routeConfig.ts:62` twierdzi 'default OFF'; naglowek `agentPlan.api.ts:9` twierdzi, ze modul 'nie jest jeszcze nigdzie importowany', a grep pokazuje czterech realnych importerow. **Czwarta: `ENABLE_LIVE_EMAIL` NIE ISTNIEJE** - nadzorca wpisywal ja do instrukcji przez caly dzien jako bezpiecznik poczty; to byl fantom. Realny warunek wysylki to `emailService.ts:202` (host i user jednoczesnie, czytane NAJPIERW z tabeli `settings`), a dla zaproszen `MEETING_INVITES_LIVE`**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day164-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day164-agent-nie-wykonuje-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`pozycje R1 i R3 - pelna mapa dziesieciu ogniw sciezki agenta oraz inwentarz ryzyka wlaczenia, bez ktorego wlasciciel nie moze podjac decyzji`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6052` albo `4996 i 4997` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6052` albo `4996 i 4997`** (`Z7`).

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

Właściciel powiedział wprost, że czeka go „cała produkcja bardzo mądrego agenta" — to jest dla
niego temat pierwszej wagi, nie poboczny. `docs/program/grafika/PLAN_PO_ODBIORZE.md`, sekcja
„FALA 6 — agent", zapisuje pomiar zmierzony od końca do końca na czystej bazie lokalnej: **plan
się tworzy (`201`, trzy kroki w bazie), uruchomienie zwraca `200` i NIE ROBI NIC.** Fala 6 jest
jedyną falą w tym planie, która świadomie nie zaczyna się od pracy, tylko od decyzji właściciela
— i decyzja bez mapy jest decyzją na ślepo.

Ten dyżur buduje tę mapę. Ustala, gdzie dokładnie ścieżka „kliknij Uruchom" pęka, co dokładnie
stoi za wyłączonym przełącznikiem `ENABLE_AI_TASKS_WORKER`, i ile realnie kosztuje jego
włączenie — zanim ktokolwiek go włączy.

Zweryfikowałem trop ustaleń nadzorcy w klonie na gałęzi `codex/day164-agent-nie-wykonuje-20260830`
(marker `23bc57aaf3`):

- `AI_TASKS_WORKER_FLAG = 'ENABLE_AI_TASKS_WORKER'` istnieje w dwóch miejscach z tą samą wartością:
  `server/src/workers/aiWorkerRuntime.ts:5` i `server/src/services/ai/agentTaskDispatchService.ts:6`.
- Bramka w `agentTaskDispatchService.ts` jest na **linii 61**, nie 61 „w `services/`" jak podaje
  plan grafiki (`docs/program/grafika/PLAN_PO_ODBIORZE.md:171`) — prawdziwa ścieżka pliku ma w
  środku `/ai/`: `server/src/services/ai/agentTaskDispatchService.ts:61`
  (`if (env[AI_TASKS_WORKER_FLAG] !== 'true') return { status: 'DISABLED' };`). Popraw to
  wskazanie w raporcie — plan grafiki mylił się co do segmentu ścieżki, nie co do numeru linii.
- Bramka schedulera: `server/src/jobs/agentPlanSchedulerJob.ts:72`
  (`if (process.env.ENABLE_AI_TASKS_WORKER !== 'true') return { plansDispatched: 0, ... }`).
- Bramka crona: `server/src/cron/Scheduler.ts:879` wewnątrz `job38`
  (`if (process.env.ENABLE_AI_TASKS_WORKER !== 'true') return;`, tick co 2 minuty).
- Bramka samego workera BullMQ: `server/src/workers/aiWorkerRuntime.ts:12`
  (`if (env[AI_TASKS_WORKER_FLAG] !== 'true') { ... return null; }`) — z komentarzem dosłownie
  „after owner approval" na linii 14. Wołane z `server/src/index.ts:2124-2125`
  (`await startAiTasksWorker();`) przy starcie serwera.
- Testy `server/src/workers/__tests__/aiWorkerRuntime.test.ts`,
  `server/src/jobs/__tests__/agentPlanSchedulerContextGate.test.ts`,
  `server/src/services/ai/__tests__/agentTaskDispatchService.pg.redis.test.ts` istnieją i
  faktycznie ustawiają `ENABLE_AI_TASKS_WORKER='true'` przed swoimi asercjami — potwierdzone
  grepem, nie założone.

To oznacza **podwójną bramkę**, nie jedną: nawet gdyby coś ominęło gate w
`agentTaskDispatchService.ts:61` i trafiło do kolejki `ai-tasks`, worker który miałby ją
konsumować (`aiWorkerRuntime.ts:12`) sam się nie uruchamia bez tej samej zmiennej środowiskowej.
Zgaś jedną bramkę, a druga nadal trzyma.

## Czym ten dyżur NIE jest

Nie jest włączeniem agenta na żadnej bazie współdzielonej. Nie jest naprawą — jeśli R2 znajdzie
defekt blokujący pomiar, opisujesz go w raporcie i pytasz, nie naprawiasz. Nie jest dyżurem
`aiActionExecutor.ts` — ten plik należy do dyżuru 162 (równoległego), wolno go czytać, jeśli
ścieżka agenta przez niego przechodzi, ale zero zmian, nawet kosmetycznych. Nie jest domknięciem
sprzeczności `agentPlanFlag.ts` kontra `routeConfig.ts` opisanej w R1 niżej — to znalezisko do
zaraportowania, nie do poprawienia w tym dyżurze (poprawka dokumentacji kodu to osobna decyzja
właściciela, bo dotyka komentarza opisującego stan flagi produkcyjnej).

# 2. TEZY ZLECENIA

- **T1.** Ścieżka od kliknięcia „Uruchom" do faktycznego wykonania kroku ma więcej niż jedno
  ogniwo za flagą — nie tylko `agentTaskDispatchService.ts:61`. Trzeba je wszystkie wypisać z
  osobna, bo naprawa jednego bez pozostałych nadal daje `200` i ciszę.
- **T2.** Front-end już dziś nie odróżnia sukcesu od cichej porażki — jeśli endpoint zwraca `200`
  z polem mówiącym „nic się nie stało", a interfejs tego pola nie czyta, to dla użytkownika
  wygląda identycznie jak sukces. To osobny defekt od samej flagi i R1 ma go osobno nazwać.
- **T3.** Zanim właściciel podejmie decyzję o włączeniu, musi znać nie tylko „czy działa", ale
  „co dokładnie zacznie się dziać" — ile wywołań modelu, czy leci poczta, czy da się zatrzymać.
  Brak odpowiedzi na którekolwiek z tych pytań jest samo w sobie odkryciem, nie luką w raporcie.
- **T4.** Kod z zielonymi testami (`aiWorkerRuntime.test.ts`,
  `agentPlanSchedulerContextGate.test.ts`, `agentTaskDispatchService.pg.redis.test.ts`) dowodzi
  wyłącznie tego, że mechanizm zachowuje się zgodnie z założeniem WEWNĄTRZ testu. Nie dowodzi, że
  cokolwiek poza testem go dziś woła w działającym produkcie — to trzeba sprawdzić osobno dla
  każdego ogniwa.

# 3. POZYCJE DYŻURU

## R1 — mapa całej ścieżki od kliknięcia do wykonania

Prześledź KAŻDE ogniwo od frontu do zapisu wyniku i podaj dla każdego plik:linia + stan
(istnieje / nie istnieje / istnieje ale za flagą). Punkt startowy do zweryfikowania samodzielnie
— nie kopiuj beż sprawdzenia — to, co już ustaliłem grepem w tym samym worktree:

1. **Wejście frontu.** Zakładka „Agent" w My Work (`src/components/MyWork/MyWorkHub.tsx`, case
   `'agent'` renderuje `AgentHubShell`) — otwarta pod warunkiem `isAgentPlanEnabled()`
   (`src/utils/agentPlanFlag.ts`). Sprawdź sam, czy to nadal jedyna droga wejścia, czy jest ich
   więcej (np. z czatu Teresy, z `AgentManifestLauncher.tsx`).
2. **Flaga front-endowa `ff_agentPlan`.** `src/utils/agentPlanFlag.ts:22` deklaruje w komentarzu
   „Default: ON" i `readEnvFlag()` (linia 44) rzeczywiście zwraca `true`, gdy zmienna budowy nie
   jest ustawiona. Zderz to z komentarzem w `src/routes/routeConfig.ts:62`
   (`// Gated by agentPlanFlag (default OFF)`) — te dwa komentarze mówią coś przeciwnego o tej
   samej fladze. Rozstrzygnij, które zachowanie jest prawdziwe w Twoim lokalnym buildzie (uruchom
   front i sprawdź realnie, nie czytaj tylko komentarzy — to dokładnie kształt „hipoteza staje
   się faktem"), i zapisz który komentarz jest stały/nieaktualny. Nie poprawiaj komentarza —
   zgłoś rozbieżność.
3. **Panel/klient.** `src/components/AIChat/AgentPlanPanel.tsx:369` woła `runAgentPlan(planId,
   steps, idempotencyKey)` z `src/services/api/agentPlan.api.ts`. Sam plik klienta ma w nagłówku
   (linia 9) zdanie „this module is NOT yet imported anywhere in the app shell" — sprawdź, czy to
   nadal prawda (grep realnych importów w `src/components/AIChat/AgentHubShell.tsx`,
   `AgentPlanPanel.tsx`, `AgentManifestLauncher.tsx`, `AgentWorkshopControls.tsx`) i zapisz wynik
   wprost: jeśli komentarz kłamie, to jest dokładnie kształt „biblioteka bez wywołania" ale
   odwrócony — kod TWIERDZI że jest martwy, a nie jest.
4. **Odpowiedź `/run` a to, co widzi użytkownik.** `runAgentPlan()` w `agentPlan.api.ts` zwraca
   `{ plan, dispatch }` z odpowiedzi serwera (`dispatch` ∈ `'enqueued' | 'unavailable' |
   'idempotent-replay'`). `AgentPlanPanel.tsx:369` robi
   `const { plan: updated } = await runAgentPlan(...)` — destrukturyzuje WYŁĄCZNIE `plan`, pole
   `dispatch` jest odrzucane. Sprawdź, czy istnieje JAKIKOLWIEK inny odczyt tego pola w kodzie
   front-endu (np. osobny toast, log, wskaźnik statusu) — jeśli nie istnieje, to jest samodzielne
   ogniwo zerwania: nawet gdyby backend wracał precyzyjną informację „nic się nie wykonało",
   interfejs by jej nie pokazał.
5. **Endpoint.** `server/src/routes/ai/agent-plan.routes.ts:378` (`router.post('/:id/run', ...)`)
   woła `tryDispatchBackgroundExecution()` (definicja wyżej w tym samym pliku), która woła
   `agentPlannerService.executeGovernedEnqueue()` → `dispatchAgentTask()`. Zwraca `res.json(...)`
   (status domyślny `200`) niezależnie od tego, czy dispatch się udał.
6. **Bramka dispatchu.** `server/src/services/ai/agentTaskDispatchService.ts:61` — flaga wyłączona
   → `{ status: 'DISABLED' }` bez dotknięcia bazy ani kolejki `ai-tasks` (kolejka
   `server/src/queues/aiQueue.js`, importowana dynamicznie na linii 87 tego samego pliku, nie jest
   nawet importowana, gdy flaga jest wyłączona — sprawdź to sam, bo `return` na linii 61
   następuje przed importem).
7. **Scheduler/harmonogram (druga droga wejścia, nie przez `/run`).**
   `server/src/jobs/agentPlanSchedulerJob.ts:72` — ta sama bramka, osobna instancja sprawdzenia.
   Cron ją odpytuje co 2 minuty z `server/src/cron/Scheduler.ts:879` (`job38`), również za tą samą
   zmienną środowiskową sprawdzaną DRUGI raz na tym poziomie.
8. **Worker (konsument kolejki).** `server/src/workers/aiWorkerRuntime.ts:12`, wołane z
   `server/src/index.ts:2124-2125` przy starcie procesu serwera. Gdy flaga wyłączona, worker
   BullMQ dla kolejki `ai-tasks` NIGDY się nie uruchamia — nawet gdyby coś ominęło bramkę R1.6 i
   wstawiło zadanie do kolejki, nikt by go nie odebrał. Zapisz to w raporcie jako dowód podwójnej
   bramki (dispatch + worker), nie jednej.
9. **Wykonanie kroku.** `server/src/workers/aiWorker.ts`, case `'AGENT_BACKGROUND_TASK'`
   (zweryfikuj numer linii sam — plik się zmienia) woła `claimAgentTask()` →
   `agentPlannerService.executeBackgroundPlan()` → `executeToolCall()` z
   `server/src/services/ai/toolDefinitions.ts` → `finishAgentTask()`. To jest jedyne miejsce,
   gdzie realnie coś by się wykonało, gdyby flaga była włączona i zadanie dotarło.
10. **Zapis wyniku.** `finishAgentTask()` w `agentTaskDispatchService.ts` (linia do zweryfikowania
    — ok. 146) zapisuje `SUCCEEDED`/`FAILED` w `ai_agent_job_receipts` i wpis w
    `ai_agent_job_attempts`. Sprawdź, czy istnieje odczyt tych tabel przez front (czy status kroku
    widoczny w `AgentPlanPanel` faktycznie pochodzi stąd, czy z osobnego pollingu `GET
    /:id`).

**Punkty zerwania wypisz osobno**, w kolejności od frontu do backendu, każdy z jednym zdaniem
„co konkretnie się nie dzieje tutaj". Pierwszy punkt zerwania na ścieżce „kliknij Uruchom" to
R1.5/R1.6 (endpoint zwraca `200` mimo `DISABLED`) — ale R1.4 (front odrzuca pole `dispatch`) jest
zerwaniem SAMYM W SOBIE, niezależnym od stanu flagi, i ma być nazwany osobno, bo backfilowanie
flagi bez naprawy R1.4 nadal zostawi użytkownika bez informacji przy każdej przyszłej awarii
dispatchu.

**Ukończone, gdy:** masz numerowaną listę ogniw (co najmniej R1.1–R1.10 powyżej, zweryfikowanych
i skorygowanych, gdzie się myliłem) ze stanem każdego, i osobną listę punktów zerwania z
uzasadnieniem które jest pierwsze na ścieżce, a które jest niezależne.

## R2 — co się dzieje po włączeniu flagi, na lokalnej bazie

Włącz `ENABLE_AI_TASKS_WORKER=true` **wyłącznie w zmiennej środowiskowej swojej lokalnej sesji**
— zero zmian w repo, zero `.env` commitowanego, zero wartości domyślnej ruszonej w kodzie. Baza
demo w migracjach już ma potrzebne tabele (`ai_agent_plans`/`ai_agent_plan_steps` z migracji
`672_enterprise_agent_planner.sql`, `ai_agent_job_receipts` z `20260930_ai_agent_job_receipts.sql`,
leasing z `941_ai_agent_plan_execution_lease.sql`, idempotencja z
`942_ai_agent_plan_run_idempotency.sql`) — ten dyżur nie potrzebuje nowej migracji, tylko
uruchomienia istniejących na pustej lokalnej bazie (`migrate.postgres.ts` z korzenia repo, przez
`sortMigrationsDeterministically` z `server/scripts/migrationOrdering.ts`, wołane z
`server/scripts/migrate.postgres.ts:853` — NIE `files.sort()`).

Wymaga prawdziwego Redisa (`MOCK_REDIS` musi NIE być `'true'` — inaczej `dispatchAgentTask` i
`startAiTasksWorker` same rzucają `AI_TASKS_WORKER_REQUIRES_REAL_REDIS`). Postaw własny lokalny
kontener Redis — nie omijaj tego wymogu podmianą na mock, bo wtedy nie zmierzysz realnej ścieżki,
tylko jej atrapę.

Zmierz i zapisz dosłownie:
- czy `POST /api/ai/agent-plan` z `draft:false` (albo z `manifestId`, ścieżka katalogu, domyślnie
  dispatchuje od razu — patrz komentarz DOROBKA A w `agent-plan.routes.ts`) faktycznie wstawia
  zadanie do kolejki `ai-tasks` (sprawdź w Redisie/logu BullMQ, nie tylko w odpowiedzi HTTP),
- czy worker faktycznie podejmuje zadanie (`claimAgentTask`, log `[BullMQ] ai-tasks worker
  runtime started`),
- czy krok narzędzia faktycznie się wykonuje i gdzie pada pierwszy błąd, jeśli pada (brakujący
  klucz API, brakująca tabela, walidacja `SAFE_ID`, cokolwiek),
- co konkretnie ląduje w `ai_agent_job_receipts` i `ai_agent_job_attempts` po jednym pełnym
  przebiegu — wklej surowe wiersze, nie opis.

Jeśli w trakcie R2 natrafisz na defekt blokujący pomiar — opisz go w raporcie z dowodem
(log/błąd/zrzut zapytania SQL), zaproponuj jednym zdaniem czym mógłby być, i **zatrzymaj się** —
naprawa nie wchodzi w zakres tego dyżuru.

**Ukończone, gdy:** masz log/dowód dla każdego z czterech punktów wyżej z lokalnego przebiegu na
własnym Postgresie i własnym Redisie, i jasne zdanie „doszło do X, dalej nie poszło z powodu Y"
albo „doszło do końca, wynik to Z".

## R3 — inwentarz ryzyka włączenia

Zanim właściciel podejmie decyzję, musi wiedzieć, co ten worker faktycznie robi po włączeniu.
Odpowiedz z dowodami plik:linia, nie z domysłu:

**(a) Czy woła model językowy i ile razy?** Zacznij od `server/src/services/ai/toolDefinitions.ts`
(rejestr `AI_TOOLS`) i `executeToolCall` — dla KAŻDEGO narzędzia, które PlanBuilder/ProcessLibrary
może wygenerować w kroku planu, sprawdź czy jego implementacja woła dostawcę LLM. Policz górne
ograniczenie wywołań na plan (limit kroków na plan to `MAX_STEPS_PER_PLAN = 12`,
`server/src/routes/ai/agent-plan.routes.ts` — zweryfikuj czy to jedyny limit, czy narzędzie samo
w sobie może wywołać model wielokrotnie w jednym kroku).

**(b) Czy wysyła e-maile lub zaproszenia?** ★ Poprawka do wcześniejszego założenia: w kodzie NIE
istnieje przełącznik o nazwie `ENABLE_LIVE_EMAIL` — sprawdziłem grepem po `server/src` i nic takiego
nie znalazłem. Realny gate na zaproszenia spotkań to `MEETING_INVITES_LIVE`
(`server/src/services/meeting/meetingInvitationService.ts:21`), złożony koniunkcją z obecnością
`SMTP_HOST` (linia 22) i `SMTP_USER` (linia 23). Ogólna wysyłka poczty (`server/src/services/
emailService.ts:180-189`) nie ma osobnej flagi włącz/wyłącz — działa albo nie działa zależnie od
tego, czy `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` są w ogóle ustawione. Sprawdź samodzielnie: (1) czy
którekolwiek z tych trzech zmiennych są ustawione w Twojej lokalnej sesji — jeśli tak, wyczyść je
PRZED R2; (2) czy `MEETING_INVITES_LIVE` jest gdziekolwiek `true` domyślnie; (3) czy którekolwiek
narzędzie z `toolDefinitions.ts` faktycznie importuje `meetingInvitationService.ts` albo
`emailService.ts` bezpośrednio lub pośrednio — jeśli znajdziesz taki import, to jest odkrycie
krytyczne i ma wejść do raportu z pełną ścieżką importu. Udowodnij w raporcie, że podczas R2 nic
nie wyszło na zewnątrz (brak połączenia SMTP w logu, brak wiersza w tabeli zaproszeń, albo — jeśli
żaden krok planu nie dotknął tej ścieżki w Twoim przebiegu — napisz to wprost jako „nie
zmierzone", nie jako „bezpieczne").

**(c) Czy pisze do tabel produkcyjnych i których?** Wypisz wszystkie `INSERT`/`UPDATE` w ścieżce
z R1.9-R1.10 (`ai_agent_job_receipts`, `ai_agent_job_attempts`, `ai_agent_plans`,
`ai_agent_plan_steps`) plus cokolwiek, do czego piszą poszczególne narzędzia z `SIDE_EFFECT_TOOLS`
(`server/src/services/ai/sideEffectTools.ts:17-28` — `create_initiative_draft`,
`generate_report_section`, `schedule_meeting`, `create_notebook_entry`, `query_structured_data`,
`create_task`, `update_task`, `create_decision`). Zwróć uwagę na komentarz w tym samym pliku
(linie 23-27): trzy z tych narzędzi (`create_task`, `update_task`, `create_decision`) DO
2026-07-26 pisały do bazy bez żadnej bramki mimo że mutują `tasks`/`decisions` — sprawdź, czy ta
bramka (`requiresApproval` → status `awaiting_approval`) faktycznie działa dziś, czy to też
twierdzenie z komentarza wymagające dowodu.

**(d) Czy da się to zatrzymać po uruchomieniu?** Sprawdź `POST /api/ai/agent-plan/:id/cancel` —
czy anuluje zadanie już odebrane przez workera (`claimAgentTask`), czy tylko zadania, które jeszcze
nie zostały odebrane. Jeśli plan jest w trakcie wykonywania kroku (`executeToolCall` w toku), czy
`cancel` przerywa ten pojedynczy krok, czy czeka na jego zakończenie i zatrzymuje dopiero kolejny.

**(e) Czy ma limity — na liczbę kroków, czas, koszt?** `MAX_STEPS_PER_PLAN = 12` to limit liczby
kroków na plan. Sprawdź: czy istnieje limit czasu na krok/plan (`LEASE_SECONDS = 300` w
`agentTaskDispatchService.ts:8` jest leasingiem zadania w kolejce, NIE limitem czasu wykonania
kroku — nie myl tych dwóch, to inna rzecz). Sprawdź czy istnieje jakikolwiek budżet kosztowy
(`estimatedCostUsd: 0` w `executeGovernedEnqueue` — sprawdź, czy to zawsze `0`, czy bywa realną
liczbą, i czy cokolwiek go pilnuje).

**(f) Co się stanie, gdy krok padnie w połowie?** `finishAgentTask(receiptId, workerId, false,
error)` ustawia `status='FAILED'`. Sprawdź: czy istnieje automatyczne ponowienie (retry) tego
kroku, czy plan zostaje trwale w stanie błędu do ręcznej interwencji (`redriveAgentTask` w
`agentTaskDispatchService.ts:164` wygląda na mechanizm ręcznego ponowienia — zweryfikuj, czy jest
automatyczny, czy wymaga operatora), i czy istnieje cofanie efektów ubocznych kroku, który zdążył
częściowo zapisać dane przed padnięciem (np. `create_task` wykonane, a kolejny krok w tym samym
planie pada — czy pierwszy zapis zostaje, czy jest cofany).

**Brak limitu albo brak zatrzymania to znalezisko krytyczne — zgłoś je jako takie**, osobną
sekcją w raporcie, nie zakopane w opisie ciągłym.

**Ukończone, gdy:** masz odpowiedź z dowodem plik:linia na każde z (a)-(f), i jeśli któraś
odpowiedź brzmi „nie sprawdziłem/nie da się sprawdzić bez X" — to też jest odpowiedź, zapisz ją
wprost zamiast pomijać punkt.

## R4 — czego brakuje do produkcji

Lista rzeczy do zbudowania, uporządkowana według tego, co blokuje włączenie (bez tego flaga nie
powinna pójść na `true` nigdzie poza lokalną sesją), a co jest ulepszeniem (flaga mogłaby pójść,
ale to by było niedbałe). Dla każdej pozycji: czy istnieje wzorzec w repo do naśladowania (np.
inny worker BullMQ z limitem/retry, inny mechanizm anulowania) — jeśli tak, wskaż go plik:linia,
jeśli nie, napisz że nie znalazłeś.

**Nie wyceniaj w godzinach.** Wyceniaj w tym, co da się policzyć: liczba ogniw z R1 do zbudowania
lub naprawienia, liczba pytań z R3 bez odpowiedzi „bezpieczne", liczba testów day164 (jeśli
napisałeś) czerwonych na tej ścieżce.

**Ukończone, gdy:** masz listę podzieloną na „blokuje włączenie" / „ulepszenie po włączeniu",
każda pozycja z odniesieniem do konkretnego ogniwa z R1 albo pytania z R3, i wskazaniem wzorca w
repo tam gdzie istnieje.

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY164_AGENT_NIE_WYKONUJE_REPORT.md` (raport) |
| Zapis (opcjonalnie, pomiarowy) | WYŁĄCZNIE `server/src/workers/__tests__/day164.agent-dispatch-map.test.ts` |
| Odczyt | `server/src/workers/**` (w tym `aiWorkerRuntime.ts`, `aiWorker.ts`, `__tests__/`) |
| Odczyt | `server/src/jobs/agentPlanSchedulerJob.ts` |
| Odczyt | `server/src/cron/Scheduler.ts` |
| Odczyt | `server/src/services/ai/agentTaskDispatchService.ts` |
| Odczyt | `server/src/services/ai/agentPlannerService.ts`, `server/src/services/ai/toolDefinitions.ts`, `server/src/services/ai/sideEffectTools.ts` |
| Odczyt | `server/src/routes/ai/agent-plan.routes.ts` |
| Odczyt | `server/src/index.ts` (miejsce wołania `startAiTasksWorker`, ok. linii 2124-2125) |
| Odczyt | `server/src/services/meeting/meetingInvitationService.ts`, `server/src/services/emailService.ts` (R3-b) |
| Odczyt | `src/utils/agentPlanFlag.ts`, `src/services/api/agentPlan.api.ts` |
| Odczyt | `src/components/AIChat/AgentPlanPanel.tsx`, `AgentHubShell.tsx`, `AgentManifestLauncher.tsx` |
| Odczyt | `src/components/MyWork/MyWorkHub.tsx`, `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` |
| Odczyt | `server/scripts/migrationOrdering.ts`, `server/scripts/migrate.postgres.ts` (tylko do uruchomienia migracji na pustej lokalnej bazie w R2 — zero zmian w tych plikach) |
| Odczyt (dozwolony, zakaz zapisu) | `server/src/services/aiActionExecutor.ts` — patrz zakaz rozłączności niżej |

**Nietykalne imiennie:** `server/src/services/aiActionExecutor.ts` (dyżur 162, równoległy —
czytać wolno, zmieniać NIE WOLNO, nawet gdy w trakcie R1/R2 okaże się, że ścieżka agenta przez
niego przechodzi); cały `src/**` poza plikami odczytu wypisanymi wyżej (zero zapisu w froncie —
znaleziska typu R1.2/R1.3/R1.4 idą do raportu, nie do poprawki kodu); wszystkie migracje (ten
dyżur nie tworzy nowej migracji — schemat już istnieje); wszystkie pliki innych dyżurów fali
(160/161/162/163) poza jawnie wskazanym `aiActionExecutor.ts` do odczytu.

**Zasoby wyłączne:** własny lokalny Postgres i własny lokalny Redis uruchomione przez Ciebie na
portach, które sam wybierzesz i zapiszesz w raporcie (nazwij kontenery `cx-day164-pg`/
`cx-day164-redis` dla spójności z konwencją innych dyżurów fali). Żadnej bazy zdalnej, demo,
stagingu ani produkcji — zero wyjątków.

# 5. BRAMKI ODBIORU

- **B1.** R1 ma numerowaną listę ogniw ścieżki (front → endpoint → dispatch → kolejka →
  scheduler/worker → wykonanie → zapis wyniku → co widzi użytkownik), każde ze stanem (istnieje /
  nie istnieje / za flagą) i plik:linia, zweryfikowaną osobiście — nie przepisaną z tej instrukcji
  bez sprawdzenia.
- **B2.** R1 wypisuje punkty zerwania OSOBNO od listy ogniw, z jasnym wskazaniem, który jest
  pierwszy na ścieżce dispatchu (flaga) i który jest niezależny od flagi (front odrzuca pole
  `dispatch` w `AgentPlanPanel.tsx:369`).
- **B3.** R2 ma dowód z lokalnego przebiegu (log/SQL/BullMQ) na prawdziwym Postgresie i
  prawdziwym Redisie — nie na mocku, nie na opisie „powinno działać".
- **B4. Zero flagi w repo.** Diff dyżuru nie zawiera żadnej zmiany domyślnej wartości
  `ENABLE_AI_TASKS_WORKER` w żadnym pliku konfiguracyjnym ani kodzie — flaga wraca do wyłączonej
  po zakończeniu dyżuru w każdym środowisku poza Twoją lokalną sesją.
- **B5. Zero baz zdalnych.** Cały R2 i cały pomiar biegnie na kontenerach lokalnych — raport
  zawiera dowód (connection string bez adresu zdalnego, nazwa kontenera) że żadne zapytanie nie
  poszło do demo/staging/produkcji.
- **B6. Zero realnej wysyłki.** Raport dokumentuje stan `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` i
  `MEETING_INVITES_LIVE` PRZED R2 i potwierdza (dowodem, nie deklaracją), że żadna wiadomość nie
  wyszła na zewnątrz podczas pomiaru.
- **B7.** R3 ma odpowiedź z dowodem plik:linia na każdy z sześciu podpunktów (a)-(f); brak
  limitu lub brak mechanizmu zatrzymania jest wypisany jako osobne znalezisko krytyczne, nie
  wtopiony w opis.
- **B8.** R4 nie zawiera żadnej wyceny w godzinach — tylko liczby ogniw/pytań i wskazania wzorców
  w repo.
- **B9. Rozłączność.** Diff dyżuru nie dotyka `server/src/services/aiActionExecutor.ts` ani
  żadnego pliku spoza tabeli licencji w sekcji 4 (poza raportem i opcjonalnym plikiem testowym
  `day164.agent-dispatch-map.test.ts`).
- **B10.** Raport zawiera sekcję „TWIERDZENIA NIEZWERYFIKOWANE" — każda teza z tej instrukcji lub
  z własnych ustaleń, której nie udało się dowieść bezpośrednim pomiarem, wypisana wprost jako
  niezweryfikowana, a nie po cichu przemilczana.
