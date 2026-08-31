# INSTRUKCJA DYŻURU nr 209 — Codex — „Indeksacja artefaktów do wiedzy (17-J, §9 spięcie 5 ARCHITEKTURA_AGENTA_TERESY.md) — hook w materializeDocumentArtifact + w domknięciu decka, za flagą OFF; ★ znalezisko bezpieczeństwa: domyślna ścieżka search_knowledge_base (embeddingService→ai_knowledge_embeddings) NIE zna scope Vault-a — projekt musi go świadomie ominąć dla treści prywatnej, nie tylko "odziedziczyć widoczność""

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
> **wyłącznie** `/private/tmp/cx-day209-indeksacja`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `e96e003abd`**
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
Zakres: **Moduł 17, pozycja 17-J — §9 spięcie 5 z `docs/program/funkcje/ARCHITEKTURA_AGENTA_TERESY.md` ("indeksacja artefaktów Studio/raportów do KB — jeden hook w materializacji"). Przekrojowy: `server/src/services/documentStudio/**` (hook dokumentów), `server/src/services/presentationGeneratorService.ts` (hook decków), `server/src/services/KnowledgeService.ts`/`server/src/services/ai/embeddingService.ts` (odczyt — ZNALEZIONA luka bezpieczeństwa opisana w DLACZEGO, decyzja projektowa jak ją ominąć). Zero ekranów, zero zmian UI.**.
Trasy front: `brak — dyżur wyłącznie backendowy (hook + flaga). Front konsumuje pośrednio przez `search_knowledge_base` w czacie, ale żaden komponent frontowy nie jest modyfikowany.`. Trasy tył: ``server/src/services/documentStudio/documentStudioService.ts` (`materializeDocumentArtifact`, definicja linia 867 — JEDYNY punkt materializacji dokumentów, potwierdzone SZEŚCIOMA callerami: `document-studio.routes.ts:874,1019`; `work-canvas.routes.ts:4719`; `docGenerationRuntime.ts:1617,1690`; `chatHandoff/chatTargetMappingService.ts:79`; `ideaHandoff/ideaHandoffService.ts:397` — hookujesz TU RAZ, nie w sześciu callerach); `server/src/services/presentationGeneratorService.ts` (linia 2412 — `UPDATE presentation_decks SET status = 'ready', ...`, punkt domknięcia generacji decka); NOWY plik `server/src/services/knowledge/artifactKnowledgeIndexer.ts` (hook, nazwa Twoja, ale w tym katalogu lub obok `KnowledgeService.ts` — uzasadnij wybór); Odczyt (kontekst, nie zmieniasz bez wyraźnej decyzji w sekcji 3): `server/src/services/KnowledgeService.ts` (`addDocument` linie 621-658, `processDocument` linie 672-725 — mechanizm Vault, TU jest luka bezpieczeństwa, patrz DLACZEGO); `server/src/services/ai/embeddingService.ts` (`search`/`searchPg`/`searchSqlite`, linie ok. 195-300 — ZERO filtrowania po `scope`); `server/src/services/ragService.ts` (`appendKnowledgeDocAccessFilter` linie 228-304, guard `VLT-002` linie 296-299 — filtruje `scope`, ale TYLKO na ścieżce `hybridSearch`/`documentIds`, nie na domyślnej); `server/src/services/ai/tools/searchKnowledgeBase.ts` (całość, 193 linie — dowód, że domyślne wywołanie NIE przekazuje `documentIds`, więc trafia w ścieżkę bez filtra scope); `server/src/services/ai/documentGovernance.ts` (`filterDocumentsByVisibility`, linia 18 — TRZECI, oddzielny system poufności, czyta `ai_visibility`/`sensitivity` z `knowledge_docs`, linia 34 — kontekst, nie dotyczy bezpośrednio tego dyżuru, ale nie myl go ze `scope`).`.

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
WT=/private/tmp/cx-day209-indeksacja
MARKER=e96e003abd

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day209-indeksacja-20260831 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day209-indeksacja/config.worktree"
cat "$VAULT/worktrees/cx-day209-indeksacja/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day209-indeksacja-scratch
mkdir -p /private/tmp/cx-day209-indeksacja-artefakty

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
git -C "$VAULT" log --oneline e96e003abd..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only e96e003abd..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day209-indeksacja-20260831
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only e96e003abd..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `osiem` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day209-indeksacja

# (T1) Jedyny punkt materializacji dokumentów — policz wołaczy
grep -n "export async function materializeDocumentArtifact" server/src/services/documentStudio/documentStudioService.ts
grep -rln "materializeDocumentArtifact(" server/src --include='*.ts' | grep -v __tests__ | grep -v dist
#   oczekiwane: definicja linia 867; SZEŚCIU wołaczy (document-studio.routes.ts,
#   work-canvas.routes.ts, docGenerationRuntime.ts ×2, chatTargetMappingService.ts,
#   ideaHandoffService.ts) — hookujesz w definicji, nie w wołaczach.

# (T2) wave5_artifacts — brak kolumny scope/confidentiality na wierszu
grep -n "CREATE TABLE IF NOT EXISTS wave5_artifacts" -A 25 server/src/services/wave5ArtifactRuntimeService.ts | grep -i "scope\|confidential"
grep -n "confidentiality" server/src/services/documentStudio/documentContentGenerator.ts
#   oczekiwane: PIERWSZY grep PUSTY (brak kolumny w CREATE TABLE); drugi pokazuje
#   `confidentiality: intake.confidentiality ?? 'internal'` — domyślne, kosmetyczne.

# (T3) presentation_decks — realna kolumna confidentiality + punkt domknięcia
grep -n "confidentiality" server/migrations/20260314_presentation_decks_deck_json.sql
sed -n '2405,2415p' server/src/services/presentationGeneratorService.ts
#   oczekiwane: `confidentiality TEXT DEFAULT 'internal'` na wierszu tabeli;
#   UPDATE ... SET status = 'ready' w linii ok. 2412.

# (T4) ★ ZNALEZISKO BEZPIECZEŃSTWA — zweryfikuj SAM przed budową
grep -n "hasScope\|scope != 'user'" server/src/services/ragService.ts
grep -n "organization_id\|scope" server/src/services/ai/embeddingService.ts | grep -v "^.*://"
grep -n "documentIds" server/src/services/ai/tools/searchKnowledgeBase.ts
#   oczekiwane: VLT-002 guard (scope != 'user') istnieje TYLKO w ragService.ts
#   (appendKnowledgeDocAccessFilter); embeddingService.ts (searchPg/searchSqlite)
#   NIE ma ani jednego wystąpienia "scope"; searchKnowledgeBase.ts przekazuje
#   documentIds TYLKO gdy toolSlug/packType podane — czyli domyślne wywołanie
#   (zwykłe pytanie do wiedzy) NIGDY nie trafia w scope-aware ścieżkę.

# (T5) VLT-003 — dowód że scope nigdy nie było przekazywane do embeddingService
sed -n '655,725p' server/src/services/KnowledgeService.ts | grep -n "VLT-003\|storeChunk(\|organizationId\|scope"
#   oczekiwane: komentarz VLT-003 (naprawiono TYLKO organizationId, nie scope);
#   wywołanie embeddingService.storeChunk dostaje {content, chunkIndex, documentId,
#   organizationId, metadata, sourceType} — bez scope/ownerId.

# (T6) Inwentarz startowy generatorów raportów (do rozbudowania przez Ciebie, nie kopiuj ślepo)
find server/src/services -iname '*report*generat*' -o -iname '*Report*Generator*' | grep -v __tests__ | grep -v dist
#   oczekiwane: co najmniej aiAssessmentReportGenerator.ts, reportGenerationService.ts,
#   ai/reportGeneratorService(.ts/dir), ai/bcgReportGenerator/, ai/comprehensiveReportGenerator/,
#   report/drdReportGenerator.ts, report/ReportGeneratorService(.ts/dir) — policz TY,
#   ile z tego to osobne generatory a ile warianty/pomocnicze, dla "~20" z zamówienia.

# (T7) Flaga sąsiadka do wzorowania
grep -n "ENABLE_TERESA_RECORD_CREATE" server/src/config/FeatureFlags.ts

# (T8) PORT I MIEJSCE NA DYSKU
df -h /
lsof -nP -iTCP:6149 -iTCP:5090 -iTCP:5091 -sTCP:LISTEN
docker ps -a --format '{{.Names}}' | grep -E 'cx-day(204|205|206|207|208|209)'
#   oczekiwane: df >5GB wolnego; lsof PUSTY (potwierdza/obala twierdzenie o FIX-198);
#   docker ps może pokazać kontenery dyżurów równoległych żywe — nie dotykaj ich.
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day209-indeksacja-20260831` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6149`. Twój JEDYNY port harnessu to `5090 i 5091`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day209-pg`**. **ZAKAZANE:** `6012, 5433, 6047, 6054-6127, 5010-5077, 6404-6411 (odbiory nadzorcy i dyżury wcześniejsze niż 204). Zmierzone WPROST z cfg/body dyżurów równoległych: 6144/5078-5079 (204), 6145/5080-5081 (205), 6146/5084-5085 (206 — jego WŁASNY cfg, nie zgadywana wartość z cfg205). Dyżur 207: `6147`/`5086-5087` podany jako fakt zewnętrzny, NIE znaleziony w żadnym cfg/body dostępnym z tego miejsca — potwierdź sam. Dyżur 208 (równoległy, ten sam tor): `6148`/`5088-5089`. **Twierdzenie z zamówienia o dyżurze 209 do zweryfikowania przez Ciebie, nie ode mnie: "5090/5091 były użyte chwilowo przez FIX-198 — zwolnione"** — przeszukałem repo (`grep -rn 'FIX-198' --include='*.md'`) i scratch nadzorcy pod kątem FIX-198: ZERO trafień. Nie mogę ani potwierdzić, ani zaprzeczyć historii FIX-198 z tego miejsca — to jest twierdzenie PRZEKAZANE mi, nie zmierzone. Zmierzone WŁASNYM `lsof` w chwili składania tej instrukcji (2026-08-31, przed wydaniem): `lsof -nP -iTCP:6144-6149 -iTCP:5078-5091 -sTCP:LISTEN` pokazał WYŁĄCZNIE `127.0.0.1:6146` (kontener `cx-day206-pg`, dyżur równoległy — NIE dotykaj) — porty `6149`/`5090`/`5091` były WOLNE w chwili pomiaru. To migawka, nie gwarancja — **zweryfikuj ponownie sam w BLOKU 0** i zapisz w LISTA jako "potwierdzone wolne po FIX-198, zmierzone ponownie o [czas]" albo zgłoś kolizję, jeśli okaże się inaczej. Twój własny, wyłączny przydział: baza `6149`, harness `5090 i 5091`. ★ PORT 5000 na stałe macOS Control Center. ★ PORT 5037 na stałe adb. ★ PORTY 5060-5061 potwierdź jako wolne (dyżur 196, historyczny).`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `NOWA flaga `ENABLE_ARTIFACT_KNOWLEDGE_INDEX`, `z.boolean().default(false)` w `server/src/config/FeatureFlags.ts` (wzorem sąsiedniej definicji `ENABLE_TERESA_RECORD_CREATE`, linia 51 — dopisz obok, zachowaj alfabetyczny/logiczny porządek pliku jeśli taki jest). Domyślnie OFF — hook w `materializeDocumentArtifact` i w domknięciu decka MUSI sprawdzić flagę PRZED jakąkolwiek próbą indeksacji (fail-fast no-op przy OFF, nie fail-soft-po-próbie). Zero zmiany wartości domyślnej żadnej ISTNIEJĄCEJ flagi.`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*`; DODATKOWO: `filterDocumentsByVisibility` (`documentGovernance.ts:18`) — NIE wołasz jej z tego hooka (to inny system, patrz DLACZEGO), ale NIE WOLNO Ci obniżyć jej gwarancji ani nic zmienić w jej dwóch istniejących wołaczach (`aiContextBuilder.ts:974`, `ContextRetrievalService.ts:333`) — poza zakresem.`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY209_INDEKSACJA_REPORT.md`. Nie zmieniasz żadnego `MODULE_ACCEPTANCE.md` — dyżur przekrojowy (Moduł 17, silnik wiedzy), nie jeden moduł z tabeli WAVE_03_ACCEPTANCE.. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day209-indeksacja-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day209-indeksacja-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **NIE wołasz `KnowledgeService.processDocument`/`embeddingService.storeChunk` bezpośrednio dla artefaktu, którego wywnioskowana widoczność jest inna niż `'organization'`, dopóki nie zamkniesz luki opisanej w DLACZEGO** (naiwne skopiowanie mechanizmu uploadu odziedziczy realny wyciek prywatnej treści między użytkownikami tej samej organizacji — to jest dokładnie to, czego zamówienie zakazuje jako "test bezpieczeństwa nr 1"). ★★ **NIE zmieniasz `filterDocumentsByVisibility`/`documentGovernance.ts` ani jej dwóch istniejących wołaczy** — to osobny, równoległy system poufności (osi `ai_visibility`/`sensitivity`, nie `scope`), poza zakresem tego dyżuru; nie myl go w raporcie ze `scope`. ★★ **NIE zmieniasz VLT-002 guard w `ragService.ts` (linie 296-299)** — działa poprawnie na SWOJEJ ścieżce (`hybridSearch`/`documentIds`); jeśli Twoje rozwiązanie wymaga zmiany w `embeddingService.ts` (dodanie filtrowania `scope`), rób to jako ADDYTYWNY, nowy kod, nie przez modyfikację cudzego kontraktu bez testu regresji na wszystkich istniejących wołaczach `embeddingService.search`. ★★ **NIE indeksujesz raportów (~20 generatorów) w tym dyżurze** — WYŁĄCZNIE inwentaryzacja w raporcie (lista plików + jedno zdanie o mechanizmie generacji każdego + rekomendacja priorytetu), zero zmian kodu w generatorach. ★★ **NIE zmieniasz domyślnej wartości żadnej istniejącej flagi** — nowa flaga `ENABLE_ARTIFACT_KNOWLEDGE_INDEX` jest jedyną nową, domyślnie OFF. ★★ **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.** | Kontekst obowiązkowy: `docs/program/funkcje/ARCHITEKTURA_AGENTA_TERESY.md` §9, akapit "Wiedza-sieroca": "dokumenty ze Studio, raporty ~20 generatorów, decki — generowane i GUBIONE (zero indeksacji do KB)", TOP-5 pozycja (5): "indeksacja artefaktów Studio/raportów do KB (jeden hook w materializacji — większy, ale domyka »raport dzisiejszy = wiedza jutrzejsza«)". Zmierzony punkt materializacji dokumentów: `server/src/services/documentStudio/documentStudioService.ts:867`, funkcja `materializeDocumentArtifact` — potwierdzone SZEŚCIOMA wołaczami w całym repo (`document-studio.routes.ts` ×2, `work-canvas.routes.ts`, `docGenerationRuntime.ts` ×2, `chatTargetMappingService.ts`, `ideaHandoffService.ts`) — hookowanie TU pokrywa czat, Document Studio, work canvas, governed handoff i idea handoff JEDNYM miejscem. Artefakt materializowany tu (`wave5_artifacts`, tabela realna: `artifact_id, organization_id, artifact_type, title, content, content_md, project_id, created_by, ...` — `wave5ArtifactRuntimeService.ts:368-386`) NIE MA żadnej kolumny `scope`/`confidentiality` na wierszu — jedyny ślad poufności to `schema.confidentiality` (domyślnie `'internal'`, `documentContentGenerator.ts:674`, ewentualnie z szablonu, `documentStudioService.ts:957`), pole KOSMETYCZNE dziś (używane wyłącznie do stopki DOCX/PDF — `documentDocxRenderer.ts`/`documentPdfRenderer.ts`), NIE jako brama dostępu. Zmierzony punkt materializacji decków: `presentation_decks` MA realną kolumnę `confidentiality TEXT DEFAULT 'internal'` (`20260314_presentation_decks_deck_json.sql:13`) wprost na wierszu — łatwiejszy przypadek niż dokumenty. Punkt domknięcia: `presentationGeneratorService.ts:2412`, `UPDATE presentation_decks SET status = 'ready', ...`. ★★★ **ZNALEZISKO BEZPIECZEŃSTWA — przeczytaj przed napisaniem jednej linii kodu.** "Dziedziczy widoczność źródła" wymaga modelu ACL, który da się odziedziczyć. Zbadałem model Vault: `KnowledgeService.ts` ma TRZYPOZIOMOWY `scope` (`user`/`project`/`organization`, `VLT-001`, kolumna na `knowledge_docs`, linie 636-640). Ścieżka wyszukiwania ma DWA RÓŻNE tory z RÓŻNYM traktowaniem tego pola: (A) `ragService.ts` → `RagService.hybridSearch` (uruchamiana WYŁĄCZNIE gdy `searchRelevantChunks` dostaje `documentIds`) → SQL przez `appendKnowledgeDocAccessFilter`, która MA jawny guard `VLT-002` (linie 296-299): `AND (d.scope IS NULL OR d.scope != 'user')` — prywatne dokumenty WYKLUCZONE, bo ta ścieżka nie zna `userId` (komentarz w kodzie to przyznaje wprost: "a private document must never surface in a context-less/other-user AI answer, so it is excluded outright"). (B) DOMYŚLNA ścieżka `searchRelevantChunks` (BEZ `documentIds` — dokładnie to, czego `search_knowledge_base` (`searchKnowledgeBase.ts`) używa, gdy wywołanie NIE ma `toolSlug`/`packType`, czyli normalne pytanie do wiedzy) → `deps.embeddingService.search()` → tabela **`ai_knowledge_embeddings`** (INNA tabela niż `knowledge_chunks`!) → `embeddingService.ts` `searchPg`/`searchSqlite` (linie ok. 195-300) filtrują WYŁĄCZNIE po `organization_id` (plus wyjątek dla `GLOBAL_KNOWLEDGE_SOURCE_TYPES`) — **ZERO wzmianki o `scope` w całej tej ścieżce.** Dowód, że to NIE jest teoretyczne: `KnowledgeService.processDocument` (linie 672-725), która przetwarza KAŻDY dokument Vault (w tym `scope='user'`), zapisuje chunki DO OBU tabel — `knowledge_chunks` (z `doc_id`, scope żyje na rodzicu `knowledge_docs`) ORAZ, przez `embeddingService.storeChunk` (linia 714), do `ai_knowledge_embeddings`, przekazując WYŁĄCZNIE `organizationId` (komentarz `VLT-003`, linie 658-666, przyznaje: naprawiono TYLKO cross-organizacyjny wyciek `organizationId`, "the confirmed leak was via IngestionPipeline.ingestText/interview answers, same underlying bug" — `scope='user'` NIGDY nie było przekazywane do `embeddingService.storeChunk`, więc PRYWATNY dokument Vault, dziś, JEST wyszukiwalny przez `search_knowledge_base` w domyślnym trybie przez KAŻDEGO użytkownika tej samej organizacji). To jest ZMIERZONY, ISTNIEJĄCY (nie hipotetyczny) stan repo, nie coś co ten dyżur wprowadza — ale "reużyj TEN SAM mechanizm co upload czatu" z zamówienia, zastosowany NAIWNIE (czyli: po prostu wywołaj `KnowledgeService.processDocument`/`embeddingService.storeChunk` dla nowego artefaktu tak jak dla uploadu), ODZIEDZICZY tę samą lukę dla KAŻDEGO nowego typu artefaktu, w tym tych oznaczonych jako poufne. "Test bezpieczeństwa nr 1" z zamówienia (prywatny dokument nie wraca innemu użytkownikowi) PADNIE z tym naiwnym podejściem — nie dlatego, że test jest źle napisany, tylko dlatego, że mechanizm, który miałby być powielony, sam ma dziurę. Sekcja 3 opisuje bezpieczny wzorzec. |

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
cd /private/tmp/cx-day209-indeksacja

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day209-pg psql -U postgres -d cx209 \
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
cd /private/tmp/cx-day209-indeksacja

docker run -d --name cx-day209-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx209 \
  -p 127.0.0.1:6149:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day209-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6149/cx209 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6149/cx209 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day209-indeksacja && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6149/cx209 \
JWT_SECRET=cx209-test-secret-do-not-reuse \
npx vitest run server/src/services/documentStudio/__tests__ server/src/services/__tests__ server/src/services/knowledge/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day209-indeksacja-artefakty/day209-vitest.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day209-indeksacja && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/services/documentStudio/__tests__ server/src/services/__tests__ server/src/services/knowledge/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day209-indeksacja-artefakty/day209-vitest.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day209-indeksacja/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day209-pg psql -U postgres -d cx209 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day209-pg`.
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
> **(e) ★★★ **Pierwsza i najważniejsza: "reużyj mechanizm uploadu czatu" ≠ "bezpieczny domyślnie".** Sam mechanizm (KnowledgeService.processDocument → embeddingService.storeChunk → ai_knowledge_embeddings) ma dziś ISTNIEJĄCĄ, zmierzoną lukę scope='user' (T4/T5) — powielenie go 1:1 dla nowych typów artefaktów rozszerza lukę, nie ją zamyka. Bezpieczny wzorzec: dla artefaktu, którego wywnioskowana widoczność to coś innego niż w pełni organizacyjna, NIE wołaj `embeddingService.storeChunk` wcale (indeksuj WYŁĄCZNIE do `knowledge_docs`/`knowledge_chunks` ze `scope` ustawionym poprawnie) — taki artefakt będzie zaindeksowany i bezpieczny, ale (świadomie, udokumentowanym ograniczeniem) NIE znajdzie go domyślne wywołanie `search_knowledge_base` (bo ta ścieżka czyta `ai_knowledge_embeddings`, nie `knowledge_chunks`, gdy `documentIds` nie jest podane) — to jest kompromis bezpieczeństwo>funkcjonalność, który MUSISZ nazwać wprost w raporcie, nie ukryć. Alternatywa (pełna naprawa: wątkowanie `scope`+`userId` przez cały łańcuch `search_knowledge_base`→`ragService`→`embeddingService`) jest ARCHITEKTONICZNIE większa niż "jeden hook" z zamówienia — jeśli zdecydujesz się na nią, uzasadnij w raporcie, dlaczego wybrałeś większy zakres niż zlecony, i upewnij się, że KAŻDY istniejący wołacz `embeddingService.search` nadal działa (nie tylko nowy). ★★ **Druga: `document_studio_artifacts` (`wave5_artifacts`) NIE MA kolumny `scope`/`confidentiality` na wierszu** (T2) — jedyny sygnał poufności to `schema.confidentiality`, ale ta wartość jest DZIŚ efemeryczna/kosmetyczna (renderowana do stopki, może w ogóle nie być trwale zapisana na wierszu `wave5_artifacts` poza `content_json_native`) — zanim zbudujesz mapowanie "confidentiality → scope", zmierz SAM, czy `content_json_native` faktycznie przechowuje tę wartość po zapisie (czy da się ją odczytać z powrotem po materializacji), bo jeśli nie — Twój hook nie ma z czego wywnioskować widoczności dla dokumentów (w przeciwieństwie do decków, gdzie kolumna jest realna, T3). ★★ **Trzecia: `documentGovernance.ts`/`filterDocumentsByVisibility` to TRZECI, niepowiązany system** (`ai_visibility`/`sensitivity` na `knowledge_docs`, dowód poufności z `DOWOD_2026-08-30_STRAZNIK_POUFNOSCI.md`) — nie myl go ze `scope`. Ten system ma WŁASNE, udokumentowane dziury (tylko 2 z 5 wejść go wołają, jedno fail-open) — ale to inny dyżur, nie ten; nie próbuj naprawiać obu naraz. ★★ **Czwarta: `~20 generatorów raportów` to inwentarz, nie liczba zweryfikowana przeze mnie** — T6 daje Ci punkt startowy (7-9 plików/katalogów widocznych z prostego find), ale niektóre to warianty tego samego mechanizmu (`ai/reportGeneratorService` folder + plik tej samej nazwy sugerują duplikat/migrację w toku — zweryfikuj) — policz SAM, ile to realnie ODRĘBNYCH ścieżek generacji, zanim wpiszesz liczbę do raportu.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day209-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day209-indeksacja-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`Dwie pozycje: R1 dokumenty (`materializeDocumentArtifact`, jeden hook, sześciu callerów za darmo) i R2 decki (domknięcie generacji w `presentationGeneratorService.ts:2412`). R3 (raporty ~20 generatorów) to WYŁĄCZNIE inwentaryzacja w raporcie — zero implementacji. R1/R2 dzielą JEDEN nowy moduł (`artifactKnowledgeIndexer.ts`) i JEDNĄ flagę — nie licz ich jako w pełni rozłączne plikowo, ale są rozłączne co do wołacza (dokumenty vs decki) i mogą być testowane niezależnie.`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6149` albo `5090 i 5091` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6149` albo `5090 i 5091`** (`Z7`).

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

`docs/program/funkcje/ARCHITEKTURA_AGENTA_TERESY.md` §9, akapit
"Wiedza-sieroca": *"dokumenty ze Studio, raporty ~20 generatorów, decki —
generowane i GUBIONE (zero indeksacji do KB)"*. TOP-5 najtańszych spięć,
pozycja (5): *"indeksacja artefaktów Studio/raportów do KB (jeden hook w
materializacji — większy, ale domyka »raport dzisiejszy = wiedza
jutrzejsza«)"*.

Zmierzony punkt materializacji dokumentów: `server/src/services/
documentStudio/documentStudioService.ts:867`, funkcja
`materializeDocumentArtifact`. To jest DOSŁOWNIE "jeden hook" z zamówienia —
policzyłem sześciu wołaczy w całym repo (`document-studio.routes.ts` ×2,
`work-canvas.routes.ts`, `docGenerationRuntime.ts` ×2,
`chatTargetMappingService.ts`, `ideaHandoffService.ts`): czat, Document
Studio, work canvas, governed handoff (dyżur 195) i idea handoff WSZYSTKIE
przechodzą przez tę jedną funkcję. Hook tutaj pokrywa je wszystkie naraz.

Zmierzony punkt materializacji decków: `presentation_decks` ma realną
kolumnę `confidentiality TEXT DEFAULT 'internal'` wprost na wierszu
(`20260314_presentation_decks_deck_json.sql:13`) — łatwiejszy przypadek niż
dokumenty. Punkt domknięcia generacji: `presentationGeneratorService.ts:2412`,
`UPDATE presentation_decks SET status = 'ready', ...`.

## ★★★ Znalezisko bezpieczeństwa — przeczytaj przed napisaniem kodu

Zamówienie mówi: *"reużyj TEN SAM mechanizm co upload czatu, żeby artefakt
po materializacji był wyszukiwalny"* i jednocześnie stawia jako "test
bezpieczeństwa nr 1": *"dokument prywatny NIE wraca innemu użytkownikowi
przez wyszukiwanie"*. Zbadałem oba mechanizmy i **one się dziś gryzą**.

Model ACL Vault (`KnowledgeService.ts`) ma trójpoziomowy `scope` (`user`/
`project`/`organization`, kolumna na `knowledge_docs`, `VLT-001`, linie
636-640). Wyszukiwanie ma DWIE ścieżki z różnym traktowaniem tego pola:

- **(A) Ścieżka scope-aware.** `ragService.ts` → `hybridSearch`, uruchamiana
  WYŁĄCZNIE gdy `searchRelevantChunks` dostaje `documentIds`. SQL przechodzi
  przez `appendKnowledgeDocAccessFilter`, która ma jawny guard `VLT-002`
  (linie 296-299): `AND (d.scope IS NULL OR d.scope != 'user')`. Prywatne
  dokumenty WYKLUCZONE — komentarz w kodzie: *"a private document must
  never surface in a context-less/other-user AI answer, so it is excluded
  outright"*.
- **(B) Ścieżka domyślna — dokładnie ta, której używa `search_knowledge_base`
  gdy nie ma `toolSlug`/`packType`** (czyli normalne pytanie do wiedzy w
  czacie, `searchKnowledgeBase.ts`, całość, 193 linie — zero `documentIds`
  w tym wywołaniu). `searchRelevantChunks` bez `documentIds` woła
  `deps.embeddingService.search()` → tabela **`ai_knowledge_embeddings`**
  (INNA tabela niż `knowledge_chunks`!) → `embeddingService.ts`
  `searchPg`/`searchSqlite` (linie ok. 195-300) filtrują WYŁĄCZNIE po
  `organization_id`. **Zero wzmianki o `scope` w całej tej ścieżce.**

Dowód, że to nie jest teoretyczne: `KnowledgeService.processDocument`
(linie 672-725) — funkcja, która przetwarza KAŻDY dokument Vault, w tym
`scope='user'` — zapisuje chunki DO OBU tabel: `knowledge_chunks`
(scope żyje na rodzicu `knowledge_docs`) ORAZ, przez
`embeddingService.storeChunk` (linia 714), do `ai_knowledge_embeddings`,
przekazując WYŁĄCZNIE `organizationId`. Komentarz `VLT-003` (linie 658-666)
przyznaje wprost: naprawiono TYLKO cross-organizacyjny wyciek, `scope`
NIGDY nie było przekazywane do `embeddingService.storeChunk`. **Skutek:
prywatny dokument Vault jest DZIŚ wyszukiwalny przez `search_knowledge_base`
w domyślnym trybie przez każdego użytkownika tej samej organizacji.**

To jest zmierzony, istniejący stan repo — nie coś, co ten dyżur wprowadza.
Ale "reużyj TEN SAM mechanizm co upload" zastosowane naiwnie (po prostu
wywołać `processDocument`/`storeChunk` dla nowego artefaktu tak jak dla
uploadu) ODZIEDZICZY tę samą lukę dla każdego nowego typu artefaktu — i
"test bezpieczeństwa nr 1" z zamówienia PADNIE, nie dlatego że test jest
źle napisany, tylko dlatego że powielany mechanizm sam ma dziurę. Bezpieczny
wzorzec jest w sekcji 3.

# 2. TEZY ZLECENIA

- **T1.** Hook w `materializeDocumentArtifact` (linia 867) pokrywa
  WSZYSTKICH sześciu wołaczy jednym miejscem — nie hookuj w wołaczach.
- **T2.** Zakres implementacji: `document_studio_artifacts` (wave5) +
  `presentation_decks`. Raporty (~20 generatorów) = inwentarz w raporcie,
  ZERO implementacji.
- **T3.** Flaga `ENABLE_ARTIFACT_KNOWLEDGE_INDEX`, domyślnie OFF —
  fail-fast no-op przy OFF, nie fail-soft-po-próbie.
- **T4.** "Dziedziczy widoczność źródła" wymaga modelu ACL, który da się
  odziedziczyć — zbadaj Vault (`scope`), NIE zakładaj że powielenie
  mechanizmu uploadu jest z definicji bezpieczne (patrz znalezisko w
  sekcji 1 — jest odwrotnie).
- **T5.** Test bezpieczeństwa nr 1 (dokument prywatny nie wraca innemu
  użytkownikowi przez wyszukiwanie) jest priorytetem nadrzędnym nad testem
  E2E pozytywnym (dokument znaleziony w tej samej organizacji) — jeśli
  oba nie mieszczą się w budżecie dyżuru, bezpieczeństwo wygrywa.

# 3. POZYCJE DYŻURU

## R1 — Dokumenty: hook w `materializeDocumentArtifact`

**Krok 1 — wywnioskuj widoczność artefaktu, zmierz zanim zbudujesz.**
Zanim napiszesz hook, sprawdź SAM (nie ufaj tej instrukcji ślepo — T2 w
bloku 0), czy `schema.confidentiality` (ustawiane w `materializeDocumentArtifact`,
linia 957 dla szablonów, domyślnie `'internal'` z `documentContentGenerator.ts:674`
dla trybu bez szablonu) jest w ogóle CZYTELNE z powrotem po zapisie —
sprawdź czy `content_json_native` na wierszu `wave5_artifacts` przechowuje
ten schemat w całości. Jeśli tak, Twoje mapowanie:

```ts
function inferKnowledgeScope(confidentiality: string): 'user' | 'organization' {
  return confidentiality === 'confidential' || confidentiality === 'restricted'
    ? 'user'
    : 'organization';
}
```

Jeśli `content_json_native` NIE przechowuje `confidentiality` w formie
odczytywalnej — nazwij to w raporcie jako blokującą lukę i zdecyduj
świadomie: albo domyślnie traktujesz WSZYSTKIE dokumenty jako
`scope='organization'` (bezpieczne dla treści jawnie oznaczonej jako
poufna? NIE — sprawdź to najpierw), albo jako `scope='user'` (bezpieczne
zawsze, ale nic nie będzie domyślnie wyszukiwalne). Uzasadnij wybór w
raporcie z dowodem pomiaru, nie zgadnij.

**Krok 2 — hook, fail-soft, za flagą.** Po sukcesie
`materializeDocumentArtifact` (koniec funkcji, PRZED `return`), owinięty
we własny `try/catch`:

```ts
if (isArtifactKnowledgeIndexEnabled()) {
  void indexDocumentArtifactForKnowledge({
    artifactId: result.artifactId, // dopasuj do realnej nazwy pola zwracanego
    organizationId: params.organizationId,
    ownerId: params.userId,
    projectId: params.projectId ?? null,
    title: params.intake.title,
    contentMd: /* treść materializowanego dokumentu — użyj tej samej
                  reprezentacji tekstowej co eksport DOCX/PDF, nie surowy JSON */,
    confidentiality: provisionalSchema.confidentiality,
  }).catch((err) => logger.warn('[artifactKnowledgeIndex] document hook failed (ignored):', err?.message || err));
}
```

Fire-and-forget (`void`, nie `await`) — mirror wzorca `generate_initiative`
(sekcja "FULL-FILL" w `generateInitiative.ts`): indeksacja NIGDY nie może
opóźnić ani zepsuć odpowiedzi materializacji.

**Krok 3 — nowy moduł `artifactKnowledgeIndexer.ts`.** Wewnątrz
`indexDocumentArtifactForKnowledge`:

1. Wywołaj `inferKnowledgeScope`.
2. `KnowledgeService.addDocument(...)` z realnym `scope`/`ownerId`/`projectId`
   wywnioskowanym w kroku 1 — tworzy wiersz `knowledge_docs`.
3. `KnowledgeService.processDocument(docId, contentMd, organizationId)` —
   ALE **TYLKO** gdy `scope !== 'user'`. Gdy `scope === 'user'`, NIE wołaj
   `processDocument` w jego obecnym kształcie (bo on ZAWSZE woła też
   `embeddingService.storeChunk` bez świadomości `scope`, patrz sekcja 1) —
   zamiast tego wywołaj WYŁĄCZNIE część, która zapisuje do
   `knowledge_chunks` (bez embeddingService), albo — prościej i bezpieczniej
   — dodaj nowy, jawny parametr do `processDocument` (np.
   `skipGlobalEmbeddingIndex: boolean`) i przekaż `true` dla `scope==='user'`.
   **To jest jedyna dozwolona, addytywna zmiana w `KnowledgeService.ts` w
   tym dyżurze** — nowy opcjonalny parametr z domyślną wartością `false`
   (zero zmiany zachowania dla wszystkich ISTNIEJĄCYCH wołaczy).

**Ukończone, gdy:** test mutacyjny pokazuje: (1) `materializeDocumentArtifact`
działa identycznie jak dziś, gdy flaga OFF (zero wywołań `KnowledgeService`);
(2) przy fladze ON, dokument z `confidentiality='internal'` (lub bez
szablonu) tworzy wiersz `knowledge_docs` ze `scope='organization'` I wpis w
`ai_knowledge_embeddings`, I jest znajdywany przez
`ragService.searchRelevantChunks(query, {organizationId})` (ścieżka
DOMYŚLNA, bez `documentIds`) — czyli przez to, czego realnie używa
`search_knowledge_base`; (3) dokument z `confidentiality='confidential'`
tworzy wiersz `knowledge_docs` ze `scope='user'`, ZERO wpisu w
`ai_knowledge_embeddings` (dowód: `SELECT count(*) FROM ai_knowledge_embeddings
WHERE document_id = ?` = 0), i NIE jest znajdywany przez
`ragService.searchRelevantChunks` w trybie domyślnym; (4) **test
bezpieczeństwa jawny**: Użytkownik A tworzy poufny dokument w organizacji
X; Użytkownik B (inna tożsamość, ta sama organizacja X) woła
`search_knowledge_base` z zapytaniem zawierającym unikalny fragment treści
dokumentu A — wynik MUSI być pusty dla tego dokumentu (test PRZED naprawą —
czyli z hookiem wołającym `processDocument` bez `skipGlobalEmbeddingIndex`
— MUSI wykryć wyciek, żeby udowodnić że test w ogóle coś mierzy; test PO
naprawie — pusty wynik).

**Test:** nowy plik `server/src/services/knowledge/__tests__/
artifactKnowledgeIndexer.pg.test.ts`, realny Postgres (embeddingi i
`ai_knowledge_embeddings` różnią się między SQLite i Postgres —
`searchPg`/`searchSqlite`, patrz DLACZEGO — testuj na silniku zgodnym z
tym, co rzeczywiście uruchamia `search_knowledge_base` na demo/staging,
czyli Postgres).

## R2 — Decki: hook w domknięciu generacji

Analogicznie, w `presentationGeneratorService.ts`, PO linii 2412
(`UPDATE presentation_decks SET status = 'ready', ...`) powodzenie:
odczytaj `confidentiality` BEZPOŚREDNIO z wiersza (kolumna realna,
`20260314_presentation_decks_deck_json.sql:13` — łatwiejsze niż dokumenty,
zero potrzeby czytania z JSON-a). Ekstrakcja treści do chunkowania: skleja
tytuły + treść slajdów z `deck_json`/`unified_json` (wybierz realną kolumnę
źródłową — zmierz SAM, która z nich jest kanoniczna po tym UPDATE, nie
zgaduj z nazwy). Ten sam moduł `artifactKnowledgeIndexer.ts`, ta sama
funkcja `inferKnowledgeScope`, ten sam warunek `scope==='user'` →
`skipGlobalEmbeddingIndex: true`.

**Ukończone, gdy:** analogiczne DoD do R1, plus test bezpieczeństwa
lustrzany (deck poufny nie wraca innemu użytkownikowi organizacji).

**Test:** rozszerzenie tego samego pliku testowego albo siostrzany
`presentationGeneratorService.artifactKnowledgeIndex.pg.test.ts` —
lokalizację potwierdź wg sąsiadów istniejących testów tego serwisu.

## R3 — Raporty: inwentarz, ZERO implementacji

Punkt startowy (T6 w bloku 0 — rozbuduj, nie kopiuj ślepo):
`aiAssessmentReportGenerator.ts`, `reportGenerationService.ts`,
`ai/reportGeneratorService.ts` (i katalog tej samej nazwy — **zmierz, czy
to duplikat/migracja w toku, nie licz dwa razy bez sprawdzenia**),
`ai/bcgReportGenerator/`, `ai/comprehensiveReportGenerator/`,
`report/drdReportGenerator.ts`, `report/ReportGeneratorService.ts`
(i katalog tej samej nazwy — to samo ostrzeżenie).

W raporcie: tabela z kolumnami [plik/katalog generatora, gdzie
materializuje wynik (tabela/kolumna), czy ma jeden punkt zbiegu podobny do
`materializeDocumentArtifact` czy jest rozproszony, rekomendacja
priorytetu dla przyszłego dyżuru]. Cel: następny dyżur (17-J-2, jeśli
powstanie) dostaje gotową mapę zamiast zaczynać od zera.

# 4. TABELA LICENCJI PLIKOWEJ

| Zakres | Ścieżki |
|---|---|
| Zapis | `server/src/services/documentStudio/documentStudioService.ts` — wyłącznie hook PO sukcesie `materializeDocumentArtifact`, przed `return` |
| Zapis | `server/src/services/presentationGeneratorService.ts` — wyłącznie hook PO linii 2412 (`UPDATE ... status = 'ready'`) |
| Zapis (nowy plik) | `server/src/services/knowledge/artifactKnowledgeIndexer.ts` |
| Zapis | `server/src/services/KnowledgeService.ts` — WYŁĄCZNIE nowy opcjonalny parametr `skipGlobalEmbeddingIndex` na `processDocument`, domyślna wartość `false`, zero zmiany zachowania dla wołaczy, które go nie przekazują |
| Zapis | `server/src/config/FeatureFlags.ts` — nowa flaga `ENABLE_ARTIFACT_KNOWLEDGE_INDEX` |
| Zapis | testy R1/R2 (lokalizację potwierdź wg sąsiadów) |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY209_INDEKSACJA_REPORT.md` — z sekcją inwentarza R3 |
| Odczyt | `server/src/services/ai/embeddingService.ts`, `server/src/services/ragService.ts` (`appendKnowledgeDocAccessFilter`, `hybridSearch`) — **nie zmieniasz** (chyba że Twoje rozwiązanie w R1/R2 świadomie wymaga inaczej — patrz PUŁAPKA pierwsza w cfg209, uzasadnij w raporcie) |
| Odczyt | `server/src/services/ai/tools/searchKnowledgeBase.ts` — dowód ścieżki domyślnej; **nie zmieniasz** |
| Odczyt | `server/src/services/ai/documentGovernance.ts` — osobny system poufności; **nie zmieniasz** |
| Odczyt | wszystkie pliki z inwentarza R3 — **nie zmieniasz żadnego** |
| Odczyt | `docs/program/funkcje/ARCHITEKTURA_AGENTA_TERESY.md` §9 — kontrakt tego dyżuru; **nie zmieniasz** |

★ **Rozłączność z dyżurami 204-208 (równoległe):** ich zakres plikowy poza
tym co jest cytowane tu jako kontekst NIE był znany przy składaniu tej
instrukcji. Jeśli przy starcie zobaczysz w swoim worktree zmiany poza
plikami z tabeli powyżej, STOP i zgłoś w raporcie zamiast zgadywać.

# 5. TWARDE ZASADY

- ★★★ **Zero wołania `embeddingService.storeChunk`/`processDocument` bez
  `skipGlobalEmbeddingIndex` dla artefaktu ze `scope==='user'`.** To jest
  RDZEŃ testu bezpieczeństwa nr 1 — patrz sekcja 1.
- ★★ **Flaga domyślnie OFF, fail-fast no-op, nie fail-soft-po-próbie.**
- ★★ **Raporty (~20 generatorów) = inwentarz w raporcie, zero implementacji.**
- ★★ **Zmiana w `KnowledgeService.processDocument` jest WYŁĄCZNIE addytywny
  opcjonalny parametr** — zero zmiany zachowania dla istniejących wołaczy.
- ★★ **Nie mylisz trzech systemów poufności** — `knowledge_docs.scope`
  (Vault, ten dyżur), `ai_visibility`/`sensitivity` (documentGovernance,
  osobny dyżur), `schema.confidentiality` (kosmetyka stopki DOCX/PDF,
  sygnał WEJŚCIOWY do mapowania w tym dyżurze, nie sam mechanizm ACL).
- **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.**
- Pułapka: `No test files found` NIE jest `PASS`. Sprawdź `numTotalTests` > 0.
- ★ Port **5000 zajęty na stałe przez macOS Control Center**, **5037 przez
  adb**. Zweryfikuj SAM twierdzenie o FIX-198 i portach 5090/5091 (cfg209,
  `LISTA_PORTOW_ZAJETYCH`) — nie znalazłem żadnego śladu FIX-198 w
  dostępnych mi plikach.
- **Każdą cytowaną linię kodu/dokumentu sprawdzasz sam przed wklejeniem do
  raportu.** Numery zweryfikowano wobec markera `e96e003abd`, ale repo jest
  dzielone z dyżurami równoległymi — jeśli linia się przesunęła, zaufaj
  SWOJEMU pomiarowi.
- **Sekcja "TWIERDZENIA NIEZWERYFIKOWANE" w raporcie jest obowiązkowa.**
  Wypisz w niej wprost co najmniej: (a) czy `content_json_native` na
  `wave5_artifacts` faktycznie przechowuje `schema.confidentiality`
  czytelnie po zapisie — nie sprawdziłem tego bezpośrednio, tylko
  wywnioskowałem że MOŻE, bo cały `provisionalSchema` przechodzi przez ten
  pipeline; (b) czy `deck_json` czy `unified_json` jest kanonicznym źródłem
  treści po `status='ready'` — nie zmierzyłem, wskazałem tylko że oba
  istnieją; (c) czy dodanie `skipGlobalEmbeddingIndex` do
  `processDocument` NIE psuje żadnego z jego dzisiejszych wołaczy (znalazłem
  minimum jeden inny niż Vault-upload — `ai.routes.ts` linie ok. 500-600,
  ODMIENNA ścieżka uploadu z `organization_context_upload_receipts`, która
  MOŻE używać innego mechanizmu niż `KnowledgeService.processDocument` —
  zweryfikuj, czy to w ogóle ten sam kod, zanim założysz że Twoja zmiana
  ich nie dotyczy); (d) czy istnieją JESZCZE inne ścieżki wyszukiwania poza
  (A) i (B) z sekcji 1, które też czytają `ai_knowledge_embeddings` lub
  `knowledge_chunks` z pominięciem `scope` — przeszukałem tylko
  `ragService.ts`/`embeddingService.ts`/`searchKnowledgeBase.ts`, nie całe
  repo pod kątem bezpośrednich `SELECT ... FROM ai_knowledge_embeddings`.
