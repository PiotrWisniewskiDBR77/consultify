# TESTY — M02 Canvas (edytor dokumentu, split-view Teresa ↔ dokument)

> **Moduł:** M02 Canvas (split-view w czacie + deliverables-light; panel w czacie oraz `/ai/work-canvas`, share `/public/artifacts/:token`) — wg `Harvard/podzial/_MODULE_MAP_V2.md`
> **Zakres tej paczki:** cały górny pasek Canvasa (akcje przesyłania, zapisywania, promote, historia, menu „…"), pasek formatowania edytora oraz edycja AI z diff accept/reject. Canvas „na poziomie Claude".
> **Cel:** agent piszący i testujący moduł ma na tej podstawie dogłębnie przetestować pracę z wszystkimi przyciskami edycji (tworzenie, zmienianie) oraz aktywność wszystkich przycisków przesyłania, zapisywania i działania całego górnego menu — z weryfikacją E2E.
> **Data:** 2026-06-14

---

## 0. Architektura i mapa plików

| Obszar | Komponent | Plik |
|---|---|---|
| Górny pasek + akcje + menu „…" | `WorkCanvasDocumentPanel` | `src/components/AIChat/WorkCanvasDocumentPanel.tsx` |
| Pasek formatowania (B/I/U…) | `CanvasEditorToolbar` | `src/components/AIChat/CanvasEditor/CanvasEditorToolbar.tsx` |
| Edytor TipTap + diff | `CanvasRichEditor` | `src/components/AIChat/CanvasEditor/CanvasRichEditor.tsx` |
| Pływające menu AI (zaznaczenie) | `CanvasAIFloatingMenu` + `AIAcceptRejectBar` | `src/components/AIChat/CanvasEditor/CanvasAIFloatingMenu.tsx` |
| Historia wersji | `CanvasVersionHistory` | `src/components/AIChat/CanvasEditor/CanvasVersionHistory.tsx` |
| Wariant standalone `/work-canvas` | `WorkCanvasShell` | `src/components/AIChat/WorkCanvas/WorkCanvasShell.tsx` |

**Dwa modele „kanwy" w kodzie** — przetestuj OBA i odnotuj różnice:
- **Chat-shell Canvas** (zrzut: pasek PROMOTE + dyskietka) = `WorkCanvasDocumentPanel`, otwierany ze split-view czatu.
- **Standalone** `/ai/work-canvas` = `WorkCanvasShell` (inne taby kind, „Save artifact", proposal Approve/Reject).

**Kluczowa zasada (bramki capability):** akcje output i promote są bramkowane przez `runtimeCapabilities` (`canCreatePresentation`, `canSendToIdea`, `canCreateTask`, `canShare`…). Poza środowiskiem testowym Vitest domyślnie są **wyłączone** (`defaultCanvasRuntimeCapabilities`, linie 355-367). Tester MUSI:
1. potwierdzić, że przy braku capability przycisk jest niedostępny i pokazuje powód (`getCanvasActionAvailability` → `handleUnavailableAction`),
2. przetestować realne działanie na koncie/orgu, które MA capability (owner DBR77).

**Setup:** dev server, konto z capability, DevTools (Network + Console = 0 błędów). Otwórz czat → poproś Teresę „Zrób notatkę roboczą po prawej" → Canvas pojawia się w split-view. Miej dataset/tabelę do testów eksportów tabelarycznych.

---

## 1. Górny pasek — tytuł i przyciski

### 1.1 Tytuł dokumentu (input, `data-testid=canvas-active-title`)
- Edytowalny inline; `updateTitle` na zmianę.
- **onBlur:** jeśli jest `draftId` i tytuł niepusty → `persistDraft()` (autozapis tytułu). Sprawdź w Network wywołanie zapisu.
- Pusty tytuł → brak zapisu na blur (zweryfikuj brak crasha).
- Bardzo długi tytuł → truncate w nagłówku, pełny w polu.

### 1.2 „+" New Canvas (`canvas-new-menu-root`)
- Klik → toggle menu „New Canvas from template"; jednocześnie zamyka menu diagnostyczne.
- Lista `starterTemplates` z opisem i badge capability.
- Klik szablonu → `selectTemplate(template)`, menu zamknięte, dokument zmienia się na szablon, aktywny szablon podświetlony.
- **Edge:** wybór szablonu przy niezapisanych zmianach — sprawdź, czy ostrzega/nadpisuje (odnotuj zachowanie). Klik poza menu zamyka (listener na `canvas-new-menu-root`/`canvas-menu-root`).

### 1.3 Akcje OUTPUT (grupa `canvas-output-actions`) — 3 ikony
`menuOutputActionIds` = `create-presentation` (ikona Presentation), `create-table` (Table2), `create-report` (FileText).
Dla każdej:
- **Z capability:** klik → `runOutputAction(actionId, target)`; przycisk pokazuje stan ładowania (`activeActionId === actionId` → spinner). Po sukcesie powstaje artefakt (prezentacja/tabela/raport) — zweryfikuj w Network i w Outputs/odpowiednim module.
- **Bez capability:** przycisk nieaktywny, tytuł = `label: reason/status`, klik → `handleUnavailableAction` (komunikat zamiast akcji). Potwierdź, że NIE wysyła żądania.
- **`create-table`/eksport tabel:** sensowne tylko dla treści tabelarycznej — sprawdź zachowanie dla dokumentu narracyjnego.

### 1.3a Generowanie treści z TABELAMI (N-9) — OBOWIĄZKOWE
Canvas MA tworzyć tabele, nie tylko prozę. Test E2E generacji tabelarycznej:
- **Prompt A (po polsku):** „Przygotuj raport porównujący 3 scenariusze wdrożenia AI: koszty, czas wdrożenia i ROI. Dodaj macierz ryzyk oraz roadmapę kwartalną. Użyj tabel." → oczekiwane: w dokumencie ≥3 tabele Markdown GFM renderowane jako prawdziwe `<table>` w edytorze TipTap (nie tekst z `|`).
- **Prompt B (po angielsku):** analogiczny request „use tables" → tabele + nagłówki w języku usera.
- **Weryfikacja źródła prawdy:** `GET /api/work-canvas/drafts/:id` → pole `contentMd` MUSI zawierać wiersze nagłówka + separatora `|---|---|` + wiersze danych dla sekcji tabelarycznych (scenariusze/koszty/ROI, ryzyka, roadmapa, KPI, porównania). Policz `tableSeparators` ≥ liczby sekcji tabelarycznych.
- **Render wizualny:** w panelu Canvas tabela ma być widoczna jako siatka (obramowania komórek), nie jako linia tekstu z pionowymi kreskami. Wymaga pustej linii nad tabelą (`ensureTableSpacing`) bo front `marked` ma `breaks:false`.
- **Nagłówki sekcji (N-10):** dla promptu PL nagłówki po polsku (Streszczenie wykonawcze, Kontekst strategiczny, Fale roadmapy, Ryzyka i zależności, Ład/Governance, Załącznik…); dla EN — po angielsku.
- **Edge — proza vs tabela:** dla sekcji czysto narracyjnej (np. Streszczenie) NIE wymuszać tabeli; tabele tylko tam, gdzie zwiększają czytelność.
- **Antyregresja:** „append clobber" — podczas streamingu generacji autosave nie może zostawić częściowej wersji (409 → re-load pełnego draftu). Po zakończeniu reload strony = pełne 9 sekcji z tabelami, nie wersja skrócona.

### 1.4 PROMOTE strip (`canvas-promote-strip` → `canvas-workspace-actions`) — 5 ikon
To wyróżnik produktu (ChatGPT/Claude/Gemini Canvas nie mają odpowiednika). `menuWorkspaceActionIds` = `send-to-idea` (Lightbulb), `save-as-note` (StickyNote), `create-initiative` (Rocket), `create-decision` (Gavel), `create-task` (CheckSquare). Mapują na `workspaceTargets` → `idea/note/initiative/decision/task`.
Dla KAŻDEJ z 5:
- Klik (z capability) → `runWorkspaceAction(actionId, target)`; spinner na aktywnym; po sukcesie powstaje encja w docelowym module.
- **Weryfikacja E2E (obowiązkowa):** po „Send to idea" przejdź do **Initiatives/Ideas** i potwierdź, że idea istnieje z treścią z Canvasa; analogicznie note→Notes, initiative→Initiatives, decision→Decisions, task→My Work/Tasks.
- **Ledger provenance:** po promocji sprawdź sekcję „Utworzone z tego dokumentu" / `materializedTo` (`canvas-materialized-to`) — powinna pokazać utworzony cel z ikoną.
- **Bez capability:** niedostępne + powód, brak żądania.
- **Idempotencja:** dwukrotny klik tej samej akcji — czy tworzy duplikat czy blokuje? Odnotuj.

### 1.5 Akcje plikowe (grupa `canvas-file-actions`) — copy / share / save / close
- **Copy** (Copy) → `copyMarkdown()` do schowka; wklej gdzie indziej i potwierdź pełną treść Markdown.
- **Share** (Share2) → `runShareAction()` — tworzy token udostępnienia (`provenance.share`), zwraca URL `/public/artifacts/:token`. **Bramka `canShare` (domyślnie false!)** — sprawdź gating; z capability: token powstaje, URL kopiowalny, otwórz w trybie incognito i potwierdź publiczny podgląd; sprawdź `expiresAt`. Przetestuj też revoke (jeśli dostępne).
- **Save** (Save) → `persistDraft()`. **Czerwona dyskietka = dirty** (`saveState ∈ {unsaved, failed}`, atrybut `data-save-state`). Po zapisie kolor wraca do neutralnego, `saveState='saved'`. Wymuś `failed` (np. offline) → przycisk czerwony + komunikat błędu.
- **Close** (X) → `onClose()` jeśli przekazany (split-shell); w przeciwnym razie alert „Close is available when Canvas is opened from the split chat shell." Sprawdź, że zamknięcie NIE gubi niezapisanych zmian bez ostrzeżenia (albo że autosave je wcześniej utrwala).

### 1.6 Historia wersji (`canvas-history-root`, ikona History/zegar)
- Klik → toggle; otwarcie woła `openVersionHistory()` → ładuje `versions` (stan ładowania `isVersionsLoading`).
- Popover `CanvasVersionHistory`: lista wersji, `onRestore(version)` → `restoreVersion`. Po restore treść dokumentu = wersja przywrócona; sprawdź, że tworzy nową wersję (nie kasuje historii).
- `onClose` zamyka popover. Pusta historia → stan pusty bez crasha.

### 1.7 Menu „…" (`canvas-menu-root`, diagnostyka) — duże menu
Klik → `canvas-diagnostics-menu`. Zawiera:
- **Widok** (`canvas-view-actions`): „Dock view" → `setMode('document')`, „Markdown view" → `setMode('md')`. Przełącz w obie strony; potwierdź, że obie czytają z **tego samego źródła** (zgodnie z notką w dokumencie „document view and MD view read from the same source") — edytuj w jednym, sprawdź odbicie w drugim.
- **Quick-add elementy:** `setQuickAddElement(id)` + pole instrukcji dla Teresy + `insertQuickAddElement` → wstawia element (heading/table/diagram/list/summary/text) do dokumentu.
- **Selection AI** (gdy zaznaczenie): expand/shorten/rewrite/suggest (`applySelectionMenuAction`) + własny prompt (`previewSelectionMenuPrompt`).
- **Template builder:** toggle, pola (name/goal/sections), „Apply" (`applyBuiltTemplate`), „Cancel".
- **Markdown actions:**
  - Save Markdown → `persistDraft`
  - **Save to Outputs** (`canvas-save-to-outputs`) → `saveToOutputs()`, stan „Saving…", disabled w trakcie; potwierdź wpis w **Outputs hub**.
  - Download Markdown / CSV / PDF / Word(.docx) / PowerPoint(.pptx) → `exportDocument(format)`; sprawdź faktyczne pobranie pliku i poprawność treści.
  - **Download Excel (.xlsx)** — disabled dla nie-tabel (`kind!=='table'`), tooltip wyjaśnia ograniczenie; włącz dla tabeli i pobierz.
  - Copy Markdown → `copyMarkdown`.
  - **Send to Document Studio** → `sendToDocumentStudio()` (stan „Sending…"); potwierdź artefakt w Document Studio/Outputs.
  - **Send to Table Studio** — disabled dla `kind!=='table'`; dla tabeli wysyła i otwiera w Table Studio.
  - Export metadata (JSON) → `exportDocument('json')`.
- Klik poza menu zamyka (`canvas-menu-root`).

---

## 2. Pasek formatowania (`CanvasEditorToolbar`) — edycja tekstu

Każdy przycisk to `editor.chain().focus().<cmd>().run()`. Dla KAŻDEGO testuj: kliknięcie zmienia treść/format, stan aktywny (podświetlenie primary gdy `editor.isActive(...)`), oraz tooltip.

| Przycisk | Komenda | Skrót | Stan aktywny / disabled |
|---|---|---|---|
| Undo | `undo()` | Ctrl+Z | disabled gdy `!can().undo()` |
| Redo | `redo()` | Ctrl+Shift+Z | disabled gdy `!can().redo()` |
| Bold | `toggleBold` | Ctrl+B | aktywny na pogrubieniu |
| Italic | `toggleItalic` | Ctrl+I | — |
| Underline | `toggleUnderline` | Ctrl+U | — |
| Strikethrough | `toggleStrike` | — | — |
| Code (inline `<>`) | `toggleCode` | — | — |
| Highlight | `toggleHighlight` | — | — |
| H1/H2/H3 | `toggleHeading({level})` | — | aktywny dla danego poziomu |
| Bullet list | `toggleBulletList` | — | — |
| Numbered list | `toggleOrderedList` | — | — |
| Task list (checklist) | `toggleTaskList` | — | checkboxy klikalne, zapis stanu |
| Blockquote | `toggleBlockquote` | — | — |
| Insert table | `insertTable({rows:3,cols:3,withHeaderRow:true})` | — | wstawia 3×3 z nagłówkiem; sprawdź edycję komórek, dodawanie wierszy/kolumn |
| Insert link | `window.prompt('Link URL:')` → `setLink({href})` | — | aktywny na linku; pusty prompt = brak akcji; wstaw http(s), sprawdź klikalność |

**Wymagane testy paska:**
- Każdy toggle **włącz i wyłącz** (idempotencja); kombinacje (bold+italic+underline na tym samym tekście).
- Undo/redo po serii edycji (w tym po formatowaniu i po wstawieniu tabeli) — pełna ścieżka cofnięć.
- `onMouseDown` z `preventDefault` — kliknięcie przycisku NIE traci zaznaczenia/focusu w edytorze (krytyczne dla formatowania zaznaczonego tekstu).
- Skróty klawiaturowe działają tożsamo z przyciskami.
- Wrapping paska na wąskim oknie (`flex-wrap`) — wszystkie przyciski dostępne.

---

## 3. Edycja AI na poziomie Claude (`CanvasAIFloatingMenu` + diff) — najważniejsze

To jest „Canvas na poziomie Claude". Przetestuj dogłębnie:

### 3.1 Pojawianie się menu
- Zaznacz fragment tekstu w edytorze → pływające menu pojawia się **nad** zaznaczeniem (pozycja liczona z selection rect).
- Brak zaznaczenia / kliknięcie poza → menu znika.
- Menu nie wychodzi poza viewport; przy zaznaczeniu na górze strony repozycjonuje się rozsądnie.

### 3.2 Szybkie akcje (`QUICK_ACTIONS`) — PL/EN
Przetestuj każdą: **Rozwiń** (expand), **Skróć** (shorten), **Przepisz** (rewrite), **Doszlifuj** (final_polish), **Długość: zwięzła**, **Długość: rozbudowana**, **Dla: zarządu** (executive) i pozostałe presety w pliku.
- Klik → `onAIRequest(prompt, selectedText)` (pipeline `/chat/quick`), spinner (`isProcessing`/`Loader2`).
- Wynik wraca jako **inline diff** w dokumencie (nie nadpisanie!).

### 3.3 Własny prompt
- Pole tekstowe na własną instrukcję → wyślij → ten sam mechanizm diffu.
- Pusty prompt → brak akcji. Bardzo długi → obsłużony.

### 3.4 Diff: Accept / Reject (`AIAcceptRejectBar`, `canvasDiffOps`)
- Po odpowiedzi AI pojawia się pasek **Accept/Reject** + widoczny diff (dodane/usunięte).
- **Accept** → `acceptAiDiff(editor)`, treść utrwalona, `hasPendingDiff=false`, provenance event `accept`.
- **Reject** → `rejectAiDiff(editor)`, powrót do oryginału, provenance event `reject`.
- **Esc** podczas pending diff → rejectuje (skrót, linie 197-213).
- **Krytyczne — autosave blokada:** dopóki diff jest nierozstrzygnięty, autozapis jest **wstrzymany** (`hasPendingDiffRef`, linie 120-135). Sprawdź: wywołaj AI, NIE rozstrzygaj, poczekaj > debounce → potwierdź brak `updateDraft` w Network; po Accept/Reject autozapis wznawia.
- **Streaming:** w trakcie generowania Esc/Stop przerywa (`onStopStream`, `isStreaming`).
- Wielokrotne diffy pod rząd; diff na różnych typach bloków (nagłówek, lista, tabela).

### 3.5 „Wyjaśnij" / Explain (read-only)
- `onExplainRequest` → ten sam pipeline, ale wynik w **popoverze** (NIE modyfikuje dokumentu, brak diffu). Potwierdź, że dokument pozostaje nietknięty.

### 3.6 Selection block actions (`canvas-selection-block-actions`)
- Z zaznaczenia: utwórz blok artefaktu — `createArtifactBlockFromSelection('table'|'chart'|'diagram'|'research'|'decision')`. Każdy wstawia odpowiedni blok; sprawdź render i edycję.
- Selection edit shortcuts (`canvas-selection-edit-panel`): „use_selection", „action_list", „bullet_summary" (`applySelectionEditShortcut`) + podgląd (`previewSelectionEdit`) + czyszczenie.

---

## 4. Tryby widoku, persystencja, autosave

1. **Document ↔ Markdown** (menu „…"): edytuj w jednym trybie → przełącz → zmiany widoczne (wspólne źródło). Brak utraty treści przy przełączaniu.
2. **Autosave (debounce 600 ms):** wpisuj tekst → po ~0,6 s jedno `updateDraft` w Network (burst klawiszy = jeden round-trip). Na świeżym drafcie `work-canvas-*` autosave jest pomijany do czasu `ensurePersistedDraft` (sprawdź, że pierwszy realny zapis tworzy wiersz, potem aktualizuje).
3. **Save states:** `unsaved → saving → saved` / `failed`. Wskaźniki w UI spójne z `data-save-state`.
4. **Reload/recovery:** po odświeżeniu strony Canvas wczytuje ostatni draft (`LAST_DRAFT_ID_STORAGE_KEY` / `draftId` w URL). Treść zachowana.
5. **Błędy backendu** — kody z `workCanvasErrorMessage`: `CANVAS_CAPABILITY_REQUIRED`, `CANVAS_PROJECT_SCOPE_REQUIRED`, `STALE_CANVAS_PROPOSAL`, `V8_ARTIFACT_SAVE_FAILED`, `CANVAS_ACTOR_REQUIRED` — wymuś/zasymuluj i potwierdź czytelne PL komunikaty (czerwony baner).

---

## 5. Standalone `/ai/work-canvas` (`WorkCanvasShell`) — osobny zestaw

1. **Taby kind** (markdown/table/checklist/research/decision/document/sheet/deck) — `switchKind`; document/sheet/deck nawigują z param `kind`. Każdy renderuje właściwy widok (`CanvasRenderer`).
2. **Save artifact** (zielony) → `markSaved` → `ensurePersistedDraft` + `saveAsArtifact`; po sukcesie „Artifact read-back" (`ReadBackView`) + status „Saved".
3. **Proposal targets** (idea/initiative/task/project_brief/decision/research_report/client_deliverable) → `proposeConversion` → karta proposal w „Governance preview".
4. **Approve / Reject proposal** → `decideProposal('approve'|'reject')`; status zmienia się; X zamyka kartę.
5. **Preview ↔ Source** toggle; Copy/Download/Highlight/Improve (Highlight i Improve to na razie kolejkowane komunikaty — potwierdź treść, że nic nie mutuje bez zgody).
6. **Research kind:** `ResearchSessionsDock` — wybór sesji linkuje `researchSessionId`, persystuje.
7. **V8ArtifactRunControl** w prawej kolumnie — uruchomienie runtime.
8. Prev/Next wersji — obecnie **disabled** (tooltip „will load… later"). Potwierdź, że są wyłączone (nie regresja).

---

## 6. Prawy pasek ikon nagłówka czatu (zweryfikowany skład)
**Korekta schematu:** wcześniejszy opis (play / bookmark+ / chat / mic / camera) był spekulatywny — taki rail **nie istnieje** w kodzie. Realny zestaw ikon po prawej stronie nagłówka znajduje się w `UnifiedChatPanel.tsx:~5277-5360` i zawiera dokładnie poniższe elementy. Dla każdego testuj: tooltip/`aria-label`, akcję i stan aktywny.

1. **`V8ArtifactRunControl`** (`UnifiedChatPanel.tsx:5279`) — sterowanie uruchomieniem runtime V8 artefaktu; przekazuje `conversationId`, `defaultGoal`, `snapshotContext`. Sprawdź start/stan runu.
2. **`V8ContextIndicator`** (`:5284`) — wskaźnik kontekstu V8 (co model „widzi"); przekazuje `conversationId` + `defaultGoal`.
3. **`PrivateModeDetails`** (`:5294`) — renderowany **tylko** gdy `isPrivateMode`. Badge trybu prywatnego; przy włączonej fladze T-PM1 staje się przyciskiem z popoverem (uczciwość RODO — co tryb prywatny robi i czego NIE robi), przy wyłączonej fladze = read-only chip o identycznych klasach.
4. **Toggle panelu roboczego** (`:5295-5310`) — ikona `PanelRight`, `data-testid="chat-work-panel-button"`, tooltip/`aria-label` „Open work panel" (`aiChat.workPanel.open`). Renderowany tylko gdy `canUseWorkPanel`. `aria-pressed={showWorkPanel}`; aktywny stan = kolor `primary` + tło. Sprawdź otwieranie/zamykanie work panelu.
5. **Mute / auto-read TTS** (`:5311-5359`) — ikona `Volume2` (auto-read ON) / `VolumeX` (OFF), `data-testid="chat-autoread-button"`. Renderowany tylko gdy `ttsSupported`. Tooltip dynamiczny: „Mute now" gdy `voiceState.isSpeaking`, inaczej „Turn off/on auto-read". Klik podczas mówienia robi barge-in (`stopSpeaking` + toast „Reading interrupted."), inaczej przełącza `autoReadEnabled` i synchronizuje `voiceSettings.autoSpeakResponses` + `aiConfig.textToSpeech`.

**NIE testuj** play / bookmark+ / camera — te ikony nie istnieją. **`Mic`** w tym pliku występuje wyłącznie w pustym stanie (welcome voice CTA, `:5453`, `data-testid="welcome-voice-cta"`) oraz w komponencie kompozytora `EnhancedChatInput` (input głosowy), **nie** w tym railu — tryb głosowy testuj tam, a nie w nagłówku.

---

## 7. Testy przekrojowe
1. **Cykl pełny:** utwórz z czatu → edytuj ręcznie → AI diff Accept → promote do Task → eksport PDF → share → close. Wszystko bez błędów konsoli, każdy krok potwierdzony w Network/module docelowym.
2. **Capability matrix:** konto z capability vs bez — wszystkie akcje output/promote/share mają poprawny stan (enabled/disabled + powód).
3. **i18n PL/EN** dla pasków, menu, quick actions, komunikatów błędów.
4. **Dark mode** dla nagłówka, menu „…", popoverów, diffu.
5. **A11y:** wszystkie przyciski mają `aria-label`/`title`; menu mają `aria-expanded`; Esc zamyka popovery i rejectuje diff; nawigacja Tab.
6. **Współbieżność:** edycja ręczna + autosave + pending AI diff naraz — brak wyścigów, brak utraty treści, autosave wstrzymany podczas diffu.
7. **Testy jednostkowe:** uruchom istniejące w `CanvasEditor/__tests__` (diff ops, patch ops, markdown conversion, provenance) — wszystkie zielone; dopisz brakujące dla nowych ścieżek.

---

## 7A. Generowanie dokumentów z TABELAMI i język treści (N-9 / N-10) — OBOWIĄZKOWE
> Wymóg produktowy: Canvas ma generować dokumenty zawierające **realne tabele** (nie tylko prozę) i w **języku usera**. Dotyczy ścieżki czat → `planDocGeneration` → `runStreamingDocGeneration`/one-shot (`docGenerationRuntime.ts`) → render w edytorze (`canvasMarkdownConversion.markdownToHtml` → rozszerzenie Table TipTap).

### 7A.1 Raport z tabelami (happy path) — PL
- Prompt PL (dokumentowy, NIE „zrób tabelę"): „Przygotuj raport porównujący 3 scenariusze wdrożenia AI: zestaw koszty (PLN), czas (miesiące) i ROI po 3 latach. Dodaj sekcję rekomendacji."
- **Oczekiwane:** intencja → **Document** (panel Canvas, NIE Table Studio); po generacji dokument zawiera ≥1 tabelę GFM wyrenderowaną jako siatka `<table>` (nagłówki + wiersze danych); liczby w komórkach (koszt/czas/ROI); proza + tabela współistnieją.
- **Dowód (3 warstwy):** (a) DB `work_canvas_drafts.content_md` zawiera wiersz separatora `| --- |` i pustą linię przed każdą tabelą; (b) `markdownToHtml(content_md)` → `<table><thead><th>…`; (c) UI: tabela widoczna w panelu (screenshot).
- **Edge:** sprawdź, że tabela ma pustą linię nad sobą (wymóg `marked` z `breaks:false`) — bez niej `marked` renderuje surowe `|` jako tekst. Helper `ensureTableSpacing` to gwarantuje.

### 7A.2 Sekcje z natury tabelaryczne
Dla raportu strategicznego (transformacja/roadmapa/ryzyka) potwierdź tabele w: porównaniu scenariuszy (koszt/ROI), **macierzy ryzyk**, **roadmapie kwartalnej/falowej** (kamienie milowe), zestawieniu KPI, porównaniu dostawców. Proza tam, gdzie tabela nie ma sensu (streszczenie, kontekst) — NIE wymuszaj tabel wszędzie.

### 7A.3 Język treści i nagłówków (N-10)
- Prompt PL → treść PL **oraz nagłówki sekcji PL** („Streszczenie wykonawcze”, „Kontekst strategiczny”, „Fale roadmapy”, „Ryzyka i zależności”, „Ład (Governance)”, „Załącznik”). Brak angielskich „Executive Summary/Governance/Appendix” przy treści PL.
- Powtórz z promptem EN → treść + nagłówki EN.

### 7A.4 Routing tabela vs dokument (N-12)
- „raport … użyj tabel" → **Document z tabelami**. „zrób tabelę/arkusz porównujący…" → **Table Studio (Excel Workbook, Approve/Reject)**. Odnotuj, do czego trafia każda fraza; dwuznaczne („tabela porównująca … użyj tabeli") = znany niuans N-12.

### 7A.5 Edycja AI a tabele
- Zaznacz akapit obok tabeli → Condense/Expand → diff → Accept: tekst ZASTĄPIONY (nie podwojony, N-8), tabela NIENARUSZONA. Sprawdź też edycję AI na komórce/wewnątrz tabeli (odnotuj zachowanie).

### 7A.6 Trwałość po reload (N-13)
- Po zakończeniu generacji reload strony → dokument (z tabelami) ładuje się KOMPLETNY z DB. Reload W TRAKCIE streamingu = znany bug N-13 (panel pokazuje wersję częściową mimo kompletnego draftu w DB).

---

## 8. Format raportu i DoD
Per przycisk: **kroki → oczekiwane → faktyczne → PASS/FAIL → dowód** (screenshot + payload Network + ewentualny stan w module docelowym/`localStorage`/`saveState`). Dla FAIL: `plik:linia`, przyczyna, propozycja fixu.

**Definition of Done:** wszystkie przyciski paska formatowania i górnego menu PASS; diff Accept/Reject + Esc + blokada autosave potwierdzone; **dokument generuje realne tabele w sekcjach tabelarycznych (§7A) i renderuje je jako siatkę**; **treść + nagłówki w języku usera (§7A.3)**; każdy eksport pobiera poprawny plik; każda akcja promote tworzy realną encję; share generuje działający publiczny link; zero błędów w konsoli; PL+EN; light+dark; oba modele Canvasa (chat-shell i standalone) pokryte.
