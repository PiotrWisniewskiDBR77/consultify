# INSTRUKCJA DYŻURU nr 206 — Codex — „Modul 17, pozycja 17-B (ogniwo P1a): PETLA NARZEDZIOWA READ w strumieniu czatu Teresy — model dostaje definicje narzedzi CZYTAJACYCH i wola je iteracyjnie, za flaga `ENABLE_TERESA_TOOL_LOOP` domyslnie OFF, z krokami widocznymi w UI (SSE `tool_step`), z KAZDYM wywolaniem przez istniejace bramki (webSearchGovernance, retrieval policy fail-closed, izolacja sejfu) i licznikiem kosztu — z dowodem scenariuszem, w ktorym model SAM wybiera `get_initiative_status` → `calculate_financial` → `compare_benchmarks` (Z15 zniesione dla R3b). ZERO narzedzi zapisujacych: WRITE-as-proposal to 17-C"

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
> **wyłącznie** `/private/tmp/cx-day206-tool-loop`.

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
Zakres: **13_CHAT — rdzen czatu Teresy (`POST /api/ai/chat/stream`), warstwa wiazania narzedzi w `AIPipeline` i `llmService.callStream`, rejestr `AI_TOOLS`/`executeToolCall` w `server/src/services/ai/toolDefinitions.ts`. Kontrakt: `docs/program/funkcje/ARCHITEKTURA_AGENTA_TERESY.md` §3 (ogniwo `P1`) + §7 (pozycja `17-B tool-loop READ (P1a)`) + zasada wlasciciela D-15 (`agent ma obejmowac prace ze wszystkimi narzedziami aplikacji`). ★ Dyzur PRZEKROJOWY po stronie danych (narzedzia czytaja inicjatywy, oceny, benchmarki, wiedze), ale NIE zmienia zadnego ekranu modulowego ani zadnej trasy modulu — jedyna powierzchnia wizualna to lista krokow w dymku czatu**.
Trasy front: `Front zmieniasz w TRZECH miejscach, wylacznie po to, zeby krok narzedzia byl WIDOCZNY: (1) `src/hooks/useAIStream.ts` — nowy typ zdarzenia SSE i jego obsluga, wzorzec `ResearchProgressEvent` (`:406`) i galaz `if (evt.type === 'research_progress')` (`:1111`); (2) `src/components/AIChat/MessageRenderer.tsx` — render obok bloku `metadata.researchProgress` (`:798-815`); (3) NOWY komponent listy krokow w `src/components/AIChat/`, wzorzec ksztaltu `src/components/AIChat/ResearchProgress.tsx`. ★★ PULAPKA RENDERU, przeczytaj ZANIM zaplanujesz zrzut: `dev-render/screens/chat-split-teresa-right.tsx` mowi w naglowku WPROST, ze realny `<UnifiedChatPanel>` `ciagnie store/API/logowanie i nie zmontuje sie w harnessie, wiec TRESC jest mockowana`. Zrzut zamockowanej powloki NIE JEST dowodem renderu (ksztalt `wolacz istnieje != renderuje sie`). Minimum: zrzut pokazuje REALNY komponent krokow, zasilony danymi w ksztalcie realnego zdarzenia `tool_step`, a raport mowi WPROST, czy dane pochodza z realnego SSE, czy z propsow w harnessie. `CLAUDE.md` §7: wlasciciel NIGDY nie jest pierwszym testerem wizualnym — zrzut robisz Ty, przed nim`. Trasy tył: `Trasa jest JEDNA i nie dodajesz zadnej nowej: `POST /api/ai/chat/stream` (`server/src/routes/ai.routes.ts:1561`, `verifyToken` + `requireActiveChatMembership` + `validateBody(ChatStreamRequestSchema)`). Lancuch, w ktory wchodzisz: trasa buduje opcje `pipelineRequest` (wzorce wiazania narzedzi: `deliverableTools` `:4760-4796`, `ideaTools` `:4805-4855`, w tym `emitSSE({ type: 'idea_action', toolName, args })` `:4843`; `emitSSE` zdefiniowane `:2858`) → `AIPipeline.process` filtruje narzedzia przez `CHAT_CREATION_TOOLS` (`AIPipeline.ts:366-375`) i wola `llmService.callStream(..., maxIterations: 4)` (`:531`, `:571`) → `callStream` rejestruje narzedzia (`llmService.ts:1198-1265`, execute PRZYBITE do `mcpServer.execute` w `:1208`; druga rodzina o innym dyspozytorze: `clientTools` `:1271-1300` z regula pierwszenstwa `:1279`) i ustawia `stopWhen: stepCountIs(params.maxIterations ?? 4)` (`:1343`) → iterator strumienia JAWNIE wyrzuca czesci `tool-*` (`:1440`, komentarz `all other part types (tool-*, start/end, source) are ignored`). Rejestr READ, ktory masz wpuscic: `AI_TOOLS` (`server/src/services/ai/toolDefinitions.ts:30`) minus `SIDE_EFFECT_TOOLS` (`server/src/services/ai/sideEffectTools.ts:17-31`), dyspozytorowany przez `executeToolCall` (`toolDefinitions.ts:573`). Bramki na trasie kazdego wywolania: `executeWebSearch` (`:802`, `webSearchGovernance.getEffectiveWebSearchPolicy`) i `executeKBSearch` (`:876`, `evaluateRetrievalPolicyDecision({consumerClass:'agent'})` fail-closed TAKZE na blad bramki `:894-903`, plus allow-lista sejfu/folderu `:938-1010`). Stare sciezki READ, ktorych NIE KASUJESZ: bezwarunkowy prefetch wiedzy `buildHelpDocsContext` (`ai.routes.ts:3485`) i regex web (`:3707-3710`)`.

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
WT=/private/tmp/cx-day206-tool-loop
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
git -C "$VAULT" worktree add "$WT" -b codex/day206-tool-loop-20260831 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day206-tool-loop/config.worktree"
cat "$VAULT/worktrees/cx-day206-tool-loop/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day206-tool-loop-scratch
mkdir -p /private/tmp/cx-day206-tool-loop-artefakty

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
git -C "$WT" push github-backup codex/day206-tool-loop-20260831
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only c50847c259..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `trzynascie` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day206-tool-loop

# (T1) DWA REJESTRY NARZEDZI — policz OBA sam, nie przepisuj liczb z instrukcji
grep -c "      name: '" server/src/services/ai/toolDefinitions.ts
grep -n "      name: '" server/src/services/ai/toolDefinitions.ts
sed -n '17,31p' server/src/services/ai/sideEffectTools.ts
#   oczekiwane: pierwsza komenda daje liczbe narzedzi w AI_TOOLS (u autora: 19),
#   druga wypisuje ich nazwy z liniami, trzecia pokazuje SIDE_EFFECT_TOOLS
#   (u autora: 8 nazw). Roznica = zbior READ tego dyzuru. Wpisz swoje liczby
#   z mianownikiem do raportu (Z24). ★ Zwroc uwage, ze `query_structured_data`
#   JEST na liscie side-effect — to obala liste, z ktora dyzur byl zamawiany.

# (T2) ★ CZY MODEL W CZACIE WIDZI KTOREKOLWIEK Z TYCH 19 NARZEDZI
sed -n '360,380p' server/src/services/ai/AIPipeline.ts
#   oczekiwane: `const CHAT_CREATION_TOOLS = new Set([...])` z 'generate_deliverable',
#   'generate_initiative' (+ 'create_task'/'create_decision' za ENABLE_TERESA_RECORD_CREATE)
#   oraz filtr `mcp.getToolDefinitions().filter(d => CHAT_CREATION_TOOLS.has(d.name))`.
#   Wniosek do potwierdzenia: w czacie model widzi WYLACZNIE narzedzia tworzace,
#   ani jednego czytajacego — i wszystkie pochodza z rejestru MCP, nie z AI_TOOLS.

# (T3) ★★ CZY AI_TOOLS TRAFIAJA DO JAKIEGOKOLWIEK MODELU — GDZIEKOLWIEK
grep -rn "getAvailableTools" server/src src tests
grep -rn "executeToolCall" server/src src tests --include=*.ts | grep -v "__tests__" | grep -v "^tests/"
#   oczekiwane: `getAvailableTools` ma DEFINICJE i ZERO wolaczy (u autora: jedyne
#   trafienie to sama definicja w toolDefinitions.ts:1354). `executeToolCall` ma
#   4 realne wolacze: agentPlannerService.ts:1133, wave8AgentRuntimeService.ts:4,
#   playbookExecutor.ts:182 i :224. Jesli to sie potwierdzi: DYSPOZYTOR zyje,
#   DEFINICJE sa martwe — zaden model nigdy nie wybral narzedzia z AI_TOOLS.
#   To jest zdanie do raportu i podstawa istnienia tego dyzuru.

# (T4) ★ PETLA MODEL-DRIVEN JUZ ISTNIEJE — tylko dla narzedzi tworzacych
grep -n "maxIterations" server/src/services/ai/AIPipeline.ts server/src/services/ai/llmService.ts
sed -n '1336,1350p' server/src/services/ai/llmService.ts
#   oczekiwane: literal `maxIterations: 4` w AIPipeline.ts:571 (przy wywolaniu
#   callStream) i `stopWhen: stepCountIs(params.maxIterations ?? 4)` w
#   llmService.ts:1343. To JEST wielokrokowa petla sterowana modelem, dzialajaca
#   dzis. Nie ma dla niej zadnej zmiennej srodowiskowej — R1c ma ja dodac.

# (T5) ★★ DYSPOZYTOR JEST PRZYBITY DO MCP — to jest glowna trudnosc R1
sed -n '1198,1215p' server/src/services/ai/llmService.ts
sed -n '482,495p' server/src/services/ai/mcpServer.ts
#   oczekiwane: :1207-1208 `execute: async (args) => { const r = await
#   mcpServer.execute(def.name, args, params.context) }` — ZERO galezi na
#   executeToolCall; oraz mcpServer.execute dla nieznanej nazwy ZWRACA cicho
#   `{ status: 'ERROR', error: 'Unknown tool: ...' }`, NIE rzuca wyjatku.
#   Wniosek: samo podanie definicji z AI_TOOLS do params.tools da HTTP 200,
#   zero bledu w logu i zero realnych wywolan. To jest pulapka nr 1.

# (T6) WZORZEC DRUGIEJ RODZINY NARZEDZI (inny dyspozytor) — juz w kodzie
sed -n '1266,1302p' server/src/services/ai/llmService.ts
#   oczekiwane: blok `if (params.clientTools?.length && !wantsReasoning)` z
#   execute wolajacym `context.onClientToolCall(...)` zamiast MCP, oraz jawna
#   regula pierwszenstwa `if (streamToolDefinitions[def.name]) continue;` (:1279).
#   To jest gotowy wzorzec ksztaltu dla rodziny READ i gotowa odpowiedz na kolizje nazw.

# (T7) ★ KOLIZJA NAZW `search_knowledge_base` — DWIE IMPLEMENTACJE
grep -rn "search_knowledge_base" server/src/services/ai/toolDefinitions.ts server/src/services/ai/tools/index.ts
ls -la server/src/services/ai/tools/searchKnowledgeBase.ts
#   oczekiwane: definicja + case w executeToolCall (toolDefinitions.ts) ORAZ
#   `mcpServer.registerHandler('search_knowledge_base', searchKnowledgeBase)`
#   w tools/index.ts. Ta sama nazwa, dwie implementacje, dwa rejestry.
#   Rozstrzygniecie tej kolizji jest wymogiem R1b — nie wolno jej przemilczec.

# (T8) BRAMKI, KTORE MUSZA ZADZIALAC W PETLI — przeczytaj przed R2
sed -n '802,830p' server/src/services/ai/toolDefinitions.ts
sed -n '876,905p' server/src/services/ai/toolDefinitions.ts
#   oczekiwane: executeWebSearch czyta getEffectiveWebSearchPolicy i przy
#   internetEnabled=false zwraca odmowe; executeKBSearch NAJPIERW wola
#   evaluateRetrievalPolicyDecision({ consumerClass: 'agent', ... }) i jest
#   fail-closed TAKZE na blad bramki (catch → pusty wynik + 'Blocked by policy
#   gateway'). ★ Zwroc uwage na zaszyte 'agent' — R2a kaze Ci rozstrzygnac,
#   czy petla czatu to ten sam konsument co krok planu w tle.

# (T9) CENNIK — ktore narzedzia READ sa PLATNE i co sie dzieje z nieznanym
grep -n "search_web:\|search_knowledge_base:\|search_enterprise_connector:\|query_structured_data:\|UnknownToolCostError\|hasOwnProperty" server/src/services/ai/toolCostEstimates.ts
#   oczekiwane: platne sa search_web (0.02), search_enterprise_connector (0.05),
#   search_knowledge_base (0.01) — reszta ma jawne zero z uzasadnieniem; a
#   estimateAgentToolCostUsd RZUCA UnknownToolCostError dla nazwy spoza cennika.
#   Wniosek: kazde narzedzie w Twoim zbiorze READ musi miec cene. Sprawdz wszystkie
#   i wpisz wynik `X z X` do raportu.

# (T10) ★ CO DZIS ROBI READ W CZACIE — prefetch, nie regex
sed -n '3462,3492p' server/src/routes/ai.routes.ts
sed -n '3697,3712p' server/src/routes/ai.routes.ts
#   oczekiwane: (a) BEZWARUNKOWE `emitSSE({type:'thought', step:'knowledge'})` +
#   `await buildHelpDocsContext({...})` — wiedza wstrzykiwana przy KAZDEJ turze,
#   bez udzialu modelu; (b) `userEnabledWebSearch = aiModes?.webSearch === true`
#   oraz regex `explicitExternalWebRequest` (/sprawdz w internecie|wyszukaj|.../i).
#   To jest realny ksztalt "recznych regexow intencji" z karty §3 — i to prefetch,
#   nie regex, tworzy ryzyko podwojnego zrodla wiedzy w R3a.

# (T11) KANAL DLA `tool_step` — dzis zamkniety, i gdzie go otworzyc
sed -n '1380,1390p' server/src/services/ai/llmService.ts
sed -n '1436,1444p' server/src/services/ai/llmService.ts
grep -n "const emitSSE" server/src/routes/ai.routes.ts
grep -n "idea_action" server/src/routes/ai.routes.ts
grep -c "text/event-stream" server/src/routes/ai/agent-plan.routes.ts
#   oczekiwane: `useFullStream = wantsReasoning || !!streamToolDefinitions` (:1384);
#   komentarz "all other part types (tool-*, start/end, source) are ignored" (:1440)
#   — czesci narzedziowe sa DZIS jawnie wyrzucane; `const emitSSE` w ai.routes.ts:2858;
#   `emitSSE({ type: 'idea_action', toolName, args })` w ai.routes.ts:4843 jako wzorzec;
#   oraz `0` dla agent-plan.routes.ts — ★ agent-plan NIE MA SSE, wiec wzorzec bierzesz
#   z ai.routes.ts (research_progress / idea_action), nie z planow.

# (T12) FRONT — cztery warstwy, zeby krok byl WIDOCZNY, nie tylko wyemitowany
grep -n "research_progress" src/hooks/useAIStream.ts
sed -n '796,818p' src/components/AIChat/MessageRenderer.tsx
head -20 dev-render/screens/chat-split-teresa-right.tsx
#   oczekiwane: typ zdarzenia (:406) i obsluga (:1111) w useAIStream.ts; render
#   `metadata.researchProgress` komponentem ResearchProgress w MessageRenderer.tsx
#   (:798-815); ★ oraz naglowek harnessu, ktory mowi WPROST, ze realny
#   UnifiedChatPanel "nie zmontuje sie w harnessie, wiec TRESC jest mockowana".
#   To ostatnie przesadza, ze zrzut zamockowanej powloki NIE jest dowodem renderu.

# (T13) FLAGA — dwa miejsca, wzorzec 1:1 z ENABLE_TERESA_RETRIEVAL
grep -n "ENABLE_TERESA_RETRIEVAL" server/src/config/FeatureFlags.ts
grep -rn "ENABLE_TERESA_TOOL_LOOP" server/src src || echo "FLAGA NIE ISTNIEJE — zgodnie z oczekiwaniem"
#   oczekiwane: wpis w FeatureFlagsSchema (z.boolean().default(false)) i wpis w
#   bloku ladujacym (process.env.X === 'true'); oraz ZERO trafien dla nowej flagi.
#   ★ Pamietaj: w tym programie flaga bez implementacji jest zjawiskiem
#   udokumentowanym — Twoj test ma dowodzic ZERA WYWOLAN przy OFF, nie istnienia pola.
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day206-tool-loop-20260831` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6146`. Twój JEDYNY port harnessu to `5084 i 5085`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day206-pg`**. **ZAKAZANE:** `6012, 5433, 6047, 6054-6145, 5010-5083, 6404-6411 (zajete przez wczesniejsze dyzury i odbiory nadzorcy). ★★ W SZCZEGOLNOSCI ZAJETE SA 5080-5083 — NIE bierz ich, mimo ze sasiaduja z Twoim przydzialem. Twoj WYLACZNY przydzial to baza `6146` i harness `5084 i 5085` — nic wiecej. ★ PORT 5000 ZAJETY NA STALE przez macOS Control Center. ★ PORT 5037 ZAJETY przez `adb` (serwer Androida). ★ PORTY 5060-5061 ZAJETE. ★ Ta lista jest rozkazem pomiarowym, nie gwarancja — zweryfikuj `lsof -i` i `docker ps` przed startem i wpisz wynik `X z 3` do raportu`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `★★ TAK — TEN DYZUR MA FLAGE I JEST NIA W CALOSCI BRAMKOWANY: `ENABLE_TERESA_TOOL_LOOP`, DOMYSLNIE OFF, do akceptu wlasciciela na zrzutach (`CLAUDE.md` §7 i §9: zakaz masowego wlaczania, jeden ekran po drugim, akcept na CZYSTYM zrzucie). Dwa miejsca do dopisania w `server/src/config/FeatureFlags.ts`: wpis w `FeatureFlagsSchema` (`z.boolean().default(false)`) i wpis w bloku ladujacym (`process.env.ENABLE_TERESA_TOOL_LOOP === 'true'`) — wzorzec 1:1 z `ENABLE_TERESA_RETRIEVAL`. ★★ FLAGA MA BYC DOWIEDZIONA ZACHOWANIEM, NIE ISTNIENIEM POLA: w tym programie odnotowano flagi-fantomy (flaga w rejestrze, zero kodu za nia), wiec test przy OFF ma dowodzic ZERA WYWOLAN petli, a nie tego, ze pole istnieje. ★ Drugi parametr, oddzielny od flagi: LIMIT ITERACJI ze srodowiska, wartosc domyslna `4` — dzis jest to LITERAL `maxIterations: 4` (`AIPipeline.ts:571`) i domyslka `?? 4` (`llmService.ts:1343`); nazwa zmiennej i miejsce odczytu to Twoja decyzja, ale wartosc domyslna nie moze zmienic dzisiejszego zachowania sciezki tworzacej. ★ Trzeci parametr: TIMEOUT PER WYWOLANIE NARZEDZIA — musi sie zmiescic w budzecie calego strumienia (`AbortSignal.timeout(params.timeoutMs ?? 60_000)`, `llmService.ts:1319-1323`; `AIPipeline.ts:544` podaje `timeoutMs: 60_000`) albo jawnie ten budzet podnosisz z uzasadnieniem. Timeout narzedzia zwraca modelowi czytelny wynik, NIE wywraca tury`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**` (w szczegolnosci `verifyToken` i `requireActiveChatMembership` na `/chat/stream`), `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/services/ai/chatPolicyGateway.ts` (`evaluateChatPolicyDecision` `:469`, `evaluateRetrievalPolicyDecision` `:552`, klasy konsumenta `:106`), `server/src/services/ai/webSearchGovernance.ts`, `server/src/services/ai/sideEffectTools.ts` (lista aprobat dla planow), `server/src/services/ai/toolCostEstimates.ts` (cennik + `UnknownToolCostError`), `server/src/services/v8/agentResourceGovernanceService.ts` (`:413`), `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*`. ★★ ZADNEJ Z NICH NIE ZMIENIASZ — petla ma przez nie PRZECHODZIC, nie omijac ich i nie poszerzac`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY206_TOOL_LOOP_REPORT.md`. Nie zmieniasz zadnego `MODULE_ACCEPTANCE.md`. Uzasadnienie do potwierdzenia albo obalenia przez Ciebie w raporcie: `docs/program/waves/WAVE_03_ACCEPTANCE/modules/13_CHAT/MODULE_ACCEPTANCE.md` jest dzis rejestrem uwag wlasciciela do POWIERZCHNI WIZUALNEJ czatu (wiersze `CHAT-OWN-*`) i nie ma w nim ani jednego wiersza o petli narzedziowej — dopisanie go byloby tworzeniem nowego stanu w rejestrze, ktorego nikt nie zamowil, a status i tak pozostaje `NOT_PROVEN` do akceptu wlasciciela na zrzutach. ★ Jedyny inny dokument do zmiany: `docs/program/funkcje/ARCHITEKTURA_AGENTA_TERESY.md` — DOPISUJESZ nowy rozdzial `10. Wykonanie — 17-B (Day206)` na KONCU pliku (co zmierzone, co zbudowane, ktore twierdzenia karty §3 potwierdzone, a ktore skorygowane, co zostaje dla 17-C) i w wierszu `P1` tabeli §3 dopisujesz WYLACZNIE ODSYLACZ do tego rozdzialu. ★★ ZAKAZ zmiany tresci ogniw `P2`-`P5`, §4 (werdykt o dwoch swiatach agentowych), §6 (scenariusz GF-AGT-02), §8 (decyzje wlasciciela) i §9 — to jest dokument ZAAKCEPTOWANY przez wlasciciela, a nie Twoj brudnopis. Jesli Twoj pomiar obala ktores zdanie karty (a co najmniej trzy sa do obalenia — patrz `DLACZEGO`), zapisujesz to jako KOREKTE w rozdziale 10 i zglaszasz nadzorcy, a nie nadpisujesz zdania wlasciciela. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day206-tool-loop-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day206-tool-loop-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **ZERO NARZEDZI ZAPISUJACYCH W PETLI — bez wyjatku, takze za zgoda uzytkownika.** Osiem nazw z `SIDE_EFFECT_TOOLS` (`sideEffectTools.ts:17-31`) nie moze trafic do zbioru podawanego modelowi w czacie. WRITE-as-proposal to dyzur **17-C** i osobna decyzja wlasciciela. Jesli w trakcie uznasz, ze `to by bylo latwe do dolozenia` — to jest sygnal wyjscia poza zakres: wpis do raportu, nie zmiana kodu. ★★ **`agentPlannerService.ts` i `wave8AgentRuntimeService.ts` NIETYKALNE poza odczytem.** Cykl planow zostal utwardzony dyzurami 164-180 (okna anulowania, limity, cennik), a architektura §4 rozstrzygnela, ze OBA swiaty agentowe zostaja i spina je `canonicalRunId`. Ten dyzur ich nie scala, nie upraszcza i nie porzadkuje przy okazji. ★★ **REGEXY I PREFETCH READ W `ai.routes.ts` NIE SA KASOWANE** — ani `buildHelpDocsContext` (`:3465-3520`), ani `explicitExternalWebRequest` (`:3705-3712`), ani przelaczniki `aiModes`. Zmiana ich zachowania jest dozwolona WYLACZNIE pod flaga ON; przy OFF sciezka ma byc bajt w bajt dzisiejsza. ★★ **NIE ZMIENIASZ SEMANTYKI WSPOLNEGO REJESTRU MCP** (`mcpServer.ts`) ani zawartosci `SIDE_EFFECT_TOOLS` i cennika `toolCostEstimates.ts` — to sa bramki, przez ktore Twoja petla ma PRZECHODZIC. ★★ **`Z15` ZNIESIONE WYLACZNIE DLA POZYCJI R3b** — realne wywolanie modelu jest tam WYMOGIEM, nie naruszeniem (to jawne zniesienie, wpisane do czesci merytorycznej, bo sprzecznosc `Z15` vs dowod modelem zatrzymala juz raz dyzur 185; jego STOP byl ZASADNY, blad byl autorski po stronie nadzorcy). W R1 i R2 modelu NIE wolasz w ogole. Licencja na klucz: plik `~/.consultify-openrouter` (jedna linia `OPENROUTER_API_KEY=<wartosc>`), **jedyna dozwolona komenda zrodlowa: `set -a; . ~/.consultify-openrouter; set +a`** — nie ma innej dozwolonej drogi; nie kopiujesz tego pliku, nie przenosisz go do repozytorium, nie wpisujesz jego tresci do `.env`, `docker-compose*` ani do zadnej komendy. ★★ **`Z40` bez wyjatku: zakaz wypisania WARTOSCI klucza gdziekolwiek** — nie w raporcie, nie w logu, nie w komendzie, nie w komunikacie bledu, nie w `env`; pokazujesz wylacznie `obecny`/`nieobecny` (`env | sed 's/=.*//' | grep -x 'OPENROUTER_API_KEY'`). ★★ **ARYTMETYKA BUDZETU WYWOLAN — rozstrzygniecie nadzorcy, wiazace dla tego dyzuru.** `DEC-2026-08-29-317` mowi `dokladnie DWA realne wywolania modelu jako dowod, zakaz petli`, a ten dyzur ma w temacie petle — wiec sprzecznosc rozstrzygam JAWNIE: jednostka limitu jest **PRZEBIEG** (jedna tura czatu), nie runda modelu wewnatrz tury, bo `stopWhen: stepCountIs(4)` (`llmService.ts:1343`) z definicji oznacza do czterech rund na ture. **Budzet: DOKLADNIE DWA PRZEBIEGI SCENARIUSZA** — przebieg 1 z flaga ON (do 4 rund), przebieg 2 z flaga OFF jako mutacja (1 runda). **SUFIT: 5 RUND MODELU W CALYM DYZURZE.** Zakaz ponawiania: przebieg nieudany (brak dostawcy, model bez wsparcia narzedzi, timeout) = **STOP pozycji z opisem**, a nie trzeci przebieg; jesli musisz zmienic model, bo pierwszy nie wspiera function-calling, liczysz to jako przebieg dodatkowy i wpisujesz JAWNIE do raportu z uzasadnieniem. Do raportu wpisujesz ZMIERZONA liczbe rund z logu (`LLM call success` z realnym `tokens`/`durationMs`), nie deklarowana. ★★ **MODEL MUSI WSPIERAC FUNCTION-CALLING — to ryzyko, nie formalnosc.** OpenRouter jest podpiety jako dostawca OpenAI-kompatybilny (`llmService.ts:430-436`), wiec obsluga narzedzi zalezy od MODELU, do ktorego OpenRouter routuje. Model bez wsparcia odpowie tekstem, petla wykona zero krokow, a dowod bedzie falszywie negatywny. Wpisz do raportu, ktorego modelu uzyles (sama nazwe modelu — NIGDY klucza). ★★ **ZAKAZ WYMUSZANIA WYBORU NARZEDZIA W R3b.** Zakaz podawania nazw narzedzi w promptcie, zakaz per-turowej dyrektywy `MUSISZ wywolac X` (taki wzorzec ISTNIEJE w kodzie — `AIPipeline.ts:414-427`, intencja `table` — i jest w tym dyzurze ZAKAZANY), zakaz zawezania zbioru do trzech narzedzi, zeby model nie mial wyboru. Model dostaje pelen zbior READ i wybiera SAM; wybor inny niz zakladany to WYNIK do raportu, nie usterka do obejscia. ★★ **`Z31` — ZAKAZ PINOWANIA STRAZNIKA REALDB DO HOSTA, PORTU ALBO NAZWY BAZY.** Wolasz `await assertRealPostgresTestEnvironment()` BEZ ARGUMENTOW, w szczegolnosci bez `expectedDatabase`; zakaz asercji na `DATABASE_URL`, na porcie i na nazwie kontenera. Powod: dyzur 43 przypial straznika do swojej bazy i po usunieciu kontenera **30 przypadkow dowodowych stalo sie trwalym `SKIP`** przy `exit 0`; w programie odnotowano SZESC takich incydentow, a dyzur 193 zamowiono wylacznie po to, zeby je zbiorczo odpiac (`97187267a0 fix(day164): unpin Z31 DATABASE_URL assertion to any local Postgres`). Nie dokladaj siodmego. ★★ **`Z29` — DOWOD MUTACYJNY W OBIE STRONY** dla flagi (R1), izolacji sejfu (R2b), limitu kosztu (R2c) i mutacji OFF (R3). ★★ **ZAKAZ RETRY W TESTACH BEZPIECZENSTWA** — w tym programie zmierzono wektor systemowy, w ktorym test izolacji leczy sie skutkiem wlasnego ataku; kazde `izolacja X/X PASS` bez asercji na NIEOBECNOSC imiennie zaseedowanego dokumentu i bez dowodu mutacyjnego jest podejrzane z urzedu. ★★ **Sprzatanie kontenera: `docker rm -f -v`** — z flaga `-v`, inaczej wolumen zostaje na dysku. ★★ **`Z27` — zakaz `git stash`** w kazdej postaci; dowody mutacyjne przez `cp` do `/private/tmp/cx-day206-tool-loop-scratch` i powrot przez `cp` (schowek jest wspoldzielony miedzy worktree). ★★ **Zero polaczen do bazy zdalnej, demo, stagingu i produkcji** (`Z28`) — klucz dostawcy sluzy WYLACZNIE do wywolania modelu w R3b. ★★ **Zakaz naprawiania przez wyciszanie** (`@ts-ignore`, `.skip`, poszerzanie `exclude`, `--no-verify`) i zakaz usuwania zastanych testow — asercje wolno ZMIENIC z uzasadnieniem, nie skasowac. ★ **Zrzuty: pomiar `mean_luma` kazdego, para jasny/ciemny >150 roznicy** — bez wyjatku; duplikat obrazu zamiast drugiego motywu przechodzi `shasum`, bo plakietka zmienia SHA (policzony ksztalt falszywego gotowe, znana przyczyna: motyw ustawiany po hydratacji, naprawa przez `addInitScript`). ★ **`Z13`:** logi, dzienniki przebiegu, zrzuty i wyjscia bramek NIE wchodza do repo — leza w `/private/tmp/cx-day206-tool-loop-artefakty`, a raport podaje sciezki i `shasum -a 256`. ★ **`§0.4a` — pomiar zasiegu testow jest warunkiem oddania raportu** (`Z24`); zawezony wybor albo przepisanie cudzej liczby to zawyzenie i podstawa odrzucenia. ★ **NOWE pliki w `tests/` wymagaja `git add -f`.** | Wlasciciel zaakceptowal architekture modulu 17 (`docs/program/funkcje/ARCHITEKTURA_AGENTA_TERESY.md`, `status: canonical`, 31.08.2026), ktorej §3 wymienia piec przerwanych ogniw. Pierwsze, `P1`, brzmi: `Model nie ma petli narzedziowej w czacie — 19 narzedzi osiagalne tylko przez powierzchnie Wave-8; czat uzywa recznych regexow intencji`, a §7 dzieli je na `17-B tool-loop READ (P1a)` i `17-C tool-loop WRITE-as-proposal (P1b)`. Ten dyzur to 17-B. Podstawa jest tez zasada wlasciciela D-15: agent ma obejmowac prace ze WSZYSTKIMI narzedziami aplikacji. ★★ POMIAR WYKONANY PRZY PISANIU TEJ INSTRUKCJI NA SHA `c50847c259` ZMIENIA TRESC ZAMOWIENIA W TRZECH MIEJSCACH i wszystkie trzy masz OBALIC albo POTWIERDZIC: (a) PETLA MODEL-DRIVEN W CZACIE JUZ ISTNIEJE — `AIPipeline.ts:531` wola `llmService.callStream` z `maxIterations: 4` (`:571`), a `callStream` ustawia `stopWhen: stepCountIs(params.maxIterations ?? 4)` (`llmService.ts:1343`); zawezona jest tylko lista narzedzi, filtrem `CHAT_CREATION_TOOLS` (`AIPipeline.ts:366-375`) do `generate_deliverable`, `generate_initiative` i — za `ENABLE_TERESA_RECORD_CREATE` — `create_task`/`create_decision`. Model w czacie widzi zatem WYLACZNIE narzedzia TWORZACE i ani jednego CZYTAJACEGO; Twoje zadanie to wpuszczenie zbioru READ do ISTNIEJACEJ petli, nie budowa petli od zera, a nazwanie tego `budowa petli` bedzie zawyzeniem. (b) REJESTRY SA DWA I ROZLACZNE: `AI_TOOLS` (`toolDefinitions.ts:30`, dyspozytor `executeToolCall` `:573`, wolacze: `agentPlannerService.ts:1133`, `wave8AgentRuntimeService.ts:4`, `playbookExecutor.ts:182,224`) oraz rejestr MCP (`mcpServer.ts:415`, dyspozytor `:482`, wolany z `llmService.callStream:1208`). `callStream` NIE ZNA `executeToolCall`, a `mcpServer.execute` dla nieznanej nazwy zwraca CICHO `{status:'ERROR'}` zamiast rzucic (`mcpServer.ts:487-490`) — wiec naiwne podanie definicji `AI_TOOLS` do `params.tools` da HTTP 200, zero bledu w logu i zero realnych wywolan. (c) ★★ NAJWAZNIEJSZE: definicje `AI_TOOLS` NIE SA DZIS POKAZYWANE ZADNEMU MODELOWI, NIGDZIE — czyta je wylacznie `getAvailableTools` (`toolDefinitions.ts:1354`), ktore nie ma ANI JEDNEGO wolacza w `server/src`, `src` i `tests`; kroki planow agenta powstaja z deterministycznej, kurowanej tabeli, co `planBuilderService.ts` mowi w naglowku wprost (`Dlaczego deterministyczne mapowanie, nie LLM ... Kuszacy LLM-planner jest odlozony`). Jesli to potwierdzisz, zyje DYSPOZYTOR, a DEFINICJE sa martwe — dokladny wzorzec `biblioteka bez wywolania` z metodyki programu — a dyzur 206 jest PIERWSZYM momentem w historii tego produktu, w ktorym model sam wybiera narzedzie czytajace. ★ Czwarta korekta, mniejsza, ale zmieniajaca ksztalt R3: `reczne regexy intencji` to za waskie slowo. Wiedza jest dzis pobierana BEZWARUNKOWO przy kazdej turze (`buildHelpDocsContext`, `ai.routes.ts:3485`), web jest za przelacznikiem UI plus jednym regexem (`:3707-3710`), a pozostale narzedzia czytajace sa z czatu nieosiagalne w ogole. Ryzykiem przy fladze ON nie jest wiec `dwa regexy zamiast jednego`, tylko PODWOJNE ZRODLO WIEDZY: prefetch wstrzykuje snippety do promptu, a model w tej samej turze siega po to samo narzedziem |

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
cd /private/tmp/cx-day206-tool-loop

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day206-pg psql -U postgres -d cx206 \
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
cd /private/tmp/cx-day206-tool-loop

docker run -d --name cx-day206-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx206 \
  -p 127.0.0.1:6146:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day206-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6146/cx206 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6146/cx206 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day206-tool-loop && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6146/cx206 \
JWT_SECRET=cx206-test-secret-do-not-reuse \
npx vitest run server/src/services/ai/__tests__ oraz tests/unit/backend oraz tests/integration --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day206-tool-loop-artefakty/day206-teresa-tool-loop-read.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day206-tool-loop && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/services/ai/__tests__ oraz tests/unit/backend oraz tests/integration --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day206-tool-loop-artefakty/day206-teresa-tool-loop-read.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day206-tool-loop/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day206-pg psql -U postgres -d cx206 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day206-pg`.
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
> **(e) ★★ **Pierwsza, najgrozniejsza: CICHY `Unknown tool` udajacy dzialajaca petle.** `llmService.callStream` wiaze KAZDE przekazane narzedzie z `mcpServer.execute` (`llmService.ts:1207-1208`) i nie zna `executeToolCall`. `mcpServer.execute` dla nazwy spoza swojego rejestru NIE RZUCA — zwraca `{ status: 'ERROR', error: 'Unknown tool: X' }` (`mcpServer.ts:487-490`). Model dostanie ten string jako wynik narzedzia, napisze na jego podstawie zdanie i tura skonczy sie **HTTP 200, bez bledu w logu, ze `zrealizowanym` krokiem w SSE**. Zobaczysz `petla dziala` i nie zadziala nic. Dowodem wykonania jest **wynik narzedzia uzyty w odpowiedzi** (realna liczba z bazy), nie obecnosc kroku w logu i nie `HTTP 200`. ★★ **Druga: dwie implementacje `search_knowledge_base` pod jedna nazwa.** Jedna w `toolDefinitions.ts:876` (`executeKBSearch`, z allow-lista sejfu i folderu `:938-1010`), druga w `server/src/services/ai/tools/searchKnowledgeBase.ts` zarejestrowana w MCP (`tools/index.ts:21`). W `callStream` obowiazuje regula pierwszenstwa `if (streamToolDefinitions[def.name]) continue;` (`:1279`, `mcp ma pierwszenstwo`). Jesli zostawisz ja bez zastanowienia, petla READ dostanie implementacje MCP — inna niz ta, ktorej test izolacji piszesz w R2b — i **udowodnisz izolacje w kodzie, ktory nie biegnie**. Rozstrzygnij kolizje JAWNIE i zapisz jednym zdaniem, ktore da sie zacytowac. ★★ **Trzecia: kanal dla krokow trzeba OTWORZYC, i lezy on w goracej sciezce KAZDEJ tury.** Iterator strumienia jawnie wyrzuca czesci `tool-*` (`llmService.ts:1440`), a `useFullStream = wantsReasoning || !!streamToolDefinitions` (`:1384`) decyduje, ktora sciezka w ogole biegnie. Zmiana tego bloku dotyka rowniez zwyklego czatu bez narzedzi — sciezka BEZ narzedzi ma pozostac bajt w bajt nietknieta i to jest osobna asercja, nie zalozenie. ★★ **Czwarta: `wolacz istnieje != renderuje sie` — cztery warstwy, nie trzy.** Emisja SSE nie jest renderem. Lancuch to: kanal w `llmService` → `emitSSE` w `ai.routes.ts` (`:2858`, wzorzec `idea_action` `:4843`) → demux w `useAIStream.ts` (typ `:406`, obsluga `:1111`) → render w `MessageRenderer.tsx` (`:798-815`, komponentem wzorem `ResearchProgress.tsx`). Pominiecie ostatniej warstwy daje dokladnie ten udokumentowany ksztalt falszywego gotowe: `grep` znajduje wolacza, a uzytkownik nie widzi nic. ★★ **Piata: harness NIE zmontuje realnego czatu — a zrzut zamockowanej powloki nie jest dowodem.** `dev-render/screens/chat-split-teresa-right.tsx` mowi w naglowku wprost: realny `<UnifiedChatPanel>` `ciagnie store/API/logowanie i nie zmontuje sie w harnessie, wiec TRESC jest mockowana`. Zaplanuj to PRZED pisaniem kodu: albo renderujesz REALNY komponent krokow w harnessie z propsami w ksztalcie realnego zdarzenia, albo robisz zrzut z zywego runtime'u. W raporcie piszesz WPROST, ktora droga poszedles — zatarcie tej roznicy jest podstawa odrzucenia pozycji. ★★ **Szosta: `query_structured_data` NIE jest narzedziem READ, mimo ze brzmi jak zapytanie.** Jest w `SIDE_EFFECT_TOOLS` (`sideEffectTools.ts:22`) i ma cene `0.01` z komentarzem, ze text-to-SQL wola model. Lista, z ktora ten dyzur byl zamawiany, wymieniala je jako READ — **to jest blad zamowienia i masz go skorygowac pomiarem**, nie powielic. Ta sama ostroznosc dotyczy calej reszty listy: zbior READ liczysz jako roznice zbiorow, nie przepisujesz go. ★★ **Siodma: prefetch wiedzy dubluje sie z narzedziem, i to jest cichy defekt jakosci, nie awaria.** `buildHelpDocsContext` (`ai.routes.ts:3485`) biegnie BEZWARUNKOWO przy kazdej turze i wstrzykuje snippety do promptu. Przy fladze ON model dostanie te sama wiedze drugi raz przez `search_knowledge_base` — nic sie nie wywroci, cytowania sie zdubluja, a odpowiedz moze zawierac dwa lekko rozne warianty tej samej tresci. `Jedno zrodlo odpowiedzi` ma byc ASERCJA w tescie, nie zdaniem w raporcie. ★★ **Osma: `consumerClass` jest zaszyty i milczaco przenosi polityke z tla do czatu.** `executeKBSearch` wola bramke z `consumerClass: 'agent'` (`toolDefinitions.ts:879`), a `chatPolicyGateway.ts:106` zna takze `'chat'` i `'teresa'`. Krok planu wykonywany w tle w nocy i tura czatu z zalogowanym czlowiekiem to niekoniecznie ten sam konsument. Zmierz, czy polityka te klasy rozroznia; jesli tak — wybor klasy jest ZMIANA KONTRAKTU BEZPIECZENSTWA i ma byc nazwany, a nie odziedziczony przez przypadek. ★★ **Dziewiata: `estimateAgentToolCostUsd` RZUCA dla nieznanej nazwy.** `toolCostEstimates.ts` celowo nie ma cichego `?? 0` — nazwa spoza cennika konczy sie `UnknownToolCostError`. Jesli podepniesz licznik kosztu do zbioru READ, a ktorekolwiek narzedzie nie ma tam wpisu, dostaniesz wyjatek w srodku tury czatu. Sprawdz WSZYSTKIE i wpisz `X z X` do raportu. ★★ **Dziesiata: `AI_TOOLS` moze byc martwe jako definicje, ale `executeToolCall` jest zywy i wspoldzielony.** Wolaja go planer, silnik V8 i playbook (`agentPlannerService.ts:1133`, `wave8AgentRuntimeService.ts:4`, `playbookExecutor.ts:182,224`). Kazda zmiana W SRODKU `executeToolCall` albo w executorach uderza w te trzy powierzchnie naraz — dlatego licencja pozwala Ci budowac WOKOL niego (zbior, licznik, adapter), a nie w nim. Jesli dojdziesz do wniosku, ze naprawy nie da sie zrobic bez zmiany executora, to jest STOP MERYTORYCZNY pozycji i wpis do raportu, nie zmiana pliku.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day206-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day206-tool-loop-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 — petla narzedziowa READ w strumieniu czatu za flaga `ENABLE_TERESA_TOOL_LOOP` (default OFF): (a) TABELA OBOWIAZKOWA wszystkich narzedzi z `AI_TOOLS` z klasyfikacja READ/WRITE, cena i dyspozytorem — zbior READ ustalasz POMIAREM jako roznice `AI_TOOLS` minus `SIDE_EFFECT_TOOLS`, nie przepisujesz listy z zamowienia (★ `query_structured_data` jest side-effect i najprawdopodobniej WYPADA); (b) dyspozytor — rozstrzygasz Ty z pomiarem, bo `callStream` ma execute PRZYBITE do `mcpServer.execute` (`llmService.ts:1208`), a wzorzec drugiej rodziny o wlasnym dyspozytorze juz istnieje (`clientTools` `:1271-1300`); jawne rozstrzygniecie KOLIZJI NAZW `search_knowledge_base` (dwie implementacje, dwa rejestry); (c) flaga + limit iteracji ze srodowiska (default 4) + timeout per wywolanie; (d) SSE `tool_step` przez CZTERY warstwy (kanal w `llmService` — czesci `tool-*` sa dzis jawnie wyrzucane `:1440`; emisja w `ai.routes.ts` wzorem `idea_action` `:4843`; demux w `useAIStream.ts`; render wzorem `ResearchProgress`), bez surowych wynikow narzedzi w SSE. R2 — zgodnosc bezpieczenstwa: kazde wywolanie przez ISTNIEJACE bramki (web policy, retrieval fail-closed, izolacja sejfu), rozstrzygniecie `consumerClass` dla petli czatu (dzis zaszyte `'agent'` — zmiana klasy to zmiana kontraktu bezpieczenstwa), TEST IZOLACJI: dokument niedozwolony NIE wraca przez `search_knowledge_base` w petli, z dowodem mutacyjnym i BEZ retry (`Z29`); licznik wywolan platnych w rozmowie egzekwowany KODEM + log (platne sa trzy: `search_web` 0.02, `search_enterprise_connector` 0.05, `search_knowledge_base` 0.01), z rozstrzygnieciem czy reuzywasz `executeWithAgentResourceReservation` czy budujesz lzejszy licznik. R3 — (a) brak dublowania: stare sciezki READ zostaja przy OFF i NIE sa kasowane; przy ON udowodnij testem JEDNO ZRODLO odpowiedzi (realne ryzyko to nie regex, tylko BEZWARUNKOWY prefetch wiedzy `ai.routes.ts:3485`, ktory wstrzykuje te sama wiedze druga droga); (b) ★ DOWOD SCENARIUSZEM Z REALNYM MODELEM (`Z15` zniesione dla tej pozycji, licencja na klucz wzorem dnia 190, budzet: DWA PRZEBIEGI, sufit 5 rund modelu): `Policz ROI inicjatywy X i porownaj z benchmarkiem` → model SAM wybiera `get_initiative_status` → `calculate_financial` → `compare_benchmarks`, log krokow, odpowiedz z REALNYCH danych z bazy, zrzut UI z widocznymi krokami ×2 motywy z pomiarem `mean_luma` (para >150); mutacja: flaga OFF → ZERO wywolan petli`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6146` albo `5084 i 5085` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6146` albo `5084 i 5085`** (`Z7`).

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

Właściciel zaakceptował architekturę modułu 17 (`docs/program/funkcje/ARCHITEKTURA_AGENTA_TERESY.md`,
`status: canonical`, 31.08.2026). Jej §3 wymienia PIĘĆ przerwanych ogniw. Pierwsze, `P1`, brzmi:

> | P1 | **Model nie ma pętli narzędziowej w czacie** — 19 narzędzi osiągalne tylko przez
> powierzchnię Wave-8; czat używa ręcznych regexów intencji | zerwane | tool-loop w
> /chat/stream: READ bez zgody, WRITE wyłącznie jako governed proposal (wzorzec już istnieje) |

§7 dzieli `P1` na dwa dyżury: **17-B tool-loop READ (P1a)** i 17-C tool-loop WRITE-as-proposal
(P1b) + zgaszenie widm (P5). **Ten dyżur to 17-B. WYŁĄCZNIE READ.** Zapis w pętli — nawet za
zgodą, nawet „przy okazji” — należy do 17-C i jest tu zakazany.

Podstawą jest też zasada `D-15` z tej samej sesji właściciela: **agent ma obejmować pracę ze
wszystkimi narzędziami aplikacji.** Dziś nie obejmuje żadnego, o czym niżej.

## ★★ Pomiar, który zmienia treść zamówienia — wykonany na SHA `c50847c259`

Zdanie z karty §3 („czat używa ręcznych regexów intencji”) jest w PRZYBLIŻENIU prawdziwe, ale
w trzech miejscach jest nieprecyzyjne, a jedna z tych nieprecyzyjności zmienia to, co masz
zbudować. **Wszystko poniżej zweryfikuj sam — to rozkaz pomiarowy, nie prawda objawiona.**

**(a) Pętla model-driven w `/chat/stream` ISTNIEJE — tylko nie dla READ-ów.**
`AIPipeline.ts:531` woła `llmService.callStream(...)`, a przy obecności narzędzi dokłada
`maxIterations: 4` (`AIPipeline.ts:571`). `llmService.callStream` rejestruje je
(`llmService.ts:1198-1265`) i ustawia `stopWhen: stepCountIs(params.maxIterations ?? 4)`
(`llmService.ts:1343`). To JEST wielokrokowa pętla narzędziowa sterowana modelem, działająca
dziś na produkcji. Zestaw narzędzi jest jednak zawężony w `AIPipeline.ts:366-375` do:

```ts
// AIPipeline.ts:366
const CHAT_CREATION_TOOLS = new Set([
  'generate_deliverable',
  'generate_initiative',
  ...(featureFlags.ENABLE_TERESA_RECORD_CREATE ? ['create_task', 'create_decision'] : []),
]);
let defs = mcp.getToolDefinitions().filter((d) => CHAT_CREATION_TOOLS.has(d.name));
```

Czyli: **w czacie model widzi wyłącznie narzędzia TWORZĄCE (2-4 sztuki), a ani jednego
narzędzia CZYTAJĄCEGO.** Twoim zadaniem NIE jest zbudowanie pętli od zera — jest nim
wpuszczenie do istniejącej pętli zestawu READ i pokazanie jego kroków użytkownikowi.
Nazwanie tego „budową pętli” w raporcie będzie zawyżeniem.

**(b) Rejestry narzędzi są DWA i są rozłączne — to jest sedno trudności technicznej.**

| | `AI_TOOLS` (`toolDefinitions.ts:30`) | rejestr MCP (`mcpServer.ts`) |
|---|---|---|
| liczba narzędzi | 19 (policz sam) | 13 (policz sam) |
| dyspozytor | `executeToolCall` (`toolDefinitions.ts:573`) | `mcpServer.execute` (`mcpServer.ts:482`) |
| kto woła | `agentPlannerService.ts:1133`, `wave8AgentRuntimeService.ts:4`, `playbookExecutor.ts:182,224` | `llmService.callStream:1208`, `callWithTools:945`, `callWithToolsStream:1050` |
| widoczne dla modelu w czacie | **NIE** | TAK, po filtrze `CHAT_CREATION_TOOLS` |

`llmService.callStream` **na sztywno** wiąże każde przekazane narzędzie z dyspozytorem MCP:

```ts
// llmService.ts:1207-1208 — wewnątrz pętli po params.tools
execute: async (args: unknown) => {
  const r = await mcpServer.execute(def.name, args, params.context as any);
```

Nie ma tam żadnej gałęzi na `executeToolCall`. To znaczy, że **samo podanie definicji z
`AI_TOOLS` do `params.tools` NIE zadziała** — i, co gorsza, **nie wysypie się**:
`mcpServer.execute` dla nieznanej nazwy zwraca cicho `{ status: 'ERROR', error: 'Unknown
tool: X' }` (`mcpServer.ts:487-490`), a nie wyjątek. Model dostanie tę linijkę jako wynik
narzędzia, napisze na jej podstawie zdanie i tura się zakończy **HTTP 200, bez błędu w logu**.
Zobaczysz „pętla działa”, a nie zadziała nic. To jest najprostszy sposób, żeby ten dyżur
zakończył się fałszywym zielonym — patrz pułapka pierwsza.

**(c) ★★ Definicje `AI_TOOLS` nie są dziś pokazywane ŻADNEMU modelowi. Nigdzie.**
`AI_TOOLS` czyta wyłącznie `getAvailableTools` (`toolDefinitions.ts:1354`), a
`getAvailableTools` **nie ma ani jednego wołacza** w `server/src`, `src` i `tests` (zmierz to
sam: `git grep -n getAvailableTools`). Kroki planów agenta nie powstają z wyboru modelu, tylko
z deterministycznej, kurowanej tabeli — `planBuilderService.ts` mówi to w nagłówku wprost
(„Dlaczego deterministyczne mapowanie, nie LLM… Kuszący LLM-planner jest odłożony”).
`wave8AgentRuntimeService` i `playbookExecutor` też dyspozytorują po NAZWIE kroku, nie po
wyborze modelu.

**Wniosek, który masz potwierdzić albo obalić: żaden model w tym produkcie nigdy nie wybrał
narzędzia z `AI_TOOLS`. Żyje dyspozytor, definicje są martwe.** To dokładnie wzorzec
„biblioteka bez wywołania” z metodyki programu — zielone testy, realny kod, zero konsumentów.
Jeżeli to potwierdzisz, dyżur 206 jest **pierwszym w historii tego produktu momentem, w
którym model sam wybiera narzędzie czytające** — i to zdanie ma trafić do raportu.

**(d) Co dziś naprawdę robi READ w czacie — i dlaczego „regexy” to za wąskie słowo.**
Zmierzone w `/chat/stream` (`ai.routes.ts:1561`):
- **Wiedza (KB): BEZWARUNKOWY prefetch.** `buildHelpDocsContext(...)` woła się przy KAŻDEJ
  turze (`ai.routes.ts:3485`), poprzedzony `emitSSE({ type:'thought', step:'knowledge' })`
  (`:3465-3470`). To nie jest regex ani decyzja modelu — to stałe wstrzyknięcie snippetów.
- **Web: przełącznik UI + regex.** `ai.routes.ts:3705-3710`:
  `const userEnabledWebSearch = aiModes?.webSearch === true;` oraz
  `const explicitExternalWebRequest = /\b(sprawdź w internecie|wyszukaj|znajdź w sieci|web research|search the web|look up|google)\b/i.test(...)`.
- Reszta READ-ów z listy 19 (`get_assessment_data`, `calculate_financial`, `run_monte_carlo`,
  `get_initiative_status`, `compare_benchmarks`, `find_similar_decisions`,
  `get_stakeholder_analysis`, konektory) — **nieosiągalna z czatu w ogóle**, ani regexem, ani
  modelem.

To zmienia kształt `R3`: ryzykiem nie jest „dwa regexy zamiast jednego”, tylko **podwójne
źródło wiedzy** — prefetch KB wstrzykuje snippety do promptu, a model w tej samej turze woła
`search_knowledge_base` i dostaje to samo (albo, gorzej, coś innego) drugi raz. Test „jedno
źródło odpowiedzi” ma mierzyć TO, nie liczbę regexów.

# 2. TEZY ZLECENIA

Każda z nich to **rozkaz pomiarowy**. Obalenie którejkolwiek jest sukcesem dyżuru i wchodzi do
„Korekt wobec instrukcji”. Numery linii są z SHA `c50847c259` — jeśli u Ciebie są inne,
wiążący jest plik (`Z24`), a rozbieżność wpisujesz do raportu.

- **T1.** `AI_TOOLS` (`toolDefinitions.ts:30`) ma **19** narzędzi; `SIDE_EFFECT_TOOLS`
  (`sideEffectTools.ts:17-31`) ma **8**. Różnica — zbiór READ tego dyżuru — ma **11**
  elementów: `search_web`, `search_knowledge_base`, `list_enterprise_connectors`,
  `search_enterprise_connector`, `get_assessment_data`, `calculate_financial`,
  `run_monte_carlo`, `get_initiative_status`, `compare_benchmarks`, `find_similar_decisions`,
  `get_stakeholder_analysis`. **Policz obie listy sam, nie przepisuj liczb.**
- **T2.** ★ **`query_structured_data` NIE jest narzędziem READ w tym repozytorium**, wbrew
  pierwszej intuicji (i wbrew liście, z którą ten dyżur został zamówiony). Jest w
  `SIDE_EFFECT_TOOLS` (`sideEffectTools.ts:22`) i ma cenę `0.01 USD`
  (`toolCostEstimates.ts`, komentarz: text-to-SQL woła model). Jeżeli to potwierdzisz —
  **wypada ze zbioru 206** i przechodzi do 17-C; jeżeli obalisz, uzasadnij linią kodu, nie
  opinią.
- **T3.** `llmService.callStream` wiąże KAŻDE narzędzie z `mcpServer.execute`
  (`llmService.ts:1208`) i nie zna `executeToolCall`. Dla nazwy spoza rejestru MCP
  `mcpServer.execute` zwraca cicho `{ status:'ERROR' }` (`mcpServer.ts:487-490`), nie rzuca.
- **T4.** W `callStream` istnieje już DRUGA rodzina narzędzi o innym dyspozytorze —
  `params.clientTools` (`llmService.ts:1271-1300`), której `execute` nie woła MCP, tylko
  zgłasza `context.onClientToolCall(...)`. Jest tam też jawna reguła pierwszeństwa:
  `if (streamToolDefinitions[def.name]) continue;` (`:1279`) — „nie nadpisuj narzędzia mcp o
  tej samej nazwie”. **To jest gotowy wzorzec kształtu dla rodziny READ i gotowa odpowiedź na
  kolizję nazw.**
- **T5.** ★ `search_knowledge_base` **istnieje w OBU rejestrach**, pod tą samą nazwą i z
  różnymi implementacjami: `toolDefinitions.ts:876` (`executeKBSearch`) oraz
  `server/src/services/ai/tools/searchKnowledgeBase.ts` (zarejestrowane w
  `tools/index.ts:21`). Obie są fail-closed wobec bramki polityk. Kolizji nie da się
  przemilczeć — trzeba ją rozstrzygnąć jawnie.
- **T6.** Iterator strumienia w `callStream` **jawnie ignoruje części `tool-*`**:
  `llmService.ts:1440` — „all other part types (tool-*, start/end, source) are ignored”.
  Dziś nie ma więc z czego zbudować zdarzenia `tool_step`; kanał trzeba otworzyć, a leży on w
  gorącej ścieżce KAŻDEJ tury czatu (także bez narzędzi).
- **T7.** `agent-plan.routes.ts` **nie ma SSE w ogóle** (`git grep -c 'text/event-stream'`
  daje `0`; w całym `server/src/routes` SSE mają tylko `ai.routes.ts`,
  `document-studio.routes.ts`, `my-work/notebook.routes.ts`). Zamówienie mówiło „jest wzorzec
  w agent-plan SSE?” — jeżeli T7 się potwierdzi, **odpowiedź brzmi NIE**, a realne wzorce to
  `research_progress` i `idea_action` w samym `ai.routes.ts`.
- **T8.** Limit iteracji jest dziś **literałem** `maxIterations: 4` w `AIPipeline.ts:571`
  (domyślka `?? 4` w `llmService.ts:1343`, a `callWithTools`/`callWithToolsStream` mają
  domyślkę `3` — `llmService.ts:924,1012`). Nigdzie nie ma zmiennej środowiskowej.
- **T9.** `estimateAgentToolCostUsd` (`toolCostEstimates.ts`) **rzuca**
  `UnknownToolCostError` dla nazwy spoza cennika — nie zwraca `0`. Płatne w zbiorze READ są
  dokładnie trzy: `search_web` `0.02`, `search_enterprise_connector` `0.05`,
  `search_knowledge_base` `0.01`; pozostałe osiem ma jawne zero z uzasadnieniem.

# 3. POZYCJE DYŻURU

## R1 — pętla narzędziowa READ w strumieniu czatu, za flagą `ENABLE_TERESA_TOOL_LOOP`

**Cel, dosłownie:** przy fladze ON model prowadzący `/chat/stream` dostaje definicje narzędzi
CZYTAJĄCYCH i może je wołać iteracyjnie; wyniki wracają do kontekstu tej samej tury; kroki są
widoczne dla użytkownika. Przy fladze OFF — **bajt w bajt dzisiejsze zachowanie**.

### R1a — zbiór READ, ustalony pomiarem (TABELA OBOWIĄZKOWA)

Bez tej tabeli pozycja jest nieukończona. **Wszystkie narzędzia z `AI_TOOLS`, każde w osobnym
wierszu, bez skrótów i bez „…”:**

| # | Narzędzie | W `SIDE_EFFECT_TOOLS`? | Cena z `toolCostEstimates` | Dyspozytor(y) | Decyzja 206 |
|---|---|---|---|---|---|
| 1 | `search_web` | … | … | … | READ / poza zbiorem |
| 2 | `search_knowledge_base` | … | … | ★ dwa rejestry | … |
| … | … (wszystkie, ile ich policzysz) | … | … | … | … |

Tabela ma mieć tyle wierszy, ile elementów ma `AI_TOOLS` — **policz je sam** (`Z24`).
Rozstrzygnij w niej jawnie `T2` (`query_structured_data`) i podaj, ile narzędzi ostatecznie
wchodzi do zbioru READ **z mianownikiem** (np. `11 z 19`).

### R1b — dyspozytor: rozstrzygasz Ty, z pomiarem

Instrukcja **nie narzuca** rozwiązania. Trzy kandydatury; wybierz jedną albo zaproponuj
czwartą, ale uzasadnij liczbą (liczba dotkniętych linii w gorącej ścieżce, liczba plików,
liczba zastanych testów, które zmieniają sens), nie opinią:

1. **Nowa rodzina `readTools` w `callStream`**, wzorem `clientTools` (`llmService.ts:1271-1300`),
   z `execute` wołającym `executeToolCall(name, args, ctx)`. Najbliżej istniejącego wzorca;
   dodaje trzecią rodzinę narzędzi do jednej funkcji.
2. **Adapter po stronie wołającego** — `AIPipeline` przekazuje definicje READ, a `callStream`
   dostaje jawną mapę `name → executor`, zamiast twardego `mcpServer.execute`. Zmiana mniejsza
   liczbowo, ale dotyka linii `1208`, przez którą przechodzi dziś każde narzędzie tworzące.
3. **Rejestracja READ-ów w MCP** (handlery delegujące do `executeToolCall`). Zero zmian w
   `llmService`, ale **zmienia semantykę wspólnego rejestru** i uderza w `T5` (dwie
   implementacje `search_knowledge_base` pod jedną nazwą).

**Kolizję nazw (`T5`) rozstrzygasz jawnie i zapisujesz jednym zdaniem, które da się zacytować:**
która implementacja `search_knowledge_base` obsługuje pętlę READ w czacie, dlaczego, i co się
dzieje z drugą. Reguła `llmService.ts:1279` („mcp ma pierwszeństwo”) jest tu WEJŚCIEM do
decyzji, nie decyzją — jeśli ją zostawisz bez zmian, pętla READ dostanie implementację MCP,
a nie tę z `toolDefinitions.ts`, i **to musi być świadome, nie przypadkowe**.

### R1c — flaga i limity

- **Flaga `ENABLE_TERESA_TOOL_LOOP`, domyślnie OFF.** Dwa miejsca w
  `server/src/config/FeatureFlags.ts`: wpis w `FeatureFlagsSchema` (`z.boolean().default(false)`)
  i wpis w bloku ładującym (`process.env.ENABLE_TERESA_TOOL_LOOP === 'true'`). Wzorzec 1:1 z
  `ENABLE_TERESA_RETRIEVAL`. ★ **Flaga bez implementacji jest w tym programie zjawiskiem
  udokumentowanym** (`ENABLE_TERESA_NOTE_CREATE` był latami cytowany jako fantom) — dołóż
  test, który przy OFF dowodzi **zera wywołań**, nie samego istnienia pola.
- **Limit iteracji ze środowiska, domyślnie 4.** Dziś to literał (`T8`). Nazwa zmiennej i
  miejsce odczytu — Twoja decyzja; wymóg: wartość domyślna `4` (bez zmiany dzisiejszego
  zachowania ścieżki tworzącej), walidacja zakresu, i **twarde odcięcie**: przekroczenie
  limitu kończy turę odpowiedzią tekstową, nigdy cichym urwaniem strumienia.
- **Timeout per wywołanie narzędzia.** Rozstrzygnij i uzasadnij wartość. ★ Kontekst
  pomiarowy: cały strumień ma dziś `AbortSignal.timeout(params.timeoutMs ?? 60_000)`
  (`llmService.ts:1319-1323`), a `AIPipeline` podaje `timeoutMs: 60_000`
  (`AIPipeline.ts:544`). Cztery iteracje po jednym narzędziu każda muszą się **zmieścić w tym
  budżecie** — albo jawnie napisz, że go podnosisz i dlaczego. Timeout narzędzia ma zwracać
  modelowi czytelny wynik („narzędzie nie odpowiedziało”), nie wywracać tury.

### R1d — `tool_step`: kroki widoczne dla użytkownika

Łańcuch jest czterowarstwowy i **każda warstwa musi być zrobiona, inaczej „wołacz istnieje,
a nic się nie renderuje”** (udokumentowany kształt fałszywego gotowe w tym programie):

1. **Kanał w `llmService`** — części `tool-*` są dziś jawnie wyrzucane (`T6`,
   `llmService.ts:1440`). Otwórz je tak, żeby ścieżka BEZ narzędzi pozostała bajt w bajt
   nietknięta (dziś `useFullStream = wantsReasoning || !!streamToolDefinitions`,
   `llmService.ts:1384`).
2. **Emisja SSE w trasie** — `emitSSE` jest zdefiniowane w `ai.routes.ts:2858`; wzorzec
   zdarzenia sterowanego wywołaniem narzędzia to `emitSSE({ type: 'idea_action', toolName,
   args })` (`ai.routes.ts:4843`), a wzorzec zdarzenia „postęp z krokami” to
   `research_progress`. **Nigdy nie wpuszczaj do `tool_step` surowego wyniku narzędzia** —
   nazwa narzędzia, status, ewentualnie liczba wyników; treść dokumentów z KB w SSE to
   przeciek obok bramki polityk.
3. **Demux na froncie** — `src/hooks/useAIStream.ts` (typ zdarzenia wzorem
   `ResearchProgressEvent` `:406`, obsługa wzorem `:1111`).
4. **Render** — `src/components/AIChat/MessageRenderer.tsx:798-815` renderuje
   `metadata.researchProgress` komponentem `src/components/AIChat/ResearchProgress.tsx`.
   To jest wzorzec kształtu dla listy kroków narzędziowych.

**Ukończone, gdy:** przy fladze ON model dostaje definicje READ i realnie wykonuje co najmniej
jedno wywołanie przez `executeToolCall` (dowód: log z nazwą narzędzia **i** wynik użyty w
odpowiedzi, nie sam log); przy OFF liczba wywołań pętli wynosi `0`; tabela R1a kompletna;
`tool_step` przechodzi wszystkie cztery warstwy; test flagi jest testem zachowania, nie
istnienia pola.

## R2 — zgodność bezpieczeństwa: pętla nie może być obejściem bramek

**Zasada nadrzędna: pętla nie dokłada ani jednej nowej ścieżki dostępu do danych.** Każde
wywołanie idzie przez tę samą bramkę, którą przechodzi dziś wywołanie z planu agenta.

### R2a — polityki, które MUSZĄ zadziałać w pętli

Zmierz i pokaż testem, że przy fladze ON obowiązują:

- **Web:** `executeWebSearch` (`toolDefinitions.ts:802`) czyta
  `getEffectiveWebSearchPolicy(orgId, projectId)` z `webSearchGovernance.ts` i przy
  `internetEnabled === false` zwraca odmowę zamiast wyników (`:820-829`); dokłada
  `sanitizeQuery` i `filterResults`.
- **Wiedza:** `executeKBSearch` (`toolDefinitions.ts:876`) najpierw woła
  `evaluateRetrievalPolicyDecision({ consumerClass: 'agent', ... })` i jest **fail-closed
  także na błąd bramki** (`:894-903`: wyjątek → pusty wynik + `note: 'Blocked by policy
  gateway'`), a dalej zawęża `documentIds` allow-listą sejfu/folderu (`:938-1010`).
- ★ **Rozstrzygnij `consumerClass`.** Dziś w `executeKBSearch` jest zaszyte `'agent'`, a
  `chatPolicyGateway.ts:106` dopuszcza m.in. `'chat'` i `'teresa'`. Wywołanie z czatu Teresy
  przez pętlę **nie jest oczywiście tym samym konsumentem co krok planu w tle**. Zmierz, czy
  polityka różnicuje te klasy; jeśli tak — wybór klasy jest **zmianą kontraktu
  bezpieczeństwa** i ma być nazwany w raporcie jako świadoma decyzja, nie efekt uboczny.

### R2b — test izolacji (obowiązkowy, z dowodem mutacyjnym)

Dokument, którego wołający nie ma prawa zobaczyć, **NIE wraca przez `search_knowledge_base`
wywołane w pętli**. Wzorzec istniejący, do przeczytania przed pisaniem:
`tests/unit/backend/toolDefinitions.executeKBSearch.vaultScope.test.ts`.

★★ **`Z29` — dowód mutacyjny w obie strony, i uwaga na wektor systemowy.** W tym programie
odnotowano, że **testy izolacji potrafią leczyć się skutkiem własnego ataku** (retry, ponowne
seedowanie, sprzątanie w `beforeEach`, które usuwa dowód). Twój test ma:
(a) być czerwony po odwróceniu naprawy; (b) **nie mieć retry** ani ponowienia; (c) sprawdzać
NIEOBECNOŚĆ konkretnego, imiennie zaseedowanego dokumentu, nie samą liczbę wyników.
Sformułowanie „izolacja `X/X` PASS” bez tych trzech rzeczy jest w tym programie podejrzane z
urzędu.

### R2c — limit kosztu: licznik wywołań płatnych w rozmowie + log

Płatne w zbiorze READ są trzy narzędzia (`T9`). Pętla o czterech iteracjach może je wołać
wielokrotnie w jednej turze — i to jest realny wektor kosztowy, bo klucz należy do właściciela.

**Rozstrzygasz Ty, z pomiarem — dwie drogi:**

1. **Reużycie istniejącej maszynerii:** `executeWithAgentResourceReservation`
   (`server/src/services/v8/agentResourceGovernanceService.ts:413`) + `estimateAgentToolCostUsd`
   — dokładnie to, co robi dziś planer (`agentPlannerService.ts:1146-1180`, z kluczem
   idempotencji i `recomputeDeniedAdmission`). Zaleta: jedna macierz limitów. Koszt: wymaga
   `projectId`/`runId`, których tura czatu nie ma naturalnie — planer podstawia tam literał
   `'agent-plan-chat:v1'` (`agentPlannerService.ts:1136`), zmierz, czy to się skaluje na czat.
2. **Lżejszy licznik per rozmowa** — zliczanie wywołań płatnych i sumy `estimateAgentToolCostUsd`
   w obrębie tury/konwersacji, z twardym sufitem i wpisem do logu.

Cokolwiek wybierzesz: **licznik ma być egzekwowany KODEM** (przekroczenie = odmowa wykonania
narzędzia z czytelnym wynikiem dla modelu, nie ostrzeżenie w logu), ma mieć **własny test**
i ma być widoczny w logu z nazwą narzędzia i narastającą sumą. ★ `UnknownToolCostError` (`T9`)
oznacza, że **każde narzędzie w zbiorze READ musi mieć cenę** — sprawdź wszystkie i wpisz
wynik `X z X` do raportu.

**Ukończone, gdy:** trzy polityki udowodnione testami przez pętlę (nie przez bezpośrednie
wywołanie funkcji z pominięciem ścieżki); test izolacji zielony z dowodem mutacyjnym i bez
retry; `consumerClass` rozstrzygnięty i uzasadniony; licznik kosztu egzekwowany kodem, z
testem i logiem.

## R3 — stare ścieżki READ nie dublują nowej + ★ DOWÓD SCENARIUSZEM Z REALNYM MODELEM

### R3a — brak dublowania

Przy fladze **OFF**: bezwarunkowy prefetch KB (`ai.routes.ts:3485`) i regex web
(`ai.routes.ts:3707-3710`) działają jak dziś. **Niczego z nich nie kasujesz** — to jest zakaz
tego dyżuru, a nie sugestia.

Przy fladze **ON**: rozstrzygnij i udowodnij testem, że odpowiedź ma **jedno źródło**. Napięcie
jest realne i wykryte pomiarowo (`§1(d)`): prefetch wstrzykuje snippety KB do promptu ZAWSZE,
niezależnie od modelu; jeżeli model w tej samej turze zawoła `search_knowledge_base`, ta sama
wiedza wejdzie dwiema drogami. Możliwe rozstrzygnięcia (wybierz i uzasadnij):
prefetch wyłączany przy ON · narzędzie niepodawane, gdy prefetch coś znalazł · oba zostają, a
deduplikacja jest po `documentId` w cytowaniach. **Nazwij wybór jednym zdaniem, które da się
zacytować, i pokaż go testem** — „jedno źródło odpowiedzi” bez asercji nie jest dowodem.

### R3b — ★★ SCENARIUSZ Z REALNYM MODELEM (`Z15` ZNIESIONE DLA TEJ POZYCJI)

★★ **`Z15` NIE OBOWIĄZUJE W POZYCJI R3b. REALNE WYWOŁANIE MODELU JEST WYMOGIEM TEJ POZYCJI,
A NIE NARUSZENIEM.** To zdanie jest tu, bo sprzeczność „instrukcja zakazuje modelu i
jednocześnie go wymaga” zatrzymała już raz dyżur (185) — jego `STOP` był ZASADNY, a błąd był
autorski po stronie nadzorcy. W pozycjach R1 i R2 modelu **nie wołasz w ogóle**.

**Licencja na klucz — mechanizm dnia 190, przeniesiony dosłownie.** Klucz **OpenRouter** leży
poza repozytorium:

```
~/.consultify-openrouter
```

Plik ma jedną linię `OPENROUTER_API_KEY=<wartość>`. **Jedyna dozwolona komenda źródłowa:**

```bash
set -a; . ~/.consultify-openrouter; set +a
```

Nie kopiujesz tego pliku, nie przenosisz go do repozytorium, nie wpisujesz jego treści do
`.env`, `docker-compose*` ani do żadnej komendy. **`Z40` bez wyjątku: wartość klucza nie
pojawia się nigdzie** — nie w raporcie, nie w logu, nie w komunikacie błędu. Pokazujesz
wyłącznie `obecny`/`nieobecny`:

```bash
env | sed 's/=.*//' | grep -x 'OPENROUTER_API_KEY' && echo "DOSTAWCA OBECNY" \
  || echo "BRAK ZMIENNEJ DOSTAWCY"
```

Zmierz dostawcę w OBU miejscach, w tej kolejności (dyżur 88 stanął, bo mierzył jedno):
(1) **baza** — wiersz w `llm_providers` z niepustym `api_key`; zapytanie zwraca WYŁĄCZNIE
nazwę dostawcy i `TAK`/`NIE`, nigdy wartość; (2) **środowisko** — komendą wyżej. Produkt
rozwiązuje dostawcę **najpierw z bazy, ze zmiennych awaryjnie**.

★★ **MODEL MUSI UMIEĆ FUNCTION-CALLING — i to jest ryzyko, nie formalność.** OpenRouter jest
podpięty jako dostawca OpenAI-kompatybilny (`llmService.ts:430-436`, `createOpenAI` z
`baseURL: https://openrouter.ai/api/v1`), więc **obsługa narzędzi zależy od modelu, do którego
OpenRouter routuje, nie od samego OpenRoutera.** Model bez wsparcia dla narzędzi odpowie
tekstem, pętla wykona zero kroków, a dowód będzie fałszywie negatywny. **Wybierz model ze
wsparciem narzędzi i wpisz do raportu, który to model** (samą nazwę modelu — nigdy klucza).

### ★ ARYTMETYKA BUDŻETU WYWOŁAŃ — przeczytaj, zanim cokolwiek uruchomisz

`DEC-2026-08-29-317` mówi: **„dokładnie DWA realne wywołania modelu jako dowód, zakaz pętli”.**
Ten dyżur ma w temacie pętlę, więc sprzeczność trzeba rozstrzygnąć JAWNIE, a nie przemilczeć.
**Rozstrzygnięcie nadzorcy, wiążące dla tego dyżuru** (i do jawnego potwierdzenia przez
właściciela, jeśli je zakwestionuje):

- Jednostką limitu z `DEC-317` jest **PRZEBIEG** (jedna tura czatu), nie runda modelu wewnątrz
  tury. Powód: `stopWhen: stepCountIs(4)` (`llmService.ts:1343`) oznacza, że jedna tura z
  narzędziami to z definicji do czterech rund modelu — inaczej pozycja R3b jest niewykonalna
  z definicji, a to jest dokładnie ten kształt błędu, który zatrzymał dyżur 185.
- **Budżet: DOKŁADNIE DWA PRZEBIEGI SCENARIUSZA.** Przebieg 1 — flaga **ON** (do 4 rund
  modelu). Przebieg 2 — flaga **OFF**, mutacja (1 runda, bo bez narzędzi nie ma kroków).
  **Sufit: 5 rund modelu w całym dyżurze.**
- **Zakaz ponawiania.** Przebieg nieudany (brak dostawcy, model bez narzędzi, timeout) = `STOP`
  pozycji z opisem, **nie** trzeci przebieg. Jeżeli musisz wybrać inny model, bo pierwszy nie
  wspiera narzędzi — to jest jeden dodatkowy przebieg i **musisz go jawnie policzyć i wpisać
  do raportu z uzasadnieniem**, a nie schować.
- Do raportu wpisujesz **zmierzoną** liczbę rund modelu z logu (`LLM call success` z realnym
  `tokens`/`durationMs`), nie deklarowaną.

### Wejście scenariusza

Jedno zdanie po polsku, w rodzaju: **„Policz ROI inicjatywy «<tytuł>» i porównaj z
benchmarkiem branżowym.”** Oczekiwany łańcuch, który model ma wybrać SAM:
`get_initiative_status` → `calculate_financial` → `compare_benchmarks`.

★★ **To ma być wybór modelu, nie Twoja podpowiedź.** Zakaz: wymuszania nazw narzędzi w
promptcie, zakaz per-turowej dyrektywy „MUSISZ wywołać X” (taki wzorzec istnieje w kodzie —
`AIPipeline.ts:414-427`, intencja `table` — i **jest w tym dyżurze zakazany**), zakaz
zawężania zbioru narzędzi do trzech tak, żeby model nie miał wyboru. Model dostaje pełen zbiór
READ i sam wybiera. Jeżeli wybierze inaczej niż zakładasz — **to jest wynik do raportu**, nie
usterka do obejścia.

**Dane muszą być realne.** Inicjatywa, o którą pytasz, ma istnieć w Twojej lokalnej bazie;
odpowiedź ma zawierać jej realne liczby. `get_initiative_status` czyta lokalną tabelę
inicjatyw — jeżeli w odpowiedzi nie ma ani jednej liczby z bazy, dowód jest nieważny, choćby
log kroków wyglądał idealnie. **Znacznik dyżuru** (`ZNACZNIK-DAY206-…`) umieść w tytule
inicjatywy albo w treści, żeby dało się odróżnić Twój przebieg od cudzego.

### Dowody, które zostają w artefaktach

- **Log kroków** — sekwencja narzędzi z czasem i statusem, z `shasum -a 256` i ścieżką w
  raporcie.
- **★ Zrzut UI z widocznymi krokami, ×2 motywy.** Obowiązuje pomiar **`mean_luma` każdego
  zrzutu, para jasny/ciemny musi różnić się o >150**. Powód jest twardy: w tym programie
  policzono już przypadek, w którym pięć „jasnych” zrzutów było ciemnymi duplikatami
  (`mean_luma 24-28`, pary różniące się o 0,007-0,04% pikseli) i przeszło przez `shasum`, bo
  plakietka zmienia SHA. Znana przyczyna: **motyw ustawiany po hydratacji** — naprawa przez
  `addInitScript`.
- ★★ **Pułapka renderu, przeczytaj przed planowaniem zrzutu.** Harness `dev-render` **nie
  zmontuje realnego `UnifiedChatPanel`** — mówi to wprost nagłówek
  `dev-render/screens/chat-split-teresa-right.tsx` („ciągnie store/API/logowanie i nie zmontuje
  się w harnessie, więc TREŚĆ jest mockowana”). Zrzut zamockowanej powłoki **nie jest dowodem
  renderu** — to dokładnie kształt „wołacz istnieje ≠ renderuje się”. Wymóg minimalny:
  zrzut pokazuje **realny komponent kroków** (ten, który renderuje `MessageRenderer`), zasilony
  danymi w kształcie realnego zdarzenia `tool_step`; w raporcie piszesz **wprost**, czy dane
  na zrzucie pochodzą z realnego przebiegu SSE, czy z propsów w harnessie. Zatarcie tej
  różnicy jest podstawą odrzucenia pozycji.
- ★ `CLAUDE.md` §7: **właściciel nigdy nie jest pierwszym testerem wizualnym.** Zrzut robisz
  Ty, przed nim, i ma być czysty (tokeny `c-*`, zero crimson, fokus `c-focus`).

### Mutacja

Flaga **OFF** → **zero wywołań pętli**, przy niezmienionym scenariuszu i tym samym wejściu.
Podaj obie liczby z mianownikiem (`N z N` wywołań przy ON, `0 z N` przy OFF) i pokaż, że
odpowiedź przy OFF nadal powstaje (stara ścieżka nietknięta). Mutacja **nie zużywa trzeciego
przebiegu ponad budżet** — jest to przebieg 2 z arytmetyki wyżej.

**Ukończone, gdy:** model sam wybrał co najmniej dwa narzędzia w jednej turze, kroki są w logu
i na zrzucie, odpowiedź niesie realne liczby z bazy, `mean_luma` obu zrzutów w raporcie z parą
>150, mutacja OFF udokumentowana w obie strony, a liczba rund modelu zmierzona i mieszcząca
się w budżecie (albo przekroczenie **jawnie** zgłoszone).

# 4. TABELA LICENCJI PLIKOWYCH

Licencja obejmuje CAŁĄ ścieżkę: definicje → dyspozytor → strumień → trasa → front → testy.
Pominięcie ogniwa zmusiłoby Cię do złamania licencji albo do połowy roboty.

| Zakres | Ścieżki |
|---|---|
| Zapis | `server/src/config/FeatureFlags.ts` — WYŁĄCZNIE dodanie `ENABLE_TERESA_TOOL_LOOP` (wpis w `FeatureFlagsSchema` + wpis w bloku ładującym). Zakaz zmiany wartości domyślnej JAKIEJKOLWIEK istniejącej flagi |
| Zapis | `server/src/services/ai/llmService.ts` — WYŁĄCZNIE `callStream` (`:1140` i dalej): rejestracja rodziny READ (wzorzec `clientTools` `:1271-1300`), parametryzacja `stopWhen` (`:1343`), otwarcie kanału części `tool-*` w iteratorze (`:1384-1445`). **Zakaz zmian w `callWithTools` (`:921`) i `callWithToolsStream` (`:1009`)** — mają własnych konsumentów i własne testy |
| Zapis | `server/src/services/ai/AIPipeline.ts` — WYŁĄCZNIE blok wiązania narzędzi strumienia (`:340-455`) i wywołanie `callStream` (`:531-572`). **Zakaz zmian w `CHAT_CREATION_TOOLS` (`:366-375`) inaczej niż addytywnie i za flagą**; zakaz dotykania pre-klasyfikacji intencji (`:387-434`) |
| Zapis | `server/src/services/ai/toolDefinitions.ts` — dozwolone WYŁĄCZNIE: eksport zbioru READ (np. przez rozszerzenie `getAvailableTools` `:1354`) i, jeśli R2c tego wymaga, licznik/limit **wokół** `executeToolCall` (`:573`). **Zakaz zmiany semantyki któregokolwiek executora READ** (`:802` web, `:876` KB, `:1074`-`:1345`) i zakaz dotykania gałęzi WRITE (`create_task`/`update_task`/`create_decision`/`create_initiative_draft`/`create_notebook_entry`/`generate_report_section`/`schedule_meeting`/`query_structured_data`) |
| Zapis | `server/src/routes/ai.routes.ts` — WYŁĄCZNIE: wiązanie narzędzi READ w opcjach `pipelineRequest` (obok bloków `:4760-4796` i `:4805-4855`) oraz emisja `tool_step` przez `emitSSE` (`:2858`). **Zakaz kasowania i modyfikacji**: prefetchu KB (`:3465-3520`), regexu web (`:3705-3712`) i przełączników `aiModes` |
| Zapis | `src/hooks/useAIStream.ts` — WYŁĄCZNIE dodanie typu i obsługi zdarzenia `tool_step` (wzorzec `ResearchProgressEvent` `:406`, obsługa `:1111`) |
| Zapis | `src/components/AIChat/MessageRenderer.tsx` — WYŁĄCZNIE dodanie renderu kroków obok bloku `researchProgress` (`:798-815`) |
| Zapis | NOWY komponent kroków w `src/components/AIChat/` (wzorzec kształtu: `ResearchProgress.tsx`) — pełna licencja, tokeny `c-*`, zero `primary-*` |
| Zapis | NOWY ekran `dev-render/screens/` do zrzutu (jeśli go tworzysz) + wpis w `dev-render/main.tsx` |
| Zapis | NOWE pliki testowe `day206.*` w `server/src/services/ai/__tests__/`, `tests/unit/backend/` i/lub `tests/integration/` — pełna licencja, z zastrzeżeniem `Z18` i `Z31`. ★ Nowe pliki w `tests/` wymagają `git add -f` |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY206_TOOL_LOOP_REPORT.md` |
| Zapis (ograniczony) | `docs/program/funkcje/ARCHITEKTURA_AGENTA_TERESY.md` — WYŁĄCZNIE nowy rozdział `10. Wykonanie — 17-B (Day206)` na końcu pliku oraz odsyłacz do niego w wierszu `P1` tabeli §3. **Zakaz zmiany treści ogniw P2-P5, §4, §6, §8 i §9** — to jest dokument zaakceptowany przez właściciela |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/ai/agentPlannerService.ts` (`:1133` wołacz `executeToolCall`, `:1146-1200` rezerwacja zasobu) — cykl planów utwardzony dyżurami 164-180, **nietykalny** |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/wave8AgentRuntimeService.ts` (`:4` import `executeToolCall`) — silnik V8 za `ENABLE_V8_GLOBAL`, **nietykalny** (architektura §4: „zostają OBA”) |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/ai/sideEffectTools.ts` — lista jest bramką aprobat dla planów; **nie dopisujesz i nie usuwasz z niej nic** |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/ai/mcpServer.ts` (`:415` `getToolDefinitions`, `:482-505` `execute`, `:497` gałąź `MUTATION`), `server/src/services/ai/tools/index.ts`, `server/src/services/ai/tools/searchKnowledgeBase.ts` — semantyki wspólnego rejestru nie zmieniasz |
| Odczyt | `server/src/services/ai/chatPolicyGateway.ts` (`:106` klasy konsumenta, `:552` `evaluateRetrievalPolicyDecision`), `server/src/services/ai/webSearchGovernance.ts`, `server/src/services/ai/toolCostEstimates.ts`, `server/src/services/v8/agentResourceGovernanceService.ts` (`:413`) — bramek i cennika NIE zmieniasz |
| Odczyt | `server/src/ai/actionExecutors/playbookExecutor.ts` (`:182`, `:224`) — trzeci wołacz `executeToolCall`, do policzenia w mapie wołaczy |
| Odczyt | `tests/unit/backend/toolDefinitions.executeKBSearch.vaultScope.test.ts` — wzorzec testu izolacji sejfu |
| Odczyt | `docs/program/funkcje/ARCHITEKTURA_AGENTA_TERESY.md` (§3 P1, §7), `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` (`DEC-2026-08-29-317`), `docs/program/waves/WAVE_03_ACCEPTANCE/modules/13_CHAT/MODULE_ACCEPTANCE.md` |
| Odczyt | `~/.consultify-openrouter` — WYŁĄCZNIE przez `set -a; . ~/.consultify-openrouter; set +a`; nigdy nie wypisujesz zawartości |

**Nietykalne imiennie:** `agentPlannerService.ts` · `wave8AgentRuntimeService.ts` ·
`sideEffectTools.ts` · `toolCostEstimates.ts` (cennik) · `chatPolicyGateway.ts` ·
`webSearchGovernance.ts` · wszystkie executory WRITE w `toolDefinitions.ts` · regexy i prefetch
READ w `ai.routes.ts` · każdy `MODULE_ACCEPTANCE.md`.

**Rozłączność z partią równoległą:** ten dyżur wchodzi w `ai.routes.ts`, `AIPipeline.ts`,
`llmService.ts` i `useAIStream.ts` — cztery pliki o wysokim ruchu. **Przed pierwszym commitem**
sprawdź `git log` gałęzi bazowej pod kątem równoległych dyżurów w tych plikach i zgłoś kolizję
zasobową ZANIM zaczniesz pisać, nie po.

# 5. TWARDE ZASADY

- ★★ **ZERO NARZĘDZI ZAPISUJĄCYCH W PĘTLI — bez wyjątku, także za zgodą użytkownika.**
  Osiem nazw z `SIDE_EFFECT_TOOLS` nie może trafić do zbioru podawanego modelowi w czacie.
  WRITE-as-proposal to dyżur **17-C** i osobna decyzja. Jeżeli w trakcie uznasz, że „to by było
  łatwe do dołożenia” — to jest sygnał wyjścia poza zakres: wpis do raportu, nie zmiana kodu.
- ★★ **`Z15` ZNIESIONE WYŁĄCZNIE DLA R3b.** W R1 i R2 modelu nie wołasz w ogóle. Licencja na
  klucz i jedyna dozwolona komenda źródłowa — w opisie R3b. **`Z40` bez wyjątku:** wartość
  klucza nie pojawia się nigdzie; pokazujesz `obecny`/`nieobecny`.
- ★★ **BUDŻET WYWOŁAŃ: DWA PRZEBIEGI SCENARIUSZA, SUFIT 5 RUND MODELU** (arytmetyka i jej
  uzasadnienie w R3b). Zakaz pętli poza scenariuszem, zakaz ponawiania nieudanego przebiegu.
  Przebieg dodatkowy = jawny wpis do raportu z uzasadnieniem, nigdy po cichu.
- ★★ **`agentPlannerService.ts` i `wave8AgentRuntimeService.ts` NIETYKALNE** poza odczytem.
  Architektura §4 rozstrzygnęła, że oba światy agentowe **zostają**; ten dyżur ich nie scala,
  nie upraszcza i nie „porządkuje przy okazji”.
- ★★ **REGEXY I PREFETCH READ W `ai.routes.ts` NIE SĄ KASOWANE.** Zmiana ich zachowania jest
  dozwolona **wyłącznie pod flagą ON**; przy OFF ścieżka ma być bajt w bajt dzisiejsza.
- ★★ **`Z31` — ZAKAZ PINOWANIA STRAŻNIKA REALDB DO HOSTA, PORTU ALBO NAZWY BAZY.** Wołasz
  `await assertRealPostgresTestEnvironment()` **BEZ ARGUMENTÓW**, w szczególności bez
  `expectedDatabase`; zakaz asercji na `DATABASE_URL`, na porcie i na nazwie kontenera. Powód,
  dosłownie: dyżur 43 przypiął strażnika do swojej bazy — po usunięciu kontenera **30
  przypadków dowodowych stało się trwałym `SKIP`** przy `exit 0`; w programie odnotowano
  **sześć takich incydentów**, a dyżur 193 zamówiono wyłącznie po to, żeby je zbiorczo odpiąć
  (`97187267a0 fix(day164): unpin Z31 DATABASE_URL assertion to any local Postgres`).
  **Nie dokładaj siódmego.**
- ★★ **`Z29` — dowód mutacyjny w obie strony** dla R1 (flaga), R2b (izolacja), R2c (limit
  kosztu) i R3 (mutacja OFF). „Test zielony” nie jest dowodem. ★ **Zakaz retry w testach
  bezpieczeństwa** — w tym programie zmierzono, że test izolacji potrafi wyleczyć się skutkiem
  własnego ataku; każde „izolacja `X/X` PASS” bez tego zastrzeżenia jest podejrzane z urzędu.
- ★ **Sprzątanie kontenera: `docker rm -f -v`** — z flagą `-v`, inaczej wolumen zostaje na
  dysku i po kilku dyżurach kończy się miejsce.
- ★ **`§0.4a` — pomiar zasięgu testów jest warunkiem oddania raportu** (`Z24`). Zawężony wybór
  albo **przepisanie cudzej liczby** = zawyżenie i podstawa odrzucenia.
- ★ **Zrzuty: `mean_luma` każdego, para jasny/ciemny >150 różnicy.** Bez wyjątku. Duplikat
  obrazu zamiast drugiego motywu przechodzi `shasum` (plakietka zmienia SHA) — to jest
  policzony, nazwany kształt fałszywego gotowe.
- ★ **`Z13`:** logi, dzienniki przebiegu, zrzuty i wyjścia bramek **nie wchodzą do repo** —
  leżą w `/private/tmp/cx-day206-tool-loop-artefakty`, a raport podaje ścieżki i `shasum -a 256`.
- ★ **`Z27` — zakaz `git stash`** w każdej postaci. Dowody mutacyjne robisz przez `cp` do
  katalogu scratch i powrót przez `cp`; schowek jest współdzielony między wszystkimi worktree
  tego repozytorium.
- **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji** (`Z28`), w każdą stronę i
  każdym narzędziem. Klucz dostawcy służy WYŁĄCZNIE do wywołania modelu w R3b.
- **Zakaz naprawiania przez wyciszanie** (`@ts-ignore`, `.skip`, poszerzanie `exclude`,
  `--no-verify`) i zakaz usuwania zastanych testów — asercję wolno **ZMIENIĆ** z uzasadnieniem,
  nie skasować.
- Pułapka: bez `RUN_DB_TESTS=1` testy backendowe idą na MOCK DB. Pułapka: `No test files found`
  **nie jest** `PASS` — sprawdź `numTotalTests > 0`. Pułapka: `npx vitest run` bywa kończy się
  `exit 0` mimo czerwonych testów — liczby **i nazwy** czytasz z JSON-a (`Z37`: porównania po
  `fullName`, nigdy po liczbach). Pułapka: `DB_TYPE` bywa przybity w configu — sprawdź, co
  realnie widzi proces.
- ★ Port **5000 zajęty na stałe** przez macOS Control Center; port **5037** zajęty przez `adb`;
  porty **5060-5061** zajęte. Nie używaj żadnego z nich.
- ★★ **Sekcja „TWIERDZENIA NIEZWERYFIKOWANE” w raporcie jest OBOWIĄZKOWA.** Wypisz w niej
  wprost co najmniej: czy tabela wszystkich narzędzi z `AI_TOOLS` jest kompletna czy skrócona;
  czy `T3` (twarde wiązanie `mcpServer.execute`) zmierzyłeś czy założyłeś; czy potwierdziłeś,
  że `getAvailableTools` **nie ma wołaczy** (a więc że `AI_TOOLS` nigdy nie trafiło do żadnego
  modelu), czy tylko to przepisałeś z instrukcji; czy dane na zrzucie pochodzą z realnego SSE
  czy z propsów w harnessie; ile rund modelu naprawdę wykonałeś; czy `consumerClass` w pętli
  zmierzyłeś, czy przyjąłeś; czy sprawdziłeś WSZYSTKIE narzędzia READ pod kątem obecności w
  cenniku. **Brak tej sekcji jest podstawą odrzucenia dyżuru.**
