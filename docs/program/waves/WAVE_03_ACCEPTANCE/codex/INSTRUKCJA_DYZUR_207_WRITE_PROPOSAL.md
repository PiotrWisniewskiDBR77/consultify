# INSTRUKCJA DYŻURU nr 207 — Codex — „Modul 17, pozycja 17-C (ogniwo P1b + P5): WRITE-AS-PROPOSAL w czacie Teresy — wywolanie narzedzia ZAPISUJACEGO przez model NIE wykonuje sie, tylko produkuje KARTE PROPOZYCJI, a wykonanie nastepuje dopiero po kliknieciu `Zatwierdz`, przez jedna macierz uprawnien (aiRoleGuard + chatPermissionService) i z audytem; za flaga `ENABLE_TERESA_TOOL_LOOP_WRITE` domyslnie OFF (OSOBNA od flagi READ z 206). Plus: CZTERY akcje czatu z D-15 dostaja PRODUCENTOW (GENERATE_REPORT, GENERATE_PRESENTATION, USE_TEMPLATE+BROWSE_TEMPLATES, RECORD_KPI), a pozostale widma dostaja MAPE, nie kasowanie"

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
> **wyłącznie** `/private/tmp/cx-day207-write-proposal`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `91e02b8ea8`**
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
Zakres: **13_CHAT — bramka zgody na ZAPIS w czacie Teresy (`POST /api/ai/chat/stream`), warstwa wiazania narzedzi w `AIPipeline`/`llmService.callStream`, cykl `ai_actions` w `server/src/services/aiActionExecutor.ts` oraz rejestr akcji czatu `src/types/domain/chatActions.ts` + `src/services/chatActionHandler.ts`. Kontrakt: `docs/program/funkcje/ARCHITEKTURA_AGENTA_TERESY.md` §3 (ogniwa `P1b` i `P5`) + §7 (pozycja `17-C tool-loop WRITE-as-proposal + zgaszenie widm`) + §8 pkt 2 (pytanie wlasciciela o 15 widm) + zasada wlasciciela `D-15`: `agent ma obejmowac prace ze WSZYSTKIMI narzedziami aplikacji i nimi zarzadzac` — co ZMIENIA odpowiedz na §8 pkt 2: widma NIE sa kasowane hurtem, tylko MAPOWANE na realne narzedzia aplikacji. ★ Dyzur dotyka DWOCH powierzchni wizualnych: karty propozycji zapisu w dymku czatu (R1) i chipow sugestii pod polem wpisywania (R2). ★★ `D-15` jest cytatem z sesji wlasciciela, nie plikiem w repozytorium — sprawdzilem: w `docs/program/waves/WAVE_03_ACCEPTANCE` NIE MA wpisu `D-15`; jesli go znajdziesz, zacytuj plik:linia, a jesli nie — zapisz w raporcie, ze podstawa jest cytat nadzorcy, nie dokument. To jest uczciwosc zrodla, nie formalnosc**.
Trasy front: `Front zmieniasz w PIECIU miejscach, w dwoch niezaleznych watkach. WATEK KARTY (R1): (1) `src/components/AIChat/MessageRenderer.tsx` — ★ warstwa renderu JUZ ISTNIEJE: `V8_EXECUTION_MESSAGE_TYPES` (`:64-70`) i JAWNE przechwycenie `execution_proposal`/`execution_progress`/`execution_result` PRZED zwyklym dymkiem (`:619-647`), z komentarzem `proposals are never rendered as plain chat text and can never silently mutate state`; komponent `src/components/AIChat/ExecutionProposalMessage.tsx` istnieje; (2) `src/components/AIChat/UnifiedChatPanel.tsx` — handlery `handleProposalApprove` (`Api.approveAIAction` `:6009`) i `handleProposalReject` (`:6060`) TEZ juz istnieja, razem z `useProposalLifecycleStore`; (3) `src/hooks/useAIStream.ts` — jesli propozycja ma sie pojawic W TRAKCIE tury, a nie dopiero po przeladowaniu watku, potrzebny jest typ zdarzenia SSE (wzorce w pliku: `idea_action` `:948`, `teresa_proposal` `:1012`, `research_progress` `:1111`). WATEK CHIPOW (R2): (4) `src/components/Chat/ChatSmartSuggestions.tsx` — ★ typ `ChatSuggestionAction = NavigateAction | ChatInjectAction` (`:33`) NIE DOPUSZCZA `ChatActionPayload`, wiec bez poszerzenia typu zadna z czterech akcji nie przejdzie kompilacji; (5) `src/hooks/useChatActions.ts` — `deps: ActionHandlerDeps = { navigate, context: {} }` (`:63`) bez `onOpenReportBuilder`/`onOpenPresentationWizard`/`onOpenKpiDrawer` i bez `projectId`; producentem sugestii jest `chatSuggestions` useMemo w `UnifiedChatPanel` (ok. `:2716-2800`), bramkowany `aiConfig.chatSuggestionsEnabled` (D-104) oraz `displayMessages.length >= 2 && !isStreaming`. ★★ PULAPKA RENDERU, przeczytaj ZANIM zaplanujesz zrzut: `dev-render/screens/chat-split-teresa-right.tsx` mowi w naglowku WPROST, ze realny `<UnifiedChatPanel>` `ciagnie store/API/logowanie i nie zmontuje sie w harnessie, wiec TRESC jest mockowana`. Zrzut zamockowanej powloki NIE JEST dowodem renderu. Minimum: zrzut pokazuje REALNY `ExecutionProposalMessage` (albo Twoj komponent karty), zasilony danymi w ksztalcie realnego rekordu `ai_actions`, a raport mowi WPROST, czy dane pochodza z realnego przebiegu, czy z propsow w harnessie. `CLAUDE.md` §7: wlasciciel NIGDY nie jest pierwszym testerem wizualnym — zrzut robisz Ty, przed nim`. Trasy tył: `Nie dodajesz ZADNEJ nowej trasy publicznej — wszystkie potrzebne juz istnieja i sa zamontowane. Trasa czatu: `POST /api/ai/chat/stream` (`server/src/routes/ai.routes.ts:1561`, `verifyToken` + `requireActiveChatMembership` + `validateBody(ChatStreamRequestSchema)`); `emitSSE` `:2858`. Lancuch wiazania narzedzi: trasa buduje `pipelineRequest.options` (`deliverableTools` `:4763-4796`, ★ `ideaTools` `:4800-4855` z `onClientToolCall` `:4839` i `emitSSE({type:'idea_action'})` `:4843`) → `AIPipeline.process` filtruje przez `CHAT_CREATION_TOOLS` (`AIPipeline.ts:366-375`) i wola `llmService.callStream` (`:532`, `timeoutMs: 60_000` `:546`, `clientTools` `:562`, `maxIterations: 4` `:571`) → `callStream` rejestruje narzedzia serwerowe z `execute` PRZYBITYM do `mcpServer.execute` (`llmService.ts:1204`, `:1208`) ORAZ rodzine `clientTools`, ktorej `execute` NIE wykonuje niczego na serwerze, tylko wola `onClientToolCall` (`:1271-1300`, regula pierwszenstwa `:1279`). Cykl propozycji `ai_actions`: `aiActionExecutor.requestAction` (`server/src/services/aiActionExecutor.ts:295` — konsultuje RegulatoryModeGuard, `AIRoleGuard.isActionBlocked` `:326`, `AIPolicyEngine.canPerformAction` `:344`, wzorce aprobat), `createDraft` `:533`, `approveAction` `:570`, `rejectAction` `:660`, `executeAction` `:769`, `getPendingActions` `:941`, `_executeCreateTask` `:1082`; emisja wiadomosci `execution_proposal` do watku przez `ChatEmissionOptions` (`:71-100`). Trasy tego cyklu: `POST /ai/actions/draft` (`ai.routes.ts:6787`), `GET /ai/actions/pending` (`:6820` — ★ DUBLET rejestracji na `:7992`, martwy), `PATCH /ai/actions/:id/approve` (`:6840`), `PATCH /ai/actions/:id/reject` (`:6860`), `PATCH /ai/actions/:id/execute` (`:6880`), `POST /ai/actions/:actionId/approve` (`:7944`), `POST /ai/actions/:actionId/reject` (`:7969`). Audyt: `aiRunLedgerService.ensureRunForAction` (`:198`), `recordAIRunEvent` (`:237`), `recordLegacyAuditSafely` (`:407`). Rejestry narzedzi: MCP (`server/src/services/ai/tools/index.ts:20-47`, w tym ★ `create_task` `:43` i `create_decision` `:44`) oraz `AI_TOOLS` (`toolDefinitions.ts:30`, dyspozytor `executeToolCall` `:573`, executor zapisu `executeCreateTask` `:719`, `case` `:700-701`). Bramka zapisu z czatu DZIS: `server/src/services/ai/tools/createTask.ts:334` (`createTask`), samo-bramka na `ENABLE_TERESA_RECORD_CREATE` `:343`, a dalej `TaskExecutor.execute` — zapis bez zgody. Alternatywny mechanizm propozycji (artefakty): `chatHandoffService.createChatProposal` (`:267`), `createGovernedChatProposal` (`:360`), `approveChatProposal` (`:506`), `chatTargetMappingService.materializeClaimedChatTarget` (`:140`), TARGET_KINDS zamkniete do `document|presentation|workbook|material` (`handoffSpineService.ts:49-50`), trasy `server/src/routes/v8/chat.routes.ts:616, 658, 738, 777, 816, 865, 918``.

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
WT=/private/tmp/cx-day207-write-proposal
MARKER=91e02b8ea8

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day207-write-proposal-20260831 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day207-write-proposal/config.worktree"
cat "$VAULT/worktrees/cx-day207-write-proposal/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day207-write-proposal-scratch
mkdir -p /private/tmp/cx-day207-write-proposal-artefakty

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
git -C "$VAULT" log --oneline 91e02b8ea8..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only 91e02b8ea8..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day207-write-proposal-20260831
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 91e02b8ea8..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `pietnascie` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day207-write-proposal

# (W1) OSIEM NARZEDZI ZAPISUJACYCH — policz sam i sprawdz, ILE Z NICH JEST W OGOLE OSIAGALNE Z CZATU
sed -n '17,31p' server/src/services/ai/sideEffectTools.ts
grep -c "'" server/src/services/ai/sideEffectTools.ts
sed -n '360,380p' server/src/services/ai/AIPipeline.ts
#   oczekiwane: SIDE_EFFECT_TOOLS ma OSIEM nazw i `query_structured_data` JEST
#   JEDNA Z NICH (`sideEffectTools.ts:22`) — zamowienie mowilo "8 + query_structured_data",
#   czyli liczylo je dwa razy. Poprawna liczba to 8, nie 9. ★ Filtr CHAT_CREATION_TOOLS
#   przepuszcza do czatu WYLACZNIE: generate_deliverable, generate_initiative oraz
#   — za ENABLE_TERESA_RECORD_CREATE — create_task i create_decision. Wniosek do
#   potwierdzenia: z osmiu narzedzi zapisujacych model w czacie widzi DZIS DWA.

# (W2) ★★ KOLIZJA NAZW create_task / create_decision — DWA REJESTRY, DWIE IMPLEMENTACJE
sed -n '20,47p' server/src/services/ai/tools/index.ts
grep -n "case 'create_task'\|case 'create_decision'\|async function executeCreateTask" server/src/services/ai/toolDefinitions.ts
ls -la server/src/services/ai/tools/createTask.ts server/src/services/ai/tools/createDecision.ts
#   oczekiwane: `mcpServer.registerHandler('create_task', createTask)` (tools/index.ts:43)
#   i `('create_decision', createDecision)` (:44) — to sa implementacje, ktore biegna
#   DZIS w czacie; oraz `case 'create_task': return await executeCreateTask(...)`
#   (toolDefinitions.ts:700-701, executor :719) — INNA implementacja, ta z planow.
#   ★ To jest ten sam ksztalt kolizji, co `search_knowledge_base` w dyzurze 206.
#   Jesli po Zatwierdz zawolasz executeToolCall, wykonasz INNY KOD niz ten, ktory
#   model wywolal. Rozstrzygnij jawnie i zapisz jednym cytowalnym zdaniem.

# (W3) ★★ CZY DZISIEJSZE ZAPISY Z CZATU MAJA BRAMKE ZGODY — czy pisza od razu
grep -n "ENABLE_TERESA_RECORD_CREATE" server/src/config/FeatureFlags.ts
sed -n '334,346p' server/src/services/ai/tools/createTask.ts
grep -n "TaskExecutor.execute\|actionExecutors/taskExecutor" server/src/services/ai/tools/createTask.ts
#   oczekiwane: flaga ma `z.boolean().default(true)` — czyli jest DOMYSLNIE WLACZONA;
#   handler `createTask` samo-bramkuje sie tylko na te flage, a nastepnie wola
#   `TaskExecutor.execute(...)` — ZAPIS DO BAZY BEZ ZADNEJ ZGODY CZLOWIEKA.
#   To jest ogniwo `P2` z architektury (`trzecia droga poza kanonem`) i jest ONO
#   DZIS ZYWE NA DOMYSLNYCH USTAWIENIACH. Twoja flaga OFF ma to zachowanie
#   zostawic bajt w bajt; ON — zamienic na propozycje.

# (W4) ★★ ILE MECHANIZMOW PROPOZYCJI JUZ ISTNIEJE W CZACIE — policz, zanim dolozysz piaty
grep -rn "artifact_handoff_proposals" server/src/services/artifactHandoff/handoffSpineService.ts | head -3
sed -n '49,51p' server/src/services/artifactHandoff/handoffSpineService.ts
grep -n "execution_proposal\|V8_EXECUTION_MESSAGE_TYPES" src/components/AIChat/MessageRenderer.tsx | head
grep -n "teresa_proposal" server/src/routes/ai.routes.ts
grep -rn "PendingActionsIndicator" src --include=*.tsx | grep -v "AIChat/PendingActionsIndicator.tsx"
#   oczekiwane CZTERY rozne mechanizmy, nie jeden:
#   (1) `artifact_handoff_proposals` (chatHandoffService) — ZYWY, ale TARGET_KINDS
#       to zamknieta lista `['document','presentation','workbook','material']`
#       (handoffSpineService.ts:49-50) — NIE MA w niej `task` ani `decision`;
#   (2) `ai_actions` + `execution_proposal` — karta ZAMONTOWANA i wpieta w
#       MessageRenderer (:65-70 zbior typow, :619-647 przechwycenie), z approve/
#       reject/execute w UnifiedChatPanel (:6009, :6060);
#   (3) `teresa_proposals` (teresaCopilotService) — ZYWY w strumieniu,
#       `emitSSE({type:'teresa_proposal'})` w ai.routes.ts:3012;
#   (4) PendingActionsIndicator — ZERO montazu w `src` (tylko wlasny plik).
#   ★ Wniosek do potwierdzenia albo obalenia: mechanizm (1) jest WIADOMOSC->ARTEFAKT,
#   a nie WYWOLANIE-NARZEDZIA->MUTACJA. To zmienia tresc zamowienia (patrz K4).

# (W5) ★★ CZY MECHANIZM (2) MA PRODUCENTA — najwazniejszy pomiar tego dyzuru
grep -rn "requestAction" server/src src tests --include=*.ts --include=*.tsx | grep -v _backup
grep -rn "actions/draft" src/services/api.ts src --include=*.ts --include=*.tsx | grep -v _backup
grep -n "'/actions/draft'\|'/actions/pending'\|'/actions/:id/approve'\|'/actions/:actionId/approve'" server/src/routes/ai.routes.ts
#   oczekiwane: `requestAction` (aiActionExecutor.ts:295) ma ZERO wolaczy produkcyjnych
#   — jedyny to `createDraft` w tym samym pliku (:544) i trasa POST /ai/actions/draft
#   (ai.routes.ts:6787), ktora z kolei nie ma ANI JEDNEGO wolacza po stronie frontu.
#   ★ Jesli to sie potwierdzi: caly cykl propozycja->zgoda->wykonanie->audyt jest
#   ZBUDOWANY i MARTWY — wzorzec `biblioteka bez wywolania`, ten sam co `AI_TOOLS`
#   w 206. Brakuje WYLACZNIE producenta, a Twoj dyzur jest producentem.
#   ★ Zauwaz tez DUBLET trasy: GET /actions/pending stoi w ai.routes.ts DWA RAZY
#   (:6820 i :7992); druga rejestracja jest martwa (Express bierze pierwsza).
#   To jest wpis do raportu, NIE naprawa w tym dyzurze.

# (W6) KARTA PROPOZYCJI — czy front juz umie ja narysowac
sed -n '64,70p' src/components/AIChat/MessageRenderer.tsx
sed -n '619,648p' src/components/AIChat/MessageRenderer.tsx
ls -la src/components/AIChat/ExecutionProposalMessage.tsx
#   oczekiwane: `V8_EXECUTION_MESSAGE_TYPES` = {execution_proposal, execution_progress,
#   execution_result} i JAWNE przechwycenie PRZED zwyklym dymkiem, z komentarzem
#   "proposals are never rendered as plain chat text and can never silently mutate
#   state". Wniosek: warstwy renderu NIE musisz budowac — musisz ja ZASILIC.

# (W7) ★ JEDNA MACIERZ UPRAWNIEN — gdzie jest minimalny punkt wpiecia (R4)
sed -n '295,345p' server/src/services/aiActionExecutor.ts
sed -n '91,101p' server/src/services/aiRoleGuard.ts
sed -n '38,47p' server/src/services/aiPolicyEngine.ts
grep -rn "aiRoleGuard" server/src/services/ai/AIPipeline.ts server/src/routes/ai.routes.ts || echo "PIPELINE NIE KONSULTUJE aiRoleGuard — zgodnie z karta §3"
#   oczekiwane: `requestAction` konsultuje po kolei RegulatoryModeGuard, AIRoleGuard
#   (`isActionBlocked`, :326) i AIPolicyEngine (`canPerformAction`, :344) — czyli
#   macierz JEST, tylko nikt jej z czatu nie wola. ★ ORAZ: `aiRoleGuard.isActionBlocked`
#   zna WYLACZNIE `CREATE_DRAFT_*`, `GENERATE_REPORT`, `PREPARE_DECISION_SUMMARY`
#   i `SUGGEST_ROADMAP_CHANGE` (:96-100), a `ACTION_TYPES` ma osiem nazw
#   (aiActionExecutor.ts:29-38). Nazwy narzedzi (`create_task`, `update_task`,
#   `schedule_meeting`, `create_notebook_entry`, `generate_report_section`,
#   `query_structured_data`) NIE MAJA tam odpowiednika — mapowanie nazw jest
#   Twoja decyzja projektowa i ma byc wypisane w tabeli, nie zgadniete.

# (W8) ★★ CZY `executeToolCall` MA AUDYT — zamowienie twierdzi, ze tak
sed -n '573,582p' server/src/services/ai/toolDefinitions.ts
grep -n "audit\|Audit" server/src/services/ai/toolDefinitions.ts | head
grep -n "ensureRunForAction\|recordAIRunEvent\|recordLegacyAuditSafely" server/src/services/aiActionExecutor.ts | head
#   oczekiwane: `executeToolCall` ma WYLACZNIE `logger.info` (:578) i ZERO audytu.
#   Audyt zyje gdzie indziej: `aiRunLedgerService` (`ensureRunForAction` :198,
#   `recordAIRunEvent` :237, `recordLegacyAuditSafely` :407), wolany z
#   aiActionExecutor. ★ Zdanie "wykonuje sie executeToolCall z pelnym audytem"
#   jest wiec DZIS FALSZYWE — audyt albo dziedziczysz z tamtej sciezki, albo
#   budujesz WOKOL executora. Napisz w raporcie, ktora droga poszedles.

# (W9) ★★ WZORZEC "WYWOLANIE NARZEDZIA, KTORE SIE NIE WYKONUJE" — JUZ ISTNIEJE I JEST ZYWY
sed -n '4800,4855p' server/src/routes/ai.routes.ts
sed -n '1265,1300p' server/src/services/ai/llmService.ts
grep -n "ENABLE_TERESA_IDEA_ACTIONS" server/src/config/FeatureFlags.ts
#   oczekiwane: blok `ideaTools` w trasie z komentarzem WPROST: "ich wywolanie NIE
#   wykonuje sie tu ... emitujemy SSE `idea_action`, a front wykonuje je" oraz
#   "Nie twierdzimy tu, ze akcja sie wykonala" (ai.routes.ts:4804-4845); po stronie
#   llmService rodzina `clientTools` (:1271-1300) z `execute` wolajacym
#   `onClientToolCall` ZAMIAST `mcpServer.execute`, plus regula pierwszenstwa
#   `if (streamToolDefinitions[def.name]) continue;` (:1279).
#   ★ To jest gotowy ksztalt dla R1: narzedzie w petli, ktore NIE mutuje, tylko
#   zglasza. Roznica: `idea_action` wykonuje sie na froncie AUTOMATYCZNIE, a Twoja
#   propozycja ma czekac na klik. Nazwij te roznice w raporcie.

# (W10) SIEDEMNASCIE TYPOW AKCJI — ile z nich ma PRODUCENTA (a nie tylko handler)
sed -n '9,27p' src/types/domain/chatActions.ts
grep -n "case '" src/services/chatActionHandler.ts | wc -l
for A in NAVIGATE CREATE_TASK CREATE_DECISION CREATE_INITIATIVE GENERATE_REPORT \
         GENERATE_PRESENTATION USE_TEMPLATE BROWSE_TEMPLATES START_TOOL OPEN_PREVIEW \
         ASSIGN_INTERVIEW RECORD_KPI START_ARTIFACT_REVIEW CHECK_TRUST_STATE \
         ANALYZE_STATEMENT REVIEW_MODEL CHECK_LANE_STATUS; do
  printf '%-24s %s\n' "$A" "$(grep -rn "'$A'" src --include=*.ts --include=*.tsx \
    | grep -v 'types/domain/chatActions.ts' | grep -v 'chatActionHandler.ts' \
    | grep -v 'useActionHandler.ts' | wc -l | tr -d ' ')"
done
#   oczekiwane: typow jest 17, handler obsluguje WSZYSTKIE, a poza handlerem i
#   rejestrem wiekszosc ma `0` trafien. To jest miara "widma": handler je zna,
#   nic ich nie produkuje. Podaj liczbe Z MIANOWNIKIEM (np. `2 z 17 maja producenta`).

# (W11) ★ CZY CHIPY SUGESTII W OGOLE UNIOSA TE CZTERY AKCJE — sprawdz TYPY, nie intencje
sed -n '28,48p' src/components/Chat/ChatSmartSuggestions.tsx
sed -n '52,74p' src/hooks/useChatActions.ts
sed -n '2716,2800p' src/components/AIChat/UnifiedChatPanel.tsx
#   oczekiwane: `ChatSuggestionAction = NavigateAction | ChatInjectAction`
#   (ChatSmartSuggestions.tsx:33) — typ NIE DOPUSZCZA `ChatActionPayload`, wiec
#   GENERATE_REPORT nie przejdzie kompilacji bez poszerzenia; `useChatActions`
#   buduje `deps: ActionHandlerDeps = { navigate, context: {} }` (:63) — BEZ
#   `onOpenReportBuilder`, `onOpenPresentationWizard`, `onOpenKpiDrawer` i BEZ
#   `projectId`, wiec kazda z czterech akcji spadnie do surowego `navigate`;
#   a jedynym producentem jest `chatSuggestions` useMemo w UnifiedChatPanel
#   (ok. :2716), bramkowany `aiConfig.chatSuggestionsEnabled` (D-104) i
#   `displayMessages.length >= 2 && !isStreaming`, z DWIEMA rodzinami wpisow.
#   To sa trzy konkretne dziury do zalatania w R2, a nie "dodaj chip".

# (W12) ★★ PendingActionsIndicator — ZERO MONTAZU, ALE ISTNIEJE ZASTANA ASERCJA NA TEN BRAK
grep -rn "PendingActionsIndicator" src tests --include=*.ts --include=*.tsx
sed -n '525,533p' tests/unit/backend/wave6ContextLearningService.test.ts
#   oczekiwane: zero importow w `src` poza wlasnym plikiem ORAZ
#   `expect(chat).not.toContain('<PendingActionsIndicator')` w
#   tests/unit/backend/wave6ContextLearningService.test.ts (ok. :529).
#   ★ To znaczy, ze "wreszcie zamontowany" ZLAMIE ZASTANY TEST. Masz dwie legalne
#   drogi (R2d) i obie wymagaja jawnego wpisu do raportu — cichego obejscia nie ma.

# (W13) MARTWY KOD — zmierz IMPORTERY, nie obecnosc pliku
grep -rn "useActionHandler" src tests --include=*.ts --include=*.tsx
grep -rn "ai/aiContextBuilder" server/src tests --include=*.ts | grep -v _backup
#   oczekiwane: `useActionHandler` ma ZERO importerow (trafienia w AppRoutes.tsx:728
#   i presentationWizardRedirect.ts:11 to KOMENTARZE, nie importy — sprawdz to
#   oczami) → wolno go usunac. ★ ALE `server/src/ai/aiContextBuilder.ts` ma JEDNEGO
#   importera i jest nim TEST: tests/unit/backend/legacyAiContextBuilder.test.ts:44.
#   To NIE jest "zero importerow" z zamowienia — patrz K9 i licencja wyjatku.

# (W14) CELE DLA CZTERECH PRODUCENTOW — sprawdz, dokad naprawde prowadza dzis
sed -n '167,200p' src/services/chatActionHandler.ts
sed -n '282,300p' src/services/chatActionHandler.ts
grep -n "'/decks/from-template'" server/src/routes/presentations*.routes.ts
grep -rn "BENEFITS: '/benefits'\|ROUTES.BENEFITS" src/routes/routeConfig.ts src/routes/AppRoutes.tsx | head -5
#   oczekiwane: GENERATE_REPORT prowadzi dzis do `/reports/builder?new=1`
#   (chatActionHandler.ts:167-180) — a NIE do Studia Dokumentow z dyzuru 195;
#   GENERATE_PRESENTATION do `/presentations?new=1` (:182), podczas gdy kanoniczne
#   wejscie 186/201 to `/prezentacje?templateArtifactId=...` -> POST
#   /presentations/decks/from-template; RECORD_KPI do `/benefits?kpi=` (:282),
#   a `/benefits` jest dzis PRZEKIEROWANIEM na `/results` (AppRoutes.tsx:2854-2863).
#   ★ "Dobudowac producenta" znaczy wiec takze POPRAWIC CEL, nie tylko dodac chip.

# (W15) FLAGA I ZALEZNOSC OD 206 — zmierz, czy petla READ w ogole istnieje na Twojej bazie
grep -rn "ENABLE_TERESA_TOOL_LOOP" server/src src || echo "FLAGA 206 NIE ISTNIEJE NA TEJ BAZIE"
grep -rn "ENABLE_TERESA_TOOL_LOOP_WRITE" server/src src || echo "FLAGA 207 NIE ISTNIEJE — zgodnie z oczekiwaniem"
grep -n "ENABLE_TERESA_RETRIEVAL" server/src/config/FeatureFlags.ts
#   oczekiwane: OBIE flagi nieobecne. ★ Wniosek: dyzur 206 NIE JEST scalony na
#   Twojej bazie, wiec 207 NIE MOZE zakladac istnienia petli READ. Twoj zakres to
#   narzedzia ZAPISUJACE w petli, ktora ISTNIEJE DZIS (CHAT_CREATION_TOOLS) —
#   niezaleznie od tego, czy 206 wejdzie przed Toba, czy po Tobie. Jesli flaga 206
#   jednak istnieje, wpisz to do raportu i NIE dotykaj jej zachowania.
#   Wzorzec zapisu flagi 1:1 z ENABLE_TERESA_RETRIEVAL: wpis w `FeatureFlagsSchema`
#   (FeatureFlags.ts:34, `z.boolean().default(false)`) + wpis w bloku ladujacym (:147).
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day207-write-proposal-20260831` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6147`. Twój JEDYNY port harnessu to `5086 i 5087`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day207-pg`**. **ZAKAZANE:** `6012, 5433, 6047, 6054-6146, 5010-5085, 6404-6411 (zajete przez wczesniejsze dyzury i odbiory nadzorcy). ★★ W SZCZEGOLNOSCI ZAJETE SA 6145-6146 oraz 5080-5085 — NIE bierz ich, mimo ze sasiaduja z Twoim przydzialem (6146/5084-5085 to dyzur 206, ktory moze biec rownolegle). ★★ ZAREZERWOWANE NA PRZOD, NIE BIERZ: 6148-6149 oraz 5088-5091 (dyzury 208-209). Twoj WYLACZNY przydzial to baza `6147` i harness `5086 i 5087` — nic wiecej. ★ PORT 5000 ZAJETY NA STALE przez macOS Control Center. ★ PORT 5037 ZAJETY przez `adb` (serwer Androida). ★ PORTY 5060-5061 ZAJETE. ★ Ta lista jest rozkazem pomiarowym, nie gwarancja — zweryfikuj `lsof -i` i `docker ps` przed startem i wpisz wynik `X z 3` do raportu`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `★★ TAK — POZYCJA R1 JEST W CALOSCI BRAMKOWANA FLAGA: `ENABLE_TERESA_TOOL_LOOP_WRITE`, DOMYSLNIE OFF, do akceptu wlasciciela na zrzutach (`CLAUDE.md` §7 i §9: zakaz masowego wlaczania, jeden ekran po drugim, akcept na CZYSTYM zrzucie). ★★ TO JEST FLAGA OSOBNA OD `ENABLE_TERESA_TOOL_LOOP` z dyzuru 206 — nie wolno ich laczyc, nie wolno czytac jednej przez druga, nie wolno uzaleznic zapisu od tego, czy READ jest wlaczony. Zapis i odczyt to dwie rozne zgody wlasciciela. Dwa miejsca do dopisania w `server/src/config/FeatureFlags.ts`: wpis w `FeatureFlagsSchema` (wzorzec `ENABLE_TERESA_RETRIEVAL` `:34`, `z.boolean().default(false)`) i wpis w bloku ladujacym (wzorzec `:147`, `process.env.ENABLE_TERESA_TOOL_LOOP_WRITE === 'true'`). ★★ FLAGA MA BYC DOWIEDZIONA ZACHOWANIEM, NIE ISTNIENIEM POLA: w tym programie odnotowano flagi-fantomy, wiec test przy OFF ma dowodzic, ze `create_task` z czatu NADAL PISZE DO BAZY OD RAZU (bo taka jest dzisiejsza prawda — patrz `POZYCJE_RDZENIA` R1), a przy ON — ze NIE PISZE i produkuje wiersz propozycji. ★★ DRUGA FLAGA, KTOREJ NIE DOTYKASZ: `ENABLE_TERESA_RECORD_CREATE` ma `z.boolean().default(true)` (`FeatureFlags.ts:51`) — jest DOMYSLNIE WLACZONA i to ona przepuszcza dzis `create_task`/`create_decision` do modelu w czacie. Nie zmieniasz jej wartosci domyslnej ani semantyki; Twoja flaga dziala OBOK niej, nie zamiast. ★ Pozycja R2 (producenci czterech akcji) NIE MUSI byc za flaga zapisu — akcje `USE_TEMPLATE`/`BROWSE_TEMPLATES`/`GENERATE_REPORT`/`GENERATE_PRESENTATION`/`RECORD_KPI` w wariancie chipa sa NAWIGACYJNE (otwieraja ekran, nie mutuja bazy). Rozstrzygnij JAWNIE, czy chipy ida za wlasna flaga, czy za istniejacym przelacznikiem `aiConfig.chatSuggestionsEnabled` (D-104), i uzasadnij; domyslna rekomendacja nadzorcy: reuzyj D-104, nie mnoz flag`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**` (w szczegolnosci `verifyToken` i `requireActiveChatMembership` na `/chat/stream`), `server/src/services/aiRoleGuard.ts` (`isActionBlocked` `:91`), `server/src/services/chatPermissionService.ts` (`checkChatPermission`, `canChat`), `server/src/services/aiPolicyEngine.ts` (`ACTION_POLICY_REQUIREMENTS` `:38-47`, `canPerformAction`), `server/src/services/ai/chatPolicyGateway.ts`, `server/src/services/ai/webSearchGovernance.ts`, `server/src/services/ai/sideEffectTools.ts` (lista aprobat dla planow), `server/src/services/ai/toolCostEstimates.ts` (cennik + `UnknownToolCostError`), `server/src/services/v8/agentResourceGovernanceService.ts`, `server/src/services/aiRunLedgerService.ts` (audyt), `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*`. ★★ ZADNEJ Z NICH NIE ZMIENIASZ — propozycja ma przez nie PRZECHODZIC, nie omijac ich i nie poszerzac. ★★ W SZCZEGOLNOSCI: strazniki poufnosci na sciezce czatu (E1-E3, fail-closed w trzech punktach — architektura §2) sa NIETYKALNE; propozycja zapisu nie moze niesc do UI ani jednego bajtu tresci, ktorej wolajacy nie widzialby bez niej`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY207_WRITE_PROPOSAL_REPORT.md`. Nie zmieniasz zadnego `MODULE_ACCEPTANCE.md`. Uzasadnienie do potwierdzenia albo obalenia przez Ciebie w raporcie: `docs/program/waves/WAVE_03_ACCEPTANCE/modules/13_CHAT/MODULE_ACCEPTANCE.md` jest dzis rejestrem uwag wlasciciela do POWIERZCHNI WIZUALNEJ czatu (wiersze `CHAT-OWN-*`), a status i tak pozostaje `NOT_PROVEN` do akceptu wlasciciela na zrzutach — dopisanie wiersza byloby tworzeniem nowego stanu w rejestrze, ktorego nikt nie zamowil. ★ Jedyny inny dokument do zmiany: `docs/program/funkcje/ARCHITEKTURA_AGENTA_TERESY.md` — DOPISUJESZ nowy rozdzial `Wykonanie — 17-C (Day207)` na KONCU pliku, z ANEKSEM `mapa widm` (tabela z R3), i w wierszach `P1` oraz `P5` tabeli §3 dopisujesz WYLACZNIE ODSYLACZ do tego rozdzialu. ★★ NUMER ROZDZIALU USTALASZ POMIAREM, NIE Z INSTRUKCJI: `grep -n '^## ' docs/program/funkcje/ARCHITEKTURA_AGENTA_TERESY.md` — dzis plik konczy sie na `## 9`, ale dyzur 206 dopisuje `## 10`, wiec Twoj numer zalezy od tego, czy 206 wszedl przed Toba. Bierzesz NASTEPNY wolny numer i wpisujesz do raportu, ktory to byl i dlaczego. ★★ ZAKAZ zmiany tresci ogniw `P2`, `P3`, `P4`, §4 (werdykt o dwoch swiatach agentowych), §6 (scenariusz GF-AGT-02), §8 (decyzje wlasciciela) i §9 — to jest dokument ZAAKCEPTOWANY przez wlasciciela, a nie Twoj brudnopis. §8 pkt 2 zostawiasz jak jest, nawet jesli `D-15` na nie odpowiada — odpowiedz zapisujesz w SWOIM rozdziale jako korekte. Jesli Twoj pomiar obala ktores zdanie karty (a co najmniej cztery sa do obalenia — patrz `DLACZEGO`), zapisujesz to jako KOREKTE w swoim rozdziale i zglaszasz nadzorcy, a nie nadpisujesz zdania wlasciciela. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day207-write-proposal-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day207-write-proposal-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **PETLA READ Z DYZURU 206 JEST NIETYKALNA — poza rozszerzeniem rejestru.** Jesli na Twojej bazie istnieje `ENABLE_TERESA_TOOL_LOOP` albo rodzina narzedzi READ, NIE zmieniasz jej zachowania, nie zmieniasz jej domyslki, nie uzalezniasz swojej flagi od jej stanu. Wolno Ci WYLACZNIE dopisac swoja rodzine obok. ★ Zmierz to (`W15`): jesli flagi 206 nie ma, Twoj dyzur jest od niej NIEZALEZNY i tak ma zostac. ★★ **ZAKAZ BUDOWY PIATEGO MECHANIZMU PROPOZYCJI.** W czacie sa juz CZTERY (`W4`). Wybierasz JEDEN z istniejacych i uzasadniasz liczbami; jesli uznasz, ze zaden nie pasuje, to jest **STOP MERYTORYCZNY pozycji z opisem**, a nie piaty mechanizm. ★★ **`agentPlannerService.ts` i `wave8AgentRuntimeService.ts` NIETYKALNE poza odczytem.** Cykl planow zostal utwardzony dyzurami 164-180, a architektura §4 rozstrzygnela, ze OBA swiaty agentowe zostaja. Ten dyzur ich nie scala, nie upraszcza i nie porzadkuje przy okazji. ★★ **`sideEffectTools.ts` NIETYKALNY** — nie dopisujesz i nie usuwasz z niego ani jednej nazwy; ta lista jest bramka aprobat dla PLANOW i zmiana w niej uderza w cykl, ktorego nie dotykasz. ★★ **NIE ZMIENIASZ SEMANTYKI WSPOLNEGO REJESTRU MCP** (`mcpServer.ts`) ani cennika `toolCostEstimates.ts`. ★★ **ZAKAZ KASOWANIA TYPOW AKCJI CZATU.** Zadnego z 17 typow w `src/types/domain/chatActions.ts` ani zadnego `case` w `chatActionHandler.ts` nie usuwasz w tym dyzurze — `D-15` mowi `mapowac, nie kasowac`. Mapa z R3 jest DOKUMENTEM, nie commitem kasujacym. ★★ **STRAZNIK POUFNOSCI NIETYKALNY** (E1-E3, fail-closed w trzech punktach). Karta propozycji nie moze niesc do UI ani jednego bajtu tresci, ktorej wolajacy nie zobaczylby bez niej — surowe wyniki narzedzi i tresci dokumentow NIE wchodza do SSE ani do payloadu karty. ★★ **`ARCHITEKTURA_AGENTA_TERESY.md` §1-§9 NIETYKALNE** — dokument zaakceptowany przez wlasciciela; dopisujesz WYLACZNIE nowy rozdzial na koncu i dwa odsylacze w tabeli §3. ★★ **LICENCJA WYJATKU (jedyna w tym dyzurze) — usuniecie `server/src/ai/aiContextBuilder.ts` RAZEM z jego jedynym testem `tests/unit/backend/legacyAiContextBuilder.test.ts` jest DOZWOLONE** i jest jawnym wyjatkiem od zakazu usuwania zastanych testow, PONIEWAZ ten test testuje wylacznie usuwany plik i po usunieciu pliku nie ma czego testowac. Warunki: (1) potwierdzisz pomiarem, ze poza tym testem nie ma zadnego innego importera; (2) usuwasz OBA pliki w JEDNYM commicie z jawnym uzasadnieniem w tresci commita; (3) wpisujesz to do raportu jako `wyjatek wykorzystany`. Jesli warunek (1) nie zachodzi — NIE usuwasz i wpisujesz do mapy R3. **Ten wyjatek NIE rozciaga sie na zaden inny plik ani test.** ★★ **`Z15` OBOWIAZUJE — MODELU NIE WOLASZ.** Dowody tego dyzuru (propozycja→zgoda→wykonanie→audyt, mutacje per ogniwo, zrzut karty) NIE wymagaja modelu: wywolanie narzedzia wstrzykujesz w tescie. ★ ZNIESIENIE WARUNKOWE, wylacznie dla pozycji dowodowej `R1g` i wylacznie jesli sam uznasz, ze bez modelu nie da sie dowiesc, ze model FAKTYCZNIE nie wykonal mutacji: budzet **DOKLADNIE DWA PRZEBIEGI** (przebieg 1 flaga ON, przebieg 2 flaga OFF jako mutacja), **SUFIT 5 RUND MODELU W CALYM DYZURZE**, jednostka limitu to PRZEBIEG (jedna tura czatu), nie runda wewnatrz tury — bo `stopWhen: stepCountIs(4)` (`llmService.ts:1343`) z definicji oznacza do czterech rund na ture. Zakaz ponawiania: przebieg nieudany = **STOP pozycji z opisem**, nie trzeci przebieg. Licencja na klucz: plik `~/.consultify-openrouter` (jedna linia `OPENROUTER_API_KEY=<wartosc>`), **jedyna dozwolona komenda zrodlowa: `set -a; . ~/.consultify-openrouter; set +a`** — nie kopiujesz tego pliku, nie przenosisz go do repozytorium, nie wpisujesz jego tresci do `.env`, `docker-compose*` ani do zadnej komendy. **`Z40` bez wyjatku: wartosc klucza nie pojawia sie NIGDZIE** — pokazujesz wylacznie `obecny`/`nieobecny` (`env | sed 's/=.*//' | grep -x 'OPENROUTER_API_KEY'`). Wpisujesz do raportu nazwe modelu (nigdy klucza) i ZMIERZONA liczbe rund z logu, nie deklarowana. Jesli nie skorzystasz ze zniesienia — napisz w raporcie WPROST `modelu nie wolalem`, bo to jest wynik, nie brak. ★★ **ZAKAZ WYMUSZANIA WYBORU NARZEDZIA**, jesli jednak wolasz model: zakaz podawania nazw narzedzi w promptcie i zakaz per-turowej dyrektywy `MUSISZ wywolac X` (taki wzorzec ISTNIEJE w kodzie — `AIPipeline.ts:414-427`, intencja `table` — i jest tu ZAKAZANY). ★★ **`Z31` — ZAKAZ PINOWANIA STRAZNIKA REALDB DO HOSTA, PORTU ALBO NAZWY BAZY.** Wolasz `await assertRealPostgresTestEnvironment()` BEZ ARGUMENTOW, w szczegolnosci bez `expectedDatabase`; zakaz asercji na `DATABASE_URL`, na porcie i na nazwie kontenera. Powod: dyzur 43 przypial straznika do swojej bazy i po usunieciu kontenera **30 przypadkow dowodowych stalo sie trwalym `SKIP`** przy `exit 0`; w programie odnotowano SZESC takich incydentow, a dyzur 193 zamowiono wylacznie po to, zeby je zbiorczo odpiac (`97187267a0 fix(day164): unpin Z31 DATABASE_URL assertion to any local Postgres`). Nie dokladaj siodmego. ★★ **`Z29` — DOWOD MUTACYJNY W OBIE STRONY, PER OGNIWO**: flaga (OFF→zapis natychmiastowy jak dzis; ON→brak zapisu i wiersz propozycji), zgoda (bez `Zatwierdz` mutacja NIE nastepuje), uprawnienia (rola bez prawa → odmowa, nie cicha zgoda), audyt (brak wpisu = czerwony test). ★★ **ZAKAZ RETRY W TESTACH BEZPIECZENSTWA** — w tym programie zmierzono wektor systemowy, w ktorym test izolacji leczy sie skutkiem wlasnego ataku; kazde `X/X PASS` bez asercji na NIEOBECNOSC imiennie zaseedowanego rekordu i bez dowodu mutacyjnego jest podejrzane z urzedu. ★★ **DOWODEM BRAKU ZAPISU JEST STAN BAZY, NIE BRAK LOGU** — asercja ma liczyc wiersze w `tasks`/`decisions` przed i po turze i pokazywac `0 nowych`, a nie stwierdzac, ze `nie widzialem wpisu`. ★★ **Sprzatanie kontenera: `docker rm -f -v`** — z flaga `-v`, inaczej wolumen zostaje na dysku. ★★ **`Z27` — zakaz `git stash`** w kazdej postaci; dowody mutacyjne przez `cp` do `/private/tmp/cx-day207-write-proposal-scratch` i powrot przez `cp` (schowek jest wspoldzielony miedzy worktree). ★★ **Zero polaczen do bazy zdalnej, demo, stagingu i produkcji** (`Z28`). ★★ **Zakaz naprawiania przez wyciszanie** (`@ts-ignore`, `.skip`, poszerzanie `exclude`, `--no-verify`) i zakaz usuwania zastanych testow poza jedynym wyjatkiem opisanym wyzej — asercje wolno ZMIENIC z uzasadnieniem, nie skasowac. ★ Uwaga plikowa: `server/src/services/aiActionExecutor.ts` ma w pierwszej linii `// @ts-nocheck` — jesli w nim pracujesz, typy Cie NIE OSLONIA i masz to odnotowac w raporcie jako podjete ryzyko. ★ **Zrzuty: pomiar `mean_luma` kazdego, para jasny/ciemny >150 roznicy** — bez wyjatku; duplikat obrazu zamiast drugiego motywu przechodzi `shasum`, bo plakietka zmienia SHA (policzony ksztalt falszywego gotowe, znana przyczyna: motyw ustawiany po hydratacji, naprawa przez `addInitScript`). ★ **`Z13`:** logi, dzienniki przebiegu, zrzuty i wyjscia bramek NIE wchodza do repo — leza w `/private/tmp/cx-day207-write-proposal-artefakty`, a raport podaje sciezki i `shasum -a 256`. ★ **`§0.4a` — pomiar zasiegu testow jest warunkiem oddania raportu** (`Z24`); zawezony wybor albo przepisanie cudzej liczby to zawyzenie i podstawa odrzucenia. ★ **NOWE pliki w `tests/` wymagaja `git add -f`.** | Wlasciciel zaakceptowal architekture modulu 17 (`docs/program/funkcje/ARCHITEKTURA_AGENTA_TERESY.md`, `status: canonical`, 31.08.2026). §3 wymienia piec przerwanych ogniw; `P1` dzieli sie w §7 na `17-B tool-loop READ` (dyzur 206) i `17-C tool-loop WRITE-as-proposal + zgaszenie widm (P1b+P5)` — to jest dyzur 207. `P5` brzmi: `15/17 akcji czatu to widma — handler je zna, nic ich nie produkuje (w tym GENERATE_REPORT); +2 stuby narzedzi; +trzeci dispatcher bez importerow; +update_assessment_score poza filtrem`, a §8 pkt 2 pytal wlasciciela, ktore z 15 widm dobudowac i czy `reszte usunac`. ★★ ODPOWIEDZ WLASCICIELA (`D-15`) ZMIENIA TRESC ZAMOWIENIA: `Agent ma obejmowac prace ze WSZYSTKIMI narzedziami aplikacji i nimi zarzadzac` — wiec widma NIE sa kasowane hurtem, tylko MAPOWANE na realne narzedzia aplikacji; usuniecie jest wyjatkiem wymagajacym POWODU per pozycja, nie regula. ★★ POMIAR WYKONANY PRZY PISANIU TEJ INSTRUKCJI NA SHA `91e02b8ea8` ZMIENIA TRESC ZAMOWIENIA W SIEDMIU MIEJSCACH — wszystkie masz OBALIC albo POTWIERDZIC: (K1) `8 z SIDE_EFFECT_TOOLS + query_structured_data` to blad arytmetyczny zamowienia: `query_structured_data` JEST jedna z tych osmiu (`sideEffectTools.ts:22`); narzedzi zapisujacych jest OSIEM, nie dziewiec. (K2) Z tych osmiu model w czacie widzi DZIS DWA — `create_task` i `create_decision`, przepuszczone przez `CHAT_CREATION_TOOLS` (`AIPipeline.ts:366-375`) za flaga `ENABLE_TERESA_RECORD_CREATE`, ktora ma `default(true)` (`FeatureFlags.ts:51`) — czyli JEST WLACZONA. I one PISZA DO BAZY OD RAZU: `tools/createTask.ts:334` samo-bramkuje sie tylko na flage (`:343`) i wola `TaskExecutor.execute`. To jest ogniwo `P2` (`trzecia droga poza kanonem`) i jest ZYWE NA DOMYSLNYCH USTAWIENIACH. Pozostalych szesc narzedzi zapisujacych jest z czatu nieosiagalnych w ogole, a w swiecie planow MAJA juz bramke `awaiting_approval`. Realny zakres R1 to zatem: dwa narzedzia zywe do obramowania + swiadoma decyzja, ile z pozostalych szesciu wpuscic. (K3) ★ `create_task`/`create_decision` istnieja w OBU rejestrach, pod ta sama nazwa i z ROZNYMI implementacjami: MCP (`tools/index.ts:43-44`, pliki `tools/createTask.ts`/`createDecision.ts`) i `AI_TOOLS` (`toolDefinitions.ts:700-701`, executor `:719`). Zdanie zamowienia `po Zatwierdz wykonuje sie executeToolCall` oznacza wiec wykonanie INNEGO KODU niz ten, ktory model wywolal. Ta sama klasa kolizji, co `search_knowledge_base` w 206 — rozstrzygnij ja jawnie. (K4) ★★ MECHANIZMOW PROPOZYCJI W CZACIE JEST CZTERY, NIE JEDEN, i ten wskazany w zamowieniu jest do tego zadania NAJGORSZY: `chatHandoffService`/`chatTargetMappingService` (dyzury 179/195) pinuje BAJTY WIADOMOSCI czatu i materializuje ARTEFAKT, a jego `TARGET_KINDS` to zamknieta lista `['document','presentation','workbook','material']` (`handoffSpineService.ts:49-50`) — nie ma w niej `task` ani `decision`, i sam plik pisze o sobie, ze `deliberately has NO materialize endpoint`. To jest mechanizm WIADOMOSC→ARTEFAKT, nie WYWOLANIE-NARZEDZIA→MUTACJA. (K5) ★★ NATOMIAST mechanizm `ai_actions` jest DOKLADNIE tym, czego ten dyzur potrzebuje, i jest ZBUDOWANY OD KONCA DO KONCA — POZA PRODUCENTEM: `requestAction` (`aiActionExecutor.ts:295`) konsultuje RegulatoryModeGuard, `AIRoleGuard.isActionBlocked` (`:326`), `AIPolicyEngine.canPerformAction` (`:344`) i wzorce aprobat, pisze wiersz `ai_actions`, emituje do watku wiadomosc `execution_proposal` i prowadzi audyt przez `aiRunLedgerService`; front ma gotowa karte (`MessageRenderer.tsx:619-647` → `ExecutionProposalMessage.tsx`) i gotowe handlery approve/reject (`UnifiedChatPanel.tsx:6009`, `:6060`). A `requestAction` NIE MA ANI JEDNEGO WOLACZA PRODUKCYJNEGO — jedyny to `createDraft` w tym samym pliku (`:544`) i trasa `POST /ai/actions/draft` (`ai.routes.ts:6787`), ktora nie ma wolacza po stronie frontu. To jest wzorzec `biblioteka bez wywolania` — ten sam, ktory 206 znalazl w `AI_TOOLS`. Jesli to potwierdzisz, dyzur 207 jest PIERWSZYM momentem, w ktorym cokolwiek w tym produkcie tworzy propozycje zapisu z czatu. (K6) ★ WZORZEC `wywolanie narzedzia, ktore sie NIE wykonuje` juz istnieje i JEST ZYWY: `ENABLE_TERESA_IDEA_ACTIONS` (default ON) → `clientTools` w `callStream` (`llmService.ts:1271-1300`), ktorych `execute` wola `onClientToolCall` zamiast `mcpServer.execute`, → `emitSSE({type:'idea_action'})` (`ai.routes.ts:4843`), z komentarzem w kodzie: `Nie twierdzimy tu, ze akcja sie wykonala`. Kopiujesz KSZTALT, nie budujesz go od zera; roznica polega na tym, ze `idea_action` wykonuje sie na froncie automatycznie, a Twoja propozycja czeka na klik. (K7) ★ `executeToolCall` NIE MA AUDYTU — ma jeden `logger.info` (`toolDefinitions.ts:578`) i nic wiecej; zdanie zamowienia `wykonuje sie executeToolCall z pelnym audytem` jest dzis falszywe i masz je skorygowac, a nie powielic. ★ Czwarty pomiar do P5: `PendingActionsIndicator` ma ZERO montazu w `src`, ale istnieje ZASTANA ASERCJA na ten brak (`tests/unit/backend/wave6ContextLearningService.test.ts` ok. `:529`: `expect(chat).not.toContain('<PendingActionsIndicator')`) — `wreszcie zamontowany` zlamie zastany test, wiec to jest DECYZJA, nie oczywistosc. ★ Piaty: `useActionHandler.ts` ma ZERO importerow (trafienia w `AppRoutes.tsx:728` i `presentationWizardRedirect.ts:11` to komentarze), ale `server/src/ai/aiContextBuilder.ts` ma JEDNEGO importera i jest nim test (`tests/unit/backend/legacyAiContextBuilder.test.ts:44`) — `zero importerow` z zamowienia jest wiec prawda dla jednego z dwoch dubletow, nie dla obu |

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
cd /private/tmp/cx-day207-write-proposal

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day207-pg psql -U postgres -d cx207 \
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
cd /private/tmp/cx-day207-write-proposal

docker run -d --name cx-day207-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx207 \
  -p 127.0.0.1:6147:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day207-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6147/cx207 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6147/cx207 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day207-write-proposal && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6147/cx207 \
JWT_SECRET=cx207-test-secret-do-not-reuse \
npx vitest run server/src/services/ai/__tests__ oraz server/src/services/__tests__ oraz tests/unit/backend oraz tests/integration oraz tests/components/AIChat --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day207-write-proposal-artefakty/day207-teresa-write-as-proposal.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day207-write-proposal && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/services/ai/__tests__ oraz server/src/services/__tests__ oraz tests/unit/backend oraz tests/integration oraz tests/components/AIChat --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day207-write-proposal-artefakty/day207-teresa-write-as-proposal.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day207-write-proposal/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day207-pg psql -U postgres -d cx207 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day207-pg`.
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
> **(e) ★★ **Pierwsza, najgrozniejsza: `propozycja zamiast zapisu` udowodniona na narzedziu, ktore i tak nigdy nie pisalo.** Szesc z osmiu narzedzi zapisujacych jest z czatu NIEOSIAGALNYCH (`W1`), a w swiecie planow MAJA juz bramke `awaiting_approval`. Jesli napiszesz test, w ktorym `schedule_meeting` `nie wykonalo sie` — udowodnisz stan zastany, nie swoja naprawe. **Dowod ma dotyczyc narzedzia, ktore DZIS pisze bez zgody**, czyli `create_task` albo `create_decision` z rejestru MCP, i ma pokazywac ROZNICE zachowania miedzy OFF a ON na tej samej turze. ★★ **Druga: dwie implementacje `create_task` pod jedna nazwa.** MCP (`tools/index.ts:43`, plik `tools/createTask.ts` → `TaskExecutor.execute`) i `AI_TOOLS` (`toolDefinitions.ts:700-701` → `executeCreateTask` `:719`). Model w czacie wola DZIS te pierwsza. Jesli po `Zatwierdz` zawolasz `executeToolCall`, wykonasz te druga — inna walidacja, inne pola, byc moze inny ksztalt rekordu — i **udowodnisz cykl w kodzie, ktory nie biegl**. Reguly pierwszenstwa w `callStream` (`if (streamToolDefinitions[def.name]) continue;` `llmService.ts:1279`, `mcp ma pierwszenstwo`) NIE rozstrzygaja tego za Ciebie; to jest wejscie do decyzji, nie decyzja. Zapisz rozstrzygniecie jednym cytowalnym zdaniem. ★★ **Trzecia: `wolacz istnieje != renderuje sie` — ale tu jest odwrotnie, i to jest pulapka o innym ksztalcie.** Karta propozycji JEST juz zamontowana i wpieta (`MessageRenderer.tsx:619-647`), a brakuje PRODUCENTA (`requestAction` bez wolaczy, `W5`). Latwo wiec zbudowac producenta i uznac, ze skoro karta `istnieje`, to sie pokaze. Nie pokaze sie sama: wiadomosc `execution_proposal` musi trafic do watku, ktory front CZYTA — sprawdz, czy czyta go po SSE w tej samej turze, czy dopiero po przeladowaniu konwersacji, i **jesli dopiero po przeladowaniu, to jest defekt do nazwania, a nie `dziala`**. Uzytkownik, ktory poprosil o zadanie i nie widzi karty do konca tury, dostal produkt, ktory milczy. ★★ **Czwarta: mechanizm z zamowienia nie ma miejsca na `task`.** `TARGET_KINDS` w `handoffSpineService.ts:49-50` to zamknieta lista czterech rodzajow ARTEFAKTOW; `chatHandoffService` pisze o sobie, ze `deliberately has NO materialize endpoint`, a materializacja artefaktow siedzi w `chatTargetMappingService`. Proba `reuzycia` tego mechanizmu dla `create_task` konczy sie albo poszerzeniem zamknietej listy (zmiana kontraktu miedzy pasami, ktorej ten dyzur nie ma licencji zrobic), albo udawaniem, ze zadanie jest dokumentem. **Zmierz to ZANIM zaczniesz pisac** — to jest najdrozszy blad, jaki mozesz tu popelnic. ★★ **Piata: `pelny audyt` bierze sie z wyboru sciezki, nie z wywolania executora.** `executeToolCall` ma jeden `logger.info` i zero audytu (`toolDefinitions.ts:578`); `aiActionExecutor` ma pelny ledger (`ensureRunForAction`, `recordAIRunEvent`, `recordLegacyAuditSafely`). Jesli wybierzesz sciezke `wolam executeToolCall po zgodzie`, audyt musisz DOBUDOWAC i to jest praca, ktorej zamowienie nie widzialo. Policz ja, zanim obiecasz. ★★ **Szosta: zastana asercja na NIEobecnosc `PendingActionsIndicator`.** `tests/unit/backend/wave6ContextLearningService.test.ts` (ok. `:529`) sprawdza `expect(chat).not.toContain('<PendingActionsIndicator')`. Zamontowanie komponentu zlamie ten test. Masz dwie legalne drogi: (a) montujesz i ZMIENIASZ asercje z jawnym uzasadnieniem w raporcie i w komentarzu przy asercji; (b) swiadomie rezygnujesz z montazu, bo `ExecutionProposalMessage` juz robi to samo lepiej, i zapisujesz to jako decyzje. **Czego nie wolno: usunac asercji, obejsc jej przez zmiane nazwy komponentu, albo `zapomniec` o niej i zostawic czerwony test.** ★★ **Siodma: chipy sugestii nie skompiluja sie z nowymi akcjami.** `ChatSuggestionAction` (`ChatSmartSuggestions.tsx:33`) to unia dwoch typow, w ktorej nie ma `ChatActionPayload`; `useChatActions` buduje `deps` bez callbackow i bez `projectId` (`:63`); `chatActionRegistry.ts:116` odrzuca `RECORD_KPI` bez `context.projectId`. **Trzy dziury, nie jedna** — i wszystkie trzy trzeba zalatac, zeby chip w ogole zadzialal, a nie tylko sie wyswietlil. Chip, ktory sie rysuje i nic nie robi, to dokladnie ten sam ksztalt widma, ktory ten dyzur ma zamknac. ★★ **Osma: cztery akcje maja dzis ZLE cele.** `GENERATE_REPORT` → `/reports/builder?new=1` zamiast sciezki Studia Dokumentow z 195; `GENERATE_PRESENTATION` → `/presentations?new=1` zamiast kanonicznego wejscia 186/201 (`/prezentacje?templateArtifactId=` → `POST /presentations/decks/from-template`); `RECORD_KPI` → `/benefits?kpi=`, a `/benefits` jest PRZEKIEROWANIEM na `/results` (`AppRoutes.tsx:2854-2863`). `Dobudowanie producenta`, ktory prowadzi w stare miejsce, jest zawyzeniem: producent ISTNIEJE, ale prowadzi w przeszlosc. ★★ **Dziewiata: `zero importerow` jest prawda tylko dla jednego z dwoch dubletow.** `useActionHandler.ts` — zero (dwa trafienia grepem to KOMENTARZE w `AppRoutes.tsx:728` i `presentationWizardRedirect.ts:11`, sprawdz oczami, nie licznikiem). `server/src/ai/aiContextBuilder.ts` — JEDEN importer i jest nim test (`tests/unit/backend/legacyAiContextBuilder.test.ts:44`). Skasowanie pliku bez testu wywroci suite, skasowanie obu wymaga jawnej licencji wyjatku (jest w `ZAKAZ_WLASCIWY_TEMU_DYZUROWI`). **Zmierz, nie zakladaj — `grep` liczacy trafienia klamie, bo liczy komentarze.** ★★ **Dziesiata: `ENABLE_TERESA_RECORD_CREATE` jest DOMYSLNIE WLACZONA.** `FeatureFlags.ts:51` ma `z.boolean().default(true)`. To znaczy, ze scenariusz `model tworzy zadanie z czatu bez zgody` jest DZIS zachowaniem domyslnym produktu, a nie hipoteza. Twoja flaga OFF ma to zostawic **bajt w bajt** — pokusa `przy okazji to naprawmy dla wszystkich` jest tu najgrozniejsza, bo dotyka zachowania, ktore uzytkownicy juz znaja, i lamie zasade `nic nie wchodzi bez akceptu wlasciciela na zrzutach`. ★★ **Jedenasta: dublet trasy `GET /ai/actions/pending`.** Zarejestrowana dwa razy (`ai.routes.ts:6820` i `:7992`); Express bierze pierwsza, druga jest martwa. Jesli bedziesz debugowal zachowanie tej trasy patrzac na `:7992`, bedziesz czytal kod, ktory nie biegnie. **To jest wpis do raportu, nie naprawa w tym dyzurze.****
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day207-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day207-write-proposal-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 — WRITE-AS-PROPOSAL za flaga `ENABLE_TERESA_TOOL_LOOP_WRITE` (default OFF): (a) TABELA OBOWIAZKOWA nr 1 — wszystkie OSIEM narzedzi z `SIDE_EFFECT_TOOLS` w osobnych wierszach, z kolumnami: czy osiagalne z czatu DZIS · z ktorego rejestru · ktora implementacja biegnie · czy wykonuje sie od razu · odpowiednik w `ACTION_TYPES` (`aiActionExecutor.ts:29-38`) · cena. ★ `query_structured_data` JEST jedna z tych osmiu (`sideEffectTools.ts:22`) — zamowienie policzylo je dwa razy, poprawna liczba to 8; (b) TABELA OBOWIAZKOWA nr 2 — inwentarz CZTERECH istniejacych mechanizmow propozycji w czacie (`artifact_handoff_proposals` · `ai_actions`/`execution_proposal` · `teresa_proposals` · `PendingActionsIndicator`) z kolumnami: tabela · producent · konsument/karta · bramki · audyt · CZY ZYJE; (c) WYBOR mechanizmu — rozstrzygasz Ty, z liczbami; ZAKAZ budowy PIATEGO; (d) punkt przechwycenia: wywolanie narzedzia zapisujacego przez model przy ON NIE wykonuje mutacji, tylko tworzy propozycje (wzorzec ksztaltu istnieje i jest ZYWY: `clientTools`/`idea_action`, `llmService.ts:1271-1300` + `ai.routes.ts:4800-4855`); przy OFF sciezka bajt w bajt dzisiejsza — a dzisiejsza prawda jest taka, ze `create_task`/`create_decision` z czatu PISZA OD RAZU, bez zgody; (e) po `Zatwierdz` — wykonanie i AUDYT; ★ `executeToolCall` NIE MA dzis zadnego audytu (`toolDefinitions.ts:573-582`, tylko `logger.info`), wiec audyt albo dziedziczysz z `aiRunLedgerService` przez sciezke `ai_actions`, albo budujesz WOKOL executora — i piszesz w raporcie, ktora droga; (f) ★ rozstrzygnij i zapisz KOLIZJE NAZW `create_task`/`create_decision` (dwie implementacje, dwa rejestry) — jesli po zgodzie zawolasz `executeToolCall`, wykonasz INNY kod niz ten, ktory model wywolal. R2 — CZTERY AKCJE Z D-15 DOSTAJA PRODUCENTOW: `GENERATE_REPORT`, `GENERATE_PRESENTATION`, `USE_TEMPLATE`+`BROWSE_TEMPLATES`, `RECORD_KPI`; (a) poszerz `ChatSuggestionAction` (dzis `NavigateAction | ChatInjectAction`, `ChatSmartSuggestions.tsx:33`) i uzupelnij `deps` w `useChatActions.ts:63` (dzis `{ navigate, context: {} }` — bez callbackow i bez `projectId`); (b) dobuduj producenta w `chatSuggestions` (`UnifiedChatPanel` ok. `:2716`) na bazie kontekstu rozmowy, wzorem dwoch istniejacych rodzin; (c) POPRAW CELE: `GENERATE_REPORT` prowadzi dzis do `/reports/builder?new=1` (`chatActionHandler.ts:167`) zamiast do sciezki Studia Dokumentow z dyzuru 195, `GENERATE_PRESENTATION` do `/presentations?new=1` (`:182`) zamiast do kanonicznego wejscia 186/201 (`/prezentacje?templateArtifactId=` → `POST /presentations/decks/from-template`), `RECORD_KPI` do `/benefits?kpi=` (`:282`), a `/benefits` jest dzis PRZEKIEROWANIEM na `/results` (`AppRoutes.tsx:2854-2863`); (d) model MOZE proponowac te akcje przez petle — rozstrzygnij, czy jako propozycje z R1 (jesli mutuja), czy jako czysta nawigacja (jesli nie); (e) `PendingActionsIndicator` — ZAMONTUJ albo SWIADOMIE ZASTAP karta `ExecutionProposalMessage`, ★ ze swiadomoscia, ze istnieje ZASTANA ASERCJA na jego BRAK (`tests/unit/backend/wave6ContextLearningService.test.ts` ok. `:529`). R3 — MAPA POZOSTALYCH WIDM: tabela typ → narzedzie aplikacji → decyzja (`dobuduj-pozniej` / `zgas-z-powodem`) dopisana jako ANEKS do nowego rozdzialu w `ARCHITEKTURA_AGENTA_TERESY.md`; ★ ZERO KASOWANIA TYPOW AKCJI w tym dyzurze; dodatkowo zmierz i zgas martwy kod: `src/hooks/useActionHandler.ts` (trzeci dyspozytor z wlasnymi `ACTION_TYPES` `:8-16`) — usun TYLKO jesli nadal zero importerow; `server/src/ai/aiContextBuilder.ts` — ★ NIE MA zera importerow, ma jednego i jest nim TEST (`tests/unit/backend/legacyAiContextBuilder.test.ts:44`), patrz licencja wyjatku. R4 — UPRAWNIENIA JEDNA MACIERZA: propozycje zapisu przechodza przez `chatPermissionService` i `aiRoleGuard`; ★ minimalny punkt wpiecia JUZ ISTNIEJE — `aiActionExecutor.requestAction` konsultuje `AIRoleGuard.isActionBlocked` (`:326`) i `AIPolicyEngine.canPerformAction` (`:344`); zmierz to i wykorzystaj, zamiast pisac druga macierz; ★ ale `aiRoleGuard.isActionBlocked` zna WYLACZNIE `CREATE_DRAFT_*`, `GENERATE_REPORT`, `PREPARE_DECISION_SUMMARY`, `SUGGEST_ROADMAP_CHANGE` (`:96-100`) — mapowanie nazw narzedzi na te typy jest Twoja decyzja projektowa i ma byc w tabeli, nie zgadniete`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6147` albo `5086 i 5087` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6147` albo `5086 i 5087`** (`Z7`).

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
`status: canonical`, 31.08.2026). Jej §3 wymienia PIĘĆ przerwanych ogniw. Ten dyżur zamyka
DWA z nich naraz — §7 nazywa tę pozycję wprost:

> 17-C tool-loop WRITE-as-proposal + zgaszenie widm (**P1b + P5**)

`P1b` to druga połowa pierwszego ogniwa (206 zrobił READ, tu jest WRITE). `P5` brzmi:

> | P5 | **15/17 akcji czatu to widma** — handler je zna, nic ich nie produkuje (w tym
> GENERATE_REPORT); +2 stuby narzędzi (generate_report_section, schedule_meeting);
> +trzeci dispatcher bez importerów; +update_assessment_score poza filtrem | martwy kod
> udający funkcje | jedna decyzja: dobudować producentów dla 4-5 wartościowych, RESZTĘ USUNĄĆ |

★★ **Decyzja właściciela `D-15` ZMIENIŁA drugą połowę tego zdania.** §8 pkt 2 pytał, „które
z 15 widm dobudować, reszta do usunięcia?". Odpowiedź brzmi:

> **„Agent ma obejmować pracę ze WSZYSTKIMI narzędziami aplikacji i nimi zarządzać."**

Czyli: **widma nie są kasowane hurtem — są MAPOWANE** na realne narzędzia aplikacji. Cztery
dostają producentów TERAZ (`GENERATE_REPORT`, `GENERATE_PRESENTATION`, `USE_TEMPLATE` +
`BROWSE_TEMPLATES`, `RECORD_KPI`), reszta dostaje **tabelę z decyzją per pozycja**
(`dobuduj-później` albo `zgaś-z-powodem`) — i to jest cały zakres kasowania w tym dyżurze:
zero linii usuniętych z rejestru akcji.

★ **Uczciwość źródła:** `D-15` jest **cytatem z sesji właściciela, nie plikiem w repozytorium**.
Sprawdziłem: w `docs/program/waves/WAVE_03_ACCEPTANCE` nie ma wpisu o tym numerze. Jeżeli
go znajdziesz — zacytuj `plik:linia`. Jeżeli nie — napisz w raporcie, że podstawą jest cytat
nadzorcy. To jest miara rzetelności tego dyżuru, nie formalność.

## ★★ Pomiar, który zmienia treść zamówienia — wykonany na SHA `91e02b8ea8`

Zamówienie, z którym ten dyżur został złożony, jest w SIEDMIU miejscach nieprecyzyjne, a trzy
z tych nieprecyzyjności zmieniają to, co masz zbudować. **Wszystko poniżej zweryfikuj sam —
to rozkaz pomiarowy, nie prawda objawiona.** Obalenie którejkolwiek pozycji jest sukcesem
dyżuru i wchodzi do „Korekt wobec instrukcji".

**(K1) Narzędzi zapisujących jest OSIEM, nie dziewięć.** Zamówienie mówiło „8 z
`SIDE_EFFECT_TOOLS` + `query_structured_data`". `query_structured_data` **JEST jedną z tych
ośmiu** (`sideEffectTools.ts:22`) — zostało policzone dwa razy. Pełna lista
(`sideEffectTools.ts:17-31`): `create_initiative_draft`, `generate_report_section`,
`schedule_meeting`, `create_notebook_entry`, `query_structured_data`, `create_task`,
`update_task`, `create_decision`.

**(K2) ★★ Z tych ośmiu model w czacie widzi DZIŚ DWA — i one PISZĄ DO BAZY OD RAZU.**
`CHAT_CREATION_TOOLS` (`AIPipeline.ts:366-375`) przepuszcza `generate_deliverable`,
`generate_initiative` oraz — za `ENABLE_TERESA_RECORD_CREATE` — `create_task` i
`create_decision`. Ta flaga ma **`z.boolean().default(true)`** (`FeatureFlags.ts:51`), więc
jest WŁĄCZONA. Handler `createTask` (`server/src/services/ai/tools/createTask.ts:334`)
samo-bramkuje się wyłącznie na tę flagę (`:343`), po czym woła `TaskExecutor.execute` —
**zapis do bazy bez żadnej zgody człowieka.**

To jest ogniwo `P2` z architektury („zapisy czatu = trzecia droga poza kanonem", oznaczone
`groźne (D-7!)`) i **jest ono dziś żywe na domyślnych ustawieniach produktu.**

Pozostałe sześć narzędzi zapisujących jest z czatu **nieosiągalnych w ogóle**, a w świecie
planów **mają już bramkę** `awaiting_approval` (po to `SIDE_EFFECT_TOOLS` istnieje). Realny
zakres `R1` to zatem: **dwa żywe narzędzia do obramowania zgodą** plus świadoma decyzja, ile
z pozostałych sześciu w ogóle wpuścić do czatu.

**(K3) ★ `create_task` i `create_decision` istnieją w OBU rejestrach, pod tą samą nazwą, z
RÓŻNYMI implementacjami.**

| | rejestr MCP | rejestr `AI_TOOLS` |
|---|---|---|
| rejestracja | `tools/index.ts:43` i `:44` | `toolDefinitions.ts:30` (`AI_TOOLS`) |
| implementacja | `tools/createTask.ts:334` → `TaskExecutor.execute` | `executeCreateTask` (`toolDefinitions.ts:719`), `case` `:700-701` |
| dyspozytor | `mcpServer.execute` | `executeToolCall` (`:573`) |
| kto to dziś woła | **model w czacie** (`llmService.ts:1208`) | planer / V8 / playbook |
| bramka zgody | **żadna** (tylko flaga) | `SIDE_EFFECT_TOOLS` → `awaiting_approval` |

Zdanie zamówienia „po Zatwierdź wykonuje się `executeToolCall`" oznacza więc **wykonanie
INNEGO KODU niż ten, który model wywołał.** To jest dokładnie ta sama klasa kolizji, którą
dyżur 206 miał rozstrzygnąć dla `search_knowledge_base`. Rozstrzygnij ją **jawnie** i zapisz
jednym zdaniem, które da się zacytować.

**(K4) ★★ Mechanizmów propozycji w czacie jest CZTERY, nie jeden — a ten wskazany w
zamówieniu jest do tego zadania NAJGORSZY.**

| # | Mechanizm | Tabela | Producent | Karta w czacie | Żyje? |
|---|---|---|---|---|---|
| 1 | governed handoff artefaktów (179/195) | `artifact_handoff_proposals` | **człowiek** klika „Utwórz dokument" (`UnifiedChatPanel.tsx:1313`, `:1324`) | `GovernedChatHandoffCard` (`MessageRenderer.tsx:1958`) | TAK |
| 2 | `ai_actions` / `execution_proposal` | `ai_actions` | `requestAction` (`aiActionExecutor.ts:295`) — **ZERO wołaczy** | `ExecutionProposalMessage` (`MessageRenderer.tsx:619-647`) | karta TAK, producent NIE |
| 3 | `teresa_proposals` | `teresa_proposals` | `teresaCopilotService.createChatProposal` (`ai.routes.ts:2980-3012`) | `TeresaProposalCard` (`MessageRenderer.tsx:821`) | TAK |
| 4 | wskaźnik oczekujących | `ai_actions` | — | `PendingActionsIndicator` | **ZERO montażu** |

Mechanizm **(1)**, wskazany w zamówieniu, pinuje **bajty WIADOMOŚCI** czatu i materializuje
**ARTEFAKT**. Jego `TARGET_KINDS` to **zamknięta lista** `['document','presentation',
'workbook','material']` (`handoffSpineService.ts:49-50`) — **nie ma w niej `task` ani
`decision`** — a sam plik pisze o sobie: „deliberately has NO materialize endpoint". To jest
mechanizm **WIADOMOŚĆ → ARTEFAKT**, a Ty potrzebujesz **WYWOŁANIE NARZĘDZIA → MUTACJA**.

**(K5) ★★ Natomiast mechanizm (2) jest DOKŁADNIE tym, czego ten dyżur potrzebuje — i jest
zbudowany od końca do końca POZA PRODUCENTEM.** `requestAction` (`aiActionExecutor.ts:295`):

- konsultuje `RegulatoryModeGuard`, potem **`AIRoleGuard.isActionBlocked`** (`:326`), potem
  **`AIPolicyEngine.canPerformAction`** (`:344`), potem wzorce auto-aprobat;
- zapisuje wiersz `ai_actions` ze statusem `PENDING`;
- przy podanym `chatEmission.conversationId` **emituje do wątku wiadomość
  `execution_proposal`** (`ChatEmissionOptions`, `:71-100`);
- prowadzi audyt przez `aiRunLedgerService` (`ensureRunForAction` `:198`, `recordAIRunEvent`
  `:237`, `recordLegacyAuditSafely` `:407`);
- ma `approveAction` (`:570`), `rejectAction` (`:660`), `executeAction` (`:769`),
  `_executeCreateTask` (`:1082`).

Front ma **gotową kartę** (`MessageRenderer.tsx:64-70` zbiór typów, `:619-647` jawne
przechwycenie przed zwykłym dymkiem, komponent `ExecutionProposalMessage.tsx`) i **gotowe
handlery** approve/reject (`UnifiedChatPanel.tsx:6009`, `:6060`) ze store'em cyklu życia.

A `requestAction` **nie ma ani jednego wołacza produkcyjnego**: jedyny to `createDraft` w tym
samym pliku (`:544`) i trasa `POST /ai/actions/draft` (`ai.routes.ts:6787`), która **nie ma
wołacza po stronie frontu**. To jest wzorzec **„biblioteka bez wywołania"** — ten sam, który
206 znalazł w `AI_TOOLS`. Jeżeli to potwierdzisz, **dyżur 207 jest pierwszym momentem w
historii tego produktu, w którym cokolwiek tworzy propozycję zapisu z czatu** — i to zdanie
ma trafić do raportu.

**(K6) ★ Wzorzec „wywołanie narzędzia, które się NIE wykonuje" już istnieje i JEST ŻYWY.**
`ENABLE_TERESA_IDEA_ACTIONS` (default ON) → rodzina `clientTools` w `callStream`
(`llmService.ts:1271-1300`), której `execute` woła `onClientToolCall` **zamiast**
`mcpServer.execute` → `emitSSE({ type:'idea_action', toolName, args })`
(`ai.routes.ts:4843`). Komentarz w kodzie mówi to wprost:

> „ich wywołanie NIE wykonuje się tu (serwer nie ma dostępu do płótna w przeglądarce) —
> emitujemy SSE `idea_action`, a front wykonuje je (…) **Nie twierdzimy tu, że akcja się
> wykonała**; to potwierdzi (albo odrzuci) front." (`ai.routes.ts:4804-4845`)

**Kopiujesz KSZTAŁT, nie budujesz go od zera.** Jedyna różnica: `idea_action` wykonuje się na
froncie automatycznie, a Twoja propozycja ma czekać na klik. Tę różnicę nazwij w raporcie.

**(K7) ★ `executeToolCall` NIE MA AUDYTU.** Ma jeden `logger.info` (`toolDefinitions.ts:578`)
i nic więcej. Zdanie zamówienia „wykonuje się `executeToolCall` z pełnym audytem" jest dziś
**fałszywe** — audyt albo dziedziczysz ze ścieżki `ai_actions`, albo budujesz **wokół**
executora. Napisz w raporcie, którą drogą poszedłeś, i **policz tę pracę, zanim ją obiecasz.**

Trzy pomiary dodatkowe, dotyczące `P5`:

- **`PendingActionsIndicator` ma zero montażu w `src`** — ale istnieje **ZASTANA ASERCJA na
  ten brak**: `tests/unit/backend/wave6ContextLearningService.test.ts` (ok. `:529`):
  `expect(chat).not.toContain('<PendingActionsIndicator')`. „Wreszcie zamontowany" **złamie
  zastany test**. To jest decyzja, nie oczywistość.
- **`src/hooks/useActionHandler.ts` ma ZERO importerów** — dwa trafienia grepem
  (`AppRoutes.tsx:728`, `presentationWizardRedirect.ts:11`) to **komentarze**, nie importy.
  Ma własne `ACTION_TYPES` (siedem nazw, `:8-16`), częściowo pokrywające się z siedemnastoma
  z `chatActions.ts`.
- **`server/src/ai/aiContextBuilder.ts` NIE ma zera importerów** — ma jednego i jest nim TEST
  (`tests/unit/backend/legacyAiContextBuilder.test.ts:44`). „Zero importerów" z zamówienia
  jest więc prawdą dla jednego z dwóch dubletów, nie dla obu.

# 2. TEZY ZLECENIA

Każda z nich to **rozkaz pomiarowy**. Numery linii są z SHA `91e02b8ea8` — jeśli u Ciebie są
inne, wiążący jest plik (`Z24`), a rozbieżność wpisujesz do raportu.

- **T1.** `SIDE_EFFECT_TOOLS` (`sideEffectTools.ts:17-31`) ma **osiem** nazw i
  `query_structured_data` jest jedną z nich (`:22`). **Policz sam.**
- **T2.** `CHAT_CREATION_TOOLS` (`AIPipeline.ts:366-375`) przepuszcza do modelu w czacie
  **dwa** z tych ośmiu: `create_task` i `create_decision`, za `ENABLE_TERESA_RECORD_CREATE`.
- **T3.** ★ `ENABLE_TERESA_RECORD_CREATE` ma `z.boolean().default(true)` (`FeatureFlags.ts:51`)
  — jest **domyślnie włączona**, więc scenariusz „model tworzy zadanie z czatu bez zgody" jest
  **dzisiejszym zachowaniem produktu**, nie hipotezą.
- **T4.** `tools/createTask.ts` (`:334`) bramkuje się wyłącznie na tę flagę (`:343`) i woła
  `TaskExecutor.execute` — **zapis bez zgody**, bez `awaiting_approval`, bez `ai_actions`.
- **T5.** ★ `create_task`/`create_decision` mają **dwie implementacje w dwóch rejestrach**
  (`tools/index.ts:43-44` vs `toolDefinitions.ts:700-701`, executor `:719`). Model w czacie
  woła dziś **implementację MCP**.
- **T6.** ★★ `aiActionExecutor.requestAction` (`:295`) ma **zero wołaczy produkcyjnych**;
  jedyne to `createDraft` (`:544`) i trasa `POST /ai/actions/draft` (`ai.routes.ts:6787`),
  która **nie ma wołacza na froncie**. Cały cykl propozycja→zgoda→wykonanie→audyt jest
  zbudowany i martwy.
- **T7.** Karta propozycji **jest już wpięta**: `V8_EXECUTION_MESSAGE_TYPES`
  (`MessageRenderer.tsx:64-70`) i jawne przechwycenie `:619-647`, przed zwykłym dymkiem, z
  komentarzem „proposals are never rendered as plain chat text and can never silently mutate
  state". Handlery approve/reject: `UnifiedChatPanel.tsx:6009`, `:6060`.
- **T8.** ★ `requestAction` konsultuje `AIRoleGuard.isActionBlocked` (`:326`) i
  `AIPolicyEngine.canPerformAction` (`:344`) — **macierz uprawnień istnieje, tylko nikt jej z
  czatu nie woła.** Twierdzenie architektury „pipeline nie konsultuje aiRoleGuard" jest
  precyzyjne co do PIPELINE'u i **nie znaczy, że guard jest martwy**.
- **T9.** `aiRoleGuard.isActionBlocked` (`:91`) rozpoznaje **wyłącznie** `CREATE_DRAFT_*`,
  `GENERATE_REPORT`, `PREPARE_DECISION_SUMMARY` i `SUGGEST_ROADMAP_CHANGE` (`:96-100`);
  `ACTION_TYPES` (`aiActionExecutor.ts:29-38`) ma osiem nazw. Nazwy narzędzi (`create_task`,
  `update_task`, `schedule_meeting`, `create_notebook_entry`, `generate_report_section`,
  `query_structured_data`) **nie mają tam odpowiednika** — mapowanie jest Twoją decyzją.
- **T10.** `executeToolCall` (`toolDefinitions.ts:573`) ma wyłącznie `logger.info` (`:578`) i
  **zero audytu**. Audyt żyje w `aiRunLedgerService` (`:198`, `:237`, `:407`).
- **T11.** `TARGET_KINDS` (`handoffSpineService.ts:49-50`) to zamknięta lista czterech
  rodzajów artefaktów — bez `task` i `decision`.
- **T12.** Typów akcji czatu jest **17** (`src/types/domain/chatActions.ts:9-27`), handler
  obsługuje **wszystkie** (`chatActionHandler.ts`), a producenta ma **garstka** — policz sam
  i podaj z mianownikiem (np. `2 z 17`). Jedyny producent po stronie chipów to
  `chatSuggestions` useMemo w `UnifiedChatPanel` (ok. `:2716-2800`), z **dwiema** rodzinami
  wpisów, bramkowany `aiConfig.chatSuggestionsEnabled` (D-104) i
  `displayMessages.length >= 2 && !isStreaming`.

# 3. POZYCJE DYŻURU

## R1 — WRITE-as-proposal, za flagą `ENABLE_TERESA_TOOL_LOOP_WRITE` (default OFF)

**Cel, dosłownie:** przy fladze **ON** wywołanie narzędzia ZAPISUJĄCEGO przez model w
`/chat/stream` **nie wykonuje mutacji** — produkuje **kartę propozycji**; mutacja następuje
dopiero po kliknięciu `Zatwierdź`, przechodzi przez macierz uprawnień i zostawia ślad w
audycie. Przy fladze **OFF** — **bajt w bajt dzisiejsze zachowanie**, czyli (uwaga)
`create_task`/`create_decision` z czatu **nadal piszą od razu**. To nie jest przeoczenie:
to jest zakaz zmiany zachowania, którego właściciel jeszcze nie zaakceptował na zrzutach.

★★ **Flaga jest OSOBNA od `ENABLE_TERESA_TOOL_LOOP` z dyżuru 206.** Nie wolno ich łączyć,
czytać jednej przez drugą ani uzależniać zapisu od tego, czy odczyt jest włączony. Zapis i
odczyt to dwie różne zgody właściciela.

### R1a — TABELA OBOWIĄZKOWA nr 1: osiem narzędzi zapisujących

Bez tej tabeli pozycja jest nieukończona. **Każde narzędzie w osobnym wierszu, bez skrótów
i bez „…":**

| # | Narzędzie | Osiągalne z czatu DZIŚ? | Z którego rejestru | Która implementacja biegnie | Wykonuje się od razu? | Odpowiednik w `ACTION_TYPES` | Cena |
|---|---|---|---|---|---|---|---|
| 1 | `create_task` | … | … | … | … | … | … |
| 2 | `create_decision` | … | … | … | … | … | … |
| … | … (wszystkie osiem) | … | … | … | … | … | … |

Rozstrzygnij w niej jawnie `T1` (`query_structured_data` liczone dwa razy w zamówieniu) i
podaj **z mianownikiem**, ile narzędzi realnie wchodzi w zakres tego dyżuru (np. `2 z 8
osiągalne dziś, +N wpuszczone świadomie`).

### R1b — TABELA OBOWIĄZKOWA nr 2: cztery mechanizmy propozycji

| # | Mechanizm | Tabela | Producent | Konsument / karta | Bramki | Audyt | Czy żyje |
|---|---|---|---|---|---|---|---|
| 1 | governed handoff artefaktów | … | … | … | … | … | … |
| 2 | `ai_actions` / `execution_proposal` | … | … | … | … | … | … |
| 3 | `teresa_proposals` | … | … | … | … | … | … |
| 4 | `PendingActionsIndicator` | … | … | … | … | … | … |

### R1c — WYBÓR mechanizmu: rozstrzygasz Ty, z liczbami

Instrukcja **nie narzuca** rozwiązania, ale **zakazuje budowy piątego mechanizmu**. Trzy
kandydatury; wybierz jedną i uzasadnij **liczbą** (liczba dotkniętych linii w gorącej ścieżce,
liczba plików, liczba zastanych testów, które zmieniają sens), nie opinią:

1. **`ai_actions` przez `requestAction`.** Zaleta: macierz uprawnień (`T8`), audyt (`T10`),
   karta (`T7`) i cykl approve/reject/execute **już istnieją**; brakuje wyłącznie producenta.
   Koszt: `aiActionExecutor.ts` ma w pierwszej linii `// @ts-nocheck` (typy Cię nie osłonią),
   a mapowanie nazw narzędzi na `ACTION_TYPES` trzeba zaprojektować (`T9`).
2. **Spine `artifact_handoff_proposals`.** Zaleta: świeżo domknięty E2E (195), transakcyjny,
   idempotentny. Koszt: `TARGET_KINDS` zamknięte i bez `task`/`decision` (`T11`), a producent
   pinuje **bajty wiadomości**, nie wywołanie narzędzia — **zmierz, zanim wybierzesz.**
3. **`teresa_proposals`.** Zaleta: żyje w strumieniu i ma kartę. Koszt: syntezuje propozycję
   z TEKSTU odpowiedzi, nie z wywołania narzędzia; zmierz, czy w ogóle da się do niego wpiąć
   wywołanie.

**Wynik tej pozycji to jedno cytowalne zdanie:** który mechanizm obsługuje WRITE-as-proposal
w czacie, dlaczego, i co się dzieje z pozostałymi trzema.

### R1d — punkt przechwycenia: narzędzie, które się nie wykonuje

Wzorzec kształtu jest w kodzie i jest żywy (`K6`): rodzina `clientTools` w `callStream`
(`llmService.ts:1271-1300`), której `execute` woła `onClientToolCall` zamiast
`mcpServer.execute`, plus reguła pierwszeństwa `if (streamToolDefinitions[def.name]) continue;`
(`:1279`) i wiązanie w trasie (`ai.routes.ts:4800-4855`).

Wymogi:
- przy **OFF** ścieżka narzędzi tworzących ma być **bajt w bajt dzisiejsza** — to jest osobna
  asercja, nie założenie;
- przy **ON** wywołanie narzędzia zapisującego **nie dociera do executora mutacji**;
- model dostaje **czytelny wynik narzędzia** („propozycja czeka na zatwierdzenie"), a nie
  błąd — inaczej napisze użytkownikowi, że się nie udało;
- **do SSE i do payloadu karty nie trafia surowy wynik narzędzia** ani treść dokumentów —
  nazwa narzędzia, argumenty w formie nadającej się do pokazania, status. Strażnik poufności
  jest nietykalny.

### R1e — rozstrzygnięcie kolizji nazw (obowiązkowe)

`create_task` i `create_decision` mają dwie implementacje w dwóch rejestrach (`T5`). Zapisz
jawnie: **która implementacja wykonuje się po `Zatwierdź`, dlaczego, i co się dzieje z
drugą.** Jeżeli po zgodzie zawołasz `executeToolCall`, wykonasz **inny kod** niż ten, który
model wywołał — inna walidacja, inne pola, być może inny kształt rekordu — i **udowodnisz
cykl w kodzie, który nie biegł.** To jest podstawa odrzucenia pozycji.

### R1f — po `Zatwierdź`: wykonanie i audyt

`executeToolCall` nie ma audytu (`T10`). Rozstrzygnij i uzasadnij: dziedziczysz audyt ze
ścieżki `ai_actions` (`ensureRunForAction` / `recordAIRunEvent` / `recordLegacyAuditSafely`)
czy budujesz go **wokół** executora. Wymóg minimalny: po wykonaniu w audycie jest wpis z
nazwą narzędzia, aktorem-człowiekiem, identyfikatorem propozycji i wynikiem — a **brak wpisu
jest czerwonym testem**, nie ostrzeżeniem w logu.

★ **Kanon czy legacy?** Zamówienie pyta wprost: czy wykonanie po zgodzie idzie przez
KANONICZNE polecenia. **Odpowiedź na ten dyżur: NIE — legacy do czasu migracji.** Ogniwo
`P2` (przełączenie zapisów czatu na kanon) to dyżur **17-A**, zależny od `197-E1`, i ten
dyżur go nie wykonuje. **Odnotuj to w raporcie jako świadomy dług**, jednym zdaniem, żeby
nikt nie policzył propozycji-nad-legacy jako domknięcia `P2`.

### R1g — dowód (opcjonalnie z modelem)

Dowód podstawowy **nie wymaga modelu** (`Z15` obowiązuje): wywołanie narzędzia wstrzykujesz
w teście. Łańcuch do udowodnienia, ogniwo po ogniwie:

1. **propozycja** — przy ON wywołanie `create_task` **nie tworzy wiersza w `tasks`** (asercja
   liczy wiersze przed i po: `0 nowych`) i **tworzy** wiersz propozycji;
2. **zgoda** — bez `Zatwierdź` mutacja nie następuje (drugie `0 nowych`);
3. **wykonanie** — po `Zatwierdź` wiersz w `tasks` powstaje, **jeden**, nie dwa (idempotencja);
4. **audyt** — wpis istnieje i wskazuje aktora-człowieka.

★ **Zniesienie warunkowe `Z15` dotyczy WYŁĄCZNIE tej pozycji** i tylko jeśli uznasz, że bez
modelu nie da się dowieść, że **model faktycznie nie wykonał mutacji**. Budżet: **DOKŁADNIE
DWA PRZEBIEGI** (1× ON, 1× OFF jako mutacja), **sufit 5 rund modelu w całym dyżurze**,
jednostką limitu jest PRZEBIEG (jedna tura czatu), bo `stopWhen: stepCountIs(4)`
(`llmService.ts:1343`) z definicji oznacza do czterech rund na turę. Przebieg nieudany =
**STOP pozycji z opisem**, nie trzeci przebieg. Licencja na klucz i `Z40` — w §5.
**Jeśli nie skorzystasz ze zniesienia, napisz w raporcie wprost „modelu nie wołałem"** — to
jest wynik, nie brak.

**Ukończone, gdy:** obie tabele kompletne; mechanizm wybrany jednym cytowalnym zdaniem;
kolizja nazw rozstrzygnięta; cztery ogniwa łańcucha udowodnione z dowodem mutacyjnym w obie
strony; przy OFF zachowanie `create_task` **niezmienione** i to zasercjonowane; dług `P2`
odnotowany.

## R2 — cztery akcje z `D-15` dostają producentów

**Cel:** `GENERATE_REPORT`, `GENERATE_PRESENTATION`, `USE_TEMPLATE` + `BROWSE_TEMPLATES`,
`RECORD_KPI` przestają być widmami — pojawiają się w rozmowie i **prowadzą tam, gdzie trzeba.**

### R2a — trzy dziury, które trzeba załatać, żeby chip w ogóle zadziałał

To nie jest „dodaj chip". Zmierzone przeszkody:

1. **Typ.** `ChatSuggestionAction = NavigateAction | ChatInjectAction`
   (`ChatSmartSuggestions.tsx:33`) **nie dopuszcza** `ChatActionPayload` — bez poszerzenia
   unii żadna z czterech akcji nie przejdzie kompilacji.
2. **Zależności.** `useChatActions` buduje `deps: ActionHandlerDeps = { navigate, context: {} }`
   (`:63`) — **bez** `onOpenReportBuilder`, `onOpenPresentationWizard`, `onOpenKpiDrawer` i
   **bez `projectId`**, więc każda z czterech akcji spadnie do surowego `navigate`.
3. **Rejestr.** `chatActionRegistry.ts:116` **odrzuca `RECORD_KPI` bez `context.projectId`.**

Chip, który się rysuje i nic nie robi, to **dokładnie ten sam kształt widma**, który ten
dyżur ma zamknąć.

### R2b — producent

Rozszerz `chatSuggestions` (`UnifiedChatPanel` ok. `:2716-2800`) o te typy **na bazie
kontekstu rozmowy**, wzorem dwóch istniejących rodzin (`initiative` → `NAVIGATE`;
`insight`/`interview` → trzy `chat`-inject + jedna `NAVIGATE`). Zbadaj i opisz, **czym jest
dziś kontekst**, który steruje tym `useMemo` — to jest jedyny działający producent w całym
rejestrze i wzorzec bierzesz z niego, nie z wyobraźni.

★ Chipy są **nawigacyjne** (otwierają ekran, nie mutują bazy), więc **nie muszą** iść za
flagą zapisu. Rozstrzygnij jawnie, czy idą za własną flagą, czy za istniejącym przełącznikiem
`aiConfig.chatSuggestionsEnabled` (D-104). **Rekomendacja nadzorcy: reużyj D-104, nie mnóż
flag** — ale to jest rekomendacja, nie rozkaz; jeśli zmierzysz powód, żeby zrobić inaczej,
zrób i uzasadnij.

### R2c — ★ POPRAW CELE, bo dziś prowadzą w przeszłość

| Akcja | Dokąd prowadzi DZIŚ | Dokąd ma prowadzić |
|---|---|---|
| `GENERATE_REPORT` | `/reports/builder?new=1` (`chatActionHandler.ts:167-180`) | ścieżka Studia Dokumentów z dyżuru 195 — **zmierz ją sam** i podaj trasę |
| `GENERATE_PRESENTATION` | `/presentations?new=1` (`:182-193`) | kanoniczne wejście 186/201: `/prezentacje?templateArtifactId=…` → `POST /presentations/decks/from-template`, z modalem briefu z 201 |
| `USE_TEMPLATE` | `/prezentacje?templateArtifactId=` albo `/reports/builder` (`:313-336`) | **nawigacyjne — sprawdź, czy cel jest nadal poprawny; jeśli tak, nie ruszaj** |
| `BROWSE_TEMPLATES` | `/presentations?tab=templates` (`:337-344`) | j.w. |
| `RECORD_KPI` | `/benefits?kpi=` (`:282-296`) | `/benefits` jest **przekierowaniem** na `/results` (`AppRoutes.tsx:2854-2863`) — celuj w trasę pomiaru z dyżuru 199 i **zmierz ją sam** |

★ „Dobudowanie producenta", który prowadzi w stare miejsce, jest **zawyżeniem**: producent
istnieje, ale prowadzi w przeszłość. Do raportu wpisujesz starą i nową trasę per akcja.

### R2d — model może je proponować przez pętlę

Rozstrzygnij i uzasadnij: czy model może zaproponować te akcje z pętli, i jeśli tak — czy
jako **propozycję z R1** (gdy mutują), czy jako **czystą nawigację** (gdy nie). Nawigacja nie
jest mutacją i **nie wymaga bramki zgody**; udawanie, że wymaga, jest zawyżeniem tak samo jak
pominięcie bramki tam, gdzie mutacja zachodzi.

### R2e — `PendingActionsIndicator`: montaż albo świadome zastąpienie

Komponent ma **zero montażu** w `src`, ale istnieje **zastana asercja na ten brak**
(`tests/unit/backend/wave6ContextLearningService.test.ts` ok. `:529`). Dwie legalne drogi:

- **(a)** montujesz i **ZMIENIASZ** asercję, z jawnym uzasadnieniem w raporcie **i** w
  komentarzu przy asercji;
- **(b)** świadomie rezygnujesz z montażu, bo `ExecutionProposalMessage` robi to samo w
  wątku i lepiej, i **zapisujesz to jako decyzję** z uzasadnieniem.

**Czego nie wolno:** usunąć asercji, obejść jej przez zmianę nazwy komponentu, albo zostawić
czerwony test.

**Ukończone, gdy:** cztery akcje mają producenta i **działają** (klik prowadzi do właściwego
ekranu, nie do fallbacku); trzy dziury z `R2a` zamknięte; tabela starych i nowych tras w
raporcie; decyzja o `PendingActionsIndicator` podjęta i uzasadniona, a zastany test zielony.

## R3 — MAPA pozostałych widm (zero kasowania typów akcji)

Do nowego rozdziału w `ARCHITEKTURA_AGENTA_TERESY.md` dopisujesz **aneks: mapa widm**.

| Typ akcji | Narzędzie / ekran aplikacji, które to realizuje | Producent istnieje? | Decyzja | Powód |
|---|---|---|---|---|
| `START_TOOL` | … | … | `dobuduj-później` / `zgaś-z-powodem` | … |
| `OPEN_PREVIEW` | … | … | … | … |
| … (wszystkie pozostałe) | … | … | … | … |

Zasady tej pozycji:
- **ZERO kasowania typów akcji i `case`'ów** w tym dyżurze — `D-15` mówi „mapować, nie
  kasować". Mapa jest dokumentem, nie commitem kasującym.
- Do mapy wchodzą też **dwa stuby narzędzi** z `P5` (`generate_report_section`,
  `schedule_meeting`) oraz `update_assessment_score`, które jest **zarejestrowane w MCP**
  (`tools/index.ts:27`), ale **poza filtrem** `CHAT_CREATION_TOOLS` — czyli z czatu
  nieosiągalne. **Mapujesz, nie podpinasz.**
- **Policz widma sam i podaj z mianownikiem.** Karta §3 mówi `15/17`; zamówienie mówi
  `11 pozostałych`. Obie liczby są do zweryfikowania: jeśli producenta ma dziś `N z 17`, a
  cztery dostają go w R2, to zostaje `17 − N − 4`. Wpisz swoją arytmetykę.

**Martwy kod — zmierz IMPORTERY, nie obecność pliku:**

- `src/hooks/useActionHandler.ts` — trzeci dyspozytor z własnymi `ACTION_TYPES` (`:8-16`).
  Zmierzone: **zero importerów** (dwa trafienia grepem to komentarze — sprawdź oczami, nie
  licznikiem). **Jeśli to potwierdzisz — usuń.** Jeśli obalisz — do mapy.
- `server/src/ai/aiContextBuilder.ts` — dublet martwy wobec żywego
  `server/src/services/aiContextBuilder.ts`. Zmierzone: **JEDEN importer i jest nim test**
  (`tests/unit/backend/legacyAiContextBuilder.test.ts:44`). To **nie** jest „zero importerów"
  z zamówienia. Licencja wyjątku (usunięcie pliku **razem** z jego jedynym testem) jest w §5
  — z trzema warunkami. Jeśli warunki nie zachodzą: **nie usuwasz**, wpis do mapy.

**Ukończone, gdy:** mapa kompletna (tyle wierszy, ile widm policzyłeś), z decyzją i powodem
per wiersz; arytmetyka widm z mianownikiem; dwa dublety rozstrzygnięte pomiarem, nie
założeniem; **ani jeden typ akcji nie skasowany.**

## R4 — uprawnienia jedną macierzą

Propozycje zapisu przechodzą przez `chatPermissionService` **i** `aiRoleGuard` — jedną
macierz, nie dwie.

★ **Minimalny punkt wpięcia już istnieje i masz go zmierzyć, zanim napiszesz drugą macierz:**
`aiActionExecutor.requestAction` konsultuje po kolei `RegulatoryModeGuard`,
`AIRoleGuard.isActionBlocked` (`:326`) i `AIPolicyEngine.canPerformAction` (`:344`). Jeśli
propozycja powstaje tą drogą, macierz **przychodzi za darmo** — a to jest pierwsze realne
użycie `aiRoleGuard` na ścieżce czatu w historii tego produktu.

Do rozstrzygnięcia i wypisania w tabeli:
- **mapowanie nazw.** `aiRoleGuard.isActionBlocked` (`:96-100`) zna wyłącznie
  `CREATE_DRAFT_*`, `GENERATE_REPORT`, `PREPARE_DECISION_SUMMARY`, `SUGGEST_ROADMAP_CHANGE`;
  `ACTION_TYPES` ma osiem nazw. Które narzędzie mapuje się na który typ — i **co się dzieje
  z narzędziami bez odpowiednika** (`update_task`, `schedule_meeting`,
  `create_notebook_entry`, `generate_report_section`, `query_structured_data`). Domyślka
  „przepuść" jest **niedopuszczalna**: brak mapowania ma znaczyć odmowę, nie zgodę.
- **`chatPermissionService`** — gdzie wchodzi (`checkChatPermission` / `canChat`) i czy
  propozycja zapisu wymaga innego progu niż samo pisanie w rozmowie.
- ★ **`aiRoleGuard.getStoredRole` czyta `project_ai_settings` po `projectId`.** Tura czatu nie
  zawsze ma `projectId`. **Zmierz, co się dzieje bez niego** — w `requestAction` bramki roli i
  trybu regulacyjnego są za `if (projectId && …)`, więc **bez `projectId` obie się nie
  wykonują**. To jest luka, którą musisz nazwać i zamknąć albo jawnie zgłosić jako pozostającą.

**Ukończone, gdy:** tabela mapowania kompletna; test dowodzi, że rola bez uprawnienia
**odmawia** (a nie po cichu przepuszcza), z dowodem mutacyjnym; zachowanie bez `projectId`
zmierzone i nazwane.

# 4. TABELA LICENCJI PLIKOWYCH

Licencja obejmuje CAŁĄ ścieżkę: wiązanie narzędzi → przechwycenie → propozycja → bramki →
audyt → karta → chipy → testy. Pominięcie ogniwa zmusiłoby Cię do złamania licencji albo do
połowy roboty.

| Zakres | Ścieżki |
|---|---|
| Zapis | `server/src/config/FeatureFlags.ts` — WYŁĄCZNIE dodanie `ENABLE_TERESA_TOOL_LOOP_WRITE` (wpis w `FeatureFlagsSchema` wzorem `:34` + wpis w bloku ładującym wzorem `:147`). **Zakaz zmiany wartości domyślnej JAKIEJKOLWIEK istniejącej flagi**, w szczególności `ENABLE_TERESA_RECORD_CREATE` (`:51`) |
| Zapis | `server/src/services/ai/llmService.ts` — WYŁĄCZNIE `callStream`: rejestracja rodziny narzędzi zapisujących wzorem `clientTools` (`:1271-1300`). **Zakaz zmian w `callWithTools` (`:921`) i `callWithToolsStream` (`:1009`)** — mają własnych konsumentów i własne testy |
| Zapis | `server/src/services/ai/AIPipeline.ts` — WYŁĄCZNIE blok wiązania narzędzi strumienia (`:340-460`) i wywołanie `callStream` (`:532-572`). Zmiany w `CHAT_CREATION_TOOLS` (`:366-375`) **wyłącznie addytywne i za flagą**; zakaz dotykania pre-klasyfikacji intencji (`:387-434`) |
| Zapis | `server/src/routes/ai.routes.ts` — WYŁĄCZNIE: wiązanie narzędzi zapisujących w `pipelineRequest.options` (obok bloków `:4763-4796` i `:4800-4855`) oraz emisja zdarzenia propozycji przez `emitSSE` (`:2858`). **Zakaz kasowania i modyfikacji** prefetchu KB (`:3465-3520`), regexu web (`:3705-3712`), przełączników `aiModes` i bloku `teresa_proposal` (`:2980-3012`). **Zakaz naprawiania dubletu trasy `/actions/pending`** (`:6820` vs `:7992`) — to wpis do raportu |
| Zapis | `server/src/services/aiActionExecutor.ts` — dozwolone WYŁĄCZNIE, jeśli wybierzesz ten mechanizm w `R1c`: **wywołanie** `requestAction` z nowego producenta i, jeśli trzeba, addytywne rozszerzenie `ACTION_TYPES` o mapowanie z `R4`. **Zakaz zmiany semantyki `approveAction`/`rejectAction`/`executeAction`** i zakaz zmiany kolejności bramek w `requestAction` (`:295-345`). ★ Plik ma `// @ts-nocheck` w pierwszej linii — pracujesz w nim bez osłony typów i odnotowujesz to w raporcie |
| Zapis | `server/src/services/ai/toolDefinitions.ts` — dozwolone WYŁĄCZNIE: eksport zbioru narzędzi zapisujących i, jeśli `R1f` tego wymaga, audyt/licznik **wokół** `executeToolCall` (`:573`). **Zakaz zmiany semantyki któregokolwiek executora** — READ i WRITE |
| Zapis | `src/hooks/useAIStream.ts` — WYŁĄCZNIE dodanie typu i obsługi zdarzenia propozycji zapisu (wzorce w pliku: `idea_action` `:948`, `teresa_proposal` `:1012`, `research_progress` `:1111`) |
| Zapis | `src/components/AIChat/MessageRenderer.tsx` — WYŁĄCZNIE zasilenie istniejącej gałęzi `V8_EXECUTION_MESSAGE_TYPES` (`:64-70`, `:619-647`) albo dodanie renderu karty obok niej. **Zakaz zmiany zachowania gałęzi `GovernedChatHandoffCard` (`:1958`) i `TeresaProposalCard` (`:821`)** |
| Zapis | `src/components/AIChat/UnifiedChatPanel.tsx` — WYŁĄCZNIE: producent chipów (`chatSuggestions`, ok. `:2716-2800`), uzupełnienie `deps` przekazywanych do akcji, i — jeśli trzeba — podpięcie nowego zdarzenia SSE. **Zakaz zmian w `handleCreateGovernedDocument` (`:1313`), `decideGovernedHandoff`, `handleMaterializeGovernedHandoff`** — to jest domknięta ścieżka 195 |
| Zapis | `src/components/AIChat/ExecutionProposalMessage.tsx` — dozwolone zmiany prezentacyjne konieczne, żeby karta pokazała propozycję narzędziową; tokeny `c-*`, zero `primary-*` |
| Zapis | `src/components/Chat/ChatSmartSuggestions.tsx` — WYŁĄCZNIE poszerzenie `ChatSuggestionAction` (`:33`) i obsługa nowego wariantu w telemetrii (`:82-92`). Paleta neutralna, fokus `c-focus` — nagłówek pliku jest wiążący |
| Zapis | `src/hooks/useChatActions.ts` (`:52-74`) · `src/services/chatActionHandler.ts` (cele czterech akcji: `:167`, `:182`, `:282`, `:313`, `:337`) · `src/services/chatActionRegistry.ts` (`:116`) — WYŁĄCZNIE w zakresie `R2` |
| Zapis | `src/components/AIChat/PendingActionsIndicator.tsx` — montaż albo świadome pozostawienie; przy montażu **zmiana** (nie usunięcie) asercji w `tests/unit/backend/wave6ContextLearningService.test.ts` (ok. `:529`) z komentarzem uzasadniającym |
| Zapis | NOWY ekran `dev-render/screens/` do zrzutu (jeśli go tworzysz) + wpis w `dev-render/main.tsx` |
| Zapis | NOWE pliki testowe `day207.*` w `server/src/services/ai/__tests__/`, `server/src/services/__tests__/`, `tests/unit/backend/`, `tests/integration/`, `tests/components/AIChat/` — pełna licencja, z zastrzeżeniem `Z18` i `Z31`. ★ Nowe pliki w `tests/` wymagają `git add -f` |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY207_WRITE_PROPOSAL_REPORT.md` |
| Zapis (ograniczony) | `docs/program/funkcje/ARCHITEKTURA_AGENTA_TERESY.md` — WYŁĄCZNIE nowy rozdział `Wykonanie — 17-C (Day207)` na końcu pliku (numer ustalasz pomiarem — patrz §2 nagłówka instrukcji), z aneksem „mapa widm", oraz odsyłacze do niego w wierszach `P1` i `P5` tabeli §3. **Zakaz zmiany treści P2, P3, P4, §4, §6, §8, §9** |
| Zapis (warunkowy, JEDYNY WYJĄTEK) | `server/src/ai/aiContextBuilder.ts` **razem z** `tests/unit/backend/legacyAiContextBuilder.test.ts` — usunięcie OBU w jednym commicie, wyłącznie po spełnieniu trzech warunków z §5 |
| Zapis (warunkowy) | `src/hooks/useActionHandler.ts` — usunięcie, wyłącznie po potwierdzeniu pomiarem zera importerów |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/ai/sideEffectTools.ts` — lista jest bramką aprobat dla planów; **nie dopisujesz i nie usuwasz z niej nic** |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/ai/agentPlannerService.ts` · `server/src/services/wave8AgentRuntimeService.ts` · `server/src/ai/actionExecutors/playbookExecutor.ts` — trzej wołacze `executeToolCall`; cykl planów utwardzony dyżurami 164-180, architektura §4: „zostają OBA" |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/ai/mcpServer.ts` · `server/src/services/ai/tools/index.ts` · `server/src/services/ai/tools/createTask.ts` · `tools/createDecision.ts` · `tools/updateAssessmentScore.ts` — semantyki wspólnego rejestru i handlerów nie zmieniasz; **zmiana zachowania `createTask` jest dozwolona WYŁĄCZNIE przez nie-wywołanie go, nigdy przez edycję pliku** |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/aiRoleGuard.ts` · `server/src/services/chatPermissionService.ts` · `server/src/services/aiPolicyEngine.ts` · `server/src/services/aiRunLedgerService.ts` · `server/src/services/ai/chatPolicyGateway.ts` · `server/src/services/ai/webSearchGovernance.ts` · `server/src/services/ai/toolCostEstimates.ts` — bramek, macierzy i cennika NIE zmieniasz; masz przez nie PRZECHODZIĆ |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/chatHandoff/**` · `server/src/services/artifactHandoff/handoffSpineService.ts` · `server/src/routes/v8/chat.routes.ts` — domknięta ścieżka 179/195; czytasz jako wzorzec i jako kandydaturę w `R1c`, nie modyfikujesz |
| Odczyt | `server/src/services/v8/teresaCopilotService.ts` · `server/src/services/v8/proposalUnificationService.ts` — trzeci mechanizm propozycji, do inwentarza `R1b` |
| Odczyt | `src/types/domain/chatActions.ts` (`:9-27`) — rejestr 17 typów; **czytasz, nie kasujesz** |
| Odczyt | `docs/program/funkcje/ARCHITEKTURA_AGENTA_TERESY.md` (§3 `P1`/`P5`, §7, §8) · `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` · `docs/program/waves/WAVE_03_ACCEPTANCE/modules/13_CHAT/MODULE_ACCEPTANCE.md` · raporty `CODEX_DAY179_CZAT_REPORT.md`, `CODEX_DAY186_GEN4_TRESC_REPORT.md`, `CODEX_DAY195_DOKUMENT_REPORT.md`, `CODEX_DAY199_KARTY_WYNIKOW_REPORT.md`, `CODEX_DAY201_MODAL_BRIEFU_REPORT.md` |
| Odczyt | `~/.consultify-openrouter` — WYŁĄCZNIE jeśli skorzystasz ze zniesienia `Z15` w `R1g`, i WYŁĄCZNIE przez `set -a; . ~/.consultify-openrouter; set +a`; nigdy nie wypisujesz zawartości |

**Nietykalne imiennie:** `sideEffectTools.ts` · `agentPlannerService.ts` ·
`wave8AgentRuntimeService.ts` · `mcpServer.ts` · `tools/createTask.ts` · `tools/createDecision.ts` ·
`aiRoleGuard.ts` · `chatPermissionService.ts` · `aiPolicyEngine.ts` · `aiRunLedgerService.ts` ·
`chatPolicyGateway.ts` · `webSearchGovernance.ts` · `toolCostEstimates.ts` ·
`chatHandoff/**` · `handoffSpineService.ts` · prefetch i regexy READ w `ai.routes.ts` ·
każdy `MODULE_ACCEPTANCE.md` · §1-§9 `ARCHITEKTURA_AGENTA_TERESY.md`.

**Rozłączność z partią równoległą:** ten dyżur wchodzi w `ai.routes.ts`, `AIPipeline.ts`,
`llmService.ts`, `useAIStream.ts`, `MessageRenderer.tsx` i `UnifiedChatPanel.tsx` — sześć
plików o wysokim ruchu, a **dyżur 206 wchodzi w cztery z nich**. **Przed pierwszym commitem**
sprawdź `git log` gałęzi bazowej pod kątem równoległych dyżurów w tych plikach i **zgłoś
kolizję zasobową ZANIM zaczniesz pisać, nie po.**

# 5. TWARDE ZASADY

- ★★ **PĘTLA READ Z DYŻURU 206 JEST NIETYKALNA** poza rozszerzeniem rejestru. Jeśli na Twojej
  bazie istnieje `ENABLE_TERESA_TOOL_LOOP` albo rodzina narzędzi READ — nie zmieniasz jej
  zachowania, jej domyślki, ani nie uzależniasz swojej flagi od jej stanu. Zmierz to (`W15`):
  jeśli flagi 206 nie ma, **Twój dyżur jest od niej niezależny i tak ma zostać.**
- ★★ **ZAKAZ BUDOWY PIĄTEGO MECHANIZMU PROPOZYCJI.** W czacie są już cztery. Wybierasz jeden
  z istniejących i uzasadniasz liczbami; jeśli uznasz, że żaden nie pasuje — to jest **STOP
  MERYTORYCZNY pozycji z opisem**, a nie piąty mechanizm.
- ★★ **ZAKAZ KASOWANIA TYPÓW AKCJI CZATU.** Żadnego z 17 typów w `chatActions.ts` ani żadnego
  `case` w `chatActionHandler.ts` nie usuwasz. `D-15`: **mapować, nie kasować.**
- ★★ **`ENABLE_TERESA_RECORD_CREATE` JEST DOMYŚLNIE WŁĄCZONA** (`FeatureFlags.ts:51`). Przy
  Twojej fladze OFF zachowanie `create_task`/`create_decision` z czatu ma zostać **bajt w
  bajt dzisiejsze** — łącznie z tym, że piszą od razu. Pokusa „przy okazji to naprawmy dla
  wszystkich" jest tu najgroźniejsza: dotyka zachowania, które użytkownicy już znają, i łamie
  zasadę „nic nie wchodzi bez akceptu właściciela na zrzutach" (`CLAUDE.md` §5, §7, §9).
- ★★ **DOWODEM BRAKU ZAPISU JEST STAN BAZY, NIE BRAK LOGU.** Asercja liczy wiersze w
  `tasks`/`decisions` przed i po turze i pokazuje `0 nowych`. „Nie widziałem wpisu" nie jest
  dowodem.
- ★★ **STRAŻNIK POUFNOŚCI NIETYKALNY** (E1-E3, fail-closed w trzech punktach — architektura
  §2). Karta propozycji nie może nieść do UI ani jednego bajtu treści, której wołający nie
  zobaczyłby bez niej. Surowe wyniki narzędzi i treści dokumentów **nie wchodzą** do SSE ani
  do payloadu karty.
- ★★ **`Z15` OBOWIĄZUJE — modelu nie wołasz.** Zniesienie **warunkowe i wyłącznie dla `R1g`**,
  z budżetem **DWA PRZEBIEGI / sufit 5 rund modelu**, jednostka limitu = PRZEBIEG (jedna tura
  czatu), zakaz ponawiania nieudanego przebiegu. Licencja na klucz: `~/.consultify-openrouter`,
  **jedyna dozwolona komenda źródłowa** `set -a; . ~/.consultify-openrouter; set +a` — nie
  kopiujesz pliku, nie przenosisz go do repozytorium, nie wpisujesz treści do `.env`,
  `docker-compose*` ani żadnej komendy. **`Z40` bez wyjątku:** wartość klucza nie pojawia się
  nigdzie; pokazujesz `obecny`/`nieobecny`
  (`env | sed 's/=.*//' | grep -x 'OPENROUTER_API_KEY'`). Do raportu: nazwa modelu (nigdy
  klucza) i **zmierzona** liczba rund z logu. **Jeśli nie skorzystasz — napisz „modelu nie
  wołałem".**
- ★★ **LICENCJA WYJĄTKU (jedyna w tym dyżurze).** Usunięcie `server/src/ai/aiContextBuilder.ts`
  **razem** z `tests/unit/backend/legacyAiContextBuilder.test.ts` jest **dozwolone** i jest
  jawnym wyjątkiem od zakazu usuwania zastanych testów, ponieważ ten test testuje wyłącznie
  usuwany plik. Warunki, wszystkie trzy: (1) potwierdzisz pomiarem, że poza tym testem nie ma
  innego importera; (2) usuwasz oba pliki w **jednym** commicie z uzasadnieniem w treści
  commita; (3) wpisujesz to do raportu jako „wyjątek wykorzystany". Jeśli warunek (1) nie
  zachodzi — **nie usuwasz**. **Wyjątek nie rozciąga się na żaden inny plik ani test.**
- ★★ **`Z31` — ZAKAZ PINOWANIA STRAŻNIKA REALDB DO HOSTA, PORTU ALBO NAZWY BAZY.** Wołasz
  `await assertRealPostgresTestEnvironment()` **BEZ ARGUMENTÓW**, w szczególności bez
  `expectedDatabase`; zakaz asercji na `DATABASE_URL`, na porcie i na nazwie kontenera. Powód,
  dosłownie: dyżur 43 przypiął strażnika do swojej bazy — po usunięciu kontenera **30
  przypadków dowodowych stało się trwałym `SKIP`** przy `exit 0`; w programie odnotowano
  **sześć takich incydentów**, a dyżur 193 zamówiono wyłącznie po to, żeby je zbiorczo odpiąć
  (`97187267a0 fix(day164): unpin Z31 DATABASE_URL assertion to any local Postgres`).
  **Nie dokładaj siódmego.**
- ★★ **`Z29` — dowód mutacyjny w obie strony, PER OGNIWO:** flaga (OFF → zapis natychmiastowy
  jak dziś; ON → brak zapisu + wiersz propozycji), zgoda (bez `Zatwierdź` mutacja nie
  następuje), uprawnienia (rola bez prawa → **odmowa**, nie cicha zgoda), audyt (brak wpisu =
  czerwony test). „Test zielony" nie jest dowodem.
- ★★ **Zakaz retry w testach bezpieczeństwa** — w tym programie zmierzono wektor systemowy, w
  którym test izolacji leczy się skutkiem własnego ataku. Każde `X/X PASS` bez asercji na
  NIEOBECNOŚĆ imiennie zaseedowanego rekordu i bez dowodu mutacyjnego jest podejrzane z urzędu.
- ★ **`server/src/services/aiActionExecutor.ts` ma `// @ts-nocheck` w pierwszej linii.** Jeśli
  w nim pracujesz, **typy Cię nie osłonią** — odnotuj to w raporcie jako podjęte ryzyko.
- ★ **Sprzątanie kontenera: `docker rm -f -v`** — z flagą `-v`, inaczej wolumen zostaje na
  dysku i po kilku dyżurach kończy się miejsce.
- ★ **`Z27` — zakaz `git stash`** w każdej postaci. Dowody mutacyjne przez `cp` do
  `/private/tmp/cx-day207-write-proposal-scratch` i powrót przez `cp`; schowek jest
  współdzielony między wszystkimi worktree tego repozytorium.
- **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji** (`Z28`), w każdą stronę i
  każdym narzędziem.
- **Zakaz naprawiania przez wyciszanie** (`@ts-ignore`, `.skip`, poszerzanie `exclude`,
  `--no-verify`) i zakaz usuwania zastanych testów **poza jedynym wyjątkiem wyżej** — asercję
  wolno **ZMIENIĆ** z uzasadnieniem, nie skasować.
- ★ **`§0.4a` — pomiar zasięgu testów jest warunkiem oddania raportu** (`Z24`). Zawężony wybór
  albo **przepisanie cudzej liczby** = zawyżenie i podstawa odrzucenia.
- ★ **Zrzuty: `mean_luma` każdego, para jasny/ciemny >150 różnicy.** Bez wyjątku. Duplikat
  obrazu zamiast drugiego motywu przechodzi `shasum` (plakietka zmienia SHA) — to jest
  policzony, nazwany kształt fałszywego gotowe; znana przyczyna: motyw ustawiany po
  hydratacji, naprawa przez `addInitScript`. **Wymagane zrzuty: karta propozycji WRITE ×2
  motywy.** W raporcie piszesz **wprost**, czy dane na zrzucie pochodzą z realnego przebiegu,
  czy z propsów w harnessie — `dev-render/screens/chat-split-teresa-right.tsx` mówi w nagłówku,
  że realny `UnifiedChatPanel` „nie zmontuje się w harnessie, więc TREŚĆ jest mockowana", więc
  zrzut zamockowanej powłoki **nie jest dowodem renderu**.
- ★ **`Z13`:** logi, dzienniki przebiegu, zrzuty i wyjścia bramek **nie wchodzą do repo** —
  leżą w `/private/tmp/cx-day207-write-proposal-artefakty`, a raport podaje ścieżki i
  `shasum -a 256`.
- Pułapka: bez `RUN_DB_TESTS=1` testy backendowe idą na MOCK DB. Pułapka: `No test files found`
  **nie jest** `PASS` — sprawdź `numTotalTests > 0`. Pułapka: `npx vitest run` bywa kończy się
  `exit 0` mimo czerwonych testów — liczby **i nazwy** czytasz z JSON-a (`Z37`: porównania po
  `fullName`, nigdy po liczbach). Pułapka: `DB_TYPE` bywa przybity w configu — sprawdź, co
  realnie widzi proces.
- ★ Port **5000 zajęty na stałe** przez macOS Control Center; port **5037** zajęty przez `adb`;
  porty **5060-5061** zajęte. Nie używaj żadnego z nich. Porty **6148-6149** i **5088-5091**
  są zarezerwowane dla dyżurów 208-209 — nie bierz ich.
- ★★ **Sekcja „TWIERDZENIA NIEZWERYFIKOWANE" w raporcie jest OBOWIĄZKOWA.** Wypisz w niej
  wprost co najmniej: czy obie tabele obowiązkowe (`R1a`, `R1b`) są kompletne czy skrócone;
  czy potwierdziłeś pomiarem, że `requestAction` **nie ma wołaczy produkcyjnych**, czy tylko
  przepisałeś to z instrukcji; czy zmierzyłeś, że `create_task` z czatu pisze DZIŚ bez zgody,
  czy założyłeś; którą implementację `create_task` wykonuje Twoja ścieżka po zgodzie i czy to
  zmierzyłeś; czy dowód braku zapisu opiera się na **stanie bazy**, czy na braku logu; czy
  audyt zmierzyłeś, czy przyjąłeś; czy zachowanie bez `projectId` w `R4` zmierzyłeś;
  ile widm policzyłeś i czym się różni Twoja liczba od `15/17` z karty §3 oraz od `11` z
  zamówienia; czy dane na zrzucie pochodzą z realnego przebiegu czy z propsów; czy wołałeś
  model, a jeśli tak — ile rund naprawdę wykonałeś. **Brak tej sekcji jest podstawą
  odrzucenia dyżuru.**
