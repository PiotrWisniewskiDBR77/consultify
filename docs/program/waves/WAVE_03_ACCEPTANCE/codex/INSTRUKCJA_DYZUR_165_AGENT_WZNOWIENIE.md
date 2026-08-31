# INSTRUKCJA DYŻURU nr 165 — Codex — „Agent wykonuje pierwszy krok i nigdy nie wznawia - naprawa klucza idempotencji i konca klamstwa 'zakolejkowane'"

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
> **wyłącznie** `/private/tmp/cx-day165-wznowienie-agenta`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `22124537f7`**
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
Zakres: **Czat / Teresa - wykonywanie planu agenta, wznowienie po akcepcie kroku**.
Trasy front: ``src/components/AIChat/AgentPlanPanel.tsx` - linie 369 i 419, obie gubia pole `dispatch``. Trasy tył: ``server/src/routes/ai/agent-plan.routes.ts` i `server/src/services/ai/agentTaskDispatchService.ts``.

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
WT=/private/tmp/cx-day165-wznowienie-agenta
MARKER=22124537f7

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day165-wznowienie-agenta-20260830 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day165-wznowienie-agenta/config.worktree"
cat "$VAULT/worktrees/cx-day165-wznowienie-agenta/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day165-wznowienie-agenta-scratch
mkdir -p /private/tmp/cx-day165-wznowienie-agenta-artefakty

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
git -C "$VAULT" log --oneline 22124537f7..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only 22124537f7..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day165-wznowienie-agenta-20260830
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 22124537f7..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `cztery` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day165-wznowienie-agenta

# (T1) OGNIWO PIERWSZE - klucz zalezy TYLKO od planu
grep -n "dispatchKey" server/src/routes/ai/agent-plan.routes.ts
#   oczekiwane: route:${payload.planId} w liniach 184-185, bez numeru kroku.

# (T2) OGNIWO DRUGIE - REPLAY wraca PRZED kolejkowaniem
sed -n '78,92p' server/src/services/ai/agentTaskDispatchService.ts
#   oczekiwane: galaz REPLAY zwraca sie ZANIM zacznie sie blok try z aiQueue.add.
#   Potwierdz sam, ze do kolejki faktycznie nic nie trafia.

# (T3) OGNIWO TRZECIE - REPLAY udaje enqueued
sed -n '186,190p' server/src/routes/ai/agent-plan.routes.ts
#   oczekiwane: status === 'REPLAY' mapowane na 'enqueued'.

# (T4) FRONT GUBI SYGNAL W DWOCH MIEJSCACH
sed -n '369p;419p' src/components/AIChat/AgentPlanPanel.tsx
#   oczekiwane: OBIE linie robia const { plan: updated } = await ...
#   Linia 419 (handleApprove) to sciezka WZNOWIENIA - wazniejsza od 369.
```

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day165-wznowienie-agenta-20260830` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6056`. Twój JEDYNY port harnessu to `4998 i 4999`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day165-pg`**. **ZAKAZANE:** `6012, 5433, 6047 i 6054-6055 (odbiory nadzorcy), 6051/4994-4995 (163), 6052/4996-4997 (164), 6057/5000-5001 (166), 6058/5002-5003 (167). Redis: 6379 bywa zajety przez inny projekt - drugi tor uzyl 6390, sprawdz sam`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w ``ENABLE_AI_TASKS_WORKER` - **NIE ZMIENIASZ jej wartosci domyslnej w repo**; wlaczasz wylacznie w zmiennej srodowiskowej wlasnej sesji na potrzeby R1 i R4`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY165_AGENT_WZNOWIENIE_REPORT.md`. Nie zmieniasz zadnego `MODULE_ACCEPTANCE.md`. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day165-wznowienie-agenta-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day165-wznowienie-agenta-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **NIE ZMIENIASZ wartosci domyslnej `ENABLE_AI_TASKS_WORKER` w repo.** Zostaje wylaczona; wlaczasz ja wylacznie w zmiennej srodowiskowej wlasnej sesji. **NIE DOPISUJESZ jej do rejestru flag** `server/src/config/FeatureFlags.ts` - zglos to w raporcie jako pozycje do rozstrzygniecia. **NIE ZMIENIASZ `server/src/workers/**` ani `server/src/cron/Scheduler.ts`** - to terytorium dyzuru 164. **NIE ZMIENIASZ WYGLADU** `AgentPlanPanel.tsx` - wolno Ci wylacznie odczytac pole `dispatch` i pokazac prawde w jednym komunikacie stanu; zakaz zmiany ukladu, kolorow i pozostalych tekstow. **Zero polaczen do bazy zdalnej, demo, stagingu i produkcji** - worker dzialajacy na cudzych danych to najgorszy mozliwy wynik tego dyzuru. **Zero realnej wysylki poczty i zaproszen.** **Jesli worker zacznie palic budzet modelu jezykowego - ZATRZYMAJ SIE i zglos**; zasadny STOP jest tu pochwala. ★ **Jesli w chwili startu istnieje jeszcze worktree dyzuru 164, ZATRZYMAJ SIE i zapytaj** - dyzury dziela obszar | Drugi tor odblokowal agenta lokalnie za zgoda wlasciciela i zmierzyl, ze **agent naprawde wykonuje prace**: odczyt bazy 2 ms, przeliczone `roi: '35.0%'`, bramka zgody zadzialala poprawnie. Zacina sie dokladnie na wznowieniu po akcepcie: klucz idempotencji zalezy wylacznie od identyfikatora planu, wiec wznowienie trafia na pokwitowanie `SUCCEEDED`, dostaje `REPLAY` bez wstawienia do kolejki, a trasa raportuje to jako `enqueued`. **API mowi 'zakolejkowane', a w kolejce nie przybywa nic.** Plan zostaje trwale `awaiting_approval`, obie drogi wyjscia zamkniete kodem 409 |

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
cd /private/tmp/cx-day165-wznowienie-agenta

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day165-pg psql -U postgres -d cx165 \
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
cd /private/tmp/cx-day165-wznowienie-agenta

docker run -d --name cx-day165-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx165 \
  -p 127.0.0.1:6056:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day165-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6056/cx165 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6056/cx165 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day165-wznowienie-agenta && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6056/cx165 \
JWT_SECRET=cx165-test-secret-do-not-reuse \
npx vitest run server/src/services/ai/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day165-wznowienie-agenta-artefakty/day165-vitest.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day165-wznowienie-agenta && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/services/ai/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day165-wznowienie-agenta-artefakty/day165-vitest.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day165-wznowienie-agenta/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day165-pg psql -U postgres -d cx165 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day165-pg`.
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
> **(e) **Front gubi sygnal w DWOCH miejscach, nie w jednym.** Nadzorca wskazal poczatkowo tylko `AgentPlanPanel.tsx:369` (`handleRunSchema`). Przeglad przy skladaniu tej instrukcji znalazl **identyczny blad w linii 419** (`handleApprove`): `const { plan: updated } = await approveAgentPlanStep(planId, step.stepIndex);` - a to jest **dokladnie sciezka wznowienia**, czyli ta, ktora ten dyzur naprawia. Naprawa backendu bez linii 419 **nadal nie pokaze uzytkownikowi prawdy**. **Druga pulapka: `MOCK_REDIS=true` rzuca wyjatkiem PRZED logika idempotencji** (linia 62) - to nie jest ten sam objaw co defekt i nie wolno ich pomylic. Potrzebujesz **prawdziwego Redisa**. **Trzecia: pulapka bez wyjscia ma cztery sciany, sprawdz kazda.** `approveStep` zmienia status kroku, nie planu; `releaseLeaseAtCheckpoint` zapisuje `awaiting_approval` do `ai_agent_plans`; `POST /:id/run` daje 409, `POST /:id/approve-step` powtorzony daje 409; `redriveAgentTask` obsluguje wylacznie `FAILED` i `PENDING`, a dla `SUCCEEDED` rzuca `AGENT_DISPATCH_NOT_REDRIVABLE`. **Czwarta: idempotencja ma nadal chronic przed podwojnym klknieciem** - to byl powod istnienia tego klucza. Naprawa, ktora otwiera droge na dublowanie zadan, jest gorsza od defektu. Uzasadnij, dlaczego Twoj klucz spelnia oba wymagania naraz. **Piata: `DB_TYPE` przypiety do `sqlite` w `server/vitest.config.ts:17` w bloku `test.env`, ktory WYGRYWA ze zmienna z linii komend. W raporcie napisz WPROST, jakiego configu uzyles i gdzie lezy - poprzedni dyzur tego nie ujawnil i audytor nie mogl powtorzyc przebiegu. **Szosta: flaga `ENABLE_LIVE_EMAIL` NIE ISTNIEJE** - realny warunek wysylki to `emailService.ts:202` (host i user jednoczesnie, czytane najpierw z tabeli `settings`), a dla zaproszen `MEETING_INVITES_LIVE`**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day165-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day165-wznowienie-agenta-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`pozycje R2 i R3 - klucz idempotencji rozroznia uruchomienie od wznowienia, a odpowiedz API przestaje raportowac powtorzenie jako zakolejkowanie`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6056` albo `4998 i 4999` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6056` albo `4998 i 4999`** (`Z7`).

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

Drugi tor już przeszedł całą ścieżkę na żywym Postgresie i Redisie i wrócił z dobrą wiadomością
oraz jednym precyzyjnym defektem — nie zaczynasz od zgadywania, zaczynasz od naprawy zmierzonego
mechanizmu. Zapis pomiaru: `docs/program/KOORDYNACJA.md`, sekcja „AGENT DZIAŁA — i ma jeden
precyzyjny defekt, który go zatrzymuje”.

Dobra wiadomość: agent naprawdę pracuje. `get_initiative_status` → `completed` (2 ms, realny
odczyt z bazy), `calculate_financial` → `completed` (realnie przeliczone `roi: "35.0%"`),
`create_task` → `awaiting_approval` (bramka zgody dla narzędzia efektu ubocznego zadziałała —
`server/src/services/ai/agentPlannerService.ts:511` sprawdza `step.requiresApproval &&
!step.approvedAt`, czyli `create_task` jest w `SIDE_EFFECT_TOOLS`, `server/src/services/ai/
sideEffectTools.ts`, importowanym przez `agentPlannerService.ts:15`). `ai_agent_job_receipts`:
jeden wiersz `SUCCEEDED`.

Defekt, potwierdzony w tym dyżurze grepem na `/private/tmp/m03` (gałąź `codex/
m03-admin-20260824`, marker `22124537f7`), trzy ogniwa:

**Ogniwo 1 — klucz idempotencji nie rozróżnia uruchomienia od wznowienia.**
`server/src/routes/ai/agent-plan.routes.ts:184-185`:
```
dispatchKey: `route:${payload.planId}`,
enqueue: () => dispatchAgentTask({ ...payload, dispatchKey: `route:${payload.planId}` }),
```
Klucz zależy wyłącznie od `planId`. Jest identyczny przy pierwszym `POST /:id/run` i przy
wznowieniu po `POST /:id/approve-step` — dla mechanizmu idempotencji to ten sam wpis.

**Ogniwo 2 — `REPLAY` nie wstawia zadania do kolejki.**
`server/src/services/ai/agentTaskDispatchService.ts:82-84`:
```
if (receipt.status === 'ENQUEUED' || receipt.status === 'RUNNING' || receipt.status === 'SUCCEEDED') {
  return { status: 'REPLAY', receiptId: receipt.receipt_id, bullJobId: receipt.bull_job_id };
}
```
Ten `return` poprzedza cały blok `try` (linie 85-120), w którym dopiero następuje
`aiQueue.add(...)`. Skoro po pierwszym udanym przebiegu wiersz w `ai_agent_job_receipts` ma
`status='SUCCEEDED'`, każde kolejne wywołanie z tym samym `dispatchKey` (czyli — przez ogniwo 1
— każde wznowienie tego samego planu) trafia w ten warunek i wychodzi natychmiast, bez żadnego
zapisu do Redisa/BullMQ.

**Ogniwo 3 — `REPLAY` jest raportowany jako `enqueued`.**
`server/src/routes/ai/agent-plan.routes.ts:188`:
```
return status === 'ENQUEUED' || status === 'REPLAY' || governed.replayed ? 'enqueued' : 'unavailable';
```
API nie ma trzeciej wartości między „zakolejkowano” a „nic się nie stało” — `REPLAY` (nic nie
dołożone do kolejki) i `ENQUEUED` (naprawdę wstawione) obie wychodzą na zewnątrz jako
`'enqueued'`. To jest kształt „200 znaczy nic”: odpowiedź HTTP mówi „zakolejkowane”, receipt nie
zmienia statusu, worker nigdy nie zostaje obudzony.

Sprawdzony w tym dyżurze skutek po stronie frontu — **gorszy niż zgłoszony w zleceniu**: nie tylko
`AgentPlanPanel.tsx:369` (`handleRunSchema`, `const { plan: updated } = await
runAgentPlan(planId, steps, idempotencyKey);`) gubi pole `dispatch`. **`AgentPlanPanel.tsx:419`
w `handleApprove` — czyli dokładnie na ścieżce wznowienia po akcepcie kroku — robi to samo:**
`const { plan: updated } = await approveAgentPlanStep(planId, step.stepIndex);` i `dispatch` z
odpowiedzi API (`src/services/api/agentPlan.api.ts:233-236`, typ zwrotny zawiera pole
`dispatch: 'enqueued' | 'unavailable'`) ląduje w koszu. Użytkownik klika „Zatwierdź”, panel
odświeża `plan` z odpowiedzi i nie pokazuje żadnego sygnału, że nic nie zostało zakolejkowane —
nawet gdyby R3 naprawił API, front i tak by tej prawdy nie pokazał bez zmiany w tym pliku.

Zamknięcie pułapki, zmierzone w kodzie: `agentPlannerService.approveStep`
(`server/src/services/ai/agentPlannerService.ts:680-694`) zmienia status KROKU z powrotem na
`'pending'`, ale **nie dotyka statusu PLANU** — ten został zapisany jako `'awaiting_approval'`
przez `releaseLeaseAtCheckpoint` (`agentPlannerService.ts:1161-1178`) w momencie pierwszego
zatrzymania na bramce i tak zostaje w `ai_agent_plans.status`, dopóki nikt nie uruchomi `executePlan`
od nowa. A `executePlan` uruchamia wyłącznie worker po zdjęciu zadania z kolejki BullMQ — którego
przez ogniwo 2 nigdy nie przybywa. Obie drogi powrotu przez API są zamknięte: `POST /:id/run` →
`409` z treścią `` `Plan not runnable in status '${existingPlan.status}' (only 'planning')` ``
(`agent-plan.routes.ts:422`, przy statusie `awaiting_approval` to dosłownie ten komunikat),
`POST /:id/approve-step` ponownie → `409 'Step not awaiting approval'` (`agent-plan.routes.ts:810`,
bo krok jest już `'pending'`, nie `'awaiting_approval'` — `agentPlannerService.ts:680-684` filtruje
po tym warunku). Operatorski `redriveAgentTask`
(`server/src/services/ai/agentTaskDispatchService.ts:164-213`) obsługuje tylko `receipt.status
=== 'FAILED'` (linia 183) i powtórkę `'PENDING'` już oznaczonego jako `REDRIVEN` (linia 197) —
dla `'SUCCEEDED'` żadna z gałęzi nie pasuje i funkcja spada na `throw new Error
('AGENT_DISPATCH_NOT_REDRIVABLE')` (linia 207). Krok zostaje trwale `pending`, plan trwale
`awaiting_approval`, i nawet panel operatorski nie ma dźwigni, żeby to odblokować.

## Czym ten dyżur NIE jest

Nie jest przeprojektowaniem mechanizmu dispatchu ani migracją schematu `ai_agent_job_receipts` —
tabela i jej stany (`PENDING/ENQUEUED/RUNNING/SUCCEEDED/FAILED`) zostają, zmieniasz WYŁĄCZNIE co
wchodzi do `dispatchKey` i co robi gałąź `REPLAY`. Nie jest naprawą workera
(`server/src/workers/**`) ani schedulera cron (`server/src/cron/Scheduler.ts`) — te pliki są
zakazane imiennie (patrz zakazy) i zostają nietknięte; jeśli po Twojej naprawie krok nadal się
nie wykonuje, przyczyna jest w routingu/dispatchu, nie w workerze. Nie jest przeróbką wyglądu ani
układu `AgentPlanPanel.tsx` — jedyna dozwolona zmiana w tym pliku to odczyt pola `dispatch` z
`runAgentPlan`/`approveAgentPlanStep` i pokazanie go użytkownikowi jako jeden komunikat stanu
(np. przy `dispatch !== 'enqueued'` po evencie, który miał coś zakolejkować). Nie jest dyżurem
163 (`TaskDetailView.tsx`, `task.validators.ts`, `tasks.routes.ts`, `TaskController.ts`, migracja
`20260830_day163_task_sections.sql`) — biegnie równolegle, inny obszar, nie ruszasz go. Nie jest
włączeniem `ENABLE_AI_TASKS_WORKER` w repo na stałe — flaga zostaje wyłączona domyślnie, włączasz
ją wyłącznie w swojej sesji lokalnej.

# 2. TEZY ZLECENIA

- **T1.** Klucz idempotencji obecnie chroni przed dwoma różnymi zdarzeniami na raz — podwójnym
  kliknięciem TEGO SAMEGO uruchomienia i wznowieniem PO akcepcie kroku — i te dwa zdarzenia
  wymagają przeciwnych zachowań (pierwsze: zablokować duplikat; drugie: przepuścić nowy dispatch).
  Jeden płaski klucz `route:${planId}` nie potrafi rozróżnić tych przypadków — musi rosnąć wraz z
  postępem planu (numer kroku, licznik akceptów, albo coś równoważnego), żeby uruchomienie A wciąż
  było chronione przed duplikatem, a wznowienie B dostało nowy klucz.
- **T2.** `REPLAY` i `ENQUEUED` to semantycznie różne zdarzenia dla klienta API — jedno mówi
  „nic nowego się nie dzieje”, drugie „coś ruszyło”. Spłaszczenie ich do jednego `'enqueued'`
  ukryło defekt przed każdym, kto czytał tylko odpowiedź HTTP, nie stan bazy. Naprawa API bez
  naprawy frontu jest połowiczna — `AgentPlanPanel.tsx` musi pole `dispatch` faktycznie
  odczytywać i pokazywać, inaczej użytkownik nadal nie widzi prawdy mimo poprawnego backendu.
- **T3.** „Testy przeszły” nie jest dowodem naprawy dla tego dyżuru — dowodem jest wznowiony
  krok, który FAKTYCZNIE się wykonał na realnym Postgresie i realnym Redisie (nie
  `MOCK_REDIS=true`, bo to inny kod wykonania — rzuca wyjątkiem, zanim dojdzie do logiki
  idempotencji, i test na mocku nie odtworzy tego defektu ani nie udowodni naprawy).
- **T4.** Naprawa musi umieć się cofnąć — dyżur pokazuje test, który pada na starym kluczu
  (`route:${planId}`) i przechodzi na nowym, żeby przyszły refaktor nie wrócił po cichu do
  płaskiego klucza (to samo ryzyko odrastania, które już raz kosztowało tygodnie w innym module).

# 3. POZYCJE DYŻURU

## R0 — ★★ PRZYCZYNA ŹRÓDŁOWA: pokwitowanie dostaje `SUCCEEDED` przy zerze pracy

**Ta pozycja została dopisana po odbiorze dyżuru 164 i jest WAŻNIEJSZA od R2.**
Bez niej naprawa klucza idempotencji leczy skutek, nie przyczynę.

Bramka zgody w `server/src/services/ai/agentPlannerService.ts` **wraca NORMALNIE,
nie wyjątkiem**:

```ts
step.status = 'awaiting_approval';
plan.status = 'awaiting_approval';
plan.currentStepIndex = i;
return plan;
```

A `server/src/workers/aiWorker.ts:111` po każdym normalnym powrocie robi
**bezwarunkowo**:

```ts
result = await agentPlannerService.executeBackgroundPlan(payload);
await finishAgentTask(receiptId, workerId, true);   // ZAWSZE 'true'
```

**Skutek: pokwitowanie dostaje `SUCCEEDED`, mimo że nie wykonano ani jednego kroku.**
Dopiero to sprawia, że klucz idempotencji z R2 trafia w „udany” przebieg, dostaje
`REPLAY` i nic nie kolejkuje.

### Co masz zrobić

Zamknięcie zadania musi być **warunkowe** — zależne od tego, czy plan faktycznie
dobiegł stanu końcowego, czy zatrzymał się na bramce zgody. Wyznacz warunek
z `result.status` zwróconego przez `executeBackgroundPlan`.

**Wymagania, które musisz zachować jednocześnie:**
- plan zatrzymany na bramce zgody **nie może** dostać pokwitowania `SUCCEEDED`;
- plan faktycznie ukończony **musi** je dostać, bez zmiany dotychczasowego zachowania;
- porażka nadal ma iść ścieżką `catch` z `finishAgentTask(..., false, error)`;
- ponowienia (`maxAttempts=3`, `aiQueue` `attempts:3`) **nie mogą** zacząć się
  zapętlać na planie czekającym na zgodę — to byłaby regresja gorsza od defektu.

**Odbiór tej pozycji:** dowód mutacyjny odtworzony przy odbiorze 164 pokazał, że
warunkowe zamknięcie zmienia pokwitowanie z fałszywego `SUCCEEDED` na uczciwe.
Twój test ma to utrwalić — po naprawie plan na bramce zgody **nie** ma pokwitowania
`SUCCEEDED`, a po zatwierdzeniu i wznowieniu krok faktycznie się wykonuje.

### Czego ta pozycja NIE obejmuje

**Nie naprawiasz zatrzymywania planu w locie ani limitu kosztu.** `cancelPlan`
(okolice `agentPlannerService.ts:827-834`) robi wyłącznie `UPDATE` statusów i nie
dotyka zadania w kolejce; `estimatedCostUsd` jest stale `0`. **To są dwa osobne
blokery, zapisane do rozstrzygnięcia właściciela — nie ruszasz ich w tym dyżurze.**

---

## R1 — odtworzenie defektu przed naprawą

Postaw lokalny Postgres i **prawdziwy Redis** (własny port — sprawdź, czy 6379 wolny, drugi tor
użył 6390, bo był zajęty). `MOCK_REDIS=true` NIE odtwarza tego defektu — przy tej fladze
`dispatchAgentTask` rzuca `AI_TASKS_WORKER_REQUIRES_REAL_REDIS` (`agentTaskDispatchService.ts:62`)
zanim dojdzie do logiki `dispatchKey`/`REPLAY`; jeśli Twój test korzysta z mocka, testujesz inny
kod, nie ten defekt. Włącz `ENABLE_AI_TASKS_WORKER=true` wyłącznie w swojej lokalnej sesji (patrz
zakazy — nie w repo).

Przejdź pełną ścieżkę i zapisz DOSŁOWNIE po każdym kroku: kod HTTP, treść odpowiedzi JSON (w tym
pole `dispatch`), oraz stan trzech tabel (`ai_agent_plans.status` + `current_step_index`,
`ai_agent_plan_steps.status` dla kroku bramkowanego, `ai_agent_job_receipts.status` +
`dispatch_key` + `bull_job_id`):

1. `POST /api/ai/agent-plan` z krokiem, który ma `requiresApproval` (np. `create_task` —
   `SIDE_EFFECT_TOOLS`) — plan tworzy się, ewentualnie dispatch od razu (zależnie od
   `draft`/`processId`, patrz `agent-plan.routes.ts:305-318`).
2. `POST /:id/run` (jeśli plan zaczął w `planning`) — obserwuj `dispatch` w odpowiedzi i pierwszy
   wiersz w `ai_agent_job_receipts` (`dispatch_key = route:<planId>`, `status` przechodzi
   `PENDING → ENQUEUED`).
3. Poczekaj aż worker dotrze do kroku bramkowanego i zatrzyma plan — zweryfikuj
   `ai_agent_plans.status = 'awaiting_approval'` i `ai_agent_plan_steps.status =
   'awaiting_approval'` dla tego kroku (`releaseLeaseAtCheckpoint`,
   `agentPlannerService.ts:1161`).
4. `POST /:id/approve-step` — zapisz kod HTTP i `dispatch` z odpowiedzi. Zweryfikuj w bazie: krok
   wraca do `'pending'` (`agentPlannerService.ts:684-691`), ale `ai_agent_plans.status` ZOSTAJE
   `'awaiting_approval'` (nic w `approveStep` go nie zmienia), a `ai_agent_job_receipts` dla tego
   samego `dispatch_key` ma `status='SUCCEEDED'` z kroku 2/3, więc dispatch z kroku 4 wpada w
   gałąź `REPLAY` i receipt się NIE zmienia.
5. Spróbuj wznowić ponownie przez obie drogi API: `POST /:id/run` (oczekuj `409`, treść
   dosłownie z `agent-plan.routes.ts:422`) i drugi `POST /:id/approve-step` na tym samym kroku
   (oczekuj `409 'Step not awaiting approval'`, `agent-plan.routes.ts:810`, bo krok już nie jest
   `awaiting_approval`).
6. Sprawdź `redriveAgentTask` na tym receipcie — oczekuj `AGENT_DISPATCH_NOT_REDRIVABLE`, bo
   status to `SUCCEEDED`, nie `FAILED`/`PENDING` oznaczony (`agentTaskDispatchService.ts:181-207`).

**Ukończone, gdy:** masz zapisany, dosłowny log kroków 1-6 (kody, JSON, trzy tabele) na realnym
Postgresie+Redisie z `ENABLE_AI_TASKS_WORKER=true` — to jest dowód reprodukcji, na którym
opierasz R2-R4. Bez tego naprawa jest zgadywaniem.

## R2 — naprawa klucza idempotencji

Zmień `dispatchKey` w `agent-plan.routes.ts:184-185` (obie linie — literał budowany dwa razy
osobno, nie przez wspólną zmienną, więc obie muszą się zmienić spójnie) tak, żeby rozróżniał
uruchomienie od wznowienia. Rozważ i uzasadnij w raporcie wybór między:

- `` `route:${planId}:${currentStepIndex}` `` — rośnie z każdym krokiem, więc wznowienie po
  akcepcie kroku N ma inny klucz niż zatrzymanie na kroku N (bo `currentStepIndex` zmienia się,
  gdy plan rusza dalej). Pytanie do rozstrzygnięcia: czy `currentStepIndex` jest dostępny w
  payloadzie `tryDispatchBackgroundExecution` w momencie budowania klucza, czy trzeba go dociągnąć
  z `agentPlannerService.getPlan`.
- `` `route:${planId}:${approvalCount}` `` — wymaga policzenia zatwierdzeń (nowa kolumna albo
  `COUNT(*)` po `approved_at IS NOT NULL` w `ai_agent_plan_steps`), rośnie wyłącznie na akcie
  zgody, nie na każdym kroku bez bramki — węższy zakres zmiany klucza niż pierwsza opcja.
- inny klucz, jeśli znajdziesz lepszy — np. połączenie `planId` z `updated_at` planu w formie
  zaokrąglonej, ale uzasadnij dlaczego to nie wprowadza nowej klasy duplikatów.

**Wymaganie, które musi przejść test w R4:** ten sam klucz nadal chroni przed podwójnym
kliknięciem TEGO SAMEGO stanu (dwa równoległe `POST /:id/run` na planie w `planning` z tym samym
`currentStepIndex` → drugi trafia `REPLAY`, nie tworzy drugiego joba), a wznowienie po
`POST /:id/approve-step` (które zmienia `currentStepIndex` albo licznik akceptów) dostaje NOWY
klucz i faktycznie enqueue'uje. Napisz w raporcie, którą właściwość klucza to gwarantuje i czemu.

**Ukończone, gdy:** `dispatchKey` w obu miejscach `agent-plan.routes.ts:184-185` zależy od
czegoś, co zmienia się między uruchomieniem a wznowieniem, i masz w R1-owym dowodzie
reprodukcji pokazane, że z NOWYM kluczem krok 4 (approve-step) generuje inny `dispatch_key` niż
krok 2 (run).

## R3 — `REPLAY` przestaje udawać `enqueued`

Backend: `agent-plan.routes.ts:188` musi zwracać coś innego niż `'enqueued'` dla realnego
`REPLAY` (np. trzecia wartość w unii, `'replayed'` albo `'noop'` — nazwij i uzasadnij), tak żeby
wywołujący kod (i test) mógł odróżnić „naprawdę zakolejkowano” od „to duplikat, receipt bez
zmian”. Zaktualizuj typ zwrotny `tryDispatchBackgroundExecution` (obecnie `Promise<'enqueued' |
'unavailable'>`, `agent-plan.routes.ts:174-177`) i sprawdź WSZYSTKIE trzy miejsca wywołania
(`agent-plan.routes.ts:319`, `:448`, `:814` — jedno z nich to `POST /`, dwa pozostałe warto
zweryfikować przy odczycie, bo tabela licencji poniżej daje Ci prawo zapisu tylko do
`agent-plan.routes.ts` jako całości, nie do wybranych linii).

Front: sprawdzone w tym dyżurze — **nie tylko** `AgentPlanPanel.tsx:369` (`runAgentPlan` w
`handleRunSchema`) gubi `dispatch`, ale też `AgentPlanPanel.tsx:419` (`approveAgentPlanStep` w
`handleApprove`) — a to jest dokładnie ścieżka wznowienia, czyli ta, którą ten dyżur naprawia.
Obie muszą zacząć czytać `dispatch` z odpowiedzi i pokazać użytkownikowi jeden zwięzły komunikat
stanu, gdy wartość NIE jest „naprawdę zakolejkowano” (np. przy Twojej nowej wartości zastępującej
fałszywy `REPLAY→enqueued`). Zakaz zmiany czegokolwiek innego w tym pliku — układu, kolorów,
pozostałych tekstów.

**Ukończone, gdy:** odpowiedź `POST /:id/approve-step` na REALNYM wznowieniu (nowy klucz z R2,
receipt bez wcześniejszego `SUCCEEDED` na tym kluczu) zwraca `dispatch` != wartość używana
wcześniej do maskowania REPLAY, front w `handleApprove` tę wartość czyta, a przypadek prawdziwego
duplikatu (dwa kliknięcia „Zatwierdź” z rzędu, zanim pierwsze zdążyło się przetworzyć) nadal
zwraca sygnał „nic nowego”, nie fałszywe `enqueued`.

## R4 — dowód mutacyjny i test

Test na realnym Postgresie + realnym Redisie (kontener/instancja lokalna, port własny — nie
Twój codzienny dev-Redis, żeby nie zderzyć się z innym procesem), plik przybity:
`server/src/services/ai/__tests__/day165.agent-plan-resume.pg.redis.test.ts`. Ścieżka: utwórz
plan z krokiem bramkowanym → `POST`-uj `/run` (albo wywołaj `tryDispatchBackgroundExecution`
bezpośrednio, jeśli test wygodniej wpina się na poziomie serwisu niż przez HTTP) → poczekaj na
`awaiting_approval` → zatwierdź krok → **zweryfikuj, że nowy wiersz w
`ai_agent_job_receipts` faktycznie powstał z `status IN ('PENDING','ENQUEUED')` i innym
`dispatch_key` niż receipt z kroku „run”** → poczekaj, aż worker (jeśli w Twojej sesji lokalnie
uruchomiony — patrz zakazy, nie w repo) faktycznie wykona krok, albo — jeśli nie uruchamiasz
workera w tym teście — zweryfikuj wprost przez `dispatchAgentTask`, że wywołanie z nowym kluczem
zwraca `status: 'ENQUEUED'`, nie `'REPLAY'`.

Dowód regresji: zepsuj celowo klucz z powrotem na `` `route:${planId}` `` (tymczasowa zmiana w
roboczej kopii, nie commitowana), uruchom test, pokaż że pada dokładnie na asercji „nowy
dispatch_key różny od poprzedniego” albo „status ENQUEUED, nie REPLAY”. Przywróć naprawę, pokaż
zielony test i czyste `git diff` bez śladu tymczasowego zepsucia.

**Ukończone, gdy:** test `day165.*` przechodzi na realnym Postgresie+Redisie z jawnie podanym
configiem (napisz w raporcie którym — patrz pułapka `DB_TYPE` w zakazach), pada przy przywróconym
starym kluczu, i drzewo robocze po dyżurze jest czyste (`git status` bez nieplanowanych zmian
poza plikami z tabeli licencji).

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis | `server/src/routes/ai/agent-plan.routes.ts` (linie 184-188 + typ `tryDispatchBackgroundExecution` + trzy call site'y `:319`, `:448`, `:814`) |
| Zapis | `server/src/services/ai/agentTaskDispatchService.ts` (gałąź `REPLAY`, linie 82-84) |
| Zapis | `src/components/AIChat/AgentPlanPanel.tsx` — **wyłącznie odczyt pola `dispatch` w `handleRunSchema` (linia 369) i `handleApprove` (linia 419) + jeden komunikat stanu; ZAKAZ zmiany wyglądu, układu, kolorów i pozostałych tekstów** |
| Zapis | `server/src/workers/aiWorker.ts` — **WYŁĄCZNIE warunkowe zamknięcie zadania w linii 111 (pozycja R0); ZAKAZ jakiejkolwiek innej zmiany w tym pliku i w całym katalogu `server/src/workers/`** |
| Zapis | test `server/src/services/ai/__tests__/day165.agent-plan-resume.pg.redis.test.ts` |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY165_AGENT_WZNOWIENIE_REPORT.md` |
| Odczyt | `server/src/services/ai/agentPlannerService.ts` (`approveStep`, `executePlan`, `releaseLeaseAtCheckpoint`) — **nie zmieniasz** |
| Odczyt | `server/src/services/ai/sideEffectTools.ts` |
| Odczyt | `src/services/api/agentPlan.api.ts` (typy zwrotne `runAgentPlan`/`approveAgentPlanStep`) |
| Odczyt | `docs/program/KOORDYNACJA.md` — sekcja „AGENT DZIAŁA — i ma jeden precyzyjny defekt, który go zatrzymuje” |

**Nietykalne imiennie:** `server/src/workers/**` **z jednym wyjątkiem wymienionym w tabeli powyżej** (`aiWorker.ts`, wyłącznie linia zamknięcia zadania); `server/src/cron/Scheduler.ts`; pliki dyżuru
163 (`src/components/.../TaskDetailView.tsx`, `server/src/.../task.validators.ts`,
`server/src/routes/.../tasks.routes.ts`, `server/src/.../TaskController.ts`, migracja
`20260830_day163_task_sections.sql`); wszystko pod `server/src/services/organizationContext/`;
`server/src/config/FeatureFlags.ts` (patrz zakazy — nie dopisujesz tu `ENABLE_AI_TASKS_WORKER`).

★ **ROZŁĄCZNOŚĆ z dyżurem 164:** 164 jest pomiarowy nad `server/src/workers/**` (do odczytu w
164, nie do zmiany). 165 wchodzi dopiero PO zamknięciu 164. Jeśli w chwili startu Twojego
worktree`a worktree dyżuru 164 jeszcze istnieje (branch/katalog nieusunięty, PR otwarty) —
**ZATRZYMAJ SIĘ i zapytaj**, zanim dotkniesz czegokolwiek w `server/src/services/ai/`.

**Zasoby wyłączne:** własny port Postgresa i własny port Redisa (sprawdź zajętość przed startem —
drugi tor uciekł na 6390, bo 6379 był zajęty przez inny projekt). Żadnego portu współdzielonego z
równolegle biegnącym 163/164, żadnej bazy zdalnej/demo/staging/produkcyjnej.

# 5. BRAMKI ODBIORU

- **B1. Reprodukcja przed naprawą.** R1 ma dosłowny log (kody HTTP, JSON, trzy tabele) z
  realnego Postgresa + realnego Redisa, `ENABLE_AI_TASKS_WORKER=true` w sesji lokalnej — nie na
  `MOCK_REDIS=true` (to inny kod, rzuca wyjątkiem wcześniej, patrz `agentTaskDispatchService.ts:62`).
- **B2. Klucz rozróżnia uruchomienie od wznowienia.** `dispatchKey` w OBU miejscach
  `agent-plan.routes.ts:184-185` zależy od czegoś, co zmienia się między `POST /:id/run` a
  `POST /:id/approve-step` na tym samym planie — dowód: dwa różne `dispatch_key` w
  `ai_agent_job_receipts` dla tych dwóch wywołań na tym samym `planId`.
- **B3. Idempotencja duplikatu nie zniknęła.** Dwa równoległe `POST /:id/run` (albo dwa
  `approve-step` na tym samym kroku z rzędu) na TYM SAMYM stanie planu nadal tworzą tylko jeden
  wiersz `ENQUEUED`/jeden job BullMQ — drugi trafia w gałąź nie-enqueue.
- **B4. `REPLAY` przestaje być `enqueued`.** Odpowiedź API dla realnego duplikatu (ten sam klucz,
  receipt już `ENQUEUED/RUNNING/SUCCEEDED`) zwraca wartość jednoznacznie różną od tej używanej dla
  prawdziwego nowego enqueue — sprawdzone w `agent-plan.routes.ts:188` i we wszystkich trzech call
  site'ach `tryDispatchBackgroundExecution`.
- **B5. Front pokazuje prawdę na obu ścieżkach.** `AgentPlanPanel.tsx:369` (`handleRunSchema`) I
  `AgentPlanPanel.tsx:419` (`handleApprove`) czytają pole `dispatch` z odpowiedzi i pokazują jeden
  komunikat stanu, gdy nic nie zostało faktycznie zakolejkowane — bez żadnej innej zmiany wyglądu.
- **B6. Wznowienie faktycznie odblokowuje krok.** Dowód mutacyjny: po naprawie, `POST
  /:id/approve-step` na kroku bramkowanym prowadzi do NOWEGO wiersza `ai_agent_job_receipts` w
  stanie `PENDING`/`ENQUEUED` (nie tylko do zmiany statusu kroku na `pending` w bazie) — krok
  przestaje być trwale zawieszony.
- **B7. Test pada na starym kluczu, przechodzi na nowym.** `day165.agent-plan-resume.pg.redis.test.ts`
  demonstruje regresję (zepsuty klucz → test czerwony) i naprawę (przywrócony klucz → test
  zielony), na realnym Postgresie i Redisie, z jawnie podanym w raporcie configem
  uruchomienia (patrz pułapka `DB_TYPE` w zakazach).
- **B8. Zero dotknięcia workera/schedulera.** Diff dyżuru nie zawiera żadnej linii w
  `server/src/workers/**` ani `server/src/cron/Scheduler.ts`.
- **B9. Zero flagi w repo.** `ENABLE_AI_TASKS_WORKER` nie zmienia wartości domyślnej w żadnym
  pliku repo — włączona wyłącznie jako zmienna środowiskowa Twojej lokalnej sesji.
- **B10. Zero realnej wysyłki.** Przed uruchomieniem czegokolwiek sprawdzone i zapisane w
  raporcie: `MEETING_INVITES_LIVE`, `SMTP_HOST`, `SMTP_USER`, wiersze `smtp_%` w tabeli
  `settings` — warunek realnej wysyłki to `emailService.ts:202`
  (`if (smtpConfig.host && smtpConfig.auth?.user)`), nie żadna flaga `ENABLE_LIVE_EMAIL` (nie
  istnieje).
- **B11. Raport ma sekcję „TWIERDZENIA NIEZWERYFIKOWANE”** i wprost nazywa użyty config testowy
  (ścieżka pliku, zmienne środowiskowe) — bez tego nikt nie odtworzy przebiegu, tak jak nie dało
  się tego zrobić po poprzednim dyżurze.
- **B12. Rejestr flag zgłoszony, nie poprawiony.** Raport zawiera pozycję do rozstrzygnięcia: `ENABLE_AI_TASKS_WORKER`
  nie występuje w `server/src/config/FeatureFlags.ts` mimo że steruje realnym zachowaniem w
  `agentTaskDispatchService.ts`, `server/src/workers/aiWorkerRuntime.ts`,
  `server/src/jobs/agentPlanSchedulerJob.ts` i `server/src/cron/Scheduler.ts` — bez dopisywania
  jej do rejestru w tym dyżurze.
