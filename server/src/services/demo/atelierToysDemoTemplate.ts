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
  {
    slug: 'emma-noel',
    firstName: 'Emma',
    lastName: 'Noel',
    role: 'USER',
    title: 'Learning Experience Manager',
    department: 'Education Programs',
    focus: 'Improve educator onboarding quality and content completion rates.',
  },
  {
    slug: 'damien-petit',
    firstName: 'Damien',
    lastName: 'Petit',
    role: 'MANAGER',
    title: 'Manufacturing Excellence Lead',
    department: 'Operations',
    focus: 'Scale standard work and reduce variability across production lines.',
  },
  {
    slug: 'ines-garnier',
    firstName: 'Ines',
    lastName: 'Garnier',
    role: 'USER',
    title: 'Revenue Operations Analyst',
    department: 'Commercial',
    focus: 'Connect pipeline signals with renewal and attach-rate outcomes.',
  },
  {
    slug: 'victor-morin',
    firstName: 'Victor',
    lastName: 'Morin',
    role: 'MANAGER',
    title: 'OT Security Program Lead',
    department: 'Cybersecurity',
    focus: 'Operationalize plant OT controls and reduce cross-site risk variance.',
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
    status: 'TRACKING',
    currentStage: 'Value Tracking',
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
    status: 'APPROVED',
    currentStage: 'Implementation Planning',
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
        status: 'todo',
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
    status: 'DRAFT',
    currentStage: 'Discovery',
    priority: 'medium',
    plannedStart: '+10d',
    plannedEnd: '+95d',
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
        status: 'todo',
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
        status: 'PENDING',
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
    status: 'APPROVED',
    currentStage: 'Execution Readiness',
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
        status: 'todo',
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
    status: 'TRACKING',
    currentStage: 'Adoption Monitoring',
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
    plannedStart: '+14d',
    plannedEnd: '+95d',
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
        status: 'todo',
        priority: 'high',
        dueDate: '+6d',
        assignee: 'paul-lambert',
        why: 'The initiative is approved, but implementation cannot start without one agreed baseline.',
      },
      {
        slug: 'ot-cyber-segmentation-plan',
        title: 'Build OT network segmentation rollout plan for both plants',
        description:
          'Define zone model, sequence, downtime windows, and fallback controls for phased rollout.',
        status: 'todo',
        priority: 'high',
        dueDate: '+14d',
        assignee: 'victor-morin',
        why: 'Segmentation is the highest leverage risk-reduction move and must be executable, not only documented.',
      },
      {
        slug: 'ot-cyber-incident-drill',
        title: 'Run tabletop OT incident drill with plant leadership',
        description:
          'Validate escalation routes, roles, and response readiness before broad rollout starts.',
        status: 'todo',
        priority: 'medium',
        dueDate: '+21d',
        assignee: 'damien-petit',
        why: 'Execution readiness requires tested response behavior, not policy-only sign-off.',
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
        status: 'PENDING',
      },
    ],
  },
  {
    slug: 'lyon-north-scheduler-pilot',
    projectSlug: 'factory-excellence',
    name: 'Lyon North Scheduler Pilot',
    area: 'Planning',
    summary: 'Schedule a pilot for a smarter production scheduler at Lyon North.',
    status: 'DRAFT',
    currentStage: 'Pilot Design',
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
      {
        slug: 'scheduler-simulation-scenarios',
        title: 'Prepare pilot simulation scenarios for demand and disruption shocks',
        description:
          'Model baseline, peak-demand, and supplier-delay cases to define robust scheduler behavior.',
        status: 'todo',
        priority: 'medium',
        dueDate: '+12d',
        assignee: 'paul-lambert',
        why: 'Simulation quality determines whether pilot outcomes are trustworthy for scale decisions.',
      },
      {
        slug: 'scheduler-adoption-playbook',
        title: 'Draft planner adoption playbook for pilot wave',
        description:
          'Define planner routines, exception handling, and daily governance for pilot operation.',
        status: 'todo',
        priority: 'medium',
        dueDate: '+18d',
        assignee: 'damien-petit',
        why: 'Adoption discipline is needed to separate tool value from process noise.',
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
        status: 'PENDING',
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
      {
        slug: 'warehouse-safety-gate-refresh',
        title: 'Refresh safety gate matrix for mixed manual-automation traffic',
        description:
          'Update safety controls, pedestrian routes, and exception handling before automation restart.',
        status: 'todo',
        priority: 'high',
        dueDate: '+12d',
        assignee: 'sophie-bernard',
        why: 'Safety sign-off is a hard prerequisite for any restart decision.',
      },
      {
        slug: 'warehouse-integrator-capacity-lock',
        title: 'Lock integrator capacity and phased installation windows',
        description:
          'Confirm supplier availability, sequence of work, and rollback windows to reduce schedule volatility.',
        status: 'todo',
        priority: 'medium',
        dueDate: '+16d',
        assignee: 'isabelle-leroy',
        why: 'Execution risk remains high until external capacity is contractually secured.',
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
      {
        slug: 'predictive-maintenance-alert-retune',
        title: 'Retune alert thresholds to reduce false positives by line',
        description:
          'Adjust model thresholds and operator escalation rules based on first-wave observed precision.',
        status: 'todo',
        priority: 'high',
        dueDate: '+9d',
        assignee: 'luc-rousseau',
        why: 'Alert fatigue directly lowers adoption and destroys value realization momentum.',
      },
      {
        slug: 'predictive-maintenance-operator-routines',
        title: 'Standardize operator response routines for predictive alerts',
        description:
          'Define response SLA, root-cause capture format, and shift handover evidence requirements.',
        status: 'todo',
        priority: 'medium',
        dueDate: '+15d',
        assignee: 'damien-petit',
        why: 'Realized value depends on operating behavior, not only model quality.',
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
    slug: 'enterprise-data-contract-control-plane',
    projectSlug: 'forward-pmo',
    name: 'Enterprise Data Contract Control Plane',
    area: 'Data Governance',
    summary:
      'Create one controlled data-contract layer across PMO, finance, plant telemetry, and partner workflows to reduce decision latency and metric drift.',
    status: 'APPROVED',
    currentStage: 'Execution Planning',
    priority: 'high',
    plannedStart: '-70d',
    plannedEnd: '+55d',
    ownerBusiness: 'claire-laurent',
    ownerExecution: 'paul-lambert',
    sponsor: 'antoine-laurent',
    expectedRoi: 176,
    budgetCapex: 68000,
    budgetOpex: 86000,
    deliverables: [
      'Data contract registry for top 40 metrics',
      'Cross-domain evidence lineage map',
      'Automated contract violation alerts',
    ],
    successCriteria: [
      'Board KPI reconciliation time -45%',
      'Metric definition conflicts reduced to under 3 per month',
      'Decision pack preparation lead time -30%',
    ],
    keyRisks: [
      'Teams bypass contract governance under deadline pressure',
      'Legacy extracts cannot publish required lineage metadata',
      'Ownership ambiguity between PMO and platform teams',
    ],
    tasks: [
      {
        slug: 'data-contract-top40-metrics',
        title: 'Lock contract definitions for top 40 executive and plant metrics',
        description:
          'Define owners, calculation logic, freshness SLA, and confidence policy for each critical metric.',
        status: 'todo',
        priority: 'high',
        dueDate: '+9d',
        assignee: 'elise-robert',
        why: 'Without locked definitions, value tracking remains arguable and board decisions slow down.',
      },
      {
        slug: 'data-contract-lineage-pack',
        title: 'Publish evidence lineage map from source signal to board pack',
        description:
          'Connect telemetry, finance, and PMO transformations so each number has traceable provenance.',
        status: 'todo',
        priority: 'high',
        dueDate: '+18d',
        assignee: 'hugo-bernard',
        why: 'Lineage transparency is required for trusted decisions and faster challenge resolution.',
      },
      {
        slug: 'data-contract-violation-alerts',
        title: 'Enable automated contract violation alerts for high-impact metrics',
        description:
          'Trigger alerts when freshness, schema, or owner-attestation rules break before executive reviews.',
        status: 'todo',
        priority: 'medium',
        dueDate: '+28d',
        assignee: 'ines-garnier',
        why: 'Early drift detection prevents rework and late-cycle firefighting.',
      },
      {
        slug: 'data-contract-resource-charter',
        title: 'Approve cross-functional resourcing charter for contract operations',
        description:
          'Allocate dedicated owners from finance, PMO, product, and operations for contract maintenance.',
        status: 'todo',
        priority: 'high',
        dueDate: '+15d',
        assignee: 'claire-laurent',
        why: 'Without explicit capacity, governance becomes side-work and degrades under delivery pressure.',
      },
    ],
    decisions: [
      {
        slug: 'data-contract-governance-model',
        title: 'Approve federated ownership model for cross-domain data contracts',
        status: 'pending',
        decisionMaker: 'antoine-laurent',
        deadline: '+12d',
        rationale:
          'The model determines whether metric ownership is scalable without central bottlenecks.',
      },
      {
        slug: 'data-contract-sla-enforcement',
        title: 'Set enforcement policy for breached contract freshness SLAs',
        status: 'pending',
        decisionMaker: 'claire-laurent',
        deadline: '+21d',
        rationale:
          'Finance and operations need one consequence model when evidence is stale or non-compliant.',
      },
    ],
    milestones: [
      {
        slug: 'data-contract-v1-registry-live',
        name: 'Contract registry v1 live',
        description: 'Top metrics are contract-bound with named owners and confidence policy.',
        targetDate: '+11d',
        status: 'PENDING',
      },
      {
        slug: 'data-contract-first-board-cycle',
        name: 'First board cycle on governed contracts',
        description:
          'Executive pack uses only contract-compliant metrics with lineage and attestation.',
        targetDate: 'nextBoardMeeting',
        status: 'PENDING',
        isGate: true,
      },
    ],
  },
  {
    slug: 'ai-operator-trust-and-observability',
    projectSlug: 'board-governance',
    name: 'AI Operator Trust and Observability',
    area: 'AI Governance',
    summary:
      'Operationalize AI use-case governance with confidence gates, evidence pointers, and incident-grade observability across quality, planning, and partner workflows.',
    status: 'APPROVED',
    currentStage: 'Governance Design',
    priority: 'high',
    plannedStart: '-50d',
    plannedEnd: '+65d',
    ownerBusiness: 'julien-moreau',
    ownerExecution: 'victor-morin',
    sponsor: 'jean-claude-laurent',
    expectedRoi: 162,
    budgetCapex: 72000,
    budgetOpex: 91000,
    deliverables: [
      'AI confidence-gate policy per process lane',
      'Runtime observability dashboard for model decisions',
      'Escalation playbooks for contradicted or low-confidence outcomes',
    ],
    successCriteria: [
      'High-impact AI outputs with evidence pointer coverage at 100%',
      'Mean time to AI incident triage under 2 hours',
      'AI recommendation acceptance rate +18% with no trust regressions',
    ],
    keyRisks: [
      'Teams treat confidence gates as optional under delivery pressure',
      'Observability telemetry lacks context for root-cause analysis',
      'Policy is interpreted inconsistently across functions',
    ],
    tasks: [
      {
        slug: 'ai-trust-gates-policy',
        title: 'Finalize confidence-gate policy by lane and decision criticality',
        description:
          'Define required evidence depth, reviewer roles, and allowed actions for each confidence level.',
        status: 'todo',
        priority: 'high',
        dueDate: '+7d',
        assignee: 'victor-morin',
        why: 'A clear gate model is needed before scaling AI-assisted operating decisions.',
      },
      {
        slug: 'ai-observability-control-tower',
        title: 'Deploy observability control tower for AI runtime decisions',
        description:
          'Track confidence shifts, contradiction events, and handoff outcomes with ownership and SLA.',
        status: 'todo',
        priority: 'high',
        dueDate: '+19d',
        assignee: 'paul-lambert',
        why: 'Without telemetry, governance cannot distinguish signal issues from model-quality issues.',
      },
      {
        slug: 'ai-incident-playbooks',
        title: 'Roll out incident playbooks for low-confidence and contradicted outputs',
        description:
          'Standardize fallback behavior, escalation route, and audit trail requirements across teams.',
        status: 'todo',
        priority: 'medium',
        dueDate: '+27d',
        assignee: 'amelie-girard',
        why: 'Predictable incident response preserves trust and protects execution continuity.',
      },
      {
        slug: 'ai-operator-training-pack',
        title: 'Prepare operator enablement pack for confidence-gate workflow',
        description:
          'Train reviewers and execution teams on evidence-pointer usage, escalation paths, and fallback actions.',
        status: 'todo',
        priority: 'medium',
        dueDate: '+24d',
        assignee: 'emma-noel',
        why: 'Governance quality depends on operator behavior consistency, not only on platform controls.',
      },
    ],
    decisions: [
      {
        slug: 'ai-governance-standard',
        title: 'Adopt AI confidence-gate policy as enterprise operating standard',
        status: 'pending',
        decisionMaker: 'jean-claude-laurent',
        deadline: 'nextBoardMeeting',
        rationale:
          'Board approval is required to enforce one cross-functional trust and escalation doctrine.',
      },
      {
        slug: 'ai-runtime-scope',
        title: 'Approve phase-1 scope for mandatory observability instrumentation',
        status: 'pending',
        decisionMaker: 'julien-moreau',
        deadline: '+16d',
        rationale:
          'Scope control is needed to avoid diluted rollout and ensure high-risk lanes are covered first.',
      },
    ],
    milestones: [
      {
        slug: 'ai-policy-alpha',
        name: 'AI governance policy alpha approved',
        description:
          'Policy draft is validated by PMO, security, and product leadership before enterprise sign-off.',
        targetDate: '+8d',
        status: 'PENDING',
      },
      {
        slug: 'ai-observability-wave1',
        name: 'Observability wave 1 live',
        description:
          'Runtime confidence and contradiction telemetry are active in quality and partner lanes.',
        targetDate: '+26d',
        status: 'PENDING',
      },
    ],
  },
  {
    slug: 'energy-cost-optimization-grid',
    projectSlug: 'factory-excellence',
    name: 'Energy Cost Optimization Grid',
    area: 'Energy Management',
    summary:
      'Reduce plant energy intensity and peak tariff exposure using line-level telemetry, scheduling rules, and governance for consumption exceptions.',
    status: 'APPROVED',
    currentStage: 'Execution Planning',
    priority: 'medium',
    plannedStart: '+12d',
    plannedEnd: '+120d',
    ownerBusiness: 'marc-dubois',
    ownerExecution: 'paul-lambert',
    sponsor: 'claire-laurent',
    expectedRoi: 126,
    budgetCapex: 56000,
    budgetOpex: 43000,
    deliverables: [
      'Energy baseline per production line',
      'Peak-load scheduling playbook',
      'Exception governance dashboard for plant leadership',
    ],
    successCriteria: [
      'Energy intensity per unit -11%',
      'Peak tariff events -35%',
      'Monthly energy variance against plan under 4%',
    ],
    keyRisks: [
      'Production constraints can override load-shifting rules',
      'Telemetry gaps on auxiliary systems',
      'Savings attribution disputed between teams',
    ],
    tasks: [
      {
        slug: 'energy-baseline-model',
        title: 'Build energy baseline model across key lines and shifts',
        description:
          'Establish trusted baseline by line, product family, and shift pattern before optimization actions.',
        status: 'todo',
        priority: 'high',
        dueDate: '+18d',
        assignee: 'elise-robert',
        why: 'Without baseline integrity, savings claims will be challenged by finance and operations.',
      },
      {
        slug: 'energy-peak-shift-rules',
        title: 'Design peak-load shift rules with production safeguards',
        description:
          'Define which loads can move, what constraints apply, and what fallback conditions trigger override.',
        status: 'todo',
        priority: 'medium',
        dueDate: '+29d',
        assignee: 'damien-petit',
        why: 'Optimization must protect throughput commitments while lowering tariff exposure.',
      },
      {
        slug: 'energy-governance-dashboard',
        title: 'Launch governance dashboard for weekly energy variance review',
        description:
          'Track consumption, exceptions, and corrective actions with owner accountability and due dates.',
        status: 'todo',
        priority: 'medium',
        dueDate: '+38d',
        assignee: 'hugo-bernard',
        why: 'A stable review cadence is required to convert analytics into sustained behavior change.',
      },
    ],
    decisions: [
      {
        slug: 'energy-capex-allocation',
        title: 'Approve phase-1 capex allocation for metering and control upgrades',
        status: 'pending',
        decisionMaker: 'claire-laurent',
        deadline: '+16d',
        rationale:
          'Funding decision determines whether optimization can move beyond advisory analytics into enforceable control.',
      },
      {
        slug: 'energy-target-commitment',
        title: 'Confirm plant-level annual energy reduction commitment',
        status: 'pending',
        decisionMaker: 'marc-dubois',
        deadline: '+24d',
        rationale:
          'Explicit target commitment is required to align production planning and maintenance priorities.',
      },
    ],
    milestones: [
      {
        slug: 'energy-baseline-approved',
        name: 'Energy baseline approved by finance and operations',
        description: 'One baseline definition is signed off and used for monthly tracking.',
        targetDate: '+20d',
        status: 'PENDING',
      },
      {
        slug: 'energy-wave1-launch',
        name: 'Wave 1 optimization controls live',
        description: 'First set of load-shifting and governance controls is active in pilot lines.',
        targetDate: '+44d',
        status: 'PENDING',
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
      {
        slug: 'legacy-crm-data-retention-audit',
        title: 'Run post-close retention and compliance audit on archived CRM data',
        description:
          'Verify legal retention policy, access controls, and retrieval procedures for archived records.',
        status: 'done',
        priority: 'medium',
        dueDate: '-8d',
        assignee: 'elise-robert',
        why: 'Formal closure requires compliant data stewardship after system switch-off.',
      },
      {
        slug: 'legacy-crm-support-handover',
        title: 'Complete support ownership handover to the new commercial stack',
        description:
          'Transfer runbooks, incident ownership, and escalation playbooks to final operational teams.',
        status: 'done',
        priority: 'low',
        dueDate: '-9d',
        assignee: 'lea-martin',
        why: 'A migration is not truly complete until support accountability is unambiguous.',
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
      {
        slug: 'community-app-asset-archive',
        title: 'Archive reusable product and research assets from cancelled concept',
        description:
          'Tag and store transferable assets for future concept cycles without reviving the cancelled scope.',
        status: 'done',
        priority: 'low',
        dueDate: '-14d',
        assignee: 'camille-dubois',
        why: 'Preserving reusable insight reduces sunk-cost loss and improves future discovery speed.',
      },
      {
        slug: 'community-app-resource-reallocation',
        title: 'Reallocate concept team capacity to priority revenue roadmap items',
        description:
          'Move design and product effort to active initiatives with stronger commercial signal.',
        status: 'done',
        priority: 'medium',
        dueDate: '-13d',
        assignee: 'thomas-viau',
        why: 'Portfolio discipline requires explicit reassignment, not silent cancellation.',
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
