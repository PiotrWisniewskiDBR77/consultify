/**
 * Akcje rejestru Idea Workspace — domena: processFlow.
 *
 * Wydzielone z `src/actions/ideaActionRegistry.ts` (QG-01, 2026-08-10),
 * verbatim (identyczne id/label/scope/surfaces/handler/mutates/undo/teresa),
 * tylko fizycznie przeniesione. SSOT formatu i reguł: nagłówek
 * `src/actions/ideaActionRegistry.ts` + `docs/standards/idea-workspace/02_REJESTR_AKCJI.md`.
 */

import type { ActionDef } from './types';
import {
  RUNTIME_AI_PROCESS_ANALYSIS,
  RUNTIME_PF_ADD_DECISION,
  RUNTIME_PF_ADD_START,
  RUNTIME_PF_ADD_VSM_PROCESS,
  RUNTIME_PF_MODE_AUTOMATION,
  RUNTIME_PF_MODE_CLASSIC,
  RUNTIME_PF_MODE_VSM,
  RUNTIME_PF_NODE_AI_REWRITE_STEP,
  RUNTIME_PF_PROCESS_SUMMARY,
  runByTool,
  runEdgeParamCallback,
  runKeyboardOnlyCallback,
  runLaneParamCallback,
  runProcessFlowAIRewriteStepCallback,
  runProcessFlowConvertAnalysisCallback,
  runProcessFlowConvertInitiativeCallback,
  runProcessFlowConvertTargetCallback,
  runProcessFlowNodeUiOnlyCallback,
  runProcessFlowPaneUiOnlyCallback,
  runProcessFlowToolbarUiOnlyCallback,
  runToolbarBusAction,
} from './runtimeHelpers';
import { Api } from '@/services/api';

export const PROCESS_FLOW_ACTIONS: ActionDef[] = [
  {
    id: 'idea.ai.process_analysis',
    label: {
      pl: 'AI: analiza procesu',
      en: 'AI: process analysis',
    },
    icon: 'Lightbulb',
    scope: 'current_view',
    tools: ['process_flow'],
    // `toolbar` dopisane 2026-08-10 (N6.4): pozycja „AI Coach" w menu „Więcej"
    // paska Przepływu woła prop `runProcessCoach`, który w
    // `IdeaProcessFlowTool.tsx:2885` jest tą samą funkcją `handleAICoach`, co
    // odbiornik `pf_analyze` (`runProcessCoach: handleAICoach` w opts hooka) —
    // reuse po REALNYM mechanizmie (jeden generator `process_coach`, jedno
    // wywołanie LLM), nie po etykiecie. Handler zmieniony z `runByTool` na
    // `runToolbarBusAction` (ten sam dual-path co `idea.canvas.cursor_select`),
    // żeby klik człowieka z paska szedł ORYGINALNYM propem (`ctx.params.run`),
    // a nie okrężnie przez szynę — bajt w bajt to samo zachowanie co przed
    // podłączeniem. Teresa (bez `run`) nadal dispatchuje `pf_analyze`.
    surfaces: ['rail', 'panel', 'toolbar'],
    handler: (ctx) =>
      runToolbarBusAction('idea.ai.process_analysis', RUNTIME_AI_PROCESS_ANALYSIS, ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      // Rozdz. 09 §6 wymaga wprost, żeby AI Coach i Podsumowanie Przepływu były
      // oznaczone jako „AI (tylko odczyt)" i NIE sugerowały, że coś zmieniają.
      description:
        'Sprawdza Przepływ pod kątem wąskich gardeł i luk — REALNE AI (generator `process_coach`), wynik TYLKO DO ODCZYTU: lista spostrzeżeń w panelu. Nie dodaje, nie zmienia i nie usuwa ani jednego kroku — jeśli użytkownik chce, żeby AI zmieniła proces, to inne akcje (np. „Przeredaguj krok").',
    },
    runtime: RUNTIME_AI_PROCESS_ANALYSIS,
    source:
      'src/components/MyWork/processflow/useProcessFlowQuickActions.ts:144 (pf_analyze → runProcessCoach) · REUSED (2026-08-10, N6.4) by ProcessFlowToolbar.tsx overflow „AI Coach" (prop runProcessCoach → IdeaProcessFlowTool.handleAICoach:2153 → ideaAIGenerator.runProcessCoach → Api.generateIdeaAI(process_coach) → llmService.callStructured — realny LLM zweryfikowany do serwera włącznie)',
  },
  {
    id: 'idea.edge.pf_edit_props',
    label: { pl: 'Etykieta i styl', en: 'Label & style' },
    icon: 'Pencil',
    scope: 'edge',
    tools: ['process_flow'],
    surfaces: ['context'],
    handler: (ctx) => runEdgeParamCallback('idea.edge.pf_edit_props', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Otwiera panel etykiety/koloru/stylu linii/strzałki wskazanego połączenia Przepływu (ten sam EdgeStylePopover co lewy klik na krawędzi). Sama w sobie NIC nie zmienia dane — użytkownik dokańcza zmianę W otwartym panelu (te dalsze mutacje nie mają dziś własnych wpisów w rejestrze, poza zakresem tego zadania). Wywołanie spoza UI (Teresa) otwiera panel w stałym domyślnym miejscu ekranu, bo nie ma współrzędnych kliknięcia. Podaj `edgeId` połączenia.',
      parameters: {
        type: 'object',
        properties: {
          edgeId: { type: 'string', description: 'Id połączenia (krawędzi) Przepływu.' },
        },
        required: ['edgeId'],
      },
    },
    source:
      'src/components/MyWork/IdeaProcessFlowTool.tsx onEditProps → setEdgeStylePopover (~linia 3805) + processflow/EdgeStylePopover.tsx + processflow/useProcessFlowQuickActions.ts pf_edge_edit_props (nowy odbiornik, 2026-08-09)',
  },
  {
    id: 'idea.edge.pf_insert_node',
    label: { pl: 'Wstaw węzeł na połączeniu', en: 'Insert node on connection' },
    icon: 'Split',
    scope: 'edge',
    tools: ['process_flow'],
    surfaces: ['context'],
    handler: (ctx) => runEdgeParamCallback('idea.edge.pf_insert_node', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'IdeaProcessFlowTool.tsx insertBetween:1775 → pushUndo():1811 przed mutacją (add_node+remove_edge+2×add_edge), stos Ctrl+Z.',
    },
    teresa: {
      description:
        'Dzieli wskazane połączenie Przepływu na dwa, wstawiając między nimi nowy krok. UWAGA (mechanizm inny niż na Mapie myśli): `insertBetween()` w Przepływie działa na AKTUALNIE ZAZNACZONEJ krawędzi na płótnie, nie na dowolnym `edgeId` — realnie trafi w to połączenie tylko, gdy jest ono zaznaczone w przeglądarce użytkownika w chwili wywołania (tak jak dziś prawy klik, który zaznacza krawędź PRZED otwarciem menu). Dlatego świadomie NIE rozszerzono nim `idea.edge.insert_node` (Mapa myśli, adresowane po edgeId) — to inny mechanizm, nie wariant tej samej akcji. `edgeId` w kontrakcie jest informacyjny (spójność z resztą rejestru) — realnie liczy się zaznaczenie.',
      parameters: {
        type: 'object',
        properties: {
          edgeId: {
            type: 'string',
            description: 'Id połączenia (informacyjnie — realnie liczy się zaznaczenie na płótnie).',
          },
        },
        required: ['edgeId'],
      },
    },
    source:
      'src/components/MyWork/IdeaProcessFlowTool.tsx insertBetween:1775 (też floating toolbar „Insert between" i szyna pf_insert_between, processflow/useProcessFlowQuickActions.ts:100 — REUŻYTY odbiornik, nie duplikowany)',
  },
  {
    id: 'idea.edge.pf_condition_none',
    label: { pl: 'Warunek: Bez warunku', en: 'Condition: No condition' },
    icon: 'Check',
    scope: 'edge',
    tools: ['process_flow'],
    surfaces: ['context'],
    handler: (ctx) => runEdgeParamCallback('idea.edge.pf_condition_none', ctx, { condition: '' }),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'IdeaProcessFlowTool.tsx handleEdgeConditionChange:942 → pushUndo():945 przed setEdges (już obecne, nic nie dopisywano).',
    },
    teresa: {
      description:
        'Czyści typ warunku wskazanego połączenia Przepływu — krawędź wraca do zwykłej, sekwencyjnej (bez etykiety Tak/Nie/Domyślny/Wyjątek). Podaj `edgeId` połączenia.',
      parameters: {
        type: 'object',
        properties: {
          edgeId: { type: 'string', description: 'Id połączenia (krawędzi) Przepływu.' },
        },
        required: ['edgeId'],
      },
    },
    source:
      'src/components/MyWork/processflow/ProcessFlowContextMenu.tsx EDGE_CONDITIONS[0] + IdeaProcessFlowTool.tsx handleEdgeConditionChange:942',
  },
  {
    id: 'idea.edge.pf_condition_yes',
    label: { pl: 'Warunek: Tak', en: 'Condition: Yes' },
    icon: 'Check',
    scope: 'edge',
    tools: ['process_flow'],
    surfaces: ['context'],
    handler: (ctx) => runEdgeParamCallback('idea.edge.pf_condition_yes', ctx, { condition: 'yes' }),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'IdeaProcessFlowTool.tsx handleEdgeConditionChange:942 → pushUndo():945 przed setEdges (już obecne, nic nie dopisywano).',
    },
    teresa: {
      description:
        'Ustawia typ warunku wskazanego połączenia Przepływu na „Tak" (gałąź decyzji spełnionej). Etykieta i logika zapisują się trwale i przeżywają przeładowanie (potwierdzone manualnym audytem, finding PF-P1-02). Podaj `edgeId` połączenia.',
      parameters: {
        type: 'object',
        properties: {
          edgeId: { type: 'string', description: 'Id połączenia (krawędzi) Przepływu.' },
        },
        required: ['edgeId'],
      },
    },
    source:
      'src/components/MyWork/processflow/ProcessFlowContextMenu.tsx EDGE_CONDITIONS[1] + IdeaProcessFlowTool.tsx handleEdgeConditionChange:942',
  },
  {
    id: 'idea.edge.pf_condition_no',
    label: { pl: 'Warunek: Nie', en: 'Condition: No' },
    icon: 'Check',
    scope: 'edge',
    tools: ['process_flow'],
    surfaces: ['context'],
    handler: (ctx) => runEdgeParamCallback('idea.edge.pf_condition_no', ctx, { condition: 'no' }),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'IdeaProcessFlowTool.tsx handleEdgeConditionChange:942 → pushUndo():945 przed setEdges (już obecne, nic nie dopisywano).',
    },
    teresa: {
      description:
        'Ustawia typ warunku wskazanego połączenia Przepływu na „Nie" (gałąź decyzji niespełnionej). Etykieta i logika zapisują się trwale i przeżywają przeładowanie (potwierdzone manualnym audytem, finding PF-P1-02). Podaj `edgeId` połączenia.',
      parameters: {
        type: 'object',
        properties: {
          edgeId: { type: 'string', description: 'Id połączenia (krawędzi) Przepływu.' },
        },
        required: ['edgeId'],
      },
    },
    source:
      'src/components/MyWork/processflow/ProcessFlowContextMenu.tsx EDGE_CONDITIONS[2] + IdeaProcessFlowTool.tsx handleEdgeConditionChange:942',
  },
  {
    id: 'idea.edge.pf_condition_default',
    label: { pl: 'Warunek: Domyślny', en: 'Condition: Default' },
    icon: 'Check',
    scope: 'edge',
    tools: ['process_flow'],
    surfaces: ['context'],
    handler: (ctx) =>
      runEdgeParamCallback('idea.edge.pf_condition_default', ctx, { condition: 'default' }),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'IdeaProcessFlowTool.tsx handleEdgeConditionChange:942 → pushUndo():945 przed setEdges (już obecne, nic nie dopisywano).',
    },
    teresa: {
      description:
        'Ustawia typ warunku wskazanego połączenia Przepływu na „Domyślny" (wyjście bramki, gdy żaden inny warunek nie pasuje). Podaj `edgeId` połączenia.',
      parameters: {
        type: 'object',
        properties: {
          edgeId: { type: 'string', description: 'Id połączenia (krawędzi) Przepływu.' },
        },
        required: ['edgeId'],
      },
    },
    source:
      'src/components/MyWork/processflow/ProcessFlowContextMenu.tsx EDGE_CONDITIONS[3] + IdeaProcessFlowTool.tsx handleEdgeConditionChange:942',
  },
  {
    id: 'idea.edge.pf_condition_exception',
    label: { pl: 'Warunek: Wyjątek', en: 'Condition: Exception' },
    icon: 'Check',
    scope: 'edge',
    tools: ['process_flow'],
    surfaces: ['context'],
    handler: (ctx) =>
      runEdgeParamCallback('idea.edge.pf_condition_exception', ctx, { condition: 'exception' }),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'IdeaProcessFlowTool.tsx handleEdgeConditionChange:942 → pushUndo():945 przed setEdges (już obecne, nic nie dopisywano).',
    },
    teresa: {
      description:
        'Ustawia typ warunku wskazanego połączenia Przepływu na „Wyjątek" (gałąź błędu/wyjątku, np. pętla korekty — patrz finding PF-P1-02). Podaj `edgeId` połączenia.',
      parameters: {
        type: 'object',
        properties: {
          edgeId: { type: 'string', description: 'Id połączenia (krawędzi) Przepływu.' },
        },
        required: ['edgeId'],
      },
    },
    source:
      'src/components/MyWork/processflow/ProcessFlowContextMenu.tsx EDGE_CONDITIONS[4] + IdeaProcessFlowTool.tsx handleEdgeConditionChange:942',
  },
  {
    id: 'idea.edge.pf_delete',
    label: { pl: 'Usuń połączenie', en: 'Delete connection' },
    icon: 'Trash2',
    scope: 'edge',
    tools: ['process_flow'],
    surfaces: ['context'],
    handler: (ctx) => runEdgeParamCallback('idea.edge.pf_delete', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'useProcessFlowNodes.ts deleteSelected:70 → pushUndo():83 przed usunięciem (stos Ctrl+Z).',
    },
    destructive: true,
    teresa: {
      description:
        'Usuwa wskazane połączenie Przepływu na trwałe (cofnięcie tylko przez Ctrl+Z w tej samej sesji). UWAGA (jak przy `idea.edge.pf_insert_node`): `deleteSelected()` w Przepływie działa na AKTUALNIE ZAZNACZONYM elemencie (węźle LUB krawędzi), nie na dowolnym `edgeId` — realnie usunie to połączenie tylko, gdy jest ono zaznaczone na płótnie (tak jak dziś prawy klik, który zaznacza krawędź przed otwarciem menu). Świadomie NIE rozszerzono `idea.edge.delete` (Tablica/Mapa myśli, adresowane po edgeId) — inny mechanizm. `edgeId` w kontrakcie jest informacyjny — realnie liczy się zaznaczenie.',
      parameters: {
        type: 'object',
        properties: {
          edgeId: {
            type: 'string',
            description: 'Id połączenia (informacyjnie — realnie liczy się zaznaczenie na płótnie).',
          },
        },
        required: ['edgeId'],
      },
    },
    source:
      'src/components/MyWork/IdeaProcessFlowTool.tsx onDelete → deleteSelected() (~linia 3816) + processflow/useProcessFlowNodes.ts:70 (też szyna pf_delete, processflow/useProcessFlowQuickActions.ts:185 — REUŻYTY odbiornik, nie duplikowany)',
  },
  {
    id: 'idea.node.pf_properties',
    label: { pl: 'Otwórz właściwości', en: 'Open properties' },
    icon: 'Settings',
    scope: 'single_item',
    tools: ['process_flow'],
    // Dual-surface (2026-08-09): NAPRAWDĘ ta sama akcja co
    // `ProcessFlowFloatingToolbar.tsx`'s „Rename" (F2) — SPRAWDZONE w kodzie
    // (nie zgadywane): oba `onOpenProperties` (menu węzła) i `onRename`
    // (pływający pasek) wołają DOSŁOWNIE `() => setShowPropertiesPanel(true)`,
    // bez ŻADNEGO parametru różnicującego "otwórz właściwości" od "zmień
    // nazwę" — ten sam panel (`ProcessFlowPropertiesPanel`) otwiera się
    // identycznie z obu wejść, mimo dwóch różnych etykiet ("Open properties"
    // vs "Rename (F2)"), co może mylić użytkownika oczekującego skupienia na
    // polu nazwy przy „Rename" — panel nie robi nic specjalnego dla tego
    // wejścia. Udokumentowane uczciwie, nie ukryte.
    surfaces: ['context', 'floating'],
    shortcut: 'F2',
    handler: (ctx) => runProcessFlowNodeUiOnlyCallback('idea.node.pf_properties', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Otwiera panel właściwości wskazanego kroku Przepływu (etykieta, typ bramki, tor, metryki). Samo otwarcie nie mutuje danych — edycje dzieją się WEWNĄTRZ panelu, poza tą akcją. Ta sama akcja jest też przyciskiem „Rename (F2)" pływającego paska — obie wejścia otwierają identyczny panel, mimo różnych etykiet. DZIŚ NIEDOSTĘPNE dla Teresy — lokalny stan UI (`setShowPropertiesPanel`), bez odbiornika na szynie.',
    },
    source:
      'src/components/MyWork/processflow/ProcessFlowContextMenu.tsx getNodeContextActions id=properties:96 (onOpenProperties) + IdeaProcessFlowTool.tsx (~linia 3794) · dual-surface: ProcessFlowFloatingToolbar.tsx onRename prop (~linia 3485), IdeaProcessFlowTool.tsx onRename → setShowPropertiesPanel(true) — DOKŁADNIE ta sama funkcja',
  },
  {
    id: 'idea.node.pf_edit',
    label: { pl: 'Edytuj etykietę', en: 'Edit label' },
    icon: 'Pencil',
    scope: 'single_item',
    tools: ['process_flow'],
    surfaces: ['context'],
    // NIE reużyto `idea.node.edit` (Tablica, dispatchuje nową `label` wprost)
    // ani nie wprowadzono jako wariant Mapy myśli `mm_edit` — SPRAWDZONE:
    // przełącza WYŁĄCZNIE tryb edycji inline (bumpuje `editSignal` na
    // `node.data`, `FlowNodeComponent` zaczyna edycję), treść zmienia się
    // dopiero gdy użytkownik wpisze tekst i odejdzie z pola — osobny
    // mechanizm (`onLabelChange`), bez własnej pozycji menu. Ten sam rodzaj
    // różnicy (przełącznik trybu UI vs mutacja danych) co Mapa myśli już
    // udokumentowała dla `mm_edit`.
    handler: (ctx) => runProcessFlowNodeUiOnlyCallback('idea.node.pf_edit', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Włącza tryb edycji etykiety wskazanego kroku Przepływu (kursor w polu tekstowym). Dziś dostępne WYŁĄCZNIE z menu prawego kliku na węzeł — sama zmiana treści i tak wymaga wpisania tekstu przez człowieka, więc nie ma dziś sensownego odpowiednika dla czatu.',
    },
    source:
      'src/components/MyWork/processflow/ProcessFlowContextMenu.tsx getNodeContextActions id=edit:103 (onEditLabel) + IdeaProcessFlowTool.tsx editSignal bump (~linia 3759)',
  },
  {
    id: 'idea.node.pf_copy',
    label: { pl: 'Kopiuj', en: 'Copy' },
    icon: 'Copy',
    scope: 'single_item',
    tools: ['process_flow'],
    surfaces: ['context'],
    // NIE reużyto `idea.node.copy` (Tablica) — SPRAWDZONE w
    // `useProcessFlowNodes.ts`: `kopiujWezly`/`copyNodeById` kopiują węzeł
    // (i jego wewnętrzne krawędzie) do `schowekRef` — schowka NARZĘDZIA
    // (React ref, nie schowka przeglądarki) — a „Wklej" na płótnie
    // (`pasteClipboard`) REALNIE wkleja te obiekty jako nowe elementy.
    // Tablica ma dziś (od naprawy WB-CLIPBOARD-01, 2026-08-10) TEN SAM RODZAJ
    // mechanizmu — ale OSOBNĄ implementację (`whiteboard/useWhiteboardNodes.ts`
    // własny `clipboardRef`), więc to nadal nowe id, nie reuse. Menu prawego
    // kliku nie zaznacza klikniętego węzła
    // (patrz `idea.node.pf_edit`), więc `onCopy` w `IdeaProcessFlowTool.tsx`
    // woła `copyNodeById(nodeId)` (po id z zamknięcia menu), NIE
    // `copySelected()` — jedyna z ośmiu pozycji tego menu, która świadomie
    // obsługuje ten przypadek zamiast cicho nic nie robić.
    handler: (ctx) => runProcessFlowNodeUiOnlyCallback('idea.node.pf_copy', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Kopiuje wskazany krok Przepływu (i jego wewnętrzne połączenia) do schowka narzędzia — realna kopia obiektu, konsumowana przez „Wklej" na płótnie (nie schowek systemowy — to nie jest wariant Tablicy `idea.node.copy`, który kopiuje tylko tekst). Dziś dostępne WYŁĄCZNIE z menu prawego kliku — schowek to zmienna w przeglądarce, bez odbiornika na szynie.',
    },
    source:
      'src/components/MyWork/processflow/ProcessFlowContextMenu.tsx getNodeContextActions id=copy:119 (onCopy) + IdeaProcessFlowTool.tsx copyNodeById (~linia 3778) + useProcessFlowNodes.ts kopiujWezly/copyNodeById:186-215',
  },
  {
    id: 'idea.node.pf_ai_rewrite_step',
    label: { pl: 'AI: przeredaguj krok', en: 'AI: rewrite step' },
    icon: 'Sparkles',
    scope: 'single_item',
    tools: ['process_flow'],
    surfaces: ['context'],
    handler: (ctx) => runProcessFlowAIRewriteStepCallback(ctx),
    mutates: true,
    requiresPreview: true,
    undo: {
      kind: 'proposal',
      evidence:
        'createStepRewriteProposal (generatorType: edit_step) → presentBatch → AIProposalPanel (accept/reject); odrzucenie = zero zmian. Rozdz. 09 §3 nazywa to WZORCEM DO SKOPIOWANIA — najlepiej zbudowaną ścieżkę AI dziś w całym Idea Workspace (before/after walidacja + readback w podglądzie).',
    },
    teresa: {
      description:
        'Przeredagowuje wskazany krok Przepływu wg polecenia (realne AI — `edit_step` generator, `Api`/`generateAIProposal`, ZAWSZE do akceptacji w podglądzie z porównaniem przed/po i walidacją). Podaj `nodeId` kroku i `instruction` (co zmienić). W przeciwieństwie do Mapy myśli `idea.node.mm_ai_rewrite_node` (UI-only, bo zbiera polecenie przez blokujący `window.prompt()`) — ta akcja ma prawdziwą ścieżkę dla Teresy, bo UI Przepływu zbiera polecenie przez zwykły panel React, nie dialog przeglądarki.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Id kroku Przepływu do przeredagowania.' },
          instruction: { type: 'string', description: 'Polecenie — co zmienić w treści kroku.' },
        },
        required: ['nodeId', 'instruction'],
      },
    },
    runtime: RUNTIME_PF_NODE_AI_REWRITE_STEP,
    source:
      'src/components/MyWork/processflow/ProcessFlowContextMenu.tsx getNodeContextActions id=ai-rewrite-step:144 (onAIRewriteStep) + IdeaProcessFlowTool.tsx openStepRewrite:817 + createStepRewriteProposal (useProcessFlowAIProposal.ts:356) + processflow/useProcessFlowQuickActions.ts pf_ai_rewrite_step (nowy odbiornik, 2026-08-09)',
  },
  {
    id: 'idea.node.pf_convert_initiative',
    label: { pl: 'Konwertuj na inicjatywę', en: 'Convert to initiative' },
    icon: 'Rocket',
    scope: 'single_item',
    tools: ['process_flow'],
    // `toolbar` dopisane 2026-08-10 (N6.4): grupa „Konwertuj" w menu „Więcej"
    // paska ma pozycję „Inicjatywa" wołającą `onConvert('pf_convert_initiative')`
    // → `handleConvert` — DOKŁADNIE tę samą funkcję i ten sam string co menu
    // węzła (`onConvertInitiative`, IdeaProcessFlowTool.tsx:3831). Reuse, nie
    // nowe id.
    surfaces: ['context', 'toolbar'],
    handler: (ctx) => runProcessFlowConvertInitiativeCallback(ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'manual_delete',
      evidence:
        'Api.convertMyIdea → nowy rekord Initiative; brak automatycznego cofnięcia (ten sam wzorzec co idea.workspace.convert/idea.node.mm_convert_initiative).',
    },
    destructive: false,
    teresa: {
      description:
        'Konwertuje wskazany krok Przepływu na Inicjatywę — tworzy nowy, trwały rekord w PMO. UWAGA (defekt odkryty przy tym wpisie, NIE naprawiony w UI): kliknięcie człowieka w menu wysyła pole `selectedIds`, którego odbiornik w powłoce nigdy nie czyta (czyta tylko `nodeIds`) — w praktyce UI konwertuje bieżące zaznaczenie płótna, NIE koniecznie krok, na którym otwarto menu (prawy klik go nie zaznacza). Ta ścieżka (Teresa) go NIE dziedziczy — woła `Api.convertMyIdea` wprost z poprawnym `nodeId`, więc jest bardziej wiarygodna niż dzisiejszy klik człowieka. Brak podglądu przed konwersją (przedistniejące, rozdz. 10 §2.2 tego wymaga docelowo). Podaj `nodeId`.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Id kroku Przepływu do konwersji.' },
        },
        required: ['nodeId'],
      },
      confirmBeforeRun: true,
    },
    source:
      'src/components/MyWork/processflow/ProcessFlowContextMenu.tsx getNodeContextActions id=convert-initiative:155 (onConvertInitiative) + IdeaProcessFlowTool.tsx handleConvert:2361 + IdeaMapWorkspace.tsx CONVERT_PREFIX_MAP/handleQuickAction:1017-1045 (selectedIds/nodeIds mismatch discovered here) + Api.convertMyIdea (Teresa path, direct call, 2026-08-09)',
  },
  {
    id: 'idea.node.pf_artifact_links',
    label: { pl: 'Powiązane artefakty', en: 'Artifact links' },
    icon: 'Link2',
    scope: 'single_item',
    tools: ['process_flow'],
    surfaces: ['floating'],
    // Wyłącznie na pływającym pasku — menu prawego kliku na węzeł NIE ma tej
    // pozycji (sprawdzone w `getNodeContextActions`, 8 pozycji bez tej). Bez
    // odpowiednika cross-tool: Mapa myśli ma `idea.node.mm_open_linked_artifacts`,
    // ale INNY mechanizm (0/1/>1 rozgałęzienie: 0→toast, 1→otwiera wprost,
    // >1→panel szczegółów), podczas gdy tu to prosty toggle popovera z listą
    // + usuwaniem pojedynczych linków — materialnie inny UX, nowe id.
    handler: (ctx) => runProcessFlowNodeUiOnlyCallback('idea.node.pf_artifact_links', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Pokazuje/ukrywa popover z artefaktami powiązanymi ze wskazanym krokiem Przepływu (lista + usuwanie pojedynczych linków). Samo przełączenie nie mutuje danych — usunięcie linku wewnątrz popovera tak, ale to osobny, niewystawiony tu mechanizm. DZIŚ NIEDOSTĘPNE dla Teresy — lokalny stan UI (`showLinks`), bez odbiornika na szynie.',
    },
    source:
      'src/components/MyWork/processflow/ProcessFlowFloatingToolbar.tsx onClick → setShowLinks (~linia 111)',
  },
  {
    id: 'idea.node.pf_comments',
    label: { pl: 'Komentarze', en: 'Comments' },
    icon: 'MessageCircle',
    scope: 'single_item',
    tools: ['process_flow'],
    surfaces: ['floating'],
    // NIE reużyto `idea.node.comments` (Tablica) mimo tej samej warstwy
    // trwałości ("blob-only via node.data.comments[], no server API" — tak
    // twierdzi nagłówek `ProcessFlowNodeCommentThread.tsx` wprost) —
    // implementacja (komponent, stan `setCommentsPanelNodeId`) jest
    // CAŁKOWICIE osobna, zero współdzielonego kodu z Tablicą. Ten sam próg co
    // reszta tego rejestru: osobna implementacja = osobne id, nawet gdy klasa
    // trwałości się zgadza.
    handler: (ctx) => runProcessFlowNodeUiOnlyCallback('idea.node.pf_comments', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Otwiera wątek komentarzy wskazanego kroku Przepływu (trwałość: blob w `node.data.comments[]`, bez osobnego API serwerowego — jak Tablica, w przeciwieństwie do Mapy myśli, która ma realne API). Samo otwarcie nie mutuje danych. DZIŚ NIEDOSTĘPNE dla Teresy — lokalny stan UI (`setCommentsPanelNodeId`), bez odbiornika na szynie.',
    },
    source:
      'src/components/MyWork/processflow/ProcessFlowFloatingToolbar.tsx onClick → onOpenComments (~linia 128) + IdeaProcessFlowTool.tsx setCommentsPanelNodeId (~linia 3500)',
  },
  {
    id: 'idea.node.pf_open_chat',
    label: { pl: 'Zapytaj AI', en: 'Ask AI' },
    icon: 'MessageSquare',
    // ★ ZALOGOWANE, NIE POPRAWIONE (N6.4, 2026-08-10): `scope: 'single_item'`
    // jest NIEŚCISŁE i było takie już przy powstaniu tego wpisu (N6, pasek
    // pływający). `handleOpenChatWithContext` (IdeaProcessFlowTool.tsx:2395)
    // NIE przyjmuje żadnego id i buduje prompt z CAŁEGO widoku (tryb, liczba
    // kroków, liczba torów, ostrzeżenia walidacji) + ewentualnych zaznaczonych
    // węzłów — to zakres `current_view`, nie „jeden element". Zmiana `scope`
    // istniejącego wpisu wpływa na filtrowanie powierzchni i na manifest
    // Teresy, więc NIE robię jej przy okazji okablowania paska — zgłoszone do
    // decyzji właściciela, nie ukryte.
    scope: 'single_item',
    tools: ['process_flow'],
    // `toolbar` dopisane 2026-08-10 (N6.4): pozycja „Zapytaj AI o ten proces"
    // w menu „Więcej" paska dostaje `onOpenChat={handleOpenChatWithContext}` —
    // TEN SAM obiekt funkcji, co pływający pasek (`IdeaProcessFlowTool.tsx`
    // linie 2912 i 3521, oba `onOpenChat ? handleOpenChatWithContext : undefined`).
    // Reuse po realnym mechanizmie; etykieta paska jest dłuższa („o ten
    // proces"), ale wywołanie identyczne.
    surfaces: ['floating', 'toolbar'],
    handler: (ctx) => runProcessFlowNodeUiOnlyCallback('idea.node.pf_open_chat', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Otwiera czat Teresy z wstępnie wypełnionym kontekstem (tryb Przepływu, liczba kroków/torów, zaznaczone elementy, ostrzeżenia walidacji). Etykieta uczciwa wobec rzeczywistości (rozdz. 09 §2): to delegacja do rozmowy, NIE strukturalna zmiana danych — nie generuje propozycji, tylko wypełnia pole czatu tekstem, który człowiek może wysłać lub zmienić. DZIŚ NIEDOSTĘPNE jako osobna akcja dla Teresy (sama Teresa JEST czatem, do którego to prowadzi) — lokalny callback UI bez sensownego odpowiednika.',
    },
    source:
      'src/components/MyWork/processflow/ProcessFlowFloatingToolbar.tsx onClick → onOpenChat (~linia 145) + IdeaProcessFlowTool.tsx handleOpenChatWithContext:2371',
  },
  {
    id: 'idea.view.pf_add_decision',
    label: { pl: 'Dodaj decyzję', en: 'Add decision' },
    icon: 'GitBranch',
    scope: 'current_view',
    tools: ['process_flow'],
    surfaces: ['context'],
    handler: (ctx) => runByTool('idea.view.pf_add_decision', RUNTIME_PF_ADD_DECISION, ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'addNode() → pushUndo() w IdeaProcessFlowTool.tsx:1536 (ta sama funkcja co „Dodaj akcję").',
    },
    teresa: {
      description:
        'Dodaje nowy węzeł typu Decyzja (romb) do otwartego Przepływu. Klik człowieka z menu tła umieszcza węzeł DOKŁADNIE w miejscu prawego kliku — Teresa (bez współrzędnych ekranu) dostaje to samo `addNode(\'decision\')` BEZ pozycji, więc węzeł ląduje w domyślnym miejscu układu, nie precyzyjnie tam, gdzie „powinien" wg rozmowy. Ta sama, już istniejąca luka co Menu 3 „Dodaj element" (`idea.element.add`) — nie nowa.',
    },
    source:
      'src/components/MyWork/processflow/ProcessFlowContextMenu.tsx getCanvasContextActions „add-decision" (`onAddNode(\'decision\')`) + processflow/useProcessFlowQuickActions.ts pf_add_decision (odbiornik istniał już przed tą falą, bez wołającego z rejestru)',
  },
  {
    id: 'idea.view.pf_paste_at_point',
    label: { pl: 'Wklej elementy', en: 'Paste elements' },
    icon: 'Clipboard',
    scope: 'current_view',
    tools: ['process_flow'],
    surfaces: ['context'],
    shortcut: '⌘V',
    handler: (ctx) => runProcessFlowPaneUiOnlyCallback('idea.view.pf_paste_at_point', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'pasteClipboard() → wstawKopie() → pushUndo() w useProcessFlowNodes.ts:129.',
    },
    teresa: {
      description:
        'Wkleja zawartość schowka NARZĘDZIA Przepływu (kroki + połączenia między nimi skopiowane przez „Kopiuj"/`idea.node.pf_copy`) w miejscu kliknięcia, jako nowe elementy. Dziś dostępne WYŁĄCZNIE z menu prawego kliku na tło — schowek żyje w `useRef` przeglądarki (nie na serwerze), Teresa tego jeszcze nie wywoła. Ta sama uczciwa granica co Mapy myśli „Wklej węzły" (`idea.view.paste_at_point`).',
    },
    source:
      'src/components/MyWork/processflow/ProcessFlowContextMenu.tsx getCanvasContextActions „paste" (`onPaste` → `pasteClipboard()`) + useProcessFlowNodes.ts pasteClipboard/schowekRef',
  },
  {
    id: 'idea.lane.pf_rename',
    label: { pl: 'Zmień nazwę toru', en: 'Rename lane' },
    icon: 'Pencil',
    scope: 'lane_frame',
    tools: ['process_flow'],
    surfaces: ['inline'],
    handler: (ctx) => runLaneParamCallback('idea.lane.pf_rename', ctx, { label: ctx.params?.label }),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'handleLaneRename() → pushUndo() w useProcessFlowNodes.ts:281.',
    },
    teresa: {
      description:
        'Zmienia etykietę wskazanego toru Przepływu. W UI: podwójny klik na nazwę toru w nagłówku pasma. Podaj `laneId` i nową `label`.',
      parameters: {
        type: 'object',
        properties: {
          laneId: { type: 'string', description: 'Id toru Przepływu.' },
          label: { type: 'string', description: 'Nowa nazwa toru.' },
        },
        required: ['laneId', 'label'],
      },
    },
    source: 'src/components/MyWork/processflow/LaneSystem.tsx LaneBackground onDoubleClick → onRename prop',
  },
  {
    id: 'idea.lane.pf_move_up',
    label: { pl: 'Przesuń tor w górę', en: 'Move lane up' },
    icon: 'ArrowDownUp',
    scope: 'lane_frame',
    tools: ['process_flow'],
    surfaces: ['inline'],
    handler: (ctx) => runLaneParamCallback('idea.lane.pf_move_up', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'handleLaneMoveUp() → pushUndo() w useProcessFlowNodes.ts:348.',
    },
    teresa: {
      description:
        'Przesuwa wskazany tor o jedną pozycję w górę w kolejności torów Przepływu. Wyszarzone/bez efektu, gdy tor jest już pierwszy (tak jak dziś w nagłówku pasma). Podaj `laneId`.',
      parameters: {
        type: 'object',
        properties: { laneId: { type: 'string', description: 'Id toru Przepływu.' } },
        required: ['laneId'],
      },
    },
    source: 'src/components/MyWork/processflow/LaneSystem.tsx LaneBackground przycisk „Move up" → onMoveUp prop',
  },
  {
    id: 'idea.lane.pf_move_down',
    label: { pl: 'Przesuń tor w dół', en: 'Move lane down' },
    icon: 'ArrowDownUp',
    scope: 'lane_frame',
    tools: ['process_flow'],
    surfaces: ['inline'],
    handler: (ctx) => runLaneParamCallback('idea.lane.pf_move_down', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'handleLaneMoveDown() → pushUndo() w useProcessFlowNodes.ts:364.',
    },
    teresa: {
      description:
        'Przesuwa wskazany tor o jedną pozycję w dół w kolejności torów Przepływu. Wyszarzone/bez efektu, gdy tor jest już ostatni (tak jak dziś w nagłówku pasma). Podaj `laneId`.',
      parameters: {
        type: 'object',
        properties: { laneId: { type: 'string', description: 'Id toru Przepływu.' } },
        required: ['laneId'],
      },
    },
    source: 'src/components/MyWork/processflow/LaneSystem.tsx LaneBackground przycisk „Move down" → onMoveDown prop',
  },
  {
    id: 'idea.lane.pf_color',
    label: { pl: 'Zmień kolor toru', en: 'Change lane color' },
    icon: 'Palette',
    scope: 'lane_frame',
    tools: ['process_flow'],
    surfaces: ['inline'],
    handler: (ctx) => runLaneParamCallback('idea.lane.pf_color', ctx, { color: ctx.params?.color }),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'handleLaneColorChange() → pushUndo() w useProcessFlowNodes.ts:324.',
    },
    teresa: {
      description:
        'Ustawia kolor tła wskazanego toru Przepływu na jeden z 10 gotowych odcieni palety (`LANE_COLORS` w `LaneSystem.tsx`, hex). Podaj `laneId` i `color` (hex, np. „#dbeafe" — wartość spoza tej dziesiątki też się zapisze, ale w UI nie będzie zaznaczona jako aktywny swatch).',
      parameters: {
        type: 'object',
        properties: {
          laneId: { type: 'string', description: 'Id toru Przepływu.' },
          color: { type: 'string', description: 'Kolor tła toru (hex).' },
        },
        required: ['laneId', 'color'],
      },
    },
    source:
      'src/components/MyWork/processflow/LaneSystem.tsx LaneBackground selektor kolorów → onColorChange prop',
  },
  {
    id: 'idea.lane.pf_toggle_collapse',
    label: { pl: 'Zwiń/rozwiń tor', en: 'Collapse/expand lane' },
    icon: 'ChevronDown',
    scope: 'lane_frame',
    tools: ['process_flow'],
    surfaces: ['inline'],
    handler: (ctx) => runLaneParamCallback('idea.lane.pf_toggle_collapse', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'handleLaneToggleCollapse() → pushUndo() w IdeaProcessFlowTool.tsx:2107 (F5a A3).',
    },
    teresa: {
      description:
        'Przełącza wskazany tor Przepływu między pełnym a zwiniętym pasmem (`lanes[].collapsed`). Jeden klik = jedno przełączenie w drugą stronę — kolejne wywołanie cofa. Podaj `laneId`.',
      parameters: {
        type: 'object',
        properties: { laneId: { type: 'string', description: 'Id toru Przepływu.' } },
        required: ['laneId'],
      },
    },
    source:
      'src/components/MyWork/processflow/LaneSystem.tsx LaneBackground przycisk zwiń/rozwiń → onToggleCollapse prop',
  },
  {
    id: 'idea.lane.pf_delete',
    label: { pl: 'Usuń tor', en: 'Delete lane' },
    icon: 'X',
    scope: 'lane_frame',
    tools: ['process_flow'],
    surfaces: ['inline'],
    handler: (ctx) => runLaneParamCallback('idea.lane.pf_delete', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'handleLaneDelete() → pushUndo() w useProcessFlowNodes.ts:294 (przed reasygnacją węzłów + usunięciem toru).',
    },
    // Trwałe usunięcie toru z grafu (i przeniesienie/odpięcie jego węzłów —
    // patrz `handleLaneDelete` w `useProcessFlowNodes.ts`). Undo lokalny
    // (Ctrl+Z), stąd `destructive` osobno od `undo`, jak przy `idea.edge.delete`.
    destructive: true,
    teresa: {
      description:
        'Usuwa wskazany tor Przepływu na trwałe (jego węzły przechodzą na kolejny pozostały tor, nie znikają; cofnięcie tylko przez Ctrl+Z w tej samej sesji przeglądarki). NAPRAWIONE (G4-LANE-DELETE, 2026-08-11): na JEDYNYM pozostałym torze `handleLaneDelete` już nie wychodzi po cichu — odmawia i pokazuje użytkownikowi widoczny toast.error z konkretnym powodem (`myWorkIdeas.processFlowTool.cannotDeleteLastLane`, `useProcessFlowNodes.ts` + `IdeaProcessFlowTool.tsx`, opcja `onLaneDeleteBlocked`). ZASTRZEŻENIE: `runLaneParamCallback` (ta szyna) nadal zwraca `{ ok: true }` bezwarunkowo — dyspozycja przez `window.dispatchEvent` jest fire-and-forget i `ctx` nie niesie aktualnej liczby torów, więc odpowiedź TEKSTOWA dla Ciebie (Teresy) nie odróżnia jeszcze udanego usunięcia od odmowy na jedynym torze; sprawdzaj liczbę `existingLanes`/`lanes` z kontekstu rozmowy PRZED wywołaniem, żeby nie zapowiadać usunięcia, które w rzeczywistości zostanie odrzucone. Podaj `laneId`.',
      parameters: {
        type: 'object',
        properties: { laneId: { type: 'string', description: 'Id toru Przepływu.' } },
        required: ['laneId'],
      },
    },
    source: 'src/components/MyWork/processflow/LaneSystem.tsx LaneBackground przycisk „Delete lane" → onDelete prop',
  },
  {
    id: 'idea.view.pf_mode_classic',
    label: { pl: 'Tryb: klasyczny przepływ', en: 'Mode: classic flow' },
    icon: 'Workflow',
    scope: 'current_view',
    tools: ['process_flow'],
    surfaces: ['toolbar'],
    handler: (ctx) =>
      runToolbarBusAction('idea.view.pf_mode_classic', RUNTIME_PF_MODE_CLASSIC, ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'BRAK: `useProcessFlowUndoRedo` (`pushUndo`) zapisuje wyłącznie migawkę `{nodes, edges, lanes}` — `flowMode` nie wchodzi na stos, więc Ctrl+Z NIE cofa zmiany trybu (ani z paska, ani z czatu). Cofnięcie = ponowne przełączenie zakładki. `local_stack` podane jako najbliższa istniejąca rodzina mechanizmu (Przepływ MA stos Ctrl+Z, po prostu nie obejmuje tego pola), NIE jako potwierdzone działanie — ten sam uczciwy zapis co `idea.view.saved_view_rename`.',
    },
    teresa: {
      description:
        'Przełącza Przepływ w tryb klasyczny: paleta kroków to Start/Koniec/Akcja/Decyzja, a podpowiedź nad płótnem prowadzi przez mapowanie procesu „jak jest". Zmienia WYŁĄCZNIE tryb pracy i dostępne kształty — nie kasuje ani nie przerabia istniejących kroków (te dodane w innym trybie zostają). Tryb jest zapisywany razem z Ideą, ale NIE cofa się przez Ctrl+Z.',
    },
    runtime: RUNTIME_PF_MODE_CLASSIC,
    source:
      'src/components/MyWork/processflow/ProcessFlowToolbar.tsx role="tablist" (~linia 273-296, onClick → setFlowMode) + processflow/useProcessFlowQuickActions.ts pf_mode_classic:157 (odbiornik istniał bez wołającego)',
  },
  {
    id: 'idea.view.pf_mode_automation',
    label: { pl: 'Tryb: automatyzacja', en: 'Mode: automation' },
    icon: 'Workflow',
    scope: 'current_view',
    tools: ['process_flow'],
    surfaces: ['toolbar'],
    handler: (ctx) =>
      runToolbarBusAction('idea.view.pf_mode_automation', RUNTIME_PF_MODE_AUTOMATION, ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'BRAK — jak `idea.view.pf_mode_classic` wyżej (`flowMode` poza migawką `pushUndo`).',
    },
    teresa: {
      description:
        'Przełącza Przepływ w tryb automatyzacji: paleta zyskuje wyzwalacz, wywołanie API i warunek, a podpowiedź prowadzi przez szukanie miejsc do bezpiecznego zautomatyzowania. Nie zmienia istniejących kroków. Tryb jest zapisywany razem z Ideą, ale NIE cofa się przez Ctrl+Z.',
    },
    runtime: RUNTIME_PF_MODE_AUTOMATION,
    source:
      'src/components/MyWork/processflow/ProcessFlowToolbar.tsx role="tablist" (~linia 273-296) + processflow/useProcessFlowQuickActions.ts pf_mode_automation:158',
  },
  {
    id: 'idea.view.pf_mode_vsm',
    label: { pl: 'Tryb: strumień wartości', en: 'Mode: value stream' },
    icon: 'Workflow',
    scope: 'current_view',
    tools: ['process_flow'],
    surfaces: ['toolbar'],
    handler: (ctx) => runToolbarBusAction('idea.view.pf_mode_vsm', RUNTIME_PF_MODE_VSM, ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'BRAK — jak `idea.view.pf_mode_classic` wyżej (`flowMode` poza migawką `pushUndo`).',
    },
    teresa: {
      description:
        'Przełącza Przepływ w tryb strumienia wartości (VSM): paleta zyskuje kształty Lean (proces, zapas, dostawca, klient, kaizen, pchnij/ciągnij, supermarket, FIFO), a podpowiedź prowadzi przez pokazanie przepływu end-to-end i czasów oczekiwania. Nie zmienia istniejących kroków. Tryb jest zapisywany razem z Ideą, ale NIE cofa się przez Ctrl+Z.',
    },
    runtime: RUNTIME_PF_MODE_VSM,
    source:
      'src/components/MyWork/processflow/ProcessFlowToolbar.tsx role="tablist" (~linia 273-296) + processflow/useProcessFlowQuickActions.ts pf_mode_vsm:160',
  },
  {
    id: 'idea.view.pf_toggle_kpi',
    label: { pl: 'Wskaźniki KPI', en: 'KPI dashboard' },
    icon: 'BarChart3',
    scope: 'current_view',
    tools: ['process_flow'],
    surfaces: ['toolbar'],
    handler: (ctx) => runProcessFlowToolbarUiOnlyCallback('idea.view.pf_toggle_kpi', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Pokazuje/ukrywa panel wskaźników KPI wyliczonych z otwartego Przepływu (liczby z samego grafu, bez AI). Nie zmienia procesu. DZIŚ NIEDOSTĘPNE dla Teresy — czysty lokalny stan UI (`showKPIDashboard`), bez odbiornika na szynie.',
    },
    source:
      'src/components/MyWork/processflow/ProcessFlowToolbar.tsx menu „Więcej" → setShowKPIDashboard (~linia 480) + IdeaProcessFlowTool.tsx showKPIDashboard:435/3476',
  },
  {
    id: 'idea.view.pf_validate',
    // ★ Rozdz. 09 §5 wprost: walidacja Przepływu to heurystyka bez LLM i NIE
    // wolno jej nazwać „AI". Etykieta poniżej (i ta w pasku, `Validate`/
    // „Waliduj") są z tym zgodne — sprawdzone, nie zakładane:
    // `validateFlowWarnings` (`validateFlow.ts`) to czyste reguły na grafie.
    label: { pl: 'Waliduj strukturę', en: 'Validate structure' },
    icon: 'AlertTriangle',
    scope: 'current_view',
    tools: ['process_flow'],
    surfaces: ['toolbar'],
    handler: (ctx) => runProcessFlowToolbarUiOnlyCallback('idea.view.pf_validate', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Sprawdza STRUKTURĘ otwartego Przepływu regułami (brak startu/końca, wiszące kroki, decyzja bez wyjść itp.) i pokazuje listę ostrzeżeń. To NIE jest AI — żadnego modelu językowego tu nie ma, to zwykłe reguły na grafie; nie myl z „AI: analiza procesu", która szuka wąskich gardeł modelem. Nic nie zmienia. DZIŚ NIEDOSTĘPNE dla Teresy — brak odbiornika na szynie (`runValidation` to lokalny callback).',
    },
    source:
      'src/components/MyWork/processflow/ProcessFlowToolbar.tsx menu „Więcej" → runValidation (~linia 492) + IdeaProcessFlowTool.tsx runValidation:2131 → validateFlowWarnings (processflow/validateFlow.ts, heurystyka bez LLM)',
  },
  {
    id: 'idea.ai.pf_process_summary',
    label: { pl: 'AI: podsumowanie procesu (tylko odczyt)', en: 'AI: process summary (read-only)' },
    icon: 'BarChart3',
    scope: 'current_view',
    tools: ['process_flow'],
    surfaces: ['toolbar'],
    handler: (ctx) =>
      runToolbarBusAction('idea.ai.pf_process_summary', RUNTIME_PF_PROCESS_SUMMARY, ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      // Rozdz. 09 §6 wymaga wprost oznaczenia „AI (tylko odczyt)" dla tej i dla
      // AI Coacha — obie tam wymienione imiennie jako „nie modyfikują canvasu".
      description:
        'Generuje podsumowanie otwartego Przepływu REALNYM modelem (generator `process_summary`): liczba kroków i decyzji, tory, ścieżka krytyczna, szacowany czas, ryzyka i rekomendacje. Wynik jest TYLKO DO ODCZYTU — pokazuje się w panelu i NIE zmienia ani jednego kroku na płótnie, więc nie ma tu nic do zatwierdzania ani cofania. Nie myl z „Waliduj strukturę" (reguły, bez modelu).',
    },
    runtime: RUNTIME_PF_PROCESS_SUMMARY,
    source:
      'src/components/MyWork/processflow/ProcessFlowToolbar.tsx menu „Więcej" → generateSummary (~linia 523) + IdeaProcessFlowTool.tsx handleProcessSummary:2196 → ideaAIGenerator.generateProcessSummary → Api.generateIdeaAI(process_summary) → llmService.callStructured (realny LLM, zweryfikowane do serwera włącznie) + processflow/useProcessFlowQuickActions.ts pf_summary (NOWY odbiornik, 2026-08-10)',
  },
  {
    id: 'idea.view.pf_readback',
    label: { pl: 'Odczyt zwrotny', en: 'Readback' },
    icon: 'ScanText',
    scope: 'current_view',
    tools: ['process_flow'],
    surfaces: ['toolbar'],
    handler: (ctx) => runProcessFlowToolbarUiOnlyCallback('idea.view.pf_readback', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Otwiera „odczyt zwrotny" — opis otwartego Przepływu zdaniami, do przeczytania klientowi na potwierdzenie, że dobrze zrozumieliśmy proces. Powstaje LOKALNIE z grafu (deterministycznie, bez modelu językowego — mirror serwerowy został wycięty), więc etykieta słusznie nie mówi „AI". Nic nie zmienia. DZIŚ NIEDOSTĘPNE dla Teresy — brak odbiornika na szynie.',
    },
    source:
      'src/components/MyWork/processflow/ProcessFlowToolbar.tsx menu „Więcej" → onOpenReadback (~linia 543) + IdeaProcessFlowTool.tsx setShowReadbackPanel+fetchReadback:2893 + processflow/useProcessFlowReadback.ts generateReadback (klient, bez LLM)',
  },
  {
    id: 'idea.view.pf_open_ai_proposal',
    // Etykieta nazywa RZECZYWISTY efekt (rozdz. 09 §2: zakaz ogólnego „AI"
    // obiecującego więcej, niż akcja robi) — samo kliknięcie NIC nie generuje,
    // tylko otwiera panel, w którym człowiek wpisuje polecenie i dopiero
    // wtedy rusza generator z podglądem propozycji.
    label: { pl: 'Otwórz panel propozycji AI', en: 'Open AI proposal panel' },
    icon: 'Sparkles',
    scope: 'current_view',
    tools: ['process_flow'],
    surfaces: ['toolbar'],
    handler: (ctx) => runProcessFlowToolbarUiOnlyCallback('idea.view.pf_open_ai_proposal', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Otwiera panel propozycji AI Przepływu. SAMO otwarcie nic nie generuje i nic nie zmienia — dopiero polecenie wpisane w panelu uruchamia generator, a jego wynik i tak trzeba zatwierdzić w podglądzie. DZIŚ NIEDOSTĘPNE dla Teresy — lokalny stan UI (`showAIPanel`), bez odbiornika na szynie; jeśli użytkownik chce, żeby AI coś zaproponowała, wywołaj właściwą akcję generującą zamiast otwierać panel.',
    },
    source:
      'src/components/MyWork/processflow/ProcessFlowToolbar.tsx menu „Więcej" → onOpenAIProposal (~linia 557, za stałą AI_PROPOSAL_ENABLED) + IdeaProcessFlowTool.tsx setShowAIPanel:2898',
  },
  {
    id: 'idea.node.pf_convert_task_set',
    label: { pl: 'Konwertuj na zestaw zadań', en: 'Convert to task set' },
    icon: 'Rocket',
    scope: 'single_item',
    tools: ['process_flow'],
    surfaces: ['toolbar'],
    handler: (ctx) =>
      runProcessFlowConvertTargetCallback('idea.node.pf_convert_task_set', 'task_set', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'manual_delete',
      evidence:
        'Api.convertMyIdea → nowe rekordy Task; brak automatycznego cofnięcia (ten sam wzorzec co idea.node.pf_convert_initiative / idea.workspace.convert).',
    },
    destructive: false,
    teresa: {
      description:
        'Zamienia kroki Przepływu w zestaw zadań — tworzy nowe, trwałe rekordy zadań. Ta sama uczciwa uwaga co przy konwersji na Inicjatywę: klik człowieka w menu wysyła pole `selectedIds`, którego powłoka nigdy nie czyta, więc UI konwertuje bieżące zaznaczenie płótna; wywołanie z czatu omija tę wadliwą ścieżkę i używa `nodeId`, który podasz. Brak podglądu przed konwersją (przedistniejące, rozdz. 10 §2.2 wymaga go docelowo). Podaj `nodeId`.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Id kroku Przepływu do konwersji.' },
        },
        required: ['nodeId'],
      },
      confirmBeforeRun: true,
    },
    source:
      'src/components/MyWork/processflow/ProcessFlowToolbar.tsx grupa „Konwertuj" pozycja pf_convert_task_set (~linia 646) → onConvert → IdeaProcessFlowTool.handleConvert:2385 → IdeaMapWorkspace.tsx CONVERT_PREFIX_MAP:1030 (target task_set, `live` w ideaConvertTargets.ts) + Api.convertMyIdea (ścieżka Teresy, wprost)',
  },
  {
    id: 'idea.node.pf_convert_report',
    label: { pl: 'Konwertuj na raport', en: 'Convert to report' },
    icon: 'Rocket',
    scope: 'single_item',
    tools: ['process_flow'],
    surfaces: ['toolbar'],
    handler: (ctx) =>
      runProcessFlowConvertTargetCallback('idea.node.pf_convert_report', 'report', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'manual_delete',
      evidence:
        'Api.convertMyIdea → nowy rekord Report; brak automatycznego cofnięcia (jak wyżej).',
    },
    destructive: false,
    teresa: {
      description:
        'Generuje raport z Przepływu — tworzy nowy, trwały dokument. Ta sama uczciwa uwaga o `selectedIds` co przy pozostałych konwersjach Przepływu. Brak podglądu przed konwersją. Podaj `nodeId`.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Id kroku Przepływu do konwersji.' },
        },
        required: ['nodeId'],
      },
      confirmBeforeRun: true,
    },
    source:
      'src/components/MyWork/processflow/ProcessFlowToolbar.tsx grupa „Konwertuj" pozycja pf_convert_report (~linia 650) → onConvert → IdeaProcessFlowTool.handleConvert:2385 → IdeaMapWorkspace.tsx CONVERT_PREFIX_MAP:1031 (target report, `live`) + Api.convertMyIdea (ścieżka Teresy, wprost)',
  },
  {
    id: 'idea.node.pf_convert_analysis',
    // ★ ZNALEZIONE PRZY OKABLOWANIU, ZALOGOWANE, NIE UKRYTE I NIE „POPRAWIONE
    // PO CICHU": ta pozycja menu jest MARTWA — pełny łańcuch dowodowy przy
    // `runProcessFlowConvertAnalysisCallback` wyżej. Klik ZAWSZE kończy się
    // czerwonym toastem („ten cel konwersji jeszcze nie…"), bo target
    // `analysis` został usunięty z `IDEA_CONVERT_TARGETS` w audycie Z3
    // 2026-07-24, a `ProcessFlowToolbar.tsx` nigdy o tym nie usłyszał.
    // Etykieta nazywa stan faktyczny, żeby nikt nie odczytał wpisu jako
    // potwierdzenia, że funkcja działa.
    label: { pl: 'Konwertuj na analizę (niedostępne)', en: 'Convert to analysis (unavailable)' },
    icon: 'Rocket',
    scope: 'single_item',
    tools: ['process_flow'],
    surfaces: ['toolbar'],
    handler: (ctx) => runProcessFlowConvertAnalysisCallback(ctx),
    // `mutates: false` = opis RZECZYWISTOŚCI, nie zamiaru: ta akcja dziś nigdy
    // niczego nie tworzy ani nie zmienia (patrz łańcuch wyżej), więc nie ma
    // czego cofać i deklarowanie `undo` byłoby opisem nieistniejącego skutku.
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        '★ NIE DZIAŁA — nie wywołuj tej akcji. Pozycja „Analiza" w menu Konwertuj paska Przepływu prowadzi do celu konwersji (`analysis`), który został wycofany z produktu (serwer nie ma dla niego obsługi), więc kliknięcie kończy się wyłącznie komunikatem o błędzie i niczego nie tworzy. Wpis istnieje w rejestrze po to, żeby ta martwa pozycja była WIDOCZNA jako defekt do naprawy, a nie żeby ją udostępniać. Jeśli użytkownik prosi o analizę procesu, użyj „AI: analiza procesu" (wąskie gardła i luki, tylko odczyt).',
    },
    source:
      'src/components/MyWork/processflow/ProcessFlowToolbar.tsx grupa „Konwertuj" pozycja pf_convert_analysis (~linia 651) → onConvert → IdeaProcessFlowTool.handleConvert:2385 → IdeaMapWorkspace.tsx CONVERT_PREFIX_MAP:1032 (target `analysis`) → handleConvert:2202 `IDEA_CONVERT_TARGETS.some(...)` FALSE → toast.error. Target usunięty w ideaConvertTargets.ts (audyt Z3 2026-07-24, komentarz w tablicy wymienia `analysis` imiennie).',
  },
  {
    id: 'idea.view.pf_add_start',
    label: { pl: 'Dodaj pierwszy krok', en: 'Add first step' },
    icon: 'Plus',
    scope: 'current_view',
    tools: ['process_flow'],
    surfaces: ['inline'],
    // `ctx.params.vsm` (opcjonalny bool) wybiera runtime: pusty canvas w
    // trybie VSM potrzebuje węzła 'vsm_process', każdy inny tryb — 'start'.
    // To NIE jest ta sama akcja co `idea.element.add` (patrz komentarz przy
    // `RUNTIME_PF_ADD_START` wyżej — shape mismatch, świadomie NOWY id).
    handler: (ctx) =>
      runByTool(
        'idea.view.pf_add_start',
        ctx.params?.vsm === true ? RUNTIME_PF_ADD_VSM_PROCESS : RUNTIME_PF_ADD_START,
        ctx
      ),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'addNode() → pushUndo() w IdeaProcessFlowTool.tsx:1536 (ta sama funkcja co „Dodaj akcję"/„Dodaj decyzję").',
    },
    teresa: {
      description:
        'Dodaje pierwszy element do pustego Przepływu: węzeł Start (klasyczny/automatyzacja/BPMN/system/organizacja) albo Proces (w trybie VSM). Bez współrzędnych ekranu — węzeł ląduje w domyślnym miejscu układu, ta sama uczciwa granica co „Dodaj element"/„Dodaj decyzję".',
      parameters: {
        type: 'object',
        properties: {
          vsm: {
            type: 'boolean',
            description: 'true, jeśli otwarty Przepływ jest w trybie VSM (dodaje węzeł Proces zamiast Start).',
          },
        },
      },
    },
    source:
      'src/components/MyWork/IdeaProcessFlowTool.tsx empty-state CTA "addStart" (~L3458, `addNode(flowMode === \'vsm\' ? \'vsm_process\' : \'start\')`) + processflow/useProcessFlowQuickActions.ts pf_add_start/pf_add_vsm_process (odbiorniki istniały już przed tą falą, bez wołającego z rejestru)',
  },
  {
    // NOWY wpis (2026-08-10, reconciliacja skrótów) — Przepływu Ctrl/Cmd+S
    // (`useIdeasToolKeyboard.ts`'s `onSave` w `IdeaProcessFlowTool.tsx`) woła
    // WŁASNY `handleSave` (~L2352) — SPRAWDZONE grepem: żaden przycisk paska
    // (`ProcessFlowToolbar.tsx`) go nie wywołuje, wyłącznie klawiatura (plus
    // druga, typing-safe kopia tego samego skrótu w PF-specific listenerze
    // ~L2501-2505, poza zakresem tego wpisu — nie duplikuje mutacji, tylko
    // pozwala skrótowi zadziałać z fokusem w polu tekstowym). Osobny id od
    // `idea.canvas.save` (Tablicy) — inna funkcja, inna powierzchnia, zero
    // dziś zweryfikowanego reuse.
    id: 'idea.canvas.pf_save',
    label: { pl: 'Zapisz', en: 'Save' },
    icon: 'Save',
    scope: 'current_view',
    tools: ['process_flow'],
    surfaces: ['keyboard'],
    shortcut: '⌘S',
    handler: (ctx) => runKeyboardOnlyCallback('idea.canvas.pf_save', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Zapisuje bieżący stan Przepływu natychmiast (poza automatycznym zapisem w tle). Dziś dostępne WYŁĄCZNIE ze skrótu klawiszowego — Teresa tego jeszcze nie wywoła.',
    },
    source: 'src/components/MyWork/IdeaProcessFlowTool.tsx:2352 (handleSave) + useCanvasKeyboard onSave (~L2463)',
  },
];
