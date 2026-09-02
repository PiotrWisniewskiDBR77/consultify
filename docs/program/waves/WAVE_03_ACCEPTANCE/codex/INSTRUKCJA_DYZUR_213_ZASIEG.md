# INSTRUKCJA DYŻURU nr 213 — Codex — „Dług zasięgu z karty odbioru 210 (pozycje 5-9): cztery insertery (`knowledgeIndexer.ts:868`, `ai.routes.ts:599`, `ai.routes.ts:868`, `insightSignalBridgeService.ts:203`) piszą do `knowledge_docs` bez jawnego `scope`, więc polegają na wartości domyślnej kolumny, która dziś wygrywa wyścig dwóch niezależnych runtime-ALTER-ów; `scope='project'` (żywy, realnie produkowany przez `POST /api/knowledge/documents` z kontrolą członkostwa w projekcie) nie jest sprawdzany przez ŻADEN z dwóch filtrów retrievalu wektorowego; te dwa filtry (`embeddingService.buildKnowledgeDocAccessFilter`, `ragService.appendKnowledgeDocAccessFilter`) są dwiema niezależnymi implementacjami tej samej reguły z różną postawą fail-open/fail-closed przy braku kolumny; `ai_visibility`/`sensitivity` są pomijane przez oba; kolumna `knowledge_docs.scope` nie ma dedykowanej migracji, tylko dwa konkurujące runtime-ALTER-y i jeden gigantyczny, udokumentowanie zawodny plik migracji."

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
> **wyłącznie** `/private/tmp/cx-day213-zasieg`.

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
Zakres: **Przekrojowy silnik wiedzy (Moduł 17) — warstwa zasięgu/dostępu w `knowledge_docs`. Kontynuacja karty odbioru `docs/program/funkcje/ODBIOR_210.md` (sekcja „LISTA FIX-ów”, pozycje FIX-5 do FIX-9) i pozycji `213` z `docs/program/funkcje/LISTA_DYZUROW_211_222.md`. Cztery grupy plików: (1) insertery — `server/src/services/ai/knowledgeIndexer.ts`, `server/src/routes/ai.routes.ts`, `server/src/services/v8/insightSignalBridgeService.ts`; (2) filtry retrievalu — `server/src/services/ai/embeddingService.ts`, `server/src/services/ragService.ts`; (3) producent `scope='project'` i źródło prawdy o wartości — `server/src/services/KnowledgeService.ts`, `server/src/services/organizationContext/ContextDocumentService.ts`, `server/src/routes/knowledge.routes.ts`; (4) migracje — `server/migrations/`, `server/scripts/migrate.postgres.ts`. Zero ekranów, zero UI, zero nowych flag — to jest wyłącznie warstwa zapytań i schematu.**.
Trasy front: `Brak. Dyżur wyłącznie backendowy (warstwa zapisu i filtrowania w bazie wiedzy). Front konsumuje pośrednio przez czat i przez Vault (`knowledge.routes.ts`), ale żaden komponent frontowy nie jest modyfikowany, czytany na potrzeby zmiany, ani nawet uruchamiany. Jeśli w trakcie pracy okaże się, że naprawa A.3 (`scope='project'`) wymaga przewleczenia `projectId` przez front — to WYKRACZA poza ten dyżur (patrz A.3: fail-closed dla braku listy projektów jest wystarczającym, kompletnym rozwiązaniem TEGO dyżuru); zgłoś to jako osobną pozycję w raporcie, nie dotykaj frontu.`. Trasy tył: `**Insertery (A.1, zmierzone przeze mnie na `fe33ce8036`, potwierdź SAM):** `knowledgeIndexer.ts` `insertDocument` (definicja `:863`, INSERT PG `:868` bez kolumny `scope`, `ON CONFLICT DO UPDATE` `:871-879`, gałąź SQLite `INSERT OR REPLACE` `:896-898`); typ `KnowledgeDoc` (`:161-169`) bez pola `ownerId`; wołacze: `knowledgeIndexer.ts:407`, `externalRagProvider.ts:69`. `ai.routes.ts` — trasa `POST /attachments/ingest` (`router.post` `:419`, `verifyToken`+`requireActiveTenantMembership`, INSERT `:597-601` bez `scope`) i `POST /attachments/ingest-url` (`router.post` `:671`, `verifyToken`, INSERT `:866-870` bez `scope`, komentarz `:858-861` nazywający oba handlery „identycznym” wzorcem); mount `app.use('/api/ai', aiRoutes)` (`Gateway.ts:600`) — pełne ścieżki `POST /api/ai/attachments/ingest`, `POST /api/ai/attachments/ingest-url`. `insightSignalBridgeService.ts` `indexInsightInKnowledgeBase` (`:138-220`, INSERT `:203` bez `scope`, `ON CONFLICT DO UPDATE` `:206-210`), wołana z `onInsightPublished` (`:311-322`). **Filtry retrievalu (A.2-A.4):** `embeddingService.ts` `buildKnowledgeDocAccessFilter` (prywatna metoda klasy, `:341-400`; wywołania z `searchPg` `:316`); fail-closed przy braku kolumny (`:370-386`, `NOT EXISTS(... d.id = alias.document_id)`), owner-exception (`:388-394`), reguła bazowa `d.scope = 'user'` (`:396-399`). `ragService.ts` `appendKnowledgeDocAccessFilter` (funkcja modułowa, `:231-325`; wywołania z `bm25Search` `:830` i drugiej ścieżki `:1019`); `columns: Set<string>` budowany przez cache'owane `ensureKnowledgeDocsColumns()`; klauzula scope `:315-322`, fail-OPEN przy braku kolumny (`if (hasScope) {...}` bez `else`). **Producent `scope='project'` (A.3, dowód M1 z body):** `knowledge.routes.ts` `router.post('/documents', ...)` (`:881`), `parseVaultScope` (`:41`, typ `VaultDocumentScope = 'user'|'project'|'organization'` w `KnowledgeService.ts:17`), `requestedScope` (`:915`), kontrola członkostwa `canAccessProject` (`:924-932`), wywołanie `KnowledgeService.addDocument(..., ownerId, requestedScope)` (`:963-972`); mount `app.use('/api/knowledge', gatewayVerifyToken, trialEntryGuard, highRiskSurfaceGuard({categories:['upload','ai_memory']}), knowledgeRoutes)` (`Gateway.ts:886-892`). `KnowledgeService.ts` `addDocument` — komentarz VLT-001 `:635-637`, normalizacja scope `:639-640`, INSERT z kolumną `scope` `:642-658`. **Governance osobna (A.4):** `documentGovernance.ts` `filterDocumentsByVisibility` (`:18` ok., SELECT `ai_visibility`/`sensitivity` `:34`, reguła blokady `:65-66`), wołacze: `AIPipeline.ts:28`/`:1229`, `ContextRetrievalService.ts:22`/`:356` — ZERO wołań z `embeddingService.ts`/`ragService.ts` (zweryfikowane grepem, zero trafień). **Źródło kolumny `scope` (A.5):** dwa runtime-ALTER-y — `KnowledgeService.ts:172-174` (`ensureKnowledgeSchema`, BEZ `DEFAULT`), `ContextDocumentService.ts:2379`/`:2398` (`ensureSchema`, `ADD COLUMN scope TEXT DEFAULT 'user'`) — oba leniwe, oba przez `{fallback:true}`, oba mogą przegrać wyścig; jeden plik migracji, który TEŻ dokłada kolumnę jako efekt uboczny — `server/migrations/20260719_baseline_gap.sql:13063` (`alter table knowledge_docs add column if not exists "scope" text default 'user'::text`) — ale ten sam plik jest w repo udokumentowany jako zawodny dla siostrzanej kolumny tej samej tabeli, patrz `server/migrations/940_mw010_vault_document_versions.sql:60-66`. Sortowanie migracji: `server/scripts/migrate.postgres.ts` funkcja `sortMigrationsDeterministically` (zaimportowana `:76`/`:104`, komentarz o fazach `:200-243`) — Faza 0 NUMEROWANA (sortowana numerycznie) PRZED Fazą 1 DATOWANĄ (sortowaną kalendarzowo); `20260719_baseline_gap.sql` jest w Fazie 1, więc każda migracja numerowana (`000_`...`960_`...) wykonuje się przed nią.`.

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
WT=/private/tmp/cx-day213-zasieg
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
git -C "$VAULT" worktree add "$WT" -b codex/day213-zasieg-20260831 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day213-zasieg/config.worktree"
cat "$VAULT/worktrees/cx-day213-zasieg/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day213-zasieg-scratch
mkdir -p /private/tmp/cx-day213-zasieg-artefakty

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
git -C "$WT" push github-backup codex/day213-zasieg-20260831
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only fe33ce8036..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `dziewięć` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day213-zasieg

# (T1) ★ Cztery insertery — czy żaden nie ustawia `scope`? Oczekiwane: TAK, żaden.
grep -n "INSERT INTO knowledge_docs" server/src/services/ai/knowledgeIndexer.ts \
  server/src/routes/ai.routes.ts server/src/services/v8/insightSignalBridgeService.ts
#   oczekiwane: knowledgeIndexer.ts:868, ai.routes.ts:599, ai.routes.ts:868,
#   insightSignalBridgeService.ts:203 — w ŻADNEJ z czterech list kolumn nie ma `scope`.
#   Jeśli linia się przesunęła, zaufaj SWOJEMU wynikowi, nie numerowi z tej instrukcji.

# (T2) ★★★ Który z dwóch runtime-ALTER-ów wygrywa wyścig o DEFAULT? Zmierz na SWOJEJ bazie,
#   PO pełnych migracjach (blok 0 poniżej), PRZED pierwszym żądaniem do aplikacji.
grep -n "ADD COLUMN scope" server/src/services/KnowledgeService.ts \
  server/src/services/organizationContext/ContextDocumentService.ts
#   oczekiwane: KnowledgeService.ts:174 BEZ DEFAULT; ContextDocumentService.ts:2398 Z
#   `DEFAULT 'user'`. Który wygra na Twojej bazie zależy od tego, którą usługę użyjesz
#   jako pierwszą w testach A.1 — zmierz `\d knowledge_docs` po obu i zapisz w raporcie.

# (T3) ★★★ scope='project' — czy jest produkowany i czy filtry go znają? Oczekiwane:
#   produkowany TAK, sprawdzany przez filtry NIE.
grep -n "parseVaultScope\|requestedScope === 'project'\|canAccessProject" server/src/routes/knowledge.routes.ts
grep -n "scope" server/src/services/ai/embeddingService.ts server/src/services/ragService.ts \
  | grep -v "^.*://" | grep "'project'"
#   oczekiwane: pierwszy grep pokazuje żywy kod z kontrolą członkostwa
#   (knowledge.routes.ts ok. 915, 921-934); drugi grep daje PUSTY wynik — 'project' nie
#   występuje w SQL żadnego z dwóch filtrów.

# (T4) ★★★ Dwie implementacje — zmierz DOKŁADNE linie (karta 210 ma je nieaktualne) i
#   postawę przy braku kolumny.
grep -n "buildKnowledgeDocAccessFilter\|function appendKnowledgeDocAccessFilter" \
  server/src/services/ai/embeddingService.ts server/src/services/ragService.ts
sed -n '341,400p' server/src/services/ai/embeddingService.ts
sed -n '231,325p' server/src/services/ragService.ts
#   oczekiwane: embeddingService — `if (!hasScope) return { sql: "NOT EXISTS(...)" }`
#   (fail-closed); ragService — `if (hasScope) { ... }` BEZ else (fail-open przy braku
#   kolumny). To jest ROZBIEŻNOŚĆ POSTAWY, nie tylko duplikacja kodu.

# (T5) ★★ ai_visibility/sensitivity — potwierdź że documentGovernance jest jedynym
#   egzekutorem i że oba filtry retrievalu go nie znają.
grep -n "ai_visibility\|sensitivity" server/src/services/ai/documentGovernance.ts
grep -n "documentGovernance\|ai_visibility\|sensitivity" server/src/services/ai/embeddingService.ts \
  server/src/services/ragService.ts
#   oczekiwane: pierwszy grep — trafienia w documentGovernance.ts (m.in. SELECT na :34);
#   drugi grep — ZERO trafień w obu plikach filtrów.

# (T6) ★ Migracja — potwierdź brak dedykowanego pliku i sprawdź kolejność faz sortowania.
grep -rln "ADD COLUMN.*scope\|add column.*scope" server/migrations/*.sql | xargs grep -l "knowledge_docs"
grep -n "sortMigrationsDeterministically\|Faza 0\|Faza 1\|PHASE" server/scripts/migrate.postgres.ts | head -10
ls server/migrations | grep -E "^96[0-9]_"
#   oczekiwane: pierwszy grep pokazuje WYŁĄCZNIE 20260719_baseline_gap.sql (żaden mały,
#   dedykowany plik); drugi potwierdza istnienie funkcji fazowej; trzeci pokazuje, które
#   numery 960-969 są wolne DZIŚ — zweryfikuj TUŻ PRZED utworzeniem pliku migracji w A.5,
#   bo inne dyżury fali 211-222 mogą zająć numer w międzyczasie.

# (T7) ★ Istniejące wzorce testowe do naśladowania — konwencja nazw i strażnika.
ls server/src/services/ai/__tests__/day210.*.pg.test.ts
grep -n "describe.skipIf\|assertRealPostgresTestEnvironment" \
  server/src/services/ai/__tests__/day210.embeddingScope.pg.test.ts | head -5
cat tests/unit/backend/services/ragService.document-access.test.ts | head -20
#   oczekiwane: day210.embeddingScope.pg.test.ts istnieje, strażnik jest w `beforeAll`,
#   NIE za `describe.skipIf` (FIX-3 karty 210) — skopiuj ten wzorzec dla nowych testów.

# (T8) ★ Trasy i middleware — potwierdź mount i bramki, których nie wolno ruszać.
grep -n "app.use('/api/ai'\|app.use(\s*'/api/knowledge'" server/src/Gateway.ts
sed -n '419,425p;671,678p' server/src/routes/ai.routes.ts
#   oczekiwane: Gateway.ts:600 (`/api/ai`, aiRoutes), Gateway.ts:886-892 (`/api/knowledge`,
#   verifyToken+trialEntryGuard+highRiskSurfaceGuard+knowledgeRoutes); obie trasy z A.1
#   mają własny verifyToken (+ requireActiveTenantMembership dla ingest).

# (T9) ★★ PORTY, DOCKER, MIEJSCE NA DYSKU
df -h /
lsof -nP -iTCP:6153 -iTCP:5096 -iTCP:5097 -sTCP:LISTEN
lsof -nP -iTCP:6154-6157 -iTCP:5098-5105 -sTCP:LISTEN
docker ps -a --format '{{.Names}}\t{{.Ports}}'
#   oczekiwane: lsof PUSTY dla Twoich trzech portów I dla pasma zarezerwowanego dla
#   dyżurów 214-217 (jeśli TAM coś nasłuchuje, to NIE Twoje — nie dotykaj); docker może
#   pokazywać kontenery poprzednich/równoległych dyżurów (cx-day2xx-pg) — NIE DOTYKAJ ich.
#   Zajęty Twój port lub <4GB wolnego dysku = STOP całości (§0.5), nie improwizacja.
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day213-zasieg-20260831` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6153`. Twój JEDYNY port harnessu to `5096 i 5097`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day213-pg`**. **ZAKAZANE:** `zajęte na stałe u innych (nie Twoje, nie dotykaj): `6012`, `5433`, `6047`, `6054-6152`, `5010-5095`, `6404-6411`. ZABRONIONE na przód (rezerwacja dyżurów 214-217, biegną równolegle w tej samej fali): `6154-6157`, `5098-5105`. Zakazane trwale, niezależnie od programu: `5000` (macOS Control Center), `5037` (`adb`), `5060-5061` (SIP/`ERR_UNSAFE_PORT`). Twoje własne: baza `6153`, harness `5096` i `5097` — **sprawdź `lsof` i `docker ps` PRZED startem** (`§0.1` krok 0, `Z7`); jeśli którykolwiek z Twoich portów jest zajęty, to jest powód do STOP-u CAŁOŚCI (`§0.5`), nie do wzięcia innego portu.`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `★★★ **ZERO NOWYCH FLAG. ZERO ZMIANY WARTOŚCI DOMYŚLNEJ JAKIEJKOLWIEK ISTNIEJĄCEJ FLAGI.** Żadna z pięciu pozycji (A.1-A.5) nie ma dziś flagi funkcyjnej i żadna jej nie dostaje w tym dyżurze — to naprawa poprawności danych (jawny `scope` zamiast domyślnej wartości z wyścigu) i naprawa reguły dostępu w retrievalu (nie feature do stopniowego udostępniania). Zmierzone: `grep -n "ENABLE_\|process.env" ` na wszystkich czterech inserterach z A.1 nie pokazuje żadnej flagi bramkującej ich wywołanie. Jeżeli uznasz w trakcie pracy, że któraś z napraw (np. fail-closed dla `scope='project'` bez listy projektów w A.3) potrzebuje wyłącznika awaryjnego na wypadek regresji funkcjonalnej — **NIE dodawaj go samodzielnie**, opisz to jako rekomendację w raporcie i zostaw decyzję nadzorcy. Reguła „wygląd tylko za flagą OFF do akceptu” (`CLAUDE.md` §7) dotyczy WYGLĄDU; tu nie ma wyglądu, jest tylko dane i SQL.`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**` (w szczególności `verifyToken`, `requireActiveTenantMembership`, `trialEntryGuard`, `highRiskSurfaceGuard` — montowane na trasach, których INSERT-y poprawiasz w A.1, i na `/api/knowledge` w A.3), `server/src/routes/knowledge.routes.ts` funkcja `canAccessProject` (kontrola członkostwa w projekcie — czytasz i naśladujesz jej WYNIK w A.3, nie zmieniasz jej samej), `server/src/services/ai/documentGovernance.ts` (`filterDocumentsByVisibility` i jej reguła — kopiujesz regułę do A.4, NIE zmieniasz źródła), `server/src/services/ai/chatPolicyGateway.ts`, `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*`. ★★ ZADNEJ Z NICH NIE ZMIENIASZ w sensie osłabienia — wolno Ci CZYTAĆ i NAŚLADOWAĆ ich reguły (dokładnie to robi A.4 wobec `documentGovernance`), nie wolno Ci ich obniżyć, ominąć ani „przy okazji ujednolicić” z czymś innym. Jedyna dopuszczalna zmiana cudzego kontraktu w tym dyżurze to zmiana ADDYTYWNA (nowy opcjonalny parametr z domyślną wartością zachowującą dzisiejsze zachowanie) — i każdy istniejący wołacz dostaje w raporcie wiersz „dotknięty / nietknięty + dowód”.`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY213_ZASIEG_REPORT.md`. Nie zmieniasz żadnego `MODULE_ACCEPTANCE.md` — dyżur przekrojowy (silnik wiedzy / warstwa zasięgu), nie jeden moduł z tabeli WAVE_03_ACCEPTANCE, dokładnie jak dyżur 210 przed Tobą.. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day213-zasieg-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day213-zasieg-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **NIE OGŁASZASZ ŻADNEJ Z PIĘCIU POZYCJI ZA ZROBIONĄ BEZ CZERWONEGO TESTU I BEZ DOWODU MUTACYJNEGO.** Kolejność jest nienaruszalna dla każdej: test, który DZIŚ PADA na nienaprawionym kodzie (bo znajduje wiersz z domyślnym/nieobsłużonym zasięgiem), potem naprawa, potem zdjęcie warunku i pokazanie, że test znowu pada. Test napisany PO naprawie, od razu zielony, nie dowodzi niczego — patrz `WSPOLNA_PRZYCZYNA_ODBIORY_204_210.md`: trzy z czterech niezależnych odbiorów 31.08 zmierzyły dokładnie ten sam błąd metodyczny (zabezpieczenie bez testu, który czerwienieje po jego USUNIĘCIU, jest nieudowodnione). ★★★ **NIE zmieniasz wartości domyślnej kolumny `scope` w migracji A.5** — zostaje `'user'`, to jest zmierzony dzisiejszy stan (karta 210), a zmiana defaultu jest zmianą zachowania dla każdego nieznanego, niezmierzonego przez Ciebie wołacza. ★★★ **NIE usuwasz runtime-ALTER-ów** z `KnowledgeService.ts:174` ani `ContextDocumentService.ts:2398` — po A.5 stają się nieszkodliwymi no-opami na bazie, która przeszła Twoją migrację; ich usunięcie to osobna zmiana z osobnym ryzykiem dla środowisk, które Twojej migracji jeszcze nie mają. ★★ **NIE dotykasz `documentGovernance.ts` ani jej dwóch wołaczy** (`AIPipeline.ts`, `ContextRetrievalService.ts`) — A.4 KOPIUJE jej regułę do wspólnej funkcji z A.2, nie refaktoruje źródła. ★★ **NIE przewlekasz `projectId` przez cały łańcuch wołających `ragService`/`embeddingService` w tym dyżurze** — to osobny, większy zakres (analogiczny do FIX-2 karty 210 dla `userId`, wciąż martwego w produkcji). W A.3 fail-closed dla braku listy projektów jest KOMPLETNYM, wystarczającym rozwiązaniem tej pozycji. ★★ **NIE dokumentujesz `scope='project'` jako „nieużywany”** — dowód M1 w body (żywy, zamontowany `POST /api/knowledge/documents` z kontrolą członkostwa) zamyka tę furtkę z zamówienia definitywnie; jeśli mimo to dojdziesz do wniosku, że naprawa jest niewykonalna w tym dyżurze, to jest STOP MERYTORYCZNY z pełnym opisem promienia rażenia, nie cichy wpis. ★★ **NIE wykonujesz zapytania `SELECT source_type, scope, count(*) FROM knowledge_docs GROUP BY 1,2` (z FIX-5 karty 210) na bazie zdalnej, demo, stagingu ani produkcji (`Z28`).** Piszesz je jako gotowy, tylko-odczytowy `SELECT` do checklisty nadzorcy — zero połączeń wychodzących. ★★ **NIE zostawiasz kontenera.** `docker rm -f -v cx-day213-pg` na końcu, także gdy dyżur padnie w połowie. | Przewaga produktu opiera się na tym, że system zna kontekst organizacji klienta — Teresa i agent mają czytać dokładnie to, do czego dana osoba ma prawo, ani mniej, ani więcej. Dziś baza wiedzy AI ma TRZY różne, niezależne pojęcia „kto to widzi”, zmierzone w tym dyżurze: (1) `embeddingService.buildKnowledgeDocAccessFilter` (`embeddingService.ts:341-400`) — fail-closed przy braku kolumny `scope`, zna wyłącznie `'user'`; (2) `ragService.appendKnowledgeDocAccessFilter` (`ragService.ts:231-325`, klauzula `scope` na 315-322) — fail-OPEN przy braku kolumny `scope` (warunek dokładany tylko `if (hasScope)`, bez gałęzi na jego brak), też zna wyłącznie `'user'`; (3) `documentGovernance.ts:34` — trzeci, zupełnie osobny system poufności (`ai_visibility`/`sensitivity`), egzekwowany WYŁĄCZNIE na ścieżce załączników czatu, nieznany żadnemu z dwóch powyższych. Do tego dochodzi czwarty problem: domyślna wartość kolumny `scope` nie ma jednego źródła prawdy — `KnowledgeService.ts:174` (`ALTER TABLE knowledge_docs ADD COLUMN scope TEXT`, BEZ `DEFAULT`) i `ContextDocumentService.ts:2398` (`ALTER TABLE knowledge_docs ADD COLUMN scope TEXT DEFAULT 'user'`) to dwa niezależne, leniwe bootstrapy tej samej kolumny na tej samej tabeli, uruchamiane przy pierwszym użyciu odpowiednio Vault i kontekstu organizacji — który wygra, zależy od kolejności realnych żądań w danym procesie serwera, nie od kodu. Skutek zmierzony na karcie 210: cztery insertery (paczki metodyczne/DRD, załączniki czatu, opublikowane insighty), które nie ustawiają `scope` jawnie, mogą — zależnie od wygranego wyścigu — stać się ciche prywatne i zniknąć z wyników wszystkim, łącznie z paczkami metodycznymi produktu. Piąty, zmierzony PRZEZ AUTORA TEJ INSTRUKCJI (nie przez kartę 210): `scope='project'` NIE jest teoretyczną, nieużywaną wartością enuma — `knowledge.routes.ts` ma żywy, zamontowany endpoint `POST /api/knowledge/documents` (`knowledge.routes.ts:881`, `Gateway.ts:886-892`), który przy `scope='project'` SPRAWDZA członkostwo w projekcie (`canAccessProject`, `knowledge.routes.ts:924-932`) i dopiero wtedy zapisuje wiersz. Ta realna granica dostępu jest dziś martwa dla AI: żaden z dwóch filtrów retrievalu jej nie zna, więc dokument sejfu projektowego jest w wyszukiwaniu wektorowym/BM25 widoczny całej organizacji — nie tylko członkom projektu. To nie jest dług kosmetyczny: to znaczy, że nie wiemy, co Teresa naprawdę widzi, i że jedna z trzech reguł dostępu (ta w warstwie AI-retrievalu) systematycznie ignoruje granicę, którą druga warstwa (upload) właśnie zbudowała i wyegzekwowała. |

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
cd /private/tmp/cx-day213-zasieg

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day213-pg psql -U postgres -d cx213 \
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
cd /private/tmp/cx-day213-zasieg

docker run -d --name cx-day213-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx213 \
  -p 127.0.0.1:6153:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day213-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6153/cx213 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6153/cx213 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day213-zasieg && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6153/cx213 \
JWT_SECRET=cx213-test-secret-do-not-reuse \
npx vitest run server/src/services/ai/__tests__ oraz server/src/routes/__tests__ oraz server/src/services/v8/__tests__ oraz tests/unit/backend/services --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day213-zasieg-artefakty/day213-knowledge-scope.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day213-zasieg && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/services/ai/__tests__ oraz server/src/routes/__tests__ oraz server/src/services/v8/__tests__ oraz tests/unit/backend/services --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day213-zasieg-artefakty/day213-knowledge-scope.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day213-zasieg/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day213-pg psql -U postgres -d cx213 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day213-pg`.
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
> **(e) ★★★ **Pierwsza — trzy z pięciu cytatów karty 210 są dziś nieaktualne.** FIX-210 przesunął linie w `embeddingService.ts` (`buildKnowledgeDocAccessFilter` z `:320` na `:341`) i w `ragService.ts` (klauzula scope z `:302` na `:315-322`, funkcja zaczyna się na `:231`). Jeśli zacytujesz numer z karty 210 bez własnego `grep`, trafisz w niewłaściwą linię albo w pusty wiersz. **Zmierz każdą linię cytowaną w tej instrukcji SAM, zanim ją użyjesz w kodzie albo w raporcie.** ★★★ **Druga — domyślna wartość kolumny `scope` NIE JEST stała, jest wynikiem wyścigu.** `KnowledgeService.ts:174` (bez `DEFAULT`) i `ContextDocumentService.ts:2398` (`DEFAULT 'user'`) to dwa niezależne, leniwe bootstrapy tej samej kolumny. Jeżeli napiszesz test A.1 zakładając „scope domyślnie = 'user'” bez zmierzenia, który z dwóch ALTER-ów wygrał NA TWOJEJ bazie, możesz dostać `NULL` zamiast `'user'` i błędnie ocenić naprawę jako niepotrzebną (bo `NULL` i tak przechodzi oba filtry jako „widoczne”, nie jako „prywatne”) — a mimo to A.1 (jawny `scope`) jest właściwą naprawą w OBU przypadkach, bo eliminuje zależność od wyścigu. Zmierz w T2 i zapisz wynik. ★★★ **Trzecia — dwie implementacje mają PRZECIWNĄ postawę przy braku kolumny `scope`.** `embeddingService.ts` jest fail-closed (`NOT EXISTS`, wyklucza wszystko), `ragService.ts` jest fail-OPEN (`if (hasScope) {...}` bez gałęzi na brak — zero warunku, wszystko przechodzi). Zjednoczenie w A.2 wymaga ŚWIADOMEGO wyboru jednej postawy — skopiowanie przez przypadek fail-OPEN do wspólnej funkcji byłoby REGRESJĄ bezpieczeństwa ukrytą wewnątrz „refaktoru”. ★★ **Czwarta — `scope='project'` jest żywy, nie martwy.** `knowledge.routes.ts:915-934` produkuje go z realną kontrolą członkostwa. Jeśli napiszesz test przeciwko nieistniejącemu/martwemu producentowi zamiast przeciwko temu endpointowi, dostaniesz fałszywe poczucie, że naprawiłeś coś nieużywanego. ★★ **Piąta — silnik decyduje, którą gałąź testujesz.** `embeddingService.search` rozgałęzia się na `searchPg`/`searchSqlite` po `process.env.DB_TYPE === 'postgres'`, a oba configi vitest domyślają `DB_TYPE` do `'sqlite'`. Test bez jawnego `DB_TYPE=postgres` w tej samej linii komendy wykona `searchSqlite` — inną implementację, inny SQL — i „przejdzie”, nie dotykając gałęzi z demo. ★★ **Szósta — `describe.skipIf` udaje sukces.** Wzorzec testów realPG w tym repo (`day210.embeddingScope.pg.test.ts`) pokazuje POPRAWNY wzorzec PO FIX-3 karty 210: strażnik `assertRealPostgresTestEnvironment()` w `beforeAll`, NIGDY `describe.skipIf` przed nim — skopiuj ten wzorzec, nie odtwarzaj błędu, który 210 już raz naprawił.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day213-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day213-zasieg-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`Pięć pozycji, w kolejności A.1 → A.2 → A.3 → A.4 → A.5. **A.2 jest warunkiem wstępnym A.3 i A.4** (nie da się dopisać reguły `scope='project'` ani `ai_visibility` do funkcji, która jeszcze nie jest zjednoczona) — rób je sekwencyjnie, nie równolegle, commit po każdej. A.1 (cztery insertery ustawiają `scope` jawnie) i A.5 (dedykowana migracja) są niezależne od reszty i od siebie nawzajem — możesz je zrobić w dowolnym miejscu sekwencji, ale nie przerywaj bloku A.2→A.3→A.4 w połowie. Wszystkie pięć są rdzeniem tego dyżuru — nie ma pozycji opcjonalnych ani inwentarzowych poza `§R.2` (raport).`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6153` albo `5096 i 5097` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6153` albo `5096 i 5097`** (`Z7`).

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

Dyżur 210 (`docs/program/funkcje/ODBIOR_210.md`, scalony FIX-210 `470cf94606`) zamknął **P0**:
prywatny sejf użytkownika (`scope='user'`) przestał wyciekać do obcych członków tej samej
organizacji przez ścieżkę embeddingów. Karta odbioru 210, sekcja „LISTA FIX-ów", zostawiła
**świadomie nienaprawione FIX-5 do FIX-9** — to jest ten dług, pozycje 5-9 w numeracji karty:

> „Nadal otwarte (dług starszy niż 210, pozycje 5-9 karty): cztery insertery nie ustawiają
> zasięgu, a domyślna wartość kolumny to »prywatne«; `scope='project'` nieobsługiwany; dwie
> niezależne implementacje tej samej reguły." (`ODBIOR_210.md`, akapit „★ SCALONE PO FIX-210")

Ten dyżur zamyka **pięć** pozycji: FIX-5 (insertery), FIX-6 (dwie implementacje), FIX-7
(`scope='project'`), FIX-8 (`ai_visibility`/`sensitivity`) i domknięcie FIX-4 od strony migracji
(FIX-4 sam dodał tylko głośny log — kolumna `scope` nadal nie ma dedykowanej migracji).

## ★★ Pomiar wykonany PRZEZ AUTORA INSTRUKCJI na `fe33ce8036` — karta 210 poprzesuwała linie

FIX-210 (cztery commity: FIX-1 do FIX-4) zmienił `embeddingService.ts` i `ragService.ts` w
miejscach, które karta 210 cytuje. **Trzy z pięciu cytatów karty są dziś NIEAKTUALNE** —
zmierz je SAM ponownie, nie ufaj ani karcie, ani tej instrukcji:

| Cytat karty 210 | Stan na `fe33ce8036` (zmierzone przeze mnie) |
| --- | --- |
| `embeddingService.ts:320` (`buildKnowledgeDocAccessFilter`) | Definicja funkcji jest dziś na **linii 341**. Linia 320 to dziś pusty wiersz wewnątrz `searchPg`. Treść funkcji (341-400) niezmieniona co do logiki: `if (!hasScope) return NOT EXISTS(...)`; `if (userId && hasOwner) … d.scope = 'user' AND d.owner_id IS DISTINCT FROM $n`; inaczej `… d.scope = 'user'` bez wyjątku. **`scope='project'` nigdzie nie występuje.** |
| `ragService.ts:302` (klauzula scope) | Funkcja `appendKnowledgeDocAccessFilter` zaczyna się na **linii 231**; klauzula scope, którą karta cytowała jako `:302`, jest dziś na **liniach 315-322** (`if (hasScope) { if (userId && hasOwner) … d.scope != 'user' OR d.owner_id = ? … else … d.scope != 'user' }`). Linia 302 to dziś `}` zamykający blok `if (hasStatus)`. **`scope='project'` nigdzie nie występuje.** |
| `KnowledgeService.ts:636` | **AKTUALNE, bez zmian.** To komentarz `// ★ VLT-001: scope ∈ {user,project,organization}; …`; sama normalizacja `scope === 'user' \|\| scope === 'project' \|\| scope === 'organization' ? scope : 'organization'` jest na linii 640. |
| `knowledgeIndexer.ts:868`, `ai.routes.ts:599`/`:868`, `insightSignalBridgeService.ts:203` | **AKTUALNE, bez zmian** — FIX-210 nie dotykał żadnego z czterech inserterów. Zweryfikowano `grep -n "INSERT INTO knowledge_docs"` na wszystkich trzech plikach: trafienia dokładnie na cytowanych liniach. |
| `documentGovernance.ts:34` | **AKTUALNE, bez zmian.** `SELECT id, ai_visibility, sensitivity FROM knowledge_docs WHERE id IN (...)`. |

**Konsekwencja dla Ciebie:** w tabeli licencji i w pozycjach poniżej cytuję linie ze stanu
`fe33ce8036`. Jeżeli między wydaniem tej instrukcji a Twoim startem ktoś scalił coś do
`codex/m03-admin-20260824`, linie mogą znowu się przesunąć — **zmierz sam, `grep` przed
edycją, nie polegaj na numerze z tego dokumentu jako na prawdzie objawionej** (`§0.5` /
sekcja „Rozbieżność między pomiarem a instrukcją NIE JEST sprzecznością").

## ★★ Pomiar, którego karta 210 NIE zrobiła i który zmienia treść zamówienia w dwóch miejscach

**(M1) `scope='project'` MA żywego producenta — „udokumentować jako nieużywany" jest
ZAMKNIĘTE jako opcja.** Karta 210 (FIX-7) i lista dyżurów 211-222 dopuszczają dla tej pozycji
ciszę „zero producentów, opisz i zostaw". **To jest fałszywe.** `server/src/routes/knowledge.routes.ts`
ma żywy, zamontowany endpoint Vault:

```
POST /api/knowledge/documents   (Gateway.ts:886-892, mount z verifyToken + trialEntryGuard +
                                  highRiskSurfaceGuard({categories:['upload','ai_memory']}))
knowledge.routes.ts:881          router.post('/documents', verifyToken, …)
knowledge.routes.ts:915          const requestedScope = parseVaultScope(req.body?.scope) || 'organization';
knowledge.routes.ts:921-934      if (requestedScope === 'project') { … canAccessProject(...) sprawdza
                                  członkostwo w projekcie, 403 gdy brak dostępu … }
knowledge.routes.ts:963-972      KnowledgeService.addDocument(…, ownerId, requestedScope)
KnowledgeService.ts:636-658      addDocument zapisuje `scope` DOSŁOWNIE do knowledge_docs.scope
```

Czyli: użytkownik wgrywa dokument do sejfu PROJEKTOWEGO, serwer **sprawdza członkostwo w
projekcie** i dopiero wtedy zapisuje `scope='project'`. To jest realna, świadomie zbudowana
granica dostępu — nie martwy kod, nie nieużywana wartość enuma. `buildKnowledgeDocAccessFilter`
i `appendKnowledgeDocAccessFilter` tej granicy **nie znają w ogóle** — dokument, który przeszedł
kontrolę członkostwa przy uploadzie, jest w retrievalu AI widoczny **całej organizacji**,
dokładnie jak dokument `scope='organization'`. Gałąź „udokumentuj jako nieużywany" z bramek
zlecenia **odpada** dla tej pozycji na dowodzie powyżej — pozycja A.3 niżej wymaga naprawy,
nie opisu.

**(M2) Wartość domyślna kolumny `scope` pochodzi z WYŚCIGU dwóch niezależnych runtime-ALTER-ów,
nie z jednego źródła prawdy — a to zmienia, CO dokładnie dziury z FIX-5 robią.** Kolumna
`knowledge_docs.scope` NIE pochodzi z żadnej migracji uruchamianej deterministycznie przed nią
(patrz M3 niżej) — pochodzi z pierwszego z dwóch leniwych bootstrapów, który zdąży wykonać się
jako pierwszy w życiu procesu serwera:

```
KnowledgeService.ts:172-174        ALTER TABLE knowledge_docs ADD COLUMN scope TEXT
                                    (BEZ DEFAULT), wołane leniwie z ensureKnowledgeSchema()
                                    przy PIERWSZYM użyciu KnowledgeService (np. pierwszy
                                    upload do Vault)
ContextDocumentService.ts:2398     ALTER TABLE knowledge_docs ADD COLUMN scope TEXT DEFAULT 'user'
                                    wołane leniwie z ensureSchema() przy PIERWSZYM użyciu
                                    ContextDocumentService (np. pierwszy upload kontekstu
                                    organizacji/interview)
```

Oba idą przez `DbPromise.run(…, { fallback: true })` — Postgres nie zna `ADD COLUMN IF NOT
EXISTS scope` bez jawnego dopisania, więc **ten z dwóch, który wykona się jako DRUGI, dostaje
błąd „column already exists" połknięty przez `fallback:true` i jego `DEFAULT` NIGDY nie trafia
do schematu.** Który serwis zostanie użyty jako pierwszy w danym procesie (Vault czy kontekst
organizacji) jest zależne od kolejności realnych żądań, nie od kodu. Karta 210 zmierzyła na
swojej bazie `column_default = 'user'::text` — czyli na TEJ bazie `ContextDocumentService`
wygrał wyścig. **Nie zakładaj, że u Ciebie wygra ten sam** — zmierz to na SWOJEJ świeżej bazie
testowej w `§0.1a` (T2) i zapisz wynik w raporcie. Jeżeli u Ciebie wygra `KnowledgeService.ts:174`
(bez `DEFAULT`), cztery insertery z FIX-5 nie tworzą wcale wierszy „prywatnych" — tworzą wiersze
z `scope IS NULL`, które oba filtry retrievalu (`d.scope = 'user'` / `d.scope != 'user'`)
traktują jako **widoczne**, nie jako prywatne. Innymi słowy: **skutek FIX-5 zależy od tego,
który z dwóch wyścigów wygrał na Twojej bazie, i musisz to zmierzyć, a nie przyjąć z karty.**
Niezależnie od wyniku wyścigu, POZYCJA A.1 (jawny `scope` w każdym inserterze) jest właściwą
naprawą w obu przypadkach — bo eliminuje zależność od wyścigu.

**(M3) Istnieje TRZECIE źródło kolumny `scope` — gigantyczna migracja `20260719_baseline_gap.sql`
(33841 linii, `ALTER TABLE … ADD COLUMN IF NOT EXISTS "scope" text default 'user'::text` na
linii 13063) — ale repo SAMO dokumentuje ten plik jako niepewny.** Komentarz w
`server/migrations/940_mw010_vault_document_versions.sql:60-66` (inny dyżur, MW-10, ten sam
problem na kolumnie `file_size_bytes` tej samej tabeli) mówi wprost:

> „…pojedynczy wpis w `20260719_baseline_gap.sql`, wielkim pliku z udokumentowanym dryfem
> (potrafi paść/zostać pominięty w całości na części środowisk — patrz nagłówki testów realdb
> w tym repo). Skutek: na środowisku, które trafiło na ten dryf, KAŻDY upload do Vault pada z
> »column file_size_bytes does not exist«…"

Czyli: TAK, istnieje plik migracji, który w teorii dokłada `scope`. NIE, nie jest to
dedykowana, wąska, pewna migracja — to efekt uboczny 33-tysiąclinijkowego auto-wygenerowanego
zrzutu różnicowego, który program **sam u siebie** uznał za niewystarczający dowód (dokładnie
ta sama klasa kolumny, `knowledge_docs.file_size_bytes`, dostała PÓŹNIEJ własną, dedykowaną,
bezwarunkową migrację nr `940` właśnie dlatego, że poleganie na `baseline_gap.sql` samo w sobie
okazało się zawodne w praktyce). Pozycja A.5 wymaga tego samego traktowania dla `scope`.

## Dlaczego to jest przeoczenie, a nie decyzja produktowa

Nikt nigdy nie zdecydował „paczki metodyczne i insighty mają być prywatne dla przypadkowego
wiersza bez `owner_id`" — to jest efekt uboczny domyślnej wartości kolumny, o której istnieniu
cztery miejsca piszące do `knowledge_docs` nie wiedzą. Podobnie nikt nie zdecydował „sejf
projektowy ma być czytelny całej organizacji przez AI" — `knowledge.routes.ts` explicite
sprawdza członkostwo w projekcie przy zapisie; **AI retrieval tej kontroli po prostu nie zna**.

# 2. TEZY ZLECENIA

Każdą z poniższych tez masz **obalić albo potwierdzić własnym pomiarem** — potwierdzenie i
obalenie liczą się identycznie jako sukces dyżuru (`§0.5`).

- **T1.** Cztery insertery (`knowledgeIndexer.ts:868`, `ai.routes.ts:599`, `ai.routes.ts:868`,
  `insightSignalBridgeService.ts:203`) piszą do `knowledge_docs` bez kolumny `scope` w liście
  kolumn INSERT-a.
- **T2.** Kolumna `knowledge_docs.scope` nie ma jednego źródła prawdy o wartości domyślnej —
  dwa niezależne runtime-ALTER-y (`KnowledgeService.ts:174` bez `DEFAULT`,
  `ContextDocumentService.ts:2398` z `DEFAULT 'user'`) rywalizują o to, który zdąży pierwszy;
  wygrany zależy od kolejności żądań w danym procesie, nie od kodu.
- **T3.** `scope='project'` jest REALNIE produkowany (`knowledge.routes.ts:915-934`, z kontrolą
  członkostwa w projekcie), ale **żaden** z dwóch filtrów retrievalu wektorowego
  (`embeddingService.buildKnowledgeDocAccessFilter`, `ragService.appendKnowledgeDocAccessFilter`)
  go nie sprawdza — dokument projektowy jest w AI widoczny całej organizacji.
- **T4.** Ta sama reguła dostępu ma dwie niezależne implementacje o **różnej postawie
  bezpieczeństwa przy braku kolumny `scope`**: `embeddingService.ts` jest wtedy fail-closed
  (wyklucza WSZYSTKO), `ragService.ts` jest wtedy fail-OPEN (nie dokłada żadnego warunku).
- **T5.** `ai_visibility`/`sensitivity` (egzekwowane wyłącznie w
  `documentGovernance.ts:34`, ścieżka załączników czatu) są całkowicie pomijane przez oba
  filtry retrievalu wektorowego — dokument oznaczony jako niedostępny dla AI może dalej
  gruntować odpowiedź z wyszukiwania.
- **T6.** Nie istnieje dedykowana, wąska, bezwarunkowa migracja dla `knowledge_docs.scope`
  analogiczna do migracji `940` dla `file_size_bytes` tej samej tabeli; jedyny plik migracji,
  który tę kolumnę dokłada, jest tym samym plikiem, który program już raz udokumentował jako
  zawodny dla siostrzanej kolumny na tej samej tabeli.

# 3. POZYCJE DYŻURU

**Kolejność zależności: A.2 jest warunkiem wstępnym A.3 i A.4** (nie da się „obsłużyć
`scope='project'` w zjednoczonej regule", zanim reguła jest zjednoczona) — rób je w kolejności
A.1 → A.2 → A.3 → A.4 → A.5, commit po każdej. A.1 i A.5 są niezależne od reszty i od siebie
nawzajem; jeśli chcesz, możesz je zrobić przed A.2, ale nie przerywaj sekwencji A.2→A.3→A.4.

## A.1 — Cztery insertery ustawiają `scope` jawnie

**Cel:** żaden z czterech inserterów nie polega na wartości domyślnej kolumny. Każdy pisze
`scope` DOSŁOWNIE w liście kolumn INSERT-a, z wartością uzasadnioną w raporcie.

**Wartość dla wszystkich czterech: `'organization'`, nie `'user'`.** Uzasadnienie zmierzone
przeze mnie, potwierdź: wszystkie cztery miejsca piszą treść, którą sam kod już dziś traktuje
jako współdzieloną w organizacji, nigdy jako prywatną dla jednej osoby:

| Inserter | Co wstawia | Dowód, że to NIE jest prywatne |
| --- | --- | --- |
| `knowledgeIndexer.ts:863-911` (`insertDocument`) | paczki narzędziowe / metodyka / rozdziały książki DRD (`doc.sourceType` ∈ `tool_pack`\|`methodology`\|`product_pill`, patrz `embeddingService.ts` `GLOBAL_KNOWLEDGE_SOURCE_TYPES`, `ragService.ts:229`) | typ `KnowledgeDoc` (`knowledgeIndexer.ts:161-169`) NIE MA pola `ownerId`; wołający: `knowledgeIndexer.ts:407`, `externalRagProvider.ts:69` — brak koncepcji właściciela |
| `ai.routes.ts:576-604` (`POST /api/ai/attachments/ingest`, trasa `:419`) | załącznik czatu wgrany do organizacji (`orgId = req.organizationId`, `verifyToken` + `requireActiveTenantMembership`) | brak `owner_id`/`userId` w całym handlerze; komentarz na `:858-861` nazywa `/attachments/ingest` i `/attachments/ingest-url` „identycznym" wzorcem |
| `ai.routes.ts:845-872` (`POST /api/ai/attachments/ingest-url`, trasa `:671`) | jak wyżej, treść pobrana z URL | jak wyżej |
| `insightSignalBridgeService.ts:138-220` (`indexInsightInKnowledgeBase`, wołana z `onInsightPublished:311-322`) | insight **opublikowany** (nazwa funkcji dosłownie) | „opublikowany" jest przeciwieństwem prywatnego z definicji nazwy; `organizationId` jest parametrem funkcji, `ownerId`/`userId` — nie ma |

**Implementacja — wzorzec identyczny w czterech miejscach:** dopisz `scope` do listy kolumn i
`VALUES`/`$n`, z literałem `'organization'` (nie parametrem — te cztery miejsca nie mają skąd
wziąć innej wartości). Dla `knowledgeIndexer.ts` dopisz też `scope = 'organization'` do
`ON CONFLICT (id) DO UPDATE SET` (PG, ok. `:871-879`) i sprawdź `INSERT OR REPLACE`
(SQLite, `:896-898`, gdzie `REPLACE` nadpisuje cały wiersz — brakujące pole wypadnie z powrotem
do `NULL`/domyślnej, jeśli go nie dodasz). Dla `insightSignalBridgeService.ts` dopisz też do
`ON CONFLICT(id) DO UPDATE SET` (`:206-210`).

**Mutacyjna bramka — CZTERY osobne czerwienie, nie jedna zbiorcza.** Dla KAŻDEGO z czterech
inserterów: (1) test, który woła REALNY eksportowany kod produkcyjny (nie kopię SQL-a) i
odczytuje `SELECT scope FROM knowledge_docs WHERE id = ?` po wstawieniu — asercja
`scope === 'organization'`; (2) usuń `scope` z TEGO JEDNEGO insertera (`cp` do `/private/tmp/cx-day213-zasieg-scratch`
przed edycją, `Z27`) — test MUSI się zaczerwienić (albo `NULL`, albo test w ogóle inny wynik,
zależnie od wygranej wyścigu z T2 — zapisz który); (3) przywróć z kopii, test zielony,
`git diff` puste. **Trasy `ai.routes.ts` testujesz przez realny `ApiGateway`, nie przez goły
`express()`** (`Z22`) — `POST /api/ai/attachments/ingest` wymaga multipart (`multer`, pole
`file`) i nagłówka `Authorization` z podpisanym JWT; `POST /api/ai/attachments/ingest-url`
wymaga `validateBody(IngestUrlAttachmentRequestSchema)` — sprawdź kształt schematu przed
napisaniem body żądania. `knowledgeIndexer.insertDocument`/`insightSignalBridgeService`
wołasz bezpośrednio jako wyeksportowane funkcje serwisowe na realnym Postgresie — to jest
realny kod produkcyjny, nie replika.

**DoD A.1:** cztery czerwienie osobno udowodnione i przywrócone; `SELECT source_type, scope,
count(*) FROM knowledge_docs GROUP BY 1,2` na Twojej testowej bazie pokazuje `organization` dla
wierszy każdego z czterech `source_type` użytych w testach, zero `NULL` i zero `user` tam, gdzie
nie powinno być.

## A.2 — Zjednoczenie dwóch implementacji w jedno źródło prawdy

**Cel:** `embeddingService.buildKnowledgeDocAccessFilter` (`embeddingService.ts:341-400`) i
`ragService.appendKnowledgeDocAccessFilter` (`ragService.ts:231-325`, klauzula scope na
`:315-322`) przestają być dwoma niezależnymi implementacjami tej samej reguły. Jedna funkcja,
oba dotychczasowi wołający jej używają.

**Zmierzona różnica postaw (T4), którą MUSISZ zachować świadomie albo naprawić świadomie —
nie zgnieść przypadkiem przy scalaniu:**

| | `embeddingService.ts:341-400` | `ragService.ts:231-325` |
| --- | --- | --- |
| Brak kolumny `scope` | **fail-closed**: `if (!hasScope) return { sql: "NOT EXISTS(... d.id = alias.document_id)", … }` — wyklucza WSZYSTKO, co ma dokument-rodzica w `knowledge_docs` | **fail-OPEN**: `if (hasScope) { … }` bez `else` — brak kolumny = ZERO warunku dołożonego do SQL, wszystko przechodzi |
| Dialekt | pozycyjne `$n` (Postgres) | `?` (oba dialekty przez wywołującego) |
| Sposób wykrycia kolumn | `information_schema.columns` / `PRAGMA table_info` **wołane przy KAŻDYM wyszukiwaniu**, bez cache (FIX-9 karty 210, poza zakresem tej pozycji — nie musisz naprawiać, ale nie pogarszaj: nie dokładaj drugiego niecache'owanego zapytania) | `columns: Set<string>` wstrzykiwany przez wołającego, budowany przez `ensureKnowledgeDocsColumns()` — TA funkcja JEST cache'owana |
| Właściciel (owner exception) | `userId && hasOwner` → wyjątek dla właściciela | identyczna logika, `userId && hasOwner` → wyjątek |

**Rekomendacja (zweryfikuj, nie kopiuj na wiarę):** wydziel WSPÓLNĄ funkcję czystą
(bez zależności od `this`/klasy), np. `buildKnowledgeDocScopeFilter({ columns, userId, dialect,
aliasOrPrefix })`, zwracającą `{ sql, params }` w wybranym dialekcie, z **jedną** świadomie
wybraną postawą przy braku kolumny (fail-closed jest bezpieczniejszy, ale zmierz — patrz
ZAKAZ_WLASCIWY_TEMU_DYZUROWI o skutku fail-closed „per wiersz" vs „per rozstrzygnięcie
pochodzenia", ten sam wzorzec co dyżur 210 zmierzył dla `ai_knowledge_embeddings`; tu problem
jest mniejszy, bo `knowledge_docs` jest tabelą, na której `scope` mieszka bezpośrednio, nie
przez anty-złączenie — ale sprawdź to zdanie sam, zanim je powtórzysz w raporcie). Umieść ją w
jednym pliku (kandydat: nowy `server/src/services/ai/knowledgeDocAccessFilter.ts`, albo
`embeddingService.ts` jako plik-właściciel z eksportem — Ty decydujesz, uzasadnij wybór jednym
zdaniem w raporcie) i zaimportuj w OBU miejscach. `embeddingService.ts` i `ragService.ts` mają
dziś różne mechanizmy pozycyjnych parametrów SQL (`$n` vs `?` przez wołającego) — wspólna
funkcja musi przyjmować dialekt jako parametr, nie zgadywać go.

**Mutacyjna bramka:** zdejmij warunek `scope` z WNĘTRZA wspólnej funkcji (jedna mutacja, jedno
miejsce) → test WOŁAJĄCY PRZEZ `embeddingService.search()` (dyspozytor, nie `searchPg`
bezpośrednio — dokładnie ta pułapka, którą FIX-1 dyżuru 210 naprawiał) **i** test wołający przez
`ragService.searchRelevantChunks`/`hybridSearch`/`bm25Search` **oba** muszą się zaczerwienić.
Jedna czerwień bez drugiej = unifikacja niepełna (jeden z wołających dalej ma martwą kopię albo
nie używa wspólnej funkcji naprawdę).

**Rozłączność z A.1:** ta pozycja NIE dotyka żadnego z czterech inserterów z A.1 — zmienia
WYŁĄCZNIE stronę odczytu (filtr), nigdy stronę zapisu (wartość kolumny).

## A.3 — `scope='project'` obsłużony w zjednoczonej regule

**Wymaganie od `§0`/materiał M1:** żadna wersja „udokumentuj jako nieużywany, zero
producentów" nie jest dostępna dla tej pozycji — `knowledge.routes.ts:915-934` jest żywym,
zamontowanym producentem z własną kontrolą członkostwa w projekcie. **Cisza jest zakazana.**

**Kształt naprawy:** wspólna funkcja z A.2 dostaje dodatkowy, opcjonalny parametr niosący
identyfikator/zbiór identyfikatorów projektów, do których wołający ma dostęp (analogicznie do
tego, jak `userId` już niesie tożsamość osoby). Kluczowe pytanie do rozstrzygnięcia i
udokumentowania w raporcie: **skąd retrieval AI ma wiedzieć, do jakich projektów należy
wołający, skoro dzisiejsi wołający (`ragService.searchRelevantChunks`,
`embeddingService.search`) nie niosą `projectId` ani listy projektów w ogóle?** Zmierz
`grep -rn "projectId" server/src/services/ragService.ts server/src/services/ai/embeddingService.ts`
— jeśli wynik jest pusty (oczekiwane), to jest DRUGI ogólny brak przewleczenia tożsamości, tej
samej rodziny co FIX-2 karty 210 dla `userId` (dziś martwy w produkcji, tam naprawiony).
**Nie jesteś zobowiązany przewlekać `projectId` przez cały łańcuch wołających w tym dyżurze**
(to osobny, większy zakres, analogiczny do FIX-2) — jesteś zobowiązany:
(a) zbudować filtr, KTÓRY POTRAFI ograniczyć `scope='project'` do podanej listy projektów, gdy
lista jest podana; (b) gdy lista NIE jest podana (dzisiejszy stan wszystkich realnych wołaczy),
**wykluczyć `scope='project'` całkowicie** z tej samej przyczyny, dla której brak `userId`
wyklucza `scope='user'` — brak dowodu przynależności = fail-closed, nie „przepuść jak
organization". Zero wyjątków „bo wygodniej".

**Mutacyjna bramka:** (1) dokument `scope='project'` NIE wraca w wyszukiwaniu bez podanej listy
projektów — dziś (przed naprawą) MUSI wracać (bo filtr go nie zna → traktowany jak
`organization`); test na to jest Twoim czerwonym testem PRZED naprawą. (2) po naprawie: dokument
wraca, gdy `projectId` podanego wołającego jest na liście, nie wraca, gdy nie jest — dwa osobne
przypadki. (3) zdjęcie warunku projektu z wewnątrz wspólnej funkcji → czerwień w obu (embedding
i rag) tak jak w A.2.

## A.4 — `ai_visibility`/`sensitivity` honorowane w retrievalu wektorowym

**Zmierzone (T5):** `documentGovernance.ts:34` czyta `ai_visibility`/`sensitivity` z
`knowledge_docs`, ale WYŁĄCZNIE dla listy załączników (`filterDocumentsByVisibility`, wołana z
`AIPipeline.ts:28`/`:1229` i `ContextRetrievalService.ts:22`/`:356`) — zero wołań z
`embeddingService.ts` lub `ragService.ts` (`grep -n "documentGovernance\|ai_visibility\|sensitivity"`
na obu plikach → 0 trafień, zweryfikowane). Dokument, który właściciel oznaczył jako
niedostępny dla AI (`ai_visibility != 'allowed'`) albo o podniesionej poufności
(`sensitivity`), **nadal gruntuje odpowiedzi przez wyszukiwanie wektorowe/BM25**, bo ta ścieżka
o żadnym z tych dwóch pól nie wie.

**Kształt naprawy:** dołóż do wspólnej funkcji z A.2 warunek SQL analogiczny do istniejącego w
`documentGovernance.ts` (`vis = row.ai_visibility || 'allowed'`, `:65`; sprawdź DOKŁADNIE, jaka
wartość oznacza „zablokowane" — nie zgaduj z nazwy pola, przeczytaj całą funkcję
`filterDocumentsByVisibility`, `documentGovernance.ts:18-90` ok., i **skopiuj tę samą regułę**,
nie wymyślaj nowej). Kolumny `ai_visibility`/`sensitivity` na `knowledge_docs` — potwierdź SAM,
czy mają domyślną wartość i czy istnieją niezależnie od `scope` (inny bootstrap? ten sam
runtime-ALTER?) — to wpływa na to, czy potrzebujesz analogicznego `hasVisibility`/`hasSensitivity`
guarda jak `hasScope`.

**Mutacyjna bramka:** dokument z `ai_visibility` ustawionym na wartość blokującą (ustal jaką z
lektury `documentGovernance.ts`) NIE wraca z wyszukiwania wektorowego po naprawie; przed naprawą
— wraca (czerwony test). Zdjęcie warunku z wewnątrz wspólnej funkcji → czerwień w obu ścieżkach,
jak w A.2/A.3.

**Rozłączność:** NIE zmieniasz `documentGovernance.ts` ani jej dwóch wołaczy
(`AIPipeline.ts`, `ContextRetrievalService.ts`) — to działający, osobny system; kopiujesz jego
regułę, nie refaktorujesz go.

## A.5 — Dedykowana migracja dla `knowledge_docs.scope`

**Cel, zmierzony na precedensie z tego samego repo (M3):** kolumna `scope` dostaje TAKIE SAMO
traktowanie, jakie migracja `940` dała siostrzanej kolumnie `file_size_bytes` na tej samej
tabeli — jeden, wąski, bezwarunkowy plik migracji, właściciel kolumny, niezależny od tego, czy
`20260719_baseline_gap.sql` się wykona.

**Kroki:**
1. Zweryfikuj wolny numer w paśmie NUMEROWANYM (Faza 0 sortowania — patrz `T6` niżej,
   `sortMigrationsDeterministically` w `server/scripts/migrate.postgres.ts`), kandydat
   `961`-`964`; **zmierz SAM tuż przed utworzeniem pliku** (`ls server/migrations | grep -E
   "^96[0-9]_"`) — inne dyżury fali 211-222 mogły w międzyczasie zająć numer, wybierz pierwszy
   wolny i zapisz w raporcie, którego użyłeś i jaki był wynik komendy.
2. Treść: `ALTER TABLE knowledge_docs ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'user'`.
   **`DEFAULT 'user'` zostaje** (nie `'organization'`) — to jest wartość, którą karta 210
   zmierzyła jako aktualnie obowiązującą (`ContextDocumentService.ts:2398`), i zmiana wartości
   domyślnej kolumny to zmiana zachowania dla KAŻDEGO wołacza, którego nie zmierzyłeś (poza
   czterema z A.1, które od teraz i tak są jawne) — nie Twoja decyzja w tym dyżurze.
   Numerowana migracja (Faza 0) wykonuje się PRZED wszystkimi migracjami datowanymi
   (`20260303...`, `20260719_baseline_gap.sql`, …) — więc Twoja migracja jest tym, co realnie
   tworzy kolumnę na świeżej bazie, niezależnie od losu pliku z `M3`.
3. **Dowód wymagany dosłownie z treści zlecenia — pełny łańcuch migracji od PUSTEJ bazy
   przechodzi** (`§0.2c` blok A, DWA przebiegi, drugi idempotentny) — wklej pełne wyjście obu
   przebiegów do raportu, nie tylko `tail -20`. Po obu przebiegach:
   `docker exec cx-day213-pg psql -U postgres -d cx213 -c "\d knowledge_docs"` musi pokazać
   `scope` z `column_default = 'user'::text`, **przed** jakimkolwiek requestem do aplikacji
   (czyli PRZED tym, jak którykolwiek z dwóch runtime-ALTER-ów z M2 miałby szansę się wykonać) —
   to jest dowód, że wyścig z T2/M2 przestał mieć znaczenie.
4. **Nie usuwasz** runtime-ALTER-ów z `KnowledgeService.ts:174` ani
   `ContextDocumentService.ts:2398` w tym dyżurze — `ADD COLUMN IF NOT EXISTS` w Twojej migracji
   sprawia, że oba stają się nieszkodliwymi no-opami na bazie, która przeszła migracje (kolumna
   już istnieje z właściwym `DEFAULT`), a usunięcie ich to osobna zmiana z własnym ryzykiem
   (bazy, które NIE przeszły Twojej migracji — np. środowiska sprzed tego dyżuru — nadal na nie
   polegają). Zostawienie ich to świadoma decyzja, nie przeoczenie — zapisz to zdanie w raporcie.

**DoD A.5:** nowy plik migracji istnieje, jest addytywny, `IF NOT EXISTS`, jeden numer, jedna
odpowiedzialność (`scope`, nic więcej); dwa przebiegi od pustej bazy w raporcie; `\d
knowledge_docs` pokazuje kolumnę z właściwym `DEFAULT` zaraz po migracjach, przed startem
jakiejkolwiek aplikacji.

# 4. TABELA LICENCJI PLIKOWEJ

| Zakres | Ścieżki |
| --- | --- |
| Zapis | `server/src/services/ai/knowledgeIndexer.ts` — wyłącznie `insertDocument` (863-911): dopisanie `scope` |
| Zapis | `server/src/routes/ai.routes.ts` — wyłącznie dwa INSERT-y `knowledge_docs` (ok. 597-603, 866-872); **zero innych zmian w tym pliku 8000+ linii** |
| Zapis | `server/src/services/v8/insightSignalBridgeService.ts` — wyłącznie `indexInsightInKnowledgeBase` (138-220): dopisanie `scope` |
| Zapis | `server/src/services/ai/embeddingService.ts` — `buildKnowledgeDocAccessFilter` (341-400): zastąpienie ciała wywołaniem wspólnej funkcji z A.2 |
| Zapis | `server/src/services/ragService.ts` — `appendKnowledgeDocAccessFilter` (231-325): jak wyżej |
| Zapis (nowy plik) | wspólna funkcja z A.2 — lokalizacja Twojego wyboru, uzasadniona w raporcie |
| Zapis (nowy plik) | migracja A.5 w `server/migrations/`, numer zweryfikowany jako wolny tuż przed utworzeniem |
| Zapis (nowe pliki) | testy A.1-A.4 — `server/src/services/ai/__tests__/`, `server/src/routes/__tests__/`; **nowe pliki w `tests/` (katalog root) wymagają `git add -f`, te katalogi nie są pod `tests/` root, ale i tak sprawdź `git status --short` po każdym commicie** |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY213_ZASIEG_REPORT.md` |
| Odczyt | `server/src/services/KnowledgeService.ts` — źródło prawdy o `scope` (636-658, 172-183); **nie zmieniasz** |
| Odczyt | `server/src/services/organizationContext/ContextDocumentService.ts` — producent `scope='project'`/`'user'` przez Vault UI (2379-2420, 2865-2900); **nie zmieniasz** |
| Odczyt | `server/src/routes/knowledge.routes.ts` — dowód M1, kontrola członkostwa (881-937); **nie zmieniasz** |
| Odczyt | `server/src/services/ai/documentGovernance.ts` — źródło reguły dla A.4 (18-90); **nie zmieniasz, kopiujesz regułę** |
| Odczyt | `server/src/services/ai/AIPipeline.ts`, `server/src/services/organizationContext/ContextRetrievalService.ts` — wołacze `documentGovernance`; **nie zmieniasz** |
| Odczyt | `server/migrations/940_mw010_vault_document_versions.sql`, `server/migrations/20260719_baseline_gap.sql`, `server/scripts/migrate.postgres.ts` (`sortMigrationsDeterministically`) — kontekst A.5; **nie zmieniasz** |
| Odczyt | `server/src/services/ai/__tests__/day210.embeddingScope.pg.test.ts`, `tests/unit/backend/services/ragService.document-access.test.ts` — wzorce konwencji testowej; **nie zmieniasz, chyba że dopisujesz nowe `it` bez naruszania istniejących** |
| Nie dotykasz w ogóle | `server/src/services/ai/embeddingService` (plik bez rozszerzenia, martwy duplikat obok `.ts` — zgłoszony już w karcie 210, nie usuwaj, nie edytuj) |

★ **Rozłączność z dyżurami 214-217 (fala B, równoległe):** dotyczą modułu 17 (Agent/Teresa) —
`aiActionExecutor.ts`, `chatActions.ts`, komponenty czatu. Twój zakres to warstwa retrievalu
wiedzy, nie warstwa akcji. Jeśli w swoim worktree zobaczysz zmiany w plikach spoza tabeli
powyżej — STOP i zgłoś zamiast zgadywać, nie zakładaj że to bezpieczne zignorować.

# 5. TWARDE ZASADY

- ★★★ **Kolejność A.2 → A.3 → A.4 jest wiążąca.** Nie da się osadzić reguły `scope='project'`
  ani `ai_visibility` w funkcji, która jeszcze nie istnieje jako jedna funkcja.
- ★★★ **Cztery czerwienie w A.1, nie jedna zbiorcza.** Test, który mutuje wszystkie cztery
  insertery naraz i sprawdza jeden zbiorczy wynik, nie dowodzi, że KAŻDY z czterech jest
  faktycznie naprawiony — dokładnie wzorzec z `WSPOLNA_PRZYCZYNA_ODBIORY_204_210.md`
  („zabezpieczenie bez testu, który czerwienieje PO JEGO USUNIĘCIU, jest nieudowodnione").
- ★★★ **`scope='project'` NIE WOLNO udokumentować jako nieużywany.** Dowód M1 (żywy, zamontowany
  endpoint z kontrolą członkostwa) zamyka tę furtkę. Jeśli mimo wszystko dojdziesz do wniosku,
  że naprawa jest niewykonalna w tym dyżurze — to jest **STOP MERYTORYCZNY z pełnym opisem
  promienia rażenia**, nie cichy wpis „nieużywane".
- ★★ **Nie zmieniasz wartości domyślnej kolumny `scope` w migracji A.5.** Zostaje `'user'` —
  to jest dzisiejszy stan (zmierzony przez kartę 210), a zmiana defaultu to zmiana zachowania
  dla każdego nieznanego wołacza, nie zakres tego dyżuru.
- ★★ **Nie usuwasz runtime-ALTER-ów** z `KnowledgeService.ts`/`ContextDocumentService.ts` —
  stają się nieszkodliwe po A.5, ich usunięcie to osobna decyzja z osobnym ryzykiem dla baz,
  które nie przeszły Twojej migracji.
- ★★ **Nie dotykasz `documentGovernance.ts` ani jej wołaczy** — kopiujesz regułę do A.4,
  nie refaktorujesz źródła.
- ★★ **Zero nowych flag, zero zmiany wartości domyślnej istniejącej flagi.** Żadna z pięciu
  pozycji nie ma dziś flagi i żadna jej nie dostaje — to naprawa poprawności danych i
  bezpieczeństwa retrievalu, nie funkcja do stopniowego udostępniania.
- ★★ **`Z28` — zero połączeń do bazy zdalnej, demo, stagingu, produkcji.** `SELECT source_type,
  scope, count(*) FROM knowledge_docs GROUP BY 1,2` (z karty 210, FIX-5) piszesz jako gotowy,
  tylko-odczytowy `SELECT` do checklisty nadzorcy — **nie wykonujesz go nigdzie poza swoim
  lokalnym kontenerem**.
- ★★ **`Z31` — `assertRealPostgresTestEnvironment()` bez argumentów**, nigdy z
  `expectedDatabase` przypiętym do `cx213`/portu/hosta.
- ★★ **`DB_TYPE=postgres` jawnie w tej samej linii** — oba configi vitest domyślają do
  `sqlite`; test A.2/A.3/A.4 bez tego mierzy `searchSqlite`, inny SQL, inne kolumny.
- **`describe.skipIf` przy niekompletnym env = fałszywe PASS.** Raportujesz `numTotalTests`,
  nie exit code.
- **`§0.4a` — pomiar zasięgu testów jest warunkiem oddania raportu (`Z24`).** Liczysz sam.
- **`docker rm -f -v cx-day213-pg` na końcu**, także gdy dyżur padnie w połowie.
- **Każdą cytowaną w tej instrukcji linię sprawdzasz sam przed użyciem** — sekcja 1 wyżej
  pokazuje, że trzy z pięciu cytatów karty 210 były już nieaktualne po jednym dniu (FIX-210).
  Repo jest dzielone z dyżurami równoległymi fali 211-222.
- ★ **Kolejność scaleń w ramach fali A (211-213):** ten dyżur nie zna zakresu 211/212 poza tym,
  co jest w `docs/program/funkcje/LISTA_DYZUROW_211_222.md` — jeśli przy starcie zobaczysz w
  worktree pliki spoza tabeli licencji, STOP i zgłoś zamiast zgadywać, kto je zostawił.

## Sekcja „TWIERDZENIA NIEZWERYFIKOWANE" w raporcie jest obowiązkowa

Wypisz w niej wprost co najmniej:

- **(a)** Który z dwóch runtime-ALTER-ów (`KnowledgeService.ts:174` czy
  `ContextDocumentService.ts:2398`) wygrywa wyścig NA TWOJEJ bazie testowej PRZED wykonaniem
  migracji A.5 — zmierzone czy założone z karty 210?
- **(b)** Czy `ai_visibility`/`sensitivity` na `knowledge_docs` mają własny, niezależny
  bootstrap (migracja czy runtime-ALTER) — zmierzone czy przyjęte?
- **(c)** Czy istnieje jakikolwiek REALNY wołający `ragService.searchRelevantChunks` albo
  `embeddingService.search`, który już dziś przekazuje `projectId` albo listę projektów — Twój
  `grep` w A.3 dał zero, ale czy przeszukałeś WSZYSTKIE wywołania, czy tylko te dwa pliki?
- **(d)** Czy `scope='project'` faktycznie zniknął z wyników po naprawie A.3 w teście
  end-to-end, czy tylko w teście jednostkowym samej funkcji filtra?
- **(e)** Czy wybrana lokalizacja wspólnej funkcji z A.2 (nowy plik czy `embeddingService.ts`
  jako właściciel) była jedynym rozważanym wariantem, czy porównałeś alternatywy?
- **(f)** Czy numer migracji A.5, który wybrałeś, był rzeczywiście wolny w chwili TWOJEGO
  commitu, czy tylko w chwili pomiaru na początku dyżuru (między jednym a drugim mogła zajść
  kolizja z dyżurem równoległym)?
- **(g)** Czy porty `6153`/`5096 i 5097` i miejsce na dysku były wolne w chwili
  Twojego startu — pomiar autora instrukcji to migawka z chwili składania, nie gwarancja.
