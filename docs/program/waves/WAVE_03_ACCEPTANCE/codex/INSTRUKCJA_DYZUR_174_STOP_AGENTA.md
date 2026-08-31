# INSTRUKCJA DYŻURU nr 174 — Codex — „Zatrzymanie uruchomionego planu agenta, realny koszt zamiast zera i brakujacy pisarz polityk zasobow"

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
> **wyłącznie** `/private/tmp/cx-day174-stop-agenta`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `d3d36cd5f5`**
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
Zakres: **Agent planow AI — zatrzymywanie planu w locie, limit kosztu, polityka zasobow. Ostatnia pozycja przed decyzja wlasciciela o wlaczeniu ENABLE_AI_TASKS_WORKER**.
Trasy front: `brak zmian po stronie frontu. Odczyt kontekstowy (nie zmieniasz): `src/services/api/agentPlan.api.ts:249` (wolacz POST /cancel), `src/components/AIChat/AgentHubShell.tsx``. Trasy tył: ``POST /api/ai/agent-plan/:id/cancel` (`server/src/routes/ai/agent-plan.routes.ts:836-857`) -> `agentPlannerService.cancelPlan` (`:827-835`) -> `executePlan` (`:481-679`) / `finalizePlan` (`:1103-1124`) / `updatePlanStatus` (`:1074-1100`); `executeBackgroundPlan` (`:1018-1071`) -> `executeWithAgentResourceReservation` (`server/src/services/v8/agentResourceGovernanceService.ts:347`) -> `reserveAgentResource` (`:116-295`, odczyt `v8_agent_resource_policies` w `:196-203`); worker `server/src/workers/aiWorker.ts:94-118` -> `claimAgentTask`/`finishAgentTask`/`redriveAgentTask` (`server/src/services/ai/agentTaskDispatchService.ts:123-214`); cron `server/src/jobs/agentPlanSchedulerJob.ts:26-62,118-140`; migracja `server/migrations/20260808_v8_agent_resource_governance.sql``.

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
WT=/private/tmp/cx-day174-stop-agenta
MARKER=d3d36cd5f5

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day174-stop-agenta-20260830 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day174-stop-agenta/config.worktree"
cat "$VAULT/worktrees/cx-day174-stop-agenta/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day174-stop-agenta-scratch
mkdir -p /private/tmp/cx-day174-stop-agenta-artefakty

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
git -C "$VAULT" log --oneline d3d36cd5f5..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only d3d36cd5f5..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day174-stop-agenta-20260830
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only d3d36cd5f5..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `piec` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day174-stop-agenta

# (T1) ANULOWANIE NIE DOTYKA ANI KOLEJKI, ANI POKWITOWANIA, ANI LEASU
sed -n '827,835p' server/src/services/ai/agentPlannerService.ts
#   oczekiwane: TRZY operacje — updatePlanStatus(planId,'cancelled'), UPDATE krokow
#   pending/awaiting_approval -> 'skipped', projectCanonicalPlanTransition. ZERO odwolan
#   do kolejki BullMQ, do pokwitowania (`ai_agent_job_receipts`) i do kolumn leasu.

# (T2) ANULOWANIE BYWA PO CICHU NADPISANE PRZEZ WLASNE ZAKONCZENIE PLANU
sed -n '1074,1082p' server/src/services/ai/agentPlannerService.ts
sed -n '333,336p' server/src/services/ai/agentPlannerService.ts
sed -n '1103,1120p' server/src/services/ai/agentPlannerService.ts
#   oczekiwane: `updatePlanStatus` NIE czysci `execution_owner_token` / `execution_fencing_token`
#   / `execution_lease_expires_at`; `leasePredicate` sprawdza WYLACZNIE te trzy kolumny i NIE
#   sprawdza `status`; `finalizePlan` pisze `status = ?` przez `guardedPlanRun` z tym predykatem.
#   ★ Wniosek do potwierdzenia wlasnym testem: plan anulowany w trakcie konczy sie jako
#   'completed', a anulowanie znika bez sladu.

# (T3) WARUNEK ZAMKNIECIA POKWITOWANIA I SKUTEK ZATRZASNIECIA W 'RUNNING'
sed -n '104,118p' server/src/workers/aiWorker.ts
sed -n '82,84p' server/src/services/ai/agentTaskDispatchService.ts
sed -n '181,208p' server/src/services/ai/agentTaskDispatchService.ts
#   oczekiwane: aiWorker zamyka pokwitowanie TYLKO dla 'completed' i 'completed_with_errors'
#   (linia 111-112); `dispatchAgentTask` dla pokwitowania w 'RUNNING' zwraca REPLAY i do kolejki
#   NIE trafia nic (linia 82-84); `redriveAgentTask` przyjmuje WYLACZNIE 'FAILED' (oraz idempotentne
#   'PENDING') — dla 'RUNNING' rzuca AGENT_DISPATCH_NOT_REDRIVABLE (linia 207).
#   ★ To znaczy: pokwitowanie zatrzasniete w RUNNING blokuje ten dispatchKey NA STALE i nie ma
#   sciezki ratunkowej operatora. Sprawdz to sam, zanim zaczniesz projektowac naprawe.

# (T4) KOSZT ZERO W DWOCH MIEJSCACH — LIMIT NIE MA JAK STRZELIC
grep -n "estimatedCostUsd: 0," server/src/services/ai/agentPlannerService.ts
sed -n '228,239p' server/src/services/v8/agentResourceGovernanceService.ts
sed -n '166,172p' server/src/services/v8/agentResourceGovernanceService.ts
#   oczekiwane: linie 157 (executeGovernedEnqueue) i 1058 (executeBackgroundPlan);
#   porownanie `Number(usage.reserved_cost) + estimatedCostUsd > max_estimated_cost_usd_per_run`
#   przy sumowaniu samych zer nie przekroczy zadnego dodatniego limitu.
#   ★ ORAZ: `resource_idempotency_cost_mismatch` — ten sam `idempotencyKey` z INNYM kosztem
#   RZUCA. Twoj szacunek MUSI byc deterministyczny per krok.

# (T5) TABELA POLITYK NIE MA PISARZA PRODUKCYJNEGO
grep -rn "v8_agent_resource_policies" --include='*.ts' --include='*.sql' server/ | grep -v '/dist/'
#   oczekiwane: 1 migracja (CREATE + FK z `v8_agent_resource_reservations`), 1 CZYTELNIK
#   (`agentResourceGovernanceService.ts:197`) i 6 skryptow dowodowych z INSERT-em
#   (`a09CrossPathResourceRealDbProof.ts`, `a09ReleasedReservationReclaimRealDbProof.ts`,
#   `a09WorkGraphResourceRealDbProof.ts`, `a09ResourceGovernanceRealDbProof.ts`,
#   `t01InterviewRealDbProof.ts`, `a06AdapterOrchestrationRealDbProof.ts`).
#   ZERO pisarzy w sciezce produktowej.
```

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day174-stop-agenta-20260830` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6074`. Twój JEDYNY port harnessu to `5018 i 5019`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day174-pg`**. **ZAKAZANE:** `6012, 5433, 6047 i 6054-6055 oraz 6061-6067 (odbiory nadzorcy), 6051/4994-4995 (163), 6068/5010-5011 (170), 6069/5012-5013 (171), 6070/5014-5015 (172), 6071/5016-5017 (173), 6073 (zwolniony po FIX — mimo to NIE uzywaj). ★ REDIS: 6390, 6394 i 6399 byly uzywane przez wczesniejsze dyzury agenta — Twoj Redis to 6404, kontener `cx-day174-redis`. ★ PORT 5000 ZAJETY NA STALE przez macOS Control Center`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak nowych flag wizualnych. ★ `ENABLE_AI_TASKS_WORKER` pozostaje NIEZMIENIONA w repo — ustawiasz ja WYLACZNIE w powloce wlasnego przebiegu testowego (`ENABLE_AI_TASKS_WORKER=true npx vitest ...`), nigdy w pliku, nigdy w `.env`, nigdy w domyslnej wartosci kodu. Jesli R3 wprowadzi zmienne srodowiskowe dla wartosci polityki domyslnej, kazda MUSI miec bezpieczny default w kodzie i byc odnotowana w raporcie z nazwa i wartoscia domyslna`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY174_STOP_AGENTA_REPORT.md`. Nie zmieniasz zadnego `MODULE_ACCEPTANCE.md`. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day174-stop-agenta-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day174-stop-agenta-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **NIE WLACZASZ `ENABLE_AI_TASKS_WORKER` NIGDZIE.** Ani w `.env`, ani w `railway.json`, ani jako nowa wartosc domyslna w kodzie, ani w dokumentacji jako rekomendacje wlaczenia. Ustawiasz ja WYLACZNIE w powloce wlasnego przebiegu testowego. Decyzja o wlaczeniu nalezy do wlasciciela i zapada PO tym dyzurze (`docs/program/SCIEZKA_WYJSCIA.md`, K6). ★★ **NIE ZMIENIASZ `dispatchKey` ANI MECHANIZMU REPLAY.** `route:${planId}:approval:${N}` (`agent-plan.routes.ts:186,190`), `${planId}:wait:${stepIndex}` i `plan.id` (`agentPlanSchedulerJob.ts:37,133`) zostaja co do znaku — naprawil to dyzur 165 i kazda zmiana ksztaltu klucza uniewaznia jego dowod. Nie zmieniasz tez `identity()`/`payloadDigest`/`bullJobId` (`agentTaskDispatchService.ts:30-39`). ★★ **NIE DOTYKASZ WAVE8 ANI `multiAgentWorkManagerService`.** `estimatedCostUsd: 0` w `multiAgentWorkManagerService.ts:457` jest UZASADNIONE komentarzem w kodzie (`A08 owns branch token/cost accounting. This reservation contributes concurrency only`) — to nie jest ten sam defekt i nie wolno go „przy okazji naprawiac". Tak samo `server/src/routes/wave8-agents.routes.ts`, `server/src/services/wave8AgentRuntimeService.ts`, `server/src/services/v8/agentAdapterOrchestratorService.ts`. **NIE ZMIENIASZ 6 SKRYPTOW DOWODOWYCH `a09*`/`t01*`/`a06*`** — one wpisuja polityke same i sa dowodem historycznym; jesli Twoja zmiana je psuje, to znak, ze zmiana jest za szeroka. **NIE ZMIENIASZ SEMANTYKI `continue-on-error`** w `executePlan` poza tym, czego wymaga R1 (wyjscie po anulowaniu). **Zero polaczen do bazy zdalnej, demo, stagingu i produkcji** — wszystko na lokalnym kontenerze `cx-day174-pg` i lokalnym Redisie `cx-day174-redis`. | Trzy defekty zmierzone przy odbiorach 164 i 165 — zadna z nich nie jest hipoteza, kazda ma cytat w `docs/program/funkcje/ODBIOR_164_AGENT_NIE_WYKONUJE.md` i `ODBIOR_165_AGENT_WZNOWIENIE.md`. Odbior 165 konczy sie zdaniem: **anulowanie moze dodatkowo zamrozic pokwitowanie w `RUNNING` na stale**. Anulowanie planu **nie zatrzymuje wykonania** — a przy szybkich krokach jest wrecz **po cichu nadpisywane** przez wlasne zakonczenie planu, wiec kroki z efektem ubocznym i tak sie wykonuja. Limit kosztu `max_estimated_cost_usd_per_run` **nie moze strzelic nigdy**, bo do rezerwacji idzie `estimatedCostUsd: 0` na sztywno. A tabela polityk **nie ma zadnego pisarza produkcyjnego** — bez wiersza plan z `canonicalRunId` pada na pierwszym narzedziu, a plan bez `canonicalRunId` omija limity calkowicie. To jest ostatnia pozycja przed decyzja wlasciciela o wlaczeniu `ENABLE_AI_TASKS_WORKER` (`docs/program/SCIEZKA_WYJSCIA.md`, punkt K6) |

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
cd /private/tmp/cx-day174-stop-agenta

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day174-pg psql -U postgres -d cx174 \
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
cd /private/tmp/cx-day174-stop-agenta

docker run -d --name cx-day174-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx174 \
  -p 127.0.0.1:6074:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day174-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6074/cx174 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6074/cx174 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day174-stop-agenta && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6074/cx174 \
JWT_SECRET=cx174-test-secret-do-not-reuse \
npx vitest run server/src/services/ai/__tests__ oraz server/src/workers/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day174-stop-agenta-artefakty/day174-vitest.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day174-stop-agenta && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/services/ai/__tests__ oraz server/src/workers/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day174-stop-agenta-artefakty/day174-vitest.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day174-stop-agenta/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day174-pg psql -U postgres -d cx174 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day174-pg`.
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
> **(e) ★★ **Pierwsza, i to jest sedno R1: sa DWA rozne skutki anulowania, zaleznie od czasu trwania kroku — brief nadzorcy opisywal tylko jeden.** (a) Kroki szybkie: `cancelPlan` NIE czysci kolumn leasu (`updatePlanStatus`, `:1074-1100`), a `leasePredicate` (`:333-336`) NIE sprawdza `status` — wiec `finalizePlan` (`:1103-1124`) na koncu petli **nadpisuje 'cancelled' na 'completed'**. Anulowanie znika bez sladu, a wszystkie pozostale kroki z efektem ubocznym sie wykonuja. (b) Kroki dluzsze niz 60 s: `renewExecutionLease` (`:319-331`) ma w `WHERE` warunek `status = 'executing'`, wiec pierwszy tyk heartbeatu po anulowaniu **rzuca `AgentExecutionLeaseLostError`**, worker leci w `catch` i pokwitowanie dostaje uczciwe `FAILED`. (c) Anulowanie PRZED podjeciem zadania: guard `:489` zwraca plan wczesnie i pokwitowanie zostaje w `RUNNING`. **Zmierz wszystkie trzy przypadki, zanim zaczniesz projektowac naprawe** — naprawa, ktora zamyka (c) i nie zamyka (a), jest gorsza niz stan dzisiejszy, bo daje falszywe poczucie, ze przycisk dziala. ★★ **Druga: pokwitowanie w `RUNNING` jest NIE DO ODRATOWANIA.** `dispatchAgentTask:82-84` dla statusu `RUNNING` zwraca `REPLAY` (nowe uruchomienie nie trafia do kolejki, a `tryDispatchBackgroundExecution:194` melduje `'replayed'`), a `redriveAgentTask:181-207` przyjmuje **wylacznie `FAILED`** (i idempotentne `PENDING`) — dla `RUNNING` rzuca `AGENT_DISPATCH_NOT_REDRIVABLE`. Brief nadzorcy mowil „odmawia dla SUCCEEDED" — **odmawia dla wszystkiego poza FAILED**. Sprawdz to sam i uwzglednij: jesli wprowadzisz NOWY stan pokwitowania (np. `CANCELLED`), to `claimAgentTask:135-138` zwroci dla niego `AGENT_DISPATCH_CLAIM_CONFLICT`, a `redriveAgentTask` `NOT_REDRIVABLE` — **kazdy nowy stan musi byc dopisany do OBU tych czytelnikow albo swiadomie odrzucony w raporcie**. ★★ **Trzecia, dla R2: koszt musi byc DETERMINISTYCZNY per krok.** `reserveAgentResource:166-172` rzuca `resource_idempotency_cost_mismatch`, gdy ten sam `idempotencyKey` wraca z innym kosztem. Klucz to `planner:${canonicalRunId}:${operationKey}`, a `operationKey` = `agent-plan:${planId}:step:${step.id}` — **staly przez cale zycie kroku**. Szacunek liczony z dlugosci tekstu, znacznika czasu, losowosci albo z odpowiedzi modelu **wysadzi retry**. Stala mapa `toolName -> cena` jest jedynym ksztaltem, ktory to przezyje. ★★ **Czwarta, tez dla R2: `runToolWithRetry` (`:1237-1256`, 3 proby) na sciezce z `canonicalRunId` JUZ DZIS nie dziala tak, jak wyglada.** Po nieudanej probie `executeWithAgentResourceReservation` robi `releaseAgentResource`, a druga proba trafia w rezerwacje `released` i wraca jako `idempotentReplay` z `allowed = (status === 'settled')` = **false**. To zastany stan, nie Twoj defekt — ale **zmierz go i opisz w raporcie**, bo bez tego czytelnik uzna Twoj nowy koszt za przyczyne. ★★ **Piata, dla R3: polityki NIE DA SIE zaseedowac migracja w sposob, ktory cokolwiek zalatwia.** Tabela ma `UNIQUE (organization_id, project_id)` i oba pola sa `NOT NULL` — migracja moglaby wpisac wiersze najwyzej dla par org/projekt istniejacych **w chwili migracji**, a kazda nowa organizacja i kazdy nowy projekt nadal dostana `resource_policy_not_found`. Brief nadzorcy dopuszczal wariant migracyjny — **zmierz i uzasadnij**; jesli wybierzesz leniwy INSERT przy pierwszym uzyciu albo fallback w kodzie, napisz to wprost jako korekte wobec instrukcji. Pamietaj tez, ze `SELECT` polityki ma `AND enabled = 1` (`:196-201`) — wiersz z `enabled = 0` daje **ten sam** `resource_policy_not_found`, wiec „polityka istnieje" to nie to samo co „polityka dziala". ★★ **Szosta, migracyjna: porzadek migracji NIE JEST alfabetyczny.** `server/scripts/migrationOrdering.ts:316-346` sortuje FAZAMI: faza 0 = pliki `NNN_` (numeryczne), faza 1 = `YYYYMMDD_` (datowane), faza 2 = `LATE_PHASE_MANIFEST`, faza 3 = reszta. Plik datowany biegnie **po wszystkich numerowanych**, niezaleznie od tego, jak wypada alfabetycznie. Ostatnie numerowane to `960_notification_types_ai_cost_budget.sql`. `compareMigrationOrder` rzuca `DuplicateSortKeyError`, jesli dwa pliki daja ten sam klucz — nie wybieraj nazwy kolidujacej. Bramka `day161` (`scripts/dev/day161-fresh-migration-check.sh`, workflow `.github/workflows/day161-fresh-migration-gate.yml`, `npm run test:migrations:day161:fresh`) wymaga **pelnego przebiegu od PUSTEJ bazy** — uruchom ja sam, jesli dodajesz migracje. ★★ **Siodma: wyscig planistyczny w cronie, ktory omija Twoja bramke.** `listWaitStepsDue` (`:757-803`) **nie filtruje po statusie planu**; ochrona jest posrednia — `cancelPlan` przestawia kroki `awaiting_approval` na `skipped`. Ale gdy anulowanie trafi POMIEDZY odczyt listy a `beforeEnqueue`, `resumeWaitStep` (`:807-826`) **cicho nic nie robi** (`if (!step) return`), a `enqueueBackgroundExecution` mimo to **zakolejkuje zadanie** dla anulowanego planu. To najkrotsza droga do przypadku (c) z pulapki pierwszej. Sprawdz ja. ★★ **Osma, testowa: `DB_TYPE` jest przypiety w `vitest.config.ts:210` (korzen repo)** — `DB_TYPE: 'sqlite'` na sztywno. `server/vitest.config.ts:17` jest naprawiony (`process.env.DB_TYPE || 'sqlite'`) i **to jego uzywasz** dla testow backendowych. Bez `RUN_DB_TESTS=1` dostajesz MOCK DB; bez `RUN_REDIS_TESTS=1` i `MOCK_REDIS=false` testy kolejkowe sie POMIJAJA. **`No test files found` i `skipped` to NIE jest `PASS`** — sprawdzaj `numTotalTests` > 0 i liczbe faktycznie uruchomionych przypadkow. Wzorzec harnessu do skopiowania: `server/src/services/ai/__tests__/day165.agent-plan-resume.pg.redis.test.ts:12-24` (jawne `expect(process.env.DB_TYPE).toBe('postgres')` w `beforeAll` — asercja srodowiska, nie zalozenie). ★★ **Dziewiata: caly modul rezerwacji jest POSTGRES-ONLY.** `reserveAgentResource` uzywa `withPgTransaction` i `pg_advisory_xact_lock` — na sqlite ta sciezka nie ma prawa dzialac. Kazdy dowod dla R2 i R3 musi isc na realnym Postgresie, inaczej mierzysz atrape. ★★ **Dziesiata, kontekstowa dla R2: wiekszosc narzedzi to ATRAPY.** `toolDefinitions.ts:628-652` — `generate_report_section` i `schedule_meeting` zwracaja staly JSON, zero pracy, zero modelu. Realne koszty maja `search_web` (`:584`, wywolanie zewnetrzne) i `query_structured_data` (`:672`, text-to-SQL). **Cennik, ktory tego nie odrozni, bedzie kolejna fikcja — tylko z inna liczba niz zero.** Narzedzi jest 20 (19 z `AI_TOOLS` + `wait_until`), z czego 8 w `SIDE_EFFECT_TOOLS` (`server/src/services/ai/sideEffectTools.ts:17-31`) — lista jest **zamknieta i policzalna**, wiec mapa cen moze byc kompletna. ★★ **Jedenasta: sam kod przyznaje sie do braku.** `agent-plan.routes.ts:119` — `const MAX_STEPS_PER_PLAN = 12; // koncept sekcja 1 "Limity (twarde)" — F6 doda timeout/budzet realny`. Ten dyzur jest tym „F6" w czesci budzetowej; **timeoutu nie robisz** i nie udawaj, ze robisz.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day174-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day174-stop-agenta-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`pozycje R1 i R2 — anulowanie planu realnie zatrzymuje wykonanie i domyka pokwitowanie, a limit kosztu przestaje byc martwa litera`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6074` albo `5018 i 5019` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6074` albo `5018 i 5019`** (`Z7`).

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

Trzy defekty agenta planów zostały zmierzone i nazwane przy odbiorach dyżurów 164 i 165 —
żaden nie jest hipotezą postawioną teraz, każdy ma źródło w repo i cytat z kodu. Wszystkie
trzy stoją między produktem a jedną decyzją właściciela: włączyć `ENABLE_AI_TASKS_WORKER`
czy nie (`docs/program/SCIEZKA_WYJSCIA.md`, punkt K6 — „Po 174 + decyzji:
`ENABLE_AI_TASKS_WORKER` ON albo świadome NIE”).

Odbiór 164 (`docs/program/funkcje/ODBIOR_164_AGENT_NIE_WYKONUJE.md`) postawił werdykt
w tabeli inwentarza ryzyka:

| pytanie | odpowiedź |
|---|---|
| czy da się zatrzymać w locie? | **NIE** — `cancelPlan` robi wyłącznie `UPDATE` statusów, zero dotknięcia zadania w kolejce ani sygnału przerwania |
| czy ma limity? | częściowo — `MAX_STEPS_PER_PLAN=12`, retry 3; ale `estimatedCostUsd: 0`, czyli **brak limitu kosztu** |

Odbiór 165 (`docs/program/funkcje/ODBIOR_165_AGENT_WZNOWIENIE.md`) potwierdził, że po
naprawie wznawiania **dwa blokery pozostały nietknięte**, i dodał ostrzeżenie:

> **Po tej łatce jest gorzej:** anulowanie może dodatkowo **zamrozić pokwitowanie
> w `RUNNING` na stałe**.

**Trzeci defekt** — brak wiersza polityki zasobów — nie był przedmiotem żadnego z tych
dwóch odbiorów; został zmierzony przy składaniu tej instrukcji i jest opisany poniżej.

## Defekt 1 — anulowanie planu nie zatrzymuje planu

`agentPlannerService.cancelPlan` (`server/src/services/ai/agentPlannerService.ts:827-835`)
w całości wygląda tak:

```ts
async cancelPlan(planId: string): Promise<void> {
  await this.updatePlanStatus(planId, 'cancelled');
  await dbRun(
    `UPDATE ai_agent_plan_steps SET status = 'skipped'
     WHERE plan_id = ? AND status IN ('pending', 'awaiting_approval')`,
    [planId]
  );
  await this.projectCanonicalPlanTransition(planId, null, 'Agent plan cancelled.');
}
```

Trzy zapisy do bazy. Zero odwołań do kolejki BullMQ, zero do pokwitowania
(`ai_agent_job_receipts`), zero do kolumn dzierżawy wykonania. Jedynym wołaczem jest trasa
`POST /api/ai/agent-plan/:id/cancel` (`server/src/routes/ai/agent-plan.routes.ts:853`),
której front używa przez `src/services/api/agentPlan.api.ts:249`.

**Skutek zależy od czasu trwania kroku i są to TRZY różne zachowania — nie jedno.**
Zweryfikowane w kodzie przy składaniu tej instrukcji:

**(a) Kroki szybkie — anulowanie zostaje po cichu nadpisane, plan kończy się jako
`completed`.** `updatePlanStatus` (`:1074-1100`) ustawia `status` i `updated_at`, ale
**nie czyści** `execution_owner_token`, `execution_fencing_token` ani
`execution_lease_expires_at`. A predykat, którym bronią się wszystkie zapisy w trakcie
wykonania (`:333-336`), nie patrzy na status:

```ts
private leasePredicate(alias = ''): string {
  const prefix = alias ? `${alias}.` : '';
  return `${prefix}execution_owner_token = ? AND ${prefix}execution_fencing_token = ? AND ${prefix}execution_lease_expires_at > datetime('now')`;
}
```

Dlatego `finalizePlan` (`:1103-1124`), wywoływane na końcu pętli, przechodzi bez przeszkód
i wpisuje `status = 'completed'` **na wierzchu `'cancelled'`**. Anulowanie znika bez śladu,
a wszystkie pozostałe kroki — łącznie z tymi z `SIDE_EFFECT_TOOLS` — już się wykonały.

**(b) Krok dłuższy niż 60 sekund — anulowanie działa, ale przez przypadek.**
`renewExecutionLease` (`:319-331`) ma w `WHERE` warunek `status = 'executing'`. Heartbeat
bije co `heartbeatIntervalMs = 60_000` (`:129`). Pierwszy tyk po anulowaniu nie znajduje
wiersza, rzuca `AgentExecutionLeaseLostError`, `executePlan:583` go podnosi, worker łapie
i pokwitowanie dostaje uczciwe `FAILED`. To nie jest zaprojektowane zatrzymanie — to
skutek uboczny warunku w innym zapytaniu.

**(c) Anulowanie zanim worker podejmie zadanie — pokwitowanie zamarza w `RUNNING`.**
Guard na wejściu `executePlan` (`:489`) zwraca plan wcześnie:

```ts
if (['completed', 'completed_with_errors', 'failed', 'cancelled'].includes(plan.status)) {
  return plan;
}
```

a `aiWorker.ts:111-112` zamyka pokwitowanie **tylko** dla dwóch statusów:

```ts
result = await agentPlannerService.executeBackgroundPlan(payload);
if (result.status === 'completed' || result.status === 'completed_with_errors')
  await finishAgentTask(receiptId, workerId, true);
```

`'cancelled'` nie jest w tym warunku. Pokwitowanie zostaje w `RUNNING`.

**I to zamrożenie jest nieodwracalne — mocniej, niż opisywał odbiór 165.**
`dispatchAgentTask` (`server/src/services/ai/agentTaskDispatchService.ts:82-84`):

```ts
if (receipt.status === 'ENQUEUED' || receipt.status === 'RUNNING' || receipt.status === 'SUCCEEDED') {
  return { status: 'REPLAY', receiptId: receipt.receipt_id, bullJobId: receipt.bull_job_id };
}
```

Każde kolejne uruchomienie tego samego `dispatchKey` wraca jako `REPLAY` i **do kolejki nie
trafia nic**, a `tryDispatchBackgroundExecution` (`agent-plan.routes.ts:194`) melduje
`'replayed'`. Ścieżka ratunkowa operatora też jest zamknięta: `redriveAgentTask`
(`agentTaskDispatchService.ts:181-207`) obsługuje **wyłącznie** `FAILED` (oraz idempotentne
`PENDING`) i dla wszystkiego innego rzuca `AGENT_DISPATCH_NOT_REDRIVABLE`. Odbiór 164
zapisał to jako „odmawia dla `SUCCEEDED`” — w rzeczywistości odmawia dla wszystkiego poza
`FAILED`, w tym dla `RUNNING`.

**(d) Pętla `executePlan` (`:505-651`) między krokami w ogóle nie sprawdza, czy plan został
anulowany.** Plan jest wczytywany raz, na wejściu (`:486`), i pętla lecąca po
`plan.steps` nigdy nie wraca do bazy po status. Anulowanie w połowie planu wielokrokowego
nie przerywa nic aż do momentu, w którym jakiś inny mechanizm (heartbeat z punktu b) się
o to potknie.

## Defekt 2 — limit kosztu, który nie ma jak strzelić

`executeBackgroundPlan` (`agentPlannerService.ts:1050-1058`) przekazuje do rezerwacji
zasobów koszt wpisany na sztywno:

```ts
const resourceExecution = await executeWithAgentResourceReservation({
  ...
  idempotencyKey: `planner:${plan.canonicalRunId}:${execution?.operationKey || `${plan.id}:${toolName}`}`,
  estimatedCostUsd: 0,
```

To samo w `executeGovernedEnqueue` (`:157`). A limit polityki sprawdza się tak
(`server/src/services/v8/agentResourceGovernanceService.ts:233-238`):

```ts
} else if (
  Number(usage.reserved_cost) + estimatedCostUsd >
  Number(policy.max_estimated_cost_usd_per_run)
) {
  reason = 'resource_estimated_cost_limit_exceeded';
  status = 'denied';
}
```

`usage.reserved_cost` to suma `estimated_cost_usd` rezerwacji tego biegu. Skoro każda
rezerwacja wnosi zero, suma zostaje zerem na zawsze i żaden dodatni limit nie zostanie
przekroczony. Warunek jest martwy. Sam kod przyznaje się do braku —
`agent-plan.routes.ts:119`:

```ts
const MAX_STEPS_PER_PLAN = 12; // koncept sekcja 1 "Limity (twarde)" — F6 doda timeout/budżet realny
```

## Defekt 3 — tabela polityk bez pisarza produkcyjnego

Tabela `v8_agent_resource_policies` powstaje w
`server/migrations/20260808_v8_agent_resource_governance.sql:1-13`
(`UNIQUE (organization_id, project_id)`, `enabled INTEGER NOT NULL DEFAULT 1`). Pełny
inwentarz odwołań w repo, zmierzony przy składaniu tej instrukcji:

- **1 czytelnik produkcyjny** — `agentResourceGovernanceService.ts:196-203`,
  `SELECT ... WHERE organization_id = ? AND project_id = ? AND enabled = 1`, a przy braku
  wiersza `throw new Error('resource_policy_not_found')`.
- **6 skryptów dowodowych z `INSERT`-em** — `a09CrossPathResourceRealDbProof.ts`,
  `a09ReleasedReservationReclaimRealDbProof.ts`, `a09WorkGraphResourceRealDbProof.ts`,
  `a09ResourceGovernanceRealDbProof.ts`, `t01InterviewRealDbProof.ts`,
  `a06AdapterOrchestrationRealDbProof.ts`.
- **Zero pisarzy w ścieżce produktowej.**

Skutki są dwa i wykluczają się nawzajem, zależnie od tego, czy plan ma `canonicalRunId`
(`agentPlannerService.ts:1041-1048`):

```ts
const executor: PlanToolExecutor = async (toolName, input, execution) => {
  if (!plan.canonicalRunId) {
    return executeToolCall(toolName, input, { ... });   // ← BEZ rezerwacji
  }
  const resourceExecution = await executeWithAgentResourceReservation({ ... });
```

- **Plan z `canonicalRunId`** — pierwsze narzędzie leci w `resource_policy_not_found`
  i, przez `continue-on-error`, każdy kolejny krok też. Plan kończy się jako
  `completed_with_errors` z kompletem porażek.
- **Plan bez `canonicalRunId`** — nie przechodzi przez rezerwację w ogóle. Żadnej
  równoległości, żadnego kosztu, żadnego limitu. To jest domyślna ścieżka planu tworzonego
  z czatu.

## Czym ten dyżur NIE jest

Nie jest włączeniem `ENABLE_AI_TASKS_WORKER` — decyzja należy do właściciela i zapada po
tym dyżurze. Nie jest zmianą `dispatchKey` ani mechanizmu replay: to własność dyżuru 165
i jego dowodu. Nie jest naprawą `estimatedCostUsd: 0` w `multiAgentWorkManagerService.ts:457`
— tam zero jest uzasadnione komentarzem w kodzie („A08 owns branch token/cost accounting.
This reservation contributes concurrency only”) i nie wolno go „przy okazji poprawiać”.
Nie jest dodaniem timeoutu wykonania ani budżetu tokenów — druga połowa komentarza z
`agent-plan.routes.ts:119` zostaje na osobny dyżur. Nie jest przeglądem ani zmianą 6
skryptów dowodowych `a09*`/`t01*`/`a06*`.

# 2. TEZY ZLECENIA

- **T1.** `cancelPlan` nie dotyka ani kolejki, ani pokwitowania, ani kolumn dzierżawy —
  sprawdź to w kodzie, nie zakładaj z opisu.
- **T2.** Anulowanie planu bywa **po cichu nadpisane** przez `finalizePlan`, bo predykat
  dzierżawy nie sprawdza statusu, a `cancelPlan` nie unieważnia dzierżawy. To jest skutek
  cięższy niż zamrożone pokwitowanie i musi być zmierzony osobno.
- **T3.** Pokwitowanie zatrzaśnięte w `RUNNING` blokuje swój `dispatchKey` na stałe
  (`dispatchAgentTask:82-84` → `REPLAY`) i nie ma ścieżki ratunkowej
  (`redriveAgentTask:181-207` przyjmuje tylko `FAILED`). Każdy nowy stan pokwitowania, który
  wprowadzisz, musi być rozstrzygnięty w **obu** tych czytelnikach oraz w
  `claimAgentTask:135-138`.
- **T4.** `estimatedCostUsd: 0` w `agentPlannerService.ts:157` i `:1058` czyni warunek
  `resource_estimated_cost_limit_exceeded` niedosiężnym. Szacunek zastępujący zero musi być
  **deterministyczny per krok**, bo `reserveAgentResource:166-172` rzuca
  `resource_idempotency_cost_mismatch`, gdy ten sam `idempotencyKey` wróci z inną liczbą.
- **T5.** `v8_agent_resource_policies` nie ma pisarza produkcyjnego. Sam `INSERT` w migracji
  nie rozwiązuje problemu, bo klucz to para `(organization_id, project_id)` — każda nowa
  organizacja i każdy nowy projekt nadal dostanie `resource_policy_not_found`. Zmierz to
  i uzasadnij wybrany kształt.

# 3. POZYCJE DYŻURU

## R1 — zatrzymanie uruchomionego planu naprawdę zatrzymuje plan

Trzy rzeczy do domknięcia, w tej kolejności ważności:

**(1) Anulowanie musi wygrać z `finalizePlan`.** Dziś nie wygrywa (patrz sekcja 1, przypadek
(a)). Rozważ i uzasadnij co najmniej dwa kształty, zanim wybierzesz:

- *Unieważnienie dzierżawy w `cancelPlan`* — np. podbicie `execution_fencing_token` i/lub
  wyzerowanie `execution_owner_token`/`execution_lease_expires_at`. Wtedy **każdy** zapis
  chroniony `leasePredicate` (`guardedPlanRun`, `guardedStepRun`, `updatePlanProgress`,
  `finalizePlan`) natychmiast rzuca `AgentExecutionLeaseLostError`, worker leci w `catch`
  i pokwitowanie się domyka. Zaleta: jedno miejsce, cały łańcuch. Wada: pokwitowanie dostaje
  `FAILED`, co dla świadomego anulowania jest półprawdą.
- *Warunek statusu w `finalizePlan`* — dopisanie do `WHERE` warunku, że plan wciąż jest
  `executing`. Zaleta: precyzyjne. Wada: `guardedPlanRun` rzuca przy zerze zmian, więc
  musisz świadomie rozstrzygnąć, co ma się stać z tym wyjątkiem.

**(2) Pętla musi sprawdzać anulowanie między krokami.** Odczyt statusu planu z bazy przed
każdym krokiem (`executePlan`, pętla `:505-651`) i czyste wyjście, gdy status to
`'cancelled'`. „Czyste” znaczy: bez `finalizePlan` przestawiającego status, z domknięciem
dzierżawy, ze zwróceniem planu o statusie `'cancelled'` do wołacza. Zwróć uwagę na koszt:
to jeden dodatkowy `SELECT` na krok — kroki i tak są ograniczone do 12
(`MAX_STEPS_PER_PLAN`), więc to jest tanie; napisz w raporcie, że to sprawdziłeś.

**(3) Warunek zamknięcia pokwitowania musi obejmować `'cancelled'`** (`aiWorker.ts:111-112`).
Decyzja co do kształtu należy do Ciebie i **musi być uzasadniona w raporcie**:
`finishAgentTask(receiptId, workerId, true)` (pokwitowanie `SUCCEEDED` — „zadanie
obsłużone zgodnie z żądaniem”), czy dedykowany stan. Jeśli wybierzesz dedykowany stan,
masz obowiązek dopisać go — albo świadomie odrzucić z uzasadnieniem — w **trzech**
miejscach: `claimAgentTask:135-138` (dziś tylko `SUCCEEDED` daje `replayed`, reszta rzuca
`AGENT_DISPATCH_CLAIM_CONFLICT`), `dispatchAgentTask:82-84` (lista statusów dających
`REPLAY`) i `redriveAgentTask:181-207` (dziś tylko `FAILED` jest redrivable). Pominięcie
któregokolwiek zostawia nowy stan jako kolejną pułapkę zamiast naprawy.

**(4) Trasa `POST /:id/cancel` (`agent-plan.routes.ts:836-857`) zwraca stan odzwierciedlający
rzeczywistość.** Dziś zwraca plan odczytany zaraz po `cancelPlan` — jeśli po Twojej zmianie
anulowanie ma efekty poza tabelą planu (pokwitowanie, dzierżawa), odpowiedź nie może o nich
milczeć. Nie zmieniasz kształtu koperty (`{ success, plan }`) bez zapisania tego w raporcie —
front `agentPlan.api.ts:249` ją czyta.

**Ukończone, gdy:** masz test na realnym Postgresie i realnym Redisie, który dla planu
3-krokowego z anulowaniem po pierwszym kroku pokazuje **wszystkie cztery fakty naraz**:
(i) kroki 2 i 3 **nie zostały wykonane** — sprawdzone po skutku, nie po statusie wiersza;
(ii) status planu w bazie to `'cancelled'`, a **nie** `'completed'`; (iii) pokwitowanie nie
jest w `RUNNING`; (iv) `redriveAgentTask` dla tego pokwitowania zachowuje się w sposób,
który opisałeś i uzasadniłeś (nie „przypadkiem tak wyszło”). Do tego dowód mutacyjny: cofnij
samą poprawkę (2) i pokaż, że test czerwienieje.

## R2 — realny koszt zamiast zera

Zastąp `estimatedCostUsd: 0` w `agentPlannerService.ts:1058` szacunkiem per krok.
Rekomendowany kształt: **stała mapa `toolName -> cena`** w osobnym module obok
`sideEffectTools.ts`, z komentarzem uzasadniającym każdą pozycję. Powody, dla których
akurat stała mapa:

- **Determinizm jest wymuszony przez kod.** `reserveAgentResource:166-172` rzuca
  `resource_idempotency_cost_mismatch`, gdy ten sam `idempotencyKey` wraca z inną kwotą.
  Klucz to `planner:${canonicalRunId}:${operationKey}`, gdzie `operationKey` =
  `agent-plan:${planId}:step:${step.id}` — **stały przez całe życie kroku**. Szacunek liczony
  z długości wejścia, ze znacznika czasu albo z odpowiedzi modelu wysadzi ponowną próbę.
- **Zbiór narzędzi jest zamknięty i policzalny.** 19 pozycji w `AI_TOOLS` plus `wait_until`
  (`toolDefinitions.ts:583-706`), z czego 8 w `SIDE_EFFECT_TOOLS`
  (`sideEffectTools.ts:17-31`). Mapa może być kompletna, a `default` dla nieznanej nazwy —
  świadomie wybrany i opisany.

Zero wolno przypisać **wyłącznie** narzędziom bez realnego kosztu, i tylko na jawnej,
wypisanej liście. Przy jej układaniu weź pod uwagę zmierzony fakt: **większość narzędzi to
atrapy** — `generate_report_section` i `schedule_meeting` (`toolDefinitions.ts:628-652`)
zwracają stały JSON i nie robią nic. Realny koszt zewnętrzny mają `search_web` (`:584`)
i `query_structured_data` (`:672`, text-to-SQL). Cennik, który tego nie odróżnia, będzie
kolejną fikcją — tylko z inną liczbą niż zero.

`:157` (`executeGovernedEnqueue`, `toolName: 'agent_plan.enqueue'`) to **koszt samego
zakolejkowania**, nie narzędzia. Zdecyduj świadomie, czy zostaje zerem, i zapisz dlaczego —
nie zmieniaj go odruchowo „dla symetrii”.

Odnotuj też w raporcie (zmierz, nie zakładaj) zastane zachowanie, którego Twoja zmiana nie
dotyczy, a które będzie wyglądało na jej skutek: `runToolWithRetry` (`:1237-1256`, 3 próby)
na ścieżce z `canonicalRunId` **już dziś nie ponawia skutecznie** — po nieudanej próbie
`executeWithAgentResourceReservation` woła `releaseAgentResource`, a druga próba trafia
w rezerwację `released` i wraca jako `idempotentReplay` z `allowed = (status === 'settled')`,
czyli `false`. To zastany stan, nie Twój defekt; bez zapisania go w raporcie czytelnik uzna
Twój nowy koszt za przyczynę.

**Ukończone, gdy:** masz test na realnym Postgresie, w którym plan z polityką o niskim
`max_estimated_cost_usd_per_run` przekracza limit i **odmowa jest widoczna**: krok ma
`error_message` zawierający `resource_estimated_cost_limit_exceeded`, a nie cichą porażkę
ani pustkę. Plus dowód mutacyjny: przywróć `estimatedCostUsd: 0` i pokaż, że ten sam plan
przechodzi. Plus jawne stwierdzenie w raporcie, co dzieje się z **pozostałymi krokami** po
przekroczeniu limitu — `continue-on-error` (`:640-643`) oznacza, że pętla nie staje, tylko
przepala resztę planu na kolejne odmowy. Jeśli uznasz, że to wymaga wcześniejszego wyjścia,
**zgłoś jako osobną pozycję, nie rozszerzaj zakresu sam**.

## R3 — polityka zasobów istnieje, zanim ktoś jej potrzebuje

Wybierz jeden z dwóch kształtów i **uzasadnij wybór pomiarem**, nie wygodą:

- **(A) Leniwy zapis przy pierwszym użyciu** — w `agentResourceGovernanceService.ts`,
  w miejscu, gdzie dziś leci `resource_policy_not_found` (`:203`): `INSERT ... ON CONFLICT
  (organization_id, project_id) DO NOTHING` z wartościami z env i bezpiecznymi domyślnymi
  w kodzie, po czym ponowny odczyt. Zaleta: działa dla każdej przyszłej organizacji
  i projektu. Wada: zapis wewnątrz transakcji trzymającej `pg_advisory_xact_lock` — sprawdź,
  czy nie kolidujesz z blokadą, i **napisz w raporcie, że sprawdziłeś**.
- **(B) Polityka zapasowa w kodzie** — brak wiersza oznacza użycie stałych domyślnych
  bez zapisu do bazy. Zaleta: zero zmian w schemacie. Wada: polityki nie da się wtedy
  podejrzeć ani zmienić przez bazę, a rezerwacja ma `policy_id TEXT NOT NULL REFERENCES
  v8_agent_resource_policies(policy_id)` — **klucz obcy wymaga istniejącego wiersza**.
  Sprawdź to, zanim wybierzesz (B); może się okazać niewykonalne bez zmiany schematu.

**Wariant „migracja z polityką domyślną” zmierz i najprawdopodobniej odrzuć.** Tabela ma
`UNIQUE (organization_id, project_id)`, oba pola `NOT NULL`. Migracja może wpisać wiersze
najwyżej dla par istniejących **w chwili migracji** — każda organizacja i każdy projekt
utworzony później nadal dostanie `resource_policy_not_found`. Zlecenie nadzorcy dopuszczało
ten wariant; jeśli po pomiarze go odrzucisz, **zapisz to jako korektę wobec instrukcji**,
nie jako pominięcie.

Wartości domyślne (`max_concurrent_executions`, `max_estimated_cost_usd_per_run`,
`lease_seconds`) dobierz sam i uzasadnij. Punkt odniesienia z repo, nie nakaz:
skrypty dowodowe używają `lease_seconds = 300`
(`a09ResourceGovernanceRealDbProof.ts:20-26`), a `LEASE_SECONDS = 300` jest też stałą
dzierżawy pokwitowania (`agentTaskDispatchService.ts:8`) i wykonania planu
(`agentPlannerService.ts:128`). Cokolwiek wybierzesz dla kosztu, **musi być spójne
z cennikiem z R2** — limit niższy niż cena jednego kroku zablokuje każdy plan, limit
wyższy niż suma 12 kroków nie zablokuje nigdy. Pokaż tę arytmetykę w raporcie.

Pamiętaj, że `SELECT` polityki ma `AND enabled = 1` (`:196-201`) — wiersz z `enabled = 0`
daje **ten sam** `resource_policy_not_found`. „Polityka istnieje” to nie to samo co
„polityka działa”; test musi rozróżniać oba przypadki.

**Ścieżka bez `canonicalRunId`** (`agentPlannerService.ts:1041-1048`) omija rezerwację
całkowicie. Zamawiający chce, żeby też przez nią przechodziła — **ale zmierz przeszkodę
przed decyzją**: `reserveAgentResource:132-134` wymaga niepustych `projectId` i `runId`
(`resource_project_required`, `resource_run_required`), a plan bez `canonicalRunId` nie ma
żadnego z nich. Jeśli po pomiarze uznasz, że domknięcie tej ścieżki wykracza poza ten dyżur,
**wpisz to jawnie do raportu z uzasadnieniem** — to jest dopuszczalny wynik, ale wyłącznie
zapisany, nie przemilczany.

Jeśli mimo wszystko dodajesz migrację: nazwa musi przejść
`server/scripts/validate-migration-naming.ts`, a porządek uruchamiania **nie jest
alfabetyczny** — `server/scripts/migrationOrdering.ts:316-346` sortuje fazami (0: `NNN_`,
1: `YYYYMMDD_`, 2: manifest, 3: reszta), więc plik datowany biegnie **po wszystkich**
numerowanych; ostatni numerowany to `960_notification_types_ai_cost_budget.sql`.
`compareMigrationOrder` rzuca `DuplicateSortKeyError` przy kolizji klucza. Obowiązkowo
uruchom pełny przebieg od pustej bazy: `npm run test:migrations:day161:fresh`
(`scripts/dev/day161-fresh-migration-check.sh`) i wklej wynik do raportu.

**Ukończone, gdy:** na świeżej bazie, **bez ręcznego `INSERT`-a do
`v8_agent_resource_policies`**, plan z `canonicalRunId` wykonuje pierwszy krok bez
`resource_policy_not_found`; masz osobny przypadek pokazujący, że wiersz z `enabled = 0`
nadal jest traktowany jak brak polityki; i masz w raporcie arytmetykę wiążącą wartości
domyślne z cennikiem z R2.

## R4 — dowody

Wszystkie dowody idą na **realnym Postgresie i realnym Redisie**. Moduł rezerwacji jest
Postgres-only (`withPgTransaction`, `pg_advisory_xact_lock` w
`agentResourceGovernanceService.ts:146,166`) — na sqlite mierzysz atrapę. Wzorzec harnessu
do skopiowania: `server/src/services/ai/__tests__/day165.agent-plan-resume.pg.redis.test.ts:12-24`,
z jawnymi asercjami środowiska w `beforeAll`:

```ts
const enabled = process.env.RUN_DB_TESTS === '1' && process.env.RUN_REDIS_TESTS === '1';
describe.skipIf(!enabled)(..., () => {
  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.MOCK_REDIS).toBe('false');
    expect(process.env.ENABLE_AI_TASKS_WORKER).toBe('true');
```

Te trzy `expect` są obowiązkowe w każdym Twoim nowym teście integracyjnym — bez nich
„PASS” może oznaczać, że test w ogóle nie dotknął bazy. **`skipped` i `No test files found`
to NIE jest `PASS`**: w każdym wyniku, który przywołujesz jako dowód, podaj `numTotalTests`
i liczbę faktycznie uruchomionych przypadków.

Nazwy plików: `day174.<temat>.pg.redis.test.ts` w
`server/src/services/ai/__tests__/` dla R1 i R2 oraz — jeśli dotykasz warunku zamknięcia
pokwitowania — w `server/src/workers/__tests__/` wzorem
`day164.agent-dispatch-map.test.ts`. Nowe pliki w `tests/` wymagają `git add -f`.

Dla każdej z trzech pozycji obowiązuje **dowód mutacyjny**: cofnij samą naprawę i pokaż, że
test czerwienieje. Test, który przechodzi także przed naprawą, nie jest dowodem niczego.

Wynik `npm run test:migrations:day161:fresh` wklej dosłownie, jeśli dodałeś migrację.

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis | `server/src/services/ai/agentPlannerService.ts` — wyłącznie: `cancelPlan` (`:827-835`), pętla `executePlan` (`:505-651`) w zakresie sprawdzenia anulowania, `finalizePlan` (`:1103-1124`) i/lub `updatePlanStatus` (`:1074-1100`) w zakresie R1, `executeBackgroundPlan` (`:1050-1058`) w zakresie R2, `executeGovernedEnqueue` (`:157`) tylko jeśli świadomie zmieniasz koszt zakolejkowania |
| Zapis | `server/src/workers/aiWorker.ts` — wyłącznie blok `AGENT_BACKGROUND_TASK` (`:94-118`), a w nim warunek zamknięcia pokwitowania (`:111-112`); zakaz zmian w pozostałych `case` |
| Zapis | `server/src/services/ai/agentTaskDispatchService.ts` — wyłącznie, jeśli R1 wprowadza nowy stan pokwitowania: `claimAgentTask` (`:123-144`), `dispatchAgentTask` (`:82-84`), `redriveAgentTask` (`:164-214`). **Zakaz zmian w `identity()` (`:30-39`), `payloadDigest`, `bullJobId` i w `LEASE_SECONDS`** |
| Zapis | `server/src/services/v8/agentResourceGovernanceService.ts` — wyłącznie ścieżka braku polityki (`:196-203`) w zakresie R3; zakaz zmian w logice rezerwacji, idempotencji (`:152-193`), rozliczania i zwalniania |
| Zapis | `server/src/routes/ai/agent-plan.routes.ts` — wyłącznie handler `POST /:id/cancel` (`:836-857`) w zakresie R1 pkt (4). **Zakaz zmian w `tryDispatchBackgroundExecution` (`:174-202`) i w `dispatchKey`** |
| Zapis | NOWY moduł cennika narzędzi (proponowana ścieżka: `server/src/services/ai/toolCostEstimates.ts`) — jeśli wybierzesz ten kształt w R2 |
| Zapis | `server/migrations/<nowa-nazwa>.sql` — **tylko jeśli** R3 wychodzi na wariant migracyjny; addytywna, `IF NOT EXISTS`/`ON CONFLICT DO NOTHING`, nazwa zgodna z `validate-migration-naming.ts` |
| Zapis | testy `day174.*` w `server/src/services/ai/__tests__/` i `server/src/workers/__tests__/` |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY174_STOP_AGENTA_REPORT.md` |
| Odczyt | `server/src/jobs/agentPlanSchedulerJob.ts` — źródło wyścigu opisanego w pułapkach; **nie zmieniasz**, tylko sprawdzasz i opisujesz |
| Odczyt | `server/src/services/ai/sideEffectTools.ts` i `server/src/services/ai/toolDefinitions.ts` — inwentarz narzędzi do cennika; **nie zmieniasz** |
| Odczyt | `server/migrations/20260808_v8_agent_resource_governance.sql` — schemat polityk i rezerwacji; **nie zmieniasz istniejącego pliku** |
| Odczyt | `server/src/scripts/a09*.ts`, `t01InterviewRealDbProof.ts`, `a06AdapterOrchestrationRealDbProof.ts` — 6 skryptów dowodowych; **nie zmieniasz**, służą za dowód braku pisarza |
| Odczyt | `server/scripts/migrationOrdering.ts`, `server/scripts/validate-migration-naming.ts`, `scripts/dev/day161-fresh-migration-check.sh` — reguły migracji; **nie zmieniasz** |
| Odczyt | `server/src/services/ai/__tests__/day165.agent-plan-resume.pg.redis.test.ts` — wzorzec harnessu PG+Redis; **nie zmieniasz** |
| Odczyt | `docs/program/funkcje/ODBIOR_164_AGENT_NIE_WYKONUJE.md`, `ODBIOR_165_AGENT_WZNOWIENIE.md` — źródła defektów; **nie zmieniasz** |
| Odczyt | `src/services/api/agentPlan.api.ts`, `src/components/AIChat/AgentHubShell.tsx` — konsumenci trasy `/cancel`; **nie zmieniasz** |

**Nietykalne imiennie:** `server/src/services/v8/multiAgentWorkManagerService.ts`
(`estimatedCostUsd: 0` uzasadnione komentarzem — inna semantyka rezerwacji);
`server/src/routes/wave8-agents.routes.ts`; `server/src/services/wave8AgentRuntimeService.ts`;
`server/src/services/v8/agentAdapterOrchestratorService.ts`; `vitest.config.ts` w korzeniu
repo (przypięte `DB_TYPE` to własność osobnego dyżuru); `server/vitest.config.ts`
(naprawiony dyżurem 167); wartość `ENABLE_AI_TASKS_WORKER` gdziekolwiek w repo.

★ **Rozłączność z dyżurami działającymi równolegle:** 165 (`agent-plan.routes.ts`
w zakresie `dispatchKey`/`tryDispatchBackgroundExecution`, `AgentPlanPanel.tsx`) — Twoja
licencja na ten plik obejmuje **wyłącznie** handler `/cancel`; 173 (`vitest.config.ts`,
`DecisionDetailView.tsx`, `InitiativeTasksTab.tsx`, `UserTaskList.tsx`,
`InitiativeSidePanel.tsx`, `InitiativeCalendar.tsx`); 172 (`InitiativeDocumentView.tsx`,
`ExceleView.tsx`); 171 (`kpiScorecards/**`, `Economics/**`); 170 (`okr.routes.ts`,
`OkrCheckInRecordDialog.tsx`). Nie dotykasz żadnego z tych plików poza wskazanym wyżej
wyjątkiem.

★ **Pułapka nazw, zweryfikowana w repo:** w `server/src/services/ai/` istnieje **katalog**
`agentPlan` obok **pliku** `agentPlannerService.ts`. To nie jest to samo. Podobnie
`server/src/workers/aiWorker.ts` (Twój) i `server/src/workers/aiWorkerRuntime.ts` (nie Twój —
zawiera drugą definicję stałej `AI_TASKS_WORKER_FLAG`). Nie pomyl ich.

# 5. TWARDE ZASADY

- ★★ **NIE WŁĄCZASZ `ENABLE_AI_TASKS_WORKER` NIGDZIE.** Ani w `.env`, ani w konfiguracji
  wdrożenia, ani jako nowa wartość domyślna w kodzie, ani jako rekomendacja w dokumentacji.
  Ustawiasz ją **wyłącznie w powłoce własnego przebiegu testowego**. Decyzja należy do
  właściciela i zapada po tym dyżurze.
- ★★ **NIE ZMIENIASZ `dispatchKey` ANI MECHANIZMU REPLAY.** `route:${planId}:approval:${N}`
  (`agent-plan.routes.ts:186,190`), `${planId}:wait:${stepIndex}` i `plan.id`
  (`agentPlanSchedulerJob.ts:37,133`) zostają co do znaku — naprawił to dyżur 165 i każda
  zmiana kształtu klucza unieważnia jego dowód.
- ★★ **NIE DOTYKASZ WAVE8 ANI `multiAgentWorkManagerService`.** `estimatedCostUsd: 0`
  w `multiAgentWorkManagerService.ts:457` jest uzasadnione komentarzem w kodzie — to nie jest
  ten sam defekt.
- **Nie zmieniasz semantyki `continue-on-error`** w `executePlan` poza tym, czego wymaga R1
  (wyjście po anulowaniu). Jeśli uznasz, że limit kosztu powinien przerywać plan — zgłoś jako
  osobną pozycję, nie zmieniaj sam.
- **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.** Wszystko na lokalnym
  kontenerze Postgresa i lokalnym Redisie z tej instrukcji.
- **Dowód tylko na realnym Postgresie i realnym Redisie.** Bez `RUN_DB_TESTS=1` dostajesz
  MOCK DB; bez `RUN_REDIS_TESTS=1` i `MOCK_REDIS=false` testy kolejkowe się pomijają.
  **`skipped` i `No test files found` to nie jest `PASS`** — w każdym przywoływanym wyniku
  podaj `numTotalTests` i liczbę uruchomionych przypadków.
- **Każda naprawa ma dowód mutacyjny.** Cofnij samą poprawkę, pokaż czerwony test, przywróć,
  pokaż zielony. Bez tego pozycja nie jest ukończona.
- **Każdą cytowaną linię kodu sprawdzasz sam przed wklejeniem do raportu.** Numery w tej
  instrukcji zweryfikowano wobec markera `d3d36cd5f5`, ale plik żyje.
- ★ Port **5000 jest zajęty na stałe przez macOS Control Center** — nie używaj go do żadnego
  serwera pomocniczego.
- **Sekcja „TWIERDZENIA NIEZWERYFIKOWANE” w raporcie jest obowiązkowa.** Wypisz w niej wprost
  co najmniej: czy sprawdziłeś wyścig scheduler↔anulowanie (pułapka siódma); czy zmierzyłeś
  wszystkie trzy przypadki anulowania z sekcji 1; czy dotknąłeś ścieżki bez `canonicalRunId`,
  a jeśli nie — dlaczego; oraz jak zachowuje się `redriveAgentTask` wobec stanu, który
  wprowadziłeś.
