# INSTRUKCJA DYŻURU nr 205 — Codex — „Pętla mądrości organizacji 17-I — cztery spięcia z ARCHITEKTURA_AGENTA_TERESY.md §9: Moduł 01 → claim-writer obok martwego store, zamknięcie sygnału → pamięć kontekstu, rekomendacja decyzji → pamięć decyzji, checklist zdjęcia blokady migracji 946"

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
> **wyłącznie** `/private/tmp/cx-day205-madrosc`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `c50847c259`**
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
Zakres: **Pętla mądrości organizacji (Moduł 17, pozycja 17-I, D-14 zaakceptowana) — cztery z pięciu „najtańszych spięć” z `docs/program/funkcje/ARCHITEKTURA_AGENTA_TERESY.md` §9 (piąte, indeksacja artefaktów Studio/raportów do KB, to osobny dyżur 17-J). Przekrojowy: Organization (backend), My Work/Sygnały (backend), narzędzia AI/Teresa (backend), migracje. Zero ekranów, zero wspólnych plików między czterema pozycjami.**.
Trasy front: `brak modyfikacji — wszystkie cztery pozycje dotykają WYŁĄCZNIE `server/**`. Pięć ekranów redesignu Organization (`src/components/Organization/redesign/OrganizationGoalsMetricsScreen.tsx`, `OrganizationScopeCollaborationScreen.tsx`, `OrganizationChallengesEvidenceScreen.tsx`, `OrganizationRootCausesBlockersScreen.tsx`, `OrganizationRisksOpportunitiesScreen.tsx`) i ich wspólne haki (`useOrgContextStoreSection.ts`, `../../../hooks/useOrgContextSync.ts`) — WYŁĄCZNIE ODCZYT, jako kontekst dla R1; CLOSED_FINAL, zakaz jakiejkolwiek zmiany (CLAUDE.md „store zostaje nietykalny wizualnie i funkcjonalnie”)`. Trasy tył: ``server/src/routes/organization-context-store.routes.ts` (PUT handler, linie 69-130 — R1, zapis obok w liniach ok. 120-121); `server/src/services/organizationContext/OrganizationContextService.ts` (nowa metoda `recordOrganizationContextStoreSave`, wstawiana po `recordOrganizationMetadata`, linie 1747-1763 — R1); `server/src/routes/my-work/signals.routes.ts` (trasy snooze/dismiss, linie 151-178 i 180-199 — R2); `server/src/services/ai/tools/createDecision.ts` (`fillDecisionStructuralFields`, linie 503-663, wołanie w linii 750 — R3); `server/src/services/ai/decisionMemoryService.ts` (odczyt — `recordDecision` linia 81, `findSimilarDecisions` linia 213 — R3, nie zmieniasz); `server/migrations/946_tool_outputs_reports_lineage.sql` (odczyt/weryfikacja — R4, NIE zmieniasz treści migracji); `scripts/dev/day161-fresh-migration-check.sh` (uruchamiasz z własnymi zmiennymi środowiskowymi portu/kontenera — R4, nie zmieniasz treści skryptu)`.

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
WT=/private/tmp/cx-day205-madrosc
MARKER=c50847c259

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day205-madrosc-20260831 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day205-madrosc/config.worktree"
cat "$VAULT/worktrees/cx-day205-madrosc/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day205-madrosc-scratch
mkdir -p /private/tmp/cx-day205-madrosc-artefakty

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
git -C "$VAULT" log --oneline c50847c259..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only c50847c259..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day205-madrosc-20260831
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only c50847c259..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `dziewięć` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day205-madrosc

# (T1) R1 — JEDEN backendowy choke-point dla pięciu ekranów; potwierdź brak innego pisarza PUT
grep -n "router.put\|hasGoals\|hasChallenges\|hasSynthesis" server/src/routes/organization-context-store.routes.ts
grep -rln "useOrgContextStoreSection\|useOrgContextSync" src/components/Organization/redesign/ src/hooks/
#   oczekiwane: JEDEN router.put('/', ...) w organization-context-store.routes.ts (linie ok. 69-130);
#   pięć plików ekranów redesignu + useOrgContextStoreSection.ts importują wyłącznie ten wspólny hak,
#   zero własnego fetch/PUT do /organization-context-store poza useOrgContextSync.ts.

# (T2) R1 — kształt claimPath: strategic.goals/operations.constraints to STRINGI, notes.manualContext/metadata.custom to OBIEKTY
sed -n '1280,1340p' server/src/services/organizationContext/OrganizationContextService.ts | grep -n "claimRows, '\|typeof entry"
#   oczekiwane: 'strategic.goals'/'operations.constraints'/'strategic.priorities' filtrowane
#   `typeof entry === 'string' ? entry : null` (obiekt → null, atrapa); 'notes.manualContext'/
#   'metadata.custom' filtrowane `typeof entry === 'object'` (obiekt → widoczny).

# (T3) R1 — recordContextSource robi auto-rebuild; governance NIE filtruje resolved-context po review_status
sed -n '973,1045p' server/src/services/organizationContext/OrganizationContextService.ts | grep -n "rebuildSnapshot\|review_status\|status = 'active'"
#   oczekiwane: `if (input.rebuildSnapshot !== false) { await this.rebuildSnapshot(...) }` — czyli
#   domyślnie WŁĄCZONE; komentarz przy INSERT do organization_context_claims potwierdza, że
#   buildResolvedContext/rebuildSnapshot NIGDY nie filtrowały po review_status, tylko status='active'.

# (T4) R2 — dokładne linie snooze/dismiss + wzorzec recordManualAIContext + pułapka pustego content
sed -n '145,199p' server/src/routes/my-work/signals.routes.ts | grep -n "router.post\|'/signals"
grep -n "recordManualAIContext" server/src/routes/context.routes.ts
sed -n '652,666p' server/src/services/organizationContext/OrganizationContextService.ts
#   oczekiwane: snooze zaczyna się w linii 151, dismiss w linii 180 (własna numeracja pliku);
#   context.routes.ts:55 i :99 wołają recordManualAIContext po udanym zapisie; buildManualContextClaims
#   zwraca [] gdy payload.content jest puste — content MUSI być niepustym zdaniem.

# (T5) R3 — recordDecision/findSimilarDecisions: zero wołaczy recordDecision, pułapka outcome_status='pending'
grep -rn "recordDecision(\|recordOutcome(" server/src/ --include='*.ts' | grep -v decisionMemoryService.ts | grep -v __tests__
sed -n '81,120p' server/src/services/ai/decisionMemoryService.ts | grep -n "outcome_status\|VALUES"
sed -n '213,225p' server/src/services/ai/decisionMemoryService.ts | grep -n "outcome_status"
#   oczekiwane: PIERWSZY grep — zero trafień poza plikiem własnym i testami (recordDecision I
#   recordOutcome oba martwe); INSERT recordDecision ma zahardkodowane 'pending'; findSimilarDecisions
#   ma `AND outcome_status != 'pending'` w zapytaniu.

# (T6) R3 — fillDecisionStructuralFields nie ma dziś title/userId w sygnaturze; ENABLE_TERESA_RECORD_CREATE default true
grep -n "async function fillDecisionStructuralFields\|void fillDecisionStructuralFields(" server/src/services/ai/tools/createDecision.ts
grep -n "ENABLE_TERESA_RECORD_CREATE" server/src/config/FeatureFlags.ts
#   oczekiwane: sygnatura `(decisionId: string, orgId: string, language)` — BEZ title/userId (do dodania);
#   wywołanie w linii ok. 750: `void fillDecisionStructuralFields(id, orgId, language);` — `title`/`userId`
#   są W ZASIĘGU tej samej funkcji `createDecision` (linie 675+), tylko nieprzekazane; flaga default true.

# (T7) R4 — brak bramki kodowej dla 946_tool_outputs_reports_lineage.sql; żywi konsumenci obu stron
sed -n '1,15p' server/migrations/946_tool_outputs_reports_lineage.sql
grep -n "KNOWN_EXCLUDED_MIGRATIONS_SUBDIRS\|isSqliteOnlyMigration" server/scripts/migrate.postgres.ts
grep -rln "tool_outputs\b" server/src/ src/ --include='*.ts' --include='*.tsx' | grep -v __tests__ | grep -v migrations
#   oczekiwane: nagłówek zawiera "NIE uruchamiamy tej migracji na żywej bazie w tej fali";
#   KNOWN_EXCLUDED_MIGRATIONS_SUBDIRS = {'ops','never-ran','rollback'} — ten plik w żadnym;
#   konsumenci: ToolOutputsController.ts, toolOutputSnapshotService.ts, toolOutputs.routes.ts,
#   teresaKernel.ts/teresaEventStore.ts, DiscoveryToolsHub.tsx, ToolOutputsPanel.tsx (min. te).

# (T8) R4 — dowód, że 947 zależy na 946 (para już zaprojektowana jako jeden krok)
sed -n '1,20p' server/migrations/947_tool_outputs_idempotency_guard.sql
ls scripts/dev/day161-fresh-migration-check.sh && grep -n "DAY161_CONTAINER_NAME\|DAY161_PG_PORT\|DAY161_DATABASE_NAME\|DAY161_ARTIFACT_DIR" scripts/dev/day161-fresh-migration-check.sh
#   oczekiwane: 947 tworzy UNIQUE INDEX na tool_outputs, zero własnej blokady w nagłówku;
#   skrypt day161 sparametryzowany zmiennymi środowiskowymi — użyj SWOICH wartości portu/kontenera.

# (T9) PORT I MIEJSCE NA DYSKU
df -h /
lsof -nP -iTCP:6145 -iTCP:5080 -iTCP:5081 -sTCP:LISTEN
docker ps -a --format '{{.Names}}' | grep -E 'cx-day(204|205|206)'
#   oczekiwane: df >5GB wolnego; lsof PUSTY; docker ps bez kontenera cx-day205-pg (jeszcze nie
#   utworzony) — jeśli cx-day204-pg/cx-day206-pg żyją, to normalne (dyżury równoległe), NIE dotykaj ich.
```

---

### §0.4a — pomiar zasięgu testów (warunek oddania raportu, patrz `Z24`)

Zanim ogłosisz jakikolwiek wynik testów, zmierz zasięg PEŁNYMI NAZWAMI, nie liczbami:

1. PRZED zmianami produktu: uruchom pakiet(y) testów wskazane w licencji z
   `--reporter=json` (albo zapisz listę `describe/it` z wyjścia) i zapisz do
   artefaktów plik `przed-nazwy.txt` — po jednej PEŁNEJ nazwie testu na wiersz.
2. PO zmianach: to samo do `po-nazwy.txt`.
3. Do raportu wchodzi: `diff przed-nazwy.txt po-nazwy.txt` — nazwy DODANE (twoje
   nowe testy) i nazwy ZNIKNIĘTE (każda zniknięta = wyjaśnienie albo STOP).
   `N passed` bez nazw NIE jest pomiarem. „Ta sama liczba" przy innym składzie
   nazw to fałszywa zieleń (Z37).
4. Przepisanie liczby z instrukcji, cudzego raportu albo rejestru = zawyżenie
   i podstawa odrzucenia raportu. Liczysz sam, u siebie, na swojej bazie.

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day205-madrosc-20260831` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6145`. Twój JEDYNY port harnessu to `5080 i 5081`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day205-pg`**. **ZAKAZANE:** `6012, 5433, 6047, 6054-6119, 5010-5059, 6404-6411 (odbiory nadzorcy i wcześniejsze dyżury), 6120/5060-5061 (dyżur 196), 6121/5062-5063 (dyżur 196 rezerwacja), 6144/5078-5079 (dyżur 204 — równoległy), 6146/5082-5083 (dyżur 206 — równoległy). Twoje własne WYŁĄCZNIE 6145 i 5080/5081. ★ PORT 5000 ZAJĘTY NA STAŁE przez macOS Control Center. ★ PORT 5037 ZAJĘTY NA STAŁE przez adb (Android Debug Bridge). ★ PORTY 5060-5061 potwierdź jako zajęte/zwolnione przed startem (BLOK 0) — to zakres poprzedniego dyżuru równoległego, nie masz gwarancji, że jego kontener już zszedł. Rozłączność plikowa z dyżurami 204/206: NIEZNANA z tego miejsca (ich cfg/body nie były dostępne przy składaniu tej instrukcji) — jeśli przy starcie zobaczysz w swoim worktree zmiany poza plikami z Twojej tabeli licencji (sekcja 4 body), STOP i zgłoś w raporcie zamiast zgadywać czyje to są zmiany.`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak nowych flag i zero zmiany wartości domyślnej istniejącej flagi. R3 dotyka ścieżki chronionej ISTNIEJĄCĄ flagą `ENABLE_TERESA_RECORD_CREATE` (`server/src/config/FeatureFlags.ts:51`, `z.boolean().default(true)` — domyślnie WŁĄCZONA już dziś) — używasz jej WYŁĄCZNIE do odczytu w teście (żeby wiedzieć, że `create_decision` faktycznie wykona się w Twoim środowisku testowym), nie zmieniasz jej definicji ani domyślnej wartości.`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*`; DODATKOWO dla tego dyżuru: `approveClaim`/`rejectClaim`/`publishSnapshotVersion`/`listGovernedClaims` w `OrganizationContextService.ts` (governed snapshot spine ORG-BVP-001 — dodajesz TYLKO nową metodę `record*`, nie dotykasz mechaniki zatwierdzania/governance ani `resolveClaimApproval`)`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY205_MADROSC_REPORT.md`. Nie zmieniasz żadnego `MODULE_ACCEPTANCE.md` — ten dyżur jest przekrojowy (silnik pętli kontekstu/pamięci/migracji, nie jeden moduł z tabeli 16 modułów WAVE_03_ACCEPTANCE).. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day205-madrosc-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day205-madrosc-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **R1: NIE zmieniasz ŻADNEGO z pięciu ekranów redesignu Organization ani `useOrgContextSync.ts`/`useOrgContextStoreSection.ts`.** CLOSED_FINAL, zapis-obok wyłącznie w backendowym PUT handlerze — zero zmian frontendu, zero zmian kontraktu odpowiedzi PUT/GET `/organization-context-store` (pola `ok`/`version`/`companyProfileOwnership` zostają identyczne). ★★ **R1: NIE używasz `claimPath: 'strategic.goals'` ani `'operations.constraints'`/`'operations.gaps'` dla treści pięciu ekranów** — to ścieżki string-only (patrz T2), obiektowa treść (KPI, listy, pola) wylądowałaby jako cichy `null`. Użyj `'notes.manualContext'` (obiektowa, już konsumowana w `resolved.notes.manualContext`) z wrapperem `{section: 'goals'|'challenges'|'synthesis', ...wartość}`, żeby trzy sekcje pozostały rozróżnialne mimo współdzielenia jednej ścieżki claimu. ★★ **R1: zapis-obok jest FAIL-SOFT** — owiń wywołanie `organizationContextService.recordOrganizationContextStoreSave(...)` we WŁASNY `try/catch` wewnątrz PUT handlera; błąd claim-writera loguje się i NIGDY nie zamienia udanego zapisu do `organization_context_store` w błąd 500 (ten endpoint jest CLOSED_FINAL — regresja niedozwolona nawet gdy "dodatek" zawiedzie). ★★ **R2: NIE zmieniasz logiki mute-type/mute-domain** (linie 105-149) — WYŁĄCZNIE snooze (151) i dismiss (180) niosą decyzję użytkownika wartą zapamiętania; mute jest globalną preferencją typu/domeny, nie decyzją o KONKRETNYM sygnale. ★★ **R2: `payload.content` w `recordManualAIContext` MUSI być niepustym, opisowym zdaniem** (patrz T4/pułapka `buildManualContextClaims`) — nie samym `req.params.key`. ★★ **R3: NIE dotykasz `case 'create_decision':` w `toolDefinitions.ts:704`** (legacy P2-ścieżka z surowym INSERT, kandydatka do wygaszenia po 197-E2, poza zakresem tego dyżuru) ani `executeFindDecisions`/`case 'find_similar_decisions'` (czytelnik, zostaje nietknięty). Zmiana WYŁĄCZNIE w `fillDecisionStructuralFields` (`createDecision.ts`). ★★ **R3: NIE naprawiasz `recordOutcome`** (zero wołaczy, martwa funkcja) — to osobna decyzja produktowa (kiedy/jak system dowiaduje się o wyniku decyzji), poza zakresem 17-I; nazwij to w raporcie jako inwentarz, nie naprawiaj przy okazji. ★★ **R3: test R3 MOŻE wywołać `recordOutcome` BEZPOŚREDNIO w kodzie testu** (test-only, nie w kodzie produkcyjnym) żeby udowodnić, że ścieżka odczytu `findSimilarDecisions` faktycznie znajduje zapisaną decyzję PO ustawieniu wyniku — to jest dopuszczalne obejście pułapki `outcome_status='pending'`, NIE naprawa jej w produkcji. ★★ **R4: NIE uruchamiasz `migrate.postgres.ts` z 946 przeciw ŻADNEJ bazie poza Twoim własnym efemerycznym kontenerem `cx-day205-pg`/port 6145.** Zero demo, staging, produkcja, cudza retained-DB. ★★ **R4: NIE zdejmujesz "blokady" sam** — Twoim produktem jest CHECKLIST dla nadzorcy (kroki, dowody, warunki), NIE decyzja o uruchomieniu na żywej bazie i NIE PR/komunikat do zespołu ops. ★★ **R4: NIE zmieniasz treści `946_tool_outputs_reports_lineage.sql` ani `947_tool_outputs_idempotency_guard.sql`** — nawet usunięcia komentarza-nagłówka "NIE uruchamiamy..."; to dyscyplina procesu, usuwa ją nadzorca PO przejściu checklisty, nie Ty w tym dyżurze. ★★ **Zero szukania własnych znalezisk poza czterema nazwanymi pozycjami** — jeśli zobaczysz coś piąte, zapisz w raporcie jako inwentarz. ★★ **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.** | Kontekst obowiązkowy: `docs/program/funkcje/ARCHITEKTURA_AGENTA_TERESY.md` §9 ("MĄDROŚĆ ORGANIZACJI — pętla »praca → wiedza → kontekst«", rekonesans 31.08): rdzeń pętli DZIAŁA naprawdę (`organization_context_claims` z 9 realnymi pisarzami + `orgContextRebuildJob` co 4h + `buildResolvedContext()` wpięty w prompt Teresy), ale ma trzy dziury, z których pierwsza boli najbardziej. **R1:** Moduł 01 (CLOSED_FINAL!) pisze do martwej `organization_context_store` — zmierzone dziś: `server/src/routes/organization-context-store.routes.ts` ma JEDEN handler PUT (linie 69-130), do którego wszystkie 5 ekranów redesignu (Cele i mierniki, Zakres i tryb współpracy, Wyzwania i dowody, Przyczyny i blockery, Ryzyka i szanse) funnelują przez WSPÓLNY frontendowy hak `useOrgContextSync.saveNow()` (JEDYNY pisarz, udokumentowany wyścig i trzy naprawione bugi w komentarzu nagłówkowym pliku) — więc RÓWNOLEGŁY zapis do claim-writera ma dokładnie JEDNO miejsce po stronie serwera, nie pięć. `organizationContextService` ma dziś 9 metod `record*` (linie 1675-1849), wzorzec `recordContextSource` → `organization_context_items` + `organization_context_claims`, z AUTOMATYCZNYM `rebuildSnapshot()` (chyba że `rebuildSnapshot: false`) — więc jedno wywołanie od razu odświeża snapshot, bez czekania na joba co 4h. WAŻNE zmierzone ograniczenie: `buildResolvedContext` renderuje `strategic.goals`/`operations.constraints` WYŁĄCZNIE jako listy STRINGÓW (`collectClaimValues(...).map(entry => typeof entry === 'string' ? entry : null)`, linie ok. 1287-1335) — payload pięciu ekranów to bogate OBIEKTY (KPI, listy, pola tekstowe), więc claim pod tymi ścieżkami wylądowałby jako cichy `null` (atrapa zapisu, nie realna widoczność). `notes.manualContext` i `metadata.custom` konsumują `Record<string,unknown>` (linie ok. 1327-1332, 1338-1340) i SĄ renderowane w `resolved.notes.manualContext`/`resolved.metadata.custom` (linie ok. 1546-1552) — to jest bezpieczna, już-konsumowana ścieżka dla obiektowej treści. **R2:** `docs/program/funkcje/ARCHITEKTURA_AGENTA_TERESY.md` §9 punkt (2): zamknięcie sygnału nie zostawia śladu wiedzy. Zmierzone dziś: `server/src/routes/my-work/signals.routes.ts` — `POST /signals/:key/snooze` zaczyna się w linii 151, `POST /signals/:key/dismiss` w linii 180 (dokładnie jak w zleceniu), oba dziś kończą się WYŁĄCZNIE zapisem do `my_work_signal_snoozes`/`my_work_signal_dismissals` — decyzja użytkownika („to nieistotne”/„odłóż do X”) nigdy nie dociera do kontekstu Teresy. Wzorzec do skopiowania istnieje: `server/src/routes/context.routes.ts` linie 55-61 i 99-107 wołają `organizationContextService.recordManualAIContext({organizationId, userId, contextId, payload: {name, type, content, priority}})` po udanym zapisie. PUŁAPKA zmierzona: `buildManualContextClaims` (linia 652) zwraca PUSTĄ tablicę claimów, gdy `payload.content` jest puste (`if (!content) return [];`) — więc `content` MUSI być niepustym, opisowym zdaniem (nie samym kluczem sygnału), inaczej wywołanie "się uda" (200), ale nic nie zostanie zaklejmowane — cicha atrapa identyczna do tych, przed którymi ostrzega CLAUDE.md/Z23. **R3:** §9 punkt (2): „Pamięć decyzji ma czytelnika bez pisarza (`recordDecision` — zero wołaczy → `find_similar_decisions` zawsze puste)”. Zmierzone dziś: `decisionMemoryService.recordDecision` (linia 81) ma ZERO wołaczy w całym `server/**` poza samym plikiem i testami; `findSimilarDecisions` (linia 213) MA jednego czytelnika: `executeFindDecisions` w `server/src/services/ai/toolDefinitions.ts` (linia ~1304-1306, narzędzie czatu `find_similar_decisions`, case w linii 602). Najlepsze miejsce na zapis NIE jest jednak przy tym czytelniku ani przy surowym `case 'create_decision':` (toolDefinitions.ts:704 — legacy ścieżka z P2 §3 architektury, kandydatka do wygaszenia po 197-E2, NIE rozbudowuj jej) — jest w `server/src/services/ai/tools/createDecision.ts`, funkcja `fillDecisionStructuralFields` (linie 503-663), bo TO jest miejsce, gdzie "rekomendacja decyzji już powstaje": generuje `alternatives`/`riskImpact`/`consequences`/`recommendation`/`rationale` przez `decisionService.generateSection` i persystuje je w REALNYCH kolumnach `decisions` (migracja 902). Zmierzona PUŁAPKA KRYTYCZNA: `findSimilarDecisions` filtruje `WHERE outcome_status != 'pending'` (linia ok. 222), a `recordDecision` ZAWSZE wstawia `outcome_status = 'pending'` (hardkodowane w INSERT, linia ok. 91) — nowo nagrana decyzja jest WIDOCZNA w `getDecisions`/`ai_decision_outcomes`, ale NIEWIDOCZNA dla `findSimilarDecisions`, dopóki coś nie ustawi statusu na coś innego niż `pending`. Zmierzone dodatkowo: `recordOutcome` (linia ok. 121) — funkcja, która JEDYNA zmienia `outcome_status` — ma DZIŚ ZERO wołaczy w całym `server/**` (drugi martwy pisarz obok `recordDecision`). To NIE jest w zakresie tego dyżuru do naprawienia (naprawa `recordOutcome` to osobna decyzja produktowa — kiedy/jak organizacja dowiaduje się, czy decyzja "się sprawdziła"), ale test R3 MUSI to obejść świadomie (patrz sekcja 3, DoD R3) i raport MUSI to nazwać wprost jako osobne, nienaprawione ogniwo. **R4:** §9 punkt "TOP-5 najtańszych spięć", pozycja (4): "zdjęcie blokady migracji 946 po weryfikacji (kod obu stron istnieje)". Zmierzone dziś: repo ma TRZY różne pliki z prefiksem `946_` (`946_benefit_tracking_fresh_install.sql`, `946_siri_16d_source_of_truth.sql` — zablokowany z INNEGO powodu, COORD-02, spór nazewnictwa SIRI, NIE Twoja sprawa — i `946_tool_outputs_reports_lineage.sql`, KTÓRY jest przedmiotem R4). Nagłówek tego pliku (linia ok. 10): "NIE uruchamiamy tej migracji na żywej bazie w tej fali." Zmierzone: `server/scripts/migrate.postgres.ts` NIE MA żadnego mechanizmu blokującego konkretnie ten plik — `KNOWN_EXCLUDED_MIGRATIONS_SUBDIRS` (linia 155) wyklucza WYŁĄCZNIE podkatalogi `ops/`, `never-ran/`, `rollback/`, a ten plik leży bezpośrednio w `server/migrations/` (sam nagłówek to potwierdza, linia ok. 6-8: "runner jest NIEREKURENCYJNY... cokolwiek w podkatalogu... nigdy by się nie uruchomiło") — więc "blokada" jest WYŁĄCZNIE dyscypliną procesu (kto uruchamia migracje na demo/staging/prod), NIE bramką w kodzie: na Twoim LOKALNYM, efemerycznym kontenerze ta migracja i tak wykona się automatycznie w każdym pełnym przebiegu `migrate.postgres.ts` od pustej bazy. "Kod obu stron gotowy" zmierzony wprost: `server/src/services/tools/toolOutputSnapshotService.ts` (nagłówek: "`tool_outputs` IS the canonical, immutable snapshot") zakłada BEZWARUNKOWO istnienie tabel z 946 (zero `to_regclass`/`hasColumn`-guardów), konsumenci realni: `server/src/controllers/ToolOutputsController.ts`, `server/src/routes/toolOutputs.routes.ts` (montowany w `Gateway.ts`), `server/src/services/teresa/teresaKernel.ts`+`teresaEventStore.ts` (tabela `tool_session_events`), front `src/components/DiscoveryTools/report/ToolOutputsPanel.tsx`. Migracja `947_tool_outputs_idempotency_guard.sql` (bez własnej blokady w nagłówku) zależy od `tool_outputs` istniejącej (UNIQUE INDEX na tej tabeli) — kolejny dowód, że para 946/947 jest już w pełni zaprojektowana jako jeden krok. Test lokalny wymagany przez zlecenie: `scripts/dev/day161-fresh-migration-check.sh` (parametryzowany zmiennymi `DAY161_CONTAINER_NAME`/`DAY161_PG_PORT`/`DAY161_DATABASE_NAME`/`DAY161_ARTIFACT_DIR` — NIE edytujesz treści skryptu, podajesz własne wartości portu/kontenera/bazy Twojego dyżuru) od pustej bazy, z 946 aktywną (czyli NIEZMIENioną, bez usuwania jej z katalogu) — dowód pełnego przebiegu + replay idempotentny. |

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
cd /private/tmp/cx-day205-madrosc

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day205-pg psql -U postgres -d cx205 \
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
cd /private/tmp/cx-day205-madrosc

docker run -d --name cx-day205-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx205 \
  -p 127.0.0.1:6145:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day205-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6145/cx205 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6145/cx205 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day205-madrosc && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6145/cx205 \
JWT_SECRET=cx205-test-secret-do-not-reuse \
npx vitest run server/src/routes/my-work/__tests__ server/src/services/organizationContext/__tests__ server/src/services/ai/__tests__ server/src/services/ai/tools/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day205-madrosc-artefakty/day205-vitest.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day205-madrosc && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/routes/my-work/__tests__ server/src/services/organizationContext/__tests__ server/src/services/ai/__tests__ server/src/services/ai/tools/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day205-madrosc-artefakty/day205-vitest.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day205-madrosc/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day205-pg psql -U postgres -d cx205 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day205-pg`.
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
> **(e) ★★ **Pierwsza (R1): obiekt vs string w konsumencie claimu.** `buildResolvedContext` nie jest jednolitym magazynem — różne `claimPath` mają różne oczekiwane KSZTAŁTY wartości (string[] dla `strategic.*`/`operations.constraints`, `Record<string,unknown>[]` dla `notes.manualContext`/`metadata.custom`/`stakeholders.people`/`evidence.*`). Wybór złej ścieżki daje "sukces" na poziomie zapisu (wiersz w `organization_context_claims` istnieje) i CISZĘ na poziomie odczytu (`null`/odfiltrowane w `buildResolvedContext`) — dokładnie kształt fałszywego "gotowe" nr 8 z pamięci projektu ("wołacz istnieje ≠ renderuje się"), tu jeszcze głębiej: "claim istnieje ≠ renderuje się". DoD R1 wymaga dowodu na OBU poziomach: wiersz w `organization_context_claims` I string w `JSON.stringify(await organizationContextService.buildResolvedContext(orgId))` zawierający treść zapisaną przez ekran. ★★ **Druga (R1): `hasGoals`/`hasChallenges`/`hasSynthesis` w PUT handlerze dotyczą kolumn `organization_context_store`, nie automatycznie "którego ekranu użyto".** `useOrgContextSync.performSync` wysyła ZAWSZE pełną kopertę `{goals, challenges, synthesis}` z całego store'u zustand (nie tylko pola bieżącego ekranu) — więc "per typ treści" w praktyce oznacza TRZY kubełki (goals/challenges/synthesis), nie pięć, bo dwa PARY ekranów (Cele+Zakres dzielą `goals`; Wyzwania+Przyczyny dzielą `challenges`) zapisują do tego samego klucza store'u przez WSPÓLNY hak. To jest zmierzony, nieunikniony fakt architektury (nie błąd do naprawienia w tym dyżurze) — opisz go wprost w raporcie zamiast udawać rozróżnienie na pięć, którego dane nie niosą. ★★ **Trzecia (R3): `outcome_status` domyślnie `'pending'` i `findSimilarDecisions` filtruje `!= 'pending'` — to NIE jest bug do naprawienia w tym dyżurze, to jest PROJEKTOWA cezura "uczymy się z ROZSTRZYGNIĘTYCH decyzji, nie z surowych".** Pokusa "naprawić" przez zmianę filtra albo domyślnego statusu jest ZAKAZANA (zmieniłaby semantykę pamięci decyzji dla WSZYSTKICH konsumentów, w tym `buildHistoricalContextAddon` używanego przez Deep Thinking) — right fix to udokumentować w raporcie jako osobne ogniwo (`recordOutcome` martwe) i przetestować ścieżkę zapisu+odczytu z jawnym, testowym wywołaniem `recordOutcome`. ★★ **Czwarta (R3): `sessionId` i `userId` są `NOT NULL` w `ai_decision_outcomes`** (migracja 515) — `fillDecisionStructuralFields` nie ma dziś dostępu do `userId` (nie jest parametrem) ani naturalnego `sessionId` (to nie jest sesja Deep Thinking). Wymagane: dodać `title: string` i `userId: string` jako NOWE parametry `fillDecisionStructuralFields` (przekazywane z `createDecision`, gdzie oba już są w zasięgu — `title` i `userId` linie ok. 706+/680), oraz użyć `decisionId` jako syntetycznego `sessionId` (`sessionId: decisionId` — jedna decyzja czatu = jedna "sesja" w sensie pamięci, uzasadnij to zdanie w raporcie, nie zostawiaj bez komentarza w kodzie). Jeśli `userId` jest puste (brak uwierzytelnionego użytkownika w kontekście narzędzia) — pomiń wywołanie `recordDecision` fail-soft (zaloguj, nie rzucaj), tak jak reszta `fillDecisionStructuralFields` jest fail-soft na każdym kroku. ★★ **Piąta (R4): TRZY pliki `946_*.sql` w repo, DWA różne powody blokady.** `946_siri_16d_source_of_truth.sql` jest zablokowany przez SPÓR NAZEWNICTWA (COORD-02) — to NIE jest ten sam typ blokady co `946_tool_outputs_reports_lineage.sql` (dyscyplina kolejności wdrożenia). Nie myl ich w raporcie i nie proponuj checklisty zdjęcia blokady dla SIRI — poza zakresem tej pozycji (R4 dotyczy WYŁĄCZNIE `946_tool_outputs_reports_lineage.sql`, wskazanego w zleceniu). ★★ **Szósta (R4): brak bramki kodowej ≠ bezpiecznie uruchomić na żywo bez checklisty.** To, że `migrate.postgres.ts` nie ma technicznego mechanizmu blokującego ten plik, nie znaczy, że checklist dla nadzorcy może być pusty/kosmetyczny — Twoim zadaniem jest wypisać REALNE warunki (m.in.: dowód lokalnego pełnego przebiegu z tego dyżuru, potwierdzenie że 947 pociągnie się automatycznie w tej samej fali, brak kolizji z trzecim plikiem `946_benefit_tracking_fresh_install.sql` który już dziś zakłada się jako uruchamiany), nie samo zdanie "kod gotowy, można odpalać".**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day205-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day205-madrosc-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`cztery pozycje równorzędne R1-R4, spięte tylko przez wspólny temat (pętla mądrości organizacji, §9 ARCHITEKTURA_AGENTA_TERESY.md), zero współdzielonych plików — wykonaj i udowodnij każdą osobno, kolejność dowolna. R1/R2/R3 to zapis-obok przez ISTNIEJĄCY claim-writer (`organizationContextService`/`decisionMemoryService`); R4 to WYŁĄCZNIE pomiar + checklist, zero zmiany kodu migracji.`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6145` albo `5080 i 5081` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6145` albo `5080 i 5081`** (`Z7`).

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

`docs/program/funkcje/ARCHITEKTURA_AGENTA_TERESY.md` §9 (rekonesans 31.08,
synteza nadzorcy z czterech map): rdzeń „pętli mądrości organizacji” DZIAŁA
naprawdę — `organization_context_claims` z 9 realnymi pisarzami,
`orgContextRebuildJob` co 4h, `buildResolvedContext()` wpięty wprost w prompt
Teresy. Ale ma trzy dziury. Ten dyżur zamyka CZTERY z pięciu najtańszych
spięć nazwanych tam wprost (piąte — indeksacja artefaktów Studio/raportów do
KB — to osobny dyżur 17-J, poza zakresem tu).

**R1 — Moduł 01 (CLOSED_FINAL!) pisze do martwej tabeli.** Pięć ekranów
redesignu Organization (Cele i mierniki, Zakres i tryb współpracy, Wyzwania i
dowody, Przyczyny i blockery, Ryzyka i szanse) zapisuje WYŁĄCZNIE do
`organization_context_store` — tabeli, której nikt nie czyta poza jej
własnym GET-em. Wiedza, którą właściciel osobiście akceptował jako serce
kontekstu organizacji, nigdy nie dociera do Teresy.

**R2 — zamknięcie sygnału zostawia zero śladu wiedzy.** `POST
/signals/:key/snooze` i `POST /signals/:key/dismiss`
(`server/src/routes/my-work/signals.routes.ts:151` i `:180`) zapisują
WYŁĄCZNIE do `my_work_signal_snoozes`/`my_work_signal_dismissals`. Decyzja
użytkownika („to jest nieistotne”, „odłóż to do jutra”) ginie — Teresa nigdy
się nie dowie, że ten sygnał już był rozpatrzony.

**R3 — pamięć decyzji ma czytelnika bez pisarza.** `decisionMemoryService`
(`server/src/services/ai/decisionMemoryService.ts`) ma gotową funkcję
`findSimilarDecisions` (linia 213) z JEDNYM realnym czytelnikiem
(`executeFindDecisions` w `toolDefinitions.ts`, narzędzie czatu `find_similar_
decisions`) — ale `recordDecision` (linia 81), jedyny pisarz tej pamięci, ma
ZERO wołaczy w całym `server/**`. Organizacja nigdy nie uczy się z własnych
decyzji, bo nic ich nigdy nie zapisuje.

**R4 — migracja 946 (`tool_outputs_reports_lineage`) siedzi zablokowana
notatką w nagłówku, mimo że kod obu stron jest gotowy.** Nagłówek pliku mówi
„NIE uruchamiamy tej migracji na żywej bazie w tej fali” — ale
`toolOutputSnapshotService.ts` już dziś BEZWARUNKOWO zakłada istnienie tabel
z tej migracji (zero `to_regclass`-guardów), a konsumentów po obu stronach
(backend + front) jest wielu i są żywe.

# 2. TEZY ZLECENIA

- **T1.** Cztery pozycje są niezależne od siebie — zero współdzielonych
  plików. Wykonaj i udowodnij każdą osobno; kolejność dowolna.
- **T2.** R1/R2/R3 to zapis-obok przez ISTNIEJĄCY claim-writer
  (`organizationContextService`/`decisionMemoryService`) — nie budujesz nowej
  infrastruktury, dopinasz się do gotowej.
- **T3.** R1 wymaga wyboru WŁAŚCIWEJ ścieżki claimu (`notes.manualContext`,
  nie `strategic.goals`) — zła ścieżka daje ciszę, nie błąd (patrz sekcja 3).
- **T4.** R3 wymaga świadomego obejścia zmierzonej pułapki
  (`outcome_status='pending'` wyklucza z `findSimilarDecisions`) w teście,
  bez naprawiania jej w produkcji — to osobna decyzja produktowa.
- **T5.** R4 to WYŁĄCZNIE pomiar + checklist dla nadzorcy. Zero zmiany kodu
  migracji, zero uruchomienia na żywej bazie.

# 3. POZYCJE DYŻURU

## R1 — Organization: claim-writer obok martwego store

**Zmierzony fakt architektury (przeczytaj, zanim zaczniesz kodować).**
Wszystkie pięć ekranów redesignu (`src/components/Organization/redesign/
Organization{GoalsMetrics,ScopeCollaboration,ChallengesEvidence,
RootCausesBlockers,RisksOpportunities}Screen.tsx`) NIE piszą bezpośrednio do
API — edytują lokalnie `useContextBuilderStore` (zustand) i wołają
`contextSync.saveNow()` z hooka `src/hooks/useOrgContextSync.ts`, który jest
JEDYNYM pisarzem do `/api/organization-context-store` (komentarz nagłówkowy
tego pliku opisuje trzy naprawione bugi z wyścigiem wielu pisarzy —
przeczytaj go, zanim pomyślisz o dodaniu drugiego). `performSync` w tym hooku
zawsze wysyła PEŁNĄ kopertę `{goals, challenges, synthesis}` z całego
store'u, niezależnie od tego, który ekran kliknął „Zapisz zmiany” — więc
backendowy PUT handler (`server/src/routes/organization-context-store.routes.ts:69-130`)
jest JEDYNYM miejscem po stronie serwera, przez które przechodzi zapis z
WSZYSTKICH pięciu ekranów. To tu, i tylko tu, dopinasz zapis-obok.

Dwie pary ekranów dzielą klucz store'u: Cele i mierniki + Zakres i tryb
współpracy dzielą `goals`; Wyzwania i dowody + Przyczyny i blockery dzielą
`challenges`. Ryzyka i szanse ma `synthesis` dla siebie. To oznacza TRZY
kubełki treści, nie pięć — opisz to wprost w raporcie zamiast udawać
rozróżnienie, którego dane nie niosą.

**Krok 1 — nowa metoda w `OrganizationContextService.ts`.** Wstaw PO
`recordOrganizationMetadata` (kończy się linią 1763), PRZED
`recordManualAIContext` (zaczyna się linią 1765):

```ts
  /**
   * 17-I R1 (dyżur 205, §9 ARCHITEKTURA_AGENTA_TERESY.md) — zapis-obok dla
   * pięciu ekranów redesignu Organization, które nadal piszą WYŁĄCZNIE do
   * `organization_context_store` (M01 CLOSED_FINAL — ekran nietykalny, patrz
   * `organization-context-store.routes.ts`). `goals`/`challenges`/`synthesis`
   * to trzy kubełki dzielone przez pięć ekranów (dwie pary dzielą klucz przez
   * wspólny hak `useOrgContextSync`), nie pięć osobnych.
   * `claimPath: 'notes.manualContext'` — NIE 'strategic.goals'/'operations.
   * constraints' — bo te ścieżki renderują w buildResolvedContext WYŁĄCZNIE
   * stringi (`typeof entry === 'string' ? entry : null`); nasza treść to
   * obiekty. Wrapper {section, ...} zachowuje rozróżnialność trzech kubełków
   * mimo współdzielenia jednej ścieżki claimu.
   */
  async recordOrganizationContextStoreSave(params: {
    organizationId: string;
    userId?: string | null;
    goals?: Record<string, unknown>;
    challenges?: Record<string, unknown>;
    synthesis?: Record<string, unknown>;
  }): Promise<void> {
    const claims: ContextClaimInput[] = [];
    const addSection = (section: 'goals' | 'challenges' | 'synthesis', value: unknown) => {
      if (!value || typeof value !== 'object' || !Object.keys(value as object).length) return;
      claims.push({
        claimPath: 'notes.manualContext',
        value: { section, ...(value as Record<string, unknown>) },
        confidence: 1,
      });
    };
    addSection('goals', params.goals);
    addSection('challenges', params.challenges);
    addSection('synthesis', params.synthesis);
    if (!claims.length) return;

    await this.recordContextSource({
      organizationId: params.organizationId,
      sourceType: 'organization_context_store',
      sourceId: params.organizationId,
      authorUserId: params.userId || null,
      channel: 'admin',
      sourceLabel: 'Organization context store saved (redesign screens)',
      content: {
        goals: params.goals ?? {},
        challenges: params.challenges ?? {},
        synthesis: params.synthesis ?? {},
      },
      isExplicit: true,
      claims,
    });
  }
```

**Krok 2 — wywołanie w PUT handlerze.** Dodaj import na górze
`organization-context-store.routes.ts` (blok importów, po `Logger`, kolejność
alfabetyczna po ścieżce względnej):

```ts
import organizationContextService from '../services/organizationContext/OrganizationContextService.js';
```

Wstaw wywołanie PO bloku sprawdzającym `persisted` (kończy się linią 120),
PRZED `res.json({...})` (linia 121) — WŁASNY `try/catch`, fail-soft:

```ts
    // 17-I R1 (dyżur 205): zapis-obok do claim-writer. Fail-soft — błąd
    // tutaj NIGDY nie psuje odpowiedzi głównego, CLOSED_FINAL zapisu powyżej.
    try {
      await organizationContextService.recordOrganizationContextStoreSave({
        organizationId: orgId,
        userId: userId ?? null,
        goals: hasGoals ? goals : undefined,
        challenges: hasChallenges ? challenges : undefined,
        synthesis: hasSynthesis ? synthesis : undefined,
      });
    } catch (claimErr: any) {
      Logger.error('[org-context-store] parallel claim-write failed (non-fatal)', {
        orgId,
        err: claimErr?.message,
      });
    }

    res.json({
```

**NIE dodajesz `sourceFramework`-style rozszerzeń** ani nowych `claimPath` do
`ORGANIZATION_CONTEXT_CLAIM_PATHS` w tym dyżurze — `notes.manualContext` już
istnieje i już jest konsumowana; wprowadzenie nowej, dedykowanej ścieżki
(np. `organization.contextStoreSnapshot`) wymagałoby dodatkowo wpięcia jej w
`buildResolvedContext` (linie ok. 1327-1552) — to większy krok niż „1
wywołanie w save-handlerze” z §9, poza zakresem R1.

**Ukończone, gdy:** test mutacyjny (patrz niżej) pokazuje: (1) PUT z
niepustym `goals`/`challenges`/`synthesis` tworzy wiersz w
`organization_context_items` (`source_type='organization_context_store'`) i
odpowiadające wiersze w `organization_context_claims`
(`claim_path='notes.manualContext'`); (2) `await
organizationContextService.buildResolvedContext(orgId)` PO tym zapisie ma
treść z payloadu widoczną w `resolved.notes.manualContext` (nie `null`, nie
pominiętą); (3) PUT z payloadem, w którym `organizationContextService`
rzuca błąd (np. zamockowany), nadal zwraca `200` z niezmienionym kontraktem
odpowiedzi — CLOSED_FINAL zachowanie nietknięte.

**Test:** nowy plik `.pg.test.ts` w
`server/src/services/organizationContext/__tests__/`, wzorem
`orgBvpMountedGoldenPath.pg.test.ts` (sprawdź jego strukturę przed pisaniem —
realny Postgres, nie mock) — PUT przez zamontowany router (albo bezpośrednie
wywołanie `recordOrganizationContextStoreSave` + odczyt z realnej bazy, jeśli
montowanie całego Gateway jest nieproporcjonalne do zakresu), potem
`rebuildSnapshot`/`buildResolvedContext` i asercja na treści.

## R2 — Sygnały: zamknięcie/wyciszenie → pamięć kontekstu

Plik: `server/src/routes/my-work/signals.routes.ts`. Dwie trasy, dokładnie
linie z zamówienia: `POST /signals/:key/snooze` (zaczyna się linią 151),
`POST /signals/:key/dismiss` (zaczyna się linią 180). Wzorzec do
skopiowania: `server/src/routes/context.routes.ts:55-61` i `:99-107` —
`organizationContextService.recordManualAIContext({organizationId, userId,
contextId, payload: {name, type, content, priority}})`, wołane PO udanym
zapisie do bazy.

**PUŁAPKA (zmierzona, `OrganizationContextService.ts:652-666`,
`buildManualContextClaims`):** jeśli `payload.content` jest puste, funkcja
zwraca `[]` — ZERO claimów, mimo że wywołanie samo „się udaje” (obiekt
`organization_context_items` i tak powstaje, ale bez żadnego claimu do
odczytu). `content` MUSI być niepustym, opisowym zdaniem — nie samym `req.
params.key`.

Dodaj DWA importy na górze pliku (po istniejącym bloku, kolejność
alfabetyczna po ścieżce względnej, wzorem sąsiadów w `my-work/` —
`calendar.routes.ts:16`/`home.routes.ts:21` już importują `logger` z tej
samej względnej ścieżki):

```ts
import logger from '../../utils/Logger.js';
import organizationContextService from '../../services/organizationContext/OrganizationContextService.js';
```

**Snooze** — wstaw PO odczycie `row` (kończy się linią 175), PRZED
`res.status(200).json(...)` (linia 176):

```ts
    try {
      await organizationContextService.recordManualAIContext({
        organizationId: identity.orgId,
        userId: identity.userId,
        contextId: `signal-snooze-${req.params.key}`,
        payload: {
          name: `Signal snoozed: ${req.params.key}`,
          type: 'signal_snooze',
          content: `Użytkownik odłożył sygnał ${req.params.key} do ${
            row?.snoozed_until ?? 'nieznanego terminu'
          } (preset: ${preset}).`,
          priority: 0,
        },
      });
    } catch (err: any) {
      logger.error('[signals] snooze claim-write failed (non-fatal)', {
        key: req.params.key,
        err: err?.message,
      });
    }
```

**Dismiss** — analogicznie, wstaw PO odczycie `row` (kończy się linią 196),
PRZED `res.status(200).json(...)` (linia 197):

```ts
    try {
      await organizationContextService.recordManualAIContext({
        organizationId: identity.orgId,
        userId: identity.userId,
        contextId: `signal-dismiss-${req.params.key}`,
        payload: {
          name: `Signal dismissed: ${req.params.key}`,
          type: 'signal_dismiss',
          content: `Użytkownik odrzucił sygnał ${req.params.key} jako
            nieistotny/rozwiązany (${row?.dismissed_at ?? 'brak znacznika czasu'}).`,
          priority: 0,
        },
      });
    } catch (err: any) {
      logger.error('[signals] dismiss claim-write failed (non-fatal)', {
        key: req.params.key,
        err: err?.message,
      });
    }
```

Oba wywołania fail-soft — błąd claim-writera nigdy nie zamienia udanego
snooze/dismiss w błąd HTTP.

**NIE dotykasz `mute-type`/`mute-domain`** (linie 105-149) — to globalna
preferencja typu/domeny sygnałów, nie decyzja o KONKRETNYM sygnale, poza
zakresem R2.

**Ukończone, gdy:** test mutacyjny pokazuje: (1) `POST .../snooze` i `POST
.../dismiss` nadal zwracają identyczny kontrakt odpowiedzi co dziś
(`{snoozedUntil}`/`{dismissedAt}`); (2) po każdym wywołaniu istnieje wiersz w
`organization_context_claims` z `claim_path='notes.manualContext'` i
`value.type` odpowiednio `'signal_snooze'`/`'signal_dismiss'`, z niepustym
`value.content`; (3) ten claim jest widoczny w `resolved.notes.manualContext`
po rebuildzie.

**Test:** rozszerz istniejący `server/src/routes/my-work/__tests__/
signals.routes.org-isolation.test.ts` (mockuje `queryHelpers` — NIE nadaje
się do dowodu zapisu do `organization_context_claims`) LUB — lepiej — dodaj
NOWY `.pg.test.ts` w tym samym katalogu, wzorem konwencji
`organizationContext/__tests__/*.pg.test.ts`, z realnym Postgres, żeby
faktycznie zweryfikować wiersz w `organization_context_claims`.

## R3 — Decyzje: recordDecision przy rekomendacji

Plik: `server/src/services/ai/tools/createDecision.ts`, funkcja
`fillDecisionStructuralFields` (linie 503-663), wołana z `createDecision`
(linia 750: `void fillDecisionStructuralFields(id, orgId, language);`). To
jest miejsce, gdzie rekomendacja NAPRAWDĘ powstaje — generuje `alternatives`/
`riskImpact`/`consequences`/`recommendation`/`rationale` przez
`decisionService.generateSection` i persystuje w kolumnach `decisions`
(migracja 902).

**PUŁAPKA KRYTYCZNA (zmierzona, `decisionMemoryService.ts:81-118` i
`:213-249`):** `recordDecision` ZAWSZE wstawia `outcome_status = 'pending'`
(hardkodowane w INSERT). `findSimilarDecisions` filtruje `WHERE
outcome_status != 'pending'`. Nowo nagrana decyzja jest więc NIEWIDOCZNA dla
`findSimilarDecisions`, dopóki coś nie zmieni jej statusu — a
`recordOutcome`, jedyna funkcja, która to robi, ma DZIŚ ZERO wołaczy w całym
`server/**`. To NIE jest bug do naprawienia w tym dyżurze (zmiana filtra albo
domyślnego statusu zmieniłaby semantykę „uczymy się z ROZSTRZYGNIĘTYCH
decyzji” dla wszystkich konsumentów, w tym Deep Thinking) — to osobne,
nienaprawione ogniwo, które MUSISZ nazwać w raporcie.

**Krok 1 — rozszerz sygnaturę `fillDecisionStructuralFields`** o `title` i
`userId` (oba już są w zasięgu funkcji `createDecision`, po prostu
nieprzekazane):

```ts
async function fillDecisionStructuralFields(
  decisionId: string,
  orgId: string,
  language: 'pl' | 'en',
  title: string,
  userId: string
): Promise<void> {
```

Zaktualizuj wywołanie w linii 750:

```ts
    void fillDecisionStructuralFields(id, orgId, language, title, userId);
```

**Krok 2 — wywołaj `recordDecision` PO udanym `UPDATE decisions SET ...`**
(blok kończy się linią ok. 663, tuż przed `logger.info('[create_decision]
structural columns filled...')`), fail-soft, pomijając cicho gdy `userId`
puste (brak uwierzytelnionego użytkownika w kontekście narzędzia):

```ts
    if (userId) {
      try {
        const { recordDecision } = await import('../decisionMemoryService.js');
        await recordDecision({
          organizationId: orgId,
          userId,
          // Jedna decyzja czatu = jedna "sesja” pamięci — nie ma tu naturalnego
          // sessionId (to nie jest sesja Deep Thinking); decisionId jest unikalny
          // i stabilny, więc służy jako syntetyczny klucz sesji.
          sessionId: decisionId,
          decisionSummary: title,
          recommendationText: recommendation || null,
          optionsConsidered: (alternatives || [])
            .map((a: any) => String(a?.option ?? a?.title ?? '').trim())
            .filter(Boolean),
          confidenceScore: null,
          tags: ['chat_created_decision'],
        });
      } catch (memErr) {
        logger.warn(
          `[create_decision] decisionMemoryService.recordDecision failed id=${decisionId}: ${
            memErr instanceof Error ? memErr.message : String(memErr)
          }`
        );
      }
    }
```

Wstaw ten blok PO sekcji, w której `alternatives`/`recommendation` są już
policzone (dostępne od linii ok. 524-589), np. bezpośrednio przed komentarzem
„Persist into the REAL structured columns” (linia ok. 607) albo tuż po
`UPDATE decisions SET ...` — wybierz miejsce, w którym `alternatives`/
`recommendation` istnieją w zasięgu i `decisionId`/`orgId` już się
zweryfikowały (funkcja nie wyszła wcześniej przez `return`).

**NIE dotykasz `case 'create_decision':` w `toolDefinitions.ts:704`**
(legacy P2-ścieżka, kandydatka do wygaszenia po 197-E2) ani
`executeFindDecisions`/`case 'find_similar_decisions':` (czytelnik zostaje
nietknięty).

**Ukończone, gdy:** test mutacyjny pokazuje: (1) po `createDecision(...)` z
poprawnym `title`+`context.userId`+`context.organizationId`, w
`ai_decision_outcomes` istnieje wiersz z `decision_summary` = tytuł i
`recommendation_text` niepuste (o ile `fillDecisionStructuralFields`
wygenerowała rekomendację — zmockuj/steruj `decisionService.generateSection`
w teście, żeby to było deterministyczne); (2) TEST JAWNIE wywołuje
`recordOutcome({decisionId, outcomeStatus: 'neutral'})` na tym wierszu (to
jest dozwolone obejście test-only pułapki `pending`, NIE produkcyjna
naprawa); (3) PO tym `findSimilarDecisions({organizationId, query: title})`
zwraca ten wpis w wyniku. Raport musi wprost nazwać, że BEZ kroku (2) wpis
pozostaje niewidoczny dla `findSimilarDecisions` w prawdziwym środowisku, bo
`recordOutcome` nie ma dziś żadnego produkcyjnego wołacza.

**Test:** nowy plik, wzorem konwencji `.pg.test.ts` w `server/src/services/
ai/__tests__/` (sprawdź `agentPlannerDispatch.pg.test.ts` dla struktury) —
realny Postgres, `ENABLE_TERESA_RECORD_CREATE` jest domyślnie `true`, nie
wymaga flagowania w teście.

## R4 — Migracja 946: checklist zdjęcia blokady (bez zdejmowania)

Plik do WYŁĄCZNIE odczytu/pomiaru: `server/migrations/
946_tool_outputs_reports_lineage.sql`. Nagłówek (linia ok. 10): „NIE
uruchamiamy tej migracji na żywej bazie w tej fali.”

**Zmierzone: to jest dyscyplina procesu, nie bramka w kodzie.**
`server/scripts/migrate.postgres.ts` wyklucza WYŁĄCZNIE podkatalogi `ops/`,
`never-ran/`, `rollback/` (`KNOWN_EXCLUDED_MIGRATIONS_SUBDIRS`, linia 155).
Ten plik leży bezpośrednio w `server/migrations/` — sam nagłówek to
potwierdza. Żaden mechanizm w kodzie nie odróżnia go od pozostałych
migracji: na Twoim własnym, efemerycznym lokalnym kontenerze (i na CI-owym
day161-gate) wykona się automatycznie w KAŻDYM pełnym przebiegu od pustej
bazy.

**Zmierzone: kod obu stron jest gotowy, nie eksperymentalny.**
`server/src/services/tools/toolOutputSnapshotService.ts` (nagłówek: „`tool_
outputs` IS the canonical, immutable snapshot”) zakłada BEZWARUNKOWO
istnienie tabel z tej migracji — zero `to_regclass`/`hasColumn`-guardów.
Żywi konsumenci obu stron: backend — `ToolOutputsController.ts`,
`toolOutputs.routes.ts` (montowany w `Gateway.ts`), `teresaKernel.ts` +
`teresaEventStore.ts` (tabela `tool_session_events`); front —
`DiscoveryToolsHub.tsx`, `ToolOutputsPanel.tsx`. Migracja
`947_tool_outputs_idempotency_guard.sql` (BEZ własnej blokady w nagłówku)
dokłada `UNIQUE INDEX` na `tool_outputs` — zależy na istnieniu tabeli z 946,
dowód, że para 946/947 jest już zaprojektowana jako jeden krok wdrożenia.

**Uwaga: TRZY różne pliki mają prefiks `946_` w repo.**
`946_benefit_tracking_fresh_install.sql` nie ma żadnej blokady (uruchamia
się już dziś bez ostrzeżeń). `946_siri_16d_source_of_truth.sql` JEST
zablokowany, ale z INNEGO powodu (spór nazewnictwa SIRI, COORD-02) — nie myl
go z przedmiotem R4 i nie proponuj dla niego checklisty.

**Krok 1 — test lokalny pełnego przebiegu.** Uruchom
`scripts/dev/day161-fresh-migration-check.sh` (NIE edytuj jego treści) z
WŁASNYMI zmiennymi środowiskowymi, np.:

```bash
DAY161_CONTAINER_NAME=cx-day205-migracje-pg \
DAY161_PG_PORT=6146 \
DAY161_DATABASE_NAME=cx205migracje \
DAY161_ARTIFACT_DIR=/private/tmp/cx-day205-madrosc-artefakty/day161 \
scripts/dev/day161-fresh-migration-check.sh
```

(Dobierz `DAY161_PG_PORT` tak, żeby NIE kolidował z Twoim własnym `PORT_DB`
6145 ani z portami dyżurów równoległych z `LISTA_PORTOW_ZAJETYCH` — zweryfikuj
`lsof` przed uruchomieniem, tak jak w BLOKU 0.) Skrypt sam tworzy i sprząta
swój kontener (`trap cleanup EXIT`) — nie twórz go ręcznie, nie zostawiaj go
żywym po zakończeniu.

Sprawdź w logu (`${DAY161_ARTIFACT_DIR}/day161-fresh-migration-gate.log`):
migracja 946 i 947 pojawiają się w liście zastosowanych, przebieg kończy się
sukcesem, replay (drugi przebieg na tej samej bazie) aplikuje ZERO nowych
migracji (`Applying migrations: 0`).

**Krok 2 — checklist dla nadzorcy (produkt R4).** Napisz w raporcie sekcję
„Checklist zdjęcia blokady migracji 946” z KONKRETNYMI, sprawdzalnymi
punktami — nie samym zdaniem „kod gotowy, można odpalać”. Minimalny szkielet
(rozbuduj na podstawie własnego pomiaru, nie kopiuj ślepo):

1. Dowód lokalnego pełnego przebiegu z TEGO dyżuru (log + hash artefaktu) —
   ✅/❌ z linkiem do pliku w `ARTEFAKTY`.
2. Potwierdzenie, że 947 aplikuje się w tej samej fali bez błędu (UNIQUE
   INDEX na istniejącej już `tool_outputs`) — ✅/❌.
3. Potwierdzenie, że docelowa baza (demo/staging) NIE ma dziś żadnej tabeli
   o nazwach z tej migracji pod INNYM kształtem (ryzyko kolizji nazw) —
   wymaga zapytania na docelowej bazie, WYKONUJE nadzorca, nie Ty.
4. Backup/punkt przywrócenia przed uruchomieniem na żywej bazie (zgodnie z
   `Harvard/wdrozenie-100/_RUNBOOK_COFANIA.md`) — potwierdza nadzorca.
5. Kolejność: 946 przed 947 (numeracja to już wymusza w `migrate.
   postgres.ts`, ale nadzorca powinien to zweryfikować na docelowej bazie
   przed uruchomieniem, nie zakładać).
6. Po uruchomieniu: potwierdzenie, że `toolOutputSnapshotService`-owe
   trasy (`GET/POST` pod `toolOutputs.routes.ts`) faktycznie odpowiadają
   (nie 500 „relation does not exist”) na docelowym środowisku.

**Ukończone, gdy:** log day161 z 946 aktywną istnieje w `ARTEFAKTY`, checklist
w raporcie ma co najmniej te 6 punktów z konkretnymi warunkami
sprawdzalnymi (nie sloganami), i raport wprost mówi „NIE uruchomiono na
żadnej bazie poza lokalnym efemerycznym kontenerem tego dyżuru”.

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis | `server/src/services/organizationContext/OrganizationContextService.ts` — wyłącznie nowa metoda `recordOrganizationContextStoreSave` (wstawiana po linii 1763) |
| Zapis | `server/src/routes/organization-context-store.routes.ts` — nowy import + wywołanie w PUT handlerze (ok. linii 8-12 i 120-121); zero zmian kontraktu odpowiedzi |
| Zapis | `server/src/routes/my-work/signals.routes.ts` — nowe importy + dwa wywołania w snooze (ok. linii 151-178) i dismiss (ok. linii 180-199) |
| Zapis | `server/src/services/ai/tools/createDecision.ts` — sygnatura `fillDecisionStructuralFields` (linia 503), wywołanie (linia 750), nowy blok `recordDecision` wewnątrz funkcji |
| Zapis | testy R1 (`server/src/services/organizationContext/__tests__/`), R2 (`server/src/routes/my-work/__tests__/`), R3 (`server/src/services/ai/__tests__/`) — lokalizację/konwencję potwierdź wg sąsiadów w każdym katalogu |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY205_MADROSC_REPORT.md` |
| Zapis | artefakty (logi day161, hashe) w `/private/tmp/cx-day205-madrosc-artefakty/` — NIE wchodzą do repo |
| Odczyt | pięć ekranów `src/components/Organization/redesign/*.tsx`, `src/hooks/useOrgContextSync.ts`, `useOrgContextStoreSection.ts` — kontekst R1; **nie zmieniasz** |
| Odczyt | `server/src/routes/context.routes.ts` — wzorzec `recordManualAIContext` dla R2; **nie zmieniasz** |
| Odczyt | `server/src/services/ai/decisionMemoryService.ts` — `recordDecision`/`findSimilarDecisions`/`recordOutcome`; **nie zmieniasz** (poza wywołaniem w teście R3, patrz DoD) |
| Odczyt | `server/src/services/ai/toolDefinitions.ts` — `case 'create_decision'` (linia 704), `executeFindDecisions`/`case 'find_similar_decisions'` (linie ok. 602, 1300-1320); **nie zmieniasz** |
| Odczyt | `server/migrations/946_tool_outputs_reports_lineage.sql`, `947_tool_outputs_idempotency_guard.sql`, `946_benefit_tracking_fresh_install.sql`, `946_siri_16d_source_of_truth.sql`, `server/scripts/migrate.postgres.ts`; **nie zmieniasz żadnego** |
| Uruchomienie (bez edycji) | `scripts/dev/day161-fresh-migration-check.sh` — wyłącznie z własnymi zmiennymi środowiskowymi portu/kontenera/bazy |
| Odczyt | `docs/program/funkcje/ARCHITEKTURA_AGENTA_TERESY.md` §9 — kontrakt tego dyżuru; **nie zmieniasz** |

★ **Rozłączność z dyżurami 204/206 (równoległe):** ich zakres plikowy NIE był
znany przy składaniu tej instrukcji (patrz `LISTA_PORTOW_ZAJETYCH` w cfg205).
Jeśli przy starcie zobaczysz w swoim worktree zmiany poza plikami z tabeli
powyżej, STOP i zgłoś w raporcie zamiast zgadywać.

# 5. TWARDE ZASADY

- ★★ **Zero szukania własnych znalezisk poza czterema nazwanymi
  pozycjami.** Jeśli zobaczysz coś piąte, zapisz w raporcie jako inwentarz,
  nie naprawiaj.
- ★★ **R1: `claimPath` MUSI być `'notes.manualContext'`, nie `'strategic.
  goals'`/`'operations.constraints'`** — te ścieżki renderują wyłącznie
  stringi, obiektowa treść wylądowałaby jako cichy `null`. Zweryfikuj to SAM
  (T2 w bloku 0), nie tylko uwierz tej instrukcji.
- ★★ **R1: zero zmian pięciu ekranów redesignu ani ich wspólnych haków.**
  CLOSED_FINAL — zapis-obok wyłącznie w backendowym PUT handlerze, fail-soft.
- ★★ **R2: `payload.content` w `recordManualAIContext` MUSI być niepustym
  zdaniem** — puste `content` = `buildManualContextClaims` zwraca `[]`, cicha
  atrapa.
- ★★ **R3: nie naprawiasz `recordOutcome`** (zero produkcyjnych wołaczy) —
  to osobna decyzja produktowa, nazwij ją w raporcie jako inwentarz. Test
  MOŻE wywołać `recordOutcome` bezpośrednio, żeby udowodnić ścieżkę odczytu
  — to jest dozwolone obejście test-only, nie naprawa.
- ★★ **R4: nie uruchamiasz migracji 946 przeciw ŻADNEJ bazie poza własnym
  efemerycznym kontenerem tego dyżuru.** Zero demo, staging, produkcja.
  Produktem R4 jest CHECKLIST, nie decyzja o wdrożeniu.
- ★★ **R4: nie zmieniasz treści żadnego pliku migracji** — nawet
  nagłówka-ostrzeżenia. To dyscyplina procesu, usuwa ją nadzorca po
  przejściu checklisty.
- **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.**
- Pułapka: `No test files found` NIE jest `PASS`. Sprawdź `numTotalTests` > 0.
- ★ Port **5000 zajęty na stałe przez macOS Control Center**, **5037 przez
  adb**. Sprawdź też 5060-5061 (dyżur 196) i porty równoległych 204/206 przed
  startem.
- **Każdą cytowaną linię kodu/dokumentu sprawdzasz sam przed wklejeniem do
  raportu.** Numery w tej instrukcji zweryfikowano wobec markera
  `c50847c259`, ale pliki żyją — jeśli linia się przesunęła, zaufaj SWOJEMU
  pomiarowi, nie tej instrukcji.
- **Sekcja „TWIERDZENIA NIEZWERYFIKOWANE” w raporcie jest obowiązkowa.**
  Wypisz w niej wprost co najmniej: (a) czy `buildResolvedContext` faktycznie
  pokazuje treść R1 po rebuildzie, z cytatem fragmentu JSON, nie samym „tak”;
  (b) czy `recordOutcome` NAPRAWDĘ ma dziś zero produkcyjnych wołaczy — Twój
  własny grep, nie ten z instrukcji; (c) czy `946_benefit_tracking_fresh_
  install.sql` i `946_tool_outputs_reports_lineage.sql` (dwa RÓŻNE pliki z
  tym samym prefiksem numerycznym) zastosowały się OBA bez konfliktu w
  Twoim przebiegu day161 — to nie było zweryfikowane przy składaniu tej
  instrukcji, tylko wywnioskowane z braku mechanizmu blokującego; (d) czy w
  `server/migrations/` istnieje jeszcze jakiś inny plik z prefiksem `946_`
  lub `947_`, którego to zestawienie nie objęło.
