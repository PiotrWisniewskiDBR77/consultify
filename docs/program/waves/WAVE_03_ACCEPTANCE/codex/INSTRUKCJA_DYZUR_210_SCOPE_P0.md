# INSTRUKCJA DYŻURU nr 210 — Codex — „★ P0 BEZPIECZEŃSTWO — egzekwowanie `scope='user'` (Vault, VLT-001) na ścieżce embeddingów: prywatny dokument użytkownika A jest DZIŚ zwracany użytkownikowi B TEJ SAMEJ organizacji przez domyślną ścieżkę `ragService.searchRelevantChunks` → `embeddingService.search()` → `ai_knowledge_embeddings` (tabela BEZ kolumny scope/owner); VLT-002 domknął WSZYSTKICH czytelników `knowledge_chunks` i ANI JEDNEGO czytelnika `ai_knowledge_embeddings`. R1 czerwony test kontraktu, R2 naprawa u źródła zapytań + mutacja, R3 regresja uprawnionych przypadków + inwentarz danych zastanych."

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
> **wyłącznie** `/private/tmp/cx-day210-scope-p0`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `15c7a68b9d`**
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
Zakres: **Przekrojowy silnik wiedzy (Moduł 17) — łańcuch retrievalu: `server/src/services/ai/embeddingService.ts` (rdzeń defektu), `server/src/services/ragService.ts` (`searchRelevantChunks` — rozgałęzienie na ścieżkę bezpieczną i dziurawą), `server/src/services/KnowledgeService.ts` (producent wierszy Vault w obu tabelach), `server/src/services/ai/tools/searchKnowledgeBase.ts` (konsument bez `userId`), `server/src/services/InterviewInsightService.ts` (drugi, surowy czytelnik tej tabeli). Zero ekranów, zero zmian UI, zero nowych flag.**.
Trasy front: `brak — dyżur wyłącznie backendowy (filtr dostępu w warstwie zapytań). Front konsumuje pośrednio przez czat; żaden komponent frontowy nie jest modyfikowany. Jeśli Twoja naprawa wymusi przekazanie `userId` przez kontrakt narzędzia, zmiana kończy się na warstwie serwerowej (`llmService`/`AIPipeline` budują `context` po stronie serwera) — jeśli okaże się inaczej, STOP i zgłoś, zamiast dotykać frontu.`. Trasy tył: `**Rdzeń defektu (zmierzone przeze mnie na `15c7a68b9d`, potwierdź SAM):** `server/src/services/ai/embeddingService.ts` — `searchPg` (definicja linia 252, SQL linie 257-286) filtruje `minSimilarity`, opcjonalnie `source_type` oraz `(organization_id = $n OR (organization_id IS NULL AND source_type IN ('tool_pack','methodology','product_pill')))` — ZERO `scope`; `searchSqlite` (linia 210) — wyłącznie `WHERE organization_id = ?`, ZERO `scope`; `storeChunk`/`storeChunkPg` (linie 130/165) — typ `EmbeddingChunk` (linie 21-28) NIE MA pola scope/ownerId, więc wiersz embeddingu fizycznie nie niesie poziomu dostępu; DDL SQLite (linie 341-352) i migracje PG (`server/migrations/20260719_baseline_gap.sql:935-944` + `server/migrations/20261720_day131_teresa_knowledge_boundaries.sql:8-9`) dają kolumny: `id, document_id, chunk_index, chunk_text|content, embedding, metadata, source_type (tylko PG), created_at, organization_id` — **żadnej kolumny scope ani owner**. **Rozgałęzienie:** `server/src/services/ragService.ts` `searchRelevantChunks` (linia 616): gałąź z `documentIds` (linia 644) → `hybridSearch` → `appendKnowledgeDocAccessFilter` (linia 228) z guardem VLT-002 (linie 292-303: `AND (d.scope IS NULL OR d.scope != 'user')`) = BEZPIECZNA; gałąź domyślna (linia 669) → `deps.embeddingService.search(query, {limit, organizationId, minSimilarity})` = **DZIURA**. **Producent wierszy:** `server/src/services/KnowledgeService.ts` `processDocument` (linia 672) pisze KAŻDY chunk Vault do OBU tabel — `knowledge_chunks` (linia 699, scope żyje na rodzicu `knowledge_docs`) i `ai_knowledge_embeddings` (linia 714, `storeChunk({..., organizationId, sourceType:'knowledge'})`, BEZ scope/ownerId); komentarz VLT-003 (linie 662-671) przyznaje wprost, że naprawiono WYŁĄCZNIE `organizationId`. `addDocument` (linia 621) ustawia `scope` na `knowledge_docs` (linie 636-640) — źródło prawdy o poziomie dostępu; klucz złączenia: `ai_knowledge_embeddings.document_id = knowledge_docs.id` (`knowledge_docs.id TEXT PRIMARY KEY`, linia 147; indeks `idx_ai_embeddings_doc` na `document_id`). **Drugi, surowy czytelnik tabeli:** `server/src/services/InterviewInsightService.ts` `fetchEvidenceForQuestionIds` (definicja linia 2954, SELECT linie 2996-3002) — `SELECT ... FROM ai_knowledge_embeddings WHERE document_id IN (...)` BEZ `organization_id` i BEZ `scope`. **Konsument bez tożsamości:** `server/src/services/ai/tools/searchKnowledgeBase.ts` — typ `SearchContext` (linie 21-23) ma WYŁĄCZNIE `organizationId`, ZERO `userId`; `documentIds` ustawiane TYLKO gdy `toolSlug`/`packType`/`language` (linie 90-125), więc zwykłe pytanie do wiedzy trafia w gałąź dziurawą. **Odczyt (kontekst — NIE zmieniasz bez jawnej decyzji w sekcji 3):** `server/src/services/ai/knowledgeIndexer.ts` (`keywordSearch` linie 1078-1084 i `getAllChunksWithEmbeddings` linie 1130-1136 — OBIE mają VLT-002, wzorzec poprawny); `server/src/services/organizationContext/ContextRetrievalService.ts` (`fetchAccessibleDocuments` linia 139, SQL linie 152-170 — **wzorzec docelowy: owner-aware `scope='user' AND owner_id = ?`, nie ryczałtowe wykluczenie**); `server/src/services/ai/toolDefinitions.ts` (`executeKBSearch` linia 876 — DRUGI, niezależny handler tej samej nazwy narzędzia, owner-aware, patrz DLACZEGO); `server/src/services/ai/documentGovernance.ts` (`filterDocumentsByVisibility` linia 18 — TRZECI, osobny system poufności `ai_visibility`/`sensitivity`, nie myl ze `scope`).`.

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
WT=/private/tmp/cx-day210-scope-p0
MARKER=15c7a68b9d

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day210-scope-p0-20260831 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day210-scope-p0/config.worktree"
cat "$VAULT/worktrees/cx-day210-scope-p0/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day210-scope-p0-scratch
mkdir -p /private/tmp/cx-day210-scope-p0-artefakty

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
git -C "$VAULT" log --oneline 15c7a68b9d..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only 15c7a68b9d..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day210-scope-p0-20260831
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 15c7a68b9d..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `dziewięć` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day210-scope-p0

# (T1) ★ RDZEŃ DEFEKTU — czy ścieżka embeddingów zna scope? Oczekiwane: NIE.
grep -n "scope" server/src/services/ai/embeddingService.ts
grep -n "organization_id" server/src/services/ai/embeddingService.ts
#   oczekiwane: PIERWSZY grep NIE pokazuje ANI JEDNEGO wystąpienia w SQL
#   (dopuszczalne trafienia wyłącznie w komentarzach); drugi pokazuje filtr org
#   w searchPg (~linia 280) i searchSqlite (~linia 218). Jeśli zobaczysz `scope`
#   w SQL — dziura została naprawiona przed Tobą: STOP, zgłoś w raporcie.

# (T2) ★ Kolumny tabeli — czy wiersz embeddingu NIESIE poziom dostępu? Oczekiwane: NIE.
sed -n '/CREATE TABLE IF NOT EXISTS ai_knowledge_embeddings/,/^ *`/p' server/src/services/ai/embeddingService.ts
grep -n "ai_knowledge_embeddings" -A 12 server/migrations/20260719_baseline_gap.sql | grep -A 12 'create table'
cat server/migrations/20261720_day131_teresa_knowledge_boundaries.sql
#   oczekiwane: kolumny id/document_id/chunk_index/chunk_text|content/embedding/
#   metadata/source_type(PG)/created_at/organization_id — ZERO scope, ZERO owner.
#   Zwróć uwagę: DDL SQLite NIE MA nawet kolumny source_type — to ma znaczenie
#   dla projektu filtra (patrz sekcja 3 body, „pułapka silnikowa").

# (T3) ★ Rozgałęzienie bezpieczna/dziurawa w ragService
grep -n "documentIds\|embeddingService.search(\|hybridSearch(" server/src/services/ragService.ts | sed -n '1,40p'
grep -n "scope != 'user'" server/src/services/ragService.ts
#   oczekiwane: searchRelevantChunks (~616) ma gałąź `if (documentIds?.length)`
#   → hybridSearch (bezpieczna, VLT-002 ~296-303 + 496-500 + 583-586) oraz gałąź
#   domyślną → embeddingService.search (~669, DZIURAWA).

# (T4) ★ Producent wierszy — dowód, że scope NIGDY nie idzie do embeddingu
sed -n '655,725p' server/src/services/KnowledgeService.ts
grep -n "scope" server/src/services/KnowledgeService.ts | sed -n '1,20p'
#   oczekiwane: komentarz VLT-003 (~662-671) przyznający, że naprawiono TYLKO
#   organizationId; wywołanie storeChunk (~714) z {content, chunkIndex,
#   documentId, organizationId, metadata, sourceType:'knowledge'} — bez scope.
#   addDocument (~621-658) ustawia scope na knowledge_docs = ŹRÓDŁO PRAWDY.

# (T5) ★★★ DWA HANDLERY TEJ SAMEJ NAZWY NARZĘDZIA — zmierz, który jest żywy
grep -n "userId\|organizationId" server/src/services/ai/tools/searchKnowledgeBase.ts | sed -n '1,10p'
grep -rn "registerHandler('search_knowledge_base'" server/src --include='*.ts'
grep -rn "mcpServer.execute(" server/src --include='*.ts' | grep -v __tests__
grep -rn "executeToolCall(" server/src --include='*.ts' | grep -v __tests__ | grep -v 'toolDefinitions.ts'
#   oczekiwane: (H1) tools/searchKnowledgeBase.ts — SearchContext BEZ userId,
#   rejestrowany w tools/index.ts:22, wykonywany generycznie przez mcpServer.execute
#   z llmService (~945, ~1049, ~1208) i AIPipeline (~347-349) = TOR CZATU;
#   (H2) toolDefinitions.executeKBSearch (~876) — owner-aware (AGT-008-bis,
#   ~947-1040), wołany przez executeToolCall z agentPlannerService/
#   wave8AgentRuntimeService/playbookExecutor = TOR AGENTA.
#   ★ To jest pomiar rozstrzygający dla kształtu testu R1. NIE przepisuj mojego
#   wyniku — potwierdź albo obal.

# (T6) ★ Wzorzec docelowy filtra (owner-aware, nie ryczałtowe wykluczenie)
sed -n '139,175p' server/src/services/organizationContext/ContextRetrievalService.ts
sed -n '1070,1140p' server/src/services/ai/knowledgeIndexer.ts
#   oczekiwane: ContextRetrievalService — `(scope='user' AND owner_id = ?)`,
#   czyli WŁASNE prywatne dokumenty wołającego SĄ dostępne; knowledgeIndexer —
#   ryczałtowe `(d.scope IS NULL OR d.scope != 'user')` tam, gdzie userId nie ma.
#   Twoja naprawa musi wybrać jeden z tych dwóch kształtów ŚWIADOMIE (sekcja 3).

# (T7) ★ Trzeci czytelnik tabeli + inwentarz WSZYSTKICH czytelników
grep -rn "ai_knowledge_embeddings" server/src --include='*.ts' | grep -v __tests__ | grep -v '_backup'
sed -n '2950,3010p' server/src/services/InterviewInsightService.ts
#   oczekiwane: poza embeddingService.ts — InterviewInsightService (~2996-3002,
#   surowy SELECT bez org i bez scope) oraz ai-health-check.routes.ts (liczniki,
#   nieistotne). ★ UWAGA: `git ls-tree` pokazuje BEZROZSZERZENIOWY duplikat
#   `server/src/services/ai/embeddingService` (bez `.ts`) obok pliku właściwego —
#   martwy plik, NIE edytuj go i NIE licz jako ścieżki; zgłoś w raporcie.

# (T8) ★ Konwencja testu realPG + strażnik (Z31)
ls server/src/routes/__tests__/*.pg.test.ts | head -5
grep -rn "assertRealPostgresTestEnvironment" server/src --include='*.ts' | head -3
grep -n "DB_TYPE" server/vitest.config.ts vitest.config.ts
#   oczekiwane: wzorzec `describe.skipIf(!enabled)` + RUN_DB_TESTS=1, MOCK_DB=false,
#   DATABASE_URL postgres; `DB_TYPE: process.env.DB_TYPE || 'sqlite'` w OBU configach
#   — czyli MUSISZ podać DB_TYPE=postgres jawnie, inaczej wykonasz searchSqlite
#   i przetestujesz nie tę gałąź, o którą chodzi.
#   ★★ PUŁAPKA: `describe.skipIf` przy niekompletnym env daje 0 failów i wygląda
#   jak PASS. Sprawdzaj `numTotalTests > 0` (Z24/§0.4a), nie exit code.

# (T9) ★ PORTY, DOCKER, MIEJSCE NA DYSKU
df -h /
lsof -nP -iTCP:6150 -iTCP:5092 -iTCP:5093 -sTCP:LISTEN
lsof -nP -iTCP:6144-6155 -iTCP:5078-5095 -sTCP:LISTEN
docker ps -a --format '{{.Names}}\t{{.Ports}}'
#   oczekiwane: lsof PUSTY dla Twoich portów; docker pokazuje fz120-f8-pg (5433)
#   i fz120-f3-pg-20260829 (6012) — NIE DOTYKAJ ich; kontenery cx-day204..209-pg
#   mogą wstać po wydaniu instrukcji — jeśli je zobaczysz, NIE DOTYKAJ.
#   ★★ df: w chwili składania było 6.5Gi wolnego. Masz <4Gi → STOP i zgłoś.
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day210-scope-p0-20260831` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6150`. Twój JEDYNY port harnessu to `5092 i 5093`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day210-pg`**. **ZAKAZANE:** `6012 (kontener `fz120-f3-pg-20260829` — ŻYWY, zmierzony `docker ps` w chwili składania), 5433 (kontener `fz120-f8-pg` — ŻYWY, ten sam pomiar), 6047, 6054-6127, 5010-5077, 6404-6411 (odbiory nadzorcy i dyżury wcześniejsze niż 204). Przydziały dyżurów równoległych, przepisane z ICH cfg (nie zgadywane): 6144/5078-5079 (204), 6145/5080-5081 (205), 6146/5084-5085 (206), 6147/5086-5087 (207 — podany jako fakt zewnętrzny, nie znaleziony w cfg dostępnym z tego miejsca), 6148/5088-5089 (208), **6149/5090-5091 (209 — Twój bezpośredni poprzednik, ten sam obszar kodu; jeśli jego kontener `cx-day209-pg` żyje, NIE DOTYKAJ)**. **Zmierzone WŁASNYM `lsof` 2026-08-31 przed wydaniem:** `lsof -nP -iTCP:6144-6155 -iTCP:5078-5095 -sTCP:LISTEN` → **PUSTO** (żaden z portów 204-209 ani Twoich nie nasłuchiwał); `lsof -nP -iTCP:5060-5061 -sTCP:LISTEN` → **PUSTO**; `docker ps -a` → wyłącznie `fz120-f8-pg` (5433) i `fz120-f3-pg-20260829` (6012), **ZERO kontenerów `cx-day2xx-*`**. To migawka, nie gwarancja — dyżury równoległe mogą wstać po wydaniu tej instrukcji; **zmierz ponownie sam w BLOKU 0** i zapisz w LISTA z godziną pomiaru albo zgłoś kolizję. Twój wyłączny przydział: baza `6150`, harness `5092 i 5093`. ★ PORT 5000 na stałe macOS Control Center. ★ PORT 5037 na stałe adb. ★ PORTY 5060-5061 potwierdzone WOLNE tym samym pomiarem (dyżur 196, historyczny) — potwierdź jeszcze raz sam. ★★ **MIEJSCE NA DYSKU — ZMIERZONE, OSTRZEŻENIE:** `df -h /` w chwili składania pokazał **6.5Gi wolnego** (`/dev/disk3s1s1`, 12Gi używane w warstwie zapisywalnej). To MAŁO na obraz `pgvector` + wolumen + artefakty. Zmierz SAM w BLOKU 0; jeśli masz <4Gi wolnego, **STOP i zgłoś w raporcie zamiast startować** — dyżur, który padnie w połowie na braku miejsca, zostawia śmieci i kontener bez `docker rm -f -v`.`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `★★★ **ZERO NOWYCH FLAG. ZERO ZMIANY WARTOŚCI DOMYŚLNEJ JAKIEJKOLWIEK ISTNIEJĄCEJ FLAGI.** To jest naprawa bezpieczeństwa P0, nie funkcja — filtr `scope` MUSI działać bezwarunkowo, od pierwszego uruchomienia, bez przełącznika. Reguła „wygląd tylko za flagą OFF do akceptu" (CLAUDE.md §7) dotyczy WYGLĄDU; tu nie ma wyglądu. Flaga na naprawie bezpieczeństwa = pozostawienie dziury z wyłącznikiem, którego nikt nie przestawi. Jeśli uznasz, że kill-switch jest konieczny (np. bo boisz się regresji wydajności), **NIE dodawaj go samodzielnie** — opisz to jako rekomendację w raporcie i zostaw decyzję nadzorcy. Flagi, które MUSISZ znać jako kontekst (nie zmieniasz żadnej): `ENABLE_ORG_KNOWLEDGE_RETRIEVAL` (surowy odczyt `process.env`, `server/src/routes/ai.routes.ts:4076-4077`, domyślnie OFF — brama ścieżki org-retrieval, patrz tabela ścieżek w sekcji 2 body).`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/services/ai/chatPolicyGateway.ts` (`evaluateRetrievalPolicyDecision` — wołana fail-closed z `searchKnowledgeBase.ts:62-79` i `toolDefinitions.executeKBSearch:878-902`; NIE obniżasz jej gwarancji, NIE zmieniasz jej kontraktu), `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*`. DODATKOWO — bramki, które MUSZĄ przetrwać nietknięte i którym Twój test regresji R3 ma to udowodnić: `documentGovernance.filterDocumentsByVisibility` (`server/src/services/ai/documentGovernance.ts:18`) wraz z jej DWOMA wołaczami (`aiContextBuilder.ts:974`, `ContextRetrievalService.ts:333`) — osobny system poufności (`ai_visibility`/`sensitivity`), poza zakresem; guard VLT-002 w `ragService.appendKnowledgeDocAccessFilter` (linie 292-303) oraz w `getContext`/`getContextKeyword` (linie 496-500, 583-586); guardy VLT-002 w `knowledgeIndexer.keywordSearch` (1078-1084) i `getAllChunksWithEmbeddings` (1130-1136); ACL owner-aware w `ContextRetrievalService.fetchAccessibleDocuments` (152-170); AGT-008-bis allow-lista w `toolDefinitions.executeKBSearch` (947-1040). **Możesz je czytać i możesz się na nich WZOROWAĆ; nie wolno Ci ich osłabić ani „przy okazji ujednolicić".**`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY210_SCOPE_P0_REPORT.md`. Nie zmieniasz żadnego `MODULE_ACCEPTANCE.md` — dyżur przekrojowy (silnik wiedzy / warstwa retrievalu), nie jeden moduł z tabeli WAVE_03_ACCEPTANCE.. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day210-scope-p0-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day210-scope-p0-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **NIE OGŁASZASZ NAPRAWY BEZ CZERWONEGO TESTU I BEZ DOWODU MUTACYJNEGO.** Kolejność jest nienaruszalna: najpierw test, który DZIŚ PADA na nienaprawionym kodzie (bo znajduje cudzy prywatny dokument), potem naprawa, potem zdjęcie filtra i pokazanie, że test znowu pada. Test napisany PO naprawie, który od razu jest zielony, **nie dowodzi niczego** — nie wiesz, czy mierzy dziurę, czy własną literówkę w zapytaniu. To jest twarde kryterium odbioru tego dyżuru, nie sugestia. ★★★ **NIE naprawiasz przez zwężenie do zera.** Filtr, który wycina prywatne dokumenty razem z połową uprawnionej wiedzy, jest gorszy niż dziura, bo jest niewidoczny — Piotr zobaczy „Teresa przestała cokolwiek znajdować", nie „Teresa jest bezpieczna". W `ai_knowledge_embeddings` żyją wiersze z CO NAJMNIEJ pięciu producentów o różnym `source_type`: `'knowledge'` (Vault, `KnowledgeService.processDocument:714`), `'knowledge_base'` lub podany przez wołającego (`ingestionPipeline.ts:81/229` — m.in. odpowiedzi z wywiadów, `InterviewController.ts:1550`), `'llm_cache'` (`llmService.ts:807-811`), `'project'` domyślnie (`ragService.indexDocument:763` — wywołanie BEZ organizationId i BEZ sourceType) i globalne paczki (`tool_pack`/`methodology`/`product_pill`). **Literalne zastosowanie reguły „brak scope w wierszu = traktuj jak prywatny" na poziomie WIERSZA skasowałoby wszystkie te wiersze z wyników** — bo ŻADEN wiersz w tej tabeli nie ma scope. Reguła fail-closed obowiązuje na poziomie ROZSTRZYGNIĘCIA POCHODZENIA (wiersz, którego pochodzenie wskazuje na Vault, ale którego rodzica nie da się rozstrzygnąć → wykluczasz), a nie na poziomie „każdy wiersz bez kolumny scope". Zmierz liczbę wierszy odrzuconych przez Twoją regułę PRZED i PO — to jest treść R3. ★★ **NIE zmieniasz guardów VLT-002 ani ACL-i wymienionych w LISTA_BRAMEK** — one działają poprawnie na swoich ścieżkach. Wolno Ci je czytać i naśladować; nie wolno „ujednolicić", „zrefaktorować do wspólnej funkcji" ani „przy okazji poprawić". Jedyna dopuszczalna zmiana w cudzym kontrakcie to zmiana ADDYTYWNA (nowy opcjonalny parametr z domyślną wartością zachowującą dzisiejsze zachowanie dla wszystkich istniejących wołaczy), a każdy istniejący wołacz musi mieć w raporcie wiersz z odpowiedzią „dotknięty / nietknięty i czym to udowodniłeś". ★★ **NIE dodajesz flagi na naprawie bezpieczeństwa** (patrz POZYCJE_Z_FLAGAMI). ★★ **NIE naprawiasz w tym dyżurze ścieżki `InterviewInsightService`, ścieżki E2 „attachment fallback" ani systemu `documentGovernance`** — mierzysz je, opisujesz w tabeli ścieżek i, jeśli któraś okaże się niezależną dziurą, ZGŁASZASZ jako osobny dyżur. Jeden dyżur = jedna naprawa u źródła; naprawa trzech rzeczy naraz oznacza, że żadnej nie da się odbić mutacją. ★★ **NIE wykonujesz zapytania inwentaryzacyjnego na bazie zdalnej, demo, stagingu ani produkcji (Z28).** Piszesz je jako gotowy, tylko-odczytowy `SELECT` do checklisty nadzorcy i zostawiasz w raporcie — nadzorca uruchomi je sam. Zero połączeń wychodzących. ★★ **NIE zostawiasz kontenera.** `docker rm -f -v cx-day210-pg` na końcu, także gdy dyżur padnie w połowie. | ★★★ **TO JEST P0. Poniższe liczby i linie pochodzą z MOJEGO pomiaru na `15c7a68b9d` — czytaj je jako HIPOTEZĘ DO OBALENIA, nie jako fakt. Każdą sprawdzasz sam w BLOKU 0 i w raporcie piszesz, co potwierdziłeś, a co obaliłeś.** ★ **Kształt defektu.** Vault (VLT-001) ma trójpoziomowy `scope` (`user`/`project`/`organization`) na `knowledge_docs` (`KnowledgeService.ts:636-640`, kolumna dokładana runtime'owym `ALTER` w `ensureKnowledgeSchema`, linie 172-183). `processDocument` (`KnowledgeService.ts:672-735`) przetwarza KAŻDY dokument Vault — w tym `scope='user'` — i zapisuje jego chunki do DWÓCH tabel: `knowledge_chunks` (linia 699; `scope` żyje na rodzicu, więc każdy czytelnik może dołączyć `knowledge_docs`) oraz `ai_knowledge_embeddings` przez `embeddingService.storeChunk` (linia 714), przekazując `{content, chunkIndex, documentId, organizationId, metadata, sourceType:'knowledge'}` — **bez scope, bez ownerId**. Typ `EmbeddingChunk` (`embeddingService.ts:21-28`) tych pól w ogóle nie ma, a tabela nie ma odpowiednich kolumn (DDL SQLite `embeddingService.ts:341-352`; PG `20260719_baseline_gap.sql:935-944` + kolumna `organization_id` dołożona przez `20261720_day131_teresa_knowledge_boundaries.sql:8-9`). Odczyt: `embeddingService.searchPg` (linie 252-286) filtruje wyłącznie `minSimilarity`, opcjonalny `source_type` i `organization_id` (z wyjątkiem globalnych paczek); `searchSqlite` (210-243) wyłącznie `organization_id`. **W całej ścieżce zapisu i odczytu embeddingów słowo `scope` nie pada ani razu.** ★ **Dlaczego to jest dziura, a nie świadoma decyzja.** Guard VLT-002 (`ragService.appendKnowledgeDocAccessFilter:292-303`) mówi wprost, jaki jest KONTRAKT produktu: *"a private document must never surface in a context-less/other-user AI answer, so it is excluded outright"*. Ten sam guard został konsekwentnie nałożony na WSZYSTKICH czytelników `knowledge_chunks`: `bm25Search`/`_vectorSearch` (przez `appendKnowledgeDocAccessFilter`), `getContext` (496-500), `getContextKeyword` (583-586), `knowledgeIndexer.keywordSearch` (1078-1084), `knowledgeIndexer.getAllChunksWithEmbeddings` (1130-1136). Nie nałożono go na ANI JEDNEGO czytelnika `ai_knowledge_embeddings` — bo ta tabela jako jedyna nie ma czym dołączyć się do `knowledge_docs` w istniejącym kodzie. VLT-003 (`KnowledgeService.ts:662-671`) przyznaje na piśmie, że naprawiono WYŁĄCZNIE wyciek cross-organizacyjny (`organizationId`). Komentarz w `ragService.ts:296-301` idzie dalej i nazywa brakującą robotę: *retrieval świadomy właściciela wymaga przewleczenia `userId` przez cały łańcuch wywołań narzędzia (`searchKnowledgeBase` → `ragService`) — "not done here"*. **Ten dyżur robi dokładnie tę niedokończoną robotę.** ★★★ **KOREKTA DO ZNALEZISKA AUTORA 209 — NAJWAŻNIEJSZA RZECZ W TEJ INSTRUKCJI.** Autor 209 napisał, że dziurę widać przez `search_knowledge_base`. Zmierzyłem to i jest to prawda **tylko na jednym z dwóch torów**: w repo istnieją **DWA żywe, niezależne handlery narzędzia o tej samej nazwie `search_knowledge_base`, o PRZECIWNEJ postawie bezpieczeństwa**. (H1) `server/src/services/ai/tools/searchKnowledgeBase.ts` — rejestrowany do `mcpServer` (`tools/index.ts:22`), jego `SearchContext` (linie 21-23) ma **wyłącznie `organizationId`, ZERO `userId`**, a `documentIds` ustawia tylko przy `toolSlug`/`packType`/`language` (90-125) → **domyślne wywołanie trafia w gałąź dziurawą**. Wykonywany generycznie przez `mcpServer.execute(def.name, args, context)` z `llmService.callWithTools:945`, `llmService:1049`, `llmService:1208` oraz `AIPipeline.ts:347-349` — czyli **z toru czatu**. (H2) `toolDefinitions.executeKBSearch` (linia 876), osiągany przez `executeToolCall` (`case 'search_knowledge_base'`, linia 586), wołany z `agentPlannerService.ts:1181`, `wave8AgentRuntimeService.ts:1161`, `playbookExecutor.ts:185/199/225` — **owner-aware i szczelny**: `ToolExecutionContext` ma `userId` (linia 561), a AGT-008-bis (947-1040) w KAŻDEJ gałęzi liczy `documentIds` z `KnowledgeService.getDocuments(organizationId, userId, …)` i przy pustej liście zwraca pusty wynik (fail-closed), więc zawsze trafia w gałąź `hybridSearch` ze scope-aware SQL. **Konsekwencja dla Ciebie: pierwszą rzeczą, jaką robisz (R1 krok 0), jest zmierzenie, KTÓRY handler realnie obsługuje pytanie o wiedzę w żywym czacie** — bo od tego zależy, czy czerwony test R1 ma iść przez narzędzie, czy wprost przez `ragService.searchRelevantChunks`. Nie przepisuj mojej odpowiedzi; zmierz. To jest dokładnie ósmy kształt fałszywego „gotowe" (wołacz istnieje ≠ ten wołacz się wykonuje) — i autor 209 się na nim potknął, mimo że jego opis samej dziury w warstwie SQL jest poprawny. ★ **Trzeci czytelnik tej tabeli, o którym 209 nie wiedział.** `InterviewInsightService.fetchEvidenceForQuestionIds` (definicja 2954, SELECT 2996-3002) czyta `ai_knowledge_embeddings` surowym `SELECT ... WHERE document_id IN (...)` — **bez `organization_id` i bez `scope`**. Lista `document_id` pochodzi z `interview_evidence WHERE organization_id = ?` (ograniczenie organizacyjne jest, właścicielskiego nie ma). Czy to jest wyciek zależy od tego, czy prywatny dokument Vault może w ogóle trafić do `interview_evidence.knowledge_document_id` — **ZMIERZ, nie zakładaj w żadną stronę**. ★ **Ścieżka, którą sprawdziłem i która NIE jest niezależną dziurą (nie marnuj na nią budżetu, ale potwierdź jednym pomiarem):** „attachment fallback" E2 (`ai.routes.ts:4373-4384`) czyta `knowledge_chunks JOIN knowledge_docs` filtrując tylko `organization_id` i `status`, BEZ `scope` — ale operuje na `governedAttachmentDocIds`, które przychodzą z `ContextRetrievalService` (linia 4213), a tamtejszy `fetchAccessibleDocuments` (152-170) jest owner-aware (`(scope='user' AND owner_id = ?)`). Czyli lista jest już przefiltrowana ACL-em zanim trafi do tego `SELECT`-a. Potwierdź to jednym pomiarem i zapisz wynik — jeśli istnieje gałąź, w której `governedAttachmentDocIds` powstaje z pominięciem `ContextRetrievalService`, to jest DRUGIE P0 i musi trafić do raportu (ale NIE naprawiasz go w tym dyżurze — zgłaszasz). ★ **Kolejność scaleń: TEN DYŻUR WYPRZEDZA 209.** Dyżur 209 (indeksacja artefaktów Studio/decków do KB, gałąź `codex/day209-indeksacja-20260831`) buduje nowy strumień treści wpływającej do dokładnie tego mechanizmu i jego instrukcja projektuje OBEJŚCIE tej dziury (rezygnacja z `embeddingService.storeChunk` dla treści prywatnej, czyli świadomy kompromis „bezpieczne, ale niewyszukiwalne"). Po naprawie z tego dyżuru **to obejście przestaje być potrzebne**. Dlatego: 210 scala się PRZED 209, a 209 przy scalaniu dostaje re-bazę na naprawiony fundament i zdejmuje swój kompromis. Wpisz to jawnie w sekcji „Ryzyko kolizji" swojego raportu wraz z listą plików, które oba dyżury dotykają (co najmniej `KnowledgeService.ts` — 209 planuje tam addytywny parametr `skipGlobalEmbeddingIndex`, którego po Twojej naprawie może już nie potrzebować). |

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
cd /private/tmp/cx-day210-scope-p0

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day210-pg psql -U postgres -d cx210 \
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
cd /private/tmp/cx-day210-scope-p0

docker run -d --name cx-day210-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx210 \
  -p 127.0.0.1:6150:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day210-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6150/cx210 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6150/cx210 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day210-scope-p0 && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6150/cx210 \
JWT_SECRET=cx210-test-secret-do-not-reuse \
npx vitest run server/src/services/ai/__tests__ server/src/services/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day210-scope-p0-artefakty/day210-vitest.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day210-scope-p0 && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/services/ai/__tests__ server/src/services/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day210-scope-p0-artefakty/day210-vitest.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day210-scope-p0/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day210-pg psql -U postgres -d cx210 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day210-pg`.
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
> **(e) ★★★ **Pierwsza — dwa handlery jednej nazwy (to jest pułapka, na której potknął się autor 209).** `search_knowledge_base` ma DWIE niezależne implementacje o przeciwnej postawie bezpieczeństwa (T5): `tools/searchKnowledgeBase.ts` bez `userId` (tor czatu, przez `mcpServer.execute` z `llmService`) i `toolDefinitions.executeKBSearch` z pełnym owner-aware ACL-em (tor agenta, przez `executeToolCall`). Jeśli napiszesz czerwony test przeciwko niewłaściwemu handlerowi, dostaniesz ZIELONY wynik i uznasz, że dziury nie ma — albo, po naprawie tylko jednego, ogłosisz szczelność przy wciąż otwartym drugim torze. **Zmierz oba, wypisz oba w raporcie, napraw ten (te), który (które) faktycznie prowadzą do `embeddingService.search`.** ★★★ **Druga — fail-closed źle zaadresowany kasuje całą wiedzę.** Patrz ZAKAZ powyżej: w `ai_knowledge_embeddings` ŻADEN wiersz nie ma scope, więc reguła „brak scope = prywatny" zastosowana per-wiersz zwraca pustkę dla wszystkich pytań. To jest najbardziej prawdopodobny sposób, w jaki ten dyżur może wyrządzić większą szkodę niż naprawić. Bezpieczny kształt do rozważenia (ale **zmierz go, nie kopiuj na wiarę**): anty-złączenie odwzorowujące semantykę VLT-002 — wyklucz wiersz, dla którego ISTNIEJE rodzic w `knowledge_docs` o `scope='user'` (i, jeśli masz `userId`, o `owner_id` różnym od wołającego). Wiersze bez rodzica w `knowledge_docs` (cache LLM, odpowiedzi z wywiadów, paczki globalne) nie są dokumentami Vault i tą regułą nie są ruszane. Rozstrzygnij i UZASADNIJ, czy do tego dokładasz warunek po `source_type='knowledge'` — i **zauważ, że DDL SQLite w ogóle nie ma kolumny `source_type`** (T2), więc reguła oparta na `source_type` jest niewykonalna na jednym z dwóch silników; reguła oparta na anty-złączeniu działa na obu. ★★ **Trzecia — istniejący guard VLT-002 sam jest fail-OPEN przy braku kolumny.** `appendKnowledgeDocAccessFilter` dokłada warunek scope tylko `if (hasScope)` (`ragService.ts:240, 302`); `knowledgeIndexer` analogicznie `if (await this.hasScopeColumn())`. Na bazie, gdzie runtime'owy `ALTER TABLE knowledge_docs ADD COLUMN scope` nie przeszedł (`KnowledgeService.ts:172-183`, `fallback: true` łyka błędy po cichu), filtr **nie dokłada się wcale**. Twój nowy filtr musi mieć ŚWIADOMIE wybraną i uzasadnioną w raporcie postawę na ten przypadek — i musisz mieć test, który tę gałąź wykonuje (baza bez kolumny `scope`), a nie tylko o niej pisze. ★★ **Czwarta — silnik decyduje, którą gałąź testujesz.** `embeddingService.search` rozgałęzia się na `searchPg`/`searchSqlite` po `process.env.DB_TYPE === 'postgres'` (linie 197-205), a OBA configi vitest mają `DB_TYPE: process.env.DB_TYPE || 'sqlite'` (T8). Test uruchomiony bez jawnego `DB_TYPE=postgres` wykona `searchSqlite` — **inną implementację, innego SQL-a, inne kolumny** — i „przejdzie", nie dotknąwszy gałęzi, która działa na demo. Napraw OBIE gałęzie i przetestuj OBIE, albo uzasadnij w raporcie, dlaczego jedna wystarcza (i pokaż, że nie jest osiągalna w żadnym środowisku). ★★ **Piąta — `describe.skipIf` udaje sukces.** Wzorzec testów realPG w tym repo (T8) pomija cały blok, gdy `RUN_DB_TESTS`/`MOCK_DB`/`DATABASE_URL` nie są ustawione — zero failów, `exit 0`, wygląda jak zielone. Do tego dochodzi `Z31`: strażnika `assertRealPostgresTestEnvironment()` wołasz **bez argumentów**, nigdy z `expectedDatabase` przypiętym do `cx210` — inaczej po usunięciu Twojego kontenera Twoje dowody zamienią się w trwały `SKIP`, który następny czytelnik weźmie za sukces. Raportujesz `numTotalTests`, nie exit code. ★★ **Szósta — wydajność nie jest wymówką, ale nie jest też nieistotna.** Anty-złączenie do `knowledge_docs` wchodzi na zapytanie, które dziś korzysta z indeksu HNSW (`idx_ai_embeddings_vector`, `20260719_baseline_gap.sql:14729`) i sortuje po odległości wektora. Filtr nałożony PO `ORDER BY ... LIMIT` może wyciąć wyniki już przyciętego zbioru (zwrócisz mniej niż `limit`), a nałożony PRZED — zmusić planer do porzucenia indeksu wektorowego. **Zmierz `EXPLAIN ANALYZE` obu wariantów na realnych danych i wybierz świadomie**; jeśli wyjdzie źle, alternatywą jest denormalizacja (`scope`/`owner_id` jako kolumny na `ai_knowledge_embeddings` + migracja wypełniająca) — ale wtedy migracja MUSI być addytywna, idempotentna i odporna na bazę zakładaną od zera (pamiętaj: migracja czytająca kolumnę dokładaną alfabetycznie później wywraca cały łańcuch). Decyzję zapisz z liczbami, nie z przeczuciem. ★★ **Siódma — dyżur 209 jest równoległy i dotyka tych samych plików.** Gałąź `codex/day209-indeksacja-20260831` planuje addytywny parametr `skipGlobalEmbeddingIndex` w `KnowledgeService.processDocument` — czyli w funkcji, którą Ty czytasz i której wołaczy dotyczy Twój test. **210 idzie PRZED 209 w kolejności scaleń** (patrz DLACZEGO). Jeśli w swoim worktree zobaczysz zmiany, których nie wprowadziłeś, STOP i zgłoś zamiast zgadywać.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day210-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day210-scope-p0-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`Trzy pozycje, sekwencyjnie zależne (R1 → R2 → R3, NIE równolegle): R1 = CZERWONY test kontraktu bezpieczeństwa na realnym Postgresie (dowód dziury: A indeksuje prywatny dokument → B z tej samej org go znajduje); R2 = naprawa u ŹRÓDŁA zapytań w każdej ścieżce zmierzonej w R1-krok-0, R1 przechodzi na zielono, plus dowód mutacyjny (zdjęcie filtra → test znowu czerwony); R3 = pakiet testów POZYTYWNYCH (uprawnione przypadki niezwężone) + inwentarz danych zastanych jako ZAPYTANIE do checklisty nadzorcy (NIE wykonujesz zdalnie). R1 i R2 dzielą ten sam plik testowy i ten sam plik produkcyjny — nie są rozłączne plikowo i nie wolno ich zlecić dwóm równoległym wykonawcom.`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6150` albo `5092 i 5093` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6150` albo `5092 i 5093`** (`Z7`).

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

**To jest P0 bezpieczeństwa. Nie jest to funkcja, nie jest to porządek w kodzie
i nie idzie za flagą.**

Kontrakt produktu jest zapisany w kodzie, w komentarzu do guardu VLT-002
(`server/src/services/ragService.ts:292-301`): *prywatny dokument nie może
nigdy pojawić się w odpowiedzi AI pozbawionej kontekstu właściciela albo
udzielanej innemu użytkownikowi — dlatego jest wykluczany wprost*. Ten
kontrakt jest dziś **egzekwowany na wszystkich czytelnikach jednej tabeli i
na żadnym czytelniku drugiej**.

## Co dokładnie zmierzyłem (na `15c7a68b9d`)

Vault (VLT-001) trzyma poziom dostępu na `knowledge_docs.scope` ∈
{`user`, `project`, `organization`} (`KnowledgeService.ts:636-640`; kolumna
dokładana runtime'owym `ALTER`, linie 172-183). `processDocument`
(`KnowledgeService.ts:672-735`) przetwarza **każdy** dokument Vault — w tym
`scope='user'` — i zapisuje jego chunki do **dwóch** tabel:

- `knowledge_chunks` (linia 699) — `doc_id` wskazuje na rodzica, więc każdy
  czytelnik może dołączyć `knowledge_docs` i sprawdzić `scope`;
- `ai_knowledge_embeddings` przez `embeddingService.storeChunk` (linia 714),
  przekazując `{content, chunkIndex, documentId, organizationId, metadata,
  sourceType:'knowledge'}` — **bez `scope`, bez `ownerId`**.

Typ `EmbeddingChunk` (`embeddingService.ts:21-28`) tych pól w ogóle nie ma.
Tabela też nie: DDL SQLite (`embeddingService.ts:341-352`) i migracje PG
(`20260719_baseline_gap.sql:935-944` + kolumna `organization_id` dołożona
przez `20261720_day131_teresa_knowledge_boundaries.sql:8-9`) dają
`id, document_id, chunk_index, chunk_text|content, embedding, metadata,
source_type` (tylko PG!), `created_at, organization_id`. **Zero `scope`,
zero `owner`.**

Odczyt jest lustrzany: `searchPg` (`embeddingService.ts:252-286`) filtruje
`minSimilarity`, opcjonalnie `source_type` i
`(organization_id = $n OR (organization_id IS NULL AND source_type IN
('tool_pack','methodology','product_pill')))`; `searchSqlite` (210-243) —
wyłącznie `WHERE organization_id = ?`. **W całej ścieżce zapisu i odczytu
embeddingów słowo `scope` nie pada ani razu.**

Rozgałęzienie, które decyduje o wszystkim, jest w
`ragService.searchRelevantChunks` (linia 616):

- **gałąź z `documentIds`** (linia 644) → `hybridSearch` → SQL przez
  `appendKnowledgeDocAccessFilter` z guardem VLT-002 (292-303:
  `AND (d.scope IS NULL OR d.scope != 'user')`) — **bezpieczna**;
- **gałąź domyślna** (linia 669) → `deps.embeddingService.search(query,
  {limit, organizationId, minSimilarity})` — **dziura**.

## Dlaczego to jest przeoczenie, a nie decyzja

VLT-002 nałożono konsekwentnie na **każdego** czytelnika `knowledge_chunks`:
`bm25Search`/`_vectorSearch` (przez `appendKnowledgeDocAccessFilter`),
`getContext` (496-500), `getContextKeyword` (583-586),
`knowledgeIndexer.keywordSearch` (1078-1084),
`knowledgeIndexer.getAllChunksWithEmbeddings` (1130-1136). I na **żadnego**
czytelnika `ai_knowledge_embeddings` — bo ta tabela jako jedyna nie ma w
istniejącym kodzie czym dołączyć się do `knowledge_docs`.

VLT-003 (`KnowledgeService.ts:662-671`) przyznaje na piśmie, że naprawiono
**wyłącznie** wyciek cross-organizacyjny. Komentarz w `ragService.ts:296-301`
nazywa brakującą robotę wprost: retrieval świadomy właściciela wymaga
przewleczenia `userId` przez cały łańcuch wywołań narzędzia
(`searchKnowledgeBase` → `ragService`) — *„not done here"*. **Ten dyżur robi
dokładnie tę niedokończoną robotę.**

## ★★★ Korekta do znaleziska autora 209 — przeczytaj, zanim napiszesz test

Autor 209 zgłosił, że dziurę widać przez `search_knowledge_base`. Sprawdziłem
i to jest prawda **tylko na jednym z dwóch torów**. W repo żyją **dwie
niezależne implementacje narzędzia o tej samej nazwie, o przeciwnej postawie
bezpieczeństwa**:

| | Handler | Tożsamość w kontekście | Co robi z `documentIds` | Kto go wykonuje |
|---|---|---|---|---|
| **H1** | `server/src/services/ai/tools/searchKnowledgeBase.ts` | `SearchContext` (21-23) ma **tylko `organizationId`**, zero `userId` | ustawia je **tylko** przy `toolSlug`/`packType`/`language` (90-125) → zwykłe pytanie idzie w gałąź domyślną | `mcpServer.execute(def.name, args, context)` z `llmService:945`, `llmService:1049`, `llmService:1208`, `AIPipeline.ts:347-349` — **tor czatu** |
| **H2** | `toolDefinitions.executeKBSearch` (876) | `ToolExecutionContext` ma `userId` (561) | AGT-008-bis (947-1040) liczy je w **każdej** gałęzi z `KnowledgeService.getDocuments(orgId, userId, …)`, pusta lista → pusty wynik (fail-closed) | `executeToolCall` (`case` w 586) z `agentPlannerService:1181`, `wave8AgentRuntimeService:1161`, `playbookExecutor:185/199/225` — **tor agenta** |

H2 **nie wycieka**. H1 — według mojego pomiaru — wycieka. To jest ósmy
kształt fałszywego „gotowe": wołacz istnieje, ale wykonuje się inny.
**Twój pierwszy ruch (R1 krok 0) to zmierzenie, który handler realnie
obsługuje pytanie o wiedzę w żywym czacie.** Nie przepisuj mojej tabeli —
potwierdź albo obal, i zapisz wynik w raporcie jako pomiar własny.

# 2. TEZY ZLECENIA

- **T1.** Defekt jest w **warstwie zapytań**, nie w warstwie wołaczy: wiersz
  `ai_knowledge_embeddings` fizycznie nie niesie poziomu dostępu, a jedyne
  źródło prawdy (`knowledge_docs.scope`) nie jest dołączane. Naprawa idzie
  do źródła zapytań, nie do pojedynczego wołacza.
- **T2.** `VLT-003` domknął wyłącznie cross-org. Wewnątrz jednej organizacji
  `scope='user'` nie jest egzekwowany na tej ścieżce w ogóle.
- **T3.** Kolejność jest nienaruszalna: **czerwony test → naprawa → mutacja
  → regresja**. Test napisany po naprawie nie dowodzi niczego.
- **T4.** Fail-closed obowiązuje na poziomie **rozstrzygnięcia pochodzenia
  wiersza**, nie na poziomie „każdy wiersz bez kolumny `scope`" — inaczej
  kasujesz całą wiedzę (patrz sekcja 3, krok R2-0).
- **T5.** Ten dyżur **wyprzedza 209** w kolejności scaleń. 209 buduje nowy
  strumień treści wpływającej do tego samego mechanizmu i projektuje
  obejście tej dziury; po Twojej naprawie obejście staje się zbędne.

# 3. POZYCJE DYŻURU

## R1 — Czerwony test kontraktu bezpieczeństwa (realny Postgres)

**Krok 0 — pomiar rozstrzygający: którędy realnie leci pytanie o wiedzę.**
Zanim napiszesz jedną linię testu, wykonaj T5 z bloku 0 i rozstrzygnij, czy
żywy czat idzie przez H1 (`mcpServer` → `tools/searchKnowledgeBase.ts`), czy
przez H2 (`executeToolCall` → `executeKBSearch`), czy przez oba na różnych
trasach. Od tego zależy poziom, na którym stawiasz test:

- jeśli H1 jest żywy → test **przez narzędzie** (wywołanie handlera z
  kontekstem użytkownika B) jest mocniejszym dowodem i tak go napisz;
- jeśli okaże się, że żywy jest tylko H2 → dziura w SQL nadal istnieje, ale
  jej wektor jest inny; wtedy test stawiasz **wprost na
  `ragService.searchRelevantChunks(query, {organizationId})` bez
  `documentIds`** i w raporcie uczciwie piszesz, że wektor przez narzędzie
  czatu nie został potwierdzony.

Cokolwiek wyjdzie — **zapisz pomiar, nie wniosek z mojej tabeli**.

**Krok 1 — scenariusz testu (dwie tożsamości, jedna organizacja).**

1. Organizacja `X`. Użytkownicy `A` i `B`, obaj członkowie `X`.
2. `A` dodaje dokument przez `KnowledgeService.addDocument(...)` z
   `ownerId = A`, `scope = 'user'`, po czym `processDocument(docId, tekst,
   organizationId = X)`. Treść musi zawierać **unikalny, nieprzypadkowy
   marker** (np. długi, losowy ciąg), którego nie ma nigdzie indziej — inaczej
   nie odróżnisz trafienia w dokument A od trafienia w szum.
3. Sprawdź asercją, że wiersze faktycznie powstały w OBU tabelach —
   `SELECT count(*) FROM knowledge_chunks WHERE doc_id = ?` > 0 **oraz**
   `SELECT count(*) FROM ai_knowledge_embeddings WHERE document_id = ?` > 0.
   Bez tego test może przejść dlatego, że indeksacja w ogóle się nie
   wykonała — najtańszy sposób na fałszywe „bezpiecznie".
4. `B` (inna tożsamość, ta sama organizacja `X`) zadaje pytanie zawierające
   marker, ścieżką ustaloną w kroku 0.
5. **Asercja kontraktu:** wynik `B` **nie zawiera** treści dokumentu `A`.
   **Ten test ma dziś PAŚĆ.** Zapisz jego wyjście (pełną treść zwróconego
   fragmentu) do artefaktów jako dowód dziury.

**Krok 2 — trzy warianty, nie jeden.** Ten sam scenariusz uruchom dla
`scope='organization'` (B **powinien** znaleźć) i dla `A` pytającego o
**własny** prywatny dokument (A **powinien** znaleźć — o ile ścieżka niesie
tożsamość; jeśli nie niesie, to jest ustalenie do sekcji „TWIERDZENIA
NIEZWERYFIKOWANE", a nie powód do zwężenia). Bez tych dwóch wariantów nie
odróżnisz naprawy od zaślepienia całego wyszukiwania.

**Krok 3 — silnik.** `embeddingService.search` rozgałęzia się po
`process.env.DB_TYPE === 'postgres'` (197-205), a **oba** configi vitest mają
`DB_TYPE: process.env.DB_TYPE || 'sqlite'`. Uruchamiasz z jawnym
`DB_TYPE=postgres` **i** z jawnym `RUN_DB_TESTS=1`, `MOCK_DB=false`,
`DATABASE_URL` wskazującym Twój kontener. Strażnika
`assertRealPostgresTestEnvironment()` wołasz **bez argumentów** (`Z31`) —
nigdy z `expectedDatabase: 'cx210'`.

**Ukończone, gdy:** test istnieje, jest uruchamiany (`numTotalTests > 0`, nie
`exit 0`), **pada** na nienaprawionym kodzie z komunikatem nazywającym
wprost, że dokument prywatny użytkownika A wrócił użytkownikowi B, a jego
wyjście leży w artefaktach.

**Test:** nowy plik, lokalizację potwierdź wg sąsiadów — kandydaci:
`server/src/services/ai/__tests__/day210.embeddingScope.pg.test.ts` albo
`server/src/services/__tests__/`. Wzorzec konstrukcyjny bierzesz z
istniejącego `server/src/routes/__tests__/day15.cross-tenant.routes.pg.test.ts`
(`describe.skipIf(!enabled)` + `Pool` + jawne env) — **ale pamiętaj, że
`skipIf` przy niekompletnym env daje zero failów i wygląda jak sukces.**

## R2 — Naprawa u źródła zapytań

**Krok 0 — projekt filtra, z pomiarem, PRZED implementacją.** Do rozstrzygnięcia
są dwie rzeczy i obie wymagają liczby, nie przeczucia.

*(a) Kształt reguły.* W `ai_knowledge_embeddings` żyją wiersze z co najmniej
pięciu producentów o różnym `source_type`: `'knowledge'` (Vault,
`KnowledgeService:714`), `'knowledge_base'`/podany przez wołającego
(`ingestionPipeline.ts:81/229`, m.in. odpowiedzi z wywiadów przez
`InterviewController.ts:1550`), `'llm_cache'` (`llmService.ts:807-811`),
`'project'` domyślnie (`ragService.indexDocument:763` — wywołanie bez
`organizationId` i bez `sourceType`) oraz globalne paczki. **Żaden z nich nie
ma `scope`.** Reguła „brak `scope` w wierszu = prywatny", zastosowana
per-wiersz, zwraca pustkę na każde pytanie.

Kształt do rozważenia (**zmierz, nie kopiuj**) — anty-złączenie odwzorowujące
semantykę VLT-002:

```
AND NOT EXISTS (
  SELECT 1 FROM knowledge_docs d
   WHERE d.id = <tabela_embeddingów>.document_id
     AND d.scope = 'user'
     [AND d.owner_id IS DISTINCT FROM :userId]   -- tylko gdy tożsamość jest znana
)
```

Klauzula w nawiasie kwadratowym jest różnicą między dwoma wzorcami, które
istnieją już w repo i **oba są poprawne w swoim kontekście**:
`ContextRetrievalService.fetchAccessibleDocuments` (152-170) jest
**owner-aware** (`scope='user' AND owner_id = ?` — własne prywatne dokumenty
wołającego SĄ dostępne), a `knowledgeIndexer` (1078-1084, 1130-1136) stosuje
**ryczałtowe wykluczenie**, bo nie ma `userId`. Wybierz świadomie i uzasadnij:
jeśli ścieżka niesie `userId` — owner-aware; jeśli nie niesie i nie da się go
dołożyć addytywnie — ryczałtowe wykluczenie (fail-closed), z jawnym zapisem w
raporcie, że **własne prywatne dokumenty użytkownika przestają go wspierać w
czacie** (to jest realny koszt funkcjonalny, nie drobiazg — nazwij go).

Rozważ też, czy dokładasz warunek po `source_type='knowledge'`, i **zauważ,
że DDL SQLite w ogóle nie ma kolumny `source_type`** — reguła oparta na
`source_type` jest niewykonalna na jednym z dwóch silników; anty-złączenie
działa na obu.

*(b) Koszt.* Anty-złączenie wchodzi na zapytanie korzystające z indeksu HNSW
(`idx_ai_embeddings_vector`) i sortujące po odległości wektora. Nałożone **po**
`ORDER BY … LIMIT` wytnie wyniki z już przyciętego zbioru (zwrócisz mniej niż
`limit` — cicha utrata jakości); nałożone **przed** może zmusić planer do
porzucenia indeksu wektorowego. **Uruchom `EXPLAIN ANALYZE` obu wariantów na
realnych danych** (zaseeduj co najmniej kilka tysięcy wierszy, bo na
dziesięciu planer i tak wybierze seq scan i pomiar nic nie powie) i wybierz z
liczbami w raporcie. Jeśli wynik jest zły, alternatywą jest denormalizacja
(`scope`/`owner_id` jako kolumny na `ai_knowledge_embeddings` + migracja
wypełniająca z `knowledge_docs`) — wtedy migracja musi być addytywna,
idempotentna i **poprawna na bazie zakładanej od zera** (migracja czytająca
kolumnę dokładaną alfabetycznie później wywraca cały łańcuch odtworzenia).

**Krok 1 — napraw KAŻDĄ ścieżkę zmierzoną w R1 kroku 0 i w T7.** Minimum to
`searchPg` **i** `searchSqlite` (albo uzasadnienie w raporcie, dlaczego jedna
z nich jest nieosiągalna w każdym środowisku — z dowodem, nie z założeniem).
Jeśli naprawa wymaga przewleczenia `userId`, robisz to **addytywnie**: nowe
pole opcjonalne w `EmbeddingSearchOptions`/`SearchOptions`/`SearchContext` z
domyślną wartością zachowującą **fail-closed**, a każdy istniejący wołacz
dostaje w raporcie wiersz „dotknięty / nietknięty i czym to udowodniłeś".

**Krok 2 — brak kolumny `scope`.** Istniejące guardy VLT-002 dokładają warunek
tylko `if (hasScope)` (`ragService.ts:240, 302`; `knowledgeIndexer.hasScopeColumn`)
— na bazie, gdzie runtime'owy `ALTER TABLE knowledge_docs ADD COLUMN scope`
nie przeszedł (`KnowledgeService.ts:172-183`, `fallback: true` łyka błąd po
cichu), filtr **nie dokłada się wcale**. Twoja postawa na ten przypadek ma
być wybrana świadomie **i wykonana przez test** (baza bez kolumny `scope`), a
nie tylko opisana.

**Ukończone, gdy:** (1) test z R1 przechodzi na zielono; (2) **dowód
mutacyjny** — usuwasz sam warunek filtrujący (nie cały blok, nie flagę:
warunek), test znowu pada, przywracasz; wyjście obu przebiegów leży w
artefaktach; (3) wszystkie trzy warianty z R1 kroku 2 zachowują się zgodnie z
oczekiwaniem; (4) zero nowych flag, zero zmienionych wartości domyślnych.

## R3 — Regresja uprawnionych przypadków + inwentarz danych zastanych

**(a) Pakiet testów pozytywnych — dowód, że nie zwęziłeś.** Minimum:

1. `scope='organization'` (i `scope IS NULL`, czyli wiersze sprzed VLT-001 —
   traktowane jak organizacyjne, `KnowledgeService.ts:748-751`) — nadal
   znajdowane przez innego członka organizacji.
2. `scope='project'` — nadal znajdowane w regule, która obowiązywała przed
   Twoją zmianą (**nie poszerzasz jej ani nie zwężasz** — to jest osobny
   temat, patrz komentarz AGT-008-bis w `toolDefinitions.ts:947-960`).
3. Wiersze **nie-Vaultowe**: `'llm_cache'`, `'knowledge_base'` z
   `ingestionPipeline`, `'project'` z `ragService.indexDocument`, paczki
   globalne (`tool_pack`/`methodology`/`product_pill` przy `organization_id
   IS NULL`) — **liczba trafień przed i po naprawie musi być identyczna**.
   To jest główny bezpiecznik przed „naprawą przez wyzerowanie".
4. Bramki, których nie dotykasz, nadal działają: guard VLT-002 na ścieżce
   `hybridSearch`, ACL w `ContextRetrievalService.fetchAccessibleDocuments`,
   allow-lista AGT-008-bis w `executeKBSearch`, oraz — jako osobny, nadrzędny
   filtr — strażnik poufności `filterDocumentsByVisibility` na wejściach
   E1-E3 (`documentGovernance.ts:18`, wołacze `aiContextBuilder.ts:974` i
   `ContextRetrievalService.ts:333`). **Twój filtr `scope` jest DODATKOWY i
   nie może zastąpić ani osłabić strażnika** — pokaż testem, że dokument
   zablokowany przez strażnika nadal nie przechodzi, niezależnie od `scope`.

**(b) Tabela WSZYSTKICH ścieżek czytających embeddingi.** W raporcie, z
kolumnami: [ścieżka (plik:linia) · tabela · jaki filtr realnie stosuje ·
czy dziura `scope` jej dotyczy · czy naprawiona w tym dyżurze · dowód].
Punkt startowy z mojego pomiaru — **rozbuduj i zweryfikuj, nie kopiuj**:

| Ścieżka | Tabela | Filtr dziś | Dziura? |
|---|---|---|---|
| `ragService.searchRelevantChunks` bez `documentIds` → `embeddingService.search` (669) | `ai_knowledge_embeddings` | tylko `organization_id` | **TAK — rdzeń** |
| `ragService.searchRelevantChunks` z `documentIds` → `hybridSearch` (644) | `knowledge_chunks` | VLT-002 + org | nie |
| `ragService.getContext` / `getContextKeyword` (496-500, 583-586) | `knowledge_chunks` | VLT-002 + org | nie |
| `knowledgeIndexer.keywordSearch` / `getAllChunksWithEmbeddings` | `knowledge_chunks` | VLT-002 | nie (ale **zmierz filtr organizacyjny** — w `getAllChunksWithEmbeddings` go nie zobaczyłem) |
| `InterviewInsightService.fetchEvidenceForQuestionIds` (2996-3002) | `ai_knowledge_embeddings` | **tylko `document_id IN (…)`**, brak org, brak scope; lista id z `interview_evidence WHERE organization_id = ?` | **ZMIERZ** — zależy, czy prywatny dokument Vault może trafić do `interview_evidence.knowledge_document_id` |
| „attachment fallback" E2 (`ai.routes.ts:4373-4384`) | `knowledge_chunks` | `organization_id` + `status`, bez scope; ale lista id z `ContextRetrievalService` (owner-aware) | **ZMIERZ** — czy istnieje gałąź omijająca `ContextRetrievalService` |
| org-retrieval (`ContextRetrievalService`, za `ENABLE_ORG_KNOWLEDGE_RETRIEVAL`, `ai.routes.ts:4076`) | `knowledge_docs`/`knowledge_chunks` | owner-aware ACL + strażnik | nie |
| `ai-health-check.routes.ts` (319, 326, 559, 606) | `ai_knowledge_embeddings` | liczniki `COUNT(*)` | nie (brak treści) |

Jeśli któraś ze ścieżek oznaczonych **ZMIERZ** okaże się niezależną dziurą —
**opisujesz ją i zgłaszasz jako osobny dyżur, nie naprawiasz tutaj.**

**(c) Inwentarz danych zastanych — ZAPYTANIE, NIE WYKONANIE.** Napisz gotowy,
**wyłącznie odczytowy** `SELECT` do checklisty nadzorcy, odpowiadający na
pytanie: *ile wierszy w `ai_knowledge_embeddings` na stagingu/demo pochodzi
dziś z dokumentów `knowledge_docs.scope='user'`, w ilu organizacjach i ilu
właścicieli dotyczy*. Zapytanie ma zwracać **liczby i identyfikatory, nigdy
treść chunków**. **Nie wykonujesz go zdalnie (`Z28`)** — nadzorca uruchomi je
sam. Dołóż jedno zdanie rekomendacji: czy zastane wiersze wymagają
czyszczenia, czy Twój filtr wystarczy (bo działa na odczycie, więc
retroaktywnie).

# 4. TABELA LICENCJI PLIKOWEJ

Licencja obejmuje **całą ścieżkę zapytań** — walidator wejścia, wołacza,
warstwę serwisu i warstwę SQL — bo naprawa w jednym punkcie łańcucha przy
zamkniętej licencji na sąsiedni zmusza wykonawcę do wyboru: złamać licencję
albo zrobić połowę roboty.

| Zakres | Ścieżki |
|---|---|
| Zapis | `server/src/services/ai/embeddingService.ts` — filtr `scope` w `searchPg` i `searchSqlite`; addytywne, opcjonalne pole tożsamości w `EmbeddingSearchOptions` |
| Zapis | `server/src/services/ragService.ts` — **wyłącznie** przewleczenie tożsamości do wywołania `embeddingService.search` (669) i do typu `SearchOptions`. **Guardów VLT-002 (292-303, 496-500, 583-586) NIE ruszasz** |
| Zapis (warunkowy, tylko jeśli pomiar z R1 kroku 0 tego wymaga) | `server/src/services/ai/tools/searchKnowledgeBase.ts` — addytywne `userId` w `SearchContext` i przekazanie go dalej; zero zmian w logice policy gateway (62-79) |
| Zapis (warunkowy) | `server/src/services/ai/mcpServer.ts` — **wyłącznie** jeśli okaże się, że `context` przekazywany do `execute` gubi `userId`; zmiana addytywna, bez dotykania kontraktu `TOOL_TYPE.MUTATION`/approval (482-528) |
| Zapis (nowy plik) | test R1/R2/R3 — lokalizację potwierdź wg sąsiadów (kandydat: `server/src/services/ai/__tests__/day210.embeddingScope.pg.test.ts`); **nowe pliki w `tests/` wymagają `git add -f`** |
| Zapis (warunkowy, tylko przy wariancie denormalizacyjnym) | jedna nowa migracja w `server/migrations/` — numer z Twojego przedziału, addytywna, idempotentna, poprawna na bazie od zera |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY210_SCOPE_P0_REPORT.md` |
| Odczyt | `server/src/services/KnowledgeService.ts` — źródło prawdy o `scope`; **nie zmieniasz** (uwaga: dyżur 209 planuje tu addytywny parametr — patrz sekcja 5) |
| Odczyt | `server/src/services/ai/toolDefinitions.ts` (`executeKBSearch`, AGT-008-bis) — wzorzec owner-aware; **nie zmieniasz** |
| Odczyt | `server/src/services/organizationContext/ContextRetrievalService.ts` — wzorzec owner-aware ACL; **nie zmieniasz** |
| Odczyt | `server/src/services/ai/knowledgeIndexer.ts` — wzorzec ryczałtowego wykluczenia; **nie zmieniasz** |
| Odczyt | `server/src/services/ai/documentGovernance.ts`, `server/src/services/ai/chatPolicyGateway.ts` — osobne bramki; **nie zmieniasz** |
| Odczyt | `server/src/services/InterviewInsightService.ts`, `server/src/routes/ai.routes.ts` — mierzysz do tabeli ścieżek; **nie zmieniasz w tym dyżurze** |
| Odczyt | `server/src/services/ai/ingestionPipeline.ts`, `server/src/services/ai/llmService.ts` — producenci wierszy nie-Vaultowych, potrzebni do testów regresji R3; **nie zmieniasz** |
| Nie dotykasz w ogóle | `server/src/services/ai/embeddingService` (**plik bez rozszerzenia**, martwy duplikat obok właściwego `.ts`) — zgłoś w raporcie, nie usuwaj i nie edytuj |

★ **Rozłączność z dyżurami 204-209 (równoległe):** ich zakres plikowy poza
tym, co jest tu cytowane jako kontekst, nie był mi znany przy składaniu
instrukcji. **Dyżur 209 jest wyjątkiem — wiem, że dotyka
`KnowledgeService.ts`** (planowany addytywny parametr
`skipGlobalEmbeddingIndex` w `processDocument`). Jeśli przy starcie zobaczysz
w swoim worktree zmiany poza plikami z tabeli powyżej — **STOP i zgłoś w
raporcie zamiast zgadywać.**

# 5. TWARDE ZASADY

- ★★★ **Czerwony test przed naprawą, mutacja po naprawie.** Bez obu wyjść w
  artefaktach dyżur jest odrzucony niezależnie od jakości kodu.
- ★★★ **Fail-closed na poziomie rozstrzygnięcia pochodzenia, nie per wiersz.**
  Reguła „brak `scope` w wierszu = prywatny" zastosowana dosłownie zwraca
  pustkę na każde pytanie — patrz R2 krok 0(a).
- ★★★ **Zero nowych flag. Zero zmienionych wartości domyślnych.** Naprawa
  bezpieczeństwa za flagą to dziura z wyłącznikiem, którego nikt nie
  przestawi.
- ★★ **Bramki z `LISTA_BRAMEK` czytasz i naśladujesz — nie „ujednolicasz".**
  Jedyna dopuszczalna zmiana cudzego kontraktu jest addytywna, a każdy jego
  istniejący wołacz dostaje w raporcie wiersz „dotknięty / nietknięty +
  dowód".
- ★★ **Jeden dyżur = jedna naprawa u źródła.** `InterviewInsightService`,
  „attachment fallback" E2 i `documentGovernance` **mierzysz i zgłaszasz**,
  nie naprawiasz.
- ★★ **`Z28`: zero połączeń do bazy zdalnej, demo, stagingu i produkcji.**
  Inwentarz danych zastanych oddajesz jako zapytanie do checklisty nadzorcy.
- ★★ **`Z31`: `assertRealPostgresTestEnvironment()` bez argumentów**, nigdy z
  `expectedDatabase` przypiętym do `cx210`/portu/hosta — inaczej po usunięciu
  kontenera Twoje dowody zamienią się w trwały `SKIP` raportujący `exit 0`.
- ★★ **`DB_TYPE=postgres` jawnie.** Oba configi vitest domyślają do `sqlite`;
  bez tego przetestujesz `searchSqlite` zamiast gałęzi z demo.
- **`describe.skipIf` przy niekompletnym env = zero failów i fałszywe PASS.**
  Raportujesz `numTotalTests`, nie exit code. „No test files found" to nie
  `PASS`.
- **`§0.4a` (pomiar zasięgu testów) jest warunkiem oddania raportu (`Z24`).**
  Liczby liczysz sam; przepisanie cudzej liczby = podstawa odrzucenia.
- **`docker rm -f -v cx-day210-pg` na końcu**, także gdy dyżur padnie w
  połowie. Zero śmieci, zero rekordów testowych poza własnym kontenerem.
- **Każdą cytowaną linię kodu sprawdzasz sam przed wklejeniem do raportu.**
  Numery zweryfikowano wobec markera `15c7a68b9d`; repo jest dzielone z
  dyżurami równoległymi — jeśli linia się przesunęła, **zaufaj SWOJEMU
  pomiarowi**, nie mojemu.
- ★ **Kolejność scaleń: 210 przed 209.** W sekcji „Ryzyko kolizji" raportu
  wypisz pliki wspólne z gałęzią `codex/day209-indeksacja-20260831` i jedno
  zdanie o tym, co 209 może po Twojej naprawie uprościć albo usunąć.

## Sekcja „TWIERDZENIA NIEZWERYFIKOWANE" w raporcie jest obowiązkowa

Wypisz w niej wprost co najmniej:

- **(a)** Który handler `search_knowledge_base` obsługuje żywy czat (H1/H2/oba)
  — mój pomiar wskazuje H1 na torze `llmService`/`AIPipeline` i H2 na torze
  agenta, **ale nie prześledziłem żądania end-to-end od trasy HTTP do
  wykonania narzędzia**; to jest odczyt kodu, nie pomiar runtime.
- **(b)** Czy prywatny dokument Vault (`scope='user'`) może w ogóle trafić do
  `interview_evidence.knowledge_document_id` — **nie sprawdziłem**; od tego
  zależy, czy `InterviewInsightService.fetchEvidenceForQuestionIds` jest
  drugą, niezależną dziurą, czy tylko wygląda groźnie.
- **(c)** Czy istnieje gałąź, w której `governedAttachmentDocIds`
  (`ai.routes.ts`) powstaje z pominięciem `ContextRetrievalService` — **nie
  prześledziłem wszystkich przypisań**; jeśli istnieje, „attachment fallback"
  E2 jest kolejnym P0.
- **(d)** Czy `knowledgeIndexer.getAllChunksWithEmbeddings` (1116-1140) ma
  jakikolwiek filtr **organizacyjny** — widziałem tam wyłącznie `source_type`
  i VLT-002; jeśli faktycznie go nie ma, to osobne znalezisko cross-org do
  zgłoszenia (nie do naprawy w tym dyżurze).
- **(e)** Czy `source_type='knowledge'` jest jedynym markerem pochodzenia
  Vaultowego w `ai_knowledge_embeddings` — sprawdziłem pięciu producentów
  wywołań `storeChunk`, **nie przeszukałem repo pod kątem bezpośrednich
  `INSERT INTO ai_knowledge_embeddings` poza `embeddingService.ts`**.
- **(f)** Realny koszt planu zapytania po dołożeniu anty-złączenia — **nie
  zmierzyłem**; wskazałem tylko, że indeks HNSW i `ORDER BY` po odległości
  wektora czynią kolejność filtrowania istotną.
- **(g)** Czy porty `6150`/`5092`/`5093` i miejsce na dysku były wolne w
  chwili Twojego startu — mój pomiar (`lsof` pusty, `df` **6.5Gi wolnego**)
  to migawka z chwili składania instrukcji, nie gwarancja.
