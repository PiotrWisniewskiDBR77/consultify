import { InitiativeStatus, type PortfolioInitiative } from '../../types';
import { nextStepForLifecycle } from './initiativeRegisterProjection';

type DemoInitiativeContext = {
  currentUserId?: string;
  currentUserName?: string;
  currentUserEmail?: string;
};

type DemoUser = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  avatarUrl?: string;
};

type DemoBlueprint = {
  key: string;
  name: string;
  axis: string;
  status: InitiativeStatus;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  progress: number;
  budget: number;
  expectedRoi: number;
  riskScore: number;
  valueScore: number;
  level: 'quick_win' | 'standard' | 'strategic' | 'transformation';
  ownerBusinessId: string;
  ownerExecutionId: string;
  sponsorId: string;
  startOffsetDays: number;
  endOffsetDays: number;
  summary: string;
  description: string;
  symptom: string;
  rootCause: string;
  costOfInaction: string;
  marketContext: string;
  targetDescription: string;
  successCriteria: string[];
  deliverables: string[];
  inScope: string[];
  outScope: string[];
  killCriteria: string[];
  tags: string[];
  dependencyKeys?: string[];
  kpis: Array<{
    name: string;
    unit: string;
    baseline: number;
    target: number;
    current: number;
  }>;
};

type DemoDataset = {
  users: Array<{
    id: string;
    name: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
  }>;
  initiatives: Array<PortfolioInitiative & Record<string, any>>;
  initiativeDetailsById: Record<string, any>;
};

const INITIATIVE_SHOWCASE_PREFIX = 'init-showcase-';
const SHOWCASE_TASK_PREFIX = 'showcase-task-';
const SHOWCASE_DECISION_PREFIX = 'showcase-decision-';

export const isShowcaseInitiativeId = (id?: string | null) =>
  String(id || '').startsWith(INITIATIVE_SHOWCASE_PREFIX);

export const isShowcaseArtifactId = (id?: string | null) => {
  const value = String(id || '');
  return value.startsWith(SHOWCASE_TASK_PREFIX) || value.startsWith(SHOWCASE_DECISION_PREFIX);
};

const isoOffsetDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
};

const toTitle = (value: string) =>
  value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const splitName = (fullName?: string) => {
  const parts = String(fullName || 'Piotr Wisniewski')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return { firstName: 'Piotr', lastName: 'Wisniewski' };
  if (parts.length === 1) return { firstName: parts[0], lastName: 'Owner' };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
};

const getStatusTimeline = (status: InitiativeStatus) => {
  const ordered: InitiativeStatus[] = [
    InitiativeStatus.DRAFT,
    InitiativeStatus.PENDING_REVIEW,
    InitiativeStatus.REVIEW,
    InitiativeStatus.PROMOTED,
    InitiativeStatus.PLANNING,
    InitiativeStatus.APPROVED,
    InitiativeStatus.SCHEDULED,
    InitiativeStatus.EXECUTING,
    InitiativeStatus.BLOCKED,
    InitiativeStatus.DONE,
    InitiativeStatus.TRACKING,
  ];
  const currentIndex = Math.max(ordered.indexOf(status), 0);
  return ordered.slice(0, currentIndex + 1);
};

const lifecycleForDemoStatus = (status: InitiativeStatus): string => {
  switch (status) {
    case InitiativeStatus.DRAFT:
      return 'REGISTERED_DRAFT';
    case InitiativeStatus.PENDING_REVIEW:
      return 'DEFINING';
    case InitiativeStatus.REVIEW:
      return 'ANALYZING';
    case InitiativeStatus.PROMOTED:
      return 'READY_FOR_DECISION';
    case InitiativeStatus.PLANNING:
    case InitiativeStatus.APPROVED:
      return 'APPROVED_BACKLOG';
    case InitiativeStatus.SCHEDULED:
      return 'SCHEDULED';
    case InitiativeStatus.EXECUTING:
    case InitiativeStatus.BLOCKED:
      return 'IN_EXECUTION';
    case InitiativeStatus.DONE:
      return 'DELIVERED';
    case InitiativeStatus.TRACKING:
      return 'BENEFITS_TRACKING';
    case InitiativeStatus.CANCELLED:
      return 'CANCELLED';
    case InitiativeStatus.ARCHIVED:
      return 'ARCHIVED';
    default:
      return 'REGISTERED_DRAFT';
  }
};

export function createInitiativesDemoDataset(context: DemoInitiativeContext = {}): DemoDataset {
  const currentUserName = context.currentUserName || 'Piotr Wisniewski';
  const currentUserId = context.currentUserId || 'showcase-user-piotr';
  const currentUserEmail = context.currentUserEmail || 'piotr@consultify.demo';
  const currentUserNames = splitName(currentUserName);

  const demoUsers: DemoUser[] = [
    {
      id: currentUserId,
      firstName: currentUserNames.firstName,
      lastName: currentUserNames.lastName,
      name: currentUserName,
      email: currentUserEmail,
    },
    {
      id: 'showcase-user-alex',
      firstName: 'Alex',
      lastName: 'Chen',
      name: 'Alex Chen',
      email: 'alex.chen@consultify.demo',
    },
    {
      id: 'showcase-user-lena',
      firstName: 'Lena',
      lastName: 'Meyer',
      name: 'Lena Meyer',
      email: 'lena.meyer@consultify.demo',
    },
    {
      id: 'showcase-user-marta',
      firstName: 'Marta',
      lastName: 'Gomez',
      name: 'Marta Gomez',
      email: 'marta.gomez@consultify.demo',
    },
    {
      id: 'showcase-user-elaine',
      firstName: 'Elaine',
      lastName: 'Porter',
      name: 'Elaine Porter',
      email: 'elaine.porter@consultify.demo',
    },
    {
      id: 'showcase-user-omar',
      firstName: 'Omar',
      lastName: 'Haddad',
      name: 'Omar Haddad',
      email: 'omar.haddad@consultify.demo',
    },
  ];

  const byUserId = Object.fromEntries(demoUsers.map((user) => [user.id, user]));
  const userRef = (id: string) => byUserId[id] || demoUsers[0];
  const makeId = (key: string) => `${INITIATIVE_SHOWCASE_PREFIX}${key}`;

  const blueprints: DemoBlueprint[] = [
    {
      key: 'knowledge-hub-rollout',
      name: 'Knowledge Hub Rollout',
      axis: 'transformational',
      status: InitiativeStatus.DRAFT,
      priority: 'MEDIUM',
      progress: 6,
      budget: 85000,
      expectedRoi: 120,
      riskScore: 38,
      valueScore: 62,
      level: 'standard',
      ownerBusinessId: 'showcase-user-lena',
      ownerExecutionId: currentUserId,
      sponsorId: 'showcase-user-elaine',
      startOffsetDays: 20,
      endOffsetDays: 110,
      summary:
        'Create one shared operating hub for playbooks, onboarding packs, and delivery standards across transformation teams.',
      description:
        'The initiative packages scattered operating knowledge into one searchable, governed workspace to reduce ramp-up time and process drift.',
      symptom:
        'New initiative owners still ask the same setup questions because project playbooks, operating standards, and templates are spread across files and chats.',
      rootCause:
        'Knowledge is stored locally by teams and reused informally, so the organization cannot scale good practices consistently.',
      costOfInaction:
        'Every new initiative starts slower than necessary and senior contributors keep re-answering the same operational questions.',
      marketContext:
        'Cross-functional programs are growing faster than the organization’s internal knowledge-sharing model.',
      targetDescription:
        'Teams can find one approved source for delivery standards, role handoffs, and reusable templates without asking for ad hoc clarifications.',
      successCriteria: [
        'Ramp-up time for a new initiative owner reduced from 10 days to 3 days',
        'At least 80% of active initiatives use the shared templates',
        'Repeated onboarding questions reduced by 50%',
      ],
      deliverables: [
        'Governed knowledge architecture',
        'Reusable initiative starter pack',
        'Role-based onboarding paths',
      ],
      inScope: ['Delivery templates', 'Operating standards', 'Role-based onboarding'],
      outScope: ['Client-facing knowledge base', 'Legacy file migration in full'],
      killCriteria: ['No clear content owner model', 'No adoption by active initiative owners'],
      tags: ['knowledge', 'operating-model', 'scale'],
      kpis: [
        { name: 'Owner ramp-up time', unit: 'days', baseline: 10, target: 3, current: 9 },
        { name: 'Template adoption', unit: '%', baseline: 18, target: 80, current: 24 },
      ],
    },
    {
      key: 'supplier-onboarding-portal',
      name: 'Supplier Onboarding Portal',
      axis: 'operational',
      status: InitiativeStatus.PENDING_REVIEW,
      priority: 'HIGH',
      progress: 12,
      budget: 140000,
      expectedRoi: 155,
      riskScore: 46,
      valueScore: 71,
      level: 'standard',
      ownerBusinessId: currentUserId,
      ownerExecutionId: 'showcase-user-alex',
      sponsorId: 'showcase-user-elaine',
      startOffsetDays: 10,
      endOffsetDays: 95,
      summary:
        'Replace email-driven supplier onboarding with one guided portal for documents, approvals, and compliance evidence.',
      description:
        'The portal reduces back-and-forth across procurement, legal, and finance while making onboarding progress visible to all stakeholders.',
      symptom:
        'Supplier setup takes too long because documents move by email and teams cannot see what is blocked or complete.',
      rootCause:
        'The process spans several functions but there is no single workflow or live status layer for supplier onboarding.',
      costOfInaction:
        'Category teams delay sourcing waves, and suppliers wait too long for activation into the purchasing process.',
      marketContext:
        'Procurement leaders are expected to shorten supplier activation time while improving compliance traceability.',
      targetDescription:
        'Suppliers submit documents once, internal teams see one live workflow, and activation decisions happen with fewer handoffs.',
      successCriteria: [
        'Supplier activation time reduced by 40%',
        'Missing-document follow-ups reduced by 60%',
        'Compliance evidence captured in one workflow',
      ],
      deliverables: [
        'Supplier self-service portal',
        'Internal review workflow',
        'Compliance evidence dashboard',
      ],
      inScope: ['Portal workflow', 'Document checklist', 'Internal approval routing'],
      outScope: ['Full supplier performance management', 'Payments redesign'],
      killCriteria: ['Legal will not adopt workflow approvals', 'Supplier data model unresolved'],
      tags: ['procurement', 'workflow', 'compliance'],
      kpis: [
        { name: 'Activation lead time', unit: 'days', baseline: 28, target: 17, current: 26 },
        { name: 'Incomplete submissions', unit: '%', baseline: 41, target: 15, current: 36 },
      ],
    },
    {
      key: 'warehouse-automation-pilot',
      name: 'Warehouse Automation Pilot',
      axis: 'operational',
      status: InitiativeStatus.REVIEW,
      priority: 'HIGH',
      progress: 22,
      budget: 240000,
      expectedRoi: 182,
      riskScore: 62,
      valueScore: 83,
      level: 'strategic',
      ownerBusinessId: currentUserId,
      ownerExecutionId: 'showcase-user-marta',
      sponsorId: 'showcase-user-elaine',
      startOffsetDays: 5,
      endOffsetDays: 120,
      summary:
        'Pilot automated picking and exception routing in the flagship warehouse to improve throughput and cut manual coordination.',
      description:
        'The pilot focuses on one site, one product family, and one measurable service promise so the organization can validate the business case quickly.',
      symptom:
        'Supervisors still coordinate pick waves manually and service-level exceptions are discovered too late.',
      rootCause:
        'The warehouse depends on spreadsheets and local workarounds because operational signals are not surfaced in one action-ready control flow.',
      costOfInaction:
        'Throughput remains volatile, and premium shipping is repeatedly used to recover avoidable warehouse delays.',
      marketContext:
        'Customers expect more predictable delivery windows while labor availability remains tight.',
      targetDescription:
        'One live pilot cell runs with clearer priorities, fewer pick-path interruptions, and visible exception ownership by shift.',
      successCriteria: [
        'Pick productivity improved by 18%',
        'Service-level exceptions reduced by 30%',
        'Pilot business case approved for scale-up',
      ],
      deliverables: [
        'Pilot process design',
        'Shift control dashboard',
        'Exception routing playbook',
      ],
      inScope: ['One flagship warehouse', 'Top SKU family', 'Shift-level exception workflow'],
      outScope: ['Full network rollout', 'Warehouse ERP replacement'],
      killCriteria: ['No stable slotting data', 'Pilot cannot run without manual shadow process'],
      tags: ['warehouse', 'automation', 'pilot'],
      dependencyKeys: ['master-data-foundation'],
      kpis: [
        { name: 'Picks per labor hour', unit: 'pph', baseline: 78, target: 92, current: 80 },
        { name: 'Exception recovery time', unit: 'min', baseline: 54, target: 30, current: 47 },
      ],
    },
    {
      key: 'margin-leakage-recovery',
      name: 'Margin Leakage Recovery Sprint',
      axis: 'strategic',
      status: InitiativeStatus.PROMOTED,
      priority: 'CRITICAL',
      progress: 31,
      budget: 95000,
      expectedRoi: 240,
      riskScore: 54,
      valueScore: 88,
      level: 'quick_win',
      ownerBusinessId: 'showcase-user-lena',
      ownerExecutionId: currentUserId,
      sponsorId: 'showcase-user-elaine',
      startOffsetDays: 2,
      endOffsetDays: 75,
      summary:
        'Recover pricing and claims leakage by fixing the top three revenue-control breakdowns in order-to-cash.',
      description:
        'This sprint targets visible margin leakage points that can be addressed quickly with better controls and clearer ownership.',
      symptom:
        'Commercial teams routinely discover leakage after month-end because contract terms, freight charges, and claims treatment are reconciled too late.',
      rootCause:
        'Revenue controls are fragmented across sales operations, finance, and customer service, with no shared operational cadence.',
      costOfInaction:
        'The business keeps leaking margin in ways that are visible only after revenue is already recognized.',
      marketContext:
        'Leadership wants short-cycle wins that visibly improve EBIT while larger system changes are still being designed.',
      targetDescription:
        'Margin leakage is surfaced weekly, owners know which control they own, and recovery actions are tracked in one sprint rhythm.',
      successCriteria: [
        'Leakage value reduced by 25% within two quarters',
        'Weekly control review established',
        'Escalation path agreed across finance and commercial teams',
      ],
      deliverables: ['Leakage control register', 'Weekly recovery cockpit', 'Control owner matrix'],
      inScope: ['Freight leakage', 'Claims leakage', 'Pricing override leakage'],
      outScope: ['Full ERP pricing redesign', 'Commercial comp redesign'],
      killCriteria: ['Control owners not assigned', 'Recovery value not measurable'],
      tags: ['margin', 'controls', 'finance'],
      kpis: [
        { name: 'Recovered margin', unit: 'EURk', baseline: 0, target: 420, current: 96 },
        { name: 'Weekly control adherence', unit: '%', baseline: 0, target: 90, current: 55 },
      ],
    },
    {
      key: 'field-service-dispatch-redesign',
      name: 'Field Service Dispatch Redesign',
      axis: 'transformational',
      status: InitiativeStatus.PLANNING,
      priority: 'HIGH',
      progress: 38,
      budget: 320000,
      expectedRoi: 170,
      riskScore: 58,
      valueScore: 79,
      level: 'strategic',
      ownerBusinessId: 'showcase-user-marta',
      ownerExecutionId: 'showcase-user-alex',
      sponsorId: currentUserId,
      startOffsetDays: 14,
      endOffsetDays: 170,
      summary:
        'Redesign dispatch planning to reduce technician idle time and improve first-time-right appointments.',
      description:
        'The redesign combines workforce planning, mobile workflow, and exception handling so dispatch decisions can be made earlier and with better data.',
      symptom:
        'Dispatchers still spend large parts of the day reshuffling appointments manually because routing, skills, and inventory signals are disconnected.',
      rootCause:
        'The operating model treats dispatch as a local scheduling problem instead of one cross-functional service flow.',
      costOfInaction:
        'Technician capacity is consumed by rework and customers experience avoidable delays in appointment fulfillment.',
      marketContext:
        'Service organizations are under pressure to improve appointment reliability without increasing field headcount.',
      targetDescription:
        'Dispatch decisions are based on one agreed workflow, technicians receive more stable daily plans, and recovery actions are triggered earlier.',
      successCriteria: [
        'Technician idle time reduced by 15%',
        'First-time-right appointments improved by 12 points',
        'Dispatch exception reviews reduced by half',
      ],
      deliverables: [
        'Dispatch operating blueprint',
        'Technician skills and coverage model',
        'Exception escalation workflow',
      ],
      inScope: ['Dispatch planning', 'Exception recovery', 'Daily service control room'],
      outScope: ['Full CRM replacement', 'Pricing model redesign'],
      killCriteria: ['No shared skills taxonomy', 'Technician availability data stays unreliable'],
      tags: ['service', 'dispatch', 'workflow'],
      kpis: [
        { name: 'Idle technician time', unit: '%', baseline: 19, target: 12, current: 18 },
        { name: 'First-time-right rate', unit: '%', baseline: 68, target: 80, current: 70 },
      ],
    },
    {
      key: 'revenue-control-tower',
      name: 'Revenue Control Tower',
      axis: 'strategic',
      status: InitiativeStatus.APPROVED,
      priority: 'HIGH',
      progress: 49,
      budget: 410000,
      expectedRoi: 190,
      riskScore: 57,
      valueScore: 91,
      level: 'transformation',
      ownerBusinessId: currentUserId,
      ownerExecutionId: 'showcase-user-omar',
      sponsorId: 'showcase-user-elaine',
      startOffsetDays: 21,
      endOffsetDays: 210,
      summary:
        'Create one cross-functional control tower for demand, pricing, fulfillment exceptions, and benefits realization.',
      description:
        'The control tower gives leaders one common view of commercial-operational trade-offs and one cadence for intervention decisions.',
      symptom:
        'Commercial and operational teams review different numbers, so interventions happen late and benefits are hard to attribute.',
      rootCause:
        'There is no portfolio-level operating rhythm connecting pricing, service exceptions, and realized commercial value.',
      costOfInaction:
        'Leaders keep funding improvement work without one shared system for tracking commercial-operational trade-offs.',
      marketContext:
        'Executive teams are demanding sharper visibility into how operational actions actually protect or grow margin.',
      targetDescription:
        'Revenue-critical signals are visible in one cadence, and the business can intervene before value leakage becomes month-end noise.',
      successCriteria: [
        'Weekly value review established',
        'Three value-protection use cases live in the first quarter',
        'One benefits narrative agreed across commercial and operations leaders',
      ],
      deliverables: [
        'Control tower operating cadence',
        'Value driver dashboard',
        'Intervention decision playbook',
      ],
      inScope: ['Value review cadence', 'Priority intervention flows', 'Value attribution logic'],
      outScope: ['Full pricing engine replacement', 'Sales compensation redesign'],
      killCriteria: ['No sponsor attendance in value review', 'Value drivers not agreed'],
      tags: ['revenue', 'control-tower', 'governance'],
      dependencyKeys: ['margin-leakage-recovery'],
      kpis: [
        {
          name: 'Value interventions per month',
          unit: 'count',
          baseline: 0,
          target: 8,
          current: 1,
        },
        { name: 'Protected margin', unit: 'EURk', baseline: 0, target: 850, current: 130 },
      ],
    },
    {
      key: 'supply-chain-optimization',
      name: 'Supply Chain Optimization Wave 1',
      axis: 'operational',
      status: InitiativeStatus.SCHEDULED,
      priority: 'MEDIUM',
      progress: 56,
      budget: 270000,
      expectedRoi: 148,
      riskScore: 42,
      valueScore: 75,
      level: 'standard',
      ownerBusinessId: 'showcase-user-omar',
      ownerExecutionId: 'showcase-user-alex',
      sponsorId: 'showcase-user-elaine',
      startOffsetDays: 28,
      endOffsetDays: 190,
      summary:
        'Launch the first optimization wave for inbound planning, safety stock policy, and supplier exception handling.',
      description:
        'Wave 1 concentrates on the highest-friction planning nodes and sets the baseline for broader optimization later.',
      symptom:
        'Planners spend too much time expediting around stock imbalances because exception handling is inconsistent.',
      rootCause:
        'Supply planning rules differ by site, and exception ownership is not visible at the right moment.',
      costOfInaction:
        'The network continues to absorb avoidable expediting costs and inventory imbalance.',
      marketContext:
        'Supply volatility remains elevated, so planning discipline matters more than headline forecast accuracy alone.',
      targetDescription:
        'Wave 1 sites run a tighter planning cycle with clearer stock policy and more disciplined supplier recovery actions.',
      successCriteria: [
        'Expediting cost reduced by 15%',
        'Inventory imbalance alerts acted on within 48 hours',
        'Supplier recovery ownership made explicit',
      ],
      deliverables: [
        'Planning wave design',
        'Stock policy baseline',
        'Supplier exception governance',
      ],
      inScope: ['Wave 1 sites', 'Inbound planning', 'Supplier exception handling'],
      outScope: ['Global network redesign', 'Transport tendering'],
      killCriteria: ['Planner roles not aligned', 'No agreed policy for slow movers'],
      tags: ['supply-chain', 'planning', 'inventory'],
      kpis: [
        { name: 'Expediting spend', unit: 'EURk', baseline: 220, target: 185, current: 214 },
        { name: 'Days of imbalance', unit: 'days', baseline: 18, target: 10, current: 16 },
      ],
    },
    {
      key: 'procurement-ai-copilot',
      name: 'Procurement AI Copilot',
      axis: 'transformational',
      status: InitiativeStatus.EXECUTING,
      priority: 'HIGH',
      progress: 68,
      budget: 190000,
      expectedRoi: 165,
      riskScore: 49,
      valueScore: 80,
      level: 'strategic',
      ownerBusinessId: 'showcase-user-lena',
      ownerExecutionId: currentUserId,
      sponsorId: 'showcase-user-elaine',
      startOffsetDays: -35,
      endOffsetDays: 80,
      summary:
        'Deploy an AI copilot to speed supplier briefing, category analysis, and sourcing preparation for procurement teams.',
      description:
        'The copilot improves buyer throughput while keeping governance guardrails around supplier data, prompt usage, and approval boundaries.',
      symptom:
        'Buyers spend too much time preparing category packs and supplier briefings instead of shaping sourcing choices.',
      rootCause:
        'Preparation work is fragmented across documents, spreadsheets, and ad hoc analysis requests.',
      costOfInaction:
        'Procurement capacity stays trapped in admin-heavy preparation work, limiting strategic sourcing output.',
      marketContext:
        'Teams are under pressure to show practical AI productivity gains without weakening governance.',
      targetDescription:
        'Buyers can generate better category starting points in hours instead of days, while approvals remain human-led.',
      successCriteria: [
        'Preparation time for sourcing packs reduced by 50%',
        'Prompt and output governance tracked for all active users',
        'Buyer satisfaction above 4.2/5',
      ],
      deliverables: [
        'Governed AI prompt library',
        'Category preparation workspace',
        'Usage and quality telemetry',
      ],
      inScope: ['Category analysis', 'Supplier briefing drafts', 'Prompt governance'],
      outScope: ['Auto-approve sourcing decisions', 'Supplier-facing AI workflows'],
      killCriteria: ['No governed prompt model', 'Buyers do not trust the first draft quality'],
      tags: ['ai', 'procurement', 'productivity'],
      dependencyKeys: ['knowledge-hub-rollout'],
      kpis: [
        { name: 'Hours saved per buyer', unit: 'h', baseline: 0, target: 8, current: 5 },
        { name: 'Governed prompt usage', unit: '%', baseline: 0, target: 95, current: 74 },
      ],
    },
    {
      key: 'master-data-foundation',
      name: 'Master Data Foundation',
      axis: 'strategic',
      status: InitiativeStatus.BLOCKED,
      priority: 'CRITICAL',
      progress: 43,
      budget: 460000,
      expectedRoi: 135,
      riskScore: 84,
      valueScore: 86,
      level: 'transformation',
      ownerBusinessId: 'showcase-user-omar',
      ownerExecutionId: 'showcase-user-marta',
      sponsorId: currentUserId,
      startOffsetDays: -20,
      endOffsetDays: 150,
      summary:
        'Build the cross-domain master data baseline required for downstream automation, reporting, and planning initiatives.',
      description:
        'The program aligns customer, product, and supplier master data definitions while establishing ownership and change-control discipline.',
      symptom:
        'Multiple initiatives depend on stable master data, but teams still reconcile definitions locally before acting.',
      rootCause:
        'Data ownership exists informally, without one governed model for change decisions, issue triage, and domain stewardship.',
      costOfInaction:
        'Execution teams keep building around unstable data assumptions, making later scale-up more expensive and slower.',
      marketContext:
        'Digital programs increasingly depend on reliable cross-domain data, making foundation work unavoidable.',
      targetDescription:
        'Critical domains have agreed owners, decision rights, and one reliable baseline used by operational and transformation teams.',
      successCriteria: [
        'Three core domains governed with named owners',
        'Issue triage SLA operating weekly',
        'Downstream programs consume one approved baseline',
      ],
      deliverables: [
        'Domain ownership model',
        'Master data issue triage',
        'Approved baseline data set',
      ],
      inScope: ['Customer domain', 'Product domain', 'Supplier domain'],
      outScope: ['Full MDM platform rollout', 'All historical data remediation'],
      killCriteria: ['No domain owner decisions', 'No escalation model for data issues'],
      tags: ['data', 'foundation', 'governance'],
      kpis: [
        { name: 'Critical data defects', unit: 'count', baseline: 47, target: 12, current: 39 },
        { name: 'Domain owner SLA', unit: '%', baseline: 0, target: 90, current: 42 },
      ],
    },
    {
      key: 'digital-onboarding-simplification',
      name: 'Digital Onboarding Simplification',
      axis: 'operational',
      status: InitiativeStatus.DONE,
      priority: 'MEDIUM',
      progress: 100,
      budget: 70000,
      expectedRoi: 210,
      riskScore: 18,
      valueScore: 67,
      level: 'quick_win',
      ownerBusinessId: 'showcase-user-marta',
      ownerExecutionId: currentUserId,
      sponsorId: 'showcase-user-elaine',
      startOffsetDays: -120,
      endOffsetDays: -12,
      summary:
        'Simplify employee onboarding by removing duplicate forms and unifying the first-week task sequence.',
      description:
        'The completed initiative created a clearer onboarding flow and removed repetitive coordination work between HR and line managers.',
      symptom:
        'New hires were receiving fragmented instructions and duplicate requests across systems and teams.',
      rootCause:
        'Onboarding steps evolved locally without one ownership model or one shared workflow.',
      costOfInaction:
        'New hires would continue to lose time in the first week and managers would keep compensating manually.',
      marketContext:
        'Faster onboarding became more important as hiring volumes increased and hybrid work expanded.',
      targetDescription:
        'New hires experience one coordinated sequence with clear owners, fewer duplicate steps, and faster readiness for productive work.',
      successCriteria: [
        'Administrative onboarding effort reduced by 35%',
        'New-hire readiness score improved by 20 points',
        'Duplicate onboarding steps eliminated',
      ],
      deliverables: ['Unified onboarding checklist', 'Manager handoff view', 'Automated reminders'],
      inScope: ['First-week workflow', 'Manager handoff', 'Reminder automation'],
      outScope: ['Full learning platform redesign', 'Performance review process'],
      killCriteria: ['No HR owner available', 'Checklist not adopted by line managers'],
      tags: ['onboarding', 'quick-win', 'hr'],
      kpis: [
        { name: 'Admin onboarding effort', unit: 'h', baseline: 9, target: 6, current: 6 },
        { name: 'New-hire readiness', unit: 'score', baseline: 61, target: 80, current: 82 },
      ],
    },
    {
      key: 'post-merger-kpi-harmonization',
      name: 'Post-Merger KPI Harmonization',
      axis: 'strategic',
      status: InitiativeStatus.TRACKING,
      priority: 'HIGH',
      progress: 100,
      budget: 160000,
      expectedRoi: 145,
      riskScore: 33,
      valueScore: 73,
      level: 'standard',
      ownerBusinessId: 'showcase-user-elaine',
      ownerExecutionId: 'showcase-user-omar',
      sponsorId: currentUserId,
      startOffsetDays: -180,
      endOffsetDays: -35,
      summary:
        'Harmonize KPI definitions after the merger and track whether leaders now manage from one consistent scorecard.',
      description:
        'The initiative is complete and now being tracked to confirm that reporting alignment is holding in monthly operating reviews.',
      symptom:
        'Merged teams previously reported different KPI definitions, making cross-unit performance reviews inconsistent.',
      rootCause:
        'Each legacy business had its own operating definitions and governance forum for performance metrics.',
      costOfInaction:
        'Leadership would keep debating definitions instead of acting on one comparable view of performance.',
      marketContext:
        'Post-merger integration requires fast alignment on what the business treats as “one number.”',
      targetDescription:
        'Monthly reviews run on one KPI dictionary and any exception to the definition is surfaced explicitly.',
      successCriteria: [
        'One KPI dictionary adopted by all business units',
        'Monthly review packs aligned within one reporting cycle',
        'Exceptions managed through one governance path',
      ],
      deliverables: [
        'Shared KPI dictionary',
        'Reporting sign-off routine',
        'Exception governance log',
      ],
      inScope: ['Leadership KPI set', 'Monthly review pack', 'Definition governance'],
      outScope: ['All local operational dashboards', 'Full BI platform redesign'],
      killCriteria: ['No executive owner for scorecard', 'Local teams keep shadow definitions'],
      tags: ['kpi', 'merger', 'tracking'],
      kpis: [
        { name: 'Aligned KPI definitions', unit: '%', baseline: 35, target: 100, current: 100 },
        { name: 'Definition exceptions', unit: 'count', baseline: 14, target: 2, current: 3 },
      ],
    },
  ];

  const initiatives = blueprints.map((blueprint) => {
    const ownerBusiness = userRef(blueprint.ownerBusinessId);
    const ownerExecution = userRef(blueprint.ownerExecutionId);
    const initiativeId = makeId(blueprint.key);
    const dependencies = (blueprint.dependencyKeys || []).map((key) => makeId(key));
    const displayStatus = lifecycleForDemoStatus(blueprint.status);
    const nextStep = nextStepForLifecycle(displayStatus);
    const isBlocked = blueprint.status === InitiativeStatus.BLOCKED;

    return {
      id: initiativeId,
      name: blueprint.name,
      title: blueprint.name,
      summary: blueprint.summary,
      description: blueprint.description,
      axis: blueprint.axis,
      status: blueprint.status,
      displayStatus,
      lifecycle: displayStatus,
      gateName: nextStep.gate,
      gateReadiness: isBlocked
        ? 'BLOCKED'
        : blueprint.progress >= 70
          ? 'READY'
          : blueprint.progress >= 30
            ? 'PARTIAL'
            : 'NOT_READY',
      nextAction: isBlocked ? 'Usuń blokadę realizacji' : nextStep.action,
      expectedImpact: blueprint.targetDescription,
      impactConfidence:
        blueprint.progress >= 70 ? 'HIGH' : blueprint.progress >= 30 ? 'MEDIUM' : 'LOW',
      plannedWindow: `${isoOffsetDays(blueprint.startOffsetDays)} / ${isoOffsetDays(blueprint.endOffsetDays)}`,
      healthState: isBlocked
        ? 'CRITICAL'
        : blueprint.riskScore >= 60
          ? 'AT_RISK'
          : blueprint.progress >= 70
            ? 'ON_TRACK'
            : 'WATCH',
      sourceFreshness: 'CURRENT',
      priority: blueprint.priority,
      progress: blueprint.progress,
      budget: blueprint.budget,
      expectedRoi: blueprint.expectedRoi,
      plannedStartDate: isoOffsetDays(blueprint.startOffsetDays),
      plannedEndDate: isoOffsetDays(blueprint.endOffsetDays),
      projectId: 'demo-project-initiatives-showcase',
      projectName: 'Initiatives Showcase',
      ownerBusiness: {
        id: ownerBusiness.id,
        firstName: ownerBusiness.firstName,
        lastName: ownerBusiness.lastName,
        avatarUrl: ownerBusiness.avatarUrl,
      },
      ownerExecution: {
        id: ownerExecution.id,
        firstName: ownerExecution.firstName,
        lastName: ownerExecution.lastName,
        avatarUrl: ownerExecution.avatarUrl,
      },
      dependencies,
      riskScore: blueprint.riskScore,
      valueScore: blueprint.valueScore,
      createdAt: isoOffsetDays(-45),
      updatedAt: isoOffsetDays(-Math.max(1, 12 - Math.floor(blueprint.progress / 10))),
      level: blueprint.level,
      scope: {
        inScope: blueprint.inScope,
        outScope: blueprint.outScope,
      },
      objectives: blueprint.successCriteria,
      timeline: {
        start: isoOffsetDays(blueprint.startOffsetDays),
        end: isoOffsetDays(blueprint.endOffsetDays),
      },
      kpis: blueprint.kpis.map((kpi, idx) => ({
        id: `${initiativeId}-kpi-${idx + 1}`,
        name: kpi.name,
        unit: kpi.unit,
        baselineValue: kpi.baseline,
        targetValue: kpi.target,
        latestValue: kpi.current,
      })),
      team: [ownerBusiness.name, ownerExecution.name, userRef(blueprint.sponsorId).name],
    } as PortfolioInitiative & Record<string, any>;
  });

  const initiativeByKey = Object.fromEntries(
    initiatives.map((initiative) => [initiative.id, initiative])
  );

  const initiativeDetailsById = Object.fromEntries(
    blueprints.map((blueprint) => {
      const initiativeId = makeId(blueprint.key);
      const ownerBusiness = userRef(blueprint.ownerBusinessId);
      const ownerExecution = userRef(blueprint.ownerExecutionId);
      const sponsor = userRef(blueprint.sponsorId);
      const dependencyTitles = (blueprint.dependencyKeys || []).map((key) => {
        const related = blueprints.find((item) => item.key === key);
        return related?.name || toTitle(key);
      });
      const timeline = getStatusTimeline(blueprint.status);
      const transitionTarget =
        blueprint.status === InitiativeStatus.BLOCKED
          ? InitiativeStatus.EXECUTING
          : timeline.length < 11
            ? [
                InitiativeStatus.DRAFT,
                InitiativeStatus.PENDING_REVIEW,
                InitiativeStatus.REVIEW,
                InitiativeStatus.PROMOTED,
                InitiativeStatus.PLANNING,
                InitiativeStatus.APPROVED,
                InitiativeStatus.SCHEDULED,
                InitiativeStatus.EXECUTING,
                InitiativeStatus.DONE,
                InitiativeStatus.TRACKING,
              ].find((status) => !timeline.includes(status)) || InitiativeStatus.TRACKING
            : InitiativeStatus.TRACKING;

      const taskIds = blueprint.deliverables.map(
        (_deliverable, index) => `${SHOWCASE_TASK_PREFIX}${blueprint.key}-${index + 1}`
      );
      const decisionIds = [1, 2].map(
        (index) => `${SHOWCASE_DECISION_PREFIX}${blueprint.key}-${index}`
      );

      const detail = {
        initiative: {
          ...initiativeByKey[initiativeId],
          ownerId: blueprint.ownerBusinessId,
          sponsorId: blueprint.sponsorId,
          estimatedBudget: blueprint.budget,
          costCapex: Math.round(blueprint.budget * 0.62),
          costOpex: Math.round(blueprint.budget * 0.38),
          expectedRoi: blueprint.expectedRoi,
          marketContext: blueprint.marketContext,
          problemDefinition: {
            symptom: blueprint.symptom,
            rootCause: blueprint.rootCause,
            costOfInaction: blueprint.costOfInaction,
          },
          targetState: {
            description: blueprint.targetDescription,
            successCriteria: blueprint.successCriteria,
            deliverables: blueprint.deliverables,
          },
          scope: {
            inScope: blueprint.inScope,
            outScope: blueprint.outScope,
          },
          killCriteria: blueprint.killCriteria,
          tags: blueprint.tags,
          resources: [
            {
              id: `${initiativeId}-res-1`,
              name: ownerBusiness.name,
              role: 'Business Owner',
              allocation: 50,
            },
            {
              id: `${initiativeId}-res-2`,
              name: ownerExecution.name,
              role: 'Delivery Lead',
              allocation: 70,
            },
            { id: `${initiativeId}-res-3`, name: sponsor.name, role: 'Sponsor', allocation: 15 },
          ],
          toolsNeeded: blueprint.deliverables
            .slice(0, 2)
            .map((deliverable) => `${deliverable} workspace`),
          milestones: blueprint.deliverables.map((deliverable, index) => ({
            id: `${initiativeId}-ms-${index + 1}`,
            name: deliverable,
            date: isoOffsetDays(blueprint.startOffsetDays + 14 * (index + 1)),
            status:
              blueprint.progress >= (index + 1) * 30
                ? 'completed'
                : blueprint.progress >= (index + 1) * 20
                  ? 'in_progress'
                  : 'pending',
            description: `Milestone for ${deliverable.toLowerCase()}.`,
          })),
          timelinePhases: [
            {
              id: `${initiativeId}-phase-1`,
              name: 'Design',
              startDate: isoOffsetDays(blueprint.startOffsetDays),
              endDate: isoOffsetDays(blueprint.startOffsetDays + 25),
              status: blueprint.progress > 25 ? 'completed' : 'active',
            },
            {
              id: `${initiativeId}-phase-2`,
              name: 'Build',
              startDate: isoOffsetDays(blueprint.startOffsetDays + 26),
              endDate: isoOffsetDays(blueprint.endOffsetDays - 20),
              status:
                blueprint.progress > 70
                  ? 'completed'
                  : blueprint.progress > 35
                    ? 'active'
                    : 'pending',
            },
            {
              id: `${initiativeId}-phase-3`,
              name: 'Stabilize',
              startDate: isoOffsetDays(blueprint.endOffsetDays - 19),
              endDate: isoOffsetDays(blueprint.endOffsetDays),
              status: blueprint.progress >= 100 ? 'completed' : 'pending',
            },
          ],
          estimatedDurationMonths: Math.max(
            1,
            Math.round((blueprint.endOffsetDays - blueprint.startOffsetDays) / 30)
          ),
          kpis: blueprint.kpis.map((kpi, idx) => ({
            id: `${initiativeId}-kpi-${idx + 1}`,
            name: kpi.name,
            category: idx === 0 ? 'value' : 'delivery',
            unit: kpi.unit,
            baselineValue: kpi.baseline,
            targetValue: kpi.target,
            currentValue: kpi.current,
          })),
        },
        decisions: [
          {
            id: decisionIds[0],
            title: `Approve scope and success measures for ${blueprint.name}`,
            description:
              'Confirms the initiative boundary and the first wave of measurable outcomes.',
            type: 'GATE_APPROVAL',
            status: blueprint.status === InitiativeStatus.DRAFT ? 'PENDING' : 'APPROVED',
            priority: blueprint.priority,
            ownerName: sponsor.name,
            requestedByName: ownerBusiness.name,
            dueDate: isoOffsetDays(7),
            createdAt: isoOffsetDays(-5),
            source: 'manual',
          },
          {
            id: decisionIds[1],
            title: `Confirm delivery sequencing for ${blueprint.name}`,
            description: 'Validates the order of delivery and the first dependency assumptions.',
            type: 'GENERAL',
            status:
              blueprint.status === InitiativeStatus.BLOCKED
                ? 'ESCALATED'
                : blueprint.status === InitiativeStatus.DONE ||
                    blueprint.status === InitiativeStatus.TRACKING
                  ? 'APPROVED'
                  : 'PENDING',
            priority: blueprint.priority === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
            ownerName: ownerExecution.name,
            requestedByName: currentUserName,
            dueDate: isoOffsetDays(12),
            createdAt: isoOffsetDays(-3),
            source: 'manual',
          },
        ],
        raidItems: [
          {
            id: `${initiativeId}-raid-1`,
            type: 'risk',
            title: `${blueprint.name} may stall if ownership is not explicit`,
            description: blueprint.rootCause,
            severity:
              blueprint.riskScore > 75 ? 'CRITICAL' : blueprint.riskScore > 55 ? 'HIGH' : 'MEDIUM',
            status: blueprint.status === InitiativeStatus.BLOCKED ? 'open' : 'tracked',
            owner: ownerBusiness.name,
            mitigationPlan:
              'Assign explicit owner decision rights before the next governance review.',
          },
          {
            id: `${initiativeId}-raid-2`,
            type: 'issue',
            title: `Data quality friction is slowing ${blueprint.name}`,
            description: blueprint.symptom,
            severity: blueprint.status === InitiativeStatus.BLOCKED ? 'HIGH' : 'MEDIUM',
            status: blueprint.status === InitiativeStatus.DONE ? 'closed' : 'open',
            owner: ownerExecution.name,
            mitigationPlan: 'Use one issue log with weekly triage and named actions.',
          },
          {
            id: `${initiativeId}-raid-3`,
            type: 'dependency',
            title:
              dependencyTitles.length > 0
                ? `Dependency on ${dependencyTitles.join(', ')}`
                : `Dependency on sponsor decisions for ${blueprint.name}`,
            description:
              dependencyTitles.length > 0
                ? `The initiative depends on ${dependencyTitles.join(', ')} reaching a stable state first.`
                : 'Momentum depends on timely sponsor decisions and resource availability.',
            severity: dependencyTitles.length > 0 ? 'HIGH' : 'LOW',
            status: dependencyTitles.length > 0 ? 'open' : 'tracked',
            owner: sponsor.name,
            mitigationPlan: 'Review dependency readiness before the next planning checkpoint.',
          },
        ],
        watchers: [
          {
            id: `${initiativeId}-watcher-1`,
            userId: ownerBusiness.id,
            name: ownerBusiness.name,
            email: ownerBusiness.email,
          },
          {
            id: `${initiativeId}-watcher-2`,
            userId: sponsor.id,
            name: sponsor.name,
            email: sponsor.email,
          },
        ],
        history: [
          {
            id: `${initiativeId}-history-1`,
            eventType: 'created',
            createdAt: isoOffsetDays(-28),
            actorId: ownerBusiness.id,
            actorName: ownerBusiness.name,
            payload: { message: 'Initiative created from portfolio shaping discussion.' },
          },
          {
            id: `${initiativeId}-history-2`,
            eventType: 'updated',
            createdAt: isoOffsetDays(-18),
            actorId: ownerExecution.id,
            actorName: ownerExecution.name,
            payload: { message: 'Delivery sequence and KPI draft refined.' },
          },
          {
            id: `${initiativeId}-history-3`,
            eventType: 'commented',
            createdAt: isoOffsetDays(-9),
            actorId: sponsor.id,
            actorName: sponsor.name,
            payload: { message: 'Sponsor requested tighter sequencing and clearer value framing.' },
          },
        ],
        tasks: blueprint.deliverables.map((deliverable, index) => ({
          id: taskIds[index],
          title: deliverable,
          source: 'manual',
          description: `Deliverable workstream for ${deliverable.toLowerCase()}.`,
          status:
            blueprint.progress >= (index + 1) * 35
              ? 'DONE'
              : blueprint.progress >= (index + 1) * 20
                ? 'IN_PROGRESS'
                : 'TODO',
          priority: index === 0 ? blueprint.priority : 'MEDIUM',
          dueDate: isoOffsetDays(blueprint.startOffsetDays + 21 * (index + 1)),
          taskType: index === blueprint.deliverables.length - 1 ? 'milestone' : 'task',
          estimatedHours: 20 + index * 8,
          assigneeId: index % 2 === 0 ? ownerExecution.id : ownerBusiness.id,
          assigneeName: index % 2 === 0 ? ownerExecution.name : ownerBusiness.name,
          isMilestone: index === blueprint.deliverables.length - 1,
          milestoneDate:
            index === blueprint.deliverables.length - 1
              ? isoOffsetDays(blueprint.endOffsetDays)
              : undefined,
        })),
        dependencies: dependencyTitles.map((title, index) => ({
          id: `${initiativeId}-dep-${index + 1}`,
          sourceTaskId: taskIds[0],
          taskId: `${SHOWCASE_TASK_PREFIX}${blueprint.key}-dependency-${index + 1}`,
          taskTitle: `Readiness checkpoint: ${title}`,
          taskStatus: blueprint.status === InitiativeStatus.BLOCKED ? 'BLOCKED' : 'IN_PROGRESS',
          taskPriority: 'HIGH',
          taskIndexCode: `D-${index + 1}`,
          dependencyType: 'FS',
          lagDays: 5,
          notes: `This workstream should not advance until ${title} is stable enough for integration.`,
          direction: 'predecessor',
          createdAt: isoOffsetDays(-7),
        })),
        stakeholders: [
          {
            id: `${initiativeId}-stakeholder-1`,
            decisionId: initiativeId,
            userId: ownerBusiness.id,
            userName: ownerBusiness.name,
            userEmail: ownerBusiness.email,
            role: 'accountable',
            notificationSettings: {
              enabled: true,
              triggers: ['on_update', 'on_comment', 'on_status_change'],
              emailEnabled: true,
              inAppEnabled: true,
            },
          },
          {
            id: `${initiativeId}-stakeholder-2`,
            decisionId: initiativeId,
            userId: ownerExecution.id,
            userName: ownerExecution.name,
            userEmail: ownerExecution.email,
            role: 'responsible',
            notificationSettings: {
              enabled: true,
              triggers: ['on_update', 'on_comment', 'on_deadline_approaching'],
              emailEnabled: true,
              inAppEnabled: true,
            },
          },
          {
            id: `${initiativeId}-stakeholder-3`,
            decisionId: initiativeId,
            userId: sponsor.id,
            userName: sponsor.name,
            userEmail: sponsor.email,
            role: 'consulted',
            notificationSettings: {
              enabled: true,
              triggers: ['on_comment', 'on_status_change'],
              emailEnabled: true,
              inAppEnabled: true,
            },
          },
        ],
        pendingApprovals:
          blueprint.status === InitiativeStatus.REVIEW ||
          blueprint.status === InitiativeStatus.APPROVED
            ? [
                {
                  id: `${initiativeId}-approval-1`,
                  gateType: 'PLANNING_GATE',
                  gateName: `Approve next step for ${blueprint.name}`,
                  requiredRole: 'sponsor',
                  status: 'PENDING',
                  requestedAt: isoOffsetDays(-1),
                  deciderId: sponsor.id,
                  deciderName: sponsor.name,
                  dueDate: isoOffsetDays(5),
                },
              ]
            : [],
        comments: [
          {
            id: `${initiativeId}-comment-1`,
            content: `The current draft is strong because it links the operating pain directly to one measurable delivery promise.`,
            authorId: sponsor.id,
            authorName: sponsor.name,
            createdAt: isoOffsetDays(-5),
            likes: 2,
          },
          {
            id: `${initiativeId}-comment-2`,
            content: `For the showcase, keep the story tight: problem first, then ownership, then the first visible delivery milestone.`,
            authorId: currentUserId,
            authorName: currentUserName,
            createdAt: isoOffsetDays(-3),
            likes: 1,
          },
          {
            id: `${initiativeId}-comment-3`,
            content: `The dependency picture is especially useful here because it explains why the timeline alone is not enough.`,
            authorId: ownerExecution.id,
            authorName: ownerExecution.name,
            createdAt: isoOffsetDays(-2),
            likes: 0,
          },
        ],
        gateRoles: [
          {
            id: `${initiativeId}-gate-role-1`,
            initiativeId,
            gateRole: 'INITIATIVE_OWNER',
            userId: ownerBusiness.id,
            firstName: ownerBusiness.firstName,
            lastName: ownerBusiness.lastName,
            email: ownerBusiness.email,
            assignedAt: isoOffsetDays(-18),
            source: 'explicit',
          },
          {
            id: `${initiativeId}-gate-role-2`,
            initiativeId,
            gateRole: 'DELIVERY_LEAD',
            userId: ownerExecution.id,
            firstName: ownerExecution.firstName,
            lastName: ownerExecution.lastName,
            email: ownerExecution.email,
            assignedAt: isoOffsetDays(-16),
            source: 'explicit',
          },
          {
            id: `${initiativeId}-gate-role-3`,
            initiativeId,
            gateRole: 'SPONSOR',
            userId: sponsor.id,
            firstName: sponsor.firstName,
            lastName: sponsor.lastName,
            email: sponsor.email,
            assignedAt: isoOffsetDays(-16),
            source: 'explicit',
          },
        ],
        gateReadiness: {
          currentStatus: blueprint.status,
          userRoles: ['INITIATIVE_OWNER', 'SPONSOR'],
          availableTransitions: [
            {
              targetStatus: transitionTarget,
              gate: blueprint.status === InitiativeStatus.BLOCKED ? 'RECOVERY_GATE' : 'NEXT_GATE',
              requiredRoles: ['SPONSOR'],
              assignedApprovers: [{ gateRole: 'SPONSOR', userId: sponsor.id }],
              canCurrentUserExecute: true,
              hasAssignedApprover: true,
            },
          ],
          capabilities: {
            version: 1,
            source: 'backend',
            topBar: {
              canEditPriority: true,
              canEditOwner: true,
              canEditTargetDate: true,
            },
            cards: {
              canEditCards: true,
              reasonCode: null,
            },
            reasonCodes: {},
            ctaBar: {
              workflowActions: [
                {
                  targetStatus: transitionTarget,
                  gate:
                    blueprint.status === InitiativeStatus.BLOCKED ? 'RECOVERY_GATE' : 'NEXT_GATE',
                },
              ],
              contextCreateActions: ['task', 'decision', 'risk'],
              canUseAi: true,
            },
          },
          readiness: [
            {
              key: 'problem_definition',
              label: 'Problem definition captured',
              pass: true,
              severity: 'blocking',
            },
            {
              key: 'owners_assigned',
              label: 'Owner and delivery lead assigned',
              pass: true,
              severity: 'blocking',
            },
            {
              key: 'dependency_health',
              label: 'Critical dependency health acceptable',
              pass: blueprint.status !== InitiativeStatus.BLOCKED,
              severity: blueprint.status === InitiativeStatus.BLOCKED ? 'blocking' : 'warning',
            },
          ],
          allBlocking: blueprint.status === InitiativeStatus.BLOCKED,
          allWarnings: blueprint.status !== InitiativeStatus.BLOCKED,
        },
        statusHistory: timeline.map((status, index) => ({
          id: `${initiativeId}-status-${index + 1}`,
          initiativeId,
          fromStatus: index === 0 ? status : timeline[index - 1],
          toStatus: status,
          changedBy: index % 2 === 0 ? ownerBusiness.id : sponsor.id,
          changedByFirstName: index % 2 === 0 ? ownerBusiness.firstName : sponsor.firstName,
          changedByLastName: index % 2 === 0 ? ownerBusiness.lastName : sponsor.lastName,
          changedByEmail: index % 2 === 0 ? ownerBusiness.email : sponsor.email,
          reason:
            status === blueprint.status
              ? `Current status reflects the latest governance checkpoint for ${blueprint.name}.`
              : `Moved into ${status.toLowerCase().replace(/_/g, ' ')} after the previous checkpoint.`,
          gateType: index === 0 ? 'ENTRY_GATE' : 'WORKFLOW_GATE',
          createdAt: isoOffsetDays(-30 + index * 6),
        })),
        resources: [
          {
            id: `${initiativeId}-resource-1`,
            initiativeId,
            userId: ownerBusiness.id,
            name: ownerBusiness.name,
            role: 'Business Owner',
            allocationPercentage: 45,
            startDate: isoOffsetDays(blueprint.startOffsetDays),
            endDate: isoOffsetDays(blueprint.endOffsetDays),
            notes: 'Owns business outcome framing and stakeholder alignment.',
          },
          {
            id: `${initiativeId}-resource-2`,
            initiativeId,
            userId: ownerExecution.id,
            name: ownerExecution.name,
            role: 'Delivery Lead',
            allocationPercentage: 70,
            startDate: isoOffsetDays(blueprint.startOffsetDays),
            endDate: isoOffsetDays(blueprint.endOffsetDays),
            notes: 'Leads sequencing, delivery tracking, and dependency management.',
          },
        ],
        budgetItems: [
          {
            id: `${initiativeId}-budget-1`,
            initiativeId,
            category: 'Software',
            costType: 'CAPEX',
            amount: Math.round(blueprint.budget * 0.36),
            currency: 'EUR',
            description: 'Core build and platform components.',
          },
          {
            id: `${initiativeId}-budget-2`,
            initiativeId,
            category: 'Services',
            costType: 'OPEX',
            amount: Math.round(blueprint.budget * 0.29),
            currency: 'EUR',
            description: 'Delivery support, enablement, and specialist services.',
          },
          {
            id: `${initiativeId}-budget-3`,
            initiativeId,
            category: 'Change',
            costType: 'OPEX',
            amount: Math.round(blueprint.budget * 0.18),
            currency: 'EUR',
            description: 'Adoption, training, and rollout support.',
          },
        ],
        tools: [
          {
            id: `${initiativeId}-tool-1`,
            initiativeId,
            name: `${blueprint.tags[0] || 'Delivery'} Workspace`,
            category: 'software',
            vendor: 'Consultify',
            licenseCost: Math.round(blueprint.budget * 0.08),
            licenseType: 'subscription',
            status: 'planned',
            notes: 'Primary workspace used to coordinate the initiative.',
          },
          {
            id: `${initiativeId}-tool-2`,
            initiativeId,
            name: 'Execution Reporting Pack',
            category: 'analytics',
            vendor: 'Consultify',
            licenseCost: Math.round(blueprint.budget * 0.05),
            licenseType: 'subscription',
            status: 'active',
            notes: 'Used for weekly review and KPI tracking.',
          },
        ],
        intangibleAssets: [
          {
            id: `${initiativeId}-asset-1`,
            initiativeId,
            assetType: 'knowledge',
            name: `${blueprint.name} playbook`,
            provider: 'Consultify',
            cost: Math.round(blueprint.budget * 0.04),
            currency: 'EUR',
            validFrom: isoOffsetDays(-5),
            validUntil: isoOffsetDays(blueprint.endOffsetDays + 120),
            status: 'active',
            beneficiaries: `${ownerBusiness.name}, ${ownerExecution.name}`,
            notes: 'Reusable operating playbook and delivery guidance.',
          },
        ],
        attachments: [
          {
            id: `${initiativeId}-attachment-1`,
            name: `${blueprint.name} - Executive Brief.pdf`,
            type: 'application/pdf',
            size: 320000,
            url: '#',
            uploadedAt: isoOffsetDays(-6),
            uploadedBy: currentUserName,
          },
          {
            id: `${initiativeId}-attachment-2`,
            name: `${blueprint.name} - KPI Baseline.xlsx`,
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            size: 180000,
            url: '#',
            uploadedAt: isoOffsetDays(-4),
            uploadedBy: ownerExecution.name,
          },
        ],
        linkedItems: [
          {
            id: `${initiativeId}-link-1`,
            type: 'assessment',
            title: `${blueprint.name} assessment input`,
            status: 'completed',
            linkRelation: 'informs',
            linkDirection: 'incoming',
          },
          {
            id: `${initiativeId}-link-2`,
            type: 'tool',
            title: `${blueprint.name} design workspace`,
            status: 'active',
            linkRelation: 'related',
            linkDirection: 'outgoing',
          },
        ],
      };

      return [initiativeId, detail];
    })
  );

  return {
    users: demoUsers.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
    })),
    initiatives,
    initiativeDetailsById,
  };
}
