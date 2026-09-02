# INSTRUKCJA DYŻURU nr 240 — Codex — „★★ ASSESSMENT — SKĄD POCHODZI ODPOWIEDŹ. Zero naprawy: czysty pomiar pod decyzję właściciela — dziś zmierzone: jedyne kolumny kiedykolwiek reprezentujące pochodzenie odpowiedzi (`assessments.source_type`/`source_reference`, `248_assessment_enhancements.sql:11-12`) są MARTWE (migracja nigdy nie biegnie na Postgresie, `migrate.postgres.ts:266-269`), żywa `assessment_responses` (`20261120_fresh_db_schema_gap_closure.sql:295-309`) nie ma ŻADNEJ kolumny źródła, a dwa pliki README (`server/migrations/README.md`, `migrations-archive/README.md`) od czterech miesięcy fałszywie twierdzą, że kanoniczny katalog migracji to `server/migrations-v2/`, podczas gdy realnie biegnie `server/migrations/`"

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
> **wyłącznie** `/private/tmp/cx-day240-assessment`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `61fbb7b88f`**
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
Zakres: ****04 ASSESSMENT (`/assessment`) — pochodzenie (źródło) pojedynczej odpowiedzi/score/evidence wewnątrz assessmentu: czy jest rozróżnialne w bazie, czy dociera na ekran, i ile odpowiedzi w żywej bazie ma je zapisane.** Kontrakt funkcjonalny modułu sam nazywa audytowalność źródeł stanem `target` (`docs/functional/05_assessment/README.md:48,57-60`, `ASM-F-010`) — niezbudowanym, nie gotowym.**.
Trasy front: ``src/components/assessment/AssessmentHub.tsx` · `AssessmentQualityReviewPanel.tsx` · `AssessmentWorkbenchPanel.tsx` · `drd/DrdHttpMethodWorkspaceScreen.tsx`, `DrdMethodWorkspaceScreen.tsx` · `drd/DRDAssessmentEditor.tsx`, `siri/SIRIAssessmentEditor.tsx`, `adma/ADMAAssessmentEditor.tsx` · `tools/ADMAForm.tsx`, `tools/SIRIForm.tsx` · `report/AssessmentReportView.tsx`, `AssessmentReportContractView.tsx`, `AssessmentReportDocument.tsx` · `manage/ReportsManagementPanel.tsx`, `InitiativesManagementPanel.tsx`, `AssessmentManagePanel.tsx` · `artifacts/ArtifactLineagePanel.tsx` · `AssessmentOutputsTab.tsx` · `src/views/AssessmentSessionEditorView.tsx`, `FreeAssessmentView.tsx`, `PublicMiniAssessmentView.tsx` · `src/components/Discovery/InsightDetailView.tsx` (konsument promocji assessment→insight) · `src/components/Initiatives/InitiativeSuggestionBadge.tsx` (kolizja nazewnicza `sourceType`)`. Trasy tył: ``server/src/routes/v8/assessment.routes.ts` · `server/src/routes/assessment-enterprise.routes.ts` · `server/src/routes/assessment/*.routes.ts` (hub/reports/ai/workflow/level-attachments) · `server/src/routes/method-core.routes.ts` · `server/src/services/assessment/AssessmentWorkbenchService.ts`, `drdEvidenceScoring.ts` · `server/src/services/AssessmentEvidenceService.ts` · `server/scripts/migrate.postgres.ts` (tylko odczyt — reguła wykluczeń `<500`/`000_initdb_`) · `server/migrations/**`, `server/migrations-v2/**` (tylko odczyt)`.

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
WT=/private/tmp/cx-day240-assessment
MARKER=61fbb7b88f

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day240-assessment-20260901 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day240-assessment/config.worktree"
cat "$VAULT/worktrees/cx-day240-assessment/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day240-assessment-scratch
mkdir -p /private/tmp/cx-day240-assessment-artefakty

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
git -C "$VAULT" log --oneline 61fbb7b88f..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only 61fbb7b88f..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day240-assessment-20260901
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 61fbb7b88f..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `9` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA: co najmniej szesc niekompatybilnych enumeracji "zrodla/dowodu" wspolistnieje w module
grep -n "kind: 'survey_response'\|EvidencePointer" server/src/services/assessment/AssessmentWorkbenchService.ts | head -5
grep -n "evidenceType" src/components/assessment/drd/DrdHttpMethodWorkspaceScreen.tsx | head -5
grep -n "EvidenceType\s*=" server/src/services/assessment/drdEvidenceScoring.ts
grep -n "SuggestionSourceType" src/components/Initiatives/InitiativeSuggestionBadge.tsx
#   oczekiwane: kazda komenda daje trafienie, wartosci miedzy nimi sie NIE pokrywaja

# (2) TEZA: dwa README (04-2026) klamia o katalogu migracji, realny kod uzywa server/migrations
cat server/migrations/README.md
grep -n "migrationsDir = path.resolve" server/scripts/migrate.postgres.ts
grep -n "db:migrate" package.json | head -6
grep -n "migrate.postgres.ts" .github/workflows/test-suite.yml
#   oczekiwane: README mowi "New migrations live in server/migrations-v2/", ale
#   migrate.postgres.ts/package.json/CI domyslnie wskazuja server/migrations (bez --dir)

# (3) TEZA: jedyne kolumny zrodla CALEGO assessmentu pochodza z migracji ktora nigdy nie biegnie
grep -n "source_type\|source_reference" server/migrations/248_assessment_enhancements.sql | head -3
sed -n '260,275p' server/scripts/migrate.postgres.ts
sed -n '734,743p' server/migrations/000_z_core_baseline.sql
#   oczekiwane: 248_assessment_enhancements.sql definiuje source_type/source_reference,
#   ale wersja 248<500 i nie zaczyna sie od 000_z_core_baseline -> wykluczona; zywa
#   definicja assessments (000_z_core_baseline.sql) nie ma tych kolumn

# (4) TEZA: zywa tabela assessment_responses (per odpowiedz) tez nie ma kolumny zrodla
sed -n '285,310p' server/migrations/20261120_fresh_db_schema_gap_closure.sql
#   oczekiwane: komentarz "producent (plik martwy, nigdy nieuruchamiany): 248_..." +
#   lista kolumn bez source_type/provenance

# (5) TEZA: ten sam wzorzec (source_type+source_id) juz dziala na tasks/decisions
sed -n '1,45p' server/migrations/20260311_origin_tracking.sql
#   oczekiwane: ALTER TABLE tasks/decisions ADD COLUMN source_type, z indeksem

# (6) TEZA: assessment_evidence i assessment_ai_scoring_proposals istnieja WYLACZNIE w martwym migrations-v2
grep -rn "CREATE TABLE.*assessment_evidence\b" server/migrations/*.sql server/migrations-v2/*.sql
grep -rn "CREATE TABLE.*assessment_ai_scoring_proposals" server/migrations/*.sql server/migrations-v2/*.sql
grep -n "FROM assessment_evidence\|assessmentCreateScoringProposal" server/src/services/AssessmentEvidenceService.ts server/src/routes/assessment-enterprise.routes.ts | head -6
#   oczekiwane: definicje CREATE TABLE trafiaja WYLACZNIE do server/migrations-v2/*, kod mimo to je odpytuje

# (7) TEZA: jedyny w pelni polaczony lancuch czterech warstw to waski panel DRD
grep -n "evidence_type" server/migrations/20260801_asm005_007_evidence_quality_output.sql
grep -n "V8AssessmentEvidence\[\]\|item.evidenceType" src/components/assessment/AssessmentQualityReviewPanel.tsx
#   oczekiwane: CHECK w bazie + realny render {item.evidenceType} w tym jednym panelu

# (8) TEZA: 5 powierzchni Hub domyslnie ON, co najmniej jedna renderuje pusty stan
grep -n "assessmentFiveSurfacesV1" -A3 src/hooks/useFeatureFlags.tsx | grep "defaultValue"
grep -n "EmptyState" src/components/assessment/AssessmentOutputsTab.tsx
#   oczekiwane: defaultValue: true; co najmniej jedno wystapienie EmptyState

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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day240-assessment-20260901` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6189`. Twój JEDYNY port harnessu to `5166 i 5167`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day240-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061. Zajęte przez inne prace (nie ruszasz): 6012, 5433, 6047, 6054-6187, 5010-5163, 6404-6411, 6600-6830. Twoje własne: baza 6189, harness 5166 i 5167. Cudze — siostrzane dyżury TEJ SAMEJ fali, nie dotykasz: baza 6188 i harness 5164-5165 (dyżur 239 Realizacja), baza 6190 i harness 5168-5169 (dyżur 241 Inicjatywy). Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `ŻADNEJ nowej flagi i ŻADNEJ zmiany wartości domyślnej istniejącej flagi. Flaga `assessmentFiveSurfacesV1` (`src/hooks/useFeatureFlags.tsx:198-214`, `defaultValue:true`) jest dziś domyślnie WŁĄCZONA i pozostaje bez zmian — jedynie mierzysz jej skutek (5 powierzchni Hub) w `R5`. `Z10` obowiązuje bez wyjątku.`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``src/utils/pilotAccess.ts` · `src/utils/roleGuards.ts` · `src/components/RouterSync.tsx` · `server/src/database/Database.ts` · `server/scripts/migrate.postgres.ts` · `vitest.config.ts` · `tests/setup.ts``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY240_ASSESSMENT_REPORT.md`. Jedyny inny dokument, który wolno Ci dotknąć, to `docs/program/waves/WAVE_03_ACCEPTANCE/modules/04_ASSESSMENT/MODULE_ACCEPTANCE.md` (§R.1) — WYŁĄCZNIE dopisanie nowej sekcji na końcu pliku ze zmierzonym stanem (taksonomia źródeł, martwe migracje, sprzeczność `migrations-v2`), każde zdanie z dowodem `plik:linia`. Zakaz kasowania, nadpisywania lub przepisywania istniejących wierszy tabel. Zakaz wpisywania `FIXED`/`VERIFIED` — ten dyżur nie naprawia mechanizmu, tylko mierzy i dokumentuje. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day240-assessment-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day240-assessment-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **ZAKAZ DODAWANIA KOLUMNY ŹRÓDŁA/PROVENANCE DO JAKIEJKOLWIEK TABELI**, zakaz nowej migracji, zakaz zmiany `assessmentFiveSurfacesV1` ani żadnej innej flagi. **ZAKAZ PODŁĄCZANIA martwych tras** (`assessment_evidence`, `assessment_ai_scoring_proposals`) pod cokolwiek — jeśli `R1` wykaże, że tabele nie istnieją na kanonicznej bazie, opisujesz to w raporcie, nie tworzysz migracji naprawczej. **ZAKAZ ROZSTRZYGANIA, czy `server/migrations-v2/` ma zostać skasowany** — to rekomendacja w raporcie, decyduje nadzorca/właściciel. | Kontrakt funkcjonalny modułu (`docs/functional/05_assessment/README.md:57-60`) nazywa audytowalność źródeł WYMAGANĄ BRAMKĄ, a funkcja `ASM-F-010` ma status `target` — sam moduł przyznaje, że tego jeszcze nie ma. Dwa niezależne pliki README (`server/migrations/README.md`, `server/migrations-archive/README.md`, oba z 2026-04-15) od czterech miesięcy fałszywie twierdzą, że kanoniczny katalog migracji to `server/migrations-v2/`, podczas gdy realny kod uruchamiający migracje (`migrate.postgres.ts`, `package.json`, CI) domyślnie używa `server/migrations/` — co oznacza, że tabele z prawdziwymi kolumnami proweniencji AI (`assessment_evidence`, `assessment_ai_scoring_proposals`) mogą w ogóle nie istnieć na kanonicznie zbudowanej bazie. Ten dyżur ma dać właścicielowi pierwszy uczciwy obraz: pełną taksonomię źródeł, dokładne miejsce zerwania łańcucha, i realne liczby z bazy — pod decyzję, nie pod naprawę. |

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
cd /private/tmp/cx-day240-assessment

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day240-pg psql -U postgres -d cx240 \
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
cd /private/tmp/cx-day240-assessment

docker run -d --name cx-day240-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx240 \
  -p 127.0.0.1:6189:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day240-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6189/cx240 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6189/cx240 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day240-assessment && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6189/cx240 \
JWT_SECRET=cx240-test-secret-do-not-reuse \
npx vitest run src/components/assessment/__tests__ src/views/__tests__ server/src/services/assessment/__tests__ server/src/routes/assessment/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day240-assessment-artefakty/day240-pakiet.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day240-assessment && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run src/components/assessment/__tests__ src/views/__tests__ server/src/services/assessment/__tests__ server/src/routes/assessment/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day240-assessment-artefakty/day240-pakiet.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day240-assessment/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day240-pg psql -U postgres -d cx240 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day240-pg`.
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
> **(e) ★★ SŁOWO „SOURCE"/„PROVENANCE" WYSTĘPUJE W KODZIE W SZEŚCIU NIEZALEŻNYCH ZNACZENIACH — grep na `sourceType`/`provenance` bez rozróżnienia, KTÓREGO pytania dotyczy trafienie, da fałszywe wrażenie, że problem jest rozwiązany. `data-testid="assessment-editor-provenance-badge"` na flagowym ekranie sesji (`AssessmentSessionEditorView.tsx:2114`) to plakietka WERSJI RUNTIME (V8 vs legacy), nie pochodzenia odpowiedzi. Druga pułapka: dwa pliki README (`server/migrations/README.md`, `migrations-archive/README.md`) od czterech miesięcy kłamią o tym, który katalog migracji jest kanoniczny — realny kod (`migrate.postgres.ts:816`, `package.json:197-201`, CI) mówi co innego. Nie ufaj lekturze migracji — MUSISZ zobaczyć realny `\d tabela` na własnej, świeżo zmigrowanej bazie.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day240-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day240-assessment-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (taksonomia źródeł i audyt schematu) · R2 (śledzenie czterech warstw) · R3 (pomiar na żywej bazie) · R5 (liczba ekranów) · R6 (korekta MODULE_ACCEPTANCE.md)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6189` albo `5166 i 5167` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6189` albo `5166 i 5167`** (`Z7`).

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

Moduł **04 Assessment** rzekomo **nie rozróżnia jasno, skąd wzięła się dana odpowiedź** —
czy z wywiadu, z wgranego dokumentu, z inferencji AI, z ręcznego wpisu, czy z biblioteki
benchmarków. To uderza wprost w obietnicę produktu: Consultify **ma nie być** generatorem
bez powiązania ze źródłami — kontrakt funkcjonalny modułu sam to nazywa wymogiem, nie
życzeniem (`docs/functional/05_assessment/README.md:57-60`: *„Wymagane bramki: użytkownik
zna źródło scoringu, system odróżnia dane wejściowe od interpretacji AI"*), a funkcja
`ASM-F-010` „Audytowalność źródeł i decyzji" ma w tym samym pliku status `target`
(`:48`) — **nie `code-only`, nie `partial`, tylko `target`: sam kontrakt przyznaje, że to
jeszcze nie istnieje**. Ten dyżur **nie naprawia tego** — dostarcza właścicielowi materiał
do decyzji: pełną taksonomię źródeł, dokładne miejsce, w którym informacja o źródle ginie,
i realne liczby z bazy.

**★★ ZAKAZ ZMIAN ARCHITEKTURY.** Ten dyżur jest pomiarowo-dowodowy. Nie budujesz nowej
kolumny, nie zmieniasz żadnej migracji, nie dopisujesz nowego pola do żadnego typu ani
routingu. Jedyny dozwolony zapis produktowy to wąski dopisek do `MODULE_ACCEPTANCE.md`
(`R6`) — reszta to raport.

## ★★ POMIAR NA MARKERZE `61fbb7b88f` — WSTĘPNE USTALENIA, KAŻDE DO WERYFIKACJI PRZEZ CIEBIE

### 1. Nie ma JEDNEJ taksonomii źródeł — jest ich co najmniej sześć, wzajemnie niekompatybilnych

Zamiast jednego pola „skąd ta odpowiedź", w module współistnieje kilka **niezależnych**
enumeracji, każda dla innej tabeli/ekranu, żadna nie odpowiada wprost na pytanie „skąd wzięła
się TA KONKRETNA odpowiedź":

- `EvidencePointer.kind` (P28 Workbench): `survey_response | document | interview_note |
  external_url | artifact` — `server/src/services/assessment/AssessmentWorkbenchService.ts:30-36`.
  Bez wartości `ai_generated`/`manual` — treść wygenerowana przez AI ląduje nierozróżnialnie
  pod `artifact`.
- `evidenceType` w `method_events.payload_json` (DRD Method Pack): `document | system_record |
  observation` — używane w `src/components/assessment/drd/DrdHttpMethodWorkspaceScreen.tsx:127,141,164,663`.
  To jest **trzecia, odrębna** lista wartości, bez wspólnego typu z powyższą.
- `assessment_axis_evidence.evidence_type`: `note | link | document | reference`, jedyna
  wersja z twardym ograniczeniem `CHECK` w bazie —
  `server/migrations/20260801_asm005_007_evidence_quality_output.sql:31-46`, typ TS
  `server/src/services/assessment/drdEvidenceScoring.ts:23-25`.
- `assessment_evidence.evidence_type`: wolny tekst, `DEFAULT 'document'`, **bez** `CHECK`
  — definicja istnieje wyłącznie w `server/migrations-v2/001_baseline_20260413.sql:4735-4759`
  (patrz punkt 2 niżej — ta tabela może w ogóle nie istnieć na świeżej bazie).
- `assessment_ai_scoring_proposals`: jedyna tabela z PRAWDZIWYMI kolumnami AI-provenance
  (`ai_model_used`, `citations`, `reasoning`, `confidence`) — również wyłącznie
  w `server/migrations-v2/001_baseline_20260413.sql:4429-4444` (patrz punkt 2).
- `SuggestionSourceType` (`InitiativeSuggestionBadge.tsx:30`): `interview_insight |
  assessment | audit` — to jest SZÓSTE, zupełnie inne znaczenie słowa „source": typ
  artefaktu, z którego AI wygenerowało KANDYDATA INICJATYWY, nie źródło ODPOWIEDZI
  wewnątrz assessmentu. Ten sam wzorzec nazw powtarza się w `ReportsTable.tsx:65,222,233,503-507`
  i `InitiativesTable.tsx:47,91` — „sourceType" tam znaczy „z jakiego RAPORTU/INICJATYWY
  wziął się rekord", nie „z jakiego DOWODU wzięła się ODPOWIEDŹ".

**Wniosek wstępny: pytanie właściciela nie ma dziś jednej odpowiedzi, bo pytań o
„źródło" jest w kodzie sześć różnych, pod tą samą nazwą.** Zweryfikuj to sam — masz w `T1`
komendę na każdą z sześciu definicji.

### 2. ★★★ NAJWAŻNIEJSZE USTALENIE — DWIE SPRZECZNE WERSJE „BAZOWEGO" SCHEMATU, TYLKO JEDNA REALNIE DZIAŁA

To jest pułapka głębsza niż zwykły „komentarz kłamie" — tu kłamie **CAŁY PLIK README**,
nie pojedyncza linijka:

- `server/migrations/README.md:1-6` (commit `50d260bcf0`, **2026-04-15**, czyli ponad
  cztery miesiące stare): *„DEPRECATED — Migrations moved. Legacy migrations have been
  archived to `server/migrations-archive/`. New migrations live in
  `server/migrations-v2/`."*
- `server/migrations-archive/README.md` (ten sam commit, ten sam dzień): powtarza to samo,
  „All new migrations live in `server/migrations-v2/`".

**To jest nieaktualne i sprzeczne z realnym kodem uruchamiającym migracje:**

- `server/scripts/migrate.postgres.ts:816` (ostatnia zmiana **2026-08-18**, czyli
  cztery miesiące PO tych README): `const migrationsDir = path.resolve(process.cwd(),
  args.dir || 'server/migrations');` — **domyślny katalog to `server/migrations`, NIE
  `server/migrations-v2`**.
- `package.json:197-201` — WSZYSTKIE skrypty `db:migrate*` (`db:migrate`,
  `db:migrate:unsafe-continue`, `db:migrate:strict`, `db:migrate:postgres`,
  `db:migrate:postgres:dry`) wołają `tsx server/scripts/migrate.postgres.ts` **bez**
  flagi `--dir` → domyślny `server/migrations`.
- `.github/workflows/test-suite.yml:425` — CI też woła `npx tsx
  server/scripts/migrate.postgres.ts` bez `--dir`.
- Katalog `server/migrations/` ma dziś **1085 plików `.sql`** (`ls server/migrations/*.sql
  | wc -l`), z aktywną, wyrafinowaną logiką sortowania faz (numerowane/datowane/late/other,
  opisaną w komentarzu `migrate.postgres.ts:200-230`) — to nie jest porzucony katalog.
  `server/migrations-v2/` ma **39 plików**, ostatnia realna aktywność widoczna w treści to
  kwiecień 2026.

**Wniosek: `server/migrations/` jest DZIŚ realnym, uruchamianym przez CI i `npm run
db:migrate*` katalogiem migracji. `server/migrations-v2/` jest martwym eksperymentem
z kwietnia, o którym dwa pliki README wciąż (fałszywie) twierdzą, że to on jest
kanoniczny.** To jest ósmy/dziewiąty potwierdzony w tym programie przypadek dokumentu
kłamiącego względem kodu — tu akurat na poziomie całego README, nie linijki komentarza.
**Zweryfikuj to sam (`T2`) zamiast wierzyć temu akapitowi.**

**Konsekwencja dla pytania o źródło odpowiedzi:** dwie tabele z punktu 1 z prawdziwymi
kolumnami proweniencji (`assessment_evidence.evidence_type`, i przede wszystkim
`assessment_ai_scoring_proposals` z `ai_model_used`/`citations`/`reasoning`/`confidence`)
są zdefiniowane **wyłącznie** w `server/migrations-v2/001_baseline_20260413.sql:4429-4444`
i `:4735-4759` — na świeżej bazie zbudowanej kanonicznym `npm run db:migrate` (tak, jak
nakazuje `§0.2c` tej instrukcji) **te tabele mogą w ogóle nie istnieć**, mimo że kod je
odpytuje wprost: `server/src/services/AssessmentEvidenceService.ts:85,118,141` (`SELECT
* FROM assessment_evidence…`) i trasa `server/src/routes/assessment-enterprise.routes.ts:279,294`
(`createScoringProposal`/`getScoringProposals`), zamontowana pod `/api/assessments-v4`
(`server/src/Gateway.ts:1289`). **To jest w `R1`/`R3` — sprawdź NA SWOJEJ ŚWIEŻEJ BAZIE,
czy te dwa zapytania w ogóle się wykonują, czy padają `relation does not exist`.**

### 3. Jedyna kolumna KIEDYKOLWIEK mająca reprezentować pochodzenie CAŁEGO assessmentu jest martwa

`server/migrations/248_assessment_enhancements.sql:11-12`: `ALTER TABLE assessments ADD
COLUMN source_type TEXT DEFAULT 'manual'; ALTER TABLE assessments ADD COLUMN
source_reference TEXT;` — to jest jedyne miejsce w `server/migrations/` (katalogu, który
realnie biegnie), które kiedykolwiek próbowało dać CAŁEMU assessmentowi (nie pojedynczej
odpowiedzi) pole źródła. **Ten plik nigdy nie jest uruchamiany**: wersja `248` < `500`,
a nazwa nie zaczyna się od `000_z_core_baseline` →
`server/scripts/migrate.postgres.ts:266-269` klasyfikuje go jako `isSqliteOnlyMigration`
i wyklucza z przebiegu na Postgresie. Druga, alternatywna definicja tych samych dwóch
kolumn (`server/migrations/000_initdb_core_tables.sql:2073-2074`) jest MARTWA z innego,
niezależnego powodu: `f.startsWith('000_initdb_')` → wyklucz (`migrate.postgres.ts:274`).
**Żywa** definicja tabeli `assessments` to WYŁĄCZNIE
`server/migrations/000_z_core_baseline.sql:734-742` — kolumny: `id, organization_id,
project_id, status, created_at, updated_at`. **Zero pola źródła.**

### 4. Żywa tabela na poziomie POJEDYNCZEJ odpowiedzi też nie ma kolumny źródła

Tabela `assessment_responses` (per pytanie/odpowiedź — to jest ta, o którą realnie pyta
właściciel) ma tego samego martwego producenta co punkt 3
(`248_assessment_enhancements.sql:63-77`, ten sam wyklucz `<500`). Żywą wersję tej samej
tabeli tworzy dopiero `server/migrations/20261120_fresh_db_schema_gap_closure.sql:295-309`
— i ten sam plik **własnym komentarzem** (`:291-293`) potwierdza martwotę producenta:
*„producent (plik martwy, nigdy nieuruchamiany): 248_assessment_enhancements.sql"*. Żywe
kolumny: `id, assessment_id, dimension_id, subdimension_id, question_id, score, evidence,
evidence_attachments, notes, ai_feedback, answered_by, answered_at`. **Zero kolumny
źródła/pochodzenia.** `answered_by` zapisuje KTO wysłał wiersz (id użytkownika), nigdy CO
wygenerowało wartość (wywiad / dokument / AI / benchmark).

### 5. Ten sam wzorzec już istnieje i działa gdzie indziej w produkcie — to nie jest niewykonalne

`server/migrations/20260311_origin_tracking.sql:7`: `ALTER TABLE tasks ADD COLUMN IF NOT
EXISTS source_type TEXT DEFAULT NULL;` i `:42` to samo dla `decisions`. To jest **żywa,
datowana migracja** (nie podlega wykluczeniu `<500`), z indeksem
(`idx_tasks_source`/`idx_decisions_source`, `:9,44`). Komentarz w tym samym pliku (`:5`)
mówi wprost: *„source_type + source_id record the origin so detail views can show
backlinks."* **Dokładnie ten wzorzec nie został nigdy zaaplikowany do
`assessment_responses`.** To ważne dla `R4` (warianty rozstrzygnięcia) — rozwiązanie nie
wymaga wynajdywania niczego nowego.

### 6. Tam, gdzie „provenance"/„source" faktycznie coś renderuje — to inne pytanie niż to zadane przez właściciela

Słowo „provenance"/„sourceType" pojawia się w wielu miejscach frontendu
(`ReportsManagementPanel.tsx:67,226,422,443-450`, `InitiativesManagementPanel.tsx:89,588,1400-1408`,
`AssessmentSessionEditorView.tsx:2114`) — ale wszystkie odpowiadają na pytanie „z KTÓREGO
PRZEBIEGU ASSESSMENTU wziął się ten RAPORT/ta INICJATYWA" (makro-proweniencja, w dół
strumienia), **nie** na pytanie „skąd wzięła się TA JEDNA odpowiedź/evidence/score"
(mikro-proweniencja, które zadaje właściciel). `data-testid="assessment-editor-provenance-badge"`
na flagowym ekranie sesji (`AssessmentSessionEditorView.tsx:2102-2115`) to plakietka
**wersji runtime API** (V8 vs. `assessment-workflow-v2` fallback), nie plakietka
pochodzenia odpowiedzi — komentarz `:2098-2101` to potwierdza wprost. **Ktokolwiek
przeczyta „provenance badge" na głównym ekranie, uzna, że to odpowiada na obietnicę
produktu. Nie odpowiada.**

### 7. Jedno miejsce, gdzie WSZYSTKIE cztery warstwy się łączą — i jest ich mało

`AssessmentQualityReviewPanel.tsx` (zamontowany w `AssessmentHub`) to jedyny, w pełni
zweryfikowany w tym rozpoznaniu przypadek kompletnego łańcucha: (a) kolumna DB
`assessment_axis_evidence.evidence_type` z realnym `CHECK`
(`20260801_asm005_007_evidence_quality_output.sql:43-45`) → (b) trasa
`POST/GET /:assessmentId/evidence` (`server/src/routes/v8/assessment.routes.ts:922-979`,
`drdEvidenceScoring.ts:91`) → (c) stan frontendu
(`AssessmentQualityReviewPanel.tsx:31`, `V8AssessmentEvidence[]`) → (d) render
(`:328`, `· oś {item.axisId}/{item.areaId} · {item.evidenceType}`). **To jest wąski,
DRD-only wycinek — nie pokrywa głównego ekranu odpowiedzi.**

### 8. Warstwa (a) w kodzie jest sama w sobie niepoprawna — nie tylko niewidoczna

`DrdHttpMethodWorkspaceScreen.tsx:654-667` (`handleEvidenceDrop`) zapisuje **każdy**
upuszczony plik jako `evidenceType: 'document', strength: 'E2'` — **na sztywno**,
niezależnie od typu pliku i realnej siły dowodu. Nawet gdyby dane dotarły na ekran
(nie docierają — patrz `T7`), wartość źródła byłaby w dużej części wypadków fałszywa
z konstrukcji, nie tylko niewyświetlona.

## Czego ten dyżur świadomie NIE robi

- **Nie dodaje kolumny źródła do `assessment_responses`.** Wariant `B`/`C` z `R4` to opis
  dla właściciela, nie zadanie do wykonania dziś.
- **Nie naprawia martwych tras** (`assessment_evidence`, `assessment_ai_scoring_proposals`)
  ani martwego duplikatu handlerów — to mierzysz i opisujesz, nie usuwasz i nie podłączasz.
- **Nie rozstrzyga, czy `server/migrations-v2/` ma zostać skasowany, dokończony czy
  porzucony.** To jest materiał dla właściciela w `R4`, nie decyzja wykonawcy.
- **Nie zmienia `docs/functional/05_assessment/README.md` ani `MODULE_ACCEPTANCE.md`**
  poza wąskim, addytywnym dopiskiem z `R6`.

---

# 2. TEZY ZLECENIA

| # | Teza | Jak sprawdzasz |
|---|---|---|
| T1 | Istnieje co najmniej sześć niekompatybilnych enumeracji „źródła/typu dowodu" w module, żadna nie pokrywa głównego ekranu odpowiedzi | komenda (1) |
| T2 | `server/migrations/README.md` i `server/migrations-archive/README.md` (04-2026, nieaktualne) twierdzą, że migracje przeniosły się do `server/migrations-v2/`; realny domyślny katalog uruchamiany przez `migrate.postgres.ts`/`package.json`/CI to `server/migrations` | komenda (2) |
| T3 | Jedyne kolumny źródła całego assessmentu (`assessments.source_type`, `source_reference`) pochodzą z migracji, która nigdy nie biegnie na Postgresie (`248_assessment_enhancements.sql`, wersja < 500) | komenda (3) |
| T4 | Żywa tabela `assessment_responses` (per-odpowiedź) nie ma żadnej kolumny źródła | komenda (4) |
| T5 | Ten sam wzorzec (`source_type`+`source_id`) już działa na `tasks`/`decisions` przez żywą migrację `20260311_origin_tracking.sql` | komenda (5) |
| T6 | Tabele `assessment_evidence` i `assessment_ai_scoring_proposals` (jedyne z realnymi kolumnami AI-proweniencji) istnieją WYŁĄCZNIE w martwym `server/migrations-v2/`, a kod je mimo to odpytuje | komenda (6) |
| T7 | Jedyny w pełni połączony łańcuch czterech warstw (`assessment_axis_evidence.evidence_type`) obejmuje wąski panel DRD, nie główny ekran odpowiedzi | komenda (7) |
| T8 | Moduł ma dziś 5 domyślnie włączonych powierzchni Hub (`assessmentFiveSurfacesV1`, `defaultValue:true`), a co najmniej jedna (`Outputs`/`Insights`) ma realną ścieżkę renderującą pusty stan | komenda (8) |
| T9 | Miejsce na dysku wystarcza (próg z incydentów fali) | komenda (9) |

---

# 3. POZYCJE DYŻURU

## R1 — TAKSONOMIA ŹRÓDEŁ I AUDYT SCHEMATU (rdzeń, dowodowy)

**Cel:** ustalić kompletną, prawdziwą listę rodzajów źródeł, jakie odpowiedź MOŻE mieć
w kodzie, i wykazać dla każdej dokładnie, czy i jak jest rozróżniana w bazie — a jeśli
w ogóle nie jest, powiedzieć to wprost.

1. Zweryfikuj samodzielnie wszystkie sześć enumeracji z `§1.1` — dla każdej wypisz plik:linię
   definicji, plik:linię (przynajmniej jednego) realnego użycia w zapisie i w odczycie.
2. Rozstrzygnij `§1.2` na SWOJEJ świeżej bazie: zmigruj kanonicznie (`§0.2c` (A), katalog
   domyślny `server/migrations`, BEZ `--dir server/migrations-v2`) i sprawdź wprost
   zapytaniem `\d assessment_evidence` / `\d assessment_ai_scoring_proposals` — czy tabele
   istnieją. Jeśli nie istnieją, spróbuj wywołać odpowiadające im trasy (`GET/POST
   /api/assessments-v4/...` z `AssessmentEvidenceService.ts`, `assessment-enterprise.routes.ts:279,294`)
   przez realny `ApiGateway` i zapisz DOKŁADNY kod odpowiedzi/błąd.
3. Dla `assessments`/`assessment_responses` (żywe, `§1.3`/`§1.4`) potwierdź brakujące
   kolumny wprost poleceniem `\d assessments` / `\d assessment_responses` na swojej
   zmigrowanej bazie — nie ufaj samej lekturze plików migracji, MUSISZ zobaczyć realny
   `\d` na kontenerze.
4. Wypisz w raporcie: pełną taksonomię (tabela: nazwa enumeracji → wartości → plik:linia
   → czy DB-enforced) i jawne zdanie, które z sześciu odpowiadają na pytanie właściciela
   (proweniencja POJEDYNCZEJ odpowiedzi), a które na inne pytanie (proweniencja
   raportu/inicjatywy, wersja runtime, świeżość danych — `DrdSourceIndicator.tsx`,
   sprawdź czy istnieje i co realnie robi, to osobna, szósta/siódma pułapka do
   potwierdzenia lub obalenia).

## R2 — ŚLEDZENIE CZTERECH WARSTW NA GŁÓWNYCH EKRANACH (rdzeń, dowodowy)

**Cel:** dla każdego ekranu, na którym użytkownik widzi odpowiedź/score/evidence,
przejść pełny łańcuch: (a) pole istnieje w wierszu bazy i w typie zwracanym przez API,
(b) trasa backendowa realnie je SELECTuje i zwraca (nie tylko ma w typie), (c) frontend
faktycznie CZYTA to pole z odpowiedzi API (nie tylko ma je w interfejsie TS), (d)
renderowany komponent je WYŚWIETLA (prawdziwy JSX, nie sama obecność propsa). Minimum:
główny ekran sesji (`AssessmentSessionEditorView.tsx`), panel DRD Method Workspace
(`DrdHttpMethodWorkspaceScreen.tsx`), `AssessmentQualityReviewPanel.tsx`, karty insightów
wypromowanych z assessmentu (`InsightDetailView.tsx`, ścieżka promocji
`AssessmentWorkbenchService.ts:396-413`). Dla KAŻDEGO wskaż DOKŁADNIE, na której warstwie
łańcuch się rwie, z `plik:linia` po obu stronach przerwy (ostatnie miejsce, gdzie dane
jeszcze są, i pierwsze, gdzie już ich nie ma). Zwróć szczególną uwagę na miejsca, gdzie
pole jest OBECNE w payloadzie, ale żadna funkcja adaptera go nie odczytuje (rozróżnij to
od pola, które nigdy nie dotarło do frontu).

## R3 — POMIAR NA ŻYWEJ BAZIE (rdzeń, dowodowy)

**Cel:** rozstrzygnąć „ile odpowiedzi ma pochodzenie, a ile nie" — liczbami, nie oceną.
Na swojej świeżej, w pełni zmigrowanej i sensownie zaseedowanej bazie (jeśli istnieje
odtwarzalny fixture Assessment — sprawdź `server/scripts/seed-wave3-*assessment*` — użyj
go; jeśli nie istnieje, jawnie napisz, że liczysz na pustej/minimalnej bazie i to
ogranicza wartość pomiaru) wykonaj i wklej DOSŁOWNIE wynik:

```sql
SELECT count(*) AS wiersze,
       count(*) FILTER (WHERE evidence IS NOT NULL) AS z_evidence,
       count(*) FILTER (WHERE ai_feedback IS NOT NULL) AS z_ai_feedback
FROM assessment_responses;

SELECT count(*) FROM assessments WHERE source_type IS NOT NULL;
-- oczekiwany błąd: kolumna nie istnieje na kanonicznej bazie (dowód §1.3) — jeśli
-- zapytanie się wykona, to obala T3, wpisz to jako obalenie, nie ukrywaj.

SELECT evidence_type, count(*) FROM assessment_axis_evidence GROUP BY evidence_type;
```

Jeżeli którekolwiek zapytanie padnie błędem „relation/column does not exist" — to JEST
wynik, wklej dokładny komunikat, to dowodzi tezy zamiast ją unieważniać.

## R4 — TRZY WARIANTY ROZSTRZYGNIĘCIA (rdzeń, dokumentacyjny)

**Cel:** język właściciela, nie inżyniera. Dla każdego wariantu: co się zmienia, ile to
kosztuje (dni pracy, rodzaj ryzyka), i co konkretnie właściciel zobaczy po wdrożeniu.
Szkielet (dopracuj liczbami z `R1`-`R3`):

- **Wariant A — „Nie udawaj, że wiesz."** Zero nowej kolumny, zero nowego mechanizmu.
  Wszędzie, gdzie dziś cicho brakuje informacji o źródle, pokazujemy jawną etykietę
  „źródło nieznane" zamiast milczenia. Koszt: bardzo niski (kopiowanie istniejącego wzorca
  pustego stanu). Skutek: przestajemy sugerować dowodowość, której nie ma — nie
  rozwiązuje problemu, ale przestaje go ukrywać.
- **Wariant B — „Podłącz to, co już działa gdzie indziej."** Zaaplikować dokładnie
  sprawdzony wzorzec `source_type`+`source_id` z `tasks`/`decisions`
  (`20260311_origin_tracking.sql`) do `assessment_responses`, i pokazać go jako plakietkę
  przy każdej odpowiedzi. Koszt: średni — jedna migracja addytywna + zmiana w miejscach
  zapisu odpowiedzi (wskaż ile ich jest z `R1`/`R2`) + jeden komponent plakietki. Skutek:
  realna audytowalność, spełnia własny kontrakt modułu (`ASM-F-010`).
- **Wariant C — „Pełny model propozycja→akceptacja z koncepcji produktu."** Zbudować
  model z `docs/product/ASSESSMENT_CONCEPT_V4_2026-06-28.md` §6: AI proponuje
  score+evidence w stanie `PROPOSED`, człowiek akceptuje → `ACCEPTED`, z pełną historią
  kto/kiedy/skąd. Koszt: wysoki — nowa tabela stanu, zmiana UI coacha, migracja
  istniejących odpowiedzi do stanu „historyczne, brak dowodu". Skutek: pełna zgodność
  z obietnicą produktu, ale to jest osobny projekt, nie zadanie jednodniowe.

Dodaj do raportu rekomendację **czwartą, jeśli R1 potwierdzi**: uporządkowanie/skasowanie
`server/migrations-v2/` i dwóch fałszywych README — to osobna decyzja od źródła
odpowiedzi, ale zmierzona w tym samym dyżurze i warta osobnego zdania dla właściciela.

## R5 — LICZBA EKRANÓW I OSIĄGALNOŚĆ (rdzeń, dowodowy)

Wylicz WSZYSTKIE pliki `.tsx` modułu Assessment (`src/components/assessment/**`,
`src/views/*Assessment*`, `src/views/*DRD*`), policz je, i rozróżnij prawdziwe ekrany
(hub/workspace/report/matryca) od komponentów pomocniczych (modal/pole/plakietka).
Prześledź `src/routes/AppRoutes.tsx` i `src/components/navigation/Sidebar/menuConfig.ts`,
żeby ustalić, które ekrany są osiągalne z realnej nawigacji, a które są sierotami
(zaimportowane donikąd albo osiągalne wyłącznie z INNEGO modułu, np. przez Discovery).
Zweryfikuj i albo potwierdź, albo obal: `FreeAssessmentView.tsx` jest dziś nieosiągalny
z żadnej trasy; `/assessment/audits` nigdy nie było zarejestrowaną trasą (własny
komentarz `src/routes/routeConfig.ts:387-390`).

## R6 — KOREKTA `MODULE_ACCEPTANCE.md` (rdzeń, dokumentacyjny)

Dopisujesz na końcu
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/04_ASSESSMENT/MODULE_ACCEPTANCE.md` nową
sekcję (np. `## Dzień 240 — pomiar proweniencji odpowiedzi`) ze zmierzonym stanem z `§1`:
brak kolumny źródła na poziomie odpowiedzi, martwe migracje, sprzeczność
`server/migrations-v2/` vs `server/migrations/`, status `ASM-F-010`. **Nie kasujesz i nie
przepisujesz** istniejących wierszy — to dopisek, każde zdanie z `plik:linia`. Zakaz
wpisywania `FIXED`/`VERIFIED` — nic nie naprawiasz.

## R7 — RAPORT DYŻURU (rdzeń)

Struktura z `§R.2`, sekcja „TWIERDZENIA NIEZWERYFIKOWANE" obowiązkowa nawet jeśli pusta.
Dołącz tabelę mianowników i pełne wyjścia komend z `§0` i `R1`-`R5`.

---

# 4. TABELA LICENCJI PLIKOWYCH

Ten dyżur jest **wyłącznie pomiarowo-dowodowy** — zero zapisu produktowego.

| Zakres | Ścieżki |
|---|---|
| Zapis (WĄSKO, `R6`) | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/04_ASSESSMENT/MODULE_ACCEPTANCE.md` — WYŁĄCZNIE nowa sekcja na końcu pliku, zakaz kasowania/przepisywania istniejących wierszy |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY240_ASSESSMENT_REPORT.md` |
| Odczyt (ZAKAZ ZAPISU) | `src/components/assessment/**/*.tsx` (wszystkie, w tym `AssessmentHub.tsx`, `AssessmentQualityReviewPanel.tsx`, `drd/DrdHttpMethodWorkspaceScreen.tsx`, `artifacts/ArtifactLineagePanel.tsx`) · `src/views/AssessmentSessionEditorView.tsx`, `FreeAssessmentView.tsx`, `PublicMiniAssessmentView.tsx` · `src/components/Discovery/InsightDetailView.tsx` · `src/components/Initiatives/InitiativeSuggestionBadge.tsx` |
| Odczyt (ZAKAZ ZAPISU) | `server/src/routes/assessment/**`, `server/src/routes/v8/assessment.routes.ts`, `server/src/routes/assessment-enterprise.routes.ts`, `server/src/routes/method-core.routes.ts` · `server/src/services/assessment/**`, `AssessmentEvidenceService.ts` · `server/src/domain/**` |
| Odczyt (ZAKAZ ZAPISU) | `server/migrations/**` (wszystkie — w tym `248_assessment_enhancements.sql`, `000_initdb_core_tables.sql`, `000_z_core_baseline.sql`, `20261120_fresh_db_schema_gap_closure.sql`, `20260311_origin_tracking.sql`, `20260801_asm005_007_evidence_quality_output.sql`) · `server/migrations-v2/**` · `server/scripts/migrate.postgres.ts` (`Z18`-adjacent, nietykalny bezwzględnie) |
| Odczyt (ZAKAZ ZAPISU) | `docs/functional/05_assessment/README.md` · `docs/product/ASSESSMENT_CONCEPT_V4_2026-06-28.md` · `docs/product/ASSESSMENT_WORKBENCH_STANDARD_V3.md` |
| Odczyt (ZAKAZ ZAPISU) | `vitest.config.ts` · `tests/setup.ts` (`Z18`) · `server/src/database/Database.ts` |
| **Wszystko inne** | **TYLKO ODCZYT** — opisujesz potrzebę w raporcie z `plik:linia` i idziesz dalej |

**Nietykalne imiennie:** `vitest.config.ts` · `tests/setup.ts` · `Database.ts` ·
`server/scripts/migrate.postgres.ts` · każdy plik `server/migrations/**` (czytasz,
nie edytujesz — jakąkolwiek naprawę zgłaszasz w raporcie) · każdy inny
`MODULE_ACCEPTANCE.md` poza Assessment.

---

# 5. TWARDE ZASADY

- ★★ **CEL JEST POMIAR, NIE NAPRAWA.** Zero nowej kolumny, zero nowej migracji, zero
  zmiany routingu czy typu. Jeśli znajdziesz coś złamanego głębiej niż oczekiwałeś (np.
  trasa faktycznie rzucająca `500`) — opisujesz z `plik:linia`, NIE naprawiasz.
- ★★ **NIE UFAJ ŻADNEMU POJEDYNCZEMU ŹRÓDŁU.** `§1.2` pokazuje, że nawet całe README
  potrafi kłamać cztery miesiące. Każde twierdzenie o schemacie bazy musi mieć dowód
  z REALNEGO `\d tabela` na Twojej zmigrowanej bazie, nie z samej lektury pliku migracji.
- ★★ **STAN DANYCH CZYTASZ Z ŻYWEJ BAZY.** Liczby z `R3` liczysz Ty, na swoim
  kontenerze, po pełnych migracjach — nigdy nie przepisujesz liczby z tej instrukcji ani
  z raportu agenta badawczego, który mógł pracować na złym katalogu migracji.
- ★★ **ROZRÓŻNIAJ SZEŚĆ ZNACZEŃ SŁOWA „SOURCE".** Największa pułapka tego dyżuru to
  policzenie trafienia grepa na `sourceType`/`provenance` jako dowodu, że problem jest
  rozwiązany — sprawdź, na które z sześciu pytań z `§1.1` dane trafienie faktycznie
  odpowiada.
- ★ **PUŁAPKI ŚRODOWISKA — SPRAWDŹ KAŻDĄ U SIEBIE:** `server/src/database/Database.ts` ok.
  `:80-88` cicho podstawia atrapę bazy bez `RUN_DB_TESTS=1`; `Database.ts:686` atrapa zwraca
  `changes:1` dla KAŻDEGO `UPDATE`; `vitest.config.ts:210` przypina `DB_TYPE='sqlite'`;
  `tests/setup.ts:896` podmienia `global.fetch`; **komentarze i całe README bywają
  nieaktualne — ten dyżur sam jest tego dowodem (`§1.2`)**.
- ★ **`Z13`:** logi i pliki wynikowe NIE wchodzą do repo — leżą w
  `/private/tmp/cx-day240-assessment-artefakty`, raport podaje ścieżki i `shasum -a 256`.
- ★ **PUSH WYŁĄCZNIE NA `github-backup`.** `origin` jest PUBLICZNY.
- ★★ **SEKCJA „TWIERDZENIA NIEZWERYFIKOWANE" W RAPORCIE JEST OBOWIĄZKOWA.** Brak tej sekcji
  jest podstawą odrzucenia dyżuru.
