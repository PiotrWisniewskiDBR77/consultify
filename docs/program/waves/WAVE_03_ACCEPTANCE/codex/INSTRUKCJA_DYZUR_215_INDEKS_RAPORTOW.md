# INSTRUKCJA DYŻURU nr 215 — Codex — „Pozycja R3 dyzuru 209: rozszerzenie hooka indeksacji artefaktow do bazy wiedzy AI (`artifactKnowledgeIndexer.ts`) o RAPORTY z Report Buildera — nowa funkcja `indexReportArtifactForKnowledge`, wpieta w `reportGenerationService.generateFullReport` tuz przed zwrotem (`:1844`), TA SAMA flaga `ENABLE_ARTIFACT_KNOWLEDGE_INDEX` (bez nowej), zasieg czytany BEZPOSREDNIO z kolumny `confidentiality` swiezym SELECT-em (bo `ReportBuilderService.getReport()` jej NIE mapuje do zwracanego obiektu — zmierzona luka analogiczna do wlasnego komentarza pliku o `sourceRefs`), tresc budowana ze swiezego odczytu `report_builder_sections`. Plus zmierzona i udokumentowana decyzja o DWOCH pozostalych generatorach raportow: `management_reports` (brak kolumny poufnosci — `scope` tam znaczy PROJECT/PORTFOLIO, falszywy przyjaciel nazwy) i `aiAssessmentReportGenerator` (nie zapisuje nic trwale, `res.json()` wprost do klienta) — obie MAPOWANE z powodem, zaden hook w tym dyzurze"

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
> **wyłącznie** `/private/tmp/cx-day215-indeks-raportow`.

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
Zakres: **17_WIEDZA_AI (indeksacja artefaktow) x 09_RAPORTY (Report Builder). Kontrakt do rozszerzenia: `server/src/services/knowledge/artifactKnowledgeIndexer.ts` (dzis 113 linii — `inferKnowledgeScope` `:15-20`, `indexDocumentArtifactForKnowledge`/`indexDeckArtifactForKnowledge` `:62-68`, `deckArtifactToKnowledgeMarkdown` `:85-113`). Punkt wpiecia: `server/src/services/reportGenerationService.ts` (`generateFullReport`, `:1575-1844`), analogicznie do dwoch juz zywych hookow w `server/src/services/documentStudio/documentStudioService.ts:1263-1278` i `server/src/services/presentationGeneratorService.ts:2430-2455`**.
Trasy front: `BRAK. Ten dyzur jest wylacznie backendowy, dokladnie jak 209 — nie dotykasz niczego w `src/`. Jesli podczas pomiaru znajdziesz front-endowy element, ktory Twoim zdaniem MUSI sie zmienic (np. wskaznik `Zaindeksowano do bazy wiedzy` w UI Report Buildera) — to JEST poza zakresem: opisz go w raporcie jako `DO DECYZJI WLASCICIELA`, nie buduj go`. Trasy tył: `Nie dodajesz ZADNEJ nowej trasy HTTP. Trasa produkcyjna, ktora Twoj hook ma zaczac obslugiwac: `POST /api/report-builder/:id/generate` (`server/src/routes/report-builder.routes.ts:2619`, handler wola `ReportGenerationService.generateFullReport` w `:2625`; router ma wlasne `router.use(verifyToken)` w `:241`, wiec montuje sie samodzielnie jak w FIX-209.3). Drugi realny wolacz, BEZ trasy HTTP wlasnej (job wewnetrzny): `server/src/services/scheduledReportService.ts:553` (dynamiczny import, wywoluje `generateFullReport` z tymi samymi argumentami). `reportGenerationService.ts` jest zamontowany przez `server/src/Gateway.ts:268` (`import reportBuilderRoutes`) i `:1176` (`initializeRoutes`) — to NIE jest test wstrzykujacy zaleznosci, to realny ApiGateway (`Z22`)`.

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
WT=/private/tmp/cx-day215-indeks-raportow
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
git -C "$VAULT" worktree add "$WT" -b codex/day215-indeks-raportow-20260831 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day215-indeks-raportow/config.worktree"
cat "$VAULT/worktrees/cx-day215-indeks-raportow/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day215-indeks-raportow-scratch
mkdir -p /private/tmp/cx-day215-indeks-raportow-artefakty

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
git -C "$WT" push github-backup codex/day215-indeks-raportow-20260831
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only fe33ce8036..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `dziewiec` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day215-indeks-raportow

# (W1) KONTRAKT HOOKA DO NASLADOWANIA — caly plik, eksporty, ksztalt zwracanej wartosci
cat -n server/src/services/knowledge/artifactKnowledgeIndexer.ts
#   oczekiwane: 113 linii; `inferKnowledgeScope` (`:15-20`, confidential|restricted -> user,
#   reszta -> organization); `indexDocumentArtifactForKnowledge`/`indexDeckArtifactForKnowledge`
#   (`:62-68`) zwracaja `{documentId, scope, chunkCount}`; `deckArtifactToKnowledgeMarkdown`
#   (`:85-113`) jest WZORCEM na Twoja funkcje dla raportow, nie kopiuj 1:1 (inny ksztalt danych).

# (W2) DWA ZYWE WOLANIA HOOKA + FLAGA — dokladne linie na TWOIM markerze moga sie roznic
grep -n "isArtifactKnowledgeIndexEnabled\|indexDocumentArtifactForKnowledge\|indexDeckArtifactForKnowledge" \
  server/src/services/documentStudio/documentStudioService.ts server/src/services/presentationGeneratorService.ts
sed -n '48,60p' server/src/config/FeatureFlags.ts
grep -n "ENABLE_ARTIFACT_KNOWLEDGE_INDEX\|isArtifactKnowledgeIndexEnabled" server/src/config/FeatureFlags.ts
#   oczekiwane: hook dokumentu ok. `documentStudioService.ts:1263-1278` (fire-and-forget,
#   `void ...catch(logger.warn)`), hook decka ok. `presentationGeneratorService.ts:2430-2455`
#   (wlasny swiezy SELECT status='ready' przed wywolaniem); flaga: schema `default(false)`,
#   loader `process.env.ENABLE_ARTIFACT_KNOWLEDGE_INDEX === 'true'`, helper eksportowany.
#   Linie moga byc przesuniete o 1-2 wzgledem tej instrukcji (pisanej na fe33ce8036) —
#   wiazacy jest PLIK, nie liczba (Z24).

# (W3) SIEDEM WOLACZY materializeDocumentArtifact + WSZYSCY wolacze generateDeck (produkcyjne, nie testy)
grep -rn "materializeDocumentArtifact(" server/src --include='*.ts' | grep -v '__tests__' | grep -v '\.test\.ts'
grep -rn "generateDeck(" server/src --include='*.ts' | grep -v '__tests__' | grep -v '\.test\.ts'
#   oczekiwane materializeDocumentArtifact: document-studio.routes.ts x2, work-canvas.routes.ts x1,
#   docGenerationRuntime.ts x2, chatTargetMappingService.ts x1, ideaHandoffService.ts x1 = 7.
#   oczekiwane generateDeck: presentations.routes.ts x1, deliverablesGenerationService.ts x1,
#   ORAZ artifactRegistryService.ts x1 (`presentationGeneratorService.generateDeck(...)`,
#   import dynamiczny) — TRZECI wolacz, ktorego karta odbioru 209 nie wymienila. Policz sam
#   i zapisz swoja liczbe, to jest miara, nie fakt objawiony.

# (W4) GENERATOR RAPOROW REPORT BUILDER — funkcja, dlugosc, i DWAJ wolacze produkcyjni
grep -n "^export async function generateFullReport\|return { totalTokens, generatedSections }" \
  server/src/services/reportGenerationService.ts
grep -rn "generateFullReport(" server/src --include='*.ts' | grep -v '__tests__' | grep -v 'aiAssessmentReportGenerator\|assessment-ai.routes'
sed -n '2619,2645p' server/src/routes/report-builder.routes.ts
#   oczekiwane: `generateFullReport` zaczyna sie ok. `:1575`, konczy `return` ok. `:1844`;
#   wolacze: `report-builder.routes.ts` (trasa `POST /:id/generate`) i `scheduledReportService.ts`
#   (import dynamiczny, job wewnetrzny). To jest Twoj punkt wpiecia.

# (W5) ★★ NAJWAZNIEJSZY POMIAR — czy zasieg raportu jest w ogole CZYTELNY z serwisu
grep -n "confidentiality" server/migrations/20260823_runtime_ddl_schema_convergence.sql
sed -n '1371,1436p' server/src/services/reportBuilderService.ts | grep -n "confidentiality\|id: row.id\|title: row.title"
#   oczekiwane: kolumna `confidentiality TEXT DEFAULT internal` ISTNIEJE w bazie (ALTER TABLE),
#   ale w mapowaniu `getReport()` (blok zwracajacy `report: {...}`) NIE MA linii `confidentiality:`.
#   Jesli to potwierdzisz: `reportData.report.confidentiality` w `generateFullReport` jest
#   ZAWSZE `undefined` i NIE WOLNO Ci na nim polegac — musisz zrobic wlasny SELECT.
#   Jesli obalisz (np. `getReport()` jednak mapuje to pole na Twoim markerze) — to jest
#   SUKCES dyzuru, zapisz to w Korektach i upros hook (mozesz uzyc `reportData.report.confidentiality`
#   bez wlasnego SELECT-a).

# (W6) SKAD BRAC TRESC RAPORTU DO INDEKSACJI
sed -n '78,103p' server/migrations/503_report_builder.sql
sed -n '2140,2151p' server/src/services/reportGenerationService.ts
#   oczekiwane: `report_builder_sections` ma `section_key, title, order_index, enabled,
#   generated_content, edited_content`; wzorzec skladania tresci z tych kolumn juz istnieje
#   w `getPublicReport` (`s.generatedContent || s.editedContent || ''`), sekcje filtrowane
#   `enabled` i sortowane `orderIndex`. To jest wzorzec dla Twojej funkcji budujacej `contentMd`.

# (W7) MANAGEMENT REPORTS — czy ma jakakolwiek kolumne poufnosci (do decyzji w R3)
sed -n '14,46p' server/migrations/271_management_reports_extended.sql
grep -n "router\.\(get\|post\)(" server/src/routes/managementReports.routes.ts | head -5
#   oczekiwane: kolumny `scope TEXT CHECK (scope IN (PROJECT, PORTFOLIO))` (poziom agregacji,
#   NIE poufnosc) i `share_token`/`share_expires_at` (link publiczny, inny mechanizm) —
#   ZADNEJ kolumny `confidentiality`/`visibility`/`is_private`. Policz sam, potwierdz albo obal.

# (W8) AI ASSESSMENT REPORT GENERATOR — czy w ogole trwale zapisuje wynik
sed -n '832,850p' server/src/routes/assessment/assessment-ai.routes.ts
grep -n "INSERT INTO\|dbRun\|queryRun" server/src/services/aiAssessmentReportGenerator.ts
#   oczekiwane: trasa robi `res.json(result)` wprost, `aiAssessmentReportGenerator.ts` ZERO
#   zapisow do bazy (zero `INSERT`/`dbRun`/`queryRun` na wynik raportu). Jesli potwierdzisz —
#   nie ma trwalego artefaktu z `id`, do ktorego mozna przypiac hook post-persist.

# (W9) CZY MIGRACJA FIX-209 I NAPRAWIONY WZORZEC TESTOWY SA JUZ NA TWOJEJ BAZIE
ls server/migrations/ | grep day209
grep -n "beforeEach\|beforeAll" server/src/services/knowledge/__tests__/artifactKnowledgeIndexer.pg.test.ts | head -6
sed -n '805,812p' tests/setup.ts
#   oczekiwane: `20260831_day209_knowledge_chunks_created_at.sql` ISTNIEJE; mock
#   `EmbeddingService.prototype.generateEmbedding` jest instalowany w `beforeEach` (NIE
#   `beforeAll`) w istniejacym pliku; `tests/setup.ts` linia 809 to `beforeEach(() => {` i
#   linia 811 to `vi.clearAllMocks();` — to jest PUlAPKA, ktora masz respektowac od pierwszego
#   testu, nie odkrywac ja na wlasnej skorze.
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day215-indeks-raportow-20260831` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6155`. Twój JEDYNY port harnessu to `5100 i 5101`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day215-pg`**. **ZAKAZANE:** `zajete 6012, 5433, 6047, 6054-6154, 5010-5099, 6404-6411 (zajete przez wczesniejsze dyzury i odbiory nadzorcy). ZABRONIONE na przod, nie bierz ich: 6156-6157, 5102-5105 (dyzury 216-217, moga biec rownolegle). Zakazane na stale: port 5000 (macOS Control Center), port 5037 (`adb`, serwer Androida), porty 5060-5061 (SIP/`ERR_UNSAFE_PORT`). Twoj WYLACZNY przydzial to baza `6155` i harness `5100 i 5101` — nic wiecej. Ta lista jest rozkazem pomiarowym, nie gwarancja — zweryfikuj `lsof -i` i `docker ps` przed startem i wpisz wynik do raportu`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `R1 idzie CALA za flaga `ENABLE_ARTIFACT_KNOWLEDGE_INDEX`, ktora JUZ ISTNIEJE (`server/src/config/FeatureFlags.ts:53`, `z.boolean().default(false)`; loader `:240-241`; helper `isArtifactKnowledgeIndexEnabled()` `:271-272`). ★★ TEN DYZUR NIE TWORZY NOWEJ FLAGI. Rekomendacja nadzorcy, ktora masz potwierdzic albo obalic pomiarem: raporty ida za TA SAMA flaga co dokumenty i decki, bo to JEDNA funkcja produktowa (`system odzywia sie praca`), nie trzy osobne. Jesli Twoj pomiar pokaze realny powod do osobnej flagi (np. ryzyko ktorego dokumenty/decki nie maja) — wolno Ci ja dodac, ale musisz to uzasadnic liczba/dowodem, nie wygoda, i zostaje ONA rowniez `default(false)`. Domyslny stan po tym dyzurze: identyczny jak dzis — `ENABLE_ARTIFACT_KNOWLEDGE_INDEX=false`, wiec produkcja i demo widza ZERO zmiany zachowania`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**` (w szczegolnosci `verifyToken` na `report-builder.routes.ts:241`), `server/src/services/KnowledgeService.ts` (`addDocument`, `processDocument`, `ensureKnowledgeSchema` — juz przystosowane przez 209 do `skipGlobalEmbeddingIndex`, NIE zmieniasz ich zachowania), `server/src/services/ai/tools/searchKnowledgeBase.ts` (`search_knowledge_base` — ochrona zasiegu ktora 209 udowodnil mutacja, NIE dotykasz), `server/src/services/ai/embeddingService.ts` (`EmbeddingService.generateEmbedding` — mockujesz w testach, nie zmieniasz w kodzie produkcyjnym), `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*`. ★★ ZADNEJ Z NICH NIE ZMIENIASZ — Twoj hook ma przez nie PRZECHODZIC (uzywajac `inferKnowledgeScope` i `KnowledgeService.processDocument(..., skipGlobalEmbeddingIndex)` DOKLADNIE tak, jak juz uzywaja ich dokumenty i decki), nie omijac ich i nie poszerzac`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY215_INDEKS_RAPORTOW_REPORT.md`. Nie zmieniasz zadnego `MODULE_ACCEPTANCE.md`. Uzasadnienie do potwierdzenia albo obalenia przez Ciebie w raporcie: flaga `ENABLE_ARTIFACT_KNOWLEDGE_INDEX` zostaje domyslnie OFF (identycznie jak po 209), wiec status modulu wobec wlasciciela sie nie zmienia — nie ma nowego stanu do zarejestrowania. Nie zmieniasz tez zadnego pliku architektury/koncepcji poza samym raportem dyzuru — w odroznieniu od dyzuru 207 (Teresa), ten dyzur NIE dotyka `ARCHITEKTURA_AGENTA_TERESY.md` ani zadnego innego dokumentu kanonicznego; jedynym dokumentem, ktory mozesz (nie musisz) dopisac, jest sama karta `docs/program/funkcje/ODBIOR_209.md` — a i tej NIE WOLNO Ci zmieniac (`Z14`-podobna ochrona, patrz tabela licencji), bo to cudzy, juz zamkniety zapis odbioru; jesli Twoj pomiar cokolwiek w niej obala, zapisz to w SWOIM raporcie, nie w cudzym dokumencie. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day215-indeks-raportow-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day215-indeks-raportow-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **ZAKAZ NOWEJ FLAGI — domyslnie.** Reuzywasz `ENABLE_ARTIFACT_KNOWLEDGE_INDEX`. Nowa flaga jest dozwolona WYLACZNIE jako STOP MERYTORYCZNY z dowodem, nigdy jako wygoda. ★★ **ZAKAZ ZMIANY SEMANTYKI `inferKnowledgeScope`, `indexDocumentArtifactForKnowledge`, `indexDeckArtifactForKnowledge`, `deckArtifactToKnowledgeMarkdown`** — Twoja praca w `artifactKnowledgeIndexer.ts` jest WYLACZNIE addytywna (nowa funkcja/e obok istniejacych), z JEDYNYM dozwolonym touchem istniejacego kodu: rozszerzenie unii `kind: 'document' | 'deck'` o `'report'` we WSPOLNEJ funkcji `indexArtifactForKnowledge`/`knowledgeDocumentId`, jesli Twoj projekt tego wymaga (dozwolone, bo jest to jedyny addytywny sposob dodania trzeciego rodzaju bez duplikowania calej funkcji). ★★ **ZAKAZ POLEGANIA NA `reportData.report.confidentiality` I NA `reportData.sections`** wewnatrz `generateFullReport` bez wlasnego swiezego odczytu — to jest zmierzona pulapka `W5`/`W6` tej instrukcji, nie hipoteza. ★★ **ZAKAZ NAPRAWY `ReportBuilderService.getReport()`** (dopisania mapowania `confidentiality:`) W TYM DYZURZE — plik jest TYLKO DO ODCZYTU (patrz tabela licencji); Twoj hook omija problem wlasnym SELECT-em, nie naprawia serwisu upstream, ktory moga rownolegle dotykac inne dyzury. ★★ **ZAKAZ IMPLEMENTACJI R3** — `management_reports` i `aiAssessmentReportGenerator` dostaja WYLACZNIE zmierzona decyzje w tabeli, zero kodu produkcyjnego dla nich w tym dyzurze, nawet jesli 'to by bylo latwe przy okazji'. ★★ **ZAKAZ ZMIANY `tests/setup.ts`, `vitest.config.ts`, `server/vitest.config.ts`** (`Z18`, najostrzejszy) — mockujesz WYLACZNIE we wlasnym pliku testowym, w `beforeEach`. ★★ **ZAKAZ DOTYKANIA `server/src/services/ai/tools/searchKnowledgeBase.ts` I `KnowledgeService.ts`** — ochrona zasiegu, ktora 209 udowodnil dziala, jest NIETYKALNA; Twoj dowod bezpieczenstwa dla raportow ma miec TA SAMA forme (mutacja `inferKnowledgeScope` -> czerwony test na wyciek), nie nowy mechanizm. ★★ **`Z31` — ZAKAZ PINOWANIA STRAZNIKA REALDB.** Wolasz `await assertRealPostgresTestEnvironment()` BEZ ARGUMENTOW. ★★ **`Z29` — DOWOD MUTACYJNY W OBIE STRONY**: zepsuj `inferKnowledgeScope` (np. na sztywno `'organization'`) -> test wycieku dla raportu MA poczerwieniec; cofnij (`cp` z `/private/tmp/cx-day215-indeks-raportow-scratch`, NIGDY `git stash` — `Z27`) -> test wraca na zielono, `git diff` po cofnieciu pusty. Oba wyniki i obie komendy w raporcie. ★★ **ZAKAZ RETRY W TESTACH BEZPIECZENSTWA** — kazdy plik testowy tego dyzuru: `--retry=0` w komendzie URUCHOMIENIA. ★★ **BRAMKA POWTARZALNOSCI: TRZY KOLEJNE ZIELONE PRZEBIEGI PELNEGO PLIKU** (nie pojedynczych testow `-t`), dla KAZDEGO nowego pliku testowego — to jest bezposrednia lekcja z FIX-209, nie formalnosc. ★★ **FLAGA ZOSTAJE DOMYSLNIE OFF** — zaden zrzut, zaden runtime z fladze ON na starcie procesu; jedyny dozwolony sposob ustawienia `ENABLE_ARTIFACT_KNOWLEDGE_INDEX=true` to zmienna srodowiskowa PRZY URUCHOMIENIU KONKRETNEGO testu (`Z10`, `Z11`). ★★ **Sprzatanie kontenera: `docker rm -f -v`.** ★★ **Zero polaczen do bazy zdalnej, demo, stagingu i produkcji** (`Z28`). ★★ **Zakaz naprawiania przez wyciszanie** (`@ts-ignore`, `.skip`, poszerzanie `exclude`, `--no-verify`) i zakaz usuwania zastanych testow. ★ **Nowe pliki w `tests/`-podobnych katalogach (`__tests__/`) wymagaja `git add -f`**, jesli katalog jest czesciowo ignorowany — sprawdz `git status --short` po kazdym commicie. ★ **`§0.4a` — pomiar zasiegu testow jest warunkiem oddania raportu** (`Z24`); zawezony wybor albo przepisanie cudzej liczby to zawyzenie i podstawa odrzucenia. | Dyzur 209 podlaczyl do bazy wiedzy AI dokumenty i decki, a raporty zostaly SWIADOMIE zostawione poza zakresem jako pozycja R3 (`docs/program/funkcje/ODBIOR_209.md:32`: `Poza zakresem: R3 (indeksacja raportow) — osobny dyzur`, potwierdzone tez w oryginalnym punkcie 5 karty odbioru: `R3 (inwentarz generatorow raportow) — sam wykonawca zadeklarowal zero implementacji; to POZA zakresem 209, nie liczyc jako dlug tego dyzuru. Jesli ma wejsc indeksacja raportow, to osobny dyzur bazujacy na reportGenerationService.ts (generateFullReport), wskazany przez wykonawce jako P1 kandydat`). To jest ten osobny dyzur. Raport jest artefaktem, w ktorym siedzi NAJWIECEJ wnioskow z pracy — synteza calego projektu — a dopoki nie wchodzi do indeksu, agent AI (Teresa) nie wie, co firma sama o sobie napisala, mimo ze widzi surowe dokumenty i decki. ★★ Uwaga o stanie repo: karta `ODBIOR_209.md` w pierwszej linii (`★ SCALONE PO FIX-209`) mowi wprost, ze diagnoza zawodnosci z pierwotnej karty ponizej byla BLEDNA — prawdziwa przyczyna to `tests/setup.ts` globalny `clearAllMocks()` w `beforeEach`, nie cichy `catch{}`. Marker tego dyzuru (`fe33ce8036`) jest PO scaleniu FIX-209 (`git log` potwierdza: `b5aa4dae54 merge: dyzur 209 + FIX-209`, `bee6ebf5bd fix(day209): real migration for knowledge_chunks.created_at`, `bd8d16f6f9 test(day209): real HTTP end-to-end proof`), wiec migracja `knowledge_chunks.created_at` i naprawiony wzorzec testowy JUZ SA na Twojej bazie — zweryfikuj to sam (`W9` nizej), nie zakladaj |

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
cd /private/tmp/cx-day215-indeks-raportow

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day215-pg psql -U postgres -d cx215 \
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
cd /private/tmp/cx-day215-indeks-raportow

docker run -d --name cx-day215-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx215 \
  -p 127.0.0.1:6155:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day215-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6155/cx215 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6155/cx215 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day215-indeks-raportow && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6155/cx215 \
JWT_SECRET=cx215-test-secret-do-not-reuse \
npx vitest run server/src/services/knowledge/__tests__ oraz server/src/routes/__tests__ oraz server/src/services/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day215-indeks-raportow-artefakty/day215-indeks-raportow.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day215-indeks-raportow && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/services/knowledge/__tests__ oraz server/src/routes/__tests__ oraz server/src/services/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day215-indeks-raportow-artefakty/day215-indeks-raportow.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day215-indeks-raportow/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day215-pg psql -U postgres -d cx215 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day215-pg`.
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
> **(e) ★★ **Pierwsza, najgrozniejsza, ZMIERZONA 31.08 — dokladnie ta sama, ktora zdiagnozowala odbior 209 na nowo: globalny `beforeEach(vi.clearAllMocks())` w `tests/setup.ts:809-811` kasuje IMPLEMENTACJE mocka ustawiona w `beforeAll`, nie tylko historie wywolan.** Objaw: pierwszy test w Twoim NOWYM pliku przechodzi (bo `beforeAll` jeszcze nie zostal wyczyszczony), kazdy kolejny cicho idzie prawdziwa sciezka, trafia w globalny mock `fetch` z `tests/setup.ts` i dostaje pusta odpowiedz — embedding pusty, straznik `embedding.length > 0` pomija zapis, test wyglada na 'czasem przechodzi'. Instaluj mock OD PIERWSZEGO commita w `beforeEach`, nie w `beforeAll` — nie masz prawa 'odkryc' tej pulapki na wlasnej skorze, jest juz opisana i naprawiona wzorcowo w `artifactKnowledgeIndexer.pg.test.ts:44-63`. ★★ **Druga: `reportData.report.confidentiality` jest CICHO `undefined`.** `ReportBuilderService.getReport()` czyta kolumne `confidentiality` z bazy (ISTNIEJE, `20260823_runtime_ddl_schema_convergence.sql:22`) ale NIE mapuje jej do zwracanego obiektu (`reportBuilderService.ts:1398-1432`) — to jest DOKLADNIE ten sam ksztalt bledu, ktory ten sam plik opisuje wlasnym komentarzem przy `sourceRefs` (`OGNIWO 8`: `zapis bez odczytu = ten sam efekt co brak zapisu`). Jesli napiszesz `const scope = inferKnowledgeScope(reportData.report.confidentiality)` bez wlasnego SELECT-a, KAZDY raport — niezaleznie od realnej poufnosci wybranej w `IntentStep.tsx` — dostanie `scope='organization'`, bo `undefined` normalizuje sie do `'internal'` w `inferKnowledgeScope` (`:16`, `String(confidentiality || 'internal')`). To jest CICHY WYCIEK KLASYFIKACJI, nie awaria — test moze wygladac na zielony, bo faktycznie nic sie nie wywala, po prostu KAZDY raport ladowalby jak wewnetrzny. Test bezpieczenstwa MUSI seedowac raport z `confidentiality='confidential'` NAPRAWDE zapisanym w bazie (nie przez `reportData.report`, tylko przez bezposredni `INSERT`/`UPDATE ... SET confidentiality = 'confidential'`) i sprawdzic realny efekt koncowy przez `search_knowledge_base`, nie stan posredni. ★★ **Trzecia: `confidentiality` NIE ZAWSZE trafia do bazy przy tworzeniu raportu.** `reportBuilderService.ts` ma DWIE galezie INSERT-a (`:1112-1160`) — 'standardowa' (bez pol V3) w ogole NIE WYMIENIA kolumny `confidentiality` w liscie kolumn INSERT-a, wiec wpis dostaje DEFAULT bazy `'internal'`; TYLKO galaz `hasV3Configuration` (ktorykolwiek z `reportTypeV3`/`goalV3`/`communicationRegister`/`density`/`periodFrom`/`periodTo`/`confidentiality` ustawiony) zapisuje realna wartosc. Front (`IntentStep.tsx:539-544`) ustawia `confidentiality` w tym samym kroku wizarda co inne pola V3, wiec w PRAKTYCE galaz V3 powinna sie uruchamiac — ale to jest ZALOZENIE do potwierdzenia pomiarem (przejdz caly wizard w testcie albo przesledz kod wolajacy `createReport`), nie fakt objawiony. Jesli obalisz i znajdziesz sciezke, ktora tworzy raport z realna poufnoscia ale trafia w galaz 'standardowa' — to jest realna luka do zgloszenia (raport z wybrana poufnoscia 'confidential' dostalby mimo to `'internal'` z DEFAULT-u bazy), zapisz to jako `DO DECYZJI WLASCICIELA`, NIE naprawiaj `reportBuilderService.ts` (poza zakresem). ★★ **Czwarta: hook jest fire-and-forget, test HTTP e2e ktory nie czeka zmierzy race condition, nie brak dzialania.** Oba istniejace hooki (`documentStudioService.ts:1263`, `presentationGeneratorService.ts:2430`) uzywaja `void ...` — odpowiedz HTTP wraca ZANIM indeksacja sie skonczy. Twoj test `R2` musi poczekac (polling z timeoutem, kilka sekund) PO otrzymaniu odpowiedzi HTTP, zanim odpyta `knowledge_chunks`/`knowledge_docs` — inaczej test bedzie flaky w zalezny od tego, kto akurat wygra wyscig, i moze dawac falszywy `FAIL` (test zbyt niecierpliwy) rownie latwo jak falszywy `PASS` (przypadkowe trafienie w czasie). ★★ **Piata: `management_reports.scope` to FALSZYWY PRZYJACIEL nazwy.** Kolumna `scope` na tej tabeli (`271_management_reports_extended.sql:18`, `CHECK (scope IN (PROJECT, PORTFOLIO))`) NIE ma nic wspolnego z `ArtifactKnowledgeScope` ('user'/'organization') z `artifactKnowledgeIndexer.ts` — to poziom agregacji raportu (projekt vs caly portfel), nie poufnosc. Jesli zobaczysz `scope` w kontekscie `management_reports` i machinalnie zalozysz, ze to ta sama koncepcja co w hooku wiedzy — to jest gotowy blad tego dyzuru; nazwij to jawnie w tabeli R3, zeby nikt po Tobie nie wpadl w te sama pulapke. ★★ **Szosta: trzeci, nieujeety w karcie 209 wolacz `generateDeck`.** `server/src/services/v8/artifactRegistryService.ts:4326` woal `presentationGeneratorService.generateDeck(...)` przez dynamiczny import — karta odbioru 209 wymienia tylko `presentations.routes.ts` i `deliverablesGenerationService.ts`. To nie zmienia Twojego zakresu (deck-owy hook juz istnieje i dziala niezaleznie od tego, ILU ma wolaczy), ale jest to fakt do zapisania w `TWIERDZENIA NIEZWERYFIKOWANE`/`Korekty wobec instrukcji`, bo poprzedni dowod byl niepelny. ★★ **Siodma: dwa pliki o niemal identycznej nazwie.** `server/src/routes/assessment-reports.routes.ts` (2898 linii, realny router) i `server/src/routes/assessment/assessment-reports.routes.ts` (12 linii, cienki alias re-eksportujacy TEN SAM router pod `/api/assessment/reports`) to NIE SA dwie niezalezne sciezki generowania — jesli je pomylisz i policzysz jako dwa osobne generatory w tabeli R3, zawyzysz inwentarz. Zweryfikuj przez `cat`, nie przez samo istnienie pliku.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day215-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day215-indeks-raportow-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 — HOOK RAPORTOW (rdzen): nowa funkcja `indexReportArtifactForKnowledge` w `server/src/services/knowledge/artifactKnowledgeIndexer.ts`, addytywna, ANALOGICZNA do `indexDocumentArtifactForKnowledge`/`indexDeckArtifactForKnowledge` (`:62-68`) — reuzywa `inferKnowledgeScope` BEZ ZMIAN, generuje `documentId` wzorem `knowledgeDocumentId('report', reportId)` (rozszerz union `kind: 'document' | 'deck'` o `'report'` — to jedyna zmiana sygnatury w istniejacych funkcjach, wszystko inne addytywne). Wpiecie: w `server/src/services/reportGenerationService.ts`, funkcja `generateFullReport` (`:1575-1844`), TUZ PRZED `return { totalTokens, generatedSections };` (`:1844`), za `if (isArtifactKnowledgeIndexEnabled())`, `void ... .catch(logger.warn)` fire-and-forget wzorem dokumentu (`documentStudioService.ts:1263-1278`), NIE deckowym `void (async()=>{...})()` (bo raport i tak potrzebuje wlasnego async bloku do dwoch swiezych SELECT-ow — patrz nizej). ★★ ZASIEG (sedno bezpieczenstwa tej pozycji): `report_builder_reports` MA kolumne `confidentiality TEXT DEFAULT internal` (migracja `20260823_runtime_ddl_schema_convergence.sql:22`) — ale `ReportBuilderService.getReport()` (`reportBuilderService.ts:1371-1454`) NIE mapuje `row.confidentiality` do zwracanego `ReportRecord` (dowod: przeczytaj cale mapowanie `:1398-1432`, pola `confidentiality` tam NIE MA). `reportData.report.confidentiality` wewnatrz `generateFullReport` jest wiec zawsze `undefined`. NIE WOLNO Ci polegac na tym polu ani go 'naprawiac' w `reportBuilderService.ts` (poza zakresem, plik TYLKO DO ODCZYTU w tym dyzurze — patrz tabela licencji) — masz zrobic WLASNY, bezposredni, JEDNOKOLUMNOWY odczyt `SELECT confidentiality FROM report_builder_reports WHERE id = ? AND organization_id = ?` tuz przed wywolaniem hooka, analogicznie do tego, jak deck-owy hook (`presentationGeneratorService.ts:2432-2438`) robi wlasny swiezy SELECT zamiast ufac stanowi sprzed zapisu. Tresc do zaindeksowania (`contentMd`): NIE uzywaj `reportData.sections` z poczatku funkcji (to zrzut SPRZED generacji — sekcje jeszcze puste) ani `previousSectionsSummaries` (ucieta do 300 znakow, `:1762-1768`) — zrob DRUGI swiezy odczyt: `SELECT section_key, title, generated_content, edited_content, order_index FROM report_builder_sections WHERE report_id = ? AND enabled = true ORDER BY order_index ASC` (schema `503_report_builder.sql:78-103`, ta sama para kolumn `generated_content`/`edited_content` ktorej uzywa `getPublicReport` w `reportGenerationService.ts:2149`, `s.generatedContent || s.editedContent || ''`) i sklej markdown `## {title}\n\n{content}` per sekcja, analogicznie do `deckArtifactToKnowledgeMarkdown` (`:85-113`), ale jako NOWA funkcja (np. `reportArtifactToKnowledgeMarkdown`) — decyzja nazwy i ksztaltu nalezy do Ciebie, ma byc eksportowana i testowalna osobno jak deckowa. R1 KONCZY SIE, gdy: `indexReportArtifactForKnowledge` istnieje i ma dokladnie ten sam kontrakt zwrotny co dwie siostrzane funkcje (`{documentId, scope, chunkCount}`); hook w `generateFullReport` jest za flaga, fire-and-forget, nie blokuje odpowiedzi HTTP; zasieg raportu confidential/restricted daje `scope==='user'` i `skipGlobalEmbeddingIndex=true` (dokladnie jak w `:52-57` istniejacego pliku); mutacja `inferKnowledgeScope` na sztywno `'organization'` zapala CZERWONY test analogiczny do Mutacji 1 z odbioru 209 (`ODBIOR_209.md` — `does not return user A private content to user B through search_knowledge_base`), Twoj test ma miec analogiczny scenariusz DLA RAPORTU, nie kopiowac dokumentowy 1:1 bez uruchomienia. R2 — DOWOD HTTP END-TO-END: mirror `server/src/routes/__tests__/document-studio-knowledge-index.http.pg.test.ts` (caly plik, wzorzec montowania realnego routera + realny JWT + realny Postgres, `assertRealPostgresTestEnvironment()` BEZ argumentow — `Z31`) — nowy plik dla `POST /api/report-builder/:id/generate`: seed organizacji + usera + REALNY raport (INSERT `report_builder_reports` ze statusem gotowym do generacji + co najmniej jedna wlaczona sekcja w `report_builder_sections`), realne zadanie HTTP z podpisanym JWT, `ENABLE_ARTIFACT_KNOWLEDGE_INDEX=true` w SRODOWISKU URUCHOMIENIA (nigdy w kodzie), ORAZ — bo hook jest fire-and-forget — krotki `await` / polling (np. `waitForCondition`, max kilka sekund) PO odpowiedzi HTTP, zanim zaczniesz odpytywac `knowledge_chunks`/`knowledge_docs`/`ai_knowledge_embeddings`; bez tego testu bedziesz mierzyl race condition, nie brak indeksacji. Asercja koncowa: wpis w `knowledge_docs` z poprawnym `organization_id`/`owner`/`scope`, tresc WYSZUKIWALNA przez `search_knowledge_base` (ten sam konsument co 209 uzyl). R3 — MAPA DWOCH POZOSTALYCH GENERATOROW RAPORTOW (zero implementacji, tylko zmierzona decyzja z powodem — analogicznie do tabeli widm z dnia D-15, ale tu sa tylko DWIE pozycje): (a) `management_reports` (`server/src/repositories/ManagementReportRepository.ts`, `server/src/services/managementReportsService.ts`, trasa `POST /api/management-reports/generate` w `server/src/routes/managementReports.routes.ts:52`, montowana `server/src/Gateway.ts:1189`) — ZMIERZ, czy tabela ma jakakolwiek kolumne poufnosci/widocznosci (schema `271_management_reports_extended.sql:14-46` — na dzien pisania tej instrukcji jedyne pole zwiazane z dostepnoscia to `scope TEXT CHECK (scope IN (PROJECT, PORTFOLIO))`, ktore NIE JEST poufnoscia tylko poziomem agregacji, i `share_token`/`share_expires_at`, publiczny link a nie klasyfikacja) — jesli potwierdzisz brak podstawy do bezpiecznego wnioskowania `ArtifactKnowledgeScope`, decyzja ma brzmiec `DEFER — brak kolumny poufnosci, budowa klasyfikacji od zera to nowa powierzchnia produktowa/bezpieczenstwa, poza jednym dyzurem` (zasada `nie poszerzaj dostepu gdy niejednoznaczne`, `CZESC A.8`); jesli natomiast znajdziesz kolumne poufnosci, ktorej ja nie znalazlem — hookuj tak samo jak R1 i zapisz to jako OBALENIE tej tezy; (b) `aiAssessmentReportGenerator.generateFullReport` (`server/src/services/aiAssessmentReportGenerator.ts:157`) wolany z `POST /api/assessment/:projectId/ai/reports/full` (`server/src/routes/assessment/assessment-ai.routes.ts:832-848`) — ZMIERZ, czy wynik trafia do jakiejkolwiek tabeli z trwalym `id`; jesli (jak wskazuje pierwsze czytanie routera) `res.json(result)` idzie WPROST do klienta bez zapisu — nie ma tu ARTEFAKTU z tozsamoscia, do ktorego mozna przypiac hook post-persist (nie ma czego indeksowac tym samym wzorcem), decyzja `NIE DOTYCZY — brak trwalego artefaktu, nie 'defer' tylko strukturalny brak przedmiotu`; jesli obalisz i znajdziesz trwaly zapis — zapisz to jako obalenie i zaproponuj plan (bez implementacji w tym dyzurze, chyba ze to jest tania, jednoznaczna zmiana — Twoja decyzja z uzasadnieniem). Obie decyzje R3 wchodza jako TABELA do raportu (kolumny: generator | trwaly artefakt? | pole poufnosci? | trasa HTTP | decyzja | powod) — ZERO implementacji w R3, to jest miara i wpis, nie kod. R4 — BRAMKA POWTARZALNOSCI I HIGIENA MOCKOW OD POCZATKU: kazdy nowy test z mockiem `EmbeddingService.prototype.generateEmbedding` (albo jakikolwiek inny `vi.spyOn(...).mockResolvedValue`) INSTALUJESZ W `beforeEach` swojego pliku, NIGDY w `beforeAll` — `tests/setup.ts:809-811` ma globalny `beforeEach(() => vi.clearAllMocks())`, ktory w tej wersji Vitest kasuje IMPLEMENTACJE ustawiona w `beforeAll`, nie tylko historie wywolan (to byla prawdziwa, zmierzona przyczyna zawodnosci 209 — NIE cichy `catch`, jak pierwotnie sadzono; wzorcowa naprawa jest juz w repo: `server/src/services/knowledge/__tests__/artifactKnowledgeIndexer.pg.test.ts:56-63`, przeczytaj ten komentarz w calosci przed napisaniem wlasnego testu). Bramka: KAZDY nowy plik testowy przechodzi TRZY KOLEJNE PRZEBIEGI PELNEGO PLIKU (nie pojedynczych `-t`), na swiezej bazie, z tymi samymi wynikami za kazdym razem — wklej wszystkie trzy przebiegi do raportu, nie tylko ostatni`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6155` albo `5100 i 5101` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6155` albo `5100 i 5101`** (`Z7`).

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

Dyżur 209 podłączył dokumenty i decki (dwa z trzech typów generowanych artefaktów)
do bazy wiedzy AI. Raporty zostały świadomie zostawione poza zakresem, jako pozycja
`R3` w karcie odbioru:

> Poza zakresem: R3 (indeksacja raportów) — osobny dyżur.
> (`docs/program/funkcje/ODBIOR_209.md:32`)

i, w oryginalnej (pierwotnej) karcie odbioru dołączonej do tego samego pliku:

> R3 (inwentarz generatorów raportów) — sam wykonawca zadeklarował „zero
> implementacji”; to POZA zakresem 209 (…). Jeśli ma wejść „indeksacja raportów”,
> to osobny dyżur bazujący na `reportGenerationService.ts` (`generateFullReport`,
> wskazany przez wykonawcę jako P1 kandydat).
> (`docs/program/funkcje/ODBIOR_209.md:226-230`)

Ten dyżur jest tym osobnym dyżurem. Po nim pętla „system odżywia się pracą” domyka
się na wszystkich trzech typach generowanych artefaktów (dokument, deck, raport).
Raport jest artefaktem, w którym siedzi najwięcej wniosków z całego projektu —
synteza, nie surowy materiał — a dopóki nie wchodzi do indeksu, Teresa nie wie, co
firma sama o sobie napisała, mimo że widzi surowe dokumenty i decki.

★★ **Uwaga o stanie repo, którą musisz zweryfikować, zanim uznasz cokolwiek za
brakujące.** Nagłówek `docs/program/funkcje/ODBIOR_209.md:1` (`★ SCALONE PO
FIX-209`) mówi wprost, że diagnoza zawodności z pierwotnej karty niżej w tym samym
pliku była **błędna** — prawdziwą przyczyną nie był cichy `catch {}`, tylko globalny
`beforeEach(vi.clearAllMocks())` w `tests/setup.ts`, który kasuje **implementacje**
mocków ustawionych w `beforeAll`. Marker tego dyżuru (`fe33ce8036`) jest **po**
scaleniu FIX-209 — `git log` na markerze pokazuje `b5aa4dae54 merge: dyżur 209 +
FIX-209`, `bee6ebf5bd fix(day209): real migration for knowledge_chunks.created_at`,
`bd8d16f6f9 test(day209): real HTTP end-to-end proof`. Migracja
`knowledge_chunks.created_at` i naprawiony wzorzec testowy (mock w `beforeEach`)
**już są** na Twojej bazie. Zweryfikuj to komendą `W9` w `§0.1`, nie zakładaj.

## Pomiar wykonany przy pisaniu tej instrukcji na SHA `fe33ce8036`

Wszystko poniżej zweryfikuj sam — to rozkaz pomiarowy, nie prawda objawiona.
Obalenie którejkolwiek pozycji jest sukcesem dyżuru.

**(K1) Hook do naśladowania jest mały i ma jasny kontrakt.**
`server/src/services/knowledge/artifactKnowledgeIndexer.ts` ma 113 linii:
`inferKnowledgeScope` (`:15-20`, `confidential`/`restricted` → `'user'`, reszta →
`'organization'`), `indexDocumentArtifactForKnowledge`/`indexDeckArtifactForKnowledge`
(`:62-68`, zwracają `{documentId, scope, chunkCount}`), `deckArtifactToKnowledgeMarkdown`
(`:85-113`, ekstrakcja tekstu z JSON-a decka). Twoja praca jest **addytywna**: nowa
funkcja `indexReportArtifactForKnowledge` obok dwóch istniejących.

**(K2) Oba dzisiejsze hooki są fire-and-forget, nie blokują odpowiedzi HTTP.**
Dokument: `documentStudioService.ts:1263-1278`, `void
indexDocumentArtifactForKnowledge(...).catch(logger.warn)`, za `if
(isArtifactKnowledgeIndexEnabled())`. Deck: `presentationGeneratorService.ts:2430-2455`,
własny **świeży** `SELECT title, confidentiality, deck_json, unified_json,
generated_by FROM presentation_decks WHERE id = ? AND organization_id = ? AND
status = 'ready'` — deck NIE ufa stanowi sprzed zapisu, robi nowy odczyt po
`UPDATE ... SET status = 'ready'` (`:2415`). To jest wzorzec, który masz powtórzyć
dla raportu, nie wzorzec dokumentu (dokument ma prostszy przypadek — treść
przychodzi już złożona w tej samej funkcji, bez oddzielnego `UPDATE`+odczyt).

**(K3) Flaga już istnieje, jest realna, nie jest fantomem.**
`ENABLE_ARTIFACT_KNOWLEDGE_INDEX`: schema `server/src/config/FeatureFlags.ts:53`
(`z.boolean().default(false)`), loader `:240-241`
(`process.env.ENABLE_ARTIFACT_KNOWLEDGE_INDEX === 'true'`), helper eksportowany
`isArtifactKnowledgeIndexEnabled()` `:271-272`. ★ Linie są przesunięte o jedną
wobec karty odbioru 209 (tam `:52`, `:234-238`, `:270-272`) — inny commit między
scaleniami przesunął plik o jedną linię w górę. Wiążący jest **plik**, nie liczba
z karty (`Z24`). Rekomendacja nadzorcy: raporty idą za **tą samą** flagą — patrz
uzasadnienie w `POZYCJE_Z_FLAGAMI` §0.1 i w R1 niżej.

**(K4) Prawdziwy generator raportów ma dwóch produkcyjnych wołaczy i realną
trasę HTTP — dokładnie ten sam kształt co dokumenty/decki.**
`reportGenerationService.ts`, funkcja `generateFullReport` (`:1575-1844`, kończy
się `return { totalTokens, generatedSections };` na `:1844`), wołana z:
`report-builder.routes.ts:2625` (trasa produkcyjna `POST
/api/report-builder/:id/generate`, `:2619`) i `scheduledReportService.ts:553`
(job wewnętrzny, import dynamiczny). Router ma własne `router.use(verifyToken)`
(`:241`) i jest zamontowany w `server/src/Gateway.ts:268` + `:1176` — realny
`ApiGateway`, nie test wstrzykujący zależności (`Z22`).

**(K5) ★★ Zasięg raportu NIE JEST czytelny ze zwykłej ścieżki serwisu — to jest
sedno bezpieczeństwa tej pozycji.** `report_builder_reports` ma kolumnę
`confidentiality TEXT DEFAULT 'internal'`
(`server/migrations/20260823_runtime_ddl_schema_convergence.sql:22`). Ale
`ReportBuilderService.getReport()` (`reportBuilderService.ts:1371-1454`) **nie
mapuje** `row.confidentiality` do zwracanego `ReportRecord` — pole go tam po
prostu nie ma. `reportData.report.confidentiality` wewnątrz `generateFullReport`
jest więc **zawsze `undefined`**. Ten sam plik ma już własny komentarz o tym
dokładnym kształcie błędu, przy polu `sourceRefs` (`OGNIWO 8`, ok. `:1417-1424`):
„zapis bez odczytu = ten sam efekt co brak zapisu”. Konsekwencja: jeśli hook
przeczyta `reportData.report.confidentiality` bez własnego odczytu, `inferKnowledgeScope`
dostanie `undefined`, znormalizuje je do `'internal'` (`:16`,
`String(confidentiality || 'internal')`) i **każdy** raport — niezależnie od
realnej poufności wybranej przez konsultanta — wyląduje w indeksie jako
organizacyjny. To nie jest awaria, którą coś wywala — to cichy błąd
klasyfikacji, wygląda na „działa”, bo nic nie rzuca wyjątku.

**(K6) Zapis `confidentiality` do bazy jest realny, ale warunkowy.**
`reportBuilderService.ts` ma dwie gałęzie `INSERT INTO report_builder_reports`
(`:1112-1160`): „standardowa” (`:1128-1143`) w ogóle nie wymienia kolumny
`confidentiality` w liście kolumn — wpis dostaje `DEFAULT` bazy `'internal'`;
tylko gałąź `hasV3Configuration` (którykolwiek z `reportTypeV3`/`goalV3`/
`communicationRegister`/`density`/`periodFrom`/`periodTo`/`confidentiality`
ustawiony, `:1112-1118`) zapisuje realną wartość (`:1147-1160`). Front
(`src/components/ReportBuilder/steps/IntentStep.tsx:539-544`, typ
`Confidentiality = 'confidential' | 'internal' | 'public'`) ustawia
`confidentiality` w tym samym kroku wizarda co inne pola V3 — więc w praktyce
gałąź V3 powinna się uruchamiać. **To jest założenie do potwierdzenia pomiarem
przez Ciebie**, nie fakt objawiony (`W5`/`T8` niżej).

**(K7) Treść do indeksacji trzeba złożyć samemu, ze świeżego stanu — nie z
`reportData` z początku funkcji.** `reportData.sections` w `generateFullReport`
jest zrzutem **sprzed** generacji (pobranym na `:1580-ok.`, zanim pętla
generująca w ogóle ruszy) — sekcje tam są puste albo stare.
`previousSectionsSummaries` (budowane w pętli, `:1762-1768`) jest ucięte do 300
znaków na sekcję — za mało na pełną treść. Wzorzec składania pełnej treści z
kolumn `generated_content`/`edited_content` **już istnieje** w tym samym pliku:
`getPublicReport` (`:2149`, `s.generatedContent || s.editedContent || ''`), po
sekcjach filtrowanych `enabled` i posortowanych `orderIndex`. To jest Twój wzorzec.

**(K8) Poza Report Builderem istnieją jeszcze DWA generatory nazywające się
„raport” — żaden z nich nie pasuje do wzorca hooka post-persist w tym dyżurze,
i obie decyzje muszą wejść do raportu z powodem, nie zniknąć po cichu.**

- `management_reports` (moduł „Management Reports”:
  `server/src/repositories/ManagementReportRepository.ts`,
  `server/src/services/managementReportsService.ts`, trasa `POST
  /api/management-reports/generate`, `server/src/routes/managementReports.routes.ts:52`,
  montowana `server/src/Gateway.ts:1189`). Schema
  (`server/migrations/271_management_reports_extended.sql:14-46`) ma kolumnę
  `scope TEXT CHECK (scope IN ('PROJECT', 'PORTFOLIO'))` — **to nie jest
  poufność, to poziom agregacji** (raport na jeden projekt vs. na cały portfel).
  Jest też `share_token`/`share_expires_at` — publiczny link, inny mechanizm.
  **Żadnej kolumny `confidentiality`/`visibility`/`is_private` nie znalazłem.**
  Bez podstawy klasyfikacji nie ma jak bezpiecznie wywnioskować
  `ArtifactKnowledgeScope` — budowa takiej klasyfikacji od zera byłaby nową
  powierzchnią produktową/bezpieczeństwa, nie mieści się w jednym dyżurze
  indeksacji.
- `aiAssessmentReportGenerator.generateFullReport`
  (`server/src/services/aiAssessmentReportGenerator.ts:157`), wołany z `POST
  /api/assessment/:projectId/ai/reports/full`
  (`server/src/routes/assessment/assessment-ai.routes.ts:832-848`). Trasa robi
  `res.json(result)` **wprost do klienta** — nie znalazłem żadnego `INSERT`/
  `dbRun`/`queryRun` zapisującego wynik do trwałej tabeli z własnym `id`. Bez
  trwałego artefaktu nie ma czego zaindeksować „po zapisie” — nie ma zapisu.

**(K9) Dwa pliki o niemal identycznej nazwie to JEDNA ścieżka, nie dwie.**
`server/src/routes/assessment-reports.routes.ts` (2898 linii, realny router) i
`server/src/routes/assessment/assessment-reports.routes.ts` (12 linii) — drugi
plik **re-eksportuje ten sam router** pod `/api/assessment/reports`
(`import assessmentReportsRouter from '../assessment-reports.routes.js'; router.use(assessmentReportsRouter);`).
To nie są dwa niezależne generatory raportów.

**(K10) `drdReportGrounding.ts` czyta z bazy wiedzy DO raportu, nie zapisuje
raport DO bazy wiedzy.** Jest to strona RAG-retrieval (`server/src/services/report/drdReportGrounding.ts`,
cytuje `knowledge/tool-kb/drd/methodology/v1/*` przy narracji DRD) — kierunek
odwrotny do tego dyżuru. Nie jest kandydatem na hook; jest dowodem, że ścieżka
odczytu z wiedzy do raportu już istnieje po drugiej stronie procesu.

# 2. TEZY ZLECENIA

Każda z nich to rozkaz pomiarowy. Numery linii są z SHA `fe33ce8036` — jeśli u
Ciebie są inne, wiążący jest plik (`Z24`), a rozbieżność wpisujesz do raportu.

- **T1.** `artifactKnowledgeIndexer.ts` ma 113 linii, eksportuje
  `inferKnowledgeScope`, `indexDocumentArtifactForKnowledge`,
  `indexDeckArtifactForKnowledge`, `deckArtifactToKnowledgeMarkdown`. Zero
  eksportu dla raportów. **Policz sam.**
- **T2.** Hook dokumentu jest w `documentStudioService.ts:1263-1278`, hook decka
  w `presentationGeneratorService.ts:2430-2455`. Oba za
  `isArtifactKnowledgeIndexEnabled()`, oba fire-and-forget (`void ...`).
- **T3.** `ENABLE_ARTIFACT_KNOWLEDGE_INDEX` ma `default(false)` w schemacie
  (`FeatureFlags.ts:53`) i helper `isArtifactKnowledgeIndexEnabled()`
  (`:271-272`) czytający `process.env` dynamicznie przy każdym wywołaniu — nie
  jest zcache'owana, więc test może ją ustawić przed każdym uruchomieniem.
- **T4.** `materializeDocumentArtifact` ma dokładnie tyle produkcyjnych
  wołaczy, ile sam policzysz — karta 209 podała 7. `generateDeck` ma **co
  najmniej trzech** wołaczy produkcyjnych: `presentations.routes.ts`,
  `deliverablesGenerationService.ts` i — nieujęty w karcie 209 —
  `server/src/services/v8/artifactRegistryService.ts:4326` (import dynamiczny).
  **Policz oba sam.**
- **T5.** `reportGenerationService.generateFullReport` (`:1575-1844`) ma dwóch
  produkcyjnych wołaczy: `report-builder.routes.ts:2625` (trasa `POST
  /api/report-builder/:id/generate`) i `scheduledReportService.ts:553`.
- **T6.** ★★ `report_builder_reports.confidentiality` **istnieje w bazie**
  (migracja `20260823_runtime_ddl_schema_convergence.sql:22`), ale
  `ReportBuilderService.getReport()` **nie mapuje** tego pola do zwracanego
  obiektu (`reportBuilderService.ts:1371-1454`). Zweryfikuj to bezpośrednim
  czytaniem bloku mapowania — nie ufaj streszczeniu.
- **T7.** Wzorzec budowy treści z sekcji raportu do markdown już istnieje w
  `getPublicReport` (`reportGenerationService.ts:2149`,
  `s.generatedContent || s.editedContent || ''`), po sekcjach `enabled`,
  posortowanych `orderIndex` (schema `503_report_builder.sql:78-103`).
- **T8.** Zapis `confidentiality` do bazy przy tworzeniu raportu zależy od
  gałęzi INSERT-a (`reportBuilderService.ts:1112-1160`) — „standardowa” gałąź
  go pomija (dostaje `DEFAULT` bazy), gałąź `hasV3Configuration` go zapisuje.
  Front (`IntentStep.tsx:539-544`) ustawia `confidentiality` razem z innymi
  polami V3. **Zweryfikuj, czy to w praktyce zawsze trafia w gałąź V3** —
  jeśli nie, to jest realna luka do zgłoszenia (raport z wybraną poufnością
  „confidential” mógłby i tak dostać `'internal'` z DEFAULT-u), nie coś do
  naprawienia w tym dyżurze.
- **T9.** `management_reports` (`271_management_reports_extended.sql:14-46`)
  nie ma kolumny poufności/widoczności; ma `scope` (PROJECT/PORTFOLIO,
  poziom agregacji, **fałszywy przyjaciel nazwy** względem
  `ArtifactKnowledgeScope`) i `share_token`/`share_expires_at` (link
  publiczny).
- **T10.** `aiAssessmentReportGenerator.generateFullReport`
  (`aiAssessmentReportGenerator.ts:157`), wołany z
  `assessment-ai.routes.ts:832-848`, zwraca wynik przez `res.json(result)`
  bez zapisu do trwałej tabeli z własnym `id`. **Zweryfikuj brak zapisu sam**
  (grep po `INSERT`/`dbRun`/`queryRun` w tym pliku).
- **T11.** `server/src/routes/assessment/assessment-reports.routes.ts` (12
  linii) jest cienkim aliasem re-eksportującym
  `server/src/routes/assessment-reports.routes.ts` (2898 linii) pod
  `/api/assessment/reports` — to JEDNA ścieżka, nie dwie.
- **T12.** `tests/setup.ts:809-811` ma globalny `beforeEach(() =>
  vi.clearAllMocks())`. Wzorcowy, już naprawiony plik testowy
  (`artifactKnowledgeIndexer.pg.test.ts`) instaluje mock
  `EmbeddingService.prototype.generateEmbedding` w `beforeEach` (nie
  `beforeAll`), z komentarzem wyjaśniającym dlaczego — przeczytaj go w
  całości przed napisaniem własnego testu.
- **T13.** Migracja `20260831_day209_knowledge_chunks_created_at.sql` jest
  już scalona na Twoim markerze — `knowledge_chunks.created_at` istnieje, bez
  potrzeby nowej migracji dla tego dyżuru. **Zweryfikuj `ls`, nie zakładaj.**

# 3. POZYCJE DYŻURU

## R1 — hook raportów, za istniejącą flagą `ENABLE_ARTIFACT_KNOWLEDGE_INDEX` (rdzeń)

**Cel, dosłownie:** przy fladze **ON**, po tym jak `generateFullReport` zapisze
wygenerowane sekcje i ustawi status `GENERATED`, treść raportu trafia do bazy
wiedzy AI z poprawnym właścicielem i zasięgiem — dokładnie jak dziś dzieje się
to dla dokumentów i decków. Przy fladze **OFF** (domyślnie) — zero zmiany
zachowania.

### R1a — nowa funkcja w `artifactKnowledgeIndexer.ts`

Dodaj `indexReportArtifactForKnowledge`, analogiczną do
`indexDocumentArtifactForKnowledge`/`indexDeckArtifactForKnowledge` (`:62-68`).
Zwraca `{documentId, scope, chunkCount}` — ten sam kontrakt co siostrzane
funkcje. Jedyna dozwolona zmiana we wspólnym kodzie: rozszerzenie unii
`kind: 'document' | 'deck'` (w `knowledgeDocumentId` i `indexArtifactForKnowledge`)
o `'report'`, żeby nie duplikować całej funkcji. `inferKnowledgeScope` **nie
zmienia się w ogóle** — reużywasz ją bez modyfikacji.

Do treści dodaj nową, eksportowaną, samodzielnie testowalną funkcję budującą
`contentMd` z sekcji raportu (nazwę wybierasz Ty, np.
`reportArtifactToKnowledgeMarkdown`), wzorem `deckArtifactToKnowledgeMarkdown`
(`:85-113`), ale dopasowaną do kształtu `report_builder_sections` (`title` +
`generated_content`/`edited_content`, filtrowane `enabled`, posortowane
`order_index` — wzorzec w `getPublicReport`, `reportGenerationService.ts:2149`).

### R1b — punkt wpięcia w `reportGenerationService.generateFullReport`

Tuż przed `return { totalTokens, generatedSections };` (`:1844`), za `if
(isArtifactKnowledgeIndexEnabled())`. **Dwa świeże odczyty, oba potrzebne, oba
NIE mogą polegać na stanie sprzed pętli generującej:**

1. `SELECT confidentiality FROM report_builder_reports WHERE id = ? AND
   organization_id = ?` — bo `reportData.report.confidentiality` jest zawsze
   `undefined` (`K5`/`T6`). Jednokolumnowy, tani.
2. `SELECT section_key, title, generated_content, edited_content, order_index
   FROM report_builder_sections WHERE report_id = ? AND enabled = true ORDER
   BY order_index ASC` — bo `reportData.sections` jest zrzutem sprzed
   generacji (`K7`).

Woła `indexReportArtifactForKnowledge` fire-and-forget (`void
...catch(logger.warn)`, wzorem dokumentu — nie musisz kopiować deck-owego
`void (async () => {...})()`, chyba że Twój kod tego wymaga strukturalnie;
oba warianty są dopuszczalne, wybierasz Ty). Argumenty: `artifactId = reportId`,
`organizationId` (parametr funkcji, już masz), `ownerId =
reportData.report.createdBy` (to pole **jest** mapowane poprawnie —
problem dotyczy wyłącznie `confidentiality`), `projectId =
reportData.report.projectId`, `title = reportData.report.title`, `contentMd`
z `R1a`, `confidentiality` z odczytu 1.

### R1c — zasięg jest sednem tej pozycji

Ochrona ma być **tej samej klasy**, co udowodniona przez 209 dla dokumentów:
mutacja `inferKnowledgeScope` na sztywno `'organization'` **musi** zapalić
czerwony test analogiczny do Mutacji 1 z odbioru 209 (`ODBIOR_209.md:88-100`,
`does not return user A private content to user B through search_knowledge_base`).
Napisz analogiczny scenariusz DLA RAPORTU — nie kopiuj dokumentowy test 1:1 bez
uruchomienia; raport ma inny kształt seeda (musi przejść realnym `INSERT`/
`UPDATE` do `report_builder_reports`/`report_builder_sections`, nie przez
`reportData.report`, bo właśnie to pole jest martwe — patrz `K5` i pułapka
druga w liście pułapek środowiskowych (`§0.2e`, ramka do `Z33`)).

**Ukończone, gdy:** `indexReportArtifactForKnowledge` ma kontrakt zgodny z
siostrzanymi funkcjami; hook w `generateFullReport` jest za flagą,
fire-and-forget, robi dwa świeże odczyty (nie polega na `reportData` z
początku funkcji); raport confidential/restricted daje `scope==='user'` i
`skipGlobalEmbeddingIndex=true`; mutacja zasięgu zapala czerwony test
end-to-end na wycieku, cofnięcie mutacji przywraca zielony.

## R2 — dowód HTTP end-to-end

Mirror `server/src/routes/__tests__/document-studio-knowledge-index.http.pg.test.ts`
(cały plik: montowanie realnego routera bezpośrednio, realny podpisany JWT,
`assertRealPostgresTestEnvironment()` bez argumentów — `Z31`). Nowy plik, dla
`POST /api/report-builder/:id/generate`:

1. seed organizacji + usera (`INSERT INTO organizations`/`users`, wzorem pliku
   dokumentowego);
2. seed **realnego** raportu gotowego do generacji: `INSERT INTO
   report_builder_reports` z `confidentiality` ustawionym na wartość, którą
   chcesz przetestować (np. `'confidential'`), plus co najmniej jedna
   `INSERT INTO report_builder_sections` z `enabled = true`;
3. realne żądanie `POST /:id/generate` z podpisanym JWT,
   `ENABLE_ARTIFACT_KNOWLEDGE_INDEX=true` w **środowisku uruchomienia** (nigdy
   w kodzie produkcyjnym);
4. ★ **hook jest fire-and-forget** — po otrzymaniu odpowiedzi HTTP zaczekaj
   (polling z sensownym timeoutem, kilka sekund) zanim odpytasz
   `knowledge_chunks`/`knowledge_docs`/`ai_knowledge_embeddings`. Test bez tej
   sekwencji mierzy wyścig czasowy, nie brak działania (patrz pułapka czwarta);
5. asercja końcowa: wpis w `knowledge_docs` z poprawnym `organization_id`/
   właścicielem/zasięgiem, treść wyszukiwalna przez realne
   `search_knowledge_base`.

**Ukończone, gdy:** trzy kolejne zielone przebiegi całego pliku, na świeżej
bazie, wklejone do raportu.

## R3 — mapa dwóch pozostałych generatorów raportów (zero implementacji)

Tabela w raporcie, kolumny: generator | trwały artefakt z `id`? | pole
poufności? | trasa HTTP | decyzja | powód. Dwa wiersze obowiązkowe:

1. **`management_reports`** — zmierz `271_management_reports_extended.sql`
   (`K8`/`T9`) i potwierdź albo obal brak kolumny poufności. Jeśli
   potwierdzisz — decyzja `DEFER — brak kolumny poufności, budowa
   klasyfikacji od zera to nowa powierzchnia produktowa/bezpieczeństwa, poza
   jednym dyżurem indeksacji` (zasada z `CZĘŚĆ A.8`: „nie poszerzaj dostępu,
   gdy bramka jest niejednoznaczna”). Jeśli obalisz i znajdziesz kolumnę
   poufności, której nie znalazłem — to jest sukces dyżuru: hookuj tak samo
   jak `R1` i zapisz to jako **obalenie** tej tezy, nie milcz.
2. **`aiAssessmentReportGenerator`** — zmierz, czy wynik trafia do
   jakiejkolwiek tabeli z trwałym `id` (`K8`/`T10`). Jeśli potwierdzisz brak
   zapisu — decyzja `NIE DOTYCZY — brak trwałego artefaktu, strukturalny brak
   przedmiotu do indeksacji, nie „defer”`. Jeśli obalisz — zapisz to jako
   obalenie i zaproponuj plan (bez implementacji w tym dyżurze, chyba że to
   jest tania, jednoznaczna zmiana — wtedy decyzja z uzasadnieniem należy do
   Ciebie).

Dopisz też jednym zdaniem rozstrzygnięcie `T11` (dwa pliki
`assessment-reports.routes.ts` to jedna ścieżka, nie dwie), żeby nikt po
Tobie nie policzył ich jako osobnych generatorów.

**Ukończone, gdy:** tabela ma oba wiersze wypełnione z dowodem `plik:linia`,
zero kodu produkcyjnego dla `management_reports`/`aiAssessmentReportGenerator`
w tym dyżurze.

## R4 — bramka powtarzalności i higiena mocków od pierwszego commita

Każdy nowy plik testowy z `vi.spyOn(...).mockResolvedValue(...)` instaluje
mock w `beforeEach`, nigdy w `beforeAll` (`T12`, pułapka pierwsza). Trzy
kolejne zielone przebiegi **pełnego pliku** (nie pojedynczych `-t`), dla
każdego nowego pliku testowego, na świeżej bazie — wklej wszystkie trzy
przebiegi do raportu, nie tylko ostatni.

**Ukończone, gdy:** oba nowe pliki testowe (`R1c`/`R1a` jednostkowy z realnym
PG, `R2` HTTP e2e) mają po trzy zielone przebiegi wklejone do raportu, każdy
`--retry=0`.

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis | `server/src/services/knowledge/artifactKnowledgeIndexer.ts` — WYŁĄCZNIE dodanie `indexReportArtifactForKnowledge` + funkcji budującej `contentMd` z sekcji raportu, oraz — jeśli potrzebne strukturalnie — rozszerzenie unii `kind: 'document' \| 'deck'` o `'report'` w `knowledgeDocumentId`/`indexArtifactForKnowledge`. **Zakaz zmiany semantyki `inferKnowledgeScope`, `indexDocumentArtifactForKnowledge`, `indexDeckArtifactForKnowledge`, `deckArtifactToKnowledgeMarkdown`** |
| Zapis | `server/src/services/reportGenerationService.ts` — WYŁĄCZNIE blok hooka tuż przed `return { totalTokens, generatedSections };` w `generateFullReport` (`:1844`), plus import u góry pliku. **Zakaz zmiany reszty funkcji** (generowanie sekcji, coherence outline, executive synthesis, `regenerateSection`, `exportReport`, `getPublicReport`) |
| Zapis | NOWE pliki testowe w `server/src/services/knowledge/__tests__/` i `server/src/routes/__tests__/` — pełna licencja, z zastrzeżeniem `Z18` i `Z31`. Dozwolone też ADDYTYWNE dopisanie nowych `it(...)` do istniejącego `server/src/services/knowledge/__tests__/artifactKnowledgeIndexer.pg.test.ts`, jeśli uznasz to za czystsze niż nowy plik — decyzja Twoja, uzasadnij w raporcie |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY215_INDEKS_RAPORTOW_REPORT.md` |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/reportBuilderService.ts` — czytasz jako dowód luki `confidentiality`/`sourceRefs` (`K5`/`K6`), **nie naprawiasz** mapowania `getReport()` w tym dyżurze; hook w `R1b` omija problem własnym SELECT-em |
| Odczyt (ZAKAZ ZAPISU) | `server/src/routes/report-builder.routes.ts` — potwierdza trasę produkcyjną, routing się nie zmienia |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/scheduledReportService.ts` — drugi wołacz, czytasz jako dowód, nie zmieniasz |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/documentStudio/documentStudioService.ts` · `server/src/services/presentationGeneratorService.ts` — wzorce hooków, NIE dotykasz ich zachowania |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/KnowledgeService.ts` · `server/src/services/ai/tools/searchKnowledgeBase.ts` · `server/src/services/ai/embeddingService.ts` — ochrona zasięgu 209, nietykalna |
| Odczyt (ZAKAZ ZAPISU) | `server/src/config/FeatureFlags.ts` — reużywasz istniejącą flagę bez zmian. Nowa flaga dozwolona wyłącznie jako STOP MERYTORYCZNY z dowodem (patrz `POZYCJE_Z_FLAGAMI`) |
| Odczyt | `server/src/repositories/ManagementReportRepository.ts` · `server/src/services/managementReportsService.ts` · `server/src/routes/managementReports.routes.ts` · `server/src/routes/managementReportsAnalytics.routes.ts` — survey do `R3`, zero zmian |
| Odczyt | `server/src/services/aiAssessmentReportGenerator.ts` · `server/src/routes/assessment/assessment-ai.routes.ts` — survey do `R3`, zero zmian |
| Odczyt | `server/src/services/report/drdReportGrounding.ts` — kontekst (`K10`), zero zmian |
| Odczyt | `server/src/routes/assessment-reports.routes.ts` · `server/src/routes/assessment/assessment-reports.routes.ts` — rozstrzygnięcie `T11`, zero zmian |
| Odczyt | `server/migrations/503_report_builder.sql` · `server/migrations/20260823_runtime_ddl_schema_convergence.sql` · `server/migrations/271_management_reports_extended.sql` · `server/migrations/20260831_day209_knowledge_chunks_created_at.sql` — schema jako dowód, żadnej nowej migracji nie oczekujemy (`T13`); jeśli Twój pomiar znajdzie realny schema-gap analogiczny do `knowledge_chunks.created_at` — wolno Ci dodać DOKŁADNIE JEDEN nowy plik `server/migrations/20260831_day215_<opis>.sql`, wyłącznie addytywny (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`), po sprawdzeniu `ls server/migrations/ \| grep 20260831_day215` → `0` |
| Odczyt | `docs/program/funkcje/ODBIOR_209.md` — SSOT tego dyżuru, **nie zmieniasz** (cudzy, zamknięty zapis odbioru); jeśli Twój pomiar cokolwiek w niej obala, zapisujesz to w SWOIM raporcie |
| Odczyt | `src/components/ReportBuilder/steps/IntentStep.tsx` · `src/components/ReportBuilder/useReportBuilder.ts` — dowód wektora `confidentiality` z frontu (`K6`), zero zmian we `src/` w tym dyżurze (`TRASY_FRONT`) |
| Odczyt | `tests/setup.ts` — TYLKO ODCZYT, `Z18` najostrzejszy |
| **Wszystko inne** | **TYLKO ODCZYT** — opisujesz potrzebę w raporcie z dowodem `plik:linia` i idziesz dalej |

**Rozłączność z partią równoległą:** ten dyżur wchodzi w
`artifactKnowledgeIndexer.ts` i `reportGenerationService.ts` — oba pliki są
świeże z dyżuru 209/FIX-209 i nie były jeszcze dotykane przez inne równoległe
dyżury na dzień pisania tej instrukcji (zweryfikuj `git log` gałęzi bazowej
pod kątem równoległych dyżurów w tych dwóch plikach **przed pierwszym
commitem** i zgłoś kolizję zasobową, jeśli znajdziesz). Porty i nazwa
kontenera są zarezerwowane wyłącznie dla `215` — patrz `Z7`.

# 5. TWARDE ZASADY

- ★★ **Pętla dokumentów/decków z dyżuru 209 jest nietykalna.** Nie zmieniasz
  jej zachowania, jej domyślnej flagi, ani nie uzależniasz zachowania hooka
  raportów od stanu hooków dokumentu/decka — trzy niezależne wywołania tej
  samej funkcji `indexArtifactForKnowledge`, nic więcej.
- ★★ **Zasięg raportu MUSI pochodzić ze świeżego odczytu bazy, nigdy z
  `reportData.report.confidentiality`** (`K5`, pułapka druga). To jest
  najdroższy błąd, jaki możesz popełnić w tym dyżurze — cichy, bez wyjątku,
  bez czerwonego testu, dopóki nie napiszesz testu, który realnie sprawdza
  efekt końcowy przez `search_knowledge_base`, a nie stan pośredni.
- ★★ **Zero implementacji dla `management_reports` i
  `aiAssessmentReportGenerator` w tym dyżurze** — wyłącznie zmierzona decyzja
  w tabeli `R3`.
- ★★ **`Z29` — dowód mutacyjny w obie strony:** zepsuj `inferKnowledgeScope`
  (np. na sztywno `'organization'`) → test wycieku dla raportu **musi**
  poczerwienieć; cofnij (`cp` z `/private/tmp/cx-day215-indeks-raportow-scratch`,
  nigdy `git stash` — `Z27`) → test wraca zielony, `git diff` po cofnięciu
  pusty. Oba wyniki i obie komendy w raporcie.
- ★★ **`Z31` — zakaz pinowania strażnika RealDB do hosta/portu/nazwy bazy.**
  Wołasz `await assertRealPostgresTestEnvironment()` bez argumentów.
- ★★ **Zakaz retry w testach bezpieczeństwa** — `--retry=0` w każdej
  komendzie uruchomienia.
- ★★ **Bramka: trzy kolejne zielone przebiegi pełnego pliku**, dla każdego
  nowego pliku testowego, nie pojedynczych `-t`.
- ★★ **Flaga zostaje domyślnie OFF.** Jedyny dozwolony sposób ustawienia
  `ENABLE_ARTIFACT_KNOWLEDGE_INDEX=true` to zmienna środowiskowa przy
  uruchomieniu konkretnego testu — nigdy w kodzie, `.env*`,
  `docker-compose*` ani `railway*`.
- ★ **Sprzątanie kontenera: `docker rm -f -v`** — z flagą `-v`.
- ★ **`Z27` — zakaz `git stash`** w każdej postaci. Dowody mutacyjne przez
  `cp` do `/private/tmp/cx-day215-indeks-raportow-scratch` i powrót przez `cp`.
- **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji** (`Z28`).
- **Zakaz naprawiania przez wyciszanie** (`@ts-ignore`, `.skip`, poszerzanie
  `exclude`, `--no-verify`) i zakaz usuwania zastanych testów.
- ★ **`§0.4a` — pomiar zasięgu testów jest warunkiem oddania raportu**
  (`Z24`). Zawężony wybór albo przepisanie cudzej liczby = zawyżenie i
  podstawa odrzucenia.
- ★ Pułapka: bez `RUN_DB_TESTS=1` testy backendowe idą na MOCK DB. Pułapka:
  `No test files found` **nie jest** `PASS`. Pułapka: `npx vitest run` bywa
  kończy się `exit 0` mimo czerwonych testów — liczby i nazwy czytasz z
  JSON-a (`Z37`).
- ★★ **Sekcja „TWIERDZENIA NIEZWERYFIKOWANE” w raporcie jest OBOWIĄZKOWA.**
  Wypisz w niej wprost co najmniej: czy potwierdziłeś pomiarem, że
  `reportData.report.confidentiality` jest rzeczywiście `undefined`, czy
  tylko przepisałeś to z instrukcji; czy zweryfikowałeś, że gałąź V3
  INSERT-a realnie uruchamia się z frontu `IntentStep.tsx` (`T8`), czy
  założyłeś; czy Twój test mutacyjny (`R1c`) łapie prawdziwy przeciek przez
  `search_knowledge_base`, czy tylko sprawdza pośredni stan `scope`; ile
  wołaczy `generateDeck` naprawdę policzyłeś i czy trzeci
  (`artifactRegistryService.ts:4326`) się potwierdził; czy decyzje w `R3`
  (`management_reports`, `aiAssessmentReportGenerator`) są oparte na
  pomiarze schematu/kodu, czy na przepisaniu tej instrukcji; czy hook w
  `R1b` jest udowodniony end-to-end przez realne HTTP (`R2`), czy tylko
  wywołaniem funkcji z testu jednostkowego; czy trzy przebiegi bramki
  powtarzalności naprawdę wykonałeś, czy zakładasz na podstawie jednego.
  **Brak tej sekcji jest podstawą odrzucenia dyżuru.**
