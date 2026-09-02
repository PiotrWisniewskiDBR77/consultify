# INSTRUKCJA DYŻURU nr 231 — Codex — „★★ DECK Z WIEDZY ORGANIZACJI — rzecz, której Gamma strukturalnie zrobić nie może: prezentacja powstaje z tego, co system WIE o kliencie (diagnoza, inicjatywy, wskaźniki, decyzje, historia), a nie z polecenia wpisanego ręcznie. Treść przed produkcją: najpierw konspekt z realnych danych organizacji, przeglądalny i edytowalny, dopiero potem slajdy (wzorzec „Generate outline" potwierdzony mechanicznie na koncie właściciela). Prowieniencja obowiązkowa: deck pamięta, z czego powstał — kolumny `source_type`/`source_id` na `presentation_decks` JUŻ ISTNIEJĄ i nikt ich nie zapisuje. Bramka jest TREŚCIOWA, nie strukturalna: wygenerowany deck ma nieść fakt z bazy wiedzy organizacji, którego nie było w poleceniu"

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
> **wyłącznie** `/private/tmp/cx-day231-gamma-zwiedzy`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `9fb7942a01`**
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
Zakres: ****17_AGENT_TERESA × PREZENTACJE — ostatnie ogniwo łańcucha „sygnał → wiedza → diagnoza → decyzja → inicjatywa → wykonanie → wynik → MATERIAŁ".** Fundament zweryfikowany na markerze `9fb7942a01` (potwierdź go sam komendami z §2, nie przepisuj): kontekst organizacji dociera do **wyrenderowanego promptu** — `server/src/services/ai/AIPipeline.ts:1782` (`buildOrganizationSection`) wołane w `:1566-1568`, sklejane `:1764`, prompt budowany `:1478` i wołany `:1326` (dyżur 205); model **sam** sięga po narzędzia — dyspozytor `server/src/services/ai/toolDefinitions.ts:583` (`executeToolCall`), `search_knowledge_base` definicja `:59`, case `:595`, executor `:886` (`executeKBSearch`), rodzina READ `getReadToolDefinitions` `:1489-1499`, pętla wielotury `server/src/services/ai/llmService.ts:1396-1398` (`stopWhen: stepCountIs`), fabryka `executeReadTool` `server/src/routes/ai.routes.ts:4939-5052` (dyżury 206 i 217); decki wchodzą do bazy wiedzy — `server/src/services/knowledge/artifactKnowledgeIndexer.ts:66` (`indexDeckArtifactForKnowledge`) wołane z `server/src/services/presentationGeneratorService.ts:2440` za bramką `:2430` (dyżury 209 i 215); zasięg i prywatność działają w obie strony — `server/src/services/ai/knowledgeDocAccessFilter.ts:11` jako JEDYNE źródło reguły, konsumenci `server/src/services/ai/embeddingService.ts:392` i `server/src/services/ragService.ts:317`, `:529`, `:619` (dyżury 210 i 213). **Dziura, którą zamykasz:** `server/src/services/presentationGeneratorService.ts:1505` (`generateOutline`) buduje konspekt z **szablonu i słów kluczowych** — `generateDefaultOutline:597`, `buildSystemTemplateRuntime`, `planSlides` — i **nie woła modelu, nie zna organizacji i nie dotyka bazy wiedzy**. Kontrakt: `docs/program/funkcje/ARCHITEKTURA_AGENTA_TERESY.md` §9 (pętla mądrości) i §12 (GF-AGT-02), `docs/program/funkcje/MODUL17_DOWOD_REALNYM_MODELEM.md` (konstrukcja dowodu treściowego), `docs/program/funkcje/GAMMA_G2_SESJA_NA_ZYWO.md` (odkrycie nr 3 — „Generate outline"), `docs/program/funkcje/GAMMA_G3_OBCHOD_MENU.md` („View source prompt" — deck pamięta pochodzenie)**.
Trasy front: `Kolejność z Gammy: **przycisk nazywa się „Generuj konspekt", nie „Generuj"** — konspekt jest przeglądalny i edytowalny **zanim** ruszy produkcja. Punkty wejścia dziś: `src/components/Presentations/PresentationWizard.tsx` (flaga bramek `:58`), `src/components/Presentations/wizard/ResultStep.tsx:21`, `src/components/Presentations/DeckBuilder/DeckBuilder.tsx` (`:48`, `:386`, `:668`), `src/components/ReportsAndPresentations/ReportsAndPresentationsHub.tsx:37,1516`. ★★ **Zmierz sam, czy krok konspektu jest dziś w ogóle pokazywany użytkownikowi** — trasa `POST /generate/outline` istnieje od dawna, co nie znaczy, że jakikolwiek ekran ją woła i renderuje wynik (ósmy kształt fałszywego gotowe: wołacz istnieje ≠ komponent się renderuje; warstw jest cztery, nie trzy). Jeżeli krok konspektu **jest** — rozszerzasz go o źródła; jeżeli **go nie ma** — to jest ustalenie do raportu i **osobna pozycja**, nie okazja do przebudowy kreatora. Zrzut: `dev-render/screens/day231-konspekt-z-wiedzy.tsx` + wpis w `dev-render/main.tsx` — konspekt z widocznymi **źródłami przy pozycjach**, dwa motywy. Tokeny `c-*`, zero `primary-*``. Trasy tył: ``POST /api/presentations/generate/outline` (`server/src/routes/presentations.routes.ts:1912`) — **to jest Twój punkt wejścia** · `POST /api/presentations/generate/deck` (`:1923`, woła `generateDeck` `server/src/services/presentationGeneratorService.ts:1683`) · `POST /api/presentations/decks` (`:1981`) · `GET /api/presentations/decks/:id` (`:2439`) · `GET /api/presentations/decks` (`:2402` — czyta już `pd.source_id` i `pd.source_refs_json`, zmierzone `:2409`) · `POST /api/presentation-studio/generate/preview` (`server/src/routes/presentationStudio.routes.ts:414`) i `/generate` (`:590`). Pętla wiedzy: `executeToolCall('search_knowledge_base', …)` (`server/src/services/ai/toolDefinitions.ts:583`, `:886`), filtr zasięgu `server/src/services/ai/knowledgeDocAccessFilter.ts:11`, wyprowadzenie listy projektów z realnego członkostwa `server/src/services/ai/toolDefinitions.ts:990` (`SELECT project_id FROM project_members WHERE user_id = ?`), użycie `:1161`, przekazanie do RAG `:1167`. Routery: `server/src/Gateway.ts:1201` i `:1226``.

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
WT=/private/tmp/cx-day231-gamma-zwiedzy
MARKER=9fb7942a01

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day231-gamma-zwiedzy-20260901 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day231-gamma-zwiedzy/config.worktree"
cat "$VAULT/worktrees/cx-day231-gamma-zwiedzy/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day231-gamma-zwiedzy-scratch
mkdir -p /private/tmp/cx-day231-gamma-zwiedzy-artefakty

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
git -C "$VAULT" log --oneline 9fb7942a01..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only 9fb7942a01..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day231-gamma-zwiedzy-20260901
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 9fb7942a01..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `10` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA: dzisiejszy konspekt NIE zna organizacji i NIE wola modelu
sed -n '1505,1560p' server/src/services/presentationGeneratorService.ts
grep -n "llmService\|buildResolvedContext\|search_knowledge_base\|executeToolCall" server/src/services/presentationGeneratorService.ts
#   oczekiwane: generateOutline ok. :1505 — sciezka szablon/slowa kluczowe (generateDefaultOutline ok. :597);
#   z wolan modelu tylko dynamiczny import ok. :1964-1965 (slajd konkluzji), ZERO wolan bazy wiedzy

# (2) TEZA (205): kontekst organizacji REALNIE trafia do wyrenderowanego promptu
grep -n "buildOrganizationSection" server/src/services/ai/AIPipeline.ts
#   oczekiwane: definicja ok. :1782 ORAZ wolanie ok. :1566-1568 (parts.push(...))

# (3) TEZA (206): dyspozytor narzedzi i `search_knowledge_base` istnieja
grep -n "export async function executeToolCall\|name: *'search_knowledge_base'\|case 'search_knowledge_base'" server/src/services/ai/toolDefinitions.ts
#   oczekiwane: executeToolCall ok. :583; definicja narzedzia ok. :59; case ok. :595

# (4) TEZA (210/213): filtr zasiegu ma JEDNO zrodlo i jest fail-closed
sed -n '11,25p' server/src/services/ai/knowledgeDocAccessFilter.ts
grep -rn "buildKnowledgeDocAccessFilter\|knowledgeDocAccessFilter" server/src/services/ai/embeddingService.ts server/src/services/ragService.ts | head
#   oczekiwane: brak kolumny scope/ai_visibility/sensitivity -> '1 = 0';
#   konsumenci embeddingService.ts ok. :392 oraz ragService.ts ok. :317, :529, :619

# (5) TEZA (209/215): deck JUZ wchodzi do bazy wiedzy
grep -n "indexDeckArtifactForKnowledge\|isArtifactKnowledgeIndexEnabled" server/src/services/presentationGeneratorService.ts
grep -n "export async function indexDeckArtifactForKnowledge\|export async function indexReportArtifactForKnowledge" server/src/services/knowledge/artifactKnowledgeIndexer.ts
#   oczekiwane: brama ok. :2430 i wolanie ok. :2440 w generatorze; eksporty ok. :66 i :70 w indekserze

# (6) TEZA: kolumny prowieniencji ISTNIEJA i NIKT ich nie zapisuje
grep -rn "source_type\|source_id" server/migrations/20260719_baseline_gap.sql | sed -n '1,4p'
grep -rn "source_type" server/src/routes/presentations.routes.ts | head
grep -rn "UPDATE presentation_decks SET" server/src/routes/presentations.routes.ts | head
#   oczekiwane: kolumny obecne (baseline_gap ok. :13358 source_id, :13362 source_type,
#   :13360 source_refs_json; indeks idx_pd_source ok. :16421); ODCZYT ok. :2409;
#   ZERO zapisow source_type/source_id przy tworzeniu decku. Jezeli znajdziesz zapis — "Korekty"

# (7) TEZA: kolumna na konspekt ISTNIEJE — nie dokladasz nowej
grep -n "outline_json" server/migrations/750_presentation_decks_00base.sql
grep -n "outline_json" server/src/routes/presentations.routes.ts | head -3
#   oczekiwane: kolumna ok. :47 w migracji bazowej; parsowanie w trasie ok. :751

# (8) TEZA: realnego modelu NIE WOLNO wolac z pliku testowego
sed -n '893,906p' tests/setup.ts
#   oczekiwane: bezwarunkowa podmiana `global.fetch` na atrape zwracajaca 200 z pusta trescia
#   (ok. :896). Dlatego dowod modelem idzie WYLACZNIE przez skrypt tsx

# (9) TEZA: istnieja gotowe sondy tsx — kopiujesz wzorzec, nie wymyslasz swojego
ls -la server/scripts/modul17-real-model-probe.ts server/scripts/day217-real-model-probe.ts server/scripts/modul17-mock-verify.ts
sed -n '20,32p' server/scripts/modul17-real-model-probe.ts
#   oczekiwane: trzy pliki obecne; naglowek opisuje uruchomienie
#   (`set -a; . ~/.consultify-openrouter; set +a` + zmienne w tej samej linii)

# (10) TEZA: klucz modelu ma twardy fail-fast, wiec brak klucza NIE da falszywej zieleni
grep -n "OPENROUTER_API_KEY" server/scripts/modul17-real-model-probe.ts server/scripts/day217-real-model-probe.ts
#   oczekiwane: `if (!process.env.OPENROUTER_API_KEY) throw ...` ok. :82 i ok. :73
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day231-gamma-zwiedzy-20260901` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6175`. Twój JEDYNY port harnessu to `5138 i 5139`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day231-pg`**. **ZAKAZANE:** `5000 (macOS Control Center, zajety na stale), 5037 (adb), 5060-5061, 6012, 5433, 6047, 6054-6172, 5010-5133, 6404-6411 — oraz porty pozostalych dyzurow fali 18, ktore sa cudze: bazy 6173-6176 i harness 5134-5141 z wyjatkiem Twoich, wymienionych w tym wierszu wyzej. Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w ``R1`-`R4` — dokładnie JEDNA nowa flaga `ENABLE_DECK_FROM_KNOWLEDGE`, **default OFF**, wzorem `server/src/config/FeatureFlags.ts:55` i `:247-248`. **Zakaz zmiany domyślek** `ENABLE_TERESA_TOOL_LOOP` (`:36`, `:153`, dziś OFF), `ENABLE_ARTIFACT_KNOWLEDGE_INDEX` (`:55`, `:247-248`, dziś OFF) i `ENABLE_TERESA_TOOL_LOOP_WRITE` (`:37`, `:157`, dziś OFF) — na czas swoich pomiarów włączasz je **zmienną środowiskową w linii komendy**, nigdy zmianą wartości domyślnej w kodzie`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/services/aiRoleGuard.ts` · `server/src/services/chatPermissionService.ts` · `server/src/services/aiPolicyEngine.ts` · `server/src/services/aiRunLedgerService.ts` · `server/src/services/ai/chatPolicyGateway.ts` · `server/src/services/ai/webSearchGovernance.ts` · `server/src/services/ai/sideEffectTools.ts` · `server/src/services/ai/knowledgeDocAccessFilter.ts` · `server/src/routes/presentationExportGate.ts` · `server/src/middleware/auth.middleware.ts` · `server/src/middleware/v8FeatureGate.middleware.ts` · `server/src/middleware/resultsInternalBetaVisibility.middleware.ts` · `server/src/database/Database.ts` · `vitest.config.ts` · `tests/setup.ts``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY231_GAMMA_ZWIEDZY_REPORT.md`. Nie zmieniasz żadnego `MODULE_ACCEPTANCE.md` — ten dyżur buduje za flagą domyślnie WYŁĄCZONĄ i **nie domyka odbioru żadnego modułu**; odbiór należy do nadzorcy po akcepcie właściciela na zrzucie. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day231-gamma-zwiedzy-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day231-gamma-zwiedzy-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **ZAKAZ BUDOWY DRUGIEJ DROGI DO BAZY WIEDZY.** Do wiedzy sięgasz WYŁĄCZNIE przez istniejący `executeToolCall('search_knowledge_base', …)` (`server/src/services/ai/toolDefinitions.ts:583`, `:886`), który przechodzi przez filtr zasięgu `server/src/services/ai/knowledgeDocAccessFilter.ts:11`. Zakaz własnego `SELECT`-a z `knowledge_docs`, `knowledge_chunks` i `ai_knowledge_embeddings` w kodzie generatora decku | Filtr zasięgu jest **jedynym** źródłem reguły widoczności (dyżur 213) i jest **fail-closed** przy braku kolumn (`knowledgeDocAccessFilter.ts:20-23` → `'1 = 0'`). Własny `SELECT` omija go po cichu i produkuje deck, który pokazuje klientowi treść, do której wołający nie ma prawa — czyli dokładnie tę awarię, którą dyżury 210 i 213 zamykały. Dodatkowo `server/src/services/ragService.ts` miał zmierzoną ścieżkę **fail-OPEN** przy braku kolumny `scope`, załataną dopiero FIX-em 213-2/213-3 (`:529`, `:619`) |

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
cd /private/tmp/cx-day231-gamma-zwiedzy

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day231-pg psql -U postgres -d cx231 \
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
cd /private/tmp/cx-day231-gamma-zwiedzy

docker run -d --name cx-day231-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx231 \
  -p 127.0.0.1:6175:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day231-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6175/cx231 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6175/cx231 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day231-gamma-zwiedzy && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6175/cx231 \
JWT_SECRET=cx231-lokalny-sekret-testowy-nie-uzywany-nigdzie-indziej \
npx vitest run server/src/services/__tests__ server/src/routes/__tests__ server/src/services/knowledge/__tests__ tests/integration --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day231-gamma-zwiedzy-artefakty/day231-pakiet.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day231-gamma-zwiedzy && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/services/__tests__ server/src/routes/__tests__ server/src/services/knowledge/__tests__ tests/integration --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day231-gamma-zwiedzy-artefakty/day231-pakiet.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day231-gamma-zwiedzy/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day231-pg psql -U postgres -d cx231 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day231-pg`.
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
> **(e) **Trzy flagi bramkujące fundament są DOMYŚLNIE WYŁĄCZONE** — `ENABLE_TERESA_TOOL_LOOP` (`FeatureFlags.ts:36`, `:153`), `ENABLE_TERESA_TOOL_LOOP_WRITE` (`:37`, `:157`), `ENABLE_ARTIFACT_KNOWLEDGE_INDEX` (`:55`, `:247-248`). Bez ustawienia ich **w tej samej linii komendy** Twój przebieg pokaże „model nie sięgnął po wiedzę" i „deck nie trafił do bazy wiedzy" — i będzie to prawda o konfiguracji, a nie o produkcie. Helper `isArtifactKnowledgeIndexEnabled()` (`:278-280`) czyta `process.env` **świeżo przy każdym wywołaniu**, więc ustawienie w linii komendy działa; wpisz do raportu, jak to udowodniłeś. Druga strona tej samej pułapki: **hooki indeksacji są `void`/fire-and-forget** (`presentationGeneratorService.ts:2431`, `:2453`; `documentStudioService.ts:1264`), więc cicha porażka indeksacji **nie przewraca** generacji — brak dokumentu w bazie wiedzy nie da żadnego błędu, tylko `logger.warn`**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day231-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day231-gamma-zwiedzy-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (konspekt z wiedzy) · R3 (prowieniencja) · R5 (bramka treściowa: dwa przebiegi, para dowodowa)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6175` albo `5138 i 5139` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6175` albo `5138 i 5139`** (`Z7`).

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

> **Gamma ma formę bez wiedzy. Consultify ma wiedzę bez formy.**
> Gamma nigdy nie będzie wiedziała, że ten wskaźnik spadł w trzecim kwartale ani że rok temu
> próbowano już czegoś podobnego. **Strukturalnie nie może.** My możemy — i to jest jedyne
> miejsce, gdzie nie musimy ich dogonić, bo tam ich nie ma.

To jest **cała stawka tej fali**. Dyżury 229 i 230 naprawiają formę. **Ten robi rdzeń.**

Nasza własna dokumentacja mówi to samo od dawna: Consultify **nie jest** „generatorem dokumentów
bez powiązania ze źródłami", a łańcuch obietnicy brzmi **sygnał → wiedza → diagnoza → decyzja →
inicjatywa → wykonanie → wynik → MATERIAŁ**. **Materiał jest ostatnim ogniwem** — i dziś jest
jedynym, które o poprzednich siedmiu nic nie wie.

## Fundament jest gotowy od 31.08 — i masz go ZWERYFIKOWAĆ, nie przyjąć

Nadzorca zweryfikował go w kodzie na markerze `9fb7942a01`. **Powtórz tę weryfikację u siebie**
(komendy (2)-(5) w `§0`) — to nie jest formalność, tylko warunek, żeby Twój przebieg cokolwiek
znaczył. Zmierzone:

| ogniwo | dowód w kodzie |
|---|---|
| **205 — kontekst organizacji dociera do WYRENDEROWANEGO promptu** | `server/src/services/ai/AIPipeline.ts:1782` (`buildOrganizationSection`), realnie wołane w `:1566-1568` (`parts.push(...)`), sklejane `:1764`, prompt budowany `:1478`, wołany `:1326`. Źródło danych: `server/src/services/aiContextBuilder.ts:727-757` → `organizationContextService.buildResolvedContext()` (`:585`) → `organization_context_claims`, `organization_context_items`, `interview_insights`, `knowledge_docs`, `initiative_kpis`, `financial_model_versions` i dalsze |
| **206 — model SAM sięga po narzędzia** | dyspozytor `server/src/services/ai/toolDefinitions.ts:583` (`executeToolCall`), `switch` od `:592`; rodzina READ (11 narzędzi) `getReadToolDefinitions` `:1489-1499`; pętla wielotury `server/src/services/ai/llmService.ts:1396-1398` (`stopWhen: stepCountIs`), limit iteracji `AIPipeline.ts:596-599` (default 4, clamp 1..8); fabryka `executeReadTool` `server/src/routes/ai.routes.ts:4939-5052` z weryfikacją `projectId` względem organizacji z tokena `:4944-4961` |
| **206 — `search_knowledge_base` istnieje i ma bramkę** | definicja `toolDefinitions.ts:59`, case `:595`, executor `:886` (`executeKBSearch`); lista projektów z **realnego członkostwa** `:990` (`SELECT project_id FROM project_members WHERE user_id = ?`), użycie `:1161`, przekazanie do RAG `:1167` |
| **207 — propozycja zapisu z zatwierdzeniem człowieka** | `server/src/services/aiActionExecutor.ts:331` (`requestChatToolProposal`, `_forceApproval:true` `:355`), `:389` (`requestAction`, `requiresApproval` `:455-457`, status `:511`), `:664` (`approveAction`), `:863` (`executeAction`), **brama `:867-868`** + druga warstwa `:887-889` |
| **207 — wzorzec prowieniencji** | `aiActionExecutor.ts:1221-1223` → `sourceType:'ai_chat_proposal'`, `sourceId:action.id`; zapis kolumn `server/src/services/personalTask/createPersonalTaskService.ts:187-190` (tylko gdy OBA niepuste `:148-149`) |
| **209 + 215 — dokumenty, DECKI i raporty wchodzą do bazy wiedzy** | `server/src/services/knowledge/artifactKnowledgeIndexer.ts:26` (`indexArtifactForKnowledge`), eksporty: dokument `:62`, **deck `:66`**, raport `:70`; wołania produkcyjne: `documentStudioService.ts:1264`, **`presentationGeneratorService.ts:2440` (brama `:2430`)**, `reportGenerationService.ts:1879` (brama `:1849`) |
| **210 + 213 — zasięg i prywatność w obie strony** | `server/src/services/ai/knowledgeDocAccessFilter.ts:11` — **JEDNO** źródło reguły, **fail-closed** przy braku kolumn `:20-23` (`'1 = 0'`); konsumenci `server/src/services/ai/embeddingService.ts:392` (wołane `:249` i `:318`) oraz `server/src/services/ragService.ts:317`, `:529`, `:619` |
| **217 — dowód na żywym modelu, że całość działa jako jedno** | sondy `tsx`: `server/scripts/modul17-real-model-probe.ts`, `server/scripts/day217-real-model-probe.ts`; twardy fail-fast bez klucza `:82` i `:73` |

## ★★ Dziura, którą zamykasz — zmierzona, jednozdaniowa

**`server/src/services/presentationGeneratorService.ts:1505` (`generateOutline`) buduje konspekt
z szablonu i słów kluczowych. Nie woła modelu. Nie zna organizacji. Nie dotyka bazy wiedzy.**

Ścieżki, którymi dziś idzie: `setup.templateId` → `presentation_templates` → `generateOutlineFromTemplate`
(`:1523-1533`); albo `templateFamily`/`deckType` → `buildSystemTemplateRuntime` (`:1546`); albo
`generateDefaultOutline` (`:597`). Potem `planSlides` i `applyDeckDetailLevel` (`:774`).
W całym pliku (2801 linii) jedyne wywołanie modelu to dynamiczny import przy slajdzie konkluzji
(`:1964-1965`), a wystąpień bazy wiedzy jako **źródła treści** — zero (`:2432` i dalej to
indeksacja gotowego decku **do** bazy wiedzy, czyli kierunek odwrotny).

Ten sam obraz potwierdza pomiar produktowy: droga „biblioteka szablonów" ma **zero modelu** —
dopasowanie po słowach kluczowych — i *„użytkownik nadal dostaje puste miejsca"*
(`docs/program/funkcje/GAMMA_G0_POMIAR.md`).

## Kolejność potwierdzona mechanicznie u Gammy: TREŚĆ PRZED FORMĄ

Na koncie właściciela, w realnym przebiegu: **przycisk po wpisaniu polecenia nazywa się
„Generate outline", nie „Generate"**. Gamma **najpierw napisała konspekt** — 10 tytułów z tezami,
do przejrzenia i edycji — i **dopiero po zatwierdzeniu ruszyła produkcja slajdów**
(`docs/program/funkcje/GAMMA_G2_SESJA_NA_ZYWO.md`, odkrycie nr 3).

**U nas trasa `POST /api/presentations/generate/outline` istnieje od dawna**
(`server/src/routes/presentations.routes.ts:1912`) i **kolumna `outline_json` też**
(`server/migrations/750_presentation_decks_00base.sql:47`, parsowanie w trasie `:751`).
Czyli **szkielet kolejności jest**. Brakuje w nim wiedzy.

## ★ Prowieniencja: „View source prompt" — u nas kolumny JUŻ SĄ i nikt ich nie zapisuje

Gamma pod `…` ma pozycję **`View source prompt`**, która cofa do ekranu generowania **z zachowanym
poleceniem ORAZ konspektem** — czyli prezentacja niesie pełne pochodzenie i da się z niego
wygenerować ponownie (`docs/program/funkcje/GAMMA_G3_OBCHOD_MENU.md`).

Zmierzone u nas: `presentation_decks` **ma już** kolumny `source_id` i `source_type`
(`server/migrations/20260719_baseline_gap.sql:13358` i `:13362`, domyślka `'manual'`),
`source_refs_json` (`:13360`) oraz indeks `idx_pd_source` na `(source_type, source_id)` (`:16421`).
Trasa listująca **je odczytuje** (`presentations.routes.ts:2409` — `pd.source_id`,
`pd.source_refs_json`). **Nikt ich nie zapisuje przy tworzeniu decku.**
★ Ciekawostka do raportu: pierwotna migracja `601_presentation_decks_traceability.sql:4-5` leży
w `server/migrations/never-ran/` — kolumny weszły wyłącznie przez `baseline_gap`.
**Czyli to nie jest migracja do napisania. To jest zapis do podłączenia.**

## Czego ten dyżur świadomie NIE robi

- **Nie robi wyglądu.** Motyw, typografia, archetypy — dyżur 229.
- **Nie robi ostrzeżeń o przepełnieniu** — dyżur 230.
- **Nie robi agenta redagującego** — dyżur 232.
- **Nie przebudowuje kreatora prezentacji.** Jeżeli krok konspektu nie jest dziś pokazywany
  użytkownikowi — **to jest ustalenie do raportu i osobna pozycja**, nie okazja do przebudowy.

---

# 2. TEZY ZLECENIA

| # | Teza | Jak sprawdzasz |
|---|---|---|
| T1 | Dzisiejszy konspekt nie zna organizacji i nie woła modelu | komenda (1) |
| T2 | Kontekst organizacji realnie trafia do wyrenderowanego promptu (205) | komenda (2) |
| T3 | Dyspozytor narzędzi i `search_knowledge_base` istnieją (206) | komenda (3) |
| T4 | Filtr zasięgu ma jedno źródło i jest fail-closed (210/213) | komenda (4) |
| T5 | Deck już wchodzi do bazy wiedzy (209/215) | komenda (5) |
| T6 | Kolumny prowieniencji istnieją i nikt ich nie zapisuje | komenda (6) |
| T7 | Kolumna `outline_json` istnieje — nie dokładasz nowej | komenda (7) |
| T8 | `tests/setup.ts` podmienia `global.fetch` — model tylko przez `tsx` | komenda (8) |
| T9 | Istnieją gotowe sondy `tsx` — kopiujesz wzorzec | komenda (9) |
| T10 | Klucz modelu ma twardy fail-fast — brak klucza nie da fałszywej zieleni | komenda (10) |

---

# 3. POZYCJE DYŻURU

## R1 — KONSPEKT Z WIEDZY ORGANIZACJI (rdzeń, sedno dyżuru)

Nowa ścieżka **obok** dzisiejszej, za flagą `ENABLE_DECK_FROM_KNOWLEDGE` (default OFF).
Przy fladze OFF `generateOutline` (`presentationGeneratorService.ts:1505`) zachowuje się
**bajt w bajt jak dziś** — to jest osobna asercja, nie domysł.

Przy fladze ON, dla decku o zadanej organizacji i projekcie, konspekt powstaje tak:

1. **Kontekst organizacji** — przez istniejący `buildOrganizationSection`
   (`AIPipeline.ts:1782`, wołane `:1566-1568`). **Nie budujesz drugiego buildera kontekstu.**
2. **Model sam sięga po wiedzę** — przez istniejącą pętlę narzędziową READ
   (`llmService.ts:1396-1398`) i istniejący dyspozytor `executeToolCall`
   (`toolDefinitions.ts:583`), z narzędziem `search_knowledge_base` (`:59`, `:595`, `:886`).
   **Nie dyktujesz modelowi argumentów wywołania** — to była wada pierwszej wersji dowodu
   modułu 17 i jest opisana imiennie w `docs/program/funkcje/MODUL17_DOWOD_REALNYM_MODELEM.md`.
3. **Wynikiem jest konspekt**, nie slajdy: dla każdej pozycji **tytuł**, **teza jednym zdaniem**
   i **lista źródeł** (`source_type` + `source_id` + krótka etykieta), z których teza wynika.

**Kształt pozycji konspektu — wiążący:**

```
{
  tytul: string,
  teza: string,              // jedno zdanie, to jest „co z tego wynika"
  archetyp: string,          // z siedmiu (patrz dyżur 229) — sugestia, nie wyrok
  zrodla: Array<{ typ: string, id: string, etykieta: string }>   // MOŻE być puste
}
```

★★ **`zrodla` MOŻE być puste — i wtedy ma być puste, a nie wypełnione czymkolwiek.**
Slajd bez źródła jest uczciwy. Slajd z **wymyślonym** źródłem jest gorszy niż brak funkcji,
bo niszczy jedyną rzecz, którą mamy nad Gammą: **wiarygodność**.

## R2 — KONSPEKT PRZEGLĄDALNY I EDYTOWALNY **PRZED** PRODUKCJĄ (rdzeń)

Wzorzec Gammy: **„Generuj konspekt"**, potem przegląd i edycja, **dopiero potem** slajdy.

1. **Zmierz, czy krok konspektu jest dziś w ogóle POKAZYWANY użytkownikowi.**
   Trasa `POST /generate/outline` (`presentations.routes.ts:1912`) istnieje — to **nie znaczy**,
   że jakikolwiek ekran ją woła i renderuje wynik. To jest w tym programie policzony kształt
   fałszywego gotowe: **wołacz istnieje ≠ komponent się renderuje**, a warstw jest cztery,
   nie trzy. Sprawdź `src/components/Presentations/PresentationWizard.tsx`,
   `src/components/Presentations/wizard/*`, `src/services/presentationExport.ts`.
2. Jeżeli krok **jest** — rozszerzasz go o **widoczne źródła przy pozycjach** i o możliwość
   edycji tezy przed produkcją.
3. Jeżeli krok **go nie ma** — **to jest ustalenie do raportu**, a Ty budujesz **minimalny**
   ekran przeglądu za flagą, w harnessie `dev-render`, i **mówisz wprost, że nie jest wpięty
   w kreator produkcyjny**. Zakaz przebudowy kreatora.

## R3 — ★ PROWIENIENCJA: DECK PAMIĘTA, Z CZEGO POWSTAŁ (rdzeń)

Dwa poziomy, oba obowiązkowe:

**(a) Poziom decku.** Przy tworzeniu decku ścieżką z `R1` zapisujesz
`presentation_decks.source_type` i `source_id` — kolumny **już istnieją**
(`20260719_baseline_gap.sql:13358`, `:13362`), indeks też (`:16421`).
Wartość `source_type` ustalasz Ty i **uzasadniasz** (wzorzec z 207 to `'ai_chat_proposal'`;
tu naturalne byłoby coś w rodzaju `'org_knowledge_outline'` — ale to Twoja decyzja i Twój wpis
do raportu). Do `source_refs_json` (`:13360`) trafia **lista źródeł konspektu**.

**(b) Poziom liczby na slajdzie.** *„Każda liczba na slajdzie ma mieć źródło."*
Zmierz, czy `deck_json` / `unified_json` mają dziś miejsce na atrybucję per element; jeżeli nie —
dokładasz je **addytywnie** i **tolerancyjnie** (stary deck bez tego pola musi się dalej
renderować — to jest osobna asercja).
★ Wsparcie z pomiaru: w slajdzie liczbowym **źródło jest polem obowiązkowym**
(`GAMMA_G1_SPECYFIKACJA.md` §5, slajd 3) — *„Gamma tego nie robi — i to jest dokładnie ta różnica,
która decyduje, czy zarząd uzna slajd za wiarygodny czy za marketing"*.

**Jeżeli dokładasz migrację** — jest **addytywna** (`ALTER TABLE … ADD COLUMN IF NOT EXISTS`),
z datą w nazwie (`20260901_*.sql`), i **musi przejść na PUSTEJ bazie od zera**.
★★ Pułapka policzona w tym programie: migracja czytająca kolumnę dodawaną **później**
w kolejności wywraca cały łańcuch przy odtworzeniu po awarii. Runner sortuje fazami
(`server/scripts/migrate.postgres.ts`, `sortMigrationsDeterministically`): najpierw
**NUMEROWANE**, potem **DATOWANE** wg kalendarza. `presentation_decks` powstaje w fazie
numerowanej (`750_…`), więc Twoja datowana migracja biegnie po niej — **ale to masz udowodnić
pełnym przebiegiem na pustej bazie i drugim przebiegiem (idempotencja), a nie założyć**.

## R4 — ZASIĘG I PRYWATNOŚĆ: DECK NIE MOŻE POKAZAĆ WIĘCEJ, NIŻ WOŁAJĄCY MA PRAWO (rdzeń)

Do wiedzy sięgasz **wyłącznie** przez `executeToolCall('search_knowledge_base', …)`
(`toolDefinitions.ts:583`, `:886`), który przechodzi przez
`knowledgeDocAccessFilter.ts:11`. **Zakaz własnego `SELECT`-a** z `knowledge_docs`,
`knowledge_chunks` i `ai_knowledge_embeddings` w kodzie generatora decku.

**Dowód, obie strony, na realnym Postgresie:**
- dokument w zasięgu wołającego → jego treść **wpływa** na konspekt;
- **imiennie zaseedowany** dokument spoza zasięgu (cudzy projekt / cudza organizacja /
  `sensitivity='confidential'`) → asercja na **NIEOBECNOŚĆ** jego markera w konspekcie i w decku.

★★ **Asercja na nieobecność, nie na liczbę wyników.** `X/X PASS` bez asercji na nieobecność
imiennie zaseedowanego rekordu jest w tym programie podejrzane z urzędu.
★ **Zakaz `--retry`** w tym pakiecie: zmierzono wektor, w którym test izolacji **leczy się
skutkiem własnego ataku**.

## R5 — ★★ BRAMKA TREŚCIOWA (rdzeń; **to jest cały dyżur w jednym punkcie**)

**Bramka jest TREŚCIOWA, nie strukturalną.** Nie sprawdzasz, że deck ma 10 slajdów i pole
`sources`. Sprawdzasz, że **deck niesie fakt, którego model nie mógł znać inaczej niż z bazy
wiedzy organizacji.**

### R5a — konstrukcja faktu (czytaj uważnie; poprzednie dwie próby poległy TU, nie na produkcie)

`docs/program/funkcje/MODUL17_DOWOD_REALNYM_MODELEM.md` zapisuje trzy błędy konstrukcji dowodu,
wszystkie popełnione przez nadzorcę, nie przez produkt. **Nie powtórz ich:**

1. **Znacznik w TYTULE dokumentu jest bezwartościowy**, jeżeli tytuł jest w prompcie —
   test nie odróżni „znalazł w bazie" od „przepisał z pytania". **Fakt idzie w TREŚĆ dokumentu.**
2. **Żądanie dosłownego cytatu jest kruche wobec parafrazy.** Model streszcza i to jest jego
   poprawne zachowanie. **Kryterium to obecność FAKTU, nie brzmienia.**
3. ★ **Nazwa własna nie może dzielić rdzenia słownego z niczym, co widać w prompcie.**
   Zmierzone: fakt-znacznik brzmiał `Marchewka-7`, a projekt nazywał się „Pilotaż Retencji…" —
   model miał pod ręką naturalny substytut („the pilot program …") i go użył zamiast sięgnąć
   po wewnętrzny kod. **Semantyczna nadwyżka wystarczy, żeby dowód przestał rozstrzygać.**

**Konstrukcja obowiązująca w tym dyżurze:**
- Fakt = **dwie liczby losowe, niezgadywalne**, obie **wyłącznie w treści** dokumentu w bazie
  wiedzy organizacji (np. wartość wskaźnika i wartość odniesienia).
- **Druga liczba jest mocniejszym dowodem niż pierwsza, bo nikt o nią nie pyta.**
  Tak właśnie rozstrzygnięto punkt (b) modułu 17: *„Sceptyk pyta: skąd model wziął 51,2 %?
  Nie z pytania, nie z tytułu, nie z ogólnej wiedzy. Z dokumentu."*
- **Zero znacznika, zero faktu, zero tytułu dokumentu w poleceniu.**
- ★ **Normalizuj białe znaki przed sprawdzeniem obecności.** Zmierzona pułapka: strumień modelu
  potrafi dać `63 . 4 %`, przez co proste sprawdzenie zwraca `False` przy poprawnym wyniku.
  **Waliduj sondę na znanym przypadku, zanim jej zaufasz** — to dotyczy też sprawdzeń
  jednolinijkowych.

### R5b — KROK OBOWIĄZKOWY PRZED MODELEM: weryfikacja atrapą, która woła PRAWDZIWY executor

Wzorzec zmierzony i skuteczny (`MODUL17_DOWOD_REALNYM_MODELEM.md`, KROK 2, plus skrypt
`server/scripts/modul17-mock-verify.ts`): atrapa podmienia **wyłącznie** `llmService.callStream`
na obiekt, który i tak woła **PRAWDZIWY** `context.executeReadTool` — ten sam callback, którego
używa `ai.routes.ts` dla realnego modelu — z argumentami wskazującymi zasięg projektu.
Realna trasa HTTP, realna baza, **zero LLM**.

**Dopiero po `PASS` tego kroku wolno Ci uruchomić model.** Uruchomienie modelu przed nim jest
marnowaniem budżetu na diagnozowanie mechaniki, którą można sprawdzić za darmo.

### R5c — przebieg z realnym modelem: budżet, zakazy, wyjścia

**Budżet: DWA PRZEBIEGI. Jednostka limitu = przebieg (jedno wygenerowanie konspektu).
Zakaz ponawiania nieudanego przebiegu.** Przy powtórnym „nie" — **STOP z uczciwym opisem**,
nie trzeci przebieg.

- **Model wołasz WYŁĄCZNIE ze skryptu `tsx`, NIGDY z pliku `*.test.ts`.**
  Powód zmierzony: `tests/setup.ts:896` **bezwarunkowo** podmienia `global.fetch` na atrapę
  zwracającą `200` z pustą treścią. Test „z realnym modelem" jest testem z atrapą udającą model.
- Wzorce do skopiowania: `server/scripts/modul17-real-model-probe.ts`,
  `server/scripts/day217-real-model-probe.ts`. Oba mają twardy fail-fast bez klucza
  (`:82`, `:73`) — czyli brak klucza **nie da fałszywej zieleni**.
- Licencja na klucz: `~/.consultify-openrouter`, **jedyna dozwolona komenda źródłowa**
  `set -a; . ~/.consultify-openrouter; set +a`. Nie kopiujesz pliku, nie przenosisz go do
  repozytorium, nie wpisujesz treści do `.env`, `docker-compose*` ani żadnej komendy.
  **`Z40` bez wyjątku:** wartość klucza nie pojawia się nigdzie; pokazujesz `obecny`/`nieobecny`
  przez `env | sed 's/=.*//' | grep -x 'OPENROUTER_API_KEY'`.
  Do raportu: **nazwa modelu** (nigdy klucza) i **zmierzona** liczba rund z logu.
- ★ **Argumenty wywołania narzędzia czytasz z LOGU SERWERA, nie z SSE** — zmierzone:
  SSE nigdy nie niesie surowych argumentów ani wyniku narzędzia (strażnik poufności).

### R5d — para dowodowa: dwa przebiegi, dwa wyjścia, jedno rozstrzygnięcie

| Przebieg | Warunek | Oczekiwane |
|---|---|---|
| **ZIELONY** | flaga ON, dokument z faktem w zasięgu organizacji | **obie liczby** obecne w konspekcie/decku; model wywołał `search_knowledge_base` **sam** |
| **CZERWONY (mutacja)** | ta sama rozmowa, **dostęp do wiedzy odcięty** | deck **traci fakt** — żadna z liczb się nie pojawia |

**Mutację odcinającą dostęp wykonujesz w JEDNYM, nazwanym miejscu** i podajesz w raporcie,
w którym (kandydaci: rodzina narzędzi READ pusta, flaga pętli OFF, filtr zasięgu zwracający
`'1 = 0'`). **Wyjścia OBU przebiegów wchodzą do raportu dosłownie.**

★★ **Uczciwy werdykt dopuszcza słowo „nie działa".** Jeżeli fakt nie przeszedł — piszesz to
i **zatrzymujesz się**. W tym programie zameldowanie porażki i zatrzymanie się bez trzeciego
przebiegu **zostało uznane za poprawne zachowanie** i tak zostaje w rejestrze. Rozstrzyganie
„czy kryterium było dobrze postawione" należy do nadzorcy, nie do Ciebie.

## R6 — ZRZUTY (rdzeń dowodowy, `CLAUDE.md` §7)

`dev-render/screens/day231-konspekt-z-wiedzy.tsx` + wpis w `dev-render/main.tsx`.
Konspekt z **widocznymi źródłami przy pozycjach**, dwa motywy, `mean_luma` obu, różnica **> 150**.
★ W raporcie piszesz **wprost**, czy dane na zrzucie pochodzą z **realnego przebiegu**, czy
z propsów w harnessie. Zrzut zamockowanej powłoki **nie jest dowodem renderu**.

---

# 4. TABELA LICENCJI PLIKOWYCH

Licencja obejmuje całą ścieżkę: kontekst → pętla narzędziowa → konspekt → przegląd → produkcja →
prowieniencja → zasięg → bramka treściowa → zrzut.

| Zakres | Ścieżki |
|---|---|
| Zapis | `server/src/config/FeatureFlags.ts` — WYŁĄCZNIE dodanie `ENABLE_DECK_FROM_KNOWLEDGE` (schemat wzorem `:55`, blok ładujący wzorem `:247-248`). **Zakaz zmiany wartości domyślnej JAKIEJKOLWIEK istniejącej flagi**, w szczególności `ENABLE_TERESA_TOOL_LOOP` (`:36`, `:153`), `ENABLE_TERESA_TOOL_LOOP_WRITE` (`:37`, `:157`) i `ENABLE_ARTIFACT_KNOWLEDGE_INDEX` (`:55`, `:247-248`) |
| Zapis | `server/src/services/presentationGeneratorService.ts` — WYŁĄCZNIE: nowa gałąź w `generateOutline` (`:1505`) za flagą + zapis prowieniencji przy tworzeniu decku. **Zakaz zmiany `generateDefaultOutline` (`:597`), `applyDeckDetailLevel` (`:774`), `generateDeck` (`:1683`) poza przekazaniem konspektu, oraz zakaz dotykania hooka indeksacji (`:2430-2453`)** — to zamknięty zakres dyżurów 209/215 |
| Zapis | NOWY plik serwisu konspektu z wiedzy w `server/src/services/` — jedno źródło prawdy dla `R1` |
| Zapis | `server/src/routes/presentations.routes.ts` — WYŁĄCZNIE: gałąź za flagą w `POST /generate/outline` (`:1912`) i przekazanie konspektu do `POST /generate/deck` (`:1923`); zapis `source_type`/`source_id`/`source_refs_json` przy tworzeniu decku. **Zakaz dotykania tras eksportu (`:2569`, `:2832`, `:3649`, `:7657` — dyżur 230) i tras agenta (`:4004`, `:4128`, `:4218` — dyżur 232)**; zakaz zmiany semantyki bramek |
| Zapis | NOWA migracja `server/migrations/20260901_*.sql` — **wyłącznie addytywna**, wyłącznie jeżeli `R3b` tego wymaga; `ADD COLUMN IF NOT EXISTS`, pełny przebieg na pustej bazie + drugi przebieg (idempotencja) |
| Zapis | NOWY skrypt `server/scripts/day231-*.ts` (sonda `tsx`) — wzorcem `modul17-real-model-probe.ts` i `modul17-mock-verify.ts`; **kopiujesz wzorzec do nowego pliku, nie edytujesz cudzych sond** |
| Zapis | NOWY ekran `dev-render/screens/day231-konspekt-z-wiedzy.tsx` + wpis w `dev-render/main.tsx` |
| Zapis | Front — WYŁĄCZNIE w zakresie `R2`: pokazanie źródeł przy pozycjach konspektu w JEDNYM miejscu ustalonym pomiarem. **Zakaz przebudowy `PresentationWizard.tsx` i `DeckBuilder.tsx`** |
| Zapis | NOWE pliki testowe `day231.*` w `server/src/services/__tests__/`, `server/src/routes/__tests__/`, `tests/integration/`. ★ Nowe pliki w `tests/` wymagają `git add -f` |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY231_GAMMA_ZWIEDZY_REPORT.md` |
| Zapis (ograniczony) | `docs/program/funkcje/ARCHITEKTURA_AGENTA_TERESY.md` — WYŁĄCZNIE nowy rozdział na końcu pliku (numer ustalasz pomiarem — ostatni to `## 12. Wykonanie — GF-AGT-02 (Day217)`). **Zakaz zmiany treści §1-§12** |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/ai/AIPipeline.ts` · `llmService.ts` · `toolDefinitions.ts` · `sideEffectTools.ts` · `server/src/routes/ai.routes.ts` — pętla narzędziowa 206 i kontekst 205 są **NIETYKALNE**; przechodzisz przez nie, nie zmieniasz ich zachowania ani domyślek |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/ai/knowledgeDocAccessFilter.ts` · `embeddingService.ts` · `ragService.ts` — **jedyne źródło reguły zasięgu**; masz przez nie PRZECHODZIĆ, nigdy ich nie omijać ani nie zmieniać |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/knowledge/artifactKnowledgeIndexer.ts` · `KnowledgeService.ts` · `documentStudioService.ts` · `reportGenerationService.ts` — zakres 209/215, zamknięty |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/aiActionExecutor.ts` · `server/src/services/personalTask/createPersonalTaskService.ts` — **wzorzec prowieniencji, który kopiujesz**; nie zmieniasz |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/report/pptx/**` · `server/src/services/deliverables/**` — cały renderer to teren dyżurów 229 i 230 |
| Odczyt (ZAKAZ ZAPISU) | `vitest.config.ts` · `tests/setup.ts` · `server/src/database/Database.ts` (`Z18`) |
| Odczyt | `docs/program/funkcje/MODUL17_DOWOD_REALNYM_MODELEM.md` (**przeczytaj w całości przed `R5`**) · `ARCHITEKTURA_AGENTA_TERESY.md` §9, §12 · `ODBIOR_205_206.md` · `GAMMA_G2_SESJA_NA_ZYWO.md` · `GAMMA_G3_OBCHOD_MENU.md` · `GAMMA_G0_POMIAR.md` · `MARZENIE_GAMMA_DECKI.md` |
| Odczyt | `~/.consultify-openrouter` — WYŁĄCZNIE dla `R5c`, WYŁĄCZNIE przez `set -a; . ~/.consultify-openrouter; set +a`; nigdy nie wypisujesz zawartości |

**Nietykalne imiennie:** `AIPipeline.ts` · `llmService.ts` · `toolDefinitions.ts` ·
`sideEffectTools.ts` · `ai.routes.ts` · `knowledgeDocAccessFilter.ts` · `embeddingService.ts` ·
`ragService.ts` · `artifactKnowledgeIndexer.ts` · `aiActionExecutor.ts` ·
`createPersonalTaskService.ts` · `server/src/services/report/pptx/**` ·
`server/src/services/deliverables/**` · `vitest.config.ts` · `tests/setup.ts` · `Database.ts` ·
każdy `MODULE_ACCEPTANCE.md`.

**★★ ROZŁĄCZNOŚĆ Z PARTIĄ RÓWNOLEGŁĄ.**
**Cztery dyżury wydane 01.09 pracują w tym samym module. Granice imienne:**

| dyżur | zakres | Twoja granica wobec niego |
|---|---|---|
| **226** | martwy edytor motywu: `presentations.routes.ts:1566-1567`, `presentationTemplateRuntimeService.ts:372-452` | nie dotykasz tras szablonów |
| **227** | geometria dwóch rendererów: `GRID` w `designTokens.ts`, `DECK_GRID` w `DeckStyler.ts`, `initiativeMaterializeService.ts:488` | nie dotykasz siatki, marginesów ani pola treści |
| **228** | styl obrazu w motywie: `deckVisualsService.ts` (~`:599`), `deckImageResolverService.ts` | nie dokładasz generowania obrazów |
| **229** | ciemny motyw i typografia: `designTokens.ts` (tusz, kroje, stopnie, wagi, interlinia), `atomics/*.ts` | nie dotykasz kolorów, stopni, wag ani interlinii |
| **230** | przepełnienie: `fit: 'shrink'`, detektor, ostrzeżenie | nie dokładasz i nie usuwasz `fit: 'shrink'`, nie duplikujesz detektora |
| **231** | treść z wiedzy: `generateOutline`, prowieniencja decku | nie dotykasz drogi powstawania treści |
| **232** | agent redagujący: trasy `agent-edit`, brama stanu | nie dotykasz tras `agent-edit` |

**Wiersz opisujący TWÓJ dyżur pomijasz — reszta obowiązuje.**
 Dyżury 229, 230 i 232 pracują w tym samym module.
Twoja granica: **Ty dotykasz drogi POWSTAWANIA treści** (`generateOutline`, `generate/deck`,
prowieniencja); **oni dotykają renderu (229, 230) i edycji gotowego decku (232)**.
`presentations.routes.ts` to plik o wysokim ruchu — **przed pierwszym commitem**:

```bash
git -C "$WT" log --oneline 9fb7942a01..github-backup/codex/m03-admin-20260824 -- \
  server/src/routes/presentations.routes.ts server/src/services/presentationGeneratorService.ts
```

i **zgłoś kolizję zasobową ZANIM zaczniesz pisać, nie po.**

---

# 5. TWARDE ZASADY

- ★★ **BRAMKA JEST TREŚCIOWA, NIE STRUKTURALNA.** „Deck ma 10 slajdów i pole `sources`" nie jest
  dowodem niczego. Dowodem jest **fakt z treści dokumentu w bazie wiedzy, którego nie było
  w poleceniu**, obecny w wygenerowanym decku — i **jego zniknięcie po odcięciu dostępu do wiedzy**.
- ★★ **REALNY MODEL WYŁĄCZNIE PRZEZ SKRYPT `tsx`, NIGDY PRZEZ `*.test.ts`.**
  `tests/setup.ts:896` **bezwarunkowo** podmienia `global.fetch` na atrapę zwracającą `200`
  z pustą treścią. Test „z realnym modelem" jest testem z atrapą udającą model — i da wynik,
  któremu nie wolno ufać w żadną stronę.
- ★★ **KROK ATRAPĄ PRZED MODELEM JEST OBOWIĄZKOWY** (`R5b`). Atrapa podmienia **wyłącznie**
  `llmService.callStream` i i tak woła **PRAWDZIWY** `executeReadTool`. Dopiero po jej `PASS`
  uruchamiasz model. Uruchomienie modelu wcześniej to wydanie budżetu na diagnozę mechaniki,
  którą można sprawdzić za darmo.
- ★★ **BUDŻET MODELU: DWA PRZEBIEGI. ZAKAZ PONAWIANIA NIEUDANEGO PRZEBIEGU.**
  Przy powtórnym „nie" — **STOP z uczciwym opisem**, nie trzeci przebieg. Zameldowanie porażki
  i zatrzymanie się zostało w tym programie uznane za **poprawne zachowanie**; rozstrzyganie,
  czy kryterium było dobrze postawione, należy do nadzorcy.
- ★★ **KONSTRUKCJA FAKTU — TRZY BŁĘDY, KTÓRYCH NIE POWTARZASZ** (`R5a`, źródło:
  `docs/program/funkcje/MODUL17_DOWOD_REALNYM_MODELEM.md`): znacznik w tytule dokumentu, gdy tytuł
  jest w prompcie; wymóg dosłownego cytatu wobec parafrazy; nazwa własna dzieląca rdzeń słowny
  z czymkolwiek widocznym w prompcie. **Wszystkie trzy sprawiły, że dowód nie rozstrzygał —
  przy działającym produkcie.**
- ★★ **WALIDUJ SONDĘ NA ZNANYM PRZYPADKU, ZANIM JEJ ZAUFASZ.** Zmierzone dwa kłamstwa przyrządu:
  pomiar zasięgu zwrócił same zera, bo powłoka potraktowała listę katalogów jako jedną ścieżkę
  („czysto" przy 600 trafieniach); sprawdzenie obecności liczby dało `False`, bo strumień modelu
  ma spacje między znakami (`63 . 4 %`). **Normalizuj białe znaki przed porównaniem.**
- ★★ **ZAKAZ BUDOWY DRUGIEJ DROGI DO BAZY WIEDZY.** Wyłącznie
  `executeToolCall('search_knowledge_base', …)` (`toolDefinitions.ts:583`, `:886`).
  **Zakaz własnego `SELECT`-a** z `knowledge_docs`, `knowledge_chunks`, `ai_knowledge_embeddings`
  w kodzie generatora decku — omija fail-closed filtr `knowledgeDocAccessFilter.ts:11`
  i produkuje deck pokazujący klientowi treść, do której wołający nie ma prawa.
- ★★ **ZAKAZ DYKTOWANIA MODELOWI ARGUMENTÓW WYWOŁANIA NARZĘDZIA.** Dowód, w którym argumenty
  podaje wykonawca, dowodzi wyłącznie tego, że wykonawca umie je napisać. Model ma **sam** wybrać
  narzędzie i zasięg — tak jak w zmierzonym przebiegu 217, gdzie sam wybrał
  `vault_scope="project"` i podał nazwę projektu.
- ★★ **`zrodla` PUSTE JEST DOZWOLONE. `zrodla` WYMYŚLONE JEST PODSTAWĄ ODRZUCENIA DYŻURU.**
  Slajd bez źródła jest uczciwy; slajd z fikcyjnym źródłem niszczy jedyną przewagę, jaką mamy
  nad Gammą.
- ★★ **ASERCJA NA NIEOBECNOŚĆ IMIENNIE ZASEEDOWANEGO REKORDU** przy dowodzie zasięgu (`R4`),
  plus **zakaz `--retry`** w tym pakiecie: zmierzono wektor, w którym test izolacji leczy się
  skutkiem własnego ataku.
- ★★ **TRZY FLAGI FUNDAMENTU SĄ DOMYŚLNIE WYŁĄCZONE** — `ENABLE_TERESA_TOOL_LOOP`
  (`FeatureFlags.ts:36`, `:153`), `ENABLE_TERESA_TOOL_LOOP_WRITE` (`:37`, `:157`),
  `ENABLE_ARTIFACT_KNOWLEDGE_INDEX` (`:55`, `:247-248`). Włączasz je **zmienną środowiskową
  w tej samej linii komendy**, **nigdy** zmianą domyślki w kodzie. Bez tego Twój przebieg pokaże
  „model nie sięgnął po wiedzę" — i będzie to prawda o konfiguracji, nie o produkcie.
- ★★ **HOOKI INDEKSACJI SĄ FIRE-AND-FORGET** (`presentationGeneratorService.ts:2431`, `:2453`;
  `documentStudioService.ts:1264`). Cicha porażka indeksacji **nie przewraca** generacji — brak
  dokumentu w bazie wiedzy nie da żadnego błędu, tylko `logger.warn`. **Obecność dokumentu
  w `knowledge_docs` sprawdzasz zapytaniem do bazy, nie brakiem błędu.**
- ★★ **MIGRACJA ADDYTYWNA I DOWIEDZIONA NA PUSTEJ BAZIE.** `ADD COLUMN IF NOT EXISTS`, pełny
  przebieg od zera + drugi przebieg bez zmian. Zmierzona pułapka programu: migracja czytająca
  kolumnę dodawaną później w kolejności wywraca łańcuch przy odtworzeniu po awarii.
- ★ **`Z40` bez wyjątku:** wartość klucza modelu nie pojawia się nigdzie — ani w komendzie,
  ani w logu, ani w raporcie. Pokazujesz `obecny`/`nieobecny`. Do raportu: nazwa modelu
  i **zmierzona** liczba rund z logu. **Jeżeli nie wołałeś modelu — napisz „modelu nie wołałem".**
- ★ **ARGUMENTY WYWOŁANIA NARZĘDZIA CZYTASZ Z LOGU SERWERA, NIE Z SSE.** Zmierzone: SSE nigdy
  nie niesie surowych argumentów ani wyniku narzędzia (strażnik poufności, fail-closed w trzech
  punktach — nietykalny).
- ★ **NIE PRZEBUDOWUJESZ KREATORA.** Jeżeli krok konspektu nie jest dziś pokazywany
  użytkownikowi — to jest **ustalenie do raportu**, a Ty budujesz minimalny ekran za flagą
  i **piszesz wprost, że nie jest wpięty w kreator produkcyjny**.
- ★★ **SUFIT FORMATU JEST TWARDY I ZMIERZONY, NIE ZAKŁADANY.** `pptxgenjs 4.0.1`
  (`package.json`, blok `dependencies`): **gradienty NIEMOŻLIWE** (zero wystąpień słowa
  „gradient" w całej zainstalowanej paczce — typy i wszystkie bundle),
  **osadzanie krojów NIEMOŻLIWE** (biblioteka tego nie oferuje). Dostępne i już używane:
  przezroczystość, pełny zestaw kształtów OOXML, auto-dopasowanie tekstu, obrazy w tle
  (`docs/program/funkcje/GAMMA_G0_POMIAR.md`, rozdział „Sufit biblioteki"). Gradient
  wolno **udawać kształtami** albo **wypalić w PNG**. **Nie obiecujesz gradientu w PPTX.**
- ★★ **GRANICA: RASTER DLA MATERIAŁU, WEKTOR DLA ZNACZENIA**
  (`docs/program/funkcje/GAMMA_G1_OBRAZY.md` §5). W PNG wolno wypalić WYŁĄCZNIE to, co nie
  niesie informacji: pole koloru, gradient, ziarno, teksturę, welon. **NIGDY** nie wypalasz:
  tekstu, liczb, macierzy kropek, pasków, pierścieni, wykresów — one zostają kształtami
  OOXML, **bo agent redagujący (dyżur 232) musi móc je zmienić**.
- ★★ **ZABEZPIECZENIE BEZ TESTU, KTÓRY CZERWIENIEJE PO JEGO USUNIĘCIU, JEST NIEUDOWODNIONE.**
  Każda bramka w tym dyżurze ma **parę dowodową**: przebieg zielony (mechanizm działa) +
  przebieg czerwony po mutacji (mechanizm jest naprawdę tym, co trzyma). Wyjście OBU
  przebiegów wchodzi do raportu dosłownie. „Testy przeszły" nie jest dowodem.
- ★★ **PUŁAPKI ZMIERZONE 31.08 — SPRAWDŹ KAŻDĄ U SIEBIE, NIE PRZEPISUJ TEJ LISTY:**
  (1) `server/src/config/Database.ts` ok. `:79-85` **cicho podstawia atrapę bazy** — bez
  `MOCK_DB=false` Twoje „zapisy" nie lądują nigdzie, a odczyty kłamią;
  (2) `vitest.config.ts` ok. `:210` **przypina `DB_TYPE`** — mierzysz inny silnik, niż myślisz;
  (3) `tests/setup.ts` **podmienia `global.fetch`** — dlatego **realny model wolno wołać
  WYŁĄCZNIE ze skryptu `tsx`, NIGDY z pliku `*.test.ts`**; test z realnym modelem to test
  z atrapą, która udaje model;
  (4) atrapy zakładane w `beforeEach` przeżywają dłużej, niż wygląda;
  (5) czytasz `Test Files` **i kod wyjścia** — `No test files found` przy `exit 0` **nie jest
  `PASS`**, a `npx vitest run` bywa kończy się `exit 0` mimo czerwonych testów.
  Numery linii w (1) i (2) **zmierz na swojej bazie** — mogły się przesunąć; jeżeli się
  przesunęły, wpisz zmierzone do „Korekt wobec instrukcji".
- ★★ **FLAGA DOMYŚLNIE WYŁĄCZONA** (`CLAUDE.md` §7, §9). Przy fladze OFF zachowanie produktu
  ma być **bajt w bajt dzisiejsze** — to jest osobna asercja, nie domysł. Zakaz włączania
  czegokolwiek na żywo bez akceptu właściciela na zrzucie.
- ★★ **WŁAŚCICIEL NIGDY NIE JEST PIERWSZYM TESTEREM WIZUALNYM** (`CLAUDE.md` §7 —
  powód nazwany imiennie: załamanie 07-11). Zrzuty robisz **Ty**, przed nim.
  **Para jasny/ciemny musi się REALNIE różnić**: podajesz `mean_luma` obu obrazów i różnicę
  **> 150**. Zdarzył się w tym programie przypadek dwóch identycznych obrazów pod dwiema
  nazwami (kształt „duplikat zamiast motywu") — `shasum` tego nie wykrywa, bo plakietka
  zmienia SHA. Pomiar jednolinijkowy (`sharp` jest w `devDependencies`):
  ```bash
  node -e "const s=require('sharp');s(process.argv[1]).stats().then(r=>console.log(process.argv[1], (0.2126*r.channels[0].mean+0.7152*r.channels[1].mean+0.0722*r.channels[2].mean).toFixed(1)))" <plik.png>
  ```
  Harness sam ustawia motyw z adresu (`dev-render/main.tsx:1637-1660`: klasa `.dark`,
  `useAppStore.setState({theme})` **oraz** `MutationObserver` przywracający klasę) — więc
  identyczna para **nie ma prawa** wyjść; jeśli wyjdzie, to jest usterka Twojego przebiegu,
  nie harnessu, i masz ją opisać.
- ★★ **W RAPORCIE PISZESZ WPROST, CZY DANE NA ZRZUCIE POCHODZĄ Z REALNEGO PRZEBIEGU, CZY
  Z PROPSÓW W HARNESSIE.** Zrzut zamockowanej powłoki **nie jest dowodem renderu**
  (kształt „przyrząd kłamie, a oko przywyka"; audyt 207 uznał izolowany ekran dev-render za
  storybook, nie za dowód).
- ★ **`Z13`:** logi, dzienniki przebiegu, zrzuty, pliki `.pptx` i wyjścia bramek **nie wchodzą
  do repo** — leżą w katalogu artefaktów, a raport podaje ścieżki i `shasum -a 256`.
- ★ **`Z27` — zakaz `git stash`** w każdej postaci; stan odkładasz przez `cp` do katalogu
  scratch i wracasz przez `cp`. Schowek jest współdzielony między wszystkimi worktree tego
  repozytorium.
- ★ **`Z28`** — zero połączeń do bazy zdalnej, demo, stagingu i produkcji, w każdą stronę
  i każdym narzędziem.
- ★ **PUSH WYŁĄCZNIE NA `github-backup`.** `origin` jest **PUBLICZNY** (`Z1`).
- ★ **Zakaz naprawiania przez wyciszanie** (`@ts-ignore`, `.skip`, poszerzanie `exclude`,
  `--no-verify`) i zakaz usuwania zastanych testów — asercję wolno **ZMIENIĆ**
  z uzasadnieniem w treści commita, nigdy skasować.
- ★ **`§0.4a` — pomiar zasięgu testów PEŁNYMI NAZWAMI jest warunkiem oddania raportu**
  (`Z24`). Przepisanie cudzej liczby = zawyżenie i podstawa odrzucenia.
- ★ **`Z31`** — `assertRealPostgresTestEnvironment()` wołasz **BEZ ARGUMENTÓW**; zakaz
  asercji na `DATABASE_URL`, na porcie i na nazwie kontenera. Sześć incydentów w programie;
  nie dokładaj siódmego.
- ★ **Sprzątanie kontenera: `docker rm -f -v`** — z flagą `-v`, inaczej wolumen zostaje.
- ★★ **SEKCJA „TWIERDZENIA NIEZWERYFIKOWANE" W RAPORCIE JEST OBOWIĄZKOWA.**
  Brak tej sekcji jest podstawą odrzucenia dyżuru.
