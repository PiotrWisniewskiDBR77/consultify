import { DRD_STRUCTURE } from '../../data/drdStructure.js';
import * as DbPromise from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import { fireClosureHandoff } from '../executionResultsBridge.js';
import { organizationContextService } from '../organizationContext/OrganizationContextService.js';
import {
  ATELIER_CANONICAL_DISCOUNT_RATE_PCT,
  ATELIER_CANONICAL_MODEL_NAME_EN,
  ATELIER_CANONICAL_MODEL_NAME_PL,
  ATELIER_FINANCE_CURRENCY,
  type AtelierFinanceGoldenFlowCompleteness,
  type AtelierFinanceSeedResult,
  upsertAtelierFinanceGoldenFlow,
  verifyAtelierFinanceGoldenFlowComplete,
} from './atelierFinanceSeed.js';
import {
  type DemoLeaderTemplate,
  getAtelierToysDeliverables,
  getAtelierToysDemoScenarios,
  getAtelierToysInitiatives,
  getAtelierToysInsights,
  getAtelierToysInterviews,
  getAtelierToysKnowledgeDocs,
  getAtelierToysLeadership,
  getAtelierToysProjects,
  getAtelierToysPrompts,
  getAtelierToysReports,
  getAtelierToysResultsKpis,
  getAtelierToysRolloutArtifacts,
  getAtelierToysToolCoverage,
} from './atelierToysDemoTemplate.js';
import { type DemoLocale, normalizeDemoLocale } from './demoLocale.js';
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
  /**
   * FIN-005 — explicit outcome of the Finance golden flow. Never swallowed: an
   * `incomplete` here means Finance rows exist but NOTHING was promoted to
   * READY, and `reason` / `missing` say exactly why.
   *
   * NOTE: `financeGoldenFlow.status === 'complete'` certifies ONLY the
   * statement/analysis leg — see `financeGoldenFlowCompleteness` below for
   * whether the model's NPV/IRR/payback are actually computable.
   */
  financeGoldenFlow: AtelierFinanceSeedResult;
  /**
   * FIN-005 round 8 — the claim `financeGoldenFlow.status` does NOT make:
   * whether a user can open the canonical model and get a real, computed
   * NPV/IRR/payback. See `verifyAtelierFinanceGoldenFlowComplete` in
   * `atelierFinanceSeed.ts` for what is actually checked.
   */
  financeGoldenFlowCompleteness: AtelierFinanceGoldenFlowCompleteness;
}

type UserMap = Record<string, { id: string; email: string }>;
type ProjectMap = Record<string, string>;
type InitiativeMap = Record<string, string>;

function makeId(orgId: string, entity: string, slug: string): string {
  return `${orgId}--${entity}--${slug}`;
}

/**
 * Canonical initiative statuses accepted by the DB `initiatives_status_check`
 * constraint (uppercase). The template mixes a couple of legacy lowercase
 * values (`in_progress`, `planned`) with the canonical set; normalize them here
 * so the seed converges any tenant — including prod demo — without tripping the
 * check constraint. Unknown values fall back to a safe canonical status.
 */
const CANONICAL_INITIATIVE_STATUSES = new Set([
  'DRAFT',
  'PENDING_REVIEW',
  'REVIEW',
  'PROMOTED',
  'PLANNING',
  'APPROVED',
  'SCHEDULED',
  'EXECUTING',
  'BLOCKED',
  'DONE',
  'TRACKING',
  'CANCELLED',
  'ARCHIVED',
]);

const LEGACY_INITIATIVE_STATUS_MAP: Record<string, string> = {
  IN_PROGRESS: 'EXECUTING',
  PLANNED: 'PLANNING',
  ACTIVE: 'EXECUTING',
  COMPLETED: 'DONE',
  ON_HOLD: 'BLOCKED',
};

function normalizeInitiativeStatus(status: string | null | undefined): string {
  const upper = String(status || '')
    .trim()
    .toUpperCase();
  if (CANONICAL_INITIATIVE_STATUSES.has(upper)) return upper;
  if (LEGACY_INITIATIVE_STATUS_MAP[upper]) return LEGACY_INITIATIVE_STATUS_MAP[upper];
  return 'EXECUTING';
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

/**
 * Seed the ORGANIZATION CONTEXT for the canonical Atelier Toys demo org.
 *
 * This is the demo backbone that makes Teresa context-aware: it records
 * profile / strategic-goals / operations claims from the Atelier Toys identity
 * (edtech/STEM manufacturer, Lyon, est. 1948, "Ateliertoy Forward" 2015
 * transformation) and rebuilds the resolved context snapshot.
 *
 * Idempotent: recordContextSource appends an authoritative system source each
 * run, and rebuildSnapshot recomputes the snapshot from current claims.
 */
async function upsertOrganizationContext(organizationId: string): Promise<void> {
  try {
    await organizationContextService.recordContextSource({
      organizationId,
      sourceType: 'demo_seed',
      sourceId: makeId(organizationId, 'context', 'atelier-toys'),
      channel: 'system',
      sourceLabel: 'Atelier Toys canonical demo context',
      isExplicit: true,
      // Skip the per-call rebuild; we rebuild once after all claims are recorded.
      rebuildSnapshot: false,
      content: {
        summary:
          'Atelier Toys canonical demo organization context — edtech / STEM manufacturer headquartered in Lyon, France, founded 1948. "Ateliertoy Forward" (2015) transformed it from a pure product company into an edtech platform with physical roots.',
        story: 'Ateliertoy Forward',
      },
      claims: [
        { claimPath: 'profile.companyName', value: 'Atelier Toys' },
        {
          claimPath: 'profile.description',
          value:
            'EdTech / STEM learning-tools manufacturer founded in 1948 in Lyon, France. Atelier Toys designs and produces hands-on STEM kits (Atelier Core, Atelier Motion) and a digital learning platform (Atelier Digital), serving 1.2M+ subscribers across 4,000+ institutions in 45 countries. The 2015 "Ateliertoy Forward" programme shifted the company from a pure product manufacturer into an edtech platform with physical roots.',
        },
        { claimPath: 'profile.industry', value: 'EdTech Manufacturing (STEM learning tools)' },
        {
          claimPath: 'profile.industrySubsector',
          value: 'STEM educational hardware & digital learning',
        },
        { claimPath: 'profile.organizationType', value: 'Manufacturer / EdTech platform' },
        {
          claimPath: 'profile.revenueModel',
          value: 'Hardware sales + recurring digital subscriptions',
        },
        { claimPath: 'profile.location', value: 'Lyon, France' },
        { claimPath: 'profile.foundingYear', value: 1948 },
        { claimPath: 'profile.companySize', value: '1,200 employees' },
        { claimPath: 'profile.employeeCount', value: 1200 },
        { claimPath: 'profile.annualRevenue', value: '~€280M (demo anchor year)' },
        { claimPath: 'profile.currency', value: 'EUR' },
        { claimPath: 'profile.defaultLanguage', value: 'fr' },
        { claimPath: 'profile.website', value: 'ateliertoys.com' },
        {
          claimPath: 'strategic.mission',
          value:
            'Make hands-on STEM learning accessible everywhere by combining trusted physical learning tools with a modern digital platform.',
        },
        {
          claimPath: 'strategic.vision',
          value:
            'Become the leading edtech platform with physical roots — the "Ateliertoy Forward" horizon of subscription-scale digital products built on a 75-year manufacturing heritage.',
        },
        { claimPath: 'strategic.growthStage', value: 'Scale-up (digital subscription expansion)' },
        {
          claimPath: 'strategic.competitivePosition',
          value: 'Established global STEM manufacturer transforming into an edtech platform',
        },
        {
          claimPath: 'strategic.goals',
          value: [
            'Reach €10M Digital ARR by 2026-Q2',
            'Achieve OEE 85%+ on core production lines by 2025-Q4',
            'Scale Atelier Digital subscriptions beyond 1.2M subscribers and 4,000+ institutions',
            'Close ISO 14001 packaging-waste gap (target -20%)',
          ],
        },
        {
          claimPath: 'strategic.priorities',
          value: [
            'Ateliertoy Forward wave 3: go-to-market and subscription scale (2023+)',
            'ERP migration and digital product buildout',
            'Operational excellence and OEE recovery on bottleneck lines',
            'Reduce APAC subscriber churn (currently 4.1%, target <3%)',
          ],
        },
        {
          claimPath: 'operations.keyMetrics',
          value: [
            { name: 'Subscribers', value: '1.2M+ end-users' },
            { name: 'Institutions served', value: '4,000+' },
            { name: 'Countries', value: '45' },
            { name: 'Founded', value: '1948' },
            { name: 'Digital ARR', value: '~€6.2M (target €8M)' },
            { name: 'OEE (Line 4)', value: '74% (target 82%)' },
          ],
        },
        {
          claimPath: 'operations.constraints',
          value: [
            'Legacy ERP integration limiting digital product velocity',
            'OEE below target on bottleneck Line 4',
            'Raw-material and supplier lead-time volatility',
            'APAC subscription churn above target',
          ],
        },
        {
          claimPath: 'operations.productionArchetype',
          value: 'Discrete manufacturing of STEM learning kits + digital platform delivery',
        },
        {
          claimPath: 'metadata.custom',
          value: [
            { key: 'certifications', value: 'ISO 9001, ISO 14001' },
            { key: 'products', value: 'Atelier Core, Atelier Motion, Atelier Digital' },
            {
              key: 'transformationStory',
              value:
                'Ateliertoy Forward (2015): wave 1 (2015-2018) operational excellence; wave 2 (2019-2022) digital product buildout; wave 3 (2023+) go-to-market and subscription scale.',
            },
          ],
        },
      ],
    });

    await organizationContextService.rebuildSnapshot(organizationId);
  } catch (error) {
    // Non-fatal: context seeding should not block the rest of the demo dataset.
    // eslint-disable-next-line no-console
    console.warn('[demoSeedService] Failed to seed Atelier Toys organization context', error);
  }
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
  const hasBudgetCurrency = await columnExists('initiatives', 'budget_currency');
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
      normalizeInitiativeStatus(initiative.status),
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
    if (hasBudgetCurrency) {
      // FIN-006/A O1: seed used to leave this column unset, so it silently
      // inherited the schema DEFAULT 'PLN' (migrations/564:139) while Finance
      // (FIN-005) reports the same Atelier program in EUR. Source the value
      // from the SAME constant Finance already uses so the two modules can
      // never drift onto two different literals again.
      cols.push('budget_currency');
      vals.push(ATELIER_FINANCE_CURRENCY);
    }

    // USPOJNIENIE A3: ŚWIADOMY WYJĄTEK od „jeden lejek". Seed demo jest
    // idempotentny (deterministyczne id via makeId + ON CONFLICT DO UPDATE) —
    // przejście przez createInitiativeService (świeże UUID, brak upsertu)
    // złamałoby re-seedowalność. Statusy pochodzą z definicji seedu i są
    // kanoniczne (zgodne z initiatives_status_check). NIE jest to ścieżka
    // tworzenia przez użytkownika.
    await DbPromise.run(
      `INSERT INTO initiatives (${cols.join(', ')})
       VALUES (${cols.map(() => '?').join(', ')})
       ON CONFLICT(id) DO UPDATE SET name=excluded.name, status=excluded.status${
         hasBudgetCurrency ? ', budget_currency=excluded.budget_currency' : ''
       }`,
      vals,
      { fallback: false }
    );

    // G1 fix (2026-07-10): seed initiatives can be created ALREADY in DONE
    // status (see the "USPOJNIENIE A3" exception above) — they never pass
    // through the status-transition endpoint, so the M14→M15 closure handoff
    // never used to fire for them. That was the majority root cause of the
    // Faza-0 finding (45/46 DONE initiatives with no initiative_benefits row):
    // nearly all of them were seed-created trial/demo initiatives, not live
    // transitions. Fire the same choke-point handoff here so every fresh seed
    // and every re-seed (ON CONFLICT DO UPDATE above is idempotent) lands a
    // benefit row too. Fire-and-forget + idempotent internally — safe to call
    // on every upsert, never blocks seeding.
    if (normalizeInitiativeStatus(initiative.status) === 'DONE') {
      fireClosureHandoff(organizationId, initiativeId, null);
    }

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
      // schema_version is an INTEGER column; the string 'v1' tripped
      // `invalid input syntax for type integer` and dropped every idea map.
      mapVals.push(1);
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

  // CONTRACT NOTE (finding O1 W7): `assessment_reports.axis_data` must hold DRD
  // maturity LEVELS (0..axis.levelCount — 5 or 7), never 0-100 percentages — the
  // report renderer divides by axis.levelCount to compute a percent, so a stray
  // percentage here would render as e.g. "Cybersecurity 600%" in a client
  // report. `scoreSummary` below is 0-5 scale already (safe), but it is keyed by
  // `overall`/`topStrengths`/`topGaps`, NOT by per-axis id/name, so it does not
  // populate the per-axis DRD report table (see `areaScoresFromAxisData` in
  // `server/src/services/report/drdReportService.ts`) — tracked separately, not
  // an out-of-range value.
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

/**
 * Seeds the Atelier Toys "Transformation 2015 ROI" business-case financial model.
 *
 * This makes the Finance → Models tab non-empty on first demo load and tells the
 * board-ready ROI story (NPV / ROI / payback) for the 3-year digitization program.
 * The model is linked to the `line-3-digital-twin` initiative so it becomes the
 * business-case source for the spine (Initiatives / Results) handoff.
 *
 * Gated to the demo dataset seed only; never runs for real organizations.
 */
async function upsertAtelierRoiFinancialModel(
  organizationId: string,
  userMap: UserMap,
  projectMap: Record<string, string>,
  initiativeMap: InitiativeMap,
  locale: DemoLocale,
  /**
   * FIN-005: id of the canonical FY2014 statement pack (see
   * `atelierFinanceSeed.ts`). Binding it to `source_statement_pack_id` is what
   * makes the model *grounded* — the demo run-sheet claims the ROI rests on "a
   * confirmed FY2014 P&L", and before this the model had no source at all.
   */
  sourceStatementPackId: string | null
): Promise<void> {
  if (!(await tableExists('financial_models'))) return;

  const isPl = locale === 'pl';
  const modelId = makeId(organizationId, 'financial-model', 'transformation-2015-roi');
  const createdBy = userMap['hugo-bernard']?.id || userMap['antoine-laurent']?.id || null;
  const projectId = projectMap['forward-pmo'] || null;
  const initiativeId = initiativeMap['line-3-digital-twin'] || null;

  const modelName = isPl ? ATELIER_CANONICAL_MODEL_NAME_PL : ATELIER_CANONICAL_MODEL_NAME_EN;
  const modelDescription = isPl
    ? 'Business case zarządu dla 3-letniego programu cyfryzacji: NPV, ROI i okres zwrotu.'
    : 'Board business case for the 3-year digitization program: NPV, ROI, and payback.';

  const hasModelInitiativeCol = await columnExists('financial_models', 'initiative_id');
  const modelCols = [
    'id',
    'organization_id',
    'project_id',
    'name',
    'description',
    'currency',
    'horizon_months',
    'start_date',
    'granularity',
    'scenario',
    'status',
    'created_by',
  ];
  const modelVals: Array<string | number | null> = [
    modelId,
    organizationId,
    projectId,
    modelName,
    modelDescription,
    // FIN-005: was 'PLN' — the app-wide default currency, not a choice. Every
    // other Atelier number is euro-denominated (Digital ARR EUR 6.2M -> 8M,
    // initiative budgets, the FY2014 statements this model is now grounded on),
    // so the Finance golden flow is standardised on EUR. Economics unchanged.
    ATELIER_FINANCE_CURRENCY,
    36,
    '2015-01-01',
    'annual',
    'base',
    'approved',
    createdBy,
  ];
  if (hasModelInitiativeCol) {
    modelCols.push('initiative_id');
    modelVals.push(initiativeId);
  }
  const hasModelSourcePackCol =
    Boolean(sourceStatementPackId) &&
    (await columnExists('financial_models', 'source_statement_pack_id'));
  if (hasModelSourcePackCol) {
    modelCols.push('source_statement_pack_id');
    modelVals.push(sourceStatementPackId);
  }

  /**
   * FIN-005 round 9 — Piotr's two explicit, final decisions on the ROI story:
   *
   * 1. "Nie wymyślaj opóźnienia wdrożenia. Jeżeli źródłowe dane nie zawierają
   *    harmonogramu uruchomienia CAPEX, przychodów i oszczędności, oznacz tę
   *    informację jako brakujące jawne założenie. Nie dodawaj arbitralnego
   *    przesunięcia." The three canonical events (`digital-capex` and
   *    `revenue-uplift` both `period_start: '2015-01-01'`, `opex-reduction`
   *    `period_start: '2016-01-01'`) stay EXACTLY as dated — no ramp-up is
   *    invented here, and none should ever be added by changing a
   *    `period_start`. What source data does not say is recorded as an
   *    explicit missing assumption instead, so the gap is visible to whoever
   *    reads `assumptions_json` rather than silently smoothed over.
   * 2. The discount/hurdle rate stops being a bare TypeScript constant
   *    (`ATELIER_CANONICAL_DISCOUNT_RATE_PCT`, only in source) and becomes
   *    DATA — written into the model's own `assumptions_json` so it is
   *    "jawna, odczytywalna i testowana" (explicit, readable, tested). The
   *    constant still SEEDS this value; `assumptions_json` is now the
   *    canonical RUNTIME source `verifyAtelierFinanceGoldenFlowComplete`
   *    reads back (see atelierFinanceSeed.ts).
   */
  const hasModelAssumptionsCol = await columnExists('financial_models', 'assumptions_json');
  if (hasModelAssumptionsCol) {
    modelCols.push('assumptions_json');
    modelVals.push(
      JSON.stringify({
        implementationLagMonths: null,
        implementationLagAssumptionStatus: 'NEEDS_PRODUCT_DECISION',
        implementationLagAssumptionNote: isPl
          ? 'Źródłowe dane nie zawierają harmonogramu wdrożenia (opóźnienia) między CAPEX a realizacją przychodów/oszczędności — zdarzenia modelowane dokładnie wg zaseedowanych dat, bez zakładanego przesunięcia.'
          : 'Source data does not specify a ramp-up schedule between CAPEX and revenue/savings realization — events are modeled exactly as dated, with no assumed delay.',
        discountRatePct: ATELIER_CANONICAL_DISCOUNT_RATE_PCT,
        hurdleRatePct: ATELIER_CANONICAL_DISCOUNT_RATE_PCT,
      })
    );
  }

  await DbPromise.run(
    `INSERT INTO financial_models (${modelCols.join(', ')})
     VALUES (${modelCols.map(() => '?').join(', ')})
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name,
       description=excluded.description,
       currency=excluded.currency,
       status=excluded.status,
       horizon_months=excluded.horizon_months${
         hasModelSourcePackCol
           ? ',\n       source_statement_pack_id=excluded.source_statement_pack_id'
           : ''
       }${hasModelAssumptionsCol ? ',\n       assumptions_json=excluded.assumptions_json' : ''}`,
    modelVals,
    { fallback: false }
  );

  // Three economic events drive the business case (revenue uplift, capex, opex reduction).
  //
  // FIN-005 round 9 — Piotr's product decision: "OpEx reduction" IS a genuine
  // benefit, not a cost. `opex-reduction` below carries `amount: -400_000` on
  // purpose. The compute engine (`financialModelingService.ts`,
  // `expandEventToAmounts`/`applyEventToPeriod`) respects an `event_type:
  // 'opex'` event's stored sign — a negative amount REDUCES modeled opex (a
  // saving), a positive amount adds to it (a cost), matching the event's own
  // name and the parallel `analysis_financials.annual_cost_savings = 400_000`
  // row below. Do not `Math.abs()` this value and do not flip its sign: the
  // stored `-400_000` is what "reduction" means here.
  const events: Array<{
    slug: string;
    type: string;
    nameEn: string;
    namePl: string;
    amount: number;
    periodStart: string;
    recurrence: string;
    growthRate: number;
    cfClass: string;
    sortOrder: number;
  }> = [
    {
      slug: 'revenue-uplift',
      type: 'revenue',
      nameEn: 'Revenue uplift (digitized lines)',
      namePl: 'Wzrost przychodów (zdigitalizowane linie)',
      amount: 2_400_000,
      periodStart: '2015-01-01',
      recurrence: 'annual',
      growthRate: 0.08,
      cfClass: 'operating',
      sortOrder: 1,
    },
    {
      slug: 'digital-capex',
      type: 'capex_purchase',
      nameEn: 'Digital transformation capex',
      namePl: 'Capex transformacji cyfrowej',
      amount: 800_000,
      periodStart: '2015-01-01',
      recurrence: 'one_time',
      growthRate: 0,
      cfClass: 'investing',
      sortOrder: 2,
    },
    {
      slug: 'opex-reduction',
      type: 'opex',
      nameEn: 'OpEx reduction (automation)',
      namePl: 'Redukcja OpEx (automatyzacja)',
      amount: -400_000,
      periodStart: '2016-01-01',
      recurrence: 'annual',
      growthRate: 0,
      cfClass: 'operating',
      sortOrder: 3,
    },
  ];

  if (await tableExists('financial_model_events')) {
    for (const event of events) {
      const eventId = makeId(organizationId, 'financial-model-event', event.slug);
      await DbPromise.run(
        `INSERT INTO financial_model_events (
           id, model_id, event_type, name, amount, currency, period_start,
           recurrence, growth_rate, cf_classification, posting_rules, sort_order, is_active, created_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name=excluded.name,
           amount=excluded.amount,
           currency=excluded.currency,
           is_active=excluded.is_active`,
        [
          eventId,
          modelId,
          event.type,
          isPl ? event.namePl : event.nameEn,
          event.amount,
          ATELIER_FINANCE_CURRENCY,
          event.periodStart,
          event.recurrence,
          event.growthRate,
          event.cfClass,
          '{}',
          event.sortOrder,
          true,
          createdBy,
        ],
        { fallback: true }
      );
    }
  }

  // Link the model's business-case ROI to the initiative via the economics analysis
  // tables, so the spine (Initiatives / Results) surfaces NPV / ROI / payback.
  if (
    initiativeId &&
    (await tableExists('digitization_analyses')) &&
    (await tableExists('analysis_financials'))
  ) {
    const analysisId = makeId(organizationId, 'analysis', 'transformation-2015-roi');
    const hasAnalysisType = await columnExists('digitization_analyses', 'analysis_type');
    const analysisCols = [
      'id',
      'name',
      'description',
      'status',
      'project_id',
      'initiative_id',
      'organization_id',
      'created_by',
    ];
    const analysisVals: Array<string | number | null> = [
      analysisId,
      modelName,
      modelDescription,
      'completed',
      projectId,
      initiativeId,
      organizationId,
      createdBy,
    ];
    if (hasAnalysisType) {
      analysisCols.push('analysis_type');
      analysisVals.push('financial');
    }
    await DbPromise.run(
      `INSERT INTO digitization_analyses (${analysisCols.join(', ')})
       VALUES (${analysisCols.map(() => '?').join(', ')})
       ON CONFLICT(id) DO UPDATE SET name=excluded.name, status=excluded.status, initiative_id=excluded.initiative_id`,
      analysisVals,
      { fallback: true }
    );

    await DbPromise.run(
      `INSERT INTO analysis_financials (
         id, analysis_id, initiative_id, organization_id,
         initial_investment, annual_operating_cost, annual_cost_savings, annual_revenue_increase,
         implementation_months, analysis_horizon_years, discount_rate,
         npv, irr, payback_months, roi_percent, currency, last_calculated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(analysis_id) DO UPDATE SET
         npv=excluded.npv,
         irr=excluded.irr,
         payback_months=excluded.payback_months,
         roi_percent=excluded.roi_percent,
         currency=excluded.currency,
         last_calculated_at=excluded.last_calculated_at`,
      [
        makeId(organizationId, 'analysis-financials', 'transformation-2015-roi'),
        analysisId,
        initiativeId,
        organizationId,
        800_000,
        0,
        400_000,
        2_400_000,
        12,
        3,
        10,
        1_820_000,
        34,
        14,
        218,
        ATELIER_FINANCE_CURRENCY,
        new Date().toISOString(),
      ],
      { fallback: true }
    );
  }
}

/**
 * Seed the Interviews + Insights spine stage (03).
 *
 * Records five discovery interview sessions and one cross-interview insight,
 * then materializes the insight's findings and the handoffs that link each
 * finding to a flagship initiative. This is the real insight -> initiative
 * link that lets the spine flow Discovery -> Portfolio.
 *
 * Returns the insight ids and the finding -> initiative slug handoff map so the
 * caller can prove cross-module linkage downstream.
 */
async function upsertAtelierInterviewsAndInsights(
  organizationId: string,
  userMap: UserMap,
  projectMap: ProjectMap,
  initiativeMap: InitiativeMap,
  anchorDate: Date
): Promise<{ interviewCount: number; insightCount: number; handoffCount: number }> {
  let interviewCount = 0;
  let insightCount = 0;
  let handoffCount = 0;

  const interviews = getAtelierToysInterviews();
  const interviewIdBySlug: Record<string, string> = {};

  // ---- Interview sessions (03) ----
  if (await tableExists('interview_sessions')) {
    const cols = await getTableColumns('interview_sessions');
    const projectId = projectMap['forward-pmo'] || null;
    for (const interview of interviews) {
      const sessionId = makeId(organizationId, 'interview', interview.slug);
      interviewIdBySlug[interview.slug] = sessionId;
      const ownerId = userMap[interview.owner]?.id || userMap['antoine-laurent']?.id || null;
      const startedAt = new Date(
        anchorDate.getTime() - interview.startedDaysAgo * 24 * 60 * 60 * 1000
      ).toISOString();

      const insertCols: string[] = ['id', 'organization_id', 'owner_id', 'status'];
      const vals: Array<string | number | null> = [sessionId, organizationId, ownerId, 'completed'];
      const push = (col: string, value: string | number | null) => {
        if (cols.has(col)) {
          insertCols.push(col);
          vals.push(value);
        }
      };
      push('project_id', projectId);
      push('name', interview.name);
      push('progress_json', JSON.stringify(interview.progress));
      push('total_questions', interview.totalQuestions);
      push('answered_questions', interview.answeredQuestions);
      push('summary_facts', JSON.stringify(interview.facts));
      push('summary_pain_points', JSON.stringify(interview.painPoints));
      push('summary_gaps', JSON.stringify(interview.gaps));
      push('started_at', startedAt);
      push('completed_at', startedAt);
      push('last_activity_at', startedAt);

      await DbPromise.run(
        `INSERT INTO interview_sessions (${insertCols.join(', ')})
         VALUES (${insertCols.map(() => '?').join(', ')})
         ON CONFLICT(id) DO UPDATE SET status=excluded.status`,
        vals,
        { fallback: true }
      );
      interviewCount += 1;
    }
  }

  // ---- Cross-interview insights (03) + findings + handoffs ----
  if (await tableExists('interview_insights')) {
    const insights = getAtelierToysInsights();
    const hasFindings = await tableExists('interview_insight_findings');
    const hasHandoffs = await tableExists('interview_insight_handoffs');

    for (const insight of insights) {
      const insightId = makeId(organizationId, 'insight', insight.slug);
      const createdBy = userMap[insight.createdBy]?.id || userMap['antoine-laurent']?.id || null;
      const sourceSessionIds = insight.sourceInterviews
        .map((slug) => interviewIdBySlug[slug])
        .filter(Boolean);

      await DbPromise.run(
        `INSERT INTO interview_insights (
           id, organization_id, title, prompt_type, source_session_ids,
           content, status, source_session_count, created_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET title=excluded.title, status=excluded.status`,
        [
          insightId,
          organizationId,
          insight.title,
          insight.promptType,
          JSON.stringify(sourceSessionIds),
          insight.content,
          'completed',
          sourceSessionIds.length,
          createdBy,
        ],
        { fallback: true }
      );
      insightCount += 1;

      for (const finding of insight.findings) {
        const findingId = makeId(organizationId, 'insight-finding', finding.slug);
        const targetInitiativeId = initiativeMap[finding.handoffInitiative] || null;

        if (hasFindings) {
          await DbPromise.run(
            `INSERT INTO interview_insight_findings (
               id, organization_id, insight_id, source_section_type, source_key,
               finding_statement, confidence_level, limits_text, next_action_text,
               review_status, created_by, updated_by
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               finding_statement=excluded.finding_statement,
               review_status=excluded.review_status`,
            [
              findingId,
              organizationId,
              insightId,
              'manual',
              finding.slug,
              finding.findingStatement,
              finding.confidence,
              finding.limits,
              finding.nextAction,
              'approved',
              createdBy,
              createdBy,
            ],
            { fallback: true }
          );
        }

        // The real insight -> initiative link.
        if (hasHandoffs && targetInitiativeId) {
          await DbPromise.run(
            `INSERT INTO interview_insight_handoffs (
               id, organization_id, insight_id, finding_id, target_kind, target_id,
               target_ref_type, status, payload_json, created_by
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET status=excluded.status, target_id=excluded.target_id`,
            [
              makeId(organizationId, 'insight-handoff', finding.slug),
              organizationId,
              insightId,
              findingId,
              'initiative',
              targetInitiativeId,
              'initiative_link',
              'accepted',
              JSON.stringify({
                findingStatement: finding.findingStatement,
                nextAction: finding.nextAction,
                initiativeSlug: finding.handoffInitiative,
              }),
              createdBy,
            ],
            { fallback: true }
          );
          handoffCount += 1;
        }
      }
    }
  }

  return { interviewCount, insightCount, handoffCount };
}

/**
 * Seed the Results / KPIs spine stage (07).
 *
 * Each KPI is tracked under a project and attributed (via name + historical
 * series) to a flagship initiative, and the realized numbers (OEE 74->80,
 * lead-time variance 6->3, ARR 6.2->7.4) reconcile with the org-context
 * metrics and the financial-model business case.
 */
async function upsertAtelierResultsKpis(
  organizationId: string,
  userMap: UserMap,
  projectMap: ProjectMap
): Promise<number> {
  if (!(await tableExists('project_kpis'))) return 0;
  const cols = await getTableColumns('project_kpis');
  const hasOrg = cols.has('organization_id');
  const hasInitiative = cols.has('initiative_id');
  let count = 0;

  for (const kpi of getAtelierToysResultsKpis()) {
    const projectId = projectMap[kpi.projectSlug];
    if (!projectId) continue;
    const kpiId = makeId(organizationId, 'result-kpi', kpi.slug);

    const insertCols: string[] = ['id', 'project_id', 'name', 'category'];
    const vals: Array<string | number | null> = [kpiId, projectId, kpi.name, kpi.category];
    const push = (col: string, value: string | number | null) => {
      if (cols.has(col)) {
        insertCols.push(col);
        vals.push(value);
      }
    };
    if (hasOrg) push('organization_id', organizationId);
    if (hasInitiative)
      push('initiative_id', initiativeIdForKpi(organizationId, kpi.initiativeSlug));
    push('description', kpi.description);
    push('target_value', kpi.targetValue);
    push('current_value', kpi.currentValue);
    push('baseline_value', kpi.baselineValue);
    push('unit', kpi.unit);
    push('threshold_direction', kpi.thresholdDirection);
    push('historical_values', JSON.stringify(kpi.historical));
    push('trend', kpi.trend);
    push('owner_id', userMap[kpi.owner]?.id || null);
    push('status', 'ACTIVE');

    await DbPromise.run(
      `INSERT INTO project_kpis (${insertCols.join(', ')})
       VALUES (${insertCols.map(() => '?').join(', ')})
       ON CONFLICT(id) DO UPDATE SET
         current_value=excluded.current_value,
         trend=excluded.trend`,
      vals,
      { fallback: true }
    );
    count += 1;
  }
  return count;
}

function initiativeIdForKpi(_organizationId: string, _initiativeSlug: string): string | null {
  // project_kpis rarely carries an initiative_id column; this keeps the optional
  // column populated when present without breaking schemas that lack it.
  return null;
}

/**
 * Seed the Execution / Rollout spine stage (06): rollout KPIs, risks, changes,
 * and closure items, all tied to the projects that carry the flagship
 * initiatives. Tables are guarded so missing schemas are skipped cleanly.
 */
async function upsertAtelierRolloutArtifacts(
  organizationId: string,
  userMap: UserMap,
  projectMap: ProjectMap
): Promise<number> {
  let count = 0;
  const { kpis, risks, changes, closures } = getAtelierToysRolloutArtifacts();
  const now = new Date().toISOString();

  if (await tableExists('rollout_kpis')) {
    for (const kpi of kpis) {
      const projectId = projectMap[kpi.projectSlug] || null;
      await DbPromise.run(
        `INSERT INTO rollout_kpis (
           id, organization_id, project_id, name, baseline, target, current_value, unit, created_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET current_value=excluded.current_value`,
        [
          makeId(organizationId, 'rollout-kpi', kpi.slug),
          organizationId,
          projectId,
          kpi.name,
          kpi.baseline,
          kpi.target,
          kpi.current,
          kpi.unit,
          userMap[kpi.createdBy]?.id || null,
        ],
        { fallback: true }
      );
      count += 1;
    }
  }

  if (await tableExists('rollout_risks')) {
    for (const risk of risks) {
      await DbPromise.run(
        `INSERT INTO rollout_risks (
           id, organization_id, project_id, title, probability, impact, mitigation, status, owner_id
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET status=excluded.status`,
        [
          makeId(organizationId, 'rollout-risk', risk.slug),
          organizationId,
          projectMap[risk.projectSlug] || null,
          risk.title,
          risk.probability,
          risk.impact,
          risk.mitigation,
          risk.status,
          userMap[risk.owner]?.id || null,
        ],
        { fallback: true }
      );
      count += 1;
    }
  }

  if (await tableExists('rollout_changes')) {
    for (const change of changes) {
      await DbPromise.run(
        `INSERT INTO rollout_changes (
           id, organization_id, project_id, title, type, status, impact, approved_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET status=excluded.status`,
        [
          makeId(organizationId, 'rollout-change', change.slug),
          organizationId,
          projectMap[change.projectSlug] || null,
          change.title,
          change.type,
          change.status,
          change.impact,
          userMap[change.approvedBy]?.id || null,
        ],
        { fallback: true }
      );
      count += 1;
    }
  }

  if (await tableExists('rollout_closures')) {
    for (const closure of closures) {
      const dueDate = new Date(Date.now() + closure.dueInDays * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      await DbPromise.run(
        `INSERT INTO rollout_closures (
           id, organization_id, project_id, title, category, status, due_date
         ) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET status=excluded.status`,
        [
          makeId(organizationId, 'rollout-closure', closure.slug),
          organizationId,
          projectMap[closure.projectSlug] || null,
          closure.title,
          closure.category,
          closure.status,
          dueDate,
        ],
        { fallback: true }
      );
      count += 1;
    }
  }

  void now;
  return count;
}

/**
 * Seed the Outputs / Deliverables spine stage (09): executive board readout
 * and value-realization report, each linked back to the flagship initiative
 * via source_initiative_id so the spine closes the loop Portfolio -> Outputs.
 */
async function upsertAtelierDeliverables(
  organizationId: string,
  userMap: UserMap,
  initiativeMap: InitiativeMap
): Promise<number> {
  if (!(await tableExists('v8_output_artifacts'))) return 0;
  const hasExports = await tableExists('v8_output_exports');
  const now = new Date().toISOString();
  let count = 0;

  for (const deliverable of getAtelierToysDeliverables()) {
    const artifactId = makeId(organizationId, 'output-artifact', deliverable.slug);
    const createdBy = userMap[deliverable.createdBy]?.id || userMap['antoine-laurent']?.id || null;
    const sourceInitiativeId = initiativeMap[deliverable.sourceInitiative] || null;

    await DbPromise.run(
      `INSERT INTO v8_output_artifacts (
         artifact_id, organization_id, output_type, delivery_state,
         template_family_ref, source_initiative_id, created_by, created_at, last_transition_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(artifact_id) DO UPDATE SET
         delivery_state=excluded.delivery_state,
         last_transition_at=excluded.last_transition_at`,
      [
        artifactId,
        organizationId,
        deliverable.outputType,
        deliverable.deliveryState,
        deliverable.templateFamily,
        sourceInitiativeId,
        createdBy,
        now,
        now,
      ],
      { fallback: true }
    );
    count += 1;

    if (hasExports) {
      await DbPromise.run(
        `INSERT INTO v8_output_exports (
           export_id, artifact_id, organization_id, format, requested_by, status, created_at, completed_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(export_id) DO UPDATE SET status=excluded.status`,
        [
          makeId(organizationId, 'output-export', deliverable.slug),
          artifactId,
          organizationId,
          deliverable.exportFormat,
          createdBy,
          'completed',
          now,
          now,
        ],
        { fallback: true }
      );
    }
  }

  return count;
}

export async function seedAtelierToysDemoDataset(
  input: SeedDemoDatasetInput
): Promise<SeedDemoDatasetResult> {
  const organizationId = input.organizationId;
  const anchorDate = getDemoAnchorDate(input.anchorDate);
  const locale = normalizeDemoLocale(input.locale);
  const leaders = getAtelierToysLeadership(locale);
  const projects = getAtelierToysProjects(locale);
  const initiatives = getAtelierToysInitiatives(locale);
  const scenarios = getAtelierToysDemoScenarios(locale);
  const toolCoverage = getAtelierToysToolCoverage(locale);

  await upsertOrg(organizationId);
  // Seed the organization CONTEXT so Teresa is context-aware in the demo.
  await upsertOrganizationContext(organizationId);
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
  // Spine stage 03: Interviews + Insights, with real insight -> initiative handoffs.
  await upsertAtelierInterviewsAndInsights(
    organizationId,
    userMap,
    projectMap,
    initiativeMap,
    anchorDate
  );
  // FIN-005 — Finance golden flow. The statement pack comes FIRST so the ROI
  // model can be bound to it: statement -> analysis -> model, one story, one
  // currency, one lineage. Before this the model existed with no source
  // statement and no analysis, and Finance showed another tenant's records.
  const financeGoldenFlow = await upsertAtelierFinanceGoldenFlow({
    organizationId,
    createdBy: userMap['claire-laurent']?.id || userMap['hugo-bernard']?.id || null,
    projectId: projectMap['forward-pmo'] || null,
    locale,
  });
  // FIN-005 P1: the Finance seed returns an explicit discriminated outcome.
  // A degraded Finance fixture (missing table/column, failed read-back, a
  // statement that production refused to call READY) must never be swallowed:
  // surface it in the log AND carry it in the seed result so the caller sees
  // that Finance is present but NOT ready.
  if (financeGoldenFlow.status !== 'complete') {
    logger.warn('[demo-seed] Atelier Finance golden flow is INCOMPLETE', {
      organizationId,
      reason: financeGoldenFlow.reason,
      missing: financeGoldenFlow.missing,
      packId: financeGoldenFlow.packId,
      promotedStatements: financeGoldenFlow.statementIds.length,
      unpromotedStatements: financeGoldenFlow.unpromotedStatementIds.length,
      analysisId: financeGoldenFlow.analysisId,
      // What the promotion phase actually did (FIN-005: promotion is atomic, so
      // this normally reads "0 issued"; a non-zero count means a promotion write
      // failed and was compensated — and any rollback error is in here too).
      promotion: financeGoldenFlow.promotion,
    });
  }
  await upsertAtelierRoiFinancialModel(
    organizationId,
    userMap,
    projectMap,
    initiativeMap,
    locale,
    financeGoldenFlow.packId
  );
  // FIN-005 round 8: `financeGoldenFlow.status === 'complete'` certifies ONLY
  // the statement/analysis leg (see the doc comment on
  // `verifyAtelierFinanceGoldenFlowComplete`). Whether the model actually
  // produces a real NPV/IRR/payback is a SEPARATE, explicitly-named claim —
  // computed here by actually invoking the canonical compute + appraisal
  // engines, never inferred from the fixture existing.
  const financeGoldenFlowCompleteness = await verifyAtelierFinanceGoldenFlowComplete(
    organizationId,
    financeGoldenFlow.status
  );
  if (!financeGoldenFlowCompleteness.goldenFlowComplete) {
    logger.warn(
      '[demo-seed] Atelier Finance golden flow fixture is complete but NOT compute-complete',
      {
        organizationId,
        fixtureComplete: financeGoldenFlowCompleteness.fixtureComplete,
        reason: financeGoldenFlowCompleteness.reason,
      }
    );
  }
  // Spine stage 07: Results / KPIs (realized numbers reconcile with ROI + context).
  await upsertAtelierResultsKpis(organizationId, userMap, projectMap);
  // Spine stage 06: Execution / Rollout artifacts.
  await upsertAtelierRolloutArtifacts(organizationId, userMap, projectMap);
  // Spine stage 09: Outputs / Deliverables linked back to the flagship initiative.
  await upsertAtelierDeliverables(organizationId, userMap, initiativeMap);
  await upsertNotifications(organizationId, userMap, locale);
  await upsertActivityLogs(organizationId, userMap, locale);

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
    financeGoldenFlow,
    financeGoldenFlowCompleteness,
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

export async function deleteDemoDatasetForOrganization(organizationId: string): Promise<void> {
  const deleteQueries = [
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
    ['financial_model_events', 'model_id', 'financial_models', 'organization_id'],
    ['financial_model_outputs', 'model_id', 'financial_models', 'organization_id'],
    ['financial_model_validations', 'model_id', 'financial_models', 'organization_id'],
    ['financial_models', 'organization_id'],
    ['analysis_financials', 'organization_id'],
    ['digitization_analyses', 'organization_id'],
    // FIN-005 Finance golden flow (statement pack -> analysis -> model). Listed
    // FK-first so a demo dataset delete stays complete: leaving these behind
    // would strand the exact rows the coherence gate checks for.
    ['financial_analyses', 'organization_id'],
    ['financial_statement_values', 'statement_id', 'financial_statements', 'organization_id'],
    ['financial_statement_ingest_runs', 'organization_id'],
    ['financial_statements', 'organization_id'],
    ['financial_statement_packs', 'organization_id'],
    // Spine: Interviews + Insights (03)
    ['interview_insight_handoffs', 'organization_id'],
    ['interview_insight_findings', 'organization_id'],
    ['interview_insights', 'organization_id'],
    ['interview_sessions', 'organization_id'],
    // Spine: Results / KPIs (07)
    ['project_kpis', 'project_id', 'projects', 'organization_id'],
    // Spine: Execution / Rollout (06)
    ['rollout_kpis', 'organization_id'],
    ['rollout_risks', 'organization_id'],
    ['rollout_changes', 'organization_id'],
    ['rollout_closures', 'organization_id'],
    // Spine: Outputs / Deliverables (09)
    ['v8_output_exports', 'organization_id'],
    ['v8_output_artifacts', 'organization_id'],
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
