import {
  atelierToysInitiativePL,
  atelierToysKnowledgeDocPL,
  atelierToysLeaderPL,
  atelierToysProjectPL,
  atelierToysPromptPL,
  atelierToysReportPL,
  atelierToysScenarioPL,
  atelierToysToolCoveragePL,
} from './atelierToysDemoLocalization.js';
import { type DemoLocale } from './demoLocale.js';
import type { RelativeDateSpec } from './demoRelativeDate.js';

export interface DemoLeaderTemplate {
  slug: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'MANAGER' | 'USER';
  title: string;
  department: string;
  focus: string;
}

export interface DemoTaskTemplate {
  slug: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  dueDate: RelativeDateSpec;
  assignee: string;
  why: string;
}

export interface DemoDecisionTemplate {
  slug: string;
  title: string;
  status: 'pending' | 'approved';
  decisionMaker: string;
  deadline: RelativeDateSpec;
  rationale: string;
}

export interface DemoMilestoneTemplate {
  slug: string;
  name: string;
  description: string;
  targetDate: RelativeDateSpec;
  status: 'DONE' | 'IN_PROGRESS' | 'PENDING';
  isGate?: boolean;
}

export interface DemoInitiativeTemplate {
  slug: string;
  projectSlug: string;
  name: string;
  area: string;
  summary: string;
  status: string;
  currentStage?: string;
  priority: 'low' | 'medium' | 'high';
  plannedStart: RelativeDateSpec;
  plannedEnd: RelativeDateSpec;
  ownerBusiness: string;
  ownerExecution: string;
  sponsor: string;
  expectedRoi: number;
  budgetCapex: number;
  budgetOpex: number;
  deliverables: string[];
  successCriteria: string[];
  keyRisks: string[];
  tasks: DemoTaskTemplate[];
  decisions: DemoDecisionTemplate[];
  milestones: DemoMilestoneTemplate[];
}

export interface DemoProjectTemplate {
  slug: string;
  name: string;
  description: string;
  status: string;
  goal: string;
  health: string;
  progressPct: number;
  owner: string;
}

export interface DemoStatusReportTemplate {
  slug: string;
  title: string;
  projectSlug: string;
  health: string;
  period: string;
  createdBy: string;
  createdAt: RelativeDateSpec;
  content: string;
}

export interface DemoKnowledgeDocTemplate {
  slug: string;
  title: string;
  category: string;
  body: string;
}

export interface DemoPromptTemplate {
  slug: string;
  name: string;
  context: string;
  template: string;
  createdBy: string;
}

export interface DemoToolCoverage {
  tool: string;
  seededRecords: string[];
  userGoal: string;
  ahaMoment: string;
  cta: string;
}

export interface DemoScenario {
  id: string;
  title: string;
  duration: string;
  audience: string;
  persona: string;
}

// ============================================================================
// SPINE TEMPLATES (X2 coherence) — Interviews → Insights → Findings →
// Handoffs(→initiative) → Results KPIs → Rollout → Deliverable.
// These stitch the Atelier "Ateliertoy Forward (2015)" transformation story
// end-to-end so the same IDs flow through every spine stage.
// ============================================================================

export interface DemoInterviewTemplate {
  slug: string;
  /** Stakeholder (leader slug) who was interviewed. */
  respondent: string;
  /** Consultant (leader slug) who owns the discovery session. */
  owner: string;
  name: string;
  /** Per-category completion percentage (strategy/operations/digital/people/finance). */
  progress: {
    strategy: number;
    operations: number;
    digital: number;
    people: number;
    finance: number;
  };
  totalQuestions: number;
  answeredQuestions: number;
  /** Most important verbatim facts captured (no recommendations). */
  facts: Array<{ category: string; fact: string }>;
  /** Pain points surfaced during discovery. */
  painPoints: Array<{ category: string; painPoint: string }>;
  /** Information gaps still open. */
  gaps: Array<{ category: string; gap: string }>;
  startedDaysAgo: number;
}

export interface DemoInsightFindingTemplate {
  slug: string;
  findingStatement: string;
  confidence: 'high' | 'moderate' | 'low' | 'insufficient';
  limits: string;
  nextAction: string;
  /** Initiative slug this finding hands off to (the insight→initiative link). */
  handoffInitiative: string;
}

export interface DemoInsightTemplate {
  slug: string;
  title: string;
  promptType: 'summary' | 'trends' | 'problems' | 'recommendations';
  /** Interview slugs analyzed to produce this insight. */
  sourceInterviews: string[];
  content: string;
  createdBy: string;
  findings: DemoInsightFindingTemplate[];
}

export interface DemoResultsKpiTemplate {
  slug: string;
  /** Project slug the KPI is tracked under. */
  projectSlug: string;
  /** Initiative slug this result is attributed to (Results→initiative link). */
  initiativeSlug: string;
  name: string;
  category: 'SCHEDULE' | 'BUDGET' | 'QUALITY' | 'SCOPE' | 'RISK' | 'RESOURCES' | 'CUSTOM';
  description: string;
  baselineValue: number;
  currentValue: number;
  targetValue: number;
  unit: string;
  trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
  thresholdDirection: 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER';
  owner: string;
  historical: Array<{ date: string; value: number }>;
}

export interface DemoRolloutKpiTemplate {
  slug: string;
  projectSlug: string;
  name: string;
  baseline: number;
  target: number;
  current: number;
  unit: string;
  createdBy: string;
}

export interface DemoRolloutRiskTemplate {
  slug: string;
  projectSlug: string;
  title: string;
  probability: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  mitigation: string;
  status: string;
  owner: string;
}

export interface DemoRolloutChangeTemplate {
  slug: string;
  projectSlug: string;
  title: string;
  type: string;
  status: string;
  impact: string;
  approvedBy: string;
}

export interface DemoRolloutClosureTemplate {
  slug: string;
  projectSlug: string;
  title: string;
  category: string;
  status: string;
  dueInDays: number;
}

export interface DemoDeliverableTemplate {
  slug: string;
  outputType: 'report' | 'presentation';
  deliveryState: 'draft' | 'generated' | 'editing' | 'in_review' | 'ready' | 'shared' | 'archived';
  templateFamily: string;
  /** Initiative slug this deliverable presents (Deliverable→initiative link). */
  sourceInitiative: string;
  createdBy: string;
  /** Export format produced for the deliverable. */
  exportFormat: string;
}

export const atelierToysLeadership: DemoLeaderTemplate[] = [
  {
    slug: 'antoine-laurent',
    firstName: 'Antoine',
    lastName: 'Laurent',
    role: 'ADMIN',
    title: 'CEO',
    department: 'Executive',
    focus: 'Scale Atelier Forward into a predictable operating system.',
  },
  {
    slug: 'claire-laurent',
    firstName: 'Claire',
    lastName: 'Laurent',
    role: 'ADMIN',
    title: 'CFO & Head of People',
    department: 'Finance',
    focus: 'Protect margin while funding SaaS and people capability growth.',
  },
  {
    slug: 'julien-moreau',
    firstName: 'Julien',
    lastName: 'Moreau',
    role: 'ADMIN',
    title: 'CTO',
    department: 'Technology',
    focus: 'Turn IRIS and Digital Twin into productized capabilities.',
  },
  {
    slug: 'marc-dubois',
    firstName: 'Marc',
    lastName: 'Dubois',
    role: 'MANAGER',
    title: 'Plant Manager',
    department: 'Operations',
    focus: 'Lift OEE, reduce changeover pain, and stabilize throughput.',
  },
  {
    slug: 'isabelle-leroy',
    firstName: 'Isabelle',
    lastName: 'Leroy',
    role: 'MANAGER',
    title: 'Procurement Director',
    department: 'Supply Chain',
    focus: 'Reduce raw-material volatility and supplier lead-time risk.',
  },
  {
    slug: 'luc-rousseau',
    firstName: 'Luc',
    lastName: 'Rousseau',
    role: 'MANAGER',
    title: 'Maintenance Lead',
    department: 'Operations',
    focus: 'Move maintenance from reactive firefighting to predictive control.',
  },
  {
    slug: 'sophie-bernard',
    firstName: 'Sophie',
    lastName: 'Bernard',
    role: 'MANAGER',
    title: 'QA Director',
    department: 'Quality',
    focus: 'Close the loop between defects, root causes, and release quality.',
  },
  {
    slug: 'thomas-viau',
    firstName: 'Thomas',
    lastName: 'Viau',
    role: 'MANAGER',
    title: 'VP Sales',
    department: 'Commercial',
    focus: 'Grow partner-led revenue and improve subscription attach rate.',
  },
  {
    slug: 'camille-dubois',
    firstName: 'Camille',
    lastName: 'Dubois',
    role: 'MANAGER',
    title: 'Marketing Director',
    department: 'Marketing',
    focus: 'Translate Atelier Forward into a category-defining market story.',
  },
  {
    slug: 'jean-claude-laurent',
    firstName: 'Jean-Claude',
    lastName: 'Laurent',
    role: 'USER',
    title: 'Senior Advisor',
    department: 'Board',
    focus: 'Preserve strategic continuity while modernizing the operating model.',
  },
  {
    slug: 'amelie-girard',
    firstName: 'Amelie',
    lastName: 'Girard',
    role: 'MANAGER',
    title: 'PMO Director',
    department: 'Transformation Office',
    focus: 'Keep portfolio cadence, escalation quality, and execution discipline high.',
  },
  {
    slug: 'nicolas-faure',
    firstName: 'Nicolas',
    lastName: 'Faure',
    role: 'MANAGER',
    title: 'Head of Product',
    department: 'Product',
    focus: 'Align Atelier Core, Motion, and Digital into one portfolio logic.',
  },
  {
    slug: 'lea-martin',
    firstName: 'Lea',
    lastName: 'Martin',
    role: 'MANAGER',
    title: 'Customer Success Lead',
    department: 'Customer Success',
    focus: 'Convert pilot usage into renewals, references, and expansion.',
  },
  {
    slug: 'paul-lambert',
    firstName: 'Paul',
    lastName: 'Lambert',
    role: 'MANAGER',
    title: 'Industrial Data Lead',
    department: 'Data',
    focus: 'Raise trust in plant telemetry, KPI definitions, and AI-ready data.',
  },
  {
    slug: 'elise-robert',
    firstName: 'Elise',
    lastName: 'Robert',
    role: 'USER',
    title: 'Finance Controller',
    department: 'Finance',
    focus: 'Track capex, opex, and realized value against initiative baselines.',
  },
  {
    slug: 'mathieu-chevalier',
    firstName: 'Mathieu',
    lastName: 'Chevalier',
    role: 'USER',
    title: 'Supply Planner',
    department: 'Supply Chain',
    focus: 'Stabilize planning against component risk and changing demand signals.',
  },
  {
    slug: 'zoe-perrin',
    firstName: 'Zoe',
    lastName: 'Perrin',
    role: 'USER',
    title: 'Partner Program Manager',
    department: 'Commercial',
    focus: 'Scale enablement and co-sell execution with education partners.',
  },
  {
    slug: 'hugo-bernard',
    firstName: 'Hugo',
    lastName: 'Bernard',
    role: 'USER',
    title: 'Transformation Analyst',
    department: 'Transformation Office',
    focus: 'Prepare board packs, follow-ups, and risk intelligence for Atelier Forward.',
  },
];

export const atelierToysProjects: DemoProjectTemplate[] = [
  {
    slug: 'forward-pmo',
    name: 'Atelier Forward PMO',
    description: 'Enterprise transformation cockpit connecting plants, SaaS, and board governance.',
    status: 'active',
    goal: 'Create one operating system for transformation across factories and digital products.',
    health: 'amber',
    progressPct: 68,
    owner: 'antoine-laurent',
  },
  {
    slug: 'factory-excellence',
    name: 'Factory Excellence 2026',
    description: 'Operational excellence program for Lyon East and Lyon North plants.',
    status: 'active',
    goal: 'Improve OEE, reduce changeovers, and cut quality escapes.',
    health: 'amber',
    progressPct: 61,
    owner: 'marc-dubois',
  },
  {
    slug: 'digital-growth',
    name: 'Digital Product Growth',
    description: 'Scale Atelier Digital subscriptions and Digital Twin attach rate.',
    status: 'active',
    goal: 'Turn installed hardware base into recurring digital revenue.',
    health: 'green',
    progressPct: 72,
    owner: 'julien-moreau',
  },
  {
    slug: 'quality-excellence',
    name: 'Quality Excellence Program',
    description:
      'Reduce defects, shorten root-cause cycles, and harden launch quality across both plants.',
    status: 'active',
    goal: 'Cut customer-facing defects and create one quality evidence flow from plant to board.',
    health: 'amber',
    progressPct: 57,
    owner: 'sophie-bernard',
  },
  {
    slug: 'partner-expansion',
    name: 'Partner Expansion',
    description:
      'Build a repeatable partner-led growth engine for Atelier Core and Atelier Digital.',
    status: 'active',
    goal: 'Improve partner activation, bundle sell-through, and expansion playbooks.',
    health: 'green',
    progressPct: 64,
    owner: 'thomas-viau',
  },
  {
    slug: 'people-capability',
    name: 'People & Capability Uplift',
    description: 'Upskill supervisors, product teams, and managers on the new operating model.',
    status: 'active',
    goal: 'Make Atelier Forward sustainable by improving management routines and digital capability.',
    health: 'green',
    progressPct: 52,
    owner: 'claire-laurent',
  },
  {
    slug: 'board-governance',
    name: 'Board Governance & Value Tracking',
    description: 'Create a tighter board cadence around risk, ROI, and transformation score.',
    status: 'active',
    goal: 'Turn board meetings into decision moments backed by current evidence.',
    health: 'amber',
    progressPct: 59,
    owner: 'amelie-girard',
  },
];

export const atelierToysInitiatives: DemoInitiativeTemplate[] = [
  {
    slug: 'line-3-digital-twin',
    projectSlug: 'factory-excellence',
    name: 'Line 3 Digital Twin Rollout',
    area: 'Operations',
    summary: 'Deploy Digital Twin on Line 3 to cut downtime and shorten changeovers.',
    status: 'in_progress',
    priority: 'high',
    plannedStart: '-120d',
    plannedEnd: '+45d',
    ownerBusiness: 'marc-dubois',
    ownerExecution: 'julien-moreau',
    sponsor: 'antoine-laurent',
    expectedRoi: 182,
    budgetCapex: 420000,
    budgetOpex: 120000,
    deliverables: ['Digital Twin dashboards', 'Downtime alerting', 'Changeover playbook'],
    successCriteria: ['OEE +8pts', 'Changeover time -18%', 'Downtime alerts under 10 min'],
    keyRisks: ['Sensor integration latency', 'Shift adoption gap', 'Data quality drift'],
    tasks: [
      {
        slug: 'line3-sensor-gap',
        title: 'Close sensor coverage gaps on Line 3',
        description: 'Install missing telemetry on heat-treatment and packing stations.',
        status: 'in_progress',
        priority: 'high',
        dueDate: '+7d',
        assignee: 'luc-rousseau',
        why: 'Without full telemetry the twin cannot flag root causes reliably.',
      },
      {
        slug: 'line3-changeover-standard',
        title: 'Standardize changeover sequence in Digital Twin',
        description: 'Encode best-known changeover steps and timing targets.',
        status: 'todo',
        priority: 'medium',
        dueDate: '+18d',
        assignee: 'marc-dubois',
        why: 'This is the main value lever visible to operations and the board.',
      },
      {
        slug: 'line3-board-demo',
        title: 'Prepare board demo of downtime simulation',
        description: 'Show avoided downtime scenarios with before/after economics.',
        status: 'todo',
        priority: 'high',
        dueDate: 'nextBoardMeeting-2d',
        assignee: 'julien-moreau',
        why: 'The board meeting is the conversion moment for wider rollout funding.',
      },
    ],
    decisions: [
      {
        slug: 'line3-rollout-funding',
        title: 'Approve second-phase funding for Line 3 twin rollout',
        status: 'pending',
        decisionMaker: 'claire-laurent',
        deadline: 'nextBoardMeeting',
        rationale: 'Funding unlocks final integrations and supervisor enablement.',
      },
    ],
    milestones: [
      {
        slug: 'line3-data-live',
        name: 'Telemetry live for Line 3',
        description: 'All stations stream real-time events into the twin.',
        targetDate: '-14d',
        status: 'DONE',
      },
      {
        slug: 'line3-supervisor-pilot',
        name: 'Supervisor pilot completed',
        description: 'Pilot shift validates recommendations against actual losses.',
        targetDate: '+9d',
        status: 'IN_PROGRESS',
      },
      {
        slug: 'line3-board-gate',
        name: 'Board gate for scale-up',
        description: 'Board reviews ROI and decides expansion to Line 4.',
        targetDate: 'nextBoardMeeting',
        status: 'PENDING',
        isGate: true,
      },
    ],
  },
  {
    slug: 'procurement-control-tower',
    projectSlug: 'forward-pmo',
    name: 'Procurement Control Tower',
    area: 'Supply Chain',
    summary: 'Unify supplier risk, inventory signals, and margin exposure for critical components.',
    status: 'in_progress',
    priority: 'high',
    plannedStart: '-90d',
    plannedEnd: '+30d',
    ownerBusiness: 'isabelle-leroy',
    ownerExecution: 'claire-laurent',
    sponsor: 'antoine-laurent',
    expectedRoi: 148,
    budgetCapex: 90000,
    budgetOpex: 65000,
    deliverables: ['Supplier risk model', 'Weekly margin war room', 'Dual-sourcing roadmap'],
    successCriteria: ['Rush freight -30%', 'Margin volatility -2.1pts', 'Critical stockouts zero'],
    keyRisks: ['Supplier data freshness', 'Slow legal onboarding', 'Forecast mismatch'],
    tasks: [
      {
        slug: 'procurement-supplier-scorecards',
        title: 'Publish supplier scorecards for top 25 vendors',
        description: 'Blend OTIF, defect rate, cost drift, and concentration risk.',
        status: 'done',
        priority: 'high',
        dueDate: '-12d',
        assignee: 'isabelle-leroy',
        why: 'Scorecards anchor the whole control tower discussion.',
      },
      {
        slug: 'procurement-war-room',
        title: 'Launch weekly margin war room',
        description: 'Finance and procurement review risk and mitigation actions.',
        status: 'in_progress',
        priority: 'medium',
        dueDate: '+5d',
        assignee: 'claire-laurent',
        why: 'The CFO needs an operating cadence, not only a dashboard.',
      },
    ],
    decisions: [
      {
        slug: 'procurement-dual-source',
        title: 'Select dual-source strategy for motion sensor assemblies',
        status: 'approved',
        decisionMaker: 'antoine-laurent',
        deadline: '-7d',
        rationale: 'Approved after revenue risk exceeded board threshold.',
      },
    ],
    milestones: [
      {
        slug: 'procurement-scorecards-live',
        name: 'Scorecards live',
        description: 'Top suppliers visible in the control tower.',
        targetDate: '-10d',
        status: 'DONE',
      },
      {
        slug: 'procurement-risk-review',
        name: 'First executive risk review',
        description: 'Executive team reviews supplier exposure and mitigation.',
        targetDate: '+11d',
        status: 'PENDING',
      },
    ],
  },
  {
    slug: 'atelier-digital-growth',
    projectSlug: 'digital-growth',
    name: 'Atelier Digital Subscription Expansion',
    area: 'Growth',
    summary: 'Increase subscription attach rate and renewal confidence across partner channels.',
    status: 'in_progress',
    priority: 'high',
    plannedStart: '-150d',
    plannedEnd: '+60d',
    ownerBusiness: 'thomas-viau',
    ownerExecution: 'camille-dubois',
    sponsor: 'julien-moreau',
    expectedRoi: 236,
    budgetCapex: 110000,
    budgetOpex: 180000,
    deliverables: ['Partner launch kit', 'Renewal health dashboard', 'Education usage insights'],
    successCriteria: [
      'Attach rate +11pts',
      'Renewal risk reduced 25%',
      'Pipeline visibility weekly',
    ],
    keyRisks: ['Partner enablement lag', 'Usage data gaps', 'Messaging inconsistency'],
    tasks: [
      {
        slug: 'digital-growth-partner-kit',
        title: 'Finalize partner launch kit for Atelier Digital',
        description: 'Package ROI stories, onboarding playbooks, and objection handling.',
        status: 'in_progress',
        priority: 'high',
        dueDate: '+8d',
        assignee: 'camille-dubois',
        why: 'Commercial teams need a repeatable conversion story.',
      },
      {
        slug: 'digital-growth-renewal-risk',
        title: 'Instrument renewal-risk dashboard',
        description: 'Blend activation, usage frequency, and support tickets.',
        status: 'todo',
        priority: 'high',
        dueDate: '+21d',
        assignee: 'julien-moreau',
        why: 'This turns product analytics into a commercial action system.',
      },
    ],
    decisions: [
      {
        slug: 'digital-growth-pricing',
        title: 'Approve pilot pricing for partner-led bundles',
        status: 'pending',
        decisionMaker: 'claire-laurent',
        deadline: '+14d',
        rationale: 'Pricing guardrails must protect margin while accelerating attach rate.',
      },
    ],
    milestones: [
      {
        slug: 'digital-growth-pipeline-review',
        name: 'Partner pipeline review',
        description: 'New attach-rate baseline shared with commercial leaders.',
        targetDate: '-6d',
        status: 'DONE',
      },
      {
        slug: 'digital-growth-board-pack',
        name: 'Board growth pack ready',
        description: 'Board sees hardware-to-SaaS story with evidence.',
        targetDate: '+12d',
        status: 'IN_PROGRESS',
      },
    ],
  },
  {
    slug: 'supplier-risk-war-room',
    projectSlug: 'partner-expansion',
    name: 'Supplier Risk War Room',
    area: 'Supply Chain',
    summary:
      'Create weekly risk visibility for high-variance components affecting delivery promises and margin.',
    status: 'in_progress',
    priority: 'high',
    plannedStart: '-75d',
    plannedEnd: '+25d',
    ownerBusiness: 'isabelle-leroy',
    ownerExecution: 'mathieu-chevalier',
    sponsor: 'claire-laurent',
    expectedRoi: 131,
    budgetCapex: 45000,
    budgetOpex: 38000,
    deliverables: [
      'Supplier heatmap',
      'Scenario-based mitigation playbooks',
      'Lead-time alert board',
    ],
    successCriteria: ['Critical supplier exposure -20%', 'Expedite costs -18%', 'OTIF +4pts'],
    keyRisks: ['Forecast noise', 'Supplier cooperation gaps', 'Late engineering changes'],
    tasks: [
      {
        slug: 'supplier-war-room-score',
        title: 'Publish weekly supplier risk heatmap',
        description: 'Blend lead time, defect rate, concentration, and expedite exposure.',
        status: 'done',
        priority: 'high',
        dueDate: '-9d',
        assignee: 'mathieu-chevalier',
        why: 'It gives the commercial team an honest picture of promise risk.',
      },
      {
        slug: 'supplier-war-room-alerts',
        title: 'Connect component alerts to partner commitments',
        description: 'Map key shortages to open partner deals and promised delivery windows.',
        status: 'in_progress',
        priority: 'high',
        dueDate: '+6d',
        assignee: 'zoe-perrin',
        why: 'Commercial credibility drops when supply risk is invisible.',
      },
      {
        slug: 'supplier-war-room-playbooks',
        title: 'Document shortage playbooks for top 5 components',
        description: 'Define alternates, communication templates, and escalation rules.',
        status: 'todo',
        priority: 'medium',
        dueDate: '+17d',
        assignee: 'isabelle-leroy',
        why: 'This is what makes the war room operational rather than analytical only.',
      },
    ],
    decisions: [
      {
        slug: 'supplier-war-room-buffer-policy',
        title: 'Approve strategic buffer policy for motion sensor inventory',
        status: 'pending',
        decisionMaker: 'claire-laurent',
        deadline: '+9d',
        rationale:
          'The team needs finance approval to protect delivery reliability without overstocking.',
      },
    ],
    milestones: [
      {
        slug: 'supplier-war-room-live',
        name: 'War room live',
        description: 'Weekly cross-functional cadence is active.',
        targetDate: '-7d',
        status: 'DONE',
      },
      {
        slug: 'supplier-war-room-policy',
        name: 'Inventory policy approved',
        description: 'Decision on strategic buffers and escalation thresholds.',
        targetDate: '+10d',
        status: 'PENDING',
      },
    ],
  },
  {
    slug: 'qa-defect-closing-loop',
    projectSlug: 'quality-excellence',
    name: 'QA Defect Closing Loop',
    area: 'Quality',
    summary:
      'Shorten the time from detected defect to validated countermeasure across plants and product teams.',
    status: 'in_progress',
    priority: 'high',
    plannedStart: '-110d',
    plannedEnd: '+35d',
    ownerBusiness: 'sophie-bernard',
    ownerExecution: 'paul-lambert',
    sponsor: 'marc-dubois',
    expectedRoi: 164,
    budgetCapex: 85000,
    budgetOpex: 62000,
    deliverables: ['Quality cockpit', 'Root-cause workflow', 'Launch readiness checklist'],
    successCriteria: [
      'Defect recurrence -35%',
      'Root-cause cycle time -40%',
      'Warranty claims -12%',
    ],
    keyRisks: ['Manual data capture', 'Weak engineering feedback loop', 'Overloaded QA leads'],
    tasks: [
      {
        slug: 'qa-defect-taxonomy',
        title: 'Unify defect taxonomy across both plants',
        description: 'Create one shared language for customer, plant, and supplier quality issues.',
        status: 'done',
        priority: 'medium',
        dueDate: '-18d',
        assignee: 'sophie-bernard',
        why: 'Without one taxonomy, quality analytics stay fragmented and misleading.',
      },
      {
        slug: 'qa-root-cause-board',
        title: 'Launch root-cause review board',
        description: 'Run weekly corrective-action board with operations and engineering.',
        status: 'in_progress',
        priority: 'high',
        dueDate: '+4d',
        assignee: 'paul-lambert',
        why: 'This creates a real operating mechanism for quality closure.',
      },
      {
        slug: 'qa-launch-checklist',
        title: 'Finalize launch readiness checklist for new digital bundles',
        description: 'Ensure bundle offers meet plant, app, and support readiness criteria.',
        status: 'todo',
        priority: 'medium',
        dueDate: '+15d',
        assignee: 'lea-martin',
        why: 'Launch quality is part of product credibility, not just factory quality.',
      },
    ],
    decisions: [
      {
        slug: 'qa-escalation-thresholds',
        title: 'Set escalation thresholds for recurring quality escapes',
        status: 'approved',
        decisionMaker: 'marc-dubois',
        deadline: '-5d',
        rationale: 'Thresholds were approved to avoid late reaction on repeated incidents.',
      },
      {
        slug: 'qa-engineering-ownership',
        title: 'Assign engineering owner for cross-plant defect patterns',
        status: 'pending',
        decisionMaker: 'julien-moreau',
        deadline: '+8d',
        rationale:
          'A shared owner is needed for issues that cut across plant and software release logic.',
      },
    ],
    milestones: [
      {
        slug: 'qa-cockpit-alpha',
        name: 'Quality cockpit alpha',
        description: 'Defect and corrective-action visibility available to leaders.',
        targetDate: '-11d',
        status: 'DONE',
      },
      {
        slug: 'qa-corrective-close-rate',
        name: 'Corrective-action close rate above target',
        description: 'Quality board achieves the first target close-rate milestone.',
        targetDate: '+13d',
        status: 'IN_PROGRESS',
      },
    ],
  },
  {
    slug: 'product-roadmap-sync',
    projectSlug: 'digital-growth',
    name: 'Product Roadmap Sync',
    area: 'Product',
    summary:
      'Align product roadmap, customer requests, and partner demand signals into one quarterly plan.',
    status: 'PLANNING',
    priority: 'medium',
    plannedStart: '-40d',
    plannedEnd: '+70d',
    ownerBusiness: 'nicolas-faure',
    ownerExecution: 'camille-dubois',
    sponsor: 'julien-moreau',
    expectedRoi: 119,
    budgetCapex: 40000,
    budgetOpex: 52000,
    deliverables: [
      'Quarterly roadmap view',
      'Customer insight synthesis',
      'Decision log for trade-offs',
    ],
    successCriteria: [
      'Roadmap confidence +20%',
      'Partner objections reduced',
      'Product-sales alignment weekly',
    ],
    keyRisks: ['Too many inputs', 'Weak prioritization discipline', 'Late engineering estimates'],
    tasks: [
      {
        slug: 'product-roadmap-signal-pack',
        title: 'Synthesize product signals from top 20 accounts',
        description: 'Bundle customer interviews, support notes, and commercial deal blockers.',
        status: 'in_progress',
        priority: 'high',
        dueDate: '+9d',
        assignee: 'lea-martin',
        why: 'It turns anecdotal requests into a credible prioritization base.',
      },
      {
        slug: 'product-roadmap-quarter-plan',
        title: 'Draft next-quarter roadmap options',
        description: 'Prepare three options with effort, revenue upside, and operational load.',
        status: 'todo',
        priority: 'medium',
        dueDate: '+18d',
        assignee: 'nicolas-faure',
        why: 'Leadership needs explicit trade-offs, not a flat backlog.',
      },
      {
        slug: 'product-roadmap-partner-review',
        title: 'Review roadmap options with pilot partners',
        description: 'Collect reactions from priority channel partners before final commitment.',
        status: 'todo',
        priority: 'medium',
        dueDate: '+24d',
        assignee: 'zoe-perrin',
        why: 'Partner input is a revenue signal, not a post-hoc validation.',
      },
    ],
    decisions: [
      {
        slug: 'product-roadmap-bet',
        title: 'Choose next-quarter roadmap bet: adoption vs analytics depth',
        status: 'pending',
        decisionMaker: 'antoine-laurent',
        deadline: 'currentQuarterEnd-5d',
        rationale: 'The team must decide whether to maximize new attach or deepen retention value.',
      },
    ],
    milestones: [
      {
        slug: 'product-roadmap-inputs-ready',
        name: 'Inputs consolidated',
        description: 'Customer, product, and commercial inputs are normalized.',
        targetDate: '+7d',
        status: 'IN_PROGRESS',
      },
      {
        slug: 'product-roadmap-quarter-gate',
        name: 'Quarter plan approved',
        description: 'Leadership signs off on the next-quarter roadmap choice.',
        targetDate: 'currentQuarterEnd-3d',
        status: 'PENDING',
        isGate: true,
      },
    ],
  },
  {
    slug: 'partner-onboarding-excellence',
    projectSlug: 'partner-expansion',
    name: 'Partner Onboarding Excellence',
    area: 'Commercial',
    summary:
      'Reduce time-to-first-value for new partners and improve bundle sell-through in the first 90 days.',
    status: 'in_progress',
    priority: 'high',
    plannedStart: '-95d',
    plannedEnd: '+40d',
    ownerBusiness: 'thomas-viau',
    ownerExecution: 'zoe-perrin',
    sponsor: 'camille-dubois',
    expectedRoi: 171,
    budgetCapex: 30000,
    budgetOpex: 76000,
    deliverables: ['Partner onboarding journey', 'Enablement scorecards', 'Reference case package'],
    successCriteria: ['Time-to-first-order -30%', 'Bundle sell-through +9pts', 'Partner NPS +12'],
    keyRisks: [
      'Low enablement attendance',
      'Weak objection handling',
      'Incomplete case references',
    ],
    tasks: [
      {
        slug: 'partner-onboarding-journey',
        title: 'Map first-90-day partner journey',
        description: 'Define milestones from signature to first active digital bundle sale.',
        status: 'done',
        priority: 'medium',
        dueDate: '-14d',
        assignee: 'zoe-perrin',
        why: 'A visible journey creates accountability across teams.',
      },
      {
        slug: 'partner-onboarding-scorecards',
        title: 'Launch onboarding scorecards',
        description: 'Track enablement completion, demo readiness, and first-bundle conversion.',
        status: 'in_progress',
        priority: 'high',
        dueDate: '+6d',
        assignee: 'lea-martin',
        why: 'This turns onboarding into an actively managed funnel.',
      },
      {
        slug: 'partner-onboarding-case-pack',
        title: 'Package Atelier Toys story as a partner case asset',
        description: 'Create a narrative that partners can reuse in their own sales motion.',
        status: 'todo',
        priority: 'medium',
        dueDate: '+12d',
        assignee: 'camille-dubois',
        why: 'Strong proof shortens the trust-building cycle for new partners.',
      },
    ],
    decisions: [
      {
        slug: 'partner-onboarding-certification',
        title: 'Approve lightweight partner certification threshold',
        status: 'approved',
        decisionMaker: 'thomas-viau',
        deadline: '-4d',
        rationale: 'Approved to raise consistency without slowing early activation.',
      },
    ],
    milestones: [
      {
        slug: 'partner-onboarding-v1',
        name: 'Onboarding v1 live',
        description: 'The first standardized partner onboarding flow is active.',
        targetDate: '-8d',
        status: 'DONE',
      },
      {
        slug: 'partner-onboarding-first-cohort',
        name: 'First cohort reviewed',
        description: 'The first partner cohort has completed the new onboarding sequence.',
        targetDate: '+14d',
        status: 'IN_PROGRESS',
      },
    ],
  },
  {
    slug: 'supervisor-capability-academy',
    projectSlug: 'people-capability',
    name: 'Supervisor Capability Academy',
    area: 'People',
    summary:
      'Train plant and project supervisors on the new management rhythms behind Atelier Forward.',
    status: 'in_progress',
    priority: 'medium',
    plannedStart: '-60d',
    plannedEnd: '+50d',
    ownerBusiness: 'claire-laurent',
    ownerExecution: 'amelie-girard',
    sponsor: 'antoine-laurent',
    expectedRoi: 104,
    budgetCapex: 25000,
    budgetOpex: 58000,
    deliverables: ['Supervisor academy curriculum', 'Coaching checkpoints', 'Adoption dashboard'],
    successCriteria: [
      'Routine adherence +25%',
      'Escalation quality improved',
      'Manager confidence up',
    ],
    keyRisks: [
      'Low time availability',
      'Inconsistent manager sponsorship',
      'Too much generic training',
    ],
    tasks: [
      {
        slug: 'academy-curriculum',
        title: 'Finalize curriculum for supervisor academy',
        description: 'Blend daily management, escalation, and data-driven review practices.',
        status: 'done',
        priority: 'medium',
        dueDate: '-10d',
        assignee: 'amelie-girard',
        why: 'The curriculum shapes whether this becomes practical or theoretical.',
      },
      {
        slug: 'academy-cohort-1',
        title: 'Launch first supervisor cohort',
        description: 'Run the first cohort across plant and cross-functional leaders.',
        status: 'in_progress',
        priority: 'high',
        dueDate: '+5d',
        assignee: 'claire-laurent',
        why: 'Visible leadership sponsorship is necessary for credibility.',
      },
      {
        slug: 'academy-adoption-dash',
        title: 'Track academy adoption signals',
        description: 'Measure attendance, action completion, and routine adherence by cohort.',
        status: 'todo',
        priority: 'medium',
        dueDate: '+19d',
        assignee: 'hugo-bernard',
        why: 'The board will ask whether capability uplift is becoming real behavior.',
      },
    ],
    decisions: [
      {
        slug: 'academy-scale',
        title: 'Decide whether academy expands to product and customer teams',
        status: 'pending',
        decisionMaker: 'antoine-laurent',
        deadline: '+22d',
        rationale: 'Expansion depends on the first cohort showing visible operating change.',
      },
    ],
    milestones: [
      {
        slug: 'academy-cohort-live',
        name: 'First cohort live',
        description: 'Cross-functional academy cohort has started.',
        targetDate: '+3d',
        status: 'IN_PROGRESS',
      },
      {
        slug: 'academy-first-retro',
        name: 'First retro completed',
        description: 'The team reviews adoption signals and content gaps.',
        targetDate: '+21d',
        status: 'PENDING',
      },
    ],
  },
  {
    slug: 'board-value-tracking',
    projectSlug: 'board-governance',
    name: 'Board Value Tracking',
    area: 'Governance',
    summary: 'Make value capture, risks, and decisions visible in every board cycle.',
    status: 'in_progress',
    priority: 'high',
    plannedStart: '-100d',
    plannedEnd: '+28d',
    ownerBusiness: 'antoine-laurent',
    ownerExecution: 'hugo-bernard',
    sponsor: 'jean-claude-laurent',
    expectedRoi: 143,
    budgetCapex: 20000,
    budgetOpex: 44000,
    deliverables: ['Board scorecard', 'Decision follow-up log', 'Transformation score'],
    successCriteria: [
      'Decision follow-up completeness 100%',
      'ROI confidence improved',
      'Board prep time -35%',
    ],
    keyRisks: [
      'Manual reporting burden',
      'Inconsistent assumptions',
      'Weak follow-through after decisions',
    ],
    tasks: [
      {
        slug: 'board-scorecard-v2',
        title: 'Publish board scorecard v2',
        description:
          'Unify financial, operational, digital, and capability signals into one scorecard.',
        status: 'in_progress',
        priority: 'high',
        dueDate: '+4d',
        assignee: 'hugo-bernard',
        why: 'The board needs one shared language for progress and risk.',
      },
      {
        slug: 'board-followup-log',
        title: 'Backfill last two board cycles into decision follow-up log',
        description: 'Make sure open actions, owners, and deadlines are explicit.',
        status: 'todo',
        priority: 'medium',
        dueDate: '+9d',
        assignee: 'amelie-girard',
        why: 'Without follow-up history the board cockpit loses trust quickly.',
      },
      {
        slug: 'board-roi-logic',
        title: 'Refresh ROI logic for top 10 initiatives',
        description: 'Align realized value, expected value, and confidence bands.',
        status: 'todo',
        priority: 'high',
        dueDate: 'nextBoardMeeting-1d',
        assignee: 'elise-robert',
        why: 'This is the core of a persuasive transformation story.',
      },
    ],
    decisions: [
      {
        slug: 'board-scorecard-standard',
        title: 'Adopt board scorecard as the standard monthly executive narrative',
        status: 'pending',
        decisionMaker: 'jean-claude-laurent',
        deadline: 'nextBoardMeeting',
        rationale: 'The advisory board wants one consistent artifact to evaluate transformation.',
      },
    ],
    milestones: [
      {
        slug: 'board-scorecard-draft',
        name: 'Board scorecard draft ready',
        description: 'Draft board scorecard reviewed by CEO and CFO.',
        targetDate: '-3d',
        status: 'DONE',
      },
      {
        slug: 'board-decision-pack',
        name: 'Decision pack signed off',
        description: 'Board deck and decision pack are ready for the next session.',
        targetDate: 'nextBoardMeeting-1d',
        status: 'IN_PROGRESS',
      },
    ],
  },
  {
    slug: 'atelier-motion-concept-lab',
    projectSlug: 'digital-growth',
    name: 'Atelier Motion Concept Lab',
    area: 'Innovation',
    summary:
      'Shape the next generation of motion-based STEM kits and validate the first concept hypotheses.',
    status: 'DRAFT',
    currentStage: 'Discovery',
    priority: 'medium',
    plannedStart: '-20d',
    plannedEnd: '+75d',
    ownerBusiness: 'nicolas-faure',
    ownerExecution: 'camille-dubois',
    sponsor: 'julien-moreau',
    expectedRoi: 118,
    budgetCapex: 18000,
    budgetOpex: 36000,
    deliverables: ['Concept brief', 'Teacher insight pack', 'First desirability test'],
    successCriteria: [
      'Top 3 concept risks identified',
      '10 customer interviews synthesized',
      'One pilot concept selected',
    ],
    keyRisks: [
      'Shiny-object bias',
      'Weak customer signal quality',
      'No clear monetization path yet',
    ],
    tasks: [
      {
        slug: 'motion-concept-interviews',
        title: 'Interview pilot teachers on motion-learning use cases',
        description:
          'Collect needs, frustrations, and willingness-to-pay signals before concept lock.',
        status: 'todo',
        priority: 'medium',
        dueDate: '+10d',
        assignee: 'lea-martin',
        why: 'The concept should be evidence-led, not only product intuition.',
      },
      {
        slug: 'motion-concept-brief',
        title: 'Draft concept brief and hypothesis tree',
        description: 'Summarize target user, value promise, adoption trigger, and success signal.',
        status: 'todo',
        priority: 'medium',
        dueDate: '+18d',
        assignee: 'nicolas-faure',
        why: 'This is the artifact that moves the idea from spark to serious portfolio discussion.',
      },
    ],
    decisions: [
      {
        slug: 'motion-concept-go-no-go',
        title: 'Choose whether the concept lab proceeds to business case',
        status: 'pending',
        decisionMaker: 'julien-moreau',
        deadline: '+28d',
        rationale:
          'The team needs an explicit gate before committing design and partner bandwidth.',
      },
    ],
    milestones: [
      {
        slug: 'motion-concept-signal-pack',
        name: 'Signal pack consolidated',
        description: 'Teacher and partner input is ready for concept review.',
        targetDate: '+16d',
        status: 'PENDING',
      },
    ],
  },
  {
    slug: 'ot-cyber-hardening',
    projectSlug: 'factory-excellence',
    name: 'OT Cyber Hardening',
    area: 'Cybersecurity',
    summary:
      'Approve the cross-plant OT security baseline and prepare the first implementation wave.',
    status: 'APPROVED',
    currentStage: 'Business Case',
    priority: 'high',
    plannedStart: '-30d',
    plannedEnd: '+80d',
    ownerBusiness: 'claire-laurent',
    ownerExecution: 'paul-lambert',
    sponsor: 'antoine-laurent',
    expectedRoi: 96,
    budgetCapex: 95000,
    budgetOpex: 54000,
    deliverables: ['OT baseline controls', 'Segmentation plan', 'Audit-ready risk register'],
    successCriteria: [
      'Baseline approved',
      'Plant scope defined',
      'Critical control gaps prioritized',
    ],
    keyRisks: [
      'Security work seen as pure cost',
      'Weak OT/IT ownership split',
      'Plant downtime fears',
    ],
    tasks: [
      {
        slug: 'ot-cyber-baseline',
        title: 'Finalize OT baseline control set',
        description:
          'Lock segmentation, privileged access, and monitoring rules for the first wave.',
        status: 'in_progress',
        priority: 'high',
        dueDate: '+6d',
        assignee: 'paul-lambert',
        why: 'The initiative is approved, but implementation cannot start without one agreed baseline.',
      },
    ],
    decisions: [
      {
        slug: 'ot-cyber-wave1',
        title: 'Approve first hardening wave for Lyon East',
        status: 'approved',
        decisionMaker: 'antoine-laurent',
        deadline: '-2d',
        rationale:
          'The first wave is approved to reduce exposure before broader Digital Twin rollout.',
      },
    ],
    milestones: [
      {
        slug: 'ot-cyber-approved',
        name: 'Business case approved',
        description: 'Security hardening moved from analysis to funded portfolio work.',
        targetDate: '-4d',
        status: 'DONE',
      },
      {
        slug: 'ot-cyber-implementation-plan',
        name: 'Implementation plan ready',
        description: 'The first plant-level implementation sequence is ready.',
        targetDate: '+12d',
        status: 'IN_PROGRESS',
      },
    ],
  },
  {
    slug: 'lyon-north-scheduler-pilot',
    projectSlug: 'factory-excellence',
    name: 'Lyon North Scheduler Pilot',
    area: 'Planning',
    summary: 'Schedule a pilot for a smarter production scheduler at Lyon North.',
    status: 'SCHEDULED',
    currentStage: 'Pilot Preparation',
    priority: 'medium',
    plannedStart: '+5d',
    plannedEnd: '+65d',
    ownerBusiness: 'marc-dubois',
    ownerExecution: 'paul-lambert',
    sponsor: 'claire-laurent',
    expectedRoi: 109,
    budgetCapex: 30000,
    budgetOpex: 42000,
    deliverables: ['Pilot schedule logic', 'Exception rules', 'Shift simulation review'],
    successCriteria: [
      'Pilot starts on time',
      'Schedule adherence improves',
      'Planner confidence rises',
    ],
    keyRisks: ['Planner skepticism', 'Bad master data', 'Overfit to one plant scenario'],
    tasks: [
      {
        slug: 'scheduler-pilot-readiness',
        title: 'Confirm pilot readiness and data completeness',
        description: 'Check schedule inputs, constraints, and planner sign-off before start.',
        status: 'todo',
        priority: 'high',
        dueDate: '+4d',
        assignee: 'mathieu-chevalier',
        why: 'A scheduled pilot can still fail if readiness work is weak.',
      },
    ],
    decisions: [
      {
        slug: 'scheduler-pilot-start',
        title: 'Confirm go-live date for scheduler pilot',
        status: 'pending',
        decisionMaker: 'marc-dubois',
        deadline: '+3d',
        rationale: 'The team needs a final readiness check before opening the pilot window.',
      },
    ],
    milestones: [
      {
        slug: 'scheduler-pilot-window',
        name: 'Pilot window locked',
        description: 'The pilot start date and scope are fixed.',
        targetDate: '+2d',
        status: 'IN_PROGRESS',
      },
    ],
  },
  {
    slug: 'atelier-core-onboarding-revamp',
    projectSlug: 'digital-growth',
    name: 'Atelier Core Onboarding Revamp',
    area: 'Customer Success',
    summary: 'Execute the new onboarding experience for Atelier Core and reduce time-to-value.',
    status: 'EXECUTING',
    currentStage: 'Rollout',
    priority: 'high',
    plannedStart: '-35d',
    plannedEnd: '+20d',
    ownerBusiness: 'lea-martin',
    ownerExecution: 'camille-dubois',
    sponsor: 'thomas-viau',
    expectedRoi: 154,
    budgetCapex: 22000,
    budgetOpex: 49000,
    deliverables: ['Onboarding journey', 'First-30-day scorecard', 'Coach assets'],
    successCriteria: [
      'Time-to-first-value -25%',
      'Activation rate +12pts',
      'Support burden reduced',
    ],
    keyRisks: [
      'Mixed messaging across teams',
      'No usage trigger definition',
      'Support overload during rollout',
    ],
    tasks: [
      {
        slug: 'core-onboarding-playbook',
        title: 'Roll out the new onboarding playbook to customer-facing teams',
        description: 'Enable sales, success, and support on the revised path and signals.',
        status: 'in_progress',
        priority: 'high',
        dueDate: '+7d',
        assignee: 'lea-martin',
        why: 'Execution quality depends on one shared motion across teams.',
      },
      {
        slug: 'core-onboarding-metrics',
        title: 'Track first-30-day adoption signals',
        description: 'Measure activation, first action completion, and help-needed moments.',
        status: 'todo',
        priority: 'medium',
        dueDate: '+10d',
        assignee: 'hugo-bernard',
        why: 'Without signal tracking the rollout becomes anecdotal very quickly.',
      },
    ],
    decisions: [
      {
        slug: 'core-onboarding-scale',
        title: 'Decide whether to make the new journey standard for all new logos',
        status: 'pending',
        decisionMaker: 'thomas-viau',
        deadline: '+16d',
        rationale: 'The first execution wave should prove value before global standardization.',
      },
    ],
    milestones: [
      {
        slug: 'core-onboarding-wave1',
        name: 'Wave 1 execution live',
        description: 'The first onboarding wave is active for selected customer cohorts.',
        targetDate: '-6d',
        status: 'DONE',
      },
    ],
  },
  {
    slug: 'warehouse-automation-wave1',
    projectSlug: 'factory-excellence',
    name: 'Warehouse Automation Wave 1',
    area: 'Logistics',
    summary:
      'Unblock the first warehouse automation wave after layout and safety issues delayed execution.',
    status: 'BLOCKED',
    currentStage: 'Execution Risk',
    priority: 'high',
    plannedStart: '-55d',
    plannedEnd: '+85d',
    ownerBusiness: 'isabelle-leroy',
    ownerExecution: 'paul-lambert',
    sponsor: 'claire-laurent',
    expectedRoi: 131,
    budgetCapex: 240000,
    budgetOpex: 61000,
    deliverables: ['Wave 1 layout', 'Safety review', 'Automation SOPs'],
    successCriteria: ['Travel time -18%', 'Picking errors -30%', 'Operator safety incidents 0'],
    keyRisks: ['Layout bottleneck unresolved', 'Integrator availability', 'Safety sign-off delay'],
    tasks: [
      {
        slug: 'warehouse-layout-rework',
        title: 'Resolve layout conflict on inbound lane',
        description: 'Fix the physical conflict between automation cells and forklift path.',
        status: 'in_progress',
        priority: 'high',
        dueDate: '+8d',
        assignee: 'marc-dubois',
        why: 'This is the blocking constraint preventing the wave from restarting.',
      },
    ],
    decisions: [
      {
        slug: 'warehouse-wave1-unblock',
        title: 'Decide whether to re-scope Wave 1 to regain schedule',
        status: 'pending',
        decisionMaker: 'claire-laurent',
        deadline: '+9d',
        rationale: 'Leadership must choose between keeping scope or restoring momentum.',
      },
    ],
    milestones: [
      {
        slug: 'warehouse-wave1-blocker',
        name: 'Blocker review complete',
        description: 'Operations and safety jointly assess the layout blocker.',
        targetDate: '+6d',
        status: 'IN_PROGRESS',
      },
    ],
  },
  {
    slug: 'predictive-maintenance-rollout',
    projectSlug: 'quality-excellence',
    name: 'Predictive Maintenance Rollout',
    area: 'Reliability',
    summary: 'Track realized value from predictive alerts after the initial deployment wave.',
    status: 'TRACKING',
    currentStage: 'Value Realization',
    priority: 'medium',
    plannedStart: '-120d',
    plannedEnd: '+120d',
    ownerBusiness: 'marc-dubois',
    ownerExecution: 'mathieu-chevalier',
    sponsor: 'antoine-laurent',
    expectedRoi: 167,
    budgetCapex: 125000,
    budgetOpex: 47000,
    deliverables: ['Alert tuning log', 'Maintenance adoption dashboard', 'Savings evidence pack'],
    successCriteria: [
      'Unplanned downtime -12%',
      'Alert precision up',
      'Savings evidence board-ready',
    ],
    keyRisks: ['Weak evidence discipline', 'Alert fatigue returns', 'Savings overstated'],
    tasks: [
      {
        slug: 'predictive-maintenance-value-pack',
        title: 'Prepare realized-value evidence pack for steering review',
        description:
          'Show what downtime savings were actually realized and how confident the evidence is.',
        status: 'in_progress',
        priority: 'medium',
        dueDate: '+11d',
        assignee: 'elise-robert',
        why: 'Tracking phase credibility depends on evidence, not just enthusiasm.',
      },
    ],
    decisions: [
      {
        slug: 'predictive-maintenance-scale',
        title: 'Decide whether to scale the rollout to the final plant',
        status: 'pending',
        decisionMaker: 'antoine-laurent',
        deadline: '+18d',
        rationale:
          'Scale should follow only after value proof is trusted by finance and operations.',
      },
    ],
    milestones: [
      {
        slug: 'predictive-maintenance-wave1-complete',
        name: 'Wave 1 complete',
        description: 'The first rollout wave is closed and now under value tracking.',
        targetDate: '-14d',
        status: 'DONE',
      },
    ],
  },
  {
    slug: 'legacy-crm-retirement',
    projectSlug: 'digital-growth',
    name: 'Legacy CRM Retirement',
    area: 'Systems',
    summary: 'Close the legacy CRM footprint after commercial migration completed successfully.',
    status: 'DONE',
    currentStage: 'Closed',
    priority: 'medium',
    plannedStart: '-180d',
    plannedEnd: '-12d',
    ownerBusiness: 'thomas-viau',
    ownerExecution: 'julien-moreau',
    sponsor: 'antoine-laurent',
    expectedRoi: 88,
    budgetCapex: 14000,
    budgetOpex: 28000,
    deliverables: ['Decommission checklist', 'Data migration log', 'New CRM adoption playbook'],
    successCriteria: [
      'Old licenses retired',
      'Data quality stabilized',
      'Commercial teams fully migrated',
    ],
    keyRisks: ['Historical data loss', 'Shadow spreadsheets survive', 'Support ownership unclear'],
    tasks: [
      {
        slug: 'legacy-crm-closeout',
        title: 'Archive retirement pack and lessons learned',
        description: 'Document what worked, what broke, and what to reuse for future migrations.',
        status: 'done',
        priority: 'low',
        dueDate: '-5d',
        assignee: 'julien-moreau',
        why: 'Closed initiatives should still leave reusable knowledge behind.',
      },
    ],
    decisions: [
      {
        slug: 'legacy-crm-close',
        title: 'Confirm formal closeout of legacy CRM retirement',
        status: 'approved',
        decisionMaker: 'antoine-laurent',
        deadline: '-10d',
        rationale: 'The migration objectives were met and the old stack is fully retired.',
      },
    ],
    milestones: [
      {
        slug: 'legacy-crm-retired',
        name: 'Legacy CRM switched off',
        description: 'The legacy platform is decommissioned and archived.',
        targetDate: '-12d',
        status: 'DONE',
      },
    ],
  },
  {
    slug: 'classroom-community-app',
    projectSlug: 'digital-growth',
    name: 'Classroom Community App',
    area: 'Product',
    summary:
      'Explore a community companion app, then stop it after weak pull and misfit with the core roadmap.',
    status: 'CANCELLED',
    currentStage: 'Stopped',
    priority: 'low',
    plannedStart: '-95d',
    plannedEnd: '-18d',
    ownerBusiness: 'nicolas-faure',
    ownerExecution: 'camille-dubois',
    sponsor: 'julien-moreau',
    expectedRoi: 52,
    budgetCapex: 12000,
    budgetOpex: 21000,
    deliverables: ['Concept spec', 'Adoption hypothesis', 'Pilot scope note'],
    successCriteria: [
      'Validate strong educator pull',
      'Fit core roadmap',
      'No extra support burden',
    ],
    keyRisks: [
      'Weak strategic fit',
      'Distraction from monetizable roadmap items',
      'Unclear owner after pilot',
    ],
    tasks: [
      {
        slug: 'community-app-closeout',
        title: 'Capture why the concept was stopped',
        description: 'Document the evidence and trade-offs behind cancellation.',
        status: 'done',
        priority: 'low',
        dueDate: '-15d',
        assignee: 'nicolas-faure',
        why: 'Cancelled work should still teach the portfolio what not to repeat.',
      },
    ],
    decisions: [
      {
        slug: 'community-app-cancel',
        title: 'Stop community app concept and reallocate effort',
        status: 'approved',
        decisionMaker: 'julien-moreau',
        deadline: '-18d',
        rationale: 'The concept had weak revenue potential and would dilute roadmap focus.',
      },
    ],
    milestones: [
      {
        slug: 'community-app-stopped',
        name: 'Concept formally stopped',
        description: 'The team closed the concept and archived the learning.',
        targetDate: '-18d',
        status: 'DONE',
      },
    ],
  },
  // ==========================================================================
  // WP-3 — 5 NEW VERTICALS (narrative-coherence spec:
  // docs/demo/ATELIER_NEW_VERTICALS_NARRATIVE_SPEC.md). Each slots into the
  // existing "Ateliertoy Forward" story without contradicting a canonical
  // number, reuses the existing 18-person cast, and retires a real risk on an
  // existing flagship. Owners/budgets/ROI stay inside the existing envelope.
  // ==========================================================================
  {
    slug: 'frontline-digital-skills-passport',
    projectSlug: 'people-capability',
    name: 'Frontline Digital Skills Passport',
    area: 'People',
    summary:
      'Certify operators, planners, and CSMs on the digital routines behind the Twin, control tower, and renewal playbooks.',
    status: 'SCHEDULED',
    currentStage: 'Cohort Design',
    priority: 'medium',
    plannedStart: '+10d',
    plannedEnd: '+120d',
    ownerBusiness: 'claire-laurent',
    ownerExecution: 'hugo-bernard',
    sponsor: 'marc-dubois',
    expectedRoi: 112,
    budgetCapex: 20000,
    budgetOpex: 64000,
    deliverables: [
      'Role-based skills matrix',
      'Passport certification tracks',
      'Shift adoption scoreboard',
    ],
    successCriteria: [
      '80% of Line 3 operators passport-certified',
      'Twin alert-response adherence +30%',
      'Tool-adoption variance between shifts halved',
    ],
    keyRisks: [
      'Training decoupled from real shift routines',
      'Certification becomes checkbox theater',
      'Backfill cost during training windows',
    ],
    tasks: [
      {
        slug: 'passport-skills-matrix',
        title: 'Map digital skill requirements per frontline role',
        description:
          'Define, per role, the digital routines each operator, planner, and CSM must master.',
        status: 'todo',
        priority: 'medium',
        dueDate: '+21d',
        assignee: 'luc-rousseau',
        why: 'The passport is only credible if it mirrors what each role actually does in the new routines.',
      },
      {
        slug: 'passport-pilot-cohort',
        title: 'Design pilot cohort with Line 3 operators',
        description:
          'Stand up the first frontline certification cohort where adoption gaps cost the most.',
        status: 'todo',
        priority: 'high',
        dueDate: '+40d',
        assignee: 'hugo-bernard',
        why: 'Line 3 is where adoption gaps directly cost the last 2 OEE points.',
      },
    ],
    decisions: [
      {
        slug: 'passport-cert-standard',
        title: 'Approve certification standard and backfill budget',
        status: 'pending',
        decisionMaker: 'claire-laurent',
        deadline: '+18d',
        rationale:
          'People investment must be sized against production backfill cost before cohorts start.',
      },
    ],
    milestones: [
      {
        slug: 'passport-matrix-ready',
        name: 'Skills matrix signed off',
        description: 'The role-based digital skills matrix is approved for cohort design.',
        targetDate: '+21d',
        status: 'PENDING',
      },
      {
        slug: 'passport-cohort1-start',
        name: 'First frontline cohort starts',
        description: 'The first operator/CSM certification cohort begins.',
        targetDate: '+40d',
        status: 'PENDING',
      },
    ],
  },
  {
    slug: 'educator-experience-loop',
    projectSlug: 'digital-growth',
    name: 'Educator Experience Loop',
    area: 'Customer Experience',
    summary:
      'Fuse educator NPS, support friction, and usage drop-off into one voice-of-educator loop that triggers renewal-save plays.',
    status: 'in_progress',
    priority: 'high',
    plannedStart: '-45d',
    plannedEnd: '+55d',
    ownerBusiness: 'lea-martin',
    ownerExecution: 'nicolas-faure',
    sponsor: 'thomas-viau',
    expectedRoi: 158,
    budgetCapex: 35000,
    budgetOpex: 82000,
    deliverables: [
      'Voice-of-educator signal model',
      'Renewal-save playbook',
      'Quarterly educator experience report',
    ],
    successCriteria: [
      'At-risk renewals flagged 45 days earlier',
      'Educator NPS +10 pts',
      'Renewal-save play executed on 100% of flagged accounts',
    ],
    keyRisks: [
      'Signals produce scores but no actions',
      'Survey fatigue among educators',
      'Support and success teams read signals differently',
    ],
    tasks: [
      {
        slug: 'edu-loop-signal-fusion',
        title: 'Fuse NPS, support tickets, and usage drop-off into one account view',
        description: 'Consolidate fragmented educator signals into a single at-risk account view.',
        status: 'in_progress',
        priority: 'high',
        dueDate: '+6d',
        assignee: 'nicolas-faure',
        why: 'Fragmented signals are why renewal risk today surfaces too late to act.',
      },
      {
        slug: 'edu-loop-save-plays',
        title: 'Write renewal-save plays for the top 3 churn patterns',
        description: 'Turn each churn pattern into a concrete play a CSM can run this week.',
        status: 'in_progress',
        priority: 'high',
        dueDate: '+12d',
        assignee: 'lea-martin',
        why: 'The loop must end in an action a CSM runs this week, not a score.',
      },
      {
        slug: 'edu-loop-partner-echo',
        title: 'Extend educator signals to partner-managed accounts',
        description: 'Bring partner-held accounts into the same voice-of-educator signal model.',
        status: 'todo',
        priority: 'medium',
        dueDate: '+30d',
        assignee: 'zoe-perrin',
        why: 'Partner-held accounts are the blind spot with the highest churn surprise rate.',
      },
    ],
    decisions: [
      {
        slug: 'edu-loop-intervention-owner',
        title: 'Assign single intervention owner per flagged account',
        status: 'approved',
        decisionMaker: 'thomas-viau',
        deadline: '-3d',
        rationale:
          'Shared ownership of at-risk accounts produced no ownership; one name per account was approved.',
      },
    ],
    milestones: [
      {
        slug: 'edu-loop-signal-live',
        name: 'Signal model live for top 50 accounts',
        description: 'The voice-of-educator model is live for the top 50 accounts.',
        targetDate: '-8d',
        status: 'DONE',
      },
      {
        slug: 'edu-loop-first-saves',
        name: 'First renewal-save cohort reviewed',
        description: 'The first cohort of renewal-save interventions is reviewed for impact.',
        targetDate: '+20d',
        status: 'IN_PROGRESS',
      },
    ],
  },
  {
    slug: 'esg-traceability-program',
    projectSlug: 'forward-pmo',
    name: 'ESG Traceability & Carbon Baseline',
    area: 'Sustainability',
    summary:
      'Turn FSC, ISO 14001, and supplier origin data into an audit-ready traceability ledger and product carbon baseline buyers can verify.',
    status: 'APPROVED',
    currentStage: 'Business Case',
    priority: 'medium',
    plannedStart: '-25d',
    plannedEnd: '+90d',
    ownerBusiness: 'isabelle-leroy',
    ownerExecution: 'elise-robert',
    sponsor: 'jean-claude-laurent',
    expectedRoi: 97,
    budgetCapex: 28000,
    budgetOpex: 46000,
    deliverables: [
      'Digital chain-of-custody ledger',
      'Product carbon baseline (Core + Motion)',
      'Distributor-facing ESG evidence pack',
    ],
    successCriteria: [
      '100% FSC chain-of-custody digitally traceable',
      'Product carbon baseline published for Core and Motion lines',
      'ESG evidence pack accepted by top 5 distributors',
    ],
    keyRisks: [
      'ESG treated as marketing brochure instead of evidence',
      'Supplier data gaps below tier 1',
      'Carbon baseline methodology challenged by buyers',
    ],
    tasks: [
      {
        slug: 'esg-supplier-data-join',
        title: 'Extend supplier scorecards with origin and FSC custody fields',
        description:
          'Reuse the control-tower supplier records to carry origin and FSC chain-of-custody data.',
        status: 'in_progress',
        priority: 'medium',
        dueDate: '+9d',
        assignee: 'mathieu-chevalier',
        why: 'The control tower already holds the supplier records; ESG must reuse them, not build a parallel database.',
      },
      {
        slug: 'esg-carbon-method',
        title: 'Select carbon-baseline methodology for wooden and PCBA components',
        description: 'Choose a carbon-accounting method that survives distributor audit.',
        status: 'todo',
        priority: 'medium',
        dueDate: '+28d',
        assignee: 'elise-robert',
        why: 'A challenged methodology is worse than no claim; the method must survive buyer audit.',
      },
    ],
    decisions: [
      {
        slug: 'esg-buyer-asset',
        title: 'Approve packaging ESG evidence as a commercial buyer asset',
        status: 'approved',
        decisionMaker: 'jean-claude-laurent',
        deadline: '-5d',
        rationale:
          'Certifications the company already holds should work commercially, not sit in a compliance drawer.',
      },
      {
        slug: 'esg-scope-boundary',
        title: 'Set carbon baseline boundary (own plants vs tier-1 suppliers)',
        status: 'pending',
        decisionMaker: 'claire-laurent',
        deadline: '+22d',
        rationale: 'Boundary choice drives cost and credibility; finance must own the trade-off.',
      },
    ],
    milestones: [
      {
        slug: 'esg-ledger-design',
        name: 'Traceability ledger design approved',
        description: 'The digital chain-of-custody ledger design is approved.',
        targetDate: '-5d',
        status: 'DONE',
      },
      {
        slug: 'esg-baseline-draft',
        name: 'Carbon baseline draft ready',
        description: 'A draft product carbon baseline for Core and Motion is ready for review.',
        targetDate: '+35d',
        status: 'PENDING',
      },
    ],
  },
  {
    slug: 'innovation-gate-pipeline',
    projectSlug: 'forward-pmo',
    name: 'Innovation Stage-Gate Pipeline',
    area: 'Innovation',
    summary:
      'Install a stage-gate funnel with explicit kill criteria so concept bets reach evidence gates before consuming design and partner bandwidth.',
    status: 'PLANNING',
    priority: 'medium',
    plannedStart: '+5d',
    plannedEnd: '+100d',
    ownerBusiness: 'nicolas-faure',
    ownerExecution: 'amelie-girard',
    sponsor: 'julien-moreau',
    expectedRoi: 124,
    budgetCapex: 15000,
    budgetOpex: 48000,
    deliverables: [
      'Stage-gate framework with kill criteria',
      'Concept funnel board',
      'Quarterly innovation portfolio review',
    ],
    successCriteria: [
      'Every concept passes an evidence gate before design spend',
      'Kill decision within 30 days of failed gate',
      'Two gated concepts reach business case per year',
    ],
    keyRisks: [
      'Gates become bureaucracy that kills speed',
      'Pet projects bypass the funnel',
      'Kill criteria negotiated after the fact',
    ],
    tasks: [
      {
        slug: 'gate-criteria-definition',
        title: 'Define gate evidence criteria and kill thresholds',
        description:
          'Set the evidence bar and kill thresholds for each stage gate before the next concept bet.',
        status: 'in_progress',
        priority: 'high',
        dueDate: '+18d',
        assignee: 'nicolas-faure',
        why: 'The Classroom Community App showed what a late stop costs; criteria must be set before the next bet, not during it.',
      },
      {
        slug: 'gate-motion-lab-onboard',
        title: 'Run Atelier Motion Concept Lab through Gate 1 as first tenant',
        description:
          'Prove the funnel on a live concept by putting the Motion Concept Lab through Gate 1.',
        status: 'todo',
        priority: 'medium',
        dueDate: '+45d',
        assignee: 'amelie-girard',
        why: 'A framework proves itself on a live concept, not a slideware example.',
      },
    ],
    decisions: [
      {
        slug: 'gate-funnel-adoption',
        title: 'Adopt stage-gate funnel for all new concept work',
        status: 'pending',
        decisionMaker: 'julien-moreau',
        deadline: '+24d',
        rationale:
          'One funnel prevents pet-project side doors, but the CTO must confirm it will not slow validated bets.',
      },
    ],
    milestones: [
      {
        slug: 'gate-framework-ready',
        name: 'Gate framework and kill criteria approved',
        description: 'The stage-gate framework and kill criteria are approved for use.',
        targetDate: '+18d',
        status: 'PENDING',
      },
      {
        slug: 'gate-first-review',
        name: 'First quarterly portfolio review held',
        description: 'The first quarterly innovation portfolio review runs through the new gates.',
        targetDate: '+60d',
        status: 'PENDING',
        isGate: true,
      },
    ],
  },
  {
    slug: 'data-governance-backbone',
    projectSlug: 'forward-pmo',
    name: 'Data Governance Backbone',
    area: 'Data',
    summary:
      'Give the top 25 KPI definitions one owner, one source, and one lineage so every value claim in the portfolio is defensible.',
    status: 'in_progress',
    priority: 'high',
    plannedStart: '-70d',
    plannedEnd: '+50d',
    ownerBusiness: 'claire-laurent',
    ownerExecution: 'paul-lambert',
    sponsor: 'antoine-laurent',
    expectedRoi: 105,
    budgetCapex: 60000,
    budgetOpex: 90000,
    deliverables: [
      'KPI definition registry (top 25)',
      'Data lineage map for board scorecard',
      'Telemetry quality monitor for plant feeds',
    ],
    successCriteria: [
      'Top 25 KPI definitions owned, documented, monitored',
      'Zero definition conflicts in board scorecard',
      'Telemetry trust score above 95% on Line 3 feeds',
    ],
    keyRisks: [
      'Treated as documentation instead of management infrastructure',
      'Definition owners assigned but not empowered',
      'Shadow spreadsheets keep competing with governed sources',
    ],
    tasks: [
      {
        slug: 'data-kpi-registry',
        title: 'Publish owned definitions for the top 25 portfolio KPIs',
        description:
          'Give OEE, lead-time variance, ARR, and 22 more KPIs exactly one defended definition.',
        status: 'in_progress',
        priority: 'high',
        dueDate: '+15d',
        assignee: 'paul-lambert',
        why: 'OEE, lead-time variance, and ARR are quoted in every forum; each needs exactly one defended definition.',
      },
      {
        slug: 'data-telemetry-trust',
        title: 'Stand up telemetry quality monitor for Line 3 feeds',
        description: 'Monitor plant telemetry quality so the Twin OEE claims are bankable.',
        status: 'in_progress',
        priority: 'high',
        dueDate: '+11d',
        assignee: 'luc-rousseau',
        why: "The Twin's OEE claims are only bankable if the underlying sensor data is trusted.",
      },
      {
        slug: 'data-board-lineage',
        title: 'Trace lineage for every number in the board scorecard',
        description: 'Document the source and lineage of every metric on the board scorecard.',
        status: 'todo',
        priority: 'medium',
        dueDate: '+30d',
        assignee: 'elise-robert',
        why: 'One challenged number in front of the board discredits the whole scorecard.',
      },
    ],
    decisions: [
      {
        slug: 'data-definition-authority',
        title: 'Grant Industrial Data Lead authority to block funding gates on missing baselines',
        status: 'approved',
        decisionMaker: 'antoine-laurent',
        deadline: '-6d',
        rationale:
          'Evidence owners without blocking authority get politely ignored; the CEO made the mandate explicit.',
      },
      {
        slug: 'data-source-of-truth',
        title: 'Designate governed sources as sole input for board reporting',
        status: 'pending',
        decisionMaker: 'claire-laurent',
        deadline: '+20d',
        rationale: 'Shadow spreadsheets survive until finance closes the side door.',
      },
    ],
    milestones: [
      {
        slug: 'data-top10-owned',
        name: 'First 10 KPI definitions owned and live',
        description: 'The first 10 of the top-25 KPI definitions are owned and live.',
        targetDate: '-20d',
        status: 'DONE',
      },
      {
        slug: 'data-registry-complete',
        name: 'Full top-25 registry complete',
        description: 'The complete top-25 KPI definition registry is published.',
        targetDate: '+15d',
        status: 'IN_PROGRESS',
      },
      {
        slug: 'data-board-certified',
        name: 'Board scorecard fully lineage-certified',
        description: 'Every number on the board scorecard is lineage-certified.',
        targetDate: 'nextBoardMeeting-1d',
        status: 'PENDING',
        isGate: true,
      },
    ],
  },
];

export const atelierToysReports: DemoStatusReportTemplate[] = [
  {
    slug: 'board-qbr',
    title: 'Board QBR: Atelier Forward momentum',
    projectSlug: 'forward-pmo',
    health: 'amber',
    period: 'currentQuarter',
    createdBy: 'antoine-laurent',
    createdAt: '-4d',
    content:
      'Atelier Forward is on track on strategic milestones, but plant telemetry quality and supplier volatility remain the two board-level watch items.',
  },
  {
    slug: 'factory-weekly',
    title: 'Factory Operations Weekly',
    projectSlug: 'factory-excellence',
    health: 'amber',
    period: 'week',
    createdBy: 'marc-dubois',
    createdAt: '-2d',
    content:
      'OEE improved 2.3 points week over week. Biggest drag remains unplanned stops on heat-treatment and inconsistent changeover discipline.',
  },
  {
    slug: 'digital-growth-pulse',
    title: 'Digital Growth Pulse',
    projectSlug: 'digital-growth',
    health: 'green',
    period: 'month',
    createdBy: 'camille-dubois',
    createdAt: '-1d',
    content:
      'Atelier Digital attach rate is up 7 points in pilot partners, with strongest uplift where onboarding assets include Digital Twin story.',
  },
  {
    slug: 'quality-monthly',
    title: 'Quality Monthly Review',
    projectSlug: 'quality-excellence',
    health: 'amber',
    period: 'month',
    createdBy: 'sophie-bernard',
    createdAt: '-3d',
    content:
      'Recurring defect patterns are narrowing, but cross-plant corrective-action closure is still too slow on high-impact issues.',
  },
  {
    slug: 'partner-cohort-review',
    title: 'Partner Cohort Review',
    projectSlug: 'partner-expansion',
    health: 'green',
    period: 'fortnight',
    createdBy: 'zoe-perrin',
    createdAt: '-2d',
    content:
      'The first onboarding cohort shows faster demo readiness and stronger bundle positioning when the case story is included early.',
  },
  {
    slug: 'academy-adoption-pulse',
    title: 'Capability Academy Adoption Pulse',
    projectSlug: 'people-capability',
    health: 'green',
    period: 'week',
    createdBy: 'amelie-girard',
    createdAt: '-1d',
    content:
      'Managers are engaging well with daily review routines, but escalation quality still varies significantly by function.',
  },
  {
    slug: 'board-pre-read',
    title: 'Board Pre-read: value and risk signal pack',
    projectSlug: 'board-governance',
    health: 'amber',
    period: 'nextBoardMeeting',
    createdBy: 'hugo-bernard',
    createdAt: 'nextBoardMeeting-3d',
    content:
      'The board should focus on Line 3 scale-up, margin protection from supplier volatility, and the evidence behind realized value.',
  },
];

export const atelierToysKnowledgeDocs: DemoKnowledgeDocTemplate[] = [
  {
    slug: 'forward-charter',
    title: 'Atelier Forward charter',
    category: 'strategy',
    body: 'Atelier Forward connects factory excellence, SaaS growth, and leadership governance into one transformation portfolio with explicit ROI and risk ownership.',
  },
  {
    slug: 'line3-root-causes',
    title: 'Line 3 downtime root-cause analysis',
    category: 'operations',
    body: 'Top downtime drivers are heat-treatment micro-stops, delayed maintenance dispatch, and inconsistent changeover handoffs between shifts.',
  },
  {
    slug: 'partner-growth-story',
    title: 'Partner growth story for Atelier Digital',
    category: 'growth',
    body: 'Partners convert best when the story moves from hardware sale to recurring educator outcomes, usage data, and Digital Twin-backed service value.',
  },
  {
    slug: 'board-scorecard-logic',
    title: 'Board scorecard logic',
    category: 'governance',
    body: 'The board scorecard combines realized ROI, confidence-weighted future value, operational signal stability, and follow-up discipline after decisions.',
  },
  {
    slug: 'qa-defect-patterns',
    title: 'QA defect pattern log',
    category: 'quality',
    body: 'Top repeat patterns involve packaging tolerance drift, onboarding instruction mismatch, and release timing between digital bundle assets and hardware availability.',
  },
  {
    slug: 'partner-objection-handling',
    title: 'Partner objection handling notes',
    category: 'commercial',
    body: 'The most common objections are around renewal certainty, educator activation, and whether Digital Twin is a premium add-on or a core value narrative.',
  },
  {
    slug: 'academy-retro-notes',
    title: 'Supervisor academy retrospective',
    category: 'people',
    body: 'Supervisors respond best to routines tied to live initiatives, real escalations, and visible scorecards instead of generic training content.',
  },
  {
    slug: 'supplier-risk-scenarios',
    title: 'Supplier risk scenarios',
    category: 'supply-chain',
    body: 'The highest-risk scenarios involve motion sensor shortages, freight disruption, and design-change lag creating false confidence in delivery commitments.',
  },
  {
    slug: 'product-roadmap-options',
    title: 'Product roadmap option memo',
    category: 'product',
    body: 'Roadmap options compare adoption-first improvements, analytics depth, and bundle packaging upgrades with explicit effort and revenue trade-offs.',
  },
  {
    slug: 'line3-pilot-retro',
    title: 'Line 3 pilot retrospective',
    category: 'operations',
    body: 'The pilot confirmed supervisor appetite for faster alerts, but trust depends on reducing noisy recommendations during shift handovers.',
  },
];

export const atelierToysPrompts: DemoPromptTemplate[] = [
  {
    slug: 'ceo-brief',
    name: 'CEO Board Brief',
    context: 'Executive summary',
    template:
      'Summarize Atelier Forward for Antoine Laurent: progress, risks, ROI, and what the board must decide next.',
    createdBy: 'antoine-laurent',
  },
  {
    slug: 'cfo-margin-risks',
    name: 'CFO Margin Risk Review',
    context: 'Finance',
    template:
      'Act as Claire Laurent and review margin leakage drivers, supplier volatility, and capital allocation trade-offs.',
    createdBy: 'claire-laurent',
  },
  {
    slug: 'cto-scale-plan',
    name: 'CTO Scale Plan',
    context: 'Technology and product',
    template:
      'Act as Julien Moreau and prepare a scale-up plan for Digital Twin and Atelier Digital with dependencies and guardrails.',
    createdBy: 'julien-moreau',
  },
  {
    slug: 'plant-manager-bottlenecks',
    name: 'Plant Bottleneck Review',
    context: 'Operations',
    template:
      'Act as Marc Dubois and explain the three biggest throughput bottlenecks, current countermeasures, and where leadership support is needed.',
    createdBy: 'marc-dubois',
  },
  {
    slug: 'qa-close-loop',
    name: 'QA Close-the-Loop Brief',
    context: 'Quality',
    template:
      'Act as Sophie Bernard and summarize defect recurrence, corrective-action performance, and launch quality risks for the executive team.',
    createdBy: 'sophie-bernard',
  },
  {
    slug: 'partner-growth-coach',
    name: 'Partner Growth Coach',
    context: 'Commercial',
    template:
      'Act as Thomas Viau and coach the team on increasing partner activation, attach rate, and objection handling for Atelier Digital bundles.',
    createdBy: 'thomas-viau',
  },
  {
    slug: 'board-pre-read-copilot',
    name: 'Board Pre-read Copilot',
    context: 'Governance',
    template:
      'Prepare a concise board pre-read for Antoine and Jean-Claude: value signal, risk signal, open decisions, and follow-up confidence.',
    createdBy: 'hugo-bernard',
  },
  {
    slug: 'supply-risk-simulator',
    name: 'Supply Risk Simulator',
    context: 'Supply Chain',
    template:
      'Act as Isabelle Leroy and simulate what happens to delivery promises, margin, and partner credibility if a key component lead time slips by 21 days.',
    createdBy: 'isabelle-leroy',
  },
  {
    slug: 'academy-retro-coach',
    name: 'Capability Academy Retro Coach',
    context: 'People',
    template:
      'Act as Claire Laurent and extract what the academy is changing in manager behavior, what is still weak, and what next action should follow.',
    createdBy: 'claire-laurent',
  },
];

export const atelierToysToolCoverage: DemoToolCoverage[] = [
  {
    tool: 'Executive overview',
    seededRecords: ['Board QBR', 'Forward PMO project', 'ROI-bearing initiatives'],
    userGoal: 'See the whole company on one screen.',
    ahaMoment: 'Strategy, operations, and finance are connected by evidence, not slides.',
    cta: 'Start trial to mirror this board view for your own organization.',
  },
  {
    tool: 'Portfolio & PMO',
    seededRecords: [
      '7 projects',
      '20 cross-functional initiatives',
      'Milestones, dependencies, and decision gates',
    ],
    userGoal: 'Trace why a strategic priority is late and who owns the unblock.',
    ahaMoment: 'Dependencies, decisions, and execution work are resolved in one workflow.',
    cta: 'Book a workshop to map your live portfolio into the same control tower.',
  },
  {
    tool: 'DRD assessment',
    seededRecords: [
      'Approved DRD baseline',
      'Executive assessment report',
      'Priority recommendation sections',
    ],
    userGoal: 'Understand current maturity, the biggest gaps, and what should be funded next.',
    ahaMoment:
      'Assessment is not a static survey because it flows directly into initiatives, governance, and value tracking.',
    cta: 'Run the same DRD baseline for your team and turn findings into a live portfolio.',
  },
  {
    tool: 'Factory operations',
    seededRecords: ['Line 3 Digital Twin initiative', 'Ops report', 'Maintenance tasks'],
    userGoal: 'Understand operational losses and the next high-leverage action.',
    ahaMoment: 'Plant data becomes a business decision system, not a separate dashboard.',
    cta: 'Run a guided assessment for your plant or operations team.',
  },
  {
    tool: 'AI workspace',
    seededRecords: [
      '9 role-based prompts',
      '10+ knowledge docs',
      'Leadership and specialist personas',
    ],
    userGoal: 'Ask the system for a role-specific answer with business context.',
    ahaMoment: 'AI answers are grounded in the company story and execution data.',
    cta: 'Start trial and upload your own context to create a private workspace.',
  },
  {
    tool: 'Quality cockpit',
    seededRecords: ['QA defect initiative', 'Quality monthly report', 'Defect pattern documents'],
    userGoal:
      'See where quality risk is repeating and which corrective actions are actually closing.',
    ahaMoment: 'Quality becomes part of the main operating system, not a separate side process.',
    cta: 'Use trial to connect your own incidents, initiatives, and leadership reviews.',
  },
  {
    tool: 'Partner growth',
    seededRecords: [
      'Partner onboarding initiative',
      'Partner cohort report',
      'Commercial playbooks',
    ],
    userGoal: 'Understand how onboarding and enablement translate into real channel growth.',
    ahaMoment: 'The system connects onboarding behavior to expansion outcomes and references.',
    cta: 'Request a custom demo focused on your channel or partner-led motion.',
  },
  {
    tool: 'Board governance',
    seededRecords: [
      'Board value tracking initiative',
      'Pre-read report',
      'Decision follow-up artifacts',
    ],
    userGoal: 'Prepare leadership and board conversations using current operating evidence.',
    ahaMoment: 'Board prep becomes an always-on workflow instead of a monthly scramble.',
    cta: 'Start trial to create your own board-ready control tower.',
  },
];

export const atelierToysDemoScenarios: DemoScenario[] = [
  {
    id: 'executive-overview',
    title: 'Executive Overview',
    duration: '8 min',
    audience: 'CEO, CFO, board',
    persona: 'Antoine Laurent (CEO)',
  },
  {
    id: 'factory-operations',
    title: 'Factory Operations',
    duration: '10 min',
    audience: 'Plant leaders, operations excellence',
    persona: 'Marc Dubois (Plant Manager)',
  },
  {
    id: 'digital-growth',
    title: 'Digital Product Growth',
    duration: '8 min',
    audience: 'Sales, marketing, product',
    persona: 'Camille Dubois (Marketing Director)',
  },
  {
    id: 'drd-baseline',
    title: 'DRD Baseline',
    duration: '9 min',
    audience: 'Transformation leaders, advisors, operations executives',
    persona: 'Antoine Laurent (CEO)',
  },
  {
    id: 'quality-cockpit',
    title: 'Quality Cockpit',
    duration: '9 min',
    audience: 'Quality, operations, engineering',
    persona: 'Sophie Bernard (QA Director)',
  },
  {
    id: 'partner-expansion',
    title: 'Partner Expansion',
    duration: '8 min',
    audience: 'Sales, channel, customer success',
    persona: 'Thomas Viau (VP Sales)',
  },
  {
    id: 'board-governance',
    title: 'Board Governance',
    duration: '7 min',
    audience: 'CEO, PMO, board office',
    persona: 'Hugo Bernard (Transformation Analyst)',
  },
];

function localizeBySlug<T extends { slug: string }>(
  items: T[],
  locale: DemoLocale,
  translations: Record<string, Partial<T>>
): T[] {
  if (locale === 'en') return items;
  return items.map((item) => ({ ...item, ...(translations[item.slug] || {}) }));
}

function localizeInitiatives(locale: DemoLocale): DemoInitiativeTemplate[] {
  if (locale === 'en') return atelierToysInitiatives;

  return atelierToysInitiatives.map((initiative) => {
    const localized = atelierToysInitiativePL[initiative.slug] || {};
    const localizedTasks = localized.tasks || {};
    const localizedDecisions = localized.decisions || {};
    const localizedMilestones = localized.milestones || {};

    return {
      ...initiative,
      ...localized,
      tasks: initiative.tasks.map((task) => ({ ...task, ...(localizedTasks[task.slug] || {}) })),
      decisions: initiative.decisions.map((decision) => ({
        ...decision,
        ...(localizedDecisions[decision.slug] || {}),
      })),
      milestones: initiative.milestones.map((milestone) => ({
        ...milestone,
        ...(localizedMilestones[milestone.slug] || {}),
      })),
    };
  });
}

function localizeScenarios(locale: DemoLocale): DemoScenario[] {
  if (locale === 'en') return atelierToysDemoScenarios;
  return atelierToysDemoScenarios.map((scenario) => ({
    ...scenario,
    ...(atelierToysScenarioPL[scenario.id] || {}),
  }));
}

function localizeToolCoverage(locale: DemoLocale): DemoToolCoverage[] {
  if (locale === 'en') return atelierToysToolCoverage;
  return atelierToysToolCoverage.map((item) => ({
    ...item,
    ...(atelierToysToolCoveragePL[item.tool] || {}),
  }));
}

export function getAtelierToysLeadership(locale: DemoLocale = 'en'): DemoLeaderTemplate[] {
  return localizeBySlug(atelierToysLeadership, locale, atelierToysLeaderPL);
}

export function getAtelierToysProjects(locale: DemoLocale = 'en'): DemoProjectTemplate[] {
  return localizeBySlug(atelierToysProjects, locale, atelierToysProjectPL);
}

export function getAtelierToysInitiatives(locale: DemoLocale = 'en'): DemoInitiativeTemplate[] {
  return localizeInitiatives(locale);
}

export function getAtelierToysReports(locale: DemoLocale = 'en'): DemoStatusReportTemplate[] {
  return localizeBySlug(atelierToysReports, locale, atelierToysReportPL);
}

export function getAtelierToysKnowledgeDocs(locale: DemoLocale = 'en'): DemoKnowledgeDocTemplate[] {
  return localizeBySlug(atelierToysKnowledgeDocs, locale, atelierToysKnowledgeDocPL);
}

export function getAtelierToysPrompts(locale: DemoLocale = 'en'): DemoPromptTemplate[] {
  return localizeBySlug(atelierToysPrompts, locale, atelierToysPromptPL);
}

export function getAtelierToysToolCoverage(locale: DemoLocale = 'en'): DemoToolCoverage[] {
  return localizeToolCoverage(locale);
}

export function getAtelierToysDemoScenarios(locale: DemoLocale = 'en'): DemoScenario[] {
  return localizeScenarios(locale);
}

// ============================================================================
// SPINE DATA — the "Ateliertoy Forward (2015)" discovery → value story.
// Five discovery interviews feed one cross-interview insight; the insight
// produces three findings that hand off to the three flagship initiatives
// (Line 3 Digital Twin, Procurement Control Tower, Atelier Digital growth).
// Those initiatives carry Results KPIs, Rollout artifacts, and an executive
// deliverable — every record references a slug already in the portfolio so the
// same IDs flow through the full spine.
// ============================================================================

export const atelierToysInterviews: DemoInterviewTemplate[] = [
  {
    slug: 'discovery-plant-manager',
    respondent: 'marc-dubois',
    owner: 'antoine-laurent',
    name: 'Discovery — Plant Manager (Operations)',
    progress: { strategy: 60, operations: 100, digital: 70, people: 80, finance: 40 },
    totalQuestions: 24,
    answeredQuestions: 22,
    facts: [
      { category: 'operations', fact: 'OEE on bottleneck Line 4 sits at 74% vs an 82% target.' },
      {
        category: 'digital',
        fact: 'Plant telemetry is live on key lines but event taxonomy is not stable enough to scale.',
      },
      {
        category: 'operations',
        fact: 'Changeover is the single biggest throughput loss on Line 3.',
      },
    ],
    painPoints: [
      {
        category: 'operations',
        painPoint: 'Maintenance is still mostly reactive firefighting, not predictive.',
      },
      {
        category: 'digital',
        painPoint: 'Supervisors cannot trust live signal quality, so they fall back to paper.',
      },
    ],
    gaps: [
      { category: 'finance', gap: 'No agreed business case for scaling the Line 3 digital twin.' },
    ],
    startedDaysAgo: 38,
  },
  {
    slug: 'discovery-procurement-director',
    respondent: 'isabelle-leroy',
    owner: 'antoine-laurent',
    name: 'Discovery — Procurement Director (Supply Chain)',
    progress: { strategy: 50, operations: 90, digital: 60, people: 50, finance: 70 },
    totalQuestions: 22,
    answeredQuestions: 20,
    facts: [
      {
        category: 'operations',
        fact: 'Raw-material lead times swing by up to 6 weeks with no early-warning signal.',
      },
      {
        category: 'finance',
        fact: 'Single-source dependency on two critical suppliers creates margin volatility.',
      },
    ],
    painPoints: [
      {
        category: 'operations',
        painPoint: 'Supplier risk is discovered late, usually only when a line is already starved.',
      },
    ],
    gaps: [
      {
        category: 'digital',
        gap: 'No supplier scorecard or control tower to consolidate signals.',
      },
    ],
    startedDaysAgo: 34,
  },
  {
    slug: 'discovery-vp-sales',
    respondent: 'thomas-viau',
    owner: 'antoine-laurent',
    name: 'Discovery — VP Sales (Commercial / Digital)',
    progress: { strategy: 80, operations: 30, digital: 90, people: 60, finance: 70 },
    totalQuestions: 20,
    answeredQuestions: 19,
    facts: [
      { category: 'digital', fact: 'Digital ARR is ~€6.2M against an €8M target.' },
      { category: 'strategy', fact: 'APAC subscription churn is 4.1% versus a sub-3% target.' },
    ],
    painPoints: [
      {
        category: 'digital',
        painPoint: 'Renewal insight is fragmented across teams, so churn signals arrive too late.',
      },
      {
        category: 'people',
        painPoint: 'Partner onboarding is inconsistent, slowing subscription attach rate.',
      },
    ],
    gaps: [{ category: 'finance', gap: 'No shared value logic linking renewals to roadmap bets.' }],
    startedDaysAgo: 30,
  },
  {
    slug: 'discovery-cfo',
    respondent: 'claire-laurent',
    owner: 'antoine-laurent',
    name: 'Discovery — CFO & Head of People (Finance)',
    progress: { strategy: 70, operations: 50, digital: 60, people: 80, finance: 100 },
    totalQuestions: 21,
    answeredQuestions: 21,
    facts: [
      {
        category: 'finance',
        fact: 'Finance and operations still reconcile value numbers manually before board reviews.',
      },
      {
        category: 'finance',
        fact: 'The board wants a single NPV/ROI view for the 3-year digitization program.',
      },
    ],
    painPoints: [
      {
        category: 'finance',
        painPoint: 'Portfolio prioritization leans on sponsor push, not a shared value case.',
      },
    ],
    gaps: [
      { category: 'digital', gap: 'No live link between initiative ROI and realized KPI results.' },
    ],
    startedDaysAgo: 27,
  },
  {
    slug: 'discovery-cto',
    respondent: 'julien-moreau',
    owner: 'antoine-laurent',
    name: 'Discovery — CTO (Technology / Digital)',
    progress: { strategy: 70, operations: 60, digital: 100, people: 50, finance: 50 },
    totalQuestions: 23,
    answeredQuestions: 21,
    facts: [
      {
        category: 'digital',
        fact: 'IRIS and the Digital Twin work as pilots but are not yet productized capabilities.',
      },
      { category: 'digital', fact: 'OT/IT segmentation is uneven across sites.' },
    ],
    painPoints: [
      {
        category: 'digital',
        painPoint: 'Legacy ERP integration limits digital product velocity.',
      },
    ],
    gaps: [
      { category: 'people', gap: 'No capability academy to sustain supervisor-level adoption.' },
    ],
    startedDaysAgo: 24,
  },
];

export const atelierToysInsights: DemoInsightTemplate[] = [
  {
    slug: 'forward-2015-discovery-synthesis',
    title: 'Ateliertoy Forward — Discovery Synthesis (2015 baseline)',
    promptType: 'recommendations',
    sourceInterviews: [
      'discovery-plant-manager',
      'discovery-procurement-director',
      'discovery-vp-sales',
      'discovery-cfo',
      'discovery-cto',
    ],
    content: [
      '## Ateliertoy Forward — Discovery Synthesis',
      '',
      'Across five executive discovery interviews, three convergent themes define the 2015',
      'transformation baseline:',
      '',
      '1. **Operations need trustworthy live signal.** Line 3/4 telemetry exists but the event',
      '   taxonomy is unstable, so supervisors still run on paper and OEE sits at 74% vs 82% target.',
      '2. **Supply-chain risk is discovered too late.** Lead-time volatility and single-source',
      '   dependency create margin swings with no early-warning control tower.',
      '3. **Digital growth is throttled by fragmented renewal insight.** ARR is €6.2M vs €8M target',
      '   and APAC churn (4.1%) is detected after the fact.',
      '',
      'These three themes map directly to the three flagship initiatives of the program and form the',
      'evidence base for the board NPV/ROI business case.',
    ].join('\n'),
    createdBy: 'antoine-laurent',
    findings: [
      {
        slug: 'finding-line3-twin',
        findingStatement:
          'Line 3/4 lose throughput because telemetry is live but the event taxonomy is too unstable to act on, keeping OEE at 74% vs the 82% target.',
        confidence: 'high',
        limits:
          'Based on 5 discovery interviews and plant telemetry to date; not yet validated against a full quarter of stable signal.',
        nextAction:
          'Stand up the Line 3 Digital Twin rollout to stabilize the event taxonomy and recover OEE.',
        handoffInitiative: 'line-3-digital-twin',
      },
      {
        slug: 'finding-procurement-tower',
        findingStatement:
          'Supplier risk is detected only when a line is already starved, driven by lead-time volatility and single-source dependency on two critical suppliers.',
        confidence: 'high',
        limits:
          'Qualitative from procurement discovery; quantified supplier scorecards not yet in place.',
        nextAction:
          'Launch the Procurement Control Tower to consolidate supplier signals and add early-warning scorecards.',
        handoffInitiative: 'procurement-control-tower',
      },
      {
        slug: 'finding-digital-renewal',
        findingStatement:
          'Digital ARR is throttled at €6.2M (vs €8M target) because renewal insight is fragmented across teams and APAC churn (4.1%) surfaces too late.',
        confidence: 'moderate',
        limits:
          'Churn attribution is partial; renewal data is fragmented across systems pending consolidation.',
        nextAction:
          'Drive the Atelier Digital Subscription Expansion to unify renewal insight and protect ARR.',
        handoffInitiative: 'atelier-digital-growth',
      },
    ],
  },
];

export const atelierToysResultsKpis: DemoResultsKpiTemplate[] = [
  {
    slug: 'result-line3-oee',
    projectSlug: 'factory-excellence',
    initiativeSlug: 'line-3-digital-twin',
    name: 'Line 3 OEE',
    category: 'QUALITY',
    description: 'Overall Equipment Effectiveness on Line 3 after digital twin rollout.',
    baselineValue: 74,
    currentValue: 80,
    targetValue: 82,
    unit: '%',
    trend: 'IMPROVING',
    thresholdDirection: 'HIGHER_IS_BETTER',
    owner: 'marc-dubois',
    historical: [
      { date: '2015-01-01', value: 74 },
      { date: '2015-04-01', value: 76 },
      { date: '2015-07-01', value: 78 },
      { date: '2015-10-01', value: 80 },
    ],
  },
  {
    slug: 'result-procurement-leadtime',
    projectSlug: 'forward-pmo',
    initiativeSlug: 'procurement-control-tower',
    name: 'Supplier lead-time variance',
    category: 'RISK',
    description: 'Variance in raw-material lead time after the control tower went live.',
    baselineValue: 6,
    currentValue: 3,
    targetValue: 2,
    unit: 'weeks',
    trend: 'IMPROVING',
    thresholdDirection: 'LOWER_IS_BETTER',
    owner: 'isabelle-leroy',
    historical: [
      { date: '2015-01-01', value: 6 },
      { date: '2015-04-01', value: 5 },
      { date: '2015-07-01', value: 4 },
      { date: '2015-10-01', value: 3 },
    ],
  },
  {
    slug: 'result-digital-arr',
    projectSlug: 'digital-growth',
    initiativeSlug: 'atelier-digital-growth',
    name: 'Digital ARR',
    category: 'SCOPE',
    description: 'Annual recurring revenue from Atelier Digital subscriptions.',
    baselineValue: 6.2,
    currentValue: 7.4,
    targetValue: 8,
    unit: '€M',
    trend: 'IMPROVING',
    thresholdDirection: 'HIGHER_IS_BETTER',
    owner: 'thomas-viau',
    historical: [
      { date: '2015-01-01', value: 6.2 },
      { date: '2015-04-01', value: 6.6 },
      { date: '2015-07-01', value: 7.0 },
      { date: '2015-10-01', value: 7.4 },
    ],
  },
];

export const atelierToysRolloutKpis: DemoRolloutKpiTemplate[] = [
  {
    slug: 'rollout-line3-adoption',
    projectSlug: 'factory-excellence',
    name: 'Line 3 supervisor adoption',
    baseline: 0,
    target: 100,
    current: 70,
    unit: '%',
    createdBy: 'marc-dubois',
  },
  {
    slug: 'rollout-procurement-scorecards',
    projectSlug: 'forward-pmo',
    name: 'Suppliers on live scorecards',
    baseline: 0,
    target: 100,
    current: 60,
    unit: '%',
    createdBy: 'isabelle-leroy',
  },
];

export const atelierToysRolloutRisks: DemoRolloutRiskTemplate[] = [
  {
    slug: 'rollout-risk-signal-quality',
    projectSlug: 'factory-excellence',
    title: 'Telemetry signal quality regresses during scale-up',
    probability: 'medium',
    impact: 'high',
    mitigation: 'Lock the event taxonomy before scaling and add automated signal-quality checks.',
    status: 'OPEN',
    owner: 'julien-moreau',
  },
];

export const atelierToysRolloutChanges: DemoRolloutChangeTemplate[] = [
  {
    slug: 'rollout-change-changeover-standard',
    projectSlug: 'factory-excellence',
    title: 'Standardized changeover procedure for Line 3',
    type: 'process',
    status: 'APPROVED',
    impact: 'Reduces changeover loss, supporting the OEE recovery target.',
    approvedBy: 'marc-dubois',
  },
];

export const atelierToysRolloutClosures: DemoRolloutClosureTemplate[] = [
  {
    slug: 'rollout-closure-line3-handover',
    projectSlug: 'factory-excellence',
    title: 'Line 3 Digital Twin operations handover',
    category: 'handover',
    status: 'OPEN',
    dueInDays: 21,
  },
];

export const atelierToysDeliverables: DemoDeliverableTemplate[] = [
  {
    slug: 'forward-2015-board-readout',
    outputType: 'presentation',
    deliveryState: 'ready',
    templateFamily: 'executive-board-readout',
    sourceInitiative: 'line-3-digital-twin',
    createdBy: 'antoine-laurent',
    exportFormat: 'pdf',
  },
  {
    slug: 'forward-2015-roi-report',
    outputType: 'report',
    deliveryState: 'shared',
    templateFamily: 'value-realization-report',
    sourceInitiative: 'line-3-digital-twin',
    createdBy: 'hugo-bernard',
    exportFormat: 'pdf',
  },
];

export function getAtelierToysInterviews(): DemoInterviewTemplate[] {
  return atelierToysInterviews;
}

export function getAtelierToysInsights(): DemoInsightTemplate[] {
  return atelierToysInsights;
}

export function getAtelierToysResultsKpis(): DemoResultsKpiTemplate[] {
  return atelierToysResultsKpis;
}

export function getAtelierToysRolloutArtifacts(): {
  kpis: DemoRolloutKpiTemplate[];
  risks: DemoRolloutRiskTemplate[];
  changes: DemoRolloutChangeTemplate[];
  closures: DemoRolloutClosureTemplate[];
} {
  return {
    kpis: atelierToysRolloutKpis,
    risks: atelierToysRolloutRisks,
    changes: atelierToysRolloutChanges,
    closures: atelierToysRolloutClosures,
  };
}

export function getAtelierToysDeliverables(): DemoDeliverableTemplate[] {
  return atelierToysDeliverables;
}
