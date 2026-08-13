/**
 * Akcje rejestru Idea Workspace — domena: whiteboard.
 *
 * Wydzielone z `src/actions/ideaActionRegistry.ts` (QG-01, 2026-08-10),
 * verbatim (identyczne id/label/scope/surfaces/handler/mutates/undo/teresa),
 * tylko fizycznie przeniesione. SSOT formatu i reguł: nagłówek
 * `src/actions/ideaActionRegistry.ts` + `docs/standards/idea-workspace/02_REJESTR_AKCJI.md`.
 */

import type { ActionDef } from './types';
import {
  RUNTIME_AI_EXTRACT_ACTIONS,
  RUNTIME_AI_FIND_THEMES,
  RUNTIME_AI_NAME_CLUSTERS,
  RUNTIME_CYCLE_ROLE,
  RUNTIME_INSERT_IMAGE,
  RUNTIME_INSERT_LINK,
  RUNTIME_INSERT_SHAPE_CIRCLE,
  RUNTIME_INSERT_SHAPE_DIAMOND,
  RUNTIME_INSERT_SHAPE_HEXAGON,
  RUNTIME_TIDY_BOARD,
  RUNTIME_TOGGLE_FOLLOW,
  RUNTIME_TOGGLE_VOTING,
  RUNTIME_WB_TO_MINDMAP,
  RUNTIME_WB_TO_TABLE,
  dispatchQuickAction,
  runByTool,
  runContextMenuUiOnlyCallback,
  runFrameNodeParamCallback,
  runFrameParamCallback,
  runKeyboardOnlyCallback,
  runNodeEditLabelCallback,
  runToolbarBusAction,
  runToolbarUiOnlyCallback,
} from './runtimeHelpers';

export const WHITEBOARD_ACTIONS: ActionDef[] = [
  {
    id: 'idea.ai.find_themes',
    label: {
      pl: 'AI: znajdź tematy',
      en: 'AI: find themes',
    },
    icon: 'Search',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['rail', 'panel'],
    handler: (ctx) => runByTool('idea.ai.find_themes', RUNTIME_AI_FIND_THEMES, ctx),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'proposal',
      evidence:
        'POST /my-ideas/:id/ai-generate (wb_find_themes) → IdeaProposalReview (accept/reject per pozycja)',
    },
    teresa: {
      description:
        // ★ GRANICA NEGATYWNA (2026-07-24): na „ułóż tablicę automatycznie" dwa
        // z trzech modeli podstawiały tę akcję zamiast powiedzieć, że Tablica
        // nie ma auto-układu — zmierzone w żywej rundzie.
        // WB-P2-02: gated na semantyce etykiet — jeśli wszystkie karteczki w
        // zakresie (zaznaczenie, albo cała tablica gdy nic nie zaznaczono)
        // wciąż mają domyślną nazwę ("New note"/"Text"…), akcja ODMAWIA
        // wygenerowania (toast „needsRealLabels") zamiast zwrócić generyczny
        // wynik podany jako insight — patrz IdeaWhiteboardTool.tsx
        // runWhiteboardAIAction. Jeśli Teresa dostanie to polecenie, a użytkownik
        // nie nadał jeszcze żadnej karteczce realnej treści, powiedz to wprost
        // zamiast próbować i zgłaszać sukces bez treści.
        'Grupuje karteczki na Tablicy w tematy i proponuje ramkę dla każdego. Propozycje pokazuję do akceptacji — nic nie wskakuje samo. Grupuje TYLKO tematycznie; nie układa elementów na płótnie — Tablica nie ma automatycznego układu, więc na prośbę o ułożenie powiedz to wprost. Wymaga, żeby co najmniej jedna karteczka w zakresie miała realną, nie-domyślną nazwę — inaczej odmawiam z wyjaśnieniem, czego brakuje.',
    },
    runtime: RUNTIME_AI_FIND_THEMES,
    source:
      'src/components/MyWork/whiteboard/useWhiteboardQuickActions.ts:21 (AI_ACTION_MAP) + AIActionsPopover.tsx TOOL_GENERATORS (f5d0271992)',
  },
  {
    id: 'idea.ai.name_clusters',
    label: {
      pl: 'AI: nazwij skupiska',
      en: 'AI: name clusters',
    },
    icon: 'GitMerge',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['rail', 'panel'],
    handler: (ctx) => runByTool('idea.ai.name_clusters', RUNTIME_AI_NAME_CLUSTERS, ctx),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'proposal',
      evidence:
        'POST /my-ideas/:id/ai-generate (wb_name_clusters) → IdeaProposalReview (patch.updateNodes)',
    },
    teresa: {
      description:
        'Nadaje nazwy istniejącym skupiskom karteczek na Tablicy. Zmiana nazw wchodzi dopiero po akceptacji podglądu.',
    },
    runtime: RUNTIME_AI_NAME_CLUSTERS,
    source: 'src/components/MyWork/whiteboard/useWhiteboardQuickActions.ts:22 (AI_ACTION_MAP)',
  },
  {
    id: 'idea.ai.extract_actions',
    label: {
      pl: 'AI: wyciągnij działania',
      en: 'AI: extract action items',
    },
    icon: 'Target',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['rail', 'panel'],
    handler: (ctx) => runByTool('idea.ai.extract_actions', RUNTIME_AI_EXTRACT_ACTIONS, ctx),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'proposal',
      evidence: 'POST /my-ideas/:id/ai-generate (wb_extract_actions) → IdeaProposalReview',
    },
    teresa: {
      description:
        'Wyciąga z Tablicy konkretne działania do wykonania i proponuje je jako nowe elementy. Zawsze do akceptacji.',
    },
    runtime: RUNTIME_AI_EXTRACT_ACTIONS,
    source: 'src/components/MyWork/whiteboard/useWhiteboardQuickActions.ts:25 (AI_ACTION_MAP)',
  },
  {
    id: 'idea.canvas.insert_shape_circle',
    label: { pl: 'Wstaw: koło', en: 'Insert: circle' },
    icon: 'Circle',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['toolbar'],
    handler: (ctx) => runToolbarBusAction('idea.canvas.insert_shape_circle', RUNTIME_INSERT_SHAPE_CIRCLE, ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'stos undo Tablicy (wb_undo w useWhiteboardQuickActions.ts) po dodaniu elementu',
    },
    teresa: {
      description: 'Wstawia kształt koła na otwartą Tablicę.',
    },
    runtime: RUNTIME_INSERT_SHAPE_CIRCLE,
    source:
      'src/components/MyWork/whiteboard/WhiteboardToolbar.tsx:227-231 (dropdown „Wstaw") + useWhiteboardQuickActions.ts:100 (wb_add_shape_circle, dotąd nieużywany odbiornik)',
  },
  {
    id: 'idea.canvas.insert_shape_diamond',
    label: { pl: 'Wstaw: romb', en: 'Insert: diamond' },
    icon: 'Diamond',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['toolbar'],
    handler: (ctx) => runToolbarBusAction('idea.canvas.insert_shape_diamond', RUNTIME_INSERT_SHAPE_DIAMOND, ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'stos undo Tablicy (wb_undo w useWhiteboardQuickActions.ts) po dodaniu elementu',
    },
    teresa: {
      description: 'Wstawia kształt rombu na otwartą Tablicę.',
    },
    runtime: RUNTIME_INSERT_SHAPE_DIAMOND,
    source:
      'src/components/MyWork/whiteboard/WhiteboardToolbar.tsx:232-237 (dropdown „Wstaw") + useWhiteboardQuickActions.ts:101 (wb_add_shape_diamond, dotąd nieużywany odbiornik)',
  },
  {
    id: 'idea.canvas.insert_shape_hexagon',
    label: { pl: 'Wstaw: sześciokąt', en: 'Insert: hexagon' },
    icon: 'Hexagon',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['toolbar'],
    handler: (ctx) => runToolbarBusAction('idea.canvas.insert_shape_hexagon', RUNTIME_INSERT_SHAPE_HEXAGON, ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'stos undo Tablicy (wb_undo w useWhiteboardQuickActions.ts) po dodaniu elementu',
    },
    teresa: {
      description: 'Wstawia kształt sześciokąta na otwartą Tablicę.',
    },
    runtime: RUNTIME_INSERT_SHAPE_HEXAGON,
    source:
      'src/components/MyWork/whiteboard/WhiteboardToolbar.tsx:238-243 (dropdown „Wstaw") + useWhiteboardQuickActions.ts:102 (wb_add_shape_hexagon, dotąd nieużywany odbiornik)',
  },
  {
    id: 'idea.canvas.insert_image',
    label: { pl: 'Wstaw obraz', en: 'Insert image' },
    icon: 'Image',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['toolbar'],
    handler: (ctx) => runToolbarBusAction('idea.canvas.insert_image', RUNTIME_INSERT_IMAGE, ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'stos undo Tablicy (wb_undo w useWhiteboardQuickActions.ts) po dodaniu elementu',
    },
    teresa: {
      description: 'Wstawia placeholder obrazu na otwartą Tablicę.',
    },
    runtime: RUNTIME_INSERT_IMAGE,
    source:
      'src/components/MyWork/whiteboard/WhiteboardToolbar.tsx:244-249,257 (dropdown „Wstaw" + domyślny klik) + useWhiteboardQuickActions.ts:122 (wb_add_image, dotąd nieużywany odbiornik)',
  },
  {
    id: 'idea.canvas.insert_link',
    label: { pl: 'Wstaw link', en: 'Insert link' },
    icon: 'Link2',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['toolbar'],
    handler: (ctx) => runToolbarBusAction('idea.canvas.insert_link', RUNTIME_INSERT_LINK, ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'stos undo Tablicy (wb_undo w useWhiteboardQuickActions.ts) po dodaniu elementu',
    },
    teresa: {
      description: 'Wstawia placeholder linku na otwartą Tablicę.',
    },
    runtime: RUNTIME_INSERT_LINK,
    source:
      'src/components/MyWork/whiteboard/WhiteboardToolbar.tsx:250-255 (dropdown „Wstaw") + useWhiteboardQuickActions.ts:123 (wb_add_link, dotąd nieużywany odbiornik)',
  },
  {
    id: 'idea.canvas.toggle_voting',
    label: { pl: 'Głosowanie', en: 'Voting' },
    icon: 'ThumbsUp',
    // Stan SESJI współpracy (widoczny wszystkim uczestnikom), nie treść Idei —
    // tak jak `idea.canvas.cursor_select`, `mutates: false`: nie ma pozycji na
    // stosie Ctrl+Z, przełącza się z powrotem tym samym przyciskiem.
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['toolbar'],
    handler: (ctx) => runToolbarBusAction('idea.canvas.toggle_voting', RUNTIME_TOGGLE_VOTING, ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description: 'Włącza/wyłącza tryb głosowania sesji współpracy na Tablicy.',
    },
    runtime: RUNTIME_TOGGLE_VOTING,
    source:
      'src/components/MyWork/whiteboard/WhiteboardToolbar.tsx:300-307 (overflow „…") + useWhiteboardQuickActions.ts:151 (wb_session_toggle_voting, dotąd nieużywany odbiornik)',
  },
  {
    id: 'idea.canvas.cycle_role',
    label: { pl: 'Rola w sesji', en: 'Session role' },
    icon: 'Workflow',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['toolbar'],
    handler: (ctx) => runToolbarBusAction('idea.canvas.cycle_role', RUNTIME_CYCLE_ROLE, ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description: 'Przełącza własną rolę w bieżącej sesji współpracy na Tablicy (cykl ról).',
    },
    runtime: RUNTIME_CYCLE_ROLE,
    source:
      'src/components/MyWork/whiteboard/WhiteboardToolbar.tsx:308-314 (overflow „…") + useWhiteboardQuickActions.ts:149 (wb_session_cycle_role, dotąd nieużywany odbiornik)',
  },
  {
    id: 'idea.canvas.toggle_follow',
    label: { pl: 'Podążaj', en: 'Follow' },
    icon: 'TrendingUp',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['toolbar'],
    handler: (ctx) => runToolbarBusAction('idea.canvas.toggle_follow', RUNTIME_TOGGLE_FOLLOW, ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description: 'Włącza/wyłącza podążanie widokiem za prowadzącym sesję na Tablicy.',
    },
    runtime: RUNTIME_TOGGLE_FOLLOW,
    source:
      'src/components/MyWork/whiteboard/WhiteboardToolbar.tsx:315-322 (overflow „…") + useWhiteboardQuickActions.ts:152 (wb_session_toggle_follow, dotąd nieużywany odbiornik)',
  },
  {
    // UWAGA (odbiór): `idea.export.open` (scope='workspace', surfaces=['menu1'],
    // icon='Download') już istnieje i kończy się DOKŁADNIE tym samym efektem —
    // `IdeaMapWorkspace.tsx` nasłuchuje RÓWNOLEGLE `open_export_menu` (linia
    // ~1001) i `idea-workspace-open-export-menu` (linia 2931-2939), oba wołają
    // `setExportMenuOpen(true)`. Świadomie NIE reużyto tamtej akcji tutaj:
    // zrobiłoby to reużycie ikony `Download` zamiast dzisiejszej `ExternalLink`
    // tego przycisku — złamałoby wymóg "zero zmian wizualnych" tego zadania.
    // Zamiast tego osobny wpis z WŁASNĄ ikoną, ale dispatchujący TEN SAM,
    // już-nasłuchiwany event — zero nowej infrastruktury. Ujednolicenie tych
    // dwóch (jedna ikona wszędzie, zgodnie z Z1) to osobna decyzja właściciela,
    // nie ta migracja.
    id: 'idea.canvas.export_view',
    label: { pl: 'Eksport', en: 'Export' },
    icon: 'ExternalLink',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['toolbar'],
    handler: async (ctx) => {
      // UI: wykonaj ORYGINALNY prop-callback komponentu (`onExport`) wprost —
      // ten sam kontrakt co `runToolbarBusAction` (patrz komentarz tam);
      // konieczne, bo ten event NIE idzie przez `dispatchQuickAction`/
      // `idea-workspace-quick-action`, więc `runByTool` by tu nie pasował.
      const run = ctx.params?.run;
      if (ctx.source === 'ui' && typeof run === 'function') {
        (run as () => void)();
        return { ok: true, actionId: 'idea.canvas.export_view' };
      }
      // Teresa/inny wywołujący: ten sam event co `onExport` dziś nadaje —
      // odbiornik już istnieje (IdeaMapWorkspace.tsx:2931-2939), zero nowej szyny.
      window.dispatchEvent(
        new CustomEvent('idea-workspace-open-export-menu', { detail: { ideaId: ctx.ideaId } })
      );
      return {
        ok: true,
        actionId: 'idea.canvas.export_view',
        data: { runtime: 'idea-workspace-open-export-menu' },
      };
    },
    mutates: false,
    requiresPreview: false,
    teresa: {
      description: 'Otwiera okno eksportu otwartej Tablicy do pliku.',
    },
    source:
      'src/components/MyWork/whiteboard/WhiteboardToolbar.tsx:323-328 (overflow „…") + IdeaWhiteboardTool.tsx:4017-4021 (idea-workspace-open-export-menu) + IdeaMapWorkspace.tsx:2931-2939 (odbiornik)',
  },
  {
    // Bez istniejącego runtime stringa/odbiornika ANI dziś, ani gdziekolwiek w
    // `whiteboardIntentDetector.ts` (regexowy detektor intencji Tablicy — 0
    // trafień dla skrótów/tła/Zapisz/Wyczyść) — UI-only na tę turę,
    // `runToolbarUiOnlyCallback` (patrz komentarz przy jej definicji).
    id: 'idea.canvas.toggle_shortcuts',
    label: { pl: 'Skróty klawiszowe', en: 'Keyboard shortcuts' },
    icon: 'Keyboard',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['toolbar'],
    handler: (ctx) => runToolbarUiOnlyCallback('idea.canvas.toggle_shortcuts', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Pokazuje/chowa okno skrótów klawiszowych Tablicy. Dziś dostępne WYŁĄCZNIE z górnego paska narzędzi — Teresa nie ma jeszcze sposobu wywołania tego z czatu.',
    },
    source: 'src/components/MyWork/whiteboard/WhiteboardToolbar.tsx:329-334 (overflow „…")',
  },
  {
    id: 'idea.canvas.set_bg_dots',
    label: {
      pl: 'Tło: Kropki',
      en: 'Background: Dots',
    },
    icon: 'Circle',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['toolbar'],
    handler: (ctx) => runToolbarUiOnlyCallback('idea.canvas.set_bg_dots', ctx),
    // Preferencja WIDOKU (zapisywana z Ideą, ale bez wpisu na stosie Ctrl+Z —
    // tak jak `idea.canvas.cursor_select`), nie mutacja treści grafu.
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Ustawia tło Tablicy na wzór kropek. Dziś dostępne WYŁĄCZNIE z górnego paska narzędzi — Teresa tego jeszcze nie wywoła.',
    },
    source: 'src/components/MyWork/whiteboard/WhiteboardToolbar.tsx:335-341 (overflow „…", bg-dots)',
  },
  {
    id: 'idea.canvas.set_bg_grid',
    label: {
      pl: 'Tło: Siatka',
      en: 'Background: Grid',
    },
    icon: 'Grid3X3',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['toolbar'],
    handler: (ctx) => runToolbarUiOnlyCallback('idea.canvas.set_bg_grid', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Ustawia tło Tablicy na wzór siatki. Dziś dostępne WYŁĄCZNIE z górnego paska narzędzi — Teresa tego jeszcze nie wywoła.',
    },
    source: 'src/components/MyWork/whiteboard/WhiteboardToolbar.tsx:342-348 (overflow „…", bg-grid)',
  },
  {
    id: 'idea.canvas.set_bg_lines',
    label: {
      pl: 'Tło: Linie',
      en: 'Background: Lines',
    },
    icon: 'LayoutGrid',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['toolbar'],
    handler: (ctx) => runToolbarUiOnlyCallback('idea.canvas.set_bg_lines', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Ustawia tło Tablicy na wzór linii. Dziś dostępne WYŁĄCZNIE z górnego paska narzędzi — Teresa tego jeszcze nie wywoła.',
    },
    source: 'src/components/MyWork/whiteboard/WhiteboardToolbar.tsx:349-355 (overflow „…", bg-lines)',
  },
  {
    id: 'idea.canvas.set_bg_blank',
    label: {
      pl: 'Tło: Puste',
      en: 'Background: Blank',
    },
    icon: 'Shapes',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['toolbar'],
    handler: (ctx) => runToolbarUiOnlyCallback('idea.canvas.set_bg_blank', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Ustawia puste (bez wzoru) tło Tablicy. Dziś dostępne WYŁĄCZNIE z górnego paska narzędzi — Teresa tego jeszcze nie wywoła.',
    },
    source: 'src/components/MyWork/whiteboard/WhiteboardToolbar.tsx:356-362 (overflow „…", bg-blank)',
  },
  {
    // WB-P2-03 (08_P1_P3_EXECUTION_PLAN §6 Whiteboard) — "Tidy board" /
    // "Auto arrange selection". Real bus receiver (`wb_tidy_board` →
    // useWhiteboardQuickActions.ts → useWhiteboardNodes.tidyBoard), so —
    // unlike `idea.canvas.save`/`idea.canvas.clear_drawings` above, which
    // are UI-only echoes — this one uses `runByTool` and IS reachable from
    // Teresa, exactly like `idea.ai.find_themes`.
    id: 'idea.canvas.tidy_board',
    label: { pl: 'Uporządkuj tablicę', en: 'Tidy board' },
    icon: 'Wand2',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['toolbar'],
    handler: (ctx) => runByTool('idea.canvas.tidy_board', RUNTIME_TIDY_BOARD, ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'useWhiteboardNodes.ts tidyBoard() → pushSnapshot() (IdeaWhiteboardTool.tsx pushUndoSnapshot) before setNodes, exactly like groupSelected/distributeNodes',
    },
    teresa: {
      description:
        'Porządkuje rozłożenie obiektów na Tablicy bez zmiany treści: gdy zaznaczone są 2+ odblokowane obiekty, porządkuje TYLKO zaznaczenie; w przeciwnym razie całą tablicę. Sekcje/ramki z zawartością przesuwane są razem jako jedna całość — ich wzajemny układ wewnątrz ramki się nie zmienia. Obiekty zablokowane nigdy nie są przesuwane. Odwracalne (Cofnij).',
    },
    source:
      'src/components/MyWork/whiteboard/useWhiteboardNodes.ts tidyBoard + WhiteboardToolbar.tsx overflow „…" (tidy-board) + IdeaWhiteboardTool.tsx wbEditBarModel arrange group (selection variant)',
  },
  {
    id: 'idea.canvas.save',
    label: { pl: 'Zapisz', en: 'Save' },
    icon: 'Save',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['toolbar'],
    // Skrót (2026-08-10, reconciliacja): `useIdeasToolKeyboard.ts`'s `onSave`
    // (Ctrl/Cmd+S) na Tablicy woła DOKŁADNIE `handleSave` — ten sam prop co
    // przycisk „Zapisz" wyżej (`WhiteboardToolbar.tsx`). Przepływ ma WŁASNY
    // `handleSave` (inna funkcja, brak przycisku w pasku) — NIE rozszerzono
    // `tools` tego wpisu o `process_flow`: komunikat odmowy
    // `runToolbarUiOnlyCallback` mówi wprost „Tablicy", rozszerzenie
    // wprowadziłoby nieuczciwy komunikat dla Przepływu — patrz osobny wpis
    // `idea.canvas.pf_save` niżej zamiast tego.
    shortcut: '⌘S',
    handler: (ctx) => runToolbarUiOnlyCallback('idea.canvas.save', ctx),
    // Zapisuje już-zmutowany stan (persystencja), nie tworzy nowej mutacji —
    // `mutates: false`, analogicznie do akcji „otwiera X" w tym rejestrze
    // (np. `idea.ai.table_assistant`), gdzie realna zmiana (jeśli w ogóle)
    // żyje gdzie indziej.
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Zapisuje bieżący stan Tablicy natychmiast (poza automatycznym zapisem w tle). Dziś dostępne WYŁĄCZNIE z górnego paska narzędzi — Teresa tego jeszcze nie wywoła.',
    },
    source: 'src/components/MyWork/whiteboard/WhiteboardToolbar.tsx:375-393 (przycisk Zapisz)',
  },
  {
    // Destrukcyjne (trwałe usunięcie WSZYSTKICH rysunków odręcznych), z
    // dialogiem potwierdzenia PRZED wykonaniem (IdeaWhiteboardTool.tsx
    // showConfirm) — dokładnie jak `idea.edge.delete`, `destructive: true`
    // OSOBNO od `mutates`/`undo`.
    id: 'idea.canvas.clear_drawings',
    label: { pl: 'Wyczyść rysunki', en: 'Clear drawings' },
    icon: 'Trash2',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['toolbar'],
    handler: (ctx) => runToolbarUiOnlyCallback('idea.canvas.clear_drawings', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'IdeaWhiteboardTool.tsx onClearDrawings prop (WhiteboardToolbar.tsx:3995-4013) → pushUndoSnapshot() przed setDrawingPaths([]) (stos Ctrl+Z), za dialogiem potwierdzenia',
    },
    destructive: true,
    teresa: {
      description:
        'Usuwa WSZYSTKIE rysunki odręczne (pen paths) z Tablicy na trwałe, po potwierdzeniu w dialogu. Dziś dostępne WYŁĄCZNIE z górnego paska narzędzi — Teresa tego jeszcze nie wywoła.',
    },
    source: 'src/components/MyWork/IdeaWhiteboardTool.tsx:3995-4013 (onClearDrawings)',
  },
  {
    id: 'idea.node.edit',
    label: { pl: 'Edytuj', en: 'Edit' },
    icon: 'Pencil',
    scope: 'single_item',
    tools: ['whiteboard'],
    surfaces: ['context'],
    handler: (ctx) => runNodeEditLabelCallback(ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'ZASTRZEŻENIE (odkryte przy tym wpisie, nie naprawiane tu): odbiornik idea-workspace-node-update w IdeaWhiteboardTool.tsx:2551-2569 NIE woła pushUndoSnapshot() przed setNodes — w przeciwieństwie do duplicate/delete/lock/layer poniżej, edycja etykiety węzła nie trafia dziś na stos Ctrl+Z (prawdziwe też przed tym wpisem — handleBaseAction "edit" też nigdy tego nie wołał).',
    },
    teresa: {
      description:
        'Zmienia etykietę (treść) wskazanego elementu na Tablicy. Podaj `nodeId` elementu i nową `label`.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Id elementu na Tablicy.' },
          label: { type: 'string', description: 'Nowa treść etykiety.' },
        },
        required: ['nodeId', 'label'],
      },
    },
    source:
      'src/components/MyWork/IdeaCanvasContextMenu.tsx BASE_NODE_ACTIONS kind=edit + handleBaseAction:403-416',
  },
  {
    id: 'idea.node.copy',
    label: { pl: 'Kopiuj', en: 'Copy' },
    icon: 'Clipboard',
    scope: 'single_item',
    tools: ['whiteboard'],
    surfaces: ['context'],
    // Skrót (2026-08-10, reconciliacja): `useIdeasToolKeyboard.ts`'s `onCopy`
    // (Ctrl/Cmd+C, Tablica) woła DOKŁADNIE `copySelected()` — ta sama funkcja
    // co ta pozycja menu (patrz `teresa.description` niżej).
    shortcut: '⌘C',
    handler: (ctx) => runContextMenuUiOnlyCallback('idea.node.copy', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        // WB-CLIPBOARD-01 NAPRAWIONE (2026-08-10, docs/qa/ideas-complete-
        // transformation-2026-08-09/02_EXECUTION_LEDGER.csv): było WYŁĄCZNIE
        // kopią TEKSTU etykiety do schowka systemowego. Teraz — jak
        // `idea.node.pf_copy` Przepływu — kopiuje węzeł (i jego wewnętrzne
        // krawędzie) do schowka NARZĘDZIA (`copySelected()` w
        // `whiteboard/useWhiteboardNodes.ts`, ten sam ref-owy wzorzec co
        // `schowekRef`/`kopiujWezly` Przepływu), konsumowanego przez nowe
        // `idea.canvas.paste`. Prawy klik już zaznacza kliknięty węzeł
        // (`handleCanvasContextMenu`), więc ta akcja kopiuje AKTUALNE
        // zaznaczenie — nie osobny `copyNodeById`, w przeciwieństwie do
        // Przepływu (tam prawy klik NIE zaznacza).
        'Kopiuje wskazany element (i jego wewnętrzne połączenia) do schowka narzędzia — realna kopia obiektu, konsumowana przez „Wklej" na tle płótna (`idea.canvas.paste`), nie kopia samego tekstu. Dziś dostępne WYŁĄCZNIE z menu prawego kliku — schowek to zmienna w przeglądarce, bez odbiornika na szynie.',
    },
    source:
      'src/components/MyWork/IdeaCanvasContextMenu.tsx BASE_NODE_ACTIONS kind=copy + handleBaseAction (onCopySelected) + whiteboard/useWhiteboardNodes.ts copySelected/copyNodeById/clipboardRef (WB-CLIPBOARD-01 fix)',
  },
  {
    id: 'idea.canvas.paste',
    label: { pl: 'Wklej', en: 'Paste' },
    icon: 'ClipboardPaste',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['context'],
    shortcut: '⌘V',
    handler: (ctx) => runContextMenuUiOnlyCallback('idea.canvas.paste', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'pasteClipboard() → pushSnapshot() w whiteboard/useWhiteboardNodes.ts.',
    },
    teresa: {
      description:
        'Wkleja zawartość schowka NARZĘDZIA Tablicy (element(y) + połączenia między nimi skopiowane przez „Kopiuj"/`idea.node.copy`) jako nowe elementy, przesunięte względem oryginałów. Dziś dostępne WYŁĄCZNIE z menu prawego kliku na tło — schowek żyje w `useRef` przeglądarki (nie na serwerze), Teresa tego jeszcze nie wywoła. Ta sama uczciwa granica co Przepływu `idea.view.pf_paste_at_point` i Mapy myśli `idea.view.paste_at_point`.',
    },
    source:
      'src/components/MyWork/IdeaCanvasContextMenu.tsx BASE_PANE_ACTIONS kind=paste + handleBaseAction (onPaste) + whiteboard/useWhiteboardNodes.ts pasteClipboard/clipboardRef (WB-CLIPBOARD-01 fix)',
  },
  {
    // NOWY wpis (2026-08-10, reconciliacja skrótów) — `useIdeasToolKeyboard.ts`'s
    // `onSelectAll` (Ctrl/Cmd+A, Tablica) woła inline `setNodes(nds => nds.map(
    // n => ({...n, selected: true})))` — SPRAWDZONE grepem: bez żadnego
    // menu/przycisku gdziekolwiek w kodzie Tablicy (w przeciwieństwie do Mapy
    // myśli, gdzie `idea.view.select_all` już istnieje z realnym odbiornikiem
    // na szynie). `mutates: false` — stan zaznaczenia, nie treść (ta sama
    // konwencja co `idea.canvas.cursor_select`).
    id: 'idea.canvas.wb_select_all',
    label: { pl: 'Zaznacz wszystko', en: 'Select all' },
    icon: 'Grid3X3',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['keyboard'],
    shortcut: '⌘A',
    handler: (ctx) => runKeyboardOnlyCallback('idea.canvas.wb_select_all', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Zaznacza wszystkie elementy na otwartej Tablicy. Dziś dostępne WYŁĄCZNIE ze skrótu klawiszowego — Teresa tego jeszcze nie wywoła (lokalny stan `nodes[].selected`, brak stringa runtime).',
    },
    source: 'src/components/MyWork/IdeaWhiteboardTool.tsx onSelectAll (~L3745, useCanvasKeyboard)',
  },
  {
    id: 'idea.node.bring_to_front',
    label: { pl: 'Warstwa: na wierzch', en: 'Layer: bring to front' },
    icon: 'BringToFront',
    scope: 'selected_items',
    tools: ['whiteboard'],
    surfaces: ['context'],
    handler: (ctx) => runContextMenuUiOnlyCallback('idea.node.bring_to_front', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'IdeaWhiteboardTool.tsx bringSelectedToFront:3043-3052 → pushUndoSnapshot()',
    },
    teresa: {
      description:
        'Przenosi zaznaczone elementy na wierzch (kolejność rysowania) na Tablicy. Dziś dostępne WYŁĄCZNIE z menu prawego kliku — brak odbiornika na szynie, Teresa tego jeszcze nie wywoła.',
    },
    source:
      'src/components/MyWork/IdeaCanvasContextMenu.tsx BASE_NODE_ACTIONS kind=bring_to_front + IdeaWhiteboardTool.tsx:3043',
  },
  {
    id: 'idea.node.send_to_back',
    label: { pl: 'Warstwa: pod spód', en: 'Layer: send to back' },
    icon: 'SendToBack',
    scope: 'selected_items',
    tools: ['whiteboard'],
    surfaces: ['context'],
    handler: (ctx) => runContextMenuUiOnlyCallback('idea.node.send_to_back', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'IdeaWhiteboardTool.tsx sendSelectedToBack:3054-3063 → pushUndoSnapshot()',
    },
    teresa: {
      description:
        'Przenosi zaznaczone elementy pod spód (kolejność rysowania) na Tablicy. Dziś dostępne WYŁĄCZNIE z menu prawego kliku — brak odbiornika na szynie, Teresa tego jeszcze nie wywoła.',
    },
    source:
      'src/components/MyWork/IdeaCanvasContextMenu.tsx BASE_NODE_ACTIONS kind=send_to_back + IdeaWhiteboardTool.tsx:3054',
  },
  {
    id: 'idea.node.lock',
    // Bazowa etykieta = stan "zablokuj" (jak w oryginalnym BASE_NODE_ACTIONS).
    // Komponent nadal robi lokalny swap na "Odblokuj"/"Unlock" wg
    // `target.nodeLocked`, dokładnie jak przed tym wpisem — rejestr nie modeluje
    // stanu per-instancja, tylko domyślną etykietę.
    label: { pl: 'Zablokuj', en: 'Lock' },
    icon: 'Lock',
    scope: 'selected_items',
    tools: ['whiteboard'],
    surfaces: ['context'],
    handler: (ctx) => runContextMenuUiOnlyCallback('idea.node.lock', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'IdeaWhiteboardTool.tsx lockSelected:3023-3038 → pushUndoSnapshot()',
    },
    teresa: {
      description:
        'Przełącza blokadę (edycja/przesuwanie/usuwanie) zaznaczonych elementów na Tablicy. Dziś dostępne WYŁĄCZNIE z menu prawego kliku — brak odbiornika na szynie, Teresa tego jeszcze nie wywoła.',
    },
    source:
      'src/components/MyWork/IdeaCanvasContextMenu.tsx BASE_NODE_ACTIONS kind=lock + IdeaWhiteboardTool.tsx:3023',
  },
  {
    id: 'idea.node.expand',
    label: { pl: 'AI: Rozbuduj', en: 'AI: Expand' },
    icon: 'GitBranch',
    scope: 'single_item',
    tools: ['whiteboard'],
    surfaces: ['context'],
    handler: (ctx) => runContextMenuUiOnlyCallback('idea.node.expand', ctx),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'proposal',
      evidence:
        'generateAIProposal(generatorType:"mindmap_expand") → onGenerateProposal → IdeaProposalReview (accept/reject)',
    },
    teresa: {
      description:
        'Proponuje rozbudowanie wskazanego elementu Tablicy o nowe powiązane elementy (AI). Zawsze do akceptacji w podglądzie. Dziś dostępne WYŁĄCZNIE z menu prawego kliku.',
    },
    source: 'src/components/MyWork/IdeaCanvasContextMenu.tsx NODE_ACTIONS id=expand:166-174',
  },
  {
    id: 'idea.node.challenge',
    label: { pl: 'AI: Kwestionuj', en: 'AI: Challenge' },
    icon: 'Target',
    scope: 'single_item',
    tools: ['whiteboard'],
    surfaces: ['context'],
    handler: (ctx) => runContextMenuUiOnlyCallback('idea.node.challenge', ctx),
    // Nie mutuje grafu — wysyła pytanie do czatu (onSendToChat), sam element
    // zostaje bez zmian.
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Wysyła do czatu pytanie kwestionujące wskazany element Tablicy (nie zmienia elementu — to prompt do rozmowy). Dziś dostępne WYŁĄCZNIE z menu prawego kliku.',
    },
    source: 'src/components/MyWork/IdeaCanvasContextMenu.tsx NODE_ACTIONS id=challenge:175-183',
  },
  {
    id: 'idea.node.find_evidence',
    label: { pl: 'AI: Znajdź dowody', en: 'AI: Find evidence' },
    icon: 'Search',
    scope: 'single_item',
    tools: ['whiteboard'],
    surfaces: ['context'],
    handler: (ctx) => runContextMenuUiOnlyCallback('idea.node.find_evidence', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Wysyła do czatu prośbę o dowody dla wskazanego elementu Tablicy (nie zmienia elementu — to prompt do rozmowy). Dziś dostępne WYŁĄCZNIE z menu prawego kliku.',
    },
    source: 'src/components/MyWork/IdeaCanvasContextMenu.tsx NODE_ACTIONS id=evidence:184-192',
  },
  {
    id: 'idea.node.suggest_connections',
    label: { pl: 'AI: Sugeruj połączenia', en: 'AI: Suggest connections' },
    icon: 'Link2',
    scope: 'single_item',
    tools: ['whiteboard'],
    surfaces: ['context'],
    handler: (ctx) => runContextMenuUiOnlyCallback('idea.node.suggest_connections', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Wysyła do czatu prośbę o sugestie połączeń dla wskazanego elementu Tablicy (nie zmienia elementu — to prompt do rozmowy). Dziś dostępne WYŁĄCZNIE z menu prawego kliku.',
    },
    source: 'src/components/MyWork/IdeaCanvasContextMenu.tsx NODE_ACTIONS id=connections:193-201',
  },
  {
    id: 'idea.node.attach_knowledge',
    label: { pl: 'Dołącz wiedzę', en: 'Attach knowledge' },
    icon: 'BookOpen',
    scope: 'single_item',
    tools: ['whiteboard'],
    surfaces: ['context'],
    handler: (ctx) => runContextMenuUiOnlyCallback('idea.node.attach_knowledge', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        // Sprawdzone: `attach_artifact` na szynie `idea-workspace-quick-action`
        // MA odbiornik (IdeaMapWorkspace.tsx:985), ale czyta `selectionRef`
        // (bieżące zaznaczenie UI) i CAŁKOWICIE IGNORUJE `detail.nodeId` — nie
        // jest więc adresowalne po id z czatu, tylko z żywego zaznaczenia w
        // przeglądarce. Ta sama klasa ograniczenia co "martwy fallback
        // ctx.selection" udokumentowany przy idea.edge.* — tu nawet gorzej,
        // bo nie ma ŻADNEJ parametrowej ścieżki. Stąd UI-only, nie bus-wired.
        'Otwiera panel dołączania wiedzy (Vault) dla wskazanego elementu Tablicy. Dziś dostępne WYŁĄCZNIE z menu prawego kliku — odbiornik na szynie istnieje, ale działa na bieżące zaznaczenie w przeglądarce, nie na `nodeId` z czatu.',
    },
    source:
      'src/components/MyWork/IdeaCanvasContextMenu.tsx NODE_ACTIONS id=attach_knowledge:202-208 + IdeaMapWorkspace.tsx:985 (attach_artifact, selection-only)',
  },
  {
    id: 'idea.node.comments',
    label: { pl: 'Komentarze', en: 'Comments' },
    icon: 'MessageSquare',
    scope: 'single_item',
    tools: ['whiteboard'],
    surfaces: ['context'],
    handler: (ctx) => runContextMenuUiOnlyCallback('idea.node.comments', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Otwiera panel komentarzy wskazanego elementu Tablicy (lokalny stan panelu, nie mutuje elementu). Dziś dostępne WYŁĄCZNIE z menu prawego kliku.',
    },
    source: 'src/components/MyWork/IdeaCanvasContextMenu.tsx NODE_ACTIONS id=wb_comments:211-218',
  },
  {
    id: 'idea.node.ai_find_themes',
    label: { pl: 'AI: Znajdź tematy', en: 'AI: Find themes' },
    icon: 'Layers',
    scope: 'single_item',
    tools: ['whiteboard'],
    surfaces: ['context'],
    handler: (ctx) => runToolbarBusAction('idea.node.ai_find_themes', RUNTIME_AI_FIND_THEMES, ctx),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'proposal',
      evidence: 'POST /my-ideas/:id/ai-generate (wb_find_themes) → IdeaProposalReview',
    },
    teresa: {
      description:
        // Wersja tej samej AI generacji co `idea.ai.find_themes` (rail/panel),
        // ale wywołana z menu węzła: ludzki klik ogniskuje seedText na
        // wskazanym elemencie ("Focus on: <label>"), a dispatch na szynę
        // (Teresa) NIE niesie tego ogniska — trafia do `runWhiteboardAIAction`,
        // który generuje z całej Tablicy + bieżącym zaznaczeniem UI (jeśli
        // jest), nie z konkretnego `nodeId`. Uczciwie różne zachowanie
        // UI-vs-Teresa, nie regres — świadomy kompromis zamiast nowej szyny.
        'Grupuje karteczki Tablicy w tematy i proponuje ramkę dla każdego (do akceptacji). Wywołane z czatu działa na całej Tablicy (i bieżącym zaznaczeniu w przeglądarce, jeśli jest) — nie da się dziś ograniczyć do jednego wskazanego elementu spoza UI.',
    },
    runtime: RUNTIME_AI_FIND_THEMES,
    source:
      'src/components/MyWork/IdeaCanvasContextMenu.tsx NODE_ACTIONS id=wb_find_themes:219-228 + useWhiteboardQuickActions.ts AI_ACTION_MAP',
  },
  {
    id: 'idea.node.ai_name_clusters',
    label: { pl: 'AI: Nazwij klastry', en: 'AI: Name clusters' },
    icon: 'Tags',
    scope: 'single_item',
    tools: ['whiteboard'],
    surfaces: ['context'],
    handler: (ctx) =>
      runToolbarBusAction('idea.node.ai_name_clusters', RUNTIME_AI_NAME_CLUSTERS, ctx),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'proposal',
      evidence: 'POST /my-ideas/:id/ai-generate (wb_name_clusters) → IdeaProposalReview',
    },
    teresa: {
      description:
        'Nadaje nazwy skupiskom karteczek na Tablicy (do akceptacji). Wywołane z czatu działa na całej Tablicy, nie tylko na jednym wskazanym elemencie spoza UI (patrz idea.node.ai_find_themes).',
    },
    runtime: RUNTIME_AI_NAME_CLUSTERS,
    source:
      'src/components/MyWork/IdeaCanvasContextMenu.tsx NODE_ACTIONS id=wb_name_clusters:229-237 + useWhiteboardQuickActions.ts AI_ACTION_MAP',
  },
  {
    id: 'idea.node.ai_extract_actions',
    label: { pl: 'AI: Wyodrębnij akcje', en: 'AI: Extract actions' },
    icon: 'ListChecks',
    scope: 'single_item',
    tools: ['whiteboard'],
    surfaces: ['context'],
    handler: (ctx) =>
      runToolbarBusAction('idea.node.ai_extract_actions', RUNTIME_AI_EXTRACT_ACTIONS, ctx),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'proposal',
      evidence: 'POST /my-ideas/:id/ai-generate (wb_extract_actions) → IdeaProposalReview',
    },
    teresa: {
      description:
        'Wyciąga konkretne działania z Tablicy jako nowe elementy (do akceptacji). Wywołane z czatu działa na całej Tablicy, nie tylko na jednym wskazanym elemencie spoza UI (patrz idea.node.ai_find_themes).',
    },
    runtime: RUNTIME_AI_EXTRACT_ACTIONS,
    source:
      'src/components/MyWork/IdeaCanvasContextMenu.tsx NODE_ACTIONS id=wb_extract_actions:238-246 + useWhiteboardQuickActions.ts AI_ACTION_MAP',
  },
  {
    id: 'idea.canvas.fill_gap',
    label: { pl: 'AI: Wypełnij luki', en: 'AI: Fill gaps' },
    icon: 'Lightbulb',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['context'],
    handler: (ctx) => runContextMenuUiOnlyCallback('idea.canvas.fill_gap', ctx),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'proposal',
      evidence: 'generateAIProposal(generatorType:"suggestions") → IdeaProposalReview',
    },
    teresa: {
      description:
        'Proponuje nowe elementy wypełniające luki na Tablicy (do akceptacji). Dziś dostępne WYŁĄCZNIE z menu prawego kliku na tle — brak odbiornika na szynie, Teresa tego jeszcze nie wywoła.',
    },
    source: 'src/components/MyWork/IdeaCanvasContextMenu.tsx EMPTY_ACTIONS id=fill_gap:250-257',
  },
  {
    id: 'idea.canvas.brainstorm_here',
    label: { pl: 'AI: Brainstorm tutaj', en: 'AI: Brainstorm here' },
    icon: 'Brain',
    scope: 'current_view',
    tools: ['whiteboard'],
    surfaces: ['context'],
    handler: (ctx) => runContextMenuUiOnlyCallback('idea.canvas.brainstorm_here', ctx),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'proposal',
      evidence: 'generateAIProposal(generatorType:"whiteboard_brainstorm") → IdeaProposalReview',
    },
    teresa: {
      description:
        'Generuje pomysły przy pozycji kliknięcia na Tablicy (do akceptacji). Dziś dostępne WYŁĄCZNIE z menu prawego kliku na tle — brak odbiornika na szynie, Teresa tego jeszcze nie wywoła.',
    },
    source: 'src/components/MyWork/IdeaCanvasContextMenu.tsx EMPTY_ACTIONS id=brainstorm:258-265',
  },
  {
    id: 'idea.canvas.to_mindmap',
    label: { pl: 'AI: Przekształć w mapę myśli', en: 'AI: Convert to mind map' },
    icon: 'Network',
    scope: 'current_view',
    tools: ['whiteboard'],
    // Rail tier B (2026-08-10) — REUŻYCIE po mechanizmie: popover AI lewego
    // raila w Tablicy („Zamień na mapę myśli", `AIActionsPopover.tsx`
    // TOOL_GENERATORS) wysyła ten sam `wb_ai_to_map` i wpada w tę samą pozycję
    // `AI_ACTION_MAP` (`useWhiteboardQuickActions.ts`) co menu prawego kliku.
    surfaces: ['context', 'rail'],
    handler: (ctx) => runToolbarBusAction('idea.canvas.to_mindmap', RUNTIME_WB_TO_MINDMAP, ctx),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'proposal',
      evidence: 'POST /my-ideas/:id/ai-generate (wb_to_map_branches) → IdeaProposalReview',
    },
    teresa: {
      description:
        'Proponuje przekształcenie zawartości Tablicy w gałęzie Mapy myśli — wynik pokazuje się jako podgląd NA Tablicy, do akceptacji (nie tworzy sam z siebie nowej Mapy).',
    },
    runtime: RUNTIME_WB_TO_MINDMAP,
    source:
      'src/components/MyWork/IdeaCanvasContextMenu.tsx EMPTY_ACTIONS id=wb_to_map_branches:269-276 + useWhiteboardQuickActions.ts AI_ACTION_MAP',
  },
  {
    id: 'idea.canvas.to_table',
    label: { pl: 'AI: Przekształć w tabelę', en: 'AI: Convert to table' },
    icon: 'Table2',
    scope: 'current_view',
    tools: ['whiteboard'],
    // Rail tier B (2026-08-10) — REUŻYCIE po mechanizmie, jak `to_mindmap` wyżej
    // (`wb_ai_to_table`, ta sama `AI_ACTION_MAP`).
    surfaces: ['context', 'rail'],
    handler: (ctx) => runToolbarBusAction('idea.canvas.to_table', RUNTIME_WB_TO_TABLE, ctx),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'proposal',
      evidence: 'POST /my-ideas/:id/ai-generate (wb_to_table) → IdeaProposalReview',
    },
    teresa: {
      description:
        'Proponuje przekształcenie zawartości Tablicy w wiersze Tabeli — wynik pokazuje się jako podgląd NA Tablicy, do akceptacji (nie tworzy sam z siebie nowej Tabeli).',
    },
    runtime: RUNTIME_WB_TO_TABLE,
    source:
      'src/components/MyWork/IdeaCanvasContextMenu.tsx EMPTY_ACTIONS id=wb_to_table:277-285 + useWhiteboardQuickActions.ts AI_ACTION_MAP',
  },
  {
    id: 'idea.frame.select_contents',
    label: { pl: 'Zaznacz zawartość', en: 'Select contents' },
    icon: 'Boxes',
    scope: 'lane_frame',
    tools: ['whiteboard'],
    surfaces: ['context'],
    handler: (ctx) => runFrameParamCallback('idea.frame.select_contents', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Zaznacza na Tablicy wszystkie elementy zawarte we wskazanej ramce (sama ramka zostaje niezaznaczona). Podaj `frameId`. Bez zawartości — bez efektu.',
      parameters: {
        type: 'object',
        properties: { frameId: { type: 'string', description: 'Id ramki na Tablicy.' } },
        required: ['frameId'],
      },
    },
    source:
      'src/components/MyWork/whiteboard/useWhiteboardNodes.ts selectFrameContents (nowa funkcja, WB-FRAME-01) + IdeaCanvasContextMenu.tsx registryFrameItems',
  },
  {
    id: 'idea.frame.add_selection',
    label: { pl: 'Dodaj zaznaczenie do ramki', en: 'Add selection to frame' },
    icon: 'FolderInput',
    scope: 'lane_frame',
    tools: ['whiteboard'],
    surfaces: ['context'],
    handler: (ctx) => runContextMenuUiOnlyCallback('idea.frame.add_selection', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'addSelectionToFrame() → pushSnapshot() w useWhiteboardNodes.ts (WB-FRAME-01).',
    },
    teresa: {
      description:
        'Przypisuje elementy DZIŚ zaznaczone w przeglądarce użytkownika (odblokowane, bez własnej ramki, same nie będące ramką) jako zawartość wskazanej ramki. UWAGA: działa WYŁĄCZNIE na to, co jest dziś zaznaczone na płótnie — Teresa nie ma współrzędnych ani listy zaznaczenia, więc dziś dostępne WYŁĄCZNIE z menu prawego kliku (ta sama uczciwa granica co „Kopiuj"/idea.node.copy).',
    },
    source:
      'src/components/MyWork/whiteboard/useWhiteboardNodes.ts addSelectionToFrame (nowa funkcja, WB-FRAME-01) + IdeaCanvasContextMenu.tsx registryFrameItems',
  },
  {
    id: 'idea.frame.resize_to_fit',
    label: { pl: 'Dopasuj rozmiar do zawartości', en: 'Resize to fit contents' },
    icon: 'Maximize2',
    scope: 'lane_frame',
    tools: ['whiteboard'],
    surfaces: ['context'],
    handler: (ctx) => runFrameParamCallback('idea.frame.resize_to_fit', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'resizeFrameToFit() → pushSnapshot() w useWhiteboardNodes.ts (WB-FRAME-01).',
    },
    teresa: {
      description:
        'Powiększa wskazaną ramkę tak, by mieściła całą swoją zawartość (nigdy nie zmniejsza, nigdy nie przesuwa lewego górnego rogu ramki — element leżący POWYŻEJ/NA LEWO od tego rogu zostaje częściowo poza ramką, świadome ograniczenie, nie cichy błąd). Podaj `frameId`.',
      parameters: {
        type: 'object',
        properties: { frameId: { type: 'string', description: 'Id ramki na Tablicy.' } },
        required: ['frameId'],
      },
    },
    source:
      'src/components/MyWork/whiteboard/useWhiteboardNodes.ts resizeFrameToFit (nowa funkcja, WB-FRAME-01) + IdeaCanvasContextMenu.tsx registryFrameItems',
  },
  {
    id: 'idea.frame.delete_with_contents',
    label: { pl: 'Usuń ramkę i zawartość', en: 'Delete frame and contents' },
    icon: 'Trash2',
    scope: 'lane_frame',
    tools: ['whiteboard'],
    surfaces: ['context'],
    handler: (ctx) => runFrameParamCallback('idea.frame.delete_with_contents', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'deleteFrame(frameId,false) → pushSnapshot() w useWhiteboardNodes.ts (WB-FRAME-01).',
    },
    destructive: true,
    teresa: {
      description:
        'Usuwa wskazaną ramkę WRAZ z całą jej zawartością (cofnięcie przez Ctrl+Z w tej samej sesji). Podaj `frameId`.',
      parameters: {
        type: 'object',
        properties: { frameId: { type: 'string', description: 'Id ramki na Tablicy.' } },
        required: ['frameId'],
      },
    },
    source:
      'src/components/MyWork/whiteboard/useWhiteboardNodes.ts deleteFrame (nowa funkcja, WB-FRAME-01) + IdeaCanvasContextMenu.tsx registryFrameItems',
  },
  {
    id: 'idea.frame.delete_release',
    label: { pl: 'Usuń ramkę, zwolnij zawartość', en: 'Delete frame, release contents' },
    icon: 'PackageOpen',
    scope: 'lane_frame',
    tools: ['whiteboard'],
    surfaces: ['context'],
    handler: (ctx) => runFrameParamCallback('idea.frame.delete_release', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'deleteFrame(frameId,true) → pushSnapshot() w useWhiteboardNodes.ts (WB-FRAME-01).',
    },
    // Sama ramka znika trwale (poza cofnięciem Ctrl+Z) — ta sama konwencja co
    // `idea.node.delete`/`idea.lane.pf_delete` (usunięcie WĘZŁA, niezależnie
    // od tego, co dzieje się z jego zawartością). Zawartość PRZETRWA
    // (konwertowana z powrotem na pozycję bezwzględną), stąd osobny wpis od
    // `idea.frame.delete_with_contents` — to jawny wybór z §Delete, nie
    // domyślne "Usuń".
    destructive: true,
    teresa: {
      description:
        'Usuwa wskazaną ramkę, ale ZWALNIA jej zawartość zamiast ją kasować — elementy zostają na Tablicy, przeliczone z powrotem na pozycję bezwzględną tak, by wizualnie nie „skoczyły". Podaj `frameId`.',
      parameters: {
        type: 'object',
        properties: { frameId: { type: 'string', description: 'Id ramki na Tablicy.' } },
        required: ['frameId'],
      },
    },
    source:
      'src/components/MyWork/whiteboard/useWhiteboardNodes.ts deleteFrame (nowa funkcja, WB-FRAME-01) + IdeaCanvasContextMenu.tsx registryFrameItems',
  },
  {
    id: 'idea.node.remove_from_frame',
    label: { pl: 'Usuń z ramki', en: 'Remove from frame' },
    icon: 'FolderOutput',
    scope: 'single_item',
    tools: ['whiteboard'],
    surfaces: ['context'],
    handler: (ctx) => runFrameNodeParamCallback(ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'removeFromFrame() → pushSnapshot() w useWhiteboardNodes.ts (WB-FRAME-01).',
    },
    teresa: {
      description:
        'Zwalnia wskazany element z jego ramki (element zostaje na Tablicy, poza kontenerem, przeliczony z powrotem na pozycję bezwzględną). Pokazuje się WYŁĄCZNIE w menu elementu, który już należy do jakiejś ramki. Podaj `nodeId`.',
      parameters: {
        type: 'object',
        properties: { nodeId: { type: 'string', description: 'Id elementu na Tablicy.' } },
        required: ['nodeId'],
      },
    },
    source:
      'src/components/MyWork/whiteboard/useWhiteboardNodes.ts removeFromFrame (nowa funkcja, WB-FRAME-01) + IdeaCanvasContextMenu.tsx registryChildFrameItems',
  },
];
