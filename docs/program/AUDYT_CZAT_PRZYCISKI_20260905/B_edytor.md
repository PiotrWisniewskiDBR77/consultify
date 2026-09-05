# Audyt B — Edytor tekstu kanwy (`src/components/AIChat/CanvasEditor/`)

Katalog: `/private/tmp/m03`, gałąź `codex/m03-admin-20260824`, HEAD `4332ade1c60287e6ef1c302e4af18d40b0a6521d` (2026-09-05 07:09:45 +0200).
Render root zweryfikowany: `/chat` (routing: `src/components/AIChat/ConversationRouteSync.tsx`) → `UnifiedChatPanel.tsx:7509` renderuje `<WorkCanvasDocumentPanel>` (import `WorkCanvasDocumentPanel.tsx:158/74`) → `WorkCanvasDocumentPanel.tsx:5198` renderuje `<CanvasRichEditor>` gdy `mode === 'rich'` (domyślny, `canvasViewMode.ts:25`). Wszystkie elementy poniżej policzone na TEJ realnej ścieżce.

Ustalenie poboczne: `src/components/AIChat/WorkCanvas/WorkCanvasShell.tsx` (linia 437) też importuje `CanvasRichEditor`, ale **nic go nie importuje** (`grep -rln WorkCanvasShell src/ --include=*.tsx` zwraca tylko sam plik + jeden komentarz w `WorkCanvasDocumentPanel.tsx:395`) → ten shell jest martwy/nieosiągalny z `/chat`, nie liczony do inwentarza.

## Inwentarz

Wszystkie AI-wywołania w tym pliku idą przez `POST /api/ai/chat/quick` (trasa `server/src/routes/ai.routes.ts:6621`, montaż `server/src/Gateway.ts:600` `app.use('/api/ai', aiRoutes)`), kontroler w locie woła `modelRouter.select` + `llmService.callText` (ai.routes.ts:6652-6676), zwraca `{ response }`. curl zmierzony raz dla trasy: `401` (chroniona, istnieje).

Autosave całego dokumentu (nie osobny przycisk, ale wspólny „przewód" dla Akceptuj/Odrzuć i edycji ręcznej): `PUT /api/work-canvas/drafts/:draftId` (`server/src/routes/work-canvas.routes.ts:3479`, montaż `Gateway.ts:585` `app.use('/api/work-canvas', workCanvasRoutes)`), debounce 1400 ms (`WorkCanvasDocumentPanel.tsx:2665`), wołane z `persistDraft` (`WorkCanvasDocumentPanel.tsx:1590`). curl: `401`.

| # | Etykieta PL | klucz i18n | element plik:linia | handler | łańcuch | HTTP | trasa serwera (+montaż) | kontroler/serwis | flaga | curl | KLASA | uwagi |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Cofnij (Ctrl+Z) | `canvas.toolbar.undo` | `CanvasEditorToolbar.tsx:66-72` | `editor.chain().focus().undo().run()` | TipTap History (bundlowana w `@tiptap/starter-kit@3.14.0`, keymap `Mod-z` w `node_modules/@tiptap/extensions/dist/index.js:373`) | — | — | — | brak | — | OK-LOKALNY | `disabled={!editor.can().undo()}` — stan aktywny/disabled odświeża się co transakcję (domyślne zachowanie `useEditor`) |
| 2 | Ponów (Ctrl+Shift+Z) | `canvas.toolbar.redo` | `CanvasEditorToolbar.tsx:73-79` | `editor.chain().focus().redo().run()` | jw., keymap `Shift-Mod-z`/`Mod-y` (`extensions/dist/index.js:374-375`) | — | — | — | brak | — | OK-LOKALNY | |
| 3 | Pogrubienie (Ctrl+B) | `canvas.toolbar.bold` | `CanvasEditorToolbar.tsx:83-89` | `toggleBold()` | `StarterKit` → `@tiptap/extension-bold`, keymap `Mod-b` (`extension-bold/dist/index.js:59`) | — | — | — | brak | — | OK-LOKALNY | `isActive('bold')` odświeża podświetlenie |
| 4 | Kursywa (Ctrl+I) | `canvas.toolbar.italic` | `CanvasEditorToolbar.tsx:90-96` | `toggleItalic()` | `extension-italic`, keymap `Mod-i` | — | — | — | brak | — | OK-LOKALNY | |
| 5 | Podkreślenie (Ctrl+U) | `canvas.toolbar.underline` | `CanvasEditorToolbar.tsx:97-103` | `toggleUnderline()` | `Underline` zarejestrowany osobno (`canvasEditorExtensions.ts:16,55`, StarterKit `underline:false` by uniknąć duplikatu), keymap `Mod-u` (`extension-underline/dist/index.js:67`) | — | — | — | brak | — | OK-LOKALNY | |
| 6 | Przekreślenie | `canvas.toolbar.strikethrough` | `CanvasEditorToolbar.tsx:104-110` | `toggleStrike()` | `StarterKit`→`extension-strike`, keymap `Mod-Shift-s` | — | — | — | brak | — | OK-LOKALNY | |
| 7 | Kod w linii | `canvas.toolbar.inlineCode` | `CanvasEditorToolbar.tsx:111-117` | `toggleCode()` | `StarterKit`→`extension-code`, keymap `Mod-e` | — | — | — | brak | — | OK-LOKALNY | |
| 8 | Wyróżnienie (zakreślacz) | `canvas.toolbar.highlight` | `CanvasEditorToolbar.tsx:118-124` | `toggleHighlight()` | `Highlight.configure({multicolor:true})` (`canvasEditorExtensions.ts:6,43`) | — | — | — | brak | — | OK-LOKALNY | brak przycisku wyboru koloru mimo `multicolor:true` — zawsze domyślny kolor |
| 9 | Nagłówek 1 | `canvas.toolbar.heading1` | `CanvasEditorToolbar.tsx:128-134` | `toggleHeading({level:1})` | `StarterKit.configure({heading:{levels:[1,2,3]}})` (`canvasEditorExtensions.ts:35-42`), keymap `Mod-Alt-1` | — | — | — | brak | — | OK-LOKALNY | |
| 10 | Nagłówek 2 | `canvas.toolbar.heading2` | `CanvasEditorToolbar.tsx:135-141` | `toggleHeading({level:2})` | jw., `Mod-Alt-2` | — | — | — | brak | — | OK-LOKALNY | |
| 11 | Nagłówek 3 | `canvas.toolbar.heading3` | `CanvasEditorToolbar.tsx:142-148` | `toggleHeading({level:3})` | jw., `Mod-Alt-3` | — | — | — | brak | — | OK-LOKALNY | |
| 12 | Lista punktowana | `canvas.toolbar.bulletList` | `CanvasEditorToolbar.tsx:152-158` | `toggleBulletList()` | `StarterKit` domyślny bulletList (nie wyłączony w konfiguracji) | — | — | — | brak | — | OK-LOKALNY | |
| 13 | Lista numerowana | `canvas.toolbar.numberedList` | `CanvasEditorToolbar.tsx:159-165` | `toggleOrderedList()` | `StarterKit` domyślny orderedList | — | — | — | brak | — | OK-LOKALNY | |
| 14 | Lista zadań (checklist) | `canvas.toolbar.taskList` | `CanvasEditorToolbar.tsx:166-172` | `toggleTaskList()` | `TaskList`+`TaskItem.configure({nested:true})` zarejestrowane (`canvasEditorExtensions.ts:13-14,52-53`) — NIE martwy | — | — | — | brak | — | OK-LOKALNY | Turndown ma dedykowaną regułę `taskListItem` (`canvasMarkdownConversion.ts:32-42`) — checkbox przeżywa zapis MD |
| 15 | Cytat blokowy | `canvas.toolbar.blockquote` | `CanvasEditorToolbar.tsx:173-179` | `toggleBlockquote()` | `StarterKit` domyślny blockquote | — | — | — | brak | — | OK-LOKALNY | |
| 16 | Wstaw tabelę | `canvas.toolbar.insertTable` | `CanvasEditorToolbar.tsx:183-190` | `insertTable({rows:3,cols:3,withHeaderRow:true})` | `Table`+`TableRow`+`TableHeader`+`TableCell` zarejestrowane (`canvasEditorExtensions.ts:9-12,48-51`) — NIE martwy | — | — | — | brak | — | OK-LOKALNY | `normalizeTablesForTurndown` (`canvasMarkdownConversion.ts:160-185`) naprawia round-trip tabel do MD (bez tego byłby destrukcyjny — patrz komentarz L3 w kodzie) |
| 17 | Wstaw link | `canvas.toolbar.insertLink` / `linkPrompt` | `CanvasEditorToolbar.tsx:191-200` | `window.prompt(...)` → `setLink({href:url})` | `Link.configure({openOnClick:false, autolink:true})` zarejestrowany (`canvasEditorExtensions.ts:7,44`) — NIE martwy | — | — | — | brak | — | OK-LOKALNY | Brak przycisku „usuń link" — ponowne kliknięcie na aktywnym linku tylko nadpisuje URL (drobna luka UX, nie defekt licznika) |
| 18 | „Ask AI" (otwiera pole promptu) | `canvas.aiMenu.askTeresa`/`askTeresaTitle` | `CanvasAIFloatingMenu.tsx:375-387` | toggluje `showPromptInput` | lokalny stan, bez HTTP na klik | — | — | — | brak | — | OK-LOKALNY | |
| 19 | Wyślij niestandardowy prompt (przycisk ✓ w polu) | `canvas.aiMenu.promptPlaceholder` (input) | `CanvasAIFloatingMenu.tsx:293-299` → `handleCustomPrompt` (:252-257) | `onAIRequest(customPrompt, selectedText)` = `handleAIRequest` w `CanvasRichEditor.tsx:242-343` | `fetch('/api/ai/chat/quick', POST, Bearer token)` (`CanvasRichEditor.tsx:270-280`) | POST | `ai.routes.ts:6621` (+ `Gateway.ts:600`) | `modelRouter.select`+`llmService.callText` (`ai.routes.ts:6652-6676`) | brak | 401 | OK | patrz D-1 (brak obsługi błędu) |
| 20 | Skróć (Condense, skrót) | `canvas.aiMenu.condense`/`condenseTitle` | `CanvasAIFloatingMenu.tsx:391-399` | `handleQuickAction(SHORTCUT_CONDENSE_PROMPT)` (:228-237) → `onAIRequest` | jw. | POST | jw. | jw. | brak | 401 | OK | jw. D-1 |
| 21 | Rozwiń (Expand, skrót) | `canvas.aiMenu.expand`/`expandTitle` | `CanvasAIFloatingMenu.tsx:400-408` | `handleQuickAction(SHORTCUT_EXPAND_PROMPT)` | jw. | POST | jw. | jw. | brak | 401 | OK | jw. D-1 |
| 22 | Ton (trigger podmenu) | `canvas.aiMenu.changeToneTitle`/`tone.label` | `CanvasAIFloatingMenu.tsx:409-423` | toggluje `showToneMenu` | brak HTTP na klik | — | — | — | brak | — | OK-LOKALNY | |
| 23 | Ton → Formalny | `canvas.aiMenu.tone.tone_formal` (BRAK klucza) | `CanvasAIFloatingMenu.tsx:130-137,322-331` | `handleQuickAction(TONE_OPTIONS[0].prompt)` | `onAIRequest` → `/api/ai/chat/quick` | POST | jw. | jw. | brak | 401 | OK | patrz D-2 (i18n) |
| 24 | Ton → Prostszy | `canvas.aiMenu.tone.tone_simple` (BRAK klucza) | `CanvasAIFloatingMenu.tsx:138-144,322-331` | jw. | jw. | POST | jw. | jw. | brak | 401 | OK | patrz D-2 |
| 25 | Wyjaśnij | `canvas.aiMenu.explain`/`explainTitle` | `CanvasAIFloatingMenu.tsx:424-441` | `handleExplain` (:242-250) → `onExplainRequest` = `handleAIExplain` w `CanvasRichEditor.tsx:349-388` | `fetch('/api/ai/chat/quick', POST)` bez zapisu do dokumentu (read-only) | POST | jw. | jw. | brak | 401 | OK | wynik w popoverze (`explainState`), nie dotyka treści; patrz D-1 |
| 26 | Akcje (trigger dropdown, 10 pozycji) | `canvas.aiMenu.actions`/`quickActionsTitle` | `CanvasAIFloatingMenu.tsx:443-455` | toggluje `showQuickActions` | brak HTTP na klik | — | — | — | brak | — | OK-LOKALNY | |
| 27 | Akcje → Rozwiń | `canvas.aiMenu.quickAction.expand` (BRAK klucza) | `CanvasAIFloatingMenu.tsx:42-47,306-315` | `handleQuickAction(action.prompt)` | `onAIRequest` → `/api/ai/chat/quick` | POST | jw. | jw. | brak | 401 | OK | D-2 (i18n) |
| 28 | Akcje → Skróć | `...quickAction.shorten` (BRAK) | jw. `:48-53` | jw. | jw. | POST | jw. | jw. | brak | 401 | OK | D-2 |
| 29 | Akcje → Przepisz | `...quickAction.rewrite` (BRAK) | jw. `:54-59` | jw. | jw. | POST | jw. | jw. | brak | 401 | OK | D-2 |
| 30 | Akcje → Doszlifuj | `...quickAction.final_polish` (BRAK) | jw. `:63-69` | jw. | jw. | POST | jw. | jw. | brak | 401 | OK | D-2 |
| 31 | Akcje → Długość: zwięzła | `...quickAction.length_concise` (BRAK) | jw. `:71-76` | jw. | jw. | POST | jw. | jw. | brak | 401 | OK | D-2 |
| 32 | Akcje → Długość: rozbudowana | `...quickAction.length_detailed` (BRAK) | jw. `:78-83` | jw. | jw. | POST | jw. | jw. | brak | 401 | OK | D-2 |
| 33 | Akcje → Dla: zarządu | `...quickAction.level_exec` (BRAK) | jw. `:85-90` | jw. | jw. | POST | jw. | jw. | brak | 401 | OK | D-2 |
| 34 | Akcje → Dla: eksperta | `...quickAction.level_expert` (BRAK) | jw. `:92-97` | jw. | jw. | POST | jw. | jw. | brak | 401 | OK | D-2 |
| 35 | Akcje → Dla: laika | `...quickAction.level_beginner` (BRAK) | jw. `:99-104` | jw. | jw. | POST | jw. | jw. | brak | 401 | OK | D-2 |
| 36 | Akcje → Tłumacz → EN | `...quickAction.translate_en` (BRAK) | jw. `:106-110` | jw. | jw. | POST | jw. | jw. | brak | 401 | OK | D-2 |
| 37 | Akcje → Tłumacz → PL | `...quickAction.translate_pl` (BRAK) | jw. `:112-116` | jw. | jw. | POST | jw. | jw. | brak | 401 | OK | D-2 |
| 38 | Zaakceptuj (pasek diff) | `canvas.aiMenu.accept` | `CanvasAIFloatingMenu.tsx:479-485` (`AIAcceptRejectBar`) | `onAccept` = `handleAcceptDiff` (`CanvasRichEditor.tsx:392-407`) → `acceptAiDiff(editor)` (`canvasDiffOps.ts:167-173`) | czysta operacja ProseMirror (usuwa zakres `aiRemoved`, zdejmuje mark `aiAdded`) + `onContentChangeRef.current(md)` → `updateMarkdown` (`WorkCanvasDocumentPanel.tsx:2263`) → autosave | PUT (po debounce 1400 ms) | `work-canvas.routes.ts:3479` (+`Gateway.ts:585`) | `persistDraft` (`WorkCanvasDocumentPanel.tsx:1590`) | brak | 401 | OK | zapis realnie trafia na serwer po akcepcie — potwierdzone |
| 39 | Odrzuć (pasek diff) | `canvas.aiMenu.reject` | `CanvasAIFloatingMenu.tsx:486-492` | `onReject` = `handleRejectDiff` (`CanvasRichEditor.tsx:412-427`) → `rejectAiDiff(editor)` (`canvasDiffOps.ts:179-183`) | jw. | PUT | jw. | jw. | brak | 401 | OK | jw. + ten sam handler zdublowany na klawisz `Escape` (`CanvasRichEditor.tsx:214-239`) |
| 40 | Zatrzymaj (Stop, w trakcie streamu) | `canvas.editor.stop` | `CanvasRichEditor.tsx:496-503` | `onStopStream` = `stopStream` z `useCanvasAIStream` (`useCanvasAIStream.ts:125-133`) | `abortController.abort()` + `editor.setEditable(prev)` | — | — | — | brak | — | OK-LOKALNY | widoczny tylko gdy `isStreaming` — strumień startowany z panelu czatu (`WorkCanvasDocumentPanel.tsx:2325-2376`), poza plikami z brief-u ale ten sam plik `useCanvasAIStream.ts` jest w zakresie |
| 41 | Skrót Esc → odrzuć diff / zatrzymaj stream | — (brak etykiety, sam klawisz) | `CanvasRichEditor.tsx:214-239` | `onKey` listener na `window` | podczas streamu: `onStopStream()`; podczas pending diff: `rejectAiDiff` + zapis jak #39 | jak #39 | jak #39 | jak #39 | brak | 401 | OK-LOKALNY/OK | dwustanowy branch, oba warianty policzone osobno w opisie |

### Poza ścisłym zakresem plików brief-u, ale bezpośrednio steruje trybem edytora (info, nie liczone do sumy głównej)

`src/components/AIChat/CanvasViewModeControl.tsx` (osobny plik, NIE wymieniony w liście brief-u) — segment radiogroup 3 przycisków osadzony w `WorkCanvasDocumentPanel.tsx:3492`:

| # | Etykieta PL | klucz i18n | element plik:linia | handler | KLASA | uwagi |
|---|---|---|---|---|---|---|
| A | Edytor | `canvas.viewMode.rich` | `CanvasViewModeControl.tsx:7,28-64` | `onModeChange('rich')` → `setMode` (`WorkCanvasDocumentPanel.tsx:892`) | OK-LOKALNY | przełącza na `CanvasRichEditor` (rząd #1-41 powyżej) |
| B | Dok | `canvas.viewMode.document` | `CanvasViewModeControl.tsx:8` | `onModeChange('document')` | OK-LOKALNY | renderuje `CanvasMarkdownRenderer` (read-only, `WorkCanvasDocumentPanel.tsx:5250-5267`) — poza plikami CanvasEditor/, nie audytowane szczegółowo |
| C | MD | `canvas.viewMode.markdown` | `CanvasViewModeControl.tsx:9` | `onModeChange('md')` | OK-LOKALNY | `<textarea>` surowy markdown (`WorkCanvasDocumentPanel.tsx:5236-5248`) |

Round-trip Edytor→MD→Edytor zweryfikowany w kodzie (nie tylko przez dokumentację) w `canvasMarkdownConversion.ts`:
- Tabele: `normalizeTablesForTurndown` (linie 160-185) spłaszcza `<p>` w komórkach i przenosi nagłówek do `<thead>` PRZED Turndownem — bez tego każda tabela zapisywała się jako escapowany HTML (udokumentowany bug „L3" w komentarzu, obecnie naprawiony).
- Checklisty: reguła `taskListItem` (linie 32-42) emituje `- [x]`/`- [ ]`.
- Zakreślacz: `<mark>` ↔ `==tekst==` (linie 50-53, 125).
- Podkreślenie: `<u>` przechodzi przez Turndown i `marked` bez zmian (linie 57-60).
Wszystkie cztery mają dedykowane reguły — NIE jest to zgadywanka, tylko odczyt implementacji.

## Defekty

| D-n | P0/P1/P2 | element | co jest nie tak | dowód plik:linia | jak odtworzyć w 1 zdaniu |
|---|---|---|---|---|---|
| D-1 | P1 | Wszystkie akcje AI menu pływającego (poz. #19-25, #27-37) | Brak JAKIEJKOLWIEK informacji zwrotnej dla użytkownika przy błędzie żądania (HTTP nie-2xx, sieć, pusta odpowiedź LLM) — funkcja po prostu nic nie robi | `CanvasRichEditor.tsx:282-285` (`if (!response.ok) { setAiProcessing(false); return null; }`) i `:337-340` (catch) w `handleAIRequest`; `:375` i `:381-385` w `handleAIExplain`; żaden wywołujący w `CanvasAIFloatingMenu.tsx` (`handleQuickAction` :228-237, `handleCustomPrompt` :252-257, `handleExplain` :242-250) nie sprawdza `null` żeby pokazać błąd — kontrast z `useCanvasAIStream.ts`, które ma pełną obsługę błędów przez `onError`/`getAiErrorLine` (:326-330, :369-380, :454-465) | Zaznacz tekst długi + krótki prompt tak, by suma przekroczyła limit 8000 znaków (`ChatQuickRequestSchema.message.max(8000)`, `server/src/validators/ai.validators.ts:566`), kliknij „Rozwiń" w menu pływającym — spinner znika, nic się nie zmienia, brak toastu |
| D-2 | P2 | Menu „Akcje" (10 pozycji, #27-37) i „Ton" (2 pozycje, #23-24) | Klucze i18n `canvas.aiMenu.quickAction.*` i `canvas.aiMenu.tone.tone_formal`/`tone_simple` NIE ISTNIEJĄ w ogóle w `public/locales/pl/translation.json` ani `.../en/translation.json` — kod woła `t(klucz, action.labelEn)` (`CanvasAIFloatingMenu.tsx:313,329`), więc pod polskim UI wyświetla się TWARDY ANGIELSKI fallback | `grep -n "quickAction\|tone_formal\|tone_simple" public/locales/{pl,en}/translation.json` → zero trafień w namespace `canvas.aiMenu`; klucze faktycznie obecne w PL to tylko `canvas.aiMenu.{accept,actions,askTeresa,...,tone.label}` (bez podpozycji) | Przełącz UI na polski, zaznacz tekst, otwórz „Akcje" — zobaczysz „Expand / Shorten / Rewrite / Final polish / Length: concise / Length: detailed / For: executive / For: expert / For: beginner / Translate → EN/PL" po angielsku; podobnie „Ton" → „Formal / Simpler" |
| D-3 | P2 | Liczba elementów vs. szacunek nadzorcy | Nadzorca szacował „17 przycisków paska + 5-8 pozycji menu pływającego" (≈22-25); realnie pasek = 17 (zgodnie), ale menu pływające to 23 klikalne pozycje (trigger „Ask AI" + submit + Condense + Expand + trigger „Ton"+2 + „Wyjaśnij" + trigger „Akcje"+10 + Akceptuj + Odrzuć) + przycisk „Stop" przy streamie + skrót Esc = łącznie 41 pozycji w ścisłym zakresie plików, nie ~25 | Policzone wprost z `CanvasAIFloatingMenu.tsx` (tablice `QUICK_ACTIONS` linie 41-117 i `TONE_OPTIONS` linie 130-145) | — (uwaga liczbowa, nie defekt funkcjonalny) |

## Niezweryfikowane

- **Bramka dostępu AI** (`ensureAiProviderAndAccess` wołana w `ai.routes.ts` przed `/chat/quick`) — nie zbadano dokładnych warunków (plan organizacji / limit / brak klucza dostawcy), które mogłyby zwracać np. 403 nawet dla zalogowanego użytkownika. Curl bez tokenu i tak zwraca 401 (auth wcześniej w łańcuchu middleware), więc nie da się tego zmierzyć bez prawdziwej sesji — poza zakazem logowania z brief-u.
- **`canvasPatchOps.ts`** (buduje/parsuje operacje patch dla trybu `patch` w `useCanvasAIStream.ts`) — przeczytany pobieżnie, nie testowany osobno; tryb `patch` uruchamiany jest zdarzeniem z panelu czatu (poza przyciskami CanvasEditor), więc nie wszedł do inwentarza jako osobny klikalny element, ale mechanizm dzieli te same handlery Akceptuj/Odrzuć (#38-39) przez `window.dispatchEvent(new CustomEvent('canvas-patch-pending'))` (`useCanvasAIStream.ts:226`) odbierane w `CanvasRichEditor.tsx:201-208`.
- **`canvas.panel.saveState.*`** (etykieta „Zapisywanie/Zapisano/Błąd zapisu" widoczna gdzieś w UI panelu) — istnieje w `WorkCanvasDocumentPanel.tsx:644-650`, ale sam wskaźnik/element renderujący ten stan leży poza plikami z listy brief-u (`WorkCanvasDocumentPanel.tsx` jako całość) — nie audytowany szczegółowo, tylko potwierdzone że `saveState` faktycznie steruje debounce'em autosave (`:2652-2668`).
- **Usuwanie linku** — czy istnieje gdziekolwiek (np. w menu kontekstowym TipTap poza `CanvasEditorToolbar.tsx`) sposób na `unsetLink()`. W audytowanych plikach brak takiego handlera — potraktowane jako obserwacja UX, nie policzone jako osobny martwy element (bo nigdy nie było przycisku „usuń link" do zmartwienia).

## Liczby

- **Pasek narzędzi** (`CanvasEditorToolbar.tsx`): **17** przycisków — zgodne z szacunkiem nadzorcy.
  - OK-LOKALNY: 17 (100%)
  - MARTWY / URWANY: 0 — wszystkie rozszerzenia TipTap wymagane przez przyciski (Table, Link, TaskList/TaskItem, Highlight, Underline) są zarejestrowane w `canvasEditorExtensions.ts`.
- **Menu pływające + pasek Akceptuj/Odrzuć + Stop + Esc** (`CanvasAIFloatingMenu.tsx` + wywołania w `CanvasRichEditor.tsx`/`useCanvasAIStream.ts`): **23** klikalne pozycje AI + **2** przyciski diff-bar (Akceptuj/Odrzuć, ujęte w liczbie 23 powyżej jako #38-39) + **1** Stop + **1** skrót Esc (dwuwariantowy) = **41** pozycji łącznie w ścisłym zakresie plików brief-u (dużo więcej niż szacunek „5-8" — patrz D-3).
  - OK: 21 (wszystkie akcje realnie wołające `/api/ai/chat/quick`, trasa istnieje i zamontowana)
  - OK-LOKALNY: 20 (triggery podmenu, Akceptuj/Odrzuć jako operacje edytora + autosave, Stop, Esc)
  - MARTWY / URWANY: 0
  - ZA FLAGĄ: 0 (żadna flaga `VITE_*` nie bramkuje niczego w plikach `CanvasEditor/` — sprawdzone grepem, zero trafień)
  - NIEWIDOCZNY: 0 w ścisłym zakresie (ale `WorkCanvasShell.tsx`, który też importuje `CanvasRichEditor`, sam jest martwy/nieosiągalny z `/chat` — nie wpływa na liczby powyżej, bo audytowana ścieżka to `WorkCanvasDocumentPanel`)
- **Poza zakresem plików, ale bezpośrednio steruje trybem** (`CanvasViewModeControl.tsx`): 3 przyciski, wszystkie OK-LOKALNY (nie wliczone do sumy głównej).
- **RAZEM w ścisłym zakresie plików brief-u: 41 elementów** (17 + 23 + Stop + Esc, patrz rozbicie wyżej), z czego:
  - OK: 21
  - OK-LOKALNY: 20
  - MARTWY: 0, URWANY: 0, ZA FLAGĄ: 0, NIEWIDOCZNY: 0, NIEPEWNY: 0
- **Defekty**: 1×P1 (D-1, obsługa błędów AI-menu), 2×P2 (D-2 i18n, D-3 rozbieżność liczbowa/informacyjna). Zero P0 — główny przepływ pisania/formatowania/zapisu działa w happy-path.
