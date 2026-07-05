# CASES — M09 Ideas · Whiteboard · 30 bogatych case'ów warsztatowych

> **Moduł:** M09 Ideas — Whiteboard (`/my-work/ideas/workspace/whiteboard`)
> **Cel:** 30 realistycznych scenariuszy facylitacji/warsztatów konsultanta (retro, brainstorm, mapa empatii, BMC, SWOT, affinity), eksploatujących **pełnię** narzędzia. Każdy case = nagłówek + 4 atrybuty: **Co się dzieje** / **Efekty pracy** / **Grafika** / **Funkcjonalność**.
> **Źródło prawdy (kod, zweryfikowany 2026-06-21):**
> - `src/components/MyWork/IdeaWhiteboardTool.tsx` (3116 l.) — orkiestracja, hydrate, autosave, facilitation, AI propozycje, align/lock/layout
> - `src/components/MyWork/whiteboard/` — Toolbar, SelectionBar, SessionPanel, PhaseBar, EmptyState, useWhiteboardCollab, useWhiteboardNodes, useWhiteboardQuickActions, whiteboardContracts
> - `src/components/MyWork/whiteboard/nodes/` — StickyNoteNode, TextBlockNode, ShapeNode, FrameNode, ImageNode, LinkNode, GroupNode, LabeledEdge
> - `src/components/MyWork/canvas/useIdeaMapSync.ts`, `IdeaSlashCommandMenu.tsx`, `IdeaCanvasContextMenu.tsx`
>
> **Legenda znaczników:** `[REAL-AI]` = wymaga żywego AI (propozycje/expand/challenge/brainstorm) · `[MULTIPLAYER]` = 2. uczestnik / realtime · `[MANUAL]` = gest trackpad / drag-drop / dwa okna.
>
> **Ważne fakty z kodu (pułapki):**
> - **Sticky note NIE MA `NodeResizer`** — rozmiar wynika z `data.size` (`STICKY_SIZES` s/m/l), nie z uchwytów. Resize uchwytami mają TYLKO: `ShapeNode`, `TextBlockNode`, `FrameNode`, `ImageNode`.
> - **`ImageNode` i `ShapeNode(circle)` mają `keepAspectRatio`** — resize zachowuje proporcje.
> - **Kształty:** rectangle/circle/diamond/hexagon — wszystkie 4 emitowane z toolbara (`onAddElement('shape_*')`); circle ma `keepAspectRatio`, diamond renderowany `rotate(45deg)` z kontr-obrotem etykiety, hexagon `clip-path`.
> - **8 kolorów sticky** (`STICKY_COLORS`): yellow, blue, green, pink, primary/indigo, amber, blue(dup), rose — dropdown „Utwórz" pokazuje swatch per kolor.
> - **Inline-edit:** double-click → `textarea`/`input`; `Enter` commit (sticky/text: bez Shift), `Esc` anuluje, `onBlur` commit. Commit woła `data.onLabelChange`.
> - **Autosave:** `queueSync(..., {reason:'draft'})` na zmianie nodes/edges/drawingPaths; manualny `handleSave` → `flushNow` (snapshot). Cap obrazu inline = **10MB** (`MAX_WHITEBOARD_IMAGE_BYTES`).
> - **Persystencja per-user** (`my_idea_maps` keyed idea+user+org) — znany P0 L-01 dla 2. uczestnika. **Realtime** treści idzie osobno przez `useWhiteboardCollab` (`graph_patch`, org-scope WS), NIE przez `/map`.
> - **Facilitation API idempotentne** (`ensureFacilitationSession`): 2. uczestnik tej samej `toolSessionId=whiteboard:{ideaId}` trafia do TEJ SAMEJ sesji; rola czytana z `facilitator_id` serwera (NIE self-assign). Re-read co 5 s (faza/voting/timer/rola).
> - **Fazy facylitacji** (`FACILITATION_TRANSITIONS`): start→organize→(converge|start)→(handoff|organize); handoff = terminalna i wyzwala `convert_initiative` po 800 ms.
> - **Głosowanie** sync co 5 s gdy `votingOpen`; cast vote = event `idea-whiteboard-cast-vote` → `facilitationCastVote` (upvote +1) → `syncFacilitationVotes`.

---

## GRUPA A — Kształty / sticky / text / frames / images (MC-09-01…08)

### MC-09-01 · Retro „Mad/Sad/Glad" — 3 ramki-kolumny + sticky · [frames+sticky]
**Co się dzieje** Facylitator otwiera pustą tablicę, z dropdownu „Utwórz" wstawia 3 ramki (Frame) nazwane Mad / Sad / Glad (double-click → wpisuje, Enter), układa je obok siebie, po czym dorzuca po 3–4 sticky w każdej kolumnie i wpisuje treść każdego (double-click → textarea → Enter). Następnie przeciąga sticky między kolumnami.
**Efekty pracy** 3 węzły `frameNode` + ~10 `stickyNote` w `nodes[]`; każda zmiana etykiety przez `onLabelChange`; po pierwszej mutacji `queueSync({reason:'draft'})` zapisuje payload do `PUT /api/my-work/my-ideas/:id/map` (`nodes/edges/extensions.whiteboard`); reload utrwala układ; activityLog z wpisami `create`.
**Grafika** Canvas z tłem dots; 3 prostokątne ramki z nagłówkiem UPPERCASE + chevron collapse + licznik dzieci; sticky w 8 kolorach (kolejne kolory z `stickyColorCounter`); ring selekcji `ring-slate-500/60` przy zaznaczeniu; glow w dark mode.
**Funkcjonalność** `WhiteboardToolbar` ToolbarDropdown „create" (`onAddElement('frame'|'sticky')`); `addElement`→`createNode` (`IdeaWhiteboardTool.tsx:1515`); `FrameNode`/`StickyNoteNode` inline-edit; autosave effect `IdeaWhiteboardTool.tsx:2508`.

### MC-09-02 · Brainstorm Quick-Start — seed 1 ramka + 4 sticky · [empty-state]
**Co się dzieje** Na pustej tablicy facylitator klika kafel „Brainstorm" w empty-state. System seeduje gotowy layout sesji: ramka „Temat sesji" + 4 sticky „Pomysł 1–4". Potem nadpisuje treść sticky i dodaje 5. ręcznie.
**Efekty pracy** `seedQuickStart('brainstorm')` tworzy 1 frame (540×250, bg amber 0.08) + 4 sticky na predefiniowanych pozycjach; `pushUndoSnapshot` przed seedem (cofalne); toast sukcesu; `rememberSnapshot` → historyLog; tło wymuszone `dots`; autosave do `/map`.
**Grafika** Empty-state z 3 kaflami (Brainstorm/Affinity/Workshop) + „Dodaj sticky"; po seedzie ramka z półprzezroczystym amber tłem, 4 żółto-niebieskie sticky w środku; znika empty-state (bo `nodes.length>0`).
**Funkcjonalność** `WhiteboardEmptyState` `onSeedQuickStart`; `seedQuickStart` (`IdeaWhiteboardTool.tsx:1846`); guard `if (prev.length>0) return prev` (nie nadpisze istniejącej tablicy).

### MC-09-03 · Affinity diagram — 2 ramki tematyczne + grupowanie sticky · [frames+affinity]
**Co się dzieje** Konsultant po burzy mózgów klasteryzuje notatki: klika Quick-Start „Affinity" (2 ramki Temat A/Temat B + 4 inputy), dorzuca więcej sticky, lasso-zaznacza powiązane i przeciąga do właściwej ramki. Zmienia nazwy tematów.
**Efekty pracy** `seedQuickStart('affinity')` → 2 frame (260×320, bg crimson/blue 0.08) + 4 sticky; przeciągnięcia emitują `position` changes (drag-end → `update_node` op do collab); autosave; outcomeRegistry pusty (afinity to nie outcome).
**Grafika** 2 kolumny-ramki w różnych odcieniach tła; sticky wewnątrz; lasso-select pokazuje ramkę zaznaczenia ReactFlow; SelectionBar pojawia się nad canvasem po multi-select.
**Funkcjonalność** `seedQuickStart('affinity')`; ReactFlow `selectionOnDrag`/lasso z `getIdeasToolInteractionProps('whiteboard')`; `onNodesChange` filtruje locked + broadcast.

### MC-09-04 · Mapa empatii — 4 kształty (rectangle/circle/diamond/hexagon) jako kwadranty · [shapes]
**Co się dzieje** Facylitator buduje mapę empatii: wstawia 4 różne kształty (rectangle „Mówi", circle „Myśli", diamond „Robi", hexagon „Czuje"), wpisuje etykiety i ustawia w kwadrantach. Łączy je connectorami do centralnego sticky „Persona".
**Efekty pracy** 4 `shapeNode` z `data.shape` (rectangle/circle/diamond/hexagon) + style box (rectangle 160×80, circle 120×120, diamond 100×100, hexagon 140×120); connectory `labeled` w `edges[]`; `onConnect` (`IdeaWhiteboardTool.tsx:1495`) z broadcast `add_edge`; autosave całości.
**Grafika** Prostokąt 12px radius; koło 50%; romb obrócony 45° z kontr-obrotem tekstu; heksagon z `clip-path`; każdy z glow w dark; krawędzie typu `LabeledEdge`.
**Funkcjonalność** `onAddElement('shape_rectangle'|'shape_circle'|'shape_diamond'|'shape_hexagon')`; `ShapeNode` (`nodes/ShapeNode.tsx`); shapeMap/initialStyle w `createNode`. UWAGA: wszystkie 4 kształty dostępne (dawny L-05 nieaktualny).

### MC-09-05 · Business Model Canvas — wklejenie 9 bloków przez Import Outline · [text-import]
**Co się dzieje** Konsultant otwiera Import Outline (slash → lub quick-action `wb_import_outline`), wkleja 9 linii (Key Partners, Activities, Resources, Value Prop, …, Cost, Revenue), zatwierdza. Każda linia ląduje jako oddzielny element ułożony w siatkę 4-kolumnową.
**Efekty pracy** `applyOutlineImport`: split po `\n`, max 24 linie, układane `x=120+(i%4)*190, y=120+floor(i/4)*130`; każda linia >100 zn. → `text`, krótsze → `sticky` z `colorIndex=i%8`; `handleExternalInsert`→`pushUndoSnapshot`+`rememberSnapshot`; activityLog `import` z count; autosave.
**Grafika** Modal Import Outline (textarea 8 wierszy + Anuluj/Potwierdź) na półprzezroczystym backdrop; po zatwierdzeniu 9 sticky w 4×3 siatce, rotujące kolory.
**Funkcjonalność** `importOutline`/`applyOutlineImport` (`IdeaWhiteboardTool.tsx:1774`); `handleExternalInsert` (`:1719`); modal render (`:2993`).

### MC-09-06 · Wklejenie obrazu ze schowka (cap 10MB) · [images+MANUAL]
**Co się dzieje** Podczas warsztatu facylitator robi zrzut diagramu i wkleja go (Cmd+V) bezpośrednio na canvas. Obraz pojawia się wycentrowany. Próbuje też wkleić plik >10MB — dostaje błąd.
**Efekty pracy** `handlePaste`: `clipboardData` image → `FileReader.readAsDataURL` → base64 `imageNode` (width 300) w centrum widoku (`getCenter`); jeśli `file.size>MAX_WHITEBOARD_IMAGE_BYTES` (10MB) → `toast.error` „Image too large"; tekst URL → `linkNode`, tekst zwykły → sticky; base64 trafia do `nodes[]` → `/map` sync.
**Grafika** `ImageNode` z `object-contain`, etykietą na czarnym pasku u dołu, uchwytami `NodeResizer` (keepAspectRatio) po zaznaczeniu; toast błędu dla za dużego pliku.
**Funkcjonalność** `handlePaste` (`IdeaWhiteboardTool.tsx:218`); `ImageNode` (`nodes/ImageNode.tsx`); cap `MAX_WHITEBOARD_IMAGE_BYTES` (`:544`).

### MC-09-07 · Drag-and-drop pliku obrazu + linku na tablicę · [images+links+MANUAL]
**Co się dzieje** Facylitator przeciąga z pulpitu plik PNG i upuszcza go na konkretne miejsce tablicy; potem przeciąga URL z paska przeglądarki. Obraz i link lądują dokładnie pod kursorem.
**Efekty pracy** `handleDrop`: pliki image → base64 `imageNode` (width 250) na `screenToFlowPosition(clientX/Y)` z offsetem 30px per plik (cap 10MB); plik nie-image → `linkNode` z nazwą; text URL (`^https?`) → `linkNode`, inny tekst → sticky losowy kolor; autosave.
**Grafika** `dropEffect='copy'` podczas najazdu; obraz w miejscu upuszczenia; `LinkNode` z ikoną i etykietą; wiele plików kaskadowo przesunięte.
**Funkcjonalność** `handleDrop`/`handleDragOver` (`IdeaWhiteboardTool.tsx:276`); `LinkNode`; `screenToFlowPosition`.

### MC-09-08 · Sticky w 8 kolorach + cykl rozmiarów + priorytet/komentarze · [sticky-rich]
**Co się dzieje** Facylitator dodaje sticky różnymi kolorami przez dropdown (wybiera swatch), oznacza ważne notatki (priorytet ≥80 — czerwona obwódka), niektóre mają komentarze (badge). Sprawdza, że kolejne „szybkie" sticky cyklują kolory automatycznie.
**Efekty pracy** Dropdown z 8 pozycjami `sticky-{i}` (swatch z `c.hex`) → `onAddElement('sticky',{colorIndex:i})`; auto-add cykluje `stickyColorCounter % 8`; `data.priority`, `data.comments[]`, `data.author` renderowane; autosave całości z colorIndex.
**Grafika** Sticky w 8 paletach (yellow/blue/green/pink/indigo/amber/blue/rose) z glow w dark; obwódka `border-danger-400/70` (≥80) lub amber (≥50); niebieski badge liczby komentarzy (klik → `idea-node-open-detail`); autor w prawym dolnym rogu.
**Funkcjonalność** ToolbarDropdown items (`WhiteboardToolbar.tsx:109`); `STICKY_COLORS`/`STICKY_SIZES` (`whiteboardNodeHelpers.ts`); `StickyNoteNode` priorityBorder/commentCount.

---

## GRUPA B — Resize / selekcja / wyrównanie / grupowanie (MC-09-09…14)

### MC-09-09 · Resize kształtu i ramki uchwytami (NodeResizer) — sticky bez uchwytów · [resize]
**Co się dzieje** Facylitator zaznacza prostokąt i rozciąga go uchwytem narożnym, by zmieścił więcej notatek; potem zaznacza koło (proporcje zachowane). Próbuje rozciągnąć sticky — uchwytów BRAK (potwierdza ograniczenie produktu).
**Efekty pracy** `NodeResizer` (visible gdy `selected && !locked`) pisze `node.style.{width,height}`; resize-end (`dimensions`, `resizing===false`) → op `update_node {style}` do collab + autosave; circle/image z `keepAspectRatio`; frame minWidth 160/minHeight 120; sticky NIE ma `NodeResizer` (rozmiar tylko z `data.size`).
**Grafika** Uchwyty na 4 narożnikach + krawędziach zaznaczonego shape/text/frame/image; koło skaluje równomiernie; sticky pokazuje tylko ring selekcji, zero uchwytów.
**Funkcjonalność** `NodeResizer` w `ShapeNode`/`TextBlockNode`/`FrameNode`/`ImageNode`; brak w `StickyNoteNode`; `broadcastNodeChanges` dimensions branch (`useWhiteboardCollab.ts:54`).

### MC-09-10 · Multi-select + SelectionBar: wyrównanie do lewej/środka · [selection+align]
**Co się dzieje** Po brainstormie sticky są rozrzucone. Facylitator lasso-zaznacza 5 notatek, w SelectionBar wybiera Align → Left, potem Align → Center, by wyrównać kolumnę.
**Efekty pracy** `alignNodes('left'|'center'|...)`: liczy ref z min/max pozycji z uwzględnieniem szerokości (frame 400, sticky 180); `pushUndoSnapshot` (cofalne); aktualizuje `position` tylko zaznaczonych nie-locked; autosave; SelectionBar align disabled gdy `<2` zaznaczone.
**Grafika** SelectionBar (pływający pasek u góry, slide-up animation) z licznikiem „N elementów"; ToolbarDropdown Align (Left/Center/Right/Top/Middle/Bottom); węzły skaczą na wspólną oś.
**Funkcjonalność** `WhiteboardSelectionBar` Align dropdown (`WhiteboardSelectionBar.tsx:120`); `alignNodes` (`IdeaWhiteboardTool.tsx:2401`).

### MC-09-11 · Rozłożenie równomierne (distribute H/V) 5+ sticky · [selection+distribute]
**Co się dzieje** Facylitator chce równe odstępy w rzędzie tagów: zaznacza 5 sticky, klika Distribute → Horizontal; potem kolumnę 4 sticky → Distribute → Vertical.
**Efekty pracy** `distributeNodes('horizontal'|'vertical')`: sortuje po osi, liczy `step=total/(n-1)`, ustawia równe pozycje; wymaga `≥3` zaznaczonych (poniżej disabled); `pushSnapshot`; autosave.
**Grafika** Distribute dropdown w SelectionBar (disabled <3); węzły rozkładają się z równym skokiem; pozostałe niezaznaczone bez zmian.
**Funkcjonalność** `distributeNodes` (`useWhiteboardNodes.ts:221`); SelectionBar Distribute (`WhiteboardSelectionBar.tsx:164`).

### MC-09-12 · Grupowanie → ramka obejmująca + ungroup · [grouping]
**Co się dzieje** Facylitator zaznacza klaster 4 sticky i wciska Cmd+G — powstaje ramka obejmująca je z marginesem. Potem zaznacza ramkę i Cmd+Shift+G — rozgrupowuje.
**Efekty pracy** `groupSelected`: tworzy `frameNode` o boxie min−20/−40 do max+200/+160, dzieci dostają `parentId=groupId`; wymaga `≥2`; `ungroupSelected`: usuwa frame i czyści `parentId`; oba `pushSnapshot`; toast; autosave; effect liczy `childCount` ramki (`IdeaWhiteboardTool.tsx:804`).
**Grafika** Nowa ramka pod sticky; nagłówek „Grupa"; chevron collapse; licznik dzieci po zwinięciu; ungroup rozpuszcza ramkę.
**Funkcjonalność** Cmd+G/Cmd+Shift+G (`IdeaWhiteboardTool.tsx:2738`); `groupSelected`/`ungroupSelected` (`useWhiteboardNodes.ts:158`); SelectionBar Group/Ungroup.

### MC-09-13 · Zwijanie ramki (collapse) ukrywa dzieci · [frame-collapse]
**Co się dzieje** Tablica z 3 ramkami pełnymi sticky robi się zatłoczona. Facylitator zwija ramkę „Parking Lot" chevronem — dzieci znikają, pokazuje się licznik „N items hidden". Rozwija z powrotem.
**Efekty pracy** `onCollapseToggle(true)` ustawia `data.collapsed`; effect na `frameCollapseKey` ustawia `hidden=true` dzieciom (po `parentNode/parentId`); stan collapsed serializowany w `nodes[]` → `/map`; reload utrwala zwinięcie.
**Grafika** Chevron Down→Right; ramka kurczy się do nagłówka; badge licznika dzieci; tekst „N item(s) hidden / Empty".
**Funkcjonalność** `FrameNode` toggleCollapse (`nodes/FrameNode.tsx:25`); collapse effect (`IdeaWhiteboardTool.tsx:804`); `onCollapseToggle` w `createNode`/hydrate.

### MC-09-14 · Lock + duplicate selekcji (Cmd+D) · [selection+lock]
**Co się dzieje** Facylitator blokuje szablonową ramkę (Lock), by jej przypadkiem nie ruszyć, a roboczy klaster sticky duplikuje (Cmd+D) jako wariant B do dalszej pracy.
**Efekty pracy** `lockSelected`: toggle `data.locked` + `draggable/connectable/deletable=false`; locked węzły pomijane w `onNodesChange`/align/delete/duplicate; `duplicateSelected`: kopie z offsetem +30/+30, nowe id, skopiowane krawędzie między zaznaczonymi, `_duplicatedFrom`; toast; oba `pushSnapshot`; autosave.
**Grafika** Lock icon w SelectionBar; zablokowany węzeł nie pokazuje uchwytów resize ani nie reaguje na drag; duplikat obok oryginału, odznaczony.
**Funkcjonalność** `lockSelected` (`IdeaWhiteboardTool.tsx:2480`); `duplicateSelected`/`buildDuplicatedEdgesFromSelection` (`useWhiteboardNodes.ts:126`).

---

## GRUPA C — Inline-edit / slash menu / context menu / connectory (MC-09-15…20)

### MC-09-15 · Inline-edit treści (double-click) we wszystkich typach · [inline-edit]
**Co się dzieje** Facylitator szybko edytuje treść: double-click na sticky (textarea, Enter commit / Shift+Enter nowa linia), na kształcie (input, Enter commit), na ramce (input nagłówka), na bloku tekstu (textarea). Esc anuluje bez zapisu.
**Efekty pracy** Każdy node trzyma lokalny `editing`/`editValue`; `commitEdit` woła `data.onLabelChange(next)` tylko gdy zmiana ≠ oryginał → `setNodes` aktualizuje `label`; `Esc`→`setEditing(false)` bez commit; zmiana etykiety → autosave draft.
**Grafika** Pole edycji z dolnym borderem; textarea (sticky/text) vs input (shape/frame); auto-focus + select przy wejściu; semanticLabel UPPERCASE nad treścią po commit.
**Funkcjonalność** `commitEdit` w `StickyNoteNode`/`ShapeNode`/`FrameNode`/`TextBlockNode`; `onLabelChange` injekcja w `createNode`/hydrate; Enter/Shift+Enter handling per-node.

### MC-09-16 · Slash menu „/" — szybkie wstawianie elementów i AI · [slash]
**Co się dzieje** Facylitator wciska „/" na canvasie. Otwiera się paleta poleceń. Wpisuje „swot" → filtruje do szablonu SWOT; wpisuje „sticky" → wstawia notatkę; strzałkami nawiguje, Enter wybiera.
**Efekty pracy** `setSlashMenuOpen(true)` na „/" (gdy nie edytuje); wybór → `handleSlashCommand(action)` dispatchuje `idea-workspace-quick-action {action}`; element-akcje (`wb_add_*`) obsłużone przez `useWhiteboardQuickActions`; AI/template/import akcje forwardowane do workspace busa; Esc/klik-poza zamyka.
**Grafika** Pływająca paleta 320px z polem search (Sparkles icon), grupy AI/Elements/Templates/Import, podświetlenie wiersza, opis per komenda; „Brak wyników" gdy filtr pusty.
**Funkcjonalność** `IdeaSlashCommandMenu` (`IdeaSlashCommandMenu.tsx`); `handleSlashCommand` (`IdeaWhiteboardTool.tsx:2541`); keydown „/" (`:2748`).

### MC-09-17 · Context menu na węźle — AI Expand · [context+REAL-AI]
**Co się dzieje** Facylitator klika PPM na sticky „Skrócić czas onboardingu" i wybiera „AI: Expand". AI proponuje 3–5 powiązanych pod-pomysłów jako batch propozycji do akceptacji.
**Efekty pracy** `onNodeContextMenu` → `handleCanvasContextMenu` (zapisuje `nodeId`/label/type + pozycję); `IdeaCanvasContextMenu` z `generatorType:'mindmap_expand'` woła AI → `onGenerateProposal(batch)` → `setProposalBatch`; activityLog `ai`; batch w stanie (nie utrwalony dopóki nieprzyjęty).
**Grafika** Menu kontekstowe przy kursorze (Expand/Challenge/Find evidence/Suggest connections); po wygenerowaniu pasek `IdeaProposalReview` na dole z listą propozycji.
**Funkcjonalność** `handleCanvasContextMenu` (`IdeaWhiteboardTool.tsx:2524`); `IdeaCanvasContextMenu` (generatorType expand); `handleGenerateProposal` (`:2654`).

### MC-09-18 · AI Challenge + Accept/Reject propozycji (Propose→Accept) · [context+REAL-AI]
**Co się dzieje** Facylitator kwestionuje decyzję: PPM → „AI: Challenge". AI zwraca kontrargumenty jako propozycje. Facylitator akceptuje 2, odrzuca 1, lub „Akceptuj wszystkie".
**Efekty pracy** `handleAcceptProposal(id)`: status→accepted, `patch.addNodes` → `addElement` materializuje węzły na tablicy; `handleRejectProposal`: status→rejected; `handleAcceptAllProposals`/`handleRejectAllProposals` dla pending; każda akcja → activityLog `ai` + toast; zaakceptowane węzły → `nodes[]` → autosave; Esc zamyka batch.
**Grafika** `IdeaProposalReview` (bottom overlay, max-w-lg) z propozycjami i przyciskami Accept/Reject/AcceptAll/RejectAll/Dismiss; nowe węzły pojawiają się na canvasie po akceptacji.
**Funkcjonalność** `handleAcceptProposal`/`handleRejectProposal`/`handleAcceptAll`/`handleRejectAll` (`IdeaWhiteboardTool.tsx:2554-2652`); `IdeaProposalReview`.

### MC-09-19 · AI Nudge Strip — Expand/Summarize z całej tablicy · [REAL-AI]
**Co się dzieje** Tablica ma 15+ węzłów. Na dole pojawia się pasek podpowiedzi AI. Facylitator klika „Expand", by AI dorzuciło pomysły, lub „Summarize", by AI streściło tablicę.
**Efekty pracy** `IdeaAINudgeStrip` (render gdy `!proposalBatch && nodes.length>0`); `onActionExpand` dispatch `mm_ai_expand`, `onActionConvert` dispatch `mm_ai_summarize` (przez workspace bus); wyniki wracają jako proposalBatch (chowa nudge strip).
**Grafika** Pasek nudge u dołu z akcjami Expand/Convert; chowa się gdy aktywny proposalBatch; widoczny tylko przy niepustej tablicy.
**Funkcjonalność** `IdeaAINudgeStrip` render (`IdeaWhiteboardTool.tsx:3075`).

### MC-09-20 · Connectory między węzłami + edycja etykiety krawędzi · [edges]
**Co się dzieje** Facylitator rysuje strzałki: pociąga z handle dolnego sticky A do górnego handle sticky B (relacja „blokuje"), tworzy łańcuch zależności. Usuwa błędną krawędź.
**Efekty pracy** `onConnect`: jeśli źle/cel nie locked → `addEdge({type:'labeled'})` + `broadcastEdgeAdd`; `pushUndoSnapshot`; usunięcie krawędzi (`EdgeChange remove`) → `broadcastEdgeChanges` op `remove_edge`; krawędzie w `edges[]` → `/map`; `defaultEdgeOptions:{type:'labeled'}`.
**Grafika** Handle source (bottom)/target (top) `!bg-slate-400`; krawędź `LabeledEdge` z etykietą; usunięta znika z obu klientów (jeśli multiplayer).
**Funkcjonalność** `onConnect` (`IdeaWhiteboardTool.tsx:1495`); `onEdgesChange` (`:781`); `LabeledEdge`; handles w node'ach.

---

## GRUPA D — Voting / roles / facilitation session (MC-09-21…26)

### MC-09-21 · Otwarcie sesji facylitacji + rola z serwera · [facilitation]
**Co się dzieje** Facylitator klika dowolną akcję sesji (np. cykl roli). System tworzy/odnajduje sesję serwerową i czyta z niej rolę — twórca = facilitator, dołączający = participant (nie self-assign).
**Efekty pracy** `ensureFacilitationSession` (idempotentne po `toolSessionId=whiteboard:{ideaId}`): `facilitationCreateSession` → `facilitationGetSession` → rola z `facilitator_id`; facilitator zapisuje rolę `facilitationAssignRole(['timer','voting','follow'])`; `sessionState` aktualizuje role/phase/timer/voting; stan w `extensions.whiteboard.sessionState` → `/map`.
**Grafika** `WhiteboardSessionPanel` (lewy górny róg) z warstwą roli (Facylitator/Uczestnik/Obserwator), trybem, timerem, badge voting/follow; PhaseBar.
**Funkcjonalność** `ensureFacilitationSession` (`IdeaWhiteboardTool.tsx:1094`); `cycleSessionRole` (`:1202`); `WhiteboardSessionPanel`.

### MC-09-22 · Cykl roli facylitator → participant → observer · [roles]
**Co się dzieje** Facylitator testuje przekazanie moderacji: klika „Role" w toolbarze i cykluje przez 3 role, obserwując zmianę uprawnień w panelu.
**Efekty pracy** `cycleWhiteboardRole`: facilitator→participant→observer→facilitator; `setSessionState.role`; `facilitationAssignRole` z permissions (facilitator: timer/voting/follow, inni: []); activityLog `session`; uwaga: lokalny cykl, ale re-read serwerowy co 5s nadpisuje rolę wg `facilitator_id`.
**Grafika** Toolbar przycisk „Role" (Workflow icon); panel sesji pokazuje aktualną rolę (roleLabel); zmiana uprawnień w badge'ach.
**Funkcjonalność** `cycleSessionRole` (`IdeaWhiteboardTool.tsx:1202`); `cycleWhiteboardRole` (`whiteboardContracts.ts:280`); re-read effect (`:2151`).

### MC-09-23 · Timer sesji (np. „5 min na pomysły") · [facilitation+timer]
**Co się dzieje** Facylitator uruchamia 5-minutowy timer na fazę dywergencji. Panel pokazuje odliczanie; po upływie czasu timer się resetuje i loguje zakończenie.
**Efekty pracy** `toggleSessionTimer`: `timerEndsAt = now+timerSeconds*1000` (lub null jeśli stop); `facilitationUpdateTimer`; effect (`:2071`) ustawia `setTimeout(msLeft)` → reset + activityLog `timerCompleted` + `facilitationUpdateTimer(null)`; stan w sessionState → `/map`.
**Grafika** Panel sesji: „Ns" odliczanie (`ceil((timerEndsAt-now)/1000)`) albo „Timer off"; aktualizacja co render.
**Funkcjonalność** `toggleSessionTimer` (`IdeaWhiteboardTool.tsx:1228`); timer effect (`:2071`); quick-action `wb_session_toggle_timer`.

### MC-09-24 · Głosowanie kropkami (dot voting) na najlepsze pomysły · [voting]
**Co się dzieje** Po zebraniu pomysłów facylitator otwiera głosowanie (ThumbsUp w toolbarze). Uczestnicy klikają sticky, by oddać głos. Wyniki sumują się na żywo (polling 5 s).
**Efekty pracy** `toggleSessionVoting`: `votingOpen=!`, dispatch `idea-whiteboard-toggle-voting-overlay`, `facilitationUpdatePhase('voting')`; cast głos → event `idea-whiteboard-cast-vote` → `facilitationCastVote({voteType:'upvote',voteValue:1})` → `syncFacilitationVotes`; `sessionVotes`/`myVoteCounts` z `facilitationGetVoteSummary`+`facilitationGetVotes`; poll co 5s gdy votingOpen; stan → `/map`.
**Grafika** Toolbar ThumbsUp active gdy votingOpen; panel sesji badge „Głosowanie otwarte/zamknięte"; sumy głosów na węzłach (overlay).
**Funkcjonalność** `toggleSessionVoting` (`IdeaWhiteboardTool.tsx:1259`); `syncFacilitationVotes` (`:1159`); cast vote effect (`:2008`); poll effect (`:2134`).

### MC-09-25 · Przejścia faz: start→organize→converge→handoff (auto-convert) · [facilitation+phases]
**Co się dzieje** Facylitator prowadzi sesję przez fazy: Start (zbieranie) → Organize (klasteryzacja) → Converge (głosowanie/decyzje) → Handoff. Na Handoff system automatycznie inicjuje konwersję do Inicjatywy.
**Efekty pracy** `handlePhaseChange`: waliduje wg `FACILITATION_TRANSITIONS` (np. ze start tylko organize); `facilitationUpdatePhase`; toast; activityLog; na `handoff` po 800ms dispatch `idea-workspace-quick-action {action:'convert_initiative'}`; handoff terminalny (brak dalszych przejść); stan → `/map`.
**Grafika** `WhiteboardPhaseBar` w panelu sesji z 4 fazami; aktualna podświetlona; nieprawidłowe przejścia zablokowane (transitions).
**Funkcjonalność** `handlePhaseChange` (`IdeaWhiteboardTool.tsx:1316`); `FACILITATION_TRANSITIONS` (`whiteboardContracts.ts:42`); `WhiteboardPhaseBar`.

### MC-09-26 · Follow-me + spotlight (prezentacja wyników) · [facilitation+presence]
**Co się dzieje** Na podsumowaniu facylitator włącza „Follow Me" — widoki uczestników podążają za jego kamerą; zaznacza kluczowy outcome i włącza Spotlight, by skupić uwagę.
**Efekty pracy** `toggleSessionFollow`: `followMe`, `facilitationUpdatePhase('follow_me')`; effect (`:2246`) co 5s wysyła `toolSessionHeartbeat` z viewportem; uczestnik z `followMe` czyta viewport facylitatora z presence → `idea-whiteboard-navigate`; `toggleSpotlightSelection` ustawia `spotlightNodeId`; stan → `/map` + heartbeat presence.
**Grafika** Toolbar „Follow" active (TrendingUp); panel badge Follow on/off; spotlight badge amber „Spotlight active"; uczestnicy: viewport animuje do kamery facylitatora.
**Funkcjonalność** `toggleSessionFollow` (`:1299`); `toggleSpotlightSelection` (`:1352`); follow effect (`:2246`); presence heartbeat (`:2198`).

---

## GRUPA E — Realtime collab (2 uczestników) (MC-09-27…29)

### MC-09-27 · Dwóch uczestników — sticky pojawia się u drugiego <1s · [MULTIPLAYER]
**Co się dzieje** Facylitator (okno A) i uczestnik (okno B, ta sama org) mają otwartą tę samą tablicę. A dodaje sticky „Risk: budget" — w oknie B pojawia się niemal natychmiast.
**Efekty pracy** `addElement` → `broadcastNodeAdd` → `graph_patch {op:'add_node'}` przez `useWhiteboardCollab`/WS org-scope `/ws/collab/:ideaId`; B odbiera `idea-collab-graph-patch`, `applyingRemoteRef` blokuje echo, `setNodes` dodaje (dedup po id); persystencja per-user osobno (`/map`). UWAGA P0 L-01: po reloadzie B (inny user) dostaje 404 na własnej mapie — realtime ≠ persystencja współdzielona.
**Grafika** Sticky materializuje się w oknie B bez akcji B; `CollaborationOverlay` pokazuje kursory/obecność.
**Funkcjonalność** `broadcastNodeAdd`/remote apply (`useWhiteboardCollab.ts:81,100`); `collab.registerCollabSend` z `CollaborationOverlay` (`IdeaWhiteboardTool.tsx:3053`).

### MC-09-28 · Współbieżny drag i resize — pozycje/wymiary synchronizują na drag-end · [MULTIPLAYER]
**Co się dzieje** A przeciąga ramkę i rozciąga kształt; B widzi finalną pozycję i wymiary po zakończeniu gestu (nie każdą klatkę). Jednoczesne ruchy obu nie echo-loopują.
**Efekty pracy** `broadcastNodeChanges`: tylko `position` z `dragging===false` → `update_node {position}`, `dimensions` z `resizing===false` → `update_node {style}`, `remove` → `remove_node`; selekcja i klatki w-locie pomijane (anti-flood); `applyingRemoteRef` z `setTimeout(0)` zwalnia po batchu (brak re-broadcastu).
**Grafika** W oknie B węzeł „przeskakuje" na finalną pozycję/rozmiar po puszczeniu przez A; brak migotania.
**Funkcjonalność** `broadcastNodeChanges` (`useWhiteboardCollab.ts:46`); guard `applyingRemoteRef` (`:104,138`); `onNodesChange` broadcast (`IdeaWhiteboardTool.tsx:775`).

### MC-09-29 · Wspólna sesja facylitacji — B widzi fazę/timer/voting A bez reloadu · [MULTIPLAYER+facilitation]
**Co się dzieje** A (facilitator) uruchamia timer i otwiera głosowanie; B (participant) widzi te zmiany w swoim panelu sesji w ciągu ~5s, mimo że to osobne okna. B nie może nadpisać roli facylitatora.
**Efekty pracy** Obaj `ensureFacilitationSession` → ta SAMA sesja (idempotent po `toolSessionId`); B re-read co 5s (`:2151`) czyta `facilitationGetSession` → role z `facilitator_id` (B=participant), `current_phase`, `timer_state.endsAt`, `votingOpen` (lub phase==='voting'); votes poll co 5s gdy votingOpen; B nie zapisuje roli facylitatora (guard `serverRole==='facilitator'`).
**Grafika** Panel sesji B aktualizuje timer/voting/follow badge i fazę PhaseBar; rola B = „Uczestnik" niezmiennie.
**Funkcjonalność** Live re-read effect (`IdeaWhiteboardTool.tsx:2151`); `ensureFacilitationSession` idempotent (`:1094`); presence (`:2198`).

---

## GRUPA F — Eksport / tło / dark mode / undo-redo / scenes (MC-09-30)

### MC-09-30 · Finał warsztatu: tło, dark mode, eksport, undo/redo, zapis · [export+bg+dark]
**Co się dzieje** Na koniec sesji facylitator: (1) przełącza tło dots→grid→lines→blank pod prezentację, (2) sprawdza tablicę w dark mode, (3) cofa pochopne usunięcie (Cmd+Z) i przywraca (Cmd+Shift+Z/Y), (4) zapisuje (Cmd+S, snapshot), (5) eksportuje tablicę.
**Efekty pracy** `setBgPattern` → `extensions.whiteboard.bgPattern` (`Background variant cross/lines/dots`, blank=brak); undo/redo z `undoStackRef`/`redoStackRef` (max 24 snapshoty, klon nodes/edges/drawingPaths/scenes); `handleSave`→`flushNow({createSnapshot:true})` + toast + `onSaved`; eksport dispatch `idea-workspace-open-export-menu` → `IdeaExportMenu`; sceny przez `IdeaScenesManager` (zapisy widoku); `fitView` Cmd/Ctrl+0 i Shift+1.
**Grafika** ToolbarDropdown Background (Dots/Grid/Lines/Blank); dark mode: `bg-[#0b1020]`, glow na węzłach, `useIsDark` przez MutationObserver; przyciski Undo/Redo (disabled gdy stos pusty); przycisk Save z „Saving…"/status label; MiniMap (toggle) z kolorami per typ węzła.
**Funkcjonalność** `setBgPattern`/Background (`IdeaWhiteboardTool.tsx:392`); `undoWhiteboard`/`redoWhiteboard` (`:704,716`); `handleSave` (`:2383`); export (`:2869`); `CanvasZoomControls`/`fitView` (`:191`); `useIsDark` (`whiteboardNodeHelpers.ts:88`).

---

## Macierz pokrycia funkcji (do audytu kompletności)

| Funkcja | Case'y |
|---|---|
| Sticky (8 kolorów, rozmiary, priorytet, komentarze) | 01, 02, 08 |
| Text block + fontSize/ikony | 05, 15, 16 |
| Shapes rectangle/circle/diamond/hexagon | 04 |
| Frames (grupujące, collapse, childCount) | 01, 02, 03, 12, 13 |
| Images (paste/drop, base64, cap 10MB, aspect) | 06, 07 |
| Links (drop URL) | 07 |
| Connectory / LabeledEdge | 04, 20 |
| NodeResizer (shape/text/frame/image; sticky BRAK) | 09 |
| Multi-select / SelectionBar / align / distribute | 03, 10, 11 |
| Group / Ungroup | 12 |
| Lock / Duplicate | 14 |
| Inline-edit (double-click, Enter/Esc) | 15 |
| Slash menu „/" | 16 |
| Context menu + AI Expand/Challenge | 17, 18 |
| AI Nudge Strip / propozycje Propose→Accept | 18, 19 |
| Facilitation session (idempotent, role z serwera) | 21, 22, 29 |
| Roles (cykl 3 ról) | 22 |
| Timer | 23 |
| Voting (dot voting, polling 5s) | 24 |
| Fazy start→organize→converge→handoff (auto-convert) | 25 |
| Follow-me / Spotlight / presence heartbeat | 26 |
| Realtime collab (graph_patch, add/move/resize/remove) | 27, 28 |
| Realtime facilitation (re-read 5s) | 29 |
| Quick-Start (brainstorm/affinity/workshop) | 02, 03 |
| Import Outline | 05 |
| Tło (dots/grid/lines/blank) | 30 |
| Dark mode | 30 |
| Undo/Redo (stos 24) | 30 |
| Eksport / Scenes / fit-view | 30 |
| Persystencja `/map` + autosave draft | wszystkie (efekt) |

> **Najgłębiej pokryte (zgodnie z poleceniem „eksploatuj wszystko"):** kształty wszystkich 4 typów z aspect-ratio (04), pełny model resize z pułapką „sticky bez NodeResizer" (09), kompletny lifecycle facylitacji z auto-konwersją na handoff (21–26), realtime z anti-echo/anti-flood (27–29), oraz governance/eksport/dark/undo w jednym finale (30).
