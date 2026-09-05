# V2 — Weryfikacja sceptyczna 4 defektów P1 (`/chat`) + próbka kontrolna 16 „OK”

Katalog źródłowy: `/private/tmp/m03` (gałąź `codex/m03-admin-20260824`), TYLKO ODCZYT.
Staging: `https://staging.consultify.ai`, curl bez auth/body, `test-id` jako identyfikator.

## CZĘŚĆ 1 — Werdykty P1

### 1. `E_wiadomosci.md` D-2 — „Zapisz jako pomysł” nie tworzy rekordu

**Werdykt: OSŁABIONY** → z „nie tworzy rekordu” do „tworzy rekord z opóźnieniem, automatycznie, bez dodatkowego kliknięcia użytkownika”.

Dowód niezależny (własny, nie z audytu E):
- `src/components/AIChat/UnifiedChatPanel.tsx:1462-1531` (`saveMessageAsIdea`, gałąź `navigateToMyWork`) — potwierdzone: rzeczywiście `return`uje PRZED `Api.createIdeaFromChat`, ustawiając `setMyWorkIntent({open:{type:'idea', id:'new-idea-<ts>', data:{isNew:true, creationPayload, seedIntent}}})` i `setCurrentView(MY_WORK)`.
- `src/components/MyWork/MyWorkHub.tsx:1448-1493` — efekt konsumujący `myWorkIntent` uruchamia się natychmiast po zmianie widoku (bez przeładowania strony, czysty SPA-state), wywołuje `handleOpenDocument(nextDoc)` **synchronicznie**.
- `src/components/MyWork/MyWorkHub.tsx:1258-1264` (`handleOpenDocument`) — ustawia `activeDocumentId` od razu, co montuje `renderDocumentContent()` → `IdeaMapWorkspace` (`MyWorkHub.tsx:3937-3949`, propsy `creationPayload`/`seedIntent` przekazane wprost).
- `src/components/MyWork/IdeaMapWorkspace.tsx:353` (`isNewInitial = ideaId.startsWith('new-idea-')`) dopasowuje wzorzec id z chatu → `IdeaMapWorkspace.tsx:1628-1650` (`hydrate()`, uruchamiany w efekcie na mount) faktycznie woła `Api.createMyIdea({title, body, tags, sourceType, sourceConversationId, sourceMessageId})` z danymi `creationPayload`.

Wniosek: rekord w bazie **powstaje**, ale nie w handlerze kliknięcia w czacie — tworzy go dopiero zamontowany `IdeaMapWorkspace` po automatycznej nawigacji. Całość (klik → setState → render My Work → mount workspace → `Api.createMyIdea`) dzieje się w jednym cyklu SPA, bez akcji użytkownika i bez ryzyka utraty przy odświeżeniu (nawigacja jest czysto kliencka, nie ma pełnego reloadu między krokami). To realne opóźnienie/nieelegancki wzorzec (błędny toast „Opened in workspace” zamiast „Saved”, i ryzyko: jeśli użytkownik zamknie kartę w tej samej milisekundzie — teoretyczne, nie zaobserwowane), ale NIE jest to defekt „nic nie zapisuje”.

**Bliźniacza akcja „Zapisz jako notatkę” — sprawdzona, INNY wzorzec (poprawny):** `UnifiedChatPanel.tsx:1567-1627` (`saveMessageAsNote`) woła `Api.post('/my-work/notebook/pages', {...})` **synchronicznie w handlerze**, przed jakąkolwiek nawigacją — zapis do bazy następuje natychmiast po kliknięciu, nawigacja do My Work jest opcjonalnym krokiem PO sukcesie zapisu. Note-flow nie ma wady idea-flow.

### 2. `E_wiadomosci.md` D-3 — `ChatTableProposalCard` traci stan po odświeżeniu, możliwa duplikacja akcji

**Werdykt: OSŁABIONY do P2** — front rzeczywiście pokazuje stary stan po F5 (lokalny `useState`, `onStatusChange={() => {}}` no-op potwierdzone), ale backend BLOKUJE duplikat wykonania — druga próba kończy się błędem, nie drugą mutacją.

Dowód niezależny:
- `server/src/routes/table-platform.routes.ts:1798-1815` — trasa `POST /schema/proposals/:proposalId/execute` woła `ChatToSchemaService.executeProposal(...)`.
- `server/src/services/tablePlatform/ChatToSchemaService.ts:470-482` — na wejściu: `const proposal = await this.getProposal(proposalId); if (proposal.status !== 'pending' && proposal.status !== 'approved') throw new Error(...)`.
- `server/src/services/tablePlatform/ChatToSchemaService.ts:594-597` — po udanej egzekucji: `UPDATE tp_schema_proposals SET status = $2 (...)` z `$2` = `'executed'` lub `'failed'`.

Wniosek: pierwszy klik ustawia `status='executed'` w bazie. Drugi klik (po F5, na tym samym `proposal.id` z odświeżonej, nieaktualnej karty) trafia w `getProposal` → status `'executed'` → `throw new Error("Proposal status is 'executed', cannot execute")` → trasa łapie wyjątek i zwraca `500`. Front dostaje błąd, nie sukces — żadna druga mutacja schematu nie zachodzi. To dokładnie wzorzec „UI pokazuje stary stan, ale nie duplikuje” z briefu → P2, nie P1.

### 3. `E_wiadomosci.md` D-4 — `CaseIntakeConfirmCard` nigdy się nie renderuje

**Werdykt: POTWIERDZONY** (własny niezależny dowód, zgodny z audytem E).

Dowód:
- `src/components/AIChat/MessageRenderer.tsx:880` — jedyny warunek renderu: `(msg as any).metadata?.type === 'case_intake_proposal'`.
- `grep -rn "case_intake_proposal" src server` → **dokładnie 2 trafienia w całym repo**: `MessageRenderer.tsx:880` (odczyt) i `CaseIntakeConfirmCard.tsx:26` (komentarz w nagłówku komponentu). Zero producentów tego stringa.
- `src/components/AIChat/CaseIntakeConfirmCard.tsx:22-29` — komponent SAM przyznaje w nagłówku: „ta karta nie ma dziś ŻADNEGO produkcyjnego wywołującego (…) Żaden krok w `MessageRenderer.tsx`/`UnifiedChatPanel.tsx` nie ustawia `msg.metadata.type === 'case_intake_proposal'`”.
- `grep -rln "apiIntake" src` → tylko `CaseIntakeConfirmCard.tsx` importuje `src/components/CaseWorkspace/apiIntake.ts` — żaden inny plik w czacie nie woła `proposeConversationWorkOrder`/`confirmConversationWorkOrder`, mimo że backend (`caseIntakeService`, trasy `/api/v10/teresa/case-intake/...`) realnie istnieje i działa (potwierdzone komentarzami w `server/src/routes/v10/teresa.routes.ts:195-215`).

Cała funkcja jest martwa od strony orkiestracji czatu — komponent i API są gotowe, ale nic ich nie łączy.

### 4. `F_rama_ekranu.md` D-1 — „Zapytaj AI teraz” gubi wiadomość na `/chat`

**Werdykt: POTWIERDZONY** (własny niezależny dowód, zgodny z audytem F).

Dowód:
- `src/store/slices/uiSlice.ts:45-47,176,231-232` — `chatKickoffMessage` to pojedynczy globalny slot w store (write: `setChatKickoffMessage`, read: brak selektora w samym sklepie — czyste get/set).
- `src/components/Help/HelpSidePanel.tsx:268,324` (`openAiNow`) — jedyny zapis do store: `setChatKickoffMessage(prompt)`.
- `grep -rn "chatKickoffMessage" src --include="*.tsx"` (poza `UnifiedChatPanel.tsx`/`uiSlice.ts`) → jedyny konsument-czytelnik store'u to `src/layouts/MainLayout.tsx:82-83,505-506`: `kickoffMessage={chatKickoffMessage || undefined}` przekazywany do WEWNĘTRZNEGO montażu `UnifiedChatPanel` (split-panel towarzyszący innym widokom).
- `src/components/AIChat/UnifiedChatPanel.tsx:762-765,804-805,5007-5019` — komponent czyta kickoff WYŁĄCZNIE z propa `kickoffMessage` (efekt `if (!kickoffMessage) return; ... void handleSendMessage(kickoffMessage); onKickoffConsumed?.()`) — nigdy z `useAppStore`.
- `src/routes/AppRoutes.tsx` (trasa `ROUTES.AI_CHAT`, render `/chat`) — `<MainLayout ...><UnifiedChatPanel mode="full" /></MainLayout>` — TEN konkretny montaż `UnifiedChatPanel` jest DZIECKIEM `MainLayout` dostarczonym z zewnątrz przez `AppRoutes`, a nie wewnętrznym, propem-owanym montażem z `MainLayout.tsx:505-506`. Żaden prop `kickoffMessage`/`onKickoffConsumed` nie jest tu przekazany — potwierdzone brakiem `kickoff` w wyniku `grep -ni kickoff src/routes/AppRoutes.tsx` (zero trafień).

Wniosek: na `/chat` istnieją DWA różne mechanizmy wstrzykiwania czatu w tym samym drzewie (`MainLayout`'s own split-chat vs. `AppRoutes`'s bezpośredni full-page `UnifiedChatPanel`), i tylko pierwszy jest podłączony do store'u. Wiadomość z Pomocy faktycznie ginie na `/chat`/`/chat/:id` — dokładnie jak twierdzi audyt F.

## CZĘŚĆ 2 — Próbka kontrolna „OK” (16 pozycji, HTTP + trasa serwera)

Dla każdej: (a) element potwierdzony plik:linia, (b) trasa zamontowana w `Gateway.ts` + kontroler nie jest stubem/501/TODO, (c) curl bez auth na `https://staging.consultify.ai`.

| # | Element | Plik audytu | Element plik:linia | Trasa + montaż | Kontroler realny? | curl staging | Potwierdzone |
|---|---|---|---|---|---|---|---|
| 1 | Zapisz dokument kanwy (Save) | A1_pasek_kanwy.md #15 | `WorkCanvasDocumentPanel.tsx` `persistDraft()` (`:1590`) | `PUT /api/work-canvas/drafts/:id` — `work-canvas.routes.ts:3479`, mount `Gateway.ts:585` | TAK (`ownedDraft`, walidacja konfliktu, zapis realnych pól) `:3479-3520` | `PUT /drafts/test-id` → **401** | **TAK** |
| 2 | Udostępnij dokument kanwy (Share) | A1_pasek_kanwy.md #14 | `WorkCanvasDocumentPanel.tsx` `runShareAction()` (`:2895`) | `POST /api/work-canvas/drafts/:id/share` — `work-canvas.routes.ts:4097`, mount jw. | TAK (`requireCanvasCapability`, generuje token+URL) `:4097-4116` | `POST /drafts/test-id/share` → **401** | **TAK** |
| 3 | „Send to idea” (governed handoff, propose) | A1_pasek_kanwy.md #8 | `WorkCanvasDocumentPanel.tsx` `runGovernedHandoff`→`createProposal` | `POST /api/work-canvas/drafts/:id/proposals` — `:3722`, mount jw. | TAK (widoczny w kodzie, nie stub) | `POST .../proposals` → **401** | **TAK** |
| 4 | Governed handoff — approve | A1_pasek_kanwy.md #8 | jw. `approveProposal` | `POST /api/work-canvas/proposals/:id/approve` — `:3794`, mount jw. | TAK | `POST /proposals/test-id/approve` → **401** | **TAK** |
| 5 | Usuń rozmowę (soft-delete) | C_naglowek_historia.md #35g | `ConversationActions.tsx:363-384` `deleteConversation` | `DELETE /api/conversations/:id` — `conversations.routes.ts:1025`, mount `Gateway.ts:710` | TAK (sprawdza uprawnienia zespołu, soft-delete realny) `:1025-1060` | `DELETE /conversations/test-id` → **401** | **TAK** |
| 6 | Zmień nazwę rozmowy | C_naglowek_historia.md #34/35a | `ConversationItem.tsx:93-117` `renameConversation` | `PATCH /api/conversations/:id` — `conversations.routes.ts:893`, mount jw. | TAK | `PATCH /conversations/test-id` → **401** | **TAK** |
| 7 | Udostępnij link rozmowy | C_naglowek_historia.md #35e | `ConversationActions.tsx:279-318` `Api.shareConversation` | `POST /api/conversations/:id/share` — `share.routes.ts:257`, mount `Gateway.ts:717 app.use('/api', shareRoutes)` | TAK (mint token) | `POST /conversations/test-id/share` → **401** | **TAK** |
| 8 | Eksportuj rozmowę | C_naglowek_historia.md #35f | `ConversationActions.tsx:321-357` `exportConversation` | `GET /api/conversations/:id/export?format=markdown` — `conversations.routes.ts:2596`, mount jw. | TAK | `GET .../export?format=markdown` → **401** | **TAK** |
| 9 | Wyślij wiadomość (strzałka) | D_pole_wpisywania.md #41 | `EnhancedChatInput.tsx:1335-1345` `handleSend` | `POST /api/ai/chat/stream` — `ai.routes.ts:1627`, mount `Gateway.ts:600 app.use('/api/ai', aiRoutes)` | TAK (główny pipeline) | `POST /ai/chat/stream` → **401** | **TAK** |
| 10 | Upload pliku do czatu | D_pole_wpisywania.md #2 | `AddFilesMenu.tsx:333-338`→`Api.uploadChatAttachment` | `POST /api/ai/attachments/ingest` — `ai.routes.ts:486`, mount jw. | TAK (multer + ekstrakcja) | `POST /ai/attachments/ingest` → **401** | **TAK** |
| 11 | Preferencja chipów sugestii (toggle) | D_pole_wpisywania.md #17 | `ToolsMenu.tsx` `pushChatSuggestionsPreferenceToServer` | `PUT /api/ai-settings/user` — `ai/ai-settings.routes.ts:437`, mount `Gateway.ts:744` | TAK (`AISettingsService.updateUserSettings`, realny UPDATE) | `PUT /ai-settings/user` → **401** | **TAK** |
| 12 | Usuń plik z „Recent” (kosz) | D_pole_wpisywania.md #7 | `AddFilesMenu.tsx:443-451` `handleDeleteRecentDoc` | `DELETE /api/knowledge/documents/:id` — `knowledge.routes.ts:2052`, mount `Gateway.ts:901-907` | TAK (`loadVaultDocumentForRequest` gate + `KnowledgeService.deleteDocument` + soft-delete wersji) `:2052-2073` | `DELETE /knowledge/documents/test-id` → **401** | **TAK** |
| 13 | Kciuk w górę/w dół (feedback) | E_wiadomosci.md #20 | `MessageRenderer.tsx:2143` `onFeedback`→`handleFeedback` | `POST /api/ai-feedback/response` — `ai-feedback.routes.ts:445`, mount `Gateway.ts:723` | TAK (`adaptiveResponseService.processFeedback`, realny zapis profilu stylu) `:441-470` | `POST /ai-feedback/response` → **401** | **TAK** |
| 14 | Wyślij zgłoszenie (report na wiadomość) | E_wiadomosci.md #30 | `MessageRenderer.tsx:2326` `handleSubmitReport` | `POST /api/ai/report` — `ai.routes.ts:8425`, mount `Gateway.ts:600` | TAK | `POST /ai/report` → **401** | **TAK** |
| 15 | Zapisz jako decyzję (Deep Thinking) | E_wiadomosci.md #33 | `MessageRenderer.tsx:2412` `handleSaveAsDecision` | `POST /api/ai/deep-thinking/save-decision` — `deep-thinking.routes.ts:62`, mount `ai/index.ts:72` pod `/api/ai` | TAK | `POST /ai/deep-thinking/save-decision` → **401** | **TAK** |
| 16 | ExecutionProposalMessage — Zatwierdź | E_wiadomosci.md #48 | `ExecutionProposalMessage.tsx:498` `onApprove`→`Api.approveAIAction` | `POST /api/ai/actions/:id/approve` — `ai.routes.ts:8259`, mount jw. | TAK (`AIActionExecutor.approveAction`) | `POST /ai/actions/test-id/approve` → **401** | **TAK** |

Uwaga poboczna (nie żądana, ale zauważona przy weryfikacji #16): w `ai.routes.ts` istnieją DWIE trasy na wzorcu `/actions/:param/approve` — `PATCH /actions/:id/approve` (`:7154`) i `POST /actions/:actionId/approve` (`:8259`). Różne metody HTTP, więc się NIE przesłaniają — sprawdzone, nie jest to defekt.

## Liczby

- Część 1: 4/4 werdykty wydane, WSZYSTKIE z własnym niezależnym dowodem plik:linia (żaden nie był „zaufaniem na słowo” audytorowi).
  - POTWIERDZONY: 2 (D-4 CaseIntakeConfirmCard martwy; F/D-1 kickoff ginie na `/chat`)
  - OSŁABIONY: 2 (D-2 „Zapisz jako pomysł” — tworzy z opóźnieniem, nie „nigdy”; D-3 ChatTableProposalCard — UI stale, backend broni idempotencji → P2 nie P1)
  - OBALONY: 0
- Część 2: 16/16 pozycji potwierdzonych TAK (element + handler zgodny z etykietą, trasa zamontowana, kontroler realny — nie stub/501/TODO, curl 401 = trasa istnieje za uwierzytelnieniem). Rozjazdów: 0.

---

**Do nadzorcy (10 linii):**
1. D-2 (Zapisz jako pomysł) → **OSŁABIONY**: rekord POWSTAJE (Api.createMyIdea w `IdeaMapWorkspace.tsx:1638` po automatycznym mount), tylko z opóźnieniem, nie w handlerze klika. Notatka (bliźniacza akcja) zapisuje się od razu, poprawnie.
2. D-3 (ChatTableProposalCard) → **OSŁABIONY do P2**: front pokazuje stary stan po F5, ALE backend (`ChatToSchemaService.ts:480-482,594`) blokuje ponowne wykonanie przez status w bazie — druga próba = 500, nie duplikat.
3. D-4 (CaseIntakeConfirmCard) → **POTWIERDZONY**: 0 producentów `metadata.type==='case_intake_proposal'` w całym repo poza samym komponentem; komponent sam to przyznaje w nagłówku.
4. F/D-1 (kickoff z Pomocy na /chat) → **POTWIERDZONY**: `/chat` renderuje `UnifiedChatPanel` jako dziecko `AppRoutes`, BEZ propa `kickoffMessage`; jedyny konsument store'u to `MainLayout.tsx:505-506`, montowany gdzie indziej.
5. Próbka: 16/16 potwierdzonych, rozjazdy: brak.

Plik: `/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/31514c23-710c-4185-9a65-43bd25b234d4/scratchpad/audyt-czat/V2_weryfikacja_P1_i_probka.md`
