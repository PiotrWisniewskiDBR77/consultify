import { DRD_STRUCTURE } from '../../data/drdStructure.js';
import * as DbPromise from '../../utils/DbPromise.js';
import {
  type DemoLeaderTemplate,
  getAtelierToysDemoScenarios,
  getAtelierToysInitiatives,
  getAtelierToysKnowledgeDocs,
  getAtelierToysLeadership,
  getAtelierToysProjects,
  getAtelierToysPrompts,
  getAtelierToysReports,
  getAtelierToysToolCoverage,
} from './atelierToysDemoTemplate.js';
import { type DemoLocale } from './demoLocale.js';
import { getDemoAnchorDate, materializeRelativeIso } from './demoRelativeDate.js';

export interface SeedDemoDatasetInput {
  organizationId: string;
  anchorDate?: Date | string | null;
  source?: 'canonical' | 'session';
  viewerUserId?: string | null;
  locale?: DemoLocale | string | null;
}

export interface SeedDemoDatasetResult {
  organizationId: string;
  anchorDate: string;
  locale: DemoLocale;
  counts: {
    users: number;
    projects: number;
    initiatives: number;
    tasks: number;
    decisions: number;
    reports: number;
    docs: number;
  };
  scenarios: ReturnType<typeof getAtelierToysDemoScenarios>;
  toolCoverage: ReturnType<typeof getAtelierToysToolCoverage>;
  resultsCoverage?: {
    kpis: number;
    kpiTimeSeries: number;
    kpiMappings: number;
    roiAssumptions: number;
    roiRealized: number;
    deviations: number;
    deviationActions: number;
    reportSnapshots: number;
    v8Kpis: number;
    v8Deviations: number;
    v8RoiEntries: number;
  };
}

type UserMap = Record<string, { id: string; email: string }>;
type ProjectMap = Record<string, string>;
type InitiativeMap = Record<string, string>;
type ResultsSeedCounts = NonNullable<SeedDemoDatasetResult['resultsCoverage']>;

function makeId(orgId: string, entity: string, slug: string): string {
  return `${orgId}--${entity}--${slug}`;
}

function assertPortfolioSanity(
  initiatives: ReturnType<typeof getAtelierToysInitiatives>,
  locale: DemoLocale
): void {
  const total = initiatives.length;
  const draftCount = initiatives.filter((item) => String(item.status || '') === 'DRAFT').length;
  const inProgressCount = initiatives.filter((item) =>
    ['in_progress', 'EXECUTING'].includes(String(item.status || ''))
  ).length;

  const parseRelDay = (value: string): number | null => {
    const match = String(value || '').trim().match(/^([+-])(\d+)d$/);
    if (!match) return null;
    const sign = match[1] === '-' ? -1 : 1;
    return sign * Number(match[2]);
  };

  const transitionStageStatuses = new Set(['APPROVED', 'SCHEDULED']);
  const mustHaveThreeTasks = (status: string) => !['DONE', 'CANCELLED', 'DRAFT'].includes(status);

  const hardErrors: string[] = [];
  if (total !== 20) {
    hardErrors.push(`Expected exactly 20 initiatives, got ${total}.`);
  }
  if (draftCount < 3) {
    hardErrors.push(`Expected at least 3 DRAFT initiatives, got ${draftCount}.`);
  }
  if (inProgressCount < 5) {
    hardErrors.push(`Expected at least 5 in_progress initiatives, got ${inProgressCount}.`);
  }

  for (const initiative of initiatives) {
    const status = String(initiative.status || '');
    const slug = initiative.slug;
    const tasks = Array.isArray(initiative.tasks) ? initiative.tasks : [];
    const decisions = Array.isArray(initiative.decisions) ? initiative.decisions : [];
    const milestones = Array.isArray(initiative.milestones) ? initiative.milestones : [];
    const successCriteria = Array.isArray(initiative.successCriteria) ? initiative.successCriteria : [];

    if (mustHaveThreeTasks(status) && tasks.length < 3) {
      hardErrors.push(`Initiative ${slug} (${status}) must have >=3 tasks, got ${tasks.length}.`);
    }
    if (decisions.length < 1) {
      hardErrors.push(`Initiative ${slug} must have >=1 decision.`);
    }
    if (milestones.length < 1) {
      hardErrors.push(`Initiative ${slug} must have >=1 milestone.`);
    }
    if (successCriteria.length < 3) {
      hardErrors.push(
        `Initiative ${slug} must have >=3 successCriteria (KPI expectations), got ${successCriteria.length}.`
      );
    }
    if (
      typeof initiative.budgetCapex !== 'number' ||
      typeof initiative.budgetOpex !== 'number' ||
      initiative.budgetCapex < 0 ||
      initiative.budgetOpex < 0
    ) {
      hardErrors.push(`Initiative ${slug} has invalid budget numbers.`);
    }
    if (typeof initiative.expectedRoi !== 'number' || initiative.expectedRoi <= 0) {
      hardErrors.push(`Initiative ${slug} must have positive expectedRoi.`);
    }
    if (!initiative.ownerBusiness || !initiative.ownerExecution || !initiative.sponsor) {
      hardErrors.push(`Initiative ${slug} is missing ownerBusiness/ownerExecution/sponsor.`);
    }

    const startRel = parseRelDay(String(initiative.plannedStart || ''));
    const endRel = parseRelDay(String(initiative.plannedEnd || ''));
    if (startRel !== null && endRel !== null && endRel <= startRel) {
      hardErrors.push(
        `Initiative ${slug} has invalid timeline: plannedEnd (${initiative.plannedEnd}) <= plannedStart (${initiative.plannedStart}).`
      );
    }

    if (status === 'DRAFT' && tasks.some((task) => task.status === 'in_progress')) {
      hardErrors.push(`Initiative ${slug} is DRAFT but has in_progress tasks.`);
    }

    if (transitionStageStatuses.has(status) && tasks.some((task) => task.status === 'in_progress')) {
      hardErrors.push(
        `Initiative ${slug} is ${status} but has in_progress tasks (expected todo/done in transition stages).`
      );
    }
  }

  if (hardErrors.length > 0) {
    const header =
      locale === 'pl'
        ? 'Portfolio sanity-check failed for Atelier demo initiatives:'
        : 'Portfolio sanity-check failed for Atelier demo initiatives:';
    throw new Error(`${header}\n- ${hardErrors.join('\n- ')}`);
  }
}

function markdownBlocksToDocJson(markdown: string) {
  const paragraphs = String(markdown || '')
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: chunk.replace(/\n/g, ' ') }],
    }));

  return {
    type: 'doc',
    content: paragraphs,
  };
}

type DemoDrdAreaState = {
  achievedLevel: number;
  targetLevel?: number;
  levelNotes?: Record<string, string>;
};

function clamp(num: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, num));
}

function buildDemoDrdAreas(
  maturityByAxis: Partial<Record<number, { achieved: number; target: number }>>,
  notesByArea: Partial<Record<string, string>>
): Record<string, DemoDrdAreaState> {
  const areas: Record<string, DemoDrdAreaState> = {};
  let areaIndex = 0;

  for (const axis of DRD_STRUCTURE) {
    const base = maturityByAxis[axis.id] || { achieved: 2, target: 4 };
    for (const area of axis.areas) {
      const wobble = (areaIndex % 3) - 1;
      const achieved = clamp(base.achieved + wobble, 1, axis.levelCount || 5);
      const target = clamp(base.target, achieved, axis.levelCount || 5);
      const note = notesByArea[area.id];
      areas[area.id] = {
        achievedLevel: achieved,
        targetLevel: target,
        ...(note ? { levelNotes: { [String(achieved)]: note } } : {}),
      };
      areaIndex += 1;
    }
  }

  return areas;
}

type DemoNotebookSeed = {
  slug: string;
  title: string;
  icon: string;
  maturity: 'seed' | 'growing' | 'mature' | 'actionable';
  status: 'inbox' | 'active';
  tags: string[];
  contentText: string;
};

type DemoIdeaSeed = {
  slug: string;
  title: string;
  body: string;
  tags: string[];
  stage: string;
  area: string;
  priority: number;
  branch: string;
  preferredTool: 'mindmap' | 'process_flow' | 'table' | 'whiteboard';
  buildMap: (ideaId: string) => {
    nodes: any[];
    edges: any[];
    extensions?: Record<string, unknown>;
    version: number;
  };
};

function buildMindmapMap(
  ideaId: string,
  title: string,
  branches: Array<{
    key: string;
    label: string;
    items: Array<{ label: string; nodeType?: string; priority?: number }>;
  }>
) {
  const centerId = 'root';
  const branchRadius = 300;
  const angles = [
    -Math.PI / 2,
    -Math.PI / 6,
    Math.PI / 6,
    Math.PI / 2,
    (5 * Math.PI) / 6,
    (7 * Math.PI) / 6,
  ];
  const nodes: any[] = [
    {
      id: centerId,
      type: 'center',
      position: { x: 0, y: 0 },
      data: { label: title, hint: 'Atelier Toys demo', ideaId },
      draggable: false,
    },
  ];
  const edges: any[] = [];

  branches.forEach((branch, index) => {
    const angle = angles[index % angles.length];
    const bx = Math.cos(angle) * branchRadius;
    const by = Math.sin(angle) * branchRadius;
    const branchId = `branch-${branch.key}`;
    nodes.push({
      id: branchId,
      type: 'branch',
      position: { x: bx - 45, y: by - 20 },
      data: { label: branch.label, branchKey: branch.key, count: branch.items.length },
      draggable: false,
    });
    edges.push({
      id: `${centerId}-${branchId}`,
      source: centerId,
      target: branchId,
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#94a3b8', strokeWidth: 2.5, opacity: 0.35 },
      data: { system: true, kind: 'frames' },
    });

    branch.items.forEach((item, itemIndex) => {
      const nodeId = `${branch.key}-${itemIndex}`;
      nodes.push({
        id: nodeId,
        type: 'idea',
        position: {
          x: bx + Math.cos(angle) * 135 + (itemIndex % 2 === 0 ? 1 : -1) * 70,
          y: by + Math.sin(angle) * 135 + (itemIndex - 1) * 52,
        },
        data: {
          label: item.label,
          branchKey: branch.key,
          nodeType: item.nodeType || 'idea',
          priority: item.priority || 60,
          sourceType: 'seed',
          ideaId,
        },
      });
      edges.push({
        id: `${branchId}-${nodeId}`,
        source: branchId,
        target: nodeId,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#8b5cf6', strokeWidth: 2, opacity: 0.75 },
        data: { userCreated: true, kind: 'seed' },
      });
    });
  });

  return { nodes, edges, version: 1 };
}

function buildWhiteboardMap(
  _ideaId: string,
  title: string,
  config: {
    current: string[];
    future: string[];
    actions: string[];
    metrics: string[];
    labels?: {
      current?: string;
      future?: string;
      actions?: string;
    };
  }
) {
  const nodes: any[] = [
    {
      id: 'frame-current',
      type: 'frameNode',
      position: { x: -20, y: -10 },
      data: {
        label: config.labels?.current || 'Current State',
        width: 560,
        height: 320,
        bgColor: '#fef2f2',
        semanticLabel: 'current-state',
      },
    },
    {
      id: 'frame-future',
      type: 'frameNode',
      position: { x: 600, y: -10 },
      data: {
        label: config.labels?.future || 'Target State',
        width: 560,
        height: 320,
        bgColor: '#ecfdf5',
        semanticLabel: 'future-state',
      },
    },
    {
      id: 'frame-actions',
      type: 'frameNode',
      position: { x: 170, y: 350 },
      data: {
        label: config.labels?.actions || 'Actions & decisions',
        width: 860,
        height: 260,
        bgColor: '#eff6ff',
        semanticLabel: 'actions',
      },
    },
    {
      id: 'text-title',
      type: 'textNode',
      position: { x: 300, y: -90 },
      data: { label: title, semanticLabel: 'title' },
    },
  ];

  const colors = ['#fef9c3', '#ffe4e6', '#ffedd5', '#fce7f3', '#dcfce7', '#dbeafe'];
  config.current.forEach((label, index) => {
    nodes.push({
      id: `current-${index}`,
      type: 'stickyNote',
      position: { x: 20 + (index % 3) * 180, y: 40 + Math.floor(index / 3) * 140 },
      data: {
        label,
        color: colors[index % colors.length],
        colorIndex: index % colors.length,
        size: 'm',
      },
    });
  });
  config.future.forEach((label, index) => {
    nodes.push({
      id: `future-${index}`,
      type: 'stickyNote',
      position: { x: 630 + (index % 3) * 180, y: 40 + Math.floor(index / 3) * 140 },
      data: {
        label,
        color: colors[(index + 2) % colors.length],
        colorIndex: (index + 2) % colors.length,
        size: 'm',
      },
    });
  });
  config.actions.forEach((label, index) => {
    nodes.push({
      id: `action-${index}`,
      type: 'stickyNote',
      position: { x: 220 + (index % 3) * 190, y: 395 + Math.floor(index / 3) * 110 },
      data: {
        label,
        color: colors[(index + 1) % colors.length],
        colorIndex: (index + 1) % colors.length,
        size: 'm',
      },
    });
  });
  config.metrics.forEach((label, index) => {
    nodes.push({
      id: `metric-${index}`,
      type: 'shapeNode',
      position: { x: 300 + index * 250, y: -140 },
      data: {
        label,
        shape: index % 2 === 0 ? 'circle' : 'diamond',
        bgColor: index % 2 === 0 ? '#34d399' : '#fbbf24',
      },
    });
  });

  const edges: any[] = [
    {
      id: 'e1',
      source: 'frame-current',
      target: 'frame-future',
      type: 'default',
      data: { label: 'Transformation' },
    },
    {
      id: 'e2',
      source: 'frame-future',
      target: 'frame-actions',
      type: 'default',
      data: { label: 'Delivery' },
    },
  ];

  return {
    nodes,
    edges,
    extensions: {
      whiteboard: {
        mode: 'board',
        viewState: { snap: true, showGrid: true },
        drawingPaths: [],
        scenes: [],
        bgPattern: 'dots',
        sessionState: { activeParticipants: [], cursorPositions: {} },
        libraryItems: [],
        outcomeRegistry: config.actions.map((label) => ({ type: 'action', label })),
        activityLog: [],
        historyLog: [],
      },
    },
    version: 1,
  };
}

function buildProcessFlowMap(
  _ideaId: string,
  lanes: Array<{ id: string; label: string; color: string }>,
  nodesConfig: Array<{
    id: string;
    label: string;
    x: number;
    y: number;
    laneId: string;
    shape: string;
    extra?: Record<string, unknown>;
  }>,
  edgesConfig: Array<{ source: string; target: string; label?: string }>
) {
  const nodes = nodesConfig.map((node) => ({
    id: node.id,
    type: 'flowNode',
    position: { x: node.x, y: node.y },
    data: {
      label: node.label,
      shape: node.shape,
      laneId: node.laneId,
      laneColor: lanes.find((lane) => lane.id === node.laneId)?.color || '#dbeafe',
      ...(node.extra || {}),
    },
  }));
  const edges = edgesConfig.map((edge, index) => ({
    id: `edge-${index}`,
    source: edge.source,
    target: edge.target,
    type: 'flowEdge',
    data: edge.label ? { label: edge.label } : {},
  }));
  return {
    nodes,
    edges,
    extensions: {
      processFlow: {
        lanes,
        flowMode: 'ops',
        semanticKit: 'operations',
        viewState: { layoutMode: 'free', showGrid: true, snap: true },
      },
    },
    version: 1,
  };
}

function buildTableMap(_ideaId: string, columns: any[], rows: Array<Record<string, unknown>>) {
  return {
    nodes: rows.map((row, index) => ({
      id: `row-${index}`,
      type: 'idea',
      data: row,
      position: { x: 0, y: index },
    })),
    edges: [],
    extensions: {
      table: {
        columns,
        views: [
          { id: 'view-default', name: 'Default', layout: 'table', icon: '📊' },
          {
            id: 'view-priority',
            name: 'Priority',
            layout: 'table',
            sort: [{ key: 'priority', direction: 'desc' }],
            icon: '⭐',
          },
          { id: 'view-status', name: 'Status', layout: 'kanban', groupBy: 'status', icon: '📋' },
        ],
        activeViewId: 'view-default',
        viewState: { sort: null, filters: { logic: 'and', rules: [] }, groupBy: null },
        formatting: [],
        viewLayout: 'table',
      },
    },
    version: 1,
  };
}

function buildDemoNotebooks(locale: DemoLocale): DemoNotebookSeed[] {
  if (locale === 'pl') {
    return [
      {
        slug: 'board-pre-read',
        title: 'Board pre-read: pakiet decyzji Atelier Forward',
        icon: '📘',
        maturity: 'actionable',
        status: 'active',
        tags: ['zarząd', 'forward', 'roi', 'governance'],
        contentText:
          'Board pre-read na kolejne spotkanie.\n\nKluczowe decyzje:\n- zatwierdzić budżet skalowania Linii 3\n- potwierdzić politykę buforów dla dostawców\n- wybrać główny zakład roadmapowy dla Atelier Digital\n\nSygnały:\n- trend OEE poprawia się, ale zaufanie do telemetrii nadal jest nierówne\n- ryzyko dostawców pozostaje głównym zagrożeniem dla marży\n- attach partnerów jest najwyższy tam, gdzie historia Digital Twin pojawia się wcześnie',
      },
      {
        slug: 'plant-gemba-notes',
        title: 'Notatki Gemba po spacerze przez Lyon East',
        icon: '🏭',
        maturity: 'growing',
        status: 'active',
        tags: ['operacje', 'gemba', 'zakład', 'linia-3'],
        contentText:
          'Obserwacje po spacerze Gemba w Lyon East.\n\n- supervisorzy chcą mniej hałaśliwych alertów i jaśniejszego ownershipu eskalacji\n- handover zmiany nadal jest najsłabszym punktem reakcji na przestoje\n- checklista przezbrojenia istnieje, ale operatorzy nie wykonują jej w tej samej sekwencji\n- demo Digital Twin działało najlepiej, gdy było powiązane z konkretnymi przypadkami downtime',
      },
      {
        slug: 'partner-cohort-retro',
        title: 'Retro kohorty partnerskiej i obiekcje',
        icon: '🤝',
        maturity: 'mature',
        status: 'active',
        tags: ['partnerzy', 'commercial', 'obiekcje', 'digital-growth'],
        contentText:
          'Retro po pierwszej kohorcie onboardingu partnerów.\n\nGłówne obiekcje:\n- czy Atelier Digital jest dodatkiem czy rdzeniem oferty?\n- jak mocna jest historia odnowień?\n- kto bierze ownership aktywacji edukatorów po sprzedaży?\n\nCo zadziałało:\n- case story Atelier Toys\n- narracja ROI powiązana z recurring usage\n- proste milestone’y dla pierwszych 90 dni onboardingu',
      },
      {
        slug: 'quality-closure-log',
        title: 'Log domknięcia jakości dla powtarzalnych defektów',
        icon: '🧪',
        maturity: 'actionable',
        status: 'active',
        tags: ['jakość', 'defekty', 'root-cause', 'qa'],
        contentText:
          'Powtarzalne problemy jakościowe aktualnie śledzone.\n\n- drift tolerancji pakowania u jednej partii dostawcy\n- niedopasowanie między timingiem launchu bundla a gotowością supportu\n- niespójne domykanie działań korygujących po pierwszym review\n\nPotrzebne:\n- mocniejszy board przyczyn źródłowych\n- wspólny owner engineeringowy dla wzorców cross-plant\n- zweryfikowany dashboard close-rate',
      },
      {
        slug: 'roadmap-memo',
        title: 'Memo roadmapowe: adopcja vs głębia analityki',
        icon: '🗺️',
        maturity: 'seed',
        status: 'active',
        tags: ['produkt', 'roadmapa', 'strategia', 'trade-offy'],
        contentText:
          'Memo o trade-offach roadmapy.\n\nOpcja A: maksymalizować attach rate przez szybszy onboarding i poprawę pakietowania.\nOpcja B: pogłębić analitykę i insighty executive, aby chronić odnowienia.\nOpcja C: rozdzielić roadmapę wg segmentów.\n\nRekomendacja: utrzymać jeden główny zakład i przetestować jeden ruch poboczny przez feedback z kohort partnerów.',
      },
    ];
  }

  return [
    {
      slug: 'board-pre-read',
      title: 'Board pre-read: Atelier Forward decision pack',
      icon: '📘',
      maturity: 'actionable',
      status: 'active',
      tags: ['board', 'forward', 'roi', 'governance'],
      contentText:
        'Board pre-read for next meeting.\n\nKey decisions:\n- approve Line 3 scale-up budget\n- confirm supplier buffer policy\n- select roadmap bet for Atelier Digital\n\nSignals:\n- OEE trend improving, but telemetry trust still uneven\n- supplier risk remains the main margin threat\n- partner attach is strongest where Digital Twin story is used early',
    },
    {
      slug: 'plant-gemba-notes',
      title: 'Gemba notes after Lyon East plant walk',
      icon: '🏭',
      maturity: 'growing',
      status: 'active',
      tags: ['operations', 'gemba', 'plant', 'line-3'],
      contentText:
        'Observation from Lyon East plant walk.\n\n- supervisors want fewer noisy alerts and clearer escalation ownership\n- shift handover is still the weakest point in downtime response\n- changeover checklist exists, but not all operators follow the same sequence\n- the Digital Twin demo resonated only when linked to concrete downtime cases',
    },
    {
      slug: 'partner-cohort-retro',
      title: 'Partner cohort retro and objections',
      icon: '🤝',
      maturity: 'mature',
      status: 'active',
      tags: ['partners', 'commercial', 'objections', 'digital-growth'],
      contentText:
        'Retro after first partner onboarding cohort.\n\nTop objections:\n- is Atelier Digital additive or core to the offer?\n- how strong is the renewal story?\n- who owns educator activation after sale?\n\nWhat worked:\n- Atelier Toys case story\n- ROI framing tied to recurring usage\n- simple first-90-day onboarding milestones',
    },
    {
      slug: 'quality-closure-log',
      title: 'Quality closure log for repeat defects',
      icon: '🧪',
      maturity: 'actionable',
      status: 'active',
      tags: ['quality', 'defects', 'root-cause', 'qa'],
      contentText:
        'Repeat quality issues being tracked.\n\n- packaging tolerance drift on one supplier batch\n- mismatch between bundle launch timing and support readiness\n- inconsistent corrective-action follow-through after first review\n\nNeeded:\n- tighter root-cause board\n- shared engineering owner for cross-plant patterns\n- verified close-rate dashboard',
    },
    {
      slug: 'roadmap-memo',
      title: 'Roadmap memo: adoption vs analytics depth',
      icon: '🗺️',
      maturity: 'seed',
      status: 'active',
      tags: ['product', 'roadmap', 'strategy', 'trade-offs'],
      contentText:
        'Roadmap trade-off memo.\n\nOption A: maximize attach rate with faster onboarding and packaging improvements.\nOption B: deepen analytics and executive insights to protect renewals.\nOption C: split roadmap by segment.\n\nRecommendation: keep one flagship bet and test one secondary move through partner cohort feedback.',
    },
  ];
}

function buildDemoIdeas(locale: DemoLocale): DemoIdeaSeed[] {
  if (locale === 'pl') {
    return [
      {
        slug: 'mindmap-board-growth-story',
        title: 'Historia dla zarządu: wzrost od hardware do SaaS',
        body: 'Mapa myśli łącząca narrację wzrostu, dowody, ryzyka i decyzje zarządcze na kolejny cykl.',
        tags: ['atelier-toys', 'mindmap', 'zarząd', 'wzrost'],
        stage: 'shaping',
        area: 'Executive / Wzrost',
        priority: 92,
        branch: 'strategy',
        preferredTool: 'mindmap',
        buildMap: (ideaId) =>
          buildMindmapMap(ideaId, 'Historia wzrostu od hardware do SaaS', [
            {
              key: 'signals',
              label: 'Sygnały',
              items: [
                {
                  label: 'Attach rate poprawił się w pilotażach partnerskich',
                  nodeType: 'evidence',
                  priority: 70,
                },
                {
                  label: 'Pewność odnowień rośnie wraz z dowodami aktywacji',
                  nodeType: 'evidence',
                  priority: 68,
                },
              ],
            },
            {
              key: 'risks',
              label: 'Ryzyka',
              items: [
                {
                  label: 'Słaba aktywacja edukatorów po sprzedaży',
                  nodeType: 'risk',
                  priority: 76,
                },
                {
                  label: 'Messaging nadal różni się między partnerami',
                  nodeType: 'risk',
                  priority: 72,
                },
              ],
            },
            {
              key: 'moves',
              label: 'Ruchy strategiczne',
              items: [
                {
                  label: 'Spakować historię Digital Twin do toolkitów partnerów',
                  nodeType: 'option',
                  priority: 74,
                },
                {
                  label: 'Uruchomić pakiet sygnałów renewal risk',
                  nodeType: 'option',
                  priority: 71,
                },
              ],
            },
            {
              key: 'board',
              label: 'Prośby do zarządu',
              items: [
                { label: 'Zatwierdzić pilotaż cen bundla', nodeType: 'decision', priority: 82 },
                {
                  label: 'Sfinansować instrumentację customer success',
                  nodeType: 'decision',
                  priority: 79,
                },
              ],
            },
          ]),
      },
      {
        slug: 'mindmap-factory-bottlenecks',
        title: 'Drzewo przyczyn bottlenecków fabryki',
        body: 'Mapa myśli największych strat operacyjnych na Linii 3 i ich wpływu na throughput oraz jakość.',
        tags: ['atelier-toys', 'mindmap', 'operacje', 'line-3'],
        stage: 'shaping',
        area: 'Operacje',
        priority: 88,
        branch: 'execution',
        preferredTool: 'mindmap',
        buildMap: (ideaId) =>
          buildMindmapMap(ideaId, 'Drzewo bottlenecków Linii 3', [
            {
              key: 'losses',
              label: 'Straty',
              items: [
                { label: 'Mikroprzestoje heat-treatment', nodeType: 'pain_point', priority: 78 },
                {
                  label: 'Wolne przekazanie przezbrojeń między zmianami',
                  nodeType: 'pain_point',
                  priority: 75,
                },
              ],
            },
            {
              key: 'causes',
              label: 'Przyczyny źródłowe',
              items: [
                { label: 'Niepełne pokrycie telemetrią', nodeType: 'cause', priority: 69 },
                {
                  label: 'Brak jednego ownera eskalacji na zmianie',
                  nodeType: 'cause',
                  priority: 71,
                },
              ],
            },
            {
              key: 'countermeasures',
              label: 'Countermeasures',
              items: [
                {
                  label: 'Ustandaryzować sekwencję przezbrojeń w twinie',
                  nodeType: 'action',
                  priority: 73,
                },
                {
                  label: 'Zaostrzyć trigger dispatchu maintenance',
                  nodeType: 'action',
                  priority: 70,
                },
              ],
            },
            {
              key: 'impact',
              label: 'Wpływ biznesowy',
              items: [
                { label: 'Potencjał wzrostu OEE o +8 pkt', nodeType: 'kpi', priority: 80 },
                { label: 'Wyższe zaufanie boardu do rolloutu', nodeType: 'outcome', priority: 74 },
              ],
            },
          ]),
      },
      {
        slug: 'flow-partner-onboarding',
        title: 'Przepływ onboardingu i aktywacji partnera',
        body: 'Mapa procesu pokazująca drogę partnera od podpisania do pierwszej sprzedaży bundla cyfrowego.',
        tags: ['atelier-toys', 'process-flow', 'partnerzy', 'aktywacja'],
        stage: 'ready',
        area: 'Commercial',
        priority: 85,
        branch: 'execution',
        preferredTool: 'process_flow',
        buildMap: (ideaId) =>
          buildProcessFlowMap(
            ideaId,
            [
              { id: 'lane-sales', label: 'Sprzedaż', color: '#dbeafe' },
              { id: 'lane-partner', label: 'Partner', color: '#fef3c7' },
              { id: 'lane-cs', label: 'Customer Success', color: '#dcfce7' },
              { id: 'lane-marketing', label: 'Marketing', color: '#fce7f3' },
            ],
            [
              {
                id: 'n1',
                label: 'Partner podpisuje umowę',
                x: 40,
                y: 50,
                laneId: 'lane-sales',
                shape: 'process',
              },
              {
                id: 'n2',
                label: 'Powstaje plan onboardingu',
                x: 260,
                y: 50,
                laneId: 'lane-sales',
                shape: 'process',
                extra: { duration: '2d' },
              },
              {
                id: 'n3',
                label: 'Sesja enablementowa',
                x: 500,
                y: 50,
                laneId: 'lane-marketing',
                shape: 'process',
                extra: { duration: '1d' },
              },
              {
                id: 'n4',
                label: 'Check gotowości demo',
                x: 740,
                y: 50,
                laneId: 'lane-cs',
                shape: 'decision',
              },
              {
                id: 'n5',
                label: 'Pierwszy warsztat z klientem',
                x: 980,
                y: 50,
                laneId: 'lane-partner',
                shape: 'process',
              },
              {
                id: 'n6',
                label: 'Wysłana propozycja bundla',
                x: 1220,
                y: 50,
                laneId: 'lane-sales',
                shape: 'process',
              },
              {
                id: 'n7',
                label: 'Pierwszy bundle cyfrowy sprzedany',
                x: 1460,
                y: 50,
                laneId: 'lane-partner',
                shape: 'end',
              },
            ],
            [
              { source: 'n1', target: 'n2' },
              { source: 'n2', target: 'n3' },
              { source: 'n3', target: 'n4' },
              { source: 'n4', target: 'n5', label: 'gotowy' },
              { source: 'n5', target: 'n6' },
              { source: 'n6', target: 'n7' },
            ]
          ),
      },
      {
        slug: 'flow-quality-response',
        title: 'Przepływ reakcji na incydent jakościowy',
        body: 'Mapa procesu pokazująca drogę nawracającego defektu od wykrycia do zweryfikowanego zamknięcia.',
        tags: ['atelier-toys', 'process-flow', 'jakość', 'incydent'],
        stage: 'ready',
        area: 'Jakość',
        priority: 84,
        branch: 'execution',
        preferredTool: 'process_flow',
        buildMap: (ideaId) =>
          buildProcessFlowMap(
            ideaId,
            [
              { id: 'lane-plant', label: 'Zakład', color: '#dbeafe' },
              { id: 'lane-qa', label: 'QA', color: '#dcfce7' },
              { id: 'lane-eng', label: 'Engineering', color: '#fef3c7' },
              { id: 'lane-board', label: 'Leadership', color: '#fce7f3' },
            ],
            [
              {
                id: 'q1',
                label: 'Wykryto defekt',
                x: 40,
                y: 70,
                laneId: 'lane-plant',
                shape: 'start',
              },
              {
                id: 'q2',
                label: 'Działanie containment',
                x: 240,
                y: 70,
                laneId: 'lane-qa',
                shape: 'process',
              },
              {
                id: 'q3',
                label: 'Review przyczyny źródłowej',
                x: 470,
                y: 70,
                laneId: 'lane-eng',
                shape: 'process',
              },
              {
                id: 'q4',
                label: 'Countermeasure zatwierdzony?',
                x: 710,
                y: 70,
                laneId: 'lane-board',
                shape: 'decision',
              },
              {
                id: 'q5',
                label: 'Wdrożyć poprawkę',
                x: 960,
                y: 70,
                laneId: 'lane-plant',
                shape: 'process',
              },
              {
                id: 'q6',
                label: 'Zweryfikować brak nawrotu',
                x: 1180,
                y: 70,
                laneId: 'lane-qa',
                shape: 'process',
              },
              {
                id: 'q7',
                label: 'Zamknięcie wpisane do logu',
                x: 1410,
                y: 70,
                laneId: 'lane-board',
                shape: 'end',
              },
            ],
            [
              { source: 'q1', target: 'q2' },
              { source: 'q2', target: 'q3' },
              { source: 'q3', target: 'q4' },
              { source: 'q4', target: 'q5', label: 'zatwierdzono' },
              { source: 'q5', target: 'q6' },
              { source: 'q6', target: 'q7' },
            ]
          ),
      },
      {
        slug: 'table-line-upgrade-options',
        title: 'Opcje inwestycyjne dla upgrade linii',
        body: 'Tabela porównująca warianty upgrade’u pod kątem throughput, kosztu, ROI i ryzyka wdrożenia.',
        tags: ['atelier-toys', 'table', 'roi', 'operacje'],
        stage: 'ready',
        area: 'Operacje / Finanse',
        priority: 90,
        branch: 'execution',
        preferredTool: 'table',
        buildMap: (ideaId) =>
          buildTableMap(
            ideaId,
            [
              { key: 'option', header: 'Opcja upgrade’u', type: 'text', visible: true, width: 220 },
              { key: 'capex', header: 'CAPEX', type: 'currency', visible: true, width: 120 },
              {
                key: 'opex_delta',
                header: 'Zmiana OPEX',
                type: 'currency',
                visible: true,
                width: 130,
              },
              { key: 'oee_gain', header: 'Przyrost OEE', type: 'text', visible: true, width: 110 },
              {
                key: 'payback',
                header: 'Payback (mies.)',
                type: 'number',
                visible: true,
                width: 120,
              },
              {
                key: 'risk',
                header: 'Ryzyko',
                type: 'select',
                visible: true,
                width: 110,
                options: ['Niskie', 'Średnie', 'Wysokie'],
              },
              { key: 'status', header: 'Status', type: 'status', visible: true, width: 120 },
              { key: 'priority', header: 'Priorytet', type: 'rating', visible: true, width: 100 },
              { key: 'note', header: 'Dlaczego to ważne', type: 'text', visible: true, width: 240 },
            ],
            [
              {
                option: 'Odświeżenie sensorów Linii 3',
                capex: 85000,
                opex_delta: 12000,
                oee_gain: '+3.5 pkt',
                payback: 14,
                risk: 'Niskie',
                status: 'done',
                priority: 5,
                note: 'Najszybszy unlock dla zaufania do telemetrii.',
              },
              {
                option: 'Starter pack predykcyjnego maintenance',
                capex: 140000,
                opex_delta: 28000,
                oee_gain: '+5.2 pkt',
                payback: 18,
                risk: 'Średnie',
                status: 'in_progress',
                priority: 5,
                note: 'Najlepsza poprawa niezawodności w długim terminie.',
              },
              {
                option: 'Kit automatyzacji przezbrojeń',
                capex: 220000,
                opex_delta: 32000,
                oee_gain: '+6.1 pkt',
                payback: 24,
                risk: 'Średnie',
                status: 'todo',
                priority: 4,
                note: 'Duży efekt na throughput, ale wymaga dyscypliny procesu.',
              },
              {
                option: 'Pełny pakiet replikacji linii',
                capex: 410000,
                opex_delta: 60000,
                oee_gain: '+7.8 pkt',
                payback: 31,
                risk: 'Wysokie',
                status: 'todo',
                priority: 3,
                note: 'Ruch boardowy, powinien iść dopiero po dowodzie z pilota.',
              },
            ]
          ),
      },
      {
        slug: 'table-partner-portfolio',
        title: 'Macierz scoringowa portfolio partnerów',
        body: 'Tabela oceniająca partnerów pod kątem aktywacji, dopasowania strategicznego, potencjału odnowień i gotowości kanału.',
        tags: ['atelier-toys', 'table', 'partnerzy', 'scoring'],
        stage: 'shaping',
        area: 'Commercial',
        priority: 83,
        branch: 'strategy',
        preferredTool: 'table',
        buildMap: (ideaId) =>
          buildTableMap(
            ideaId,
            [
              { key: 'partner', header: 'Partner', type: 'text', visible: true, width: 190 },
              { key: 'region', header: 'Region', type: 'text', visible: true, width: 120 },
              {
                key: 'activation_score',
                header: 'Wynik aktywacji',
                type: 'number',
                visible: true,
                width: 130,
              },
              {
                key: 'renewal_risk',
                header: 'Ryzyko odnowień',
                type: 'select',
                visible: true,
                width: 130,
                options: ['Niskie', 'Średnie', 'Wysokie'],
              },
              {
                key: 'pipeline_quality',
                header: 'Jakość pipeline',
                type: 'text',
                visible: true,
                width: 130,
              },
              { key: 'status', header: 'Status', type: 'status', visible: true, width: 120 },
              { key: 'priority', header: 'Priorytet', type: 'rating', visible: true, width: 100 },
              { key: 'note', header: 'Następny krok', type: 'text', visible: true, width: 240 },
            ],
            [
              {
                partner: 'EduMotion France',
                region: 'Francja',
                activation_score: 87,
                renewal_risk: 'Niskie',
                pipeline_quality: 'Silna',
                status: 'done',
                priority: 5,
                note: 'Użyć jako flagowego partnera referencyjnego.',
              },
              {
                partner: 'STEM Iberia',
                region: 'Hiszpania',
                activation_score: 72,
                renewal_risk: 'Średnie',
                pipeline_quality: 'Dobra',
                status: 'in_progress',
                priority: 4,
                note: 'Potrzebuje mocniejszej kadencji onboardingu.',
              },
              {
                partner: 'NordLearn Distribution',
                region: 'Nordyki',
                activation_score: 64,
                renewal_risk: 'Średnie',
                pipeline_quality: 'Mieszana',
                status: 'todo',
                priority: 3,
                note: 'Przerobić messaging wartości przed dalszą ekspansją.',
              },
              {
                partner: 'ClassFuture DACH',
                region: 'DACH',
                activation_score: 79,
                renewal_risk: 'Niskie',
                pipeline_quality: 'Silna',
                status: 'in_progress',
                priority: 4,
                note: 'Dobry kandydat na pilotaż upsellu analityki.',
              },
            ]
          ),
      },
      {
        slug: 'whiteboard-board-wall',
        title: 'Board wall: dowody transformacji i wybory',
        body: 'Whiteboard podsumowujący to, co leadership powinien zobaczyć przed kolejnym cyklem decyzji boardowych.',
        tags: ['atelier-toys', 'whiteboard', 'zarząd', 'governance'],
        stage: 'ready',
        area: 'Executive',
        priority: 91,
        branch: 'strategy',
        preferredTool: 'whiteboard',
        buildMap: (ideaId) =>
          buildWhiteboardMap(ideaId, 'Ściana dowodów transformacji', {
            labels: {
              current: 'Stan obecny',
              future: 'Stan docelowy',
              actions: 'Działania i decyzje',
            },
            current: [
              'Board widzi rozproszone update’y\nmiędzy operacjami, finansami i wzrostem',
              'Logika ROI nadal jest dyskutowana\nza późno w cyklu',
              'Ownership follow-upów po decyzjach\njest niespójny',
              'Ryzyko dostawców widać dopiero\nw review finansowym',
            ],
            future: [
              'Jeden board scorecard\ndla wartości i ryzyka',
              'Log follow-upów decyzji\nprowadzony przez PMO',
              'Wspólne confidence bands\ndla założeń ROI',
              'Board pack aktualizowany\nna bazie live signals',
            ],
            actions: [
              'Domknąć board scorecard v2',
              'Uzupełnić dwa ostatnie cykle decyzji',
              'Odświeżyć logikę ROI dla top 10 inicjatyw',
              'Przygotować kolejny decision pack',
              'Przypisać jawnych ownerów i terminy',
            ],
            metrics: ['Pewność ROI +', 'Czas przygotowania -35%'],
          }),
      },
      {
        slug: 'whiteboard-launch-war-room',
        title: 'Launch war room dla bundla Atelier Digital',
        body: 'Whiteboard do koordynacji launchu między produktem, marketingiem, enablementem partnerów i customer success.',
        tags: ['atelier-toys', 'whiteboard', 'launch', 'digital-growth'],
        stage: 'shaping',
        area: 'Wzrost / Produkt',
        priority: 82,
        branch: 'execution',
        preferredTool: 'whiteboard',
        buildMap: (ideaId) =>
          buildWhiteboardMap(ideaId, 'War room launchowy bundla', {
            labels: {
              current: 'Stan obecny',
              future: 'Stan docelowy',
              actions: 'Działania i decyzje',
            },
            current: [
              'Messaging różni się między regionami',
              'Gotowość supportu zostaje za decyzjami o pakietowaniu',
              'Enablement partnerów nie jest zsynchronizowany',
              'Brak wspólnego dashboardu health launchu na co dzień',
            ],
            future: [
              'Jedna narracja launchu we wszystkich kanałach',
              'Codzienny review sygnałów launchowych',
              'Toolkit partnera oparty o realne obiekcje',
              'Problemy launchowe eskalowane w 24h',
            ],
            actions: [
              'Stworzyć dashboard sygnałów launchowych',
              'Uzgodnić checklistę gotowości supportu',
              'Spakować handling obiekcji partnerów',
              'Zdefiniować kadencję war roomu na pierwsze 2 tygodnie',
              'Przygotować asset referencyjny',
            ],
            metrics: ['Attach +11 pkt', 'Krótszy cykl obiekcji'],
          }),
      },
    ];
  }

  return [
    {
      slug: 'mindmap-board-growth-story',
      title: 'Board story for hardware-to-SaaS growth',
      body: 'Mind map connecting growth narrative, evidence, risks, and board choices for the next cycle.',
      tags: ['atelier-toys', 'mindmap', 'board', 'growth'],
      stage: 'shaping',
      area: 'Executive / Growth',
      priority: 92,
      branch: 'strategy',
      preferredTool: 'mindmap',
      buildMap: (ideaId) =>
        buildMindmapMap(ideaId, 'Hardware to SaaS growth story', [
          {
            key: 'signals',
            label: 'Signals',
            items: [
              {
                label: 'Attach rate improved in partner pilots',
                nodeType: 'evidence',
                priority: 70,
              },
              {
                label: 'Renewal confidence rises with activation proof',
                nodeType: 'evidence',
                priority: 68,
              },
            ],
          },
          {
            key: 'risks',
            label: 'Risks',
            items: [
              { label: 'Weak educator activation after sale', nodeType: 'risk', priority: 76 },
              { label: 'Messaging still inconsistent by partner', nodeType: 'risk', priority: 72 },
            ],
          },
          {
            key: 'moves',
            label: 'Strategic moves',
            items: [
              {
                label: 'Package Digital Twin story into partner toolkit',
                nodeType: 'option',
                priority: 74,
              },
              { label: 'Instrument renewal-risk signal pack', nodeType: 'option', priority: 71 },
            ],
          },
          {
            key: 'board',
            label: 'Board asks',
            items: [
              { label: 'Approve bundle pricing pilot', nodeType: 'decision', priority: 82 },
              {
                label: 'Fund customer-success instrumentation',
                nodeType: 'decision',
                priority: 79,
              },
            ],
          },
        ]),
    },
    {
      slug: 'mindmap-factory-bottlenecks',
      title: 'Factory bottleneck root-cause tree',
      body: 'Mind map of the biggest operational losses on Line 3 and what they mean for throughput and quality.',
      tags: ['atelier-toys', 'mindmap', 'operations', 'line-3'],
      stage: 'shaping',
      area: 'Operations',
      priority: 88,
      branch: 'execution',
      preferredTool: 'mindmap',
      buildMap: (ideaId) =>
        buildMindmapMap(ideaId, 'Line 3 bottleneck tree', [
          {
            key: 'losses',
            label: 'Losses',
            items: [
              { label: 'Heat-treatment micro-stops', nodeType: 'pain_point', priority: 78 },
              {
                label: 'Slow changeover handoff between shifts',
                nodeType: 'pain_point',
                priority: 75,
              },
            ],
          },
          {
            key: 'causes',
            label: 'Root causes',
            items: [
              { label: 'Incomplete telemetry coverage', nodeType: 'cause', priority: 69 },
              { label: 'No single escalation owner per shift', nodeType: 'cause', priority: 71 },
            ],
          },
          {
            key: 'countermeasures',
            label: 'Countermeasures',
            items: [
              {
                label: 'Standardize changeover sequence in twin',
                nodeType: 'action',
                priority: 73,
              },
              { label: 'Tighten maintenance dispatch trigger', nodeType: 'action', priority: 70 },
            ],
          },
          {
            key: 'impact',
            label: 'Business impact',
            items: [
              { label: 'OEE uplift potential +8 pts', nodeType: 'kpi', priority: 80 },
              { label: 'Board confidence in rollout improves', nodeType: 'outcome', priority: 74 },
            ],
          },
        ]),
    },
    {
      slug: 'flow-partner-onboarding',
      title: 'Partner onboarding and activation flow',
      body: 'Process flow showing how a partner moves from signature to first digital bundle sale.',
      tags: ['atelier-toys', 'process-flow', 'partners', 'activation'],
      stage: 'ready',
      area: 'Commercial',
      priority: 85,
      branch: 'execution',
      preferredTool: 'process_flow',
      buildMap: (ideaId) =>
        buildProcessFlowMap(
          ideaId,
          [
            { id: 'lane-sales', label: 'Sales', color: '#dbeafe' },
            { id: 'lane-partner', label: 'Partner', color: '#fef3c7' },
            { id: 'lane-cs', label: 'Customer Success', color: '#dcfce7' },
            { id: 'lane-marketing', label: 'Marketing', color: '#fce7f3' },
          ],
          [
            {
              id: 'n1',
              label: 'Partner signs agreement',
              x: 40,
              y: 50,
              laneId: 'lane-sales',
              shape: 'process',
            },
            {
              id: 'n2',
              label: 'Onboarding plan created',
              x: 260,
              y: 50,
              laneId: 'lane-sales',
              shape: 'process',
              extra: { duration: '2d' },
            },
            {
              id: 'n3',
              label: 'Enablement session',
              x: 500,
              y: 50,
              laneId: 'lane-marketing',
              shape: 'process',
              extra: { duration: '1d' },
            },
            {
              id: 'n4',
              label: 'Demo readiness check',
              x: 740,
              y: 50,
              laneId: 'lane-cs',
              shape: 'decision',
            },
            {
              id: 'n5',
              label: 'First customer workshop',
              x: 980,
              y: 50,
              laneId: 'lane-partner',
              shape: 'process',
            },
            {
              id: 'n6',
              label: 'Bundle proposal sent',
              x: 1220,
              y: 50,
              laneId: 'lane-sales',
              shape: 'process',
            },
            {
              id: 'n7',
              label: 'First digital bundle sold',
              x: 1460,
              y: 50,
              laneId: 'lane-partner',
              shape: 'end',
            },
          ],
          [
            { source: 'n1', target: 'n2' },
            { source: 'n2', target: 'n3' },
            { source: 'n3', target: 'n4' },
            { source: 'n4', target: 'n5', label: 'ready' },
            { source: 'n5', target: 'n6' },
            { source: 'n6', target: 'n7' },
          ]
        ),
    },
    {
      slug: 'flow-quality-response',
      title: 'Quality incident response flow',
      body: 'Process map for how a recurring defect should move from detection to verified closure.',
      tags: ['atelier-toys', 'process-flow', 'quality', 'incident'],
      stage: 'ready',
      area: 'Quality',
      priority: 84,
      branch: 'execution',
      preferredTool: 'process_flow',
      buildMap: (ideaId) =>
        buildProcessFlowMap(
          ideaId,
          [
            { id: 'lane-plant', label: 'Plant', color: '#dbeafe' },
            { id: 'lane-qa', label: 'QA', color: '#dcfce7' },
            { id: 'lane-eng', label: 'Engineering', color: '#fef3c7' },
            { id: 'lane-board', label: 'Leadership', color: '#fce7f3' },
          ],
          [
            {
              id: 'q1',
              label: 'Defect detected',
              x: 40,
              y: 70,
              laneId: 'lane-plant',
              shape: 'start',
            },
            {
              id: 'q2',
              label: 'Containment action',
              x: 240,
              y: 70,
              laneId: 'lane-qa',
              shape: 'process',
            },
            {
              id: 'q3',
              label: 'Root-cause review',
              x: 470,
              y: 70,
              laneId: 'lane-eng',
              shape: 'process',
            },
            {
              id: 'q4',
              label: 'Countermeasure approved?',
              x: 710,
              y: 70,
              laneId: 'lane-board',
              shape: 'decision',
            },
            {
              id: 'q5',
              label: 'Implement fix',
              x: 960,
              y: 70,
              laneId: 'lane-plant',
              shape: 'process',
            },
            {
              id: 'q6',
              label: 'Verify recurrence stopped',
              x: 1180,
              y: 70,
              laneId: 'lane-qa',
              shape: 'process',
            },
            {
              id: 'q7',
              label: 'Closure logged',
              x: 1410,
              y: 70,
              laneId: 'lane-board',
              shape: 'end',
            },
          ],
          [
            { source: 'q1', target: 'q2' },
            { source: 'q2', target: 'q3' },
            { source: 'q3', target: 'q4' },
            { source: 'q4', target: 'q5', label: 'approved' },
            { source: 'q5', target: 'q6' },
            { source: 'q6', target: 'q7' },
          ]
        ),
    },
    {
      slug: 'table-line-upgrade-options',
      title: 'Line upgrade investment options',
      body: 'Table workspace comparing upgrade variants for throughput, cost, ROI, and implementation risk.',
      tags: ['atelier-toys', 'table', 'roi', 'operations'],
      stage: 'ready',
      area: 'Operations / Finance',
      priority: 90,
      branch: 'execution',
      preferredTool: 'table',
      buildMap: (ideaId) =>
        buildTableMap(
          ideaId,
          [
            { key: 'option', header: 'Upgrade Option', type: 'text', visible: true, width: 220 },
            { key: 'capex', header: 'CAPEX', type: 'currency', visible: true, width: 120 },
            {
              key: 'opex_delta',
              header: 'OPEX Delta',
              type: 'currency',
              visible: true,
              width: 130,
            },
            { key: 'oee_gain', header: 'OEE Gain', type: 'text', visible: true, width: 110 },
            { key: 'payback', header: 'Payback (mo.)', type: 'number', visible: true, width: 120 },
            {
              key: 'risk',
              header: 'Risk',
              type: 'select',
              visible: true,
              width: 110,
              options: ['Low', 'Medium', 'High'],
            },
            { key: 'status', header: 'Status', type: 'status', visible: true, width: 120 },
            { key: 'priority', header: 'Priority', type: 'rating', visible: true, width: 100 },
            { key: 'note', header: 'Why it matters', type: 'text', visible: true, width: 240 },
          ],
          [
            {
              option: 'Line 3 sensor refresh',
              capex: 85000,
              opex_delta: 12000,
              oee_gain: '+3.5 pts',
              payback: 14,
              risk: 'Low',
              status: 'done',
              priority: 5,
              note: 'Fastest unlock for telemetry trust.',
            },
            {
              option: 'Predictive maintenance starter pack',
              capex: 140000,
              opex_delta: 28000,
              oee_gain: '+5.2 pts',
              payback: 18,
              risk: 'Medium',
              status: 'in_progress',
              priority: 5,
              note: 'Best long-term reliability improvement.',
            },
            {
              option: 'Changeover automation kit',
              capex: 220000,
              opex_delta: 32000,
              oee_gain: '+6.1 pts',
              payback: 24,
              risk: 'Medium',
              status: 'todo',
              priority: 4,
              note: 'Big effect on throughput, but requires process discipline.',
            },
            {
              option: 'Full line replication package',
              capex: 410000,
              opex_delta: 60000,
              oee_gain: '+7.8 pts',
              payback: 31,
              risk: 'High',
              status: 'todo',
              priority: 3,
              note: 'Board-scale move, should follow pilot proof.',
            },
          ]
        ),
    },
    {
      slug: 'table-partner-portfolio',
      title: 'Partner portfolio scoring matrix',
      body: 'Table workspace scoring partners by activation health, strategic fit, renewal potential, and channel readiness.',
      tags: ['atelier-toys', 'table', 'partners', 'scoring'],
      stage: 'shaping',
      area: 'Commercial',
      priority: 83,
      branch: 'strategy',
      preferredTool: 'table',
      buildMap: (ideaId) =>
        buildTableMap(
          ideaId,
          [
            { key: 'partner', header: 'Partner', type: 'text', visible: true, width: 190 },
            { key: 'region', header: 'Region', type: 'text', visible: true, width: 120 },
            {
              key: 'activation_score',
              header: 'Activation Score',
              type: 'number',
              visible: true,
              width: 130,
            },
            {
              key: 'renewal_risk',
              header: 'Renewal Risk',
              type: 'select',
              visible: true,
              width: 130,
              options: ['Low', 'Medium', 'High'],
            },
            {
              key: 'pipeline_quality',
              header: 'Pipeline Quality',
              type: 'text',
              visible: true,
              width: 130,
            },
            { key: 'status', header: 'Status', type: 'status', visible: true, width: 120 },
            { key: 'priority', header: 'Priority', type: 'rating', visible: true, width: 100 },
            { key: 'note', header: 'Next action', type: 'text', visible: true, width: 240 },
          ],
          [
            {
              partner: 'EduMotion France',
              region: 'France',
              activation_score: 87,
              renewal_risk: 'Low',
              pipeline_quality: 'Strong',
              status: 'done',
              priority: 5,
              note: 'Use as flagship reference partner.',
            },
            {
              partner: 'STEM Iberia',
              region: 'Spain',
              activation_score: 72,
              renewal_risk: 'Medium',
              pipeline_quality: 'Good',
              status: 'in_progress',
              priority: 4,
              note: 'Needs stronger onboarding cadence.',
            },
            {
              partner: 'NordLearn Distribution',
              region: 'Nordics',
              activation_score: 64,
              renewal_risk: 'Medium',
              pipeline_quality: 'Mixed',
              status: 'todo',
              priority: 3,
              note: 'Rework value messaging before expansion push.',
            },
            {
              partner: 'ClassFuture DACH',
              region: 'DACH',
              activation_score: 79,
              renewal_risk: 'Low',
              pipeline_quality: 'Strong',
              status: 'in_progress',
              priority: 4,
              note: 'Good candidate for analytics upsell pilot.',
            },
          ]
        ),
    },
    {
      slug: 'whiteboard-board-wall',
      title: 'Board wall: transformation proof and choices',
      body: 'Whiteboard summarizing what leadership should see before the next board decision cycle.',
      tags: ['atelier-toys', 'whiteboard', 'board', 'governance'],
      stage: 'ready',
      area: 'Executive',
      priority: 91,
      branch: 'strategy',
      preferredTool: 'whiteboard',
      buildMap: (ideaId) =>
        buildWhiteboardMap(ideaId, 'Transformation proof wall', {
          current: [
            'Board sees fragmented updates\nacross ops, finance, and growth',
            'ROI logic still debated\nlate in the cycle',
            'Follow-up ownership after decisions\nis inconsistent',
            'Supplier risk is visible only\nin finance review',
          ],
          future: [
            'One board scorecard\nfor value + risk',
            'Decision follow-up log\nowned by PMO',
            'Shared confidence bands\nfor ROI assumptions',
            'Board pack updated from live signals',
          ],
          actions: [
            'Finalize board scorecard v2',
            'Backfill last two decision cycles',
            'Refresh ROI logic for top 10 initiatives',
            'Pre-wire next board decision pack',
            'Assign explicit owners and deadlines',
          ],
          metrics: ['ROI confidence +', 'Prep time -35%'],
        }),
    },
    {
      slug: 'whiteboard-launch-war-room',
      title: 'Launch war room for Atelier Digital bundle',
      body: 'Whiteboard for launch coordination across product, marketing, partner enablement, and customer success.',
      tags: ['atelier-toys', 'whiteboard', 'launch', 'digital-growth'],
      stage: 'shaping',
      area: 'Growth / Product',
      priority: 82,
      branch: 'execution',
      preferredTool: 'whiteboard',
      buildMap: (ideaId) =>
        buildWhiteboardMap(ideaId, 'Bundle launch war room', {
          current: [
            'Messaging differs by region',
            'Support readiness trails packaging decisions',
            'Partner enablement is not sequenced',
            'No launch health dashboard shared daily',
          ],
          future: [
            'One launch narrative across channels',
            'Daily launch signal review',
            'Partner toolkit tied to real objections',
            'Launch issues escalated within 24h',
          ],
          actions: [
            'Create launch signal dashboard',
            'Align support readiness checklist',
            'Package partner objection handling',
            'Define first-2-week war-room cadence',
            'Prepare reference case asset',
          ],
          metrics: ['Attach +11 pts', 'Objection cycle shorter'],
        }),
    },
  ];
}

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  try {
    const row = await DbPromise.get<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = $1 AND column_name = $2
      ) AS exists`,
      [tableName, columnName],
      { fallback: true }
    );
    return Boolean(row?.exists);
  } catch {
    return false;
  }
}

async function tableExists(tableName: string): Promise<boolean> {
  try {
    const row = await DbPromise.get<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1
      ) AS exists`,
      [tableName],
      { fallback: true }
    );
    return Boolean(row?.exists);
  } catch {
    return false;
  }
}

async function getTableColumns(tableName: string): Promise<Set<string>> {
  try {
    const rows = await DbPromise.all<{ column_name: string }>(
      `SELECT LOWER(column_name) as column_name
       FROM information_schema.columns
       WHERE table_name = $1`,
      [tableName],
      { fallback: true }
    );
    return new Set(rows.map((r) => r.column_name).filter(Boolean));
  } catch {
    return new Set();
  }
}

async function upsertOrg(organizationId: string): Promise<void> {
  const hasIndustry = await columnExists('organizations', 'industry');
  const hasOrgType = await columnExists('organizations', 'organization_type');
  const hasIsActive = await columnExists('organizations', 'is_active');
  const hasTrialStart = await columnExists('organizations', 'trial_started_at');
  const hasTrialEnd = await columnExists('organizations', 'trial_expires_at');
  const hasAttribution = await columnExists('organizations', 'attribution_data');

  const cols = ['id', 'name', 'plan', 'status'];
  const vals: Array<string | number | null> = [organizationId, 'Atelier Toys', 'demo', 'active'];
  if (hasIndustry) {
    cols.push('industry');
    vals.push('edtech manufacturing');
  }
  if (hasOrgType) {
    cols.push('organization_type');
    vals.push('DEMO');
  }
  if (hasIsActive) {
    cols.push('is_active');
    vals.push(1);
  }
  if (hasTrialStart) {
    cols.push('trial_started_at');
    vals.push(new Date().toISOString());
  }
  if (hasTrialEnd) {
    cols.push('trial_expires_at');
    vals.push(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString());
  }
  if (hasAttribution) {
    cols.push('attribution_data');
    vals.push(
      JSON.stringify({
        demo: 'atelier-toys',
        story: 'Atelier Forward',
      })
    );
  }

  await DbPromise.run(
    `INSERT INTO organizations (${cols.join(', ')})
     VALUES (${cols.map(() => '?').join(', ')})
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, plan=excluded.plan, status=excluded.status`,
    vals,
    { fallback: false }
  );
}

function buildEmail(leader: DemoLeaderTemplate, organizationId: string): string {
  return (
    `${leader.firstName}.${leader.lastName}`.toLowerCase().replace(/\s+/g, '.') +
    `+${organizationId}@demo.ateliertoys.com`
  );
}

async function upsertUsers(organizationId: string, locale: DemoLocale): Promise<UserMap> {
  const hasPassword = await columnExists('users', 'password');
  const hasStatus = await columnExists('users', 'status');
  const hasCreatedAt = await columnExists('users', 'created_at');
  const userMap: UserMap = {};
  const leaders = getAtelierToysLeadership(locale);

  for (const leader of leaders) {
    const id = makeId(organizationId, 'user', leader.slug);
    const email = buildEmail(leader, organizationId);
    const cols = ['id', 'organization_id', 'email', 'first_name', 'last_name', 'role'];
    const vals: Array<string> = [
      id,
      organizationId,
      email,
      leader.firstName,
      leader.lastName,
      leader.role,
    ];
    if (hasPassword) {
      cols.push('password');
      vals.push('demo-not-used');
    }
    if (hasStatus) {
      cols.push('status');
      vals.push('active');
    }
    if (hasCreatedAt) {
      cols.push('created_at');
      vals.push(new Date().toISOString());
    }

    await DbPromise.run(
      `INSERT INTO users (${cols.join(', ')})
       VALUES (${cols.map(() => '?').join(', ')})
       ON CONFLICT(id) DO UPDATE SET organization_id=excluded.organization_id, email=excluded.email`,
      vals,
      { fallback: false }
    );

    userMap[leader.slug] = { id, email };
  }

  return userMap;
}

async function upsertTeams(
  organizationId: string,
  userMap: UserMap,
  locale: DemoLocale
): Promise<void> {
  if (!(await tableExists('teams'))) return;

  const teams = [
    {
      slug: 'executive-office',
      name: locale === 'pl' ? 'Biuro Zarządu' : 'Executive Office',
      lead: 'antoine-laurent',
      members: ['claire-laurent', 'julien-moreau', 'jean-claude-laurent', 'amelie-girard'],
    },
    {
      slug: 'factory-ops',
      name: locale === 'pl' ? 'Operacje Zakładu' : 'Factory Operations',
      lead: 'marc-dubois',
      members: ['luc-rousseau', 'sophie-bernard', 'paul-lambert'],
    },
    {
      slug: 'growth',
      name: locale === 'pl' ? 'Wzrost Cyfrowy' : 'Digital Growth',
      lead: 'camille-dubois',
      members: ['thomas-viau', 'lea-martin', 'zoe-perrin', 'nicolas-faure'],
    },
    {
      slug: 'finance-and-value',
      name: locale === 'pl' ? 'Finanse i Value Tracking' : 'Finance & Value Tracking',
      lead: 'claire-laurent',
      members: ['elise-robert', 'hugo-bernard'],
    },
    {
      slug: 'supply-control',
      name: locale === 'pl' ? 'Kontrola Łańcucha Dostaw' : 'Supply Control',
      lead: 'isabelle-leroy',
      members: ['mathieu-chevalier'],
    },
  ];

  const hasTeamMembers = await tableExists('team_members');
  for (const team of teams) {
    const teamId = makeId(organizationId, 'team', team.slug);
    await DbPromise.run(
      `INSERT INTO teams (id, organization_id, name, description, lead_id)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name=excluded.name, lead_id=excluded.lead_id`,
      [
        teamId,
        organizationId,
        team.name,
        locale === 'pl'
          ? `${team.name} dla demo workspace Atelier Forward.`
          : `${team.name} for the Atelier Forward demo workspace.`,
        userMap[team.lead]?.id || null,
      ],
      { fallback: true }
    );

    if (!hasTeamMembers) continue;
    const memberSlugs = [team.lead, ...team.members];
    for (const memberSlug of memberSlugs) {
      await DbPromise.run(
        `INSERT INTO team_members (team_id, user_id, role)
         VALUES (?, ?, ?)
         ON CONFLICT(team_id, user_id) DO UPDATE SET role=excluded.role`,
        [teamId, userMap[memberSlug]?.id, memberSlug === team.lead ? 'lead' : 'member'],
        { fallback: true }
      );
    }
  }
}

async function upsertProjects(
  organizationId: string,
  userMap: UserMap,
  locale: DemoLocale
): Promise<ProjectMap> {
  const projectMap: ProjectMap = {};
  const projects = getAtelierToysProjects(locale);
  const hasGoal = await columnExists('projects', 'goal');
  const hasHealth = await columnExists('projects', 'health');
  const hasProgress = await columnExists('projects', 'progress_pct');
  const hasOwner = await columnExists('projects', 'owner_id');
  const hasCurrentPhase = await columnExists('projects', 'current_phase');

  for (const project of projects) {
    const projectId = makeId(organizationId, 'project', project.slug);
    const cols = ['id', 'organization_id', 'name', 'description', 'status'];
    const vals: Array<string | number> = [
      projectId,
      organizationId,
      project.name,
      project.description,
      project.status,
    ];

    if (hasGoal) {
      cols.push('goal');
      vals.push(project.goal);
    }
    if (hasHealth) {
      cols.push('health');
      vals.push(project.health);
    }
    if (hasProgress) {
      cols.push('progress_pct');
      vals.push(project.progressPct);
    }
    if (hasOwner) {
      cols.push('owner_id');
      vals.push(userMap[project.owner]?.id || '');
    }
    if (hasCurrentPhase) {
      cols.push('current_phase');
      vals.push('Execution');
    }

    await DbPromise.run(
      `INSERT INTO projects (${cols.join(', ')})
       VALUES (${cols.map(() => '?').join(', ')})
       ON CONFLICT(id) DO UPDATE SET name=excluded.name, status=excluded.status`,
      vals,
      { fallback: false }
    );

    projectMap[project.slug] = projectId;
  }

  return projectMap;
}

async function upsertProjectUsers(
  projectMap: ProjectMap,
  userMap: UserMap,
  locale: DemoLocale
): Promise<void> {
  if (!(await tableExists('project_users'))) return;
  const leaders = getAtelierToysLeadership(locale);
  for (const projectId of Object.values(projectMap)) {
    for (const leader of leaders) {
      await DbPromise.run(
        `INSERT INTO project_users (project_id, user_id, role)
         VALUES (?, ?, ?)
         ON CONFLICT(project_id, user_id) DO UPDATE SET role=excluded.role`,
        [projectId, userMap[leader.slug]?.id, leader.role === 'ADMIN' ? 'owner' : 'member'],
        { fallback: true }
      );
    }
  }
}

async function upsertInitiatives(
  organizationId: string,
  userMap: UserMap,
  projectMap: ProjectMap,
  anchorDate: Date,
  locale: DemoLocale
): Promise<{ initiativeMap: InitiativeMap; taskCount: number; decisionCount: number }> {
  const initiativeMap: InitiativeMap = {};
  let taskCount = 0;
  let decisionCount = 0;
  const initiatives = getAtelierToysInitiatives(locale);

  const hasArea = await columnExists('initiatives', 'area');
  const hasSummary = await columnExists('initiatives', 'summary');
  const hasPriority = await columnExists('initiatives', 'priority');
  const hasPlannedStart = await columnExists('initiatives', 'planned_start_date');
  const hasPlannedEnd = await columnExists('initiatives', 'planned_end_date');
  const hasOwnerBusiness = await columnExists('initiatives', 'owner_business_id');
  const hasOwnerExecution = await columnExists('initiatives', 'owner_execution_id');
  const hasSponsor = await columnExists('initiatives', 'sponsor_id');
  const hasExpectedRoi = await columnExists('initiatives', 'expected_roi');
  const hasCapex = await columnExists('initiatives', 'cost_capex');
  const hasOpex = await columnExists('initiatives', 'cost_opex');
  const hasCurrentStage = await columnExists('initiatives', 'current_stage');
  const hasDeliverables = await columnExists('initiatives', 'deliverables');
  const hasSuccessCriteria = await columnExists('initiatives', 'success_criteria');
  const hasRisks = await columnExists('initiatives', 'key_risks');
  const hasEstimatedBudget = await columnExists('initiatives', 'estimated_budget');
  const hasTaskComments = await tableExists('task_comments');

  for (const initiative of initiatives) {
    const initiativeId = makeId(organizationId, 'initiative', initiative.slug);
    initiativeMap[initiative.slug] = initiativeId;

    const cols = ['id', 'organization_id', 'project_id', 'name', 'status'];
    const vals: Array<string | number | null> = [
      initiativeId,
      organizationId,
      projectMap[initiative.projectSlug],
      initiative.name,
      initiative.status,
    ];

    if (hasArea) {
      cols.push('area');
      vals.push(initiative.area);
    }
    if (hasSummary) {
      cols.push('summary');
      vals.push(initiative.summary);
    }
    if (hasPriority) {
      cols.push('priority');
      vals.push(initiative.priority);
    }
    if (hasPlannedStart) {
      cols.push('planned_start_date');
      vals.push(materializeRelativeIso(initiative.plannedStart, { anchorDate }));
    }
    if (hasPlannedEnd) {
      cols.push('planned_end_date');
      vals.push(materializeRelativeIso(initiative.plannedEnd, { anchorDate, asEndOfDay: true }));
    }
    if (hasOwnerBusiness) {
      cols.push('owner_business_id');
      vals.push(userMap[initiative.ownerBusiness]?.id || null);
    }
    if (hasOwnerExecution) {
      cols.push('owner_execution_id');
      vals.push(userMap[initiative.ownerExecution]?.id || null);
    }
    if (hasSponsor) {
      cols.push('sponsor_id');
      vals.push(userMap[initiative.sponsor]?.id || null);
    }
    if (hasExpectedRoi) {
      cols.push('expected_roi');
      vals.push(initiative.expectedRoi);
    }
    if (hasCapex) {
      cols.push('cost_capex');
      vals.push(initiative.budgetCapex);
    }
    if (hasOpex) {
      cols.push('cost_opex');
      vals.push(initiative.budgetOpex);
    }
    if (hasCurrentStage) {
      cols.push('current_stage');
      vals.push(initiative.currentStage || null);
    }
    if (hasDeliverables) {
      cols.push('deliverables');
      vals.push(JSON.stringify(initiative.deliverables));
    }
    if (hasSuccessCriteria) {
      cols.push('success_criteria');
      vals.push(JSON.stringify(initiative.successCriteria));
    }
    if (hasRisks) {
      cols.push('key_risks');
      vals.push(JSON.stringify(initiative.keyRisks));
    }
    if (hasEstimatedBudget) {
      cols.push('estimated_budget');
      vals.push(initiative.budgetCapex + initiative.budgetOpex);
    }

    await DbPromise.run(
      `INSERT INTO initiatives (${cols.join(', ')})
       VALUES (${cols.map(() => '?').join(', ')})
       ON CONFLICT(id) DO UPDATE SET name=excluded.name, status=excluded.status`,
      vals,
      { fallback: false }
    );

    for (const task of initiative.tasks) {
      taskCount += 1;
      const taskId = makeId(organizationId, 'task', task.slug);
      await DbPromise.run(
        `INSERT INTO tasks (
          id, project_id, organization_id, title, description, status, priority, assignee_id, reporter_id,
          due_date, task_type, initiative_id, why
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET title=excluded.title, status=excluded.status, due_date=excluded.due_date`,
        [
          taskId,
          projectMap[initiative.projectSlug],
          organizationId,
          task.title,
          task.description,
          task.status,
          task.priority,
          userMap[task.assignee]?.id || null,
          userMap[initiative.ownerExecution]?.id || null,
          materializeRelativeIso(task.dueDate, { anchorDate, asEndOfDay: true }),
          'execution',
          initiativeId,
          task.why,
        ],
        { fallback: true }
      );

      if (hasTaskComments) {
        await DbPromise.run(
          `INSERT INTO task_comments (id, task_id, user_id, content, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET content=excluded.content, updated_at=excluded.updated_at`,
          [
            `${taskId}--comment-1`,
            taskId,
            userMap[initiative.ownerExecution]?.id || userMap[task.assignee]?.id || null,
            `Latest checkpoint: ${task.why}`,
            new Date().toISOString(),
            new Date().toISOString(),
          ],
          { fallback: true }
        );
        await DbPromise.run(
          `INSERT INTO task_comments (id, task_id, user_id, content, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET content=excluded.content, updated_at=excluded.updated_at`,
          [
            `${taskId}--comment-2`,
            taskId,
            userMap[task.assignee]?.id || userMap[initiative.ownerBusiness]?.id || null,
            `Next action owner: ${task.assignee}. Target date stays anchored to the live demo clock.`,
            new Date().toISOString(),
            new Date().toISOString(),
          ],
          { fallback: true }
        );
      }
    }

    for (const decision of initiative.decisions) {
      decisionCount += 1;
      const decisionId = makeId(organizationId, 'decision', decision.slug);
      await DbPromise.run(
        `INSERT INTO decisions (
          id, organization_id, project_id, initiative_id, title, type, decision_maker_id, created_by,
          status, deadline, decision_rationale, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET title=excluded.title, status=excluded.status, deadline=excluded.deadline`,
        [
          decisionId,
          organizationId,
          projectMap[initiative.projectSlug],
          initiativeId,
          decision.title,
          'governance',
          userMap[decision.decisionMaker]?.id || null,
          userMap[initiative.ownerExecution]?.id || null,
          decision.status,
          materializeRelativeIso(decision.deadline, { anchorDate, asEndOfDay: true }),
          decision.rationale,
          new Date().toISOString(),
        ],
        { fallback: true }
      );
    }

    if (await tableExists('initiative_milestones')) {
      for (let index = 0; index < initiative.milestones.length; index += 1) {
        const milestone = initiative.milestones[index];
        await DbPromise.run(
          `INSERT INTO initiative_milestones (
            id, initiative_id, organization_id, name, description, target_date, status, order_index, is_gate, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET name=excluded.name, target_date=excluded.target_date, status=excluded.status`,
          [
            makeId(organizationId, 'milestone', milestone.slug),
            initiativeId,
            organizationId,
            milestone.name,
            milestone.description,
            materializeRelativeIso(milestone.targetDate, { anchorDate, asEndOfDay: true }).slice(
              0,
              10
            ),
            milestone.status,
            index,
            milestone.isGate ? 1 : 0,
            userMap[initiative.ownerExecution]?.id || null,
          ],
          { fallback: true }
        );
      }
    }
  }

  if (await tableExists('initiative_dependencies')) {
    const depCols = await getTableColumns('initiative_dependencies');
    const dependencies = [
      ['procurement-control-tower', 'line-3-digital-twin'],
      ['line-3-digital-twin', 'atelier-digital-growth'],
      ['supplier-risk-war-room', 'partner-onboarding-excellence'],
      ['qa-defect-closing-loop', 'line-3-digital-twin'],
      ['product-roadmap-sync', 'atelier-digital-growth'],
      ['supervisor-capability-academy', 'line-3-digital-twin'],
      ['board-value-tracking', 'product-roadmap-sync'],
      ['ot-cyber-hardening', 'line-3-digital-twin'],
      ['atelier-motion-concept-lab', 'atelier-core-onboarding-revamp'],
      ['predictive-maintenance-rollout', 'board-value-tracking'],
    ];
    for (const [fromSlug, toSlug] of dependencies) {
      const depId = makeId(organizationId, 'dependency', `${fromSlug}--${toSlug}`);
      const fromId = initiativeMap[fromSlug];
      const toId = initiativeMap[toSlug];
      const cols: string[] = ['id', 'organization_id', 'project_id'];
      const vals: (string | null)[] = [depId, organizationId, projectMap['forward-pmo']];

      if (depCols.has('from_initiative_id')) {
        cols.push('from_initiative_id');
        vals.push(fromId);
      }
      if (depCols.has('to_initiative_id')) {
        cols.push('to_initiative_id');
        vals.push(toId);
      }
      if (depCols.has('source_id')) {
        cols.push('source_id');
        vals.push(fromId);
      }
      if (depCols.has('target_id')) {
        cols.push('target_id');
        vals.push(toId);
      }
      if (depCols.has('type')) {
        cols.push('type');
        vals.push('FINISH_TO_START');
      }
      if (depCols.has('dependency_type')) {
        cols.push('dependency_type');
        vals.push('finish_to_start');
      }
      if (depCols.has('created_by')) {
        cols.push('created_by');
        vals.push(userMap['antoine-laurent']?.id || null);
      }

      const ph = cols.map((_, i) => `$${i + 1}`).join(', ');
      await DbPromise.run(
        `INSERT INTO initiative_dependencies (${cols.join(', ')})
         VALUES (${ph})
         ON CONFLICT(id) DO UPDATE SET ${depCols.has('type') ? 'type=excluded.type' : 'id=excluded.id'}`,
        vals,
        { fallback: true }
      );
    }
  }

  return { initiativeMap, taskCount, decisionCount };
}

async function upsertReports(
  organizationId: string,
  projectMap: ProjectMap,
  userMap: UserMap,
  anchorDate: Date,
  locale: DemoLocale
): Promise<number> {
  if (!(await tableExists('status_reports'))) return 0;
  const reports = getAtelierToysReports(locale);
  for (const report of reports) {
    await DbPromise.run(
      `INSERT INTO status_reports (
        id, organization_id, project_id, title, content, health, period, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET title=excluded.title, content=excluded.content, health=excluded.health`,
      [
        makeId(organizationId, 'report', report.slug),
        organizationId,
        projectMap[report.projectSlug],
        report.title,
        report.content,
        report.health,
        report.period,
        userMap[report.createdBy]?.id || null,
        materializeRelativeIso(report.createdAt, { anchorDate }),
      ],
      { fallback: true }
    );
  }

  return reports.length;
}

async function upsertKnowledgeDocs(organizationId: string, locale: DemoLocale): Promise<number> {
  if (!(await tableExists('knowledge_docs'))) return 0;
  const hasCategory = await columnExists('knowledge_docs', 'category');
  const hasMetadata = await columnExists('knowledge_docs', 'metadata');
  const hasIndexedAt = await columnExists('knowledge_docs', 'indexed_at');
  const hasUpdatedAt = await columnExists('knowledge_docs', 'updated_at');

  const supportsChunks = await tableExists('knowledge_chunks');

  const docs = getAtelierToysKnowledgeDocs(locale);
  for (const doc of docs) {
    const docId = makeId(organizationId, 'doc', doc.slug);
    const cols = ['id', 'filename', 'filepath', 'status', 'organization_id', 'source_type'];
    const vals: Array<string> = [
      docId,
      `${doc.title}.md`,
      `/demo/${organizationId}/${doc.slug}.md`,
      'indexed',
      organizationId,
      'demo_seed',
    ];
    if (hasCategory) {
      cols.push('category');
      vals.push(doc.category);
    }
    if (hasMetadata) {
      cols.push('metadata');
      vals.push(JSON.stringify({ demo: 'atelier-toys', category: doc.category }));
    }
    if (hasIndexedAt) {
      cols.push('indexed_at');
      vals.push(new Date().toISOString());
    }
    if (hasUpdatedAt) {
      cols.push('updated_at');
      vals.push(new Date().toISOString());
    }

    await DbPromise.run(
      `INSERT INTO knowledge_docs (${cols.join(', ')})
       VALUES (${cols.map(() => '?').join(', ')})
       ON CONFLICT(id) DO UPDATE SET filename=excluded.filename, status=excluded.status`,
      vals,
      { fallback: true }
    );

    if (supportsChunks) {
      await DbPromise.run(
        `INSERT INTO knowledge_chunks (id, doc_id, content, chunk_index, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET content=excluded.content`,
        [
          makeId(organizationId, 'chunk', doc.slug),
          docId,
          doc.body,
          0,
          JSON.stringify({ demo: true, source: doc.slug }),
          new Date().toISOString(),
        ],
        { fallback: true }
      );
    }
  }

  return docs.length;
}

async function upsertPrompts(
  organizationId: string,
  userMap: UserMap,
  locale: DemoLocale
): Promise<void> {
  if (!(await tableExists('custom_prompts'))) return;
  for (const prompt of getAtelierToysPrompts(locale)) {
    await DbPromise.run(
      `INSERT INTO custom_prompts (id, organization_id, name, context, template, variables, is_active, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name=excluded.name, template=excluded.template`,
      [
        makeId(organizationId, 'prompt', prompt.slug),
        organizationId,
        prompt.name,
        prompt.context,
        prompt.template,
        JSON.stringify(['company', 'role']),
        1,
        userMap[prompt.createdBy]?.id || null,
      ],
      { fallback: true }
    );
  }
}

async function upsertToolSessions(
  organizationId: string,
  projectMap: ProjectMap,
  userMap: UserMap,
  locale: DemoLocale
): Promise<void> {
  const toolTable = (await tableExists('tool_sessions'))
    ? 'tool_sessions'
    : (await tableExists('sessions'))
      ? 'sessions'
      : null;
  if (!toolTable) return;

  const tools = [
    {
      slug: 'exec-overview',
      name: locale === 'pl' ? 'Executive Overview' : 'Executive Overview',
      type: 'executive',
      project: 'forward-pmo',
    },
    {
      slug: 'factory-ops',
      name: locale === 'pl' ? 'Szczegóły operacji zakładu' : 'Factory Operations Drilldown',
      type: 'operations',
      project: 'factory-excellence',
    },
    {
      slug: 'growth-review',
      name: locale === 'pl' ? 'Przegląd wzrostu cyfrowego' : 'Digital Growth Review',
      type: 'growth',
      project: 'digital-growth',
    },
  ];

  for (const tool of tools) {
    const id = makeId(organizationId, 'tool', tool.slug);
    if (toolTable === 'tool_sessions') {
      await DbPromise.run(
        `INSERT INTO tool_sessions (id, organization_id, project_id, name, tool_type, output_json, created_by, updated_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, output_json=excluded.output_json`,
        [
          id,
          organizationId,
          projectMap[tool.project],
          tool.name,
          tool.type,
          JSON.stringify({
            story: 'atelier-toys',
            recommendedScenario: tool.slug,
          }),
          userMap['antoine-laurent']?.id || null,
          userMap['antoine-laurent']?.id || null,
          new Date().toISOString(),
          new Date().toISOString(),
        ],
        { fallback: true }
      );
    } else {
      await DbPromise.run(
        `INSERT INTO sessions (id, user_id, project_id, type, data, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET data=excluded.data`,
        [
          id,
          userMap['antoine-laurent']?.id || null,
          projectMap[tool.project],
          'tool_session',
          JSON.stringify({ name: tool.name, category: tool.type, story: 'atelier-toys' }),
          new Date().toISOString(),
        ],
        { fallback: true }
      );
    }
  }
}

async function upsertNotebookPages(
  organizationId: string,
  ownerUserId: string,
  projectId: string | null,
  locale: DemoLocale
): Promise<number> {
  if (!(await tableExists('notebook_pages'))) return 0;

  const hasIcon = await columnExists('notebook_pages', 'icon');
  const hasMaturity = await columnExists('notebook_pages', 'maturity');
  const hasStatus = await columnExists('notebook_pages', 'status');
  const notes = buildDemoNotebooks(locale);

  for (const note of notes) {
    const cols = [
      'id',
      'owner_user_id',
      'organization_id',
      'project_id',
      'visibility',
      'title',
      'content_json',
      'content_text',
      'tags_json',
      'created_at',
      'updated_at',
    ];
    const vals: Array<string | null> = [
      makeId(organizationId, 'note', note.slug),
      ownerUserId,
      organizationId,
      projectId,
      'private',
      note.title,
      JSON.stringify(markdownBlocksToDocJson(note.contentText)),
      note.contentText,
      JSON.stringify(note.tags),
      new Date().toISOString(),
      new Date().toISOString(),
    ];
    if (hasIcon) {
      cols.push('icon');
      vals.push(note.icon);
    }
    if (hasMaturity) {
      cols.push('maturity');
      vals.push(note.maturity);
    }
    if (hasStatus) {
      cols.push('status');
      vals.push(note.status);
    }

    await DbPromise.run(
      `INSERT INTO notebook_pages (${cols.join(', ')})
       VALUES (${cols.map(() => '?').join(', ')})
       ON CONFLICT(id) DO UPDATE SET title=excluded.title, content_json=excluded.content_json, updated_at=excluded.updated_at`,
      vals,
      { fallback: true }
    );
  }

  return notes.length;
}

async function upsertIdeaWorkspaces(
  organizationId: string,
  ownerUserId: string,
  locale: DemoLocale
): Promise<number> {
  if (!(await tableExists('my_ideas')) || !(await tableExists('my_idea_maps'))) return 0;

  const ideaColsSupport = {
    tags: await columnExists('my_ideas', 'tags'),
    stage: await columnExists('my_ideas', 'stage'),
    area: await columnExists('my_ideas', 'area'),
    priority: await columnExists('my_ideas', 'priority'),
    branch: await columnExists('my_ideas', 'branch'),
    sourceType: await columnExists('my_ideas', 'source_type'),
  };
  const mapColsSupport = {
    extensionsJson: await columnExists('my_idea_maps', 'extensions_json'),
    preferredTool: await columnExists('my_idea_maps', 'preferred_tool'),
    schemaVersion: await columnExists('my_idea_maps', 'schema_version'),
  };

  const ideas = buildDemoIdeas(locale);
  for (const idea of ideas) {
    const ideaId = makeId(organizationId, 'idea', idea.slug);
    const map = idea.buildMap(ideaId);

    const ideaCols = [
      'id',
      'user_id',
      'organization_id',
      'title',
      'body',
      'created_at',
      'updated_at',
    ];
    const ideaVals: Array<string | number> = [
      ideaId,
      ownerUserId,
      organizationId,
      idea.title,
      idea.body,
      new Date().toISOString(),
      new Date().toISOString(),
    ];
    if (ideaColsSupport.tags) {
      ideaCols.push('tags');
      ideaVals.push(JSON.stringify(idea.tags));
    }
    if (ideaColsSupport.sourceType) {
      ideaCols.push('source_type');
      ideaVals.push('seed');
    }
    if (ideaColsSupport.stage) {
      ideaCols.push('stage');
      ideaVals.push(idea.stage);
    }
    if (ideaColsSupport.area) {
      ideaCols.push('area');
      ideaVals.push(idea.area);
    }
    if (ideaColsSupport.priority) {
      ideaCols.push('priority');
      ideaVals.push(idea.priority);
    }
    if (ideaColsSupport.branch) {
      ideaCols.push('branch');
      ideaVals.push(idea.branch);
    }

    await DbPromise.run(
      `INSERT INTO my_ideas (${ideaCols.join(', ')})
       VALUES (${ideaCols.map(() => '?').join(', ')})
       ON CONFLICT(id) DO UPDATE SET title=excluded.title, body=excluded.body, updated_at=excluded.updated_at`,
      ideaVals,
      { fallback: true }
    );

    const mapCols = [
      'id',
      'idea_id',
      'user_id',
      'organization_id',
      'nodes_json',
      'edges_json',
      'version',
      'created_at',
      'updated_at',
    ];
    const mapVals: Array<string | number> = [
      makeId(organizationId, 'idea-map', idea.slug),
      ideaId,
      ownerUserId,
      organizationId,
      JSON.stringify(map.nodes),
      JSON.stringify(map.edges),
      map.version,
      new Date().toISOString(),
      new Date().toISOString(),
    ];
    if (mapColsSupport.extensionsJson) {
      mapCols.push('extensions_json');
      mapVals.push(JSON.stringify(map.extensions || {}));
    }
    if (mapColsSupport.preferredTool) {
      mapCols.push('preferred_tool');
      mapVals.push(idea.preferredTool);
    }
    if (mapColsSupport.schemaVersion) {
      mapCols.push('schema_version');
      mapVals.push('v1');
    }

    await DbPromise.run(
      `INSERT INTO my_idea_maps (${mapCols.join(', ')})
       VALUES (${mapCols.map(() => '?').join(', ')})
       ON CONFLICT(user_id, idea_id) DO UPDATE SET
         nodes_json=excluded.nodes_json,
         edges_json=excluded.edges_json,
         version=excluded.version,
         updated_at=excluded.updated_at${
           mapColsSupport.extensionsJson ? ', extensions_json=excluded.extensions_json' : ''
         }${mapColsSupport.preferredTool ? ', preferred_tool=excluded.preferred_tool' : ''}${
           mapColsSupport.schemaVersion ? ', schema_version=excluded.schema_version' : ''
         }`,
      mapVals,
      { fallback: true }
    );
  }

  return ideas.length;
}

async function upsertDrdAssessment(
  organizationId: string,
  userMap: UserMap,
  projectMap: ProjectMap,
  anchorDate: Date,
  locale: DemoLocale
): Promise<void> {
  if (!(await tableExists('assessments'))) return;

  const assessmentId = makeId(organizationId, 'assessment', 'drd-atelier-forward-baseline');
  const reportId = makeId(organizationId, 'assessment-report', 'drd-atelier-forward-baseline');
  const ownerUserId = userMap['antoine-laurent']?.id || null;
  const projectId = projectMap['forward-pmo'] || null;
  const nowIso = new Date().toISOString();

  const answers = {
    drd: {
      areas: buildDemoDrdAreas(
        {
          1: { achieved: 4, target: 6 },
          2: { achieved: 3, target: 5 },
          3: { achieved: 3, target: 5 },
          4: { achieved: 4, target: 6 },
          5: { achieved: 3, target: 5 },
          6: { achieved: 2, target: 4 },
          7: { achieved: 2, target: 4 },
        },
        {
          '1A':
            locale === 'pl'
              ? 'Ścieżki klienta i partnera są coraz lepiej uporządkowane, ale insight o odnowieniach nadal jest rozproszony między zespołami.'
              : 'Customer and partner journeys are increasingly structured, but renewal insight is still fragmented across teams.',
          '1F':
            locale === 'pl'
              ? 'Telemetria zakładowa działa już na kluczowych liniach, ale jakość sygnału i taksonomia zdarzeń nadal nie są wystarczająco stabilne do pewnego skalowania.'
              : 'Plant telemetry is already in place on key lines, yet signal quality and event taxonomy are not stable enough for confident scale.',
          '2C':
            locale === 'pl'
              ? 'Governance portfolio istnieje, ale priorytetyzacja nadal zbyt mocno zależy od siły sponsora zamiast wspólnej logiki wartości.'
              : 'Portfolio governance exists, but prioritization still leans too heavily on sponsor push instead of shared value logic.',
          '3B':
            locale === 'pl'
              ? 'Zespoły produktu cyfrowego i operacji współpracują lepiej niż wcześniej, choć handovery nadal tworzą tarcie w oknach launchowych.'
              : 'Digital product and operations teams collaborate better than before, though hand-offs still create friction during launch windows.',
          '4D':
            locale === 'pl'
              ? 'Wspólny fundament danych istnieje, ale finanse i operacje nadal ręcznie uzgadniają część liczb wartości przed review boardowym.'
              : 'A shared data foundation exists, but finance and operations still reconcile some value numbers manually before board reviews.',
          '5A':
            locale === 'pl'
              ? 'Rutyny leadershipu się poprawiają, jednak adopcja front-line nadal zależy od kilku silnych managerów zamiast od systemowych nawyków.'
              : 'Leadership routines are improving, however front-line adoption still depends on a few strong managers rather than system habits.',
          '6B':
            locale === 'pl'
              ? 'Kontrole cyber poprawiły się wokół perymetru i dostępu, ale segmentacja OT/IT pozostaje nierówna między zakładami.'
              : 'Cyber controls improved around perimeter and access, but OT/IT segmentation remains uneven across sites.',
          '7A':
            locale === 'pl'
              ? 'Use case’y AI pokazują potencjał w jakości i planowaniu, ale governance i monitoring nie są jeszcze uprzemysłowione.'
              : 'AI use cases show promise in quality and planning, but governance and monitoring are not yet industrialized.',
        }
      ),
    },
  };

  const contextSnapshot = {
    demo: true,
    storyline: 'Atelier Forward',
    audit: {
      phase: 'APPROVAL',
      notes:
        locale === 'pl'
          ? 'Baseline DRD zasilony do demo, aby pokazać realistyczną ocenę transformacji, która przechodzi do inicjatyw, roadmapy i raportowania executive.'
          : 'Baseline DRD seeded for demo to show a realistic transformation assessment that feeds initiatives, roadmap, and executive reporting.',
    },
    scope: {
      plants: 2,
      businessUnits: ['Production', 'Digital Products', 'Supply Chain', 'Commercial'],
      timeframe: 'rolling-90-days',
    },
  };

  const scoreSummary = {
    overall: { actual: 3.3, target: 5.0, gap: 1.7 },
    topStrengths:
      locale === 'pl'
        ? ['Fundament telemetrii fabryki', 'Sponsoring leadershipu', 'Narracja wzrostu cyfrowego']
        : ['Factory telemetry foundation', 'Leadership sponsorship', 'Digital growth narrative'],
    topGaps:
      locale === 'pl'
        ? ['Dojrzałość cyber OT', 'Dyscyplina dowodzenia wartości', 'Model operacyjny AI']
        : ['OT cyber maturity', 'Value evidence discipline', 'AI operating model'],
    seeded: true,
  };

  const assessmentCols = [
    'id',
    'organization_id',
    'project_id',
    'assessment_type',
    'name',
    'status',
  ];
  const assessmentVals: Array<string | number | null> = [
    assessmentId,
    organizationId,
    projectId,
    'DRD',
    locale === 'pl' ? 'Baseline DRD - Atelier Forward' : 'DRD Baseline - Atelier Forward',
    'APPROVED',
  ];

  if (await columnExists('assessments', 'framework')) {
    assessmentCols.push('framework');
    assessmentVals.push('DRD');
  }
  if (await columnExists('assessments', 'completion_percent')) {
    assessmentCols.push('completion_percent');
    assessmentVals.push(100);
  }
  if (await columnExists('assessments', 'confidence_avg')) {
    assessmentCols.push('confidence_avg');
    assessmentVals.push(3.6);
  }
  if (await columnExists('assessments', 'overall_score')) {
    assessmentCols.push('overall_score');
    assessmentVals.push(3.3);
  }
  if (await columnExists('assessments', 'answers_json')) {
    assessmentCols.push('answers_json');
    assessmentVals.push(JSON.stringify(answers));
  }
  if (await columnExists('assessments', 'answers')) {
    assessmentCols.push('answers');
    assessmentVals.push(JSON.stringify(answers));
  }
  if (await columnExists('assessments', 'context_snapshot')) {
    assessmentCols.push('context_snapshot');
    assessmentVals.push(JSON.stringify(contextSnapshot));
  }
  if (await columnExists('assessments', 'score_summary')) {
    assessmentCols.push('score_summary');
    assessmentVals.push(JSON.stringify(scoreSummary));
  }
  if (await columnExists('assessments', 'navigation_json')) {
    assessmentCols.push('navigation_json');
    assessmentVals.push(
      JSON.stringify({
        sectionsVisited: ['summary', 'axes', 'gaps', 'recommendations'],
        seededAt: nowIso,
      })
    );
  }
  if (await columnExists('assessments', 'created_by')) {
    assessmentCols.push('created_by');
    assessmentVals.push(ownerUserId);
  }
  if (await columnExists('assessments', 'updated_by')) {
    assessmentCols.push('updated_by');
    assessmentVals.push(ownerUserId);
  }
  if (await columnExists('assessments', 'report_approved_at')) {
    assessmentCols.push('report_approved_at');
    assessmentVals.push(materializeRelativeIso('-2d', { anchorDate }));
  }
  if (await columnExists('assessments', 'created_at')) {
    assessmentCols.push('created_at');
    assessmentVals.push(materializeRelativeIso('-12d', { anchorDate }));
  }
  if (await columnExists('assessments', 'updated_at')) {
    assessmentCols.push('updated_at');
    assessmentVals.push(materializeRelativeIso('-1d', { anchorDate }));
  }

  await DbPromise.run(
    `INSERT INTO assessments (${assessmentCols.join(', ')})
     VALUES (${assessmentCols.map(() => '?').join(', ')})
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name,
       status=excluded.status${assessmentCols.includes('answers_json') ? ', answers_json=excluded.answers_json' : ''}${
         assessmentCols.includes('context_snapshot')
           ? ', context_snapshot=excluded.context_snapshot'
           : ''
       }${assessmentCols.includes('score_summary') ? ', score_summary=excluded.score_summary' : ''}`,
    assessmentVals,
    { fallback: true }
  );

  if (!(await tableExists('assessment_reports'))) return;

  const reportCols = ['id', 'assessment_id', 'organization_id', 'project_id', 'name', 'status'];
  const reportVals: Array<string | number | null> = [
    reportId,
    assessmentId,
    organizationId,
    projectId,
    locale === 'pl'
      ? 'Raport z baseline DRD - Atelier Forward'
      : 'DRD Baseline Report - Atelier Forward',
    'APPROVED',
  ];

  if (await columnExists('assessment_reports', 'axis_data')) {
    reportCols.push('axis_data');
    reportVals.push(JSON.stringify(scoreSummary));
  }
  if (await columnExists('assessment_reports', 'executive_summary')) {
    reportCols.push('executive_summary');
    reportVals.push(
      locale === 'pl'
        ? 'Atelier Toys ma silną energię transformacyjną i widoczną trakcję cyfrową, ale nadal potrzebuje mocniejszego dowodzenia wartości, lepszej kontroli ryzyka OT i bardziej powtarzalnych rutyn operacyjnych.'
        : 'Atelier Toys has strong transformation energy and visible digital traction, but still needs tighter value evidence, OT risk control, and more repeatable operating routines.'
    );
  }
  if (await columnExists('assessment_reports', 'recommendations')) {
    reportCols.push('recommendations');
    reportVals.push(
      locale === 'pl'
        ? 'Nadać priorytet hardeningowi cyber OT, board-grade value tracking i operacjonalizacji use case’ów AI przed dalszym rozszerzaniem portfolio.'
        : 'Prioritize OT cyber hardening, board-grade value tracking, and operationalization of AI use cases before expanding the portfolio further.'
    );
  }
  if (await columnExists('assessment_reports', 'generated_by')) {
    reportCols.push('generated_by');
    reportVals.push(ownerUserId);
  }
  if (await columnExists('assessment_reports', 'created_by')) {
    reportCols.push('created_by');
    reportVals.push(ownerUserId);
  }
  if (await columnExists('assessment_reports', 'updated_by')) {
    reportCols.push('updated_by');
    reportVals.push(ownerUserId);
  }
  if (await columnExists('assessment_reports', 'approved_by')) {
    reportCols.push('approved_by');
    reportVals.push(ownerUserId);
  }
  if (await columnExists('assessment_reports', 'approved_at')) {
    reportCols.push('approved_at');
    reportVals.push(materializeRelativeIso('-2d', { anchorDate }));
  }
  if (await columnExists('assessment_reports', 'created_at')) {
    reportCols.push('created_at');
    reportVals.push(materializeRelativeIso('-4d', { anchorDate }));
  }
  if (await columnExists('assessment_reports', 'updated_at')) {
    reportCols.push('updated_at');
    reportVals.push(materializeRelativeIso('-1d', { anchorDate }));
  }

  await DbPromise.run(
    `INSERT INTO assessment_reports (${reportCols.join(', ')})
     VALUES (${reportCols.map(() => '?').join(', ')})
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name,
       status=excluded.status`,
    reportVals,
    { fallback: true }
  );

  if (!(await tableExists('assessment_report_sections'))) return;

  const sections = [
    {
      slug: 'summary',
      type: 'executive_summary',
      title: locale === 'pl' ? 'Podsumowanie Executive' : 'Executive Summary',
      order: 0,
      content:
        locale === 'pl'
          ? 'Atelier Forward jest wiarygodny i nabiera tempa, ale leadership nadal opiera się na częściowych dowodach, gdy przekłada postęp delivery na zrealizowaną wartość. Najmocniejszym kolejnym krokiem jest profesjonalizacja value trackingu przy jednoczesnym domknięciu governance OT i AI.'
          : 'Atelier Forward is credible and moving, but leadership still relies on partial evidence when translating delivery progress into realized value. The strongest next step is to professionalize value tracking while tightening OT and AI governance.',
    },
    {
      slug: 'maturity-overview',
      type: 'maturity_overview',
      title: locale === 'pl' ? 'Przegląd Dojrzałości' : 'Maturity Overview',
      order: 1,
      content:
        locale === 'pl'
          ? 'Najsilniejsze obszary dojrzałości to sponsoring transformacji, narracja produktowa i fundamenty telemetrii. Największe luki leżą w powtarzalnym governance, dyscyplinie cyber i zamienianiu pilotażowych sukcesów AI w model operacyjny.'
          : 'Current maturity is strongest in transformation sponsorship, product narrative, and core telemetry foundations. The largest gaps sit in repeatable governance, cyber discipline, and turning pilot-level AI success into an operational model.',
    },
    {
      slug: 'recommendations',
      type: 'recommendations',
      title: locale === 'pl' ? 'Rekomendacje Priorytetowe' : 'Priority Recommendations',
      order: 2,
      content:
        locale === 'pl'
          ? '1. Ustabilizować board-grade evidence wartości.\n2. Sfinansować OT cyber hardening jako capability enablingowe.\n3. Zbudować jeden model operacyjny dla use case’ów AI obejmujący jakość danych, ownership i monitoring.\n4. Używać portfolio inicjatyw do pokazywania dyscypliny cyklu życia, a nie tylko wolumenu aktywności.'
          : '1. Stabilize board-grade value evidence.\n2. Fund OT cyber hardening as an enabling capability.\n3. Create one operating model for AI use cases spanning data quality, ownership, and monitoring.\n4. Use the initiative portfolio to show lifecycle discipline, not just activity volume.',
    },
  ];

  for (const section of sections) {
    await DbPromise.run(
      `INSERT INTO assessment_report_sections (
        id, report_id, section_type, title, content, order_index, is_ai_generated, version, created_by, updated_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET title=excluded.title, content=excluded.content, order_index=excluded.order_index`,
      [
        makeId(organizationId, 'assessment-report-section', section.slug),
        reportId,
        section.type,
        section.title,
        section.content,
        section.order,
        0,
        1,
        ownerUserId,
        ownerUserId,
        materializeRelativeIso('-4d', { anchorDate }),
        materializeRelativeIso('-1d', { anchorDate }),
      ],
      { fallback: true }
    );
  }

  if (!(await tableExists('assessment_sessions'))) return;

  const respondentContextBySlug: Record<
    string,
    { functionName: string; operatingSurface: string; recurringConstraint: string; leveragePoint: string }
  > = {
    'antoine-laurent': {
      functionName: 'CEO',
      operatingSurface: 'executive portfolio cadence',
      recurringConstraint: 'inconsistent value evidence across workstreams',
      leveragePoint: 'one decision rhythm tied to measurable outcomes',
    },
    'claire-laurent': {
      functionName: 'CFO & Head of People',
      operatingSurface: 'finance and capability planning',
      recurringConstraint: 'manual reconciliation between cost and impact views',
      leveragePoint: 'faster confidence-weighted ROI governance',
    },
    'julien-moreau': {
      functionName: 'CTO',
      operatingSurface: 'digital platform and OT integration',
      recurringConstraint: 'handoff gaps between product and plant teams',
      leveragePoint: 'clear ownership for platform hardening and rollout quality',
    },
    'marc-dubois': {
      functionName: 'Plant Manager',
      operatingSurface: 'shop-floor throughput and escalation',
      recurringConstraint: 'changeover variance and downtime response delays',
      leveragePoint: 'daily routines anchored in line-level telemetry',
    },
    'isabelle-leroy': {
      functionName: 'Procurement Director',
      operatingSurface: 'supplier risk and inventory resilience',
      recurringConstraint: 'volatile lead times on critical components',
      leveragePoint: 'scenario-driven sourcing decisions with board visibility',
    },
    'luc-rousseau': {
      functionName: 'Maintenance Lead',
      operatingSurface: 'predictive maintenance operations',
      recurringConstraint: 'alert noise and limited technician bandwidth',
      leveragePoint: 'higher signal quality and clearer intervention priority',
    },
    'sophie-bernard': {
      functionName: 'QA Director',
      operatingSurface: 'quality closure loop',
      recurringConstraint: 'slow cross-plant corrective action closure',
      leveragePoint: 'faster root-cause governance with shared taxonomy',
    },
    'thomas-viau': {
      functionName: 'VP Sales',
      operatingSurface: 'partner-led growth motion',
      recurringConstraint: 'inconsistent conversion story across regions',
      leveragePoint: 'playbooks tied to activation and renewal signals',
    },
    'camille-dubois': {
      functionName: 'Marketing Director',
      operatingSurface: 'go-to-market narrative and enablement',
      recurringConstraint: 'message drift between launch and field execution',
      leveragePoint: 'evidence-backed positioning linked to adoption outcomes',
    },
    'jean-claude-laurent': {
      functionName: 'Senior Advisor',
      operatingSurface: 'board oversight',
      recurringConstraint: 'weak continuity of follow-up after strategic decisions',
      leveragePoint: 'explicit accountability by decision cycle',
    },
    'amelie-girard': {
      functionName: 'PMO Director',
      operatingSurface: 'initiative governance',
      recurringConstraint: 'dependency conflicts discovered too late',
      leveragePoint: 'earlier risk signaling and stage-gate discipline',
    },
    'nicolas-faure': {
      functionName: 'Head of Product',
      operatingSurface: 'roadmap trade-off decisions',
      recurringConstraint: 'fragmented demand signals from partners and customers',
      leveragePoint: 'evidence hierarchy for prioritization',
    },
    'lea-martin': {
      functionName: 'Customer Success Lead',
      operatingSurface: 'onboarding and activation',
      recurringConstraint: 'inconsistent first-30-day execution',
      leveragePoint: 'repeatable adoption interventions and early warning indicators',
    },
    'paul-lambert': {
      functionName: 'Industrial Data Lead',
      operatingSurface: 'telemetry and KPI integrity',
      recurringConstraint: 'definition drift between teams',
      leveragePoint: 'single metric contract with confidence labels',
    },
    'elise-robert': {
      functionName: 'Finance Controller',
      operatingSurface: 'value tracking and reporting',
      recurringConstraint: 'late validation of realized benefits',
      leveragePoint: 'faster evidence chain from initiative to margin impact',
    },
    'mathieu-chevalier': {
      functionName: 'Supply Planner',
      operatingSurface: 'demand and capacity planning',
      recurringConstraint: 'short-horizon fire-fighting due to supplier shocks',
      leveragePoint: 'linked scenario planning across planning and procurement',
    },
    'zoe-perrin': {
      functionName: 'Partner Program Manager',
      operatingSurface: 'partner onboarding funnel',
      recurringConstraint: 'drop-off after initial training completion',
      leveragePoint: 'milestone-based partner activation governance',
    },
    'hugo-bernard': {
      functionName: 'Transformation Analyst',
      operatingSurface: 'executive insight synthesis',
      recurringConstraint: 'evidence scattered across tools and cadences',
      leveragePoint: 'single narrative with explicit confidence and ownership',
    },
    'emma-noel': {
      functionName: 'Learning Experience Manager',
      operatingSurface: 'educator enablement programs',
      recurringConstraint: 'content completion without behavior change',
      leveragePoint: 'learning journeys tied to operational outcomes',
    },
    'damien-petit': {
      functionName: 'Manufacturing Excellence Lead',
      operatingSurface: 'standard work deployment',
      recurringConstraint: 'line-to-line variation despite shared SOPs',
      leveragePoint: 'coached routine adoption and exception analytics',
    },
    'ines-garnier': {
      functionName: 'Revenue Operations Analyst',
      operatingSurface: 'pipeline and renewal intelligence',
      recurringConstraint: 'weak traceability from activity to revenue quality',
      leveragePoint: 'unified funnel metrics with leading risk indicators',
    },
    'victor-morin': {
      functionName: 'OT Security Program Lead',
      operatingSurface: 'plant cyber risk hardening',
      recurringConstraint: 'uneven control maturity across facilities',
      leveragePoint: 'site-by-site control roadmap with measurable closure',
    },
  };

  const questionThemes: Record<string, { pl: string; en: string; signal: string }> = {
    q01_strategy_focus: {
      pl: 'spójność strategicznych priorytetów z codziennym execution',
      en: 'alignment between strategy priorities and daily execution',
      signal: 'decision clarity',
    },
    q02_value_evidence: {
      pl: 'jakość dowodzenia wartości i twardych efektów',
      en: 'quality of value evidence and hard outcomes',
      signal: 'value confidence',
    },
    q03_portfolio_governance: {
      pl: 'governance portfela i praca na zależnościach',
      en: 'portfolio governance and dependency management',
      signal: 'portfolio control',
    },
    q04_execution_rhythm: {
      pl: 'rytm delivery, eskalacje i decyzje operacyjne',
      en: 'delivery rhythm, escalations, and operating decisions',
      signal: 'execution tempo',
    },
    q05_data_quality: {
      pl: 'jakość danych i spójność metryk między zespołami',
      en: 'data quality and metric consistency across teams',
      signal: 'data reliability',
    },
    q06_ot_cyber_discipline: {
      pl: 'dyscyplina OT/cyber i domykanie luk kontroli',
      en: 'OT/cyber discipline and control-gap closure',
      signal: 'risk containment',
    },
    q07_ai_operating_model: {
      pl: 'operacyjny model wykorzystania AI w procesach',
      en: 'operating model for AI in business processes',
      signal: 'AI adoption quality',
    },
    q08_change_adoption: {
      pl: 'adopcję zmian na poziomie ludzi i rutyn',
      en: 'change adoption at people-and-routine level',
      signal: 'behavioral adoption',
    },
    q09_partner_growth: {
      pl: 'wzrost partnerów i powtarzalność ekspansji',
      en: 'partner growth and repeatability of expansion',
      signal: 'commercial scalability',
    },
    q10_risk_management: {
      pl: 'zarządzanie ryzykiem i jakość działań korygujących',
      en: 'risk management and quality of corrective actions',
      signal: 'resilience readiness',
    },
  };

  function buildNarrative(
    respondentSlug: string,
    questionId: string,
    questionIndex: number,
    seriesIndex: number
  ): string {
    const ctx = respondentContextBySlug[respondentSlug] || {
      functionName: 'Cross-functional contributor',
      operatingSurface: 'transformation execution',
      recurringConstraint: 'fragmented evidence and uneven operating discipline',
      leveragePoint: 'clear ownership and measurable outcomes',
    };
    const theme = questionThemes[questionId] || {
      pl: 'spójność operacyjną i decyzyjną',
      en: 'operating and decision alignment',
      signal: 'operating confidence',
    };

    const maturityShiftPl =
      seriesIndex === 1
        ? 'W pierwszej serii odpowiedzi widać bardziej diagnostyczny obraz i mocne zaakcentowanie ograniczeń.'
        : 'W drugiej serii widać już bardziej dojrzałą narrację: mniej opisu objawów, więcej konkretnych mechanizmów poprawy.';
    const maturityShiftEn =
      seriesIndex === 1
        ? 'In series one the answer keeps a diagnostic tone and highlights constraints more strongly.'
        : 'In series two the narrative is more mature: fewer symptoms, more concrete improvement mechanisms.';

    if (locale === 'pl') {
      return [
        `Jako ${ctx.functionName} patrzę na ${theme.pl} przez pryzmat obszaru ${ctx.operatingSurface}, gdzie najsilniej odczuwamy ${ctx.recurringConstraint}.`,
        `W praktyce problem nie polega na braku pojedynczego dashboardu, tylko na tym, że sygnały z planowania, realizacji i review boardowego docierają do ludzi w innym tempie i z różnym poziomem zaufania.`,
        `W tym pytaniu obserwujemy powtarzalny wzorzec: gdy rośnie presja na termin, zespoły skracają pętlę uczenia i decyzje są szybsze, ale słabiej uzasadnione dowodami.`,
        `Najbardziej użytecznym findingiem jest to, że dźwignia poprawy leży w ${ctx.leveragePoint}, a nie w dokładaniu kolejnych artefaktów bez właściciela i bez rytmu przeglądów.`,
        `${maturityShiftPl}`,
        `To daje nam konkretny materiał pod insighty i inicjatywy: można mapować ryzyko na właścicieli, przypinać confidence do decyzji i mierzyć czy sygnał "${theme.signal}" realnie poprawia jakość execution miesiąc do miesiąca.`,
        `Dodatkowo respondent wskazuje, że odpowiedź ${questionIndex + 1} powinna być czytana razem z kontekstem zależności między zespołami, bo tam najczęściej powstaje ukryty koszt opóźnień i reworku.`,
      ].join(' ');
    }

    return [
      `As ${ctx.functionName}, I evaluate ${theme.en} through the lens of ${ctx.operatingSurface}, where we most clearly feel ${ctx.recurringConstraint}.`,
      `In practice, the issue is not a missing dashboard; it is that planning, delivery, and board review signals move at different speeds and carry different trust levels.`,
      `For this question we see a recurring pattern: whenever deadline pressure rises, teams shorten the learning loop and decisions become faster but less evidence-backed.`,
      `The most useful finding is that the real leverage sits in ${ctx.leveragePoint}, not in producing more artifacts without clear owners and operating cadence.`,
      `${maturityShiftEn}`,
      `This gives strong raw material for later insights and initiatives: we can map risk to accountable owners, attach confidence to decisions, and test whether the "${theme.signal}" signal actually improves execution quality month over month.`,
      `The respondent also emphasizes that answer ${questionIndex + 1} should be interpreted with cross-team dependency context, because that is where hidden delay and rework costs usually emerge.`,
    ].join(' ');
  }

  const respondentSlugs = Object.keys(userMap).sort();
  const baseQuestionIds = [
    'q01_strategy_focus',
    'q02_value_evidence',
    'q03_portfolio_governance',
    'q04_execution_rhythm',
    'q05_data_quality',
    'q06_ot_cyber_discipline',
    'q07_ai_operating_model',
    'q08_change_adoption',
    'q09_partner_growth',
    'q10_risk_management',
  ];

  // Build two independent 10-question series per user (20 total answers/user)
  // and persist them in assessment sessions + per-user state.
  for (const respondentSlug of respondentSlugs) {
    const respondentUserId = userMap[respondentSlug]?.id;
    if (!respondentUserId) continue;
    const seriesRuns: Array<Record<string, unknown>> = [];

    for (let seriesIndex = 1; seriesIndex <= 2; seriesIndex += 1) {
      const sessionId = makeId(
        organizationId,
        'assessment-session',
        `${respondentSlug}-series-${seriesIndex}`
      );
      const openedAt = materializeRelativeIso(`-${18 - seriesIndex}d`, { anchorDate });
      const closedAt = materializeRelativeIso(`-${17 - seriesIndex}d`, { anchorDate });

      await DbPromise.run(
        `INSERT INTO assessment_sessions (id, assessment_id, user_id, opened_at, closed_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           opened_at=excluded.opened_at,
           closed_at=excluded.closed_at`,
        [sessionId, assessmentId, respondentUserId, openedAt, closedAt],
        { fallback: true }
      );

      const seriesAnswers = baseQuestionIds.reduce<Record<string, unknown>>((acc, questionId, idx) => {
        const weightedBase = (idx % 5) + 1;
        const score = Math.min(5, weightedBase + (seriesIndex === 2 ? 1 : 0));
        const confidence = Number((0.58 + idx * 0.03 + seriesIndex * 0.04).toFixed(2));
        acc[questionId] = {
          score,
          confidence: Math.min(0.95, confidence),
          note: buildNarrative(respondentSlug, questionId, idx, seriesIndex),
        };
        return acc;
      }, {});

      seriesRuns.push({
        seriesVersion: seriesIndex,
        questionSet: baseQuestionIds,
        responses: seriesAnswers,
        completedQuestions: baseQuestionIds.length,
        totalQuestions: baseQuestionIds.length,
        completedAt: closedAt,
      });
    }

    if (await tableExists('assessment_user_state')) {
      const latestRun = seriesRuns[seriesRuns.length - 1] || null;
      const navigationJson = {
        seriesRuns,
        seriesVersion: 2,
        questionSet: baseQuestionIds,
        responses: latestRun ? (latestRun.responses as Record<string, unknown>) : {},
        completedQuestions: baseQuestionIds.length * 2,
        totalQuestions: baseQuestionIds.length * 2,
        completedAt: latestRun ? latestRun.completedAt : null,
      };

      await DbPromise.run(
        `INSERT INTO assessment_user_state (assessment_id, user_id, navigation_json, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (assessment_id, user_id) DO UPDATE SET
           navigation_json=excluded.navigation_json,
           updated_at=excluded.updated_at`,
        [
          assessmentId,
          respondentUserId,
          JSON.stringify(navigationJson),
          latestRun ? latestRun.completedAt : new Date().toISOString(),
        ],
        { fallback: true }
      );
    }
  }
}

async function upsertNotifications(
  organizationId: string,
  userMap: UserMap,
  locale: DemoLocale
): Promise<void> {
  if (!(await tableExists('notifications'))) return;

  const notifications = [
    {
      slug: 'board-pack',
      user: 'antoine-laurent',
      type: 'initiative',
      title:
        locale === 'pl'
          ? 'Board pack czeka na finalny sign-off'
          : 'Board pack needs final sign-off',
      message:
        locale === 'pl'
          ? 'Pakiet value trackingu jest prawie gotowy. Logika ROI dla top inicjatyw nadal wymaga potwierdzenia.'
          : 'The value-tracking pack is almost ready. ROI logic for top initiatives still needs confirmation.',
    },
    {
      slug: 'quality-issue',
      user: 'sophie-bernard',
      type: 'quality',
      title:
        locale === 'pl'
          ? 'Oflagowano wzorzec powtarzalnego defektu'
          : 'Repeat defect pattern flagged',
      message:
        locale === 'pl'
          ? 'Drift tolerancji pakowania pojawił się ponownie w Lyon North. Review przyczyny źródłowej jest już zaplanowany.'
          : 'Packaging tolerance drift showed up again in Lyon North. Root-cause review is scheduled.',
    },
    {
      slug: 'partner-cohort',
      user: 'thomas-viau',
      type: 'growth',
      title:
        locale === 'pl'
          ? 'Czas na review pierwszej kohorty partnerów'
          : 'First partner cohort review due',
      message:
        locale === 'pl'
          ? 'Nowe scorecards onboardingowe są gotowe do przeglądu przed callem commercial leadership.'
          : 'New onboarding scorecards are ready to review before the commercial leadership call.',
    },
  ];

  for (const notification of notifications) {
    await DbPromise.run(
      `INSERT INTO notifications (id, user_id, type, title, message, data, read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET title=excluded.title, message=excluded.message`,
      [
        makeId(organizationId, 'notification', notification.slug),
        userMap[notification.user]?.id || null,
        notification.type,
        notification.title,
        notification.message,
        JSON.stringify({ demo: 'atelier-toys' }),
        0,
        new Date().toISOString(),
      ],
      { fallback: true }
    );
  }
}

async function upsertActivityLogs(
  organizationId: string,
  userMap: UserMap,
  locale: DemoLocale
): Promise<void> {
  if (!(await tableExists('activity_logs'))) return;

  const logs = [
    {
      slug: 'line3-update',
      user: 'marc-dubois',
      action: 'initiative.updated',
      entityType: 'initiative',
      entityName:
        locale === 'pl' ? 'Rollout Digital Twin dla Linii 3' : 'Line 3 Digital Twin Rollout',
      value:
        locale === 'pl'
          ? 'Milestone pilota supervisorów przeszedł na in progress po walidacji zmianowej.'
          : 'Supervisor pilot milestone moved to in progress after shift validation.',
    },
    {
      slug: 'board-prep',
      user: 'hugo-bernard',
      action: 'report.created',
      entityType: 'status_report',
      entityName:
        locale === 'pl'
          ? 'Board pre-read: pakiet sygnałów wartości i ryzyka'
          : 'Board Pre-read: value and risk signal pack',
      value:
        locale === 'pl'
          ? 'Board pre-read odświeżony o najnowsze confidence bands dla wartości.'
          : 'Board pre-read refreshed with latest value confidence bands.',
    },
    {
      slug: 'partner-scorecard',
      user: 'zoe-perrin',
      action: 'scorecard.published',
      entityType: 'project',
      entityName: locale === 'pl' ? 'Rozwój Partnerów' : 'Partner Expansion',
      value:
        locale === 'pl'
          ? 'Opublikowano nowe scorecards onboardingowe dla pierwszej kohorty partnerów.'
          : 'New onboarding scorecards published for the first partner cohort.',
    },
  ];

  for (const log of logs) {
    await DbPromise.run(
      `INSERT INTO activity_logs (
        id, organization_id, user_id, action, entity_type, entity_id, entity_name, new_value, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET new_value=excluded.new_value, created_at=excluded.created_at`,
      [
        makeId(organizationId, 'activity', log.slug),
        organizationId,
        userMap[log.user]?.id || null,
        log.action,
        log.entityType,
        makeId(organizationId, log.entityType, log.slug),
        log.entityName,
        log.value,
        new Date().toISOString(),
      ],
      { fallback: true }
    );
  }
}

async function upsertResultsLayer(
  organizationId: string,
  ownerUserId: string,
  anchorDate: Date,
  initiativeMap: InitiativeMap
): Promise<ResultsSeedCounts> {
  const counts: ResultsSeedCounts = {
    kpis: 0,
    kpiTimeSeries: 0,
    kpiMappings: 0,
    roiAssumptions: 0,
    roiRealized: 0,
    deviations: 0,
    deviationActions: 0,
    reportSnapshots: 0,
    v8Kpis: 0,
    v8Deviations: 0,
    v8RoiEntries: 0,
  };

  const hasInitiativeKpis = await tableExists('initiative_kpis');
  const hasKpiTimeSeries = await tableExists('kpi_time_series');
  const hasKpiMappings = await tableExists('initiative_kpi_mappings');
  const hasRoiAssumptions = await tableExists('roi_assumptions');
  const hasRoiRealized = await tableExists('roi_realized_values');
  const hasDeviationCases = await tableExists('kpi_deviation_cases');
  const hasDeviationActions = await tableExists('kpi_deviation_actions');
  const hasSnapshots = await tableExists('results_kpi_report_snapshots');
  const hasV8Kpis = await tableExists('v8_kpi_definitions');
  const hasV8Deviations = await tableExists('v8_deviation_records');
  const hasV8Roi = await tableExists('v8_roi_realization_entries');

  const kpis = [
    {
      slug: 'oee',
      name: 'OEE (Overall Equipment Effectiveness)',
      description: 'Measures equipment utilization, performance, and quality.',
      unit: '%',
      baseline: 64,
      target: 82,
      values: [66, 67.5, 69, 71, 73, 75],
      direction: 'HIGHER_IS_BETTER',
      cadence: 'MONTHLY',
    },
    {
      slug: 'changeover',
      name: 'Changeover Duration',
      description: 'Average duration of changeover on flagship lines.',
      unit: 'min',
      baseline: 19,
      target: 10,
      values: [18.5, 18, 17.2, 16.3, 15.7, 14.9],
      direction: 'LOWER_IS_BETTER',
      cadence: 'MONTHLY',
    },
    {
      slug: 'renewal',
      name: 'Atelier Digital Gross Renewal',
      description: 'Gross renewal of premium digital subscriptions.',
      unit: '%',
      baseline: 78,
      target: 90,
      values: [79, 79.5, 80, 81, 82.5, 84],
      direction: 'HIGHER_IS_BETTER',
      cadence: 'MONTHLY',
    },
    {
      slug: 'partner-activation',
      name: 'Partner First-90-Day Activation',
      description: 'Share of newly signed partners reaching first productivity milestone.',
      unit: '%',
      baseline: 50,
      target: 75,
      values: [51, 53, 55, 56, 58, 61],
      direction: 'HIGHER_IS_BETTER',
      cadence: 'MONTHLY',
    },
    {
      slug: 'defect-recurrence',
      name: 'Repeat Defect Rate',
      description: 'Rate of recurring quality defects on top families.',
      unit: '%',
      baseline: 11,
      target: 4,
      values: [10.8, 10.2, 9.6, 9, 8.3, 7.7],
      direction: 'LOWER_IS_BETTER',
      cadence: 'MONTHLY',
    },
    {
      slug: 'decision-cycle',
      name: 'Decision Cycle Time',
      description: 'Median number of days from issue signal to executive decision.',
      unit: 'days',
      baseline: 14,
      target: 6,
      values: [13.8, 13.2, 12.5, 11.7, 10.9, 10.1],
      direction: 'LOWER_IS_BETTER',
      cadence: 'MONTHLY',
    },
  ];

  const kpiIds: Record<string, string> = {};
  const periodMonth = (offsetMonths: number) => {
    const d = new Date(Date.UTC(anchorDate.getUTCFullYear(), anchorDate.getUTCMonth() + offsetMonths, 1));
    return d.toISOString().slice(0, 10);
  };

  if (hasInitiativeKpis) {
    const kpiCols = await getTableColumns('initiative_kpis');
    for (const kpi of kpis) {
      const id = makeId(organizationId, 'kpi', kpi.slug);
      kpiIds[kpi.slug] = id;

      const cols: string[] = ['id', 'organization_id', 'name', 'description', 'unit'];
      const vals: Array<string | number | null> = [
        id,
        organizationId,
        kpi.name,
        kpi.description,
        kpi.unit,
      ];
      if (kpiCols.has('baseline_value')) {
        cols.push('baseline_value');
        vals.push(kpi.baseline);
      }
      if (kpiCols.has('target_value')) {
        cols.push('target_value');
        vals.push(kpi.target);
      }
      if (kpiCols.has('current_value')) {
        cols.push('current_value');
        vals.push(kpi.values[kpi.values.length - 1]);
      }
      if (kpiCols.has('measurement_frequency')) {
        cols.push('measurement_frequency');
        vals.push(kpi.cadence);
      }
      if (kpiCols.has('direction')) {
        cols.push('direction');
        vals.push(kpi.direction);
      }
      if (kpiCols.has('owner_user_id')) {
        cols.push('owner_user_id');
        vals.push(ownerUserId);
      }
      if (kpiCols.has('created_at')) {
        cols.push('created_at');
        vals.push(new Date().toISOString());
      }
      if (kpiCols.has('updated_at')) {
        cols.push('updated_at');
        vals.push(new Date().toISOString());
      }

      const ph = cols.map((_, i) => `$${i + 1}`).join(', ');
      await DbPromise.run(
        `INSERT INTO initiative_kpis (${cols.join(', ')})
         VALUES (${ph})
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description`,
        vals,
        { fallback: true }
      );
      counts.kpis += 1;
    }
  }

  if (hasKpiTimeSeries && Object.keys(kpiIds).length > 0) {
    for (const kpi of kpis) {
      const kpiId = kpiIds[kpi.slug];
      if (!kpiId) continue;
      for (let i = 0; i < kpi.values.length; i += 1) {
        const offset = i - (kpi.values.length - 1);
        await DbPromise.run(
          `INSERT INTO kpi_time_series (id, kpi_id, organization_id, value, period_start, source, notes, recorded_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET value=excluded.value, notes=excluded.notes`,
          [
            makeId(organizationId, 'kpi-ts', `${kpi.slug}-${String(i + 1).padStart(2, '0')}`),
            kpiId,
            organizationId,
            kpi.values[i],
            periodMonth(offset),
            'demo_seed',
            `Seeded ${kpi.name} trend point ${i + 1}`,
            ownerUserId,
            new Date().toISOString(),
          ],
          { fallback: true }
        );
        counts.kpiTimeSeries += 1;
      }
    }
  }

  if (hasKpiMappings && Object.keys(kpiIds).length > 0) {
    const mappings = [
      ['line-3-digital-twin', 'oee', 1.0, 'increase', 'high'],
      ['line-3-digital-twin', 'changeover', 0.9, 'decrease', 'high'],
      ['atelier-digital-growth', 'renewal', 1.0, 'increase', 'high'],
      ['partner-onboarding-excellence', 'partner-activation', 1.0, 'increase', 'medium'],
      ['qa-defect-closing-loop', 'defect-recurrence', 1.0, 'decrease', 'high'],
      ['board-value-tracking', 'decision-cycle', 0.8, 'decrease', 'medium'],
      ['enterprise-data-contract-control-plane', 'decision-cycle', 0.7, 'decrease', 'medium'],
    ] as const;

    for (const [initiativeSlug, kpiSlug, weight, direction, confidence] of mappings) {
      const initiativeId = initiativeMap[initiativeSlug];
      const kpiId = kpiIds[kpiSlug];
      if (!initiativeId || !kpiId) continue;
      await DbPromise.run(
        `INSERT INTO initiative_kpi_mappings
           (id, initiative_id, kpi_id, organization_id, impact_weight, impact_direction, confidence, notes, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(initiative_id, kpi_id) DO UPDATE SET
           impact_weight=excluded.impact_weight,
           impact_direction=excluded.impact_direction,
           confidence=excluded.confidence,
           updated_at=excluded.updated_at`,
        [
          makeId(organizationId, 'kpi-map', `${initiativeSlug}-${kpiSlug}`),
          initiativeId,
          kpiId,
          organizationId,
          weight,
          direction,
          confidence,
          `Atelier mapping: ${initiativeSlug} -> ${kpiSlug}`,
          ownerUserId,
          new Date().toISOString(),
          new Date().toISOString(),
        ],
        { fallback: true }
      );
      counts.kpiMappings += 1;
    }
  }

  if (hasRoiAssumptions) {
    const assumptions = [
      ['line-3-digital-twin', 480000, 160000, 42, 390000, 10, 36, 2900000, 1780000, 140000, -110000, 'high'],
      ['procurement-control-tower', 220000, 190000, 31, 220000, 14, 36, 2900000, 1780000, 70000, -90000, 'high'],
      ['atelier-digital-growth', 260000, 380000, 36, 310000, 12, 36, 2900000, 1780000, 260000, -35000, 'medium'],
      ['qa-defect-closing-loop', 180000, 120000, 24, 130000, 18, 36, 2900000, 1780000, 40000, -70000, 'medium'],
    ] as const;
    for (const item of assumptions) {
      const initiativeId = initiativeMap[item[0]];
      if (!initiativeId) continue;
      await DbPromise.run(
        `INSERT INTO roi_assumptions (
          id, initiative_id, organization_id, capex, opex_annual, expected_roi_percent, expected_npv,
          expected_payback_months, horizon_months, baseline_revenue, baseline_cost, expected_revenue_delta,
          expected_cost_delta, effect_start_date, assumptions_text, assumptions_owner, confidence, last_updated_by,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(initiative_id) DO UPDATE SET
          capex=excluded.capex,
          opex_annual=excluded.opex_annual,
          expected_roi_percent=excluded.expected_roi_percent,
          expected_npv=excluded.expected_npv,
          expected_payback_months=excluded.expected_payback_months,
          expected_revenue_delta=excluded.expected_revenue_delta,
          expected_cost_delta=excluded.expected_cost_delta,
          confidence=excluded.confidence,
          updated_at=excluded.updated_at`,
        [
          makeId(organizationId, 'roi-assumption', item[0]),
          initiativeId,
          organizationId,
          item[1],
          item[2],
          item[3],
          item[4],
          item[5],
          item[6],
          item[7],
          item[8],
          item[9],
          item[10],
          periodMonth(-6),
          `Atelier Wave 1 assumption for ${item[0]}`,
          'CFO Office',
          item[11],
          ownerUserId,
          new Date().toISOString(),
          new Date().toISOString(),
        ],
        { fallback: true }
      );
      counts.roiAssumptions += 1;
    }
  }

  if (hasRoiRealized) {
    const realized = [
      ['line-3-digital-twin', -5, 12000, -9000, 21000],
      ['line-3-digital-twin', -4, 16000, -11000, 26000],
      ['line-3-digital-twin', -3, 18000, -13000, 29000],
      ['line-3-digital-twin', -2, 21000, -15000, 33000],
      ['line-3-digital-twin', -1, 24000, -17000, 36000],
      ['procurement-control-tower', -4, 7000, -6000, 13000],
      ['procurement-control-tower', -3, 9000, -7500, 16500],
      ['procurement-control-tower', -2, 11000, -9000, 20000],
      ['procurement-control-tower', -1, 12000, -9500, 21500],
      ['atelier-digital-growth', -3, 28000, -3000, 8000],
      ['atelier-digital-growth', -2, 34000, -3500, 9500],
      ['atelier-digital-growth', -1, 41000, -4000, 11000],
      ['qa-defect-closing-loop', -2, 5000, -9000, 15000],
      ['qa-defect-closing-loop', -1, 7000, -11000, 19000],
    ] as const;
    for (const [slug, monthOffset, revDelta, costDelta, savings] of realized) {
      const initiativeId = initiativeMap[slug];
      if (!initiativeId) continue;
      await DbPromise.run(
        `INSERT INTO roi_realized_values
          (id, initiative_id, organization_id, period_month, realized_revenue_delta, realized_cost_delta, realized_savings, source, variance_notes, recorded_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           realized_revenue_delta=excluded.realized_revenue_delta,
           realized_cost_delta=excluded.realized_cost_delta,
           realized_savings=excluded.realized_savings,
           variance_notes=excluded.variance_notes`,
        [
          makeId(organizationId, 'roi-realized', `${slug}-${monthOffset}`),
          initiativeId,
          organizationId,
          periodMonth(monthOffset),
          revDelta,
          costDelta,
          savings,
          'demo_seed',
          `Atelier monthly realized value for ${slug}`,
          ownerUserId,
          new Date().toISOString(),
        ],
        { fallback: true }
      );
      counts.roiRealized += 1;
    }
  }

  if (hasDeviationCases) {
    const deviations = [
      ['defect-recurrence', 'RED', 'ACKNOWLEDGED', 'Repeat defect rate still above target despite cockpit rollout.'],
      ['changeover', 'AMBER', 'IN_PROGRESS', 'Changeover duration trend is improving but below target velocity.'],
      ['partner-activation', 'AMBER', 'OPEN', 'Partner first-90-day activation is under expected ramp pace.'],
    ] as const;
    for (let idx = 0; idx < deviations.length; idx += 1) {
      const [kpiSlug, severity, status, summary] = deviations[idx];
      const kpiId = kpiIds[kpiSlug];
      if (!kpiId) continue;
      const caseId = makeId(organizationId, 'kpi-dev', `${kpiSlug}-${idx + 1}`);
      await DbPromise.run(
        `INSERT INTO kpi_deviation_cases
          (id, kpi_id, organization_id, period_start, severity, status, owner_user_id, deviation_summary, rca_text, detected_at, detected_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(organization_id, kpi_id, period_start) DO UPDATE SET
           severity=excluded.severity,
           status=excluded.status,
           deviation_summary=excluded.deviation_summary,
           rca_text=excluded.rca_text,
           updated_at=excluded.updated_at`,
        [
          caseId,
          kpiId,
          organizationId,
          periodMonth(0),
          severity,
          status,
          ownerUserId,
          summary,
          `Root cause review for ${kpiSlug} in Atelier operating cadence.`,
          new Date().toISOString(),
          'system',
          new Date().toISOString(),
          new Date().toISOString(),
        ],
        { fallback: true }
      );
      counts.deviations += 1;

      if (hasDeviationActions) {
        await DbPromise.run(
          `INSERT INTO kpi_deviation_actions (id, case_id, title, owner_user_id, due_date, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET title=excluded.title, status=excluded.status, updated_at=excluded.updated_at`,
          [
            makeId(organizationId, 'kpi-dev-action', `${kpiSlug}-${idx + 1}`),
            caseId,
            `Mitigation plan for ${kpiSlug}`,
            ownerUserId,
            periodMonth(1),
            idx === 0 ? 'OPEN' : 'IN_PROGRESS',
            new Date().toISOString(),
            new Date().toISOString(),
          ],
          { fallback: true }
        );
        counts.deviationActions += 1;
      }
    }
  }

  if (hasSnapshots) {
    const snapshot = {
      title: 'Atelier Toys Wave 1 KPI Review',
      periodStart: periodMonth(-3),
      periodEnd: periodMonth(0),
      kpis: kpis.map((k) => ({
        id: kpiIds[k.slug] || k.slug,
        name: k.name,
        unit: k.unit,
        target: k.target,
        baseline: k.baseline,
        current: k.values[k.values.length - 1],
      })),
      stats: {
        totalKpis: kpis.length,
        deviationCases: counts.deviations,
      },
    };
    await DbPromise.run(
      `INSERT INTO results_kpi_report_snapshots (id, organization_id, period_start, period_end, title, snapshot_json, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET snapshot_json=excluded.snapshot_json, title=excluded.title`,
      [
        makeId(organizationId, 'kpi-snapshot', 'wave1'),
        organizationId,
        periodMonth(-3),
        periodMonth(0),
        'Atelier Toys Wave 1 KPI Review',
        JSON.stringify(snapshot),
        ownerUserId,
        new Date().toISOString(),
      ],
      { fallback: true }
    );
    counts.reportSnapshots += 1;
  }

  if (hasV8Kpis) {
    const v8Defs = [
      ['OEE', 'initiative_linked', 'line-3-digital-twin', 'percentage', 64, 82, 75, 'monthly', 'active'],
      ['Changeover Duration', 'initiative_linked', 'line-3-digital-twin', 'duration', 19, 10, 14.9, 'monthly', 'active'],
      ['Atelier Digital Renewal', 'initiative_linked', 'atelier-digital-growth', 'percentage', 78, 90, 84, 'monthly', 'active'],
      ['Partner Activation', 'initiative_linked', 'partner-onboarding-excellence', 'percentage', 50, 75, 61, 'monthly', 'improvement'],
    ] as const;

    for (const def of v8Defs) {
      const [name, mode, initiativeSlug, metricType, baseline, target, current, cadence, status] = def;
      const initiativeId = initiativeMap[initiativeSlug] || null;
      await DbPromise.run(
        `INSERT INTO v8_kpi_definitions
          (kpi_id, organization_id, name, mode, initiative_id, metric_type, baseline_value, target_value, current_value, measurement_cadence, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(kpi_id) DO UPDATE SET
           current_value=excluded.current_value,
           target_value=excluded.target_value,
           status=excluded.status,
           updated_at=excluded.updated_at`,
        [
          makeId(organizationId, 'v8-kpi', name.toLowerCase().replace(/\s+/g, '-')),
          organizationId,
          name,
          mode,
          initiativeId,
          metricType,
          baseline,
          target,
          current,
          cadence,
          status,
          new Date().toISOString(),
          new Date().toISOString(),
        ],
        { fallback: true }
      );
      counts.v8Kpis += 1;
    }
  }

  if (hasV8Deviations && hasV8Kpis) {
    const v8DeviationRows = [
      ['oee', 'underperformance', 'medium', 75, 82, 'Supervisor adoption not yet at target velocity'],
      ['changeover-duration', 'underperformance', 'high', 14.9, 10, 'SMED discipline uneven across shifts'],
    ] as const;
    for (const [slug, type, severity, actual, target, action] of v8DeviationRows) {
      await DbPromise.run(
        `INSERT INTO v8_deviation_records
          (deviation_id, organization_id, kpi_id, deviation_type, severity, action_required, created_at, observed_actual, observed_target)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          makeId(organizationId, 'v8-dev', slug),
          organizationId,
          makeId(organizationId, 'v8-kpi', slug),
          type,
          severity,
          action,
          new Date().toISOString(),
          actual,
          target,
        ],
        { fallback: true }
      );
      counts.v8Deviations += 1;
    }
  }

  if (hasV8Roi && hasV8Kpis) {
    const entries = [
      ['oee', 'line-3-digital-twin', 118000, -1],
      ['oee', 'line-3-digital-twin', 131000, 0],
      ['atelier-digital-renewal', 'atelier-digital-growth', 72000, 0],
      ['partner-activation', 'partner-onboarding-excellence', 41000, 0],
    ] as const;
    for (const [kpiSlug, initiativeSlug, value, monthOffset] of entries) {
      const initiativeId = initiativeMap[initiativeSlug] || null;
      await DbPromise.run(
        `INSERT INTO v8_roi_realization_entries (entry_id, organization_id, kpi_id, initiative_id, realized_value, period, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          makeId(organizationId, 'v8-roi', `${kpiSlug}-${monthOffset}`),
          organizationId,
          makeId(organizationId, 'v8-kpi', kpiSlug),
          initiativeId,
          value,
          periodMonth(monthOffset),
          new Date().toISOString(),
        ],
        { fallback: true }
      );
      counts.v8RoiEntries += 1;
    }
  }

  return counts;
}

async function upsertInterviewInsightDemoArtifacts(
  organizationId: string,
  userMap: UserMap,
  anchorDate: Date,
  locale: DemoLocale
): Promise<void> {
  if (!(await tableExists('interview_insights'))) return;

  const interviewSessionMap: Record<string, string> = {
    operations: makeId(organizationId, 'interview-session', 'ops-control-tower'),
    quality: makeId(organizationId, 'interview-session', 'quality-close-loop'),
    supply: makeId(organizationId, 'interview-session', 'supplier-risk-cadence'),
    digital: makeId(organizationId, 'interview-session', 'digital-product-scale'),
    governance: makeId(organizationId, 'interview-session', 'board-value-governance'),
    partner: makeId(organizationId, 'interview-session', 'partner-activation-path'),
  };

  if (await tableExists('interview_sessions')) {
    const sessions = [
      {
        slug: 'operations',
        title:
          locale === 'pl'
            ? 'Ops Control Tower - rytm operacyjny'
            : 'Ops Control Tower - operating cadence',
        owner: 'marc-dubois',
      },
      {
        slug: 'quality',
        title:
          locale === 'pl'
            ? 'Quality Close Loop - governance jakości'
            : 'Quality Close Loop - quality governance',
        owner: 'sophie-bernard',
      },
      {
        slug: 'supply',
        title:
          locale === 'pl'
            ? 'Supplier Risk Cadence - odporność dostaw'
            : 'Supplier Risk Cadence - supply resilience',
        owner: 'isabelle-leroy',
      },
      {
        slug: 'digital',
        title:
          locale === 'pl'
            ? 'Digital Product Scale - produkt i adopcja'
            : 'Digital Product Scale - product and adoption',
        owner: 'julien-moreau',
      },
      {
        slug: 'governance',
        title:
          locale === 'pl'
            ? 'Board Value Governance - decyzje i dowody'
            : 'Board Value Governance - decisions and evidence',
        owner: 'antoine-laurent',
      },
      {
        slug: 'partner',
        title:
          locale === 'pl'
            ? 'Partner Activation Path - kanał i onboarding'
            : 'Partner Activation Path - channel and onboarding',
        owner: 'thomas-viau',
      },
    ];

    const sessionCols = await getTableColumns('interview_sessions');
    for (const session of sessions) {
      const cols = ['id'];
      const vals: Array<string | number | null> = [interviewSessionMap[session.slug]];

      if (sessionCols.has('organization_id')) {
        cols.push('organization_id');
        vals.push(organizationId);
      }
      if (sessionCols.has('title')) {
        cols.push('title');
        vals.push(session.title);
      }
      if (sessionCols.has('status')) {
        cols.push('status');
        vals.push('completed');
      }
      if (sessionCols.has('workflow_status')) {
        cols.push('workflow_status');
        vals.push('completed');
      }
      if (sessionCols.has('progress')) {
        cols.push('progress');
        vals.push(100);
      }
      if (sessionCols.has('completed_at')) {
        cols.push('completed_at');
        vals.push(materializeRelativeIso('-2d', { anchorDate }));
      }
      if (sessionCols.has('started_at')) {
        cols.push('started_at');
        vals.push(materializeRelativeIso('-10d', { anchorDate }));
      }
      if (sessionCols.has('created_by')) {
        cols.push('created_by');
        vals.push(userMap[session.owner]?.id || userMap['antoine-laurent']?.id || null);
      }
      if (sessionCols.has('created_at')) {
        cols.push('created_at');
        vals.push(materializeRelativeIso('-12d', { anchorDate }));
      }
      if (sessionCols.has('updated_at')) {
        cols.push('updated_at');
        vals.push(materializeRelativeIso('-1d', { anchorDate }));
      }

      await DbPromise.run(
        `INSERT INTO interview_sessions (${cols.join(', ')})
         VALUES (${cols.map(() => '?').join(', ')})
         ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at`,
        vals,
        { fallback: true }
      );
    }
  }

  const insightBlueprints = [
    {
      slug: 'ops-telemetry-latency',
      title:
        locale === 'pl'
          ? 'Latency telemetry osłabia decyzje na zmianie'
          : 'Telemetry latency weakens shift decisions',
      category: 'operations',
      promptType: 'problems',
      insightType: 'constraint',
      impactLevel: 'high',
      confidence: 'high',
      pmoDomain: 'operations',
      sessionSlug: 'operations',
      ownerSlug: 'marc-dubois',
      initiativeSlug: 'line-3-digital-twin',
    },
    {
      slug: 'ops-changeover-sequence-drift',
      title:
        locale === 'pl'
          ? 'Drift sekwencji changeover zwiększa straty OEE'
          : 'Changeover sequence drift drives OEE loss',
      category: 'operations',
      promptType: 'trends',
      insightType: 'pain_point',
      impactLevel: 'high',
      confidence: 'high',
      pmoDomain: 'operations',
      sessionSlug: 'operations',
      ownerSlug: 'luc-rousseau',
      initiativeSlug: 'line-3-digital-twin',
    },
    {
      slug: 'quality-root-cause-closure-gap',
      title:
        locale === 'pl'
          ? 'Root-cause closure jest zbyt wolny między zakładami'
          : 'Root-cause closure is too slow across plants',
      category: 'quality',
      promptType: 'problems',
      insightType: 'gap',
      impactLevel: 'high',
      confidence: 'high',
      pmoDomain: 'quality',
      sessionSlug: 'quality',
      ownerSlug: 'sophie-bernard',
      initiativeSlug: 'qa-defect-closing-loop',
    },
    {
      slug: 'quality-defect-taxonomy-fragmentation',
      title:
        locale === 'pl'
          ? 'Rozproszona taksonomia defektów zniekształca priorytety'
          : 'Fragmented defect taxonomy distorts priorities',
      category: 'quality',
      promptType: 'gaps',
      insightType: 'gap',
      impactLevel: 'medium',
      confidence: 'medium',
      pmoDomain: 'quality',
      sessionSlug: 'quality',
      ownerSlug: 'paul-lambert',
      initiativeSlug: 'qa-defect-closing-loop',
    },
    {
      slug: 'supply-leadtime-volatility-cascade',
      title:
        locale === 'pl'
          ? 'Zmienność lead time kaskaduje do marży i OTIF'
          : 'Lead-time volatility cascades into margin and OTIF',
      category: 'supply',
      promptType: 'risk_assessment',
      insightType: 'risk',
      impactLevel: 'high',
      confidence: 'high',
      pmoDomain: 'supply-chain',
      sessionSlug: 'supply',
      ownerSlug: 'isabelle-leroy',
      initiativeSlug: 'procurement-control-tower',
    },
    {
      slug: 'supply-buffer-policy-ambiguity',
      title:
        locale === 'pl'
          ? 'Niejasna polityka buforów utrudnia decyzje zakupowe'
          : 'Ambiguous buffer policy blocks sourcing decisions',
      category: 'supply',
      promptType: 'gaps',
      insightType: 'constraint',
      impactLevel: 'medium',
      confidence: 'medium',
      pmoDomain: 'supply-chain',
      sessionSlug: 'supply',
      ownerSlug: 'mathieu-chevalier',
      initiativeSlug: 'supplier-risk-war-room',
    },
    {
      slug: 'digital-renewal-risk-signal-gap',
      title:
        locale === 'pl'
          ? 'Brakuje wczesnego sygnału ryzyka odnowień'
          : 'Early renewal-risk signal is missing',
      category: 'digital',
      promptType: 'risk_assessment',
      insightType: 'gap',
      impactLevel: 'high',
      confidence: 'high',
      pmoDomain: 'product',
      sessionSlug: 'digital',
      ownerSlug: 'julien-moreau',
      initiativeSlug: 'atelier-digital-growth',
    },
    {
      slug: 'digital-roadmap-tradeoff-opacity',
      title:
        locale === 'pl'
          ? 'Trade-offy roadmapy są słabo transparentne'
          : 'Roadmap trade-offs are weakly transparent',
      category: 'digital',
      promptType: 'comparison',
      insightType: 'constraint',
      impactLevel: 'medium',
      confidence: 'medium',
      pmoDomain: 'product',
      sessionSlug: 'digital',
      ownerSlug: 'nicolas-faure',
      initiativeSlug: 'product-roadmap-sync',
    },
    {
      slug: 'governance-value-proof-lag',
      title:
        locale === 'pl'
          ? 'Lag dowodzenia wartości ogranicza tempo decyzji zarządu'
          : 'Value-proof lag limits board decision speed',
      category: 'governance',
      promptType: 'summary',
      insightType: 'gap',
      impactLevel: 'high',
      confidence: 'high',
      pmoDomain: 'governance',
      sessionSlug: 'governance',
      ownerSlug: 'hugo-bernard',
      initiativeSlug: 'board-value-tracking',
    },
    {
      slug: 'governance-followup-accountability-drift',
      title:
        locale === 'pl'
          ? 'Drift odpowiedzialności po decyzjach boardowych'
          : 'Post-board follow-up accountability drifts',
      category: 'governance',
      promptType: 'trends',
      insightType: 'pain_point',
      impactLevel: 'medium',
      confidence: 'high',
      pmoDomain: 'governance',
      sessionSlug: 'governance',
      ownerSlug: 'amelie-girard',
      initiativeSlug: 'board-value-tracking',
    },
    {
      slug: 'partner-enablement-activation-gap',
      title:
        locale === 'pl'
          ? 'Enablement partnerów nie przekłada się na aktywację'
          : 'Partner enablement does not convert to activation',
      category: 'partner',
      promptType: 'opportunity_scan',
      insightType: 'opportunity',
      impactLevel: 'high',
      confidence: 'high',
      pmoDomain: 'commercial',
      sessionSlug: 'partner',
      ownerSlug: 'zoe-perrin',
      initiativeSlug: 'partner-onboarding-excellence',
    },
    {
      slug: 'partner-story-evidence-inconsistency',
      title:
        locale === 'pl'
          ? 'Niespójna historia evidence osłabia partner close-rate'
          : 'Inconsistent evidence story lowers partner close-rate',
      category: 'partner',
      promptType: 'problems',
      insightType: 'pain_point',
      impactLevel: 'medium',
      confidence: 'medium',
      pmoDomain: 'commercial',
      sessionSlug: 'partner',
      ownerSlug: 'camille-dubois',
      initiativeSlug: 'partner-onboarding-excellence',
    },
    {
      slug: 'ot-cyber-control-maturity-variance',
      title:
        locale === 'pl'
          ? 'Nierówna dojrzałość kontroli OT/cyber między lokalizacjami'
          : 'OT/cyber control maturity varies by site',
      category: 'cybersecurity',
      promptType: 'risk_assessment',
      insightType: 'risk',
      impactLevel: 'high',
      confidence: 'high',
      pmoDomain: 'security',
      sessionSlug: 'governance',
      ownerSlug: 'victor-morin',
      initiativeSlug: 'ot-cyber-hardening',
    },
    {
      slug: 'ot-segmentation-priority-conflict',
      title:
        locale === 'pl'
          ? 'Konflikt priorytetów między segmentacją OT a delivery'
          : 'Priority conflict between OT segmentation and delivery',
      category: 'cybersecurity',
      promptType: 'comparison',
      insightType: 'constraint',
      impactLevel: 'medium',
      confidence: 'medium',
      pmoDomain: 'security',
      sessionSlug: 'governance',
      ownerSlug: 'claire-laurent',
      initiativeSlug: 'ot-cyber-hardening',
    },
    {
      slug: 'capability-academy-behavior-transfer-gap',
      title:
        locale === 'pl'
          ? 'Academy podnosi wiedzę, ale transfer do rutyn jest nierówny'
          : 'Academy improves knowledge, but transfer to routines is uneven',
      category: 'people',
      promptType: 'maturity',
      insightType: 'gap',
      impactLevel: 'medium',
      confidence: 'high',
      pmoDomain: 'people',
      sessionSlug: 'operations',
      ownerSlug: 'emma-noel',
      initiativeSlug: 'supervisor-capability-academy',
    },
    {
      slug: 'capability-manager-coaching-capacity',
      title:
        locale === 'pl'
          ? 'Ograniczona pojemność coachingu managerów'
          : 'Manager coaching capacity is constrained',
      category: 'people',
      promptType: 'gaps',
      insightType: 'constraint',
      impactLevel: 'medium',
      confidence: 'medium',
      pmoDomain: 'people',
      sessionSlug: 'operations',
      ownerSlug: 'damien-petit',
      initiativeSlug: 'supervisor-capability-academy',
    },
    {
      slug: 'finance-confidence-band-missing',
      title:
        locale === 'pl'
          ? 'Brak confidence-band dla ROI utrudnia alokację kapitału'
          : 'Missing confidence bands for ROI hurt capital allocation',
      category: 'finance',
      promptType: 'summary',
      insightType: 'gap',
      impactLevel: 'high',
      confidence: 'high',
      pmoDomain: 'finance',
      sessionSlug: 'governance',
      ownerSlug: 'elise-robert',
      initiativeSlug: 'board-value-tracking',
    },
    {
      slug: 'revops-funnel-signal-fragmentation',
      title:
        locale === 'pl'
          ? 'Fragmentacja sygnałów funnelu zaciera priorytety handlowe'
          : 'Funnel signal fragmentation blurs commercial priorities',
      category: 'commercial',
      promptType: 'trends',
      insightType: 'gap',
      impactLevel: 'medium',
      confidence: 'high',
      pmoDomain: 'commercial',
      sessionSlug: 'partner',
      ownerSlug: 'ines-garnier',
      initiativeSlug: 'atelier-core-onboarding-revamp',
    },
  ] as const;

  const insightCols = await getTableColumns('interview_insights');
  const findingTablesEnabled =
    (await tableExists('interview_insight_findings')) &&
    (await tableExists('interview_insight_evidence_pointers')) &&
    (await tableExists('interview_insight_handoffs')) &&
    (await tableExists('interview_insight_audit_log'));
  const candidatesEnabled = await tableExists('interview_insight_candidates');

  type InsightNarrativeProfile = {
    decisionFocus: string;
    execThesis: string;
    themeTitleA: string;
    themeA: string;
    themeTitleB: string;
    themeB: string;
    themeDivergence: string;
    issueTitleA: string;
    issueA: string;
    issueTitleB: string;
    issueB: string;
    opportunityTitleA: string;
    opportunityA: string;
    opportunityTitleB: string;
    opportunityB: string;
    signalTitleA: string;
    signalA: string;
    signalTitleB: string;
    signalB: string;
    evidenceQuestionA: string;
    evidenceSnippetA: string;
    evidenceQuestionB: string;
    evidenceSnippetB: string;
    missingData: [string, string];
    sourceQuote: string;
  };

  const insightProfiles: Record<string, InsightNarrativeProfile> = {
    operations: {
      decisionFocus: 'shift-level telemetry, supervisor routines, and line-loss economics',
      execThesis:
        'an operating-system issue, not a dashboard issue: value leakage appears when telemetry, escalation routines, and supervisor decisions are not synchronized',
      themeTitleA: 'Late signal arrival at shift level',
      themeA:
        'Line teams receive enough machine data, but latency and inconsistent event naming prevent supervisors from using the signal inside the same shift decision window.',
      themeTitleB: 'Changeover discipline is the economic lever',
      themeB:
        'The strongest OEE upside sits in converting Digital Twin recommendations into standard work for changeovers, handovers, and maintenance dispatch.',
      themeDivergence:
        'Operations frame the gap as response speed, while digital teams frame it as telemetry semantics and adoption discipline.',
      issueTitleA: 'Telemetry-to-action lag',
      issueA:
        'Alerts are still interpreted outside a governed escalation path, so root-cause decisions arrive after the economic loss has already compounded.',
      issueTitleB: 'Supervisor routine variance',
      issueB:
        'Shift teams do not yet execute the same sequence for changeover validation, exception capture, and follow-up ownership.',
      opportunityTitleA: 'Shift decision contract',
      opportunityA:
        'Create a shift decision contract that binds each high-value telemetry event to owner, SLA, escalation rule, and expected avoided-loss metric.',
      opportunityTitleB: 'Digital Twin value cadence',
      opportunityB:
        'Use the Digital Twin as a weekly value-cadence artifact that proves avoided downtime, not only as a technical visualization layer.',
      signalTitleA: 'OEE upside is concentrated',
      signalA:
        'The same few changeover and handover moments explain a disproportionate share of loss, making the improvement case focused and investable.',
      signalTitleB: 'Adoption is behavior-led',
      signalB:
        'Telemetry quality matters, but the adoption breakpoint is whether supervisors trust and repeat the recommendation routine.',
      evidenceQuestionA: 'Which operating moments create the largest avoidable loss?',
      evidenceSnippetA:
        'Supervisors repeatedly point to changeover handoff and late maintenance dispatch as the moments where telemetry arrives too late to protect throughput.',
      evidenceQuestionB: 'What would make the Digital Twin credible enough to scale?',
      evidenceSnippetB:
        'Teams want a traceable connection from alert to action to avoided downtime, with ownership visible in the same operating review.',
      missingData: [
        'Line-level avoided-loss attribution by event type and shift is still incomplete.',
        'Supervisor adherence data is not yet linked to the Digital Twin recommendation log.',
      ],
      sourceQuote:
        'The problem is not whether the twin can show the loss; it is whether the shift can act before the loss becomes irreversible.',
    },
    quality: {
      decisionFocus: 'defect taxonomy, root-cause workflow, and cross-plant corrective-action closure',
      execThesis:
        'a closure-system issue: quality data exists, but inconsistent taxonomy and weak owner handoffs delay validated countermeasures across plants',
      themeTitleA: 'Defect language is not yet board-grade',
      themeA:
        'Customer, plant, and supplier quality events are captured, but inconsistent classification makes recurrence and severity harder to compare across plants.',
      themeTitleB: 'Corrective actions lack closed-loop proof',
      themeB:
        'The QA workflow tracks actions, yet it does not always prove that countermeasures eliminated recurrence after launch and production conditions changed.',
      themeDivergence:
        'QA sees the gap as taxonomy discipline, while operations sees it as speed of containment and engineering sees it as unclear ownership.',
      issueTitleA: 'Root-cause closure lag',
      issueA:
        'Recurring defects remain open too long because ownership changes when an issue crosses plant, supplier, and software-release boundaries.',
      issueTitleB: 'Weak recurrence evidence',
      issueB:
        'Close-rate metrics can overstate progress when verification data is not tied to subsequent defect recurrence and warranty signals.',
      opportunityTitleA: 'Closed-loop quality cockpit',
      opportunityA:
        'Build a quality cockpit that connects defect taxonomy, corrective-action owner, verification evidence, and recurrence watch window.',
      opportunityTitleB: 'Engineering ownership protocol',
      opportunityB:
        'Introduce an engineering ownership protocol for cross-plant defect patterns so root causes are resolved once and reused across launches.',
      signalTitleA: 'Taxonomy stabilization is underway',
      signalA:
        'Teams increasingly agree that one defect language is the prerequisite for credible analytics and faster escalation.',
      signalTitleB: 'Launch readiness is a quality risk',
      signalB:
        'Digital bundle launches expose quality gaps that sit outside factory-only metrics, especially support readiness and customer-facing defect closure.',
      evidenceQuestionA: 'Where does the quality loop currently slow down?',
      evidenceSnippetA:
        'Respondents cite handoffs between plant QA, supplier quality, and product engineering as the main source of repeated closure delay.',
      evidenceQuestionB: 'What proof is needed before leaders trust quality progress?',
      evidenceSnippetB:
        'Leaders want recurrence-free evidence after corrective actions, not only a higher count of closed tickets.',
      missingData: [
        'Validated recurrence windows are not consistently stored with corrective-action records.',
        'Supplier, plant, and product defect identifiers are not fully reconciled in one taxonomy.',
      ],
      sourceQuote:
        'We close actions, but leadership still asks whether the defect is truly gone or only closed in the workflow.',
    },
    supply: {
      decisionFocus: 'supplier volatility, inventory policy, and margin-at-risk governance',
      execThesis:
        'a resilience-governance issue: supplier signals are visible, but buffer decisions and margin exposure are not governed with one scenario model',
      themeTitleA: 'Lead-time volatility is financially material',
      themeA:
        'Supplier risk now affects delivery credibility and margin, yet exposure is still interpreted differently by procurement, finance, and commercial teams.',
      themeTitleB: 'Buffer policy is not decision-ready',
      themeB:
        'The organization has heatmaps and supplier scorecards, but lacks a shared rule for when inventory buffers are justified against cash and margin trade-offs.',
      themeDivergence:
        'Procurement sees supplier continuity risk, finance sees working-capital exposure, and commercial teams see promise-risk to partners.',
      issueTitleA: 'Scenario ownership gap',
      issueA:
        'Supplier scenarios are reviewed, but mitigation ownership and commercial impact are not consistently locked in the same decision cycle.',
      issueTitleB: 'Margin exposure reconciliation',
      issueB:
        'Rush freight, late substitutions, and delivery promise risk are not always reconciled into one margin-at-risk view before executive review.',
      opportunityTitleA: 'Supplier risk war-room contract',
      opportunityA:
        'Formalize the supplier war room around a weekly contract: risk signal, margin exposure, mitigation owner, and decision required.',
      opportunityTitleB: 'Board-ready buffer policy',
      opportunityB:
        'Approve a bounded buffer policy for critical components with explicit cash, service, and margin thresholds.',
      signalTitleA: 'Commercial credibility depends on supply transparency',
      signalA:
        'Partner promises become more credible when supply risk is visible early enough to change commitment language or mitigation plans.',
      signalTitleB: 'Finance is ready for scenario governance',
      signalB:
        'Finance engagement is high because the risk is now measurable in margin volatility, not only in operational inconvenience.',
      evidenceQuestionA: 'Which supplier risks most affect business outcomes?',
      evidenceSnippetA:
        'Critical component volatility is repeatedly linked to delivery promise risk, expedite cost, and board-level margin variance.',
      evidenceQuestionB: 'What decision is missing from the current control tower?',
      evidenceSnippetB:
        'Teams need one approved rule for when to pay for buffers and when to accept delivery-risk exposure.',
      missingData: [
        'Supplier risk heatmaps do not yet include a standardized margin-at-risk calculation.',
        'Commercial promise exposure is only partially linked to component shortage scenarios.',
      ],
      sourceQuote:
        'The heatmap tells us where the pain is; it does not yet tell us which trade-off leadership has approved.',
    },
    digital: {
      decisionFocus: 'product analytics, renewal health, and roadmap trade-off governance',
      execThesis:
        'a product-operating-model issue: usage and partner signals exist, but they are not yet translated into renewal-risk action and roadmap capital allocation',
      themeTitleA: 'Renewal risk is detected too late',
      themeA:
        'Activation, usage, and support signals are available, but they are not fused early enough to intervene before renewal risk becomes commercial escalation.',
      themeTitleB: 'Roadmap trade-offs lack transparent economics',
      themeB:
        'Product requests are numerous, but prioritization does not consistently show revenue upside, adoption burden, and operational complexity in one view.',
      themeDivergence:
        'Product sees feature trade-offs, commercial teams see conversion friction, and customer success sees adoption risk.',
      issueTitleA: 'Weak signal fusion for renewals',
      issueA:
        'Renewal health is inferred from fragmented data rather than from a governed score that combines usage depth, support burden, and partner activation.',
      issueTitleB: 'Backlog pressure masks strategic bets',
      issueB:
        'Too many inputs enter roadmap debates without a shared evidence hierarchy, creating weak transparency on what is deliberately not funded.',
      opportunityTitleA: 'Renewal-risk action system',
      opportunityA:
        'Create a renewal-risk action system that converts product telemetry into named customer-success interventions and partner coaching moments.',
      opportunityTitleB: 'Evidence-based roadmap council',
      opportunityB:
        'Run roadmap decisions through an evidence hierarchy that separates strategic bets, adoption fixes, and analytical depth investments.',
      signalTitleA: 'Subscription growth is reachable',
      signalA:
        'Attach-rate performance improves where the value story, onboarding flow, and usage proof are presented together.',
      signalTitleB: 'Customer success is the adoption control point',
      signalB:
        'The strongest leading indicators sit in the first 30 days after onboarding, before renewal risk is visible in lagging metrics.',
      evidenceQuestionA: 'What signal would most improve renewal confidence?',
      evidenceSnippetA:
        'Respondents ask for one early score that combines activation, usage frequency, and support friction into a customer-success action queue.',
      evidenceQuestionB: 'Why are roadmap decisions slow?',
      evidenceSnippetB:
        'Teams describe roadmap debates as evidence-rich but decision-poor because the economics of trade-offs are not visible in one artifact.',
      missingData: [
        'Usage telemetry is not yet normalized into a renewal-risk score by cohort and partner.',
        'Roadmap options do not consistently include comparable revenue, effort, and adoption-impact fields.',
      ],
      sourceQuote:
        'We have many product signals, but not yet the one signal that tells customer success what to do this week.',
    },
    governance: {
      decisionFocus: 'board cadence, value evidence, and accountable follow-up',
      execThesis:
        'a decision-quality issue: the transformation has momentum, but board cycles still rely on manually assembled evidence and uneven follow-through',
      themeTitleA: 'Value proof arrives late in the cycle',
      themeA:
        'Realized-value evidence is compiled close to board review, which leaves limited time to challenge assumptions and improve decision confidence.',
      themeTitleB: 'Post-board follow-up is not fully institutionalized',
      themeB:
        'Decisions are visible, but action ownership, due dates, and confidence changes are not always carried into the next operating review.',
      themeDivergence:
        'The board wants a single value narrative, finance wants confidence bands, and PMO wants enforceable follow-up mechanics.',
      issueTitleA: 'Manual value reconciliation',
      issueA:
        'ROI, risk, and delivery evidence are still reconciled manually across PMO, finance, and operations before executive review.',
      issueTitleB: 'Follow-up accountability drift',
      issueB:
        'Some board decisions lose force after the meeting because the next owner, timing, and evidence requirement are not fixed at decision time.',
      opportunityTitleA: 'Board-grade value scorecard',
      opportunityA:
        'Institutionalize one board scorecard that shows expected value, realized value, confidence band, risk movement, and decision ask.',
      opportunityTitleB: 'Decision follow-up ledger',
      opportunityB:
        'Create a decision follow-up ledger that carries every board ask into accountable execution with evidence required for closure.',
      signalTitleA: 'Leadership appetite for discipline is high',
      signalA:
        'Senior leaders are asking for fewer artifacts and stronger evidence, indicating readiness for a tighter governance operating model.',
      signalTitleB: 'Confidence bands change the conversation',
      signalB:
        'When confidence is explicit, board debates move from defending numbers to choosing the next evidence-building action.',
      evidenceQuestionA: 'What makes board preparation slower than it should be?',
      evidenceSnippetA:
        'Respondents describe late reconciliation of ROI assumptions, risk movements, and initiative status as the biggest drag on board readiness.',
      evidenceQuestionB: 'Where does follow-up weaken after decisions?',
      evidenceSnippetB:
        'The next owner is often clear informally, but the evidence required for closure is not always documented at the decision moment.',
      missingData: [
        'Historical board decisions are not fully backfilled with owner, deadline, and closure evidence.',
        'ROI confidence bands are not consistently attached to initiative-level value tracking.',
      ],
      sourceQuote:
        'The board does not need more slides; it needs one version of the truth with accountable follow-through.',
    },
    partner: {
      decisionFocus: 'partner activation, enablement conversion, and commercial proof assets',
      execThesis:
        'a channel-conversion issue: enablement activity is visible, but it does not consistently convert into first-value behavior and reusable partner proof',
      themeTitleA: 'Enablement completion is not activation',
      themeA:
        'Partners complete training, but completion does not reliably predict demo readiness, first bundle sale, or confidence in the recurring value story.',
      themeTitleB: 'Evidence story varies across regions',
      themeB:
        'Commercial teams use different proof points for Atelier Digital, which weakens partner confidence and slows objection handling.',
      themeDivergence:
        'Sales sees close-rate friction, marketing sees message inconsistency, and partner managers see missing first-90-day governance.',
      issueTitleA: 'First-value ownership gap',
      issueA:
        'The handoff from signed partner to active digital-bundle seller is not governed with clear milestones and named owners.',
      issueTitleB: 'Reusable proof is under-packaged',
      issueB:
        'Strong case evidence exists, but it is not packaged into a partner-ready story that can be repeated without central support.',
      opportunityTitleA: 'First-90-day partner scorecard',
      opportunityA:
        'Manage partner onboarding through a first-90-day scorecard that tracks readiness, activation, first sale, and renewal story adoption.',
      opportunityTitleB: 'Partner evidence asset system',
      opportunityB:
        'Convert Atelier Toys proof points into modular partner assets that support demo, ROI, objection handling, and renewal conversations.',
      signalTitleA: 'Activation depends on milestone governance',
      signalA:
        'Partners advance faster when the first 90 days are managed as a journey with explicit conversion milestones.',
      signalTitleB: 'Proof improves attach-rate quality',
      signalB:
        'Where the Digital Twin proof appears early, partners tell a more credible hardware-to-SaaS story.',
      evidenceQuestionA: 'Why does partner enablement not always convert?',
      evidenceSnippetA:
        'Respondents distinguish training completion from demo readiness and first-bundle conversion, especially in new partner cohorts.',
      evidenceQuestionB: 'What proof do partners need most?',
      evidenceSnippetB:
        'Partners ask for a repeatable value story that links operational proof, educator outcomes, and recurring usage.',
      missingData: [
        'Partner training completion is not fully tied to first-sale and first-renewal outcomes.',
        'Proof assets are not versioned by buyer role, region, and partner maturity.',
      ],
      sourceQuote:
        'Our best partners do not need more content; they need a sharper sequence from proof to first sale.',
    },
    cybersecurity: {
      decisionFocus: 'OT control maturity, segmentation sequencing, and risk-based execution governance',
      execThesis:
        'a risk-execution issue: OT controls are improving, but uneven maturity and delivery conflicts make cyber hardening vulnerable to deferral',
      themeTitleA: 'Control maturity varies by site',
      themeA:
        'Plant security controls are not yet consistent enough to support a single enterprise risk posture across segmentation, access, and monitoring.',
      themeTitleB: 'Cyber work competes with delivery windows',
      themeB:
        'Security tasks are funded, but segmentation and control changes still compete with plant downtime windows and transformation delivery pressure.',
      themeDivergence:
        'Security frames the work as risk reduction, operations frames it as downtime exposure, and finance frames it as necessary resilience investment.',
      issueTitleA: 'Segmentation priority conflict',
      issueA:
        'OT segmentation can be delayed when it is not explicitly sequenced with production windows, fallback controls, and value-enabling dependencies.',
      issueTitleB: 'Weak evidence of control closure',
      issueB:
        'Control remediation is tracked, but site-level evidence is not yet consistent enough for audit-grade assurance.',
      opportunityTitleA: 'Risk-based OT hardening roadmap',
      opportunityA:
        'Sequence OT hardening by risk, downtime constraint, and dependency on Digital Twin expansion rather than by generic control checklist.',
      opportunityTitleB: 'Audit-ready control evidence pack',
      opportunityB:
        'Create a control evidence pack that shows baseline maturity, closure owner, verification result, and residual risk by site.',
      signalTitleA: 'Cyber is an enabler of scale',
      signalA:
        'The strongest argument for OT cyber funding is its role in making telemetry, automation, and Digital Twin scale credible.',
      signalTitleB: 'Operations needs predictable implementation windows',
      signalB:
        'Plant leaders accept the risk case when implementation windows, fallback controls, and escalation roles are explicit.',
      evidenceQuestionA: 'Where does OT cyber maturity vary most?',
      evidenceSnippetA:
        'Respondents point to uneven segmentation, privileged access discipline, and monitoring coverage across plant environments.',
      evidenceQuestionB: 'What blocks faster hardening execution?',
      evidenceSnippetB:
        'Teams describe conflicts between security work, production windows, and transformation delivery commitments.',
      missingData: [
        'Site-level OT control evidence is not yet standardized for audit and board review.',
        'Downtime windows and fallback controls are not fully linked to the segmentation roadmap.',
      ],
      sourceQuote:
        'Cyber hardening is not optional, but it needs an execution plan the plant can actually live with.',
    },
    people: {
      decisionFocus: 'capability transfer, manager coaching capacity, and routine adoption evidence',
      execThesis:
        'a behavior-transfer issue: capability content is strong, but operating routines will not scale without coaching capacity and adoption proof',
      themeTitleA: 'Learning does not yet equal routine change',
      themeA:
        'Supervisors complete training, but the organization has not yet proven consistent transfer into daily management, escalation, and review routines.',
      themeTitleB: 'Manager coaching is the bottleneck',
      themeB:
        'The academy can scale content faster than managers can coach new behaviors, creating a risk of knowledge without operating change.',
      themeDivergence:
        'People teams track capability uplift, operations track routine adherence, and executives track whether the transformation becomes self-sustaining.',
      issueTitleA: 'Uneven behavior transfer',
      issueA:
        'Routine adoption varies by manager and line, which makes capability uplift fragile when strong local sponsors are absent.',
      issueTitleB: 'Coaching capacity constraint',
      issueB:
        'Managers do not have enough protected capacity to observe routines, coach gaps, and reinforce the new operating model.',
      opportunityTitleA: 'Routine adoption dashboard',
      opportunityA:
        'Track academy outcomes through routine adherence, escalation quality, action closure, and observed coaching moments by cohort.',
      opportunityTitleB: 'Manager coaching operating model',
      opportunityB:
        'Define a lightweight coaching model that tells managers which routines to observe, what evidence to capture, and when to escalate.',
      signalTitleA: 'Capability energy is high',
      signalA:
        'Participants see the academy as practical when content is anchored in current transformation routines rather than generic training.',
      signalTitleB: 'Adoption risk is local',
      signalB:
        'Variance appears most clearly between teams with strong manager sponsorship and teams treating the academy as optional learning.',
      evidenceQuestionA: 'What proves that capability building is working?',
      evidenceSnippetA:
        'Respondents ask for evidence that supervisors use new escalation and review routines after training, not only attendance metrics.',
      evidenceQuestionB: 'Where does the academy risk stalling?',
      evidenceSnippetB:
        'The most common concern is manager bandwidth for coaching and reinforcement during daily operations.',
      missingData: [
        'Academy participation is not yet linked to observed routine adherence by team.',
        'Manager coaching capacity and follow-up quality are not measured consistently.',
      ],
      sourceQuote:
        'The academy is credible only if it changes what supervisors do on Monday morning.',
    },
    finance: {
      decisionFocus: 'ROI confidence bands, realized-value tracking, and capital allocation discipline',
      execThesis:
        'a capital-allocation issue: expected ROI is visible, but confidence bands and realized-value evidence are not mature enough for fast prioritization',
      themeTitleA: 'ROI confidence is under-specified',
      themeA:
        'Initiatives have expected ROI, but assumptions, confidence ranges, and evidence maturity are not consistently visible at portfolio-review time.',
      themeTitleB: 'Realized value evidence is uneven',
      themeB:
        'Finance can track spend and baselines, but realized benefits are not always tied back to operational evidence with enough auditability.',
      themeDivergence:
        'Finance wants defensible confidence ranges, PMO wants a simple executive narrative, and initiative owners want faster funding decisions.',
      issueTitleA: 'Capital allocation lacks comparable confidence',
      issueA:
        'Leadership can compare expected ROI, but cannot reliably compare confidence level, evidence maturity, and downside risk across initiatives.',
      issueTitleB: 'Benefits realization lag',
      issueB:
        'Realized value is validated after operating decisions are made, limiting its usefulness for near-term reprioritization.',
      opportunityTitleA: 'Portfolio confidence-band model',
      opportunityA:
        'Attach confidence bands to top initiatives using evidence quality, assumption volatility, and realized-value validation stage.',
      opportunityTitleB: 'Finance evidence chain',
      opportunityB:
        'Create a finance evidence chain from operational signal to benefit claim, reviewer, confidence level, and board pack reference.',
      signalTitleA: 'Finance can accelerate, not only control',
      signalA:
        'Better confidence architecture would let finance speed up good bets and challenge weak ones earlier.',
      signalTitleB: 'Evidence quality is becoming a portfolio metric',
      signalB:
        'The organization is ready to discuss value claims by confidence and evidence maturity, not only by headline ROI.',
      evidenceQuestionA: 'What prevents faster capital allocation?',
      evidenceSnippetA:
        'Finance respondents point to missing confidence bands and inconsistent evidence maturity across competing initiatives.',
      evidenceQuestionB: 'What would make value tracking board-ready?',
      evidenceSnippetB:
        'Leaders want each value claim tied to an operational signal, owner, assumption set, and confidence level.',
      missingData: [
        'Initiative ROI assumptions are not fully stored with confidence bands and evidence maturity.',
        'Realized-value claims are not consistently linked to operational source signals.',
      ],
      sourceQuote:
        'The debate is not whether an initiative has ROI; it is how much confidence we should assign before allocating the next euro.',
    },
    commercial: {
      decisionFocus: 'funnel signal quality, renewal intelligence, and revenue-priority governance',
      execThesis:
        'a revenue-intelligence issue: pipeline activity is visible, but leading indicators do not yet distinguish high-quality growth from activity volume',
      themeTitleA: 'Funnel signals are fragmented',
      themeA:
        'Commercial activity, partner readiness, renewal risk, and product usage are tracked separately, obscuring which accounts deserve priority action.',
      themeTitleB: 'Activity metrics overstate revenue quality',
      themeB:
        'The funnel can look active while renewal exposure, onboarding friction, or weak partner proof lowers the quality of future revenue.',
      themeDivergence:
        'Sales sees pipeline volume, revenue operations sees signal fragmentation, and customer success sees early adoption risk.',
      issueTitleA: 'Priority logic is not governed',
      issueA:
        'Teams do not yet share one rule for ranking opportunities by revenue quality, renewal risk, and readiness to convert.',
      issueTitleB: 'Weak traceability from action to outcome',
      issueB:
        'Commercial actions are not consistently tied to later attach-rate, renewal, and activation outcomes.',
      opportunityTitleA: 'Revenue-quality score',
      opportunityA:
        'Create a revenue-quality score that combines pipeline stage, partner readiness, activation signal, renewal risk, and proof-asset usage.',
      opportunityTitleB: 'Commercial action ledger',
      opportunityB:
        'Track the actions taken on priority accounts and connect them to downstream attach, adoption, and renewal outcomes.',
      signalTitleA: 'Pipeline quality can be made explicit',
      signalA:
        'The data needed for a better priority model exists, but it needs a governed score and ownership cadence.',
      signalTitleB: 'Renewal risk should shape growth motions',
      signalB:
        'The same signals that flag renewal exposure can improve sales focus before accounts become rescue cases.',
      evidenceQuestionA: 'Why are commercial priorities hard to compare?',
      evidenceSnippetA:
        'Respondents describe pipeline, renewal, partner readiness, and usage signals living in separate views with no single ranking logic.',
      evidenceQuestionB: 'What would improve revenue-quality governance?',
      evidenceSnippetB:
        'Revenue operations wants one score that explains which accounts deserve action and which intervention was taken.',
      missingData: [
        'Commercial actions are not fully linked to attach-rate and renewal outcomes by account.',
        'Partner readiness and usage health are not yet part of one revenue-quality score.',
      ],
      sourceQuote:
        'The funnel is busy, but busy is not the same as high-quality recurring revenue.',
    },
    default: {
      decisionFocus: 'cross-functional evidence, governed ownership, and measurable value realization',
      execThesis:
        'a governance-system issue: the organization has useful signals, but needs stronger evidence discipline to convert them into accountable execution',
      themeTitleA: 'Evidence exists but is not standardized',
      themeA:
        'Teams can identify the right signals, but labels, timing, and confidence levels are not standardized across functions.',
      themeTitleB: 'Ownership is clearer in meetings than in systems',
      themeB:
        'Accountability is often understood informally, but is not always encoded in workflows with due dates and closure evidence.',
      themeDivergence:
        'Functions agree on the direction of travel, but differ on which evidence should trigger action.',
      issueTitleA: 'Weak insight-to-action handoff',
      issueA:
        'Insights do not always become governed work with explicit owner, deadline, and measurable outcome.',
      issueTitleB: 'Decision evidence is manually reconciled',
      issueB:
        'Teams still spend too much time reconciling evidence before reviews instead of using it to decide.',
      opportunityTitleA: 'Evidence-to-action operating model',
      opportunityA:
        'Standardize how each promoted insight becomes an initiative task, decision, or risk with owner and confidence level.',
      opportunityTitleB: 'Executive evidence chain',
      opportunityB:
        'Connect operating signals to board-level decisions through one auditable evidence chain.',
      signalTitleA: 'Standardization appetite is rising',
      signalA:
        'Teams increasingly ask for fewer artifacts and stronger common rules for evidence and ownership.',
      signalTitleB: 'Governance can unlock speed',
      signalB:
        'Better evidence structure would reduce review friction and improve execution confidence.',
      evidenceQuestionA: 'Where is decision evidence currently weakest?',
      evidenceSnippetA:
        'Respondents describe fragmented evidence across PMO, finance, and operating reviews.',
      evidenceQuestionB: 'What would make handoffs more reliable?',
      evidenceSnippetB:
        'Teams want every promoted insight tied to an owner, next action, confidence level, and closure metric.',
      missingData: [
        'Evidence maturity is not consistently attached to insight handoffs.',
        'Outcome ownership is not always stored in the same place as the original signal.',
      ],
      sourceQuote:
        'The signal is useful only when it lands as accountable work with a measurable outcome.',
    },
  };

  for (const [index, blueprint] of insightBlueprints.entries()) {
    const insightId = makeId(organizationId, 'insight', blueprint.slug);
    const createdBy = userMap[blueprint.ownerSlug]?.id || userMap['antoine-laurent']?.id || null;
    const sessionId = interviewSessionMap[blueprint.sessionSlug];
    const primaryEvidenceRef = `session:${sessionId}:q${String((index % 10) + 1).padStart(2, '0')}`;
    const secondaryEvidenceRef = `session:${sessionId}:q${String(((index + 3) % 10) + 1).padStart(2, '0')}`;
    const relatedInitiativeId = makeId(organizationId, 'initiative', blueprint.initiativeSlug);
    const createdAt = materializeRelativeIso(`-${14 - (index % 6)}d`, { anchorDate });
    const updatedAt = materializeRelativeIso(`-${2 - (index % 2)}d`, { anchorDate });
    const profile = insightProfiles[blueprint.category] || insightProfiles.default;
    const promptFocus = `This insight tracks ${profile.decisionFocus} and converts it into an accountable technology-enabled intervention.`;
    const themeA = profile.themeA;
    const themeB = profile.themeB;
    const issueA = profile.issueA;
    const issueB = profile.issueB;
    const oppA = profile.opportunityA;
    const oppB = profile.opportunityB;
    const executiveSummary = `Atelier Toys should treat "${blueprint.title}" as ${profile.execThesis}. The implication is practical: the insight should not remain an observation, but should be governed through ${blueprint.initiativeSlug} with a named owner, evidence trace, success metric, and review cadence. The expected management value is faster prioritization, lower execution ambiguity, and a clearer board-level story about why this technology move matters now.`;

    const content = [
      '## Executive Summary',
      executiveSummary,
      '',
      '## Technology Findings',
      `- ${themeA}`,
      `- ${themeB}`,
      '',
      '## Risks',
      `- ${issueA}`,
      `- ${issueB}`,
      '',
      '## Recommended Move',
      `- ${oppA}`,
      `- ${oppB}`,
      '',
      `## Connected Initiative`,
      `- ${blueprint.initiativeSlug}`,
      '',
      '## Evidence',
      `- ${primaryEvidenceRef}`,
      `- ${secondaryEvidenceRef}`,
    ].join('\n');

    const themes = [
      {
        id: `${blueprint.slug}:theme:primary`,
        title: profile.themeTitleA,
        description: themeA,
        evidence_refs: [primaryEvidenceRef],
        strength: 'strong',
        confidence: blueprint.confidence,
        crossSessionPattern: true,
        perspective_labels: [blueprint.category, blueprint.pmoDomain, blueprint.ownerSlug],
        divergence_note: profile.themeDivergence,
      },
      {
        id: `${blueprint.slug}:theme:secondary`,
        title: profile.themeTitleB,
        description: themeB,
        evidence_refs: [secondaryEvidenceRef],
        strength: 'moderate',
        confidence: blueprint.confidence,
        crossSessionPattern: true,
        perspective_labels: [blueprint.category, 'governance'],
      },
    ];

    const issues = [
      {
        id: `${blueprint.slug}:issue:primary`,
        title: profile.issueTitleA,
        description: issueA,
        severity: 'high',
        confidence: blueprint.confidence,
        evidence_refs: [primaryEvidenceRef],
        crossSessionPattern: true,
        perspective_labels: ['pmo', blueprint.category],
      },
      {
        id: `${blueprint.slug}:issue:secondary`,
        title: profile.issueTitleB,
        description: issueB,
        severity: blueprint.impactLevel === 'high' ? 'high' : 'medium',
        confidence: blueprint.confidence,
        evidence_refs: [secondaryEvidenceRef],
        crossSessionPattern: true,
        perspective_labels: ['finance', 'operations', 'governance'],
      },
    ];

    const opportunities = [
      {
        id: `${blueprint.slug}:opportunity:primary`,
        title: profile.opportunityTitleA,
        description: oppA,
        impact: 'high',
        confidence: blueprint.confidence,
        evidence_refs: [primaryEvidenceRef, secondaryEvidenceRef],
        crossSessionPattern: true,
        perspective_labels: ['technology', 'governance'],
      },
      {
        id: `${blueprint.slug}:opportunity:secondary`,
        title: profile.opportunityTitleB,
        description: oppB,
        impact: blueprint.impactLevel === 'high' ? 'high' : 'medium',
        confidence: blueprint.confidence,
        evidence_refs: [secondaryEvidenceRef],
        crossSessionPattern: true,
        perspective_labels: ['board', 'pmo', 'operations'],
      },
    ];

    const signals = [
      {
        id: `${blueprint.slug}:signal:primary`,
        title: profile.signalTitleA,
        description: profile.signalA,
        type: 'tension',
      },
      {
        id: `${blueprint.slug}:signal:secondary`,
        title: profile.signalTitleB,
        description: profile.signalB,
        type: 'emerging_pattern',
      },
    ];

    const evidenceMap = [
      {
        answer_id: `${blueprint.slug}-a1`,
        question_text: profile.evidenceQuestionA,
        answer_snippet: profile.evidenceSnippetA,
        linked_themes: [`${blueprint.slug}:theme:primary`],
        linked_issues: [`${blueprint.slug}:issue:primary`],
      },
      {
        answer_id: `${blueprint.slug}-a2`,
        question_text: profile.evidenceQuestionB,
        answer_snippet: profile.evidenceSnippetB,
        linked_themes: [`${blueprint.slug}:theme:secondary`],
        linked_issues: [`${blueprint.slug}:issue:secondary`],
      },
    ];

    const missingData = profile.missingData;

    const filters = {
      module: 'atelier-demo-interview-insights',
      technologyScope: ['telemetry', 'data-contracts', 'workflow-automation', 'governance'],
      linkedInitiative: blueprint.initiativeSlug,
      customPrompt: promptFocus,
    };

    const structuredContent = {
      architectureLayer:
        locale === 'pl'
          ? 'signal -> interpretation -> governed action'
          : 'signal -> interpretation -> governed action',
      findingGraph: {
        themes,
        issues,
        opportunities,
        signals,
      },
      linkedInitiativeId: relatedInitiativeId,
      processingNotes:
        locale === 'pl'
          ? 'Wszystkie findingi zostały zmapowane do działania z ownerem i śladem evidence.'
          : 'All findings are mapped to owner-bound action with evidence trace.',
    };

    const cols = ['id', 'organization_id', 'title', 'status'];
    const vals: Array<string | number | null> = [insightId, organizationId, blueprint.title, 'published'];

    if (insightCols.has('session_id')) {
      cols.push('session_id');
      vals.push(sessionId);
    }
    if (insightCols.has('category')) {
      cols.push('category');
      vals.push(blueprint.category);
    }
    if (insightCols.has('prompt_type')) {
      cols.push('prompt_type');
      vals.push(blueprint.promptType);
    }
    if (insightCols.has('source_session_ids')) {
      cols.push('source_session_ids');
      vals.push(JSON.stringify([sessionId]));
    }
    if (insightCols.has('filters')) {
      cols.push('filters');
      vals.push(JSON.stringify(filters));
    }
    if (insightCols.has('description')) {
      cols.push('description');
      vals.push(executiveSummary);
    }
    if (insightCols.has('source_quote')) {
      cols.push('source_quote');
      vals.push(profile.sourceQuote);
    }
    if (insightCols.has('insight_type')) {
      cols.push('insight_type');
      vals.push(blueprint.insightType);
    }
    if (insightCols.has('impact_level')) {
      cols.push('impact_level');
      vals.push(blueprint.impactLevel);
    }
    if (insightCols.has('confidence')) {
      cols.push('confidence');
      vals.push(blueprint.confidence);
    }
    if (insightCols.has('pmo_domain')) {
      cols.push('pmo_domain');
      vals.push(blueprint.pmoDomain);
    }
    if (insightCols.has('actionable')) {
      cols.push('actionable');
      vals.push(1);
    }
    if (insightCols.has('content')) {
      cols.push('content');
      vals.push(content);
    }
    if (insightCols.has('executive_summary')) {
      cols.push('executive_summary');
      vals.push(executiveSummary);
    }
    if (insightCols.has('themes_json')) {
      cols.push('themes_json');
      vals.push(JSON.stringify(themes));
    }
    if (insightCols.has('issues_json')) {
      cols.push('issues_json');
      vals.push(JSON.stringify(issues));
    }
    if (insightCols.has('opportunities_json')) {
      cols.push('opportunities_json');
      vals.push(JSON.stringify(opportunities));
    }
    if (insightCols.has('signals_json')) {
      cols.push('signals_json');
      vals.push(JSON.stringify(signals));
    }
    if (insightCols.has('evidence_map_json')) {
      cols.push('evidence_map_json');
      vals.push(JSON.stringify(evidenceMap));
    }
    if (insightCols.has('missing_data_json')) {
      cols.push('missing_data_json');
      vals.push(JSON.stringify(missingData));
    }
    if (insightCols.has('structured_content')) {
      cols.push('structured_content');
      vals.push(JSON.stringify(structuredContent));
    }
    if (insightCols.has('evidence_links')) {
      cols.push('evidence_links');
      vals.push(JSON.stringify([primaryEvidenceRef, secondaryEvidenceRef]));
    }
    if (insightCols.has('unknowns')) {
      cols.push('unknowns');
      vals.push(JSON.stringify(missingData));
    }
    if (insightCols.has('counterpoints')) {
      cols.push('counterpoints');
      vals.push(
        JSON.stringify([
          `Some teams may argue that ${blueprint.initiativeSlug} can progress with existing dashboards and informal ownership; this should be tested against the evidence gaps before scale funding.`,
        ])
      );
    }
    if (insightCols.has('assumptions')) {
      cols.push('assumptions');
      vals.push(
        JSON.stringify([
          `Assumes ${profile.decisionFocus} can be measured with sufficient data freshness and assigned to accountable owners.`,
        ])
      );
    }
    if (insightCols.has('confidence_score')) {
      cols.push('confidence_score');
      vals.push(78 + (index % 18));
    }
    if (insightCols.has('inference_run_id')) {
      cols.push('inference_run_id');
      vals.push(makeId(organizationId, 'inference-run', blueprint.slug));
    }
    if (insightCols.has('insight_category')) {
      cols.push('insight_category');
      vals.push(`${blueprint.category}_technology`);
    }
    if (insightCols.has('source_session_count')) {
      cols.push('source_session_count');
      vals.push(1);
    }
    if (insightCols.has('tokens_used')) {
      cols.push('tokens_used');
      vals.push(4200 + index * 115);
    }
    if (insightCols.has('generation_time_ms')) {
      cols.push('generation_time_ms');
      vals.push(1800 + index * 37);
    }
    if (insightCols.has('review_status')) {
      cols.push('review_status');
      vals.push('published');
    }
    if (insightCols.has('published_at')) {
      cols.push('published_at');
      vals.push(materializeRelativeIso('-1d', { anchorDate }));
    }
    if (insightCols.has('reviewed_by')) {
      cols.push('reviewed_by');
      vals.push(userMap['antoine-laurent']?.id || createdBy);
    }
    if (insightCols.has('exported_to_tools')) {
      cols.push('exported_to_tools');
      vals.push(1);
    }
    if (insightCols.has('exported_to_assessment')) {
      cols.push('exported_to_assessment');
      vals.push(1);
    }
    if (insightCols.has('error_message')) {
      cols.push('error_message');
      vals.push(null);
    }
    if (insightCols.has('created_by')) {
      cols.push('created_by');
      vals.push(createdBy);
    }
    if (insightCols.has('created_at')) {
      cols.push('created_at');
      vals.push(createdAt);
    }
    if (insightCols.has('updated_at')) {
      cols.push('updated_at');
      vals.push(updatedAt);
    }

    await DbPromise.run(
      `INSERT INTO interview_insights (${cols.join(', ')})
       VALUES (${cols.map(() => '?').join(', ')})
       ON CONFLICT(id) DO UPDATE SET
         title=excluded.title,
         status=excluded.status${
           cols.includes('content') ? ', content=excluded.content' : ''
         }${
           cols.includes('executive_summary')
             ? ', executive_summary=excluded.executive_summary'
             : ''
         }${
           cols.includes('themes_json') ? ', themes_json=excluded.themes_json' : ''
         }${
           cols.includes('issues_json') ? ', issues_json=excluded.issues_json' : ''
         }${
           cols.includes('opportunities_json')
             ? ', opportunities_json=excluded.opportunities_json'
             : ''
         }${
           cols.includes('signals_json') ? ', signals_json=excluded.signals_json' : ''
         }${
           cols.includes('evidence_map_json')
             ? ', evidence_map_json=excluded.evidence_map_json'
             : ''
         }${
           cols.includes('missing_data_json')
             ? ', missing_data_json=excluded.missing_data_json'
             : ''
         }${
           cols.includes('structured_content')
             ? ', structured_content=excluded.structured_content'
             : ''
         }${
           cols.includes('updated_at') ? ', updated_at=excluded.updated_at' : ''
         }`,
      vals,
      { fallback: true }
    );

    if (findingTablesEnabled) {
      const findingId = makeId(organizationId, 'insight-finding', `${blueprint.slug}-f1`);
      const findingStatement = `Technology finding: ${blueprint.title} materially affects ${profile.decisionFocus} and should be managed through ${blueprint.initiativeSlug} rather than left as interview context.`;
      const limits = `Finding scope is based on the current demo operating cycle; ${profile.missingData[0].toLowerCase()}`;
      const nextAction = `Move the finding into PMO review, assign ${blueprint.ownerSlug} as accountable owner, and attach the next initiative task to a quantified success metric.`;

      await DbPromise.run(
        `INSERT INTO interview_insight_findings
         (id, organization_id, insight_id, source_section_type, source_section_index, source_key, finding_statement, confidence_level, limits_text, limits_json, next_action_text, next_action_json, review_status, created_by, updated_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           finding_statement=excluded.finding_statement,
           confidence_level=excluded.confidence_level,
           limits_text=excluded.limits_text,
           next_action_text=excluded.next_action_text,
           review_status=excluded.review_status,
           updated_at=excluded.updated_at`,
        [
          findingId,
          organizationId,
          insightId,
          'theme',
          0,
          `theme:0:${blueprint.slug}`,
          findingStatement,
          blueprint.confidence,
          limits,
          JSON.stringify([limits]),
          nextAction,
          JSON.stringify([nextAction]),
          'published',
          createdBy,
          createdBy,
          createdAt,
          updatedAt,
        ],
        { fallback: true }
      );

      const pointerId = makeId(organizationId, 'insight-pointer', `${blueprint.slug}-p1`);
      await DbPromise.run(
        `INSERT INTO interview_insight_evidence_pointers
         (id, organization_id, insight_id, finding_id, pointer_type, source_ref, source_fingerprint, captured_excerpt, captured_at, pointer_state, duplicate_observed_count, metadata_json, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           captured_excerpt=excluded.captured_excerpt,
           updated_at=excluded.updated_at`,
        [
          pointerId,
          organizationId,
          insightId,
          findingId,
          'interview_session',
          primaryEvidenceRef,
          `${blueprint.slug}:f1:e1`,
          profile.evidenceSnippetA,
          updatedAt,
          'active',
          0,
          JSON.stringify({ initiative: blueprint.initiativeSlug, category: blueprint.category }),
          createdBy,
          createdAt,
          updatedAt,
        ],
        { fallback: true }
      );

      const handoffId = makeId(organizationId, 'insight-handoff', `${blueprint.slug}-h1`);
      const handoffPayload = {
        source: {
          insightId,
          findingId,
          confidenceLevel: blueprint.confidence,
        },
        recommendation: nextAction,
        links: {
          initiativeId: relatedInitiativeId,
        },
      };
      await DbPromise.run(
        `INSERT INTO interview_insight_handoffs
         (id, organization_id, insight_id, finding_id, target_kind, target_id, target_ref_type, status, payload_json, operator_decision_json, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           status=excluded.status,
           payload_json=excluded.payload_json,
           updated_at=excluded.updated_at`,
        [
          handoffId,
          organizationId,
          insightId,
          findingId,
          'initiative',
          relatedInitiativeId,
          'linked',
          'accepted',
          JSON.stringify(handoffPayload),
          JSON.stringify({ decision: 'accepted', by: createdBy }),
          createdBy,
          createdAt,
          updatedAt,
        ],
        { fallback: true }
      );

      const auditId = makeId(organizationId, 'insight-audit', `${blueprint.slug}-a1`);
      await DbPromise.run(
        `INSERT INTO interview_insight_audit_log
         (id, organization_id, insight_id, finding_id, entity_type, entity_id, action, actor_user_id, detail_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           detail_json=excluded.detail_json`,
        [
          auditId,
          organizationId,
          insightId,
          findingId,
          'handoff',
          handoffId,
          'seeded_publish_and_handoff',
          createdBy,
          JSON.stringify({
            linkedInitiative: blueprint.initiativeSlug,
            impactLevel: blueprint.impactLevel,
            technologyCategory: blueprint.category,
          }),
          updatedAt,
        ],
        { fallback: true }
      );
    }

    if (candidatesEnabled) {
      const candidateId = makeId(organizationId, 'insight-candidate', `${blueprint.slug}-c1`);
      await DbPromise.run(
        `INSERT INTO interview_insight_candidates
         (id, organization_id, insight_id, source_section_type, source_section_index, source_key, candidate_statement, rationale_text, confidence_hint, triage_status, followup_type, followup_recommendation, linked_finding_id, created_by, updated_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           triage_status=excluded.triage_status,
           followup_recommendation=excluded.followup_recommendation,
           updated_at=excluded.updated_at`,
        [
          candidateId,
          organizationId,
          insightId,
          'theme',
          0,
          `theme:0:${blueprint.slug}`,
          `Candidate: ${blueprint.title} should be retained as a PMO-governed monitored finding.`,
          `Cross-session pattern, strong evidence, and direct impact on ${profile.decisionFocus}.`,
          blueprint.confidence,
          'promoted',
          'publish',
          `Candidate promoted to finding and linked to ${blueprint.initiativeSlug}.`,
          makeId(organizationId, 'insight-finding', `${blueprint.slug}-f1`),
          createdBy,
          createdBy,
          createdAt,
          updatedAt,
        ],
        { fallback: true }
      );
    }
  }
}

export async function seedAtelierToysDemoDataset(
  input: SeedDemoDatasetInput
): Promise<SeedDemoDatasetResult> {
  const organizationId = input.organizationId;
  const anchorDate = getDemoAnchorDate(input.anchorDate);
  // The Atelier board demo is intentionally English-only so executive narratives,
  // insight artifacts, and initiative evidence never mix languages.
  const locale: DemoLocale = 'en';
  const leaders = getAtelierToysLeadership(locale);
  const projects = getAtelierToysProjects(locale);
  const initiatives = getAtelierToysInitiatives(locale);
  assertPortfolioSanity(initiatives, locale);
  const scenarios = getAtelierToysDemoScenarios(locale);
  const toolCoverage = getAtelierToysToolCoverage(locale);

  await upsertOrg(organizationId);
  const userMap = await upsertUsers(organizationId, locale);
  await upsertTeams(organizationId, userMap, locale);
  const projectMap = await upsertProjects(organizationId, userMap, locale);
  await upsertProjectUsers(projectMap, userMap, locale);
  const { initiativeMap, taskCount, decisionCount } = await upsertInitiatives(
    organizationId,
    userMap,
    projectMap,
    anchorDate,
    locale
  );
  const reportCount = await upsertReports(organizationId, projectMap, userMap, anchorDate, locale);
  const docCount = await upsertKnowledgeDocs(organizationId, locale);
  await upsertPrompts(organizationId, userMap, locale);
  await upsertToolSessions(organizationId, projectMap, userMap, locale);
  const resultsCoverage = await upsertResultsLayer(
    organizationId,
    userMap['claire-laurent']?.id || userMap['antoine-laurent']?.id || '',
    anchorDate,
    initiativeMap
  );
  const workspaceOwnerUserId = input.viewerUserId || userMap['antoine-laurent']?.id;
  if (workspaceOwnerUserId) {
    await upsertNotebookPages(
      organizationId,
      workspaceOwnerUserId,
      projectMap['forward-pmo'] || null,
      locale
    );
    await upsertIdeaWorkspaces(organizationId, workspaceOwnerUserId, locale);
  }
  await upsertDrdAssessment(organizationId, userMap, projectMap, anchorDate, locale);
  await upsertNotifications(organizationId, userMap, locale);
  await upsertActivityLogs(organizationId, userMap, locale);
  await upsertInterviewInsightDemoArtifacts(organizationId, userMap, anchorDate, locale);

  return {
    organizationId,
    anchorDate: anchorDate.toISOString(),
    locale,
    counts: {
      users: leaders.length,
      projects: projects.length,
      initiatives: initiatives.length,
      tasks: taskCount,
      decisions: decisionCount,
      reports: reportCount,
      docs: docCount,
    },
    scenarios,
    toolCoverage,
    resultsCoverage,
  };
}

export async function getDemoDatasetStats(organizationId: string): Promise<{
  projects: number;
  initiatives: number;
  tasks: number;
  decisions: number;
  users: number;
}> {
  const [projects, initiatives, tasks, decisions, users] = await Promise.all([
    DbPromise.get<{ c: number }>(
      `SELECT COUNT(*) as c FROM projects WHERE organization_id = ?`,
      [organizationId],
      {
        fallback: false,
      }
    ),
    DbPromise.get<{ c: number }>(
      `SELECT COUNT(*) as c FROM initiatives WHERE organization_id = ?`,
      [organizationId],
      {
        fallback: false,
      }
    ),
    DbPromise.get<{ c: number }>(
      `SELECT COUNT(*) as c FROM tasks WHERE organization_id = ?`,
      [organizationId],
      {
        fallback: false,
      }
    ),
    DbPromise.get<{ c: number }>(
      `SELECT COUNT(*) as c FROM decisions WHERE organization_id = ?`,
      [organizationId],
      {
        fallback: false,
      }
    ),
    DbPromise.get<{ c: number }>(
      `SELECT COUNT(*) as c FROM users WHERE organization_id = ?`,
      [organizationId],
      {
        fallback: false,
      }
    ),
  ]);

  return {
    projects: projects?.c || 0,
    initiatives: initiatives?.c || 0,
    tasks: tasks?.c || 0,
    decisions: decisions?.c || 0,
    users: users?.c || 0,
  };
}

export async function verifyCanonicalDemoDataset(organizationId: string): Promise<{
  organizationId: string;
  ready: boolean;
  checks: Record<string, { ok: boolean; actual: number; min: number }>;
  missingTables: string[];
}> {
  const checks: Record<string, { ok: boolean; actual: number; min: number }> = {};
  const missingTables: string[] = [];

  const probe = async (label: string, table: string, min: number) => {
    if (!(await tableExists(table))) {
      missingTables.push(table);
      checks[label] = { ok: false, actual: 0, min };
      return;
    }
    const row = await DbPromise.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${table} WHERE organization_id = ?`,
      [organizationId],
      { fallback: true }
    );
    const actual = Number(row?.count || 0);
    checks[label] = { ok: actual >= min, actual, min };
  };

  await probe('initiatives', 'initiatives', 20);
  await probe('tasks', 'tasks', 50);
  await probe('decisions', 'decisions', 20);
  await probe('reports', 'status_reports', 6);
  await probe('knowledgeDocs', 'knowledge_docs', 6);
  await probe('kpis', 'initiative_kpis', 6);
  await probe('kpiTimeSeries', 'kpi_time_series', 30);
  await probe('kpiMappings', 'initiative_kpi_mappings', 5);
  await probe('roiAssumptions', 'roi_assumptions', 4);
  await probe('roiRealized', 'roi_realized_values', 10);
  await probe('deviationCases', 'kpi_deviation_cases', 2);

  const ready = Object.values(checks).every((c) => c.ok) && missingTables.length === 0;
  return {
    organizationId,
    ready,
    checks,
    missingTables,
  };
}

export async function deleteDemoDatasetForOrganization(organizationId: string): Promise<void> {
  const deleteQueries = [
    ['v8_roi_realization_entries', 'organization_id'],
    ['v8_deviation_records', 'organization_id'],
    ['v8_kpi_definitions', 'organization_id'],
    ['results_kpi_report_snapshots', 'organization_id'],
    ['kpi_deviation_actions', 'case_id', 'kpi_deviation_cases', 'organization_id'],
    ['kpi_deviation_cases', 'organization_id'],
    ['roi_realized_values', 'organization_id'],
    ['roi_assumptions', 'organization_id'],
    ['initiative_kpi_mappings', 'organization_id'],
    ['kpi_time_series', 'organization_id'],
    ['initiative_kpis', 'organization_id'],
    ['initiative_dependencies', 'organization_id'],
    ['initiative_milestones', 'organization_id'],
    ['decisions', 'organization_id'],
    ['tasks', 'organization_id'],
    ['status_reports', 'organization_id'],
    ['custom_prompts', 'organization_id'],
    ['assessment_report_section_history', 'report_id', 'assessment_reports', 'organization_id'],
    ['assessment_report_sections', 'report_id', 'assessment_reports', 'organization_id'],
    ['assessment_reports', 'organization_id'],
    ['assessments', 'organization_id'],
    ['knowledge_chunks', 'doc_id', 'knowledge_docs', 'organization_id'],
    ['knowledge_docs', 'organization_id'],
    ['project_users', 'project_id', 'projects', 'organization_id'],
    ['team_members', 'team_id', 'teams', 'organization_id'],
    ['teams', 'organization_id'],
    ['tool_sessions', 'organization_id'],
    ['sessions', 'project_id', 'projects', 'organization_id'],
    ['activity_logs', 'organization_id'],
    ['notifications', 'user_id', 'users', 'organization_id'],
    ['notebook_pages', 'organization_id'],
    ['my_idea_maps', 'organization_id'],
    ['my_idea_edges', 'organization_id'],
    ['my_ideas', 'organization_id'],
    ['initiatives', 'organization_id'],
    ['projects', 'organization_id'],
    ['users', 'organization_id'],
    ['organizations', 'id'],
  ] as const;

  for (const query of deleteQueries) {
    const [table, column, joinTable, joinColumn] = query;
    if (!(await tableExists(table))) continue;
    if (!joinTable) {
      await DbPromise.run(`DELETE FROM ${table} WHERE ${column} = ?`, [organizationId], {
        fallback: true,
      });
      continue;
    }
    if (!(await tableExists(joinTable))) continue;
    await DbPromise.run(
      `DELETE FROM ${table}
       WHERE ${column} IN (SELECT id FROM ${joinTable} WHERE ${joinColumn} = ?)`,
      [organizationId],
      { fallback: true }
    );
  }
}
