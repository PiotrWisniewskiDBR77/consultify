# INSTRUKCJA DYŻURU nr 195 — Codex — „Materiały GEN-2 — DOKUMENT POKAZYWALNY: proza wielosekcyjna rzędu 700+ słów w limicie DEC-317 (≤2 wywołania LLM), granulacja `isAssumption` per akapit zamiast per cała sekcja, sygnał tytułu dokumentu (F2), Markdown wyrenderowany w DOCX i okładka PO POLSKU (F1+F3 domknięte)"

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
> **wyłącznie** `/private/tmp/cx-day195-dokument`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `6894f3da05`**
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
Zakres: **11_MATERIALS — GEN-2 (Studio Dokumentów), warstwa prozy `server/src/services/documentStudio/documentBlockProseGenerator.ts` i granica ostateczna `enforceDocumentSchemaGrounding` w `server/src/services/documentStudio/documentContentGenerator.ts`, eksport `server/src/services/documentStudio/documentDocxRenderer.ts`**.
Trasy front: `brak zmian frontu wymaganych w tym dyżurze. Mechanizm oznaczania (`isAssumption` → znacznik assumption) jest wpięty end-to-end i potwierdzony w odbiorach 185/190 niezależnym renderem. Kontekst do odczytu, NIE zmieniasz: `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx:221-273`, `src/components/DocumentStudio/publicReader/ReaderBlockRenderer.tsx:62`, `src/components/DocumentStudio/editor/schemaToTipTap.ts:74`, `src/components/DocumentStudio/editor/nodes/payloadAttrs.ts:44-48`. ★ Front tego dyżuru to NIE React: dowód idzie przez HTTP (`POST /api/document-studio/generate`, `GET /api/document-studio/:artifactId/export/docx`), nie przez klikanie w UI — dokładnie jak w dyżurze 190`. Trasy tył: `Generacja: `POST /api/document-studio/generate` (`server/src/routes/document-studio.routes.ts:853`) → `documentStudioService.materialize…` → przy `useLlm: true`, `documentStudioService.ts:1013-1018` woła `generateBlockProse(provisionalSchema, generationIntake, sourceRefs, { enable: true, warnings })` **BEZ `maxTokens`**. ★★ POPRAWKA WOBEC INSTRUKCJI 190 (samodenuncjacja tamtego dyżuru, punkt 5 jego raportu, potwierdź sam): realny wołacz prozy to `documentBlockProseGenerator.ts`, NIE `documentBlockContentGenerator.ts:693-730`. `generateBlockProse` (`:252-421`) zbiera cele przez `collectTargets` (`:146-163`, WYŁĄCZNIE bloki typu `paragraph|callout|bullet_list|numbered_list`, stała `PROSE_BLOCK_TYPES` `:38`), dzieli je `chunk(targets, PROSE_BATCH_SIZE=2)` (`:59,74-78`) na partie i puszcza je RÓWNOLEGLE (`BATCH_CONCURRENCY=4`, `:72,348-351`) przez `runWithConcurrency` — KAŻDA partia to JEDNO wywołanie `generateChatResponse` (`:296-301`), z maks. `MAX_BATCH_ATTEMPTS=2` prób. ★★ KLUCZOWY MECHANIZM DLA R1: `:271` — `const batches = options.maxTokens ? [targets] : chunk(targets, PROSE_BATCH_SIZE);` — gdy caller poda `options.maxTokens`, WSZYSTKIE cele lądują w JEDNEJ partii = JEDNO wywołanie, niezależnie od liczby sekcji/bloków. Dzisiejszy wołacz (`documentStudioService.ts:1013-1018`) tego NIE robi. Po prozie: ★ GRANICA OSTATECZNA `enforceDocumentSchemaGrounding` (`documentContentGenerator.ts:102`, wołana z `documentStudioService.ts:1024`, komentarz w kodzie: „FINAL grounding boundary. Must remain after every content/prose LLM layer”) → zapis do PostgreSQL. Eksport: `GET /api/document-studio/:artifactId/export/docx` → `documentDocxRenderer.ts` — `renderParagraphBlock` (`:535-558`) i `renderListBlocks` (`:561-587`) emitują `block.content.text`/`items` jako LITERALNY tekst (ZERO parsowania Markdown), `buildAssumptionMarker` (`:502-509`) jest zaszyty na sztywno po angielsku, `renderCoverBlock` (`:1241-1371`) ma słownik `documentTypeLabels` z JEDNYM wpisem (`:1244-1246`) na 24 warianty `DocumentTypeKey` (`documentStudioTypes.ts:24-47`)`.

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
WT=/private/tmp/cx-day195-dokument
MARKER=6894f3da05

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day195-dokument-20260831 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day195-dokument/config.worktree"
cat "$VAULT/worktrees/cx-day195-dokument/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day195-dokument-scratch
mkdir -p /private/tmp/cx-day195-dokument-artefakty

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
git -C "$VAULT" log --oneline 6894f3da05..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only 6894f3da05..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day195-dokument-20260831
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 6894f3da05..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `dziewięć` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day195-dokument

# (T0) MARKER JEST POTOMKIEM MERGE'A 190 — czytasz kod PO naprawie, nie przed
git merge-base --is-ancestor e4b6556443 HEAD && echo "OK: marker zawiera fix dnia 190" \
  || echo "UWAGA: marker NIE zawiera fix dnia 190 — STOP i zgłoś rozjazd"

# (T1) REALNY WOŁACZ PROZY — potwierdź, że to documentBlockProseGenerator, NIE
# documentBlockContentGenerator (pomyłka instrukcji 190, poprawiona w jej własnym raporcie)
sed -n '1009,1020p' server/src/services/documentStudio/documentStudioService.ts
#   oczekiwane: `generateBlockProse(provisionalSchema, generationIntake, sourceRefs,
#   { enable: true, warnings: warningsCollector })` — BEZ `maxTokens`.

# (T2) MECHANIZM BATCHINGU — policz TY SAM, nie przepisuj liczb z instrukcji (Z24)
sed -n '38,78p;245,352p' server/src/services/documentStudio/documentBlockProseGenerator.ts
#   oczekiwane: PROSE_BLOCK_TYPES = {paragraph,callout,bullet_list,numbered_list};
#   PROSE_BATCH_SIZE=2; BATCH_CONCURRENCY=4; MAX_BATCH_ATTEMPTS=2; linia ok. :271
#   `const batches = options.maxTokens ? [targets] : chunk(targets, PROSE_BATCH_SIZE);`

# (T3) ARYTMETYKA WYWOŁAŃ — zbuduj TABELĘ dla swojego outline'u zanim cokolwiek uruchomisz
node -e "const chunkCalls=n=>Math.ceil(n/2); for (const n of [1,2,3,4,5,6,8]) console.log('cele prozy='+n, '-> partie/wywolania (domyslny chunking)='+chunkCalls(n), '| wymuszony maxTokens -> wywolania=1');"
#   oczekiwane: dla n<=4 domyślny chunking daje <=2 wywołania; dla n>4 przekracza
#   limit DEC-317, chyba że wymusisz `options.maxTokens` (wtedy zawsze 1 wywołanie,
#   ale ryzykujesz odtworzenie historycznego timeoutu 30s z DOC-1 — zmierz to).

# (T4) F1 — KONTAMINACJA isAssumption CAŁEJ SEKCJI
sed -n '181,222p' server/src/services/documentStudio/documentContentGenerator.ts
#   oczekiwane: :208-213 `block.isAssumption = block.isAssumption === true || guarded.changed ||
#   title.changed || localizedTitleChanged || purposeChanged;` — flaga tytułu/celu
#   sekcji trafia do KAŻDEGO bloku tej sekcji, niezależnie od jego własnej treści.

# (T5) F2 — TYTUŁ DOKUMENTU BEZ SYGNAŁU
grep -c 'next\.title' server/src/services/documentStudio/documentContentGenerator.ts
#   oczekiwane: 0 — `enforceDocumentSchemaGrounding` nigdy nie dotyka `next.title`.
sed -n '48,94p' server/src/services/documentStudio/documentContentGenerator.ts
#   oczekiwane: `buildDocumentEvidenceContract(sourceRefs, sections)` nie przyjmuje
#   tytułu dokumentu jako argumentu — `toVerify` nie ma ŻADNEGO wpisu o tytule.

# (T6) TRZECI KASOWNIK — POZA LICENCJĄ, tylko zmierz czy dotyka Twojego przebiegu
sed -n '225,268p' server/src/services/documentStudio/documentContentGenerator.ts
#   oczekiwane: filtr wierszy tabel `initiative`/`inicjatywa` fail-closed przeciw
#   groundingSource. Jeśli Twój outline nie ma bloku table/risk_table z kolumną
#   inicjatywy, odnotuj 'nie dotyczy' z dowodem, nie milczeniem.

# (T7) RENDER — brak parsowania Markdown, znacznik zaszyty po angielsku
sed -n '502,509p;535,587p' server/src/services/documentStudio/documentDocxRenderer.ts
#   oczekiwane: `renderParagraphBlock`/`renderListBlocks` emitują tekst LITERALNIE
#   (jeden `TextRun` z surowym `**`/`- `); `buildAssumptionMarker(font)` nie
#   przyjmuje języka, string jest zaszyty po angielsku.

# (T8) OKŁADKA — luka etykiet dokumentType/density
sed -n '1241,1256p' server/src/services/documentStudio/documentDocxRenderer.ts
grep -n \"export type DocumentTypeKey\" -A 25 server/src/services/documentStudio/documentStudioTypes.ts | head -27
#   oczekiwane: `documentTypeLabels` ma 1 wpis; `DocumentTypeKey` ma 24 warianty;
#   policz TY SAM ile z nich nie ma polskiej etykiety (Z24).

# (T9) F3 — HARNESS R2 DNIA 190 NIGDY NIE TRAFIŁ DO REPO
git log --all --oneline -- 'server/src/services/documentStudio/__tests__/day190*' 
git show 6894f3da05:server/src/services/documentStudio/__tests__/day190.obviousEnglish-grounding.test.ts | grep -c 'generateChatResponse\|OPENROUTER\|useLlm'
#   oczekiwane: jedyny skomitowany plik day190.* to test R1/R3 na granicy (zero LLM,
#   zero HTTP) — realny probe R2 (HTTP->OpenRouter->DOCX) istniał tylko efemerycznie
#   w worktree i NIE jest dziś odtwarzalny z repo. To jest F3.
```

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day195-dokument-20260831` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6122`. Twój JEDYNY port harnessu to `5064 i 5065`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day195-pg`**. **ZAKAZANE:** `6012, 5433, 6047, 6054-6121, 5010-5063, 6404-6411 (zajęte przez wcześniejsze dyżury i odbiory nadzorcy — cała partia 170-194). ★ PORT 5000 ZAJĘTY NA STAŁE przez macOS Control Center. ★ PORT 5037 ZAJĘTY przez `adb` (serwer Androida). ★ Ta lista jest rozkazem pomiarowym, nie gwarancją — zweryfikuj `lsof -i` i `docker ps` przed startem i wpisz wynik `X z 3` do raportu`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak nowej flagi wizualnej i brak potrzeby jej wprowadzenia. Uzasadnienie do potwierdzenia lub obalenia przez Ciebie w raporcie: (a) to jest zmiana logiki backendowej (prompt/batching warstwy prozy, granica groundingu, renderer DOCX), nie nowy ekran ani komponent React — `CLAUDE.md` §7 dotyczy powierzchni wizualnych renderowanych we froncie; (b) plik DOCX jest artefaktem do pobrania, nie ekranem aplikacji — właściciel go OGLĄDA jako plik, nie jako włączoną/wyłączoną flagę UI; (c) kierunek jest kontynuacją jawnych decyzji D-8 i DEC-317, nie nową funkcją wymagającą osobnego bramkowania. ★ Wyjątek do rozważenia: jeśli Twoje R1 zmieni WYGLĄD/STRUKTURĘ eksportowanego DOCX w sposób, który właściciel zobaczy jako inny produkt (więcej sekcji, inny układ), nazwij to w raporcie jako zmianę widoczną do świadomej akceptacji — plik idzie do akceptu, nie na ekran produkcyjny bez przeglądu`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY195_DOKUMENT_REPORT.md`. Dopisujesz wynik dyżuru 195 do wiersza `GEN-2` w `docs/program/waves/WAVE_03_ACCEPTANCE/modules/11_MATERIALS/MODULE_ACCEPTANCE.md` (ok. linii 149) — w szczególności koryguj zdanie o `K5 FAIL (surowy Markdown i zwarty akapit)`, jeśli Twój dowód pokazuje inny wynik, z liczbą słów i rubryką K1-K6 zaktualizowaną. Podnosisz status `GEN-2` z `PARTIAL` TYLKO jeśli masz dowód PLIKIEM (`Z32`: zakaz `PASS` bez dowodu) i tylko w zakresie, który dowód faktycznie pokrywa; próg rubryki `15/18` z D-8 jest OSOBNYM kryterium graficznym i jeśli go nie mierzysz, napisz to wprost — nie zamykaj `GEN-2` na `PASS` na podstawie samej rubryki K1-K6, którą projektujesz Ty. NIE zmieniasz `GEN-1`, `GEN-3`, `GEN-4` ani `GEN-5` w tej samej tabeli. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day195-dokument-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day195-dokument-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **`Z15` NIE OBOWIĄZUJE W POZYCJI R1/R4 — realne wywołanie LLM jest WYMOGIEM, nie naruszeniem.** Ten sam mechanizm i ta sama licencja co dyżur 190, wpisana tu dosłownie. Klucz: `~/.consultify-openrouter` (jedna linia `OPENROUTER_API_KEY=<wartość>`), **jedyna dozwolona komenda źródłowa: `set -a; . ~/.consultify-openrouter; set +a`** — nie ma innej dozwolonej drogi; nie kopiujesz pliku, nie przenosisz go do repozytorium, nie wpisujesz jego treści do `.env`, `docker-compose*` ani do żadnej komendy. ★★ **`Z40` bez wyjątku: zakaz wypisania WARTOŚCI klucza gdziekolwiek** — pokazujesz wyłącznie `obecny`/`nieobecny` albo długość (`env | sed 's/=.*//' | grep -x 'OPENROUTER_API_KEY'`). **Maksymalnie DWA realne wywołania modelu w CAŁYM dyżurze** (`DEC-2026-08-29-317`), zakaz pętli, zakaz ponawiania poza wbudowanym `MAX_BATCH_ATTEMPTS=2` w `fillViaLlm`/`generateBlockProse`. `POST /api/document-studio/plan` z `useLlm: true` jest ZAKAZANY (zżera budżet wywołań poza `generateBlockProse`) — przekazujesz gotowy `outline` bezpośrednio do `/generate`, dokładnie jak dyżur 190. Plik „PRZED” (do mutacji granicy) NIE powstaje przez drugą generację — bierzesz TEN SAM schemat wypełniony przez model i przepuszczasz go przez STARĄ wersję granicy/starą wersję F1. Zero dodatkowych wywołań modelu. ★★ **`Z31` — ZAKAZ PINOWANIA STRAŻNIKA REALDB DO HOSTA, PORTU ALBO NAZWY BAZY.** Wołasz `await assertRealPostgresTestEnvironment()` BEZ ARGUMENTÓW; zakaz asercji na `DATABASE_URL`, na porcie i na nazwie kontenera — sześć incydentów w programie, dyżur 193 zbiorczo je odpiął (`97187267a0`), nie dokładaj siódmego. ★★ **NIE DOTYKASZ `documentBlockContentGenerator.ts`** poza odczytem — naprawa 185, scalona; `unsupportedClaimInString`, `enforceBlockGrounding`, `GROUNDING_ACRONYM_RULE`, `SAFE_BUSINESS_ACRONYMS`, `POLISH_HEADER_TRANSLATIONS`, `POLISH_INTENT_RE` nietykalne. ★★ **NIE ZMIENIASZ `plCanonical` (`documentContentGenerator.ts:116-134`), filtra wierszy tabel — trzeci kasownik (ok. `:226-266`) ani bloku `SIGMA-2` (od ok. `:268`)** — poza zakresem tego dyżuru; zmierz i odnotuj, nie napraw. ★★ **NIE ZMIENIASZ reguły akronimów ani kontraktu D-8** — liczby-założenia mają dalej być zachowywane i oznaczane; jeśli Twoja granulacja (R2) sprawi, że jakikolwiek akapit z niepotwierdzoną liczbą przestanie nieść `isAssumption`, to jest regresja anty-fabrykacyjna, nie naprawa. ★★ **Sprzątanie kontenera: `docker rm -f -v`** — z flagą `-v`. ★★ **Fixture NIE JEST dowodem.** Ręcznie zbudowany schemat z zaszytym `isAssumption`, omijający realną ścieżkę, dostał w odbiorze 185 ocenę `D`. Dowód R1/R4 musi przejść przez realną ścieżkę HTTP→LLM→PostgreSQL→DOCX. ★★ **Nie udajesz realnego wywołania modelu przez fallback** — `documentStudioService.ts:1009-1013` (best-effort) i każda awaria zwraca deterministyczny schemat bez błędu; dowodem jest log `LLM call success` z realnym `tokens`/`durationMs`. ★★ **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.** ★★ **Zakaz naprawiania przez wyciszanie** (`@ts-ignore`, `.skip`, poszerzanie `exclude`) i zakaz usuwania zastanych testów (w tym `day190.obviousEnglish-grounding.test.ts` — czytasz, nie kasujesz; jeśli Twoja zmiana F1 zmienia sens którejś jego asercji, aktualizujesz z uzasadnieniem). | Odbiór 190 (`docs/program/funkcje/ODBIOR_190_DRUGI_KASOWNIK.md`) ocenił dyżur 190 jako PRZEŁOM na mechanizmie (oba kasowniki treści unieszkodliwione, realna ścieżka LLM→PostgreSQL→DOCX potwierdzona: `1 z 2` wywołań, hashe przeliczone niezależnie — NIE atrapa jak 185) i jednocześnie ocenił jakość PLIKU na `C`. Cytat rozstrzygający kierunek 195: „Marzenie właściciela: CZĘŚCIOWE → dyżur 195 »dokument pokazywalny«. Kasowniki zamknięte, ale plik: 269/~700 słów generycznej prozy · surowy Markdown w tekście (**Faza 1**, listy »- «) · CAŁE ciało bursztynową kursywą (granulacja: 1 blok = cały dokument) · »generic document · PL« po angielsku na okładce.” Sam raport dyżuru 190 (`CODEX_DAY190_DRUGI_KASOWNIK_REPORT.md`) podaje liczby źródłowe: `269` słów (metoda: `python-docx`, tokenizacja regexem z polskimi diakrytykami) wobec celu ok. `610` (10× dnia 90, `61` słów), rubryka K1-K6 z jednym `FAIL` na `K5` („269 słów; surowe `**`, lista w jednym akapicie”), oraz `1/1` sekcja i `1/1` blok prozowy — czyli CAŁA proza sekcji żyje w jednym `DocumentBlock`, więc jeden numer-założenie w środku maluje amber całą resztę. Zweryfikowane linia po linii na markerze `6894f3da05` (który JEST potomkiem merge'a dyżuru 190, `e4b6556443` — sprawdź `git merge-base --is-ancestor e4b6556443 6894f3da05`, oczekiwane `YES`, więc czytasz kod PO naprawie 190, nie przed): (1) `documentContentGenerator.ts:208-213` — `block.isAssumption` dla każdego bloku sekcji jest bezwarunkowo OR-owany z `title.changed || localizedTitleChanged || purposeChanged`; to jest F1 z ODBIOR_190 (tam cytowane jako `:206-212` — Twoja weryfikacja Z24 rozstrzyga dokładny zakres). (2) `next.title` (tytuł CAŁEGO dokumentu, odrębny od `section.title`) nie występuje ANI RAZU w `enforceDocumentSchemaGrounding` — `grep -c 'next\.title' documentContentGenerator.ts` daje `0`; to jest F2. (3) `generateBlockProse` (`documentBlockProseGenerator.ts:271`) ma wbudowaną furtkę `options.maxTokens ? [targets] : chunk(...)`, dziś nieużywaną przez jedynego produkcyjnego wołacza (`documentStudioService.ts:1013-1018`, zero argumentu `maxTokens`) — to jest dokładnie mechanizm, o którym mówi zlecenie właściciela („zbadaj batching sekcji w JEDNYM wywołaniu”), i ISTNIEJE już w kodzie, nieużywany. (4) `documentDocxRenderer.ts` `renderParagraphBlock`/`renderListBlocks` (`:535-587`) nie parsują Markdown w ogóle — to jest R3 z brzmienia zlecenia. (5) `renderCoverBlock` (`:1241-1371`) ma `documentTypeLabels` z DOKŁADNIE jednym wpisem (`steering_committee_report`) na `24` warianty `DocumentTypeKey` (`documentStudioTypes.ts:24-47`) — źródło literalnego „generic document” na okładce polskiego dokumentu, dosłownie zmierzone w odbiorze 190. (6) `buildAssumptionMarker` (`:502-509`) zwraca zaszyty na sztywno string angielski niezależnie od `schema.language`. ★★ Do wiedzy programu, POZA licencją tego dyżuru: ODBIOR_190 nazywa wprost, że teza „kasowników już nie ma” jest ZA MOCNA — trzeci kasownik ŻYJE świadomie w filtrze wierszy tabel PL (`documentContentGenerator.ts` ok. `:226-266`, fail-closed, testowany SIGMA), plus gałąź „acronym” uśpiona stałą (`GROUNDING_ACRONYM_RULE = 'allowed'`, `documentBlockContentGenerator.ts:442`) i deterministyczny stub EN w `renderCalloutBlock`/`buildSectionBlocks` — ZMIERZ czy Twój przebieg 195 go dotyka, ODNOTUJ, NIE naprawiaj (poza licencją). Wiersz `GEN-2` w `MODULE_ACCEPTANCE.md:149` mówi dziś: „Realna ścieżka jest `PROVEN`, ale bramka pozostaje `PARTIAL`: K5 jakości treści `FAIL` (surowy Markdown i zwarty akapit), a osobny próg graficzny D-8 `15/18` nie został zmierzony.” Ten dyżur atakuje dokładnie K5. |

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
cd /private/tmp/cx-day195-dokument

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day195-pg psql -U postgres -d cx195 \
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
cd /private/tmp/cx-day195-dokument

docker run -d --name cx-day195-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx195 \
  -p 127.0.0.1:6122:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day195-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6122/cx195 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6122/cx195 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day195-dokument && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6122/cx195 \
JWT_SECRET=cx195-test-secret-do-not-reuse \
npx vitest run server/src/services/documentStudio/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day195-dokument-artefakty/day195-dokument-pokazywalny.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day195-dokument && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/services/documentStudio/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day195-dokument-artefakty/day195-dokument-pokazywalny.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day195-dokument/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day195-pg psql -U postgres -d cx195 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day195-pg`.
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
> **(e) ★★ **Pierwsza: arytmetyka wywołań nie jest formalnością, jest bramką.** `chunk()` dzieli WSZYSTKIE cele prozy CAŁEGO schematu (nie per sekcja) na partie po `PROSE_BATCH_SIZE=2`; 5 celów prozy to `ceil(5/2)=3` wywołania — natychmiastowe złamanie `DEC-317`, nawet jeśli wygląda „tylko o jedną sekcję więcej”. Policz cele PRZED uruchomieniem czegokolwiek, nie po fakcie. ★★ **Druga: `options.maxTokens` jest realną furtką, ale ma cenę historyczną.** DOC-1 (komentarz w `documentBlockProseGenerator.ts:44-54`) opisuje wprost, ŻE poprzednia wersja robiła JEDNO wielkie wywołanie na CAŁY dokument i regularnie przekraczała twardy timeout `30000ms` w `aiService.generateChatResponse`, co dawało fail-soft → placeholdery → odrzucenie przez bramę anty-placeholder. Jeśli wybierzesz wymuszenie `maxTokens` (jedno wywołanie na wiele bloków), ZMIERZ czas trwania realnego wywołania i podaj go w raporcie z zapasem do 30s — nie zakładaj, że się zmieści, bo dokładnie to założenie już raz zawiodło produkcyjnie. ★★ **Trzecia: granulacja per akapit (R2) i limit wywołań (R1) ciągną w przeciwne strony, jeśli je traktujesz osobno — ale się składają, jeśli zaprojektujesz je RAZEM.** Jeśli podzielisz zwróconą prozę na wiele bloków PO stronie materializacji (nie PRZED wywołaniem modelu), to JEDEN target prozy na sekcję (mało wywołań, bo `collectTargets` liczy bloki PRZED podziałem) może dać WIELE granularnych bloków w wyniku (bo dzielisz odpowiedź modelu, nie prompt). Rozważ to jako główną ścieżkę, nie tylko `4-6 sekcji × 1 blok`. ★★ **Czwarta: `renderCalloutBlock` (`documentDocxRenderer.ts:615-632`) nie wywołuje `buildAssumptionMarker` w ogóle.** Jeśli Twoja granulacja skieruje treść-założenie do bloku typu `callout`, znacznik NIE POKAŻE SIĘ w DOCX mimo `isAssumption: true` — to jest cichy, inny defekt niż F1/F2, ale tej samej rodziny („mechanizm istnieje, konsument go nie woła” — wzorzec »wołacz istnieje ≠ renderuje się« z metodyki programu). Trzymaj granulowaną prozę w `paragraph`/listach, albo napraw też `renderCalloutBlock` i nazwij to jawnie jako rozszerzenie zakresu. ★★ **Piąta: `buildSectionBlocks` (`documentContentGenerator.ts`, gałęzie ok. `:479-566`) dopasowuje tytuły sekcji po ANGIELSKICH słowach kluczowych** (`'executive summary'`, `'decisions required'`, `'risks'`, `'next steps'`, `'appendix'`) NIEZALEŻNIE od języka dokumentu — polski tytuł sekcji, który przypadkiem zawiera jedno z tych angielskich słów, wpadnie w gałąź specjalną zamiast generyczną. Jeśli projektujesz outline z polskimi tytułami, sprawdź świadomie, w którą gałąź trafia KAŻDY tytuł — inaczej Twoja »sekcja Ryzyka« dostanie angielski `risk_table` ze stubami `TBD` zamiast prozy z modelu (bo `risk_table` nie jest typem prozy — `collectTargets` go pomija). ★★ **Szósta: `documentTypeLabels`/`densityLabels` w `renderCoverBlock` mają niepełne mapy — uzupełniaj TYLKO w zakresie realnie użytym w Twoim dowodzie, nie zgadując resztę 24 wariantów `DocumentTypeKey`.** Dodanie 24 tłumaczeń na pamięć bez sprawdzenia z właścicielem nazewnictwa branżowego to ryzyko wprowadzenia błędnych terminów konsultingowych do produktu — rozszerz mapę o typ, którego realnie używasz w dowodzie R1/R4, a resztę zgłoś jako lukę do osobnej decyzji nazewniczej. ★★ **Siódma: rubryka K1-K6 dnia 190 jest PUNKTEM STARTOWYM, nie ostatecznym kształtem — waż K5 realnie, nie kosmetycznie.** Nie wystarczy podnieść liczbę słów — K5 dnia 190 padł na DWÓCH niezależnych powodach (surowy Markdown ORAZ zwarty jeden-akapit); jeśli naprawisz tylko jeden z nich, K5 zostaje `FAIL` i musisz to napisać wprost, nie zaokrąglić w górę.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day195-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day195-dokument-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 — treść pełnej długości w limicie wywołań: zaprojektuj outline+prompt tak, by DOCX osiągnął rząd wielkości ~700+ słów sensownej polskiej prozy, z obowiązkową TABELĄ ARYTMETYKI WYWOŁAŃ (liczba sekcji × liczba bloków typu prose × wynikająca liczba partii/wywołań `generateChatResponse`) dowodzącą `≤2` w całym dyżurze (`DEC-2026-08-29-317`); rozstrzygnij między (a) wymuszeniem JEDNEGO wywołania przez `options.maxTokens` w `generateBlockProse` (omija `chunk()`, ale odtwarza ryzyko z historii DOC-1 — pojedynczy duży prompt przekraczający twardy timeout 30s w `aiService.generateChatResponse`) a (b) outline'em o małej liczbie bloków typu prose (≤4, żeby `ceil(N/2)≤2` z domyślnym `PROSE_BATCH_SIZE=2`) z bogatym, wielo-akapitowym promptem per blok. R2 — granulacja założeń: (i) F1 — `documentContentGenerator.ts:208-213` `block.isAssumption` dla KAŻDEGO bloku sekcji jest sumowany z `title.changed`/`localizedTitleChanged`/`purposeChanged` niezależnie od treści TEGO bloku — odepnij kontaminację, sygnał tytułu/celu sekcji ma trafiać do sekcji, nie bezwarunkowo do każdego jej bloku; (ii) podział zwróconej przez model prozy na wiele bloków-akapitów przy materializacji odpowiedzi w `generateBlockProse` (`:387-419`), tak żeby `isAssumption` (przez `enforceBlockGrounding` per akapit) dotyczyło AKAPITU z liczbą, nie całej sekcji zwróconej jako jeden blok; (iii) F2 — tytuł DOKUMENTU (`schema.title`, odrębny od `section.title`) nie jest dziś w ogóle sprawdzany przez `enforceDocumentSchemaGrounding` (zero wystąpień `next.title` w pliku) — brak kasowania (dobrze, naprawa 190 działa), ale też ZERO sygnału w `evidence.toVerify`; dodaj wykrywanie (bez modyfikacji treści tytułu) i wpis do `toVerify`, gdy tytuł zawiera niepotwierdzony/anglojęzyczny fragment. R3 — render: `renderParagraphBlock`/`renderListBlocks` (`documentDocxRenderer.ts:535-587`) mają wyrenderować podstawowy Markdown z prozy modelu (`**pogrubienie**`, listy `- `/`1. `) jako prawdziwe formatowanie DOCX (bold `TextRun`, prawdziwe akapity listy przez istniejący `numbering`), nie literalny tekst z gwiazdkami; `renderCoverBlock` (`:1241-1371`) ma dostać polskie etykiety `documentType`/`density` dla realistycznego zestawu typów dokumentu (dziś `documentTypeLabels` ma JEDEN wpis na 24); `buildAssumptionMarker` (`:502-509`) ma być językowo świadomy — dla `language==='pl'` znacznik PO POLSKU `[Założenie — wymaga źródła]` (decyzja nadzorcy, odwracalna: wariant polski domyślny dla `language==='pl'`, angielski zachowany dla `language==='en'`). R4 — F3: skomituj WŁASNY harness R2 (skrypt/test odtwarzający realną ścieżkę LLM→DOCX z §R1/R2) do repo — dyżur 190 tego nie zrobił (jego probe realnego LLM istniał tylko efemerycznie w worktree, nigdy nie trafił do `server/src/services/documentStudio/__tests__/`), więc przebieg 190 NIE jest dziś odtwarzalny przez nikogo innego. Klucz dostawcy NIGDY nie trafia do repo — wyłącznie przez licencjonowaną komendę źródłową (patrz R1/DEC-317)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6122` albo `5064 i 5065` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6122` albo `5064 i 5065`** (`Z7`).

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

Dyżur 190 unieszkodliwił OBA znane kasowniki treści w Studiu Dokumentów i udowodnił —
pierwszy raz w historii programu — realny plik DOCX przez pełną produkcyjną ścieżkę
(`HTTP → ApiGateway → verifyToken → PostgreSQL → OpenRouter → enforceDocumentSchemaGrounding
→ DOCX`), z hashami przeliczonymi niezależnie przez odbiór. Odbiór 190
(`docs/program/funkcje/ODBIOR_190_DRUGI_KASOWNIK.md`) ocenił mechanizm na `A−` i realną
ścieżkę na `A−`, ale jakość PLIKU na `C`, i nazwał wprost, co zostaje do zrobienia:

> **Marzenie właściciela: CZĘŚCIOWE → dyżur 195 „dokument pokazywalny”.**
> Kasowniki zamknięte, ale plik: 269/~700 słów generycznej prozy · surowy Markdown
> w tekście (`**Faza 1**`, listy „- ”) · CAŁE ciało bursztynową kursywą (granulacja:
> 1 blok = cały dokument) · „generic document · PL” po angielsku na okładce.

To jest pierwszy dyżur programu, którego bramką końcową jest **PLIK**, który nadzorca
kładzie przed właścicielem do akceptu — nie log, nie `PASS` w JSON-ie testów.

**Cztery mierzalne przyczyny, zweryfikowane na markerze `6894f3da05`** (potomek merge'a
dyżuru 190, `e4b6556443` — sprawdź `git merge-base --is-ancestor e4b6556443 6894f3da05`
zanim uwierzysz jednemu wierszowi tego dokumentu):

**(1) F1 — kontaminacja `isAssumption` całej sekcji.**
`server/src/services/documentStudio/documentContentGenerator.ts:208-213`:

```ts
// :200  for (const block of section.blocks) {
// ...
// :208  block.isAssumption =
// :209    block.isAssumption === true ||
// :210    guarded.changed ||
// :211    title.changed ||
// :212    localizedTitleChanged ||
// :213    purposeChanged;
```

Jeśli tytuł LUB cel sekcji zawiera flagowany token, **KAŻDY blok tej sekcji** dostaje
`isAssumption: true` — niezależnie od tego, czy jego własna treść ma z tym cokolwiek
wspólnego. Jedna liczba (albo jeden tytuł „Plan działania”) maluje bursztynową kursywą
całą resztę sekcji. To jest osobny defekt od „1 blok = cała proza” (patrz R2), ale oba
prowadzą do tego samego efektu wizualnego: nadmierne, niewiarygodne oznaczanie.

**(2) F2 — tytuł dokumentu bez sygnału.** `schema.title` (tytuł CAŁEGO dokumentu, odrębny
od `section.title`) nie występuje ANI RAZU w `enforceDocumentSchemaGrounding`:

```bash
$ grep -c 'next\.title' documentContentGenerator.ts
0
```

Dobra wiadomość: naprawa 190 nie kasuje już tytułu dokumentu (dawne `:182 next.title =
removed` zniknęło). Zła wiadomość: nic go nie zastąpiło — jeśli tytuł zawiera niepotwierdzony
lub anglojęzyczny fragment, `evidence.toVerify` (budowane przez `buildDocumentEvidenceContract`,
`:48-94`) nie ma o tym ŻADNEGO wpisu. Sygnał zniknął razem z kasowaniem, zamiast zostać
przeniesiony.

**(3) Furtka na arytmetykę wywołań, nieużywana.** Realny wołacz warstwy prozy to
`documentBlockProseGenerator.ts` (**nie** `documentBlockContentGenerator.ts:693-730`, jak
błędnie wskazywała instrukcja dnia 190 — poprawka odnotowana w jej własnym raporcie, punkt 5
„Korekt wobec instrukcji”). `generateBlockProse` (`:252-421`) zbiera cele przez
`collectTargets` (WYŁĄCZNIE bloki `paragraph|callout|bullet_list|numbered_list`) i dzieli je:

```ts
// :271  const batches = options.maxTokens ? [targets] : chunk(targets, PROSE_BATCH_SIZE);
```

`PROSE_BATCH_SIZE = 2` (`:59`). Domyślnie: `ceil(liczbaCelówProzy / 2)` wywołań
`generateChatResponse`, puszczonych równolegle (`BATCH_CONCURRENCY = 4`, `:72`). Ale gdy
caller poda `options.maxTokens`, `chunk()` jest CAŁKOWICIE pomijany — WSZYSTKIE cele lądują
w jednej partii, **jedno wywołanie niezależnie od liczby sekcji/bloków**. Dzisiejszy jedyny
produkcyjny wołacz (`documentStudioService.ts:1013-1018`) NIE podaje `maxTokens`:

```ts
// :1013  if (params.useLlm) {
// :1014    provisionalSchema = await generateBlockProse(provisionalSchema, generationIntake, sourceRefs, {
// :1015      enable: true,
// :1016      warnings: warningsCollector,
// :1017    });
// :1018  }
```

To jest DOKŁADNIE mechanizm, o który pyta zlecenie właściciela („zbadaj batching sekcji
w JEDNYM wywołaniu”) — już istnieje w kodzie, po prostu nieużywany.

**(4) Render i okładka.** `renderParagraphBlock`/`renderListBlocks`
(`documentDocxRenderer.ts:535-587`) emitują `block.content.text`/`items` jako **jeden
literalny `TextRun`** — zero parsowania Markdown; `**Faza 1**` i `- punkt` trafiają do DOCX
dosłownie, z gwiazdkami i myślnikami. `renderCoverBlock` (`:1241-1371`) tłumaczy
`documentType` na polski przez słownik `documentTypeLabels` (`:1244-1246`) z **jednym**
wpisem (`steering_committee_report`) na **24** warianty `DocumentTypeKey`
(`documentStudioTypes.ts:24-47`) — źródło „generic document” po angielsku na okładce
polskiego dokumentu, zmierzone dosłownie w odbiorze 190. `buildAssumptionMarker`
(`:502-509`) zwraca string zaszyty na sztywno po angielsku, niezależnie od `schema.language`.

**Filozofia jest ta sama co w dyżurze 190, teraz zastosowana do JAKOŚCI, nie tylko do
ISTNIENIA treści.** D-8 mówi „poluzować + rubryka” — dyżur 185 zrobił to dla liczb, 190 dla
kasowania po języku, 195 robi to dla **granulacji sygnału** i **czytelności pliku**.

# 2. TEZY ZLECENIA

Wszystkie poniższe to **rozkaz pomiarowy, nie prawda objawiona**. Obalenie którejkolwiek
jest sukcesem dyżuru i wchodzi do „Korekt wobec instrukcji”.

- **T1.** `collectTargets` liczy cele prozy z CAŁEGO schematu na raz (nie per sekcja) —
  `ceil(N/2)` wywołań, gdzie `N` to SUMA bloków typu prose we WSZYSTKICH sekcjach.
  Weryfikuj to arytmetycznie na SWOIM outline przed uruchomieniem czegokolwiek.
- **T2.** `options.maxTokens` przekazane do `generateBlockProse` wymusza dokładnie JEDNO
  wywołanie niezależnie od liczby celów, bo pomija `chunk()` (`:271`). Sprawdź, czy da się
  to bezpiecznie włączyć z poziomu `documentStudioService.ts:1013-1018` bez naruszania
  innych wywołań tej funkcji (sprawdź WSZYSTKICH callerów `generateBlockProse`, nie tylko
  ten jeden).
- **T3.** F1 (`:208-213`) i „1 blok = cała proza sekcji” (dzisiejszy efekt architektury:
  1 target prozy = 1 `DocumentBlock`, nawet gdy zwrócony tekst ma kilka akapitów) to DWA
  ODDZIELNE defekty, które ubocznie się wzmacniają. Napraw je świadomie jako dwa, nie jeden.
- **T4.** `renderCalloutBlock` (`documentDocxRenderer.ts:615-632`) NIE wywołuje
  `buildAssumptionMarker` w ogóle — blok `callout` z `isAssumption: true` nie pokazuje w
  DOCX żadnego znacznika. Sprawdź, czy Twoja granulacja (R2) omija ten typ bloku, albo
  rozszerz naprawę i nazwij to jawnie.
- **T5.** `buildSectionBlocks` (`documentContentGenerator.ts`, gałęzie ok. `:479-566`)
  dopasowuje tytuły sekcji po angielskich frazach (`'executive summary'`, `'risks'`,
  `'next steps'`…) NIEZALEŻNIE od języka dokumentu. Polski tytuł zawierający przypadkiem
  jedną z tych fraz trafi w gałąź specjalną (często niebędącą typem prozy — np.
  `risk_table` — więc pominiętą przez `collectTargets` i LLM w ogóle jej nie dotknie).

# 3. POZYCJE DYŻURU

## R1 — treść pełnej długości w limicie DEC-317

**Cel, dosłownie:** DOCX z realnym, sensownym tekstem po polsku rzędu wielkości **więcej niż
269** słów dnia 190 — cel orientacyjny **~700+**, w **maksymalnie dwóch** rzeczywistych
wywołaniach modelu w całym dyżurze (R1 + R4 razem, `DEC-2026-08-29-317`).

**Podejście rozstrzygasz Ty, z arytmetyką, nie opinią.** Dwa kandydaci nazwani wprost w
zleceniu właściciela:

1. **Wymuszenie JEDNEGO wywołania przez `options.maxTokens`.** Ustaw budżet tokenów tak,
   by `chunk()` się nie uruchomił (`:271`) — wszystkie cele prozy (ile by ich nie było)
   lecą w jednym prompt/response. Zysk: liczba sekcji/bloków przestaje być ograniczona
   arytmetyką wywołań. Koszt: to DOKŁADNIE architektura sprzed naprawy DOC-1
   (`documentBlockProseGenerator.ts:44-54` — komentarz w kodzie opisuje, że pojedynczy
   wielki prompt na CAŁY dokument regularnie przekraczał twardy timeout `30000ms` w
   `aiService.generateChatResponse`, co dawało fail-soft → placeholdery → odrzucenie przez
   bramę anty-placeholder). **Jeśli wybierzesz to podejście, ZMIERZ realny czas wywołania i
   podaj go w raporcie z zapasem do 30s** — nie zakładaj, że się zmieści.
2. **Outline o małej liczbie celów prozy (≤4) z bogatym promptem per blok**, żeby
   `ceil(N/2) ≤ 2` z domyślnym `PROSE_BATCH_SIZE=2`. Np. 2 sekcje × 1 blok prozy każda =
   `N=2` → `ceil(2/2)=1` wywołanie (zostawia margines na R4). Poproś model o WIELE
   akapitów w jednym bloku (rozszerz `buildUserPrompt`/`buildSystemPrompt` o oczekiwaną
   długość i strukturę), a granulację na osobne bloki-akapity zrób PO stronie
   materializacji (patrz R2) — nie przed wywołaniem.

**Nie musisz literalnie zrobić 4-6 sekcji z 1 blokiem każda, jeśli zaprojektujesz R1+R2
razem: 1-2 bogate cele prozy (mało wywołań) + podział odpowiedzi na wiele bloków przy
materializacji (dużo granularnych bloków w WYNIKU) domykają jednocześnie „treść pełnej
długości” i „wiele bloków per sekcja” bez łamania arytmetyki.** Jeśli mimo to wolisz
dosłowny outline wielosekcyjny, uważaj na T5 — sekcje o tytułach dopasowujących się do
angielskich gałęzi `buildSectionBlocks` (np. „Risks”, „Next steps”) NIE dostaną bloku
prozy w ogóle (bo `risk_table`/`bullet_list`-ze-stubami nie zawsze trafiają do
`collectTargets`, a `risk_table` nigdy — sprawdź to sam per typ bloku).

**TABELA OBOWIĄZKOWA — arytmetyka wywołań, bez niej pozycja jest nieukończona:**

| Element outline'u | Typ bloku | Cel prozy? (w `collectTargets`) | Partia (jeśli domyślny chunking) |
|---|---|---|---|
| Sekcja 1 — ... | paragraph | tak | 1 |
| Sekcja 2 — ... | ... | ... | ... |
| **SUMA celów prozy** | | **N = ?** | **wywołania = ? (≤2 wymagane)** |

**Ukończone, gdy:** tabela arytmetyki jest w raporcie, kompletna i policzona (nie
przepisana); realny DOCX ma **rząd wielkości więcej** słów niż `269` (podaj liczbę z
metodą liczenia — powtórz metodę `python-docx` dnia 190 dla porównywalności, albo uzasadnij
inną); jeśli cel `~700` nie zostanie osiągnięty, napisz wprost ile wyszło i dlaczego,
zamiast zaokrąglać w górę lub dokładać sekcje ponad budżet wywołań.

## R2 — granulacja założeń: F1 + podział na akapity + F2

### (a) F1 — odepnij kontaminację całej sekcji

`documentContentGenerator.ts:208-213`. Dziś sygnał tytułu/celu sekcji (`title.changed`,
`localizedTitleChanged`, `purposeChanged`) jest bezwarunkowo OR-owany do KAŻDEGO bloku tej
sekcji. Napraw tak, żeby:

- `isAssumption` bloku zależy od WŁASNEJ treści bloku (`guarded.changed`,
  `localized.changed`) — jak dziś dla `guarded.changed`;
- sygnał z tytułu/celu sekcji NIE spływa automatycznie do każdego bloku tej sekcji. Jeśli
  uznasz, że tytuł/cel z flagowanym tokenem zasługuje na WŁASNY sygnał (spójnie z D-8), to
  ma iść do `evidence.toVerify` na poziomie sekcji (analogicznie do F2 poniżej dla
  dokumentu), NIE do `isAssumption` każdego bloku.

**Rozstrzygnij i zapisz w raporcie:** czy Twoja zmiana wpływa na testy `EPSILON`/`SIGMA` w
`documentPremiumGroundingNormalization.test.ts` oraz na `day190.obviousEnglish-grounding.test.ts`
(zwłaszcza test R1 dnia 190, który dziś asercjuje na `isAssumption` bloku pod wpływem
kontaminacji tytułu) — **aktualizujesz asercję z uzasadnieniem, nie usuwasz test**.

### (b) Podział prozy modelu na bloki-akapity przy materializacji

`generateBlockProse` (`documentBlockProseGenerator.ts:387-419`) dziś przypisuje CAŁY
zwrócony `payload.text` do JEDNEGO istniejącego bloku (`content.text = payload.text`).
Zbadaj i zaimplementuj podział: gdy zwrócony tekst zawiera wyraźne granice akapitów
(podwójny znak nowej linii, albo inny separator, który sam wybierzesz i uzasadnisz),
zamień JEDEN placeholder-blok na WIELE nowych `DocumentBlock` typu `paragraph`
(zachowując kolejność), każdy przepuszczony PRZEZ `enforceBlockGrounding` OSOBNO — tak,
żeby `isAssumption` dotyczyło akapitu, który faktycznie zawiera niepotwierdzoną
liczbę/frazę, a nie całej sekcji.

**Rozstrzygnij i zapisz w raporcie:**
- gdzie dokładnie w `generateBlockProse` wpinasz podział (przed czy po
  `enforceBlockGrounding`, przed czy po deep-clone `:379`);
- co się dzieje z blokami typu `bullet_list`/`numbered_list`/`callout` — czy też są
  dzielone, czy zostają jako jeden blok (uzasadnij różnicę, jeśli jest);
- czy podział zmienia `section.blocks` w sposób widoczny dla renderera web/TipTap
  (`src/components/DocumentStudio/editor/schemaToTipTap.ts` — TYLKO ODCZYT, nie zmieniasz,
  ale sprawdź, że więcej bloków tego samego typu nie psuje istniejącego mapowania).

### (c) F2 — sygnał tytułu dokumentu

Dodaj w `enforceDocumentSchemaGrounding` (po `next.evidence = buildDocumentEvidenceContract(...)`,
`:451`) sprawdzenie `next.title` analogicznym mechanizmem detekcji co dla `section.title`
(`localizePolishValue`/`obviousEnglish`), ale **BEZ mutowania `next.title`** — dyżur 190
świadomie przestał go kasować, ty nie masz przywracać żadnej formy nadpisywania. Jeśli
detekcja pokaże `changed: true`, dopisz wpis do `next.evidence.toVerify`, np. „Tytuł
dokumentu zawiera niepotwierdzony/niepolski fragment — do weryfikacji.” w języku dokumentu.

**Ukończone, gdy:** (a) test pokazujący, że sekcja z flagowanym tytułem NIE oznacza już
niezwiązanego z nim bloku jako `isAssumption` (podczas gdy blok z własną niepotwierdzoną
liczbą nadal jest oznaczany); (b) realny DOCX z R1 ma WIĘCEJ niż jeden blok prozy per
sekcja bogatą, z `isAssumption` różnym między blokami tej samej sekcji (dowód mutacyjny:
policz `N akapitów z isAssumption=true` / `M akapitów razem`, oba > 0 i < M, w co najmniej
jednej sekcji); (c) `evidence.toVerify` zawiera wpis o tytule dokumentu, gdy tytuł jest
flagowany, i NIE zawiera go, gdy tytuł jest czysty — test w obie strony.

## R3 — render: Markdown, okładka PL, znacznik PL

### Markdown w DOCX

`renderParagraphBlock`/`renderListBlocks` (`documentDocxRenderer.ts:535-587`) mają
wyrenderować podstawowy Markdown z prozy modelu jako prawdziwe formatowanie DOCX, nie
literalny tekst:
- `**pogrubienie**` → `TextRun({ bold: true })` (podziel tekst na segmenty pogrubione/zwykłe);
- linie zaczynające się `- ` lub `1. ` → prawdziwe akapity listy przez istniejący mechanizm
  `numbering` (ten sam, którego już używa `renderListBlocks` dla bloków `bullet_list`/
  `numbered_list` — NIE wymyślaj nowego numbering reference, reużyj `DOCX_NUMBERING_REFERENCE`).

Zbadaj `documentSchemaRenderer.ts` (renderer do markdown-exportu — inny konsument, TYLKO
ODCZYT) i pakiet `marked` (`server/package.json`: `"marked": "^18.0.5"`, zainstalowany, ale
NIE zaimportowany w żadnym pliku `documentStudio/*.ts` poza komentarzem) — zdecyduj i
uzasadnij: lekki własny parser inline (bold + listy, zakres wystarczający na ten dyżur) czy
`marked.lexer()` zmapowany na `Paragraph`/`TextRun`. Cokolwiek wybierzesz, **nie renderuj
GFM-tabeli osadzonej w `text` (patrz komentarz `documentBlockProseGenerator.ts:402-417`,
„N-9”) jako listy/akapitu** — jeśli Twój parser ją napotka, albo zbuduj z niej prawdziwą
`Table` (reużywając `renderTableBlock`), albo zostaw ją nietkniętą i odnotuj jako lukę do
kolejnego dyżuru (nie milcz o niej).

### Okładka po polsku

`renderCoverBlock` (`:1241-1371`). Rozszerz `documentTypeLabels`/`densityLabels` o WARTOŚCI
REALNIE UŻYTE w Twoim dowodzie R1/R4 (nie zgaduj tłumaczenia dla wszystkich 24 wariantów
`DocumentTypeKey` na pamięć — to ryzyko wprowadzenia błędnej terminologii konsultingowej do
produktu bez przeglądu właściciela; zgłoś resztę jako lukę nazewniczą do osobnej decyzji).
`densityLabels` ma dziś 2/4 warianty (`concise`, `detailed`) — dopełnij `standard`/
`comprehensive`, bo to zamknięty, bezpieczny słownik (4 wartości, nie 24).

### Znacznik po polsku

`buildAssumptionMarker(font: string)` (`:502-509`) ma dostać parametr języka (albo całe
`RenderContext`, z którego już dziś ma dostęp do `ctx.schema.language` w obu wołaniach —
`:547`, `:575`) i zwracać:
- `language === 'pl'` → `'  [Założenie — wymaga źródła]'`;
- w przeciwnym razie → dzisiejszy `'  [Assumption — needs source]'` (BEZ zmian dla EN).

**DECYZJA NADZORCY (odwracalna, wpisz jako rozstrzygniętą, nie do renegocjacji w tym
dyżurze):** wariant polski jest DOMYŚLNY dla `language === 'pl'`. Jeśli ta zmiana wymaga
dotknięcia `t()`/mechanizmu lokalizacji renderera — sprawdź, czy taki mechanizm w ogóle
istnieje w `documentDocxRenderer.ts` (grep `isPolish`/`i18n`/`t(`); jeśli nie istnieje,
prosty warunek na `ctx.schema.language` (wzorem dziesiątek istniejących `isPolish ? … : …`
w tym samym pliku, np. `renderCoverBlock:1254-1256`) jest wystarczający i spójny ze stylem
pliku — nie buduj nowej infrastruktury i18n dla jednego stringa.

**Ukończone, gdy:** realny DOCX z R1 nie zawiera surowych `**`/`- ` w tekście widocznym dla
czytelnika (policz wystąpienia regexem po eksporcie — cel `0`); okładka pokazuje polską
etykietę typu dokumentu i gęstości dla dokumentu użytego w dowodzie (nie „generic document”);
znacznik założenia w polskim dokumencie brzmi `[Założenie — wymaga źródła]`, potwierdzone
wizualnie (LibreOffice render → PNG, jak w dniu 190) i tekstowo (python-docx).

## R4 — F3: skomituj harness R2

Dyżur 190 udowodnił realną ścieżkę LLM→DOCX, ale narzędzie, które to zrobiło (skrypt
budujący JWT, wołający `/generate` z `useLlm: true`, czytający bazę, eksportujący DOCX,
liczący SHA-256, wykonujący mutację granicy), istniało wyłącznie efemerycznie w worktree
dyżuru (`/private/tmp/cx-day190-drugi-kasownik-artefakty/*.log`, nigdy w git). Jedyny
skomitowany plik dnia 190 (`server/src/services/documentStudio/__tests__/
day190.obviousEnglish-grounding.test.ts`) pokrywa WYŁĄCZNIE R1/R3 na granicy — zero LLM,
zero HTTP (`grep -c 'generateChatResponse\|OPENROUTER\|useLlm' ...` na tym pliku daje `0`).
Efekt: przebieg R2 dnia 190 nie jest dziś odtwarzalny przez nikogo poza jego autorem.

**Zadanie:** skomituj WŁASNY harness/probe R2 dnia 195 (nowy plik, np.
`server/src/services/documentStudio/__tests__/day195.real-llm-docx-probe.*` — dobierz
rozszerzenie/format zgodny z resztą katalogu) tak, by:
- budował JWT, wołał realną ścieżkę HTTP `/generate` → `/export/docx` z `useLlm: true`;
- czytał klucz WYŁĄCZNIE ze środowiska (już wczytanego przez licencjonowaną komendę
  źródłową) — **zero wartości klucza w pliku, zero fallbacku, który po cichu ominie
  wymóg realnego wywołania**;
- gdy klucz jest nieobecny w środowisku (np. uruchomienie przez kogoś bez dostępu),
  test/skrypt ma to WYKRYĆ i jawnie zgłosić pominięcie z komunikatem — nie ma fałszywie
  udawać sukcesu ani cicho przejść na deterministyczny fallback bez ostrzeżenia;
- wykonuje TĘ SAMĄ mutację granicy (stary F1/stara heurystyka → nowy) na tym samym
  schemacie, bez drugiej generacji;
- respektuje `Z31` (`assertRealPostgresTestEnvironment()` bez argumentów) i limit
  DEC-317 (dzieli budżet dwóch wywołań z R1 — **R1 i R4 RAZEM ≤2 wywołania w całym
  dyżurze**, nie 2+2).

**Ukończone, gdy:** plik jest w `git log` gałęzi dyżuru, uruchamialny przez kogoś innego
(inny nadzorca/dyżur) bez dostępu do Twojego worktree, z jasną instrukcją w komentarzu
nagłówkowym pliku (jedna sekcja: jak uruchomić, jaki env potrzebny, co dowodzi).

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis | `server/src/services/documentStudio/documentContentGenerator.ts` — WYŁĄCZNIE `enforceDocumentSchemaGrounding` (`:102` i dalej): F1 (`:208-213`), F2 (nowy blok po `:451`); `buildSectionBlocks`/`buildDocumentSchema` JEŻELI Twój projekt R1 wymaga zmiany liczby/typu bloków per sekcja — uzasadnij każdą taką zmianę osobno w raporcie. Zakaz zmian w `plCanonical` (`:116-134`), w filtrze wierszy tabel — trzeci kasownik (ok. `:226-266`) i w bloku `SIGMA-2` (od ok. `:268`) |
| Zapis | `server/src/services/documentStudio/documentBlockProseGenerator.ts` — R1 (prompt/batching, `:165-227`, `:245-421`) i R2(b) (podział na akapity przy materializacji, `:387-419`). Zakaz zmian w `PROSE_BLOCK_TYPES` (`:38`) bez uzasadnienia, dlaczego rozszerzenie/zawężenie zbioru typów prozy jest bezpieczne |
| Zapis | `server/src/services/documentStudio/documentStudioService.ts` — WYŁĄCZNIE wołanie `generateBlockProse(...)` (`:1013-1018`), TYLKO jeśli Twój wybór R1 (kandydat 1, `maxTokens`) tego wymaga. Zero innych zmian w tym pliku |
| Zapis | `server/src/services/documentStudio/documentDocxRenderer.ts` — `renderParagraphBlock`/`renderListBlocks` (`:535-587`, parsowanie Markdown), `buildAssumptionMarker` (`:502-509`, język), `renderCoverBlock` (`:1241-1371`, `documentTypeLabels`/`densityLabels`). Zakaz zmian w `renderTableBlock`, `renderKpiStripBlock`, `renderChartBlock`, `renderDrdCoverBlock`, `renderSources`, `renderTocBlock` poza tym, czego Twój markdown-parser realnie dotyka (np. reużycie `DOCX_NUMBERING_REFERENCE`) |
| Zapis | `server/src/services/documentStudio/__tests__/documentPremiumGroundingNormalization.test.ts`, `server/src/services/documentStudio/__tests__/day190.obviousEnglish-grounding.test.ts` — aktualizacja asercji, które zmienią sens po F1 (R2a); **zmieniasz oczekiwanie, nie usuwasz testu**, każdą zmianę uzasadniasz w raporcie |
| Zapis | NOWE pliki testowe/harness `day195.*` w `server/src/services/documentStudio/__tests__/` — pełna licencja, z zastrzeżeniem `Z18` i `Z31`; to jest R4/F3 |
| Zapis | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/11_MATERIALS/MODULE_ACCEPTANCE.md` — WYŁĄCZNIE wiersz `GEN-2` (ok. `:149`). Nie dotykasz `GEN-1`, `GEN-3`, `GEN-4`, `GEN-5` |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY195_DOKUMENT_REPORT.md` |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/documentStudio/documentBlockContentGenerator.ts` — naprawiony i scalony w dyżurze 185; `unsupportedClaimInString`, `enforceBlockGrounding`, `GROUNDING_ACRONYM_RULE`, `SAFE_BUSINESS_ACRONYMS`, `POLISH_HEADER_TRANSLATIONS`, `POLISH_INTENT_RE` nietykalne |
| Odczyt | `server/src/services/documentStudio/documentSchemaRenderer.ts` — inny konsument (eksport markdown), kontekst dla decyzji R3, NIE zmieniasz |
| Odczyt | `server/src/services/documentStudio/documentQaService.ts` (`runLanguageQa`, ok. `:797-830`) — niezależna warstwa QA wykrywająca wyciek języka per blok; kontekst dla R3, NIE zmieniasz |
| Odczyt | `src/components/DocumentStudio/**` — front, poza zakresem (patrz `TRASY_FRONT`), NIE zmieniasz |
| Odczyt | `docs/program/funkcje/ODBIOR_190_DRUGI_KASOWNIK.md`, `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY190_DRUGI_KASOWNIK_REPORT.md`, `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY90_LLM_DOWOD_PLIKIEM_REPORT.md`, `docs/program/funkcje/DECYZJE_WLASCICIELA_2026-08-30_WIECZOR.md` (D-8), `OWNER_DECISION_LEDGER_2026-08-24.md` (`DEC-2026-08-29-317`) |
| Odczyt | `~/.consultify-openrouter` — WYŁĄCZNIE przez `set -a; . ~/.consultify-openrouter; set +a`; nigdy nie wypisujesz zawartości |

**Nietykalne imiennie:** cały `documentBlockContentGenerator.ts` (naprawa 185, scalona);
`GROUNDING_ACRONYM_RULE` i reguła akronimów; `plCanonical`, trzeci kasownik tabel (`:226-266`)
i blok `SIGMA-2` w `documentContentGenerator.ts`; kontrakt D-8 i mechanizm `isAssumption` w
`src/components/DocumentStudio/**`; każdy `MODULE_ACCEPTANCE.md` poza wierszem `GEN-2` w
`11_MATERIALS`.

**Rozłączność z partią równoległą:** ten dyżur dotyka WYŁĄCZNIE warstwy prozy i granicy
groundingu Studia Dokumentów plus jego renderera DOCX. Przed pierwszym commitem sprawdź
`git log` gałęzi bazowej, czy żaden z równolegle biegnących dyżurów nie wszedł w te same
pliki — jeśli tak, zgłoś to jako kolizję zasobową ZANIM zaczniesz pisać, nie po.

# 5. TWARDE ZASADY

- ★★ **`Z15` NIE OBOWIĄZUJE W R1/R4.** Realne wywołanie modelu jest wymogiem tych pozycji.
  Licencja na klucz i jedyna dozwolona komenda źródłowa — jak w dyżurze 190, wpisana w
  „ZAKAZ_WLASCIWY_TEMU_DYZUROWI”. W R2/R3 modelu nie wołasz w ogóle — pracujesz na
  schemacie już wypełnionym w R1/R4, testy na granicy/renderze są deterministyczne.
- ★★ **`Z40` bez wyjątku:** wartość klucza nie pojawia się nigdzie. `obecny`/`nieobecny`
  albo długość. **Maksymalnie DWA realne wywołania modelu w CAŁYM dyżurze** (R1 i R4
  RAZEM, nie osobno) — `DEC-2026-08-29-317`. `POST /plan` z `useLlm: true` jest ZAKAZANY.
- ★★ **`Z31` — ZAKAZ PINOWANIA BAZY W TESTACH.** `assertRealPostgresTestEnvironment()` BEZ
  ARGUMENTÓW, bez pinowania hosta/portu/`DATABASE_URL`. Sześć incydentów w programie,
  dyżur 193 zbiorczo je odpiął — nie dokładaj siódmego.
- ★ **NIE DOTYKASZ `documentBlockContentGenerator.ts`** poza odczytem. Naprawa 185,
  scalona. Zmiana „przy okazji” jest dokładnie wzorcem, przed którym ostrzega metodyka
  programu.
- ★ **NIE ZMIENIASZ `plCanonical`, trzeciego kasownika tabel (ok. `:226-266`) ani bloku
  `SIGMA-2`.** Poza zakresem tego dyżuru — zmierz, czy Twój przebieg go dotyka
  (najprawdopodobniej nie, jeśli Twój outline nie ma bloku `table`/`risk_table` z kolumną
  `initiative`/`inicjatywa`), odnotuj w raporcie, nie naprawiaj.
- ★ **NIE ZMIENIASZ reguły akronimów** (`GROUNDING_ACRONYM_RULE`) **ani kontraktu D-8**
  (liczby-założenia zachowywane i oznaczane). Jeśli granulacja (R2b) sprawi, że akapit z
  niepotwierdzoną liczbą przestanie nieść `isAssumption` — to regresja anty-fabrykacyjna,
  nie naprawa.
- ★ **Sprzątanie kontenera: `docker rm -f -v`** — z `-v`.
- **Dowód plikiem jest obowiązkowy i nie jest opcjonalny.** Zielony `vitest` nie zamyka
  R1/R2/R3/R4. Fixture z ręcznie zaszytym `isAssumption` **nie jest plikiem dowodowym**.
- **Nie udajesz realnego wywołania przez fallback.** `documentStudioService.ts:1009-1013`
  woła model best-effort: każda awaria zwraca deterministyczny schemat bez błędu. Dowodem
  jest log `LLM call success` z realnym `tokens`/`durationMs`, nie `HTTP 200`.
- **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.** Wszystko lokalnie.
- Pułapka: bez `RUN_DB_TESTS=1` testy backendowe idą na MOCK DB. Pułapka:
  `No test files found` **nie jest** `PASS`. Pułapka: `npx vitest run` bywa kończy się
  `exit 0` mimo czerwonych testów — liczby i **nazwy** czytasz z JSON-a (`Z37`).
- ★ Port **5000 zajęty na stałe przez macOS Control Center**; port **5037** zajęty przez
  `adb` — nie używaj żadnego z nich.
- **Sekcja „TWIERDZENIA NIEZWERYFIKOWANE” w raporcie jest obowiązkowa.** Wypisz w niej
  wprost: czy tabela arytmetyki wywołań jest kompletna czy skrócona; czy liczba słów
  pochodzi z pomiaru czy z oszacowania; czy granulacja (R2b) objęła WSZYSTKIE typy bloków
  prozy czy tylko `paragraph`; czy `renderCalloutBlock` (T4) został sprawdzony czy założony;
  czy trzeci kasownik tabel dotyka Twojego przebiegu czy nie; czy próg graficzny D-8
  `15/18` został zmierzony (najpewniej NIE — rubryka K1-K6 go nie zastępuje). Brak takiej
  sekcji jest podstawą odrzucenia dyżuru.
