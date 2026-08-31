# INSTRUKCJA DYŻURU nr 180 — Codex — „Plany agenta tworzone z czatu wchodza pod rezerwacje i limit kosztu, anulowanie w dlugim kroku konczy sie uczciwie, a dlugi krok zostawia slad w logu"

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
> **wyłącznie** `/private/tmp/cx-day180-agent-limity`.

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
Zakres: **Agent planow AI — domkniecie warunkow (3) i (8) odbioru 174 przed wlaczeniem `ENABLE_AI_TASKS_WORKER` na STAGINGU (nie na demo). Marker jest juz PO scaleniu FIX-174**.
Trasy front: `brak zmian po stronie frontu. Odczyt kontekstowy (nie zmieniasz): `src/services/api/agentPlan.api.ts` (wolacze `POST /api/ai/agent-plan` i `POST /:id/cancel`), `src/components/AIChat/AgentHubShell.tsx`, `src/components/AIChat/AgentPlanPanel.tsx``. Trasy tył: ``POST /api/ai/agent-plan` (`server/src/routes/ai/agent-plan.routes.ts:228-334`, tworzy plan BEZ `canonicalRunId`) -> `agentPlannerService.createPlan` (`:364-440`) -> `tryDispatchBackgroundExecution` (`:175`) -> kolejka `ai-tasks`, job `AGENT_BACKGROUND_TASK` -> `server/src/workers/aiWorker.ts:94-121` -> `claimAgentTask`/`finishAgentTask` (`server/src/services/ai/agentTaskDispatchService.ts:123-160`) -> `agentPlannerService.executeBackgroundPlan` (`:1040-1094`, egzekutor `:1063-1093`) -> `executeWithAgentResourceReservation` (`server/src/services/v8/agentResourceGovernanceService.ts:375-437`) -> `reserveAgentResource` (`:120-373`, wymagania zakresu `:137-139`, leniwy INSERT polityki `:205-227`, limity `:240-262`) -> `withPgTransaction` (`server/src/utils/queryHelpers.ts:244-260`); petla `executePlan` (`:481-680`) + dzierzawa `renewExecutionLease` (`:319-331`) / `finalizePlan` (`:1147-1178`) / `releaseCancelledExecutionLease` (`:1237-1250`); `POST /api/ai/agent-plan/:id/cancel` (`:836-858`) -> `cancelPlan` (`:849-857`); cron `server/src/jobs/agentPlanSchedulerJob.ts`; cennik `server/src/services/ai/toolCostEstimates.ts`; migracje `server/migrations/20260808_v8_agent_resource_governance.sql`, `672_enterprise_agent_planner.sql`, `073_conversations.sql``.

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
WT=/private/tmp/cx-day180-agent-limity
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
git -C "$VAULT" worktree add "$WT" -b codex/day180-agent-limity-20260830 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day180-agent-limity/config.worktree"
cat "$VAULT/worktrees/cx-day180-agent-limity/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day180-agent-limity-scratch
mkdir -p /private/tmp/cx-day180-agent-limity-artefakty

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
git -C "$WT" push github-backup codex/day180-agent-limity-20260830
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 18661cc6a0..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `osiem` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day180-agent-limity

# (T1) GALAZ UCIECZKI BEZ canonicalRunId — ZLY ADRES W ZLECENIU, SPRAWDZ SAM
sed -n '1051,1071p' server/src/services/ai/agentPlannerService.ts
sed -n '143p'      server/src/services/ai/agentPlannerService.ts
#   oczekiwane: :1051-1058 to SELECT `resourceScope` z `transformation_cases`,
#   :1059-1061 to `throw new Error('planner_resource_project_scope_missing')`,
#   a WLASCIWA galaz ucieczki to :1063-1071 — `if (!plan.canonicalRunId) return
#   executeToolCall(...)`. Druga, blizniacza ucieczka: `:143` w `executeGovernedEnqueue`.
#   ★ Zlecenie nadzorcy podawalo "~:1052-1058" — to jest BLAD. Popraw go w raporcie.

# (T1b) KTO W OGOLE MA canonicalRunId — CZY PRODUKT GO USTAWIA?
grep -rn "canonicalRunId" --include='*.ts' server/src/routes/ai/agent-plan.routes.ts
grep -rn "createPlan({" -A 8 --include='*.ts' server/src/routes/ai/agent-plan.routes.ts | grep -n "canonicalRunId" || echo "BRAK canonicalRunId w trasie tworzenia planu"
grep -rln "canonicalRunId" --include='*.ts' server/src/scripts/ | head
#   oczekiwane: trasa `POST /api/ai/agent-plan` (`:307-315`) NIE przekazuje
#   `canonicalRunId`; jedyny wolacz, ktory go podaje, to skrypt dowodowy
#   `server/src/scripts/a01A02CanonicalRunRealDbProof.ts:209`.
#   ★ Wniosek do potwierdzenia zapytaniem na WLASNEJ bazie po utworzeniu planu:
#   `SELECT canonical_run_id FROM ai_agent_plans` = NULL. Czyli KAZDY plan z czatu
#   biegnie dzis poza limitami. To jest warunek (3) odbioru 174.

# (T2+T3) CZEGO WYMAGA REZERWACJA I CZY KLUCZ ZAKRESU MA KLUCZ OBCY
sed -n '137,143p' server/src/services/v8/agentResourceGovernanceService.ts
sed -n '1,40p'    server/migrations/20260808_v8_agent_resource_governance.sql
sed -n '8,32p'    server/migrations/672_enterprise_agent_planner.sql
sed -n '9,16p'    server/migrations/073_conversations.sql
#   oczekiwane: `requireNonBlank(input.projectId, 'resource_project_required')` (:138)
#   i `requireNonBlank(input.runId, 'resource_run_required')` (:139) — oba OBOWIAZKOWE.
#   W `v8_agent_resource_policies` i `v8_agent_resource_reservations` kolumna
#   `project_id TEXT NOT NULL` NIE MA klucza obcego do `projects` (jedyny FK w tym
#   pliku to `policy_id ... REFERENCES v8_agent_resource_policies(policy_id)`).
#   `ai_agent_plans` NIE MA kolumny `project_id` — ma `conversation_id TEXT` BEZ FK.
#   `conversations.project_id TEXT REFERENCES projects(id) ON DELETE SET NULL` jest
#   NULLOWALNE. ★ Sprawdz tez, czy istnieje DRUGA tabela rozmow (`ai_conversations`).

# (T4) JAK LICZY SIE WSPOLBIEZNOSC, A JAK KOSZT
sed -n '240,262p' server/src/services/v8/agentResourceGovernanceService.ts
sed -n '46,51p'   server/src/services/v8/agentResourceGovernanceService.ts
#   oczekiwane: `COUNT(*) FILTER (WHERE status = 'reserved')` liczone dla pary
#   (organization_id, project_id) BEZ filtra po `run_id` — czyli wspolbieznosc jest
#   WSPOLNA dla calego klucza zakresu; koszt sumuje sie `FILTER (WHERE run_id = ?)`
#   — czyli per przebieg. Domyslne: 4 / 0.25 USD / 300 s (`:48-50`).
#   ★ Skutek do policzenia w raporcie: jeden wspolny klucz zakresu dla wszystkich
#   planow z czatu w organizacji dzieli miedzy nie limit 4.

# (T5) CZY REZERWACJA DZIALA POZA POSTGRESEM
sed -n '244,262p' server/src/utils/queryHelpers.ts
sed -n '146,152p' server/src/services/v8/agentResourceGovernanceService.ts
#   oczekiwane: `withPgTransaction` tworzy `new PgClient(databaseConfig.postgres)`
#   i wola `client.connect()` BEZ SPRAWDZENIA `DB_TYPE`; rezerwacja uzywa
#   `pg_advisory_xact_lock`. ★ Wniosek: przepuszczenie planow z czatu przez
#   rezerwacje CZYNI WYKONANIE PLANU Z CZATU ZALEZNYM OD POSTGRESA. Rozstrzygnij
#   swiadomie: fail-closed czy fail-open (i czym jest sterowane).

# (T6) OKNO (b) — ANULOWANIE W KROKU DLUZSZYM NIZ TYK HEARTBEATU
sed -n '129,131p'   server/src/services/ai/agentPlannerService.ts
sed -n '319,331p'   server/src/services/ai/agentPlannerService.ts
sed -n '577,594p'   server/src/services/ai/agentPlannerService.ts
sed -n '621,627p'   server/src/services/ai/agentPlannerService.ts
sed -n '1155,1172p' server/src/services/ai/agentPlannerService.ts
sed -n '110,120p'   server/src/workers/aiWorker.ts
#   oczekiwane: `heartbeatIntervalMs = 60_000`, `executionLeaseSeconds = 300` (:129-130);
#   `renewExecutionLease` ma w WHERE `status = 'executing'` (:325) — po anulowaniu
#   rzuca `AgentExecutionLeaseLostError`; blad heartbeatu jest ZAPAMIETYWANY, nie
#   rzucany od razu (:577-582), i leci dopiero po powrocie narzedzia (:593);
#   `catch` kroku przepuszcza go dalej (:621-626), wiec `finalizePlan` — a z nim
#   galaz `cancelled` z FIX-174 (:1160-1170) — NIE ZOSTAJE ZAWOLANE;
#   `aiWorker.ts:117-119` zamyka pokwitowanie `FAILED`.
#   ★ Trzy fakty do zmierzenia OSOBNO, zanim cokolwiek naprawisz: status planu,
#   status+przyczyna pokwitowania, oraz TRZY kolumny dzierzawy (czy przeciekly).

# (T6b) CZY CZAS KROKU MA JAKIEGOKOLWIEK KONSUMENTA
grep -n "duration_ms\|durationMs" server/src/services/ai/agentPlannerService.ts
grep -n "logger\." server/src/services/ai/agentPlannerService.ts
sed -n '119p' server/src/routes/ai/agent-plan.routes.ts
#   oczekiwane: `duration_ms` zapisywane w obu zakonczeniach kroku (:604-606, :636-638),
#   ale JEDYNY `logger.` w calym pliku to `:1321` (retry narzedzia) — zero progu,
#   zero ostrzezenia, zero metryki. `MAX_STEPS_PER_PLAN = 12; // ... F6 doda
#   timeout/budzet realny` — timeoutu w tym dyzurze NIE ROBISZ.
```

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day180-agent-limity-20260830` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6089`. Twój JEDYNY port harnessu to `5030 i 5031`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day180-pg`**. **ZAKAZANE:** `6012, 5433, 6047, 6054-6067, 6068-6088 oraz 5010-5029 (dyzury 170-179 wraz z odbiorami i FIX-ami), 6404-6407 (Redis wczesniejszych dyzurow agenta), 6090-6092 i 5032-5037 (rownolegla partia 181-183), 6094-6096 i 5040-5045 (rownolegla partia 185-187). ★ TWOJ REDIS: kontener `cx-day180-redis`, port **6408** — testy R1 i R2 wymagaja REALNEGO Redisa (`RUN_REDIS_TESTS=1`, `MOCK_REDIS=false`), bez niego sie POMIJAJA, a `skipped` to nie `PASS`. ★ PORT 5000 ZAJETY NA STALE przez macOS Control Center`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `Brak nowych flag wizualnych. ★ `ENABLE_AI_TASKS_WORKER` pozostaje NIEZMIENIONA w repo — ustawiasz ja WYLACZNIE w powloce wlasnego przebiegu testowego (`ENABLE_AI_TASKS_WORKER=true npx vitest ...`), nigdy w pliku, nigdy w `.env`, nigdy jako nowa wartosc domyslna w kodzie, nigdy jako rekomendacja w dokumentacji. Wlasciciel zdecydowal 'TAK-Z-WARUNKAMI, wylacznie staging' — flage stawia nadzorca w srodowisku PO tym dyzurze. ★ Dyzur DOPUSZCZA maksymalnie DWIE nowe zmienne srodowiskowe, obie z bezpieczna wartoscia domyslna W KODZIE i obie obowiazkowo wypisane w raporcie z nazwa i wartoscia domyslna: (a) prog ostrzezenia o dlugim kroku dla R3 (propozycja domyslna 120000 ms); (b) odstep heartbeatu dla R2, TYLKO jesli nie znajdziesz kształtu testu bez niej (wartosc domyslna MUSI zostac 60000). Kazda inna nowa zmienna = przekroczenie zakresu`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY180_AGENT_LIMITY_REPORT.md`. Nie zmieniasz zadnego `MODULE_ACCEPTANCE.md`. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day180-agent-limity-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day180-agent-limity-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **NIE WLACZASZ `ENABLE_AI_TASKS_WORKER` NIGDZIE** — ani w `.env`, ani w konfiguracji wdrozenia, ani jako nowa wartosc domyslna w kodzie, ani jako rekomendacja w dokumentacji. Wylacznie w powloce wlasnego przebiegu testowego. ★★ **NIE ROZSTRZYGASZ WARUNKU (6) ODBIORU 174** — fail-open leniwego `INSERT`-u polityki (`agentResourceGovernanceService.ts:205-227`) dla `wave8AgentRuntimeService`, `multiAgentWorkManagerService` i `agentAdapterOrchestratorService`. To decyzja wlasciciela. **Nie zmieniasz samego leniwego INSERT-u**; masz jedynie NIE POWIEKSZYC promienia razenia i opisac, co Twoja zmiana z nim robi. ★★ **NIE ROBISZ TIMEOUTU KROKU ANI BUDZETU TOKENOW (F6).** R3 to WYLACZNIE `logger.warn`. Nie przerywasz kroku, nie ustawiasz `AbortSignal`, nie zmieniasz statusu kroku ani planu. W raporcie napisz wprost, ze warunek (7) odbioru 174 zostaje zamkniety tylko w czesci monitoringowej. ★★ **NIE ZMIENIASZ CENNIKA `server/src/services/ai/toolCostEstimates.ts`** — jest wyczerpujacy i zamkniety po FIX-174 (kazde narzedzie wycenione lub wyzerowane z uzasadnieniem, nieznane RZUCA `unknown_tool_cost`). Jesli Twoja zmiana wymaga nowej pozycji, ZGLOS ja w raporcie z uzasadnieniem ceny, zamiast dopisywac. ★★ **NIE ZMIENIASZ `dispatchKey` ANI MECHANIZMU REPLAY** — `route:${planId}:approval:${N}`, `${planId}:wait:${stepIndex}`, `plan.id`, ani `identity()`/`payloadDigest`/`bullJobId`/`LEASE_SECONDS` w `agentTaskDispatchService.ts` (wlasnosc dyzuru 165, kazda zmiana ksztaltu klucza uniewaznia jego dowod). ★★ **NIE DOTYKASZ WAVE8 ANI `multiAgentWorkManagerService`** ani szesciu skryptow dowodowych `a06*`/`a09*`/`t01*` (wpisuja polityki same i sa dowodem historycznym; jesli Twoja zmiana je psuje, to znak, ze jest za szeroka). ★★ **`Z31`: ZAKAZ PRZYPINANIA TESTU DO NAZWY BAZY, PORTU ALBO HOSTA** — to byl **CZWARTY** taki incydent w programie (ERRATA odbioru 174 pkt 4: `day164.agent-dispatch-map.test.ts:80` przypiety do `cx164:6052`, jedyny straznik semantyki pokwitowania martwy poza tamta maszyna). `assertRealPostgresTestEnvironment()` wolasz BEZ ARGUMENTOW; nazwa bazy i port wchodza wylacznie przez `DATABASE_URL` z powloki. ★★ **ZAKAZ `git stash`** — dowod mutacyjny robisz jawna edycja i jawnym cofnieciem albo `git diff` zapisanym do pliku w katalogu artefaktow. ★★ **ZAKAZ WYJSCIA TESTOW DO SIECI** — prog polityki w tescie R1 dobierz tak, zeby odmowa padla PRZED wykonaniem narzedzia (rezerwacja odmawia przed `execute()`, `agentResourceGovernanceService.ts:394-401`). **Zero polaczen do bazy zdalnej, demo, stagingu i produkcji** — wszystko na lokalnym kontenerze `cx-day180-pg` (port 6089) i lokalnym Redisie `cx-day180-redis` (port 6408). | Odbior 174 (`docs/program/funkcje/ODBIOR_174_STOP_AGENTA.md`) odpowiedzial na pytanie K6 sciezki wyjscia: `ENABLE_AI_TASKS_WORKER` **TAK-Z-WARUNKAMI, wylacznie staging**. Piec z osmiu warunkow zamknal FIX-174 (jest w markerze tego dyzuru). Zostaly trzy, z czego DWA sa robota inzynierska i to jest ten dyzur: **(3) sciezka bez `canonicalRunId` — czyli plany tworzone z czatu — biegnie CALKOWICIE poza rezerwacja, kosztem i wspolbieznoscia**, oraz **(8) niezmierzony przypadek (b): anulowanie w kroku dluzszym niz 60 s**. Waga warunku (3) jest wieksza, niz wygladala: trasa `POST /api/ai/agent-plan` NIE przekazuje `canonicalRunId`, wiec **kazdy plan uzytkownika ma `canonical_run_id = NULL`** — a to znaczy, ze wszystkie dowody limitow z dyzuru 174 dotycza sciezki, ktorej produkt dzis nie uzywa. Warunek (8) to niespojnosc, ktora widzi uzytkownik: ten sam przycisk 'Anuluj' konczy plan `cancelled` z pokwitowaniem SUCCEEDED, gdy krok trwal 59 s, i `FAILED` z klamliwa przyczyna 'utracono dzierzawe' plus przeciekla dzierzawa ~5 minut, gdy trwal 61 s. Warunek (7) — timeout kroku (F6) — zostaje POZA zakresem; zamykamy go wylacznie w czesci monitoringowej (jeden log ostrzegawczy). Warunek (6) — fail-open leniwego INSERT-u polityki dla trzech serwisow — jest DECYZJA WLASCICIELA i nie ruszasz go |

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
cd /private/tmp/cx-day180-agent-limity

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day180-pg psql -U postgres -d cx180 \
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
cd /private/tmp/cx-day180-agent-limity

docker run -d --name cx-day180-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx180 \
  -p 127.0.0.1:6089:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day180-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6089/cx180 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6089/cx180 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day180-agent-limity && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6089/cx180 \
JWT_SECRET=cx180-test-secret-do-not-reuse \
npx vitest run server/src/services/ai/__tests__ oraz server/src/workers/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day180-agent-limity-artefakty/day180-vitest.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day180-agent-limity && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/services/ai/__tests__ oraz server/src/workers/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day180-agent-limity-artefakty/day180-vitest.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day180-agent-limity/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day180-pg psql -U postgres -d cx180 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day180-pg`.
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
> **(e) ★★ **Pierwsza, i to jest sedno R1: zlecenie nadzorcy podalo ZLY ADRES gałęzi.** Zlecenie mowilo `~:1052-1058` — tam jest SELECT `resourceScope` z `transformation_cases` (`:1051-1058`) i `throw new Error('planner_resource_project_scope_missing')` (`:1059-1061`). Wlasciwa galaz ucieczki to **`:1063-1071`**, a jej bliznaczka to **`:143`** w `executeGovernedEnqueue`. Sprawdz oba adresy sam i **wpisz korekte do raportu** — to jest przypomnienie, ze numery sie sprawdza, a nie przepisuje. ★★ **Druga: sciezka kanoniczna, ktora dyzur 174 udowodnil, jest w produkcie MARTWA.** Trasa `POST /api/ai/agent-plan` (`:307-315`) nie przekazuje `canonicalRunId`; jedyny wolacz, ktory go podaje, to skrypt dowodowy `server/src/scripts/a01A02CanonicalRunRealDbProof.ts:209`. Potwierdz to zapytaniem na WLASNEJ bazie (`SELECT canonical_run_id FROM ai_agent_plans`), nie gerpem — i dopiero wtedy projektuj. ★★ **Trzecia: rezerwacja WYMAGA dwoch wartosci, ktorych plan z czatu nie ma.** `requireNonBlank(projectId, 'resource_project_required')` (`:138`) i `requireNonBlank(runId, 'resource_run_required')` (`:139`). `ai_agent_plans` (`server/migrations/672_enterprise_agent_planner.sql:8-27`) **nie ma kolumny `project_id`** — ma `conversation_id TEXT`, i to **BEZ klucza obcego**. Jedyny dostepny projekt to `conversations.project_id` (`server/migrations/073_conversations.sql:13`, `TEXT REFERENCES projects(id) ON DELETE SET NULL`) — **nullowalny**. ★ I pulapka w pulapce: skoro `conversation_id` nie ma FK, **nie wiadomo z schematu, czy wskazuje na `conversations`, czy na `ai_conversations` — OBIE TABELE ISTNIEJA** (`073_conversations.sql:9` i `900_prod_missing_tables_hotfix.sql:915`). Zmierz to na zywej bazie po utworzeniu planu z czatu. ★★ **Czwarta: klucz zakresu NIE MA klucza obcego, wiec sztuczny klucz jest mozliwy — ale ma cene.** Ani `v8_agent_resource_policies.project_id`, ani `v8_agent_resource_reservations.project_id` nie odwoluja sie do `projects` (jedyny FK w migracji to `policy_id`). ALE: wspolbieznosc liczy sie `COUNT(*) FILTER (WHERE status = 'reserved')` dla pary (org, projekt) **BEZ filtra po `run_id`** (`:240-252`), a koszt `FILTER (WHERE run_id = ?)`. Jeden wspolny klucz zakresu dla wszystkich planow z czatu w organizacji **dzieli miedzy nie `max_concurrent_executions` = 4** (`:48`). Policz to wprost w raporcie. I nie zaklada, ze `projects.id` to UUID — jest `TEXT` (`000_initdb_core_tables.sql:82-83`), wiec kolizje sztucznego klucza **udowodnij zapytaniem**, nie zalozeniem. ★★ **Piata: Twoja zmiana czyni plany z czatu ZALEZNYMI OD POSTGRESA.** `withPgTransaction` (`server/src/utils/queryHelpers.ts:244-260`) tworzy `new PgClient(...)` i wola `connect()` **niezaleznie od `DB_TYPE`**, a rezerwacja uzywa `pg_advisory_xact_lock` (`:148-152`). To jest skutek produktowy: przy `DB_TYPE=sqlite` wykonanie planu z czatu przestanie dzialac tak, jak dzis dziala. Odpowiedz w raporcie: co sie dzieje na sqlite, czy padaja istniejace testy, i czy wybierasz fail-closed czy fail-open. **Fail-open bez jawnej, domyslnie bezpiecznej zmiennej jest zakazany.** ★★ **Szosta, dla R1: `idempotencyKey` musi byc rozlaczny i deterministyczny.** Sciezka kanoniczna uzywa `planner:${canonicalRunId}:${operationKey}` (`:1079`), gdzie `operationKey = agent-plan:${planId}:step:${step.id}` (`:576`). Kolizja ksztaltu konczy sie `resource_idempotency_scope_mismatch` (`:171`) albo — gorzej — cichym zaliczeniem cudzej rezerwacji. Szacunek kosztu musi byc staly przez zycie kroku: `resource_idempotency_cost_mismatch` (`:174`) rzuca, gdy ten sam klucz wraca z inna kwota. ★★ **Siodma, dla R1: `agent_plan.enqueue` NIE ISTNIEJE w cenniku.** Jesli rozszerzysz R1 na `executeGovernedEnqueue`, pamietaj, ze koszt jest tam wpisany na sztywno `estimatedCostUsd: 0` (`:157`), a `estimateAgentToolCostUsd('agent_plan.enqueue')` **rzuciloby `unknown_tool_cost`**. Nieruszanie tej sciezki jest dopuszczalnym wynikiem — pod warunkiem, ze napiszesz to wprost. ★★ **Osma, dla R2: okno (b) omija naprawe z FIX-174.** Blad heartbeatu jest **zapamietywany** (`:577-582`), a nie rzucany od razu; leci dopiero po powrocie narzedzia (`:593`) i `catch` kroku przepuszcza go dalej (`:621-626`) — wiec `finalizePlan` (`:1147-1178`) i jego galaz `cancelled` (`:1160-1170`) **nigdy nie zostaja zawolane**. Skutek: pokwitowanie `FAILED` z klamliwa przyczyna I **przeciekla dzierzawa** — dokladnie ta sama, ktora ERRATA odbioru 174 opisala dla okna a2. ★★ **Dziewiata, tez dla R2: zwolnienie dzierzawy moze samo poleciec.** `releaseCancelledExecutionLease` (`:1237-1250`) idzie przez `guardedPlanRun`, ktorego predykat wymaga `execution_lease_expires_at > datetime('now')` (`:334-337`). Jesli dlugi krok trwal dluzej niz `executionLeaseSeconds = 300` od ostatniego UDANEGO odnowienia, dzierzawa juz wygasla i to zwolnienie **samo rzuci `AgentExecutionLeaseLostError`**. Rozstrzygnij ten przypadek swiadomie. ★★ **Dziesiata, testowa i najkosztowniejsza: dowody dyzuru 174 NIE dotykaja sciezki, ktora zmieniasz.** `day174.agent-plan-cancel.pg.redis.test.ts:58-66` **podmienia `executeBackgroundPlan` przez `vi.spyOn(...).mockImplementation`** — czyli nigdy nie wchodzi do egzekutora. `day174.agent-resource-policy.pg.redis.test.ts` wola `reserveAgentResource` **bezposrednio**, z pominieciem planu. Twoj test R1 **nie moze** mockowac `executeBackgroundPlan` ani wolac rezerwacji na skroty; ma isc przez plan. ★★ **Jedenasta, testowa dla R2: test musi UDOWODNIC, ze przeszedl przez okno (b).** Krok 'dlugi' to krok dluzszy niz `heartbeatIntervalMs` (60 s, `:130`, `private readonly`). Test czekajacy 60 s jest testem, ktorego nikt nie uruchomi; test krotszy niz tyk heartbeatu mierzy okno (a)/(a2), czyli **naprawe z dyzuru 174, nie Twoja**. Musisz udowodnic, ze heartbeat faktycznie tyknal i faktycznie polegl w trakcie kroku. ★★ **Dwunasta: `DB_TYPE` jest przypiety w `vitest.config.ts` w korzeniu repo** — dla testow backendowych uzywasz `server/vitest.config.ts` (naprawiony dyzurem 167). Bez `RUN_DB_TESTS=1` dostajesz MOCK DB; bez `RUN_REDIS_TESTS=1` i `MOCK_REDIS=false` testy kolejkowe sie POMIJAJA. **`No test files found` i `skipped` to NIE jest `PASS`** — sprawdzaj `numTotalTests` i liczbe faktycznie uruchomionych przypadkow. Odbior 174 sprostowal raport wykonawcy dokladnie na tym: '5/5 PASS, 0 pending' wobec realnych **7 total: 5 pass, 2 PENDING** — i to dokladnie tych dwoch, ktore strzegly zmienionej linii. ★★ **Trzynasta, nazewnicza:** w `server/src/services/ai/` istnieje **katalog** `agentPlan` obok **pliku** `agentPlannerService.ts`; w `server/src/workers/` jest `aiWorker.ts` (Twoj) i `aiWorkerRuntime.ts` (nie Twoj, z druga definicja stalej flagi workera). Nie pomyl ich.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day180-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day180-agent-limity-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`pozycje R1 i R2 — plan tworzony z czatu realnie wchodzi pod rezerwacje i limit kosztu (widoczna odmowa, nie cisza), a anulowanie w kroku dluzszym niz tyk heartbeatu konczy sie planem `cancelled`, uczciwie zamknietym pokwitowaniem i zwolniona dzierzawa. R3 (log ostrzegawczy) jest najtansza pozycja i idzie ostatnia`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6089` albo `5030 i 5031` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6089` albo `5030 i 5031`** (`Z7`).

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

Odbiór dyżuru 174 (`docs/program/funkcje/ODBIOR_174_STOP_AGENTA.md`) odpowiedział na
pytanie K6 ścieżki wyjścia — **`ENABLE_AI_TASKS_WORKER` na TAK, ale z warunkami i
wyłącznie na stagingu**. Pięć z ośmiu warunków zamknął FIX-174 (scalony w markerze
tego dyżuru). Zostały trzy, z czego **dwa są robotą inżynierską i to jest ten dyżur**:

> (3) **ścieżka bez `canonicalRunId` (plany z czatu!) poza rezerwacją/limitem** —
> dyżur 180; (6) decyzja właściciela o fail-open dla 3 serwisów; (7) brak timeoutu
> kroku (F6, świadomie poza zakresem — włączać tylko z monitoringiem); (8) pomiar
> przypadku (b) krok>60 s — dyżur 180.

Warunek (6) jest decyzją właściciela, nie Twoją — **nie ruszasz go**. Warunek (7)
zamykasz tylko w części „monitoring", i to jawnie mniejszej niż timeout.

## Defekt 1 — plany tworzone z czatu w ogóle nie wchodzą pod limity

Cała maszyneria rezerwacji zasobów (współbieżność, koszt, dzierżawa) jest w kodzie
włączona **wyłącznie dla planów, które mają `canonicalRunId`**. Egzekutor narzędzi
w `executeBackgroundPlan` zaczyna się od bezwarunkowej ucieczki
(`server/src/services/ai/agentPlannerService.ts:1063-1071`):

```ts
const executor: PlanToolExecutor = async (toolName, input, execution) => {
  if (!plan.canonicalRunId) {
    return executeToolCall(toolName, input, {
      organizationId: payload.organizationId,
      userId: payload.userId,
      conversationId: plan.conversationId,
      sessionId: execution?.operationKey,
    });
  }
  const resourceExecution = await executeWithAgentResourceReservation({ /* ... */ });
```

★ **Korekta wobec zlecenia nadzorcy:** zlecenie wskazywało „gałąź ~:1052-1058".
To jest zły adres — `:1051-1058` to zapytanie `resourceScope` o `project_id`
z `transformation_cases`, a `:1059-1061` to `throw new Error(
'planner_resource_project_scope_missing')`. Gałąź ucieczki to **`:1063-1071`**.
Numery zweryfikuj sam — plik żyje.

Bliźniacza ucieczka jest w `executeGovernedEnqueue` (`:143`):

```ts
if (!plan.canonicalRunId) return { replayed: false, result: await input.enqueue() };
```

Kto ma `canonicalRunId`? **Nikt z produktu.** Jedynym miejscem w repo, które podaje
`canonicalRunId` do `agentPlannerService.createPlan`, jest skrypt dowodowy
`server/src/scripts/a01A02CanonicalRunRealDbProof.ts:209`. Trasa produkcyjna
`POST /api/ai/agent-plan` (`server/src/routes/ai/agent-plan.routes.ts:307-315`)
**nie przekazuje go w ogóle** — kolumna `canonical_run_id` zostaje `NULL`
(`agentPlannerService.ts:404,417`). To znaczy dosłownie: **każdy plan, jaki użytkownik
utworzy z czatu, biegnie poza limitami, a wszystkie dowody z dyżuru 174 dotyczą
ścieżki, której produkt dziś nie używa.**

To nie jest hipoteza tego dyżuru — to jest treść warunku (3) z odbioru 174.

## Defekt 2 — anulowanie w długim kroku kończy się kłamstwem

FIX-174 zamknął dwa z trzech okien anulowania: (a) sprawdzenie statusu na początku
każdej iteracji pętli (`agentPlannerService.ts:506-514`) i (a2) gałąź `cancelled`
w `finalizePlan` (`:1160-1170`). Trzecie okno — **(b), anulowanie w trakcie kroku
trwającego dłużej niż jeden tyk heartbeatu** — nie było mierzone i **nie jest
domknięte**. Mechanika, którą zmierzysz sam:

1. `heartbeatIntervalMs = 60_000`, `executionLeaseSeconds = 300`
   (`agentPlannerService.ts:129-130`).
2. Wokół każdego kroku pętla stawia `setInterval` odnawiający dzierżawę
   (`:577-582`), a błąd odnowienia **zapamiętuje w zmiennej**, nie rzuca od razu.
3. `renewExecutionLease` (`:319-331`) ma w `WHERE` warunek `status = 'executing'`.
   Po `cancelPlan` status to `cancelled`, więc `result.changes = 0` i leci
   `AgentExecutionLeaseLostError`.
4. Po powrocie narzędzia `if (heartbeatFailure) throw heartbeatFailure;` (`:593`).
5. `catch` kroku przepuszcza ten wyjątek dalej (`:621-626`), więc **`finalizePlan`
   nigdy nie zostaje zawołane** — gałąź `cancelled` z FIX-174 jest w tym oknie
   martwa.
6. `aiWorker.ts:117-119` łapie, woła `finishAgentTask(receiptId, workerId, false, error)`
   i przerzuca błąd dalej.

Skutek, który masz potwierdzić pomiarem, zanim cokolwiek naprawisz: plan ma status
`cancelled`, ale **pokwitowanie kończy `FAILED` z przyczyną „utracono dzierżawę"**,
a kolumny dzierżawy (`execution_owner_token`, `execution_fencing_token`,
`execution_lease_expires_at`) **zostają nietknięte** — nikt ich nie czyści, bo ani
`finalizePlan`, ani `releaseCancelledExecutionLease` (`:1237-1250`) nie zostały
zawołane. To jest **dokładnie ta sama przeciekła dzierżawa, którą ERRATA odbioru 174
opisała dla okna a2** — FIX-174 zamknął ją w a2 i zostawił w (b).

Dla porównania: w oknach (a) i (a2) pokwitowanie kończy `SUCCEEDED`, bo
`aiWorker.ts:111-116` traktuje `cancelled` jak zakończenie zgodne z żądaniem.
**Dwa różne wyniki dla tego samego przycisku, zależne od tego, czy krok trwał
59 czy 61 sekund.** Spójność tych dwóch zachowań jest pozycją R2.

## Defekt 3 — czas kroku jest mierzony, ale nikt go nie czyta

`duration_ms` jest liczone i zapisywane dla obu zakończeń kroku:
`:594,598,604-606` (sukces) i `:627,630,636-638` (porażka). **Nie ma jednak żadnego
konsumenta tej liczby** — ani progu, ani ostrzeżenia, ani metryki. Jedyny `logger`
w całym pliku to `:1321` (retry narzędzia). Właściciel zgodził się włączyć flagę
„tylko z monitoringiem" (warunek 7 odbioru 174) — a monitoringu nie ma.

Kod sam przyznaje się do braku timeoutu:
`agent-plan.routes.ts:119` — `const MAX_STEPS_PER_PLAN = 12; // koncept sekcja 1
"Limity (twarde)" — F6 doda timeout/budżet realny`. **Timeoutu w tym dyżurze NIE
robisz.** Robisz jedno ostrzeżenie logowe przy przekroczeniu progu i nic więcej.

## Czym ten dyżur NIE jest

Nie jest włączeniem `ENABLE_AI_TASKS_WORKER` — właściciel powiedział „TAK-Z-WARUNKAMI,
wyłącznie staging", a flagę stawia nadzorca w środowisku, nie Ty w repo.
Nie jest timeoutem kroku ani budżetem tokenów (F6) — R3 to **wyłącznie log
ostrzegawczy**. Nie jest rozstrzygnięciem warunku (6) odbioru 174 (fail-open leniwego
`INSERT`-u polityki dla `wave8AgentRuntimeService`, `multiAgentWorkManagerService`
i `agentAdapterOrchestratorService`) — **to decyzja właściciela**; Twoim zadaniem jest
co najwyżej **nie powiększyć** promienia rażenia i opisać, co Twoja zmiana z nim robi.
Nie jest zmianą `dispatchKey` ani mechanizmu replay (własność dyżuru 165). Nie jest
zmianą cennika z FIX-174 (`toolCostEstimates.ts`) — cennik jest zamknięty i wyczerpujący;
jeśli Twoja zmiana wymaga nowej pozycji, **zgłoś to jawnie, z uzasadnieniem ceny**.

# 2. TEZY ZLECENIA

- **T1.** Gałąź ucieczki bez `canonicalRunId` jest w `agentPlannerService.ts:1063-1071`
  (nie `:1052-1058`, jak mówiło zlecenie), a bliźniacza w `executeGovernedEnqueue:143`.
  Sprawdź oba adresy w kodzie, nie z tego opisu.
- **T2.** `reserveAgentResource` **wymaga niepustych** `projectId` (`:138`) i `runId`
  (`:139`), a plan z czatu nie ma żadnego z nich: `ai_agent_plans`
  (`server/migrations/672_enterprise_agent_planner.sql:8-27`) **nie ma kolumny
  `project_id`**, ma tylko `conversation_id` — i to **bez klucza obcego**.
- **T3.** Ani `v8_agent_resource_policies.project_id`, ani
  `v8_agent_resource_reservations.project_id` **nie mają klucza obcego do `projects`**
  (`server/migrations/20260808_v8_agent_resource_governance.sql`). Klucz zakresu jest
  wolnym tekstem — sztuczny klucz zakresu jest technicznie możliwy, ale niesie skutek
  z T4.
- **T4.** Współbieżność liczy się **per para (organizacja, projekt), przez wszystkie
  przebiegi** (`agentResourceGovernanceService.ts:240-252` — `COUNT(*) FILTER
  (WHERE status = 'reserved')` bez filtra po `run_id`), a koszt **per `run_id`**
  (`COALESCE(SUM(...)) FILTER (WHERE run_id = ?)`). Jeden wspólny klucz zakresu dla
  wszystkich planów z czatu w organizacji **dzieli między nie `max_concurrent_executions`**.
  Zmierz i rozstrzygnij świadomie.
- **T5.** Rezerwacja jest **Postgres-only**: `withPgTransaction`
  (`server/src/utils/queryHelpers.ts:244-260`) zakłada `new PgClient(...)` i
  `client.connect()` **niezależnie od `DB_TYPE`**. Przepuszczenie planów z czatu przez
  rezerwację **czyni wykonanie planu z czatu zależnym od Postgresa**. To jest skutek
  produktowy, nie detal testowy — zmierz go i opisz.
- **T6.** Okno (b) kończy się `AgentExecutionLeaseLostError` **przed** `finalizePlan`,
  więc gałąź `cancelled` z FIX-174 (`:1160-1170`) jest w nim martwa, pokwitowanie
  dostaje `FAILED` z kłamliwą przyczyną, a dzierżawa **przecieka**. Zmierz wszystkie
  trzy fakty osobno, zanim zaczniesz projektować naprawę.

# 3. POZYCJE DYŻURU

## R1 — plan z czatu przechodzi przez rezerwację, koszt i limit

Cel: **plan bez `canonicalRunId` wykonuje kroki przez
`executeWithAgentResourceReservation`, a przekroczenie limitu kosztu jest widoczne**,
nie ciche.

**(1) Rozstrzygnij klucz zakresu polityki (`projectId`) i uzasadnij pomiarem.**
To jest sedno pozycji i najtrudniejsza decyzja tego dyżuru. Rozważ co najmniej trzy
kształty i **wypisz w raporcie, dlaczego odrzuciłeś dwa pozostałe**:

- *(A) projekt z rozmowy, sztuczny klucz jako zapasowy.* `conversations.project_id`
  istnieje (`server/migrations/073_conversations.sql:13`, `TEXT REFERENCES projects(id)
  ON DELETE SET NULL`) i jest **nullowalny**. Zaleta: gdy rozmowa należy do projektu,
  plan trafia pod politykę **tego** projektu — spójnie ze ścieżką kanoniczną. Wada:
  dwa zachowania w jednej ścieżce, a `plan.conversationId` bywa `undefined`
  (kolumna nullowalna, `createPlan` wpisuje `input.conversationId || null`).
  ★ **Pułapka: `conversation_id` w `ai_agent_plans` NIE MA klucza obcego** — nie
  wiadomo z schematu, czy wskazuje na `conversations`, czy na `ai_conversations`
  (**obie tabele istnieją**: `073_conversations.sql:9` i
  `900_prod_missing_tables_hotfix.sql:915`). **Zmierz to, zanim oprzesz na tym
  cokolwiek** — czytaj żywą bazę po utworzeniu planu z czatu, nie kod.
- *(B) jeden sztuczny klucz zakresu na organizację* (np. z prefiksem, który nie może
  być prawdziwym `projects.id`). Zaleta: jedno zachowanie, jedna polityka na
  organizację, czytelna do podglądu w bazie. Wada mierzalna: przez T4 **wszystkie
  plany z czatu w organizacji dzielą `max_concurrent_executions`** (domyślnie 4 —
  `agentResourceGovernanceService.ts:48`). Policz to wprost w raporcie: ile
  równoległych planów z czatu wystarczy, żeby zdrowy plan dostał
  `resource_concurrency_limit_exceeded`.
- *(C) `plan.id` jako klucz zakresu.* Zaleta: pełna izolacja. Wada: **wiersz polityki
  na każdy plan** — tabela polityk przestaje być tabelą polityk i staje się logiem;
  administrator nie ma czego ustawić.

Jeśli wybierzesz sztuczny klucz (B) albo zapasowy w (A), **udowodnij, że nie może
zderzyć się z prawdziwym projektem**: `projects.id` to `TEXT`
(`server/migrations/000_initdb_core_tables.sql:82-83`), a nie UUID — więc „przecież
projekty mają UUID-y" **nie jest dowodem**. Sprawdź to zapytaniem na swojej bazie
i napisz w raporcie, jak wykluczyłeś kolizję.

**(2) Rozstrzygnij `runId`.** Rezerwacja wymaga niepustego (`:139`), a koszt sumuje się
**per `run_id`** (T4). `plan.id` daje budżet na plan i jest stały przez całe jego
życie. Sprawdź, czy `v8_agent_resource_reservations.run_id` nie ma klucza obcego do
`v8_execution_runs` (**wygląda na to, że nie ma** — potwierdź sam), bo plan z czatu
takiego wiersza nie ma i mieć nie będzie.

**(3) `idempotencyKey` musi być rozłączny ze ścieżką kanoniczną i stały przez życie
kroku.** Dziś to `planner:${canonicalRunId}:${operationKey}` (`:1079`), gdzie
`operationKey` = `agent-plan:${planId}:step:${step.id}` (`:576`). Twój klucz dla
ścieżki z czatu **nie może dać tego samego napisu** dla innego zakresu — kolizja
kończy się `resource_idempotency_scope_mismatch` (`:171`) albo, gorzej, cichym
zaliczeniem cudzej rezerwacji. Napisz w raporcie, jak wykluczyłeś kolizję.

**(4) Rozstrzygnij, co z `executeGovernedEnqueue:143`** (bliźniacza ucieczka przy
zakolejkowaniu). Zlecenie mówi o rezerwacji **wykonania**; rozszerzenie na
zakolejkowanie jest dopuszczalne, ale **tylko świadomie i z zapisem**. ★ Pułapka:
tam koszt jest wpisany na sztywno `estimatedCostUsd: 0` (`:157`), a **nazwa
`agent_plan.enqueue` NIE ISTNIEJE w cenniku** z FIX-174 — `estimateAgentToolCostUsd`
rzuciłoby dla niej `unknown_tool_cost` (`server/src/services/ai/toolCostEstimates.ts`).
Jeśli tego nie ruszasz — napisz to wprost, to jest dopuszczalny wynik.

**(5) Zmierz i rozstrzygnij skutek Postgres-only (T5).** Po Twojej zmianie wykonanie
planu z czatu woła `withPgTransaction`. Odpowiedz w raporcie na trzy pytania:
co się dzieje przy `DB_TYPE=sqlite` (dev/testy jednostkowe); czy któryś istniejący
test zaczyna padać; i czy wybierasz zachowanie **fail-closed** (brak Postgresa =
plan nie rusza) czy **fail-open** (brak Postgresa = jak dziś, bez limitu).
**Fail-open bez flagi jest zakazany** — jeśli go chcesz, ma być za jawną, **domyślnie
bezpieczną** zmienną środowiskową, wypisaną w raporcie z nazwą i wartością domyślną.

**(6) Nie powiększaj promienia fail-open leniwego `INSERT`-u.** Leniwy zapis polityki
(`agentResourceGovernanceService.ts:205-227`) auto-provisionuje limity dla **każdego**
wołacza rezerwacji; ERRATA odbioru 174 pkt 3 nazwała to niezmierzonym promieniem
rażenia, a decyzja należy do właściciela (warunek 6). Ty **dokładasz czwartego
wołacza** — napisz w raporcie jednym zdaniem, ile wierszy polityki przybędzie na
organizację po Twojej zmianie w wybranym kształcie zakresu. **Nie zmieniasz samego
leniwego `INSERT`-u.**

**Ukończone, gdy:** masz test na realnym Postgresie i realnym Redisie, w którym plan
utworzony **bez `canonicalRunId`** (czyli dokładnie tak, jak tworzy go trasa
`POST /api/ai/agent-plan`), z polityką o niskim `max_estimated_cost_usd_per_run`,
dostaje **widoczną odmowę**: krok ma `error_message` zawierający
`resource_estimated_cost_limit_exceeded`, w `v8_agent_resource_reservations` jest
wiersz o statusie `denied` z tym `decision_reason`, a narzędzie **nie zostało
wykonane** (sprawdzone po skutku, nie po statusie wiersza). Plus dowód mutacyjny:
przywróć samą ucieczkę `if (!plan.canonicalRunId) return executeToolCall(...)`
i pokaż, że test czerwienieje.

★ **Dwie pułapki testowe, obie zmierzone w dowodach FIX-174 — nie powtórz ich:**
(i) `server/src/services/ai/__tests__/day174.agent-plan-cancel.pg.redis.test.ts:58-66`
**podmienia `executeBackgroundPlan` przez `vi.spyOn(...).mockImplementation`** —
czyli nigdy nie dotyka egzekutora, który zmieniasz. Twój test R1 **nie może** mockować
`executeBackgroundPlan`. (ii) `day174.agent-resource-policy.pg.redis.test.ts` woła
`reserveAgentResource` **bezpośrednio**, z pominięciem planu — dlatego dowód „limit
działa" z dyżuru 174 **nie mówi nic o ścieżce planu**. Twój dowód ma iść przez plan.
(iii) Dobierz próg polityki tak, żeby odmowa padła **na pierwszym kroku**: rezerwacja
odmawia **przed** `execute()` (`agentResourceGovernanceService.ts:394-401`), więc
narzędzie się nie wykona i **żadne zewnętrzne wywołanie nie poleci**. To jest warunek,
nie sugestia — testy nie chodzą do sieci.

## R2 — anulowanie w długim kroku kończy się uczciwie

Cel: **okno (b) ma się kończyć tak samo jak (a) i (a2)** — plan `cancelled`,
pokwitowanie zamknięte uczciwie, dzierżawa zwolniona.

Zanim naprawisz — **zmierz zastany stan i wklej pomiar do raportu**: status planu,
status i `error_code` pokwitowania (`ai_agent_job_receipts`) oraz trzy kolumny
dzierżawy w `ai_agent_plans` po anulowaniu w trakcie długiego kroku.

Rozważ co najmniej dwa kształty i uzasadnij wybór:

- *Obsłużyć `AgentExecutionLeaseLostError` w `executePlan`*: przy wyjątku sprawdzić
  status planu i — gdy `cancelled` — zwolnić dzierżawę oraz zwrócić plan `cancelled`,
  lustrzanie do gałęzi FIX-174 w `finalizePlan:1160-1170`. ★ **Pułapka:**
  `releaseCancelledExecutionLease` (`:1237-1250`) idzie przez `guardedPlanRun`, którego
  predykat wymaga `execution_lease_expires_at > datetime('now')` (`:334-337`). Jeśli
  długi krok trwał dłużej niż `executionLeaseSeconds = 300` **od ostatniego udanego
  odnowienia**, dzierżawa zdążyła wygasnąć i to zwolnienie **samo rzuci
  `AgentExecutionLeaseLostError`**. Rozstrzygnij ten przypadek świadomie i opisz.
- *Rozróżnić w `renewExecutionLease` „anulowano" od „ukradziono dzierżawę"*: dziś
  `WHERE ... status = 'executing' AND owner AND fencing AND lease > now()` (`:322-327`)
  zwija trzy różne przyczyny w jeden wyjątek. ★ **Pułapka:** zdjęcie `status =
  'executing'` z `WHERE` osłabia własność, dla której tam jest (plan w `paused` /
  `awaiting_approval` nie ma odnawiać dzierżawy). Jeśli idziesz tą drogą, **nie zdejmuj
  warunku — dołóż odczyt statusu i osobny typ wyjątku**, i napisz, czym się różni
  od kradzieży dzierżawy.

**Warunek zamknięcia pokwitowania musi zostać spójny.** Dziś `aiWorker.ts:111-116`
zamyka `SUCCEEDED` dla `completed`, `completed_with_errors` i `cancelled`, a `catch`
(`:117-119`) zamyka `FAILED`. Jeśli po Twojej zmianie okno (b) wraca normalną drogą
(zwrócony plan `cancelled`), **nie musisz ruszać `aiWorker`** — sprawdź to i napisz.
Jeśli musisz, obowiązuje reguła z dyżuru 174: **każdy nowy stan pokwitowania trzeba
rozstrzygnąć w trzech czytelnikach** — `claimAgentTask` (`agentTaskDispatchService.ts:
123-144`, dziś tylko `SUCCEEDED` daje `replayed`, reszta rzuca
`AGENT_DISPATCH_CLAIM_CONFLICT`), `dispatchAgentTask` (`:82-83`, lista statusów
dających `REPLAY`) i `redriveAgentTask` (`:164-207`, dziś **wyłącznie `FAILED`** jest
redrivable) — albo świadomie odrzucić z uzasadnieniem.

**Test wymaga sterowalnego heartbeatu.** Krok „długi" w rozumieniu tego okna to krok
dłuższy niż `heartbeatIntervalMs` (dziś 60 s, `:130`, `private readonly`). Test
czekający 60 s jest testem, którego nikt nie uruchomi. Dopuszczalny kształt: **uczynić
odstęp heartbeatu konfigurowalnym zmienną środowiskową z bezpiecznym domyślnym
`60000` w kodzie** i ustawiać ją wyłącznie w powłoce przebiegu testowego. Jeśli
wybierzesz ten kształt — wpisz nazwę i wartość domyślną do raportu (`Z10`). Jeśli
znajdziesz kształt bez nowej zmiennej — tym lepiej, opisz go.

**Ukończone, gdy:** masz test na realnym Postgresie i realnym Redisie, w którym
narzędzie kroku czeka dłużej niż **kilka** odstępów heartbeatu, anulowanie pada
w trakcie tego kroku, i po zakończeniu widać **cztery fakty naraz**: (i) status planu
w bazie to `cancelled`; (ii) pokwitowanie **nie jest** `FAILED` (a jeśli świadomie
wybrałeś inny stan — jest nim, i jest to uzasadnione); (iii) trzy kolumny dzierżawy
w `ai_agent_plans` są wyczyszczone; (iv) **potwierdzone jest, że test przeszedł przez
okno (b)**, a nie przez (a)/(a2) — czyli heartbeat faktycznie tyknął i faktycznie
poległ w trakcie kroku. Bez (iv) test mierzy naprawę z dyżuru 174, nie Twoją.
Plus dowód mutacyjny: cofnij samą obsługę okna (b) i pokaż czerwony test.

## R3 — ostrzeżenie o długim kroku (NIE timeout)

`duration_ms` już jest liczone i zapisywane w obu zakończeniach kroku (`:594,604-606`
i `:627,636-638`). Dołóż **jeden** `logger.warn` po przekroczeniu progu, z progiem
z jawnej zmiennej środowiskowej i **bezpieczną wartością domyślną w kodzie**
(propozycja: 120 000 ms). Log ma nieść co najmniej `planId`, `stepIndex`, `toolName`
i zmierzone `durationMs`.

Wymagania twarde:
- **To nie jest timeout.** Nie przerywasz kroku, nie ustawiasz `AbortSignal`, nie
  zmieniasz statusu kroku ani planu. F6 (`agent-plan.routes.ts:119`) zostaje poza
  zakresem i **napisz to w raporcie wprost**, żeby czytelnik nie uznał, że
  „monitoring czasu kroku" zamknął warunek (7) odbioru 174 w całości. Zamyka go
  **w części monitoringowej**, i tyle.
- Nazwa i wartość domyślna zmiennej **muszą trafić do raportu** (`Z10`).
- Log ma paść dla kroku zakończonego **sukcesem i porażką** — albo napisz, czemu
  tylko dla jednego.
- Próg dobierz w relacji do `heartbeatIntervalMs` (60 s) i `executionLeaseSeconds`
  (300 s) i **pokaż tę arytmetykę**: próg niższy niż odstęp heartbeatu zaleje log,
  próg wyższy niż dzierżawa nigdy nie ostrzeże przed jej utratą.

**Ukończone, gdy:** masz test (może być bez bazy — to czysta ścieżka logowania,
uzasadnij wybór), który pokazuje ostrzeżenie dla kroku powyżej progu i **brak
ostrzeżenia** poniżej progu, oraz dowód mutacyjny na progu.

## R4 — dowody

Dowody dla R1 i R2 idą **wyłącznie na realnym Postgresie i realnym Redisie**. Moduł
rezerwacji jest Postgres-only (`withPgTransaction`, `pg_advisory_xact_lock` —
`agentResourceGovernanceService.ts:148-152`); na sqlite mierzysz atrapę.

Wzorzec harnessu do skopiowania:
`server/src/services/ai/__tests__/day174.agent-plan-cancel.pg.redis.test.ts:8-30`
— z jawnymi asercjami środowiska w `beforeAll`:

```ts
const enabled = process.env.RUN_DB_TESTS === '1' && process.env.RUN_REDIS_TESTS === '1';
describe.skipIf(!enabled)(..., () => {
  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.MOCK_REDIS).toBe('false');
    expect(process.env.ENABLE_AI_TASKS_WORKER).toBe('true');
```

Te trzy `expect` są obowiązkowe w każdym Twoim nowym teście integracyjnym.
★ **`Z31` — CZTERY incydenty w programie, ostatni przy odbiorze 174** (`day164.
agent-dispatch-map.test.ts:80` przypięty do `cx164:6052`, strażnik martwy poza tamtą
maszyną). **Żaden Twój test nie może zawierać nazwy bazy, portu ani hosta.** Jeśli
wołasz `assertRealPostgresTestEnvironment()`
(`tests/integration/_helpers/assertRealPostgres.js`) — wołasz **bez argumentów**,
w szczególności bez `expectedDatabase`. Nazwa bazy i port wchodzą **wyłącznie**
przez `DATABASE_URL` z powłoki.

**`skipped` i `No test files found` to NIE jest `PASS`** — w każdym wyniku, który
przywołujesz jako dowód, podaj `numTotalTests` i liczbę faktycznie uruchomionych
przypadków. Odbiór 174 sprostował raport wykonawcy dokładnie na tym („5/5 PASS,
0 pending" wobec realnych 7 total: 5 pass, 2 **PENDING** — i to te dwa, które
strzegły zmienionej linii).

Nazwy plików: `day180.<temat>.pg.redis.test.ts` w `server/src/services/ai/__tests__/`;
jeśli dotykasz `aiWorker` — dodatkowo w `server/src/workers/__tests__/`.
Nowe pliki w `tests/` wymagają `git add -f`.

Dla **każdej** z trzech pozycji obowiązuje **dowód mutacyjny**: cofnij samą naprawę,
pokaż czerwony test, przywróć, pokaż zielony. Test, który przechodzi także przed
naprawą, nie jest dowodem niczego.

Jeśli dodałeś migrację (nie powinieneś potrzebować) — wklej dosłownie wynik
`npm run test:migrations:day161:fresh`.

# 4. TABELA LICENCJI PLIKOWYCH

Licencja obejmuje **całą ścieżkę danych** obu naprawianych zachowań — od trasy HTTP,
przez serwis planisty i serwis rezerwacji, po workera i tabele.

| Zakres | Ścieżki |
|---|---|
| Zapis | `server/src/services/ai/agentPlannerService.ts` — wyłącznie: egzekutor w `executeBackgroundPlan` (`:1063-1093`) i rozwiązanie zakresu polityki (`:1051-1061`) w zakresie R1; `executeGovernedEnqueue` (`:132-163`) **tylko jeśli** świadomie rozszerzasz R1 na zakolejkowanie; obsługa `AgentExecutionLeaseLostError` w pętli `executePlan` (`:505-660`) i/lub `renewExecutionLease` (`:319-331`) w zakresie R2; `heartbeatIntervalMs` (`:130`) tylko jako odczyt konfiguracji z bezpiecznym domyślnym; miejsca liczenia `durationMs` (`:594,627`) w zakresie R3 |
| Zapis | `server/src/workers/aiWorker.ts` — wyłącznie blok `case 'AGENT_BACKGROUND_TASK'` (`:94-121`), i **tylko jeśli** R2 tego wymaga; zakaz zmian w pozostałych `case` |
| Zapis | `server/src/services/ai/agentTaskDispatchService.ts` — **wyłącznie jeśli** R2 wprowadza nowy stan pokwitowania: `dispatchAgentTask` (`:82-83`), `claimAgentTask` (`:123-144`), `redriveAgentTask` (`:164-207`). **Zakaz zmian w `identity()` (`:30-39`), `payloadDigest`, `bullJobId` i w `LEASE_SECONDS` (`:8`)** |
| Zapis | `server/src/routes/ai/agent-plan.routes.ts` — **tylko** jeśli R1 wymaga przekazania zakresu przy tworzeniu planu. **Zakaz zmian w `tryDispatchBackgroundExecution` (`:175-...`), w `dispatchKey` i w `MAX_STEPS_PER_PLAN` (`:119`)** |
| Zapis | NOWY moduł pomocniczy rozwiązywania zakresu polityki dla planów spoza kanonu, jeśli wybierzesz taki kształt (proponowana ścieżka: `server/src/services/ai/agentPlanResourceScope.ts`) |
| Zapis | testy `day180.*` w `server/src/services/ai/__tests__/` i (jeśli dotyczy) `server/src/workers/__tests__/` |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY180_AGENT_LIMITY_REPORT.md` |
| Odczyt | `server/src/services/v8/agentResourceGovernanceService.ts` — kontrakt rezerwacji, wymagania `projectId`/`runId` (`:137-139`), leniwy `INSERT` polityki (`:205-227`), liczenie współbieżności i kosztu (`:240-252`), `executeWithAgentResourceReservation` (`:375-437`). **NIE ZMIENIASZ** — warunek (6) odbioru 174 to decyzja właściciela |
| Odczyt | `server/src/services/ai/toolCostEstimates.ts` — cennik z FIX-174. **NIE ZMIENIASZ**; jeśli Twoja zmiana wymaga nowej pozycji, zgłoś ją w raporcie zamiast dopisywać |
| Odczyt | `server/src/utils/queryHelpers.ts` (`withPgTransaction`, `:244-260`) — źródło skutku Postgres-only; **nie zmieniasz** |
| Odczyt | `server/migrations/20260808_v8_agent_resource_governance.sql`, `672_enterprise_agent_planner.sql`, `073_conversations.sql`, `000_initdb_core_tables.sql` — schematy zakresu; **nie zmieniasz żadnego istniejącego pliku migracji** |
| Odczyt | `server/src/services/ai/__tests__/day174.agent-plan-cancel.pg.redis.test.ts`, `day174.agent-resource-policy.pg.redis.test.ts`, `day165.agent-plan-resume.pg.redis.test.ts` — wzorce harnessu i dowód, czego dyżur 174 **nie** zmierzył; **nie zmieniasz** |
| Odczyt | `server/src/jobs/agentPlanSchedulerJob.ts` — drugi wołacz wykonania w tle; sprawdzasz, czy Twoja zmiana zakresu go nie wywraca, i **opisujesz**; nie zmieniasz |
| Odczyt | `docs/program/funkcje/ODBIOR_174_STOP_AGENTA.md`, `docs/program/SCIEZKA_WYJSCIA.md` (K6) — źródła warunków (3), (7), (8); **nie zmieniasz** |
| Odczyt | `src/services/api/agentPlan.api.ts`, `src/components/AIChat/AgentHubShell.tsx`, `AgentPlanPanel.tsx` — konsumenci tras planu; **nie zmieniasz** |

**Nietykalne imiennie:** `server/src/services/v8/multiAgentWorkManagerService.ts`,
`server/src/services/wave8AgentRuntimeService.ts`,
`server/src/services/v8/agentAdapterOrchestratorService.ts` (trzy serwisy z warunku (6)
— **decyzja właściciela, nie Twoja**); `server/src/routes/wave8-agents.routes.ts`;
sześć skryptów dowodowych `a06*`/`a09*`/`t01*` (wpisują polityki same i są dowodem
historycznym); `vitest.config.ts` w korzeniu repo (przypięte `DB_TYPE` — własność
osobnego dyżuru); `server/vitest.config.ts`; wartość `ENABLE_AI_TASKS_WORKER`
gdziekolwiek w repo.

★ **Rozłączność z dyżurami działającymi równolegle:** partia 181-183 i 185-187 pracuje
na innych modułach i **innych portach** (patrz lista portów zajętych). Dyżur 184
(analiza migracji legacy→kanon) jest **wyłącznie dokumentacyjny** i nie dotyka
`server/src/services/ai/**` — jeśli zobaczysz kolizję, **zatrzymaj się i zgłoś**,
nie rozwiązuj jej sam.

★ **Pułapka nazw, zweryfikowana w repo:** w `server/src/services/ai/` istnieje
**katalog** `agentPlan` obok **pliku** `agentPlannerService.ts` — to nie jest to samo.
Podobnie `server/src/workers/aiWorker.ts` (Twój) i `server/src/workers/aiWorkerRuntime.ts`
(nie Twój). I podobnie **dwie tabele rozmów**: `conversations` oraz `ai_conversations`.

# 5. TWARDE ZASADY

- ★★ **NIE WŁĄCZASZ `ENABLE_AI_TASKS_WORKER` NIGDZIE.** Ani w `.env`, ani w konfiguracji
  wdrożenia, ani jako nowa wartość domyślna w kodzie, ani jako rekomendacja
  w dokumentacji. Ustawiasz ją **wyłącznie w powłoce własnego przebiegu testowego**.
  Właściciel zdecydował „TAK-Z-WARUNKAMI, wyłącznie staging" — flagę stawia nadzorca
  w środowisku, po tym dyżurze.
- ★★ **NIE ROZSTRZYGASZ WARUNKU (6) ODBIORU 174** — fail-open leniwego `INSERT`-u
  polityki dla `wave8AgentRuntimeService`, `multiAgentWorkManagerService`
  i `agentAdapterOrchestratorService`. To decyzja właściciela. Twój obowiązek: **nie
  powiększyć promienia rażenia** i opisać, co Twoja zmiana z nim robi.
- ★★ **NIE ROBISZ TIMEOUTU KROKU ANI BUDŻETU TOKENÓW (F6).** R3 to **wyłącznie log
  ostrzegawczy**. Napisz w raporcie wprost, że warunek (7) odbioru 174 zostaje
  zamknięty tylko w części monitoringowej.
- ★★ **NIE ZMIENIASZ `dispatchKey` ANI MECHANIZMU REPLAY** (własność dyżuru 165)
  ani cennika `toolCostEstimates.ts` (własność FIX-174).
- ★★ **`Z31` — ZAKAZ PRZYPINANIA TESTU DO NAZWY BAZY, PORTU LUB HOSTA.** To był
  **czwarty** taki incydent w programie (ERRATA odbioru 174 pkt 4). `assertRealPostgres
  TestEnvironment()` wołasz **bez argumentów**; nazwa bazy i port wchodzą wyłącznie
  przez `DATABASE_URL` z powłoki.
- **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.** Wszystko na lokalnym
  kontenerze Postgresa i lokalnym Redisie z tej instrukcji. Dane demo = twarz produktu.
- **Zakaz `git stash`.** Do dowodu mutacyjnego używasz jawnej edycji i jawnego cofnięcia
  (albo `git diff` zapisanego do pliku w katalogu artefaktów), nigdy schowka.
- **Zakaz wychodzenia testów do sieci.** Próg polityki w teście R1 dobierz tak, żeby
  odmowa padła **przed** wykonaniem narzędzia.
- **Dowód tylko na realnym Postgresie i realnym Redisie.** Bez `RUN_DB_TESTS=1`
  dostajesz MOCK DB; bez `RUN_REDIS_TESTS=1` i `MOCK_REDIS=false` testy kolejkowe się
  pomijają. **`skipped` i `No test files found` to nie jest `PASS`.**
- **Każda naprawa ma dowód mutacyjny.** Cofnij samą poprawkę, pokaż czerwony test,
  przywróć, pokaż zielony. Bez tego pozycja nie jest ukończona.
- **Każdą cytowaną linię kodu sprawdzasz sam przed wklejeniem do raportu.** Numery
  w tej instrukcji zweryfikowano wobec markera **18661cc6a0** (już PO scaleniu FIX-174),
  ale plik żyje. Zlecenie nadzorcy podało dla defektu 1 **zły adres** — poprawiono go
  w sekcji 1; traktuj to jako przypomnienie, że numery sprawdza się, a nie przepisuje.
- ★ Port **5000 jest zajęty na stałe przez macOS Control Center** — nie używaj go do
  żadnego serwera pomocniczego.
- **Sekcja „TWIERDZENIA NIEZWERYFIKOWANE" w raporcie jest obowiązkowa.** Wypisz w niej
  wprost co najmniej: na którą tabelę rozmów faktycznie wskazuje `ai_agent_plans.
  conversation_id` i jak to sprawdziłeś; jak wykluczyłeś kolizję sztucznego klucza
  zakresu z prawdziwym `projects.id`; ile wierszy polityki na organizację przybędzie
  po Twojej zmianie; co się dzieje z planem z czatu przy `DB_TYPE=sqlite`; czy
  sprawdziłeś `agentPlanSchedulerJob` pod kątem nowego zakresu; oraz czy Twój test R2
  udowodnił, że przeszedł przez okno (b), a nie przez (a)/(a2).
