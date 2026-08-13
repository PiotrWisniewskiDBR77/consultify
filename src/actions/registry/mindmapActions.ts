/**
 * Akcje rejestru Idea Workspace — domena: mindmap.
 *
 * Wydzielone z `src/actions/ideaActionRegistry.ts` (QG-01, 2026-08-10),
 * verbatim (identyczne id/label/scope/surfaces/handler/mutates/undo/teresa),
 * tylko fizycznie przeniesione. SSOT formatu i reguł: nagłówek
 * `src/actions/ideaActionRegistry.ts` + `docs/standards/idea-workspace/02_REJESTR_AKCJI.md`.
 */

import type { ActionDef } from './types';
import {
  RUNTIME_AI_AUTO_CONNECT,
  RUNTIME_AI_EXPAND,
  RUNTIME_AI_GAP_ANALYSIS,
  RUNTIME_AI_SUMMARIZE,
  RUNTIME_MM_NODE_ADD_CHILD,
  RUNTIME_MM_NODE_ADD_SIBLING,
  RUNTIME_MM_NODE_AI_SUGGEST_LINKS,
  RUNTIME_MM_NODE_AI_SUMMARIZE_BRANCH,
  RUNTIME_MM_NODE_AI_WHAT_IF,
  RUNTIME_MM_NODE_CONNECT,
  RUNTIME_MM_NODE_CONVERT_BRANCH,
  RUNTIME_MM_NODE_CONVERT_SINGLE,
  RUNTIME_MM_NODE_DELETE,
  RUNTIME_MM_NODE_DETACH_BRANCH,
  RUNTIME_MM_NODE_DUPLICATE,
  RUNTIME_MM_NODE_DUPLICATE_BRANCH,
  RUNTIME_MM_NODE_TOGGLE_COLLAPSE,
  RUNTIME_MM_SET_STRUCTURE,
  RUNTIME_PANE_ADD_ROOT,
  RUNTIME_PANE_AI_SUGGEST,
  RUNTIME_PANE_AUTO_CLUSTER,
  RUNTIME_PANE_COLLAPSE_ALL,
  RUNTIME_PANE_EXPAND_ALL,
  RUNTIME_PANE_FIT_VIEW,
  RUNTIME_PANE_FOLD_1,
  RUNTIME_PANE_FOLD_2,
  RUNTIME_PANE_SELECT_ALL,
  runByTool,
  runEdgeParamCallback,
  runKeyboardOnlyCallback,
  runMindmapAiSuggestionApplyUiOnlyCallback,
  runMindmapAttachKnowledgeCallback,
  runMindmapNodeBusAction,
  runMindmapNodeConvertAction,
  runMindmapNodeUiOnlyCallback,
  runMindmapPaneUiOnlyCallback,
  runNodeEditLabelCallback,
  runToolbarBusAction,
  runWbOpenDetailCallback,
} from './runtimeHelpers';
import { Api } from '@/services/api';

export const MINDMAP_ACTIONS: ActionDef[] = [
  {
    id: 'idea.ai.expand_map',
    label: {
      pl: 'AI: rozwiń mapę',
      en: 'AI: expand map',
    },
    icon: 'Sparkles',
    scope: 'workspace',
    tools: ['mindmap'],
    surfaces: ['menu3', 'rail', 'panel'],
    // Krok B: `ctx.params.nodeId` idzie na szynę jako `extra`, zgodnie z
    // deklaracją `teresa.parameters` niżej. ŚWIADOME OGRANICZENIE: runtime
    // string tej akcji to `mm_ai_expand` (patrz RUNTIME_AI_EXPAND), a
    // useMindMapQuickActions.ts obsługuje `mm_ai_expand` wołaniem
    // `handlers.handleAIExpand()` BEZ argumentu — `detail.nodeId` dociera na
    // szynę, ale nie ma dziś odbiornika dla TEGO runtime stringa (istnieje
    // osobny `mm_ai_expand_node`, który go czyta, ale rejestr go nie używa).
    // Zmiana routingu między `mm_ai_expand`/`mm_ai_expand_node` wykracza poza
    // zakres Kroku B — zostawiono jako znany dług, nie naprawiane tutaj.
    handler: (ctx) => runByTool('idea.ai.expand_map', RUNTIME_AI_EXPAND, ctx, ctx.params),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'proposal',
      evidence:
        'POST /my-ideas/:id/map/expand → AIProposalDiffModal (checkbox per węzeł, Apply/Reject)',
    },
    teresa: {
      description:
        'Dopisuje do Mapy myśli nowe gałęzie zaproponowane przez AI. Zawsze pokazuje podgląd — nic nie wchodzi bez Twojej akceptacji.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: {
            type: 'string',
            description: 'Węzeł, od którego rozwijamy (pusty = od korzenia lub zaznaczenia).',
          },
        },
      },
    },
    runtime: RUNTIME_AI_EXPAND,
    source: 'src/components/MyWork/mindmap/useMindMapQuickActions.ts:761',
  },
  {
    id: 'idea.ai.summarize_map',
    label: {
      pl: 'AI: podsumuj mapę',
      en: 'AI: summarize map',
    },
    icon: 'Wand2',
    scope: 'workspace',
    tools: ['mindmap'],
    surfaces: ['rail', 'panel'],
    handler: (ctx) => runByTool('idea.ai.summarize_map', RUNTIME_AI_SUMMARIZE, ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Streszcza zawartość Mapy myśli w czacie. Nie zmienia mapy — dostajesz opis tego, co już na niej jest.',
    },
    runtime: RUNTIME_AI_SUMMARIZE,
    source: 'src/components/MyWork/mindmap/useMindMapQuickActions.ts:931 (delegacja do czatu)',
  },
  {
    id: 'idea.ai.gap_analysis',
    label: {
      pl: 'AI: analiza luk',
      en: 'AI: gap analysis',
    },
    icon: 'Search',
    scope: 'workspace',
    tools: ['mindmap'],
    surfaces: ['rail'],
    handler: (ctx) => runToolbarBusAction('idea.ai.gap_analysis', RUNTIME_AI_GAP_ANALYSIS, ctx),
    // Odbiornik NIE dotyka `nodes`/`edges` — składa listę do 20 etykiet i woła
    // `onOpenChat(prompt)`. Zero mutacji, więc zero `undo` (R4 spełnione).
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Otwiera czat z gotowym pytaniem o luki w otwartej Mapie myśli (czego na niej brakuje). NIE analizuje sama i NIE dopisuje nic do mapy — to przygotowana prośba do rozmowy, odpowiedź trzeba dopiero wykorzystać ręcznie.',
    },
    runtime: RUNTIME_AI_GAP_ANALYSIS,
    source:
      'src/components/MyWork/mindmap/toolbar-popovers/AIActionsPopover.tsx GENERAL_GENERATORS (mm_ai_gap_analysis) → useMindMapQuickActions.ts:883 · rail wiring 2026-08-10 (tier B)',
  },
  {
    id: 'idea.ai.auto_connect',
    label: {
      pl: 'AI: powiązania między gałęziami',
      en: 'AI: auto cross-links',
    },
    icon: 'Target',
    scope: 'workspace',
    tools: ['mindmap'],
    surfaces: ['rail'],
    handler: (ctx) => runToolbarBusAction('idea.ai.auto_connect', RUNTIME_AI_AUTO_CONNECT, ctx),
    // ROZJAZD ETYKIETA↔KOD, udokumentowany zamiast po cichu poprawiony (rail
    // tier B, 2026-08-10): pozycja w popoverze nazywa się „Auto cross-links" /
    // „Auto cross-links", co brzmi jak automatyczne wstawienie krawędzi-relacji.
    // `useMindMapQuickActions.ts:1057` NIE tworzy ŻADNEJ krawędzi — cała gałąź
    // to `onOpenChat(promptAutoConnect)`. Stąd `mutates: false`: deklaracja
    // opisuje KOD, nie etykietę. Naprawa samej etykiety leży poza tym wiringiem
    // (zmieniłaby widoczne zachowanie/treść UI) — zgłoszona osobno.
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Otwiera czat z gotowym pytaniem o możliwe powiązania między gałęziami otwartej Mapy myśli. UWAGA — wbrew nazwie NIE tworzy żadnych połączeń na mapie: dostajesz propozycje w rozmowie i nanosisz je sam. Jeśli użytkownik prosi o automatyczne połączenie węzłów, powiedz to wprost zamiast obiecywać wykonanie.',
    },
    runtime: RUNTIME_AI_AUTO_CONNECT,
    source:
      'src/components/MyWork/mindmap/toolbar-popovers/AIActionsPopover.tsx GENERAL_GENERATORS (mm_ai_auto_connect) → useMindMapQuickActions.ts:1057 · rail wiring 2026-08-10 (tier B)',
  },
  {
    // Closure (2026-08-10) 04_ACTION_COVERAGE_INVENTORY.csv class-d — GAP-3
    // „Map structure type" (source comments IdeaRecommendationMap.tsx ~L2883/
    // ~L6870). UCZCIWOŚĆ (rozdz. 10 §1 reguła rozstrzygająca): to NIE jest
    // Eksport ani Konwersja — nie tworzy pliku, nie tworzy trwałego rekordu
    // poza Ideą, tylko przekłada graf na inny układ (mindmap/org_chart/
    // tree_right/fishbone/timeline/semantic) WEWNĄTRZ tej samej Idei. Siostra
    // `idea.view.auto_layout` (bezpośrednio nad tym wpisem) jest dokładnie tej
    // samej klasy — stąd ten sam namespace `idea.view.*`, nie `idea.export.*`/
    // `idea.template.*`, mimo że zadanie zbiorcze grupowało ten wiersz razem
    // z eksportem/szablonami.
    id: 'idea.view.mm_structure_type',
    label: { pl: 'Typ struktury mapy', en: 'Map structure type' },
    icon: 'Shapes',
    scope: 'current_view',
    tools: ['mindmap'],
    surfaces: ['toolbar', 'panel'],
    handler: (ctx) => {
      const structureType =
        typeof ctx.params?.structureType === 'string' ? ctx.params.structureType : undefined;
      if (!structureType) {
        return Promise.resolve({
          ok: false,
          actionId: 'idea.view.mm_structure_type',
          message: 'Nie wiem, jaki typ struktury zastosować — podaj `structureType`.',
        });
      }
      return runByTool('idea.view.mm_structure_type', RUNTIME_MM_SET_STRUCTURE, ctx, {
        structureType,
      });
    },
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'IdeaRecommendationMap.tsx pushUndo() (undoStackRef, 50-deep, Ctrl+Z) wołane PRZED setNodes w useMindMapQuickActions.ts mm_set_structure handlerze.',
    },
    teresa: {
      description:
        'Zmienia układ struktury Mapy myśli (mindmap/org_chart/tree_right/fishbone/timeline/semantic) — przekłada te same węzły na inny szkielet wizualny, nie zmienia treści węzłów.',
      parameters: {
        type: 'object',
        properties: {
          structureType: {
            type: 'string',
            enum: ['mindmap', 'org_chart', 'tree_right', 'fishbone', 'timeline', 'semantic'],
            description: 'Docelowy typ struktury.',
          },
        },
        required: ['structureType'],
      },
    },
    runtime: RUNTIME_MM_SET_STRUCTURE,
    source:
      'src/components/MyWork/mindmap/toolbar-popovers/StructurePickerPopover.tsx (klik człowieka) → IdeaRecommendationMap.tsx:6880 onSelect, przełączone na dispatch szyny `mm_set_structure` (2026-08-10) zamiast duplikowanej logiki lokalnej — jeden, realny mechanizm, ten sam co MindmapCommandPalette.tsx:330 i useMindMapQuickActions.ts ~L1296.',
  },
  {
    id: 'idea.edge.insert_node',
    label: { pl: 'Wstaw węzeł na połączeniu', en: 'Insert node on edge' },
    icon: 'Plus',
    scope: 'edge',
    tools: ['mindmap'],
    surfaces: ['context'],
    handler: (ctx) => runEdgeParamCallback('idea.edge.insert_node', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'useMindMapQuickActions.ts mm_edge_insert_node → handlers.pushUndo() przed setEdges/setNodes (stos Ctrl+Z) — logika przeniesiona 1:1 z IdeaRecommendationMap.tsx handleEdgeContextAction (dawne edge_insert_node), które też wołało pushUndo() przed mutacją.',
    },
    teresa: {
      description:
        'Dzieli wskazane połączenie relacji na Mapie myśli na dwa, wstawiając pusty węzeł pomiędzy jego końce. Działa TYLKO na krawędziach relacji (nie na strukturalnych krawędziach hierarchii) — na innych, tak jak dziś w menu prawego kliku, po cichu nic się nie stanie. Tablica NIE wspiera tej operacji (brak logiki rozcięcia krawędzi po jej stronie) — akcja tam nie istnieje.',
      parameters: {
        type: 'object',
        properties: {
          edgeId: {
            type: 'string',
            description: 'Id połączenia (krawędzi relacji) na Mapie myśli.',
          },
        },
        required: ['edgeId'],
      },
    },
    source: 'src/components/MyWork/mindmap/useMindMapQuickActions.ts mm_edge_insert_node',
  },
  {
    id: 'idea.edge.edit_relation',
    label: { pl: 'Edytuj relację', en: 'Edit relation' },
    icon: 'Edit3',
    scope: 'edge',
    tools: ['mindmap'],
    surfaces: ['context'],
    handler: (ctx) => runEdgeParamCallback('idea.edge.edit_relation', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'useMindMapQuickActions.ts mm_edge_edit_relation → handlers.pushUndo() przed setEdges — DOPISANE 2026-08-09 (poprzednio, IdeaRecommendationMap.tsx handleEdgeContextAction/edge_edit_relation, brak Ctrl+Z, tak jak edit_label).',
    },
    teresa: {
      description:
        'Ustawia typ semantycznej relacji wskazanego połączenia na Mapie myśli: related/depends_on/blocks/supports/contradicts (wartość zapisuje się też jako etykieta linii). Działa TYLKO na krawędziach relacji — na strukturalnych po cichu nic się nie stanie, jak dziś. Tablica nie ma pojęcia relacji — akcja tam nie istnieje.',
      parameters: {
        type: 'object',
        properties: {
          edgeId: { type: 'string', description: 'Id połączenia (krawędzi relacji) na Mapie myśli.' },
          relation: {
            type: 'string',
            description: 'Typ relacji: related, depends_on, blocks, supports lub contradicts.',
          },
        },
        required: ['edgeId', 'relation'],
      },
    },
    source: 'src/components/MyWork/mindmap/useMindMapQuickActions.ts mm_edge_edit_relation',
  },
  {
    // N-inventory-c5 (2026-08-10). Inventory (04_ACTION_COVERAGE_INVENTORY.csv,
    // class c #5) proposed reusing `idea.node.mm_open_detail` — DECLINED,
    // wrong tool AND wrong mechanism: `mm_open_detail` is `tools: ['mindmap']`
    // only and calls `setDrawerNodeId` inside `IdeaRecommendationMap.tsx`
    // (mindmap's OWN drawer state). `CommentPinBadge` lives in
    // `whiteboard/nodes/` (six whiteboard-only consumers: ShapeNode/ImageNode/
    // TextBlockNode/FrameNode/LinkNode/StickyNoteNode) and dispatches
    // `idea-node-open-detail`, whose only listener (`IdeaMapWorkspace.tsx`
    // handleOpenNodeDetail) is a COMPLETELY SEPARATE shell-level drawer, zero
    // shared code with the mindmap one — SAME class of mismatch this file
    // already documented for Process Flow "properties" declining the same
    // `mm_open_detail` (see comment "properties DEKLINOWANE od Mapy myśli
    // idea.node.mm_open_detail" above `idea.node.pf_properties`). Whiteboard's
    // own node double-click (`IdeaWhiteboardTool.tsx:4572`,
    // `onNodeDoubleClick={onNodeDetail}`) reaches the SAME shell drawer via a
    // direct prop call (not this event) and was already unregistered before
    // this wave — out of scope here, left untouched.
    id: 'idea.node.wb_open_detail',
    label: { pl: 'Otwórz szczegóły', en: 'Open details' },
    icon: 'ExternalLink',
    scope: 'single_item',
    tools: ['whiteboard'],
    surfaces: ['inline'],
    handler: (ctx) => runWbOpenDetailCallback(ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Otwiera panel szczegółów wskazanego elementu Tablicy (dymek liczby komentarzy w rogu karteczki/kształtu/obrazu/ramki/linku). Podaj `nodeId` elementu.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Id elementu na Tablicy.' },
        },
        required: ['nodeId'],
      },
    },
    source:
      'src/components/MyWork/whiteboard/nodes/CommentPinBadge.tsx onClick (~L39-42) → CustomEvent `idea-node-open-detail` → IdeaMapWorkspace.tsx:3008-3014 handleOpenNodeDetail',
  },
  {
    id: 'idea.view.add_root_topic',
    label: { pl: 'Dodaj temat (do korzenia)', en: 'Add topic (to root)' },
    icon: 'Plus',
    scope: 'current_view',
    tools: ['mindmap'],
    surfaces: ['context'],
    shortcut: 'N',
    handler: (ctx) => runToolbarBusAction('idea.view.add_root_topic', RUNTIME_PANE_ADD_ROOT, ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'klik: pushUndo() w IdeaRecommendationMap.handlePaneContextAction (pane_add_node); Teresa: pushUndo() w useMindMapNodes.tsx addRootTopic (mm_add_root)',
    },
    teresa: {
      description:
        'Dodaje nowy, pusty temat połączony z korzeniem Mapy myśli. Z czatu ląduje w stałym miejscu obok korzenia (nie w miejscu kliknięcia — Teresa nie zna pozycji kursora).',
    },
    runtime: RUNTIME_PANE_ADD_ROOT,
    source: 'src/components/MyWork/mindmap/PaneContextMenu.tsx:51 (pane_add_node)',
  },
  {
    id: 'idea.view.copy_selection',
    label: { pl: 'Kopiuj węzły', en: 'Copy nodes' },
    icon: 'ClipboardCopy',
    scope: 'selected_items',
    tools: ['mindmap'],
    surfaces: ['context'],
    shortcut: '⌘C',
    handler: (ctx) => runMindmapPaneUiOnlyCallback('idea.view.copy_selection', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Kopiuje zaznaczone węzły do schowka Mapy myśli. Dziś dostępne WYŁĄCZNIE z menu prawego kliku na tło — schowek jest stanem przeglądarki, Teresa tego jeszcze nie wywoła.',
    },
    source: 'src/components/MyWork/mindmap/PaneContextMenu.tsx:58 (pane_copy)',
  },
  {
    id: 'idea.view.cut_selection',
    label: { pl: 'Wytnij węzły', en: 'Cut nodes' },
    icon: 'Scissors',
    scope: 'selected_items',
    tools: ['mindmap'],
    surfaces: ['context'],
    shortcut: '⌘X',
    handler: (ctx) => runMindmapPaneUiOnlyCallback('idea.view.cut_selection', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'cutSelected() → pushUndo() w useMindMapNodes.tsx:1154',
    },
    teresa: {
      description:
        'Wycina zaznaczone węzły do schowka Mapy myśli (usuwa z płótna). Dziś dostępne WYŁĄCZNIE z menu prawego kliku na tło — schowek jest stanem przeglądarki, Teresa tego jeszcze nie wywoła.',
    },
    source: 'src/components/MyWork/mindmap/PaneContextMenu.tsx:65 (pane_cut)',
  },
  {
    id: 'idea.view.paste_at_point',
    label: { pl: 'Wklej węzły', en: 'Paste nodes' },
    icon: 'Clipboard',
    scope: 'current_view',
    tools: ['mindmap'],
    surfaces: ['context'],
    shortcut: '⌘V',
    handler: (ctx) => runMindmapPaneUiOnlyCallback('idea.view.paste_at_point', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'pasteNodes() → pushUndo() w useMindMapNodes.tsx:1219',
    },
    teresa: {
      description:
        'Wkleja zawartość schowka Mapy myśli w miejscu kliknięcia. Dziś dostępne WYŁĄCZNIE z menu prawego kliku na tło — schowek jest stanem przeglądarki, Teresa tego jeszcze nie wywoła.',
    },
    source: 'src/components/MyWork/mindmap/PaneContextMenu.tsx:72 (pane_paste)',
  },
  {
    id: 'idea.view.select_all',
    label: { pl: 'Zaznacz wszystko', en: 'Select all' },
    icon: 'Grid3X3',
    scope: 'current_view',
    tools: ['mindmap'],
    surfaces: ['context'],
    shortcut: '⌘A',
    handler: (ctx) => runToolbarBusAction('idea.view.select_all', RUNTIME_PANE_SELECT_ALL, ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description: 'Zaznacza wszystkie węzły na otwartej Mapie myśli.',
    },
    runtime: RUNTIME_PANE_SELECT_ALL,
    source: 'src/components/MyWork/mindmap/PaneContextMenu.tsx:80 (pane_select_all)',
  },
  {
    id: 'idea.view.fit_view',
    label: { pl: 'Dopasuj widok', en: 'Fit view' },
    icon: 'Maximize',
    scope: 'current_view',
    tools: ['mindmap'],
    surfaces: ['context'],
    shortcut: '⌘0',
    handler: (ctx) => runToolbarBusAction('idea.view.fit_view', RUNTIME_PANE_FIT_VIEW, ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description: 'Dopasowuje widok kamery tak, by cała Mapa myśli zmieściła się na ekranie.',
    },
    runtime: RUNTIME_PANE_FIT_VIEW,
    source: 'src/components/MyWork/mindmap/PaneContextMenu.tsx:86 (pane_fit_view)',
  },
  {
    id: 'idea.view.auto_cluster',
    label: { pl: 'Auto-grupowanie', en: 'Auto-cluster' },
    icon: 'Layers',
    scope: 'current_view',
    tools: ['mindmap'],
    surfaces: ['context'],
    handler: (ctx) => runToolbarBusAction('idea.view.auto_cluster', RUNTIME_PANE_AUTO_CLUSTER, ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'handlers.pushUndo() w useMindMapQuickActions.ts (blok mm_auto_cluster)',
    },
    teresa: {
      description:
        'Grupuje niepogrupowane węzły (bezpośrednio pod korzeniem) w tematyczne gałęzie na podstawie etykiet/tagów/typu semantycznego. Wymaga co najmniej dwóch niepogrupowanych węzłów.',
    },
    runtime: RUNTIME_PANE_AUTO_CLUSTER,
    source: 'src/components/MyWork/mindmap/PaneContextMenu.tsx:98 (pane_auto_cluster)',
  },
  {
    id: 'idea.view.collapse_all',
    label: { pl: 'Zwiń wszystko', en: 'Collapse all' },
    icon: 'ChevronDown',
    scope: 'current_view',
    tools: ['mindmap'],
    surfaces: ['context'],
    shortcut: 'Alt+0',
    handler: (ctx) => runToolbarBusAction('idea.view.collapse_all', RUNTIME_PANE_COLLAPSE_ALL, ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description: 'Zwija wszystkie gałęzie Mapy myśli do samego korzenia (poziom 0).',
    },
    runtime: RUNTIME_PANE_COLLAPSE_ALL,
    source: 'src/components/MyWork/mindmap/PaneContextMenu.tsx:106 (pane_collapse_all)',
  },
  {
    id: 'idea.view.fold_level_1',
    label: { pl: 'Pokaż poziom 1', en: 'Show level 1' },
    icon: 'ChevronDown',
    scope: 'current_view',
    tools: ['mindmap'],
    surfaces: ['context'],
    shortcut: 'Alt+1',
    handler: (ctx) => runToolbarBusAction('idea.view.fold_level_1', RUNTIME_PANE_FOLD_1, ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description: 'Zwija Mapę myśli tak, by widoczny był tylko pierwszy poziom gałęzi.',
    },
    runtime: RUNTIME_PANE_FOLD_1,
    source: 'src/components/MyWork/mindmap/PaneContextMenu.tsx:112 (pane_fold_1)',
  },
  {
    id: 'idea.view.fold_level_2',
    label: { pl: 'Pokaż poziom 2', en: 'Show level 2' },
    icon: 'ChevronDown',
    scope: 'current_view',
    tools: ['mindmap'],
    surfaces: ['context'],
    shortcut: 'Alt+2',
    handler: (ctx) => runToolbarBusAction('idea.view.fold_level_2', RUNTIME_PANE_FOLD_2, ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description: 'Zwija Mapę myśli tak, by widoczne były dwa pierwsze poziomy gałęzi.',
    },
    runtime: RUNTIME_PANE_FOLD_2,
    source: 'src/components/MyWork/mindmap/PaneContextMenu.tsx:118 (pane_fold_2)',
  },
  {
    id: 'idea.view.expand_all',
    label: { pl: 'Rozwiń wszystko', en: 'Expand all' },
    icon: 'ChevronDown',
    scope: 'current_view',
    tools: ['mindmap'],
    surfaces: ['context'],
    shortcut: 'Alt+9',
    handler: (ctx) => runToolbarBusAction('idea.view.expand_all', RUNTIME_PANE_EXPAND_ALL, ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description: 'Rozwija wszystkie zwinięte gałęzie Mapy myśli.',
    },
    runtime: RUNTIME_PANE_EXPAND_ALL,
    source: 'src/components/MyWork/mindmap/PaneContextMenu.tsx:124 (pane_expand_all)',
  },
  {
    id: 'idea.ai.suggest_nodes',
    label: { pl: 'AI: Zasugeruj węzły', en: 'AI: Suggest nodes' },
    icon: 'Sparkles',
    scope: 'current_view',
    tools: ['mindmap'],
    // Rail tier B (2026-08-10) — REUŻYCIE, nie nowe id. Popover AI lewego raila
    // („Suggest branches", `AIActionsPopover.tsx` GENERAL_GENERATORS) wysyła
    // DOKŁADNIE ten sam runtime string co pozycja menu tła (`mm_ai_suggest`,
    // RUNTIME_PANE_AI_SUGGEST) i trafia w TEN SAM odbiornik
    // (`useMindMapQuickActions.ts:875`) — dopasowanie po MECHANIZMIE, nie po
    // etykiecie. Rozszerzenie `surfaces` wystarcza; handler/runtime bez zmian.
    surfaces: ['context', 'rail'],
    handler: (ctx) => runToolbarBusAction('idea.ai.suggest_nodes', RUNTIME_PANE_AI_SUGGEST, ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Otwiera czat z gotowym promptem proszącym AI o propozycje nowych gałęzi dla otwartej Mapy myśli. Nie zmienia mapy samo z siebie — to prośba o sugestię, nie wykonanie.',
    },
    runtime: RUNTIME_PANE_AI_SUGGEST,
    source: 'src/components/MyWork/mindmap/PaneContextMenu.tsx:131 (pane_ai_suggest)',
  },
  {
    id: 'idea.node.mm_edit',
    label: { pl: 'Edytuj', en: 'Edit' },
    icon: 'Edit3',
    scope: 'single_item',
    tools: ['mindmap'],
    // Dual-surface (2026-08-09): `FloatingNodeToolbar.tsx:302` ma `onClick`
    // wołający `onAction('ctx_edit')` — DOKŁADNIE ten sam lokalny id co
    // `NodeContextMenu.tsx`. ZASTRZEŻENIE odkryte przy tym wpisie, NIE
    // naprawione tutaj (poza zakresem — dotknięcie renderowania/dispatchu
    // 742-liniowego `FloatingNodeToolbar.tsx` to osobna fala): ten `onClick`
    // NIE woła `handleContextAction` — ma WŁASNY `onAction` prop
    // (`IdeaRecommendationMap.tsx:5649-5668`), który dla nierozpoznanych
    // lokalnych id-ków (w tym `ctx_edit`) po prostu odpala surowy
    // `window.dispatchEvent(...'idea-workspace-quick-action'..., {action:
    // 'ctx_edit', nodeId})` — string `'ctx_edit'` NIE MA odbiornika w
    // `useMindMapQuickActions.ts` (zweryfikowane grepem), więc przycisk
    // „Edytuj" na pływającym pasku jest DZIŚ MARTWY. Deklarujemy `'floating'`
    // w `surfaces` tylko jako uczciwe zadeklarowanie WŁAŚCICIELSTWA tej samej
    // akcji na tej powierzchni (dla przyszłego podłączenia) — samo dodanie
    // tego pola NIE naprawia klika (toolbar nie czyta jeszcze z rejestru).
    surfaces: ['context', 'floating'],
    shortcut: 'F2',
    // NIE reużyto `idea.node.edit` (Tablica): tam „Edytuj" = prompt() +
    // bezpośredni dispatch nowej `label` (`runNodeEditLabelCallback`,
    // realna mutacja treści). Tu „Edytuj" WYŁĄCZNIE przełącza tryb edycji
    // inline węzła (`_startEditing` na `data`, `startEditingSelected` w
    // `useMindMapNodes.tsx:964`) — sama treść zmienia się DOPIERO gdy
    // użytkownik wpisze tekst i odejdzie z pola (osobny mechanizm,
    // `onLabelChange`, bez własnej pozycji menu). To różnica w RODZAJU
    // (przełącznik trybu UI vs mutacja danych), nie kosmetyczna — stąd osobne
    // id zamiast rozszerzania `tools` istniejącego wpisu.
    handler: (ctx) => runMindmapNodeUiOnlyCallback('idea.node.mm_edit', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Włącza tryb edycji etykiety wskazanego węzła Mapy myśli (kursor w polu tekstowym). Dziś dostępne WYŁĄCZNIE z menu prawego kliku/pływającego paska — sama zmiana treści i tak wymaga wpisania tekstu przez człowieka, więc nie ma dziś sensownego odpowiednika dla czatu.',
    },
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:91 (ctx_edit)',
  },
  {
    id: 'idea.node.mm_open_detail',
    label: { pl: 'Otwórz szczegóły', en: 'Open details' },
    icon: 'ExternalLink',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    // REUŻYWANY (N5 czwarta fala, 2026-08-09) także przez `ctx_quick_notes`
    // ("Notes") i `ctx_quick_tags` ("Tags") — SPRAWDZONE w
    // handleContextAction:4916-4918, nie spekulacja: obie pozycje wołają
    // DOSŁOWNIE `setDrawerNodeId(ctxNode.id)`, identycznie jak `ctx_open_detail`
    // — zero dedykowanego widoku notatek/tagów, zero parametru wskazującego
    // zakładkę. Trzy różne etykiety menu ("Open details"/"Notes"/"Tags"), JEDNA
    // faktyczna akcja — mylące wobec użytkownika (spodziewa się widoku notatek
    // lub tagów, dostaje ten sam generyczny panel szczegółów), udokumentowane
    // tu zamiast utrzymywane w trzech pozorowanych osobnych wpisach.
    handler: (ctx) => runMindmapNodeUiOnlyCallback('idea.node.mm_open_detail', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Otwiera panel szczegółów wskazanego węzła Mapy myśli. Stan lokalny UI (`setDrawerNodeId` w `IdeaRecommendationMap.tsx`), nieprzekazany do szyny — dziś dostępne WYŁĄCZNIE z menu prawego kliku. UWAGA: menu prawego kliku ma też pozycje "Notes" i "Tags" — obie wołają DOKŁADNIE tę samą akcję (ten sam kod, brak dedykowanego widoku notatek/tagów), więc odpowiadają na TO SAMO polecenie co "Open details".',
    },
    source:
      'src/components/MyWork/mindmap/NodeContextMenu.tsx:98 (ctx_open_detail) + :446 (ctx_quick_notes) + :452 (ctx_quick_tags) — wszystkie trzy handleContextAction:4874-4918',
  },
  {
    id: 'idea.node.mm_add_child',
    label: { pl: 'Dodaj dziecko', en: 'Add child' },
    icon: 'Plus',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    shortcut: 'Tab',
    // Rozważono reużycie `idea.element.add` (ten sam runtime string
    // `mm_add_child`, `surfaces` już zawiera `'context'`) — ODRZUCONE: jego
    // `handler` (`runByTool`) ZAWSZE dyspatchuje na szynę, nawet dla kliku
    // człowieka (ignoruje `ctx.params.run`), co złamałoby wymóg tej fali
    // („byte-identical human-click behavior" przez `ctx.params.run`). Nowy id
    // reużywa TEN SAM runtime string (`mm_add_child`) — zero nowej logiki po
    // stronie hooka, tylko druga, ostrożniejsza ścieżka wejścia.
    handler: (ctx) => runMindmapNodeBusAction('idea.node.mm_add_child', RUNTIME_MM_NODE_ADD_CHILD, ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'useMindMapNodes.tsx addChildNode:349 → pushUndo() (stos Ctrl+Z)',
    },
    teresa: {
      description:
        'Dodaje węzeł-dziecko do wskazanego węzła Mapy myśli. Podaj `nodeId` węzła-rodzica; bez niego trafi pod aktualnie zaznaczony/ostatnio aktywny węzeł. `label` opcjonalna treść nowego węzła.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Id węzła-rodzica.' },
          label: { type: 'string', description: 'Treść nowego węzła (opcjonalna).' },
        },
      },
    },
    runtime: RUNTIME_MM_NODE_ADD_CHILD,
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:104 (ctx_add_child)',
  },
  {
    id: 'idea.node.mm_add_sibling',
    label: { pl: 'Dodaj rodzeństwo', en: 'Add sibling' },
    icon: 'GitBranch',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    // POPRAWIONE (2026-08-10, reconciliacja skrótów): było 'Enter', przepisane
    // z etykiety-podpowiedzi wewnątrz `NodeContextMenu.tsx:248` (statyczny
    // tekst obok pozycji menu) — NIGDY nie zweryfikowane wobec realnego
    // globalnego listenera. `useKeyboardShortcuts.ts`'s `onAddSibling` odpala
    // WYŁĄCZNIE na `event.key === 'Enter' && event.shiftKey` — samo Enter jest
    // zajęte przez `onOpen`/`onAddSibling`-owo-inne skróty w innych ekranach
    // tego dzielonego hooka. Menu nadal POKAZUJE „Enter" (osobna, drobna
    // nieścisłość UI w `NodeContextMenu.tsx`, poza zakresem tego wpisu —
    // niedotknięta).
    shortcut: 'Shift+Enter',
    handler: (ctx) =>
      runMindmapNodeBusAction('idea.node.mm_add_sibling', RUNTIME_MM_NODE_ADD_SIBLING, ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'useMindMapNodes.tsx addSiblingNode:487 → pushUndo() (stos Ctrl+Z)',
    },
    teresa: {
      description:
        'Dodaje węzeł-rodzeństwo obok wskazanego węzła Mapy myśli (ten sam rodzic). Węzeł bez rodzica (korzeń) dostaje zamiast tego dziecko — uczciwy fallback, nie cichy błąd. Podaj `nodeId` węzła kotwicy.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Id węzła, obok którego dodać rodzeństwo.' },
        },
      },
    },
    runtime: RUNTIME_MM_NODE_ADD_SIBLING,
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:111 (ctx_add_sibling)',
  },
  {
    id: 'idea.node.mm_duplicate',
    label: { pl: 'Duplikuj', en: 'Duplicate' },
    icon: 'Copy',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    shortcut: '⌘D',
    // NIE reużyto `idea.node.duplicate` (Tablica, scope `selected_items`,
    // runtime `wb_duplicate`): Mapa myśli duplikuje DOKŁADNIE jeden węzeł
    // zakotwiczony pod jego rodzicem (`duplicateSelected` w
    // `useMindMapNodes.tsx:724` — cicho no-opuje bez rodzica, tzn. dla
    // korzenia/gałęzi startowej), podczas gdy Tablica duplikuje płaski zbiór
    // zaznaczonych kształtów bez pojęcia rodzica. Różny zakres (`single_item`
    // vs `selected_items`) I różny odbiornik (`mm_duplicate` vs
    // `wb_duplicate`) — nie kosmetyka, osobne id.
    handler: (ctx) => runMindmapNodeBusAction('idea.node.mm_duplicate', RUNTIME_MM_NODE_DUPLICATE, ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'useMindMapNodes.tsx duplicateSelected:724 → pushUndo() (stos Ctrl+Z)',
    },
    teresa: {
      description:
        'Duplikuje węzeł. UWAGA: działa na to, co jest DZIŚ zaznaczone na płótnie w przeglądarce użytkownika (ta sama funkcja co przycisk „Duplikuj") — nie przyjmuje `nodeId`, więc bez wcześniejszego zaznaczenia przez użytkownika nie ma czego duplikować (ta sama uczciwa granica co `idea.node.duplicate` na Tablicy).',
    },
    runtime: RUNTIME_MM_NODE_DUPLICATE,
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:118 (ctx_duplicate)',
  },
  {
    id: 'idea.node.mm_copy',
    label: { pl: 'Kopiuj', en: 'Copy' },
    icon: 'ClipboardCopy',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    shortcut: '⌘C',
    // NIE reużyto `idea.node.copy` (Tablica): implementacje schowka są
    // CAŁKOWICIE niezależne (Mapa: `_clipboard` — closure w
    // `useMindMapNodes.tsx` serializująca podgraf węzeł+krawędzie; Tablica
    // (od naprawy WB-CLIPBOARD-01, 2026-08-10): `clipboardRef` w
    // `whiteboard/useWhiteboardNodes.ts`, ten sam RODZAJ mechanizmu, ale
    // osobny hook/ref). Zero wspólnego runtime, oba już UI-only — konflacja
    // id-ków nic by nie dała, tylko zmyliła który mechanizm faktycznie działa.
    handler: (ctx) => runMindmapNodeUiOnlyCallback('idea.node.mm_copy', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Kopiuje węzeł (i jego wewnętrzne krawędzie) do schowka Mapy myśli. Schowek to zmienna w przeglądarce (`useMindMapNodes.tsx`), nieprzekazana do szyny — dziś dostępne WYŁĄCZNIE z menu prawego kliku.',
    },
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:125 (ctx_copy_nodes)',
  },
  {
    id: 'idea.node.mm_cut',
    label: { pl: 'Wytnij', en: 'Cut' },
    icon: 'Scissors',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    shortcut: '⌘X',
    handler: (ctx) => runMindmapNodeUiOnlyCallback('idea.node.mm_cut', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Wycina węzeł (kopiuje do schowka Mapy myśli i usuwa z płótna). Ten sam schowek co „Kopiuj" — dziś dostępne WYŁĄCZNIE z menu prawego kliku.',
    },
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:132 (ctx_cut_nodes)',
  },
  {
    id: 'idea.node.mm_paste',
    label: { pl: 'Wklej', en: 'Paste' },
    icon: 'Clipboard',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    shortcut: '⌘V',
    handler: (ctx) => runMindmapNodeUiOnlyCallback('idea.node.mm_paste', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'useMindMapNodes.tsx pasteNodes:1219 → pushUndo() (stos Ctrl+Z)',
    },
    teresa: {
      description:
        'Wkleja zawartość schowka Mapy myśli w miejscu wskazanego węzła. Ten sam schowek co „Kopiuj"/„Wytnij" — dziś dostępne WYŁĄCZNIE z menu prawego kliku.',
    },
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:139 (ctx_paste_nodes)',
  },
  {
    id: 'idea.node.mm_toggle_collapse',
    label: { pl: 'Zwiń / rozwiń', en: 'Fold / unfold' },
    icon: 'FoldVertical',
    scope: 'single_item',
    tools: ['mindmap'],
    // Dual-surface (2026-08-09): `FloatingNodeToolbar.tsx:314` ma `onClick`
    // wołający `onAction('mm_toggle_collapse')` — TEN SAM string co runtime
    // tej akcji (nie lokalny `ctx_*` id, ale identyczny efekt). W
    // przeciwieństwie do `ctx_edit` (patrz `idea.node.mm_edit` wyżej), ten
    // klik DZIAŁA dziś (odbiornik istnieje) — po tym wpisie działa PRECYZYJNIEJ:
    // `useMindMapQuickActions.ts`'s `mm_toggle_collapse` odbiornik ignorował
    // `detail.nodeId` na rzecz `getSelectedNode()` (poprawione tą samą zmianą,
    // patrz komentarz w hooku) — pływający pasek zyskuje to poprawnie
    // wycelowane zachowanie za darmo, bez zmiany w `FloatingNodeToolbar.tsx`.
    surfaces: ['context', 'floating'],
    shortcut: 'Space',
    handler: (ctx) =>
      runMindmapNodeBusAction('idea.node.mm_toggle_collapse', RUNTIME_MM_NODE_TOGGLE_COLLAPSE, ctx),
    // Stan widoku (zwinięcie gałęzi), nie treść Idei — ta sama konwencja co
    // `idea.view.collapse_all`/`fold_level_1`/`fold_level_2`/`expand_all`
    // (wszystkie `mutates: false` mimo wołania setNodes/setCollapsedNodeIds).
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Zwija albo rozwija (przełącznik) dzieci wskazanego węzła Mapy myśli. Podaj `nodeId` — bez niego działa na aktualnie zaznaczonym węźle.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Id węzła do zwinięcia/rozwinięcia.' },
        },
      },
    },
    runtime: RUNTIME_MM_NODE_TOGGLE_COLLAPSE,
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:152 (ctx_toggle_collapse)',
  },
  {
    // NOWY wpis (2026-08-10, reconciliacja skrótów) — `useKeyboardShortcuts.ts`'s
    // `onGroup` (Ctrl/Cmd+G) dispatchuje `handleQuickAction('group')`, string
    // BEZ żadnego menu/przycisku gdziekolwiek w kodzie (SPRAWDZONE grepem:
    // jedyny wywołujący 'group'/'mm_group' to ten jeden skrót) — `surfaces:
    // ['keyboard']`, patrz komentarz przy typie `Surface`. Realna mutacja:
    // owija ≥2 zaznaczone węzły w nową ramkę (`type: 'group'`), wymaga min. 2
    // zaznaczonych węzłów (inaczej toast, bez mutacji).
    id: 'idea.node.mm_group_selected',
    label: { pl: 'Grupuj zaznaczone', en: 'Group selected' },
    icon: 'Layers',
    scope: 'selected_items',
    tools: ['mindmap'],
    surfaces: ['keyboard'],
    shortcut: '⌘G',
    handler: (ctx) => runKeyboardOnlyCallback('idea.node.mm_group_selected', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'useMindMapQuickActions.ts:786 (blok "group"/"mm_group") → handlers.pushUndo()',
    },
    teresa: {
      description:
        'Owija co najmniej dwa zaznaczone węzły Mapy myśli we wspólną ramkę grupy. Dziś dostępne WYŁĄCZNIE ze skrótu klawiszowego — Teresa tego jeszcze nie wywoła; przy mniej niż 2 zaznaczonych węzłach po cichu nic nie robi (tylko komunikat toast), zachowanie identyczne jak przed tym wpisem.',
    },
    source:
      'src/components/MyWork/IdeaMapWorkspace.tsx onGroup → handleQuickAction(\'group\') + useMindMapQuickActions.ts:786',
  },
  {
    // NOWY wpis (2026-08-10, reconciliacja skrótów) — `useKeyboardShortcuts.ts`'s
    // `onReparentPromote` (Alt+Shift+←), tak samo bez menu/przycisku
    // gdziekolwiek (SPRAWDZONE grepem: jedyny caller `reparentSelectedPromote`
    // to ten skrót). Realna mutacja: przenosi zaznaczony węzeł pod dziadka
    // (`reparentNode` → `pushUndo()`), no-op gdy węzeł nie jest reparentowalny
    // (korzeń/branch/zablokowany) albo nie ma dziadka.
    id: 'idea.node.mm_reparent_promote',
    label: { pl: 'Przenieś wyżej w hierarchii', en: 'Promote one level' },
    icon: 'ChevronRight',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['keyboard'],
    shortcut: 'Alt+Shift+←',
    handler: (ctx) => runKeyboardOnlyCallback('idea.node.mm_reparent_promote', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'useMindMapNodes.tsx promoteNode → reparentNode:809 → pushUndo() (stos Ctrl+Z)',
    },
    teresa: {
      description:
        'Przenosi zaznaczony węzeł Mapy myśli o jeden poziom wyżej w hierarchii (pod dziadka). Dziś dostępne WYŁĄCZNIE ze skrótu klawiszowego — Teresa tego jeszcze nie wywoła. Bez zaznaczonego, reparentowalnego węzła (korzeń/gałąź/zablokowany/bez dziadka) po cichu nic nie robi — tak samo jak przed tym wpisem.',
    },
    source:
      'src/components/MyWork/IdeaMapWorkspace.tsx onReparentPromote → handleQuickAction(\'mm_reparent_promote\') + useMindMapQuickActions.ts:339 + useMindMapNodes.tsx reparentSelectedPromote',
  },
  {
    id: 'idea.node.mm_reparent_demote',
    label: { pl: 'Przenieś niżej w hierarchii', en: 'Demote under previous sibling' },
    icon: 'ChevronDown',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['keyboard'],
    shortcut: 'Alt+Shift+→',
    handler: (ctx) => runKeyboardOnlyCallback('idea.node.mm_reparent_demote', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'useMindMapNodes.tsx demoteNode → reparentNode:809 → pushUndo() (stos Ctrl+Z)',
    },
    teresa: {
      description:
        'Przenosi zaznaczony węzeł Mapy myśli pod poprzednie rodzeństwo (o jeden poziom niżej w hierarchii). Dziś dostępne WYŁĄCZNIE ze skrótu klawiszowego — Teresa tego jeszcze nie wywoła. Bez zaznaczonego, reparentowalnego węzła po cichu nic nie robi — tak samo jak przed tym wpisem.',
    },
    source:
      'src/components/MyWork/IdeaMapWorkspace.tsx onReparentDemote → handleQuickAction(\'mm_reparent_demote\') + useMindMapQuickActions.ts:340 + useMindMapNodes.tsx reparentSelectedDemote',
  },
  {
    id: 'idea.node.mm_focus_subtree',
    label: { pl: 'Skup na poddrzewie', en: 'Focus subtree' },
    icon: 'ScanSearch',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    // ZASTRZEŻENIE odkryte przy tym wpisie, NIE wprowadzone/naprawiane tutaj:
    // `ctx_focus_subtree` i `ctx_drill_down` (niżej) wołają DZIŚ DOKŁADNIE tę
    // samą funkcję (`handleDrillDown(ctxNode.id)`,
    // `IdeaRecommendationMap.tsx:4837-4840`) — mimo to zostają DWOMA osobnymi
    // wpisami rejestru, bo to dwie WIZUALNIE odrębne pozycje menu (różne
    // etykiety/ikony/miejsce w grupie) — Z1 rządzi reużyciem TEJ SAMEJ akcji
    // pod wieloma id-kami, nie zabrania dwóm różnym pozycjom menu współdzielić
    // dziś implementację (prawdziwe przed tym wpisem, nie ukryte).
    handler: (ctx) => runMindmapNodeUiOnlyCallback('idea.node.mm_focus_subtree', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Ustawia widok na poddrzewo wskazanego węzła (breadcrumb + dopasowanie kadru). Stan lokalny UI (`setDrillPath` w `IdeaRecommendationMap.tsx`), nieprzekazany do szyny — dziś dostępne WYŁĄCZNIE z menu prawego kliku.',
    },
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:159 (ctx_focus_subtree)',
  },
  {
    id: 'idea.node.mm_drill_down',
    label: { pl: 'Wejdź głębiej', en: 'Drill down' },
    icon: 'ChevronRight',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    handler: (ctx) => runMindmapNodeUiOnlyCallback('idea.node.mm_drill_down', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Wchodzi w poddrzewo wskazanego węzła jako nowy „katalog roboczy" (breadcrumb). Dziś identyczne wykonawczo z „Skup na poddrzewie" (patrz `idea.node.mm_focus_subtree`) — stan lokalny UI, dostępne WYŁĄCZNIE z menu prawego kliku.',
    },
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:165 (ctx_drill_down)',
  },
  {
    id: 'idea.node.mm_connect_to_selected',
    label: { pl: 'Połącz z zaznaczonym', en: 'Connect to selected' },
    icon: 'Link2',
    // `single_item`, NIE `selected_items`: akcja jest zakotwiczona na JEDNYM
    // węźle (tym, na którym otwarto menu) — drugi węzeł to PARAMETR
    // (`targetNodeId`), nie zestaw wielu zaznaczonych elementów w sensie, w
    // jakim `selected_items` jest używane gdzie indziej w tym rejestrze
    // (Tablica: „zrób coś z tym, co jest dziś zaznaczone").
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    handler: (ctx) =>
      runMindmapNodeBusAction('idea.node.mm_connect_to_selected', RUNTIME_MM_NODE_CONNECT, ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      // HONEST FIX (patrz komentarz w IdeaRecommendationMap.tsx przy
      // ctx_connect_to_selected i w useMindMapQuickActions.ts przy
      // mm_connect_nodes) — ta mutacja NIGDY nie wołała pushUndo() ani na
      // ścieżce kliku, ani teraz na nowej ścieżce Teresy; DOPISANE tym
      // wpisem w obu miejscach.
      evidence:
        'IdeaRecommendationMap.tsx ctx_connect_to_selected + useMindMapQuickActions.ts mm_connect_nodes → oba wołają teraz pushUndo() (dopisane tą zmianą)',
    },
    teresa: {
      description:
        'Łączy relacją ("related") wskazany węzeł z drugim węzłem Mapy myśli. Podaj `nodeId` węzła źródłowego i `targetNodeId` węzła docelowego — w przeciwieństwie do kliku człowieka (gdzie drugi węzeł to to, co było zaznaczone PRZED prawym kliknięciem), Teresa nie ma pojęcia "co było zaznaczone wcześniej", więc musi podać oba id-ki wprost.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Id węzła źródłowego.' },
          targetNodeId: { type: 'string', description: 'Id węzła docelowego.' },
        },
        required: ['nodeId', 'targetNodeId'],
      },
    },
    runtime: RUNTIME_MM_NODE_CONNECT,
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:171 (ctx_connect_to_selected)',
  },
  {
    id: 'idea.node.mm_detach_branch',
    label: { pl: 'Odłącz gałąź', en: 'Detach branch' },
    icon: 'Scissors',
    // Zakotwiczone na JEDNYM węźle (rozłącza TYLKO jego własną krawędź do
    // rodzica) — `single_item`, nie zestaw zaznaczeń.
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    handler: (ctx) =>
      runMindmapNodeBusAction('idea.node.mm_detach_branch', RUNTIME_MM_NODE_DETACH_BRANCH, ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'IdeaRecommendationMap.tsx detachBranch:4718 → pushUndo() (DOPISANE tym wpisem — funkcja istniała od V5-IDEA-17 bez wywołania pushUndo)',
    },
    teresa: {
      description:
        'Odłącza wskazany węzeł od jego rodzica (staje się węzłem najwyższego poziomu). Podaj `nodeId`.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Id węzła do odłączenia.' },
        },
        required: ['nodeId'],
      },
    },
    runtime: RUNTIME_MM_NODE_DETACH_BRANCH,
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:177 (ctx_detach_branch)',
  },
  {
    id: 'idea.node.mm_duplicate_branch',
    label: { pl: 'Duplikuj gałąź', en: 'Duplicate branch' },
    icon: 'Copy',
    // `single_item`, NIE `selected_items`: JEDNA kotwica + jej struktura
    // potomna — to nie jest wielokrotne zaznaczenie w sensie tego rejestru,
    // tylko efekt kaskadowy jednego celu (dokładnie rozważanie zasugerowane
    // w briefie tej fali: zamiast wymyślać nowe pojęcie `scope`, uczciwość
    // "duplikuje TEŻ poddrzewo" idzie do opisu Teresy, nie do `scope`).
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    handler: (ctx) =>
      runMindmapNodeBusAction('idea.node.mm_duplicate_branch', RUNTIME_MM_NODE_DUPLICATE_BRANCH, ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'IdeaRecommendationMap.tsx duplicateBranch:4736 → pushUndo() (DOPISANE tym wpisem — funkcja istniała od V5-IDEA-17 bez wywołania pushUndo)',
    },
    teresa: {
      description:
        'Duplikuje wskazany węzeł WRAZ Z CAŁYM PODDRZEWEM (wszystkimi węzłami potomnymi) Mapy myśli — nowa kopia zawiera każdy węzeł-potomek, nie tylko sam wskazany węzeł. Podaj `nodeId`.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Id węzła-kotwicy poddrzewa do duplikacji.' },
        },
        required: ['nodeId'],
      },
    },
    runtime: RUNTIME_MM_NODE_DUPLICATE_BRANCH,
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:183 (ctx_duplicate_branch)',
  },
  {
    id: 'idea.node.mm_convert_initiative',
    label: { pl: 'Konwertuj → Inicjatywa', en: 'Convert → Initiative' },
    icon: 'Rocket',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    handler: (ctx) =>
      runMindmapNodeConvertAction(
        'idea.node.mm_convert_initiative',
        'initiative',
        RUNTIME_MM_NODE_CONVERT_SINGLE,
        ctx,
        { cascades: false }
      ),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'manual_delete',
      evidence:
        'IdeaMapWorkspace.tsx handleConvert → Api.convertMyIdea → nowy rekord Initiative; brak automatycznego cofnięcia (ten sam wzorzec co idea.workspace.convert wyżej)',
    },
    teresa: {
      description:
        'Konwertuje WYŁĄCZNIE wskazany węzeł Mapy myśli (bez potomków) na Inicjatywę. Podaj `nodeId`. Tworzy nowy, trwały rekord w PMO, poprzedzony podglądem (mandatory preview, rozdz. 10 §2.2).',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Id węzła do konwersji (BEZ potomków).' },
        },
        required: ['nodeId'],
      },
      confirmBeforeRun: true,
    },
    runtime: RUNTIME_MM_NODE_CONVERT_SINGLE,
    source:
      "src/components/MyWork/mindmap/NodeContextMenu.tsx:314 (ctx_convert_initiative) + IdeaRecommendationMap.tsx convertSingleNode('initiative', ...)",
  },
  {
    id: 'idea.node.mm_convert_decision',
    label: { pl: 'Konwertuj → Decyzja', en: 'Convert → Decision' },
    icon: 'Star',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    handler: (ctx) =>
      runMindmapNodeConvertAction(
        'idea.node.mm_convert_decision',
        'decision',
        RUNTIME_MM_NODE_CONVERT_SINGLE,
        ctx,
        { cascades: false }
      ),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'manual_delete',
      evidence:
        'IdeaMapWorkspace.tsx handleConvert → Api.convertMyIdea → nowy rekord Decision; brak automatycznego cofnięcia',
    },
    teresa: {
      description:
        'Konwertuje WYŁĄCZNIE wskazany węzeł Mapy myśli (bez potomków) na artefakt Decyzji. Podaj `nodeId`.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Id węzła do konwersji (BEZ potomków).' },
        },
        required: ['nodeId'],
      },
      confirmBeforeRun: true,
    },
    runtime: RUNTIME_MM_NODE_CONVERT_SINGLE,
    source:
      "src/components/MyWork/mindmap/NodeContextMenu.tsx:320 (ctx_convert_decision) + IdeaRecommendationMap.tsx convertSingleNode('decision', ...)",
  },
  {
    id: 'idea.node.mm_convert_tasks',
    label: { pl: 'Konwertuj → Taski', en: 'Convert → Tasks' },
    icon: 'ListChecks',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    handler: (ctx) =>
      runMindmapNodeConvertAction(
        'idea.node.mm_convert_tasks',
        'task_set',
        RUNTIME_MM_NODE_CONVERT_SINGLE,
        ctx,
        { cascades: false }
      ),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'manual_delete',
      evidence:
        'IdeaMapWorkspace.tsx handleConvert → Api.convertMyIdea(target: task_set) → nowe zadania; brak automatycznego cofnięcia',
    },
    teresa: {
      description:
        'Konwertuje WYŁĄCZNIE wskazany węzeł Mapy myśli (bez potomków) na zestaw zadań (target `task_set` — nie istnieje osobny target „tasks"). Podaj `nodeId`.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Id węzła do konwersji (BEZ potomków).' },
        },
        required: ['nodeId'],
      },
      confirmBeforeRun: true,
    },
    runtime: RUNTIME_MM_NODE_CONVERT_SINGLE,
    source:
      "src/components/MyWork/mindmap/NodeContextMenu.tsx:326 (ctx_convert_tasks) + IdeaRecommendationMap.tsx convertSingleNode('task_set', ...)",
  },
  {
    id: 'idea.node.mm_convert_branch_decision',
    label: { pl: 'Konwertuj gałąź → Decyzja', en: 'Convert branch → Decision' },
    icon: 'Star',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context', 'floating'],
    handler: (ctx) =>
      runMindmapNodeConvertAction(
        'idea.node.mm_convert_branch_decision',
        'decision',
        RUNTIME_MM_NODE_CONVERT_BRANCH,
        ctx
      ),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'manual_delete',
      evidence:
        'IdeaMapWorkspace.tsx handleConvert → Api.convertMyIdea → nowy rekord Decision; brak automatycznego cofnięcia',
    },
    teresa: {
      description:
        'Konwertuje wskazany węzeł Mapy myśli WRAZ Z CAŁYM PODDRZEWEM na artefakt Decyzji. Podaj `nodeId` węzła-kotwicy gałęzi.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Id węzła-kotwicy gałęzi do konwersji.' },
        },
        required: ['nodeId'],
      },
      confirmBeforeRun: true,
    },
    runtime: RUNTIME_MM_NODE_CONVERT_BRANCH,
    source:
      'src/components/MyWork/mindmap/NodeContextMenu.tsx:340 (ctx_subtree_convert_decision) + FloatingNodeToolbar.tsx:563 + IdeaRecommendationMap.tsx:4982/5688 convertBranch(\'decision\', ...)',
  },
  {
    id: 'idea.node.mm_convert_branch_tasks',
    label: { pl: 'Konwertuj gałąź → Taski', en: 'Convert branch → Tasks' },
    icon: 'ListChecks',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context', 'floating'],
    handler: (ctx) =>
      runMindmapNodeConvertAction(
        'idea.node.mm_convert_branch_tasks',
        'task_set',
        RUNTIME_MM_NODE_CONVERT_BRANCH,
        ctx
      ),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'manual_delete',
      evidence:
        'IdeaMapWorkspace.tsx handleConvert → Api.convertMyIdea(target: task_set) → nowe zadania; brak automatycznego cofnięcia',
    },
    teresa: {
      description:
        'Konwertuje wskazany węzeł Mapy myśli WRAZ Z CAŁYM PODDRZEWEM na zestaw zadań. UWAGA (sprawdzone w kodzie): dziś IDENTYCZNA konwersja (target `task_set`) co „→ Task set (branch)" niżej — dwie różne pozycje menu, ten sam efekt, nie naprawiane tym wpisem. Podaj `nodeId` węzła-kotwicy gałęzi.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Id węzła-kotwicy gałęzi do konwersji.' },
        },
        required: ['nodeId'],
      },
      confirmBeforeRun: true,
    },
    runtime: RUNTIME_MM_NODE_CONVERT_BRANCH,
    source:
      'src/components/MyWork/mindmap/NodeContextMenu.tsx:346 (ctx_subtree_convert_tasks) + FloatingNodeToolbar.tsx:568 + IdeaRecommendationMap.tsx:4983/5689 convertBranch(\'task_set\', ...)',
  },
  {
    id: 'idea.node.mm_convert_branch_task_set',
    label: { pl: 'Konwertuj gałąź → Zestaw zadań', en: 'Convert branch → Task set' },
    icon: 'ListChecks',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context', 'floating'],
    handler: (ctx) =>
      runMindmapNodeConvertAction(
        'idea.node.mm_convert_branch_task_set',
        'task_set',
        RUNTIME_MM_NODE_CONVERT_BRANCH,
        ctx
      ),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'manual_delete',
      evidence:
        'IdeaMapWorkspace.tsx handleConvert → Api.convertMyIdea(target: task_set) → nowe zadania; brak automatycznego cofnięcia',
    },
    teresa: {
      description:
        'Konwertuje wskazany węzeł Mapy myśli WRAZ Z CAŁYM PODDRZEWEM na zestaw zadań. Ten sam target (`task_set`) co „→ Tasks (branch)" wyżej — osobny wpis, bo to wizualnie odrębna pozycja menu (Z1 nie zabrania dwóm pozycjom menu współdzielić dziś implementacji). Podaj `nodeId` węzła-kotwicy gałęzi.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Id węzła-kotwicy gałęzi do konwersji.' },
        },
        required: ['nodeId'],
      },
      confirmBeforeRun: true,
    },
    runtime: RUNTIME_MM_NODE_CONVERT_BRANCH,
    source:
      'src/components/MyWork/mindmap/NodeContextMenu.tsx:352 (ctx_subtree_convert_task_set) + FloatingNodeToolbar.tsx:573 + IdeaRecommendationMap.tsx:4984/5690 convertBranch(\'task_set\', ...)',
  },
  {
    id: 'idea.node.mm_convert_branch_initiative',
    label: { pl: 'Konwertuj gałąź → Inicjatywa', en: 'Convert branch → Initiative' },
    icon: 'Rocket',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context', 'floating'],
    handler: (ctx) =>
      runMindmapNodeConvertAction(
        'idea.node.mm_convert_branch_initiative',
        'initiative',
        RUNTIME_MM_NODE_CONVERT_BRANCH,
        ctx
      ),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'manual_delete',
      evidence:
        'IdeaMapWorkspace.tsx handleConvert → Api.convertMyIdea → nowy rekord Initiative; brak automatycznego cofnięcia',
    },
    teresa: {
      description:
        'Konwertuje wskazany węzeł Mapy myśli WRAZ Z CAŁYM PODDRZEWEM na Inicjatywę. Podaj `nodeId` węzła-kotwicy gałęzi.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Id węzła-kotwicy gałęzi do konwersji.' },
        },
        required: ['nodeId'],
      },
      confirmBeforeRun: true,
    },
    runtime: RUNTIME_MM_NODE_CONVERT_BRANCH,
    source:
      'src/components/MyWork/mindmap/NodeContextMenu.tsx:358 (ctx_subtree_convert_initiative) + FloatingNodeToolbar.tsx:578 + IdeaRecommendationMap.tsx:4985/5691 convertBranch(\'initiative\', ...)',
  },
  {
    id: 'idea.node.mm_convert_branch_process_flow',
    // E11 fix (2026-08-10): relabeled to match NodeContextMenu.tsx's
    // `generateFromBranchItems` — no "Convert"/"Konwertuj" wording, since this
    // is representation generation (chapter 10 §1), not artifact conversion.
    // `id` intentionally UNCHANGED (dual-surface FloatingNodeToolbar pairing +
    // existing test coverage key off it).
    label: {
      pl: 'Wygeneruj kroki Procesu z gałęzi',
      en: 'Generate Process Flow steps from branch',
    },
    icon: 'Workflow',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context', 'floating'],
    // UWAGA — SPRAWDZONE (`h2.3-mindmap-processflow-branch-conversion.test.ts`),
    // NIE spekulacja: `process_flow` idzie INNĄ ścieżką niż pozostałe 4
    // targety tej grupy — nie przez `Api.convertMyIdea` (dziś nawet nie jest
    // w `IDEA_CONVERT_TARGETS`), tylko przez `IdeaMapWorkspace.tsx`'s
    // `XFORM_MAP`/`transformSelection` (`convert_process_flow` + jawne
    // `nodeIds` łapane NA GÓRZE `handleQuickAction`, `IdeaMapWorkspace.tsx:888`)
    // — wstawia kroki do WŁASNEGO Procesu Idei, BEZ nowego rekordu w innym
    // module, BEZ `outputLinks`. Bliżej „Generowanie reprezentacji" (rozdz. 10
    // §1) niż „Konwersja do artefaktu", mimo etykiety menu — PRZEDISTNIEJĄCA
    // niezgodność, nie naprawiana tym wpisem (patrz komentarz nad
    // `runMindmapNodeConvertAction` dla pełnego dowodu).
    handler: (ctx) =>
      runMindmapNodeConvertAction(
        'idea.node.mm_convert_branch_process_flow',
        'process_flow',
        RUNTIME_MM_NODE_CONVERT_BRANCH,
        ctx
      ),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'manual_delete',
      evidence:
        'Mechanizm inny niż reszta grupy (patrz komentarz wyżej): IdeaMapWorkspace.tsx transformSelection → idea-workspace-insert wstawia kroki do Procesu TEJ SAMEJ Idei (nie nowy rekord w innym module) — czy odbiornik `idea-workspace-insert` po stronie Procesu woła pushUndo() NIE zweryfikowane w tym wpisie (poza zakresem — trzeci plik/inne narzędzie); manual_delete jest bezpiecznym dolnym ograniczeniem, nie potwierdzonym faktem',
    },
    teresa: {
      description:
        'Konwertuje wskazany węzeł Mapy myśli WRAZ Z CAŁYM PODDRZEWEM na kroki Procesu (Process Flow) TEJ SAMEJ Idei. UWAGA: w przeciwieństwie do „→ Inicjatywa/Decyzja/Taski (branch)" wyżej, to NIE tworzy nowego rekordu w innym module — to reprezentacja tej samej Idei, sprawdzone w kodzie (`IdeaMapWorkspace.tsx` `transformSelection`, nie `Api.convertMyIdea`). Podaj `nodeId` węzła-kotwicy gałęzi.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Id węzła-kotwicy gałęzi do konwersji.' },
        },
        required: ['nodeId'],
      },
      confirmBeforeRun: true,
    },
    runtime: RUNTIME_MM_NODE_CONVERT_BRANCH,
    source:
      'src/components/MyWork/mindmap/NodeContextMenu.tsx:364 (ctx_subtree_convert_process_flow) + FloatingNodeToolbar.tsx:583 + IdeaRecommendationMap.tsx:4986-4991/5694 convertBranch(\'process_flow\', ...)',
  },
  {
    id: 'idea.node.mm_ai_rewrite_node',
    label: { pl: 'AI: Przeredaguj ten węzeł', en: 'AI: Rewrite this node' },
    icon: 'Sparkles',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    // SPRAWDZONE PRZED wpisem (nie spekulacja): odbiornik
    // `IdeaMapWorkspace.tsx:2741` (`idea-mindmap-rewrite-node`) zbiera
    // instrukcję przez SYNCHRONICZNY `window.prompt()` (przeglądarkowy, blokujący
    // dialog), DOPIERO POTEM woła realny LLM (`Api.chatWithAIStream`) i buduje
    // proposal (`generatorType:'node_rewrite'`, `setProposalBatch`) —
    // proposal-first, zgodne z rozdz. 09 §3. Ale `window.prompt()` wymaga
    // CZŁOWIEKA przy klawiaturze przeglądarki — Teresa (wywołanie z czatu, bez
    // okna przeglądarki użytkownika) nie ma jak dostarczyć `instruction` do tego
    // dialogu. Świadomie UI-only: dispatch na szynę tylko przeniósłby ten sam
    // blokujący prompt, nie dając Teresie żadnej realnej ścieżki — to właśnie
    // ograniczenie, które rozdz. 09 §6 nazywa „prymitywny UX do poprawy",
    // udokumentowane tu, nie naprawione (poza zakresem tego wiringu).
    handler: (ctx) => runMindmapNodeUiOnlyCallback('idea.node.mm_ai_rewrite_node', ctx),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'proposal',
      evidence:
        'IdeaMapWorkspace.tsx:2764-2790 — Api.chatWithAIStream → setProposalBatch (generatorType: node_rewrite) → IdeaProposalReview; odrzucenie = zero zmian.',
    },
    teresa: {
      description:
        'Przeredagowuje etykietę wskazanego węzła Mapy myśli wg polecenia (realne AI, zawsze do akceptacji w podglądzie). DZIŚ NIEDOSTĘPNE dla Teresy: mechanizm zbiera polecenie przez natywny `window.prompt()` przeglądarki użytkownika (blokujący dialog) — nie ma parametru, którym Teresa mogłaby dostarczyć instrukcję z czatu. Dostępne WYŁĄCZNIE z menu prawego kliku na węzeł.',
    },
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:280 (ctx_ai_rewrite_node)',
  },
  {
    id: 'idea.node.mm_ai_expand_node',
    label: { pl: 'AI: Rozbuduj temat', en: 'Expand topic' },
    icon: 'Sparkles',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    // UCZCIWOŚĆ (rozdz. 09 §2, sprawdzone w handleContextAction:4885-4887, nie
    // spekulacja): „Expand topic" (`ctx_ai_expand`) i „Deepen" (`ctx_ai_deepen`)
    // są DWIEMA RÓŻNYMI etykietami menu, ale wołają DOKŁADNIE tę samą funkcję
    // — `handleAIExpand(ctxNode?.id)` — bez ŻADNEGO parametru różnicującego
    // "rozbuduj" od "pogłęb". Zero różnicy w backendowym wywołaniu
    // (`Api.expandMyIdeaMap`, ten sam `count:5`, ten sam `context`). To jest
    // ODWROTNOŚĆ zakazanego wzorca z rozdz. 09 §2 (tam: JEDNA etykieta ukrywa
    // różne efekty; tu: DWIE etykiety obiecują różny efekt, dostarczają
    // identyczny) — świadomie WSPÓLNY wpis rejestru dla obu lokalnych id
    // (patrz `REGISTRY_ID_BY_LOCAL_ID` w `NodeContextMenu.tsx`), zamiast dwóch
    // wpisów udających, że to różne akcje.
    //
    // TRZECIE wejście (2026-08-10, reconciliacja skrótów): `useKeyboardShortcuts.ts`'s
    // `onAIExpand` (Ctrl/Cmd+Shift+A) dispatchuje runtime string `mm_ai_expand_branch`
    // — INNY string niż `RUNTIME_AI_EXPAND` (`mm_ai_expand`) tej akcji, ale
    // SPRAWDZONE w `useMindMapQuickActions.ts:415`: oba stringi wołają
    // DOSŁOWNIE `handlers.handleAIExpand(targetNodeId)` — ten sam kod, ta sama
    // różnica "brak jawnego nodeId = bierz aktualne zaznaczenie" jak przy
    // klawiaturowym Tab/`mm_add_child` wyżej. Skrót jest więc genuine reuse tej
    // samej akcji, nie osobnym bytem — dopisany TYLKO jako `shortcut`, klik
    // klawiszowy nadal woła własny `handleQuickAction('mm_ai_expand_branch')`
    // przez `ctx.params.run` (patrz `runMindmapNodeBusAction` niżej), zero
    // zmiany runtime stringa faktycznie wysyłanego przez klawiaturę.
    shortcut: '⌘⇧A',
    handler: (ctx) =>
      runMindmapNodeBusAction('idea.node.mm_ai_expand_node', RUNTIME_AI_EXPAND, ctx),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'proposal',
      evidence:
        'IdeaRecommendationMap.tsx:4360-4442 handleAIExpand — Api.expandMyIdeaMap(proposeOnly:true) → setAiProposal + setShowAIModal(true); odrzucenie = zero zmian.',
    },
    teresa: {
      description:
        'Proponuje nowe węzły-potomki rozbudowujące wskazany węzeł Mapy myśli (realne AI, zawsze do akceptacji w podglądzie). UWAGA: w menu prawego kliku ta sama akcja jest wystawiona pod DWIEMA etykietami — „Expand topic" i „Deepen" — obie wołają identyczny kod, żadna nie "pogłębia" mocniej niż druga (sprawdzone w kodzie, nie w opisie). Podaj `nodeId` węzła-kotwicy.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Id węzła, który AI ma rozbudować.' },
        },
        required: ['nodeId'],
      },
    },
    runtime: RUNTIME_AI_EXPAND,
    source:
      'src/components/MyWork/mindmap/NodeContextMenu.tsx:286 (ctx_ai_expand) + :292 (ctx_ai_deepen) — oba handleContextAction:4885-4887',
  },
  {
    id: 'idea.node.mm_ai_what_if',
    label: { pl: 'AI: Co jeśli...?', en: 'What if...?' },
    icon: 'GitBranch',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    // UCZCIWOŚĆ (sprawdzone w AIWhatIfScenarios call site,
    // IdeaRecommendationMap.tsx:6143-6165, nie spekulacja): mimo że pozycja
    // wisi w menu KONKRETNEGO węzła, ANI klik człowieka, ANI ta akcja rejestru
    // nie przekazują `ctxNode` do modalu — modal sam bierze
    // `nodes.find(n => n.selected)`, z fallbackiem na `ideaTitle`/`'root'`.
    // Prawoklik na węzeł A, gdy zaznaczony jest węzeł B, wygeneruje scenariusze
    // dla B, nie A. Zasięg deklarowany jako `single_item` opisuje POZYCJĘ w
    // menu (kotwica intencji), nie faktyczny mechanizm — realnie działa jak
    // `selected_items`/`current_view`.
    handler: (ctx) =>
      runMindmapNodeBusAction('idea.node.mm_ai_what_if', RUNTIME_MM_NODE_AI_WHAT_IF, ctx),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'proposal',
      evidence:
        'AIWhatIfScenarios.tsx (Api.getMyIdeaAISuggestions) → onApplyScenario w IdeaRecommendationMap.tsx:6157-6165 → pushUndo() + idea-workspace-insert (per-scenariusz Apply, nieklikniete = brak zmian).',
    },
    teresa: {
      description:
        'Generuje scenariusze "co jeśli" (realne AI) dla aktualnie zaznaczonego węzła Mapy myśli — do przeglądu i ręcznego zastosowania per scenariusz. UWAGA: nie da się wskazać KONKRETNEGO węzła (ani z menu, ani z czatu) — działa zawsze na to, co jest DZIŚ zaznaczone w przeglądarce, z fallbackiem na tytuł Idei/korzeń mapy, gdy nic nie jest zaznaczone.',
    },
    runtime: RUNTIME_MM_NODE_AI_WHAT_IF,
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:298 (ctx_what_if)',
  },
  {
    // Closure (2026-08-10) 04_ACTION_COVERAGE_INVENTORY.csv class-d:
    // `handleApplyAISuggestion` — NodeDetailDrawer.tsx:754 AND
    // UnifiedNodeDetailDrawer.tsx:1824 (flag `mindmapDrawerUnified`, default
    // OFF, gates which of the two DRAWERS renders — IdeaRecommendationMap.tsx
    // ~L4103; the two are mutually exclusive per node-panel open, never both
    // mounted-and-visible for the same click, and their `handleApplyAISuggestion`
    // bodies are byte-identical). ONE id for both, not two — same real effect,
    // same mechanism, genuine reuse (precedent: `idea.view.auto_layout`'s
    // NODE-menu reuse comment above).
    //
    // Rozdz. 09 (AI i Teresa) cykl VERIFIED, nie założony:
    //   request      → `handleAIExpand` (OSOBNA, niezarejestrowana tu funkcja)
    //                  woła `Api.expandMyIdeaMap({proposeOnly:true})` — realne
    //                  AI, serwer NIE mutuje nic (proposeOnly).
    //   proposal     → `setAiSuggestions(string[])` — lista tekstów, lokalny
    //                  stan komponentu, NIC nie zapisane.
    //   preview/diff → lista renderuje się jako chipy w drawerze PRZED
    //                  jakąkolwiek akcją — użytkownik widzi treść przed
    //                  kliknięciem.
    //   accept       → klik "Apply" na KONKRETNYM chipie = ten wpis.
    //   apply        → `window.dispatchEvent('idea-workspace-insert', {items:
    //                  [{text, type:'topics'}], anchorNodeId, parentId})`.
    //   history      → odbiornik `idea-workspace-insert`
    //                  (IdeaRecommendationMap.tsx:3473) woła `pushUndo()`
    //                  PRZED `setNodes`/`setEdges` — zweryfikowane w kodzie,
    //                  nie założone.
    //   undo         → `undoStackRef` (50-deep, Ctrl+Z / `undo()`,
    //                  IdeaRecommendationMap.tsx ~L2549) — REALNY, DZIAŁAJĄCY
    //                  mechanizm, nie brakujący (w przeciwieństwie do sugestii
    //                  zadania — sprawdzone przed napisaniem tego wpisu).
    id: 'idea.node.mm_apply_ai_suggestion',
    label: { pl: 'Zastosuj sugestię AI', en: 'Apply AI suggestion' },
    icon: 'Check',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['panel'],
    handler: (ctx) =>
      runMindmapAiSuggestionApplyUiOnlyCallback('idea.node.mm_apply_ai_suggestion', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'IdeaRecommendationMap.tsx:3473 pushUndo() (undoStackRef, 50-deep) wołane w odbiorniku idea-workspace-insert PRZED setNodes/setEdges; cofnięcie przez undo()/Ctrl+Z.',
    },
    teresa: {
      description:
        'Wstawia do Mapy myśli JEDNĄ, już wygenerowaną i wyświetloną w otwartym panelu węzła sugestię AI, jako dziecko tego węzła. DZIŚ NIEDOSTĘPNE dla Teresy: sugestia pochodzi z lokalnego stanu otwartego panelu (poprzedni krok „AI: rozwiń" w tym samym panelu) — nie ma adresowalnego id, którym czat mógłby wskazać KTÓRĄ sugestię zaakceptować.',
    },
    source:
      'src/components/MyWork/mindmap/NodeDetailDrawer.tsx:754 + UnifiedNodeDetailDrawer.tsx:1824 (identyczne handleApplyAISuggestion, flaga mindmapDrawerUnified wybiera który drawer renderuje się).',
  },
  {
    id: 'idea.node.mm_summarize_branch',
    label: { pl: 'Podsumuj gałąź', en: 'Summarize branch' },
    icon: 'FileText',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    // Etykieta BEZ słowa "AI" — poprawnie: klik człowieka (`summarizeBranch()`,
    // IdeaRecommendationMap.tsx:4808-4828) TYLKO wypełnia prompt czatu Teresy
    // (`idea-workspace-chat-prompt`), zero bezpośredniej generacji, zero
    // mutacji grafu — zgodne z rozdz. 09 §2/§5 (delegacja do czatu, jawnie
    // nazwana, bez udawania structured AI). Dla Teresy wybrano INNY, mocniejszy
    // mechanizm (`RUNTIME_MM_NODE_AI_SUMMARIZE_BRANCH` — patrz jego komentarz)
    // zamiast repliki "wyślij sobie prompt do czatu", co byłoby bez sensu dla
    // wywołującego, który JEST czatem.
    handler: (ctx) =>
      runMindmapNodeBusAction(
        'idea.node.mm_summarize_branch',
        RUNTIME_MM_NODE_AI_SUMMARIZE_BRANCH,
        ctx
      ),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Podsumowuje gałąź (węzeł + potomkowie) aktualnie zaznaczoną na Mapie myśli — realne AI, tylko odczyt (nie zmienia mapy). UWAGA: to INNY mechanizm niż klik człowieka z menu węzła (ten tylko wypełnia prompt w oknie czatu) — Teresa dostaje bezpośrednio wygenerowane podsumowanie. Ani jedna, ani druga ścieżka nie przyjmuje `nodeId` — obie działają na to, co jest dziś zaznaczone w przeglądarce.',
    },
    runtime: RUNTIME_MM_NODE_AI_SUMMARIZE_BRANCH,
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:304 (ctx_summarize_branch)',
  },
  {
    // E10 (2026-08-10): id RENAMED from `idea.node.mm_ai_detect_dependencies`
    // → `idea.view.mm_ai_detect_dependencies` — moved from the per-node menu
    // (`NodeContextMenu.tsx`) to the canvas background menu
    // (`PaneContextMenu.tsx`, `pane_dependencies`). See that file's header
    // comment and the master program §8.3 ("visible scope and actual
    // serialized input must match"): `AIDependencyDetector` takes the whole
    // `nodes`/`edges` arrays, no per-node parameter exists, so a per-node
    // menu position was structurally misleading regardless of label — moving
    // it removes the mismatch instead of only disclosing it.
    id: 'idea.view.mm_ai_detect_dependencies',
    label: { pl: 'Wykryj zależności', en: 'Detect dependencies' },
    icon: 'Network',
    scope: 'workspace',
    tools: ['mindmap'],
    surfaces: ['context'],
    // Etykieta BEZ słowa "AI" mimo realnego LLM (`AIDependencyDetector.tsx` →
    // `Api.getMyIdeaAISuggestions`) — zgodne z rozdz. 09 §5 (nazwa nie musi
    // zawierać "AI", żeby akcja BYŁA realnym AI; zakaz działa w drugą stronę).
    // `scope: 'workspace'` jest UCZCIWY wobec kodu: `setShowDependencyDetector(true)`
    // (handlePaneContextAction, `pane_dependencies`) nie przekazuje ŻADNEGO
    // nodeId, a `AIDependencyDetector` bierze CAŁE `nodes`/`edges` mapy — nie
    // ma dziś pojęcia partial/current-view w Mapie myśli, więc `workspace`
    // (cała Idea) opisuje wynik dokładniej niż `current_view` mimo, że menu
    // tła jest kanonicznie poziomem 2 ("Aktualny widok"). Za flagą
    // `mindmapHeuristicAiOverlays` (domyślnie OFF) — nazwa flagi myląco sugeruje
    // heurystykę; SAMO WYKRYWANIE jest realnym wywołaniem LLM, sprawdzone w
    // kodzie (nie w nazwie flagi). BRAK bus/Teresa: `setShowDependencyDetector`
    // to czysty lokalny stan komponentu, bez żadnego odbiornika na szynie —
    // sprawdzone PRZED wpisem (grep `showDependencyDetector` poza tym plikiem:
    // brak wyników), UI-only.
    //
    // GROUNDING DEFEKT (E10, znaleziony przy tym audycie — zgłoszony, NIE
    // naprawiony pełnym backendowym fixem, patrz raport): serwer
    // (`POST /my-work/my-ideas/:id/map/ai-suggestions`) IGNORUJE niestandardowy
    // JSON-schema-request wpisany w `seedText` (komponent prosi o
    // `{"sourceIdx","targetIdx",...}`) i zawsze zwraca własny, generyczny
    // kształt `{id,category,text,detail,confidence}` (topics|findings|next_steps).
    // Klient defaultuje brakujące `sourceIdx`/`targetIdx` na `0`/`1` —
    // realnie KAŻDA "wykryta zależność" łączy dziś pierwsze dwa węzły mapy,
    // niezależnie od treści. Fabrykowana specyficzność zamiast "Evidence
    // needed" (rozdz. 09 §8.2 master programu). Za flagą OFF domyślnie, więc
    // nie dotyka produkcyjnych użytkowników bez świadomego włączenia — ale
    // flaga NIE naprawia samego mechanizmu.
    handler: (ctx) => runMindmapPaneUiOnlyCallback('idea.view.mm_ai_detect_dependencies', ctx),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'proposal',
      evidence:
        'IdeaRecommendationMap.tsx onAddDependency/onAddAll → pushUndo() + setEdges (Add pojedynczo/Add All, nieklikniete = brak zmian).',
    },
    teresa: {
      description:
        'Wykrywa semantyczne zależności między węzłami CAŁEJ Mapy myśli (realne AI, ale patrz UWAGA) i proponuje nowe krawędzie do akceptacji pojedynczo lub hurtem. DZIŚ NIEDOSTĘPNE dla Teresy — otwarcie panelu to czysty lokalny stan UI bez odbiornika na szynie. UWAGA (E10): backend nie zwraca pary węzłów, o którą prosi klient — dziś realnie łączy zawsze pierwsze dwa węzły mapy, niezależnie od treści relacji. Za flagą wyłączoną domyślnie.',
    },
    source: 'src/components/MyWork/mindmap/PaneContextMenu.tsx (pane_dependencies)',
  },
  {
    // E10 (2026-08-10): id RENAMED from `idea.node.mm_ai_prioritize` — moved
    // to the canvas background menu, same reasoning as the entry above.
    id: 'idea.view.mm_ai_prioritize',
    label: { pl: 'Ustal priorytety', en: 'Prioritize' },
    icon: 'Target',
    scope: 'workspace',
    tools: ['mindmap'],
    surfaces: ['context'],
    // Ten sam wzorzec co wpis wyżej: etykieta bez "AI" (poprawnie — LLM
    // realny, `AIPriorityRecommender.tsx` → `Api.getMyIdeaAISuggestions`),
    // `scope: 'workspace'` bo `setShowPriorityRecommender(true)`
    // (handlePaneContextAction, `pane_priority`) nie przekazuje nodeId, a
    // komponent bierze CAŁE `nodes`. UI-only — brak odbiornika na szynie
    // (sprawdzone grepem).
    //
    // GROUNDING DEFEKT (E10, NIE gated za `mindmapHeuristicAiOverlays` mimo
    // tej samej klasy problemu jak wpis wyżej — znalezione, NIE naprawione
    // pełnym backendowym fixem tym audytem, zgłoszone w raporcie): backend
    // zwraca generyczny `confidence` (pewność DOPASOWANIA sugestii do
    // kontekstu, nie ocenę priorytetu), a klient przelicza go WPROST na
    // `suggestedPriority = confidence*100` oraz progowo na `impact`/`effort`
    // (`confidence>0.7 ⇒ high impact`, `confidence>0.6 ⇒ low effort`) —
    // liczby wyglądające jak analiza impact/effort, w rzeczywistości
    // przetworzony szum. LLM nigdy nie oceniał impact/effort TEGO węzła.
    // Fabrykowana specyficzność, rozdz. 09 §8.2.
    handler: (ctx) => runMindmapPaneUiOnlyCallback('idea.view.mm_ai_prioritize', ctx),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'proposal',
      evidence:
        'IdeaRecommendationMap.tsx onApplyPriorities → pushUndo() + setNodes (recenzja rekomendacji, Apply commit).',
    },
    teresa: {
      description:
        'Proponuje priorytety (0-100) dla węzłów CAŁEJ Mapy myśli (realne wywołanie AI, ale patrz UWAGA). DZIŚ NIEDOSTĘPNE dla Teresy — czysty lokalny stan UI. UWAGA (E10): "impact"/"effort"/"priorytet" pokazywane użytkownikowi są dziś przeliczane z ogólnego pola pewności odpowiedzi backendu, NIE z realnej oceny impact/effort TEGO węzła przez model — fabrykowana specyficzność, do naprawy backendu przed zaufaniem tym liczbom.',
    },
    source: 'src/components/MyWork/mindmap/PaneContextMenu.tsx (pane_priority)',
  },
  {
    // E10 (2026-08-10): id RENAMED from `idea.node.mm_ai_competitors` —
    // moved to the canvas background menu, same reasoning as the two entries
    // above.
    id: 'idea.view.mm_ai_competitors',
    label: { pl: 'Konkurencja', en: 'Competitors' },
    icon: 'Globe',
    scope: 'workspace',
    tools: ['mindmap'],
    surfaces: ['context'],
    // Ten sam wzorzec co dwa wpisy wyżej. DODATKOWA NAPRAWA (ta sama klasa co
    // `mm_connect_to_selected`/`mm_detach_branch` w drugiej fali — prawdziwy,
    // zweryfikowany brak, nie spekulacja): `onAddToMap`
    // (IdeaRecommendationMap.tsx, wywołanie AICompetitiveLandscape) NIE wołało
    // `pushUndo()` przed `idea-workspace-insert`, w przeciwieństwie do
    // WSZYSTKICH pozostałych 6 wywołujących tego samego eventu w tym pliku
    // (onAddBlindSpot/onAddNodes×2/onImport itd., wszystkie mają `pushUndo()`
    // jako pierwszą linię) — dopisane N5 czwartą falą, zachowane po przenosinach.
    //
    // GROUNDING DEFEKT (E10, znaleziony przy tym audycie, NIE naprawiony
    // pełnym backendowym fixem, zgłoszone w raporcie): backend nie zwraca
    // strukturalnych pól konkurenta — `strengths`/`weaknesses`/`differentiator`
    // nie istnieją w odpowiedzi `/map/ai-suggestions`. Klient defaultuje
    // `weaknesses: []` (ZAWSZE pusta lista — "brak słabości" to fabrykacja,
    // nie wynik analizy) i `strengths: [s.category]` (dosłownie kategoria
    // sugestii — "topics"/"findings"/"next_steps" — pokazana użytkownikowi
    // jako rzekoma "mocna strona konkurenta"). Fabrykowana specyficzność,
    // rozdz. 09 §8.2 — model nigdy nie nazwał realnego konkurenta ani nie
    // ocenił jego mocnych/słabych stron w tym wywołaniu.
    handler: (ctx) => runMindmapPaneUiOnlyCallback('idea.view.mm_ai_competitors', ctx),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'proposal',
      evidence:
        'IdeaRecommendationMap.tsx onAddToMap (AICompetitiveLandscape) → pushUndo() + idea-workspace-insert.',
    },
    teresa: {
      description:
        'Generuje listę konkurentów/analogii dla CAŁEJ Idei i wstawia wybrane pozycje jako nowe węzły. DZIŚ NIEDOSTĘPNE dla Teresy — czysty lokalny stan UI. UWAGA (E10): "mocne/słabe strony konkurenta" pokazywane w panelu NIE pochodzą z realnej analizy modelu tego konkurenta — backend nie zwraca takich pól, klient je fabrykuje z ogólnej kategorii sugestii. Traktować jako punkt wyjścia do researchu, nie jako fakt.',
    },
    source: 'src/components/MyWork/mindmap/PaneContextMenu.tsx (pane_competitive)',
  },
  {
    id: 'idea.node.mm_ai_suggest_links',
    label: { pl: 'AI: Sugeruj połączenia', en: 'AI: Suggest links' },
    icon: 'Sparkles',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context', 'floating'],
    handler: (ctx) =>
      runMindmapNodeBusAction(
        'idea.node.mm_ai_suggest_links',
        RUNTIME_MM_NODE_AI_SUGGEST_LINKS,
        ctx
      ),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'proposal',
      evidence:
        'IdeaMapWorkspace.tsx:1047-1080 mm_ai_suggest_links_execute → generateAIProposal(generatorType: ai_propose_attachments) → setProposalBatch; odrzucenie = zero zmian.',
    },
    teresa: {
      description:
        'Proponuje powiązania (linki/krawędzie do innych elementów) dla wskazanego węzła Mapy myśli (realne AI, do akceptacji w podglądzie). UWAGA: klik z menu prawego kliku na węzeł jest DZIŚ MARTWY (brak gałęzi obsługi w komponencie — zgłoszone, nie naprawione tym wpisem, żeby nie zmieniać widocznego zachowania kliku poza zakresem wiringu); TA SAMA etykieta na pływającym pasku AI DZIAŁA już dziś i to jej odbiornik wykonuje wywołanie Teresy. Odbiornik ignoruje `nodeId` z parametrów — operuje na tym, co jest dziś zaznaczone w przeglądarce.',
    },
    runtime: RUNTIME_MM_NODE_AI_SUGGEST_LINKS,
    source:
      'src/components/MyWork/mindmap/NodeContextMenu.tsx:328 (ai_suggest_links, martwy klik) + FloatingAIPopover.tsx:52 (żywy klik, ta sama etykieta)',
  },
  {
    id: 'idea.node.mm_change_shape',
    label: { pl: 'Zmień kształt', en: 'Change shape' },
    icon: 'Diamond',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    // JEDYNA (razem z paste_style/vote_up niżej) pozycja tej grupy, która
    // mutuje dane węzła BEZPOŚREDNIO, bez modalu pośredniczącego — i, tak jak
    // te dwie, BEZ `pushUndo()` przed `updateNodeData`
    // (handleContextAction:4949-4960, sprawdzone: brak wywołania w tym bloku).
    // To PRZEDISTNIEJĄCA, SYSTEMOWA luka obejmująca WSZYSTKIE bezpośrednie
    // mutacje danych węzła w tej grupie (change_shape/paste_style/vote_up) —
    // nie punktowy brak jak `mm_connect_to_selected` w drugiej fali, tylko cała
    // klasa zachowań. Zgłoszone uczciwie tu, NIE naprawione hurtem tym wpisem
    // (3 niezależne miejsca, poza wąskim zakresem tego wiringu; patrz raport).
    handler: (ctx) => runMindmapNodeUiOnlyCallback('idea.node.mm_change_shape', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'BRAK: handleContextAction ctx_change_shape (IdeaRecommendationMap.tsx:4949-4960) NIE woła pushUndo() przed updateNodeData — zmiana kształtu nie trafia dziś na stos Ctrl+Z. `local_stack` deklarowany jako bezpieczne dolne ograniczenie zamierzonego mechanizmu (autosave i tak zapisuje stan), nie potwierdzony fakt działania Ctrl+Z dla TEJ konkretnej zmiany.',
    },
    teresa: {
      description:
        'Zmienia kształt wskazanego węzła Mapy myśli (cykl: domyślny/koło/romb/sześciokąt). Lokalna mutacja danych węzła, bez wywołania AI. DZIŚ NIEDOSTĘPNE dla Teresy — brak odbiornika na szynie.',
    },
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:404 (ctx_change_shape)',
  },
  {
    id: 'idea.node.mm_add_image',
    label: { pl: 'Dodaj obraz', en: 'Add image' },
    icon: 'Image',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    // Wzorzec `idea.node.mm_edit`: pozycja menu WYŁĄCZNIE otwiera modal
    // (`setImageUrlNodeId`, handleContextAction:5004-5008) — sama treść (URL
    // obrazu) i faktyczna mutacja (`updateNodeDataById`, bez `pushUndo()` —
    // ta sama systemowa luka co wyżej) następują DOPIERO po wypełnieniu
    // modalu przez człowieka, osobny mechanizm bez własnej pozycji menu.
    handler: (ctx) => runMindmapNodeUiOnlyCallback('idea.node.mm_add_image', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Otwiera okno dodania obrazu (URL) do wskazanego węzła Mapy myśli. Sama treść (adres obrazu) wymaga wpisania przez człowieka w modalu — dziś dostępne WYŁĄCZNIE z menu prawego kliku.',
    },
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:410 (ctx_add_image)',
  },
  {
    id: 'idea.node.mm_copy_style',
    label: { pl: 'Kopiuj styl', en: 'Copy style' },
    icon: 'Paintbrush',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    // Nie mutuje GRAFU — zapisuje styl w lokalnym stanie schowka komponentu
    // (`styleClipboard`, przeglądarkowe, jak `idea.node.mm_copy`/`mm_cut`
    // wyżej) — ten sam wzorzec, ta sama uczciwa granica dla Teresy.
    handler: (ctx) => runMindmapNodeUiOnlyCallback('idea.node.mm_copy_style', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Kopiuje styl wskazanego węzła Mapy myśli do schowka narzędzia (do późniejszego "Wklej styl"). Schowek jest stanem przeglądarki użytkownika — DZIŚ NIEDOSTĘPNE dla Teresy z tego samego powodu co kopiuj/wytnij węzły.',
    },
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:416 (ctx_copy_style)',
  },
  {
    id: 'idea.node.mm_paste_style',
    label: { pl: 'Wklej styl', en: 'Paste style' },
    icon: 'Paintbrush',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    // Bezpośrednia mutacja (`setNodes`, handleContextAction:5013-5017), BEZ
    // `pushUndo()` — ta sama systemowa luka jak `mm_change_shape`/`mm_vote_up`
    // (patrz komentarz tam). Poza tym: czyta lokalny `styleClipboard` — bez
    // sensownego odpowiednika dla Teresy (schowek to stan przeglądarki), tak
    // samo jak `idea.node.mm_copy` — UI-only z DWÓCH niezależnych powodów.
    handler: (ctx) => runMindmapNodeUiOnlyCallback('idea.node.mm_paste_style', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'BRAK: handleContextAction ctx_paste_style (IdeaRecommendationMap.tsx:5013-5017) NIE woła pushUndo() przed setNodes — ta sama systemowa luka co ctx_change_shape/ctx_vote_up (patrz idea.node.mm_change_shape). `local_stack` = dolne ograniczenie, nie potwierdzone działanie.',
    },
    teresa: {
      description:
        'Wkleja wcześniej skopiowany styl na wskazany węzeł. DZIŚ NIEDOSTĘPNE dla Teresy — wymaga schowka stylu w przeglądarce użytkownika (musiał wcześniej kliknąć "Kopiuj styl" na innym węźle), bez odpowiednika parametrowego.',
    },
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:422 (ctx_paste_style)',
  },
  {
    id: 'idea.node.mm_vote_up',
    label: { pl: 'Głosuj', en: 'Vote up' },
    icon: 'Star',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    handler: (ctx) => runMindmapNodeUiOnlyCallback('idea.node.mm_vote_up', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'BRAK: handleContextAction ctx_vote_up (IdeaRecommendationMap.tsx:4901-4907) NIE woła pushUndo() przed updateNodeData (cykl 0-5) — ta sama systemowa luka co ctx_change_shape/ctx_paste_style.',
    },
    teresa: {
      description:
        'Zwiększa licznik głosów wskazanego węzła Mapy myśli (cykl 0→5→0). Lokalna mutacja danych węzła. DZIŚ NIEDOSTĘPNE dla Teresy — brak odbiornika na szynie.',
    },
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:428 (ctx_vote_up)',
  },
  {
    id: 'idea.node.mm_assign',
    label: { pl: 'Przypisz osobę', en: 'Assign person' },
    icon: 'UserPlus',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    // Wzorzec `idea.node.mm_edit`/`mm_add_image`: pozycja menu WYŁĄCZNIE
    // otwiera `AssignPersonModal` (`setAssignModalNodeId`,
    // handleContextAction:4908-4912). Rzeczywista mutacja (`onAssign` →
    // `updateNodeDataById`, IdeaRecommendationMap.tsx:6909-6917) jest lokalnym
    // polem `assignee` na węźle, bez wywołania API i BEZ `pushUndo()` — ta sama
    // systemowa luka jak wyżej, tym razem w kroku PO modalu, więc poza samą
    // klasyfikacją tego wpisu (który opisuje TYLKO otwarcie modalu).
    handler: (ctx) => runMindmapNodeUiOnlyCallback('idea.node.mm_assign', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Otwiera okno przypisania osoby do wskazanego węzła Mapy myśli. Nazwisko/imię wymaga wpisania przez człowieka w modalu — dziś dostępne WYŁĄCZNIE z menu prawego kliku.',
    },
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:434 (ctx_assign)',
  },
  {
    id: 'idea.node.mm_comments',
    label: { pl: 'Komentarze', en: 'Comments' },
    icon: 'MessageSquare',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    // NIE reużyto `idea.node.comments` (Tablica, tools:['whiteboard'] wyżej) —
    // SPRAWDZONE PRZED wpisem, nie spekulacja: to DWA różne komponenty z
    // różnym trwałym magazynem. `WhiteboardNodeCommentThread.tsx` (nagłówek
    // pliku, dosłownie): "Persistence contract... blob-only via
    // node.data.comments[], no server API". Mapa myśli używa
    // `NodeCommentThread.tsx` — REALNE API (`Api.getNodeComments`/
    // `addNodeComment`/`deleteNodeComment`, serwerowo trwałe komentarze z
    // @mention). To NIE kosmetyczna różnica nazwy komponentu — Mapa myśli ma
    // dojrzalszą, serwerową wersję tej samej funkcji niż Tablica; osobny wpis
    // dokumentuje tę rozbieżność zamiast ją zamazywać wspólnym `tools`.
    handler: (ctx) => runMindmapNodeUiOnlyCallback('idea.node.mm_comments', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Otwiera wątek komentarzy (serwerowo trwały, z @wzmiankami) wskazanego węzła Mapy myśli. Samo otwarcie panelu nie mutuje danych — dodawanie/usuwanie komentarzy dzieje się wewnątrz panelu, poza tą akcją. DZIŚ NIEDOSTĘPNE dla Teresy — lokalny stan UI (`setCommentNodeId`) bez odbiornika na szynie.',
    },
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:440 (ctx_comments)',
  },
  {
    id: 'idea.node.mm_attach_knowledge',
    label: { pl: 'Dołącz wiedzę', en: 'Attach knowledge' },
    icon: 'BookOpen',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    handler: (ctx) => runMindmapAttachKnowledgeCallback(ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Otwiera panel dołączania wiedzy (Vault/artefakty) dla wskazanego węzła Mapy myśli, wskazanego po `nodeId`. Samo otwarcie nie mutuje danych. W przeciwieństwie do wersji Tablicy (`idea.node.attach_knowledge`, UI-only bo tamten odbiornik ignoruje nodeId) — Mapa myśli ma realny, adresowalny mechanizm.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Id węzła, dla którego otworzyć panel wiedzy.' },
        },
        required: ['nodeId'],
      },
    },
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:458 (ctx_attach_knowledge)',
  },
  {
    id: 'idea.node.mm_attach_artifact',
    label: { pl: 'Dołącz artefakt', en: 'Attach artifact' },
    icon: 'BookOpen',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    // Wzorzec `idea.node.mm_edit`: pozycja menu WYŁĄCZNIE otwiera
    // `AttachArtifactModal` (`setAttachArtifactNodeId`,
    // handleContextAction:4928-4930). Realna mutacja (`onAttach` →
    // `Api.attachArtifactToObject`, IdeaRecommendationMap.tsx:6925-6947) jest
    // REALNYM wywołaniem serwera (w przeciwieństwie do assign/change_shape —
    // to nie tylko lokalne dane węzła), ale dzieje się PO wypełnieniu modalu,
    // osobny krok od samego otwarcia menu.
    handler: (ctx) => runMindmapNodeUiOnlyCallback('idea.node.mm_attach_artifact', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Otwiera okno dołączania artefaktu (innego rekordu Consultify) do wskazanego węzła Mapy myśli. Wybór artefaktu i faktyczne dołączenie (realny zapis na serwerze) następują w modalu — dziś dostępne WYŁĄCZNIE z menu prawego kliku.',
    },
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:464 (ctx_attach_artifact)',
  },
  {
    id: 'idea.node.mm_open_linked_artifacts',
    label: { pl: 'Powiązane artefakty', en: 'Linked artifacts' },
    icon: 'ExternalLink',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    // Wyłącznie odczyt: 0 linków → toast informacyjny; 1 link → otwiera go
    // wprost (`mywork-open-item`); >1 → otwiera panel szczegółów węzła
    // (handleContextAction:4931-4945). Żadna gałąź nie zmienia danych.
    handler: (ctx) => runMindmapNodeUiOnlyCallback('idea.node.mm_open_linked_artifacts', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Pokazuje artefakty powiązane ze wskazanym węzłem Mapy myśli (otwiera bezpośrednio, gdy jest dokładnie jeden; w przeciwnym razie panel szczegółów). Wyłącznie odczyt. DZIŚ NIEDOSTĘPNE dla Teresy — logika czyta `ctxNode.data.artifactLinks` z domknięcia komponentu, bez odbiornika na szynie.',
    },
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:470 (ctx_open_linked_artifacts)',
  },
  {
    id: 'idea.node.mm_copy_link',
    label: { pl: 'Kopiuj link', en: 'Copy link' },
    icon: 'Share2',
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    // Czysty odczyt + zapis do schowka SYSTEMOWEGO (nie schowka narzędzia) —
    // buduje URL z `focusNode=<id>` i kopiuje (handleContextAction:5018-5030).
    // Nie zmienia żadnych danych Idei.
    handler: (ctx) => runMindmapNodeUiOnlyCallback('idea.node.mm_copy_link', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Kopiuje do schowka systemowego link URL do wskazanego węzła Mapy myśli (parametr `focusNode`). Nie zmienia danych Idei. DZIŚ NIEDOSTĘPNE dla Teresy — `navigator.clipboard` to API przeglądarki użytkownika, bez sensownego odpowiednika po stronie czatu.',
    },
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:476 (ctx_share_branch)',
  },
  {
    id: 'idea.node.mm_delete',
    label: { pl: 'Usuń', en: 'Delete' },
    icon: 'Trash2',
    // Ta INSTANCJA (wywołana z menu prawego kliku na JEDNYM węźle) działa
    // jako single_item — ale bazowa funkcja (`deleteSelected`) potrafi
    // usunąć WIELE zaznaczonych węzłów naraz, gdy wywołana skądinąd (np.
    // klawisz Delete przy zaznaczeniu wielokrotnym). Deklarujemy `single_item`
    // bo to jest zakres TEJ powierzchni (menu węzła), nie ukrywając szerszej
    // zdolności funkcji w opisie Teresy poniżej.
    scope: 'single_item',
    tools: ['mindmap'],
    surfaces: ['context'],
    shortcut: 'Del',
    // NIE reużyto `idea.node.delete` (Tablica, `wb_delete`) — inny odbiornik,
    // inna reprezentacja, ta sama „operuje na dzisiejszym zaznaczeniu, nie
    // przyjmuje nodeId" uczciwa granica (patrz teresa.description niżej,
    // słowo w słowo ten sam wzorzec co Tablica).
    handler: (ctx) => runMindmapNodeBusAction('idea.node.mm_delete', RUNTIME_MM_NODE_DELETE, ctx),
    mutates: true,
    requiresPreview: false,
    destructive: true,
    undo: {
      kind: 'local_stack',
      evidence: 'useMindMapNodes.tsx deleteSelected:657 → pushUndo() (stos Ctrl+Z)',
    },
    teresa: {
      description:
        'Usuwa węzeł (i jego poddrzewo — z potwierdzeniem, gdy ma dzieci). UWAGA: działa na to, co jest DZIŚ zaznaczone na płótnie w przeglądarce użytkownika — nie przyjmuje `nodeId`, więc bez wcześniejszego zaznaczenia przez użytkownika nie ma czego usunąć (ta sama uczciwa granica co `idea.node.delete` na Tablicy).',
    },
    runtime: RUNTIME_MM_NODE_DELETE,
    source: 'src/components/MyWork/mindmap/NodeContextMenu.tsx:404 (ctx_delete)',
  },
];
