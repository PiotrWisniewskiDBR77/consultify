# INSTRUKCJA DYŻURU nr 241 — Codex — „★★ INICJATYWY — BRAK NADZOROWANEJ ŚCIEŻKI ZAPISU. Zero naprawy: czysty pomiar pod decyzję właściciela — dziś zmierzone: `initiatives.routes.ts` ma 96 rejestracji zapisu, z czego ok. 25 jest przeciętych bramką `requireCanonicalInitiativeExecutionWriter` (409 → `runtime-v1`), 10 audytowanych, co najmniej 16 reachable-i-cichych, a `InitiativeController.updateInitiative` (`:996-1024`) pomija `initiative_history` dla `LAZY_FIELDS` (Hipoteza/Lessons/Change Log/OKR) — dokładnie tych, które realny, renderowany ekran zapisuje dziś bez śladu; dodatkowo znaleziono DRUGI, wcześniej niezgłoszony martwy duplikat wzorca zapisu obok już zgłoszonego (`InitiativeDocumentView.tsx:3859-3917`)"

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
> **wyłącznie** `/private/tmp/cx-day241-inicjatywy`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `9a794efdc0`**
> **Gałąź bazowa: `github-backup/codex/m03-admin-20260824`**
> **Stan dokumentu: WYDANY**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo jakiekolwiek niewypelnione pole szablonu — **dokument nie
> jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.
> Ta ramka jest **jedynym** miejscem, w którym rozstrzyga się stan wydania.
> Objaśnienia w innych blokach cytowanych **nie** są powodem do STOP-u.

Data wystawienia: 2026-09-01.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.
Zakres: ****05 INICJATYWY (`/initiatives`) — nadzorowana droga zapisu: ile dróg zmiany danych inicjatywy istnieje, ile zostawia ślad audytowy, czy istnieje droga omijająca zatwierdzenie i czy ktoś z niej realnie korzysta.** Świeży kontekst: dziś naprawiono utratę załączników — przewód był przerwany w trzech miejscach naraz (`plik:linia` w `§1`), a naprawa dwóch dałaby zielone testy i dalej gubiła dane. Zgłoszono też martwy duplikat tego samego wzorca — sprawdzasz, czy jest ich więcej.**.
Trasy front: ``src/components/Initiatives/InitiativeDocumentView.tsx` · `sections/AttachmentsSection.tsx`, `sections/LinkedItemsSection.tsx` · `InitiativesHub.tsx` · `InitiativeFullView.tsx`, `InitiativeDrawer.tsx`, `InitiativeCompactPanel.tsx`, `InitiativePreviewV3.tsx` · `CanonicalInitiativeCardWorkspace.tsx`, `CanonicalInitiativeRegister.tsx` · `InitiativeDraftJourney.tsx` · `src/views/FullInitiativesView.tsx`, `InitiativeManagementView.tsx` (oba zgłoszone jako martwe — zweryfikuj) · `src/services/initiativeWriteTruth.ts``. Trasy tył: ``server/src/routes/pmo/initiatives.routes.ts` (96 rejestracji zapisu), `initiativesExecutionRuntime.routes.ts` (`/runtime-v1`, 82 rejestracji), `initiativeClosure.routes.ts`, `initiativesCapacityAdvisor.routes.ts` · `server/src/routes/initiativeBackbone.routes.ts`, `initiativeGeneratorBrain.routes.ts`, `initiatives-additive.routes.ts`, `initiative-governance.routes.ts`, `initiativeMaterialize.routes.ts`, `initiativeCandidates.routes.ts` · `server/src/controllers/InitiativeController.ts` · `server/src/middleware/executionSpineLegacyReadOnly.middleware.ts`, `effectiveCapability.middleware.ts` · `server/src/services/objectAttachmentService.ts` · `server/src/domain/initiatives-execution/materialCommand.ts`, `postgresMaterialCommandUnitOfWork.ts` · `server/src/services/organizationContext/OrganizationContextService.ts` (wzorzec)`.

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
WT=/private/tmp/cx-day241-inicjatywy
MARKER=9a794efdc0

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day241-inicjatywy-20260901 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day241-inicjatywy/config.worktree"
cat "$VAULT/worktrees/cx-day241-inicjatywy/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day241-inicjatywy-scratch
mkdir -p /private/tmp/cx-day241-inicjatywy-artefakty

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
git -C "$VAULT" log --oneline 9a794efdc0..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only 9a794efdc0..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day241-inicjatywy-20260901
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 9a794efdc0..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `9` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA: blad zalacznikow z dzisiaj byl przerwany w trzech niezaleznych miejscach
git log --oneline -5
git show 11308a2699 --stat
git show 11308a2699 -- src/components/Initiatives/sections/AttachmentsSection.tsx | head -40
cat server/migrations/20260901_initiative_object_attachments_type.sql
#   oczekiwane: front (blob URL bez API), backend CHECK bez 'initiative', front bez
#   ladowania stanu z serwera — trzy niezalezne poprawki w jednym commicie

# (2) TEZA: istnieje DRUGI martwy duplikat wzorca zapisu (handleAddLinkedItem/handleRemoveLinkedItem)
grep -n "handleAddLinkedItem\|handleRemoveLinkedItem" src/components/Initiatives/InitiativeDocumentView.tsx
grep -n "AttachmentsLinksCanvas" src/components/Initiatives/InitiativeDocumentView.tsx src/components/MyWork/TaskDetailView.tsx src/components/MyWork/DecisionDetailView.tsx
#   oczekiwane: obie funkcje maja definicje + jeden wpis w tablicy zaleznosci, zero
#   realnego wywolania z JSX; AttachmentsLinksCanvas nie jest importowany do InitiativeDocumentView.tsx

# (3) TEZA: requireCanonicalInitiativeExecutionWriter 409-uje ok. 25 z 96 drog zapisu
grep -c "router\.\(post\|put\|patch\|delete\)(" server/src/routes/pmo/initiatives.routes.ts
grep -n "requireCanonicalInitiativeExecutionWriter" server/src/routes/pmo/initiatives.routes.ts
sed -n '52,73p' server/src/middleware/executionSpineLegacyReadOnly.middleware.ts
#   oczekiwane: 96 rejestracji zapisu; middleware zamontowany PRZED handlerami; wzorce
#   start-execution|block|unblock|move i milestones|resources|staffing-plans|budget-items|raid|gate-roles

# (4) TEZA: poza ta bramka istnieje min. 16 potwierdzonych, reachable drog zapisu bez sladu
grep -n "router.delete('/:id'" server/src/routes/pmo/initiatives.routes.ts
grep -n "async archiveInitiative\|initiative_history" server/src/controllers/InitiativeController.ts | grep -i archive
grep -n "router.post('/:id/kpis'\|router.post('/:id/comments'\|router.post('/:id/linked-items'" server/src/routes/pmo/initiatives.routes.ts
#   oczekiwane: trasy istnieja, sa reachable (nie za bramka z (3)), a ich handlery nie
#   pisza initiative_history

# (5) TEZA: updateInitiative pomija initiative_history dla LAZY_FIELDS, realny ekran to wywoluje dzis
sed -n '990,1030p' server/src/controllers/InitiativeController.ts
grep -n "saveHypothesis\|saveLessons\|addChangeLogEntry\|addOkr" src/components/Initiatives/InitiativeDocumentView.tsx | head -6
grep -n "saveInitiativeWriteTruth" src/services/initiativeWriteTruth.ts | head -3
#   oczekiwane: LAZY_FIELDS/sectionCompletions zapisywane bez wpisu do `changes`;
#   INSERT do initiative_history warunkowany `if (changes.length > 0)`

# (6) TEZA: domyslna bramka zatwierdzenia jest zezwol-wszystkim (brak zmiennych srodowiskowych)
sed -n '85,92p' server/src/routes/pmo/initiatives.routes.ts
sed -n '445,456p' server/src/middleware/effectiveCapability.middleware.ts
grep -rn "EFFECTIVE_ACCESS_ENFORCE\|EFFECTIVE_ACCESS_SHADOW" --include="*.env*" --include="*.yml" --include="*.json" . 2>/dev/null | grep -v node_modules
sed -n '3781,3789p' server/src/routes/pmo/initiatives.routes.ts
#   oczekiwane: brak ustawienia zmiennych nigdzie; komentarz przy lifecycle-gate-decisions
#   przyznaje wprost "silently ALLOWS every caller"

# (7) TEZA: Organizacja ma nadzorowany zapis z rejestrem decyzji + niemutowalnym snapshotem
grep -n "approveClaim\|rejectClaim\|publishSnapshotVersion" server/src/services/organizationContext/OrganizationContextService.ts | head -6
grep -n "review_state\|BEFORE UPDATE\|content_hash" server/migrations/20260912_claude_c_org_context_snapshots.sql | head -10
#   oczekiwane: funkcje istnieja; migracja ma tabele claim_reviews ze stanem
#   pending/approved/rejected i trigger niemutowalnosci na snapshot_versions

# (8) TEZA: modul ma 14 istotnych ekranow, 2 samo-udokumentowane jako martwe
find src/components/Initiatives -maxdepth 1 -name "*.tsx" | grep -v __tests__ | wc -l
sed -n '1,16p' src/views/FullInitiativesView.tsx
sed -n '1,16p' src/views/InitiativeManagementView.tsx
grep -rln "FullInitiativesView\|InitiativeManagementView" src/routes/AppRoutes.tsx
#   oczekiwane: FullInitiativesView naglowek "Legacy wrapper"; InitiativeManagementView
#   naglowek @deprecated; grep AppRoutes.tsx bez trafien na realny <Component/> tych dwoch

# (9) TEZA: miejsce na dysku wystarcza na dyzur
df -h /
#   oczekiwane: powyzej 5 GB wolnego — ponizej tego STOP calego dyzuru
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day241-inicjatywy-20260901` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6190`. Twój JEDYNY port harnessu to `5168 i 5169`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day241-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061. Zajęte przez inne prace (nie ruszasz): 6012, 5433, 6047, 6054-6187, 5010-5163, 6404-6411, 6600-6830. Twoje własne: baza 6190, harness 5168 i 5169. Cudze — siostrzane dyżury TEJ SAMEJ fali, nie dotykasz: baza 6188 i harness 5164-5165 (dyżur 239 Realizacja), baza 6189 i harness 5166-5167 (dyżur 240 Assessment). Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `ŻADNEJ nowej flagi i ŻADNEJ zmiany wartości domyślnej istniejącej flagi. `Z10` obowiązuje bez wyjątku — ten dyżur nie dotyka żadnej flagi funkcyjnej.`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``src/utils/pilotAccess.ts` · `src/utils/roleGuards.ts` · `src/components/RouterSync.tsx` · `server/src/middleware/auth.middleware.ts` · `server/src/middleware/executionSpineLegacyReadOnly.middleware.ts` · `server/src/middleware/effectiveCapability.middleware.ts` · `server/src/database/Database.ts` · `vitest.config.ts` · `tests/setup.ts``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY241_INICJATYWY_REPORT.md`. Jedyny inny dokument, który wolno Ci dotknąć, to `docs/program/waves/WAVE_03_ACCEPTANCE/modules/05_INITIATIVES/MODULE_ACCEPTANCE.md` (§R.1) — WYŁĄCZNIE dopisanie nowej sekcji na końcu pliku ze zmierzonym stanem (tabela dróg zapisu N/M/K/D, martwy kod, luka `LAZY_FIELDS`, status bramki zatwierdzenia), każde zdanie z dowodem `plik:linia`. Zakaz kasowania, nadpisywania lub przepisywania istniejących wierszy tabel. Zakaz wpisywania `FIXED`/`VERIFIED` — ten dyżur nie naprawia mechanizmu, tylko mierzy i dokumentuje. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day241-inicjatywy-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day241-inicjatywy-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **ZAKAZ PODŁĄCZANIA ŻADNEJ DROGI ZAPISU POD `runtime-v1`/`ie_audit_events`.** **ZAKAZ USUWANIA MARTWEGO KODU** (`handleUploadAttachments`/`handleDeleteAttachment`/`handleAddLinkedItem`/`handleRemoveLinkedItem`) — mierzysz i opisujesz, nie sprzątasz, nawet jeśli `§1.6` pokazuje bezpieczny precedens usunięcia. **ZAKAZ NAPRAWY `LAZY_FIELDS`** w `InitiativeController.updateInitiative` — to jest żywy, konkretny defekt, ale naprawa to inny dyżur; w tym dyżurze wolno Ci wyłącznie DODAĆ nowy plik testowy dowodzący go mutacyjnie (`R2.4`), zero zmiany w `InitiativeController.ts` samym. **ZAKAZ ustawiania `EFFECTIVE_ACCESS_ENFORCE`/`EFFECTIVE_ACCESS_SHADOW`** ani żadnej zmiany bramek uprawnień. | Naprawa załączników z dziś (`11308a2699`, `d0ad71d47d`, `9a794efdc0`) udowodniła na żywym przykładzie, że w tym module przewód zapisu potrafi być przerwany w trzech niezależnych miejscach naraz, a naprawa dowolnych dwóch dałaby zielone testy i dalej gubiłaby dane. Ten sam commit zgłosił martwy duplikat tego wzorca w `InitiativeDocumentView.tsx:3859-3865` — funkcje zapisu, których renderowany komponent nigdy nie czyta. Ten dyżur ma policzyć realny rozmiar problemu: ile dróg zapisu istnieje w ogóle, ile z nich zostawia ślad, czy istnieje droga omijająca zatwierdzenie i czy jest żywa czy martwa, oraz wskazać w produkcie moduł (Organizacja), który ma to zbudowane poprawnie — pod decyzję właściciela, nie pod naprawę. |

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
cd /private/tmp/cx-day241-inicjatywy

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day241-pg psql -U postgres -d cx241 \
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
cd /private/tmp/cx-day241-inicjatywy

docker run -d --name cx-day241-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx241 \
  -p 127.0.0.1:6190:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day241-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6190/cx241 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6190/cx241 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day241-inicjatywy && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6190/cx241 \
JWT_SECRET=cx241-test-secret-do-not-reuse \
npx vitest run src/components/Initiatives/__tests__ server/src/routes/pmo/__tests__ server/src/controllers/__tests__ server/src/domain/initiatives-execution/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day241-inicjatywy-artefakty/day241-pakiet.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day241-inicjatywy && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run src/components/Initiatives/__tests__ server/src/routes/pmo/__tests__ server/src/controllers/__tests__ server/src/domain/initiatives-execution/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day241-inicjatywy-artefakty/day241-pakiet.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day241-inicjatywy/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day241-pg psql -U postgres -d cx241 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day241-pg`.
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
> **(e) ★★ „KOD ISTNIEJE" ≠ „KOD SIĘ WYKONUJE" — W TYM MODULE W OBIE STRONY NARAZ. Z jednej strony: `requireCanonicalInitiativeExecutionWriter` (`initiatives.routes.ts:160`) 409-uje realne żądania HTTP dla ok. 25 z 96 tras zapisu — ich handlery ISTNIEJĄ w pliku i mogłyby częściowo pisać `initiative_history`, ale NIGDY nie biegną (potwierdzone realnym testem na Postgresie, `day31.canonical-writer-contract.pg.test.ts:181-186`). Z drugiej strony: `handleUploadAttachments`/`handleDeleteAttachment`/`handleAddLinkedItem`/`handleRemoveLinkedItem` (`InitiativeDocumentView.tsx:3859-3917`) ISTNIEJĄ, są nawet wymienione w tablicy zależności dużego `useMemo`, ale renderowana gałąź `case 'attachments-links'` woła zupełnie inne funkcje z `SECTION_REGISTRY`. Nie wystarczy sprawdzić, że nazwa funkcji istnieje w pliku ani że jest gdzieś wspomniana — musisz przejść do RZECZYWIŚCIE wykonywanej gałęzi.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day241-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day241-inicjatywy-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (pełna lista dróg zapisu + ślad audytu) · R2 (obejście zatwierdzenia: martwe czy żywe + więcej fałszywych obietnic) · R3 (wzór do naśladowania) · R5 (liczba ekranów) · R6 (korekta MODULE_ACCEPTANCE.md)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6190` albo `5168 i 5169` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6190` albo `5168 i 5169`** (`Z7`).

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

Moduł **05 Inicjatywy** rzekomo **nie ma jednej, nadzorowanej drogi zapisu** — dane
inicjatywy mogą zmieniać się wieloma równoległymi ścieżkami, część bez śladu i bez
zatwierdzenia. To uderza w wiarygodność produktu wobec klienta: firma doradcza sprzedaje
rzetelność decyzji, nie tylko interfejs. **Świeży, dzisiejszy kontekst z tej samej gałęzi
(commity `11308a2699`, `d0ad71d47d`, `9a794efdc0` na markerze `9a794efdc0`) właśnie
pokazał, jak realny jest ten problem**: interfejs Inicjatyw mówił „zapisano", a załącznik
znikał — przewód był przerwany **w trzech miejscach naraz**, i naprawa dwóch dałaby
zielone testy, dalej gubiąc dane. Zgłoszono też martwy duplikat tego samego wzorca w
`InitiativeDocumentView.tsx` — funkcje zapisu, których renderowany komponent nigdy nie
woła. Ten dyżur ma sprawdzić, **czy takich fałszywych obietnic zapisu jest w tym module
więcej**, i policzyć realny rozmiar problemu z drogami zapisu.

**★★ ZAKAZ ZMIAN ARCHITEKTURY.** Ten dyżur jest pomiarowo-dowodowy. Nie budujesz nowej
bramki zatwierdzenia, nie podłączasz załączników pod `runtime-v1`, nie usuwasz martwego
kodu, nie zmieniasz żadnej trasy ani middleware. Jedyny dozwolony zapis produktowy to wąski
dopisek do `MODULE_ACCEPTANCE.md` (`R6`) — reszta to raport.

## ★★ POMIAR NA MARKERZE `9a794efdc0` — WSTĘPNE USTALENIA, KAŻDE DO WERYFIKACJI PRZEZ CIEBIE

### 1. Naprawiony dziś błąd załączników — anatomia trzech przerwanych przewodów naraz

Commit `11308a2699` (`fix(initiatives): napraw utratę załączników — realne API zamiast
blob URL`) i mutacyjny dowód `d0ad71d47d` pokazują dokładnie trzy niezależne miejsca,
z których naprawa DOWOLNYCH dwóch zostawiłaby dane tracone:

1. **Front, brak wywołania API.** `src/components/Initiatives/sections/AttachmentsSection.tsx:25-33`
   (przed naprawą) wołało wyłącznie `URL.createObjectURL(f)` — efemeryczny odnośnik
   w pamięci przeglądarki — i pokazywało komunikat sukcesu bezwarunkowo. Zero
   `Api.post`/`Api.delete`.
2. **Backend, allowlista i CHECK bazy nie znały trzeciego typu.**
   `server/src/services/objectAttachmentService.ts:7,40` (`AttachmentObjectType`/
   `ALLOWED_TYPES`) dopuszczały wyłącznie `'task'|'decision'`; ten sam zestaw wymuszał
   `CHECK` w bazie (`server/migrations/20260830_day147_object_attachments.sql`, producent
   tabeli `object_attachments`) — nawet POPRAWNE wywołanie API z frontu dostałoby `400`.
   Naprawiono addytywną migracją `server/migrations/20260901_initiative_object_attachments_type.sql`
   (`DROP CONSTRAINT` + `ADD CONSTRAINT ... CHECK (object_type IN ('task','decision','initiative'))`).
3. **Front, nigdy nie ładowano stanu z serwera.** `InitiativeDocumentView.tsx` `fetchAll()`
   nigdy nie pobierało załączników dla prawdziwej (nie-showcase'owej) inicjatywy — stan po
   KAŻDYM mount/refetch wracał do pustej listy niezależnie od naprawy punktów 1-2.
   Naprawione dodaniem `loadInitiativeAttachments(Api, initiativeId)`
   (`InitiativeDocumentView.tsx:192-196,2593-2596`).

Dowód mutacyjny (`d0ad71d47d`, test `initiativeAttachments.persistence.realpg.test.ts`):
realny `ApiGateway` + jednorazowy Postgres, upload→GET niezależny potwierdza wiersz w
bazie, delete→przeładowanie potwierdza usunięcie, para „obcy nie widzi/właściciel widzi"
na granicy organizacji. **Ważne zastrzeżenie z samego testu**: nie obejmuje on
front-endowych wire-upów komponentu React (kliknięcia/renderowanie) — testuje bezpośrednio
wyeksportowane funkcje. Zweryfikuj Ty sam, czy realne kliknięcie w przeglądarce rzeczywiście
dochodzi do tych funkcji (`T4`).

### 2. ★★★ Ten sam plik ma DRUGI, wcześniej niezgłoszony martwy duplikat tego samego wzorca

Zgłoszony martwy duplikat: `handleUploadAttachments`/`handleDeleteAttachment`
(`InitiativeDocumentView.tsx:3859-3874`) — cały grep tych dwóch nazw w pliku daje
DOKŁADNIE cztery trafienia: dwie definicje (`3859`, `3871`) i dwa wpisy w tablicy
zależności `useMemo` (`~8908-8909`) obejmującego `nModeSectionsWithContent`
(`6542-8908`). Wewnątrz tego `useMemo`, gałąź `case 'attachments-links'`
(`~8149-8168`) renderuje `SECTION_REGISTRY['attachments']` — czyli realny, już
naprawiony `AttachmentsSection.tsx` — **nigdy nie wywołując**
`handleUploadAttachments`/`handleDeleteAttachment`. Komponent `AttachmentsLinksCanvas`,
dla którego te funkcje są (wg komentarza) przeznaczone, **w ogóle nie jest importowany
do tego pliku** — jest używany wyłącznie w `TaskDetailView.tsx:110` i
`DecisionDetailView.tsx:120`.

**Sprawdź samodzielnie DRUGI, dotąd niezgłoszony przypadek tego samego kształtu w TYM
SAMYM pliku:** `handleAddLinkedItem` (`~3876-3900`) i `handleRemoveLinkedItem`
(`~3903-3917`) — ten sam wzorzec: definicja + jeden wpis w tej samej tablicy zależności,
ZERO wywołania z renderowanej ścieżki. Gałąź `case 'attachments-links'` renderuje zamiast
nich `SECTION_REGISTRY['linkedItems']` (realny `LinkedItemsSection.tsx`, który POPRAWNIE
woła `Api.get/post/delete '/initiatives/:id/linked-items'`). **Różnica wobec pary
attachments**: te dwie funkcje WEWNĄTRZ SIEBIE poprawnie wołają API — nie są bugiem utraty
danych same w sobie, ale SĄ martwym kodem tego samego kształtu („biblioteka bez
wywołania") — ryzykiem jest przyszły programista, który uzna je za żywą, przetestowaną
ścieżkę.

### 3. Bramka `requireCanonicalInitiativeExecutionWriter` — realna, ale osłania tylko WYCINEK dróg zapisu

`server/src/routes/pmo/initiatives.routes.ts:160`: `router.use(requireCanonicalInitiativeExecutionWriter)`
zamontowane PRZED handlerami — z `server/src/middleware/executionSpineLegacyReadOnly.middleware.ts:52-73`.
Odcina `409 EXECUTION_RUNTIME_V1_WRITE_REQUIRED` dla ścieżek pasujących do wzorców
`start-execution|block|unblock|move` i `milestones|resources|staffing-plans|budget-items|raid|gate-roles`
— **25 z 96** zarejestrowanych w tym pliku endpointów zapisu jest w ten sposób
NIEOSIĄGALNYCH z realnego żądania HTTP (potwierdzone realnym testem na Postgresie:
`server/src/routes/pmo/__tests__/day31.canonical-writer-contract.pg.test.ts:181-186,469-474`).
Ich zastępstwo to `runtime-v1` (`initiativesExecutionRuntime.routes.ts`, montowane pod
`/runtime-v1`) — CQRS-owy zapis z kontrolą wersji, idempotencją i audytem
(`ie_audit_events`, `server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.ts:507`).
**To jest dobra wiadomość dla TEJ grupy 25 dróg — ale to tylko wycinek.**

### 4. Poza tą bramką: 16 potwierdzonych ŻYWYCH dróg zapisu bez śladu + jedna świeżo znaleziona, dziś aktywna

Wśród pozostałych `71` (`96 - 25`) endpointów w `initiatives.routes.ts`, **16
potwierdzonych jest REACHABLE i NIE zapisuje do `initiative_history` ani żadnej innej
tabeli śladu**: `DELETE /:id` (twardy delete), `POST /:id/archive` (surowy `UPDATE`,
`InitiativeController.ts:2763-2809`), `POST/PUT/DELETE /:id/kpis`,
`POST/DELETE /:id/comments`, `POST/DELETE /:id/linked-items`,
`POST/PUT/DELETE /:id/tools`, `POST/PUT/DELETE /:id/intangible-assets`. **10 innych
jest reachable I audytowane** (`PUT /:id`, `PATCH /:id/status`, `POST /:id/approve` przez
`executeInitiativeTransition`, `POST /bulk-assign`, itd.). **45 pozostaje
niesklasyfikowanych** (kreator/kandydaci, szablony, programy, portfolio-dependencies,
`POST /` create, `lifecycle-transition-proposals/executions`) — to jest praca do `R1`.

**Najważniejsze, dotąd niezgłoszone odkrycie**: `InitiativeController.updateInitiative`
(`server/src/controllers/InitiativeController.ts:741-1027`) buduje diff do
`initiative_history` (`changes`, `:898-965`) dla pól skalarnych/`FIELD_MAP`/`JSON_FIELDS`
— ale **`LAZY_FIELDS`** (`hypothesisStatement`, `lessonsLearned`, `changeLog`, `okrs`,
`InitiativeController.ts:996-1002`) oraz `sectionCompletions` są zapisywane do bazy
(`:1003-1024`) **bez jakiegokolwiek wpisu do `changes`**. Skoro INSERT do
`initiative_history` (`:1065-1080`) biegnie `if (changes.length > 0)`, żądanie dotykające
WYŁĄCZNIE tych pól **nie zostawia żadnego śladu**. To **nie jest** teoretyczne: realny,
renderowany ekran wywołuje to dziś — `saveHypothesis`, `saveLessons`,
`addChangeLogEntry`/`removeChangeLogEntry`, `addOkr`/`updateOkr`/`removeOkr`
(`InitiativeDocumentView.tsx:1594-1649`) → `persistInitiativeField` →
`saveInitiativeWriteTruth` (`src/services/initiativeWriteTruth.ts:305-311`) →
`Api.put('/initiatives/:id', {...})`, wysyłając WYŁĄCZNIE jedno leniwe pole na raz.
**Każda zmiana OKR, każdy wpis Change Log, każda edycja Hipotezy/Lessons Learned zrobiona
dziś przez realny, renderowany ekran jest zapisem bez śladu audytowego.**

### 5. Bramka zatwierdzenia dla „zwykłych" tras jest realnie wyłączona domyślnie — własny komentarz kodu to przyznaje

`requireGovernedInitiativeCapability` (`initiatives.routes.ts:87-91`) wymusza
`{shadow: false}` na `requireInitiativeCapability`, nadpisując literał `{shadow: true}`
z każdego miejsca wywołania (komentarz `:85-86` tłumaczy to jako świadome — „okres shadow
zakończony"). To kieruje wykonanie do STARSZEJ bramki `effectiveCapability.middleware.ts`,
której pierwszy warunek po uwierzytelnieniu to: `if (!shouldEnforceEffectiveAccess() &&
!shouldShadowEffectiveAccess()) { allow }` (`:452-455`), sterowane zmiennymi
`EFFECTIVE_ACCESS_ENFORCE`/`EFFECTIVE_ACCESS_SHADOW` (`:36-38`). **Żadna z tych zmiennych
nie jest ustawiona nigdzie w repo** (tylko komentarze je wspominają). Domyślnie: **zezwól
wszystkim, zero kontroli uprawnień** — dla większości tras z bucketu „reachable, silent"
z punktu 4. To NIE jest moja interpretacja — **własny komentarz kodu w tym samym pliku**
(`initiatives.routes.ts:3781-3789`, przy `/:id/lifecycle-gate-decisions`) mówi wprost, że
`requireGovernedInitiativeCapability` jest „telemetry-only" i „silently ALLOWS every
caller" — dlatego TA JEDNA trasa świadomie używa innego, ręcznie napisanego,
fail-closed sprawdzenia (`evaluateInitiativeGateAccess`) zamiast tej bramki. **Moduł sam
przyznaje w kodzie, że jego domyślna bramka nie jest bramką — ale zrobił z tego wyjątek
tylko w jednym miejscu, nie systemowo.**

### 6. Precedens sprzątania — `POST /:id/reject` już raz usunięto z dokładnie tego powodu

`initiatives.routes.ts:3213-3227`, komentarz „H16 fix": trasa `POST /:id/reject` została
**usunięta całkowicie** po tym, jak inwentaryzacja wywołań wykazała zero realnych
wołających i potwierdziła, że omijała silnik bramek. To jest dowód, że „biblioteka bez
wywołania" w tym module to **powtarzający się kształt**, nie jednorazowy wypadek — i że
usuwanie takiego kodu ma tu precedens.

### 7. Wzorzec do naśladowania istnieje w produkcie — moduł Organizacja

`docs/program/waves/WAVE_03_ACCEPTANCE/modules/01_ORGANIZATION/MODULE_ACCEPTANCE.md:66-69`
(G02, `PASS`): *„profile/source -> claim proposals -> human approve/reject -> immutable
snapshot -> exact version/hash reopen."* Zweryfikowane w kodzie:
`OrganizationContextService.ts:2173-2189` (`approveClaim`/`rejectClaim` → `decideClaim`),
`:2202-2260+` (`publishSnapshotVersion`: deterministyczny payload, `content_hash =
sha256(...)`, INSERT nigdy UPDATE, unikalny numer wersji). Tabela
`organization_context_claim_reviews` (`server/migrations/20260912_claude_c_org_context_snapshots.sql:60-80`):
jeden wiersz na każdą KIEDYKOLWIEK podjętą decyzję, stan `pending/approved/rejected`,
bezpieczna współbieżność przez `INSERT...ON CONFLICT...WHERE review_state='pending'`.
Tabela `organization_context_snapshot_versions` (`:92-110+`): **niezmienność wymuszona
TRIGGEREM bazy danych** (`BEFORE UPDATE`), nie tylko konwencją w kodzie aplikacji. Sama
migracja dokumentuje, że Organizacja przeszła DOKŁADNIE tę samą drogę, której brakuje
Inicjatywom: z mutowalnego, cichego zapisu do jawnego rejestru decyzji + niemutowalnych,
haszowanych snapshotów.

**Czym różni się od `initiative_history`**: `initiative_history` to log append-only w
zasadzie tego samego kształtu, ale (a) tylko część z ~96 dróg zapisu go faktycznie karmi
(`§1.4`), (b) brak wymuszonej przez bazę niemutowalności, (c) brak własnego rejestru
zatwierdzeń — zatwierdzenie jest wtopione w doraźny check roli wewnątrz
`executeInitiativeTransition`, nie jest osobną, pierwszoklasową tabelą decyzji.

## Czego ten dyżur świadomie NIE robi

- **Nie podłącza załączników ani żadnej innej drogi pod `runtime-v1`/`ie_audit_events`.**
  To jest wariant `B`/`C` z `R4` — opis dla właściciela.
- **Nie usuwa martwego kodu** (`handleUploadAttachments`/`handleDeleteAttachment`/
  `handleAddLinkedItem`/`handleRemoveLinkedItem`) — mierzysz i opisujesz.
- **Nie naprawia `LAZY_FIELDS`** w `InitiativeController.updateInitiative` — to jest
  konkretny, świeżo znaleziony, żywy defekt, ale naprawa to inny dyżur.
- **Nie ustawia `EFFECTIVE_ACCESS_ENFORCE`/`EFFECTIVE_ACCESS_SHADOW`** i nie zmienia
  żadnej bramki uprawnień.

---

# 2. TEZY ZLECENIA

| # | Teza | Jak sprawdzasz |
|---|---|---|
| T1 | Błąd załączników z dziś był przerwany w trzech niezależnych miejscach (front bez API, backend CHECK bez `'initiative'`, front bez ładowania stanu) | komenda (1) |
| T2 | Istnieje DRUGI, niezgłoszony martwy duplikat wzorca zapisu w tym samym pliku (`handleAddLinkedItem`/`handleRemoveLinkedItem`) | komenda (2) |
| T3 | Bramka `requireCanonicalInitiativeExecutionWriter` realnie 409-uje ok. 25 z 96 dróg zapisu w `initiatives.routes.ts`, kierując je do `runtime-v1` | komenda (3) |
| T4 | Poza tą bramką istnieje co najmniej 16 potwierdzonych, reachable dróg zapisu bez ŻADNEGO śladu audytowego | komenda (4) |
| T5 | `InitiativeController.updateInitiative` pomija `initiative_history` dla całej klasy pól (`LAZY_FIELDS`/`sectionCompletions`), i realny, renderowany ekran korzysta z tej ścieżki dziś | komenda (5) |
| T6 | Domyślna bramka zatwierdzenia (`requireGovernedInitiativeCapability`) jest zezwól-wszystkim, bo sterujące zmienne środowiskowe nigdzie nie są ustawione — potwierdzone własnym komentarzem kodu | komenda (6) |
| T7 | Organizacja ma nadzorowany zapis z rejestrem decyzji + niemutowalnym, haszowanym snapshotem wymuszonym triggerem bazy | komenda (7) |
| T8 | Moduł ma 14 istotnych ekranów/workspace'ów, z czego 2 są samo-udokumentowane jako martwe/przestarzałe | komenda (8) |
| T9 | Miejsce na dysku wystarcza | komenda (9) |

---

# 3. POZYCJE DYŻURU

## R1 — PEŁNA LISTA DRÓG ZAPISU + ŚLAD AUDYTU (rdzeń, dowodowy)

**Cel:** dokończyć klasyfikację, którą to rozpoznanie zaczęło. `initiatives.routes.ts` ma
**96** rejestracji `router.post/put/patch/delete` — `10` audytowanych, `16` żywych i
cichych, `25` odciętych bramką `requireCanonicalInitiativeExecutionWriter` (patrz `§1.3`),
**`45` NIESKLASYFIKOWANYCH** (kreator/kandydaci, szablony, programy,
portfolio-dependencies, `POST /` create, `lifecycle-transition-proposals/executions`,
`lifecycle-gate-decisions`). Dokończ te 45: dla KAŻDEJ trasy ustal (a) czy jest
osiągalna z realnego żądania HTTP (sprawdź, czy leży za `requireCanonicalInitiativeExecutionWriter`
albo inną globalną bramką), (b) czy jej handler zapisuje do `initiative_history` albo
INNEJ tabeli śladu (`initiative_lifecycle_gate_decisions`, `ie_audit_events` przez
`runtime-v1`, cokolwiek innego). Zrób to samo dla `initiativesExecutionRuntime.routes.ts`
(**82** endpointy zapisu pod `/runtime-v1`, w ogóle nie audytowane w tym rozpoznaniu) —
przynajmniej próbkę wystarczającą, żeby potwierdzić albo obalić, że TA droga jest
konsekwentnie audytowana (oczekiwane na podstawie `§1.3`, ale ZWERYFIKUJ, nie zakładaj).
Dołącz też pozostałe pliki tras z `initiativeBackbone.routes.ts`,
`initiativeGeneratorBrain.routes.ts`, `initiatives-additive.routes.ts`,
`initiative-governance.routes.ts`, `initiativeMaterialize.routes.ts`,
`initiativeCandidates.routes.ts`, `initiativeClosure.routes.ts`,
`initiativesCapacityAdvisor.routes.ts` — dla każdego przynajmniej policz endpointy zapisu
i sklasyfikuj grubo (audytowane/nie/dead). Wynik: jedna kompletna tabela — N tras total, M
audytowanych, K cichych, D martwych (bramkowanych) — dla WSZYSTKICH plików tras
Inicjatyw, nie tylko `initiatives.routes.ts`.

## R2 — OBEJŚCIE ZATWIERDZENIA: MARTWE CZY ŻYWE + WIĘCEJ FAŁSZYWYCH OBIETNIC (rdzeń, dowodowy)

**Cel:** dokończyć poszukiwanie kształtu „biblioteka bez wywołania" w module, zaczęte
przez `§1.2`. Zweryfikuj SAMODZIELNIE (nie ufaj samemu raportowi tej instrukcji):
1. Potwierdź `handleUploadAttachments`/`handleDeleteAttachment` i
   `handleAddLinkedItem`/`handleRemoveLinkedItem` jako martwe — grep całego pliku,
   policz TRAFIENIA nazwy funkcji, prześledź KAŻDE do jego kontekstu (czy to definicja,
   wpis w tablicy zależności, czy realne wywołanie `functionName(...)` w JSX/handlerze).
2. Przeszukaj RESZTĘ modułu Inicjatyw (`InitiativeFullView.tsx`, `InitiativeDrawer.tsx`,
   `InitiativeCompactPanel.tsx`, `InitiativePreviewV3.tsx`,
   `CanonicalInitiativeCardWorkspace.tsx`, `CanonicalInitiativeRegister.tsx`, i inne
   pliki z `TRASY_FRONT`) pod kątem TEGO SAMEGO kształtu: funkcja `save*`/`update*`/
   `persist*`/`handle*Attachment*`/`handle*Link*` zdefiniowana, ale bez realnego
   wywołania z renderowanej ścieżki. Dla każdego kandydata pokaż definicję i albo
   realnego wołającego, albo jego brak.
3. Osobno zmierz `§1.5` (`requireGovernedInitiativeCapability` jako zezwól-wszystkim) —
   potwierdź brak `EFFECTIVE_ACCESS_ENFORCE`/`EFFECTIVE_ACCESS_SHADOW` w CAŁYM repo
   (env, `.env*`, `docker-compose*`, `railway*`, configi), i wypisz DOKŁADNIE które trasy
   polegają WYŁĄCZNIE na tej bramce (bez dodatkowego sprawdzenia wewnątrz handlera, jak
   ma `executeInitiativeTransition`).
4. Zmierz `§1.4` (pominięcie `initiative_history` dla `LAZY_FIELDS`) na REALNYM wywołaniu:
   zbuduj żądanie `PUT /initiatives/:id` z payloadem dotykającym WYŁĄCZNIE
   `hypothesisStatement` (albo `okrs`), wykonaj przez realny `ApiGateway` na swojej bazie,
   i sprawdź wprost `SELECT count(*) FROM initiative_history WHERE initiative_id=$1` przed
   i po. To jest dowód mutacyjny na ŻYWO, nie lektura kodu.

## R3 — WZÓR DO NAŚLADOWANIA (rdzeń, dowodowy)

Potwierdź `§1.7` samodzielnie: przeczytaj `OrganizationContextService.ts` w okolicach
`approveClaim`/`rejectClaim`/`publishSnapshotVersion`, migrację
`20260912_claude_c_org_context_snapshots.sql` (tabele `organization_context_claim_reviews`,
`organization_context_snapshot_versions`, **trigger** niemutowalności). Opisz w raporcie
JĘZYKIEM WŁAŚCICIELA (nie inżyniera), czym mechanizm Organizacji różni się od
`initiative_history`: (a) osobny rejestr decyzji zatwierdzenia/odrzucenia z ochroną przed
podwójnym zatwierdzeniem, (b) niemutowalność wymuszona przez samą bazę, nie tylko przez
dyscyplinę programisty, (c) numerowana wersja + hash pozwalające wrócić do DOKŁADNIE tego
stanu, jaki był zatwierdzony. Jeśli w trakcie lektury znajdziesz, że ten wzorzec też ma
luki — opisz je, nie ukrywaj.

## R4 — TRZY WARIANTY ROZSTRZYGNIĘCIA (rdzeń, dokumentacyjny)

Język właściciela. Dopracuj liczbami z `R1`-`R3`:

- **Wariant A — „Posprzątaj i nazwij rzeczy po imieniu."** Usunąć potwierdzony martwy kod
  (`handleUploadAttachments`/`handleDeleteAttachment`/`handleAddLinkedItem`/
  `handleRemoveLinkedItem`) — to jest bezpieczne, bo i tak się nie renderuje (precedens:
  `§1.6`, usunięcie `POST /:id/reject`). Udokumentować w `MODULE_ACCEPTANCE.md` dokładnie,
  które z N dróg zapisu mają ślad, a które nie, bez zmiany kodu poza sprzątaniem. Koszt:
  bardzo niski, zero ryzyka regresji. Skutek: nie zamyka dziury w audytowalności, ale
  przestaje ukrywać jej rozmiar i usuwa realne ryzyko, że przyszły programista podłączy
  martwy kod myśląc, że działa.
- **Wariant B — „Podłącz pod to, co już działa."** Przepisać ścieżki z bucketu „reachable,
  silent" (załączniki już naprawione co do trwałości, ale nie audytu; komentarze; KPI;
  narzędzia; `LAZY_FIELDS`) tak, żeby przechodziły przez istniejący `runtime-v1`/
  `ie_audit_events`, wzorem tras już bramkowanych przez
  `requireCanonicalInitiativeExecutionWriter`. Koszt: średni, per droga — nowy typ
  komendy + adapter, mechanizm audytu już istnieje, nie trzeba go wynajdywać. Skutek:
  każda zmiana inicjatywy zostawia spójny ślad.
- **Wariant C — „Pełne bramkowanie zatwierdzeniem, wzorem Organizacji."** Rozszerzyć
  governed lifecycle o osobny rejestr decyzji (pending/approved/rejected) i niemutowalne,
  haszowane snapshoty wymuszone triggerem bazy — nie tylko ślad audytowy, ale prawdziwe
  zatwierdzenie przed wejściem zmiany w życie. Koszt: wysoki — nowa maszyna stanów, UI
  recenzji, migracja istniejących rekordów; porównywalne z tym, ile czasu zajęło to
  Organizacji. Skutek: najbliżej obietnicy „kontrolowana droga zapisu".

Dopisz też osobną, krótszą rekomendację: naprawa `LAZY_FIELDS`
(`InitiativeController.ts:996-1024`) jest wąska, dobrze zlokalizowana i mogłaby być
osobnym, tanim dyżurem niezależnie od wyboru wariantu A/B/C — to nie jest część tej
decyzji, ale warto to właścicielowi napisać wprost.

## R5 — LICZBA EKRANÓW I OSIĄGALNOŚĆ (rdzeń, dowodowy)

Potwierdź samodzielnie: **14** istotnych komponentów ekranu/workspace w
`src/components/Initiatives/` + `src/views/*Initiative*` (wyłączając `sections/`,
`cards/`, `gate-ai/`, `calendar/`, `gantt/`, `templates/`, `Wizard/`, `__tests__/`).
Zweryfikuj, że tylko `InitiativesHub` ma bezpośrednie zamontowanie w
`src/routes/AppRoutes.tsx` (`ROUTES.INITIATIVES`), a `/roadmap`/`/portfolio` to
przekierowania do niego. Potwierdź lub obal dwa zgłoszone martwe ekrany:
`src/views/FullInitiativesView.tsx` (własny nagłówek: „Legacy wrapper", zwraca po prostu
`<InitiativesHub/>`, nigdy nie renderowany osobno) i
`src/views/InitiativeManagementView.tsx` (własny `@deprecated`, zero referencji poza
plikiem). Dla pozostałych 12 potwierdź przynajmniej JEDNEGO realnego wołającego
w drzewie renderowania (nie samą deklarację importu).

## R6 — KOREKTA `MODULE_ACCEPTANCE.md` (rdzeń, dokumentacyjny)

Dopisujesz na końcu
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/05_INITIATIVES/MODULE_ACCEPTANCE.md` nową
sekcję (np. `## Dzień 241 — pomiar dróg zapisu i nadzoru`) ze zmierzonym stanem z `§1`
i `R1`-`R5`: kompletna tabela dróg zapisu N/M/K/D, potwierdzone martwe funkcje/ekrany,
luka `LAZY_FIELDS`, status bramki `requireGovernedInitiativeCapability`. **Nie kasujesz
i nie przepisujesz** istniejących wierszy. Zakaz `FIXED`/`VERIFIED` — nic nie naprawiasz.

## R7 — RAPORT DYŻURU (rdzeń)

Struktura z `§R.2`, sekcja „TWIERDZENIA NIEZWERYFIKOWANE" obowiązkowa nawet jeśli pusta.
Dołącz tabelę mianowników i pełne wyjścia komend z `§0` i `R1`-`R5`.

---

# 4. TABELA LICENCJI PLIKOWYCH

Ten dyżur jest **wyłącznie pomiarowo-dowodowy** — zero zapisu produktowego poza `R6`.

| Zakres | Ścieżki |
|---|---|
| Zapis (WĄSKO, `R6`) | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/05_INITIATIVES/MODULE_ACCEPTANCE.md` — WYŁĄCZNIE nowa sekcja na końcu pliku, zakaz kasowania/przepisywania istniejących wierszy |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY241_INICJATYWY_REPORT.md` |
| Zapis (NOWE, testy dowodowe `R2.4`) | `tests/**` / `server/src/**/__tests__/**` — WYŁĄCZNIE nowe pliki testowe realizujące dowód mutacyjny `LAZY_FIELDS`, z zastrzeżeniem `Z18`/`Z31` |
| Odczyt (ZAKAZ ZAPISU) | `src/components/Initiatives/**` (wszystkie, w tym `InitiativeDocumentView.tsx`, `sections/AttachmentsSection.tsx`, `sections/LinkedItemsSection.tsx`) · `src/views/FullInitiativesView.tsx`, `InitiativeManagementView.tsx` · `src/services/initiativeWriteTruth.ts` |
| Odczyt (ZAKAZ ZAPISU) | `server/src/routes/pmo/initiatives.routes.ts`, `initiativesExecutionRuntime.routes.ts`, `initiativeClosure.routes.ts`, `initiativesCapacityAdvisor.routes.ts` · `server/src/routes/initiativeBackbone.routes.ts`, `initiativeGeneratorBrain.routes.ts`, `initiatives-additive.routes.ts`, `initiative-governance.routes.ts`, `initiativeMaterialize.routes.ts`, `initiativeCandidates.routes.ts` · `server/src/controllers/InitiativeController.ts` · `server/src/middleware/executionSpineLegacyReadOnly.middleware.ts`, `effectiveCapability.middleware.ts` (`Z12`-adjacent — bramki platformowe, nietykalne) · `server/src/services/objectAttachmentService.ts` · `server/src/domain/initiatives-execution/**` (`materialCommand.ts`, `postgresMaterialCommandUnitOfWork.ts`) |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/organizationContext/OrganizationContextService.ts` (wzorzec `R3`) · `server/migrations/20260912_claude_c_org_context_snapshots.sql`, `20260830_day147_object_attachments.sql`, `20260901_initiative_object_attachments_type.sql` |
| Odczyt (ZAKAZ ZAPISU) | `vitest.config.ts` · `tests/setup.ts` (`Z18`) · `server/src/database/Database.ts` |
| **Wszystko inne** | **TYLKO ODCZYT** — opisujesz potrzebę w raporcie z `plik:linia` i idziesz dalej |

**Nietykalne imiennie:** `vitest.config.ts` · `tests/setup.ts` · `Database.ts` ·
`server/src/middleware/executionSpineLegacyReadOnly.middleware.ts` ·
`server/src/middleware/effectiveCapability.middleware.ts` · każdy inny
`MODULE_ACCEPTANCE.md` poza Inicjatyw.

---

# 5. TWARDE ZASADY

- ★★ **CEL JEST POMIAR, NIE NAPRAWA.** Zero usuwania martwego kodu, zero podłączania
  załączników pod `runtime-v1`, zero zmiany bramek. Jedyny wyjątek: nowe pliki testowe
  czysto dowodowe (`R2.4`), które NIE zmieniają kodu produkcyjnego.
- ★★ **NIE MYL „KOD ISTNIEJE" Z „KOD SIĘ WYKONUJE".** `§1.3` pokazuje 25 dróg zapisu,
  których handlery istnieją, ale nigdy nie biegną (bramka 409-uje wcześniej). `§1.2`/`R2`
  pokazuje odwrotność: kod, który biegnie tylko wtedy, gdy jest wywołany, a nie jest.
  Za każdym razem dowodem jest ścieżka wykonania, nie obecność funkcji w pliku.
- ★★ **DOWÓD MUTACYJNY DLA `LAZY_FIELDS` (`R2.4`) MUSI BYĆ NA ŻYWEJ BAZIE.** Sam odczyt
  kodu `InitiativeController.ts:996-1024` wystarcza jako wstępna teza, ale raport MUSI
  zawierać realne żądanie `PUT` i realny `SELECT` z `initiative_history` przed/po.
- ★★ **BRAMKA UPRAWNIEŃ JEST FAIL-CLOSED CZY FAIL-OPEN? SPRAWDŹ WŁASNYM OCZAMI.** `§1.5`
  opiera się na komentarzu W KODZIE, nie tylko na Twojej lekturze — zweryfikuj brak
  `EFFECTIVE_ACCESS_ENFORCE`/`EFFECTIVE_ACCESS_SHADOW` w całym repo, nie tylko w jednym
  pliku konfiguracyjnym.
- ★ **PUŁAPKI ŚRODOWISKA — SPRAWDŹ KAŻDĄ U SIEBIE:** `server/src/database/Database.ts` ok.
  `:80-88` cicho podstawia atrapę bazy bez `RUN_DB_TESTS=1`; `Database.ts:686` atrapa zwraca
  `changes:1` dla KAŻDEGO `UPDATE` niezależnie od `WHERE` — **to jest szczególnie
  niebezpieczne dla `R2.4`**: dowód mutacyjny na atrapie bazy dałby fałszywe „zapisano",
  MUSISZ być na realnym Postgresie (`Z25`/`Z26`); `vitest.config.ts:210` przypina
  `DB_TYPE='sqlite'`; `tests/setup.ts:896` podmienia `global.fetch`; **komentarze w kodzie
  bywają nieaktualne, ale w tym dyżurze bywają też WIARYGODNE — `§1.5` opiera się na
  komentarzu, który sam siebie przyznaje za nieszczelny; odróżniaj te dwa przypadki
  dowodem, nie zaufaniem**.
- ★ **`Z13`:** logi i pliki wynikowe NIE wchodzą do repo — leżą w
  `/private/tmp/cx-day241-inicjatywy-artefakty`, raport podaje ścieżki i `shasum -a 256`.
- ★ **PUSH WYŁĄCZNIE NA `github-backup`.** `origin` jest PUBLICZNY.
- ★★ **SEKCJA „TWIERDZENIA NIEZWERYFIKOWANE" W RAPORCIE JEST OBOWIĄZKOWA.** Brak tej sekcji
  jest podstawą odrzucenia dyżuru.
