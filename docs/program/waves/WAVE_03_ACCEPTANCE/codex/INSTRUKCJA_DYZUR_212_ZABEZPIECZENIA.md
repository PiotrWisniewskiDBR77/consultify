# INSTRUKCJA DYŻURU nr 212 — Codex — „Przemiatanie zabezpieczeń bez testu omijającego — inwentarz czterech rodzin (zasięg/wielodostępność, brama zatwierdzenia/stanu, idempotencja, uprawnienia), ocena pokrycia MUTACYJNA (nie z lektury nazwy testu) i dopisanie testów omijających w kolejności ryzyka, bez naprawiania samych zabezpieczeń"

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
> **wyłącznie** `/private/tmp/cx-day212-zabezpieczenia`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `fe33ce8036`**
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
Zakres: **PRZEKROJOWY — nie jeden moduł menu, tylko cztery rodziny mechanizmów bezpieczeństwa rozsiane po `server/src/**` i `server/scripts/**`: (a) filtry zasięgu/wielodostępności (`organization_id`, `scope`, `owner_id` w zapytaniach), (b) bramy zatwierdzenia i stanu (`status !== APPROVED/PUBLISHED/...`), (c) idempotencja (klucze `clientRequestId`, `NOT EXISTS`, checksumy), (d) uprawnienia i role (guardy tras `requireX`). Podstawa zlecenia: `docs/program/funkcje/WSPOLNA_PRZYCZYNA_ODBIORY_204_210.md` (kanoniczna, `status: canonical`, 31.08.2026) oraz plan `docs/program/funkcje/LISTA_DYZUROW_211_222.md`, pozycja „212 · Przemiatanie zabezpieczeń bez testu omijającego" (FALA A). Dyżur NIE naprawia żadnego znalezionego zabezpieczenia — wyłącznie mierzy pokrycie i dokłada testy omijające**.
Trasy front: `Brak. Ten dyżur nie zmienia ani jednego pliku pod `src/` (frontend). Jeśli podczas inwentaryzacji odkryjesz zabezpieczenie WYŁĄCZNIE frontendowe (np. warunek w komponencie ukrywający przycisk zapisu) — wpisujesz je do inwentarza rodziny (b) lub (d) z adnotacją „frontend, nie backend", ale test omijający piszesz na warstwie, która NAPRAWDĘ blokuje zapis (zwykle backend — front-only guard nigdy nie jest jedyną linią obrony i nie wolno Ci tak go zaraportować bez sprawdzenia backendu).`. Trasy tył: `Zero nowych tras. Licencja to WYŁĄCZNIE odczyt istniejących zabezpieczeń + zapis nowych plików testowych. Cztery rodziny, z przykładami zmierzonymi na SHA `fe33ce8036` (aktualne linie — audyty 204/207/210 mierzyły je na innych SHA, linie się przesunęły): (a) SCOPE — `server/src/services/ai/embeddingService.ts:341` `buildKnowledgeDocAccessFilter` (wołania: `searchPg` `:316`, `searchSqlite` fallback `:247`) — dyżur 210, JUŻ POKRYTE (`server/src/services/ai/__tests__/day210.embeddingScope.pg.test.ts:193` i `:221`, fix `884893d41e`); `server/src/routes/raid.routes.ts:36-44` `assertRaidItemInOrganization`; `server/src/services/initiative/initiativeClosureService.ts:234-244` `assertInitiativeInOrg`. (b) BRAMA — `server/src/services/aiActionExecutor.ts:773-774` `if (action.status !== ACTION_STATUS.APPROVED) return {success:false, error:...}` w `executeAction` — dyżur 207, gałąź `codex/day207-write-proposal-20260831` NIGDY nie scaliła się do `codex/m03-admin-20260824` (`git merge-base --is-ancestor 944a5caea4 HEAD` → NIE), więc ta brama jest infrastrukturą SPRZED 207, kandydat testu: `tests/unit/backend/aiActionExecutor.wave3-runtime.test.ts:427-448` (`'never executes a rejected proposal'`) — STATUS POKRYCIA NIEZNANY, to jest dokładnie to, co ten dyżur ma rozstrzygnąć mutacją; `server/src/controllers/AssessmentController.ts:1458-1463` `.status !== 'APPROVED'` (blokuje generowanie inicjatyw z niezatwierdzonego assessmentu, 409); `server/src/domain/initiatives-execution/managementIntervention.ts:425` `.status !== 'APPROVED' || envelope.actorId !== c.ownerId` (podwójna bramka: stan + właściciel). (c) IDEMPOTENCJA — `server/scripts/legacy-task-cutover-runner.ts` Guard A `:208` i `:230` (`NOT EXISTS` w `selectCandidateTasks`) + Guard B `:278-284` (checksum w `migrateOneTask`) — dyżur 204, JUŻ POKRYTE (`tests/integration/day204-legacy-task-cutover-idempotency.realdb.test.ts:170` i `:205`, fix `ab638ae4f8`); `server/src/domain/initiatives-execution/materialCommand.ts:457-491` `executeMaterialCommand` (`findReceipt` `:469-472`, konflikt `MaterialCommandConflictError` `:475-482`) — silnik idempotencji CAŁEGO execution-spine, ma dedykowany `tests/unit/initiatives-execution/materialCommand.test.ts`, sprawdź mutacją czy naprawdę łapie ominięcie. (d) UPRAWNIENIA — `server/src/middleware/rbac.middleware.ts:173` `requireRole` (ma bogate pokrycie, `tests/unit/backend/middleware/rbac.middleware.test.ts` — regresja, nie nowy test, chyba że mutacja pokaże inaczej); `server/src/services/executionActionRegistryService.ts:44-51` `requireImplementedExecutionAction`; `server/src/services/legacyCutover/requireActiveMembership.ts:47-58` `requireFinanceEditorMembership`.`.

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
WT=/private/tmp/cx-day212-zabezpieczenia
MARKER=fe33ce8036

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day212-zabezpieczenia-20260831 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day212-zabezpieczenia/config.worktree"
cat "$VAULT/worktrees/cx-day212-zabezpieczenia/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day212-zabezpieczenia-scratch
mkdir -p /private/tmp/cx-day212-zabezpieczenia-artefakty

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
git -C "$VAULT" log --oneline fe33ce8036..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only fe33ce8036..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day212-zabezpieczenia-20260831
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only fe33ce8036..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `jedenaście` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day212-zabezpieczenia

# (T1) Rodzina (a) — surowy census 'organization_id = $N' w server/src, bez testow
grep -rEo 'organization_id\s*=\s*\$[0-9]+|organization_id\s*=\s*\?' server/src --include="*.ts" | grep -v __tests__ | wc -l
#   ★ UWAGA CUDZYSLOWU: wzorzec MUSI byc w cudzyslowie POJEDYNCZYM (apostrofy) — w
#   podwojnym bash zjada \$ na goly $ i regex daje INNY (nizszy) wynik. Sprawdz to
#   sam, jesli nie wierzysz: to jest dokladnie ksztalt bledu, ktory ten dyzur szuka.
#   oczekiwane: rzedu tysiecy (na SHA fe33ce8036 zmierzono 6791, cudzyslow pojedynczy) — to jest census SKALI,
#   nie lista pozycji do inwentarza jeden-po-jednym (patrz T2 dla wezszej miary)

# (T2) Rodzina (a) — wezszy census: nazwane funkcje-bramki wielokrotnego uzytku
grep -rEno "(function|async function|private async|public async|private|async)\s+(assert[A-Za-z]*(Org|Scope|Owner)[A-Za-z]*|build[A-Za-z]*(Scope|AccessFilter)[A-Za-z]*|enforce[A-Za-z]*(Scope|Org)[A-Za-z]*)\s*\(" server/src --include="*.ts" | grep -v __tests__ | sort -u | wc -l
#   oczekiwane: 34 (to jest TWOJ enumerowalny inwentarz rodziny a — patrz A.1)

# (T3) Rodzina (b) — porownania stanu-bramki
grep -rEno "\.status\s*!==?\s*['\"A-Za-z_.]*(APPROVED|PUBLISHED|ACTIVE|CONFIRMED|VERIFIED|COMPLETED)['\"A-Za-z_.]*" server/src --include="*.ts" | grep -v __tests__ | wc -l
#   oczekiwane: 43

# (T4) Rodzina (c) — clientRequestId, pliki i wystapienia
grep -rl "clientRequestId" server/src server/scripts --include="*.ts" | grep -v __tests__ | sort
grep -rn "clientRequestId" server/src server/scripts --include="*.ts" | grep -v __tests__ | wc -l
#   oczekiwane: 6 plikow, 292 wystapien lacznie

# (T5) Rodzina (d) — nazwane eksportowane guardy requireX
grep -rEno "export (async function|function|const) (require[A-Za-z]+)" server/src --include="*.ts" | grep -v __tests__ | sed -E 's/^[^:]+:[0-9]+://' | sort -u | wc -l
#   oczekiwane: 69

# (T6) SHA markera = tip galezi bazowej; 204 i 210 SCALONE, 207 NIGDY nie scaliony
git log -1 --format='%H %D'
git merge-base --is-ancestor ab638ae4f8 HEAD && echo '204 fix: SCALONY' || echo '204 fix: BRAK'
git merge-base --is-ancestor 884893d41e HEAD && echo '210 fix: SCALONY' || echo '210 fix: BRAK'
git merge-base --is-ancestor 944a5caea4 HEAD && echo '207: SCALONY (nieoczekiwane!)' || echo '207: NIGDY NIE SCALONY (oczekiwane)'

# (T7) 204 Guard A/B — linie aktualne + test dedykowany
grep -n 'NOT EXISTS\|checksum,status FROM legacy_task_cutover_ledger' server/scripts/legacy-task-cutover-runner.ts
grep -n "FIX-204-3 Guard" tests/integration/day204-legacy-task-cutover-idempotency.realdb.test.ts
#   oczekiwane: NOT EXISTS w liniach ok. 208 i 230; checksum select ok. 279; testy w liniach ok. 170 i 205

# (T8) 210 fallback — linie aktualne + test dedykowany
grep -n "buildKnowledgeDocAccessFilter\|async searchSqlite\|async searchPg" server/src/services/ai/embeddingService.ts
grep -n "fallback/searchSqlite branch" server/src/services/ai/__tests__/day210.embeddingScope.pg.test.ts
#   oczekiwane: buildKnowledgeDocAccessFilter ok. 341, searchSqlite ok. 223, wolanie filtra w searchSqlite ok. 247; testy ok. 193 i 221

# (T9) 207 brama — linia aktualna + kandydat testu (status pokrycia NIEZNANY, do rozstrzygniecia)
grep -n "action.status !== ACTION_STATUS.APPROVED" server/src/services/aiActionExecutor.ts
grep -n "never executes a rejected proposal" tests/unit/backend/aiActionExecutor.wave3-runtime.test.ts
#   oczekiwane: brama ok. 773; kandydat testu ok. 427 — NIE zaklada, ze pokrywa, MUTACJA rozstrzyga

# (T10) Pulapka clearAllMocks — dyzur 211 jeszcze nie wszedl
grep -n "vi.clearAllMocks\|^beforeEach" tests/setup.ts | tail -5
#   oczekiwane: beforeEach globalny z vi.clearAllMocks() w liniach ok. 809-811

# (T11) 00_ZASADY_PRACY.md — dzisiejsza liczba regul
grep -c '^## ★★ REGUŁA NR' docs/program/funkcje/00_ZASADY_PRACY.md
wc -l docs/program/funkcje/00_ZASADY_PRACY.md
#   oczekiwane: 6 regul, 86 linii — Twoja wchodzi jako REGUŁA NR 7
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day212-zabezpieczenia-20260831` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6152`. Twój JEDYNY port harnessu to `5094 i 5095`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day212-pg`**. **ZAKAZANE:** `zajęte 6012, 5433, 6047, 6054-6151, 5010-5093, 6404-6411 (dyżury i odbiory wcześniejsze). ★★ ZABRONIONE NA PRZÓD, NIE BIERZ: 6153-6157 oraz 5096-5105 (dyżury 213-217, mogą biec równolegle wg `LISTA_DYZUROW_211_222.md` FALA B). Twój WYŁĄCZNY przydział to baza `6152` i harness `5094 i 5095` — ★ najpewniej NIE BĘDZIESZ w ogóle potrzebować portu harnessu: ten dyżur nie renderuje żadnego ekranu (`POZYCJE_Z_FLAGAMI`: dyżur nie dotyka flag produktowych, zero UI). Zarezerwowany jest na wypadek, gdybyś jednak uruchamiał `server/src/index.ts` do własnych sond HTTP na bramie 207. ★ PORT 5000 ZAJĘTY NA STAŁE przez macOS Control Center. ★ PORT 5037 ZAJĘTY przez `adb`. ★ PORTY 5060-5061 ZAJĘTE (SIP/`ERR_UNSAFE_PORT`). Ta lista jest rozkazem pomiarowym — zweryfikuj `lsof -i` i `docker ps` przed startem.`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `★★ ŻADNEJ. Ten dyżur nie dotyka ani jednej flagi produktowej — nie czyta, nie dopisuje, nie zmienia wartości domyślnej. Zero UI, zero zrzutów light/dark, zero reguł 7/9/11 z `CLAUDE.md` w grze. Jeśli podczas pracy odkryjesz, że jakieś zabezpieczenie JEST bramkowane flagą (np. `ENABLE_V8_GLOBAL`, `ENABLE_TEST_AUTH_BYPASS` z `§0.2e`) — to jest dokładnie ta pułapka `Z33`: sprawdzasz, czy Twój test omijający przypadkiem nie mierzy zachowania flagi zamiast zachowania zabezpieczenia, i piszesz to w raporcie.`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: `★★ CAŁA macierz uprawnień i wszystkie zabezpieczenia produkcyjne są NIETYKALNE DO ZAPISU — to jest jedyny naprawdę twardy zakaz tego dyżuru (gate: „zakaz naprawiania samych zabezpieczeń"). Imiennie: `server/src/middleware/**` (w tym `rbac.middleware.ts`, `permission.middleware.ts`, `auth.middleware.ts`, `v8Auth.middleware.ts`, `effectiveCapability.middleware.ts`, `superAdmin.middleware.ts`, `auditsStrictMembership.middleware.ts`, `resultsInternalBetaVisibility.middleware.ts` — wszystkie 53 pliki), `server/src/services/aiActionExecutor.ts`, `server/src/services/ai/embeddingService.ts`, `server/src/services/ragService.ts`, `server/scripts/legacy-task-cutover-runner.ts`, `server/src/domain/initiatives-execution/materialCommand.ts` i `postgresMaterialCommandUnitOfWork.ts`, `server/src/routes/raid.routes.ts`, `server/src/services/initiative/initiativeClosureService.ts`, `server/src/controllers/AssessmentController.ts`, `server/src/domain/initiatives-execution/managementIntervention.ts`, `server/src/services/executionActionRegistryService.ts`, `server/src/services/legacyCutover/requireActiveMembership.ts`, oraz KAŻDA funkcja `assert*Org/Scope/Owner`, `build*Scope/AccessFilter`, `require*` znaleziona w inwentarzu §A.1. ★★ ZNALEZIENIE DZIURY (zabezpieczenie, które NIE działa) NIE JEST licencją na jej łatanie — zgłaszasz ją osobno w raporcie jako ZNALEZISKO, z `plik:linia`, dowodem i rekomendacją, i idziesz dalej. To jest dosłowne brzmienie gate'u zlecenia. ★ Jedyny wyjątek dotykania tych plików: mutacja TYMCZASOWA do dowodu (usuń warunek → zmierz czerwień → PRZYWRÓĆ przez `cp`, `git diff` po przywróceniu musi być pusty, `Z27`/`Z32`) — to nie jest zapis, to jest pomiar.`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY212_ZABEZPIECZENIA_REPORT.md`. Nie zmieniasz ŻADNEGO `MODULE_ACCEPTANCE.md` — ten dyżur jest przekrojowy (cztery rodziny mechanizmów rozsiane po kilkunastu modułach menu), nie należy do jednego modułu z `docs/program/waves/WAVE_03_ACCEPTANCE/modules/**`. ★ Jedyny inny dokument do zmiany poza raportem: `docs/program/funkcje/00_ZASADY_PRACY.md` — WYŁĄCZNIE dopisanie nowej, siódmej reguły na KOŃCU pliku (dziś kończy się na `## ★★ REGUŁA NR 6 — katalog referencyjny, nie /private/tmp/m03`, 86 linii — policz sam przez `grep -c '^## ★★ REGUŁA NR' docs/program/funkcje/00_ZASADY_PRACY.md`, oczekiwane: 6; Twoja wchodzi jako `REGUŁA NR 7`). Format: nagłówek `## ★★ REGUŁA NR 7 — <tytuł>` + 2-4 akapity prozy, tym samym stylem co reguły 1-6 (zdanie problemu, zdanie zasady, jedno konkretne odwołanie do incydentu 204/207/210 z `plik:linia`). **Zakaz zmiany treści reguł 1-6.**. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day212-zabezpieczenia-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day212-zabezpieczenia-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **Zakaz naprawiania zabezpieczeń.** Jeżeli podczas mutacji odkryjesz, że zabezpieczenie NIE działa (np. brama, którą da się ominąć nawet z testem obecnym, albo filtr zasięgu, który przepuszcza cudze dane) — NIE łatasz go. Zapisujesz jako ZNALEZISKO w osobnej sekcji raportu (`plik:linia`, dowód mutacyjny, promień rażenia) i idziesz dalej. Naprawa dziury jest zadaniem INNEGO dyżuru (wzorem: dyżur 213 dostał dług zasięgu z karty 210 pkt 5-9, dyżur 216 dostał atomowość migracji z karty 204 pkt 5-6 — Ty dostajesz TYLKO dowód i test, nigdy fix produkcyjny). | 31.08.2026 wróciły cztery dyżury odebrane adwersaryjnie (204, 207, 209, 210) — `docs/program/funkcje/WSPOLNA_PRZYCZYNA_ODBIORY_204_210.md` (kanoniczna). W TRZECH z czterech niezależni audytorzy zmierzyli ten sam defekt: skasowanie zabezpieczenia zostawiło dostarczony zestaw testów zielonym. 204 (idempotencja migracji, oba strażniki naraz) 11/11 zielonych po skasowaniu; 207 (brama zatwierdzenia zapisu) 4/4 zielone po skasowaniu; 210 (filtr zasięgu, ścieżka zapasowa) 4/4 zielone po skasowaniu. Mechanizmy w kodzie DZIAŁAŁY we wszystkich czterech przypadkach — nie bronił ich żaden test. Przyczyna zmierzona, nie domniemana: testy pisane są wzdłuż scenariusza użycia („utwórz i sprawdź, że powstało"), które PRZECHODZĄ przez zabezpieczenie po drodze, ale nigdy nie PRÓBUJĄ go ominąć — więc jego zniknięcie niczego w ich oczach nie psuje. To nie był pech ani błąd wykonawców: 204 sam napisał `STOP MERYTORYCZNY`, 210 zostawił pracę czystą i kompletną — defekt jest METODYCZNY. Reguła programu od 31.08: „zabezpieczenie bez testu, który czerwienieje po jego usunięciu, jest nieudowodnione". Ten dyżur jest pierwszym wcieleniem tej reguły w życie — nie punktowo (jeden plik), tylko jako PRZEMIATANIE całego produktu po czterech rodzinach mechanizmów. Dopóki tego nie zrobimy, każde „zabezpieczone" w tym repozytorium znaczy wyłącznie „działa dziś", nie „będzie działać jutro". Dyżur jest pozycją FALI A w `docs/program/funkcje/LISTA_DYZUROW_211_222.md` — fala naprawiająca sam przyrząd pomiarowy, celowo PRZED falą B (domknięcie modułu 17), bo mierzenie nowej pracy zepsutym metrem to dokładnie to, co already kosztowało cztery FIX-y 31.08. ★★ UWAGA WSPÓŁBIEŻNA: dyżur 211 (ten sam plan, pozycja bezpośrednio przed 212) naprawia pułapkę `tests/setup.ts:809-811` — globalny `beforeEach(() => vi.clearAllMocks())`, który kasuje implementacje mocków ustawione w `beforeAll` w 87 plikach testowych (efekt: pierwszy test w pliku przechodzi normalnie, każdy kolejny cicho idzie realną ścieżką zamiast mocka). Na SHA `fe33ce8036` dyżur 211 JESZCZE NIE WSZEDŁ na `codex/m03-admin-20260824` — pułapka jest dziś AKTYWNA. Jeśli test, który oceniasz jako „już pokrywa zabezpieczenie", ustawia implementację mocka w `beforeAll` zamiast `beforeEach` — jego zielony wynik jest PODEJRZANY z urzędu, dokładnie z tego samego powodu co retry (`Z29`): może czerwienieć tylko na PIERWSZYM uruchomieniu w pliku. Sprawdź to jawnie dla każdego kandydata z mockami (nie dotyczy testów `realdb`, które nie mockują nic). |

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
cd /private/tmp/cx-day212-zabezpieczenia

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day212-pg psql -U postgres -d cx212 \
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
cd /private/tmp/cx-day212-zabezpieczenia

docker run -d --name cx-day212-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx212 \
  -p 127.0.0.1:6152:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day212-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6152/cx212 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6152/cx212 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day212-zabezpieczenia && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6152/cx212 \
JWT_SECRET=cx212-test-secret-do-not-reuse \
npx vitest run tests/unit/backend/, tests/unit/initiatives-execution/, tests/integration/, server/src/services/ai/__tests__/, server/src/middleware/__tests__/ (jeśli istnieje — sprawdź `ls`, w przeciwnym razie nowe pliki wchodzą do `tests/unit/backend/middleware/`) — mieszanka testów MOCK-ONLY (bez bazy) i REALDB (prawdziwy Postgres); dla każdego nowego pliku testowego rozstrzygasz i zapisujesz w raporcie, do której kategorii należy, i uruchamiasz go właściwym wariantem z `§0.2c` --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day212-zabezpieczenia-artefakty/day212-zabezpieczenia-bez-testu-omijajacego.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day212-zabezpieczenia && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run tests/unit/backend/, tests/unit/initiatives-execution/, tests/integration/, server/src/services/ai/__tests__/, server/src/middleware/__tests__/ (jeśli istnieje — sprawdź `ls`, w przeciwnym razie nowe pliki wchodzą do `tests/unit/backend/middleware/`) — mieszanka testów MOCK-ONLY (bez bazy) i REALDB (prawdziwy Postgres); dla każdego nowego pliku testowego rozstrzygasz i zapisujesz w raporcie, do której kategorii należy, i uruchamiasz go właściwym wariantem z `§0.2c` --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day212-zabezpieczenia-artefakty/day212-zabezpieczenia-bez-testu-omijajacego.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day212-zabezpieczenia/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day212-pg psql -U postgres -d cx212 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day212-pg`.
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
> **(e) ★★ **Piąta pułapka (nowa, właściwa temu dyżurowi): `beforeAll`-mock zamiast `beforeEach`-mock daje fałszywe „już pokryte".** Dyżur 211 (ten sam plan, poprzednia pozycja) naprawia dokładnie 87 plików testowych, w których `vi.fn().mockImplementation(...)` ustawiony raz w `beforeAll` zostaje wyzerowany globalnym `beforeEach(() => vi.clearAllMocks())` z `tests/setup.ts:809-811` — efekt: PIERWSZY test w pliku faktycznie mockuje, KAŻDY kolejny cicho przechodzi realną ścieżką (albo `undefined`-em, jeśli realna ścieżka rzuca). Jeżeli oceniasz istniejący test jako dowód pokrycia zabezpieczenia i ten test mockuje cokolwiek — sprawdź, w którym hooku (`beforeAll` czy `beforeEach`) ustawiana jest implementacja mocka, i czy Twoja mutacja jest w tym samym pliku PIERWSZYM testem, który jej dotyka (jeśli tak — wynik jest niewiarygodny niezależnie od kolejności hooków, bo mógł przypadkiem trafić na jeszcze żywy mock). Testy `realdb` (prawdziwy Postgres, zero `vi.mock`) tej pułapki nie mają. Nie dotyczy — dowód: `grep -c 'vi.mock\|vi.fn(' <plik>` → `0` oznacza brak mocków w ogóle, pułapka nie dotyczy tego pliku.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day212-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day212-zabezpieczenia-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`A.1 (inwentarz czterech rodzin z liczbami i komendami) + A.2 (regresja trzech potwierdzonych przykładów 204/207/210 — w szczególności ROZSTRZYGNIĘCIE, czy `aiActionExecutor.wave3-runtime.test.ts:427-448` naprawdę łapie ominięcie bramy `aiActionExecutor.ts:773-774`, bo to jest dziś NIEZNANE) + A.5 (bezpiecznik metodyczny w `00_ZASADY_PRACY.md`) + R.2 (raport). Te cztery MUSZĄ być zrobione w całości — są ograniczone rozmiarem i nie rosną w trakcie pracy. A.3 (ocena pokrycia ośmiu nowych kandydatów, dwóch na rodzinę) i A.4 (dopisanie testów omijających dla tych bez pokrycia) idą W KOLEJNOŚCI RYZYKA z tabeli w §A.3 ciała instrukcji — jeśli czasu zabraknie, rdzeń jest i tak KOMPLETNY, a A.3/A.4 kończysz na tym, na czym staniesz, z JAWNĄ listą pominiętych pozycji i uzasadnieniem kolejności (gate zlecenia wprost dopuszcza to jako wynik pozycji, nie jako STOP).`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6152` albo `5094 i 5095` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6152` albo `5094 i 5095`** (`Z7`).

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

31.08.2026 wróciły cztery dyżury odebrane adwersaryjnie: 204, 207, 209, 210
(`docs/program/funkcje/WSPOLNA_PRZYCZYNA_ODBIORY_204_210.md`, `status: canonical`).
W TRZECH z czterech niezależni audytorzy zmierzyli **ten sam** defekt: skasowanie
zabezpieczenia zostawiło dostarczony zestaw testów zielonym.

| Dyżur | Zabezpieczenie | Testy przed mutacją | Po zepsuciu zabezpieczenia |
| --- | --- | --- | --- |
| 204 | idempotencja migracji (oba strażniki naraz) | 11/11 zielonych | **11/11 zielonych ✗** |
| 207 | brama zatwierdzenia zapisu | 4/4 zielone | **4/4 zielone ✗** |
| 210 | filtr zasięgu, ścieżka zapasowa | 4/4 zielone | **4/4 zielone ✗** |

Mechanizmy w kodzie **działały** we wszystkich trzech przypadkach. Nie bronił ich
żaden test. Przyczyna zmierzona, nie domniemana: testy pisane są wzdłuż
**scenariusza użycia** („utwórz i sprawdź, że powstało"), które **przechodzą przez**
zabezpieczenie po drodze, ale nigdy nie **próbują go ominąć** — więc jego zniknięcie
niczego w ich oczach nie psuje. Reguła programu od 31.08, cytat dosłowny:

> **Zabezpieczenie bez testu, który czerwienieje po jego usunięciu, jest
> nieudowodnione.**

Ten dyżur jest pierwszym wcieleniem tej reguły w skali całego produktu — nie
punktowo (jeden plik), tylko jako **przemiatanie** po czterech rodzinach
mechanizmów. Jest pozycją FALI A w `docs/program/funkcje/LISTA_DYZUROW_211_222.md`
(„212 · Przemiatanie zabezpieczeń bez testu omijającego") — fala naprawiająca sam
przyrząd pomiarowy, celowo PRZED falą B (domknięcie modułu 17), bo mierzenie nowej
pracy zepsutym metrem jest dokładnie tym, co 31.08 kosztowało cztery FIX-y.

## ★★ Co ten dyżur NIE robi

**Nie naprawia żadnego znalezionego zabezpieczenia.** Jeśli mutacja pokaże dziurę
(zabezpieczenie, które da się ominąć nawet z obecnym testem) — to jest ZNALEZISKO
do raportu, nie fix. Wzorem: dług zasięgu z karty 210 (pozycje 5-9: cztery
insertery bez `scope`, `scope='project'` nieobsługiwany) poszedł do **osobnego**
dyżuru 213. Atomowość migracji z karty 204 (pozycje 5-6) poszła do **osobnego**
dyżuru 216. Ten dyżur dokłada dowody, nie zmienia zachowania produktu.

## ★★ Pomiar wykonany na SHA `fe33ce8036` — czy 204/207/210 są dziś scalone

Trzy przykłady z `WSPOLNA_PRZYCZYNA` są wzorcem tego, czego ten dyżur szuka. Ich
linie **przesunęły się** od czasu audytu (FIX-y wchodziły po drodze) — poniżej są
aktualne na markerze tego dyżuru, zmierzone przeze mnie, **zweryfikuj sam** (`Z24`):

**204 — idempotencja migracji legacy-task-cutover, JUŻ POKRYTA.**
`git merge-base --is-ancestor ab638ae4f8 HEAD` → **TAK**, fix scalony. Guard A
(`NOT EXISTS` w `selectCandidateTasks`, blokuje wyścig o inicjatywę) —
`server/scripts/legacy-task-cutover-runner.ts:208` i `:230` (dwa wystąpienia, jedno
w zapytaniu o inicjatywy, jedno w zapytaniu o zadania). Guard B (sprawdzenie
checksumy przed replay, `migrateOneTask`) — `:278-284`. Oba mają dziś **dedykowany
komentarz w kodzie** cytujący numer FIX-a i tłumaczący, jak je zmutować:
> `Exported so FIX-204-3's realDB test can prove this guard is load-bearing by
> mutation: delete the NOT EXISTS clause below...` (`:194-196`)

Test: `tests/integration/day204-legacy-task-cutover-idempotency.realdb.test.ts:170`
(`'FIX-204-3 Guard A (selector NOT EXISTS)...'`) i `:205`
(`'FIX-204-3 Guard B (checksum continue)...'`) — nazwy testów **cytują numer
FIX-a i literę strażnika**, dokładnie w duchu tego, czego ten dyżur wymaga od
nowych testów. **Twoje zadanie na tym przykładzie: uruchom oba testy, potwierdź
2/2 PASS, potem zmutuj (usuń `NOT EXISTS` na `:208`, usuń warunek checksumy na
`:283`) i potwierdź czerwień — to jest REGRESJA, nie nowa praca, ale jest częścią
rdzenia, bo dowodzi, że wzorzec z `WSPOLNA_PRZYCZYNA` faktycznie działa, gdy
istnieje.**

**210 — filtr zasięgu embeddingów, ścieżka zapasowa, JUŻ POKRYTA.**
`git merge-base --is-ancestor 884893d41e HEAD` → **TAK**, fix scalony. Filtr
`buildKnowledgeDocAccessFilter` — `server/src/services/ai/embeddingService.ts:341`.
Dwie ścieżki wołające: `searchPg` (główna, pgvector) woła filtr na `:316`;
`searchSqlite` (**ścieżka zapasowa** — to ta, którą audyt 210 znalazł
niepokrytą) woła filtr na `:247`, wewnątrz funkcji zaczynającej się `:223`.

Test: `server/src/services/ai/__tests__/day210.embeddingScope.pg.test.ts:193`
(`'search() dispatcher (fallback/searchSqlite branch) does not return user A
private Vault document to user B'`) i `:221` (wariant pozytywny — użytkownik A
widzi własny dokument). Test **wymusza** gałąź `searchSqlite` przez
`process.env.DB_TYPE = 'sqlite-fallback-test'` (`:204`, `:227`) — to jest
konkretny mechanizm, jakim wymusza się ścieżkę zapasową do testu, przydatny jako
wzorzec, jeśli natrafisz na inny dyspozytor z gałęzią fallback. **Zadanie: 2/2
PASS, potem zmutuj (usuń warunek zasięgu z `buildKnowledgeDocAccessFilter`, np.
zwróć `{ sql: '1=1', params: [] }` na `:341`) i potwierdź czerwień obu testów.**

**207 — brama zatwierdzenia zapisu, STATUS POKRYCIA NIEZNANY — to jest zadanie
tego dyżuru, nie przykład gotowy do skopiowania.** `git merge-base --is-ancestor
944a5caea4 HEAD` → **NIE**. Gałąź `codex/day207-write-proposal-20260831` (i jej
komity `944a5caea4`, `1b57ef9621`, `c637cc2bde`) **nigdy nie scaliła się** do
`codex/m03-admin-20260824` — sprawdź `git log --oneline -- server/src/services/aiActionExecutor.ts`
na swojej bazie: **żaden z tych trzech SHA nie jest w historii tego pliku.**
Mechanizm `requestChatToolProposal`, który audyt `ODBIOR_207.md` opisywał, **nie
istnieje na tej gałęzi** — `grep -rn requestChatToolProposal server/src src` daje
zero trafień. To NIE znaczy, że przykład jest bezprzedmiotowy: brama, którą audyt
mutował (`action.status !== ACTION_STATUS.APPROVED` w `executeAction`), jest
**infrastrukturą sprzed dyżuru 207** i istnieje dziś pod `server/src/services/aiActionExecutor.ts:773-774`:

```ts
if (action.status !== ACTION_STATUS.APPROVED)
  return { success: false, error: `Action is ${action.status}, not APPROVED` };
```

Audyt 207 mutował ją (na innym SHA, gdzie miała numer linii `:822`) i pokazał, że
**dostarczony przez wykonawcę 207 zestaw testów** (`day207.write-proposal.contract.test.ts`,
4 testy) jej nie chroni — bo wszystkie idą happy-pathem `approveAction()` →
`executeAction()`. Ten plik testowy **też nie istnieje na Twojej gałęzi** (nie
scalony razem z resztą 207). Pytanie, na które Twój dyżur ma dziś odpowiedź, brzmi
inaczej: **czy jakikolwiek INNY, już istniejący test w tym repozytorium łapie
ominięcie tej bramy?** Kandydat, znaleziony statycznym czytaniem (nie mutacją —
to jest dokładnie różnica, którą ten dyżur ma usunąć):
`tests/unit/backend/aiActionExecutor.wave3-runtime.test.ts:427-448`,
`it('never executes a rejected proposal', ...)` — tworzy draft, odrzuca go
(`rejectAction`), **woła `executeAction` bezpośrednio na odrzuconym**, asertuje
`executed.success === false`, `executed.error` zawiera `'not APPROVED'` i
`db.tasks` ma długość `0`. Test mockuje `dbGet`/`dbRun` (`vi.hoisted`, brak
prawdziwej bazy) i resetuje mocki w `beforeEach(() => resetDb())` (`:283-285`),
więc **pułapka `beforeAll`/`clearAllMocks` z `§0.2e` (e) go nie dotyczy** — ale to
jest właśnie coś, co masz **sam potwierdzić mutacją**, nie przyjąć z tego akapitu.
**To jest pozycja A.2 (patrz §3) — pierwsza, na której ten dyżur naprawdę
rozstrzyga coś nieznanego, nie odtwarza znanego wyniku.**

# 2. TEZY ZLECENIA

Każda z nich to **rozkaz pomiarowy** z komendą w `§0.1` (`TU_WSTAWIASZ_KOMENDY...`,
oznaczenia `T1`-`T11`). Liczby są z SHA `fe33ce8036` — jeśli u Ciebie wychodzi
inaczej, wiążący jest Twój pomiar (`Z24`), a rozbieżność wpisujesz do raportu.

- **T1.** Surowy census rodziny (a) — wystąpień `organization_id = $N`/`?` w
  zapytaniach `server/src` (bez `__tests__`) — rzędu **tysięcy** (zmierzono 6792).
  To jest miara SKALI zjawiska (multi-tenant SaaS z założenia filtruje prawie
  wszystko po organizacji), **nie** lista pozycji do inwentaryzacji jeden-po-jednym.
- **T2.** Węższy, ENUMEROWALNY census rodziny (a) — nazwane, wielokrotnego użytku
  funkcje-bramki (`assert*Org/Scope/Owner`, `build*Scope/AccessFilter`,
  `enforce*Scope/Org`) — **34** sztuki w `server/src`. To jest Twój inwentarz
  rodziny (a) w sensie gate'u zlecenia — plik:linia dla każdej, patrz `A.1`.
- **T3.** Census rodziny (b) — porównania `.status !== 'APPROVED'/'PUBLISHED'/
  'ACTIVE'/'CONFIRMED'/'VERIFIED'/'COMPLETED'` w `server/src` (bez testów) —
  **43** wystąpienia.
- **T4.** Census rodziny (c) — idiom `clientRequestId` (klucz idempotencji
  używany przez silnik command/event-sourcing execution-spine) — **6 plików**,
  **292** wystąpienia łącznie: `postgresMaterialCommandUnitOfWork.ts`,
  `managementIntervention.ts`, `materialCommand.ts`,
  `pmo/initiativesCapacityAdvisor.routes.ts`, `pmo/initiativesExecutionRuntime.routes.ts`,
  `legacy-task-cutover-runner.ts`.
- **T5.** Census rodziny (d) — nazwane, eksportowane guardy `requireX` w
  `server/src` — **69** sztuk.
- **T6.** Na SHA `fe33ce8036`: fix 204 (`ab638ae4f8`) i fix 210 (`884893d41e`)
  **są** przodkami HEAD (scalone). Komity 207 (`944a5caea4` i in.) **nie są**
  przodkiem HEAD (branch nigdy scalony) — mechanizm `requestChatToolProposal` z
  tego dyżuru **nie istnieje** na Twojej gałęzi.
- **T7.** 204 Guard A (`NOT EXISTS`) — `legacy-task-cutover-runner.ts:208,230`.
  Guard B (checksum) — `:278-284`. Test dedykowany —
  `day204-legacy-task-cutover-idempotency.realdb.test.ts:170,205`. **Już pokryte
  (regresja, nie nowa praca).**
- **T8.** 210 fallback — `embeddingService.ts` `buildKnowledgeDocAccessFilter`
  `:341`, wołanie w `searchSqlite` `:247`, w `searchPg` `:316`. Test dedykowany —
  `day210.embeddingScope.pg.test.ts:193,221`. **Już pokryte (regresja).**
- **T9.** 207 brama — `aiActionExecutor.ts:773-774`. Kandydat testu —
  `aiActionExecutor.wave3-runtime.test.ts:427-448`. **Status pokrycia NIEZNANY —
  to jest pierwsza pozycja, którą ten dyżur naprawdę rozstrzyga.**
- **T10.** Pułapka `beforeAll`/`clearAllMocks`: globalny hook
  `tests/setup.ts:809-811`. Dyżur 211 (poprzednia pozycja tego samego planu) go
  naprawia; na Twoim markerze **jeszcze nie wszedł** — pułapka jest AKTYWNA.
  Dotyczy dowolnego kandydata z `vi.mock`/`vi.fn()`, u którego implementacja
  mocka jest ustawiana w `beforeAll`, nie w `beforeEach`.
- **T11.** `docs/program/funkcje/00_ZASADY_PRACY.md` ma dziś **6** ponumerowanych
  reguł (`REGUŁA NR 1`-`6`), **86** linii. Twoja wchodzi jako `REGUŁA NR 7`.

# 3. POZYCJE DYŻURU

## A.1 — Inwentarz czterech rodzin (rdzeń, MUSI być kompletny)

Dla każdej rodziny: liczba + komenda, którą ją policzono (z `§2`, `T1`-`T5`), i
tabela klasyfikacji. **Zero pozycji „i podobne" — każdy wiersz tabeli to
konkretny `plik:linia`.**

**Rodzina (a) — filtry zasięgu i wielodostępności.** Inwentaryzujesz w całości
węższy, enumerowalny zbiór z `T2` (34 pozycje) — dla każdej z 34 nazwanych funkcji
kolumny: `plik:linia` · nazwę · co chroni (jednym zdaniem: jaką tabelę/zasób, przed
kim) · czy ma dziś test omijający (`TAK`/`NIE`/`NIEZNANE — wymaga mutacji`).
Surowy census z `T1` (6792) wchodzi do raportu jako **kontekst skali**, z jawnym
zdaniem, dlaczego nie jest enumerowany pozycja-po-pozycji (patrz uzasadnienie w
`T1`) — **to jest metodologiczna decyzja tego dyżuru, uzasadnij ją własnymi
słowami w raporcie, nie kopiuj tego zdania.** Startowe cztery pozycje (zmierzone
przeze mnie, dołącz do tabeli i uzupełnij pozostałe 30):
`server/src/services/ai/embeddingService.ts:341` (`buildKnowledgeDocAccessFilter`,
patrz `T8`) · `server/src/routes/raid.routes.ts:36`
(`assertRaidItemInOrganization`, chroni odczyt/zapis pozycji RAID przed cudzą
organizacją) · `server/src/services/initiative/initiativeClosureService.ts:234`
(`assertInitiativeInOrg`) · `server/src/services/canvasMaterialize.ts:116`
(`assertOrgScope`).

**Rodzina (b) — bramy zatwierdzenia i stanu.** Inwentaryzujesz zbiór z `T3`
(43 pozycje) — kolumny jak wyżej. Startowe trzy (dołącz do tabeli):
`server/src/services/aiActionExecutor.ts:773` (patrz `T9`, `A.2`) ·
`server/src/controllers/AssessmentController.ts:1458`
(`assessment.status !== 'APPROVED'`, blokuje generowanie inicjatyw z
niezatwierdzonego assessmentu, `409`) ·
`server/src/domain/initiatives-execution/managementIntervention.ts:425`
(**podwójna bramka**: `c.status !== 'APPROVED' || envelope.actorId !== c.ownerId`
— stan I właściciel jednocześnie).

**Rodzina (c) — idempotencja.** Inwentaryzujesz 6 plików z `T4` (klucz
`clientRequestId`) + rozstrzygasz, czy szerszy idiom `ON CONFLICT ... DO NOTHING`
(zmierz sam: `grep -rn "ON CONFLICT.*DO NOTHING" server/src server/scripts
--include="*.ts" | grep -v __tests__ | wc -l`) niesie odrębne, warte inwentarza
zabezpieczenia poza `clientRequestId`, czy jest generycznym idiomem SQL bez
samodzielnej roli bezpieczeństwa (Twoja decyzja, uzasadniona w raporcie). Startowe
dwie pozycje z rdzenia `clientRequestId` (dołącz do tabeli):
`server/scripts/legacy-task-cutover-runner.ts:208,230,278-284` (patrz `T7`) ·
`server/src/domain/initiatives-execution/materialCommand.ts:457-491`
(`executeMaterialCommand` — `findReceipt` `:469-472`, konflikt
`MaterialCommandConflictError` `:475-482`; to jest silnik idempotencji CAŁEGO
execution-spine, nie tylko legacy-cutover — ma dedykowany
`tests/unit/initiatives-execution/materialCommand.test.ts`, sprawdź mutacją, czy
naprawdę łapie ominięcie klucza `clientRequestId`).

**Rodzina (d) — uprawnienia i role.** Inwentaryzujesz zbiór z `T5` (69 pozycji) —
kolumny jak wyżej. Startowe trzy (dołącz do tabeli):
`server/src/middleware/rbac.middleware.ts:173` (`requireRole`, ma już bogate
pokrycie testowe — `tests/unit/backend/middleware/rbac.middleware.test.ts` i
`rbac.test.js` — sprawdź mutacją, czy pokrycie jest realne, nie licz z samej
obecności plików) · `server/src/services/executionActionRegistryService.ts:44`
(`requireImplementedExecutionAction`, blokuje wywołanie akcji egzekucyjnej, której
`runtimeState !== 'IMPLEMENTED'`) ·
`server/src/services/legacyCutover/requireActiveMembership.ts:47`
(`requireFinanceEditorMembership`, wymaga jednocześnie aktywnego członkostwa I
roli edycyjnej finansów, fail-closed `401`/`403`/`503`).

**Wymaganie gate'u zlecenia (dosłownie):** przy dużej liczbie — priorytetyzujesz
wg skutku (najpierw te, których złamanie ujawnia cudze dane albo zapisuje bez
zgody) i **jawnie wypisujesz, czego nie zdążyłeś**. Cisza o pominiętych jest
zakazana. Jeżeli nie zdążysz sklasyfikować wszystkich 34+43+6+69=152 pozycji
enumerowalnego rdzenia — tabela ma wiersz dla KAŻDEJ zmierzonej pozycji z kolumną
`NIE ZDĄŻYŁEM — priorytet niski, bo <powód>` zamiast pustego miejsca.

## A.2 — Regresja trzech potwierdzonych przykładów (rdzeń, MUSI być kompletny)

Dla 204 i 210: uruchom dedykowane testy (2/2 i 2/2, patrz `§1`), potwierdź PASS,
zmutuj strażnik (usuń warunek), potwierdź czerwień, **przywróć** (`cp`, `Z27`),
potwierdź `git diff` pusty. Dwa przebiegi każdy, oba wyjścia w raporcie (`Z32`).

Dla 207: to jest **rozstrzygnięcie, nie odtworzenie**. Kroki:
1. Uruchom `tests/unit/backend/aiActionExecutor.wave3-runtime.test.ts` w całości
   (mock-only, `§0.2c` wariant C) — zapisz wynik pełnego pliku, nie tylko jednego
   testu (żeby wychwycić efekty uboczne mutacji na inne testy w pliku).
2. Zmutuj `aiActionExecutor.ts:773` — wzorem audytu 207:
   `if (action.status !== ACTION_STATUS.APPROVED)` →
   `if (false && action.status !== ACTION_STATUS.APPROVED)`.
3. Uruchom ponownie **cały plik** `aiActionExecutor.wave3-runtime.test.ts`.
   Jeżeli `'never executes a rejected proposal'` (albo jakikolwiek inny test w
   pliku) **czerwienieje** — brama JEST dziś pokryta, wpisujesz to jako wynik
   pozycji `A.2` z pełnym wyjściem obu przebiegów, i przechodzisz do `A.3`.
   Jeżeli **nic nie czerwienieje** — brama NIE jest pokryta, `aiActionExecutor.ts:773`
   wchodzi jako **PIERWSZA pozycja o najwyższym priorytecie** w `A.4` (bo dokładnie
   ten mechanizm jest tym, który 31.08 zawiódł w 207).
4. Przywróć mutację (`cp`), potwierdź `git diff` puste.

## A.3 — Ocena pokrycia rdzenia ośmiu nowych kandydatów (priorytetyzowana wg ryzyka)

Osiem konkretnych zabezpieczeń, po dwa z rodzin (a)/(c)/(d) plus dwa z (b) już
policzone w `A.2`/`§1` (207 liczy się jako dziewiąta, najwyższy priorytet — patrz
`A.2` krok 3). Dla KAŻDEGO: MUTACYJNIE (usuń warunek → uruchom istniejące testy
całego pliku, w którym mógłby się znajdować dowód → jeśli nic nie czerwienieje,
`NIE POKRYTE`) sprawdź pokrycie. Kolejność poniżej JEST kolejnością ryzyka
(uzasadnienie w nawiasie) — nie przestawiaj bez zapisania powodu w raporcie:

1. **(a) `raid.routes.ts:36` `assertRaidItemInOrganization`** — [ryzyko: brak
   testu pod nazwą w `tests/`/`__tests__`, mierzone `grep -rl
   assertRaidItemInOrganization tests/ server/src/**/__tests__` → 0 plików;
   ominięcie = odczyt/zapis cudzych RAID-ów między organizacjami]
2. **(d) `requireFinanceEditorMembership`
   (`legacyCutover/requireActiveMembership.ts:47`)** — [ryzyko: mierzone 2
   pliki-referencje; ominięcie = edycja danych finansowych bez roli]
3. **(a) `initiativeClosureService.ts:234` `assertInitiativeInOrg`** — [mierzone
   0 plików-referencji w `tests/`; ominięcie = odczyt/zamknięcie cudzej
   inicjatywy]
4. **(d) `executionActionRegistryService.ts:44`
   `requireImplementedExecutionAction`** — [mierzone 1 plik-referencja; ominięcie
   = wywołanie akcji egzekucyjnej, której runtime jawnie oznaczono jako
   nie-wdrożoną]
5. **(c) `materialCommand.ts:457-491` `executeMaterialCommand`/`findReceipt`** —
   [ma dedykowany plik testowy — priorytet niższy niż 1-4, ale silnik jest
   centralny dla całego execution-spine (tasks/initiatives/decisions), więc
   nadal w rdzeniu; ominięcie = podwójne wykonanie tej samej komendy zapisu]
6. **(b) `AssessmentController.ts:1458` `.status !== 'APPROVED'`** — [ryzyko
   średnie: blokuje wyłącznie generowanie inicjatyw, nie zapis do bazy assessmentu
   samego]
7. **(b) `managementIntervention.ts:425`** (bramka podwójna) — [jak wyżej,
   dodatkowo osłonięte warunkiem właściciela]
8. **(d) `rbac.middleware.ts:173` `requireRole`** — [priorytet najniższy w tej
   ósemce: ma już dwa dedykowane pliki testowe, prawdopodobnie pokryte —
   zweryfikuj szybko mutacją jako REGRESJĘ, nie inwestuj czasu, jeśli 1-7 nie są
   skończone]

Dla każdej pozycji wpisujesz do raportu: mutację (dokładny diff jednej linii),
komendę uruchomienia, wynik PRZED (zielony) i PO (czerwony/zielony), przywrócenie
i `git diff` po przywróceniu.

## A.4 — Dopisanie testów omijających (dla pozycji z A.2/A.3 bez pokrycia)

Dla każdej pozycji z `A.2`/`A.3`, która wyszła `NIE POKRYTE` — nowy plik testowy w
`tests/unit/backend/` (mock, jeśli zabezpieczenie jest czystą logiką JS jak brama
stanu) albo `tests/integration/` (`realdb`, jeśli zabezpieczenie jest w zapytaniu
SQL jak filtr zasięgu). Nazwa testu **cytuje** `plik:linia` zabezpieczenia i słowo
„omijający"/„bypass", wzorem `day204`/`day210` (`'FIX-204-3 Guard A...'`). Kształt
obowiązkowy: **atak/ominięcie odrzucone + readback bez zmian** — asercja na stanie
bazy/obiektu PO próbie ominięcia, nie tylko na wartości zwróconej. `--retry=0`
(już domyślne globalnie, `vitest.config.ts:331`, ale potwierdź to w komendzie
uruchomienia — `Z29`).

**Jeśli czasu zabraknie na wszystkie pozycje `A.3`** — kończysz w kolejności
ryzyka podanej wyżej i w raporcie wypisujesz **jawnie**, których nie zdążyłeś, z
jednym zdaniem uzasadnienia dlaczego akurat te zostały (gate zlecenia wymaga tego
wprost — cisza o pominiętych jest zakazana, ale samo pominięcie przy jawnym
opisie NIE jest odrzuceniem pozycji).

## A.5 — Bezpiecznik metodyczny (rdzeń, MUSI być kompletny)

Dopisz `## ★★ REGUŁA NR 7 — <tytuł>` na końcu
`docs/program/funkcje/00_ZASADY_PRACY.md` (dziś kończy się na `REGUŁA NR 6`, `T11`).
Treść: sprawdzalna lista dla przyszłych dyżurów, tym samym stylem co reguły 1-6
(zdanie problemu → zdanie zasady → jedno konkretne odwołanie `plik:linia` do
204/207/210 jako dowód, że reguła nie jest teoretyczna). Rdzeń treści: żaden
dyżur dotykający zabezpieczenia (zasięg/brama/idempotencja/uprawnienia) nie jest
uznany za zrobiony bez pary przebiegów zielony/czerwony na TYM zabezpieczeniu
(nie na scenariuszu użycia, który przez nie przechodzi). **Zakaz zmiany treści
reguł 1-6.**

## R.2 — Raport dyżuru

`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY212_ZABEZPIECZENIA_REPORT.md`
— jedyny nowy dokument rejestrowy (`Z13`). Struktura obowiązkowa: (1) wynik `A.1`
— cztery tabele inwentarza z licznikami i komendami; (2) wynik `A.2` — dwa
przebiegi każdy dla 204/210, rozstrzygnięcie 207 z pełnym wyjściem obu przebiegów;
(3) wynik `A.3` — tabela ośmiu (dziewięciu z 207) pozycji z werdyktem
POKRYTE/NIE POKRYTE per pozycja i dowodem; (4) wynik `A.4` — lista nowych plików
testowych z parą wyjść zielony/czerwony dla KAŻDEGO; (5) **sekcja ZNALEZISKA** —
każda dziura odkryta, ale NIE załatana (`ZAKAZ_WLASCIWY_TEMU_DYZUROWI`), z
`plik:linia`, dowodem, promieniem rażenia, rekomendacją dla właściwego dyżuru;
(6) sekcja **TWIERDZENIA NIEZWERYFIKOWANE** (obowiązkowa, patrz `§5`); (7) lista
rzeczy pominiętych z `A.3`/`A.4` z uzasadnieniem kolejności.

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
| --- | --- |
| Zapis | `tests/unit/backend/**` (NOWE pliki), `tests/integration/**` (NOWE pliki), `server/src/**/__tests__/**` (NOWE pliki), `tests/unit/initiatives-execution/**` (NOWE pliki) — pełna licencja na NOWE testy omijające, z zastrzeżeniem `Z18` i `Z31`. Nowe pliki w `tests/` wymagają `git add -f` |
| Zapis (ograniczony) | `docs/program/funkcje/00_ZASADY_PRACY.md` — WYŁĄCZNIE dopisanie `REGUŁA NR 7` na końcu pliku. **Zakaz zmiany reguł 1-6** |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY212_ZABEZPIECZENIA_REPORT.md` |
| Odczyt (ZAKAZ ZAPISU) | **wszystko pod `server/src/middleware/**`** (53 pliki) — cała macierz uprawnień. Znalezienie dziury nie jest licencją na łatanie — patrz `ZAKAZ_WLASCIWY_TEMU_DYZUROWI` |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/aiActionExecutor.ts` · `server/src/services/ai/embeddingService.ts` · `server/src/services/ragService.ts` · `server/scripts/legacy-task-cutover-runner.ts` · `server/src/domain/initiatives-execution/materialCommand.ts` i `postgresMaterialCommandUnitOfWork.ts` · `server/src/routes/raid.routes.ts` · `server/src/services/initiative/initiativeClosureService.ts` · `server/src/controllers/AssessmentController.ts` · `server/src/domain/initiatives-execution/managementIntervention.ts` · `server/src/services/executionActionRegistryService.ts` · `server/src/services/legacyCutover/requireActiveMembership.ts` — i każdy inny plik, w którym znajdziesz jedną z 152 pozycji inwentarza `A.1`. **Wyjątek: mutacja TYMCZASOWA do dowodu, zawsze przywrócona w tym samym kroku (`cp`, `Z27`), `git diff` po przywróceniu pusty (`Z32`) — to jest pomiar, nie zapis** |
| Odczyt (ZAKAZ ZAPISU) | `tests/setup.ts`, `tests/helpers/**`, `vitest*.config.ts`, `server/vitest.config*.ts` — `Z18`, najostrzejszy. Dotyczy to również pułapki `beforeAll`/`clearAllMocks` z `T10`/`§0.2e` (e): **nie naprawiasz jej** — to jest zakres dyżuru 211, nie 212. Jeśli pułapka blokuje Twój pomiar dla konkretnego kandydata, opisujesz to w raporcie jako ograniczenie (wzorem `Z18`), nie obchodzisz zmianą pliku |
| Odczyt (ZAKAZ ZAPISU) | każdy istniejący plik testowy poza NOWYMI, które Ty tworzysz — w szczególności `tests/integration/day204-legacy-task-cutover-idempotency.realdb.test.ts`, `server/src/services/ai/__tests__/day210.embeddingScope.pg.test.ts`, `tests/unit/backend/aiActionExecutor.wave3-runtime.test.ts`, `tests/unit/initiatives-execution/materialCommand.test.ts`, `tests/unit/backend/middleware/rbac.middleware.test.ts` — uruchamiasz je, mutujesz PRODUKT wokół nich, nigdy nie zmieniasz ich treści |
| Odczyt | `docs/program/funkcje/WSPOLNA_PRZYCZYNA_ODBIORY_204_210.md` · `docs/program/funkcje/LISTA_DYZUROW_211_222.md` · `docs/program/funkcje/ODBIOR_204.md` · `docs/program/funkcje/ODBIOR_207.md` · `docs/program/funkcje/ODBIOR_210.md` — podstawa zlecenia |
| Odczyt (ZAKAZ ZAPISU) | `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` (`Z14`) | Errata w raporcie |
| **Wszystko inne** | **TYLKO ODCZYT** — opisujesz potrzebę w raporcie z dowodem `plik:linia` i idziesz dalej |

> **★★ ZASTRZEŻENIE.** Powyższa tabela **JEST** licencją. Jeżeli plik, którego
> potrzebujesz do inwentarza/mutacji, jest opisany jako „ODCZYT" — **masz
> pozwolenie na czytanie i na mutację-tymczasową-do-dowodu**, i STOP z tytułu „nie
> wolno mi" jest NIEZASADNY. Jeżeli pliku nie ma w tabeli w ogóle — traktujesz go
> jako tylko do odczytu, dopisujesz go do inwentarza `A.1` z dowodem, i idziesz
> dalej — **nie zatrzymujesz dyżuru z tego powodu**.

# 5. TWARDE ZASADY

- ★★ **ZAKAZ NAPRAWIANIA ZABEZPIECZEŃ** (patrz `ZAKAZ_WLASCIWY_TEMU_DYZUROWI`).
  Każda odkryta dziura idzie do sekcji ZNALEZISKA raportu, nigdy do kodu
  produkcyjnego. Jedyny wyjątek pisania w plikach produkcyjnych: mutacja
  tymczasowa do dowodu, zawsze przywrócona w tym samym kroku pomiaru.
- ★★ **SPRAWDZENIE POKRYCIA JEST WYŁĄCZNIE MUTACYJNE.** Nazwa testu, komentarz w
  kodzie, obecność pliku `*.test.ts` obok zabezpieczenia — żadne z tych NIE jest
  dowodem. Dowodem jest: usuń warunek → uruchom → czerwień. Przywróć → uruchom →
  zieleń. `git diff` po przywróceniu pusty. Obie komendy i oba wyniki dosłownie w
  raporcie (`Z32`).
- ★★ **Kształt testów omijających, obowiązkowy: „ominięcie odrzucone + readback
  bez zmian".** Asercja na STANIE (wiersz w bazie, długość tablicy, wartość pola)
  PO próbie ominięcia — nie tylko na kodzie błędu czy wartości zwróconej funkcji.
  `db.tasks` ma długość `0`, nie `executed.success === false` w oderwaniu od stanu.
- ★★ **Zakaz retry w testach bezpieczeństwa (`Z29`).** `--retry=0` w każdej
  komendzie uruchomienia — nawet jeśli `vitest.config.ts:331` ustawia to już
  globalnie, dopisujesz flagę jawnie i potwierdzasz w raporcie, że proces ją
  widzi. Test „atak odrzucony" leczy się skutkiem własnego ataku przy retry > 0.
- ★★ **Piąta pułapka `beforeAll`/`clearAllMocks`** (patrz `PULAPKA_WLASCIWA_TEMU_MODULOWI`,
  `T10`). Dla KAŻDEGO kandydata z `vi.mock`/`vi.fn()`, który oceniasz jako dowód
  pokrycia: sprawdź, w którym hooku ustawiana jest implementacja mocka. Jeśli
  `beforeAll` — Twój wynik jest niewiarygodny niezależnie od kolejności hooków w
  pliku; zapisz to jako ograniczenie w raporcie, nie ignoruj.
- ★★ **`Z18` — konfiguracja testowa jest nietykalna**, w tym `tests/setup.ts`,
  gdzie mieszka pułapka `T10`. Nie naprawiasz jej (to dyżur 211), tylko
  odnotowujesz jej wpływ na Twój pomiar tam, gdzie dotyczy.
- ★★ **Porównania testów po NAZWACH (`fullName`), nigdy po liczbach (`Z37`).**
  „Było 4/4, jest 4/4" nie jest dowodem — jeden test mógł zgasnąć, drugi zapalić.
- ★ **`§0.4a` — pomiar zasięgu testów jest warunkiem oddania raportu (`Z24`).**
  Zawężony wybór albo przepisanie cudzej liczby (z tej instrukcji, z audytów
  204/207/210) = zawyżenie i podstawa odrzucenia. Liczysz **sam**, na swojej
  bazie, wszystkie liczby z `§2`.
- ★ **Zero UI, zero flag, zero zrzutów** — ten dyżur nie dotyka ani jednego pliku
  pod `src/` i nie ma pozycji za flagą (`POZYCJE_Z_FLAGAMI`). Reguły 7/9/11
  `CLAUDE.md` (akcept właściciela na zrzutach) nie mają tu zastosowania.
- ★ **`Z13`:** logi, wyjścia mutacji i przebiegów testowych **nie wchodzą do
  repo** — leżą w `/private/tmp/cx-day212-zabezpieczenia-artefakty`, a raport
  podaje ścieżki i `shasum -a 256`.
- ★★ **Sekcja „TWIERDZENIA NIEZWERYFIKOWANE" w raporcie jest OBOWIĄZKOWA.**
  Wypisz w niej wprost co najmniej: czy inwentarz `A.1` objął wszystkie 152
  pozycje enumerowalnego rdzenia (34+43+6+69) czy jest skrócony, i o ile; czy
  rozstrzygnięcie 207 (`A.2`) jest oparte na realnym uruchomieniu mutacji, czy na
  lekturze tego dokumentu; ile z ośmiu pozycji `A.3` naprawdę zmutowałeś w obie
  strony, a ile oceniłeś statycznie (i dlaczego); czy sprawdziłeś pułapkę
  `beforeAll` dla każdego kandydata z mockami; czy `REGUŁA NR 7` cytuje realny
  `plik:linia` czy jest ogólnikowa. **Brak tej sekcji jest podstawą odrzucenia
  dyżuru.**
- Pułapka: `npx vitest run` bywa kończy się `exit 0` mimo czerwonych testów —
  liczby i nazwy czytasz z JSON-a. Pułapka: `No test files found` nie jest `PASS`.
  Pułapka: `DB_TYPE` bywa przybity w `vitest.config.ts` na `sqlite` — dla testów
  `realdb` z tego dyżuru (204/210 regresja) komplet zmiennych z `§0.2c` (B) w
  jednej linii komendy.
- ★ Porty **5000**, **5037**, **5060-5061** zajęte na stałe — nie używaj. Porty
  **6153-6157** i **5096-5105** zarezerwowane dla dyżurów 213-217 — nie bierz ich.
