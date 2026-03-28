import type {
  CanvasGovernanceUpdate,
  CanvasToolType,
  IdeaWorkspaceInsertItem,
} from '../ideaSelectionTypes';

export type CanvasOsCapability = 'real' | 'partial' | 'scaffold' | 'missing' | 'out_of_scope';
export type CanvasOsPanelId =
  | 'insert'
  | 'templates'
  | 'themes'
  | 'data'
  | 'facilitation'
  | 'share'
  | 'ai';

export type ProcessFlowSemanticKit = 'classic' | 'automation' | 'vsm' | 'bpmn' | 'system' | 'org';

export type CanvasOsActionKind =
  | 'quick_action'
  | 'insert'
  | 'theme'
  | 'flow_semantic'
  | 'apply_template'
  | 'generate_ai'
  | 'governance_update'
  | 'open_templates'
  | 'open_export'
  | 'open_ai'
  | 'toggle_voting'
  | 'open_context'
  | 'open_tools'
  | 'chat_prompt';

export interface CanvasOsRailItem {
  id: CanvasOsPanelId;
  icon: string;
  labelEn: string;
  labelPl: string;
  descriptionEn: string;
  descriptionPl: string;
  capability: CanvasOsCapability;
}

export const CANVAS_OS_CAPABILITY_LABELS: Record<CanvasOsCapability, { en: string; pl: string }> = {
  real: { en: 'Real', pl: 'Real' },
  partial: { en: 'Partial', pl: 'Partial' },
  scaffold: { en: 'Scaffold', pl: 'Scaffold' },
  missing: { en: 'Missing', pl: 'Missing' },
  out_of_scope: { en: 'Out of scope', pl: 'Out of scope' },
};

export interface CanvasOsAction {
  id: string;
  icon: string;
  labelEn: string;
  labelPl: string;
  descEn: string;
  descPl: string;
  capability: CanvasOsCapability;
  kind: CanvasOsActionKind;
  quickAction?: string;
  themeId?: string;
  flowSemantic?: ProcessFlowSemanticKit;
  templateId?: string;
  generatorType?: string;
  governanceUpdate?: CanvasGovernanceUpdate;
  insertItems?: IdeaWorkspaceInsertItem[];
  chatPromptEn?: string;
  chatPromptPl?: string;
}

export const CANVAS_OS_RAIL: CanvasOsRailItem[] = [
  {
    id: 'insert',
    icon: 'Plus',
    labelEn: 'Insert',
    labelPl: 'Wstaw',
    descriptionEn: 'Shapes, nodes, starters',
    descriptionPl: 'Kształty, węzły, startery',
    capability: 'real',
  },
  {
    id: 'templates',
    icon: 'LayoutTemplate',
    labelEn: 'Templates',
    labelPl: 'Szablony',
    descriptionEn: 'Guided starts and libraries',
    descriptionPl: 'Guided starts i biblioteki',
    capability: 'real',
  },
  {
    id: 'themes',
    icon: 'Palette',
    labelEn: 'Themes',
    labelPl: 'Motywy',
    descriptionEn: 'Canvas visual systems',
    descriptionPl: 'Systemy wizualne canvasa',
    capability: 'partial',
  },
  {
    id: 'data',
    icon: 'Database',
    labelEn: 'Data',
    labelPl: 'Dane',
    descriptionEn: 'Smart objects and linked starters',
    descriptionPl: 'Smart objecty i linked startery',
    capability: 'partial',
  },
  {
    id: 'facilitation',
    icon: 'Users',
    labelEn: 'Session',
    labelPl: 'Sesja',
    descriptionEn: 'Voting, review, facilitation',
    descriptionPl: 'Głosowanie, review, facylitacja',
    capability: 'partial',
  },
  {
    id: 'share',
    icon: 'Share2',
    labelEn: 'Share',
    labelPl: 'Udostępnij',
    descriptionEn: 'Export and structured outputs',
    descriptionPl: 'Eksport i structured outputs',
    capability: 'real',
  },
  {
    id: 'ai',
    icon: 'Sparkles',
    labelEn: 'AI',
    labelPl: 'AI',
    descriptionEn: 'Governed suggestions and prompts',
    descriptionPl: 'Governowane sugestie i prompty',
    capability: 'real',
  },
];

const SMART_OBJECT_INSERTS: CanvasOsAction[] = [
  {
    id: 'data-role',
    icon: 'UserSquare2',
    labelEn: 'Role owner',
    labelPl: 'Właściciel roli',
    descEn: 'Insert a role anchor to link later with execution objects.',
    descPl: 'Wstaw anchor roli do późniejszego podpięcia pod execution.',
    capability: 'real',
    kind: 'insert',
    insertItems: [
      {
        label: 'Role owner',
        type: 'role',
        data: {
          semanticType: 'role',
          smartObjectType: 'role',
          artifactRole: 'related',
        },
      },
    ],
  },
  {
    id: 'data-system',
    icon: 'Server',
    labelEn: 'System object',
    labelPl: 'Obiekt systemowy',
    descEn: 'Insert a system node for architecture and process mapping.',
    descPl: 'Wstaw węzeł systemowy do mapowania architektury i procesu.',
    capability: 'real',
    kind: 'insert',
    insertItems: [
      {
        label: 'System',
        type: 'system',
        data: {
          semanticType: 'system',
          smartObjectType: 'system',
          artifactRole: 'context',
        },
      },
    ],
  },
  {
    id: 'data-kpi',
    icon: 'Gauge',
    labelEn: 'KPI object',
    labelPl: 'Obiekt KPI',
    descEn: 'Insert a KPI node to connect metrics with the diagram.',
    descPl: 'Wstaw węzeł KPI, aby spiąć metryki z diagramem.',
    capability: 'real',
    kind: 'insert',
    insertItems: [
      {
        label: 'KPI',
        type: 'kpi',
        data: {
          semanticType: 'kpi',
          smartObjectType: 'kpi',
          artifactRole: 'evidence',
        },
      },
    ],
  },
  {
    id: 'data-initiative',
    icon: 'Flag',
    labelEn: 'Initiative object',
    labelPl: 'Obiekt inicjatywy',
    descEn: 'Insert a delivery-oriented starter for execution traceability.',
    descPl: 'Wstaw starter inicjatywy pod execution traceability.',
    capability: 'real',
    kind: 'insert',
    insertItems: [
      {
        label: 'Initiative',
        type: 'initiative',
        data: {
          semanticType: 'initiative',
          smartObjectType: 'initiative',
          artifactRole: 'output',
        },
      },
    ],
  },
  {
    id: 'data-decision',
    icon: 'Scale',
    labelEn: 'Decision object',
    labelPl: 'Obiekt decyzji',
    descEn: 'Insert a decision marker to promote later into a tracked artifact.',
    descPl: 'Wstaw marker decyzji do późniejszej promocji na artefakt.',
    capability: 'real',
    kind: 'insert',
    insertItems: [
      {
        label: 'Decision',
        type: 'decision',
        data: {
          semanticType: 'decision',
          smartObjectType: 'decision',
          artifactRole: 'related',
        },
      },
    ],
  },
  {
    id: 'data-linked-open-context',
    icon: 'PanelRightOpen',
    labelEn: 'Open context links',
    labelPl: 'Otwórz linki kontekstowe',
    descEn: 'Jump to the existing context panel for backlinks and used-in flows.',
    descPl: 'Przejdź do obecnego panelu context dla backlinków i used-in.',
    capability: 'real',
    kind: 'open_context',
  },
];

function getInsertActions(tool: CanvasToolType): CanvasOsAction[] {
  if (tool === 'mindmap') {
    return [
      {
        id: 'mm-branch',
        icon: 'GitBranch',
        labelEn: 'Branch',
        labelPl: 'Gałąź',
        descEn: 'Add a new child branch to the current thought.',
        descPl: 'Dodaj nową gałąź potomną do bieżącej myśli.',
        capability: 'real',
        kind: 'quick_action',
        quickAction: 'mm_add_child',
      },
      {
        id: 'mm-sibling',
        icon: 'Split',
        labelEn: 'Sibling',
        labelPl: 'Poziom obok',
        descEn: 'Add a sibling branch next to the selected node.',
        descPl: 'Dodaj gałąź równoległą do zaznaczonego węzła.',
        capability: 'real',
        kind: 'quick_action',
        quickAction: 'mm_add_sibling',
      },
      {
        id: 'mm-knowledge',
        icon: 'BookOpen',
        labelEn: 'Knowledge card',
        labelPl: 'Karta wiedzy',
        descEn: 'Attach a structured knowledge card to the map.',
        descPl: 'Dołącz ustrukturyzowaną kartę wiedzy do mapy.',
        capability: 'real',
        kind: 'quick_action',
        quickAction: 'mm_add_knowledge',
      },
      {
        id: 'mm-evidence',
        icon: 'BadgeCheck',
        labelEn: 'Evidence card',
        labelPl: 'Karta dowodu',
        descEn: 'Add an evidence marker for traceable reasoning.',
        descPl: 'Dodaj marker dowodu dla traceable reasoning.',
        capability: 'real',
        kind: 'quick_action',
        quickAction: 'mm_add_evidence',
      },
      {
        id: 'mm-note',
        icon: 'NotebookPen',
        labelEn: 'Note card',
        labelPl: 'Karta notatki',
        descEn: 'Capture an inline note without leaving the map.',
        descPl: 'Dodaj notatkę inline bez wychodzenia z mapy.',
        capability: 'real',
        kind: 'quick_action',
        quickAction: 'mm_add_note',
      },
    ];
  }

  if (tool === 'whiteboard') {
    return [
      {
        id: 'wb-sticky',
        icon: 'StickyNote',
        labelEn: 'Sticky note',
        labelPl: 'Sticky note',
        descEn: 'Add a sticky for workshop capture.',
        descPl: 'Dodaj sticky do pracy warsztatowej.',
        capability: 'real',
        kind: 'quick_action',
        quickAction: 'wb_add_sticky',
      },
      {
        id: 'wb-text',
        icon: 'Type',
        labelEn: 'Text block',
        labelPl: 'Blok tekstu',
        descEn: 'Insert free-form text annotation.',
        descPl: 'Wstaw swobodny blok tekstowy.',
        capability: 'real',
        kind: 'quick_action',
        quickAction: 'wb_add_text',
      },
      {
        id: 'wb-frame',
        icon: 'Frame',
        labelEn: 'Frame',
        labelPl: 'Ramka',
        descEn: 'Create a frame to group a workshop area.',
        descPl: 'Stwórz ramkę do zgrupowania obszaru warsztatu.',
        capability: 'real',
        kind: 'quick_action',
        quickAction: 'wb_add_frame',
      },
      {
        id: 'wb-theme',
        icon: 'Shapes',
        labelEn: 'Theme block',
        labelPl: 'Blok tematu',
        descEn: 'Insert a semantic theme block for clustering.',
        descPl: 'Wstaw semantyczny blok tematu do klasteryzacji.',
        capability: 'real',
        kind: 'quick_action',
        quickAction: 'wb_add_theme',
      },
      {
        id: 'wb-action',
        icon: 'Rocket',
        labelEn: 'Action sticky',
        labelPl: 'Sticky akcji',
        descEn: 'Add an action-oriented sticky for next steps.',
        descPl: 'Dodaj sticky akcji dla kolejnych kroków.',
        capability: 'real',
        kind: 'quick_action',
        quickAction: 'wb_add_action',
      },
    ];
  }

  if (tool === 'process_flow') {
    return [
      {
        id: 'pf-start',
        icon: 'CircleDot',
        labelEn: 'Start step',
        labelPl: 'Krok startowy',
        descEn: 'Insert a start marker into the active process lane.',
        descPl: 'Wstaw znacznik startu do aktywnej ścieżki procesu.',
        capability: 'real',
        kind: 'quick_action',
        quickAction: 'pf_add_start',
      },
      {
        id: 'pf-action',
        icon: 'Square',
        labelEn: 'Action step',
        labelPl: 'Krok akcji',
        descEn: 'Insert a standard process action.',
        descPl: 'Wstaw standardową akcję procesu.',
        capability: 'real',
        kind: 'quick_action',
        quickAction: 'pf_add_action',
      },
      {
        id: 'pf-decision',
        icon: 'Diamond',
        labelEn: 'Decision',
        labelPl: 'Decyzja',
        descEn: 'Insert a branching decision node.',
        descPl: 'Wstaw węzeł decyzji rozgałęziającej.',
        capability: 'real',
        kind: 'quick_action',
        quickAction: 'pf_add_decision',
      },
      {
        id: 'pf-lane',
        icon: 'Rows3',
        labelEn: 'Lane',
        labelPl: 'Swimlane',
        descEn: 'Add another ownership lane to the process.',
        descPl: 'Dodaj kolejną swimlane do procesu.',
        capability: 'real',
        kind: 'quick_action',
        quickAction: 'pf_add_lane',
      },
      {
        id: 'pf-automation',
        icon: 'Zap',
        labelEn: 'Automation trigger',
        labelPl: 'Trigger automatyzacji',
        descEn: 'Switch to automation mode and insert a real trigger node.',
        descPl: 'Przełącz na tryb automatyzacji i wstaw realny trigger.',
        capability: 'real',
        kind: 'quick_action',
        quickAction: 'pf_insert_automation_trigger',
      },
      {
        id: 'pf-vsm',
        icon: 'Box',
        labelEn: 'VSM process',
        labelPl: 'Proces VSM',
        descEn: 'Add a VSM process block for value-stream mapping.',
        descPl: 'Dodaj blok procesu VSM do value-stream mappingu.',
        capability: 'real',
        kind: 'quick_action',
        quickAction: 'pf_add_vsm_process',
      },
      {
        id: 'pf-bpmn-event',
        icon: 'CircleDot',
        labelEn: 'BPMN event',
        labelPl: 'Zdarzenie BPMN',
        descEn: 'Insert a BPMN event for typed process notation.',
        descPl: 'Wstaw zdarzenie BPMN dla typowanej notacji procesu.',
        capability: 'real',
        kind: 'quick_action',
        quickAction: 'pf_add_bpmn_event',
      },
      {
        id: 'pf-bpmn-task',
        icon: 'Square',
        labelEn: 'BPMN task',
        labelPl: 'Zadanie BPMN',
        descEn: 'Insert a BPMN task with typed semantics.',
        descPl: 'Wstaw zadanie BPMN z typowaną semantyką.',
        capability: 'real',
        kind: 'quick_action',
        quickAction: 'pf_add_bpmn_task',
      },
      {
        id: 'pf-bpmn-gateway',
        icon: 'Diamond',
        labelEn: 'BPMN gateway',
        labelPl: 'Bramka BPMN',
        descEn: 'Insert a BPMN gateway for branching logic.',
        descPl: 'Wstaw bramkę BPMN dla logiki rozgałęzień.',
        capability: 'real',
        kind: 'quick_action',
        quickAction: 'pf_add_bpmn_gateway',
      },
      {
        id: 'pf-system-service',
        icon: 'Box',
        labelEn: 'System service',
        labelPl: 'Serwis systemowy',
        descEn: 'Insert a system service node for architecture mapping.',
        descPl: 'Wstaw węzeł serwisu do mapowania architektury.',
        capability: 'real',
        kind: 'quick_action',
        quickAction: 'pf_add_system_service',
      },
      {
        id: 'pf-system-db',
        icon: 'Database',
        labelEn: 'System data store',
        labelPl: 'Magazyn danych',
        descEn: 'Insert a typed data store node.',
        descPl: 'Wstaw typowany węzeł magazynu danych.',
        capability: 'real',
        kind: 'quick_action',
        quickAction: 'pf_add_system_db',
      },
      {
        id: 'pf-org-role',
        icon: 'UserSquare2',
        labelEn: 'Org role',
        labelPl: 'Rola organizacyjna',
        descEn: 'Insert a role node for org design and handoffs.',
        descPl: 'Wstaw węzeł roli dla projektowania organizacji i przekazań.',
        capability: 'real',
        kind: 'quick_action',
        quickAction: 'pf_add_org_role',
      },
      {
        id: 'pf-org-team',
        icon: 'Building2',
        labelEn: 'Org team',
        labelPl: 'Zespół',
        descEn: 'Insert an org team cluster anchor.',
        descPl: 'Wstaw anchor zespołu organizacyjnego.',
        capability: 'real',
        kind: 'quick_action',
        quickAction: 'pf_add_org_team',
      },
    ];
  }

  return [
    {
      id: 'tbl-row',
      icon: 'Rows3',
      labelEn: 'Table row',
      labelPl: 'Wiersz tabeli',
      descEn: 'Insert a new structured row starter.',
      descPl: 'Wstaw nowy starter wiersza strukturalnego.',
      capability: 'real',
      kind: 'insert',
      insertItems: [{ label: 'New row', type: 'row' }],
    },
    {
      id: 'tbl-decision',
      icon: 'Scale',
      labelEn: 'Decision row',
      labelPl: 'Wiersz decyzji',
      descEn: 'Insert a row that can later become a tracked decision.',
      descPl: 'Wstaw wiersz, który później może stać się decyzją.',
      capability: 'real',
      kind: 'insert',
      insertItems: [{ label: 'Decision row', type: 'decision' }],
    },
  ];
}

function getTemplateActions(tool: CanvasToolType): CanvasOsAction[] {
  const base: CanvasOsAction[] = [
    {
      id: 'templates-open',
      icon: 'LayoutTemplate',
      labelEn: 'Template gallery',
      labelPl: 'Galeria szablonów',
      descEn: 'Open the existing template gallery for this workspace.',
      descPl: 'Otwórz obecną galerię szablonów dla tego workspace.',
      capability: 'real',
      kind: 'open_templates',
    },
  ];

  if (tool === 'process_flow') {
    return [
      ...base,
      {
        id: 'tpl-process-improvement',
        icon: 'Workflow',
        labelEn: 'Process improvement starter',
        labelPl: 'Starter usprawnienia procesu',
        descEn:
          'Apply a real process-improvement starter with current state, bottlenecks, and KPI review.',
        descPl:
          'Zastosuj realny starter usprawnienia procesu ze stanem obecnym, bottleneckami i review KPI.',
        capability: 'real',
        kind: 'apply_template',
        templateId: 'pf-process-improvement',
      },
      {
        id: 'tpl-bpmn',
        icon: 'Network',
        labelEn: 'BPMN starter',
        labelPl: 'Starter BPMN',
        descEn: 'Apply a typed BPMN starter with real event, task, and gateway nodes.',
        descPl: 'Zastosuj typowany starter BPMN z realnymi eventami, zadaniami i bramką.',
        capability: 'real',
        kind: 'apply_template',
        templateId: 'pf-bpmn-approval',
      },
      {
        id: 'tpl-system-map',
        icon: 'Server',
        labelEn: 'System map starter',
        labelPl: 'Starter mapy systemów',
        descEn: 'Apply a typed system-map starter with actor, service, and datastore.',
        descPl: 'Zastosuj typowany starter mapy systemów z aktorem, serwisem i datastore.',
        capability: 'real',
        kind: 'apply_template',
        templateId: 'pf-system-map',
      },
      {
        id: 'tpl-org-map',
        icon: 'Users',
        labelEn: 'Org flow starter',
        labelPl: 'Starter przepływu organizacyjnego',
        descEn: 'Apply a typed org-flow starter for roles, teams, and handoffs.',
        descPl:
          'Zastosuj typowany starter przepływu organizacyjnego dla ról, zespołów i handoffów.',
        capability: 'real',
        kind: 'apply_template',
        templateId: 'pf-org-handoffs',
      },
    ];
  }

  if (tool === 'whiteboard') {
    return [
      ...base,
      {
        id: 'tpl-brainstorm',
        icon: 'Lightbulb',
        labelEn: 'Brainstorm starter',
        labelPl: 'Starter brainstormingu',
        descEn: 'Generate a workshop prompt for idea expansion.',
        descPl: 'Wygeneruj prompt warsztatowy do rozwijania pomysłu.',
        capability: 'real',
        kind: 'chat_prompt',
        chatPromptEn:
          'Prepare a brainstorming workshop starter for this idea with clusters, prompts, and next-step zones.',
        chatPromptPl:
          'Przygotuj starter warsztatu brainstormingowego dla tego pomysłu z klastrami, promptami i strefami next steps.',
      },
      {
        id: 'tpl-affinity',
        icon: 'Group',
        labelEn: 'Affinity mapping',
        labelPl: 'Affinity mapping',
        descEn: 'Guide the team into an affinity-clustering workshop.',
        descPl: 'Wprowadź zespół w warsztat affinity-clustering.',
        capability: 'real',
        kind: 'chat_prompt',
        chatPromptEn:
          'Create an affinity mapping workshop outline with capture, cluster, insight, and decision zones.',
        chatPromptPl:
          'Stwórz outline warsztatu affinity mapping z sekcjami capture, cluster, insight i decision.',
      },
    ];
  }

  return [
    ...base,
    {
      id: 'tpl-strategy',
      icon: 'Map',
      labelEn: 'Strategy map starter',
      labelPl: 'Starter mapy strategicznej',
      descEn: 'Ask AI for a structured strategy-map starter in the current workspace.',
      descPl: 'Poproś AI o ustrukturyzowany starter mapy strategicznej w tym workspace.',
      capability: 'real',
      kind: 'chat_prompt',
      chatPromptEn:
        'Create a structured strategy-map starter for this idea with objectives, dependencies, risks, and execution next steps.',
      chatPromptPl:
        'Stwórz ustrukturyzowany starter mapy strategicznej dla tego pomysłu z celami, zależnościami, ryzykami i execution next steps.',
    },
  ];
}

function getThemeActions(tool: CanvasToolType): CanvasOsAction[] {
  const generic: CanvasOsAction[] = [
    {
      id: 'theme-ops',
      icon: 'Palette',
      labelEn: 'Operations theme',
      labelPl: 'Motyw operacyjny',
      descEn: 'Apply an operations-oriented canvas visual system.',
      descPl: 'Zastosuj operacyjny system wizualny canvasa.',
      capability: tool === 'table' ? 'scaffold' : 'partial',
      kind: 'theme',
      themeId: 'ops',
    },
    {
      id: 'theme-workshop',
      icon: 'Brush',
      labelEn: 'Workshop theme',
      labelPl: 'Motyw warsztatowy',
      descEn: 'Apply a workshop-friendly view with stronger grouping affordances.',
      descPl: 'Zastosuj widok warsztatowy z mocniejszymi affordance do grupowania.',
      capability: tool === 'table' ? 'scaffold' : 'partial',
      kind: 'theme',
      themeId: 'workshop',
    },
    {
      id: 'theme-strategy',
      icon: 'BriefcaseBusiness',
      labelEn: 'Strategy theme',
      labelPl: 'Motyw strategiczny',
      descEn: 'Apply a more formal strategy/exec visual treatment.',
      descPl: 'Zastosuj bardziej formalny treatment strategiczno-exec.',
      capability: tool === 'table' ? 'scaffold' : 'partial',
      kind: 'theme',
      themeId: 'strategy',
    },
  ];

  if (tool === 'whiteboard') {
    return [
      ...generic,
      {
        id: 'theme-library-save',
        icon: 'Library',
        labelEn: 'Save selection to library',
        labelPl: 'Zapisz zaznaczenie do biblioteki',
        descEn: 'Persist a reusable whiteboard component in the local library.',
        descPl: 'Zapisz reuzywalny komponent whiteboardu do lokalnej biblioteki.',
        capability: 'real',
        kind: 'quick_action',
        quickAction: 'wb_library_save_selection',
      },
      {
        id: 'theme-library-last',
        icon: 'History',
        labelEn: 'Insert latest library item',
        labelPl: 'Wstaw ostatni element biblioteki',
        descEn: 'Reuse the latest saved component directly on the board.',
        descPl: 'Użyj ostatniego zapisanego komponentu bezpośrednio na tablicy.',
        capability: 'real',
        kind: 'quick_action',
        quickAction: 'wb_library_insert_last',
      },
    ];
  }

  return generic;
}

function getFacilitationActions(tool: CanvasToolType): CanvasOsAction[] {
  if (tool === 'whiteboard') {
    return [
      {
        id: 'fac-voting',
        icon: 'Vote',
        labelEn: 'Toggle voting session',
        labelPl: 'Przełącz sesję głosowania',
        descEn: 'Start or stop the shared voting overlay.',
        descPl: 'Uruchom lub zatrzymaj współdzielony overlay głosowania.',
        capability: 'real',
        kind: 'quick_action',
        quickAction: 'wb_session_toggle_voting',
      },
      {
        id: 'fac-timer',
        icon: 'Timer',
        labelEn: 'Session timer',
        labelPl: 'Timer sesji',
        descEn: 'Toggle the built-in facilitation timer.',
        descPl: 'Przełącz wbudowany timer facylitacji.',
        capability: 'real',
        kind: 'quick_action',
        quickAction: 'wb_session_toggle_timer',
      },
      {
        id: 'fac-follow',
        icon: 'LocateFixed',
        labelEn: 'Follow mode',
        labelPl: 'Tryb follow',
        descEn: 'Toggle collaborative follow/spotlight behavior.',
        descPl: 'Przełącz collaborative follow i spotlight behavior.',
        capability: 'partial',
        kind: 'quick_action',
        quickAction: 'wb_session_toggle_follow',
      },
    ];
  }

  return [
    {
      id: 'fac-review-submit',
      icon: 'ShieldCheck',
      labelEn: 'Submit for review',
      labelPl: 'Wyślij do review',
      descEn: 'Persist review-ready state and mark the canvas for formal review.',
      descPl: 'Zapisz stan gotowy do review i oznacz canvas do formalnego przeglądu.',
      capability: 'real',
      kind: 'governance_update',
      governanceUpdate: { status: 'in_review', note: 'Submitted from Canvas OS' },
    },
    {
      id: 'fac-review-approve',
      icon: 'BadgeCheck',
      labelEn: 'Approve current state',
      labelPl: 'Zatwierdź bieżący stan',
      descEn: 'Mark the current graph as reviewed and approved.',
      descPl: 'Oznacz bieżący graf jako przejrzany i zatwierdzony.',
      capability: 'real',
      kind: 'governance_update',
      governanceUpdate: { status: 'approved', note: 'Approved from Canvas OS' },
    },
    {
      id: 'fac-review-changes',
      icon: 'MessageSquareMore',
      labelEn: 'Request changes',
      labelPl: 'Poproś o zmiany',
      descEn: 'Persist review feedback and keep the canvas in an actionable state.',
      descPl: 'Zapisz feedback review i utrzymaj canvas w stanie wymagającym działań.',
      capability: 'real',
      kind: 'governance_update',
      governanceUpdate: { status: 'changes_requested', note: 'Changes requested from Canvas OS' },
    },
    {
      id: 'fac-voting-shell',
      icon: 'Vote',
      labelEn: 'Voting overlay',
      labelPl: 'Overlay głosowania',
      descEn: 'Use the shared voting overlay for prioritization and review.',
      descPl: 'Użyj współdzielonego overlay głosowania do priorytetyzacji i review.',
      capability: 'real',
      kind: 'toggle_voting',
    },
    {
      id: 'fac-context-review',
      icon: 'MessageSquareMore',
      labelEn: 'Review in context panel',
      labelPl: 'Review w panelu context',
      descEn: 'Jump to the context panel for comments, activity, and linked evidence.',
      descPl: 'Przejdź do panelu context po komentarze, activity i linked evidence.',
      capability: 'real',
      kind: 'open_context',
    },
    {
      id: 'fac-tools-review',
      icon: 'ShieldCheck',
      labelEn: 'Review in tools panel',
      labelPl: 'Review w panelu tools',
      descEn: 'Open the tools panel for conversions, generators, and review actions.',
      descPl: 'Otwórz panel tools dla konwersji, generatorów i akcji review.',
      capability: 'real',
      kind: 'open_tools',
    },
  ];
}

const SHARE_ACTIONS: CanvasOsAction[] = [
  {
    id: 'share-export',
    icon: 'Download',
    labelEn: 'Export bundle',
    labelPl: 'Pakiet eksportu',
    descEn: 'Open the structured export modal for image, PDF, Markdown, and JSON.',
    descPl: 'Otwórz modal eksportu dla obrazu, PDF, Markdown i JSON.',
    capability: 'real',
    kind: 'open_export',
  },
  {
    id: 'share-import',
    icon: 'Download',
    labelEn: 'Import interop package',
    labelPl: 'Importuj pakiet interop',
    descEn: 'Open the export/import modal to paste draw.io, BPMN, or diagram package payloads.',
    descPl: 'Otwórz modal eksportu/importu, aby wkleić draw.io, BPMN lub diagram package.',
    capability: 'real',
    kind: 'open_export',
  },
  {
    id: 'share-report',
    icon: 'FileBarChart2',
    labelEn: 'Promote to report',
    labelPl: 'Promuj do raportu',
    descEn: 'Convert the current artifact into a report-friendly output.',
    descPl: 'Przekonwertuj bieżący artefakt do formatu raportowego.',
    capability: 'real',
    kind: 'quick_action',
    quickAction: 'convert_report',
  },
  {
    id: 'share-presentation',
    icon: 'Presentation',
    labelEn: 'Promote to deck',
    labelPl: 'Promuj do decka',
    descEn: 'Convert the current artifact into a presentation starter.',
    descPl: 'Przekonwertuj bieżący artefakt do startera prezentacji.',
    capability: 'real',
    kind: 'quick_action',
    quickAction: 'convert_presentation',
  },
];

export interface CanvasTemplateGovernanceMeta {
  category: 'process' | 'system' | 'org' | 'strategy' | 'workshop' | 'private' | 'archived';
  library: 'core' | 'org' | 'project' | 'private';
  version: string;
  scope: 'global' | 'organization' | 'project' | 'private';
  capability: CanvasOsCapability;
}

function getAiActions(tool: CanvasToolType): CanvasOsAction[] {
  const actions: CanvasOsAction[] = [
    {
      id: 'ai-panel',
      icon: 'Sparkles',
      labelEn: 'AI Suggestions panel',
      labelPl: 'Panel AI Suggestions',
      descEn: 'Open the governed AI suggestions panel for this workspace.',
      descPl: 'Otwórz governed panel AI Suggestions dla tego workspace.',
      capability: 'real',
      kind: 'open_ai',
    },
  ];

  if (tool === 'process_flow') {
    actions.push({
      id: 'ai-brief',
      icon: 'Bot',
      labelEn: 'Generate structured brief',
      labelPl: 'Generuj structured brief',
      descEn: 'Create a review-ready process brief inside propose -> preview -> accept.',
      descPl: 'Utwórz review-ready brief procesu w modelu propose -> preview -> accept.',
      capability: 'real',
      kind: 'generate_ai',
      generatorType: 'process_brief',
    });
    return actions;
  }

  actions.push({
    id: 'ai-brief',
    icon: 'Bot',
    labelEn: 'Ask for a structured brief',
    labelPl: 'Poproś o structured brief',
    descEn: 'Prepare a structured brief and hand it off to chat.',
    descPl: 'Przygotuj structured brief i przekaż go do chatu.',
    capability: 'partial',
    kind: 'chat_prompt',
    chatPromptEn:
      'Prepare a structured Canvas OS brief for this idea. Include objective, current gaps, suggested next moves, and review checkpoints.',
    chatPromptPl:
      'Przygotuj structured brief Canvas OS dla tego pomysłu. Uwzględnij cel, obecne luki, sugerowane next moves i review checkpoints.',
  });
  return actions;
}

export function getCanvasOsActions(
  panelId: CanvasOsPanelId,
  tool: CanvasToolType
): CanvasOsAction[] {
  switch (panelId) {
    case 'insert':
      return getInsertActions(tool);
    case 'templates':
      return getTemplateActions(tool);
    case 'themes':
      return getThemeActions(tool);
    case 'data':
      return SMART_OBJECT_INSERTS;
    case 'facilitation':
      return getFacilitationActions(tool);
    case 'share':
      return SHARE_ACTIONS;
    case 'ai':
      return getAiActions(tool);
    default:
      return [];
  }
}
